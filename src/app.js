const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const pinoHttp = require('pino-http');
const logger = require('./logger');
const { pool } = require('./db');
const { AppError } = require('./errors');

const app = express();
// CSP permite apenas os arquivos locais e estilos inline simples usados pela interface.
app.use(helmet({ contentSecurityPolicy: { directives: {
  defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"], objectSrc: ["'none'"], upgradeInsecureRequests: null
} } }));
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use(express.json({ limit: '32kb' }));
app.use(pinoHttp({ logger }));

app.get('/health', async (_req, res, next) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', database: 'connected' }); }
  catch (error) { next(new AppError(503, 'Banco de dados indisponível.')); }
});
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use((req, _res, next) => next(new AppError(404, `Rota não encontrada: ${req.method} ${req.path}`)));
app.use((error, req, res, _next) => {
  const status = error.status || 500;
  // Erros do cliente (4xx) são esperados: registrados como aviso, sem poluir o nível de erro.
  req.log[status >= 500 ? 'error' : 'warn']({ err: status >= 500 ? error : { message: error.message }, status }, 'Falha na requisição');
  res.status(status).json({ error: status >= 500 && process.env.NODE_ENV === 'production' ? 'Erro interno do servidor.' : error.message });
});

module.exports = app;
