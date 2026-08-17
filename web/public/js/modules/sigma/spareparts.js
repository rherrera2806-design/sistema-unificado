App.registerModule('spareparts', {
    async render() {
        const el = document.getElementById('page-spareparts');
        const repuestos = await db.getAll('spare_parts');
        const componentes = await db.getAll('components');
        const compMap = {};
        componentes.forEach(c => { compMap[c.id] = c; });
        const filterCritico = document.getElementById('filterCritico')?.value || '';
        let filtered = repuestos.map(r => ({
            ...r,
            componenteNombre: compMap[r.componente_id] ? compMap[r.componente_id].nombre : '-'
        }));
        if (filterCritico === 'critico') filtered = filtered.filter(r => r.stock_actual <= r.stock_minimo);
        else if (filterCritico === 'normal') filtered = filtered.filter(r => r.stock_actual > r.stock_minimo);
        const criticos = repuestos.filter(r => r.stock_actual <= r.stock_minimo);
        const normales = repuestos.filter(r => r.stock_actual > r.stock_minimo);

        el.innerHTML = `
            <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:8px 16px;margin-bottom:16px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">
            <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
            <div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center"><div><h2 style="margin:0;font-size:15px;font-weight:800;color:white;letter-spacing:-0.5px">Repuestos</h2>
            <p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Control de inventario de repuestos industriales</p></div>
                <button class="btn btn-primary" style="padding:5px 12px;font-size:12px" onclick="App.modules.spareparts.showForm()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo</button>
            </div></div>
            <style>
@keyframes spare_fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.spare-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}
.spare-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important;transform:translateY(-3px)}
.spare-row{transition:all 0.2s}
.spare-row:hover{transform:translateX(2px);background:#f8fafc!important}
</style>
            <div class="stats-grid">
                <div class="stat-card dash-card spare-card" style="border-left:4px solid #3b82f6"><div class="stat-icon blue"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div><div class="stat-info"><p class="stat-label">Total repuestos</p><p class="stat-sub">Inventario</p></div><div class="stat-value">${repuestos.length}</div></div>
                <div class="stat-card dash-card spare-card" style="border-left:4px solid #f59e0b"><div class="stat-icon red"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" style="vertical-align:-2px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><div class="stat-info"><p class="stat-label">Stock critico</p><p class="stat-sub">Requieren accion</p></div><div class="stat-value">${criticos.length}</div></div>
                <div class="stat-card dash-card spare-card" style="border-left:4px solid #22c55e"><div class="stat-icon green"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" style="vertical-align:-2px"><polyline points="20 6 9 17 4 12"/></svg></div><div class="stat-info"><p class="stat-label">Stock normal</p><p class="stat-sub">Disponibles</p></div><div class="stat-value">${normales.length}</div></div>
            </div>
            <div class="card spare-card">
                <div class="card-header">
                    <select class="form-control" id="filterCritico" style="width:auto;min-width:150px" onchange="App.modules.spareparts.render()">
                        <option value="">Todos</option>
                        <option value="critico" ${filterCritico === 'critico' ? 'selected' : ''}>Stock crítico</option>
                        <option value="normal" ${filterCritico === 'normal' ? 'selected' : ''}>Stock normal</option>
                    </select>
                </div>
                <div class="card-body" style="padding:0">
                    ${filtered.length === 0 ? '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">No hay repuestos</h4><p style="margin:0;color:#94a3b8;font-size:13px">Registra el primer repuesto</p></div>' : `
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
                                <button class="btn btn-sm btn-outline" title="Editar" onclick="App.modules.spareparts.showForm(${r.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                                <button class="btn btn-sm btn-danger" title="Eliminar" onclick="App.modules.spareparts.delete(${r.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
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
