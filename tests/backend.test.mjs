import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../server/security.js';
import {
  normalizeEmail,
  validateContactPayload,
  validateLoginPayload,
  validateRegistrationPayload
} from '../server/validation.js';

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
  assert.match(encoded, /^scrypt\\$/);
  assert.equal(await verifyPassword(password, encoded), true);
  assert.equal(await verifyPassword('a-different-password', encoded), false);
  assert.equal(await verifyPassword(password, 'invalid-hash'), false);
});
