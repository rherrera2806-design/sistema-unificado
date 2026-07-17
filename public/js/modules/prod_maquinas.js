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
                ${puedeEditar ? '<button class="btn btn-primary" onclick="App.modules.prod_maquinas.showCreateModal()">+ Nueva Maquina</button>' : ''}
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
                    <table><thead><tr>
                        <th>Codigo</th><th>Nombre</th><th>Estado</th><th>Capacidad m²/dia</th><th>Acciones</th>
                    </tr></thead><tbody id="mqTable">
                        <tr><td colspan="5" style="text-align:center;padding:24px;color:#64748b">Cargando...</td></tr>
                    </tbody></table>
                </div>
            </div>

            <div class="modal-overlay" id="mqCreateModal">
                <div class="modal" style="max-width:450px">
                    <div class="modal-header"><h3 id="mqModalTitle">Nueva Maquina</h3><button class="modal-close" onclick="App.modules.prod_maquinas.hideCreateModal()">&times;</button></div>
                    <div class="modal-body">
                        <div class="form-group"><label>Nombre *</label><input class="form-control" id="mqNombre" placeholder="Ej: Cortadora CNC"></div>
                        <div class="form-group"><label>Codigo *</label><input class="form-control" id="mqCodigo" placeholder="Ej: COR-01"></div>
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
        if (!this.maquinas.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:#64748b">No hay maquinas registradas</td></tr>'; return; }
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const puedeEditar = user.permisos?.includes('usuarios') || user.permisos?.includes('produccion');
        const estadoBadge = (e) => {
            const cols = { ACTIVA: 'background:#dcfce7;color:#166534', INACTIVA: 'background:#f1f5f9;color:#64748b', MANTENCION: 'background:#fef9c3;color:#854d0e' };
            return `<span style="padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;${cols[e] || ''}">${e}</span>`;
        };
        tbody.innerHTML = this.maquinas.map(m => `<tr>
            <td><strong>${m.codigo}</strong></td>
            <td>${m.nombre}</td>
            <td>${estadoBadge(m.estado)}</td>
            <td><strong>${Number(m.capacidad_max_m2_dia).toFixed(1)}</strong></td>
            <td>
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
        document.getElementById('mqCapacidadInput').value = m.capacidad_max_m2_dia;
        document.getElementById('mqEstado').value = m.estado;
        document.getElementById('mqCreateModal').classList.add('show');
    },

    hideCreateModal() { document.getElementById('mqCreateModal').classList.remove('show'); },

    async save() {
        const nombre = document.getElementById('mqNombre').value.trim();
        const codigo = document.getElementById('mqCodigo').value.trim();
        const capacidad = Number(document.getElementById('mqCapacidadInput').value) || 0;
        const estado = document.getElementById('mqEstado').value;
        if (!nombre || !codigo) { alert('Nombre y codigo requeridos'); return; }
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const headers = { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' };
            if (this.editingId) {
                await fetch(`/api/produccion/maquinas/${this.editingId}`, { method: 'PUT', headers, body: JSON.stringify({ nombre, codigo, capacidad_max_m2_dia: capacidad, estado }) });
            } else {
                await fetch('/api/produccion/maquinas', { method: 'POST', headers, body: JSON.stringify({ nombre, codigo, capacidad_max_m2_dia: capacidad, estado }) });
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
    }
});
