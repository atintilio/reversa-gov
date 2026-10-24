// Executa o módulo com uma cópia descartável da base real; nunca usa o banco configurado no ambiente.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), 'reversa-gov-test-'));
execFileSync('tar', ['-xzf', path.join(__dirname, 'fixtures/reversa-baseline.tar.gz'), '-C', SANDBOX]);
const manifest = require('./fixtures/reversa-baseline.sha256.json');
for (const [file, digest] of Object.entries(manifest)) {
  const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(SANDBOX, file))).digest('hex');
  if (actual !== digest) throw new Error(`Fixture alterada: ${file}`);
}
fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(SANDBOX, 'node_modules'), 'dir');
for (const dir of ['lib/domain', 'db/migrations']) {
  for (const file of fs.readdirSync(path.join(ROOT, dir))) {
    fs.copyFileSync(path.join(ROOT, dir, file), path.join(SANDBOX, dir, file));
  }
}
// A mesma adição documentada em PATCH_ROTEADOR_GOV.md, somente na cópia de teste.
const routerPath = path.join(SANDBOX, 'api/v1/[...route].js');
const router = fs.readFileSync(routerPath, 'utf8');
fs.writeFileSync(routerPath, router.replace('    default:',
  "    case 'gov':\n      return require('../../lib/domain/gov-routes')({ ctx, m, query, body, parts: segments(req), deny }, res);\n\n    default:"));
const databases = new Set();
async function createDb() {
  const { PGlite } = require('@electric-sql/pglite');
  const db = new PGlite();
  databases.add(db);
  const { splitStatements } = require(path.join(SANDBOX, 'scripts/migrate'));
  const dir = path.join(SANDBOX, 'db/migrations');
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    for (const statement of splitStatements(fs.readFileSync(path.join(dir, file), 'utf8'))) {
      if (/^(\s*--[^\n]*\n)*\s*create extension/i.test(statement)) continue;
      await db.exec(statement);
    }
  }
  const sql = async (strings, ...values) => {
    const text = strings.reduce((s, part, i) => s + (i ? `$${i}` : '') + part, '');
    return (await db.query(text, values)).rows;
  };
  require(path.join(SANDBOX, 'lib/db')).setSqlForTests(sql);
  return { db, sql };
}
function freshRequire(file) { return require(path.join(SANDBOX, file)); }
async function call(handler, { method = 'GET', body, query = {}, cookie = '', url = '/' } = {}) {
  const parsed = new URL(url, 'http://test.local');
  const req = { method, url, body, query: { ...Object.fromEntries(parsed.searchParams), ...query },
    headers: { cookie, 'content-type': 'application/json', 'user-agent': 'node-test' }, socket: {} };
  const res = { statusCode: 200, headers: {},
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(b) { this.body = b == null ? '' : String(b); } };
  await handler(req, res);
  return res;
}
async function closeDatabases() {
  for (const db of databases) await db.close();
  databases.clear();
}
function cleanup() { fs.rmSync(SANDBOX, { recursive: true, force: true }); }
module.exports = { ROOT, SANDBOX, createDb, freshRequire, call, closeDatabases, cleanup };
