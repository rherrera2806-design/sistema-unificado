App.registerModule('machineTypes', {
    async render() {
        const el = document.getElementById('page-machineTypes');
        const tipos = await db.getAll('machine_types');
        let rows = '';
        for (const t of tipos) {
            const raw = await db.getComponentsByType(t.id);
            const comps = raw.filter((c, i, a) => a.findIndex(x => x.id === c.id) === i);
            const maqs = await db.query('machines', m => m.tipo_id === t.id);
            rows += `<tr>
                <td>${t.id}</td>
                <td><strong>${t.nombre}</strong></td>
                <td>${comps.map(c => `<span class="status-badge status-programada" style="margin:1px">${c.nombre}</span>`).join(' ') || '<span class="text-muted">Sin componentes</span>'}</td>
                <td>${maqs.length}</td>
                <td class="table-actions">
                    <button class="btn btn-sm btn-outline" onclick="App.modules.machineTypes.showForm(${t.id})">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="App.modules.machineTypes.delete(${t.id})">🗑️</button>
                </td>
            </tr>`;
        }
        el.innerHTML = `
            <div class="page-header">
                <div>
                    <h2>Tipos de Área</h2>
                    <div class="subtitle">Catálogo de clasificación de equipos</div>
                </div>
                <button class="btn btn-primary" onclick="App.modules.machineTypes.showForm()">+ Nuevo Tipo</button>
            </div>
            <div class="card">
                <div class="card-body">${tipos.length === 0 ? '<div class="empty-state"><div class="icon">⚙️</div><h4>No hay tipos registrados</h4></div>' : `
                <table><thead><tr><th>ID</th><th>Nombre</th><th>Componentes</th><th>Máquinas</th><th>Acciones</th></tr></thead>
                <tbody>${rows}</tbody></table>`}
                </div>
            </div>`;
    },

    async showForm(id) {
        const tipo = id ? await db.getById('machine_types', id) : null;
        const componentes = (await db.getAll('components')).sort((a, b) => a.nombre.localeCompare(b.nombre));
        const links = id ? (await db.query('component_type_links', l => l.tipo_id === id)).filter((l, i, a) => a.findIndex(x => x.componente_id === l.componente_id) === i) : [];
        const selectedCompIds = links.map(l => l.componente_id);
        App.showModal(`
            <div class="form-group">
                <label>Nombre del Tipo de Área</label>
                <input class="form-control" id="tipoNombre" value="${tipo ? tipo.nombre : ''}" placeholder="Ej: Corte, Pulido, Mecanizado...">
            </div>
            <div class="form-group">
                <label>Componentes asociados</label>
                <div style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;padding:8px">
                    ${componentes.map(c => `<label style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer">
                        <input type="checkbox" class="comp-check" value="${c.id}" ${selectedCompIds.includes(c.id) ? 'checked' : ''}>
                        <span>${c.nombre}</span>
                    </label>`).join('')}
                </div>
            </div>
        `, { title: tipo ? 'Editar Tipo de Área' : 'Nuevo Tipo de Área' });
        const footer = document.querySelector('#modalOverlay .modal-footer');
        footer.innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.machineTypes.save(${id || 0})">${tipo ? 'Actualizar' : 'Guardar'}</button>
        `;
    },

    async save(id) {
        try {
            const nombre = App.capitalize(document.getElementById('tipoNombre').value.trim());
            if (!nombre) { App.showAlert('Debe ingresar un nombre', 'danger'); return; }
            const selected = Array.from(document.querySelectorAll('.comp-check:checked')).map(c => parseInt(c.value));
            if (id === 0) {
                const tipo = await db.insert('machine_types', { nombre });
                for (const compId of selected) {
                    await db.insert('component_type_links', { tipo_id: tipo.id, componente_id: compId });
                }
            } else {
                await db.update('machine_types', id, { nombre });
                const existing = await db.query('component_type_links', l => l.tipo_id === id);
                for (const l of existing) await db.delete('component_type_links', l.id);
                for (const compId of selected) {
                    await db.insert('component_type_links', { tipo_id: id, componente_id: compId });
                }
            }
            App.hideModal();
            App.showAlert(id === 0 ? 'Tipo creado exitosamente' : 'Tipo actualizado exitosamente');
            this.render();
        } catch(e) { App.showAlert('Error al guardar: ' + e.message, 'danger'); }
    },

    async delete(id) {
        try {
            const maqs = await db.query('machines', m => m.tipo_id === id);
            if (maqs.length > 0) { App.showAlert('No se puede eliminar: hay máquinas asociadas', 'danger'); return; }
            const confirmed = await App.confirm('¿Eliminar este tipo de máquina?');
            if (!confirmed) return;
            const links = await db.query('component_type_links', l => l.tipo_id === id);
            for (const l of links) await db.delete('component_type_links', l.id);
            await db.delete('machine_types', id);
            App.showAlert('Tipo eliminado');
            this.render();
        } catch(e) { App.showAlert('Error al eliminar: ' + e.message, 'danger'); }
    }
});