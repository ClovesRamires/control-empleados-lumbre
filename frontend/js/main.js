// Código principal compartido
console.log('🔥 La Lumbre de Riva S.L. - Sistema de Control v1.0');

// Verificar conectividad
async function verificarConectividad() {
    try {
        const response = await fetch('/api/empleados-activos');
        if (!response.ok) {
            throw new Error('Error de conexión');
        }
        return true;
    } catch (error) {
        console.error('Error de conectividad:', error);
        return false;
    }
}

// Mostrar estado de conexión
document.addEventListener('DOMContentLoaded', async () => {
    const conectado = await verificarConectividad();
    const estadoConexion = document.createElement('div');
    estadoConexion.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        padding: 10px 15px;
        border-radius: 20px;
        color: white;
        font-weight: bold;
        z-index: 1000;
        background: ${conectado ? '#34C759' : '#FF3B30'};
    `;
    estadoConexion.textContent = conectado ? '✅ Conectado' : '❌ Sin conexión';
    document.body.appendChild(estadoConexion);
    
    setTimeout(() => {
        estadoConexion.remove();
    }, 3000);
});