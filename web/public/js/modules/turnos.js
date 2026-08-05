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
        document.getElementById('turnosContent').innerHTML = '<style>'
            + '@keyframes tFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}'
            + '.tmenu-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}'
            + '.tmenu-card:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,0.08)!important}'
            + '</style>'

            + '<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:8px 16px;margin-bottom:20px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">'
            + '<div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="position:relative;z-index:1"><h2 style="margin:0;font-size:15px;font-weight:800;color:white;letter-spacing:-0.5px">Atencion al Cliente</h2>'
            + '<p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Turnos, bodega y facturacion</p></div></div>'

            + '<div style="display:grid;grid-template-columns:1fr;gap:14px">'
            + '<div class="tmenu-card" style="cursor:pointer;background:white;border:1px solid #e2e8f0;border-radius:14px;padding:20px 24px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:tFadeUp 0.5s ease 0ms both;display:flex;align-items:center;gap:16px" onclick="App.modules.turnos.showRecepcion()">'
            + '<div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#eff6ff,#bfdbfe);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>'
            + '<div><h3 style="margin:0;font-size:15px;font-weight:700;color:#0f172a">Recepcion y Control de Turnos</h3>'
            + '<p style="margin:3px 0 0;font-size:12px;color:#64748b">Gestionar cola, llamar siguiente, ver historial</p></div>'
            + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" style="margin-left:auto;flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg></div>'

            + '<div class="tmenu-card" style="cursor:pointer;background:white;border:1px solid #e2e8f0;border-radius:14px;padding:20px 24px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:tFadeUp 0.5s ease 80ms both;display:flex;align-items:center;gap:16px" onclick="App.modules.turnos.showBodega()">'
            + '<div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#f0fdf4,#bbf7d0);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div>'
            + '<div><h3 style="margin:0;font-size:15px;font-weight:700;color:#0f172a">Entrega de Bodega</h3>'
            + '<p style="margin:3px 0 0;font-size:12px;color:#64748b">Verificar stock y derivar a almacen</p></div>'
            + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" style="margin-left:auto;flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg></div>'

            + '<div class="tmenu-card" style="cursor:pointer;background:white;border:1px solid #e2e8f0;border-radius:14px;padding:20px 24px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:tFadeUp 0.5s ease 160ms both;display:flex;align-items:center;gap:16px" onclick="App.modules.turnos.showQR()">'
            + '<div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#fef3c7,#fde68a);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="2" width="8" height="8" rx="1"/><rect x="2" y="14" width="8" height="8" rx="1"/><rect x="14" y="14" width="4" height="4"/><line x1="22" y1="14" x2="22" y2="22"/><line x1="14" y1="22" x2="22" y2="22"/></svg></div>'
            + '<div><h3 style="margin:0;font-size:15px;font-weight:700;color:#0f172a">QR Clientes</h3>'
            + '<p style="margin:3px 0 0;font-size:12px;color:#64748b">Codigo QR para que los clientes tomen turno</p></div>'
            + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" style="margin-left:auto;flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg></div>'
            + '</div>';
    },

    stopPolling() { if (this.interval) { clearInterval(this.interval); this.interval = null; } },

    fmtSec(s) { if (s == null) return '-'; const m = Math.round(s / 60); return `${m}m`; },
    fmtTime(t) { if (!t) return '-'; return String(t).slice(0, 8); },
    timeToSec(t) { if (!t) return 0; const p = String(t).slice(0,8).split(':').map(Number); return p[0]*3600 + p[1]*60 + (p[2]||0); },
    canEliminar() { const u = JSON.parse(localStorage.getItem('unified_user') || '{}'); const p = u.permisos || []; return u.rol === 'admin' || p.includes('turnos') || p.includes('turnos_recepcion.eliminar') || p.includes('turnos_bodega.eliminar'); },

    // ═══════ RECEPCION ═══════
    async showRecepcion() {
        this.currentView = 'recepcion';
        this.stopPolling();
        const c = document.getElementById('turnosContent');
        c.innerHTML = '<style>'
            + '@keyframes tFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}'
            + '.t-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}'
            + '.t-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important}'
            + '</style>'

            + '<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:24px 28px;margin-bottom:20px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">'
            + '<div style="position:absolute;top:-30px;right:-30px;width:140px;height:140px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="position:relative;z-index:1"><h2 style="margin:0;font-size:22px;font-weight:800;color:white;letter-spacing:-0.5px">Recepcion y Control de Turnos</h2>'
            + '<p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.7)">Gestion de cola de espera</p></div></div>'

            + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">'
            + '<div class="t-card" style="background:white;border:1px solid #e2e8f0;border-left:4px solid #f59e0b;border-radius:10px;padding:10px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);height:55px;display:flex;align-items:center;gap:10px">'
            + '<div style="width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,#fef3c7,#fde68a);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>'
            + '<div><div id="tRActual" style="font-size:20px;font-weight:800;color:#1e293b;line-height:1">-</div><div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">Turno Actual</div></div></div>'
            + '<div class="t-card" style="background:white;border:1px solid #e2e8f0;border-left:4px solid #3b82f6;border-radius:10px;padding:10px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);height:55px;display:flex;align-items:center;gap:10px">'
            + '<div style="width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,#eff6ff,#bfdbfe);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>'
            + '<div><div id="tRCola" style="font-size:20px;font-weight:800;color:#1e293b;line-height:1">0</div><div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">En Cola</div></div></div>'
            + '<div class="t-card" style="background:white;border:1px solid #e2e8f0;border-left:4px solid #22c55e;border-radius:10px;padding:10px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);height:55px;display:flex;align-items:center;gap:10px">'
            + '<div style="width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,#f0fdf4,#bbf7d0);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></div>'
            + '<div><div id="tRAtendidos" style="font-size:20px;font-weight:800;color:#22c55e;line-height:1">0</div><div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">Atendidos</div></div></div>'
            + '<div class="t-card" style="background:white;border:1px solid #e2e8f0;border-left:4px solid #f97316;border-radius:10px;padding:10px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);height:55px;display:flex;align-items:center;gap:10px">'
            + '<div style="width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,#fff7ed,#fed7aa);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div>'
            + '<div><div id="tRPendBodega" style="font-size:20px;font-weight:800;color:#f97316;line-height:1">0</div><div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">Pend. Bodega</div></div></div></div>'

            + '<div id="tRActualBox" style="text-align:center;margin-bottom:20px;padding:28px 20px;background:white;border:2px solid #f59e0b;border-radius:14px;box-shadow:0 2px 8px rgba(245,158,11,0.08)">'
            + '<div style="font-size:11px;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">Turno Actual</div>'
            + '<div id="tRActualLarge" style="font-size:52px;font-weight:900;color:#1e293b;line-height:1">-</div>'
            + '<div id="tRActualNombre" style="color:#64748b;font-size:15px;margin-top:8px;font-weight:500">Sin turno</div></div>'

            + '<button onclick="App.modules.turnos.rLlamar()" id="tRBtnLlamar" class="btn btn-primary" style="width:100%;margin-bottom:8px;padding:14px;font-size:14px;text-transform:uppercase;letter-spacing:0.5px">Llamar Siguiente</button>'
            + '<button onclick="App.modules.turnos.abrirModalDerivar()" id="tRBtnDerivar" class="btn btn-primary" style="width:100%;margin-bottom:20px;padding:14px;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;display:none">Derivar a Verificacion</button>'

            + '<div class="t-card" style="background:white;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.04)">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #f1f5f9">'
            + '<h3 style="font-size:14px;font-weight:700;color:#1e293b;margin:0">Cola de Espera</h3>'
            + '<span id="tRColaBadge" style="font-size:12px;font-weight:700;color:white;background:#3b82f6;padding:3px 10px;border-radius:20px">0</span></div>'
            + '<div id="tRColaList"><div style="text-align:center;color:#94a3b8;padding:20px;font-size:13px">No hay personas en cola</div></div></div>'

            + '<div class="t-card" style="background:white;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04)">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #f1f5f9">'
            + '<h3 style="font-size:14px;font-weight:700;color:#1e293b;margin:0">Historial del Dia</h3>'
            + '<span id="tRHistBadge" style="font-size:12px;font-weight:700;color:white;background:#64748b;padding:3px 10px;border-radius:20px">0</span></div>'
            + '<div id="tRHistList" style="max-height:420px;overflow-y:auto"><div style="text-align:center;color:#94a3b8;padding:20px;font-size:13px">Sin registros</div></div></div>'

            + '<div id="tModalDerivar" style="display:none;position:fixed;inset:0;z-index:40;align-items:center;justify-content:center;background:rgba(15,23,42,0.5);backdrop-filter:blur(4px)">'
            + '<div style="background:white;border:1px solid #e2e8f0;border-radius:16px;padding:24px;width:90%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,0.2)">'
            + '<h3 style="font-size:18px;font-weight:700;margin:0 0 8px;color:#1e293b">Derivar a Verificacion de Bodega</h3>'
            + '<p style="font-size:13px;color:#64748b;margin:0 0 16px">Turno: <span id="tMdTurno" style="color:#1e40af;font-weight:900"></span> - <span id="tMdNombre" style="font-weight:600;color:#1e293b"></span></p>'
            + '<input id="tMdPedidos" type="text" placeholder="Numero de pedido(s)" style="font-size:13px;width:100%;background:#f8fafc;border:1px solid #e2e8f0;color:#1e293b;padding:10px 12px;border-radius:8px;box-sizing:border-box" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'">'
            + '<div style="margin-top:12px"><label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;font-weight:500">Adjuntar PDFs (opcional)</label>'
            + '<input id="tMdFiles" type="file" accept=".pdf" multiple style="font-size:12px;width:100%">'
            + '<div id="tMdFilesList" style="font-size:11px;color:#94a3b8;margin-top:4px"></div></div>'
            + '<p id="tMdError" style="color:#dc2626;font-size:12px;display:none;margin-top:8px"></p>'
            + '<div style="display:flex;gap:8px;margin-top:16px">'
            + '<button onclick="App.modules.turnos.cerrarModalDerivar()" class="btn btn-outline" style="flex:1">Cancelar</button>'
            + '<button onclick="App.modules.turnos.rDerivar()" id="tMdBtn" class="btn btn-primary" style="flex:2">Derivar</button></div></div></div>';
        await this.rCargar();
        this.interval = setInterval(() => this.rCargar(), 15000);
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
            if (cl) cl.innerHTML = c.length === 0 ? '<div style="text-align:center;color:#94a3b8;padding:20px;font-size:13px">No hay personas en cola</div>' : c.map((t, i) => {
                const posBg = i === 0 ? '#eff6ff' : 'white';
                const posBorder = i === 0 ? '#bfdbfe' : '#f1f5f9';
                return `<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 20px;border-bottom:1px solid ${posBorder};background:${posBg};transition:background 0.1s" onmouseover="this.style.background='#f0f9ff'" onmouseout="this.style.background='${posBg}'">
                    <div style="display:flex;align-items:center;gap:12px">
                        <span style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:${i===0?'#3b82f6':'#f1f5f9'};color:${i===0?'white':'#64748b'};border-radius:50%;font-size:12px;font-weight:700">${i+1}</span>
                        <span style="color:#1e40af;font-weight:800;font-size:16px;font-family:'SF Mono','Consolas',monospace">#${escapeHtml(String(t.numero))}</span>
                        <span style="font-weight:600;color:#1e293b">${escapeHtml(t.nombre)}</span>
                    </div>
                    <span style="color:#94a3b8;font-size:12px;font-family:'SF Mono','Consolas',monospace">${this.fmtTime(t.hora_creacion)}</span>
                </div>`;
            }).join('');
            const hb = document.getElementById('tRHistBadge'); if (hb) hb.textContent = h.length;
            const hl = document.getElementById('tRHistList');
            if (hl) hl.innerHTML = h.length === 0 ? '<div style="text-align:center;color:var(--text-light);padding:16px;font-size:13px">Sin registros</div>' : h.map(t => this.renderHistItem(t)).join('');
        } catch(e) {}
    },

    renderHistItem(t) {
        const isBodega = t.origen === 'bodega';
        const tipoLabel = t.tipo || 'Retira';
        const tipoBg = tipoLabel === 'Despacho' ? '#fef3c7' : '#dcfce7';
        const tipoColor = tipoLabel === 'Despacho' ? '#92400e' : '#166534';

        const estadoConfig = {
            'entregado': { bg: '#dcfce7', color: '#166534', label: 'Entregado' },
            'pendiente': { bg: '#fef3c7', color: '#92400e', label: 'Pend. Bodega' },
            'atendiendo': { bg: '#dbeafe', color: '#1e40af', label: 'Atendiendo' },
            'derivado': { bg: '#f3e8ff', color: '#7c3aed', label: 'Derivado' },
            'atendido': { bg: '#dcfce7', color: '#166534', label: 'Atendido' }
        }[t.entrega_estado || (!isBodega ? t.estado : null)] || null;

        let header = `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">`;
        if (!isBodega) {
            header += `<span style="color:#1e40af;font-weight:800;font-size:15px;font-family:'SF Mono','Consolas',monospace">#${escapeHtml(String(t.numero))}</span>`;
            header += `<span style="font-weight:700;color:#1e293b">${escapeHtml(t.nombre)}</span>`;
            if (t.patente) header += `<span style="font-size:10px;font-weight:600;color:#475569;background:#f1f5f9;padding:2px 7px;border-radius:4px;font-family:'SF Mono','Consolas',monospace">${escapeHtml(t.patente)}</span>`;
            if (t.motivo) header += `<span style="font-size:10px;font-weight:600;color:#7c3aed;background:#f3e8ff;padding:2px 7px;border-radius:4px">${escapeHtml(t.motivo)}</span>`;
        } else {
            header += `<span style="font-weight:700;color:#1e293b">${escapeHtml(t.nombre)}</span>`;
        }
        header += `<span style="font-size:10px;font-weight:600;color:${tipoColor};background:${tipoBg};padding:2px 8px;border-radius:4px">${tipoLabel}</span>`;
        if (estadoConfig) header += `<span style="font-size:10px;font-weight:600;color:${estadoConfig.color};background:${estadoConfig.bg};padding:2px 8px;border-radius:4px">${estadoConfig.label}</span>`;
        header += `</div>`;

        let details = `<div style="display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12px;margin-top:8px">`;
        if (!isBodega && t.hora_creacion) details += `<span style="color:#64748b">Llegada: <span style="color:#1e293b;font-weight:700;font-family:'SF Mono','Consolas',monospace">${t.hora_creacion}</span></span>`;
        if (!isBodega && t.hora_llamada) {
            details += `<span style="color:#64748b">Atencion: <span style="color:#3b82f6;font-weight:700;font-family:'SF Mono','Consolas',monospace">${t.hora_llamada}</span></span>`;
            details += `<span style="color:#64748b">Espera: <span style="color:#f59e0b;font-weight:700;font-family:'SF Mono','Consolas',monospace">${this.fmtSec(t.espera_segundos)}</span></span>`;
        }
        if (t.pedidos) details += `<span style="color:#64748b">Pedido: <span style="color:#1e40af;font-weight:700">${t.pedidos}</span></span>`;
        if (t.factura) details += `<span style="color:#64748b">Factura: <span style="color:#7c3aed;font-weight:700">${t.factura}</span></span>`;
        if (t.estado === 'derivado' && t.hora_fin) details += `<span style="color:#64748b">Derivo: <span style="color:#1e40af;font-weight:700">${this.fmtTime(t.hora_fin)}</span></span>`;
        if (t.bodega_entregado) details += `<span style="color:#64748b">Entrega bodega: <span style="color:#16a34a;font-weight:700">${this.fmtTime(t.bodega_entregado)}</span></span>`;
        if (t.hora_fin && t.bodega_entregado) { const seg = this.timeToSec(t.bodega_entregado) - this.timeToSec(t.hora_fin); if (seg > 0) details += `<span style="color:#64748b">Espera bodega: <span style="color:#f59e0b;font-weight:700">${this.fmtSec(seg)}</span></span>`; }
        if (t.total_segundos) details += `<span style="color:#64748b">Total: <span style="color:#1e293b;font-weight:800">${this.fmtSec(t.total_segundos)}</span></span>`;
        details += `</div>`;

        const deleteBtn = this.canEliminar() ? `<button onclick="App.modules.turnos.eliminarTurno(${t.id})" class="btn btn-sm btn-danger" title="Eliminar" style="position:absolute;right:12px;top:12px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>` : '';

        return `<div style="padding:14px 20px;border-bottom:1px solid #f1f5f9;position:relative;transition:background 0.1s" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">${header}${details}<span style="font-size:11px;color:#94a3b8;margin-top:6px;display:block">${t.fecha_fmt||''}</span>${deleteBtn}</div>`;
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
        document.getElementById('tMdError').style.display = 'none';
        document.getElementById('tModalDerivar').style.display = 'flex';
    },
    cerrarModalDerivar() { document.getElementById('tModalDerivar').style.display = 'none'; },
    async rDerivar() {
        if (!this.rActualTurno) return;
        const pedidos = document.getElementById('tMdPedidos').value.trim();
        if (!pedidos) { const e = document.getElementById('tMdError'); e.textContent = 'Ingresa al menos un pedido'; e.style.display = 'block'; return; }
        const btn = document.getElementById('tMdBtn'); btn.disabled = true; btn.textContent = 'DERIVANDO...';
        const fileInput = document.getElementById('tMdFiles');
        const adjuntos = [];
        if (fileInput && fileInput.files.length > 0) {
            for (const f of fileInput.files) {
                const b64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result.split(',')[1]);
                    reader.readAsDataURL(f);
                });
                adjuntos.push({ nombre: f.name, base64: b64 });
            }
        }
        try {
            const r = await fetch('/api/turnos/derivar-bodega', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ turno_id: this.rActualTurno.id, pedidos, adjuntos }) });
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
        c.innerHTML = '<style>'
            + '@keyframes tFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}'
            + '.t-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}'
            + '.t-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important}'
            + '</style>'

            + '<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:24px 28px;margin-bottom:20px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">'
            + '<div style="position:absolute;top:-30px;right:-30px;width:140px;height:140px;background:radial-gradient(circle,rgba(34,197,94,0.2) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="position:relative;z-index:1"><h2 style="margin:0;font-size:22px;font-weight:800;color:white;letter-spacing:-0.5px">Verificacion Bodega</h2>'
            + '<p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.7)">Verificar stock y derivar a almacen</p></div></div>'

            + '<div class="t-card" style="background:white;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.04)">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;cursor:pointer" onclick="App.modules.turnos.toggleFormBodega()">'
            + '<h3 style="font-size:14px;font-weight:700;color:#1e293b;margin:0">Registrar Entrega</h3>'
            + '<span id="tBFormArrow" style="color:#94a3b8;font-size:12px;transition:transform 0.2s">&#9660;</span></div>'
            + '<div id="tBFormBody" style="display:none;padding:0 20px 20px;border-top:1px solid #f1f5f9">'
            + '<div style="margin-top:16px"><label style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Tipo</label>'
            + '<select id="tBTipo" style="font-size:13px;width:100%;background:#f8fafc;border:1px solid #e2e8f0;color:#1e293b;padding:10px 12px;border-radius:8px;box-sizing:border-box" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'">'
            + '<option value="Retira sin turno">Retira sin turno</option><option value="Despacho">Despacho</option></select></div>'
            + '<div style="margin-top:12px"><label style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Nombre del cliente</label>'
            + '<input id="tBNombre" type="text" placeholder="Nombre completo" style="font-size:13px;width:100%;background:#f8fafc;border:1px solid #e2e8f0;color:#1e293b;padding:10px 12px;border-radius:8px;box-sizing:border-box" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'"></div>'
            + '<div style="margin-top:12px"><label style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Pedido(s)</label>'
            + '<input id="tBPedidos" type="text" placeholder="Numero de pedido(s)" style="font-size:13px;width:100%;background:#f8fafc;border:1px solid #e2e8f0;color:#1e293b;padding:10px 12px;border-radius:8px;box-sizing:border-box" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'"></div>'
            + '<div style="margin-top:12px"><label style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Descripcion (opcional)</label>'
            + '<input id="tBDesc" type="text" placeholder="Descripcion breve" style="font-size:13px;width:100%;background:#f8fafc;border:1px solid #e2e8f0;color:#1e293b;padding:10px 12px;border-radius:8px;box-sizing:border-box" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'"></div>'
            + '<button onclick="App.modules.turnos.bRegistrar()" class="btn btn-primary" style="width:100%;margin-top:16px;padding:12px;font-size:13px;text-transform:uppercase">Registrar</button>'
            + '<p id="tBError" style="color:#dc2626;font-size:12px;margin-top:8px;display:none"></p></div></div>'

            + '<div class="t-card" style="background:white;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.04)">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #f1f5f9">'
            + '<h3 style="font-size:14px;font-weight:700;color:#1e293b;margin:0">Pendientes de Verificacion</h3>'
            + '<span id="tBPendBadge" style="font-size:12px;font-weight:700;color:white;background:#f59e0b;padding:3px 10px;border-radius:20px">0</span></div>'
            + '<div id="tBPendList"><div style="text-align:center;color:#94a3b8;padding:20px;font-size:13px">No hay entregas pendientes</div></div></div>'

            + '<div class="t-card" style="background:white;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04)">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #f1f5f9">'
            + '<h3 style="font-size:14px;font-weight:700;color:#1e293b;margin:0">Verificados Hoy</h3>'
            + '<span id="tBEntregBadge" style="font-size:12px;font-weight:700;color:white;background:#22c55e;padding:3px 10px;border-radius:20px">0</span></div>'
            + '<div id="tBEntregList"><div style="text-align:center;color:#94a3b8;padding:20px;font-size:13px">Sin verificaciones hoy</div></div></div>'

            + '<div id="tModalVerificar" style="display:none;position:fixed;inset:0;z-index:40;align-items:center;justify-content:center;background:rgba(15,23,42,0.5);backdrop-filter:blur(4px)">'
            + '<div style="background:white;border:1px solid #e2e8f0;border-radius:16px;padding:24px;width:90%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,0.2)">'
            + '<h3 style="font-size:18px;font-weight:700;margin:0 0 8px;color:#1e293b">Verificar y Derivar a Almacen</h3>'
            + '<p style="font-size:13px;color:#64748b;margin:0 0 16px">Selecciona el tecnico de almacen que atendera.</p>'
            + '<div style="margin-bottom:12px"><label style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Encargado de Atencion y Carga</label>'
            + '<select id="tVerTecnico" style="font-size:13px;width:100%;background:#f8fafc;border:1px solid #e2e8f0;color:#1e293b;padding:10px 12px;border-radius:8px;box-sizing:border-box" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'"></select></div>'
            + '<div style="margin-bottom:16px"><label style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Observaciones</label>'
            + '<textarea id="tVerObs" rows="2" placeholder="Observaciones opcionales" style="font-size:13px;width:100%;background:#f8fafc;border:1px solid #e2e8f0;color:#1e293b;padding:10px 12px;border-radius:8px;box-sizing:border-box;resize:vertical" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'"></textarea></div>'
            + '<div style="display:flex;gap:8px">'
            + '<button onclick="App.modules.turnos.cerrarModalVerificar()" class="btn btn-outline" style="flex:1">Cancelar</button>'
            + '<button onclick="App.modules.turnos.confirmarVerificar()" id="tVerBtn" class="btn btn-primary" style="flex:2">Verificar</button></div></div></div>';
        await this.bCargar();
        this.interval = setInterval(() => this.bCargar(), 15000);
    },

    toggleFormBodega() {
        const body = document.getElementById('tBFormBody');
        const arrow = document.getElementById('tBFormArrow');
        if (body.style.display === 'none') { body.style.display = 'block'; arrow.style.transform = 'rotate(180deg)'; }
        else { body.style.display = 'none'; arrow.style.transform = 'rotate(0deg)'; }
    },

    pendingVerificar: null,

    async abrirModalVerificar(entregaId) {
        this.pendingVerificar = entregaId;
        let tecnicos = [];
        try { tecnicos = await fetch('/api/turnos/tecnicos-almacen').then(r => r.json()); } catch(e) {}
        const sel = document.getElementById('tVerTecnico');
        sel.innerHTML = '<option value="">-- Seleccionar técnico --</option>' + tecnicos.map(t => `<option value="${t.id}">${escapeHtml(t.nombre)}</option>`).join('');
        document.getElementById('tVerObs').value = '';
        document.getElementById('tModalVerificar').style.display = 'flex';
    },

    cerrarModalVerificar() {
        document.getElementById('tModalVerificar').style.display = 'none';
        this.pendingVerificar = null;
    },

    async confirmarVerificar() {
        if (!this.pendingVerificar) return;
        const tecnicoId = document.getElementById('tVerTecnico').value;
        const obs = document.getElementById('tVerObs').value.trim();
        if (!tecnicoId) { App.showAlert('Selecciona un técnico', 'danger'); return; }
        const btn = document.getElementById('tVerBtn'); btn.disabled = true; btn.textContent = 'VERIFICANDO...';
        await fetch('/api/turnos/verificar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entrega_id: this.pendingVerificar, tecnico_almacen_id: Number(tecnicoId), observaciones: obs }) });
        this.cerrarModalVerificar();
        App.showAlert('Verificado y derivado a almacén');
        this.bCargar();
        btn.disabled = false; btn.textContent = 'VERIFICAR';
    },

    async bCargar() {
        try {
            const [pR, aR] = await Promise.all([fetch('/api/turnos/entregas/pendientes'), fetch('/api/turnos/entregas')]);
            const p = await pR.json(), a = await aR.json();
            const verificados = a.filter(e => e.estado === 'verificado' || e.estado === 'cargado' || e.estado === 'facturado');
            const pb = document.getElementById('tBPendBadge'); if (pb) pb.textContent = p.length;
            const eb = document.getElementById('tBEntregBadge'); if (eb) eb.textContent = verificados.length;
            const pl = document.getElementById('tBPendList');
            if (pl) pl.innerHTML = p.length === 0 ? '<div style="text-align:center;color:#94a3b8;padding:20px;font-size:13px">No hay entregas pendientes</div>' : p.map(e => {
                const tipoBg = e.tipo === 'Despacho' ? '#fef3c7' : '#dcfce7';
                const tipoColor = e.tipo === 'Despacho' ? '#92400e' : '#166534';
                const deleteBtn = this.canEliminar() ? `<button onclick="App.modules.turnos.eliminarEntrega(${e.id})" class="btn btn-sm btn-danger" title="Eliminar"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>` : '';
                return `<div style="padding:14px 20px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;gap:8px;transition:background 0.1s" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                    <div>
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                            <span style="font-weight:700;color:#1e293b">${escapeHtml(e.cliente_nombre)}</span>
                            ${e.patente ? `<span style="font-size:10px;font-weight:600;color:#475569;background:#f1f5f9;padding:2px 7px;border-radius:4px;font-family:'SF Mono','Consolas',monospace">${escapeHtml(e.patente)}</span>` : ''}
                            <span style="font-size:10px;font-weight:600;color:${tipoColor};background:${tipoBg};padding:2px 8px;border-radius:4px">${e.tipo}</span>
                            ${e.pedidos ? `<span style="font-size:10px;font-weight:600;color:#1e40af;background:#eff6ff;padding:2px 8px;border-radius:4px">Pedido: ${e.pedidos}</span>` : ''}
                        </div>
                        <div style="font-size:12px;color:#94a3b8;margin-top:6px">Recibido: <span style="color:#64748b;font-family:'SF Mono','Consolas',monospace">${this.fmtTime(e.hora_registrada)}</span></div>
                    </div>
                    <div style="display:flex;gap:6px;align-items:center">
                        ${Number(e.adjuntos_count) > 0 ? `<button onclick="App.modules.turnos.verAdjuntos(${e.turno_id})" style="padding:5px 10px;font-size:11px;font-weight:600;color:#7c3aed;background:#f3e8ff;border:1px solid #e9d5ff;border-radius:6px;cursor:pointer;transition:all 0.15s" onmouseover="this.style.background='#ede9fe'" onmouseout="this.style.background='#f3e8ff'">PDF (${e.adjuntos_count})</button>` : ''}
                        <button class="btn btn-primary btn-sm" title="Verificar" onclick="App.modules.turnos.abrirModalVerificar(${e.id})">Verificar</button>
                        ${deleteBtn}
                    </div>
                </div>`;
            }).join('');
            const el = document.getElementById('tBEntregList');
            if (el) el.innerHTML = verificados.length === 0 ? '<div style="text-align:center;color:#94a3b8;padding:20px;font-size:13px">Sin verificaciones hoy</div>' : verificados.map(e => {
                const estConfig = {
                    'facturado': { bg: '#dcfce7', color: '#166534', label: 'Facturado' },
                    'cargado': { bg: '#dbeafe', color: '#1e40af', label: 'Cargado' },
                    'verificado': { bg: '#fef3c7', color: '#92400e', label: 'En Almacen' }
                }[e.estado] || { bg: '#f1f5f9', color: '#64748b', label: e.estado };
                const hora = e.estado === 'facturado' ? e.hora_facturada : e.estado === 'cargado' ? e.hora_cargada : e.hora_verificada;
                return `<div style="padding:14px 20px;border-bottom:1px solid #f1f5f9;transition:background 0.1s" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px">
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                            <span style="font-weight:700;color:#1e293b">${escapeHtml(e.cliente_nombre)}</span>
                            ${e.pedidos ? `<span style="font-size:10px;font-weight:600;color:#1e40af;background:#eff6ff;padding:2px 8px;border-radius:4px">Pedido: ${escapeHtml(e.pedidos)}</span>` : ''}
                        </div>
                        <div style="display:flex;align-items:center;gap:8px">
                            <span style="font-size:10px;font-weight:600;color:${estConfig.color};background:${estConfig.bg};padding:3px 10px;border-radius:4px">${estConfig.label}</span>
                            <span style="font-size:12px;color:#94a3b8;font-family:'SF Mono','Consolas',monospace">${this.fmtTime(hora)}</span>
                        </div>
                    </div>
                </div>`;
            }).join('');
        } catch(e) {}
    },

    async bRegistrar() {
        const tipo = document.getElementById('tBTipo').value;
        const n = document.getElementById('tBNombre').value.trim();
        const pedidos = document.getElementById('tBPedidos').value.trim();
        const d = document.getElementById('tBDesc').value.trim();
        if (!n) { const e = document.getElementById('tBError'); e.textContent = 'Nombre requerido'; e.style.display = 'block'; return; }
        try {
            await fetch('/api/turnos/entregas/registrar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cliente_nombre: n, descripcion: d, tipo, pedidos }) });
            document.getElementById('tBNombre').value = ''; document.getElementById('tBPedidos').value = '';
            document.getElementById('tBError').style.display = 'none';
            this.bCargar();
        } catch(e) {}
    },

    async bEntregar(id) { try { await fetch(`/api/turnos/entregas/${id}/entregar`, { method: 'POST' }); this.bCargar(); } catch(e) {} },

    async verAdjuntos(turnoId) {
        try {
            const r = await fetch(`/api/turnos/${turnoId}/adjuntos`);
            const adjuntos = await r.json();
            if (!Array.isArray(adjuntos) || adjuntos.length === 0) { App.showAlert('No hay archivos adjuntos'); return; }
            const html = adjuntos.map(a => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--border)">
                    <span style="font-size:13px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" style="vertical-align:-2px;margin-right:4px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>${escapeHtml(a.nombre)}</span>
                    <a href="/api/turnos/adjunto/${a.id}" target="_blank" class="btn btn-sm btn-outline" style="padding:4px 10px;font-size:11px;color:var(--info);border-color:var(--info)">Ver PDF</a>
                </div>
            `).join('');
            App.showModal(`<div>${html}</div>`, { title: 'Archivos Adjuntos' });
        } catch(e) { App.showAlert('Error al cargar adjuntos', 'danger'); }
    },
    async eliminarEntrega(id) { if (!confirm('Eliminar?')) return; try { await fetch(`/api/turnos/eliminar-entrega/${id}`, { method: 'DELETE' }); this.bCargar(); } catch(e) {} },

    // ═══════ QR ═══════
    showQR() {
        this.currentView = 'qr';
        this.stopPolling();
        const c = document.getElementById('turnosContent');
        const baseUrl = window.location.origin;
        const registroUrl = baseUrl + '/turnos/?view=registro';
        c.innerHTML = '<style>'
            + '@keyframes tFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}'
            + '.t-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}'
            + '.t-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important}'
            + '</style>'

            + '<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:24px 28px;margin-bottom:20px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">'
            + '<div style="position:absolute;top:-30px;right:-30px;width:140px;height:140px;background:radial-gradient(circle,rgba(245,158,11,0.2) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="position:relative;z-index:1"><h2 style="margin:0;font-size:22px;font-weight:800;color:white;letter-spacing:-0.5px">QR Clientes</h2>'
            + '<p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.7)">Codigo QR para que los clientes tomen turno</p></div></div>'

            + '<div class="t-card" style="background:white;border:1px solid #e2e8f0;border-radius:14px;text-align:center;margin-bottom:16px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.04)">'
            + '<h3 style="font-size:14px;font-weight:700;margin:0 0 16px;color:#1e293b">Escanea para tomar turno</h3>'
            + '<div id="tQRImg" style="background:white;padding:16px;border-radius:12px;display:inline-block;border:1px solid #e2e8f0"></div>'
            + '<p id="tQRUrl" style="color:#94a3b8;font-size:11px;word-break:break-all;margin-top:12px">' + registroUrl + '</p></div>'

            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">'
            + '<div class="t-card" style="background:white;border:1px solid #e2e8f0;border-left:4px solid #3b82f6;border-radius:10px;padding:16px 18px;box-shadow:0 1px 3px rgba(0,0,0,0.04)">'
            + '<div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Total hoy</div>'
            + '<div id="tQRTotal" style="font-size:28px;font-weight:800;color:#1e293b;line-height:1">0</div></div>'
            + '<div class="t-card" style="background:white;border:1px solid #e2e8f0;border-left:4px solid #f59e0b;border-radius:10px;padding:16px 18px;box-shadow:0 1px 3px rgba(0,0,0,0.04)">'
            + '<div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">En espera</div>'
            + '<div id="tQRCola" style="font-size:28px;font-weight:800;color:#1e293b;line-height:1">0</div></div></div>';
        this.generateQR(registroUrl);
        this.qrCargar();
        this.interval = setInterval(() => this.qrCargar(), 15000);
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
    },

    // ═══════ ALMACÉN ═══════
    async showAlmacen() {
        this.currentView = 'almacen';
        this.stopPolling();
        const c = document.getElementById('turnosContent');
        let tecnicos = [];
        try { tecnicos = await fetch('/api/turnos/tecnicos-almacen').then(r => r.json()); } catch(e) {}
        c.innerHTML = '<style>'
            + '@keyframes tFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}'
            + '.t-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}'
            + '.t-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important}'
            + '</style>'

            + '<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:24px 28px;margin-bottom:20px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">'
            + '<div style="position:absolute;top:-30px;right:-30px;width:140px;height:140px;background:radial-gradient(circle,rgba(245,158,11,0.2) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="position:relative;z-index:1"><h2 style="margin:0;font-size:22px;font-weight:800;color:white;letter-spacing:-0.5px">Almacen</h2>'
            + '<p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.7)">Carga de productos y picking</p></div></div>'

            + '<div class="t-card" style="background:white;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.04)">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;cursor:pointer" onclick="App.modules.turnos.toggleFormTecAlm()">'
            + '<h3 style="font-size:14px;font-weight:700;color:#1e293b;margin:0">Encargados de Atencion y Carga</h3>'
            + '<span id="tTecAlmArrow" style="color:#94a3b8;font-size:12px;transition:transform 0.2s">&#9660;</span></div>'
            + '<div id="tTecAlmBody" style="display:none;padding:0 20px 20px;border-top:1px solid #f1f5f9">'
            + '<div style="display:flex;gap:8px;margin-top:16px">'
            + '<input id="tTecAlmNombre" type="text" placeholder="Nombre del encargado" style="flex:1;font-size:13px;background:#f8fafc;border:1px solid #e2e8f0;color:#1e293b;padding:10px 12px;border-radius:8px" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'">'
            + '<button onclick="App.modules.turnos.addTecnicoAlm()" title="Agregar encargado" style="padding:10px 18px;background:linear-gradient(135deg,#3b82f6,#2563eb);color:white;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:background 0.15s" onmouseover="this.style.background=\'#1d4ed8\'" onmouseout="this.style.background=\'linear-gradient(135deg,#3b82f6,#2563eb)\'">Agregar</button></div>'
            + '<div id="tTecAlmList" style="margin-top:12px">' + (tecnicos.length === 0 ? '<div style="color:#94a3b8;font-size:12px;padding:8px">Sin encargados registrados</div>' : tecnicos.map(function(t) { return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #f1f5f9"><span style="font-size:13px;color:#1e293b">' + escapeHtml(t.nombre) + '</span><button onclick="App.modules.turnos.delTecnicoAlm(' + t.id + ')" title="Eliminar" class="btn btn-sm btn-danger"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></div>'; }).join('')) + '</div></div></div>'

            + '<div class="t-card" style="background:white;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.04)">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #f1f5f9">'
            + '<h3 style="font-size:14px;font-weight:700;color:#1e293b;margin:0">Pendientes de Carga</h3>'
            + '<span id="tAlmPendBadge" style="font-size:12px;font-weight:700;color:white;background:#f59e0b;padding:3px 10px;border-radius:20px">0</span></div>'
            + '<div id="tAlmPendList"><div style="text-align:center;color:#94a3b8;padding:20px;font-size:13px">No hay pendientes</div></div></div>'

            + '<div class="t-card" style="background:white;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04)">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #f1f5f9">'
            + '<h3 style="font-size:14px;font-weight:700;color:#1e293b;margin:0">Cargados Hoy</h3>'
            + '<span id="tAlmDoneBadge" style="font-size:12px;font-weight:700;color:white;background:#22c55e;padding:3px 10px;border-radius:20px">0</span></div>'
            + '<div id="tAlmDoneList"><div style="text-align:center;color:#94a3b8;padding:20px;font-size:13px">Sin cargados hoy</div></div></div>'

            + '<div id="tModalCargado" style="display:none;position:fixed;inset:0;z-index:40;align-items:center;justify-content:center;background:rgba(15,23,42,0.5);backdrop-filter:blur(4px)">'
            + '<div style="background:white;border:1px solid #e2e8f0;border-radius:16px;padding:24px;width:90%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,0.2)">'
            + '<h3 style="font-size:18px;font-weight:700;margin:0 0 8px;color:#1e293b">Marcar como Cargado</h3>'
            + '<p style="font-size:13px;color:#64748b;margin:0 0 16px">Agrega una observacion antes de enviar a Por Facturar.</p>'
            + '<div style="margin-bottom:16px"><label style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Observacion (opcional)</label>'
            + '<textarea id="tCargadoObs" rows="3" placeholder="Ej: Productos completos, falta item X, etc." style="font-size:13px;width:100%;background:#f8fafc;border:1px solid #e2e8f0;color:#1e293b;padding:10px 12px;border-radius:8px;box-sizing:border-box;resize:vertical" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'"></textarea></div>'
            + '<div style="display:flex;gap:8px">'
            + '<button onclick="App.modules.turnos.cerrarModalCargado()" class="btn btn-outline" style="flex:1">Cancelar</button>'
            + '<button onclick="App.modules.turnos.confirmarCargado()" id="tCargadoBtn" class="btn btn-primary" style="flex:2">Confirmar Cargado</button></div></div></div>';
        await this.almCargar();
        this.interval = setInterval(() => this.almCargar(), 15000);
    },

    toggleFormTecAlm() {
        const body = document.getElementById('tTecAlmBody');
        const arrow = document.getElementById('tTecAlmArrow');
        if (body.style.display === 'none') { body.style.display = 'block'; arrow.style.transform = 'rotate(180deg)'; }
        else { body.style.display = 'none'; arrow.style.transform = 'rotate(0deg)'; }
    },

    async addTecnicoAlm() {
        const nombre = document.getElementById('tTecAlmNombre').value.trim();
        if (!nombre) return;
        await fetch('/api/turnos/tecnicos-almacen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre }) });
        document.getElementById('tTecAlmNombre').value = '';
        this.showAlmacen();
    },

    async delTecnicoAlm(id) {
        if (!confirm('Eliminar este encargado?')) return;
        await fetch(`/api/turnos/tecnicos-almacen/${id}`, { method: 'DELETE' });
        this.showAlmacen();
    },

    async almCargar() {
        try {
            const [pR, aR] = await Promise.all([fetch('/api/turnos/almacen/pendientes'), fetch('/api/turnos/reporte')]);
            const p = await pR.json();
            const all = await aR.json();
            const cargados = all.filter(r => r.turno_estado === 'cargado');
            const pb = document.getElementById('tAlmPendBadge'); if (pb) pb.textContent = p.length;
            const db = document.getElementById('tAlmDoneBadge'); if (db) db.textContent = cargados.length;
            const pl = document.getElementById('tAlmPendList');
            if (pl) pl.innerHTML = p.length === 0 ? '<div style="text-align:center;color:#94a3b8;padding:20px;font-size:13px">No hay pendientes</div>' : p.map(e => `
                <div style="padding:14px 20px;border-bottom:1px solid #f1f5f9;transition:background 0.1s" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
                        <div>
                            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                                <span style="color:#1e40af;font-weight:800;font-size:15px;font-family:'SF Mono','Consolas',monospace">#${e.turno_numero}</span>
                                <span style="font-weight:700;color:#1e293b">${escapeHtml(e.cliente_nombre)}</span>
                                ${e.tecnico_nombre ? `<span style="font-size:10px;font-weight:600;color:#1e40af;background:#eff6ff;padding:2px 8px;border-radius:4px">Encargado: ${escapeHtml(e.tecnico_nombre)}</span>` : ''}
                                ${e.motivo ? `<span style="font-size:10px;font-weight:600;color:#7c3aed;background:#f3e8ff;padding:2px 8px;border-radius:4px">${escapeHtml(e.motivo)}</span>` : ''}
                            </div>
                            <div style="font-size:12px;color:#94a3b8;margin-top:6px">${e.observaciones_almacen ? `Obs: ${escapeHtml(e.observaciones_almacen)}` : ''}${e.pedidos ? `${e.observaciones_almacen ? ' · ' : ''}Pedido: ${escapeHtml(e.pedidos)}` : ''}</div>
                        </div>
                        <div style="display:flex;gap:6px;align-items:center">
                            ${Number(e.adjuntos_count) > 0 ? `<button onclick="App.modules.turnos.verAdjuntos(${e.turno_id})" style="padding:5px 10px;font-size:11px;font-weight:600;color:#7c3aed;background:#f3e8ff;border:1px solid #e9d5ff;border-radius:6px;cursor:pointer;transition:all 0.15s" onmouseover="this.style.background='#ede9fe'" onmouseout="this.style.background='#f3e8ff'">PDF (${e.adjuntos_count})</button>` : ''}
                            <button class="btn btn-primary btn-sm" title="Marcar como cargado" onclick="App.modules.turnos.abrirModalCargado(${e.id})">Cargado</button>
                        </div>
                    </div>
                </div>
            `).join('');
            const dl = document.getElementById('tAlmDoneList');
            if (dl) dl.innerHTML = cargados.length === 0 ? '<div style="text-align:center;color:#94a3b8;padding:20px;font-size:13px">Sin cargados hoy</div>' : cargados.map(r => `
                <div style="padding:14px 20px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;transition:background 0.1s" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                    <div style="display:flex;align-items:center;gap:8px">
                        <span style="color:#1e40af;font-weight:800;font-family:'SF Mono','Consolas',monospace">#${r.numero || '-'}</span>
                        <span style="font-weight:700;color:#1e293b">${escapeHtml(r.nombre || '-')}</span>
                        <span style="font-size:10px;font-weight:600;color:#166534;background:#dcfce7;padding:2px 8px;border-radius:4px">Cargado</span>
                    </div>
                    <span style="font-size:12px;color:#94a3b8;font-family:'SF Mono','Consolas',monospace">${this.fmtTime(r.hora_cargada)}</span>
                </div>
            `).join('');
        } catch(e) {}
    },

    pendingCargado: null,

    abrirModalCargado(entregaId) {
        this.pendingCargado = entregaId;
        document.getElementById('tCargadoObs').value = '';
        document.getElementById('tModalCargado').style.display = 'flex';
        document.getElementById('tCargadoObs').focus();
    },

    cerrarModalCargado() {
        document.getElementById('tModalCargado').style.display = 'none';
        this.pendingCargado = null;
    },

    async confirmarCargado() {
        if (!this.pendingCargado) return;
        const obs = document.getElementById('tCargadoObs').value.trim();
        const btn = document.getElementById('tCargadoBtn'); btn.disabled = true; btn.textContent = 'PROCESANDO...';
        await fetch('/api/turnos/cargado', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entrega_id: this.pendingCargado, observaciones: obs }) });
        this.cerrarModalCargado();
        App.showAlert('Marcado como cargado');
        this.almCargar();
        btn.disabled = false; btn.textContent = 'CONFIRMAR CARGADO';
    },

    async marcarCargado(entregaId) {
        if (!confirm('Marcar como CARGADO? Se enviará a Por Facturar.')) return;
        await fetch('/api/turnos/cargado', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entrega_id: entregaId }) });
        App.showAlert('Marcado como cargado');
        this.almCargar();
    },

    // ═══════ POR FACTURAR ═══════
    async showFacturar() {
        this.currentView = 'facturar';
        this.stopPolling();
        const c = document.getElementById('turnosContent');
        c.innerHTML = '<style>'
            + '@keyframes tFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}'
            + '.t-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}'
            + '.t-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important}'
            + '</style>'

            + '<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:24px 28px;margin-bottom:20px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">'
            + '<div style="position:absolute;top:-30px;right:-30px;width:140px;height:140px;background:radial-gradient(circle,rgba(124,58,237,0.2) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="position:relative;z-index:1"><h2 style="margin:0;font-size:22px;font-weight:800;color:white;letter-spacing:-0.5px">Por Facturar</h2>'
            + '<p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.7)">Ingresar numero y monto de factura</p></div></div>'

            + '<div class="t-card" style="background:white;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.04)">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #f1f5f9">'
            + '<h3 style="font-size:14px;font-weight:700;color:#1e293b;margin:0">Pendientes de Facturar</h3>'
            + '<span id="tFacPendBadge" style="font-size:12px;font-weight:700;color:white;background:#f59e0b;padding:3px 10px;border-radius:20px">0</span></div>'
            + '<div id="tFacPendList"><div style="text-align:center;color:#94a3b8;padding:20px;font-size:13px">No hay pendientes</div></div></div>'

            + '<div class="t-card" style="background:white;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04)">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #f1f5f9">'
            + '<h3 style="font-size:14px;font-weight:700;color:#1e293b;margin:0">Facturados Hoy</h3>'
            + '<span id="tFacDoneBadge" style="font-size:12px;font-weight:700;color:white;background:#22c55e;padding:3px 10px;border-radius:20px">0</span></div>'
            + '<div id="tFacDoneList"><div style="text-align:center;color:#94a3b8;padding:20px;font-size:13px">Sin facturados hoy</div></div></div>';
        await this.facCargar();
        this.interval = setInterval(() => this.facCargar(), 15000);
    },

    async facCargar() {
        try {
            const [pR, eR] = await Promise.all([fetch('/api/turnos/facturar/pendientes'), fetch('/api/turnos/entregas')]);
            const p = await pR.json();
            const all = await eR.json();
            const facturados = all.filter(e => e.estado === 'facturado');
            const pb = document.getElementById('tFacPendBadge'); if (pb) pb.textContent = p.length;
            const db = document.getElementById('tFacDoneBadge'); if (db) db.textContent = facturados.length;
            const pl = document.getElementById('tFacPendList');
            if (pl) pl.innerHTML = p.length === 0 ? '<div style="text-align:center;color:#94a3b8;padding:20px;font-size:13px">No hay pendientes</div>' : p.map(e => `
                <div style="padding:14px 20px;border-bottom:1px solid #f1f5f9;transition:background 0.1s" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">
                        <span style="color:#1e40af;font-weight:800;font-size:15px;font-family:'SF Mono','Consolas',monospace">#${e.turno_numero}</span>
                        <span style="font-weight:700;color:#1e293b">${escapeHtml(e.cliente_nombre)}</span>
                        ${e.tecnico_nombre ? `<span style="font-size:10px;font-weight:600;color:#1e40af;background:#eff6ff;padding:2px 8px;border-radius:4px">Encargado: ${escapeHtml(e.tecnico_nombre)}</span>` : ''}
                        ${e.motivo ? `<span style="font-size:10px;font-weight:600;color:#7c3aed;background:#f3e8ff;padding:2px 8px;border-radius:4px">${escapeHtml(e.motivo)}</span>` : ''}
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                        <div>
                            <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">N Factura</label>
                            <input id="facNum_${e.id}" type="text" placeholder="Ej: F-12345" style="font-size:13px;width:100%;background:#f8fafc;border:1px solid #e2e8f0;color:#1e293b;padding:10px 12px;border-radius:8px;box-sizing:border-box" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'">
                        </div>
                        <div>
                            <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">Monto Factura</label>
                            <input id="facMonto_${e.id}" type="number" placeholder="0" style="font-size:13px;width:100%;background:#f8fafc;border:1px solid #e2e8f0;color:#1e293b;padding:10px 12px;border-radius:8px;box-sizing:border-box" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'">
                        </div>
                    </div>
                    <button class="btn btn-primary" title="Facturar" onclick="App.modules.turnos.facturar(${e.id})" style="width:100%;margin-top:12px;text-transform:uppercase">Facturar</button>
                    ${e.pedidos ? `<div style="font-size:12px;color:#94a3b8;margin-top:8px">Pedido: <span style="color:#1e40af;font-weight:600">${escapeHtml(e.pedidos)}</span></div>` : ''}
                </div>
            `).join('');
            const dl = document.getElementById('tFacDoneList');
            if (dl) dl.innerHTML = facturados.length === 0 ? '<div style="text-align:center;color:#94a3b8;padding:20px;font-size:13px">Sin facturados hoy</div>' : facturados.map(e => `
                <div style="padding:14px 20px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;transition:background 0.1s" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                        <span style="font-weight:700;color:#1e293b">${escapeHtml(e.cliente_nombre || '-')}</span>
                        <span style="font-size:10px;font-weight:600;color:#166534;background:#dcfce7;padding:2px 8px;border-radius:4px">Fact: ${escapeHtml(e.numero_factura || '-')}</span>
                        <span style="font-size:12px;color:#1e293b;font-weight:600;font-family:'SF Mono','Consolas',monospace">$${Number(e.monto_factura || 0).toLocaleString('es-CL')}</span>
                    </div>
                    <span style="font-size:12px;color:#94a3b8;font-family:'SF Mono','Consolas',monospace">${this.fmtTime(e.hora_facturada)}</span>
                </div>
            `).join('');
        } catch(e) {}
    },

    async facturar(entregaId) {
        const num = document.getElementById('facNum_' + entregaId)?.value.trim();
        const monto = document.getElementById('facMonto_' + entregaId)?.value;
        if (!num) { App.showAlert('Ingresa el número de factura', 'danger'); return; }
        if (!confirm('Confirmar facturación? Se cerrará el ciclo.')) return;
        await fetch('/api/turnos/facturar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entrega_id: entregaId, numero_factura: num, monto_factura: Number(monto) || 0 }) });
        App.showAlert('Facturado correctamente');
        this.facCargar();
    }
});
