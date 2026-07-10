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
            <div class="page-header">
                <div><h2>Componentes</h2><div class="subtitle">Biblioteca de componentes industriales</div></div>
                <button class="btn btn-primary" onclick="App.modules.components.showForm()">+ Nuevo Componente</button>
            </div>
            <div class="form-group" style="margin-bottom:12px">
                <input class="form-control" id="compSearch" placeholder="Buscar componente..." oninput="App.modules.components._filter()">
            </div>
            <div class="card"><div class="card-body" id="compBody"></div></div>`;
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
            body.innerHTML = '<div class="empty-state"><div class="icon">🔧</div><h4>No hay componentes' + (filter ? ` que coincidan con "${filter}"` : ' registrados') + '</h4></div>';
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
                    <button class="btn btn-sm btn-outline" onclick="App.modules.components.showForm(${c.id})">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="App.modules.components.delete(${c.id})">🗑️</button>
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
