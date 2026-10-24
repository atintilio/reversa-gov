// Reversa Gov — testes de unidade do domínio (isolado, aditivo).
// Usa PGlite (banco em memória) com todas as migrations reais, incluindo 014_gov.sql.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, freshRequire } from './helpers.js';
import { classificarIrrf } from '../lib/domain/gov-irrf.js';

async function setup() {
  const { db, sql } = await createDb();
  freshRequire('lib/db').setSqlForTests(sql);
  const gov = freshRequire('lib/domain/gov.js');
  return { db, sql, gov };
}

// Cria organização, usuário, membro, município e entidade para simular contexto de authz
async function seedContexto(sql) {
  const org = (await sql`insert into organizations (id, name, status)
    values (gen_random_uuid(), 'Município Teste', 'active') returning id`)[0];
  const user = (await sql`insert into users (id, email, email_normalized, name, password_hash, status)
    values (gen_random_uuid(), 'analista@teste.com.br', 'analista@teste.com.br', 'Analista Teste', 'hash', 'active') returning id`)[0];
  await sql`insert into organization_members (organization_id, user_id, role, status)
    values (${org.id}, ${user.id}, 'analyst', 'active')`;
  const municipio = (await sql`insert into gov_municipalities (organization_id, ibge_code, name, state, status)
    values (${org.id}, '3550308', 'São Paulo', 'SP', 'active') returning id`)[0];
  const entidade = (await sql`insert into gov_entities (organization_id, municipality_id, cnpj, legal_name, entity_type, is_active)
    values (${org.id}, ${municipio.id}, '12345678000199', 'Prefeitura de São Paulo', 'direct_admin', true) returning id`)[0];
  return { orgId: org.id, userId: user.id, municipioId: municipio.id, entidadeId: entidade.id };
}

const ctx = (orgId, userId) => ({
  organization: { id: orgId },
  user: { id: userId, name: 'Analista Teste', email: 'analista@teste.com.br', legacy: false },
  role: 'analyst',
});

describe('Reversa Gov — domínio', () => {
  it('classificarIrrf: não reteve → NO_WITHHOLDING', () => {
    const r = classificarIrrf({ reteve: false });
    assert.strictEqual(r.status, 'NO_WITHHOLDING');
    assert.strictEqual(r.creditoAutomatico, false);
  });

  it('classificarIrrf: reteve e apropriado → RETAINED_AND_RECOGNIZED', () => {
    const r = classificarIrrf({ reteve: true, apropriadoMunicipio: true });
    assert.strictEqual(r.status, 'RETAINED_AND_RECOGNIZED');
    assert.strictEqual(r.creditoAutomatico, false);
  });

  it('classificarIrrf: CNR 11009 → DESTINATION_UNPROVEN', () => {
    const r = classificarIrrf({ reteve: true, ehCNR11009: true });
    assert.strictEqual(r.status, 'DESTINATION_UNPROVEN');
    assert.strictEqual(r.creditoAutomatico, false);
  });

  it('classificarIrrf: reteve, destino não comprovado → DESTINATION_UNPROVEN', () => {
    const r = classificarIrrf({ reteve: true, destinoComprovado: false });
    assert.strictEqual(r.status, 'DESTINATION_UNPROVEN');
    assert.strictEqual(r.creditoAutomatico, false);
  });

  it('criar e listar municípios', async () => {
    const { sql, gov } = await setup();
    const { orgId, userId, municipioId } = await seedContexto(sql);
    const c = ctx(orgId, userId);

    const criado = await gov.criarMunicipio(c, {
      ibgeCode: '3106200',
      name: 'Belo Horizonte',
      state: 'MG',
      cnpjRoot: '12345678',
    });
    assert.strictEqual(criado.ibgeCode, '3106200');
    assert.strictEqual(criado.name, 'Belo Horizonte');
    assert.strictEqual(criado.state, 'MG');

    const listagem = await gov.listarMunicipios(c, {});
    assert.ok(listagem.municipios.some((m) => m.ibgeCode === '3106200'));

    const filtro = await gov.listarMunicipios(c, { uf: 'MG' });
    assert.ok(filtro.municipios.every((m) => m.state === 'MG'));

    const busca = await gov.listarMunicipios(c, { q: 'São Paulo' });
    assert.ok(busca.municipios.some((m) => m.ibgeCode === '3550308'));
  });

  it('criar e obter candidato', async () => {
    const { sql, gov } = await setup();
    const { orgId, userId, entidadeId } = await seedContexto(sql);
    const c = ctx(orgId, userId);

    const candidato = await gov.criarCandidato(c, {
      entityId: entidadeId,
      period: '2025-01-01',
      status: 'DRAFT',
      grossCandidateAmountCents: 1000000,
      withheldAmountCents: 150000,
      confidence: 'LOW',
    });
    assert.strictEqual(candidato.status, 'DRAFT');

    const obtido = await gov.obterCandidato(c, candidato.id);
    assert.strictEqual(obtido.id, candidato.id);
    assert.strictEqual(obtido.withheldAmountCents, 150000);
    assert.strictEqual(obtido.evidencias.length, 0);
  });

  it('status inválido lança erro', async () => {
    const { sql, gov } = await setup();
    const { orgId, userId, entidadeId } = await seedContexto(sql);
    const c = ctx(orgId, userId);

    await assert.rejects(
      gov.criarCandidato(c, {
        entityId: entidadeId,
        period: '2025-01-01',
        status: 'STATUS_INEXISTENTE',
      }),
      (err) => err.status === 400 && err.code === 'INVALID_STATUS'
    );
  });

  it('obter candidato inexistente lança 404', async () => {
    const { sql, gov } = await setup();
    const { orgId, userId } = await seedContexto(sql);
    const c = ctx(orgId, userId);

    await assert.rejects(
      gov.obterCandidato(c, '00000000-0000-0000-0000-000000000000'),
      (err) => err.status === 404 && err.code === 'NOT_FOUND'
    );
  });
});

describe('Reversa Gov — isolamento de dados', () => {
  it('municípios de uma organização não aparecem para outra', async () => {
    const { sql, gov } = await setup();

    const orgA = (await sql`insert into organizations (id, name, status)
      values (gen_random_uuid(), 'Org A', 'active') returning id`)[0];
    const userA = (await sql`insert into users (id, email, email_normalized, name, password_hash, status)
      values (gen_random_uuid(), 'a@teste.com.br', 'a@teste.com.br', 'User A', 'hash', 'active') returning id`)[0];
    await sql`insert into organization_members (organization_id, user_id, role, status)
      values (${orgA.id}, ${userA.id}, 'analyst', 'active')`;

    const orgB = (await sql`insert into organizations (id, name, status)
      values (gen_random_uuid(), 'Org B', 'active') returning id`)[0];
    const userB = (await sql`insert into users (id, email, email_normalized, name, password_hash, status)
      values (gen_random_uuid(), 'b@teste.com.br', 'b@teste.com.br', 'User B', 'hash', 'active') returning id`)[0];
    await sql`insert into organization_members (organization_id, user_id, role, status)
      values (${orgB.id}, ${userB.id}, 'analyst', 'active')`;

    await gov.criarMunicipio(ctx(orgA.id, userA.id), {
      ibgeCode: '3550308',
      name: 'São Paulo',
      state: 'SP',
    });

    const listagemB = await gov.listarMunicipios(ctx(orgB.id, userB.id), {});
    assert.strictEqual(listagemB.municipios.length, 0);
  });
});