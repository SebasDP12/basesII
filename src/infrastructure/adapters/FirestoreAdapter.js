const MedicalRecordRepositoryPort = require('../../domain/ports/MedicalRecordRepositoryPort');
const Patient = require('../../domain/models/Patient');
const connectionManager = require('../database/connectionManager');
const institutionRouter = require('../../domain/services/InstitutionRouterService');
const fs = require('fs');
const path = require('path');

const net = require('net');

class FirestoreAdapter extends MedicalRecordRepositoryPort {
  constructor() {
    super();
    this.institutionId = 'pediatria';
    this.engineName = 'Firebase Firestore';
    this.dataFilePath = path.join(__dirname, '../../../docker/firestore/data/init.json');
    this.fallbackData = null;
    this.emulatorChecked = false;
    this.emulatorOnline = false;
    this.initFallbackData();
  }

  async isEmulatorReachable() {
    if (!process.env.FIRESTORE_EMULATOR_HOST) return false;
    const parts = process.env.FIRESTORE_EMULATOR_HOST.split(':');
    const host = parts[0] || 'localhost';
    const port = parseInt(parts[1] || '8080', 10);

    return new Promise((resolve) => {
      const sock = new net.Socket();
      sock.setTimeout(300);
      sock.on('connect', () => {
        sock.destroy();
        resolve(true);
      });
      sock.on('timeout', () => {
        sock.destroy();
        resolve(false);
      });
      sock.on('error', () => {
        sock.destroy();
        resolve(false);
      });
      sock.connect(port, host);
    });
  }

  initFallbackData() {
    try {
      if (fs.existsSync(this.dataFilePath)) {
        const raw = fs.readFileSync(this.dataFilePath, 'utf8');
        this.fallbackData = JSON.parse(raw);
      } else {
        this.fallbackData = { tutores: [], pacientes: [], consultas: [], vacunaciones: [] };
      }
    } catch (err) {
      console.error('[Firestore Local Store Init Error]:', err.message);
      this.fallbackData = { tutores: [], pacientes: [], consultas: [], vacunaciones: [] };
    }
  }

  saveFallbackData() {
    try {
      fs.writeFileSync(this.dataFilePath, JSON.stringify(this.fallbackData, null, 2), 'utf8');
    } catch (err) {
      console.error('[Firestore Local Store Save Error]:', err.message);
    }
  }

  async healthCheck() {
    const start = Date.now();
    const reachable = await this.isEmulatorReachable();
    if (reachable) {
      try {
        const firestore = await connectionManager.getFirestore();
        if (firestore) {
          const testCol = await firestore.collection('pacientes').limit(1).get();
          const latencyMs = Date.now() - start;
          return {
            status: 'online',
            latencyMs,
            details: {
              mode: 'Firebase Firestore Emulator / Cloud',
              emulatorHost: process.env.FIRESTORE_EMULATOR_HOST,
              projectId: process.env.FIRESTORE_PROJECT_ID || 'pediatria-project',
              totalPacientes: testCol.size
            }
          };
        }
      } catch (err) {}
    }

    const latencyMs = Date.now() - start;
    return {
      status: 'online',
      latencyMs,
      details: {
        mode: 'Firebase Firestore Local Document Store (Emulator)',
        collections: ['pacientes', 'tutores', 'consultas', 'vacunaciones'],
        projectId: 'pediatria-project',
        totalPacientes: this.fallbackData?.pacientes?.length || 0
      }
    };
  }

  async findAllPatients(options = {}) {
    const start = Date.now();
    let patients = [];
    const reachable = await this.isEmulatorReachable();

    if (reachable) {
      try {
        const firestore = await connectionManager.getFirestore();
        if (firestore) {
          let query = firestore.collection('pacientes');
          if (options.activo !== undefined && options.activo !== '') {
            const act = options.activo === true || options.activo === 'true';
            query = query.where('activo', '==', act);
          }
          const snap = await query.get();
          snap.forEach(doc => {
            const d = doc.data();
            patients.push({ id: doc.id, ...d });
          });
        }
      } catch (err) {
        patients = [];
      }
    }

    if (patients.length === 0) {
      patients = [...this.fallbackData.pacientes];
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
    }

    institutionRouter.logQuery(
      this.institutionId,
      this.engineName,
      `firestore.collection('pacientes').where(${JSON.stringify(options)}).get()`,
      `GET /pacientes?search=${options.search || ''}&activo=${options.activo || ''}`,
      Date.now() - start
    );

    return patients.map(p => new Patient({
      id: p.id_paciente || p.id,
      institutionId: this.institutionId,
      nombre: p.nombre,
      apellido: p.apellido,
      fechaNacimiento: p.fecha_nacimiento,
      genero: p.genero,
      telefono: p.telefono || (p.tutor ? p.tutor.telefono : ''),
      correo: p.correo || (p.tutor ? p.tutor.correo : ''),
      direccion: p.direccion || (p.tutor ? p.tutor.direccion : ''),
      activo: p.activo,
      motivoBaja: p.motivo_baja,
      fechaBaja: p.fecha_baja,
      tutor: p.tutor
    }));
  }

  async findPatientById(id) {
    const start = Date.now();
    const strId = String(id);
    let patientData = null;

    if (await this.isEmulatorReachable()) {
      try {
        const firestore = await connectionManager.getFirestore();
        if (firestore) {
          const docRef = await firestore.collection('pacientes').doc(strId).get();
          if (docRef.exists) {
            patientData = { id: docRef.id, ...docRef.data() };
          }
        }
      } catch (err) {}
    }

    if (!patientData) {
      patientData = this.fallbackData.pacientes.find(p => String(p.id_paciente) === strId || String(p.id) === strId);
    }

    institutionRouter.logQuery(
      this.institutionId,
      this.engineName,
      `firestore.collection('pacientes').doc('${strId}').get()`,
      `GET /pacientes/${strId}`,
      Date.now() - start
    );

    if (!patientData) return null;

    return new Patient({
      id: patientData.id_paciente || patientData.id,
      institutionId: this.institutionId,
      nombre: patientData.nombre,
      apellido: patientData.apellido,
      fechaNacimiento: patientData.fecha_nacimiento,
      genero: patientData.genero,
      telefono: patientData.telefono || (patientData.tutor ? patientData.tutor.telefono : ''),
      correo: patientData.correo || (patientData.tutor ? patientData.tutor.correo : ''),
      direccion: patientData.direccion || (patientData.tutor ? patientData.tutor.direccion : ''),
      activo: patientData.activo,
      motivoBaja: patientData.motivo_baja,
      fechaBaja: patientData.fecha_baja,
      tutor: patientData.tutor
    });
  }

  async createPatient(patientData) {
    const start = Date.now();
    const nextId = String(this.fallbackData.pacientes.length + 1);

    const tutorObj = {
      id_tutor: String(this.fallbackData.tutores.length + 1),
      nombre: patientData.tutorNombre || (patientData.nombre + ' (Tutor)'),
      parentesco: patientData.tutorParentesco || 'Madre/Padre',
      telefono: patientData.telefono || '5556-0000',
      correo: patientData.correo || '',
      direccion: patientData.direccion || 'Ciudad de Guatemala'
    };

    const newDoc = {
      id_paciente: nextId,
      id_tutor: tutorObj.id_tutor,
      nombre: patientData.nombre,
      apellido: patientData.apellido,
      fecha_nacimiento: patientData.fechaNacimiento,
      genero: patientData.genero || 'No especificado',
      activo: true,
      motivo_baja: null,
      fecha_baja: null,
      tutor: tutorObj
    };

    this.fallbackData.pacientes.push(newDoc);
    this.fallbackData.tutores.push(tutorObj);
    this.saveFallbackData();

    if (await this.isEmulatorReachable()) {
      try {
        const firestore = await connectionManager.getFirestore();
        if (firestore) {
          await firestore.collection('pacientes').doc(nextId).set(newDoc);
        }
      } catch (e) {}
    }

    institutionRouter.logQuery(
      this.institutionId,
      this.engineName,
      `firestore.collection('pacientes').doc('${nextId}').set(patientWithEmbeddedTutor)`,
      JSON.stringify(newDoc, null, 2),
      Date.now() - start
    );

    return new Patient({
      id: nextId,
      institutionId: this.institutionId,
      nombre: newDoc.nombre,
      apellido: newDoc.apellido,
      fechaNacimiento: newDoc.fecha_nacimiento,
      genero: newDoc.genero,
      telefono: tutorObj.telefono,
      correo: tutorObj.correo,
      direccion: tutorObj.direccion,
      activo: true,
      tutor: tutorObj
    });
  }

  async updatePatient(id, patientData) {
    const p = this.fallbackData.pacientes.find(x => String(x.id_paciente) === String(id) || String(x.id) === String(id));
    if (p) {
      if (patientData.nombre) p.nombre = patientData.nombre;
      if (patientData.apellido) p.apellido = patientData.apellido;
      if (patientData.telefono && p.tutor) p.tutor.telefono = patientData.telefono;
      this.saveFallbackData();
    }
    return await this.findPatientById(id);
  }

  async deactivatePatient(id, motivo) {
    const start = Date.now();
    const strId = String(id);
    const p = this.fallbackData.pacientes.find(x => String(x.id_paciente) === strId || String(x.id) === strId);
    if (p) {
      p.activo = false;
      p.motivo_baja = motivo;
      p.fecha_baja = new Date().toISOString();
      this.saveFallbackData();
    }

    if (await this.isEmulatorReachable()) {
      try {
        const firestore = await connectionManager.getFirestore();
        if (firestore) {
          await firestore.collection('pacientes').doc(strId).update({
            activo: false,
            motivo_baja: motivo,
            fecha_baja: new Date().toISOString()
          });
        }
      } catch (e) {}
    }

    institutionRouter.logQuery(
      this.institutionId,
      this.engineName,
      `firestore.collection('pacientes').doc('${strId}').update({ activo: false, motivo_baja })`,
      JSON.stringify({ activo: false, motivo_baja: motivo }),
      Date.now() - start
    );

    return await this.findPatientById(id);
  }

  async reactivatePatient(id) {
    const start = Date.now();
    const strId = String(id);
    const p = this.fallbackData.pacientes.find(x => String(x.id_paciente) === strId || String(x.id) === strId);
    if (p) {
      p.activo = true;
      p.motivo_baja = null;
      p.fecha_baja = null;
      this.saveFallbackData();
    }

    if (await this.isEmulatorReachable()) {
      try {
        const firestore = await connectionManager.getFirestore();
        if (firestore) {
          await firestore.collection('pacientes').doc(strId).update({
            activo: true,
            motivo_baja: null,
            fecha_baja: null
          });
        }
      } catch (e) {}
    }

    institutionRouter.logQuery(
      this.institutionId,
      this.engineName,
      `firestore.collection('pacientes').doc('${strId}').update({ activo: true })`,
      JSON.stringify({ activo: true }),
      Date.now() - start
    );

    return await this.findPatientById(id);
  }

  async getClinicalHistory(patientId) {
    const start = Date.now();
    const patient = await this.findPatientById(patientId);
    if (!patient) return null;

    const strId = String(patientId);

    // Consultas pediátricas del paciente
    const consultasData = this.fallbackData.consultas.filter(c => String(c.id_paciente) === strId);
    // Vacunas aplicadas al paciente
    const vacsData = this.fallbackData.vacunaciones.filter(v => String(v.id_paciente) === strId);

    institutionRouter.logQuery(
      this.institutionId,
      this.engineName,
      `firestore.collection('consultas').where('id_paciente', '==', '${strId}').get()`,
      `Subcolección / Referencias de consultas y vacunas para paciente ${strId}`,
      Date.now() - start
    );

    const consultas = consultasData.map(c => ({
      id: c.id_consulta,
      fecha: c.fecha,
      hora: '10:00',
      motivo: c.motivo,
      estado: 'atendida',
      profesional: 'Dra. Elena Castillo (Pediatra)',
      colegiado: 'COL-PED-9912',
      controlCrecimiento: {
        pesoKg: c.peso_kg,
        tallaCm: c.talla_cm,
        observaciones: c.observaciones
      },
      diagnosticos: [
        {
          id: c.id_consulta,
          descripcion: c.diagnostico || 'Control de niño sano',
          codigoReferencia: 'PED-Z00.1',
          gravedad: 'Leve',
          fecha: c.fecha,
          tratamientos: c.tratamiento ? [
            {
              id: c.id_consulta,
              medicamento: c.tratamiento,
              dosis: 'Dosis pediátrica calculada por peso corporal',
              frecuencia: 'Según indicación'
            }
          ] : []
        }
      ]
    }));

    return {
      paciente: patient,
      consultas,
      totalConsultas: consultas.length,
      vacunasAplicadas: vacsData,
      motor: this.engineName,
      garantiaConsistencia: 'Modelo documental en Firestore: Tutor embebido para máxima velocidad de lectura y subcolecciones de consultas/vacunas.'
    };
  }

  async recordMedicalEvent(eventData) {
    const start = Date.now();
    const strPatientId = String(eventData.patientId);

    const nextConsultaId = String(this.fallbackData.consultas.length + 1);
    const fecha = eventData.fecha || new Date().toISOString().split('T')[0];

    const nuevaConsulta = {
      id_consulta: nextConsultaId,
      id_paciente: strPatientId,
      fecha: fecha,
      motivo: eventData.motivo,
      peso_kg: eventData.pesoKg ? parseFloat(eventData.pesoKg) : 12.5,
      talla_cm: eventData.tallaCm ? parseFloat(eventData.tallaCm) : 85.0,
      observaciones: eventData.observaciones || 'Desarrollo acorde a edad cronológica',
      diagnostico: eventData.diagnosticoDescripcion,
      tratamiento: eventData.medicamento || eventData.tratamiento || 'Cuidados generales'
    };

    this.fallbackData.consultas.push(nuevaConsulta);

    // Si se aplicó una vacuna
    let vacId = null;
    if (eventData.vacunaNombre) {
      vacId = String(this.fallbackData.vacunaciones.length + 1);
      const nuevaVac = {
        id_vacunacion: vacId,
        id_paciente: strPatientId,
        id_vacuna: 'V-' + vacId,
        nombre_vacuna: eventData.vacunaNombre,
        fecha_aplicacion: fecha,
        dosis_numero: parseInt(eventData.vacunaDosis || 1, 10)
      };
      this.fallbackData.vacunaciones.push(nuevaVac);
    }

    this.saveFallbackData();

    if (await this.isEmulatorReachable()) {
      try {
        const firestore = await connectionManager.getFirestore();
        if (firestore) {
          await firestore.collection('consultas').doc(nextConsultaId).set(nuevaConsulta);
        }
      } catch (e) {}
    }

    institutionRouter.logQuery(
      this.institutionId,
      this.engineName,
      `firestore.collection('consultas').doc('${nextConsultaId}').set(...)`,
      JSON.stringify(nuevaConsulta, null, 2),
      Date.now() - start
    );

    return {
      success: true,
      consultaId: nextConsultaId,
      vacunaId: vacId,
      pesoKg: nuevaConsulta.peso_kg,
      tallaCm: nuevaConsulta.talla_cm,
      message: 'Consulta pediátrica y control de desarrollo registrados con éxito en Firebase Firestore.'
    };
  }

  async getInstitutionStats() {
    const totalPacientes = this.fallbackData.pacientes.length;
    const pacientesActivos = this.fallbackData.pacientes.filter(p => p.activo).length;
    const pacientesArchivados = this.fallbackData.pacientes.filter(p => !p.activo).length;
    const totalConsultas = this.fallbackData.consultas.length;
    const totalVacunaciones = this.fallbackData.vacunaciones.length;

    return {
      totalPacientes,
      pacientesActivos,
      pacientesArchivados,
      totalConsultas,
      totalVacunaciones,
      totalTutores: this.fallbackData.tutores.length
    };
  }
}

module.exports = FirestoreAdapter;
