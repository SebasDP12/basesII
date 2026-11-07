const express = require('express');
const router = express.Router();
const medicalRecordService = require('../../../domain/services/MedicalRecordService');
const { requireRole } = require('../security/authService');

function getInstitution(req) {
  return req.auth.institutionId;
}

// Obtener historial clínico completo del paciente
router.get('/patients/:id/history', async (req, res) => {
  try {
    const institutionId = getInstitution(req);
    const history = await medicalRecordService.getFullClinicalHistory(institutionId, req.params.id);
    if (!history) {
      return res.status(404).json({ success: false, error: 'Historial no encontrado.' });
    }
    res.json({ success: true, institutionId, data: history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Registrar nuevo evento clínico (Consulta + Diagnóstico + Tratamiento / Procedimiento / Examen / Vacuna)
router.post('/events', requireRole('medico','odontologo','pediatra','laboratorista','enfermeria'), async (req, res) => {
  try {
    const institutionId = getInstitution(req);
    const result = await medicalRecordService.recordMedicalEvent(institutionId, req.body);
    res.status(201).json({
      success: true,
      institutionId,
      message: result.message || 'Atención clínica registrada exitosamente.',
      data: result
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;

