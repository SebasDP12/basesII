'use strict';
const fs = require('fs');
const path = require('path');
const { USERS_PATH, hashPassword } = require('../src/infrastructure/http/security/authService');

const defaultUsers = [
  {
    username: 'admin',
    institutionId: 'admin',
    nombre: 'Administrador General',
    rol: 'admin',
    password: 'Admin12345678!',
    active: true
  },
  {
    username: 'admin_hospital',
    institutionId: 'hospital',
    nombre: 'Administrador Hospital General',
    rol: 'admin',
    password: 'AdminHospital123!',
    active: true
  },
  {
    username: 'hospital',
    institutionId: 'hospital',
    nombre: 'Dr. Carlos Ramirez (Admin Hospital)',
    rol: 'admin',
    password: 'AdminHospital123!',
    active: true
  },
  {
    username: 'admin_odonto',
    institutionId: 'odontologia',
    nombre: 'Administrador Clinica Odontologica',
    rol: 'admin',
    password: 'AdminOdonto123!',
    active: true
  },
  {
    username: 'odontologia',
    institutionId: 'odontologia',
    nombre: 'Dra. Sofia Mendoza (Admin Odonto)',
    rol: 'admin',
    password: 'AdminOdonto123!',
    active: true
  },
  {
    username: 'admin_lab',
    institutionId: 'laboratorio',
    nombre: 'Administrador Laboratorio Clinico',
    rol: 'admin',
    password: 'AdminLaboratorio123!',
    active: true
  },
  {
    username: 'laboratorio',
    institutionId: 'laboratorio',
    nombre: 'Lic. Marco Tulio Pena (Admin Lab)',
    rol: 'admin',
    password: 'AdminLaboratorio123!',
    active: true
  },
  {
    username: 'admin_pediatria',
    institutionId: 'pediatria',
    nombre: 'Administrador Centro Pediatrico',
    rol: 'admin',
    password: 'AdminPediatria123!',
    active: true
  },
  {
    username: 'pediatria',
    institutionId: 'pediatria',
    nombre: 'Dra. Elena Castillo (Admin Pediatria)',
    rol: 'admin',
    password: 'AdminPediatria123!',
    active: true
  }
];

function setupUsers() {
  const users = defaultUsers.map(({ username, institutionId, nombre, rol, active, password }) => ({
    username,
    institutionId,
    nombre,
    rol,
    active,
    passwordHash: hashPassword(password)
  }));

  fs.mkdirSync(path.dirname(USERS_PATH), { recursive: true, mode: 0o700 });
  const tmp = USERS_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ users }, null, 2) + '\n', { mode: 0o600, flag: 'w' });
  fs.renameSync(tmp, USERS_PATH);

  // Si existe admin-setup-code.txt, eliminarlo ya que el admin está configurado
  const setupCodeFile = path.join(path.dirname(USERS_PATH), 'admin-setup-code.txt');
  if (fs.existsSync(setupCodeFile)) {
    try { fs.unlinkSync(setupCodeFile); } catch (e) {}
  }

  console.log('Usuarios administradores configurados exitosamente en:', USERS_PATH);
  console.log('Listado de credenciales creadas:');
  console.log('----------------------------------------------------------------------------------------');
  console.log('| Módulo / Panel        | Institución   | Usuario           | Contraseña           | Rol   |');
  console.log('----------------------------------------------------------------------------------------');
  console.log('| Panel Admin (/admin)  | admin         | admin             | Admin12345678!       | admin |');
  console.log('| Hospital General      | hospital      | admin_hospital    | AdminHospital123!    | admin |');
  console.log('| Hospital General      | hospital      | hospital          | AdminHospital123!    | admin |');
  console.log('| Odontología           | odontologia   | admin_odonto      | AdminOdonto123!      | admin |');
  console.log('| Odontología           | odontologia   | odontologia       | AdminOdonto123!      | admin |');
  console.log('| Laboratorio Clínico   | laboratorio   | admin_lab         | AdminLaboratorio123! | admin |');
  console.log('| Laboratorio Clínico   | laboratorio   | laboratorio       | AdminLaboratorio123! | admin |');
  console.log('| Centro Pediátrico     | pediatria     | admin_pediatria   | AdminPediatria123!   | admin |');
  console.log('| Centro Pediátrico     | pediatria     | pediatria         | AdminPediatria123!   | admin |');
  console.log('----------------------------------------------------------------------------------------');
}

if (require.main === module) {
  setupUsers();
}

module.exports = { setupUsers, defaultUsers };

