const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
function page(api) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'gov.html'), 'utf8'), { runScripts: 'outside-only' });
  const { window } = dom;
  window.RV = { api, esc: value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    reaisCurto: cents => String((cents ?? 0) / 100), toast() {} };
  window.eval(fs.readFileSync(path.join(root, 'gov.js'), 'utf8'));
  return dom;
}
const settled = () => new Promise(resolve => setImmediate(resolve));
test('dashboard exibe zero como zero', async t => {
  const dom = page(async (method, url) => url.endsWith('/dashboard')
    ? { municipios: 0, candidatos: 0, emRevisao: 0, validados: 0 } : {});
  t.after(() => dom.window.close());
  await settled();
  for (const id of ['kpi-municipios', 'kpi-candidatos', 'kpi-revisao', 'kpi-validados']) {
    assert.equal(dom.window.document.getElementById(id).textContent, '0');
  }
});
test('listas vazias terminam carregamento e erros são escapados', async t => {
  const dom = page(async (method, url) => {
    if (url.includes('candidatos')) throw new Error('<img src=x onerror=alert(1)>');
    return {};
  });
  t.after(() => dom.window.close());
  await settled();
  const doc = dom.window.document;
  assert.match(doc.getElementById('tbody-municipios').textContent, /Nenhum município/);
  assert.equal(doc.getElementById('tbody-candidatos').querySelector('img'), null);
  assert.match(doc.getElementById('tbody-candidatos').textContent, /<img/);
});
test('busca e filtro enviam os parâmetros e renderizam os dados retornados', async t => {
  const calls = [];
  const dom = page(async (method, url) => {
    calls.push(url);
    if (url.includes('municipios')) return { municipios: [{ id: 'm1', name: '<script>teste</script>', ibgeCode: '3550308', state: 'SP', status: 'active' }] };
    if (url.includes('candidatos')) return { candidatos: [{ id: 'c1', entityName: 'Prefeitura', status: 'DRAFT', withheldAmountCents: 12345, potentialAmountCents: 0 }] };
    return {};
  });
  t.after(() => dom.window.close());
  await settled();
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#tbody-municipios script'), null);
  assert.match(doc.getElementById('tbody-municipios').textContent, /<script>teste<\/script>/);
  assert.match(doc.getElementById('tbody-candidatos').textContent, /123.45/);
  const input = doc.getElementById('busca-municipio');
  input.value = 'São Paulo';
  input.dispatchEvent(new dom.window.Event('input'));
  const select = doc.getElementById('filtro-status');
  select.value = 'UNDER_REVIEW';
  select.dispatchEvent(new dom.window.Event('change'));
  await settled();
  assert.ok(calls.includes('/api/v1/gov/municipios?q=S%C3%A3o%20Paulo'));
  assert.ok(calls.includes('/api/v1/gov/candidatos?status=UNDER_REVIEW'));
});
