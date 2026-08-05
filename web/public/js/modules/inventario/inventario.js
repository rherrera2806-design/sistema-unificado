const InvInventario = {
    async render() {
        const page = document.querySelector('.page.active');
        page.innerHTML = '<div class="empty-state"><p>Cargando...</p></div>';
        try {
            const [items, tiposCristal] = await Promise.all([api.inv().getInventario(), api.inv().getTiposCristal()]);
            page.innerHTML = `
                <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:8px 16px;margin-bottom:24px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">
<div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
<div style="position:relative;z-index:1"><h2 style="margin:0;font-size:15px;font-weight:800;color:white;letter-spacing:-0.5px">Inventario</h2>
<p style="margin:4px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Stock actual por tipo de cristal</p></div></div>
                <style>
@keyframes inv_fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.inv-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}
.inv-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important;transform:translateY(-3px)}
.inv-row{transition:all 0.2s}
.inv-row:hover{transform:translateX(2px);background:#f8fafc!important}
</style>
                <div class="filters-bar">
                    <span style="font-weight:500; color:var(--gray-700); font-size:13px;">Filtrar:</span>
                    <a class="filter-chip active" onclick="InvInventario.filtrar('')" id="invFAll">Todos</a>
                    ${tiposCristal.map(t => `<a class="filter-chip" onclick="InvInventario.filtrar('${t}')" id="invF_${t}">${t}</a>`).join('')}
                </div>
                <div style="display:flex; gap:8px; margin-bottom:14px; justify-content:flex-end;">
                    <button onclick="InvInventario.exportarExcel()" title="Exportar Excel" class="btn btn-success btn-sm">Exportar Excel</button>
                    <button onclick="window.print()" title="Imprimir" class="btn btn-outline btn-sm">Imprimir</button>
                </div>
                <div class="card inv-card">
                    <div class="card-header">Inventario Actual <span style="color:var(--gray-500); font-weight:400; font-size:13px;">(${items.length} tipos)</span></div>
                    <div class="card-body">
                        ${items.length === 0 ? '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">No hay items en inventario</h4><p style="margin:0;color:#94a3b8;font-size:13px">Agrega el primer item</p></div>' : `<div class="table-responsive"><table id="invTable"><thead><tr><th>Tipo Cristal</th><th>Espesor</th><th>Ancho</th><th>Alto</th><th>Entradas</th><th>Salidas</th><th>Trozos</th><th>Stock</th><th>m2 Stock</th></tr></thead><tbody id="invBody">${this.renderRows(items)}</tbody></table></div>`}
                    </div>
                </div>`;
            this.allItems = items;
        } catch(err) { page.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`; }
    },
    renderRows(items) {
        return items.map(i => `<tr><td style="font-weight:600;">${i.tipo_cristal}</td><td><span style="background:var(--primary-light); color:var(--primary); padding:2px 10px; border-radius:12px; font-size:12px;">${i.espesor}mm</span></td><td>${i.ancho}</td><td>${i.alto}</td><td style="color:var(--success); font-weight:600;">${i.entradas}</td><td style="color:var(--danger);">${i.salidas_plancha}</td><td style="color:var(--warning);">${i.trozos}</td><td><span style="font-size:18px; font-weight:700; color:${i.stock > 0 ? 'var(--success)' : 'var(--danger)'};">${i.stock}</span></td><td>${(i.m2_entradas - i.m2_salidas).toFixed(2)} m2</td></tr>`).join('');
    },
    async filtrar(cristal) {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        if (cristal === '') document.getElementById('invFAll').classList.add('active');
        else { const el = document.getElementById('invF_' + cristal); if (el) el.classList.add('active'); }
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
