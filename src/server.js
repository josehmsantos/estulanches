require('dotenv').config();
const app = require('./app');
const logger = require('./logger');
const { pool } = require('./db');
const { ensureSchema } = require('./bootstrap');

const port = Number(process.env.PORT || 3000);
let server;
async function start() {
  await ensureSchema(pool);
  server = app.listen(port, () => logger.info({ port }, 'EstuLanches iniciado'));
}
start().catch((error) => { logger.error({ err: error }, 'Falha ao iniciar (banco indisponível?)'); process.exit(1); });
async function shutdown(signal) {
  logger.info({ signal }, 'Encerrando aplicação');
  (server ? server.close.bind(server) : (cb) => cb())(async () => { await pool.end(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
