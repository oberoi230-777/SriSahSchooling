import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEmail, randomToken, sha256, hashPassword, verifyPassword, validatePassword } from '../server/security.js';

test('normalizes email addresses and hashes opaque tokens', () => {
  assert.equal(normalizeEmail('  STUDENT@Example.COM  '), 'student@example.com');
  const token = randomToken();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(sha256(token).length, 64);
  assert.notEqual(sha256(token), token);
});

test('enforces the account password policy', () => {
  assert.equal(validatePassword('Short123!'), 'Use a password between 12 and 200 characters.');
  assert.match(validatePassword('lowercasepassword'), /uppercase letter and number/);
  assert.match(validatePassword('UPPERCASE12345'), /lowercase letter/);
  assert.equal(validatePassword('LearningPortal123'), null);
  assert.match(validatePassword('a'.repeat(201)), /between 12 and 200/);
});

test('stores scrypt hashes and verifies only the matching password', async () => {
  const encoded = await hashPassword('LearningPortal123');
  assert.match(encoded, /^scrypt\$16384\$8\$1\$/);
  assert.equal(await verifyPassword('LearningPortal123', encoded), true);
  assert.equal(await verifyPassword('DifferentPassword123', encoded), false);
  assert.equal(await verifyPassword('LearningPortal123', 'not-a-hash'), false);
});
