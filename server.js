const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// Configuración de base de datos para Render
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'control_empleados',
    port: process.env.DB_PORT || 3306,
    // Para MySQL de Render
    ssl: process.env.DB_SSL ? { rejectUnauthorized: false } : false
};

let db;

async function connectDB() {
    try {
        console.log('🔌 Intentando conectar a DB...');
        db = await mysql.createConnection(dbConfig);
        console.log('✅ Conectado a MySQL en Render');
        
        // Crear tablas si no existen
        await crearTablas();
    } catch (error) {
        console.error('❌ Error conectando a DB:', error.message);
        console.log('📝 Usando base de datos en memoria para demo...');
    }
}

async function crearTablas() {
    const crearTablasSQL = `
	    CREATE TABLE IF NOT EXISTS departamentos (
        id INT PRIMARY KEY AUTO_INCREMENT,
        nombre VARCHAR(100) NOT NULL,
        descripcion TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS turnos (
        id INT PRIMARY KEY AUTO_INCREMENT,
        empleado_id INT,
        fecha DATE NOT NULL,
        hora_entrada TIME,
        hora_comida TIME,
        hora_pausa TIME,
        hora_cena TIME,
        hora_salida TIME,
        horas_trabajadas DECIMAL(5,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (empleado_id) REFERENCES empleados(id)
    );

    CREATE TABLE IF NOT EXISTS reportes_generados (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tipo ENUM('excel', 'pdf') NOT NULL,
        empleado_id INT,
        fecha_inicio DATE,
        fecha_fin DATE,
        ruta_archivo VARCHAR(500),
        generado_por INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (empleado_id) REFERENCES empleados(id),
        FOREIGN KEY (generado_por) REFERENCES empleados(id)
    );

    INSERT IGNORE INTO departamentos (id, nombre, descripcion) VALUES
    (1, 'Cocina', 'Personal de cocina y preparación'),
    (2, 'Sala', 'Personal de atención al cliente'),
    (3, 'Administración', 'Personal administrativo'),
    (4, 'Limpieza', 'Personal de limpieza y mantenimiento');

    ALTER TABLE empleados ADD COLUMN IF NOT EXISTS departamento_id INT DEFAULT 1;
    ALTER TABLE empleados ADD COLUMN IF NOT EXISTS fecha_contratacion DATE;
    ALTER TABLE empleados ADD COLUMN IF NOT EXISTS salario DECIMAL(10,2);
    ALTER TABLE empleados ADD COLUMN IF NOT EXISTS telefono VARCHAR(15);
    ALTER TABLE empleados ADD COLUMN IF NOT EXISTS direccion TEXT;
	// ==================== RUTAS DE ADMINISTRACIÓN ====================

// Obtener todos los empleados con detalles
app.get('/api/admin/empleados', verificarRed, async (req, res) => {
    try {
        const [empleados] = await db.execute(`
            SELECT e.*, d.nombre as departamento_nombre 
            FROM empleados e 
            LEFT JOIN departamentos d ON e.departamento_id = d.id 
            ORDER BY e.nombre
        `);
        res.json(empleados);
    } catch (error) {
        console.error('Error obteniendo empleados:', error);
        res.status(500).json({ error: 'Error obteniendo empleados' });
    }
});

// Crear o actualizar empleado
app.post('/api/admin/empleados', verificarRed, async (req, res) => {
    const {
        id, documento_identidad, numero_seguridad_social, nombre, apellidos,
        pin_acceso, departamento_id, fecha_contratacion, salario, telefono,
        email, direccion, activo
    } = req.body;

    try {
        if (id) {
            // Actualizar empleado existente
            await db.execute(`
                UPDATE empleados SET 
                    documento_identidad = ?, numero_seguridad_social = ?, nombre = ?, apellidos = ?,
                    pin_acceso = ?, departamento_id = ?, fecha_contratacion = ?, salario = ?,
                    telefono = ?, email = ?, direccion = ?, activo = ?
                WHERE id = ?
            `, [
                documento_identidad, numero_seguridad_social, nombre, apellidos,
                pin_acceso, departamento_id, fecha_contratacion, salario,
                telefono, email, direccion, activo, id
            ]);
            res.json({ success: true, message: 'Empleado actualizado correctamente' });
        } else {
            // Crear nuevo empleado
            await db.execute(`
                INSERT INTO empleados (
                    documento_identidad, numero_seguridad_social, nombre, apellidos,
                    pin_acceso, departamento_id, fecha_contratacion, salario,
                    telefono, email, direccion, activo
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                documento_identidad, numero_seguridad_social, nombre, apellidos,
                pin_acceso, departamento_id, fecha_contratacion, salario,
                telefono, email, direccion, activo
            ]);
            res.json({ success: true, message: 'Empleado creado correctamente' });
        }
    } catch (error) {
        console.error('Error guardando empleado:', error);
        res.status(500).json({ success: false, message: 'Error guardando empleado' });
    }
});

// Obtener departamentos
app.get('/api/admin/departamentos', verificarRed, async (req, res) => {
    try {
        const [departamentos] = await db.execute('SELECT * FROM departamentos ORDER BY nombre');
        res.json(departamentos);
    } catch (error) {
        console.error('Error obteniendo departamentos:', error);
        res.status(500).json({ error: 'Error obteniendo departamentos' });
    }
});

// ==================== RUTAS DE REPORTES ====================

// Generar reporte de empleado
app.get('/api/reportes/empleado/:empleadoId', verificarRed, async (req, res) => {
    const { empleadoId } = req.params;
    const { fecha_inicio, fecha_fin, formato } = req.query;

    try {
        const [registros] = await db.execute(`
            SELECT r.*, e.nombre, e.apellidos 
            FROM registros r 
            JOIN empleados e ON r.empleado_id = e.id 
            WHERE r.empleado_id = ? 
            AND DATE(r.fecha_hora) BETWEEN ? AND ?
            ORDER BY r.fecha_hora DESC
        `, [empleadoId, fecha_inicio, fecha_fin]);

        const [empleado] = await db.execute(
            'SELECT * FROM empleados WHERE id = ?', 
            [empleadoId]
        );

        if (formato === 'excel') {
            // Generar Excel
            await generarExcelEmpleado(res, empleado[0], registros, fecha_inicio, fecha_fin);
        } else if (formato === 'pdf') {
            // Generar PDF
            await generarPDFEmpleado(res, empleado[0], registros, fecha_inicio, fecha_fin);
        } else {
            res.json({ empleado: empleado[0], registros });
        }
    } catch (error) {
        console.error('Error generando reporte:', error);
        res.status(500).json({ error: 'Error generando reporte' });
    }
});

// Generar reporte general
app.get('/api/reportes/general', verificarRed, async (req, res) => {
    const { fecha_inicio, fecha_fin, departamento_id, formato } = req.query;

    try {
        let query = `
            SELECT e.nombre, e.apellidos, d.nombre as departamento,
                   COUNT(r.id) as total_registros,
                   MIN(r.fecha_hora) as primer_registro,
                   MAX(r.fecha_hora) as ultimo_registro
            FROM empleados e
            LEFT JOIN departamentos d ON e.departamento_id = d.id
            LEFT JOIN registros r ON e.id = r.empleado_id 
                AND DATE(r.fecha_hora) BETWEEN ? AND ?
            WHERE e.activo = TRUE
        `;
        
        let params = [fecha_inicio, fecha_fin];
        
        if (departamento_id) {
            query += ' AND e.departamento_id = ?';
            params.push(departamento_id);
        }
        
        query += ' GROUP BY e.id ORDER BY e.nombre';

        const [reporte] = await db.execute(query, params);

        if (formato === 'excel') {
            await generarExcelGeneral(res, reporte, fecha_inicio, fecha_fin);
        } else if (formato === 'pdf') {
            await generarPDFGeneral(res, reporte, fecha_inicio, fecha_fin);
        } else {
            res.json(reporte);
        }
    } catch (error) {
        console.error('Error generando reporte general:', error);
        res.status(500).json({ error: 'Error generando reporte general' });
    }
});

// ==================== FUNCIONES DE GENERACIÓN DE REPORTES ====================

async function generarExcelEmpleado(res, empleado, registros, fechaInicio, fechaFin) {
    // Instalar: npm install excel4node
    const excel = require('excel4node');
    const workbook = new excel.Workbook();
    const worksheet = workbook.createWorksheet('Registros Empleado');

    // Estilos
    const headerStyle = workbook.createStyle({
        font: { bold: true, color: 'FFFFFF' },
        fill: { type: 'pattern', patternType: 'solid', fgColor: '4472C4' }
    });

    // Cabeceras
    worksheet.cell(1, 1).string('Nombre').style(headerStyle);
    worksheet.cell(1, 2).string('Documento').style(headerStyle);
    worksheet.cell(1, 3).string('Fecha').style(headerStyle);
    worksheet.cell(1, 4).string('Hora').style(headerStyle);
    worksheet.cell(1, 5).string('Tipo Registro').style(headerStyle);

    // Datos
    registros.forEach((registro, index) => {
        const fecha = new Date(registro.fecha_hora);
        worksheet.cell(index + 2, 1).string(`${empleado.nombre} ${empleado.apellidos}`);
        worksheet.cell(index + 2, 2).string(empleado.documento_identidad);
        worksheet.cell(index + 2, 3).string(fecha.toLocaleDateString());
        worksheet.cell(index + 2, 4).string(fecha.toLocaleTimeString());
        worksheet.cell(index + 2, 5).string(obtenerTipoRegistroTexto(registro.tipo_registro));
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=reporte-${empleado.documento_identidad}.xlsx`);
    
    await workbook.write('Reporte.xlsx', res);
}

async function generarPDFEmpleado(res, empleado, registros, fechaInicio, fechaFin) {
    // Instalar: npm install pdfkit
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=reporte-${empleado.documento_identidad}.pdf`);
    
    doc.pipe(res);
    
    // Contenido del PDF
    doc.fontSize(20).text('Reporte de Registros', { align: 'center' });
    doc.fontSize(12).text(`Empleado: ${empleado.nombre} ${empleado.apellidos}`);
    doc.text(`Documento: ${empleado.documento_identidad}`);
    doc.text(`Período: ${fechaInicio} a ${fechaFin}`);
    doc.moveDown();
    
    // Tabla de registros
    registros.forEach(registro => {
        const fecha = new Date(registro.fecha_hora);
        doc.text(`${fecha.toLocaleDateString()} ${fecha.toLocaleTimeString()} - ${obtenerTipoRegistroTexto(registro.tipo_registro)}`);
    });
    
    doc.end();
}

function obtenerTipoRegistroTexto(tipo) {
    const tipos = {
        'entrada': '🟢 Entrada',
        'comida': '🟡 Hora de Comida', 
        'pausa_fumar': '🟠 Pausa para Fumar',
        'cena': '🟡 Hora de Cena',
        'fin_turno': '🔴 Fin de Turno'
    };
    return tipos[tipo] || tipo;
}

// ==================== ESTADÍSTICAS ====================

app.get('/api/estadisticas/dashboard', verificarRed, async (req, res) => {
    try {
        const [totalEmpleados] = await db.execute('SELECT COUNT(*) as total FROM empleados WHERE activo = TRUE');
        const [empleadosHoy] = await db.execute(`
            SELECT COUNT(DISTINCT empleado_id) as total 
            FROM registros 
            WHERE DATE(fecha_hora) = CURDATE()
        `);
        const [registrosMes] = await db.execute(`
            SELECT COUNT(*) as total 
            FROM registros 
            WHERE MONTH(fecha_hora) = MONTH(CURDATE()) 
            AND YEAR(fecha_hora) = YEAR(CURDATE())
        `);

        res.json({
            totalEmpleados: totalEmpleados[0].total,
            empleadosActivosHoy: empleadosHoy[0].total,
            registrosEsteMes: registrosMes[0].total,
            promedioHoras: 8.5 // Esto sería un cálculo real
        });
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({ error: 'Error obteniendo estadísticas' });
    }
});

// Agregar esta ruta al servidor para servir el panel de admin
app.get('/admin-panel', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'admin-panel.html'));
});
`;
        CREATE TABLE IF NOT EXISTS empresas (
            id INT PRIMARY KEY AUTO_INCREMENT,
            nombre VARCHAR(255) NOT NULL,
            direccion TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS empleados (
            id INT PRIMARY KEY AUTO_INCREMENT,
            empresa_id INT DEFAULT 1,
            documento_identidad VARCHAR(20) UNIQUE NOT NULL,
            numero_seguridad_social VARCHAR(20) UNIQUE NOT NULL,
            nombre VARCHAR(100) NOT NULL,
            apellidos VARCHAR(100) NOT NULL,
            email VARCHAR(255),
            telefono VARCHAR(15),
            pin_acceso VARCHAR(4) NOT NULL,
            rol ENUM('admin', 'empleado') DEFAULT 'empleado',
            activo BOOLEAN DEFAULT TRUE,
            avatar_color VARCHAR(7) DEFAULT '#007AFF',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS registros (
            id INT PRIMARY KEY AUTO_INCREMENT,
            empleado_id INT,
            tipo_registro ENUM('entrada', 'comida', 'pausa_fumar', 'cena', 'fin_turno') NOT NULL,
            fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            latitud DECIMAL(10, 8),
            longitud DECIMAL(11, 8),
            direccion_ip VARCHAR(45),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        INSERT IGNORE INTO empresas (id, nombre, direccion) VALUES (
            1,
            'La Lumbre de Riva S.L.',
            'Calle Juan de La Cierva, 58 Rivas Vaciamadrid - Madrid'
        );

        INSERT IGNORE INTO empleados (id, documento_identidad, numero_seguridad_social, nombre, apellidos, pin_acceso, rol, avatar_color) VALUES
        (1, '12345678A', 'SS001', 'Juan', 'García López', '1234', 'admin', '#007AFF'),
        (2, '87654321B', 'SS002', 'María', 'Rodríguez Santos', '5678', 'empleado', '#34C759'),
        (3, '11223344C', 'SS003', 'Carlos', 'Martínez Ruiz', '9012', 'empleado', '#FF9500'),
        (4, '44332211D', 'SS004', 'Ana', 'Fernández García', '3456', 'empleado', '#FF3B30'),
        (5, '55667788E', 'SS005', 'Pedro', 'López Martín', '7890', 'empleado', '#AF52DE');
    `;

    const statements = crearTablasSQL.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
        if (statement.trim()) {
            try {
                await db.execute(statement + ';');
            } catch (error) {
                console.log('ℹ️  Tabla ya existe o error:', error.message);
            }
        }
    }
    console.log('✅ Tablas y datos iniciales creados');
}

// Middleware de red (simulado para demo)
const verificarRed = (req, res, next) => {
    console.log('🔍 Acceso desde:', req.ip);
    next();
};

// RUTAS API
app.post('/api/login', verificarRed, async (req, res) => {
    const { pin, documento } = req.body;
    
    try {
        if (!db) {
            // Demo mode - datos hardcodeados
            const empleadosDemo = [
                { id: 1, documento: '12345678A', pin: '1234', nombre: 'Juan', apellidos: 'García López', rol: 'admin', avatar_color: '#007AFF' },
                { id: 2, documento: '87654321B', pin: '5678', nombre: 'María', apellidos: 'Rodríguez Santos', rol: 'empleado', avatar_color: '#34C759' }
            ];
            
            const empleado = empleadosDemo.find(e => e.documento === documento && e.pin === pin);
            if (empleado) {
                return res.json({
                    success: true,
                    empleado: {
                        id: empleado.id,
                        nombre: empleado.nombre,
                        apellidos: empleado.apellidos,
                        rol: empleado.rol,
                        avatar_color: empleado.avatar_color
                    }
                });
            } else {
                return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
            }
        }

        const [rows] = await db.execute(
            'SELECT * FROM empleados WHERE documento_identidad = ? AND pin_acceso = ? AND activo = TRUE',
            [documento, pin]
        );
        
        if (rows.length > 0) {
            const empleado = rows[0];
            res.json({
                success: true,
                empleado: {
                    id: empleado.id,
                    nombre: empleado.nombre,
                    apellidos: empleado.apellidos,
                    rol: empleado.rol,
                    avatar_color: empleado.avatar_color
                }
            });
        } else {
            res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

app.get('/api/empleados-activos', verificarRed, async (req, res) => {
    try {
        if (!db) {
            // Datos demo
            return res.json([
                { id: 1, nombre: 'Juan', apellidos: 'García López', documento_identidad: '12345678A', rol: 'admin', avatar_color: '#007AFF' },
                { id: 2, nombre: 'María', apellidos: 'Rodríguez Santos', documento_identidad: '87654321B', rol: 'empleado', avatar_color: '#34C759' },
                { id: 3, nombre: 'Carlos', apellidos: 'Martínez Ruiz', documento_identidad: '11223344C', rol: 'empleado', avatar_color: '#FF9500' }
            ]);
        }

        const [rows] = await db.execute(
            'SELECT id, nombre, apellidos, documento_identidad, rol, avatar_color FROM empleados WHERE activo = TRUE ORDER BY nombre'
        );
        res.json(rows);
    } catch (error) {
        console.error('Error obteniendo empleados:', error);
        res.status(500).json({ error: 'Error obteniendo empleados' });
    }
});

app.post('/api/registro', verificarRed, async (req, res) => {
    const { empleado_id, tipo_registro, latitud, longitud } = req.body;
    
    try {
        if (!db) {
            console.log('📝 Registro demo:', { empleado_id, tipo_registro });
            return res.json({ success: true, message: 'Registro demo guardado' });
        }

        await db.execute(
            'INSERT INTO registros (empleado_id, tipo_registro, latitud, longitud, direccion_ip) VALUES (?, ?, ?, ?, ?)',
            [empleado_id, tipo_registro, latitud, longitud, req.ip]
        );
        
        res.json({ success: true, message: 'Registro guardado correctamente' });
    } catch (error) {
        console.error('Error guardando registro:', error);
        res.status(500).json({ success: false, message: 'Error guardando registro' });
    }
});

app.get('/api/estado-empleados', verificarRed, async (req, res) => {
    try {
        if (!db) {
            // Estados demo
            return res.json([
                { id: 1, nombre: 'Juan', apellidos: 'García López', avatar_color: '#007AFF', ultimo_registro: 'entrada', ultima_fecha: new Date() },
                { id: 2, nombre: 'María', apellidos: 'Rodríguez Santos', avatar_color: '#34C759', ultimo_registro: 'comida', ultima_fecha: new Date() }
            ]);
        }

        const [rows] = await db.execute(`
            SELECT e.id, e.nombre, e.apellidos, e.avatar_color,
                   r.tipo_registro as ultimo_registro,
                   r.fecha_hora as ultima_fecha
            FROM empleados e
            LEFT JOIN registros r ON e.id = r.empleado_id
            WHERE r.fecha_hora = (
                SELECT MAX(fecha_hora) 
                FROM registros 
                WHERE empleado_id = e.id
                AND DATE(fecha_hora) = CURDATE()
            )
            AND e.activo = TRUE
            ORDER BY r.fecha_hora DESC
        `);
        
        res.json(rows);
    } catch (error) {
        console.error('Error obteniendo estados:', error);
        res.status(500).json({ error: 'Error obteniendo estados' });
    }
});

// Servir archivos estáticos
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'admin.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'dashboard.html'));
});

// Health check para Render
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Inicializar
connectDB().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
        console.log(`🏢 La Lumbre de Riva S.L. - Sistema de Control`);
        console.log(`📍 URL: http://localhost:${PORT}`);
        console.log(`💡 Modo: ${db ? 'MySQL' : 'DEMO'}`);
    });
});