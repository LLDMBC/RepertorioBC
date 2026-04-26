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
async function cargarCoros() {
    const selectCoro = document.getElementById('signup-coro');
    if (!selectCoro) return;
    
    const { data: coros, error } = await supabase
        .from('coros')
        .select('id, nombre')
        .neq('id', 'estatal')
        .order('nombre', { ascending: true });
        
    if (!error && coros) {
        selectCoro.innerHTML = coros.map(c => `<option value="${c.id}">${c.nombre.toUpperCase()}</option>`).join('');
    } else {
        selectCoro.innerHTML = '<option value="">Error cargando sedes</option>';
    }
}

async function revisarSesionAuth() {
    await cargarCoros();
    
    // Escuchar eventos de recuperación de contraseña
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event == 'PASSWORD_RECOVERY') {
            const modalReset = document.getElementById('modal-reset-pass');
            if (modalReset) {
                modalReset.style.display = 'block';
                formLogin.style.display = 'none';
                tabLogin.style.display = 'none';
                tabSignup.style.display = 'none';
                setEstado('Establezca su nueva contraseña.', 'ok');
            }
        }
    });

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

document.getElementById('btn-olvide-pass')?.addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    if (!email) {
        setEstado('Por favor, ingresa tu email en el campo de arriba para recuperar tu contraseña.', 'error');
        return;
    }
    
    setEstado('Enviando correo de recuperación...');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/auth.html',
    });
    
    if (error) {
        setEstado(`Error enviando correo: ${error.message}`, 'error');
    } else {
        setEstado('Correo enviado. Revisa tu bandeja de entrada.', 'ok');
    }
});

const formResetPass = document.getElementById('form-reset-pass');
formResetPass?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPassword = document.getElementById('reset-new-password').value;
    
    setEstado('Guardando nueva contraseña...');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    
    if (error) {
        setEstado(`Error guardando: ${error.message}`, 'error');
    } else {
        setEstado('Contraseña actualizada exitosamente. Redirigiendo...', 'ok');
        setTimeout(() => window.location.replace('/auth.html'), 2000);
    }
});

formSignup?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // HONEYPOT check
    const botField = document.getElementById('signup-bot').value;
    if (botField) {
        console.warn("Bot detected via honeypot.");
        setEstado('Solicitud enviada.', 'ok'); // Fallo silencioso
        return;
    }

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