App.registerModule('turnos', {
    socket: null,
    interval: null,
    rActualTurno: null,
    currentView: 'menu',

    async render() {
        const el = document.getElementById('page-turnos');
        el.innerHTML = `
            <div style="padding:16px">
                <div id="turnosContent" style="max-width:700px;margin:0 auto"></div>
            </div>
        `;
        this.renderMenu();
    },

    renderMenu() {
        this.currentView = 'menu';
        this.stopPolling();
        document.getElementById('turnosContent').innerHTML = `
            <div class="page-header">
                <div>
                    <h2>Turnos QR</h2>
                    <div class="subtitle">Selecciona un modulo</div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr;gap:12px">
                <div class="stat-card" style="cursor:pointer;flex-direction:column;text-align:center;padding:20px" onclick="App.modules.turnos.showRecepcion()">
                    <div style="font-size:36px;margin-bottom:8px">&#128203;</div>
                    <h3 style="font-size:16px;font-weight:700;margin-bottom:4px">Recepcion y Control de Turnos</h3>
                    <p style="font-size:12px;color:var(--text-light)">Gestionar cola, llamar siguiente, ver historial</p>
                </div>
                <div class="stat-card" style="cursor:pointer;flex-direction:column;text-align:center;padding:20px" onclick="App.modules.turnos.showBodega()">
                    <div style="font-size:36px;margin-bottom:8px">&#128230;</div>
                    <h3 style="font-size:16px;font-weight:700;margin-bottom:4px">Entrega de Bodega</h3>
                    <p style="font-size:12px;color:var(--text-light)">Ver pendientes y marcar entregas realizadas</p>
                </div>
                <div class="stat-card" style="cursor:pointer;flex-direction:column;text-align:center;padding:20px" onclick="App.modules.turnos.showQR()">
                    <div style="font-size:36px;margin-bottom:8px">&#128186;</div>
                    <h3 style="font-size:16px;font-weight:700;margin-bottom:4px">QR Clientes</h3>
                    <p style="font-size:12px;color:var(--text-light)">Codigo QR para que los clientes tomen turno</p>
                </div>
            </div>
        `;
    },

    stopPolling() { if (this.interval) { clearInterval(this.interval); this.interval = null; } },

    fmtSec(s) { if (s == null) return '-'; const m = Math.floor(s / 60); return m > 0 ? `${m}m ${s%60}s` : `${s}s`; },
    fmtTime(t) { if (!t) return '-'; return String(t).slice(0, 8); },
    timeToSec(t) { if (!t) return 0; const p = String(t).slice(0,8).split(':').map(Number); return p[0]*3600 + p[1]*60 + (p[2]||0); },

    // ═══════ RECEPCION ═══════
    async showRecepcion() {
        this.currentView = 'recepcion';
        this.stopPolling();
        const c = document.getElementById('turnosContent');
        c.innerHTML = `
            <div class="page-header">
                <div>
                    <h2>Recepcion y Control de Turnos</h2>
                    <div class="subtitle">Gestion de cola de espera</div>
                </div>
            </div>
            <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
                <div class="stat-card"><div class="stat-icon yellow">&#127919;</div><div class="stat-info"><h4 id="tRActual">-</h4><p>Turno Actual</p></div></div>
                <div class="stat-card"><div class="stat-icon blue">&#128101;</div><div class="stat-info"><h4 id="tRCola">0</h4><p>En Cola</p></div></div>
                <div class="stat-card"><div class="stat-icon green">&#9989;</div><div class="stat-info"><h4 id="tRAtendidos">0</h4><p>Atendidos</p></div></div>
                <div class="stat-card"><div class="stat-icon orange">&#128230;</div><div class="stat-info"><h4 id="tRPendBodega">0</h4><p>Pend. Bodega</p></div></div>
            </div>
            <div id="tRActualBox" style="text-align:center;margin-bottom:16px;padding:20px;background:var(--bg-card);border:2px solid var(--accent);border-radius:12px;box-shadow:var(--shadow)">
                <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--accent);font-weight:600;margin-bottom:4px">Turno Actual</div>
                <div id="tRActualLarge" style="font-size:42px;font-weight:900;color:var(--accent)">-</div>
                <div id="tRActualNombre" style="color:var(--text-light);font-size:14px;margin-top:4px">Sin turno</div>
            </div>
            <button onclick="App.modules.turnos.rLlamar()" id="tRBtnLlamar" class="btn btn-success" style="width:100%;margin-bottom:8px">LLAMAR SIGUIENTE</button>
            <button onclick="App.modules.turnos.abrirModalDerivar()" id="tRBtnDerivar" class="btn btn-primary" style="width:100%;margin-bottom:12px;display:none">&#128230; DERIVAR A BODEGA</button>
            <div class="card" style="margin-bottom:12px">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                    <h3 style="font-size:14px;font-weight:600">Cola de Espera</h3>
                    <span id="tRColaBadge" class="badge" style="background:var(--info);color:white">0</span>
                </div>
                <div id="tRColaList"><div style="text-align:center;color:var(--text-light);padding:16px;font-size:13px">No hay personas en cola</div></div>
            </div>
            <div class="card">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                    <h3 style="font-size:14px;font-weight:600">Historial del Dia</h3>
                    <span id="tRHistBadge" class="badge" style="background:var(--text-light);color:white">0</span>
                </div>
                <div id="tRHistList" style="max-height:384px;overflow-y:auto"><div style="text-align:center;color:var(--text-light);padding:16px;font-size:13px">Sin registros</div></div>
            </div>
            <div id="tModalDerivar" style="display:none;position:fixed;inset:0;z-index:40;align-items:center;justify-content:center;background:rgba(0,0,0,0.5)">
                <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:24px;width:90%;max-width:420px;box-shadow:0 8px 32px rgba(0,0,0,0.2)">
                    <h3 style="font-size:18px;font-weight:700;margin-bottom:12px">&#128230; Derivar a Bodega</h3>
                    <p style="font-size:13px;color:var(--text-light);margin-bottom:12px">Turno: <span id="tMdTurno" style="color:var(--accent);font-weight:900"></span> - <span id="tMdNombre" style="font-weight:600"></span></p>
                    <input id="tMdPedidos" type="text" class="input" placeholder="Numero de pedido(s)">
                    <input id="tMdFactura" type="text" class="input" placeholder="Numero de factura" style="margin-top:8px">
                    <p id="tMdError" style="color:var(--danger);font-size:12px;display:none;margin-top:8px"></p>
                    <div style="display:flex;gap:8px;margin-top:12px">
                        <button onclick="App.modules.turnos.cerrarModalDerivar()" class="btn" style="flex:1;background:var(--border);color:var(--text)">CANCELAR</button>
                        <button onclick="App.modules.turnos.rDerivar()" id="tMdBtn" class="btn btn-primary" style="flex:2">DERIVAR</button>
                    </div>
                </div>
            </div>
        `;
        await this.rCargar();
        this.interval = setInterval(() => this.rCargar(), 3000);
    },

    async rCargar() {
        try {
            const [eR, cR, hR] = await Promise.all([fetch('/api/turnos/estado'), fetch('/api/turnos/cola'), fetch('/api/turnos/historial')]);
            const e = await eR.json(), c = await cR.json(), h = await hR.json();
            this.rActualTurno = e.actual || null;
            const sa = document.getElementById('tRActualLarge'); if (sa) sa.textContent = e.actual ? e.actual.numero : '-';
            const sn = document.getElementById('tRActualNombre'); if (sn) sn.textContent = e.actual ? e.actual.nombre : 'Sin turno';
            const st = document.getElementById('tRActual'); if (st) st.textContent = e.actual ? '#' + e.actual.numero : '-';
            const sc = document.getElementById('tRCola'); if (sc) sc.textContent = e.enCola;
            const sat = document.getElementById('tRAtendidos'); if (sat) sat.textContent = e.atendidos;
            const sp = document.getElementById('tRPendBodega'); if (sp) sp.textContent = e.pendientesBodega || 0;
            const cb = document.getElementById('tRColaBadge'); if (cb) cb.textContent = e.enCola;
            const ab = document.getElementById('tRActualBox');
            if (ab) ab.style.borderColor = e.actual ? 'var(--accent)' : 'var(--border)';
            const btn = document.getElementById('tRBtnLlamar');
            const btnD = document.getElementById('tRBtnDerivar');
            if (e.actual && e.actual.estado === 'atendiendo') {
                if (btn) btn.style.display = 'none';
                if (btnD) btnD.style.display = 'block';
            } else {
                if (btn) { btn.style.display = 'block'; btn.disabled = e.enCola === 0 && !e.actual; btn.style.opacity = (e.enCola === 0 && !e.actual) ? '0.5' : '1'; }
                if (btnD) btnD.style.display = 'none';
            }
            const cl = document.getElementById('tRColaList');
            if (cl) cl.innerHTML = c.length === 0 ? '<div style="text-align:center;color:var(--text-light);padding:16px;font-size:13px">No hay personas en cola</div>' : c.map((t, i) => `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--border)"><div style="display:flex;align-items:center;gap:10px"><span style="color:var(--text-light);font-size:13px">${i+1}</span><span style="color:var(--accent);font-weight:900;font-size:16px">#${escapeHtml(String(t.numero))}</span><span style="font-weight:600">${escapeHtml(t.nombre)}</span></div><span style="color:var(--text-light);font-size:11px">${this.fmtTime(t.hora_creacion)}</span></div>`).join('');
            const hb = document.getElementById('tRHistBadge'); if (hb) hb.textContent = h.length;
            const hl = document.getElementById('tRHistList');
            if (hl) hl.innerHTML = h.length === 0 ? '<div style="text-align:center;color:var(--text-light);padding:16px;font-size:13px">Sin registros</div>' : h.map(t => this.renderHistItem(t)).join('');
        } catch(e) {}
    },

    renderHistItem(t) {
        const isBodega = t.origen === 'bodega';
        const tipoLabel = t.tipo || 'Retira';
        const tipoColor = tipoLabel === 'Despacho' ? 'var(--warning)' : 'var(--success)';
        let info = `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">`;
        if (isBodega) { info += `<span style="font-weight:900">${escapeHtml(t.nombre)}</span>`; }
        else { info += `<span style="color:var(--accent);font-weight:900">#${escapeHtml(String(t.numero))}</span><span style="font-weight:600">${escapeHtml(t.nombre)}</span>`; }
        info += `<span style="font-size:11px;padding:2px 8px;border-radius:6px;background:${tipoLabel==='Despacho'?'rgba(245,158,11,0.1)':'rgba(34,197,94,0.1)'};color:${tipoColor}">${tipoLabel}</span>`;
        if (t.entrega_estado === 'entregado') { info += `<span style="font-size:11px;padding:2px 8px;border-radius:6px;background:rgba(34,197,94,0.1);color:var(--success)">&#10003; Entregado</span>`; }
        else if (t.entrega_estado === 'pendiente') { info += `<span style="font-size:11px;padding:2px 8px;border-radius:6px;background:rgba(245,158,11,0.1);color:var(--warning)">Pendiente bodega</span>`; }
        else if (!isBodega) { const est = {atendiendo:'Atendiendo',derivado:'Derivado',atendido:'Atendido'}[t.estado]||t.estado; info += `<span style="font-size:11px;padding:2px 8px;border-radius:6px;background:rgba(100,116,139,0.1);color:var(--text-light)">${est}</span>`; }
        info += `</div>`;
        let details = `<div style="display:flex;flex-wrap:wrap;gap:4px 14px;font-size:11px;margin-top:4px">`;
        if (!isBodega && t.hora_creacion) details += `<span><span style="color:var(--text-light)">Llegada: </span><span style="font-weight:700">${t.hora_creacion}</span></span>`;
        if (!isBodega && t.hora_llamada) details += `<span><span style="color:var(--text-light)">Atencion: </span><span style="color:var(--info);font-weight:700">${t.hora_llamada}</span></span><span><span style="color:var(--text-light)">Espera: </span><span style="color:var(--warning);font-weight:700">${this.fmtSec(t.espera_segundos)}</span></span>`;
        if (t.pedidos) details += `<span><span style="color:var(--text-light)">Pedido: </span><span style="color:var(--info);font-weight:700">${t.pedidos}</span></span>`;
        if (t.factura) details += `<span><span style="color:var(--text-light)">Factura: </span><span style="color:#a855f7;font-weight:700">${t.factura}</span></span>`;
        if (t.estado === 'derivado' && t.hora_fin) details += `<span><span style="color:var(--text-light)">Derivo: </span><span style="color:var(--accent);font-weight:700">${this.fmtTime(t.hora_fin)}</span></span>`;
        if (t.bodega_entregado) details += `<span><span style="color:var(--text-light)">Entrega bodega: </span><span style="color:var(--success);font-weight:700">${this.fmtTime(t.bodega_entregado)}</span></span>`;
        if (t.hora_fin && t.bodega_entregado) { const seg = this.timeToSec(t.bodega_entregado) - this.timeToSec(t.hora_fin); if (seg > 0) details += `<span><span style="color:var(--text-light)">Espera bodega: </span><span style="color:var(--warning);font-weight:700">${this.fmtSec(seg)}</span></span>`; }
        if (t.total_segundos) details += `<span><span style="color:var(--text-light)">Total: </span><span style="font-weight:700">${this.fmtSec(t.total_segundos)}</span></span>`;
        details += `</div>`;
        return `<div style="padding:10px 12px;border-bottom:1px solid var(--border)">${info}${details}<span style="font-size:11px;color:var(--text-light);margin-top:2px;display:block">${t.fecha_fmt||''}</span></div>`;
    },

    async rLlamar() {
        const btn = document.getElementById('tRBtnLlamar');
        if (btn) { btn.disabled = true; btn.textContent = 'LLAMANDO...'; }
        try { await fetch('/api/turnos/siguiente', { method: 'POST' }); await this.rCargar(); } catch(e) {}
        if (btn) { btn.disabled = false; btn.textContent = 'LLAMAR SIGUIENTE'; }
    },

    abrirModalDerivar() {
        if (!this.rActualTurno) return;
        document.getElementById('tMdTurno').textContent = '#' + this.rActualTurno.numero;
        document.getElementById('tMdNombre').textContent = this.rActualTurno.nombre;
        document.getElementById('tMdPedidos').value = '';
        document.getElementById('tMdFactura').value = '';
        document.getElementById('tMdError').style.display = 'none';
        document.getElementById('tModalDerivar').style.display = 'flex';
    },
    cerrarModalDerivar() { document.getElementById('tModalDerivar').style.display = 'none'; },
    async rDerivar() {
        if (!this.rActualTurno) return;
        const pedidos = document.getElementById('tMdPedidos').value.trim();
        const factura = document.getElementById('tMdFactura').value.trim();
        if (!pedidos && !factura) { const e = document.getElementById('tMdError'); e.textContent = 'Ingresa al menos un pedido o factura'; e.style.display = 'block'; return; }
        const btn = document.getElementById('tMdBtn'); btn.disabled = true; btn.textContent = 'DERIVANDO...';
        try {
            const r = await fetch('/api/turnos/derivar-bodega', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ turno_id: this.rActualTurno.id, pedidos, factura }) });
            if (r.ok) { this.cerrarModalDerivar(); await this.rCargar(); }
            else { const d = await r.json(); const e = document.getElementById('tMdError'); e.textContent = d.error || 'Error'; e.style.display = 'block'; }
        } catch(e) { const er = document.getElementById('tMdError'); er.textContent = 'Error de conexion'; er.style.display = 'block'; }
        btn.disabled = false; btn.textContent = 'DERIVAR';
    },

    async eliminarTurno(id) { if (!confirm('Eliminar este registro?')) return; try { await fetch(`/api/turnos/eliminar-turno/${id}`, { method: 'DELETE' }); this.rCargar(); } catch(e) {} },

    // ═══════ BODEGA ═══════
    async showBodega() {
        this.currentView = 'bodega';
        this.stopPolling();
        const c = document.getElementById('turnosContent');
        c.innerHTML = `
            <div class="page-header">
                <div>
                    <h2>Entrega de Bodega</h2>
                    <div class="subtitle">Gestion de entregas y pedidos</div>
                </div>
            </div>
            <div class="card" style="margin-bottom:12px">
                <div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;margin-bottom:8px" onclick="App.modules.turnos.toggleFormBodega()">
                    <h3 style="font-size:14px;font-weight:600">Registrar Entrega</h3>
                    <span id="tBFormArrow" style="color:var(--text-light);font-size:14px;transition:transform .2s">&#9660;</span>
                </div>
                <div id="tBFormBody" style="display:none">
                    <select id="tBTipo" class="input">
                        <option value="Retira sin turno">Retira sin turno</option><option value="Despacho">Despacho</option>
                    </select>
                    <input id="tBNombre" type="text" class="input" placeholder="Nombre del cliente" style="margin-top:8px">
                    <div style="display:flex;gap:8px;margin-top:8px">
                        <input id="tBPedidos" type="text" class="input" placeholder="Pedido(s)" style="flex:1;min-width:120px">
                        <input id="tBFactura" type="text" class="input" placeholder="Factura" style="flex:1;min-width:120px">
                    </div>
                    <input id="tBDesc" type="text" class="input" placeholder="Descripcion (opcional)" style="margin-top:8px">
                    <button onclick="App.modules.turnos.bRegistrar()" class="btn btn-success" style="width:100%;margin-top:12px">REGISTRAR</button>
                    <p id="tBError" style="color:var(--danger);font-size:12px;margin-top:8px;display:none"></p>
                </div>
            </div>
            <div class="card" style="margin-bottom:12px">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                    <h3 style="font-size:14px;font-weight:600">Pendientes de Entrega</h3>
                    <span id="tBPendBadge" class="badge" style="background:var(--warning);color:white">0</span>
                </div>
                <div id="tBPendList"><div style="text-align:center;color:var(--text-light);padding:16px;font-size:13px">No hay entregas pendientes</div></div>
            </div>
            <div class="card">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                    <h3 style="font-size:14px;font-weight:600">Entregados Hoy</h3>
                    <span id="tBEntregBadge" class="badge" style="background:var(--success);color:white">0</span>
                </div>
                <div id="tBEntregList"><div style="text-align:center;color:var(--text-light);padding:16px;font-size:13px">Sin entregas hoy</div></div>
            </div>
        `;
        await this.bCargar();
        this.interval = setInterval(() => this.bCargar(), 3000);
    },

    toggleFormBodega() {
        const body = document.getElementById('tBFormBody');
        const arrow = document.getElementById('tBFormArrow');
        if (body.style.display === 'none') { body.style.display = 'block'; arrow.style.transform = 'rotate(180deg)'; }
        else { body.style.display = 'none'; arrow.style.transform = 'rotate(0deg)'; }
    },

    async bCargar() {
        try {
            const [pR, aR] = await Promise.all([fetch('/api/turnos/entregas/pendientes'), fetch('/api/turnos/entregas')]);
            const p = await pR.json(), a = await aR.json();
            const ent = a.filter(e => e.estado === 'entregado');
            const pb = document.getElementById('tBPendBadge'); if (pb) pb.textContent = p.length;
            const eb = document.getElementById('tBEntregBadge'); if (eb) eb.textContent = ent.length;
            const pl = document.getElementById('tBPendList');
            if (pl) pl.innerHTML = p.length === 0 ? '<div style="text-align:center;color:var(--text-light);padding:16px;font-size:13px">No hay entregas pendientes</div>' : p.map(e => {
                let info = `<span style="font-weight:900">${e.cliente_nombre}</span>`;
                if (e.tipo) info += ` <span style="font-size:11px;padding:2px 8px;border-radius:6px;background:${e.tipo==='Despacho'?'rgba(245,158,11,0.1)':'rgba(34,197,94,0.1)'};color:${e.tipo==='Despacho'?'var(--warning)':'var(--success)'}">${e.tipo}</span>`;
                if (e.pedidos) info += ` <span style="font-size:11px;padding:2px 8px;border-radius:6px;background:rgba(59,130,246,0.1);color:var(--info)">Pedido: ${e.pedidos}</span>`;
                if (e.factura) info += ` <span style="font-size:11px;padding:2px 8px;border-radius:6px;background:rgba(168,85,247,0.1);color:#a855f7">Factura: ${e.factura}</span>`;
                return `<div style="padding:10px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px"><div>${info}<div style="font-size:11px;color:var(--text-light);margin-top:4px">Recibido: ${this.fmtTime(e.hora_registrada)}</div></div><button onclick="App.modules.turnos.bEntregar(${e.id})" class="btn btn-success" style="padding:6px 12px;font-size:12px">ENTREGADO</button></div>`;
            }).join('');
            const el = document.getElementById('tBEntregList');
            if (el) el.innerHTML = ent.length === 0 ? '<div style="text-align:center;color:var(--text-light);padding:16px;font-size:13px">Sin entregas hoy</div>' : ent.map(e => {
                let info = `<span style="font-weight:900">${escapeHtml(e.cliente_nombre)}</span>`;
                if (e.pedidos) info += ` <span style="font-size:11px;padding:2px 8px;border-radius:6px;background:rgba(59,130,246,0.1);color:var(--info)">Pedido: ${escapeHtml(e.pedidos)}</span>`;
                if (e.factura) info += ` <span style="font-size:11px;padding:2px 8px;border-radius:6px;background:rgba(168,85,247,0.1);color:#a855f7">Factura: ${escapeHtml(e.factura)}</span>`;
                return `<div style="padding:10px 12px;border-bottom:1px solid var(--border)"><div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px"><div>${info}</div><div style="font-size:11px"><span style="font-weight:700;color:var(--success)">&#10003; Entregado: ${this.fmtTime(e.hora_entregada)}</span></div></div><div style="font-size:11px;color:var(--text-light);margin-top:4px">Recibido: ${this.fmtTime(e.hora_registrada)}</div></div>`;
            }).join('');
        } catch(e) {}
    },

    async bRegistrar() {
        const tipo = document.getElementById('tBTipo').value;
        const n = document.getElementById('tBNombre').value.trim();
        const pedidos = document.getElementById('tBPedidos').value.trim();
        const factura = document.getElementById('tBFactura').value.trim();
        const d = document.getElementById('tBDesc').value.trim();
        if (!n) { const e = document.getElementById('tBError'); e.textContent = 'Nombre requerido'; e.style.display = 'block'; return; }
        try {
            await fetch('/api/turnos/entregas/registrar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cliente_nombre: n, descripcion: d, tipo, pedidos, factura }) });
            document.getElementById('tBNombre').value = ''; document.getElementById('tBPedidos').value = ''; document.getElementById('tBFactura').value = ''; document.getElementById('tBDesc').value = '';
            document.getElementById('tBError').style.display = 'none';
            this.bCargar();
        } catch(e) {}
    },

    async bEntregar(id) { try { await fetch(`/api/turnos/entregas/${id}/entregar`, { method: 'POST' }); this.bCargar(); } catch(e) {} },
    async eliminarEntrega(id) { if (!confirm('Eliminar?')) return; try { await fetch(`/api/turnos/eliminar-entrega/${id}`, { method: 'DELETE' }); this.bCargar(); } catch(e) {} },

    // ═══════ QR ═══════
    showQR() {
        this.currentView = 'qr';
        this.stopPolling();
        const c = document.getElementById('turnosContent');
        const baseUrl = window.location.origin;
        const registroUrl = baseUrl + '/turnos/?view=registro';
        c.innerHTML = `
            <div class="page-header">
                <div>
                    <h2>QR Clientes</h2>
                    <div class="subtitle">Codigo QR para que los clientes tomen turno</div>
                </div>
            </div>
            <div class="card" style="text-align:center;margin-bottom:16px;padding:24px">
                <h3 style="font-size:14px;font-weight:600;margin-bottom:16px">Escanea para tomar turno</h3>
                <div id="tQRImg" style="background:white;padding:16px;border-radius:12px;display:inline-block;border:1px solid var(--border)"></div>
                <p id="tQRUrl" style="color:var(--text-light);font-size:11px;word-break:break-all;margin-top:12px">${registroUrl}</p>
            </div>
            <div class="stats-grid" style="grid-template-columns:1fr 1fr">
                <div class="stat-card"><div class="stat-icon blue">&#128202;</div><div class="stat-info"><h4 id="tQRTotal">0</h4><p>Total hoy</p></div></div>
                <div class="stat-card"><div class="stat-icon orange">&#9203;</div><div class="stat-info"><h4 id="tQRCola">0</h4><p>En espera</p></div></div>
            </div>
        `;
        this.generateQR(registroUrl);
        this.qrCargar();
        this.interval = setInterval(() => this.qrCargar(), 3000);
    },

    generateQR(text) {
        const el = document.getElementById('tQRImg');
        if (!el) return;
        fetch('/api/turnos/qr')
            .then(r => r.json())
            .then(d => {
                if (d.qr) { el.innerHTML = '<img src="' + d.qr + '" alt="QR" style="width:220px;border-radius:8px">'; }
                else { el.innerHTML = '<span style="color:var(--danger);font-size:12px">Error generando QR</span>'; }
            })
            .catch(() => { el.innerHTML = '<span style="color:var(--danger);font-size:12px">Error de conexion</span>'; });
    },

    async qrCargar() {
        try {
            const r = await fetch('/api/turnos/estado'); const d = await r.json();
            const t = document.getElementById('tQRTotal'); if (t) t.textContent = d.total;
            const q = document.getElementById('tQRCola'); if (q) q.textContent = d.enCola;
        } catch(e) {}
    }
});
