App.registerModule('prod_recetas', {
    recetas: [],

    async render() {
        const el = document.getElementById('page-prod_recetas');
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const permisos = user.permisos || [];
        const puedeEditar = permisos.includes('usuarios') || permisos.includes('produccion');

        el.innerHTML = `
            <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:8px 16px;margin-bottom:20px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">
<div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
<div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center"><div><h2 style="margin:0;font-size:15px;font-weight:800;color:white;letter-spacing:-0.5px">Recetas BOM</h2>
<p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Explosion de materiales - Mapeo de codigos compuestos SAP</p></div>
${puedeEditar ? `
<div style="display:flex;gap:8px">
                    <button style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:rgba(255,255,255,0.15);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.25);border-radius:10px;color:white;font-size:13px;font-weight:600;cursor:pointer" onclick="App.modules.prod_recetas.importarExcel()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Importar Excel</button>
                    <button style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:rgba(255,255,255,0.15);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.25);border-radius:10px;color:white;font-size:13px;font-weight:600;cursor:pointer" onclick="App.modules.prod_recetas.exportarExcel()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Exportar Excel</button>
                    ${permisos.includes('usuarios') ? '<button style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:rgba(255,255,255,0.15);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.25);border-radius:10px;color:white;font-size:13px;font-weight:600;cursor:pointer" onclick="App.modules.prod_recetas.deleteAll()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Eliminar Registros</button>' : ''}
                    <button style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:rgba(255,255,255,0.15);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.25);border-radius:10px;color:white;font-size:13px;font-weight:600;cursor:pointer" onclick="App.modules.prod_recetas.showCreateModal()">+ Nueva Receta</button>
                </div>` : ''}
</div></div>

<style>
@keyframes prec_fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.prec-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}
.prec-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important;transform:translateY(-3px)}
.prec-row{transition:all 0.2s}
.prec-row:hover{transform:translateX(2px);background:#f8fafc!important}
</style>

            <div class="card prec-card">
                <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                    <h3 style="margin:0">Listado de Recetas</h3>
                    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                        <select class="form-control" id="recFilterGrupo" style="width:auto;min-width:140px;font-size:12px;padding:4px 8px" onchange="App.modules.prod_recetas.filter()" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
                            <option value="">Todos los grupos</option>
                        </select>
                        <select class="form-control" id="recFilterFamilia" style="width:auto;min-width:140px;font-size:12px;padding:4px 8px" onchange="App.modules.prod_recetas.filter()" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
                            <option value="">Todas las familias</option>
                        </select>
                        <input type="text" class="form-control" id="recFilterSearch" placeholder="Buscar codigo..." oninput="App.modules.prod_recetas.filter()" style="width:200px;font-size:12px;padding:4px 8px" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
                    </div>
                </div>
                <div class="card-body" style="padding:0">
                    <table style="font-size:13px"><thead><tr>
                        <th style="padding:6px 12px">Materia Prima</th><th style="padding:6px 12px">Descripcion</th><th style="padding:6px 12px">Espesor</th><th style="padding:6px 12px">Cantidad</th><th style="padding:6px 12px">Acciones</th>
                    </tr></thead><tbody id="recTable">
                        <tr><td colspan="5" style="text-align:center;padding:24px;color:#64748b">Cargando...</td></tr>
                    </tbody></table>
                </div>
            </div>

            <div class="modal-overlay" id="recCreateModal">
                <div class="modal" style="max-width:500px">
                    <div class="modal-header"><h3 id="recModalTitle">Nueva Receta BOM</h3><button class="modal-close" onclick="App.modules.prod_recetas.hideCreateModal()">&times;</button></div>
                    <div class="modal-body">
                        <div class="form-group"><label>Codigo SAP Padre *</label><input class="form-control" id="recCodigoPadre" placeholder="Ej: 500 (Termopanel)" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
                        <div class="form-group"><label>Codigo Materia Prima *</label><input class="form-control" id="recCodigoMP" placeholder="Ej: VID-4MM" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
                        <div class="form-group"><label>Descripcion</label><input class="form-control" id="recDescripcion" placeholder="Vidrio 4mm templado" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                            <div class="form-group"><label>Espesor (mm)</label><input class="form-control" id="recEspesor" type="number" value="4" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
                            <div class="form-group"><label>Cantidad</label><input class="form-control" id="recCantidad" type="number" value="1" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
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
                            <div style="font-size:32px;margin-bottom:8px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>
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
            const [recRes, codRes] = await Promise.all([
                fetch('/api/produccion/recetas', { headers }),
                fetch('/api/produccion/codigos', { headers })
            ]);
            this.recetas = await recRes.json();
            this.codigos = await codRes.json();
            this.populateFilters();
            this.renderTable(this.recetas);
        } catch(e) { console.error('Error loading recetas:', e); }
    },

    renderTable(recetas) {
        const tbody = document.getElementById('recTable');
        if (!recetas.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:#64748b">No hay recetas BOM creadas</td></tr>'; return; }
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const puedeEditar = user.permisos?.includes('usuarios') || user.permisos?.includes('produccion');

        // Agrupar por codigo padre
        const grupos = {};
        recetas.forEach(r => {
            if (!grupos[r.codigo_sap_padre]) grupos[r.codigo_sap_padre] = [];
            grupos[r.codigo_sap_padre].push(r);
        });

        const getDesc = (codigo) => {
            const c = (this.codigos || []).find(x => String(x.codigo) === String(codigo));
            return c && c.descripcion ? c.descripcion : '';
        };

        let html = '';
        for (const [padre, items] of Object.entries(grupos)) {
            const desc = getDesc(padre);
            html += `<tr class="prec-row" style="background:#f8fafc;line-height:1.3"><td colspan="5" style="padding:6px 12px"><strong style="color:var(--primary)">Codigo: ${padre}</strong> ${desc ? `<span style="font-size:12px;color:var(--text)"> - ${desc}</span>` : ''} <span style="font-size:11px;color:var(--text-light)">(${items.length} componentes)</span></td></tr>`;
            items.forEach(r => {
                html += `<tr class="prec-row" style="line-height:1.3">
                    <td style="padding:6px 12px"><strong>${r.codigo_materia_prima}</strong></td>
                    <td style="padding:6px 12px">${r.descripcion || '-'}</td>
                    <td style="padding:6px 12px">${r.espesor}mm</td>
                    <td style="padding:6px 12px">${r.cantidad}</td>
                    <td style="padding:6px 12px">${puedeEditar ? `<button class="btn btn-sm btn-outline" style="color:#ef4444;border-color:#ef4444;padding:2px 8px;font-size:11px" onclick="App.modules.prod_recetas.delete(${r.id})">Eliminar</button>` : ''}</td>
                </tr>`;
            });
        }
        tbody.innerHTML = html;
    },

    populateFilters() {
        const grupos = [...new Set((this.codigos || []).map(c => c.grupo).filter(Boolean))].sort();
        const familias = [...new Set((this.codigos || []).map(c => c.familia).filter(Boolean))].sort();
        const grupoSel = document.getElementById('recFilterGrupo');
        const familiaSel = document.getElementById('recFilterFamilia');
        if (grupoSel && !grupoSel._populated) {
            grupos.forEach(g => { const o = document.createElement('option'); o.value = g; o.textContent = g; grupoSel.appendChild(o); });
            grupoSel._populated = true;
        }
        if (familiaSel && !familiaSel._populated) {
            familias.forEach(f => { const o = document.createElement('option'); o.value = f; o.textContent = f; familiaSel.appendChild(o); });
            familiaSel._populated = true;
        }
    },

    filter() {
        const search = (document.getElementById('recFilterSearch')?.value || '').toLowerCase();
        const grupo = document.getElementById('recFilterGrupo')?.value || '';
        const familia = document.getElementById('recFilterFamilia')?.value || '';
        let filtered = this.recetas;
        if (grupo || familia) {
            const codigosFiltrados = (this.codigos || []).filter(c => {
                if (grupo && c.grupo !== grupo) return false;
                if (familia && c.familia !== familia) return false;
                return true;
            }).map(c => String(c.codigo));
            filtered = filtered.filter(r => codigosFiltrados.includes(String(r.codigo_sap_padre)));
        }
        if (search) {
            filtered = filtered.filter(r =>
                (r.codigo_sap_padre || '').toLowerCase().includes(search) ||
                (r.codigo_materia_prima || '').toLowerCase().includes(search) ||
                (r.descripcion || '').toLowerCase().includes(search)
            );
        }
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

    async deleteAll() {
        if (!confirm('ELIMINAR TODAS las recetas BOM? Esta accion no se puede deshacer.')) return;
        if (!confirm('Seguro? Se borrarán TODOS los registros.')) return;
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const res = await fetch('/api/produccion/recetas/all', {
                method: 'DELETE', headers: { 'X-User-Email': user.email || '' }
            });
            const data = await res.json();
            if (res.ok) {
                App.toast(`${data.eliminados} recetas eliminadas`);
                await this.load();
            } else { alert(data.error || 'Error al eliminar'); }
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
