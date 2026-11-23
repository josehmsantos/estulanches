// Prova a persistência dos dados: grava um produto, derruba TODOS os containers (docker compose down,
// que mantém o volume), sobe de novo e confere se o produto continua no banco.
// Uso (com o ambiente já no ar): npm run persistencia   — grava rdm/persistencia.json
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(root, '.env') });

const base = `http://127.0.0.1:${process.env.HOST_PORT || 3000}`;
const compose = (args) => execFileSync('docker', ['compose', ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const json = { 'Content-Type': 'application/json' };

async function waitHealthy(timeoutMs = 120000) {
  const limit = Date.now() + timeoutMs;
  while (Date.now() < limit) {
    try { const r = await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) }); if (r.ok) return; } catch { /* ainda subindo */ }
    await sleep(2000);
  }
  throw new Error('A aplicação não ficou saudável a tempo.');
}

(async () => {
  const result = { testedAt: new Date().toISOString(), ok: false, steps: [] };
  const name = `Persistencia-${Date.now()}`;
  let id = null;
  try {
    await waitHealthy();
    const created = await fetch(`${base}/api/products`, { method: 'POST', headers: json, body: JSON.stringify({ name, description: 'teste de persistência', price: 1, category: 'Teste' }) });
    if (created.status !== 201) throw new Error(`Falha ao criar produto (HTTP ${created.status}).`);
    id = (await created.json()).id;
    result.steps.push(`Produto ${id} criado.`);

    compose(['down']); // remove containers e redes, mas MANTÉM o volume postgres_data
    result.steps.push('docker compose down executado (volume mantido).');
    compose(['up', '-d']);
    result.steps.push('docker compose up -d executado.');
    await waitHealthy();

    const found = await fetch(`${base}/api/products/${id}`);
    const body = found.ok ? await found.json() : null;
    result.ok = found.status === 200 && body?.name === name;
    result.steps.push(result.ok ? 'Produto encontrado após recriar os containers.' : 'Produto NÃO encontrado após recriar os containers.');
  } catch (error) {
    result.error = (error.stderr || error.message).toString().slice(0, 300);
  } finally {
    if (id) { try { await fetch(`${base}/api/products/${id}`, { method: 'DELETE' }); } catch { /* limpeza best-effort */ } }
    fs.mkdirSync(path.join(root, 'rdm'), { recursive: true });
    fs.writeFileSync(path.join(root, 'rdm', 'persistencia.json'), `${JSON.stringify(result, null, 2)}\n`);
    console.log(`Persistência dos dados: ${result.ok ? 'OK' : 'FALHA'}${result.error ? ` (${result.error})` : ''}`);
    if (!result.ok) process.exitCode = 1;
  }
})();
