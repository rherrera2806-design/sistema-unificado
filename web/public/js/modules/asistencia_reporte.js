App.registerModule('asistencia_reporte', {
    reportData: null,
    charts: {},
    anio: new Date().getFullYear(),
    _chartTimer: null,

    async render() {
        const el = document.getElementById('page-asistencia_reporte');
        el.innerHTML = '<style>'
            + '.ar-section{background:white;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.04)}'
            + '.ar-kpi-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px}'
            + '.ar-kpi{background:linear-gradient(135deg,#f8fafc,#f1f5f9);border:1px solid #e2e8f0;border-radius:10px;padding:16px;text-align:center;position:relative;overflow:hidden}'
            + '.ar-kpi::before{content:"";position:absolute;top:0;left:0;width:4px;height:100%;border-radius:4px 0 0 4px}'
            + '.ar-kpi.kpi-red::before{background:#dc2626}'
            + '.ar-kpi.kpi-blue::before{background:#3b82f6}'
            + '.ar-kpi.kpi-amber::before{background:#f59e0b}'
            + '.ar-kpi.kpi-green::before{background:#16a34a}'
            + '.ar-kpi.kpi-purple::before{background:#8b5cf6}'
            + '.ar-kpi-value{font-size:28px;font-weight:800;color:#1e293b;line-height:1.1}'
            + '.ar-kpi-label{font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px}'
            + '.ar-chart-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}'
            + '.ar-chart-box{background:white;border:1px solid #e2e8f0;border-radius:12px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.04)}'
            + '.ar-chart-title{font-size:13px;font-weight:700;color:#1e293b;margin-bottom:12px;display:flex;align-items:center;gap:6px}'
            + '.ar-chart-title svg{width:16px;height:16px;flex-shrink:0}'
            + '.ar-table-wrap{overflow-x:auto;border:1px solid #e2e8f0;border-radius:8px}'
            + '.ar-table{width:100%;border-collapse:collapse;font-size:12px}'
            + '.ar-table th{background:#f8fafc;padding:10px 12px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0}'
            + '.ar-table td{padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155}'
            + '.ar-table tr:hover td{background:#f8fafc}'
            + '.ar-badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600}'
            + '@media(max-width:768px){.ar-chart-row{grid-template-columns:1fr}.ar-kpi-row{grid-template-columns:repeat(2,1fr)}.ar-kpi-value{font-size:22px}}'
            + '</style>'

            + '<div style="background:linear-gradient(135deg,#7c3aed 0%,#6d28d9 50%,#8b5cf6 100%);border-radius:16px;padding:20px;margin-bottom:20px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(124,58,237,0.3)">'
            + '<div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(139,92,246,0.2) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">'
            + '<div><h2 style="margin:0;font-size:18px;font-weight:800;color:white;letter-spacing:-0.5px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-4px;margin-right:8px"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Reporte de Asistencia</h2>'
            + '<p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.7)">Analisis anual de asistencia del personal</p></div>'
            + '<div style="display:flex;gap:6px;align-items:center">'
            + '<button class="btn btn-outline" style="color:white;border-color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.1)" onclick="App.modules.asistencia_reporte.cambiarAnio(-1)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>'
            + '<span id="arAnioLabel" style="color:white;font-size:16px;font-weight:700;min-width:60px;text-align:center">' + this.anio + '</span>'
            + '<button class="btn btn-outline" style="color:white;border-color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.1)" onclick="App.modules.asistencia_reporte.cambiarAnio(1)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>'
            + '</div></div></div>'

            + '<div id="arKpis" class="ar-kpi-row"></div>'
            + '<div class="ar-chart-row">'
            + '<div class="ar-chart-box"><div class="ar-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Faltas por Mes</div><div style="position:relative;height:280px"><canvas id="arChartFaltas"></canvas></div></div>'
            + '<div class="ar-chart-box"><div class="ar-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20" fill="#8b5cf6" opacity="0.2"/></svg>Por Tipo de Ausencia</div><div style="position:relative;height:280px;display:flex;justify-content:center"><canvas id="arChartTipo"></canvas></div></div>'
            + '</div>'
            + '<div class="ar-chart-row">'
            + '<div class="ar-chart-box"><div class="ar-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Todas las Ausencias por Mes</div><div style="position:relative;height:280px"><canvas id="arChartAusencias"></canvas></div></div>'
            + '<div class="ar-chart-box"><div class="ar-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>Horas Extras por Mes</div><div style="position:relative;height:280px"><canvas id="arChartHoras"></canvas></div></div>'
            + '</div>'
            + '<div class="ar-chart-row">'
            + '<div class="ar-chart-box"><div class="ar-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Ranking de Faltas</div><div style="position:relative;height:280px"><canvas id="arChartRanking"></canvas></div></div>'
            + '<div class="ar-chart-box"><div class="ar-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Detalle Mensual</div><div id="arTabla" class="ar-table-wrap" style="max-height:280px;overflow-y:auto"></div></div>'
            + '</div>';

        await this.loadData();
    },

    async loadData() {
        try {
            const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const res = await fetch(`/api/asistencia/reporte?anio=${this.anio}`, { headers });
            if (!res.ok) { this.reportData = { meses: Array(12).fill(null).map(() => ({ faltas:0,permisos:0,licencias:0,vacaciones:0,horas_extras:0 })), ranking: [], trabajadores_activos: 0, totalFaltas: 0, totalPermisos: 0, totalLicencias: 0, totalVacaciones: 0, totalHorasExtras: 0 }; }
            else { this.reportData = await res.json(); }
            this.renderKpis();
            this.renderTabla();
            if (this._chartTimer) clearTimeout(this._chartTimer);
            this._chartTimer = setTimeout(() => this.renderCharts(), 100);
        } catch (e) { console.error('Error reporte asistencia:', e); }
    },

    renderKpis() {
        const d = this.reportData;

        document.getElementById('arKpis').innerHTML = ''
            + '<div class="ar-kpi kpi-red"><div class="ar-kpi-value">' + d.totalFaltas + '</div><div class="ar-kpi-label">Faltas</div></div>'
            + '<div class="ar-kpi kpi-blue"><div class="ar-kpi-value">' + d.totalPermisos + '</div><div class="ar-kpi-label">Permisos</div></div>'
            + '<div class="ar-kpi kpi-amber"><div class="ar-kpi-value">' + d.totalLicencias + '</div><div class="ar-kpi-label">Licencias</div></div>'
            + '<div class="ar-kpi kpi-green"><div class="ar-kpi-value">' + d.totalVacaciones + '</div><div class="ar-kpi-label">Vacaciones</div></div>'
            + '<div class="ar-kpi kpi-purple"><div class="ar-kpi-value">' + d.totalHorasExtras + '</div><div class="ar-kpi-label">Horas Extras</div></div>';
    },

    renderCharts() {
        if (typeof Chart === 'undefined') return;
        Object.values(this.charts).forEach(c => c.destroy());
        this.charts = {};

        const d = this.reportData;
        const mesesCortos = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const labels = d.meses.map((m, i) => mesesCortos[i]);
        const defaults = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { display: false } } };
        const maxFaltas = Math.max(...d.meses.map(m => m.faltas), 1);

        this.charts.faltas = new Chart(document.getElementById('arChartFaltas'), {
            type: 'bar',
            data: { labels, datasets: [{ label: 'Faltas', data: d.meses.map(m => m.faltas), backgroundColor: '#ef4444', borderRadius: 6, borderSkipped: false }] },
            options: { ...defaults, layout: { padding: { top: 30 } }, scales: { y: { beginAtZero: true, suggestedMax: maxFaltas * 1.15, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }, x: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } } }, plugins: { ...defaults.plugins, datalabels: { display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0, anchor: 'end', align: 'top', offset: 6, color: '#1e293b', font: { size: 13, weight: '800' } } } },
            plugins: [ChartDataLabels]
        });

        const tipoTotal = [
            { nombre: 'Faltas', total: d.totalFaltas },
            { nombre: 'Permisos', total: d.totalPermisos },
            { nombre: 'Licencias', total: d.totalLicencias },
            { nombre: 'Vacaciones', total: d.totalVacaciones }
        ].filter(t => t.total > 0);

        this.charts.tipo = new Chart(document.getElementById('arChartTipo'), {
            type: 'doughnut',
            data: { labels: tipoTotal.map(t => t.nombre), datasets: [{ data: tipoTotal.map(t => t.total), backgroundColor: ['#ef4444','#3b82f6','#f59e0b','#16a34a'], borderWidth: 2, borderColor: '#fff', hoverOffset: 8 }] },
            options: { ...defaults, cutout: '60%', plugins: { ...defaults.plugins, legend: { display: true, position: 'bottom', labels: { padding: 12, usePointStyle: true, pointStyleWidth: 8, font: { size: 10 } } }, datalabels: { display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0, color: '#fff', font: { size: 10, weight: '700' }, formatter: (v, ctx) => { const t = ctx.dataset.data.reduce((a,b)=>a+b,0); return t > 0 ? Math.round((v/t)*100)+'%' : ''; } } } },
            plugins: [ChartDataLabels]
        });

        this.charts.tendencia = new Chart(document.getElementById('arChartAusencias'), {
            type: 'bar',
            data: { labels, datasets: [
                { label: 'Faltas', data: d.meses.map(m => m.faltas), backgroundColor: '#ef4444', borderRadius: 4, borderSkipped: false },
                { label: 'Permisos', data: d.meses.map(m => m.permisos), backgroundColor: '#3b82f6', borderRadius: 4, borderSkipped: false },
                { label: 'Licencias', data: d.meses.map(m => m.licencias), backgroundColor: '#f59e0b', borderRadius: 4, borderSkipped: false },
                { label: 'Vacaciones', data: d.meses.map(m => m.vacaciones), backgroundColor: '#16a34a', borderRadius: 4, borderSkipped: false }
            ] },
            options: { ...defaults, scales: { x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } }, y: { stacked: true, beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } } }, plugins: { ...defaults.plugins, legend: { display: true, position: 'bottom', labels: { padding: 12, usePointStyle: true, pointStyleWidth: 8, font: { size: 10 } } } } }
        });

        const maxHoras = Math.max(...d.meses.map(m => m.horas_extras), 1);
        this.charts.horas = new Chart(document.getElementById('arChartHoras'), {
            type: 'bar',
            data: { labels, datasets: [{ label: 'Horas Extras', data: d.meses.map(m => m.horas_extras), backgroundColor: '#f59e0b', borderRadius: 6, borderSkipped: false }] },
            options: { ...defaults, layout: { padding: { top: 30 } }, scales: { y: { beginAtZero: true, suggestedMax: maxHoras * 1.15, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }, x: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } } }, plugins: { ...defaults.plugins, datalabels: { display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0, anchor: 'end', align: 'top', offset: 6, color: '#1e293b', font: { size: 12, weight: '700' } } } },
            plugins: [ChartDataLabels]
        });

        const ranking = (d.ranking || []).slice(0, 8);
        const maxRanking = Math.max(...ranking.map(r => r.faltas), 1);
        this.charts.ranking = new Chart(document.getElementById('arChartRanking'), {
            type: 'bar',
            data: { labels: ranking.map(r => r.nombre.length > 16 ? r.nombre.substring(0,16)+'.' : r.nombre), datasets: [{ data: ranking.map(r => r.faltas), backgroundColor: ['#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e','#14b8a6','#06b6d4'], borderRadius: 6, borderSkipped: false }] },
            options: { ...defaults, indexAxis: 'y', layout: { padding: { right: 30 } }, scales: { x: { beginAtZero: true, suggestedMax: maxRanking * 1.2, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }, y: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } } }, plugins: { ...defaults.plugins, datalabels: { display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0, anchor: 'end', align: 'right', offset: 6, color: '#475569', font: { size: 10, weight: '700' } } } },
            plugins: [ChartDataLabels]
        });
    },

    renderTabla() {
        const d = this.reportData;
        const mesesCortos = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        let rows = '';
        for (let i = 0; i < 12; i++) {
            const m = d.meses[i];
            if (m.faltas + m.permisos + m.licencias + m.vacaciones + m.horas_extras === 0) continue;
            rows += `<tr>
                <td style="font-weight:700">${mesesCortos[i]}</td>
                <td style="color:#dc2626;font-weight:600">${m.faltas}</td>
                <td style="color:#3b82f6;font-weight:600">${m.permisos}</td>
                <td style="color:#f59e0b;font-weight:600">${m.licencias}</td>
                <td style="color:#16a34a;font-weight:600">${m.vacaciones}</td>
                <td style="color:#8b5cf6;font-weight:600">${m.horas_extras}</td>
            </tr>`;
        }
        if (!rows) rows = '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:24px">Sin datos para este anio</td></tr>';
        document.getElementById('arTabla').innerHTML = '<table class="ar-table">'
            + '<thead><tr><th>Mes</th><th>Faltas</th><th>Permisos</th><th>Licencias</th><th>Vacaciones</th><th>H. Extras</th></tr></thead>'
            + '<tbody>' + rows + '</tbody></table>';
    },

    cambiarAnio(dir) {
        this.anio += dir;
        document.getElementById('arAnioLabel').textContent = this.anio;
        this.loadData();
    }
});
