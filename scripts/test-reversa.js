// Regressões da plataforma original sobre a cópia temporária já integrada ao Gov.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { SANDBOX, cleanup } = require('../tests/helpers');
const files = ['auth', 'security', 'domain', 'isolamento', 'crm', 'migrate', 'historico'];
// A base antiga não fecha os bancos; acrescentar apenas limpeza na cópia de testes.
fs.appendFileSync(path.join(SANDBOX, 'tests/helpers.js'), `
const tracked = [];
const originalCreateDb = module.exports.createDb;
module.exports.createDb = async () => {
  const result = await originalCreateDb();
  const close = result.db.close.bind(result.db);
  result.db.close = async () => { if (!result.db.closed) await close(); };
  tracked.push(result.db); return result;
};
require('node:test').after(async () => { for (const db of tracked) await db.close(); });
`);
try {
  const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1',
    ...files.map(file => path.join(SANDBOX, 'tests', `${file}.test.js`))], { stdio: 'inherit', cwd: SANDBOX });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally { cleanup(); }
