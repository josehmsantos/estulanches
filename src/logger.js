const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'estulanches' },
  redact: ['req.headers.authorization', 'password', 'DATABASE_URL']
});

module.exports = logger;
