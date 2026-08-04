App.registerModule('reporte_turnos', {
    registros: [],
    pendingDelete: null,

    async render() {
        const el = document.getElementById('page-reporte_turnos');
        const hoy = new Date().toISOString().substring(0, 10);
        const hace30 = new Date(Date.now() - 30*86400000).toISOString().substring(0, 10);
        el.innerHTML = `
            <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:14px 24px;margin-bottom:20px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">
<div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
<div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center"><div><h2 style="margin:0;font-size:18px;font-weight:800;color:white;letter-spacing:-0.5px">Reporte de Turnos</h2>
<p style="margin:2px 0 0;font-size:11px;color:rgba(255,255,255,0.7)">Flujo completo por cliente: llegada, atencion, bodega y entrega</p></div>
</div></div>

<style>
@keyframes rtur_fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.rtur-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}
.rtur-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important;transform:translateY(-3px)}
.rtur-row{transition:all 0.2s}
.rtur-row:hover{transform:translateX(2px);background:#f8fafc!important}
</style>

            <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
                <div style="display:flex;gap:16px;align-items:end;flex-wrap:wrap">
                    <div style="margin:0">
                        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">Desde</label>
                        <input type="date" id="rtDesde" class="form-control" value="${hace30}" style="font-size:13px;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;width:160px" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
                    </div>
                    <div style="margin:0">
                        <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">Hasta</label>
                        <input type="date" id="rtHasta" class="form-control" value="${hoy}" style="font-size:13px;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;width:160px" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
                    </div>
                    <button onclick="App.modules.reporte_turnos.cargar()" style="font-size:13px;background:#1e40af;color:white;border:none;padding:9px 24px;border-radius:8px;font-weight:600;cursor:pointer;transition:background 0.15s" onmouseover="this.style.background='#1e3a8a'" onmouseout="this.style.background='#1e40af'">Buscar</button>
                    <div id="rtFilterInfo" style="font-size:12px;color:#64748b;margin-left:8px"></div>
                </div>
            </div>
            <div id="rtContent"><div style="text-align:center;color:#94a3b8;padding:40px">Cargando...</div></div>
            <div id="rtModalPass" style="display:none;position:fixed;inset:0;z-index:40;align-items:center;justify-content:center;background:rgba(15,23,42,0.5);backdrop-filter:blur(4px)">
                <div style="background:white;border:1px solid #e2e8f0;border-radius:16px;padding:24px;width:90%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,0.2)">
                    <h3 style="font-size:16px;font-weight:700;margin:0 0 8px;color:#1e293b">Confirmar eliminacion</h3>
                    <p style="font-size:13px;color:#64748b;margin:0 0 16px">Ingresa la contrasena de administrador para eliminar este registro.</p>
                    <input id="rtPassInput" type="password" placeholder="Contrasena admin" style="font-size:13px;width:100%;background:#f8fafc;border:1px solid #e2e8f0;color:#1e293b;padding:10px 12px;border-radius:8px;box-sizing:border-box" onkeydown="if(event.key==='Enter')App.modules.reporte_turnos.confirmarEliminar()" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
                    <p id="rtPassError" style="color:#dc2626;font-size:12px;display:none;margin:8px 0 0"></p>
                    <div style="display:flex;gap:8px;margin-top:16px">
                        <button onclick="App.modules.reporte_turnos.cerrarModal()" style="flex:1;background:white;color:#64748b;border:1px solid #e2e8f0;padding:10px;border-radius:8px;font-size:13px;cursor:pointer;font-weight:500">Cancelar</button>
                        <button onclick="App.modules.reporte_turnos.confirmarEliminar()" id="rtPassBtn" style="flex:1;background:#dc2626;color:white;border:none;padding:10px;border-radius:8px;font-size:13px;cursor:pointer;font-weight:600">Eliminar</button>
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

            const fi = document.getElementById('rtFilterInfo');
            if (fi && desde && hasta) {
                const d = new Date(desde + 'T12:00:00').toLocaleDateString('es-CL');
                const h = new Date(hasta + 'T12:00:00').toLocaleDateString('es-CL');
                fi.textContent = `Mostrando ${this.registros.length} registros del ${d} al ${h}`;
            }

            this.renderTabla();
        } catch(e) {
            document.getElementById('rtContent').innerHTML = '<div style="text-align:center;color:#dc2626;padding:40px">Error al cargar</div>';
        }
    },

    renderTabla() {
        const div = document.getElementById('rtContent');
        if (this.registros.length === 0) {
            div.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px;font-size:14px">No hay registros en este rango</div>';
            return;
        }
        const total = this.registros.length;
        const conEntrega = this.registros.filter(r => r.entrega_estado === 'facturado' || r.entrega_estado === 'completado').length;
        const pendientes = this.registros.filter(r => r.entrega_estado === 'pendiente' || r.entrega_estado === 'verificado').length;
        const tiempos = this.registros.filter(r => r.total_seg != null).map(r => r.total_seg);
        const promedio = tiempos.length > 0 ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length) : 0;

        let html = `
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">
                <div style="background:white;border:1px solid #e2e8f0;border-left:4px solid #1e40af;border-radius:10px;padding:10px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.06);height:55px;display:flex;align-items:center;gap:10px">
                    <div style="width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,#eff6ff,#bfdbfe);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1e40af" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
                    <div><div style="font-size:20px;font-weight:800;color:#1e293b;line-height:1">${total}</div><div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">Total turnos</div></div>
                </div>
                <div style="background:white;border:1px solid #e2e8f0;border-left:4px solid #16a34a;border-radius:10px;padding:10px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.06);height:55px;display:flex;align-items:center;gap:10px">
                    <div style="width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,#f0fdf4,#bbf7d0);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></div>
                    <div><div style="font-size:20px;font-weight:800;color:#16a34a;line-height:1">${conEntrega}</div><div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">Entregados</div></div>
                </div>
                <div style="background:white;border:1px solid #e2e8f0;border-left:4px solid #f59e0b;border-radius:10px;padding:10px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.06);height:55px;display:flex;align-items:center;gap:10px">
                    <div style="width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,#fef3c7,#fde68a);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                    <div><div style="font-size:20px;font-weight:800;color:#f59e0b;line-height:1">${pendientes}</div><div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">Pend. bodega</div></div>
                </div>
                <div style="background:white;border:1px solid #e2e8f0;border-left:4px solid #7c3aed;border-radius:10px;padding:10px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.06);height:55px;display:flex;align-items:center;gap:10px">
                    <div style="width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,#f5f3ff,#ddd6fe);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                    <div><div style="font-size:20px;font-weight:800;color:#7c3aed;line-height:1">${this.fmtSec(promedio)}</div><div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">Tiempo prom.</div></div>
                </div>
            </div>
            <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
                <div style="overflow-x:auto">
                <table style="width:100%;font-size:12px;border-collapse:collapse">
                    <thead>
                        <tr style="border-bottom:2px solid #e2e8f0">
                            <th colspan="6" style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.8px;background:#f8fafc;border-bottom:1px solid #e2e8f0">Flujo Cliente</th>
                            <th colspan="6" style="padding:10px 12px;text-align:center;font-size:10px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.8px;background:#f8fafc;border-bottom:1px solid #e2e8f0;border-left:1px solid #e2e8f0">Tiempos</th>
                            <th colspan="6" style="padding:10px 12px;text-align:center;font-size:10px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.8px;background:#f8fafc;border-bottom:1px solid #e2e8f0;border-left:1px solid #e2e8f0">Duracion</th>
                            <th colspan="3" style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.8px;background:#f8fafc;border-bottom:1px solid #e2e8f0;border-left:1px solid #e2e8f0">Documentos</th>
                            <th colspan="2" style="padding:10px 12px;text-align:center;font-size:10px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.8px;background:#f8fafc;border-bottom:1px solid #e2e8f0;border-left:1px solid #e2e8f0">Estado</th>
                        </tr>
                        <tr style="border-bottom:1px solid #e2e8f0;background:#f8fafc">
                            <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Fecha</th>
                            <th style="padding:8px 10px;text-align:center;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">#</th>
                            <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Cliente</th>
                            <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Patente</th>
                            <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Motivo</th>
                            <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">RUT Empresa</th>
                            <th style="padding:8px 10px;text-align:center;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;border-left:1px solid #e2e8f0">Llegada</th>
                            <th style="padding:8px 10px;text-align:center;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Llamado</th>
                            <th style="padding:8px 10px;text-align:center;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Atencion</th>
                            <th style="padding:8px 10px;text-align:center;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Verif.</th>
                            <th style="padding:8px 10px;text-align:center;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Cargado</th>
                            <th style="padding:8px 10px;text-align:center;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Facturado</th>
                            <th style="padding:8px 10px;text-align:center;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;border-left:1px solid #e2e8f0">Espera</th>
                            <th style="padding:8px 10px;text-align:center;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Recep.</th>
                            <th style="padding:8px 10px;text-align:center;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Verif.</th>
                            <th style="padding:8px 10px;text-align:center;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Almac.</th>
                            <th style="padding:8px 10px;text-align:center;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Fact.</th>
                            <th style="padding:8px 10px;text-align:center;font-size:10px;font-weight:700;color:#1e293b;text-transform:uppercase;border-left:1px solid #e2e8f0">Total</th>
                            <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;border-left:1px solid #e2e8f0">Pedido</th>
                            <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">N° Factura</th>
                            <th style="padding:8px 10px;text-align:right;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Monto</th>
                            <th style="padding:8px 10px;text-align:center;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;border-left:1px solid #e2e8f0">Estado</th>
                            <th style="padding:8px 10px;text-align:center;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Accion</th>
                        </tr>
                    </thead>
                    <tbody>${this.filasHtml()}</tbody>
                </table>
                </div>
            </div>
        `;
        div.innerHTML = html;
    },

    filasHtml() {
        return this.registros.map((r, i) => {
            const estado = r.entrega_estado || r.turno_estado || '-';
            const estadoConfig = {
                'entregado': { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' },
                'pendiente': { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
                'atendido': { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' },
                'derivado': { bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' },
                'atendiendo': { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
                'espera': { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' },
                'verificado': { bg: '#f3e8ff', color: '#7c3aed', border: '#e9d5ff' },
                'cargado': { bg: '#cffafe', color: '#0e7490', border: '#a5f3fc' },
                'facturado': { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' },
                'completado': { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' }
            }[estado] || { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };
            const tipoBadge = r.tipo ? `<span style="font-size:9px;padding:2px 6px;border-radius:4px;background:${r.tipo==='Despacho'?'#fef3c7':'#dcfce7'};color:${r.tipo==='Despacho'?'#92400e':'#166534'};margin-left:4px;font-weight:600">${r.tipo}</span>` : '';
            const rowBg = i % 2 === 0 ? 'white' : '#f8fafc';
            return `<tr class="rtur-row" style="border-bottom:1px solid #f1f5f9;background:${rowBg};transition:background 0.1s" onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='${rowBg}'">
                <td style="padding:8px 10px;font-size:11px;color:#64748b;white-space:nowrap">${r.fecha_fmt || '-'}</td>
                <td style="padding:8px 10px;text-align:center;font-weight:700;color:#1e40af;font-size:12px">${r.numero ? '#' + r.numero : (r._origen === 'bodega' ? 'BOD' : '-')}</td>
                <td style="padding:8px 10px;font-weight:600;color:#1e293b;white-space:nowrap">${escapeHtml(r.nombre)}</td>
                <td style="padding:8px 10px;font-size:11px;font-weight:600;color:#475569;font-family:'SF Mono','Consolas',monospace">${escapeHtml(r.patente || '-')}</td>
                <td style="padding:8px 10px;font-size:11px;color:#64748b">${escapeHtml(r.motivo || '-')}</td>
                <td style="padding:8px 10px;font-size:11px;color:#64748b;font-family:'SF Mono','Consolas',monospace">${escapeHtml(r.rut_empresa || '-')}</td>
                <td style="padding:8px 10px;text-align:center;font-size:11px;color:#64748b;font-family:'SF Mono','Consolas',monospace;border-left:1px solid #f1f5f9">${this.fmtTime(r.hora_llegada)}</td>
                <td style="padding:8px 10px;text-align:center;font-size:11px;color:#64748b;font-family:'SF Mono','Consolas',monospace">${this.fmtTime(r.hora_llamado)}</td>
                <td style="padding:8px 10px;text-align:center;font-size:11px;color:#64748b;font-family:'SF Mono','Consolas',monospace">${this.fmtTime(r.hora_atencion)}</td>
                <td style="padding:8px 10px;text-align:center;font-size:11px;color:#64748b;font-family:'SF Mono','Consolas',monospace">${this.fmtTime(r.hora_verificado)}</td>
                <td style="padding:8px 10px;text-align:center;font-size:11px;color:#64748b;font-family:'SF Mono','Consolas',monospace">${this.fmtTime(r.hora_cargado)}</td>
                <td style="padding:8px 10px;text-align:center;font-size:11px;color:#64748b;font-family:'SF Mono','Consolas',monospace">${this.fmtTime(r.hora_facturado)}</td>
                <td style="padding:8px 10px;text-align:center;font-size:11px;color:#f59e0b;font-weight:600;font-family:'SF Mono','Consolas',monospace;border-left:1px solid #f1f5f9">${this.fmtSec(r.espera_seg)}</td>
                <td style="padding:8px 10px;text-align:center;font-size:11px;color:#1e40af;font-weight:500;font-family:'SF Mono','Consolas',monospace">${this.fmtSec(r.recepcion_seg)}</td>
                <td style="padding:8px 10px;text-align:center;font-size:11px;color:#7c3aed;font-weight:500;font-family:'SF Mono','Consolas',monospace">${this.fmtSec(r.verificacion_seg)}</td>
                <td style="padding:8px 10px;text-align:center;font-size:11px;color:#0e7490;font-weight:500;font-family:'SF Mono','Consolas',monospace">${this.fmtSec(r.almacen_seg)}</td>
                <td style="padding:8px 10px;text-align:center;font-size:11px;color:#16a34a;font-weight:500;font-family:'SF Mono','Consolas',monospace">${this.fmtSec(r.facturacion_seg)}</td>
                <td style="padding:8px 10px;text-align:center;font-weight:800;font-size:12px;color:#1e293b;font-family:'SF Mono','Consolas',monospace;border-left:1px solid #f1f5f9">${this.fmtSec(r.total_seg)}</td>
                <td style="padding:8px 10px;font-size:11px;color:#64748b;border-left:1px solid #f1f5f9;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(r.pedidos || '')}">${escapeHtml(r.pedidos || '-')}</td>
                <td style="padding:8px 10px;font-size:11px;color:#1e40af;font-weight:600">${escapeHtml(r.factura || '-')}</td>
                <td style="padding:8px 10px;font-size:11px;text-align:right;color:#1e293b;font-weight:600;font-family:'SF Mono','Consolas',monospace">${r.monto_factura > 0 ? '$' + Number(r.monto_factura).toLocaleString('es-CL') : '-'}</td>
                <td style="padding:8px 10px;text-align:center;border-left:1px solid #f1f5f9"><span style="font-size:10px;padding:3px 8px;border-radius:6px;font-weight:600;background:${estadoConfig.bg};color:${estadoConfig.color};border:1px solid ${estadoConfig.border}">${estado}</span>${tipoBadge}</td>
                <td style="padding:8px 10px;text-align:center">${r._origen === 'turno' ? `<button style="background:white;color:#dc2626;border:1px solid #fecaca;padding:4px 10px;border-radius:6px;font-size:10px;cursor:pointer;font-weight:600;transition:all 0.15s" onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='white'" onclick="App.modules.reporte_turnos.solicitarPass('turno',${r.id})">Eliminar</button>` : `<button style="background:white;color:#dc2626;border:1px solid #fecaca;padding:4px 10px;border-radius:6px;font-size:10px;cursor:pointer;font-weight:600;transition:all 0.15s" onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='white'" onclick="App.modules.reporte_turnos.solicitarPass('entrega',${r.entrega_id})">Eliminar</button>`}</td>
            </tr>`;
        }).join('');
    },

    fmtSec(s) { if (s == null || isNaN(s)) return '-'; const m = Math.round(s / 60); return `${m}m`; },
    fmtTime(t) { if (!t) return '-'; return String(t).slice(0, 8); }
});
