// Escape XSS: usa los helpers del SPA (app-main.js); fallback si se carga aislado
window.escText = window.escText || function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); };
window.escAttr = window.escAttr || window.escText;

// ============================================================================
// Movimientos — lenguaje visual "hoja tecnica de vidrio" (ver css/inv-pro.css)
// COLOR = SIGNIFICADO: datos neutros; solo se colorea lo que exige una decision.
// Diseno aprobado (diseno-movimientos-v1.html): formulario en 3 secciones
// mas panel RESUMEN EN VIVO — el usuario ve lo que va a registrar antes de
// confirmar. Todo el estilo local vive en el <style> de esta vista.
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
                    /* ---- Layout del formulario (solo esta vista) ---- */
                    .mv-layout{display:grid;grid-template-columns:1.6fr 1fr;gap:16px;align-items:start}
                    .mv-sec{padding:18px 0;border-bottom:1px solid #eef2f7}
                    .mv-sec:last-child{border-bottom:none}
                    .mv-sec-title{font-size:10.5px;font-weight:600;letter-spacing:.9px;text-transform:uppercase;color:var(--invp-muted);margin-bottom:4px}
                    .mv-sec-help{font-size:11.5px;color:var(--invp-muted);margin-bottom:12px}
                    /* Toggles de tipo: tarjetas grandes (decision principal) */
                    .mv-tipo-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
                    .mv-tipo-card{display:flex;gap:10px;align-items:center;text-align:left;padding:13px 15px;border:1.5px solid var(--invp-line);border-radius:11px;background:#fff;cursor:pointer;transition:all .15s;font-family:inherit}
                    .mv-tipo-card:hover{border-color:#c3cedd}
                    .mv-tipo-card[aria-pressed="true"]{border-color:var(--invp-ink);background:#f5f7fa}
                    .mv-tipo-card .ico{width:34px;height:34px;border-radius:9px;background:#eef2f8;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--invp-slate)}
                    .mv-tipo-card[aria-pressed="true"] .ico{background:var(--invp-ink);color:#fff}
                    .mv-tipo-card .t{font-size:13.5px;font-weight:600;color:var(--invp-ink)}
                    .mv-tipo-card .d{font-size:11px;color:var(--invp-muted);margin-top:1px}
                    .mv-chips-row{display:flex;gap:6px;margin-top:10px;align-items:center;flex-wrap:wrap}
                    .mv-chip-hint{font-size:11px;color:var(--invp-muted)}
                    /* Campos */
                    .mv-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px 12px}
                    .mv-grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px 12px}
                    .mv-calc{padding:10px 12px;background:#f8fafc;border:1px solid var(--invp-line);border-radius:8px;font-size:13px;font-weight:600;color:var(--invp-ink);font-variant-numeric:tabular-nums}
                    .mv-calc .sub{font-size:9.5px;color:var(--invp-muted);font-weight:500;text-transform:uppercase;letter-spacing:.5px}
                    /* Aviso de stock contextual */
                    .mv-stock-note{margin-top:10px;display:flex;gap:8px;align-items:baseline;padding:9px 13px;border-radius:8px;font-size:12px;background:#f8fafc;border-left:3px solid #cbd5e1;color:var(--invp-slate)}
                    .mv-stock-note.warn{background:#fdf8f1;border-left-color:var(--invp-warn);color:var(--invp-warn)}
                    .mv-stock-note.danger{background:#fdf3f2;border-left-color:var(--invp-danger);color:var(--invp-danger)}
                    /* Panel RESUMEN */
                    .mv-resumen{position:sticky;top:16px}
                    .mv-r-chip{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:600;letter-spacing:.3px;padding:3px 10px;border-radius:20px;border:1px solid var(--invp-line);color:var(--invp-slate)}
                    .mv-r-chip .dot{width:6px;height:6px;border-radius:50%;background:#94a3b8}
                    .mv-r-chip.ok .dot{background:#10b981}
                    .mv-r-chip.neutro .dot{background:#64748b}
                    .mv-r-row{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:8px 0;border-bottom:1px dashed #eef2f7}
                    .mv-r-lbl{font-size:9.5px;letter-spacing:.6px;text-transform:uppercase;color:var(--invp-muted)}
                    .mv-r-val{font-size:13px;font-weight:600;color:var(--invp-ink);font-variant-numeric:tabular-nums;text-align:right}
                    .mv-r-total{margin-top:10px;padding:12px 14px;background:#f5f7fa;border-radius:10px;display:flex;justify-content:space-between;align-items:baseline}
                    .mv-r-total .l{font-size:10.5px;letter-spacing:.6px;text-transform:uppercase;color:var(--invp-slate);font-weight:600}
                    .mv-r-total .v{font-size:20px;font-weight:700;color:var(--invp-ink);font-variant-numeric:tabular-nums}
                    .mv-btn-registrar{width:100%;margin-top:14px;padding:13px;font-family:inherit;font-size:13.5px;font-weight:600;background:var(--invp-accent);color:#fff;border:none;border-radius:10px;cursor:pointer;transition:background .15s}
                    .mv-btn-registrar:hover{background:#1a44c0}
                    .mv-btn-registrar:disabled{opacity:.65;cursor:not-allowed}
                    .mv-btn-registrar:focus-visible{outline:2px solid var(--invp-accent);outline-offset:2px}
                    @media(max-width:900px){
                        .mv-layout{display:block}
                        .mv-resumen{position:static;margin-top:12px}
                    }
                    @media(max-width:768px){
                        .mv-grid3,.mv-grid4{grid-template-columns:1fr 1fr}
                        .mv-tipo-card{flex-direction:column;text-align:center;gap:6px}
                        .mv-btn-registrar{padding:15px;font-size:14px}
                    }
                </style>

                <div class="inv-pro">
                    <div class="invp-hero">
                        <div>
                            <h2>Movimientos</h2>
                            <p>Registro de entradas y salidas de inventario</p>
                        </div>
                    </div>

                    <div class="mv-layout">
                        <!-- ================= FORMULARIO ================= -->
                        <div class="invp-card">
                            <div class="invp-card-head"><h3>Nuevo movimiento</h3></div>
                            <div style="padding:6px 22px 22px">
                                <form id="formMovimiento" onsubmit="InvMovimientos.guardar(event)">

                                    <div class="mv-sec">
                                        <div class="mv-sec-title">Tipo de movimiento</div>
                                        <div class="mv-sec-help">Elige primero la dirección del movimiento.</div>
                                        <div class="mv-tipo-row">
                                            <button type="button" class="mv-tipo-card" id="btnEntrada" aria-pressed="false" onclick="InvMovimientos.setTipo('entrada')">
                                                <span class="ico"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg></span>
                                                <span><span class="t">Entrada</span><br><span class="d">Entra material al inventario</span></span>
                                            </button>
                                            <button type="button" class="mv-tipo-card" id="btnSalida" aria-pressed="false" onclick="InvMovimientos.setTipo('salida')">
                                                <span class="ico"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg></span>
                                                <span><span class="t">Salida</span><br><span class="d">Sale material del inventario</span></span>
                                            </button>
                                        </div>
                                        <div class="mv-chips-row" id="tipoSalidaGroup" style="display:none">
                                            <span class="mv-chip-hint">Tipo de salida:</span>
                                            <button type="button" class="invp-btn invp-btn-filter" id="btnPlancha" aria-pressed="false" onclick="InvMovimientos.setTipoSalida('plancha_completa')">Plancha completa</button>
                                            <button type="button" class="invp-btn invp-btn-filter" id="btnTrozo" aria-pressed="false" onclick="InvMovimientos.setTipoSalida('trozo')">Trozo</button>
                                        </div>
                                    </div>

                                    <div class="mv-sec">
                                        <div class="mv-sec-title">Material y medidas</div>
                                        <div class="mv-sec-help">Las medidas se completan solas al elegir una medida del stock.</div>
                                        <div class="invp-field" style="margin-bottom:12px">
                                            <label for="materiaPrimaId">Materia prima *</label>
                                            <select id="materiaPrimaId" required onchange="InvMovimientos.onMpChange()">
                                                <option value="">Seleccionar...</option>${mpOptions}
                                            </select>
                                        </div>

                                        <div id="stockDimGroup" style="display:none;margin-bottom:12px">
                                            <div class="invp-field" style="margin-bottom:8px">
                                                <label for="stockDimensionSelect">Medida disponible (stock)</label>
                                                <select id="stockDimensionSelect" onchange="InvMovimientos.onStockDimChange()">
                                                    <option value="">Seleccionar medida...</option>
                                                </select>
                                            </div>
                                            <div id="stockDimTabla"></div>
                                        </div>

                                        <div class="mv-grid4">
                                            <div class="invp-field"><label for="ancho">Ancho (mm) *</label><input type="number" id="ancho" placeholder="2000" required min="1" oninput="InvMovimientos.calcM2()"></div>
                                            <div class="invp-field"><label for="alto">Alto (mm) *</label><input type="number" id="alto" placeholder="1500" required min="1" oninput="InvMovimientos.calcM2()"></div>
                                            <div class="invp-field"><label for="cantidadPlanchas">Cantidad *</label><input type="number" id="cantidadPlanchas" placeholder="5" required min="1" oninput="InvMovimientos.calcM2()"></div>
                                            <div class="invp-field"><label>M² total</label><div class="mv-calc"><span class="sub">calculado</span><br><span id="m2Display">0.00 m²</span></div></div>
                                        </div>
                                        <div class="mv-stock-note" id="stockNote"><span>◇</span><span id="stockNoteTxt">Selecciona una materia prima para ver su stock.</span></div>
                                    </div>

                                    <div class="mv-sec">
                                        <div class="mv-sec-title">Registro</div>
                                        <div class="mv-sec-help">Datos de contexto del movimiento.</div>
                                        <div class="mv-grid3">
                                            <div class="invp-field"><label for="turno">Turno *</label><select id="turno" required onchange="InvMovimientos.updateResumen()"><option value="">Seleccionar...</option><option value="Dia">Dia</option><option value="Noche">Noche</option></select></div>
                                            <div class="invp-field"><label for="fecha">Fecha</label><input type="date" id="fecha" max="${hoy}" onchange="InvMovimientos.updateResumen()" title="No se pueden registrar movimientos con fecha futura"></div>
                                            <div class="invp-field"><label for="hora">Hora</label><input type="time" id="hora" value="${horaAhora}" onchange="InvMovimientos.updateResumen()" title="Hora del movimiento (si cambias la fecha, revisa la hora)"></div>
                                            <div class="invp-field" style="grid-column:span 2"><label for="proveedor">Proveedor</label><input type="text" id="proveedor" placeholder="Opcional"></div>
                                            <div class="invp-field"><label for="observaciones">Observaciones</label><input type="text" id="observaciones" placeholder="Notas..."></div>
                                        </div>
                                    </div>

                                </form>
                            </div>
                        </div>

                        <!-- ================= RESUMEN EN VIVO ================= -->
                        <div class="invp-card mv-resumen">
                            <div class="invp-card-head"><h3>Resumen</h3></div>
                            <div style="padding:18px 20px">
                                <div style="margin-bottom:10px"><span class="mv-r-chip neutro" id="rTipoChip"><span class="dot"></span><span id="rTipoTxt">SIN TIPO</span></span></div>
                                <div class="mv-r-row"><span class="mv-r-lbl">Material</span><span class="mv-r-val" id="rMaterial">—</span></div>
                                <div class="mv-r-row"><span class="mv-r-lbl">Medida</span><span class="mv-r-val" id="rMedida">—</span></div>
                                <div class="mv-r-row"><span class="mv-r-lbl">Cantidad</span><span class="mv-r-val" id="rCantidad">—</span></div>
                                <div class="mv-r-row"><span class="mv-r-lbl">Fecha</span><span class="mv-r-val" id="rFecha">—</span></div>
                                <div class="mv-r-row"><span class="mv-r-lbl">Turno</span><span class="mv-r-val" id="rTurno">—</span></div>
                                <div class="mv-r-total"><span class="l">Total m²</span><span class="v" id="rTotalM2">0.00</span></div>
                                <button type="submit" form="formMovimiento" class="mv-btn-registrar" id="btnRegistrar">Registrar movimiento</button>
                            </div>
                        </div>
                    </div>
                </div>`;

            this.updateResumen();
        } catch (err) {
            // Error visible en vez de un formulario con el selector vacio
            App.toast('Error al cargar materias primas: ' + err.message, 'error');
            page.innerHTML = '<div class="inv-pro"><div class="alert alert-danger">Error: ' + escText(err.message) + '</div></div>';
        }
    },

    // ------------------------------------------------------------------
    // RESUMEN EN VIVO: refleja exactamente lo que se va a registrar.
    // ------------------------------------------------------------------
    updateResumen() {
        const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };

        // Chip de tipo (texto + dot: accesible, sin colores de alarma)
        const chip = document.getElementById('rTipoChip');
        const tipoTxt = this.tipoMovimiento === 'entrada' ? 'ENTRADA' : this.tipoMovimiento === 'salida' ? 'SALIDA' : 'SIN TIPO';
        if (chip) chip.className = 'mv-r-chip ' + (this.tipoMovimiento === 'entrada' ? 'ok' : 'neutro');
        set('rTipoTxt', tipoTxt + (this.tipoMovimiento === 'salida' && this.tipoSalida ? ' · ' + (this.tipoSalida === 'plancha_completa' ? 'PLANCHA' : 'TROZO') : ''));

        // Material
        const selMp = document.getElementById('materiaPrimaId');
        let material = '—';
        if (selMp && selMp.value) {
            const opt = selMp.options[selMp.selectedIndex];
            material = opt ? opt.text : '—';
        }
        set('rMaterial', material);

        // Medida y cantidad
        const ancho = parseInt(document.getElementById('ancho')?.value) || 0;
        const alto = parseInt(document.getElementById('alto')?.value) || 0;
        const cant = parseInt(document.getElementById('cantidadPlanchas')?.value) || 0;
        set('rMedida', (ancho && alto) ? ancho + '×' + alto + ' mm' : '—');
        set('rCantidad', cant ? cant + (this.tipoMovimiento === 'salida' && this.tipoSalida === 'trozo' ? ' piezas' : ' planchas') : '—');

        // Fecha y turno
        const fecha = document.getElementById('fecha')?.value;
        const hora = document.getElementById('hora')?.value;
        let fechaTxt = 'Ahora';
        if (fecha) {
            const p = fecha.split('-');
            fechaTxt = (p[2] || '') + '-' + (p[1] || '') + '-' + (p[0] || '');
        }
        set('rFecha', fechaTxt + (hora ? ' · ' + hora : ''));
        set('rTurno', document.getElementById('turno')?.value || '—');

        // Total m2
        const m2 = (ancho * alto * cant) / 1000000;
        set('rTotalM2', m2.toFixed(2));
    },

    // Aviso contextual de stock bajo las medidas (color SOLO si hay riesgo)
    _updateStockNote() {
        const note = document.getElementById('stockNote');
        const txt = document.getElementById('stockNoteTxt');
        if (!note || !txt) return;
        note.className = 'mv-stock-note';
        const selMp = document.getElementById('materiaPrimaId');
        const mpSel = selMp && selMp.value ? selMp.options[selMp.selectedIndex].text : '';
        const cant = parseInt(document.getElementById('cantidadPlanchas')?.value) || 0;

        if (this.tipoMovimiento === 'salida' && this.tipoSalida === 'plancha_completa') {
            const selDim = document.getElementById('stockDimensionSelect');
            const dim = selDim && selDim.value !== '' ? this._stockDimensiones[parseInt(selDim.value)] : null;
            if (dim) {
                const m2Disp = Number(dim.stock) * Number(dim.m2_unitario || 0);
                txt.innerHTML = 'Stock disponible de <strong>' + escText(dim.ancho) + '×' + escText(dim.alto) + '</strong>: <strong>' + escText(dim.stock) + ' planchas</strong> · ' + m2Disp.toFixed(2) + ' m²';
                if (cant > Number(dim.stock)) {
                    note.className = 'mv-stock-note danger';
                    txt.innerHTML += ' — la cantidad excede el stock';
                } else if (Number(dim.stock) <= 0) {
                    note.className = 'mv-stock-note danger';
                }
                return;
            }
            txt.textContent = 'Selecciona una medida disponible para ver su stock.';
            return;
        }
        if (this.tipoMovimiento === 'salida' && this.tipoSalida === 'trozo') {
            txt.innerHTML = 'El trozo descuenta <strong>m²</strong> del material' + (mpSel ? ' (' + escText(mpSel) + ')' : '') + '. El stock total se valida al registrar.';
            return;
        }
        if (this.tipoMovimiento === 'entrada') {
            txt.innerHTML = 'La entrada <strong>suma stock</strong> de la medida indicada.';
            return;
        }
        txt.textContent = 'Selecciona una materia prima para ver su stock.';
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
        this._updateStockNote();
        this.updateResumen();
    },

    async cargarStockDimensiones(mpId) {
        const group = document.getElementById('stockDimGroup');
        const select = document.getElementById('stockDimensionSelect');
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

            // Tabla de medidas disponibles (invp-table): numeros a la derecha.
            // COLOR = SIGNIFICADO: el stock solo se colorea si esta en 0.
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
                this.resetDimInputs(true);
                this._updateStockNote();
            }

            group.style.display = 'block';
        } catch (e) {
            // Aviso claro: sin esto el usuario podia registrar salidas sin validacion de stock
            group.style.display = 'none';
            this._stockDimensiones = [];
            App.toast('No se pudo cargar el stock por medida: ' + e.message, 'error');
        }
    },

    onStockDimChange() {
        const select = document.getElementById('stockDimensionSelect');
        const idx = select.value;

        if (idx === '') {
            this.resetDimInputs(true);
            this._updateStockNote();
            this.updateResumen();
            return;
        }

        const dim = this._stockDimensiones[parseInt(idx)];
        document.getElementById('ancho').value = dim.ancho;
        document.getElementById('alto').value = dim.alto;
        document.getElementById('ancho').readOnly = true;
        document.getElementById('alto').readOnly = true;
        this.calcM2();
        this._updateStockNote();
        this.updateResumen();
    },

    resetDimInputs(readonly) {
        const ancho = document.getElementById('ancho');
        const alto = document.getElementById('alto');
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
        document.getElementById('tipoSalidaGroup').style.display = t === 'salida' ? 'flex' : 'none';
        document.getElementById('stockDimGroup').style.display = 'none';
        this.resetDimInputs(false);
        this.tipoSalida = '';
        const btnP = document.getElementById('btnPlancha');
        const btnT = document.getElementById('btnTrozo');
        if (btnP) btnP.setAttribute('aria-pressed', 'false');
        if (btnT) btnT.setAttribute('aria-pressed', 'false');
        this._updateStockNote();
        this.updateResumen();
    },

    setTipoSalida(ts) {
        this.tipoSalida = ts;
        const btnP = document.getElementById('btnPlancha');
        const btnT = document.getElementById('btnTrozo');
        if (btnP) btnP.setAttribute('aria-pressed', ts === 'plancha_completa' ? 'true' : 'false');
        if (btnT) btnT.setAttribute('aria-pressed', ts === 'trozo' ? 'true' : 'false');

        const mpId = document.getElementById('materiaPrimaId').value;
        if (ts === 'plancha_completa' && mpId) {
            this.cargarStockDimensiones(mpId);
        } else {
            document.getElementById('stockDimGroup').style.display = 'none';
            this.resetDimInputs(false);
        }
        this._updateStockNote();
        this.updateResumen();
    },

    calcM2() {
        const a = parseInt(document.getElementById('ancho')?.value) || 0;
        const al = parseInt(document.getElementById('alto')?.value) || 0;
        const c = parseInt(document.getElementById('cantidadPlanchas')?.value) || 0;
        const m2 = (a * al * c) / 1000000;
        const el = document.getElementById('m2Display');
        if (el) el.textContent = m2.toFixed(2) + ' m²';
        this._updateStockNote();
        this.updateResumen();
    },

    async guardar(e) {
        e.preventDefault();
        if (!this.tipoMovimiento) { App.toast('Selecciona tipo de movimiento', 'error'); return; }
        const materiaPrimaId = document.getElementById('materiaPrimaId').value;
        if (!materiaPrimaId) { App.toast('Selecciona una materia prima', 'error'); return; }

        if (this.tipoMovimiento === 'salida' && !this.tipoSalida) { App.toast('Selecciona tipo de salida: Plancha o Trozo', 'error'); return; }

        if (this.tipoMovimiento === 'salida' && this.tipoSalida === 'plancha_completa') {
            const sel = document.getElementById('stockDimensionSelect');
            if (!sel || sel.value === '') { App.toast('Selecciona una medida disponible', 'error'); return; }
            const dim = this._stockDimensiones[parseInt(sel.value)];
            const cant = parseInt(document.getElementById('cantidadPlanchas').value) || 0;
            if (cant > dim.stock) { App.toast('Cantidad excede stock disponible (' + dim.stock + ' planchas)', 'error'); return; }
        }

        // Evitar doble submit: doble click = doble movimiento
        if (this._guardando) return;
        this._guardando = true;
        const btn = document.getElementById('btnRegistrar');
        if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

        // Fecha y hora explicitas: si el usuario elige una fecha pasada, se
        // respeta la hora del campo (antes se pegaba la hora ACTUAL y quedaba
        // un movimiento "del lunes pasado a las 14:32 de hoy").
        const now = new Date();
        const hhmmss = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ':' + String(now.getSeconds()).padStart(2, '0');
        const fechaLocal = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + 'T' + hhmmss;
        const fechaSeleccionada = document.getElementById('fecha').value;
        const horaSeleccionada = document.getElementById('hora').value;
        const horaFinal = horaSeleccionada ? horaSeleccionada + ':00' : hhmmss;
        const fechaHora = fechaSeleccionada ? fechaSeleccionada + 'T' + horaFinal : fechaLocal;

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
        } catch (err) { App.toast('Error: ' + err.message, 'error'); }
        finally {
            // Re-habilitar el boton siempre (tambien si la vista no se re-renderiza)
            this._guardando = false;
            if (btn) { btn.disabled = false; btn.textContent = 'Registrar movimiento'; }
        }
    }
};
