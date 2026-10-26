// ============================================================================
// Gráfico por Día (módulo "Grafico Mes") — panel mensual completo:
//   · KPIs del mes (total, promedio diario, mejor día, variación vs mes anterior)
//   · Pedidos por día apilados por tipo de OV (colores = ETIQUETAS físicas)
//   · Comparativo por mes (últimos 12 meses)
//   · Distribución por etiqueta (conteo y %)
// Paleta de etiquetas refinada (mismos tonos, sin chillón):
//   Normal #2563eb · Express #fde047 (amarillo etiqueta) · Vta. Region #7c3aed · Reposicion #b91c1c · Urgencia #16a34a (verde etiqueta)
// NO existe etiqueta "Rechazado": los rechazados se excluyen y el subtítulo lo dice.
// Escala tipográfica 20/15/13/11/10 · números es-CL · gráficos CSS.
// ============================================================================
App.registerModule('pedidos_grafico_mes', {
    _datos: [],          // pedidos de la ventana de 12 meses (fetch único)
    mes: null,
    anio: null,
    cliente: '',         // buscador: filtra todo el gráfico por cliente (parcial)
    _cliTimer: null,
    _MESES: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
    _MESES_CORTOS: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
    // Paleta de ETIQUETAS (coherente con las etiquetas físicas de planta)
    _ETIQUETAS: {
        'Normal': '#2563eb',
        'Express': '#fde047',
        'Vta. Region': '#7c3aed',
        'Reposicion': '#b91c1c',
        'Urgencia': '#16a34a'
    },
    _ETIQUETAS_COLOR_FALLBACK: '#64748b',

    _fmtNum(v) { return Number(v || 0).toLocaleString('es-CL'); },

    async render() {
        const el = document.getElementById('page-pedidos_grafico_mes');
        el.innerHTML = '<div style="text-align:center;padding:40px;color:#8494a8">Cargando gráfico...</div>';
        const hoy = new Date();
        if (this.mes === null) { this.mes = hoy.getMonth(); this.anio = hoy.getFullYear(); }

        try {
            // Ventana SIEMPRE anclada a los últimos 12 meses desde el mes actual
            // (aunque se navegue a un mes antiguo, los datos cargados cubren la
            // misma ventana que permite la navegación). Con 1 día de MARGEN a
            // cada lado: el servidor guarda fecha_subida en hora UTC y corta los
            // rangos a medianoche UTC, así que los pedidos ingresados entre las
            // 21:00 y 24:00 hrs (que en UTC ya son del día siguiente) se caían
            // del mes consultado. La agrupación por día/mes es local (Chile).
            const hoy = new Date();
            const inicio = this._ymd(hoy.getFullYear(), hoy.getMonth() - 11, 0);   // día 0 = último día del mes anterior
            const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
            const fin = this._ymd(hoy.getFullYear(), hoy.getMonth(), ultimoDia + 1);
            const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const res = await fetch(`/api/pedidos?inicio=${inicio}&fin=${fin}`, { headers });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                App.showAlert('Error al cargar el gráfico: ' + (err.error || ('HTTP ' + res.status)), 'danger');
                this._datos = [];
            } else {
                const data = await res.json();
                this._datos = Array.isArray(data) ? data : [];
            }
            this._pintar(el);
        } catch (e) {
            console.error('Error grafico pedidos:', e);
            App.showAlert('Error al cargar el gráfico: ' + e.message, 'danger');
            el.innerHTML = '<div class="alert alert-danger">Error: ' + escText(e.message) + '</div>';
        }
    },

    _ymd(anio, mes, dia) {
        const d = new Date(anio, mes, dia);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },

    // Pedidos del mes seleccionado (sin rechazados: no hay etiqueta "rechazado")
    // — con el filtro de cliente activo (coincidencia parcial, sin mayúsculas)
    _pedidosMes(anio, mes) {
        const cli = (this.cliente || '').trim().toLowerCase();
        return this._datos.filter(p => {
            if (p.estado === 'rechazado') return false;
            if (cli && !String(p.cliente || '').toLowerCase().includes(cli)) return false;
            const f = new Date(p.fecha_subida);
            return f.getFullYear() === anio && f.getMonth() === mes;
        });
    },

    _pintar(el) {
        el.innerHTML = this._estilos() + `
            <div class="pgm-hero">
                <div>
                    <h2>Gráfico por Día</h2>
                    <p>Ingresos diarios por tipo de OV · sin rechazados · colores según etiquetas</p>
                </div>
                <div class="pgm-nav">
                    <button class="pgm-nav-btn" onclick="App.modules.pedidos_grafico_mes.cambiarMes(-1)" aria-label="Mes anterior">‹</button>
                    <div style="text-align:center"><div class="lbl">Mes</div><div class="val" id="pgmMesLabel"></div></div>
                    <button class="pgm-nav-btn" onclick="App.modules.pedidos_grafico_mes.cambiarMes(1)" aria-label="Mes siguiente">›</button>
                </div>
            </div>

            <div class="pgm-filtro">
                <input id="pgmCliente" list="pgmClientesLista" placeholder="🔍 Buscar cliente… (ej: Malfred — se filtra mientras escribes)"
                    value="${escText(this.cliente)}"
                    oninput="App.modules.pedidos_grafico_mes._onClienteInput()"
                    onkeydown="if(event.key==='Enter')App.modules.pedidos_grafico_mes.buscarCliente(); if(event.key==='Escape')App.modules.pedidos_grafico_mes.limpiarCliente()">
                <datalist id="pgmClientesLista"></datalist>
                <button class="pgm-fbtn" onclick="App.modules.pedidos_grafico_mes.buscarCliente()">Filtrar</button>
                <button class="pgm-fbtn ghost" onclick="App.modules.pedidos_grafico_mes.limpiarCliente()">Limpiar</button>
                <span class="pgm-fhint" id="pgmFiltroInfo"></span>
            </div>

            <div class="pgm-kpis" id="pgmKpis"></div>

            <div class="pgm-panel" style="margin-bottom:14px">
                <div class="pgm-p-head"><h3>Pedidos por día</h3><span class="sub" id="pgmSub"></span></div>
                <div class="pgm-p-body">
                    <div class="pgm-legend" id="pgmLegend"></div>
                    <div class="pgm-scroll"><div class="pgm-stack-row" id="pgmStack"></div></div>
                </div>
            </div>

            <div class="pgm-grid2">
                <div class="pgm-panel">
                    <div class="pgm-p-head"><h3>Comparativo por mes</h3><span class="sub">últimos 12 meses</span></div>
                    <div class="pgm-p-body"><div class="pgm-cmp-row" id="pgmCmp"></div></div>
                </div>
                <div class="pgm-panel">
                    <div class="pgm-p-head"><h3>Distribución por etiqueta</h3><span class="sub" id="pgmSubEt"></span></div>
                    <div class="pgm-p-body" id="pgmEtiquetas"></div>
                </div>
            </div>`;

        const label = this._MESES[this.mes] + ' ' + this.anio;
        document.getElementById('pgmMesLabel').textContent = label;
        document.getElementById('pgmSub').textContent = 'apilados por tipo de OV · ' + label.toLowerCase();
        document.getElementById('pgmSubEt').textContent = label.toLowerCase();

        const pedidos = this._pedidosMes(this.anio, this.mes);
        this._pintarFiltro();
        this._pintarKpis(pedidos);
        this._pintarLeyenda(pedidos);
        this._pintarStack(pedidos);
        this._pintarComparativo();
        this._pintarEtiquetas(pedidos);
    },

    // ---------------- KPIs del mes ----------------
    _pintarKpis(pedidos) {
        const total = pedidos.length;
        const porDia = {};
        pedidos.forEach(p => {
            const d = new Date(p.fecha_subida).getDate();
            porDia[d] = (porDia[d] || 0) + 1;
        });
        const diasCon = Object.keys(porDia).length;
        const promedio = diasCon > 0 ? Math.round(total / diasCon) : 0;
        let mejorDia = '-', mejorTotal = 0;
        for (const [d, v] of Object.entries(porDia)) { if (v > mejorTotal) { mejorTotal = v; mejorDia = d; } }

        // Variación vs mes anterior
        const ant = this._mesAnterior();
        const totalAnt = ant ? this._pedidosMes(ant.anio, ant.mes).length : 0;
        let varTxt = '—', varCls = '', varSub = 'sin datos del mes anterior';
        if (totalAnt > 0) {
            const pct = Math.round(((total - totalAnt) / totalAnt) * 100);
            varTxt = (pct > 0 ? '+' : '') + pct + '%';
            varCls = pct > 0 ? 'pgm-green' : (pct < 0 ? 'pgm-red' : '');
            varSub = this._fmtNum(totalAnt) + ' → ' + this._fmtNum(total) + ' pedidos';
        }

        document.getElementById('pgmKpis').innerHTML = ''
            + this._kpi('Total del mes', this._fmtNum(total), 'pedidos ingresados', '')
            + this._kpi('Promedio diario', this._fmtNum(promedio), 'en ' + diasCon + ' días con ingresos', '')
            + this._kpi('Mejor día', mejorDia === '-' ? '—' : 'Día ' + mejorDia, mejorTotal > 0 ? this._fmtNum(mejorTotal) + ' pedidos' : 'sin ingresos', '')
            + this._kpi('Vs. mes anterior', varTxt, varSub, varCls);
    },
    _kpi(k, v, s, cls) {
        return '<div class="pgm-kpi"><div class="k">' + escText(k) + '</div><div class="v ' + cls + '">' + escText(v) + '</div><div class="s">' + escText(s) + '</div></div>';
    },
    _mesAnterior() {
        const m = this.mes - 1, a = this.mes === 0 ? this.anio - 1 : this.anio;
        // Inicio de la ventana REAL de datos (hoy−11): fuera de ella no hay
        // datos para comparar y el KPI lo dice honestamente
        const hoy = new Date();
        const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 11, 1);
        const ant = new Date(a, m, 1);
        return ant >= inicio ? { anio: a, mes: (m + 12) % 12 } : null;
    },

    // ---------------- Barras apiladas por día ----------------
    _pintarLeyenda(pedidos) {
        const tipos = this._tiposPresentes(pedidos);
        document.getElementById('pgmLegend').innerHTML = tipos.map(t =>
            '<span class="pgm-lg"><span class="dot" style="background:' + this._color(t) + '"></span>' + escText(t) + '</span>'
        ).join('');
    },
    _tiposPresentes(pedidos) {
        const orden = ['Normal', 'Express', 'Vta. Region', 'Reposicion', 'Urgencia'];
        const presentes = [...new Set(pedidos.map(p => (p.tipo_ov || 'Normal').trim() || 'Normal'))];
        const fijos = orden.filter(t => presentes.includes(t));
        const extras = presentes.filter(t => !orden.includes(t)).sort();
        return [...fijos, ...extras];   // ningún tipo se descarta en silencio
    },
    _color(tipo) {
        return this._ETIQUETAS[tipo] || this._ETIQUETAS_COLOR_FALLBACK;
    },
    _pintarStack(pedidos) {
        const diasEnMes = new Date(this.anio, this.mes + 1, 0).getDate();
        const tipos = this._tiposPresentes(pedidos);
        // Acumular por día × tipo
        const porDia = {};
        pedidos.forEach(p => {
            const d = new Date(p.fecha_subida).getDate();
            const t = (p.tipo_ov || 'Normal').trim() || 'Normal';
            if (!porDia[d]) porDia[d] = {};
            porDia[d][t] = (porDia[d][t] || 0) + 1;
        });
        const maxDia = Math.max(1, ...Object.values(porDia).map(o => Object.values(o).reduce((s, v) => s + v, 0)));

        let html = '';
        for (let d = 1; d <= diasEnMes; d++) {
            const segs = porDia[d] || {};
            const total = Object.values(segs).reduce((s, v) => s + v, 0);
            const altura = total > 0 ? Math.max(3, Math.round((total / maxDia) * 100)) : 0;
            const segmentos = tipos.map(t => segs[t]
                ? '<div class="pgm-seg" style="height:' + ((segs[t] / (total || 1)) * 100) + '%;background:' + this._color(t) + '"></div>'
                : '').join('');
            html += '<div class="pgm-stack-col' + (total ? '' : ' vacio') + '">'
                + (total ? '<div class="t">' + this._fmtNum(total) + '</div>' : '')
                + '<div class="pgm-stack" style="height:' + altura + '%">' + segmentos + '</div>'
                + '<div class="d">' + d + '</div></div>';
        }
        document.getElementById('pgmStack').innerHTML = html;
    },

    // ---------------- Comparativo de 12 meses ----------------
    _pintarComparativo() {
        // Ventana REAL de datos: los 12 meses cargados (hoy−11 … hoy), con el mes
        // seleccionado resaltado. Antes se recalculaba respecto del mes
        // seleccionado y al navegar hacia atrás mostraba meses sin datos como 0
        // (parecía que hubiera habido cero pedidos y no era cierto).
        const hoy = new Date();
        const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 11, 1);
        const meses = [];
        for (let i = 0; i < 12; i++) {
            const d = new Date(inicio.getFullYear(), inicio.getMonth() + i, 1);
            meses.push({ anio: d.getFullYear(), mes: d.getMonth(), total: this._pedidosMes(d.getFullYear(), d.getMonth()).length });
        }
        const max = Math.max(1, ...meses.map(m => m.total));
        document.getElementById('pgmCmp').innerHTML = meses.map((m, i) => {
            const esActual = m.anio === this.anio && m.mes === this.mes;
            const cls = esActual ? 'actual' : (i < 6 ? 'gris' : '');
            const h = Math.max(2, Math.round((m.total / max) * 100));
            return '<div class="pgm-cmp-col"><div class="pgm-cmp-bar ' + cls + '" style="height:' + h + '%"><div class="n">' + this._fmtNum(m.total) + '</div></div>'
                + '<div class="m' + (esActual ? ' act' : '') + '">' + this._MESES_CORTOS[m.mes] + '</div></div>';
        }).join('');
    },

    // ---------------- Distribución por etiqueta ----------------
    _pintarEtiquetas(pedidos) {
        const tipos = this._tiposPresentes(pedidos);
        const total = pedidos.length;
        const conteo = {};
        pedidos.forEach(p => {
            const t = (p.tipo_ov || 'Normal').trim() || 'Normal';
            conteo[t] = (conteo[t] || 0) + 1;
        });
        const filas = tipos.map(t => ({ t, n: conteo[t] || 0, pct: total > 0 ? Math.round(((conteo[t] || 0) / total) * 100) : 0 }))
            .sort((a, b) => b.n - a.n);
        document.getElementById('pgmEtiquetas').innerHTML = filas.length
            ? filas.map(f => `
                <div class="pgm-et">
                    <div class="pgm-et-top">
                        <span class="nm"><span class="dot" style="background:${this._color(f.t)}"></span>${escText(f.t)}</span>
                        <span class="vl">${this._fmtNum(f.n)}<span class="pct">${f.pct}%</span></span>
                    </div>
                    <div class="pgm-track"><div class="pgm-fill" style="width:${Math.max(2, f.pct)}%;background:${this._color(f.t)}"></div></div>
                </div>`).join('')
            : '<div class="pgm-vacio">Sin pedidos en este mes</div>';
    },

    // ---------------- Buscador de cliente ----------------
    // Filtra TODO el gráfico (KPIs, barras por día, comparativo y distribución)
    // con los datos en memoria: es instantáneo, sin ir al servidor
    _onClienteInput() {
        clearTimeout(this._cliTimer);
        this._cliTimer = setTimeout(() => this.buscarCliente(), 350);
    },
    buscarCliente() {
        clearTimeout(this._cliTimer);
        const inp = document.getElementById('pgmCliente');
        const nuevo = (inp && inp.value || '').trim();
        const teniaFoco = !!inp && document.activeElement === inp;
        const caret = inp && inp.selectionStart != null ? inp.selectionStart : nuevo.length;
        if (nuevo === (this.cliente || '')) return;
        this.cliente = nuevo;
        this._pintar(document.getElementById('page-pedidos_grafico_mes'));
        // Al re-pintar se recrea el input: devolver foco y cursor para poder
        // seguir escribiendo sin saltos (mismo patrón que la búsqueda del Taller)
        const inp2 = document.getElementById('pgmCliente');
        if (inp2 && teniaFoco) {
            inp2.focus();
            try { inp2.setSelectionRange(caret, caret); } catch (_) { }
        }
    },
    limpiarCliente() {
        clearTimeout(this._cliTimer);
        this.cliente = '';
        const inp = document.getElementById('pgmCliente');
        if (inp) inp.value = '';
        this._pintar(document.getElementById('page-pedidos_grafico_mes'));
    },
    _pintarFiltro() {
        const el = document.getElementById('pgmFiltroInfo');
        if (!el) return;
        const cli = (this.cliente || '').trim();
        const total = this._pedidosMes(this.anio, this.mes).length;
        el.innerHTML = cli
            ? 'Filtrado por cliente: <strong>' + escText(cli) + '</strong> · ' + this._fmtNum(total) + ' pedido' + (total === 1 ? '' : 's') + ' en ' + this._MESES[this.mes] + ' · <a href="javascript:void(0)" onclick="App.modules.pedidos_grafico_mes.limpiarCliente()" style="color:#2563eb;text-decoration:underline">quitar filtro</a>'
            : 'escribe un nombre para filtrar todo el gráfico';
        // Sugerencias: clientes de la ventana completa (no se encogen al filtrar)
        const dl = document.getElementById('pgmClientesLista');
        if (dl) {
            const conteo = {};
            this._datos.forEach(p => {
                if (p.estado === 'rechazado') return;
                const n = String(p.cliente || '').trim();
                if (n) conteo[n] = (conteo[n] || 0) + 1;
            });
            dl.innerHTML = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 15)
                .map(([n]) => '<option value="' + escText(n) + '"></option>').join('');
        }
    },

    cambiarMes(dir) {
        const hoy = new Date();
        const limiteAdelante = hoy.getFullYear() * 12 + hoy.getMonth();
        const limiteAtras = limiteAdelante - 11;
        const actual = this.anio * 12 + this.mes;
        const nuevo = actual + dir;
        if (nuevo < limiteAtras || nuevo > limiteAdelante) return;   // ventana de 12 meses
        this.anio = Math.floor(nuevo / 12);
        this.mes = nuevo % 12;
        this._pintar(document.getElementById('page-pedidos_grafico_mes'));
    },

    _estilos() {
        return `<style>
            .pgm-hero{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 55%,#1e40af 100%);border-radius:16px;padding:20px 26px;display:flex;align-items:center;gap:14px;position:relative;overflow:hidden;margin-bottom:18px}
            .pgm-hero::after{content:'';position:absolute;left:0;right:0;bottom:0;height:1px;background:linear-gradient(90deg,transparent,rgba(147,197,253,.55),transparent)}
            .pgm-hero h2{color:#fff;font-size:15px;font-weight:700;margin:0}
            .pgm-hero p{color:rgba(255,255,255,.62);font-size:11px;margin:2px 0 0}
            .pgm-nav{margin-left:auto;display:flex;align-items:center;gap:10px}
            .pgm-nav .lbl{font-size:10px;letter-spacing:.8px;text-transform:uppercase;color:rgba(255,255,255,.6);text-align:center}
            .pgm-nav .val{font-size:20px;font-weight:700;color:#fff;white-space:nowrap}
            .pgm-nav-btn{width:32px;height:32px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);color:#fff;cursor:pointer;font-size:13px}
            .pgm-nav-btn:hover{background:rgba(255,255,255,.2)}
            .pgm-filtro{background:#fff;border:1px solid #e4e9f0;border-radius:12px;padding:12px 16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px}
            .pgm-filtro input{flex:1;min-width:220px;padding:10px 14px;border:1px solid #e4e9f0;border-radius:10px;font-size:13px;color:#0f172a;outline:none;background:#fbfcfe}
            .pgm-filtro input:focus{border-color:#2563eb;background:#fff}
            .pgm-fbtn{padding:10px 18px;border-radius:10px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer}
            .pgm-fbtn:hover{background:#1d4ed8}
            .pgm-fbtn.ghost{background:#fff;color:#475569;border:1px solid #e4e9f0}
            .pgm-fbtn.ghost:hover{background:#f8fafc}
            .pgm-fhint{font-size:11px;color:#8494a8}
            .pgm-fhint strong{color:#0369a1}
            .pgm-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
            .pgm-kpi{background:#fff;border:1px solid #e4e9f0;border-radius:12px;padding:15px 18px}
            .pgm-kpi .k{font-size:10px;font-weight:600;letter-spacing:.7px;text-transform:uppercase;color:#8494a8}
            .pgm-kpi .v{font-size:20px;font-weight:700;margin-top:5px;color:#0f172a}
            .pgm-kpi .s{font-size:10px;color:#8494a8;margin-top:2px}
            .pgm-green{color:#15803d!important}
            .pgm-red{color:#dc2626!important}
            .pgm-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
            .pgm-panel{background:#fff;border:1px solid #e4e9f0;border-radius:14px;overflow:hidden;display:flex;flex-direction:column}
            .pgm-p-head{padding:14px 18px 10px;display:flex;align-items:baseline;gap:8px;border-bottom:1px solid #e4e9f0}
            .pgm-p-head h3{font-size:13px;font-weight:600;margin:0}
            .pgm-p-head .sub{font-size:10px;color:#8494a8}
            .pgm-p-body{padding:16px 18px;flex:1}
            .pgm-legend{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px}
            .pgm-lg{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:#475569}
            .pgm-lg .dot{width:8px;height:8px;border-radius:3px}
            .pgm-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
            .pgm-stack-row{display:flex;align-items:flex-end;gap:5px;height:230px;padding-top:16px;min-width:640px}
            .pgm-stack-col{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%;position:relative}
            .pgm-stack{width:100%;max-width:30px;display:flex;flex-direction:column-reverse;border-radius:3px 3px 0 0;overflow:hidden}
            .pgm-seg{width:100%}
            .pgm-stack-col .t{position:absolute;top:-15px;left:0;right:0;text-align:center;font-size:10px;font-weight:600;color:#475569}
            .pgm-stack-col .d{font-size:10px;color:#8494a8;margin-top:5px}
            .pgm-stack-col.vacio .d{color:#cbd5e1}
            .pgm-cmp-row{display:flex;align-items:flex-end;gap:6px;height:180px;padding-top:14px}
            .pgm-cmp-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;height:100%;justify-content:flex-end}
            .pgm-cmp-bar{width:100%;max-width:30px;background:#2563eb;border-radius:4px 4px 0 0;position:relative;min-height:2px}
            .pgm-cmp-bar.gris{background:#94a3b8}
            .pgm-cmp-bar.actual{background:#1e3a5f}
            .pgm-cmp-bar .n{position:absolute;top:-15px;left:0;right:0;text-align:center;font-size:10px;font-weight:600;color:#475569}
            .pgm-cmp-col .m{font-size:10px;color:#8494a8}
            .pgm-cmp-col .m.act{color:#0f172a;font-weight:700}
            .pgm-et{margin-bottom:13px}
            .pgm-et-top{display:flex;justify-content:space-between;align-items:baseline;font-size:13px;margin-bottom:5px;gap:10px}
            .pgm-et-top .nm{display:flex;align-items:center;gap:7px;color:#475569;font-weight:500}
            .pgm-et-top .nm .dot{width:9px;height:9px;border-radius:3px}
            .pgm-et-top .vl{font-weight:700}
            .pgm-et-top .pct{font-size:11px;color:#8494a8;margin-left:8px;font-weight:600}
            .pgm-track{height:8px;border-radius:6px;background:#f1f5f9;overflow:hidden}
            .pgm-fill{height:100%;border-radius:6px}
            .pgm-vacio{text-align:center;padding:26px 10px;color:#8494a8;font-size:11px}
            @media(max-width:768px){
                .pgm-hero{padding:16px}
                .pgm-hero h2{font-size:13px}
                .pgm-kpis{grid-template-columns:1fr 1fr;gap:8px}
                .pgm-kpi{padding:12px 14px}
                .pgm-kpi .v{font-size:15px}
                .pgm-grid2{grid-template-columns:1fr}
                .pgm-stack-row{height:180px}
                .pgm-cmp-row{height:150px}
                .pgm-nav .val{font-size:15px}
            }
        </style>`;
    }
});
