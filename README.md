# SaludRed - Plataforma Unificada de Historiales Clinicos Multi-Motor

Plataforma de administracion de historiales clinicos compartida entre cuatro instituciones medicas independientes con persistencia en motores heterogeneos bajo Arquitectura Hexagonal.

---

## 1. Distribucion de Motores por Institucion

| Institucion | Motor de Base de Datos | Tipo | Rol / Usuario Demo | Puerto |
|---|---|---|---|---|
| **Hospital General** | **PostgreSQL** | Relacional (ACID Estricto) | Dr. Carlos Ramirez (Medicina Interna) | 5432 |
| **Clinica Odontologica** | **MySQL** | Relacional (InnoDB Agil) | Dra. Sofia Mendoza & Recepcion | 3307 |
| **Laboratorio Clinico** | **MongoDB** | NoSQL Documental (BSON) | Lic. Marco Tulio Pena (Bacteriologo) | 27017 |
| **Centro Medico Pediatrico** | **Firebase Firestore** | NoSQL Documental / Tiempo Real | Dra. Elena Castillo (Pediatria) | 8080 |

---

## 2. Arquitectura Hexagonal (Puertos y Adaptadores)

```
[Cliente Web Unificado / Portal General]
                  | (HTTP REST / JSON)
                  v
    [Controladores HTTP Express]
                  |
                  v
[Core de Dominio: MedicalRecordService]
                  |
 [Puerto: MedicalRecordRepositoryPort]
                  |
  +---------------+---------------+---------------+
  |               |               |               |
  v               v               v               v
[PostgresAdapter] [MySQLAdapter]  [MongoAdapter]  [FirestoreAdapter]
  |               |               |               |
  v               v               v               v
PostgreSQL:5432  MySQL:3307     MongoDB:27017   Firestore:8080
```

---

## 3. Ejecucion con Docker Compose

```bash
# 1. Iniciar los 4 motores de bases de datos
docker compose up -d

# 2. Verificar estado de los contenedores
docker compose ps

# 3. Iniciar la aplicacion web
npm start
```

Abrir en el navegador:
`http://localhost:3000`

---

## 4. Pantallas de la Interfaz

1. **Portal General de Acceso:** Pantalla principal con tarjetas de seleccion para los cuatro establecimientos medicos (Hospital General, Clinica Odontologica, Laboratorio Clinico y Centro Medico Pediatrico).
2. **Pantallas Exclusivas por Establecimiento:** Cada establecimiento dispone de una interfaz dedicada con:
   - Historiales clinicos del centro
   - Alta de nuevos pacientes
   - Registro de consultas, diagnosticos y prescripciones/procedimientos
   - Archivo y auditoria de bajas
   - Inspector de sentencias SQL y MQL en tiempo real
3. **Documento Comparativo Integrado:** Resumen comparativo de motores, consistencia y modelado documental embebido vs referenciado.
