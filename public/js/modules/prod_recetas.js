App.registerModule('prod_recetas', {
    recetas: [],

    async render() {
        const el = document.getElementById('page-prod_recetas');
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const permisos = user.permisos || [];
        const puedeEditar = permisos.includes('usuarios') || permisos.includes('produccion');

        el.innerHTML = `
            <div class="page-header">
                <div>
                    <h2 style="margin:0">Recetas BOM</h2>
                    <div class="subtitle">Explosion de materiales - Mapeo de codigos compuestos SAP</div>
                </div>
                ${puedeEditar ? `
                <div style="display:flex;gap:8px">
                    <button class="btn btn-outline" onclick="App.modules.prod_recetas.importarExcel()">📥 Importar Excel</button>
                    <button class="btn btn-outline" onclick="App.modules.prod_recetas.exportarExcel()">📤 Exportar Excel</button>
                    <button class="btn btn-primary" onclick="App.modules.prod_recetas.showCreateModal()">+ Nueva Receta</button>
                </div>` : ''}
            </div>

            <div class="card">
                <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
                    <h3 style="margin:0">Listado de Recetas</h3>
                    <input type="text" class="form-control" id="recFilterSearch" placeholder="Buscar codigo..." oninput="App.modules.prod_recetas.filter()" style="width:200px">
                </div>
                <div class="card-body" style="padding:0">
                    <table><thead><tr>
                        <th>Codigo Padre</th><th>Materia Prima</th><th>Descripcion</th><th>Espesor</th><th>Cantidad</th><th>Acciones</th>
                    </tr></thead><tbody id="recTable">
                        <tr><td colspan="6" style="text-align:center;padding:24px;color:#64748b">Cargando...</td></tr>
                    </tbody></table>
                </div>
            </div>

            <div class="modal-overlay" id="recCreateModal">
                <div class="modal" style="max-width:500px">
                    <div class="modal-header"><h3 id="recModalTitle">Nueva Receta BOM</h3><button class="modal-close" onclick="App.modules.prod_recetas.hideCreateModal()">&times;</button></div>
                    <div class="modal-body">
                        <div class="form-group"><label>Codigo SAP Padre *</label><input class="form-control" id="recCodigoPadre" placeholder="Ej: 500 (Termopanel)"></div>
                        <div class="form-group"><label>Codigo Materia Prima *</label><input class="form-control" id="recCodigoMP" placeholder="Ej: VID-4MM"></div>
                        <div class="form-group"><label>Descripcion</label><input class="form-control" id="recDescripcion" placeholder="Vidrio 4mm templado"></div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                            <div class="form-group"><label>Espesor (mm)</label><input class="form-control" id="recEspesor" type="number" value="4"></div>
                            <div class="form-group"><label>Cantidad</label><input class="form-control" id="recCantidad" type="number" value="1"></div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="App.modules.prod_recetas.hideCreateModal()">Cancelar</button>
                        <button class="btn btn-primary" onclick="App.modules.prod_recetas.save()">Guardar</button>
                    </div>
                </div>
            </div>

            <div class="modal-overlay" id="recImportModal">
                <div class="modal" style="max-width:500px">
                    <div class="modal-header"><h3>Importar Recetas BOM</h3><button class="modal-close" onclick="App.modules.prod_recetas.hideImportModal()">&times;</button></div>
                    <div class="modal-body">
                        <div id="recImportArea" style="border:2px dashed #cbd5e1;border-radius:8px;padding:32px;text-align:center;cursor:pointer;transition:all .2s"
                             onclick="document.getElementById('recImportFile').click()">
                            <div style="font-size:32px;margin-bottom:8px">📊</div>
                            <div style="color:var(--text-light)">Arrastra un Excel o haz clic para seleccionar</div>
                            <div id="recImportName" style="color:var(--success);font-weight:500;margin-top:8px;display:none"></div>
                        </div>
                        <input type="file" id="recImportFile" accept=".xlsx,.xls,.csv" style="display:none" onchange="App.modules.prod_recetas.handleImportFile(event)">
                        <div style="background:#f8fafc;border-radius:8px;padding:12px;margin-top:12px;font-size:12px;color:var(--text-light)">
                            <strong>Columnas esperadas:</strong><br>
                            CodigoPadre, CodigoMateriaPrima, Descripcion, Espesor, Cantidad
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="App.modules.prod_recetas.hideImportModal()">Cancelar</button>
                        <button class="btn btn-primary" id="recImportBtn" onclick="App.modules.prod_recetas.doImport()" disabled>Importar</button>
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
            const res = await fetch('/api/produccion/recetas', { headers });
            this.recetas = await res.json();
            this.renderTable(this.recetas);
        } catch(e) { console.error('Error loading recetas:', e); }
    },

    renderTable(recetas) {
        const tbody = document.getElementById('recTable');
        if (!recetas.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#64748b">No hay recetas BOM creadas</td></tr>'; return; }
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const puedeEditar = user.permisos?.includes('usuarios') || user.permisos?.includes('produccion');

        // Agrupar por codigo padre
        const grupos = {};
        recetas.forEach(r => {
            if (!grupos[r.codigo_sap_padre]) grupos[r.codigo_sap_padre] = [];
            grupos[r.codigo_sap_padre].push(r);
        });

        let html = '';
        for (const [padre, items] of Object.entries(grupos)) {
            html += `<tr style="background:#f8fafc"><td colspan="6"><strong style="color:var(--primary)">Codigo: ${padre}</strong> <span style="font-size:11px;color:var(--text-light)">(${items.length} componentes)</span></td></tr>`;
            items.forEach(r => {
                html += `<tr>
                    <td></td>
                    <td><strong>${r.codigo_materia_prima}</strong></td>
                    <td>${r.descripcion || '-'}</td>
                    <td>${r.espesor}mm</td>
                    <td>${r.cantidad}</td>
                    <td>${puedeEditar ? `<button class="btn btn-sm btn-outline" style="color:#ef4444;border-color:#ef4444" onclick="App.modules.prod_recetas.delete(${r.id})">Eliminar</button>` : ''}</td>
                </tr>`;
            });
        }
        tbody.innerHTML = html;
    },

    filter() {
        const search = (document.getElementById('recFilterSearch')?.value || '').toLowerCase();
        if (!search) { this.renderTable(this.recetas); return; }
        const filtered = this.recetas.filter(r => (r.codigo_sap_padre || '').toLowerCase().includes(search) || (r.codigo_materia_prima || '').toLowerCase().includes(search) || (r.descripcion || '').toLowerCase().includes(search));
        this.renderTable(filtered);
    },

    editingId: null,

    showCreateModal() {
        this.editingId = null;
        document.getElementById('recModalTitle').textContent = 'Nueva Receta BOM';
        document.getElementById('recCodigoPadre').value = '';
        document.getElementById('recCodigoMP').value = '';
        document.getElementById('recDescripcion').value = '';
        document.getElementById('recEspesor').value = '4';
        document.getElementById('recCantidad').value = '1';
        document.getElementById('recCreateModal').classList.add('show');
    },

    hideCreateModal() { document.getElementById('recCreateModal').classList.remove('show'); },

    async save() {
        const codigo_sap_padre = document.getElementById('recCodigoPadre').value.trim();
        const codigo_materia_prima = document.getElementById('recCodigoMP').value.trim();
        const descripcion = document.getElementById('recDescripcion').value.trim();
        const espesor = Number(document.getElementById('recEspesor').value) || 0;
        const cantidad = Number(document.getElementById('recCantidad').value) || 1;
        if (!codigo_sap_padre || !codigo_materia_prima) { alert('Codigos requeridos'); return; }
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            await fetch('/api/produccion/recetas', {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' },
                body: JSON.stringify({ codigo_sap_padre, codigo_materia_prima, descripcion, espesor, cantidad })
            });
            this.hideCreateModal();
            App.toast('Receta BOM creada');
            await this.load();
        } catch(e) { alert('Error: ' + e.message); }
    },

    async delete(id) {
        if (!confirm('Eliminar esta receta BOM?')) return;
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            await fetch(`/api/produccion/recetas/${id}`, {
                method: 'DELETE', headers: { 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' }
            });
            App.toast('Receta eliminada');
            await this.load();
        } catch(e) { alert('Error: ' + e.message); }
    },

    setupDragDrop() {
        const area = document.getElementById('recImportArea');
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
        document.getElementById('recImportName').textContent = file.name;
        document.getElementById('recImportName').style.display = 'block';
        document.getElementById('recImportBtn').disabled = false;
    },

    importarExcel() { document.getElementById('recImportModal').classList.add('show'); this.selectedImportFile = null; },
    hideImportModal() { document.getElementById('recImportModal').classList.remove('show'); this.selectedImportFile = null; document.getElementById('recImportName').style.display = 'none'; document.getElementById('recImportBtn').disabled = true; },

    async doImport() {
        if (!this.selectedImportFile) return;
        const btn = document.getElementById('recImportBtn');
        btn.textContent = 'Procesando...';
        btn.disabled = true;
        try {
            const data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    try {
                        const wb = XLSX.read(reader.result, { type: 'array' });
                        const ws = wb.Sheets[wb.SheetNames[0]];
                        resolve(XLSX.utils.sheet_to_json(ws));
                    } catch(e) { reject(e); }
                };
                reader.onerror = () => reject(new Error('Error al leer archivo'));
                reader.readAsArrayBuffer(this.selectedImportFile);
            });
            if (!data.length) { alert('El archivo esta vacio'); btn.textContent = 'Importar'; btn.disabled = false; return; }
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const headers = { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' };
            const res = await fetch('/api/produccion/recetas/importar', {
                method: 'POST',
                headers,
                body: JSON.stringify({ rows: data })
            });
            const result = await res.json();
            if (res.ok) {
                App.toast(`Importadas: ${result.importadas} recetas. Errores: ${result.errores?.length || 0}`);
                this.hideImportModal();
                await this.load();
            } else { alert(result.error || 'Error al importar'); }
        } catch(e) { alert('Error: ' + e.message); }
        btn.textContent = 'Importar';
        btn.disabled = false;
    },

    exportarExcel() {
        if (!this.recetas.length) { alert('No hay recetas para exportar'); return; }
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const rows = this.recetas.map(r => ({
            'CodigoPadre': r.codigo_sap_padre,
            'CodigoMateriaPrima': r.codigo_materia_prima,
            'Descripcion': r.descripcion || '',
            'Espesor': r.espesor || 0,
            'Cantidad': r.cantidad || 1
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Recetas BOM');
        XLSX.writeFile(wb, 'recetas_bom_export.xlsx');
        App.toast('Archivo exportado: recetas_bom_export.xlsx');
    }
});
