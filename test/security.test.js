'use strict';
const assert = require('node:assert/strict');
const { hashPassword, VALID_INSTITUTIONS } = require('../src/infrastructure/http/security/authService');
const crypto = require('node:crypto');
const hash = hashPassword('contraseña-de-prueba-larga');
assert.ok(hash.startsWith('scrypt$'));
assert.ok(!hash.includes('contraseña-de-prueba-larga'));
const parts = hash.split('$');
assert.equal(parts.length, 3);
assert.equal(
  crypto.timingSafeEqual(
    crypto.scryptSync('contraseña-de-prueba-larga', Buffer.from(parts[1], 'hex'), 64),
    Buffer.from(parts[2], 'hex')
  ), true
);
assert.ok(VALID_INSTITUTIONS.has('hospital'));
assert.equal(VALID_INSTITUTIONS.has('otra'), false);
console.log('OK: hash scrypt y validación de instituciones.');
