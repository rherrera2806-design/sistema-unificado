// ============================================================================
// Reporte de Reclamos — lenguaje visual del sistema (hero azul, KPIs neutros,
// color SOLO con significado: verde = resuelto, rojo = pérdida/rechazado,
// ámbar = pendiente, azul = en revisión). Escala tipográfica 20/15/13/11/10,
// números es-CL (miles con punto), ejes en unidades enteras.
// Gráficos CSS puros (sin Chart.js): barras y donut conic-gradient.
// ============================================================================
App.registerModule('reclamos_reporte', {
    reportData: null,
    anio: new Date().getFullYear(),

    _fmtNum(v) { return Number(v || 0).toLocaleString('es-CL'); },
    _fmtCLP(v) { return '$' + Number(Math.round(v || 0)).toLocaleString('es-CL'); },
    // Presentacion normalizada: los datos suelen venir en MAYUSCULAS
    // (como se escribieron). Se capitalizan SIN inventar acentos.
    _titulo(s) { return String(s || '').toLowerCase().split(' ').map(p => p ? p.charAt(0).toUpperCase() + p.slice(1) : p).join(' '); },
    _frase(s) { const t = String(s || '').toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); },
    _etiquetaResolucion(r) {
        const mapa = {
            'Aceptada Fabricacion nueva': 'Aceptada · Fabricación nueva',
            'Aceptada Reproceso': 'Aceptada · Reproceso',
            'Rechazada': 'Rechazadas',
            'Sin resolver': 'Sin resolver'
        };
        return mapa[r] || r;
    },

    async render() {
        const el = document.getElementById('page-reclamos_reporte');
        el.innerHTML = `
            <style>
                .rq-hero{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 55%,#1e40af 100%);border-radius:16px;padding:20px 26px;display:flex;align-items:center;gap:14px;position:relative;overflow:hidden;margin-bottom:18px}
                .rq-hero::after{content:'';position:absolute;left:0;right:0;bottom:0;height:1px;background:linear-gradient(90deg,transparent,rgba(147,197,253,.55),transparent)}
                .rq-hero h2{color:#fff;font-size:15px;font-weight:700;margin:0}
                .rq-hero p{color:rgba(255,255,255,.62);font-size:11px;margin:2px 0 0}
                .rq-anio{margin-left:auto;display:flex;align-items:center;gap:10px}
                .rq-anio .lbl{font-size:10px;letter-spacing:.8px;text-transform:uppercase;color:rgba(255,255,255,.6);text-align:center}
                .rq-anio .val{font-size:20px;font-weight:700;color:#fff}
                .rq-nav{width:32px;height:32px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);color:#fff;cursor:pointer;font-size:13px}
                .rq-nav:hover{background:rgba(255,255,255,.2)}
                .rq-blocks{display:grid;grid-template-columns:1fr 1fr 1fr;gap:13px;margin-bottom:18px}
                .rq-block{background:#fff;border:1px solid var(--invp-line,#e4e9f0);border-radius:14px;padding:15px 18px}
                .rq-block .k{font-size:10px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase;color:var(--invp-muted,#8494a8)}
                .rq-block .v{font-size:40px;font-weight:800;line-height:1.05;margin-top:3px;letter-spacing:-.5px;color:var(--invp-ink,#0f172a)}
                .rq-block .v small{font-size:14px;font-weight:600;color:var(--invp-muted,#8494a8);margin-left:4px;letter-spacing:0}
                .rq-block .chips{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}
                .rq-chip{font-size:10.5px;font-weight:700;background:#f1f5f9;color:#475569;padding:3px 10px;border-radius:20px;white-space:nowrap;font-variant-numeric:tabular-nums}
                .rq-chip b{color:#0f172a;font-weight:800}
                .rq-chip.g{background:#dcfce7;color:#15803d}
                .rq-chip.r{background:#fee2e2;color:#b91c1c}
                .rq-chip.a{background:#fef3c7;color:#b45309}
                .rq-green{color:var(--invp-green,#15803d)!important}
                .rq-red{color:var(--invp-danger,#dc2626)!important}
                .rq-grid2{display:grid;grid-template-columns:1.25fr 1fr;gap:14px;margin-bottom:14px}
                .rq-grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px}
                .rq-panel{background:#fff;border:1px solid var(--invp-line,#e4e9f0);border-radius:14px;overflow:hidden;display:flex;flex-direction:column}
                .rq-p-head{padding:14px 18px 10px;display:flex;align-items:baseline;gap:8px;border-bottom:1px solid var(--invp-line,#e4e9f0)}
                .rq-p-head h3{font-size:13px;font-weight:600;margin:0}
                .rq-p-head .sub{font-size:10px;color:var(--invp-muted,#8494a8)}
                .rq-p-body{padding:16px 18px;flex:1}
                /* Gráficos que LLENAN la tarjeta: el área de barras se posiciona
                   absoluta dentro del cuerpo (altura definida) para que los
                   porcentajes de alto de las barras resuelvan siempre. */
                .rq-p-body.rq-chart-body{position:relative;min-height:210px}
                .rq-chart-body .rq-bars-row{position:absolute;inset:16px 18px 52px;display:flex;gap:8px;align-items:stretch}
                .rq-chart-body > .rq-bars{position:absolute;inset:16px 18px}
                .rq-chart-body .rq-bars{flex:1;height:auto;display:flex;align-items:flex-end;gap:8px}
                .rq-chart-body .rq-yaxis{height:auto;align-self:stretch;width:26px;flex:none;align-items:flex-end}
                .rq-chart-body .rq-months{position:absolute;left:18px;right:18px;bottom:30px;display:flex;gap:8px;padding-left:34px}
                .rq-chart-body .rq-months span{flex:1;text-align:center;font-size:10px;color:var(--invp-muted,#8494a8)}
                .rq-chart-body .rq-nota{position:absolute;left:18px;right:18px;bottom:12px;margin:0}
                .rq-bars{display:flex;align-items:flex-end;gap:8px;height:170px;padding-top:14px;flex:1;min-width:0}
                .rq-bar-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end}
                .rq-bar{width:100%;max-width:38px;background:linear-gradient(180deg,#3b82f6,#1e40af);border-radius:7px 7px 0 0;position:relative;min-height:3px}
                .rq-bar.gris{background:#cbd5e1}
                .rq-bar.cero{background:#eef2f7}
                .rq-bar.oscuro{background:linear-gradient(180deg,#f59e0b,#d97706)}
                .rq-bar .n{position:absolute;top:-18px;left:0;right:0;text-align:center;font-size:10.5px;font-weight:800;color:#475569;font-variant-numeric:tabular-nums}
                .rq-bar-col .m{font-size:10px;color:var(--invp-muted,#8494a8)}
                .rq-bars-row{display:flex;gap:8px}
                .rq-yaxis{display:flex;flex-direction:column;justify-content:space-between;font-size:10px;color:var(--invp-muted,#8494a8);height:184px;padding-top:14px;line-height:1}
                .rq-donut-wrap{display:flex;align-items:center;gap:22px;flex-wrap:wrap}
                .rq-donut{width:150px;height:150px;border-radius:50%;position:relative;flex-shrink:0}
                .rq-donut::after{content:'';position:absolute;inset:27px;background:#fff;border-radius:50%}
                .rq-donut .c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:1}
                .rq-donut .c .n{font-size:26px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}
                .rq-donut .c .l{font-size:8.5px;letter-spacing:1px;text-transform:uppercase;color:var(--invp-muted,#8494a8)}
                .rq-legend{display:flex;flex-direction:column;gap:9px;flex:1;min-width:170px}
                .rq-lg{display:flex;align-items:center;gap:8px;font-size:11.5px;color:#334155}
                .rq-lg .dot{width:9px;height:9px;border-radius:50%}
                .rq-lg .n{margin-left:auto;font-weight:800;color:var(--invp-ink,#0f172a);font-variant-numeric:tabular-nums}
                .rq-rank{display:flex;flex-direction:column;gap:11px;height:100%;justify-content:space-evenly}
                .rq-ritem .top{display:flex;justify-content:space-between;gap:10px;font-size:11.5px;margin-bottom:4px}
                .rq-ritem .nm{color:#334155;font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
                .rq-ritem .vl{font-weight:800;font-size:12px;color:var(--invp-ink,#0f172a);font-variant-numeric:tabular-nums}
                .rq-track{height:8px;border-radius:6px;background:#eef2f7;overflow:hidden}
                .rq-fill{height:100%;border-radius:6px;background:linear-gradient(90deg,#3b82f6,#1e40af)}
                .rq-fill.green{background:linear-gradient(90deg,#22c55e,#16a34a)}
                .rq-fill.amber{background:linear-gradient(90deg,#f59e0b,#d97706)}
                .rq-fill.red{background:linear-gradient(90deg,#ef4444,#b91c1c)}
                .rq-fill.slate{background:#94a3b8}
                .rq-nota{font-size:10px;color:var(--invp-muted,#8494a8);margin-top:10px}
                .rq-mes{width:100%;border-collapse:collapse}
                .rq-mes th{position:sticky;top:0;z-index:2;font-size:9px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:var(--invp-muted,#8494a8);text-align:left;padding:9px 12px;border-bottom:1px solid var(--invp-line,#e4e9f0);background:#f8fafc}
                .rq-mes td{font-size:11.5px;padding:9px 12px;border-bottom:1px solid #f4f7fb;color:#334155}
                .rq-mes tbody tr:hover{background:#f8fafc}
                .rq-mes th.num,.rq-mes td.num{text-align:right}
                .rq-mes td.mes-n{font-weight:700;color:var(--invp-ink,#0f172a)}
                .rq-mes tfoot td{font-weight:800;color:var(--invp-ink,#0f172a);background:#f8fafc;border-bottom:none}
                .rq-badge{display:inline-flex;padding:2px 9px;border-radius:20px;font-size:9.5px;font-weight:800;font-variant-numeric:tabular-nums}
                .rq-b-amber{color:#b45309;background:#fef3c7}
                .rq-b-blue{color:#1d4ed8;background:#dbeafe}
                .rq-b-green{color:#15803d;background:#dcfce7}
                @media(max-width:768px){
                    .rq-hero{padding:16px}
                    .rq-hero h2{font-size:13px}
                    .rq-blocks{grid-template-columns:1fr;gap:8px}
                    .rq-block{padding:12px 14px}
                    .rq-block .v{font-size:28px}
                    .rq-grid2,.rq-grid3{grid-template-columns:1fr}
                    .rq-p-body.rq-chart-body{min-height:180px}
                    .rq-mes th,.rq-mes td{padding:7px 8px}
                }
            </style>

            <div class="rq-hero">
                <div>
                    <h2>Reporte de Reclamos</h2>
                    <p>Análisis mensual de reclamos y devoluciones</p>
                </div>
                <div class="rq-anio">
                    <button class="rq-nav" onclick="App.modules.reclamos_reporte.cambiarAnio(-1)" aria-label="Año anterior">‹</button>
                    <div><div class="lbl">Año</div><div class="val" id="rrAnioLabel">${this.anio}</div></div>
                    <button class="rq-nav" onclick="App.modules.reclamos_reporte.cambiarAnio(1)" aria-label="Año siguiente">›</button>
                </div>
            </div>

            <div class="rq-blocks" id="rrKpis"></div>
            <div class="rq-grid2">
                <div class="rq-panel">
                    <div class="rq-p-head"><h3>Reclamos por mes</h3><span class="sub">${this.anio} · conteo de ingresos</span></div>
                    <div class="rq-p-body rq-chart-body" id="rrChartMes"></div>
                </div>
                <div class="rq-panel">
                    <div class="rq-p-head"><h3>Por estado</h3><span class="sub">situación actual</span></div>
                    <div class="rq-p-body" id="rrChartEstado"></div>
                </div>
            </div>
            <div class="rq-grid3">
                <div class="rq-panel">
                    <div class="rq-p-head"><h3>Resoluciones</h3></div>
                    <div class="rq-p-body" id="rrResoluciones"></div>
                </div>
                <div class="rq-panel">
                    <div class="rq-p-head"><h3>Principales motivos</h3></div>
                    <div class="rq-p-body" id="rrMotivos"></div>
                </div>
                <div class="rq-panel">
                    <div class="rq-p-head"><h3>Clientes con más reclamos</h3></div>
                    <div class="rq-p-body" id="rrClientes"></div>
                </div>
            </div>
            <div class="rq-grid2">
                <div class="rq-panel">
                    <div class="rq-p-head"><h3>Pérdida por responsable de falla</h3><span class="sub">costo en pesos</span></div>
                    <div class="rq-p-body" id="rrCostoResp"></div>
                </div>
                <div class="rq-panel">
                    <div class="rq-p-head"><h3>Ingresos por día de semana</h3><span class="sub">cuándo se reportan los reclamos</span></div>
                    <div class="rq-p-body rq-chart-body" id="rrDias"></div>
                </div>
            </div>
            <div class="rq-panel">
                <div class="rq-p-head"><h3>Detalle mensual</h3><span class="sub">resumen por mes</span></div>
                <div id="rrTabla"></div>
            </div>`;

        await this.loadData();
    },

    async loadData() {
        try {
            const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const res = await fetch(`/api/reclamos/reporte?anio=${this.anio}`, { headers });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                // Error VISIBLE: antes se mostraban ceros en silencio
                App.showAlert('Error al cargar el reporte: ' + (err.error || ('HTTP ' + res.status)), 'danger');
                this.reportData = { meses: [], responsables: [], motivos: [], resoluciones: [], clientes: [], costoPorResponsable: [], diasSemana: [], totalGeneral: 0, totalFinalizados: 0, costoTotal: 0 };
            } else {
                this.reportData = await res.json();
            }
            this.renderKpis();
            this.renderChartMes();
            this.renderChartEstado();
            this.renderRankings();
            this.renderTabla();
        } catch (e) {
            console.error('Error reporte reclamos:', e);
            App.showAlert('Error al cargar el reporte: ' + e.message, 'danger');
        }
    },

    // ---------------- KPIs neutros (color solo en el valor con significado) ----------------
    // ---------------- 3 bloques de lectura (antes 5 KPI cards iguales) ----------------
    renderKpis() {
        const d = this.reportData;
        const total = d.totalGeneral || 0;
        const finalizados = d.totalFinalizados || 0;
        const tasa = total > 0 ? Math.round((finalizados / total) * 100) : 0;
        const mesesActivos = (d.meses || []).filter(m => m.total > 0).length;
        const promedio = mesesActivos > 0 ? Math.round(total / mesesActivos) : 0;
        const costo = d.costoTotal || 0;
        const costoProm = mesesActivos > 0 ? Math.round(costo / mesesActivos) : 0;
        const sum = (campo) => (d.meses || []).reduce((s, m) => s + (m[campo] || 0), 0);
        const fabNueva = sum('fab_nueva'), reproceso = sum('reproceso'), rechazadas = sum('rechazadas');
        const mayorResp = (d.costoPorResponsable || [])[0];
        const chip = (cls, txt) => '<span class="rq-chip ' + cls + '">' + txt + '</span>';

        document.getElementById('rrKpis').innerHTML = ''
            // ¿Cuántos reclamos?
            + '<div class="rq-block">'
            + '<div class="k">📊 ¿Cuántos reclamos?</div>'
            + '<div class="v">' + this._fmtNum(total) + '<small>en ' + this.anio + '</small></div>'
            + '<div class="chips">' + chip('', '<b>' + this._fmtNum(promedio) + '</b> promedio/mes')
            + chip('', '<b>' + mesesActivos + '</b> meses activos') + '</div></div>'
            // ¿Cuánto cuesta?
            + '<div class="rq-block">'
            + '<div class="k">💰 ¿Cuánto cuesta?</div>'
            + '<div class="v rq-red">' + this._fmtCLP(costo) + '</div>'
            + '<div class="chips">' + chip('r', '<b>' + this._fmtCLP(costoProm) + '</b> promedio/mes')
            + (mayorResp ? chip('a', 'Mayor: ' + escText(this._titulo(mayorResp.nombre || 'Sin asignar'))) : '') + '</div></div>'
            // ¿Cómo se resuelve?
            + '<div class="rq-block">'
            + '<div class="k">✅ ¿Cómo se resuelve?</div>'
            + '<div class="v rq-green">' + tasa + '%<small>resuelto</small></div>'
            + '<div class="chips">' + chip('g', '<b>' + this._fmtNum(fabNueva) + '</b> fabricación nueva')
            + chip('g', '<b>' + this._fmtNum(reproceso) + '</b> reproceso')
            + chip('r', '<b>' + this._fmtNum(rechazadas) + '</b> rechazadas') + '</div></div>';
    },

    // ---------------- Gráfico de barras mensual (eje entero) ----------------
    renderChartMes() {
        const d = this.reportData;
        const mesesCortos = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const totales = (d.meses || []).map(m => m.total || 0);
        const maxDato = Math.max(...totales, 1);
        // Eje en unidades enteras: paso tal que el eje no pase de ~6 etiquetas
        // (11 etiquetas amontonadas se traslapaban con los meses)
        let paso = maxDato <= 8 ? 2 : 4;
        while (Math.ceil(maxDato / paso) > 5) paso += 2;
        const maxEje = Math.ceil(maxDato / paso) * paso;
        const hoy = new Date();
        const esMesActual = (i) => (i === hoy.getMonth() && this.anio === hoy.getFullYear());
        let axis = '';
        for (let v = maxEje; v >= 0; v -= paso) axis += '<span>' + v + '</span>';
        // Barras SIN etiqueta de mes (los meses van en su propia fila debajo,
        // alineados por columna: si no, se traslapaban con el eje Y)
        const bars = totales.map((t, i) => {
            const h = Math.max(2, Math.round((t / maxEje) * 100));
            // Mes en curso en ámbar; meses sin reclamos en gris muy discreto
            const cls = esMesActual(i) ? ' oscuro' : (t === 0 ? ' cero' : '');
            return '<div class="rq-bar-col">'
                + '<div class="rq-bar' + cls + '" style="height:' + h + '%">' + (t > 0 ? '<div class="n">' + t + '</div>' : '') + '</div>'
                + '</div>';
        }).join('');
        const months = mesesCortos.map(m => '<span>' + m + '</span>').join('');
        document.getElementById('rrChartMes').innerHTML = ''
            + '<div class="rq-bars-row"><div class="rq-yaxis">' + axis + '</div><div class="rq-bars">' + bars + '</div></div>'
            + '<div class="rq-months">' + months + '</div>'
            + '<div class="rq-nota">Eje en unidades enteras (reclamos) · barra ámbar = mes en curso</div>';
    },

    // ---------------- Donut de estados (color = significado) ----------------
    renderChartEstado() {
        const d = this.reportData;
        const meses = d.meses || [];
        const sum = (campo) => meses.reduce((s, m) => s + (m[campo] || 0), 0);
        const pendientes = sum('pendientes');
        const revision = sum('en_revision');
        const finalizados = sum('finalizados');
        const legacy = sum('en_proceso');   // estados antiguos 'EN PROCESO'
        const total = pendientes + revision + finalizados + legacy;
        const rechazadas = sum('rechazadas');

        const partes = [
            { n: 'Finalizados', v: finalizados, c: '#15803d' },
            { n: 'En revisión', v: revision, c: '#2563eb' },
            { n: 'Pendientes', v: pendientes, c: '#b45309' },
            { n: 'Legado (EN PROCESO)', v: legacy, c: '#94a3b8' }
        ].filter(p => p.v > 0);

        let grados = 0;
        const tramos = partes.map(p => {
            const ini = grados;
            grados += total > 0 ? (p.v / total) * 360 : 0;
            return p.c + ' ' + ini + 'deg ' + grados + 'deg';
        });
        const fondo = total > 0 ? 'conic-gradient(' + tramos.join(',') + ')' : '#e4e9f0';

        document.getElementById('rrChartEstado').innerHTML = ''
            + '<div class="rq-donut-wrap">'
            + '<div class="rq-donut" style="background:' + fondo + '"><div class="c"><div class="n">' + this._fmtNum(total) + '</div><div class="l">Total</div></div></div>'
            + '<div class="rq-legend">'
            + partes.map(p => '<div class="rq-lg"><span class="dot" style="background:' + p.c + '"></span>' + escText(p.n) + '<span class="n">' + this._fmtNum(p.v) + '</span></div>').join('')
            + (rechazadas > 0 ? '<div class="rq-lg" style="border-top:1px dashed var(--invp-line,#e4e9f0);padding-top:9px"><span class="dot" style="background:#dc2626"></span>Rechazadas<span class="n">' + this._fmtNum(rechazadas) + '</span></div>' : '')
            + '</div></div>'
            + '<div class="rq-nota">Rechazadas es un corte de los finalizados según su resolución.</div>';
    },

    // ---------------- Rankings (resoluciones / motivos / clientes / costo / días) ----------------
    renderRankings() {
        const d = this.reportData;

        // Resoluciones: verde aceptadas, roja rechazada, gris sin resolver
        const resol = (d.resoluciones || []).slice(0, 6);
        const maxResol = Math.max(...resol.map(r => r.total || 0), 1);
        document.getElementById('rrResoluciones').innerHTML = resol.length ? '<div class="rq-rank">' + resol.map(r => {
            const nom = this._etiquetaResolucion(r.resolucion || 'Sin resolver');
            const color = /Rechaz/i.test(nom) ? 'red' : /Sin resolver/i.test(nom) ? 'slate' : 'green';
            return '<div class="rq-ritem"><div class="top"><span class="nm">' + escText(nom) + '</span><span class="vl">' + this._fmtNum(r.total) + '</span></div>'
                + '<div class="rq-track"><div class="rq-fill ' + color + '" style="width:' + Math.round((r.total / maxResol) * 100) + '%"></div></div></div>';
        }).join('') + '</div>' : this._vacio('Aún no hay resoluciones registradas');

        // Motivos: azul degradado por peso (el principal tinta fuerte, resto más claro)
        const motivos = (d.motivos || []).slice(0, 5);
        const maxMot = Math.max(...motivos.map(m => m.total || 0), 1);
        const tonosAzul = ['', 'o75', 'o55', 'o40', 'o30'];
        document.getElementById('rrMotivos').innerHTML = motivos.length ? '<div class="rq-rank">' + motivos.map((m, i) => {
            const color = /otro/i.test(m.motivo || '') ? 'slate' : '';
            return '<div class="rq-ritem"><div class="top"><span class="nm">' + escText(this._frase(m.motivo || 'Sin motivo')) + '</span><span class="vl">' + this._fmtNum(m.total) + '</span></div>'
                + '<div class="rq-track"><div class="rq-fill ' + color + '" style="width:' + Math.round((m.total / maxMot) * 100) + '%;' + (tonosAzul[i] ? 'opacity:.' + tonosAzul[i].replace('o', '') : '') + '"></div></div></div>';
        }).join('') + '</div>' : this._vacio('Sin motivos registrados');

        // Clientes
        const clientes = (d.clientes || []).slice(0, 5);
        const maxCli = Math.max(...clientes.map(c => c.total || 0), 1);
        document.getElementById('rrClientes').innerHTML = clientes.length ? '<div class="rq-rank">' + clientes.map(c => {
            return '<div class="rq-ritem"><div class="top"><span class="nm">' + escText(this._titulo(c.cliente || 'Sin cliente')) + '</span><span class="vl">' + this._fmtNum(c.total) + '</span></div>'
                + '<div class="rq-track"><div class="rq-fill" style="width:' + Math.round((c.total / maxCli) * 100) + '%"></div></div></div>';
        }).join('') + '</div>' : this._vacio('Sin clientes con reclamos este año');

        // Pérdida por responsable: rojo el mayor, ámbar medio, gris bajo (y el
        // VALOR también se tiñe para que la pérdida "grite" lo que importa)
        const costos = (d.costoPorResponsable || []).slice(0, 6);
        const maxCosto = Math.max(...costos.map(c => c.total || 0), 1);
        document.getElementById('rrCostoResp').innerHTML = costos.length ? '<div class="rq-rank">' + costos.map((c, i) => {
            const color = i === 0 ? 'red' : i < 3 ? 'amber' : 'slate';
            const vColor = i === 0 ? ' style="color:#b91c1c"' : i < 3 ? ' style="color:#b45309"' : '';
            return '<div class="rq-ritem"><div class="top"><span class="nm">' + escText(this._titulo(c.nombre || 'Sin asignar')) + '</span><span class="vl"' + vColor + '>' + this._fmtCLP(c.total) + '</span></div>'
                + '<div class="rq-track"><div class="rq-fill ' + color + '" style="width:' + Math.round((c.total / maxCosto) * 100) + '%"></div></div></div>';
        }).join('') + '</div>' : this._vacio('Sin costos registrados');

        // Días de semana: azul entre semana, gris fines de semana
        const dias = d.diasSemana || [];
        const maxDia = Math.max(...dias.map(x => x.total || 0), 1);
        const esFinde = (n) => /^s[aá]b|^dom/i.test(n || '');
        document.getElementById('rrDias').innerHTML = '<div class="rq-bars">'
            + dias.map(x => {
                const h = Math.max(2, Math.round((x.total / maxDia) * 100));
                return '<div class="rq-bar-col"><div class="rq-bar' + (esFinde(x.nombre) ? ' gris' : '') + '" style="height:' + h + '%"><div class="n">' + this._fmtNum(x.total) + '</div></div>'
                    + '<div class="m">' + escText(x.nombre) + '</div></div>';
            }).join('')
            + '</div>';
    },
    _vacio(txt) {
        return '<div style="text-align:center;padding:26px 10px;color:var(--invp-muted,#8494a8);font-size:11px">' + escText(txt) + '</div>';
    },

    // ---------------- Tabla mensual (sin estados legados) ----------------
    renderTabla() {
        const d = this.reportData;
        const mesesCortos = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const badge = (v, cls) => '<span class="rq-badge ' + cls + '">' + this._fmtNum(v) + '</span>';
        let rows = '';
        let tot = { total: 0, pendientes: 0, en_revision: 0, finalizados: 0 };
        (d.meses || []).forEach((m, i) => {
            tot.total += m.total || 0;
            tot.pendientes += m.pendientes || 0;
            tot.en_revision += m.en_revision || 0;
            tot.finalizados += m.finalizados || 0;
            if (!m.total) return;
            const tasa = m.total > 0 ? Math.round(((m.finalizados || 0) / m.total) * 100) : 0;
            rows += '<tr>'
                + '<td class="mes-n">' + mesesCortos[i] + '</td>'
                + '<td class="num">' + this._fmtNum(m.total) + '</td>'
                + '<td class="num">' + badge(m.pendientes || 0, 'rq-b-amber') + '</td>'
                + '<td class="num">' + badge(m.en_revision || 0, 'rq-b-blue') + '</td>'
                + '<td class="num">' + badge(m.finalizados || 0, 'rq-b-green') + '</td>'
                + '<td class="num">' + tasa + '%</td>'
                + '</tr>';
        });
        const tasaGen = tot.total > 0 ? Math.round((tot.finalizados / tot.total) * 100) : 0;
        const tfoot = '<tfoot><tr><td>Total</td><td class="num">' + this._fmtNum(tot.total) + '</td><td class="num">' + this._fmtNum(tot.pendientes) + '</td><td class="num">' + this._fmtNum(tot.en_revision) + '</td><td class="num">' + this._fmtNum(tot.finalizados) + '</td><td class="num">' + tasaGen + '%</td></tr></tfoot>';
        document.getElementById('rrTabla').innerHTML = rows
            ? '<table class="rq-mes"><thead><tr><th>Mes</th><th class="num">Total</th><th class="num">Pendientes</th><th class="num">En revisión</th><th class="num">Finalizados</th><th class="num">Tasa</th></tr></thead><tbody>' + rows + '</tbody>' + tfoot + '</table>'
            : this._vacio('Sin datos para este año');
    },

    cambiarAnio(dir) {
        this.anio += dir;
        const lbl = document.getElementById('rrAnioLabel');
        if (lbl) lbl.textContent = this.anio;
        this.loadData();
    }
});
