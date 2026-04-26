import { supabase } from '../../api/supabase.js';

// ==========================================
// 1. CAPA DE DATOS (API / Supabase)
// ==========================================
const API = {
    /**
     * Obtiene todos los usuarios con rol 'miembro' de una sede específica.
     */
    async obtenerMiembrosPorCoro(coroId) {
        const { data, error } = await supabase
            .from('perfiles')
            .select('id, nombre, email, estado, rol, coro_id')
            .eq('coro_id', coroId)
            .eq('rol', 'miembro')
            .order('nombre', { ascending: true });
            
        if (error) throw error;
        return data || [];
    },

    /**
     * Actualiza el estado de aprobación de un usuario.
     */
    async actualizarEstadoUsuario(usuarioId, nuevoEstado) {
        const { error } = await supabase
            .from('perfiles')
            .update({ estado: nuevoEstado })
            .eq('id', usuarioId);
            
        if (error) throw error;
    }
};

// ==========================================
// 2. CAPA DE INTERFAZ (DOM / Renderizado)
// ==========================================
const UI = {
    construirEstructura(contenedor) {
        contenedor.innerHTML = `
            <div style="margin-bottom: 24px;">
                <h2 style="color: var(--navy-deep); font-size: 20px; margin-bottom: 8px;">GESTIÓN DE USUARIOS DE LA SEDE</h2>
                <p style="color: var(--text-secondary); font-size: 13px;">Administre las solicitudes de acceso y los miembros activos correspondientes a la sede seleccionada.</p>
            </div>
            <div id="contenedor-tablas-miembros"></div>
        `;
    },

    renderizarTablas(miembros) {
        const contenedorTablas = document.getElementById('contenedor-tablas-miembros');
        
        if (!miembros || miembros.length === 0) {
            contenedorTablas.innerHTML = `
                <div style="background: white; border: 1px solid var(--border-color); padding: 32px; text-align: center; border-radius: 8px;">
                    <p style="color: var(--text-secondary); font-weight: 600;">NO HAY USUARIOS REGISTRADOS EN ESTA SEDE.</p>
                </div>
            `;
            return;
        }

        const pendientes = miembros.filter(m => m.estado === 'pendiente');
        const activos = miembros.filter(m => m.estado === 'activo');

        let html = '';

        // 1. Tabla de Solicitudes Pendientes
        html += `
            <section style="margin-bottom: 32px;">
                <h3 style="font-size: 14px; color: var(--navy-deep); margin-bottom: 12px; border-bottom: 2px solid var(--gold-accent); padding-bottom: 8px; display: inline-block;">
                    SOLICITUDES PENDIENTES (${pendientes.length})
                </h3>
                ${pendientes.length === 0 ? 
                    '<p style="color: var(--text-secondary); font-size: 13px;">No hay solicitudes pendientes de revisión.</p>' : 
                    this.generarTablaHTML(pendientes, 'pendiente')
                }
            </section>
        `;

        // 2. Tabla de Miembros Activos
        html += `
            <section>
                <h3 style="font-size: 14px; color: var(--navy-deep); margin-bottom: 12px; border-bottom: 2px solid var(--border-color); padding-bottom: 8px; display: inline-block;">
                    MIEMBROS ACTIVOS (${activos.length})
                </h3>
                ${activos.length === 0 ? 
                    '<p style="color: var(--text-secondary); font-size: 13px;">No hay miembros activos en esta sede.</p>' : 
                    this.generarTablaHTML(activos, 'activo')
                }
            </section>
        `;

        contenedorTablas.innerHTML = html;
    },

    generarTablaHTML(usuarios, tipo) {
        return `
            <table class="tabla-dashboard">
                <thead>
                    <tr>
                        <th>USUARIO</th>
                        <th>CORREO ELECTRÓNICO</th>
                        <th>ESTADO ACTUAL</th>
                        <th style="text-align: right;">ACCIONES OPERATIVAS</th>
                    </tr>
                </thead>
                <tbody>
                    ${usuarios.map(u => `
                        <tr data-usuario-id="${u.id}">
                            <td style="font-weight: 600; color: var(--navy-deep);">${u.nombre || 'SIN NOMBRE'}</td>
                            <td style="color: var(--text-secondary);">${u.email || '-'}</td>
                            <td>
                                <span class="status-badge ${u.estado}">
                                    ${u.estado.toUpperCase()}
                                </span>
                            </td>
                            <td style="text-align: right;">
                                ${tipo === 'pendiente' ? `
                                    <button class="btn-principal" data-accion="aprobar" style="padding: 6px 12px; font-size: 11px;">APROBAR ACCESO</button>
                                    <button class="btn-revocar" data-accion="rechazar" style="margin-left: 8px;">DENEGAR</button>
                                ` : `
                                    <button class="btn-revocar" data-accion="revocar">REVOCAR ACCESO</button>
                                `}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    mostrarNotificacionFlotante(mensaje, esError = false) {
        window.mostrarToast(mensaje, esError ? 'error' : 'exito');
    }
};

let canalRealtimeMiembros = null;

// ==========================================
// 3. ORQUESTADOR (Controlador / Eventos)
// ==========================================
export async function inicializarPanelMiembros(coroId) {
    const contenedor = document.getElementById('panel-miembros');
    if (!contenedor) return;

    if (!coroId) {
        contenedor.innerHTML = '<div style="padding: 20px; color: var(--danger); font-weight: 600;">ERROR DE CONTEXTO: NO SE HA DETECTADO UNA SEDE VÁLIDA.</div>';
        return;
    }

    // 1. Preparar la estructura
    UI.construirEstructura(contenedor);

    // 2. Función de recarga de estado
    async function sincronizarDatos() {
        try {
            const miembros = await API.obtenerMiembrosPorCoro(coroId);
            UI.renderizarTablas(miembros);
        } catch (error) {
            console.error("Error al sincronizar usuarios:", error);
            UI.mostrarNotificacionFlotante("ERROR DE CONEXIÓN", true);
        }
    }

    // Configurar Realtime
    function configurarRealtime() {
        if (canalRealtimeMiembros) {
            supabase.removeChannel(canalRealtimeMiembros);
        }
        canalRealtimeMiembros = supabase.channel(`miembros-${coroId}`)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'perfiles',
                filter: `coro_id=eq.${coroId}`
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    UI.mostrarNotificacionFlotante(`NUEVA SOLICITUD DE INGRESO DETECTADA`);
                }
                sincronizarDatos();
            })
            .subscribe();
    }

    // 3. Delegación de eventos (Event Delegation para las tablas)
    contenedor.onclick = async (e) => {
        const boton = e.target.closest('button[data-accion]');
        if (!boton) return;

        const fila = boton.closest('tr[data-usuario-id]');
        const usuarioId = fila?.dataset.usuarioId;
        const accion = boton.dataset.accion;

        if (!usuarioId) return;

        // Lógica de Confirmación Visual para acciones de denegación/revocación
        if (['rechazar', 'revocar'].includes(accion)) {
            if (boton.dataset.confirmar !== 'true') {
                const textoOriginal = boton.textContent;
                boton.dataset.confirmar = 'true';
                boton.classList.add('confirmando');
                boton.textContent = "¿ESTÁ SEGURO?";
                
                setTimeout(() => {
                    if (boton.dataset.confirmar === 'true') {
                        boton.dataset.confirmar = 'false';
                        boton.classList.remove('confirmando');
                        boton.textContent = textoOriginal;
                    }
                }, 3000);
                return;
            }
        }

        // Deshabilitar botón temporalmente para evitar doble clic
        boton.disabled = true;
        boton.style.opacity = '0.5';

        try {
            if (accion === 'aprobar') {
                await API.actualizarEstadoUsuario(usuarioId, 'activo');
                UI.mostrarNotificacionFlotante("ACCESO APROBADO CORRECTAMENTE");
            } 
            else if (accion === 'rechazar' || accion === 'revocar') {
                await API.actualizarEstadoUsuario(usuarioId, 'rechazado');
                UI.mostrarNotificacionFlotante("ACCESO REVOCADO CORRECTAMENTE");
            }

            // Recargar las tablas para reflejar el cambio
            await sincronizarDatos();

        } catch (error) {
            console.error("Error ejecutando acción:", error);
            UI.mostrarNotificacionFlotante("FALLO AL EJECUTAR LA OPERACIÓN", true);
            boton.disabled = false;
            boton.style.opacity = '1';
        }
    };

    // 4. Arranque inicial
    await sincronizarDatos();
}