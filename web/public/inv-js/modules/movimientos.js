const InvMovimientos = {
    tipoMovimiento: '',
    tipoSalida: '',
    _allMovimientos: [],
    _materiasPrimas: [],

    async render() {
        const page = document.querySelector('.page.active');
        page.innerHTML = '<div class="empty-state"><p>Cargando...</p></div>';
        try {
            const hdrs = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const [movimientos, mpData] = await Promise.all([
                api.inv().getMovimientos(),
                fetch('/api/produccion/materias-primas', { headers: hdrs }).then(r => r.json()).catch(() => [])
            ]);
            this._allMovimientos = Array.isArray(movimientos) ? movimientos : [];
            this._materiasPrimas = Array.isArray(mpData) ? mpData : [];
            const mpOptions = this._materiasPrimas.map(mp => `<option value="${mp.id}" data-ancho="${mp.ancho_nal || 0}" data-alto="${mp.alto_nal || 0}" data-espesor="${mp.espesor_mm || 0}">${mp.codigo_mp} - ${mp.nombre} (${mp.espesor_mm}mm)</option>`).join('');

            page.innerHTML = `
                <style>
                    .inv-form-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px 14px;align-items:end}
                    .inv-form-dims{display:grid;grid-template-columns:repeat(4,1fr);gap:10px 14px;align-items:end}
                    .inv-form-grid>div,.inv-form-dims>div{min-width:0}
                    .inv-form-grid input,.inv-form-grid select,.inv-form-dims input,.inv-form-dims select{width:100%;box-sizing:border-box}
                    .inv-form-grid label,.inv-form-dims label{font-size:11px;margin-bottom:4px;display:block;font-weight:600;color:#64748b}
                    .inv-form-grid input,.inv-form-grid select,.inv-form-dims input,.inv-form-dims select{padding:8px 10px;font-size:13px;border:1px solid #e2e8f0;border-radius:6px}
                    .inv-form-bottom{display:flex;gap:10px;margin-top:12px;align-items:end;padding-top:10px;border-top:1px solid #f1f5f9}
                    .tipo-btn{border:1px solid #e2e8f0;border-radius:6px;background:white;cursor:pointer;transition:all 0.15s}
                    .tipo-btn:hover{background:#f8fafc}
                    .tipo-btn.active{background:#dcfce7;color:#166534;border-color:#22c55e}
                    .inv-filter-btn{padding:6px 14px;font-size:11px;font-weight:600;border-radius:8px;border:1px solid #e2e8f0;background:white;color:#64748b;cursor:pointer;transition:all 0.15s}
                    .inv-filter-btn:hover{border-color:#93c5fd;color:#3b82f6;background:#eff6ff}
                    .inv-filter-btn.active{background:linear-gradient(135deg,#1e40af,#2563eb);color:white;border-color:#1e40af;box-shadow:0 2px 8px rgba(30,64,175,0.3)}
                    @media(max-width:768px){
                        .inv-form-grid{grid-template-columns:1fr}
                        .inv-form-dims{grid-template-columns:1fr 1fr}
                        .inv-form-bottom{flex-direction:column}
                        .inv-form-bottom .btn{width:100%}
                    }
                </style>

                <div class="m-page">
                    <div class="m-hero" style="padding:10px 14px">
                        <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
                        <div style="position:relative;z-index:1">
                            <h2 style="margin:0;font-size:14px;font-weight:800;color:white">Movimientos</h2>
                            <p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Registrar entradas y salidas de inventario</p>
                        </div>
                    </div>

                    <div class="m-card" style="margin-bottom:16px">
                        <div class="m-card-header" style="padding:10px 16px;font-size:13px;font-weight:600">Nuevo Movimiento</div>
                        <div class="m-card-body" style="padding:14px 16px">
                            <form onsubmit="InvMovimientos.guardar(event)">
                                <div class="inv-form-grid">
                                    <div class="form-group"><label>Tipo Movimiento *</label>
                                        <div style="display:flex;gap:6px">
                                            <label class="tipo-btn" id="btnEntrada" onclick="InvMovimientos.setTipo('entrada')" style="flex:1;text-align:center;padding:8px;font-size:12px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Entrada</label>
                                            <label class="tipo-btn" id="btnSalida" onclick="InvMovimientos.setTipo('salida')" style="flex:1;text-align:center;padding:8px;font-size:12px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="5" y1="12" x2="19" y2="12"/></svg> Salida</label>
                                        </div>
                                    </div>
                                    <div class="form-group"><label>Materia Prima *</label>
                                        <select id="materiaPrimaId" class="form-control" required onchange="InvMovimientos.onMpChange()">
                                            <option value="">Seleccionar...</option>${mpOptions}
                                        </select>
                                    </div>
                                    <div class="form-group" id="tipoSalidaGroup" style="display:none"><label>Tipo Salida</label>
                                        <div style="display:flex;gap:6px">
                                            <label class="tipo-btn" id="btnPlancha" onclick="InvMovimientos.setTipoSalida('plancha_completa')" style="flex:1;text-align:center;padding:6px;font-size:11px">Plancha</label>
                                            <label class="tipo-btn" id="btnTrozo" onclick="InvMovimientos.setTipoSalida('trozo')" style="flex:1;text-align:center;padding:6px;font-size:11px">Trozo</label>
                                        </div>
                                    </div>
                                </div>
                                <div class="inv-form-dims" style="margin-top:10px">
                                    <div class="form-group"><label>Ancho (mm) *</label><input type="number" id="ancho" placeholder="2000" required min="1" oninput="InvMovimientos.calcM2()"></div>
                                    <div class="form-group"><label>Alto (mm) *</label><input type="number" id="alto" placeholder="1500" required min="1" oninput="InvMovimientos.calcM2()"></div>
                                    <div class="form-group"><label>Cantidad *</label><input type="number" id="cantidadPlanchas" placeholder="5" required min="1" oninput="InvMovimientos.calcM2()"></div>
                                    <div class="form-group"><label>m²</label><div id="m2Display" style="padding:8px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:16px;font-weight:700;color:#2563eb">0.00</div></div>
                                </div>
                                <div class="inv-form-grid" style="margin-top:10px">
                                    <div class="form-group"><label>Proveedor</label><input type="text" id="proveedor" placeholder="Opcional"></div>
                                    <div class="form-group"><label>Turno *</label><select id="turno" required><option value="">Seleccionar...</option><option value="Dia">Dia</option><option value="Noche">Noche</option></select></div>
                                    <div class="form-group"><label>Fecha</label><input type="date" id="fecha"></div>
                                </div>
                                <div style="margin-top:10px">
                                    <label style="font-size:11px;margin-bottom:4px;display:block;font-weight:600;color:#64748b">Observaciones</label>
                                    <input type="text" id="observaciones" placeholder="Notas..." style="width:100%;padding:8px 10px;font-size:13px;border:1px solid #e2e8f0;border-radius:6px;box-sizing:border-box">
                                </div>
                                <div class="inv-form-bottom">
                                    <button type="submit" class="btn btn-primary" style="padding:10px 28px;font-size:13px">Registrar</button>
                                </div>
                            </form>
                        </div>
                    </div>

                    <div class="m-actions" style="justify-content:space-between">
                        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                            <button class="btn btn-sm inv-filter-btn active" onclick="InvMovimientos.filtrar('')" id="fAll">Todos</button>
                            <button class="btn btn-sm inv-filter-btn" onclick="InvMovimientos.filtrar('entrada')" id="fEnt">Entradas</button>
                            <button class="btn btn-sm inv-filter-btn" onclick="InvMovimientos.filtrar('salida')" id="fSal">Salidas</button>
                        </div>
                        <button onclick="InvMovimientos.limpiarTodos()" class="btn btn-danger btn-sm" style="font-size:11px;padding:5px 12px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Limpiar Todo</button>
                    </div>

                    <div class="m-card">
                        <div class="m-card-header">
                            <h3 style="margin:0;font-size:15px;font-weight:700;color:#1e293b">Movimientos <span id="invMovCount" style="color:var(--gray-500);font-weight:400;font-size:13px">(${this._allMovimientos.length})</span></h3>
                        </div>
                        <div class="m-card-body" id="invMovContent"></div>
                    </div>
                </div>`;

            this.renderContent();
        } catch(err) { page.innerHTML = '<div class="alert alert-danger">Error: ' + err.message + '</div>'; }
    },

    renderContent() {
        const container = document.getElementById('invMovContent');
        if (!container) return;

        if (this._allMovimientos.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">No hay movimientos</h4><p style="margin:0;color:#94a3b8;font-size:13px">Registra el primer movimiento</p></div>';
            return;
        }

        // Tabla desktop
        let tableHtml = '<div class="m-table-wrap"><table><thead><tr>'
            + '<th>Fecha</th><th>Tipo</th><th>Codigo</th><th>Cristal</th><th>Espesor</th><th>Dimensiones</th><th>Cantidad</th><th>m2</th><th>Proveedor</th><th>Turno</th><th>Acciones</th>'
            + '</tr></thead><tbody>';

        this._allMovimientos.forEach(function(m) {
            var f = new Date(m.fecha_hora);
            var badge = '<span class="badge ' + (m.tipo_movimiento === 'entrada' ? 'badge-entrada' : 'badge-salida') + '">' + m.tipo_movimiento + '</span>';
            if (m.tipo_salida) badge += '<span class="badge badge-trozo" style="margin-left:4px">' + (m.tipo_salida === 'trozo' ? 'Trozo' : 'Plancha') + '</span>';
            tableHtml += '<tr>'
                + '<td>' + f.toLocaleDateString('es-CL') + '</td>'
                + '<td>' + badge + '</td>'
                + '<td>' + (m.codigo_mp || '-') + '</td>'
                + '<td>' + (m.mp_nombre || m.tipo_cristal || '-') + '</td>'
                + '<td>' + (m.espesor_mm || m.espesor || 0) + 'mm</td>'
                + '<td>' + (m.ancho || 0) + ' x ' + (m.alto || 0) + ' mm</td>'
                + '<td>' + (m.cantidad_planchas || 0) + '</td>'
                + '<td>' + Number(m.metros_cuadrados || 0).toFixed(2) + '</td>'
                + '<td>' + (m.proveedor || '-') + '</td>'
                + '<td>' + (m.turno || '-') + '</td>'
                + '<td><button class="btn btn-danger btn-sm" title="Eliminar" onclick="InvMovimientos.eliminar(' + m.id + ')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></td>'
                + '</tr>';
        });

        tableHtml += '</tbody></table></div>';

        // Cards móvil
        let cardsHtml = '<div class="m-cards-mobile" style="display:none">';
        this._allMovimientos.forEach(function(m) {
            var f = new Date(m.fecha_hora);
            var color = m.tipo_movimiento === 'entrada' ? '#22c55e' : '#ef4444';
            cardsHtml += '<div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,0.04);border-left:4px solid ' + color + '">'
                + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
                + '<span style="font-family:JetBrains Mono,monospace;font-size:12px;font-weight:600;color:#1e293b">' + f.toLocaleDateString('es-CL') + '</span>'
                + '<span class="badge ' + (m.tipo_movimiento === 'entrada' ? 'badge-entrada' : 'badge-salida') + '">' + m.tipo_movimiento + '</span>'
                + '</div>'
                + '<div style="font-weight:700;color:#0f172a;font-size:14px;margin-bottom:4px">' + (m.mp_nombre || m.tipo_cristal || '-') + ' ' + (m.espesor_mm || m.espesor || 0) + 'mm</div>'
                + '<div style="font-size:12px;color:#475569">' + (m.ancho || 0) + ' x ' + (m.alto || 0) + ' mm</div>'
                + '<div style="display:flex;gap:16px;margin-top:8px;font-size:12px;color:#64748b">'
                + '<span>Cantidad: <strong>' + (m.cantidad_planchas || 0) + '</strong></span>'
                + '<span>m2: <strong>' + Number(m.metros_cuadrados || 0).toFixed(2) + '</strong></span>'
                + '</div>'
                + (m.proveedor ? '<div style="font-size:11px;color:#64748b;margin-top:4px">Proveedor: ' + m.proveedor + '</div>' : '')
                + (m.turno ? '<div style="font-size:11px;color:#64748b;margin-top:2px">Turno: ' + m.turno + '</div>' : '')
                + '<div style="margin-top:8px"><button class="btn btn-danger btn-sm" onclick="InvMovimientos.eliminar(' + m.id + ')">Eliminar</button></div>'
                + '</div>';
        });
        cardsHtml += '</div>';

        container.innerHTML = tableHtml + cardsHtml;
    },

    onMpChange() {
        const sel = document.getElementById('materiaPrimaId');
        if (!sel) return;
        const opt = sel.options[sel.selectedIndex];
        if (opt && opt.value) {
            const ancho = opt.dataset.ancho;
            const alto = opt.dataset.alto;
            if (ancho && parseInt(ancho) > 0) document.getElementById('ancho').value = ancho;
            if (alto && parseInt(alto) > 0) document.getElementById('alto').value = alto;
            this.calcM2();
        }
    },

    setTipo(t) {
        this.tipoMovimiento = t;
        const btnE = document.getElementById('btnEntrada');
        const btnS = document.getElementById('btnSalida');
        if (t === 'entrada') {
            btnE.style.background = '#dcfce7'; btnE.style.color = '#166534'; btnE.style.border = '1px solid #22c55e';
            btnS.style.background = ''; btnS.style.color = ''; btnS.style.border = '';
        } else if (t === 'salida') {
            btnS.style.background = '#fee2e2'; btnS.style.color = '#991b1b'; btnS.style.border = '1px solid #ef4444';
            btnE.style.background = ''; btnE.style.color = ''; btnE.style.border = '';
        } else {
            btnE.style.background = ''; btnE.style.color = ''; btnE.style.border = '';
            btnS.style.background = ''; btnS.style.color = ''; btnS.style.border = '';
        }
        document.getElementById('tipoSalidaGroup').style.display = t === 'salida' ? 'block' : 'none';
    },

    setTipoSalida(ts) {
        this.tipoSalida = ts;
        document.getElementById('btnPlancha').classList.toggle('active', ts === 'plancha_completa');
        document.getElementById('btnTrozo').classList.toggle('active', ts === 'trozo');
    },

    calcM2() {
        const a = parseInt(document.getElementById('ancho')?.value) || 0;
        const al = parseInt(document.getElementById('alto')?.value) || 0;
        const c = parseInt(document.getElementById('cantidadPlanchas')?.value) || 0;
        const m2 = (a * al * c) / 1000000;
        const el = document.getElementById('m2Display');
        if (el) el.textContent = m2.toFixed(2) + ' m2';
    },

    async guardar(e) {
        e.preventDefault();
        if (!this.tipoMovimiento) { App.toast('Selecciona tipo de movimiento', 'error'); return; }
        const materiaPrimaId = document.getElementById('materiaPrimaId').value;
        if (!materiaPrimaId) { App.toast('Selecciona una materia prima', 'error'); return; }
        const data = {
            tipo_movimiento: this.tipoMovimiento,
            materia_prima_id: parseInt(materiaPrimaId),
            ancho: parseInt(document.getElementById('ancho').value) || 0,
            alto: parseInt(document.getElementById('alto').value) || 0,
            cantidad_planchas: parseInt(document.getElementById('cantidadPlanchas').value) || 0,
            proveedor: document.getElementById('proveedor').value || null,
            turno: document.getElementById('turno').value || null,
            tipo_salida: this.tipoMovimiento === 'salida' ? this.tipoSalida : null,
            observaciones: document.getElementById('observaciones').value || null,
            fecha_hora: document.getElementById('fecha').value || new Date().toISOString()
        };
        try {
            await api.inv().crearMovimiento(data);
            App.toast('Movimiento registrado');
            this.render();
        } catch(err) { App.toast('Error: ' + err.message, 'error'); }
    },

    async filtrar(tipo) {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        if (tipo === '') document.getElementById('fAll').classList.add('active');
        else if (tipo === 'entrada') document.getElementById('fEnt').classList.add('active');
        else document.getElementById('fSal').classList.add('active');
        try {
            const hdrs = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const movs = tipo ? await api.inv().getMovimientos({ tipo }) : await api.inv().getMovimientos();
            this._allMovimientos = Array.isArray(movs) ? movs : [];
            const counter = document.getElementById('invMovCount');
            if (counter) counter.textContent = '(' + this._allMovimientos.length + ')';
            this.renderContent();
        } catch(err) { App.toast('Error: ' + err.message, 'error'); }
    },

    async eliminar(id) {
        if (!confirm('Eliminar este movimiento?')) return;
        try {
            await api.inv().eliminarMovimiento(id);
            App.toast('Movimiento eliminado');
            this.render();
        } catch(err) { App.toast('Error: ' + err.message, 'error'); }
    },

    async limpiarTodos() {
        if (!confirm('¿ELIMINAR TODOS LOS MOVIMIENTOS?\n\nEsta acción no se puede deshacer.')) return;
        if (!confirm('¿Estás SEGURO? Se perderán TODOS los datos.')) return;
        try {
            const hdrs = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const result = await fetch('/api/inv/movimientos', { method: 'DELETE', headers: hdrs }).then(r => r.json());
            if (result.ok) {
                App.toast('Se eliminaron ' + result.eliminados + ' movimientos');
                this.render();
            } else {
                App.toast('Error al limpiar movimientos', 'error');
            }
        } catch(err) { App.toast('Error: ' + err.message, 'error'); }
    }
};
