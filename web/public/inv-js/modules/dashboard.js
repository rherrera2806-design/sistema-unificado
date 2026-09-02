const InvDashboard = {
    selectedMes: null,
    _filtAuto: 0,

    async render() {
        const page = document.querySelector('.page.active');
        page.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray-400)">Cargando dashboard...</div>';
        try {
            const hdrs = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const analytics = await fetch('/api/inv/analytics?meses=6', { headers: hdrs }).then(r => r.json()).catch(() => ({}));
            const a = analytics || {};
            window._invDashRanking = a.rankingSalida || [];
            window._invDashConsumo = a.consumoMensual || [];
            window._invDashPlanchasMes = a.planchasPorMes || [];
            window._invDashStock = a.stockActual || [];
            window._invDashHdrs = hdrs;
            this.selectedMes = null;
            this._renderContent(page);
        } catch(err) { page.innerHTML = '<div class="alert alert-danger">Error: ' + err.message + '</div>'; }
    },

    _renderContent(page) {
        const ranking = window._invDashRanking || [];
        const consumo = window._invDashConsumo || [];
        const planchasMes = window._invDashPlanchasMes || [];
        const stock = window._invDashStock || [];
        const monthNames = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const sel = this.selectedMes;

        let rankingFiltrado = ranking;
        let rankingTitle = 'Ranking MP + Salida (6 meses)';
        if (sel) {
            const parts = sel.split('-');
            rankingTitle = 'Ranking MP + Salida (' + monthNames[parseInt(parts[1])] + ' ' + parts[0] + ')';
        }

        page.innerHTML = `
                <div style="width:100%">
                <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:24px;margin-bottom:20px;color:white;display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <h2 style="margin:0;font-size:18px;font-weight:800">Dashboard Inventario</h2>
                        <p style="margin:4px 0 0;font-size:12px;opacity:0.7">Analytics de materia prima - Últimos 6 meses</p>
                    </div>
                    ${sel ? '<button onclick="InvDashboard.clearFilter()" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);color:white;padding:6px 14px;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer">✕ Limpiar filtro</button>' : ''}
                </div>

                <div class="card" style="margin-bottom:16px;overflow:hidden">
                    <div style="padding:14px 18px;background:var(--gray-50);border-bottom:1px solid var(--gray-200);font-size:13px;font-weight:700;color:var(--gray-800)">Planchas Cortadas por Mes <span style="font-weight:400;font-size:11px;color:var(--gray-400)">(clic para filtrar)</span></div>
                    <div style="padding:16px;overflow-x:auto">
                        ${planchasMes.length === 0 ? '<div style="text-align:center;padding:20px;color:var(--gray-400);font-size:12px">Sin datos</div>' :
                        '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="border-bottom:2px solid var(--gray-200)">'
                        + '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:var(--gray-500)">Mes</th>'
                        + '<th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:var(--gray-500)">Movimientos</th>'
                        + '<th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:var(--gray-500)">Planchas</th>'
                        + '<th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:var(--gray-500)">m2</th>'
                        + '<th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:var(--gray-500)">Kg</th>'
                        + '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:var(--gray-500)">Tendencia</th>'
                        + '</tr></thead><tbody>'
                        + planchasMes.map(p => {
                            const maxPl = Math.max(...planchasMes.map(x => Number(x.total_planchas)));
                            const pct = maxPl > 0 ? Math.round((Number(p.total_planchas) / maxPl) * 100) : 0;
                            const parts = p.mes.split('-');
                            const mesLabel = monthNames[parseInt(parts[1])] + ' ' + parts[0];
                            const isSel = sel === p.mes;
                            return '<tr onclick="InvDashboard.filterByMes(\'' + p.mes + '\')" style="border-bottom:1px solid var(--gray-100);cursor:pointer;' + (isSel ? 'background:var(--primary);color:white' : '') + '" onmouseover="if(!this.style.background.includes(\'var(--primary)\'))this.style.background=\'var(--gray-50)\'" onmouseout="if(!this.style.background.includes(\'var(--primary)\'))this.style.background=\'\'">'
                                + '<td style="padding:8px 12px;font-weight:600;' + (isSel ? 'color:white' : 'color:var(--gray-800)') + '">' + mesLabel + '</td>'
                                + '<td style="padding:8px 12px;text-align:center;' + (isSel ? 'color:rgba(255,255,255,0.8)' : 'color:var(--gray-500)') + '">' + p.total_movimientos + '</td>'
                                + '<td style="padding:8px 12px;text-align:center;font-weight:700;' + (isSel ? 'color:white' : 'color:var(--primary)') + '">' + p.total_planchas + '</td>'
                                + '<td style="padding:8px 12px;text-align:center;' + (isSel ? 'color:rgba(255,255,255,0.8)' : 'color:var(--gray-600)') + '">' + Number(p.total_m2).toFixed(2) + '</td>'
                                + '<td style="padding:8px 12px;text-align:center;font-weight:600;' + (isSel ? 'color:white' : 'color:var(--gray-600)') + '">' + Math.round(p.total_kg || 0) + '</td>'
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
                                + '<td style="padding:8px 12px;text-align:right;font-weight:600;color:var(--gray-600)">' + Math.round(r.kg_salidos || 0) + '</td>'
                                + '<td style="padding:8px 12px;text-align:right;font-weight:600;color:var(--gray-600)">' + r.planchas_salidas + '</td>'
                                + '<td style="padding:8px 12px"><div style="height:8px;background:var(--gray-100);border-radius:4px;overflow:hidden;width:100%"><div style="width:' + pct + '%;background:var(--danger);height:100%;border-radius:4px"></div></div></td>'
                                + '</tr>';
                        }).join('')
                        + '</tbody></table>'}
                    </div>
                </div>

                <div class="card" style="overflow:hidden;margin-bottom:16px">
                    <div style="padding:14px 18px;background:var(--gray-50);border-bottom:1px solid var(--gray-200);font-size:13px;font-weight:700;color:var(--gray-800)">Consumo Mensual por Material</div>
                        <div style="padding:0;overflow-x:auto">
                            ${consumo.length === 0 ? '<div style="text-align:center;padding:20px;color:var(--gray-400);font-size:12px">Sin datos</div>' :
                            (() => {
                                const porMp = {};
                                consumo.forEach(c => {
                                    const key = c.codigo_mp + '|' + (c.espesor_mm || '');
                                    if (!porMp[key]) porMp[key] = { nombre: c.nombre, espesor: c.espesor_mm, meses: {} };
                                    porMp[key].meses[c.mes] = Number(c.planchas_consumidas);
                                });
                                const allMeses = [...new Set(consumo.map(c => c.mes))].sort();
                                const rows = Object.entries(porMp).map(([key, data]) => {
                                    const total = Object.values(data.meses).reduce((s, v) => s + v, 0);
                                    const numMeses = Object.keys(data.meses).length || 1;
                                    const promedio = total / numMeses;
                                    return { nombre: data.nombre, espesor: data.espesor, meses: data.meses, total, promedio };
                                });
                                rows.sort((a, b) => a.nombre.localeCompare(b.nombre) || (a.espesor || '').localeCompare(b.espesor || ''));
                                const maxVal = Math.max(...rows.flatMap(r => Object.values(r.meses)), 1);
                                return '<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="border-bottom:2px solid var(--gray-200)">'
                                    + '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:var(--gray-500);position:sticky;left:0;background:white;z-index:1;min-width:140px">Material</th>'
                                    + '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:var(--gray-500);min-width:50px">Esp.</th>'
                                    + allMeses.map(m => {
                                        const parts = m.split('-');
                                        return '<th style="padding:8px 6px;text-align:center;font-size:10px;font-weight:700;color:var(--gray-500);min-width:52px">' + monthNames[parseInt(parts[1])] + '<br><span style="font-weight:400;color:var(--gray-400)">' + parts[0].slice(2) + '</span></th>';
                                    }).join('')
                                    + '<th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:var(--gray-500);min-width:60px">TOTAL</th>'
                                    + '<th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:var(--gray-500);min-width:60px">PROM.</th>'
                                    + '</tr></thead><tbody>'
                                    + rows.map(r => '<tr style="border-bottom:1px solid var(--gray-100)">'
                                        + '<td style="padding:6px 12px;font-weight:600;color:var(--gray-800);position:sticky;left:0;background:white;z-index:1">' + (r.nombre || '-') + '</td>'
                                        + '<td style="padding:6px 8px;color:var(--gray-600)">' + (r.espesor || '-') + '</td>'
                                        + allMeses.map(m => {
                                            const val = r.meses[m] || 0;
                                                return '<td style="padding:6px;text-align:center;position:relative">'
                                                    + (val > 0 ? '<div style="position:absolute;top:0;left:2px;right:2px;bottom:0;background:var(--primary);opacity:0.08;border-radius:2px"></div>' : '')
                                                    + '<span style="position:relative;font-weight:600;color:' + (val > 0 ? 'var(--gray-800)' : 'var(--gray-300)') + '">' + (val > 0 ? Math.round(val) : '-') + '</span></td>';
                                        }).join('')
                                        + '<td style="padding:6px 12px;text-align:center;font-weight:700;color:var(--primary);background:var(--gray-50)">' + Math.round(r.total) + '</td>'
                                        + '<td style="padding:6px 12px;text-align:center;font-weight:600;color:var(--gray-600);background:var(--gray-50)">' + Math.round(r.promedio) + '</td>'
                                        + '</tr>').join('')
                                    + '</tbody></table>';
                            })()}
                        </div>
                    </div>
                </div>

                <div class="card" style="overflow:hidden;margin-bottom:16px">
                    <div style="padding:14px 18px;background:var(--gray-50);border-bottom:1px solid var(--gray-200);font-size:13px;font-weight:700;color:var(--gray-800);display:flex;justify-content:space-between;align-items:center">
                        <span>Proyección de Stock por Material</span>
                        <div style="display:flex;gap:4px;align-items:center;font-size:10px;font-weight:600">
                            <span style="color:var(--gray-400);margin-right:4px">Filtrar ≤</span>
                            <button onclick="InvDashboard.filtAuto(0)" class="inv-filt-btn" data-val="0" style="padding:3px 8px;border-radius:6px;border:1px solid var(--gray-200);background:${this._filtAuto===0?'var(--primary)':'white'};color:${this._filtAuto===0?'white':'var(--gray-600)'};cursor:pointer;font-size:10px;font-weight:600">Todos</button>
                            <button onclick="InvDashboard.filtAuto(1)" class="inv-filt-btn" data-val="1" style="padding:3px 8px;border-radius:6px;border:1px solid var(--gray-200);background:${this._filtAuto===1?'var(--danger)':'white'};color:${this._filtAuto===1?'white':'var(--gray-600)'};cursor:pointer;font-size:10px;font-weight:600">&lt;1 mes</button>
                            <button onclick="InvDashboard.filtAuto(2)" class="inv-filt-btn" data-val="2" style="padding:3px 8px;border-radius:6px;border:1px solid var(--gray-200);background:${this._filtAuto===2?'var(--danger)':'white'};color:${this._filtAuto===2?'white':'var(--gray-600)'};cursor:pointer;font-size:10px;font-weight:600">&lt;2 meses</button>
                            <button onclick="InvDashboard.filtAuto(3)" class="inv-filt-btn" data-val="3" style="padding:3px 8px;border-radius:6px;border:1px solid var(--gray-200);background:${this._filtAuto===3?'var(--warning)':'white'};color:${this._filtAuto===3?'white':'var(--gray-600)'};cursor:pointer;font-size:10px;font-weight:600">&lt;3 meses</button>
                            <button onclick="InvDashboard.filtAuto(4)" class="inv-filt-btn" data-val="4" style="padding:3px 8px;border-radius:6px;border:1px solid var(--gray-200);background:${this._filtAuto===4?'var(--warning)':'white'};color:${this._filtAuto===4?'white':'var(--gray-600)'};cursor:pointer;font-size:10px;font-weight:600">&lt;4 meses</button>
                            <button onclick="InvDashboard.filtAuto(5)" class="inv-filt-btn" data-val="5" style="padding:3px 8px;border-radius:6px;border:1px solid var(--gray-200);background:${this._filtAuto===5?'var(--success)':'white'};color:${this._filtAuto===5?'white':'var(--gray-600)'};cursor:pointer;font-size:10px;font-weight:600">&lt;5 meses</button>
                            <button onclick="InvDashboard.filtAuto(6)" class="inv-filt-btn" data-val="6" style="padding:3px 8px;border-radius:6px;border:1px solid var(--gray-200);background:${this._filtAuto===6?'var(--success)':'white'};color:${this._filtAuto===6?'white':'var(--gray-600)'};cursor:pointer;font-size:10px;font-weight:600">&lt;6 meses</button>
                        </div>
                    </div>
                    <div style="padding:0;overflow-x:auto">
                        ${stock.length === 0 ? '<div style="text-align:center;padding:20px;color:var(--gray-400);font-size:12px">Sin datos</div>' :
                        (() => {
                            const now = new Date();
                            const meses = [];
                            for (let i = 0; i < 12; i++) {
                                const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
                                meses.push({ key: d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'), label: monthNames[d.getMonth()+1], anio: String(d.getFullYear()).slice(2) });
                            }
                            const maxAuto = this._filtAuto || 0;
                            let filtered = stock.filter(s => s.stock > 0 || s.consumo_promedio > 0);
                            if (maxAuto > 0) filtered = filtered.filter(s => (s.autonomia_meses || 0) < maxAuto);
                            const sorted = filtered.sort((a,b) => (a.nombre || '').localeCompare(b.nombre || '') || (Number(b.espesor_mm) || 0) - (Number(a.espesor_mm) || 0));
                            return '<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="border-bottom:2px solid var(--gray-200)">'
                                + '<th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;color:var(--gray-500);position:sticky;left:0;background:white;z-index:1;min-width:60px">SAP</th>'
                                + '<th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;color:var(--gray-500);min-width:100px">Material</th>'
                                + '<th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;color:var(--gray-500);min-width:40px">Esp.</th>'
                                + '<th style="padding:8px 10px;text-align:right;font-size:10px;font-weight:700;color:var(--gray-500);min-width:50px">Stock</th>'
                                + '<th style="padding:8px 10px;text-align:right;font-size:10px;font-weight:700;color:var(--gray-500);min-width:50px">Kg</th>'
                                + '<th style="padding:8px 10px;text-align:right;font-size:10px;font-weight:700;color:var(--gray-500);min-width:60px">Cons. Prom.</th>'
                                + '<th style="padding:8px 10px;text-align:center;font-size:10px;font-weight:700;color:var(--gray-500);min-width:60px">Auton. (mes)</th>'
                                + meses.map(m => '<th style="padding:8px 6px;text-align:center;font-size:10px;font-weight:700;color:var(--gray-500);min-width:44px">' + m.label + '<br><span style="font-weight:400;color:var(--gray-400)">' + m.anio + '</span></th>').join('')
                                + '</tr></thead><tbody>'
                                + sorted.map(s => {
                                    const stockRem = s.stock;
                                    const cpm = s.consumo_promedio || 0;
                                    const auto = s.autonomia_meses || 0;
                                    const autoColor = s.stock <= 0 ? 'var(--danger)' : auto < 2 ? 'var(--danger)' : auto < 4 ? 'var(--warning)' : 'var(--success)';
                                    return '<tr style="border-bottom:1px solid var(--gray-100)">'
                                        + '<td style="padding:6px 10px;color:var(--gray-600);position:sticky;left:0;background:white;z-index:1">' + (s.codigo_mp || '') + '</td>'
                                        + '<td style="padding:6px 10px;font-weight:600;color:var(--gray-800);position:sticky;left:60px;background:white;z-index:1">' + (s.nombre || '') + '</td>'
                                        + '<td style="padding:6px 10px;color:var(--gray-600)">' + (s.espesor_mm || '') + '</td>'
                                        + '<td style="padding:6px 10px;text-align:right;font-weight:700;color:var(--gray-800)">' + Math.round(stockRem) + '</td>'
                                        + '<td style="padding:6px 10px;text-align:right;font-weight:600;color:var(--gray-600)">' + Math.round(s.kg_stock || 0) + '</td>'
                                        + '<td style="padding:6px 10px;text-align:right;font-weight:600;color:var(--gray-600)">' + Math.round(cpm) + '</td>'
                                        + '<td style="padding:6px 10px;text-align:center"><span style="display:inline-block;padding:2px 8px;border-radius:8px;font-size:10px;font-weight:700;background:' + autoColor + '15;color:' + autoColor + '">' + (auto > 0 ? auto.toFixed(1) : '-') + '</span></td>'
                                        + meses.map((m, i) => {
                                            const cpmVal = cpm || 0;
                                            if (cpmVal <= 0) return '<td style="padding:6px 4px;text-align:center;border-left:1px solid var(--gray-100)"><div style="width:100%;height:22px;border-radius:3px"></div></td>';
                                            const stockInicioMes = stockRem - (cpmVal * i);
                                            const stockFinMes = stockInicioMes - cpmVal;
                                            let bgStyle = '';
                                            if (stockInicioMes <= 0) bgStyle = '';
                                            else if (stockFinMes <= 0) bgStyle = 'background:repeating-linear-gradient(45deg,rgba(245,158,11,0.2),rgba(245,158,11,0.2) 3px,transparent 3px,transparent 6px)';
                                            else bgStyle = 'background:repeating-linear-gradient(45deg,rgba(34,197,94,0.18),rgba(34,197,94,0.18) 3px,transparent 3px,transparent 6px)';
                                            return '<td style="padding:6px 4px;text-align:center;border-left:1px solid var(--gray-100)"><div style="width:100%;height:22px;border-radius:3px;' + bgStyle + '"></div></td>';
                                        }).join('')
                                        + '</tr>';
                                }).join('')
                                + '</tbody></table>';
                        })()}
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
    },

    filtAuto(val) {
        this._filtAuto = val;
        const page = document.querySelector('.page.active');
        this._renderContent(page);
    }
};
