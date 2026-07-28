App.registerModule('reporte_turnos', {
    registros: [],
    pendingDelete: null,

    async render() {
        const el = document.getElementById('page-reporte_turnos');
        const hoy = new Date().toISOString().substring(0, 10);
        const hace30 = new Date(Date.now() - 30*86400000).toISOString().substring(0, 10);
        el.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
                <div><h2 style="margin:0;color:#e2e8f0">Reporte de Turnos</h2><div style="font-size:12px;color:#7eb8dc;margin-top:2px">Flujo completo por cliente: llegada, atencion, bodega y entrega</div></div>
            </div>
            <div style="background:rgba(14,30,60,0.7);border:1px solid rgba(59,130,246,0.15);border-radius:12px;padding:16px;margin-bottom:16px">
                <div style="display:flex;gap:12px;align-items:end;flex-wrap:wrap">
                    <div style="margin:0"><label style="font-size:11px;color:#7eb8dc;display:block;margin-bottom:4px">Desde</label><input type="date" id="rtDesde" class="form-control" value="${hace30}" style="font-size:13px;background:rgba(8,18,40,0.9);border:1px solid rgba(59,130,246,0.2);color:#e2e8f0;padding:8px 10px;border-radius:8px"></div>
                    <div style="margin:0"><label style="font-size:11px;color:#7eb8dc;display:block;margin-bottom:4px">Hasta</label><input type="date" id="rtHasta" class="form-control" value="${hoy}" style="font-size:13px;background:rgba(8,18,40,0.9);border:1px solid rgba(59,130,246,0.2);color:#e2e8f0;padding:8px 10px;border-radius:8px"></div>
                    <button onclick="App.modules.reporte_turnos.cargar()" style="font-size:13px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#0f172a;border:none;padding:9px 20px;border-radius:8px;font-weight:700;cursor:pointer">Buscar</button>
                </div>
            </div>
            <div id="rtContent"><div style="text-align:center;color:#7eb8dc;padding:40px">Cargando...</div></div>
            <div id="rtModalPass" style="display:none;position:fixed;inset:0;z-index:40;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px)">
                <div style="background:#0e1e3c;border:1px solid rgba(59,130,246,0.2);border-radius:14px;padding:24px;width:90%;max-width:360px;box-shadow:0 8px 32px rgba(0,0,0,0.5)">
                    <h3 style="font-size:16px;font-weight:700;margin-bottom:10px;color:#e2e8f0">Confirmar eliminacion</h3>
                    <p style="font-size:12px;color:#7eb8dc;margin-bottom:14px">Ingresa la contrasena de administrador para eliminar este registro.</p>
                    <input id="rtPassInput" type="password" placeholder="Contrasena admin" style="font-size:13px;width:100%;background:rgba(8,18,40,0.9);border:1px solid rgba(59,130,246,0.2);color:#e2e8f0;padding:10px 12px;border-radius:8px;margin-bottom:4px" onkeydown="if(event.key==='Enter')App.modules.reporte_turnos.confirmarEliminar()">
                    <p id="rtPassError" style="color:#f87171;font-size:11px;display:none;margin-top:6px"></p>
                    <div style="display:flex;gap:8px;margin-top:14px">
                        <button onclick="App.modules.reporte_turnos.cerrarModal()" style="flex:1;background:rgba(59,130,246,0.12);color:#93c5fd;border:1px solid rgba(59,130,246,0.25);padding:9px;border-radius:8px;font-size:13px;cursor:pointer">Cancelar</button>
                        <button onclick="App.modules.reporte_turnos.confirmarEliminar()" id="rtPassBtn" style="flex:1;background:rgba(239,68,68,0.2);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);padding:9px;border-radius:8px;font-size:13px;cursor:pointer;font-weight:600">Eliminar</button>
                    </div>
                </div>
            </div>
        `;
        await this.cargar();
    },

    solicitarPass(tipo, id) {
        this.pendingDelete = { tipo, id };
        document.getElementById('rtPassInput').value = '';
        document.getElementById('rtPassError').style.display = 'none';
        document.getElementById('rtModalPass').style.display = 'flex';
        document.getElementById('rtPassInput').focus();
    },

    cerrarModal() {
        document.getElementById('rtModalPass').style.display = 'none';
        this.pendingDelete = null;
    },

    async confirmarEliminar() {
        if (!this.pendingDelete) return;
        const pass = document.getElementById('rtPassInput').value.trim();
        if (!pass) { document.getElementById('rtPassError').textContent = 'Ingresa la contrasena'; document.getElementById('rtPassError').style.display = 'block'; return; }
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const btn = document.getElementById('rtPassBtn');
        btn.disabled = true; btn.textContent = 'Verificando...';
        try {
            const checkRes = await fetch('/api/auth/verify-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, password: pass })
            });
            const check = await checkRes.json();
            if (!check.ok) {
                document.getElementById('rtPassError').textContent = 'Contrasena incorrecta';
                document.getElementById('rtPassError').style.display = 'block';
                btn.disabled = false; btn.textContent = 'Eliminar';
                return;
            }
            const { tipo, id } = this.pendingDelete;
            const url = tipo === 'turno' ? `/api/turnos/eliminar-turno/${id}` : `/api/turnos/eliminar-entrega/${id}`;
            await fetch(url, { method: 'DELETE' });
            this.cerrarModal();
            App.showAlert('Registro eliminado');
            await this.cargar();
        } catch(e) {
            document.getElementById('rtPassError').textContent = 'Error de conexion';
            document.getElementById('rtPassError').style.display = 'block';
        }
        btn.disabled = false; btn.textContent = 'Eliminar';
    },

    async cargar() {
        const desde = document.getElementById('rtDesde')?.value || '';
        const hasta = document.getElementById('rtHasta')?.value || '';
        try {
            const params = new URLSearchParams();
            if (desde) params.set('desde', desde);
            if (hasta) params.set('hasta', hasta);
            const [resT, resE] = await Promise.all([
                fetch(`/api/turnos/reporte?${params}`),
                fetch(`/api/turnos/reporte-entregas?${params}`)
            ]);
            const turnos = await resT.json();
            const entregasSinTurno = await resE.json();

            // Turnos ya incluyen su entrega (LEFT JOIN), son el flujo principal
            const flujo = turnos.map(t => ({
                id: t.turno_id,
                fecha: t.fecha,
                fecha_fmt: t.fecha_fmt,
                nombre: t.nombre,
                rut: t.rut || '',
                patente: t.patente || '',
                motivo: t.motivo || '',
                rut_empresa: t.rut_empresa || '',
                numero: t.numero,
                turno_estado: t.turno_estado,
                hora_llegada: t.hora_creacion,
                hora_llamado: t.hora_llamada,
                hora_atencion: t.hora_fin,
                hora_bodega: t.bodega_recibido,
                hora_verificado: t.hora_verificada,
                hora_cargado: t.hora_cargada,
                hora_facturado: t.hora_facturada,
                hora_entrega: t.bodega_entregado,
                espera_seg: t.espera_seg,
                recepcion_seg: t.recepcion_seg,
                verificacion_seg: t.verificacion_seg,
                almacen_seg: t.almacen_seg,
                facturacion_seg: t.facturacion_seg,
                total_seg: t.total_seg,
                pedidos: t.pedidos,
                factura: t.numero_factura || t.factura || '',
                monto_factura: t.monto_factura || 0,
                tipo: t.tipo,
                entrega_estado: t.entrega_estado,
                entrega_id: t.entrega_id,
                _origen: 'turno'
            }));

            // Entregas sin turno (bodega directa)
            const sinTurno = entregasSinTurno.map(e => ({
                id: e.id,
                fecha: e.fecha,
                fecha_fmt: e.fecha ? new Date(e.fecha).toLocaleDateString('es-CL') : '-',
                nombre: e.cliente_nombre,
                rut: '',
                numero: null,
                turno_estado: null,
                hora_llegada: null,
                hora_llamado: null,
                hora_atencion: null,
                hora_bodega: e.hora_registrada,
                hora_entrega: e.hora_entregada,
                espera_segundos: null,
                recepcion_segundos: null,
                bodega_segundos: null,
                total_segundos: null,
                pedidos: e.pedidos,
                factura: e.factura,
                tipo: e.tipo,
                entrega_estado: e.estado,
                entrega_id: e.id,
                _origen: 'bodega'
            }));

            this.registros = [...flujo, ...sinTurno].sort((a, b) => {
                const fa = a.fecha || '', fb = b.fecha || '';
                if (fa !== fb) return fb.localeCompare(fa);
                return (a.numero || 9999) - (b.numero || 9999);
            });
            this.renderTabla();
        } catch(e) {
            document.getElementById('rtContent').innerHTML = '<div style="text-align:center;color:#f87171;padding:40px">Error al cargar</div>';
        }
    },

    renderTabla() {
        const div = document.getElementById('rtContent');
        if (this.registros.length === 0) {
            div.innerHTML = '<div style="text-align:center;color:#7eb8dc;padding:40px">No hay registros en este rango</div>';
            return;
        }
        const total = this.registros.length;
        const conEntrega = this.registros.filter(r => r.entrega_estado === 'facturado' || r.entrega_estado === 'completado').length;
        const pendientes = this.registros.filter(r => r.entrega_estado === 'pendiente' || r.entrega_estado === 'verificado').length;
        const tiempos = this.registros.filter(r => r.total_seg != null).map(r => r.total_seg);
        const promedio = tiempos.length > 0 ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length) : 0;

        let html = `
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
                <div style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2);border-radius:10px;padding:16px;text-align:center"><div style="font-size:28px;font-weight:800;color:#60a5fa">${total}</div><div style="font-size:11px;color:#7eb8dc;margin-top:2px">Total flujos</div></div>
                <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);border-radius:10px;padding:16px;text-align:center"><div style="font-size:28px;font-weight:800;color:#4ade80">${conEntrega}</div><div style="font-size:11px;color:#7eb8dc;margin-top:2px">Entregados</div></div>
                <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);border-radius:10px;padding:16px;text-align:center"><div style="font-size:28px;font-weight:800;color:#fbbf24">${pendientes}</div><div style="font-size:11px;color:#7eb8dc;margin-top:2px">Pend. bodega</div></div>
                <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.15);border-radius:10px;padding:16px;text-align:center"><div style="font-size:28px;font-weight:800;color:#93c5fd">${this.fmtSec(promedio)}</div><div style="font-size:11px;color:#7eb8dc;margin-top:2px">Tiempo prom. total</div></div>
            </div>
            <div style="background:rgba(14,30,60,0.7);border:1px solid rgba(59,130,246,0.12);border-radius:12px;padding:0;overflow-x:auto">
                <table style="width:100%;font-size:12px;border-collapse:collapse">
                    <thead><tr style="border-bottom:2px solid rgba(245,158,11,0.3)">
                        <th style="padding:10px 8px;text-align:left;color:#fbbf24;font-weight:600;font-size:11px">FECHA</th>
                        <th style="padding:10px 8px;text-align:center;color:#fbbf24;font-weight:600;font-size:11px">#</th>
                        <th style="padding:10px 8px;text-align:left;color:#fbbf24;font-weight:600;font-size:11px">CLIENTE</th>
                        <th style="padding:10px 8px;text-align:left;color:#fbbf24;font-weight:600;font-size:11px">PATENTE</th>
                        <th style="padding:10px 8px;text-align:left;color:#fbbf24;font-weight:600;font-size:11px">MOTIVO</th>
                        <th style="padding:10px 8px;text-align:left;color:#fbbf24;font-weight:600;font-size:11px">RUT EMPRESA</th>
                        <th style="padding:10px 8px;text-align:center;color:#fbbf24;font-weight:600;font-size:11px">LLEGADA</th>
                        <th style="padding:10px 8px;text-align:center;color:#fbbf24;font-weight:600;font-size:11px">LLAMADO</th>
                        <th style="padding:10px 8px;text-align:center;color:#fbbf24;font-weight:600;font-size:11px">ATENCIÓN</th>
                        <th style="padding:10px 8px;text-align:center;color:#fbbf24;font-weight:600;font-size:11px">VERIF.</th>
                        <th style="padding:10px 8px;text-align:center;color:#fbbf24;font-weight:600;font-size:11px">CARGADO</th>
                        <th style="padding:10px 8px;text-align:center;color:#fbbf24;font-weight:600;font-size:11px">FACTURADO</th>
                        <th style="padding:10px 8px;text-align:center;color:#fbbf24;font-weight:600;font-size:11px">ESPERA</th>
                        <th style="padding:10px 8px;text-align:center;color:#fbbf24;font-weight:600;font-size:11px">RECEP.</th>
                        <th style="padding:10px 8px;text-align:center;color:#fbbf24;font-weight:600;font-size:11px">VERIF.</th>
                        <th style="padding:10px 8px;text-align:center;color:#fbbf24;font-weight:600;font-size:11px">ALMAC.</th>
                        <th style="padding:10px 8px;text-align:center;color:#fbbf24;font-weight:600;font-size:11px">FACT.</th>
                        <th style="padding:10px 8px;text-align:center;color:#fbbf24;font-weight:700;font-size:11px">TOTAL</th>
                        <th style="padding:10px 8px;text-align:left;color:#fbbf24;font-weight:600;font-size:11px">PEDIDO</th>
                        <th style="padding:10px 8px;text-align:left;color:#fbbf24;font-weight:600;font-size:11px">N° FACTURA</th>
                        <th style="padding:10px 8px;text-align:right;color:#fbbf24;font-weight:600;font-size:11px">MONTO</th>
                        <th style="padding:10px 8px;text-align:center;color:#fbbf24;font-weight:600;font-size:11px">ESTADO</th>
                        <th style="padding:10px 8px;text-align:center;color:#fbbf24;font-weight:600;font-size:11px">ACCION</th>
                    </tr></thead>
                    <tbody>${this.filasHtml()}</tbody>
                </table>
            </div>
        `;
        div.innerHTML = html;
    },

    filasHtml() {
        return this.registros.map(r => {
            const estado = r.entrega_estado || r.turno_estado || '-';
            const estadoStyle = {
                'entregado': 'background:rgba(34,197,94,0.15);color:#86efac',
                'pendiente': 'background:rgba(245,158,11,0.15);color:#fcd34d',
                'atendido': 'background:rgba(34,197,94,0.15);color:#86efac',
                'derivado': 'background:rgba(59,130,246,0.15);color:#93c5fd',
                'atendiendo': 'background:rgba(245,158,11,0.15);color:#fcd34d',
                'espera': 'background:rgba(59,130,246,0.12);color:#93c5fd',
                'verificado': 'background:rgba(139,92,246,0.15);color:#d8b4fe',
                'cargado': 'background:rgba(6,182,212,0.15);color:#67e8f9',
                'facturado': 'background:rgba(16,185,129,0.15);color:#6ee7b7',
                'completado': 'background:rgba(34,197,94,0.15);color:#86efac'
            }[estado] || 'background:rgba(59,130,246,0.12);color:#93c5fd';
            const tipoBadge = r.tipo ? `<span style="font-size:9px;padding:2px 6px;border-radius:4px;background:${r.tipo==='Despacho'?'rgba(245,158,11,0.12)':'rgba(34,197,94,0.12)'};color:${r.tipo==='Despacho'?'#fcd34d':'#86efac'};margin-left:4px">${r.tipo}</span>` : '';
            return `<tr style="border-bottom:1px solid rgba(59,130,246,0.08)">
                <td style="padding:8px;font-size:11px;color:#93c5fd">${r.fecha_fmt || '-'}</td>
                <td style="padding:8px;text-align:center;font-weight:700;color:#fbbf24;font-size:12px">${r.numero ? '#' + r.numero : (r._origen === 'bodega' ? 'BOD' : '-')}</td>
                <td style="padding:8px;font-weight:600;color:#e2e8f0">${escapeHtml(r.nombre)}</td>
                <td style="padding:8px;font-size:11px;font-weight:600;color:#93c5fd">${escapeHtml(r.patente || '-')}</td>
                <td style="padding:8px;font-size:11px;color:#7eb8dc">${escapeHtml(r.motivo || '-')}</td>
                <td style="padding:8px;font-size:11px;color:#7eb8dc">${escapeHtml(r.rut_empresa || '-')}</td>
                <td style="padding:8px;text-align:center;font-size:11px;color:#7eb8dc">${this.fmtTime(r.hora_llegada)}</td>
                <td style="padding:8px;text-align:center;font-size:11px;color:#7eb8dc">${this.fmtTime(r.hora_llamado)}</td>
                <td style="padding:8px;text-align:center;font-size:11px;color:#7eb8dc">${this.fmtTime(r.hora_atencion)}</td>
                <td style="padding:8px;text-align:center;font-size:11px;color:#7eb8dc">${this.fmtTime(r.hora_verificado)}</td>
                <td style="padding:8px;text-align:center;font-size:11px;color:#7eb8dc">${this.fmtTime(r.hora_cargado)}</td>
                <td style="padding:8px;text-align:center;font-size:11px;color:#7eb8dc">${this.fmtTime(r.hora_facturado)}</td>
                <td style="padding:8px;text-align:center;font-size:11px;color:#fbbf24">${this.fmtSec(r.espera_seg)}</td>
                <td style="padding:8px;text-align:center;font-size:11px;color:#93c5fd">${this.fmtSec(r.recepcion_seg)}</td>
                <td style="padding:8px;text-align:center;font-size:11px;color:#d8b4fe">${this.fmtSec(r.verificacion_seg)}</td>
                <td style="padding:8px;text-align:center;font-size:11px;color:#67e8f9">${this.fmtSec(r.almacen_seg)}</td>
                <td style="padding:8px;text-align:center;font-size:11px;color:#6ee7b7">${this.fmtSec(r.facturacion_seg)}</td>
                <td style="padding:8px;text-align:center;font-weight:900;font-size:12px;color:#fbbf24">${this.fmtSec(r.total_seg)}</td>
                <td style="padding:8px;font-size:11px;color:#7eb8dc">${escapeHtml(r.pedidos || '-')}</td>
                <td style="padding:8px;font-size:11px;color:#93c5fd">${escapeHtml(r.factura || '-')}</td>
                <td style="padding:8px;font-size:11px;text-align:right;color:#93c5fd">${r.monto_factura > 0 ? '$' + Number(r.monto_factura).toLocaleString('es-CL') : '-'}</td>
                <td style="padding:8px;text-align:center"><span style="font-size:10px;padding:3px 8px;border-radius:6px;font-weight:600;${estadoStyle}">${estado}</span>${tipoBadge}</td>
                <td style="padding:8px;text-align:center">${r._origen === 'turno' ? `<button style="background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);padding:3px 10px;border-radius:6px;font-size:10px;cursor:pointer;font-weight:600" onclick="App.modules.reporte_turnos.solicitarPass('turno',${r.id})">X</button>` : `<button style="background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);padding:3px 10px;border-radius:6px;font-size:10px;cursor:pointer;font-weight:600" onclick="App.modules.reporte_turnos.solicitarPass('entrega',${r.entrega_id})">X</button>`}</td>
            </tr>`;
        }).join('');
    },

    fmtSec(s) { if (s == null || isNaN(s)) return '-'; const m = Math.floor(s / 60); return m > 0 ? `${m}m ${s%60}s` : `${s}s`; },
    fmtTime(t) { if (!t) return '-'; return String(t).slice(0, 8); }
});
