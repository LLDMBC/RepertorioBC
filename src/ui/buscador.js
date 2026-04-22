export const buscadorUI = {
    temaActual: 'Todos',
    
    limpiarTexto: function(texto) {
        return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    },

    generarMenuTemas: function(lista, listaTemasElement, callbackFiltro) {
        let temasBrutos = lista.flatMap(c => c.temas);
        let temasUnicos = [...new Set(temasBrutos)].filter(t => t && t.trim() !== '');
        temasUnicos.sort(); 

        let htmlTemas = `
            <li class="item-tema activo" data-tema="Todos">Todos los cantos</li>
            <li class="item-tema" data-tema="Sin Tema">Sin Tema Especificado</li>
        `;
        temasUnicos.forEach(tema => {
            htmlTemas += `<li class="item-tema" data-tema="${tema}">${tema}</li>`;
        });

        listaTemasElement.innerHTML = htmlTemas;

        document.querySelectorAll('.item-tema').forEach(item => {
            item.addEventListener('click', (e) => {
                document.querySelectorAll('.item-tema').forEach(i => i.classList.remove('activo'));
                e.target.classList.add('activo');
                this.temaActual = e.target.getAttribute('data-tema');
                callbackFiltro();
            });
        });
    },

    filtrarCantos: function(cantos, inputTexto) {
        const textoBuscado = this.limpiarTexto(inputTexto);
        const palabrasBusqueda = textoBuscado.split(' ').filter(p => p !== '');
        
        let filtrados = cantos.filter(c => {
            const nombreLimpio = this.limpiarTexto(c.nombre);
            const coincideTexto = palabrasBusqueda.every(palabra => nombreLimpio.includes(palabra));
            
            let coincideTema = false;
            if (this.temaActual === 'Todos') coincideTema = true;
            else if (this.temaActual === 'Sin Tema') coincideTema = (c.temas.length === 0);
            else coincideTema = c.temas.includes(this.temaActual);

            return (coincideTexto || palabrasBusqueda.length === 0) && coincideTema;
        });

        if (textoBuscado !== '') {
            filtrados.sort((a, b) => {
                const nombreA = this.limpiarTexto(a.nombre);
                const nombreB = this.limpiarTexto(b.nombre);
                let puntosA = 0; let puntosB = 0;
                if (nombreA.startsWith(textoBuscado)) puntosA += 100;
                else if (nombreA.split(' ')[0] === palabrasBusqueda[0]) puntosA += 50;
                if (nombreB.startsWith(textoBuscado)) puntosB += 100;
                else if (nombreB.split(' ')[0] === palabrasBusqueda[0]) puntosB += 50;
                if (puntosA !== puntosB) return puntosB - puntosA; 
                return nombreA.localeCompare(nombreB);
            });
        }
        return filtrados;
    },

    renderizarLista: function(lista, contenedorElement, onClickCanto) {
        contenedorElement.innerHTML = '';
        if (lista.length === 0) {
            contenedorElement.innerHTML = '<p style="text-align:center; padding:20px; color:#888;">No hay cantos que coincidan con la búsqueda.</p>';
            return;
        }

        lista.forEach(canto => {
            const div = document.createElement('div');
            div.className = 'tarjeta-canto';
            div.innerHTML = `
                <div>
                    <h3>${canto.nombre}</h3>
                    <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 5px;">
                        ${canto.temas.length > 0 ? canto.temas.map(t => `<span class="tema-etiqueta">${t}</span>`).join('') : '<span class="tema-etiqueta" style="opacity:0.4;">Sin tema</span>'}
                    </div>
                </div>
            `;
            div.addEventListener('click', () => onClickCanto(canto));
            contenedorElement.appendChild(div);
        });
    }
};