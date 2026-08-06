App.registerModule('prod_maquinas', {
    maquinas: [],

    async render() {
        const el = document.getElementById('page-prod_maquinas');
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const permisos = user.permisos || [];
        const esAdmin = permisos.includes('usuarios');
        const puedeEditar = esAdmin || permisos.includes('produccion');

        el.innerHTML = `
            <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:8px 16px;margin-bottom:20px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">
<div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
<div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center"><div><h2 style="margin:0;font-size:15px;font-weight:800;color:white;letter-spacing:-0.5px">Maquinas de Produccion</h2>
<p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Capacidad de produccion por maquina (m2/dia)</p></div>
${puedeEditar ? `
<div style="display:flex;gap:8px">
                    <button style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:rgba(255,255,255,0.15);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.25);border-radius:10px;color:white;font-size:13px;font-weight:600;cursor:pointer" onclick="App.modules.prod_maquinas.showCreateModal()"> Nueva Maquina</button>
                    <button style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:rgba(255,255,255,0.15);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.25);border-radius:10px;color:white;font-size:13px;font-weight:600;cursor:pointer" onclick="App.modules.prod_maquinas.showImportModal()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Importar Excel</button>
                </div>` : ''}
</div></div>

<style>
@keyframes pmq_fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.pmq-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}
.pmq-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important;transform:translateY(-3px)}
.pmq-row{transition:all 0.2s}
.pmq-row:hover{transform:translateX(2px);background:#f8fafc!important}
</style>

            <div class="stats-grid" style="margin-bottom:14px">
                <div class="stat-card dash-card" style="border-left:4px solid #3b82f6">
                    <div class="stat-icon blue"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Total Maquinas</p><p class="stat-sub">Registradas en sistema</p></div>
                    <div class="stat-value" id="mqTotal">0</div>
                </div>
                <div class="stat-card dash-card" style="border-left:4px solid #22c55e">
                    <div class="stat-icon green"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" style="vertical-align:-2px"><polyline points="20 6 9 17 4 12"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Activas</p><p class="stat-sub">En operacion</p></div>
                    <div class="stat-value" id="mqActivas">0</div>
                </div>
                <div class="stat-card dash-card" style="border-left:4px solid #f59e0b">
                    <div class="stat-icon orange"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></div>
                    <div class="stat-info"><p class="stat-label">En Mantencion</p><p class="stat-sub">Fuera de servicio</p></div>
                    <div class="stat-value" id="mqMantencion">0</div>
                </div>
                <div class="stat-card dash-card" style="border-left:4px solid #8b5cf6">
                    <div class="stat-icon" style="background:#f3e8ff;color:#7c3aed"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Capacidad Total</p><p class="stat-sub">m²/dia (activas)</p></div>
                    <div class="stat-value" id="mqCapacidad">0</div>
                </div>
            </div>

            <div class="card pmq-card">
                <div class="card-header"><h3 style="margin:0">Listado de Maquinas</h3></div>
                <div class="card-body" style="padding:0">
                    <table style="font-size:13px"><thead><tr>
                        <th style="padding:6px 12px">Codigo</th><th style="padding:6px 12px">Nombre</th><th style="padding:6px 12px">Tipo Proceso</th><th style="padding:6px 12px">N° Op</th><th style="padding:6px 12px">Estado</th><th style="padding:6px 12px">Capacidad m²/dia</th><th style="padding:6px 12px">Acciones</th>
                    </tr></thead><tbody id="mqTable">
                        <tr><td colspan="7" style="text-align:center;padding:24px;color:#64748b">Cargando...</td></tr>
                    </tbody></table>
                </div>
            </div>

            <div class="modal-overlay" id="mqCreateModal">
                <div class="modal" style="max-width:450px">
                    <div class="modal-header"><h3 id="mqModalTitle">Nueva Maquina</h3><button class="modal-close" title="Cerrar" onclick="App.modules.prod_maquinas.hideCreateModal()">&times;</button></div>
                    <div class="modal-body">
                        <div class="form-group"><label>Nombre *</label><input class="form-control" id="mqNombre" placeholder="Ej: Cortadora CNC" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
                        <div class="form-group"><label>Codigo *</label><input class="form-control" id="mqCodigo" placeholder="Ej: COR-01" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
                        <div class="form-group"><label>Tipo Proceso</label><input class="form-control" id="mqTipoProceso" placeholder="Ej: Corte, Pulido" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
                        <div class="form-group"><label>N° Operacion</label><input class="form-control" id="mqNumOp" type="number" min="0" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
                        <div class="form-group"><label>Capacidad Maxima m²/dia</label><input class="form-control" id="mqCapacidadInput" type="number" step="0.01" value="50" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
                        <div class="form-group"><label>Estado</label>
                            <select class="form-control" id="mqEstado" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
                                <option value="ACTIVA">Activa</option>
                                <option value="INACTIVA">Inactiva</option>
                                <option value="MANTENCION">En Mantencion</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="App.modules.prod_maquinas.hideCreateModal()">Cancelar</button>
                        <button class="btn btn-primary" onclick="App.modules.prod_maquinas.save()">Guardar</button>
                    </div>
                </div>
            </div>
        `;
        await this.load();
    },

    async load() {
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const headers = { 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' };
            const res = await fetch('/api/produccion/maquinas', { headers });
            this.maquinas = await res.json();
            this.maquinas.sort((a, b) => (a.num_operacion || 9999) - (b.num_operacion || 9999) || a.nombre.localeCompare(b.nombre));
            this.renderStats();
            this.renderTable();
        } catch(e) { console.error('Error loading maquinas:', e); }
    },

    renderStats() {
        const total = this.maquinas.length;
        const activas = this.maquinas.filter(m => m.estado === 'ACTIVA').length;
        const mantencion = this.maquinas.filter(m => m.estado === 'MANTENCION').length;
        const capacidad = this.maquinas.filter(m => m.estado === 'ACTIVA').reduce((s, m) => s + Number(m.capacidad_max_m2_dia || 0), 0);
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('mqTotal', total);
        set('mqActivas', activas);
        set('mqMantencion', mantencion);
        set('mqCapacidad', capacidad.toFixed(1));
    },

    renderTable() {
        const tbody = document.getElementById('mqTable');
        if (!this.maquinas.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:#64748b">No hay maquinas registradas</td></tr>'; return; }
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const puedeEditar = user.permisos?.includes('usuarios') || user.permisos?.includes('produccion');
        const estadoBadge = (e) => {
            const cols = { ACTIVA: 'background:#dcfce7;color:#166534', INACTIVA: 'background:#f1f5f9;color:#64748b', MANTENCION: 'background:#fef9c3;color:#854d0e' };
            return `<span style="padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;${cols[e] || ''}">${e}</span>`;
        };
        const td = 'padding:6px 12px';
        tbody.innerHTML = this.maquinas.map(m => `<tr class="pmq-row" style="line-height:1.3">
            <td style="${td}"><strong>${m.codigo}</strong></td>
            <td style="${td}">${m.nombre}</td>
            <td style="${td}">${m.tipo_proceso || '-'}</td>
            <td style="${td}">${m.num_operacion || '-'}</td>
            <td style="${td}">${estadoBadge(m.estado)}</td>
            <td style="${td}"><strong>${Number(m.capacidad_max_m2_dia).toFixed(1)}</strong></td>
            <td style="${td}">
                ${puedeEditar ? `<button class="btn btn-sm btn-outline" title="Editar" onclick="App.modules.prod_maquinas.edit(${m.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                <button class="btn btn-sm btn-danger" title="Eliminar" style="margin-left:4px" onclick="App.modules.prod_maquinas.delete(${m.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>` : ''}
            </td>
        </tr>`).join('');
    },

    editingId: null,

    showCreateModal() {
        this.editingId = null;
        document.getElementById('mqModalTitle').textContent = 'Nueva Maquina';
        document.getElementById('mqNombre').value = '';
        document.getElementById('mqCodigo').value = '';
        document.getElementById('mqTipoProceso').value = '';
        document.getElementById('mqNumOp').value = '';
        document.getElementById('mqCapacidadInput').value = '50';
        document.getElementById('mqEstado').value = 'ACTIVA';
        document.getElementById('mqCreateModal').classList.add('show');
    },

    edit(id) {
        const m = this.maquinas.find(x => x.id === id);
        if (!m) return;
        this.editingId = id;
        document.getElementById('mqModalTitle').textContent = 'Editar Maquina';
        document.getElementById('mqNombre').value = m.nombre;
        document.getElementById('mqCodigo').value = m.codigo;
        document.getElementById('mqTipoProceso').value = m.tipo_proceso || '';
        document.getElementById('mqNumOp').value = m.num_operacion || '';
        document.getElementById('mqCapacidadInput').value = m.capacidad_max_m2_dia;
        document.getElementById('mqEstado').value = m.estado;
        document.getElementById('mqCreateModal').classList.add('show');
    },

    hideCreateModal() { document.getElementById('mqCreateModal').classList.remove('show'); },

    async save() {
        const nombre = document.getElementById('mqNombre').value.trim();
        const codigo = document.getElementById('mqCodigo').value.trim();
        const tipo_proceso = document.getElementById('mqTipoProceso').value.trim();
        const num_operacion = Number(document.getElementById('mqNumOp').value) || null;
        const capacidad = Number(document.getElementById('mqCapacidadInput').value) || 0;
        const estado = document.getElementById('mqEstado').value;
        if (!nombre || !codigo) { alert('Nombre y codigo requeridos'); return; }
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const headers = { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' };
            const data = { nombre, codigo, capacidad_max_m2_dia: capacidad, estado, tipo_proceso, num_operacion };
            if (this.editingId) {
                await fetch(`/api/produccion/maquinas/${this.editingId}`, { method: 'PUT', headers, body: JSON.stringify(data) });
            } else {
                await fetch('/api/produccion/maquinas', { method: 'POST', headers, body: JSON.stringify(data) });
            }
            this.hideCreateModal();
            App.toast(this.editingId ? 'Maquina actualizada' : 'Maquina creada');
            await this.load();
        } catch(e) { alert('Error: ' + e.message); }
    },

    async delete(id) {
        if (!confirm('Eliminar esta maquina?')) return;
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            await fetch(`/api/produccion/maquinas/${id}`, {
                method: 'DELETE', headers: { 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' }
            });
            App.toast('Maquina eliminada');
            await this.load();
        } catch(e) { alert('Error: ' + e.message); }
    },

    showImportModal() {
        let overlay = document.getElementById('mqImportModal');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'mqImportModal';
            overlay.className = 'modal-overlay';
            overlay.innerHTML = `
                <div class="modal" style="max-width:550px">
                    <div class="modal-header"><h3>Importar Maquinas desde Excel</h3><button class="modal-close" title="Cerrar" onclick="App.modules.prod_maquinas.hideImportModal()">&times;</button></div>
                    <div class="modal-body">
                        <p style="color:var(--text-light);font-size:13px;margin-bottom:12px">El archivo debe tener columnas: <strong>Codigo, Nombre, Tipo_proceso, n_operacion, capacidad_max_m2_dia, Estado</strong></p>
                        <p style="color:var(--text-light);font-size:12px;margin-bottom:16px">Los codigos duplicados seran omitidos. Estado puede ser: ACTIVA, INACTIVA, MANTENCION</p>
                        <input type="file" id="mqImportFile" accept=".xlsx,.xls,.csv" style="margin-bottom:12px" onchange="App.modules.prod_maquinas.previewImport(event)">
                        <div id="mqImportPreview" style="max-height:250px;overflow-y:auto"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="App.modules.prod_maquinas.hideImportModal()">Cancelar</button>
                        <button class="btn btn-success" id="mqImportBtn" onclick="App.modules.prod_maquinas.executeImport()" disabled>Importar</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
        }
        overlay.classList.add('show');
        this._importData = [];
        document.getElementById('mqImportFile').value = '';
        document.getElementById('mqImportPreview').innerHTML = '';
        document.getElementById('mqImportBtn').disabled = true;
    },

    hideImportModal() {
        const overlay = document.getElementById('mqImportModal');
        if (overlay) overlay.classList.remove('show');
        this._importData = [];
    },

    previewImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws);
                if (rows.length === 0) { alert('El archivo esta vacio'); return; }
                this._importData = rows.map(r => ({
                    codigo: (r.Codigo || r.codigo || r.CODIGO || r.Código || '').toString().trim(),
                    nombre: (r.Nombre || r.nombre || r.NOMBRE || '').toString().trim(),
                    tipo_proceso: (r.Tipo_proceso || r.tipo_proceso || r['Tipo proceso'] || '').toString().trim(),
                    num_operacion: Number(r.n_operacion || r.num_operacion || r['nº operación'] || r['n° operacion'] || 0) || null,
                    capacidad_max_m2_dia: Number(r.capacidad_max_m2_dia || r.capacidad || r.Capacidad || 0),
                    estado: (r.Estado || r.estado || r.ESTADO || 'ACTIVA').toString().trim().toUpperCase()
                })).filter(m => m.codigo && m.nombre);
                const preview = document.getElementById('mqImportPreview');
                preview.innerHTML = `<div style="margin-bottom:8px;font-size:13px"><strong>${this._importData.length}</strong> maquinas encontradas</div>
                    <table style="width:100%;font-size:12px"><thead><tr><th>Codigo</th><th>Nombre</th><th>Tipo Proceso</th><th>N° Op</th><th>Capacidad</th><th>Estado</th></tr></thead><tbody>
                    ${this._importData.slice(0, 20).map(m => `<tr><td>${m.codigo}</td><td>${m.nombre}</td><td>${m.tipo_proceso}</td><td>${m.num_operacion || '-'}</td><td>${m.capacidad_max_m2_dia}</td><td>${m.estado}</td></tr>`).join('')}
                    ${this._importData.length > 20 ? `<tr><td colspan="6" style="text-align:center;color:var(--text-light)">... y ${this._importData.length - 20} mas</td></tr>` : ''}
                    </tbody></table>`;
                document.getElementById('mqImportBtn').disabled = this._importData.length === 0;
            } catch(err) { alert('Error al leer el archivo: ' + err.message); }
        };
        reader.readAsArrayBuffer(file);
    },

    async executeImport() {
        if (!this._importData || this._importData.length === 0) return;
        const btn = document.getElementById('mqImportBtn');
        btn.disabled = true;
        btn.textContent = 'Importando...';
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const headers = { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' };
            const res = await fetch('/api/produccion/maquinas/import', { method: 'POST', headers, body: JSON.stringify({ maquinas: this._importData }) });
            const result = await res.json();
            if (res.ok) {
                App.toast(`Importados: ${result.inserted}, Omitidos: ${result.skipped}${result.errors.length ? ', Errores: ' + result.errors.length : ''}`);
                this.hideImportModal();
                await this.load();
            } else {
                alert('Error: ' + (result.error || 'Error desconocido'));
            }
        } catch(e) { alert('Error al importar: ' + e.message); }
        btn.disabled = false;
        btn.textContent = 'Importar';
    }
});
