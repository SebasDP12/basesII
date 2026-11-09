'use strict';
const express = require('express');
const router = express.Router();
const connections = require('../../database/connectionManager');
const security = require('../security/authService');

const ALLOWED_ROLES = {
  hospital: ['medico', 'recepcion', 'admin'],
  odontologia: ['odontologo', 'recepcion', 'admin'],
  laboratorio: ['laboratorista', 'recepcion', 'admin'],
  pediatria: ['pediatra', 'enfermeria', 'recepcion', 'admin']
};
const PROFESSIONAL_ROLES = new Set(['medico', 'odontologo', 'laboratorista', 'pediatra', 'admin']);
const requireAdmin = [security.requireSession, security.requireRole('admin')];

router.get('/setup-status', (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, required: !security.hasAdministrator() });
  } catch {
    res.status(503).json({ success: false, error: 'Configuración no disponible.' });
  }
});

router.post('/setup', (req, res) => {
  try {
    if (!security.hasAdministrator()) {
      const user = security.initialAdministrator(req.body || {});
      return res.status(201).json({ success: true, user });
    }
    return res.status(403).json({ success: false, error: 'La configuración inicial está cerrada.' });
  } catch (err) {
    res.status(err.status || 400).json({ success: false, error: err.message });
  }
});

router.get('/users', requireAdmin, (req, res) => {
  try { res.json({ success: true, data: security.publicUsers() }); }
  catch { res.status(503).json({ success: false, error: 'No se pudieron cargar las cuentas.' }); }
});

router.patch('/users/:username', requireAdmin, (req, res) => {
  try {
    const data = security.setAccountEnabled(req.params.username, req.body?.active);
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.status || 400).json({ success: false, error: err.message });
  }
});

// Inscripción conjunta: cuenta con hash y ficha profesional en su motor institucional.
// El profesional no puede gestionar cuentas ni pasar de su institución.
router.post('/users', requireAdmin, async (req, res) => {
  const { username, nombre, apellido, password, rol, institutionId, especialidad, numeroColegiado, telefono } = req.body || {};
  if (!ALLOWED_ROLES[institutionId]?.includes(rol)) {
    return res.status(400).json({ success: false, error: 'El rol no corresponde a esta institución.' });
  }
  const name = String(nombre || '').trim();
  const surname = String(apellido || '').trim();
  const fullName = [name, surname].filter(Boolean).join(' ');
  const colegiado = String(numeroColegiado || '').trim();
  const specialty = String(especialidad || '').trim();
  if (name.length < 2 || surname.length < 2 || name.length > 80 || surname.length > 80 ||
      (PROFESSIONAL_ROLES.has(rol) && (!colegiado || !specialty || colegiado.length > 30 || specialty.length > 100))) {
    return res.status(400).json({ success: false, error: 'Complete los datos profesionales y el número de colegiado.' });
  }
  // Validar ANTES de agregar una ficha a una base de datos para minimizar registros parciales.
  const cleanUsername = String(username || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,80}$/.test(cleanUsername) || typeof password !== 'string' ||
      password.length < 12 || password.length > 256) {
    return res.status(400).json({ success: false, error: 'Nombre de usuario o contraseña inválidos.' });
  }
  if (security.publicUsers().some(u => u.username === cleanUsername)) {
    return res.status(409).json({ success: false, error: 'El usuario ya está registrado.' });
  }

  try {
    if (PROFESSIONAL_ROLES.has(rol)) {
      if (institutionId === 'hospital') {
        await connections.getPostgresPool().query(
          `INSERT INTO medico (nombre, apellido, especialidad, numero_colegiado, telefono)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (numero_colegiado) DO NOTHING`,
          [name, surname, specialty, colegiado, String(telefono || '').slice(0, 20)]
        );
      } else if (institutionId === 'odontologia') {
        await connections.getMySQLPool().execute(
          `INSERT IGNORE INTO odontologo (nombre, apellido, especialidad, numero_colegiado, telefono)
           VALUES (?, ?, ?, ?, ?)`,
          [name, surname, specialty, colegiado, String(telefono || '').slice(0, 20)]
        );
      } else if (institutionId === 'laboratorio') {
        const db = await connections.getMongoDatabase();
        await db.collection('profesionales').updateOne(
          { numero_colegiado: colegiado },
          { $setOnInsert: { id_profesional: colegiado, nombre: name, apellido: surname,
            especialidad: specialty, numero_colegiado: colegiado, telefono: String(telefono || '') } },
          { upsert: true }
        );
      } else if (institutionId === 'pediatria') {
        const db = await connections.getFirestore();
        if (!db) throw new Error('Firestore no disponible.');
        const doc = db.collection('profesionales').doc(colegiado.replace(/[^a-zA-Z0-9_-]/g, '_'));
        const current = await doc.get();
        if (!current.exists) await doc.create({
          nombre: name, apellido: surname, especialidad: specialty,
          numero_colegiado: colegiado, telefono: String(telefono || '')
        });
      }
    }
    const user = security.createAccount({
      username: cleanUsername, nombre: fullName, password, rol, institutionId
    });
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    console.error('[Admin] Registro incompleto:', err.message);
    res.status(err.status || 503).json({
      success: false,
      error: 'No se completó el registro. Compruebe la conexión y si el profesional ya existe antes de reintentar.'
    });
  }
});

module.exports = router;
