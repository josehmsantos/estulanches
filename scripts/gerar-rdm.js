// Gera a Ficha RDM (Registro de Mudança) de UMA página em rdm/RDM-EstuLanches.pdf.
// Usa apenas resultados reais gravados em rdm/*.json. O que não foi medido aparece como PENDENTE.
const fs = require('node:fs');
const path = require('node:path');
const PDFDocument = require('pdfkit');

const root = path.resolve(__dirname, '..');
const rdm = path.join(root, 'rdm');
const readJson = (file) => { try { return JSON.parse(fs.readFileSync(path.join(rdm, file), 'utf8')); } catch { return null; } };
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const config = readJson('config-rdm.json');
if (!config) { console.error('rdm/config-rdm.json ausente ou inválido.'); process.exit(1); }
const unit = readJson('testes-unitarios.json');
const integration = readJson('testes-integracao.json');
const environment = readJson('resultados.json');
const persistence = readJson('persistencia.json');
const pkg = require('../package.json');
const compose = read('docker-compose.yml');
const dockerfile = read('Dockerfile');

// ---- dados reais -> estados (true = OK, false = FALHA, null = PENDENTE) ----
const stats = (report) => (report ? { total: report.numTotalTests || 0, passed: report.numPassedTests || 0, failed: report.numFailedTests || 0 } : null);
const unitStats = stats(unit), integrationStats = stats(integration);
const testState = (s) => (s && s.total > 0 ? s.failed === 0 && s.passed === s.total : null);
const checks = environment?.checks || {};
const envState = (key) => (key in checks ? checks[key] === true : null);
const states = {
  unit: testState(unitStats), integration: testState(integrationStats),
  containers: envState('composePs'), ports: envState('ports'), database: envState('database'),
  health: envState('health'), logs: envState('logs'), persistence: persistence ? persistence.ok === true : null
};
const values = Object.values(states);
const status = values.includes(false) ? 'FALHA' : values.includes(null) ? 'PENDENTE' : 'SUCESSO';

const nodeImage = (dockerfile.match(/FROM (node:[\w.-]+) AS production/) || [])[1] || 'Node.js';
const pgImage = (compose.match(/image:\s*(postgres:[\w.-]+)/) || [])[1] || 'PostgreSQL';
const tech = [`${nodeImage}`, `Express ${pkg.dependencies.express}`, `${pgImage}`, 'Docker Compose', 'Zod, Helmet, Pino', 'Jest + Supertest'].join(' · ');
const deployedAt = environment?.generatedAt ? new Date(environment.generatedAt).toLocaleString('pt-BR') : null;

// ---- desenho ----
const PAGE_W = 595.28, M = 34, W = PAGE_W - 2 * M;
const green = '#146c5a', dark = '#17372f', muted = '#5b6e66', pale = '#eef5f1', line = '#d5e3dc';
const palette = { OK: ['#dff4e8', '#176341'], FALHA: ['#fde5e2', '#a3332d'], PENDENTE: ['#fff1d9', '#87530e'] };
const label = (state) => (state === true ? 'OK' : state === false ? 'FALHA' : 'PENDENTE');
const statusLabel = { SUCESSO: 'OK', FALHA: 'FALHA', PENDENTE: 'PENDENTE' }[status];

const doc = new PDFDocument({ size: 'A4', margin: M, info: { Title: 'Ficha RDM - EstuLanches', Author: 'EstuLanches' } });
let pages = 1;
doc.on('pageAdded', () => { pages += 1; });
doc.pipe(fs.createWriteStream(path.join(rdm, 'RDM-EstuLanches.pdf')));

// Cabeçalho
doc.rect(0, 0, PAGE_W, 82).fill(green);
doc.fillColor('white').font('Helvetica-Bold').fontSize(17).text('REGISTRO DE MUDANÇA (RDM)', M, 22, { lineBreak: false });
doc.font('Helvetica').fontSize(10).text('Implantação em produção · Sistema EstuLanches', M, 49, { lineBreak: false });
doc.fontSize(8.5).text(`Ficha gerada em ${new Date().toLocaleString('pt-BR')}`, M, 64, { lineBreak: false });
const [bg, fg] = palette[statusLabel];
doc.roundedRect(PAGE_W - M - 150, 24, 150, 34, 9).fill(bg);
doc.fillColor(fg).font('Helvetica-Bold').fontSize(8).text('STATUS DA IMPLANTAÇÃO', PAGE_W - M - 150, 30, { width: 150, align: 'center', lineBreak: false });
doc.fontSize(12).text(status, PAGE_W - M - 150, 42, { width: 150, align: 'center', lineBreak: false });

let y = 96;
function section(title) {
  doc.fillColor(green).font('Helvetica-Bold').fontSize(9).text(title.toUpperCase(), M, y, { lineBreak: false });
  y += 12;
  doc.moveTo(M, y).lineTo(M + W, y).lineWidth(0.8).strokeColor(line).stroke();
  y += 5;
}
function chip(state, x, top) {
  const [chipBg, chipFg] = palette[label(state)];
  doc.roundedRect(x, top, 52, 13, 6).fill(chipBg);
  doc.fillColor(chipFg).font('Helvetica-Bold').fontSize(7).text(label(state), x, top + 3.5, { width: 52, align: 'center', lineBreak: false });
}
function grid(items) { // 2 colunas de "rótulo: valor"
  const colW = W / 2;
  for (let i = 0; i < items.length; i += 2) {
    const pair = items.slice(i, i + 2);
    const heights = pair.map(([, v]) => doc.font('Helvetica').fontSize(8.5).heightOfString(v, { width: colW - 12 }));
    const rowH = Math.max(...heights) + 13;
    pair.forEach(([k, v], j) => {
      const x = M + j * colW;
      doc.fillColor(muted).font('Helvetica-Bold').fontSize(6.8).text(k.toUpperCase(), x, y, { width: colW - 12, lineBreak: false });
      doc.fillColor(v.startsWith('PENDENTE') || v.startsWith('PREENCHER') ? '#87530e' : dark).font('Helvetica').fontSize(8.5).text(v, x, y + 9, { width: colW - 12 });
    });
    y += rowH + 2;
  }
}
function paragraph(text, size = 8.5) {
  doc.fillColor(dark).font('Helvetica').fontSize(size).text(text, M, y, { width: W, lineGap: 1.5 });
  y += doc.heightOfString(text, { width: W, lineGap: 1.5 }) + 3;
}

section('1. Identificação');
grid([
  ['Sistema', 'EstuLanches'],
  ['Versão implantada', pkg.version],
  ['Ambiente', config.ambiente],
  ['Tipo de mudança', config.tipoMudanca],
  ['Data e horário da implantação', deployedAt || 'PENDENTE (preencher após: docker compose up -d --build e npm run validar)'],
  ['Responsável', `${config.responsavel.cargo} · ${config.responsavel.nome}`]
]);

y += 3; section('2. Descrição da mudança');
paragraph(config.descricao);

y += 3; section('3. Parâmetros e configurações alteradas');
{
  const cols = [150, 170, W - 320];
  const rowH = 13.5;
  doc.rect(M, y, W, rowH).fill(green);
  ['Parâmetro', 'Antes', 'Depois'].forEach((h, i) => doc.fillColor('white').font('Helvetica-Bold').fontSize(7.5).text(h, M + 6 + cols.slice(0, i).reduce((a, b) => a + b, 0), y + 3.5, { width: cols[i] - 8, lineBreak: false }));
  y += rowH;
  config.mudancas.forEach((row, index) => {
    doc.rect(M, y, W, rowH).fill(index % 2 ? '#ffffff' : pale);
    row.forEach((cell, i) => doc.fillColor(i === 0 ? dark : muted).font(i === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5)
      .text(cell, M + 6 + cols.slice(0, i).reduce((a, b) => a + b, 0), y + 3.5, { width: cols[i] - 8, lineBreak: false, ellipsis: true }));
    y += rowH;
  });
  y += 3;
  paragraph('Mantidos: portas 3000 (app, única publicada) e 5432 (banco, somente rede interna), volume postgres_data, healthchecks, limites de CPU/memória e variáveis em .env.', 7.8);
}

y += 2; section('4. Tecnologias utilizadas');
paragraph(tech);

y += 3; section('5. Resultado dos testes de validação e da verificação dos containers');
{
  const items = [
    ['Testes unitários', states.unit, unitStats ? `${unitStats.passed} de ${unitStats.total} aprovados · ${unitStats.failed} falhas` : 'rode: npm run test:unit'],
    ['Testes de integração (API + PostgreSQL)', states.integration, integrationStats ? `${integrationStats.passed} de ${integrationStats.total} aprovados · ${integrationStats.failed} falhas` : 'rode: npm run test:integration'],
    ['Containers (docker compose ps)', states.containers, environment ? 'app e db com status (healthy)' : 'rode: npm run validar'],
    ['Portas expostas', states.ports, environment?.ports?.app ? `app ${environment.ports.app} · banco sem porta publicada` : 'rode: npm run validar'],
    ['Acesso da aplicação ao banco', states.database && states.health, environment?.database?.tables !== undefined ? `/health: ${environment.health?.ok ? 'connected' : 'falha'} · ${environment.database.tables} tabelas · ${environment.database.products} produtos` : 'rode: npm run validar'],
    ['Logs (docker compose logs)', states.logs, environment ? `${environment.logCriticalErrors ?? 0} erros críticos encontrados` : 'rode: npm run validar'],
    ['Persistência após recriar containers', states.persistence, persistence ? persistence.steps?.slice(-1)[0] || persistence.error || '' : 'rode: npm run persistencia']
  ];
  const rowH = 15;
  items.forEach(([name, state, detail], index) => {
    const normalized = state === undefined ? null : state;
    doc.rect(M, y, W, rowH).fill(index % 2 ? '#ffffff' : pale);
    doc.fillColor(dark).font('Helvetica-Bold').fontSize(7.8).text(name, M + 6, y + 4, { width: 168, lineBreak: false, ellipsis: true });
    chip(normalized, M + 178, y + 1.2);
    doc.fillColor(muted).font('Helvetica').fontSize(7.6).text(detail, M + 238, y + 4, { width: W - 242, lineBreak: false, ellipsis: true });
    y += rowH;
  });
}

y += 6;
const obs = [config.observacoes, environment ? '' : 'Verificação dos containers ainda não executada: itens PENDENTES devem ser preenchidos após rodar npm run rdm com o Docker ativo.'].filter(Boolean).join(' ');
if (obs) {
  const h = doc.font('Helvetica').fontSize(7.8).heightOfString(obs, { width: W - 20 }) + 14;
  doc.roundedRect(M, y, W, h, 6).fill('#fff8e8');
  doc.fillColor('#87530e').font('Helvetica-Bold').fontSize(7.8).text('Observações: ', M + 10, y + 7, { continued: true, width: W - 20 }).font('Helvetica').text(obs);
  y += h + 12;
}

section('6. Status final e plano de retorno (rollback)');
{
  const [sbg, sfg] = palette[statusLabel];
  doc.roundedRect(M, y, W, 26, 6).fill(sbg);
  const finalText = status === 'SUCESSO' ? 'IMPLANTAÇÃO CONCLUÍDA COM SUCESSO: todos os testes e verificações foram aprovados.'
    : status === 'FALHA' ? 'IMPLANTAÇÃO COM FALHA: há itens reprovados. Corrigir e repetir a validação.'
      : 'IMPLANTAÇÃO PENDENTE DE VERIFICAÇÃO: há itens sem resultado registrado (veja os campos PENDENTE).';
  doc.fillColor(sfg).font('Helvetica-Bold').fontSize(9).text(finalText, M + 10, y + 8.5, { width: W - 20, lineBreak: false, ellipsis: true });
  y += 32;
  paragraph('Rollback: docker compose down (mantém o volume com os dados), voltar ao commit anterior aprovado (git checkout <commit>) e subir novamente com docker compose up -d --build.', 7.8);
  y += 8;
  doc.moveTo(M, y + 12).lineTo(M + 230, y + 12).lineWidth(0.6).strokeColor(muted).stroke();
  doc.fillColor(muted).font('Helvetica').fontSize(7).text('Assinatura do responsável', M, y + 15, { lineBreak: false });
  doc.moveTo(M + W - 150, y + 12).lineTo(M + W, y + 12).stroke();
  doc.text('Data', M + W - 150, y + 15, { lineBreak: false });
}
doc.end();
process.on('exit', () => { if (pages > 1) { console.error(`ATENÇÃO: a ficha ficou com ${pages} páginas.`); process.exitCode = 1; } });
console.log(`PDF gerado: rdm/RDM-EstuLanches.pdf · status ${status}`);
