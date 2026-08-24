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
            const mpData = await fetch('/api/inv/materias-primas', { headers: hdrs }).then(r => r.json()).catch(() => []);
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
                                    <div class="form-group"><label>Turno *</label><select id="turno" required><option value="">Seleccionar...</option><option value="Dia">Dia</option><option value="Noche">Noche</option></select></div>
                                    <div class="form-group"><label>Fecha</label><input type="date" id="fecha"></div>
                                </div>
                                <div style="margin-top:10px">
                                    <label style="font-size:11px;margin-bottom:4px;display:block;font-weight:600;color:#64748b">Proveedor</label>
                                    <input type="text" id="proveedor" placeholder="Opcional" style="width:100%;padding:8px 10px;font-size:13px;border:1px solid #e2e8f0;border-radius:6px;box-sizing:border-box">
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
                </div>`;
        } catch(err) { page.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`; }
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
                    `<option value="${i}">${d.ancho} x ${d.alto} mm</option>`
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

        const user = (() => { try { return JSON.parse(localStorage.getItem('unified_user')); } catch { return null; } })();
        const now = new Date();
        const fechaLocal = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0') + 'T' + String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0') + ':' + String(now.getSeconds()).padStart(2,'0');
        const fechaSeleccionada = document.getElementById('fecha').value;
        const fechaHora = fechaSeleccionada ? fechaSeleccionada + 'T' + String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0') + ':' + String(now.getSeconds()).padStart(2,'0') : fechaLocal;
        const data = {
            usuario_id: user ? user.id : null,
            tipo_movimiento: this.tipoMovimiento,
            materia_prima_id: parseInt(materiaPrimaId),
            ancho: parseInt(document.getElementById('ancho').value) || 0,
            alto: parseInt(document.getElementById('alto').value) || 0,
            cantidad_planchas: parseInt(document.getElementById('cantidadPlanchas').value) || 0,
            proveedor: document.getElementById('proveedor').value || null,
            turno: document.getElementById('turno').value || null,
            tipo_salida: this.tipoMovimiento === 'salida' ? this.tipoSalida : null,
            observaciones: document.getElementById('observaciones').value || null,
            fecha_hora: fechaHora
        };
        try {
            await api.inv().crearMovimiento(data);
            App.toast('Movimiento registrado');
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
