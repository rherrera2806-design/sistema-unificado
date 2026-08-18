const SigmaProveedores = {
    async render() {
        const el = document.getElementById('page-proveedores');
        const data = await db.getAll('proveedores');
        const filterEstado = document.getElementById('filterProvEstado')?.value || '';
        const filterSearch = document.getElementById('filterProvSearch')?.value || '';
        let filtered = data;
        if (filterEstado) filtered = filtered.filter(p => p.estado === filterEstado);
        if (filterSearch) {
            const q = filterSearch.toLowerCase();
            filtered = filtered.filter(p =>
                (p.nombre || '').toLowerCase().includes(q) ||
                (p.rut || '').toLowerCase().includes(q) ||
                (p.especialidad || '').toLowerCase().includes(q) ||
                (p.persona_contacto || '').toLowerCase().includes(q)
            );
        }
        const activos = data.filter(p => p.estado === 'Activo').length;
        const inactivos = data.filter(p => p.estado === 'Inactivo').length;

        el.innerHTML = `
            <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:12px;padding:6px 14px;margin-bottom:16px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">
                <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
                <div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center"><div><h2 style="margin:0;font-size:15px;font-weight:800;color:white;letter-spacing:-0.5px">Proveedores</h2>
                <p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Directorio de proveedores del departamento</p></div>
                <div style="display:flex;gap:6px;align-items:center">
                    ${App.canCreate('proveedores') ? '<button class="btn btn-accent" style="padding:5px 12px;font-size:12px" onclick="App.modules.proveedores.showForm()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo</button>' : ''}
                </div></div>
            </div>
            <div class="stats-grid">
                <div class="stat-card dash-card" style="border-left:4px solid #3b82f6">
                    <div class="stat-icon blue"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Total</p><p class="stat-sub">Proveedores</p></div>
                    <div class="stat-value">${data.length}</div>
                </div>
                <div class="stat-card dash-card" style="border-left:4px solid #22c55e">
                    <div class="stat-icon green"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" style="vertical-align:-2px"><polyline points="20 6 9 17 4 12"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Activos</p><p class="stat-sub">Disponibles</p></div>
                    <div class="stat-value">${activos}</div>
                </div>
                <div class="stat-card dash-card" style="border-left:4px solid #ef4444">
                    <div class="stat-icon red"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" style="vertical-align:-2px"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Inactivos</p><p class="stat-sub">No disponibles</p></div>
                    <div class="stat-value">${inactivos}</div>
                </div>
            </div>
            <div style="display:flex;gap:8px;margin-bottom:12px">
                <input type="text" class="form-control" id="filterProvSearch" placeholder="Buscar por nombre, RUT, especialidad..." value="${filterSearch}" oninput="App.modules.proveedores.render()" style="flex:1;font-size:12px">
                <select class="form-control" id="filterProvEstado" onchange="App.modules.proveedores.render()" style="width:140px;font-size:12px">
                    <option value="">Todos</option>
                    <option value="Activo" ${filterEstado === 'Activo' ? 'selected' : ''}>Activos</option>
                    <option value="Inactivo" ${filterEstado === 'Inactivo' ? 'selected' : ''}>Inactivos</option>
                </select>
            </div>
            <div class="card dash-card">
                <div class="card-header"><h3>Directorio de Proveedores (${filtered.length})</h3></div>
                <div class="card-body" style="padding:0">
                    ${filtered.length === 0 ? '<p style="text-align:center;padding:24px;color:#94a3b8;font-size:13px">No hay proveedores registrados</p>' : `
                    <div style="overflow-x:auto">
                        <table style="width:100%;font-size:12px;border-collapse:collapse">
                            <thead><tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0">
                                <th style="padding:10px 12px;text-align:left;color:#64748b;font-weight:700">Nombre</th>
                                <th style="padding:10px 12px;text-align:left;color:#64748b;font-weight:700">RUT</th>
                                <th style="padding:10px 12px;text-align:left;color:#64748b;font-weight:700">Telefono</th>
                                <th style="padding:10px 12px;text-align:left;color:#64748b;font-weight:700">Email</th>
                                <th style="padding:10px 12px;text-align:left;color:#64748b;font-weight:700">Especialidad</th>
                                <th style="padding:10px 12px;text-align:left;color:#64748b;font-weight:700">Contacto</th>
                                <th style="padding:10px 12px;text-align:center;color:#64748b;font-weight:700">Estado</th>
                                <th style="padding:10px 12px;text-align:center;color:#64748b;font-weight:700">Acciones</th>
                            </tr></thead>
                            <tbody>${filtered.map(p => `
                                <tr style="border-bottom:1px solid #f1f5f9;cursor:pointer" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
                                    <td style="padding:10px 12px"><strong style="color:#1e293b">${escapeHtml(p.nombre)}</strong></td>
                                    <td style="padding:10px 12px;color:#64748b">${escapeHtml(p.rut || '-')}</td>
                                    <td style="padding:10px 12px;color:#64748b">${escapeHtml(p.telefono || '-')}</td>
                                    <td style="padding:10px 12px;color:#64748b">${escapeHtml(p.email || '-')}</td>
                                    <td style="padding:10px 12px"><span style="background:#eff6ff;color:#1e40af;padding:2px 8px;border-radius:6px;font-size:11px">${escapeHtml(p.especialidad || '-')}</span></td>
                                    <td style="padding:10px 12px;color:#64748b">${escapeHtml(p.persona_contacto || '-')}</td>
                                    <td style="padding:10px 12px;text-align:center"><span style="background:${p.estado === 'Activo' ? '#dcfce7;color:#166534' : '#fee2e2;color:#dc2626'};padding:3px 10px;border-radius:10px;font-size:11px;font-weight:600">${p.estado}</span></td>
                                    <td style="padding:10px 12px;text-align:center">
                                        <div style="display:flex;gap:4px;justify-content:center">
                                            ${App.canUpdate('proveedores') ? `<button class="btn btn-sm btn-outline" onclick="App.modules.proveedores.showForm(${p.id})" title="Editar"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>` : ''}
                                            ${App.canDelete('proveedores') ? `<button class="btn btn-sm btn-outline" onclick="App.modules.proveedores.delete(${p.id})" title="Eliminar" style="color:#ef4444"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>` : ''}
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}</tbody>
                        </table>
                    </div>`}
                </div>
            </div>`;
    },

    async showForm(id) {
        const prov = id ? await db.getById('proveedores', id) : null;
        App.showModal(`
            <div class="form-row">
                <div class="form-group"><label>Nombre / Razon Social *</label><input class="form-control" id="provNombre" value="${prov ? prov.nombre : ''}" placeholder="Nombre del proveedor"></div>
                <div class="form-group"><label>RUT</label><input class="form-control" id="provRut" value="${prov ? prov.rut || '' : ''}" placeholder="76.123.456-7"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Telefono</label><input class="form-control" id="provTelefono" value="${prov ? prov.telefono || '' : ''}" placeholder="+56 9 1234 5678"></div>
                <div class="form-group"><label>Email</label><input class="form-control" id="provEmail" type="email" value="${prov ? prov.email || '' : ''}" placeholder="contacto@proveedor.cl"></div>
            </div>
            <div class="form-group"><label>Direccion</label><input class="form-control" id="provDireccion" value="${prov ? prov.direccion || '' : ''}" placeholder="Av. Industrial 1234"></div>
            <div class="form-row">
                <div class="form-group"><label>Persona de Contacto</label><input class="form-control" id="provContacto" value="${prov ? prov.persona_contacto || '' : ''}" placeholder="Juan Perez"></div>
                <div class="form-group"><label>Especialidad</label><input class="form-control" id="provEspecialidad" value="${prov ? prov.especialidad || '' : ''}" placeholder="Motores, rodamientos..."></div>
            </div>
            <div class="form-group"><label>Observaciones</label><textarea class="form-control" id="provObs" rows="3" placeholder="Notas adicionales...">${prov ? prov.observaciones || '' : ''}</textarea></div>
            <div class="form-group"><label>Estado</label>
                <select class="form-control" id="provEstado">
                    <option value="Activo" ${prov && prov.estado === 'Activo' ? 'selected' : ''}>Activo</option>
                    <option value="Inactivo" ${prov && prov.estado === 'Inactivo' ? 'selected' : ''}>Inactivo</option>
                </select>
            </div>
        `, { title: prov ? 'Editar Proveedor' : 'Nuevo Proveedor', lg: true });
        const footer = document.querySelector('#modalOverlay .modal-footer');
        footer.innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.proveedores.save(${id || 0})">${prov ? 'Actualizar' : 'Guardar'}</button>
        `;
    },

    async save(id) {
        try {
            const data = {
                nombre: document.getElementById('provNombre').value.trim(),
                rut: document.getElementById('provRut').value.trim(),
                telefono: document.getElementById('provTelefono').value.trim(),
                email: document.getElementById('provEmail').value.trim(),
                direccion: document.getElementById('provDireccion').value.trim(),
                persona_contacto: document.getElementById('provContacto').value.trim(),
                especialidad: document.getElementById('provEspecialidad').value.trim(),
                observaciones: document.getElementById('provObs').value.trim(),
                estado: document.getElementById('provEstado').value
            };
            if (!data.nombre) { App.showAlert('El nombre es obligatorio', 'danger'); return; }
            if (id === 0) {
                await db.insert('proveedores', data);
                App.showAlert('Proveedor creado');
            } else {
                await db.update('proveedores', id, data);
                App.showAlert('Proveedor actualizado');
            }
            App.hideModal();
            this.render();
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    async delete(id) {
        try {
            const confirmed = await App.confirm('Eliminar este proveedor?');
            if (!confirmed) return;
            await db.delete('proveedores', id);
            App.showAlert('Proveedor eliminado');
            this.render();
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    }
};
