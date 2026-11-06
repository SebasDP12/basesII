const MedicalRecordRepositoryPort = require('../../domain/ports/MedicalRecordRepositoryPort');
const Patient = require('../../domain/models/Patient');
const connectionManager = require('../database/connectionManager');
const institutionRouter = require('../../domain/services/InstitutionRouterService');

class MySQLAdapter extends MedicalRecordRepositoryPort {
  constructor() {
    super();
    this.institutionId = 'odontologia';
    this.engineName = 'MySQL';
  }

  getPool() {
    return connectionManager.getMySQLPool();
  }

  async healthCheck() {
    const start = Date.now();
    try {
      const pool = this.getPool();
      const [rows] = await pool.query('SELECT VERSION() as version, NOW() as current_time, COUNT(*) as total_pacientes FROM paciente_clinica');
      const latencyMs = Date.now() - start;
      return {
        status: 'online',
        latencyMs,
        details: {
          version: 'MySQL ' + rows[0].version,
          currentTime: rows[0].current_time,
          totalPacientes: rows[0].total_pacientes,
          database: process.env.MYSQL_DB || 'clinica_odontologica'
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
      SELECT id_paciente, nombre, apellido, fecha_nacimiento, telefono, correo, activo, motivo_baja, fecha_baja
      FROM paciente_clinica
      WHERE 1=1
    `;
    const params = [];

    if (options.activo !== undefined && options.activo !== '') {
      params.push(options.activo === true || options.activo === 'true' ? 1 : 0);
      query += ` AND activo = ?`;
    }

    if (options.search) {
      params.push(`%${options.search}%`, `%${options.search}%`, `%${options.search}%`);
      query += ` AND (nombre LIKE ? OR apellido LIKE ? OR correo LIKE ?)`;
    }

    query += ' ORDER BY id_paciente DESC';

    const [rows] = await pool.query(query, params);
    institutionRouter.logQuery(this.institutionId, this.engineName, 'SELECT paciente_clinica', query, Date.now() - start);

    return rows.map(row => new Patient({
      id: row.id_paciente,
      institutionId: this.institutionId,
      nombre: row.nombre,
      apellido: row.apellido,
      fechaNacimiento: row.fecha_nacimiento ? new Date(row.fecha_nacimiento).toISOString().split('T')[0] : '',
      telefono: row.telefono,
      correo: row.correo,
      activo: Boolean(row.activo),
      motivoBaja: row.motivo_baja,
      fechaBaja: row.fecha_baja
    }));
  }

  async findPatientById(id) {
    const pool = this.getPool();
    const start = Date.now();
    const query = `
      SELECT id_paciente, nombre, apellido, fecha_nacimiento, telefono, correo, activo, motivo_baja, fecha_baja
      FROM paciente_clinica
      WHERE id_paciente = ?
    `;
    const [rows] = await pool.query(query, [id]);
    institutionRouter.logQuery(this.institutionId, this.engineName, 'SELECT paciente_clinica WHERE id', query, Date.now() - start);

    if (rows.length === 0) return null;
    const row = rows[0];
    return new Patient({
      id: row.id_paciente,
      institutionId: this.institutionId,
      nombre: row.nombre,
      apellido: row.apellido,
      fechaNacimiento: row.fecha_nacimiento ? new Date(row.fecha_nacimiento).toISOString().split('T')[0] : '',
      telefono: row.telefono,
      correo: row.correo,
      activo: Boolean(row.activo),
      motivoBaja: row.motivo_baja,
      fechaBaja: row.fecha_baja
    });
  }

  async createPatient(patientData) {
    const pool = this.getPool();
    const start = Date.now();
    const query = `
      INSERT INTO paciente_clinica (nombre, apellido, fecha_nacimiento, telefono, correo, activo)
      VALUES (?, ?, ?, ?, ?, 1)
    `;
    const params = [
      patientData.nombre,
      patientData.apellido,
      patientData.fechaNacimiento,
      patientData.telefono || '',
      patientData.correo || ''
    ];

    const [result] = await pool.query(query, params);
    institutionRouter.logQuery(this.institutionId, this.engineName, 'INSERT INTO paciente_clinica', query, Date.now() - start);

    return new Patient({
      id: result.insertId,
      institutionId: this.institutionId,
      nombre: patientData.nombre,
      apellido: patientData.apellido,
      fechaNacimiento: patientData.fechaNacimiento,
      telefono: patientData.telefono,
      correo: patientData.correo,
      activo: true
    });
  }

  async updatePatient(id, patientData) {
    const pool = this.getPool();
    const start = Date.now();
    const query = `
      UPDATE paciente_clinica
      SET nombre = COALESCE(?, nombre),
          apellido = COALESCE(?, apellido),
          telefono = COALESCE(?, telefono),
          correo = COALESCE(?, correo)
      WHERE id_paciente = ?
    `;
    await pool.query(query, [patientData.nombre, patientData.apellido, patientData.telefono, patientData.correo, id]);
    institutionRouter.logQuery(this.institutionId, this.engineName, 'UPDATE paciente_clinica', query, Date.now() - start);
    return await this.findPatientById(id);
  }

  async deactivatePatient(id, motivo) {
    const pool = this.getPool();
    const start = Date.now();
    const query = `
      UPDATE paciente_clinica
      SET activo = 0,
          motivo_baja = ?,
          fecha_baja = NOW()
      WHERE id_paciente = ?
    `;
    await pool.query(query, [motivo, id]);
    institutionRouter.logQuery(this.institutionId, this.engineName, 'UPDATE paciente_clinica (Desactivar / Baja)', query, Date.now() - start);
    return await this.findPatientById(id);
  }

  async reactivatePatient(id) {
    const pool = this.getPool();
    const start = Date.now();
    const query = `
      UPDATE paciente_clinica
      SET activo = 1,
          motivo_baja = NULL,
          fecha_baja = NULL
      WHERE id_paciente = ?
    `;
    await pool.query(query, [id]);
    institutionRouter.logQuery(this.institutionId, this.engineName, 'UPDATE paciente_clinica (Reactivar)', query, Date.now() - start);
    return await this.findPatientById(id);
  }

  async getClinicalHistory(patientId) {
    const pool = this.getPool();
    const start = Date.now();
    const patient = await this.findPatientById(patientId);
    if (!patient) return null;

    // Citas odontológicas
    const citasQuery = `
      SELECT c.id_cita, c.fecha, c.hora, c.motivo, c.estado,
             o.id_odontologo, o.nombre as odonto_nombre, o.apellido as odonto_apellido, o.especialidad, o.numero_colegiado
      FROM cita_clinica c
      LEFT JOIN odontologo o ON c.id_odontologo = o.id_odontologo
      WHERE c.id_paciente = ?
      ORDER BY c.fecha DESC, c.hora DESC
    `;
    const [citas] = await pool.query(citasQuery, [patientId]);

    const consultas = [];
    for (const cita of citas) {
      // Procedimientos realizados en la cita (pieza dental, costo)
      const [procedimientos] = await pool.query(
        'SELECT id_procedimiento, tipo_procedimiento, pieza_dental, costo, observaciones FROM procedimiento WHERE id_cita = ?',
        [cita.id_cita]
      );

      // Diagnósticos y medicamentos
      const [diagnosticos] = await pool.query(
        'SELECT id_diagnostico, descripcion, codigo_referencia, gravedad, fecha_diagnostico FROM diagnostico WHERE id_cita = ?',
        [cita.id_cita]
      );

      const diagList = [];
      for (const diag of diagnosticos) {
        const [medicamentos] = await pool.query(
          'SELECT id_medicamento, nombre_comercial, principio_activo, dosis, frecuencia FROM medicamento WHERE id_diagnostico = ?',
          [diag.id_diagnostico]
        );
        diagList.push({
          id: diag.id_diagnostico,
          descripcion: diag.descripcion,
          codigoReferencia: diag.codigo_referencia,
          gravedad: diag.gravedad,
          fecha: diag.fecha_diagnostico ? new Date(diag.fecha_diagnostico).toISOString().split('T')[0] : '',
          tratamientos: medicamentos.map(m => ({
            id: m.id_medicamento,
            medicamento: m.nombre_comercial,
            principioActivo: m.principio_activo,
            dosis: m.dosis,
            frecuencia: m.frecuencia
          }))
        });
      }

      consultas.push({
        id: cita.id_cita,
        fecha: cita.fecha ? new Date(cita.fecha).toISOString().split('T')[0] : '',
        hora: cita.hora,
        motivo: cita.motivo,
        estado: cita.estado,
        profesional: `Dra. ${cita.odonto_nombre || 'Sofía'} ${cita.odonto_apellido || 'Mendoza'} (${cita.especialidad || 'Odontología General'})`,
        colegiado: cita.numero_colegiado || 'COL-OD-1290',
        procedimientos: procedimientos.map(p => ({
          id: p.id_procedimiento,
          tipo: p.tipo_procedimiento,
          piezaDental: p.pieza_dental,
          costo: parseFloat(p.costo || 0),
          observaciones: p.observaciones
        })),
        diagnosticos: diagList
      });
    }

    institutionRouter.logQuery(this.institutionId, this.engineName, 'SELECT Citas + Procedimientos + Diagnosticos', citasQuery, Date.now() - start);

    return {
      paciente: patient,
      consultas,
      totalConsultas: consultas.length,
      motor: this.engineName,
      garantiaConsistencia: 'Transaccionalidad InnoDB con soporte ACID y bloqueos a nivel de fila (Row-Level Locking).'
    };
  }

  async recordMedicalEvent(eventData) {
    const pool = this.getPool();
    const conn = await pool.getConnection();
    const start = Date.now();

    try {
      await conn.beginTransaction();

      let odontoId = eventData.odontologoId;
      if (!odontoId) {
        const [odRows] = await conn.query('SELECT id_odontologo FROM odontologo LIMIT 1');
        odontoId = odRows[0]?.id_odontologo || 1;
      }

      const fecha = eventData.fecha || new Date().toISOString().split('T')[0];
      const hora = eventData.hora || new Date().toTimeString().split(' ')[0].substring(0, 8);

      // 1. Cita Odontológica
      const [citaResult] = await conn.query(
        'INSERT INTO cita_clinica (id_paciente, id_odontologo, fecha, hora, motivo, estado) VALUES (?, ?, ?, ?, ?, "atendida")',
        [eventData.patientId, odontoId, fecha, hora, eventData.motivo]
      );
      const citaId = citaResult.insertId;

      // 2. Procedimiento Odontológico (pieza dental, costo)
      const tipoProc = eventData.procedimientoTipo || eventData.motivo;
      const pieza = eventData.piezaDental || 'General';
      const costo = eventData.costo ? parseFloat(eventData.costo) : 250.00;
      const [procResult] = await conn.query(
        'INSERT INTO procedimiento (id_cita, tipo_procedimiento, pieza_dental, costo, observaciones) VALUES (?, ?, ?, ?, ?)',
        [citaId, tipoProc, pieza, costo, eventData.observaciones || 'Procedimiento completado']
      );

      // 3. Diagnóstico
      const [diagResult] = await conn.query(
        'INSERT INTO diagnostico (id_cita, descripcion, codigo_referencia, gravedad, fecha_diagnostico) VALUES (?, ?, ?, ?, ?)',
        [citaId, eventData.diagnosticoDescripcion, eventData.codigoReferencia || 'ODON-01', eventData.gravedad || 'Leve', fecha]
      );
      const diagId = diagResult.insertId;

      // 4. Medicamento
      let medId = null;
      if (eventData.medicamento) {
        const [medResult] = await conn.query(
          'INSERT INTO medicamento (id_diagnostico, nombre_comercial, principio_activo, dosis, frecuencia) VALUES (?, ?, ?, ?, ?)',
          [diagId, eventData.medicamento, eventData.principioActivo || eventData.medicamento, eventData.dosis || '1 dosis', eventData.frecuencia || 'Cada 8h']
        );
        medId = medResult.insertId;
      }

      await conn.commit();

      institutionRouter.logQuery(
        this.institutionId,
        this.engineName,
        'START TRANSACTION -> INSERT cita -> INSERT proc -> INSERT diag -> INSERT med -> COMMIT',
        `TRANSACTION EXECUTED: Cita=${citaId}, Procedimiento=${procResult.insertId}, Diagnostico=${diagId}, Medicamento=${medId}`,
        Date.now() - start
      );

      return {
        success: true,
        citaId,
        procedimientoId: procResult.insertId,
        diagnosticoId: diagId,
        medicamentoId: medId,
        message: 'Atención odontológica registrada con éxito en MySQL (InnoDB).'
      };
    } catch (err) {
      await conn.rollback();
      institutionRouter.logQuery(this.institutionId, this.engineName, 'ROLLBACK (MySQL)', err.message, Date.now() - start);
      throw err;
    } finally {
      conn.release();
    }
  }

  async getInstitutionStats() {
    const pool = this.getPool();
    const [rows] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM paciente_clinica) as total_pacientes,
        (SELECT COUNT(*) FROM paciente_clinica WHERE activo = 1) as pacientes_activos,
        (SELECT COUNT(*) FROM paciente_clinica WHERE activo = 0) as pacientes_archivados,
        (SELECT COUNT(*) FROM cita_clinica) as total_citas,
        (SELECT COUNT(*) FROM procedimiento) as total_procedimientos,
        (SELECT COUNT(*) FROM diagnostico) as total_diagnosticos,
        (SELECT COALESCE(SUM(costo), 0) FROM procedimiento) as facturacion_total
    `);
    const r = rows[0];
    return {
      totalPacientes: parseInt(r.total_pacientes, 10),
      pacientesActivos: parseInt(r.pacientes_activos, 10),
      pacientesArchivados: parseInt(r.pacientes_archivados, 10),
      totalConsultas: parseInt(r.total_citas, 10),
      totalProcedimientos: parseInt(r.total_procedimientos, 10),
      totalDiagnosticos: parseInt(r.total_diagnosticos, 10),
      facturacionTotal: parseFloat(r.facturacion_total)
    };
  }
}

module.exports = MySQLAdapter;
