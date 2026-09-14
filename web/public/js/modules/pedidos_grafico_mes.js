App.registerModule('pedidos_grafico_mes', {
    chart: null,
    allPedidos: [],
    mes: new Date().getMonth(),
    anio: new Date().getFullYear(),

    async render() {
        const el = document.getElementById('page-pedidos_grafico_mes');
        const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        el.innerHTML = '<style>'
            + '.pgm-chart-box{background:white;border:1px solid #e2e8f0;border-radius:12px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.04)}'
            + '</style>'

            + '<div style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 50%,#3b82f6 100%);border-radius:16px;padding:20px;margin-bottom:20px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(30,58,95,0.3)">'
            + '<div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">'
            + '<div><h2 style="margin:0;font-size:18px;font-weight:800;color:white;letter-spacing:-0.5px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-4px;margin-right:8px"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>Grafico por Dia</h2>'
            + '<p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.7)">Ingresos diarios por tipo de OV</p></div>'
            + '<div style="display:flex;gap:6px;align-items:center">'
            + '<button class="btn btn-outline" style="color:white;border-color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.1)" onclick="App.modules.pedidos_grafico_mes.cambiarMes(-1)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>'
            + '<span id="pgmLabel" style="color:white;font-size:14px;font-weight:700;min-width:140px;text-align:center">' + monthNames[this.mes] + ' ' + this.anio + '</span>'
            + '<button class="btn btn-outline" style="color:white;border-color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.1)" onclick="App.modules.pedidos_grafico_mes.cambiarMes(1)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>'
            + '</div></div></div>'

            + '<div class="pgm-chart-box"><div style="position:relative;height:400px"><canvas id="pgmChart"></canvas></div></div>';

        await this.loadData();
    },

    async loadData() {
        try {
            const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const firstDay = this.anio + '-' + String(this.mes + 1).padStart(2, '0') + '-01';
            const lastDay = new Date(this.anio, this.mes + 1, 0);
            const lastStr = this.anio + '-' + String(this.mes + 1).padStart(2, '0') + '-' + String(lastDay.getDate()).padStart(2, '0');
            const res = await fetch(`/api/pedidos?inicio=${firstDay}&fin=${lastStr}`, { headers });
            const data = await res.json();
            this.allPedidos = Array.isArray(data) ? data : [];
            this.renderChart();
        } catch (e) { console.error('Error grafico mes:', e); }
    },

    renderChart() {
        if (typeof Chart === 'undefined') return;
        if (this.chart) this.chart.destroy();

        const diasEnMes = new Date(this.anio, this.mes + 1, 0).getDate();
        const colores = { Normal: '#3b82f6', Express: '#fde047', 'Vta. Region': '#9333ea', Reposicion: '#dc2626', Urgencia: '#f97316' };
        const tipos = ['Normal', 'Express', 'Vta. Region', 'Reposicion', 'Urgencia'];

        const pedidosMes = this.allPedidos.filter(p => {
            const f = new Date(p.fecha_subida);
            return f.getMonth() === this.mes && f.getFullYear() === this.anio && p.estado !== 'rechazado';
        });

        const labels = [];
        for (let d = 1; d <= diasEnMes; d++) labels.push(String(d));

        const datasets = tipos.map(tipo => ({
            label: tipo,
            data: labels.map((_, i) => {
                const dia = i + 1;
                return pedidosMes.filter(p => new Date(p.fecha_subida).getDate() === dia && (p.tipo_ov || 'Normal') === tipo).length;
            }),
            backgroundColor: colores[tipo],
            borderRadius: 2,
            borderSkipped: false
        }));

        const totalPlugin = {
            id: 'totalOnTop',
            afterDatasetsDraw(chart) {
                const { ctx } = chart;
                const meta = chart.getDatasetMeta(chart.data.datasets.length - 1);
                ctx.save();
                ctx.font = 'bold 11px Inter, sans-serif';
                ctx.fillStyle = '#0f172a';
                ctx.textAlign = 'center';
                meta.data.forEach((bar, i) => {
                    let total = 0;
                    chart.data.datasets.forEach(ds => { total += ds.data[i]; });
                    if (total > 0) {
                        ctx.fillText(total, bar.x, bar.y - 6);
                    }
                });
                ctx.restore();
            }
        };

        this.chart = new Chart(document.getElementById('pgmChart'), {
            type: 'bar',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } },
                    y: { stacked: true, beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }
                },
                plugins: {
                    legend: { display: true, position: 'top', labels: { padding: 16, usePointStyle: true, pointStyleWidth: 10, font: { size: 11 } } },
                    tooltip: { backgroundColor: '#1e293b', padding: 10, cornerRadius: 8, titleFont: { size: 12 }, bodyFont: { size: 11 } },
                    datalabels: { display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0, color: '#fff', font: { size: 9, weight: '700' }, textShadowColor: 'rgba(0,0,0,0.3)', textShadowBlur: 2, formatter: (v) => v }
                }
            },
            plugins: [ChartDataLabels, totalPlugin]
        });
    },

    cambiarMes(dir) {
        this.mes += dir;
        if (this.mes > 11) { this.mes = 0; this.anio++; }
        if (this.mes < 0) { this.mes = 11; this.anio--; }
        const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        document.getElementById('pgmLabel').textContent = monthNames[this.mes] + ' ' + this.anio;
        this.loadData();
    }
});
