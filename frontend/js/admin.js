let empleadoSeleccionado = null;

// Cargar empleados al iniciar
document.addEventListener('DOMContentLoaded', async () => {
    await cargarEmpleados();
});

async function cargarEmpleados() {
    try {
        const response = await fetch('/api/empleados-activos');
        const empleados = await response.json();
        
        const grid = document.getElementById('empleadosGrid');
        grid.innerHTML = '';
        
        empleados.forEach(empleado => {
            const empleadoElement = document.createElement('div');
            empleadoElement.className = 'empleado-item';
            empleadoElement.onclick = () => seleccionarEmpleado(empleado);
            
            empleadoElement.innerHTML = `
                <div class="avatar" style="background-color: ${empleado.avatar_color}">
                    ${empleado.nombre.charAt(0)}${empleado.apellidos.charAt(0)}
                </div>
                <div class="nombre">${empleado.nombre} ${empleado.apellidos}</div>
            `;
            
            grid.appendChild(empleadoElement);
        });
    } catch (error) {
        console.error('Error cargando empleados:', error);
        alert('Error cargando la lista de empleados');
    }
}

function seleccionarEmpleado(empleado) {
    empleadoSeleccionado = empleado;
    
    document.getElementById('userAvatar').style.backgroundColor = empleado.avatar_color;
    document.getElementById('userAvatar').textContent = 
        empleado.nombre.charAt(0) + empleado.apellidos.charAt(0);
    document.getElementById('userName').textContent = 
        `${empleado.nombre} ${empleado.apellidos}`;
    
    document.getElementById('pinInput').value = '';
    actualizarPuntosPIN();
    document.getElementById('pinModal').style.display = 'flex';
    document.getElementById('pinInput').focus();
}

function cerrarModal() {
    document.getElementById('pinModal').style.display = 'none';
    empleadoSeleccionado = null;
}

document.getElementById('pinInput').addEventListener('input', function(e) {
    this.value = this.value.replace(/\D/g, '').slice(0, 4);
    actualizarPuntosPIN();
});

function actualizarPuntosPIN() {
    const pin = document.getElementById('pinInput').value;
    const dots = document.querySelectorAll('.pin-dot');
    
    dots.forEach((dot, index) => {
        dot.style.background = index < pin.length ? '#007AFF' : '#ddd';
    });
}

async function verificarPin() {
    const pin = document.getElementById('pinInput').value;
    
    if (pin.length !== 4) {
        alert('El PIN debe tener exactamente 4 dígitos');
        return;
    }
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                pin: pin,
                documento: empleadoSeleccionado.documento_identidad
            }),
        });
        
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('empleado', JSON.stringify(data.empleado));
            window.location.href = 'dashboard.html';
        } else {
            alert('PIN incorrecto');
            document.getElementById('pinInput').value = '';
            actualizarPuntosPIN();
        }
    } catch (error) {
        alert('Error de conexión con el servidor');
    }
}

// Permitir Enter para enviar
document.getElementById('pinInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        verificarPin();
    }
});