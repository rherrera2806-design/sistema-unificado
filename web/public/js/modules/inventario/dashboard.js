const InvDashboard = {
    async render() {
        const page = document.querySelector('.page.active');
        page.innerHTML = '<div class="empty-state"><p>Cargando...</p></div>';
        try {
            const hdrs = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const [stats, porTipo, recientes, analytics] = await Promise.all([
                api.inv().getEstadisticas(),
                api.inv().getEstadisticasPorTipo(),
                api.inv().getMovimientos(),
                fetch('/api/inv/analytics?meses=6', { headers: hdrs }).then(r => r.json()).catch(() => ({}))
            ]);
            const recentes = recientes.slice(0, 8);
            const a = analytics || {};
            const ranking = a.rankingSalida || [];
            const consumo = a.consumoMensual || [];
            const planchasMes = a.planchasPorMes || [];
            const stock = a.stockActual || [];
            const dims = a.topDimensiones || [];

            const monthNames = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

            page.innerHTML = `
                <div class="m-page">
                    <div class="m-hero">
                        <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
                        <div style="position:relative;z-index:1">
                            <h2 style="margin:0;font-size:15px;font-weight:800;color:white;letter-spacing:-0.5px">Dashboard Inventario</h2>
                            <p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Analytics de materia prima - Últimos 6 meses</p>
                        </div>
                    </div>

                    <div class="quick-actions">
                        <div class="action-card" onclick="App.navigateInv('movimientos')"><div class="icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div><div class="label">Nuevo Movimiento</div></div>
                        <div class="action-card" onclick="App.navigateInv('inventario')"><div class="icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div><div class="label">Ver Inventario</div></div>
                        <div class="action-card" onclick="App.navigateInv('historial')"><div class="icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><div class="label">Historial</div></div>
                    </div>

                    <div class="m-stats">
                        <div class="m-stat-card"><div class="m-stat-icon" style="background:#dbeafe"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><div><div class="m-stat-value" style="color:#3b82f6">${stats.totalMovimientos}</div><div class="m-stat-label">Total Movimientos</div></div></div>
                        <div class="m-stat-card"><div class="m-stat-icon" style="background:#d1fae5"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></div><div><div class="m-stat-value" style="color:#22c55e">${stats.totalEntradas}</div><div class="m-stat-label">Entradas</div></div></div>
                        <div class="m-stat-card"><div class="m-stat-icon" style="background:#fee2e2"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div><div><div class="m-stat-value" style="color:#ef4444">${stats.totalSalidas}</div><div class="m-stat-label">Salidas</div></div></div>
                        <div class="m-stat-card"><div class="m-stat-icon" style="background:#fef3c7"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div><div><div class="m-stat-value" style="color:#f59e0b">${stats.stockM2.toFixed(2)} <span style="font-size:11px;font-weight:400">m2</span></div><div class="m-stat-label">Stock m2</div></div></div>
                    </div>

                    <!-- PLANCHAS CORTADAS POR MES -->
                    <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:16px;overflow:hidden">
                        <div style="padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:8px">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                            Planchas Cortadas por Mes
                        </div>
                        <div style="padding:16px;overflow-x:auto">
                            ${planchasMes.length === 0 ? '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px">Sin datos</div>' :
                            '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">'
                            + '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:#64748b">Mes</th>'
                            + '<th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:#64748b">Movimientos</th>'
                            + '<th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:#64748b">Planchas</th>'
                            + '<th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:#64748b">m2</th>'
                            + '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:#64748b">Distribución</th>'
                            + '</tr></thead><tbody>'
                            + planchasMes.map(p => {
                                const maxPl = Math.max(...planchasMes.map(x => Number(x.total_planchas)));
                                const pct = maxPl > 0 ? Math.round((Number(p.total_planchas) / maxPl) * 100) : 0;
                                const parts = p.mes.split('-');
                                const mesLabel = monthNames[parseInt(parts[1])] + ' ' + parts[0];
                                return '<tr style="border-bottom:1px solid #f1f5f9">'
                                    + '<td style="padding:8px 12px;font-weight:600;color:#0f172a">' + mesLabel + '</td>'
                                    + '<td style="padding:8px 12px;text-align:center;color:#64748b">' + p.total_movimientos + '</td>'
                                    + '<td style="padding:8px 12px;text-align:center;font-weight:700;color:#3b82f6">' + p.total_planchas + '</td>'
                                    + '<td style="padding:8px 12px;text-align:center;color:#475569">' + Number(p.total_m2).toFixed(2) + '</td>'
                                    + '<td style="padding:8px 12px"><div style="height:10px;background:#f1f5f9;border-radius:5px;overflow:hidden;width:200px"><div style="width:' + pct + '%;background:linear-gradient(90deg,#3b82f6,#60a5fa);height:100%;border-radius:5px"></div></div></td>'
                                    + '</tr>';
                            }).join('')
                            + '</tbody></table>'}
                        </div>
                    </div>

                    <!-- 2 COLUMNAS: Ranking Salida + Consumo Mensual -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">

                        <!-- RANKING MP MÁS SALIDA -->
                        <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
                            <div style="padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:8px">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                                Ranking MP + Salida (6 meses)
                            </div>
                            <div style="padding:12px;max-height:350px;overflow-y:auto">
                                ${ranking.length === 0 ? '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px">Sin datos</div>' :
                                ranking.map((r, i) => {
                                    const maxM2 = Number(ranking[0].m2_salidos) || 1;
                                    const pct = Math.round((Number(r.m2_salidos) / maxM2) * 100);
                                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
                                    return '<div style="margin-bottom:12px">'
                                        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">'
                                        + '<span style="font-size:11px;font-weight:600;color:#0f172a">' + medal + '. ' + (r.nombre || r.codigo_mp) + ' ' + (r.espesor_mm || '') + 'mm</span>'
                                        + '<span style="font-size:11px;font-weight:700;color:#ef4444">' + Number(r.m2_salidos).toFixed(2) + ' m2</span></div>'
                                        + '<div style="display:flex;gap:6px;align-items:center">'
                                        + '<div style="flex:1;height:8px;background:#f1f5f9;border-radius:4px;overflow:hidden"><div style="width:' + pct + '%;background:linear-gradient(90deg,#ef4444,#f87171);height:100%;border-radius:4px"></div></div>'
                                        + '<span style="font-size:9px;color:#94a3b8;white-space:nowrap">' + r.planchas_salidas + ' planchas</span></div></div>';
                                }).join('')}
                            </div>
                        </div>

                        <!-- CONSUMO MENSUAL POR MATERIAL -->
                        <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
                            <div style="padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:8px">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                                Consumo Mensual por Material
                            </div>
                            <div style="padding:12px;max-height:350px;overflow-y:auto">
                                ${consumo.length === 0 ? '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px">Sin datos</div>' :
                                (() => {
                                    const porMp = {};
                                    consumo.forEach(c => {
                                        if (!porMp[c.codigo_mp]) porMp[c.codigo_mp] = { nombre: c.nombre, meses: {} };
                                        porMp[c.codigo_mp].meses[c.mes] = Number(c.m2_consumidos);
                                    });
                                    return Object.entries(porMp).slice(0, 10).map(([cod, data]) => {
                                        const meses = Object.entries(data.meses).sort((a,b) => a[0].localeCompare(b[0]));
                                        const total = meses.reduce((s, [,v]) => s + v, 0);
                                        return '<div style="margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #f1f5f9">'
                                            + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'
                                            + '<span style="font-size:11px;font-weight:700;color:#0f172a">' + (data.nombre || cod) + '</span>'
                                            + '<span style="font-size:10px;font-weight:600;color:#8b5cf6">' + total.toFixed(2) + ' m2 total</span></div>'
                                            + '<div style="display:flex;gap:3px;flex-wrap:wrap">'
                                            + meses.map(([mes, val]) => {
                                                const maxMes = Math.max(...meses.map(([,v]) => v), 1);
                                                const h = Math.max(Math.round((val / maxMes) * 24), 2);
                                                const parts = mes.split('-');
                                                return '<div style="text-align:center;flex:1;min-width:32px">'
                                                    + '<div style="height:' + h + 'px;background:linear-gradient(180deg,#8b5cf6,#a78bfa);border-radius:3px;margin:0 auto;width:80%;min-width:16px" title="' + val.toFixed(2) + ' m2"></div>'
                                                    + '<div style="font-size:8px;color:#94a3b8;margin-top:2px">' + monthNames[parseInt(parts[1])] + '</div></div>';
                                            }).join('')
                                            + '</div></div>';
                                    }).join('');
                                })()}
                            </div>
                        </div>
                    </div>

                    <!-- 2 COLUMNAS: Stock Actual + Top Dimensiones -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">

                        <!-- STOCK ACTUAL CON AUTONOMÍA -->
                        <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
                            <div style="padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:8px">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                                Stock Actual con Autonomía
                            </div>
                            <div style="padding:12px;max-height:350px;overflow-y:auto">
                                ${stock.length === 0 ? '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px">Sin datos</div>' :
                                stock.sort((a,b) => (a.autonomia_meses || 0) - (b.autonomia_meses || 0)).map(s => {
                                    const stockVal = s.stock || 0;
                                    const auto = s.autonomia_meses || 0;
                                    const color = stockVal <= 0 ? '#dc2626' : auto < 2 ? '#f59e0b' : '#22c55e';
                                    const label = stockVal <= 0 ? 'SIN STOCK' : auto < 1 ? '< 1 mes' : auto + ' meses';
                                    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f8fafc">'
                                        + '<div><div style="font-size:12px;font-weight:600;color:#0f172a">' + (s.nombre || s.codigo_mp) + ' ' + (s.espesor_mm || '') + 'mm</div>'
                                        + '<div style="font-size:10px;color:#94a3b8">CPM: ' + (s.consumo_promedio_mensual || 0) + '</div></div>'
                                        + '<div style="text-align:right"><div style="font-size:13px;font-weight:700;color:' + color + '">' + stockVal + ' planchas</div>'
                                        + '<span style="display:inline-block;padding:2px 6px;border-radius:8px;font-size:9px;font-weight:600;background:' + color + '15;color:' + color + '">' + label + '</span></div></div>';
                                }).join('')}
                            </div>
                        </div>

                        <!-- TOP DIMENSIONES CORTADAS -->
                        <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
                            <div style="padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:8px">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
                                Top Dimensiones Más Cortadas
                            </div>
                            <div style="padding:12px;max-height:350px;overflow-y:auto">
                                ${dims.length === 0 ? '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px">Sin datos</div>' :
                                '<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="border-bottom:1px solid #e2e8f0">'
                                + '<th style="padding:6px 8px;text-align:left;font-size:9px;font-weight:700;color:#64748b">#</th>'
                                + '<th style="padding:6px 8px;text-align:left;font-size:9px;font-weight:700;color:#64748b">Dimensión</th>'
                                + '<th style="padding:6px 8px;text-align:left;font-size:9px;font-weight:700;color:#64748b">Tipo</th>'
                                + '<th style="padding:6px 8px;text-align:center;font-size:9px;font-weight:700;color:#64748b">Planchas</th>'
                                + '<th style="padding:6px 8px;text-align:center;font-size:9px;font-weight:700;color:#64748b">m2</th>'
                                + '</tr></thead><tbody>'
                                + dims.map((d, i) => '<tr style="border-bottom:1px solid #f8fafc">'
                                    + '<td style="padding:6px 8px;font-weight:700;color:' + (i < 3 ? '#f59e0b' : '#94a3b8') + '">' + (i + 1) + '</td>'
                                    + '<td style="padding:6px 8px;font-weight:600;color:#0f172a">' + d.ancho + ' x ' + d.alto + '</td>'
                                    + '<td style="padding:6px 8px;color:#475569">' + (d.tipo_cristal || '-') + '</td>'
                                    + '<td style="padding:6px 8px;text-align:center;font-weight:600;color:#3b82f6">' + d.total_planchas + '</td>'
                                    + '<td style="padding:6px 8px;text-align:center;color:#475569">' + Number(d.total_m2).toFixed(2) + '</td>'
                                    + '</tr>').join('')
                                + '</tbody></table>'}
                            </div>
                        </div>
                    </div>

                    <!-- Stock por Tipo de Cristal -->
                    ${porTipo.length > 0 ? '<div style="font-size:13px;font-weight:700;color:#334155;margin-bottom:12px">Stock por Tipo de Cristal</div><div class="m-stats">' + porTipo.map(t => '<div class="m-stat-card" style="border-left:4px solid ' + (t.stock > 0 ? 'var(--success)' : 'var(--danger)') + '"><div><div class="m-stat-label" style="margin-bottom:4px">' + t.tipo + '</div><div class="m-stat-value">' + t.stock.toFixed(2) + ' <span style="font-size:11px;font-weight:400">m2</span></div><div style="font-size:10px;color:var(--gray-500);margin-top:4px">E: ' + t.entradas.toFixed(2) + ' | S: ' + t.salidas.toFixed(2) + '</div></div></div>').join('') + '</div>' : ''}

                    <div style="font-size:13px;font-weight:700;color:#334155;margin-bottom:12px">Movimientos Recientes</div>
                    <div class="m-card">
                        <div class="m-card-body">
                            ${recentes.length === 0
                                ? '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">No hay movimientos</h4><p style="margin:0;color:#94a3b8;font-size:13px">Registra el primer movimiento</p></div>'
                                : '<div class="m-table-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Cristal</th><th>Espesor</th><th>Dimensiones</th><th>Cantidad</th><th>m2</th></tr></thead><tbody>' + recentes.map(m => '<tr><td>' + new Date(m.fecha_hora).toLocaleDateString('es-CL') + '</td><td><span class="badge ' + (m.tipo_movimiento === 'entrada' ? 'badge-entrada' : 'badge-salida') + '">' + m.tipo_movimiento + '</span></td><td>' + m.tipo_cristal + '</td><td>' + m.espesor + 'mm</td><td>' + Math.round(m.ancho) + ' x ' + Math.round(m.alto) + ' mm</td><td>' + m.cantidad_planchas + '</td><td>' + Number(m.metros_cuadrados).toFixed(2) + '</td></tr>').join('') + '</tbody></table></div>'
                            }
                        </div>
                    </div>
                </div>`;
        } catch(err) { page.innerHTML = '<div class="alert alert-danger">Error: ' + err.message + '</div>'; }
    }
};
