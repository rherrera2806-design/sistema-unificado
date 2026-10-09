// Escape XSS: usa los helpers del SPA (app-main.js); fallback si se carga aislado
window.escText = window.escText || function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); };
window.escAttr = window.escAttr || window.escText;

// ============================================================================
// Inventario — lenguaje visual "hoja tecnica de vidrio" (ver css/inv-pro.css)
// COLOR = SIGNIFICADO: datos neutros; solo se colorea lo que exige una decision.
// ============================================================================
const InvInventario = {
    _allItems: [],
    _originalItems: [],
    _filterCriticos: false,
    _query: '',
    _verSensible: false,

    // Estado del material: el unico dato que se colorea en la tabla
    _estado(i) {
        const stock = Number(i.stock) || 0;
        const cpm = Number(i.consumo_promedio_mensual) || 0;
        const autoMeses = Number(i.autonomia_meses) || 0;
        const autoDias = Number(i.autonomia_dias) || 0;
        if (stock <= 0) return { cls: 'critico', label: 'SIN STOCK', autoCls: 'invp-danger', stockCls: 'invp-danger' };
        if (cpm > 0 && autoMeses <= 1) return { cls: 'critico', label: 'CRÍTICO', autoCls: 'invp-danger', stockCls: 'invp-valor' };
        if (cpm > 0 && autoDias <= 21) return { cls: 'bajo', label: 'BAJO', autoCls: 'invp-warn', stockCls: 'invp-valor' };
        return { cls: '', label: 'ÓPTIMO', autoCls: '', stockCls: 'invp-valor' };
    },

    async render() {
        const page = document.querySelector('.page.active');
        page.innerHTML = '<div class="empty-state"><p>Cargando...</p></div>';
        try {
            this._verSensible = typeof hasPerm === 'function' && hasPerm('inv_inventario.sensible');
            const items = await api.inv().getInventario();
            this._originalItems = Array.isArray(items) ? items : [];
            this._allItems = [...this._originalItems];

            const acciones = this._verSensible ? `
                <button class="invp-btn" onclick="window.print()">Imprimir</button>
                <button class="invp-btn invp-btn-primary" onclick="InvInventario.exportarExcel()">Exportar Excel</button>` : '';

            page.innerHTML = `
                <div class="inv-pro">
                    <div class="invp-hero">
                        <div>
                            <h2>Inventario</h2>
                            <p>Stock actual por tipo de cristal</p>
                        </div>
                        <div class="invp-hero-actions">
                            <input class="invp-search" type="text" id="invSearch" placeholder="Buscar código o tipo…"
                                oninput="InvInventario.buscar(this.value)">
                        </div>
                    </div>

                    <div class="m-actions" style="justify-content:flex-end">
                        <button class="invp-btn invp-btn-filter" id="btnCriticos" aria-pressed="false"
                            onclick="InvInventario.toggleCriticos()">Solo stock crítico</button>
                        ${acciones}
                    </div>

                    <div class="invp-note">
                        <span>◇</span>
                        <span>Muestra solo materiales con <strong>stock real</strong> (entradas registradas). Para ver materiales sin stock pero con consumo, usa <strong>Consumo y Autonomía</strong> o <strong>Reporte</strong>.</span>
                    </div>

                    <div class="invp-card">
                        <div class="invp-card-head">
                            <h3>Inventario actual</h3>
                            <span class="invp-count" id="invCount">(${this._allItems.length} tipos)</span>
                        </div>
                        <div id="invContent"></div>
                    </div>
                </div>`;

            this.renderContent();
        } catch (err) {
            // Error visible en vez de una tabla vacia que parece "sin datos"
            App.toast('Error al cargar inventario: ' + err.message, 'error');
            page.innerHTML = '<div class="inv-pro"><div class="alert alert-danger">Error: ' + escText(err.message) + '</div></div>';
        }
    },

    renderContent() {
        const container = document.getElementById('invContent');
        if (!container) return;
        const verS = this._verSensible;
        const self = this;

        if (this._allItems.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:48px 20px">'
                + '<h4 style="margin:0 0 4px;color:#334155;font-size:15px">No hay materiales en inventario</h4>'
                + '<p style="margin:0;color:#8494a8;font-size:13px">Los materiales aparecen aquí al registrar su primera entrada.</p></div>';
            return;
        }

        // ---------- Tabla desktop ----------
        let headers = '<th>Código</th><th>Tipo de cristal</th><th class="num">Espesor</th><th>Medida</th>';
        if (verS) headers += '<th class="num">Entradas</th><th class="num">Salidas</th>';
        headers += '<th class="num invp-col-stock">Stock</th>';
        if (verS) headers += '<th class="num">Consumo/mes</th><th class="num">Autonomía</th>';
        headers += '<th class="num">M² en stock</th><th>Estado</th>';

        let tableHtml = '<div class="m-table-wrap"><table class="invp-table" id="invTable"><thead><tr>' + headers + '</tr></thead><tbody>';

        this._allItems.forEach(function (i) {
            const est = self._estado(i);
            const cpm = Number(i.consumo_promedio_mensual) || 0;
            const autoDias = Number(i.autonomia_dias) || 0;
            const m2 = ((i.m2_entradas || 0) - (i.m2_salidas || 0));
            tableHtml += '<tr class="' + est.cls + '">'
                + '<td class="codigo invp-mono">' + escText(i.codigo_mp || '-') + '</td>'
                + '<td class="tipo">' + escText(i.tipo_cristal || '-') + '</td>'
                + '<td class="num invp-mono sutil">' + escText(i.espesor != null ? i.espesor : 0) + '<span class="invp-unidad">mm</span></td>'
                + '<td class="invp-mono sutil">' + Math.round(i.ancho || 0) + '×' + Math.round(i.alto || 0) + '</td>';
            if (verS) tableHtml += '<td class="num invp-mono sutil">' + (i.entradas || 0) + '</td>'
                + '<td class="num invp-mono sutil">' + (i.salidas_plancha || 0) + '</td>';
            tableHtml += '<td class="num invp-mono invp-col-stock ' + est.stockCls + '">' + (i.stock || 0) + '</td>';
            if (verS) tableHtml += '<td class="num invp-mono sutil">' + cpm.toLocaleString('es-CL') + '</td>'
                + '<td class="num invp-mono ' + est.autoCls + '">' + (cpm > 0 ? autoDias + '<span class="invp-unidad">d</span>' : '—') + '</td>';
            tableHtml += '<td class="num invp-mono sutil">' + m2.toFixed(2) + '<span class="invp-unidad">m²</span></td>'
                + '<td><span class="invp-chip ' + (est.cls === 'critico' ? 'critico' : est.cls === 'bajo' ? 'bajo' : 'ok') + '"><span class="dot"></span>' + est.label + '</span></td>'
                + '</tr>';
        });
        tableHtml += '</tbody></table></div>';

        // ---------- Cards móvil ----------
        let cardsHtml = '<div class="m-cards-mobile" style="display:none">';
        this._allItems.forEach(function (i) {
            const est = self._estado(i);
            const cpm = Number(i.consumo_promedio_mensual) || 0;
            const autoDias = Number(i.autonomia_dias) || 0;
            const m2 = ((i.m2_entradas || 0) - (i.m2_salidas || 0));
            const chipCls = est.cls === 'critico' ? 'critico' : est.cls === 'bajo' ? 'bajo' : 'ok';
            cardsHtml += '<div class="invp-mcard ' + est.cls + '">'
                + '<div class="top">'
                + '<span class="cod">' + escText(i.codigo_mp || '-') + ' · ' + escText(i.tipo_cristal || '-') + '</span>'
                + '<span class="invp-chip ' + chipCls + '"><span class="dot"></span>' + est.label + '</span>'
                + '</div><div class="invp-mgrid">'
                + '<div><div class="invp-lbl">Espesor</div><div class="invp-val">' + escText(i.espesor != null ? i.espesor : 0) + ' mm</div></div>'
                + '<div><div class="invp-lbl">Medida</div><div class="invp-val">' + Math.round(i.ancho || 0) + '×' + Math.round(i.alto || 0) + '</div></div>'
                + '<div><div class="invp-lbl">Stock</div><div class="invp-val ' + est.stockCls + '">' + (i.stock || 0) + '</div></div>';
            if (verS) cardsHtml += '<div><div class="invp-lbl">Entradas</div><div class="invp-val">' + (i.entradas || 0) + '</div></div>'
                + '<div><div class="invp-lbl">Salidas</div><div class="invp-val">' + (i.salidas_plancha || 0) + '</div></div>';
            cardsHtml += '<div><div class="invp-lbl">M² en stock</div><div class="invp-val">' + m2.toFixed(2) + '</div></div>';
            if (verS) cardsHtml += '<div><div class="invp-lbl">Consumo/mes</div><div class="invp-val">' + cpm.toLocaleString('es-CL') + '</div></div>'
                + '<div><div class="invp-lbl">Autonomía</div><div class="invp-val ' + est.autoCls + '">' + (cpm > 0 ? autoDias + ' d' : '—') + '</div></div>';
            cardsHtml += '</div></div>';
        });
        cardsHtml += '</div>';

        container.innerHTML = tableHtml + cardsHtml;
    },

    // Busqueda y "Solo stock critico" se componen: ambos aplican sobre
    // _originalItems respetando el estado del otro.
    _aplicarFiltros() {
        let items = this._originalItems;
        const query = this._query;
        if (query) {
            items = items.filter(function (i) {
                const codigo = String(i.codigo_mp || '').toLowerCase();
                const espesorStr = String(i.espesor != null ? i.espesor : '').toLowerCase();
                const tipo = String(i.tipo_cristal || '').toLowerCase();
                const ancho = String(i.ancho || '').toLowerCase();
                const alto = String(i.alto || '').toLowerCase();
                const cpm = String(i.consumo_promedio_mensual || '').toLowerCase();
                return codigo.includes(query) || tipo.includes(query) || espesorStr.includes(query) || ancho.includes(query) || alto.includes(query) || cpm.includes(query);
            });
        }
        if (this._filterCriticos) {
            items = items.filter(function (i) {
                const cpm = Number(i.consumo_promedio_mensual) || 0;
                const autoMeses = Number(i.autonomia_meses) || 0;
                return cpm > 0 && autoMeses <= 1;
            });
        }
        // Ordenar por tipo de cristal y luego por espesor
        this._allItems = items.slice().sort(function (a, b) {
            const nameA = (a.tipo_cristal || '').toLowerCase();
            const nameB = (b.tipo_cristal || '').toLowerCase();
            if (nameA < nameB) return -1;
            if (nameA > nameB) return 1;
            return Number(a.espesor || 0) - Number(b.espesor || 0);
        });
        this.renderContent();
        const counter = document.getElementById('invCount');
        if (counter) counter.textContent = '(' + this._allItems.length + ' tipos)';
    },

    buscar(q) {
        this._query = (q || '').toLowerCase().trim();
        this._aplicarFiltros();
    },

    toggleCriticos() {
        this._filterCriticos = !this._filterCriticos;
        const btn = document.getElementById('btnCriticos');
        if (btn) btn.setAttribute('aria-pressed', this._filterCriticos ? 'true' : 'false');
        this._aplicarFiltros();
    },

    exportarExcel() {
        const table = document.getElementById('invTable');
        if (!table) return;
        const csv = Array.from(table.querySelectorAll('tr')).map(function (row) {
            return Array.from(row.querySelectorAll('th, td')).map(function (c) { return c.textContent.trim(); }).join(';');
        }).join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'inventario_' + new Date().toISOString().slice(0, 10) + '.csv';
        link.click();
        App.toast('Excel exportado');
    }
};
