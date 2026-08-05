App.registerModule('machineTypes', {
    async render() {
        const el = document.getElementById('page-machineTypes');
        const tipos = await db.getAll('machine_types');
        const maquinas = await db.getAll('machines');
        const links = await db.getAll('component_type_links');
        const componentes = await db.getAll('components');
        const tiposCount = tipos.length;
        const maqsCount = maquinas.length;
        const compsCount = componentes.length;
        const vinculosCount = links.length;
        const maqByTipo = {};
        maquinas.forEach(m => { if (!maqByTipo[m.tipo_id]) maqByTipo[m.tipo_id] = []; maqByTipo[m.tipo_id].push(m); });
        const compByTipo = {};
        links.forEach(l => { if (!compByTipo[l.tipo_id]) compByTipo[l.tipo_id] = new Set(); compByTipo[l.tipo_id].add(l.componente_id); });
        const compMap = {};
        componentes.forEach(c => { compMap[c.id] = c; });
        let rows = '';
        for (const t of tipos) {
            const compIds = compByTipo[t.id] ? [...compByTipo[t.id]] : [];
            const comps = compIds.map(id => compMap[id]).filter(Boolean);
            const maqs = maqByTipo[t.id] || [];
            rows += `<tr>
                <td>${t.id}</td>
                <td><strong>${t.nombre}</strong></td>
                <td>${comps.map(c => `<span class="status-badge status-programada" style="margin:1px">${c.nombre}</span>`).join(' ') || '<span class="text-muted">Sin componentes</span>'}</td>
                <td>${maqs.length}</td>
                <td class="table-actions">
                    <button class="btn btn-sm btn-outline" title="Editar" onclick="App.modules.machineTypes.showForm(${t.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                    <button class="btn btn-sm btn-danger" title="Eliminar" onclick="App.modules.machineTypes.delete(${t.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                </td>
            </tr>`;
        }
        el.innerHTML = `
            <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:12px;padding:6px 14px;margin-bottom:16px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">
            <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
            <div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center"><div><h2 style="margin:0;font-size:14px;font-weight:800;color:white;letter-spacing:-0.5px">Tipos de Area</h2>
            <p style="margin:2px 0 0;font-size:9px;color:rgba(255,255,255,0.7)">Catalogo de clasificacion de equipos</p></div>
            <div style="display:flex;gap:6px;align-items:center">
                <div style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.2);border-radius:6px;padding:3px 8px;text-align:center"><div style="font-size:8px;color:rgba(255,255,255,0.7);text-transform:uppercase;font-weight:600">Tipos</div><div style="font-size:14px;font-weight:800;color:white;line-height:1.2">${tiposCount}</div></div>
                <div style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.2);border-radius:6px;padding:3px 8px;text-align:center"><div style="font-size:8px;color:rgba(255,255,255,0.7);text-transform:uppercase;font-weight:600">Maquinas</div><div style="font-size:14px;font-weight:800;color:white;line-height:1.2">${maqsCount}</div></div>
                <button class="btn btn-primary" style="padding:5px 12px;font-size:12px" onclick="App.modules.machineTypes.showForm()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> + Nuevo</button>
                </div></div></div>
            <div class="stats-grid">
                <div class="stat-card dash-card" style="border-left:4px solid #f59e0b">
                    <div class="stat-icon orange"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Tipos</p><p class="stat-sub">Registrados</p></div>
                    <div class="stat-value">${tiposCount}</div>
                </div>
                <div class="stat-card dash-card" style="border-left:4px solid #3b82f6">
                    <div class="stat-icon blue"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M2 20h20"/><path d="M5 20V8l5 4V8l5 4V4h3v16"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Maquinas</p><p class="stat-sub">Registradas</p></div>
                    <div class="stat-value">${maqsCount}</div>
                </div>
                <div class="stat-card dash-card" style="border-left:4px solid #22c55e">
                    <div class="stat-icon green"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" style="vertical-align:-2px"><polyline points="20 6 9 17 4 12"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Componentes</p><p class="stat-sub">Disponibles</p></div>
                    <div class="stat-value">${compsCount}</div>
                </div>
                <div class="stat-card dash-card" style="border-left:4px solid #8b5cf6">
                    <div class="stat-icon" style="background:#f3e8ff;color:#7c3aed"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2" style="vertical-align:-2px"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Vinculos</p><p class="stat-sub">Asociaciones</p></div>
                    <div class="stat-value">${vinculosCount}</div>
                </div>
            </div>
            <style>
@keyframes mtype_fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.mtype-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}
.mtype-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important;transform:translateY(-3px)}
.mtype-row{transition:all 0.2s}
.mtype-row:hover{transform:translateX(2px);background:#f8fafc!important}
</style>
            <div class="card mtype-card">
                <div class="card-body">${tipos.length === 0 ? '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51l.06.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">No hay tipos registrados</h4><p style="margin:0;color:#94a3b8;font-size:13px">Registra el primer tipo de máquina</p></div>' : `
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