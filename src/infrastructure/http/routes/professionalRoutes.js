'use strict';
const express = require('express');
const router = express.Router();
const connections = require('../../database/connectionManager');
const institutionRouter = require('../../../domain/services/InstitutionRouterService');

// Esta ruta ya está protegida por requireSession en server.js.
// Reutiliza las tablas existentes en PostgreSQL/MySQL, sin alterar el esquema.
router.get('/', async (req, res) => {
  const institution = req.auth.institutionId;
  try {
    let rows = [];
    let statement = '';
    if (institution === 'hospital') {
      statement = 'SELECT id_medico AS id, nombre, apellido, especialidad, numero_colegiado FROM medico ORDER BY id_medico';
      const data = await connections.getPostgresPool().query(statement);
      rows = data.rows;
    } else if (institution === 'odontologia') {
      statement = 'SELECT id_odontologo AS id, nombre, apellido, especialidad, numero_colegiado FROM odontologo ORDER BY id_odontologo';
      const [data] = await connections.getMySQLPool().query(statement);
      rows = data;
    } else if (institution === 'laboratorio') {
      statement = 'db.profesionales.find({}, { id_profesional: 1, nombre: 1, apellido: 1, especialidad: 1, numero_colegiado: 1 })';
      const db = await connections.getMongoDatabase();
      rows = await db.collection('profesionales').find({}, { projection: { _id: 0 } }).sort({ id_profesional: 1 }).toArray();
      rows = rows.map(p => ({ id: p.id_profesional, nombre: p.nombre, apellido: p.apellido, especialidad: p.especialidad, numero_colegiado: p.numero_colegiado }));
    } else if (institution === 'pediatria') {
      statement = 'Firestore: collection(profesionales).get()';
      const firestore = await connections.getFirestore();
      if (!firestore) throw new Error('Firestore no disponible');
      const snap = await firestore.collection('profesionales').get();
      rows = snap.docs.map(d => ({
        id: d.id, nombre: d.data().nombre, apellido: d.data().apellido,
        especialidad: d.data().especialidad, numero_colegiado: d.data().numero_colegiado
      }));
    }
    institutionRouter.logQuery(institution, institutionRouter.getAdapter(institution).engineName,
      'LISTAR PROFESIONALES', statement);
    return res.json({ success: true, institutionId: institution, data: rows });
  } catch (err) {
    console.error('[Profesionales]', institution, err.message);
    return res.status(503).json({ success: false, error: 'No se pudo obtener el listado de profesionales desde la base de datos.' });
  }
});

module.exports = router;
