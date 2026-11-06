# Proyecto Final: Bases de Datos II
## Entrega II: Aplicación Multi-Motor con Arquitectura Hexagonal y Documento Comparativo

**Universidad Rafael Landívar**  
**Facultad de Ingeniería**  
**Ingeniería en Informática y Sistemas**  
**Curso:** Bases de Datos II  
**Estudiantes:**  
- Angel Sebastian de Paz Mejia – Carné: 1567823  
- Rocio Iveth Cojulum Juarez – Carné: 1547023  

---

## 1. Introducción y Contexto del Caso

El presente proyecto implementa una plataforma unificada para una red de cuatro instituciones médicas independientes que comparten una interfaz común para la consulta y administración de historiales clínicos, pero manteniendo infraestructuras de datos heterogéneas, independientes y especializadas.

Para habilitar este desacoplamiento técnico y permitir que la lógica de negocio permanezca intacta al cambiar o enrutar operaciones entre diferentes motores de bases de datos, se aplicó la **Arquitectura Hexagonal (Puertos y Adaptadores)**.

Las cuatro instituciones y los cuatro motores seleccionados sin repetición son:
1. **Hospital General** $\rightarrow$ **PostgreSQL**
2. **Clínica Odontológica** $\rightarrow$ **MySQL**
3. **Laboratorio Clínico** $\rightarrow$ **MongoDB**
4. **Centro Médico Pediátrico** $\rightarrow$ **Firebase Firestore**

---

## 2. Justificación Técnica de la Asignación de Motores por Institución

### 2.1 Hospital General $\rightarrow$ PostgreSQL
* **Necesidad del negocio:** Requiere un control estricto sobre citas, diagnósticos y tratamientos clínicos. La prioridad es la **fuerte integridad transaccional (ACID)**; bajo ninguna circunstancia puede perderse un diagnóstico a medias o registrarse una medicación sin un diagnóstico asociado.
* **Justificación técnica:** PostgreSQL es un motor objeto-relacional de nivel empresarial con soporte avanzado para niveles de aislamiento transaccional (Read Committed, Repeatable Read y Serializable). Ofrece soporte estricto de claves foráneas con restricciones en cascada (`ON DELETE CASCADE / RESTRICT`), validaciones de dominio (`CHECK`), transacciones atómicas con sentencias `BEGIN ... COMMIT / ROLLBACK` y máxima confiabilidad en operaciones de misión crítica hospitalaria.

### 2.2 Clínica Odontológica $\rightarrow$ MySQL
* **Necesidad del negocio:** Clínica dental de menor escala que no dispone de equipo técnico propio y prioriza la rapidez de atención al paciente por medio de recepcionistas y secretarias. Su flujo consiste en agendar citas rápidas, vincular procedimientos a piezas dentales específicas y facturar tratamientos.
* **Justificación técnica:** MySQL con su motor de almacenamiento transaccional **InnoDB** brinda alta velocidad de respuesta en lecturas y escrituras cotidianas, soporte de índices B-Tree de alta velocidad y bloqueos a nivel de fila (*row-level locking*). Es ideal para un modelo relacional estandarizado y liviano, con amplia disponibilidad en servidores y facilidad de administración para PYMES sin requerir administradores de bases de datos (DBA) dedicados.

### 2.3 Laboratorio Clínico $\rightarrow$ MongoDB
* **Necesidad del negocio:** Procesa resultados de exámenes cuya estructura varía radicalmente según el tipo de prueba. Por ejemplo, una hematología completa mide hemoglobina, hematocrito, leucocitos y plaquetas; un examen general de orina evalúa aspecto físico, pH, densidad y sedimentos; mientras que un perfil lipídico evalúa fracciones de colesterol y triglicéridos. En un modelo relacional tradicional esto ocasiona tablas dispersas o el anti-patrón EAV (*Entity-Attribute-Value*).
* **Justificación técnica:** MongoDB ofrece un modelo documental **NoSQL flexible basado en documentos BSON**, permitiendo almacenar esquemas polimórficos de forma nativa sin migraciones de esquema (*schema-less*). Los diferentes exámenes y sus resultados se modelan como documentos JSON/BSON ricos, permitiendo consultar rápidamente el historial analítico completo de cualquier prueba.

### 2.4 Centro Médico Pediátrico $\rightarrow$ Firebase Firestore
* **Necesidad del negocio:** Administra historiales con seguimiento frecuente por paciente infantil (curvas de control de crecimiento, peso en kg, talla en cm, observaciones de desarrollo) y esquemas continuos de vacunación. Adicionalmente, todo paciente menor de edad depende obligatoriamente de un tutor o encargado legal que autoriza la atención médica.
* **Justificación técnica:** Firestore es una base de datos documental en la nube/tiempo real orientada a consultas rápidas y de corta duración. Su modelo de documentos y colecciones es idóneo para integrar fichas pediátricas sincronizables en dispositivos móviles o web clínicos, con soporte nativo de subcolecciones para controles y cartilla de vacunas.

---

## 3. Decisiones de Modelado Documental (Embebido vs Referenciado)

Uno de los requerimientos centrales de la evaluación es justificar explícitamente qué datos se embeben y cuáles se referencian en los motores NoSQL:

### 3.1 MongoDB (Laboratorio Clínico)
* **Datos Referenciados:**  
  La colección `ordenes_examen` está **referenciada** mediante el campo `id_paciente`.  
  *Justificación:* A lo largo de los años, un paciente puede realizarse cientos o miles de análisis de laboratorio. Si embebiéramos todas las órdenes dentro del documento del paciente, violaríamos el límite estricto de **16 MB por documento de MongoDB** y sobrecargaríamos la memoria RAM innecesariamente al consultar datos generales del paciente.
* **Datos Embebidos:**  
  Dentro de cada orden de examen, la lista de `resultados` (parámetro, unidad de medida, valor de referencia y valor obtenido) se encuentra **embebida** directamente como un arreglo de subdocumentos.  
  *Justificación:* Cuando un médico o paciente revisa una orden de laboratorio, siempre requiere ver todos sus parámetros juntos en el mismo instante. Embeberlos garantiza que la orden completa se recupere en una sola operación de lectura I/O de disco atómica, eliminando la necesidad de realizar costosos `$lookup` (JOINs relacionales).

### 3.2 Firebase Firestore (Centro Médico Pediátrico)
* **Datos Embebidos:**  
  Los datos de contacto y parentesco del **tutor legal** se encuentran **embebidos** dentro del documento del paciente (`pacientes/{id}/tutor: { nombre, parentesco, telefono, correo, direccion }`).  
  *Justificación:* Cada atención médica pediátrica requiere validar inmediatamente quién es el responsable legal y su número de contacto de emergencia. Embeber esta información permite obtener la ficha completa del menor en **una única lectura de documento (1 single document read)** en Firestore, optimizando el costo de facturación por lecturas y la latencia en red.
* **Datos Referenciados / Subcolecciones:**  
  Las consultas periódicas de crecimiento (peso, talla) y el registro de dosis de vacunación se almacenan en **subcolecciones** (`consultas` y `vacunaciones`).  
  *Justificación:* Dado que un niño en sus primeros años asiste a consultas casi mensualmente, separar las consultas en subcolecciones evita que el documento raíz del paciente sobrepase el límite de 1 MB de Firestore y permite consultar resúmenes sin descargar todo el historial histórico masivo.

---

## 4. Garantías de Consistencia y Manejo de Transacciones

| Motor | Mecanismo de Consistencia | Estrategia de Transacciones Implementada |
|---|---|---|
| **PostgreSQL (Hospital)** | ACID estricto con Aislamiento Read Committed / Serializable | Bloques transaccionales con `BEGIN ... COMMIT / ROLLBACK`. La creación de la cita, diagnóstico y tratamiento se ejecutan como una unidad indivisible en la misma conexión. |
| **MySQL (Odontología)** | ACID con motor transaccional InnoDB | Uso de `START TRANSACTION ... COMMIT` con bloqueos a nivel de fila y claves foráneas en cascada. El registro del procedimiento dental (pieza y costo), diagnóstico y receta es completamente atómico. |
| **MongoDB (Laboratorio)** | Consistencia Fuerte por Documento / Modelo BSON | Atomicidad a nivel de documento individual. El guardado de la orden con todos sus resultados y parámetros embebidos se ejecuta atómicamente en un solo `insertOne` o `updateOne`. |
| **Firebase Firestore (Pediatría)** | Consistencia Serializada en Documentos y Batched Writes | Escrituras atómicas por lote (*batched writes*) y transacciones nativas de Firestore, asegurando que el documento del menor y sus controles no entren en estados inconsistentes. |

---

## 5. Aplicación de Seguridad y Clasificación de la Información

Siguiendo el levantamiento de información realizado en la Entrega I, el sistema aplica una estricta clasificación de los datos en tres niveles:

1. **Información Pública:**
   - Nombres, colegiados y especialidades de médicos y odontólogos.
   - Catálogo de tipos de análisis de laboratorio y valores de referencia normales.
   - Esquema y edades recomendadas de vacunas infantiles.
   *(Acceso sin restricciones para visualización en recetas, citas y resultados).*

2. **Información Confidencial:**
   - Datos personales y de contacto del paciente (teléfonos, correo electrónico, dirección residencial).
   - Datos de contacto y parentesco de tutores legales.
   *(Protegida mediante control de acceso por roles institucionales y no expuesta en reportes de libre acceso).*

3. **Información Restringida:**
   - Historial de diagnósticos, gravedad y tratamientos farmacológicos.
   - Valores obtenidos en análisis de laboratorio clínico.
   - Procedimientos odontológicos, costos y observaciones operatorias.
   - Motivos de baja o archivo de historiales médicos (fallecimiento, traslados).
   *(Acceso exclusivo para el personal médico/odontológico autorizado con registro de traza y auditoría).*

---

## 6. Arquitectura Hexagonal y Enrutamiento por Usuario

### 6.1 Componentes Implementados
1. **Núcleo de Dominio (Core):**
   - Entidades: `Patient`, `Consultation`, `Diagnosis`, `Treatment`, `Institution`.
   - Servicios de Dominio: `MedicalRecordService` (aplica las reglas de negocio idénticas para todos los establecimientos).
2. **Puerto (Port):**
   - `MedicalRecordRepositoryPort`: Define la interfaz unificada de operaciones (`findAllPatients`, `findPatientById`, `createPatient`, `updatePatient`, `deactivatePatient`, `reactivatePatient`, `getClinicalHistory`, `recordMedicalEvent`, `healthCheck`).
3. **Adaptadores (Adapters):**
   - `PostgresAdapter`: Traduce las llamadas de dominio a sentencias SQL y transacciones en PostgreSQL.
   - `MySQLAdapter`: Traduce a sentencias SQL y dialecto MySQL con soporte de piezas dentales.
   - `MongoAdapter`: Traduce a operaciones MQL/BSON en MongoDB con embebido de parámetros.
   - `FirestoreAdapter`: Traduce a operaciones documentales con subcolecciones y tutores embebidos en Firestore.
4. **Enrutamiento por Usuario (`InstitutionRouterService`):**
   - Al iniciar sesión o alternar el establecimiento en la barra superior, el enrutador inspecciona el usuario autenticado y asocia automáticamente sus solicitudes al adaptador correspondiente sin que ninguna línea de la lógica de negocio o de la interfaz de usuario deba ser modificada.

---

## 7. Despliegue con Docker y Multi-Contenedores

El proyecto incluye un archivo `docker-compose.yml` que orquesta los 4 motores de bases de datos junto con el contenedor de la aplicación web:

- `hospital_postgres`: Contenedor oficial `postgres:16-alpine` en el puerto `5432`.
- `odontologia_mysql`: Contenedor oficial `mysql:8.0` en el puerto `3306`.
- `laboratorio_mongo`: Contenedor oficial `mongo:7.0` en el puerto `27017`.
- `pediatria_firestore`: Contenedor con el emulador oficial de Firestore en el puerto `8080`.
- `app`: Contenedor Node.js que ejecuta la aplicación web con la arquitectura hexagonal en el puerto `3000`.

### Comandos de Ejecución Rápida
```bash
# Iniciar todos los contenedores en segundo plano
docker compose up -d

# Ver el estado de los contenedores
docker compose ps

# Acceder a la aplicación web
# Abrir en el navegador: http://localhost:3000
```
