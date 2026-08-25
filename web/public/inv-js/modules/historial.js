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
                        <div class="m-card-header" style="padding:6px 12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                            <h3 style="margin:0;font-size:14px;font-weight:700;color:#1e293b;flex:1;min-width:120px">Historial <span id="hCount" style="color:var(--gray-500);font-weight:400;font-size:12px">(${this._currentData.length})</span></h3>
                            <div style="position:relative">
                                <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                <input type="text" id="hBuscar" placeholder="Cristal o espesor..." oninput="InvHistorial.filtrar()" style="padding:8px 12px 8px 32px;width:100%;min-width:120px;max-width:200px;font-size:11px;border:1px solid #e2e8f0;border-radius:8px;outline:none;transition:all 0.15s;font-family:inherit" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
                            </div>
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
            + '<th>Fecha</th><th>Hora</th><th>Tipo</th><th>Código</th><th>Cristal</th><th>Espesor</th><th>Dimensiones</th><th>Cantidad</th><th>m2</th><th>Proveedor</th><th>Usuario</th><th>Obs</th>'
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
            var tipoHtml = '<span class="badge ' + (m.tipo_movimiento === 'entrada' ? 'badge-entrada' : 'badge-salida') + '">' + m.tipo_movimiento + '</span>';
            if (m.tipo_movimiento === 'salida' && m.tipo_salida) {
                tipoHtml += '<div style="font-size:9px;color:#64748b;margin-top:2px">' + (m.tipo_salida === 'plancha_completa' ? 'Plancha' : m.tipo_salida === 'trozo' ? 'Trozo' : m.tipo_salida) + '</div>';
            }
            tableHtml += '<tr>'
                + '<td>' + f.toLocaleDateString('es-CL') + '</td>'
                + '<td>' + hora + '</td>'
                + '<td>' + tipoHtml + '</td>'
                + '<td style="font-weight:600;color:#3b82f6">' + (m.codigo_mp || '-') + '</td>'
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
                + (m.tipo_movimiento === 'salida' && m.tipo_salida ? '<div style="font-size:10px;color:#64748b;margin-bottom:4px">' + (m.tipo_salida === 'plancha_completa' ? 'Plancha' : m.tipo_salida === 'trozo' ? 'Trozo' : m.tipo_salida) + '</div>' : '')
                + '<div style="font-weight:700;color:#0f172a;font-size:14px;margin-bottom:4px">' + (m.tipo_cristal || '-') + ' ' + (m.espesor || 0) + 'mm</div>'
                + (m.codigo_mp ? '<div style="font-size:11px;color:#3b82f6;font-weight:600;margin-bottom:2px">Código: ' + m.codigo_mp + '</div>' : '')
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
        var buscador = document.getElementById('hBuscar');
        if (buscador) buscador.value = '';
        this.render();
    },

    filtrar() {
        var q = (document.getElementById('hBuscar')?.value || '').toLowerCase().trim();
        if (!q) {
            this.renderContent();
            return;
        }
        var filtered = this._currentData.filter(function(m) {
            var cristal = (m.tipo_cristal || '').toLowerCase();
            var espesor = String(m.espesor || '').toLowerCase();
            return cristal.includes(q) || espesor.includes(q);
        });
        this.renderContentFiltered(filtered);
    },

    renderContentFiltered(data) {
        var container = document.getElementById('hContent');
        if (!container) return;

        if (data.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">Sin resultados</h4><p style="margin:0;color:#94a3b8;font-size:13px">No se encontraron movimientos con ese criterio</p></div>';
            var count = document.getElementById('hCount');
            if (count) count.textContent = '(0)';
            return;
        }

        var count = document.getElementById('hCount');
        if (count) count.textContent = '(' + data.length + ')';

        var canDel = App.canDelete('inv_inventario');
        var canEdit = App.canEdit('inv_inventario');
        var tableHtml = '<div class="m-table-wrap"><table id="hTable"><thead><tr>'
            + '<th>Fecha</th><th>Hora</th><th>Tipo</th><th>Código</th><th>Cristal</th><th>Espesor</th><th>Dimensiones</th><th>Cantidad</th><th>m2</th><th>Proveedor</th><th>Usuario</th><th>Obs</th>'
            + (canEdit || canDel ? '<th>Acciones</th>' : '')
            + '</tr></thead><tbody>';

        data.forEach(function(m) {
            var f = new Date(m.fecha_hora.replace('Z', ''));
            var hora = f.toLocaleTimeString('es-CL', {hour:'2-digit', minute:'2-digit', hour12:false});
            var acciones = '';
            if (canEdit || canDel) {
                acciones = '<td style="white-space:nowrap">';
                if (canEdit) acciones += '<button class="btn btn-sm" style="background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;margin-right:4px" title="Editar" onclick="InvHistorial.editar(' + m.id + ')">Editar</button>';
                if (canDel) acciones += '<button class="btn btn-danger btn-sm" title="Eliminar" onclick="InvHistorial.eliminar(' + m.id + ')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>';
                acciones += '</td>';
            }
            var tipoHtml = '<span class="badge ' + (m.tipo_movimiento === 'entrada' ? 'badge-entrada' : 'badge-salida') + '">' + m.tipo_movimiento + '</span>';
            if (m.tipo_movimiento === 'salida' && m.tipo_salida) {
                tipoHtml += '<div style="font-size:9px;color:#64748b;margin-top:2px">' + (m.tipo_salida === 'plancha_completa' ? 'Plancha' : m.tipo_salida === 'trozo' ? 'Trozo' : m.tipo_salida) + '</div>';
            }
            tableHtml += '<tr>'
                + '<td>' + f.toLocaleDateString('es-CL') + '</td>'
                + '<td>' + hora + '</td>'
                + '<td>' + tipoHtml + '</td>'
                + '<td style="font-weight:600;color:#3b82f6">' + (m.codigo_mp || '-') + '</td>'
                + '<td>' + (m.tipo_cristal || '-') + '</td>'
                + '<td>' + (m.espesor || 0) + 'mm</td>'
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

        var cardsHtml = '<div class="m-cards-mobile" style="display:none">';
        data.forEach(function(m) {
            var f = new Date(m.fecha_hora.replace('Z', ''));
            var hora = f.toLocaleTimeString('es-CL', {hour:'2-digit', minute:'2-digit', hour12:false});
            var color = m.tipo_movimiento === 'entrada' ? '#22c55e' : '#ef4444';
            cardsHtml += '<div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,0.04);border-left:4px solid ' + color + '">'
                + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
                + '<span style="font-family:JetBrains Mono,monospace;font-size:12px;font-weight:600;color:#1e293b">' + f.toLocaleDateString('es-CL') + ' ' + hora + '</span>'
                + '<span class="badge ' + (m.tipo_movimiento === 'entrada' ? 'badge-entrada' : 'badge-salida') + '">' + m.tipo_movimiento + '</span>'
                + '</div>'
                + (m.tipo_movimiento === 'salida' && m.tipo_salida ? '<div style="font-size:10px;color:#64748b;margin-bottom:4px">' + (m.tipo_salida === 'plancha_completa' ? 'Plancha' : m.tipo_salida === 'trozo' ? 'Trozo' : m.tipo_salida) + '</div>' : '')
                + '<div style="font-weight:700;color:#0f172a;font-size:14px;margin-bottom:4px">' + (m.tipo_cristal || '-') + ' ' + (m.espesor || 0) + 'mm</div>'
                + (m.codigo_mp ? '<div style="font-size:11px;color:#3b82f6;font-weight:600;margin-bottom:2px">Código: ' + m.codigo_mp + '</div>' : '')
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
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;overflow:auto';
        modal.innerHTML = '<div style="background:white;border-radius:12px;padding:24px;max-width:560px;width:95%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3)">'
            + '<h3 style="margin:0 0 16px;font-size:16px;font-weight:700;color:#1e293b">Editar Movimiento</h3>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
            + '<div><label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">Tipo Movimiento</label>'
            + '<select id="editTipo" style="width:100%;padding:8px 10px;font-size:13px;border:1px solid #e2e8f0;border-radius:6px">'
            + '<option value="entrada"' + (m.tipo_movimiento==='entrada'?' selected':'') + '>Entrada</option><option value="salida"' + (m.tipo_movimiento==='salida'?' selected':'') + '>Salida</option></select></div>'
            + '<div><label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">Tipo Salida</label>'
            + '<select id="editTipoSalida" style="width:100%;padding:8px 10px;font-size:13px;border:1px solid #e2e8f0;border-radius:6px">'
            + '<option value="">N/A</option><option value="plancha_completa"' + (m.tipo_salida==='plancha_completa'?' selected':'') + '>Plancha</option><option value="trozo"' + (m.tipo_salida==='trozo'?' selected':'') + '>Trozo</option></select></div>'
            + '<div style="grid-column:span 2"><label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">Cristal</label>'
            + '<input type="text" value="' + (m.tipo_cristal || '') + '" readonly style="width:100%;padding:8px 10px;font-size:13px;border:1px solid #e2e8f0;border-radius:6px;box-sizing:border-box;background:#f8fafc;color:#64748b"></div>'
            + '<div><label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">Ancho (mm)</label>'
            + '<input type="number" id="editAncho" value="' + (m.ancho || 0) + '" min="1" style="width:100%;padding:8px 10px;font-size:13px;border:1px solid #e2e8f0;border-radius:6px;box-sizing:border-box"></div>'
            + '<div><label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">Alto (mm)</label>'
            + '<input type="number" id="editAlto" value="' + (m.alto || 0) + '" min="1" style="width:100%;padding:8px 10px;font-size:13px;border:1px solid #e2e8f0;border-radius:6px;box-sizing:border-box"></div>'
            + '<div><label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">Cantidad</label>'
            + '<input type="number" id="editCant" value="' + (m.cantidad_planchas || 0) + '" min="1" style="width:100%;padding:8px 10px;font-size:13px;border:1px solid #e2e8f0;border-radius:6px;box-sizing:border-box"></div>'
            + '<div><label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">m²</label>'
            + '<div style="padding:8px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;font-weight:700;color:#2563eb">' + Number(m.metros_cuadrados || 0).toFixed(2) + '</div></div>'
            + '<div><label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">Proveedor</label>'
            + '<input type="text" id="editProveedor" value="' + (m.proveedor || '') + '" style="width:100%;padding:8px 10px;font-size:13px;border:1px solid #e2e8f0;border-radius:6px;box-sizing:border-box"></div>'
            + '<div><label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">Turno</label>'
            + '<select id="editTurno" style="width:100%;padding:8px 10px;font-size:13px;border:1px solid #e2e8f0;border-radius:6px">'
            + '<option value="">Seleccionar...</option><option value="Dia"' + (m.turno==='Dia'?' selected':'') + '>Dia</option><option value="Noche"' + (m.turno==='Noche'?' selected':'') + '>Noche</option></select></div>'
            + '<div style="grid-column:span 2"><label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">Fecha</label>'
            + '<input type="date" id="editFecha" value="' + fechaVal + '" style="width:100%;padding:8px 10px;font-size:13px;border:1px solid #e2e8f0;border-radius:6px;box-sizing:border-box"></div>'
            + '<div style="grid-column:span 2"><label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">Observaciones</label>'
            + '<input type="text" id="editObs" value="' + (m.observaciones || '') + '" style="width:100%;padding:8px 10px;font-size:13px;border:1px solid #e2e8f0;border-radius:6px;box-sizing:border-box"></div>'
            + '</div>'
            + '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;padding-top:12px;border-top:1px solid #f1f5f9">'
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
            tipo_movimiento: document.getElementById('editTipo').value,
            tipo_salida: document.getElementById('editTipoSalida').value || null,
            ancho: parseInt(document.getElementById('editAncho').value) || 0,
            alto: parseInt(document.getElementById('editAlto').value) || 0,
            cantidad_planchas: parseInt(document.getElementById('editCant').value) || 0,
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
