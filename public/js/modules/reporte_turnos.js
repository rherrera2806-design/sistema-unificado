App.registerModule('reporte_turnos', {
    registros: [],
    pendingDelete: null,

    async render() {
        const el = document.getElementById('page-reporte_turnos');
        const hoy = new Date().toISOString().substring(0, 10);
        const hace30 = new Date(Date.now() - 30*86400000).toISOString().substring(0, 10);
        el.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
                <div><h2 style="margin:0">Reporte de Turnos</h2><div class="subtitle">Historial completo de turnos y entregas de bodega</div></div>
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
            const entregas = await resE.json();
            this.registros = [
                ...turnos.map(t => ({ ...t, _tipo: 'turno' })),
                ...entregas.map(e => ({ ...e, _tipo: 'entrega', fecha_fmt: e.fecha ? new Date(e.fecha).toLocaleDateString('es-CL') : '-' }))
            ].sort((a, b) => {
                const fa = a.fecha || '', fb = b.fecha || '';
                if (fa !== fb) return fb.localeCompare(fa);
                return (b.id || 0) - (a.id || 0);
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
        const totalTurnos = this.registros.filter(r => r._tipo === 'turno').length;
        const totalEntregas = this.registros.filter(r => r._tipo === 'entrega').length;
        const pendientes = this.registros.filter(r => r._tipo === 'entrega' && r.estado === 'pendiente').length;

        let html = `
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
                <div class="stat-card"><div class="stat-info"><h4>${this.registros.length}</h4><p>Total registros</p></div></div>
                <div class="stat-card"><div class="stat-info"><h4>${totalTurnos}</h4><p>Turnos atendidos</p></div></div>
                <div class="stat-card"><div class="stat-info"><h4>${totalEntregas}</h4><p>Entregas bodega</p></div></div>
                <div class="stat-card"><div class="stat-info"><h4>${pendientes}</h4><p>Pendientes bodega</p></div></div>
            </div>
            <div class="card">
                <div class="card-body" style="padding:0;overflow-x:auto">
                    <table style="width:100%;font-size:13px">
                        <thead><tr style="border-bottom:2px solid var(--border)">
                            <th style="padding:10px 12px;text-align:left">Fecha</th>
                            <th style="padding:10px 12px;text-align:left">Tipo</th>
                            <th style="padding:10px 12px;text-align:left">Nombre</th>
                            <th style="padding:10px 12px;text-align:left">Estado</th>
                            <th style="padding:10px 12px;text-align:center">Hora Inicio</th>
                            <th style="padding:10px 12px;text-align:center">Hora Fin</th>
                            <th style="padding:10px 12px;text-align:left">Pedido</th>
                            <th style="padding:10px 12px;text-align:left">Factura</th>
                            <th style="padding:10px 12px;text-align:left">Detalle</th>
                            <th style="padding:10px 12px;text-align:center">Accion</th>
                        </tr></thead>
                        <tbody>${this.filasHtml()}</tbody>
                    </table>
                </div>
            </div>
        `;
        div.innerHTML = html;
    },

    filasHtml() {
        const estadoColor = {
            'atendido': '#22c55e', 'atendiendo': '#f59e0b', 'derivado': '#3b82f6', 'espera': '#94a3b8',
            'entregado': '#22c55e', 'pendiente': '#f59e0b'
        };
        return this.registros.map(r => {
            if (r._tipo === 'turno') {
                const color = estadoColor[r.estado] || '#94a3b8';
                return `<tr style="border-bottom:1px solid var(--border)">
                    <td style="padding:8px 12px">${r.fecha_fmt || '-'}</td>
                    <td style="padding:8px 12px"><span style="font-size:10px;padding:2px 8px;border-radius:6px;background:rgba(59,130,246,0.1);color:var(--info);font-weight:700">TURNO #${r.numero}</span></td>
                    <td style="padding:8px 12px;font-weight:600">${escapeHtml(r.nombre)}</td>
                    <td style="padding:8px 12px"><span style="font-size:11px;padding:2px 8px;border-radius:6px;background:${color}22;color:${color};font-weight:600">${r.estado}</span></td>
                    <td style="padding:8px 12px;text-align:center;font-size:12px">${this.fmtTime(r.hora_creacion)}</td>
                    <td style="padding:8px 12px;text-align:center;font-size:12px">${this.fmtTime(r.hora_fin)}</td>
                    <td style="padding:8px 12px;font-size:12px">${escapeHtml(r.pedidos || '-')}</td>
                    <td style="padding:8px 12px;font-size:12px">${escapeHtml(r.factura || '-')}</td>
                    <td style="padding:8px 12px;font-size:12px;color:var(--text-light)">${r.espera_segundos ? 'Espera: ' + this.fmtSec(r.espera_segundos) : '-'}</td>
                    <td style="padding:8px 12px;text-align:center"><button class="btn btn-sm btn-outline" style="color:#ef4444;border-color:#ef4444;padding:4px 10px;font-size:11px" onclick="App.modules.reporte_turnos.solicitarPass('turno',${r.id})">Eliminar</button></td>
                </tr>`;
            } else {
                const color = estadoColor[r.estado] || '#94a3b8';
                const tipoColor = r.tipo === 'Despacho' ? 'var(--warning)' : 'var(--success)';
                return `<tr style="border-bottom:1px solid var(--border)">
                    <td style="padding:8px 12px">${r.fecha_fmt || '-'}</td>
                    <td style="padding:8px 12px"><span style="font-size:10px;padding:2px 8px;border-radius:6px;background:rgba(168,85,247,0.1);color:#a855f7;font-weight:700">ENTREGA${r.turno_numero ? ' #' + r.turno_numero : ''}</span></td>
                    <td style="padding:8px 12px;font-weight:600">${escapeHtml(r.cliente_nombre)}</td>
                    <td style="padding:8px 12px"><span style="font-size:11px;padding:2px 8px;border-radius:6px;background:${color}22;color:${color};font-weight:600">${r.estado}</span></td>
                    <td style="padding:8px 12px;text-align:center;font-size:12px">${this.fmtTime(r.hora_registrada)}</td>
                    <td style="padding:8px 12px;text-align:center;font-size:12px">${this.fmtTime(r.hora_entregada)}</td>
                    <td style="padding:8px 12px;font-size:12px">${escapeHtml(r.pedidos || '-')}</td>
                    <td style="padding:8px 12px;font-size:12px">${escapeHtml(r.factura || '-')}</td>
                    <td style="padding:8px 12px;font-size:12px"><span style="font-size:10px;padding:2px 6px;border-radius:4px;background:${tipoColor}22;color:${tipoColor}">${r.tipo || '-'}</span>${r.descripcion ? ' ' + escapeHtml(r.descripcion) : ''}</td>
                    <td style="padding:8px 12px;text-align:center"><button class="btn btn-sm btn-outline" style="color:#ef4444;border-color:#ef4444;padding:4px 10px;font-size:11px" onclick="App.modules.reporte_turnos.solicitarPass('entrega',${r.id})">Eliminar</button></td>
                </tr>`;
            }
        }).join('');
    },

    fmtSec(s) { if (s == null || isNaN(s)) return '-'; const m = Math.floor(s / 60); return m > 0 ? `${m}m ${s%60}s` : `${s}s`; },
    fmtTime(t) { if (!t) return '-'; return String(t).slice(0, 8); }
});
