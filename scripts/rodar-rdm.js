// Executa toda a validação e gera a Ficha RDM em PDF (rdm/RDM-EstuLanches.pdf).
// Pré-requisito: ambiente no ar (docker compose up -d --build).
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const { runNpm } = require('./run-npm');
const root = path.resolve(__dirname, '..');
const steps = [
  { label: 'Testes unitários', command: npm, args: ['run', 'test:unit'] },
  { label: 'Testes de integração no PostgreSQL do Compose', command: 'docker', args: ['compose', '--profile', 'test', 'run', '--build', '--rm', 'tests'] },
  { label: 'Persistência dos dados (down/up com volume)', command: npm, args: ['run', 'persistencia'] },
  { label: 'Validação do ambiente', command: npm, args: ['run', 'validar'] }
];
let failures = 0;
for (const step of steps) {
  console.log(`\n=== ${step.label} ===`);
  const options = { cwd: root, stdio: 'inherit' };
  const result = step.command === npm ? runNpm(step.args, options) : spawnSync(step.command, step.args, options);
  if (result.error || result.status !== 0) { failures += 1; console.error(`${step.label}: FALHA${result.error ? ` (${result.error.message})` : ''}`); }
}
console.log('\n=== Geração da Ficha RDM ===');
const pdf = spawnSync(process.execPath, ['scripts/gerar-rdm.js'], { cwd: root, stdio: 'inherit' });
if (pdf.error || pdf.status !== 0 || failures > 0) process.exitCode = 1;
