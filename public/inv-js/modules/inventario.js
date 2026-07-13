const InvInventario = {
    async render() {
        const page = document.querySelector('.page.active');
        page.innerHTML = '<div class="empty-state"><p>Cargando...</p></div>';
        try {
            const [items, tiposCristal, espesores] = await Promise.all([
                api.inv().getInventario(), 
                api.inv().getTiposCristal(),
                api.catalogos.getEspesores()
            ]);
            this.allItems = items.sort((a, b) => {
                if (a.tipo_cristal < b.tipo_cristal) return -1;
                if (a.tipo_cristal > b.tipo_cristal) return 1;
                return a.espesor - b.espesor;
            });
            
            // Get unique espesores from items
            const uniqueEspesores = [...new Set(items.map(i => i.espesor))].sort((a, b) => a - b);
            
            page.innerHTML = `
                <div class="filters-bar">
                    <label style="font-weight:500; color:var(--gray-700); font-size:13px;">Tipo Cristal:</label>
                    <select id="invFilterCristal" class="form-control" style="width:auto; min-width:180px;" onchange="InvInventario.filtrar()">
                        <option value="">Todos</option>
                        ${tiposCristal.map(t => `<option value="${t}">${t}</option>`).join('')}
                    </select>
                    <label style="font-weight:500; color:var(--gray-700); font-size:13px; margin-left:12px;">Espesor:</label>
                    <select id="invFilterEspesor" class="form-control" style="width:auto; min-width:120px;" onchange="InvInventario.filtrar()">
                        <option value="">Todos</option>
                        ${uniqueEspesores.map(e => `<option value="${e}">${e}mm</option>`).join('')}
                    </select>
                </div>
                <div style="display:flex; gap:8px; margin-bottom:14px; justify-content:flex-end;">
                    <button onclick="InvInventario.exportarExcel()" class="btn btn-success btn-sm">Exportar Excel</button>
                    <button onclick="window.print()" class="btn btn-outline btn-sm">Imprimir</button>
                </div>
                <div class="card">
                    <div class="card-header">Inventario Actual <span style="color:var(--gray-500); font-weight:400; font-size:13px;">(${items.length} tipos)</span></div>
                    <div class="card-body" style="padding:0">
                        ${items.length === 0 ? '<div class="empty-state"><div class="icon">ðŸ“¦</div><p>No hay items en inventario</p></div>' : `<div class="table-responsive"><table id="invTable"><thead><tr><th>Tipo Cristal</th><th>Espesor</th><th>Ancho</th><th>Alto</th><th>Stock</th><th>m2 Stock</th></tr></thead><tbody id="invBody">${this.renderRows(this.allItems)}</tbody></table></div>`}
                    </div>
                </div>`;
        } catch(err) { page.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`; }
    },
    renderRows(items) {
        return items.map(i => `<tr><td style="font-weight:600;">${i.tipo_cristal}</td><td><span style="background:var(--primary-light); color:var(--primary); padding:2px 10px; border-radius:12px; font-size:12px;">${i.espesor}mm</span></td><td>${parseInt(i.ancho)}</td><td>${parseInt(i.alto)}</td><td><span style="font-size:16px; font-weight:700; color:${i.stock > 0 ? 'var(--success)' : 'var(--danger)'};">${i.stock}</span></td><td>${(i.m2_entradas - i.m2_salidas).toFixed(2)} m2</td></tr>`).join('');
    },
    async filtrar() {
        try {
            const cristal = document.getElementById('invFilterCristal').value;
            const espesor = document.getElementById('invFilterEspesor').value;
            
            let items = await api.inv().getInventario();
            
            // Apply filters
            if (cristal) {
                items = items.filter(i => i.tipo_cristal === cristal);
            }
            if (espesor) {
                items = items.filter(i => i.espesor === parseInt(espesor));
            }
            
            const sorted = items.sort((a, b) => {
                if (a.tipo_cristal < b.tipo_cristal) return -1;
                if (a.tipo_cristal > b.tipo_cristal) return 1;
                return a.espesor - b.espesor;
            });
            
            const tbody = document.getElementById('invBody');
            if (tbody) tbody.innerHTML = this.renderRows(sorted);
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
