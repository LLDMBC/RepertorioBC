import { supabase } from '../../api/supabase.js';

// ==========================================
// 1. CAPA DE DATOS (API / Supabase)
// ==========================================
const API = {
    async obtenerMetricas() {
        const [{ count: totalCoros }, { count: totalPartituras }, { count: pendientes }] = await Promise.all([
            supabase.from('coros').select('id', { count: 'exact', head: true }),
            supabase.from('cantos').select('id', { count: 'exact', head: true }),
            supabase.from('perfiles').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente')
        ]);
        return { totalCoros: totalCoros ?? 0, totalPartituras: totalPartituras ?? 0, pendientes: pendientes ?? 0 };
    },

    async obtenerSedes() {
        const { data, error } = await supabase.from('coros').select('id, nombre').order('nombre');
        if (error) throw error;
        return data || [];
    },

    async obtenerUsuarios() {
        const { data, error } = await supabase.from('perfiles').select('id, nombre, email, rol, coro_id').order('nombre');
        if (error) throw error;
        return data || [];
    },

    async crearSede(id, nombre) {
        const { error } = await supabase.from('coros').insert([{ id, nombre }]);
        if (error) throw error;
    },

    async actualizarSede(id, nombre) {
        const { error } = await supabase.from('coros').update({ nombre }).eq('id', id);
        if (error) throw error;
    },

    async actualizarRol(userId, nuevoRol) {
        const { error } = await supabase.from('perfiles').update({ rol: nuevoRol }).eq('id', userId);
        if (error) throw error;
    }
};

// ==========================================
// 2. CAPA DE INTERFAZ Y ESTADO (UI)
// ==========================================
const UI = {
    notificar(contenedor, mensaje, esError = false) {
        window.mostrarToast(mensaje, esError ? 'error' : 'exito');
    },

    generarMetricasHTML(metricas) {
        return `
            <div style="margin-bottom: 32px;">
                <h2 style="color: var(--navy-deep); font-size: 18px; margin-bottom: 16px;">MÉTRICAS DEL SISTEMA</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px;">
                    <div style="border: 1px solid var(--border-color); padding: 20px; border-radius: 12px; text-align: center; background: white;">
                        <div style="font-size: 24px; font-weight: 800; color: var(--gold-accent);">${metricas.totalCoros}</div>
                        <div style="font-size: 11px; font-weight: 700; color: var(--text-secondary); margin-top: 4px;">SEDES</div>
                    </div>
                    <div style="border: 1px solid var(--border-color); padding: 20px; border-radius: 12px; text-align: center; background: white;">
                        <div style="font-size: 24px; font-weight: 800; color: var(--gold-accent);">${metricas.totalPartituras}</div>
                        <div style="font-size: 11px; font-weight: 700; color: var(--text-secondary); margin-top: 4px;">PARTITURAS</div>
                    </div>
                    <div style="border: 1px solid var(--border-color); padding: 20px; border-radius: 12px; text-align: center; background: white;">
                        <div style="font-size: 24px; font-weight: 800; color: var(--navy-deep);">${metricas.pendientes}</div>
                        <div style="font-size: 11px; font-weight: 700; color: var(--text-secondary); margin-top: 4px;">USUARIOS PENDIENTES</div>
                    </div>
                </div>
            </div>
        `;
    },

    generarSedesHTML(sedes) {
        return `
            <section style="background: white; border: 1px solid var(--border-color); padding: 24px; border-radius: 12px;">
                <h3 style="font-size: 14px; font-weight: 800; color: var(--navy-deep); margin-bottom: 16px;">CREACIÓN DE SEDES</h3>
                <form id="form-crear-coro" style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px;">
                    <input id="nuevo-coro-id" class="input-estandar" placeholder="ID INTERNO (ej: otay-sur)" required />
                    <input id="nuevo-coro-nombre" class="input-estandar" placeholder="NOMBRE VISIBLE" required />
                    <button class="btn-principal" type="submit">REGISTRAR NUEVA SEDE</button>
                </form>

                <h3 style="font-size: 14px; font-weight: 800; color: var(--navy-deep); margin-bottom: 12px;">SEDES ACTUALES</h3>
                <div class="contenedor-lista-compacta" style="max-height: 400px; overflow-y: auto;">
                    <div class="lista-compacta">
                        ${sedes.map(sede => `
                            <div class="item-compacto" data-sede-id="${sede.id}">
                                <div class="item-info">
                                    <span class="etiqueta" style="margin-bottom: 6px; display: inline-block;">ID: ${sede.id}</span>
                                    <input class="input-estandar" data-campo="nombre-sede" value="${sede.nombre}" placeholder="Nombre Oficial">
                                </div>
                                <div class="item-acciones">
                                    <button class="btn-pequeno btn-secundario ancho-total" data-accion="actualizar-sede">GUARDAR CAMBIO</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </section>
        `;
    },

    generarUsuariosHTML(usuarios) {
        return `
            <section style="background: white; border: 1px solid var(--border-color); padding: 24px; border-radius: 12px;">
                <h3 style="font-size: 14px; font-weight: 800; color: var(--navy-deep); margin-bottom: 16px;">CONTROL DE PRIVILEGIOS</h3>
                <input id="buscador-global-usuarios" class="input-estandar" placeholder="BUSCAR USUARIO POR EMAIL..." style="margin-bottom: 16px;" />
                
                <div class="contenedor-lista-compacta" style="max-height: 500px; overflow-y: auto;">
                    <div class="lista-compacta">
                        ${usuarios.map(u => `
                            <div class="item-compacto fila-usuario" data-user-id="${u.id}" data-email="${u.email.toLowerCase()}">
                                <div class="item-info">
                                    <p style="font-weight: 700; font-size: 14px; color: var(--navy-deep); margin-bottom: 2px;">${u.nombre || 'SIN NOMBRE'}</p>
                                    <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">${u.email}</p>
                                    <span class="etiqueta">${u.coro_id}</span>
                                </div>
                                <div class="item-acciones">
                                    <select class="select-contexto" data-accion="cambiar-rol" data-rol-original="${u.rol}" style="padding: 8px 12px; font-size: 12px;">
                                        <option value="miembro" ${u.rol === 'miembro' ? 'selected' : ''}>MIEMBRO</option>
                                        <option value="director" ${u.rol === 'director' ? 'selected' : ''}>DIRECTOR</option>
                                        <option value="superadmin" ${u.rol === 'superadmin' ? 'selected' : ''}>SUPERADMIN</option>
                                    </select>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </section>
        `;
    }
};

// ==========================================
// 3. ORQUESTADOR (Controlador)
// ==========================================
export async function inicializarSuperPanel(esSuperadmin) {
    const contenedor = document.getElementById('panel-maestro');
    if (!contenedor || !esSuperadmin) return;

    // Estado local para evitar llamar a DB solo por búsquedas
    let estadoGlobal = { sedes: [], usuarios: [] };

    async function cargarYRenderizar() {
        try {
            contenedor.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-secondary); font-weight: 600;">CARGANDO DATOS GLOBALES...</div>';
            
            const metricas = await API.obtenerMetricas();
            estadoGlobal.sedes = await API.obtenerSedes();
            estadoGlobal.usuarios = await API.obtenerUsuarios();

            contenedor.innerHTML = `
                ${UI.generarMetricasHTML(metricas)}
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px;">
                    ${UI.generarSedesHTML(estadoGlobal.sedes)}
                    ${UI.generarUsuariosHTML(estadoGlobal.usuarios)}
                </div>
            `;

            asignarEventos();
        } catch (error) {
            console.error("Fallo de renderizado maestro:", error);
            contenedor.innerHTML = '<div style="color: var(--danger-text); font-weight: 700; padding: 20px;">ERROR DE CONEXIÓN CRÍTICO. INTENTE RECARGAR LA PÁGINA.</div>';
        }
    }

    function asignarEventos() {
        // 1. Buscador de Usuarios (Filtro Local)
        document.getElementById('buscador-global-usuarios')?.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            document.querySelectorAll('.fila-usuario').forEach(fila => {
                fila.style.display = fila.dataset.email.includes(query) ? 'flex' : 'none';
            });
        });

        // 2. Creación de Sede
        document.getElementById('form-crear-coro')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSubmit = e.target.querySelector('button[type="submit"]');
            const idInput = document.getElementById('nuevo-coro-id');
            const nombreInput = document.getElementById('nuevo-coro-nombre');
            
            const idVal = idInput.value.trim().toLowerCase();
            const nombreVal = nombreInput.value.trim();

            if (!/^[a-z0-9-]+$/.test(idVal)) {
                return UI.notificar(contenedor, 'ERROR: EL ID SOLO ACEPTA LETRAS MINÚSCULAS, NÚMEROS Y GUIONES.', true);
            }

            // Confirmación Visual
            if (btnSubmit.dataset.confirmar !== 'true') {
                const textoOriginal = btnSubmit.textContent;
                btnSubmit.dataset.confirmar = 'true';
                btnSubmit.classList.add('confirmando');
                btnSubmit.textContent = "¿CONFIRMAR CREACIÓN?";
                setTimeout(() => {
                    if (btnSubmit.dataset.confirmar === 'true') {
                        btnSubmit.dataset.confirmar = 'false';
                        btnSubmit.classList.remove('confirmando');
                        btnSubmit.textContent = textoOriginal;
                    }
                }, 3000);
                return;
            }

            try {
                btnSubmit.disabled = true;
                btnSubmit.textContent = "CREANDO...";
                await API.crearSede(idVal, nombreVal);
                window.mostrarToast('SEDE CREADA CORRECTAMENTE');
                await cargarYRenderizar();
            } catch (err) {
                window.mostrarToast('ERROR AL CREAR SEDE', 'error');
                btnSubmit.disabled = false;
                btnSubmit.textContent = "REGISTRAR NUEVA SEDE";
            }
        });

        // 3. Delegación de Eventos: Actualización y Roles
        contenedor.addEventListener('click', async (e) => {
            // A. ACTUALIZAR NOMBRE DE SEDE
            const btnSede = e.target.closest('button[data-accion="actualizar-sede"]');
            if (btnSede) {
                const item = btnSede.closest('.item-compacto');
                const idSede = item.dataset.sedeId;
                const nuevoNombre = item.querySelector('input[data-campo="nombre-sede"]').value.trim();

                if (!nuevoNombre) return window.mostrarToast('EL NOMBRE NO PUEDE ESTAR VACÍO', 'error');

                // Confirmación Visual
                if (btnSede.dataset.confirmar !== 'true') {
                    const textoOriginal = btnSede.textContent;
                    btnSede.dataset.confirmar = 'true';
                    btnSede.classList.add('confirmando');
                    btnSede.textContent = "¿CONFIRMAR?";
                    setTimeout(() => {
                        if (btnSede.dataset.confirmar === 'true') {
                            btnSede.dataset.confirmar = 'false';
                            btnSede.classList.remove('confirmando');
                            btnSede.textContent = textoOriginal;
                        }
                    }, 3000);
                    return;
                }

                try {
                    btnSede.disabled = true;
                    btnSede.textContent = "GUARDANDO...";
                    await API.actualizarSede(idSede, nuevoNombre);
                    window.mostrarToast('NOMBRE DE SEDE ACTUALIZADO');
                    btnSede.textContent = "GUARDAR CAMBIO";
                    btnSede.disabled = false;
                    btnSede.dataset.confirmar = 'false';
                    btnSede.classList.remove('confirmando');
                } catch (err) {
                    window.mostrarToast('ERROR AL ACTUALIZAR', 'error');
                    btnSede.disabled = false;
                }
            }
        });

        contenedor.addEventListener('change', async (e) => {
            // B. ELEVACIÓN DE PRIVILEGIOS
            const selectRol = e.target.closest('select[data-accion="cambiar-rol"]');
            if (selectRol) {
                const item = selectRol.closest('.item-compacto');
                const userId = item.dataset.userId;
                const userEmail = item.dataset.email;
                const rolOriginal = selectRol.dataset.rolOriginal;
                const nuevoRol = selectRol.value;

                // Confirmación Defensiva Crítica (Sustituimos el confirm por un aviso directo o bypass controlado)
                // Por ahora, para selects, permitiremos el cambio directo con un Toast de éxito o error
                try {
                    selectRol.disabled = true;
                    await API.actualizarRol(userId, nuevoRol);
                    selectRol.dataset.rolOriginal = nuevoRol; 
                    window.mostrarToast(`PRIVILEGIOS ACTUALIZADOS: ${userEmail.toUpperCase()}`);
                } catch (err) {
                    window.mostrarToast('ERROR AL CAMBIAR PRIVILEGIOS', 'error');
                    selectRol.value = rolOriginal; 
                } finally {
                    selectRol.disabled = false;
                }
            }
        });
    }

    // Arranque
    await cargarYRenderizar();
}