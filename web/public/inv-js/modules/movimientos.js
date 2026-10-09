// Escape XSS: usa los helpers del SPA (app-main.js); fallback si se carga aislado
window.escText = window.escText || function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); };
window.escAttr = window.escAttr || window.escText;

// ============================================================================
// Movimientos — lenguaje visual "hoja tecnica de vidrio" (ver css/inv-pro.css)
// COLOR = SIGNIFICADO: datos neutros; solo se colorea lo que exige una decision.
// ============================================================================
const InvMovimientos = {
    tipoMovimiento: '',
    tipoSalida: '',
    _materiasPrimas: [],
    _stockDimensiones: [],
    _guardando: false,

    async render() {
        const page = document.querySelector('.page.active');
        page.innerHTML = '<div class="empty-state"><p>Cargando...</p></div>';
        try {
            const hdrs = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            // Verificar res.ok: un 401/403/500 NO debe interpretarse como "sin materias primas"
            const resMp = await fetch('/api/inv/materias-primas', { headers: hdrs });
            const mpBody = await resMp.json().catch(() => ({}));
            if (!resMp.ok) throw new Error(mpBody.error || mpBody.mensaje || ('HTTP ' + resMp.status));
            const mpData = mpBody;
            this._materiasPrimas = Array.isArray(mpData) ? mpData : [];
            const mpOptions = this._materiasPrimas.map(mp => `<option value="${mp.id}" data-ancho="${mp.ancho_nal || 0}" data-alto="${mp.alto_nal || 0}" data-espesor="${mp.espesor_mm || 0}">${escText(mp.codigo_mp)} - ${escText(mp.nombre)} (${escText(mp.espesor_mm)}mm)</option>`).join('');

            const ahora = new Date();
            const hoy = ahora.getFullYear() + '-' + String(ahora.getMonth() + 1).padStart(2, '0') + '-' + String(ahora.getDate()).padStart(2, '0');
            const horaAhora = String(ahora.getHours()).padStart(2, '0') + ':' + String(ahora.getMinutes()).padStart(2, '0');

            page.innerHTML = `
                <style>
                    /* Grids del formulario (patron del modulo) + utilidades de datos */
                    .inv-form-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px 10px;align-items:end}
                    .inv-form-dims{display:grid;grid-template-columns:repeat(4,1fr);gap:6px 10px;align-items:end}
                    .inv-form-grid>div,.inv-form-dims>div{min-width:0;margin:0}
                    .inv-form-bottom{display:flex;gap:8px;margin-top:10px;align-items:center;padding-top:10px;border-top:1px solid var(--invp-line)}
                    .inv-pro .invp-sutil{color:var(--invp-slate);font-weight:400}
                    .inv-pro .invp-val.invp-danger{color:var(--invp-danger)}
                    /* La regla base de td pinta slate; esta variante gana por especificidad */
                    .inv-pro .invp-table td.invp-danger{color:var(--invp-danger);font-weight:600}
                    @media(max-width:768px){
                        .inv-form-grid{grid-template-columns:1fr}
                        .inv-form-dims{grid-template-columns:1fr 1fr}
                        .inv-form-bottom{flex-direction:column;align-items:stretch}
                        .inv-form-bottom .invp-btn{width:100%;justify-content:center}
                    }
                </style>

                <div class="inv-pro">
                    <div class="invp-hero">
                        <div>
                            <h2>Movimientos</h2>
                            <p>Registro de entradas y salidas de inventario</p>
                        </div>
                    </div>

                    <div class="invp-card">
                        <div class="invp-card-head">
                            <h3>Nuevo movimiento</h3>
                        </div>
                        <div style="padding:16px 22px">
                            <form onsubmit="InvMovimientos.guardar(event)">
                                <div class="inv-form-grid">
                                    <div class="invp-field"><label>Tipo de movimiento *</label>
                                        <div style="display:flex;gap:6px">
                                            <button type="button" class="invp-btn invp-btn-filter" id="btnEntrada" aria-pressed="false" style="flex:1;justify-content:center" onclick="InvMovimientos.setTipo('entrada')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Entrada</button>
                                            <button type="button" class="invp-btn invp-btn-filter" id="btnSalida" aria-pressed="false" style="flex:1;justify-content:center" onclick="InvMovimientos.setTipo('salida')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg> Salida</button>
                                        </div>
                                    </div>
                                    <div class="invp-field"><label for="materiaPrimaId">Materia prima *</label>
                                        <select id="materiaPrimaId" required onchange="InvMovimientos.onMpChange()">
                                            <option value="">Seleccionar...</option>${mpOptions}
                                        </select>
                                    </div>
                                    <div class="invp-field" id="tipoSalidaGroup" style="display:none"><label>Tipo de salida</label>
                                        <div style="display:flex;gap:6px">
                                            <button type="button" class="invp-btn invp-btn-filter" id="btnPlancha" aria-pressed="false" style="flex:1;justify-content:center;padding:7px 10px" onclick="InvMovimientos.setTipoSalida('plancha_completa')">Plancha</button>
                                            <button type="button" class="invp-btn invp-btn-filter" id="btnTrozo" aria-pressed="false" style="flex:1;justify-content:center;padding:7px 10px" onclick="InvMovimientos.setTipoSalida('trozo')">Trozo</button>
                                        </div>
                                    </div>
                                </div>

                                <div id="stockDimGroup" style="display:none;margin-top:10px">
                                    <div class="inv-form-dims">
                                        <div class="invp-field" style="grid-column:span 2"><label>Medida disponible (stock)</label>
                                            <select id="stockDimensionSelect" onchange="InvMovimientos.onStockDimChange()">
                                                <option value="">Seleccionar medida...</option>
                                            </select>
                                        </div>
                                        <div class="invp-field"><label>Stock</label>
                                            <div id="stockDimInfo" class="invp-val" style="padding:10px 12px;background:#fbfcfe;border:1px solid var(--invp-line);border-radius:8px">-</div>
                                        </div>
                                        <div class="invp-field"><label>m² Unitario</label>
                                            <div id="m2UnitDisplay" class="invp-val" style="padding:10px 12px;background:#fbfcfe;border:1px solid var(--invp-line);border-radius:8px">-</div>
                                        </div>
                                    </div>
                                    <div id="stockDimTabla" style="margin-top:10px"></div>
                                </div>

                                <div class="inv-form-dims" style="margin-top:10px">
                                    <div class="invp-field"><label for="ancho">Ancho (mm) *</label><input type="number" id="ancho" placeholder="2000" required min="1" oninput="InvMovimientos.calcM2()"></div>
                                    <div class="invp-field"><label for="alto">Alto (mm) *</label><input type="number" id="alto" placeholder="1500" required min="1" oninput="InvMovimientos.calcM2()"></div>
                                    <div class="invp-field"><label for="cantidadPlanchas">Cantidad *</label><input type="number" id="cantidadPlanchas" placeholder="5" required min="1" oninput="InvMovimientos.calcM2()"></div>
                                    <div class="invp-field"><label>m²</label><div id="m2Display" class="invp-val" style="padding:10px 12px;background:#fbfcfe;border:1px solid var(--invp-line);border-radius:8px">0.00</div></div>
                                </div>
                                <div class="inv-form-grid" style="margin-top:10px">
                                    <div class="invp-field"><label for="turno">Turno *</label><select id="turno" required><option value="">Seleccionar...</option><option value="Dia">Dia</option><option value="Noche">Noche</option></select></div>
                                    <div class="invp-field"><label for="fecha">Fecha</label><input type="date" id="fecha" max="${hoy}" title="No se pueden registrar movimientos con fecha futura"></div>
                                    <div class="invp-field"><label for="hora">Hora</label><input type="time" id="hora" value="${horaAhora}" title="Hora del movimiento (si cambias la fecha, revisa la hora)"></div>
                                </div>
                                <div class="invp-field" style="margin-top:10px"><label for="proveedor">Proveedor</label><input type="text" id="proveedor" placeholder="Opcional"></div>
                                <div class="invp-field" style="margin-top:10px"><label for="observaciones">Observaciones</label><input type="text" id="observaciones" placeholder="Notas..."></div>
                                <div class="inv-form-bottom">
                                    <button type="submit" class="invp-btn invp-btn-primary" style="padding:11px 28px">Registrar</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>`;

        } catch(err) {
            // Error visible en vez de un formulario con el selector vacío
            App.toast('Error al cargar materias primas: ' + err.message, 'error');
            page.innerHTML = '<div class="inv-pro"><div class="alert alert-danger">Error: ' + escText(err.message) + '</div></div>';
        }
    },

    onMpChange() {
        const sel = document.getElementById('materiaPrimaId');
        if (!sel) return;
        const mpId = sel.value;
        if (!mpId) return;

        if (this.tipoMovimiento === 'salida' && this.tipoSalida === 'plancha_completa') {
            this.cargarStockDimensiones(mpId);
        } else {
            const opt = sel.options[sel.selectedIndex];
            if (opt && opt.value) {
                const ancho = opt.dataset.ancho;
                const alto = opt.dataset.alto;
                if (ancho && parseInt(ancho) > 0) document.getElementById('ancho').value = ancho;
                if (alto && parseInt(alto) > 0) document.getElementById('alto').value = alto;
                this.calcM2();
            }
        }
    },

    async cargarStockDimensiones(mpId) {
        const group = document.getElementById('stockDimGroup');
        const select = document.getElementById('stockDimensionSelect');
        const info = document.getElementById('stockDimInfo');
        const m2Info = document.getElementById('m2UnitDisplay');
        try {
            const hdrs = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const res = await fetch('/api/inv/stock-por-dimension?mp_id=' + mpId, { headers: hdrs });
            const body = await res.json().catch(() => ({}));
            // Sin res.ok el TypeError quedaba oculto y el grupo de medidas desaparecia sin aviso
            if (!res.ok) throw new Error(body.error || body.mensaje || ('HTTP ' + res.status));
            this._stockDimensiones = Array.isArray(body) ? body : [];

            if (this._stockDimensiones.length === 0) {
                group.style.display = 'none';
                this.resetDimInputs(false);
                return;
            }

            select.innerHTML = '<option value="">Seleccionar medida...</option>' +
                this._stockDimensiones.map(function(d, i) {
                    return '<option value="' + i + '">' + escText(d.ancho) + ' x ' + escText(d.alto) + ' mm</option>';
                }).join('');

            // Tabla de medidas disponibles (invp-table): datos en mono, numeros a la
            // derecha. COLOR = SIGNIFICADO: el stock solo se colorea si esta en 0.
            const tabla = document.getElementById('stockDimTabla');
            if (tabla) {
                tabla.innerHTML = '<table class="invp-table"><thead><tr>'
                    + '<th>Medida</th><th class="num invp-col-stock">Stock</th><th class="num">m² unit.</th>'
                    + '</tr></thead><tbody>'
                    + this._stockDimensiones.map(function(d, i) {
                        return '<tr style="cursor:pointer" onclick="document.getElementById(\'stockDimensionSelect\').value=\'' + i + '\';InvMovimientos.onStockDimChange()">'
                            + '<td class="codigo invp-mono">' + escText(d.ancho) + '×' + escText(d.alto) + '<span class="invp-unidad">mm</span></td>'
                            + '<td class="num invp-mono invp-col-stock ' + (Number(d.stock) <= 0 ? 'invp-danger' : 'valor') + '">' + escText(d.stock) + '</td>'
                            + '<td class="num invp-mono sutil">' + escText(d.m2_unitario) + '</td>'
                            + '</tr>';
                    }).join('')
                    + '</tbody></table>';
            }

            if (this._stockDimensiones.length === 1) {
                select.value = '0';
                this.onStockDimChange();
            } else {
                info.textContent = '-';
                info.className = 'invp-val';
                m2Info.textContent = '-';
                this.resetDimInputs(true);
            }

            group.style.display = 'block';
        } catch(e) {
            // Aviso claro: sin esto el usuario podia registrar salidas sin validacion de stock
            group.style.display = 'none';
            this._stockDimensiones = [];
            App.toast('No se pudo cargar el stock por medida: ' + e.message, 'error');
        }
    },

    onStockDimChange() {
        const select = document.getElementById('stockDimensionSelect');
        const info = document.getElementById('stockDimInfo');
        const m2Info = document.getElementById('m2UnitDisplay');
        const idx = select.value;

        if (idx === '') {
            info.textContent = '-';
            info.className = 'invp-val';
            m2Info.textContent = '-';
            this.resetDimInputs(true);
            return;
        }

        var dim = this._stockDimensiones[parseInt(idx)];
        document.getElementById('ancho').value = dim.ancho;
        document.getElementById('alto').value = dim.alto;
        document.getElementById('ancho').readOnly = true;
        document.getElementById('alto').readOnly = true;
        info.textContent = dim.stock + ' planchas';
        // COLOR = SIGNIFICADO: el stock por medida solo se colorea si esta agotado
        info.className = 'invp-val' + (Number(dim.stock) <= 0 ? ' invp-danger' : '');
        m2Info.textContent = dim.m2_unitario + ' m2';
        this.calcM2();
    },

    resetDimInputs(readonly) {
        var ancho = document.getElementById('ancho');
        var alto = document.getElementById('alto');
        if (ancho) { ancho.readOnly = readonly; if (readonly) ancho.value = ''; }
        if (alto) { alto.readOnly = readonly; if (readonly) alto.value = ''; }
    },

    setTipo(t) {
        this.tipoMovimiento = t;
        // Estado visual via aria-pressed (sistema inv-pro): sin colores por tipo
        const btnE = document.getElementById('btnEntrada');
        const btnS = document.getElementById('btnSalida');
        if (btnE) btnE.setAttribute('aria-pressed', t === 'entrada' ? 'true' : 'false');
        if (btnS) btnS.setAttribute('aria-pressed', t === 'salida' ? 'true' : 'false');
        document.getElementById('tipoSalidaGroup').style.display = t === 'salida' ? 'block' : 'none';
        document.getElementById('stockDimGroup').style.display = 'none';
        this.resetDimInputs(false);
        this.tipoSalida = '';
        const btnP = document.getElementById('btnPlancha');
        const btnT = document.getElementById('btnTrozo');
        if (btnP) btnP.setAttribute('aria-pressed', 'false');
        if (btnT) btnT.setAttribute('aria-pressed', 'false');
    },

    setTipoSalida(ts) {
        this.tipoSalida = ts;
        const btnP = document.getElementById('btnPlancha');
        const btnT = document.getElementById('btnTrozo');
        if (btnP) btnP.setAttribute('aria-pressed', ts === 'plancha_completa' ? 'true' : 'false');
        if (btnT) btnT.setAttribute('aria-pressed', ts === 'trozo' ? 'true' : 'false');

        var mpId = document.getElementById('materiaPrimaId').value;
        if (ts === 'plancha_completa' && mpId) {
            this.cargarStockDimensiones(mpId);
        } else {
            document.getElementById('stockDimGroup').style.display = 'none';
            this.resetDimInputs(false);
        }
    },

    calcM2() {
        const a = parseInt(document.getElementById('ancho')?.value) || 0;
        const al = parseInt(document.getElementById('alto')?.value) || 0;
        const c = parseInt(document.getElementById('cantidadPlanchas')?.value) || 0;
        const m2 = (a * al * c) / 1000000;
        const el = document.getElementById('m2Display');
        if (el) el.textContent = m2.toFixed(2) + ' m2';
    },

    async guardar(e) {
        e.preventDefault();
        if (!this.tipoMovimiento) { App.toast('Selecciona tipo de movimiento', 'error'); return; }
        const materiaPrimaId = document.getElementById('materiaPrimaId').value;
        if (!materiaPrimaId) { App.toast('Selecciona una materia prima', 'error'); return; }

        if (this.tipoMovimiento === 'salida' && !this.tipoSalida) { App.toast('Selecciona tipo de salida: Plancha o Trozo', 'error'); return; }

        if (this.tipoMovimiento === 'salida' && this.tipoSalida === 'plancha_completa') {
            var sel = document.getElementById('stockDimensionSelect');
            if (!sel || sel.value === '') { App.toast('Selecciona una medida disponible', 'error'); return; }
            var dim = this._stockDimensiones[parseInt(sel.value)];
            var cant = parseInt(document.getElementById('cantidadPlanchas').value) || 0;
            if (cant > dim.stock) { App.toast('Cantidad excede stock disponible (' + dim.stock + ' planchas)', 'error'); return; }
        }

        // Evitar doble submit: doble click = doble movimiento
        if (this._guardando) return;
        this._guardando = true;
        const btn = e.target.querySelector('button[type="submit"]');
        if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

        // Fecha y hora explícitas: si el usuario elige una fecha pasada, se
        // respeta la hora del campo (antes se pegaba la hora ACTUAL y quedaba
        // un movimiento "del lunes pasado a las 14:32 de hoy").
        var now = new Date();
        var hhmmss = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ':' + String(now.getSeconds()).padStart(2, '0');
        var fechaLocal = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + 'T' + hhmmss;
        var fechaSeleccionada = document.getElementById('fecha').value;
        var horaSeleccionada = document.getElementById('hora').value;
        var horaFinal = horaSeleccionada ? horaSeleccionada + ':00' : hhmmss;
        var fechaHora = fechaSeleccionada ? fechaSeleccionada + 'T' + horaFinal : fechaLocal;
        const data = {
            tipo_movimiento: this.tipoMovimiento,
            materia_prima_id: parseInt(materiaPrimaId),
            ancho: parseInt(document.getElementById('ancho').value) || 0,
            alto: parseInt(document.getElementById('alto').value) || 0,
            cantidad_planchas: parseInt(document.getElementById('cantidadPlanchas').value) || 0,
            proveedor: document.getElementById('proveedor').value || null,
            turno: document.getElementById('turno').value || null,
            tipo_salida: this.tipoMovimiento === 'salida' ? this.tipoSalida : null,
            observaciones: document.getElementById('observaciones').value || null,
            fecha_hora: fechaHora
        };
        try {
            await api.inv().crearMovimiento(data);
            App.toast('Movimiento registrado');
            this.render();
        } catch(err) { App.toast('Error: ' + err.message, 'error'); }
        finally {
            // Re-habilitar el boton siempre (tambien si la vista no se re-renderiza)
            this._guardando = false;
            if (btn) { btn.disabled = false; btn.textContent = 'Registrar'; }
        }
    }
};
