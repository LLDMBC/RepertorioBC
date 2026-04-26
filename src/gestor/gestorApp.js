import { supabase } from '../api/supabase.js';
import { inicializarPartiturasPanel } from './partituras/partiturasPanel.js';
import { inicializarPanelMiembros } from './miembros/miembrosPanel.js';
import { inicializarSuperPanel } from './admin/superPanel.js';

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
        
        contenedorSelector.style.display = 'block';
        contextoSedeActiva = coros[0]?.id;

        selectorSede.addEventListener('change', async (e) => {
            contextoSedeActiva = e.target.value;
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