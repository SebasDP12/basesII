/**
 * Puerto del Dominio: MedicalRecordRepositoryPort
 * Define el contrato que debe satisfacer cualquier adaptador de persistencia
 * (Postgres, MySQL, MongoDB, Firebase) sin acoplar la lógica de negocio al motor subyacente.
 */
class MedicalRecordRepositoryPort {
  /**
   * Obtiene la lista de pacientes con filtros opcionales (búsqueda, estado activo/archivado)
   * @param {Object} options { search, activo }
   * @returns {Promise<Array<Patient>>}
   */
  async findAllPatients(options = {}) {
    throw new Error('Método findAllPatients no implementado');
  }

  /**
   * Busca un paciente por su identificador único
   * @param {string|number} id
   * @returns {Promise<Patient|null>}
   */
  async findPatientById(id) {
    throw new Error('Método findPatientById no implementado');
  }

  /**
   * Registra un nuevo paciente (genera un nuevo historial clínico)
   * @param {Object} patientData
   * @returns {Promise<Patient>}
   */
  async createPatient(patientData) {
    throw new Error('Método createPatient no implementado');
  }

  /**
   * Actualiza los datos generales de un paciente existente
   * @param {string|number} id
   * @param {Object} patientData
   * @returns {Promise<Patient>}
   */
  async updatePatient(id, patientData) {
    throw new Error('Método updatePatient no implementado');
  }

  /**
   * Desactiva / archiva el historial clínico de un paciente por baja
   * @param {string|number} id
   * @param {string} motivo
   * @returns {Promise<Patient>}
   */
  async deactivatePatient(id, motivo) {
    throw new Error('Método deactivatePatient no implementado');
  }

  /**
   * Reactiva el historial de un paciente previamente archivado
   * @param {string|number} id
   * @returns {Promise<Patient>}
   */
  async reactivatePatient(id) {
    throw new Error('Método reactivatePatient no implementado');
  }

  /**
   * Obtiene el historial clínico completo del paciente (consultas, diagnósticos, tratamientos)
   * @param {string|number} patientId
   * @returns {Promise<Object>} { paciente, consultas, estadisticas, rawQueries }
   */
  async getClinicalHistory(patientId) {
    throw new Error('Método getClinicalHistory no implementado');
  }

  /**
   * Registra una nueva consulta/atención médica completa con diagnóstico y tratamiento asociado
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async recordMedicalEvent(payload) {
    throw new Error('Método recordMedicalEvent no implementado');
  }

  /**
   * Obtiene métricas y estadísticas clave del establecimiento
   * @returns {Promise<Object>}
   */
  async getInstitutionStats() {
    throw new Error('Método getInstitutionStats no implementado');
  }

  /**
   * Verifica la conectividad y estado del motor de base de datos
   * @returns {Promise<{ status: string, latencyMs: number, details: Object }>}
   */
  async healthCheck() {
    throw new Error('Método healthCheck no implementado');
  }
}

module.exports = MedicalRecordRepositoryPort;
