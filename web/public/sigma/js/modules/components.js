App.registerModule('components', {
    _allComponentes: [],
    _allLinks: [],
    _allTipos: [],
    _allRepuestos: [],

    async render() {
        const el = document.getElementById('page-components');
        [this._allComponentes, this._allLinks, this._allTipos, this._allRepuestos] = await Promise.all([
            db.getAll('components'),
            db.getAll('component_type_links'),
            db.getAll('machine_types'),
            db.getAll('spare_parts')
        ]);
        const total = this._allComponentes.length;
        const conDesc = this._allComponentes.filter(c => c.descripcion).length;
        const asociados = this._allLinks.length;
        const repuestos = this._allRepuestos.length;
        el.innerHTML = `
            <style>
                @keyframes compFadeUp { from { opacity:0; transform:translateY(18px) } to { opacity:1; transform:translateY(0) } }
                .comp-card { transition: transform .2s, box-shadow .2s }
                .comp-card:hover { transform:translateY(-4px); box-shadow:0 8px 24px rgba(88,28,135,.15) }
                .comp-hero { position:relative; background:linear-gradient(135deg,#0f172a 0%,#4c1d95 50%,#6d28d9 100%); border-radius:16px; padding:24px 36px; margin-bottom:28px; overflow:hidden; animation:compFadeUp .5s ease }
                .comp-hero::before { content:''; position:absolute; top:-40px; right:-40px; width:180px; height:180px; background:radial-gradient(circle,rgba(139,92,246,.35) 0%,transparent 70%); border-radius:50%; pointer-events:none }
                .comp-hero::after { content:''; position:absolute; bottom:-30px; left:20%; width:120px; height:120px; background:radial-gradient(circle,rgba(196,181,253,.2) 0%,transparent 70%); border-radius:50%; pointer-events:none }
                .comp-hero h2 { color:#fff; margin:0 0 6px; font-size:28px; font-weight:700; position:relative; z-index:1 }
                .comp-hero .subtitle { color:#c4b5fd; font-size:14px; position:relative; z-index:1 }
                .comp-hero .btn-new { position:relative; z-index:1; display:inline-flex; align-items:center; gap:6px; background:rgba(255,255,255,.15); border:1px solid rgba(255,255,255,.25); color:#fff; padding:8px 20px; border-radius:8px; font-size:14px; cursor:pointer; transition:background .2s }
                .comp-hero .btn-new:hover { background:rgba(255,255,255,.25) }
                .comp-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:16px; margin-bottom:24px; animation:compFadeUp .5s ease .1s both }
                .comp-stat { background:#fff; border-radius:12px; padding:20px; border-left:4px solid #8b5cf6; box-shadow:0 2px 8px rgba(0,0,0,.06); transition:transform .2s,box-shadow .2s }
                .comp-stat:hover { transform:translateY(-2px); box-shadow:0 6px 16px rgba(88,28,135,.1) }
                .comp-stat:nth-child(2) { border-left-color:#06b6d4 }
                .comp-stat:nth-child(3) { border-left-color:#f59e0b }
                .comp-stat:nth-child(4) { border-left-color:#10b981 }
                .comp-stat .stat-row { display:flex; align-items:center; gap:12px }
                .comp-stat .stat-icon { width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center }
                .comp-stat:nth-child(1) .stat-icon { background:#f5f3ff; color:#7c3aed }
                .comp-stat:nth-child(2) .stat-icon { background:#ecfeff; color:#0891b2 }
                .comp-stat:nth-child(3) .stat-icon { background:#fffbeb; color:#d97706 }
                .comp-stat:nth-child(4) .stat-icon { background:#ecfdf5; color:#059669 }
                .comp-stat .stat-num { font-family:'JetBrains Mono',monospace; font-size:24px; font-weight:700; color:#1e1b4b }
                .comp-stat .stat-label { font-size:12px; color:#6b7280; text-transform:uppercase; letter-spacing:.5px; margin-top:2px }
                .comp-filter-wrap { background:#fff; border-radius:12px; padding:16px 20px; margin-bottom:24px; box-shadow:0 2px 8px rgba(0,0,0,.06); animation:compFadeUp .5s ease .2s both }
                .comp-filter-wrap input { width:100%; border:1px solid #e2e8f0; border-radius:8px; padding:10px 14px; font-size:14px; outline:none; transition:border-color .2s }
                .comp-filter-wrap input:focus { border-color:#8b5cf6; box-shadow:0 0 0 3px rgba(139,92,246,.12) }
                .comp-table-wrap { background:#fff; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,.06); overflow:hidden; animation:compFadeUp .5s ease .3s both }
                .comp-table-wrap table { width:100%; border-collapse:collapse }
                .comp-table-wrap thead th { background:#f5f3ff; color:#5b21b6; font-size:12px; text-transform:uppercase; letter-spacing:.5px; padding:14px 16px; border-bottom:1px solid #c4b5fd; font-weight:600; text-align:left }
                .comp-table-wrap tbody tr { transition:background .15s,transform .15s; border-bottom:1px solid #f1f0f5 }
                .comp-table-wrap tbody tr:hover { background:#faf9ff; transform:translateX(2px) }
                .comp-table-wrap tbody td { padding:12px 16px; font-size:14px; color:#374151 }
                .comp-empty { padding:60px 20px; text-align:center }
                .comp-empty .empty-circle { width:80px; height:80px; border-radius:50%; background:linear-gradient(135deg,#ede9fe,#f5f3ff); display:flex; align-items:center; justify-content:center; margin:0 auto 16px }
                .comp-empty h4 { color:#6b7280; margin:0 0 4px; font-size:16px }
                .comp-empty p { color:#9ca3af; font-size:13px; margin:0 }
                .comp-btn-icon { width:32px; height:32px; border-radius:8px; border:none; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:background .2s,transform .15s }
                .comp-btn-icon:hover { transform:scale(1.1) }
                .comp-btn-edit { background:#f5f3ff; color:#7c3aed }
                .comp-btn-edit:hover { background:#ede9fe }
                .comp-btn-del { background:#fef2f2; color:#dc2626 }
                .comp-btn-del:hover { background:#fee2e2 }
            </style>
            <div class="comp-hero" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px">
                <div>
                    <h2>Componentes</h2>
                    <div class="subtitle">Biblioteca de componentes industriales</div>
                </div>
                <button class="btn-new" onclick="App.modules.components.showForm()" style="margin-top:0">
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
                    Nuevo Componente
                </button>
            </div>
            <div class="comp-stats">
                <div class="comp-stat comp-card">
                    <div class="stat-row">
                        <div class="stat-icon"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg></div>
                        <div>
                            <div class="stat-num">${total}</div>
                            <div class="stat-label">Componentes</div>
                        </div>
                    </div>
                </div>
                <div class="comp-stat comp-card">
                    <div class="stat-row">
                        <div class="stat-icon"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg></div>
                        <div>
                            <div class="stat-num">${conDesc}</div>
                            <div class="stat-label">Con descripción</div>
                        </div>
                    </div>
                </div>
                <div class="comp-stat comp-card">
                    <div class="stat-row">
                        <div class="stat-icon"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg></div>
                        <div>
                            <div class="stat-num">${asociados}</div>
                            <div class="stat-label">Enlaces a tipos</div>
                        </div>
                    </div>
                </div>
                <div class="comp-stat comp-card">
                    <div class="stat-row">
                        <div class="stat-icon"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg></div>
                        <div>
                            <div class="stat-num">${repuestos}</div>
                            <div class="stat-label">Repuestos</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="comp-filter-wrap">
                <input id="compSearch" placeholder="Buscar componente..." oninput="App.modules.components._filter()">
            </div>
            <div class="comp-table-wrap" id="compBody"></div>`;
        this._filter();
    },

    _filter() {
        const input = document.getElementById('compSearch');
        const filter = input ? input.value : '';
        const body = document.getElementById('compBody');
        if (!body) return;
        const componentes = filter ? this._allComponentes.filter(c =>
            c.nombre.toLowerCase().includes(filter.toLowerCase()) ||
            (c.descripcion || '').toLowerCase().includes(filter.toLowerCase())
        ) : this._allComponentes;
        if (componentes.length === 0) {
            body.innerHTML = `<div class="comp-empty">
                <div class="empty-circle">
                    <svg width="32" height="32" fill="none" stroke="#8b5cf6" stroke-width="1.5" viewBox="0 0 24 24">
                        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
                    </svg>
                </div>
                <h4>No hay componentes${filter ? ` que coincidan con "${filter}"` : ' registrados'}</h4>
                <p>${filter ? 'Intenta con otros términos de búsqueda' : 'Comienza agregando tu primer componente'}</p>
            </div>`;
        } else {
            body.innerHTML = `<table><thead><tr><th>ID</th><th>Nombre</th><th>Descripción</th><th>Usado en Tipos</th><th>Repuestos</th><th>Acciones</th></tr></thead>
                <tbody>${this._buildRows(componentes)}</tbody></table>`;
        }
    },

    _buildRows(componentes) {
        let rows = '';
        for (const c of componentes) {
            const links = this._allLinks.filter(l => l.componente_id === c.id);
            const tipos = links.map(l => this._allTipos.find(t => t.id === l.tipo_id)).filter(Boolean);
            const reps = this._allRepuestos.filter(s => s.componente_id === c.id).length;
            rows += `<tr>
                <td style="font-family:'JetBrains Mono',monospace;color:#6b7280;font-size:13px">${c.id}</td>
                <td><strong style="color:#1e1b4b">${c.nombre}</strong></td>
                <td>${c.descripcion || '<span style="color:#9ca3af">-</span>'}</td>
                <td>${tipos.map(t => `<span class="status-badge status-programada" style="margin:1px">${t.nombre}</span>`).join(' ') || '<span style="color:#9ca3af">-</span>'}</td>
                <td style="font-family:'JetBrains Mono',monospace;font-weight:600;color:#5b21b6">${reps}</td>
                <td style="display:flex;gap:6px">
                    <button class="comp-btn-icon comp-btn-edit" onclick="App.modules.components.showForm(${c.id})" title="Editar">
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="comp-btn-icon comp-btn-del" onclick="App.modules.components.delete(${c.id})" title="Eliminar">
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M10 11v6M14 11v6"/></svg>
                    </button>
                </td>
            </tr>`;
        }
        return rows;
    },

    async showForm(id) {
        const comp = id ? await db.getById('components', id) : null;
        App.showModal(`
            <div class="form-group"><label>Nombre *</label><input class="form-control" id="compNombre" value="${comp ? comp.nombre : ''}" placeholder="Ej: Rodamiento, Correa..."></div>
            <div class="form-group"><label>Descripción</label><textarea class="form-control" id="compDesc" placeholder="Descripción">${comp ? comp.descripcion || '' : ''}</textarea></div>
        `, { title: comp ? 'Editar Componente' : 'Nuevo Componente' });
        const footer = document.querySelector('#modalOverlay .modal-footer');
        footer.innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.components.save(${id || 0})">${comp ? 'Actualizar' : 'Guardar'}</button>
        `;
    },

    async save(id) {
        try {
            const nombre = App.capitalize(document.getElementById('compNombre').value.trim());
            if (!nombre) { App.showAlert('Debe ingresar un nombre', 'danger'); return; }
            const data = { nombre, descripcion: App.capitalize(document.getElementById('compDesc').value.trim()) };
            if (id === 0) await db.insert('components', data);
            else await db.update('components', id, data);
            App.hideModal();
            [this._allComponentes, this._allLinks, this._allTipos, this._allRepuestos] = await Promise.all([
                db.getAll('components'), db.getAll('component_type_links'), db.getAll('machine_types'), db.getAll('spare_parts')
            ]);
            App.showAlert(id === 0 ? 'Componente creado' : 'Componente actualizado');
            this._filter();
        } catch(e) { App.showAlert('Error al guardar: ' + e.message, 'danger'); }
    },

    async delete(id) {
        try {
            const links = await db.query('component_type_links', l => l.componente_id === id);
            if (links.length > 0) { App.showAlert('No se puede eliminar: está asociado a tipos de máquina', 'danger'); return; }
            const confirmed = await App.confirm('¿Eliminar este componente?');
            if (!confirmed) return;
            await db.delete('components', id);
            [this._allComponentes, this._allLinks, this._allTipos, this._allRepuestos] = await Promise.all([
                db.getAll('components'), db.getAll('component_type_links'), db.getAll('machine_types'), db.getAll('spare_parts')
            ]);
            App.showAlert('Componente eliminado');
            this._filter();
        } catch(e) { App.showAlert('Error al eliminar: ' + e.message, 'danger'); }
    }
});
