const InvInventario = {
    async render() {
        const page = document.querySelector('.page.active');
        page.innerHTML = '<div class="empty-state"><p>Cargando...</p></div>';
        try {
            const [items, tiposCristal] = await Promise.all([api.inv().getInventario(), api.inv().getTiposCristal()]);
            page.innerHTML = `
                <div class="filters-bar">
                    <label style="font-weight:500; color:var(--gray-700); font-size:13px;">Tipo Cristal:</label>
                    <select id="invFilterSelect" class="form-control" style="width:auto; min-width:180px;" onchange="InvInventario.filtrar(this.value)">
                        <option value="">Todos</option>
                        ${tiposCristal.map(t => `<option value="${t}">${t}</option>`).join('')}
                    </select>
                </div>
                <div style="display:flex; gap:8px; margin-bottom:14px; justify-content:flex-end;">
                    <button onclick="InvInventario.exportarExcel()" class="btn btn-success btn-sm">Exportar Excel</button>
                    <button onclick="window.print()" class="btn btn-outline btn-sm">Imprimir</button>
                </div>
                <div class="card">
                    <div class="card-header">Inventario Actual <span style="color:var(--gray-500); font-weight:400; font-size:13px;">(${items.length} tipos)</span></div>
                    <div class="card-body" style="padding:0">
                        ${items.length === 0 ? '<div class="empty-state"><div class="icon">📦</div><p>No hay items en inventario</p></div>' : `<div class="table-responsive"><table id="invTable"><thead><tr><th>Tipo Cristal</th><th>Espesor</th><th>Ancho</th><th>Alto</th><th>Stock</th><th>m2 Stock</th></tr></thead><tbody id="invBody">${this.renderRows(items)}</tbody></table></div>`}
                    </div>
                </div>`;
            this.allItems = items;
        } catch(err) { page.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`; }
    },
    renderRows(items) {
        return items.map(i => `<tr><td style="font-weight:600;">${i.tipo_cristal}</td><td><span style="background:var(--primary-light); color:var(--primary); padding:2px 10px; border-radius:12px; font-size:12px;">${i.espesor}mm</span></td><td>${i.ancho}</td><td>${i.alto}</td><td><span style="font-size:16px; font-weight:700; color:${i.stock > 0 ? 'var(--success)' : 'var(--danger)'};">${i.stock}</span></td><td>${(i.m2_entradas - i.m2_salidas).toFixed(2)} m2</td></tr>`).join('');
    },
    async filtrar(cristal) {
        try {
            const items = cristal ? await api.inv().getInventario({ cristal }) : await api.inv().getInventario();
            const tbody = document.getElementById('invBody');
            if (tbody) tbody.innerHTML = this.renderRows(items);
        } catch(err) { App.toast('Error: ' + err.message, 'error'); }
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
