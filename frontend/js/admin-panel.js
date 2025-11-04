let empleados = [];
let departamentos = [];
let empleadoEditando = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Iniciando panel de administración...');
    verificarAutenticacion();
    cargarDatosIniciales();
    configurarEventos();
});

function verificarAutenticacion() {
    const empleado = JSON.parse(localStorage.getItem('empleado'));
    if (!empleado || empleado.rol !== 'admin') {
        alert('Acceso denegado. Debe iniciar sesión como administrador.');
        window.location.href = 'index.html';
        return;
    }
}

async function cargarDatosIniciales() {
    try {
        await Promise.all([
            cargarEmpleados(),
            cargarDepartamentos(),
            cargarEstadisticas()
        ]);
        mostrarSeccion('empleados');
    } catch (error) {
        console.error('Error cargando datos iniciales:', error);
        mostrarMensaje('Error cargando datos iniciales', 'error');
    }
}

function configurarEventos() {
    document.getElementById('buscarEmpleado').addEventListener('input', filtrarEmpleados);
    document.getElementById('formEmpleado').addEventListener('submit', guardarEmpleado);
    
    // Configurar búsqueda de registros
    document.getElementById('btnBuscarRegistros').addEventListener('click', buscarRegistros);
}

// ==================== GESTIÓN DE EMPLEADOS ====================

async function cargarEmpleados() {
    try {
        console.log('📋 Cargando empleados...');
        const response = await fetch('/api/admin/empleados');
        
        if (!response.ok) throw new Error(`Error ${response.status}`);
        
        empleados = await response.json();
        console.log('✅ Empleados cargados:', empleados.length);
        renderizarTablaEmpleados();
        
    } catch (error) {
        console.error('❌ Error cargando empleados:', error);
        mostrarMensaje('Error cargando empleados: ' + error.message, 'error');
    }
}

async function cargarDepartamentos() {
    try {
        const response = await fetch('/api/admin/departamentos');
        departamentos = await response.json();
        llenarSelectDepartamentos();
    } catch (error) {
        console.error('Error cargando departamentos:', error);
    }
}

function llenarSelectDepartamentos() {
    const selects = [
        'departamentoEmpleado',
        'filtroDepartamento', 
        'selectDeptoReporte',
        'filtroDeptoRegistros'
    ];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            select.innerHTML = selectId === 'departamentoEmpleado' 
                ? '<option value="">Seleccionar departamento...</option>'
                : '<option value="">Todos los departamentos</option>';
            
            departamentos.forEach(depto => {
                select.innerHTML += `<option value="${depto.id}">${depto.nombre}</option>`;
            });
        }
    });

    // Llenar select de empleados para búsqueda
    const selectEmpleado = document.getElementById('filtroEmpleadoRegistros');
    if (selectEmpleado) {
        selectEmpleado.innerHTML = '<option value="">Todos los empleados</option>';
        empleados.filter(e => e.activo).forEach(emp => {
            selectEmpleado.innerHTML += `<option value="${emp.id}">${emp.nombre} ${emp.apellidos}</option>`;
        });
    }
}

function renderizarTablaEmpleados() {
    const tbody = document.getElementById('cuerpoTablaEmpleados');
    
    if (empleados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px; color: #666;">
                    <div style="font-size: 48px; margin-bottom: 10px;">👥</div>
                    No hay empleados registrados
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = empleados.map(empleado => `
        <tr>
            <td>${empleado.id}</td>
            <td>
                <strong>${empleado.nombre} ${empleado.apellidos}</strong>
                ${empleado.rol === 'admin' ? '<br><small style="color: #007AFF;">👑 Administrador</small>' : ''}
            </td>
            <td>${empleado.documento_identidad}</td>
            <td>${empleado.departamento_nombre || 'Sin asignar'}</td>
            <td>${empleado.telefono || 'No especificado'}</td>
            <td>${empleado.fecha_contratacion ? new Date(empleado.fecha_contratacion).toLocaleDateString('es-ES') : 'No especificada'}</td>
            <td>
                <span class="${empleado.activo ? 'estado-activo' : 'estado-inactivo'}">
                    ${empleado.activo ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td>
                <button class="btn-accion btn-editar" onclick="editarEmpleado(${empleado.id})" title="Editar">
                    ✏️ Editar
                </button>
                ${empleado.rol !== 'admin' ? `
                    <button class="btn-accion btn-eliminar" onclick="eliminarEmpleado(${empleado.id})" title="Eliminar">
                        🗑️ Eliminar
                    </button>
                ` : ''}
            </td>
        </tr>
    `).join('');
}

function filtrarEmpleados() {
    const busqueda = document.getElementById('buscarEmpleado').value.toLowerCase();
    const filtroDepto = document.getElementById('filtroDepartamento').value;
    const filtroEstado = document.getElementById('filtroEstado').value;
    
    let empleadosFiltrados = empleados;
    
    if (busqueda) {
        empleadosFiltrados = empleadosFiltrados.filter(emp => 
            emp.nombre.toLowerCase().includes(busqueda) ||
            emp.apellidos.toLowerCase().includes(busqueda) ||
            emp.documento_identidad.toLowerCase().includes(busqueda)
        );
    }
    
    if (filtroDepto) {
        empleadosFiltrados = empleadosFiltrados.filter(emp => 
            emp.departamento_id == filtroDepto
        );
    }
    
    if (filtroEstado !== 'todos') {
        const activo = filtroEstado === 'activo';
        empleadosFiltrados = empleadosFiltrados.filter(emp => emp.activo === activo);
    }
    
    const tbody = document.getElementById('cuerpoTablaEmpleados');
    tbody.innerHTML = empleadosFiltrados.map(empleado => `
        <tr>
            <td>${empleado.id}</td>
            <td><strong>${empleado.nombre} ${empleado.apellidos}</strong></td>
            <td>${empleado.documento_identidad}</td>
            <td>${empleado.departamento_nombre || 'Sin asignar'}</td>
            <td>${empleado.telefono || 'No especificado'}</td>
            <td>${empleado.fecha_contratacion ? new Date(empleado.fecha_contratacion).toLocaleDateString('es-ES') : 'No especificada'}</td>
            <td>
                <span class="${empleado.activo ? 'estado-activo' : 'estado-inactivo'}">
                    ${empleado.activo ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td>
                <button class="btn-accion btn-editar" onclick="editarEmpleado(${empleado.id})">
                    ✏️ Editar
                </button>
                ${empleado.rol !== 'admin' ? `
                    <button class="btn-accion btn-eliminar" onclick="eliminarEmpleado(${empleado.id})">
                        🗑️ Eliminar
                    </button>
                ` : ''}
            </td>
        </tr>
    `).join('');
}

// ==================== MODAL DE EMPLEADOS ====================

function mostrarModalEmpleado() {
    empleadoEditando = null;
    document.getElementById('tituloModalEmpleado').textContent = 'Nuevo Empleado';
    document.getElementById('formEmpleado').reset();
    document.getElementById('empleadoId').value = '';
    document.getElementById('activoEmpleado').checked = true;
    document.getElementById('fechaContratacion').value = new Date().toISOString().split('T')[0];
    document.getElementById('modalEmpleado').style.display = 'block';
}

function cerrarModalEmpleado() {
    document.getElementById('modalEmpleado').style.display = 'none';
    empleadoEditando = null;
}

function editarEmpleado(id) {
    empleadoEditando = empleados.find(emp => emp.id === id);
    
    if (!empleadoEditando) {
        mostrarMensaje('Empleado no encontrado', 'error');
        return;
    }
    
    document.getElementById('tituloModalEmpleado').textContent = 'Editar Empleado';
    document.getElementById('empleadoId').value = empleadoEditando.id;
    document.getElementById('documentoIdentidad').value = empleadoEditando.documento_identidad;
    document.getElementById('numeroSeguridadSocial').value = empleadoEditando.numero_seguridad_social || '';
    document.getElementById('nombreEmpleado').value = empleadoEditando.nombre;
    document.getElementById('apellidosEmpleado').value = empleadoEditando.apellidos;
    document.getElementById('pinEmpleado').value = empleadoEditando.pin_acceso;
    document.getElementById('departamentoEmpleado').value = empleadoEditando.departamento_id || '';
    document.getElementById('fechaContratacion').value = empleadoEditando.fecha_contratacion || '';
    document.getElementById('salarioEmpleado').value = empleadoEditando.salario || '';
    document.getElementById('telefonoEmpleado').value = empleadoEditando.telefono || '';
    document.getElementById('emailEmpleado').value = empleadoEditando.email || '';
    document.getElementById('direccionEmpleado').value = empleadoEditando.direccion || '';
    document.getElementById('activoEmpleado').checked = empleadoEditando.activo;
    
    document.getElementById('modalEmpleado').style.display = 'block';
}

async function guardarEmpleado(event) {
    event.preventDefault();
    
    const empleadoData = {
        documento_identidad: document.getElementById('documentoIdentidad').value,
        numero_seguridad_social: document.getElementById('numeroSeguridadSocial').value,
        nombre: document.getElementById('nombreEmpleado').value,
        apellidos: document.getElementById('apellidosEmpleado').value,
        pin_acceso: document.getElementById('pinEmpleado').value,
        departamento_id: parseInt(document.getElementById('departamentoEmpleado').value) || 1,
        fecha_contratacion: document.getElementById('fechaContratacion').value,
        salario: parseFloat(document.getElementById('salarioEmpleado').value) || 0,
        telefono: document.getElementById('telefonoEmpleado').value,
        email: document.getElementById('emailEmpleado').value,
        direccion: document.getElementById('direccionEmpleado').value,
        activo: document.getElementById('activoEmpleado').checked
    };
    
    // Validaciones
    if (!empleadoData.documento_identidad || !empleadoData.nombre || !empleadoData.apellidos || !empleadoData.pin_acceso) {
        mostrarMensaje('Complete todos los campos obligatorios', 'error');
        return;
    }
    
    if (empleadoData.pin_acceso.length !== 4) {
        mostrarMensaje('El PIN debe tener 4 dígitos', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/admin/empleados', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(empleadoData)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'Error del servidor');
        }
        
        if (result.success) {
            mostrarMensaje(result.message, 'success');
            cerrarModalEmpleado();
            await cargarEmpleados();
        }
        
    } catch (error) {
        console.error('❌ Error guardando empleado:', error);
        mostrarMensaje('Error: ' + error.message, 'error');
    }
}

// ==================== BÚSQUEDA DE REGISTROS ====================

async function buscarRegistros() {
    const fechaInicio = document.getElementById('fechaInicioRegistros').value;
    const fechaFin = document.getElementById('fechaFinRegistros').value;
    const empleadoId = document.getElementById('filtroEmpleadoRegistros').value;
    const departamentoId = document.getElementById('filtroDeptoRegistros').value;
    
    try {
        const params = new URLSearchParams();
        if (fechaInicio) params.append('fecha_inicio', fechaInicio);
        if (fechaFin) params.append('fecha_fin', fechaFin);
        if (empleadoId) params.append('empleado_id', empleadoId);
        if (departamentoId) params.append('departamento_id', departamentoId);
        
        const response = await fetch(`/api/admin/buscar-registros?${params}`);
        const registros = await response.json();
        
        mostrarResultadosRegistros(registros);
        
    } catch (error) {
        console.error('Error buscando registros:', error);
        mostrarMensaje('Error buscando registros', 'error');
    }
}

function mostrarResultadosRegistros(registros) {
    const container = document.getElementById('resultadosRegistros');
    
    if (registros.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <div style="font-size: 48px; margin-bottom: 10px;">📊</div>
                No se encontraron registros para los filtros seleccionados
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="resultados-header">
            <h4>${registros.length} registros encontrados</h4>
            <button onclick="exportarRegistros()" class="btn-excel">📥 Exportar Excel</button>
        </div>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Empleado</th>
                        <th>Documento</th>
                        <th>Departamento</th>
                        <th>Tipo</th>
                        <th>Fecha</th>
                        <th>Hora</th>
                    </tr>
                </thead>
                <tbody>
                    ${registros.map(registro => `
                        <tr>
                            <td>${registro.nombre} ${registro.apellidos}</td>
                            <td>${registro.documento_identidad}</td>
                            <td>${registro.departamento}</td>
                            <td>
                                <span class="badge ${registro.tipo_registro}">
                                    ${obtenerTextoRegistro(registro.tipo_registro)}
                                </span>
                            </td>
                            <td>${new Date(registro.fecha_hora).toLocaleDateString('es-ES')}</td>
                            <td>${new Date(registro.fecha_hora).toLocaleTimeString('es-ES')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function obtenerTextoRegistro(tipo) {
    const tipos = {
        'entrada': '🟢 Entrada',
        'comida': '🟡 Comida',
        'pausa_fumar': '🟠 Pausa',
        'cena': '🟡 Cena',
        'fin_turno': '🔴 Salida'
    };
    return tipos[tipo] || tipo;
}

// ==================== ESTADÍSTICAS ====================

async function cargarEstadisticas() {
    try {
        const response = await fetch('/api/admin/estadisticas');
        const stats = await response.json();
        
        document.getElementById('totalEmpleados').textContent = stats.totalEmpleados;
        document.getElementById('empleadosActivosHoy').textContent = stats.empleadosActivosHoy;
        document.getElementById('registrosMes').textContent = stats.registrosEsteMes;
        document.getElementById('registrosHoy').textContent = stats.registrosHoy;
        
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
    }
}

// ==================== UTILIDADES ====================

function mostrarSeccion(seccion) {
    document.querySelectorAll('[id^="seccion-"]').forEach(sec => {
        sec.classList.add('seccion-oculta');
        sec.classList.remove('seccion-activa');
    });
    
    document.getElementById(`seccion-${seccion}`).classList.remove('seccion-oculta');
    document.getElementById(`seccion-${seccion}`).classList.add('seccion-activa');
    
    if (seccion === 'empleados') {
        cargarEmpleados();
    } else if (seccion === 'estadisticas') {
        cargarEstadisticas();
    } else if (seccion === 'reportes') {
        llenarSelectDepartamentos();
    }
}

function mostrarMensaje(mensaje, tipo) {
    const mensajesAnteriores = document.querySelectorAll('.mensaje-flotante');
    mensajesAnteriores.forEach(msg => msg.remove());
    
    const mensajeElement = document.createElement('div');
    mensajeElement.className = `mensaje-flotante ${tipo}`;
    mensajeElement.textContent = mensaje;
    mensajeElement.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: bold;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        ${tipo === 'success' ? 'background: #27ae60;' : 'background: #e74c3c;'}
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    
    document.body.appendChild(mensajeElement);
    
    setTimeout(() => {
        mensajeElement.remove();
    }, 5000);
}

function cerrarSesion() {
    localStorage.removeItem('empleado');
    window.location.href = 'index.html';
}

// Cerrar modal al hacer click fuera
window.onclick = function(event) {
    const modal = document.getElementById('modalEmpleado');
    if (event.target === modal) {
        cerrarModalEmpleado();
    }
}

// Agregar estilos para mensajes
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    .badge {
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 0.8rem;
        font-weight: bold;
    }
    
    .badge.entrada { background: #d4edda; color: #155724; }
    .badge.comida { background: #fff3cd; color: #856404; }
    .badge.pausa_fumar { background: #ffeaa7; color: #8c7c0e; }
    .badge.cena { background: #fff3cd; color: #856404; }
    .badge.fin_turno { background: #f8d7da; color: #721c24; }
    
    .resultados-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding: 20px;
        background: white;
        border-radius: 10px;
    }
`;
document.head.appendChild(style);