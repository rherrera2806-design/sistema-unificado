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
            <style>
                .rec-amenu{position:relative;display:inline-block}
                .rec-amenu-btn{padding:6px 11px;border-radius:7px;border:1px solid #e4e9f0;background:#fff;color:#475569;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap}
                .rec-amenu-btn:hover{background:#f8fafc}
                .rec-amenu-drop{display:none;position:fixed;z-index:95;background:#fff;border:1px solid #e4e9f0;border-radius:10px;box-shadow:0 12px 32px rgba(15,23,42,.16);min-width:190px;padding:5px}
                .rec-amenu-drop .it{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:7px;font-size:11px;font-weight:600;color:#475569;cursor:pointer;white-space:nowrap}
                .rec-amenu-drop .it:hover{background:#f8fafc}
                .rec-amenu-drop .it.danger{color:#dc2626}
                .rec-amenu-drop .sep{height:1px;background:#e4e9f0;margin:5px 8px}
                .rec-drop{border:2px dashed #cbd5e1;border-radius:14px;padding:26px 18px;text-align:center;cursor:pointer;transition:all .2s;background:#f8fafc}
                .rec-drop:hover{border-color:#93c5fd;background:#eff6ff}
                .rec-drop.over{border-color:#3b82f6;background:#eff6ff}
                .rec-drop .ic{width:52px;height:52px;border-radius:12px;background:#dbeafe;display:flex;align-items:center;justify-content:center;margin:0 auto 10px}
                .rec-drop .t{font-size:13px;font-weight:600;color:#334155}
                .rec-drop .s{font-size:10px;color:#94a3b8;margin-top:4px}
                .rec-filecard{display:flex;align-items:center;gap:10px;border:1px solid #e4e9f0;border-radius:12px;padding:10px 14px;background:#fff}
                .rec-filecard.ok{background:#f0fdf4;border-color:#bbf7d0}
                .rec-filecard.warn{background:#fff7ed;border-color:#fed7aa}
                .rec-filecard .fic{width:34px;height:34px;border-radius:9px;background:#eff6ff;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
                .rec-filecard.ok .fic{background:#dcfce7}
                .rec-filecard.warn .fic{background:#ffedd5}
                .rec-filecard .info{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
                .rec-filecard .info strong{font-size:13px;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
                .rec-filecard .info span{font-size:10px;color:#8494a8}
            </style>
            <div class="m-page">
                <div class="m-hero">
                    <div>
                        <h2 class="m-hero-title">Recetas BOM · Modelo Híbrido</h2>
                        <p class="m-hero-sub">Materia prima + ruta de procesos opcional para códigos estandarizados (Carroceros)</p>
                    </div>
                </div>

                <div class="m-stats">
                    <div class="m-stat-card stat-blue">
                        <div class="m-stat-label">Total Recetas</div>
                        <div class="m-stat-value" id="recTotalStat">0</div>
                    </div>
                    <div class="m-stat-card stat-purple">
                        <div class="m-stat-label">Ruta Custom</div>
                        <div class="m-stat-value" id="recCustomStat">0</div>
                    </div>
                    <div class="m-stat-card stat-amber">
                        <div class="m-stat-label">Códigos únicos</div>
                        <div class="m-stat-value" id="recCodigosStat">0</div>
                    </div>
                </div>

                <div class="m-actions">
                    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                        <select class="form-control" id="recFilterRuta" style="width:auto;min-width:120px;padding:10px 12px;font-size:13px" onchange="App.modules.prod_recetas.filter()">
                            <option value="">Todas las rutas</option>
                            <option value="custom">Con ruta custom</option>
                        </select>
                        <input type="text" class="form-control" id="recFilterSearch" placeholder="Buscar código o material..." oninput="App.modules.prod_recetas.filter()" style="flex:1;min-width:150px;padding:10px 12px;font-size:13px">
                        ${puedeEditar ? `
                            <button class="btn btn-info" onclick="App.modules.prod_recetas.showImportModal()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Importar</button>
                            <button class="btn btn-accent" style="white-space:nowrap;padding:8px 14px;font-size:11px" onclick="App.modules.prod_recetas.showCreateModal()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo</button>
                            ${permisos.includes('usuarios') ? `<div class="rec-amenu"><button class="btn btn-sm" style="background:#fff;color:#dc2626;border:1px solid #fecaca;font-weight:600" onclick="App.modules.prod_recetas.toggleAcciones(event)">⚠ Zona de mantenimiento ▾</button><div class="rec-amenu-drop"><div class="it danger" onclick="App.modules.prod_recetas.deleteAll()">🗑 Limpiar Todo (eliminar todas las recetas)</div></div></div>` : ''}
                        ` : ''}
                    </div>
                </div>

                <div class="m-card">
                    <div class="m-table-wrap">
                        <table class="m-table">
                            <thead>
                                <tr>
                                    <th>Código SAP</th>
                                    <th>Materia Prima</th>
                                    <th>Ruta de procesos</th>
                                    <th>Cant.</th>
                                    <th>Ancho</th>
                                    <th>Alto</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="recTable">
                                <tr><td colspan="7" style="text-align:center;padding:24px;color:#64748b">Cargando...</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="m-cards-mobile" id="recCardsMobile"></div>
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
                            <p style="margin:0 0 8px;font-size:11px;color:#075985">El archivo Excel debe contener las siguientes columnas:</p>
                            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
                                <span style="background:#0ea5e9;color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600">Código SAP *</span>
                                <span style="background:#0ea5e9;color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600">Código MP *</span>
                                <span style="background:#64748b;color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600">Cantidad</span>
                                <span style="background:#64748b;color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600">Estaciones (IDs separados por coma)</span>
                                <span style="background:#8b5cf6;color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600">Ancho</span>
                                <span style="background:#8b5cf6;color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600">Alto</span>
                            </div>
                            <button class="btn btn-outline" style="font-size:11px;padding:4px 12px" onclick="App.modules.prod_recetas.downloadTemplate()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Descargar plantilla</button>
                        </div>
                        <div class="form-group">
                            <label>Archivo Excel (.xlsx)</label>
                            <input type="file" class="form-control" id="recImportFile" accept=".xlsx,.xls" onchange="window.recetas_onFileSelect(event)">
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
                            <div class="form-group"><label>Código SAP padre *</label>
                                <input class="form-control" id="recCodigoPadre" list="recCodigosList" placeholder="Ej: 500">
                                <datalist id="recCodigosList"></datalist>
                            </div>
                            <div class="form-group"><label>Materia Prima *</label>
                                <select class="form-control" id="recMateriaPrima"></select>
                            </div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                            <div class="form-group"><label>Cantidad</label>
                                <input class="form-control" id="recCantidad" type="number" min="0.01" step="0.01" value="1">
                            </div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                            <div class="form-group"><label>Ancho <span style="color:#94a3b8;font-weight:400">(mm, opcional)</span></label>
                                <input class="form-control" id="recAncho" type="number" min="0" step="0.01" placeholder="Ej: 1200">
                            </div>
                            <div class="form-group"><label>Alto <span style="color:#94a3b8;font-weight:400">(mm, opcional)</span></label>
                                <input class="form-control" id="recAlto" type="number" min="0" step="0.01" placeholder="Ej: 800">
                            </div>
                        </div>

                        <div style="background:linear-gradient(135deg,#f3e8ff,#ede9fe);border:1px solid #c4b5fd;border-radius:10px;padding:12px 14px;margin-top:6px">
                            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                                <div style="display:flex;align-items:center;gap:8px">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                                    <strong style="color:#5b21b6;font-size:13px">Ruta de procesos específica</strong>
                                    <span style="font-size:11px;color:#7c3aed">(opcional)</span>
                                </div>
                                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:11px;color:#5b21b6;font-weight:600">
                                    <input type="checkbox" id="recUsarRutaCustom" onchange="App.modules.prod_recetas.toggleRutaCustom()" style="width:16px;height:16px;cursor:pointer"> Usar ruta específica
                                </label>
                            </div>
                            <div id="recRutaContainer" style="display:none">
                                <p style="margin:0 0 8px;font-size:11px;color:#6b21a8">Define las estaciones en orden de secuencia.</p>
                                <div id="recProcesosList" style="display:flex;flex-direction:column;gap:6px;margin-bottom:6px"></div>
                                <button onclick="App.modules.prod_recetas.addProcesoRow()" type="button" class="btn btn-outline btn-sm" style="border-color:#7c3aed;color:#7c3aed"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Agregar estación</button>
                            </div>
                        </div>
                    </div>
                    <div class="form-group" style="margin-top:14px">
                        <label style="font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#64748b;display:block;margin-bottom:6px">Plano del código (PDF o imagen)</label>
                        <div id="recPlanoDrop" class="rec-drop" onclick="document.getElementById('recPlanoFile').click()">
                            <div class="ic">
                                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 12 15 15"/></svg>
                            </div>
                            <div class="t">Arrastra un archivo aquí o haz clic para seleccionar</div>
                            <div class="s">PDF o imágenes (PNG, JPG, WEBP) · máximo 20 MB</div>
                        </div>
                        <input type="file" id="recPlanoFile" accept=".pdf,image/png,image/jpeg,image/webp" style="display:none" onchange="App.modules.prod_recetas.onPlanoFile(this)">
                        <div id="recPlanoEstado" style="margin-top:10px"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="App.modules.prod_recetas.hideCreateModal()">Cancelar</button>
                        <button class="btn btn-primary" id="recSaveBtn" onclick="App.modules.prod_recetas.save()">Guardar</button>
                    </div>
                </div>
            </div>
        `;
        await this.load();
        this._setupMenus();
        this._setupPlanoDrop();
    },

    _headers() {
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        return { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' };
    },

    async load() {
        try {
            const [recRes, codRes, estRes, matRes, planosRes] = await Promise.all([
                fetch('/api/produccion/recetas-bom', { headers: this._headers() }),
                fetch('/api/produccion/codigos', { headers: this._headers() }),
                fetch('/api/produccion/estaciones', { headers: this._headers() }),
                fetch('/api/produccion/materias-primas', { headers: this._headers() }),
                fetch('/api/produccion/codigos/planos', { headers: this._headers() })
            ]);
            this.recetas = recRes.ok ? await recRes.json() : [];
            this.codigos = codRes.ok ? await codRes.json() : [];
            this.estaciones = estRes.ok ? await estRes.json() : [];
            this.materias = matRes.ok ? await matRes.json() : [];
            const planos = planosRes.ok ? await planosRes.json() : [];
            this._planos = {};
            (planos || []).forEach(p => { this._planos[String(p.codigo_sap_padre).toLowerCase()] = true; });
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
        const cardsMobile = document.getElementById('recCardsMobile');
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const puedeEditar = user.permisos?.includes('usuarios') || user.permisos?.includes('produccion');

        const descMap = {};
        (this.codigos || []).forEach(c => { descMap[String(c.codigo)] = c.descripcion; });
        const estMap = {};
        this.estaciones.forEach(e => { estMap[e.id] = e; });

        const grupos = {};
        recetas.forEach(r => {
            const padre = r.codigo_sap_padre;
            if (!grupos[padre]) grupos[padre] = [];
            grupos[padre].push(r);
        });

        if (!recetas.length) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:#64748b">No hay recetas BOM registradas</td></tr>';
            if (cardsMobile) cardsMobile.innerHTML = '<div style="text-align:center;padding:24px;color:#64748b">No hay recetas BOM registradas</div>';
            return;
        }

        const getRutaHtml = (r) => {
            const procs = Array.isArray(r.procesos_especificos_json) ? r.procesos_especificos_json : [];
            if (procs.length > 0) {
                const chips = procs.map((id, idx) => {
                    const e = estMap[id];
                    const nombre = e ? e.nombre_estacion : ('#' + id);
                    return '<span style="display:inline-flex;align-items:center;gap:3px;background:#7c3aed15;color:#7c3aed;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:600;margin-right:3px"><span style="font-size:10px;opacity:0.7">' + (idx + 1) + '</span>' + escapeHtml(nombre) + '</span>';
                }).join('');
                return '<div style="display:flex;flex-wrap:wrap;gap:3px;align-items:center">' + chips + '</div>';
            } else if (r.nombre_familia) {
                return '<span style="display:inline-flex;align-items:center;gap:4px;color:#16a34a;font-size:11px;font-weight:500"><span style="width:6px;height:6px;border-radius:50%;background:#22c55e;display:inline-block"></span>Familia: ' + escapeHtml(r.nombre_familia) + '</span>';
            }
            return '<span style="color:#cbd5e1">-</span>';
        };

        let html = '';
        let cardsHtml = '';

        for (const [padre, items] of Object.entries(grupos)) {
            const customRoutes = items.filter(r => Array.isArray(r.procesos_especificos_json) && r.procesos_especificos_json.length > 0);
            const familiaNombre = items.find(r => r.nombre_familia)?.nombre_familia;
            const desc = descMap[String(padre)];
            const subtitleParts = [];
            if (desc) subtitleParts.push(escapeHtml(desc));
            if (familiaNombre) subtitleParts.push('Familia: ' + escapeHtml(familiaNombre));
            if (customRoutes.length > 0) subtitleParts.push('<span style="color:#7c3aed;font-weight:700">' + customRoutes.length + ' con ruta custom</span>');
            const subtitle = subtitleParts.length ? ' - ' + subtitleParts.join(' · ') : '';

            html += `<tr class="prec-row" style="background:#f8fafc;line-height:1.3"><td colspan="7" style="padding:6px 12px"><strong style="color:var(--primary)">${escapeHtml(padre)}</strong><span style="font-size:11px;color:var(--text);font-weight:400">${subtitle}</span> <span style="font-size:11px;color:var(--text-light)">(${items.length} ${items.length === 1 ? 'receta' : 'recetas'})</span>${this._planos && this._planos[String(padre).toLowerCase()] ? ` <span onclick="App.modules.prod_recetas.verPlanoCodigo('${escJs(padre)}')" title="Ver el plano de este código" style="cursor:pointer;background:#0f172a;color:#fff;padding:2px 9px;border-radius:10px;font-size:10px;font-weight:700">📎 Ver plano</span>` : ''}</td></tr>`;

            cardsHtml += `<div style="background:#f8fafc;border-radius:8px;padding:10px 12px;margin-bottom:8px;border-left:3px solid var(--primary)">
                <div style="font-weight:700;font-size:13px;color:var(--primary);margin-bottom:2px">${escapeHtml(padre)}</div>
                <div style="font-size:11px;color:#64748b;margin-bottom:6px">${subtitle || items.length + ' recetas'}</div>
            </div>`;

            items.forEach(r => {
                const rutaHtml = getRutaHtml(r);
                const tienePlano = !!(this._planos && this._planos[String(r.codigo_sap_padre).toLowerCase()]);
                html += `<tr class="prec-row" style="line-height:1.3">
                    <td style="padding:6px 12px"><strong style="font-size:13px;font-weight:700">${escapeHtml(padre)}</strong></td>
                    <td style="padding:6px 12px"><span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">${escapeHtml(r.codigo_mp || '-')}</span> ${r.mp_nombre ? '<span style="color:#64748b;font-size:11px">· ' + escapeHtml(r.mp_nombre) + '</span>' : ''}${r.espesor_mm ? ' <span title="Espesor de la materia prima" style="background:#f1f5f9;color:#334155;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;border:1px solid #e2e8f0">' + Number(r.espesor_mm).toLocaleString('es-CL', { maximumFractionDigits: 2 }) + ' mm</span>' : ''}</td>
                    <td style="padding:6px 12px;max-width:340px">${rutaHtml}</td>
                    <td style="padding:6px 12px;text-align:right"><strong>${Number(r.cantidad || 1).toLocaleString('es-CL', { maximumFractionDigits: 2 })}</strong></td>
                    <td style="padding:6px 12px;text-align:right">${r.ancho ? '<span style="background:#f3e8ff;color:#7c3aed;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">' + Number(Math.round(r.ancho)).toLocaleString('es-CL') + ' mm</span>' : '<span style="color:#cbd5e1">-</span>'}</td>
                    <td style="padding:6px 12px;text-align:right">${r.alto ? '<span style="background:#ede9fe;color:#5b21b6;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">' + Number(Math.round(r.alto)).toLocaleString('es-CL') + ' mm</span>' : '<span style="color:#cbd5e1">-</span>'}</td>
                    <td style="padding:6px 12px;white-space:nowrap">${puedeEditar ? `
                        <div class="rec-amenu"><button class="rec-amenu-btn" onclick="App.modules.prod_recetas.toggleAcciones(event)">Acciones ▾</button>
                        <div class="rec-amenu-drop">
                            <div class="it" onclick="App.modules.prod_recetas.edit(${r.id})">✏️ Editar receta</div>
                            ${tienePlano ? `<div class="it" onclick="App.modules.prod_recetas.verPlanoCodigo('${escJs(r.codigo_sap_padre)}')">👁 Ver plano del código</div>` : ''}
                            <div class="sep"></div>
                            <div class="it danger" onclick="App.modules.prod_recetas.delete(${r.id})">🗑 Eliminar receta</div>
                        </div></div>` : ''}</td>
                </tr>`;

                cardsHtml += `<div class="m-card-header m-table-row">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;width:100%">
                        <div style="flex:1">
                            <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:4px">
                                <span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">${escapeHtml(r.codigo_mp || '-')}</span>
                                <span style="font-size:11px;color:#64748b">${r.mp_nombre ? escapeHtml(r.mp_nombre) : ''}</span>
                                ${r.espesor_mm ? '<span style="background:#f1f5f9;color:#334155;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;border:1px solid #e2e8f0">' + Number(r.espesor_mm).toLocaleString('es-CL', { maximumFractionDigits: 2 }) + ' mm</span>' : ''}
                            </div>
                            <div style="margin-bottom:4px">${rutaHtml}</div>
                            <div style="display:flex;flex-wrap:wrap;gap:6px;font-size:11px;color:#64748b">
                                <span>Cant: <strong>${Number(r.cantidad || 1).toLocaleString('es-CL', { maximumFractionDigits: 2 })}</strong></span>
                                ${r.ancho ? '<span>Ancho: <strong>' + Number(Math.round(r.ancho)).toLocaleString('es-CL') + ' mm</strong></span>' : ''}
                                ${r.alto ? '<span>Alto: <strong>' + Number(Math.round(r.alto)).toLocaleString('es-CL') + ' mm</strong></span>' : ''}
                            </div>
                        </div>
                        <div style="display:flex;gap:4px;flex-shrink:0">
                            ${puedeEditar ? `
                            <div class="rec-amenu"><button class="rec-amenu-btn" onclick="App.modules.prod_recetas.toggleAcciones(event)">Acciones ▾</button>
                            <div class="rec-amenu-drop">
                                <div class="it" onclick="App.modules.prod_recetas.edit(${r.id})">✏️ Editar receta</div>
                                ${tienePlano ? `<div class="it" onclick="App.modules.prod_recetas.verPlanoCodigo('${escJs(r.codigo_sap_padre)}')">👁 Ver plano del código</div>` : ''}
                                <div class="sep"></div>
                                <div class="it danger" onclick="App.modules.prod_recetas.delete(${r.id})">🗑 Eliminar receta</div>
                            </div></div>` : ''}
                        </div>
                    </div>
                </div>`;
            });
        }

        tbody.innerHTML = html;
        if (cardsMobile) cardsMobile.innerHTML = cardsHtml;
    },

    showCreateModal() {
        this.editingId = null;
        this._procesosTemporales = [];
        document.getElementById('recModalTitle').textContent = 'Nueva Receta BOM';
        document.getElementById('recCodigoPadre').value = '';
        document.getElementById('recCodigoPadre').disabled = false;
        document.getElementById('recMateriaPrima').value = '';
        document.getElementById('recCantidad').value = '1';
        document.getElementById('recAncho').value = '';
        document.getElementById('recAlto').value = '';
        document.getElementById('recUsarRutaCustom').checked = false;
        document.getElementById('recProcesosList').innerHTML = '';
        document.getElementById('recRutaContainer').style.display = 'none';
        this._resetPlano();
        document.getElementById('recSaveBtn').onclick = () => this.save();
        document.getElementById('recCreateModal').classList.add('show');
    },

    // ── Plano del código (PDF o imagen) ──
    _resetPlano(tiene) {
        this._planoFile = null;
        this._planoQuitar = false;
        this._planoTiene = !!tiene;
        const f = document.getElementById('recPlanoFile');
        if (f) f.value = '';
        this._renderPlanoEstado();
    },
    _renderPlanoEstado() {
        const el = document.getElementById('recPlanoEstado');
        if (!el) return;
        const drop = document.getElementById('recPlanoDrop');
        if (drop) drop.classList.toggle('over', !!this._planoFile);
        if (this._planoFile) {
            const kb = Math.max(1, Math.round(this._planoFile.size / 1024));
            el.innerHTML = `<div class="rec-filecard">
                <div class="fic">📄</div>
                <div class="info"><strong>${escText(this._planoFile.name)}</strong><span>Listo para guardar · ${kb.toLocaleString('es-CL')} KB · se asocia al CÓDIGO SAP</span></div>
                <button type="button" class="btn btn-outline btn-sm" onclick="App.modules.prod_recetas.quitarPlano()">Quitar</button>
            </div>`;
        } else if (this._planoQuitar) {
            el.innerHTML = `<div class="rec-filecard warn">
                <div class="fic">🗑</div>
                <div class="info"><strong>El plano actual se quitará</strong><span>Se elimina del código al pulsar Guardar</span></div>
            </div>`;
        } else if (this._planoTiene) {
            el.innerHTML = `<div class="rec-filecard ok">
                <div class="fic">📎</div>
                <div class="info"><strong>Este código tiene plano adjunto</strong><span>Verlo o reemplazarlo subiendo otro archivo</span></div>
                <button type="button" class="btn btn-outline btn-sm" onclick="App.modules.prod_recetas.verPlano()">👁 Ver plano</button>
                <button type="button" class="btn btn-outline btn-sm" style="color:#dc2626;border-color:#fecaca" onclick="App.modules.prod_recetas.quitarPlano()">Quitar</button>
            </div>`;
        } else {
            el.innerHTML = '';
        }
    },
    _setupPlanoDrop() {
        const area = document.getElementById('recPlanoDrop');
        if (!area) return;
        area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('over'); });
        area.addEventListener('dragleave', () => area.classList.remove('over'));
        area.addEventListener('drop', e => {
            e.preventDefault();
            area.classList.remove('over');
            if (e.dataTransfer.files.length) this.onPlanoFile({ target: { files: e.dataTransfer.files } });
        });
    },
    onPlanoFile(input) {
        const file = input.files[0];
        if (!file) return;
        if (file.size > 20 * 1024 * 1024) {
            input.value = '';
            App.showAlert('El plano supera el máximo de 20 MB', 'danger');
            return;
        }
        this._planoFile = file;
        this._planoQuitar = false;
        this._renderPlanoEstado();
    },
    verPlano() {
        const codigo = document.getElementById('recCodigoPadre')?.value?.trim();
        if (!codigo) return;
        window.open('/api/produccion/codigos/' + encodeURIComponent(codigo) + '/plano', '_blank');
    },
    verPlanoCodigo(codigo) {
        this._cerrarMenus();
        window.open('/api/produccion/codigos/' + encodeURIComponent(codigo) + '/plano', '_blank');
    },
    quitarPlano() {
        this._planoFile = null;
        this._planoQuitar = true;
        const f = document.getElementById('recPlanoFile');
        if (f) f.value = '';
        this._renderPlanoEstado();
    },
    async _guardarPlano(codigo) {
        try {
            if (this._planoFile) {
                const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
                // FormData: sin Content-Type (el navegador pone el boundary)
                const fd = new FormData();
                fd.append('plano', this._planoFile);
                const r = await fetch('/api/produccion/codigos/' + encodeURIComponent(codigo) + '/plano', {
                    method: 'POST',
                    headers: { 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' },
                    body: fd
                });
                if (r.ok) App.toast('Plano guardado');
                else { const d = await r.json().catch(() => ({})); App.showAlert(d.error || 'No se pudo guardar el plano', 'danger'); }
            } else if (this._planoQuitar && this._planoTiene) {
                const r = await fetch('/api/produccion/codigos/' + encodeURIComponent(codigo) + '/plano', { method: 'DELETE', headers: this._headers() });
                if (r.ok) App.toast('Plano quitado');
                else { const d = await r.json().catch(() => ({})); App.showAlert(d.error || 'No se pudo quitar el plano', 'danger'); }
            }
        } catch (e) { App.showAlert('Error con el plano: ' + e.message, 'danger'); }
    },

    hideCreateModal() { document.getElementById('recCreateModal').classList.remove('show'); },

    // ── Menú de acciones (popover fijo: se sale del recorte de la tabla) ──
    toggleAcciones(e) {
        e.stopPropagation();
        const wrap = e.currentTarget.parentElement;
        const menu = wrap.querySelector('.rec-amenu-drop');
        if (!menu) return;
        const wasVisible = menu.style.display === 'block';
        this._cerrarMenus();
        if (wasVisible) return;
        const rect = e.currentTarget.getBoundingClientRect();
        menu.style.display = 'block';
        menu.style.top = '0px';
        menu.style.left = '0px';
        const mh = menu.offsetHeight, mw = menu.offsetWidth;
        const espacioAbajo = window.innerHeight - rect.bottom;
        menu.style.top = (espacioAbajo < mh + 12 ? Math.max(8, rect.top - mh - 6) : rect.bottom + 6) + 'px';
        menu.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - mw - 8)) + 'px';
    },
    _cerrarMenus() {
        document.querySelectorAll('.rec-amenu-drop').forEach(d => d.style.display = 'none');
    },
    _setupMenus() {
        if (this._menusBound) return;
        this._menusBound = true;
        document.addEventListener('click', () => this._cerrarMenus());
        window.addEventListener('scroll', () => this._cerrarMenus(), true);
        window.addEventListener('resize', () => this._cerrarMenus());
    },

    // ── Confirmación en modal (sin confirm() nativo) ──
    _confirmar(titulo, html, textoBoton, accion) {
        let overlay = document.getElementById('recConfirmOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'recConfirmOverlay';
            overlay.style.cssText = 'display:none;position:fixed;inset:0;z-index:99;align-items:center;justify-content:center;background:rgba(15,23,42,.5);backdrop-filter:blur(4px)';
            overlay.innerHTML = `
                <div style="background:#fff;border-radius:16px;width:92%;max-width:420px;box-shadow:0 20px 60px rgba(15,23,42,.3)" onclick="event.stopPropagation()">
                    <div style="padding:18px 24px;border-bottom:1px solid #e4e9f0;display:flex;align-items:center;justify-content:space-between">
                        <h3 id="recConfirmTitle" style="margin:0;font-size:15px;font-weight:700"></h3>
                        <button onclick="document.getElementById('recConfirmOverlay').style.display='none'" style="width:28px;height:28px;border-radius:8px;border:none;background:#f1f5f9;color:#64748b;cursor:pointer">✕</button>
                    </div>
                    <div style="padding:20px 24px"><p id="recConfirmText" style="font-size:13px;color:#475569;line-height:1.6;margin:0"></p></div>
                    <div style="padding:14px 24px 20px;display:flex;gap:8px;justify-content:flex-end;border-top:1px solid #e4e9f0">
                        <button onclick="document.getElementById('recConfirmOverlay').style.display='none'" style="padding:9px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid #e4e9f0;background:#fff;color:#475569">Cancelar</button>
                        <button id="recConfirmBtn" style="padding:9px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:none;background:#dc2626;color:#fff">Confirmar</button>
                    </div>
                </div>`;
            overlay.addEventListener('click', () => { overlay.style.display = 'none'; });
            document.body.appendChild(overlay);
        }
        document.getElementById('recConfirmTitle').textContent = titulo;
        document.getElementById('recConfirmText').innerHTML = html;
        document.getElementById('recConfirmBtn').onclick = () => { overlay.style.display = 'none'; accion(); };
        overlay.style.display = 'flex';
    },

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
        const estOpts = '<option value="">Seleccionar estación...</option>' + this.estaciones.map(e => `<option value="${e.id}" ${e.id === estId ? 'selected' : ''}>${escapeHtml(e.nombre_estacion)} (#${e.id} · orden ${e.orden_secuencia_defecto || '-'})</option>`).join('');
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
        document.getElementById('recCantidad').value = r.cantidad || 1;
        document.getElementById('recAncho').value = r.ancho || '';
        document.getElementById('recAlto').value = r.alto || '';
        const usarCustom = this._procesosTemporales.length > 0;
        document.getElementById('recUsarRutaCustom').checked = usarCustom;
        document.getElementById('recRutaContainer').style.display = usarCustom ? 'block' : 'none';
        const list = document.getElementById('recProcesosList');
        list.innerHTML = '';
        if (usarCustom) this._procesosTemporales.forEach(eid => this.addProcesoRow(eid));
        this._resetPlano(!!(this._planos && this._planos[String(r.codigo_sap_padre).toLowerCase()]));
        document.getElementById('recSaveBtn').onclick = () => this.save(id);
        document.getElementById('recCreateModal').classList.add('show');
    },

    async save(id) {
        const codigo_sap_padre = document.getElementById('recCodigoPadre').value.trim();
        const materia_prima_id = document.getElementById('recMateriaPrima').value;
        const cantidad = Number(document.getElementById('recCantidad').value) || 1;
        const usarCustom = document.getElementById('recUsarRutaCustom').checked;
        let procesos_especificos_json = null;
        if (usarCustom) {
            const sels = document.querySelectorAll('.rec-proc-sel');
            const procs = [];
            sels.forEach(s => { const v = parseInt(s.value, 10); if (Number.isFinite(v) && v > 0) procs.push(v); });
            procesos_especificos_json = procs.length > 0 ? procs : null;
        }
        if (!codigo_sap_padre) { App.showAlert('El código SAP es requerido', 'danger'); return; }
        if (!materia_prima_id) { App.showAlert('La materia prima es requerida', 'danger'); return; }
        const ancho = Number(document.getElementById('recAncho').value) || null;
        const alto = Number(document.getElementById('recAlto').value) || null;
        try {
            const url = id ? `/api/produccion/recetas-bom/${id}` : '/api/produccion/recetas-bom';
            const method = id ? 'PUT' : 'POST';
            const r = await fetch(url, {
                method,
                headers: this._headers(),
                body: JSON.stringify({ codigo_sap_padre, materia_prima_id, cantidad, procesos_especificos_json, ancho, alto })
            });
            if (!r.ok) {
                const err = await r.json().catch(() => ({}));
                throw new Error(err.error || 'Error al guardar');
            }
            this.hideCreateModal();
            App.toast(id ? 'Receta actualizada' : 'Receta creada');
            await this._guardarPlano(codigo_sap_padre);
            await this.load();
        } catch (e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    delete(id) {
        const r = (this.recetas || []).find(x => x.id === id);
        this._confirmar('Eliminar receta',
            `Se eliminará esta receta BOM${r ? ' de <strong>' + escapeHtml(r.codigo_sap_padre) + '</strong>' : ''}.<br><br>Si era la única del código, la importación SAP volverá a rechazarlo.`,
            'Eliminar', async () => {
                try {
                    await apiJson(await fetch('/api/produccion/recetas-bom/' + id, { method: 'DELETE', headers: this._headers() }));
                    App.toast('Receta eliminada');
                    await this.load();
                } catch (e) { App.showAlert('Error: ' + e.message, 'danger'); }
            });
    },

    deleteAll() {
        this._confirmar('Eliminar todas las recetas',
            'Se eliminarán <strong>TODAS las recetas BOM</strong>. <strong>Esta acción no se puede deshacer.</strong><br><br>La importación SAP dejará de reconocer todos los códigos hasta recrear sus recetas.',
            'Eliminar todas', async () => {
                try {
                    const r = await fetch('/api/produccion/recetas-bom/all', { method: 'DELETE', headers: this._headers() });
                    const data = await r.json();
                    if (r.ok) {
                        App.toast(data.eliminados + ' recetas eliminadas');
                        await this.load();
                    } else { App.showAlert(data.error || 'Error al eliminar', 'danger'); }
                } catch (e) { App.showAlert('Error: ' + e.message, 'danger'); }
            });
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
                if (!r.ok) { App.showAlert(data.error || 'Error al leer el archivo', 'danger'); return; }
                const preview = document.getElementById('recImportPreview');
                preview.style.display = 'block';
                document.getElementById('recImportBtn').disabled = data.validas === 0;

                let statsHtml = '<span style="background:#dbeafe;color:#1e40af;padding:4px 12px;border-radius:12px;font-size:11px;font-weight:600">Total: ' + data.total + '</span>';
                statsHtml += '<span style="background:#dcfce7;color:#166534;padding:4px 12px;border-radius:12px;font-size:11px;font-weight:600">Validas: ' + data.validas + '</span>';
                if (data.errores.length > 0) statsHtml += '<span style="background:#fef2f2;color:#991b1b;padding:4px 12px;border-radius:12px;font-size:11px;font-weight:600">Errores: ' + data.errores.length + '</span>';
                document.getElementById('recImportStats').innerHTML = statsHtml;

                if (data.errores.length > 0) {
                    let errHtml = '<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:8px 12px;margin-bottom:8px;max-height:100px;overflow-y:auto"><strong style="font-size:11px;color:#991b1b">Errores:</strong><br>';
                    data.errores.slice(0, 10).forEach(err => {
                        errHtml += '<span style="font-size:11px;color:#991b1b">Fila ' + escText(err.fila) + ': ' + escText(err.error) + '</span><br>';
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
                    tableHtml += '<tr><td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;font-weight:700">' + escText(s.codigo_sap || '-') + '</td><td style="padding:5px 8px;border-bottom:1px solid #f1f5f9">' + escText(s.codigo_mp || '-') + '</td><td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;text-align:center">' + escText(s.cantidad || 1) + '</td><td style="padding:5px 8px;border-bottom:1px solid #f1f5f9">' + escText(s.estaciones || '-') + '</td><td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;text-align:right">' + escText(s.ancho || '-') + '</td><td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;text-align:right">' + escText(s.alto || '-') + '</td></tr>';
                });
                document.getElementById('recImportTable').innerHTML = tableHtml;
            } catch (err) { App.showAlert('Error al procesar el archivo: ' + err.message, 'danger'); }
        };
        reader.readAsDataURL(file);
    },

    async doImport() {
        const fileInput = document.getElementById('recImportFile');
        if (!fileInput.files.length) { App.showAlert('Selecciona un archivo primero', 'danger'); return; }
        const file = fileInput.files[0];
        const btn = document.getElementById('recImportBtn');
        if (btn) { btn.disabled = true; btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;animation:spin 1s linear infinite"><circle cx="12" cy="12" r="10"/></svg> Importando...'; }
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const base64 = e.target.result.split(',')[1];
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 120000);
                const r = await fetch('/api/produccion/recetas-bom/importar', {
                    method: 'POST',
                    headers: { ...this._headers(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ excel_data: base64 }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                const data = await r.json();
                if (r.ok) {
                    App.toast(data.importadas + ' recetas importadas, ' + data.saltadas + ' duplicadas saltadas');
                    if (data.errores.length > 0) {
                        let errMsg = data.errores.slice(0, 5).map(e => 'Fila ' + e.fila + ': ' + e.error).join('\n');
                        if (data.errores.length > 5) errMsg += '\n... +' + (data.errores.length - 5) + ' mas';
                        App.showAlert('Algunas filas tuvieron errores: ' + errMsg.replace(/\n/g, ' · ').slice(0, 220), 'danger');
                    }
                    this.hideImportModal();
                    await this.load();
                } else { App.showAlert(data.error || 'Error al importar (HTTP ' + r.status + ')', 'danger'); }
            } catch (err) {
                if (err.name === 'AbortError') { App.showAlert('La importación tardó demasiado (>2 min). Intenta con menos filas.', 'danger'); }
                else { App.showAlert('Error: ' + err.message, 'danger'); }
            }
            if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Importar'; }
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
