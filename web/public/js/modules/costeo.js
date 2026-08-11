App.registerModule('costeo', {
    _cristales: [],
    _config: {},
    _resultado: null,

    async render() {
        const el = document.getElementById('page-costeo');
        el.innerHTML = `
            <div class="costeo-wrap">
                <div class="costeo-header">
                    <h2>Calculadora de Costeos y Márgenes</h2>
                    <p>Simulación de costos de producción por pieza</p>
                </div>
                <div class="costeo-grid">
                    <div class="costeo-form-card" id="costeoFormCard">
                        <div class="costeo-section-title">Datos de Producción</div>
                        <div class="costeo-form-grid">
                            <div class="costeo-field costeo-field-full">
                                <label>Cristal</label>
                                <select id="cristal_select" class="costeo-input" onchange="App.modules.costeo.onCristalChange()">
                                    <option value="">Seleccione cristal...</option>
                                </select>
                            </div>
                            <div class="costeo-field" id="precio_cristal_display" style="display:none">
                                <label>Precio / m²</label>
                                <div class="costeo-readonly" id="precio_cristal_val">$ 0</div>
                            </div>
                            <div class="costeo-field">
                                <label>Margen Esperado (%)</label>
                                <input type="number" id="margen_input" class="costeo-input costeo-input-yellow" value="50" min="0" max="500">
                            </div>
                        </div>
                        <div class="costeo-divider"></div>
                        <div class="costeo-section-title">Medidas</div>
                        <div class="costeo-form-grid">
                            <div class="costeo-field">
                                <label>Ancho (mm)</label>
                                <input type="number" id="ancho_input" class="costeo-input costeo-input-yellow" placeholder="1000">
                            </div>
                            <div class="costeo-field">
                                <label>Alto (mm)</label>
                                <input type="number" id="alto_input" class="costeo-input costeo-input-yellow" placeholder="1000">
                            </div>
                            <div class="costeo-field costeo-field-full">
                                <label>Área calculada</label>
                                <div class="costeo-readonly" id="area_display">0.0000 m²</div>
                            </div>
                        </div>
                        <div class="costeo-divider"></div>
                        <div class="costeo-section-title">Procesos</div>
                        <div class="costeo-form-grid">
                            <div class="costeo-field">
                                <label>Tipo Pulido (ml)</label>
                                <input type="number" id="pulido_input" class="costeo-input costeo-input-yellow" value="0" min="0">
                            </div>
                            <div class="costeo-field">
                                <label>N° Perforaciones</label>
                                <input type="number" id="perforaciones_input" class="costeo-input costeo-input-yellow" value="0" min="0">
                            </div>
                            <div class="costeo-field">
                                <label>N° Destajes</label>
                                <input type="number" id="destajes_input" class="costeo-input costeo-input-yellow" value="0" min="0">
                            </div>
                            <div class="costeo-field">
                                <label>Destaje Complejo</label>
                                <select id="destaje_complejo_input" class="costeo-input costeo-input-yellow">
                                    <option value="0">No</option>
                                    <option value="1">Sí</option>
                                </select>
                            </div>
                            <div class="costeo-field">
                                <label>Pintado Color</label>
                                <select id="pintado_input" class="costeo-input costeo-input-yellow">
                                    <option value="0">No</option>
                                    <option value="1">Sí</option>
                                </select>
                            </div>
                            <div class="costeo-field">
                                <label>Área Pintado (m²)</label>
                                <input type="number" id="area_pintado_input" class="costeo-input costeo-input-yellow" value="0" min="0" step="0.01">
                            </div>
                        </div>
                        <button class="btn btn-primary costeo-btn-calcular" onclick="App.modules.costeo.calcular()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/></svg>
                            Calcular Costo
                        </button>
                    </div>
                    <div class="costeo-results-card" id="costeoResults">
                        <div class="costeo-section-title">Desglose de Costos</div>
                        <div class="costeo-results-placeholder">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/></svg>
                            <p>Ingrese los datos y presione <strong>Calcular Costo</strong></p>
                        </div>
                    </div>
                </div>
            </div>`;

        await this.loadCristales();
        this.bindInputs();
    },

    async loadCristales() {
        try {
            const res = await fetch('/api/costeo/cristales');
            this._cristales = await res.json();
            const sel = document.getElementById('cristal_select');
            sel.innerHTML = '<option value="">Seleccione cristal...</option>' +
                this._cristales.map(c => `<option value="${c.id}">${c.nombre} ${c.espesor_mm}mm - $${Number(c.costo_unitario_mp).toLocaleString()}/m²</option>`).join('');
        } catch (e) {
            console.error('Error loading cristales:', e);
        }
    },

    onCristalChange() {
        const sel = document.getElementById('cristal_select');
        const id = parseInt(sel.value);
        const cristal = this._cristales.find(c => c.id === id);
        const display = document.getElementById('precio_cristal_display');
        const val = document.getElementById('precio_cristal_val');
        if (cristal) {
            display.style.display = '';
            val.textContent = '$ ' + Number(cristal.costo_unitario_mp).toLocaleString();
        } else {
            display.style.display = 'none';
        }
    },

    bindInputs() {
        const inputs = ['ancho_input', 'alto_input'];
        inputs.forEach(id => {
            document.getElementById(id)?.addEventListener('input', () => this.updateArea());
        });
    },

    updateArea() {
        const ancho = parseFloat(document.getElementById('ancho_input')?.value) || 0;
        const alto = parseFloat(document.getElementById('alto_input')?.value) || 0;
        const area = (ancho * alto) / 1000000;
        const display = document.getElementById('area_display');
        if (display) display.textContent = area.toFixed(4) + ' m²';
    },

    async calcular() {
        const cristal_id = parseInt(document.getElementById('cristal_select')?.value);
        const ancho = parseFloat(document.getElementById('ancho_input')?.value);
        const alto = parseFloat(document.getElementById('alto_input')?.value);
        const margen = parseFloat(document.getElementById('margen_input')?.value);
        const tipo_pulido = parseFloat(document.getElementById('pulido_input')?.value) || 0;
        const n_perforaciones = parseInt(document.getElementById('perforaciones_input')?.value) || 0;
        const n_destajes = parseInt(document.getElementById('destajes_input')?.value) || 0;
        const destaje_complejo = document.getElementById('destaje_complejo_input')?.value === '1';
        const pintado_color = document.getElementById('pintado_input')?.value === '1';
        const area_pintado = parseFloat(document.getElementById('area_pintado_input')?.value) || 0;

        if (!cristal_id) return App.showAlert('Seleccione un cristal', 'warning');
        if (!ancho || !alto) return App.showAlert('Ingrese las medidas (ancho y alto)', 'warning');

        const container = document.getElementById('costeoResults');
        container.innerHTML = '<div class="costeo-section-title">Desglose de Costos</div><div style="text-align:center;padding:30px;color:#94a3b8">Calculando...</div>';

        try {
            const res = await fetch('/api/costeo/calcular', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cristal_id, ancho, alto, tipo_pulido,
                    n_perforaciones, n_destajes, destaje_complejo,
                    pintado_color, area_pintado, margen_esperado: margen
                })
            });
            const data = await res.json();
            if (data.error) return App.showAlert(data.error, 'danger');
            this._resultado = data;
            this.renderResults(data);
        } catch (e) {
            console.error('Error calculating:', e);
            App.showAlert('Error al calcular costos', 'danger');
        }
    },

    renderResults(r) {
        const container = document.getElementById('costeoResults');
        const fmt = v => '$ ' + Number(v).toLocaleString();

        container.innerHTML = `
            <div class="costeo-section-title">Desglose de Costos</div>
            <div class="costeo-results-header">
                <span>${r.cristal}</span>
                <span>${r.area_m2} m²</span>
            </div>
            <div class="costeo-results-table">
                <div class="costeo-row"><span>Materia Prima</span><span>${fmt(r.materia_prima)}</span></div>
                <div class="costeo-row"><span>HH (Labor)</span><span>${fmt(r.hh)}</span></div>
                <div class="costeo-row"><span>Energía</span><span>${fmt(r.energia)}</span></div>
                <div class="costeo-row"><span>Pulido</span><span>${fmt(r.pulido)}</span></div>
                <div class="costeo-row"><span>Perforado</span><span>${fmt(r.perforado)}</span></div>
                <div class="costeo-row"><span>Destaje</span><span>${fmt(r.destaje)}</span></div>
                <div class="costeo-row"><span>Pintura</span><span>${fmt(r.pintura)}</span></div>
                <div class="costeo-row"><span>Insumos Pintura</span><span>${fmt(r.insumos_pintura)}</span></div>
                <div class="costeo-row"><span>Otros</span><span>${fmt(r.otros)}</span></div>
                <div class="costeo-row costeo-row-subtotal"><span>(A) Costo sin Mermas</span><span>${fmt(r.costo_sin_mermas)}</span></div>
                <div class="costeo-row costeo-row-merma"><span>Merma proceso (${r._config.merma_proceso_pct}%)</span><span>${fmt(r.merma_proceso)}</span></div>
                <div class="costeo-row costeo-row-merma"><span>Merma aprovech. (${r._config.merma_aprovechamiento_pct}%)</span><span>${fmt(r.merma_aprovechamiento)}</span></div>
                <div class="costeo-row costeo-row-subtotal"><span>(B) Costo de Mermas</span><span>${fmt(r.costo_mermas)}</span></div>
                <div class="costeo-row costeo-row-total"><span>TOTAL COSTO (A + B)</span><span>${fmt(r.total_costo)}</span></div>
                <div class="costeo-row costeo-row-venta"><span>VALOR VENTA</span><span>${fmt(r.valor_venta)}</span></div>
                <div class="costeo-row costeo-row-ganancia"><span>GANANCIA</span><span>${fmt(r.ganancia)}</span></div>
                <div class="costeo-row costeo-row-margen"><span>MARGEN</span><span>${r.margen_esperado}%</span></div>
            </div>
            <div class="costeo-results-footer">
                <button class="btn btn-outline btn-sm" onclick="App.modules.costeo.limpiar()">Limpiar</button>
                <button class="btn btn-primary btn-sm" onclick="App.modules.costeo.calcular()">Recalcular</button>
            </div>`;
    },

    limpiar() {
        document.getElementById('cristal_select').value = '';
        document.getElementById('ancho_input').value = '';
        document.getElementById('alto_input').value = '';
        document.getElementById('pulido_input').value = '0';
        document.getElementById('perforaciones_input').value = '0';
        document.getElementById('destajes_input').value = '0';
        document.getElementById('destaje_complejo_input').value = '0';
        document.getElementById('pintado_input').value = '0';
        document.getElementById('area_pintado_input').value = '0';
        document.getElementById('margen_input').value = '50';
        document.getElementById('precio_cristal_display').style.display = 'none';
        document.getElementById('area_display').textContent = '0.0000 m²';
        document.getElementById('costeoResults').innerHTML = `
            <div class="costeo-section-title">Desglose de Costos</div>
            <div class="costeo-results-placeholder">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/></svg>
                <p>Ingrese los datos y presione <strong>Calcular Costo</strong></p>
            </div>`;
        this._resultado = null;
    }
});
