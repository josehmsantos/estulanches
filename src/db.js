const { Pool } = require('pg');
const logger = require('./logger');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.on('error', (error) => logger.error({ err: error }, 'Erro inesperado no pool PostgreSQL'));

module.exports = { pool };
