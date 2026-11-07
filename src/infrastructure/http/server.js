require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const institutionRouter = require('../../domain/services/InstitutionRouterService');
const PostgresAdapter = require('../adapters/PostgresAdapter');
const MySQLAdapter = require('../adapters/MySQLAdapter');
const MongoAdapter = require('../adapters/MongoAdapter');
const FirestoreAdapter = require('../adapters/FirestoreAdapter');

const authRoutes = require('./routes/authRoutes');
const patientRoutes = require('./routes/patientRoutes');
const clinicalRoutes = require('./routes/clinicalRoutes');
const systemRoutes = require('./routes/systemRoutes');
const professionalRoutes = require('./routes/professionalRoutes');
const { requireSession, getSetupCodePath } = require('./security/authService');
const adminRoutes = require('./routes/adminRoutes');
const { seedPostgres, seedMySQL, seedMongo, seedFirestore } = require('../database/seeder');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
// Same-origin browser client. No cross-site credential access.
app.disable('x-powered-by');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../../../public')));

// ===============================================================
// Registro de Adaptadores en la Arquitectura Hexagonal
// ===============================================================
console.log('---------------------------------------------------------------');
console.log('Iniciando Arquitectura Hexagonal - Puertos y Adaptadores');
console.log('---------------------------------------------------------------');

const postgresAdapter = new PostgresAdapter();
const mysqlAdapter = new MySQLAdapter();
const mongoAdapter = new MongoAdapter();
const firestoreAdapter = new FirestoreAdapter();

institutionRouter.registerAdapter('hospital', postgresAdapter);
institutionRouter.registerAdapter('odontologia', mysqlAdapter);
institutionRouter.registerAdapter('laboratorio', mongoAdapter);
institutionRouter.registerAdapter('pediatria', firestoreAdapter);

console.log('[OK] Adaptador PostgreSQL registrado -> Hospital General');
console.log('[OK] Adaptador MySQL registrado     -> Clinica Odontologica');
console.log('[OK] Adaptador MongoDB registrado   -> Laboratorio Clinico');
console.log('[OK] Adaptador Firestore registrado -> Centro Medico Pediatrico');

// Rutas de API
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/patients', requireSession, patientRoutes);
app.use('/api/clinical', requireSession, clinicalRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/professionals', requireSession, professionalRoutes);
// /admin no debe salir de la ruta comodín de SPA; sirve su vista específica.
app.get(['/admin', '/admin/'], (req, res) => res.sendFile(path.join(__dirname, '../../../public/admin.html')));

// Ruta de captura para la SPA (Single Page Application - compatible con Express 5)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.url.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, '../../../public/index.html'));
  }
  next();
});

// Manejador global de errores
app.use((err, req, res, next) => {
  console.error('[Server Error]:', err.message);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor'
  });
});

// Iniciar servidor HTTP
const server = app.listen(PORT, async () => {
  console.log(`\nServidor de Historiales Clinicos escuchando en http://localhost:${PORT}`);
  console.log(`Arquitectura Hexagonal activa con soporte a 4 motores de BD.\n`);
  try {
    const setupCodeFile = getSetupCodePath();
    if (setupCodeFile) console.log('[ADMIN] Configuración inicial: lea el código único en ' + setupCodeFile);
  } catch (err) {
    console.error('[ADMIN] No se pudo preparar el código de instalación:', err.message);
  }

  // Intentar inicialización suave de esquemas en segundo plano si los contenedores están listos
  setTimeout(async () => {
    try {
      await seedPostgres().catch(() => {});
      await seedMySQL().catch(() => {});
      await seedMongo().catch(() => {});
      await seedFirestore().catch(() => {});
    } catch (e) {}
  }, 1500);
});

// Cierre ordenado
process.on('SIGTERM', () => {
  console.log('Cerrando servidor...');
  server.close(() => process.exit(0));
});

module.exports = { app, server };
