// Reversa Gov — testes de API do módulo IRRF Municipal (isolado, aditivo).
// Usa o padrão de testes existente: createDb, freshRequire, call.
// Requer que a rota 'gov' esteja registrada em api/v1/[...route].js.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, freshRequire, call } from './helpers.js';

async function setup() {
  const { db, sql } = await createDb();
  const handler = freshRequire('api/v1/[...route].js');
  return { db, sql, handler };
}

async function seedContexto(sql) {
  const org = (await sql`insert into organizations (id, name, status)
    values (gen_random_uuid(), 'Org Gov Teste', 'active') returning id`)[0];
  const user = (await sql`insert into users (id, email, email_normalized, name, password_hash, status)
    values (gen_random_uuid(), 'analista@govteste.com.br', 'analista@govteste.com.br', 'Analista Gov', 'hash', 'active') returning id`)[0];
  await sql`insert into organization_members (organization_id, user_id, role, status)
    values (${org.id}, ${user.id}, 'analyst', 'active')`;
  return { orgId: org.id, userId: user.id };
}

// Cookie de sessão simulado para testes (o contexto de authz será resolvido pelo banco)
function cookiePara(userId) {
  return `rv_session=test_${userId}`;
}

describe('Reversa Gov — API', () => {
  it('POST /api/v1/gov/municipios cria município', async () => {
    const { sql, handler } = await setup();
    const { orgId, userId } = await seedContexto(sql);

    const res = await call(handler, {
      method: 'POST',
      url: '/api/v1/gov/municipios',
      body: { ibgeCode: '3550308', name: 'São Paulo', state: 'SP', cnpjRoot: '12345678' },
      cookie: cookiePara(userId),
    });

    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.ibgeCode, '3550308');
    assert.strictEqual(body.name, 'São Paulo');
    assert.strictEqual(body.state, 'SP');
  });

  it('GET /api/v1/gov/municipios lista municípios', async () => {
    const { sql, handler } = await setup();
    const { orgId, userId } = await seedContexto(sql);

    await sql`insert into gov_municipalities (organization_id, ibge_code, name, state, status)
      values (${orgId}, '3106200', 'Belo Horizonte', 'MG', 'active')`;

    const res = await call(handler, {
      method: 'GET',
      url: '/api/v1/gov/municipios',
      cookie: cookiePara(userId),
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(Array.isArray(body.municipios));
    assert.ok(body.municipios.some((m) => m.ibgeCode === '3106200'));
  });

  it('GET /api/v1/gov/municipios filtra por UF', async () => {
    const { sql, handler } = await setup();
    const { orgId, userId } = await seedContexto(sql);

    await sql`insert into gov_municipalities (organization_id, ibge_code, name, state, status)
      values (${orgId}, '3106200', 'Belo Horizonte', 'MG', 'active')`;

    const res = await call(handler, {
      method: 'GET',
      url: '/api/v1/gov/municipios?uf=MG',
      cookie: cookiePara(userId),
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.municipios.every((m) => m.state === 'MG'));
  });

  it('sem sessão retorna 401', async () => {
    const { handler } = await setup();
    const res = await call(handler, {
      method: 'GET',
      url: '/api/v1/gov/municipios',
      cookie: '',
    });
    assert.strictEqual(res.statusCode, 401);
  });
});