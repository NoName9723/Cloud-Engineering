const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CONTACT_SUBJECTS = new Set([
  'Architecture cloud',
  'Platform Engineering',
  'Automatisation & CI/CD',
  'Sécurité & fiabilité',
  'Autre demande'
]);

export function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null;
}

export function validateRegistrationPayload(body = {}) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';

  if (name.length < 2 || name.length > 80) {
    return { ok: false, message: 'Le nom doit contenir entre 2 et 80 caractères.' };
  }
  if (!email) return { ok: false, message: 'Adresse e-mail invalide.' };
  if (password.length < 12 || password.length > 128) {
    return { ok: false, message: 'Le mot de passe doit contenir entre 12 et 128 caractères.' };
  }
  return { ok: true, value: { name, email, password } };
}

export function validateLoginPayload(body = {}) {
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || password.length < 1 || password.length > 128) {
    return { ok: false, message: 'Adresse e-mail ou mot de passe invalide.' };
  }
  return { ok: true, value: { email, password } };
}

export function validateContactPayload(body = {}) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = normalizeEmail(body.email);
  const organization = typeof body.organization === 'string' ? body.organization.trim() : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (name.length < 2 || name.length > 100) {
    return { ok: false, message: 'Le nom doit contenir entre 2 et 100 caractères.' };
  }
  if (!email) return { ok: false, message: 'Adresse e-mail invalide.' };
  if (organization.length > 120) {
    return { ok: false, message: 'Le nom de l’organisation est trop long.' };
  }
  if (!CONTACT_SUBJECTS.has(subject)) {
    return { ok: false, message: 'Le sujet sélectionné est invalide.' };
  }
  if (message.length < 20 || message.length > 2500) {
    return { ok: false, message: 'Le message doit contenir entre 20 et 2 500 caractères.' };
  }
  return {
    ok: true,
    value: { name, email, organization: organization || null, subject, message }
  };
}
