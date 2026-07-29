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
                    <button class="btn btn-sm btn-outline" onclick="App.modules.machineTypes.showForm(${t.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                    <button class="btn btn-sm btn-danger" onclick="App.modules.machineTypes.delete(${t.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                </td>
            </tr>`;
        }
        el.innerHTML = `
            <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:28px 32px;margin-bottom:24px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">
            <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
            <div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center"><div><h2 style="margin:0;font-size:24px;font-weight:800;color:white;letter-spacing:-0.5px">Tipos de Área</h2>
            <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.7)">Catálogo de clasificación de equipos</p></div>
                <button class="btn btn-primary" onclick="App.modules.machineTypes.showForm()">+ Nuevo Tipo</button>
            </div></div>
            <div class="card">
                <div class="card-body">${tipos.length === 0 ? '<div class="empty-state"><div class="icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51l.06.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></div><h4>No hay tipos registrados</h4></div>' : `
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