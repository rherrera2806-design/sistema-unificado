const InvInventario = {
    allItems: [],
    _autonomiaFilter: null,

    async render() {
        const page = document.querySelector('.page.active');
        page.innerHTML = '<div class="empty-state"><p>Cargando...</p></div>';
        try {
            const items = await api.inv().getInventario();
            this.allItems = items;
            page.innerHTML = `
                <style>
                    .inv-filter-btn{padding:5px 12px;font-size:11px;font-weight:600;border-radius:8px;border:1px solid #e2e8f0;background:white!important;color:#64748b!important;cursor:pointer;transition:all 0.15s}
                    .inv-filter-btn:hover{border-color:#93c5fd;color:#3b82f6!important;background:#eff6ff!important}
                    .inv-filter-btn.active{background:linear-gradient(135deg,#1e40af,#2563eb)!important;color:white!important;border-color:#1e40af!important;box-shadow:0 2px 8px rgba(30,64,175,0.3)}
                    @media(max-width:768px){
                        .inv-actions .btn{height:40px;min-height:40px;flex:1;font-size:12px}
                        .inv-filters-wrap{flex-direction:column}
                        .inv-filters-wrap>div{width:100%}
                    }
                </style>
                <div class="m-page">
                    <div class="m-hero" style="padding:10px 14px">
                        <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
                        <div style="position:relative;z-index:1">
                            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
                                <div>
                                    <h2 style="margin:0;font-size:15px;font-weight:800;color:white;letter-spacing:-0.5px">Inventario</h2>
                                    <p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Stock actual por tipo de cristal</p>
                                </div>
                                <div class="inv-actions" style="display:flex;gap:6px">
                                    <button onclick="InvInventario.exportarExcel()" class="btn btn-sm" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);color:white;padding:5px 12px;font-size:11px;border-radius:8px">Exportar</button>
                                    <button onclick="window.print()" class="btn btn-sm" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);color:white;padding:5px 12px;font-size:11px;border-radius:8px">Imprimir</button>
                                </div>
                            </div>
                            <div class="inv-filters-wrap" style="display:flex;gap:8px;margin-top:8px;align-items:center">
                                <div style="position:relative;flex:1;min-width:0">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                    <input type="text" id="invSearch" placeholder="Buscar por codigo, tipo o espesor..." oninput="InvInventario.buscar(this.value)" style="width:100%;padding:10px 12px 10px 30px;font-size:13px;border:1px solid rgba(255,255,255,0.2);border-radius:8px;box-sizing:border-box;outline:none;background:rgba(255,255,255,0.1);color:white" onfocus="this.style.borderColor='rgba(255,255,255,0.5)'" onblur="this.style.borderColor='rgba(255,255,255,0.2)'">
                                </div>
                                <div style="display:flex;align-items:center;gap:4px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:5px 10px">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                    <span style="font-size:10px;color:rgba(255,255,255,0.7);white-space:nowrap">Auton. ≥</span>
                                    <input type="number" id="invAutonomiaFilter" placeholder="meses" min="0" step="0.5" style="width:50px;padding:3px 4px;font-size:11px;border:none;background:transparent;color:white;outline:none;text-align:center" oninput="InvInventario.filtrarAutonomia(this.value)">
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="m-card" style="margin-top:10px">
                        <div class="m-card-header" style="padding:6px 12px">
                            <h3 style="margin:0;font-size:12px;font-weight:600;color:#1e293b">Inventario Actual <span id="invCountLabel" style="color:var(--gray-500);font-weight:400;font-size:11px">(${items.length} tipos)</span></h3>
                        </div>
                        <div class="m-card-body" style="padding:8px 12px">
                            <div id="invTableWrap"></div>
                            <div id="invCards" class="m-cards-mobile"></div>
                        </div>
                    </div>
                </div>`;
            this.renderTabla(items);
        } catch(err) { page.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`; }
    },

    renderRows(items) {
        return items.map(i => {
            const stock = i.stock || 0;
            const autonomia = i.autonomia_meses || 0;
            const autoColor = stock <= 0 ? '#dc2626' : autonomia < 2 ? '#f59e0b' : '#22c55e';
            const autoLabel = stock <= 0 ? 'SIN STOCK' : autonomia < 1 ? '< 1 mes' : autonomia + ' meses';
            return '<tr>'
            + '<td style="font-weight:600">' + (i.codigo_mp || '-') + '</td>'
            + '<td>' + (i.tipo_cristal || '') + '</td>'
            + '<td>' + (i.espesor || 0) + 'mm</td>'
            + '<td>' + Math.round(i.ancho || 0) + ' x ' + Math.round(i.alto || 0) + '</td>'
            + '<td style="color:#22c55e">' + (i.entradas || 0) + '</td>'
            + '<td style="color:#ef4444">' + (i.salidas_plancha || 0) + '</td>'
            + '<td>' + (i.trozos || 0) + '</td>'
            + '<td style="font-weight:700;color:' + autoColor + '">' + stock + '</td>'
            + '<td>' + Number((i.m2_entradas || 0) - (i.m2_salidas || 0)).toFixed(2) + '</td>'
            + '<td><span style="display:inline-block;padding:3px 8px;border-radius:10px;font-size:10px;font-weight:600;background:' + autoColor + '15;color:' + autoColor + '">' + autoLabel + '</span></td>'
            + '</tr>';
        }).join('');
    },

    filtrarAutonomia(valor) {
        const v = parseFloat(valor);
        this._autonomiaFilter = isNaN(v) ? null : v;
        this._aplicarFiltros();
    },

    buscar(valor) {
        this._aplicarFiltros();
    },

    _aplicarFiltros() {
        const q = (document.getElementById('invSearch')?.value || '').toLowerCase().trim();
        let filtered = this.allItems;
        if (q) {
            filtered = filtered.filter(i =>
                (i.codigo_mp || '').toLowerCase().includes(q) ||
                (i.tipo_cristal || '').toLowerCase().includes(q) ||
                String(i.espesor || '').includes(q)
            );
        }
        if (this._autonomiaFilter !== null) {
            filtered = filtered.filter(i => (i.autonomia_meses || 0) >= this._autonomiaFilter);
        }
        this.renderTabla(filtered);
    },

    renderTabla(items) {
        const wrap = document.getElementById('invTableWrap');
        const cardsEl = document.getElementById('invCards');
        const count = document.getElementById('invCountLabel');
        if (count) count.textContent = '(' + items.length + ' tipos)';
        if (!wrap) return;
        if (items.length === 0) {
            wrap.innerHTML = '<div style="text-align:center;padding:48px 20px;color:#94a3b8">Sin items en inventario</div>';
            if (cardsEl) cardsEl.innerHTML = '';
            return;
        }
        wrap.innerHTML = '<div class="m-table-wrap"><table id="invTable"><thead><tr><th>Codigo</th><th>Tipo Cristal</th><th>Espesor</th><th>Medida</th><th>Entradas</th><th>Salidas</th><th>Trozos</th><th>Stock</th><th>m2 Stock</th><th>Autonomía</th></tr></thead><tbody>' + this.renderRows(items) + '</tbody></table></div>';
        if (cardsEl) this.renderCards(items);
    },

    renderCards(items) {
        const cardsEl = document.getElementById('invCards');
        if (!cardsEl) return;
        if (items.length === 0) { cardsEl.innerHTML = ''; return; }
        cardsEl.innerHTML = items.map(i => {
            const stock = i.stock || 0;
            const autonomia = i.autonomia_meses || 0;
            const sc = stock > 0 ? '#22c55e' : '#ef4444';
            const autoColor = stock <= 0 ? '#dc2626' : autonomia < 2 ? '#f59e0b' : '#22c55e';
            const autoLabel = stock <= 0 ? 'SIN STOCK' : autonomia < 1 ? '< 1 mes' : autonomia + ' meses';
            return '<div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,0.04);border-left:4px solid ' + sc + '">'
                + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
                + '<span style="font-weight:700;color:#0f172a;font-size:14px">' + (i.codigo_mp || '-') + '</span>'
                + '<span style="font-size:18px;font-weight:800;color:' + sc + '">' + stock + '</span></div>'
                + '<div style="font-size:14px;color:#475569;margin-bottom:4px;font-weight:500">' + (i.tipo_cristal || '-') + ' ' + (i.espesor || 0) + 'mm</div>'
                + '<div style="font-size:11px;color:#64748b;margin-bottom:6px">' + Math.round(i.ancho || 0) + 'x' + Math.round(i.alto || 0) + 'mm</div>'
                + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:11px;color:#64748b">'
                + '<span>E: <strong style="color:#22c55e">' + (i.entradas || 0) + '</strong></span>'
                + '<span>S: <strong style="color:#ef4444">' + (i.salidas_plancha || 0) + '</strong></span>'
                + '<span>m2: <strong>' + ((i.m2_entradas || 0) - (i.m2_salidas || 0)).toFixed(2) + '</strong></span>'
                + '<span style="padding:2px 6px;border-radius:8px;font-size:9px;font-weight:600;background:' + autoColor + '15;color:' + autoColor + '">' + autoLabel + '</span>'
                + '</div></div>';
        }).join('');
    },

    exportarExcel() {
        const table = document.getElementById('invTable');
        if (!table) return;
        const csv = Array.from(table.querySelectorAll('tr')).map(row => Array.from(row.querySelectorAll('th, td')).map(c => c.textContent.trim()).join(';')).join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'inventario_' + new Date().toISOString().slice(0, 10) + '.csv';
        link.click();
        App.toast('Excel exportado');
    }
};
