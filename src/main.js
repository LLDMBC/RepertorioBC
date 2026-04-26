import { pdfEngine } from './core/pdfEngine.js';
import { offlineManager } from './core/offlineManager.js';
import { buscadorUI } from './ui/buscador.js';
import { visorUI } from './ui/visor.js';
import { supabase } from './api/supabase.js';

/**
 * ============================================================================
 * ESTADO GLOBAL DE LA APLICACIÓN (State Management)
 * ============================================================================
 */
const APP_STATE = {
    cantos: [],
    perfil: null,
    temaOscuro: false,
    categoriaActiva: 'local' // <-- Controla qué pestaña está activa (Local, Estatal, Concierto)
};

/**
 * ============================================================================
 * CACHÉ DE ELEMENTOS DEL DOM
 * ============================================================================
 */
const DOM = {
    listaCantos: document.getElementById('lista-cantos'),
    listaTemas: document.getElementById('lista-temas'),
    inputBuscador: document.getElementById('buscador'),
    contadorCantos: document.getElementById('contador-cantos'),
    contenedorPdf: document.getElementById('contenedor-pdf'),
    barraSuperior: document.getElementById('barra-superior'),
    btnLimpiarBusqueda: document.getElementById('btn-limpiar-busqueda'),
    contadorDescargas: document.getElementById('contador-descargas'),
    btnResetZoom: document.getElementById('btn-reset-zoom'),
    btnCerrar: document.getElementById('btn-cerrar'),
    btnToggleTema: document.getElementById('btn-toggle-tema'),
    iconoTemaLuna: document.getElementById('icono-tema-luna'),
    iconoTemaSol: document.getElementById('icono-tema-sol'),
    btnToggleSidebar: document.getElementById('btn-toggle-sidebar'),
    sidebar: document.getElementById('sidebar-temas'),
    overlay: crearOverlaySidebar()
};

function crearOverlaySidebar() {
    let overlay = document.getElementById('overlay-sidebar');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'overlay-sidebar';
        document.body.appendChild(overlay);
    }
    return overlay;
}

/**
 * ============================================================================
 * NÚCLEO DE INICIALIZACIÓN Y SEGURIDAD
 * ============================================================================
 */
async function arrancarAplicacion() {
    offlineManager.registrarServiceWorker();
    inicializarTema();

    try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) return expulsarUsuario();

        // 1. Cargamos el perfil solicitando también los conciertos
// 1. Cargamos el perfil solicitando TODO (*) para evitar crasheos por columnas faltantes
const { data: perfil, error: perfilError } = await supabase
.from('perfiles')
.select('*')
.eq('id', session.user.id)
.single();

// Si Supabase rechaza la petición, imprimimos el motivo real en la consola
if (perfilError) {
console.error("🔥 Error interno de Supabase al buscar perfil:", perfilError);
throw new Error("PERFIL_NO_ENCONTRADO");
}

if (!perfil) throw new Error("PERFIL_NO_ENCONTRADO");

        // FIX ANTI-OSCILACIÓN: Cortar el flujo aquí con un mensaje en pantalla, SIN redirigir
        if (perfil.estado !== 'activo' && perfil.rol === 'miembro') {
            document.body.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; text-align:center; padding:20px; font-family:sans-serif; background:#fdfdfd;">
                    <h2 style="color:#D4AF37; margin-bottom: 10px;">CUENTA EN ESPERA</h2>
                    <p style="color:#555;">Tu acceso aún no ha sido aprobado por el Director de tu sede.</p>
                    <button onclick="location.reload()" style="margin-top:20px; padding:12px 24px; background:#D4AF37; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">REINTENTAR</button>
                    <button onclick="supabase.auth.signOut().then(() => location.replace('/auth.html'))" style="margin-top:15px; background:none; border:none; color:#888; text-decoration:underline; cursor:pointer;">CERRAR SESIÓN</button>
                </div>`;
            return; // ESTO DETIENE EL BUCLE INIFINITO
        }

        APP_STATE.perfil = perfil;

        await cargarRepertorio();
        construirInterfaz();
        configurarEventosGlobales();

    } catch (err) {
        console.error("Fallo crítico en el arranque:", err);
        if (err.message === "PERFIL_NO_ENCONTRADO") expulsarUsuario();
        else mostrarErrorPantalla(err.message);
    }
}

async function cargarRepertorio() {
    // FIX VISIBILIDAD DIRECTOR: JOIN estándar que trae la base de datos completa
    const { data: datos, error } = await supabase
        .from('cantos')
        .select(`
            *,
            cantos_coros (coro_id)
        `)
        .order('nombre', { ascending: true });

    if (error) throw error;

    APP_STATE.cantos = datos.map(c => ({ 
        ...c, 
        temas: Array.isArray(c.temas) ? c.temas : [] 
    }));
}

/**
 * ============================================================================
 * CONTROLADORES DE VISTA Y UI
 * ============================================================================
 */
function construirInterfaz() {
    // Inyectar botones de conciertos si existen
    const navConciertos = document.getElementById('nav-conciertos');
    const conciertos = APP_STATE.perfil.conciertos_asignados || [];
    if (navConciertos && conciertos.length > 0) {
        navConciertos.innerHTML = conciertos.map(id => `
            <button class="nav-btn" data-cat="${id}">
                <span class="icon">🎵</span> ${id.replace(/-/g, ' ').toUpperCase()}
            </button>
        `).join('');
    }

    buscadorUI.generarMenuTemas(APP_STATE.cantos, DOM.listaTemas, () => {
        actualizarVista();
        if (window.innerWidth <= 768) alternarMenuLateral(true);
    });

    actualizarVista();
    
    offlineManager.actualizarContador(APP_STATE.cantos, DOM.contadorDescargas)
        .then(() => offlineManager.sincronizarPartituras(APP_STATE.cantos, DOM.contadorDescargas));
        
    visorUI.iniciarEventos(DOM.contenedorPdf, DOM.btnResetZoom, DOM.barraSuperior);
}

function actualizarVista() {
    if (!DOM.inputBuscador) return;
    
    const cat = APP_STATE.categoriaActiva;
    const idSede = APP_STATE.perfil.coro_id;

    // 1. Filtrado Estructural (Mi Sede vs Estatal)
    let filtrados = APP_STATE.cantos.filter(canto => {
        const idBuscado = (cat === 'local') ? idSede : cat;
        return canto.cantos_coros && canto.cantos_coros.some(rel => rel.coro_id === idBuscado);
    });

    // 2. FILTRADO POR TEMA
    const temaActivo = DOM.listaTemas?.querySelector('.activo');
    if (temaActivo) {
        const tema = temaActivo.textContent.trim();
        if (tema === 'Sin Tema Especificado' || tema === 'Sin tema') {
            filtrados = filtrados.filter(c => !c.temas || c.temas.length === 0 || c.temas === '[]');
        } else if (tema !== 'Todos los cantos') {
            filtrados = filtrados.filter(c => c.temas && c.temas.includes(tema));
        }
    }

    // 3. Filtrado de Búsqueda de Texto
    const busqueda = DOM.inputBuscador.value.trim();
    if (busqueda !== '') {
        filtrados = buscadorUI.filtrarCantos(filtrados, busqueda);
    }
    
    // Renderizado
    if (DOM.contadorCantos) DOM.contadorCantos.textContent = `${filtrados.length} cantos`;
    
    buscadorUI.renderizarLista(filtrados, DOM.listaCantos, (canto) => {
        pdfEngine.abrirVisor(canto, DOM.contenedorPdf, DOM.barraSuperior);
    });
}

/**
 * ============================================================================
 * SISTEMA DE EVENTOS (CON TU CÓDIGO GESTUAL INTACTO)
 * ============================================================================
 */
function configurarEventosGlobales() {
    // EVENTOS DEL SIDEBAR DE CATEGORÍAS
    DOM.sidebar?.addEventListener('click', (e) => {
        const btnCat = e.target.closest('.nav-btn[data-cat]');
        if (btnCat) {
            document.querySelectorAll('.nav-btn[data-cat]').forEach(b => b.classList.remove('activo'));
            btnCat.classList.add('activo');

            APP_STATE.categoriaActiva = btnCat.dataset.cat;
            if (DOM.inputBuscador) DOM.inputBuscador.value = '';
            DOM.btnLimpiarBusqueda?.classList.add('oculto');
            
            actualizarVista();
            if (window.innerWidth <= 768) alternarMenuLateral(true);
        }
    });

    // TU CÓDIGO ORIGINAL DE EVENTOS
    DOM.inputBuscador?.addEventListener('input', (e) => {
        DOM.btnLimpiarBusqueda?.classList.toggle('oculto', e.target.value.trim() === '');
        actualizarVista();
    });

    DOM.btnLimpiarBusqueda?.addEventListener('click', () => {
        DOM.inputBuscador.value = '';
        DOM.btnLimpiarBusqueda.classList.add('oculto');
        actualizarVista();
        DOM.inputBuscador.focus();
    });

    DOM.btnCerrar?.addEventListener('click', () => {
        if (window.location.hash === "#visor") history.back();
        else pdfEngine.cerrarVisor(DOM.contenedorPdf);
    });

    window.addEventListener('popstate', () => {
        if (document.getElementById('vista-visor')?.style.display === 'block') {
            pdfEngine.cerrarVisor(DOM.contenedorPdf);
        }
    });

    DOM.btnToggleSidebar?.addEventListener('click', () => alternarMenuLateral());
    DOM.overlay?.addEventListener('click', () => alternarMenuLateral(true));

    // TU CÓDIGO ORIGINAL DE GESTOS TÁCTILES
    let toqueInicialX = 0;
    document.addEventListener('touchstart', e => toqueInicialX = e.changedTouches[0].screenX, { passive: true });
    document.addEventListener('touchend', e => {
        if (toqueInicialX - e.changedTouches[0].screenX > 50 && window.innerWidth <= 768 && !DOM.sidebar.classList.contains('oculto')) {
            alternarMenuLateral(true);
        }
    }, { passive: true });

    // EVENTOS DE LOS AJUSTES
    document.getElementById('btn-salir')?.addEventListener('click', async () => {
        if(confirm('¿Seguro que deseas cerrar sesión?')) {
            await supabase.auth.signOut();
            expulsarUsuario();
        }
    });

    document.getElementById('btn-limpiar-cache')?.addEventListener('click', async () => {
        if(confirm('¿Deseas limpiar la memoria del dispositivo?')) {
            try {
                const keys = await caches.keys();
                await Promise.all(keys.map(key => caches.delete(key)));
                localStorage.clear();
                sessionStorage.clear();
                window.location.reload();
            } catch (e) {
                alert('Error al limpiar caché: ' + e.message);
            }
        }
    });
}

function alternarMenuLateral(forzarCierre = false) {
    if (forzarCierre) DOM.sidebar.classList.add('oculto');
    else DOM.sidebar.classList.toggle('oculto');
    
    if (window.innerWidth <= 768 && !DOM.sidebar.classList.contains('oculto')) {
        DOM.overlay.classList.add('activo');
        setTimeout(() => DOM.overlay.style.opacity = '1', 10);
    } else {
        DOM.overlay.style.opacity = '0';
        setTimeout(() => DOM.overlay.classList.remove('activo'), 300);
    }
}

/**
 * ============================================================================
 * UTILIDADES
 * ============================================================================
 */
function expulsarUsuario() {
    window.location.replace('/auth.html');
}

function mostrarErrorPantalla(mensaje) {
    if(DOM.listaCantos) {
        DOM.listaCantos.innerHTML = `
            <div style="padding: 24px; color: #be123c; text-align: center; background: #fef2f2; border-radius: 8px; border: 1px solid #f87171; margin: 20px;">
                <h3 style="font-weight: 700; margin-bottom: 8px;">Error al cargar el catálogo</h3>
                <p style="font-size: 14px;">${mensaje}</p>
            </div>
        `;
    }
}

// TU CÓDIGO ORIGINAL DEL TEMA
function inicializarTema() {
    APP_STATE.temaOscuro = localStorage.getItem('tema-ui') === 'oscuro';
    aplicarTemaGrafico(APP_STATE.temaOscuro);

    DOM.btnToggleTema?.addEventListener('click', () => {
        APP_STATE.temaOscuro = !document.body.classList.contains('tema-oscuro');
        aplicarTemaGrafico(APP_STATE.temaOscuro);
        localStorage.setItem('tema-ui', APP_STATE.temaOscuro ? 'oscuro' : 'claro');
    });
}

function aplicarTemaGrafico(esOscuro) {
    document.body.classList.toggle('tema-oscuro', esOscuro);
    if (DOM.iconoTemaLuna && DOM.iconoTemaSol) {
        DOM.iconoTemaLuna.style.display = esOscuro ? 'none' : 'block';
        DOM.iconoTemaSol.style.display = esOscuro ? 'block' : 'none';
    }
}

if (window.innerWidth <= 768 && DOM.sidebar) DOM.sidebar.classList.add('oculto');
arrancarAplicacion();