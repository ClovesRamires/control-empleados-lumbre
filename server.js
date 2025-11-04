const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

let db;

// Inicializar base de datos
async function initializeDatabase() {
    try {
        db = await open({
            filename: './database.sqlite',
            driver: sqlite3.Database
        });
        console.log('✅ Conectado a SQLite');

        // Crear tablas
        await db.exec(`
            CREATE TABLE IF NOT EXISTS empleados (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                documento_identidad TEXT UNIQUE NOT NULL,
                numero_seguridad_social TEXT UNIQUE NOT NULL,
                nombre TEXT NOT NULL,
                apellidos TEXT NOT NULL,
                pin_acceso TEXT NOT NULL,
                rol TEXT DEFAULT 'empleado',
                activo BOOLEAN DEFAULT 1,
                avatar_color TEXT DEFAULT '#007AFF',
                departamento_id INTEGER DEFAULT 1,
                telefono TEXT,
                email TEXT,
                direccion TEXT,
                salario REAL DEFAULT 0,
                fecha_contratacion DATE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS departamentos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                descripcion TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS registros (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                empleado_id INTEGER NOT NULL,
                tipo_registro TEXT NOT NULL,
                fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
                latitud REAL,
                longitud REAL,
                direccion_ip TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (empleado_id) REFERENCES empleados (id)
            );

            CREATE TABLE IF NOT EXISTS reportes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tipo TEXT NOT NULL,
                empleado_id INTEGER,
                fecha_inicio DATE,
                fecha_fin DATE,
                parametros TEXT,
                ruta_archivo TEXT,
                generado_por INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Insertar datos iniciales
        await insertarDatosIniciales();
        console.log('✅ Base de datos inicializada');

    } catch (error) {
        console.error('❌ Error inicializando base de datos:', error);
    }
}

async function insertarDatosIniciales() {
    try {
        // Insertar departamentos
        await db.run(`
            INSERT OR IGNORE INTO departamentos (id, nombre, descripcion) VALUES
            (1, 'Cocina', 'Personal de cocina y preparación'),
            (2, 'Sala', 'Personal de atención al cliente'),
            (3, 'Administración', 'Personal administrativo'),
            (4, 'Limpieza', 'Personal de limpieza y mantenimiento')
        `);

        // Insertar empleados admin
        const adminExists = await db.get("SELECT id FROM empleados WHERE documento_identidad = '12345678A'");
        if (!adminExists) {
            await db.run(`
                INSERT INTO empleados (
                    documento_identidad, numero_seguridad_social, nombre, apellidos, 
                    pin_acceso, rol, departamento_id, telefono, fecha_contratacion
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, ['12345678A', 'SS001', 'Juan', 'García López', '1234', 'admin', 3, '+34 612 345 678', '2023-01-15']);

            await db.run(`
                INSERT INTO empleados (
                    documento_identidad, numero_seguridad_social, nombre, apellidos, 
                    pin_acceso, departamento_id, telefono, fecha_contratacion
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, ['87654321B', 'SS002', 'María', 'Rodríguez Santos', '5678', 1, '+34 623 456 789', '2023-03-20']);
        }
    } catch (error) {
        console.log('ℹ️ Datos iniciales ya existen');
    }
}

// ==================== RUTAS DE AUTENTICACIÓN ====================

app.post('/api/login', async (req, res) => {
    const { pin, documento } = req.body;
    
    try {
        const empleado = await db.get(
            `SELECT id, nombre, apellidos, rol, avatar_color 
             FROM empleados 
             WHERE documento_identidad = ? AND pin_acceso = ? AND activo = 1`,
            [documento, pin]
        );
        
        if (empleado) {
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

// ==================== RUTAS DE REGISTROS ====================

app.post('/api/registro', async (req, res) => {
    const { empleado_id, tipo_registro, latitud, longitud } = req.body;
    
    try {
        await db.run(
            `INSERT INTO registros (empleado_id, tipo_registro, latitud, longitud) 
             VALUES (?, ?, ?, ?)`,
            [empleado_id, tipo_registro, latitud, longitud]
        );
        
        res.json({ success: true, message: 'Registro guardado correctamente' });
    } catch (error) {
        console.error('Error guardando registro:', error);
        res.status(500).json({ success: false, message: 'Error guardando registro' });
    }
});

app.get('/api/estado-empleados', async (req, res) => {
    try {
        const estados = await db.all(`
            SELECT e.id, e.nombre, e.apellidos, e.avatar_color,
                   r.tipo_registro as ultimo_registro,
                   r.fecha_hora as ultima_fecha
            FROM empleados e
            LEFT JOIN registros r ON e.id = r.empleado_id
            WHERE r.fecha_hora = (
                SELECT MAX(fecha_hora) 
                FROM registros 
                WHERE empleado_id = e.id
                AND date(fecha_hora) = date('now')
            )
            AND e.activo = 1
            ORDER BY r.fecha_hora DESC
        `);
        
        res.json(estados);
    } catch (error) {
        console.error('Error obteniendo estados:', error);
        res.status(500).json({ error: 'Error obteniendo estados' });
    }
});

// ==================== RUTAS DE ADMINISTRACIÓN ====================

// Obtener todos los empleados
app.get('/api/admin/empleados', async (req, res) => {
    try {
        const empleados = await db.all(`
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

// Obtener departamentos
app.get('/api/admin/departamentos', async (req, res) => {
    try {
        const departamentos = await db.all('SELECT * FROM departamentos ORDER BY nombre');
        res.json(departamentos);
    } catch (error) {
        console.error('Error obteniendo departamentos:', error);
        res.status(500).json({ error: 'Error obteniendo departamentos' });
    }
});

// Crear nuevo empleado
app.post('/api/admin/empleados', async (req, res) => {
    const { 
        documento_identidad, 
        numero_seguridad_social, 
        nombre, 
        apellidos, 
        pin_acceso, 
        departamento_id,
        telefono,
        email,
        direccion,
        salario,
        fecha_contratacion 
    } = req.body;

    try {
        // Verificar si el documento ya existe
        const existe = await db.get(
            'SELECT id FROM empleados WHERE documento_identidad = ?',
            [documento_identidad]
        );

        if (existe) {
            return res.status(400).json({ 
                success: false, 
                message: 'Ya existe un empleado con este documento' 
            });
        }

        // Generar NSS si no se proporciona
        const nss = numero_seguridad_social || `SS${Date.now().toString().slice(-6)}`;

        // Insertar nuevo empleado
        const result = await db.run(
            `INSERT INTO empleados (
                documento_identidad, numero_seguridad_social, nombre, apellidos,
                pin_acceso, departamento_id, telefono, email, direccion, salario, fecha_contratacion
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                documento_identidad, nss, nombre, apellidos,
                pin_acceso, departamento_id || 1, telefono, email, direccion, 
                salario || 0, fecha_contratacion || new Date().toISOString().split('T')[0]
            ]
        );

        res.json({ 
            success: true, 
            message: 'Empleado creado correctamente',
            id: result.lastID
        });

    } catch (error) {
        console.error('Error creando empleado:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error creando empleado: ' + error.message 
        });
    }
});

// Buscar registros por fechas
app.get('/api/admin/buscar-registros', async (req, res) => {
    const { fecha_inicio, fecha_fin, empleado_id, departamento_id } = req.query;
    
    try {
        let query = `
            SELECT r.*, e.nombre, e.apellidos, e.documento_identidad, d.nombre as departamento
            FROM registros r
            JOIN empleados e ON r.empleado_id = e.id
            LEFT JOIN departamentos d ON e.departamento_id = d.id
            WHERE 1=1
        `;
        
        const params = [];
        
        if (fecha_inicio) {
            query += ' AND date(r.fecha_hora) >= date(?)';
            params.push(fecha_inicio);
        }
        
        if (fecha_fin) {
            query += ' AND date(r.fecha_hora) <= date(?)';
            params.push(fecha_fin);
        }
        
        if (empleado_id) {
            query += ' AND r.empleado_id = ?';
            params.push(empleado_id);
        }
        
        if (departamento_id) {
            query += ' AND e.departamento_id = ?';
            params.push(departamento_id);
        }
        
        query += ' ORDER BY r.fecha_hora DESC';
        
        const registros = await db.all(query, params);
        res.json(registros);
        
    } catch (error) {
        console.error('Error buscando registros:', error);
        res.status(500).json({ error: 'Error buscando registros' });
    }
});

// Estadísticas para dashboard
app.get('/api/admin/estadisticas', async (req, res) => {
    try {
        const totalEmpleados = await db.get('SELECT COUNT(*) as total FROM empleados WHERE activo = 1');
        const registrosHoy = await db.get(`
            SELECT COUNT(*) as total 
            FROM registros 
            WHERE date(fecha_hora) = date('now')
        `);
        const empleadosActivosHoy = await db.get(`
            SELECT COUNT(DISTINCT empleado_id) as total 
            FROM registros 
            WHERE date(fecha_hora) = date('now')
        `);
        const registrosMes = await db.get(`
            SELECT COUNT(*) as total 
            FROM registros 
            WHERE strftime('%Y-%m', fecha_hora) = strftime('%Y-%m', 'now')
        `);

        res.json({
            totalEmpleados: totalEmpleados.total,
            empleadosActivosHoy: empleadosActivosHoy.total,
            registrosEsteMes: registrosMes.total,
            registrosHoy: registrosHoy.total
        });
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({ error: 'Error obteniendo estadísticas' });
    }
});

// ==================== RUTAS DE ARCHIVOS ESTÁTICOS ====================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'admin.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'dashboard.html'));
});

app.get('/admin-panel', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'admin-panel.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        database: db ? 'Conectada' : 'No conectada',
        timestamp: new Date().toISOString() 
    });
});

// ==================== INICIAR SERVIDOR ====================

initializeDatabase().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
        console.log(`🏢 La Lumbre de Riva S.L. - Sistema de Control`);
        console.log(`🌐 URL: http://localhost:${PORT}`);
        console.log(`🗄️ Base de datos: SQLite`);
        console.log(`🔑 Admin: 12345678A / 1234`);
    });
});