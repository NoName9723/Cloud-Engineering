import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, closePool } from '../db.js';

const directory = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations(database = pool) {
  if (!database) throw new Error('DATABASE_URL must be configured before running migrations.');

  await database.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (' +
    'name VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())'
  );

  const migrationName = '001_initial.sql';
  const migrationSql = await fs.readFile(
    path.join(directory, 'migrations', migrationName),
    'utf8'
  );

  const client = await database.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(483921)');
    const existing = await client.query(
      'SELECT name FROM schema_migrations WHERE name = $1',
      [migrationName]
    );

    if (!existing.rowCount) {
      await client.query(migrationSql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [migrationName]);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

if (import.meta.url === 'file://' + process.argv[1]) {
  runMigrations()
    .then(() => console.log('[database] Migrations completed.'))
    .catch(error => {
      console.error('[database] Migration failed:', error.message);
      process.exitCode = 1;
    })
    .finally(closePool);
}
