// Applies schema.sql + numbered migrations in order. Everything is idempotent
// (IF NOT EXISTS / ON CONFLICT), so re-running is safe.
// From the host against dockerized Postgres: DB_HOST=localhost npm run migrate
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const fs = require('fs');
const { Pool } = require('pg');

async function migrate() {
  const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME
  });

  const migrations = fs
    .readdirSync(__dirname)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort();

  try {
    for (const file of ['schema.sql', ...migrations]) {
      const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
      await pool.query(sql);
      console.log(`applied ${file}`);
    }
    console.log('migrations complete');
  } finally {
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('migration failed:', err.message);
  process.exit(1);
});
