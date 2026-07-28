App.registerModule('reporte_turnos', {
    turnos: [],

    async render() {
        const el = document.getElementById('page-reporte_turnos');
        const hoy = new Date().toISOString().substring(0, 10);
        const hace30 = new Date(Date.now() - 30*86400000).toISOString().substring(0, 10);
        el.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
                <div><h2 style="margin:0">Reporte de Turnos</h2><div class="subtitle">Historial completo ordenado por fecha y turno</div></div>
            </div>
            <div class="card" style="margin-bottom:16px">
                <div style="display:flex;gap:12px;align-items:end;flex-wrap:wrap">
                    <div class="form-group" style="margin:0"><label style="font-size:12px;color:var(--text-light)">Desde</label><input type="date" id="rtDesde" class="form-control" value="${hace30}" style="font-size:13px"></div>
                    <div class="form-group" style="margin:0"><label style="font-size:12px;color:var(--text-light)">Hasta</label><input type="date" id="rtHasta" class="form-control" value="${hoy}" style="font-size:13px"></div>
                    <div class="form-group" style="margin:0"><label style="font-size:12px;color:var(--text-light)">Turno</label>
                        <select id="rtTurno" class="form-control" style="font-size:13px;width:120px">
                            <option value="todos">Todos</option>
                        </select>
                    </div>
                    <button class="btn btn-primary" onclick="App.modules.reporte_turnos.cargar()" style="font-size:13px">Buscar</button>
                </div>
            </div>
            <div id="rtContent"><div style="text-align:center;color:var(--text-light);padding:40px">Cargando...</div></div>
        `;
        await this.cargar();
    },

    async cargar() {
        const desde = document.getElementById('rtDesde')?.value || '';
        const hasta = document.getElementById('rtHasta')?.value || '';
        const turno = document.getElementById('rtTurno')?.value || 'todos';
        try {
            const params = new URLSearchParams();
            if (desde) params.set('desde', desde);
            if (hasta) params.set('hasta', hasta);
            if (turno !== 'todos') params.set('turno', turno);
            const res = await fetch(`/api/turnos/reporte?${params}`);
            this.turnos = await res.json();
            this.renderTabla();
        } catch(e) {
            document.getElementById('rtContent').innerHTML = '<div style="text-align:center;color:var(--danger);padding:40px">Error al cargar</div>';
        }
    },

    renderTabla() {
        const div = document.getElementById('rtContent');
        if (this.turnos.length === 0) {
            div.innerHTML = '<div style="text-align:center;color:var(--text-light);padding:40px">No hay registros en este rango</div>';
            return;
        }
        const totalEspera = this.turnos.reduce((s, t) => s + (t.espera_segundos || 0), 0);
        const totalRecepcion = this.turnos.reduce((s, t) => s + (t.recepcion_segundos || 0), 0);
        const totalTurnos = this.turnos.length;
        const atendidos = this.turnos.filter(t => t.estado === 'atendido' || t.estado === 'derivado').length;
        const derivados = this.turnos.filter(t => t.estado === 'derivado').length;

        let html = `
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
                <div class="stat-card"><div class="stat-info"><h4>${totalTurnos}</h4><p>Total turnos</p></div></div>
                <div class="stat-card"><div class="stat-info"><h4>${atendidos}</h4><p>Atendidos</p></div></div>
                <div class="stat-card"><div class="stat-info"><h4>${derivados}</h4><p>Derivados a bodega</p></div></div>
                <div class="stat-card"><div class="stat-info"><h4>${this.fmtSec(Math.round(totalEspera / (totalTurnos || 1)))}</h4><p>Prom. espera</p></div></div>
            </div>
            <div class="card">
                <div class="card-body" style="padding:0;overflow-x:auto">
                    <table style="width:100%;font-size:13px">
                        <thead><tr style="border-bottom:2px solid var(--border)">
                            <th style="padding:10px 12px;text-align:left">Fecha</th>
                            <th style="padding:10px 12px;text-align:center">#</th>
                            <th style="padding:10px 12px;text-align:left">Nombre</th>
                            <th style="padding:10px 12px;text-align:left">RUT</th>
                            <th style="padding:10px 12px;text-align:left">Estado</th>
                            <th style="padding:10px 12px;text-align:left">Tipo</th>
                            <th style="padding:10px 12px;text-align:center">Llegada</th>
                            <th style="padding:10px 12px;text-align:center">Atencion</th>
                            <th style="padding:10px 12px;text-align:center">Fin</th>
                            <th style="padding:10px 12px;text-align:center">Espera</th>
                            <th style="padding:10px 12px;text-align:left">Pedido</th>
                            <th style="padding:10px 12px;text-align:left">Factura</th>
                        </tr></thead>
                        <tbody>${this.filasHtml()}</tbody>
                    </table>
                </div>
            </div>
        `;
        div.innerHTML = html;

        const sel = document.getElementById('rtTurno');
        if (sel && sel.options.length <= 1) {
            const numeros = [...new Set(this.turnos.map(t => t.numero))].sort((a, b) => a - b);
            numeros.forEach(n => { const o = document.createElement('option'); o.value = n; o.textContent = '#' + n; sel.appendChild(o); });
        }
    },

    filasHtml() {
        const estadoColor = { 'atendido': '#22c55e', 'atendiendo': '#f59e0b', 'derivado': '#3b82f6', 'espera': '#94a3b8' };
        return this.turnos.map(t => {
            const color = estadoColor[t.estado] || '#94a3b8';
            const tipoLabel = t.tipo || '-';
            return `<tr style="border-bottom:1px solid var(--border)">
                <td style="padding:8px 12px">${t.fecha_fmt || '-'}</td>
                <td style="padding:8px 12px;text-align:center;font-weight:700;color:var(--accent)">#${t.numero}</td>
                <td style="padding:8px 12px;font-weight:600">${escapeHtml(t.nombre)}</td>
                <td style="padding:8px 12px;font-size:12px;color:var(--text-light)">${escapeHtml(t.rut || '-')}</td>
                <td style="padding:8px 12px"><span style="font-size:11px;padding:2px 8px;border-radius:6px;background:${color}22;color:${color};font-weight:600">${t.estado}</span></td>
                <td style="padding:8px 12px;font-size:12px">${escapeHtml(tipoLabel)}</td>
                <td style="padding:8px 12px;text-align:center;font-size:12px">${this.fmtTime(t.hora_creacion)}</td>
                <td style="padding:8px 12px;text-align:center;font-size:12px;color:var(--info)">${this.fmtTime(t.hora_llamada)}</td>
                <td style="padding:8px 12px;text-align:center;font-size:12px">${this.fmtTime(t.hora_fin)}</td>
                <td style="padding:8px 12px;text-align:center;font-size:12px;color:var(--warning);font-weight:600">${this.fmtSec(t.espera_segundos)}</td>
                <td style="padding:8px 12px;font-size:12px">${escapeHtml(t.pedidos || '-')}</td>
                <td style="padding:8px 12px;font-size:12px">${escapeHtml(t.factura || '-')}</td>
            </tr>`;
        }).join('');
    },

    fmtSec(s) { if (s == null || isNaN(s)) return '-'; const m = Math.floor(s / 60); return m > 0 ? `${m}m ${s%60}s` : `${s}s`; },
    fmtTime(t) { if (!t) return '-'; return String(t).slice(0, 8); }
});
