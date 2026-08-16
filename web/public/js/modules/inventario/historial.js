const InvHistorial = {
    async render() {
        const page = document.querySelector('.page.active');
        page.innerHTML = '<div class="empty-state"><p>Cargando...</p></div>';
        try {
            const hdrs = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const movimientos = await api.inv().getMovimientos();
            page.innerHTML = `
                <div class="m-page">
                    <div class="m-hero">
                        <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
                        <div style="position:relative;z-index:1">
                            <h2 style="margin:0;font-size:15px;font-weight:800;color:white;letter-spacing:-0.5px">Historial</h2>
                            <p style="margin:4px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Consultar movimientos de inventario</p>
                        </div>
                    </div>

                    <div class="m-card" style="margin-bottom:20px">
                        <div class="m-card-header">Filtros de Busqueda</div>
                        <div class="m-card-body">
                            <form onsubmit="InvHistorial.buscar(event)">
                                <div class="m-form-grid">
                                    <div class="form-group"><label>Fecha Inicio</label><input type="date" id="hFechaInicio" class="form-control"></div>
                                    <div class="form-group"><label>Fecha Fin</label><input type="date" id="hFechaFin" class="form-control"></div>
                                    <div class="form-group"><label>Tipo</label><select id="hTipo" class="form-control"><option value="">Todos</option><option value="entrada">Entradas</option><option value="salida">Salidas</option></select></div>
                                    <div class="form-group" style="display:flex;gap:8px;align-items:flex-end"><button type="submit" class="btn btn-primary">Buscar</button><button type="button" class="btn btn-outline" onclick="InvHistorial.limpiar()">Limpiar</button></div>
                                </div>
                            </form>
                        </div>
                    </div>

                    <div class="m-actions">
                        <button onclick="InvHistorial.exportarExcel()" class="btn btn-success btn-sm">Exportar Excel</button>
                        <button onclick="window.print()" class="btn btn-outline btn-sm">Imprimir</button>
                    </div>

                    <div class="m-card">
                        <div class="m-card-header">
                            <h3 style="margin:0;font-size:15px;font-weight:700;color:#1e293b">Historial <span id="hCount" style="color:var(--gray-500);font-weight:400;font-size:13px">(${movimientos.length})</span></h3>
                        </div>
                        <div class="m-card-body">
                            ${movimientos.length === 0 
                                ? '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">No hay movimientos</h4><p style="margin:0;color:#94a3b8;font-size:13px">Registra el primer movimiento</p></div>'
                                : `<div class="m-table-wrap"><table id="hTable"><thead><tr><th>Fecha</th><th>Hora</th><th>Tipo</th><th>Cristal</th><th>Espesor</th><th>Dimensiones</th><th>Cantidad</th><th>m2</th><th>Proveedor</th><th>Obs</th></tr></thead><tbody id="hBody">${this.renderRows(movimientos)}</tbody></table></div><div id="hCards" class="m-cards-mobile" style="display:none"></div>`
                            }
                        </div>
                    </div>
                </div>`;
        } catch(err) { page.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`; }
    },

    renderRows(movs) {
        const html = movs.map(m => { 
            const f = new Date(m.fecha_hora); 
            return `<tr>
                <td>${f.toLocaleDateString('es-CL')}</td>
                <td>${f.toLocaleTimeString('es-CL', {hour:'2-digit', minute:'2-digit'})}</td>
                <td><span class="badge ${m.tipo_movimiento === 'entrada' ? 'badge-entrada' : 'badge-salida'}">${m.tipo_movimiento}</span></td>
                <td>${m.tipo_cristal}</td>
                <td>${m.espesor}mm</td>
                <td>${m.ancho} x ${m.alto} mm</td>
                <td>${m.cantidad_planchas}</td>
                <td>${Number(m.metros_cuadrados).toFixed(2)}</td>
                <td>${m.proveedor || '-'}</td>
                <td>${m.observaciones || '-'}</td>
            </tr>`; 
        }).join('');
        setTimeout(() => this.renderCards(movs), 0);
        return html;
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
