const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createDb, freshRequire, call, closeDatabases, cleanup } = require('./helpers');
const { classificarIrrf } = require('../lib/domain/gov-irrf');
let db, sql, gov, evidence, handler, a, b, counter = 0;
before(async () => {
  ({ db, sql } = await createDb());
  gov = freshRequire('lib/domain/gov');
  evidence = freshRequire('lib/domain/gov-evidence');
  handler = freshRequire('api/v1/[...route].js');
});
after(async () => { await closeDatabases(); cleanup(); });
async function seed() {
  const n = ++counter;
  const org = (await sql`insert into organizations (name, status) values ('Org teste', 'active') returning id`)[0];
  const user = (await sql`insert into users (email, email_normalized, name, password_hash, status)
    values (${`teste${n}@example.test`}, ${`teste${n}@example.test`}, 'Analista', 'hash', 'active') returning id`)[0];
  await sql`insert into organization_members (organization_id, user_id, role, status) values (${org.id}, ${user.id}, 'analyst', 'active')`;
  const municipality = (await sql`insert into gov_municipalities (organization_id, ibge_code, name, state)
    values (${org.id}, ${String(3000000 + n)}, 'Município', 'SP') returning id`)[0];
  const entity = (await sql`insert into gov_entities (organization_id, municipality_id, cnpj, legal_name, entity_type)
    values (${org.id}, ${municipality.id}, ${String(n).padStart(14, '0')}, 'Prefeitura', 'direct_admin') returning id`)[0];
  const candidate = (await sql`insert into gov_candidates (organization_id, entity_id, status)
    values (${org.id}, ${entity.id}, 'DRAFT') returning id`)[0];
  const document = (await sql`insert into gov_documents (organization_id, original_name, mime_type, size_bytes, checksum_sha256)
    values (${org.id}, 'prova.pdf', 'application/pdf', 100, ${'a'.repeat(64)}) returning id`)[0];
  const cookie = (await freshRequire('lib/auth').createSession(user.id)).split(';')[0];
  return { ctx: { organization: org, user, role: 'analyst' }, entityId: entity.id, candidateId: candidate.id, documentId: document.id, cookie };
}
beforeEach(async () => { a = await seed(); b = await seed(); });
const httpError = (status, code) => e => e.status === status && (!code || e.code === code);
const get = (path, cookie = a.cookie) => call(handler, { url: `/api/v1/${path}`, cookie });

test('CNR textual 11009 exige análise mesmo com apropriação municipal informada', () => {
  const result = classificarIrrf({ reteve: true, apropriadoMunicipio: true, cnr: '11009' });
  assert.equal(result.status, 'DESTINATION_UNPROVEN');
  assert.equal(result.creditoAutomatico, false);
});
test('todas as combinações de classificação preservam crédito não automático', () => {
  for (let mask = 0; mask < 32; mask++) {
    const result = classificarIrrf({ reteve: !!(mask & 1), apropriadoMunicipio: !!(mask & 2),
      remetidoUniao: !!(mask & 4), destinoComprovado: !!(mask & 8), ehCNR11009: !!(mask & 16) });
    assert.equal(result.creditoAutomatico, false);
  }
});
test('repasse à União permanece candidato à investigação', () => {
  assert.equal(classificarIrrf({ reteve: true, remetidoUniao: true }).status, 'RETAINED_REMITTED_UNION');
  assert.equal(classificarIrrf({ reteve: true, destinoComprovado: true }).status, 'DECLARATION_MISMATCH');
});
test('vincular evidência grava vínculo e auditoria com o candidato correto', async () => {
  const linked = await evidence.vincularEvidencia(a.ctx, a.candidateId, { documentId: a.documentId, evidenceType: 'WITHHOLDING', recordLocator: 'p. 1' });
  const list = await evidence.listarEvidencias(a.ctx, a.candidateId);
  assert.equal(list.evidencias[0].id, linked.id);
  const events = await sql`select metadata from audit_events where entity_id = ${linked.id}`;
  assert.equal(events[0].metadata.candidateId, a.candidateId);
});
test('registrar revisão grava decisão e auditoria sem reconhecer crédito automaticamente', async () => {
  const reviewed = await evidence.registrarRevisao({ ...a.ctx, role: 'admin' }, a.candidateId, { decision: 'REQUEST_MORE_EVIDENCE', reason: 'Falta prova do destino' });
  const events = await sql`select metadata from audit_events where entity_id = ${reviewed.id}`;
  assert.equal(events[0].metadata.candidateId, a.candidateId);
  assert.equal((await gov.obterCandidato(a.ctx, a.candidateId)).status, 'DRAFT');
});
test('não permite criar candidato para entidade de outra organização', async () => {
  await assert.rejects(gov.criarCandidato(a.ctx, { entityId: b.entityId }), httpError(404));
});
test('não permite obter candidato de outra organização', async () => {
  await assert.rejects(gov.obterCandidato(a.ctx, b.candidateId), httpError(404));
});
test('não permite vincular documento de outra organização', async () => {
  await assert.rejects(evidence.vincularEvidencia(a.ctx, a.candidateId,
    { documentId: b.documentId, evidenceType: 'WITHHOLDING' }), httpError(404));
});
test('não permite gravar evidência nem revisão em candidato de outra organização', async () => {
  await assert.rejects(evidence.vincularEvidencia(a.ctx, b.candidateId, { evidenceType: 'PAYMENT' }), httpError(404));
  await assert.rejects(evidence.registrarRevisao(a.ctx, b.candidateId, { decision: 'REJECT', reason: 'Sem prova' }), httpError(404));
  await assert.rejects(evidence.listarEvidencias(a.ctx, b.candidateId), httpError(404));
});
test('valores monetários devem ser inteiros não negativos e seguros', async () => {
  for (const value of [-1, 1.5, '150', Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(gov.criarCandidato(a.ctx, { entityId: a.entityId, withheldAmountCents: value }), httpError(400));
  }
});
test('potencial de zero é preservado em vez de virar nulo', async () => {
  const result = await gov.criarCandidato(a.ctx, { entityId: a.entityId, potentialAmountCents: 0 });
  assert.equal((await gov.obterCandidato(a.ctx, result.id)).potentialAmountCents, 0);
});
test('criação não pode validar candidato sem revisão e evidências', async () => {
  await assert.rejects(gov.criarCandidato(a.ctx, { entityId: a.entityId, status: 'VALIDATED' }), httpError(400));
});
test('campos obrigatórios de município não aceitam espaços ou formatos inválidos', async () => {
  for (const body of [{ ibgeCode: 'abc', name: 'Cidade', state: 'SP' },
    { ibgeCode: '3550308', name: '   ', state: 'SP' }, { ibgeCode: '3550308', name: 'Cidade', state: 'XX' }]) {
    await assert.rejects(gov.criarMunicipio(a.ctx, body), httpError(400));
  }
});
test('mesmo IBGE pode existir em organizações distintas; duplicado local retorna 409', async () => {
  const body = { ibgeCode: '3550308', name: 'São Paulo', state: 'SP' };
  await gov.criarMunicipio(a.ctx, body);
  await gov.criarMunicipio(b.ctx, body);
  await assert.rejects(gov.criarMunicipio(a.ctx, body), httpError(409));
});
test('banco rejeita candidato com entidade de outra organização', async () => {
  await assert.rejects(sql`insert into gov_candidates (organization_id, entity_id) values (${a.ctx.organization.id}, ${b.entityId})`, e => e.code === '23503');
});
test('pesquisa de município aceita UF e normaliza filtro', async () => {
  const result = await gov.listarMunicipios(a.ctx, { q: 'sp', uf: 'sp' });
  assert.equal(result.municipios.length, 1);
});
test('API retorna 400 para UUID malformado em vez de 500', async () => {
  assert.equal((await get('gov/candidatos/invalido')).statusCode, 400);
});
test('API bloqueia sessão forjada e sessão revogada', async () => {
  assert.equal((await get('gov/municipios', `rv_session=test_${a.ctx.user.id}`)).statusCode, 401);
  const raw = a.cookie.slice(a.cookie.indexOf('=') + 1);
  await freshRequire('lib/auth').revokeSession(raw);
  assert.equal((await get('gov/municipios')).statusCode, 401);
});
test('viewer pode ler mas não gravar municípios ou candidatos', async () => {
  await sql`update organization_members set role = 'viewer' where user_id = ${a.ctx.user.id}`;
  assert.equal((await get('gov/municipios')).statusCode, 200);
  for (const path of ['gov/municipios', 'gov/candidatos']) {
    assert.equal((await call(handler, { method: 'POST', url: `/api/v1/${path}`, cookie: a.cookie, body: {} })).statusCode, 403);
  }
});
test('analyst não revisa; admin pode registrar pedido de evidências', async () => {
  const request = { method: 'POST', url: `/api/v1/gov/candidatos/${a.candidateId}/revisao`, cookie: a.cookie,
    body: { decision: 'REQUEST_MORE_EVIDENCE', reason: 'Apresentar comprovante' } };
  assert.equal((await call(handler, request)).statusCode, 403);
  await sql`update organization_members set role = 'admin' where user_id = ${a.ctx.user.id}`;
  assert.equal((await call(handler, request)).statusCode, 201);
});
test('API preserva isolamento nas listas e detalhes de candidatos', async () => {
  const list = JSON.parse((await get('gov/candidatos')).body).candidatos;
  assert.deepEqual(list.map(c => c.id), [a.candidateId]);
  assert.equal((await get(`gov/candidatos/${b.candidateId}`)).statusCode, 404);
});
test('dashboard usa contagens reais da organização', async () => {
  const response = await get('gov/dashboard');
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { municipios: 1, candidatos: 1, emRevisao: 0, validados: 0 });
});
test('API aceita criação e leitura de candidato com sessão real', async () => {
  const result = await call(handler, { method: 'POST', url: '/api/v1/gov/candidatos', cookie: a.cookie,
    body: { entityId: a.entityId, withheldAmountCents: 12345 } });
  assert.equal(result.statusCode, 201);
  const details = await get(`gov/candidatos/${JSON.parse(result.body).id}`);
  assert.equal(JSON.parse(details.body).withheldAmountCents, 12345);
});
test('métodos não suportados retornam 405 e rotas não implementadas retornam 404', async () => {
  const response = await call(handler, { method: 'DELETE', url: '/api/v1/gov/municipios', cookie: a.cookie });
  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.allow, 'GET, POST');
  assert.equal((await get('gov/fontes')).statusCode, 404);
  assert.equal((await get(`gov/candidatos/${a.candidateId}/evidencias/extra/mais`)).statusCode, 404);
});
test('rewrite do Vercel chega ao mesmo handler autenticado', async () => {
  const result = await call(handler, { url: '/api/v1/rota', query: { rvpath: 'gov/municipios' }, cookie: a.cookie });
  assert.equal(result.statusCode, 200);
  assert.equal(JSON.parse(result.body).municipios.length, 1);
});
test('rota existente /me permanece funcional e com as mesmas permissões', async () => {
  const result = await get('me');
  assert.equal(result.statusCode, 200);
  assert.equal(JSON.parse(result.body).role, 'analyst');
  assert.equal(JSON.parse(result.body).permissions.review, false);
});
test('migration corretiva é reexecutável sem alterar dados existentes', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { ROOT } = require('./helpers');
  const { splitStatements } = freshRequire('scripts/migrate');
  for (const statement of splitStatements(fs.readFileSync(path.join(ROOT, 'db/migrations/015_gov_tenant_integrity.sql'), 'utf8'))) await db.exec(statement);
  assert.equal((await gov.obterCandidato(a.ctx, a.candidateId)).id, a.candidateId);
});
test('evidências e revisões inválidas retornam 400 sem gravar registros', async () => {
  await assert.rejects(evidence.vincularEvidencia(a.ctx, a.candidateId, { evidenceType: '  ' }), httpError(400));
  await assert.rejects(evidence.registrarRevisao(a.ctx, a.candidateId, { decision: 'INVALID', reason: 'Texto' }), httpError(400));
  await assert.rejects(evidence.registrarRevisao(a.ctx, a.candidateId, { decision: 'APPROVE', reason: '  ' }), httpError(400));
  assert.equal((await evidence.listarEvidencias(a.ctx, a.candidateId)).evidencias.length, 0);
});
test('corpo JSON nulo retorna 400 em evidências e revisão', async () => {
  await sql`update organization_members set role = 'admin' where user_id = ${a.ctx.user.id}`;
  for (const action of ['evidencias', 'revisao']) {
    const response = await call(handler, { method: 'POST', url: `/api/v1/gov/candidatos/${a.candidateId}/${action}`, cookie: a.cookie, body: 'null' });
    assert.equal(response.statusCode, 400);
  }
});
test('data e enums inválidos retornam 400 sem criar candidato', async () => {
  for (const fields of [{ period: '2025-02-30' }, { confidence: 'INCERTA' }, { legalOwner: 'OUTRO' }]) {
    await assert.rejects(gov.criarCandidato(a.ctx, { entityId: a.entityId, ...fields }), httpError(400));
  }
  assert.equal((await gov.listarCandidatos(a.ctx)).candidatos.length, 1);
});
test('banco bloqueia vínculo de evidência e revisão com candidato de outra organização', async () => {
  await assert.rejects(sql`insert into gov_evidence_links (organization_id, candidate_id, evidence_type)
    values (${a.ctx.organization.id}, ${b.candidateId}, 'PAYMENT')`, e => e.code === '23503');
  await assert.rejects(sql`insert into gov_reviews (organization_id, candidate_id, reviewer_id, reviewer_role, decision, reason)
    values (${a.ctx.organization.id}, ${b.candidateId}, ${a.ctx.user.id}, 'admin', 'REJECT', 'Motivo')`, e => e.code === '23503');
});
test('API rejeita CNR extenso ou não textual com 400', async () => {
  for (const cnr of ['1'.repeat(21), { code: '11009' }]) {
    const response = await call(handler, { method: 'POST', url: '/api/v1/gov/candidatos', cookie: a.cookie,
      body: { entityId: a.entityId, cnr } });
    assert.equal(response.statusCode, 400);
  }
});
