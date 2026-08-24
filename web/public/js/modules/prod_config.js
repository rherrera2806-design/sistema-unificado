App.registerModule('prod_config', {
    _tab: 'estaciones',
    _estaciones: [],
    _familias: [],
    _grupos: [],
    _materias: [],
    _reglas: [],
    _calendario: [],
    _calMonth: new Date().getMonth(),
    _calYear: new Date().getFullYear(),

    _headers() {
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        return { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' };
    },

    async render() {
        const el = document.getElementById('page-prod_config');
        const tabs = [
            { id: 'codigos', label: 'Códigos', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>' },
            { id: 'recetas', label: 'Recetas BOM', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>' },
            { id: 'estaciones', label: 'Estaciones', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>' },
            { id: 'maquinas', label: 'Maquinas', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a2.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' },
            { id: 'grupos', label: 'Grupos', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
            { id: 'familias', label: 'Familias', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' },
            { id: 'reglas', label: 'Reglas Extras', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>' },
            { id: 'materias', label: 'Materias Primas', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>' },
            { id: 'calendario', label: 'Calendario', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' }
        ];
        el.innerHTML = '<style>'
            + '@keyframes pcFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}'
            + '.pc-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}'
            + '.pc-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important}'
            + '.pc-tab{transition:all 0.15s}'
            + '</style>'

            + '<div style="display:flex;gap:4px;margin-bottom:20px;border-bottom:2px solid var(--border);padding-bottom:0;flex-wrap:wrap">'
            + tabs.map(t => {
                const active = this._tab === t.id;
                return '<button class="btn ' + (active ? 'btn-primary' : 'btn-ghost') + '" style="border-bottom:2px solid ' + (active ? 'var(--glass)' : 'transparent') + ';margin-bottom:-2px;border-radius:var(--radius-md) var(--radius-md) 0 0;padding:6px 12px;font-size:12px" onclick="App.modules.prod_config.switchTab(\'' + t.id + '\')">' + t.svg + ' ' + t.label + '</button>';
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
        if (this._tab === 'codigos' || this._tab === 'maquinas' || this._tab === 'recetas') {
            await this.loadDelegated(this._tab);
            return;
        }
        switch(this._tab) {
            case 'estaciones': await this.loadEstaciones(); break;
            case 'grupos': await this.loadGrupos(); break;
            case 'familias': await this.loadFamilias(); break;
            case 'materias': await this.loadMaterias(); break;
            case 'reglas': await this.loadReglas(); break;
            case 'calendario': await this.loadCalendario(); break;
        }
    },

    async loadDelegated(tab) {
        const container = document.getElementById('prodConfigContent');
        container.innerHTML = '';
        const moduleMap = { codigos: 'prod_codigos', maquinas: 'prod_maquinas', recetas: 'prod_recetas' };
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
        const res = await fetch('/api/produccion/estaciones', { headers: this._headers() });
        this._estaciones = await res.json();
        const container = document.getElementById('prodConfigContent');
        container.innerHTML = `
            <div class="m-page">
                <div class="m-hero" style="padding:10px 14px">
                    <div style="position:relative;z-index:1">
                        <h2 style="margin:0;font-size:14px;font-weight:800;color:white">Estaciones Maestras</h2>
                        <p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Secuencia de planta y capacidad</p>
                    </div>
                </div>

                <div class="m-actions">
                    <button class="btn btn-accent" style="white-space:nowrap;padding:8px 14px;font-size:12px" onclick="App.modules.prod_config.showEstacionForm()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo</button>
                </div>

                <div class="m-card">
                    <div class="m-card-header">
                        <h3 style="margin:0;font-size:13px">Lista <span style="color:#64748b;font-weight:400">(${this._estaciones.length})</span></h3>
                    </div>
                    <div class="m-card-body" style="padding:0">
                        <div class="m-table-wrap">
                            <table><thead><tr>
                                <th>Orden</th><th>Nombre</th><th>Cap. Max</th><th>Cuello Botella</th><th>Estado</th><th>Acciones</th>
                            </tr></thead>
                            <tbody>${this._estaciones.map(e => {
                                return `<tr>
                                <td><strong style="background:var(--primary);color:#fff;padding:4px 10px;border-radius:4px">${e.orden_secuencia_defecto}</strong></td>
                                <td>${escapeHtml(e.nombre_estacion)}</td>
                                <td><strong>${Number(e.cap_max || 100).toFixed(0)}</strong> m²</td>
                                <td>${e.cuello_botella ? '<span style="padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:#fee2e2;color:#991b1b">Cuello de Botella</span>' : '<span style="color:var(--text-light);font-size:11px">No</span>'}</td>
                                <td>${e.activa ? '<span class="status-badge status-realizada">Activa</span>' : '<span class="status-badge status-vencida">Inactiva</span>'}</td>
                                <td class="table-actions">
                                    <button class="btn btn-sm btn-outline" title="Editar" onclick="App.modules.prod_config.showEstacionForm(${e.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                                    <button class="btn btn-sm btn-danger" title="Eliminar" onclick="App.modules.prod_config.deleteEstacion(${e.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                                </td>
                            </tr>`;
                            }).join('')}</tbody></table>
                        </div>
                        <div class="m-cards-mobile" id="estCardsMobile" style="display:none;padding:12px"></div>
                    </div>
                </div>
            </div>`;
        
        this._renderEstacionesCards();
    },

    _renderEstacionesCards() {
        const cardsMobile = document.getElementById('estCardsMobile');
        if (!cardsMobile) return;
        cardsMobile.innerHTML = this._estaciones.length ? this._estaciones.map(e => {
            const statusBadge = e.activa 
                ? '<span style="background:#dcfce7;color:#166534;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:600">Activa</span>'
                : '<span style="background:#f1f5f9;color:#64748b;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:600">Inactiva</span>';
            const cuelloBadge = e.cuello_botella 
                ? '<span style="background:#fee2e2;color:#991b1b;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:600">Cuello Botella</span>'
                : '';
            return `<div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:10px">
                <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                    <div style="display:flex;align-items:center;gap:8px">
                        <span style="background:var(--primary);color:#fff;padding:4px 10px;border-radius:4px;font-weight:700;font-size:12px">${e.orden_secuencia_defecto}</span>
                        <div>
                            <div style="font-weight:700;font-size:13px">${escapeHtml(e.nombre_estacion)}</div>
                            <div style="font-size:10px;color:#64748b">${Number(e.cap_max || 100).toFixed(0)} m²/dia</div>
                        </div>
                    </div>
                    <div style="display:flex;gap:4px">
                        <button class="btn btn-sm btn-outline" onclick="App.modules.prod_config.showEstacionForm(${e.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                        <button class="btn btn-sm btn-danger" onclick="App.modules.prod_config.deleteEstacion(${e.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                    </div>
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                    ${statusBadge}
                    ${cuelloBadge}
                </div>
            </div>`;
        }).join('') : '<div style="text-align:center;padding:24px;color:#64748b">No hay estaciones configuradas</div>';
    },

    showEstacionForm(id) {
        const est = id ? this._estaciones.find(e => e.id === id) : null;
        App.showModal(`
            <div class="m-card" style="margin-bottom:10px">
                <div class="m-card-header" style="padding:6px 12px;font-size:12px;font-weight:600">Datos de Estacion</div>
                <div class="m-card-body" style="padding:8px 12px">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 10px">
                        <div class="form-group" style="margin:0">
                            <label style="font-size:10px;margin-bottom:2px;display:block;font-weight:600;color:#64748b">Nombre de Estacion *</label>
                            <input class="form-control" id="estNombre" value="${est ? est.nombre_estacion : ''}" placeholder="Ej: Corte, Pulido" style="padding:10px 12px;font-size:13px;border:1px solid #e2e8f0;border-radius:8px">
                        </div>
                        <div class="form-group" style="margin:0">
                            <label style="font-size:10px;margin-bottom:2px;display:block;font-weight:600;color:#64748b">Orden de Secuencia *</label>
                            <input type="number" class="form-control" id="estOrden" value="${est ? est.orden_secuencia_defecto : (this._estaciones.length + 1)}" min="1" style="padding:10px 12px;font-size:13px;border:1px solid #e2e8f0;border-radius:8px">
                        </div>
                    </div>
                </div>
            </div>
            <div class="m-card" style="margin-bottom:10px">
                <div class="m-card-header" style="padding:6px 12px;font-size:12px;font-weight:600;background:#f0fdf4;border-bottom:1px solid #bbf7d0"><span style="color:#166534">Capacidad</span></div>
                <div class="m-card-body" style="padding:8px 12px">
                    <div class="form-group" style="margin:0">
                        <label style="font-size:10px;margin-bottom:2px;display:block;font-weight:600;color:#64748b">Capacidad Maxima (m²/dia) *</label>
                        <input type="number" class="form-control" id="estCapacidad" value="${est ? (est.cap_max || 100) : 100}" min="1" step="0.01" style="padding:10px 12px;font-size:13px;border:1px solid #e2e8f0;border-radius:8px">
                    </div>
                </div>
            </div>
            <div class="m-card">
                <div class="m-card-body" style="padding:8px 12px">
                    <div style="display:flex;flex-direction:column;gap:8px">
                        <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">
                            <input type="checkbox" id="estCuelloBotella" ${est && est.cuello_botella ? 'checked' : ''} style="width:16px;height:16px">
                            <span>Cuello de Botella (limita capacidad diaria)</span>
                        </label>
                        <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">
                            <input type="checkbox" id="estActiva" ${!est || est.activa ? 'checked' : ''} style="width:16px;height:16px">
                            <span>Activa</span>
                        </label>
                    </div>
                </div>
            </div>
        `, { title: est ? 'Editar Estacion' : 'Nueva Estacion' });
        document.querySelector('#modalOverlay .modal-footer').innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.prod_config.saveEstacion(${id || 0})">${est ? 'Actualizar' : 'Guardar'}</button>`;
    },

    async saveEstacion(id) {
        const data = {
            nombre_estacion: document.getElementById('estNombre').value.trim(),
            orden_secuencia_defecto: parseInt(document.getElementById('estOrden').value),
            cap_max: parseFloat(document.getElementById('estCapacidad').value) || 100,
            cuello_botella: document.getElementById('estCuelloBotella').checked,
            activa: document.getElementById('estActiva').checked
        };
        if (!data.nombre_estacion || !data.orden_secuencia_defecto) { App.showAlert('Nombre y orden requeridos', 'danger'); return; }
        if (id === 0) await fetch('/api/produccion/estaciones', { method:'POST', headers:this._headers(), body: JSON.stringify(data) });
        else await fetch(`/api/produccion/estaciones/${id}`, { method:'PUT', headers:this._headers(), body: JSON.stringify(data) });
        App.hideModal();
        App.showAlert(id === 0 ? 'Estacion creada' : 'Estacion actualizada');
        this.loadEstaciones();
    },

    async deleteEstacion(id) {
        if (!await App.confirm('¿Eliminar esta estacion?')) return;
        await fetch(`/api/produccion/estaciones/${id}`, { method:'DELETE', headers:this._headers() });
        App.showAlert('Estacion eliminada');
        this.loadEstaciones();
    },

    // ═══════════════════════════════════════════
    // FAMILIAS DE PRODUCTO
    // ═══════════════════════════════════════════
    async loadFamilias() {
        const [famRes, estRes] = await Promise.all([
            fetch('/api/produccion/familias', { headers: this._headers() }),
            fetch('/api/produccion/estaciones', { headers: this._headers() })
        ]);
        this._familias = await famRes.json();
        this._estaciones = await estRes.json();
        const container = document.getElementById('prodConfigContent');
        container.innerHTML = `
            <div class="m-page">
                <div class="m-hero" style="padding:10px 14px">
                    <div style="position:relative;z-index:1">
                        <h2 style="margin:0;font-size:14px;font-weight:800;color:white">Familias de Producto</h2>
                        <p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Configuracion de costos y estaciones base</p>
                    </div>
                </div>

                <div class="m-actions">
                    <button class="btn btn-accent" style="white-space:nowrap;padding:8px 14px;font-size:12px" onclick="App.modules.prod_config.showFamiliaForm()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo</button>
                </div>

                <div class="m-card">
                    <div class="m-card-header">
                        <h3 style="margin:0;font-size:13px">Lista <span style="color:#64748b;font-weight:400">(${this._familias.length})</span></h3>
                    </div>
                    <div class="m-card-body" style="padding:0">
                        <div class="m-table-wrap">
                            <table><thead><tr>
                                <th>Codigo</th><th>Nombre</th><th>Costo HH</th><th>Costo Energia</th><th>Estaciones Base</th><th>Acciones</th>
                            </tr></thead>
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
                        <div class="m-cards-mobile" id="famCardsMobile" style="display:none;padding:12px"></div>
                    </div>
                </div>
            </div>`;
        
        this._renderFamiliasCards();
    },

    _renderFamiliasCards() {
        const cardsMobile = document.getElementById('famCardsMobile');
        if (!cardsMobile) return;
        cardsMobile.innerHTML = this._familias.length ? this._familias.map(f => {
            const estNames = (f.estaciones_base || []).map(e => e.nombre_estacion).join(', ');
            return `<div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:10px">
                <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                    <div>
                        <div style="font-weight:700;font-size:13px">${escapeHtml(f.codigo_familia)}</div>
                        <div style="font-size:11px;color:#64748b">${escapeHtml(f.nombre_familia)}</div>
                    </div>
                    <div style="display:flex;gap:4px">
                        <button class="btn btn-sm btn-outline" onclick="App.modules.prod_config.showFamiliaForm(${f.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                        <button class="btn btn-sm btn-danger" onclick="App.modules.prod_config.deleteFamilia(${f.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:10px;margin-bottom:6px">
                    <div style="background:#f0fdf4;padding:4px 6px;border-radius:4px">
                        <div style="color:#64748b">Costo HH</div>
                        <div style="font-weight:600;color:#166534">$${Number(f.costo_hh).toLocaleString('es-CL')}</div>
                    </div>
                    <div style="background:#eff6ff;padding:4px 6px;border-radius:4px">
                        <div style="color:#64748b">Costo Energia</div>
                        <div style="font-weight:600;color:#1e40af">$${Number(f.costo_energia).toLocaleString('es-CL')}</div>
                    </div>
                </div>
                <div style="font-size:10px;color:#64748b">
                    <span style="font-weight:600">Estaciones:</span> ${estNames || 'Sin asignar'}
                </div>
            </div>`;
        }).join('') : '<div style="text-align:center;padding:24px;color:#64748b">No hay familias configuradas</div>';
    },

    showFamiliaForm(id) {
        const fam = id ? this._familias.find(f => f.id === id) : null;
        const estIds = fam ? (familia => (familia.estaciones_base || []).map(e => e.estacion_id))(fam) : [];
        
        const style = document.createElement('style');
        style.textContent = `
            .fam-form-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6px 10px;align-items:end}
            .fam-form-grid>div{min-width:0;margin:0}
            .fam-form-grid input{width:100%;box-sizing:border-box}
            .fam-form-grid label{font-size:10px;margin-bottom:2px;display:block;font-weight:600;color:#64748b}
            .fam-form-grid input[type="text"],.fam-form-grid input[type="number"]{padding:10px 12px;font-size:13px;border:1px solid #e2e8f0;border-radius:8px}
            @media(max-width:768px){.fam-form-grid{grid-template-columns:1fr}}
        `;
        document.head.appendChild(style);
        
        App.showModal(`
            <div class="m-card" style="margin-bottom:10px">
                <div class="m-card-header" style="padding:6px 12px;font-size:12px;font-weight:600">Datos de Familia</div>
                <div class="m-card-body" style="padding:8px 12px">
                    <div class="fam-form-grid">
                        <div class="form-group"><label>Codigo Familia *</label><input class="form-control" id="famCodigo" value="${fam ? fam.codigo_familia : ''}" placeholder="Ej: TEMPLADO"></div>
                        <div class="form-group"><label>Nombre *</label><input class="form-control" id="famNombre" value="${fam ? fam.nombre_familia : ''}" placeholder="Ej: Templado"></div>
                    </div>
                </div>
            </div>
            <div class="m-card" style="margin-bottom:10px">
                <div class="m-card-header" style="padding:6px 12px;font-size:12px;font-weight:600;background:#f0fdf4;border-bottom:1px solid #bbf7d0"><span style="color:#166534">Costos</span></div>
                <div class="m-card-body" style="padding:8px 12px">
                    <div class="fam-form-grid">
                        <div class="form-group"><label>Costo Hora Hombre ($/m2)</label><input type="number" class="form-control" id="famHH" value="${fam ? fam.costo_hh : 0}" min="0"></div>
                        <div class="form-group"><label>Costo Energia ($/m2)</label><input type="number" class="form-control" id="famEnergia" value="${fam ? fam.costo_energia : 0}" min="0"></div>
                    </div>
                </div>
            </div>
            <div class="m-card">
                <div class="m-card-header" style="padding:6px 12px;font-size:12px;font-weight:600;background:#eff6ff;border-bottom:1px solid #bfdbfe"><span style="color:#1e40af">Estaciones Base del Proceso</span></div>
                <div class="m-card-body" style="padding:8px 12px">
                    <div style="display:flex;flex-wrap:wrap;gap:4px 12px">
                        ${this._estaciones.filter(e => e.activa).map(e => `<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
                            <input type="checkbox" class="fam-est-check" value="${e.id}" ${estIds.includes(e.id) ? 'checked' : ''}> ${e.orden_secuencia_defecto}. ${e.nombre_estacion}
                        </label>`).join('')}
                    </div>
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
        if (id === 0) await fetch('/api/produccion/familias', { method:'POST', headers:this._headers(), body: JSON.stringify(data) });
        else await fetch(`/api/produccion/familias/${id}`, { method:'PUT', headers:this._headers(), body: JSON.stringify(data) });
        App.hideModal();
        App.showAlert(id === 0 ? 'Familia creada' : 'Familia actualizada');
        this.loadFamilias();
    },

    async deleteFamilia(id) {
        if (!await App.confirm('¿Eliminar esta familia?')) return;
        await fetch(`/api/produccion/familias/${id}`, { method:'DELETE', headers:this._headers() });
        App.showAlert('Familia eliminada');
        this.loadFamilias();
    },

    // ═══════════════════════════════════════════
    // GRUPOS DE PRODUCCION
    // ═══════════════════════════════════════════
    async loadGrupos() {
        const res = await fetch('/api/produccion/capacidad-grupo/all', { headers: this._headers() });
        this._grupos = await res.json();
        const container = document.getElementById('prodConfigContent');
        container.innerHTML = `
            <div class="m-page">
                <div class="m-hero" style="padding:10px 14px">
                    <div style="position:relative;z-index:1">
                        <h2 style="margin:0;font-size:14px;font-weight:800;color:white">Grupos de Produccion</h2>
                        <p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Capacidad por grupo en kg/dia</p>
                    </div>
                </div>

                <div class="m-actions">
                    <button class="btn btn-accent" style="white-space:nowrap;padding:8px 14px;font-size:12px" onclick="App.modules.prod_config.showGrupoForm()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo</button>
                </div>

                <div class="m-card">
                    <div class="m-card-header">
                        <h3 style="margin:0;font-size:13px">Lista <span style="color:#64748b;font-weight:400">(${this._grupos.length})</span></h3>
                    </div>
                    <div class="m-card-body" style="padding:0">
                        <div class="m-table-wrap">
                            <table><thead><tr>
                                <th style="width:50px">Color</th><th>Grupo</th><th>Capacidad (kg/dia)</th><th>Estado</th><th>Acciones</th>
                            </tr></thead>
                            <tbody>${this._grupos.map(g => `<tr>
                                <td><span style="display:inline-block;width:24px;height:24px;border-radius:6px;background:${g.color || '#3b82f6'};border:2px solid rgba(0,0,0,0.1)"></span></td>
                                <td><strong>${escapeHtml(g.grupo)}</strong></td>
                                <td>${Number(g.capacidad_kg_dia).toLocaleString('es-CL')} kg</td>
                                <td>${g.activo ? '<span class="status-badge status-terminado">Activo</span>' : '<span class="status-badge status-mermado">Inactivo</span>'}</td>
                                <td class="table-actions">
                                    <button class="btn btn-sm btn-outline" title="Editar" onclick="App.modules.prod_config.showGrupoForm(${g.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                                    <button class="btn btn-sm btn-danger" title="Eliminar" onclick="App.modules.prod_config.deleteGrupo(${g.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                                </td>
                            </tr>`).join('')}</tbody>
                        </table>
                        </div>
                        <div class="m-cards-mobile" id="grpCardsMobile" style="display:none;padding:12px"></div>
                    </div>
                </div>
            </div>`;
        
        this._renderGruposCards();
    },

    _renderGruposCards() {
        const cardsMobile = document.getElementById('grpCardsMobile');
        if (!cardsMobile) return;
        cardsMobile.innerHTML = this._grupos.length ? this._grupos.map(g => {
            const statusBadge = g.activo 
                ? '<span style="background:#dcfce7;color:#166534;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:600">Activo</span>'
                : '<span style="background:#f1f5f9;color:#64748b;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:600">Inactivo</span>';
            return `<div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:10px">
                <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                    <div style="display:flex;align-items:center;gap:8px">
                        <span style="display:inline-block;width:24px;height:24px;border-radius:6px;background:${g.color || '#3b82f6'};border:2px solid rgba(0,0,0,0.1)"></span>
                        <div>
                            <div style="font-weight:700;font-size:13px">${escapeHtml(g.grupo)}</div>
                            <div style="font-size:10px;color:#64748b">${Number(g.capacidad_kg_dia).toLocaleString('es-CL')} kg/dia</div>
                        </div>
                    </div>
                    <div style="display:flex;gap:4px">
                        <button class="btn btn-sm btn-outline" onclick="App.modules.prod_config.showGrupoForm(${g.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                        <button class="btn btn-sm btn-danger" onclick="App.modules.prod_config.deleteGrupo(${g.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                    </div>
                </div>
                <div>${statusBadge}</div>
            </div>`;
        }).join('') : '<div style="text-align:center;padding:24px;color:#64748b">No hay grupos configurados</div>';
    },

    showGrupoForm(id) {
        const g = id ? this._grupos.find(x => x.id === id) : null;
        const colores = ['#22c55e','#06b6d4','#1e3a8a','#1e293b','#f97316','#fde047','#8b5cf6','#ef4444','#ec4899','#14b8a6'];
        
        App.showModal(`
            <div class="m-card" style="margin-bottom:10px">
                <div class="m-card-header" style="padding:6px 12px;font-size:12px;font-weight:600">Datos del Grupo</div>
                <div class="m-card-body" style="padding:8px 12px">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 10px">
                        <div class="form-group" style="margin:0">
                            <label style="font-size:10px;margin-bottom:2px;display:block;font-weight:600;color:#64748b">Nombre del Grupo *</label>
                            <input class="form-control" id="grupoNombre" value="${g ? escapeHtml(g.grupo) : ''}" placeholder="Ej: Arquitectura" style="padding:10px 12px;font-size:13px;border:1px solid #e2e8f0;border-radius:8px">
                        </div>
                        <div class="form-group" style="margin:0">
                            <label style="font-size:10px;margin-bottom:2px;display:block;font-weight:600;color:#64748b">Capacidad (kg/dia)</label>
                            <input type="number" class="form-control" id="grupoCapacidad" value="${g ? g.capacidad_kg_dia : 1500}" min="0" style="padding:10px 12px;font-size:13px;border:1px solid #e2e8f0;border-radius:8px">
                        </div>
                    </div>
                </div>
            </div>
            <div class="m-card" style="margin-bottom:10px">
                <div class="m-card-header" style="padding:6px 12px;font-size:12px;font-weight:600;background:#f0f9ff;border-bottom:1px solid #bae6fd"><span style="color:#0369a1">Color</span></div>
                <div class="m-card-body" style="padding:8px 12px">
                    <div style="display:flex;gap:8px;flex-wrap:wrap" id="grupoColorPicker">
                        ${colores.map(c => `<div onclick="document.getElementById('grupoColor').value='${c}';document.querySelectorAll('#grupoColorPicker div').forEach(d=>d.style.outline='none');this.style.outline='3px solid #3b82f6'" style="width:32px;height:32px;border-radius:8px;background:${c};cursor:pointer;border:2px solid rgba(0,0,0,0.1);${g && g.color === c ? 'outline:3px solid #3b82f6' : ''}"></div>`).join('')}
                    </div>
                    <input type="hidden" id="grupoColor" value="${g ? (g.color || '#3b82f6') : '#3b82f6'}">
                </div>
            </div>
            <div class="m-card">
                <div class="m-card-body" style="padding:8px 12px">
                    <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">
                        <input type="checkbox" id="grupoActivo" ${!g || g.activo ? 'checked' : ''} style="width:16px;height:16px">
                        <span>Activo</span>
                    </label>
                </div>
            </div>
        `, { title: g ? 'Editar Grupo' : 'Nuevo Grupo' });
        document.querySelector('#modalOverlay .modal-footer').innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.prod_config.saveGrupo(${id || 0})">${g ? 'Actualizar' : 'Guardar'}</button>`;
    },

    async saveGrupo(id) {
        const data = {
            grupo: document.getElementById('grupoNombre').value.trim(),
            capacidad_kg_dia: parseFloat(document.getElementById('grupoCapacidad').value) || 0,
            color: document.getElementById('grupoColor').value,
            activo: document.getElementById('grupoActivo').checked
        };
        if (!data.grupo) { App.showAlert('Nombre requerido', 'danger'); return; }
        if (id === 0)
            await fetch('/api/produccion/capacidad-grupo', { method:'POST', headers:this._headers(), body: JSON.stringify(data) });
        else
            await fetch(`/api/produccion/capacidad-grupo/${id}`, { method:'PUT', headers:this._headers(), body: JSON.stringify(data) });
        App.hideModal();
        App.showAlert(id === 0 ? 'Grupo creado' : 'Grupo actualizado');
        this.loadGrupos();
    },

    async deleteGrupo(id) {
        if (!await App.confirm('¿Eliminar este grupo?')) return;
        await fetch(`/api/produccion/capacidad-grupo/${id}`, { method:'DELETE', headers:this._headers() });
        App.showAlert('Grupo eliminado');
        this.loadGrupos();
    },

    // ═══════════════════════════════════════════
    // MATERIAS PRIMAS
    // ═══════════════════════════════════════════
    async loadMaterias() {
        const res = await fetch('/api/produccion/materias-primas', { headers: this._headers() });
        this._materias = await res.json();
        const search = document.getElementById('mpSearch')?.value || '';
        if (document.getElementById('mpTableBody')) {
            this._filterMaterias();
        } else {
            this._renderMaterias();
            if (search) document.getElementById('mpSearch').value = search;
        }
    },

    _renderMaterias() {
        const prevSearch = document.getElementById('mpSearch')?.value || '';
        const container = document.getElementById('prodConfigContent');
        container.innerHTML = `
            <div class="m-page">
                <div class="m-hero" style="padding:10px 14px">
                    <div style="position:relative;z-index:1">
                        <h2 style="margin:0;font-size:14px;font-weight:800;color:white">Materias Primas (Vidrios)</h2>
                        <p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Gestion de costos y datos de vidrios</p>
                    </div>
                </div>

                <div class="m-actions">
                    <div class="m-filters">
                        <div style="position:relative"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" style="position:absolute;left:10px;top:50%;transform:translateY(-50%)"><circle cx="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" class="form-control" id="mpSearch" placeholder="Buscar codigo, nombre..." oninput="App.modules.prod_config._filterMaterias()" style="width:200px;padding:6px 8px 6px 32px;font-size:12px"></div>
                    </div>
                    <button class="btn btn-sm btn-outline" onclick="App.modules.prod_config.showImportModal()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Importar</button>
                    <button class="btn btn-sm btn-outline" onclick="App.modules.prod_config.exportarExcel()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Exportar</button>
                    <button class="btn btn-accent" style="white-space:nowrap;padding:8px 14px;font-size:12px" onclick="App.modules.prod_config.showMateriaForm()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo</button>
                </div>

                <div class="m-card">
                    <div class="m-card-header">
                        <h3 style="margin:0;font-size:13px">Lista <span style="color:#64748b;font-weight:400">(<span id="mpCount">0</span>)</span></h3>
                    </div>
                    <div class="m-card-body" style="padding:0;overflow:scroll;max-height:825px">
                        <div class="m-table-wrap">
                            <table style="font-size:12px"><thead style="position:sticky;top:0;z-index:1"><tr>
                                <th>Codigo</th><th>Nombre</th><th>Esp.</th>
                                <th style="background:#f0fdf4">Costo Nac</th>
                                <th style="background:#eff6ff">Costo Imp</th>
                                <th style="background:#fefce8">Diff $/m2</th>
                                <th style="background:#fef3c7">CPM</th>
                                <th style="background:#fce7f3">MPA %</th>
                                <th>Observ.</th><th>Acc.</th>
                            </tr></thead>
                            <tbody id="mpTableBody"></tbody></table>
                        </div>
                        <div class="m-cards-mobile" id="mpCardsMobile" style="display:none;padding:12px"></div>
                    </div>
                </div>
            </div>`;
        if (prevSearch) document.getElementById('mpSearch').value = prevSearch;
        this._filterMaterias();
    },

    _filterMaterias() {
        const s = (document.getElementById('mpSearch')?.value || '').toLowerCase();
        let items = s ? this._materias.filter(m =>
            (m.codigo_mp || '').toLowerCase().includes(s) ||
            (m.nombre || '').toLowerCase().includes(s) ||
            (m.observacion || '').toLowerCase().includes(s)
        ) : [...this._materias];
        items.sort((a, b) => {
            const cmp = (a.nombre || '').localeCompare(b.nombre || '');
            return cmp !== 0 ? cmp : (Number(a.espesor_mm) || 0) - (Number(b.espesor_mm) || 0);
        });
        
        const countEl = document.getElementById('mpCount');
        if (countEl) countEl.textContent = items.length;
        
        const tbody = document.getElementById('mpTableBody');
        const cardsMobile = document.getElementById('mpCardsMobile');
        
        if (tbody) {
            tbody.innerHTML = items.length ? items.map(m => {
                const cn = Number(m.costo_unitario_mp) || 0;
                const ci = Number(m.costo_unitario_importado) || 0;
                const cpm = Number(m.consumo_promedio_mensual) || 0;
                const mpa = Number(m.mpa) || 0;
                const diffM2 = (cn > 0 && ci > 0) ? ci - cn : 0;
                const fmt = (v) => '$' + Math.round(v).toLocaleString('es-CL');
                const col = (v) => v > 0 ? '#dc2626' : v < 0 ? '#16a34a' : '#64748b';
                let obs = '-';
                if (cn > 0 && ci > 0) {
                    if (diffM2 > 0) obs = '<span style="color:#166534;font-weight:600">Nac</span> ' + fmt(Math.abs(diffM2));
                    else if (diffM2 < 0) obs = '<span style="color:#166534;font-weight:600">Imp</span> ' + fmt(Math.abs(diffM2));
                }
                return `<tr>
                <td><strong>${escapeHtml(m.codigo_mp)}</strong></td>
                <td>${escapeHtml(m.nombre)}</td>
                <td>${m.espesor_mm}</td>
                <td style="background:#f0fdf4">$${cn.toLocaleString('es-CL')}</td>
                <td style="background:#eff6ff">$${ci.toLocaleString('es-CL')}</td>
                <td style="background:#fefce8;font-weight:600;color:${col(diffM2)}">${fmt(diffM2)}</td>
                <td style="background:#fef3c7;text-align:right">${cpm.toLocaleString('es-CL')}</td>
                <td style="background:#fce7f3;text-align:right">${mpa.toFixed(2)}%</td>
                <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px">${obs}</td>
                <td class="table-actions" style="white-space:nowrap">
                    <button class="btn btn-sm btn-outline" title="Editar" onclick="App.modules.prod_config.showMateriaForm(${m.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                    <button class="btn btn-sm btn-danger" title="Eliminar" onclick="App.modules.prod_config.deleteMateria(${m.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                </td>
            </tr>`}).join('') : '<tr><td colspan="10" style="text-align:center;padding:24px;color:#64748b">No se encontraron materias primas</td></tr>';
        }
        
        if (cardsMobile) {
            cardsMobile.innerHTML = items.length ? items.map(m => {
                const cn = Number(m.costo_unitario_mp) || 0;
                const ci = Number(m.costo_unitario_importado) || 0;
                const cpm = Number(m.consumo_promedio_mensual) || 0;
                const mpa = Number(m.mpa) || 0;
                const diffM2 = (cn > 0 && ci > 0) ? ci - cn : 0;
                const fmt = (v) => '$' + Math.round(v).toLocaleString('es-CL');
                const col = (v) => v > 0 ? '#dc2626' : v < 0 ? '#16a34a' : '#64748b';
                let badge = '';
                if (cn > 0 && ci > 0) {
                    if (diffM2 > 0) badge = '<span style="background:#dcfce7;color:#166534;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:600">Nac ' + fmt(Math.abs(diffM2)) + '</span>';
                    else if (diffM2 < 0) badge = '<span style="background:#dbeafe;color:#1e40af;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:600">Imp ' + fmt(Math.abs(diffM2)) + '</span>';
                }
                return `<div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:10px">
                    <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                        <div>
                            <div style="font-weight:700;font-size:13px">${escapeHtml(m.codigo_mp)}</div>
                            <div style="font-size:11px;color:#64748b">${escapeHtml(m.nombre)} - ${m.espesor_mm}mm</div>
                        </div>
                        <div style="display:flex;gap:4px">
                            <button class="btn btn-sm btn-outline" onclick="App.modules.prod_config.showMateriaForm(${m.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                            <button class="btn btn-sm btn-danger" onclick="App.modules.prod_config.deleteMateria(${m.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:10px">
                        <div style="background:#f0fdf4;padding:4px 6px;border-radius:4px">
                            <div style="color:#64748b">Costo Nac</div>
                            <div style="font-weight:600;color:#166534">$${cn.toLocaleString('es-CL')}</div>
                        </div>
                        <div style="background:#eff6ff;padding:4px 6px;border-radius:4px">
                            <div style="color:#64748b">Costo Imp</div>
                            <div style="font-weight:600;color:#1e40af">$${ci.toLocaleString('es-CL')}</div>
                        </div>
                        <div style="background:#fef3c7;padding:4px 6px;border-radius:4px">
                            <div style="color:#64748b">CPM</div>
                            <div style="font-weight:600;color:#92400e">${cpm.toLocaleString('es-CL')}</div>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:10px;margin-top:6px">
                        <div style="background:#fce7f3;padding:4px 6px;border-radius:4px">
                            <div style="color:#64748b">MPA</div>
                            <div style="font-weight:600;color:#9d174d">${mpa.toFixed(2)}%</div>
                        </div>
                    </div>
                    ${badge ? '<div style="margin-top:6px">' + badge + '</div>' : ''}
                </div>`;
            }).join('') : '<div style="text-align:center;padding:24px;color:#64748b">No se encontraron materias primas</div>';
        }
    },

    showImportModal() {
        App.showModal(`
            <div style="margin-bottom:12px;padding:10px 12px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    <strong style="color:#0c4a6e;font-size:13px">Formato requerido</strong>
                </div>
                <p style="margin:0 0 8px;font-size:12px;color:#075985">El archivo Excel debe contener las siguientes columnas:</p>
                <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">
                    <span style="background:#0ea5e9;color:white;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600">Codigo MP *</span>
                    <span style="background:#0ea5e9;color:white;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600">Nombre *</span>
                    <span style="background:#64748b;color:white;padding:2px 8px;border-radius:10px;font-size:10px">Espesor</span>
                    <span style="background:#16a34a;color:white;padding:2px 8px;border-radius:10px;font-size:10px">Costo Nac</span>
                    <span style="background:#16a34a;color:white;padding:2px 8px;border-radius:10px;font-size:10px">Hojas Pqt Nac</span>
                    <span style="background:#16a34a;color:white;padding:2px 8px;border-radius:10px;font-size:10px">Ancho Nac</span>
                    <span style="background:#16a34a;color:white;padding:2px 8px;border-radius:10px;font-size:10px">Alto Nac</span>
                    <span style="background:#16a34a;color:white;padding:2px 8px;border-radius:10px;font-size:10px">Pqt Camion</span>
                    <span style="background:#2563eb;color:white;padding:2px 8px;border-radius:10px;font-size:10px">Costo Imp</span>
                    <span style="background:#2563eb;color:white;padding:2px 8px;border-radius:10px;font-size:10px">Hojas Pqt Imp</span>
                    <span style="background:#2563eb;color:white;padding:2px 8px;border-radius:10px;font-size:10px">Ancho Imp</span>
                    <span style="background:#2563eb;color:white;padding:2px 8px;border-radius:10px;font-size:10px">Alto Imp</span>
                    <span style="background:#2563eb;color:white;padding:2px 8px;border-radius:10px;font-size:10px">Pqt Contenedor</span>
                    <span style="background:#f59e0b;color:white;padding:2px 8px;border-radius:10px;font-size:10px">CPM</span>
                    <span style="background:#64748b;color:white;padding:2px 8px;border-radius:10px;font-size:10px">Observacion</span>
                </div>
                <button class="btn btn-sm btn-outline" onclick="window.open('/api/produccion/materias-primas/template')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Descargar Plantilla</button>
            </div>
            <div class="form-group">
                <label>Archivo Excel (.xlsx)</label>
                <input type="file" class="form-control" id="mpImportFile" accept=".xlsx,.xls" onchange="App.modules.prod_config._onMpFileSelect(event)">
            </div>
            <div id="mpImportPreview" style="display:none;margin-top:10px;padding:10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px">
                <div style="display:flex;align-items:center;gap:6px">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    <span id="mpImportInfo" style="font-size:12px;color:#166534"></span>
                </div>
            </div>
        `, { title: 'Importar Materias Primas desde Excel' });
        document.querySelector('#modalOverlay .modal-footer').innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" id="mpImportBtn" onclick="App.modules.prod_config._doImportMaterias()" disabled>Importar</button>`;
    },

    _onMpFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        this._mpImportData = null;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const XLSXLib = window.XLSX;
                if (!XLSXLib) { alert('Libreria XLSX no cargada'); return; }
                const wb = XLSXLib.read(ev.target.result, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSXLib.utils.sheet_to_json(ws, { defval: '' });
                if (!rows.length) { alert('Archivo vacio'); return; }
                this._mpImportData = rows;
                document.getElementById('mpImportPreview').style.display = 'block';
                document.getElementById('mpImportInfo').textContent = rows.length + ' registros encontrados';
                document.getElementById('mpImportBtn').disabled = false;
            } catch (err) { alert('Error leyendo archivo: ' + err.message); }
        };
        reader.readAsArrayBuffer(file);
    },

    async _doImportMaterias() {
        if (!this._mpImportData || !this._mpImportData.length) return;
        const btn = document.getElementById('mpImportBtn');
        btn.textContent = 'Importando...'; btn.disabled = true;
        try {
            const res = await fetch('/api/produccion/materias-primas/import', {
                method: 'POST',
                headers: this._headers(),
                body: JSON.stringify({ rows: this._mpImportData })
            });
            const result = await res.json();
            if (result.ok) {
                App.showAlert('Importados: ' + (result.importados || 0) + (result.errores ? ', Errores: ' + result.errores.length : ''));
                App.hideModal();
                this.loadMaterias();
            } else {
                alert('Error: ' + (result.error || 'Desconocido'));
                btn.textContent = 'Importar'; btn.disabled = false;
            }
        } catch (err) { alert('Error: ' + err.message); btn.textContent = 'Importar'; btn.disabled = false; }
    },

    exportarExcel() {
        const items = this._materias || [];
        if (!items.length) { App.showAlert('No hay datos para exportar', 'warning'); return; }
        const rows = items.map(m => ({
            'Codigo MP': m.codigo_mp, 'Nombre': m.nombre, 'Espesor (mm)': m.espesor_mm,
            'Costo Nacional ($/m2)': m.costo_unitario_mp, 'Hojas por paquete Nac': m.hojas_por_paquete_nal,
            'Ancho Nac': m.ancho_nal, 'Alto Nac': m.alto_nal, 'Paquetes por camion': m.paquetes_por_camion,
            'Costo Importado ($/m2)': m.costo_unitario_importado, 'Hojas por paquete Imp': m.hojas_por_paquete_imp,
            'Ancho Imp': m.ancho_imp, 'Alto Imp': m.alto_imp, 'Paquetes por contenedor': m.paquetes_por_contenedor,
            'CPM': m.consumo_promedio_mensual || 0,
            'MPA (%)': m.mpa || 0,
            'Observacion': m.observacion || ''
        }));
        const XLSXLib = window.XLSX;
        if (!XLSXLib) { alert('Libreria XLSX no cargada'); return; }
        const ws = XLSXLib.utils.json_to_sheet(rows);
        const wb = XLSXLib.utils.book_new();
        XLSXLib.utils.book_append_sheet(wb, ws, 'Materias Primas');
        XLSXLib.writeFile(wb, 'materias_primas.xlsx');
    },

    showMateriaForm(id) {
        const m = id ? this._materias.find(x => x.id === id) : null;
        const v = (field, isInt) => { const val = m ? (m[field] || 0) : 0; return isInt ? Math.round(val) : val; };
        
        const style = document.createElement('style');
        style.textContent = `
            .mp-form-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px 10px;align-items:end}
            .mp-form-dims{display:grid;grid-template-columns:repeat(4,1fr);gap:6px 10px;align-items:end}
            .mp-form-grid>div,.mp-form-dims>div{min-width:0;margin:0}
            .mp-form-grid input,.mp-form-grid select,.mp-form-dims input,.mp-form-dims select{width:100%;box-sizing:border-box}
            .mp-form-grid label,.mp-form-dims label{font-size:10px;margin-bottom:2px;display:block;font-weight:600;color:#64748b}
            .mp-form-grid input,.mp-form-grid select,.mp-form-dims input,.mp-form-dims select{padding:10px 12px;font-size:13px;border:1px solid #e2e8f0;border-radius:8px}
            .mp-form-section{display:grid;grid-template-columns:1fr 1fr;gap:6px 10px}
            @media(max-width:768px){
                .mp-form-grid{grid-template-columns:1fr}
                .mp-form-dims{grid-template-columns:1fr 1fr}
                .mp-form-section{grid-template-columns:1fr}
            }
        `;
        document.head.appendChild(style);
        
        App.showModal(`
            <div class="m-card" style="margin-bottom:10px">
                <div class="m-card-header" style="padding:6px 12px;font-size:12px;font-weight:600">Datos Basicos</div>
                <div class="m-card-body" style="padding:8px 12px">
                    <div class="mp-form-grid">
                        <div class="form-group"><label>Codigo MP *</label><input class="form-control" id="mpCodigo" value="${m ? m.codigo_mp : ''}" placeholder="SKU interno"></div>
                        <div class="form-group"><label>Nombre *</label><input class="form-control" id="mpNombre" value="${m ? m.nombre : ''}" placeholder="Ej: Vidrio 6mm"></div>
                        <div class="form-group"><label>Espesor (mm)</label><input type="number" class="form-control" id="mpEspesor" value="${v('espesor_mm')}" min="0" step="0.5"></div>
                    </div>
                </div>
            </div>
            <div class="mp-form-section" style="margin-bottom:10px">
                <div class="m-card">
                    <div class="m-card-header" style="padding:6px 12px;font-size:12px;font-weight:600;background:#f0fdf4;border-bottom:1px solid #bbf7d0"><span style="color:#166534">Datos Nacional</span></div>
                    <div class="m-card-body" style="padding:8px 12px">
                        <div class="mp-form-grid" style="grid-template-columns:1fr 1fr">
                            <div class="form-group"><label>Costo ($/m2)</label><input type="number" class="form-control mp-nal" id="mpCostoNal" value="${v('costo_unitario_mp', true)}" min="0" step="1"></div>
                            <div class="form-group"><label>Hojas paquete</label><input type="number" class="form-control mp-nal" id="mpHojasNal" value="${v('hojas_por_paquete_nal', true)}" min="0"></div>
                            <div class="form-group"><label>Ancho</label><input type="number" class="form-control mp-nal" id="mpAnchoNal" value="${v('ancho_nal', true)}" min="0" step="1"></div>
                            <div class="form-group"><label>Alto</label><input type="number" class="form-control mp-nal" id="mpAltoNal" value="${v('alto_nal', true)}" min="0" step="1"></div>
                        </div>
                        <div class="mp-form-grid" style="grid-template-columns:1fr;margin-top:6px">
                            <div class="form-group"><label>Paquetes por camion</label><input type="number" class="form-control mp-nal" id="mpPaqCamion" value="${v('paquetes_por_camion')}" min="0"></div>
                        </div>
                    </div>
                </div>
                <div class="m-card">
                    <div class="m-card-header" style="padding:6px 12px;font-size:12px;font-weight:600;background:#eff6ff;border-bottom:1px solid #bfdbfe"><span style="color:#1e40af">Datos Importado</span></div>
                    <div class="m-card-body" style="padding:8px 12px">
                        <div class="mp-form-grid" style="grid-template-columns:1fr 1fr">
                            <div class="form-group"><label>Costo ($/m2)</label><input type="number" class="form-control mp-imp" id="mpCostoImp" value="${v('costo_unitario_importado', true)}" min="0" step="1"></div>
                            <div class="form-group"><label>Hojas paquete</label><input type="number" class="form-control mp-imp" id="mpHojasImp" value="${v('hojas_por_paquete_imp', true)}" min="0"></div>
                            <div class="form-group"><label>Ancho</label><input type="number" class="form-control mp-imp" id="mpAnchoImp" value="${v('ancho_imp', true)}" min="0" step="1"></div>
                            <div class="form-group"><label>Alto</label><input type="number" class="form-control mp-imp" id="mpAltoImp" value="${v('alto_imp', true)}" min="0" step="1"></div>
                        </div>
                        <div class="mp-form-grid" style="grid-template-columns:1fr;margin-top:6px">
                            <div class="form-group"><label>Paquetes por contenedor</label><input type="number" class="form-control mp-imp" id="mpPaqContenedor" value="${v('paquetes_por_contenedor')}" min="0"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="m-card" style="margin-bottom:10px">
                <div class="m-card-header" style="padding:6px 12px;font-size:12px;font-weight:600;background:#fefce8;border-bottom:1px solid #fde68a"><span style="color:#854d0e">Resumen (calculado)</span></div>
                <div class="m-card-body" style="padding:8px 12px">
                    <div class="mp-form-grid" style="grid-template-columns:1fr 1fr 1fr">
                        <div class="form-group"><label>Diferencia $/m2</label><input type="text" class="form-control" id="mpDiffM2" readonly style="background:#fff;font-weight:600"></div>
                        <div class="form-group"><label>Consumo Prom. Mensual (CPM)</label><input type="number" class="form-control" id="mpCPM" value="${v('consumo_promedio_mensual', true)}" min="0" step="1" placeholder="0"></div>
                        <div class="form-group"><label>MPA (% Merma)</label><input type="number" class="form-control" id="mpMPA" value="${v('mpa')}" min="0" max="100" step="0.01" placeholder="0.00"></div>
                    </div>
                </div>
            </div>
            <div class="m-card" style="margin-bottom:10px">
                <div class="m-card-header" style="padding:6px 12px;font-size:12px;font-weight:600">Observaciones</div>
                <div class="m-card-body" style="padding:8px 12px">
                    <div class="form-group"><textarea class="form-control" id="mpObs" rows="2" placeholder="Notas adicionales...">${m ? m.observacion || '' : ''}</textarea></div>
                </div>
            </div>
            <div style="padding:8px 12px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px">
                <div style="display:flex;align-items:center;gap:6px" id="mpAnalisis"></div>
            </div>
        `, { title: m ? 'Editar Materia Prima' : 'Nueva Materia Prima' });

        const calcResumen = () => {
            const cn = parseFloat(document.getElementById('mpCostoNal').value) || 0;
            const ci = parseFloat(document.getElementById('mpCostoImp').value) || 0;
            const diffM2 = (cn > 0 && ci > 0) ? ci - cn : 0;

            const fmt = (v) => '$' + Math.round(v).toLocaleString('es-CL');
            const color = (v) => v > 0 ? '#dc2626' : v < 0 ? '#16a34a' : '#64748b';

            const d1 = document.getElementById('mpDiffM2');
            d1.value = fmt(diffM2); d1.style.color = color(diffM2);

            const el = document.getElementById('mpAnalisis');
            if (cn === 0 && ci === 0) {
                el.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg><span style="color:#64748b;font-size:12px">Ingrese costos para ver analisis</span>';
            } else if (diffM2 > 0) {
                el.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><span style="color:#166534;font-size:12px;font-weight:600">Conviene Nacional</span><span style="color:#166534;font-size:11px"> — Ahorro de ' + fmt(Math.abs(diffM2)) + '/m2</span>';
            } else if (diffM2 < 0) {
                el.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><span style="color:#166534;font-size:12px;font-weight:600">Conviene Importado</span><span style="color:#166534;font-size:11px"> — Ahorro de ' + fmt(Math.abs(diffM2)) + '/m2</span>';
            } else {
                el.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg><span style="color:#64748b;font-size:12px">Precios iguales</span>';
            }
        };

        document.querySelectorAll('.mp-nal, .mp-imp').forEach(el => el.addEventListener('input', calcResumen));
        calcResumen();

        document.querySelector('#modalOverlay .modal-footer').innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.prod_config.saveMateria(${id || 0})">${m ? 'Actualizar' : 'Guardar'}</button>`;
    },

    async saveMateria(id) {
        const data = {
            codigo_mp: document.getElementById('mpCodigo').value.trim(),
            nombre: document.getElementById('mpNombre').value.trim(),
            espesor_mm: parseFloat(document.getElementById('mpEspesor').value) || 0,
            costo_unitario_mp: parseFloat(document.getElementById('mpCostoNal').value) || 0,
            costo_unitario_importado: parseFloat(document.getElementById('mpCostoImp').value) || 0,
            hojas_por_paquete_nal: parseInt(document.getElementById('mpHojasNal').value) || 0,
            ancho_nal: parseFloat(document.getElementById('mpAnchoNal').value) || 0,
            alto_nal: parseFloat(document.getElementById('mpAltoNal').value) || 0,
            paquetes_por_camion: parseInt(document.getElementById('mpPaqCamion').value) || 0,
            hojas_por_paquete_imp: parseInt(document.getElementById('mpHojasImp').value) || 0,
            ancho_imp: parseFloat(document.getElementById('mpAnchoImp').value) || 0,
            alto_imp: parseFloat(document.getElementById('mpAltoImp').value) || 0,
            paquetes_por_contenedor: parseInt(document.getElementById('mpPaqContenedor').value) || 0,
            consumo_promedio_mensual: parseInt(document.getElementById('mpCPM').value) || 0,
            observacion: document.getElementById('mpObs').value.trim(),
            mpa: parseFloat(document.getElementById('mpMPA').value) || 0
        };
        if (!data.codigo_mp || !data.nombre) { App.showAlert('Codigo y nombre requeridos', 'danger'); return; }
        if (id === 0) await fetch('/api/produccion/materias-primas', { method:'POST', headers:this._headers(), body: JSON.stringify(data) });
        else await fetch(`/api/produccion/materias-primas/${id}`, { method:'PUT', headers:this._headers(), body: JSON.stringify(data) });
        App.hideModal();
        App.showAlert(id === 0 ? 'Materia prima creada' : 'Materia prima actualizada');
        this.loadMaterias();
    },

    async deleteMateria(id) {
        if (!await App.confirm('¿Eliminar esta materia prima?')) return;
        await fetch(`/api/produccion/materias-primas/${id}`, { method:'DELETE', headers:this._headers() });
        App.showAlert('Materia prima eliminada');
        this.loadMaterias();
    },

    // ═══════════════════════════════════════════
    // REGLAS PROCESOS EXTRAS
    // ═══════════════════════════════════════════
    async loadReglas() {
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const hdrs = { 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' };
        const [regRes, estRes] = await Promise.all([
            fetch('/api/produccion/reglas-extras', { headers: hdrs }),
            fetch('/api/produccion/estaciones', { headers: hdrs })
        ]);
        this._reglas = await regRes.json();
        this._reglas.sort((a, b) => (a.orden_secuencia_defecto || 999) - (b.orden_secuencia_defecto || 999));
        this._estaciones = await estRes.json();
        const container = document.getElementById('prodConfigContent');
        const total = this._reglas.length;
        const activas = this._reglas.filter(r => r.activa).length;
        container.innerHTML = `
            <div class="m-page">
                <div class="m-hero">
                    <div>
                        <h2 class="m-hero-title">Reglas Extras</h2>
                        <p class="m-hero-sub">Mapea las columnas del Excel de SAP con la estacion que se agrega cuando el valor es 1</p>
                    </div>
                </div>

                <div class="m-stats">
                    <div class="m-stat-card stat-blue">
                        <div class="m-stat-label">Total Reglas</div>
                        <div class="m-stat-value">${total}</div>
                    </div>
                    <div class="m-stat-card stat-green">
                        <div class="m-stat-label">Activas</div>
                        <div class="m-stat-value">${activas}</div>
                    </div>
                </div>

                <div class="m-actions">
                    <button class="btn btn-primary" onclick="App.modules.prod_config.showReglaForm()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nueva Regla</button>
                </div>

                <div class="m-card">
                    <div class="m-table-wrap">
                        <table class="m-table">
                            <thead>
                                <tr>
                                    <th>Flag Excel</th>
                                    <th>Estacion Asignada</th>
                                    <th>Orden</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>${this._reglas.map(r => `<tr>
                                <td><code style="background:#f1f5f9;padding:2px 8px;border-radius:4px">${escapeHtml(r.nombre_flag)}</code></td>
                                <td>${escapeHtml(r.nombre_estacion || '-')}</td>
                                <td>${r.orden_secuencia_defecto || '-'}</td>
                                <td>${r.activa ? '<span class="status-badge status-realizada">Activa</span>' : '<span class="status-badge status-vencida">Inactiva</span>'}</td>
                                <td>
                                    <button class="btn btn-sm btn-outline" title="Editar" onclick="App.modules.prod_config.showReglaForm(${r.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                                    <button class="btn btn-sm btn-danger" title="Eliminar" onclick="App.modules.prod_config.deleteRegla(${r.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                                </td>
                            </tr>`).join('')}</tbody>
                        </table>
                    </div>
                    <div class="m-cards-mobile">${this._reglas.map(r => `
                        <div class="m-card-header m-table-row">
                            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;width:100%">
                                <div style="flex:1">
                                    <div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:4px"><code style="background:#f1f5f9;padding:2px 8px;border-radius:4px">${escapeHtml(r.nombre_flag)}</code></div>
                                    <div style="font-size:12px;color:#64748b;margin-bottom:4px">${escapeHtml(r.nombre_estacion || '-')}</div>
                                    <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
                                        <span style="font-size:11px;color:#64748b">Orden: ${r.orden_secuencia_defecto || '-'}</span>
                                        ${r.activa ? '<span class="status-badge status-realizada">Activa</span>' : '<span class="status-badge status-vencida">Inactiva</span>'}
                                    </div>
                                </div>
                                <div style="display:flex;gap:4px;flex-shrink:0">
                                    <button class="btn btn-sm btn-outline" title="Editar" onclick="App.modules.prod_config.showReglaForm(${r.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                                    <button class="btn btn-sm btn-danger" title="Eliminar" onclick="App.modules.prod_config.deleteRegla(${r.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                                </div>
                            </div>
                        </div>
                    `).join('')}</div>
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
        if (id === 0) await fetch('/api/produccion/reglas-extras', { method:'POST', headers:this._headers(), body: JSON.stringify(data) });
        else await fetch(`/api/produccion/reglas-extras/${id}`, { method:'PUT', headers:this._headers(), body: JSON.stringify(data) });
        App.hideModal();
        App.showAlert(id === 0 ? 'Regla creada' : 'Regla actualizada');
        this.loadReglas();
    },

    async deleteRegla(id) {
        if (!await App.confirm('¿Eliminar esta regla?')) return;
        await fetch(`/api/produccion/reglas-extras/${id}`, { method:'DELETE', headers:this._headers() });
        App.showAlert('Regla eliminada');
        this.loadReglas();
    },

    // ═══════════════════════════════════════════
    // CALENDARIO DE PRODUCCION
    // ═══════════════════════════════════════════

    async loadCalendario() {
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const hdrs = { 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' };
        const res = await fetch('/api/produccion/calendario', { headers: hdrs });
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
        let countNoLab = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            const fs = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
            if (noLabSet.has(fs)) countNoLab++;
        }
        let html = `
            <div class="m-page">
                <div class="m-hero">
                    <div>
                        <h2 class="m-hero-title">Calendario de Produccion</h2>
                        <p class="m-hero-sub">Gestiona los dias laborales y no laborales del mes</p>
                    </div>
                </div>

                <div class="m-stats">
                    <div class="m-stat-card stat-blue">
                        <div class="m-stat-label">Mes Actual</div>
                        <div class="m-stat-value" style="font-size:13px">${monthNames[month]} ${year}</div>
                    </div>
                    <div class="m-stat-card stat-red">
                        <div class="m-stat-label">Dias Bloqueados</div>
                        <div class="m-stat-value">${countNoLab}</div>
                    </div>
                </div>

                <div class="m-actions">
                    <div style="display:flex;gap:8px;align-items:center">
                        <button class="btn btn-sm btn-outline" onclick="App.modules.prod_config.calCambiar(-1)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>
                        <strong style="font-size:14px">${monthNames[month]} ${year}</strong>
                        <button class="btn btn-sm btn-outline" onclick="App.modules.prod_config.calCambiar(1)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>
                    </div>
                </div>

                <div class="m-card">
                    <div class="m-card-body" style="padding:12px">
                        <div style="display:flex;gap:16px;margin-bottom:12px;font-size:12px;color:var(--text-light)">
                            <span><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#dcfce7;vertical-align:middle"></span> Laboral</span>
                            <span><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#fee2e2;vertical-align:middle"></span> No Laboral</span>
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
        html += `</div></div></div></div>`;
        container.innerHTML = html;
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
                headers: this._headers(),
                body: JSON.stringify({ fecha: fecha, es_laboral: !actualEsLaboral, motivo: '' })
            });
            if (!res.ok) { const err = await res.json(); App.showAlert('Error: ' + (err.error || res.status), 'danger'); return; }
            await this.loadCalendario();
        } catch(e) { App.showAlert('Error de conexion: ' + e.message, 'danger'); }
    }
});
