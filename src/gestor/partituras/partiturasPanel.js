import { supabase } from '../../api/supabase.js';

// ==========================================
// 1. UTILIDADES DE NORMALIZACIÓN
// ==========================================
const normalizarNombreArchivo = (nombre) => {
    return nombre
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Quitar acentos
        .replace(/\([^)]*\)/g, "")      // Quitar paréntesis y su contenido
        .replace(/[^a-z0-9\s-]/g, "")   // Quitar caracteres especiales
        .trim()
        .replace(/\s+/g, "-");          // Cambiar espacios por guiones
};

// ==========================================
// 2. CAPA DE DATOS (API / Supabase Storage)
// ==========================================
const API = {
    async obtenerPartituras(coroId) {
        const { data, error } = await supabase
            .from('cantos')
            .select(`*, cantos_coros(coro_id)`)
            .order('nombre', { ascending: true });
            
        if (error) throw error;
        return (data || []).filter(c => c.cantos_coros && c.cantos_coros.some(rel => rel.coro_id === coroId));
    },

    async obtenerTemasUnicos() {
        const { data } = await supabase.from('cantos').select('temas');
        const setTemas = new Set();
        (data || []).forEach(item => item.temas?.forEach(t => setTemas.add(t.trim())));
        return Array.from(setTemas).sort();
    },

    async subirArchivo(file, nombreLimpio) {
        // Le agregamos un timestamp corto para evitar colisiones si subes dos con el mismo nombre
        const fileName = `${nombreLimpio}-${Date.now()}.pdf`;
        const { error } = await supabase.storage
            .from('partituras')
            .upload(fileName, file);
        
        if (error) throw error;
        
        // Obtenemos la URL pública para guardarla en la base de datos
        const { data: { publicUrl } } = supabase.storage
            .from('partituras')
            .getPublicUrl(fileName);
            
        return publicUrl;
    },

    async guardar(payload, id = null) {
        if (id) {
            const { error } = await supabase.from('cantos').update(payload).eq('id', id);
            if (error) throw error;
        } else {
            payload.fecha_agregado = new Date().toISOString();
            const { error } = await supabase.from('cantos').insert([payload]);
            if (error) throw error;
        }
    },

    async eliminar(id) {
        const { error } = await supabase.from('cantos').delete().eq('id', id);
        if (error) throw error;
    },

    async obtenerTodosLosCantos() {
        const { data, error } = await supabase
            .from('cantos')
            .select(`*, cantos_coros (coro_id)`)
            .order('nombre', { ascending: true });
        if (error) throw error;
        return data || [];
    },

    async obtenerHistorialGlobal() {
        const { data, error } = await supabase
            .from('cantos')
            .select('id, nombre, archivo, fecha_agregado')
            .order('fecha_agregado', { ascending: false })
            .limit(15);
        if (error) throw error;
        return data || [];
    }
};

// ==========================================
// 3. CAPA DE INTERFAZ (DOM / Renderizado)
// ==========================================
const UI = {
    construirEstructura(contenedor) {
        contenedor.innerHTML = `
            <div id="panel-avisos-admin" style="background: var(--color-superficie-secundaria); padding: 20px; border-radius: 12px; border: 1px solid var(--color-borde); margin-bottom: 24px;">
                <h3 style="font-size: 14px; color: var(--color-texto-principal); margin-bottom: 12px; font-weight: 700;">ENVIAR AVISO A LA SEDE</h3>
                <div style="display: flex; gap: 10px;">
                    <input id="input-aviso-texto" class="input-estandar" placeholder="Escribe un recordatorio para todos..." style="flex: 1;">
                    <button id="btn-enviar-recordatorio" class="btn-principal" style="padding: 10px 20px; font-size: 12px;">ENVIAR RECORDATORIO</button>
                </div>
            </div>

            <div class="herramientas-gestion">
                <input id="buscador-partituras" class="input-estandar" placeholder="BUSCAR PARTITURA EXISTENTE...">
                <button id="btn-promocion-masiva" class="btn-secundario" style="display:none; background-color: #3b82f6; color: white;">OTRAS SEDES</button>
                <button id="btn-abrir-nuevo" class="btn-principal">+ AGREGAR PARTITURA</button>
            </div>
            <div id="lista-partituras-scroll" class="contenedor-lista-compacta"></div>
            <!-- Contenedor futuro para el Historial de Cantos Agregados -->
            <div id="historial-cantos-contenedor" style="margin-top: 20px; border-top: 1px solid var(--color-borde); padding-top: 20px; display: none;">
                <h3 style="margin-bottom: 10px; color: var(--color-texto-principal); font-size: 14px;">HISTORIAL DE CANTOS AGREGADOS</h3>
                <div id="lista-historial-scroll" class="contenedor-lista-compacta"></div>
            </div>

            <!-- Modal Promoción Masiva -->
            <div id="modal-promocion-masiva" class="modal-overlay" style="display: none;">
                <div class="modal-content" style="max-width: 600px; width: 90%;">
                    <div class="modal-header">
                        <h3>CANTOS DE OTRAS SEDES</h3>
                        <button id="btn-cerrar-modal-promocion" class="btn-cerrar-ico">✕</button>
                    </div>
                    <input id="buscador-promocion" class="input-estandar" placeholder="Buscar en otras sedes..." style="margin-bottom: 15px;">
                    <div id="lista-promocion-scroll" class="contenedor-lista-compacta" style="max-height: 400px; overflow-y: auto;"></div>
                </div>
            </div>
        `;
    },

    renderizarTabla(partituras, esSuperAdmin, coroContexto) {
        const listaScroll = document.getElementById('lista-partituras-scroll');
        if (!partituras.length) {
            listaScroll.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-secondary); font-weight: 600;">NO HAY PARTITURAS QUE COINCIDAN.</p>';
            return;
        }

        const svgEdit = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;
        const svgDelete = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>`;
        const svgQuitar = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        const svgBroadcast = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 18a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"></path><path d="M17.65 17.65a8 8 0 1 0-11.3 0"></path><path d="M12 2v1"></path><path d="M12 21v1"></path><path d="M22 12h-1"></path><path d="M3 12H2"></path></svg>`;

        listaScroll.innerHTML = partituras.map(p => {
            const enEstatal = p.cantos_coros && p.cantos_coros.some(c => c.coro_id === 'estatal');
            let botonEstatal = '';
            
            if (esSuperAdmin) {
                if (enEstatal) {
                    if (coroContexto === 'estatal') {
                        botonEstatal = `<button class="btn-icono btn-peligro-hover" data-accion="quitar-estatal" title="Quitar del Estatal">${svgQuitar}</button>`;
                    }
                } else {
                    botonEstatal = `<button class="btn-promover" data-accion="promover-estatal" title="Promover al Estatal">PROMOVER</button>`;
                }
            }

            return `
            <div class="item-fila hover-fila" data-id="${p.id}" data-nombre="${p.nombre}">
                <div class="info-texto">
                    <span class="nombre-canto-link" onclick="window.open('${p.archivo}', '_blank')">
                        ${p.nombre}
                    </span>
                    <span class="subtitulo">
                        ${(p.temas || []).join(', ') || 'Sin Categoría'}
                    </span>
                </div>
                <div class="acciones-derecha">
                    <button class="btn-icono" data-accion="vivo" title="Indicar que se está cantando ahora">${svgBroadcast}</button>
                    ${botonEstatal} 
                    <button class="btn-icono" data-accion="editar" title="Editar">${svgEdit}</button>
                    ${coroContexto === 'estatal' ? '' : `<button class="btn-icono btn-peligro-hover" data-accion="eliminar" title="Eliminar">${svgDelete}</button>`}
                </div>
            </div>
            `;
        }).join('');
    },

    renderizarHistorial(historial) {
        const contenedorPadre = document.getElementById('historial-cantos-contenedor');
        const listaScroll = document.getElementById('lista-historial-scroll');
        if (!historial || !historial.length) {
            contenedorPadre.style.display = 'none';
            return;
        }
        
        contenedorPadre.style.display = 'block';
        listaScroll.innerHTML = historial.map(c => {
            const fechaObj = new Date(c.fecha_agregado);
            const fechaStr = isNaN(fechaObj.getTime()) ? 'Sin fecha' : fechaObj.toLocaleDateString('es-ES');
            
            return `
            <div class="item-fila hover-fila" onclick="window.open('${c.archivo}', '_blank')">
                <div class="info-texto">
                    <span class="nombre-canto-link">
                        ${c.nombre}
                    </span>
                    <span class="subtitulo">
                        Agregado: ${fechaStr}
                    </span>
                </div>
                <div class="acciones-derecha">
                    <!-- Sin botones en historial por ahora -->
                </div>
            </div>
            `;
        }).join('');
    },

    poblarTemas(temas) {
        const select = document.getElementById('partitura-temas');
        if (select) select.innerHTML = temas.map(t => `<option value="${t}">${t}</option>`).join('');
    },
    
    mostrarCarga(boton, cargando) {
        if (cargando) {
            boton.disabled = true;
            boton.textContent = "GUARDANDO...";
            boton.style.opacity = "0.7";
        } else {
            boton.disabled = false;
            boton.textContent = "GUARDAR CAMBIOS";
            boton.style.opacity = "1";
        }
    }
};

// ==========================================
// 4. ORQUESTADOR (Controlador / Eventos)
// ==========================================
export async function inicializarPartiturasPanel(coroId) {
    const contenedor = document.getElementById('panel-partituras');
    const modal = document.getElementById('modal-partitura');
    const form = document.getElementById('form-partitura');
    let listaGlobal = [];
    let editandoId = null;
    let urlArchivoActual = ""; // Para guardar la URL si editan sin subir un PDF nuevo

    if (!contenedor || !modal) return;

    // 1. Inicializar UI
    UI.construirEstructura(contenedor);
    modal.style.display = 'none';

    // 2. Funciones de Flujo
    let esSuperAdmin = false;
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', session.user.id).single();
            esSuperAdmin = (perfil?.rol === 'superadmin');
        }
    } catch (e) {
        console.error("Error obteniendo rol:", e);
    }

    async function refrescarDatos() {
        listaGlobal = await API.obtenerPartituras(coroId);
        UI.renderizarTabla(listaGlobal, esSuperAdmin, coroId);

        if (esSuperAdmin) {
            const historial = await API.obtenerHistorialGlobal();
            UI.renderizarHistorial(historial);
        }
    }

    async function abrirModal(idEdicion = null) {
        editandoId = idEdicion;
        form.reset();
        urlArchivoActual = "";
        
        const temasActuales = await API.obtenerTemasUnicos();
        UI.poblarTemas(temasActuales);

        const fileInput = document.getElementById('partitura-archivo-file');

        if (idEdicion) {
            const canto = listaGlobal.find(c => c.id === idEdicion);
            document.getElementById('partitura-nombre').value = canto.nombre;
            document.getElementById('partitura-temas-libres').value = (canto.temas || []).join(', ');
            document.getElementById('titulo-form').textContent = "Editando: " + canto.nombre;
            
            // Guardamos la URL actual por si el usuario no sube un nuevo archivo
            urlArchivoActual = canto.archivo; 
            fileInput.required = false; 
        } else {
            document.getElementById('titulo-form').textContent = "Nueva Partitura";
            fileInput.required = true; // Si es un canto nuevo, es obligatorio el archivo
        }

        modal.style.display = 'flex';
    }

    // 3. Asignación de Eventos
    const btnRecordatorio = document.getElementById('btn-enviar-recordatorio');
    const inputRecordatorio = document.getElementById('input-aviso-texto');

    btnRecordatorio?.addEventListener('click', async () => {
        const mensaje = inputRecordatorio.value.trim();
        if (!mensaje) return;

        try {
            btnRecordatorio.disabled = true;
            const { error } = await supabase.from('avisos').insert([{
                coro_id: coroId,
                tipo: 'RECORDATORIO',
                mensaje: mensaje
            }]);
            if (error) throw error;
            inputRecordatorio.value = '';
            window.mostrarToast('Recordatorio enviado a todos los miembros.');
        } catch (err) {
            console.error(err);
            window.mostrarToast('Error al enviar recordatorio.', 'error');
        } finally {
            btnRecordatorio.disabled = false;
        }
    });

    document.getElementById('buscador-partituras').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtrados = listaGlobal.filter(p => p.nombre.toLowerCase().includes(query));
        UI.renderizarTabla(filtrados, esSuperAdmin, coroId);
    });

    if (esSuperAdmin) {
        const btnPromocion = document.getElementById('btn-promocion-masiva');
        const modalPromocion = document.getElementById('modal-promocion-masiva');
        const btnCerrarPromocion = document.getElementById('btn-cerrar-modal-promocion');
        const buscadorPromocion = document.getElementById('buscador-promocion');
        const listaPromocion = document.getElementById('lista-promocion-scroll');
        let cantosPromocion = [];

        if (btnPromocion) btnPromocion.style.display = 'inline-block';

        const renderizarPromocion = (filtro = '') => {
            const filtrados = cantosPromocion.filter(c => c.nombre.toLowerCase().includes(filtro));
            if (!filtrados.length) {
                listaPromocion.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--color-texto-suave);">No hay cantos disponibles para promover.</p>';
                return;
            }
            listaPromocion.innerHTML = filtrados.map(p => {
                const yaExisteLocal = listaGlobal.some(l => l.id === p.id);
                return `
                <div class="item-fila" data-id="${p.id}">
                    <div class="info-texto">
                        <span class="nombre-canto-link">${p.nombre}</span>
                    </div>
                    <div class="acciones-derecha">
                        ${yaExisteLocal 
                            ? `<span style="font-size: 11px; color: var(--color-texto-suave); font-weight: 700; text-transform: uppercase;">Registrado</span>`
                            : `<button class="btn-promover" data-accion="ejecutar-promocion">PROMOVER</button>`}
                    </div>
                </div>
                `;
            }).join('');
        };

        btnPromocion.onclick = async () => {
            btnPromocion.textContent = "CARGANDO...";
            try {
                const todos = await API.obtenerTodosLosCantos();
                cantosPromocion = todos.filter(c => !c.cantos_coros.some(rel => rel.coro_id === 'estatal'));
                buscadorPromocion.value = '';
                renderizarPromocion();
                modalPromocion.style.display = 'flex';
            } catch (err) {
                console.error(err);
                window.mostrarToast("Error al cargar cantos de otras sedes.", 'error');
            } finally {
                btnPromocion.textContent = "OTRAS SEDES";
            }
        };

        btnCerrarPromocion.onclick = () => modalPromocion.style.display = 'none';

        buscadorPromocion.addEventListener('input', (e) => {
            renderizarPromocion(e.target.value.toLowerCase());
        });

        listaPromocion.onclick = async (e) => {
            const btn = e.target.closest('button[data-accion="ejecutar-promocion"]');
            if (!btn) return;
            const itemFila = btn.closest('.item-fila');
            const id = itemFila.dataset.id;
            
            // Lógica de Confirmación Visual
            if (btn.dataset.confirmar === 'true') {
                btn.disabled = true;
                btn.textContent = "...";
                try {
                    await supabase.from('cantos_coros').insert([{ canto_id: id, coro_id: 'estatal' }]);
                    cantosPromocion = cantosPromocion.filter(c => c.id !== id);
                    renderizarPromocion(buscadorPromocion.value.toLowerCase());
                    await refrescarDatos(); 
                    window.mostrarToast('PIEZA PROMOVIDA EXITOSAMENTE');
                } catch (err) {
                    window.mostrarToast("ERROR AL PROMOVER", 'error');
                    btn.disabled = false;
                    btn.dataset.confirmar = 'false';
                    btn.classList.remove('confirmando');
                    btn.textContent = "PROMOVER";
                }
            } else {
                btn.dataset.confirmar = 'true';
                btn.classList.add('confirmando');
                btn.textContent = "¿CONFIRMAR?";
                setTimeout(() => {
                    if (btn.dataset.confirmar === 'true') {
                        btn.dataset.confirmar = 'false';
                        btn.classList.remove('confirmando');
                        btn.textContent = "PROMOVER";
                    }
                }, 3000);
            }
        };
    }

    document.getElementById('btn-abrir-nuevo').onclick = () => abrirModal(null);
    document.getElementById('btn-cerrar-modal').onclick = () => modal.style.display = 'none';

    form.onsubmit = async (e) => {
        e.preventDefault();
        const btnGuardar = document.getElementById('btn-guardar');
        const nombreCanto = document.getElementById('partitura-nombre').value.trim();
        const fileInput = document.getElementById('partitura-archivo-file');
        const temasSel = Array.from(document.getElementById('partitura-temas').selectedOptions).map(o => o.value);
        const temasLib = document.getElementById('partitura-temas-libres').value.split(',').map(t => t.trim()).filter(Boolean);
        
        try {
            UI.mostrarCarga(btnGuardar, true);
            let urlFinal = urlArchivoActual;

            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                const nombreNormalizado = normalizarNombreArchivo(nombreCanto);
                urlFinal = await API.subirArchivo(file, nombreNormalizado);
            }

            const payload = { 
                nombre: nombreCanto, 
                archivo: urlFinal, 
                temas: [...new Set([...temasSel, ...temasLib])]
            };

            if (editandoId) {
                await supabase.from('cantos').update(payload).eq('id', editandoId);
                window.mostrarToast('PARTITURA ACTUALIZADA');
            } else {
                const { data: nuevoCanto, error: errCanto } = await supabase
                    .from('cantos')
                    .insert([payload])
                    .select()
                    .single();
                
                if (errCanto) throw errCanto;

                const { error: errRel } = await supabase
                    .from('cantos_coros')
                    .insert([{
                        canto_id: nuevoCanto.id,
                        coro_id: coroId 
                    }]);
                
                if (errRel) throw errRel;
                window.mostrarToast('PARTITURA GUARDADA');
            }

            modal.style.display = 'none';
            await refrescarDatos();
        } catch (err) {
            console.error("Error en la operación:", err);
            window.mostrarToast("ERROR AL PROCESAR", 'error');
        } finally {
            UI.mostrarCarga(btnGuardar, false);
        }
    };

// Delegación para botones Editar/Eliminar
document.getElementById('lista-partituras-scroll').onclick = async (e) => {
    const btn = e.target.closest('button[data-accion]');
    if (!btn) return;
    
    const itemFila = btn.closest('.item-fila');
    if (!itemFila) return;
    
    const id = itemFila.dataset.id;
    const nombreCanto = itemFila.dataset.nombre;

    // Lógica de Confirmación Visual Instantánea para acciones críticas
    if (['eliminar', 'promover-estatal', 'quitar-estatal'].includes(btn.dataset.accion)) {
        if (btn.dataset.confirmar !== 'true') {
            const htmlOriginal = btn.innerHTML;
            
            btn.dataset.confirmar = 'true';
            btn.classList.add('confirmando');
            btn.dataset.originalHtml = htmlOriginal;
            btn.innerHTML = btn.dataset.accion === 'eliminar' ? '<span style="font-size:10px; font-weight:800;">¿SEGURO?</span>' : '<span style="font-size:10px; font-weight:800;">¿CONFIRMAR?</span>';
            
            setTimeout(() => {
                if (btn.dataset.confirmar === 'true') {
                    btn.dataset.confirmar = 'false';
                    btn.classList.remove('confirmando');
                    btn.innerHTML = btn.dataset.originalHtml;
                }
            }, 3000);
            return;
        }
    }

    if (btn.dataset.accion === 'vivo') {
        try {
            btn.disabled = true;
            const { error } = await supabase.from('avisos').insert([{
                coro_id: coroId,
                tipo: 'VIVO',
                mensaje: nombreCanto,
                metadata: { id_canto: id }
            }]);
            if (error) throw error;
            window.mostrarToast('SEÑAL EN VIVO ENVIADA');
        } catch (err) {
            console.error(err);
            window.mostrarToast('ERROR AL ENVIAR', 'error');
        } finally {
            btn.disabled = false;
        }
    }

    if (btn.dataset.accion === 'promover-estatal') {
        try {
            btn.disabled = true;
            const { data: exists } = await supabase.from('cantos_coros').select('id').eq('canto_id', id).eq('coro_id', 'estatal').maybeSingle();
            if (!exists) {
                const { error } = await supabase.from('cantos_coros').insert([{ canto_id: id, coro_id: 'estatal' }]);
                if (error) throw error;
                window.mostrarToast('PROMOVIDO AL ESTATAL');
            } else {
                window.mostrarToast('YA EXISTE EN ESTATAL', 'error');
            }
            await refrescarDatos();
        } catch (error) {
            window.mostrarToast("ERROR AL PROMOVER", 'error');
            btn.disabled = false;
        }
    }

    if (btn.dataset.accion === 'quitar-estatal') {
        try {
            btn.disabled = true;
            const { error } = await supabase.from('cantos_coros').delete().eq('canto_id', id).eq('coro_id', 'estatal');
            if (error) throw error;
            await refrescarDatos();
            window.mostrarToast('REMOVIDO DEL ESTATAL');
        } catch (error) {
            window.mostrarToast("ERROR AL QUITAR", 'error');
            btn.disabled = false;
        }
    }

    if (btn.dataset.accion === 'eliminar') {
        try {
            btn.disabled = true;
            await API.eliminar(id);
            await refrescarDatos();
            window.mostrarToast('ELIMINADO PERMANENTEMENTE');
        } catch (error) {
            window.mostrarToast("ERROR AL ELIMINAR", 'error');
            btn.disabled = false;
        }
    }

    if (btn.dataset.accion === 'editar') abrirModal(id);
};

    // 4. Arranque
    await refrescarDatos();
}