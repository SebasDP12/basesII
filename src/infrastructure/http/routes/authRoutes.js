const express = require('express');
const router = express.Router();
const { INSTITUTIONS } = require('../../../domain/models/Consultation');

// Usuarios preconfigurados para demostración de enrutamiento por usuario
const DEMO_USERS = [
  {
    username: 'carlos.ramirez',
    nombre: 'Dr. Carlos Ramírez',
    rol: 'Médico Internista',
    institutionId: 'hospital',
    institucion: INSTITUTIONS.hospital.name,
    motor: INSTITUTIONS.hospital.engine
  },
  {
    username: 'sofia.mendoza',
    nombre: 'Dra. Sofía Mendoza (y Secretaria)',
    rol: 'Odontóloga / Recepción',
    institutionId: 'odontologia',
    institucion: INSTITUTIONS.odontologia.name,
    motor: INSTITUTIONS.odontologia.engine
  },
  {
    username: 'marco.pena',
    nombre: 'Lic. Marco Tulio Peña',
    rol: 'Químico Biólogo / Bacteriólogo',
    institutionId: 'laboratorio',
    institucion: INSTITUTIONS.laboratorio.name,
    motor: INSTITUTIONS.laboratorio.engine
  },
  {
    username: 'elena.castillo',
    nombre: 'Dra. Elena Castillo',
    rol: 'Médico Pediatra',
    institutionId: 'pediatria',
    institucion: INSTITUTIONS.pediatria.name,
    motor: INSTITUTIONS.pediatria.engine
  }
];

// Listar usuarios disponibles
router.get('/users', (req, res) => {
  res.json({ success: true, users: DEMO_USERS });
});

// Autenticación / Simulación de Login con enrutamiento automático de motor
router.post('/login', (req, res) => {
  const { username, institutionId } = req.body;

  let user = null;
  if (username) {
    user = DEMO_USERS.find(u => u.username.toLowerCase() === username.toLowerCase());
  } else if (institutionId) {
    user = DEMO_USERS.find(u => u.institutionId.toLowerCase() === institutionId.toLowerCase());
  }

  if (!user) {
    user = DEMO_USERS[0]; // Fallback a Hospital General
  }

  // En la respuesta se entrega el token/sesión con el ID de la institución asignada
  res.json({
    success: true,
    message: `Autenticación exitosa. Operaciones enrutadas automáticamente a ${user.institucion} (${user.motor}).`,
    user,
    enrutamientoMotor: {
      institucion: user.institucion,
      institutionId: user.institutionId,
      motor: user.motor
    }
  });
});

module.exports = router;
