// ============================================================================
// Producción · Órdenes — rediseño "menos engorroso"
//   · Tabla de 8 columnas esenciales; TODO lo demás vive en el panel de detalle
//     lateral (click en la fila), con los pasos de producción ahí mismo.
//   · Vista Tablero por estados para el día a día (Pendientes → Programadas →
//     En proceso → Terminadas).
//   · Cantidad editable inline · menú de Acciones con texto · confirmaciones en
//     modal (sin confirm()/prompt() nativos).
//   · Colores de PRIORIDAD con el idioma de las etiquetas físicas:
//     Normal azul · Express amarillo · Urgencia verde · Reposición rojo.
//   · Números es-CL (coma decimal) · fechas dd-mm-yyyy · escala 20/15/13/11/10.
//   · "Zona de mantenimiento" aparte: Reprogramar Todo / Limpiar Todo.
// Mantiene TODO el flujo API del módulo original (importar SAP, pasos, BOM,
// prioridades, reprogramación, cierre con motivo).
// ============================================================================
App.registerModule('produccion', {
    ordenes: [],
    maquinas: [],
    recetas: [],
    _vista: 'tabla',
    _drawerId: null,
    _cerrarId: null,
    _editCantId: null,

    async render() {
        const el = document.getElementById('page-produccion');
        if (!el) { console.error('page-produccion element not found'); return; }
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const permisos = user.permisos || [];
        const esAdmin = permisos.includes('usuarios');
        const puedeImportar = esAdmin || permisos.includes('produccion');

        el.innerHTML = this._estilos() + `
            <div class="po-hero">
                <div>
                    <h2>Producción · Órdenes</h2>
                    <p>Click en cualquier fila para ver su detalle y pasos · números es-CL · colores según etiquetas</p>
                </div>
                ${puedeImportar ? `<div class="po-hero-actions">
                    <button class="po-hbtn" onclick="App.modules.produccion.showImportModal()">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        Importar SAP
                    </button>
                    <button class="po-hbtn" onclick="window.open('/api/produccion/exportar-corte','_blank')" title="Exporta las órdenes ingresadas y programadas para corte (lista de corte en Excel)">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Exportar corte
                    </button>
                    <button class="po-hbtn solid" onclick="App.modules.produccion.showNewOrderModal()">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Nueva Orden
                    </button>
                    <div class="po-mant">
                        <button class="po-hbtn ghost-danger" id="reprogBtn" onclick="App.modules.produccion.toggleMant(event)">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                            Zona de mantenimiento
                            <span id="reprogBadge" class="po-reprog-badge">!</span>
                        </button>
                        <div class="po-mant-drop" id="poMantDrop">
                            <div class="it" onclick="App.modules.produccion.reprogramarTodo()">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                                Reprogramar Todo (por prioridad)
                            </div>
                            <div class="it" onclick="App.modules.produccion.resincronizarEstados()">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                                Resincronizar estados
                            </div>
                            <div class="sep"></div>
                            <div class="it danger" onclick="App.modules.produccion.eliminarTodas()">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                Limpiar Todo (eliminar todas las órdenes)
                            </div>
                        </div>
                    </div>
                </div>` : ''}
            </div>

            <div class="po-kpis">
                <div class="po-kpi"><div class="k">Total órdenes</div><div class="v" id="prodTotal">0</div><div class="s" id="prodTotalSub">—</div></div>
                <div class="po-kpi"><div class="k">Pendientes</div><div class="v c-pend" id="prodPendientes">0</div><div class="s">sin fecha asignada</div></div>
                <div class="po-kpi"><div class="k">Programadas</div><div class="v c-prog" id="prodProgramadas">0</div><div class="s">con fecha asignada</div></div>
                <div class="po-kpi"><div class="k">En proceso</div><div class="v c-proceso" id="prodProceso">0</div><div class="s">en estación ahora</div></div>
                <div class="po-kpi"><div class="k">Terminadas</div><div class="v c-term" id="prodTerminadas">0</div><div class="s">este período</div></div>
            </div>

            <div class="po-toolbar">
                <div class="po-search">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8494a8" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" id="prodFilterSearch" placeholder="Buscar pedido, código o cliente..." oninput="App.modules.produccion.filter()">
                </div>
                <select id="prodFilterEstado" onchange="App.modules.produccion.filter()">
                    <option value="todos">Todos los estados</option><option value="PENDIENTE">Pendientes</option><option value="PROGRAMADO">Programadas</option><option value="EN_PROCESO">En Proceso</option><option value="TERMINADO">Terminadas</option><option value="MERMADO">Mermadas</option><option value="CERRADO">Cerradas</option>
                </select>
                <select id="prodFilterGrupo" onchange="App.modules.produccion.filter()"><option value="todos">Todos los grupos</option></select>
                <select id="prodFilterFamilia" onchange="App.modules.produccion.filter()"><option value="todas">Todas las familias</option></select>
                <select id="prodFilterEstacion" onchange="App.modules.produccion.filter()"><option value="todas">Todas las estaciones</option></select>
                <input type="date" id="prodFilterFecha" onchange="App.modules.produccion.filter()" title="Filtrar por fecha programada">
                <span class="po-flimpiar" onclick="App.modules.produccion.limpiarFiltros()">Limpiar filtros</span>
            </div>

            <div class="po-tabs">
                <div class="po-tab on" id="poTabTabla" onclick="App.modules.produccion.setVista('tabla')">☰ &nbsp;Tabla</div>
                <div class="po-tab" id="poTabTablero" onclick="App.modules.produccion.setVista('tablero')">▦ &nbsp;Tablero por estados</div>
            </div>

            <div id="poPanelTabla" class="po-panel">
                <div class="po-p-head">
                    <h3>Órdenes de producción</h3>
                    <span class="sub">click en la fila → detalle y pasos</span>
                    <div class="po-tot" id="prodTotales"></div>
                </div>
                <div class="po-table-wrap">
                    <table class="po-table">
                        <thead><tr>
                            <th>Pedido · Item</th><th>Cliente</th><th>Código SAP</th><th>Descripción</th><th>Código / MP</th><th>Dimensiones</th>
                            <th class="num">Cant.</th><th>Prioridad</th><th>Estado</th><th class="th-acc">Acciones</th>
                        </tr></thead>
                        <tbody id="prodTable"><tr><td colspan="10" class="po-loading">Cargando órdenes...</td></tr></tbody>
                    </table>
                </div>
                <div id="prodCardsMobile" class="po-cards-mobile"></div>
            </div>

            <div id="poPanelTablero" class="po-panel" style="display:none;padding:14px">
                <div class="po-board" id="poBoard"></div>
            </div>

            <!-- Panel de detalle lateral -->
            <div class="po-dim" id="poDim" onclick="App.modules.produccion.cerrarDrawer()"></div>
            <div class="po-drawer" id="poDrawer"></div>

            <!-- Modal importar -->
            <div class="po-overlay" id="prodImportModal">
                <div class="po-modal" onclick="event.stopPropagation()">
                    <div class="po-modal-head"><h3>Importar desde Excel (SAP)</h3><button class="po-x" onclick="App.modules.produccion.hideImportModal()">✕</button></div>
                    <div class="po-modal-body">
                        <label class="po-label">Archivo Excel</label>
                        <div id="prodImportArea" class="po-drop" onclick="document.getElementById('prodImportFile').click()">
                            🏷️ 
                            <div class="t">Arrastra un Excel o haz clic para seleccionar</div>
                            <div id="prodImportName" class="ok"></div>
                        </div>
                        <input type="file" id="prodImportFile" accept=".xlsx,.xls,.csv" style="display:none" onchange="App.modules.produccion.handleImportFile(event)">
                        <div class="po-info">
                            <strong>Columnas de la plantilla:</strong><br>
                            <strong>Obligatoria:</strong> codigo<br>
                            <strong>Opcionales:</strong> pedido, item, cliente, descripcion, cantidad, ancho, alto, kilos, precio, familia, perforaciones, mecanizado, destaje, sacado, radio, pulido, ventana, pintado, pintado car, tipo de venta, fecha_creacion, nota, posicion, orden de compra, tipo de entrega<br>
                            <em>Las flags (perforaciones, mecanizado, destaje, sacado, radio, pulido, ventana, pintado, pintado car) van con 0 o 1. Si falta ancho/alto se toman del BOM del código. Filas iguales (pedido+item+codigo) se fusionan sumando cantidad.</em>
                            <div style="margin-top:10px"><button class="po-btn ghost sm" onclick="window.open('/api/produccion/importar/template')">⬇ Descargar Plantilla</button></div>
                        </div>
                        <div id="prodImportPreview" class="po-preview"></div>
                    </div>
                    <div class="po-modal-foot">
                        <button class="po-btn ghost" onclick="App.modules.produccion.hideImportModal()">Cancelar</button>
                        <button class="po-btn primary" id="prodImportBtn" onclick="App.modules.produccion.importar()" disabled>Importar</button>
                    </div>
                </div>
            </div>

            <!-- Modal nueva orden -->
            <div class="po-overlay" id="prodNewOrderModal">
                <div class="po-modal" onclick="event.stopPropagation()">
                    <div class="po-modal-head"><h3>Nueva Orden Manual</h3><button class="po-x" onclick="App.modules.produccion.hideNewOrderModal()">✕</button></div>
                    <div class="po-modal-body">
                        <div class="po-form-grid">
                            <div class="po-field"><label>Pedido *</label><input id="newOrdPedido" placeholder="Ej: 100500"></div>
                            <div class="po-field"><label>Item</label><input id="newOrdItem" type="number" value="1" min="1"></div>
                            <div class="po-field"><label>Cliente</label><input id="newOrdCliente" placeholder="NOMBRE DEL CLIENTE" oninput="this.value=this.value.toUpperCase()"></div>
                            <div class="po-field"><label>Código producto *</label><input id="newOrdCodigo" placeholder="Ej: 1240, 730"></div>
                            <div class="po-field"><label>Ancho (mm) *</label><input id="newOrdAncho" type="number" value="0"></div>
                            <div class="po-field"><label>Alto (mm) *</label><input id="newOrdAlto" type="number" value="0"></div>
                            <div class="po-field"><label>Perforaciones</label><select id="newOrdPerforaciones"><option value="0">No</option><option value="1">Sí</option></select></div>
                            <div class="po-field"><label>Pintado</label><select id="newOrdPintado"><option value="0">No (0)</option><option value="1">Sí (1)</option></select></div>
                            <div class="po-field"><label>Tipo de venta</label><select id="newOrdTipoVenta"><option value="Normal">Normal</option><option value="Express">Express</option><option value="Vta Region">Vta Region</option><option value="Urgencia">Urgencia</option></select></div>
                            <div class="po-field"><label>Cantidad</label><input id="newOrdCantidad" type="number" value="1" min="1"></div>
                            <div class="po-field"><label>Tipo de entrega</label><select id="newOrdTipoEntrega"><option value="Despacho">Despacho</option><option value="Retira">Retira</option></select></div>
                            <div class="po-field"><label>Orden de compra</label><input id="newOrdOC" placeholder="OC-001"></div>
                            <div class="po-field"><label>Posición</label><input id="newOrdPosicion" placeholder="Ej: 1, 2, A1"></div>
                            <div class="po-field"><label>Fecha creación</label><input id="newOrdFechaCreacion" type="date"></div>
                            <div class="po-field" style="grid-column:1/-1"><label>Nota</label><textarea id="newOrdNota" rows="2" placeholder="Observaciones..."></textarea></div>
                        </div>
                    </div>
                    <div class="po-modal-foot">
                        <button class="po-btn ghost" onclick="App.modules.produccion.hideNewOrderModal()">Cancelar</button>
                        <button class="po-btn primary" onclick="App.modules.produccion.saveNewOrder()">Crear Orden</button>
                    </div>
                </div>
            </div>

            <!-- Modal cerrar orden -->
            <div class="po-overlay" id="prodCerrarModal">
                <div class="po-modal sm" onclick="event.stopPropagation()">
                    <div class="po-modal-head"><h3>Cerrar Orden</h3><button class="po-x" onclick="App.modules.produccion.hideCerrarModal()">✕</button></div>
                    <div class="po-modal-body">
                        <p class="po-confirm-text">Indica el motivo por el cual se cierra esta línea:</p>
                        <textarea id="cerrarNota" rows="3" placeholder="Ej: Cliente canceló el pedido..."></textarea>
                    </div>
                    <div class="po-modal-foot">
                        <button class="po-btn ghost" onclick="App.modules.produccion.hideCerrarModal()">Cancelar</button>
                        <button class="po-btn danger" onclick="App.modules.produccion.confirmCerrar()">Cerrar Orden</button>
                    </div>
                </div>
            </div>

            <!-- Modal editar cantidad -->
            <div class="po-overlay" id="poCantModal">
                <div class="po-modal sm" onclick="event.stopPropagation()">
                    <div class="po-modal-head"><h3>Editar cantidad</h3><button class="po-x" onclick="App.modules.produccion.hideEditCantidad()">✕</button></div>
                    <div class="po-modal-body">
                        <div class="po-field"><label>Nueva cantidad</label><input id="poCantInput" type="number" min="1" value="1"></div>
                        <div class="po-hint" id="poCantM2"></div>
                    </div>
                    <div class="po-modal-foot">
                        <button class="po-btn ghost" onclick="App.modules.produccion.hideEditCantidad()">Cancelar</button>
                        <button class="po-btn primary" onclick="App.modules.produccion.confirmEditCantidad()">Guardar</button>
                    </div>
                </div>
            </div>

            <!-- Modal confirmación genérico -->
            <div class="po-overlay" id="poConfirmOverlay">
                <div class="po-modal sm" onclick="event.stopPropagation()">
                    <div class="po-modal-head"><h3 id="poConfirmTitle">Confirmar</h3><button class="po-x" onclick="App.modules.produccion.closeConfirm()">✕</button></div>
                    <div class="po-modal-body"><p class="po-confirm-text" id="poConfirmText"></p></div>
                    <div class="po-modal-foot">
                        <button class="po-btn ghost" onclick="App.modules.produccion.closeConfirm()">Cancelar</button>
                        <button class="po-btn danger" id="poConfirmBtn">Confirmar</button>
                    </div>
                </div>
            </div>`;

        await this.load();
        this.setupDragDrop();
        this._setupPrioridadEvents();
    },

    // ---------------- Helpers de formato (es-CL / dd-mm-yyyy) ----------------
    _fmt(v, dec) {
        const n = Number(v || 0);
        return n.toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    },
    _fecha(f) {
        if (!f) return '—';
        const d = new Date(f);
        if (isNaN(d.getTime())) return '—';
        const p = n => String(n).padStart(2, '0');
        return `${p(d.getUTCDate())}-${p(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`;
    },
    _fechaHora(f) {
        if (!f) return '—';
        const d = new Date(f);
        if (isNaN(d.getTime())) return '—';
        const p = n => String(n).padStart(2, '0');
        return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
    },

    // ---------------- Carga ----------------
    async load() {
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const headers = { 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' };
            const [ordenesRes, maquinasRes, recetasRes] = await Promise.all([
                fetch('/api/produccion/ordenes', { headers }),
                fetch('/api/produccion/maquinas', { headers }),
                fetch('/api/produccion/recetas', { headers })
            ]);
            if (!ordenesRes.ok) throw new Error('HTTP ' + ordenesRes.status);
            this.ordenes = await ordenesRes.json();
            this.maquinas = await maquinasRes.json();
            this.recetas = await recetasRes.json();
            this.renderStats();
            this.populateFilters();
            this.filter();
        } catch (e) {
            console.error('Error loading produccion:', e);
            const tbody = document.getElementById('prodTable');
            if (tbody) tbody.innerHTML = '<tr><td colspan="10" class="po-loading" style="color:#dc2626">Error al cargar: ' + escText(e.message || 'No se pudo cargar') + '</td></tr>';
            App.showAlert('Error al cargar órdenes: ' + (e.message || ''), 'danger');
        }
    },

    limpiarFiltros() {
        const s = document.getElementById('prodFilterSearch'); if (s) s.value = '';
        ['prodFilterEstado', 'prodFilterGrupo', 'prodFilterFamilia', 'prodFilterEstacion'].forEach(id => {
            const el = document.getElementById(id); if (el) el.selectedIndex = 0;
        });
        const f = document.getElementById('prodFilterFecha'); if (f) f.value = '';
        this.filter();
    },

    setVista(v) {
        this._vista = v;
        document.getElementById('poTabTabla').classList.toggle('on', v === 'tabla');
        document.getElementById('poTabTablero').classList.toggle('on', v === 'tablero');
        document.getElementById('poPanelTabla').style.display = v === 'tabla' ? '' : 'none';
        document.getElementById('poPanelTablero').style.display = v === 'tablero' ? '' : 'none';
        if (v === 'tablero') this.renderBoard(this._filtradas || this.ordenes);
    },

    populateFilters() {
        const grupos = [...new Set(this.ordenes.map(o => o.grupo).filter(Boolean))].sort();
        const familias = [...new Set(this.ordenes.map(o => o.familia_nombre).filter(Boolean))].sort();
        const estaciones = [...new Set(this.ordenes.flatMap(o => o.estaciones || []).filter(Boolean))].sort();
        const fill = (id, opciones, textoTodos, valTodos) => {
            const sel = document.getElementById(id);
            if (!sel) return;
            const cur = sel.value;
            sel.innerHTML = `<option value="${valTodos}">${textoTodos}</option>` + opciones.map(o => `<option value="${escAttr(o)}" ${o === cur ? 'selected' : ''}>${escText(o)}</option>`).join('');
        };
        fill('prodFilterGrupo', grupos, 'Todos los grupos', 'todos');
        fill('prodFilterFamilia', familias, 'Todas las familias', 'todas');
        fill('prodFilterEstacion', estaciones, 'Todas las estaciones', 'todas');
    },

    renderStats() {
        const total = this.ordenes.length;
        const c = e => this.ordenes.filter(o => o.estado_programacion === e).length;
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('prodTotal', total);
        set('prodPendientes', c('PENDIENTE'));
        set('prodProgramadas', c('PROGRAMADO'));
        set('prodProceso', c('EN_PROCESO'));
        set('prodTerminadas', c('TERMINADO'));
        const totalCant = this.ordenes.reduce((s, o) => s + Number(o.cantidad || 0), 0);
        const totalM2 = this.ordenes.reduce((s, o) => s + Number(o.metros_cuadrados || 0), 0);
        set('prodTotalSub', this._fmt(totalCant, 0) + ' und · ' + this._fmt(totalM2, 2) + ' m²');
    },

    filter() {
        const search = (document.getElementById('prodFilterSearch')?.value || '').toLowerCase();
        const estado = document.getElementById('prodFilterEstado')?.value || 'todos';
        const fechaFilter = document.getElementById('prodFilterFecha')?.value || '';
        const grupo = document.getElementById('prodFilterGrupo')?.value || 'todos';
        const familia = document.getElementById('prodFilterFamilia')?.value || 'todas';
        const estacion = document.getElementById('prodFilterEstacion')?.value || 'todas';
        let filtered = this.ordenes;
        if (search) filtered = filtered.filter(o =>
            (o.codigo_producto || '').toLowerCase().includes(search)
            || (o.pedido_sap_id || '').toLowerCase().includes(search)
            || (o.cliente || '').toLowerCase().includes(search)
            || (o.nombre_codigo_padre || '').toLowerCase().includes(search)
            || (o.nombre_mp || '').toLowerCase().includes(search));
        if (estado !== 'todos') filtered = filtered.filter(o => o.estado_programacion === estado);
        if (fechaFilter) filtered = filtered.filter(o => { const f = o.fecha_programada; if (!f) return false; const d = new Date(f); const fs = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); return fs === fechaFilter; });
        if (grupo !== 'todos') filtered = filtered.filter(o => o.grupo === grupo);
        if (familia !== 'todas') filtered = filtered.filter(o => o.familia_nombre === familia);
        if (estacion !== 'todas') filtered = filtered.filter(o => (o.estaciones || []).includes(estacion));
        this._filtradas = filtered;
        this.renderTable(filtered);
        if (this._vista === 'tablero') this.renderBoard(filtered);
    },

    // ---------------- Badges (idioma de etiquetas) ----------------
    _estadoBadge(e) {
        const map = {
            'PENDIENTE': ['s-pend', 'Pendiente'],
            'PROGRAMADO': ['s-prog', 'Programada'],
            'EN_PROCESO': ['s-proceso', 'En proceso'],
            'TERMINADO': ['s-term', 'Terminada'],
            'MERMADO': ['s-merm', 'Mermada'],
            'CERRADO': ['s-cerr', 'Cerrada']
        };
        const [cls, txt] = map[e] || ['s-pend', e || '—'];
        return '<span class="po-st ' + cls + '">● ' + escText(txt) + '</span>';
    },
    _prioBadge(nivel, ordenId, conMenu) {
        const map = {
            1: { label: 'Normal', cls: 'p-normal', dot: '#2563eb' },
            2: { label: 'Express', cls: 'p-express', dot: '#eab308' },
            3: { label: 'Urgencia', cls: 'p-urgencia', dot: '#16a34a' },
            4: { label: 'Reposición', cls: 'p-reposicion', dot: '#b91c1c' }
        };
        const n = Number(nivel) || 1;
        const m = map[n] || map[1];
        if (!conMenu) return '<span class="po-prio ' + m.cls + '">● ' + n + ' · ' + m.label + '</span>';
        let opts = '';
        for (let i = 1; i <= 4; i++) {
            opts += '<div class="prio-option" onclick="event.stopPropagation();App.modules.produccion.cambiarPrioridad(' + ordenId + ',' + i + ')">'
                + '<span class="po-prio ' + map[i].cls + '">● ' + i + ' · ' + map[i].label + '</span></div>';
        }
        return '<div class="po-prio-wrap">'
            + '<span class="prio-toggle po-prio ' + m.cls + '" data-orden="' + ordenId + '" onclick="App.modules.produccion.togglePrioridad(event)" title="Click para cambiar prioridad">● ' + n + ' · ' + m.label + ' ▾</span>'
            + '<div class="prioridad-dropdown" id="prioDrop_' + ordenId + '">' + opts + '</div>'
            + '</div>';
    },

    // ---------------- Tabla ----------------
    renderTable(ordenes) {
        const tbody = document.getElementById('prodTable');
        const cardsMobile = document.getElementById('prodCardsMobile');
        this.renderTotales(ordenes);
        if (!ordenes.length) {
            tbody.innerHTML = '<tr><td colspan="10" class="po-loading">No hay órdenes con los filtros actuales</td></tr>';
            if (cardsMobile) cardsMobile.innerHTML = '<div class="po-loading">No hay órdenes con los filtros actuales</div>';
            return;
        }
        tbody.innerHTML = ordenes.map(o => {
            const progreso = o.total_pasos > 0 ? o.pasos_terminados + '/' + o.total_pasos : '';
            return '<tr onclick="App.modules.produccion.verDetalle(' + o.id + ')">'
                + '<td><strong>' + escText(o.pedido_sap_id || '-') + '</strong><div class="sub2">Item ' + escText(o.item_numero || '-') + (o.orden_compra ? ' · OC ' + escText(o.orden_compra) : '') + '</div></td>'
                + '<td>' + escText((o.cliente || '-').toUpperCase()) + '</td>'
                + '<td><strong>' + escText(o.codigo_padre || o.codigo_producto || '-') + '</strong></td>'
                + '<td class="c-desc">' + escText(o.nombre_codigo_padre || o.descripcion || '—') + '</td>'
                + '<td><strong>' + escText(o.codigo_producto) + '</strong> '
                + (o.es_compuesto ? '<span class="po-bom">BOM</span>' : '<span class="po-sinbom" title="Sin receta BOM">SIN BOM</span>')
                + '<div class="sub2">' + escText(o.nombre_mp || '—') + '</div></td>'
                + '<td>' + this._fmt(o.ancho, 0) + ' × ' + this._fmt(o.alto, 0) + ' mm</td>'
                + '<td class="num"><span class="po-cant" title="Click para editar" onclick="event.stopPropagation();App.modules.produccion.showEditCantidad(' + o.id + ')">' + this._fmt(o.cantidad || 1, 0) + '</span></td>'
                + '<td onclick="event.stopPropagation()">' + this._prioBadge(o.nivel_prioridad, o.id, true) + '</td>'
                + '<td>' + this._estadoBadge(o.estado_programacion) + (progreso ? '<div class="sub2">' + progreso + ' pasos</div>' : (o.total_pasos === 0 ? '<div class="sub2" style="color:#dc2626">Sin ruta</div>' : '')) + '</td>'
                + '<td class="c-acc" onclick="event.stopPropagation()">'
                + '<div class="po-amenu"><button class="po-amenu-btn" onclick="App.modules.produccion.toggleAcciones(event,' + o.id + ')">Acciones ▾</button>'
                + '<div class="po-amenu-drop" id="poAcc_' + o.id + '">'
                + '<div class="it" onclick="App.modules.produccion.verDetalle(' + o.id + ')">👁 Ver detalle y pasos</div>'
                + '<div class="it" onclick="App.modules.produccion.showEditCantidad(' + o.id + ')">✏️ Editar cantidad</div>'
                + (o.estado_programacion !== 'CERRADO' ? '<div class="it" onclick="App.modules.produccion.etiquetaModal(' + o.id + ')">🏷️ Imprimir Etiqueta</div>' : '')
                + (o.estado_programacion !== 'CERRADO' ? '<div class="it" onclick="App.modules.produccion.cerrarOrden(' + o.id + ')">⛔ Cerrar orden</div>' : '')
                + '<div class="sep"></div>'
                + '<div class="it danger" onclick="App.modules.produccion.eliminarOrden(' + o.id + ')">🗑 Eliminar</div>'
                + '</div></div></td></tr>';
        }).join('');

        if (cardsMobile) {
            cardsMobile.innerHTML = ordenes.map(o => {
                const progreso = o.total_pasos > 0 ? ' · ' + o.pasos_terminados + '/' + o.total_pasos + ' pasos' : '';
                return '<div class="po-mcard">'
                    + '<div class="t1"><strong>' + escText(o.pedido_sap_id || '-') + ' · It ' + escText(o.item_numero || '-') + '</strong>' + this._estadoBadge(o.estado_programacion) + '</div>'
                    + '<div class="sub2">' + escText((o.cliente || '-').toUpperCase()) + ' · SAP ' + escText(o.codigo_padre || o.codigo_producto || '-') + (o.orden_compra ? ' · OC ' + escText(o.orden_compra) : '') + '</div>'
                    + '<div class="sub2">' + escText(o.nombre_codigo_padre || o.descripcion || '') + '</div>'
                    + '<div class="sub2">' + escText(o.codigo_producto) + ' · ' + escText(o.nombre_mp || '') + '</div>'
                    + '<div class="t2">' + this._prioBadge(o.nivel_prioridad, o.id, true)
                    + '<span class="sub2">' + this._fmt(o.cantidad || 1, 0) + ' und · ' + this._fmt(o.ancho, 0) + ' × ' + this._fmt(o.alto, 0) + progreso + '</span></div>'
                    + '<div class="acc">'
                    + '<button class="po-btn primary sm" style="flex:1" onclick="App.modules.produccion.verDetalle(' + o.id + ')">Ver detalle</button>'
                    + (o.estado_programacion !== 'CERRADO' ? '<button class="po-btn ghost sm" onclick="App.modules.produccion.cerrarOrden(' + o.id + ')">Cerrar</button>' : '')
                    + '<button class="po-btn danger sm" onclick="App.modules.produccion.eliminarOrden(' + o.id + ')">Eliminar</button>'
                    + '</div></div>';
            }).join('');
        }
    },

    renderTotales(ordenes) {
        const el = document.getElementById('prodTotales');
        if (!el) return;
        const totalM2 = ordenes.reduce((s, o) => s + Number(o.metros_cuadrados || 0), 0);
        const totalKg = ordenes.reduce((s, o) => s + Number(o.kilos || 0), 0);
        const totalCant = ordenes.reduce((s, o) => s + Number(o.cantidad || 0), 0);
        el.innerHTML = ''
            + '<span>' + this._fmt(ordenes.length, 0) + ' órdenes</span>'
            + '<span>' + this._fmt(totalCant, 0) + ' und</span>'
            + '<span>' + this._fmt(totalM2, 2) + ' m²</span>'
            + '<span><strong>' + this._fmt(totalKg, 1) + ' kg</strong></span>';
    },

    // ---------------- Tablero por estados ----------------
    renderBoard(ordenes) {
        const board = document.getElementById('poBoard');
        if (!board) return;
        const grupos = [
            { e: 'PENDIENTE', cls: 's-pend', t: 'Pendientes' },
            { e: 'PROGRAMADO', cls: 's-prog', t: 'Programadas' },
            { e: 'EN_PROCESO', cls: 's-proceso', t: 'En proceso' },
            { e: 'TERMINADO', cls: 's-term', t: 'Terminadas' }
        ];
        if (ordenes.some(o => o.estado_programacion === 'MERMADO')) grupos.push({ e: 'MERMADO', cls: 's-merm', t: 'Mermadas' });
        if (ordenes.some(o => o.estado_programacion === 'CERRADO')) grupos.push({ e: 'CERRADO', cls: 's-cerr', t: 'Cerradas' });
        board.innerHTML = grupos.map(g => {
            const lista = ordenes.filter(o => o.estado_programacion === g.e);
            const cards = lista.map(o => {
                const meta = g.e === 'EN_PROCESO' || g.e === 'TERMINADO'
                    ? (o.total_pasos > 0 ? o.pasos_terminados + '/' + o.total_pasos + ' pasos' : '')
                    : this._fecha(o.fecha_programada);
                return '<div class="po-bcard" onclick="App.modules.produccion.verDetalle(' + o.id + ')">'
                    + '<div class="t1"><span class="ped">' + escText(o.pedido_sap_id || '-') + ' · It ' + escText(o.item_numero || '-') + '</span>' + this._prioBadge(o.nivel_prioridad, o.id, false) + '</div>'
                    + '<div class="cli">' + escText((o.cliente || '-').toUpperCase()) + '</div>'
                    + '<div class="t2"><span class="cod">' + escText(o.codigo_producto) + ' · ' + this._fmt(o.cantidad || 1, 0) + ' und</span>'
                    + '<span class="dim2">' + escText(meta || this._fmt(o.ancho, 0) + ' × ' + this._fmt(o.alto, 0)) + '</span></div>'
                    + '</div>';
            }).join('');
            return '<div class="po-col"><div class="po-col-head"><span class="po-st ' + g.cls + '">●</span><span class="t">' + g.t + '</span><span class="c">' + lista.length + '</span></div>'
                + (cards || '<div class="po-loading" style="padding:18px 6px">Sin órdenes</div>') + '</div>';
        }).join('');
    },

    // ---------------- Panel de detalle (drawer) ----------------
    async verDetalle(ordenId) {
        try {
            const [pasosRes, estacionesRes] = await Promise.all([
                fetch(`/api/produccion/ordenes/${ordenId}/pasos`),
                fetch('/api/produccion/estaciones')
            ]);
            if (!pasosRes.ok) throw new Error('HTTP ' + pasosRes.status);
            const pasos = await pasosRes.json();
            // Pasos partidos por registros parciales (ej: dos "Corte"): se
            // muestra solo el ÚLTIMO registro por estación/secuencia
            const pasosUnicos = Object.values((Array.isArray(pasos) ? pasos : []).reduce((acc, p) => {
                const k = p.orden_secuencia + '|' + p.estacion_id;
                if (!acc[k] || Number(p.id) > Number(acc[k].id)) acc[k] = p;
                return acc;
            }, {})).sort((a, b) => Number(a.orden_secuencia) - Number(b.orden_secuencia));
            const todasEstaciones = await estacionesRes.json();
            const o = this.ordenes.find(x => x.id === ordenId);
            if (!o) return;
            this._drawerId = ordenId;

            const estIdsActuales = pasos.map(p => p.estacion_id);
            const estDisponibles = todasEstaciones.filter(e => e.activa && !estIdsActuales.includes(e.id));
            const progreso = pasosUnicos.length > 0
                ? pasosUnicos.filter(p => p.estado === 'TERMINADO' || p.estado === 'MERMADO').length + '/' + pasosUnicos.length
                : '—';

            let reglas = o.reglas_extras_json;
            if (typeof reglas === 'string') { try { reglas = JSON.parse(reglas); } catch (e) { reglas = []; } }
            reglas = Array.isArray(reglas) ? reglas : [];
            const coloresRegla = { 'Radio': '#8b5cf6', 'Pulido': '#6366f1', 'Perforado': '#f59e0b', 'Destaje': '#ef4444', 'Sacado': '#ec4899', 'Ventana': '#14b8a6', 'Pintado': '#3b82f6', 'Pintado Car': '#0ea5e9' };

            const pasosHtml = pasosUnicos.length === 0
                ? '<div class="po-loading" style="padding:14px">Sin pasos definidos (sin ruta)</div>'
                : pasosUnicos.map(p => `
                    <div class="po-paso">
                        <div class="n">${p.orden_secuencia}</div>
                        <div class="e">${escText(p.nombre_estacion || p.estacion_nombre || '—')}</div>
                        ${this._estadoBadge(p.estado === 'EN_PROCESO' ? 'EN_PROCESO' : p.estado === 'TERMINADO' ? 'TERMINADO' : p.estado === 'MERMADO' ? 'MERMADO' : 'PENDIENTE')}
                        <div class="f">${p.hora_inicio ? this._fechaHora(p.hora_inicio) : '—'}${p.hora_fin ? ' → ' + this._fechaHora(p.hora_fin) : ''}</div>
                        ${p.estado === 'PENDIENTE' ? `<button class="po-x-sm" title="Quitar estación" onclick="App.modules.produccion.eliminarPaso(${p.id},${ordenId})">✕</button>` : ''}
                    </div>`).join('');

            document.getElementById('poDrawer').innerHTML = `
                <div class="po-dr-head">
                    <div>
                        <h3>Pedido ${escText(o.pedido_sap_id || '-')} · Item ${escText(o.item_numero || '-')}</h3>
                        <div class="sub2">${escText((o.cliente || '-').toUpperCase())}${o.orden_compra ? ' · OC ' + escText(o.orden_compra) : ''}${o.posicion ? ' · Pos. ' + escText(o.posicion) : ''}</div>
                    </div>
                    <div class="po-dr-head-right">
                        ${this._prioBadge(o.nivel_prioridad, o.id, true)}
                        <button class="po-x" onclick="App.modules.produccion.cerrarDrawer()">✕</button>
                    </div>
                </div>
                <div class="po-dr-body">
                    <div class="po-dr-sec">Datos de la orden</div>
                    <div class="po-dr-grid">
                        <div class="po-kv"><div class="k">Código</div><div class="v">${escText(o.codigo_producto)} ${o.es_compuesto ? '<span class="po-bom">BOM</span>' : '<span class="po-sinbom">SIN BOM</span>'}</div></div>
                        <div class="po-kv" style="grid-column:1/-1"><div class="k">Código SAP / Descripción</div><div class="v">${o.codigo_padre ? escText(o.codigo_padre) + ' · ' : ''}${escText(o.descripcion || o.nombre_mp || '—')}</div></div>
                        <div class="po-kv"><div class="k">Dimensiones</div><div class="v">${this._fmt(o.ancho, 0)} × ${this._fmt(o.alto, 0)} mm</div></div>
                        <div class="po-kv"><div class="k">Cantidad</div><div class="v">${this._fmt(o.cantidad || 1, 0)} und</div></div>
                        <div class="po-kv"><div class="k">Superficie</div><div class="v">${this._fmt(o.metros_cuadrados, 2)} m²</div></div>
                        <div class="po-kv"><div class="k">Peso</div><div class="v">${this._fmt(o.kilos, 1)} kg</div></div>
                        <div class="po-kv"><div class="k">Cuello botella</div><div class="v">${o.cuello_botella ? '<span style="color:#dc2626">' + escText(o.cuello_botella) + '</span>' : '—'}</div></div>
                        <div class="po-kv"><div class="k">F. programada</div><div class="v">${this._fecha(o.fecha_programada)}</div></div>
                        <div class="po-kv"><div class="k">F. término</div><div class="v">${this._fecha(o.fecha_entrega_pactada)}</div></div>
                        <div class="po-kv"><div class="k">Entrega</div><div class="v">${escText(o.tipo_entrega || '—')}</div></div>
                        <div class="po-kv"><div class="k">Tipo de venta</div><div class="v">${escText(o.tipo_venta || '—')}</div></div>
                        ${o.codigo_padre ? '<div class="po-kv"><div class="k">Cód. padre</div><div class="v">' + escText(o.codigo_padre) + (o.nombre_codigo_padre ? ' (' + escText(o.nombre_codigo_padre) + ')' : '') + '</div></div>' : ''}
                        ${o.familia_nombre ? '<div class="po-kv"><div class="k">Familia</div><div class="v">' + escText(o.familia_nombre) + '</div></div>' : ''}
                        ${o.grupo ? '<div class="po-kv"><div class="k">Grupo</div><div class="v">' + escText(o.grupo) + '</div></div>' : ''}
                    </div>

                    ${reglas.length ? '<div class="po-dr-sec">Reglas extra</div><div class="po-reglas">' + reglas.map(r => '<span class="po-regla" style="background:' + (coloresRegla[r] || '#94a3b8') + '">' + escText(r) + '</span>').join('') + '</div>' : ''}

                    <div class="po-dr-sec">Pasos de producción · ${escText(progreso)}</div>
                    ${pasosHtml}
                    ${estDisponibles.length > 0 ? `
                    <div class="po-addpaso">
                        <select id="addEstacion_${ordenId}">
                            <option value="">-- Agregar estación a la ruta --</option>
                            ${estDisponibles.map(e => `<option value="${e.id}">${e.orden_secuencia_defecto || '?'}° ${escText(e.nombre_estacion)}</option>`).join('')}
                        </select>
                        <button class="po-btn primary sm" onclick="App.modules.produccion.agregarPaso(${ordenId})">＋ Agregar</button>
                    </div>` : ''}

                    ${o.nota || o.cerrado_nota ? `
                    <div class="po-dr-sec">${o.cerrado_nota ? 'Motivo de cierre' : 'Nota'}</div>
                    <div class="po-nota">${escText(o.cerrado_nota || o.nota)}</div>` : ''}
                </div>
                <div class="po-dr-foot">
                    ${o.estado_programacion !== 'CERRADO' ? `<button class="po-btn primary" onclick="App.modules.produccion.marcarSiguientePaso()">Marcar paso siguiente</button>
                    <button class="po-btn ghost" onclick="App.modules.produccion.cerrarOrden(${o.id})">Cerrar orden</button>` : ''}
                    <button class="po-btn danger" style="margin-left:auto" onclick="App.modules.produccion.eliminarOrden(${o.id})">Eliminar</button>
                </div>`;

            document.getElementById('poDim').style.display = 'block';
            document.getElementById('poDrawer').style.display = 'flex';
        } catch (e) {
            App.showAlert('Error al cargar el detalle: ' + e.message, 'danger');
        }
    },

    cerrarDrawer() {
        document.getElementById('poDim').style.display = 'none';
        document.getElementById('poDrawer').style.display = 'none';
        this._drawerId = null;
    },

    // Compat: el modal de pasos quedó reemplazado por el panel lateral
    verPasos(ordenId) { return this.verDetalle(ordenId); },
    hidePasosModal() {},

    // Avanza UN paso: primer paso PENDIENTE → EN_PROCESO, o EN_PROCESO → TERMINADO
    async marcarSiguientePaso() {
        const ordenId = this._drawerId;
        if (!ordenId) return;
        try {
            const res = await fetch(`/api/produccion/ordenes/${ordenId}/pasos`);
            const pasos = await res.json();
            const enProceso = pasos.find(p => p.estado === 'EN_PROCESO');
            const pendiente = pasos.find(p => p.estado === 'PENDIENTE');
            const objetivo = enProceso || pendiente;
            if (!objetivo) { App.showAlert('No hay pasos pendientes ni en proceso en esta ruta', 'info'); return; }
            await this.updatePaso(objetivo.id, enProceso ? 'TERMINADO' : 'EN_PROCESO', ordenId);
        } catch (e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    async updatePaso(pasoId, nuevoEstado, ordenId) {
        try {
            const res = await fetch(`/api/produccion/pasos/${pasoId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: nuevoEstado })
            });
            const data = await res.json();
            if (res.ok) {
                App.toast(nuevoEstado === 'TERMINADO' ? 'Paso terminado' : 'Paso en proceso');
                await this.verDetalle(ordenId);
                await this.load();
            } else { App.showAlert(data.error || 'Error al actualizar', 'danger'); }
        } catch (e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    async agregarPaso(ordenId) {
        const select = document.getElementById(`addEstacion_${ordenId}`);
        const estacionId = Number(select?.value);
        if (!estacionId) return;
        try {
            const res = await fetch(`/api/produccion/ordenes/${ordenId}/pasos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estacion_id: estacionId })
            });
            const data = await res.json();
            if (res.ok) {
                App.toast('Estación agregada');
                await this.verDetalle(ordenId);
                await this.load();
            } else { App.showAlert(data.error || 'Error al agregar', 'danger'); }
        } catch (e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    eliminarPaso(pasoId, ordenId) {
        this._confirmar('Quitar estación', '¿Quitar esta estación de la ruta de la orden?', 'Quitar estación', true, async () => {
            try {
                const res = await fetch(`/api/produccion/pasos/${pasoId}`, { method: 'DELETE' });
                const data = await res.json();
                if (res.ok) {
                    App.toast('Estación eliminada');
                    await this.verDetalle(ordenId);
                    await this.load();
                } else { App.showAlert(data.error || 'Error al eliminar', 'danger'); }
            } catch (e) { App.showAlert('Error: ' + e.message, 'danger'); }
        });
    },

    // ---------------- Importar SAP ----------------
    setupDragDrop() {
        const area = document.getElementById('prodImportArea');
        if (!area) return;
        area.addEventListener('dragover', e => { e.preventDefault(); area.style.borderColor = '#3b82f6'; area.style.background = '#eff6ff'; });
        area.addEventListener('dragleave', () => { area.style.borderColor = '#cbd5e1'; area.style.background = ''; });
        area.addEventListener('drop', e => { e.preventDefault(); area.style.borderColor = '#cbd5e1'; area.style.background = ''; if (e.dataTransfer.files.length) this.handleImportFile({ target: { files: e.dataTransfer.files } }); });
    },

    selectedImportFile: null,

    handleImportFile(e) {
        const file = e.target.files[0];
        if (!file) return;
        this.selectedImportFile = file;
        const nameEl = document.getElementById('prodImportName');
        nameEl.textContent = '✓ ' + file.name;
        nameEl.style.display = 'block';
        document.getElementById('prodImportBtn').disabled = false;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const wb = XLSX.read(ev.target.result, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws);
                this._importRows = rows;
                const preview = document.getElementById('prodImportPreview');
                preview.innerHTML = `<div class="po-hint"><strong>${rows.length}</strong> items encontrados</div>
                    <table class="po-mini"><thead><tr><th>Código</th><th>Pedido</th><th>Item</th><th>OC</th><th>Cliente</th><th>Cant</th><th>Ancho</th><th>Alto</th><th>Pint</th><th>Tipo Venta</th><th>Fecha</th></tr></thead><tbody>
                    ${rows.slice(0, 10).map(r => {
                        const cod = r.codigo || r.Codigo || r.CODIGO || '';
                        const ped = r.pedido || r.Pedido || r.PEDIDO || '';
                        const it = r.item || r.Item || r.ITEM || '';
                        const oc = r['orden de compra'] || r['orden_compra'] || r.OrdenCompra || r['ORDEN DE COMPRA'] || r.OC || r.oc || '';
                        const cli = r.cliente || r.Cliente || '';
                        const cant = r.cantidad || r.Cantidad || 1;
                        const ancho = r.anho || r.ancho || r.Ancho || r.ANCHO || 0;
                        const alto = r.alto || r.Alto || r.ALTO || 0;
                        const pint = r.pintado || r.Pintado || r.PINTADO || 0;
                        const tipo = r['tipo de venta'] || r.tipo_de_venta || r.TipoVenta || 'Normal';
                        const fecha = r.fecha_creacion || r.FechaCreacion || r.fecha || r.Fecha || '';
                        return `<tr><td>${escText(cod)}</td><td>${escText(ped)}</td><td>${escText(it)}</td><td>${escText(oc) || '<span style="color:#cbd5e1">—</span>'}</td><td>${escText(cli)}</td><td>${escText(cant)}</td><td>${escText(ancho)}</td><td>${escText(alto)}</td><td>${escText(pint)}</td><td>${escText(tipo)}</td><td>${escText(fecha)}</td></tr>`;
                    }).join('')}
                    ${rows.length > 10 ? `<tr><td colspan="11" style="text-align:center;color:#8494a8">... y ${rows.length - 10} más</td></tr>` : ''}
                    </tbody></table>`;
            } catch (err) { preview.innerHTML = '<span style="color:#dc2626;font-size:11px">Error al leer el archivo</span>'; }
        };
        reader.readAsArrayBuffer(file);
    },

    showImportModal() { document.getElementById('prodImportModal').style.display = 'flex'; this.selectedImportFile = null; },
    hideImportModal() {
        document.getElementById('prodImportModal').style.display = 'none';
        this.selectedImportFile = null;
        const n = document.getElementById('prodImportName'); if (n) n.style.display = 'none';
        const b = document.getElementById('prodImportBtn'); if (b) b.disabled = true;
        const p = document.getElementById('prodImportPreview'); if (p) p.innerHTML = '';
    },

    async importar() {
        if (!this.selectedImportFile) return;
        const btn = document.getElementById('prodImportBtn');
        btn.textContent = 'Procesando...';
        btn.disabled = true;
        try {
            const data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    try {
                        const wb = XLSX.read(reader.result, { type: 'array' });
                        const ws = wb.Sheets[wb.SheetNames[0]];
                        resolve(XLSX.utils.sheet_to_json(ws));
                    } catch (e) { reject(e); }
                };
                reader.onerror = () => reject(new Error('Error al leer archivo'));
                reader.readAsArrayBuffer(this.selectedImportFile);
            });
            if (!data.length) { App.showAlert('El archivo está vacío', 'danger'); btn.textContent = 'Importar'; btn.disabled = false; return; }
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const res = await fetch('/api/produccion/importar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' },
                body: JSON.stringify({ rows: data })
            });
            const result = await res.json();
            if (res.ok) {
                this.showImportResult(result);
                this.hideImportModal();
                await this.load();
            } else {
                App.showAlert(result.error || 'Error al importar', 'danger');
            }
        } catch (e) { App.showAlert('Error: ' + e.message, 'danger'); }
        btn.textContent = 'Importar';
        btn.disabled = false;
    },

    showImportResult(result) {
        const hayErrores = result.errores && result.errores.length > 0;
        const errBom = (result.errores || []).filter(e => e.error && e.error.toLowerCase().includes('receta bom'));
        const errDim = (result.errores || []).filter(e => e.error && e.error.toLowerCase().includes('dimensiones'));
        const errTipo = (result.errores || []).filter(e => e.error && e.error.toLowerCase().includes('invalid input'));

        const errUnicos = {};
        (result.errores || []).forEach(e => {
            const key = e.error || 'desc';
            if (!errUnicos[key]) errUnicos[key] = { ...e, count: 0, codigos: [] };
            errUnicos[key].count++;
            if (e.codigo && !errUnicos[key].codigos.includes(e.codigo)) errUnicos[key].codigos.push(e.codigo);
        });
        const errLista = Object.values(errUnicos);

        let errRows = '';
        errLista.forEach(e => {
            const codigos = e.codigos.length > 0 ? escText(e.codigos.slice(0, 5).join(', ')) + (e.codigos.length > 5 ? ` +${e.codigos.length - 5} más` : '') : '-';
            const repeatBadge = e.count > 1 ? `<span class="po-repeat">${e.count}x</span>` : '';
            errRows += `<tr><td class="cod">${codigos}</td><td class="err">${escText(e.error)}${repeatBadge}</td></tr>`;
        });

        let errTitle = 'Errores encontrados';
        let errSolution = '';
        if (errBom.length > 0 && errTipo.length === 0 && errDim.length === 0) {
            errTitle = 'Códigos sin receta BOM configurada';
            errSolution = '<strong>Solución:</strong> Ve a <strong>Configuración → Recetas BOM</strong> y crea la receta para cada código. Define la materia prima, cantidad y dimensiones antes de volver a importar.';
        } else if (errTipo.length > 0) {
            errTitle = 'Errores de formato en los datos';
            errSolution = '<strong>Solución:</strong> Revisa el archivo SAP. Algunos valores no son compatibles con la base de datos (ej: números decimales donde se espera entero). Verifica las columnas de item, cantidad y dimensiones.';
        } else if (errDim.length > 0) {
            errTitle = 'Códigos sin dimensiones';
            errSolution = '<strong>Solución:</strong> Ve a <strong>Configuración → Recetas BOM</strong> y define el ancho y alto para cada código listado.';
        } else {
            errSolution = '<strong>Solución:</strong> Revisa los errores listados y corrige los datos en el archivo SAP o en la configuración del sistema.';
        }

        const overlay = document.createElement('div');
        overlay.id = 'importResultModal';
        overlay.className = 'po-overlay';
        overlay.style.display = 'flex';
        overlay.innerHTML = `
        <div class="po-modal" onclick="event.stopPropagation()">
            <div class="po-modal-head">
                <div><h3>Resultado de Importación</h3><div class="sub2">Resumen del procesamiento del archivo SAP</div></div>
                <button class="po-x" onclick="document.getElementById('importResultModal').remove()">✕</button>
            </div>
            <div class="po-modal-body">
                <div class="po-kpis" style="grid-template-columns:repeat(4,1fr)">
                    <div class="po-kpi"><div class="k">Importadas</div><div class="v c-term">${result.importadas || 0}</div></div>
                    <div class="po-kpi"><div class="k">Pasos</div><div class="v c-prog">${result.pasos_creados || 0}</div></div>
                    <div class="po-kpi"><div class="k">Costos</div><div class="v" style="color:#b45309">${result.costos_calculados || 0}</div></div>
                    <div class="po-kpi"><div class="k">Errores</div><div class="v" style="color:${hayErrores ? '#dc2626' : '#15803d'}">${(result.errores || []).length}</div></div>
                </div>
                ${result.fusiones > 0 ? `<div class="po-info">🔗 <strong>${result.fusiones}</strong> filas duplicadas se fusionaron automáticamente</div>` : ''}
                ${hayErrores ? `
                <div class="po-dr-sec" style="color:#b91c1c">${errTitle}</div>
                <div class="po-err-wrap"><table class="po-mini"><thead><tr><th>Códigos</th><th>Detalle del error</th></tr></thead><tbody>${errRows}</tbody></table></div>
                <div class="po-solution">${errSolution}</div>
                ` : `
                <div class="po-ok-box"><div class="big">✓</div><div class="t">Importación exitosa</div><div class="s">Todas las órdenes se procesaron correctamente</div></div>
                `}
            </div>
            <div class="po-modal-foot"><button class="po-btn primary" onclick="document.getElementById('importResultModal').remove()">Cerrar</button></div>
        </div>`;
        document.body.appendChild(overlay);
    },

    // ---------------- Nueva orden ----------------
    showNewOrderModal() {
        document.getElementById('newOrdPedido').value = '';
        document.getElementById('newOrdItem').value = '1';
        document.getElementById('newOrdCliente').value = '';
        document.getElementById('newOrdCodigo').value = '';
        document.getElementById('newOrdAncho').value = '0';
        document.getElementById('newOrdAlto').value = '0';
        document.getElementById('newOrdPerforaciones').value = '0';
        document.getElementById('newOrdPintado').value = '0';
        document.getElementById('newOrdTipoVenta').value = 'Normal';
        document.getElementById('newOrdCantidad').value = '1';
        document.getElementById('newOrdTipoEntrega').value = 'Despacho';
        document.getElementById('newOrdOC').value = '';
        document.getElementById('newOrdPosicion').value = '';
        document.getElementById('newOrdNota').value = '';
        document.getElementById('newOrdFechaCreacion').value = new Date().toISOString().split('T')[0];
        document.getElementById('prodNewOrderModal').style.display = 'flex';
    },
    hideNewOrderModal() { document.getElementById('prodNewOrderModal').style.display = 'none'; },

    async saveNewOrder() {
        const pedido = document.getElementById('newOrdPedido').value.trim();
        const item = Number(document.getElementById('newOrdItem').value) || 1;
        const cliente = document.getElementById('newOrdCliente').value.trim().toUpperCase();
        const codigo = document.getElementById('newOrdCodigo').value.trim();
        const ancho = Number(document.getElementById('newOrdAncho').value) || 0;
        const alto = Number(document.getElementById('newOrdAlto').value) || 0;
        const perforaciones = document.getElementById('newOrdPerforaciones').value === '1';
        const pintado = document.getElementById('newOrdPintado').value === '1';
        const tipo_venta = document.getElementById('newOrdTipoVenta').value;
        const cantidad = Number(document.getElementById('newOrdCantidad').value) || 1;
        const fecha_creacion = document.getElementById('newOrdFechaCreacion').value || null;
        const tipo_entrega = document.getElementById('newOrdTipoEntrega').value;
        const orden_compra = document.getElementById('newOrdOC').value.trim();
        const posicion = document.getElementById('newOrdPosicion').value.trim();
        const nota = document.getElementById('newOrdNota').value.trim();
        if (!pedido || !codigo || !ancho || !alto) {
            App.showAlert('Pedido, código, ancho y alto son requeridos', 'danger');
            return;
        }
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const headers = { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' };
            const res = await fetch('/api/produccion/ordenes', {
                method: 'POST', headers,
                body: JSON.stringify({ pedido_sap_id: pedido, item_numero: item, cliente, codigo_producto: codigo, ancho, alto, perforaciones, pintado, tipo_venta, cantidad, fecha_creacion, tipo_entrega, orden_compra, posicion, nota })
            });
            const data = await res.json();
            if (res.ok) {
                const msg = data.ordenes_creadas > 1 ? `${data.ordenes_creadas} órdenes creadas (explosión BOM)` : `Orden creada: ${codigo}`;
                App.toast(msg);
                this.hideNewOrderModal();
                await this.load();
            } else { App.showAlert(data.error || 'Error al crear la orden', 'danger'); }
        } catch (e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    // ---------------- Editar cantidad (modal, sin prompt()) ----------------
    showEditCantidad(id) {
        const o = this.ordenes.find(x => x.id === id);
        if (!o) return;
        this._editCantId = id;
        const input = document.getElementById('poCantInput');
        input.value = o.cantidad || 1;
        document.getElementById('poCantM2').textContent = 'Actual: ' + this._fmt(o.cantidad || 1, 0) + ' und · ' + this._fmt(o.metros_cuadrados, 2) + ' m²';
        document.getElementById('poCantModal').style.display = 'flex';
        setTimeout(() => { input.focus(); input.select(); }, 60);
    },
    hideEditCantidad() { document.getElementById('poCantModal').style.display = 'none'; this._editCantId = null; },

    async confirmEditCantidad() {
        const id = this._editCantId;
        const cant = Number(document.getElementById('poCantInput').value);
        if (!id || !cant || cant < 1) { App.showAlert('Ingresa una cantidad válida (mínimo 1)', 'danger'); return; }
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const orden = this.ordenes.find(o => o.id === id);
            const m2 = ((Number(orden?.ancho || 0) * Number(orden?.alto || 0)) / 1000000) * cant;
            const res = await fetch(`/api/produccion/ordenes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' },
                body: JSON.stringify({ cantidad: cant, metros_cuadrados: m2 })
            });
            if (res.ok) {
                App.toast('Cantidad actualizada');
                this.hideEditCantidad();
                if (this._drawerId === id) await this.verDetalle(id);
                await this.load();
            } else { const d = await res.json(); App.showAlert(d.error || 'Error al actualizar', 'danger'); }
        } catch (e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    // ---------------- Prioridades (delegación) ----------------
    async cambiarPrioridad(id, nuevoNivel) {
        document.querySelectorAll('.prioridad-dropdown').forEach(d => d.style.display = 'none');
        if (![1, 2, 3, 4].includes(nuevoNivel)) return;
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const res = await fetch(`/api/produccion/ordenes/${id}/prioridad`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'X-User-Email': user.email || '' },
                body: JSON.stringify({ nivel_prioridad: nuevoNivel })
            });
            if (res.ok) {
                App.toast('Prioridad actualizada');
                await this.load();
                this.checkReprogramacionPendiente();
                if (this._drawerId === id) await this.verDetalle(id);
                // La nueva prioridad solo se refleja en FECHAS y FABRICACIÓN al
                // reprogramar: se ofrece aquí mismo para que no se quede a medias.
                this._confirmar('Prioridad actualizada',
                    'La nueva prioridad se aplicará a <strong>fechas y fabricación</strong> al reprogramar.<br><br>¿Deseas reprogramar ahora?',
                    'Reprogramar ahora', false, () => this._ejecutarReprogramar());
            }
            else { const d = await res.json(); App.showAlert(d.error || 'Error al actualizar', 'danger'); }
        } catch (e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    _setupPrioridadEvents() {
        if (this._prioridadBound) return;
        this._prioridadBound = true;
        document.addEventListener('click', (e) => {
            const toggle = e.target.closest('.prio-toggle');
            if (toggle) {
                e.stopPropagation();
                const ordenId = toggle.dataset.orden;
                const menu = toggle.parentElement.querySelector('.prioridad-dropdown') || document.getElementById('prioDrop_' + ordenId);
                if (!menu) return;
                const wasVisible = menu.style.display === 'block';
                this._cerrarDrops();
                if (!wasVisible) this._abrirDrop(menu, toggle);
                return;
            }
            const option = e.target.closest('.prio-option');
            if (option) {
                e.stopPropagation();
                const ordenId = Number(option.dataset.orden);
                const nivel = Number(option.dataset.nivel);
                this._cerrarDrops();
                if (ordenId && nivel) this.cambiarPrioridad(ordenId, nivel);
                return;
            }
            this._cerrarDrops();
        });
        // Un popover fijo debe esconderse si la página se mueve
        window.addEventListener('scroll', () => this._cerrarDrops(), true);
        window.addEventListener('resize', () => this._cerrarDrops());
    },

    // Menú popover: se posiciona FIXED respecto al botón para SALIRSE del
    // recorte del contenedor de la tabla (overflow del wrapper cortaba los
    // menús absolutos: se abrían pero no se veían).
    _abrirDrop(menu, anchor) {
        const rect = anchor.getBoundingClientRect();
        menu.style.display = 'block';
        menu.style.position = 'fixed';
        menu.style.right = 'auto';
        menu.style.left = '0px';
        menu.style.top = '0px';
        const mh = menu.offsetHeight;
        const mw = menu.offsetWidth;
        const espacioAbajo = window.innerHeight - rect.bottom;
        const top = espacioAbajo < mh + 12 ? Math.max(8, rect.top - mh - 6) : rect.bottom + 6;
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - mw - 8));
        menu.style.top = top + 'px';
        menu.style.left = left + 'px';
    },

    _cerrarDrops() {
        document.querySelectorAll('.prioridad-dropdown,.po-amenu-drop,.po-mant-drop').forEach(d => d.style.display = 'none');
    },

    toggleAcciones(e, id) {
        e.stopPropagation();
        const menu = document.getElementById('poAcc_' + id);
        if (!menu) return;
        const wasVisible = menu.style.display === 'block';
        this._cerrarDrops();
        if (!wasVisible) this._abrirDrop(menu, e.currentTarget || e.target);
    },

    // Menú de prioridad con handler propio: el onclick inline frena el click
    // ANTES de que burbujee a la fila (que abriría el detalle y lo taparía todo)
    togglePrioridad(e) {
        e.stopPropagation();
        const wrap = e.currentTarget.parentElement;
        const menu = wrap.querySelector('.prioridad-dropdown');
        if (!menu) return;
        const wasVisible = menu.style.display === 'block';
        this._cerrarDrops();
        if (!wasVisible) this._abrirDrop(menu, e.currentTarget);
    },

    toggleMant(e) {
        e.stopPropagation();
        const drop = document.getElementById('poMantDrop');
        const wasVisible = drop.style.display === 'block';
        this._cerrarDrops();
        if (!wasVisible) this._abrirDrop(drop, e.currentTarget || e.target);
    },

    // ---------------- Reprogramación ----------------
    async checkReprogramacionPendiente() {
        try {
            const res = await fetch('/api/produccion/reprogramar/pendientes');
            const data = await res.json();
            const badge = document.getElementById('reprogBadge');
            const btn = document.getElementById('reprogBtn');
            if (badge && btn) {
                if (data.pendientes) {
                    badge.style.display = 'inline-flex';
                    btn.classList.add('alerta');
                    btn.title = data.count + ' cambio(s) de prioridad pendientes de reprogramar';
                } else {
                    badge.style.display = 'none';
                    btn.classList.remove('alerta');
                    btn.title = 'Zona de mantenimiento';
                }
            }
        } catch (e) { /* no bloquear la pantalla por esto */ }
    },

    resincronizarEstados() {
        this._confirmar('Resincronizar estados',
            'Se recalculará el <strong>estado de todas las órdenes</strong> con la regla actual: con algún registro de fabricación = <strong>EN PROCESO</strong>; con todo terminado/mermado = <strong>TERMINADO</strong>.<br><br>Las órdenes CERRADAS no serán tocadas.',
            'Resincronizar', false, () => this._ejecutarResincronizar());
    },

    async _ejecutarResincronizar() {
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            App.toast('Resincronizando estados... espere', 'info');
            const res = await fetch('/api/taller/resincronizar-estados', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Email': user.email || '' }
            });
            const data = await res.json();
            if (res.ok) {
                App.toast('Estados resincronizados: ' + (data.cambiadas || 0) + ' órdenes cambiaron (de ' + (data.revisadas || 0) + ' revisadas)', 'success');
                await this.load();
            } else {
                App.toast(data.error || 'Error al resincronizar', 'error');
            }
        } catch (e) {
            App.toast('Error de conexión: ' + e.message, 'error');
        }
    },

    reprogramarTodo() {
        this._confirmar('Reprogramar Todo',
            'Se liberarán <strong>todas las órdenes que no estén EN PROCESO, TERMINADAS, MERMADAS ni CERRADAS</strong> (vuelven a PENDIENTE) y se re-asignarán automáticamente por prioridad: <strong>Reposición → Express → Urgencia → Normal</strong>.<br><br>Las órdenes EN PROCESO, MERMADAS y TERMINADAS no serán tocadas.',
            'Reprogramar todo', true, () => this._ejecutarReprogramar());
    },

    async _ejecutarReprogramar() {
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            App.toast('Reprogramando... espere', 'info');
            const res = await fetch('/api/produccion/reprogramar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Email': user.email || '' },
                body: JSON.stringify({ dias: 21, inicio: new Date().toISOString().split('T')[0] })
            });
            const data = await res.json();
            if (res.ok) {
                const lib = data.ordenes_liberadas || 0;
                const asig = Array.isArray(data.asignados) ? data.asignados.length : 0;
                App.showAlert(`Reprogramado: ${lib} liberadas, ${asig} re-asignadas por prioridad`, 'success');
                await this.load();
                this.checkReprogramacionPendiente();
            } else { App.showAlert(data.error || 'Error al reprogramar', 'danger'); }
        } catch (e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    // ---------------- Cerrar / eliminar ----------------
    cerrarOrden(id) {
        this._cerrarId = id;
        document.querySelectorAll('.po-amenu-drop').forEach(d => d.style.display = 'none');
        document.getElementById('cerrarNota').value = '';
        document.getElementById('prodCerrarModal').style.display = 'flex';
    },
    hideCerrarModal() {
        document.getElementById('prodCerrarModal').style.display = 'none';
        this._cerrarId = null;
    },
    async confirmCerrar() {
        const nota = document.getElementById('cerrarNota').value.trim();
        if (!nota) { App.showAlert('Debes indicar el motivo del cierre', 'danger'); return; }
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const res = await fetch(`/api/produccion/ordenes/${this._cerrarId}/cerrar`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-User-Email': user.email || '' },
                body: JSON.stringify({ nota })
            });
            const data = await res.json();
            if (res.ok) {
                App.toast('Orden cerrada');
                this.hideCerrarModal();
                if (this._drawerId) this.cerrarDrawer();
                await this.load();
            } else { App.showAlert(data.error || 'Error al cerrar', 'danger'); }
        } catch (e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    eliminarOrden(id) {
        const o = this.ordenes.find(x => x.id === id);
        const etiqueta = o ? `${o.pedido_sap_id || ''} · Item ${o.item_numero || '-'} (${o.codigo_producto})` : 'esta orden';
        this._confirmar('Eliminar orden', `Se eliminará la orden <strong>${escText(etiqueta)}</strong> de forma permanente. Esta acción no se puede deshacer.`, 'Eliminar definitivamente', true, async () => {
            try {
                const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
                await apiJson(await fetch(`/api/produccion/ordenes/${id}`, {
                    method: 'DELETE', headers: { 'X-User-Email': user.email || '' }
                }));
                App.toast('Orden eliminada');
                if (this._drawerId === id) this.cerrarDrawer();
                await this.load();
            } catch (e) { App.showAlert('Error: ' + e.message, 'danger'); }
        });
    },

    eliminarTodas() {
        this._confirmar('Limpiar TODO',
            'Se eliminarán <strong>TODAS las órdenes de producción</strong>, sus pasos y datos asociados. <strong>Esta acción no se puede deshacer.</strong><br><br>¿Deseas continuar?',
            'Eliminar todas las órdenes', true, async () => {
                try {
                    const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
                    const res = await fetch('/api/produccion/ordenes/all', {
                        method: 'DELETE', headers: { 'X-User-Email': user.email || '' }
                    });
                    const data = await res.json();
                    if (data.ok) {
                        App.toast(`${data.eliminadas} órdenes eliminadas`);
                        this.cerrarDrawer();
                        await this.load();
                    } else { App.showAlert(data.error || 'Error al eliminar', 'danger'); }
                } catch (e) { App.showAlert('Error: ' + e.message, 'danger'); }
            });
    },

    async deleteReceta(id) {
        this._confirmar('Eliminar receta BOM', '¿Eliminar esta receta BOM? Esta acción no se puede deshacer.', 'Eliminar receta', true, async () => {
            try {
                const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
                await apiJson(await fetch(`/api/produccion/recetas/${id}`, {
                    method: 'DELETE', headers: { 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' }
                }));
                App.toast('Receta eliminada');
                await this.load();
            } catch (e) { App.showAlert('Error: ' + e.message, 'danger'); }
        });
    },

    // ---------------- Confirmación genérica (sin confirm() nativo) ----------------
    _confirmar(titulo, html, textoBoton, peligro, accion) {
        document.getElementById('poConfirmTitle').textContent = titulo;
        document.getElementById('poConfirmText').innerHTML = html;
        const btn = document.getElementById('poConfirmBtn');
        btn.textContent = textoBoton;
        btn.className = 'po-btn ' + (peligro ? 'danger' : 'primary');
        btn.onclick = () => { this.closeConfirm(); accion(); };
        document.getElementById('poConfirmOverlay').style.display = 'flex';
    },
    closeConfirm() { document.getElementById('poConfirmOverlay').style.display = 'none'; },

    // ---------------- Estilos (escala 20/15/13/11/10) ----------------
    _estilos() {
        return `<style>
            .po-hero{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 55%,#1e40af 100%);border-radius:16px;padding:20px 26px;display:flex;align-items:center;gap:14px;position:relative;overflow:hidden;margin-bottom:16px}
            .po-hero::after{content:'';position:absolute;left:0;right:0;bottom:0;height:1px;background:linear-gradient(90deg,transparent,rgba(147,197,253,.55),transparent)}
            .po-hero h2{color:#fff;font-size:20px;font-weight:700;margin:0}
            .po-hero p{color:rgba(255,255,255,.62);font-size:11px;margin:4px 0 0}
            .po-hero-actions{margin-left:auto;display:flex;gap:8px;align-items:center}
            .po-hbtn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);color:#fff;cursor:pointer;font-size:11px;font-weight:600;white-space:nowrap}
            .po-hbtn:hover{background:rgba(255,255,255,.2)}
            .po-hbtn.solid{background:#fff;color:#1e3a5f;border-color:#fff}
            .po-hbtn.solid:hover{background:#e8eefb}
            .po-hbtn.ghost-danger{border-color:rgba(248,113,113,.5);color:#fca5a5}
            .po-hbtn.alerta{background:#dc2626;border-color:#dc2626;color:#fff}
            .po-reprog-badge{display:none;background:#fff;color:#dc2626;border-radius:50%;width:18px;height:18px;font-size:11px;font-weight:800;align-items:center;justify-content:center}
            .po-mant{position:relative}
            .po-mant-drop{display:none;position:absolute;right:0;top:110%;background:#fff;border:1px solid #e4e9f0;border-radius:10px;box-shadow:0 12px 32px rgba(15,23,42,.16);min-width:250px;padding:5px;z-index:60}
            .po-mant-drop .it{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:7px;font-size:11px;font-weight:600;color:#475569;cursor:pointer}
            .po-mant-drop .it:hover{background:#f8fafc}
            .po-mant-drop .it.danger{color:#dc2626}
            .po-mant-drop .sep{height:1px;background:#e4e9f0;margin:5px 8px}

            .po-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:14px}
            .po-kpi{background:#fff;border:1px solid #e4e9f0;border-radius:12px;padding:13px 16px}
            .po-kpi .k{font-size:10px;font-weight:600;letter-spacing:.7px;text-transform:uppercase;color:#8494a8}
            .po-kpi .v{font-size:20px;font-weight:700;margin-top:4px;color:#0f172a}
            .po-kpi .s{font-size:10px;color:#8494a8;margin-top:2px}
            .c-pend{color:#b45309!important}.c-prog{color:#2563eb!important}.c-proceso{color:#7c3aed!important}.c-term{color:#15803d!important}

            .po-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
            .po-search{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #e4e9f0;border-radius:10px;padding:0 12px;flex:1;min-width:220px;max-width:340px}
            .po-search input{border:none;outline:none;padding:10px 0;font-size:13px;width:100%;background:transparent;color:#0f172a}
            .po-toolbar select,.po-toolbar input[type=date]{padding:10px 12px;border:1px solid #e4e9f0;border-radius:10px;font-size:11px;font-weight:600;background:#fff;color:#475569;outline:none}
            .po-flimpiar{font-size:11px;font-weight:600;color:#b45309;cursor:pointer;padding:8px 10px}
            .po-flimpiar:hover{text-decoration:underline}

            .po-tabs{display:flex;gap:4px;background:#e2e8f0;padding:4px;border-radius:10px;width:max-content;margin-bottom:12px}
            .po-tab{padding:8px 18px;border-radius:8px;font-size:11px;font-weight:700;color:#475569;cursor:pointer}
            .po-tab.on{background:#fff;color:#0f172a;box-shadow:0 1px 3px rgba(15,23,42,.1)}

            .po-panel{background:#fff;border:1px solid #e4e9f0;border-radius:14px;overflow:hidden}
            .po-p-head{padding:13px 18px;display:flex;align-items:baseline;gap:10px;border-bottom:1px solid #e4e9f0;flex-wrap:wrap}
            .po-p-head h3{font-size:13px;font-weight:600;margin:0}
            .po-p-head .sub{font-size:10px;color:#8494a8}
            .po-tot{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap}
            .po-tot span{padding:3px 9px;border-radius:6px;font-size:10px;font-weight:700;background:#f1f5f9;color:#475569}
            .po-tot span strong{color:#0f172a}

            .po-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
            .po-table{width:100%;border-collapse:collapse;min-width:1040px}
            .po-table th{padding:10px 14px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#8494a8;background:#f8fafc;border-bottom:1px solid #e4e9f0;white-space:nowrap}
            .po-table td{padding:11px 14px;font-size:13px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
            .po-table tbody tr{cursor:pointer}
            .po-table tbody tr:hover{background:#f8fafc}
            .po-table .num{text-align:right;font-variant-numeric:tabular-nums}
            .po-table .th-acc{text-align:right}
            .po-table .c-acc{text-align:right;white-space:nowrap}
            .sub2{font-size:10px;color:#8494a8;margin-top:1px}
            .po-loading{text-align:center;padding:34px;color:#8494a8;font-size:13px}

            .po-cant{color:#2563eb;font-weight:700;cursor:pointer;border-bottom:1px dashed #93c5fd}
            .po-cant:hover{background:#eff6ff;border-radius:5px}

            .po-bom{font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;background:#ede9fe;color:#7c3aed}
            .po-sinbom{font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;background:#fee2e2;color:#dc2626}

            .po-st{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap}
            .s-pend{background:#fef3c7;color:#b45309}
            .s-prog{background:#dbeafe;color:#2563eb}
            .s-proceso{background:#ede9fe;color:#7c3aed}
            .s-term{background:#dcfce7;color:#15803d}
            .s-merm{background:#fee2e2;color:#dc2626}
            .s-cerr{background:#f1f5f9;color:#475569}

            .po-prio-wrap{position:relative;display:inline-block}
            .po-prio{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap}
            .prio-toggle{cursor:pointer}
            .p-normal{background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe}
            .p-express{background:#fef9c3;color:#854d0e;border:1px solid #fde047}
            .p-urgencia{background:#dcfce7;color:#15803d;border:1px solid #86efac}
            .p-reposicion{background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5}
            .prioridad-dropdown{display:none;position:fixed;top:110%;left:0;z-index:95;background:#fff;border:1px solid #e4e9f0;border-radius:10px;padding:5px;min-width:150px;box-shadow:0 12px 32px rgba(15,23,42,.16)}
            .prio-option{padding:5px 8px;border-radius:7px;cursor:pointer}
            .prio-option:hover{background:#f8fafc}

            .po-amenu{position:relative;display:inline-block}
            .po-amenu-btn{padding:6px 11px;border-radius:7px;border:1px solid #e4e9f0;background:#fff;color:#475569;font-size:10px;font-weight:700;cursor:pointer}
            .po-amenu-btn:hover{background:#f8fafc}
            .po-amenu-drop{display:none;position:absolute;right:0;top:110%;background:#fff;border:1px solid #e4e9f0;border-radius:10px;box-shadow:0 12px 32px rgba(15,23,42,.16);min-width:190px;padding:5px;z-index:50;text-align:left}
            .po-amenu-drop .it{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:7px;font-size:11px;font-weight:600;color:#475569;cursor:pointer;white-space:nowrap}
            .po-amenu-drop .it:hover{background:#f8fafc}
            .po-amenu-drop .it.danger{color:#dc2626}
            .po-amenu-drop .sep{height:1px;background:#e4e9f0;margin:5px 8px}

            .po-board{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
            .po-col{background:#f8fafc;border:1px solid #e4e9f0;border-radius:12px;padding:10px}
            .po-col-head{display:flex;align-items:center;gap:8px;padding:4px 6px 10px}
            .po-col-head .t{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#334155}
            .po-col-head .c{margin-left:auto;font-size:10px;font-weight:700;background:#fff;border:1px solid #e4e9f0;border-radius:20px;padding:2px 8px;color:#475569}
            .po-bcard{background:#fff;border:1px solid #e4e9f0;border-radius:10px;padding:11px 12px;margin-bottom:8px;cursor:pointer}
            .po-bcard:hover{box-shadow:0 4px 14px rgba(15,23,42,.08)}
            .po-bcard .t1{display:flex;justify-content:space-between;align-items:center;gap:6px}
            .po-bcard .ped{font-size:13px;font-weight:700}
            .po-bcard .cli{font-size:11px;color:#475569;margin:3px 0}
            .po-bcard .t2{display:flex;justify-content:space-between;align-items:center;margin-top:6px;gap:6px}
            .po-bcard .cod{font-size:11px;font-weight:600;color:#0f172a}
            .po-bcard .dim2{font-size:10px;color:#8494a8}

            .po-dim{display:none;position:fixed;inset:0;background:rgba(15,23,42,.35);z-index:70}
            .po-drawer{display:none;position:fixed;top:0;right:0;bottom:0;width:430px;max-width:94vw;background:#fff;box-shadow:-16px 0 48px rgba(15,23,42,.2);z-index:71;flex-direction:column}
            .po-dr-head{padding:16px 20px;border-bottom:1px solid #e4e9f0;display:flex;align-items:flex-start;gap:10px;background:linear-gradient(135deg,#f8fafc,#fff)}
            .po-dr-head h3{font-size:15px;margin:0}
            .po-dr-head-right{margin-left:auto;display:flex;gap:6px;align-items:center}
            .po-dr-body{padding:16px 20px;overflow-y:auto;flex:1}
            .po-dr-sec{font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#8494a8;margin:14px 0 8px}
            .po-dr-sec:first-child{margin-top:0}
            .po-dr-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
            .po-kv .k{font-size:10px;color:#8494a8;text-transform:uppercase;letter-spacing:.5px;font-weight:600}
            .po-kv .v{font-size:13px;font-weight:600;margin-top:2px}
            .po-reglas{display:flex;flex-wrap:wrap;gap:4px}
            .po-regla{font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;color:#fff}
            .po-paso{display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid #e4e9f0;border-radius:9px;margin-bottom:6px}
            .po-paso .n{width:22px;height:22px;border-radius:50%;background:#f1f5f9;color:#475569;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
            .po-paso .e{flex:1;font-size:13px;font-weight:600}
            .po-paso .f{font-size:10px;color:#8494a8;white-space:nowrap}
            .po-x-sm{width:22px;height:22px;border-radius:6px;border:none;background:#fee2e2;color:#dc2626;font-size:10px;cursor:pointer;flex-shrink:0}
            .po-addpaso{display:flex;gap:8px;margin-top:8px}
            .po-addpaso select{flex:1;padding:9px 12px;border:1px solid #e4e9f0;border-radius:8px;font-size:11px;color:#475569;background:#fff}
            .po-nota{font-size:13px;color:#475569;background:#f8fafc;border:1px solid #e4e9f0;border-radius:9px;padding:10px 12px}
            .po-dr-foot{padding:12px 20px;border-top:1px solid #e4e9f0;display:flex;gap:8px}

            .po-overlay{display:none;position:fixed;inset:0;z-index:80;align-items:center;justify-content:center;background:rgba(15,23,42,.5);backdrop-filter:blur(4px)}
            .po-modal{background:#fff;border-radius:16px;width:92%;max-width:560px;max-height:86vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(15,23,42,.3)}
            .po-modal.sm{max-width:420px}
            .po-modal-head{padding:18px 24px;border-bottom:1px solid #e4e9f0;display:flex;align-items:center;justify-content:space-between;gap:10px}
            .po-modal-head h3{margin:0;font-size:15px;font-weight:700}
            .po-modal-body{padding:20px 24px;overflow-y:auto}
            .po-modal-foot{padding:14px 24px 20px;display:flex;gap:8px;justify-content:flex-end;border-top:1px solid #e4e9f0}
            .po-x{width:28px;height:28px;border-radius:8px;border:none;background:#f1f5f9;color:#64748b;cursor:pointer;font-size:13px}
            .po-x:hover{background:#e2e8f0}

            .po-btn{padding:9px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid transparent}
            .po-btn.primary{background:#1e40af;color:#fff}
            .po-btn.primary:hover{background:#1e3a8a}
            .po-btn.primary:disabled{opacity:.6;cursor:default}
            .po-btn.ghost{background:#fff;color:#475569;border-color:#e4e9f0}
            .po-btn.ghost:hover{background:#f8fafc}
            .po-btn.danger{background:#dc2626;color:#fff}
            .po-btn.danger:hover{background:#b91c1c}
            .po-btn.sm{padding:7px 12px;font-size:11px}

            .po-field{margin-bottom:0}
            .po-field label,.po-label{display:block;font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#475569;margin-bottom:5px}
            .po-field input,.po-field select,.po-field textarea,.po-modal-body textarea{width:100%;padding:10px 12px;border:1px solid #e4e9f0;border-radius:8px;font-size:13px;outline:none;color:#0f172a;background:#fff}
            .po-field input:focus,.po-field select:focus,.po-field textarea:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.12)}
            .po-form-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
            .po-hint{font-size:11px;color:#8494a8;margin-top:6px}
            .po-confirm-text{font-size:13px;color:#475569;line-height:1.6;margin:0}

            .po-drop{border:2px dashed #cbd5e1;border-radius:12px;padding:28px;text-align:center;cursor:pointer;transition:all .2s;background:#f8fafc}
            .po-drop .t{color:#64748b;font-size:13px}
            .po-drop .ok{color:#15803d;font-weight:600;margin-top:8px;display:none;font-size:11px}
            .po-info{background:#f8fafc;border:1px solid #e4e9f0;border-radius:10px;padding:14px;margin-top:12px;font-size:11px;color:#64748b;line-height:1.6}
            .po-info strong{color:#334155}
            .po-info em{color:#94a3b8}
            .po-preview{max-height:200px;overflow-y:auto;margin-top:12px}
            .po-mini{width:100%;border-collapse:collapse;font-size:11px}
            .po-mini th{padding:6px 8px;text-align:left;font-size:10px;font-weight:700;color:#64748b;background:#f8fafc;border-bottom:1px solid #e4e9f0;position:sticky;top:0}
            .po-mini td{padding:6px 8px;border-bottom:1px solid #f1f5f9;color:#475569}
            .po-mini td.cod{font-weight:600;color:#1e293b}
            .po-mini td.err{color:#dc2626}
            .po-repeat{background:#fee2e2;color:#991b1b;font-size:10px;padding:1px 6px;border-radius:8px;margin-left:6px}
            .po-err-wrap{border:1px solid #e4e9f0;border-radius:10px;overflow:hidden;max-height:220px;overflow-y:auto}
            .po-solution{margin-top:10px;padding:10px 14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;font-size:11px;color:#9a3412}
            .po-ok-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;text-align:center}
            .po-ok-box .big{font-size:20px;color:#15803d;font-weight:700}
            .po-ok-box .t{font-size:13px;font-weight:700;color:#166534;margin-top:4px}
            .po-ok-box .s{font-size:11px;color:#16a34a;margin-top:4px}

            .po-cards-mobile{display:none}
            .po-mcard{border:1px solid #e4e9f0;border-radius:12px;padding:12px 14px;margin-bottom:8px;background:#fff}
            .po-mcard .t1{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px;font-size:13px}
            .po-mcard .t2{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
            .po-mcard .acc{display:flex;gap:6px;margin-top:8px}

            @media(max-width:768px){
                .po-hero{flex-direction:column;align-items:flex-start;padding:16px}
                .po-hero h2{font-size:15px}
                .po-hero-actions{margin-left:0;width:100%;flex-wrap:wrap}
                .po-kpis{grid-template-columns:1fr 1fr;gap:8px}
                .po-kpi .v{font-size:15px}
                .po-toolbar{flex-direction:column;align-items:stretch}
                .po-search{max-width:none}
                .po-table-wrap{display:none}
                .po-cards-mobile{display:block;padding:12px}
                .po-tabs{width:100%}
                .po-tab{flex:1;text-align:center}
                .po-form-grid{grid-template-columns:1fr 1fr}
                .po-dr-grid{grid-template-columns:1fr 1fr}
                .po-drawer{width:100%}
                .po-kpis[style*="repeat(4"]{grid-template-columns:1fr 1fr!important}
            }
        </style>`;
    },

    // ── Etiqueta de pedido (100x70mm por defecto, 20mm libres abajo) ─────────
    etiquetaModal(id) {
        const o = this.ordenes.find(x => x.id === id);
        if (!o) return;
        this._etiqueta = o;
        const guardado = JSON.parse(localStorage.getItem('vf_etiqueta_cfg2') || '{}');
        const ancho = guardado.ancho || 100, alto = guardado.alto || 70, libre = guardado.libre || 10;
        const html = `
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px">
                <div><label style="display:block;font-size:10px;font-weight:700;color:#475569;margin-bottom:4px">ANCHO (mm)</label><input type="number" id="etqAncho" value="${ancho}" style="width:100%;padding:9px;border:1px solid #e4e9f0;border-radius:8px;font-size:13px"></div>
                <div><label style="display:block;font-size:10px;font-weight:700;color:#475569;margin-bottom:4px">ALTO (mm)</label><input type="number" id="etqAlto" value="${alto}" style="width:100%;padding:9px;border:1px solid #e4e9f0;border-radius:8px;font-size:13px"></div>
                <div><label style="display:block;font-size:10px;font-weight:700;color:#475569;margin-bottom:4px">ZONA LIBRE ABAJO (mm)</label><input type="number" id="etqLibre" value="${libre}" style="width:100%;padding:9px;border:1px solid #e4e9f0;border-radius:8px;font-size:13px"></div>
            </div>
            <div style="font-size:11px;color:#8494a8;margin-bottom:10px">Al imprimir elige tu <strong>impresora de etiquetas</strong> en el diálogo del navegador (el tamaño se ajusta solo vía @page). El margen inferior queda sin información.</div>
            <div id="etqPreview"></div>`;
        App.showModalInv('🏷️ Imprimir etiqueta — ' + escText((o.pedido_sap_id || '') + ' · ' + (o.item_numero || '')), html,
            '<button class="po-btn ghost" onclick="App.hideModal()">Cancelar</button>' +
            '<button class="po-btn primary" onclick="App.modules.produccion.printEtiqueta()">🖨 Imprimir</button>');
        this._pintarEtiquetaPreview();
    },

    _etiquetaCfg() {
        const cfg = {
            ancho: Number(document.getElementById('etqAncho')?.value) || 100,
            alto: Number(document.getElementById('etqAlto')?.value) || 70,
            libre: Number(document.getElementById('etqLibre')?.value) || 20
        };
        localStorage.setItem('vf_etiqueta_cfg2', JSON.stringify(cfg));
        return cfg;
    },

    _nota9(o) {
        const f = o.fecha_entrega_pactada ? new Date(o.fecha_entrega_pactada) : new Date();
        const ff = String(f.getDate()).padStart(2, '0') + '-' + String(f.getMonth() + 1).padStart(2, '0') + '-' + f.getFullYear();
        return (o.codigo_padre || o.codigo_producto || '') + '|' + ff + '|' + (o.pedido_sap_id || '') + '-' + String(o.item_numero || 1) + '|' + Number(o.metros_cuadrados || 0).toFixed(3);
    },

    _etiquetaHtml(o, escala) {
        const cfg = this._etiquetaCfg();
        const pri = ({ 1: 'Normal', 2: 'Express', 3: 'Urgencia', 4: 'Reposición' }[Number(o.nivel_prioridad)]) || 'Normal';
        const qr = (typeof location !== 'undefined' ? location.origin : '') + '/api/taller/qr?d=' + encodeURIComponent(this._nota9(o));
        return '<div class="etq" style="width:' + (cfg.ancho * escala) + 'mm;height:' + (cfg.alto * escala) + 'mm;position:relative;background:#fff;font-family:Segoe UI,Arial,sans-serif;overflow:hidden">'
            + '<div style="padding:' + (2 * escala) + 'mm;display:flex;gap:' + (2 * escala) + 'mm">'
            + '  <div style="flex:1;min-width:0">'
            + '    <div style="font-size:' + (26 * escala) + 'px;font-weight:800">' + escText((o.pedido_sap_id || '') + ' · ' + (o.item_numero || ''))+ '</div>'
            + '    <div style="font-size:' + (14 * escala) + 'px;margin-top:' + (1 * escala) + 'mm">' + escText(o.cliente || '') + '</div>'
            + '    <div style="font-size:' + (14 * escala) + 'px;margin-top:' + (1 * escala) + 'mm"><strong>SAP:</strong> ' + escText(o.codigo_padre || o.codigo_producto || '') + ' · <strong>MP:</strong> ' + escText(o.codigo_producto || '') + '</div>'
            + '    <div style="font-size:' + (14 * escala) + 'px">' + escText((o.nombre_mp || o.descripcion || '') ) + '</div>'
            + '    <div style="font-size:' + (14 * escala) + 'px;color:#475569">' + escText(o.nombre_codigo_padre || '') + '</div>'
            + '    <div style="font-size:' + (14 * escala) + 'px">' + this._fmt(o.ancho, 0) + ' × ' + this._fmt(o.alto, 0) + ' mm · ' + this._fmt(o.cantidad || 1, 0) + ' und · ' + this._fmt(o.metros_cuadrados, 2) + ' m² · ' + this._fmt(o.kilos, 1) + ' kg</div>'
            + '    <div style="font-size:' + (14 * escala) + 'px"><strong>Entrega:</strong> ' + escText(this._fecha(o.fecha_entrega_pactada) || '—') + ' · <strong>Grupo:</strong> ' + escText(o.grupo || '—') + '</div>'
            + '    <div style="font-size:' + (14 * escala) + 'px;color:#475569;line-height:1.25;word-break:break-word"><strong>Ruta:</strong> ' + escText((o.estaciones || []).join(' → ') || '—') + '</div>'
            + '    <div style="font-size:' + (14 * escala) + 'px;color:#475569">' + escText(o.orden_compra ? 'OC ' + o.orden_compra + ' · ' : '') + escText(o.tipo_entrega || '') + ' · Prioridad: ' + escText(pri) + '</div>'
            + '  </div>'
                        + '</div>'
            + '<div style="position:absolute;right:' + (1 * escala) + 'mm;bottom:' + ((cfg.libre + 0.5) * escala) + 'mm;text-align:center"><img src="' + qr + '" width="' + (45 * escala) + 'mm" height="' + (45 * escala) + 'mm" alt="QR"></div>'
+ '<div style="position:absolute;left:0;right:0;bottom:0;height:' + (cfg.libre * escala) + 'mm;border-top:1px dashed #cbd5e1"></div>'
            + '</div>';
    },

    _pintarEtiquetaPreview() {
        const el = document.getElementById('etqPreview');
        if (el && this._etiqueta) el.innerHTML = this._etiquetaHtml(this._etiqueta, 1);
    },

    printEtiqueta() {
        const o = this._etiqueta;
        if (!o) return;
        const cfg = this._etiquetaCfg();
        const frame = document.createElement('iframe');
        frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
        document.body.appendChild(frame);
        const doc = frame.contentWindow.document;
        doc.open();
        doc.write('<html><head><title>Etiqueta</title><style>@page{size:' + cfg.ancho + 'mm ' + cfg.alto + 'mm;margin:0}body{margin:0}</style></head><body>' + this._etiquetaHtml(o, 1) + '</body></html>');
        doc.close();
        setTimeout(() => { frame.contentWindow.focus(); frame.contentWindow.print(); setTimeout(() => frame.remove(), 1500); }, 300);
    },

});
