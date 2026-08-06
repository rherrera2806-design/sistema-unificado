App.registerModule('prod_recetas', {
    recetas: [],
    codigos: [],
    estaciones: [],
    familias: [],
    materias: [],
    editingId: null,
    _procesosTemporales: [],

    async render() {
        const el = document.getElementById('page-prod_recetas');
        if (!el) return;
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const permisos = user.permisos || [];
        const puedeEditar = permisos.includes('usuarios') || permisos.includes('produccion');

        el.innerHTML = `
            <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:8px 16px;margin-bottom:20px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">
<div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
<div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center"><div><h2 style="margin:0;font-size:15px;font-weight:800;color:white;letter-spacing:-0.5px">Recetas BOM · Modelo Híbrido</h2>
<p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Materia prima + ruta de procesos opcional para codigos estandarizados (Carroceros)</p></div>
${puedeEditar ? `
<div style="display:flex;gap:8px">
                    <button class="btn btn-info" onclick="App.modules.prod_recetas.showImportModal()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Importar Excel</button>
                    <button class="btn btn-primary" onclick="App.modules.prod_recetas.showCreateModal()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nueva Receta</button>
                    ${permisos.includes('usuarios') ? '<button class="btn btn-danger btn-sm" title="Eliminar todos los registros" onclick="App.modules.prod_recetas.deleteAll()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Eliminar Registros</button>' : ''}
                </div>` : ''}
</div></div>

<style>
@keyframes prec_fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.prec-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}
.prec-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important;transform:translateY(-3px)}
.prec-row{transition:all 0.2s}
.prec-row:hover{transform:translateX(2px);background:#f8fafc!important}
</style>

            <div class="stats-grid" style="margin-bottom:14px">
                <div class="stat-card dash-card" style="border-left:4px solid #3b82f6">
                    <div class="stat-icon blue"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Total Recetas</p><p class="stat-sub">Materia prima mapeada</p></div>
                    <div class="stat-value" id="recTotalStat">0</div>
                </div>
                <div class="stat-card dash-card" style="border-left:4px solid #8b5cf6">
                    <div class="stat-icon" style="background:#f3e8ff;color:#7c3aed"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Con Ruta Custom</p><p class="stat-sub">Procesos especificos</p></div>
                    <div class="stat-value" id="recCustomStat">0</div>
                </div>
                <div class="stat-card dash-card" style="border-left:4px solid #f59e0b">
                    <div class="stat-icon orange"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M2 20h20"/><path d="M5 20V8l5 4V8l5 4V4h3v16"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Codigos Unicos</p><p class="stat-sub">Distintos en sistema</p></div>
                    <div class="stat-value" id="recCodigosStat">0</div>
                </div>
            </div>

            <div class="card prec-card">
                <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                    <h3 style="margin:0">Listado de Recetas</h3>
                    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                        <select class="form-control" id="recFilterRuta" style="width:auto;min-width:140px;font-size:12px;padding:4px 8px" onchange="App.modules.prod_recetas.filter()" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
                            <option value="">Todas las rutas</option>
                            <option value="custom">Con ruta custom</option>
                        </select>
                        <input type="text" class="form-control" id="recFilterSearch" placeholder="Buscar codigo o material..." oninput="App.modules.prod_recetas.filter()" style="width:220px;font-size:12px;padding:4px 8px" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
                    </div>
                </div>
                <div class="card-body" style="padding:0">
                    <table style="font-size:13px"><thead><tr>
                        <th style="padding:6px 12px">Codigo SAP</th>
                        <th style="padding:6px 12px">Materia Prima</th>
                        <th style="padding:6px 12px">Ruta de Procesos</th>
                        <th style="padding:6px 12px">Cant.</th>
                        <th style="padding:6px 12px">Ancho</th>
                        <th style="padding:6px 12px">Alto</th>
                        <th style="padding:6px 12px">Acciones</th>
                    </tr></thead><tbody id="recTable">
                        <tr><td colspan="7" style="text-align:center;padding:24px;color:#64748b">Cargando...</td></tr>
                    </tbody></table>
                </div>
            </div>

            <div class="modal-overlay" id="recImportModal">
                <div class="modal" style="max-width:720px">
                    <div class="modal-header"><h3>Importar Recetas BOM desde Excel</h3><button class="modal-close" title="Cerrar" onclick="App.modules.prod_recetas.hideImportModal()">&times;</button></div>
                    <div class="modal-body">
                        <div style="background:linear-gradient(135deg,#f0f9ff,#e0f2fe);border:1px solid #bae6fd;border-radius:10px;padding:12px 14px;margin-bottom:14px">
                            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                                <strong style="color:#0c4a6e;font-size:13px">Formato requerido</strong>
                            </div>
                            <p style="margin:0 0 8px;font-size:12px;color:#075985">El archivo Excel debe contener las siguientes columnas:</p>
                            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
                                <span style="background:#0ea5e9;color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600">Codigo SAP *</span>
                                <span style="background:#0ea5e9;color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600">Codigo MP *</span>
                                <span style="background:#64748b;color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600">Cantidad</span>
                                <span style="background:#64748b;color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600">Estaciones (IDs separados por coma)</span>
                                <span style="background:#8b5cf6;color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600">Ancho</span>
                                <span style="background:#8b5cf6;color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600">Alto</span>
                            </div>
                            <button class="btn btn-outline" style="font-size:11px;padding:4px 12px" onclick="App.modules.prod_recetas.downloadTemplate()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Descargar plantilla</button>
                        </div>
                        <div class="form-group">
                            <label>Archivo Excel (.xlsx)</label>
                            <input type="file" class="form-control" id="recImportFile" accept=".xlsx,.xls" onchange="window.recetas_onFileSelect(event)" style="font-size:12px">
                        </div>
                        <div id="recImportPreview" style="display:none">
                            <div style="display:flex;align-items:center;gap:8px;margin:12px 0 8px">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                <strong style="font-size:13px;color:#166534">Vista previa del archivo</strong>
                            </div>
                            <div id="recImportStats" style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap"></div>
                            <div id="recImportErrors" style="display:none;margin-bottom:10px"></div>
                            <div style="max-height:180px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px">
                                <table style="font-size:11px;width:100%"><thead style="position:sticky;top:0;background:#f8fafc"><tr>
                                    <th style="padding:5px 8px;text-align:left;border-bottom:1px solid #e2e8f0">SAP</th>
                                    <th style="padding:5px 8px;text-align:left;border-bottom:1px solid #e2e8f0">Materia Prima</th>
                                    <th style="padding:5px 8px;text-align:center;border-bottom:1px solid #e2e8f0">Cant.</th>
                                    <th style="padding:5px 8px;text-align:left;border-bottom:1px solid #e2e8f0">Estaciones</th>
                                    <th style="padding:5px 8px;text-align:right;border-bottom:1px solid #e2e8f0">Ancho</th>
                                    <th style="padding:5px 8px;text-align:right;border-bottom:1px solid #e2e8f0">Alto</th>
                                </tr></thead><tbody id="recImportTable"></tbody></table>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="App.modules.prod_recetas.hideImportModal()">Cancelar</button>
                        <button class="btn btn-primary" id="recImportBtn" disabled onclick="App.modules.prod_recetas.doImport()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Importar</button>
                    </div>
                </div>
            </div>

            <div class="modal-overlay" id="recCreateModal">
                <div class="modal" style="max-width:680px">
                    <div class="modal-header"><h3 id="recModalTitle">Nueva Receta BOM</h3><button class="modal-close" title="Cerrar" onclick="App.modules.prod_recetas.hideCreateModal()">&times;</button></div>
                    <div class="modal-body">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                            <div class="form-group"><label>Codigo SAP Padre *</label>
                                <input class="form-control" id="recCodigoPadre" list="recCodigosList" placeholder="Ej: 500" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
                                <datalist id="recCodigosList"></datalist>
                            </div>
                            <div class="form-group"><label>Materia Prima *</label>
                                <select class="form-control" id="recMateriaPrima" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></select>
                            </div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                            <div class="form-group"><label>Familia <span style="color:#94a3b8;font-weight:400">(fallback)</span></label>
                                <select class="form-control" id="recFamilia" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
                                    <option value="">Sin familia (usar codigos_producto)</option>
                                </select>
                            </div>
                            <div class="form-group"><label>Cantidad</label>
                                <input class="form-control" id="recCantidad" type="number" min="0.01" step="0.01" value="1" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
                            </div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                            <div class="form-group"><label>Ancho <span style="color:#94a3b8;font-weight:400">(mm, opcional)</span></label>
                                <input class="form-control" id="recAncho" type="number" min="0" step="0.01" placeholder="Ej: 1200" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
                            </div>
                            <div class="form-group"><label>Alto <span style="color:#94a3b8;font-weight:400">(mm, opcional)</span></label>
                                <input class="form-control" id="recAlto" type="number" min="0" step="0.01" placeholder="Ej: 800" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
                            </div>
                        </div>

                        <div style="background:linear-gradient(135deg,#f3e8ff,#ede9fe);border:1px solid #c4b5fd;border-radius:10px;padding:12px 14px;margin-top:6px">
                            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                                <div style="display:flex;align-items:center;gap:8px">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                                    <strong style="color:#5b21b6;font-size:13px">Ruta de Procesos Especifica</strong>
                                    <span style="font-size:11px;color:#7c3aed">(opcional - para Carroceros)</span>
                                </div>
                                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:#5b21b6;font-weight:600">
                                    <input type="checkbox" id="recUsarRutaCustom" onchange="App.modules.prod_recetas.toggleRutaCustom()" style="width:16px;height:16px;cursor:pointer"> Usar ruta especifica
                                </label>
                            </div>
                            <div id="recRutaContainer" style="display:none">
                                <p style="margin:0 0 8px;font-size:11px;color:#6b21a8">Define las estaciones en orden de secuencia. Si está activo, sobreescribe la familia.</p>
                                <div id="recProcesosList" style="display:flex;flex-direction:column;gap:6px;margin-bottom:6px"></div>
                                <button onclick="App.modules.prod_recetas.addProcesoRow()" type="button" class="btn btn-outline btn-sm" style="border-color:#7c3aed;color:#7c3aed"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Agregar Estacion</button>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="App.modules.prod_recetas.hideCreateModal()">Cancelar</button>
                        <button class="btn btn-primary" id="recSaveBtn" onclick="App.modules.prod_recetas.save()">Guardar</button>
                    </div>
                </div>
            </div>
        `;
        await this.load();
    },

    _headers() {
        const user = (typeof getUser === 'function') ? getUser() : null;
        const h = { 'Content-Type': 'application/json' };
        if (user) {
            if (user.email) h['X-User-Email'] = user.email;
            if (user.permisos) h['X-User-Permisos'] = JSON.stringify(user.permisos);
        }
        return h;
    },

    async load() {
        try {
            const [recRes, codRes, estRes, famRes, matRes] = await Promise.all([
                fetch('/api/produccion/recetas-bom', { headers: this._headers() }),
                fetch('/api/produccion/codigos', { headers: this._headers() }),
                fetch('/api/produccion/estaciones', { headers: this._headers() }),
                fetch('/api/produccion/familias', { headers: this._headers() }),
                fetch('/api/produccion/materias-primas', { headers: this._headers() })
            ]);
            this.recetas = recRes.ok ? await recRes.json() : [];
            this.codigos = codRes.ok ? await codRes.json() : [];
            this.estaciones = estRes.ok ? await estRes.json() : [];
            this.familias = famRes.ok ? await famRes.json() : [];
            this.materias = matRes.ok ? await matRes.json() : [];
            this.populateModalSelects();
            this.renderStats();
            this.renderTable(this.recetas);
        } catch(e) { console.error('Error loading recetas:', e); }
    },

    renderStats() {
        const total = this.recetas.length;
        const conCustom = new Set(this.recetas.filter(r => Array.isArray(r.procesos_especificos_json) && r.procesos_especificos_json.length > 0).map(r => r.codigo_sap_padre)).size;
        const codigosUnicos = new Set(this.recetas.map(r => r.codigo_sap_padre)).size;
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('recTotalStat', total);
        set('recCustomStat', conCustom);
        set('recCodigosStat', codigosUnicos);
    },

    populateModalSelects() {
        const list = document.getElementById('recCodigosList');
        if (list) {
            list.innerHTML = (this.codigos || []).map(c => `<option value="${escapeHtml(String(c.codigo))}">${escapeHtml(String(c.codigo))}${c.descripcion ? ' - ' + escapeHtml(c.descripcion) : ''}</option>`).join('');
        }
        const mpSel = document.getElementById('recMateriaPrima');
        if (mpSel) {
            mpSel.innerHTML = '<option value="">Seleccionar materia prima...</option>' + (this.materias || []).map(m => `<option value="${m.id}">${escapeHtml(m.nombre || m.codigo_mp || ('MP-' + m.id))}${m.espesor_mm ? ' (' + m.espesor_mm + 'mm)' : ''}</option>`).join('');
        }
        const famSel = document.getElementById('recFamilia');
        if (famSel) {
            famSel.innerHTML = '<option value="">Sin familia (usar codigos_producto)</option>' + (this.familias || []).filter(f => f.activa !== false).map(f => `<option value="${f.id}">${escapeHtml(f.nombre_familia || f.codigo_familia || ('Fam-' + f.id))}</option>`).join('');
        }
    },

    filter() {
        const search = (document.getElementById('recFilterSearch')?.value || '').toLowerCase();
        const ruta = document.getElementById('recFilterRuta')?.value || '';
        let filtered = this.recetas;
        if (ruta === 'custom') filtered = filtered.filter(r => Array.isArray(r.procesos_especificos_json) && r.procesos_especificos_json.length > 0);
        if (search) {
            filtered = filtered.filter(r =>
                (r.codigo_sap_padre || '').toLowerCase().includes(search) ||
                (r.codigo_mp || '').toLowerCase().includes(search) ||
                (r.mp_nombre || '').toLowerCase().includes(search)
            );
        }
        this.renderTable(filtered);
    },

    renderTable(recetas) {
        const tbody = document.getElementById('recTable');
        if (!recetas.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:#64748b">No hay recetas BOM registradas. Crea una con "Nueva Receta" o importa desde el modulo de Códigos Carroceros.</td></tr>'; return; }
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const puedeEditar = user.permisos?.includes('usuarios') || user.permisos?.includes('produccion');

        const grupos = {};
        recetas.forEach(r => {
            const padre = r.codigo_sap_padre;
            if (!grupos[padre]) grupos[padre] = [];
            grupos[padre].push(r);
        });

        const estMap = {};
        this.estaciones.forEach(e => { estMap[e.id] = e; });

        let html = '';
        for (const [padre, items] of Object.entries(grupos)) {
            const customRoutes = items.filter(r => Array.isArray(r.procesos_especificos_json) && r.procesos_especificos_json.length > 0);
            const familiaNombre = items.find(r => r.nombre_familia)?.nombre_familia;
            const desc = (this.codigos || []).find(c => String(c.codigo) === String(padre))?.descripcion;
            const subtitleParts = [];
            if (desc) subtitleParts.push(escapeHtml(desc));
            if (familiaNombre) subtitleParts.push('Familia: ' + escapeHtml(familiaNombre));
            if (customRoutes.length > 0) subtitleParts.push('<span style="color:#7c3aed;font-weight:700">' + customRoutes.length + ' con ruta custom</span>');
            const subtitle = subtitleParts.length ? '<span style="font-size:12px;color:var(--text);font-weight:400"> - ' + subtitleParts.join(' · ') + '</span>' : '';
            html += `<tr class="prec-row" style="background:#f8fafc;line-height:1.3"><td colspan="7" style="padding:6px 12px"><strong style="color:var(--primary)">${escapeHtml(padre)}</strong> ${subtitle} <span style="font-size:11px;color:var(--text-light)">(${items.length} ${items.length === 1 ? 'receta' : 'recetas'})</span></td></tr>`;
            items.forEach(r => {
                const procs = Array.isArray(r.procesos_especificos_json) ? r.procesos_especificos_json : [];
                const chips = procs.map((id, idx) => {
                    const e = estMap[id];
                    const nombre = e ? e.nombre_estacion : ('#' + id);
                    return '<span style="display:inline-flex;align-items:center;gap:3px;background:#7c3aed15;color:#7c3aed;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:600;margin-right:3px"><span style="font-size:8px;opacity:0.7">' + (idx + 1) + '</span>' + escapeHtml(nombre) + '</span>';
                }).join('');
                let rutaHtml;
                if (chips) {
                    rutaHtml = '<div style="display:flex;flex-wrap:wrap;gap:3px;align-items:center">' + chips + '</div>';
                } else if (r.nombre_familia) {
                    rutaHtml = '<span style="display:inline-flex;align-items:center;gap:4px;color:#16a34a;font-size:11px;font-weight:500"><span style="width:6px;height:6px;border-radius:50%;background:#22c55e;display:inline-block"></span>Familia: ' + escapeHtml(r.nombre_familia) + '</span>';
                } else {
                    rutaHtml = '<span style="color:#cbd5e1">-</span>';
                }
                html += `<tr class="prec-row" style="line-height:1.3">
                    <td style="padding:6px 12px"><strong style="font-family:monospace;font-size:12px">${escapeHtml(padre)}</strong></td>
                    <td style="padding:6px 12px"><span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">${escapeHtml(r.codigo_mp || '-')}</span> ${r.mp_nombre ? '<span style="color:#64748b;font-size:11px">· ' + escapeHtml(r.mp_nombre) + '</span>' : ''}</td>
                    <td style="padding:6px 12px;max-width:340px">' + rutaHtml + '</td>
                    <td style="padding:6px 12px;text-align:center"><strong>${r.cantidad || 1}</strong></td>
                    <td style="padding:6px 12px;text-align:right">${r.ancho ? '<span style="background:#f3e8ff;color:#7c3aed;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">' + r.ancho + ' mm</span>' : '<span style="color:#cbd5e1">-</span>'}</td>
                    <td style="padding:6px 12px;text-align:right">${r.alto ? '<span style="background:#ede9fe;color:#5b21b6;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">' + r.alto + ' mm</span>' : '<span style="color:#cbd5e1">-</span>'}</td>
                    <td style="padding:6px 12px;white-space:nowrap">${puedeEditar ? `<button onclick="App.modules.prod_recetas.edit(${r.id})" class="btn btn-sm btn-outline" title="Editar"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button> <button onclick="App.modules.prod_recetas.delete(${r.id})" class="btn btn-sm btn-danger" title="Eliminar" style="margin-left:4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>` : ''}</td>
                </tr>`;
            });
        }
        tbody.innerHTML = html;
    },

    showCreateModal() {
        this.editingId = null;
        this._procesosTemporales = [];
        document.getElementById('recModalTitle').textContent = 'Nueva Receta BOM';
        document.getElementById('recCodigoPadre').value = '';
        document.getElementById('recCodigoPadre').disabled = false;
        document.getElementById('recMateriaPrima').value = '';
        document.getElementById('recFamilia').value = '';
        document.getElementById('recCantidad').value = '1';
        document.getElementById('recAncho').value = '';
        document.getElementById('recAlto').value = '';
        document.getElementById('recUsarRutaCustom').checked = false;
        document.getElementById('recProcesosList').innerHTML = '';
        document.getElementById('recRutaContainer').style.display = 'none';
        document.getElementById('recSaveBtn').onclick = () => this.save();
        document.getElementById('recCreateModal').classList.add('show');
    },

    hideCreateModal() { document.getElementById('recCreateModal').classList.remove('show'); },

    toggleRutaCustom() {
        const checked = document.getElementById('recUsarRutaCustom').checked;
        document.getElementById('recRutaContainer').style.display = checked ? 'block' : 'none';
        if (checked && this._procesosTemporales.length === 0) {
            this._procesosTemporales = [];
            this.addProcesoRow();
        }
    },

    addProcesoRow(estId) {
        const list = document.getElementById('recProcesosList');
        if (!list) return;
        const orden = list.children.length + 1;
        const estOpts = '<option value="">Seleccionar estacion...</option>' + this.estaciones.map(e => `<option value="${e.id}" ${e.id === estId ? 'selected' : ''}>${escapeHtml(e.nombre_estacion)} (#${e.id} · orden ${e.orden_secuencia_defecto || '-'})</option>`).join('');
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:6px;align-items:center';
        row.innerHTML = `<span style="background:#7c3aed;color:white;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${orden}</span>
            <select class="form-control rec-proc-sel" style="flex:1">${estOpts}</select>
            <button type="button" class="btn btn-sm btn-danger" title="Quitar"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>`;
        row.querySelector('button').onclick = () => { row.remove(); this.renumberProcesos(); };
        list.appendChild(row);
    },

    renumberProcesos() {
        const list = document.getElementById('recProcesosList');
        if (!list) return;
        Array.from(list.children).forEach((row, i) => {
            const badge = row.querySelector('span');
            if (badge) badge.textContent = i + 1;
        });
    },

    async edit(id) {
        const r = this.recetas.find(x => x.id === id);
        if (!r) return;
        this.editingId = id;
        this._procesosTemporales = Array.isArray(r.procesos_especificos_json) ? [...r.procesos_especificos_json] : [];
        document.getElementById('recModalTitle').textContent = 'Editar Receta · ' + r.codigo_sap_padre;
        document.getElementById('recCodigoPadre').value = r.codigo_sap_padre || '';
        document.getElementById('recCodigoPadre').disabled = true;
        document.getElementById('recMateriaPrima').value = r.materia_prima_id || '';
        document.getElementById('recFamilia').value = r.familia_id || '';
        document.getElementById('recCantidad').value = r.cantidad || 1;
        document.getElementById('recAncho').value = r.ancho || '';
        document.getElementById('recAlto').value = r.alto || '';
        const usarCustom = this._procesosTemporales.length > 0;
        document.getElementById('recUsarRutaCustom').checked = usarCustom;
        document.getElementById('recRutaContainer').style.display = usarCustom ? 'block' : 'none';
        const list = document.getElementById('recProcesosList');
        list.innerHTML = '';
        if (usarCustom) this._procesosTemporales.forEach(eid => this.addProcesoRow(eid));
        document.getElementById('recSaveBtn').onclick = () => this.save(id);
        document.getElementById('recCreateModal').classList.add('show');
    },

    async save(id) {
        const codigo_sap_padre = document.getElementById('recCodigoPadre').value.trim();
        const materia_prima_id = document.getElementById('recMateriaPrima').value;
        const familia_id = document.getElementById('recFamilia').value || null;
        const cantidad = Number(document.getElementById('recCantidad').value) || 1;
        const usarCustom = document.getElementById('recUsarRutaCustom').checked;
        let procesos_especificos_json = null;
        if (usarCustom) {
            const sels = document.querySelectorAll('.rec-proc-sel');
            const procs = [];
            sels.forEach(s => { const v = parseInt(s.value, 10); if (Number.isFinite(v) && v > 0) procs.push(v); });
            procesos_especificos_json = procs.length > 0 ? procs : null;
        }
        if (!codigo_sap_padre) { alert('Codigo SAP requerido'); return; }
        if (!materia_prima_id) { alert('Materia prima requerida'); return; }
        const ancho = Number(document.getElementById('recAncho').value) || null;
        const alto = Number(document.getElementById('recAlto').value) || null;
        try {
            const url = id ? `/api/produccion/recetas-bom/${id}` : '/api/produccion/recetas-bom';
            const method = id ? 'PUT' : 'POST';
            const r = await fetch(url, {
                method,
                headers: this._headers(),
                body: JSON.stringify({ codigo_sap_padre, materia_prima_id, familia_id, cantidad, procesos_especificos_json, ancho, alto })
            });
            if (!r.ok) {
                const err = await r.json().catch(() => ({}));
                throw new Error(err.error || 'Error al guardar');
            }
            this.hideCreateModal();
            App.toast(id ? 'Receta actualizada' : 'Receta creada');
            await this.load();
        } catch (e) { alert('Error: ' + e.message); }
    },

    async delete(id) {
        if (!confirm('Eliminar esta receta BOM?')) return;
        try {
            await fetch('/api/produccion/recetas-bom/' + id, { method: 'DELETE', headers: this._headers() });
            App.toast('Receta eliminada');
            await this.load();
        } catch (e) { alert('Error: ' + e.message); }
    },

    async deleteAll() {
        if (!confirm('ELIMINAR TODAS las recetas BOM? Esta accion no se puede deshacer.')) return;
        if (!confirm('Seguro? Se borrarán TODOS los registros de recetas_bom.')) return;
        try {
            const r = await fetch('/api/produccion/recetas-bom/all', { method: 'DELETE', headers: this._headers() });
            const data = await r.json();
            if (r.ok) {
                App.toast(data.eliminados + ' recetas eliminadas');
                await this.load();
            } else { alert(data.error || 'Error al eliminar'); }
        } catch (e) { alert('Error: ' + e.message); }
    },

    showImportModal() {
        document.getElementById('recImportFile').value = '';
        document.getElementById('recImportPreview').style.display = 'none';
        document.getElementById('recImportBtn').disabled = true;
        document.getElementById('recImportModal').classList.add('show');
    },

    hideImportModal() { document.getElementById('recImportModal').classList.remove('show'); },

    async doPreviewImport(file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const base64 = e.target.result.split(',')[1];
                const r = await fetch('/api/produccion/recetas-bom/preview', {
                    method: 'POST',
                    headers: { ...this._headers(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ excel_data: base64 })
                });
                const data = await r.json();
                if (!r.ok) { alert(data.error || 'Error al leer archivo'); return; }
                const preview = document.getElementById('recImportPreview');
                preview.style.display = 'block';
                document.getElementById('recImportBtn').disabled = data.validas === 0;

                let statsHtml = '<span style="background:#dbeafe;color:#1e40af;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600">Total: ' + data.total + '</span>';
                statsHtml += '<span style="background:#dcfce7;color:#166534;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600">Validas: ' + data.validas + '</span>';
                if (data.errores.length > 0) statsHtml += '<span style="background:#fef2f2;color:#991b1b;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600">Errores: ' + data.errores.length + '</span>';
                document.getElementById('recImportStats').innerHTML = statsHtml;

                if (data.errores.length > 0) {
                    let errHtml = '<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:8px 12px;margin-bottom:8px;max-height:100px;overflow-y:auto"><strong style="font-size:11px;color:#991b1b">Errores:</strong><br>';
                    data.errores.slice(0, 10).forEach(err => {
                        errHtml += '<span style="font-size:11px;color:#991b1b">Fila ' + err.fila + ': ' + err.error + '</span><br>';
                    });
                    if (data.errores.length > 10) errHtml += '<span style="font-size:11px;color:#991b1b">... +' + (data.errores.length - 10) + ' mas</span>';
                    errHtml += '</div>';
                    document.getElementById('recImportErrors').innerHTML = errHtml;
                    document.getElementById('recImportErrors').style.display = 'block';
                } else {
                    document.getElementById('recImportErrors').innerHTML = '';
                    document.getElementById('recImportErrors').style.display = 'none';
                }

                let tableHtml = '';
                data.sample.forEach(s => {
                    tableHtml += '<tr><td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;font-family:monospace">' + (s.codigo_sap || '-') + '</td><td style="padding:5px 8px;border-bottom:1px solid #f1f5f9">' + (s.codigo_mp || '-') + '</td><td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;text-align:center">' + (s.cantidad || 1) + '</td><td style="padding:5px 8px;border-bottom:1px solid #f1f5f9">' + (s.estaciones || '-') + '</td><td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;text-align:right">' + (s.ancho || '-') + '</td><td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;text-align:right">' + (s.alto || '-') + '</td></tr>';
                });
                document.getElementById('recImportTable').innerHTML = tableHtml;
            } catch (err) { alert('Error al procesar archivo: ' + err.message); }
        };
        reader.readAsDataURL(file);
    },

    async doImport() {
        const fileInput = document.getElementById('recImportFile');
        if (!fileInput.files.length) return;
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const base64 = e.target.result.split(',')[1];
                const r = await fetch('/api/produccion/recetas-bom/importar', {
                    method: 'POST',
                    headers: { ...this._headers(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ excel_data: base64 })
                });
                const data = await r.json();
                if (r.ok) {
                    App.toast(data.importadas + ' recetas importadas, ' + data.saltadas + ' duplicadas saltadas');
                    if (data.errores.length > 0) {
                        let errMsg = data.errores.slice(0, 5).map(e => 'Fila ' + e.fila + ': ' + e.error).join('\n');
                        if (data.errores.length > 5) errMsg += '\n... +' + (data.errores.length - 5) + ' mas';
                        alert('Algunas filas tuvieron errores:\n' + errMsg);
                    }
                    this.hideImportModal();
                    await this.load();
                } else { alert(data.error || 'Error al importar'); }
            } catch (err) { alert('Error: ' + err.message); }
        };
        reader.readAsDataURL(file);
    },

    downloadTemplate() {
        const headers = ['Codigo SAP', 'Codigo MP', 'Cantidad', 'Familia', 'Estaciones', 'Ancho', 'Alto'];
        const example = [
            ['500', 'MP-001', '1', 'TEMPLADO', '', '', ''],
            ['500', 'MP-002', '2', 'TEMPLADO', '', '', ''],
            ['501', 'MP-001', '1', 'TERMO', '', '', ''],
            ['502', 'MP-003', '1', '', '1,3,5', '1200', '800'],
            ['503', 'MP-001', '1', 'CARROCERO', '1,2,4,7,8', '1500', '1000']
        ];
        const csvContent = [headers, ...example].map(row => row.join(',')).join('\n');
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plantilla_recetas_bom.csv';
        a.click();
        URL.revokeObjectURL(url);
    }
});

window.recetas_onFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) App.modules.prod_recetas.doPreviewImport(file);
};
