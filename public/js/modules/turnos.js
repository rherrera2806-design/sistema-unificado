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
            if (cl) cl.innerHTML = c.length === 0 ? '<div style="text-align:center;color:var(--text-light);padding:16px;font-size:13px">No hay personas en cola</div>' : c.map((t, i) => `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--border)"><div style="display:flex;align-items:center;gap:10px"><span style="color:var(--text-light);font-size:13px">${i+1}</span><span style="color:var(--accent);font-weight:900;font-size:16px">#${t.numero}</span><span style="font-weight:600">${t.nombre}</span></div><span style="color:var(--text-light);font-size:11px">${t.hora_creacion ? String(t.hora_creacion).slice(0,5) : ''}</span></div>`).join('');
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
        if (isBodega) { info += `<span style="font-weight:900">${t.nombre}</span>`; }
        else { info += `<span style="color:var(--accent);font-weight:900">#${t.numero}</span><span style="font-weight:600">${t.nombre}</span>`; }
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
        if (t.total_segundos) details += `<span><span style="color:var(--text-light)">Total: </span><span style="font-weight:700">${this.fmtSec(t.total_segundos)}</span></span>`;
        else if (isBodega && t.bodega_segundos) details += `<span><span style="color:var(--text-light)">Total: </span><span style="font-weight:700">${this.fmtSec(t.bodega_segundos)}</span></span>`;
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
                return `<div style="padding:10px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px"><div>${info}<div style="font-size:11px;color:var(--text-light);margin-top:4px">Recibido: ${e.hora_registrada||'-'}</div></div><button onclick="App.modules.turnos.bEntregar(${e.id})" class="btn btn-success" style="padding:6px 12px;font-size:12px">ENTREGADO</button></div>`;
            }).join('');
            const el = document.getElementById('tBEntregList');
            if (el) el.innerHTML = ent.length === 0 ? '<div style="text-align:center;color:var(--text-light);padding:16px;font-size:13px">Sin entregas hoy</div>' : ent.map(e => {
                let info = `<span style="font-weight:900">${e.cliente_nombre}</span>`;
                if (e.pedidos) info += ` <span style="font-size:11px;padding:2px 8px;border-radius:6px;background:rgba(59,130,246,0.1);color:var(--info)">Pedido: ${e.pedidos}</span>`;
                if (e.factura) info += ` <span style="font-size:11px;padding:2px 8px;border-radius:6px;background:rgba(168,85,247,0.1);color:#a855f7">Factura: ${e.factura}</span>`;
                return `<div style="padding:10px 12px;border-bottom:1px solid var(--border)"><div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px"><div>${info}</div><div style="font-size:11px"><span style="font-weight:700;color:var(--success)">&#10003; Entregado: ${e.hora_entregada||'-'}</span></div></div><div style="font-size:11px;color:var(--text-light);margin-top:4px">Recibido: ${e.hora_registrada||'-'}</div></div>`;
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
        const size = 250;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const modules = this.qrEncode(text);
        const moduleCount = modules.length;
        const cellSize = Math.floor((size - 20) / moduleCount);
        const offset = Math.floor((size - cellSize * moduleCount) / 2);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = '#000';
        for (let r = 0; r < moduleCount; r++) {
            for (let c = 0; c < moduleCount; c++) {
                if (modules[r][c]) {
                    ctx.fillRect(offset + c * cellSize, offset + r * cellSize, cellSize, cellSize);
                }
            }
        }
        el.innerHTML = '';
        canvas.style.width = '220px';
        canvas.style.height = '220px';
        el.appendChild(canvas);
    },

    qrEncode(text) {
        const typeNumber = 0;
        const errorCorrectionLevel = 'M';
        const data = this.qrUtil.getData(typeNumber, errorCorrectionLevel);
        data.addData(text);
        data.make();
        const count = data.getModuleCount();
        const modules = [];
        for (let r = 0; r < count; r++) {
            modules[r] = [];
            for (let c = 0; c < count; c++) {
                modules[r][c] = data.isDark(r, c);
            }
        }
        return modules;
    },

    qrUtil: (function() {
        function QRUtil() {}
        QRUtil.prototype = {
            _data: null, _typeNumber: 0, _errorCorrectLevel: 'M',
            addData: function(data) { this._data = data; },
            make: function() {
                var typeNumber = this._typeNumber;
                var ecLevel = {L:1,M:0,Q:3,H:2}[this._errorCorrectLevel]||0;
                var modules = this._generate(typeNumber, ecLevel, this._data);
                this._modules = modules;
                this._moduleCount = modules.length;
            },
            getModuleCount: function() { return this._moduleCount; },
            isDark: function(r, c) { return this._modules[r][c]; },
            _generate: function(typeNumber, ecLevel, dataStr) {
                var n = this._getTypeNumber(typeNumber, dataStr.length);
                var data = this._createData(n, ecLevel, dataStr);
                return this._createMatrix(n, data);
            },
            _getTypeNumber: function(typeNumber, dataLength) {
                if (typeNumber > 0) return typeNumber;
                for (var i = 1; i <= 40; i++) {
                    var capacity = this._getCapacity(i);
                    if (dataLength <= capacity) return i;
                }
                return 40;
            },
            _getCapacity: function(typeNumber) {
                var totalCodewords = this._TOTAL_CODEWORDS[typeNumber - 1];
                var ecCodewords = this._EC_CODEWORDS_PER_BLOCK[0][typeNumber - 1];
                var blocks = this._NUMBER_OF_BLOCKS[0][typeNumber - 1];
                var dataCodewords = totalCodewords - ecCodewords * blocks;
                var chars = Math.floor(dataCodewords * 8 / 8);
                return Math.floor(dataCodewords * 8 / 8);
            },
            _TOTAL_CODEWORDS: [26,44,70,100,134,172,196,242,292,346,404,466,532,581,655,733,815,901,991,1085,1156,1258,1364,1474,1588,1706,1828,1921,2051,2185,2323,2465,2611,2761,2876,3034,3196,3362,3532,3706],
            _EC_CODEWORDS_PER_BLOCK: [[10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28]],
            _NUMBER_OF_BLOCKS: [[1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,30,32,33,35,37,38,40,43,45,47]],
            _createData: function(typeNumber, ecLevel, dataStr) {
                var dataBits = [];
                for (var i = 0; i < dataStr.length; i++) {
                    var chr = dataStr.charCodeAt(i);
                    if (chr < 128) {
                        dataBits.push(0x04);
                        for (var b = 7; b >= 0; b--) dataBits.push((chr >> b) & 1);
                    } else {
                        dataBits.push(0x04);
                        for (var b = 7; b >= 0; b--) dataBits.push((chr >> b) & 1);
                    }
                }
                var totalCodewords = this._TOTAL_CODEWORDS[typeNumber - 1];
                var ecCodewords = this._EC_CODEWORDS_PER_BLOCK[0][typeNumber - 1];
                var numBlocks = this._NUMBER_OF_BLOCKS[0][typeNumber - 1];
                var dataPerBlock = Math.floor((totalCodewords - ecCodewords * numBlocks));
                var totalDataBits = dataPerBlock * 8;
                while (dataBits.length < totalDataBits) { dataBits.push(0); }
                dataBits = dataBits.slice(0, totalDataBits);
                var blocks = [];
                var bSize = Math.floor(dataPerBlock);
                for (var i = 0; i < numBlocks; i++) {
                    blocks.push(dataBits.slice(i * bSize, (i + 1) * bSize));
                }
                return { blocks: blocks, ecPerBlock: ecCodewords };
            },
            _createMatrix: function(typeNumber, data) {
                var size = typeNumber * 4 + 17;
                var matrix = [];
                var reserved = [];
                for (var i = 0; i < size; i++) { matrix[i] = []; reserved[i] = []; for (var j = 0; j < size; j++) { matrix[i][j] = false; reserved[i][j] = false; } }
                this._placeFinderPatterns(matrix, reserved, size);
                this._placeAlignPatterns(matrix, reserved, size, typeNumber);
                this._placeTimingPatterns(matrix, reserved, size);
                this._reserveFormatArea(reserved, size);
                this._placeData(matrix, reserved, data, size);
                this._placeFormatBits(matrix, reserved, size, 0);
                return matrix;
            },
            _placeFinderPatterns: function(m, r, size) {
                var pattern = [[1,1,1,1,1,1,1],[1,0,0,0,0,0,1],[1,0,1,1,1,0,1],[1,0,1,1,1,0,1],[1,0,1,1,1,0,1],[1,0,0,0,0,0,1],[1,1,1,1,1,1,1]];
                var positions = [[0,0],[0,size-7],[size-7,0]];
                for (var p = 0; p < 3; p++) {
                    var row = positions[p][0], col = positions[p][1];
                    for (var i = 0; i < 7; i++) for (var j = 0; j < 7; j++) {
                        m[row+i][col+j] = pattern[i][j] === 1;
                        r[row+i][col+j] = true;
                    }
                    for (var i = -1; i <= 7; i++) for (var j = -1; j <= 7; j++) {
                        var ri = row+i, ci = col+j;
                        if (ri >= 0 && ri < size && ci >= 0 && ci < size && !r[ri][ci]) { m[ri][ci] = false; r[ri][ci] = true; }
                    }
                }
            },
            _placeAlignPatterns: function(m, r, size, typeNumber) {
                if (typeNumber < 2) return;
                var positions = this._getAlignPositions(typeNumber);
                for (var i = 0; i < positions.length; i++) for (var j = 0; j < positions.length; j++) {
                    var row = positions[i], col = positions[j];
                    if (r[row][col]) continue;
                    for (var dr = -2; dr <= 2; dr++) for (var dc = -2; dc <= 2; dc++) {
                        var dark = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
                        m[row+dr][col+dc] = dark;
                        r[row+dr][col+dc] = true;
                    }
                }
            },
            _getAlignPositions: function(typeNumber) {
                if (typeNumber === 1) return [];
                var first = 6;
                var last = typeNumber * 4 + 10;
                var step = typeNumber > 10 ? Math.floor((typeNumber - 14) / (Math.ceil((typeNumber-14)/28)*2||1) + 1) : Math.floor((typeNumber-7)/2) || 1;
                if (step < 1) step = 1;
                var positions = [first];
                var pos = last;
                while (pos > first && positions.length < 7) { positions.unshift(pos); pos -= step; }
                if (positions[0] !== first) positions.unshift(first);
                if (positions[positions.length-1] !== last) positions.push(last);
                return positions;
            },
            _placeTimingPatterns: function(m, r, size) {
                for (var i = 8; i < size - 8; i++) {
                    var dark = i % 2 === 0;
                    if (!r[6][i]) { m[6][i] = dark; r[6][i] = true; }
                    if (!r[i][6]) { m[i][6] = dark; r[i][6] = true; }
                }
            },
            _reserveFormatArea: function(r, size) {
                for (var i = 0; i <= 8; i++) { r[8][i] = true; r[i][8] = true; r[8][size-1-i] = true; r[size-1-i][8] = true; }
                r[8][8] = true;
            },
            _placeData: function(m, r, data, size) {
                var bitIndex = 0;
                var bits = [];
                if (data.blocks) {
                    var totalBits = 0;
                    for (var b = 0; b < data.blocks.length; b++) totalBits += data.blocks[b].length * 8;
                    for (var b = 0; b < data.blocks.length; b++) {
                        var block = data.blocks[b];
                        for (var i = 0; i < block.length; i++) bits.push(block[i]);
                    }
                    while (bits.length < size * size) bits.push(0);
                }
                var col = size - 1;
                var upward = true;
                while (col >= 0) {
                    if (col === 6) col--;
                    for (var i = 0; i < size; i++) {
                        var row = upward ? size - 1 - i : i;
                        for (var dc = 0; dc <= 1; dc++) {
                            var c = col - dc;
                            if (c >= 0 && !r[row][c]) {
                                m[row][c] = bits[bitIndex] === 1;
                                bitIndex++;
                            }
                        }
                    }
                    upward = !upward;
                    col -= 2;
                }
            },
            _placeFormatBits: function(m, r, size, mask) {
                var data = (mask << 3) | 0;
                var rem = data;
                for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >> 9) * 0x537);
                var bits = ((data << 10) | rem) ^ 0x5412;
                for (var i = 0; i <= 5; i++) { m[8][i] = ((bits >> (14 - i)) & 1) === 1; }
                m[8][7] = ((bits >> 8) & 1) === 1;
                m[8][8] = ((bits >> 7) & 1) === 1;
                m[7][8] = ((bits >> 6) & 1) === 1;
                for (var i = 0; i < 6; i++) m[5 - i][8] = ((bits >> i) & 1) === 1;
                for (var i = 0; i < 8; i++) m[size - 1 - i][8] = ((bits >> (14 - i)) & 1) === 1;
                for (var i = 0; i < 7; i++) m[8][size - 7 + i] = ((bits >> (6 - i)) & 1) === 1;
                m[0][8] = true; m[8][0] = true; m[size-1][8] = true; m[8][size-1] = true;
            }
        };
        return new QRUtil();
    })(),

    async qrCargar() {
        try {
            const r = await fetch('/api/turnos/estado'); const d = await r.json();
            const t = document.getElementById('tQRTotal'); if (t) t.textContent = d.total;
            const q = document.getElementById('tQRCola'); if (q) q.textContent = d.enCola;
        } catch(e) {}
    }
});
