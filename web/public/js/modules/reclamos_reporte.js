App.registerModule('reclamos_reporte', {
    reportData: null,
    charts: {},
    anio: new Date().getFullYear(),
    _chartTimer: null,

    async render() {
        const el = document.getElementById('page-reclamos_reporte');
        el.innerHTML = '<style>'
            + '.rr-section{background:white;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.04)}'
            + '.rr-kpi-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px}'
            + '.rr-kpi{background:linear-gradient(135deg,#f8fafc,#f1f5f9);border:1px solid #e2e8f0;border-radius:10px;padding:16px;text-align:center;position:relative;overflow:hidden}'
            + '.rr-kpi::before{content:"";position:absolute;top:0;left:0;width:4px;height:100%;border-radius:4px 0 0 4px}'
            + '.rr-kpi.kpi-orange::before{background:#f97316}'
            + '.rr-kpi.kpi-green::before{background:#16a34a}'
            + '.rr-kpi.kpi-blue::before{background:#3b82f6}'
            + '.rr-kpi.kpi-red::before{background:#dc2626}'
            + '.rr-kpi.kpi-purple::before{background:#8b5cf6}'
            + '.rr-kpi-value{font-size:28px;font-weight:800;color:#1e293b;line-height:1.1}'
            + '.rr-kpi-label{font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px}'
            + '.rr-chart-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}'
            + '.rr-chart-box{background:white;border:1px solid #e2e8f0;border-radius:12px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.04)}'
            + '.rr-chart-title{font-size:13px;font-weight:700;color:#1e293b;margin-bottom:12px;display:flex;align-items:center;gap:6px}'
            + '.rr-chart-title svg{width:16px;height:16px;flex-shrink:0}'
            + '.rr-table-wrap{overflow-x:auto;border:1px solid #e2e8f0;border-radius:8px}'
            + '.rr-table{width:100%;border-collapse:collapse;font-size:12px}'
            + '.rr-table th{background:#f8fafc;padding:10px 12px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0}'
            + '.rr-table td{padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155}'
            + '.rr-table tr:hover td{background:#f8fafc}'
            + '.rr-badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600}'
            + '@media(max-width:768px){.rr-chart-row{grid-template-columns:1fr;overflow-x:auto}.rr-kpi-row{grid-template-columns:repeat(2,1fr)}.rr-kpi-value{font-size:20px}.rr-chart-box{padding:8px;overflow:hidden}.rr-section{padding:10px}.rr-table{font-size:11px}.rr-table th{font-size:9px}.rr-chart-row canvas{height:180px!important}.rr-hero{padding:12px!important;border-radius:12px!important;margin-bottom:16px!important}}'
            + '</style>'

            + '<div class="rr-hero" style="background:linear-gradient(135deg,#7c2d12 0%,#c2410c 50%,#f97316 100%);border-radius:16px;padding:8px 16px;margin-bottom:20px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(124,45,18,0.3)">'
            + '<div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(249,115,22,0.2) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">'
            + '<div><h2 style="margin:0;font-size:18px;font-weight:800;color:white;letter-spacing:-0.5px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-4px;margin-right:8px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Reporte de Reclamos</h2>'
            + '<p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.7)">Analisis mensual de reclamos y devoluciones</p></div>'
            + '<div style="display:flex;gap:6px;align-items:center">'
            + '<button class="btn btn-outline" style="color:white;border-color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.1)" onclick="App.modules.reclamos_reporte.cambiarAnio(-1)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>'
            + '<span id="rrAnioLabel" style="color:white;font-size:16px;font-weight:700;min-width:60px;text-align:center">' + this.anio + '</span>'
            + '<button class="btn btn-outline" style="color:white;border-color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.1)" onclick="App.modules.reclamos_reporte.cambiarAnio(1)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>'
            + '</div></div></div>'

            + '<div id="rrKpis" class="rr-kpi-row"></div>'
            + '<div class="rr-chart-row">'
            + '<div class="rr-chart-box"><div class="rr-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2"><rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/></svg>Reclamos por Mes</div><div style="position:relative;height:280px"><canvas id="rrChartMes"></canvas></div></div>'
            + '<div class="rr-chart-box"><div class="rr-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20" fill="#8b5cf6" opacity="0.2"/></svg>Por Estado</div><div style="position:relative;height:280px;display:flex;justify-content:center"><canvas id="rrChartEstado"></canvas></div></div>'
            + '</div>'
            + '<div class="rr-chart-row">'
            + '<div class="rr-chart-box"><div class="rr-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>Por Responsable</div><div style="position:relative;height:280px"><canvas id="rrChartResponsable"></canvas></div></div>'
            + '<div class="rr-chart-box"><div class="rr-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Por Motivo</div><div style="position:relative;height:280px"><canvas id="rrChartMotivo"></canvas></div></div>'
            + '</div>'
            + '<div class="rr-chart-row">'
            + '<div class="rr-chart-box"><div class="rr-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>Tendencia Mensual</div><div style="position:relative;height:280px"><canvas id="rrChartTendencia"></canvas></div></div>'
            + '<div class="rr-chart-box"><div class="rr-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Por Resolucion</div><div style="position:relative;height:280px;display:flex;justify-content:center"><canvas id="rrChartResolucion"></canvas></div></div>'
            + '</div>'
            + '<div class="rr-chart-row">'
            + '<div class="rr-chart-box"><div class="rr-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>Costo Total por Mes ($)</div><div style="position:relative;height:280px"><canvas id="rrChartCosto"></canvas></div></div>'
            + '<div class="rr-chart-box"><div class="rr-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Top Clientes con Reclamos</div><div style="position:relative;height:280px"><canvas id="rrChartCliente"></canvas></div></div>'
            + '</div>'
            + '<div class="rr-chart-row">'
            + '<div class="rr-chart-box"><div class="rr-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>Costo por Responsable ($)</div><div style="position:relative;height:280px"><canvas id="rrChartCostoResp"></canvas></div></div>'
            + '<div class="rr-chart-box"><div class="rr-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Reclamos por Dia de Semana</div><div style="position:relative;height:280px"><canvas id="rrChartDia"></canvas></div></div>'
            + '</div>'
            + '<div class="rr-section"><div class="rr-chart-title" style="margin-bottom:12px"><svg viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="2" width="16" height="16"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/></svg>Detalle Mensual</div><div id="rrTabla" class="rr-table-wrap"></div></div>';

        await this.loadData();
    },

    async loadData() {
        try {
            const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const res = await fetch(`/api/reclamos/reporte?anio=${this.anio}`, { headers });
            if (!res.ok) { console.error('API error:', res.status); this.reportData = { meses: Array(12).fill(null).map(() => ({ total:0,pendientes:0,en_revision:0,en_proceso:0,finalizados:0,fab_nueva:0,reproceso:0,rechazadas:0,costo:0 })), responsables: [], motivos: [], resoluciones: [], clientes: [], costoPorResponsable: [], diasSemana: [], totalGeneral: 0, totalFinalizados: 0, costoTotal: 0 }; }
            else { this.reportData = await res.json(); }
            this.renderKpis();
            this.renderTabla();
            if (this._chartTimer) clearTimeout(this._chartTimer);
            this._chartTimer = setTimeout(() => this.renderCharts(), 100);
        } catch (e) { console.error('Error reporte reclamos:', e); }
    },

    renderKpis() {
        const d = this.reportData;
        const pendientes = d.meses.reduce((s, m) => s + m.pendientes, 0);
        const finalizados = d.totalFinalizados || d.meses.reduce((s, m) => s + m.finalizados, 0);
        const tasaResuelta = d.totalGeneral > 0 ? Math.round((finalizados / d.totalGeneral) * 100) : 0;
        const mesesConActividad = d.meses.filter(m => m.total > 0).length;
        const promedioMensual = mesesConActividad > 0 ? Math.round(d.totalGeneral / mesesConActividad) : 0;
        const costoTotal = d.costoTotal || 0;
        const costoFmt = costoTotal >= 1000000 ? '$' + (costoTotal / 1000000).toFixed(1) + 'M' : costoTotal >= 1000 ? '$' + (costoTotal / 1000).toFixed(0) + 'K' : '$' + costoTotal;

        document.getElementById('rrKpis').innerHTML = ''
            + '<div class="rr-kpi kpi-orange"><div class="rr-kpi-value">' + d.totalGeneral + '</div><div class="rr-kpi-label">Total ' + this.anio + '</div></div>'
            + '<div class="rr-kpi kpi-green"><div class="rr-kpi-value">' + finalizados + '</div><div class="rr-kpi-label">Finalizados</div></div>'
            + '<div class="rr-kpi kpi-blue"><div class="rr-kpi-value">' + tasaResuelta + '%</div><div class="rr-kpi-label">Tasa Resolucion</div></div>'
            + '<div class="rr-kpi kpi-red"><div class="rr-kpi-value">' + costoFmt + '</div><div class="rr-kpi-label">Perdida Total</div></div>'
            + '<div class="rr-kpi kpi-purple"><div class="rr-kpi-value">' + promedioMensual + '</div><div class="rr-kpi-label">Promedio Mensual</div></div>';
    },

    renderCharts() {
        if (typeof Chart === 'undefined') { console.warn('Chart.js no disponible'); return; }
        Object.values(this.charts).forEach(c => c.destroy());
        this.charts = {};

        const d = this.reportData;
        const mesesCortos = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const labels = d.meses.map((m, i) => mesesCortos[i]);

        const defaults = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, datalabels: { display: false } }
        };

        this.charts.mes = new Chart(document.getElementById('rrChartMes'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    data: d.meses.map(m => m.total),
                    backgroundColor: d.meses.map((m, i) => {
                        const hoy = new Date();
                        return (i === hoy.getMonth() && this.anio === hoy.getFullYear()) ? '#f97316' : '#fed7aa';
                    }),
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                ...defaults,
                layout: { padding: { top: 30 } },
                scales: { y: { beginAtZero: true, suggestedMax: Math.max(...d.meses.map(m => m.total), 1) * 1.15, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }, x: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } } },
                plugins: { ...defaults.plugins, datalabels: { display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0, anchor: 'end', align: 'top', color: '#475569', font: { size: 11, weight: '700' } } }
            },
            plugins: [ChartDataLabels]
        });

        const estadoTotal = [
            d.meses.reduce((s, m) => s + m.pendientes, 0),
            d.meses.reduce((s, m) => s + m.en_revision, 0),
            d.meses.reduce((s, m) => s + m.en_proceso, 0),
            d.meses.reduce((s, m) => s + m.finalizados, 0)
        ];
        this.charts.estado = new Chart(document.getElementById('rrChartEstado'), {
            type: 'doughnut',
            data: {
                labels: ['Pendiente', 'En Revision', 'En Proceso', 'Finalizado'],
                datasets: [{ data: estadoTotal, backgroundColor: ['#f59e0b', '#3b82f6', '#8b5cf6', '#16a34a'], borderWidth: 2, borderColor: '#fff', hoverOffset: 8 }]
            },
            options: {
                ...defaults, cutout: '60%',
                plugins: {
                    ...defaults.plugins,
                    legend: { display: true, position: 'bottom', labels: { padding: 12, usePointStyle: true, pointStyleWidth: 8, font: { size: 10 } } },
                    datalabels: { display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0, color: '#fff', font: { size: 10, weight: '700' }, formatter: (v, ctx) => { const t = ctx.dataset.data.reduce((a,b)=>a+b,0); return t > 0 ? Math.round((v/t)*100)+'%' : ''; } }
                }
            },
            plugins: [ChartDataLabels]
        });

        const responsables = d.responsables.slice(0, 10);
        this.charts.responsable = new Chart(document.getElementById('rrChartResponsable'), {
            type: 'bar',
            data: {
                labels: responsables.map(r => r.nombre.length > 14 ? r.nombre.substring(0, 14) + '.' : r.nombre),
                datasets: [{ data: responsables.map(r => r.total), backgroundColor: ['#f97316','#f59e0b','#ef4444','#ec4899','#8b5cf6','#3b82f6','#06b6d4','#16a34a','#6366f1','#14b8a6'], borderRadius: 6, borderSkipped: false }]
            },
            options: {
                ...defaults, indexAxis: 'y',
                layout: { padding: { right: 30 } },
                scales: { x: { beginAtZero: true, suggestedMax: Math.max(...responsables.map(r => r.total), 1) * 1.2, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }, y: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } } },
                plugins: { ...defaults.plugins, datalabels: { display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0, anchor: 'end', align: 'right', color: '#475569', font: { size: 10, weight: '700' }, padding: { left: 4 } } }
            },
            plugins: [ChartDataLabels]
        });

        const motivos = d.motivos.slice(0, 8);
        this.charts.motivo = new Chart(document.getElementById('rrChartMotivo'), {
            type: 'bar',
            data: {
                labels: motivos.map(m => m.motivo.length > 18 ? m.motivo.substring(0, 18) + '.' : m.motivo),
                datasets: [{ data: motivos.map(m => m.total), backgroundColor: ['#dc2626','#f97316','#f59e0b','#eab308','#84cc16','#22c55e','#14b8a6','#06b6d4'], borderRadius: 6, borderSkipped: false }]
            },
            options: {
                ...defaults, indexAxis: 'y',
                layout: { padding: { right: 30 } },
                scales: { x: { beginAtZero: true, suggestedMax: Math.max(...motivos.map(m => m.total), 1) * 1.2, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }, y: { grid: { display: false }, ticks: { font: { size: 9, weight: '600' } } } },
                plugins: { ...defaults.plugins, datalabels: { display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0, anchor: 'end', align: 'right', color: '#475569', font: { size: 10, weight: '700' }, padding: { left: 4 } } }
            },
            plugins: [ChartDataLabels]
        });

        this.charts.tendencia = new Chart(document.getElementById('rrChartTendencia'), {
            type: 'line',
            data: {
                labels,
                datasets: [
                    { label: 'Total', data: d.meses.map(m => m.total), borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.1)', fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#f97316', pointBorderColor: '#fff', pointBorderWidth: 2 },
                    { label: 'Finalizados', data: d.meses.map(m => m.finalizados), borderColor: '#16a34a', backgroundColor: 'transparent', fill: false, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#16a34a', pointBorderColor: '#fff', pointBorderWidth: 2 }
                ]
            },
            options: {
                ...defaults,
                scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }, x: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } } },
                plugins: { ...defaults.plugins, legend: { display: true, position: 'bottom', labels: { padding: 12, usePointStyle: true, pointStyleWidth: 8, font: { size: 10 } } } }
            }
        });

        const resoluciones = d.resoluciones || [];
        this.charts.resolucion = new Chart(document.getElementById('rrChartResolucion'), {
            type: 'polarArea',
            data: {
                labels: resoluciones.map(r => r.resolucion),
                datasets: [{ data: resoluciones.map(r => r.total), backgroundColor: ['rgba(34,197,94,0.7)','rgba(59,130,246,0.7)','rgba(239,68,68,0.7)','rgba(245,158,11,0.7)','rgba(139,92,246,0.7)'], borderColor: ['#22c55e','#3b82f6','#ef4444','#f59e0b','#8b5cf6'], borderWidth: 2 }]
            },
            options: {
                ...defaults,
                scales: { r: { ticks: { display: false }, grid: { color: '#e2e8f0' } } },
                plugins: {
                    ...defaults.plugins,
                    legend: { display: true, position: 'bottom', labels: { padding: 10, usePointStyle: true, pointStyleWidth: 8, font: { size: 9 } } },
                    datalabels: { display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0, color: '#1e293b', font: { size: 11, weight: '700' }, formatter: (v) => v }
                }
            },
            plugins: [ChartDataLabels]
        });

        // Costo por mes
        this.charts.costo = new Chart(document.getElementById('rrChartCosto'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Costo ($)',
                    data: d.meses.map(m => m.costo || 0),
                    backgroundColor: d.meses.map((m, i) => {
                        const hoy = new Date();
                        return (i === hoy.getMonth() && this.anio === hoy.getFullYear()) ? '#dc2626' : '#fca5a5';
                    }),
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                ...defaults,
                layout: { padding: { top: 30 } },
                scales: {
                    y: { beginAtZero: true, suggestedMax: Math.max(...d.meses.map(m => m.costo || 0), 1) * 1.15, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 }, callback: (v) => v >= 1000000 ? (v/1000000).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(0)+'K' : v } },
                    x: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } }
                },
                plugins: {
                    ...defaults.plugins,
                    tooltip: { backgroundColor: '#1e293b', padding: 8, cornerRadius: 6, callbacks: { label: (ctx) => '$' + ctx.raw.toLocaleString('es-CL') } },
                    datalabels: { display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0, anchor: 'end', align: 'top', color: '#dc2626', font: { size: 10, weight: '700' }, formatter: (v) => v >= 1000000 ? (v/1000000).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(0)+'K' : '$'+v }
                }
            },
            plugins: [ChartDataLabels]
        });

        // Top clientes
        const clientes = d.clientes || [];
        this.charts.cliente = new Chart(document.getElementById('rrChartCliente'), {
            type: 'bar',
            data: {
                labels: clientes.map(c => c.cliente.length > 16 ? c.cliente.substring(0, 16) + '.' : c.cliente),
                datasets: [{ data: clientes.map(c => c.total), backgroundColor: ['#f97316','#f59e0b','#ef4444','#ec4899','#8b5cf6','#3b82f6','#06b6d4','#16a34a'], borderRadius: 6, borderSkipped: false }]
            },
            options: {
                ...defaults, indexAxis: 'y',
                layout: { padding: { right: 30 } },
                scales: { x: { beginAtZero: true, suggestedMax: Math.max(...clientes.map(c => c.total), 1) * 1.2, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }, y: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } } },
                plugins: { ...defaults.plugins, datalabels: { display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0, anchor: 'end', align: 'right', color: '#475569', font: { size: 10, weight: '700' }, padding: { left: 4 } } }
            },
            plugins: [ChartDataLabels]
        });

        // Costo por responsable
        const costoResp = d.costoPorResponsable || [];
        this.charts.costoResp = new Chart(document.getElementById('rrChartCostoResp'), {
            type: 'bar',
            data: {
                labels: costoResp.map(r => r.nombre.length > 14 ? r.nombre.substring(0, 14) + '.' : r.nombre),
                datasets: [{ data: costoResp.map(r => r.total), backgroundColor: ['#16a34a','#22c55e','#84cc16','#eab308','#f59e0b','#f97316','#ef4444','#dc2626'], borderRadius: 6, borderSkipped: false }]
            },
            options: {
                ...defaults, indexAxis: 'y',
                layout: { padding: { right: 30 } },
                scales: {
                    x: { beginAtZero: true, suggestedMax: Math.max(...costoResp.map(r => r.total), 1) * 1.2, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 }, callback: (v) => v >= 1000000 ? (v/1000000).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(0)+'K' : v } },
                    y: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } }
                },
                plugins: {
                    ...defaults.plugins,
                    tooltip: { backgroundColor: '#1e293b', padding: 8, cornerRadius: 6, callbacks: { label: (ctx) => '$' + ctx.raw.toLocaleString('es-CL') } },
                    datalabels: { display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0, anchor: 'end', align: 'right', color: '#475569', font: { size: 10, weight: '700' }, padding: { left: 4 }, formatter: (v) => v >= 1000000 ? (v/1000000).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(0)+'K' : '$'+v }
                }
            },
            plugins: [ChartDataLabels]
        });

        // Dias de semana
        const dias = d.diasSemana || [];
        this.charts.dia = new Chart(document.getElementById('rrChartDia'), {
            type: 'bar',
            data: {
                labels: dias.map(d => d.nombre),
                datasets: [{ data: dias.map(d => d.total), backgroundColor: ['#94a3b8','#3b82f6','#06b6d4','#8b5cf6','#f59e0b','#f97316','#ef4444'], borderRadius: 6, borderSkipped: false }]
            },
            options: {
                ...defaults,
                layout: { padding: { top: 30 } },
                scales: { y: { beginAtZero: true, suggestedMax: Math.max(...dias.map(d => d.total), 1) * 1.15, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }, x: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } } },
                plugins: { ...defaults.plugins, datalabels: { display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0, anchor: 'end', align: 'top', color: '#475569', font: { size: 11, weight: '700' } } }
            },
            plugins: [ChartDataLabels]
        });
    },

    renderTabla() {
        const d = this.reportData;
        const mesesCortos = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const badge = (v, color) => `<span class="rr-badge" style="background:${color}15;color:${color}">${v}</span>`;
        let rows = '';
        for (let i = 0; i < 12; i++) {
            const m = d.meses[i];
            if (m.total === 0) continue;
            const tasa = m.total > 0 ? Math.round((m.finalizados / m.total) * 100) : 0;
            rows += `<tr>
                <td style="font-weight:700">${mesesCortos[i]}</td>
                <td>${m.total}</td>
                <td>${badge(m.pendientes, '#f59e0b')}</td>
                <td>${badge(m.en_revision, '#3b82f6')}</td>
                <td>${badge(m.en_proceso, '#8b5cf6')}</td>
                <td>${badge(m.finalizados, '#16a34a')}</td>
                <td style="font-weight:600">${tasa}%</td>
            </tr>`;
        }
        if (!rows) rows = '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:24px">Sin datos para este anio</td></tr>';
        document.getElementById('rrTabla').innerHTML = '<table class="rr-table">'
            + '<thead><tr><th>Mes</th><th>Total</th><th>Pend.</th><th>Revision</th><th>Proceso</th><th>Finalizados</th><th>% Resuelta</th></tr></thead>'
            + '<tbody>' + rows + '</tbody></table>';
    },

    cambiarAnio(dir) {
        this.anio += dir;
        document.getElementById('rrAnioLabel').textContent = this.anio;
        this.loadData();
    }
});
