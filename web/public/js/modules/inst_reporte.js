App.registerModule('inst_reporte', {
    reportData: null,
    charts: {},
    anio: new Date().getFullYear(),

    async render() {
        const el = document.getElementById('page-inst-reporte');
        el.innerHTML = '<style>'
            + '.rep-section{background:white;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.04)}'
            + '.rep-kpi-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px}'
            + '.rep-kpi{background:linear-gradient(135deg,#f8fafc,#f1f5f9);border:1px solid #e2e8f0;border-radius:10px;padding:16px;text-align:center;position:relative;overflow:hidden}'
            + '.rep-kpi::before{content:"";position:absolute;top:0;left:0;width:4px;height:100%;border-radius:4px 0 0 4px}'
            + '.rep-kpi.kpi-blue::before{background:#3b82f6}'
            + '.rep-kpi.kpi-green::before{background:#16a34a}'
            + '.rep-kpi.kpi-amber::before{background:#f59e0b}'
            + '.rep-kpi.kpi-red::before{background:#dc2626}'
            + '.rep-kpi.kpi-purple::before{background:#8b5cf6}'
            + '.rep-kpi-value{font-size:28px;font-weight:800;color:#1e293b;line-height:1.1}'
            + '.rep-kpi-label{font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px}'
            + '.rep-chart-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}'
            + '.rep-chart-box{background:white;border:1px solid #e2e8f0;border-radius:12px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.04)}'
            + '.rep-chart-title{font-size:13px;font-weight:700;color:#1e293b;margin-bottom:12px;display:flex;align-items:center;gap:6px}'
            + '.rep-chart-title svg{width:16px;height:16px;flex-shrink:0}'
            + '.rep-table-wrap{overflow-x:auto;border:1px solid #e2e8f0;border-radius:8px}'
            + '.rep-table{width:100%;border-collapse:collapse;font-size:12px}'
            + '.rep-table th{background:#f8fafc;padding:10px 12px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0}'
            + '.rep-table td{padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155}'
            + '.rep-table tr:hover td{background:#f8fafc}'
            + '.rep-badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600}'
            + '@media(max-width:768px){.rep-chart-row{grid-template-columns:1fr}.rep-kpi-row{grid-template-columns:repeat(2,1fr)}.rep-kpi-value{font-size:22px}}'
            + '</style>'

            + '<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:20px;margin-bottom:20px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">'
            + '<div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">'
            + '<div><h2 style="margin:0;font-size:18px;font-weight:800;color:white;letter-spacing:-0.5px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-4px;margin-right:8px"><path d="M21 12a9 9 0 1 1-6.219-8.56"/><path d="M21 3v5h-5"/></svg>Reporte de Instalaciones</h2>'
            + '<p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.7)">Analisis mensual de trabajos en terreno</p></div>'
            + '<div style="display:flex;gap:6px;align-items:center">'
            + '<button class="btn btn-outline" style="color:white;border-color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.1)" onclick="App.modules.inst_reporte.cambiarAnio(-1)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>'
            + '<span id="repAnioLabel" style="color:white;font-size:16px;font-weight:700;min-width:60px;text-align:center">' + this.anio + '</span>'
            + '<button class="btn btn-outline" style="color:white;border-color:rgba(255,255,255,0.3);background:rgba(255,255,256,0.1)" onclick="App.modules.inst_reporte.cambiarAnio(1)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>'
            + '</div></div></div>'

            + '<div id="repKpis" class="rep-kpi-row"></div>'
            + '<div class="rep-chart-row">'
            + '<div class="rep-chart-box"><div class="rep-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/></svg>Instalaciones por Mes</div><div style="position:relative;height:280px"><canvas id="repChartMes"></canvas></div></div>'
            + '<div class="rep-chart-box"><div class="rep-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20" fill="#8b5cf6" opacity="0.2"/></svg>Por Estado</div><div style="position:relative;height:280px;display:flex;justify-content:center"><canvas id="repChartEstado"></canvas></div></div>'
            + '</div>'
            + '<div class="rep-chart-row">'
            + '<div class="rep-chart-box"><div class="rep-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>Por Tecnico</div><div style="position:relative;height:280px"><canvas id="repChartTecnico"></canvas></div></div>'
            + '<div class="rep-chart-box"><div class="rep-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Por Vendedor</div><div style="position:relative;height:280px"><canvas id="repChartVendedor"></canvas></div></div>'
            + '</div>'
            + '<div class="rep-chart-row">'
            + '<div class="rep-chart-box"><div class="rep-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>Por Tipo de Servicio</div><div style="position:relative;height:280px;display:flex;justify-content:center"><canvas id="repChartTipo"></canvas></div></div>'
            + '<div class="rep-chart-box"><div class="rep-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>Tendencia Mensual</div><div style="position:relative;height:280px"><canvas id="repChartTendencia"></canvas></div></div>'
            + '</div>'
            + '<div class="rep-section"><div class="rep-chart-title" style="margin-bottom:12px"><svg viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="2" width="16" height="16"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/></svg>Detalle Mensual</div><div id="repTabla" class="rep-table-wrap"></div></div>';

        await this.loadData();
    },

    async loadData() {
        try {
            const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const res = await fetch(`/api/instalaciones/reporte?anio=${this.anio}`, { headers });
            this.reportData = await res.json();
            this.renderKpis();
            this.renderCharts();
            this.renderTabla();
        } catch (e) { console.error('Error reporte:', e); }
    },

    renderKpis() {
        const d = this.reportData;
        const completadas = d.meses.reduce((s, m) => s + m.completadas, 0);
        const total = d.totalGeneral;
        const tasaExito = total > 0 ? Math.round((completadas / total) * 100) : 0;
        const mesesConActividad = d.meses.filter(m => m.total > 0).length;
        const promedioMensual = mesesConActividad > 0 ? Math.round(total / mesesConActividad) : 0;

        document.getElementById('repKpis').innerHTML = ''
            + '<div class="rep-kpi kpi-blue"><div class="rep-kpi-value">' + total + '</div><div class="rep-kpi-label">Total ' + this.anio + '</div></div>'
            + '<div class="rep-kpi kpi-green"><div class="rep-kpi-value">' + completadas + '</div><div class="rep-kpi-label">Completadas</div></div>'
            + '<div class="rep-kpi kpi-amber"><div class="rep-kpi-value">' + tasaExito + '%</div><div class="rep-kpi-label">Tasa de Exito</div></div>'
            + '<div class="rep-kpi kpi-purple"><div class="rep-kpi-value">' + promedioMensual + '</div><div class="rep-kpi-label">Promedio Mensual</div></div>'
            + '<div class="rep-kpi kpi-red"><div class="rep-kpi-value">' + d.meses.reduce((s, m) => s + m.novedades, 0) + '</div><div class="rep-kpi-label">Con Novedades</div></div>';
    },

    renderCharts() {
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

        this.charts.mes = new Chart(document.getElementById('repChartMes'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    data: d.meses.map(m => m.total),
                    backgroundColor: d.meses.map((m, i) => {
                        const hoy = new Date();
                        return (i === hoy.getMonth() && this.anio === hoy.getFullYear())
                            ? '#3b82f6' : '#93c5fd';
                    }),
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                ...defaults,
                scales: {
                    y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
                    x: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } }
                },
                plugins: {
                    ...defaults.plugins,
                    tooltip: { backgroundColor: '#1e293b', titleFont: { size: 11 }, bodyFont: { size: 11 }, padding: 8, cornerRadius: 6 },
                    datalabels: {
                        display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0,
                        anchor: 'end', align: 'top', color: '#475569',
                        font: { size: 11, weight: '700' }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });

        const estadoTotal = [
            d.meses.reduce((s, m) => s + m.programadas, 0),
            d.meses.reduce((s, m) => s + m.en_curso, 0),
            d.meses.reduce((s, m) => s + m.completadas, 0),
            d.meses.reduce((s, m) => s + m.novedades, 0),
            d.meses.reduce((s, m) => s + m.canceladas, 0)
        ];
        this.charts.estado = new Chart(document.getElementById('repChartEstado'), {
            type: 'doughnut',
            data: {
                labels: ['Programadas', 'En Curso', 'Completadas', 'Novedades', 'Canceladas'],
                datasets: [{
                    data: estadoTotal,
                    backgroundColor: ['#3b82f6', '#f59e0b', '#16a34a', '#dc2626', '#94a3b8'],
                    borderWidth: 2,
                    borderColor: '#fff',
                    hoverOffset: 8
                }]
            },
            options: {
                ...defaults,
                cutout: '60%',
                plugins: {
                    ...defaults.plugins,
                    legend: { display: true, position: 'bottom', labels: { padding: 12, usePointStyle: true, pointStyleWidth: 8, font: { size: 10 } } },
                    tooltip: { backgroundColor: '#1e293b', padding: 8, cornerRadius: 6 },
                    datalabels: {
                        display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0,
                        color: '#fff', font: { size: 10, weight: '700' },
                        formatter: (v, ctx) => {
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            return total > 0 ? Math.round((v / total) * 100) + '%' : '';
                        }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });

        const tecnicos = d.tecnicos.slice(0, 10);
        this.charts.tecnico = new Chart(document.getElementById('repChartTecnico'), {
            type: 'bar',
            data: {
                labels: tecnicos.map(t => t.nombre.length > 12 ? t.nombre.substring(0, 12) + '.' : t.nombre),
                datasets: [{
                    data: tecnicos.map(t => t.total),
                    backgroundColor: ['#3b82f6', '#8b5cf6', '#06b6d4', '#16a34a', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#f97316'],
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                ...defaults, indexAxis: 'y',
                scales: {
                    x: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
                    y: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } }
                },
                plugins: {
                    ...defaults.plugins,
                    datalabels: {
                        display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0,
                        anchor: 'end', align: 'right', color: '#475569',
                        font: { size: 10, weight: '700' }, padding: { left: 4 }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });

        const vendedores = d.vendedores.slice(0, 10);
        this.charts.vendedor = new Chart(document.getElementById('repChartVendedor'), {
            type: 'bar',
            data: {
                labels: vendedores.map(v => v.nombre.length > 12 ? v.nombre.substring(0, 12) + '.' : v.nombre),
                datasets: [{
                    data: vendedores.map(v => v.total),
                    backgroundColor: ['#f59e0b', '#f97316', '#ef4444', '#ec4899', '#8b5cf6', '#3b82f6', '#06b6d4', '#16a34a', '#6366f1', '#14b8a6'],
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                ...defaults, indexAxis: 'y',
                scales: {
                    x: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
                    y: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } }
                },
                plugins: {
                    ...defaults.plugins,
                    datalabels: {
                        display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0,
                        anchor: 'end', align: 'right', color: '#475569',
                        font: { size: 10, weight: '700' }, padding: { left: 4 }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });

        this.charts.tipo = new Chart(document.getElementById('repChartTipo'), {
            type: 'polarArea',
            data: {
                labels: ['Instalacion', 'Visita Tecnica', 'Post-Venta'],
                datasets: [{
                    data: [d.tipos.tipo_instalacion, d.tipos.tipo_visita, d.tipos.tipo_postventa],
                    backgroundColor: ['rgba(59,130,246,0.7)', 'rgba(139,92,246,0.7)', 'rgba(245,158,11,0.7)'],
                    borderColor: ['#3b82f6', '#8b5cf6', '#f59e0b'],
                    borderWidth: 2
                }]
            },
            options: {
                ...defaults,
                scales: { r: { ticks: { display: false }, grid: { color: '#e2e8f0' } } },
                plugins: {
                    ...defaults.plugins,
                    legend: { display: true, position: 'bottom', labels: { padding: 12, usePointStyle: true, pointStyleWidth: 8, font: { size: 10 } } },
                    datalabels: {
                        display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0,
                        color: '#1e293b', font: { size: 11, weight: '700' },
                        formatter: (v) => v
                    }
                }
            },
            plugins: [ChartDataLabels]
        });

        const tendenciaData = d.meses.map(m => m.completadas);
        const avgLine = tendenciaData.length > 0 ? tendenciaData.reduce((a, b) => a + b, 0) / tendenciaData.filter(v => v > 0).length : 0;
        this.charts.tendencia = new Chart(document.getElementById('repChartTendencia'), {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Completadas',
                        data: tendenciaData,
                        borderColor: '#16a34a',
                        backgroundColor: 'rgba(22,163,74,0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointBackgroundColor: '#16a34a',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2
                    },
                    {
                        label: 'Promedio',
                        data: Array(12).fill(Math.round(avgLine)),
                        borderColor: '#94a3b8',
                        borderDash: [6, 4],
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: {
                ...defaults,
                scales: {
                    y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
                    x: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } }
                },
                plugins: {
                    ...defaults.plugins,
                    legend: { display: true, position: 'bottom', labels: { padding: 12, usePointStyle: true, pointStyleWidth: 8, font: { size: 10 } } },
                    tooltip: { backgroundColor: '#1e293b', padding: 8, cornerRadius: 6 }
                }
            }
        });
    },

    renderTabla() {
        const d = this.reportData;
        const mesesCortos = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const badge = (v, color) => `<span class="rep-badge" style="background:${color}15;color:${color}">${v}</span>`;

        let rows = '';
        for (let i = 0; i < 12; i++) {
            const m = d.meses[i];
            if (m.total === 0) continue;
            const tasa = m.total > 0 ? Math.round((m.completadas / m.total) * 100) : 0;
            rows += `<tr>
                <td style="font-weight:700">${mesesCortos[i]}</td>
                <td>${m.total}</td>
                <td>${badge(m.programadas, '#3b82f6')}</td>
                <td>${badge(m.en_curso, '#f59e0b')}</td>
                <td>${badge(m.completadas, '#16a34a')}</td>
                <td>${badge(m.novedades, '#dc2626')}</td>
                <td>${badge(m.canceladas, '#94a3b8')}</td>
                <td style="font-weight:600">${tasa}%</td>
            </tr>`;
        }
        if (!rows) rows = '<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:24px">Sin datos para este anio</td></tr>';

        document.getElementById('repTabla').innerHTML = '<table class="rep-table">'
            + '<thead><tr><th>Mes</th><th>Total</th><th>Prog.</th><th>En Curso</th><th>Comp.</th><th>Novedades</th><th>Cancel.</th><th>% Exito</th></tr></thead>'
            + '<tbody>' + rows + '</tbody></table>';
    },

    cambiarAnio(dir) {
        this.anio += dir;
        document.getElementById('repAnioLabel').textContent = this.anio;
        this.loadData();
    }
});
