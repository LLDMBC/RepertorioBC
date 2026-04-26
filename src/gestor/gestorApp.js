import { supabase } from '../api/supabase.js';
import { inicializarPartiturasPanel } from './partituras/partiturasPanel.js';
import { inicializarPanelMiembros } from './miembros/miembrosPanel.js';
import { inicializarSuperPanel } from './admin/superPanel.js';

/**
 * SISTEMA DE FEEDBACK (TOASTS) GLOBAL PARA EL GESTOR
 */
window.mostrarToast = (mensaje, tipo = 'exito') => {
    const contenedor = document.getElementById('contenedor-toasts') || document.body;
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.style.cssText = `
        position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
        background: white; color: #0f172a; padding: 12px 24px; border-radius: 8px;
        box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); border-left: 5px solid ${tipo === 'exito' ? '#d4af37' : '#ef4444'};
        z-index: 9999; font-weight: 600; font-size: 13px; animation: toastIn 0.3s ease;
        transition: opacity 0.5s ease;
    `;
    toast.textContent = mensaje.toUpperCase();
    document.body.appendChild(toast);
    setTimeout(() => { 
        toast.style.opacity = '0'; 
        setTimeout(() => toast.remove(), 500); 
    }, 3500);
};

/**
 * gestorApp.js
 * Orquestador central del Panel de Control de RepertorioBC.
 * Gestiona la autenticación, el control de acceso por roles y el contexto global de sedes.
 */

const CONFIG = {
    SELECTORES: {
        SEDE_GLOBAL: 'selector-sede-global',
        CONTENEDOR_SEDE: 'contenedor-selector-sede',
        USUARIO_ROL: 'usuario-rol',
        MENSAJE_CARGA: 'estado-carga-global'
    },
    TABS: {
        PARTITURAS: { btn: 'tab-partituras', panel: 'panel-partituras', modulo: inicializarPartiturasPanel },
        MIEMBROS: { btn: 'tab-mi-coro', panel: 'panel-miembros', modulo: inicializarPanelMiembros },
        GLOBAL: { btn: 'tab-admin-global', panel: 'panel-maestro', modulo: inicializarSuperPanel }
    }
};

let contextoSedeActiva = null;
let perfilUsuarioActivo = null;

async function inicializarGestor() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return window.location.replace('/auth.html');

        // Obtención de perfil fresco mediante UUID
        const { data: perfil, error: perfilError } = await supabase
            .from('perfiles')
            .select('id, rol, coro_id, nombre')
            .eq('id', session.user.id)
            .single();

        if (perfilError || !perfil || !['superadmin', 'director'].includes(perfil.rol)) {
            await supabase.auth.signOut();
            return window.location.replace('/auth.html');
        }

        perfilUsuarioActivo = perfil;
        document.getElementById(CONFIG.SELECTORES.USUARIO_ROL).textContent = perfil.rol.toUpperCase();
        
        await configurarControlDeContexto();
        configurarNavegacion();
        
        // Finalizar carga inicial
        document.getElementById(CONFIG.SELECTORES.MENSAJE_CARGA).style.display = 'none';
        
    } catch (err) {
        console.error('Error crítico de inicialización:', err);
        window.location.replace('/auth.html');
    }
}

/**
 * Configura el selector de sedes dependiendo del nivel de acceso.
 */
async function configurarControlDeContexto() {
    const selectorSede = document.getElementById(CONFIG.SELECTORES.SEDE_GLOBAL);
    const contenedorSelector = document.getElementById(CONFIG.SELECTORES.CONTENEDOR_SEDE);

    if (perfilUsuarioActivo.rol === 'superadmin') {
        const { data: coros } = await supabase.from('coros').select('id, nombre').order('nombre');
        
        selectorSede.innerHTML = coros.map(c => 
            `<option value="${c.id}">SEDE: ${c.nombre.toUpperCase()}</option>`
        ).join('');
        
        // Inyectar el botón de borrado de sede
        if (!document.getElementById('btn-borrar-sede')) {
            const btnBorrarSede = document.createElement('button');
            btnBorrarSede.id = 'btn-borrar-sede';
            btnBorrarSede.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>`;
            btnBorrarSede.title = 'Borrar Sede Actual';
            btnBorrarSede.style.cssText = 'background: #dc2626; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 16px; margin-left: 10px; display: flex; align-items: center; justify-content: center;';
            
            btnBorrarSede.addEventListener('click', async () => {
                if (contextoSedeActiva === 'estatal') return;
                
                // Confirmación Visual Instantánea
                if (btnBorrarSede.dataset.confirmar !== 'true') {
                    btnBorrarSede.dataset.confirmar = 'true';
                    btnBorrarSede.style.background = '#991b1b'; // Rojo más oscuro
                    btnBorrarSede.title = 'HAGA CLIC DE NUEVO PARA ELIMINAR';
                    
                    setTimeout(() => {
                        if (btnBorrarSede.dataset.confirmar === 'true') {
                            btnBorrarSede.dataset.confirmar = 'false';
                            btnBorrarSede.style.background = '#dc2626';
                            btnBorrarSede.title = 'Borrar Sede Actual';
                        }
                    }, 3000);
                    return;
                }

                try {
                    btnBorrarSede.disabled = true;
                    btnBorrarSede.style.opacity = '0.5';
                    const { error } = await supabase.from('coros').delete().eq('id', contextoSedeActiva);
                    if (error) throw error;
                    
                    localStorage.removeItem('ultimo_coro_admin');
                    window.mostrarToast('Sede eliminada exitosamente.');
                    setTimeout(() => window.location.reload(), 1500);
                } catch (error) {
                    console.error('Error borrando sede:', error);
                    if (error.code === '23503' || (error.message && error.message.includes('foreign key constraint'))) {
                        window.mostrarToast('No se puede borrar: Hay usuarios o cantos vinculados.', 'error');
                    } else {
                        window.mostrarToast('Error técnico al eliminar la sede', 'error');
                    }
                    btnBorrarSede.disabled = false;
                    btnBorrarSede.style.opacity = '1';
                    btnBorrarSede.dataset.confirmar = 'false';
                    btnBorrarSede.style.background = '#dc2626';
                }
            });
            
            const herramientasSuperadmin = document.getElementById('herramientas-superadmin');
            if (herramientasSuperadmin) {
                herramientasSuperadmin.appendChild(btnBorrarSede);
            }
        }

        contenedorSelector.style.display = 'flex'; 

        const guardado = localStorage.getItem('ultimo_coro_admin');
        if (guardado && coros.find(c => c.id === guardado)) {
            contextoSedeActiva = guardado;
            selectorSede.value = guardado;
        } else {
            contextoSedeActiva = coros[0]?.id;
        }
        
        const btnBorrar = document.getElementById('btn-borrar-sede');
        if (btnBorrar) {
            btnBorrar.disabled = (contextoSedeActiva === 'estatal');
            btnBorrar.style.opacity = (contextoSedeActiva === 'estatal') ? '0.3' : '1';
            btnBorrar.style.cursor = (contextoSedeActiva === 'estatal') ? 'not-allowed' : 'pointer';
        }

        selectorSede.addEventListener('change', async (e) => {
            contextoSedeActiva = e.target.value;
            localStorage.setItem('ultimo_coro_admin', contextoSedeActiva);
            
            const btn = document.getElementById('btn-borrar-sede');
            if (btn) {
                btn.disabled = (contextoSedeActiva === 'estatal');
                btn.style.opacity = (contextoSedeActiva === 'estatal') ? '0.3' : '1';
                btn.style.cursor = (contextoSedeActiva === 'estatal') ? 'not-allowed' : 'pointer';
            }
            
            await recargarPanelesOperativos();
        });
    } else {
        contextoSedeActiva = perfilUsuarioActivo.coro_id;
    }

    await recargarPanelesOperativos();
}

/**
 * Recarga los módulos que dependen de la sede seleccionada.
 */
async function recargarPanelesOperativos() {
    await Promise.all([
        CONFIG.TABS.PARTITURAS.modulo(contextoSedeActiva),
        CONFIG.TABS.MIEMBROS.modulo(contextoSedeActiva)
    ]);
    
    if (perfilUsuarioActivo.rol === 'superadmin') {
        await CONFIG.TABS.GLOBAL.modulo(true);
    }
}

/**
 * Gestiona el sistema de pestañas y la visibilidad de los paneles.
 */
function configurarNavegacion() {
    if (perfilUsuarioActivo.rol === 'superadmin') {
        document.getElementById('seccion-superadmin').hidden = false;
    }

    Object.keys(CONFIG.TABS).forEach(key => {
        const tab = CONFIG.TABS[key];
        const btn = document.getElementById(tab.btn);
        
        if (btn) {
            btn.onclick = () => {
                // Reset de estados visuales
                Object.values(CONFIG.TABS).forEach(t => {
                    document.getElementById(t.btn)?.classList.remove('activo');
                    document.getElementById(t.panel).hidden = true;
                });

                btn.classList.add('activo');
                document.getElementById(tab.panel).hidden = false;
            };
        }
    });

    // Landing por defecto
    document.getElementById(CONFIG.TABS.PARTITURAS.btn).click();
}

// Botones de acción global
document.getElementById('btn-ir-publico')?.addEventListener('click', () => window.location.href = '/index.html');
document.getElementById('btn-cerrar-sesion')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.replace('/auth.html');
});

inicializarGestor();