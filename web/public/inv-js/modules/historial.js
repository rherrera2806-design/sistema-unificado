const InvHistorial = {
    _currentData: [],

    async render() {
        const page = document.querySelector('.page.active');
        page.innerHTML = '<div class="empty-state"><p>Cargando...</p></div>';
        try {
            const hdrs = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const movimientos = await api.inv().getMovimientos();
            this._currentData = Array.isArray(movimientos) ? movimientos : [];

            page.innerHTML = `
                <style>
                    .inv-form-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px 10px;align-items:end}
                    .inv-form-grid>div{min-width:0;margin:0}
                    .inv-form-grid input,.inv-form-grid select{width:100%;box-sizing:border-box;padding:10px 12px;font-size:13px;border:1px solid #e2e8f0;border-radius:8px}
                    .inv-form-grid label{font-size:10px;margin-bottom:2px;display:block;font-weight:600;color:#64748b}
                    @media(max-width:768px){
                        .inv-form-grid{grid-template-columns:1fr}
                    }
                </style>

                <div class="m-page">
                    <div class="m-hero" style="padding:10px 14px">
                        <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
                        <div style="position:relative;z-index:1">
                            <h2 style="margin:0;font-size:14px;font-weight:800;color:white">Historial</h2>
                            <p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Consultar movimientos de inventario</p>
                        </div>
                    </div>

                    <div class="m-card" style="margin-bottom:10px">
                        <div class="m-card-header" style="padding:6px 12px;font-size:12px;font-weight:600">Filtros de Busqueda</div>
                        <div class="m-card-body" style="padding:8px 12px">
                            <form onsubmit="InvHistorial.buscar(event)">
                                <div class="inv-form-grid">
                                    <div class="form-group"><label>Fecha Inicio</label><input type="date" id="hFechaInicio"></div>
                                    <div class="form-group"><label>Fecha Fin</label><input type="date" id="hFechaFin"></div>
                                    <div class="form-group"><label>Tipo</label><select id="hTipo"><option value="">Todos</option><option value="entrada">Entradas</option><option value="salida">Salidas</option></select></div>
                                </div>
                                <div style="display:flex;gap:8px;margin-top:6px;justify-content:flex-end">
                                    <button type="submit" class="btn btn-primary" style="padding:10px 28px;font-size:13px">Buscar</button>
                                    <button type="button" class="btn btn-outline" style="padding:10px 28px;font-size:13px" onclick="InvHistorial.limpiar()">Limpiar</button>
                                </div>
                            </form>
                        </div>
                    </div>

                    <div class="m-actions">
                        <button onclick="InvHistorial.exportarExcel()" class="btn btn-success" style="padding:8px 16px;font-size:12px">Exportar Excel</button>
                        <button onclick="window.print()" class="btn btn-outline" style="padding:8px 16px;font-size:12px">Imprimir</button>
                    </div>

                    <div class="m-card">
                        <div class="m-card-header" style="padding:6px 12px">
                            <h3 style="margin:0;font-size:14px;font-weight:700;color:#1e293b">Historial <span id="hCount" style="color:var(--gray-500);font-weight:400;font-size:12px">(${this._currentData.length})</span></h3>
                        </div>
                        <div class="m-card-body" id="hContent"></div>
                    </div>
                </div>`;

            this.renderContent();
        } catch(err) { page.innerHTML = '<div class="alert alert-danger">Error: ' + err.message + '</div>'; }
    },

    renderContent() {
        const container = document.getElementById('hContent');
        if (!container) return;

        if (this._currentData.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">No hay movimientos</h4><p style="margin:0;color:#94a3b8;font-size:13px">Registra el primer movimiento</p></div>';
            return;
        }

        // Tabla desktop
        var canDel = App.canDelete('inv_inventario');
        var canEdit = App.canEdit('inv_inventario');
        let tableHtml = '<div class="m-table-wrap"><table id="hTable"><thead><tr>'
            + '<th>Fecha</th><th>Hora</th><th>Tipo</th><th>Cristal</th><th>Espesor</th><th>Dimensiones</th><th>Cantidad</th><th>m2</th><th>Proveedor</th><th>Usuario</th><th>Obs</th>'
            + (canEdit || canDel ? '<th>Acciones</th>' : '')
            + '</tr></thead><tbody>';

        this._currentData.forEach(function(m) {
            var f = new Date(m.fecha_hora.replace('Z', ''));
            var hora = f.toLocaleTimeString('es-CL', {hour:'2-digit', minute:'2-digit', hour12:false});
            var acciones = '';
            if (canEdit || canDel) {
                acciones = '<td style="white-space:nowrap">';
                if (canEdit) acciones += '<button class="btn btn-sm" style="background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;margin-right:4px" title="Editar" onclick="InvHistorial.editar(' + m.id + ')">Editar</button>';
                if (canDel) acciones += '<button class="btn btn-danger btn-sm" title="Eliminar" onclick="InvHistorial.eliminar(' + m.id + ')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>';
                acciones += '</td>';
            }
            tableHtml += '<tr>'
                + '<td>' + f.toLocaleDateString('es-CL') + '</td>'
                + '<td>' + hora + '</td>'
                + '<td><span class="badge ' + (m.tipo_movimiento === 'entrada' ? 'badge-entrada' : 'badge-salida') + '">' + m.tipo_movimiento + '</span></td>'
                + '<td>' + (m.tipo_cristal || '-') + '</td>'
                + '<td>' + (m.espesor || 0) + 'mm</td>'
                + '<td>' + Math.round(m.ancho || 0) + ' x ' + Math.round(m.alto || 0) + ' mm</td>'
                + '<td>' + (m.cantidad_planchas || 0) + '</td>'
                + '<td>' + Number(m.metros_cuadrados || 0).toFixed(2) + '</td>'
                + '<td>' + (m.proveedor || '-') + '</td>'
                + '<td>' + (m.usuario_nombre || '-') + '</td>'
                + '<td>' + (m.observaciones || '-') + '</td>'
                + acciones
                + '</tr>';
        });

        tableHtml += '</tbody></table></div>';

        // Cards móvil
        let cardsHtml = '<div class="m-cards-mobile" style="display:none">';
        this._currentData.forEach(function(m) {
            var f = new Date(m.fecha_hora.replace('Z', ''));
            var hora = f.toLocaleTimeString('es-CL', {hour:'2-digit', minute:'2-digit', hour12:false});
            var color = m.tipo_movimiento === 'entrada' ? '#22c55e' : '#ef4444';
            cardsHtml += '<div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,0.04);border-left:4px solid ' + color + '">'
                + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
                + '<span style="font-family:JetBrains Mono,monospace;font-size:12px;font-weight:600;color:#1e293b">' + f.toLocaleDateString('es-CL') + ' ' + hora + '</span>'
                + '<span class="badge ' + (m.tipo_movimiento === 'entrada' ? 'badge-entrada' : 'badge-salida') + '">' + m.tipo_movimiento + '</span>'
                + '</div>'
                + '<div style="font-weight:700;color:#0f172a;font-size:14px;margin-bottom:4px">' + (m.tipo_cristal || '-') + ' ' + (m.espesor || 0) + 'mm</div>'
                + '<div style="font-size:12px;color:#475569">' + Math.round(m.ancho || 0) + ' x ' + Math.round(m.alto || 0) + ' mm</div>'
                + '<div style="display:flex;gap:16px;margin-top:8px;font-size:12px;color:#64748b">'
                + '<span>Cantidad: <strong>' + (m.cantidad_planchas || 0) + '</strong></span>'
                + '<span>m2: <strong>' + Number(m.metros_cuadrados || 0).toFixed(2) + '</strong></span>'
                + '</div>'
                + (m.proveedor ? '<div style="font-size:11px;color:#64748b;margin-top:4px">Proveedor: ' + m.proveedor + '</div>' : '')
                + (m.usuario_nombre ? '<div style="font-size:11px;color:#64748b;margin-top:2px">Registrado por: <strong>' + m.usuario_nombre + '</strong></div>' : '')
                + (m.observaciones ? '<div style="font-size:11px;color:#64748b;margin-top:2px">Obs: ' + m.observaciones + '</div>' : '')
                + '</div>';
        });
        cardsHtml += '</div>';

        container.innerHTML = tableHtml + cardsHtml;
    },

    async buscar(e) {
        e.preventDefault();
        var f = {};
        var fi = document.getElementById('hFechaInicio').value;
        var ff = document.getElementById('hFechaFin').value;
        var t = document.getElementById('hTipo').value;
        if (fi) f.fechaInicio = fi;
        if (ff) f.fechaFin = ff;
        if (t) f.tipo = t;
        try {
            var movs = await api.inv().getMovimientos(f);
            this._currentData = Array.isArray(movs) ? movs : [];
            var count = document.getElementById('hCount');
            if (count) count.textContent = '(' + this._currentData.length + ')';
            this.renderContent();
        } catch(err) { App.toast('Error: ' + err.message, 'error'); }
    },

    limpiar() {
        document.getElementById('hFechaInicio').value = '';
        document.getElementById('hFechaFin').value = '';
        document.getElementById('hTipo').value = '';
        this.render();
    },

    exportarExcel() {
        var table = document.getElementById('hTable');
        if (!table) return;
        var csv = Array.from(table.querySelectorAll('tr')).map(function(row) {
            return Array.from(row.querySelectorAll('th, td')).map(function(c) { return c.textContent.trim(); }).join(';');
        }).join('\n');
        var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'historial_' + new Date().toISOString().slice(0, 10) + '.csv';
        link.click();
        App.toast('Excel exportado');
    },

    editar(id) {
        var m = this._currentData.find(function(x) { return x.id === id; });
        if (!m) return;
        var f = new Date(m.fecha_hora.replace('Z', ''));
        var fechaVal = f.getFullYear() + '-' + String(f.getMonth()+1).padStart(2,'0') + '-' + String(f.getDate()).padStart(2,'0');
        var modal = document.createElement('div');
        modal.id = 'modalEditarMov';
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center';
        modal.innerHTML = '<div style="background:white;border-radius:12px;padding:24px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3)">'
            + '<h3 style="margin:0 0 16px;font-size:16px;font-weight:700;color:#1e293b">Editar Movimiento</h3>'
            + '<div style="margin-bottom:12px"><label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">Proveedor</label>'
            + '<input type="text" id="editProveedor" value="' + (m.proveedor || '') + '" style="width:100%;padding:8px 10px;font-size:13px;border:1px solid #e2e8f0;border-radius:6px;box-sizing:border-box"></div>'
            + '<div style="margin-bottom:12px"><label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">Turno</label>'
            + '<select id="editTurno" style="width:100%;padding:8px 10px;font-size:13px;border:1px solid #e2e8f0;border-radius:6px">'
            + '<option value="">Seleccionar...</option><option value="Dia"' + (m.turno==='Dia'?' selected':'') + '>Dia</option><option value="Noche"' + (m.turno==='Noche'?' selected':'') + '>Noche</option></select></div>'
            + '<div style="margin-bottom:12px"><label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">Fecha</label>'
            + '<input type="date" id="editFecha" value="' + fechaVal + '" style="width:100%;padding:8px 10px;font-size:13px;border:1px solid #e2e8f0;border-radius:6px;box-sizing:border-box"></div>'
            + '<div style="margin-bottom:16px"><label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">Observaciones</label>'
            + '<input type="text" id="editObs" value="' + (m.observaciones || '') + '" style="width:100%;padding:8px 10px;font-size:13px;border:1px solid #e2e8f0;border-radius:6px;box-sizing:border-box"></div>'
            + '<div style="display:flex;gap:8px;justify-content:flex-end">'
            + '<button class="btn btn-outline" onclick="InvHistorial.cerrarModal()">Cancelar</button>'
            + '<button class="btn btn-primary" onclick="InvHistorial.guardarEdicion(' + m.id + ')">Guardar</button>'
            + '</div></div>';
        document.body.appendChild(modal);
    },

    cerrarModal() {
        var m = document.getElementById('modalEditarMov');
        if (m) m.remove();
    },

    async guardarEdicion(id) {
        var data = {
            proveedor: document.getElementById('editProveedor').value || null,
            turno: document.getElementById('editTurno').value || null,
            observaciones: document.getElementById('editObs').value || null,
            fecha_hora: document.getElementById('editFecha').value ? document.getElementById('editFecha').value + 'T00:00:00' : null
        };
        try {
            await api.inv().editarMovimiento(id, data);
            App.toast('Movimiento actualizado');
            this.cerrarModal();
            this.render();
        } catch(err) { App.toast('Error: ' + err.message, 'error'); }
    },

    async eliminar(id) {
        if (!confirm('Eliminar este movimiento?')) return;
        try {
            await api.inv().eliminarMovimiento(id);
            App.toast('Movimiento eliminado');
            this.render();
        } catch(err) { App.toast('Error: ' + err.message, 'error'); }
    }
};
