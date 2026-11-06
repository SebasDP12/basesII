const MedicalRecordRepositoryPort = require('../../domain/ports/MedicalRecordRepositoryPort');
const Patient = require('../../domain/models/Patient');
const { Consultation, Diagnosis, Treatment } = require('../../domain/models/Consultation');
const connectionManager = require('../database/connectionManager');
const institutionRouter = require('../../domain/services/InstitutionRouterService');

class PostgresAdapter extends MedicalRecordRepositoryPort {
  constructor() {
    super();
    this.institutionId = 'hospital';
    this.engineName = 'PostgreSQL';
  }

  getPool() {
    return connectionManager.getPostgresPool();
  }

  async healthCheck() {
    const start = Date.now();
    try {
      const pool = this.getPool();
      const res = await pool.query('SELECT version(), NOW() as current_time, count(*) as total_pacientes FROM paciente_hospital');
      const latencyMs = Date.now() - start;
      return {
        status: 'online',
        latencyMs,
        details: {
          version: res.rows[0].version.split(' ')[0] + ' ' + res.rows[0].version.split(' ')[1],
          currentTime: res.rows[0].current_time,
          totalPacientes: parseInt(res.rows[0].total_pacientes, 10),
          database: process.env.POSTGRES_DB || 'hospital_general'
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
    const pool = this.getPool();
    const start = Date.now();
    let query = `
      SELECT id_paciente, nombre, apellido, fecha_nacimiento, genero, telefono, direccion, correo, tipo_sangre, activo, motivo_baja, fecha_baja
      FROM paciente_hospital
      WHERE 1=1
    `;
    const params = [];

    if (options.activo !== undefined && options.activo !== '') {
      params.push(options.activo === true || options.activo === 'true');
      query += ` AND activo = $${params.length}`;
    }

    if (options.search) {
      params.push(`%${options.search}%`);
      query += ` AND (nombre ILIKE $${params.length} OR apellido ILIKE $${params.length} OR correo ILIKE $${params.length})`;
    }

    query += ' ORDER BY id_paciente DESC';

    const res = await pool.query(query, params);
    institutionRouter.logQuery(this.institutionId, this.engineName, 'SELECT paciente_hospital', query, Date.now() - start);

    return res.rows.map(row => new Patient({
      id: row.id_paciente,
      institutionId: this.institutionId,
      nombre: row.nombre,
      apellido: row.apellido,
      fechaNacimiento: row.fecha_nacimiento ? row.fecha_nacimiento.toISOString().split('T')[0] : '',
      genero: row.genero,
      telefono: row.telefono,
      correo: row.correo,
      direccion: row.direccion,
      tipoSangre: row.tipo_sangre,
      activo: row.activo,
      motivoBaja: row.motivo_baja,
      fechaBaja: row.fecha_baja
    }));
  }

  async findPatientById(id) {
    const pool = this.getPool();
    const start = Date.now();
    const query = `
      SELECT id_paciente, nombre, apellido, fecha_nacimiento, genero, telefono, direccion, correo, tipo_sangre, activo, motivo_baja, fecha_baja
      FROM paciente_hospital
      WHERE id_paciente = $1
    `;
    const res = await pool.query(query, [id]);
    institutionRouter.logQuery(this.institutionId, this.engineName, 'SELECT paciente_hospital WHERE id', query, Date.now() - start);

    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return new Patient({
      id: row.id_paciente,
      institutionId: this.institutionId,
      nombre: row.nombre,
      apellido: row.apellido,
      fechaNacimiento: row.fecha_nacimiento ? row.fecha_nacimiento.toISOString().split('T')[0] : '',
      genero: row.genero,
      telefono: row.telefono,
      correo: row.correo,
      direccion: row.direccion,
      tipoSangre: row.tipo_sangre,
      activo: row.activo,
      motivoBaja: row.motivo_baja,
      fechaBaja: row.fecha_baja
    });
  }

  async createPatient(patientData) {
    const pool = this.getPool();
    const start = Date.now();
    const query = `
      INSERT INTO paciente_hospital (nombre, apellido, fecha_nacimiento, genero, telefono, direccion, correo, tipo_sangre, activo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
      RETURNING id_paciente, nombre, apellido, fecha_nacimiento, genero, telefono, direccion, correo, tipo_sangre, activo
    `;
    const params = [
      patientData.nombre,
      patientData.apellido,
      patientData.fechaNacimiento,
      patientData.genero || 'No especificado',
      patientData.telefono || '',
      patientData.direccion || '',
      patientData.correo || '',
      patientData.tipoSangre || 'O+'
    ];

    const res = await pool.query(query, params);
    institutionRouter.logQuery(this.institutionId, this.engineName, 'INSERT INTO paciente_hospital', query, Date.now() - start);

    const row = res.rows[0];
    return new Patient({
      id: row.id_paciente,
      institutionId: this.institutionId,
      nombre: row.nombre,
      apellido: row.apellido,
      fechaNacimiento: row.fecha_nacimiento ? row.fecha_nacimiento.toISOString().split('T')[0] : '',
      genero: row.genero,
      telefono: row.telefono,
      correo: row.correo,
      direccion: row.direccion,
      tipoSangre: row.tipo_sangre,
      activo: row.activo
    });
  }

  async updatePatient(id, patientData) {
    const pool = this.getPool();
    const start = Date.now();
    const query = `
      UPDATE paciente_hospital
      SET nombre = COALESCE($1, nombre),
          apellido = COALESCE($2, apellido),
          telefono = COALESCE($3, telefono),
          direccion = COALESCE($4, direccion),
          correo = COALESCE($5, correo),
          tipo_sangre = COALESCE($6, tipo_sangre)
      WHERE id_paciente = $7
      RETURNING *
    `;
    const params = [
      patientData.nombre,
      patientData.apellido,
      patientData.telefono,
      patientData.direccion,
      patientData.correo,
      patientData.tipoSangre,
      id
    ];
    const res = await pool.query(query, params);
    institutionRouter.logQuery(this.institutionId, this.engineName, 'UPDATE paciente_hospital', query, Date.now() - start);
    return res.rows[0];
  }

  async deactivatePatient(id, motivo) {
    const pool = this.getPool();
    const start = Date.now();
    const query = `
      UPDATE paciente_hospital
      SET activo = FALSE,
          motivo_baja = $1,
          fecha_baja = NOW()
      WHERE id_paciente = $2
      RETURNING *
    `;
    const res = await pool.query(query, [motivo, id]);
    institutionRouter.logQuery(this.institutionId, this.engineName, 'UPDATE paciente_hospital (Desactivar / Baja)', query, Date.now() - start);
    return res.rows[0];
  }

  async reactivatePatient(id) {
    const pool = this.getPool();
    const start = Date.now();
    const query = `
      UPDATE paciente_hospital
      SET activo = TRUE,
          motivo_baja = NULL,
          fecha_baja = NULL
      WHERE id_paciente = $1
      RETURNING *
    `;
    const res = await pool.query(query, [id]);
    institutionRouter.logQuery(this.institutionId, this.engineName, 'UPDATE paciente_hospital (Reactivar)', query, Date.now() - start);
    return res.rows[0];
  }

  async getClinicalHistory(patientId) {
    const pool = this.getPool();
    const start = Date.now();
    const patient = await this.findPatientById(patientId);
    if (!patient) return null;

    // Consultas con sus médicos
    const citasQuery = `
      SELECT c.id_cita, c.fecha, c.hora, c.motivo, c.estado,
             m.id_medico, m.nombre as medico_nombre, m.apellido as medico_apellido, m.especialidad, m.numero_colegiado
      FROM cita_hospital c
      LEFT JOIN medico m ON c.id_medico = m.id_medico
      WHERE c.id_paciente = $1
      ORDER BY c.fecha DESC, c.hora DESC
    `;
    const citasRes = await pool.query(citasQuery, [patientId]);

    // Para cada cita, obtener sus diagnósticos y tratamientos asociados
    const consultas = [];
    for (const cita of citasRes.rows) {
      const diagQuery = `
        SELECT d.id_diagnostico, d.descripcion, d.codigo_referencia, d.gravedad, d.fecha,
               t.id_tratamiento, t.medicamento, t.dosis, t.fecha_inicio, t.fecha_fin
        FROM diagnostico d
        LEFT JOIN tratamiento t ON d.id_diagnostico = t.id_diagnostico
        WHERE d.id_cita = $1
      `;
      const diagRes = await pool.query(diagQuery, [cita.id_cita]);

      const diagMap = new Map();
      for (const row of diagRes.rows) {
        if (!diagMap.has(row.id_diagnostico)) {
          diagMap.set(row.id_diagnostico, {
            id: row.id_diagnostico,
            descripcion: row.descripcion,
            codigoReferencia: row.codigo_referencia,
            gravedad: row.gravedad,
            fecha: row.fecha ? row.fecha.toISOString().split('T')[0] : '',
            tratamientos: []
          });
        }
        if (row.id_tratamiento) {
          diagMap.get(row.id_diagnostico).tratamientos.push({
            id: row.id_tratamiento,
            medicamento: row.medicamento,
            dosis: row.dosis,
            fechaInicio: row.fecha_inicio ? row.fecha_inicio.toISOString().split('T')[0] : '',
            fechaFin: row.fecha_fin ? row.fecha_fin.toISOString().split('T')[0] : ''
          });
        }
      }

      consultas.push({
        id: cita.id_cita,
        fecha: cita.fecha ? cita.fecha.toISOString().split('T')[0] : '',
        hora: cita.hora,
        motivo: cita.motivo,
        estado: cita.estado,
        profesional: `Dr. ${cita.medico_nombre} ${cita.medico_apellido} (${cita.especialidad})`,
        colegiado: cita.numero_colegiado,
        diagnosticos: Array.from(diagMap.values())
      });
    }

    institutionRouter.logQuery(this.institutionId, this.engineName, 'SELECT Citas + Diagnosticos + Tratamientos (JOIN)', citasQuery, Date.now() - start);

    return {
      paciente: patient,
      consultas,
      totalConsultas: consultas.length,
      motor: this.engineName,
      garantiaConsistencia: 'Transacciones ACID completas con niveles de aislamiento Read Committed y Serializable.'
    };
  }

  async recordMedicalEvent(eventData) {
    const pool = this.getPool();
    const client = await pool.connect();
    const start = Date.now();

    try {
      // INICIO DE TRANSACCIÓN ESTRICTA ACID
      await client.query('BEGIN');

      // 1. Obtener o asignar médico
      let medicoId = eventData.medicoId;
      if (!medicoId) {
        const medRes = await client.query('SELECT id_medico FROM medico LIMIT 1');
        medicoId = medRes.rows[0]?.id_medico || 1;
      }

      // 2. Registrar Cita Hospitalaria
      const citaQuery = `
        INSERT INTO cita_hospital (id_paciente, id_medico, fecha, hora, motivo, estado)
        VALUES ($1, $2, $3, $4, $5, 'atendida')
        RETURNING id_cita
      `;
      const fecha = eventData.fecha || new Date().toISOString().split('T')[0];
      const hora = eventData.hora || new Date().toTimeString().split(' ')[0];
      const citaRes = await client.query(citaQuery, [
        eventData.patientId,
        medicoId,
        fecha,
        hora,
        eventData.motivo
      ]);
      const citaId = citaRes.rows[0].id_cita;

      // 3. Registrar Diagnóstico
      const diagQuery = `
        INSERT INTO diagnostico (id_cita, descripcion, codigo_referencia, gravedad, fecha)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id_diagnostico
      `;
      const diagRes = await client.query(diagQuery, [
        citaId,
        eventData.diagnosticoDescripcion,
        eventData.codigoReferencia || 'GEN-01',
        eventData.gravedad || 'Moderada',
        fecha
      ]);
      const diagId = diagRes.rows[0].id_diagnostico;

      // 4. Registrar Tratamiento / Medicamentos
      let tratId = null;
      if (eventData.medicamento) {
        const tratQuery = `
          INSERT INTO tratamiento (id_diagnostico, medicamento, dosis, fecha_inicio, fecha_fin)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id_tratamiento
        `;
        const tratRes = await client.query(tratQuery, [
          diagId,
          eventData.medicamento,
          eventData.dosis || 'Dosis indicada por médico',
          fecha,
          eventData.fechaFin || null
        ]);
        tratId = tratRes.rows[0].id_tratamiento;
      }

      // COMMIT TRANSACCIÓN
      await client.query('COMMIT');

      institutionRouter.logQuery(
        this.institutionId,
        this.engineName,
        'BEGIN -> INSERT cita -> INSERT diag -> INSERT trat -> COMMIT',
        `TRANSACTION ACID EXECUTED: Cita=${citaId}, Diagnostico=${diagId}, Tratamiento=${tratId}`,
        Date.now() - start
      );

      return {
        success: true,
        citaId,
        diagnosticoId: diagId,
        tratamientoId: tratId,
        message: 'Consulta, diagnóstico y tratamiento registrados con integridad transaccional ACID en PostgreSQL.'
      };
    } catch (err) {
      await client.query('ROLLBACK');
      institutionRouter.logQuery(this.institutionId, this.engineName, 'ROLLBACK (Transacción abortada)', err.message, Date.now() - start);
      throw err;
    } finally {
      client.release();
    }
  }

  async getInstitutionStats() {
    const pool = this.getPool();
    const query = `
      SELECT
        (SELECT COUNT(*) FROM paciente_hospital) as total_pacientes,
        (SELECT COUNT(*) FROM paciente_hospital WHERE activo = TRUE) as pacientes_activos,
        (SELECT COUNT(*) FROM paciente_hospital WHERE activo = FALSE) as pacientes_archivados,
        (SELECT COUNT(*) FROM cita_hospital) as total_citas,
        (SELECT COUNT(*) FROM diagnostico) as total_diagnosticos,
        (SELECT COUNT(*) FROM tratamiento) as total_tratamientos
    `;
    const res = await pool.query(query);
    const row = res.rows[0];
    return {
      totalPacientes: parseInt(row.total_pacientes, 10),
      pacientesActivos: parseInt(row.pacientes_activos, 10),
      pacientesArchivados: parseInt(row.pacientes_archivados, 10),
      totalConsultas: parseInt(row.total_citas, 10),
      totalDiagnosticos: parseInt(row.total_diagnosticos, 10),
      totalTratamientos: parseInt(row.total_tratamientos, 10)
    };
  }
}

module.exports = PostgresAdapter;
