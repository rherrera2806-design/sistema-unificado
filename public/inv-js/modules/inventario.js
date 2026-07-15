const InvInventario = {
    allItems: [],
    autonomiaData: [],

    async render() {
        const page = document.querySelector('.page.active');
        page.innerHTML = '<div class="empty-state"><p>Cargando...</p></div>';
        try {
            const [items, tiposCristal, espesores, autonomia] = await Promise.all([
                api.inv().getInventario(), 
                api.inv().getTiposCristal(),
                api.catalogos.getEspesores(),
                api.inv().getAutonomia()
            ]);
            this.allItems = items.sort((a, b) => {
                if (a.tipo_cristal < b.tipo_cristal) return -1;
                if (a.tipo_cristal > b.tipo_cristal) return 1;
                return a.espesor - b.espesor;
            });
            this.autonomiaData = autonomia;
            
            const alertas = autonomia.filter(a => a.estado === 'critico' || a.estado === 'sin_stock');
            
            const uniqueEspesores = [...new Set(items.map(i => i.espesor))].sort((a, b) => a - b);
            
            page.innerHTML = `
                ${alertas.length > 0 ? `
                <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:12px;">
                    <span style="font-size:24px;">⚠️</span>
                    <div>
                        <div style="font-weight:700;color:var(--danger);font-size:14px;">Alertas de Stock Crítico</div>
                        <div style="font-size:13px;color:var(--gray-600);">${alertas.length} tipo(s) con stock por debajo del mínimo: <strong>${alertas.map(a => `${a.tipo} ${a.espesor}mm`).join(', ')}</strong></div>
                    </div>
                </div>
                ` : ''}
                
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
                    <div class="card-header">Inventario Actual <span style="color:var(--gray-500); font-weight:400; font-size:13px;">(${items.length} registros)</span></div>
                    <div class="card-body" style="padding:0">
                        ${items.length === 0 ? '<div class="empty-state"><div class="icon">📦</div><p>No hay items en inventario</p></div>' : `<div class="table-responsive"><table id="invTable"><thead><tr><th>Tipo Cristal</th><th>Espesor</th><th>Ancho</th><th>Alto</th><th>Stock</th><th>m2 Stock</th><th>Autonomía</th></tr></thead><tbody id="invBody">${this.renderRows(this.allItems)}</tbody></table></div>`}
                    </div>
                </div>`;
        } catch(err) { page.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`; }
    },

    getAutonomiaInfo(tipoCristal, espesor) {
        const a = this.autonomiaData.find(x => x.tipo === tipoCristal && x.espesor === espesor);
        if (!a) return { texto: 'Sin datos', color: 'var(--gray-400)', bg: 'transparent' };
        
        if (a.estado === 'sin_stock') return { texto: 'Sin stock', color: 'var(--danger)', bg: 'rgba(239,68,68,0.08)' };
        if (a.estado === 'critico') return { texto: `${a.autonomiaMeses}m / ${a.autonomiaSemanas}sem / ${a.autonomiaDias}d`, color: 'var(--danger)', bg: 'rgba(239,68,68,0.08)' };
        if (a.estado === 'advertencia') return { texto: `${a.autonomiaMeses}m / ${a.autonomiaSemanas}sem / ${a.autonomiaDias}d`, color: 'var(--warning)', bg: 'rgba(245,158,11,0.08)' };
        if (a.estado === 'sin_datos') return { texto: 'Sin datos', color: 'var(--gray-400)', bg: 'transparent' };
        return { texto: `${a.autonomiaMeses}m / ${a.autonomiaSemanas}sem / ${a.autonomiaDias}d`, color: 'var(--success)', bg: 'rgba(34,197,94,0.08)' };
    },

    renderRows(items) {
        return items.map(i => {
            const stock = i.stock;
            const stockColor = stock > 0 ? 'var(--success)' : 'var(--danger)';
            const autoInfo = this.getAutonomiaInfo(i.tipo_cristal, i.espesor);
            return `<tr>
                <td style="font-weight:600;">${i.tipo_cristal}</td>
                <td><span style="background:#e2e8f0; color:#334155; padding:2px 10px; border-radius:12px; font-size:12px; font-weight:500;">${i.espesor}mm</span></td>
                <td>${parseInt(i.ancho)}</td>
                <td>${parseInt(i.alto)}</td>
                <td><span style="font-size:16px; font-weight:700; color:${stockColor};">${stock}</span></td>
                <td>${(i.m2_entradas - i.m2_salidas).toFixed(2)} m2</td>
                <td><span style="font-size:12px;font-weight:600;padding:3px 10px;border-radius:8px;background:${autoInfo.bg};color:${autoInfo.color};">${autoInfo.texto}</span></td>
            </tr>`;
        }).join('');
    },

    async filtrar() {
        try {
            const cristal = document.getElementById('invFilterCristal').value;
            const espesor = document.getElementById('invFilterEspesor').value;
            
            let items = await api.inv().getInventario();
            
            if (cristal) items = items.filter(i => i.tipo_cristal === cristal);
            if (espesor) items = items.filter(i => i.espesor === parseInt(espesor));
            
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
