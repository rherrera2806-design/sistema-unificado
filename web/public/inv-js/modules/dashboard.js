const InvDashboard = {
    selectedMes: null,

    fmtKg(v) { return Math.round(v || 0).toLocaleString('es-CL'); },
    fmtNum(v) { return Math.round(v || 0).toLocaleString('es-CL'); },

    sparkline(data, color, w, h) {
        if (!data || data.length < 2) return '';
        const max = Math.max(...data, 1);
        const min = Math.min(...data, 0);
        const range = max - min || 1;
        const step = w / (data.length - 1);
        const points = data.map((v, i) => {
            const x = i * step;
            const y = h - ((v - min) / range) * (h - 4) - 2;
            return x.toFixed(1) + ',' + y.toFixed(1);
        }).join(' ');
        const areaPoints = '0,' + h + ' ' + points + ' ' + w + ',' + h;
        return `<svg width="${w}" height="${h}" style="display:block;margin-top:6px">
            <polygon points="${areaPoints}" fill="${color}" opacity="0.15"/>
            <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="${(data.length-1)*step}" cy="${h - ((data[data.length-1]-min)/range)*(h-4) - 2}" r="3" fill="${color}"/>
        </svg>`;
    },

    kpiCard(label, value, suffix, sparkHtml, trendPct, trendColor, delay) {
        const trendHtml = trendPct !== null
            ? `<div style="font-size:11px;font-weight:600;margin-top:4px;color:${trendColor}">${trendPct > 0 ? '↑' : trendPct < 0 ? '↓' : '→'} ${Math.abs(trendPct)}% vs mes ant.</div>`
            : '';
        return `<div style="flex:1;min-width:180px;background:white;border-radius:12px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.06);border:1px solid var(--gray-200);animation:kpiUp 0.5s ease ${delay}ms both">
            <div style="font-size:11px;font-weight:600;color:var(--gray-500);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">${label}</div>
            <div style="font-size:32px;font-weight:800;color:var(--gray-900);line-height:1">${value}<span style="font-size:14px;font-weight:600;color:var(--gray-400);margin-left:4px">${suffix}</span></div>
            ${trendHtml}
            ${sparkHtml}
        </div>`;
    },

    async render() {
        const page = document.querySelector('.page.active');
        page.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray-400)">Cargando dashboard...</div>';
        try {
            const hdrs = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const analytics = await fetch('/api/inv/analytics?meses=6', { headers: hdrs }).then(r => r.json()).catch(() => ({}));
            const a = analytics || {};
            window._invDashRanking = a.rankingSalida || [];
            window._invDashPlanchasMes = a.planchasPorMes || [];
            window._invDashStock = a.stockActual || [];
            window._invDashHdrs = hdrs;
            this.selectedMes = null;
            this._renderContent(page);
        } catch(err) { page.innerHTML = '<div class="alert alert-danger">Error: ' + err.message + '</div>'; }
    },

    _renderContent(page) {
        const ranking = window._invDashRanking || [];
        const planchasMes = window._invDashPlanchasMes || [];
        const stock = window._invDashStock || [];
        const monthNames = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const sel = this.selectedMes;

        // ── KPI Calculations ──
        const sorted = [...planchasMes].sort((a,b) => a.mes.localeCompare(b.mes));
        const planchasArr = sorted.map(p => Number(p.total_planchas) || 0);
        const m2Arr = sorted.map(p => Number(p.total_m2) || 0);
        const kgArr = sorted.map(p => Number(p.total_kg) || 0);
        const lastP = planchasArr[planchasArr.length - 1] || 0;
        const prevP = planchasArr[planchasArr.length - 2] || 0;
        const lastM2 = m2Arr[m2Arr.length - 1] || 0;
        const prevM2 = m2Arr[m2Arr.length - 2] || 0;
        const pctP = prevP > 0 ? Math.round(((lastP - prevP) / prevP) * 100) : null;
        const pctM2 = prevM2 > 0 ? Math.round(((lastM2 - prevM2) / prevM2) * 100) : null;

        const totalKgStock = stock.reduce((s, r) => s + (Number(r.kg_stock) || 0), 0);
        const stockWithAuto = stock.filter(r => r.autonomia_meses > 0);
        const avgAuto = stockWithAuto.length > 0
            ? (stockWithAuto.reduce((s, r) => s + r.autonomia_meses, 0) / stockWithAuto.length).toFixed(1)
            : 0;
        const autoColor = avgAuto >= 4 ? 'var(--success)' : avgAuto >= 2 ? 'var(--warning)' : 'var(--danger)';

        const sparkP = this.sparkline(planchasArr, 'var(--primary)', 120, 32);
        const sparkKg = this.sparkline(kgArr, '#8b5cf6', 120, 32);
        const sparkM2 = this.sparkline(m2Arr, '#f59e0b', 120, 32);

        let rankingFiltrado = ranking;
        let rankingTitle = 'Ranking MP + Salida (6 meses)';
        if (sel) {
            const parts = sel.split('-');
            rankingTitle = 'Ranking MP + Salida (' + monthNames[parseInt(parts[1])] + ' ' + parts[0] + ')';
        }

        page.innerHTML = `
                <div style="width:100%">
                <style>
                    @keyframes kpiUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
                </style>

                <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#334155 100%);border-radius:16px;padding:28px;margin-bottom:20px;color:white">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
                        <div>
                            <h2 style="margin:0;font-size:20px;font-weight:800;letter-spacing:-0.02em">Dashboard Inventario</h2>
                            <p style="margin:4px 0 0;font-size:12px;opacity:0.5">Analisis de materia prima — Ultimos 6 meses</p>
                        </div>
                        ${sel ? '<button onclick="InvDashboard.clearFilter()" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:white;padding:6px 14px;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;backdrop-filter:blur(4px)">✕ Limpiar filtro</button>' : ''}
                    </div>
                    <div style="display:flex;gap:16px;flex-wrap:wrap">
                        ${this.kpiCard('Planchas este mes', this.fmtNum(lastP), '', sparkP, pctP, pctP >= 0 ? '#4ade80' : '#f87171', 0)}
                        ${this.kpiCard('Kg en stock', this.fmtKg(totalKgStock), 'kg', sparkKg, null, '', 80)}
                        ${this.kpiCard('Autonomia prom.', avgAuto, 'meses', '', null, '', 160)}
                        ${this.kpiCard('m² consumidos', this.fmtNum(lastM2), 'm²', sparkM2, pctM2, pctM2 >= 0 ? '#4ade80' : '#f87171', 240)}
                    </div>
                </div>

                <div class="card" style="margin-bottom:16px;overflow:hidden">
                    <div style="padding:14px 18px;background:var(--gray-50);border-bottom:1px solid var(--gray-200);font-size:13px;font-weight:700;color:var(--gray-800)">Planchas Cortadas por Mes <span style="font-weight:400;font-size:11px;color:var(--gray-400)">(clic para filtrar ranking)</span></div>
                    <div style="padding:16px;overflow-x:auto">
                        ${planchasMes.length === 0 ? '<div style="text-align:center;padding:20px;color:var(--gray-400);font-size:12px">Sin datos</div>' :
                        '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="border-bottom:2px solid var(--gray-200)">'
                        + '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:var(--gray-500)">Mes</th>'
                        + '<th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:var(--gray-500)">Mov.</th>'
                        + '<th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:var(--gray-500)">Planchas</th>'
                        + '<th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:var(--gray-500)">m2</th>'
                        + '<th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:var(--gray-500)">Kg</th>'
                        + '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:var(--gray-500)">Tendencia</th>'
                        + '</tr></thead><tbody>'
                        + sorted.map(p => {
                            const maxPl = Math.max(...sorted.map(x => Number(x.total_planchas)));
                            const pct = maxPl > 0 ? Math.round((Number(p.total_planchas) / maxPl) * 100) : 0;
                            const parts = p.mes.split('-');
                            const mesLabel = monthNames[parseInt(parts[1])] + ' ' + parts[0];
                            const isSel = sel === p.mes;
                            return '<tr onclick="InvDashboard.filterByMes(\'' + p.mes + '\')" style="border-bottom:1px solid var(--gray-100);cursor:pointer;' + (isSel ? 'background:var(--primary);color:white' : '') + '" onmouseover="if(!this.style.background.includes(\'var(--primary)\'))this.style.background=\'var(--gray-50)\'" onmouseout="if(!this.style.background.includes(\'var(--primary)\'))this.style.background=\'\'">'
                                + '<td style="padding:8px 12px;font-weight:600;' + (isSel ? 'color:white' : 'color:var(--gray-800)') + '">' + mesLabel + '</td>'
                                + '<td style="padding:8px 12px;text-align:center;' + (isSel ? 'color:rgba(255,255,255,0.8)' : 'color:var(--gray-500)') + '">' + p.total_movimientos + '</td>'
                                + '<td style="padding:8px 12px;text-align:center;font-weight:700;' + (isSel ? 'color:white' : 'color:var(--primary)') + '">' + p.total_planchas + '</td>'
                                + '<td style="padding:8px 12px;text-align:center;' + (isSel ? 'color:rgba(255,255,255,0.8)' : 'color:var(--gray-600)') + '">' + Number(p.total_m2).toFixed(2) + '</td>'
                                + '<td style="padding:8px 12px;text-align:center;font-weight:600;' + (isSel ? 'color:white' : 'color:var(--gray-600)') + '">' + InvDashboard.fmtKg(p.total_kg) + '</td>'
                                + '<td style="padding:8px 12px"><div style="height:8px;background:' + (isSel ? 'rgba(255,255,255,0.2)' : 'var(--gray-100)') + ';border-radius:4px;overflow:hidden;width:180px"><div style="width:' + pct + '%;background:' + (isSel ? 'white' : 'var(--primary)') + ';height:100%;border-radius:4px"></div></div></td>'
                                + '</tr>';
                        }).join('')
                        + '</tbody></table>'}
                    </div>
                </div>

                <div class="card" style="overflow:hidden;margin-bottom:16px">
                    <div style="padding:14px 18px;background:var(--gray-50);border-bottom:1px solid var(--gray-200);font-size:13px;font-weight:700;color:var(--gray-800)">${rankingTitle}</div>
                    <div style="padding:0;overflow-x:auto">
                        ${rankingFiltrado.length === 0 ? '<div style="text-align:center;padding:20px;color:var(--gray-400);font-size:12px">Sin datos</div>' :
                        '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="border-bottom:2px solid var(--gray-200)">'
                        + '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:var(--gray-500)">#</th>'
                        + '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:var(--gray-500)">Material</th>'
                        + '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:var(--gray-500)">Esp.</th>'
                        + '<th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:700;color:var(--gray-500)">m2</th>'
                        + '<th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:700;color:var(--gray-500)">Kg</th>'
                        + '<th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:700;color:var(--gray-500)">Planchas</th>'
                        + '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:var(--gray-500)">Tendencia</th>'
                        + '</tr></thead><tbody>'
                        + rankingFiltrado.map((r, i) => {
                            const maxM2 = Number(rankingFiltrado[0].m2_salidos) || 1;
                            const pct = Math.round((Number(r.m2_salidos) / maxM2) * 100);
                            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
                            return '<tr style="border-bottom:1px solid var(--gray-100)">'
                                + '<td style="padding:8px 12px;font-weight:700;color:' + (i < 3 ? 'var(--warning)' : 'var(--gray-400)') + '">' + medal + '</td>'
                                + '<td style="padding:8px 12px;font-weight:600;color:var(--gray-800)">' + (r.nombre || r.codigo_mp) + '</td>'
                                + '<td style="padding:8px 12px;color:var(--gray-600)">' + (r.espesor_mm || '') + '</td>'
                                + '<td style="padding:8px 12px;text-align:right;font-weight:700;color:var(--danger)">' + Number(r.m2_salidos).toFixed(2) + '</td>'
                                + '<td style="padding:8px 12px;text-align:right;font-weight:600;color:var(--gray-600)">' + InvDashboard.fmtKg(r.kg_salidos) + '</td>'
                                + '<td style="padding:8px 12px;text-align:right;font-weight:600;color:var(--gray-600)">' + r.planchas_salidas + '</td>'
                                + '<td style="padding:8px 12px"><div style="height:8px;background:var(--gray-100);border-radius:4px;overflow:hidden;width:100%"><div style="width:' + pct + '%;background:var(--danger);height:100%;border-radius:4px"></div></div></td>'
                                + '</tr>';
                        }).join('')
                        + '</tbody></table>'}
                    </div>
                </div>

            </div>`;
    },

    async filterByMes(mes) {
        if (this.selectedMes === mes) { this.clearFilter(); return; }
        this.selectedMes = mes;
        const page = document.querySelector('.page.active');
        const hdrs = window._invDashHdrs || {};
        try {
            const data = await fetch('/api/inv/analytics?mes=' + mes, { headers: hdrs }).then(r => r.json()).catch(() => ({}));
            if (data.rankingSalida) window._invDashRanking = data.rankingSalida;
            this._renderContent(page);
        } catch(e) { this._renderContent(page); }
    },

    clearFilter() {
        this.selectedMes = null;
        const page = document.querySelector('.page.active');
        this._renderContent(page);
    }
};
