'use strict';
const express = require('express');
const router = express.Router();
const { authenticate, startSession, readSession, endSession } = require('../security/authService');

// No se publican cuentas ni contraseñas. Los usuarios se crean con scripts/create-user.js.
router.post('/login', (req, res) => {
  const { username, password, institutionId } = req.body || {};
  const result = authenticate(req, username, password, institutionId);
  if (result.error) return res.status(result.status).json({ success: false, error: result.error });
  startSession(req, res, result.user);
  return res.json({ success: true, message: 'Acceso autorizado.', user: result.user });
});
router.get('/me', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const session = readSession(req);
  if (!session) return res.status(401).json({ success: false, error: 'Sesión no iniciada.' });
  const { expiresAt, ...user } = session;
  return res.json({ success: true, user });
});
router.post('/logout', (req, res) => {
  endSession(req, res);
  return res.json({ success: true });
});
module.exports = router;
