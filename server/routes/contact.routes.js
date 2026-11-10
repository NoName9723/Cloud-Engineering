import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireCsrf } from '../middleware/csrf.js';
import { validateContactPayload } from '../validation.js';

const contactLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler(_req, res) {
    res.status(429).json({
      error: {
        code: 'CONTACT_RATE_LIMITED',
        message: 'Trop de demandes ont été envoyées. Réessayez plus tard.'
      }
    });
  }
});

export function createContactRouter(pool) {
  const router = Router();

  router.post('/', contactLimiter, requireCsrf, async (req, res) => {
    const validation = validateContactPayload(req.body);
    if (!validation.ok) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: validation.message }
      });
    }

    const { name, email, organization, subject, message } = validation.value;
    const userId = req.session.userId || null;

    const result = await pool.query(
      'INSERT INTO contact_messages ' +
      '(user_id, name, email, organization, subject, message) ' +
      'VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at',
      [userId, name, email, organization, subject, message]
    );

    return res.status(201).json({
      message: 'Votre demande a bien été enregistrée.',
      reference: result.rows[0].id,
      createdAt: result.rows[0].created_at
    });
  });

  return router;
}
