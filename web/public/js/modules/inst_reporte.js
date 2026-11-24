// ============================================================================
// Reporte de Instalaciones — familia visual "menos es más" (misma línea que
// Reporte de Reclamos y Pedidos):
//   · 3 bloques de lectura jerárquicos (¿Cuántas? / ¿Cómo se resuelven? / ¿Quién destaca?)
//   · Barras por mes con degradado + mes en curso en ámbar + meses en cero discretos
//   · Donut de estados con semántica (prog. azul · en curso ámbar · completadas
//     verde · novedades rojo · canceladas gris) y leyenda con números tabulares
//   · Rankings técnico/vendedor con degradado por peso (nombres UNIFICADOS por
//     la API: la normalización evita barras partidas por tildes/mayúsculas)
//   · Tendencia de completadas con línea de promedio punteada (SVG)
//   · Tipo de servicio con color propio por tipo
//   · Detalle mensual con pills de color y % éxito semáforo
// Reemplaza los gráficos Chart.js genéricos (paleta arcoíris) por gráficos CSS
// de la familia. Sin dependencias externas.
// ============================================================================
App.registerModule('inst_reporte', {
    reportData: null,
    anio: new Date().getFullYear(),
    _MESES_CORTOS: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
    // Colores semánticos de ESTADO (consistenres con el módulo de Instalaciones)
    _ESTADOS: [
        { campo: 'programadas', n: 'Programadas', c: '#3b82f6' },
        { campo: 'en_curso', n: 'En curso', c: '#f59e0b' },
        { campo: 'completadas', n: 'Completadas', c: '#16a34a' },
        { campo: 'novedades', n: 'Con novedades', c: '#dc2626' },
        { campo: 'canceladas', n: 'Canceladas', c: '#94a3b8' }
    ],
    // Colores de TIPO de servicio (identidad de cada tipo)
    _TIPOS: [
        { key: 'tipo_instalacion', n: 'Instalación', c: '#2563eb' },
        { key: 'tipo_visita', n: 'Visita técnica', c: '#7c3aed' },
        { key: 'tipo_postventa', n: 'Post-venta', c: '#f59e0b' }
    ],

    _fmtNum(v) { return Number(v || 0).toLocaleString('es-CL'); },
    _titulo(s) { return String(s || '').toLowerCase().split(' ').map(p => p ? p.charAt(0).toUpperCase() + p.slice(1) : p).join(' '); },

    async render() {
        const el = document.getElementById('page-inst_reporte');
        el.innerHTML = this._estilos() + `
            <div class="ir-hero">
                <div>
                    <h2>Reporte de Instalaciones</h2>
                    <p>Análisis mensual de trabajos en terreno</p>
                </div>
                <div class="ir-anio">
                    <button class="ir-nav" onclick="App.modules.inst_reporte.cambiarAnio(-1)" aria-label="Año anterior">‹</button>
                    <div><div class="lbl">Año</div><div class="val" id="irAnioLabel">${this.anio}</div></div>
                    <button class="ir-nav" onclick="App.modules.inst_reporte.cambiarAnio(1)" aria-label="Año siguiente">›</button>
                </div>
            </div>

            <div class="ir-blocks" id="irKpis"></div>

            <div class="ir-grid2">
                <div class="ir-panel">
                    <div class="ir-p-head"><h3>Instalaciones por mes</h3><span class="sub">${this.anio} · barra ámbar = mes en curso</span></div>
                    <div class="ir-p-body">
                        <div class="ir-meses" id="irMeses"></div>
                        <div class="ir-mlab" id="irMlab"></div>
                    </div>
                </div>
                <div class="ir-panel">
                    <div class="ir-p-head"><h3>Por estado</h3><span class="sub">situación actual</span></div>
                    <div class="ir-p-body">
                        <div class="ir-donut-wrap">
                            <div class="ir-donut" id="irDonut"><div class="in"><div class="t" id="irDonutTotal">0</div><div class="l">Total</div></div></div>
                            <div class="ir-legend" id="irLegend"></div>
                        </div>
                        <div class="ir-nota">Tasa de éxito = completadas sobre total del año · las novedades se resolvieron en terreno</div>
                    </div>
                </div>
            </div>

            <div class="ir-grid2b">
                <div class="ir-panel">
                    <div class="ir-p-head"><h3>Por técnico</h3><span class="sub">top 6 del año</span></div>
                    <div class="ir-p-body"><div class="ir-rank" id="irTecnicos"></div></div>
                </div>
                <div class="ir-panel">
                    <div class="ir-p-head"><h3>Por vendedor</h3><span class="sub">top 5 del año</span></div>
                    <div class="ir-p-body"><div class="ir-rank" id="irVendedores"></div></div>
                </div>
            </div>

            <div class="ir-grid2">
                <div class="ir-panel">
                    <div class="ir-p-head"><h3>Completadas por mes</h3><span class="sub">tendencia vs promedio</span></div>
                    <div class="ir-p-body">
                        <div class="ir-tend" id="irTend"></div>
                        <div class="ir-mlab" id="irTlab"></div>
                    </div>
                </div>
                <div class="ir-panel">
                    <div class="ir-p-head"><h3>Por tipo de servicio</h3><span class="sub">distribución del año</span></div>
                    <div class="ir-p-body"><div class="ir-rank" id="irTipos"></div></div>
                </div>
            </div>

            <div class="ir-panel">
                <div class="ir-p-head"><h3>Detalle mensual</h3><span class="sub">resumen por mes</span></div>
                <div id="irTabla"></div>
            </div>`;

        await this.loadData();
    },

    async loadData() {
        try {
            const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const res = await fetch(`/api/instalaciones/reporte?anio=${this.anio}`, { headers });
            if (!res.ok) {
                console.error('API error:', res.status);
                this.reportData = {
                    meses: Array(12).fill(null).map(() => ({ total: 0, programadas: 0, en_curso: 0, completadas: 0, novedades: 0, canceladas: 0 })),
                    tecnicos: [], vendedores: [], tipos: { tipo_instalacion: 0, tipo_visita: 0, tipo_postventa: 0 }, totalGeneral: 0
                };
            } else {
                this.reportData = await res.json();
            }
            this.renderKpis();
            this.renderMeses();
            this.renderEstado();
            this.renderRankings();
            this.renderTendencia();
            this.renderTabla();
        } catch (e) {
            console.error('Error reporte:', e);
            App.showAlert('Error al cargar el reporte: ' + e.message, 'danger');
        }
    },

    // ---------------- 3 bloques de lectura ----------------
    renderKpis() {
        const d = this.reportData;
        const total = d.totalGeneral || 0;
        const sum = (campo) => (d.meses || []).reduce((s, m) => s + (m[campo] || 0), 0);
        const completadas = sum('completadas');
        const novedades = sum('novedades');
        const canceladas = sum('canceladas');
        const tasa = total > 0 ? Math.round((completadas / total) * 100) : 0;
        const mesesActivos = (d.meses || []).filter(m => m.total > 0).length;
        const promedio = mesesActivos > 0 ? Math.round(total / mesesActivos) : 0;
        const topTec = (d.tecnicos || [])[0];
        const topVen = (d.vendedores || [])[0];
        // Tipo líder
        const tipoLider = this._TIPOS
            .map(t => ({ n: t.n, v: (d.tipos || {})[t.key] || 0 }))
            .sort((a, b) => b.v - a.v)[0];
        const chip = (cls, txt) => '<span class="ir-chip ' + cls + '">' + txt + '</span>';

        document.getElementById('irKpis').innerHTML = ''
            + '<div class="ir-block">'
            + '<div class="k">🔧 ¿Cuántas instalaciones?</div>'
            + '<div class="v">' + this._fmtNum(total) + '<small>en ' + this.anio + '</small></div>'
            + '<div class="chips">' + chip('', '<b>' + this._fmtNum(promedio) + '</b> promedio/mes')
            + chip('', '<b>' + mesesActivos + '</b> meses activos') + '</div></div>'
            + '<div class="ir-block">'
            + '<div class="k">✅ ¿Cómo se resuelven?</div>'
            + '<div class="v ir-green">' + tasa + '%<small>éxito</small></div>'
            + '<div class="chips">' + chip('g', '<b>' + this._fmtNum(completadas) + '</b> completadas')
            + chip('a', '<b>' + this._fmtNum(novedades) + '</b> con novedades')
            + chip('r', '<b>' + this._fmtNum(canceladas) + '</b> canceladas') + '</div></div>'
            + '<div class="ir-block">'
            + '<div class="k">🏆 ¿Quién destaca?</div>'
            + (topTec
                ? '<div class="v">' + this._fmtNum(topTec.total) + '<small>' + escText(this._titulo(topTec.nombre || 'Sin asignar')) + '</small></div>'
                : '<div class="v">0<small>sin datos</small></div>')
            + '<div class="chips">'
            + (topVen ? chip('a', 'Top vendedor: <b>' + escText(this._titulo(topVen.nombre || '—')) + '</b>') : '')
            + (tipoLider && tipoLider.v > 0 ? chip('', 'Tipo líder: <b>' + escText(tipoLider.n) + '</b>') : '')
            + '</div></div>';
    },

    // ---------------- Barras por mes (familia) ----------------
    renderMeses() {
        const d = this.reportData;
        const totales = (d.meses || []).map(m => m.total || 0);
        const max = Math.max(...totales, 1);
        const hoy = new Date();
        const esMesActual = (i) => (i === hoy.getMonth() && this.anio === hoy.getFullYear());

        document.getElementById('irMeses').innerHTML = totales.map((t, i) => {
            const cls = esMesActual(i) ? ' hoy' : (t === 0 ? ' cero' : '');
            return '<div class="ir-mcol"><div class="v">' + (t > 0 ? this._fmtNum(t) : '') + '</div>'
                + '<div class="ir-bar' + cls + '" style="height:' + (t > 0 ? Math.max(2, Math.round((t / max) * 100)) : 1) + '%"></div></div>';
        }).join('');
        document.getElementById('irMlab').innerHTML = this._MESES_CORTOS.map(m => '<span>' + m + '</span>').join('');
    },

    // ---------------- Donut de estados (semántica) ----------------
    renderEstado() {
        const d = this.reportData;
        const sum = (campo) => (d.meses || []).reduce((s, m) => s + (m[campo] || 0), 0);
        const partes = this._ESTADOS
            .map(e => ({ n: e.n, c: e.c, v: sum(e.campo) }))
            .filter(p => p.v > 0);
        const total = partes.reduce((s, p) => s + p.v, 0);

        let grados = 0;
        const tramos = partes.map(p => {
            const ini = grados;
            grados += total > 0 ? (p.v / total) * 360 : 0;
            return p.c + ' ' + ini + 'deg ' + grados + 'deg';
        });
        const fondo = total > 0 ? 'conic-gradient(' + tramos.join(',') + ')' : '#e4e9f0';
        document.getElementById('irDonut').style.background = fondo;
        document.getElementById('irDonutTotal').textContent = this._fmtNum(total);
        document.getElementById('irLegend').innerHTML = partes.length
            ? partes.map(p => '<div class="ir-lg"><span class="dot" style="background:' + p.c + '"></span>' + escText(p.n) + '<span class="n">' + this._fmtNum(p.v) + '</span></div>').join('')
            : '<div class="ir-vacio">Sin datos para este año</div>';
    },

    // ---------------- Rankings (nombres ya unificados por la API) ----------------
    renderRankings() {
        const d = this.reportData;

        // Técnicos: azul degradado por peso
        const tecnicos = (d.tecnicos || []).slice(0, 6);
        const totalTec = (d.tecnicos || []).reduce((s, t) => s + (t.total || 0), 0) || 1;
        document.getElementById('irTecnicos').innerHTML = this._rank(
            tecnicos.map(t => ({ nom: this._titulo(t.nombre), val: t.total })), totalTec, {}
        );

        // Vendedores: líder en azul fuerte, resto gris
        const vendedores = (d.vendedores || []).slice(0, 5);
        const totalVen = (d.vendedores || []).reduce((s, v) => s + (v.total || 0), 0) || 1;
        document.getElementById('irVendedores').innerHTML = this._rank(
            vendedores.map(v => ({ nom: this._titulo(v.nombre), val: v.total })), totalVen, { slate: true }
        );

        // Tipos: color propio por tipo + %
        const totalTipo = this._TIPOS.reduce((s, t) => s + ((d.tipos || {})[t.key] || 0), 0) || 1;
        const tipos = this._TIPOS
            .map(t => ({ nom: t.n, val: (d.tipos || {})[t.key] || 0, color: t.c }))
            .sort((a, b) => b.val - a.val);
        document.getElementById('irTipos').innerHTML = this._rank(tipos, totalTipo, { colors: true });
    },
    _rank(items, total, opts) {
        if (!items.length) return '<div class="ir-vacio">Sin datos para este año</div>';
        const max = Math.max(...items.map(i => i.val || 0), 1);
        const opacidades = [1, .75, .55, .45, .35, .3];
        return '<div class="ir-rank">' + items.map((it, i) => {
            const fillStyle = opts.colors
                ? 'width:' + Math.max(2, Math.round(((it.val || 0) / max) * 100)) + '%;background:' + it.color
                : 'width:' + Math.max(2, Math.round(((it.val || 0) / max) * 100)) + '%;' + (i > 0 ? 'opacity:' + opacidades[Math.min(i, 5)] : '');
            const cls = opts.colors ? '' : (opts.slate && i > 0 ? 'slate' : '');
            return '<div class="ir-ritem"><div class="top">'
                + '<span class="nm">' + (opts.colors ? '<span class="dot" style="background:' + it.color + '"></span>' : '') + escText(it.nom) + '</span>'
                + '<span class="vl">' + this._fmtNum(it.val) + '<span class="pct">' + Math.round(((it.val || 0) / total) * 100) + '%</span></span></div>'
                + '<div class="ir-track"><div class="ir-fill ' + cls + '" style="' + fillStyle + '"></div></div></div>';
        }).join('') + '</div>';
    },

    // ---------------- Tendencia de completadas (SVG) ----------------
    renderTendencia() {
        const d = this.reportData;
        const comp = (d.meses || []).map(m => m.completadas || 0);
        const max = Math.max(...comp, 1);
        const conDatos = comp.filter(v => v > 0);
        const prom = conDatos.length > 0 ? Math.round(conDatos.reduce((a, b) => a + b, 0) / conDatos.length) : 0;

        const W = 640, H = 150, PAD = 12;
        const x = (i) => PAD + (i * (W - 2 * PAD)) / 11;
        const y = (v) => H - PAD - (v / max) * (H - 2 * PAD);
        const pts = comp.map((v, i) => x(i) + ',' + y(v)).join(' ');

        let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">';
        if (conDatos.length > 0) {
            svg += '<line x1="' + PAD + '" y1="' + y(prom) + '" x2="' + (W - PAD) + '" y2="' + y(prom) + '" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="6 4"/>';
        }
        svg += '<polyline points="' + pts + '" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linejoin="round"/>';
        comp.forEach((v, i) => {
            svg += '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="3.5" fill="#16a34a" stroke="#fff" stroke-width="2"><title>' + this._MESES_CORTOS[i] + ': ' + this._fmtNum(v) + ' completadas</title></circle>';
        });
        svg += '</svg>';

        document.getElementById('irTend').innerHTML = svg;
        document.getElementById('irTlab').innerHTML = this._MESES_CORTOS.map(m => '<span>' + m + '</span>').join('');
    },

    // ---------------- Tabla mensual (pills + semáforo) ----------------
    renderTabla() {
        const d = this.reportData;
        const pill = (v, cls) => '<span class="ir-pill ' + cls + '">' + this._fmtNum(v) + '</span>';
        let rows = '';
        (d.meses || []).forEach((m, i) => {
            if (!m.total) return;
            const tasa = m.total > 0 ? Math.round(((m.completadas || 0) / m.total) * 100) : 0;
            const tCls = tasa >= 75 ? 'g' : tasa >= 50 ? 'a' : 'r';
            rows += '<tr>'
                + '<td class="mes-n">' + this._MESES_CORTOS[i] + '</td>'
                + '<td class="num">' + this._fmtNum(m.total) + '</td>'
                + '<td class="num">' + pill(m.programadas || 0, 'b') + '</td>'
                + '<td class="num">' + pill(m.en_curso || 0, 'a') + '</td>'
                + '<td class="num">' + pill(m.completadas || 0, 'g') + '</td>'
                + '<td class="num">' + pill(m.novedades || 0, 'r') + '</td>'
                + '<td class="num">' + pill(m.canceladas || 0, 's') + '</td>'
                + '<td class="num"><span class="ir-pill ' + tCls + '">' + tasa + '%</span></td>'
                + '</tr>';
        });

        document.getElementById('irTabla').innerHTML = rows
            ? '<table class="ir-mes"><thead><tr><th>Mes</th><th class="num">Total</th><th class="num">Programadas</th><th class="num">En curso</th><th class="num">Completadas</th><th class="num">Novedades</th><th class="num">Canceladas</th><th class="num">% Éxito</th></tr></thead><tbody>' + rows + '</tbody></table>'
            : '<div class="ir-vacio">Sin datos para este año</div>';
    },

    cambiarAnio(dir) {
        this.anio += dir;
        const lbl = document.getElementById('irAnioLabel');
        if (lbl) lbl.textContent = this.anio;
        this.loadData();
    },

    _estilos() {
        return `<style>
            .ir-hero{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 55%,#1e40af 100%);border-radius:16px;padding:20px 26px;display:flex;align-items:center;gap:14px;position:relative;overflow:hidden;margin-bottom:18px}
            .ir-hero::after{content:'';position:absolute;left:0;right:0;bottom:0;height:1px;background:linear-gradient(90deg,transparent,rgba(147,197,253,.55),transparent)}
            .ir-hero h2{color:#fff;font-size:15px;font-weight:700;margin:0}
            .ir-hero p{color:rgba(255,255,255,.62);font-size:11px;margin:2px 0 0}
            .ir-anio{margin-left:auto;display:flex;align-items:center;gap:10px}
            .ir-anio .lbl{font-size:10px;letter-spacing:.8px;text-transform:uppercase;color:rgba(255,255,255,.6);text-align:center}
            .ir-anio .val{font-size:20px;font-weight:700;color:#fff}
            .ir-nav{width:32px;height:32px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);color:#fff;cursor:pointer;font-size:13px}
            .ir-nav:hover{background:rgba(255,255,255,.2)}
            .ir-blocks{display:grid;grid-template-columns:1fr 1fr 1fr;gap:13px;margin-bottom:18px}
            .ir-block{background:#fff;border:1px solid #e4e9f0;border-radius:14px;padding:15px 18px}
            .ir-block .k{font-size:10px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase;color:#8494a8}
            .ir-block .v{font-size:38px;font-weight:800;line-height:1.05;margin-top:3px;letter-spacing:-.5px;color:#0f172a;font-variant-numeric:tabular-nums}
            .ir-block .v small{font-size:13px;font-weight:600;color:#8494a8;margin-left:4px;letter-spacing:0}
            .ir-block .chips{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}
            .ir-chip{font-size:10.5px;font-weight:700;background:#f1f5f9;color:#475569;padding:3px 10px;border-radius:20px;white-space:nowrap;font-variant-numeric:tabular-nums}
            .ir-chip b{color:#0f172a;font-weight:800}
            .ir-chip.g{background:#dcfce7;color:#15803d}
            .ir-chip.r{background:#fee2e2;color:#b91c1c}
            .ir-chip.a{background:#fef3c7;color:#b45309}
            .ir-green{color:#15803d!important}
            .ir-grid2{display:grid;grid-template-columns:1.25fr 1fr;gap:14px;margin-bottom:14px}
            .ir-grid2b{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
            .ir-panel{background:#fff;border:1px solid #e4e9f0;border-radius:14px;overflow:hidden;display:flex;flex-direction:column}
            .ir-p-head{padding:14px 18px 10px;display:flex;align-items:baseline;gap:8px;border-bottom:1px solid #e4e9f0}
            .ir-p-head h3{font-size:13px;font-weight:600;margin:0}
            .ir-p-head .sub{font-size:10px;color:#8494a8}
            .ir-p-body{padding:16px 18px;flex:1;display:flex;flex-direction:column}
            .ir-meses{display:flex;align-items:flex-end;gap:8px;height:170px;padding-top:14px;border-bottom:1px solid #e4e9f0}
            .ir-mcol{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:5px;height:100%}
            .ir-mcol .v{font-size:10.5px;font-weight:800;color:#475569;font-variant-numeric:tabular-nums}
            .ir-bar{width:70%;border-radius:7px 7px 0 0;background:linear-gradient(180deg,#3b82f6,#1e40af);min-height:3px}
            .ir-bar.cero{background:#e2e8f0}
            .ir-bar.hoy{background:linear-gradient(180deg,#f59e0b,#d97706)}
            .ir-mlab{display:flex;gap:8px;padding:6px 0 0}
            .ir-mlab span{flex:1;text-align:center;font-size:9.5px;color:#8494a8;font-weight:600}
            .ir-donut-wrap{display:flex;align-items:center;gap:22px;flex-wrap:wrap;row-gap:14px}
            .ir-donut{width:126px;height:126px;border-radius:50%;position:relative;flex-shrink:0}
            .ir-donut .in{position:absolute;inset:23px;background:#fff;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center}
            .ir-donut .in .t{font-size:22px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}
            .ir-donut .in .l{font-size:8.5px;letter-spacing:1px;text-transform:uppercase;color:#8494a8;margin-top:2px}
            .ir-legend{display:flex;flex-direction:column;gap:7px;flex:1;min-width:170px}
            .ir-lg{display:flex;align-items:center;gap:8px;font-size:11.5px;color:#334155;padding:5px 0}
            .ir-lg .dot{width:9px;height:9px;border-radius:50%}
            .ir-lg .n{margin-left:auto;font-weight:800;color:#0f172a;font-variant-numeric:tabular-nums}
            .ir-nota{font-size:10px;color:#8494a8;margin-top:12px;flex-shrink:0;line-height:1.5;border-top:1px dashed #e4e9f0;padding-top:10px}
            .ir-rank{display:flex;flex-direction:column;gap:11px;height:100%;justify-content:space-evenly}
            .ir-ritem .top{display:flex;justify-content:space-between;gap:10px;font-size:11.5px;margin-bottom:4px}
            .ir-ritem .nm{color:#334155;font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;gap:7px}
            .ir-ritem .nm .dot{width:9px;height:9px;border-radius:3px;flex-shrink:0}
            .ir-ritem .vl{font-weight:800;font-size:12px;color:#0f172a;font-variant-numeric:tabular-nums}
            .ir-ritem .pct{font-size:9.5px;color:#8494a8;margin-left:6px;font-weight:700}
            .ir-track{height:8px;border-radius:6px;background:#eef2f7;overflow:hidden}
            .ir-fill{height:100%;border-radius:6px;background:linear-gradient(90deg,#3b82f6,#1e40af)}
            .ir-fill.slate{background:#94a3b8}
            .ir-tend{padding:6px 0 0;flex:1;min-height:170px}
            .ir-tend svg{width:100%;height:170px;display:block}
            .ir-mes{width:100%;border-collapse:collapse}
            .ir-mes th{position:sticky;top:0;z-index:2;font-size:9px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#8494a8;text-align:left;padding:9px 12px;border-bottom:1px solid #e4e9f0;background:#f8fafc}
            .ir-mes td{font-size:11.5px;padding:9px 12px;border-bottom:1px solid #f4f7fb;color:#334155}
            .ir-mes tbody tr:hover{background:#f8fafc}
            .ir-mes th.num,.ir-mes td.num{text-align:right}
            .ir-mes td.mes-n{font-weight:700;color:#0f172a}
            .ir-pill{display:inline-flex;padding:2px 9px;border-radius:20px;font-size:9.5px;font-weight:800;font-variant-numeric:tabular-nums}
            .ir-pill.g{background:#dcfce7;color:#15803d}
            .ir-pill.a{background:#fef3c7;color:#b45309}
            .ir-pill.r{background:#fee2e2;color:#b91c1c}
            .ir-pill.b{background:#dbeafe;color:#1d4ed8}
            .ir-pill.s{background:#f1f5f9;color:#64748b}
            .ir-vacio{text-align:center;padding:26px 10px;color:#8494a8;font-size:11px}
            @media(max-width:768px){
                .ir-hero{padding:16px}
                .ir-hero h2{font-size:13px}
                .ir-blocks{grid-template-columns:1fr;gap:8px}
                .ir-block{padding:12px 14px}
                .ir-block .v{font-size:28px}
                .ir-grid2,.ir-grid2b{grid-template-columns:1fr}
                .ir-mes th,.ir-mes td{padding:7px 8px}
            }
        </style>`;
    }
});
