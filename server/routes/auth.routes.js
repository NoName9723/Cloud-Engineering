import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createCsrfToken, requireCsrf } from '../middleware/csrf.js';
import { hashPassword, verifyPassword } from '../security.js';
import { validateLoginPayload, validateRegistrationPayload } from '../validation.js';

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate(error => error ? reject(error) : resolve());
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save(error => error ? reject(error) : resolve());
  });
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.created_at
  };
}

const authenticationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler(_req, res) {
    res.status(429).json({
      error: {
        code: 'AUTH_RATE_LIMITED',
        message: 'Trop de tentatives. Réessayez dans quelques minutes.'
      }
    });
  }
});

export function createAuthRouter(pool) {
  const router = Router();

  router.get('/csrf', (req, res) => {
    if (!req.session.csrfToken) req.session.csrfToken = createCsrfToken();
    res.set('Cache-Control', 'no-store');
    res.json({ csrfToken: req.session.csrfToken });
  });

  router.get('/me', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({
        error: { code: 'NOT_AUTHENTICATED', message: 'Aucune session active.' }
      });
    }

    const result = await pool.query(
      'SELECT id, name, email, created_at FROM users WHERE id = $1 LIMIT 1',
      [req.session.userId]
    );

    if (!result.rowCount) {
      req.session.destroy(() => {});
      return res.status(401).json({
        error: { code: 'NOT_AUTHENTICATED', message: 'La session n’est plus valide.' }
      });
    }

    return res.json({ user: publicUser(result.rows[0]) });
  });

  router.post('/register', authenticationLimiter, requireCsrf, async (req, res) => {
    const validation = validateRegistrationPayload(req.body);
    if (!validation.ok) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: validation.message }
      });
    }

    const { name, email, password } = validation.value;
    const passwordHash = await hashPassword(password);
    const inserted = await pool.query(
      'INSERT INTO users (name, email, password_hash) ' +
      'VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING ' +
      'RETURNING id, name, email, created_at',
      [name, email, passwordHash]
    );

    if (!inserted.rowCount) {
      return res.status(409).json({
        error: { code: 'ACCOUNT_EXISTS', message: 'Un compte utilise déjà cette adresse e-mail.' }
      });
    }

    await regenerateSession(req);
    req.session.userId = inserted.rows[0].id;
    req.session.csrfToken = createCsrfToken();
    await saveSession(req);

    return res.status(201).json({
      user: publicUser(inserted.rows[0]),
      csrfToken: req.session.csrfToken
    });
  });

  router.post('/login', authenticationLimiter, requireCsrf, async (req, res) => {
    const validation = validateLoginPayload(req.body);
    if (!validation.ok) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: validation.message }
      });
    }

    const { email, password } = validation.value;
    const result = await pool.query(
      'SELECT id, name, email, password_hash, created_at FROM users WHERE email = $1 LIMIT 1',
      [email]
    );

    const user = result.rows[0];
    const validPassword = user ? await verifyPassword(password, user.password_hash) : false;

    if (!validPassword) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Adresse e-mail ou mot de passe incorrect.' }
      });
    }

    await regenerateSession(req);
    req.session.userId = user.id;
    req.session.csrfToken = createCsrfToken();
    await saveSession(req);

    return res.json({
      user: publicUser(user),
      csrfToken: req.session.csrfToken
    });
  });

  router.post('/logout', requireCsrf, async (req, res) => {
    await new Promise((resolve, reject) => {
      req.session.destroy(error => error ? reject(error) : resolve());
    });

    res.clearCookie('nexora.sid', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    return res.status(204).end();
  });

  return router;
}
