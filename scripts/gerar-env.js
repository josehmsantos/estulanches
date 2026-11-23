// Cria o arquivo .env a partir do .env.example com uma senha aleatória (não sobrescreve um .env existente).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const target = path.join(root, '.env');
if (fs.existsSync(target)) { console.log('.env já existe: nada foi alterado.'); process.exit(0); }
const example = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
fs.writeFileSync(target, example.replace('TROQUE_ESTA_SENHA', crypto.randomBytes(16).toString('hex')), { mode: 0o600 });
console.log('.env criado com senha aleatória. Não o envie ao GitHub.');
