const InvCatalogos = {
    async render() {
        const page = document.querySelector('.page.active');
        
        // Solo administradores pueden acceder
        if (!App.isAdmin()) {
            page.innerHTML = '<div class="alert alert-danger">No tienes permisos para acceder a esta sección</div>';
            return;
        }

        page.innerHTML = '<div class="empty-state"><p>Cargando catálogos...</p></div>';
        
        try {
            const [tiposCristal, espesores] = await Promise.all([
                api.catalogos.getTiposCristal(),
                api.catalogos.getEspesores()
            ]);

            page.innerHTML = `
                <div class="page-header">
                    <div>
                        <h2>Gestión de Catálogos</h2>
                        <p class="subtitle">Administra los tipos de cristal y espesores disponibles</p>
                    </div>
                </div>

                <div class="stats-grid" style="grid-template-columns: 1fr 1fr;">
                    <!-- Tipos de Cristal -->
                    <div class="card">
                        <div class="card-header">
                            <span>Tipos de Cristal</span>
                            <span class="badge badge-entrada">${tiposCristal.length} tipos</span>
                        </div>
                        <div class="card-body">
                            <div class="flex gap-8 mb-16">
                                <input type="text" id="nuevoTipoCristal" class="form-control" placeholder="Nuevo tipo de cristal..." style="flex:1;">
                                <button class="btn btn-success" onclick="InvCatalogos.agregarTipoCristal()">+ Agregar</button>
                            </div>
                            <div id="listaTiposCristal" class="catalog-list">
                                ${this.renderTiposCristal(tiposCristal)}
                            </div>
                        </div>
                    </div>

                    <!-- Espesores -->
                    <div class="card">
                        <div class="card-header">
                            <span>Espesores (mm)</span>
                            <span class="badge badge-entrada">${espesores.length} valores</span>
                        </div>
                        <div class="card-body">
                            <div class="flex gap-8 mb-16">
                                <input type="number" id="nuevoEspesor" class="form-control" placeholder="Nuevo espesor (mm)..." min="1" max="100" style="flex:1;">
                                <button class="btn btn-success" onclick="InvCatalogos.agregarEspesor()">+ Agregar</button>
                            </div>
                            <div id="listaEspesores" class="catalog-list">
                                ${this.renderEspesores(espesores)}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="alert alert-info">
                    <strong>Nota:</strong> Los elementos eliminados no aparecerán en los formularios pero se mantendrán en el historial de movimientos existente.
                </div>
            `;
        } catch(err) {
            page.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
        }
    },

    renderTiposCristal(tipos) {
        if (tipos.length === 0) {
            return '<div class="empty-state"><p>No hay tipos de cristal configurados</p></div>';
        }
        return `<div class="catalog-items">${tipos.map(t => `
            <div class="catalog-item" data-id="${t.id}">
                <span class="catalog-item-name">${this.escapeHtml(t.nombre)}</span>
                <button class="btn btn-danger btn-sm" onclick="InvCatalogos.eliminarTipoCristal(${t.id}, '${this.escapeHtml(t.nombre)}')" title="Eliminar">
                    ✕
                </button>
            </div>
        `).join('')}</div>`;
    },

    renderEspesores(espesores) {
        if (espesores.length === 0) {
            return '<div class="empty-state"><p>No hay espesores configurados</p></div>';
        }
        return `<div class="catalog-items">${espesores.map(e => `
            <div class="catalog-item" data-id="${e.id}">
                <span class="catalog-item-name">${e.valor} mm</span>
                <button class="btn btn-danger btn-sm" onclick="InvCatalogos.eliminarEspesor(${e.id}, ${e.valor})" title="Eliminar">
                    ✕
                </button>
            </div>
        `).join('')}</div>`;
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    async agregarTipoCristal() {
        const input = document.getElementById('nuevoTipoCristal');
        const nombre = input.value.trim();
        
        if (!nombre) {
            App.toast('Ingresa un nombre para el tipo de cristal', 'error');
            return;
        }

        try {
            await api.catalogos.crearTipoCristal(nombre);
            App.toast('Tipo de cristal agregado');
            input.value = '';
            this.render();
        } catch(err) {
            App.toast(err.message, 'error');
        }
    },

    async eliminarTipoCristal(id, nombre) {
        if (!confirm(`¿Eliminar el tipo de cristal "${nombre}"?`)) return;
        
        try {
            await api.catalogos.eliminarTipoCristal(id);
            App.toast('Tipo de cristal eliminado');
            this.render();
        } catch(err) {
            App.toast(err.message, 'error');
        }
    },

    async agregarEspesor() {
        const input = document.getElementById('nuevoEspesor');
        const valor = parseInt(input.value);
        
        if (isNaN(valor) || valor <= 0) {
            App.toast('Ingresa un valor de espesor válido (número entero positivo)', 'error');
            return;
        }

        try {
            await api.catalogos.crearEspesor(valor);
            App.toast('Espesor agregado');
            input.value = '';
            this.render();
        } catch(err) {
            App.toast(err.message, 'error');
        }
    },

    async eliminarEspesor(id, valor) {
        if (!confirm(`¿Eliminar el espesor de ${valor}mm?`)) return;
        
        try {
            await api.catalogos.eliminarEspesor(id);
            App.toast('Espesor eliminado');
            this.render();
        } catch(err) {
            App.toast(err.message, 'error');
        }
    }
};
