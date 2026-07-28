App.registerModule('reporte_turnos', {
    registros: [],
    pendingDelete: null,

    async render() {
        const el = document.getElementById('page-reporte_turnos');
        const hoy = new Date().toISOString().substring(0, 10);
        const hace30 = new Date(Date.now() - 30*86400000).toISOString().substring(0, 10);
        el.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
                <div><h2 style="margin:0">Reporte de Turnos</h2><div class="subtitle">Flujo completo por cliente: llegada, atencion, bodega y entrega</div></div>
            </div>
            <div class="card" style="margin-bottom:16px">
                <div style="display:flex;gap:12px;align-items:end;flex-wrap:wrap">
                    <div class="form-group" style="margin:0"><label style="font-size:12px;color:var(--text-light)">Desde</label><input type="date" id="rtDesde" class="form-control" value="${hace30}" style="font-size:13px"></div>
                    <div class="form-group" style="margin:0"><label style="font-size:12px;color:var(--text-light)">Hasta</label><input type="date" id="rtHasta" class="form-control" value="${hoy}" style="font-size:13px"></div>
                    <button class="btn btn-primary" onclick="App.modules.reporte_turnos.cargar()" style="font-size:13px">Buscar</button>
                </div>
            </div>
            <div id="rtContent"><div style="text-align:center;color:var(--text-light);padding:40px">Cargando...</div></div>
            <div id="rtModalPass" style="display:none;position:fixed;inset:0;z-index:40;align-items:center;justify-content:center;background:rgba(0,0,0,0.5)">
                <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:24px;width:90%;max-width:360px;box-shadow:0 8px 32px rgba(0,0,0,0.2)">
                    <h3 style="font-size:16px;font-weight:700;margin-bottom:12px">Confirmar eliminacion</h3>
                    <p style="font-size:13px;color:var(--text-light);margin-bottom:12px">Ingresa la contrasena de administrador para eliminar este registro.</p>
                    <input id="rtPassInput" type="password" class="form-control" placeholder="Contrasena admin" style="font-size:13px" onkeydown="if(event.key==='Enter')App.modules.reporte_turnos.confirmarEliminar()">
                    <p id="rtPassError" style="color:var(--danger);font-size:12px;display:none;margin-top:8px"></p>
                    <div style="display:flex;gap:8px;margin-top:12px">
                        <button onclick="App.modules.reporte_turnos.cerrarModal()" class="btn" style="flex:1;background:var(--border);color:var(--text)">Cancelar</button>
                        <button onclick="App.modules.reporte_turnos.confirmarEliminar()" id="rtPassBtn" class="btn" style="flex:1;background:#ef4444;color:#fff">Eliminar</button>
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
            document.getElementById('rtContent').innerHTML = '<div style="text-align:center;color:var(--danger);padding:40px">Error al cargar</div>';
        }
    },

    renderTabla() {
        const div = document.getElementById('rtContent');
        if (this.registros.length === 0) {
            div.innerHTML = '<div style="text-align:center;color:var(--text-light);padding:40px">No hay registros en este rango</div>';
            return;
        }
        const total = this.registros.length;
        const conEntrega = this.registros.filter(r => r.entrega_estado === 'facturado' || r.entrega_estado === 'completado').length;
        const pendientes = this.registros.filter(r => r.entrega_estado === 'pendiente' || r.entrega_estado === 'verificado').length;
        const tiempos = this.registros.filter(r => r.total_seg != null).map(r => r.total_seg);
        const promedio = tiempos.length > 0 ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length) : 0;

        let html = `
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
                <div class="stat-card"><div class="stat-info"><h4>${total}</h4><p>Total flujos</p></div></div>
                <div class="stat-card"><div class="stat-info"><h4>${conEntrega}</h4><p>Entregados</p></div></div>
                <div class="stat-card"><div class="stat-info"><h4>${pendientes}</h4><p>Pend. bodega</p></div></div>
                <div class="stat-card"><div class="stat-info"><h4>${this.fmtSec(promedio)}</h4><p>Tiempo prom. total</p></div></div>
            </div>
            <div class="card">
                <div class="card-body" style="padding:0;overflow-x:auto">
                    <table style="width:100%;font-size:12px">
                        <thead><tr style="border-bottom:2px solid var(--border)">
                            <th style="padding:8px 10px;text-align:left">Fecha</th>
                            <th style="padding:8px 10px;text-align:center">#</th>
                            <th style="padding:8px 10px;text-align:left">Cliente</th>
                            <th style="padding:8px 10px;text-align:left">Patente</th>
                            <th style="padding:8px 10px;text-align:left">Motivo</th>
                            <th style="padding:8px 10px;text-align:left">Rut Empresa</th>
                            <th style="padding:8px 10px;text-align:center">Llegada</th>
                            <th style="padding:8px 10px;text-align:center">Llamado</th>
                            <th style="padding:8px 10px;text-align:center">Atención</th>
                            <th style="padding:8px 10px;text-align:center">Verif.</th>
                            <th style="padding:8px 10px;text-align:center">Cargado</th>
                            <th style="padding:8px 10px;text-align:center">Facturado</th>
                            <th style="padding:8px 10px;text-align:center">Espera</th>
                            <th style="padding:8px 10px;text-align:center">Recep.</th>
                            <th style="padding:8px 10px;text-align:center">Verif.</th>
                            <th style="padding:8px 10px;text-align:center">Almac.</th>
                            <th style="padding:8px 10px;text-align:center">Fact.</th>
                            <th style="padding:8px 10px;text-align:center;font-weight:700;color:var(--accent)">TOTAL</th>
                            <th style="padding:8px 10px;text-align:left">Pedido</th>
                            <th style="padding:8px 10px;text-align:left">N° Factura</th>
                            <th style="padding:8px 10px;text-align:right">Monto</th>
                            <th style="padding:8px 10px;text-align:center">Estado</th>
                            <th style="padding:8px 10px;text-align:center">Accion</th>
                        </tr></thead>
                        <tbody>${this.filasHtml()}</tbody>
                    </table>
                </div>
            </div>
        `;
        div.innerHTML = html;
    },

    filasHtml() {
        return this.registros.map(r => {
            const estado = r.entrega_estado || r.turno_estado || '-';
            const estadoColor = { 'entregado': '#22c55e', 'pendiente': '#f59e0b', 'atendido': '#22c55e', 'derivado': '#3b82f6', 'atendiendo': '#f59e0b', 'espera': '#94a3b8', 'verificado': '#8b5cf6', 'cargado': '#06b6d4', 'facturado': '#10b981', 'completado': '#22c55e' }[estado] || '#94a3b8';
            const tipoBadge = r.tipo ? `<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:${r.tipo==='Despacho'?'rgba(245,158,11,0.1)':'rgba(34,197,94,0.1)'};color:${r.tipo==='Despacho'?'var(--warning)':'var(--success)'}">${r.tipo}</span>` : '';
            return `<tr style="border-bottom:1px solid var(--border)">
                <td style="padding:8px 10px">${r.fecha_fmt || '-'}</td>
                <td style="padding:8px 10px;text-align:center;font-weight:700;color:var(--accent)">${r.numero ? '#' + r.numero : (r._origen === 'bodega' ? 'BOD' : '-')}</td>
                <td style="padding:8px 10px;font-weight:600">${escapeHtml(r.nombre)}</td>
                <td style="padding:8px 10px;font-size:11px;font-weight:600">${escapeHtml(r.patente || '-')}</td>
                <td style="padding:8px 10px;font-size:11px">${escapeHtml(r.motivo || '-')}</td>
                <td style="padding:8px 10px;font-size:11px">${escapeHtml(r.rut_empresa || '-')}</td>
                <td style="padding:8px 10px;text-align:center;font-size:11px">${this.fmtTime(r.hora_llegada)}</td>
                <td style="padding:8px 10px;text-align:center;font-size:11px">${this.fmtTime(r.hora_llamado)}</td>
                <td style="padding:8px 10px;text-align:center;font-size:11px">${this.fmtTime(r.hora_atencion)}</td>
                <td style="padding:8px 10px;text-align:center;font-size:11px">${this.fmtTime(r.hora_verificado)}</td>
                <td style="padding:8px 10px;text-align:center;font-size:11px">${this.fmtTime(r.hora_cargado)}</td>
                <td style="padding:8px 10px;text-align:center;font-size:11px">${this.fmtTime(r.hora_facturado)}</td>
                <td style="padding:8px 10px;text-align:center;font-size:11px;color:var(--warning)">${this.fmtSec(r.espera_seg)}</td>
                <td style="padding:8px 10px;text-align:center;font-size:11px;color:var(--info)">${this.fmtSec(r.recepcion_seg)}</td>
                <td style="padding:8px 10px;text-align:center;font-size:11px;color:#8b5cf6">${this.fmtSec(r.verificacion_seg)}</td>
                <td style="padding:8px 10px;text-align:center;font-size:11px;color:#06b6d4">${this.fmtSec(r.almacen_seg)}</td>
                <td style="padding:8px 10px;text-align:center;font-size:11px;color:#10b981">${this.fmtSec(r.facturacion_seg)}</td>
                <td style="padding:8px 10px;text-align:center;font-weight:900;font-size:12px;color:var(--accent)">${this.fmtSec(r.total_seg)}</td>
                <td style="padding:8px 10px;font-size:11px">${escapeHtml(r.pedidos || '-')}</td>
                <td style="padding:8px 10px;font-size:11px">${escapeHtml(r.factura || '-')}</td>
                <td style="padding:8px 10px;font-size:11px;text-align:right">${r.monto_factura > 0 ? '$' + Number(r.monto_factura).toLocaleString('es-CL') : '-'}</td>
                <td style="padding:8px 10px;text-align:center"><span style="font-size:10px;padding:2px 8px;border-radius:6px;background:${estadoColor}22;color:${estadoColor};font-weight:600">${estado}</span> ${tipoBadge}</td>
                <td style="padding:8px 10px;text-align:center">${r._origen === 'turno' ? `<button class="btn btn-sm btn-outline" style="color:#ef4444;border-color:#ef4444;padding:3px 8px;font-size:10px" onclick="App.modules.reporte_turnos.solicitarPass('turno',${r.id})">X</button>` : `<button class="btn btn-sm btn-outline" style="color:#ef4444;border-color:#ef4444;padding:3px 8px;font-size:10px" onclick="App.modules.reporte_turnos.solicitarPass('entrega',${r.entrega_id})">X</button>`}</td>
            </tr>`;
        }).join('');
    },

    fmtSec(s) { if (s == null || isNaN(s)) return '-'; const m = Math.floor(s / 60); return m > 0 ? `${m}m ${s%60}s` : `${s}s`; },
    fmtTime(t) { if (!t) return '-'; return String(t).slice(0, 8); }
});
