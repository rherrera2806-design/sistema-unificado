-- ═══════════════════════════════════════════════════════
-- VitroFlow - Script de Base de Datos: Módulo Asistencia
-- ═══════════════════════════════════════════════════════

-- ═══════ TABLA: TRABAJADORES ═══════
CREATE TABLE IF NOT EXISTS trabajadores (
    id SERIAL PRIMARY KEY,
    rut VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ═══════ TABLA: ASISTENCIA (Faltas) ═══════
-- Si un trabajador NO está en esta tabla el día X, significa que ASISTIÓ
CREATE TABLE IF NOT EXISTS asistencia (
    id SERIAL PRIMARY KEY,
    trabajador_id INTEGER REFERENCES trabajadores(id),
    fecha DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(trabajador_id, fecha)
);

-- ═══════ TABLA: PERMISOS ═══════
CREATE TABLE IF NOT EXISTS permisos (
    id SERIAL PRIMARY KEY,
    trabajador_id INTEGER REFERENCES trabajadores(id),
    tipo VARCHAR(50) NOT NULL, -- medico, personal, familiar, otro
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    horas NUMERIC(5,2) DEFAULT 0, -- horas del permiso (jornada=8hrs/dia)
    motivo TEXT,
    estado VARCHAR(20) DEFAULT 'pendiente', -- pendiente, aprobado, rechazado
    created_at TIMESTAMP DEFAULT NOW()
);

-- ═══════ TABLA: VACACIONES ═══════
CREATE TABLE IF NOT EXISTS vacaciones (
    id SERIAL PRIMARY KEY,
    trabajador_id INTEGER REFERENCES trabajadores(id),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    dias INTEGER NOT NULL,
    estado VARCHAR(20) DEFAULT 'programado', -- programado, en_curso, completado
    created_at TIMESTAMP DEFAULT NOW()
);

-- ═══════ TABLA: LICENCIAS MÉDICAS ═══════
CREATE TABLE IF NOT EXISTS licencias_medicas (
    id SERIAL PRIMARY KEY,
    trabajador_id INTEGER REFERENCES trabajadores(id),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    diagnostico TEXT,
    medico VARCHAR(200),
    estado VARCHAR(20) DEFAULT 'pendiente', -- pendiente, aprobada, rechazada
    created_at TIMESTAMP DEFAULT NOW()
);

-- ═══════ TABLA: HORAS EXTRAS ═══════
CREATE TABLE IF NOT EXISTS horas_extras (
    id SERIAL PRIMARY KEY,
    trabajador_id INTEGER REFERENCES trabajadores(id),
    fecha DATE NOT NULL,
    horas DECIMAL(4,2) NOT NULL,
    motivo TEXT,
    estado VARCHAR(20) DEFAULT 'pendiente', -- pendiente, aprobada, rechazada
    created_at TIMESTAMP DEFAULT NOW()
);

-- ═══════ ÍNDICES ═══════
CREATE INDEX IF NOT EXISTS idx_asistencia_fecha ON asistencia(fecha);
CREATE INDEX IF NOT EXISTS idx_asistencia_trabajador ON asistencia(trabajador_id);
CREATE INDEX IF NOT EXISTS idx_permisos_trabajador ON permisos(trabajador_id);
CREATE INDEX IF NOT EXISTS idx_licencias_trabajador ON licencias_medicas(trabajador_id);
CREATE INDEX IF NOT EXISTS idx_vacaciones_trabajador ON vacaciones(trabajador_id);
CREATE INDEX IF NOT EXISTS idx_horas_extras_trabajador ON horas_extras(trabajador_id);
CREATE INDEX IF NOT EXISTS idx_horas_extras_fecha ON horas_extras(fecha);

-- ═══════ DATOS INICIALES: TRABAJADORES ═══════
INSERT INTO trabajadores (rut, nombre) VALUES
('13.335.091-8', 'Acevedo Caro Roberto Alejandro'),
('20.389.186-5', 'Aguilera Delso Matias'),
('15.478.614-7', 'Alvarez Valdes Juan Pablo'),
('16.323.495-5', 'Amengual Rodriguez Jaime'),
('19.879.281-0', 'Badilla Diaz José'),
('18.669.713-8', 'Benites Tapia Benjamin'),
('12.270.153-0', 'Berrios Palma Claudio'),
('21.000.394-0', 'Brinceño Olivera Ignacio'),
('10.762.952-1', 'Bustos Marchant Miguel Segundo'),
('10.783.564-4', 'Caro Juan adrian'),
('17.292.336-3', 'Carrasco Silva Marcelo Andres'),
('10.479.755-5', 'Castro Riveros Jose Bernardino'),
('16.068.883-5', 'Diaz Canio Daniel'),
('19.562.313-9', 'Diaz Canio Jonathan'),
('14.505.292-1', 'Garcia Rojas Ruben Antonio'),
('17.599.826-K', 'Gonzalez Tapia Rodrigo'),
('7.953.632-6', 'Guajardo Hernandez Victor Hugo'),
('18.664.673-7', 'Guzman Rivas Alejandro'),
('25.619.603-4', 'Guerrier Charles'),
('17.303.296-7', 'Herrera Guzman Luis'),
('19.439.127-7', 'Latorre Pereira Lukas'),
('18.609.618-7', 'Latorre Pereira Nicolas Francisco'),
('11.884.408-6', 'Latorre Reozao Carlos'),
('21.820.888-6', 'Lavado Carrasco Matias'),
('13.491.855-1', 'Mardones Contreras Rodrigo Esteban'),
('17.923.815-2', 'Miranda Gonzalez Christopher'),
('22.407.550-2', 'Moya Abarca Gabriel'),
('19.820.081-6', 'Nuñez Nicolas'),
('16.561.894-7', 'Osorio Chavez Juan Pablo'),
('12.763.896-9', 'Otarola Cifuentes Nicolas'),
('18.686.096-K', 'Riveros Maiko'),
('17.292.998-2', 'Riveros Muñozeta Victor'),
('17.309.638-0', 'Robles Mery Borys'),
('16.423.587-4', 'Robles Mery Rodrigo'),
('22.062.856-6', 'Robles Diaz Felipe'),
('15.837.700-2', 'Rojas Valenzuela Johnny'),
('14.600.330-3', 'Rojas Lobos fransisco'),
('20.455.197-7', 'Rozas Gonzalez Fernando'),
('12.277.886-5', 'Sáez Peña Miguel Enrique'),
('19.279.263-0', 'Sanchez Gonzalez Jose'),
('10.530.444-7', 'Serrano Luis Ignacio'),
('18.200.089-2', 'Silva Morales Miguel'),
('12.176.581-0', 'Silva Cristian Fabian'),
('15.461.377-7', 'Tabilo Garrido Rodrigo Andres'),
('18.881.877-3', 'Tobar Armiño Francisco Javier'),
('12.548.391-7', 'Torres Palma Cristian Antonio'),
('13.450.590-7', 'Valenzuela Juan Marcelo'),
('10.926.585-3', 'Vasquez Soto Marcelo Fernando'),
('20.435.661-1', 'Vidal Ceballos Sebastian'),
('19.312.001-6', 'Vidal Luis')
ON CONFLICT (rut) DO NOTHING;

-- ═══════ VERIFICACIÓN ═══════
SELECT COUNT(*) as total_trabajadores FROM trabajadores;
