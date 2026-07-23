App.registerModule('prod_config', {
    _tab: 'estaciones',
    _estaciones: [],
    _familias: [],
    _materias: [],
    _reglas: [],
    _calendario: [],
    _calMonth: new Date().getMonth(),
    _calYear: new Date().getFullYear(),

    async render() {
        const el = document.getElementById('page-prod_config');
        el.innerHTML = `
            <div class="page-header">
                <div><h2>Configuracion de Produccion</h2><div class="subtitle">Estaciones, Familias, Materias Primas, Reglas y Calendario</div></div>
            </div>
            <div style="display:flex;gap:4px;margin-bottom:16px;border-bottom:2px solid var(--border);padding-bottom:0">
                <button class="btn btn-sm ${this._tab==='estaciones'?'btn-primary':'btn-outline'}" onclick="App.modules.prod_config.switchTab('estaciones')">⚙️ Estaciones</button>
                <button class="btn btn-sm ${this._tab==='familias'?'btn-primary':'btn-outline'}" onclick="App.modules.prod_config.switchTab('familias')">📦 Familias</button>
                <button class="btn btn-sm ${this._tab==='materias'?'btn-primary':'btn-outline'}" onclick="App.modules.prod_config.switchTab('materias')">🪟 Materias Primas</button>
                <button class="btn btn-sm ${this._tab==='reglas'?'btn-primary':'btn-outline'}" onclick="App.modules.prod_config.switchTab('reglas')">🏷️ Reglas Extras</button>
                <button class="btn btn-sm ${this._tab==='calendario'?'btn-primary':'btn-outline'}" onclick="App.modules.prod_config.switchTab('calendario')">📅 Calendario</button>
            </div>
            <div id="prodConfigContent"></div>
        `;
        await this.loadTab();
    },

    switchTab(tab) {
        this._tab = tab;
        this.render();
    },

    async loadTab() {
        const container = document.getElementById('prodConfigContent');
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-light)">Cargando...</div>';
        switch(this._tab) {
            case 'estaciones': await this.loadEstaciones(); break;
            case 'familias': await this.loadFamilias(); break;
            case 'materias': await this.loadMaterias(); break;
            case 'reglas': await this.loadReglas(); break;
            case 'calendario': await this.loadCalendario(); break;
        }
    },

    // ═══════════════════════════════════════════
    // ESTACIONES MAESTRAS
    // ═══════════════════════════════════════════
    async loadEstaciones() {
        const res = await fetch('/api/produccion/estaciones');
        this._estaciones = await res.json();
        const container = document.getElementById('prodConfigContent');
        container.innerHTML = `
            <div class="card">
                <div class="card-header" style="justify-content:space-between">
                    <h3 style="margin:0">Estaciones Maestras (Secuencia de Planta)</h3>
                    <button class="btn btn-sm btn-primary" onclick="App.modules.prod_config.showEstacionForm()">+ Nueva Estacion</button>
                </div>
                <div class="card-body" style="padding:0">
                    <table><thead><tr><th>Orden</th><th>Nombre</th><th>Cap. Max m²/día</th><th>Estado</th><th>Acciones</th></tr></thead>
                    <tbody>${this._estaciones.map(e => `<tr>
                        <td><strong style="background:var(--primary);color:#fff;padding:4px 10px;border-radius:4px">${e.orden_secuencia_defecto}</strong></td>
                        <td>${escapeHtml(e.nombre_estacion)}</td>
                        <td><strong>${Number(e.capacidad_max_m2_dia || 100).toFixed(0)}</strong> m²</td>
                        <td>${e.activa ? '<span class="status-badge status-realizada">Activa</span>' : '<span class="status-badge status-vencida">Inactiva</span>'}</td>
                        <td class="table-actions">
                            <button class="btn btn-sm btn-outline" onclick="App.modules.prod_config.showEstacionForm(${e.id})">✏️</button>
                            <button class="btn btn-sm btn-danger" onclick="App.modules.prod_config.deleteEstacion(${e.id})">🗑️</button>
                        </td>
                    </tr>`).join('')}</tbody></table>
                </div>
            </div>`;
    },

    showEstacionForm(id) {
        const est = id ? this._estaciones.find(e => e.id === id) : null;
        App.showModal(`
            <div class="form-group"><label>Nombre de Estacion *</label><input class="form-control" id="estNombre" value="${est ? est.nombre_estacion : ''}" placeholder="Ej: Corte, Pulido, Templado..."></div>
            <div class="form-group"><label>Orden de Secuencia *</label><input type="number" class="form-control" id="estOrden" value="${est ? est.orden_secuencia_defecto : (this._estaciones.length + 1)}" min="1"></div>
            <div class="form-group"><label>Capacidad Maxima (m²/dia) *</label><input type="number" class="form-control" id="estCapacidad" value="${est ? (est.capacidad_max_m2_dia || 100) : 100}" min="1" step="0.01"></div>
            <div class="form-group"><label><input type="checkbox" id="estActiva" ${!est || est.activa ? 'checked' : ''}> Activa</label></div>
        `, { title: est ? 'Editar Estacion' : 'Nueva Estacion' });
        document.querySelector('#modalOverlay .modal-footer').innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.prod_config.saveEstacion(${id || 0})">${est ? 'Actualizar' : 'Guardar'}</button>`;
    },

    async saveEstacion(id) {
        const data = {
            nombre_estacion: document.getElementById('estNombre').value.trim(),
            orden_secuencia_defecto: parseInt(document.getElementById('estOrden').value),
            capacidad_max_m2_dia: parseFloat(document.getElementById('estCapacidad').value) || 100,
            activa: document.getElementById('estActiva').checked
        };
        if (!data.nombre_estacion || !data.orden_secuencia_defecto) { App.showAlert('Nombre y orden requeridos', 'danger'); return; }
        if (id === 0) await fetch('/api/produccion/estaciones', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) });
        else await fetch(`/api/produccion/estaciones/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) });
        App.hideModal();
        App.showAlert(id === 0 ? 'Estacion creada' : 'Estacion actualizada');
        this.loadEstaciones();
    },

    async deleteEstacion(id) {
        if (!await App.confirm('¿Eliminar esta estacion?')) return;
        await fetch(`/api/produccion/estaciones/${id}`, { method:'DELETE' });
        App.showAlert('Estacion eliminada');
        this.loadEstaciones();
    },

    // ═══════════════════════════════════════════
    // FAMILIAS DE PRODUCTO
    // ═══════════════════════════════════════════
    async loadFamilias() {
        const [famRes, estRes] = await Promise.all([
            fetch('/api/produccion/familias'),
            fetch('/api/produccion/estaciones')
        ]);
        this._familias = await famRes.json();
        this._estaciones = await estRes.json();
        const container = document.getElementById('prodConfigContent');
        container.innerHTML = `
            <div class="card">
                <div class="card-header" style="justify-content:space-between">
                    <h3 style="margin:0">Familias de Producto</h3>
                    <button class="btn btn-sm btn-primary" onclick="App.modules.prod_config.showFamiliaForm()">+ Nueva Familia</button>
                </div>
                <div class="card-body" style="padding:0">
                    <table><thead><tr><th>Codigo</th><th>Nombre</th><th>Costo HH</th><th>Costo Energia</th><th>Estaciones Base</th><th>Acciones</th></tr></thead>
                    <tbody>${this._familias.map(f => {
                        const estNames = (f.estaciones_base || []).map(e => `<span class="status-badge status-programada" style="margin:1px;font-size:10px">${e.nombre_estacion}</span>`).join(' ');
                        return `<tr>
                            <td><strong>${escapeHtml(f.codigo_familia)}</strong></td>
                            <td>${escapeHtml(f.nombre_familia)}</td>
                            <td>$${Number(f.costo_hh).toLocaleString('es-CL')}</td>
                            <td>$${Number(f.costo_energia).toLocaleString('es-CL')}</td>
                            <td>${estNames || '<span class="text-muted">Sin asignar</span>'}</td>
                            <td class="table-actions">
                                <button class="btn btn-sm btn-outline" onclick="App.modules.prod_config.showFamiliaForm(${f.id})">✏️</button>
                                <button class="btn btn-sm btn-danger" onclick="App.modules.prod_config.deleteFamilia(${f.id})">🗑️</button>
                            </td>
                        </tr>`;
                    }).join('')}</tbody></table>
                </div>
            </div>`;
    },

    showFamiliaForm(id) {
        const fam = id ? this._familias.find(f => f.id === id) : null;
        const estIds = fam ? (familia => (familia.estaciones_base || []).map(e => e.estacion_id))(fam) : [];
        App.showModal(`
            <div class="form-row">
                <div class="form-group"><label>Codigo Familia *</label><input class="form-control" id="famCodigo" value="${fam ? fam.codigo_familia : ''}" placeholder="Ej: TEMPLADO"></div>
                <div class="form-group"><label>Nombre *</label><input class="form-control" id="famNombre" value="${fam ? fam.nombre_familia : ''}" placeholder="Ej: Templado"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Costo Hora Hombre ($/m2)</label><input type="number" class="form-control" id="famHH" value="${fam ? fam.costo_hh : 0}" min="0"></div>
                <div class="form-group"><label>Costo Energia ($/m2)</label><input type="number" class="form-control" id="famEnergia" value="${fam ? fam.costo_energia : 0}" min="0"></div>
            </div>
            <div class="form-group"><label>Estaciones Base del Proceso</label>
                <div style="border:1px solid var(--border);border-radius:8px;padding:8px;display:flex;flex-wrap:wrap;gap:4px 12px">
                    ${this._estaciones.filter(e => e.activa).map(e => `<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
                        <input type="checkbox" class="fam-est-check" value="${e.id}" ${estIds.includes(e.id) ? 'checked' : ''}> ${e.orden_secuencia_defecto}. ${e.nombre_estacion}
                    </label>`).join('')}
                </div>
            </div>
        `, { title: fam ? 'Editar Familia' : 'Nueva Familia', lg: true });
        document.querySelector('#modalOverlay .modal-footer').innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.prod_config.saveFamilia(${id || 0})">${fam ? 'Actualizar' : 'Guardar'}</button>`;
    },

    async saveFamilia(id) {
        const data = {
            codigo_familia: document.getElementById('famCodigo').value.trim(),
            nombre_familia: document.getElementById('famNombre').value.trim(),
            costo_hh: parseFloat(document.getElementById('famHH').value) || 0,
            costo_energia: parseFloat(document.getElementById('famEnergia').value) || 0,
            estacion_ids: Array.from(document.querySelectorAll('.fam-est-check:checked')).map(c => parseInt(c.value))
        };
        if (!data.codigo_familia || !data.nombre_familia) { App.showAlert('Codigo y nombre requeridos', 'danger'); return; }
        if (id === 0) await fetch('/api/produccion/familias', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) });
        else await fetch(`/api/produccion/familias/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) });
        App.hideModal();
        App.showAlert(id === 0 ? 'Familia creada' : 'Familia actualizada');
        this.loadFamilias();
    },

    async deleteFamilia(id) {
        if (!await App.confirm('¿Eliminar esta familia?')) return;
        await fetch(`/api/produccion/familias/${id}`, { method:'DELETE' });
        App.showAlert('Familia eliminada');
        this.loadFamilias();
    },

    // ═══════════════════════════════════════════
    // MATERIAS PRIMAS
    // ═══════════════════════════════════════════
    async loadMaterias() {
        const res = await fetch('/api/produccion/materias-primas');
        this._materias = await res.json();
        const container = document.getElementById('prodConfigContent');
        container.innerHTML = `
            <div class="card">
                <div class="card-header" style="justify-content:space-between">
                    <h3 style="margin:0">Materias Primas (Vidrios)</h3>
                    <button class="btn btn-sm btn-primary" onclick="App.modules.prod_config.showMateriaForm()">+ Nueva Materia Prima</button>
                </div>
                <div class="card-body" style="padding:0">
                    <table><thead><tr><th>Codigo</th><th>Nombre</th><th>Espesor (mm)</th><th>Costo $/m2</th><th>Observacion</th><th>Acciones</th></tr></thead>
                    <tbody>${this._materias.map(m => `<tr>
                        <td><strong>${escapeHtml(m.codigo_mp)}</strong></td>
                        <td>${escapeHtml(m.nombre)}</td>
                        <td>${m.espesor_mm} mm</td>
                        <td>$${Number(m.costo_unitario_mp).toLocaleString('es-CL')}</td>
                        <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(m.observacion || '-')}</td>
                        <td class="table-actions">
                            <button class="btn btn-sm btn-outline" onclick="App.modules.prod_config.showMateriaForm(${m.id})">✏️</button>
                            <button class="btn btn-sm btn-danger" onclick="App.modules.prod_config.deleteMateria(${m.id})">🗑️</button>
                        </td>
                    </tr>`).join('')}</tbody></table>
                </div>
            </div>`;
    },

    showMateriaForm(id) {
        const m = id ? this._materias.find(x => x.id === id) : null;
        App.showModal(`
            <div class="form-row">
                <div class="form-group"><label>Codigo MP *</label><input class="form-control" id="mpCodigo" value="${m ? m.codigo_mp : ''}" placeholder="SKU interno"></div>
                <div class="form-group"><label>Nombre *</label><input class="form-control" id="mpNombre" value="${m ? m.nombre : ''}" placeholder="Ej: Vidrio 6mm"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Espesor (mm)</label><input type="number" class="form-control" id="mpEspesor" value="${m ? m.espesor_mm : 0}" min="0" step="0.5"></div>
                <div class="form-group"><label>Costo Unitario ($/m2)</label><input type="number" class="form-control" id="mpCosto" value="${m ? m.costo_unitario_mp : 0}" min="0"></div>
            </div>
            <div class="form-group"><label>Observacion</label><textarea class="form-control" id="mpObs" rows="2">${m ? m.observacion || '' : ''}</textarea></div>
        `, { title: m ? 'Editar Materia Prima' : 'Nueva Materia Prima' });
        document.querySelector('#modalOverlay .modal-footer').innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.prod_config.saveMateria(${id || 0})">${m ? 'Actualizar' : 'Guardar'}</button>`;
    },

    async saveMateria(id) {
        const data = {
            codigo_mp: document.getElementById('mpCodigo').value.trim(),
            nombre: document.getElementById('mpNombre').value.trim(),
            espesor_mm: parseFloat(document.getElementById('mpEspesor').value) || 0,
            costo_unitario_mp: parseFloat(document.getElementById('mpCosto').value) || 0,
            observacion: document.getElementById('mpObs').value.trim()
        };
        if (!data.codigo_mp || !data.nombre) { App.showAlert('Codigo y nombre requeridos', 'danger'); return; }
        if (id === 0) await fetch('/api/produccion/materias-primas', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) });
        else await fetch(`/api/produccion/materias-primas/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) });
        App.hideModal();
        App.showAlert(id === 0 ? 'Materia prima creada' : 'Materia prima actualizada');
        this.loadMaterias();
    },

    async deleteMateria(id) {
        if (!await App.confirm('¿Eliminar esta materia prima?')) return;
        await fetch(`/api/produccion/materias-primas/${id}`, { method:'DELETE' });
        App.showAlert('Materia prima eliminada');
        this.loadMaterias();
    },

    // ═══════════════════════════════════════════
    // REGLAS PROCESOS EXTRAS
    // ═══════════════════════════════════════════
    async loadReglas() {
        const [regRes, estRes] = await Promise.all([
            fetch('/api/produccion/reglas-extras'),
            fetch('/api/produccion/estaciones')
        ]);
        this._reglas = await regRes.json();
        this._estaciones = await estRes.json();
        const container = document.getElementById('prodConfigContent');
        container.innerHTML = `
            <div class="card">
                <div class="card-header" style="justify-content:space-between">
                    <h3 style="margin:0">Reglas de Procesos Extras (Banderas Excel)</h3>
                    <button class="btn btn-sm btn-primary" onclick="App.modules.prod_config.showReglaForm()">+ Nueva Regla</button>
                </div>
                <div class="card-body" style="padding:0">
                    <p style="padding:8px 16px;font-size:12px;color:var(--text-light);margin:0">Mapea las columnas del Excel de SAP con la estacion que se agrega cuando el valor es 1</p>
                    <table><thead><tr><th>Flag Excel</th><th>Estacion Asignada</th><th>Orden</th><th>Estado</th><th>Acciones</th></tr></thead>
                    <tbody>${this._reglas.map(r => `<tr>
                        <td><code style="background:#f1f5f9;padding:2px 8px;border-radius:4px">${escapeHtml(r.nombre_flag)}</code></td>
                        <td>${escapeHtml(r.nombre_estacion || '-')}</td>
                        <td>${r.orden_secuencia_defecto || '-'}</td>
                        <td>${r.activa ? '<span class="status-badge status-realizada">Activa</span>' : '<span class="status-badge status-vencida">Inactiva</span>'}</td>
                        <td class="table-actions">
                            <button class="btn btn-sm btn-outline" onclick="App.modules.prod_config.showReglaForm(${r.id})">✏️</button>
                            <button class="btn btn-sm btn-danger" onclick="App.modules.prod_config.deleteRegla(${r.id})">🗑️</button>
                        </td>
                    </tr>`).join('')}</tbody></table>
                </div>
            </div>`;
    },

    showReglaForm(id) {
        const r = id ? this._reglas.find(x => x.id === id) : null;
        App.showModal(`
            <div class="form-group"><label>Nombre Flag Excel *</label><input class="form-control" id="regFlag" value="${r ? r.nombre_flag : ''}" placeholder="Ej: radio, pulido, mecanizado..."><small style="color:var(--text-light)">Nombre exacto de la columna en el Excel (sin espacios, minusculas)</small></div>
            <div class="form-group"><label>Estacion a Asignar *</label>
                <select class="form-control" id="regEstacion">
                    <option value="">Seleccionar...</option>
                    ${this._estaciones.filter(e => e.activa).map(e => `<option value="${e.id}" ${r && r.estacion_id === e.id ? 'selected' : ''}>${e.orden_secuencia_defecto}. ${e.nombre_estacion}</option>`).join('')}
                </select>
            </div>
            <div class="form-group"><label><input type="checkbox" id="regActiva" ${!r || r.activa ? 'checked' : ''}> Activa</label></div>
        `, { title: r ? 'Editar Regla' : 'Nueva Regla' });
        document.querySelector('#modalOverlay .modal-footer').innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.prod_config.saveRegla(${id || 0})">${r ? 'Actualizar' : 'Guardar'}</button>`;
    },

    async saveRegla(id) {
        const data = {
            nombre_flag: document.getElementById('regFlag').value.trim().toLowerCase(),
            estacion_id: parseInt(document.getElementById('regEstacion').value),
            activa: document.getElementById('regActiva').checked
        };
        if (!data.nombre_flag || !data.estacion_id) { App.showAlert('Flag y estacion requeridos', 'danger'); return; }
        if (id === 0) await fetch('/api/produccion/reglas-extras', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) });
        else await fetch(`/api/produccion/reglas-extras/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) });
        App.hideModal();
        App.showAlert(id === 0 ? 'Regla creada' : 'Regla actualizada');
        this.loadReglas();
    },

    async deleteRegla(id) {
        if (!await App.confirm('¿Eliminar esta regla?')) return;
        await fetch(`/api/produccion/reglas-extras/${id}`, { method:'DELETE' });
        App.showAlert('Regla eliminada');
        this.loadReglas();
    },

    // ═══════════════════════════════════════════
    // CALENDARIO DE PRODUCCION
    // ═══════════════════════════════════════════

    async loadCalendario() {
        const res = await fetch('/api/produccion/calendario');
        this._calendario = await res.json();
        this.renderCalendario();
    },

    renderCalendario() {
        const container = document.getElementById('prodConfigContent');
        const year = this._calYear;
        const month = this._calMonth;
        const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const noLabSet = new Set();
        for (const c of this._calendario) {
            if (!c.es_laboral) noLabSet.add(c.fecha.substring(0, 10));
        }
        const startOffset = firstDay === 0 ? 6 : firstDay - 1;
        let html = `
            <div class="card">
                <div class="card-header" style="justify-content:space-between">
                    <h3 style="margin:0">Calendario de Produccion</h3>
                    <div style="display:flex;gap:8px;align-items:center">
                        <button class="btn btn-sm btn-outline" onclick="App.modules.prod_config.calCambiar(-1)">◀</button>
                        <strong>${monthNames[month]} ${year}</strong>
                        <button class="btn btn-sm btn-outline" onclick="App.modules.prod_config.calCambiar(1)">▶</button>
                    </div>
                </div>
                <div class="card-body">
                    <div style="display:flex;gap:16px;margin-bottom:12px;font-size:12px;color:var(--text-light)">
                        <span><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#dcfce7;vertical-align:middle"></span> Laboral</span>
                        <span><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#fee2e2;vertical-align:middle"></span> No Laboral</span>
                        <span style="margin-left:auto"><strong id="calBloqueados">0</strong> días bloqueados este mes</span>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center">
                        <div style="font-weight:600;font-size:11px;padding:6px;color:var(--text-light)">Lun</div>
                        <div style="font-weight:600;font-size:11px;padding:6px;color:var(--text-light)">Mar</div>
                        <div style="font-weight:600;font-size:11px;padding:6px;color:var(--text-light)">Mie</div>
                        <div style="font-weight:600;font-size:11px;padding:6px;color:var(--text-light)">Jue</div>
                        <div style="font-weight:600;font-size:11px;padding:6px;color:var(--text-light)">Vie</div>
                        <div style="font-weight:600;font-size:11px;padding:6px;color:var(--text-light)">Sab</div>
                        <div style="font-weight:600;font-size:11px;padding:6px;color:var(--text-light)">Dom</div>`;
        for (let i = 0; i < startOffset; i++) html += '<div></div>';
        for (let d = 1; d <= daysInMonth; d++) {
            const fs = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
            const esNoLaboral = noLabSet.has(fs);
            const calEntry = this._calendario.find(c => c.fecha && c.fecha.substring(0, 10) === fs);
            const motivo = calEntry ? calEntry.motivo : '';
            const bgColor = esNoLaboral ? '#fee2e2' : '#dcfce7';
            const borderColor = esNoLaboral ? '#ef4444' : '#22c55e';
            const textColor = esNoLaboral ? '#991b1b' : '#166534';
            const title = esNoLaboral ? (motivo || 'No laboral') : 'Laboral';
            html += `<div onclick="App.modules.prod_config.toggleDia('${fs}')" title="${title}" style="cursor:pointer;padding:8px 4px;border-radius:8px;border:1px solid ${borderColor};background:${bgColor};color:${textColor};font-weight:600;font-size:13px;transition:all .15s" onmouseover="this.style.transform='scale(1.08)'" onmouseout="this.style.transform='scale(1)'">${d}</div>`;
        }
        html += `</div></div></div>`;
        container.innerHTML = html;
        let countNoLab = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            const fs = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
            if (noLabSet.has(fs)) countNoLab++;
        }
        const el = document.getElementById('calBloqueados');
        if (el) el.textContent = countNoLab;
    },

    calCambiar(dir) {
        this._calMonth += dir;
        if (this._calMonth > 11) { this._calMonth = 0; this._calYear++; }
        if (this._calMonth < 0) { this._calMonth = 11; this._calYear--; }
        this.renderCalendario();
    },

    async toggleDia(fecha) {
        const entry = this._calendario.find(c => c.fecha === fecha);
        const actualEsLaboral = entry ? entry.es_laboral : true;
        await fetch('/api/produccion/calendario', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fecha, es_laboral: !actualEsLaboral, motivo: !actualEsLaboral ? '' : '' })
        });
        await this.loadCalendario();
    }
});
