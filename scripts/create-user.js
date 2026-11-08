'use strict';
// Uso: node scripts/create-user.js usuario institucion "Nombre del profesional"
// Introducir la contraseña en la terminal, sin pasarla como argumento.
const fs = require('fs');
const path = require('path');
const { USERS_PATH, VALID_INSTITUTIONS, hashPassword } = require('../src/infrastructure/http/security/authService');

const [rawUsername, institutionId, ...nameParts] = process.argv.slice(2);
const username = (rawUsername || '').trim().toLowerCase();
const nombre = nameParts.join(' ').trim();
if (!/^[a-z0-9._-]{3,80}$/.test(username) || !VALID_INSTITUTIONS.has(institutionId) || !nombre || nombre.length > 120) {
  console.error('Uso: node scripts/create-user.js usuario {hospital|odontologia|laboratorio|pediatria} "Nombre completo"');
  process.exit(1);
}

function readPasswordMasked(prompt) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
      reject(new Error('Ejecute el comando en una terminal interactiva (TTY).'));
      return;
    }
    let password = '';
    process.stdout.write(prompt);
    process.stdin.setEncoding('utf8');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    function cleanup() {
      process.stdin.removeListener('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
    }
    function onData(chunk) {
      for (const c of chunk) {
        if (c === '\r' || c === '\n') { cleanup(); resolve(password); return; }
        if (c === '\u0003') { cleanup(); reject(new Error('Cancelado.')); return; }
        if (c === '\u007f' || c === '\b') {
          if (password) { password = password.slice(0, -1); process.stdout.write('\b \b'); }
        } else if (c >= ' ' && password.length < 256) {
          password += c;
          process.stdout.write('*');
        }
      }
    }
    process.stdin.on('data', onData);
  });
}

(async () => {
  const password = await readPasswordMasked('Contraseña nueva (mínimo 12 caracteres): ');
  if (password.length < 12) throw new Error('Se requieren al menos 12 caracteres.');
  const confirm = await readPasswordMasked('Confirmar contraseña: ');
  if (confirm !== password) throw new Error('Las contraseñas no coinciden.');
  let users = [];
  if (fs.existsSync(USERS_PATH)) {
    const data = JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
    if (!Array.isArray(data.users)) throw new Error('Archivo de usuarios inválido, sin modificar.');
    users = data.users;
  }
  const user = { username, institutionId, nombre, rol: 'profesional', passwordHash: hashPassword(password) };
  const index = users.findIndex(u => u.username === username && u.institutionId === institutionId);
  if (index >= 0) users[index] = user;
  else users.push(user);
  fs.mkdirSync(path.dirname(USERS_PATH), { recursive: true, mode: 0o700 });
  const tmp = USERS_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ users }, null, 2) + '\n', { mode: 0o600, flag: 'w' });
  fs.renameSync(tmp, USERS_PATH);
  console.log('Usuario guardado. Solo se almacena el hash scrypt, no la contraseña.');
})().catch(err => {
  console.error('Error:', err.message);
  process.exitCode = 1;
});
