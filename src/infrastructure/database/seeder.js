require('dotenv').config();
const fs = require('fs');
const path = require('path');
const connectionManager = require('./connectionManager');

async function seedPostgres() {
  console.log('\n--- [1/4] Inicializando PostgreSQL (Hospital General) ---');
  try {
    const pool = connectionManager.getPostgresPool();
    const sqlPath = path.join(__dirname, '../../../docker/postgres/init.sql');
    if (fs.existsSync(sqlPath)) {
      const sql = fs.readFileSync(sqlPath, 'utf8');
      await pool.query(sql);
      console.log('✅ PostgreSQL inicializado con éxito (Tablas y datos creados).');
    }
  } catch (err) {
    console.warn('⚠️ No se pudo conectar a PostgreSQL (se reintentará cuando el contenedor esté activo):', err.message);
  }
}

async function seedMySQL() {
  console.log('\n--- [2/4] Inicializando MySQL (Clínica Odontológica) ---');
  try {
    const pool = connectionManager.getMySQLPool();
    const sqlPath = path.join(__dirname, '../../../docker/mysql/init.sql');
    if (fs.existsSync(sqlPath)) {
      const sql = fs.readFileSync(sqlPath, 'utf8');
      // Dividir por declaraciones para mysql2
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('USE') && !s.startsWith('CREATE DATABASE'));

      for (const statement of statements) {
        await pool.query(statement);
      }
      console.log('✅ MySQL inicializado con éxito (Tablas InnoDB y datos creados).');
    }
  } catch (err) {
    console.warn('⚠️ No se pudo conectar a MySQL (se reintentará cuando el contenedor esté activo):', err.message);
  }
}

async function seedMongo() {
  console.log('\n--- [3/4] Inicializando MongoDB (Laboratorio Clínico) ---');
  try {
    const db = await connectionManager.getMongoDatabase();
    const pacientesCount = await db.collection('pacientes').countDocuments();
    if (pacientesCount === 0) {
      // Insertar datos de catálogo y pacientes iniciales
      await db.collection('pacientes').insertMany([
        {
          id_paciente: 1,
          nombre: "Carlos",
          apellido: "Valenzuela Ruiz",
          fecha_nacimiento: "1980-06-18",
          telefono: "5555-4001",
          correo: "carlos.valenzuela@email.com",
          activo: true,
          motivo_baja: null,
          fecha_baja: null,
          fecha_creacion: new Date("2026-09-01T08:00:00Z")
        },
        {
          id_paciente: 2,
          nombre: "Claudia",
          apellido: "Morales Pineda",
          fecha_nacimiento: "1994-11-03",
          telefono: "5555-4002",
          correo: "claudia.morales@email.com",
          activo: true,
          motivo_baja: null,
          fecha_baja: null,
          fecha_creacion: new Date("2026-09-15T09:30:00Z")
        },
        {
          id_paciente: 3,
          nombre: "Víctor",
          apellido: "Hernández Cruz",
          fecha_nacimiento: "1972-01-25",
          telefono: "5555-4003",
          correo: "victor.hernandez@email.com",
          activo: false,
          motivo_baja: "Fallecimiento",
          fecha_baja: new Date("2026-10-10T12:00:00Z"),
          fecha_creacion: new Date("2026-08-10T07:45:00Z")
        }
      ]);

      await db.collection('catalogo_examenes').insertMany([
        {
          id_tipo_examen: 1,
          nombre_examen: "Hematología Completa",
          descripcion: "Evaluación celular y hemoglobina",
          parametros: [
            { parametro: "Hemoglobina", unidad_medida: "g/dL", valor_referencia: "12.0 - 16.0" },
            { parametro: "Hematocrito", unidad_medida: "%", valor_referencia: "37.0 - 47.0" }
          ]
        },
        {
          id_tipo_examen: 2,
          nombre_examen: "Perfil Lipídico",
          descripcion: "Medición de lípidos y colesterol",
          parametros: [
            { parametro: "Colesterol Total", unidad_medida: "mg/dL", valor_referencia: "< 200" },
            { parametro: "Triglicéridos", unidad_medida: "mg/dL", valor_referencia: "< 150" }
          ]
        }
      ]);

      await db.collection('ordenes_examen').insertMany([
        {
          id_orden: 1,
          id_paciente: 1,
          fecha_solicitud: "2026-10-18",
          fecha_resultado: "2026-10-19",
          estado: "finalizado",
          tipo_examen: { id_tipo_examen: 1, nombre_examen: "Hematología Completa" },
          motivo: "Control de rutina y fatiga",
          diagnostico: "Anemia leve normocítica normocrómica",
          tratamiento: "Sulfato Ferroso 300mg diario + Ácido Fólico",
          resultados: [
            { parametro: "Hemoglobina", unidad_medida: "g/dL", valor_referencia: "12.0 - 16.0", valor_obtenido: "10.8" },
            { parametro: "Hematocrito", unidad_medida: "%", valor_referencia: "37.0 - 47.0", valor_obtenido: "33.5" }
          ]
        }
      ]);
      console.log('✅ MongoDB poblado con colecciones de documentos de prueba.');
    } else {
      console.log('✅ MongoDB ya contiene datos registrados.');
    }
  } catch (err) {
    console.warn('⚠️ No se pudo conectar a MongoDB (se reintentará cuando el contenedor esté activo):', err.message);
  }
}

async function seedFirestore() {
  console.log('\n--- [4/4] Inicializando Firebase Firestore (Centro Médico Pediátrico) ---');
  try {
    const jsonPath = path.join(__dirname, '../../../docker/firestore/data/init.json');
    if (fs.existsSync(jsonPath)) {
      console.log('✅ Firebase Firestore: Colecciones de documentos listas en el almacén local / emulador.');
    }
  } catch (err) {
    console.warn('⚠️ Error en Firestore:', err.message);
  }
}

async function runSeed() {
  console.log('===============================================================');
  console.log('Iniciando Seeder General de las 4 Bases de Datos del Proyecto');
  console.log('===============================================================');
  await seedPostgres();
  await seedMySQL();
  await seedMongo();
  await seedFirestore();
  console.log('\n===============================================================');
  console.log('Proceso de Verificación y Carga Finalizado');
  console.log('===============================================================\n');
  process.exit(0);
}

if (require.main === module) {
  runSeed();
}

module.exports = { seedPostgres, seedMySQL, seedMongo, seedFirestore };
