import { createApp } from './app.js';
import { pool, closePool } from './db.js';
import { runMigrations } from './db/migrate.js';

const previewOnly = process.env.APP_PREVIEW_ONLY === 'true';
const port = Number.parseInt(process.env.PORT || '3000', 10);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('PORT must be a valid TCP port.');
}

if (!pool && !previewOnly) {
  throw new Error('DATABASE_URL is required. Set APP_PREVIEW_ONLY=true only for a static preview.');
}

if (pool) {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 characters.');
  }
  await runMigrations(pool);
}

const app = createApp({ database: pool });
const server = app.listen(port, '0.0.0.0', () => {
  console.log('[nexora] Server listening on port ' + port);
  if (!pool) console.warn('[nexora] Preview mode: database-backed features are disabled.');
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('[nexora] Received ' + signal + ', shutting down.');
  server.close(async error => {
    if (error) console.error('[nexora] HTTP shutdown error:', error.message);
    try {
      await closePool();
      process.exit(error ? 1 : 0);
    } catch (closeError) {
      console.error('[nexora] Database shutdown error:', closeError.message);
      process.exit(1);
    }
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
