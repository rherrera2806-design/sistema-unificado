// Escape XSS: usa los helpers del SPA (app-main.js); fallback si se carga aislado
window.escText = window.escText || function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); };
window.escAttr = window.escAttr || window.escText;

// ============================================================================
// Historial — lenguaje visual "hoja tecnica de vidrio" (ver css/inv-pro.css)
// COLOR = SIGNIFICADO: datos neutros; solo se colorea lo que exige una decision.
// Renderizador UNICO (antes renderContent y renderContentFiltered duplicaban
// ~120 lineas y se desincronizaban).
// ============================================================================
const InvHistorial = {
    _currentData: [],   // datos de la API (con filtros de fecha/tipo aplicados)
    _vistaActual: [],   // lo que se pinta (tras filtro de texto): es lo que se exporta
    _query: '',
    _onKeyEsc: null,
    _filtrosAbiertos: false,   // panel de filtros expandible/contráible

    async render() {
        const page = document.querySelector('.page.active');
        page.innerHTML = '<div class="empty-state"><p>Cargando...</p></div>';
        try {
            // api.inv() ya lanza Error con el mensaje del body si la respuesta no es OK (401/403/500)
            const movimientos = await api.inv().getMovimientos();
            this._currentData = Array.isArray(movimientos) ? movimientos : [];
            this._query = '';

            page.innerHTML = `
                <style>
                    .inv-form-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px 10px;align-items:end}
                    .inv-form-grid>div{min-width:0;margin:0}
                    .inv-pro .invp-sutil{color:var(--invp-slate);font-weight:400}
                    /* SALIDA se marca con punto rojo (pedido del usuario) */
                    .inv-pro .invp-chip.sal .dot{background:var(--invp-danger)}
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
                            <button onclick="window.print()" class="invp-btn">Imprimir</button>
                            <button onclick="InvHistorial.exportarExcel()" class="invp-btn invp-btn-primary">Exportar Excel</button>
                            <input class="invp-search" type="text" id="hBuscar" placeholder="Buscar código, cristal, proveedor…" oninput="InvHistorial.filtrar()">
                        </div>
                    </div>

                    <div class="invp-card" style="margin-bottom:12px">
                        <div class="invp-card-head" id="hFiltrosHead" role="button" tabindex="0" aria-expanded="${this._filtrosAbiertos}"
                            onclick="InvHistorial.toggleFiltros()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();InvHistorial.toggleFiltros()}"
                            style="cursor:pointer;user-select:none">
                            <h3>Filtros</h3>
                            <span class="invp-count" id="hFiltrosHint"></span>
                            <span style="margin-left:auto;display:flex;align-items:center">
                                <svg id="hFiltrosChevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transition:transform .2s;transform:rotate(${this._filtrosAbiertos ? 180 : 0}deg);color:var(--invp-muted)"><polyline points="6 9 12 15 18 9"/></svg>
                            </span>
                        </div>
                        <form id="hFiltrosBody" onsubmit="InvHistorial.buscar(event)" style="padding:14px 22px 18px;${this._filtrosAbiertos ? '' : 'display:none'}">
                            <div class="inv-form-grid">
                                <div class="invp-field"><label for="hFechaInicio">Fecha inicio</label><input type="date" id="hFechaInicio" onchange="InvHistorial._actualizarHintFiltros()"></div>
                                <div class="invp-field"><label for="hFechaFin">Fecha fin</label><input type="date" id="hFechaFin" onchange="InvHistorial._actualizarHintFiltros()"></div>
                                <div class="invp-field"><label for="hTipo">Tipo</label><select id="hTipo" onchange="InvHistorial._actualizarHintFiltros()"><option value="">Todos</option><option value="entrada">Entradas</option><option value="salida">Salidas</option></select></div>
                            </div>
                            <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end">
                                <button type="submit" class="invp-btn invp-btn-primary">Buscar</button>
                                <button type="button" class="invp-btn" onclick="InvHistorial.limpiar()">Limpiar</button>
                            </div>
                        </form>
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
        } catch (err) {
            // Fallo de API visible y claro (no estado vacio)
            App.toast('Error al cargar movimientos: ' + err.message, 'error');
            page.innerHTML = '<div class="inv-pro"><div class="alert alert-danger">Error: ' + escText(err.message) + '</div></div>';
        }
    },

    // ------------------------------------------------------------------
    // Renderizador único: recibe los datos a pintar (tabla + cards móvil).
    // ------------------------------------------------------------------
    renderContent(data) {
        const container = document.getElementById('hContent');
        if (!container) return;
        const datos = Array.isArray(data) ? data : this._currentData;
        this._vistaActual = datos;

        const count = document.getElementById('hCount');
        if (count) count.textContent = '(' + datos.length + ')';

        // Aviso del límite del backend (getMovimientos limita a 2000)
        let limiteHtml = '';
        if (this._currentData.length >= 2000) {
            limiteHtml = '<div class="invp-note" style="margin:12px 22px 0"><span>◇</span><span>Mostrando los <strong>últimos 2000 movimientos</strong>. Usa los filtros de fecha para ver periodos anteriores.</span></div>';
        }

        if (datos.length === 0) {
            container.innerHTML = limiteHtml + '<div style="text-align:center;padding:48px 20px"><h4 style="margin:0 0 4px;color:var(--invp-ink);font-size:15px">No hay movimientos</h4><p style="margin:0;color:var(--invp-muted);font-size:13px">Los movimientos aparecen aquí al registrar entradas o salidas.</p></div>';
            return;
        }

        // Permisos alineados con el backend: PUT/DELETE de movimientos exigen
        // inv_movimientos.editar / inv_movimientos.eliminar (antes se miraba
        // inv_inventario y los botones no correspondían con lo permitido).
        const canDel = App.canDelete('inv_movimientos');
        const canEdit = App.canEdit('inv_movimientos');

        const tipoHtml = function (m) {
            const tipoTxt = m.tipo_movimiento === 'entrada' ? 'ENTRADA' : m.tipo_movimiento === 'salida' ? 'SALIDA' : escText(m.tipo_movimiento || '-');
            // ENTRADA = punto verde · SALIDA = punto rojo (pedido del usuario)
            const chipCls = m.tipo_movimiento === 'entrada' ? 'ok' : m.tipo_movimiento === 'salida' ? 'sal' : 'neutro';
            let html = '<span class="invp-chip ' + chipCls + '"><span class="dot"></span>' + tipoTxt + '</span>';
            if (m.tipo_movimiento === 'salida' && m.tipo_salida) {
                html += '<div class="invp-sutil" style="font-size:10px;margin-top:3px">' + (m.tipo_salida === 'plancha_completa' ? 'Plancha' : m.tipo_salida === 'trozo' ? 'Trozo' : escText(m.tipo_salida)) + '</div>';
            }
            return html;
        };
        const fechaHora = function (m) {
            const f = new Date(String(m.fecha_hora).replace('Z', ''));
            return {
                fecha: f.toLocaleDateString('es-CL'),
                hora: f.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })
            };
        };

        // ---------- Tabla desktop ----------
        let tableHtml = '<div class="m-table-wrap"><table class="invp-table" id="hTable"><thead><tr>'
            + '<th>Fecha</th><th>Hora</th><th>Tipo</th><th>Código</th><th>Cristal</th><th class="num">Espesor</th><th>Medida</th><th class="num">Cantidad</th><th class="num">M²</th><th>Proveedor</th><th>Usuario</th><th>Obs</th>'
            + (canEdit || canDel ? '<th>Acciones</th>' : '')
            + '</tr></thead><tbody>';

        datos.forEach(function (m) {
            const fh = fechaHora(m);
            let acciones = '';
            if (canEdit || canDel) {
                acciones = '<td>';
                if (canEdit) acciones += '<button class="invp-btn" style="padding:5px 12px;font-size:11px;margin-right:4px" title="Editar" onclick="InvHistorial.editar(' + m.id + ')">Editar</button>';
                if (canDel) acciones += '<button class="invp-btn" style="padding:5px 12px;font-size:11px" title="Eliminar" onclick="InvHistorial.eliminar(' + m.id + ')">Eliminar</button>';
                acciones += '</td>';
            }
            tableHtml += '<tr>'
                + '<td class="sutil invp-mono">' + fh.fecha + '</td>'
                + '<td class="sutil invp-mono">' + fh.hora + '</td>'
                + '<td>' + tipoHtml(m) + '</td>'
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

        // ---------- Cards móvil ----------
        let cardsHtml = '<div class="m-cards-mobile" style="display:none">';
        datos.forEach(function (m) {
            const fh = fechaHora(m);
            cardsHtml += '<div class="invp-mcard">'
                + '<div class="top">'
                + '<span class="cod">' + fh.fecha + ' · ' + fh.hora + '</span>'
                + tipoHtml(m)
                + '</div>'
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

        container.innerHTML = limiteHtml + tableHtml + cardsHtml;
    },

    // ------------------------------------------------------------------
    // Búsqueda de texto: cubre código, cristal, espesor, medida, proveedor,
    // usuario, observaciones y tipo (antes solo cristal y espesor).
    // ------------------------------------------------------------------
    _aplicarTexto() {
        const q = this._query;
        let datos = this._currentData;
        if (q) {
            datos = datos.filter(function (m) {
                const campos = [
                    m.codigo_mp, m.tipo_cristal, m.espesor,
                    (m.ancho || '') + 'x' + (m.alto || ''),
                    m.proveedor, m.usuario_nombre, m.observaciones,
                    m.tipo_movimiento, m.tipo_salida
                ];
                return campos.some(function (c) { return String(c || '').toLowerCase().includes(q); });
            });
        }
        this.renderContent(datos);
    },

    filtrar() {
        const el = document.getElementById('hBuscar');
        this._query = (el && el.value ? el.value : '').toLowerCase().trim();
        this._aplicarTexto();
    },

    // Los filtros de fecha/tipo se COMBINAN con el texto buscado
    // (antes buscar() descartaba el filtro de texto activo).
    async buscar(e) {
        e.preventDefault();
        const fi = document.getElementById('hFechaInicio').value;
        const ff = document.getElementById('hFechaFin').value;
        const t = document.getElementById('hTipo').value;
        if (fi && ff && ff < fi) {
            App.toast('La fecha fin es anterior a la fecha de inicio', 'error');
            return;
        }
        const f = {};
        if (fi) f.fechaInicio = fi;
        if (ff) f.fechaFin = ff;
        if (t) f.tipo = t;
        try {
            const movs = await api.inv().getMovimientos(f);
            this._currentData = Array.isArray(movs) ? movs : [];
            const buscador = document.getElementById('hBuscar');
            this._query = (buscador && buscador.value ? buscador.value : '').toLowerCase().trim();
            this._aplicarTexto();
            // Contraer los filtros para mostrar los resultados
            this.toggleFiltros(false);
            this._actualizarHintFiltros();
        } catch (err) { App.toast('Error: ' + err.message, 'error'); }
    },

    limpiar() {
        document.getElementById('hFechaInicio').value = '';
        document.getElementById('hFechaFin').value = '';
        document.getElementById('hTipo').value = '';
        const buscador = document.getElementById('hBuscar');
        if (buscador) buscador.value = '';
        this._query = '';
        this.render();
    },

    // Panel de filtros expandible/contráible (estado persistente entre renders)
    toggleFiltros(abrir) {
        this._filtrosAbiertos = (typeof abrir === 'boolean') ? abrir : !this._filtrosAbiertos;
        const body = document.getElementById('hFiltrosBody');
        const chev = document.getElementById('hFiltrosChevron');
        const head = document.getElementById('hFiltrosHead');
        if (body) body.style.display = this._filtrosAbiertos ? '' : 'none';
        if (chev) chev.style.transform = 'rotate(' + (this._filtrosAbiertos ? 180 : 0) + 'deg)';
        if (head) head.setAttribute('aria-expanded', this._filtrosAbiertos ? 'true' : 'false');
    },

    _actualizarHintFiltros() {
        const hint = document.getElementById('hFiltrosHint');
        if (!hint) return;
        const activos = (document.getElementById('hFechaInicio')?.value ? 1 : 0)
            + (document.getElementById('hFechaFin')?.value ? 1 : 0)
            + (document.getElementById('hTipo')?.value ? 1 : 0);
        hint.textContent = activos > 0 ? activos + (activos === 1 ? ' filtro activo' : ' filtros activos') : '';
    },

    // Exporta los datos ACTUALMENTE visibles (sin la columna de Acciones).
    exportarExcel() {
        const datos = this._vistaActual;
        if (!datos || datos.length === 0) { App.toast('No hay movimientos para exportar', 'error'); return; }
        const cols = ['Fecha', 'Hora', 'Tipo', 'Tipo salida', 'Codigo', 'Cristal', 'Espesor (mm)', 'Medida (mm)', 'Cantidad', 'M2', 'Proveedor', 'Usuario', 'Observaciones'];
        const filas = datos.map(function (m) {
            const f = new Date(String(m.fecha_hora).replace('Z', ''));
            return [
                f.toLocaleDateString('es-CL'),
                f.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }),
                m.tipo_movimiento || '',
                m.tipo_salida || '',
                m.codigo_mp || '',
                m.tipo_cristal || '',
                m.espesor || '',
                Math.round(m.ancho || 0) + 'x' + Math.round(m.alto || 0),
                m.cantidad_planchas || 0,
                Number(m.metros_cuadrados || 0).toFixed(2),
                m.proveedor || '',
                m.usuario_nombre || '',
                m.observaciones || ''
            ].map(function (v) { return String(v).replace(/;/g, ','); }).join(';');
        });
        const csv = [cols.join(';')].concat(filas).join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'historial_' + new Date().toISOString().slice(0, 10) + '.csv';
        link.click();
        URL.revokeObjectURL(link.href);
        App.toast('Excel exportado');
    },

    // ------------------------------------------------------------------
    // Modal de edición: con campo hora (como Movimientos), sin fecha futura
    // y cierre con Escape / click fuera.
    // ------------------------------------------------------------------
    editar(id) {
        const m = this._currentData.find(function (x) { return x.id === id; });
        if (!m) return;
        const f = new Date(String(m.fecha_hora).replace('Z', ''));
        const fechaVal = f.getFullYear() + '-' + String(f.getMonth() + 1).padStart(2, '0') + '-' + String(f.getDate()).padStart(2, '0');
        const horaVal = String(f.getHours()).padStart(2, '0') + ':' + String(f.getMinutes()).padStart(2, '0');
        const hoy = new Date();
        const hoyStr = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0');

        const modal = document.createElement('div');
        modal.id = 'modalEditarMov';
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;overflow:auto';
        modal.innerHTML = '<div class="inv-pro" style="background:var(--invp-surface);border-radius:14px;padding:24px;max-width:560px;width:95%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3)">'
            + '<h3 style="margin:0 0 16px;font-size:16px;font-weight:600;color:var(--invp-ink)">Editar movimiento</h3>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
            + '<div class="invp-field"><label for="editTipo">Tipo de movimiento</label>'
            + '<select id="editTipo">'
            + '<option value="entrada"' + (m.tipo_movimiento === 'entrada' ? ' selected' : '') + '>Entrada</option><option value="salida"' + (m.tipo_movimiento === 'salida' ? ' selected' : '') + '>Salida</option></select></div>'
            + '<div class="invp-field"><label for="editTipoSalida">Tipo de salida</label>'
            + '<select id="editTipoSalida">'
            + '<option value="">N/A</option><option value="plancha_completa"' + (m.tipo_salida === 'plancha_completa' ? ' selected' : '') + '>Plancha</option><option value="trozo"' + (m.tipo_salida === 'trozo' ? ' selected' : '') + '>Trozo</option></select></div>'
            + '<div class="invp-field" style="grid-column:span 2"><label>Cristal</label>'
            + '<input type="text" value="' + escAttr(m.tipo_cristal || '') + '" readonly style="background:#f8fafc;color:var(--invp-slate)"></div>'
            + '<div class="invp-field"><label for="editAncho">Ancho (mm)</label>'
            + '<input type="number" id="editAncho" value="' + (m.ancho || 0) + '" min="1"></div>'
            + '<div class="invp-field"><label for="editAlto">Alto (mm)</label>'
            + '<input type="number" id="editAlto" value="' + (m.alto || 0) + '" min="1"></div>'
            + '<div class="invp-field"><label for="editCant">Cantidad</label>'
            + '<input type="number" id="editCant" value="' + (m.cantidad_planchas || 0) + '" min="1"></div>'
            + '<div class="invp-field"><label>M²</label>'
            + '<div class="invp-val" style="padding:10px 12px;background:#fbfcfe;border:1px solid var(--invp-line);border-radius:8px">' + Number(m.metros_cuadrados || 0).toFixed(2) + '</div></div>'
            + '<div class="invp-field"><label for="editProveedor">Proveedor</label>'
            + '<input type="text" id="editProveedor" value="' + escAttr(m.proveedor || '') + '"></div>'
            + '<div class="invp-field"><label for="editTurno">Turno</label>'
            + '<select id="editTurno">'
            + '<option value="">Seleccionar...</option><option value="Dia"' + (m.turno === 'Dia' ? ' selected' : '') + '>Dia</option><option value="Noche"' + (m.turno === 'Noche' ? ' selected' : '') + '>Noche</option></select></div>'
            + '<div class="invp-field"><label for="editFecha">Fecha</label>'
            + '<input type="date" id="editFecha" value="' + fechaVal + '" max="' + hoyStr + '"></div>'
            + '<div class="invp-field"><label for="editHora">Hora</label>'
            + '<input type="time" id="editHora" value="' + horaVal + '"></div>'
            + '<div class="invp-field" style="grid-column:span 2"><label for="editObs">Observaciones</label>'
            + '<input type="text" id="editObs" value="' + escAttr(m.observaciones || '') + '"></div>'
            + '</div>'
            + '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;padding-top:12px;border-top:1px solid var(--invp-line)">'
            + '<button class="invp-btn" onclick="InvHistorial.cerrarModal()">Cancelar</button>'
            + '<button class="invp-btn invp-btn-primary" onclick="InvHistorial.guardarEdicion(' + m.id + ')">Guardar</button>'
            + '</div></div>';
        // Cierre con click fuera del panel
        modal.addEventListener('mousedown', function (ev) {
            if (ev.target === modal) InvHistorial.cerrarModal();
        });
        document.body.appendChild(modal);

        // Cierre con Escape (se remueve al cerrar)
        this._onKeyEsc = function (ev) {
            if (ev.key === 'Escape') InvHistorial.cerrarModal();
        };
        document.addEventListener('keydown', this._onKeyEsc);
    },

    cerrarModal() {
        const m = document.getElementById('modalEditarMov');
        if (m) m.remove();
        if (this._onKeyEsc) {
            document.removeEventListener('keydown', this._onKeyEsc);
            this._onKeyEsc = null;
        }
    },

    async guardarEdicion(id) {
        // Fecha + hora explícitas del formulario (antes la hora se conservaba
        // oculta y no se podía corregir).
        const fecha = document.getElementById('editFecha').value;
        const hora = document.getElementById('editHora').value;
        const data = {
            tipo_movimiento: document.getElementById('editTipo').value,
            tipo_salida: document.getElementById('editTipoSalida').value || null,
            ancho: parseInt(document.getElementById('editAncho').value) || 0,
            alto: parseInt(document.getElementById('editAlto').value) || 0,
            cantidad_planchas: parseInt(document.getElementById('editCant').value) || 0,
            proveedor: document.getElementById('editProveedor').value || null,
            turno: document.getElementById('editTurno').value || null,
            observaciones: document.getElementById('editObs').value || null,
            fecha_hora: fecha ? (fecha + 'T' + (hora ? hora + ':00' : '00:00:00')) : null
        };
        try {
            await api.inv().editarMovimiento(id, data);
            App.toast('Movimiento actualizado');
            this.cerrarModal();
            this.render();
        } catch (err) { App.toast('Error: ' + err.message, 'error'); }
    },

    async eliminar(id) {
        const ok = await App.confirm('Eliminar este movimiento? Esta acción no se puede deshacer.');
        if (!ok) return;
        try {
            await api.inv().eliminarMovimiento(id);
            App.toast('Movimiento eliminado');
            this.render();
        } catch (err) { App.toast('Error: ' + err.message, 'error'); }
    }
};
