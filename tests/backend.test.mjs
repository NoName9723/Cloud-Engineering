import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { hashPassword, verifyPassword } from '../server/security.js';
import {
  normalizeEmail,
  validateContactPayload,
  validateLoginPayload,
  validateRegistrationPayload
} from '../server/validation.js';
import { createApp } from '../server/app.js';

test('email normalization validates and standardizes addresses', () => {
  assert.equal(normalizeEmail('  PERSON@EXAMPLE.COM  '), 'person@example.com');
  assert.equal(normalizeEmail('not-an-email'), null);
  assert.equal(normalizeEmail(''), null);
});

test('registration validation rejects weak or malformed input', () => {
  assert.equal(validateRegistrationPayload({
    name: 'A', email: 'person@example.com', password: 'short'
  }).ok, false);

  const valid = validateRegistrationPayload({
    name: 'Alex Martin',
    email: 'ALEX@EXAMPLE.COM',
    password: 'A-long-password-2026'
  });

  assert.equal(valid.ok, true);
  assert.equal(valid.value.email, 'alex@example.com');
});

test('login validation rejects malformed credentials', () => {
  assert.equal(validateLoginPayload({ email: 'bad', password: 'x' }).ok, false);
  assert.equal(validateLoginPayload({
    email: 'person@example.com',
    password: 'a-valid-password'
  }).ok, true);
});

test('contact validation enforces the allowed form fields', () => {
  const result = validateContactPayload({
    name: 'Alex Martin',
    email: 'alex@example.com',
    organization: 'NEXORA Demo',
    subject: 'Architecture cloud',
    message: 'Je souhaite présenter un besoin technique détaillé.'
  });

  assert.equal(result.ok, true);
  assert.equal(validateContactPayload({ ...result.value, subject: 'Autre sujet' }).ok, false);
});

test('passwords are salted, hashed and verified without storing the clear text', async () => {
  const password = 'A-long-password-2026';
  const encoded = await hashPassword(password);

  assert.notEqual(encoded, password);
  assert.ok(encoded.startsWith('scrypt$'));
  assert.equal(await verifyPassword(password, encoded), true);
  assert.equal(await verifyPassword('a-different-password', encoded), false);
  assert.equal(await verifyPassword(password, 'invalid-hash'), false);
});

test('API health and unavailable database responses are explicit', async () => {
  const app = createApp({ database: null });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  try {
    const address = server.address();
    const baseUrl = 'http://127.0.0.1:' + address.port;

    const live = await fetch(baseUrl + '/api/health/live');
    assert.equal(live.status, 200);
    assert.ok(live.headers.get('x-request-id'));

    const ready = await fetch(baseUrl + '/api/health/ready');
    assert.equal(ready.status, 503);
    assert.equal((await ready.json()).status, 'not_ready');

    const auth = await fetch(baseUrl + '/api/auth/csrf');
    assert.equal(auth.status, 503);
    assert.equal((await auth.json()).error.code, 'BACKEND_NOT_CONFIGURED');

    const missing = await fetch(baseUrl + '/api/not-a-route');
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error.code, 'ROUTE_NOT_FOUND');

    for (const internalPath of [
      '/server/app.js',
      '/server%2Fapp.js',
      '/%2e%2e/server/app.js',
      '/server/db/migrations/001_initial.sql',
      '/tests/backend.test.mjs',
      '/node_modules/express/package.json',
      '/package.json',
      '/package-lock.json',
      '/playwright.config.js',
      '/README.md'
    ]) {
      const response = await fetch(baseUrl + internalPath);
      assert.equal(response.status, 404, 'Internal path must not be public: ' + internalPath);
    }
  } finally {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
});
