import path from 'node:path';
import { randomUUID } from 'node:crypto';
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import helmet from 'helmet';
import { pool as defaultPool } from './db.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { createContactRouter } from './routes/contact.routes.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

const ROOT = process.cwd();
const SESSION_LIFETIME = 7 * 24 * 60 * 60 * 1000;
const PRIVATE_PATH_PREFIXES = [
  '/server',
  '/tests',
  '/node_modules',
  '/.github',
  '/.git',
  '/coverage',
  '/playwright-report',
  '/test-results'
];
const PRIVATE_ROOT_FILES = new Set([
  '/package.json',
  '/package-lock.json',
  '/playwright.config.js',
  '/README.md',
  '/.env.example',
  '/.nvmrc',
  '/.gitignore'
]);

function protectInternalFiles(req, res, next) {
  let requestedPath;
  try {
    const decodedPath = decodeURIComponent(req.path);
    requestedPath = path.posix.normalize(
      decodedPath.startsWith('/') ? decodedPath : '/' + decodedPath
    );
  } catch {
    return res.status(400).end();
  }

  const privatePrefix = PRIVATE_PATH_PREFIXES.some(prefix =>
    requestedPath === prefix || requestedPath.startsWith(prefix + '/')
  );

  if (privatePrefix || PRIVATE_ROOT_FILES.has(requestedPath)) {
    return res.status(404).sendFile('404.html', { root: ROOT });
  }

  return next();
}

export function createApp({ database = defaultPool } = {}) {
  const app = express();
  const isProduction = process.env.NODE_ENV === 'production';
  const trustProxy = process.env.TRUST_PROXY === 'true';

  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy ? 1 : false);

  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.setHeader('X-Request-ID', req.requestId);
    next();
  });

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"]
      }
    }
  }));

  app.use(express.json({ limit: '16kb', strict: true }));
  app.use(express.urlencoded({ extended: false, limit: '16kb' }));

  app.get('/api/health/live', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/health/ready', async (_req, res) => {
    if (!database) {
      return res.status(503).json({
        status: 'not_ready',
        error: { code: 'DATABASE_UNAVAILABLE', message: 'La base de données n’est pas configurée.' }
      });
    }

    await database.query('SELECT 1');
    return res.json({ status: 'ready' });
  });

  if (database) {
    const sessionSecret = process.env.SESSION_SECRET;
    if (!sessionSecret || sessionSecret.length < 32) {
      throw new Error('SESSION_SECRET must contain at least 32 characters.');
    }

    const PgSessionStore = connectPgSimple(session);
    const sessionMiddleware = session({
      name: 'nexora.sid',
      secret: sessionSecret,
      store: new PgSessionStore({
        pool: database,
        tableName: 'nexora_sessions',
        createTableIfMissing: true,
        pruneSessionInterval: 15
      }),
      resave: false,
      saveUninitialized: false,
      rolling: true,
      proxy: trustProxy,
      cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: SESSION_LIFETIME,
        path: '/'
      }
    });

    app.use('/api/auth', sessionMiddleware, createAuthRouter(database));
    app.use('/api/contact', sessionMiddleware, createContactRouter(database));
  } else {
    const unavailable = (_req, res) => res.status(503).json({
      error: {
        code: 'BACKEND_NOT_CONFIGURED',
        message: 'Le serveur applicatif ou la base de données n’est pas configuré sur cette instance.'
      }
    });
    app.use('/api/auth', unavailable);
    app.use('/api/contact', unavailable);
  }

  app.use('/api', (_req, res) => {
    res.status(404).json({
      error: { code: 'ROUTE_NOT_FOUND', message: 'Cette ressource n’existe pas.' }
    });
  });

  // The repository root also contains server code, tests and installed packages.
  // Never expose those paths through the public static file handler.
  app.use(protectInternalFiles);

  app.use(express.static(ROOT, {
    index: 'index.html',
    dotfiles: 'ignore',
    etag: true,
    lastModified: true,
    maxAge: isProduction ? '1 hour' : 0
  }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
