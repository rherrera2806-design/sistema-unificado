const InvMovimientos = {
    tipoMovimiento: '',
    tipoSalida: '',
    allMovimientos: [],
    materiasPrimas: [],
    stockDimensiones: [],

    async render() {
        const page = document.querySelector('.page.active');
        page.innerHTML = '<div class="empty-state"><p>Cargando...</p></div>';
        try {
            const hdrs = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const [movimientos, mpData] = await Promise.all([
                api.inv().getMovimientos(),
                fetch('/api/inv/materias-primas', { headers: hdrs }).then(r => r.json()).catch(() => [])
            ]);
            this.allMovimientos = movimientos;
            this.materiasPrimas = mpData;
            const mpOptions = mpData.map(mp => `<option value="${mp.id}" data-ancho="${mp.ancho_nal || 0}" data-alto="${mp.alto_nal || 0}" data-espesor="${mp.espesor_mm || 0}">${mp.codigo_mp} - ${mp.nombre} (${mp.espesor_mm}mm)</option>`).join('');
            page.innerHTML = `
                <style>
                    @keyframes invMov_fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
                    .invMov-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}
                    .invMov-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important}
                    .inv-form-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px 14px;align-items:end}
                    .inv-form-dims{display:grid;grid-template-columns:repeat(4,1fr);gap:10px 14px;align-items:end}
                    .inv-form-grid>div,.inv-form-dims>div{min-width:0}
                    .inv-form-grid input,.inv-form-grid select,.inv-form-dims input,.inv-form-dims select{width:100%;box-sizing:border-box}
                    .inv-form-grid label,.inv-form-dims label{font-size:11px;margin-bottom:4px;display:block;font-weight:600;color:#64748b}
                    .inv-form-grid input,.inv-form-grid select,.inv-form-dims input,.inv-form-dims select{padding:8px 10px;font-size:13px;border:1px solid #e2e8f0;border-radius:6px}
                    .inv-form-bottom{display:flex;gap:10px;margin-top:12px;align-items:end;padding-top:10px;border-top:1px solid #f1f5f9}
                    @media(max-width:768px){
                        .inv-form-grid{grid-template-columns:1fr}
                        .inv-form-dims{grid-template-columns:1fr 1fr}
                        .inv-form-bottom{flex-direction:column}
                        .inv-form-bottom .btn{width:100%}
                    }
                </style>

                <div class="m-page">
                    <div class="m-hero">
                        <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
                        <div style="position:relative;z-index:1">
                            <h2 style="margin:0;font-size:15px;font-weight:800;color:white;letter-spacing:-0.5px">Movimientos</h2>
                            <p style="margin:4px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Registrar entradas y salidas de inventario</p>
                        </div>
                    </div>

                    <div class="m-card" style="margin-bottom:16px">
                        <div class="m-card-header" style="padding:10px 16px;font-size:13px;font-weight:600">Nuevo Movimiento</div>
                        <div class="m-card-body" style="padding:14px 16px">
                            <form onsubmit="InvMovimientos.guardar(event)">
                                <div class="inv-form-grid">
                                    <div class="form-group"><label>Tipo Movimiento *</label>
                                        <div style="display:flex;gap:6px">
                                            <label class="tipo-btn" id="btnEntrada" onclick="InvMovimientos.setTipo('entrada')" style="flex:1;text-align:center;padding:8px;font-size:12px;cursor:pointer"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Entrada</label>
                                            <label class="tipo-btn" id="btnSalida" onclick="InvMovimientos.setTipo('salida')" style="flex:1;text-align:center;padding:8px;font-size:12px;cursor:pointer"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="5" y1="12" x2="19" y2="12"/></svg> Salida</label>
                                        </div>
                                    </div>
                                    <div class="form-group"><label>Materia Prima *</label>
                                        <select id="materiaPrimaId" class="form-control" required onchange="InvMovimientos.onMpChange()">
                                            <option value="">Seleccionar...</option>${mpOptions}
                                        </select>
                                    </div>
                                    <div class="form-group" id="tipoSalidaGroup" style="display:none"><label>Tipo Salida</label>
                                        <div style="display:flex;gap:6px">
                                            <label class="tipo-btn" id="btnPlancha" onclick="InvMovimientos.setTipoSalida('plancha_completa')" style="flex:1;text-align:center;padding:6px;font-size:11px;cursor:pointer">Plancha</label>
                                            <label class="tipo-btn" id="btnTrozo" onclick="InvMovimientos.setTipoSalida('trozo')" style="flex:1;text-align:center;padding:6px;font-size:11px;cursor:pointer">Trozo</label>
                                        </div>
                                    </div>
                                </div>

                                <div id="stockDimGroup" style="display:none;margin-top:10px">
                                    <div class="inv-form-dims">
                                        <div class="form-group" style="grid-column:span 2"><label>Medida disponible (stock)</label>
                                            <select id="stockDimensionSelect" class="form-control" onchange="InvMovimientos.onStockDimChange()">
                                                <option value="">Seleccionar medida...</option>
                                            </select>
                                        </div>
                                        <div class="form-group"><label>Stock</label>
                                            <div id="stockDimInfo" style="padding:8px 10px;background:#f0fdf4;border:1px solid #86efac;border-radius:6px;font-size:13px;font-weight:600;color:#166534">-</div>
                                        </div>
                                        <div class="form-group"><label>m² Unitario</label>
                                            <div id="m2UnitDisplay" style="padding:8px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;font-weight:600;color:#2563eb">-</div>
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
                            <span style="font-weight:500;color:#64748b;font-size:12px">Filtrar:</span>
                            <a class="filter-chip active" onclick="InvMovimientos.filtrar('')" id="fAll" style="font-size:11px;padding:4px 10px">Todos</a>
                            <a class="filter-chip" onclick="InvMovimientos.filtrar('entrada')" id="fEnt" style="font-size:11px;padding:4px 10px">Entradas</a>
                            <a class="filter-chip" onclick="InvMovimientos.filtrar('salida')" id="fSal" style="font-size:11px;padding:4px 10px">Salidas</a>
                        </div>
                        <button onclick="InvMovimientos.limpiarTodos()" class="btn btn-danger btn-sm" style="font-size:11px;padding:5px 12px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Limpiar Todo</button>
                    </div>

                    <div class="m-card">
                        <div class="m-card-header">
                            <h3 style="margin:0;font-size:15px;font-weight:700;color:#1e293b">Movimientos <span style="color:var(--gray-500);font-weight:400;font-size:13px">(${movimientos.length})</span></h3>
                        </div>
                        <div class="m-card-body">
                            ${movimientos.length === 0
                                ? '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">No hay movimientos</h4><p style="margin:0;color:#94a3b8;font-size:13px">Registra el primer movimiento</p></div>'
                                : `<div class="m-table-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Codigo</th><th>Cristal</th><th>Espesor</th><th>Dimensiones</th><th>Cantidad</th><th>m2</th><th>Proveedor</th><th>Turno</th><th>Acciones</th></tr></thead><tbody id="invMovBody">${this.renderRows(movimientos)}</tbody></table></div><div id="invMovCards" class="m-cards-mobile"></div>`
                            }
                        </div>
                    </div>
                </div>`;
        } catch(err) { page.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`; }
    },

    renderRows(movs) {
        return movs.map(m => `<tr><td>${new Date(m.fecha_hora).toLocaleDateString('es-CL')}</td><td><span class="badge ${m.tipo_movimiento === 'entrada' ? 'badge-entrada' : 'badge-salida'}">${m.tipo_movimiento}</span>${m.tipo_salida ? `<span class="badge badge-trozo" style="margin-left:4px;">${m.tipo_salida === 'trozo' ? 'Trozo' : 'Plancha'}</span>` : ''}</td><td>${m.codigo_mp || '-'}</td><td>${m.mp_nombre || m.tipo_cristal}</td><td>${m.espesor_mm || m.espesor}mm</td><td>${m.ancho} x ${m.alto} mm</td><td>${m.cantidad_planchas}</td><td>${Number(m.metros_cuadrados).toFixed(2)}</td><td>${m.proveedor || '-'}</td><td>${m.turno || '-'}</td><td><button class="btn btn-danger btn-sm" title="Eliminar" onclick="InvMovimientos.eliminar(${m.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></td></tr>`).join('');
    },

    renderCards(movs) {
        const cardsEl = document.getElementById('invMovCards');
        if (!cardsEl) return;
        if (movs.length === 0) { cardsEl.innerHTML = ''; return; }
        cardsEl.innerHTML = movs.map(m => {
            const isEntrada = m.tipo_movimiento === 'entrada';
            const badgeColor = isEntrada ? '#d1fae5;color:#059669' : '#fee2e2;color:#dc2626';
            return '<div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,0.04);border-left:4px solid ' + (isEntrada ? '#22c55e' : '#ef4444') + '">'
                + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
                + '<span style="font-weight:700;color:#0f172a;font-size:13px">' + (m.codigo_mp || m.tipo_cristal || '-') + '</span>'
                + '<span style="font-size:11px;font-weight:600;padding:3px 8px;border-radius:12px;background:' + badgeColor + '">' + m.tipo_movimiento + '</span></div>'
                + '<div style="font-size:13px;color:#475569;margin-bottom:4px;font-weight:500">' + (m.mp_nombre || m.tipo_cristal) + ' ' + (m.espesor_mm || m.espesor) + 'mm</div>'
                + '<div style="font-size:11px;color:#64748b;margin-bottom:6px">' + Math.round(m.ancho || 0) + ' x ' + Math.round(m.alto || 0) + ' mm</div>'
                + '<div style="display:flex;gap:16px;font-size:11px;color:#64748b">'
                + '<span>Cant: <strong>' + (m.cantidad_planchas || 0) + '</strong></span>'
                + '<span>m2: <strong>' + Number(m.metros_cuadrados || 0).toFixed(2) + '</strong></span>'
                + '<span>' + (m.proveedor || '-') + '</span>'
                + '</div></div>';
        }).join('');
    },

    onMpChange() {
        const sel = document.getElementById('materiaPrimaId');
        if (!sel) return;
        const mpId = sel.value;
        if (!mpId) return;

        if (this.tipoMovimiento === 'salida' && this.tipoSalida === 'plancha_completa') {
            this.cargarStockDimensiones(mpId);
        } else {
            const opt = sel.options[sel.selectedIndex];
            if (opt && opt.value) {
                const ancho = opt.dataset.ancho;
                const alto = opt.dataset.alto;
                if (ancho && parseInt(ancho) > 0) document.getElementById('ancho').value = ancho;
                if (alto && parseInt(alto) > 0) document.getElementById('alto').value = alto;
                this.calcM2();
            }
        }
    },

    async cargarStockDimensiones(mpId) {
        const group = document.getElementById('stockDimGroup');
        const select = document.getElementById('stockDimensionSelect');
        const info = document.getElementById('stockDimInfo');
        const m2Info = document.getElementById('m2UnitDisplay');
        try {
            const hdrs = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const res = await fetch('/api/inv/stock-por-dimension?mp_id=' + mpId, { headers: hdrs });
            this.stockDimensiones = await res.json();

            if (this.stockDimensiones.length === 0) {
                group.style.display = 'none';
                this.resetDimInputs(false);
                return;
            }

            select.innerHTML = '<option value="">Seleccionar medida...</option>' +
                this.stockDimensiones.map((d, i) =>
                    `<option value="${i}">${d.ancho} x ${d.alto} mm (${d.stock} plchas, ${d.m2_unitario} m2/u)</option>`
                ).join('');

            if (this.stockDimensiones.length === 1) {
                select.value = '0';
                this.onStockDimChange();
            } else {
                info.textContent = '-';
                m2Info.textContent = '-';
                this.resetDimInputs(true);
            }

            group.style.display = 'block';
        } catch(e) {
            group.style.display = 'none';
        }
    },

    onStockDimChange() {
        const select = document.getElementById('stockDimensionSelect');
        const info = document.getElementById('stockDimInfo');
        const m2Info = document.getElementById('m2UnitDisplay');
        const idx = select.value;

        if (idx === '') {
            info.textContent = '-';
            m2Info.textContent = '-';
            this.resetDimInputs(true);
            return;
        }

        const dim = this.stockDimensiones[parseInt(idx)];
        document.getElementById('ancho').value = dim.ancho;
        document.getElementById('alto').value = dim.alto;
        document.getElementById('ancho').readOnly = true;
        document.getElementById('alto').readOnly = true;
        info.textContent = dim.stock + ' planchas';
        m2Info.textContent = dim.m2_unitario + ' m2';
        this.calcM2();
    },

    resetDimInputs(readonly) {
        const ancho = document.getElementById('ancho');
        const alto = document.getElementById('alto');
        if (ancho) { ancho.readOnly = readonly; if (readonly) ancho.value = ''; }
        if (alto) { alto.readOnly = readonly; if (readonly) alto.value = ''; }
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
        document.getElementById('stockDimGroup').style.display = 'none';
        this.resetDimInputs(false);
        this.tipoSalida = '';
        document.getElementById('btnPlancha').classList.remove('active');
        document.getElementById('btnTrozo').classList.remove('active');
    },

    setTipoSalida(ts) {
        this.tipoSalida = ts;
        document.getElementById('btnPlancha').classList.toggle('active', ts === 'plancha_completa');
        document.getElementById('btnTrozo').classList.toggle('active', ts === 'trozo');

        const mpId = document.getElementById('materiaPrimaId').value;
        if (ts === 'plancha_completa' && mpId) {
            this.cargarStockDimensiones(mpId);
        } else {
            document.getElementById('stockDimGroup').style.display = 'none';
            this.resetDimInputs(false);
        }
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

        if (this.tipoMovimiento === 'salida' && this.tipoSalida === 'plancha_completa') {
            const sel = document.getElementById('stockDimensionSelect');
            if (!sel || sel.value === '') { App.toast('Selecciona una medida disponible', 'error'); return; }
            const dim = this.stockDimensiones[parseInt(sel.value)];
            const cant = parseInt(document.getElementById('cantidadPlanchas').value) || 0;
            if (cant > dim.stock) { App.toast('Cantidad excede stock disponible (' + dim.stock + ' planchas)', 'error'); return; }
        }

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
            const movs = tipo ? await api.inv().getMovimientos({ tipo }) : await api.inv().getMovimientos();
            this.allMovimientos = movs;
            const tbody = document.getElementById('invMovBody');
            if (tbody) tbody.innerHTML = this.renderRows(movs);
            this.renderCards(movs);
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
        if (!confirm('¿ELIMINAR TODOS LOS MOVIMIENTOS?\n\nEsta acción no se puede deshacer. Se borrarán todas las entradas y salidas registradas.')) return;
        if (!confirm('¿Estás SEGURO? Se perderán TODOS los datos de movimientos.')) return;
        try {
            const result = await fetch('/api/inv/movimientos', { method: 'DELETE' }).then(r => r.json());
            if (result.ok) {
                App.toast('Se eliminaron ' + result.eliminados + ' movimientos');
                this.render();
            } else {
                App.toast('Error al limpiar movimientos', 'error');
            }
        } catch(err) { App.toast('Error: ' + err.message, 'error'); }
    }
};
