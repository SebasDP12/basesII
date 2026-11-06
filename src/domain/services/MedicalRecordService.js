const institutionRouter = require('./InstitutionRouterService');

/**
 * Servicio de Negocio: MedicalRecordService
 * Orquesta los casos de uso del dominio clínico.
 * Totalmente desacoplado de PostgreSQL, MySQL, MongoDB y Firebase.
 */
class MedicalRecordService {
  /**
   * Obtiene el listado de pacientes de la institución activa
   */
  async listPatients(institutionId, options = {}) {
    const adapter = institutionRouter.getAdapter(institutionId);
    return await adapter.findAllPatients(options);
  }

  /**
   * Busca un paciente por ID
   */
  async getPatient(institutionId, id) {
    const adapter = institutionRouter.getAdapter(institutionId);
    const patient = await adapter.findPatientById(id);
    if (!patient) {
      throw new Error(`Paciente con ID ${id} no encontrado en ${institutionId}.`);
    }
    return patient;
  }

  /**
   * Registra un paciente nuevo (Crea un nuevo historial clínico)
   */
  async registerNewPatient(institutionId, patientData) {
    if (!patientData.nombre || !patientData.apellido) {
      throw new Error('El nombre y apellido son obligatorios para generar un historial clínico.');
    }
    if (!patientData.fechaNacimiento) {
      throw new Error('La fecha de nacimiento es obligatoria.');
    }

    const adapter = institutionRouter.getAdapter(institutionId);
    return await adapter.createPatient({
      ...patientData,
      institutionId
    });
  }

  /**
   * Actualiza datos de un paciente
   */
  async updatePatientInfo(institutionId, id, updateData) {
    const adapter = institutionRouter.getAdapter(institutionId);
    return await adapter.updatePatient(id, updateData);
  }

  /**
   * Da de baja o archiva un historial clínico
   * Casos de uso de la rúbrica: traslado a otra institución, fallecimiento, causa administrativa
   */
  async archivePatientRecord(institutionId, id, motivo) {
    if (!motivo || motivo.trim().length < 4) {
      throw new Error('Debe especificar un motivo detallado de baja (mínimo 4 caracteres).');
    }
    const adapter = institutionRouter.getAdapter(institutionId);
    return await adapter.deactivatePatient(id, motivo.trim());
  }

  /**
   * Reactiva un historial clínico
   */
  async restorePatientRecord(institutionId, id) {
    const adapter = institutionRouter.getAdapter(institutionId);
    return await adapter.reactivatePatient(id);
  }

  /**
   * Consulta el historial clínico completo del paciente
   */
  async getFullClinicalHistory(institutionId, patientId) {
    const adapter = institutionRouter.getAdapter(institutionId);
    return await adapter.getClinicalHistory(patientId);
  }

  /**
   * Registra un nuevo evento médico completo
   * (Nueva consulta, nuevo diagnóstico y nuevo tratamiento / medicamento / procedimiento)
   */
  async recordMedicalEvent(institutionId, eventData) {
    if (!eventData.patientId) {
      throw new Error('Se requiere el ID del paciente para registrar la atención clínica.');
    }
    if (!eventData.motivo) {
      throw new Error('El motivo de la atención médica es obligatorio.');
    }
    if (!eventData.diagnosticoDescripcion) {
      throw new Error('El diagnóstico clínico es obligatorio.');
    }

    const adapter = institutionRouter.getAdapter(institutionId);
    return await adapter.recordMedicalEvent(eventData);
  }

  /**
   * Estadísticas de la institución
   */
  async getStats(institutionId) {
    const adapter = institutionRouter.getAdapter(institutionId);
    return await adapter.getInstitutionStats();
  }

  /**
   * Estado de salud y conectividad de todos los motores
   */
  async checkAllEnginesHealth() {
    const institutions = institutionRouter.getInstitutionsInfo();
    const results = {};

    for (const inst of institutions) {
      try {
        const adapter = institutionRouter.getAdapter(inst.id);
        const health = await adapter.healthCheck();
        results[inst.id] = {
          name: inst.name,
          engine: inst.engine,
          port: inst.port,
          status: health.status,
          latencyMs: health.latencyMs,
          details: health.details,
          connected: health.status === 'online'
        };
      } catch (err) {
        results[inst.id] = {
          name: inst.name,
          engine: inst.engine,
          port: inst.port,
          status: 'offline',
          error: err.message,
          connected: false
        };
      }
    }
    return results;
  }
}

module.exports = new MedicalRecordService();
