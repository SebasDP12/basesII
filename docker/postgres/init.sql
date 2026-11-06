-- ===============================================================
-- Hospital General - Base de Datos PostgreSQL
-- Base de Datos II - Universidad Rafael Landívar
-- ===============================================================

CREATE TABLE IF NOT EXISTS paciente_hospital (
    id_paciente SERIAL PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL,
    apellido VARCHAR(80) NOT NULL,
    fecha_nacimiento DATE NOT NULL,
    genero VARCHAR(20),
    telefono VARCHAR(20),
    direccion VARCHAR(150),
    correo VARCHAR(100),
    tipo_sangre VARCHAR(5),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    motivo_baja VARCHAR(255),
    fecha_baja TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS medico (
    id_medico SERIAL PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL,
    apellido VARCHAR(80) NOT NULL,
    especialidad VARCHAR(80) NOT NULL,
    numero_colegiado VARCHAR(30) NOT NULL UNIQUE,
    telefono VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS cita_hospital (
    id_cita SERIAL PRIMARY KEY,
    id_paciente INTEGER NOT NULL REFERENCES paciente_hospital(id_paciente) ON DELETE CASCADE,
    id_medico INTEGER NOT NULL REFERENCES medico(id_medico),
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    motivo VARCHAR(150) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'programada'
);

CREATE TABLE IF NOT EXISTS diagnostico (
    id_diagnostico SERIAL PRIMARY KEY,
    id_cita INTEGER NOT NULL REFERENCES cita_hospital(id_cita) ON DELETE CASCADE,
    descripcion VARCHAR(300) NOT NULL,
    codigo_referencia VARCHAR(20),
    gravedad VARCHAR(20) DEFAULT 'Moderada',
    fecha DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS tratamiento (
    id_tratamiento SERIAL PRIMARY KEY,
    id_diagnostico INTEGER NOT NULL REFERENCES diagnostico(id_diagnostico) ON DELETE CASCADE,
    medicamento VARCHAR(120) NOT NULL,
    dosis VARCHAR(80) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE
);

-- ===============================================================
-- Datos Iniciales de Demostración
-- ===============================================================

INSERT INTO medico (nombre, apellido, especialidad, numero_colegiado, telefono) VALUES
('Carlos', 'Ramírez', 'Medicina Interna', 'COL-48291', '5551-0101'),
('Mariana', 'López', 'Cardiología', 'COL-39102', '5551-0102'),
('Fernando', 'García', 'Traumatología', 'COL-51093', '5551-0103')
ON CONFLICT (numero_colegiado) DO NOTHING;

INSERT INTO paciente_hospital (nombre, apellido, fecha_nacimiento, genero, telefono, direccion, correo, tipo_sangre, activo) VALUES
('Juan', 'Pérez Morales', '1985-04-12', 'Masculino', '5552-1100', 'Zona 10, Ciudad de Guatemala', 'juan.perez@email.com', 'O+', TRUE),
('Ana', 'Gómez Méndez', '1992-09-23', 'Femenino', '5552-1101', 'Zona 11, Ciudad de Guatemala', 'ana.gomez@email.com', 'A+', TRUE),
('Roberto', 'Sánchez Solís', '1978-11-05', 'Masculino', '5552-1102', 'Mixco, Guatemala', 'roberto.sanchez@email.com', 'B+', FALSE)
ON CONFLICT DO NOTHING;

-- Si se insertó Roberto inactivo, actualizar motivo de baja
UPDATE paciente_hospital SET motivo_baja = 'Traslado a hospital especializado', fecha_baja = NOW() - INTERVAL '10 days' WHERE correo = 'roberto.sanchez@email.com' AND activo = FALSE;

-- Citas y consultas iniciales
INSERT INTO cita_hospital (id_paciente, id_medico, fecha, hora, motivo, estado) VALUES
(1, 1, '2026-10-15', '09:00:00', 'Control general de hipertensión arterial', 'atendida'),
(1, 2, '2026-11-02', '10:30:00', 'Evaluación cardiovascular preventiva', 'atendida'),
(2, 3, '2026-11-04', '11:00:00', 'Dolor en articulación de rodilla izquierda', 'atendida')
ON CONFLICT DO NOTHING;

-- Diagnósticos
INSERT INTO diagnostico (id_cita, descripcion, codigo_referencia, gravedad, fecha) VALUES
(1, 'Hipertensión arterial esencial estadio 1 bien controlada', 'I10', 'Moderada', '2026-10-15'),
(2, 'Bradicardia sinusal benigna en reposo', 'R00.1', 'Leve', '2026-11-02'),
(3, 'Tendinitis rotuliana por sobreesfuerzo', 'M76.5', 'Moderada', '2026-11-04')
ON CONFLICT DO NOTHING;

-- Tratamientos
INSERT INTO tratamiento (id_diagnostico, medicamento, dosis, fecha_inicio, fecha_fin) VALUES
(1, 'Losartán Potásico', '50mg cada 24 horas', '2026-10-15', '2027-04-15'),
(2, 'Vitamina E y Dieta Cardiosaludable', '400 UI cada 24 horas', '2026-11-02', '2026-12-02'),
(3, 'Ibuprofeno + Gel Fisioterapéutico', '400mg cada 8 horas con alimentos', '2026-11-04', '2026-11-14')
ON CONFLICT DO NOTHING;
