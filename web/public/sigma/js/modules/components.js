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
        el.innerHTML = `
            <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:12px;padding:6px 14px;margin-bottom:16px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">
            <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
            <div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center"><div><h2 style="margin:0;font-size:14px;font-weight:800;color:white;letter-spacing:-0.5px">Componentes</h2>
            <p style="margin:2px 0 0;font-size:9px;color:rgba(255,255,255,0.7)">Biblioteca de componentes industriales</p></div>
            <div style="display:flex;gap:6px;align-items:center">
                <div style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.2);border-radius:6px;padding:3px 8px;text-align:center"><div style="font-size:8px;color:rgba(255,255,255,0.7);text-transform:uppercase;font-weight:600">Total</div><div style="font-size:14px;font-weight:800;color:white;line-height:1.2">${this._allComponentes.length}</div></div>
                <div style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.2);border-radius:6px;padding:3px 8px;text-align:center"><div style="font-size:8px;color:rgba(255,255,255,0.7);text-transform:uppercase;font-weight:600">Enlaces</div><div style="font-size:14px;font-weight:800;color:white;line-height:1.2">${this._allLinks.length}</div></div>
                <button class="btn btn-primary" style="padding:5px 12px;font-size:12px" onclick="App.modules.components.showForm()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> + Nuevo</button>
                </div></div></div>
            <div class="stats-grid">
                <div class="stat-card dash-card" style="border-left:4px solid #3b82f6">
                    <div class="stat-icon blue"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Componentes</p><p class="stat-sub">Registrados</p></div>
                    <div class="stat-value">${this._allComponentes.length}</div>
                </div>
                <div class="stat-card dash-card" style="border-left:4px solid #22c55e">
                    <div class="stat-icon green"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" style="vertical-align:-2px"><polyline points="20 6 9 17 4 12"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Con Descripcion</p><p class="stat-sub">Documentados</p></div>
                    <div class="stat-value">${this._allComponentes.filter(c => c.descripcion).length}</div>
                </div>
                <div class="stat-card dash-card" style="border-left:4px solid #f59e0b">
                    <div class="stat-icon orange"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Enlaces a Tipos</p><p class="stat-sub">Asociaciones</p></div>
                    <div class="stat-value">${this._allLinks.length}</div>
                </div>
                <div class="stat-card dash-card" style="border-left:4px solid #8b5cf6">
                    <div class="stat-icon" style="background:#f3e8ff;color:#7c3aed"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2" style="vertical-align:-2px"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Repuestos</p><p class="stat-sub">En inventario</p></div>
                    <div class="stat-value">${this._allRepuestos.length}</div>
                </div>
            </div>
            <style>
@keyframes comp_fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.comp-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}
.comp-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important;transform:translateY(-3px)}
.comp-row{transition:all 0.2s}
.comp-row:hover{transform:translateX(2px);background:#f8fafc!important}
</style>
            <div class="form-group" style="margin-bottom:12px">
                <input class="form-control" id="compSearch" placeholder="Buscar componente..." oninput="App.modules.components._filter()">
            </div>
            <div class="card comp-card"><div class="card-body" id="compBody"></div></div>`;
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
            body.innerHTML = '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">No hay componentes' + (filter ? ` que coincidan con "${filter}"` : ' registrados') + '</h4><p style="margin:0;color:#94a3b8;font-size:13px">' + (filter ? 'Intenta con otros términos' : 'Registra el primer componente') + '</p></div>';
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
                <td>${c.id}</td>
                <td><strong>${c.nombre}</strong></td>
                <td>${c.descripcion || '-'}</td>
                <td>${tipos.map(t => `<span class="status-badge status-programada" style="margin:1px">${t.nombre}</span>`).join(' ') || '-'}</td>
                <td>${reps}</td>
                <td class="table-actions">
                    <button class="btn btn-sm btn-outline" title="Editar" onclick="App.modules.components.showForm(${c.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                    <button class="btn btn-sm btn-danger" title="Eliminar" onclick="App.modules.components.delete(${c.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
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
