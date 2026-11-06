// ===============================================================
// Laboratorio Clínico - Base de Datos MongoDB
// Base de Datos II - Universidad Rafael Landívar
// ===============================================================

db = db.getSiblingDB('laboratorio_clinico');

// Limpiar colecciones si ya existen para inicialización limpia
db.pacientes.drop();
db.catalogo_examenes.drop();
db.ordenes_examen.drop();

// 1. Colección de Pacientes
db.pacientes.insertMany([
  {
    id_paciente: 1,
    nombre: "Carlos",
    apellido: "Valenzuela Ruiz",
    fecha_nacimiento: "1980-06-18",
    telefono: "5555-4001",
    correo: "carlos.valenzuela@email.com",
    activo: true,
    motivo_baja: null,
    fecha_baja: null,
    fecha_creacion: new Date("2026-09-01T08:00:00Z")
  },
  {
    id_paciente: 2,
    nombre: "Claudia",
    apellido: "Morales Pineda",
    fecha_nacimiento: "1994-11-03",
    telefono: "5555-4002",
    correo: "claudia.morales@email.com",
    activo: true,
    motivo_baja: null,
    fecha_baja: null,
    fecha_creacion: new Date("2026-09-15T09:30:00Z")
  },
  {
    id_paciente: 3,
    nombre: "Víctor",
    apellido: "Hernández Cruz",
    fecha_nacimiento: "1972-01-25",
    telefono: "5555-4003",
    correo: "victor.hernandez@email.com",
    activo: false,
    motivo_baja: "Fallecimiento",
    fecha_baja: new Date("2026-10-10T12:00:00Z"),
    fecha_creacion: new Date("2026-08-10T07:45:00Z")
  }
]);

db.pacientes.createIndex({ id_paciente: 1 }, { unique: true });
db.pacientes.createIndex({ correo: 1 });
db.pacientes.createIndex({ activo: 1 });

// 2. Catálogo de Exámenes
db.catalogo_examenes.insertMany([
  {
    id_tipo_examen: 1,
    nombre_examen: "Hematología Completa",
    descripcion: "Evaluación cuantitativa y morfológica de células sanguíneas",
    parametros: [
      { parametro: "Hemoglobina", unidad_medida: "g/dL", valor_referencia: "12.0 - 16.0" },
      { parametro: "Hematocrito", unidad_medida: "%", valor_referencia: "37.0 - 47.0" },
      { parametro: "Leucocitos", unidad_medida: "x10^3/uL", valor_referencia: "4.5 - 11.0" },
      { parametro: "Plaquetas", unidad_medida: "x10^3/uL", valor_referencia: "150 - 450" }
    ]
  },
  {
    id_tipo_examen: 2,
    nombre_examen: "Perfil Lipídico",
    descripcion: "Medición de fracciones lipídicas en suero",
    parametros: [
      { parametro: "Colesterol Total", unidad_medida: "mg/dL", valor_referencia: "< 200" },
      { parametro: "Triglicéridos", unidad_medida: "mg/dL", valor_referencia: "< 150" },
      { parametro: "HDL Colesterol", unidad_medida: "mg/dL", valor_referencia: "> 40" },
      { parametro: "LDL Colesterol", unidad_medida: "mg/dL", valor_referencia: "< 100" }
    ]
  },
  {
    id_tipo_examen: 3,
    nombre_examen: "Examen General de Orina (EGO)",
    descripcion: "Análisis físico, químico y microscópico de sedimento urinario",
    parametros: [
      { parametro: "Aspecto", unidad_medida: "Visual", valor_referencia: "Transparente / Límpido" },
      { parametro: "pH", unidad_medida: "Escala pH", valor_referencia: "5.0 - 7.5" },
      { parametro: "Densidad", unidad_medida: "g/ml", valor_referencia: "1.010 - 1.025" },
      { parametro: "Proteínas", unidad_medida: "mg/dL", valor_referencia: "Negativo" },
      { parametro: "Glucosa", unidad_medida: "mg/dL", valor_referencia: "Negativo" }
    ]
  }
]);

// 3. Órdenes de Exámenes (Resultados embebidos dentro de la orden)
db.ordenes_examen.insertMany([
  {
    id_orden: 1,
    id_paciente: 1,
    fecha_solicitud: "2026-10-18",
    fecha_resultado: "2026-10-19",
    estado: "finalizado",
    tipo_examen: {
      id_tipo_examen: 1,
      nombre_examen: "Hematología Completa"
    },
    motivo: "Chequeo de rutina y fatiga leve",
    diagnostico: "Anemia leve normocítica normocrómica",
    tratamiento: "Sulfato Ferroso 300mg diario + Ácido Fólico 5mg",
    resultados: [
      { parametro: "Hemoglobina", unidad_medida: "g/dL", valor_referencia: "12.0 - 16.0", valor_obtenido: "10.8" },
      { parametro: "Hematocrito", unidad_medida: "%", valor_referencia: "37.0 - 47.0", valor_obtenido: "33.5" },
      { parametro: "Leucocitos", unidad_medida: "x10^3/uL", valor_referencia: "4.5 - 11.0", valor_obtenido: "6.2" },
      { parametro: "Plaquetas", unidad_medida: "x10^3/uL", valor_referencia: "150 - 450", valor_obtenido: "260" }
    ]
  },
  {
    id_orden: 2,
    id_paciente: 1,
    fecha_solicitud: "2026-11-01",
    fecha_resultado: "2026-11-02",
    estado: "finalizado",
    tipo_examen: {
      id_tipo_examen: 2,
      nombre_examen: "Perfil Lipídico"
    },
    motivo: "Control de dislipidemia",
    diagnostico: "Hipertrigliceridemia moderada",
    tratamiento: "Atorvastatina 20mg nocturno y plan nutricional bajo en grasas saturadas",
    resultados: [
      { parametro: "Colesterol Total", unidad_medida: "mg/dL", valor_referencia: "< 200", valor_obtenido: "235" },
      { parametro: "Triglicéridos", unidad_medida: "mg/dL", valor_referencia: "< 150", valor_obtenido: "210" },
      { parametro: "HDL Colesterol", unidad_medida: "mg/dL", valor_referencia: "> 40", valor_obtenido: "38" },
      { parametro: "LDL Colesterol", unidad_medida: "mg/dL", valor_referencia: "< 100", valor_obtenido: "155" }
    ]
  },
  {
    id_orden: 3,
    id_paciente: 2,
    fecha_solicitud: "2026-11-04",
    fecha_resultado: "2026-11-05",
    estado: "finalizado",
    tipo_examen: {
      id_tipo_examen: 3,
      nombre_examen: "Examen General de Orina (EGO)"
    },
    motivo: "Sospecha de infección urinaria baja",
    diagnostico: "Infección de tracto urinario baja no complicada",
    tratamiento: "Nitrofurantoína 100mg cada 12 horas por 7 días",
    resultados: [
      { parametro: "Aspecto", unidad_medida: "Visual", valor_referencia: "Transparente / Límpido", valor_obtenido: "Ligeramente Turbio" },
      { parametro: "pH", unidad_medida: "Escala pH", valor_referencia: "5.0 - 7.5", valor_obtenido: "6.5" },
      { parametro: "Densidad", unidad_medida: "g/ml", valor_referencia: "1.010 - 1.025", valor_obtenido: "1.020" },
      { parametro: "Proteínas", unidad_medida: "mg/dL", valor_referencia: "Negativo", valor_obtenido: "Trazas (+)" },
      { parametro: "Glucosa", unidad_medida: "mg/dL", valor_referencia: "Negativo", valor_obtenido: "Negativo" }
    ]
  }
]);

db.ordenes_examen.createIndex({ id_orden: 1 }, { unique: true });
db.ordenes_examen.createIndex({ id_paciente: 1 });
db.ordenes_examen.createIndex({ estado: 1 });

print("Inicialización de MongoDB para Laboratorio Clínico completada exitosamente.");
