import pg from 'pg';

const { Pool } = pg;

export const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'true' ? true : undefined,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 10_000
    })
  : null;

if (pool) {
  pool.on('error', error => {
    console.error('[database] Unexpected idle client error:', error.message);
  });
}

export async function closePool() {
  if (pool) await pool.end();
}
