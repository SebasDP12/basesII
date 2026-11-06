const express = require('express');
const router = express.Router();
const medicalRecordService = require('../../../domain/services/MedicalRecordService');

// Middleware para extraer la institución activa del header o query param
function getInstitution(req) {
  return req.headers['x-institution-id'] || req.query.institutionId || req.body.institutionId || 'hospital';
}

// Listar pacientes
router.get('/', async (req, res) => {
  try {
    const institutionId = getInstitution(req);
    const { search, activo } = req.query;
    const patients = await medicalRecordService.listPatients(institutionId, { search, activo });
    res.json({
      success: true,
      institutionId,
      total: patients.length,
      data: patients
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Obtener paciente por ID
router.get('/:id', async (req, res) => {
  try {
    const institutionId = getInstitution(req);
    const patient = await medicalRecordService.getPatient(institutionId, req.params.id);
    res.json({ success: true, institutionId, data: patient });
  } catch (err) {
    res.status(404).json({ success: false, error: err.message });
  }
});

// Crear nuevo paciente (Nuevo Historial Clínico)
router.post('/', async (req, res) => {
  try {
    const institutionId = getInstitution(req);
    const newPatient = await medicalRecordService.registerNewPatient(institutionId, req.body);
    res.status(201).json({
      success: true,
      message: 'Nuevo historial clínico generado exitosamente.',
      institutionId,
      data: newPatient
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Actualizar datos de paciente
router.put('/:id', async (req, res) => {
  try {
    const institutionId = getInstitution(req);
    const updated = await medicalRecordService.updatePatientInfo(institutionId, req.params.id, req.body);
    res.json({
      success: true,
      message: 'Datos del paciente actualizados.',
      institutionId,
      data: updated
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Dar de baja / Archivar historial clínico
router.post('/:id/archive', async (req, res) => {
  try {
    const institutionId = getInstitution(req);
    const { motivo } = req.body;
    const archived = await medicalRecordService.archivePatientRecord(institutionId, req.params.id, motivo);
    res.json({
      success: true,
      message: 'Historial clínico archivado/dado de baja exitosamente.',
      institutionId,
      data: archived
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Reactivar historial clínico
router.post('/:id/restore', async (req, res) => {
  try {
    const institutionId = getInstitution(req);
    const restored = await medicalRecordService.restorePatientRecord(institutionId, req.params.id);
    res.json({
      success: true,
      message: 'Historial clínico reactivado exitosamente.',
      institutionId,
      data: restored
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
