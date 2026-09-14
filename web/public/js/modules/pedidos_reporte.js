App.registerModule('pedidos_reporte', {
    reportData: null,
    charts: {},
    anio: new Date().getFullYear(),
    _chartTimer: null,

    async render() {
        const el = document.getElementById('page-pedidos_reporte');
        el.innerHTML = '<style>'
            + '.pr-section{background:white;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.04)}'
            + '.pr-kpi-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px}'
            + '.pr-kpi{background:linear-gradient(135deg,#f8fafc,#f1f5f9);border:1px solid #e2e8f0;border-radius:10px;padding:16px;text-align:center;position:relative;overflow:hidden}'
            + '.pr-kpi::before{content:"";position:absolute;top:0;left:0;width:4px;height:100%;border-radius:4px 0 0 4px}'
            + '.pr-kpi.kpi-blue::before{background:#3b82f6}'
            + '.pr-kpi.kpi-green::before{background:#16a34a}'
            + '.pr-kpi.kpi-red::before{background:#dc2626}'
            + '.pr-kpi.kpi-amber::before{background:#f59e0b}'
            + '.pr-kpi.kpi-purple::before{background:#8b5cf6}'
            + '.pr-kpi-value{font-size:28px;font-weight:800;color:#1e293b;line-height:1.1}'
            + '.pr-kpi-label{font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px}'
            + '.pr-chart-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}'
            + '.pr-chart-box{background:white;border:1px solid #e2e8f0;border-radius:12px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.04)}'
            + '.pr-chart-title{font-size:13px;font-weight:700;color:#1e293b;margin-bottom:12px;display:flex;align-items:center;gap:6px}'
            + '.pr-chart-title svg{width:16px;height:16px;flex-shrink:0}'
            + '.pr-table-wrap{overflow-x:auto;border:1px solid #e2e8f0;border-radius:8px}'
            + '.pr-table{width:100%;border-collapse:collapse;font-size:12px}'
            + '.pr-table th{background:#f8fafc;padding:10px 12px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0}'
            + '.pr-table td{padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155}'
            + '.pr-table tr:hover td{background:#f8fafc}'
            + '.pr-badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600}'
            + '@media(max-width:768px){.pr-chart-row{grid-template-columns:1fr}.pr-kpi-row{grid-template-columns:repeat(2,1fr)}.pr-kpi-value{font-size:22px}}'
            + '</style>'

            + '<div style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 50%,#3b82f6 100%);border-radius:16px;padding:20px;margin-bottom:20px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(30,58,95,0.3)">'
            + '<div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">'
            + '<div><h2 style="margin:0;font-size:18px;font-weight:800;color:white;letter-spacing:-0.5px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-4px;margin-right:8px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>Reporte de Pedidos</h2>'
            + '<p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.7)">Analisis mensual de pedidos y ordenes de venta</p></div>'
            + '<div style="display:flex;gap:6px;align-items:center">'
            + '<button class="btn btn-outline" style="color:white;border-color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.1)" onclick="App.modules.pedidos_reporte.cambiarAnio(-1)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>'
            + '<span id="prAnioLabel" style="color:white;font-size:16px;font-weight:700;min-width:60px;text-align:center">' + this.anio + '</span>'
            + '<button class="btn btn-outline" style="color:white;border-color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.1)" onclick="App.modules.pedidos_reporte.cambiarAnio(1)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>'
            + '</div></div></div>'

            + '<div id="prKpis" class="pr-kpi-row"></div>'
            + '<div class="pr-chart-row">'
            + '<div class="pr-chart-box"><div class="pr-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/></svg>Pedidos por Mes</div><div style="position:relative;height:280px"><canvas id="prChartMes"></canvas></div></div>'
            + '<div class="pr-chart-box"><div class="pr-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20" fill="#8b5cf6" opacity="0.2"/></svg>Por Estado</div><div style="position:relative;height:280px;display:flex;justify-content:center"><canvas id="prChartEstado"></canvas></div></div>'
            + '</div>'
            + '<div class="pr-chart-row">'
            + '<div class="pr-chart-box"><div class="pr-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>Por Vendedor</div><div style="position:relative;height:280px"><canvas id="prChartVendedor"></canvas></div></div>'
            + '<div class="pr-chart-box"><div class="pr-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>Por Tipo de OV</div><div style="position:relative;height:280px;display:flex;justify-content:center"><canvas id="prChartTipo"></canvas></div></div>'
            + '</div>'
            + '<div class="pr-chart-row">'
            + '<div class="pr-chart-box"><div class="pr-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>Tendencia Mensual</div><div style="position:relative;height:280px"><canvas id="prChartTendencia"></canvas></div></div>'
            + '<div class="pr-chart-box"><div class="pr-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Top Clientes</div><div style="position:relative;height:280px"><canvas id="prChartCliente"></canvas></div></div>'
            + '</div>'
            + '<div class="pr-section"><div class="pr-chart-title" style="margin-bottom:12px"><svg viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="2" width="16" height="16"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/></svg>Detalle Mensual</div><div id="prTabla" class="pr-table-wrap"></div></div>';

        await this.loadData();
    },

    async loadData() {
        try {
            const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const res = await fetch(`/api/pedidos/reporte?anio=${this.anio}`, { headers });
            if (!res.ok) { this.reportData = { meses: Array(12).fill(null).map(() => ({ total:0,pendientes:0,aprobados:0,rechazados:0 })), vendedores: [], clientes: [], tipos: [], motivos: [], totalGeneral: 0, totalAprobados: 0, totalRechazados: 0 }; }
            else { this.reportData = await res.json(); }
            this.renderKpis();
            this.renderTabla();
            if (this._chartTimer) clearTimeout(this._chartTimer);
            this._chartTimer = setTimeout(() => this.renderCharts(), 100);
        } catch (e) { console.error('Error reporte pedidos:', e); }
    },

    renderKpis() {
        const d = this.reportData;
        const pendientes = d.meses.reduce((s, m) => s + m.pendientes, 0);
        const tasaAprob = d.totalGeneral > 0 ? Math.round((d.totalAprobados / d.totalGeneral) * 100) : 0;
        const mesesConActividad = d.meses.filter(m => m.total > 0).length;
        const promedioMensual = mesesConActividad > 0 ? Math.round(d.totalGeneral / mesesConActividad) : 0;

        document.getElementById('prKpis').innerHTML = ''
            + '<div class="pr-kpi kpi-blue"><div class="pr-kpi-value">' + d.totalGeneral + '</div><div class="pr-kpi-label">Total ' + this.anio + '</div></div>'
            + '<div class="pr-kpi kpi-green"><div class="pr-kpi-value">' + d.totalAprobados + '</div><div class="pr-kpi-label">Aprobados</div></div>'
            + '<div class="pr-kpi kpi-red"><div class="pr-kpi-value">' + d.totalRechazados + '</div><div class="pr-kpi-label">Rechazados</div></div>'
            + '<div class="pr-kpi kpi-amber"><div class="pr-kpi-value">' + tasaAprob + '%</div><div class="pr-kpi-label">Tasa Aprobacion</div></div>'
            + '<div class="pr-kpi kpi-purple"><div class="pr-kpi-value">' + promedioMensual + '</div><div class="pr-kpi-label">Promedio Mensual</div></div>';
    },

    renderCharts() {
        if (typeof Chart === 'undefined') return;
        Object.values(this.charts).forEach(c => c.destroy());
        this.charts = {};

        const d = this.reportData;
        const mesesCortos = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const labels = d.meses.map((m, i) => mesesCortos[i]);
        const defaults = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { display: false } } };

        this.charts.mes = new Chart(document.getElementById('prChartMes'), {
            type: 'bar',
            data: { labels, datasets: [{ data: d.meses.map(m => m.total), backgroundColor: d.meses.map((m, i) => { const h = new Date(); return (i === h.getMonth() && this.anio === h.getFullYear()) ? '#3b82f6' : '#93c5fd'; }), borderRadius: 6, borderSkipped: false }] },
            options: { ...defaults, scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }, x: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } } }, plugins: { ...defaults.plugins, datalabels: { display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0, anchor: 'end', align: 'top', color: '#475569', font: { size: 11, weight: '700' } } } },
            plugins: [ChartDataLabels]
        });

        const estadoTotal = [d.meses.reduce((s,m)=>s+m.pendientes,0), d.totalAprobados, d.totalRechazados];
        this.charts.estado = new Chart(document.getElementById('prChartEstado'), {
            type: 'doughnut',
            data: { labels: ['Pendiente','Aprobado','Rechazado'], datasets: [{ data: estadoTotal, backgroundColor: ['#f59e0b','#16a34a','#dc2626'], borderWidth: 2, borderColor: '#fff', hoverOffset: 8 }] },
            options: { ...defaults, cutout: '60%', plugins: { ...defaults.plugins, legend: { display: true, position: 'bottom', labels: { padding: 12, usePointStyle: true, pointStyleWidth: 8, font: { size: 10 } } }, datalabels: { display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0, color: '#fff', font: { size: 10, weight: '700' }, formatter: (v, ctx) => { const t = ctx.dataset.data.reduce((a,b)=>a+b,0); return t > 0 ? Math.round((v/t)*100)+'%' : ''; } } } },
            plugins: [ChartDataLabels]
        });

        const vendedores = d.vendedores.slice(0, 10);
        this.charts.vendedor = new Chart(document.getElementById('prChartVendedor'), {
            type: 'bar',
            data: { labels: vendedores.map(v => v.nombre.length > 14 ? v.nombre.substring(0,14)+'.' : v.nombre), datasets: [{ data: vendedores.map(v => v.total), backgroundColor: ['#3b82f6','#8b5cf6','#06b6d4','#16a34a','#f59e0b','#ef4444','#ec4899','#6366f1','#14b8a6','#f97316'], borderRadius: 6, borderSkipped: false }] },
            options: { ...defaults, indexAxis: 'y', scales: { x: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }, y: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } } }, plugins: { ...defaults.plugins, datalabels: { display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0, anchor: 'end', align: 'right', color: '#475569', font: { size: 10, weight: '700' }, padding: { left: 4 } } } },
            plugins: [ChartDataLabels]
        });

        const tipos = d.tipos || [];
        this.charts.tipo = new Chart(document.getElementById('prChartTipo'), {
            type: 'polarArea',
            data: { labels: tipos.map(t => t.nombre), datasets: [{ data: tipos.map(t => t.total), backgroundColor: ['rgba(59,130,246,0.7)','rgba(139,92,246,0.7)','rgba(245,158,11,0.7)','rgba(239,68,68,0.7)','rgba(22,163,74,0.7)'], borderColor: ['#3b82f6','#8b5cf6','#f59e0b','#ef4444','#16a34a'], borderWidth: 2 }] },
            options: { ...defaults, scales: { r: { ticks: { display: false }, grid: { color: '#e2e8f0' } } }, plugins: { ...defaults.plugins, legend: { display: true, position: 'bottom', labels: { padding: 10, usePointStyle: true, pointStyleWidth: 8, font: { size: 9 } } }, datalabels: { display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0, color: '#1e293b', font: { size: 11, weight: '700' }, formatter: (v) => v } } },
            plugins: [ChartDataLabels]
        });

        this.charts.tendencia = new Chart(document.getElementById('prChartTendencia'), {
            type: 'line',
            data: { labels, datasets: [
                { label: 'Total', data: d.meses.map(m => m.total), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#3b82f6', pointBorderColor: '#fff', pointBorderWidth: 2 },
                { label: 'Aprobados', data: d.meses.map(m => m.aprobados), borderColor: '#16a34a', backgroundColor: 'transparent', fill: false, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#16a34a', pointBorderColor: '#fff', pointBorderWidth: 2 }
            ] },
            options: { ...defaults, scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }, x: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } } }, plugins: { ...defaults.plugins, legend: { display: true, position: 'bottom', labels: { padding: 12, usePointStyle: true, pointStyleWidth: 8, font: { size: 10 } } } } }
        });

        const clientes = (d.clientes || []).slice(0, 8);
        this.charts.cliente = new Chart(document.getElementById('prChartCliente'), {
            type: 'bar',
            data: { labels: clientes.map(c => c.nombre.length > 16 ? c.nombre.substring(0,16)+'.' : c.nombre), datasets: [{ data: clientes.map(c => c.total), backgroundColor: ['#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e','#14b8a6','#06b6d4'], borderRadius: 6, borderSkipped: false }] },
            options: { ...defaults, indexAxis: 'y', scales: { x: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }, y: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } } }, plugins: { ...defaults.plugins, datalabels: { display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0, anchor: 'end', align: 'right', color: '#475569', font: { size: 10, weight: '700' }, padding: { left: 4 } } } },
            plugins: [ChartDataLabels]
        });
    },

    renderTabla() {
        const d = this.reportData;
        const mesesCortos = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const badge = (v, color) => `<span class="pr-badge" style="background:${color}15;color:${color}">${v}</span>`;
        let rows = '';
        for (let i = 0; i < 12; i++) {
            const m = d.meses[i];
            if (m.total === 0) continue;
            const tasa = m.total > 0 ? Math.round((m.aprobados / m.total) * 100) : 0;
            rows += `<tr>
                <td style="font-weight:700">${mesesCortos[i]}</td>
                <td>${m.total}</td>
                <td>${badge(m.pendientes, '#f59e0b')}</td>
                <td>${badge(m.aprobados, '#16a34a')}</td>
                <td>${badge(m.rechazados, '#dc2626')}</td>
                <td style="font-weight:600">${tasa}%</td>
            </tr>`;
        }
        if (!rows) rows = '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:24px">Sin datos para este anio</td></tr>';
        document.getElementById('prTabla').innerHTML = '<table class="pr-table">'
            + '<thead><tr><th>Mes</th><th>Total</th><th>Pend.</th><th>Aprobados</th><th>Rechazados</th><th>% Aprobacion</th></tr></thead>'
            + '<tbody>' + rows + '</tbody></table>';
    },

    cambiarAnio(dir) {
        this.anio += dir;
        document.getElementById('prAnioLabel').textContent = this.anio;
        this.loadData();
    }
});
