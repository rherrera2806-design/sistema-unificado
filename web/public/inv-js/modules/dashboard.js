const InvDashboard = {
    async render() {
        const page = document.querySelector('.page.active');
        page.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray-400)">Cargando dashboard...</div>';
        try {
            const hdrs = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const [stats, analytics] = await Promise.all([
                api.inv().getEstadisticas(),
                fetch('/api/inv/analytics?meses=6', { headers: hdrs }).then(r => r.json()).catch(() => ({}))
            ]);
            const a = analytics || {};
            const ranking = a.rankingSalida || [];
            const consumo = a.consumoMensual || [];
            const planchasMes = a.planchasPorMes || [];
            const stock = a.stockActual || [];
            const monthNames = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

            page.innerHTML = `
                <div style="max-width:1200px">
                    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:24px;margin-bottom:20px;color:white">
                        <h2 style="margin:0;font-size:18px;font-weight:800">Dashboard Inventario</h2>
                        <p style="margin:4px 0 0;font-size:12px;opacity:0.7">Analytics de materia prima - Últimos 6 meses</p>
                    </div>

                    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
                        <div class="card" style="padding:16px;border-left:4px solid var(--primary)"><div style="font-size:11px;color:var(--gray-500);margin-bottom:4px">Total Movimientos</div><div style="font-size:24px;font-weight:800;color:var(--primary)">${stats.totalMovimientos}</div></div>
                        <div class="card" style="padding:16px;border-left:4px solid var(--success)"><div style="font-size:11px;color:var(--gray-500);margin-bottom:4px">Entradas</div><div style="font-size:24px;font-weight:800;color:var(--success)">${stats.totalEntradas}</div></div>
                        <div class="card" style="padding:16px;border-left:4px solid var(--danger)"><div style="font-size:11px;color:var(--gray-500);margin-bottom:4px">Salidas</div><div style="font-size:24px;font-weight:800;color:var(--danger)">${stats.totalSalidas}</div></div>
                        <div class="card" style="padding:16px;border-left:4px solid var(--warning)"><div style="font-size:11px;color:var(--gray-500);margin-bottom:4px">Stock m2</div><div style="font-size:24px;font-weight:800;color:var(--warning)">${stats.stockM2.toFixed(1)} <span style="font-size:12px;font-weight:400">m2</span></div></div>
                    </div>

                    <div class="card" style="margin-bottom:16px;overflow:hidden">
                        <div style="padding:14px 18px;background:var(--gray-50);border-bottom:1px solid var(--gray-200);font-size:13px;font-weight:700;color:var(--gray-800)">Planchas Cortadas por Mes</div>
                        <div style="padding:16px;overflow-x:auto">
                            ${planchasMes.length === 0 ? '<div style="text-align:center;padding:20px;color:var(--gray-400);font-size:12px">Sin datos</div>' :
                            '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="border-bottom:2px solid var(--gray-200)">'
                            + '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:var(--gray-500)">Mes</th>'
                            + '<th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:var(--gray-500)">Movimientos</th>'
                            + '<th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:var(--gray-500)">Planchas</th>'
                            + '<th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:var(--gray-500)">m2</th>'
                            + '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:var(--gray-500)">Tendencia</th>'
                            + '</tr></thead><tbody>'
                            + planchasMes.map(p => {
                                const maxPl = Math.max(...planchasMes.map(x => Number(x.total_planchas)));
                                const pct = maxPl > 0 ? Math.round((Number(p.total_planchas) / maxPl) * 100) : 0;
                                const parts = p.mes.split('-');
                                const mesLabel = monthNames[parseInt(parts[1])] + ' ' + parts[0];
                                return '<tr style="border-bottom:1px solid var(--gray-100)">'
                                    + '<td style="padding:8px 12px;font-weight:600;color:var(--gray-800)">' + mesLabel + '</td>'
                                    + '<td style="padding:8px 12px;text-align:center;color:var(--gray-500)">' + p.total_movimientos + '</td>'
                                    + '<td style="padding:8px 12px;text-align:center;font-weight:700;color:var(--primary)">' + p.total_planchas + '</td>'
                                    + '<td style="padding:8px 12px;text-align:center;color:var(--gray-600)">' + Number(p.total_m2).toFixed(2) + '</td>'
                                    + '<td style="padding:8px 12px"><div style="height:8px;background:var(--gray-100);border-radius:4px;overflow:hidden;width:180px"><div style="width:' + pct + '%;background:var(--primary);height:100%;border-radius:4px"></div></div></td>'
                                    + '</tr>';
                            }).join('')
                            + '</tbody></table>'}
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
                        <div class="card" style="overflow:hidden">
                            <div style="padding:14px 18px;background:var(--gray-50);border-bottom:1px solid var(--gray-200);font-size:13px;font-weight:700;color:var(--gray-800)">Ranking MP + Salida (6 meses)</div>
                            <div style="padding:16px;max-height:350px;overflow-y:auto">
                                ${ranking.length === 0 ? '<div style="text-align:center;padding:20px;color:var(--gray-400);font-size:12px">Sin datos</div>' :
                                ranking.map((r, i) => {
                                    const maxM2 = Number(ranking[0].m2_salidos) || 1;
                                    const pct = Math.round((Number(r.m2_salidos) / maxM2) * 100);
                                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
                                    return '<div style="margin-bottom:12px">'
                                        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">'
                                        + '<span style="font-size:11px;font-weight:600;color:var(--gray-800)">' + medal + '. ' + (r.nombre || r.codigo_mp) + ' ' + (r.espesor_mm || '') + 'mm</span>'
                                        + '<span style="font-size:11px;font-weight:700;color:var(--danger)">' + Number(r.m2_salidos).toFixed(2) + ' m2</span></div>'
                                        + '<div style="display:flex;gap:6px;align-items:center">'
                                        + '<div style="flex:1;height:8px;background:var(--gray-100);border-radius:4px;overflow:hidden"><div style="width:' + pct + '%;background:var(--danger);height:100%;border-radius:4px"></div></div>'
                                        + '<span style="font-size:9px;color:var(--gray-400);white-space:nowrap">' + r.planchas_salidas + ' planchas</span></div></div>';
                                }).join('')}
                            </div>
                        </div>

                        <div class="card" style="overflow:hidden">
                            <div style="padding:14px 18px;background:var(--gray-50);border-bottom:1px solid var(--gray-200);font-size:13px;font-weight:700;color:var(--gray-800)">Consumo Mensual por Material</div>
                            <div style="padding:0;overflow-x:auto">
                                ${consumo.length === 0 ? '<div style="text-align:center;padding:20px;color:var(--gray-400);font-size:12px">Sin datos</div>' :
                                (() => {
                                    const porMp = {};
                                    consumo.forEach(c => {
                                        const key = c.codigo_mp + '|' + (c.espesor_mm || '');
                                        if (!porMp[key]) porMp[key] = { nombre: c.nombre, espesor: c.espesor_mm, meses: {} };
                                        porMp[key].meses[c.mes] = Number(c.m2_consumidos);
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
                                            + '<td style="padding:6px 8px;color:var(--gray-600)">' + (r.espesor || '-') + 'mm</td>'
                                            + allMeses.map(m => {
                                                const val = r.meses[m] || 0;
                                                const pct = maxVal > 0 ? Math.round((val / maxVal) * 100) : 0;
                                                return '<td style="padding:6px;text-align:center;position:relative">'
                                                    + (val > 0 ? '<div style="position:absolute;top:0;left:2px;right:2px;bottom:0;background:var(--primary);opacity:0.08;border-radius:2px"></div>' : '')
                                                    + '<span style="position:relative;font-weight:600;color:' + (val > 0 ? 'var(--gray-800)' : 'var(--gray-300)') + '">' + (val > 0 ? val.toFixed(1) : '-') + '</span></td>';
                                            }).join('')
                                            + '<td style="padding:6px 12px;text-align:center;font-weight:700;color:var(--primary);background:var(--gray-50)">' + r.total.toFixed(1) + '</td>'
                                            + '<td style="padding:6px 12px;text-align:center;font-weight:600;color:var(--gray-600);background:var(--gray-50)">' + r.promedio.toFixed(1) + '</td>'
                                            + '</tr>').join('')
                                        + '</tbody></table>';
                                })()}
                            </div>
                        </div>
                    </div>

                    <div class="card" style="overflow:hidden;margin-bottom:16px">
                        <div style="padding:14px 18px;background:var(--gray-50);border-bottom:1px solid var(--gray-200);font-size:13px;font-weight:700;color:var(--gray-800)">Stock Actual con Autonomía</div>
                        <div style="padding:16px;max-height:350px;overflow-y:auto">
                            ${stock.length === 0 ? '<div style="text-align:center;padding:20px;color:var(--gray-400);font-size:12px">Sin datos</div>' :
                            stock.sort((a,b) => (a.autonomia_meses || 0) - (b.autonomia_meses || 0)).map(s => {
                                const stockVal = s.stock || 0;
                                const auto = s.autonomia_meses || 0;
                                const color = stockVal <= 0 ? 'var(--danger)' : auto < 2 ? 'var(--warning)' : 'var(--success)';
                                const label = stockVal <= 0 ? 'SIN STOCK' : auto < 1 ? '< 1 mes' : auto + ' meses';
                                return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--gray-100)">'
                                    + '<div><div style="font-size:12px;font-weight:600;color:var(--gray-800)">' + (s.nombre || s.codigo_mp) + ' ' + (s.espesor_mm || '') + 'mm</div>'
                                    + '<div style="font-size:10px;color:var(--gray-400)">CPM: ' + (s.consumo_promedio_mensual || 0) + '</div></div>'
                                    + '<div style="text-align:right"><div style="font-size:13px;font-weight:700;color:' + color + '">' + stockVal + ' planchas</div>'
                                    + '<span class="badge" style="background:' + color + '20;color:' + color + ';font-size:9px">' + label + '</span></div></div>';
                            }).join('')}
                        </div>
                    </div>

                </div>`;
        } catch(err) { page.innerHTML = '<div class="alert alert-danger">Error: ' + err.message + '</div>'; }
    }
};
