-- Esquema DDL y datos iniciales para Clinica Odontologica
-- Motor: MySQL (InnoDB)

CREATE DATABASE IF NOT EXISTS clinica_odontologica;
USE clinica_odontologica;

CREATE TABLE IF NOT EXISTS paciente_clinica (
    id_paciente INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL,
    apellido VARCHAR(80) NOT NULL,
    fecha_nacimiento DATE,
    telefono VARCHAR(20),
    correo VARCHAR(100),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    motivo_baja VARCHAR(255) NULL,
    fecha_baja DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS odontologo (
    id_odontologo INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL,
    apellido VARCHAR(80) NOT NULL,
    especialidad VARCHAR(100) NOT NULL,
    numero_colegiado VARCHAR(30) NOT NULL UNIQUE,
    telefono VARCHAR(20)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cita_clinica (
    id_cita INT AUTO_INCREMENT PRIMARY KEY,
    id_paciente INT NOT NULL,
    id_odontologo INT NULL,
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    motivo VARCHAR(150) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'programada',
    CONSTRAINT fk_cita_paciente FOREIGN KEY (id_paciente) REFERENCES paciente_clinica(id_paciente) ON DELETE CASCADE,
    CONSTRAINT fk_cita_odontologo FOREIGN KEY (id_odontologo) REFERENCES odontologo(id_odontologo) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS diagnostico (
    id_diagnostico INT AUTO_INCREMENT PRIMARY KEY,
    id_cita INT NOT NULL,
    descripcion VARCHAR(300) NOT NULL,
    codigo_referencia VARCHAR(20),
    gravedad VARCHAR(20) DEFAULT 'Leve',
    fecha_diagnostico DATE NOT NULL,
    CONSTRAINT fk_diag_cita FOREIGN KEY (id_cita) REFERENCES cita_clinica(id_cita) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS procedimiento (
    id_procedimiento INT AUTO_INCREMENT PRIMARY KEY,
    id_cita INT NOT NULL,
    tipo_procedimiento VARCHAR(100) NOT NULL,
    pieza_dental VARCHAR(10),
    costo DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    observaciones VARCHAR(300),
    CONSTRAINT fk_proc_cita FOREIGN KEY (id_cita) REFERENCES cita_clinica(id_cita) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medicamento (
    id_medicamento INT AUTO_INCREMENT PRIMARY KEY,
    id_diagnostico INT NOT NULL,
    nombre_comercial VARCHAR(100) NOT NULL,
    principio_activo VARCHAR(100),
    dosis VARCHAR(100) NOT NULL,
    frecuencia VARCHAR(100) NOT NULL,
    CONSTRAINT fk_med_diag FOREIGN KEY (id_diagnostico) REFERENCES diagnostico(id_diagnostico) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insercion de odontologos
INSERT IGNORE INTO odontologo (id_odontologo, nombre, apellido, especialidad, numero_colegiado, telefono) VALUES
(1, 'Sofia', 'Mendoza', 'Odontologia General y Estetica', 'COL-OD-1290', '5553-2001'),
(2, 'Rodrigo', 'Alvarez', 'Endodoncia y Cirugia Oral', 'COL-OD-1402', '5553-2002');

-- Insercion de pacientes
INSERT IGNORE INTO paciente_clinica (id_paciente, nombre, apellido, fecha_nacimiento, telefono, correo, activo) VALUES
(1, 'Lucia', 'Fernandez Ramos', '1995-03-14', '5554-3001', 'lucia.fernandez@email.com', TRUE),
(2, 'Mario', 'Estrada Cruz', '1988-07-29', '5554-3002', 'mario.estrada@email.com', TRUE),
(3, 'Carla', 'Pinto Barrios', '1990-12-10', '5554-3003', 'carla.pinto@email.com', FALSE);

UPDATE paciente_clinica SET motivo_baja = 'Causa administrativa: Cambio de residencia al extranjero', fecha_baja = NOW() - INTERVAL 5 DAY WHERE id_paciente = 3;

-- Insercion de citas
INSERT IGNORE INTO cita_clinica (id_cita, id_paciente, id_odontologo, fecha, hora, motivo, estado) VALUES
(1, 1, 1, '2026-10-20', '14:00:00', 'Limpieza dental y revision de molestia en molar', 'atendida'),
(2, 2, 2, '2026-11-03', '16:30:00', 'Dolor agudo con bebidas frias en premolar superior', 'atendida');

-- Insercion de diagnosticos
INSERT IGNORE INTO diagnostico (id_diagnostico, id_cita, descripcion, codigo_referencia, gravedad, fecha_diagnostico) VALUES
(1, 1, 'Gingivitis marginal leve y placa bacteriana', 'K05.1', 'Leve', '2026-10-20'),
(2, 2, 'Caries dentinaria profunda en pieza 24', 'K02.1', 'Moderada', '2026-11-03');

-- Insercion de procedimientos
INSERT IGNORE INTO procedimiento (id_procedimiento, id_cita, tipo_procedimiento, pieza_dental, costo, observaciones) VALUES
(1, 1, 'Profilaxis Dental con Ultrasonido', 'Todas', 250.00, 'Limpieza completa sin complicaciones'),
(2, 2, 'Obturacion con Resina Fotocurable', 'Pieza 24', 420.00, 'Aislamiento absoluto y colocacion de base cavitaria');

-- Insercion de medicamentos
INSERT IGNORE INTO medicamento (id_medicamento, id_diagnostico, nombre_comercial, principio_activo, dosis, frecuencia) VALUES
(1, 1, 'Perio-Aid Colutorio', 'Clorhexidina 0.12%', '15 ml enjuague', 'Cada 12 horas por 7 dias'),
(2, 2, 'Ketorolaco', 'Ketorolaco Trometamina 10mg', '1 tableta sublingual', 'Cada 8 horas en caso de dolor');
