// Escape XSS: usa los helpers del SPA (app-main.js); fallback si se carga aislado
window.escText = window.escText || function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); };
window.escAttr = window.escAttr || window.escText;

// ============================================================================
// Historial — lenguaje visual "hoja tecnica de vidrio" (ver css/inv-pro.css)
// COLOR = SIGNIFICADO: datos neutros; solo se colorea lo que exige una decision.
// ============================================================================
const InvHistorial = {
    _currentData: [],

    async render() {
        const page = document.querySelector('.page.active');
        page.innerHTML = '<div class="empty-state"><p>Cargando...</p></div>';
        try {
            // api.inv() ya lanza Error con el mensaje del body si la respuesta no es OK (401/403/500)
            const movimientos = await api.inv().getMovimientos();
            this._currentData = Array.isArray(movimientos) ? movimientos : [];

            page.innerHTML = `
                <style>
                    .inv-form-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px 10px;align-items:end}
                    .inv-form-grid>div{min-width:0;margin:0}
                    .inv-pro .invp-sutil{color:var(--invp-slate);font-weight:400}
                    @media(max-width:768px){
                        .inv-form-grid{grid-template-columns:1fr}
                    }
                </style>

                <div class="inv-pro">
                    <div class="invp-hero">
                        <div>
                            <h2>Historial</h2>
                            <p>Consulta de movimientos de inventario</p>
                        </div>
                        <div class="invp-hero-actions">
                            <input class="invp-search" type="text" id="hBuscar" placeholder="Buscar cristal o espesor…" oninput="InvHistorial.filtrar()">
                        </div>
                    </div>

                    <div class="invp-card" style="margin-bottom:12px">
                        <div class="invp-card-head">
                            <h3>Filtros</h3>
                        </div>
                        <form onsubmit="InvHistorial.buscar(event)" style="padding:14px 22px 18px">
                            <div class="inv-form-grid">
                                <div class="invp-field"><label>Fecha inicio</label><input type="date" id="hFechaInicio"></div>
                                <div class="invp-field"><label>Fecha fin</label><input type="date" id="hFechaFin"></div>
                                <div class="invp-field"><label>Tipo</label><select id="hTipo"><option value="">Todos</option><option value="entrada">Entradas</option><option value="salida">Salidas</option></select></div>
                            </div>
                            <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end">
                                <button type="submit" class="invp-btn invp-btn-primary">Buscar</button>
                                <button type="button" class="invp-btn" onclick="InvHistorial.limpiar()">Limpiar</button>
                            </div>
                        </form>
                    </div>

                    <div class="m-actions" style="justify-content:flex-end">
                        <button onclick="window.print()" class="invp-btn">Imprimir</button>
                        <button onclick="InvHistorial.exportarExcel()" class="invp-btn invp-btn-primary">Exportar Excel</button>
                    </div>

                    <div class="invp-card">
                        <div class="invp-card-head">
                            <h3>Movimientos</h3>
                            <span class="invp-count" id="hCount">(${this._currentData.length})</span>
                        </div>
                        <div id="hContent"></div>
                    </div>
                </div>`;

            this.renderContent();
        } catch(err) {
            // Fallo de API visible y claro (no estado vacío)
            App.toast('Error al cargar movimientos: ' + err.message, 'error');
            page.innerHTML = '<div class="inv-pro"><div class="alert alert-danger">Error: ' + escText(err.message) + '</div></div>';
        }
    },

    renderContent() {
        const container = document.getElementById('hContent');
        if (!container) return;

        if (this._currentData.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:48px 20px"><h4 style="margin:0 0 4px;color:var(--invp-ink);font-size:15px">No hay movimientos</h4><p style="margin:0;color:var(--invp-muted);font-size:13px">Los movimientos aparecen aquí al registrar entradas o salidas.</p></div>';
            return;
        }

        // Tabla desktop
        var canDel = App.canDelete('inv_inventario');
        var canEdit = App.canEdit('inv_inventario');
        let tableHtml = '<div class="m-table-wrap"><table class="invp-table" id="hTable"><thead><tr>'
            + '<th>Fecha</th><th>Hora</th><th>Tipo</th><th>Código</th><th>Cristal</th><th class="num">Espesor</th><th>Medida</th><th class="num">Cantidad</th><th class="num">M²</th><th>Proveedor</th><th>Usuario</th><th>Obs</th>'
            + (canEdit || canDel ? '<th>Acciones</th>' : '')
            + '</tr></thead><tbody>';

        this._currentData.forEach(function(m) {
            var f = new Date(m.fecha_hora.replace('Z', ''));
            var hora = f.toLocaleTimeString('es-CL', {hour:'2-digit', minute:'2-digit', hour12:false});
            var acciones = '';
            if (canEdit || canDel) {
                acciones = '<td>';
                if (canEdit) acciones += '<button class="invp-btn" style="padding:5px 12px;font-size:11px;margin-right:4px" title="Editar" onclick="InvHistorial.editar(' + m.id + ')">Editar</button>';
                if (canDel) acciones += '<button class="invp-btn" style="padding:5px 12px;font-size:11px" title="Eliminar" onclick="InvHistorial.eliminar(' + m.id + ')">Eliminar</button>';
                acciones += '</td>';
            }
            // tipo_movimiento como chip de estado; tipo_salida como texto sutil
            var tipoTxt = m.tipo_movimiento === 'entrada' ? 'ENTRADA' : m.tipo_movimiento === 'salida' ? 'SALIDA' : escText(m.tipo_movimiento || '-');
            var chipCls = m.tipo_movimiento === 'entrada' ? 'ok' : 'neutro';
            var tipoHtml = '<span class="invp-chip ' + chipCls + '"><span class="dot"></span>' + tipoTxt + '</span>';
            if (m.tipo_movimiento === 'salida' && m.tipo_salida) {
                tipoHtml += '<div class="invp-sutil" style="font-size:10px;margin-top:3px">' + (m.tipo_salida === 'plancha_completa' ? 'Plancha' : m.tipo_salida === 'trozo' ? 'Trozo' : escText(m.tipo_salida)) + '</div>';
            }
            tableHtml += '<tr>'
                + '<td class="sutil invp-mono">' + f.toLocaleDateString('es-CL') + '</td>'
                + '<td class="sutil invp-mono">' + hora + '</td>'
                + '<td>' + tipoHtml + '</td>'
                + '<td class="codigo invp-mono">' + escText(m.codigo_mp || '-') + '</td>'
                + '<td class="tipo">' + escText(m.tipo_cristal || '-') + '</td>'
                + '<td class="num invp-mono sutil">' + escText(m.espesor || 0) + '<span class="invp-unidad">mm</span></td>'
                + '<td class="invp-mono sutil">' + Math.round(m.ancho || 0) + '×' + Math.round(m.alto || 0) + '<span class="invp-unidad">mm</span></td>'
                + '<td class="num invp-mono valor">' + escText(m.cantidad_planchas || 0) + '</td>'
                + '<td class="num invp-mono valor">' + Number(m.metros_cuadrados || 0).toFixed(2) + '</td>'
                + '<td class="sutil">' + escText(m.proveedor || '-') + '</td>'
                + '<td class="sutil">' + escText(m.usuario_nombre || '-') + '</td>'
                + '<td class="sutil">' + escText(m.observaciones || '-') + '</td>'
                + acciones
                + '</tr>';
        });

        tableHtml += '</tbody></table></div>';

        // Cards móvil
        let cardsHtml = '<div class="m-cards-mobile" style="display:none">';
        this._currentData.forEach(function(m) {
            var f = new Date(m.fecha_hora.replace('Z', ''));
            var hora = f.toLocaleTimeString('es-CL', {hour:'2-digit', minute:'2-digit', hour12:false});
            var tipoTxt = m.tipo_movimiento === 'entrada' ? 'ENTRADA' : m.tipo_movimiento === 'salida' ? 'SALIDA' : escText(m.tipo_movimiento || '-');
            var chipCls = m.tipo_movimiento === 'entrada' ? 'ok' : 'neutro';
            cardsHtml += '<div class="invp-mcard">'
                + '<div class="top">'
                + '<span class="cod">' + f.toLocaleDateString('es-CL') + ' · ' + hora + '</span>'
                + '<span class="invp-chip ' + chipCls + '"><span class="dot"></span>' + tipoTxt + '</span>'
                + '</div>'
                + (m.tipo_movimiento === 'salida' && m.tipo_salida ? '<div class="invp-sutil" style="font-size:10px;margin-bottom:6px">' + (m.tipo_salida === 'plancha_completa' ? 'Plancha' : m.tipo_salida === 'trozo' ? 'Trozo' : escText(m.tipo_salida)) + '</div>' : '')
                + '<div class="invp-mgrid">'
                + '<div><div class="invp-lbl">Código</div><div class="invp-val">' + escText(m.codigo_mp || '-') + '</div></div>'
                + '<div><div class="invp-lbl">Cristal</div><div class="invp-val">' + escText(m.tipo_cristal || '-') + '</div></div>'
                + '<div><div class="invp-lbl">Espesor</div><div class="invp-val">' + escText(m.espesor || 0) + ' mm</div></div>'
                + '<div><div class="invp-lbl">Medida</div><div class="invp-val">' + Math.round(m.ancho || 0) + '×' + Math.round(m.alto || 0) + '</div></div>'
                + '<div><div class="invp-lbl">Cantidad</div><div class="invp-val">' + escText(m.cantidad_planchas || 0) + '</div></div>'
                + '<div><div class="invp-lbl">M²</div><div class="invp-val">' + Number(m.metros_cuadrados || 0).toFixed(2) + '</div></div>'
                + '</div>'
                + (m.proveedor ? '<div class="invp-sutil" style="font-size:11px;margin-top:8px">Proveedor: ' + escText(m.proveedor) + '</div>' : '')
                + (m.usuario_nombre ? '<div class="invp-sutil" style="font-size:11px;margin-top:2px">Registrado por: ' + escText(m.usuario_nombre) + '</div>' : '')
                + (m.observaciones ? '<div class="invp-sutil" style="font-size:11px;margin-top:2px">Obs: ' + escText(m.observaciones) + '</div>' : '')
                + (canEdit || canDel ? '<div style="display:flex;gap:6px;margin-top:10px">'
                    + (canEdit ? '<button class="invp-btn" style="flex:1;justify-content:center;padding:7px 12px;font-size:11px" title="Editar" onclick="InvHistorial.editar(' + m.id + ')">Editar</button>' : '')
                    + (canDel ? '<button class="invp-btn" style="flex:1;justify-content:center;padding:7px 12px;font-size:11px" title="Eliminar" onclick="InvHistorial.eliminar(' + m.id + ')">Eliminar</button>' : '')
                    + '</div>' : '')
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
            container.innerHTML = '<div style="text-align:center;padding:48px 20px"><h4 style="margin:0 0 4px;color:var(--invp-ink);font-size:15px">Sin resultados</h4><p style="margin:0;color:var(--invp-muted);font-size:13px">No se encontraron movimientos con ese criterio.</p></div>';
            var count = document.getElementById('hCount');
            if (count) count.textContent = '(0)';
            return;
        }

        var count = document.getElementById('hCount');
        if (count) count.textContent = '(' + data.length + ')';

        var canDel = App.canDelete('inv_inventario');
        var canEdit = App.canEdit('inv_inventario');
        var tableHtml = '<div class="m-table-wrap"><table class="invp-table" id="hTable"><thead><tr>'
            + '<th>Fecha</th><th>Hora</th><th>Tipo</th><th>Código</th><th>Cristal</th><th class="num">Espesor</th><th>Medida</th><th class="num">Cantidad</th><th class="num">M²</th><th>Proveedor</th><th>Usuario</th><th>Obs</th>'
            + (canEdit || canDel ? '<th>Acciones</th>' : '')
            + '</tr></thead><tbody>';

        data.forEach(function(m) {
            var f = new Date(m.fecha_hora.replace('Z', ''));
            var hora = f.toLocaleTimeString('es-CL', {hour:'2-digit', minute:'2-digit', hour12:false});
            var acciones = '';
            if (canEdit || canDel) {
                acciones = '<td>';
                if (canEdit) acciones += '<button class="invp-btn" style="padding:5px 12px;font-size:11px;margin-right:4px" title="Editar" onclick="InvHistorial.editar(' + m.id + ')">Editar</button>';
                if (canDel) acciones += '<button class="invp-btn" style="padding:5px 12px;font-size:11px" title="Eliminar" onclick="InvHistorial.eliminar(' + m.id + ')">Eliminar</button>';
                acciones += '</td>';
            }
            // tipo_movimiento como chip de estado; tipo_salida como texto sutil
            var tipoTxt = m.tipo_movimiento === 'entrada' ? 'ENTRADA' : m.tipo_movimiento === 'salida' ? 'SALIDA' : escText(m.tipo_movimiento || '-');
            var chipCls = m.tipo_movimiento === 'entrada' ? 'ok' : 'neutro';
            var tipoHtml = '<span class="invp-chip ' + chipCls + '"><span class="dot"></span>' + tipoTxt + '</span>';
            if (m.tipo_movimiento === 'salida' && m.tipo_salida) {
                tipoHtml += '<div class="invp-sutil" style="font-size:10px;margin-top:3px">' + (m.tipo_salida === 'plancha_completa' ? 'Plancha' : m.tipo_salida === 'trozo' ? 'Trozo' : escText(m.tipo_salida)) + '</div>';
            }
            tableHtml += '<tr>'
                + '<td class="sutil invp-mono">' + f.toLocaleDateString('es-CL') + '</td>'
                + '<td class="sutil invp-mono">' + hora + '</td>'
                + '<td>' + tipoHtml + '</td>'
                + '<td class="codigo invp-mono">' + escText(m.codigo_mp || '-') + '</td>'
                + '<td class="tipo">' + escText(m.tipo_cristal || '-') + '</td>'
                + '<td class="num invp-mono sutil">' + escText(m.espesor || 0) + '<span class="invp-unidad">mm</span></td>'
                + '<td class="invp-mono sutil">' + Math.round(m.ancho || 0) + '×' + Math.round(m.alto || 0) + '<span class="invp-unidad">mm</span></td>'
                + '<td class="num invp-mono valor">' + escText(m.cantidad_planchas || 0) + '</td>'
                + '<td class="num invp-mono valor">' + Number(m.metros_cuadrados || 0).toFixed(2) + '</td>'
                + '<td class="sutil">' + escText(m.proveedor || '-') + '</td>'
                + '<td class="sutil">' + escText(m.usuario_nombre || '-') + '</td>'
                + '<td class="sutil">' + escText(m.observaciones || '-') + '</td>'
                + acciones
                + '</tr>';
        });

        tableHtml += '</tbody></table></div>';

        var cardsHtml = '<div class="m-cards-mobile" style="display:none">';
        data.forEach(function(m) {
            var f = new Date(m.fecha_hora.replace('Z', ''));
            var hora = f.toLocaleTimeString('es-CL', {hour:'2-digit', minute:'2-digit', hour12:false});
            var tipoTxt = m.tipo_movimiento === 'entrada' ? 'ENTRADA' : m.tipo_movimiento === 'salida' ? 'SALIDA' : escText(m.tipo_movimiento || '-');
            var chipCls = m.tipo_movimiento === 'entrada' ? 'ok' : 'neutro';
            cardsHtml += '<div class="invp-mcard">'
                + '<div class="top">'
                + '<span class="cod">' + f.toLocaleDateString('es-CL') + ' · ' + hora + '</span>'
                + '<span class="invp-chip ' + chipCls + '"><span class="dot"></span>' + tipoTxt + '</span>'
                + '</div>'
                + (m.tipo_movimiento === 'salida' && m.tipo_salida ? '<div class="invp-sutil" style="font-size:10px;margin-bottom:6px">' + (m.tipo_salida === 'plancha_completa' ? 'Plancha' : m.tipo_salida === 'trozo' ? 'Trozo' : escText(m.tipo_salida)) + '</div>' : '')
                + '<div class="invp-mgrid">'
                + '<div><div class="invp-lbl">Código</div><div class="invp-val">' + escText(m.codigo_mp || '-') + '</div></div>'
                + '<div><div class="invp-lbl">Cristal</div><div class="invp-val">' + escText(m.tipo_cristal || '-') + '</div></div>'
                + '<div><div class="invp-lbl">Espesor</div><div class="invp-val">' + escText(m.espesor || 0) + ' mm</div></div>'
                + '<div><div class="invp-lbl">Medida</div><div class="invp-val">' + Math.round(m.ancho || 0) + '×' + Math.round(m.alto || 0) + '</div></div>'
                + '<div><div class="invp-lbl">Cantidad</div><div class="invp-val">' + escText(m.cantidad_planchas || 0) + '</div></div>'
                + '<div><div class="invp-lbl">M²</div><div class="invp-val">' + Number(m.metros_cuadrados || 0).toFixed(2) + '</div></div>'
                + '</div>'
                + (m.proveedor ? '<div class="invp-sutil" style="font-size:11px;margin-top:8px">Proveedor: ' + escText(m.proveedor) + '</div>' : '')
                + (m.usuario_nombre ? '<div class="invp-sutil" style="font-size:11px;margin-top:2px">Registrado por: ' + escText(m.usuario_nombre) + '</div>' : '')
                + (m.observaciones ? '<div class="invp-sutil" style="font-size:11px;margin-top:2px">Obs: ' + escText(m.observaciones) + '</div>' : '')
                + (canEdit || canDel ? '<div style="display:flex;gap:6px;margin-top:10px">'
                    + (canEdit ? '<button class="invp-btn" style="flex:1;justify-content:center;padding:7px 12px;font-size:11px" title="Editar" onclick="InvHistorial.editar(' + m.id + ')">Editar</button>' : '')
                    + (canDel ? '<button class="invp-btn" style="flex:1;justify-content:center;padding:7px 12px;font-size:11px" title="Eliminar" onclick="InvHistorial.eliminar(' + m.id + ')">Eliminar</button>' : '')
                    + '</div>' : '')
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
        modal.innerHTML = '<div class="inv-pro" style="background:var(--invp-surface);border-radius:14px;padding:24px;max-width:560px;width:95%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3)">'
            + '<h3 style="margin:0 0 16px;font-size:16px;font-weight:600;color:var(--invp-ink)">Editar movimiento</h3>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
            + '<div class="invp-field"><label>Tipo de movimiento</label>'
            + '<select id="editTipo">'
            + '<option value="entrada"' + (m.tipo_movimiento==='entrada'?' selected':'') + '>Entrada</option><option value="salida"' + (m.tipo_movimiento==='salida'?' selected':'') + '>Salida</option></select></div>'
            + '<div class="invp-field"><label>Tipo de salida</label>'
            + '<select id="editTipoSalida">'
            + '<option value="">N/A</option><option value="plancha_completa"' + (m.tipo_salida==='plancha_completa'?' selected':'') + '>Plancha</option><option value="trozo"' + (m.tipo_salida==='trozo'?' selected':'') + '>Trozo</option></select></div>'
            + '<div class="invp-field" style="grid-column:span 2"><label>Cristal</label>'
            + '<input type="text" value="' + escAttr(m.tipo_cristal || '') + '" readonly style="background:#f8fafc;color:var(--invp-slate)"></div>'
            + '<div class="invp-field"><label>Ancho (mm)</label>'
            + '<input type="number" id="editAncho" value="' + (m.ancho || 0) + '" min="1"></div>'
            + '<div class="invp-field"><label>Alto (mm)</label>'
            + '<input type="number" id="editAlto" value="' + (m.alto || 0) + '" min="1"></div>'
            + '<div class="invp-field"><label>Cantidad</label>'
            + '<input type="number" id="editCant" value="' + (m.cantidad_planchas || 0) + '" min="1"></div>'
            + '<div class="invp-field"><label>m²</label>'
            + '<div class="invp-val" style="padding:10px 12px;background:#fbfcfe;border:1px solid var(--invp-line);border-radius:8px">' + Number(m.metros_cuadrados || 0).toFixed(2) + '</div></div>'
            + '<div class="invp-field"><label>Proveedor</label>'
            + '<input type="text" id="editProveedor" value="' + escAttr(m.proveedor || '') + '"></div>'
            + '<div class="invp-field"><label>Turno</label>'
            + '<select id="editTurno">'
            + '<option value="">Seleccionar...</option><option value="Dia"' + (m.turno==='Dia'?' selected':'') + '>Dia</option><option value="Noche"' + (m.turno==='Noche'?' selected':'') + '>Noche</option></select></div>'
            + '<div class="invp-field" style="grid-column:span 2"><label>Fecha</label>'
            + '<input type="date" id="editFecha" value="' + fechaVal + '"></div>'
            + '<div class="invp-field" style="grid-column:span 2"><label>Observaciones</label>'
            + '<input type="text" id="editObs" value="' + escAttr(m.observaciones || '') + '"></div>'
            + '</div>'
            + '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;padding-top:12px;border-top:1px solid var(--invp-line)">'
            + '<button class="invp-btn" onclick="InvHistorial.cerrarModal()">Cancelar</button>'
            + '<button class="invp-btn invp-btn-primary" onclick="InvHistorial.guardarEdicion(' + m.id + ')">Guardar</button>'
            + '</div></div>';
        document.body.appendChild(modal);
    },

    cerrarModal() {
        var m = document.getElementById('modalEditarMov');
        if (m) m.remove();
    },

    async guardarEdicion(id) {
        // Conservar la hora original del movimiento: solo se cambia la parte de fecha
        var horaParte = '00:00:00';
        var orig = this._currentData.find(function(x) { return x.id === id; });
        if (orig && orig.fecha_hora) {
            var fo = new Date(String(orig.fecha_hora).replace('Z', ''));
            if (!isNaN(fo.getTime())) {
                horaParte = String(fo.getHours()).padStart(2, '0') + ':' + String(fo.getMinutes()).padStart(2, '0') + ':' + String(fo.getSeconds()).padStart(2, '0');
            }
        }
        var data = {
            tipo_movimiento: document.getElementById('editTipo').value,
            tipo_salida: document.getElementById('editTipoSalida').value || null,
            ancho: parseInt(document.getElementById('editAncho').value) || 0,
            alto: parseInt(document.getElementById('editAlto').value) || 0,
            cantidad_planchas: parseInt(document.getElementById('editCant').value) || 0,
            proveedor: document.getElementById('editProveedor').value || null,
            turno: document.getElementById('editTurno').value || null,
            observaciones: document.getElementById('editObs').value || null,
            fecha_hora: document.getElementById('editFecha').value ? document.getElementById('editFecha').value + 'T' + horaParte : null
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
