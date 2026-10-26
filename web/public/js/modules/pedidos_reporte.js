// ============================================================================
// Reporte de Pedidos — lenguaje visual del sistema (mismo diseño que el
// reporte de Reclamos): hero azul, KPIs neutros con color SOLO de significado
// (verde = aprobado, rojo = rechazado, ámbar = pendiente), gráficos CSS que
// llenan sus tarjetas, ejes en unidades enteras. Escala 20/15/13/11/10,
// números es-CL (miles con punto), textos con acentos.
// ============================================================================
App.registerModule('pedidos_reporte', {
    reportData: null,
    anio: new Date().getFullYear(),
    cliente: '',        // buscador: filtra TODO el reporte por cliente (parcial)
    _cliTimer: null,
    _sugerencias: [],

    _fmtNum(v) { return Number(v || 0).toLocaleString('es-CL'); },
    _fmtDec1(v) { return Number(v || 0).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); },
    // Presentacion normalizada (sin inventar acentos): 'FABRICACION MALFRED' -> 'Fabricacion Malfred'
    _titulo(s) { return String(s || '').toLowerCase().split(' ').map(p => p ? p.charAt(0).toUpperCase() + p.slice(1) : p).join(' '); },
    _frase(s) { const t = String(s || '').toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); },

    async render() {
        const el = document.getElementById('page-pedidos_reporte');
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
                .rq-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:18px}
                .rq-kpi{background:#fff;border:1px solid #e4e9f0;border-radius:12px;padding:16px 18px}
                .rq-kpi .k{font-size:10px;font-weight:600;letter-spacing:.7px;text-transform:uppercase;color:#8494a8}
                .rq-kpi .v{font-size:20px;font-weight:700;margin-top:6px;color:#0f172a}
                .rq-kpi .s{font-size:10px;color:#8494a8;margin-top:3px}
                .rq-green{color:#15803d!important}
                .rq-red{color:#dc2626!important}
                .rq-amber{color:#b45309!important}
                .rq-grid2{display:grid;grid-template-columns:1.25fr 1fr;gap:14px;margin-bottom:14px}
                .rq-grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px}
                .rq-panel{background:#fff;border:1px solid #e4e9f0;border-radius:14px;overflow:hidden;display:flex;flex-direction:column}
                .rq-p-head{padding:14px 18px 10px;display:flex;align-items:baseline;gap:8px;border-bottom:1px solid #e4e9f0}
                .rq-p-head h3{font-size:13px;font-weight:600;margin:0}
                .rq-p-head .sub{font-size:10px;color:#8494a8}
                .rq-p-body{padding:16px 18px;flex:1}
                .rq-p-body.rq-chart-body{position:relative;min-height:210px}
                .rq-chart-body .rq-bars{position:absolute;inset:16px 18px;display:flex;align-items:flex-end;gap:8px}
                .rq-bar-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end}
                .rq-bar{width:100%;max-width:34px;background:#2563eb;border-radius:5px 5px 0 0;position:relative;min-height:2px}
                .rq-bar.gris{background:#94a3b8}
                .rq-bar.oscuro{background:#1e3a5f}
                .rq-bar .n{position:absolute;top:-17px;left:0;right:0;text-align:center;font-size:10px;font-weight:600;color:#475569}
                .rq-bar-col .m{font-size:10px;color:#8494a8}
                .rq-donut-wrap{display:flex;align-items:center;gap:22px;flex-wrap:wrap;height:100%}
                .rq-donut{width:150px;height:150px;border-radius:50%;position:relative;flex-shrink:0}
                .rq-donut::after{content:'';position:absolute;inset:26px;background:#fff;border-radius:50%}
                .rq-donut .c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:1}
                .rq-donut .c .n{font-size:20px;font-weight:700}
                .rq-donut .c .l{font-size:10px;letter-spacing:.6px;text-transform:uppercase;color:#8494a8}
                .rq-legend{display:flex;flex-direction:column;gap:9px;flex:1;min-width:170px}
                .rq-lg{display:flex;align-items:center;gap:8px;font-size:13px;color:#475569}
                .rq-lg .dot{width:8px;height:8px;border-radius:3px}
                .rq-lg .n{margin-left:auto;font-weight:600;color:#0f172a}
                .rq-rank{display:flex;flex-direction:column;gap:11px;height:100%;justify-content:space-evenly}
                .rq-rank.cols2{display:grid;grid-template-columns:1fr 1fr;gap:10px 22px;align-content:space-evenly}
                .rq-ritem .top{display:flex;justify-content:space-between;gap:10px;font-size:13px;margin-bottom:4px}
                .rq-ritem .nm{color:#475569}
                .rq-ritem .vl{font-weight:600;color:#0f172a}
                .rq-track{height:7px;border-radius:6px;background:#f1f5f9;overflow:hidden}
                .rq-fill{height:100%;border-radius:6px;background:#2563eb}
                .rq-fill.green{background:#15803d}.rq-fill.amber{background:#b45309}.rq-fill.red{background:#dc2626}.rq-fill.slate{background:#94a3b8}
                .rq-mes{width:100%;border-collapse:collapse}
                .rq-mes th{font-size:10px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;color:#8494a8;text-align:left;padding:8px 12px;border-bottom:1px solid #e4e9f0;background:#fbfcfe}
                .rq-mes td{font-size:13px;padding:9px 12px;border-bottom:1px solid #eef2f7;color:#475569}
                .rq-mes th.num,.rq-mes td.num{text-align:right}
                .rq-mes td.mes-n{font-weight:600;color:#0f172a}
                .rq-mes tfoot td{font-weight:700;color:#0f172a;background:#f8fafc;border-bottom:none}
                .rq-badge{display:inline-flex;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:600}
                .rq-b-amber{color:#b45309;background:#fdf8f1}
                .rq-b-green{color:#15803d;background:#f0fdf4}
                .rq-b-red{color:#dc2626;background:#fef2f2}
                .rq-filtro{background:#fff;border:1px solid #e4e9f0;border-radius:12px;padding:12px 16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px}
                .rq-filtro input{flex:1;min-width:220px;padding:10px 14px;border:1px solid #e4e9f0;border-radius:10px;font-size:13px;color:#0f172a;outline:none;background:#fbfcfe}
                .rq-filtro input:focus{border-color:#2563eb;background:#fff}
                .rq-fbtn{padding:10px 18px;border-radius:10px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer}
                .rq-fbtn:hover{background:#1d4ed8}
                .rq-fbtn.ghost{background:#fff;color:#475569;border:1px solid #e4e9f0}
                .rq-fbtn.ghost:hover{background:#f8fafc}
                .rq-fhint{font-size:11px;color:#8494a8}
                .rq-fhint strong{color:#0369a1}
                @media(max-width:768px){
                    .rq-hero{padding:16px}
                    .rq-hero h2{font-size:13px}
                    .rq-kpis{grid-template-columns:1fr 1fr;gap:8px}
                    .rq-kpi{padding:12px 14px}
                    .rq-kpi .v{font-size:15px}
                    .rq-grid2,.rq-grid3{grid-template-columns:1fr}
                    .rq-rank.cols2{grid-template-columns:1fr}
                    .rq-mes th,.rq-mes td{padding:7px 8px}
                }
            </style>

            <div class="rq-hero">
                <div>
                    <h2>Reporte de Pedidos</h2>
                    <p>Análisis mensual de pedidos y órdenes</p>
                </div>
                <div class="rq-anio">
                    <button class="rq-nav" onclick="App.modules.pedidos_reporte.cambiarAnio(-1)" aria-label="Año anterior">‹</button>
                    <div><div class="lbl">Año</div><div class="val" id="prAnioLabel">${this.anio}</div></div>
                    <button class="rq-nav" onclick="App.modules.pedidos_reporte.cambiarAnio(1)" aria-label="Año siguiente">›</button>
                </div>
            </div>

            <div class="rq-filtro">
                <input id="prCliente" list="prClientesLista" placeholder="🔍 Buscar cliente… (ej: Malfred — se filtra mientras escribes)"
                    value="${escText(this.cliente)}"
                    oninput="App.modules.pedidos_reporte._onClienteInput()"
                    onkeydown="if(event.key==='Enter')App.modules.pedidos_reporte.buscarCliente(); if(event.key==='Escape')App.modules.pedidos_reporte.limpiarCliente()">
                <datalist id="prClientesLista"></datalist>
                <button class="rq-fbtn" onclick="App.modules.pedidos_reporte.buscarCliente()">Filtrar</button>
                <button class="rq-fbtn ghost" onclick="App.modules.pedidos_reporte.limpiarCliente()">Limpiar</button>
                <span class="rq-fhint" id="prFiltroInfo"></span>
            </div>

            <div class="rq-kpis" id="prKpis"></div>
            <div class="rq-grid2">
                <div class="rq-panel">
                    <div class="rq-p-head"><h3>Pedidos por mes</h3><span class="sub">${this.anio} · conteo de ingresos</span></div>
                    <div class="rq-p-body rq-chart-body" id="prChartMes"></div>
                </div>
                <div class="rq-panel">
                    <div class="rq-p-head"><h3>Por estado</h3><span class="sub">situación actual</span></div>
                    <div class="rq-p-body" id="prChartEstado"></div>
                </div>
            </div>
            <div class="rq-grid3">
                <div class="rq-panel">
                    <div class="rq-p-head"><h3>Tipos de OV</h3><span class="sub">distribución por tipo</span></div>
                    <div class="rq-p-body"><div class="rq-rank" id="prTipos"></div></div>
                </div>
                <div class="rq-panel">
                    <div class="rq-p-head"><h3>Principales motivos de rechazo</h3></div>
                    <div class="rq-p-body"><div class="rq-rank" id="prMotivos"></div></div>
                </div>
                <div class="rq-panel">
                    <div class="rq-p-head"><h3>Clientes con más pedidos</h3></div>
                    <div class="rq-p-body"><div class="rq-rank" id="prClientes"></div></div>
                </div>
            </div>
            <div class="rq-panel" style="margin-bottom:14px">
                <div class="rq-p-head"><h3>Pedidos por vendedor</h3><span class="sub">ranking del año</span></div>
                <div class="rq-p-body"><div class="rq-rank cols2" id="prVendedores"></div></div>
            </div>
            <div class="rq-panel">
                <div class="rq-p-head"><h3>Detalle mensual</h3><span class="sub">resumen por mes</span></div>
                <div id="prTabla"></div>
            </div>`;

        await this.loadData();
    },

    async loadData() {
        try {
            const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const cli = (this.cliente || '').trim();
            const url = `/api/pedidos/reporte?anio=${this.anio}` + (cli ? `&cliente=${encodeURIComponent(cli)}` : '');
            const res = await fetch(url, { headers });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                // Error VISIBLE: antes se mostraban ceros en silencio y parecía "sin datos"
                App.showAlert('Error al cargar el reporte: ' + (err.error || ('HTTP ' + res.status)), 'danger');
                this.reportData = { meses: [], vendedores: [], clientes: [], tipos: [], motivos: [], totalGeneral: 0, totalAprobados: 0, totalRechazados: 0 };
            } else {
                this.reportData = await res.json();
            }
            // Sugerencias del buscador: se mantienen las del reporte completo
            // (un filtro activo devuelve pocos clientes y las sugerencias no
            // deben encogerse mientras se escribe)
            if (!cli && (this.reportData.clientes || []).length) {
                this._sugerencias = this.reportData.clientes.map(c => c.nombre);
            }
            this._pintarFiltro();
            this.renderKpis();
            this.renderChartMes();
            this.renderChartEstado();
            this.renderRankings();
            this.renderTabla();
        } catch (e) {
            console.error('Error reporte pedidos:', e);
            App.showAlert('Error al cargar el reporte: ' + e.message, 'danger');
        }
    },

    // ---------------- Buscador de cliente ----------------
    _onClienteInput() {
        // Filtra mientras se escribe (debounce): al escribir un nombre el
        // reporte sale filtrado automáticamente, como pide el usuario
        clearTimeout(this._cliTimer);
        this._cliTimer = setTimeout(() => this.buscarCliente(), 500);
    },
    buscarCliente() {
        clearTimeout(this._cliTimer);
        const inp = document.getElementById('prCliente');
        const nuevo = (inp && inp.value || '').trim();
        if (nuevo === (this.cliente || '')) return;
        this.cliente = nuevo;
        this.loadData();
    },
    limpiarCliente() {
        clearTimeout(this._cliTimer);
        this.cliente = '';
        const inp = document.getElementById('prCliente');
        if (inp) inp.value = '';
        this.loadData();
    },
    _pintarFiltro() {
        const el = document.getElementById('prFiltroInfo');
        if (!el) return;
        const cli = (this.cliente || '').trim();
        if (!cli) {
            el.innerHTML = 'escribe un nombre para filtrar todo el reporte';
        } else {
            const total = (this.reportData && this.reportData.totalGeneral) || 0;
            el.innerHTML = 'Filtrado por cliente: <strong>' + escText(cli) + '</strong> · ' + this._fmtNum(total) + ' pedido' + (total === 1 ? '' : 's') + ' · <a href="javascript:void(0)" onclick="App.modules.pedidos_reporte.limpiarCliente()" style="color:#2563eb;text-decoration:underline">quitar filtro</a>';
        }
        const dl = document.getElementById('prClientesLista');
        if (dl) {
            dl.innerHTML = this._sugerencias.map(n => '<option value="' + escText(n) + '"></option>').join('');
        }
    },

    renderKpis() {
        const d = this.reportData;
        const total = d.totalGeneral || 0;
        const aprobados = d.totalAprobados || 0;
        const rechazados = d.totalRechazados || 0;
        const tasa = total > 0 ? Math.round((aprobados / total) * 100) : 0;
        const mesesActivos = (d.meses || []).filter(m => m.total > 0).length;
        const promedio = mesesActivos > 0 ? Math.round(total / mesesActivos) : 0;
        document.getElementById('prKpis').innerHTML = ''
            + this._kpi('Total ' + this.anio, this._fmtNum(total), 'pedidos ingresados', '')
            + this._kpi('Aprobados', this._fmtNum(aprobados), 'listos para producción', 'rq-green')
            + this._kpi('Rechazados', this._fmtNum(rechazados), 'observados', 'rq-red')
            + this._kpi('Tasa de aprobación', tasa + '%', 'del total del año', 'rq-green')
            + this._kpi('Promedio mensual', this._fmtNum(promedio), 'en meses activos', '');
    },
    _kpi(k, v, s, cls) {
        return '<div class="rq-kpi"><div class="k">' + escText(k) + '</div><div class="v ' + cls + '">' + escText(v) + '</div><div class="s">' + escText(s) + '</div></div>';
    },

    renderChartMes() {
        const d = this.reportData;
        const mesesCortos = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const totales = (d.meses || []).map(m => m.total || 0);
        const maxDato = Math.max(...totales, 1);
        const maxEje = Math.ceil(maxDato / 4) * 4 || 4;
        const hoy = new Date();
        const esMesActual = (i) => (i === hoy.getMonth() && this.anio === hoy.getFullYear());
        const bars = totales.map((t, i) => {
            const h = Math.max(2, Math.round((t / maxEje) * 100));
            return '<div class="rq-bar-col">'
                + '<div class="rq-bar' + (esMesActual(i) ? ' oscuro' : '') + '" style="height:' + h + '%"><div class="n">' + this._fmtNum(t) + '</div></div>'
                + '<div class="m">' + mesesCortos[i] + '</div></div>';
        }).join('');
        document.getElementById('prChartMes').innerHTML = '<div class="rq-bars">' + bars + '</div>';
    },

    renderChartEstado() {
        const d = this.reportData;
        const meses = d.meses || [];
        const sum = (campo) => meses.reduce((s, m) => s + (m[campo] || 0), 0);
        const aprobados = sum('aprobados');
        const rechazados = sum('rechazados');
        const pendientes = sum('pendientes');
        const total = aprobados + rechazados + pendientes;
        const partes = [
            { n: 'Aprobados', v: aprobados, c: '#15803d' },
            { n: 'Rechazados', v: rechazados, c: '#dc2626' },
            { n: 'Pendientes', v: pendientes, c: '#b45309' }
        ].filter(p => p.v > 0);
        let grados = 0;
        const tramos = partes.map(p => {
            const ini = grados;
            grados += total > 0 ? (p.v / total) * 360 : 0;
            return p.c + ' ' + ini + 'deg ' + grados + 'deg';
        });
        const fondo = total > 0 ? 'conic-gradient(' + tramos.join(',') + ')' : '#e4e9f0';
        document.getElementById('prChartEstado').innerHTML = ''
            + '<div class="rq-donut-wrap">'
            + '<div class="rq-donut" style="background:' + fondo + '"><div class="c"><div class="n">' + this._fmtNum(total) + '</div><div class="l">Total</div></div></div>'
            + '<div class="rq-legend">'
            + partes.map(p => '<div class="rq-lg"><span class="dot" style="background:' + p.c + '"></span>' + escText(p.n) + '<span class="n">' + this._fmtNum(p.v) + '</span></div>').join('')
            + '</div></div>';
    },

    renderRankings() {
        const d = this.reportData;

        // Tipos de OV: barras azules
        const tipos = (d.tipos || []).slice(0, 6);
        const maxTipo = Math.max(...tipos.map(t => t.total || 0), 1);
        document.getElementById('prTipos').innerHTML = this._rank(
            tipos.map(t => ({ nom: this._titulo(t.nombre), val: t.total, w: (t.total / maxTipo) * 100, cls: '' }))
        );

        // Motivos de rechazo: barras rojas (el tono cuenta el significado)
        const motivos = (d.motivos || []).slice(0, 5);
        const maxMot = Math.max(...motivos.map(m => m.total || 0), 1);
        document.getElementById('prMotivos').innerHTML = this._rank(
            motivos.map((m, i) => ({ nom: this._frase(m.motivo), val: m.total, w: (m.total / maxMot) * 100, cls: 'red', op: i === 0 ? '' : 'opacity:.75' }))
        );

        // Clientes
        const clientes = (d.clientes || []).slice(0, 5);
        const maxCli = Math.max(...clientes.map(c => c.total || 0), 1);
        document.getElementById('prClientes').innerHTML = this._rank(
            clientes.map(c => ({ nom: this._titulo(c.nombre), val: c.total, w: (c.total / maxCli) * 100, cls: '' }))
        );

        // Vendedores (2 columnas)
        const vendedores = (d.vendedores || []).slice(0, 10);
        const maxVend = Math.max(...vendedores.map(v => v.total || 0), 1);
        document.getElementById('prVendedores').innerHTML = vendedores.length
            ? this._rank(vendedores.map((v, i) => ({ nom: this._titulo(v.nombre), val: v.total, w: (v.total / maxVend) * 100, cls: i === 0 ? '' : 'slate', op: i === 0 ? '' : 'opacity:.75' })), true)
            : '<div style="text-align:center;padding:26px 10px;color:#8494a8;font-size:11px">Sin vendedores con pedidos este año</div>';
    },
    _rank(items, cols2) {
        if (!items.length) return '<div style="text-align:center;padding:26px 10px;color:#8494a8;font-size:11px">Sin datos para este año</div>';
        return '<div class="rq-rank' + (cols2 ? ' cols2' : '') + '">' + items.map(it =>
            '<div class="rq-ritem"><div class="top"><span class="nm">' + escText(it.nom) + '</span><span class="vl">' + this._fmtNum(it.val) + '</span></div>'
            + '<div class="rq-track"><div class="rq-fill ' + (it.cls || '') + '" style="width:' + Math.max(2, Math.round(it.w)) + '%;' + (it.op || '') + '"></div></div></div>'
        ).join('') + '</div>';
    },

    renderTabla() {
        const d = this.reportData;
        const mesesCortos = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const badge = (v, cls) => '<span class="rq-badge ' + cls + '">' + this._fmtNum(v) + '</span>';
        let rows = '';
        let tot = { total: 0, pendientes: 0, aprobados: 0, rechazados: 0 };
        (d.meses || []).forEach((m, i) => {
            tot.total += m.total || 0;
            tot.pendientes += m.pendientes || 0;
            tot.aprobados += m.aprobados || 0;
            tot.rechazados += m.rechazados || 0;
            if (!m.total) return;
            const tasa = m.total > 0 ? Math.round(((m.aprobados || 0) / m.total) * 100) : 0;
            rows += '<tr>'
                + '<td class="mes-n">' + mesesCortos[i] + '</td>'
                + '<td class="num">' + this._fmtNum(m.total) + '</td>'
                + '<td class="num">' + badge(m.pendientes || 0, 'rq-b-amber') + '</td>'
                + '<td class="num">' + badge(m.aprobados || 0, 'rq-b-green') + '</td>'
                + '<td class="num">' + badge(m.rechazados || 0, 'rq-b-red') + '</td>'
                + '<td class="num">' + tasa + '%</td>'
                + '</tr>';
        });
        const tasaGen = tot.total > 0 ? Math.round((tot.aprobados / tot.total) * 100) : 0;
        const tfoot = '<tfoot><tr><td>Total</td><td class="num">' + this._fmtNum(tot.total) + '</td><td class="num">' + this._fmtNum(tot.pendientes) + '</td><td class="num">' + this._fmtNum(tot.aprobados) + '</td><td class="num">' + this._fmtNum(tot.rechazados) + '</td><td class="num">' + tasaGen + '%</td></tr></tfoot>';
        document.getElementById('prTabla').innerHTML = rows
            ? '<table class="rq-mes"><thead><tr><th>Mes</th><th class="num">Total</th><th class="num">Pendientes</th><th class="num">Aprobados</th><th class="num">Rechazados</th><th class="num">Tasa aprob.</th></tr></thead><tbody>' + rows + '</tbody>' + tfoot + '</table>'
            : '<div style="text-align:center;padding:26px 10px;color:#8494a8;font-size:11px">Sin datos para este año</div>';
    },

    cambiarAnio(dir) {
        this.anio += dir;
        const lbl = document.getElementById('prAnioLabel');
        if (lbl) lbl.textContent = this.anio;
        this.loadData();
    }
});
