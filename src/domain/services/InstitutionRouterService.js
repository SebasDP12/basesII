const { INSTITUTIONS } = require('../models/Consultation');

/**
 * Servicio de Enrutamiento Institucional (Hexagonal Routing Service)
 * Encargado de despachar dinámicamente las solicitudes de negocio al adaptador
 * del motor de base de datos que corresponde a la institución del usuario autenticado.
 */
class InstitutionRouterService {
  constructor() {
    this.adapters = new Map();
    this.queryLogs = [];
  }

  /**
   * Registra un adaptador para un identificador de institución
   * @param {string} institutionId 'hospital' | 'odontologia' | 'laboratorio' | 'pediatria'
   * @param {MedicalRecordRepositoryPort} adapter
   */
  registerAdapter(institutionId, adapter) {
    this.adapters.set(institutionId, adapter);
  }

  /**
   * Obtiene el adaptador correspondiente para la institución solicitada
   * @param {string} institutionId
   * @returns {MedicalRecordRepositoryPort}
   */
  getAdapter(institutionId) {
    const validId = institutionId ? institutionId.toLowerCase().trim() : 'hospital';
    const adapter = this.adapters.get(validId);
    if (!adapter) {
      throw new Error(`No existe adaptador configurado para la institución '${validId}'. Motores válidos: ${Array.from(this.adapters.keys()).join(', ')}`);
    }
    return adapter;
  }

  /**
   * Retorna la metadata de todas las instituciones soportadas
   */
  getInstitutionsInfo() {
    return Object.values(INSTITUTIONS).map(inst => ({
      ...inst,
      hasAdapter: this.adapters.has(inst.id)
    }));
  }

  /**
   * Registra una traza de consulta para inspección pedagógica y técnica
   */
  logQuery(institutionId, engine, operation, rawQuery, executionTimeMs = 0) {
    const sanitize = (value) => String(value ?? '')
      .replace(/(password|passwd|contrasena|contraseña|token|authorization|secret|api[_-]?key)\\s*[:=]\\s*([\\"']?)[^,\\s;}]+/gi, '$1=[OCULTO]')
      .replace(/(postgres(?:ql)?:\\/\\/|mysql:\\/\\/|mongodb(?:\\+srv)?:\\/\\/)[^@\\s]+@/gi, '$1[OCULTO]@');
    const logEntry = {
      id: Date.now() + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toISOString(),
      institutionId,
      engine,
      operation,
      rawQuery: sanitize(typeof rawQuery === 'string' ? rawQuery : JSON.stringify(rawQuery, null, 2)),
      executionTimeMs
    };
    this.queryLogs.unshift(logEntry);
    if (this.queryLogs.length > 100) {
      this.queryLogs.pop();
    }
    return logEntry;
  }

  getQueryLogs(limit = 30) {
    return this.queryLogs.slice(0, limit);
  }
}

// Instancia singleton para compartir entre el core y el servidor HTTP
const routerInstance = new InstitutionRouterService();

module.exports = routerInstance;

