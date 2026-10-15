App.registerModule('prod_maquinas', {
    maquinas: [],

    async render() {
        const el = document.getElementById('page-prod_maquinas');
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const permisos = user.permisos || [];
        const esAdmin = permisos.includes('usuarios');
        const puedeEditar = esAdmin || permisos.includes('produccion');

        el.innerHTML = `
            <style>
                .maq-amenu{position:relative;display:inline-block}
                .maq-amenu-btn{padding:6px 11px;border-radius:7px;border:1px solid #e4e9f0;background:#fff;color:#475569;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap}
                .maq-amenu-btn:hover{background:#f8fafc}
                .maq-amenu-drop{display:none;position:fixed;z-index:95;background:#fff;border:1px solid #e4e9f0;border-radius:10px;box-shadow:0 12px 32px rgba(15,23,42,.16);min-width:190px;padding:5px}
                .maq-amenu-drop .it{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:7px;font-size:11px;font-weight:600;color:#475569;cursor:pointer;white-space:nowrap}
                .maq-amenu-drop .it:hover{background:#f8fafc}
                .maq-amenu-drop .it.danger{color:#dc2626}
                .maq-amenu-drop .sep{height:1px;background:#e4e9f0;margin:5px 8px}
            </style>
            <div class="m-page">
                <div class="m-hero" style="padding:10px 14px">
                    <div style="position:relative;z-index:1">
                        <h2 style="margin:0;font-size:15px;font-weight:800;color:white">Maquinas de Produccion</h2>
                    </div>
                </div>

                <div class="m-actions">
                    ${puedeEditar ? `
                        <button class="btn btn-accent" style="white-space:nowrap;padding:8px 14px;font-size:11px" onclick="App.modules.prod_maquinas.showCreateModal()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo</button>
                        <button class="btn btn-sm btn-outline" onclick="App.modules.prod_maquinas.showImportModal()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Importar</button>
                    ` : ''}
                </div>

                <div class="m-card">
                    <div class="m-card-header">
                        <h3 style="margin:0;font-size:13px">Listado <span style="color:#64748b;font-weight:400">(${this.maquinas.length})</span></h3>
                    </div>
                    <div class="m-card-body" style="padding:0">
                        <div class="m-table-wrap">
                            <table style="font-size:11px"><thead><tr>
                                <th>Codigo</th><th>Nombre</th><th>Estacion</th><th>Estado</th><th>Acciones</th>
                            </tr></thead><tbody id="mqTable">
                                <tr><td colspan="5" style="text-align:center;padding:24px;color:#64748b">Cargando...</td></tr>
                            </tbody></table>
                        </div>
                        <div class="m-cards-mobile" id="mqCardsMobile" style="display:none;padding:12px"></div>
                    </div>
                </div>
            </div>

            <div class="modal-overlay" id="mqCreateModal">
                <div class="modal" style="max-width:450px">
                    <div class="modal-header"><h3 id="mqModalTitle">Nueva Maquina</h3><button class="modal-close" title="Cerrar" onclick="App.modules.prod_maquinas.hideCreateModal()">&times;</button></div>
                    <div class="modal-body">
                        <div class="form-group"><label>Nombre *</label><input class="form-control" id="mqNombre" placeholder="Ej: Cortadora CNC"></div>
                        <div class="form-group"><label>Codigo *</label><input class="form-control" id="mqCodigo" placeholder="Ej: COR-01"></div>
                        <div class="form-group"><label>Estacion</label><select class="form-control" id="mqEstacion"><option value="">Sin estacion</option></select></div>
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
        this.loadEstaciones();
    },

    async loadEstaciones() {
        try {
            const res = await fetch('/api/produccion/estaciones');
            const estaciones = await res.json();
            const sel = document.getElementById('mqEstacion');
            if (sel) {
                sel.innerHTML = '<option value="">Sin estacion</option>' + estaciones.map(e => `<option value="${e.id}">${escText(e.nombre_estacion)}</option>`).join('');
            }
        } catch(e) {}
    },

    async load() {
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const headers = { 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' };
            const res = await fetch('/api/produccion/maquinas', { headers });
            this.maquinas = await res.json();
            this.renderTable();
        } catch(e) { console.error('Error loading maquinas:', e); }
    },

    renderTable() {
        const tbody = document.getElementById('mqTable');
        const cardsMobile = document.getElementById('mqCardsMobile');
        
        if (!this.maquinas.length) { 
            if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:#64748b">No hay maquinas registradas</td></tr>';
            if (cardsMobile) cardsMobile.innerHTML = '<div style="text-align:center;padding:24px;color:#64748b">No hay maquinas registradas</div>';
            return; 
        }
        
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const puedeEditar = user.permisos?.includes('usuarios') || user.permisos?.includes('produccion');
        const estadoBadge = (e) => {
            const cols = { ACTIVA: 'background:#dcfce7;color:#166534', INACTIVA: 'background:#f1f5f9;color:#64748b', MANTENCION: 'background:#fef9c3;color:#854d0e' };
            return `<span style="padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;${cols[e] || ''}">${escText(e)}</span>`;
        };
        const td = 'padding:6px 12px';
        
        if (tbody) {
            tbody.innerHTML = this.maquinas.map(m => `<tr style="line-height:1.3">
                <td style="${td}"><strong>${escText(m.codigo)}</strong></td>
                <td style="${td}">${escText(m.nombre)}</td>
                <td style="${td}">${escText(m.estacion_nombre || '-')}</td>
                <td style="${td}">${estadoBadge(m.estado)}</td>
                <td style="${td}">
                    ${puedeEditar ? this.menuAcciones(m.id) : ''}
                </td>
            </tr>`).join('');
        }
        
        if (cardsMobile) {
            cardsMobile.innerHTML = this.maquinas.map(m => {
                return `<div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:10px">
                    <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                        <div>
                            <div style="font-weight:700;font-size:13px">${escText(m.codigo)}</div>
                            <div style="font-size:11px;color:#64748b">${escText(m.nombre)}</div>
                        </div>
                        <div style="display:flex;gap:4px">
                            ${puedeEditar ? `
                                ${this.menuAcciones(m.id)}
                            ` : ''}
                        </div>
                    </div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
                        ${estadoBadge(m.estado)}
                        ${m.estacion_nombre ? `<span style="font-size:10px;color:#64748b">${escText(m.estacion_nombre)}</span>` : ''}
                    </div>
                </div>`;
            }).join('');
        }
    },

    editingId: null,

    showCreateModal() {
        this.editingId = null;
        document.getElementById('mqModalTitle').textContent = 'Nueva Maquina';
        document.getElementById('mqNombre').value = '';
        document.getElementById('mqCodigo').value = '';
        document.getElementById('mqEstacion').value = '';
        document.getElementById('mqEstado').value = 'ACTIVA';
        document.getElementById('mqCreateModal').classList.add('show');
    },

    // ── Menú de acciones (popover fijo, patrón del sistema) ──
    menuAcciones(id) {
        return `<div class="maq-amenu"><button class="maq-amenu-btn" onclick="App.modules.prod_maquinas.toggleAcciones(event)">Acciones ▾</button>
        <div class="maq-amenu-drop">
            <div class="it" onclick="App.modules.prod_maquinas.edit(${id})">✏️ Editar máquina</div>
            <div class="sep"></div>
            <div class="it danger" onclick="App.modules.prod_maquinas.delete(${id})">🗑 Eliminar máquina</div>
        </div></div>`;
    },
    toggleAcciones(e) {
        e.stopPropagation();
        this._setupMenus();
        const wrap = e.currentTarget.parentElement;
        const menu = wrap.querySelector('.maq-amenu-drop');
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
        document.querySelectorAll('.maq-amenu-drop').forEach(d => d.style.display = 'none');
    },
    _setupMenus() {
        if (this._menusBound) return;
        this._menusBound = true;
        document.addEventListener('click', () => this._cerrarMenus());
        window.addEventListener('scroll', () => this._cerrarMenus(), true);
        window.addEventListener('resize', () => this._cerrarMenus());
    },

    edit(id) {
        const m = this.maquinas.find(x => x.id === id);
        if (!m) return;
        this.editingId = id;
        document.getElementById('mqModalTitle').textContent = 'Editar Maquina';
        document.getElementById('mqNombre').value = m.nombre;
        document.getElementById('mqCodigo').value = m.codigo;
        document.getElementById('mqEstacion').value = m.estacion_id || '';
        document.getElementById('mqEstado').value = m.estado;
        document.getElementById('mqCreateModal').classList.add('show');
    },

    hideCreateModal() { document.getElementById('mqCreateModal').classList.remove('show'); },

    async save() {
        const nombre = document.getElementById('mqNombre').value.trim();
        const codigo = document.getElementById('mqCodigo').value.trim();
        const estado = document.getElementById('mqEstado').value;
        const estacion_id = document.getElementById('mqEstacion').value || null;
        if (!nombre || !codigo) { App.showAlert('Nombre y codigo requeridos', 'danger'); return; }
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const headers = { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' };
            const data = { nombre, codigo, estado, estacion_id };
            if (this.editingId) {
                await apiJson(await fetch(`/api/produccion/maquinas/${this.editingId}`, { method: 'PUT', headers, body: JSON.stringify(data) }));
            } else {
                await apiJson(await fetch('/api/produccion/maquinas', { method: 'POST', headers, body: JSON.stringify(data) }));
            }
            this.hideCreateModal();
            App.toast(this.editingId ? 'Máquina actualizada' : 'Máquina creada');
            await this.load();
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    async delete(id) {
        if (!(await App.confirm('¿Eliminar esta máquina?'))) return;
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            await apiJson(await fetch(`/api/produccion/maquinas/${id}`, {
                method: 'DELETE', headers: { 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' }
            }));
            App.toast('Máquina eliminada');
            await this.load();
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
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
                        <p style="color:var(--text-light);font-size:13px;margin-bottom:12px">El archivo debe tener columnas: <strong>Codigo, Nombre, Tipo_proceso, n_operacion, cap_max, Estado</strong></p>
                        <p style="color:var(--text-light);font-size:11px;margin-bottom:16px">Los codigos duplicados seran omitidos. Estado puede ser: ACTIVA, INACTIVA, MANTENCION</p>
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
                if (rows.length === 0) { App.showAlert('El archivo esta vacio', 'danger'); return; }
                this._importData = rows.map(r => ({
                    codigo: (r.Codigo || r.codigo || r.CODIGO || r.Código || '').toString().trim(),
                    nombre: (r.Nombre || r.nombre || r.NOMBRE || '').toString().trim(),
                    tipo_proceso: (r.Tipo_proceso || r.tipo_proceso || r['Tipo proceso'] || '').toString().trim(),
                    num_operacion: Number(r.n_operacion || r.num_operacion || r['nº operación'] || r['n° operacion'] || 0) || null,
                    cap_max: Number(r.cap_max || r.capacidad_max_m2_dia || r.capacidad || r.Capacidad || 0),
                    estado: (r.Estado || r.estado || r.ESTADO || 'ACTIVA').toString().trim().toUpperCase()
                })).filter(m => m.codigo && m.nombre);
                const preview = document.getElementById('mqImportPreview');
                preview.innerHTML = `<div style="margin-bottom:8px;font-size:13px"><strong>${this._importData.length}</strong> maquinas encontradas</div>
                    <table style="width:100%;font-size:11px"><thead><tr><th>Codigo</th><th>Nombre</th><th>Tipo Proceso</th><th>N° Op</th><th>Capacidad</th><th>Estado</th></tr></thead><tbody>
                    ${this._importData.slice(0, 20).map(m => `<tr><td>${escText(m.codigo)}</td><td>${escText(m.nombre)}</td><td>${escText(m.tipo_proceso)}</td><td>${escText(m.num_operacion || '-')}</td><td>${escText(m.cap_max)}</td><td>${escText(m.estado)}</td></tr>`).join('')}
                    ${this._importData.length > 20 ? `<tr><td colspan="6" style="text-align:center;color:var(--text-light)">... y ${this._importData.length - 20} mas</td></tr>` : ''}
                    </tbody></table>`;
                document.getElementById('mqImportBtn').disabled = this._importData.length === 0;
            } catch(err) { App.showAlert('Error al leer el archivo: ' + err.message, 'danger'); }
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
        } catch(e) { App.showAlert('Error al importar: ' + e.message, 'danger'); }
        btn.disabled = false;
        btn.textContent = 'Importar';
    }
});
