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
const { seedPostgres, seedMySQL, seedMongo, seedFirestore } = require('../database/seeder');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
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

console.log('✅ Adaptador PostgreSQL registrado -> Hospital General');
console.log('✅ Adaptador MySQL registrado     -> Clínica Odontológica');
console.log('✅ Adaptador MongoDB registrado   -> Laboratorio Clínico');
console.log('✅ Adaptador Firestore registrado -> Centro Médico Pediátrico');

// Rutas de API
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/clinical', clinicalRoutes);
app.use('/api/system', systemRoutes);

// Ruta de captura para la SPA (Single Page Application - compatible con Express 5)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.url.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, '../../../public/index.html'));
  }
  next();
});

// Manejador global de errores
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Error interno del servidor'
  });
});

// Iniciar servidor HTTP
const server = app.listen(PORT, async () => {
  console.log(`\n🚀 Servidor de Historiales Clínicos escuchando en http://localhost:${PORT}`);
  console.log(`📡 Arquitectura Hexagonal activa con soporte simultáneo a 4 motores de BD.\n`);

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
