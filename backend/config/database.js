const { Pool } = require('pg');
const logger = require('./logger');

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
});

module.exports = pool;
