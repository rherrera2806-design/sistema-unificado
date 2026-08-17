App.registerModule('prod_codigos', {
    codigos: [],
    editingId: null,
    _grupoColores: {},

    async render() {
        const el = document.getElementById('page-prod_codigos');
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const permisos = user.permisos || [];
        const puedeEditar = permisos.includes('usuarios') || permisos.includes('produccion');

        el.innerHTML = `
            <div class="m-page">
                <div class="m-hero">
                    <div>
                        <h2 class="m-hero-title">Codigos de Producto</h2>
                        <p class="m-hero-sub">Catalogo maestro de codigos SAP - Grupo, Familia, Bloque de Tela</p>
                    </div>
                </div>

                <div class="m-stats">
                    <div class="m-stat-card stat-blue">
                        <div class="m-stat-label">Total Codigos</div>
                        <div class="m-stat-value" id="codTotal">0</div>
                    </div>
                    <div class="m-stat-card stat-purple">
                        <div class="m-stat-label">Grupos</div>
                        <div class="m-stat-value" id="codGrupos">0</div>
                    </div>
                    <div class="m-stat-card stat-green">
                        <div class="m-stat-label">Familias</div>
                        <div class="m-stat-value" id="codFamilias">0</div>
                    </div>
                </div>

                <div class="m-actions">
                    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                        <select class="form-control" id="codFilterGrupo" style="width:auto;min-width:120px;padding:10px 12px;font-size:13px" onchange="App.modules.prod_codigos.onGrupoChange()">
                            <option value="">Todos los grupos</option>
                        </select>
                        <select class="form-control" id="codFilterFamilia" style="width:auto;min-width:120px;padding:10px 12px;font-size:13px" onchange="App.modules.prod_codigos.filter()">
                            <option value="">Todas las familias</option>
                        </select>
                        <input type="text" class="form-control" id="codFilterSearch" placeholder="Buscar codigo..." oninput="App.modules.prod_codigos.filter()" style="flex:1;min-width:150px;padding:10px 12px;font-size:13px">
                        ${puedeEditar ? `
                            <button class="btn btn-outline btn-sm" onclick="App.modules.prod_codigos.importarExcel()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Importar</button>
                            <button class="btn btn-outline btn-sm" onclick="App.modules.prod_codigos.exportarExcel()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Exportar</button>
                            ${permisos.includes('usuarios') ? '<button class="btn btn-danger btn-sm" onclick="App.modules.prod_codigos.deleteAll()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Eliminar</button>' : ''}
                            <button class="btn btn-primary" onclick="App.modules.prod_codigos.showCreateModal()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo</button>
                        ` : ''}
                    </div>
                </div>

                <div class="m-card">
                    <div class="m-table-wrap">
                        <table class="m-table">
                            <thead>
                                <tr>
                                    <th>Codigo</th>
                                    <th>Descripcion</th>
                                    <th>Grupo</th>
                                    <th>Familia</th>
                                    <th>Recetas</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="codTable">
                                <tr><td colspan="6" style="text-align:center;padding:24px;color:#64748b">Cargando...</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="m-cards-mobile" id="codCardsMobile"></div>
                </div>
            </div>

            <div class="modal-overlay" id="codCreateModal">
                <div class="modal" style="max-width:500px">
                    <div class="modal-header"><h3 id="codModalTitle">Nuevo Codigo</h3><button class="modal-close" title="Cerrar" onclick="App.modules.prod_codigos.hideCreateModal()"></button></div>
                    <div class="modal-body">
                        <div class="form-group"><label>Codigo SAP *</label><input class="form-control" id="codCodigo" placeholder="Ej: V659, 100, P123"></div>
                        <div class="form-group"><label>Descripcion</label><input class="form-control" id="codDescripcion" placeholder="Vidrio templado 10mm"></div>
                        <div class="form-group"><label>Grupo</label><select class="form-control" id="codGrupo"><option value="">-- Seleccionar --</option></select></div>
                        <div class="form-group"><label>Familia</label><select class="form-control" id="codFamilia"><option value="">-- Seleccionar --</option></select></div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="App.modules.prod_codigos.hideCreateModal()">Cancelar</button>
                        <button class="btn btn-primary" onclick="App.modules.prod_codigos.save()">Guardar</button>
                    </div>
                </div>
            </div>

            <div class="modal-overlay" id="codImportModal">
                <div class="modal" style="max-width:520px">
                    <div class="modal-header"><h3>Importar Codigos SAP</h3><button class="modal-close" title="Cerrar" onclick="App.modules.prod_codigos.hideImportModal()">&times;</button></div>
                    <div class="modal-body">
                        <div id="codImportArea" style="border:2px dashed #cbd5e1;border-radius:8px;padding:32px;text-align:center;cursor:pointer" onclick="document.getElementById('codImportFile').click()">
                            <div style="font-size:32px;margin-bottom:8px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>
                            <div style="color:var(--text-light)">Arrastra un Excel o haz clic para seleccionar</div>
                            <div id="codImportName" style="color:var(--success);font-weight:500;margin-top:8px;display:none"></div>
                        </div>
                        <input type="file" id="codImportFile" accept=".xlsx,.xls,.csv" style="display:none" onchange="App.modules.prod_codigos.handleImportFile(event)">
                        <div id="codImportPreview" style="display:none;margin-top:12px">
                            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;margin-bottom:8px">
                                <div style="font-size:13px;font-weight:700;color:#166534;margin-bottom:6px">Vista previa del archivo</div>
                                <div id="codPreviewStats" style="font-size:12px;color:#15803d;line-height:1.8"></div>
                            </div>
                            <div id="codPreviewSample" style="background:#f8fafc;border-radius:8px;padding:10px;font-size:11px;color:var(--text-light);max-height:140px;overflow-y:auto"></div>
                        </div>
                        <div style="background:#f8fafc;border-radius:8px;padding:12px;margin-top:12px;font-size:12px;color:var(--text-light)">
                            <strong>Columnas esperadas:</strong> Codigo, Descripcion, Grupo, Familia<br>
                            <em>Si el codigo ya existe, actualiza los datos (upsert)</em>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="App.modules.prod_codigos.hideImportModal()">Cancelar</button>
                        <button class="btn btn-primary" id="codImportBtn" onclick="App.modules.prod_codigos.doImport()" disabled>Importar</button>
                    </div>
                </div>
            </div>
        `;
        await this.load();
        this.setupDragDrop();
    },

    async load(search) {
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const headers = { 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' };
            const params = new URLSearchParams();
            if (search) params.set('search', search);
            const [res, capRes] = await Promise.all([
                fetch('/api/produccion/codigos?' + params.toString(), { headers }),
                fetch('/api/produccion/capacidad-grupo')
            ]);
            this.codigos = await res.json();
            const capGrupos = await capRes.json();
            this._grupoColores = {};
            capGrupos.forEach(g => { this._grupoColores[g.grupo] = g.color || '#3b82f6'; });
            this.renderStats();
            this.populateFilters();
            this.renderTable(this.codigos);
        } catch(e) { console.error('Error loading codigos:', e); }
    },

    populateFilters() {
        const grupos = [...new Set(this.codigos.map(c => c.grupo).filter(Boolean))].sort();
        const grupoSel = document.getElementById('codFilterGrupo');
        if (grupoSel) {
            const actual = grupoSel.value;
            grupoSel.innerHTML = '<option value="">Todos los grupos</option>';
            grupos.forEach(g => {
                const o = document.createElement('option');
                o.value = g; o.textContent = g;
                o.setAttribute('data-color', this._grupoColores[g] || '#3b82f6');
                grupoSel.appendChild(o);
            });
            if (grupos.includes(actual)) grupoSel.value = actual;
            const applyFilterColor = () => {
                const sel = grupoSel.options[grupoSel.selectedIndex];
                if (sel && sel.value) {
                    grupoSel.style.borderLeft = `4px solid ${sel.getAttribute('data-color') || '#3b82f6'}`;
                } else {
                    grupoSel.style.borderLeft = '';
                }
            };
            grupoSel.onchange = () => { applyFilterColor(); this.filter(); };
            applyFilterColor();
        }
        this._updateFamiliasFilter();
    },

    _updateFamiliasFilter() {
        const grupo = document.getElementById('codFilterGrupo')?.value || '';
        const familiaSel = document.getElementById('codFilterFamilia');
        if (!familiaSel) return;
        const actual = familiaSel.value;
        familiaSel.innerHTML = '<option value="">Todas las familias</option>';
        const filtered = grupo ? this.codigos.filter(c => c.grupo === grupo) : this.codigos;
        const familias = [...new Set(filtered.map(c => c.familia).filter(Boolean))].sort();
        familias.forEach(f => { const o = document.createElement('option'); o.value = f; o.textContent = f; familiaSel.appendChild(o); });
        if (familias.includes(actual)) familiaSel.value = actual;
    },

    onGrupoChange() {
        this._updateFamiliasFilter();
        this.filter();
    },

    renderStats() {
        const total = this.codigos.length;
        const grupos = new Set(this.codigos.map(c => c.grupo).filter(Boolean)).size;
        const familias = new Set(this.codigos.map(c => c.familia).filter(Boolean)).size;
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('codTotal', total);
        set('codGrupos', grupos);
        set('codFamilias', familias);
    },

    renderTable(codigos) {
        const tbody = document.getElementById('codTable');
        const cardsMobile = document.getElementById('codCardsMobile');
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const puedeEditar = user.permisos?.includes('usuarios') || user.permisos?.includes('produccion');

        if (!codigos.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:16px;color:#64748b">No hay codigos registrados</td></tr>';
            if (cardsMobile) cardsMobile.innerHTML = '<div style="text-align:center;padding:24px;color:#64748b">No hay codigos registrados</div>';
            return;
        }

        const getGrupoBadge = (grupo) => {
            if (!grupo) return '<span style="color:#cbd5e1">-</span>';
            const hex = this._grupoColores[grupo] || '#3b82f6';
            const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
            return `<span style="padding:2px 8px;border-radius:4px;font-size:11px;background:rgba(${r},${g},${b},0.15);color:${hex}">${grupo}</span>`;
        };

        const getFamiliaBadge = (familia) => {
            if (!familia) return '<span style="color:#cbd5e1">-</span>';
            return `<span style="padding:2px 8px;border-radius:4px;font-size:11px;background:#dcfce7;color:#166534">${familia}</span>`;
        };

        const getRecetasBadge = (c) => {
            const rc = parseInt(c.recetas_count) || 0;
            if (rc > 0) {
                return `<span onclick="App.modules.prod_codigos.verRecetas('${escapeHtml(c.codigo)}')" style="cursor:pointer;background:#7c3aed15;color:#7c3aed;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;display:inline-flex;align-items:center;gap:4px" title="Ver ${rc} receta(s)"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>${rc}</span>`;
            }
            return '<span style="color:#cbd5e1;font-size:11px">-</span>';
        };

        const getAcciones = (c) => {
            if (!puedeEditar) return '';
            return `<button class="btn btn-sm btn-outline" title="Editar" onclick="App.modules.prod_codigos.edit(${c.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button> <button class="btn btn-sm btn-danger" title="Eliminar" onclick="App.modules.prod_codigos.delete(${c.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>`;
        };

        tbody.innerHTML = codigos.map(c => {
            return `<tr class="pcod-row" style="line-height:1.3">
                <td style="padding:4px 10px"><strong>${c.codigo}</strong></td>
                <td style="padding:4px 10px">${c.descripcion || '-'}</td>
                <td style="padding:4px 10px">${getGrupoBadge(c.grupo)}</td>
                <td style="padding:4px 10px">${getFamiliaBadge(c.familia)}</td>
                <td style="padding:4px 10px;text-align:center">${getRecetasBadge(c)}</td>
                <td style="padding:4px 10px">${getAcciones(c)}</td>
            </tr>`;
        }).join('');

        if (cardsMobile) {
            cardsMobile.innerHTML = codigos.map(c => `
                <div class="m-card-header m-table-row">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;width:100%">
                        <div style="flex:1">
                            <div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:4px">${c.codigo}</div>
                            <div style="font-size:12px;color:#64748b;margin-bottom:6px">${c.descripcion || '-'}</div>
                            <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
                                ${getGrupoBadge(c.grupo)}
                                ${getFamiliaBadge(c.familia)}
                                ${getRecetasBadge(c)}
                            </div>
                        </div>
                        <div style="display:flex;gap:4px;flex-shrink:0">
                            ${getAcciones(c)}
                        </div>
                    </div>
                </div>
            `).join('');
        }
    },

    _filterTimer: null,
    filter() {
        clearTimeout(this._filterTimer);
        this._filterTimer = setTimeout(() => {
            const search = (document.getElementById('codFilterSearch')?.value || '').trim();
            const grupo = document.getElementById('codFilterGrupo')?.value || '';
            const familia = document.getElementById('codFilterFamilia')?.value || '';

            if (search.length >= 2) {
                this.load(search).then(() => this._applyFilters(grupo, familia));
            } else {
                this._applyFilters(grupo, familia);
            }
        }, 300);
    },

    _applyFilters(grupo, familia) {
        let filtered = this.codigos;
        if (grupo) filtered = filtered.filter(c => c.grupo === grupo);
        if (familia) filtered = filtered.filter(c => c.familia === familia);
        this.renderTable(filtered);
    },

    async _populateGrupoFamilia(selectedGrupo, selectedFamilia) {
        let capGrupos = [];
        try {
            const res = await fetch('/api/produccion/capacidad-grupo');
            capGrupos = await res.json();
        } catch(e) {}
        const grupos = capGrupos.map(g => g.grupo).sort();
        const colorMap = {};
        capGrupos.forEach(g => { colorMap[g.grupo] = g.color || '#3b82f6'; });
        this._grupoColores = { ...this._grupoColores, ...colorMap };
        const all = this.codigos || [];
        const grupoFamilias = {};
        all.forEach(c => {
            if (c.grupo && c.familia) {
                if (!grupoFamilias[c.grupo]) grupoFamilias[c.grupo] = new Set();
                grupoFamilias[c.grupo].add(c.familia);
            }
        });
        this._grupoFamilias = grupoFamilias;
        const gSel = document.getElementById('codGrupo');
        const fSel = document.getElementById('codFamilia');
        if (gSel) {
            const cur = selectedGrupo || '';
            gSel.innerHTML = '<option value="">-- Seleccionar Grupo --</option>'
                + grupos.map(g => {
                    const hex = colorMap[g] || '#3b82f6';
                    return `<option value="${escapeHtml(g)}" data-color="${hex}" ${g === cur ? 'selected' : ''}>${g}</option>`;
                }).join('');
            if (cur && !grupos.includes(cur)) {
                gSel.innerHTML += `<option value="${escapeHtml(cur)}" selected>${escapeHtml(cur)}</option>`;
            }
            const applyGrupoColor = () => {
                const sel = gSel.options[gSel.selectedIndex];
                if (sel && sel.value) {
                    const c = sel.getAttribute('data-color') || '#3b82f6';
                    gSel.style.borderLeft = `4px solid ${c}`;
                } else {
                    gSel.style.borderLeft = '';
                }
            };
            gSel.onchange = () => { this._filterFamiliasByGrupo(); applyGrupoColor(); };
            applyGrupoColor();
        }
        this._filterFamiliasByGrupo(selectedFamilia);
    },

    _filterFamiliasByGrupo(selectedFamilia) {
        const gSel = document.getElementById('codGrupo');
        const fSel = document.getElementById('codFamilia');
        if (!fSel) return;
        const grupo = gSel ? gSel.value : '';
        const all = this.codigos || [];
        let familias;
        if (grupo && this._grupoFamilias && this._grupoFamilias[grupo]) {
            familias = [...this._grupoFamilias[grupo]].sort();
        } else {
            familias = [...new Set(all.map(c => c.familia).filter(Boolean))].sort();
        }
        const cur = selectedFamilia || fSel.value || '';
        fSel.innerHTML = '<option value="">-- Seleccionar Familia --</option>'
            + familias.map(f => `<option value="${escapeHtml(f)}" ${f === cur ? 'selected' : ''}>${escapeHtml(f)}</option>`).join('');
        if (cur && !familias.includes(cur)) {
            fSel.innerHTML += `<option value="${escapeHtml(cur)}" selected>${escapeHtml(cur)}</option>`;
        }
    },

    async showCreateModal() {
        this.editingId = null;
        document.getElementById('codModalTitle').textContent = 'Nuevo Codigo';
        document.getElementById('codCodigo').value = '';
        document.getElementById('codCodigo').disabled = false;
        document.getElementById('codDescripcion').value = '';
        await this._populateGrupoFamilia('', '');
        document.getElementById('codCreateModal').classList.add('show');
    },

    async edit(id) {
        const c = (this.codigos || []).find(x => x.id === id);
        if (!c) return;
        this.editingId = id;
        document.getElementById('codModalTitle').textContent = 'Editar Codigo';
        document.getElementById('codCodigo').value = c.codigo || '';
        document.getElementById('codCodigo').disabled = true;
        document.getElementById('codDescripcion').value = c.descripcion || '';
        await this._populateGrupoFamilia(c.grupo || '', c.familia || '');
        document.getElementById('codCreateModal').classList.add('show');
    },

    hideCreateModal() { document.getElementById('codCreateModal').classList.remove('show'); },

    async save() {
        const codigo = document.getElementById('codCodigo').value.trim();
        const descripcion = document.getElementById('codDescripcion').value.trim();
        const grupo = document.getElementById('codGrupo').value.trim();
        const familia = document.getElementById('codFamilia').value.trim();
        if (!codigo) { alert('Codigo requerido'); return; }
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const headers = { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' };
            let res;
            if (this.editingId) {
                res = await fetch(`/api/produccion/codigos/${this.editingId}`, {
                    method: 'PUT', headers,
                    body: JSON.stringify({ descripcion, grupo, familia })
                });
            } else {
                res = await fetch('/api/produccion/codigos', {
                    method: 'POST', headers,
                    body: JSON.stringify({ codigo, descripcion, grupo, familia })
                });
            }
            const data = await res.json();
            if (res.ok) {
                this.hideCreateModal();
                App.toast(this.editingId ? 'Codigo actualizado' : 'Codigo creado');
                const grupo = document.getElementById('codFilterGrupo')?.value || '';
                const familia = document.getElementById('codFilterFamilia')?.value || '';
                const search = document.getElementById('codFilterSearch')?.value || '';
                await this.load(search);
                this._applyFilters(grupo, familia);
            }
            else { alert(data.error || 'Error al guardar'); }
        } catch(e) { alert('Error: ' + e.message); }
    },

    async delete(id) {
        if (!confirm('Eliminar este codigo?')) return;
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            await fetch(`/api/produccion/codigos/${id}`, {
                method: 'DELETE', headers: { 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' }
            });
            App.toast('Codigo eliminado');
            const grupo = document.getElementById('codFilterGrupo')?.value || '';
            const familia = document.getElementById('codFilterFamilia')?.value || '';
            const search = document.getElementById('codFilterSearch')?.value || '';
            await this.load(search);
            this._applyFilters(grupo, familia);
        } catch(e) { alert('Error: ' + e.message); }
    },

    async deleteAll() {
        if (!confirm('ELIMINAR TODOS los codigos de producto? Esta accion no se puede deshacer.')) return;
        if (!confirm('Seguro? Se borrarán TODOS los registros.')) return;
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const res = await fetch('/api/produccion/codigos/all', {
                method: 'DELETE', headers: { 'X-User-Email': user.email || '' }
            });
            const data = await res.json();
            if (res.ok) {
                App.toast(`${data.eliminados} codigos eliminados`);
                await this.load();
            } else { alert(data.error || 'Error al eliminar'); }
        } catch(e) { alert('Error: ' + e.message); }
    },

    setupDragDrop() {
        const area = document.getElementById('codImportArea');
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
        document.getElementById('codImportName').textContent = file.name;
        document.getElementById('codImportName').style.display = 'block';
        document.getElementById('codImportPreview').style.display = 'none';
        document.getElementById('codImportBtn').disabled = true;
        this.doPreview();
    },

    importarExcel() { document.getElementById('codImportModal').classList.add('show'); this.selectedImportFile = null; },
    hideImportModal() { document.getElementById('codImportModal').classList.remove('show'); this.selectedImportFile = null; document.getElementById('codImportName').style.display = 'none'; document.getElementById('codImportBtn').disabled = true; document.getElementById('codImportPreview').style.display = 'none'; },

    async doPreview() {
        if (!this.selectedImportFile) return;
        try {
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = () => reject(new Error('Error al leer'));
                reader.readAsDataURL(this.selectedImportFile);
            });
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const res = await fetch('/api/produccion/codigos/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' },
                body: JSON.stringify({ excel_data: base64 })
            });
            const data = await res.json();
            if (!res.ok) { alert(data.error || 'Error al leer archivo'); return; }

            const stats = document.getElementById('codPreviewStats');
            stats.innerHTML = `
                <span style="font-size:18px;font-weight:800;color:#166534">${data.con_codigo}</span> registros a importar<br>
                ${data.duplicados > 0 ? `<span style="color:#b45309">${data.duplicados}</span> duplicados (se omiten)<br>` : ''}
                ${data.sin_codigo > 0 ? `<span style="color:#dc2626">${data.sin_codigo}</span> filas sin codigo (se omiten)<br>` : ''}
                <span style="color:#64748b">Columnas: ${data.columnas_detectadas.slice(0, 6).join(', ')}${data.columnas_detectadas.length > 6 ? '...' : ''}</span>
            `;

            const sample = document.getElementById('codPreviewSample');
            if (data.muestra && data.muestra.length > 0) {
                sample.innerHTML = '<div style="font-weight:600;margin-bottom:6px;color:#334155">Primeros registros:</div>' +
                    data.muestra.map(r => `<div style="padding:3px 0;border-bottom:1px solid #e2e8f0"><b>${this.esc(r.codigo)}</b> — ${this.esc(r.descripcion || '-')} | ${this.esc(r.grupo || '-')} | ${this.esc(r.familia || '-')}</div>`).join('');
            }

            document.getElementById('codImportPreview').style.display = 'block';
            document.getElementById('codImportBtn').disabled = false;
            this._previewBase64 = base64;
        } catch(e) { alert('Error: ' + e.message); }
    },

    esc(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''; },

    async doImport() {
        if (!this.selectedImportFile) return;
        const btn = document.getElementById('codImportBtn');
        btn.textContent = 'Importando...';
        btn.disabled = true;
        try {
            const base64 = this._previewBase64 || await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = () => reject(new Error('Error al leer'));
                reader.readAsDataURL(this.selectedImportFile);
            });
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const res = await fetch('/api/produccion/codigos/importar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' },
                body: JSON.stringify({ excel_data: base64 })
            });
            const data = await res.json();
            if (res.ok) {
                App.toast(`Importados: ${data.importados} codigos. Errores: ${data.errores?.length || 0}`);
                this.hideImportModal();
                await this.load();
            } else { alert(data.error || 'Error al importar'); }
        } catch(e) { alert('Error: ' + e.message); }
        btn.textContent = 'Importar';
        btn.disabled = false;
    },

    exportarExcel() {
        if (!this.codigos.length) { alert('No hay codigos para exportar'); return; }
        const rows = this.codigos.map(c => ({
            'Codigo': c.codigo,
            'Descripcion': c.descripcion || '',
            'Grupo': c.grupo || '',
            'Familia': c.familia || ''
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Codigos SAP');
        XLSX.writeFile(wb, 'codigos_sap_export.xlsx');
        App.toast('Archivo exportado: codigos_sap_export.xlsx');
    },

    verRecetas(codigo) {
        App.modules.prod_config.switchTab('recetas');
        setTimeout(() => {
            const searchInput = document.getElementById('recFilterSearch');
            if (searchInput) { searchInput.value = codigo; App.modules.prod_recetas.filter(); }
        }, 300);
    }
});
