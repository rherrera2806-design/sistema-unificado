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
                            <div style="display:flex; gap:8px; margin-bottom:8px;">
                                <input type="text" id="nuevoTipoCristal" class="form-control" placeholder="Nombre..." style="flex:1;">
                            </div>
                            <div style="display:flex; gap:8px; margin-bottom:16px;">
                                <input type="number" id="nuevoStockCritico" class="form-control" placeholder="Stock crítico (planchas)" min="0" style="flex:1;">
                                <input type="number" id="nuevoConsumoMensual" class="form-control" placeholder="Consumo mensual aprox" min="0" step="0.1" style="flex:1;">
                            </div>
                            <div style="margin-bottom:16px;">
                                <button class="btn btn-success" onclick="InvCatalogos.agregarTipoCristal()" style="width:100%;">+ Agregar Tipo</button>
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
                            <div style="display:flex; gap:12px; margin-bottom:16px;">
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
            <div class="catalog-item" data-id="${t.id}" style="flex-direction:column;align-items:stretch;gap:6px;">
                <div style="display:flex;align-items:center;justify-content:space-between;">
                    <span class="catalog-item-name" style="font-weight:700;">${this.escapeHtml(t.nombre)}</span>
                    <div style="display:flex;gap:4px;">
                        <button class="btn btn-sm" onclick="InvCatalogos.editarTipoCristal(${t.id})" title="Editar" style="padding:4px 8px;font-size:11px;background:rgba(59,130,246,0.1);color:var(--info);">Editar</button>
                        <button class="btn btn-danger btn-sm" onclick="InvCatalogos.eliminarTipoCristal(${t.id}, '${this.escapeHtml(t.nombre)}')" title="Eliminar" style="padding:4px 8px;">✕</button>
                    </div>
                </div>
                <div style="display:flex;gap:12px;font-size:11px;color:var(--gray-500);">
                    <span>Stock crítico: <strong style="color:${t.stock_critico > 0 ? 'var(--warning)' : 'var(--gray-400)'};">${t.stock_critico || 0} planchas</strong></span>
                    <span>Consumo mensual: <strong style="color:${t.consumo_mensual_aprox > 0 ? 'var(--info)' : 'var(--gray-400)'};">${t.consumo_mensual_aprox || 0} planchas</strong></span>
                </div>
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
        const nombre = document.getElementById('nuevoTipoCristal').value.trim();
        const stockCritico = document.getElementById('nuevoStockCritico').value;
        const consumoMensual = document.getElementById('nuevoConsumoMensual').value;
        
        if (!nombre) {
            App.toast('Ingresa un nombre para el tipo de cristal', 'error');
            return;
        }

        try {
            await api.catalogos.crearTipoCristal({
                nombre,
                stock_critico: parseInt(stockCritico) || 0,
                consumo_mensual_aprox: parseFloat(consumoMensual) || 0
            });
            App.toast('Tipo de cristal agregado');
            this.render();
        } catch(err) {
            App.toast(err.message, 'error');
        }
    },

    async editarTipoCristal(id) {
        let tipos;
        try {
            tipos = await api.catalogos.getTiposCristal();
        } catch(e) { return; }
        const t = tipos.find(x => x.id === id);
        if (!t) return;

        const page = document.querySelector('.page.active');
        const modal = document.createElement('div');
        modal.id = 'editModalTipoCristal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5)';
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
        modal.innerHTML = `
            <div style="background:white;border-radius:12px;padding:24px;width:90%;max-width:400px;box-shadow:0 8px 32px rgba(0,0,0,0.2)">
                <h3 style="font-size:16px;font-weight:700;margin-bottom:16px;">Editar: ${this.escapeHtml(t.nombre)}</h3>
                <div style="margin-bottom:12px;">
                    <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">Nombre</label>
                    <input type="text" id="editTCNombre" class="form-control" value="${this.escapeHtml(t.nombre)}">
                </div>
                <div style="margin-bottom:12px;">
                    <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">Stock Crítico (planchas)</label>
                    <input type="number" id="editTCStockCritico" class="form-control" value="${t.stock_critico || 0}" min="0">
                </div>
                <div style="margin-bottom:16px;">
                    <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">Consumo Mensual Aprox (planchas)</label>
                    <input type="number" id="editTCConsumoMensual" class="form-control" value="${t.consumo_mensual_aprox || 0}" min="0" step="0.1">
                </div>
                <div style="display:flex;gap:8px;">
                    <button onclick="document.getElementById('editModalTipoCristal').remove()" class="btn btn-outline" style="flex:1;">Cancelar</button>
                    <button onclick="InvCatalogos.guardarTipoCristal(${id})" class="btn btn-primary" style="flex:1;">Guardar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    async guardarTipoCristal(id) {
        const nombre = document.getElementById('editTCNombre').value.trim();
        const stockCritico = document.getElementById('editTCStockCritico').value;
        const consumoMensual = document.getElementById('editTCConsumoMensual').value;

        if (!nombre) {
            App.toast('El nombre es requerido', 'error');
            return;
        }

        try {
            await api.catalogos.editarTipoCristal(id, {
                nombre,
                stock_critico: parseInt(stockCritico) || 0,
                consumo_mensual_aprox: parseFloat(consumoMensual) || 0
            });
            document.getElementById('editModalTipoCristal').remove();
            App.toast('Tipo de cristal actualizado');
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
