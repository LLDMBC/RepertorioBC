import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.worker.min.mjs';

export const pdfEngine = {
    nivelZoom: 100,
    
    abrirVisor: function(canto, contenedorPdf, barraSuperior) {
        document.getElementById('vista-menu').style.display = 'none';
        document.getElementById('vista-visor').style.display = 'block';
        document.getElementById('titulo-canto').textContent = canto.nombre;
        barraSuperior.classList.remove('barra-oculta');
        
        history.pushState({ visorAbierto: true }, null, "#visor");
        
        this.nivelZoom = 100; 
        contenedorPdf.innerHTML = '<p style="margin-top:80px; text-align:center; color:#555;">Cargando partitura en alta resolución...</p>';
	
	const urlSupabase = `https://mxnhmtztxgeccohlgqpt.supabase.co/storage/v1/object/public/partituras/${canto.archivo}`;

        pdfjsLib.getDocument(urlSupabase).promise.then(pdf => {
            contenedorPdf.innerHTML = ''; 
            const dpr = window.devicePixelRatio || 1;
            const LIMITE_FISICO_PIXELES = 2500; 
            const arregloCanvases = [];

            // 1. Skeleton
            for (let i = 1; i <= pdf.numPages; i++) {
                const canvas = document.createElement('canvas');
                canvas.className = 'pdf-page';
                canvas.style.minHeight = "800px"; 
                canvas.style.width = `${this.nivelZoom}%`;
                canvas.dataset.pagina = i;
                canvas.dataset.renderizado = "false"; 
                contenedorPdf.appendChild(canvas);
                arregloCanvases.push(canvas);
            }

            // 2. Intersection Observer
            const observador = new IntersectionObserver((entradas, obs) => {
                entradas.forEach(entrada => {
                    if (entrada.isIntersecting) {
                        const canvas = entrada.target;
                        const numPagina = parseInt(canvas.dataset.pagina);

                        if (canvas.dataset.renderizado === "true") return;

                        canvas.dataset.renderizado = "true";
                        obs.unobserve(canvas);

                        pdf.getPage(numPagina).then(page => {
                            const viewportRaw = page.getViewport({ scale: 1.0 });
                            let escalaFinal = 1.5; 
                            let dimensionMayorVisual = Math.max(viewportRaw.width, viewportRaw.height);

                            if ((dimensionMayorVisual * escalaFinal * dpr) > LIMITE_FISICO_PIXELES) {
                                escalaFinal = (LIMITE_FISICO_PIXELES / dpr) / dimensionMayorVisual;
                            }

                            const viewport = page.getViewport({ scale: escalaFinal }); 
                            canvas.width = viewport.width * dpr;
                            canvas.height = viewport.height * dpr;
                            canvas.style.height = "auto"; 
                            canvas.style.minHeight = "auto"; 

                            const context = canvas.getContext('2d');
                            context.scale(dpr, dpr);
                            
                            page.render({ canvasContext: context, viewport: viewport }).promise.then(() => {
                                page.cleanup(); 
                            });
                        });
                    }
                });
            }, { root: contenedorPdf, rootMargin: '1200px 0px', threshold: 0.01 });

            arregloCanvases.forEach(canvas => observador.observe(canvas));

        }).catch(err => {
            console.error(err);
            contenedorPdf.innerHTML = '<p style="color:red; text-align:center;">Error al cargar el PDF.</p>';
        });
    },

    cerrarVisor: function(contenedorPdf) {
        document.getElementById('vista-visor').style.display = 'none';
        document.getElementById('vista-menu').style.display = 'flex';
        
        const canvases = contenedorPdf.querySelectorAll('canvas');
        canvases.forEach(canvas => {
            canvas.width = 0;
            canvas.height = 0;
            canvas.remove();
        });
        contenedorPdf.innerHTML = ''; 
    }
};