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
            .select(`
                *,
                cantos_coros!inner(coro_id)
            `)
            .eq('cantos_coros.coro_id', coroId)
            .order('nombre', { ascending: true });
            
        if (error) throw error;
        return data || [];
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
    }
};

// ==========================================
// 3. CAPA DE INTERFAZ (DOM / Renderizado)
// ==========================================
const UI = {
    construirEstructura(contenedor) {
        contenedor.innerHTML = `
            <div class="herramientas-gestion">
                <input id="buscador-partituras" class="input-estandar" placeholder="BUSCAR PARTITURA EXISTENTE...">
                <button id="btn-abrir-nuevo" class="btn-principal">+ AGREGAR PARTITURA</button>
            </div>
            <div id="lista-partituras-scroll" class="contenedor-lista-compacta"></div>
        `;
    },

    renderizarTabla(partituras) {
        const listaScroll = document.getElementById('lista-partituras-scroll');
        if (!partituras.length) {
            listaScroll.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--texto-suave); font-weight: 600;">NO HAY PARTITURAS QUE COINCIDAN.</p>';
            return;
        }

        // Aquí usamos la nueva estructura de Lista Compacta
        listaScroll.innerHTML = `
            <div class="lista-compacta">
                ${partituras.map(p => `
                    <div class="item-compacto" data-id="${p.id}">
                        <div class="item-info">
                            <button class="nombre-canto-link" onclick="window.open('${p.archivo}', '_blank')">${p.nombre}</button>
                            <div class="item-etiquetas">
                                ${(p.temas || []).map(t => `<span class="etiqueta">${t}</span>`).join('')}
                            </div>
                        </div>
                        <div class="item-acciones">
                            <button class="btn-pequeno btn-secundario" data-accion="editar">EDITAR</button>
                            <button class="btn-pequeno btn-peligro" data-accion="eliminar">ELIMINAR</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
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
    async function refrescarDatos() {
        listaGlobal = await API.obtenerPartituras(coroId);
        UI.renderizarTabla(listaGlobal);
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
    document.getElementById('buscador-partituras').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtrados = listaGlobal.filter(p => p.nombre.toLowerCase().includes(query));
        UI.renderizarTabla(filtrados);
    });

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

            // El payload ya NO incluye coro_id
            const payload = { 
                nombre: nombreCanto, 
                archivo: urlFinal, 
                temas: [...new Set([...temasSel, ...temasLib])]
            };

            if (editandoId) {
                // Actualizar solo los datos del canto
                await supabase.from('cantos').update(payload).eq('id', editandoId);
            } else {
                // 1. Insertar el nuevo canto y obtener su ID generado
                const { data: nuevoCanto, error: errCanto } = await supabase
                    .from('cantos')
                    .insert([payload])
                    .select()
                    .single();
                
                if (errCanto) throw errCanto;

                // 2. Crear la relación en la tabla intermedia
                const { error: errRel } = await supabase
                    .from('cantos_coros')
                    .insert([{
                        canto_id: nuevoCanto.id,
                        coro_id: coroId 
                    }]);
                
                if (errRel) throw errRel;
            }

            modal.style.display = 'none';
            await refrescarDatos();
        } catch (err) {
            console.error("Error en la operación Muchos-a-Muchos:", err);
            alert("Error al procesar la partitura. Verifique su conexión.");
        } finally {
            UI.mostrarCarga(btnGuardar, false);
        }
    };

// Delegación para botones Editar/Eliminar
document.getElementById('lista-partituras-scroll').onclick = async (e) => {
    const btn = e.target.closest('button[data-accion]');
    if (!btn) return;
    
    // CORRECCIÓN: Ahora busca el contenedor de la lista compacta, no un 'tr'
    const itemCompacto = btn.closest('.item-compacto');
    if (!itemCompacto) return;
    
    const id = itemCompacto.dataset.id;

    if (btn.dataset.accion === 'eliminar') {
        // La confirmación ahora sí aparecerá porque ya no hay crash antes
        if (confirm('¿ELIMINAR ESTE CANTO PERMANENTEMENTE? Esta acción no se puede deshacer.')) {
            try {
                btn.disabled = true;
                btn.textContent = "BORRANDO...";
                await API.eliminar(id);
                await refrescarDatos();
            } catch (error) {
                alert("Error al eliminar la partitura.");
                btn.disabled = false;
            }
        }
    }

    if (btn.dataset.accion === 'editar') abrirModal(id);
};

    // 4. Arranque
    await refrescarDatos();
}