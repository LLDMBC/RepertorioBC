const CACHE_SISTEMA = 'COROFLORIDO-v1'; // Subimos la versión para forzar el reinicio
const CACHE_PARTITURAS = 'COROFLORIDO-PDFS-v1'; // Las partituras se quedan intactas

// Solo ponemos lo que NUNCA cambia de nombre
const ARCHIVOS_ESTATICOS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icono.png',
    '/cantos.json',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.min.mjs',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.worker.min.mjs'
];

// Instalación
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_SISTEMA)
            .then(cache => cache.addAll(ARCHIVOS_ESTATICOS))
            .then(() => self.skipWaiting())
    );
});

// Activación: Limpia versiones viejas del sistema
self.addEventListener('activate', event => {
    const cachesPermitidas = [CACHE_SISTEMA, CACHE_PARTITURAS];
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (!cachesPermitidas.includes(key)) return caches.delete(key);
                })
            );
        })
    );
});

// Estrategia Inteligente
self.addEventListener('fetch', event => {
    const url = event.request.url;

    // 1. LOS PDFs: CACHÉ PRIMERO (Máximo ahorro de datos y velocidad)
    if (url.includes('.pdf')) {
        event.respondWith(
            caches.match(event.request).then(res => res || fetch(event.request))
        );
    } 
    // 2. EL RESTO (HTML, JS, CSS de Vite): NETWORK FIRST CON CACHÉ DINÁMICO
    else {
        event.respondWith(
            fetch(event.request)
                .then(res => {
                    // Si hay internet, clonamos el archivo fresco y lo guardamos en caché silenciosamente
                    if(event.request.method === 'GET') {
                        const resClone = res.clone();
                        caches.open(CACHE_SISTEMA).then(cache => cache.put(event.request, resClone));
                    }
                    return res;
                })
                // Si no hay internet, sacamos lo que tengamos guardado
                .catch(() => caches.match(event.request))
        );
    }
});