import { randomUUID } from 'node:crypto';

export function notFoundHandler(req, res) {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      error: { code: 'ROUTE_NOT_FOUND', message: 'Cette ressource n’existe pas.' }
    });
  }
  return res.status(404).sendFile('404.html', { root: process.cwd() });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const requestId = req.requestId || randomUUID();
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status <= 599
    ? error.status
    : 500;

  if (status >= 500) {
    console.error('[server-error]', { requestId, message: error.message });
  }

  const message = status >= 500
    ? 'Une erreur interne est survenue. Réessayez plus tard.'
    : error.message || 'La requête n’a pas pu être traitée.';

  return res.status(status).json({
    error: {
      code: status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR',
      message,
      requestId
    }
  });
}
