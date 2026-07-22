App.registerModule('prod_codigos', {
    codigos: [],

    async render() {
        const el = document.getElementById('page-prod_codigos');
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const permisos = user.permisos || [];
        const puedeEditar = permisos.includes('usuarios') || permisos.includes('produccion');

        el.innerHTML = `
            <div class="page-header">
                <div>
                    <h2 style="margin:0">Codigos de Producto</h2>
                    <div class="subtitle">Catalogo maestro de codigos SAP - Grupo, Familia, Bloque de Tela</div>
                </div>
                ${puedeEditar ? `
                <div style="display:flex;gap:8px">
                    <button class="btn btn-outline" onclick="App.modules.prod_codigos.importarExcel()">📥 Importar Excel</button>
                    <button class="btn btn-outline" onclick="App.modules.prod_codigos.exportarExcel()">📤 Exportar Excel</button>
                    ${permisos.includes('usuarios') ? '<button class="btn btn-outline" style="color:#ef4444;border-color:#ef4444" onclick="App.modules.prod_codigos.deleteAll()">🗑️ Eliminar Registros</button>' : ''}
                    <button class="btn btn-primary" onclick="App.modules.prod_codigos.showCreateModal()">+ Nuevo Codigo</button>
                </div>` : ''}
            </div>

            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px">
                <div class="card" style="text-align:center"><div class="card-body">
                    <div style="font-size:28px;font-weight:700;color:var(--primary)" id="codTotal">0</div>
                    <div style="color:var(--text-light);font-size:13px">Total Codigos</div>
                </div></div>
                <div class="card" style="text-align:center"><div class="card-body">
                    <div style="font-size:28px;font-weight:700;color:var(--info)" id="codGrupos">0</div>
                    <div style="color:var(--text-light);font-size:13px">Grupos</div>
                </div></div>
                <div class="card" style="text-align:center"><div class="card-body">
                    <div style="font-size:28px;font-weight:700;color:var(--success)" id="codFamilias">0</div>
                    <div style="color:var(--text-light);font-size:13px">Familias</div>
                </div></div>
                <div class="card" style="text-align:center"><div class="card-body">
                    <div style="font-size:28px;font-weight:700;color:var(--warning)" id="codBloques">0</div>
                    <div style="color:var(--text-light);font-size:13px">Con Bloqueo Tela</div>
                </div></div>
            </div>

            <div class="card">
                <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                    <h3 style="margin:0">Listado de Codigos</h3>
                    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                        <select class="form-control" id="codFilterGrupo" style="width:auto;min-width:140px;font-size:12px;padding:4px 8px" onchange="App.modules.prod_codigos.filter()">
                            <option value="">Todos los grupos</option>
                        </select>
                        <select class="form-control" id="codFilterFamilia" style="width:auto;min-width:140px;font-size:12px;padding:4px 8px" onchange="App.modules.prod_codigos.filter()">
                            <option value="">Todas las familias</option>
                        </select>
                        <input type="text" class="form-control" id="codFilterSearch" placeholder="Buscar codigo, grupo..." oninput="App.modules.prod_codigos.filter()" style="width:200px;font-size:12px;padding:4px 8px">
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
                    <div class="modal-header"><h3>Nuevo Codigo</h3><button class="modal-close" onclick="App.modules.prod_codigos.hideCreateModal()">&times;</button></div>
                    <div class="modal-body">
                        <div class="form-group"><label>Codigo SAP *</label><input class="form-control" id="codCodigo" placeholder="Ej: V659, 100, P123"></div>
                        <div class="form-group"><label>Descripcion</label><input class="form-control" id="codDescripcion" placeholder="Vidrio templado 10mm"></div>
                        <div class="form-group"><label>Grupo</label><input class="form-control" id="codGrupo" placeholder="Ej: TEMPLADO"></div>
                        <div class="form-group"><label>Familia</label><input class="form-control" id="codFamilia" placeholder="Ej: PINTADO, LAMINADO"></div>
                        <div class="form-group"><label>Bloqueo de Tela</label>
                            <select class="form-control" id="codBloqueo">
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
                    <div class="modal-header"><h3>Importar Codigos SAP</h3><button class="modal-close" onclick="App.modules.prod_codigos.hideImportModal()">&times;</button></div>
                    <div class="modal-body">
                        <div id="codImportArea" style="border:2px dashed #cbd5e1;border-radius:8px;padding:32px;text-align:center;cursor:pointer"
                             onclick="document.getElementById('codImportFile').click()">
                            <div style="font-size:32px;margin-bottom:8px">📊</div>
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

    async load() {
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const headers = { 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' };
            const res = await fetch('/api/produccion/codigos', { headers });
            this.codigos = await res.json();
            this.renderStats();
            this.populateFilters();
            this.renderTable(this.codigos);
        } catch(e) { console.error('Error loading codigos:', e); }
    },

    populateFilters() {
        const grupos = [...new Set(this.codigos.map(c => c.grupo).filter(Boolean))].sort();
        const familias = [...new Set(this.codigos.map(c => c.familia).filter(Boolean))].sort();
        const grupoSel = document.getElementById('codFilterGrupo');
        const familiaSel = document.getElementById('codFilterFamilia');
        if (grupoSel && !grupoSel._populated) {
            grupos.forEach(g => { const o = document.createElement('option'); o.value = g; o.textContent = g; grupoSel.appendChild(o); });
            grupoSel._populated = true;
        }
        if (familiaSel && !familiaSel._populated) {
            familias.forEach(f => { const o = document.createElement('option'); o.value = f; o.textContent = f; familiaSel.appendChild(o); });
            familiaSel._populated = true;
        }
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
        tbody.innerHTML = codigos.map(c => `<tr style="line-height:1.3">
            <td style="${td}"><strong>${c.codigo}</strong></td>
            <td style="${td}">${c.descripcion || '-'}</td>
            <td style="${td}">${c.grupo ? `<span style="padding:2px 8px;border-radius:4px;font-size:11px;background:#dbeafe;color:#1e40af">${c.grupo}</span>` : '-'}</td>
            <td style="${td}">${c.familia ? `<span style="padding:2px 8px;border-radius:4px;font-size:11px;background:#dcfce7;color:#166534">${c.familia}</span>` : '-'}</td>
            <td style="${td}">${c.bloqueo_tela ? '<span style="padding:2px 8px;border-radius:4px;font-size:11px;background:#fee2e2;color:#991b1b">Si</span>' : '<span style="padding:2px 8px;border-radius:4px;font-size:11px;background:#f1f5f9;color:#64748b">No</span>'}</td>
            <td style="${td};font-size:12px;color:var(--text-light)">${fmtDate(c.created_at)}</td>
            <td style="${td}">${puedeEditar ? `<button class="btn btn-sm btn-outline" style="color:#ef4444;border-color:#ef4444;padding:2px 8px;font-size:11px" onclick="App.modules.prod_codigos.delete(${c.id})">Eliminar</button>` : ''}</td>
        </tr>`).join('');
    },

    filter() {
        const search = (document.getElementById('codFilterSearch')?.value || '').toLowerCase();
        const grupo = document.getElementById('codFilterGrupo')?.value || '';
        const familia = document.getElementById('codFilterFamilia')?.value || '';
        let filtered = this.codigos;
        if (grupo) filtered = filtered.filter(c => c.grupo === grupo);
        if (familia) filtered = filtered.filter(c => c.familia === familia);
        if (search) {
            filtered = filtered.filter(c =>
                (c.codigo || '').toLowerCase().includes(search) ||
                (c.descripcion || '').toLowerCase().includes(search) ||
                (c.grupo || '').toLowerCase().includes(search) ||
                (c.familia || '').toLowerCase().includes(search) ||
                (c.bloqueo_tela ? 'si' : 'no').includes(search)
            );
        }
        this.renderTable(filtered);
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
