App.registerModule('prod_codigos', {
    codigos: [],
    editingId: null,

    async render() {
        const el = document.getElementById('page-prod_codigos');
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const permisos = user.permisos || [];
        const puedeEditar = permisos.includes('usuarios') || permisos.includes('produccion');

        el.innerHTML = `
            <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:8px 16px;margin-bottom:20px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">
<div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
<div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center"><div><h2 style="margin:0;font-size:15px;font-weight:800;color:white;letter-spacing:-0.5px">Codigos de Producto</h2>
<p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Catalogo maestro de codigos SAP - Grupo, Familia, Bloque de Tela</p></div>
${puedeEditar ? `
<div style="display:flex;gap:8px">
                    <button class="btn btn-outline" style="color:white;border-color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.1)" onclick="App.modules.prod_codigos.importarExcel()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Importar Excel</button>
                    <button class="btn btn-outline" style="color:white;border-color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.1)" onclick="App.modules.prod_codigos.exportarExcel()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Exportar Excel</button>
                    ${permisos.includes('usuarios') ? '<button class="btn btn-danger btn-sm" title="Eliminar todos los registros" onclick="App.modules.prod_codigos.deleteAll()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Eliminar Registros</button>' : ''}
                    <button class="btn btn-primary btn-sm" onclick="App.modules.prod_codigos.showCreateModal()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo</button>
                </div>` : ''}
</div></div>

<style>
@keyframes pcod_fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.pcod-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}
.pcod-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important;transform:translateY(-3px)}
.pcod-row{transition:all 0.2s}
.pcod-row:hover{transform:translateX(2px);background:#f8fafc!important}
</style>

            <div class="stats-grid" style="margin-bottom:8px">
                <div class="stat-card dash-card" style="border-left:4px solid #3b82f6">
                    <div class="stat-icon blue"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Total Codigos</p><p class="stat-sub">Catalogo maestro SAP</p></div>
                    <div class="stat-value" id="codTotal">0</div>
                </div>
                <div class="stat-card dash-card" style="border-left:4px solid #8b5cf6">
                    <div class="stat-icon" style="background:#f3e8ff;color:#7c3aed"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Grupos</p><p class="stat-sub">Tipos diferentes</p></div>
                    <div class="stat-value" id="codGrupos">0</div>
                </div>
                <div class="stat-card dash-card" style="border-left:4px solid #22c55e">
                    <div class="stat-icon green"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" style="vertical-align:-2px"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Familias</p><p class="stat-sub">Subclasificaciones</p></div>
                    <div class="stat-value" id="codFamilias">0</div>
                </div>
            </div>

            <div class="card pcod-card">
                <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;padding:10px 14px">
                    <h3 style="margin:0;font-size:13px">Listado de Codigos</h3>
                    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                        <select class="form-control" id="codFilterGrupo" style="width:auto;min-width:140px;font-size:12px;padding:4px 8px" onchange="App.modules.prod_codigos.onGrupoChange()" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
                            <option value="">Todos los grupos</option>
                        </select>
                        <select class="form-control" id="codFilterFamilia" style="width:auto;min-width:140px;font-size:12px;padding:4px 8px" onchange="App.modules.prod_codigos.filter()" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
                            <option value="">Todas las familias</option>
                        </select>
                        <input type="text" class="form-control" id="codFilterSearch" placeholder="Buscar codigo, grupo... (min 2 caracteres)" oninput="App.modules.prod_codigos.filter()" style="width:200px;font-size:12px;padding:4px 8px" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
                    </div>
                </div>
                <div class="card-body" style="padding:0;max-height:700px;overflow-y:auto">
                    <div style="overflow-x:auto">
                    <table style="font-size:12px;width:100%;border-collapse:collapse"><thead><tr style="background:#f1f5f9;border-bottom:2px solid #e2e8f0">
                        <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Codigo</th>
                        <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Descripcion</th>
                        <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Grupo</th>
                        <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Familia</th>
                        <th style="padding:6px 10px;text-align:center;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Recetas</th>
                        <th style="padding:6px 10px;text-align:center;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Acciones</th>
                    </tr></thead><tbody id="codTable">
                        <tr><td colspan="6" style="text-align:center;padding:24px;color:#64748b">Cargando...</td></tr>
                    </tbody></table>
                    </div>
                </div>
            </div>

            <div class="modal-overlay" id="codCreateModal">
                <div class="modal" style="max-width:500px">
                    <div class="modal-header"><h3 id="codModalTitle">Nuevo Codigo</h3><button class="modal-close" title="Cerrar" onclick="App.modules.prod_codigos.hideCreateModal()"></button></div>
                    <div class="modal-body">
                        <div class="form-group"><label>Codigo SAP *</label><input class="form-control" id="codCodigo" placeholder="Ej: V659, 100, P123" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
                        <div class="form-group"><label>Descripcion</label><input class="form-control" id="codDescripcion" placeholder="Vidrio templado 10mm" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
                        <div class="form-group"><label>Grupo</label><select class="form-control" id="codGrupo" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"><option value="">-- Seleccionar --</option></select></div>
                        <div class="form-group"><label>Familia</label><select class="form-control" id="codFamilia" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"><option value="">-- Seleccionar --</option></select></div>
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
                        <div id="codImportArea" style="border:2px dashed #cbd5e1;border-radius:8px;padding:32px;text-align:center;cursor:pointer"
                             onclick="document.getElementById('codImportFile').click()">
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
                            <strong>Columnas esperadas:</strong><br>
                            Codigo, Descripcion, Grupo, Familia<br>
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
            const res = await fetch('/api/produccion/codigos?' + params.toString(), { headers });
            this.codigos = await res.json();
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
            grupos.forEach(g => { const o = document.createElement('option'); o.value = g; o.textContent = g; grupoSel.appendChild(o); });
            if (grupos.includes(actual)) grupoSel.value = actual;
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
        if (!codigos.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:16px;color:#64748b">No hay codigos registrados</td></tr>'; return; }
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const puedeEditar = user.permisos?.includes('usuarios') || user.permisos?.includes('produccion');
        const td = 'padding:4px 10px';
        tbody.innerHTML = codigos.map(c => {
            const rc = parseInt(c.recetas_count) || 0;
            const recetasBadge = rc > 0
                ? `<span onclick="App.modules.prod_codigos.verRecetas('${escapeHtml(c.codigo)}')" style="cursor:pointer;background:#7c3aed15;color:#7c3aed;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;display:inline-flex;align-items:center;gap:4px" title="Ver ${rc} receta(s) BOM"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>${rc}</span>`
                : `<span style="color:#cbd5e1;font-size:11px">-</span>`;
            return `<tr class="pcod-row" style="line-height:1.3">
            <td style="${td}"><strong>${c.codigo}</strong></td>
            <td style="${td}">${c.descripcion || '-'}</td>
            <td style="${td}">${c.grupo ? `<span style="padding:2px 8px;border-radius:4px;font-size:11px;background:#dbeafe;color:#1e40af">${c.grupo}</span>` : '-'}</td>
            <td style="${td}">${c.familia ? `<span style="padding:2px 8px;border-radius:4px;font-size:11px;background:#dcfce7;color:#166534">${c.familia}</span>` : '-'}</td>
            <td style="${td};text-align:center">${recetasBadge}</td>
            <td style="${td}">${puedeEditar ? `<button class="btn btn-sm btn-outline" title="Editar" onclick="App.modules.prod_codigos.edit(${c.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button> <button class="btn btn-sm btn-danger" title="Eliminar" onclick="App.modules.prod_codigos.delete(${c.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>` : ''}</td>
        </tr>`;
        }).join('');
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

    _populateGrupoFamilia(selectedGrupo, selectedFamilia) {
        const grupos = [...new Set(this.codigos.map(c => c.grupo).filter(Boolean))].sort();
        const familias = [...new Set(this.codigos.map(c => c.familia).filter(Boolean))].sort();
        const gSel = document.getElementById('codGrupo');
        const fSel = document.getElementById('codFamilia');
        if (gSel) {
            const cur = selectedGrupo || '';
            gSel.innerHTML = '<option value="">-- Seleccionar --</option>'
                + grupos.map(g => `<option value="${escapeHtml(g)}" ${g === cur ? 'selected' : ''}>${escapeHtml(g)}</option>`).join('');
            if (cur && !grupos.includes(cur)) {
                gSel.innerHTML += `<option value="${escapeHtml(cur)}" selected>${escapeHtml(cur)}</option>`;
            }
        }
        if (fSel) {
            const cur = selectedFamilia || '';
            fSel.innerHTML = '<option value="">-- Seleccionar --</option>'
                + familias.map(f => `<option value="${escapeHtml(f)}" ${f === cur ? 'selected' : ''}>${escapeHtml(f)}</option>`).join('');
            if (cur && !familias.includes(cur)) {
                fSel.innerHTML += `<option value="${escapeHtml(cur)}" selected>${escapeHtml(cur)}</option>`;
            }
        }
    },

    showCreateModal() {
        this.editingId = null;
        document.getElementById('codModalTitle').textContent = 'Nuevo Codigo';
        document.getElementById('codCodigo').value = '';
        document.getElementById('codCodigo').disabled = false;
        document.getElementById('codDescripcion').value = '';
        this._populateGrupoFamilia('', '');
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
        this._populateGrupoFamilia(c.grupo || '', c.familia || '');
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
            if (res.ok) { this.hideCreateModal(); App.toast(this.editingId ? 'Codigo actualizado' : 'Codigo creado'); await this.load(); }
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
            await this.load();
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
