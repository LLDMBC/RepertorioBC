export const offlineManager = {
    NOMBRE_CACHE: 'COROFLORIDO-PDFS-v1',

    registrarServiceWorker: function() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(reg => console.log('Service Worker listo', reg.scope))
                    .catch(err => console.warn('Error al registrar SW', err));
            });
        }
    },

    actualizarContador: async function(cantos, elementoContador) {
        if (!('caches' in window) || cantos.length === 0) return;
        
        try {
            const cache = await caches.open(this.NOMBRE_CACHE);
            const requestsGuardados = await cache.keys();
            const urlsGuardadas = requestsGuardados.map(req => decodeURIComponent(new URL(req.url).pathname.split('/').pop()));
            
            let descargados = cantos.filter(c => urlsGuardadas.includes(c.archivo)).length;
            let total = cantos.length;
            
            elementoContador.style.display = 'inline-block';
            
            if (descargados >= total) {
                elementoContador.textContent = `✓ Disponibles sin internet`;
                elementoContador.classList.add('completado');
            } else {
                elementoContador.textContent = `Guardando en tu dispositivo: ${descargados} de ${total}`;
                elementoContador.classList.remove('completado');
            }
        } catch(e) {
            console.warn("Error al leer caché para el contador", e);
        }
    },

sincronizarPartituras: async function(cantos, elementoContador) {
        // Aumentamos a 10 segundos (10000ms) el inicio para que la app cargue tranquila
        setTimeout(async () => {
            const cache = await caches.open(this.NOMBRE_CACHE);
	    for (const canto of cantos) {
                const url = `https://mxnhmtztxgeccohlgqpt.supabase.co/storage/v1/object/public/partituras/${canto.archivo}`;
                const coincidencia = await cache.match(url);
                
                if (!coincidencia) {
                    try {
                        await cache.add(url);
                        await this.actualizarContador(cantos, elementoContador); 
                        // Aumentamos el "respiro" a 800ms para no saturar el disco duro de tu PC
                        await new Promise(resolve => setTimeout(resolve, 800));
                    } catch (e) {
                        console.warn(`Error al precargar: ${canto.nombre}`, e);
                    }
                }
            }
            await this.actualizarContador(cantos, elementoContador);
        }, 10000); 
    }
};