App.registerModule('machines', {
    async render() {
        const el = document.getElementById('page-machines');
        const maquinas = await db.getAll('machines');
        const tipos = await db.getAll('machine_types');
        const filterTipo = document.getElementById('filterTipoMaq')?.value || '';
        const filterEstado = document.getElementById('filterEstadoMaq')?.value || '';
        const searchTerm = (document.getElementById('searchMaquina')?.value || '').toLowerCase();
        let filtered = [...maquinas];
        if (filterTipo) filtered = filtered.filter(m => m.tipo_id === parseInt(filterTipo));
        if (filterEstado) filtered = filtered.filter(m => m.estado_operativo === filterEstado);
        if (searchTerm) filtered = filtered.filter(m => m.nombre.toLowerCase().includes(searchTerm) || (m.codigo || '').toLowerCase().includes(searchTerm));
        let rows = '';
        for (const m of filtered) {
            const tipo = tipos.find(t => t.id === m.tipo_id);
            rows += `<tr>
                <td><strong>${m.codigo || '-'}</strong></td>
                <td>${m.nombre}</td>
                <td>${tipo ? tipo.nombre : '-'}</td>
                <td>${m.marca || '-'}</td>
                <td>${m.ubicacion || '-'}</td>
                <td><span class="status-badge ${App.getEstadoClass(m.estado_operativo)}">${m.estado_operativo}</span></td>
                <td class="table-actions">
                    <button class="btn btn-sm btn-info" onclick="App.modules.machines.showDetail(${m.id})">👁️</button>
                    <button class="btn btn-sm btn-outline" onclick="App.modules.machines.showForm(${m.id})">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="App.modules.machines.delete(${m.id})">🗑️</button>
                </td>
            </tr>`;
        }
        el.innerHTML = `
            <div class="page-header">
                <div><h2>Máquinas</h2><div class="subtitle">Registro y control de equipos industriales</div></div>
                <button class="btn btn-primary" onclick="App.modules.machines.showForm()" style="white-space:nowrap">+ Nueva Máquina</button>
            </div>
            <div class="card">
                <div class="card-header">
                    <div class="flex items-center gap-16" style="flex-wrap:wrap">
                        <div class="search-box">
                            <span class="search-icon">🔍</span>
                            <input type="text" id="searchMaquina" placeholder="Buscar..." value="${searchTerm}" oninput="App.modules.machines.render()">
                        </div>
                        <select class="form-control" id="filterTipoMaq" style="width:auto;min-width:150px" onchange="App.modules.machines.render()">
                            <option value="">Todos los tipos</option>
                            ${tipos.map(t => `<option value="${t.id}" ${filterTipo === String(t.id) ? 'selected' : ''}>${t.nombre}</option>`).join('')}
                        </select>
                        <select class="form-control" id="filterEstadoMaq" style="width:auto;min-width:140px" onchange="App.modules.machines.render()">
                            <option value="">Todos los estados</option>
                            <option value="Operativo" ${filterEstado === 'Operativo' ? 'selected' : ''}>Operativo</option>
                            <option value="En mantención" ${filterEstado === 'En mantención' ? 'selected' : ''}>En mantención</option>
                            <option value="Detenido" ${filterEstado === 'Detenido' ? 'selected' : ''}>Detenido</option>
                        </select>
                        <button class="btn btn-success" onclick="App.modules.machines.exportExcel()" style="white-space:nowrap;margin-left:auto">📥 Exportar Excel</button>
                    </div>
                    <span class="text-muted">${filtered.length} de ${maquinas.length}</span>
                </div>
                <div class="card-body" style="padding:0">
                    ${filtered.length === 0 ? '<div class="empty-state"><div class="icon">🏭</div><h4>No se encontraron máquinas</h4></div>' : `
                    <table><thead><tr><th>Código</th><th>Nombre</th><th>Tipo</th><th>Marca</th><th>Ubicación</th><th>Estado</th><th>Acciones</th></tr></thead>
                    <tbody>${rows}</tbody></table>`}
                </div>
            </div>`;
    },

    async showForm(id) {
        const maq = id ? await db.getById('machines', id) : null;
        const tipos = await db.getAll('machine_types');
        const tipoId = maq ? maq.tipo_id : null;
        let compsHtml = '<span class="text-muted">Cargando componentes...</span>';
        App.showModal(`
            <div class="form-row">
                <div class="form-group"><label>Código *</label><input class="form-control" id="maqCodigo" value="${maq ? maq.codigo : ''}" placeholder="Ej: COM-001"></div>
                <div class="form-group"><label>Nombre *</label><input class="form-control" id="maqNombre" value="${maq ? maq.nombre : ''}" placeholder="Nombre del equipo"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Tipo *</label>
                    <select class="form-control" id="maqTipo" onchange="App.modules.machines.onTipoChange()">
                        <option value="">Seleccionar...</option>
                        ${tipos.map(t => `<option value="${t.id}" ${maq && maq.tipo_id === t.id ? 'selected' : ''}>${t.nombre}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group"><label>Estado</label>
                    <select class="form-control" id="maqEstado">
                        <option value="Operativo" ${maq && maq.estado_operativo === 'Operativo' ? 'selected' : ''}>Operativo</option>
                        <option value="En mantención" ${maq && maq.estado_operativo === 'En mantención' ? 'selected' : ''}>En mantención</option>
                        <option value="Detenido" ${maq && maq.estado_operativo === 'Detenido' ? 'selected' : ''}>Detenido</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Marca</label><input class="form-control" id="maqMarca" value="${maq ? maq.marca || '' : ''}"></div>
                <div class="form-group"><label>Modelo</label><input class="form-control" id="maqModelo" value="${maq ? maq.modelo || '' : ''}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Serie</label><input class="form-control" id="maqSerie" value="${maq ? maq.numero_serie || '' : ''}"></div>
                <div class="form-group"><label>Fecha Compra</label><input type="date" class="form-control" id="maqFechaCompra" value="${maq ? maq.fecha_compra || '' : ''}"></div>
            </div>
            <div class="form-group"><label>Ubicación</label><input class="form-control" id="maqUbicacion" value="${maq ? maq.ubicacion || '' : ''}"></div>
            <div class="form-group"><label>Observaciones</label><textarea class="form-control" id="maqObs">${maq ? maq.observaciones || '' : ''}</textarea></div>
            <div class="form-group"><label>Componentes asociados</label><div id="componentesPreview">${compsHtml}</div></div>
        `, { title: maq ? 'Editar Máquina' : 'Nueva Máquina', lg: true });
        const footer = document.querySelector('#modalOverlay .modal-footer');
        footer.innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.machines.save(${id || 0})">${maq ? 'Actualizar' : 'Guardar'}</button>
        `;
        if (tipoId) {
            try {
                const html = await this.renderComponentesCheckboxes(tipoId, id || null);
                const el = document.getElementById('componentesPreview');
                if (el) el.innerHTML = html;
            } catch(e) { console.error('Error loading components:', e); }
        } else {
            const el = document.getElementById('componentesPreview');
            if (el) el.innerHTML = '<span class="text-muted">Seleccione un tipo para ver sus componentes</span>';
        }
    },

    async onTipoChange() {
        const tipoId = parseInt(document.getElementById('maqTipo').value);
        const preview = document.getElementById('componentesPreview');
        if (!tipoId) { preview.innerHTML = '<span class="text-muted">Seleccione un tipo</span>'; return; }
        preview.innerHTML = await this.renderComponentesCheckboxes(tipoId, null);
    },

    async renderComponentesCheckboxes(tipoId, maquinaId) {
        if (!tipoId) return '<span class="text-muted">Seleccione un tipo</span>';
        const comps = await db.getComponentsByType(tipoId);
        if (comps.length === 0) return '<span class="text-muted">Sin componentes definidos</span>';
        let selectedIds = comps.map(c => c.id);
        if (maquinaId) {
            try {
                const saved = await db.getMachineComponents(maquinaId);
                if (saved && saved.length > 0) selectedIds = saved;
            } catch(e) { }
        }
        return `<div style="display:flex;flex-wrap:wrap;gap:8px">${comps.map(c => `
            <label style="display:flex;align-items:center;gap:4px;cursor:pointer;background:#f5f5f5;padding:4px 8px;border-radius:4px;font-size:12px">
                <input type="checkbox" class="maq-comp-check" value="${c.id}" ${selectedIds.includes(c.id) ? 'checked' : ''}> ${c.nombre}
            </label>
        `).join('')}</div>`;
    },

    async save(id) {
        try {
            const data = {
                codigo: document.getElementById('maqCodigo').value.trim().toUpperCase(),
                nombre: App.capitalize(document.getElementById('maqNombre').value.trim()),
                tipo_id: document.getElementById('maqTipo').value ? parseInt(document.getElementById('maqTipo').value) : null,
                marca: App.capitalize(document.getElementById('maqMarca').value.trim()),
                modelo: document.getElementById('maqModelo').value.trim().toUpperCase(),
                numero_serie: document.getElementById('maqSerie').value.trim().toUpperCase(),
                ubicacion: App.capitalize(document.getElementById('maqUbicacion').value.trim()),
                fecha_compra: document.getElementById('maqFechaCompra').value,
                estado_operativo: document.getElementById('maqEstado').value,
                observaciones: App.capitalize(document.getElementById('maqObs').value.trim())
            };
            if (!data.codigo || !data.nombre || !data.tipo_id) {
                App.showAlert('Código, nombre y tipo son obligatorios', 'danger'); return;
            }
            const existing = await db.getAll('machines');
            const duplicate = existing.find(m => m.codigo === data.codigo && m.id !== id);
            if (duplicate) {
                App.showAlert('Ya existe una máquina con el código: ' + data.codigo, 'danger'); return;
            }
            let machineId = id;
            if (id === 0) {
                const result = await db.insert('machines', data);
                machineId = result.id;
            } else {
                await db.update('machines', id, data);
            }
            const checkboxes = document.querySelectorAll('.maq-comp-check');
            const selectedComps = Array.from(checkboxes).filter(cb => cb.checked).map(cb => parseInt(cb.value));
            await db.saveMachineComponents(machineId, selectedComps);
            App.hideModal();
            App.showAlert(id === 0 ? 'Máquina creada' : 'Máquina actualizada');
            this.render();
        } catch(e) { App.showAlert('Error al guardar: ' + e.message, 'danger'); }
    },

    async showDetail(id) {
        const info = await db.getMachineWithDetails(id);
        if (!info) return;
        const { maquina, tipo, componentes, preventivos, correctivos } = info;
        let prevRows = '', corrRows = '';
        for (const p of preventivos) {
            const comp = await db.getById('components', p.componente_id).catch(() => null);
            prevRows += `<tr><td>${comp ? comp.nombre : '-'}</td><td>${App.formatDate(p.fecha_programada)}</td><td><span class="status-badge ${App.getEstadoClass(p.estado)}">${p.estado}</span></td></tr>`;
        }
        for (const c of correctivos) {
            const comp = await db.getById('components', c.componente_id).catch(() => null);
            corrRows += `<tr><td>${comp ? comp.nombre : '-'}</td><td>${App.formatDate(c.fecha_falla)}</td><td>${c.descripcion_falla}</td><td>${c.horas_detencion}</td></tr>`;
        }
        App.showModal(`
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
                <div><strong>Código:</strong> ${maquina.codigo}</div>
                <div><strong>Estado:</strong> <span class="status-badge ${App.getEstadoClass(maquina.estado_operativo)}">${maquina.estado_operativo}</span></div>
                <div><strong>Nombre:</strong> ${maquina.nombre}</div>
                <div><strong>Tipo:</strong> ${tipo ? tipo.nombre : '-'}</div>
                <div><strong>Marca:</strong> ${maquina.marca || '-'}</div>
                <div><strong>Modelo:</strong> ${maquina.modelo || '-'}</div>
                <div><strong>Serie:</strong> ${maquina.numero_serie || '-'}</div>
                <div><strong>Ubicación:</strong> ${maquina.ubicacion || '-'}</div>
                <div><strong>Fecha Compra:</strong> ${App.formatDate(maquina.fecha_compra)}</div>
            </div>
            <h4 style="margin:16px 0 8px">Componentes</h4>
            <div>${componentes.map(c => `<span class="status-badge status-programada">${c.nombre}</span>`).join(' ') || 'Ninguno'}</div>
            <h4 style="margin:16px 0 8px">Preventivos (${preventivos.length})</h4>
            ${preventivos.length === 0 ? '<p class="text-muted">Sin registros</p>' : `<table><thead><tr><th>Componente</th><th>Fecha Prog.</th><th>Estado</th></tr></thead><tbody>${prevRows}</tbody></table>`}
            <h4 style="margin:16px 0 8px">Fallas (${correctivos.length})</h4>
            ${correctivos.length === 0 ? '<p class="text-muted">Sin registros</p>' : `<table><thead><tr><th>Componente</th><th>Fecha</th><th>Falla</th><th>Horas Det.</th></tr></thead><tbody>${corrRows}</tbody></table>`}
        `, { title: `Ficha: ${maquina.nombre}`, lg: true });
        const footer = document.querySelector('#modalOverlay .modal-footer');
        footer.innerHTML = `<button class="btn btn-outline" onclick="App.hideModal()">Cerrar</button>`;
    },

    async delete(id) {
        try {
            const preventivos = await db.query('preventive_maintenance', p => p.maquina_id === id);
            const correctivos = await db.query('corrective_maintenance', c => c.maquina_id === id);
            if (preventivos.length > 0 || correctivos.length > 0) {
                App.showAlert('No se puede eliminar: tiene registros de mantenimiento', 'danger'); return;
            }
            const confirmed = await App.confirm('¿Eliminar esta máquina?');
            if (!confirmed) return;
            await db.delete('machines', id);
            App.showAlert('Máquina eliminada');
            this.render();
        } catch(e) { App.showAlert('Error al eliminar: ' + e.message, 'danger'); }
    },

    async exportExcel() {
        try {
            const maquinas = await db.getAll('machines');
            const tipos = await db.getAll('machine_types');
            const rows = maquinas.map(m => {
                const tipo = tipos.find(t => t.id === m.tipo_id);
                return {
                    'Código': m.codigo || '',
                    'Nombre': m.nombre || '',
                    'Tipo': tipo ? tipo.nombre : '',
                    'Marca': m.marca || '',
                    'Modelo': m.modelo || '',
                    'Ubicación': m.ubicacion || '',
                    'Estado': m.estado_operativo || '',
                    'Descripción': m.descripcion || ''
                };
            });
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Maquinas');
            XLSX.writeFile(wb, 'Maquinas_VitroFlow.xlsx');
            App.showAlert('Excel exportado correctamente');
        } catch(e) { App.showAlert('Error al exportar: ' + e.message, 'danger'); }
    }
});
