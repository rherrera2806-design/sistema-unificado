const InvInventario = {
    _allItems: [],
    _originalItems: [],

    async render() {
        const page = document.querySelector('.page.active');
        page.innerHTML = '<div class="empty-state"><p>Cargando...</p></div>';
        try {
            const hdrs = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const items = await api.inv().getInventario();
            this._originalItems = Array.isArray(items) ? items : [];
            this._allItems = [...this._originalItems];

            page.innerHTML = `
                <div class="m-page">
                    <div class="m-hero" style="padding:10px 14px">
                        <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
                        <div style="position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
                            <div style="min-width:0">
                                <h2 style="margin:0;font-size:14px;font-weight:800;color:white">Inventario</h2>
                                <p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Stock actual por tipo de cristal</p>
                            </div>
                            <div style="position:relative;flex:1;min-width:140px;max-width:250px">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);pointer-events:none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                <input type="text" id="invSearch" placeholder="Buscar..." oninput="InvInventario.buscar(this.value)" style="width:100%;padding:6px 8px 6px 28px;font-size:12px;border:1px solid rgba(255,255,255,0.2);border-radius:6px;box-sizing:border-box;outline:none;background:rgba(255,255,255,0.1);color:white" onfocus="this.style.borderColor='rgba(255,255,255,0.5)'" onblur="this.style.borderColor='rgba(255,255,255,0.2)'">
                            </div>
                        </div>
                    </div>

                    <div class="m-actions">
                        <button onclick="InvInventario.exportarExcel()" class="btn btn-success" style="padding:8px 16px;font-size:12px">Exportar Excel</button>
                        <button onclick="window.print()" class="btn btn-outline" style="padding:8px 16px;font-size:12px">Imprimir</button>
                    </div>

                    <div class="m-card">
                        <div class="m-card-header">
                            <h3 style="margin:0;font-size:15px;font-weight:700;color:#1e293b">Inventario Actual <span id="invCount" style="color:var(--gray-500);font-weight:400;font-size:13px">(${this._allItems.length} tipos)</span></h3>
                        </div>
                        <div class="m-card-body" id="invContent"></div>
                    </div>
                </div>`;

            this.renderContent();
        } catch(err) { page.innerHTML = '<div class="alert alert-danger">Error: ' + err.message + '</div>'; }
    },

    renderContent() {
        const container = document.getElementById('invContent');
        if (!container) return;

        if (this._allItems.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">No hay items en inventario</h4><p style="margin:0;color:#94a3b8;font-size:13px">Agrega el primer item</p></div>';
            return;
        }

        // Tabla desktop
        let tableHtml = '<div class="m-table-wrap"><table id="invTable"><thead><tr>'
            + '<th>Codigo</th><th>Tipo Cristal</th><th>Espesor</th><th>Medida</th><th>Entradas</th><th>Salidas</th><th>Trozos</th><th>Stock</th><th>CPM</th><th>Autonomía</th><th>m2 Stock</th>'
            + '</tr></thead><tbody id="invBody">';

        this._allItems.forEach(function(i) {
            var stockColor = i.stock > 0 ? 'var(--success)' : 'var(--danger)';
            var cpm = Number(i.consumo_promedio_mensual) || 0;
            var autoDias = Number(i.autonomia_dias) || 0;
            var autoMeses = Number(i.autonomia_meses) || 0;
            var autoColor = autoDias <= 0 ? 'var(--danger)' : autoDias <= 21 ? 'var(--warning)' : 'var(--success)';
            tableHtml += '<tr>'
                + '<td style="font-weight:600">' + (i.codigo_mp || '-') + '</td>'
                + '<td>' + (i.tipo_cristal || '-') + '</td>'
                + '<td style="font-weight:600;color:#334155">' + (i.espesor || 0) + 'mm</td>'
                + '<td style="font-weight:600;color:#1e40af">' + Math.round(i.ancho || 0) + 'x' + Math.round(i.alto || 0) + 'mm</td>'
                + '<td style="color:var(--success);font-weight:600">' + (i.entradas || 0) + '</td>'
                + '<td style="color:var(--danger)">' + (i.salidas_plancha || 0) + '</td>'
                + '<td style="color:var(--warning)">' + (i.trozos || 0) + '</td>'
                + '<td><span style="font-size:18px;font-weight:700;color:' + stockColor + '">' + (i.stock || 0) + '</span></td>'
                + '<td style="font-weight:600;color:#92400e;background:#fef3c7">' + cpm.toLocaleString('es-CL') + '</td>'
                + '<td style="font-weight:600;color:' + autoColor + '">' + autoDias + 'd / ' + autoMeses + 'm</td>'
                + '<td>' + ((i.m2_entradas || 0) - (i.m2_salidas || 0)).toFixed(2) + ' m2</td>'
                + '</tr>';
        });

        tableHtml += '</tbody></table></div>';

        // Cards móvil
        let cardsHtml = '<div class="m-cards-mobile" style="display:none">';
        this._allItems.forEach(function(i) {
            var stockColor = i.stock > 0 ? '#22c55e' : '#ef4444';
            var cpm = Number(i.consumo_promedio_mensual) || 0;
            var autoDias = Number(i.autonomia_dias) || 0;
            var autoMeses = Number(i.autonomia_meses) || 0;
            var autoColor = autoDias <= 0 ? '#ef4444' : autoDias <= 21 ? '#f59e0b' : '#22c55e';
            cardsHtml += '<div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,0.04);border-left:4px solid ' + stockColor + '">'
                + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
                + '<span style="font-weight:700;color:#0f172a;font-size:14px">' + (i.codigo_mp || '-') + '</span>'
                + '<span style="font-size:18px;font-weight:800;color:' + stockColor + '">' + (i.stock || 0) + '</span>'
                + '</div>'
                + '<div style="font-size:14px;color:#475569;margin-bottom:4px;font-weight:500">' + (i.tipo_cristal || '-') + ' ' + (i.espesor || 0) + 'mm</div>'
                + '<div style="font-size:11px;color:#64748b;margin-bottom:6px">' + Math.round(i.ancho || 0) + 'x' + Math.round(i.alto || 0) + 'mm</div>'
                + '<div style="display:flex;gap:12px;font-size:11px;color:#64748b;flex-wrap:wrap">'
                + '<span>E: <strong style="color:#22c55e">' + (i.entradas || 0) + '</strong></span>'
                + '<span>S: <strong style="color:#ef4444">' + (i.salidas_plancha || 0) + '</strong></span>'
                + '<span>m2: <strong>' + ((i.m2_entradas || 0) - (i.m2_salidas || 0)).toFixed(2) + '</strong></span>'
                + '<span style="background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:8px;font-weight:600">CPM: ' + cpm.toLocaleString('es-CL') + '</span>'
                + '<span style="background:' + autoColor + '20;color:' + autoColor + ';padding:1px 6px;border-radius:8px;font-weight:600">Auto: ' + autoDias + 'd / ' + autoMeses + 'm</span>'
                + '</div></div>';
        });
        cardsHtml += '</div>';

        container.innerHTML = tableHtml + cardsHtml;
    },

    buscar(q) {
        var query = (q || '').toLowerCase().trim();
        if (!query) {
            this._allItems = [...this._originalItems];
        } else {
            this._allItems = this._originalItems.filter(function(i) {
                var espesorStr = String(i.espesor != null ? i.espesor : '').toLowerCase();
                var tipo = String(i.tipo_cristal || '').toLowerCase();
                var ancho = String(i.ancho || '').toLowerCase();
                var alto = String(i.alto || '').toLowerCase();
                var cpm = String(i.consumo_promedio_mensual || '').toLowerCase();
                return tipo.includes(query) || espesorStr.includes(query) || ancho.includes(query) || alto.includes(query) || cpm.includes(query);
            });
        }
        // Ordenar por tipo_cristal y luego por espesor
        this._allItems.sort(function(a, b) {
            var nameA = (a.tipo_cristal || '').toLowerCase();
            var nameB = (b.tipo_cristal || '').toLowerCase();
            if (nameA < nameB) return -1;
            if (nameA > nameB) return 1;
            return Number(a.espesor || 0) - Number(b.espesor || 0);
        });
        this.renderContent();
        var counter = document.getElementById('invCount');
        if (counter) counter.textContent = '(' + this._allItems.length + ' tipos)';
    },

    exportarExcel() {
        var table = document.getElementById('invTable');
        if (!table) return;
        var csv = Array.from(table.querySelectorAll('tr')).map(function(row) {
            return Array.from(row.querySelectorAll('th, td')).map(function(c) { return c.textContent.trim(); }).join(';');
        }).join('\n');
        var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'inventario_' + new Date().toISOString().slice(0, 10) + '.csv';
        link.click();
        App.toast('Excel exportado');
    }
};
