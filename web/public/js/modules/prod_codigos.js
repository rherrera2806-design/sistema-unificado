App.registerModule('prod_codigos', {
    codigos: [],

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
                    <button style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:rgba(255,255,255,0.15);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.25);border-radius:10px;color:white;font-size:13px;font-weight:600;cursor:pointer" onclick="App.modules.prod_codigos.importarExcel()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Importar Excel</button>
                    <button style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:rgba(255,255,255,0.15);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.25);border-radius:10px;color:white;font-size:13px;font-weight:600;cursor:pointer" onclick="App.modules.prod_codigos.exportarExcel()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Exportar Excel</button>
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

            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">
                <div class="card pcod-card" style="border-left:4px solid #3b82f6;border-radius:10px;padding:10px 12px;height:55px;display:flex;align-items:center;gap:10px"><div class="card-body" style="padding:0">
                    <div style="width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,#eff6ff,#bfdbfe);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                    <div><div style="font-size:20px;font-weight:800;color:#3b82f6;line-height:1" id="codTotal">0</div><div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">Total Codigos</div></div>
                </div></div>
                <div class="card pcod-card" style="border-left:4px solid #8b5cf6;border-radius:10px;padding:10px 12px;height:55px;display:flex;align-items:center;gap:10px"><div class="card-body" style="padding:0">
                    <div style="width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,#f5f3ff,#ddd6fe);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></div>
                    <div><div style="font-size:20px;font-weight:800;color:#8b5cf6;line-height:1" id="codGrupos">0</div><div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">Grupos</div></div>
                </div></div>
                <div class="card pcod-card" style="border-left:4px solid #22c55e;border-radius:10px;padding:10px 12px;height:55px;display:flex;align-items:center;gap:10px"><div class="card-body" style="padding:0">
                    <div style="width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,#f0fdf4,#bbf7d0);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></div>
                    <div><div style="font-size:20px;font-weight:800;color:#22c55e;line-height:1" id="codFamilias">0</div><div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">Familias</div></div>
                </div></div>
                <div class="card pcod-card" style="border-left:4px solid #f59e0b;border-radius:10px;padding:10px 12px;height:55px;display:flex;align-items:center;gap:10px"><div class="card-body" style="padding:0">
                    <div style="width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,#fef3c7,#fde68a);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg></div>
                    <div><div style="font-size:20px;font-weight:800;color:#f59e0b;line-height:1" id="codBloques">0</div><div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">Con Bloqueo Tela</div></div>
                </div></div>
            </div>

            <div class="card pcod-card">
                <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                    <h3 style="margin:0">Listado de Codigos</h3>
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
                <div class="card-body" style="padding:0">
                    <table style="font-size:13px"><thead><tr>
                        <th style="padding:6px 12px">Codigo</th><th style="padding:6px 12px">Descripcion</th><th style="padding:6px 12px">Grupo</th><th style="padding:6px 12px">Familia</th><th style="padding:6px 12px">Bloqueo Tela</th><th style="padding:6px 12px">Creacion</th><th style="padding:6px 12px">Acciones</th>
                    </tr></thead><tbody id="codTable">
                        <tr><td colspan="7" style="text-align:center;padding:24px;color:#64748b">Cargando...</td></tr>
                    </tbody></table>
                </div>
            </div>

            <div class="modal-overlay" id="codCreateModal">
                <div class="modal" style="max-width:500px">
                    <div class="modal-header"><h3>Nuevo Codigo</h3><button class="modal-close" title="Cerrar" onclick="App.modules.prod_codigos.hideCreateModal()">&times;</button></div>
                    <div class="modal-body">
                        <div class="form-group"><label>Codigo SAP *</label><input class="form-control" id="codCodigo" placeholder="Ej: V659, 100, P123" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
                        <div class="form-group"><label>Descripcion</label><input class="form-control" id="codDescripcion" placeholder="Vidrio templado 10mm" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
                        <div class="form-group"><label>Grupo</label><input class="form-control" id="codGrupo" placeholder="Ej: TEMPLADO" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
                        <div class="form-group"><label>Familia</label><input class="form-control" id="codFamilia" placeholder="Ej: PINTADO, LAMINADO" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
                        <div class="form-group"><label>Bloqueo de Tela</label>
                            <select class="form-control" id="codBloqueo" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
                                <option value="false">No</option>
                                <option value="true">Si</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="App.modules.prod_codigos.hideCreateModal()">Cancelar</button>
                        <button class="btn btn-primary" onclick="App.modules.prod_codigos.save()">Guardar</button>
                    </div>
                </div>
            </div>

            <div class="modal-overlay" id="codImportModal">
                <div class="modal" style="max-width:500px">
                    <div class="modal-header"><h3>Importar Codigos SAP</h3><button class="modal-close" title="Cerrar" onclick="App.modules.prod_codigos.hideImportModal()">&times;</button></div>
                    <div class="modal-body">
                        <div id="codImportArea" style="border:2px dashed #cbd5e1;border-radius:8px;padding:32px;text-align:center;cursor:pointer"
                             onclick="document.getElementById('codImportFile').click()">
                            <div style="font-size:32px;margin-bottom:8px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>
                            <div style="color:var(--text-light)">Arrastra un Excel o haz clic para seleccionar</div>
                            <div id="codImportName" style="color:var(--success);font-weight:500;margin-top:8px;display:none"></div>
                        </div>
                        <input type="file" id="codImportFile" accept=".xlsx,.xls,.csv" style="display:none" onchange="App.modules.prod_codigos.handleImportFile(event)">
                        <div style="background:#f8fafc;border-radius:8px;padding:12px;margin-top:12px;font-size:12px;color:var(--text-light)">
                            <strong>Columnas esperadas:</strong><br>
                            Codigo, Descripcion, Grupo, Familia, BloqueoTela (si/no)<br>
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
            params.set('limit', '500');
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
        if (grupoSel && !grupoSel._populated) {
            grupos.forEach(g => { const o = document.createElement('option'); o.value = g; o.textContent = g; grupoSel.appendChild(o); });
            grupoSel._populated = true;
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
        const bloques = this.codigos.filter(c => c.bloqueo_tela).length;
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('codTotal', total);
        set('codGrupos', grupos);
        set('codFamilias', familias);
        set('codBloques', bloques);
    },

    renderTable(codigos) {
        const tbody = document.getElementById('codTable');
        if (!codigos.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:#64748b">No hay codigos registrados</td></tr>'; return; }
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const puedeEditar = user.permisos?.includes('usuarios') || user.permisos?.includes('produccion');
        const fmtDate = (d) => { if (!d) return '-'; return new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }); };
        const td = 'padding:6px 12px';
        tbody.innerHTML = codigos.map(c => `<tr class="pcod-row" style="line-height:1.3">
            <td style="${td}"><strong>${c.codigo}</strong></td>
            <td style="${td}">${c.descripcion || '-'}</td>
            <td style="${td}">${c.grupo ? `<span style="padding:2px 8px;border-radius:4px;font-size:11px;background:#dbeafe;color:#1e40af">${c.grupo}</span>` : '-'}</td>
            <td style="${td}">${c.familia ? `<span style="padding:2px 8px;border-radius:4px;font-size:11px;background:#dcfce7;color:#166534">${c.familia}</span>` : '-'}</td>
            <td style="${td}">${c.bloqueo_tela ? '<span style="padding:2px 8px;border-radius:4px;font-size:11px;background:#fee2e2;color:#991b1b">Si</span>' : '<span style="padding:2px 8px;border-radius:4px;font-size:11px;background:#f1f5f9;color:#64748b">No</span>'}</td>
            <td style="${td};font-size:12px;color:var(--text-light)">${fmtDate(c.created_at)}</td>
            <td style="${td}">${puedeEditar ? `<button class="btn btn-sm btn-danger" title="Eliminar" onclick="App.modules.prod_codigos.delete(${c.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>` : ''}</td>
        </tr>`).join('');
    },

    _filterTimer: null,
    filter() {
        clearTimeout(this._filterTimer);
        this._filterTimer = setTimeout(() => {
            const search = (document.getElementById('codFilterSearch')?.value || '').trim();
            if (search.length >= 2) {
                this.load(search);
            } else if (search.length === 0) {
                this.load();
            } else {
                // Less than 2 chars, filter client-side from current data
                const grupo = document.getElementById('codFilterGrupo')?.value || '';
                const familia = document.getElementById('codFilterFamilia')?.value || '';
                let filtered = this.codigos;
                if (grupo) filtered = filtered.filter(c => c.grupo === grupo);
                if (familia) filtered = filtered.filter(c => c.familia === familia);
                this.renderTable(filtered);
            }
        }, 300);
    },

    showCreateModal() {
        document.getElementById('codCodigo').value = '';
        document.getElementById('codDescripcion').value = '';
        document.getElementById('codGrupo').value = '';
        document.getElementById('codFamilia').value = '';
        document.getElementById('codBloqueo').value = 'false';
        document.getElementById('codCreateModal').classList.add('show');
    },
    hideCreateModal() { document.getElementById('codCreateModal').classList.remove('show'); },

    async save() {
        const codigo = document.getElementById('codCodigo').value.trim();
        const descripcion = document.getElementById('codDescripcion').value.trim();
        const grupo = document.getElementById('codGrupo').value.trim();
        const familia = document.getElementById('codFamilia').value.trim();
        const bloqueo_tela = document.getElementById('codBloqueo').value === 'true';
        if (!codigo) { alert('Codigo requerido'); return; }
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const res = await fetch('/api/produccion/codigos', {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' },
                body: JSON.stringify({ codigo, descripcion, grupo, familia, bloqueo_tela })
            });
            const data = await res.json();
            if (res.ok) { this.hideCreateModal(); App.toast('Codigo creado'); await this.load(); }
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
        document.getElementById('codImportBtn').disabled = false;
    },

    importarExcel() { document.getElementById('codImportModal').classList.add('show'); this.selectedImportFile = null; },
    hideImportModal() { document.getElementById('codImportModal').classList.remove('show'); this.selectedImportFile = null; document.getElementById('codImportName').style.display = 'none'; document.getElementById('codImportBtn').disabled = true; },

    async doImport() {
        if (!this.selectedImportFile) return;
        const btn = document.getElementById('codImportBtn');
        btn.textContent = 'Procesando...';
        btn.disabled = true;
        try {
            const base64 = await new Promise((resolve, reject) => {
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
            'Familia': c.familia || '',
            'BloqueoTela': c.bloqueo_tela ? 'Si' : 'No',
            'FechaCreacion': c.created_at ? new Date(c.created_at).toLocaleDateString('es-CL') : ''
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Codigos SAP');
        XLSX.writeFile(wb, 'codigos_sap_export.xlsx');
        App.toast('Archivo exportado: codigos_sap_export.xlsx');
    }
});
