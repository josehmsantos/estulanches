const fs = require('node:fs');
const path = require('node:path');

// Garante tabelas e cardápio inicial (6 produtos) usando o mesmo init.sql do Compose.
// É idempotente: em um banco já preenchido não altera nada. Assim o sistema funciona mesmo
// que o volume do banco tenha sido criado antes (quando o init.sql do PostgreSQL não roda mais).
async function ensureSchema(pool) {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'init.sql'), 'utf8');
  await pool.query(sql);
}

module.exports = { ensureSchema };
