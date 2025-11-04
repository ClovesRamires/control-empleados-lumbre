let empleado = null;
let intervaloActualizacion = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Verificar autenticación
    empleado = JSON.parse(localStorage.getItem('empleado'));
    if (!empleado) {
        window.location.href = 'index.html';
        return;
    }
    
    document.getElementById('userWelcome').textContent = 
        `Bienvenido, ${empleado.nombre} ${empleado.apellidos}`;
    
    actualizarFechaHora();
    await cargarEstadoEmpleados();
    await cargarHistorial();
    
    // Actualizar cada 30 segundos
    intervaloActualizacion = setInterval(async () => {
        await cargarEstadoEmpleados();
        await cargarHistorial();
    }, 30000);
});

function actualizarFechaHora() {
    const now = new Date();
    document.getElementById('currentDateTime').textContent = 
        now.toLocaleDateString('es-ES', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
}

async function obtenerUbicacion() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocalización no soportada'));
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            position => {
                resolve({
                    latitud: position.coords.latitude,
                    longitud: position.coords.longitude
                });
            },
            error => {
                console.warn('Error obteniendo ubicación:', error);
                // En caso de error, usar ubicación por defecto (la empresa)
                resolve({
                    latitud: 40.3295, // Coordenadas aproximadas de Rivas Vaciamadrid
                    longitud: -3.5176
                });
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    });
}

async function registrarEvento(tipoRegistro) {
    try {
        const boton = event.target.closest('.control-btn');
        boton.classList.add('loading');
        
        const ubicacion = await obtenerUbicacion();
        
        const response = await fetch('/api/registro', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                empleado_id: empleado.id,
                tipo_registro: tipoRegistro,
                latitud: ubicacion.latitud,
                longitud: ubicacion.longitud
            }),
        });
        
        const data = await response.json();
        
        if (data.success) {
            mostrarMensaje('✅ Registro guardado correctamente', 'success');
            await cargarEstadoEmpleados();
            await cargarHistorial();
        } else {
            mostrarMensaje('❌ Error guardando el registro', 'error');
        }
    } catch (error) {
        console.error('Error registrando evento:', error);
        mostrarMensaje('❌ Error de conexión', 'error');
    } finally {
        const boton = event.target.closest('.control-btn');
        boton.classList.remove('loading');
    }
}

async function cargarEstadoEmpleados() {
    try {
        const response = await fetch('/api/estado-empleados');
        const estados = await response.json();
        
        const container = document.getElementById('estadoEmpleados');
        container.innerHTML = '';
        
        estados.forEach(estado => {
            const card = document.createElement('div');
            card.className = `empleado-status-card ${estado.ultimo_registro || 'sin-registro'}`;
            
            card.innerHTML = `
                <div class="status-avatar" style="background-color: ${estado.avatar_color}">
                    ${estado.nombre.charAt(0)}${estado.apellidos.charAt(0)}
                </div>
                <div class="status-info">
                    <h4>${estado.nombre} ${estado.apellidos}</h4>
                    <p>${obtenerTextoEstado(estado.ultimo_registro)}</p>
                    <small>${estado.ultima_fecha ? new Date(estado.ultima_fecha).toLocaleTimeString() : 'Sin registros hoy'}</small>
                </div>
            `;
            
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Error cargando estados:', error);
    }
}

async function cargarHistorial() {
    try {
        const response = await fetch('/api/historial');
        const historial = await response.json();
        
        const container = document.getElementById('historialRegistros');
        container.innerHTML = '';
        
        if (historial.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666;">No hay registros para hoy</p>';
            return;
        }
        
        historial.forEach(registro => {
            const item = document.createElement('div');
            item.className = `history-item ${registro.tipo_registro}`;
            
            item.innerHTML = `
                <div>
                    <strong>${registro.nombre} ${registro.apellidos}</strong>
                    <br>
                    <span>${obtenerTextoEstado(registro.tipo_registro)}</span>
                </div>
                <div style="text-align: right;">
                    <small>${new Date(registro.fecha_hora).toLocaleTimeString()}</small>
                </div>
            `;
            
            container.appendChild(item);
        });
    } catch (error) {
        console.error('Error cargando historial:', error);
    }
}

function obtenerTextoEstado(tipoRegistro) {
    const estados = {
        'entrada': '🟢 En turno',
        'comida': '🟡 En comida',
        'pausa_fumar': '🟠 En pausa',
        'cena': '🟡 En cena',
        'fin_turno': '🔴 Turno finalizado',
        'sin-registro': '⚪ Sin registro hoy'
    };
    
    return estados[tipoRegistro] || 'Estado desconocido';
}

function mostrarMensaje(mensaje, tipo) {
    const mensajeElement = document.createElement('div');
    mensajeElement.className = `${tipo}-message`;
    mensajeElement.textContent = mensaje;
    
    document.querySelector('.dashboard-content').prepend(mensajeElement);
    
    setTimeout(() => {
        mensajeElement.remove();
    }, 3000);
}

function cerrarSesion() {
    localStorage.removeItem('empleado');
    if (intervaloActualizacion) {
        clearInterval(intervaloActualizacion);
    }
    window.location.href = 'index.html';
}

// Actualizar fecha y hora cada minuto
setInterval(actualizarFechaHora, 60000);