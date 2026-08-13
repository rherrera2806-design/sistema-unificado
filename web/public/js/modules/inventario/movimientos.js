const InvMovimientos = {
    tipoMovimiento: '',
    tipoSalida: '',
    allMovimientos: [],
    materiasPrimas: [],

    async render() {
        const page = document.querySelector('.page.active');
        page.innerHTML = '<div class="empty-state"><p>Cargando...</p></div>';
        try {
            const [movimientos, mpData] = await Promise.all([
                api.inv().getMovimientos(),
                fetch('/api/produccion/materias-primas').then(r => r.json()).catch(() => [])
            ]);
            this.allMovimientos = movimientos;
            this.materiasPrimas = mpData;
            const mpOptions = mpData.map(mp => `<option value="${mp.id}" data-ancho="${mp.ancho_nal || 0}" data-alto="${mp.alto_nal || 0}" data-espesor="${mp.espesor_mm || 0}">${mp.codigo_mp} - ${mp.nombre} (${mp.espesor_mm}mm)</option>`).join('');
            page.innerHTML = `
                <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:8px 16px;margin-bottom:24px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">
<div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
<div style="position:relative;z-index:1"><h2 style="margin:0;font-size:15px;font-weight:800;color:white;letter-spacing:-0.5px">Movimientos</h2>
<p style="margin:4px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Registrar entradas y salidas de inventario</p></div></div>
                <style>
@keyframes invMov_fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.invMov-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}
.invMov-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important;transform:translateY(-3px)}
.invMov-row{transition:all 0.2s}
.invMov-row:hover{transform:translateX(2px);background:#f8fafc!important}
</style>
                <div class="card invMov-card" style="margin-bottom:20px;">
                    <div class="card-header">Nuevo Movimiento</div>
                    <div class="card-body">
                        <form onsubmit="InvMovimientos.guardar(event)">
                            <div class="form-group"><label>Tipo de Movimiento *</label>
                                <div style="display:flex; gap:12px;">
                                    <label class="tipo-btn" id="btnEntrada" onclick="InvMovimientos.setTipo('entrada')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Entrada</label>
                                    <label class="tipo-btn" id="btnSalida" onclick="InvMovimientos.setTipo('salida')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="5" y1="12" x2="19" y2="12"/></svg> Salida</label>
                                </div>
                            </div>
                            <div class="form-group" id="tipoSalidaGroup" style="display:none;"><label>Tipo de Salida *</label>
                                <div style="display:flex; gap:12px;">
                                    <label class="tipo-btn" id="btnPlancha" onclick="InvMovimientos.setTipoSalida('plancha_completa')">Plancha Completa</label>
                                    <label class="tipo-btn" id="btnTrozo" onclick="InvMovimientos.setTipoSalida('trozo')">Trozo</label>
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group"><label>Materia Prima *</label>
                                    <select id="materiaPrimaId" class="form-control" required onchange="InvMovimientos.onMpChange()">
                                        <option value="">Seleccionar materia prima...</option>
                                        ${mpOptions}
                                    </select>
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group"><label>Ancho (mm) *</label><input type="number" id="ancho" class="form-control" placeholder="ej: 2000" required min="1" oninput="InvMovimientos.calcM2()"></div>
                                <div class="form-group"><label>Alto (mm) *</label><input type="number" id="alto" class="form-control" placeholder="ej: 1500" required min="1" oninput="InvMovimientos.calcM2()"></div>
                            </div>
                            <div class="form-row">
                                <div class="form-group"><label>Cantidad de Planchas *</label><input type="number" id="cantidadPlanchas" class="form-control" placeholder="ej: 5" required min="1" oninput="InvMovimientos.calcM2()"></div>
                                <div class="form-group"><label>Metros Cuadrados</label><div id="m2Display" style="padding:9px 12px; background:var(--gray-50); border:1px solid var(--gray-200); border-radius:8px; font-size:20px; font-weight:700; color:var(--primary);">0.00 m2</div></div>
                            </div>
                            <div class="form-row">
                                <div class="form-group"><label>Proveedor (opcional)</label><input type="text" id="proveedor" class="form-control" placeholder="Nombre del proveedor"></div>
                                <div class="form-group"><label>Fecha (opcional)</label><input type="date" id="fecha" class="form-control"></div>
                            </div>
                            <div class="form-group"><label>Observaciones (opcional)</label><textarea id="observaciones" class="form-control" rows="2" placeholder="Notas..."></textarea></div>
                            <button type="submit" class="btn btn-primary" style="width:100%;">Registrar Movimiento</button>
                        </form>
                    </div>
                </div>
                <div class="filters-bar">
                    <span style="font-weight:500; color:var(--gray-700); font-size:13px;">Filtrar:</span>
                    <a class="filter-chip active" onclick="InvMovimientos.filtrar('')" id="fAll">Todos</a>
                    <a class="filter-chip" onclick="InvMovimientos.filtrar('entrada')" id="fEnt">Entradas</a>
                    <a class="filter-chip" onclick="InvMovimientos.filtrar('salida')" id="fSal">Salidas</a>
                </div>
                <div class="card invMov-card">
                    <div class="card-header">Movimientos <span style="color:var(--gray-500); font-weight:400; font-size:13px;">(${movimientos.length})</span></div>
                    <div class="card-body">
                        ${movimientos.length === 0 ? '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">No hay movimientos</h4><p style="margin:0;color:#94a3b8;font-size:13px">Registra el primer movimiento</p></div>' : `<div class="table-responsive"><div class="sigma-table-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Codigo</th><th>Cristal</th><th>Espesor</th><th>Dimensiones</th><th>Cantidad</th><th>m2</th><th>Proveedor</th><th>Acciones</th></tr></thead><tbody id="invMovBody">${this.renderRows(movimientos)}</tbody></table></div><div id="invMovCards"></div>`}
                    </div>
                </div>`;
        } catch(err) { page.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`; }
    },

    renderRows(movs) {
        return movs.map(m => `<tr><td>${new Date(m.fecha_hora).toLocaleDateString('es-CL')}</td><td><span class="badge ${m.tipo_movimiento === 'entrada' ? 'badge-entrada' : 'badge-salida'}">${m.tipo_movimiento}</span>${m.tipo_salida ? `<span class="badge badge-trozo" style="margin-left:4px;">${m.tipo_salida === 'trozo' ? 'Trozo' : 'Plancha'}</span>` : ''}</td><td>${m.codigo_mp || '-'}</td><td>${m.mp_nombre || m.tipo_cristal}</td><td>${m.espesor_mm || m.espesor}mm</td><td>${m.ancho} x ${m.alto} mm</td><td>${m.cantidad_planchas}</td><td>${Number(m.metros_cuadrados).toFixed(2)}</td><td>${m.proveedor || '-'}</td><td><button class="btn btn-danger btn-sm" title="Eliminar" onclick="InvMovimientos.eliminar(${m.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></td></tr>`).join('');
        this.renderCards(movs);
    },

    renderCards(movs) {
        const cardsEl = document.getElementById('invMovCards');
        if (!cardsEl || typeof SigmaCards === 'undefined') return;
        cardsEl.innerHTML = SigmaCards.generate({
            title: m => '<strong>' + (m.codigo_mp || m.tipo_cristal) + '</strong>',
            subtitle: m => (m.mp_nombre || m.tipo_cristal) + ' ' + (m.espesor_mm || m.espesor) + 'mm',
            badge: m => '<span class="sc-badge" style="background:' + (m.tipo_movimiento === 'entrada' ? '#d1fae5;color:#059669' : '#fee2e2;color:#dc2626') + '">' + m.tipo_movimiento + '</span>',
            fields: [
                { label: 'Fecha', value: m => new Date(m.fecha_hora).toLocaleDateString('es-CL') },
                { label: 'Dimensiones', value: m => m.ancho + ' x ' + m.alto + ' mm' },
                { label: 'Cantidad', value: m => m.cantidad_planchas + ' planchas' },
                { label: 'm2', value: m => Number(m.metros_cuadrados).toFixed(2) + ' m2' },
                { label: 'Proveedor', value: m => m.proveedor || '-' }
            ],
            actions: m => '<button class="btn btn-danger btn-sm" onclick="InvMovimientos.eliminar(' + m.id + ')">Eliminar</button>'
        }, movs);
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
        document.getElementById('btnEntrada').classList.toggle('active', t === 'entrada');
        document.getElementById('btnSalida').classList.toggle('active', t === 'salida');
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
            ancho: document.getElementById('ancho').value,
            alto: document.getElementById('alto').value,
            cantidad_planchas: parseInt(document.getElementById('cantidadPlanchas').value),
            proveedor: document.getElementById('proveedor').value || null,
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
    }
};