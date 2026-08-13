const InvHistorial = {
    async render() {
        const page = document.querySelector('.page.active');
        page.innerHTML = '<div class="empty-state"><p>Cargando...</p></div>';
        try {
            const movimientos = await api.inv().getMovimientos();
            page.innerHTML = `
                <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:8px 16px;margin-bottom:24px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">
<div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
<div style="position:relative;z-index:1"><h2 style="margin:0;font-size:15px;font-weight:800;color:white;letter-spacing:-0.5px">Historial</h2>
<p style="margin:4px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Consultar movimientos de inventario</p></div></div>
                <style>
@keyframes invHist_fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.invHist-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}
.invHist-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important;transform:translateY(-3px)}
.invHist-row{transition:all 0.2s}
.invHist-row:hover{transform:translateX(2px);background:#f8fafc!important}
</style>
                <div class="card invHist-card"" style="margin-bottom:20px;">
                    <div class="card invHist-card"-header">Filtros de Busqueda</div>
                    <div class="card invHist-card"-body">
                        <form onsubmit="InvHistorial.buscar(event)">
                            <div class="form-row">
                                <div class="form-group"><label>Fecha Inicio</label><input type="date" id="hFechaInicio" class="form-control"></div>
                                <div class="form-group"><label>Fecha Fin</label><input type="date" id="hFechaFin" class="form-control"></div>
                            </div>
                            <div class="form-row">
                                <div class="form-group"><label>Tipo</label><select id="hTipo" class="form-control"><option value="">Todos</option><option value="entrada">Entradas</option><option value="salida">Salidas</option></select></div>
                                <div class="form-group" style="display:flex; align-items:flex-end; gap:8px;"><button type="submit" class="btn btn-primary" title="Buscar">Buscar</button><button type="button" class="btn btn-outline" title="Limpiar filtros" onclick="InvHistorial.limpiar()">Limpiar</button></div>
                            </div>
                        </form>
                    </div>
                </div>
                <div style="display:flex; gap:8px; margin-bottom:14px; justify-content:flex-end;">
                    <button onclick="InvHistorial.exportarExcel()" title="Exportar Excel" class="btn btn-success btn-sm">Exportar Excel</button>
                    <button onclick="window.print()" title="Imprimir" class="btn btn-outline btn-sm">Imprimir</button>
                </div>
                <div class="card invHist-card">
                    <div class="card-header">Historial <span id="hCount" style="color:var(--gray-500); font-weight:400; font-size:13px;">(${movimientos.length})</span></div>
                    <div class="card-body">
                        ${movimientos.length === 0 ? '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">No hay movimientos</h4><p style="margin:0;color:#94a3b8;font-size:13px">Registra el primer movimiento</p></div>' : `<div class="table-responsive"><div class="sigma-table-wrap"><table id="hTable"><thead><tr><th>Fecha</th><th>Hora</th><th>Tipo</th><th>Cristal</th><th>Espesor</th><th>Dimensiones</th><th>Cantidad</th><th>m2</th><th>Proveedor</th><th>Obs</th></tr></thead><tbody id="hBody">${this.renderRows(movimientos)}</tbody></table></div><div id="hCards"></div>`}
                    </div>
                </div>`;
        } catch(err) { page.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`; }
    },
    renderRows(movs) {
        return movs.map(m => { const f = new Date(m.fecha_hora); return `<tr><td>${f.toLocaleDateString('es-CL')}</td><td>${f.toLocaleTimeString('es-CL', {hour:'2-digit', minute:'2-digit'})}</td><td><span class="badge ${m.tipo_movimiento === 'entrada' ? 'badge-entrada' : 'badge-salida'}">${m.tipo_movimiento}</span></td><td>${m.tipo_cristal}</td><td>${m.espesor}mm</td><td>${m.ancho} x ${m.alto} mm</td><td>${m.cantidad_planchas}</td><td>${Number(m.metros_cuadrados).toFixed(2)}</td><td>${m.proveedor || '-'}</td><td>${m.observaciones || '-'}</td></tr>`; }).join('');
        this.renderCards(movs);
    },
    renderCards(movs) {
        const cardsEl = document.getElementById('hCards');
        if (!cardsEl || typeof SigmaCards === 'undefined') return;
        cardsEl.innerHTML = SigmaCards.generate({
            title: m => '<strong>' + m.tipo_cristal + ' ' + m.espesor + 'mm</strong>',
            subtitle: m => m.ancho + ' x ' + m.alto + ' mm',
            badge: m => '<span class="sc-badge" style="background:' + (m.tipo_movimiento === 'entrada' ? '#d1fae5;color:#059669' : '#fee2e2;color:#dc2626') + '">' + m.tipo_movimiento + '</span>',
            fields: [
                { label: 'Fecha', value: m => new Date(m.fecha_hora).toLocaleDateString('es-CL') },
                { label: 'Hora', value: m => new Date(m.fecha_hora).toLocaleTimeString('es-CL', {hour:'2-digit', minute:'2-digit'}) },
                { label: 'Cantidad', value: m => m.cantidad_planchas + ' planchas' },
                { label: 'm2', value: m => Number(m.metros_cuadrados).toFixed(2) + ' m2' },
                { label: 'Proveedor', value: m => m.proveedor || '-' },
                { label: 'Obs', value: m => m.observaciones || '-' }
            ]
        }, movs);
    },
    async buscar(e) {
        e.preventDefault();
        const f = {};
        const fi = document.getElementById('hFechaInicio').value;
        const ff = document.getElementById('hFechaFin').value;
        const t = document.getElementById('hTipo').value;
        if (fi) f.fechaInicio = fi;
        if (ff) f.fechaFin = ff;
        if (t) f.tipo = t;
        try {
            const movs = await api.inv().getMovimientos(f);
            const tbody = document.getElementById('hBody');
            const count = document.getElementById('hCount');
            if (tbody) tbody.innerHTML = this.renderRows(movs);
            if (count) count.textContent = `(${movs.length})`;
            this.renderCards(movs);
        } catch(err) { App.toast('Error: ' + err.message, 'error'); }
    },
    limpiar() {
        document.getElementById('hFechaInicio').value = '';
        document.getElementById('hFechaFin').value = '';
        document.getElementById('hTipo').value = '';
        this.render();
    },
    exportarExcel() {
        const table = document.getElementById('hTable');
        if (!table) return;
        const csv = Array.from(table.querySelectorAll('tr')).map(row => Array.from(row.querySelectorAll('th, td')).map(c => c.textContent.trim()).join(';')).join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'historial_' + new Date().toISOString().slice(0, 10) + '.csv';
        link.click();
        App.toast('Excel exportado');
    }
};
