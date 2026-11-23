const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const { runNpm } = require('./run-npm');
const commands = [
  { label: 'Testes unitários', command: npm, args: ['run', 'test:unit'] },
  { label: 'Testes de integração no PostgreSQL do Compose', command: 'docker', args: ['compose', '--profile', 'test', 'run', '--build', '--rm', 'tests', 'npm', 'run', 'test:integration'] }
];
let failed = false;
for (const item of commands) {
  console.log(`\n=== ${item.label} ===`);
  const options = { cwd: root, stdio: 'inherit' };
  const result = item.command === npm ? runNpm(item.args, options) : spawnSync(item.command, item.args, options);
  if (result.error || result.status !== 0) {
    failed = true;
    console.error(`${item.label}: FALHA${result.error ? ` (${result.error.message})` : ''}`);
  }
}
if (failed) process.exitCode = 1;
