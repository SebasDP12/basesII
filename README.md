# SaludRed - Plataforma Unificada de Historiales Clínicos Multi-Motor

**Universidad Rafael Landívar**  
**Facultad de Ingeniería | Ingeniería en Informática y Sistemas**  
**Curso:** Bases de Datos II  
**Proyecto Final - Entrega II**  

### Autores
* **Angel Sebastian de Paz Mejia** – Carné: 1567823
* **Rocio Iveth Cojulum Juarez** – Carné: 1547023

---

## 📋 Descripción del Proyecto

El sistema provee una plataforma integral de historiales clínicos compartida entre cuatro instituciones médicas independientes, donde cada institución persiste su información en una infraestructura de base de datos diferente y especializada:

| Institución | Motor de Base de Datos | Tipo | Rol / Usuario Demo |
|---|---|---|---|
| **Hospital General** | **PostgreSQL** (:5432) | Relacional (ACID Estricto) | Dr. Carlos Ramírez (Medicina Interna) |
| **Clínica Odontológica** | **MySQL** (:3306) | Relacional (InnoDB Ágil) | Dra. Sofía Mendoza & Recepción |
| **Laboratorio Clínico** | **MongoDB** (:27017) | NoSQL Documental (BSON) | Lic. Marco Tulio Peña (Bacteriólogo) |
| **Centro Médico Pediátrico** | **Firebase Firestore** (:8080) | NoSQL Documental / Tiempo Real | Dra. Elena Castillo (Pediatría) |

---

## 🏗️ Arquitectura Hexagonal (Puertos y Adaptadores)

La solución utiliza la Arquitectura Hexagonal para desacoplar el núcleo de negocio de la tecnología de persistencia:

```
[Cliente Web Unificado]
         │ (HTTP REST / JSON)
         ▼
[Controladores HTTP Express]
         │
         ▼
[Core de Dominio: MedicalRecordService]
         │
[Puerto: MedicalRecordRepositoryPort]
         │
         ├───▶ [PostgresAdapter]    ───▶ PostgreSQL 16 (hospital_general)
         ├───▶ [MySQLAdapter]       ───▶ MySQL 8.0 (clinica_odontologica)
         ├───▶ [MongoAdapter]       ───▶ MongoDB 7.0 (laboratorio_clinico)
         └───▶ [FirestoreAdapter]   ───▶ Firebase Firestore (pediatria-project)
```

Al autenticarse o alternar el usuario activo, el componente `InstitutionRouterService` enruta automáticamente todas las operaciones al adaptador correspondiente sin que ninguna regla de negocio o pantalla de usuario deba reescribirse.

---

## 🐳 Ejecución con Docker Compose (Recomendado)

El proyecto incluye un entorno multicontenedor con los 4 motores de base de datos preconfigurados con sus respectivos scripts de inicialización:

```bash
# 1. Levantar todos los contenedores en segundo plano
docker compose up -d

# 2. Verificar que los 5 contenedores estén corriendo
docker compose ps

# 3. Acceder a la aplicación web en el navegador:
http://localhost:3000
```

### Contenedores generados:
1. `bases2_postgres_hospital`: PostgreSQL 16 con base de datos `hospital_general` y esquemas DDL inicializados.
2. `bases2_mysql_odonto`: MySQL 8.0 con base de datos `clinica_odontologica` y esquemas DDL inicializados.
3. `bases2_mongo_lab`: MongoDB 7.0 con base de datos `laboratorio_clinico` y colecciones `pacientes`, `catalogo_examenes` y `ordenes_examen`.
4. `bases2_firestore_pediatria`: Emulador oficial de Firebase Firestore en el puerto 8080.
5. `bases2_app`: Servidor web Node.js con frontend y backend integrados en el puerto 3000.

---

## 💻 Ejecución Local (Sin Docker)

Si prefieres ejecutar el servidor Node.js directamente en tu máquina:

```bash
# Instalar dependencias
npm install

# Iniciar la aplicación
npm start
```
La aplicación se iniciará en `http://localhost:3000`. Dispone de un fallback local resiliente en caso de que alguno de los motores aún no haya sido levantado.

---

## ✨ Funcionalidades Principales

1. **Enrutamiento por Usuario:** Permite cambiar instantáneamente entre los 4 establecimientos médicos desde la barra superior, cambiando de forma transparente el motor subyacente.
2. **Visualización Unificada:** La vista de historiales clínicos, consultas pasadas, recetas, procedimientos y resultados mantiene una interfaz consistente y ordenada para todos los motores.
3. **Generación de Nuevos Historiales Clínicos:** Formulario completo para dar de alta pacientes de nuevo ingreso con campos adaptativos según la institución.
4. **Mantenimiento de Historiales:** Registro de nuevas consultas, diagnósticos médicos, prescripciones de medicamentos, procedimientos odontológicos con piezas y costos, órdenes de laboratorio con parámetros dinámicos, y controles pediátricos de peso, talla y vacunas.
5. **Baja y Archivo de Historiales:** Módulo de desactivación y archivo de expedientes por causas de la rúbrica (traslado a otra institución, fallecimiento, o causas administrativas) con auditoría y opción de reactivación.
6. **Inspector Hexagonal & Traza de Consultas en Vivo:** Consola que muestra en tiempo real las consultas exactas ejecutadas en cada motor (SQL para Postgres y MySQL, MQL para MongoDB, y operaciones de documentos para Firestore).
7. **Documento Comparativo Integrado:** Acceso y descarga directa del documento comparativo oficial de la Entrega II.

---

## 📄 Documentación Académica

El documento comparativo completo con las justificaciones de modelado, decisiones de datos embebidos vs referenciados, garantías transaccionales y seguridad se encuentra en:
* [DOCUMENTO_COMPARATIVO_ENTREGA_II.md](DOCUMENTO_COMPARATIVO_ENTREGA_II.md)
