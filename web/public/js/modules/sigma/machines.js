App.registerModule('machines', {
    async render() {
        const el = document.getElementById('page-machines');
        const maquinas = await db.getAll('machines');
        const tipos = await db.getAll('machine_types');
        const allPrev = await db.getAll('preventive_maintenance');
        const compsPerMachine = {};
        allPrev.forEach(p => {
            if (!compsPerMachine[p.maquina_id]) compsPerMachine[p.maquina_id] = new Set();
            compsPerMachine[p.maquina_id].add(p.componente_id);
        });
        const filterTipo = document.getElementById('filterTipoMaq')?.value || '';
        const filterEstado = document.getElementById('filterEstadoMaq')?.value || '';
        const searchTerm = (document.getElementById('searchMaquina')?.value || '').toLowerCase();
        let filtered = [...maquinas];
        if (filterTipo) filtered = filtered.filter(m => m.tipo_id === parseInt(filterTipo));
        if (filterEstado) filtered = filtered.filter(m => m.estado_operativo === filterEstado);
        if (searchTerm) filtered = filtered.filter(m => m.nombre.toLowerCase().includes(searchTerm) || (m.codigo || '').toLowerCase().includes(searchTerm));
        let rows = '';
        let cardsHtml = '';
        for (const m of filtered) {
            const tipo = tipos.find(t => t.id === m.tipo_id);
            const nComps = compsPerMachine[m.id] ? compsPerMachine[m.id].size : 0;
            const compBadge = nComps > 0
                ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;background:#dcfce7;color:#166534;border:1px solid #bbf7d0"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>${nComps}</span>`
                : `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>0</span>`;
            rows += `<tr>
                <td><strong>${m.codigo || '-'}</strong></td>
                <td>${m.nombre}</td>
                <td>${tipo ? tipo.nombre : '-'}</td>
                <td>${compBadge}</td>
                <td><span class="status-badge ${App.getEstadoClass(m.estado_operativo)}">${m.estado_operativo}</span></td>
                <td class="table-actions">
                    <button class="btn btn-sm btn-info" title="Ver detalle" onclick="App.modules.machines.showDetail(${m.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
                    <button class="btn btn-sm btn-outline" title="Editar" onclick="App.modules.machines.showForm(${m.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                    <button class="btn btn-sm btn-danger" title="Eliminar" onclick="App.modules.machines.delete(${m.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                </td>
            </tr>`;
        }
        cardsHtml = SigmaCards.generate({
            title: m => `<strong>${m.codigo || '-'}</strong>`,
            subtitle: m => m.nombre,
            badge: m => `<span class="sc-badge" style="background:${m.estado_operativo === 'Operativo' ? '#dcfce7;color:#166534' : m.estado_operativo === 'En mantención' ? '#fef9c3;color:#854d0e' : '#fee2e2;color:#991b1b'}">${m.estado_operativo}</span>`,
            fields: [
                { label: 'Tipo', value: m => { const t = tipos.find(t => t.id === m.tipo_id); return t ? t.nombre : '-'; } }
            ],
            actions: m => `
                <button class="btn btn-sm btn-info" onclick="App.modules.machines.showDetail(${m.id})">Ver</button>
                <button class="btn btn-sm btn-outline" onclick="App.modules.machines.showForm(${m.id})">Editar</button>
                <button class="btn btn-sm btn-danger" onclick="App.modules.machines.delete(${m.id})">Eliminar</button>`
        }, filtered);
        el.innerHTML = `
            <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:8px 16px;margin-bottom:16px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">
            <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
            <div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center"><div><h2 style="margin:0;font-size:15px;font-weight:800;color:white;letter-spacing:-0.5px">Maquinas</h2>
            <p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Registro y control de equipos industriales</p></div>
            <div style="display:flex;gap:6px;align-items:center">
                <button class="btn btn-primary" style="padding:5px 12px;font-size:12px" onclick="App.modules.machines.showForm()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo</button>
                <button class="btn btn-outline" style="color:white;border-color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.1);padding:5px 12px;font-size:12px" onclick="App.modules.machines.exportExcel()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Exportar Excel</button>
                </div></div></div>
            <div class="stats-grid">
                <div class="stat-card dash-card" style="border-left:4px solid #3b82f6">
                    <div class="stat-icon blue"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M2 20h20"/><path d="M5 20V8l5 4V8l5 4V4h3v16"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Total Maquinas</p><p class="stat-sub">Registradas en sistema</p></div>
                    <div class="stat-value">${maquinas.length}</div>
                </div>
                <div class="stat-card dash-card" style="border-left:4px solid #22c55e">
                    <div class="stat-icon green"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" style="vertical-align:-2px"><polyline points="20 6 9 17 4 12"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Operativas</p><p class="stat-sub">En pleno funcionamiento</p></div>
                    <div class="stat-value">${maquinas.filter(m => m.estado_operativo === 'Operativo').length}</div>
                </div>
                <div class="stat-card dash-card" style="border-left:4px solid #f59e0b">
                    <div class="stat-icon orange"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></div>
                    <div class="stat-info"><p class="stat-label">En Mantencion</p><p class="stat-sub">En proceso de servicio</p></div>
                    <div class="stat-value">${maquinas.filter(m => m.estado_operativo === 'En mantención').length}</div>
                </div>
                <div class="stat-card dash-card" style="border-left:4px solid #ef4444">
                    <div class="stat-icon red"><svg width="12" height="12" viewBox="0 0 24 24" fill="#ef4444" style="vertical-align:-2px"><circle cx="12" cy="12" r="6"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Detenidas</p><p class="stat-sub">Fuera de operacion</p></div>
                    <div class="stat-value">${maquinas.filter(m => m.estado_operativo === 'Detenido').length}</div>
                </div>
            </div>
            <style>
@keyframes mach_fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.mach-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}
.mach-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important;transform:translateY(-3px)}
.mach-row{transition:all 0.2s}
.mach-row:hover{transform:translateX(2px);background:#f8fafc!important}
</style>
            <div class="card mach-card">
                <div class="card-header">
                    <div class="flex items-center gap-16" style="flex-wrap:wrap">
                        <div class="search-box">
                            <span class="search-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
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
                    </div>
                    <span class="text-muted">${filtered.length} de ${maquinas.length}</span>
                </div>
                <div class="card-body" style="padding:0">
                    <div class="sigma-table-wrap">
                    ${filtered.length === 0 ? '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">No se encontraron máquinas</h4><p style="margin:0;color:#94a3b8;font-size:13px">Intenta con otros filtros</p></div>' : `
                    <table><thead><tr><th>Código</th><th>Nombre</th><th>Tipo</th><th>Componentes</th><th>Estado</th><th>Acciones</th></tr></thead>
                    <tbody>${rows}</tbody></table>
                    ${cardsHtml}`}
                    </div>
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
    }
});
