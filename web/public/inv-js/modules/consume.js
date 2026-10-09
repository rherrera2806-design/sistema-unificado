// ============================================================================
// Consumo y Autonomía — lenguaje visual "hoja tecnica de vidrio" (css/inv-pro.css)
// COLOR = SIGNIFICADO: datos neutros; solo se colorea lo que exige una decision.
// ============================================================================
const InvConsume = {
    _filtAuto: 0,
    _data: null,

    fmtKg(v) { return Math.round(v || 0).toLocaleString('es-CL'); },

    async render() {
        const page = document.querySelector('.page.active');
        page.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray-400)">Cargando consumo...</div>';
        try {
            const hdrs = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const res = await fetch('/api/inv/analytics?meses=6', { headers: hdrs });
            // apiJson lanza Error con el mensaje del body si !res.ok:
            // un 401/403/500 NO se confunde con "Sin datos"
            const analytics = await apiJson(res);
            const a = analytics || {};
            this._data = {
                consumo: a.consumoMensual || [],
                stock: a.stockActual || []
            };
            this._renderContent(page);
        } catch(err) {
            // Error visible en vez de las tablas con "Sin datos"
            App.showAlert('Error al cargar consumo: ' + err.message, 'danger');
            page.innerHTML = '<div class="inv-pro"><div class="alert alert-danger">Error: ' + escText(err.message) + '</div></div>';
        }
    },

    _renderContent(page) {
        const consumo = this._data ? this._data.consumo : [];
        const stock = this._data ? this._data.stock : [];
        const monthNames = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

        page.innerHTML = `
                <style>
                    /* Matrices con scroll horizontal comodo en movil (sin duplicarlas como cards) */
                    .inv-scroll-wrap{-webkit-overflow-scrolling:touch}
                    .inv-scroll-wrap table{min-width:760px}
                    .inv-scroll-wrap--wide table{min-width:1150px}
                    /* Columnas fijas de las matrices (legibilidad al hacer scroll) */
                    .inv-scroll-wrap .fcol1{position:sticky;left:0;z-index:1;background:#fff;box-shadow:1px 0 0 var(--invp-line)}
                    .inv-scroll-wrap .fcol2{position:sticky;left:88px;z-index:1;background:#fff}
                    .inv-scroll-wrap th.fcol1,.inv-scroll-wrap th.fcol2{background:#fbfcfe;z-index:2}
                    .inv-scroll-wrap--wide th.fcol1{min-width:88px}
                    .inv-pro .invp-sutil{color:var(--invp-slate);font-weight:400}
                    /* La regla base de td pinta slate; estas variantes ganan por especificidad */
                    .inv-pro .invp-table td.invp-danger{color:var(--invp-danger);font-weight:600}
                    .inv-pro .invp-table td.invp-warn{color:var(--invp-warn);font-weight:600}
                    .inv-filt-grupo{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
                    @media(max-width:768px){
                        .inv-scroll-wrap{display:block!important}
                        .inv-scroll-wrap table{min-width:900px;font-size:11px}
                        .inv-scroll-wrap--wide table{min-width:1150px}
                        .inv-scroll-wrap th,.inv-scroll-wrap td{padding:8px 6px}
                        .inv-filt-grupo .invp-btn{min-height:36px}
                    }
                </style>

                <div class="inv-pro">
                    <div class="invp-hero">
                        <div>
                            <h2>Consumo y Autonomía</h2>
                            <p>Análisis de consumo mensual y proyección de stock</p>
                        </div>
                    </div>

                    <div class="invp-card" style="margin-bottom:14px">
                        <div class="invp-card-head">
                            <h3>Consumo mensual por material</h3>
                        </div>
                        <div class="m-table-wrap inv-scroll-wrap">
                            ${consumo.length === 0 ? '<div class="invp-sutil" style="text-align:center;padding:20px;font-size:12px">Sin datos</div>' :
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
                                rows.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '') || (a.espesor || '').localeCompare(b.espesor || ''));
                                // Matriz tipografica invp-table: mono en numeros, sin color por celda
                                return '<table class="invp-table"><thead><tr>'
                                    + '<th class="fcol1">Material</th>'
                                    + '<th class="num">Esp.</th>'
                                    + allMeses.map(m => {
                                        const parts = m.split('-');
                                        return '<th class="num">' + monthNames[parseInt(parts[1])] + '<br><span class="invp-sutil" style="font-size:9px">' + parts[0].slice(2) + '</span></th>';
                                    }).join('')
                                    + '<th class="num">Total</th>'
                                    + '<th class="num">Prom.</th>'
                                    + '</tr></thead><tbody>'
                                    + rows.map(r => '<tr>'
                                        + '<td class="tipo fcol1">' + escText(r.nombre || '-') + '</td>'
                                        + '<td class="num invp-mono sutil">' + escText(r.espesor != null ? r.espesor : '-') + '</td>'
                                        + allMeses.map(m => {
                                            const val = r.meses[m] || 0;
                                            return '<td class="num invp-mono ' + (val > 0 ? 'valor' : 'sutil') + '">' + (val > 0 ? Math.round(val) : '—') + '</td>';
                                        }).join('')
                                        + '<td class="num invp-mono valor">' + Math.round(r.total) + '</td>'
                                        + '<td class="num invp-mono sutil">' + Math.round(r.promedio) + '</td>'
                                        + '</tr>').join('')
                                    + '</tbody></table>';
                            })()}
                        </div>
                    </div>

                    <div class="invp-card" style="margin-bottom:14px">
                        <div class="invp-card-head" style="flex-wrap:wrap">
                            <h3>Proyección de stock por material</h3>
                            <div class="inv-filt-grupo">
                                <span class="invp-lbl" style="margin:0 2px 0 0">Filtrar ≤</span>
                                <button class="invp-btn invp-btn-filter" aria-pressed="${this._filtAuto===0}" onclick="InvConsume.filtAuto(0)">Todos</button>
                                <button class="invp-btn invp-btn-filter" aria-pressed="${this._filtAuto===1}" onclick="InvConsume.filtAuto(1)">&lt;1 mes</button>
                                <button class="invp-btn invp-btn-filter" aria-pressed="${this._filtAuto===2}" onclick="InvConsume.filtAuto(2)">&lt;2 meses</button>
                                <button class="invp-btn invp-btn-filter" aria-pressed="${this._filtAuto===3}" onclick="InvConsume.filtAuto(3)">&lt;3 meses</button>
                                <button class="invp-btn invp-btn-filter" aria-pressed="${this._filtAuto===4}" onclick="InvConsume.filtAuto(4)">&lt;4 meses</button>
                                <button class="invp-btn invp-btn-filter" aria-pressed="${this._filtAuto===5}" onclick="InvConsume.filtAuto(5)">&lt;5 meses</button>
                                <button class="invp-btn invp-btn-filter" aria-pressed="${this._filtAuto===6}" onclick="InvConsume.filtAuto(6)">&lt;6 meses</button>
                            </div>
                        </div>
                        <div class="m-table-wrap inv-scroll-wrap inv-scroll-wrap--wide">
                            ${stock.length === 0 ? '<div class="invp-sutil" style="text-align:center;padding:20px;font-size:12px">Sin datos</div>' :
                            (() => {
                                const now = new Date();
                                const meses = [];
                                for (let i = 0; i < 12; i++) {
                                    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
                                    meses.push({ key: d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'), label: monthNames[d.getMonth()+1], anio: String(d.getFullYear()).slice(2) });
                                }
                                const maxAuto = this._filtAuto || 0;
                                let filtered = stock.filter(s => s.consumo_promedio > 0 || s.stock > 0 || Number(s.entradas) > 0);
                                if (maxAuto > 0) filtered = filtered.filter(s => (s.autonomia_meses || 0) < maxAuto);
                                const sorted = filtered.sort((a,b) => (a.nombre || '').localeCompare(b.nombre || '') || (Number(b.espesor_mm) || 0) - (Number(a.espesor_mm) || 0));
                                return '<table class="invp-table"><thead><tr>'
                                    + '<th class="fcol1">SAP</th>'
                                    + '<th class="fcol2">Material</th>'
                                    + '<th class="num">Esp.</th>'
                                    + '<th class="num">Stock</th>'
                                    + '<th class="num">Kg</th>'
                                    + '<th class="num">Cons. prom.</th>'
                                    + '<th class="num">Autonomía (mes)</th>'
                                    + meses.map(m => '<th class="num">' + m.label + '<br><span class="invp-sutil" style="font-size:9px">' + m.anio + '</span></th>').join('')
                                    + '</tr></thead><tbody>'
                                    + sorted.map(s => {
                                        const stockRem = s.stock;
                                        const cpm = s.consumo_promedio || 0;
                                        const auto = s.autonomia_meses || 0;
                                        // COLOR = SIGNIFICADO: solo la autonomia baja se colorea, y solo en su celda
                                        const autoCls = s.stock <= 0 || auto < 2 ? 'invp-danger' : auto < 4 ? 'invp-warn' : 'valor';
                                        return '<tr>'
                                            + '<td class="codigo invp-mono fcol1">' + escText(s.codigo_mp || '') + '</td>'
                                            + '<td class="tipo fcol2">' + escText(s.nombre || '') + '</td>'
                                            + '<td class="num invp-mono sutil">' + escText(s.espesor_mm != null ? s.espesor_mm : '') + '</td>'
                                            + '<td class="num invp-mono valor">' + Math.round(stockRem) + '</td>'
                                            + '<td class="num invp-mono sutil">' + InvConsume.fmtKg(s.kg_stock) + '</td>'
                                            + '<td class="num invp-mono sutil">' + Math.round(cpm) + '</td>'
                                            + '<td class="num invp-mono ' + autoCls + '">' + (auto > 0 ? auto.toFixed(1) : '—') + '</td>'
                                            + meses.map((m, i) => {
                                                const cpmVal = cpm || 0;
                                                if (cpmVal <= 0) return '<td></td>';
                                                const stockInicioMes = stockRem - (cpmVal * i);
                                                const stockFinMes = stockInicioMes - cpmVal;
                                                // Bandas de proyeccion en tonos NEUTROS (sin color por celda):
                                                // llena = mes cubierto, tenue = mes en que se agota, vacia = sin stock
                                                let bgStyle = '';
                                                if (stockInicioMes > 0 && stockFinMes <= 0) bgStyle = 'background:repeating-linear-gradient(45deg,rgba(100,116,139,.08),rgba(100,116,139,.08) 3px,transparent 3px,transparent 6px)';
                                                else if (stockInicioMes > 0) bgStyle = 'background:repeating-linear-gradient(45deg,rgba(100,116,139,.16),rgba(100,116,139,.16) 3px,transparent 3px,transparent 6px)';
                                                return '<td><div style="width:100%;height:22px;border-radius:3px;' + bgStyle + '"></div></td>';
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
