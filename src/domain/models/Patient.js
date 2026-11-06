/**
 * Entidad de Dominio: Patient
 * Representa a un paciente en la red de instituciones médicas independientes.
 */
class Patient {
  constructor({
    id,
    institutionId,
    nombre,
    apellido,
    fechaNacimiento,
    genero = 'No especificado',
    telefono = '',
    correo = '',
    direccion = '',
    tipoSangre = null,
    activo = true,
    motivoBaja = null,
    fechaBaja = null,
    tutor = null,
    metadata = {}
  }) {
    this.id = id;
    this.institutionId = institutionId;
    this.nombre = nombre;
    this.apellido = apellido;
    this.fechaNacimiento = fechaNacimiento;
    this.genero = genero;
    this.telefono = telefono;
    this.correo = correo;
    this.direccion = direccion;
    this.tipoSangre = tipoSangre;
    this.activo = activo === true || activo === 1 || activo === 'true';
    this.motivoBaja = motivoBaja;
    this.fechaBaja = fechaBaja;
    this.tutor = tutor; // Específico de pediatría pero soportado en dominio
    this.metadata = metadata;
  }

  getNombreCompleto() {
    return `${this.nombre} ${this.apellido}`.trim();
  }

  darDeBaja(motivo) {
    if (!motivo || motivo.trim() === '') {
      throw new Error('Debe especificar un motivo válido para la baja del historial clínico.');
    }
    this.activo = false;
    this.motivoBaja = motivo.trim();
    this.fechaBaja = new Date();
  }

  reactivar() {
    this.activo = true;
    this.motivoBaja = null;
    this.fechaBaja = null;
  }
}

module.exports = Patient;

