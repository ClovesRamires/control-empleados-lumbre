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