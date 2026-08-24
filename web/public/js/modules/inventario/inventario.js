const InvInventario = {
    async render() {
        const page = document.querySelector('.page.active');
        page.innerHTML = '<div class="empty-state"><p>Cargando...</p></div>';
        try {
            const items = await api.inv().getInventario();
            page.innerHTML = `
                <div class="m-page">
                    <div class="m-hero">
                        <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
                        <div class="m-hero-inner">
                            <div class="m-hero-title">
                                <h2 style="margin:0;font-size:15px;font-weight:800;color:white;letter-spacing:-0.5px">Inventario</h2>
                                <p style="margin:4px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Stock actual por tipo de cristal</p>
                            </div>
                            <div class="m-filters">
                                <div style="position:relative;flex:1;min-width:0">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                    <input type="text" id="invSearch" placeholder="Buscar por codigo, tipo o espesor..." oninput="InvInventario.buscar(this.value)" style="width:100%;padding:7px 10px 7px 30px;font-size:12px;border:1px solid rgba(255,255,255,0.2);border-radius:6px;box-sizing:border-box;outline:none;background:rgba(255,255,255,0.1);color:white" onfocus="this.style.borderColor='rgba(255,255,255,0.5)'" onblur="this.style.borderColor='rgba(255,255,255,0.2)'">
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="m-actions">
                        <button onclick="InvInventario.exportarExcel()" class="btn btn-success btn-sm">Exportar Excel</button>
                        <button onclick="window.print()" class="btn btn-outline btn-sm">Imprimir</button>
                    </div>

                    <div class="m-card">
                        <div class="m-card-header">
                            <h3 style="margin:0;font-size:15px;font-weight:700;color:#1e293b">Inventario Actual <span style="color:var(--gray-500);font-weight:400;font-size:13px">(${items.length} tipos)</span></h3>
                        </div>
                        <div class="m-card-body">
                            ${items.length === 0
                                ? '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">No hay items en inventario</h4><p style="margin:0;color:#94a3b8;font-size:13px">Agrega el primer item</p></div>'
                                : `<div class="m-table-wrap"><table id="invTable"><thead><tr><th>Codigo</th><th>Tipo Cristal</th><th>Espesor</th><th>Medida</th><th>Entradas</th><th>Salidas</th><th>Trozos</th><th>Stock</th><th>m2 Stock</th></tr></thead><tbody id="invBody">${this.renderRows(items)}</tbody></table></div><div id="invCards" class="m-cards-mobile"></div>`
                            }
                        </div>
                    </div>
                </div>`;
            this.allItems = items;
            this.renderCards(items);
        } catch(err) { page.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`; }
    },

    renderRows(items) {
        return items.map(i => `<tr>
            <td style="font-weight:600">${i.codigo_mp || '-'}</td>
            <td>${i.tipo_cristal}</td>
            <td style="font-weight:600;color:#334155">${i.espesor}mm</td>
            <td style="font-weight:600;color:#1e40af">${Math.round(i.ancho || 0)}x${Math.round(i.alto || 0)}mm</td>
            <td style="color:var(--success);font-weight:600">${i.entradas}</td>
            <td style="color:var(--danger)">${i.salidas_plancha}</td>
            <td style="color:var(--warning)">${i.trozos}</td>
            <td><span style="font-size:18px;font-weight:700;color:${i.stock > 0 ? 'var(--success)' : 'var(--danger)'}">${i.stock}</span></td>
            <td>${(i.m2_entradas - i.m2_salidas).toFixed(2)} m2</td>
        </tr>`).join('');
    },

    renderCards(items) {
        const cardsEl = document.getElementById('invCards');
        if (!cardsEl) return;
        if (items.length === 0) { cardsEl.innerHTML = ''; return; }
        cardsEl.innerHTML = items.map(i => {
            const sc = i.stock > 0 ? '#22c55e' : '#ef4444';
            return '<div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,0.04);border-left:4px solid ' + sc + '">'
                + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
                + '<span style="font-weight:700;color:#0f172a;font-size:14px">' + (i.codigo_mp || '-') + '</span>'
                + '<span style="font-size:18px;font-weight:800;color:' + sc + '">' + (i.stock || 0) + '</span></div>'
                + '<div style="font-size:14px;color:#475569;margin-bottom:4px;font-weight:500">' + (i.tipo_cristal || '-') + ' ' + (i.espesor || 0) + 'mm</div>'
                + '<div style="font-size:11px;color:#64748b;margin-bottom:6px">' + Math.round(i.ancho || 0) + 'x' + Math.round(i.alto || 0) + 'mm</div>'
                + '<div style="display:flex;gap:16px;font-size:11px;color:#64748b">'
                + '<span>E: <strong style="color:#22c55e">' + (i.entradas || 0) + '</strong></span>'
                + '<span>S: <strong style="color:#ef4444">' + (i.salidas_plancha || 0) + '</strong></span>'
                + '<span>m2: <strong>' + ((i.m2_entradas || 0) - (i.m2_salidas || 0)).toFixed(2) + '</strong></span>'
                + '</div></div>';
        }).join('');
    },

    buscar(q) {
        const query = q.toLowerCase().trim();
        const filtered = query ? this.allItems.filter(i => {
            const nombre = (i.tipo_cristal || '').toLowerCase();
            const codigo = (i.codigo_mp || '').toLowerCase();
            const espesor = i.espesor != null ? Number(i.espesor).toString() : '';
            return nombre.includes(query) || codigo.includes(query) || espesor.includes(query);
        }) : this.allItems;
        const tbody = document.getElementById('invBody');
        if (tbody) tbody.innerHTML = this.renderRows(filtered);
        this.renderCards(filtered);
        const counter = document.querySelector('.m-card-header span');
        if (counter) counter.textContent = '(' + filtered.length + ' tipos)';
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
