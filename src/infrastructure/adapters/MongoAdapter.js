const MedicalRecordRepositoryPort = require('../../domain/ports/MedicalRecordRepositoryPort');
const Patient = require('../../domain/models/Patient');
const connectionManager = require('../database/connectionManager');
const institutionRouter = require('../../domain/services/InstitutionRouterService');

class MongoAdapter extends MedicalRecordRepositoryPort {
  constructor() {
    super();
    this.institutionId = 'laboratorio';
    this.engineName = 'MongoDB';
  }

  async getDb() {
    return await connectionManager.getMongoDatabase();
  }

  async healthCheck() {
    const start = Date.now();
    try {
      const db = await this.getDb();
      const adminDb = db.admin();
      const ping = await adminDb.ping();
      const totalPacientes = await db.collection('pacientes').countDocuments();
      const latencyMs = Date.now() - start;
      return {
        status: 'online',
        latencyMs,
        details: {
          version: 'MongoDB 7.0 (WiredTiger)',
          ping: ping.ok === 1 ? 'OK' : 'FAIL',
          totalPacientes,
          database: db.databaseName
        }
      };
    } catch (err) {
      return {
        status: 'offline',
        latencyMs: Date.now() - start,
        details: { error: err.message }
      };
    }
  }

  async findAllPatients(options = {}) {
    const db = await this.getDb();
    const start = Date.now();
    const filter = {};

    if (options.activo !== undefined && options.activo !== '') {
      filter.activo = options.activo === true || options.activo === 'true';
    }

    if (options.search) {
      const regex = new RegExp(options.search, 'i');
      filter.$or = [
        { nombre: regex },
        { apellido: regex },
        { correo: regex }
      ];
    }

    const cursor = db.collection('pacientes').find(filter).sort({ id_paciente: -1 });
    const docs = await cursor.toArray();

    institutionRouter.logQuery(
      this.institutionId,
      this.engineName,
      'db.pacientes.find()',
      JSON.stringify(filter, null, 2),
      Date.now() - start
    );

    return docs.map(doc => new Patient({
      id: doc.id_paciente,
      institutionId: this.institutionId,
      nombre: doc.nombre,
      apellido: doc.apellido,
      fechaNacimiento: doc.fecha_nacimiento,
      telefono: doc.telefono,
      correo: doc.correo,
      activo: doc.activo,
      motivoBaja: doc.motivo_baja,
      fechaBaja: doc.fecha_baja ? new Date(doc.fecha_baja).toISOString() : null,
      metadata: { fechaCreacion: doc.fecha_creacion }
    }));
  }

  async findPatientById(id) {
    const db = await this.getDb();
    const start = Date.now();
    const numId = parseInt(id, 10);
    const filter = isNaN(numId) ? { id_paciente: id } : { id_paciente: numId };

    const doc = await db.collection('pacientes').findOne(filter);
    institutionRouter.logQuery(this.institutionId, this.engineName, 'db.pacientes.findOne()', JSON.stringify(filter), Date.now() - start);

    if (!doc) return null;
    return new Patient({
      id: doc.id_paciente,
      institutionId: this.institutionId,
      nombre: doc.nombre,
      apellido: doc.apellido,
      fechaNacimiento: doc.fecha_nacimiento,
      telefono: doc.telefono,
      correo: doc.correo,
      activo: doc.activo,
      motivoBaja: doc.motivo_baja,
      fechaBaja: doc.fecha_baja ? new Date(doc.fecha_baja).toISOString() : null
    });
  }

  async createPatient(patientData) {
    const db = await this.getDb();
    const start = Date.now();

    // Obtener siguiente ID autoincremental
    const last = await db.collection('pacientes').find().sort({ id_paciente: -1 }).limit(1).toArray();
    const nextId = (last[0]?.id_paciente || 0) + 1;

    const newDoc = {
      id_paciente: nextId,
      nombre: patientData.nombre,
      apellido: patientData.apellido,
      fecha_nacimiento: patientData.fechaNacimiento,
      telefono: patientData.telefono || '',
      correo: patientData.correo || '',
      activo: true,
      motivo_baja: null,
      fecha_baja: null,
      fecha_creacion: new Date()
    };

    await db.collection('pacientes').insertOne(newDoc);
    institutionRouter.logQuery(
      this.institutionId,
      this.engineName,
      'db.pacientes.insertOne()',
      JSON.stringify(newDoc, null, 2),
      Date.now() - start
    );

    return new Patient({
      id: nextId,
      institutionId: this.institutionId,
      nombre: newDoc.nombre,
      apellido: newDoc.apellido,
      fechaNacimiento: newDoc.fecha_nacimiento,
      telefono: newDoc.telefono,
      correo: newDoc.correo,
      activo: true
    });
  }

  async updatePatient(id, patientData) {
    const db = await this.getDb();
    const start = Date.now();
    const numId = parseInt(id, 10);
    const filter = isNaN(numId) ? { id_paciente: id } : { id_paciente: numId };

    const updateFields = {};
    if (patientData.nombre) updateFields.nombre = patientData.nombre;
    if (patientData.apellido) updateFields.apellido = patientData.apellido;
    if (patientData.telefono) updateFields.telefono = patientData.telefono;
    if (patientData.correo) updateFields.correo = patientData.correo;

    await db.collection('pacientes').updateOne(filter, { $set: updateFields });
    institutionRouter.logQuery(this.institutionId, this.engineName, 'db.pacientes.updateOne()', JSON.stringify({ filter, updateFields }), Date.now() - start);

    return await this.findPatientById(id);
  }

  async deactivatePatient(id, motivo) {
    const db = await this.getDb();
    const start = Date.now();
    const numId = parseInt(id, 10);
    const filter = isNaN(numId) ? { id_paciente: id } : { id_paciente: numId };

    const updateDoc = {
      $set: {
        activo: false,
        motivo_baja: motivo,
        fecha_baja: new Date()
      }
    };

    await db.collection('pacientes').updateOne(filter, updateDoc);
    institutionRouter.logQuery(this.institutionId, this.engineName, 'db.pacientes.updateOne (Baja/Archivo)', JSON.stringify({ filter, updateDoc }), Date.now() - start);

    return await this.findPatientById(id);
  }

  async reactivatePatient(id) {
    const db = await this.getDb();
    const start = Date.now();
    const numId = parseInt(id, 10);
    const filter = isNaN(numId) ? { id_paciente: id } : { id_paciente: numId };

    const updateDoc = {
      $set: {
        activo: true,
        motivo_baja: null,
        fecha_baja: null
      }
    };

    await db.collection('pacientes').updateOne(filter, updateDoc);
    institutionRouter.logQuery(this.institutionId, this.engineName, 'db.pacientes.updateOne (Reactivar)', JSON.stringify({ filter, updateDoc }), Date.now() - start);

    return await this.findPatientById(id);
  }

  async getClinicalHistory(patientId) {
    const db = await this.getDb();
    const start = Date.now();
    const patient = await this.findPatientById(patientId);
    if (!patient) return null;

    const numId = parseInt(patientId, 10);
    const filter = isNaN(numId) ? { id_paciente: patientId } : { id_paciente: numId };

    // En MongoDB las órdenes son referenciadas por id_paciente,
    // y los resultados están embebidos dentro de cada orden.
    const ordenes = await db.collection('ordenes_examen')
      .find(filter)
      .sort({ fecha_solicitud: -1, id_orden: -1 })
      .toArray();

    institutionRouter.logQuery(
      this.institutionId,
      this.engineName,
      'db.ordenes_examen.find({ id_paciente })',
      JSON.stringify(filter),
      Date.now() - start
    );

    // Mapear al modelo común de consultas / diagnósticos para la interfaz unificada
    const consultas = ordenes.map(orden => ({
      id: orden.id_orden,
      fecha: orden.fecha_solicitud,
      hora: '08:00',
      motivo: orden.motivo || `Orden de Examen: ${orden.tipo_examen?.nombre_examen || 'Laboratorio'}`,
      estado: orden.estado,
      profesional: 'Lic. Marco Tulio Peña (Químico Biólogo)',
      colegiado: 'COL-QB-8834',
      tipoExamen: orden.tipo_examen?.nombre_examen,
      resultadosExamen: orden.resultados || [],
      diagnosticos: [
        {
          id: orden.id_orden,
          descripcion: orden.diagnostico || 'Evaluación analítica completada',
          codigoReferencia: `LAB-${orden.tipo_examen?.id_tipo_examen || '01'}`,
          gravedad: 'Moderada',
          fecha: orden.fecha_resultado || orden.fecha_solicitud,
          tratamientos: orden.tratamiento ? [
            {
              id: orden.id_orden,
              medicamento: orden.tratamiento,
              dosis: 'Según criterio médico',
              frecuencia: 'Continuo'
            }
          ] : []
        }
      ]
    }));

    return {
      paciente: patient,
      consultas,
      totalConsultas: consultas.length,
      motor: this.engineName,
      garantiaConsistencia: 'Atomicidad por documento individual y colecciones referenciadas con resultados embebidos en MongoDB.'
    };
  }

  async recordMedicalEvent(eventData) {
    const db = await this.getDb();
    const start = Date.now();

    const last = await db.collection('ordenes_examen').find().sort({ id_orden: -1 }).limit(1).toArray();
    const nextId = (last[0]?.id_orden || 0) + 1;

    const numPacienteId = parseInt(eventData.patientId, 10);
    const patientId = isNaN(numPacienteId) ? eventData.patientId : numPacienteId;

    // Construcción de resultados embebidos
    let resultados = [];
    if (eventData.resultados && Array.isArray(eventData.resultados)) {
      resultados = eventData.resultados;
    } else if (eventData.parametroNombre && eventData.parametroValor) {
      resultados.push({
        parametro: eventData.parametroNombre,
        unidad_medida: eventData.parametroUnidad || '',
        valor_referencia: eventData.parametroReferencia || 'Normal',
        valor_obtenido: eventData.parametroValor
      });
    } else {
      // Parámetros por defecto según el tipo de examen indicado
      resultados = [
        { parametro: 'Resultado Primario', unidad_medida: 'Indice', valor_referencia: 'Normal', valor_obtenido: eventData.resultadoObtenido || 'Analizado' }
      ];
    }

    const nuevaOrden = {
      id_orden: nextId,
      id_paciente: patientId,
      fecha_solicitud: eventData.fecha || new Date().toISOString().split('T')[0],
      fecha_resultado: new Date().toISOString().split('T')[0],
      estado: 'finalizado',
      tipo_examen: {
        id_tipo_examen: eventData.tipoExamenId || 1,
        nombre_examen: eventData.tipoExamenNombre || eventData.motivo || 'Análisis Clínico'
      },
      motivo: eventData.motivo,
      diagnostico: eventData.diagnosticoDescripcion,
      tratamiento: eventData.medicamento || eventData.tratamiento || null,
      resultados: resultados,
      fecha_registro: new Date()
    };

    await db.collection('ordenes_examen').insertOne(nuevaOrden);

    institutionRouter.logQuery(
      this.institutionId,
      this.engineName,
      'db.ordenes_examen.insertOne()',
      JSON.stringify(nuevaOrden, null, 2),
      Date.now() - start
    );

    return {
      success: true,
      ordenId: nextId,
      tipoExamen: nuevaOrden.tipo_examen.nombre_examen,
      totalParametros: resultados.length,
      message: 'Orden de laboratorio y resultados embebidos registrados con atomicidad de documento en MongoDB.'
    };
  }

  async getInstitutionStats() {
    const db = await this.getDb();
    const totalPacientes = await db.collection('pacientes').countDocuments();
    const pacientesActivos = await db.collection('pacientes').countDocuments({ activo: true });
    const pacientesArchivados = await db.collection('pacientes').countDocuments({ activo: false });
    const totalOrdenes = await db.collection('ordenes_examen').countDocuments();
    const catalogoExamenes = await db.collection('catalogo_examenes').countDocuments();

    return {
      totalPacientes,
      pacientesActivos,
      pacientesArchivados,
      totalConsultas: totalOrdenes,
      totalExamenesCatalogo: catalogoExamenes,
      totalOrdenesProcesadas: totalOrdenes
    };
  }
}

module.exports = MongoAdapter;
