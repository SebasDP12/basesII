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
  if (cleanName.length > 80 || password.length > 256 || !VALID_INSTITUTIONS.has(institutionId)) {
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
  const valid = user && checkPassword(password, user.passwordHash);
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
  return session;
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
  if (requested && requested !== session.institutionId) {
    return res.status(403).json({ success: false, error: 'No tiene autorización para esta institución.' });
  }
  req.auth = session;
  next();
}

module.exports = {
  USERS_PATH, VALID_INSTITUTIONS, hashPassword, authenticate, startSession, readSession,
  endSession, requireSession
};
