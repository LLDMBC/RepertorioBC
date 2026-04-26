import { supabase } from '../api/supabase.js';

// Elementos de la UI
const estadoAuth = document.getElementById('estado-auth');
const tabLogin = document.getElementById('tab-login');
const tabSignup = document.getElementById('tab-signup');
const formLogin = document.getElementById('form-login');
const formSignup = document.getElementById('form-signup');
const btnCerrarSesion = document.getElementById('btn-cerrar-sesion');

// Utilidades UI
function setEstado(mensaje, tipo = 'normal') {
    if (!estadoAuth) return;
    estadoAuth.textContent = mensaje;
    estadoAuth.className = `estado ${tipo}`;
}

function cambiarTab(tab) {
    const esLogin = tab === 'login';
    tabLogin?.classList.toggle('activa', esLogin);
    tabSignup?.classList.toggle('activa', !esLogin);
    formLogin?.classList.toggle('activo', esLogin);
    formSignup?.classList.toggle('activo', !esLogin);
}

// 🛡️ LÓGICA DE DIRECCIÓN INTELIGENTE
async function validarRedireccion(userId) {
    const { data: perfil, error } = await supabase
        .from('perfiles')
        .select('rol, estado, coro_id')
        .eq('id', userId)
        .single();

    if (error || !perfil) {
        setEstado('Error al obtener perfil. Contacta al administrador.', 'error');
        await supabase.auth.signOut();
        return;
    }

    if (perfil.rol === 'superadmin' || perfil.rol === 'director') {
        window.location.replace('/gestor.html');
        return;
    }

    if (perfil.rol === 'miembro') {
        if (perfil.estado === 'activo') {
            window.location.replace('/index.html');
        } else {
            setEstado('Tu cuenta está pendiente de aprobación por tu director.', 'error');
            if (btnCerrarSesion) btnCerrarSesion.style.display = 'block';
        }
    }
}

// INICIALIZACIÓN
async function revisarSesionAuth() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            setEstado('Verificando accesos...', 'ok');
            await validarRedireccion(session.user.id);
        } else {
            setEstado('Ingresa con tu cuenta o solicita acceso.');
        }
    } catch (err) {
        setEstado('Error de conexión.', 'error');
    }
}

// EVENTOS DE LOGIN Y REGISTRO
formLogin?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;

    setEstado('Iniciando sesión...');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
        setEstado(`Credenciales incorrectas: ${error.message}`, 'error');
        return;
    }
    await validarRedireccion(data.user.id);
});

formSignup?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('signup-nombre').value.trim();
    const email = document.getElementById('signup-email').value.trim().toLowerCase();
    const password = document.getElementById('signup-password').value;
    const coro_id = document.getElementById('signup-coro').value;

    setEstado('Creando solicitud...');
    const { error } = await supabase.auth.signUp({
        email, password, options: { data: { nombre, coro_id } }
    });

    if (error) {
        setEstado(`Error en registro: ${error.message}`, 'error');
        return;
    }

    setEstado('Solicitud enviada. Espera la aprobación de tu director.', 'ok');
    formSignup.reset();
    cambiarTab('login');
});

// LISTENERS BÁSICOS
tabLogin?.addEventListener('click', () => cambiarTab('login'));
tabSignup?.addEventListener('click', () => cambiarTab('signup'));
document.getElementById('btn-ir-publico')?.addEventListener('click', () => window.location.href = '/index.html');

btnCerrarSesion?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    btnCerrarSesion.style.display = 'none';
    setEstado('Sesión cerrada.', 'ok');
});

revisarSesionAuth();