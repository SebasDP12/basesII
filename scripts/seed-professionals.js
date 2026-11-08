'use strict';
// Agrega profesionales faltantes en los motores documentales. No borra registros.
require('dotenv').config();
const connections = require('../src/infrastructure/database/connectionManager');

async function run() {
  // PostgreSQL y MySQL ya tienen las tablas medico y odontologo con datos iniciales.
  console.log('PostgreSQL y MySQL: se conservan las tablas y los médicos existentes.');
  const mongo = await connections.getMongoDatabase();
  for (const doctor of [
    { id_profesional: 'LAB-001', nombre: 'Marco Tulio', apellido: 'Peña', especialidad: 'Química Biológica / Bacteriología', numero_colegiado: 'COL-LAB-001' },
    { id_profesional: 'LAB-002', nombre: 'Andrea', apellido: 'Morales', especialidad: 'Análisis Clínicos', numero_colegiado: 'COL-LAB-002' }
  ]) {
    await mongo.collection('profesionales').updateOne(
      { id_profesional: doctor.id_profesional }, { $setOnInsert: doctor }, { upsert: true }
    );
  }
  console.log('MongoDB: profesionales agregados o conservados.');
  const firestore = await connections.getFirestore();
  if (!firestore) throw new Error('Firestore no disponible');
  for (const doctor of [
    { id: 'PED-001', nombre: 'Elena', apellido: 'Castillo', especialidad: 'Pediatría', numero_colegiado: 'COL-PED-001' },
    { id: 'PED-002', nombre: 'Luis', apellido: 'Vásquez', especialidad: 'Neonatología', numero_colegiado: 'COL-PED-002' }
  ]) {
    const { id, ...data } = doctor;
    const ref = firestore.collection('profesionales').doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) await ref.create(data);
  }
  console.log('Firestore: profesionales agregados o conservados.');
}

run().catch(err => { console.error('Error al cargar profesionales:', err.message); process.exitCode = 1; })
  .finally(() => connections.closeAll());
