App.registerModule('proveedores', {
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
            <div class="m-page">
                <div class="m-hero" style="padding:10px 14px">
                    <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
                    <div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center">
                        <div>
                            <h2 style="margin:0;font-size:15px;font-weight:800;color:white;letter-spacing:-0.5px">Proveedores</h2>
                            <p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Directorio de proveedores del departamento</p>
                        </div>
                        <div class="m-hero-btns" style="display:flex;gap:6px;align-items:center">
                            ${App.canCreate('proveedores') ? '<button class="btn btn-accent" style="padding:5px 12px;font-size:12px" onclick="App.modules.proveedores.showForm()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo</button>' : ''}
                        </div>
                    </div>
                </div>

                <div class="m-stats" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
                    <div class="m-stat-card stat-blue">
                        <div class="m-stat-value" style="color:#1e40af">${data.length}</div>
                        <div class="m-stat-label">TOTAL</div>
                    </div>
                    <div class="m-stat-card stat-green">
                        <div class="m-stat-value" style="color:#059669">${activos}</div>
                        <div class="m-stat-label">ACTIVOS</div>
                    </div>
                    <div class="m-stat-card stat-red">
                        <div class="m-stat-value" style="color:#dc2626">${inactivos}</div>
                        <div class="m-stat-label">INACTIVOS</div>
                    </div>
                </div>

                <div class="m-filters" style="display:flex;gap:8px;margin-bottom:12px">
                    <input type="text" class="form-control" id="filterProvSearch" placeholder="Buscar nombre, RUT, especialidad..." value="${filterSearch}" oninput="App.modules.proveedores.render()" style="flex:1;font-size:12px;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px">
                    <select class="form-control" id="filterProvEstado" onchange="App.modules.proveedores.render()" style="width:130px;font-size:12px;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px">
                        <option value="">Todos</option>
                        <option value="Activo" ${filterEstado === 'Activo' ? 'selected' : ''}>Activos</option>
                        <option value="Inactivo" ${filterEstado === 'Inactivo' ? 'selected' : ''}>Inactivos</option>
                    </select>
                </div>

                <div class="m-card">
                    <div class="m-card-header" style="padding:6px 12px;font-size:12px;font-weight:600;display:flex;justify-content:space-between;align-items:center">
                        <span>Directorio <span style="color:#94a3b8">(${filtered.length})</span></span>
                    </div>
                    <div class="m-card-body" style="padding:0">
                        ${filtered.length === 0 ? '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">Sin proveedores</h4><p style="margin:0;color:#94a3b8;font-size:13px">Agrega el primer proveedor</p></div>' : ''}

                        <div class="m-table-wrap" style="overflow-x:auto">
                            <table style="width:100%;font-size:12px;border-collapse:collapse;min-width:700px">
                                <thead><tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0">
                                    <th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:700;font-size:11px">Nombre</th>
                                    <th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:700;font-size:11px">RUT</th>
                                    <th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:700;font-size:11px">Telefono</th>
                                    <th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:700;font-size:11px">Email</th>
                                    <th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:700;font-size:11px">Especialidad</th>
                                    <th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:700;font-size:11px">Contacto</th>
                                    <th style="padding:8px 12px;text-align:center;color:#64748b;font-weight:700;font-size:11px">Estado</th>
                                    <th style="padding:8px 12px;text-align:center;color:#64748b;font-weight:700;font-size:11px">Acciones</th>
                                </tr></thead>
                                <tbody>${filtered.map(p => `
                                    <tr style="border-bottom:1px solid #f1f5f9">
                                        <td style="padding:8px 12px"><strong style="color:#1e293b">${escapeHtml(p.nombre)}</strong></td>
                                        <td style="padding:8px 12px;color:#64748b">${escapeHtml(p.rut || '-')}</td>
                                        <td style="padding:8px 12px;color:#64748b">${escapeHtml(p.telefono || '-')}</td>
                                        <td style="padding:8px 12px;color:#64748b">${escapeHtml(p.email || '-')}</td>
                                        <td style="padding:8px 12px"><span style="background:#eff6ff;color:#1e40af;padding:2px 8px;border-radius:6px;font-size:11px">${escapeHtml(p.especialidad || '-')}</span></td>
                                        <td style="padding:8px 12px;color:#64748b">${escapeHtml(p.persona_contacto || '-')}</td>
                                        <td style="padding:8px 12px;text-align:center"><span style="background:${p.estado === 'Activo' ? '#dcfce7;color:#166534' : '#fee2e2;color:#dc2626'};padding:3px 10px;border-radius:10px;font-size:11px;font-weight:600">${p.estado}</span></td>
                                        <td style="padding:8px 12px;text-align:center">
                                            <div style="display:flex;gap:4px;justify-content:center">
                                                ${App.canUpdate('proveedores') ? `<button class="btn btn-sm btn-outline" onclick="App.modules.proveedores.showForm(${p.id})" title="Editar"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>` : ''}
                                                ${App.canDelete('proveedores') ? `<button class="btn btn-sm btn-outline" onclick="App.modules.proveedores.delete(${p.id})" title="Eliminar" style="color:#ef4444"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>` : ''}
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}</tbody>
                            </table>
                        </div>

                        <div class="m-cards-mobile" style="display:none;padding:8px 12px">
                            ${filtered.map(p => `
                                <div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-bottom:10px">
                                    <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                                        <div style="font-weight:700;font-size:13px;color:#1e293b">${escapeHtml(p.nombre)}</div>
                                        <span style="background:${p.estado === 'Activo' ? '#dcfce7;color:#166534' : '#fee2e2;color:#dc2626'};padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600">${p.estado}</span>
                                    </div>
                                    <div style="font-size:11px;color:#64748b;margin-bottom:4px">${escapeHtml(p.rut || 'Sin RUT')}</div>
                                    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">
                                        <span style="background:#eff6ff;color:#1e40af;padding:2px 6px;border-radius:4px;font-size:10px">${escapeHtml(p.especialidad || '-')}</span>
                                        ${p.telefono ? `<span style="background:#f1f5f9;color:#475569;padding:2px 6px;border-radius:4px;font-size:10px">${escapeHtml(p.telefono)}</span>` : ''}
                                    </div>
                                    ${p.email ? `<div style="font-size:10px;color:#64748b;margin-bottom:2px">${escapeHtml(p.email)}</div>` : ''}
                                    ${p.persona_contacto ? `<div style="font-size:10px;color:#64748b">Contacto: ${escapeHtml(p.persona_contacto)}</div>` : ''}
                                    <div style="display:flex;gap:4px;margin-top:8px">
                                        ${App.canUpdate('proveedores') ? `<button class="btn btn-sm btn-outline" onclick="App.modules.proveedores.showForm(${p.id})" style="flex:1;font-size:11px;padding:6px">Editar</button>` : ''}
                                        ${App.canDelete('proveedores') ? `<button class="btn btn-sm btn-outline" onclick="App.modules.proveedores.delete(${p.id})" style="flex:1;font-size:11px;padding:6px;color:#ef4444;border-color:#fecaca">Eliminar</button>` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>

            <style>
                @media(max-width:768px){
                    .m-cards-mobile{display:block!important}
                    .m-table-wrap{display:none!important}
                    .m-hero-btns{flex-wrap:wrap}
                    .m-hero-btns .btn{height:40px;min-height:40px;flex:1}
                    .m-stats{grid-template-columns:repeat(3,1fr)!important}
                    .m-filters{flex-direction:column}
                }
            </style>`;
    },

    async showForm(id) {
        const prov = id ? await db.getById('proveedores', id) : null;
        App.showModal(`
            <div class="inv-form-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px 10px;align-items:end">
                <div class="form-group" style="margin:0"><label style="font-size:10px;margin-bottom:2px;display:block;font-weight:600;color:#64748b">Nombre / Razon Social *</label><input class="form-control" id="provNombre" value="${prov ? prov.nombre : ''}" placeholder="Nombre del proveedor" style="padding:10px 12px;font-size:13px;border:1px solid #e2e8f0;border-radius:8px;width:100%;box-sizing:border-box"></div>
                <div class="form-group" style="margin:0"><label style="font-size:10px;margin-bottom:2px;display:block;font-weight:600;color:#64748b">RUT</label><input class="form-control" id="provRut" value="${prov ? prov.rut || '' : ''}" placeholder="76.123.456-7" style="padding:10px 12px;font-size:13px;border:1px solid #e2e8f0;border-radius:8px;width:100%;box-sizing:border-box"></div>
            </div>
            <div class="inv-form-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px 10px;align-items:end;margin-top:4px">
                <div class="form-group" style="margin:0"><label style="font-size:10px;margin-bottom:2px;display:block;font-weight:600;color:#64748b">Telefono</label><input class="form-control" id="provTelefono" value="${prov ? prov.telefono || '' : ''}" placeholder="+56 9 1234 5678" style="padding:10px 12px;font-size:13px;border:1px solid #e2e8f0;border-radius:8px;width:100%;box-sizing:border-box"></div>
                <div class="form-group" style="margin:0"><label style="font-size:10px;margin-bottom:2px;display:block;font-weight:600;color:#64748b">Email</label><input class="form-control" id="provEmail" type="email" value="${prov ? prov.email || '' : ''}" placeholder="contacto@proveedor.cl" style="padding:10px 12px;font-size:13px;border:1px solid #e2e8f0;border-radius:8px;width:100%;box-sizing:border-box"></div>
            </div>
            <div class="inv-form-grid" style="display:grid;grid-template-columns:1fr;gap:6px 10px;align-items:end;margin-top:4px">
                <div class="form-group" style="margin:0"><label style="font-size:10px;margin-bottom:2px;display:block;font-weight:600;color:#64748b">Direccion</label><input class="form-control" id="provDireccion" value="${prov ? prov.direccion || '' : ''}" placeholder="Av. Industrial 1234" style="padding:10px 12px;font-size:13px;border:1px solid #e2e8f0;border-radius:8px;width:100%;box-sizing:border-box"></div>
            </div>
            <div class="inv-form-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px 10px;align-items:end;margin-top:4px">
                <div class="form-group" style="margin:0"><label style="font-size:10px;margin-bottom:2px;display:block;font-weight:600;color:#64748b">Persona de Contacto</label><input class="form-control" id="provContacto" value="${prov ? prov.persona_contacto || '' : ''}" placeholder="Juan Perez" style="padding:10px 12px;font-size:13px;border:1px solid #e2e8f0;border-radius:8px;width:100%;box-sizing:border-box"></div>
                <div class="form-group" style="margin:0"><label style="font-size:10px;margin-bottom:2px;display:block;font-weight:600;color:#64748b">Especialidad</label><input class="form-control" id="provEspecialidad" value="${prov ? prov.especialidad || '' : ''}" placeholder="Motores, rodamientos..." style="padding:10px 12px;font-size:13px;border:1px solid #e2e8f0;border-radius:8px;width:100%;box-sizing:border-box"></div>
            </div>
            <div class="inv-form-grid" style="display:grid;grid-template-columns:1fr;gap:6px 10px;align-items:end;margin-top:4px">
                <div class="form-group" style="margin:0"><label style="font-size:10px;margin-bottom:2px;display:block;font-weight:600;color:#64748b">Observaciones</label><textarea class="form-control" id="provObs" rows="3" placeholder="Notas adicionales..." style="padding:10px 12px;font-size:13px;border:1px solid #e2e8f0;border-radius:8px;width:100%;box-sizing:border-box">${prov ? prov.observaciones || '' : ''}</textarea></div>
            </div>
            <div class="inv-form-grid" style="display:grid;grid-template-columns:1fr;gap:6px 10px;align-items:end;margin-top:4px">
                <div class="form-group" style="margin:0"><label style="font-size:10px;margin-bottom:2px;display:block;font-weight:600;color:#64748b">Estado</label>
                    <select class="form-control" id="provEstado" style="padding:10px 12px;font-size:13px;border:1px solid #e2e8f0;border-radius:8px;width:100%;box-sizing:border-box">
                        <option value="Activo" ${prov && prov.estado === 'Activo' ? 'selected' : ''}>Activo</option>
                        <option value="Inactivo" ${prov && prov.estado === 'Inactivo' ? 'selected' : ''}>Inactivo</option>
                    </select>
                </div>
            </div>
        `, { title: prov ? 'Editar Proveedor' : 'Nuevo Proveedor', lg: true });
        const footer = document.querySelector('#modalOverlay .modal-footer');
        footer.innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.proveedores.save(${id || 0})" style="padding:10px 28px;font-size:13px">${prov ? 'Actualizar' : 'Guardar'}</button>
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
});
