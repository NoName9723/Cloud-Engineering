import { randomBytes, timingSafeEqual } from 'node:crypto';

export function createCsrfToken() {
  return randomBytes(32).toString('base64url');
}

export function requireCsrf(req, res, next) {
  const expected = req.session?.csrfToken;
  const supplied = req.get('x-csrf-token');

  if (typeof expected !== 'string' || typeof supplied !== 'string') {
    return res.status(403).json({
      error: {
        code: 'CSRF_TOKEN_INVALID',
        message: 'La session a expiré. Actualisez la page puis réessayez.'
      }
    });
  }

  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  const valid = expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer);

  if (!valid) {
    return res.status(403).json({
      error: {
        code: 'CSRF_TOKEN_INVALID',
        message: 'La vérification de sécurité a échoué. Actualisez la page puis réessayez.'
      }
    });
  }
  return next();
}
