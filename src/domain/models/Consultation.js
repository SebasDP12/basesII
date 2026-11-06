/**
 * Entidades de Dominio: Consultation, Diagnosis, Treatment, Institution
 */

class Consultation {
  constructor({
    id,
    patientId,
    institutionId,
    fecha = new Date().toISOString().split('T')[0],
    hora = new Date().toTimeString().split(' ')[0].substring(0, 5),
    motivo,
    estado = 'atendida',
    profesional = '',
    // Datos clínicos específicos según contexto institucional
    detalles = {},
    diagnosticos = []
  }) {
    this.id = id;
    this.patientId = patientId;
    this.institutionId = institutionId;
    this.fecha = fecha;
    this.hora = hora;
    this.motivo = motivo;
    this.estado = estado;
    this.profesional = profesional;
    this.detalles = detalles;
    this.diagnosticos = diagnosticos;
  }
}

class Diagnosis {
  constructor({
    id,
    consultationId,
    patientId,
    institutionId,
    descripcion,
    codigoReferencia = '',
    gravedad = 'Moderada',
    fecha = new Date().toISOString().split('T')[0],
    tratamientos = []
  }) {
    this.id = id;
    this.consultationId = consultationId;
    this.patientId = patientId;
    this.institutionId = institutionId;
    this.descripcion = descripcion;
    this.codigoReferencia = codigoReferencia;
    this.gravedad = gravedad;
    this.fecha = fecha;
    this.tratamientos = tratamientos;
  }
}

class Treatment {
  constructor({
    id,
    diagnosisId,
    consultationId,
    patientId,
    institutionId,
    medicamento = '',
    dosis = '',
    frecuencia = '',
    fechaInicio = new Date().toISOString().split('T')[0],
    fechaFin = null,
    // Extensiones para Odonto, Lab y Pediatría
    procedimiento = null,
    resultadosExamen = null,
    vacunacion = null
  }) {
    this.id = id;
    this.diagnosisId = diagnosisId;
    this.consultationId = consultationId;
    this.patientId = patientId;
    this.institutionId = institutionId;
    this.medicamento = medicamento;
    this.dosis = dosis;
    this.frecuencia = frecuencia;
    this.fechaInicio = fechaInicio;
    this.fechaFin = fechaFin;
    this.procedimiento = procedimiento;
    this.resultadosExamen = resultadosExamen;
    this.vacunacion = vacunacion;
  }
}

const INSTITUTIONS = {
  hospital: {
    id: 'hospital',
    name: 'Hospital General',
    engine: 'PostgreSQL',
    port: 5432,
    role: 'Médico Internista / Especialista',
    defaultUser: 'Dr. Carlos Ramírez (Medicina Interna)',
    color: '#2563eb',
    accent: 'blue',
    icon: 'hospital',
    description: 'Gestión hospitalaria de alta complejidad. Requiere estricta integridad transaccional (ACID) y consistencia relacional para asegurar que diagnósticos y tratamientos no se pierdan.',
    strengths: 'Transacciones ACID completas, constraints de llaves foráneas estrictas, aislamiento Serializable.'
  },
  odontologia: {
    id: 'odontologia',
    name: 'Clínica Odontológica',
    engine: 'MySQL',
    port: 3306,
    role: 'Secretaria Dental / Odontólogo',
    defaultUser: 'Dra. Sofía Mendoza & Recepción',
    color: '#0891b2',
    accent: 'cyan',
    icon: 'tooth',
    description: 'Atención rápida en clínica dental. Modelo relacional simplificado operado principalmente por secretarias para agendar citas, asociar piezas dentales y facturar procedimientos.',
    strengths: 'Alto rendimiento en lecturas rápidas, índices B-Tree eficientes, facilidad de despliegue para PYMES.'
  },
  laboratorio: {
    id: 'laboratorio',
    name: 'Laboratorio Clínico',
    engine: 'MongoDB',
    port: 27017,
    role: 'Químico Biólogo / Laboratorista',
    defaultUser: 'Lic. Marco Tulio Peña (Bacteriólogo)',
    color: '#16a34a',
    accent: 'emerald',
    icon: 'flask',
    description: 'Procesamiento de órdenes y exámenes heterogéneos. Utiliza modelo documental para embeber listas de parámetros dinámicos (hematología, orina, perfiles lipídicos) dentro de cada orden.',
    strengths: 'Esquema flexible (BSON), atomicidad a nivel de documento, embebido de resultados sin joins costosos.'
  },
  pediatria: {
    id: 'pediatria',
    name: 'Centro Médico Pediátrico',
    engine: 'Firebase Firestore',
    port: 8080,
    role: 'Pediatra / Enfermería Pediátrica',
    defaultUser: 'Dra. Elena Castillo (Pediatría)',
    color: '#f59e0b',
    accent: 'amber',
    icon: 'baby',
    description: 'Consultas frecuentes de seguimiento infantil (peso, talla, curvas de desarrollo) y cartilla de vacunación vinculada al tutor responsable.',
    strengths: 'Sincronización en tiempo real, modelo documental optimizado para clientes móviles/web, subcolecciones eficientes.'
  }
};

module.exports = {
  Consultation,
  Diagnosis,
  Treatment,
  INSTITUTIONS
};
