App.registerModule('spareparts', {
    async render() {
        const el = document.getElementById('page-spareparts');
        const repuestos = await db.getAll('spare_parts');
        const filterCritico = document.getElementById('filterCritico')?.value || '';
        let filtered = [];
        for (const r of repuestos) {
            const comp = await db.getById('components', r.componente_id).catch(() => null);
            filtered.push({ ...r, componenteNombre: comp ? comp.nombre : '-' });
        }
        if (filterCritico === 'critico') filtered = filtered.filter(r => r.stock_actual <= r.stock_minimo);
        else if (filterCritico === 'normal') filtered = filtered.filter(r => r.stock_actual > r.stock_minimo);
        const criticos = repuestos.filter(r => r.stock_actual <= r.stock_minimo);
        const normales = repuestos.filter(r => r.stock_actual > r.stock_minimo);

        el.innerHTML = `
            <div class="page-header">
                <div><h2>Repuestos</h2><div class="subtitle">Control de inventario de repuestos industriales</div></div>
                <button class="btn btn-primary" onclick="App.modules.spareparts.showForm()">+ Nuevo Repuesto</button>
            </div>
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-icon blue">📦</div><div class="stat-info"><h4>${repuestos.length}</h4><p>Total repuestos</p></div></div>
                <div class="stat-card"><div class="stat-icon red">⚠️</div><div class="stat-info"><h4>${criticos.length}</h4><p>Stock crítico</p></div></div>
                <div class="stat-card"><div class="stat-icon green">✅</div><div class="stat-info"><h4>${normales.length}</h4><p>Stock normal</p></div></div>
            </div>
            <div class="card">
                <div class="card-header">
                    <select class="form-control" id="filterCritico" style="width:auto;min-width:150px" onchange="App.modules.spareparts.render()">
                        <option value="">Todos</option>
                        <option value="critico" ${filterCritico === 'critico' ? 'selected' : ''}>Stock crítico</option>
                        <option value="normal" ${filterCritico === 'normal' ? 'selected' : ''}>Stock normal</option>
                    </select>
                </div>
                <div class="card-body" style="padding:0">
                    ${filtered.length === 0 ? '<div class="empty-state"><div class="icon">📦</div><h4>No hay repuestos</h4></div>' : `
                    <table><thead><tr><th>Código</th><th>Descripción</th><th>Componente</th><th>Stock Actual</th><th>Stock Mín.</th><th>Estado</th><th>Proveedor</th><th>Ubicación</th><th>Acciones</th></tr></thead>
                    <tbody>${filtered.map(r => {
                        const critico = r.stock_actual <= r.stock_minimo;
                        return `<tr>
                            <td><strong>${r.codigo || '-'}</strong></td>
                            <td>${r.descripcion || '-'}</td>
                            <td>${r.componenteNombre}</td>
                            <td><strong>${r.stock_actual}</strong></td>
                            <td>${r.stock_minimo}</td>
                            <td>${critico ? '<span class="status-badge status-vencida">Crítico</span>' : '<span class="status-badge status-realizada">Normal</span>'}</td>
                            <td>${r.proveedor || '-'}</td>
                            <td>${r.ubicacion_bodega || '-'}</td>
                            <td class="table-actions">
                                <button class="btn btn-sm btn-outline" onclick="App.modules.spareparts.showForm(${r.id})">✏️</button>
                                <button class="btn btn-sm btn-danger" onclick="App.modules.spareparts.delete(${r.id})">🗑️</button>
                            </td>
                        </tr>`;
                    }).join('')}</tbody></table>`}
                </div>
            </div>`;
    },

    async showForm(id) {
        const rep = id ? await db.getById('spare_parts', id) : null;
        const componentes = await db.getAll('components');
        App.showModal(`
            <div class="form-row">
                <div class="form-group"><label>Código *</label><input class="form-control" id="repCodigo" value="${rep ? rep.codigo : ''}" placeholder="Ej: ROD-001"></div>
                <div class="form-group"><label>Componente</label>
                    <select class="form-control" id="repComponente">
                        <option value="">Ninguno</option>
                        ${componentes.map(c => `<option value="${c.id}" ${rep && rep.componente_id === c.id ? 'selected' : ''}>${c.nombre}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-group"><label>Descripción *</label><input class="form-control" id="repDesc" value="${rep ? rep.descripcion : ''}"></div>
            <div class="form-row">
                <div class="form-group"><label>Stock Actual *</label><input type="number" class="form-control" id="repStockAct" value="${rep ? rep.stock_actual : 0}" min="0"></div>
                <div class="form-group"><label>Stock Mínimo *</label><input type="number" class="form-control" id="repStockMin" value="${rep ? rep.stock_minimo : 1}" min="0"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Proveedor</label><input class="form-control" id="repProveedor" value="${rep ? rep.proveedor || '' : ''}"></div>
                <div class="form-group"><label>Ubicación</label><input class="form-control" id="repUbicacion" value="${rep ? rep.ubicacion_bodega || '' : ''}"></div>
            </div>
        `, { title: rep ? 'Editar Repuesto' : 'Nuevo Repuesto', lg: true });
        const footer = document.querySelector('#modalOverlay .modal-footer');
        footer.innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.spareparts.save(${id || 0})">${rep ? 'Actualizar' : 'Guardar'}</button>
        `;
    },

    async save(id) {
        try {
            const data = {
                codigo: document.getElementById('repCodigo').value.trim().toUpperCase(),
                descripcion: App.capitalize(document.getElementById('repDesc').value.trim()),
                componente_id: document.getElementById('repComponente').value ? parseInt(document.getElementById('repComponente').value) : null,
                stock_actual: parseInt(document.getElementById('repStockAct').value) || 0,
                stock_minimo: parseInt(document.getElementById('repStockMin').value) || 0,
                proveedor: App.capitalize(document.getElementById('repProveedor').value.trim()),
                ubicacion_bodega: document.getElementById('repUbicacion').value.trim().toUpperCase()
            };
            if (!data.codigo || !data.descripcion) { App.showAlert('Código y descripción obligatorios', 'danger'); return; }
            if (id === 0) await db.insert('spare_parts', data);
            else await db.update('spare_parts', id, data);
            App.hideModal();
            App.showAlert(id === 0 ? 'Repuesto creado' : 'Repuesto actualizado');
            this.render();
        } catch(e) { App.showAlert('Error al guardar: ' + e.message, 'danger'); }
    },

    async delete(id) {
        try {
            const confirmed = await App.confirm('¿Eliminar este repuesto?');
            if (!confirmed) return;
            await db.delete('spare_parts', id);
            App.showAlert('Repuesto eliminado');
            this.render();
        } catch(e) { App.showAlert('Error al eliminar: ' + e.message, 'danger'); }
    }
});
