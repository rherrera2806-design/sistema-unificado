// ============================================================================
// Consumo y Autonomía — ahora en DOS vistas separadas:
//   1. Consumo por Meses  -> renderConsumo()  (consumo mensual por material)
//   2. Autonomía          -> renderAutonomia() (proyección de stock por material)
// Colores originales conservados; tipografía ORDENADA: escala fija
// (título 13 / header 11 / dato 12 / nota 10), números en formato es-CL
// (miles con punto, decimales con coma) y alineación consistente
// (texto izquierda, números derecha).
// ============================================================================

window.escText = window.escText || function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); };

const InvConsume = {
    _filtAuto: 0,
    _data: null,
    _queryConsumo: '',   // búsqueda de la vista Consumo por Meses

    // Formatos numéricos consistentes (es-CL: 1.234 · 2,4 · 1.188,00)
    fmtInt(v) { return Math.round(v || 0).toLocaleString('es-CL'); },
    fmtDec1(v) { return Number(v || 0).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); },
    fmtDec2(v) { return Number(v || 0).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },
    fmtKg(v) { return this.fmtInt(v); },

    // Carga los datos (apiJson lanza Error con el mensaje del body si !res.ok:
    // un 401/403/500 NO se confunde con "Sin datos")
    async _cargar() {
        const hdrs = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
        const res = await fetch('/api/inv/analytics?meses=6', { headers: hdrs });
        const analytics = await apiJson(res);
        const a = analytics || {};
        this._data = {
            consumo: a.consumoMensual || [],
            stock: a.stockActual || []
        };
        return this._data;
    },

    // ------------------------------------------------------------------
    // VISTA 1: Consumo por Meses (consumo mensual por material)
    // ------------------------------------------------------------------
    async renderConsumo() {
        const page = document.querySelector('.page.active');
        page.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray-400)">Cargando consumo...</div>';
        try {
            await this._cargar();
            page.innerHTML = `
                ${this._styles()}

                <div class="m-page">
                <div class="m-hero" style="padding:12px 16px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
                    <div style="position:relative;z-index:1">
                        <h2 style="margin:0;font-size:15px;font-weight:700;color:white">Consumo por Meses</h2>
                        <p style="margin:2px 0 0;font-size:11px;color:rgba(255,255,255,0.7)">Consumo mensual por material, mes a mes</p>
                    </div>
                    <input class="cc-search" type="text" id="ccBuscar" placeholder="Buscar material o espesor… (ej: laminado 10)"
                        value="${escAttr(this._queryConsumo)}" oninput="InvConsume.filtrarConsumo(this.value)">
                </div>

                <div class="m-card" style="margin-bottom:16px">
                    <div class="cc-card-title">Consumo mensual por material</div>
                    <div class="m-table-wrap inv-scroll-wrap" id="consumeTableWrap">${this._consumoHtml()}</div>
                </div>
                </div>`;
        } catch (err) {
            App.showAlert('Error al cargar consumo: ' + err.message, 'danger');
            page.innerHTML = '<div class="alert alert-danger">Error: ' + escText(err.message) + '</div>';
        }
    },

    // ------------------------------------------------------------------
    // VISTA 2: Autonomía (proyección de stock por material)
    // ------------------------------------------------------------------
    async renderAutonomia() {
        const page = document.querySelector('.page.active');
        page.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray-400)">Cargando autonomía...</div>';
        try {
            await this._cargar();
            page.innerHTML = `
                ${this._styles()}

                <div class="m-page">
                <div class="m-hero" style="padding:12px 16px">
                    <div style="position:relative;z-index:1">
                        <h2 style="margin:0;font-size:15px;font-weight:700;color:white">Autonomía</h2>
                        <p style="margin:2px 0 0;font-size:11px;color:rgba(255,255,255,0.7)">Proyección de stock por material</p>
                    </div>
                </div>

                <div class="m-card" style="margin-bottom:16px">
                    <div class="cc-card-title" style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap">
                        <span>Proyección de stock por material</span>
                        <div class="inv-filt-grupo">
                            <span class="cc-sub">Filtrar:</span>
                            ${[0, 1, 2, 3, 4, 5, 6].map(v => {
                                const labels = { 0: 'Todos', 1: '<1 mes', 2: '<2 meses', 3: '<3 meses', 4: '<4 meses', 5: '<5 meses', 6: '<6 meses' };
                                const activo = this._filtAuto === v;
                                return '<button type="button" class="inv-filt-btn c' + v + '" data-val="' + v + '" aria-pressed="' + activo + '" onclick="InvConsume.filtAuto(' + v + ')">' + labels[v] + '</button>';
                            }).join('')}
                        </div>
                    </div>
                    <div id="consumeProyWrap">${this._proyeccionHtml()}</div>
                </div>
                </div>`;
        } catch (err) {
            App.showAlert('Error al cargar autonomía: ' + err.message, 'danger');
            page.innerHTML = '<div class="alert alert-danger">Error: ' + escText(err.message) + '</div>';
        }
    },

    // Compatibilidad: la vista antigua "Consumo y Autonomía" abre Consumo por Meses
    render() { return this.renderConsumo(); },

    // ------------------------------------------------------------------
    // Estilos: escala tipográfica única y alineaciones consistentes
    // ------------------------------------------------------------------
    _styles() {
        return `
            <style>
                .cc-card-title{padding:12px 16px;font-size:13px;font-weight:600;color:var(--gray-800);border-bottom:1px solid var(--gray-100)}
                .cc-th{padding:9px 10px;font-size:11px;font-weight:600;color:var(--gray-500);border-bottom:2px solid var(--gray-200);white-space:nowrap}
                .cc-td{padding:8px 10px;font-size:12px;color:var(--gray-800);border-bottom:1px solid var(--gray-100)}
                .cc-num{text-align:right}
                .cc-sub{font-size:inherit;font-weight:400;color:var(--gray-400)}
                .cc-sticky{position:sticky;left:0;background:white;z-index:1}
                .cc-sticky-2{position:sticky;left:56px;background:white;z-index:1}
                .cc-total{font-weight:700;color:var(--primary);background:var(--gray-50)}
                .cc-prom{font-weight:600;color:var(--gray-600);background:var(--gray-50)}
                .inv-scroll-wrap{-webkit-overflow-scrolling:touch}
                .inv-scroll-wrap table{min-width:760px}
                .inv-scroll-wrap--wide table{min-width:1150px}
                .inv-scroll-wrap th:first-child,.inv-scroll-wrap td:first-child{box-shadow:1px 0 0 var(--gray-200)}
                .inv-filt-grupo{display:flex;gap:4px;align-items:center;font-size:11px;font-weight:600;flex-wrap:wrap}
                .cc-search{background:rgba(255,255,255,0.14);border:1px solid rgba(255,255,255,0.22);border-radius:8px;padding:8px 12px;color:white;font-size:12px;outline:none;min-width:220px;flex:1;max-width:300px}
                .cc-search::placeholder{color:rgba(255,255,255,0.5)}
                .cc-search:focus{border-color:rgba(255,255,255,0.5)}
                .inv-filt-btn{padding:5px 10px;border-radius:6px;border:1px solid var(--gray-200);cursor:pointer;font-size:11px;font-weight:600;background:white;color:var(--gray-600)}
                .inv-filt-btn[aria-pressed="true"]{color:white}
                .inv-filt-btn.c0[aria-pressed="true"]{background:var(--primary)}
                .inv-filt-btn.c1[aria-pressed="true"],.inv-filt-btn.c2[aria-pressed="true"]{background:var(--danger)}
                .inv-filt-btn.c3[aria-pressed="true"],.inv-filt-btn.c4[aria-pressed="true"]{background:var(--warning)}
                .inv-filt-btn.c5[aria-pressed="true"],.inv-filt-btn.c6[aria-pressed="true"]{background:var(--success)}
                @media(max-width:768px){
                    .inv-scroll-wrap{display:block!important}
                    .inv-scroll-wrap table{min-width:900px}
                    .inv-scroll-wrap--wide table{min-width:1150px}
                    .inv-scroll-wrap th,.inv-scroll-wrap td{padding:7px 6px}
                    .inv-filt-btn{min-height:32px;padding:6px 10px!important;font-size:11px!important}
                }
            </style>`;
    },

    // ------------------------------------------------------------------
    // Tabla: consumo mensual por material
    // ------------------------------------------------------------------
    _consumoHtml() {
        const consumo = this._data ? this._data.consumo : [];
        const monthNames = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        if (consumo.length === 0) return '<div style="text-align:center;padding:20px;color:var(--gray-400);font-size:12px">Sin datos</div>';

        const porMp = {};
        consumo.forEach(c => {
            const key = c.codigo_mp + '|' + (c.espesor_mm || '');
            if (!porMp[key]) porMp[key] = { codigo: c.codigo_mp, nombre: c.nombre, espesor: c.espesor_mm, meses: {} };
            porMp[key].meses[c.mes] = Number(c.planchas_consumidas);
        });
        const allMeses = [...new Set(consumo.map(c => c.mes))].sort();
        const rows = Object.entries(porMp).map(([key, data]) => {
            const total = Object.values(data.meses).reduce((s, v) => s + v, 0);
            const numMeses = Object.keys(data.meses).length || 1;
            const promedio = total / numMeses;
            return { codigo: data.codigo, nombre: data.nombre, espesor: data.espesor, meses: data.meses, total, promedio };
        });
        rows.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es') || (Number(a.espesor) || 0) - (Number(b.espesor) || 0));

        // Búsqueda multi-palabra: cada palabra debe coincidir en MATERIAL o
        // ESPESOR (el código no se muestra en el reporte, así que no interfiere).
        // Ejemplos: "laminado" muestra todos los Laminado; "laminado 10" filtra
        // material Y espesor. Sin importar acentos/mayúsculas.
        const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const tokens = norm(this._queryConsumo).split(/\s+/).filter(Boolean);
        let visibles = rows;
        if (tokens.length) {
            visibles = rows.filter(r => {
                const texto = norm(r.nombre) + ' ' + norm(r.espesor);
                return tokens.every(t => texto.includes(t));
            });
        }
        if (visibles.length === 0) {
            return '<div style="text-align:center;padding:20px;color:var(--gray-400);font-size:12px">Sin resultados para "<strong>' + escText(this._queryConsumo) + '</strong>"</div>';
        }

        return '<table style="width:100%;border-collapse:collapse"><thead><tr>'
            + '<th class="cc-th cc-sticky" style="text-align:left;min-width:150px">Material</th>'
            + '<th class="cc-th" style="text-align:left;min-width:52px">Esp.</th>'
            + allMeses.map(m => {
                const parts = m.split('-');
                return '<th class="cc-th cc-num" style="min-width:56px">' + monthNames[parseInt(parts[1])] + ' <span class="cc-sub">' + parts[0].slice(2) + '</span></th>';
            }).join('')
            + '<th class="cc-th cc-num" style="min-width:70px">Total</th>'
            + '<th class="cc-th cc-num" style="min-width:70px">Promedio</th>'
            + '</tr></thead><tbody>'
            + visibles.map(r => '<tr>'
                + '<td class="cc-td cc-sticky" style="font-weight:600">' + escText(r.nombre || '-') + '</td>'
                + '<td class="cc-td" style="color:var(--gray-600)">' + escText(r.espesor || '-') + '</td>'
                + allMeses.map(m => {
                    const val = r.meses[m] || 0;
                    return '<td class="cc-td cc-num" style="position:relative">'
                        + (val > 0 ? '<div style="position:absolute;top:0;left:2px;right:2px;bottom:0;background:var(--primary);opacity:0.08;border-radius:2px"></div>' : '')
                        + '<span style="position:relative;font-weight:600;color:' + (val > 0 ? 'var(--gray-800)' : 'var(--gray-300)') + '">' + (val > 0 ? InvConsume.fmtInt(val) : '-') + '</span></td>';
                }).join('')
                + '<td class="cc-td cc-num cc-total">' + InvConsume.fmtInt(r.total) + '</td>'
                + '<td class="cc-td cc-num cc-prom">' + InvConsume.fmtInt(r.promedio) + '</td>'
                + '</tr>').join('')
            + '</tbody></table>';
    },

    // ------------------------------------------------------------------
    // Tabla: proyección de stock (se re-pinta sola al filtrar, sin parpadear)
    // ------------------------------------------------------------------
    _proyeccionHtml() {
        const stock = this._data ? this._data.stock : [];
        const monthNames = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        if (stock.length === 0) return '<div style="text-align:center;padding:20px;color:var(--gray-400);font-size:12px">Sin datos</div>';

        const now = new Date();
        const meses = [];
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            meses.push({ key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), label: monthNames[d.getMonth() + 1], anio: String(d.getFullYear()).slice(2) });
        }
        const maxAuto = this._filtAuto || 0;
        let filtered = stock.filter(s => s.consumo_promedio > 0 || s.stock > 0 || Number(s.entradas) > 0);
        if (maxAuto > 0) filtered = filtered.filter(s => (s.autonomia_meses || 0) < maxAuto);
        // Orden: material y espesor ASCENDENTE (antes el espesor iba descendente)
        const sorted = filtered.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es') || (Number(a.espesor_mm) || 0) - (Number(b.espesor_mm) || 0));

        return '<div class="m-table-wrap inv-scroll-wrap inv-scroll-wrap--wide">'
            + '<table style="width:100%;border-collapse:collapse"><thead><tr>'
            + '<th class="cc-th cc-sticky" style="text-align:left;min-width:56px">SAP</th>'
            + '<th class="cc-th cc-sticky-2" style="text-align:left;min-width:110px">Material</th>'
            + '<th class="cc-th" style="text-align:left;min-width:44px">Esp.</th>'
            + '<th class="cc-th cc-num" style="min-width:56px">Stock</th>'
            + '<th class="cc-th cc-num" style="min-width:56px">Kg</th>'
            + '<th class="cc-th cc-num" style="min-width:70px">Cons. prom.</th>'
            + '<th class="cc-th cc-num" style="min-width:80px">Autonomía</th>'
            + meses.map(m => '<th class="cc-th cc-num" style="min-width:48px">' + m.label + ' <span class="cc-sub">' + m.anio + '</span></th>').join('')
            + '</tr></thead><tbody>'
            + sorted.map(s => {
                const stockRem = s.stock;
                const cpm = s.consumo_promedio || 0;
                const auto = s.autonomia_meses || 0;
                const autoColor = s.stock <= 0 ? 'var(--danger)' : auto < 2 ? 'var(--danger)' : auto < 4 ? 'var(--warning)' : 'var(--success)';
                return '<tr>'
                    + '<td class="cc-td cc-sticky" style="color:var(--gray-600)">' + escText(s.codigo_mp || '') + '</td>'
                    + '<td class="cc-td cc-sticky-2" style="font-weight:600">' + escText(s.nombre || '') + '</td>'
                    + '<td class="cc-td" style="color:var(--gray-600)">' + escText(s.espesor_mm || '') + '</td>'
                    + '<td class="cc-td cc-num" style="font-weight:700">' + InvConsume.fmtInt(stockRem) + '</td>'
                    + '<td class="cc-td cc-num" style="font-weight:600;color:var(--gray-600)">' + InvConsume.fmtKg(s.kg_stock) + '</td>'
                    + '<td class="cc-td cc-num" style="font-weight:600;color:var(--gray-600)">' + InvConsume.fmtInt(cpm) + '</td>'
                    + '<td class="cc-td cc-num"><span style="display:inline-block;padding:2px 8px;border-radius:8px;font-weight:700;background:' + autoColor + '15;color:' + autoColor + '">' + (auto > 0 ? InvConsume.fmtDec1(auto) + ' mes' : '-') + '</span></td>'
                    + meses.map((m, i) => {
                        const cpmVal = cpm || 0;
                        if (cpmVal <= 0) return '<td style="padding:8px 4px;border-left:1px solid var(--gray-100)"><div style="width:100%;height:22px;border-radius:3px"></div></td>';
                        const stockInicioMes = stockRem - (cpmVal * i);
                        const stockFinMes = stockInicioMes - cpmVal;
                        let bgStyle = '';
                        if (stockInicioMes <= 0) bgStyle = '';
                        else if (stockFinMes <= 0) bgStyle = 'background:repeating-linear-gradient(45deg,rgba(245,158,11,0.2),rgba(245,158,11,0.2) 3px,transparent 3px,transparent 6px)';
                        else bgStyle = 'background:repeating-linear-gradient(45deg,rgba(34,197,94,0.18),rgba(34,197,94,0.18) 3px,transparent 3px,transparent 6px)';
                        return '<td style="padding:8px 4px;border-left:1px solid var(--gray-100)"><div style="width:100%;height:22px;border-radius:3px;' + bgStyle + '"></div></td>';
                    }).join('')
                    + '</tr>';
            }).join('')
            + '</tbody></table></div>';
    },

    // Búsqueda de la vista Consumo por Meses (re-pinta solo la tabla)
    filtrarConsumo(v) {
        this._queryConsumo = v || '';
        const wrap = document.getElementById('consumeTableWrap');
        if (wrap) wrap.innerHTML = this._consumoHtml();
    },

    filtAuto(val) {
        this._filtAuto = val;
        // Re-pinta solo la tabla de proyección (sin parpadear todo el contenido)
        const wrap = document.getElementById('consumeProyWrap');
        if (wrap) {
            wrap.innerHTML = this._proyeccionHtml();
            // Refrescar el estado visual de los botones de filtro
            document.querySelectorAll('.inv-filt-btn').forEach(btn => {
                const v = parseInt(btn.getAttribute('data-val'));
                btn.setAttribute('aria-pressed', v === val ? 'true' : 'false');
            });
        } else {
            this.renderAutonomia();
        }
    }
};
