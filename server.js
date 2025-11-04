const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

// Datos de demo
const empleados = [
    {
        id: 1,
        documento: '12345678A',
        pin: '1234',
        nombre: 'Juan',
        apellidos: 'García López',
        rol: 'admin',
        avatar_color: '#007AFF',
        activo: true,
        departamento: 'Administración',
        telefono: '+34 612 345 678'
    },
    {
        id: 2,
        documento: '87654321B', 
        pin: '5678',
        nombre: 'María',
        apellidos: 'Rodríguez Santos',
        rol: 'empleado',
        avatar_color: '#34C759',
        activo: true,
        departamento: 'Cocina',
        telefono: '+34 623 456 789'
    }
];

let registros = [];

// API Routes
app.post('/api/login', (req, res) => {
    const { pin, documento } = req.body;
    const empleado = empleados.find(e => e.documento === documento && e.pin === pin && e.activo);
    
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
});

app.get('/api/empleados-activos', (req, res) => {
    res.json(empleados.filter(e => e.activo).map(e => ({
        id: e.id,
        nombre: e.nombre,
        apellidos: e.apellidos,
        documento_identidad: e.documento,
        rol: e.rol,
        avatar_color: e.avatar_color,
        departamento: e.departamento
    })));
});

app.post('/api/registro', (req, res) => {
    const { empleado_id, tipo_registro } = req.body;
    
    registros.push({
        id: registros.length + 1,
        empleado_id,
        tipo_registro,
        fecha_hora: new Date().toISOString()
    });
    
    res.json({ success: true, message: 'Registro guardado' });
});

app.get('/api/estado-empleados', (req, res) => {
    const estados = empleados.filter(e => e.activo).map(empleado => {
        const ultimoRegistro = registros
            .filter(r => r.empleado_id === empleado.id)
            .sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora))[0];
        
        return {
            id: empleado.id,
            nombre: empleado.nombre,
            apellidos: empleado.apellidos,
            avatar_color: empleado.avatar_color,
            ultimo_registro: ultimoRegistro ? ultimoRegistro.tipo_registro : null,
            ultima_fecha: ultimoRegistro ? ultimoRegistro.fecha_hora : null
        };
    });
    
    res.json(estados);
});

// Admin routes
app.get('/api/admin/empleados', (req, res) => {
    res.json(empleados);
});

app.post('/api/admin/empleados', (req, res) => {
    const { nombre, apellidos, documento, pin, departamento, telefono } = req.body;
    
    const nuevoEmpleado = {
        id: empleados.length + 1,
        documento,
        pin,
        nombre,
        apellidos,
        rol: 'empleado',
        activo: true,
        avatar_color: '#FF9500',
        departamento: departamento || 'Cocina',
        telefono: telefono || ''
    };
    
    empleados.push(nuevoEmpleado);
    res.json({ success: true, message: 'Empleado creado correctamente' });
});

// Static files
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
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Servidor funcionando en puerto ${PORT}`);
    console.log(`👉 Accede en: http://localhost:${PORT}`);
    console.log(`🔑 Usuario admin: 12345678A / 1234`);
});