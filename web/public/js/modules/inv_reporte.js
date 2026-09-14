App.registerModule('inv_reporte', {
    reportData: null,
    charts: {},
    anio: new Date().getFullYear(),
    _chartTimer: null,

    async render() {
        const el = document.getElementById('page-inv_reporte');
        el.innerHTML = '<style>'
            + '.ir-section{background:white;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.04)}'
            + '.ir-kpi-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px}'
            + '.ir-kpi{background:linear-gradient(135deg,#f8fafc,#f1f5f9);border:1px solid #e2e8f0;border-radius:10px;padding:16px;text-align:center;position:relative;overflow:hidden}'
            + '.ir-kpi::before{content:"";position:absolute;top:0;left:0;width:4px;height:100%;border-radius:4px 0 0 4px}'
            + '.ir-kpi.kpi-green::before{background:#16a34a}'
            + '.ir-kpi.kpi-red::before{background:#dc2626}'
            + '.ir-kpi.kpi-blue::before{background:#3b82f6}'
            + '.ir-kpi.kpi-amber::before{background:#f59e0b}'
            + '.ir-kpi.kpi-purple::before{background:#8b5cf6}'
            + '.ir-kpi-value{font-size:28px;font-weight:800;color:#1e293b;line-height:1.1}'
            + '.ir-kpi-label{font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px}'
            + '.ir-chart-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}'
            + '.ir-chart-box{background:white;border:1px solid #e2e8f0;border-radius:12px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.04)}'
            + '.ir-chart-title{font-size:13px;font-weight:700;color:#1e293b;margin-bottom:12px;display:flex;align-items:center;gap:6px}'
            + '.ir-chart-title svg{width:16px;height:16px;flex-shrink:0}'
            + '.ir-table-wrap{overflow-x:auto;border:1px solid #e2e8f0;border-radius:8px}'
            + '.ir-table{width:100%;border-collapse:collapse;font-size:12px}'
            + '.ir-table th{background:#f8fafc;padding:10px 12px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0}'
            + '.ir-table td{padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155}'
            + '.ir-table tr:hover td{background:#f8fafc}'
            + '.ir-badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600}'
            + '@media(max-width:768px){.ir-chart-row{grid-template-columns:1fr}.ir-kpi-row{grid-template-columns:repeat(2,1fr)}.ir-kpi-value{font-size:22px}}'
            + '</style>'

            + '<div style="background:linear-gradient(135deg,#065f46 0%,#059669 50%,#10b981 100%);border-radius:16px;padding:20px;margin-bottom:20px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(6,95,70,0.3)">'
            + '<div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(16,185,129,0.2) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">'
            + '<div><h2 style="margin:0;font-size:18px;font-weight:800;color:white;letter-spacing:-0.5px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-4px;margin-right:8px"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>Reporte de Inventario</h2>'
            + '<p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.7)">Analisis mensual de movimientos de stock</p></div>'
            + '<div style="display:flex;gap:6px;align-items:center">'
            + '<button class="btn btn-outline" style="color:white;border-color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.1)" onclick="App.modules.inv_reporte.cambiarAnio(-1)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>'
            + '<span id="irAnioLabel" style="color:white;font-size:16px;font-weight:700;min-width:60px;text-align:center">' + this.anio + '</span>'
            + '<button class="btn btn-outline" style="color:white;border-color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.1)" onclick="App.modules.inv_reporte.cambiarAnio(1)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>'
            + '</div></div></div>'

            + '<div id="irKpis" class="ir-kpi-row"></div>'
            + '<div id="irAlertas" style="margin-bottom:16px"></div>'
            + '<div class="ir-chart-row">'
            + '<div class="ir-chart-box"><div class="ir-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg>Movimientos por Mes</div><div style="position:relative;height:280px"><canvas id="irChartMes"></canvas></div></div>'
            + '<div class="ir-chart-box"><div class="ir-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20" fill="#8b5cf6" opacity="0.2"/></svg>Por Tipo de Cristal</div><div style="position:relative;height:280px;display:flex;justify-content:center"><canvas id="irChartTipo"></canvas></div></div>'
            + '</div>'
            + '<div class="ir-chart-row">'
            + '<div class="ir-chart-box"><div class="ir-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>M2 Entradas vs Salidas</div><div style="position:relative;height:280px"><canvas id="irChartM2"></canvas></div></div>'
            + '<div class="ir-chart-box"><div class="ir-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>Top Materiales (Salidas)</div><div style="position:relative;height:280px"><canvas id="irChartMaterial"></canvas></div></div>'
            + '</div>'
            + '<div class="ir-chart-row">'
            + '<div class="ir-chart-box"><div class="ir-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>Tendencia de Stock</div><div style="position:relative;height:280px"><canvas id="irChartTendencia"></canvas></div></div>'
            + '<div class="ir-chart-box"><div class="ir-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>Top Dimensiones</div><div style="position:relative;height:280px"><canvas id="irChartDimension"></canvas></div></div>'
            + '</div>'
            + '<div class="ir-section"><div class="ir-chart-title" style="margin-bottom:12px"><svg viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="2" width="16" height="16"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/></svg>Detalle Mensual</div><div id="irTabla" class="ir-table-wrap"></div></div>';

        await this.loadData();
    },

    async loadData() {
        try {
            const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const res = await fetch(`/api/inv/reporte?anio=${this.anio}`, { headers });
            if (!res.ok) { this.reportData = { meses: Array(12).fill(null).map(() => ({ total:0,entradas:0,salidas:0,m2_entradas:0,m2_salidas:0,planchas_entradas:0,planchas_salidas:0 })), topMateriales: [], topDimensiones: [], tipos: [], totalEntradas: 0, totalSalidas: 0, totalM2Entradas: 0, totalM2Salidas: 0 }; }
            else { this.reportData = await res.json(); }
            this.renderKpis();
            this.renderAlertas();
            this.renderTabla();
            if (this._chartTimer) clearTimeout(this._chartTimer);
            this._chartTimer = setTimeout(() => this.renderCharts(), 100);
        } catch (e) { console.error('Error reporte inventario:', e); }
    },

    renderKpis() {
        const d = this.reportData;
        const sparkSvg = (data, color) => {
            if (!data || data.length < 2) return '';
            const max = Math.max(...data, 1);
            const w = 120, h = 32;
            const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(' ');
            return `<svg width="${w}" height="${h}" style="display:block;margin-top:6px"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polygon points="0,${h} ${pts} ${w},${h}" fill="${color}" opacity="0.15"/></svg>`;
        };

        document.getElementById('irKpis').innerHTML = ''
            + '<div class="ir-kpi kpi-amber"><div class="ir-kpi-value">' + (d.planchasMes || 0).toLocaleString('es-CL') + '</div><div class="ir-kpi-label">Planchas Este Mes</div>' + sparkSvg(d.sparklinePlanchas, '#f59e0b') + '</div>'
            + '<div class="ir-kpi kpi-blue"><div class="ir-kpi-value">' + (d.stockPlanchas || 0).toLocaleString('es-CL') + ' <span style="font-size:14px;font-weight:600">pl.</span></div><div class="ir-kpi-label">Stock Planchas</div></div>'
            + '<div class="ir-kpi kpi-purple"><div class="ir-kpi-value">' + (d.kgStock || 0).toLocaleString('es-CL') + ' <span style="font-size:14px;font-weight:600">kg</span></div><div class="ir-kpi-label">KG en Stock</div>' + sparkSvg(d.sparklineKg, '#8b5cf6') + '</div>'
            + '<div class="ir-kpi kpi-green"><div class="ir-kpi-value">' + (d.autonomia || 0) + ' <span style="font-size:14px;font-weight:600">meses</span></div><div class="ir-kpi-label">Autonomia Prom.</div></div>';
    },

    renderCharts() {
        if (typeof Chart === 'undefined') return;
        Object.values(this.charts).forEach(c => c.destroy());
        this.charts = {};

        const d = this.reportData;
        const mesesCortos = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const labels = d.meses.map((m, i) => mesesCortos[i]);
        const defaults = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { display: false } } };

        this.charts.mes = new Chart(document.getElementById('irChartMes'), {
            type: 'bar',
            data: { labels, datasets: [
                { label: 'Planchas Consumidas', data: d.meses.map(m => m.salidas), backgroundColor: '#ef4444', borderRadius: 6, borderSkipped: false }
            ] },
            options: { ...defaults, scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }, x: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } } }, plugins: { ...defaults.plugins, legend: { display: false }, datalabels: { display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0, anchor: 'end', align: 'top', color: '#475569', font: { size: 11, weight: '700' } } } },
            plugins: [ChartDataLabels]
        });

        const tipoTotal = d.tipos || [];
        this.charts.tipo = new Chart(document.getElementById('irChartTipo'), {
            type: 'doughnut',
            data: { labels: tipoTotal.map(t => t.nombre), datasets: [{ data: tipoTotal.map(t => t.total), backgroundColor: ['#10b981','#3b82f6','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#ec4899','#f97316'], borderWidth: 2, borderColor: '#fff', hoverOffset: 8 }] },
            options: { ...defaults, cutout: '60%', plugins: { ...defaults.plugins, legend: { display: true, position: 'bottom', labels: { padding: 10, usePointStyle: true, pointStyleWidth: 8, font: { size: 9 } } }, datalabels: { display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0, color: '#fff', font: { size: 10, weight: '700' }, formatter: (v, ctx) => { const t = ctx.dataset.data.reduce((a,b)=>a+b,0); return t > 0 ? Math.round((v/t)*100)+'%' : ''; } } } },
            plugins: [ChartDataLabels]
        });

        this.charts.m2 = new Chart(document.getElementById('irChartM2'), {
            type: 'bar',
            data: { labels, datasets: [
                { label: 'M2 Entradas', data: d.meses.map(m => Math.round(m.m2_entradas)), backgroundColor: '#10b981', borderRadius: 6, borderSkipped: false },
                { label: 'M2 Salidas', data: d.meses.map(m => Math.round(m.m2_salidas)), backgroundColor: '#ef4444', borderRadius: 6, borderSkipped: false }
            ] },
            options: { ...defaults, scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }, x: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } } }, plugins: { ...defaults.plugins, legend: { display: true, position: 'bottom', labels: { padding: 12, usePointStyle: true, pointStyleWidth: 8, font: { size: 10 } } }, datalabels: { display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0, anchor: 'end', align: 'top', color: '#475569', font: { size: 9, weight: '600' } } } },
            plugins: [ChartDataLabels]
        });

        const materiales = (d.topMateriales || []).slice(0, 8);
        this.charts.material = new Chart(document.getElementById('irChartMaterial'), {
            type: 'bar',
            data: { labels: materiales.map(m => m.nombre.length > 14 ? m.nombre.substring(0,14)+'.' : m.nombre), datasets: [{ data: materiales.map(m => m.total), backgroundColor: ['#10b981','#3b82f6','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#ec4899','#f97316'], borderRadius: 6, borderSkipped: false }] },
            options: { ...defaults, indexAxis: 'y', scales: { x: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }, y: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } } }, plugins: { ...defaults.plugins, datalabels: { display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0, anchor: 'end', align: 'right', color: '#475569', font: { size: 10, weight: '700' }, padding: { left: 4 } } } },
            plugins: [ChartDataLabels]
        });

        this.charts.tendencia = new Chart(document.getElementById('irChartTendencia'), {
            type: 'line',
            data: { labels, datasets: [
                { label: 'Stock Neto M2', data: d.meses.map(m => Math.round(m.m2_entradas - m.m2_salidas)), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#10b981', pointBorderColor: '#fff', pointBorderWidth: 2 },
                { label: 'Entradas M2', data: d.meses.map(m => Math.round(m.m2_entradas)), borderColor: '#3b82f6', backgroundColor: 'transparent', fill: false, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#3b82f6', pointBorderColor: '#fff', pointBorderWidth: 2 }
            ] },
            options: { ...defaults, scales: { y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }, x: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } } }, plugins: { ...defaults.plugins, legend: { display: true, position: 'bottom', labels: { padding: 12, usePointStyle: true, pointStyleWidth: 8, font: { size: 10 } } } } }
        });

        const dims = (d.topDimensiones || []).slice(0, 8);
        this.charts.dimension = new Chart(document.getElementById('irChartDimension'), {
            type: 'bar',
            data: { labels: dims.map(r => r.dimension), datasets: [{ data: dims.map(r => r.salidas), backgroundColor: ['#06b6d4','#0ea5e9','#3b82f6','#6366f1','#8b5cf6','#a855f7','#d946ef','#ec4899'], borderRadius: 6, borderSkipped: false }] },
            options: { ...defaults, scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }, x: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } } }, plugins: { ...defaults.plugins, datalabels: { display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0, anchor: 'end', align: 'top', color: '#475569', font: { size: 11, weight: '700' } } } },
            plugins: [ChartDataLabels]
        });
    },

    renderAlertas() {
        const d = this.reportData;
        const alertas = d.alertas || [];
        if (alertas.length === 0) {
            document.getElementById('irAlertas').innerHTML = '';
            return;
        }
        const colores = { critico: { bg: '#fef2f2', border: '#fecaca', text: '#dc2626', icon: '●', label: 'Stock critico' },
            bajo: { bg: '#fef2f2', border: '#fecaca', text: '#dc2626', icon: '●', label: 'Stock bajo' },
            medio: { bg: '#fffbeb', border: '#fde68a', text: '#d97706', icon: '●', label: 'Stock medio' },
            ok: { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a', icon: '●', label: 'Stock ok' } };
        let html = '<div style="display:flex;gap:8px;flex-wrap:wrap">';
        alertas.forEach(a => {
            const c = colores[a.nivel] || colores.ok;
            html += '<div style="display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;background:' + c.bg + ';border:1px solid ' + c.border + ';font-size:12px;color:' + c.text + '">'
                + '<span style="font-size:14px">' + c.icon + '</span>'
                + '<span>' + c.label + ': ' + a.nombre + ' ' + a.espesor + 'mm — ' + (a.autonomia || 0) + ' meses de autonomia</span></div>';
        });
        html += '</div>';
        document.getElementById('irAlertas').innerHTML = html;
    },
        const d = this.reportData;
        const mesesCortos = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const badge = (v, color) => `<span class="ir-badge" style="background:${color}15;color:${color}">${v}</span>`;
        let rows = '';
        for (let i = 0; i < 12; i++) {
            const m = d.meses[i];
            if (m.total === 0) continue;
            rows += `<tr>
                <td style="font-weight:700">${mesesCortos[i]}</td>
                <td>${m.entradas}</td>
                <td>${m.salidas}</td>
                <td>${Math.round(m.m2_entradas).toLocaleString('es-CL')}</td>
                <td>${Math.round(m.m2_salidas).toLocaleString('es-CL')}</td>
                <td style="font-weight:600;color:${(m.m2_entradas - m.m2_salidas) >= 0 ? '#16a34a' : '#dc2626'}">${(m.m2_entradas - m.m2_salidas) >= 0 ? '+' : ''}${Math.round(m.m2_entradas - m.m2_salidas).toLocaleString('es-CL')}</td>
            </tr>`;
        }
        if (!rows) rows = '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:24px">Sin datos para este anio</td></tr>';
        document.getElementById('irTabla').innerHTML = '<table class="ir-table">'
            + '<thead><tr><th>Mes</th><th>Entradas</th><th>Salidas</th><th>M2 Entrada</th><th>M2 Salida</th><th>Neto M2</th></tr></thead>'
            + '<tbody>' + rows + '</tbody></table>';
    },

    cambiarAnio(dir) {
        this.anio += dir;
        document.getElementById('irAnioLabel').textContent = this.anio;
        this.loadData();
    }
});
