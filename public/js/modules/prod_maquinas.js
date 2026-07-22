App.registerModule('prod_maquinas', {
    maquinas: [],

    async render() {
        const el = document.getElementById('page-prod_maquinas');
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const permisos = user.permisos || [];
        const esAdmin = permisos.includes('usuarios');
        const puedeEditar = esAdmin || permisos.includes('produccion');

        el.innerHTML = `
            <div class="page-header">
                <div>
                    <h2 style="margin:0">Maquinas</h2>
                    <div class="subtitle">Capacidad de producción por máquina (m²/día)</div>
                </div>
                ${puedeEditar ? `<div style="display:flex;gap:8px">
                    <button class="btn btn-primary" onclick="App.modules.prod_maquinas.showCreateModal()">+ Nueva Maquina</button>
                    <button class="btn btn-success" onclick="App.modules.prod_maquinas.showImportModal()">📥 Importar Excel</button>
                </div>` : ''}
            </div>

            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px">
                <div class="card" style="text-align:center"><div class="card-body">
                    <div style="font-size:28px;font-weight:700;color:var(--primary)" id="mqTotal">0</div>
                    <div style="color:var(--text-light);font-size:13px">Total Maquinas</div>
                </div></div>
                <div class="card" style="text-align:center"><div class="card-body">
                    <div style="font-size:28px;font-weight:700;color:var(--success)" id="mqActivas">0</div>
                    <div style="color:var(--text-light);font-size:13px">Activas</div>
                </div></div>
                <div class="card" style="text-align:center"><div class="card-body">
                    <div style="font-size:28px;font-weight:700;color:var(--warning)" id="mqCapacidad">0</div>
                    <div style="color:var(--text-light);font-size:13px">Total m²/día</div>
                </div></div>
            </div>

            <div class="card">
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
                    <div class="modal-header"><h3 id="mqModalTitle">Nueva Maquina</h3><button class="modal-close" onclick="App.modules.prod_maquinas.hideCreateModal()">&times;</button></div>
                    <div class="modal-body">
                        <div class="form-group"><label>Nombre *</label><input class="form-control" id="mqNombre" placeholder="Ej: Cortadora CNC"></div>
                        <div class="form-group"><label>Codigo *</label><input class="form-control" id="mqCodigo" placeholder="Ej: COR-01"></div>
                        <div class="form-group"><label>Tipo Proceso</label><input class="form-control" id="mqTipoProceso" placeholder="Ej: Corte, Pulido"></div>
                        <div class="form-group"><label>N° Operacion</label><input class="form-control" id="mqNumOp" type="number" min="0"></div>
                        <div class="form-group"><label>Capacidad Maxima m²/dia</label><input class="form-control" id="mqCapacidadInput" type="number" step="0.01" value="50"></div>
                        <div class="form-group"><label>Estado</label>
                            <select class="form-control" id="mqEstado">
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
        const capacidad = this.maquinas.filter(m => m.estado === 'ACTIVA').reduce((s, m) => s + Number(m.capacidad_max_m2_dia || 0), 0);
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('mqTotal', total);
        set('mqActivas', activas);
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
        tbody.innerHTML = this.maquinas.map(m => `<tr style="line-height:1.3">
            <td style="${td}"><strong>${m.codigo}</strong></td>
            <td style="${td}">${m.nombre}</td>
            <td style="${td}">${m.tipo_proceso || '-'}</td>
            <td style="${td}">${m.num_operacion || '-'}</td>
            <td style="${td}">${estadoBadge(m.estado)}</td>
            <td style="${td}"><strong>${Number(m.capacidad_max_m2_dia).toFixed(1)}</strong></td>
            <td style="${td}">
                ${puedeEditar ? `<button class="btn btn-sm btn-outline" onclick="App.modules.prod_maquinas.edit(${m.id})">Editar</button>
                <button class="btn btn-sm btn-outline" style="margin-left:4px;color:#ef4444;border-color:#ef4444" onclick="App.modules.prod_maquinas.delete(${m.id})">Eliminar</button>` : ''}
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
                    <div class="modal-header"><h3>Importar Maquinas desde Excel</h3><button class="modal-close" onclick="App.modules.prod_maquinas.hideImportModal()">&times;</button></div>
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
