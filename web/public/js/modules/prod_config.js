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
        const tabs = [
            { id: 'estaciones', label: 'Estaciones', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>' },
            { id: 'codigos', label: 'Códigos Arquitectónicos', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>' },
            { id: 'carroceria', label: 'Códigos Carroceros', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 20h20"/><path d="M5 20V8l5 4V8l5 4V4h3v16"/></svg>' },
            { id: 'maquinas', label: 'Maquinas', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' },
            { id: 'recetas', label: 'Recetas BOM', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>' },
            { id: 'familias', label: 'Familias', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' },
            { id: 'materias', label: 'Materias Primas', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>' },
            { id: 'reglas', label: 'Reglas Extras', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>' },
            { id: 'calendario', label: 'Calendario', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' }
        ];
        el.innerHTML = '<style>'
            + '@keyframes pcFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}'
            + '.pc-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}'
            + '.pc-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important}'
            + '.pc-tab{transition:all 0.15s}'
            + '</style>'

            + '<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:8px 16px;margin-bottom:20px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">'
            + '<div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="position:relative;z-index:1"><h2 style="margin:0;font-size:15px;font-weight:800;color:white;letter-spacing:-0.5px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-3px;margin-right:6px"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51l.06.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>Configuracion de Produccion</h2>'
            + '<p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Estaciones, Codigos, Maquinas, Recetas BOM, Familias, Materias Primas y Calendario</p></div></div>'

            + '<div style="display:flex;gap:6px;margin-bottom:20px;border-bottom:2px solid #e2e8f0;padding-bottom:0;flex-wrap:wrap">'
            + tabs.map(t => {
                const active = this._tab === t.id;
                return '<button class="pc-tab" onclick="App.modules.prod_config.switchTab(\'' + t.id + '\')" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;font-size:12px;font-weight:600;border:none;border-bottom:2px solid ' + (active ? '#3b82f6' : 'transparent') + ';margin-bottom:-2px;cursor:pointer;transition:all 0.15s;background:' + (active ? '#eff6ff' : 'transparent') + ';color:' + (active ? '#2563eb' : '#64748b') + ';border-radius:8px 8px 0 0" onmouseover="this.style.background=\'' + (active ? '#eff6ff' : '#f8fafc') + '\'" onmouseout="this.style.background=\'' + (active ? '#eff6ff' : 'transparent') + '\'">' + t.svg + ' ' + t.label + '</button>';
            }).join('')
            + '</div>'
            + '<div id="prodConfigContent"></div>';
        await this.loadTab();
    },

    switchTab(tab) {
        this._tab = tab;
        this.render();
    },

    async loadTab() {
        const container = document.getElementById('prodConfigContent');
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-light)">Cargando...</div>';
        // Tabs que delegan a modulos originales (Codigos, Maquinas, Recetas, Carroceria)
        if (this._tab === 'codigos' || this._tab === 'maquinas' || this._tab === 'recetas' || this._tab === 'carroceria') {
            await this.loadDelegated(this._tab);
            return;
        }
        switch(this._tab) {
            case 'estaciones': await this.loadEstaciones(); break;
            case 'familias': await this.loadFamilias(); break;
            case 'materias': await this.loadMaterias(); break;
            case 'reglas': await this.loadReglas(); break;
            case 'calendario': await this.loadCalendario(); break;
        }
    },

    async loadDelegated(tab) {
        const container = document.getElementById('prodConfigContent');
        container.innerHTML = '';
        const moduleMap = { codigos: 'prod_codigos', maquinas: 'prod_maquinas', recetas: 'prod_recetas', carroceria: 'prod_carroceria' };
        const moduleName = moduleMap[tab];
        const pageId = 'page-' + moduleName;
        // Crear page temporal para que el modulo original pueda renderizar
        let tempPage = document.getElementById(pageId);
        if (!tempPage) {
            tempPage = document.createElement('div');
            tempPage.id = pageId;
            tempPage.className = 'page active';
            container.appendChild(tempPage);
        }
        // Llamar render del modulo original
        if (App.modules[moduleName] && typeof App.modules[moduleName].render === 'function') {
            try { await App.modules[moduleName].render(); } catch(e) { console.error('Error render ' + moduleName, e); }
        } else {
            container.innerHTML = '<div style="background:#fee2e2;border-radius:8px;padding:12px;color:#991b1b">Modulo ' + moduleName + ' no encontrado</div>';
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
                    <button class="btn btn-sm btn-primary" onclick="App.modules.prod_config.showEstacionForm()"> Nueva Estacion</button>
                </div>
                <div class="card-body" style="padding:0">
                    <table><thead><tr><th>Orden</th><th>Nombre</th><th>Cap. Max m²/día</th><th>Cuello Botella</th><th>Estado</th><th>Acciones</th></tr></thead>
                    <tbody>${this._estaciones.map(e => `<tr>
                        <td><strong style="background:var(--primary);color:#fff;padding:4px 10px;border-radius:4px">${e.orden_secuencia_defecto}</strong></td>
                        <td>${escapeHtml(e.nombre_estacion)}</td>
                        <td><strong>${Number(e.capacidad_max_m2_dia || 100).toFixed(0)}</strong> m²</td>
                        <td>${e.es_cuello_botella ? '<span style="padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:#fee2e2;color:#991b1b">Cuello de Botella</span>' : '<span style="color:var(--text-light);font-size:11px">No</span>'}</td>
                        <td>${e.activa ? '<span class="status-badge status-realizada">Activa</span>' : '<span class="status-badge status-vencida">Inactiva</span>'}</td>
                        <td class="table-actions">
                            <button class="btn btn-sm btn-outline" title="Editar" onclick="App.modules.prod_config.showEstacionForm(${e.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                            <button class="btn btn-sm btn-danger" title="Eliminar" onclick="App.modules.prod_config.deleteEstacion(${e.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                        </td>
                    </tr>`).join('')}</tbody></table>
                </div>
            </div>`;
    },

    showEstacionForm(id) {
        const est = id ? this._estaciones.find(e => e.id === id) : null;
        App.showModal(`
            <div class="form-group"><label>Nombre de Estacion *</label><input class="form-control" id="estNombre" value="${est ? est.nombre_estacion : ''}" placeholder="Ej: Corte, Pulido, Templado..." onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
            <div class="form-group"><label>Orden de Secuencia *</label><input type="number" class="form-control" id="estOrden" value="${est ? est.orden_secuencia_defecto : (this._estaciones.length + 1)}" min="1" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
            <div class="form-group"><label>Capacidad Maxima (m²/dia) *</label><input type="number" class="form-control" id="estCapacidad" value="${est ? (est.capacidad_max_m2_dia || 100) : 100}" min="1" step="0.01" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
            <div class="form-group"><label><input type="checkbox" id="estCuelloBotella" ${est && est.es_cuello_botella ? 'checked' : ''}> Es Cuello de Botella (limita capacidad diaria en m²)</label></div>
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
            es_cuello_botella: document.getElementById('estCuelloBotella').checked,
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
                    <button class="btn btn-sm btn-primary" onclick="App.modules.prod_config.showFamiliaForm()"> Nueva Familia</button>
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
                                <button class="btn btn-sm btn-outline" title="Editar" onclick="App.modules.prod_config.showFamiliaForm(${f.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                                <button class="btn btn-sm btn-danger" title="Eliminar" onclick="App.modules.prod_config.deleteFamilia(${f.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
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
                <div class="form-group"><label>Codigo Familia *</label><input class="form-control" id="famCodigo" value="${fam ? fam.codigo_familia : ''}" placeholder="Ej: TEMPLADO" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
                <div class="form-group"><label>Nombre *</label><input class="form-control" id="famNombre" value="${fam ? fam.nombre_familia : ''}" placeholder="Ej: Templado" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Costo Hora Hombre ($/m2)</label><input type="number" class="form-control" id="famHH" value="${fam ? fam.costo_hh : 0}" min="0" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
                <div class="form-group"><label>Costo Energia ($/m2)</label><input type="number" class="form-control" id="famEnergia" value="${fam ? fam.costo_energia : 0}" min="0" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
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
                    <button class="btn btn-sm btn-primary" onclick="App.modules.prod_config.showMateriaForm()"> Nueva Materia Prima</button>
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
                            <button class="btn btn-sm btn-outline" title="Editar" onclick="App.modules.prod_config.showMateriaForm(${m.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                            <button class="btn btn-sm btn-danger" title="Eliminar" onclick="App.modules.prod_config.deleteMateria(${m.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                        </td>
                    </tr>`).join('')}</tbody></table>
                </div>
            </div>`;
    },

    showMateriaForm(id) {
        const m = id ? this._materias.find(x => x.id === id) : null;
        App.showModal(`
            <div class="form-row">
                <div class="form-group"><label>Codigo MP *</label><input class="form-control" id="mpCodigo" value="${m ? m.codigo_mp : ''}" placeholder="SKU interno" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
                <div class="form-group"><label>Nombre *</label><input class="form-control" id="mpNombre" value="${m ? m.nombre : ''}" placeholder="Ej: Vidrio 6mm" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Espesor (mm)</label><input type="number" class="form-control" id="mpEspesor" value="${m ? m.espesor_mm : 0}" min="0" step="0.5" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
                <div class="form-group"><label>Costo Unitario ($/m2)</label><input type="number" class="form-control" id="mpCosto" value="${m ? m.costo_unitario_mp : 0}" min="0" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
            </div>
            <div class="form-group"><label>Observacion</label><textarea class="form-control" id="mpObs" rows="2" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">${m ? m.observacion || '' : ''}</textarea></div>
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
                    <button class="btn btn-sm btn-primary" onclick="App.modules.prod_config.showReglaForm()"> Nueva Regla</button>
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
                            <button class="btn btn-sm btn-outline" title="Editar" onclick="App.modules.prod_config.showReglaForm(${r.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                            <button class="btn btn-sm btn-danger" title="Eliminar" onclick="App.modules.prod_config.deleteRegla(${r.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                        </td>
                    </tr>`).join('')}</tbody></table>
                </div>
            </div>`;
    },

    showReglaForm(id) {
        const r = id ? this._reglas.find(x => x.id === id) : null;
        App.showModal(`
            <div class="form-group"><label>Nombre Flag Excel *</label><input class="form-control" id="regFlag" value="${r ? r.nombre_flag : ''}" placeholder="Ej: radio, pulido, mecanizado..." onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"><small style="color:var(--text-light)">Nombre exacto de la columna en el Excel (sin espacios, minusculas)</small></div>
            <div class="form-group"><label>Estacion a Asignar *</label>
                <select class="form-control" id="regEstacion" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
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
        const entry = this._calendario.find(c => c.fecha && c.fecha.substring(0, 10) === fecha);
        const actualEsLaboral = entry ? entry.es_laboral : true;
        try {
            const res = await fetch('/api/produccion/calendario', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fecha: fecha, es_laboral: !actualEsLaboral, motivo: '' })
            });
            if (!res.ok) { const err = await res.json(); App.showAlert('Error: ' + (err.error || res.status), 'danger'); return; }
            await this.loadCalendario();
        } catch(e) { App.showAlert('Error de conexion: ' + e.message, 'danger'); }
    }
});
