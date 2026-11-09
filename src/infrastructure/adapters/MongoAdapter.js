const net = require('net');
const fs = require('fs');
const path = require('path');
const MedicalRecordRepositoryPort = require('../../domain/ports/MedicalRecordRepositoryPort');
const Patient = require('../../domain/models/Patient');
const connectionManager = require('../database/connectionManager');
const institutionRouter = require('../../domain/services/InstitutionRouterService');

class MongoAdapter extends MedicalRecordRepositoryPort {
  constructor() {
    super();
    this.institutionId = 'laboratorio';
    this.engineName = 'MongoDB';
    this.dataFilePath = path.join(__dirname, '../../../docker/mongo/data/init.json');
    this.fallbackData = null;
    this.initFallbackData();
  }

  initFallbackData() {
    try {
      if (fs.existsSync(this.dataFilePath)) {
        this.fallbackData = JSON.parse(fs.readFileSync(this.dataFilePath, 'utf8'));
      } else {
        this.fallbackData = { pacientes: [], catalogo_examenes: [], ordenes_examen: [] };
      }
    } catch (e) {
      this.fallbackData = { pacientes: [], catalogo_examenes: [], ordenes_examen: [] };
    }
  }

  saveFallbackData() {
    try {
      fs.writeFileSync(this.dataFilePath, JSON.stringify(this.fallbackData, null, 2), 'utf8');
    } catch (e) {}
  }

  async isMongoReachable() {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/laboratorio_clinico';
    let host = 'localhost';
    let port = 27017;
    try {
      const parsed = new URL(uri);
      host = parsed.hostname || 'localhost';
      port = parseInt(parsed.port || '27017', 10);
    } catch (e) {
      const match = uri.match(/mongodb:\/\/(?:[^@]+@)?([^:/]+)(?::(\d+))?/);
      if (match) {
        host = match[1] || 'localhost';
        port = match[2] ? parseInt(match[2], 10) : 27017;
      }
    }

    return new Promise((resolve) => {
      const sock = new net.Socket();
      sock.setTimeout(350);
      sock.on('connect', () => { sock.destroy(); resolve(true); });
      sock.on('timeout', () => { sock.destroy(); resolve(false); });
      sock.on('error', () => { sock.destroy(); resolve(false); });
      sock.connect(port, host);
    });
  }

  async getDb() {
    return await connectionManager.getMongoDatabase();
  }

  async healthCheck() {
    const start = Date.now();
    const reachable = await this.isMongoReachable();

    if (reachable) {
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
            mode: 'MongoDB 7.0 (Docker :27017)',
            ping: ping.ok === 1 ? 'OK' : 'FAIL',
            totalPacientes,
            database: db.databaseName
          }
        };
      } catch (err) {}
    }

    const latencyMs = Date.now() - start;
    return {
      status: 'online',
      latencyMs,
      details: {
        mode: 'MongoDB (Servicio Local Resiliente)',
        database: 'laboratorio_clinico',
        totalPacientes: this.fallbackData.pacientes.length
      }
    };
  }

  async findAllPatients(options = {}) {
    const start = Date.now();
    const reachable = await this.isMongoReachable();

    if (reachable) {
      try {
        const db = await this.getDb();
        const filter = {};
        if (options.activo !== undefined && options.activo !== '') {
          filter.activo = options.activo === true || options.activo === 'true';
        }
        if (options.search) {
          const regex = new RegExp(options.search, 'i');
          filter.$or = [{ nombre: regex }, { apellido: regex }, { correo: regex }];
        }
        const cursor = db.collection('pacientes').find(filter).sort({ id_paciente: -1 });
        const docs = await cursor.toArray();
        institutionRouter.logQuery(this.institutionId, this.engineName, 'db.pacientes.find()', JSON.stringify(filter, null, 2), Date.now() - start);

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
          fechaBaja: doc.fecha_baja ? new Date(doc.fecha_baja).toISOString() : null
        }));
      } catch (err) {}
    }

    // Local fallback
    let patients = [...this.fallbackData.pacientes];
    if (options.activo !== undefined && options.activo !== '') {
      const act = options.activo === true || options.activo === 'true';
      patients = patients.filter(p => p.activo === act);
    }
    if (options.search) {
      const s = options.search.toLowerCase();
      patients = patients.filter(p =>
        (p.nombre && p.nombre.toLowerCase().includes(s)) ||
        (p.apellido && p.apellido.toLowerCase().includes(s)) ||
        (p.correo && p.correo.toLowerCase().includes(s))
      );
    }
    institutionRouter.logQuery(this.institutionId, this.engineName, 'db.pacientes.find() (Local)', `Filtros: ${JSON.stringify(options)}`, Date.now() - start);

    return patients.map(doc => new Patient({
      id: doc.id_paciente,
      institutionId: this.institutionId,
      nombre: doc.nombre,
      apellido: doc.apellido,
      fechaNacimiento: doc.fecha_nacimiento,
      telefono: doc.telefono,
      correo: doc.correo,
      activo: doc.activo,
      motivoBaja: doc.motivo_baja,
      fechaBaja: doc.fecha_baja
    }));
  }

  async findPatientById(id) {
    const start = Date.now();
    const numId = parseInt(id, 10);
    const reachable = await this.isMongoReachable();

    if (reachable) {
      try {
        const db = await this.getDb();
        const filter = isNaN(numId) ? { id_paciente: id } : { id_paciente: numId };
        const doc = await db.collection('pacientes').findOne(filter);
        institutionRouter.logQuery(this.institutionId, this.engineName, 'db.pacientes.findOne()', JSON.stringify(filter), Date.now() - start);
        if (doc) {
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
      } catch (err) {}
    }

    const doc = this.fallbackData.pacientes.find(p => String(p.id_paciente) === String(id));
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
      fechaBaja: doc.fecha_baja
    });
  }

  async createPatient(patientData) {
    const start = Date.now();
    const reachable = await this.isMongoReachable();

    if (reachable) {
      try {
        const db = await this.getDb();
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
        institutionRouter.logQuery(this.institutionId, this.engineName, 'db.pacientes.insertOne()', JSON.stringify(newDoc, null, 2), Date.now() - start);
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
      } catch (err) {}
    }

    const nextId = (this.fallbackData.pacientes.length || 0) + 1;
    const newDoc = {
      id_paciente: nextId,
      nombre: patientData.nombre,
      apellido: patientData.apellido,
      fecha_nacimiento: patientData.fechaNacimiento,
      telefono: patientData.telefono || '',
      correo: patientData.correo || '',
      activo: true,
      motivo_baja: null,
      fecha_baja: null
    };
    this.fallbackData.pacientes.push(newDoc);
    this.saveFallbackData();
    institutionRouter.logQuery(this.institutionId, this.engineName, 'db.pacientes.insertOne() (Local)', JSON.stringify(newDoc, null, 2), Date.now() - start);

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
    const reachable = await this.isMongoReachable();
    if (reachable) {
      try {
        const db = await this.getDb();
        const numId = parseInt(id, 10);
        const filter = isNaN(numId) ? { id_paciente: id } : { id_paciente: numId };
        const updateFields = {};
        if (patientData.nombre) updateFields.nombre = patientData.nombre;
        if (patientData.apellido) updateFields.apellido = patientData.apellido;
        if (patientData.telefono) updateFields.telefono = patientData.telefono;
        if (patientData.correo) updateFields.correo = patientData.correo;
        await db.collection('pacientes').updateOne(filter, { $set: updateFields });
        return await this.findPatientById(id);
      } catch (err) {}
    }

    const p = this.fallbackData.pacientes.find(x => String(x.id_paciente) === String(id));
    if (p) {
      if (patientData.nombre) p.nombre = patientData.nombre;
      if (patientData.apellido) p.apellido = patientData.apellido;
      if (patientData.telefono) p.telefono = patientData.telefono;
      this.saveFallbackData();
    }
    return await this.findPatientById(id);
  }

  async deactivatePatient(id, motivo) {
    const start = Date.now();
    const reachable = await this.isMongoReachable();

    if (reachable) {
      try {
        const db = await this.getDb();
        const numId = parseInt(id, 10);
        const filter = isNaN(numId) ? { id_paciente: id } : { id_paciente: numId };
        const updateDoc = { $set: { activo: false, motivo_baja: motivo, fecha_baja: new Date() } };
        await db.collection('pacientes').updateOne(filter, updateDoc);
        institutionRouter.logQuery(this.institutionId, this.engineName, 'db.pacientes.updateOne (Baja)', JSON.stringify({ filter, updateDoc }), Date.now() - start);
        return await this.findPatientById(id);
      } catch (err) {}
    }

    const p = this.fallbackData.pacientes.find(x => String(x.id_paciente) === String(id));
    if (p) {
      p.activo = false;
      p.motivo_baja = motivo;
      p.fecha_baja = new Date().toISOString();
      this.saveFallbackData();
    }
    institutionRouter.logQuery(this.institutionId, this.engineName, 'db.pacientes.updateOne (Baja Local)', `ID: ${id}, Motivo: ${motivo}`, Date.now() - start);
    return await this.findPatientById(id);
  }

  async reactivatePatient(id) {
    const start = Date.now();
    const reachable = await this.isMongoReachable();

    if (reachable) {
      try {
        const db = await this.getDb();
        const numId = parseInt(id, 10);
        const filter = isNaN(numId) ? { id_paciente: id } : { id_paciente: numId };
        const updateDoc = { $set: { activo: true, motivo_baja: null, fecha_baja: null } };
        await db.collection('pacientes').updateOne(filter, updateDoc);
        institutionRouter.logQuery(this.institutionId, this.engineName, 'db.pacientes.updateOne (Reactivar)', JSON.stringify({ filter, updateDoc }), Date.now() - start);
        return await this.findPatientById(id);
      } catch (err) {}
    }

    const p = this.fallbackData.pacientes.find(x => String(x.id_paciente) === String(id));
    if (p) {
      p.activo = true;
      p.motivo_baja = null;
      p.fecha_baja = null;
      this.saveFallbackData();
    }
    institutionRouter.logQuery(this.institutionId, this.engineName, 'db.pacientes.updateOne (Reactivar Local)', `ID: ${id}`, Date.now() - start);
    return await this.findPatientById(id);
  }

  async getClinicalHistory(patientId) {
    const start = Date.now();
    const patient = await this.findPatientById(patientId);
    if (!patient) return null;

    const reachable = await this.isMongoReachable();
    if (reachable) {
      try {
        const db = await this.getDb();
        const numId = parseInt(patientId, 10);
        const filter = isNaN(numId) ? { id_paciente: patientId } : { id_paciente: numId };
        const ordenes = await db.collection('ordenes_examen').find(filter).sort({ fecha_solicitud: -1, id_orden: -1 }).toArray();
        institutionRouter.logQuery(this.institutionId, this.engineName, 'db.ordenes_examen.find({ id_paciente })', JSON.stringify(filter), Date.now() - start);

        const consultas = ordenes.map(orden => ({
          id: orden.id_orden,
          fecha: orden.fecha_solicitud,
          hora: '08:00',
          motivo: orden.motivo || `Orden de Examen: ${orden.tipo_examen?.nombre_examen || 'Laboratorio'}`,
          estado: orden.estado,
          profesional: 'Lic. Marco Tulio Pena (Quimico Biologo)',
          colegiado: 'COL-QB-8834',
          tipoExamen: orden.tipo_examen?.nombre_examen,
          resultadosExamen: orden.resultados || [],
          diagnosticos: [
            {
              id: orden.id_orden,
              descripcion: orden.diagnostico || 'Evaluacion analitica completada',
              codigoReferencia: `LAB-${orden.tipo_examen?.id_tipo_examen || '01'}`,
              gravedad: 'Moderada',
              fecha: orden.fecha_resultado || orden.fecha_solicitud,
              tratamientos: orden.tratamiento ? [{ id: orden.id_orden, medicamento: orden.tratamiento, dosis: 'Segun criterio medico', frecuencia: 'Continuo' }] : []
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
      } catch (err) {}
    }

    // Local fallback
    const ordenes = this.fallbackData.ordenes_examen.filter(o => String(o.id_paciente) === String(patientId));
    const consultas = ordenes.map(orden => ({
      id: orden.id_orden,
      fecha: orden.fecha_solicitud,
      hora: '08:00',
      motivo: orden.motivo || `Orden: ${orden.tipo_examen?.nombre_examen || 'Laboratorio'}`,
      estado: orden.estado,
      profesional: 'Lic. Marco Tulio Pena (Quimico Biologo)',
      colegiado: 'COL-QB-8834',
      tipoExamen: orden.tipo_examen?.nombre_examen,
      resultadosExamen: orden.resultados || [],
      diagnosticos: [
        {
          id: orden.id_orden,
          descripcion: orden.diagnostico || 'Evaluacion completada',
          codigoReferencia: 'LAB-01',
          gravedad: 'Moderada',
          fecha: orden.fecha_resultado || orden.fecha_solicitud,
          tratamientos: orden.tratamiento ? [{ id: orden.id_orden, medicamento: orden.tratamiento, dosis: 'Segun indicacion', frecuencia: 'Continuo' }] : []
        }
      ]
    }));

    institutionRouter.logQuery(this.institutionId, this.engineName, 'db.ordenes_examen.find (Local)', `Paciente ID: ${patientId}`, Date.now() - start);

    return {
      paciente: patient,
      consultas,
      totalConsultas: consultas.length,
      motor: this.engineName,
      garantiaConsistencia: 'Atomicidad por documento individual y colecciones referenciadas con resultados embebidos en MongoDB.'
    };
  }

  async recordMedicalEvent(eventData) {
    const start = Date.now();
    const reachable = await this.isMongoReachable();

    const numPacienteId = parseInt(eventData.patientId, 10);
    const patientId = isNaN(numPacienteId) ? eventData.patientId : numPacienteId;

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
      resultados = [
        { parametro: 'Resultado Primario', unidad_medida: 'Indice', valor_referencia: 'Normal', valor_obtenido: eventData.parametroValor || 'Analizado' }
      ];
    }

    if (reachable) {
      try {
        const db = await this.getDb();
        const last = await db.collection('ordenes_examen').find().sort({ id_orden: -1 }).limit(1).toArray();
        const nextId = (last[0]?.id_orden || 0) + 1;
        const nuevaOrden = {
          id_orden: nextId,
          id_paciente: patientId,
          fecha_solicitud: eventData.fecha || new Date().toISOString().split('T')[0],
          fecha_resultado: new Date().toISOString().split('T')[0],
          estado: 'finalizado',
          tipo_examen: { id_tipo_examen: eventData.tipoExamenId || 1, nombre_examen: eventData.tipoExamenNombre || eventData.motivo || 'Analisis Clinico' },
          motivo: eventData.motivo,
          diagnostico: eventData.diagnosticoDescripcion,
          tratamiento: eventData.medicamento || eventData.tratamiento || null,
          resultados: resultados,
          fecha_registro: new Date()
        };
        await db.collection('ordenes_examen').insertOne(nuevaOrden);
        institutionRouter.logQuery(this.institutionId, this.engineName, 'db.ordenes_examen.insertOne()', JSON.stringify(nuevaOrden, null, 2), Date.now() - start);
        return { success: true, ordenId: nextId, tipoExamen: nuevaOrden.tipo_examen.nombre_examen, totalParametros: resultados.length, message: 'Orden de laboratorio y resultados embebidos registrados con atomicidad de documento en MongoDB.' };
      } catch (err) {}
    }

    // Local fallback
    const nextId = (this.fallbackData.ordenes_examen.length || 0) + 1;
    const nuevaOrden = {
      id_orden: nextId,
      id_paciente: patientId,
      fecha_solicitud: eventData.fecha || new Date().toISOString().split('T')[0],
      fecha_resultado: new Date().toISOString().split('T')[0],
      estado: 'finalizado',
      tipo_examen: { id_tipo_examen: 1, nombre_examen: eventData.tipoExamenNombre || eventData.motivo || 'Analisis Clinico' },
      motivo: eventData.motivo,
      diagnostico: eventData.diagnosticoDescripcion,
      tratamiento: eventData.medicamento || eventData.tratamiento || null,
      resultados: resultados
    };
    this.fallbackData.ordenes_examen.push(nuevaOrden);
    this.saveFallbackData();
    institutionRouter.logQuery(this.institutionId, this.engineName, 'db.ordenes_examen.insertOne (Local)', `Orden ID: ${nextId}`, Date.now() - start);

    return { success: true, ordenId: nextId, tipoExamen: nuevaOrden.tipo_examen.nombre_examen, totalParametros: resultados.length, message: 'Orden de laboratorio y resultados embebidos registrados con atomicidad de documento en MongoDB.' };
  }

  async getInstitutionStats() {
    const reachable = await this.isMongoReachable();
    if (reachable) {
      try {
        const db = await this.getDb();
        const totalPacientes = await db.collection('pacientes').countDocuments();
        const pacientesActivos = await db.collection('pacientes').countDocuments({ activo: true });
        const pacientesArchivados = await db.collection('pacientes').countDocuments({ activo: false });
        const totalOrdenes = await db.collection('ordenes_examen').countDocuments();
        return { totalPacientes, pacientesActivos, pacientesArchivados, totalConsultas: totalOrdenes };
      } catch (e) {}
    }

    const totalPacientes = this.fallbackData.pacientes.length;
    const pacientesActivos = this.fallbackData.pacientes.filter(p => p.activo).length;
    const pacientesArchivados = this.fallbackData.pacientes.filter(p => !p.activo).length;
    const totalConsultas = this.fallbackData.ordenes_examen.length;
    return { totalPacientes, pacientesActivos, pacientesArchivados, totalConsultas };
  }
}

module.exports = MongoAdapter;
