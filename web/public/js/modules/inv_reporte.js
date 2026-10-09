// ============================================================================
// Reporte de Inventario — lenguaje visual "hoja tecnica de vidrio" (inv-pro.css)
// COLOR = SIGNIFICADO: datos neutros; solo se colorea lo que exige una decision.
// ============================================================================
App.registerModule('inv_reporte', {
    reportData: null,
    charts: {},
    anio: new Date().getFullYear(),
    _chartTimer: null,

    async render() {
        const el = document.getElementById('page-inv_reporte');
        el.innerHTML = '<div class="inv-pro">'
            + '<style>'
            + '.ir-section{background:var(--invp-surface);border:1px solid var(--invp-line);border-radius:12px;padding:20px;margin-bottom:16px}'
            + '.ir-kpi-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px}'
            + '.ir-kpi{background:var(--invp-surface);border:1px solid var(--invp-line);border-radius:10px;padding:16px;text-align:center}'
            + '.ir-kpi-value{font-family:"IBM Plex Mono",ui-monospace,monospace;font-variant-numeric:tabular-nums;font-size:26px;font-weight:600;color:var(--invp-ink);line-height:1.1}'
            + '.ir-kpi-label{font-size:10px;font-weight:600;color:var(--invp-muted);text-transform:uppercase;letter-spacing:.8px;margin-top:4px}'
            + '.ir-chart-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}'
            + '.ir-chart-box{background:var(--invp-surface);border:1px solid var(--invp-line);border-radius:12px;padding:16px}'
            + '.ir-chart-title{font-size:13px;font-weight:600;color:var(--invp-ink);margin-bottom:12px;display:flex;align-items:center;gap:6px}'
            + '.ir-chart-title svg{width:16px;height:16px;flex-shrink:0}'
            + '.ir-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--invp-line);border-radius:8px;max-width:100%}'
            + '.inv-pro .invp-sutil{color:var(--invp-slate);font-weight:400}'
            + '@media(max-width:768px){.ir-chart-row{grid-template-columns:1fr;overflow-x:auto}.ir-kpi-row{grid-template-columns:repeat(2,1fr)}.ir-kpi-value{font-size:20px}.ir-chart-box{padding:8px;overflow:hidden}.ir-section{padding:10px}.ir-chart-row canvas{height:180px!important}'
            /* Detalle Mensual: scroll horizontal comodo en movil (tabla no se comprime) */
            + '.ir-table-wrap .invp-table{min-width:520px}}'
            + '</style>'

            + '<div class="invp-hero">'
            + '<div><h2>Reporte de Inventario</h2><p>Análisis mensual de movimientos de stock</p></div>'
            + '<div class="invp-hero-actions">'
            + '<button class="invp-btn" onclick="App.modules.inv_reporte.cambiarAnio(-1)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>'
            + '<span id="irAnioLabel" style="color:#fff;font-size:16px;font-weight:600;min-width:56px;text-align:center">' + this.anio + '</span>'
            + '<button class="invp-btn" onclick="App.modules.inv_reporte.cambiarAnio(1)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>'
            + '</div></div>'

            + '<div id="irKpis" class="ir-kpi-row"></div>'
            + '<div id="irAlertas" style="margin-bottom:16px"></div>'
            + '<div class="ir-chart-row">'
            + '<div class="ir-chart-box"><div class="ir-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg>Movimientos por Mes</div><div style="position:relative;height:280px"><canvas id="irChartMes"></canvas></div></div>'
            + '<div class="ir-chart-box"><div class="ir-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20" fill="#64748b" opacity="0.2"/></svg>Por Tipo de Cristal</div><div style="position:relative;height:280px;display:flex;justify-content:center"><canvas id="irChartTipo"></canvas></div></div>'
            + '</div>'
            + '<div class="ir-chart-row">'
            + '<div class="ir-chart-box"><div class="ir-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>M2 Entradas vs Salidas</div><div style="position:relative;height:280px"><canvas id="irChartM2"></canvas></div></div>'
            + '<div class="ir-chart-box"><div class="ir-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>Top Materiales (Salidas)</div><div style="position:relative;height:280px"><canvas id="irChartMaterial"></canvas></div></div>'
            + '</div>'
            + '<div class="ir-chart-row">'
            + '<div class="ir-chart-box"><div class="ir-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>Tendencia de Stock</div><div style="position:relative;height:280px"><canvas id="irChartTendencia"></canvas></div></div>'
            + '<div class="ir-chart-box"><div class="ir-chart-title"><svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>Top Dimensiones</div><div style="position:relative;height:280px"><canvas id="irChartDimension"></canvas></div></div>'
            + '</div>'
            + '<div class="ir-section"><div class="ir-chart-title" style="margin-bottom:12px"><svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" width="16" height="16"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/></svg>Detalle Mensual</div><div id="irTabla" class="ir-table-wrap"></div></div>'
            + '</div>';

        await this.loadData();
    },

    async loadData() {
        try {
            const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const res = await fetch(`/api/inv/reporte?anio=${this.anio}`, { headers });
            if (!res.ok) {
                // Un 401/403/500 NO debe pintarse como "Sin datos para este anio"
                const body = await res.json().catch(() => ({}));
                App.showAlert('Error al cargar el reporte: ' + (body.error || body.mensaje || ('HTTP ' + res.status)), 'danger');
                this.reportData = { meses: Array(12).fill(null).map(() => ({ total:0,entradas:0,salidas:0,m2_entradas:0,m2_salidas:0,planchas_entradas:0,planchas_salidas:0 })), topMateriales: [], topDimensiones: [], tipos: [], totalEntradas: 0, totalSalidas: 0, totalM2Entradas: 0, totalM2Salidas: 0 };
            }
            else { this.reportData = await res.json(); }
            this.renderKpis();
            this.renderAlertas();
            this.renderTabla();
            if (this._chartTimer) clearTimeout(this._chartTimer);
            this._chartTimer = setTimeout(() => this.renderCharts(), 100);
        } catch (e) {
            console.error('Error reporte inventario:', e);
            App.showAlert('Error al cargar el reporte: ' + e.message, 'danger');
        }
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

        // COLOR = SIGNIFICADO: KPIs neutros; solo la autonomia baja se colorea
        const autoVal = Number(d.autonomia) || 0;
        const autoCls = autoVal <= 1 ? 'invp-danger' : autoVal < 2 ? 'invp-warn' : '';

        document.getElementById('irKpis').innerHTML = ''
            + '<div class="ir-kpi"><div class="ir-kpi-value">' + (d.planchasMes || 0).toLocaleString('es-CL') + '</div><div class="ir-kpi-label">Planchas este mes</div>' + sparkSvg(d.sparklinePlanchas, '#1d4ed8') + '</div>'
            + '<div class="ir-kpi"><div class="ir-kpi-value">' + (d.stockPlanchas || 0).toLocaleString('es-CL') + ' <span class="invp-unidad">pl.</span></div><div class="ir-kpi-label">Stock planchas</div></div>'
            + '<div class="ir-kpi"><div class="ir-kpi-value">' + (d.kgStock || 0).toLocaleString('es-CL') + ' <span class="invp-unidad">kg</span></div><div class="ir-kpi-label">KG en stock</div>' + sparkSvg(d.sparklineKg, '#64748b') + '</div>'
            + '<div class="ir-kpi"><div class="ir-kpi-value ' + autoCls + '">' + (d.autonomia || 0) + ' <span class="invp-unidad">meses</span></div><div class="ir-kpi-label">Autonomía prom.</div></div>';
    },

    renderCharts() {
        if (typeof Chart === 'undefined') return;
        Object.values(this.charts).forEach(c => c.destroy());
        this.charts = {};

        const d = this.reportData;
        const mesesCortos = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const labels = d.meses.map((m, i) => mesesCortos[i]);
        const defaults = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { display: false } } };
        // Paleta unificada del sistema (azules/slate): el rojo/ámbar SOLO para datos de alerta
        const pal = ['#1d4ed8', '#3b82f6', '#60a5fa', '#93c5fd', '#94a3b8', '#cbd5e1', '#64748b', '#1e3a8a'];

        const maxSalidas = Math.max(...d.meses.map(m => m.salidas), 1);
        const maxM2 = Math.max(...d.meses.map(m => Math.max(m.m2_entradas, m.m2_salidas)), 1);

        this.charts.mes = new Chart(document.getElementById('irChartMes'), {
            type: 'bar',
            data: { labels, datasets: [
                { label: 'Planchas Consumidas', data: d.meses.map(m => m.salidas), backgroundColor: '#1d4ed8', borderRadius: 6, borderSkipped: false }
            ] },
            options: { ...defaults, layout: { padding: { top: 30 } }, scales: { y: { beginAtZero: true, suggestedMax: maxSalidas * 1.15, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }, x: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } } }, plugins: { ...defaults.plugins, legend: { display: false }, datalabels: { display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0, anchor: 'end', align: 'top', offset: 6, color: '#0f172a', font: { size: 13, weight: '800' } } } },
            plugins: [ChartDataLabels]
        });

        const tipoTotal = d.tipos || [];
        this.charts.tipo = new Chart(document.getElementById('irChartTipo'), {
            type: 'doughnut',
            data: { labels: tipoTotal.map(t => t.nombre), datasets: [{ data: tipoTotal.map(t => t.total), backgroundColor: pal, borderWidth: 2, borderColor: '#fff', hoverOffset: 8 }] },
            options: { ...defaults, cutout: '60%', plugins: { ...defaults.plugins, legend: { display: true, position: 'bottom', labels: { padding: 10, usePointStyle: true, pointStyleWidth: 8, font: { size: 9 } } }, datalabels: { display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0, color: '#fff', font: { size: 10, weight: '700' }, formatter: (v, ctx) => { const t = ctx.dataset.data.reduce((a,b)=>a+b,0); return t > 0 ? Math.round((v/t)*100)+'%' : ''; } } } },
            plugins: [ChartDataLabels]
        });

        this.charts.m2 = new Chart(document.getElementById('irChartM2'), {
            type: 'bar',
            data: { labels, datasets: [
                { label: 'M2 Entradas', data: d.meses.map(m => Math.round(m.m2_entradas)), backgroundColor: '#1d4ed8', borderRadius: 6, borderSkipped: false },
                { label: 'M2 Salidas', data: d.meses.map(m => Math.round(m.m2_salidas)), backgroundColor: '#94a3b8', borderRadius: 6, borderSkipped: false }
            ] },
            options: { ...defaults, layout: { padding: { top: 30 } }, scales: { y: { beginAtZero: true, suggestedMax: maxM2 * 1.15, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }, x: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } } }, plugins: { ...defaults.plugins, legend: { display: true, position: 'bottom', labels: { padding: 12, usePointStyle: true, pointStyleWidth: 8, font: { size: 10 } } }, datalabels: { display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0, anchor: 'end', align: 'top', offset: 6, color: '#0f172a', font: { size: 11, weight: '700' } } } },
            plugins: [ChartDataLabels]
        });

        const materiales = (d.topMateriales || []).slice(0, 8);
        this.charts.material = new Chart(document.getElementById('irChartMaterial'), {
            type: 'bar',
            data: { labels: materiales.map(m => m.nombre.length > 14 ? m.nombre.substring(0,14)+'.' : m.nombre), datasets: [{ data: materiales.map(m => m.total), backgroundColor: pal, borderRadius: 6, borderSkipped: false }] },
            options: { ...defaults, indexAxis: 'y', layout: { padding: { right: 30 } }, scales: { x: { beginAtZero: true, suggestedMax: Math.max(...materiales.map(m => m.total), 1) * 1.2, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }, y: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } } }, plugins: { ...defaults.plugins, datalabels: { display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0, anchor: 'end', align: 'right', color: '#475569', font: { size: 10, weight: '700' }, padding: { left: 4 } } } },
            plugins: [ChartDataLabels]
        });

        this.charts.tendencia = new Chart(document.getElementById('irChartTendencia'), {
            type: 'line',
            data: { labels, datasets: [
                { label: 'Stock Neto M2', data: d.meses.map(m => Math.round(m.m2_entradas - m.m2_salidas)), borderColor: '#1d4ed8', backgroundColor: 'rgba(29,78,216,0.10)', fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#1d4ed8', pointBorderColor: '#fff', pointBorderWidth: 2 },
                { label: 'Entradas M2', data: d.meses.map(m => Math.round(m.m2_entradas)), borderColor: '#94a3b8', backgroundColor: 'transparent', fill: false, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#94a3b8', pointBorderColor: '#fff', pointBorderWidth: 2 }
            ] },
            options: { ...defaults, scales: { y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }, x: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } } }, plugins: { ...defaults.plugins, legend: { display: true, position: 'bottom', labels: { padding: 12, usePointStyle: true, pointStyleWidth: 8, font: { size: 10 } } } } }
        });

        const dims = (d.topDimensiones || []).slice(0, 8);
        this.charts.dimension = new Chart(document.getElementById('irChartDimension'), {
            type: 'bar',
            data: { labels: dims.map(r => r.dimension), datasets: [{ data: dims.map(r => r.salidas), backgroundColor: pal, borderRadius: 6, borderSkipped: false }] },
            options: { ...defaults, layout: { padding: { top: 30 } }, scales: { y: { beginAtZero: true, suggestedMax: Math.max(...dims.map(r => r.salidas), 1) * 1.15, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }, x: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } } }, plugins: { ...defaults.plugins, datalabels: { display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0, anchor: 'end', align: 'top', color: '#475569', font: { size: 11, weight: '700' } } } },
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
        // Chips del sistema: el color acompaña al texto (accesible), no lo sustituye
        const colores = { critico: { cls: 'critico', label: 'Stock crítico' },
            medio: { cls: 'bajo', label: 'Stock medio' },
            ok: { cls: 'ok', label: 'Stock ok' } };
        let html = '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">';
        alertas.forEach(a => {
            const c = colores[a.nivel] || colores.ok;
            html += '<div style="display:flex;align-items:center;gap:6px">'
                + '<span class="invp-chip ' + c.cls + '"><span class="dot"></span>' + c.label + '</span>'
                + '<span class="invp-sutil">' + escText(a.nombre) + ' ' + escText(a.espesor) + ' mm — ' + (a.autonomia || 0) + ' meses de autonomía</span></div>';
        });
        html += '</div>';
        document.getElementById('irAlertas').innerHTML = html;
    },

    renderTabla() {
        const d = this.reportData;
        const mesesCortos = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        let rows = '';
        for (let i = 0; i < 12; i++) {
            const m = d.meses[i];
            if (m.total === 0) continue;
            const neto = Math.round(m.m2_entradas - m.m2_salidas);
            rows += `<tr>
                <td class="valor">${mesesCortos[i]}</td>
                <td class="num invp-mono sutil">${escText(m.entradas)}</td>
                <td class="num invp-mono sutil">${escText(m.salidas)}</td>
                <td class="num invp-mono sutil">${Math.round(m.m2_entradas).toLocaleString('es-CL')}</td>
                <td class="num invp-mono sutil">${Math.round(m.m2_salidas).toLocaleString('es-CL')}</td>
                <td class="num invp-mono valor">${neto >= 0 ? '+' : ''}${neto.toLocaleString('es-CL')}</td>
            </tr>`;
        }
        if (!rows) rows = '<tr><td colspan="6" class="sutil" style="text-align:center;padding:24px">Sin datos para este año</td></tr>';
        document.getElementById('irTabla').innerHTML = '<table class="invp-table">'
            + '<thead><tr><th>Mes</th><th class="num">Entradas</th><th class="num">Salidas</th><th class="num">M² entrada</th><th class="num">M² salida</th><th class="num">Neto M2</th></tr></thead>'
            + '<tbody>' + rows + '</tbody></table>';
    },

    cambiarAnio(dir) {
        this.anio += dir;
        document.getElementById('irAnioLabel').textContent = this.anio;
        this.loadData();
    }
});
