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
        configurarSuscripcionesRealtime();

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

function configurarSuscripcionesRealtime() {
    supabase.channel('cambios-repertorio')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cantos' }, manejarCambioRealtime)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cantos_coros' }, manejarCambioRealtime)
        .subscribe();

    // Suscripción a Avisos
    const idSede = APP_STATE.perfil.coro_id;
    supabase.channel('avisos-sede')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'avisos',
            filter: `coro_id=eq.${idSede}`
        }, payload => manejarNuevoAviso(payload.new))
        .subscribe();
}

/**
 * ============================================================================
 * SISTEMA DE FEEDBACK (TOASTS)
 * ============================================================================
 */
window.mostrarToast = (mensaje, tipo = 'exito') => {
    const contenedor = document.getElementById('contenedor-toasts');
    if (!contenedor) return;

    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.textContent = mensaje;

    contenedor.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastOut 0.4s ease forwards';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
};

async function manejarNuevoAviso(aviso) {
    if (aviso.tipo === 'VIVO') {
        const banner = document.getElementById('banner-vivo');
        const texto = document.getElementById('banner-texto');
        const btnAbrir = document.getElementById('btn-abrir-vivo');

        if (banner && texto && btnAbrir) {
            texto.textContent = `CANTANDO AHORA: ${aviso.mensaje.toUpperCase()}`;
            banner.style.display = 'flex';
            banner.style.transform = 'translateX(-50%) translateY(0)';

            btnAbrir.onclick = () => {
                const canto = APP_STATE.cantos.find(c => c.id == aviso.metadata.id_canto);
                if (canto) {
                    pdfEngine.abrirVisor(canto, DOM.contenedorPdf, DOM.barraSuperior);
                    banner.style.transform = 'translateX(-50%) translateY(-150%)';
                    setTimeout(() => banner.style.display = 'none', 300);
                }
            };

            // Desaparecer tras 10 minutos
            setTimeout(() => {
                if (banner.style.display === 'flex') {
                    banner.style.transform = 'translateX(-50%) translateY(-150%)';
                    setTimeout(() => banner.style.display = 'none', 300);
                }
            }, 600000);
        }
    } else if (aviso.tipo === 'RECORDATORIO') {
        const bannerRec = document.getElementById('banner-recordatorio');
        const textoRec = document.getElementById('recordatorio-texto');
        if (bannerRec && textoRec) {
            textoRec.textContent = aviso.mensaje.toUpperCase();
            bannerRec.style.display = 'flex';
            bannerRec.style.transform = 'translateX(-50%) translateY(0)';
        }

        const modalAjustes = document.getElementById('modal-ajustes');
        if (modalAjustes && modalAjustes.style.display === 'flex') {
            await cargarNotificacionesRecientes();
        }
    }
}

async function cargarNotificacionesRecientes() {
    const lista = document.getElementById('historial-notificaciones');
    if (!lista) return;

    try {
        const { data, error } = await supabase
            .from('avisos')
            .select('*')
            .eq('coro_id', APP_STATE.perfil.coro_id)
            .eq('tipo', 'RECORDATORIO')
            .order('creado_en', { ascending: false })
            .limit(5);

        if (error) throw error;

        if (!data || data.length === 0) {
            lista.innerHTML = '<p style="font-size: 12px; color: var(--color-texto-suave); text-align: center;">Sin notificaciones recientes</p>';
            return;
        }

        lista.innerHTML = data.map(n => {
            const fecha = new Date(n.creado_en).toLocaleDateString('es-ES', { hour: '2-digit', minute: '2-digit' });
            return `
                <div class="notificacion-item">
                    <div class="notificacion-fecha">${fecha}</div>
                    <div class="notificacion-mensaje">${n.mensaje}</div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Error cargando historial de avisos:', err);
    }
}

async function manejarCambioRealtime(payload) {
    console.log('Sincronización Realtime detectada:', payload);
    try {
        await cargarRepertorio();
        actualizarVista();
    } catch (error) {
        console.error('Error al sincronizar datos en realtime:', error);
    }
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
                <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></span> ${id.replace(/-/g, ' ').toUpperCase()}
            </button>
        `).join('');
    }

    if (APP_STATE.perfil && ['director', 'superadmin'].includes(APP_STATE.perfil.rol)) {
        if (DOM.sidebar && !document.getElementById('btn-ir-gestor')) {
            const btnGestor = document.createElement('button');
            btnGestor.id = 'btn-ir-gestor';
            btnGestor.className = 'nav-btn';
            btnGestor.innerHTML = '<span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></span> ADMINISTRACIÓN';
            btnGestor.onclick = () => window.location.href = '/gestor.html';
            const footer = document.getElementById('sidebar-footer');
            if (footer) footer.appendChild(btnGestor);
            else DOM.sidebar.appendChild(btnGestor);
        }
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
        requestWakeLock();
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
        else {
            pdfEngine.cerrarVisor(DOM.contenedorPdf);
            releaseWakeLock();
        }
    });

    window.addEventListener('popstate', () => {
        if (document.getElementById('vista-visor')?.style.display === 'block') {
            pdfEngine.cerrarVisor(DOM.contenedorPdf);
            releaseWakeLock();
        }
    });

    DOM.btnToggleSidebar?.addEventListener('click', () => alternarMenuLateral());
    DOM.overlay?.addEventListener('click', () => alternarMenuLateral(true));

    // GESTOS TÁCTILES GLOBALES
    let toqueInicialX = 0;
    let toqueInicialY = 0;
    
    document.addEventListener('touchstart', e => {
        toqueInicialX = e.changedTouches[0].screenX;
        toqueInicialY = e.changedTouches[0].screenY;
    }, { passive: true });

    document.addEventListener('touchend', e => {
        const deltaX = toqueInicialX - e.changedTouches[0].screenX;
        const deltaY = toqueInicialY - e.changedTouches[0].screenY;

        // Swipe Left (Cerrar Sidebar)
        if (deltaX > 50 && Math.abs(deltaY) < 30 && window.innerWidth <= 768 && !DOM.sidebar.classList.contains('oculto')) {
            alternarMenuLateral(true);
        }

        // Swipe Up en Banners de Aviso
        const banners = ['.banner-vivo', '.banner-recordatorio'];
        banners.forEach(selector => {
            const banner = document.querySelector(selector);
            if (banner && banner.style.display === 'flex' && e.target.closest(selector)) {
                if (deltaY > 50 && Math.abs(deltaX) < 30) {
                    banner.style.transform = 'translateX(-50%) translateY(-150%)';
                    setTimeout(() => banner.style.display = 'none', 300);
                }
            }
        });
    }, { passive: true });

    const cerrarBanner = (id) => {
        const banner = document.getElementById(id);
        if (banner) {
            banner.style.transform = 'translateX(-50%) translateY(-150%)';
            setTimeout(() => banner.style.display = 'none', 300);
        }
    };

    document.getElementById('btn-cerrar-banner')?.addEventListener('click', () => cerrarBanner('banner-vivo'));
    document.getElementById('btn-cerrar-recordatorio')?.addEventListener('click', () => cerrarBanner('banner-recordatorio'));

    // INICIALIZAR MODO PÁGINAS
    const chkModoPaginas = document.getElementById('chk-modo-paginas');
    if (chkModoPaginas) {
        const modoActivo = localStorage.getItem('modo-paginas') === 'true';
        chkModoPaginas.checked = modoActivo;
        DOM.contenedorPdf.classList.toggle('modo-paginas', modoActivo);

        chkModoPaginas.addEventListener('change', (e) => {
            const activo = e.target.checked;
            localStorage.setItem('modo-paginas', activo);
            DOM.contenedorPdf.classList.toggle('modo-paginas', activo);
        });
    }

    // EVENTOS DE LOS AJUSTES
    const modalAjustes = document.getElementById('modal-ajustes');
    
    document.getElementById('btn-ajustes')?.addEventListener('click', async () => {
        if (modalAjustes && APP_STATE.perfil) {
            document.getElementById('info-nombre').textContent = APP_STATE.perfil.nombre || 'N/A';
            document.getElementById('info-email').textContent = APP_STATE.perfil.email || 'N/A';
            document.getElementById('info-sede').textContent = APP_STATE.perfil.coro_id ? APP_STATE.perfil.coro_id.toUpperCase() : 'N/A';
            document.getElementById('info-rol').textContent = APP_STATE.perfil.rol || 'N/A';
            
            await cargarNotificacionesRecientes();
            
            modalAjustes.style.display = 'flex';
            if (window.innerWidth <= 768) alternarMenuLateral(true);
        }
    });

    document.getElementById('btn-cerrar-ajustes')?.addEventListener('click', () => {
        if (modalAjustes) modalAjustes.style.display = 'none';
    });

    modalAjustes?.addEventListener('click', (e) => {
        if (e.target === modalAjustes) modalAjustes.style.display = 'none';
    });

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
                window.mostrarToast('Error al limpiar caché', 'error');
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

/**
 * ============================================================================
 * SCREEN WAKELOCK API
 * ============================================================================
 */
let wakeLock = null;

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
        }
    } catch (err) {
        console.error('Wakelock error:', err);
    }
}

function releaseWakeLock() {
    if (wakeLock !== null) {
        wakeLock.release().then(() => {
            wakeLock = null;
        });
    }
}

document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
        await requestWakeLock();
    }
});

if (window.innerWidth <= 768 && DOM.sidebar) DOM.sidebar.classList.add('oculto');
arrancarAplicacion();