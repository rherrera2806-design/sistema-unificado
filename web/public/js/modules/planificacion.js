// ============================================================================
// Planificación — rediseño "menos engorroso"
//   · 3 pestañas en vez de scroll infinito: Vista por Grupo (capacidad + trabajo
//     pendiente) · Carga por Grupo (gráfico) · Carga por Estaciones (matriz).
//   · Rangos INDEPENDIENTES por pestaña: navegar el calendario de estaciones ya
//     no mueve el rango del gráfico ni la vista de grupo (bug corregido).
//   · Acciones reales por fila en pendientes (Asignar a la fecha elegida).
//   · Sin alert() nativos · los resultados de Auto-Asignar/Reprogramar NUNCA se
//     cierran solos (botón Cerrar) · sin doble carga recursiva (Fase C).
//   · Números es-CL · fechas dd-mm-yyyy · escala 20/15/13/11/10 · acentos.
// Mantiene TODA la API del módulo original (planificacion-grupo, capacidad,
// auto-asignar, reprogramar, carga-por-grupo, carga-estaciones, detalle-día).
// ============================================================================
App.modules.planificacion = {
    nombre: 'Planificación',

    // Vistas
    _vista: 'grupo',

    // Vista por Grupo
    fechaGrupo: null,
    capacidadGrupo: [],
    cargaGrupo: [],
    pendientesGrupo: [],

    // Gráfico de carga (rango propio)
    chartInicio: null,
    chartModo: 'inicio',
    cargaPorGrupo: null,
    cargaPorGrupoFinales: null,
    _chartInstance: null,

    // Estaciones (rango propio, independiente)
    estacInicio: null,
    diasEstaciones: 15,

    // ---------------- Formato ----------------
    fmtDate(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },
    _fmt(v, dec) {
        return Number(v || 0).toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    },
    _fecha(f) {
        if (!f) return '—';
        const d = typeof f === 'string' ? new Date(f + 'T12:00:00') : new Date(f);
        if (isNaN(d.getTime())) return '—';
        const p = n => String(n).padStart(2, '0');
        return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
    },
    _fechaCorta(f) {
        if (!f) return '—';
        const d = typeof f === 'string' ? new Date(f + 'T12:00:00') : new Date(f);
        if (isNaN(d.getTime())) return '—';
        const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const p = n => String(n).padStart(2, '0');
        return `${dias[d.getDay()]} ${p(d.getDate())}-${p(d.getMonth() + 1)}`;
    },
    _nombreDia(f) {
        const d = new Date(f + 'T12:00:00');
        const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        return dias[d.getDay()];
    },

    // ---------------- Render principal ----------------
    // ¿Puede editar el plan (Auto-Asignar, Reprogramar, Capacidad)?
    // Admin por rol/permiso, o los permisos reales del arbol de Usuarios
    // (prod_planificacion.*); 'produccion' se mantiene por compatibilidad.
    _puedeEditar(user) {
        const p = user.permisos || [];
        return user.rol === 'admin' || p.includes('usuarios') ||
            p.includes('prod_planificacion.editar') || p.includes('prod_planificacion.agregar') ||
            p.includes('produccion');
    },

    async render() {
        const hoy = new Date();
        if (!this.fechaGrupo) this.fechaGrupo = this.fmtDate(hoy);
        if (!this.chartInicio) this.chartInicio = this.fmtDate(hoy);
        if (!this.estacInicio) this.estacInicio = this.fmtDate(hoy);

        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const puedeEditar = this._puedeEditar(user);
        const page = document.getElementById('page-planificacion');
        if (!page) return;

        page.innerHTML = this._estilos() + `
            <div class="pln-hero">
                <div>
                    <h2>Planificación</h2>
                    <p>Capacidad por grupo (kg/día) · carga por estación (m²) · programación de pendientes</p>
                </div>
            </div>

            <div id="plnAvisoIncumplidas"></div>

            <div class="pln-kpis" id="plnKpis"></div>

            <div class="pln-tabs">
                <div class="pln-tab on" id="plnTabGrupo" onclick="App.modules.planificacion.setVista('grupo')">⚖️ &nbsp;Vista por Grupo</div>
                <div class="pln-tab" id="plnTabChart" onclick="App.modules.planificacion.setVista('chart')">📊 &nbsp;Carga por Grupo</div>
                <div class="pln-tab" id="plnTabEstac" onclick="App.modules.planificacion.setVista('estaciones')">🏭 &nbsp;Carga por Estaciones</div>
            </div>

            <!-- ══════════ VISTA POR GRUPO ══════════ -->
            <div id="plnPanelGrupo">
                <div class="pln-panel">
                    <div class="pln-p-head">
                        <h3>Capacidad por grupo (kg/día)</h3>
                        <div class="pln-nav">
                            <button class="pln-navbtn" onclick="App.modules.planificacion.cambiarFechaGrupo(-1)">◀</button>
                            <input type="date" id="planGrupoFecha" value="${this.fechaGrupo}" onchange="App.modules.planificacion.cambiarFechaGrupo()">
                            <button class="pln-navbtn" onclick="App.modules.planificacion.cambiarFechaGrupo(1)">▶</button>
                            ${puedeEditar ? `
                            <button class="pln-btn ghost sm" onclick="App.modules.planificacion.showCapacidadGrupo()" title="Configurar capacidad">⚙ Capacidad</button>
                            <button class="pln-btn primary sm" onclick="App.modules.planificacion.showAutoAsignarGrupo()" title="Repartir pendientes respetando capacidad">⚡ Auto-Asignar</button>
                            <button class="pln-btn warn sm" onclick="App.modules.planificacion.showReprogramarAvance()" title="Re-programa SOLO lo pendiente respetando lo avanzado">🔔 Por Avance</button>` : ''}
                        </div>
                    </div>
                    <div class="pln-p-body">
                        <div class="pln-cards" id="planGrupoCards"><div class="pln-loading">Cargando grupos...</div></div>
                    </div>
                </div>

                <div class="pln-panel" style="margin-top:14px">
                    <div class="pln-p-head">
                        <h3>Pendientes sin asignar</h3>
                        <span class="sub" id="plnPendSub">órdenes que aún no tienen día programado</span>
                    </div>
                    <div class="pln-p-body" id="planGrupoPendientes"><div class="pln-loading">Cargando pendientes...</div></div>
                </div>
            </div>

            <!-- ══════════ CARGA POR GRUPO (CHART) ══════════ -->
            <div id="plnPanelChart" style="display:none">
                <div class="pln-panel">
                    <div class="pln-p-head">
                        <h3>Carga por grupo</h3>
                        <span class="sub">kg por día · línea roja = capacidad de producción · click en una barra → detalle</span>
                        <div class="pln-nav">
                            <button class="pln-navbtn" onclick="App.modules.planificacion.cambiarChart(-1)">◀</button>
                            <span class="pln-rango" id="plnChartRango"></span>
                            <button class="pln-navbtn" onclick="App.modules.planificacion.cambiarChart(1)">▶</button>
                            <button class="pln-btn ghost sm" id="plnModoInicio" onclick="App.modules.planificacion.cambiarModoChart('inicio')">F. Inicio</button>
                            <button class="pln-btn ghost sm" id="plnModoFinales" onclick="App.modules.planificacion.cambiarModoChart('finales')">F. Término</button>
                        </div>
                    </div>
                    <div class="pln-p-body">
                        <div class="pln-chart-row">
                            <div class="pln-legend" id="plnChartLegend"></div>
                            <div class="pln-chart-box"><canvas id="chartCargaGrupo"></canvas></div>
                        </div>
                        <div class="pln-capinfo" id="plnCapProm"></div>
                    </div>
                </div>
            </div>

            <!-- ══════════ CARGA POR ESTACIONES ══════════ -->
            <div id="plnPanelEstac" style="display:none">
                <div class="pln-panel">
                    <div class="pln-p-head">
                        <h3>Carga por estaciones (m²/día)</h3>
                        <span class="sub">solo días hábiles · CB = cuello de botella</span>
                        <div class="pln-nav">
                            <label class="pln-lbl">Días</label>
                            <input type="number" min="1" max="60" value="${this.diasEstaciones}" onchange="App.modules.planificacion.cambiarDiasEstaciones(this.value)">
                            <button class="pln-navbtn" onclick="App.modules.planificacion.cambiarSemanaEstaciones(-1)">◀</button>
                            <span class="pln-rango" id="plnEstacRango"></span>
                            <button class="pln-navbtn" onclick="App.modules.planificacion.cambiarSemanaEstaciones(1)">▶</button>
                        </div>
                    </div>
                    <div class="pln-p-body">
                        <div class="pln-matriz-wrap"><div id="planEstaciones"><div class="pln-loading">Cargando estaciones...</div></div></div>
                    </div>
                </div>
            </div>

            <!-- Detalle grupo + día (click en el gráfico) -->
            <div id="planDetalleGrupoDia"></div>
        `;

        await Promise.all([this.cargarGrupo(), this.cargarDatos(), this.cargarAvisoIncumplidas()]);
        this.cargarEstaciones();
    },

    setVista(v) {
        this._vista = v;
        const map = { grupo: 'plnTabGrupo', chart: 'plnTabChart', estaciones: 'plnTabEstac' };
        Object.entries(map).forEach(([k, id]) => {
            const el = document.getElementById(id);
            if (el) el.classList.toggle('on', k === v);
        });
        document.getElementById('plnPanelGrupo').style.display = v === 'grupo' ? '' : 'none';
        document.getElementById('plnPanelChart').style.display = v === 'chart' ? '' : 'none';
        document.getElementById('plnPanelEstac').style.display = v === 'estaciones' ? '' : 'none';
        if (v === 'chart' && (this.cargaPorGrupo || this.cargaPorGrupoFinales)) this.renderChart();
    },

    // ---------------- Vista por Grupo ----------------
    // Tras programar/reprogramar: refrescar TODAS las vistas (si no, la carga
    // por estaciones quedaba con datos viejos hasta recorrer los días)
    async refrescarTodo() {
        await Promise.allSettled([this.cargarGrupo(), this.cargarDatos(), this.cargarEstaciones(), this.cargarAvisoIncumplidas()]);
    },

    // Aviso VISIBLE de órdenes comprometidas incumplidas (vencidas / por
    // vencer) — el planificador lo ve de frente, sin tener que abrir el modal
    async cargarAvisoIncumplidas() {
        const el = document.getElementById('plnAvisoIncumplidas');
        if (!el) return;
        try {
            const res = await fetch('/api/taller/dashboard', { cache: 'no-store' });
            const d = await res.json();
            const dv = (d && d.desvio) || {};
            const venc = (dv.vencidas || []).length;
            const porv = (dv.por_vencer || []).length;
            if (!venc && !porv) { el.innerHTML = ''; return; }
            el.innerHTML = `
                <div style="background:linear-gradient(135deg,#7f1d1d,#b91c1c);border-radius:12px;padding:13px 18px;margin-bottom:12px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;box-shadow:0 4px 14px rgba(185,28,28,.25)">
                    <div style="font-size:15px;font-weight:800;color:#fff">⚠ Órdenes comprometidas incumplidas</div>
                    <div style="display:flex;gap:8px">
                        ${venc ? `<span class="pln-prio p-reposicion">🔴 ${venc} VENCIDAS</span>` : ''}
                        ${porv ? `<span class="pln-prio p-express">🟡 ${porv} POR VENCER</span>` : ''}
                    </div>
                    <button class="pln-btn warn" style="margin-left:auto" onclick="App.modules.planificacion.showReprogramarAvance()">🔔 Ver y Reprogramar por Avance</button>
                </div>`;
        } catch (e) {
            el.innerHTML = '';
        }
    },

    async cargarGrupo() {
        try {
            const res = await fetch(`/api/produccion/planificacion-grupo?fecha=${this.fechaGrupo}`, { cache: 'no-store' });
            if (!res.ok) {
                const elC = document.getElementById('planGrupoCards');
                if (elC) elC.innerHTML = '<div class="pln-error">Error ' + res.status + ' al cargar la planificación por grupo</div>';
                return;
            }
            const data = await res.json();
            this.capacidadGrupo = data.capacidad || [];
            this.cargaGrupo = data.carga || [];
            this.pendientesGrupo = data.pendientes || [];
            this.renderKpis();
            this.renderGrupoCards();
            this.renderGrupoPendientes();
        } catch (e) {
            console.error('Error cargarGrupo:', e);
            const elC = document.getElementById('planGrupoCards');
            if (elC) elC.innerHTML = '<div class="pln-error">Error: ' + escText(e.message) + '</div>';
        }
    },

    renderKpis() {
        const el = document.getElementById('plnKpis');
        if (!el) return;
        const totalCap = this.capacidadGrupo.reduce((s, c) => s + Number(c.capacidad_kg_dia), 0);
        const totalUsado = this.cargaGrupo.reduce((s, c) => s + Number(c.kg_total), 0);
        const totalOrdenes = this.cargaGrupo.reduce((s, c) => s + Number(c.ordenes), 0);
        const pct = totalCap > 0 ? Math.round((totalUsado / totalCap) * 100) : 0;
        const pend = this.pendientesGrupo.length;
        const kgPend = this.pendientesGrupo.reduce((s, o) => s + Number(o.kilos || 0), 0);
        const color = pct > 100 ? '#dc2626' : pct > 85 ? '#b45309' : '#15803d';
        el.innerHTML = ''
            + this._kpi('Capacidad', this._fmt(totalCap, 0), 'kg/día configurados', '')
            + this._kpi('Kg asignados', this._fmt(totalUsado, 1), 'en ' + this._fecha(this.fechaGrupo), '')
            + this._kpi('Ocupación', pct + '%', pct > 100 ? '¡sobre la capacidad!' : 'de la capacidad total', color)
            + this._kpi('Órdenes asignadas', this._fmt(totalOrdenes, 0), 'programadas este día', '')
            + this._kpi('Pendientes', this._fmt(pend, 0), this._fmt(kgPend, 1) + ' kg sin asignar', pend > 0 ? '#b45309' : '#15803d');
    },
    _kpi(k, v, s, color) {
        return '<div class="pln-kpi"><div class="k">' + escText(k) + '</div><div class="v"' + (color ? ' style="color:' + color + '"' : '') + '>' + escText(v) + '</div><div class="s">' + escText(s) + '</div></div>';
    },

    renderGrupoCards() {
        const el = document.getElementById('planGrupoCards');
        if (!el) return;
        if (!this.capacidadGrupo.length) {
            el.innerHTML = '<div class="pln-loading">No hay grupos configurados (revise Configuración → Grupos)</div>';
            return;
        }
        el.innerHTML = this.capacidadGrupo.map(c => {
            const cData = this.cargaGrupo.find(x => x.grupo === c.grupo);
            const usado = Number(cData?.kg_total) || 0;
            const ordenes = Number(cData?.ordenes) || 0;
            const cap = Number(c.capacidad_kg_dia) || 0;
            const libre = cap - usado;
            const pct = cap > 0 ? Math.round((usado / cap) * 100) : 0;
            const estado = pct > 100 ? ['SOBRECARGADO', 'red'] : pct > 85 ? ['CASI LLENO', 'amber'] : pct > 0 ? ['OK', 'green'] : ['SIN CARGA', 'gray'];
            const colorBar = estado[1] === 'red' ? '#dc2626' : estado[1] === 'amber' ? '#d97706' : estado[1] === 'gray' ? '#94a3b8' : (c.color || '#2563eb');
            return `
                <div class="pln-card" style="border-left:4px solid ${escAttr(c.color || '#2563eb')}">
                    <div class="top">
                        <div>
                            <div class="gname">${escText(c.grupo)}</div>
                            <div class="gval" style="color:${escAttr(c.color || '#2563eb')}">${this._fmt(usado, 1)} <span class="cap">/ ${this._fmt(cap, 0)} kg</span></div>
                        </div>
                        <div class="right">
                            <div class="pct" style="color:${colorBar}">${pct}%</div>
                            <div class="chip b-${estado[1]}">${estado[0]}</div>
                        </div>
                    </div>
                    <div class="track"><div class="fill" style="width:${Math.min(pct, 100)}%;background:${colorBar}"></div></div>
                    <div class="foot">
                        <span>${ordenes} órdenes</span>
                        <span>Libre: <strong style="color:${libre < 0 ? '#dc2626' : '#15803d'}">${this._fmt(libre, 1)} kg</strong></span>
                    </div>
                </div>`;
        }).join('');
    },

    renderGrupoPendientes() {
        const el = document.getElementById('planGrupoPendientes');
        const sub = document.getElementById('plnPendSub');
        if (!el) return;
        const sinAsignar = this.pendientesGrupo;
        if (sub) sub.textContent = sinAsignar.length + ' órdenes · ' + this._fecha(this.fechaGrupo);
        if (!sinAsignar.length) {
            el.innerHTML = '<div class="pln-ok"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803d" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> No hay órdenes pendientes sin asignar</div>';
            return;
        }
        const kgTotal = sinAsignar.reduce((s, o) => s + Number(o.kilos || 0), 0);
        const sinGrupo = sinAsignar.filter(o => !o.grupo).length;

        const filas = sinAsignar.map(o => {
            return '<tr>'
                + '<td class="c-ped"><strong>' + escText(o.pedido_sap_id || '-') + '</strong><div class="sub2">Item ' + escText(o.item_numero || '-') + '</div></td>'
                + '<td>' + escText(o.cliente || '-') + '</td>'
                + '<td><strong>' + escText(o.codigo_producto) + '</strong>' + (o.es_compuesto ? ' <span class="pln-bom">BOM</span>' : '') + '<div class="sub2">' + escText(o.nombre_padre || o.descripcion || '-') + '</div></td>'
                + '<td class="num">' + this._fmt(Number(o.ancho), 0) + ' × ' + this._fmt(Number(o.alto), 0) + ' mm</td>'
                + '<td class="num">' + this._fmt(o.cantidad || 1, 0) + '</td>'
                + '<td class="num"><strong>' + this._fmt(o.kilos, 1) + '</strong></td>'
                + '<td>' + (o.grupo
                    ? '<span class="chip b-green">' + escText(o.grupo) + '</span>'
                    : '<span class="chip b-red">sin grupo</span>') + '</td>'
                + '<td class="c-acc">' + (o.grupo
                    ? '<button class="pln-btn primary sm" onclick="App.modules.planificacion.asignarGrupo(' + o.id + ')">Asignar al ' + this._fecha(this.fechaGrupo) + '</button>'
                    : '<span class="pln-hint-danger">Requiere grupo en Configuración</span>') + '</td>'
                + '</tr>';
        }).join('');

        const cards = sinAsignar.map(o => {
            return '<div class="pln-mcard">'
                + '<div class="t1"><strong>' + escText(o.pedido_sap_id || '-') + '</strong>' + (o.grupo ? '<span class="chip b-green">' + escText(o.grupo) + '</span>' : '<span class="chip b-red">sin grupo</span>') + '</div>'
                + '<div class="sub2">' + escText(o.cliente || '-') + ' · ' + escText(o.codigo_producto) + ' · ' + this._fmt(o.kilos, 1) + ' kg</div>'
                + '<div class="acc">' + (o.grupo
                    ? '<button class="pln-btn primary sm" style="flex:1" onclick="App.modules.planificacion.asignarGrupo(' + o.id + ')">Asignar al ' + this._fecha(this.fechaGrupo) + '</button>'
                    : '<span class="pln-hint-danger">Requiere grupo en Configuración</span>') + '</div>'
                + '</div>';
        }).join('');

        el.innerHTML = ''
            + '<div class="pln-pend-resumen"><strong>' + sinAsignar.length + ' pendientes · ' + this._fmt(kgTotal, 1) + ' kg</strong>'
            + (sinGrupo ? ' · <span style="color:#dc2626">' + sinGrupo + ' sin grupo</span>' : '')
            + '<span class="tip">Usa ⚡ Auto-Asignar para programarlas todas respetando la capacidad</span></div>'
            + '<div class="pln-table-wrap"><table class="pln-table"><thead><tr>'
            + '<th>Pedido</th><th>Cliente</th><th>Código</th><th class="num">Dimensiones</th><th class="num">Cant.</th><th class="num">Kg</th><th>Grupo</th><th class="th-acc">Acción</th>'
            + '</tr></thead><tbody>' + filas + '</tbody></table></div>'
            + '<div class="pln-cards-mobile">' + cards + '</div>';
    },

    cambiarFechaGrupo(delta) {
        if (delta === undefined) {
            this.fechaGrupo = document.getElementById('planGrupoFecha').value;
        } else {
            const d = new Date(this.fechaGrupo + 'T12:00:00');
            d.setDate(d.getDate() + delta);
            this.fechaGrupo = this.fmtDate(d);
        }
        const fEl = document.getElementById('planGrupoFecha');
        if (fEl) fEl.value = this.fechaGrupo;
        this.refrescarTodo();
    },

    async asignarGrupo(ordenId) {
        try {
            const res = await fetch('/api/produccion/planificacion-grupo/asignar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orden_id: ordenId, fecha: this.fechaGrupo })
            });
            if (res.ok) {
                App.toast('Orden asignada al ' + this._fecha(this.fechaGrupo));
                await this.refrescarTodo();
            } else {
                const d = await res.json().catch(() => ({}));
                App.showAlert(d.error || 'Error al asignar la orden', 'danger');
            }
        } catch (e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    // Detalle de un grupo en un día (click en el gráfico)
    async detalleGrupoDia(grupo, fecha) {
        const el = document.getElementById('planDetalleGrupoDia');
        if (!el) return;
        el.style.display = 'block';
        el.innerHTML = '<div class="pln-panel" style="margin-top:14px"><div class="pln-p-body"><div class="pln-loading">Cargando detalle...</div></div></div>';
        try {
            const res = await fetch(`/api/produccion/planificacion/detalle-grupo-dia?grupo=${encodeURIComponent(grupo)}&fecha=${fecha}`);
            if (!res.ok) throw new Error('Error ' + res.status);
            const ordenes = await res.json();
            const totalM2 = ordenes.reduce((s, o) => s + (Number(o.metros_cuadrados) || 0), 0);
            const totalKg = ordenes.reduce((s, o) => s + (Number(o.kilos) || 0), 0);
            const rows = ordenes.map(o => '<tr>'
                + '<td class="c-ped">' + escText(o.pedido_sap_id) + '</td>'
                + '<td>' + escText(o.item_numero) + '</td>'
                + '<td><strong>' + escText(o.codigo_producto) + '</strong>' + (o.es_compuesto ? ' <span class="pln-bom">MP</span>' : '') + '</td>'
                + '<td class="sub2">' + escText(o.descripcion || '-') + '</td>'
                + '<td class="num">' + this._fmt(Number(o.ancho), 0) + ' × ' + this._fmt(Number(o.alto), 0) + '</td>'
                + '<td class="num">' + this._fmt(o.metros_cuadrados, 2) + '</td>'
                + '<td class="num">' + this._fmt(o.kilos, 1) + '</td>'
                + '<td class="sub2">' + escText(o.ruta || '-') + '</td>'
                + '</tr>').join('');
            el.innerHTML = `
                <div class="pln-panel" style="margin-top:14px">
                    <div class="pln-p-head">
                        <h3>${escText(grupo)} — ${this._nombreDia(fecha)} ${this._fecha(fecha)}</h3>
                        <span class="sub">${ordenes.length} órdenes · ${this._fmt(totalM2, 1)} m² · ${this._fmt(totalKg, 0)} kg</span>
                        <div class="pln-nav"><button class="pln-navbtn" onclick="document.getElementById('planDetalleGrupoDia').style.display='none'">✕</button></div>
                    </div>
                    <div class="pln-p-body">
                        <div class="pln-table-wrap"><table class="pln-table"><thead><tr>
                            <th>Pedido</th><th>Item</th><th>Código</th><th>Descripción</th><th class="num">Dim.</th><th class="num">M²</th><th class="num">Kg</th><th>Ruta</th>
                        </tr></thead><tbody>${rows}</tbody></table></div>
                    </div>
                </div>`;
            el.scrollIntoView({ behavior: 'smooth' });
        } catch (e) {
            el.innerHTML = '<div class="pln-panel" style="margin-top:14px"><div class="pln-p-body"><div class="pln-error">Error: ' + escText(e.message) + '</div></div></div>';
        }
    },

    // ---------------- Capacidad por grupo ----------------
    showCapacidadGrupo() {
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        if (!this._puedeEditar(user)) {
            App.showAlert('Sin permiso para editar la capacidad', 'danger'); return;
        }
        const html = `
            <p style="font-size:13px;color:#64748b;margin-bottom:12px">Capacidad máxima en kg por día para cada grupo:</p>
            ${this.capacidadGrupo.map(c => `
                <div style="display:grid;grid-template-columns:1fr 130px 60px;gap:8px;align-items:center;margin-bottom:8px">
                    <div style="font-weight:600;font-size:13px"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${escAttr(c.color)};margin-right:6px"></span>${escText(c.grupo)}</div>
                    <input type="number" value="${c.capacidad_kg_dia}" id="planCapG_${c.id}" min="0" style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px">
                    <button class="pln-btn primary sm" title="Guardar capacidad" onclick="App.modules.planificacion.guardarCapacidadGrupo(${c.id})">Guardar</button>
                </div>
            `).join('')}
        `;
        App.showModalInv('Capacidad por Grupo (kg/día)', html, '<button class="pln-btn ghost" onclick="App.hideModal()">Cerrar</button>');
    },

    async guardarCapacidadGrupo(id) {
        const val = Number(document.getElementById('planCapG_' + id).value) || 0;
        try {
            const res = await fetch(`/api/produccion/capacidad-grupo/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ capacidad_kg_dia: val })
            });
            if (res.ok) { App.toast('Capacidad actualizada'); await this.refrescarTodo(); }
            else {
                const d = await res.json().catch(() => ({}));
                App.showAlert(d.error || 'Error al guardar la capacidad', 'danger');
            }
        } catch (e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    // ---------------- Auto-Asignar ----------------
    // Selector de turnos de HOY (compartido por Auto-Asignar y Por Avance):
    // si el planificador elige "hoy" como "Desde", hoy NO es un día completo:
    // se preguntan los turnos restantes (según Horarios de Turno) y la
    // capacidad se recorta proporcionalmente al tiempo que falta de cada uno.
    async _turnosHoyUI(inputId, contId) {
        const cont = document.getElementById(contId);
        if (!cont) return;
        const inp = document.getElementById(inputId);
        const hoy = this._hoyStr();
        if (!inp || inp.value !== hoy) { cont.innerHTML = ''; cont._turnosSel = null; return; }
        try {
            const res = await fetch('/api/produccion/planificacion/turnos-hoy', {
                headers: { 'X-User-Permisos': (JSON.parse(localStorage.getItem('unified_user') || '{}').permisos || []).join(','), 'X-User-Email': JSON.parse(localStorage.getItem('unified_user') || '{}').email || '' }
            });
            const d = await res.json();
            const turnos = d.turnos || [];
            cont._turnosSel = turnos.filter(t => t.pct_restante > 0).map(t => t.turno);
            if (!turnos.length) return; // sin horarios configurados → día completo normal
            const fila = (t) => {
                const pct = Math.round((t.pct_restante || 0) * 100);
                const act = cont._turnosSel.includes(t.turno);
                const emoji = t.turno === 'noche' ? '🌙 Turno 1 Noche' : '🌞 Turno 2 Día';
                return `<label style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;border:1px solid ${act ? '#bfdbfe' : '#e2e8f0'};background:${act ? '#eff6ff' : '#f8fafc'};opacity:${pct > 0 ? 1 : .45};cursor:${pct > 0 ? 'pointer' : 'not-allowed'};font-size:12.5px;margin-bottom:5px">
                    <input type="checkbox" class="plnTurnoHoy" value="${t.turno}" ${act ? 'checked' : ''} ${pct > 0 ? '' : 'disabled'} onchange="App.modules.planificacion._turnosHoyChange('${contId}')">
                    <strong>${emoji}</strong>
                    <span style="color:#64748b">${t.inicio} → ${t.fin}</span>
                    <span style="margin-left:auto;font-weight:700;color:${pct > 0 ? '#b45309' : '#94a3b8'}">${pct > 0 ? pct + '% disponible' : 'agotado'}</span>
                </label>`;
            };
            const ninguno = cont._turnosSel.length === 0;
            cont.innerHTML = `<div style="margin-top:8px;border:1px solid ${ninguno ? '#fecaca' : '#fde68a'};background:${ninguno ? '#fef2f2' : '#fffbeb'};border-radius:10px;padding:10px 12px">
                <div style="font-size:12px;font-weight:700;color:${ninguno ? '#b91c1c' : '#92400e'};margin-bottom:7px">⏳ Hoy (<strong>${d.ahora}</strong>) no es un día completo — elige con qué turnos cuentas:</div>
                ${turnos.map(fila).join('')}
                ${ninguno ? `<div style="font-size:11.5px;color:#b91c1c;font-weight:600">🚫 Hoy ya no queda capacidad: la programación partirá del <strong>siguiente día hábil — Turno 1 (noche)</strong>.</div>` : ''}
            </div>`;
        } catch (e) { cont.innerHTML = ''; }
    },
    _turnosHoyChange(contId) {
        const cont = document.getElementById(contId);
        if (!cont) return;
        cont._turnosSel = Array.from(cont.querySelectorAll('.plnTurnoHoy:checked')).map(c => c.value);
    },
    _turnosHoySel(contId) {
        const cont = document.getElementById(contId);
        return (cont && cont._turnosSel) || null;
    },
    _hoyStr() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },

    showAutoAsignarGrupo() {
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        if (!this._puedeEditar(user)) {
            App.showAlert('Sin permiso para auto-asignar', 'danger'); return;
        }
        const html = `
            <p style="font-size:13px;color:#64748b;margin-bottom:12px">Inserta las ordenes <strong>nuevas (sin fecha)</strong> con el mismo motor de "Por Avance": turnos, ventanas rigidas, cuellos de botella y capacidad dura. <strong>No toca</strong> el plan ya programado. Solo dias habiles.</p>
            <div style="margin-bottom:12px"><label style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#475569;margin-bottom:5px">Desde</label>
            <input type="date" id="planAutoGInicio" value="${this.fechaGrupo}" onchange="App.modules.planificacion._turnosHoyUI('planAutoGInicio','planAutoGTurnos')" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px"></div>
            <div id="planAutoGTurnos"></div>
            <div><label style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#475569;margin-bottom:5px">Cantidad de días hábiles a buscar</label>
            <input type="number" id="planAutoGDias" value="14" min="1" max="60" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px"></div>
            <div id="planAutoGResultado" style="margin-top:12px"></div>
        `;
        const footer = `
            <button class="pln-btn ghost" onclick="App.hideModal()">Cerrar</button>
            <button class="pln-btn primary" onclick="App.modules.planificacion.ejecutarAutoAsignarGrupo()">Asignar pendientes</button>
        `;
        App.showModalInv('⚡ Auto-Asignar Pendientes', html, footer);
        this._turnosHoyUI('planAutoGInicio', 'planAutoGTurnos');
    },

    async ejecutarAutoAsignarGrupo() {
        const inicio = document.getElementById('planAutoGInicio').value;
        const dias = Number(document.getElementById('planAutoGDias').value) || 14;
        const resEl = document.getElementById('planAutoGResultado');
        resEl.innerHTML = '<div class="pln-loading">Asignando...</div>';
        try {
            const res = await fetch('/api/produccion/planificacion-grupo/auto-asignar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inicio, dias, turnos_hoy: inicio === this._hoyStr() ? (this._turnosHoySel('planAutoGTurnos') || undefined) : undefined })
            });
            const data = await res.json();
            if (res.ok) {
                let html = `<div class="pln-ok" style="margin-bottom:8px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803d" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> <strong>${data.mensaje || 'Asignación completada'}</strong></div>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center">
                        <div class="pln-stat"><div class="v" style="color:#b45309">${data.ordenes_reprogramadas || 0}</div><div class="k">Órdenes asignadas</div></div>
                        <div class="pln-stat"><div class="v" style="color:#15803d">${data.pasos_fechados || 0}</div><div class="k">Pasos fechados</div></div>
                        <div class="pln-stat"><div class="v" style="color:#2563eb">${data.rutas_actualizadas || 0}</div><div class="k">Rutas sincronizadas</div></div>
                    </div>`;
                const alertas = (data && data.alertas) || [];
                const fuera = alertas.filter(a => a.fuera_de_ventana);
                if (fuera.length) {
                    html += `<div style="margin-top:10px;color:#7f1d1d;font-weight:800;font-size:12.5px">🔴 ${fuera.length} NO caben en su ventana rígida:</div>`;
                    html += fuera.slice(0, 12).map(a =>
                        `<div style="font-size:11px;color:#7f1d1d;padding:3px 0">• <strong>${a.pedido || ''}</strong> item ${a.item != null ? a.item : '-'}: ventana ${a.ventana_dias} días hábiles → límite ${String(a.fecha_limite || '').slice(5)} · estimada <strong>${String(a.fecha_nueva || '').slice(5)}</strong></div>`).join('');
                }
                resEl.innerHTML = html;
                await this.refrescarTodo();
                App.showAlert('Auto-asignación completada', 'success');
            } else {
                resEl.innerHTML = '<div class="pln-error">' + escText(data.error || 'Error') + '</div>';
            }
        } catch (e) {
            resEl.innerHTML = '<div class="pln-error">Error: ' + escText(e.message) + '</div>';
        }
    },

    // ---------------- Reprogramar ----------------
    showReprogramar() {
        const html = `
            <div class="pln-warnbox">
                <strong>Atención:</strong> esta acción liberará TODAS las órdenes que no estén EN PROCESO, TERMINADAS, MERMADAS ni CERRADAS (vuelven a PENDIENTE con sus pasos) y las re-asignará automáticamente respetando la prioridad:
                <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
                    <span class="pln-prio p-reposicion">4. Reposición</span>
                    <span class="pln-prio p-express">2. Express</span>
                    <span class="pln-prio p-urgencia">3. Urgencia</span>
                    <span class="pln-prio p-normal">1. Normal</span>
                </div>
                <div class="sub2" style="margin-top:8px"><strong>Protegidas:</strong> las órdenes EN PROCESO, MERMADAS y TERMINADAS no serán tocadas.</div>
            </div>
            <div style="margin-bottom:12px"><label style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#475569;margin-bottom:5px">Desde (fecha inicio búsqueda)</label>
            <input type="date" id="reprogInicio" value="${this._mananaHabil()}" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px"></div>
            <div><label style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#475569;margin-bottom:5px">Días hábiles a buscar capacidad (se extiende sola hasta 365 para programar todo)</label>
            <input type="number" id="reprogDias" value="21" min="1" max="60" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px"></div>
            <div id="reprogResultado" style="margin-top:12px"></div>
        `;
        const footer = `
            <button class="pln-btn ghost" onclick="App.hideModal()">Cerrar</button>
            <button class="pln-btn danger" onclick="App.modules.planificacion.ejecutarReprogramar()">Reprogramar Todo</button>
        `;
        App.showModalInv('↻ Reprogramar Pendientes', html, footer);
    },

    // ---------------- Reprogramar POR AVANCE (regla de planta) ----------------
    // Reprograma SOLO lo pendiente respetando lo avanzado: una orden con el
    // corte hecho NO vuelve a programar corte. Cola: primero los ATRASADOS
    // (fecha pactada <= hoy) y despues lo nuevo; dentro de cada grupo
    // Reposicion -> Express -> Urgencia -> Normal. Sin splits. Capacidad dura.
    // Día siguiente hábil (aprox. sáb/dom; el calendario de Configuración se
    // valida en el servidor). Default de los selectores "Desde" al reprogramar.
    _mananaHabil() {
        const d = new Date();
        do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },

    async showReprogramarAvance() {
        App.showModalInv('Reprogramar por Avance', '<div class="pln-loading">Cargando ordenes comprometidas...</div>', '<button class="pln-btn ghost" onclick="App.hideModal()">Cerrar</button>');
        let dv = {};
        try {
            const res = await fetch('/api/taller/dashboard', { headers: { 'Content-Type': 'application/json' } });
            const d = await res.json();
            dv = (d && d.desvio) || {};
        } catch (e) {
            dv = {};
        }
        const vencidas = dv.vencidas || [];
        const porVencer = dv.por_vencer || [];
        const fila = (o, venc) => `
            <div style="background:${venc ? '#fef2f2' : '#fffbeb'};border:1px solid ${venc ? '#fecaca' : '#fde68a'};border-radius:10px;padding:9px 12px;margin-bottom:7px">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
                    <strong style="font-size:12.5px">${o.pedido || ''} <span style="color:#94a3b8;font-weight:500">item ${o.item != null ? o.item : '-'}</span></strong>
                    <span class="pln-prio ${venc ? 'p-reposicion' : 'p-express'}" style="font-size:9px">${venc ? 'VENCIDA' : 'POR VENCER'} ${String(o.fecha_pactada || '').slice(5)}</span>
                </div>
                <div style="font-size:10px;color:#94a3b8;margin:2px 0 5px">${o.cliente || ''}</div>
                <div style="font-size:10.5px;display:flex;gap:6px;flex-wrap:wrap">
                    ${(o.avance || []).map(a => {
            const ok = a.estado === 'TERMINADO' || a.estado === 'MERMADO';
            const cur = a.estado === 'EN_PROCESO' || a.estado === 'PAUSADO';
            return `<span style="color:${ok ? '#15803d' : cur ? '#b45309' : '#94a3b8'}">${ok ? 'OK' : cur ? '>>' : '..'} ${a.estacion || ''}</span>`;
        }).join('<span style="color:#cbd5e1">·</span>')}
                </div>
            </div>`;
        const lista = [...vencidas.map(o => fila(o, true)), ...porVencer.map(o => fila(o, false))].slice(0, 8).join('');
        const html = `
            <div class="pln-warnbox">
                <strong>Reprogramacion POR AVANCE:</strong> se re-programa <strong>solo lo pendiente</strong> respetando lo ya fabricado (lo cortado NO se vuelve a programar), en la cola:
                <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
                    <span class="pln-prio p-reposicion">1. Atrasados primero</span>
                    <span class="pln-prio p-reposicion">4. Reposicion</span>
                    <span class="pln-prio p-express">2. Express</span>
                    <span class="pln-prio p-urgencia">3. Urgencia</span>
                    <span class="pln-prio p-normal">1. Normal</span>
                </div>
                <div class="sub2" style="margin-top:8px"><strong>Sin splits:</strong> no fragmenta ordenes avanzadas. Los pasos terminados/mermados son historia y los EN PROCESO se mantienen hoy ocupando capacidad.</div>
            </div>
            <div style="margin-bottom:12px"><label style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#475569;margin-bottom:5px">Desde (día de inicio de la re-programación — por defecto el día siguiente hábil; si eliges HOY se preguntan los turnos restantes)</label>
            <input type="date" id="reprogAvanceInicio" value="${this._mananaHabil()}" onchange="App.modules.planificacion._turnosHoyUI('reprogAvanceInicio','reprogAvanceTurnos')" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px"></div>
            <div id="reprogAvanceTurnos"></div>
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#475569;margin:4px 0 8px">Ordenes comprometidas incumplidas (${vencidas.length} vencidas · ${porVencer.length} por vencer)</div>
            <div style="max-height:38vh;overflow:auto">${lista || '<div class="pln-loading">Sin ordenes incumplidas</div>'}</div>
            <div id="reprogAvanceResultado" style="margin-top:12px"></div>
        `;
        const footer = `
            <button class="pln-btn ghost" style="margin-right:auto" title="Avanzado: libera TODO lo no iniciado y re-planifica desde cero (reinicio completo del plan)" onclick="App.modules.planificacion.showReprogramar()">⚙ Todo desde cero</button>
            <button class="pln-btn ghost" id="reprogAvanceCerrar" onclick="App.hideModal()">Cerrar</button>
            <button class="pln-btn warn" id="reprogAvanceRun" onclick="App.modules.planificacion.ejecutarReprogramarAvance()">Reprogramar por Avance</button>
        `;
        App.showModalInv('Reprogramar por Avance', html, footer);
        this._turnosHoyUI('reprogAvanceInicio', 'reprogAvanceTurnos');
    },

    async ejecutarReprogramarAvance() {
        const resEl = document.getElementById('reprogAvanceResultado');
        const btnRun = document.getElementById('reprogAvanceRun');
        const btnCerrar = document.getElementById('reprogAvanceCerrar');
        // BLOQUEO de la operación: botones inactivos mientras corre, avance
        // visible (spinner + segundos) y se sueltan SOLO al terminar
        if (btnRun) { btnRun.disabled = true; btnRun.style.opacity = '.5'; btnRun.textContent = '⏳ Reprogramando…'; }
        if (btnCerrar) { btnCerrar.disabled = true; btnCerrar.style.opacity = '.5'; }
        let seg = 0;
        const timer = setInterval(() => {
            seg++;
            const t = document.getElementById('reprogAvanceTimer');
            if (t) t.textContent = seg + 's';
        }, 1000);
        if (resEl) resEl.innerHTML = `
            <style>@keyframes plnSpin{to{transform:rotate(360deg)}}</style>
            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 16px;display:flex;align-items:center;gap:12px">
                <div style="width:22px;height:22px;border:3px solid #bfdbfe;border-top-color:#2563eb;border-radius:50%;animation:plnSpin .9s linear infinite"></div>
                <div>
                    <div style="font-size:13px;font-weight:700;color:#1e40af">Re-programando el plan… <span id="reprogAvanceTimer" style="font-variant-numeric:tabular-nums">0s</span></div>
                    <div style="font-size:11px;color:#64748b;margin-top:2px">Respetando lo fabricado, la cola de prioridades y la capacidad diaria. <strong>No cierres esta ventana</strong> — se liberará al completarse.</div>
                </div>
            </div>`;
        try {
            const desde = (document.getElementById('reprogAvanceInicio') || {}).value || '';
            const res = await fetch('/api/produccion/reprogramar/avance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...(desde ? { fecha_minima: desde } : {}),
                    ...(desde === this._hoyStr() ? { turnos_hoy: this._turnosHoySel('reprogAvanceTurnos') || undefined } : {})
                })
            });
            const data = await res.json();
            clearInterval(timer);
            // SOLTAR la operación: botones habilitados de nuevo
            if (btnRun) { btnRun.disabled = false; btnRun.style.opacity = '1'; btnRun.textContent = 'Reprogramar por Avance'; }
            if (btnCerrar) { btnCerrar.disabled = false; btnCerrar.style.opacity = '1'; }
            if (res.ok) {
                const alertas = data.alertas || [];
                const exceden = alertas.filter(a => a.excede_pacto);
                let html = `<div class="pln-ok" style="margin-bottom:8px;display:flex;align-items:center;gap:8px">
                        <span style="font-size:20px">✅</span>
                        <div><strong style="font-size:14px;color:#15803d">COMPLETADO en ${seg}s</strong>
                        <div style="font-size:12px;color:#166534">${data.mensaje || 'Reprogramacion completada'}</div></div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center">
                        <div class="pln-stat"><div class="v" style="color:#b45309">${data.ordenes_reprogramadas || 0}</div><div class="k">Ordenes</div></div>
                        <div class="pln-stat"><div class="v" style="color:#15803d">${data.pasos_fechados || 0}</div><div class="k">Pasos fechados</div></div>
                        <div class="pln-stat"><div class="v" style="color:#2563eb">${data.pasos_en_curso_respetados || 0}</div><div class="k">En curso (hoy)</div></div>
                    </div>`;
                if (exceden.length) {
                    html += `<div style="margin-top:10px;color:#b91c1c;font-weight:700;font-size:12px">⚠ ${exceden.length} exceden la fecha calculada anteriormente:</div>`;
                    html += exceden.slice(0, 12).map(a =>
                        `<div style="font-size:11px;color:#7f1d1d;padding:3px 0">• <strong>${a.pedido || ''}</strong> item ${a.item != null ? a.item : '-'}: ${String(a.fecha_anterior || '').slice(5)} → nueva ${String(a.fecha_nueva || '').slice(5)}</div>`).join('');
                }
                const fuera = alertas.filter(a => a.fuera_de_ventana);
                if (fuera.length) {
                    html += `<div style="margin-top:10px;color:#7f1d1d;font-weight:800;font-size:12.5px">🔴 ${fuera.length} NO caben en su ventana rígida (compromiso de prioridad incumplido):</div>`;
                    html += fuera.slice(0, 12).map(a =>
                        `<div style="font-size:11px;color:#7f1d1d;padding:3px 0">• <strong>${a.pedido || ''}</strong> item ${a.item != null ? a.item : '-'} (${({ 4: 'Reposición', 2: 'Express', 3: 'Urgencia', 1: 'Normal' })[a.prioridad] || ''}): ventana ${a.ventana_dias} días hábiles → límite ${String(a.fecha_limite || '').slice(5)} · estimada <strong>${String(a.fecha_nueva || '').slice(5)}</strong></div>`).join('');
                }
                if (resEl) resEl.innerHTML = html;
                if (window.App && App.toast) App.toast('✅ Reprogramación por avance completada (' + (data.ordenes_reprogramadas || 0) + ' órdenes)', 'success');
                this.refrescarTodo();
            } else {
                if (resEl) resEl.innerHTML = `<div class="pln-ok" style="background:#fee2e2;border-color:#fecaca;margin-bottom:8px"><span style="font-size:20px">❌</span> <strong style="color:#b91c1c">ERROR:</strong> ${data.error || 'no se pudo reprogramar'}</div>`;
                if (window.App && App.toast) App.toast('❌ La reprogramación falló', 'error');
            }
        } catch (e) {
            clearInterval(timer);
            if (btnRun) { btnRun.disabled = false; btnRun.style.opacity = '1'; btnRun.textContent = 'Reprogramar por Avance'; }
            if (btnCerrar) { btnCerrar.disabled = false; btnCerrar.style.opacity = '1'; }
            if (resEl) resEl.innerHTML = '<div class="pln-ok" style="background:#fee2e2;border-color:#fecaca;margin-bottom:8px"><span style="font-size:20px">❌</span> <strong style="color:#b91c1c">ERROR DE CONEXIÓN</strong> — no se pudo completar. Reintenta.</div>';
            if (window.App && App.toast) App.toast('❌ Error de conexión al reprogramar', 'error');
        }
    },

    async ejecutarReprogramar() {
        const inicio = document.getElementById('reprogInicio').value;
        const dias = Number(document.getElementById('reprogDias').value) || 21;
        const resEl = document.getElementById('reprogResultado');
        resEl.innerHTML = '<div class="pln-loading">Reprogramando: liberando y re-asignando por prioridad...</div>';
        try {
            const res = await fetch('/api/produccion/reprogramar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inicio, dias })
            });
            const data = await res.json();
            if (res.ok) {
                const numLiberadas = data.ordenes_liberadas || 0;
                const numAsignados = Array.isArray(data.asignados) ? data.asignados.length : 0;
                const numNoAsignados = Array.isArray(data.noAsignados) ? data.noAsignados.length : 0;
                let html = `<div class="pln-ok" style="margin-bottom:8px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803d" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> <strong>Reprogramación completada</strong></div>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center">
                        <div class="pln-stat"><div class="v" style="color:#b45309">${numLiberadas}</div><div class="k">Liberadas</div></div>
                        <div class="pln-stat"><div class="v" style="color:#15803d">${numAsignados}</div><div class="k">Re-asignadas</div></div>
                        <div class="pln-stat"><div class="v" style="color:#dc2626">${numNoAsignados}</div><div class="k">Sin cupo</div></div>
                    </div>`;
                if (numNoAsignados > 0) {
                    html += `<div style="margin-top:10px;color:#b91c1c;font-weight:700;font-size:13px">Sin capacidad (${numNoAsignados}):</div>`;
                    html += data.noAsignados.slice(0, 15).map(n =>
                        `<div class="pln-sincupo"><strong>${escapeHtml(n.pedido || n.orden_id)}</strong> — ${escapeHtml(n.motivo)} (${escapeHtml(n.grupo || '?')})</div>`
                    ).join('');
                }
                resEl.innerHTML = html;
                await this.refrescarTodo();
                App.showAlert('Reprogramación completada', 'success');
            } else {
                resEl.innerHTML = '<div class="pln-error">' + escText(data.error || 'Error') + '</div>';
            }
        } catch (e) {
            resEl.innerHTML = '<div class="pln-error">Error: ' + escText(e.message) + '</div>';
        }
    },

    // ---------------- Gráfico de carga (rango propio) ----------------
    async cargarDatos() {
        const inicio = this.chartInicio;
        const finD = new Date(this.chartInicio + 'T12:00:00');
        finD.setDate(finD.getDate() + 35);
        const fin = this.fmtDate(finD);
        try {
            const [grupoChartRes, grupoFinalesRes] = await Promise.all([
                fetch(`/api/produccion/planificacion/carga-por-grupo?inicio=${inicio}&fin=${fin}`, { cache: 'no-store' }),
                fetch(`/api/produccion/planificacion/carga-por-grupo-finales?inicio=${inicio}&fin=${fin}`, { cache: 'no-store' })
            ]);
            this.cargaPorGrupo = grupoChartRes.ok ? await grupoChartRes.json() : null;
            this.cargaPorGrupoFinales = grupoFinalesRes.ok ? await grupoFinalesRes.json() : null;
        } catch (e) {
            console.error('Error cargando gráfico:', e);
            this.cargaPorGrupo = null;
            this.cargaPorGrupoFinales = null;
        }
        this._actualizarRangoChart();
        if (this._vista === 'chart') this.renderChart();
    },

    _actualizarRangoChart() {
        const el = document.getElementById('plnChartRango');
        if (!el) return;
        const finD = new Date(this.chartInicio + 'T12:00:00');
        finD.setDate(finD.getDate() + 30);
        el.textContent = this._fecha(this.chartInicio) + ' → ' + this._fecha(this.fmtDate(finD));
    },

    cambiarChart(delta) {
        const d = new Date(this.chartInicio + 'T12:00:00');
        d.setDate(d.getDate() + delta * 30);
        this.chartInicio = this.fmtDate(d);
        this.cargarDatos();
    },

    cambiarModoChart(modo) {
        this.chartModo = modo;
        this.renderChart();
    },

    renderChart() {
        const div = document.getElementById('chartCargaGrupo');
        if (!div) return;
        const data = this.chartModo === 'finales' ? this.cargaPorGrupoFinales : this.cargaPorGrupo;
        const btnI = document.getElementById('plnModoInicio');
        const btnF = document.getElementById('plnModoFinales');
        if (btnI) { btnI.className = 'pln-btn ' + (this.chartModo === 'inicio' ? 'primary' : 'ghost') + ' sm'; }
        if (btnF) { btnF.className = 'pln-btn ' + (this.chartModo === 'finales' ? 'primary' : 'ghost') + ' sm'; }
        this._actualizarRangoChart();

        const legend = document.getElementById('plnChartLegend');
        const capProm = document.getElementById('plnCapProm');

        if (!data || !data.familias || data.familias.length === 0) {
            if (legend) legend.innerHTML = '';
            if (capProm) capProm.innerHTML = '';
            div.innerHTML = '<div class="pln-loading">Sin datos de carga en este período</div>';
            return;
        }

        const coloresMap = {};
        for (const g of this.capacidadGrupo) { coloresMap[g.grupo.toLowerCase()] = g.color || '#2563eb'; }
        const fallbackColors = ['#2563eb', '#7c3aed', '#0d9488', '#d97706', '#db2777', '#64748b', '#0ea5e9', '#b91c1c'];
        const findColor = (fam) => {
            const f = fam.toLowerCase();
            if (coloresMap[f]) return coloresMap[f];
            for (const key of Object.keys(coloresMap)) {
                if (f.startsWith(key) || key.startsWith(f) || f.includes(key) || key.includes(f)) return coloresMap[key];
            }
            return null;
        };
        const colores = data.familias.map((fam, i) => {
            const hex = findColor(fam) || fallbackColors[i % fallbackColors.length];
            const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
            return { bg: `rgba(${r},${g},${b},0.85)`, border: `rgba(${r},${g},${b},1)` };
        });

        const fechasConData = data.fechas.filter(f => data.familias.some(fam => (data.datos[fam][f] || 0) > 0));
        if (fechasConData.length === 0) {
            if (legend) legend.innerHTML = '';
            if (capProm) capProm.innerHTML = '';
            div.innerHTML = '<div class="pln-loading">Sin carga programada en este período. Use ◀ ▶ para moverse.</div>';
            return;
        }

        const labels = fechasConData.map(f => this._fechaCorta(f));
        const datasets = data.familias.map((fam, i) => ({
            label: fam,
            data: fechasConData.map(f => data.datos[fam][f] || 0),
            backgroundColor: colores[i % colores.length].bg,
            borderColor: colores[i % colores.length].border,
            borderWidth: 1,
            borderRadius: 2
        }));

        const capacidades = fechasConData.map(f => data.capacidad_por_dia[f] || 0);
        const capacidadPromedio = capacidades.reduce((a, b) => a + b, 0) / capacidades.length;
        datasets.push({
            label: 'Capacidad Producción',
            data: fechasConData.map(() => Math.round(capacidadPromedio * 100) / 100),
            type: 'line',
            borderColor: 'rgba(220,38,38,1)',
            borderWidth: 2,
            borderDash: [6, 3],
            pointRadius: 0,
            fill: false,
            order: -1
        });

        // ===== TOTALES =====
        // Suma de todos los grupos por día (se dibuja sobre cada barra) y
        // total del período — aplica a F. Inicio y F. Término
        const fmtT = (n) => this._fmt(n, 0);
        const totalesDia = fechasConData.map(f => data.familias.reduce((s, fam) => s + (Number(data.datos[fam][f]) || 0), 0));
        const totalPeriodo = totalesDia.reduce((a, b) => a + b, 0);
        const totalesPlugin = {
            id: 'totalesBarras',
            afterDatasetsDraw(chart) {
                const { ctx, scales } = chart;
                if (!scales || !scales.x || !scales.y) return;
                ctx.save();
                ctx.font = 'bold 11px sans-serif';
                ctx.fillStyle = '#0f172a';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                totalesDia.forEach((t, i) => {
                    if (!t) return;
                    try {
                        const xPos = scales.x.getPixelForValue(i);
                        const yPos = scales.y.getPixelForValue(t) - 4;
                        ctx.fillText(fmtT(t), xPos, yPos);
                    } catch (e) { }
                });
                ctx.restore();
            }
        };

        if (legend) {
            legend.innerHTML = '<div class="ttl">Grupos</div>' + data.familias.map((fam, i) =>
                '<span class="lg"><span class="dot" style="background:' + colores[i % colores.length].bg + '"></span>' + escText(fam) + '</span>'
            ).join('');
        }
        if (capProm) {
            capProm.innerHTML = 'Capacidad promedio de producción: <strong>' + this._fmt(capacidadPromedio, 0) + ' kg/día</strong>'
                + ' · Total del período: <strong>' + this._fmt(totalPeriodo, 0) + ' kg</strong>'
                + ' · Promedio por día: <strong>' + this._fmt(fechasConData.length ? totalPeriodo / fechasConData.length : 0, 0) + ' kg</strong>';
        }

        if (this._chartInstance) { this._chartInstance.destroy(); this._chartInstance = null; }
        const ctx = document.getElementById('chartCargaGrupo');
        if (!ctx) return;
        this._chartInstance = new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets },
            plugins: [ChartDataLabels, totalesPlugin],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onClick: (evt, elements, chart) => {
                    if (!elements.length) return;
                    const el = elements[0];
                    const fam = chart.data.datasets[el.datasetIndex].label;
                    if (fam === 'Capacidad Producción') return;
                    this.detalleGrupoDia(fam, fechasConData[el.index]);
                },
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        display: function (ctx) {
                            if (ctx.dataset.type === 'line') return false;
                            const val = ctx.dataset.data[ctx.dataIndex];
                            return val > 0;
                        },
                        color: '#fff',
                        font: { size: 10, weight: 'bold' },
                        formatter: function (value) {
                            if (!value || value <= 0) return '';
                            return value >= 1000 ? (value / 1000).toFixed(1) + 'k' : Math.round(value);
                        },
                        anchor: 'center',
                        align: 'center'
                    },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                const val = ctx.parsed ? ctx.parsed.y : ctx.raw;
                                if (ctx.dataset.type === 'line') return `Capacidad: ${Number(val).toLocaleString('es-CL')} kg`;
                                return `${ctx.dataset.label}: ${Number(val).toLocaleString('es-CL', { maximumFractionDigits: 1 })} kg`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        grid: { color: 'rgba(148,163,184,0.15)' },
                        ticks: { font: { size: 11 } }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        grid: { color: 'rgba(148,163,184,0.15)' },
                        title: { display: false },
                        ticks: {
                            font: { size: 10 },
                            callback: (v) => Number(v).toLocaleString('es-CL')
                        }
                    }
                }
            }
        });
    },

    // ---------------- Carga por Estaciones (rango propio) ----------------
    cambiarDiasEstaciones(valor) {
        const n = parseInt(valor);
        if (!n || n < 1 || n > 60) return;
        this.diasEstaciones = n;
        this.cargarEstaciones();
    },

    cambiarSemanaEstaciones(delta) {
        // SOLO mueve el rango de estaciones (antes mutaba semanaInicio y
        // arrastraba al gráfico y al resto del módulo).
        const d = new Date(this.estacInicio + 'T12:00:00');
        d.setDate(d.getDate() + delta * this.diasEstaciones);
        this.estacInicio = this.fmtDate(d);
        this.cargarEstaciones();
    },

    async cargarEstaciones() {
        const inicio = this.estacInicio;
        const finD = new Date(this.estacInicio + 'T12:00:00');
        finD.setDate(finD.getDate() + this.diasEstaciones - 1);
        const fin = this.fmtDate(finD);
        const rango = document.getElementById('plnEstacRango');
        if (rango) rango.textContent = this._fecha(inicio) + ' → ' + this._fecha(fin);
        try {
            const res = await fetch(`/api/produccion/planificacion/carga-estaciones?inicio=${inicio}&fin=${fin}`, { cache: 'no-store' });
            if (!res.ok) {
                const el = document.getElementById('planEstaciones');
                if (el) el.innerHTML = '<div class="pln-error">Error ' + res.status + ' al cargar las estaciones</div>';
                return;
            }
            this.renderEstaciones(await res.json());
        } catch (e) {
            console.error('cargarEstaciones:', e);
            const el = document.getElementById('planEstaciones');
            if (el) el.innerHTML = '<div class="pln-error">Error: ' + escText(e.message) + '</div>';
        }
    },

    renderEstaciones(data) {
        const el = document.getElementById('planEstaciones');
        if (!el) return;
        const { estaciones, carga, calendario } = data;

        if (!estaciones || estaciones.length === 0) {
            el.innerHTML = '<div class="pln-loading">No hay estaciones configuradas</div>';
            return;
        }

        // Días corridos desde estacInicio, filtrando días hábiles
        const todosDias = [];
        for (let i = 0; i < this.diasEstaciones; i++) {
            const d = new Date(this.estacInicio + 'T12:00:00');
            d.setDate(d.getDate() + i);
            const fs = this.fmtDate(d);
            const cal = calendario ? calendario[fs] : null;
            const esLaboral = cal ? cal.es_laboral : (d.getDay() !== 0 && d.getDay() !== 6);
            if (esLaboral) todosDias.push(fs);
        }

        const pct = (usado, cap) => cap > 0 ? Math.round((usado / cap) * 100) : 0;
        const barColor = (p) => p >= 100 ? '#dc2626' : p >= 85 ? '#d97706' : p >= 50 ? '#2563eb' : '#16a34a';

        let html = '<table class="pln-matriz"><colgroup><col class="c-est"><col class="c-cap">';
        todosDias.forEach(() => { html += '<col>'; });
        html += '</colgroup><thead><tr><th>Estación</th><th class="num">Cap.</th>';
        todosDias.forEach(f => {
            html += '<th>' + this._fechaCorta(f) + '</th>';
        });
        html += '</tr></thead><tbody>';

        estaciones.forEach(est => {
            html += '<tr>';
            html += '<td class="c-est">' + escText(est.nombre) + (est.cuello_botella ? ' <span class="pln-cb" title="Cuello de botella">CB</span>' : '') + '</td>';
            html += '<td class="num cap">' + this._fmt(est.capacidad_m2_dia, 0) + '</td>';
            todosDias.forEach(f => {
                const datos = (carga[f] && carga[f][est.id]) || { m2: 0, ordenes: 0 };
                const p = pct(datos.m2, est.capacidad_m2_dia);
                html += '<td><div class="m2" style="color:' + barColor(p) + '">' + this._fmt(datos.m2, 1) + '</div>'
                    + '<div class="track"><div class="fill" style="width:' + Math.min(p, 100) + '%;background:' + barColor(p) + '"></div></div>'
                    + '<div class="sub2">' + p + '% · ' + datos.ordenes + ' ord</div></td>';
            });
            html += '</tr>';
        });
        html += '</tbody></table>';
        el.innerHTML = html;
    },

    // ---------------- Estilos (escala 20/15/13/11/10) ----------------
    _estilos() {
        return `<style>
            .pln-hero{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 55%,#1e40af 100%);border-radius:16px;padding:20px 26px;position:relative;overflow:hidden;margin-bottom:14px}
            .pln-hero::after{content:'';position:absolute;left:0;right:0;bottom:0;height:1px;background:linear-gradient(90deg,transparent,rgba(147,197,253,.55),transparent)}
            .pln-hero h2{color:#fff;font-size:20px;font-weight:700;margin:0}
            .pln-hero p{color:rgba(255,255,255,.62);font-size:11px;margin:4px 0 0}

            .pln-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:14px}
            .pln-kpi{background:#fff;border:1px solid #e4e9f0;border-radius:12px;padding:13px 16px}
            .pln-kpi .k{font-size:10px;font-weight:600;letter-spacing:.7px;text-transform:uppercase;color:#8494a8}
            .pln-kpi .v{font-size:20px;font-weight:700;margin-top:4px;color:#0f172a}
            .pln-kpi .s{font-size:10px;color:#8494a8;margin-top:2px}

            .pln-tabs{display:flex;gap:4px;background:#e2e8f0;padding:4px;border-radius:10px;width:max-content;margin-bottom:12px}
            .pln-tab{padding:8px 18px;border-radius:8px;font-size:11px;font-weight:700;color:#475569;cursor:pointer;white-space:nowrap}
            .pln-tab.on{background:#fff;color:#0f172a;box-shadow:0 1px 3px rgba(15,23,42,.1)}

            .pln-panel{background:#fff;border:1px solid #e4e9f0;border-radius:14px;overflow:hidden}
            .pln-p-head{padding:13px 18px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #e4e9f0;flex-wrap:wrap}
            .pln-p-head h3{font-size:13px;font-weight:600;margin:0}
            .pln-p-head .sub{font-size:10px;color:#8494a8}
            .pln-p-body{padding:16px 18px}
            .pln-nav{margin-left:auto;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
            .pln-navbtn{width:30px;height:30px;border-radius:8px;border:1px solid #e4e9f0;background:#fff;color:#475569;cursor:pointer;font-size:13px}
            .pln-navbtn:hover{background:#f8fafc}
            .pln-rango{font-size:11px;font-weight:700;color:#334155;white-space:nowrap}
            .pln-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#8494a8}
            .pln-nav input[type=date],.pln-nav input[type=number]{padding:8px 10px;border:1px solid #e4e9f0;border-radius:8px;font-size:13px;color:#0f172a}

            .pln-btn{padding:9px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid transparent;white-space:nowrap}
            .pln-btn.primary{background:#1e40af;color:#fff}
            .pln-btn.primary:hover{background:#1e3a8a}
            .pln-btn.ghost{background:#fff;color:#475569;border-color:#e4e9f0}
            .pln-btn.ghost:hover{background:#f8fafc}
            .pln-btn.warn{background:#fff;color:#b45309;border-color:#fde68a}
            .pln-btn.danger{background:#dc2626;color:#fff}
            .pln-btn.danger:hover{background:#b91c1c}
            .pln-btn.sm{padding:7px 12px;font-size:11px}

            .pln-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
            .pln-card{background:#fff;border:1px solid #e4e9f0;border-radius:12px;padding:13px 15px}
            .pln-card .top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px}
            .pln-card .gname{font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#8494a8}
            .pln-card .gval{font-size:20px;font-weight:700;margin-top:2px}
            .pln-card .gval .cap{font-size:11px;color:#8494a8;font-weight:500}
            .pln-card .right{text-align:right}
            .pln-card .pct{font-size:20px;font-weight:700}
            .pln-card .track{height:8px;border-radius:6px;background:#f1f5f9;overflow:hidden;margin-bottom:8px}
            .pln-card .fill{height:100%;border-radius:6px;transition:width .3s}
            .pln-card .foot{display:flex;justify-content:space-between;font-size:11px;color:#8494a8}

            .chip{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap}
            .b-red{background:#fee2e2;color:#b91c1c}
            .b-amber{background:#fef3c7;color:#b45309}
            .b-green{background:#dcfce7;color:#15803d}
            .b-gray{background:#f1f5f9;color:#64748b}

            .pln-pend-resumen{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;background:#f8fafc;border:1px solid #e4e9f0;border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:13px}
            .pln-pend-resumen .tip{font-size:11px;color:#8494a8}
            .pln-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
            .pln-table{width:100%;border-collapse:collapse;min-width:820px}
            .pln-table th{padding:9px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#8494a8;background:#f8fafc;border-bottom:1px solid #e4e9f0;white-space:nowrap}
            .pln-table td{padding:10px 12px;font-size:13px;border-bottom:1px solid #f1f5f9;vertical-align:top}
            .pln-table tbody tr:hover{background:#f8fafc}
            .pln-table .num{text-align:right;font-variant-numeric:tabular-nums}
            .pln-table .th-acc{text-align:right}
            .pln-table .c-acc{text-align:right;white-space:nowrap}
            .pln-table .c-ped strong{color:#0f172a}
            .sub2{font-size:10px;color:#8494a8;margin-top:1px}
            .pln-bom{font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;background:#ede9fe;color:#7c3aed}
            .pln-hint-danger{font-size:11px;color:#dc2626;font-weight:600}

            .pln-chart-row{display:flex;gap:16px;align-items:stretch}
            .pln-legend{display:flex;flex-direction:column;gap:6px;font-size:11px;color:#475569;min-width:130px}
            .pln-legend .ttl{font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#8494a8;margin-bottom:2px}
            .pln-legend .lg{display:flex;align-items:center;gap:6px}
            .pln-legend .dot{width:10px;height:10px;border-radius:50%;display:inline-block}
            .pln-chart-box{position:relative;height:320px;flex:1;min-width:0}
            .pln-capinfo{font-size:11px;color:#8494a8;margin-top:10px}
            .pln-capinfo strong{color:#334155}

            .pln-matriz-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
            .pln-matriz{width:100%;border-collapse:collapse;font-size:13px;table-layout:fixed;min-width:900px}
            .pln-matriz .c-est{width:190px}
            .pln-matriz .c-cap{width:70px}
            .pln-matriz th{padding:8px 10px;text-align:center;font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#8494a8;background:#f8fafc;border-bottom:1px solid #e4e9f0;white-space:nowrap}
            .pln-matriz th:first-child{text-align:left}
            .pln-matriz td{padding:8px 10px;text-align:center;border-bottom:1px solid #f1f5f9}
            .pln-matriz td.c-est{text-align:left;font-weight:600;white-space:nowrap}
            .pln-matriz td.cap{color:#8494a8;font-size:11px}
            .pln-matriz .m2{font-weight:700;margin-bottom:3px}
            .pln-matriz .track{background:#e5e7eb;border-radius:4px;height:6px;overflow:hidden}
            .pln-matriz .fill{height:100%;transition:width .3s}
            .pln-cb{font-size:10px;font-weight:700;padding:1px 5px;border-radius:3px;background:#fee2e2;color:#dc2626;cursor:help}

            .pln-ok{background:#dcfce7;border:1px solid #bbf7d0;border-radius:9px;padding:11px 14px;font-size:13px;color:#166534;display:flex;align-items:center;gap:8px}
            .pln-error{background:#fee2e2;border:1px solid #fecaca;border-radius:9px;padding:11px 14px;font-size:13px;color:#991b1b}
            .pln-warnbox{background:#fef2f2;border:1px solid #fecaca;border-radius:9px;padding:12px 14px;font-size:13px;color:#991b1b;line-height:1.6}
            .pln-sincupo{margin-top:4px;padding:7px 10px;background:#fef2f2;border-radius:7px;border-left:3px solid #dc2626;font-size:13px;color:#7f1d1d}
            .pln-stat{background:#f8fafc;border:1px solid #e4e9f0;border-radius:8px;padding:10px}
            .pln-stat .v{font-size:20px;font-weight:700}
            .pln-stat .k{font-size:10px;color:#8494a8;text-transform:uppercase;letter-spacing:.6px;font-weight:600}

            .pln-prio{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap}
            .p-normal{background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe}
            .p-express{background:#fef9c3;color:#854d0e;border:1px solid #fde047}
            .p-urgencia{background:#dcfce7;color:#15803d;border:1px solid #86efac}
            .p-reposicion{background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5}

            .pln-loading{text-align:center;padding:30px;color:#8494a8;font-size:13px}
            .pln-cards-mobile{display:none}
            .pln-mcard{border:1px solid #e4e9f0;border-radius:12px;padding:12px 14px;margin-bottom:8px;background:#fff}
            .pln-mcard .t1{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px;font-size:13px}
            .pln-mcard .acc{display:flex;gap:6px;margin-top:8px}

            @media(max-width:768px){
                .pln-hero{padding:16px}
                .pln-hero h2{font-size:15px}
                .pln-kpis{grid-template-columns:1fr 1fr;gap:8px}
                .pln-kpi .v{font-size:15px}
                .pln-tabs{width:100%}
                .pln-tab{flex:1;text-align:center;padding:8px 6px}
                .pln-p-head{flex-direction:column;align-items:flex-start}
                .pln-nav{margin-left:0;width:100%}
                .pln-chart-row{flex-direction:column}
                .pln-chart-box{height:200px}
                .pln-table-wrap{display:none}
                .pln-cards-mobile{display:block}
            }
        </style>`;
    }
};
