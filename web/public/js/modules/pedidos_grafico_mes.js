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

            <div class="pgm-blocks" id="pgmKpis"></div>

            <div class="pgm-panel" style="margin-bottom:14px">
                <div class="pgm-p-head"><h3>Pedidos por día</h3><span class="sub" id="pgmSub"></span></div>
                <div class="pgm-p-body">
                    <div class="pgm-legend" id="pgmLegend"></div>
                    <div class="pgm-scroll">
                        <div class="pgm-stack-row" id="pgmStack"></div>
                        <div class="pgm-wbands" id="pgmWBands"></div>
                    </div>
                </div>
            </div>

            <div class="pgm-grid2">
                <div class="pgm-panel">
                    <div class="pgm-p-head"><h3>Resumen por semana</h3><span class="sub" id="pgmSubSem"></span></div>
                    <div class="pgm-p-body">
                        <div class="pgm-weeks" id="pgmSemanas"></div>
                        <div class="pgm-wfoot" id="pgmSemFoot"></div>
                    </div>
                </div>
                <div class="pgm-panel">
                    <div class="pgm-p-head"><h3>Distribución por etiqueta</h3><span class="sub" id="pgmSubEt"></span></div>
                    <div class="pgm-p-body" id="pgmEtiquetas"></div>
                </div>
            </div>
            <div class="pgm-panel">
                <div class="pgm-p-head"><h3>Comparativo por mes</h3><span class="sub">últimos 12 meses · barra ámbar = mes seleccionado</span></div>
                <div class="pgm-p-body"><div class="pgm-cmp-row" id="pgmCmp"></div></div>
            </div>`;

        const label = this._MESES[this.mes] + ' ' + this.anio;
        document.getElementById('pgmMesLabel').textContent = label;
        document.getElementById('pgmSub').textContent = 'apilados por tipo de OV · ' + label.toLowerCase();
        document.getElementById('pgmSubEt').textContent = label.toLowerCase();
        document.getElementById('pgmSubSem').textContent = 'suma y promedio por semana · ' + label.toLowerCase();

        const pedidos = this._pedidosMes(this.anio, this.mes);
        this._pintarFiltro();
        this._pintarKpis(pedidos);
        this._pintarLeyenda(pedidos);
        this._pintarStack(pedidos);
        this._pintarSemanas(pedidos);
        this._pintarComparativo();
        this._pintarEtiquetas(pedidos);
    },

    // ---------------- KPIs: 3 bloques de lectura (familia) ----------------
    _pintarKpis(pedidos) {
        const total = pedidos.length;
        const porDia = {};
        pedidos.forEach(p => {
            const d = new Date(p.fecha_subida).getDate();
            porDia[d] = (porDia[d] || 0) + 1;
        });
        const diasCon = Object.keys(porDia).length;
        const promedio = diasCon > 0 ? Math.round(total / diasCon) : 0;
        // Promedio por SEMANA (semanas calendario del mes con datos)
        const semanas = this._semanasMes(pedidos).filter(s => s.suma > 0);
        const promSemana = semanas.length > 0 ? Math.round(total / semanas.length) : 0;
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
        const chip = (cls, txt) => '<span class="pgm-chip ' + cls + '">' + txt + '</span>';

        document.getElementById('pgmKpis').innerHTML = ''
            + '<div class="pgm-block">'
            + '<div class="k">📊 ¿Cuántos pedidos?</div>'
            + '<div class="v">' + this._fmtNum(total) + '<small>en ' + this._MESES[this.mes] + '</small></div>'
            + '<div class="chips">' + chip('', '<b>' + this._fmtNum(promedio) + '</b> promedio/día')
            + chip('', '<b>' + this._fmtNum(promSemana) + '</b> promedio/semana') + '</div></div>'
            + '<div class="pgm-block">'
            + '<div class="k">🏆 Mejor día</div>'
            + '<div class="v">' + (mejorDia === '-' ? '—' : 'Día ' + mejorDia) + '</div>'
            + '<div class="chips">' + (mejorTotal > 0 ? chip('g', '<b>' + this._fmtNum(mejorTotal) + '</b> pedidos') : chip('a', 'sin ingresos')) + '</div></div>'
            + '<div class="pgm-block">'
            + '<div class="k">📈 Vs. mes anterior</div>'
            + '<div class="v ' + varCls + '">' + escText(varTxt) + '</div>'
            + '<div class="chips">' + chip(varCls === 'pgm-green' ? 'g' : varCls === 'pgm-red' ? 'r' : '', escText(varSub)) + '</div></div>';
    },

    // ---------------- Semanas calendario del mes (dom→sáb, colas inclusivas) ----------------
    // Suma y promedio por semana — el corte es por DÍA DEL MES (1-7, 8-14, ...),
    // igual que las bandas bajo las barras, para que ambas vistas cuadren.
    _semanasMes(pedidos) {
        const diasEnMes = new Date(this.anio, this.mes + 1, 0).getDate();
        const hoy = new Date();
        const esMesActual = this.anio === hoy.getFullYear() && this.mes === hoy.getMonth();
        const sem = [];
        for (let ini = 1; ini <= diasEnMes; ini += 7) {
            const fin = Math.min(ini + 6, diasEnMes);
            const dias = [];
            for (let d = ini; d <= fin; d++) dias.push(d);
            sem.push({ ini, fin, dias, suma: 0, diasCon: 0 });
        }
        pedidos.forEach(p => {
            const d = new Date(p.fecha_subida).getDate();
            const s = sem.find(x => d >= x.ini && d <= x.fin);
            if (s) s.suma++;
        });
        sem.forEach(s => {
            // Días con ingresos: hasta hoy si la semana está en curso (si no,
            // el promedio de la semana en curso saldría inflado)
            const limite = esMesActual ? Math.min(s.fin, hoy.getDate()) : s.fin;
            const conDatos = new Set();
            pedidos.forEach(p => {
                const d = new Date(p.fecha_subida).getDate();
                if (d >= s.ini && d <= limite) conDatos.add(d);
            });
            s.diasCon = conDatos.size;
            s.prom = s.diasCon > 0 ? Math.round((s.suma / s.diasCon) * 10) / 10 : 0;
            s.enCurso = esMesActual && hoy.getDate() >= s.ini && hoy.getDate() <= s.fin;
        });
        return sem;
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
    // Color del número DENTRO del segmento: fondo claro (Express) lleva texto
    // oscuro; los fondos saturados (azul, morado, rojo, verde) llevan blanco.
    _textoSeg(tipo) {
        return tipo === 'Express' ? '#0f172a' : '#ffffff';
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
        // Altura en px de la zona de barras (.pgm-stack-row = 230px). Con eso
        // se decide si el valor de cada etiqueta cabe DENTRO del segmento;
        // si no cabe, queda el tooltip al pasar el mouse (nunca se pierde).
        const PX_BARRA = 190;

        let html = '';
        for (let d = 1; d <= diasEnMes; d++) {
            const segs = porDia[d] || {};
            const total = Object.values(segs).reduce((s, v) => s + v, 0);
            const altura = total > 0 ? Math.max(3, Math.round((total / maxDia) * 100)) : 0;
            const segmentos = tipos.map(t => {
                const v = segs[t];
                if (!v) return '';
                const px = total > 0 ? (v / total) * (altura / 100) * PX_BARRA : 0;
                const dentro = px >= 12
                    ? '<span class="v" style="color:' + this._textoSeg(t) + '">' + this._fmtNum(v) + '</span>'
                    : '';
                return '<div class="pgm-seg" title="' + escText(t) + ': ' + this._fmtNum(v) + ' pedido' + (v === 1 ? '' : 's') + '"'
                    + ' style="height:' + ((v / (total || 1)) * 100) + '%;background:' + this._color(t) + '">'
                    + dentro + '</div>';
            }).join('');
            html += '<div class="pgm-stack-col' + (total ? '' : ' vacio') + '">'
                + (total ? '<div class="t">' + this._fmtNum(total) + '</div>' : '')
                + '<div class="pgm-stack" style="height:' + altura + '%">' + segmentos + '</div>'
                + '<div class="d">' + d + '</div></div>';
        }
        document.getElementById('pgmStack').innerHTML = html;
    },

    // ---------------- Resumen por semana (suma + promedio) ----------------
    _pintarSemanas(pedidos) {
        const sem = this._semanasMes(pedidos);
        const maxSem = Math.max(1, ...sem.map(s => s.suma));

        // Bandas bajo las barras: una por semana, proporcional a sus días
        document.getElementById('pgmWBands').innerHTML = sem.map(s => {
            const cur = s.enCurso;
            return '<div class="pgm-wband' + (cur ? ' cur' : '') + '" style="flex:' + s.dias.length + '">'
                + 'Sem ' + s.ini + '–' + s.fin + (cur ? ' · en curso' : '')
                + '<b>' + this._fmtNum(s.suma) + ' pedido' + (s.suma === 1 ? '' : 's') + '</b></div>';
        }).join('');

        // Filas del panel: suma (héroe), barra comparativa y chips de promedio
        document.getElementById('pgmSemanas').innerHTML = sem.map((s, i) => {
            const cls = s.suma === 0 ? 'zero' : (s.enCurso ? 'cur' : '');
            const w = s.suma > 0 ? Math.max(2, Math.round((s.suma / maxSem) * 100)) : 2;
            return '<div class="pgm-wk">'
                + '<div class="top"><span class="n">Semana ' + (i + 1) + ' · ' + s.ini + '–' + s.fin + ' ' + this._MESES_CORTOS[this.mes].toLowerCase()
                + (s.enCurso ? '<em>en curso</em>' : '') + '</span>'
                + '<span class="v">' + this._fmtNum(s.suma) + '<small>pedidos</small></span></div>'
                + '<div class="pgm-track"><div class="pgm-fill ' + cls + '" style="width:' + w + '%"></div></div>'
                + '<div class="meta">'
                + '<span class="pgm-chip' + (s.enCurso ? ' a' : '') + '"><b>' + String(s.prom).replace('.', ',') + '</b> prom/día</span>'
                + '<span class="pgm-chip"><b>' + s.diasCon + '</b> día' + (s.diasCon === 1 ? '' : 's') + ' activo' + (s.diasCon === 1 ? '' : 's') + '</span>'
                + (s.suma === 0 ? '<span class="pgm-chip">sin datos aún</span>' : '')
                + '</div></div>';
        }).join('');

        // Footer: promedio general, mejor semana y semana en curso
        const conDatos = sem.filter(s => s.suma > 0);
        const promGen = conDatos.length > 0 ? Math.round(pedidos.length / conDatos.length) : 0;
        let mejor = null;
        sem.forEach((s, i) => { if (!mejor || s.suma > mejor.suma) mejor = { ...s, n: i + 1 }; });
        const enCurso = sem.find(s => s.enCurso);
        document.getElementById('pgmSemFoot').innerHTML = ''
            + 'Promedio general: <strong>' + this._fmtNum(promGen) + ' pedidos/semana</strong>'
            + (mejor && mejor.suma > 0 ? ' · Mejor semana: <strong>' + mejor.n + ' (' + this._fmtNum(mejor.suma) + ' pedidos)</strong>' : '')
            + (enCurso ? ' · Semana ' + (sem.indexOf(enCurso) + 1) + ' en curso (datos hasta hoy)' : '');
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
            .pgm-blocks{display:grid;grid-template-columns:1fr 1fr 1fr;gap:13px;margin-bottom:16px}
            .pgm-block{background:#fff;border:1px solid #e4e9f0;border-radius:14px;padding:15px 18px}
            .pgm-block .k{font-size:10px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase;color:#8494a8}
            .pgm-block .v{font-size:34px;font-weight:800;line-height:1.05;margin-top:3px;letter-spacing:-.5px;color:#0f172a;font-variant-numeric:tabular-nums}
            .pgm-block .v small{font-size:13px;font-weight:600;color:#8494a8;margin-left:5px;letter-spacing:0}
            .pgm-block .chips{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}
            .pgm-chip{font-size:10.5px;font-weight:700;background:#f1f5f9;color:#475569;padding:3px 10px;border-radius:20px;white-space:nowrap;font-variant-numeric:tabular-nums}
            .pgm-chip b{color:#0f172a;font-weight:800}
            .pgm-chip.g{background:#dcfce7;color:#15803d}
            .pgm-chip.r{background:#fee2e2;color:#b91c1c}
            .pgm-chip.a{background:#fef3c7;color:#b45309}
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
            .pgm-seg{width:100%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;line-height:1;overflow:hidden}
            .pgm-seg .v{pointer-events:none;text-shadow:0 0 2px rgba(0,0,0,.25)}
            .pgm-stack-col .t{position:absolute;top:-15px;left:0;right:0;text-align:center;font-size:10px;font-weight:600;color:#475569}
            .pgm-stack-col .d{font-size:10px;color:#8494a8;margin-top:5px}
            .pgm-stack-col.vacio .d{color:#cbd5e1}
            .pgm-cmp-row{display:flex;align-items:flex-end;gap:6px;height:180px;padding-top:14px}
            .pgm-cmp-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;height:100%;justify-content:flex-end}
            .pgm-cmp-bar{width:100%;max-width:32px;background:linear-gradient(180deg,#3b82f6,#1e40af);border-radius:6px 6px 0 0;position:relative;min-height:3px}
            .pgm-cmp-bar.gris{background:#cbd5e1}
            .pgm-cmp-bar.actual{background:linear-gradient(180deg,#f59e0b,#d97706)}
            .pgm-cmp-bar .n{position:absolute;top:-16px;left:0;right:0;text-align:center;font-size:10.5px;font-weight:800;color:#475569;font-variant-numeric:tabular-nums}
            .pgm-cmp-col .m{font-size:10px;color:#8494a8}
            .pgm-cmp-col .m.act{color:#b45309;font-weight:800}
            .pgm-et{margin-bottom:13px}
            .pgm-et-top{display:flex;justify-content:space-between;align-items:baseline;font-size:13px;margin-bottom:5px;gap:10px}
            /* Resumen por semana (familia: fila + barra + chips) */
            .pgm-weeks{display:flex;flex-direction:column;gap:12px}
            .pgm-wk .top{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:11.5px;margin-bottom:5px}
            .pgm-wk .top .n{font-weight:700;color:#334155;display:flex;align-items:center;gap:6px}
            .pgm-wk .top .n em{font-style:normal;font-size:9px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:#b45309;background:#fef3c7;padding:2px 8px;border-radius:20px}
            .pgm-wk .top .v{font-weight:800;font-size:12.5px;color:#0f172a;font-variant-numeric:tabular-nums}
            .pgm-wk .top .v small{font-size:9.5px;font-weight:700;color:#8494a8;margin-left:3px}
            .pgm-wk .meta{display:flex;gap:7px;flex-wrap:wrap;margin-top:6px}
            .pgm-track{height:8px;border-radius:6px;background:#eef2f7;overflow:hidden}
            .pgm-fill{height:100%;border-radius:6px;background:linear-gradient(90deg,#3b82f6,#1e40af)}
            .pgm-fill.cur{background:linear-gradient(90deg,#f59e0b,#d97706)}
            .pgm-fill.zero{background:#e2e8f0}
            .pgm-wfoot{margin-top:12px;padding-top:10px;border-top:1px dashed #e4e9f0;font-size:10px;color:#8494a8;line-height:1.5}
            .pgm-wfoot strong{color:#0f172a;font-weight:800}
            /* Bandas de semana bajo las barras por día */
            .pgm-wbands{display:flex;gap:5px;margin-top:8px;min-width:640px}
            .pgm-wband{background:#f8fafc;border:1px solid #e4e9f0;border-radius:8px;padding:5px 8px;text-align:center;font-size:9px;color:#8494a8;white-space:nowrap;overflow:hidden}
            .pgm-wband b{display:block;font-size:10.5px;color:#0f172a;font-weight:800;font-variant-numeric:tabular-nums}
            .pgm-wband.cur{background:#fef3c7;border-color:#fde68a;color:#b45309}
            .pgm-wband.cur b{color:#b45309}
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
                .pgm-blocks{grid-template-columns:1fr;gap:8px}
                .pgm-block{padding:12px 14px}
                .pgm-block .v{font-size:26px}
                .pgm-grid2{grid-template-columns:1fr}
                .pgm-stack-row{height:180px}
                .pgm-cmp-row{height:150px}
                .pgm-nav .val{font-size:15px}
            }
        </style>`;
    }
});
