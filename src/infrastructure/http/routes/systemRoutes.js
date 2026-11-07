const express = require('express');
const router = express.Router();
const medicalRecordService = require('../../../domain/services/MedicalRecordService');
const institutionRouter = require('../../../domain/services/InstitutionRouterService');
const { requireSession } = require('../security/authService');

function getInstitution(req) {
  return req.headers['x-institution-id'] || req.query.institutionId || req.body.institutionId || 'hospital';
}

// Información de instituciones y motores
router.get('/institutions', (req, res) => {
  res.json({
    success: true,
    data: institutionRouter.getInstitutionsInfo()
  });
});

// Health check de los 4 motores de bases de datos
router.get('/health', async (req, res) => {
  try {
    const health = await medicalRecordService.checkAllEnginesHealth();
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      engines: health
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Métricas de la institución
router.get('/stats', requireSession, async (req, res) => {
  try {
    const institutionId = getInstitution(req);
    const stats = await medicalRecordService.getStats(institutionId);
    res.json({
      success: true,
      institutionId,
      data: stats
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Traza de consultas ejecutadas en vivo (SQL, MQL, Firestore)
router.get('/query-logs', requireSession, (req, res) => {
  const requested = Number.parseInt(req.query.limit || '40', 10);
  const limit = Number.isFinite(requested) ? Math.min(100, Math.max(1, requested)) : 40;
  const logs = institutionRouter.getQueryLogs(100).filter(log => log.institutionId === req.auth.institutionId).slice(0, limit);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, total: logs.length, data: logs });
});

module.exports = router;

