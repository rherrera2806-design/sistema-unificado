App.registerModule('costeo', {
    _cristales: [],
    _config: {},
    _resultado: null,

    async render() {
        const el = document.getElementById('page-costeo');
        el.innerHTML = `
            <div class="costeo-wrap">
                <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:8px 16px;margin-bottom:20px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">
                    <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(245,158,11,0.2) 0%,transparent 70%);border-radius:50%"></div>
                    <div style="position:absolute;bottom:-30px;left:-30px;width:120px;height:120px;background:radial-gradient(circle,rgba(59,130,246,0.15) 0%,transparent 70%);border-radius:50%"></div>
                    <div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center">
                        <div>
                            <h2 style="margin:0;font-size:15px;font-weight:800;color:white;letter-spacing:-0.5px">Calculadora de Costeos y Margenes</h2>
                            <p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Simulacion de costos de produccion por pieza</p>
                        </div>
                        <div style="display:flex;gap:6px;align-items:center">
                            <button class="btn btn-outline" style="color:white;border-color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.1);padding:5px 12px;font-size:12px" onclick="App.modules.costeo.openConfig()" title="Configurar costos operativos">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a2.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                                Configurar
                            </button>
                        </div>
                    </div>
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
                            <div class="costeo-field costeo-field-full">
                                <label>Origen</label>
                                <div class="costeo-toggle-group">
                                    <button type="button" class="costeo-toggle active" id="toggle_nac" onclick="App.modules.costeo.setOrigen('nac')">NAC</button>
                                    <button type="button" class="costeo-toggle" id="toggle_imp" onclick="App.modules.costeo.setOrigen('imp')">IMP</button>
                                </div>
                                <input type="hidden" id="origen_input" value="nac">
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
                            <div class="costeo-field costeo-field-full">
                                <label>Tipo de Proceso</label>
                                <select id="proceso_input" class="costeo-input costeo-input-yellow">
                                    <option value="crudo_sin_pulir">Crudo o Laminado sin pulir</option>
                                    <option value="crudo_pulido">Crudo o Laminado pulido</option>
                                    <option value="templado_plano">Templado plano</option>
                                    <option value="templado_curvo">Templado curvo</option>
                                </select>
                            </div>
                            <div class="costeo-field">
                                <label>Tipo Pulido</label>
                                <select id="pulido_input" class="costeo-input costeo-input-yellow">
                                    <option value="0">No</option>
                                    <option value="1">Sí</option>
                                </select>
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
            this._cristales.sort((a, b) => {
                const nameCmp = a.nombre.localeCompare(b.nombre, 'es');
                if (nameCmp !== 0) return nameCmp;
                return (a.espesor_mm || 0) - (b.espesor_mm || 0);
            });
            this.updateCristalDropdown();
        } catch (e) {
            console.error('Error loading cristales:', e);
        }
    },

    updateCristalDropdown() {
        const origen = document.getElementById('origen_input')?.value || 'nac';
        const sel = document.getElementById('cristal_select');
        const currentVal = sel.value;
        sel.innerHTML = '<option value="">Seleccione cristal...</option>' +
            this._cristales.map(c => {
                const precio = origen === 'imp' ? (c.costo_unitario_importado || 0) : (c.costo_unitario_mp || 0);
                return `<option value="${c.id}">${c.nombre} ${c.espesor_mm}mm - $${Number(precio).toLocaleString()}/m²</option>`;
            }).join('');
        sel.value = currentVal;
        this.onCristalChange();
    },

    onCristalChange() {
        const sel = document.getElementById('cristal_select');
        const id = parseInt(sel.value);
        const cristal = this._cristales.find(c => c.id === id);
        const origen = document.getElementById('origen_input')?.value || 'nac';
        const display = document.getElementById('precio_cristal_display');
        const val = document.getElementById('precio_cristal_val');
        if (cristal) {
            display.style.display = '';
            const precio = origen === 'imp' ? (cristal.costo_unitario_importado || 0) : (cristal.costo_unitario_mp || 0);
            val.textContent = '$ ' + Number(precio).toLocaleString();
        } else {
            display.style.display = 'none';
        }
    },

    setOrigen(origen) {
        document.getElementById('origen_input').value = origen;
        document.getElementById('toggle_nac').classList.toggle('active', origen === 'nac');
        document.getElementById('toggle_imp').classList.toggle('active', origen === 'imp');
        this.updateCristalDropdown();
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
        if (display) display.textContent = area.toFixed(2) + ' m²';
    },

    async calcular() {
        const cristal_id = parseInt(document.getElementById('cristal_select')?.value);
        const origen = document.getElementById('origen_input')?.value || 'nac';
        const ancho = parseFloat(document.getElementById('ancho_input')?.value);
        const alto = parseFloat(document.getElementById('alto_input')?.value);
        const margen = parseFloat(document.getElementById('margen_input')?.value);
        const proceso = document.getElementById('proceso_input')?.value || 'crudo_sin_pulir';
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
                    cristal_id, origen, ancho, alto, proceso, tipo_pulido,
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
                <span>${r.cristal} — ${r.nombre_proceso}</span>
                <span>${Number(r.area_m2).toFixed(2)} m²</span>
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
                <div class="costeo-row costeo-row-merma"><span>Merma aprovech. MPA (${r._config.mpa_cristal}%)</span><span>${fmt(r.merma_aprovechamiento)}</span></div>
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
    },

    async openConfig() {
        try {
            const res = await fetch('/api/costeo/config');
            this._config = await res.json();
        } catch (e) {
            console.error('Error loading config:', e);
            this._config = {};
        }

        const cfg = (key) => this._config[key]?.valor || 0;

        const procesos = [
            { key: 'crudo_sin_pulir', label: 'Crudo o Laminado sin pulir' },
            { key: 'crudo_pulido', label: 'Crudo o Laminado pulido' },
            { key: 'templado_plano', label: 'Templado plano' },
            { key: 'templado_curvo', label: 'Templado curvo' }
        ];

        const otrosParams = [
            { key: 'costo_pulido_ml', label: 'Costo Pulido', unit: '$/m²' },
            { key: 'costo_perforacion', label: 'Costo Perforación', unit: '$/ud' },
            { key: 'costo_destaje_kg', label: 'Costo Destaje Normal', unit: '$/kg' },
            { key: 'costo_destaje_complejo_kg', label: 'Costo Destaje Complejo', unit: '$/kg' },
            { key: 'costo_pintura_ml', label: 'Costo Pintura', unit: '$/ml' },
            { key: 'costo_insumos_pintura', label: 'Insumos de Pintura', unit: '$/m²' },
            { key: 'costo_otros_m2', label: 'Otros Costos', unit: '$/m²' },
            { key: 'merma_proceso_pct', label: 'Merma de Proceso', unit: '%' },
            { key: 'merma_aprovechamiento_pct', label: 'Merma de Aprovechamiento', unit: '%' }
        ];

        const renderField = (key, label, unit) => `
            <div class="costeo-config-row">
                <label>${label}</label>
                <div class="costeo-config-input-wrap">
                    <input type="number" id="cfg_${key}" class="costeo-input costeo-input-yellow" value="${cfg(key)}" min="0" step="0.01">
                    <span class="costeo-config-unit">${unit}</span>
                </div>
            </div>`;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'costeoConfigModal';
        modal.innerHTML = `
            <div class="modal" style="max-width:500px">
                <div class="modal-header">
                    <h3 style="margin:0;font-size:16px;font-weight:700;color:#0f172a">Configuración de Costos Operativos</h3>
                    <button class="btn btn-sm btn-ghost" onclick="App.modules.costeo.closeConfig()" style="font-size:18px;padding:4px 8px">&times;</button>
                </div>
                <div class="modal-body">
                    <p style="font-size:12px;color:#64748b;margin:0 0 16px">Configure los valores por unidad. Estos se usarán en cada cálculo de costeo.</p>

                    <div class="costeo-config-section">
                        <div class="costeo-config-section-title">HH y Energía por Proceso</div>
                        <div class="costeo-config-grid">
                            ${procesos.map(p => `
                                <div class="costeo-config-group">
                                    <div class="costeo-config-group-title">${p.label}</div>
                                    ${renderField('hh_' + p.key, 'HH (Labor)', '$/m²')}
                                    ${renderField('energia_' + p.key, 'Energía', '$/m²')}
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="costeo-config-section" style="margin-top:16px">
                        <div class="costeo-config-section-title">Costos Generales</div>
                        <div class="costeo-config-grid">
                            ${otrosParams.map(p => renderField(p.key, p.label, p.unit)).join('')}
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <div style="display:flex;gap:6px">
                        <button class="btn btn-outline btn-sm" onclick="App.modules.costeo.exportConfig()" title="Descargar configuración">Exportar</button>
                        <label class="btn btn-outline btn-sm" title="Subir configuración" style="cursor:pointer;margin:0">
                            Importar
                            <input type="file" accept=".json" style="display:none" onchange="App.modules.costeo.importConfig(event)">
                        </label>
                    </div>
                    <div style="display:flex;gap:6px">
                        <button class="btn btn-outline btn-sm" onclick="App.modules.costeo.closeConfig()">Cancelar</button>
                        <button class="btn btn-primary btn-sm" onclick="App.modules.costeo.saveConfig()">Guardar Configuración</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modal);
        requestAnimationFrame(() => modal.classList.add('show'));
    },

    closeConfig() {
        const modal = document.getElementById('costeoConfigModal');
        if (modal) modal.remove();
    },

    async saveConfig() {
        const params = [
            'hh_crudo_sin_pulir', 'energia_crudo_sin_pulir',
            'hh_crudo_pulido', 'energia_crudo_pulido',
            'hh_templado_plano', 'energia_templado_plano',
            'hh_templado_curvo', 'energia_templado_curvo',
            'costo_pulido_ml', 'costo_perforacion',
            'costo_destaje_kg', 'costo_destaje_complejo_kg',
            'costo_pintura_ml', 'costo_insumos_pintura', 'costo_otros_m2',
            'merma_proceso_pct', 'merma_aprovechamiento_pct'
        ];

        try {
            for (const clave of params) {
                const input = document.getElementById('cfg_' + clave);
                const valor = parseFloat(input?.value) || 0;
                await fetch('/api/costeo/config', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ clave, valor })
                });
            }
            App.showAlert('Configuración guardada correctamente', 'success');
            this.closeConfig();
        } catch (e) {
            console.error('Error saving config:', e);
            App.showAlert('Error al guardar configuración', 'danger');
        }
    },

    async exportConfig() {
        try {
            const res = await fetch('/api/costeo/config/export');
            const config = await res.json();
            const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'costos_config_' + new Date().toISOString().slice(0, 10) + '.json';
            a.click();
            URL.revokeObjectURL(url);
            App.showAlert('Configuración descargada correctamente', 'success');
        } catch (e) {
            console.error('Error exporting config:', e);
            App.showAlert('Error al exportar configuración', 'danger');
        }
    },

    async importConfig(event) {
        const file = event.target.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            const config = JSON.parse(text);
            const res = await fetch('/api/costeo/config/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            const data = await res.json();
            if (data.error) return App.showAlert(data.error, 'danger');
            App.showAlert(data.mensaje, 'success');
            this.closeConfig();
        } catch (e) {
            console.error('Error importing config:', e);
            App.showAlert('Error al importar: archivo inválido', 'danger');
        }
        event.target.value = '';
    }
});
