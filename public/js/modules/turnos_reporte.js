App.registerModule('turnos_reporte', {
    async render() {
        const el = document.getElementById('page-turnos_reporte');
        const hoy = new Date().toISOString().split('T')[0];
        const hace30 = new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];

        el.innerHTML = `
            <div class="page-header">
                <div>
                    <h2>Reporte de Turnos</h2>
                    <div class="subtitle">Historial completo ordenado por fecha y turno</div>
                </div>
            </div>
            <div class="card">
                <div class="card-header">
                    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
                        <div class="form-group" style="margin:0">
                            <label style="font-size:11px">Desde</label>
                            <input type="date" id="trDesde" class="input" value="${hace30}" style="width:150px" onchange="App.modules.turnos_reporte.cargar()">
                        </div>
                        <div class="form-group" style="margin:0">
                            <label style="font-size:11px">Hasta</label>
                            <input type="date" id="trHasta" class="input" value="${hoy}" style="width:150px" onchange="App.modules.turnos_reporte.cargar()">
                        </div>
                        <div class="form-group" style="margin:0">
                            <label style="font-size:11px">Turno</label>
                            <select id="trTurno" class="input" style="width:120px" onchange="App.modules.turnos_reporte.cargar()">
                                <option value="">Todos</option>
                                <option value="Dia">Dia</option>
                                <option value="Noche">Noche</option>
                            </select>
                        </div>
                    </div>
                    <span class="text-muted" id="trCount">0 registros</span>
                </div>
                <div class="card-body" style="padding:0">
                    <div id="trStats" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:16px 20px;border-bottom:1px solid var(--border)"></div>
                    <div id="trTable" style="max-height:60vh;overflow-y:auto">
                        <div style="text-align:center;color:var(--text-light);padding:40px">Cargando...</div>
                    </div>
                </div>
            </div>
        `;
        await this.cargar();
    },

    async cargar() {
        const desde = document.getElementById('trDesde')?.value || '';
        const hasta = document.getElementById('trHasta')?.value || '';
        const turno = document.getElementById('trTurno')?.value || '';
        try {
            const params = new URLSearchParams();
            if (desde) params.set('desde', desde);
            if (hasta) params.set('hasta', hasta);
            if (turno) params.set('turno', turno);
            const data = await fetch(`/api/turnos/reporte?${params}`).then(r => r.json()).catch(() => []);
            this.renderStats(data);
            this.renderTable(data);
            document.getElementById('trCount').textContent = data.length + ' registros';
        } catch(e) {
            document.getElementById('trTable').innerHTML = '<div style="text-align:center;color:var(--danger);padding:40px">Error al cargar</div>';
        }
    },

    renderStats(data) {
        const total = data.length;
        const dia = data.filter(t => t.turno_label === 'Dia').length;
        const noche = data.filter(t => t.turno_label === 'Noche').length;
        const avgEspera = data.reduce((s, t) => s + (t.espera_segundos || 0), 0) / (total || 1);
        const fmt = s => { const m = Math.floor(s/60); return m > 0 ? `${m}m ${Math.round(s%60)}s` : `${Math.round(s)}s`; };
        document.getElementById('trStats').innerHTML = `
            <div class="stat-card"><div class="stat-icon blue">&#128203;</div><div class="stat-info"><h4>${total}</h4><p>Total turnos</p></div></div>
            <div class="stat-card"><div class="stat-icon green">&#9728;</div><div class="stat-info"><h4>${dia}</h4><p>Turno Dia</p></div></div>
            <div class="stat-card"><div class="stat-icon" style="background:#1e293b;color:#f8fafc">&#9790;</div><div class="stat-info"><h4>${noche}</h4><p>Turno Noche</p></div></div>
            <div class="stat-card"><div class="stat-icon orange">&#9203;</div><div class="stat-info"><h4>${fmt(avgEspera)}</h4><p>Tiempo prom. espera</p></div></div>
        `;
    },

    renderTable(data) {
        if (data.length === 0) {
            document.getElementById('trTable').innerHTML = '<div style="text-align:center;color:var(--text-light);padding:40px">Sin registros para el rango seleccionado</div>';
            return;
        }
        let rows = '';
        for (const t of data) {
            const turnoColor = t.turno_label === 'Dia' ? '#f59e0b' : '#6366f1';
            const turnoBg = t.turno_label === 'Dia' ? 'rgba(245,158,11,0.1)' : 'rgba(99,102,241,0.1)';
            const estado = t.estado || 'espera';
            const estadoClass = {atendiendo:'status-mantenimiento', derivado:'status-programada', atendido:'status-realizada'}[estado] || 'status-operativo';
            rows += `<tr>
                <td style="font-weight:600;white-space:nowrap">${t.fecha_fmt || '-'}</td>
                <td><span style="display:inline-block;padding:2px 8px;border-radius:6px;background:${turnoBg};color:${turnoColor};font-weight:700;font-size:11px">${t.turno_label}</span></td>
                <td style="color:var(--accent);font-weight:900">#${t.numero}</td>
                <td style="font-weight:600">${escapeHtml(t.nombre)}</td>
                <td><span class="status-badge ${estadoClass}">${t.estado}</span></td>
                <td>${t.hora_creacion || '-'}</td>
                <td>${t.hora_llamada || '-'}</td>
                <td>${t.hora_fin || '-'}</td>
                <td>${t.espera_segundos != null ? this.fmtSec(t.espera_segundos) : '-'}</td>
                <td>${t.recepcion_segundos != null ? this.fmtSec(t.recepcion_segundos) : '-'}</td>
                <td>${t.total_segundos != null ? this.fmtSec(t.total_segundos) : '-'}</td>
                <td>${escapeHtml(t.pedidos || '-')}</td>
                <td>${escapeHtml(t.factura || '-')}</td>
                <td>${t.tipo || '-'}</td>
                <td>${t.entrega_estado || '-'}</td>
            </tr>`;
        }
        document.getElementById('trTable').innerHTML = `
            <table style="width:100%;border-collapse:collapse;font-size:12px">
                <thead><tr style="position:sticky;top:0;background:var(--bg);z-index:1">
                    <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-light)">Fecha</th>
                    <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-light)">Turno</th>
                    <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-light)">#</th>
                    <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-light)">Nombre</th>
                    <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-light)">Estado</th>
                    <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-light)">Llegada</th>
                    <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-light)">Atencion</th>
                    <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-light)">Fin</th>
                    <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-light)">Espera</th>
                    <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-light)">Atencion.</th>
                    <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-light)">Total</th>
                    <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-light)">Pedido</th>
                    <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-light)">Factura</th>
                    <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-light)">Tipo</th>
                    <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-light)">Entrega</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    },

    fmtSec(s) {
        if (s == null || s < 0) return '-';
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = Math.round(s % 60);
        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m ${sec}s`;
        return `${sec}s`;
    }
});
