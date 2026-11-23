// Valida o ambiente de produção que está rodando no Docker Compose e grava rdm/resultados.json.
// Uso: docker compose up -d --build   e depois   npm run validar
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(root, '.env') });
const outputDir = path.join(root, 'rdm');
fs.mkdirSync(outputDir, { recursive: true });

const hostPort = process.env.HOST_PORT || 3000;
const EXPECTED_SERVICES = 2; // app e db
const docker = (args) => execFileSync('docker', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const compose = (args) => docker(['compose', ...args]);
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const criticalPattern = /\b(fatal|panic|uncaught exception|unhandled rejection|ECONNREFUSED|permission denied|error: relation .* does not exist)\b/i;

const result = {
  generatedAt: new Date().toISOString(),
  packageVersion: require('../package.json').version,
  composePs: '', versions: {}, ports: {}, database: {},
  logCriticalErrors: 0, criticalLogLines: [],
  health: { ok: false, status: null, body: null },
  checks: {}
};

// 1) Containers: aguarda os dois serviços ficarem (healthy). "unhealthy" NÃO conta como saudável.
try {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    result.composePs = compose(['ps']);
    const healthy = result.composePs.split(/\r?\n/).filter((line) => /\(healthy\)/.test(line)).length;
    if (healthy === EXPECTED_SERVICES) break;
    if (attempt < 29) sleep(2000);
  }
  const lines = result.composePs.split(/\r?\n/);
  result.checks.composePs = lines.filter((line) => /\(healthy\)/.test(line)).length === EXPECTED_SERVICES;
  // 2) Portas: só a aplicação publica porta no host; o banco não.
  const appLine = lines.find((line) => /-app-\d+/.test(line)) || '';
  const dbLine = lines.find((line) => /-db-\d+/.test(line)) || '';
  result.ports = { app: (appLine.match(/\d+\.\d+\.\d+\.\d+:\d+->\d+\/tcp/) || [])[0] || null, dbPublished: dbLine.includes('->') };
  result.checks.ports = Boolean(result.ports.app) && result.ports.app.includes(`:${hostPort}->3000/tcp`) && !result.ports.dbPublished;
} catch (error) { result.checks.composePs = false; result.composeError = error.stderr || error.message; }

try {
  result.versions = { docker: docker(['--version']), compose: compose(['version', '--short']) };
} catch (error) { result.versions.error = error.message; }

// 3) Banco: consulta feita de dentro do container do PostgreSQL.
try {
  const sql = "SELECT (SELECT count(*) FROM information_schema.tables WHERE table_schema='public'), (SELECT count(*) FROM products)";
  const out = compose(['exec', '-T', 'db', 'sh', '-c', `psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA -F, -c "${sql}"`]);
  const [tables, products] = out.split(',').map(Number);
  result.database = { tables, products };
  result.checks.database = tables >= 3 && products >= 0;
} catch (error) { result.checks.database = false; result.database.error = (error.stderr || error.message).toString().slice(0, 200); }

// 4) Logs: procura erros críticos nos logs dos dois serviços.
try {
  const logs = compose(['logs', '--no-color', '--tail=500']);
  result.criticalLogLines = logs.split(/\r?\n/).filter((line) => criticalPattern.test(line));
  result.logCriticalErrors = result.criticalLogLines.length;
  result.checks.logs = result.logCriticalErrors === 0;
} catch (error) { result.checks.logs = false; result.logError = error.stderr || error.message; }

// 5) API: /health confirma que a aplicação alcança o banco.
(async () => {
  try {
    const response = await fetch(`http://127.0.0.1:${hostPort}/health`, { signal: AbortSignal.timeout(5000) });
    result.health.status = response.status;
    try { result.health.body = await response.json(); } catch { result.health.body = await response.text(); }
    result.health.ok = response.ok && result.health.body?.database === 'connected';
  } catch (error) { result.health.error = error.message; }
  result.checks.health = result.health.ok;
  fs.writeFileSync(path.join(outputDir, 'resultados.json'), `${JSON.stringify(result, null, 2)}\n`);
  const label = (ok) => (ok ? 'OK' : 'FALHA');
  console.log(`Containers saudáveis: ${label(result.checks.composePs)}`);
  console.log(`Portas (só o app publicado): ${label(result.checks.ports)}${result.ports.app ? ` [${result.ports.app}]` : ''}`);
  console.log(`Banco (psql no container): ${label(result.checks.database)}${result.database.tables !== undefined ? ` [${result.database.tables} tabelas, ${result.database.products} produtos]` : ''}`);
  console.log(`Logs críticos: ${result.logCriticalErrors} (${label(result.checks.logs)})`);
  console.log(`API /health: ${label(result.checks.health)}`);
  console.log('Resultado salvo em rdm/resultados.json');
  if (Object.values(result.checks).some((ok) => ok !== true)) process.exitCode = 1;
})();
