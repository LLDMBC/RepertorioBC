import { pdfEngine } from '../core/pdfEngine.js';

export const visorUI = {
    pinchZoomando: false,
    distanciaInicial: 0,
    zoomInicial: 100,
    ultimoScroll: 0,
    centroToqueX: 0, centroToqueY: 0,
    porcentajeX: 0, porcentajeY: 0,
    centroInicialX: 0, centroInicialY: 0,
    scrollInicialX: 0, scrollInicialY: 0,

    iniciarEventos: function(contenedorPdf, btnResetZoom, barraSuperior) {
        
        // 1. EVENTO: INICIO DE ZOOM (2 DEDOS)
        contenedorPdf.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                this.pinchZoomando = true;
                this.distanciaInicial = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY
                );
                this.zoomInicial = pdfEngine.nivelZoom;

                const rect = contenedorPdf.getBoundingClientRect();
                this.centroToqueX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
                this.centroToqueY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

                this.scrollInicialX = contenedorPdf.scrollLeft;
                this.scrollInicialY = contenedorPdf.scrollTop;

                this.porcentajeX = (this.scrollInicialX + this.centroToqueX) / contenedorPdf.scrollWidth;
                this.porcentajeY = (this.scrollInicialY + this.centroToqueY) / contenedorPdf.scrollHeight;
                
                this.centroInicialX = (e.touches[0].pageX + e.touches[1].pageX) / 2;
                this.centroInicialY = (e.touches[0].pageY + e.touches[1].pageY) / 2;
            }
        }, { passive: false });

        // 2. EVENTO: MOVIMIENTO Y PANEO
        contenedorPdf.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2 && this.pinchZoomando) {
                e.preventDefault(); 
                
                const distanciaActual = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY
                );
                const escala = distanciaActual / this.distanciaInicial;
                let nuevoZoom = this.zoomInicial * escala;
                
                if (nuevoZoom < 100) nuevoZoom = 100;
                if (nuevoZoom > 400) nuevoZoom = 400;
                
                pdfEngine.nivelZoom = nuevoZoom;
                this.actualizarUIZoom(contenedorPdf, btnResetZoom); 

                const rect = contenedorPdf.getBoundingClientRect();
                const centroActualX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
                const centroActualY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

                contenedorPdf.scrollLeft = (this.porcentajeX * contenedorPdf.scrollWidth) - centroActualX;
                contenedorPdf.scrollTop = (this.porcentajeY * contenedorPdf.scrollHeight) - centroActualY;
            }
        }, { passive: false });

        // 3. EVENTO: FIN DEL TOQUE
        contenedorPdf.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
                this.pinchZoomando = false;
            }
        });

        // 4. RESETEAR ZOOM
        btnResetZoom.addEventListener('click', () => {
            const proporcion = contenedorPdf.scrollTop / contenedorPdf.scrollHeight;
            pdfEngine.nivelZoom = 100;
            this.actualizarUIZoom(contenedorPdf, btnResetZoom);

            setTimeout(() => {
                contenedorPdf.scrollTo({
                    top: proporcion * contenedorPdf.scrollHeight,
                    left: 0,
                    behavior: 'smooth'
                });
            }, 50); 
        });

        // 5. OCULTAR BARRA SUPERIOR CON SCROLL O CLIC
        contenedorPdf.addEventListener('scroll', () => {
            let scrollActual = contenedorPdf.scrollTop;
            if (!this.pinchZoomando) {
                if (scrollActual > this.ultimoScroll && scrollActual > 60) barraSuperior.classList.add('barra-oculta');
                else if (scrollActual < this.ultimoScroll) barraSuperior.classList.remove('barra-oculta');
            }
            this.ultimoScroll = scrollActual;
        });

        contenedorPdf.addEventListener('click', (e) => {
            if (this.pinchZoomando || e.target.id === 'btn-reset-zoom') return;

            if (localStorage.getItem('modo-paginas') === 'true') {
                const rect = contenedorPdf.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const width = rect.width;
                const tercio = width * 0.3;

                if (clickX < tercio) {
                    // Tap izquierdo: Página anterior
                    e.stopPropagation();
                    e.preventDefault();
                    contenedorPdf.scrollBy({ left: -width, behavior: 'smooth' });
                } else if (clickX > width - tercio) {
                    // Tap derecho: Página siguiente
                    e.stopPropagation();
                    e.preventDefault();
                    contenedorPdf.scrollBy({ left: width, behavior: 'smooth' });
                } else {
                    // Tap central: Ocultar/mostrar barra
                    e.stopPropagation();
                    e.preventDefault();
                    barraSuperior.classList.toggle('barra-oculta');
                }
            } else {
                // Modo Scroll normal
                barraSuperior.classList.toggle('barra-oculta');
            }
        });
    },

    actualizarUIZoom: function(contenedorPdf, btnResetZoom) {
        const paginas = document.querySelectorAll('.pdf-page');
        
        if (pdfEngine.nivelZoom > 100) {
            contenedorPdf.classList.add('zoom-activo');
            btnResetZoom.style.display = 'flex';
        } else {
            contenedorPdf.classList.remove('zoom-activo');
            btnResetZoom.style.display = 'none';
            contenedorPdf.scrollLeft = 0; 
        }

        paginas.forEach(canvas => {
            canvas.style.width = `${pdfEngine.nivelZoom}%`;
            canvas.style.margin = (pdfEngine.nivelZoom > 100) ? "20px" : "10px auto";
        });
    }
};