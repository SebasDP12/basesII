'use strict';

// Las contraseñas del personal se guardan únicamente como hashes scrypt.
// El archivo local security/users.json NO forma parte del repositorio.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const USERS_PATH = path.resolve(process.env.AUTH_USERS_FILE || path.join(__dirname, '../../../../security/users.json'));
const SESSION_COOKIE = 'sr_session';
const SESSION_MS = 8 * 60 * 60 * 1000;
const sessions = new Map();
const attempts = new Map();
const VALID_INSTITUTIONS = new Set(['hospital', 'odontologia', 'laboratorio', 'pediatria']);
const LOGIN_INSTITUTIONS = new Set([...VALID_INSTITUTIONS, 'admin']);
const SETUP_PATH = path.join(path.dirname(USERS_PATH), 'admin-setup-code.txt');

function loadUsers() {
  if (!fs.existsSync(USERS_PATH)) return [];
  const parsed = JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
  if (!parsed || !Array.isArray(parsed.users)) throw new Error('Formato no válido para el archivo de usuarios');
  return parsed.users;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return 'scrypt$' + salt + '$' + crypto.scryptSync(password, Buffer.from(salt, 'hex'), 64).toString('hex');
}

function checkPassword(password, savedHash) {
  const pieces = typeof savedHash === 'string' ? savedHash.split('$') : [];
  if (pieces.length !== 3 || pieces[0] !== 'scrypt') return false;
  try {
    const expected = Buffer.from(pieces[2], 'hex');
    if (expected.length !== 64 || !/^[0-9a-f]{32}$/i.test(pieces[1])) return false;
    const actual = crypto.scryptSync(password, Buffer.from(pieces[1], 'hex'), 64);
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function authenticationKey(req, username) {
  return (req.ip || req.socket.remoteAddress || 'desconocida') + ':' + username.toLowerCase();
}

function authenticate(req, username, password, institutionId) {
  if (typeof username !== 'string' || typeof password !== 'string' || typeof institutionId !== 'string') {
    return { error: 'Credenciales incorrectas', status: 401 };
  }
  const cleanName = username.trim().toLowerCase();
  if (cleanName.length > 80 || password.length > 256 || !LOGIN_INSTITUTIONS.has(institutionId)) {
    return { error: 'Credenciales incorrectas', status: 401 };
  }
  const key = authenticationKey(req, cleanName);
  const now = Date.now();
  const previous = attempts.get(key);
  if (previous && previous.until > now && previous.count >= 6) {
    return { error: 'Demasiados intentos. Intente de nuevo en 15 minutos.', status: 429 };
  }
  let user;
  try {
    user = loadUsers().find(u => u.username === cleanName && u.institutionId === institutionId);
  } catch (err) {
    console.error('[Acceso] No se pudo leer el archivo de usuarios:', err.message);
    return { error: 'Acceso temporalmente no disponible', status: 503 };
  }
  const valid = user && user.active !== false && checkPassword(password, user.passwordHash);
  if (!valid) {
    const count = previous && previous.until > now ? previous.count + 1 : 1;
    attempts.set(key, { count, until: now + 15 * 60 * 1000 });
    return { error: 'Credenciales incorrectas', status: 401 };
  }
  attempts.delete(key);
  return { user: { username: user.username, nombre: user.nombre, rol: user.rol, institutionId: user.institutionId } };
}

function cookieValue(req, value, maxAgeSeconds) {
  // En HTTP local no se marca Secure; al servir por HTTPS sí debe activarse.
  const secure = req.secure ? '; Secure' : '';
  return SESSION_COOKIE + '=' + value + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + maxAgeSeconds + secure;
}

function sessionKey(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function startSession(req, res, user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(sessionKey(token), { ...user, expiresAt: Date.now() + SESSION_MS });
  res.setHeader('Set-Cookie', cookieValue(req, token, SESSION_MS / 1000));
  res.setHeader('Cache-Control', 'no-store');
}

function readToken(req) {
  const found = (req.headers.cookie || '').split(';').map(s => s.trim())
    .find(s => s.startsWith(SESSION_COOKIE + '='));
  const token = found ? found.slice(SESSION_COOKIE.length + 1) : '';
  return /^[0-9a-f]{64}$/.test(token) ? token : null;
}

function readSession(req) {
  const token = readToken(req);
  if (!token) return null;
  const session = sessions.get(sessionKey(token));
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(sessionKey(token));
    return null;
  }
  // Una cuenta suspendida pierde inmediatamente las sesiones previas.
  try {
    const current = loadUsers().find(u => u.username === session.username &&
      u.institutionId === session.institutionId && u.active !== false && u.rol === session.rol);
    if (!current) {
      sessions.delete(sessionKey(token));
      return null;
    }
    return { username: current.username, nombre: current.nombre, rol: current.rol,
      institutionId: current.institutionId, expiresAt: session.expiresAt };
  } catch {
    return null;
  }
}

function endSession(req, res) {
  const token = readToken(req);
  if (token) sessions.delete(sessionKey(token));
  res.setHeader('Set-Cookie', cookieValue(req, '', 0));
  res.setHeader('Cache-Control', 'no-store');
}

function requireSession(req, res, next) {
  const session = readSession(req);
  if (!session) return res.status(401).json({ success: false, error: 'Debe iniciar sesión.' });
  // Comprobar origen en escrituras con cookie; evita operaciones externas desde navegadores.
  const origin = req.headers.origin;
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && origin) {
    try {
      if (new URL(origin).host !== req.headers.host) {
        return res.status(403).json({ success: false, error: 'Origen no autorizado.' });
      }
    } catch {
      return res.status(403).json({ success: false, error: 'Origen no autorizado.' });
    }
  }
  const requested = req.headers['x-institution-id'] || req.query?.institutionId || req.body?.institutionId;
  if (requested && requested !== session.institutionId &&
      !(session.institutionId === 'admin' && req.baseUrl === '/api/admin')) {
    return res.status(403).json({ success: false, error: 'No tiene autorización para esta institución.' });
  }
  req.auth = session;
  next();
}


function storeUsers(users) {
  fs.mkdirSync(path.dirname(USERS_PATH), { recursive: true, mode: 0o700 });
  const temp = USERS_PATH + '.' + crypto.randomBytes(6).toString('hex') + '.tmp';
  try {
    fs.writeFileSync(temp, JSON.stringify({ users }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    fs.renameSync(temp, USERS_PATH);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}

function publicUsers() {
  return loadUsers().map(({ username, nombre, rol, institutionId, active }) => ({
    username, nombre, rol, institutionId, active: active !== false
  }));
}

function hasAdministrator() {
  return loadUsers().some(u => u.institutionId === 'admin' && u.rol === 'admin');
}

function createAccount({ username, nombre, rol, institutionId, password }) {
  if (typeof username !== 'string' || !/^[a-z0-9._-]{3,80}$/.test(username)) {
    throw new Error('Usuario inválido: use de 3 a 80 caracteres, letras minúsculas, números, puntos o guiones.');
  }
  if (typeof nombre !== 'string' || nombre.trim().length < 3 || nombre.length > 150) {
    throw new Error('Nombre inválido.');
  }
  if (typeof password !== 'string' || password.length < 12 || password.length > 256) {
    throw new Error('La contraseña debe tener entre 12 y 256 caracteres.');
  }
  if (!LOGIN_INSTITUTIONS.has(institutionId) || typeof rol !== 'string') {
    throw new Error('Institución o rol inválidos.');
  }
  if (institutionId === 'admin' && rol !== 'admin') throw new Error('Rol administrativo inválido.');
  if (institutionId !== 'admin' && rol === 'admin') throw new Error('Rol administrativo no permitido para una institución.');
  const users = loadUsers();
  if (users.some(u => u.username === username)) {
    const err = new Error('El nombre de usuario ya existe. Elija otro.');
    err.status = 409;
    throw err;
  }
  const account = {
    username, nombre: nombre.trim(), rol, institutionId, active: true,
    passwordHash: hashPassword(password)
  };
  storeUsers([...users, account]);
  return { username, nombre: account.nombre, rol, institutionId, active: true };
}

function setAccountEnabled(username, active) {
  if (typeof active !== 'boolean') throw new Error('Estado inválido.');
  const users = loadUsers();
  const target = users.find(u => u.username === username && u.institutionId !== 'admin');
  if (!target) {
    const err = new Error('Cuenta no encontrada.');
    err.status = 404;
    throw err;
  }
  target.active = active;
  storeUsers(users);
  return { username: target.username, institutionId: target.institutionId, active };
}

function getSetupCodePath() {
  if (hasAdministrator()) return null;
  fs.mkdirSync(path.dirname(SETUP_PATH), { recursive: true, mode: 0o700 });
  if (!fs.existsSync(SETUP_PATH)) {
    fs.writeFileSync(SETUP_PATH, crypto.randomBytes(24).toString('hex') + '\n', { mode: 0o600, flag: 'wx' });
  }
  return SETUP_PATH;
}

function initialAdministrator({ setupCode, username, nombre, password }) {
  if (hasAdministrator()) {
    const err = new Error('El administrador inicial ya existe.');
    err.status = 403;
    throw err;
  }
  const setupPath = getSetupCodePath();
  const expected = fs.readFileSync(setupPath, 'utf8').trim();
  const provided = String(setupCode || '');
  if (provided.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
    const err = new Error('Código de configuración incorrecto.');
    err.status = 403;
    throw err;
  }
  const created = createAccount({
    username: String(username || '').trim().toLowerCase(), nombre,
    rol: 'admin', institutionId: 'admin', password
  });
  fs.unlinkSync(setupPath);
  return created;
}

function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.auth || !allowed.includes(req.auth.rol)) {
      return res.status(403).json({ success: false, error: 'Su rol no autoriza esta operación.' });
    }
    next();
  };
}

module.exports = {
  USERS_PATH, VALID_INSTITUTIONS, hashPassword, authenticate, startSession, readSession,
  endSession, requireSession, requireRole, publicUsers, hasAdministrator,
  createAccount, setAccountEnabled, getSetupCodePath, initialAdministrator
};
