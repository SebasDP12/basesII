# Documento Comparativo: Arquitectura y Asignacion de Motores de BD
## Proyecto de Historiales Clinicos Multi-Motor con Arquitectura Hexagonal

---

## 1. Introduccion y Contexto del Caso

El presente proyecto implementa una plataforma unificada para una red de cuatro instituciones medicas independientes que comparten una interfaz comun para la consulta y administracion de historiales clinicos, pero manteniendo infraestructuras de datos heterogeneas, independientes y especializadas.

Para habilitar este desacoplamiento tecnico y permitir que la logica de negocio permanezca intacta al cambiar o enrutar operaciones entre diferentes motores de bases de datos, se aplico la Arquitectura Hexagonal (Puertos y Adaptadores).

Las cuatro instituciones y los cuatro motores seleccionados sin repeticion son:
1. Hospital General -> PostgreSQL
2. Clinica Odontologica -> MySQL
3. Laboratorio Clinico -> MongoDB
4. Centro Medico Pediatrico -> Firebase Firestore

---

## 2. Justificacion Tecnica de la Asignacion de Motores por Institucion

### 2.1 Hospital General -> PostgreSQL
* Necesidad del negocio: Requiere un control estricto sobre citas, diagnosticos y tratamientos clinicos. La prioridad es la fuerte integridad transaccional (ACID); no puede perderse un diagnostico a medias o registrarse una medicacion sin un diagnostico asociado.
* Justificacion tecnica: PostgreSQL es un motor objeto-relacional de nivel empresarial con soporte avanzado para niveles de aislamiento transaccional (Read Committed, Repeatable Read y Serializable). Ofrece soporte estricto de claves foraneas con restricciones en cascada (ON DELETE CASCADE / RESTRICT), validaciones de dominio (CHECK), transacciones atomicas con sentencias BEGIN ... COMMIT / ROLLBACK y maxima confiabilidad en operaciones hospitalarias.

### 2.2 Clinica Odontologica -> MySQL
* Necesidad del negocio: Clinica dental de menor escala sin personal tecnico propio que prioriza la rapidez de atencion al paciente por medio de recepcionistas y secretarias. Su flujo consiste en agendar citas rapidas, vincular procedimientos a piezas dentales especificas y facturar tratamientos.
* Justificacion tecnica: MySQL con su motor de almacenamiento transaccional InnoDB brinda alta velocidad de respuesta en lecturas y escrituras cotidianas, soporte de indices B-Tree de alta velocidad y bloqueos a nivel de fila (row-level locking). Es ideal para un modelo relacional estandarizado y liviano, con amplia disponibilidad en servidores y facilidad de mantenimiento.

### 2.3 Laboratorio Clinico -> MongoDB
* Necesidad del negocio: Procesa resultados de examenes cuya estructura varia radicalmente segun el tipo de prueba. Por ejemplo, una hematologia completa mide hemoglobina, hematocrito, leucocitos y plaquetas; un examen general de orina evalua aspecto fisico, pH, densidad y sedimentos; mientras que un perfil lipidico evalua fracciones de colesterol y trigliceridos.
* Justificacion tecnica: MongoDB ofrece un modelo documental NoSQL flexible basado en documentos BSON, permitiendo almacenar esquemas polimorficos de forma nativa sin migraciones de esquema (schema-less). Los diferentes examenes y sus resultados se modelan como documentos BSON ricos, permitiendo consultar rapidamente el historial analitico completo de cualquier prueba.

### 2.4 Centro Medico Pediatrico -> Firebase Firestore
* Necesidad del negocio: Administra historiales con seguimiento frecuente por paciente infantil (curvas de control de crecimiento, peso en kg, talla en cm, observaciones de desarrollo) y esquemas continuos de vacunacion. Adicionalmente, todo paciente menor de edad depende obligatoriamente de un tutor o encargado legal que autoriza la atencion medica.
* Justificacion tecnica: Firestore es una base de datos documental orientada a consultas rapidas y de corta duracion. Su modelo de documentos y colecciones es idoneo para integrar fichas pediatricas sincronizables, con soporte nativo de subcolecciones para controles y cartilla de vacunas.

---

## 3. Decisiones de Modelado Documental (Embebido vs Referenciado)

### 3.1 MongoDB (Laboratorio Clinico)
* Datos Referenciados:
  La coleccion ordenes_examen esta referenciada mediante el campo id_paciente.
  Justificacion: A lo largo de los anos, un paciente puede realizarse cientos de analisis de laboratorio. Si se embebieran todas las ordenes dentro del documento del paciente, se violaria el limite de 16 MB por documento de MongoDB y se sobrecargaria la memoria innecesariamente al consultar datos generales del paciente.
* Datos Embebidos:
  Dentro de cada orden de examen, la lista de resultados (parametro, unidad de medida, valor de referencia y valor obtenido) se encuentra embebida directamente como un arreglo de subdocumentos.
  Justificacion: Cuando se revisa una orden de laboratorio, siempre se requiere ver todos sus parametros juntos en el mismo instante. Embeberlos garantiza que la orden completa se recupere en una sola operacion de lectura I/O de disco atomica, eliminando la necesidad de realizar costosos $lookup (JOINs relacionales).

### 3.2 Firebase Firestore (Centro Medico Pediatrico)
* Datos Embebidos:
  Los datos de contacto y parentesco del tutor legal se encuentran embebidos dentro del documento del paciente (pacientes/{id}/tutor: { nombre, parentesco, telefono, correo, direccion }).
  Justificacion: Cada atencion medica pediatrica requiere validar inmediatamente quien es el responsable legal y su numero de contacto. Embeber esta informacion permite obtener la ficha completa del menor en una unica lectura de documento (1 single document read) en Firestore, optimizando la latencia de red.
* Datos Referenciados / Subcolecciones:
  Las consultas periodicas de crecimiento (peso, talla) y el registro de dosis de vacunacion se almacenan en subcolecciones (consultas y vacunaciones).
  Justificacion: Dado que un nino asiste a consultas casi mensualmente, separar las consultas en subcolecciones evita que el documento raiz del paciente sobrepase el limite de 1 MB de Firestore y permite consultar resumenes sin descargar todo el historial masivo.

---

## 4. Garantias de Consistencia y Manejo de Transacciones

| Motor | Mecanismo de Consistencia | Estrategia de Transacciones Implementada |
|---|---|---|
| PostgreSQL (Hospital) | ACID estricto con Aislamiento Read Committed / Serializable | Bloques transaccionales con BEGIN ... COMMIT / ROLLBACK. La creacion de la cita, diagnostico y tratamiento se ejecutan como una unidad indivisible en la misma conexion. |
| MySQL (Odontologia) | ACID con motor transaccional InnoDB | Uso de START TRANSACTION ... COMMIT con bloqueos a nivel de fila y claves foraneas en cascada. El registro del procedimiento dental (pieza y costo), diagnostico y receta es completamente atomico. |
| MongoDB (Laboratorio) | Consistencia Fuerte por Documento / Modelo BSON | Atomicidad a nivel de documento individual. El guardado de la orden con todos sus resultados y parametros embebidos se ejecuta atomicamente en un solo insertOne o updateOne. |
| Firebase Firestore (Pediatria) | Consistencia Serializada en Documentos y Batched Writes | Escrituras atomicas por lote (batched writes) y transacciones nativas de Firestore, asegurando que el documento del menor y sus controles no entren en estados inconsistentes. |

---

## 5. Aplicacion de Seguridad y Clasificacion de la Informacion

1. Informacion Publica:
   - Nombres, colegiados y especialidades de medicos y odontologos.
   - Catalogo de tipos de analisis de laboratorio y valores de referencia normales.
   - Esquema y edades recomendadas de vacunas infantiles.
   (Acceso sin restricciones para visualizacion en recetas, citas y resultados).

2. Informacion Confidencial:
   - Datos personales y de contacto del paciente (telefonos, correo electronico, direccion residencial).
   - Datos de contacto y parentesco de tutores legales.
   (Protegida mediante control de acceso por roles institucionales y no expuesta en reportes de libre acceso).

3. Informacion Restringida:
   - Historial de diagnosticos, gravedad y tratamientos farmacologicos.
   - Valores obtenidos en analisis de laboratorio clinico.
   - Procedimientos odontologicos, costos y observaciones operatorias.
   - Motivos de baja o archivo de historiales medicos (fallecimiento, traslados).
   (Acceso exclusivo para el personal medico autorizado con registro de traza y auditoria).

---

## 6. Arquitectura Hexagonal y Enrutamiento por Usuario

1. Nucleo de Dominio (Core):
   - Entidades: Patient, Consultation, Diagnosis, Treatment, Institution.
   - Servicios de Dominio: MedicalRecordService (aplica las reglas de negocio identicas para todos los establecimientos).
2. Puerto (Port):
   - MedicalRecordRepositoryPort: Define la interfaz unificada de operaciones.
3. Adaptadores (Adapters):
   - PostgresAdapter: Sentencias SQL y transacciones en PostgreSQL.
   - MySQLAdapter: Sentencias SQL y dialecto MySQL con soporte de piezas dentales.
   - MongoAdapter: Operaciones MQL/BSON en MongoDB con embebido de parametros.
   - FirestoreAdapter: Operaciones documentales con subcolecciones y tutores embebidos en Firestore.
4. Enrutamiento por Usuario (InstitutionRouterService):
   - Al iniciar sesion o seleccionar el establecimiento en la pantalla de bienvenida o barra superior, el enrutador inspecciona el establecimiento activo y asocia automaticamente sus solicitudes al adaptador correspondiente sin que la logica de negocio deba ser modificada.
