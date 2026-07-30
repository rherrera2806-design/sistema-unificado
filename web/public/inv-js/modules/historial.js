const InvHistorial = {
    async render() {
        const page = document.querySelector('.page.active');
        page.innerHTML = '<div class="empty-state"><p>Cargando...</p></div>';
        try {
            const movimientos = await api.inv().getMovimientos();
            page.innerHTML = `
                <div class="card" style="margin-bottom:20px;">
                    <div class="card-header">Filtros de Busqueda</div>
                    <div class="card-body">
                        <form onsubmit="InvHistorial.buscar(event)">
                            <div class="form-row">
                                <div class="form-group"><label>Fecha Inicio</label><input type="date" id="hFechaInicio" class="form-control"></div>
                                <div class="form-group"><label>Fecha Fin</label><input type="date" id="hFechaFin" class="form-control"></div>
                            </div>
                            <div class="form-row">
                                <div class="form-group"><label>Tipo</label><select id="hTipo" class="form-control"><option value="">Todos</option><option value="entrada">Entradas</option><option value="salida">Salidas</option></select></div>
                                <div class="form-group" style="display:flex; align-items:flex-end; gap:8px;"><button type="submit" class="btn btn-primary">Buscar</button><button type="button" class="btn btn-outline" onclick="InvHistorial.limpiar()">Limpiar</button></div>
                            </div>
                        </form>
                    </div>
                </div>
                <div style="display:flex; gap:8px; margin-bottom:14px; justify-content:flex-end;">
                    <button onclick="InvHistorial.exportarExcel()" class="btn btn-success btn-sm">Exportar Excel</button>
                    <button onclick="window.print()" class="btn btn-outline btn-sm">Imprimir</button>
                </div>
                <div class="card">
                    <div class="card-header">Historial <span id="hCount" style="color:var(--gray-500); font-weight:400; font-size:13px;">(${movimientos.length})</span></div>
                    <div class="card-body">
                        ${movimientos.length === 0 ? '<div class="empty-state"><div class="icon">🕐</div><p>No hay movimientos</p></div>' : `<div class="table-responsive"><table id="hTable"><thead><tr><th>Fecha</th><th>Hora</th><th>Tipo</th><th>Cristal</th><th>Espesor</th><th>Dimensiones</th><th>Cantidad</th><th>m2</th><th>Proveedor</th><th>Obs</th></tr></thead><tbody id="hBody">${this.renderRows(movimientos)}</tbody></table></div>`}
                    </div>
                </div>`;
        } catch(err) { page.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`; }
    },
    renderRows(movs) {
        return movs.map(m => { const f = new Date(m.fecha_hora); return `<tr><td>${f.toLocaleDateString('es-CL')}</td><td>${f.toLocaleTimeString('es-CL', {hour:'2-digit', minute:'2-digit'})}</td><td><span class="badge ${m.tipo_movimiento === 'entrada' ? 'badge-entrada' : 'badge-salida'}">${m.tipo_movimiento}</span></td><td>${m.tipo_cristal}</td><td>${m.espesor}mm</td><td>${m.ancho} x ${m.alto} mm</td><td>${m.cantidad_planchas}</td><td>${Number(m.metros_cuadrados).toFixed(2)}</td><td>${m.proveedor || '-'}</td><td>${m.observaciones || '-'}</td></tr>`; }).join('');
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
