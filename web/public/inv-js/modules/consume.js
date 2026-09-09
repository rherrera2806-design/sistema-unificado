const InvConsume = {
    _filtAuto: 0,
    _data: null,

    fmtKg(v) { return Math.round(v || 0).toLocaleString('es-CL'); },

    async render() {
        const page = document.querySelector('.page.active');
        page.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray-400)">Cargando consumo...</div>';
        try {
            const hdrs = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const analytics = await fetch('/api/inv/analytics?meses=6', { headers: hdrs }).then(r => r.json()).catch(() => ({}));
            const a = analytics || {};
            this._data = {
                consumo: a.consumoMensual || [],
                stock: a.stockActual || []
            };
            this._renderContent(page);
        } catch(err) { page.innerHTML = '<div class="alert alert-danger">Error: ' + err.message + '</div>'; }
    },

    _renderContent(page) {
        const consumo = this._data ? this._data.consumo : [];
        const stock = this._data ? this._data.stock : [];
        const monthNames = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

        page.innerHTML = `
                <div style="width:100%">
                <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:24px;margin-bottom:20px;color:white">
                    <h2 style="margin:0;font-size:18px;font-weight:800">Consumo y Autonomia</h2>
                    <p style="margin:4px 0 0;font-size:12px;opacity:0.7">Analisis de consumo mensual y proyeccion de stock</p>
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
                        <span>Proyeccion de Stock por Material</span>
                        <div style="display:flex;gap:4px;align-items:center;font-size:10px;font-weight:600">
                            <span style="color:var(--gray-400);margin-right:4px">Filtrar ≤</span>
                            <button onclick="InvConsume.filtAuto(0)" class="inv-filt-btn" data-val="0" style="padding:3px 8px;border-radius:6px;border:1px solid var(--gray-200);background:${this._filtAuto===0?'var(--primary)':'white'};color:${this._filtAuto===0?'white':'var(--gray-600)'};cursor:pointer;font-size:10px;font-weight:600">Todos</button>
                            <button onclick="InvConsume.filtAuto(1)" class="inv-filt-btn" data-val="1" style="padding:3px 8px;border-radius:6px;border:1px solid var(--gray-200);background:${this._filtAuto===1?'var(--danger)':'white'};color:${this._filtAuto===1?'white':'var(--gray-600)'};cursor:pointer;font-size:10px;font-weight:600">&lt;1 mes</button>
                            <button onclick="InvConsume.filtAuto(2)" class="inv-filt-btn" data-val="2" style="padding:3px 8px;border-radius:6px;border:1px solid var(--gray-200);background:${this._filtAuto===2?'var(--danger)':'white'};color:${this._filtAuto===2?'white':'var(--gray-600)'};cursor:pointer;font-size:10px;font-weight:600">&lt;2 meses</button>
                            <button onclick="InvConsume.filtAuto(3)" class="inv-filt-btn" data-val="3" style="padding:3px 8px;border-radius:6px;border:1px solid var(--gray-200);background:${this._filtAuto===3?'var(--warning)':'white'};color:${this._filtAuto===3?'white':'var(--gray-600)'};cursor:pointer;font-size:10px;font-weight:600">&lt;3 meses</button>
                            <button onclick="InvConsume.filtAuto(4)" class="inv-filt-btn" data-val="4" style="padding:3px 8px;border-radius:6px;border:1px solid var(--gray-200);background:${this._filtAuto===4?'var(--warning)':'white'};color:${this._filtAuto===4?'white':'var(--gray-600)'};cursor:pointer;font-size:10px;font-weight:600">&lt;4 meses</button>
                            <button onclick="InvConsume.filtAuto(5)" class="inv-filt-btn" data-val="5" style="padding:3px 8px;border-radius:6px;border:1px solid var(--gray-200);background:${this._filtAuto===5?'var(--success)':'white'};color:${this._filtAuto===5?'white':'var(--gray-600)'};cursor:pointer;font-size:10px;font-weight:600">&lt;5 meses</button>
                            <button onclick="InvConsume.filtAuto(6)" class="inv-filt-btn" data-val="6" style="padding:3px 8px;border-radius:6px;border:1px solid var(--gray-200);background:${this._filtAuto===6?'var(--success)':'white'};color:${this._filtAuto===6?'white':'var(--gray-600)'};cursor:pointer;font-size:10px;font-weight:600">&lt;6 meses</button>
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
                                        + '<td style="padding:6px 10px;text-align:right;font-weight:600;color:var(--gray-600)">' + InvConsume.fmtKg(s.kg_stock) + '</td>'
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

    filtAuto(val) {
        this._filtAuto = val;
        const page = document.querySelector('.page.active');
        this._renderContent(page);
    }
};
