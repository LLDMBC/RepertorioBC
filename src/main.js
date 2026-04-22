import { pdfEngine } from './core/pdfEngine.js';
import { offlineManager } from './core/offlineManager.js';
import { buscadorUI } from './ui/buscador.js';
import { visorUI } from './ui/visor.js';

// --- ESTADO Y ELEMENTOS ---
let cantosGlobales = [];

const contenedorLista = document.getElementById('lista-cantos');
const listaTemas = document.getElementById('lista-temas');
const inputBuscador = document.getElementById('buscador');
const contadorCantos = document.getElementById('contador-cantos');
const contenedorPdf = document.getElementById('contenedor-pdf');
const barraSuperior = document.getElementById('barra-superior');
const btnLimpiarBusqueda = document.getElementById('btn-limpiar-busqueda');
const contadorDescargas = document.getElementById('contador-descargas');
const btnResetZoom = document.getElementById('btn-reset-zoom');
const btnCerrar = document.getElementById('btn-cerrar');

// --- ELEMENTOS DE LA BARRA LATERAL ---
const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
const sidebar = document.getElementById('sidebar-temas');
const overlay = document.createElement('div');
overlay.id = 'overlay-sidebar';
document.body.appendChild(overlay);

// --- 1. LÓGICA DE BARRA LATERAL (MENÚ) ---
function alternarMenu(forzarCierre = false) {
    if (forzarCierre) sidebar.classList.add('oculto');
    else sidebar.classList.toggle('oculto');
    
    if (window.innerWidth <= 768 && !sidebar.classList.contains('oculto')) {
        overlay.classList.add('activo');
        setTimeout(() => overlay.style.opacity = '1', 10);
    } else {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.classList.remove('activo'), 300);
    }
}

if (window.innerWidth <= 768) sidebar.classList.add('oculto');
btnToggleSidebar.addEventListener('click', () => alternarMenu());
overlay.addEventListener('click', () => alternarMenu(true));

let toqueInicialX = 0;
document.addEventListener('touchstart', e => toqueInicialX = e.changedTouches[0].screenX, { passive: true });
document.addEventListener('touchend', e => {
    if (toqueInicialX - e.changedTouches[0].screenX > 50 && window.innerWidth <= 768 && !sidebar.classList.contains('oculto')) {
        alternarMenu(true);
    }
}, { passive: true });

// --- 2. INICIALIZACIÓN (DATOS Y SW) ---
async function inicializarApp() {
    offlineManager.registrarServiceWorker();

    try {
        const res = await fetch('/cantos.json');
        const datos = await res.json();
        
        cantosGlobales = datos.map(c => {
            let arrTemas = Array.isArray(c.temas) ? c.temas : (typeof c.tema === 'string' && c.tema.trim() !== '' ? [c.tema.trim()] : []);
            return { ...c, temas: arrTemas };
        });

        // 1. Generar Menú de Temas (cerramos el menú al clickear en móviles)
        buscadorUI.generarMenuTemas(cantosGlobales, listaTemas, () => {
            actualizarVista();
            if (window.innerWidth <= 768) alternarMenu(true);
        });

        // 2. Renderizar Cantos Iniciales
        actualizarVista();

        // 3. Activar Modo Offline
        await offlineManager.actualizarContador(cantosGlobales, contadorDescargas);
        offlineManager.sincronizarPartituras(cantosGlobales, contadorDescargas);

        // 4. Iniciar Gestos Táctiles del PDF
        visorUI.iniciarEventos(contenedorPdf, btnResetZoom, barraSuperior);

    } catch (err) {
        console.error("Error al cargar datos", err);
    }
}

// --- 3. ACTUALIZACIÓN DE VISTA Y BÚSQUEDA ---
function actualizarVista() {
    const filtrados = buscadorUI.filtrarCantos(cantosGlobales, inputBuscador.value);
    contadorCantos.textContent = `${filtrados.length} cantos`;
    
    buscadorUI.renderizarLista(filtrados, contenedorLista, (canto) => {
        pdfEngine.abrirVisor(canto, contenedorPdf, barraSuperior);
    });
}

inputBuscador.addEventListener('input', () => {
    btnLimpiarBusqueda.classList.toggle('oculto', inputBuscador.value.trim() === '');
    actualizarVista();
});

btnLimpiarBusqueda.addEventListener('click', () => {
    inputBuscador.value = '';
    btnLimpiarBusqueda.classList.add('oculto');
    actualizarVista();
    inputBuscador.focus();
});

// --- 4. CERRAR EL VISOR (Botón e Historial) ---
btnCerrar.addEventListener('click', () => {
    if (window.location.hash === "#visor") history.back();
    else pdfEngine.cerrarVisor(contenedorPdf);
});

window.addEventListener('popstate', () => {
    if (document.getElementById('vista-visor').style.display === 'block') {
        pdfEngine.cerrarVisor(contenedorPdf);
    }
});

// Arrancar motor
inicializarApp();