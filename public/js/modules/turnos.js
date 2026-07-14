App.registerModule('turnos', {
    socket: null,
    interval: null,
    rActualTurno: null,
    currentView: 'menu',

    async render() {
        const el = document.getElementById('page-turnos');
        el.innerHTML = `
            <div class="turnos-bg" style="min-height:100%;padding:16px">
                <div id="turnosContent" style="max-width:600px;margin:0 auto"></div>
            </div>
        `;
        this.renderMenu();
    },

    renderMenu() {
        this.currentView = 'menu';
        this.stopPolling();
        document.getElementById('turnosContent').innerHTML = `
            <div style="text-align:center;margin-bottom:24px">
                <h2 style="font-size:20px;font-weight:900;color:#fbbf24;margin-bottom:4px">TURNO QR</h2>
                <p style="font-size:13px;color:#94a3b8">Selecciona un modulo</p>
            </div>
            <div style="display:grid;grid-template-columns:1fr;gap:12px">
                <div class="turnos-card" style="background:rgba(34,197,94,0.12);border-color:rgba(34,197,94,0.35);cursor:pointer" onclick="App.modules.turnos.showRecepcion()">
                    <div style="font-size:36px;margin-bottom:8px">&#128203;</div>
                    <h3 style="font-size:16px;font-weight:700;color:#4ade80;margin-bottom:4px">Recepcion y Control de Turnos</h3>
                    <p style="font-size:12px;color:#94a3b8">Gestionar cola, llamar siguiente, ver historial</p>
                </div>
                <div class="turnos-card" style="background:rgba(245,158,11,0.12);border-color:rgba(245,158,11,0.35);cursor:pointer" onclick="App.modules.turnos.showBodega()">
                    <div style="font-size:36px;margin-bottom:8px">&#128230;</div>
                    <h3 style="font-size:16px;font-weight:700;color:#fbbf24;margin-bottom:4px">Entrega de Bodega</h3>
                    <p style="font-size:12px;color:#94a3b8">Ver pendientes y marcar entregas realizadas</p>
                </div>
                <div class="turnos-card" style="background:rgba(59,130,246,0.12);border-color:rgba(59,130,246,0.35);cursor:pointer" onclick="App.modules.turnos.showQR()">
                    <div style="font-size:36px;margin-bottom:8px">&#128186;</div>
                    <h3 style="font-size:16px;font-weight:700;color:#60a5fa;margin-bottom:4px">QR Clientes</h3>
                    <p style="font-size:12px;color:#94a3b8">Codigo QR para que los clientes tomen turno</p>
                </div>
            </div>
            <div style="text-align:center;margin-top:20px">
                <a href="/turnos/" target="_blank" style="color:#22c55e;font-size:12px;font-weight:500;text-decoration:underline">Abrir Turnos en nueva pestana</a>
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
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
                <h2 style="font-size:16px;font-weight:700;color:#fbbf24">Turnos - Recepcion</h2>
                <button onclick="App.modules.turnos.renderMenu()" style="background:#16a34a;color:white;border:none;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer">&#8592; Menu</button>
            </div>
            <div style="text-align:center;margin-bottom:16px;padding:16px;background:rgba(30,41,59,0.8);border:2px solid #f59e0b;border-radius:16px">
                <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#fbbf24;font-weight:600;margin-bottom:4px">Turno Actual</div>
                <div id="tRActual" style="font-size:48px;font-weight:900;color:#fbbf24">-</div>
                <div id="tRActualNombre" style="color:#94a3b8;font-size:14px;margin-top:4px">Sin turno</div>
            </div>
            <button onclick="App.modules.turnos.rLlamar()" id="tRBtnLlamar" style="width:100%;padding:12px;border:none;border-radius:12px;font-weight:700;font-size:15px;cursor:pointer;background:linear-gradient(135deg,#22c55e,#16a34a);color:white;margin-bottom:12px">LLAMAR SIGUIENTE</button>
            <button onclick="App.modules.turnos.abrirModalDerivar()" id="tRBtnDerivar" style="width:100%;padding:12px;border:none;border-radius:12px;font-weight:700;font-size:15px;cursor:pointer;background:linear-gradient(135deg,#3b82f6,#2563eb);color:white;margin-bottom:12px;display:none">&#128230; DERIVAR A BODEGA</button>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
                <div style="text-align:center;padding:12px;border-radius:12px;background:rgba(30,41,59,0.6);border:1px solid #334155"><div id="tRTotal" style="font-size:20px;font-weight:700;color:#fff">0</div><div style="font-size:11px;color:#64748b;margin-top:4px">Total hoy</div></div>
                <div style="text-align:center;padding:12px;border-radius:12px;background:rgba(30,41,59,0.6);border:1px solid #334155"><div id="tRCola" style="font-size:20px;font-weight:700;color:#60a5fa">0</div><div style="font-size:11px;color:#64748b;margin-top:4px">En cola</div></div>
                <div style="text-align:center;padding:12px;border-radius:12px;background:rgba(30,41,59,0.6);border:1px solid #334155"><div id="tRAtendidos" style="font-size:20px;font-weight:700;color:#4ade80">0</div><div style="font-size:11px;color:#64748b;margin-top:4px">Atendidos</div></div>
                <div style="text-align:center;padding:12px;border-radius:12px;background:rgba(30,41,59,0.6);border:1px solid #f59e0b"><div id="tRPendBodega" style="font-size:20px;font-weight:700;color:#fbbf24">0</div><div style="font-size:11px;color:#64748b;margin-top:4px">Pend. Bodega</div></div>
            </div>
            <div style="background:rgba(30,41,59,0.8);border:1px solid #334155;border-radius:16px;padding:16px;margin-bottom:12px">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                    <h3 style="font-size:13px;font-weight:600;color:#cbd5e1">Cola de Espera</h3>
                    <span id="tRColaBadge" style="background:#334155;color:#cbd5e1;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px">0</span>
                </div>
                <div id="tRColaList" style="max-height:256px;overflow-y:auto"><div style="text-align:center;color:#475569;padding:16px;font-size:13px">No hay personas en cola</div></div>
            </div>
            <div style="background:rgba(30,41,59,0.8);border:1px solid #334155;border-radius:16px;padding:16px">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                    <h3 style="font-size:13px;font-weight:600;color:#cbd5e1">Historial del Dia</h3>
                    <span id="tRHistBadge" style="background:#334155;color:#cbd5e1;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px">0</span>
                </div>
                <div id="tRHistList" style="max-height:384px;overflow-y:auto"><div style="text-align:center;color:#475569;padding:16px;font-size:13px">Sin registros</div></div>
            </div>
            <!-- Derivar Modal -->
            <div id="tModalDerivar" style="display:none;position:fixed;inset:0;z-index:40;align-items:center;justify-content:center;background:rgba(0,0,0,0.7)">
                <div style="background:#1e293b;border:1px solid #334155;border-radius:16px;padding:24px;width:90%;max-width:420px">
                    <h3 style="font-size:18px;font-weight:700;color:#f59e0b;margin-bottom:12px">&#128230; Derivar a Bodega</h3>
                    <p style="font-size:13px;color:#94a3b8;margin-bottom:12px">Turno: <span id="tMdTurno" style="color:#fbbf24;font-weight:900"></span> - <span id="tMdNombre" style="color:#fff;font-weight:600"></span></p>
                    <input id="tMdPedidos" type="text" style="width:100%;padding:12px;border-radius:10px;border:1px solid #334155;background:#1e293b;color:#f1f5f9;font-size:14px;margin-bottom:8px" placeholder="Numero de pedido(s)">
                    <input id="tMdFactura" type="text" style="width:100%;padding:12px;border-radius:10px;border:1px solid #334155;background:#1e293b;color:#f1f5f9;font-size:14px;margin-bottom:12px" placeholder="Numero de factura">
                    <p id="tMdError" style="color:#f87171;font-size:12px;display:none;margin-bottom:8px"></p>
                    <div style="display:flex;gap:8px">
                        <button onclick="App.modules.turnos.cerrarModalDerivar()" style="flex:1;padding:10px;border:none;border-radius:8px;background:#334155;color:#94a3b8;font-weight:600;cursor:pointer">CANCELAR</button>
                        <button onclick="App.modules.turnos.rDerivar()" id="tMdBtn" style="flex:2;padding:10px;border:none;border-radius:8px;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;font-weight:700;cursor:pointer">DERIVAR</button>
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
            const sa = document.getElementById('tRActual'); if (sa) sa.textContent = e.actual ? e.actual.numero : '-';
            const sn = document.getElementById('tRActualNombre'); if (sn) sn.textContent = e.actual ? e.actual.nombre : 'Sin turno';
            const st = document.getElementById('tRTotal'); if (st) st.textContent = e.total;
            const sc = document.getElementById('tRCola'); if (sc) sc.textContent = e.enCola;
            const sat = document.getElementById('tRAtendidos'); if (sat) sat.textContent = e.atendidos;
            const sp = document.getElementById('tRPendBodega'); if (sp) sp.textContent = e.pendientesBodega || 0;
            const cb = document.getElementById('tRColaBadge'); if (cb) cb.textContent = e.enCola;
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
            if (cl) cl.innerHTML = c.length === 0 ? '<div style="text-align:center;color:#475569;padding:16px;font-size:13px">No hay personas en cola</div>' : c.map((t, i) => `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #334155"><div style="display:flex;align-items:center;gap:10px"><span style="color:#64748b;font-size:13px">${i+1}</span><span style="color:#fbbf24;font-weight:900;font-size:16px">#${t.numero}</span><span style="color:#cbd5e1">${t.nombre}</span></div><span style="color:#64748b;font-size:11px">${t.hora_creacion ? String(t.hora_creacion).slice(0,5) : ''}</span></div>`).join('');
            const hb = document.getElementById('tRHistBadge'); if (hb) hb.textContent = h.length;
            const hl = document.getElementById('tRHistList');
            if (hl) hl.innerHTML = h.length === 0 ? '<div style="text-align:center;color:#475569;padding:16px;font-size:13px">Sin registros</div>' : h.map(t => this.renderHistItem(t)).join('');
        } catch(e) {}
    },

    renderHistItem(t) {
        const isBodega = t.origen === 'bodega';
        const tipoLabel = t.tipo || 'Retira';
        const tipoColor = tipoLabel === 'Despacho' ? '#fbbf24' : '#4ade80';
        let info = `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">`;
        if (isBodega) { info += `<span style="color:#fbbf24;font-weight:900">${t.nombre}</span>`; }
        else { info += `<span style="color:#fbbf24;font-weight:900">#${t.numero}</span><span style="color:#cbd5e1;font-weight:600">${t.nombre}</span>`; }
        info += `<span style="font-size:11px;padding:2px 8px;border-radius:6px;background:rgba(${tipoLabel==='Despacho'?'251,191,36':'34,197,94'},0.15);color:${tipoColor}">${tipoLabel}</span>`;
        if (t.entrega_estado === 'entregado') { info += `<span style="font-size:11px;padding:2px 8px;border-radius:6px;background:rgba(34,197,94,0.2);color:#4ade80;border:1px solid #22c55e">&#10003; Entregado</span>`; }
        else if (t.entrega_estado === 'pendiente') { info += `<span style="font-size:11px;padding:2px 8px;border-radius:6px;background:rgba(251,191,36,0.15);color:#fbbf24">Pendiente bodega</span>`; }
        else if (!isBodega) { const est = {atendiendo:'Atendiendo',derivado:'Derivado',atendido:'Atendido'}[t.estado]||t.estado; info += `<span style="font-size:11px;padding:2px 8px;border-radius:6px;background:rgba(148,163,184,0.15);color:#94a3b8">${est}</span>`; }
        info += `</div>`;
        let details = `<div style="display:flex;flex-wrap:wrap;gap:4px 14px;font-size:11px;margin-top:4px">`;
        if (!isBodega && t.hora_creacion) details += `<span><span style="color:#475569">Llegada: </span><span style="color:#cbd5e1;font-weight:700">${t.hora_creacion}</span></span>`;
        if (!isBodega && t.hora_llamada) details += `<span><span style="color:#475569">Atencion: </span><span style="color:#60a5fa;font-weight:700">${t.hora_llamada}</span></span><span><span style="color:#475569">Espera: </span><span style="color:#fbbf24;font-weight:700">${this.fmtSec(t.espera_segundos)}</span></span>`;
        if (t.pedidos) details += `<span><span style="color:#475569">Pedido: </span><span style="color:#22d3ee;font-weight:700">${t.pedidos}</span></span>`;
        if (t.factura) details += `<span><span style="color:#475569">Factura: </span><span style="color:#c084fc;font-weight:700">${t.factura}</span></span>`;
        if (t.total_segundos) details += `<span><span style="color:#475569">Total: </span><span style="color:#fff;font-weight:700">${this.fmtSec(t.total_segundos)}</span></span>`;
        else if (isBodega && t.bodega_segundos) details += `<span><span style="color:#475569">Total: </span><span style="color:#fff;font-weight:700">${this.fmtSec(t.bodega_segundos)}</span></span>`;
        details += `</div>`;
        return `<div style="padding:10px 12px;border-bottom:1px solid #334155">${info}${details}<span style="font-size:11px;color:#475569;margin-top:2px;display:block">${t.fecha_fmt||''}</span></div>`;
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
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
                <h2 style="font-size:16px;font-weight:700;color:#fbbf24">Turnos - Entrega Bodega</h2>
                <button onclick="App.modules.turnos.renderMenu()" style="background:#16a34a;color:white;border:none;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer">&#8592; Menu</button>
            </div>
            <div style="background:rgba(30,41,59,0.8);border:1px solid #334155;border-radius:16px;padding:16px;margin-bottom:12px">
                <div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;margin-bottom:8px" onclick="App.modules.turnos.toggleFormBodega()">
                    <h3 style="font-size:13px;font-weight:600;color:#fbbf24">Registrar Entrega</h3>
                    <span id="tBFormArrow" style="color:#94a3b8;font-size:14px;transition:transform .2s">&#9660;</span>
                </div>
                <div id="tBFormBody" style="display:none">
                    <select id="tBTipo" style="width:100%;padding:12px;border-radius:10px;border:1px solid #334155;background:#1e293b;color:#f1f5f9;font-size:14px;margin-bottom:8px">
                        <option value="Retira sin turno">Retira sin turno</option><option value="Despacho">Despacho</option>
                    </select>
                    <input id="tBNombre" type="text" style="width:100%;padding:12px;border-radius:10px;border:1px solid #334155;background:#1e293b;color:#f1f5f9;font-size:14px;margin-bottom:8px" placeholder="Nombre del cliente">
                    <div style="display:flex;gap:8px;margin-bottom:8px">
                        <input id="tBPedidos" type="text" style="flex:1;padding:12px;border-radius:10px;border:1px solid #334155;background:#1e293b;color:#f1f5f9;font-size:14px;min-width:120px" placeholder="Pedido(s)">
                        <input id="tBFactura" type="text" style="flex:1;padding:12px;border-radius:10px;border:1px solid #334155;background:#1e293b;color:#f1f5f9;font-size:14px;min-width:120px" placeholder="Factura">
                    </div>
                    <input id="tBDesc" type="text" style="width:100%;padding:12px;border-radius:10px;border:1px solid #334155;background:#1e293b;color:#f1f5f9;font-size:14px;margin-bottom:8px" placeholder="Descripcion (opcional)">
                    <button onclick="App.modules.turnos.bRegistrar()" style="width:100%;padding:12px;border:none;border-radius:12px;font-weight:700;font-size:15px;cursor:pointer;background:linear-gradient(135deg,#f59e0b,#d97706);color:#000">REGISTRAR</button>
                    <p id="tBError" style="color:#f87171;font-size:12px;margin-top:8px;display:none"></p>
                </div>
            </div>
            <div style="background:rgba(30,41,59,0.8);border:1px solid #334155;border-radius:16px;padding:16px;margin-bottom:12px">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                    <h3 style="font-size:13px;font-weight:600;color:#cbd5e1">Pendientes de Entrega</h3>
                    <span id="tBPendBadge" style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;background:rgba(251,191,36,0.15);color:#fbbf24">0</span>
                </div>
                <div id="tBPendList" style="max-height:288px;overflow-y:auto"><div style="text-align:center;color:#475569;padding:16px;font-size:13px">No hay entregas pendientes</div></div>
            </div>
            <div style="background:rgba(30,41,59,0.8);border:1px solid #334155;border-radius:16px;padding:16px">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                    <h3 style="font-size:13px;font-weight:600;color:#cbd5e1">Entregados Hoy</h3>
                    <span id="tBEntregBadge" style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;background:rgba(34,197,94,0.15);color:#22c55e">0</span>
                </div>
                <div id="tBEntregList" style="max-height:256px;overflow-y:auto"><div style="text-align:center;color:#475569;padding:16px;font-size:13px">Sin entregas hoy</div></div>
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
            if (pl) pl.innerHTML = p.length === 0 ? '<div style="text-align:center;color:#475569;padding:16px;font-size:13px">No hay entregas pendientes</div>' : p.map(e => {
                let info = `<span style="color:#fbbf24;font-weight:900">${e.cliente_nombre}</span>`;
                if (e.tipo) info += ` <span style="font-size:11px;padding:2px 8px;border-radius:6px;background:rgba(${e.tipo==='Despacho'?'251,191,36':'34,197,94'},0.15);color:${e.tipo==='Despacho'?'#fbbf24':'#4ade80'}">${e.tipo}</span>`;
                if (e.pedidos) info += ` <span style="font-size:11px;padding:2px 8px;border-radius:6px;background:rgba(59,130,246,0.15);color:#60a5fa">Pedido: ${e.pedidos}</span>`;
                if (e.factura) info += ` <span style="font-size:11px;padding:2px 8px;border-radius:6px;background:rgba(168,85,247,0.15);color:#c084fc">Factura: ${e.factura}</span>`;
                return `<div style="padding:10px 12px;border-bottom:1px solid #334155;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px"><div>${info}<div style="font-size:11px;color:#94a3b8;margin-top:4px">Recibido: ${e.hora_registrada||'-'}</div></div><button onclick="App.modules.turnos.bEntregar(${e.id})" style="padding:8px 14px;border:none;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff">ENTREGADO</button></div>`;
            }).join('');
            const el = document.getElementById('tBEntregList');
            if (el) el.innerHTML = ent.length === 0 ? '<div style="text-align:center;color:#475569;padding:16px;font-size:13px">Sin entregas hoy</div>' : ent.map(e => {
                let info = `<span style="color:#fbbf24;font-weight:900">${e.cliente_nombre}</span>`;
                if (e.pedidos) info += ` <span style="font-size:11px;padding:2px 8px;border-radius:6px;background:rgba(59,130,246,0.15);color:#60a5fa">Pedido: ${e.pedidos}</span>`;
                if (e.factura) info += ` <span style="font-size:11px;padding:2px 8px;border-radius:6px;background:rgba(168,85,247,0.15);color:#c084fc">Factura: ${e.factura}</span>`;
                return `<div style="padding:10px 12px;border-bottom:1px solid #334155"><div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px"><div>${info}</div><div style="font-size:11px"><span style="font-weight:700;color:#4ade80">&#10003; Entregado: ${e.hora_entregada||'-'}</span></div></div><div style="font-size:11px;color:#94a3b8;margin-top:4px">Recibido: ${e.hora_registrada||'-'}</div></div>`;
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
    async showQR() {
        this.currentView = 'qr';
        this.stopPolling();
        const c = document.getElementById('turnosContent');
        c.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
                <h2 style="font-size:16px;font-weight:700;color:#fbbf24">Turnos - QR Clientes</h2>
                <button onclick="App.modules.turnos.renderMenu()" style="background:#16a34a;color:white;border:none;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer">&#8592; Menu</button>
            </div>
            <div style="background:rgba(30,41,59,0.8);border:1px solid #334155;border-radius:16px;padding:20px;text-align:center;margin-bottom:12px">
                <h3 style="font-size:13px;font-weight:600;color:#fbbf24;margin-bottom:16px">Escanea para tomar turno</h3>
                <div id="tQRImg" style="background:#fff;padding:12px;border-radius:12px;display:inline-block;margin-bottom:12px"><span style="color:#94a3b8;font-size:12px">Cargando QR...</span></div>
                <p id="tQRUrl" style="color:#475569;font-size:11px;word-break:break-all"></p>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                <div style="text-align:center;padding:12px;border-radius:12px;background:rgba(30,41,59,0.6);border:1px solid #334155"><div id="tQRTotal" style="font-size:18px;font-weight:700;color:#fff">0</div><div style="font-size:11px;color:#64748b;margin-top:4px">Total hoy</div></div>
                <div style="text-align:center;padding:12px;border-radius:12px;background:rgba(30,41,59,0.6);border:1px solid #334155"><div id="tQRCola" style="font-size:18px;font-weight:700;color:#60a5fa">0</div><div style="font-size:11px;color:#64748b;margin-top:4px">En espera</div></div>
            </div>
        `;
        await this.qrLoad();
        await this.qrCargar();
        this.interval = setInterval(() => this.qrCargar(), 3000);
    },

    async qrLoad() {
        try {
            const base = window.location.origin;
            const r = await fetch(`/api/turnos/qr?url=${encodeURIComponent(base + '/turnos/?view=registro')}`);
            const d = await r.json();
            const img = document.getElementById('tQRImg'); if (img) img.innerHTML = `<img src="${d.qr}" alt="QR" style="width:250px;border-radius:8px">`;
            const url = document.getElementById('tQRUrl'); if (url) url.textContent = d.url;
        } catch(e) { const img = document.getElementById('tQRImg'); if (img) img.innerHTML = '<span style="color:#f87171;font-size:12px">Error QR</span>'; }
    },

    async qrCargar() {
        try {
            const r = await fetch('/api/turnos/estado'); const d = await r.json();
            const t = document.getElementById('tQRTotal'); if (t) t.textContent = d.total;
            const q = document.getElementById('tQRCola'); if (q) q.textContent = d.enCola;
        } catch(e) {}
    }
});
