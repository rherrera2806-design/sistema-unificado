App.registerModule('corrective', {
    async render() {
        const el = document.getElementById('page-corrective');
        const registros = await db.getAll('corrective_maintenance');
        const [maquinas, componentes] = await Promise.all([
            db.getAll('machines'),
            db.getAll('components')
        ]);
        const maqMap = {};
        maquinas.forEach(m => { maqMap[m.id] = m; });
        const compMap = {};
        componentes.forEach(c => { compMap[c.id] = c; });
        const filterMaquina = document.getElementById('filterCorrMaq')?.value || '';
        let filtered = registros.map(r => ({
            ...r,
            maquinaNombre: maqMap[r.maquina_id] ? maqMap[r.maquina_id].nombre : '',
            componenteNombre: compMap[r.componente_id] ? compMap[r.componente_id].nombre : ''
        }));
        if (filterMaquina) filtered = filtered.filter(r => r.maquina_id === parseInt(filterMaquina));
        filtered.sort((a, b) => (b.fecha_falla || '').localeCompare(a.fecha_falla || ''));

        el.innerHTML = `
            <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:12px;padding:6px 14px;margin-bottom:16px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">
            <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
            <div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center"><div><h2 style="margin:0;font-size:14px;font-weight:800;color:white;letter-spacing:-0.5px">Mantenccion Correctiva</h2>
            <p style="margin:2px 0 0;font-size:9px;color:rgba(255,255,255,0.7)">Registro de fallas y acciones correctivas</p></div>
            <div style="display:flex;gap:6px;align-items:center">
                <div style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.2);border-radius:6px;padding:3px 8px;text-align:center"><div style="font-size:8px;color:rgba(255,255,255,0.7);text-transform:uppercase;font-weight:600">Reparadas</div><div style="font-size:14px;font-weight:800;color:white;line-height:1.2">${registros.filter(r => r.estado === 'Reparada').length}</div></div>
                <div style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.2);border-radius:6px;padding:3px 8px;text-align:center"><div style="font-size:8px;color:rgba(255,255,255,0.7);text-transform:uppercase;font-weight:600">Pendientes</div><div style="font-size:14px;font-weight:800;color:white;line-height:1.2">${registros.filter(r => r.estado !== 'Reparada').length}</div></div>
                <button class="btn btn-primary" style="padding:5px 12px;font-size:12px" onclick="App.modules.corrective.showForm()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo</button>
                </div></div>
            </div>
            <div class="stats-grid">
                <div class="stat-card dash-card" style="border-left:4px solid #3b82f6">
                    <div class="stat-icon blue"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Total Fallas</p><p class="stat-sub">Registradas</p></div>
                    <div class="stat-value">${registros.length}</div>
                </div>
                <div class="stat-card dash-card" style="border-left:4px solid #f59e0b">
                    <div class="stat-icon orange"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></div>
                    <div class="stat-info"><p class="stat-label">En Mantencion</p><p class="stat-sub">Sin reparar</p></div>
                    <div class="stat-value">${registros.filter(r => r.estado === 'En Mantención').length}</div>
                </div>
                <div class="stat-card dash-card" style="border-left:4px solid #22c55e">
                    <div class="stat-icon green"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" style="vertical-align:-2px"><polyline points="20 6 9 17 4 12"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Reparadas</p><p class="stat-sub">Resueltas</p></div>
                    <div class="stat-value">${registros.filter(r => r.estado === 'Reparada').length}</div>
                </div>
                <div class="stat-card dash-card" style="border-left:4px solid #ef4444">
                    <div class="stat-icon red"><svg width="12" height="12" viewBox="0 0 24 24" fill="#ef4444" style="vertical-align:-2px"><circle cx="12" cy="12" r="6"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Detenidas</p><p class="stat-sub">Fuera de operacion</p></div>
                    <div class="stat-value">${registros.filter(r => r.estado === 'Detenido').length}</div>
                </div>
            </div>
            <style>
@keyframes corr_fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.corr-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}
.corr-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important;transform:translateY(-3px)}
.corr-row{transition:all 0.2s}
.corr-row:hover{transform:translateX(2px);background:#f8fafc!important}
</style>
            <div class="card corr-card">
                <div class="card-header">
                    <select class="form-control" id="filterCorrMaq" style="width:auto;min-width:180px" onchange="App.modules.corrective.render()">
                        <option value="">Todas las máquinas</option>
                        ${maquinas.map(m => `<option value="${m.id}" ${filterMaquina === String(m.id) ? 'selected' : ''}>${m.nombre}</option>`).join('')}
                    </select>
                    <span class="text-muted">${filtered.length} registros</span>
                </div>
                <div class="card-body" style="padding:0">
                    ${filtered.length === 0 ? '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">No hay fallas registradas</h4><p style="margin:0;color:#94a3b8;font-size:13px">Registra la primera falla</p></div>' : `
                    <table><thead><tr><th>Máquina</th><th>Componente</th><th>Fecha</th><th>Descripción</th><th>Estado</th><th>Días</th><th>Hs.Det.</th><th>Responsable</th><th>Acciones</th></tr></thead>
                    <tbody>${filtered.map(r => {
                        const dias = r.estado === 'Reparada' && r.fecha_falla && r.fecha_reparacion ? Math.round((new Date(r.fecha_reparacion) - new Date(r.fecha_falla)) / 86400000) : '-';
                        return `<tr>
                        <td>${r.maquinaNombre}</td><td>${r.componenteNombre}</td>
                        <td>${App.formatDate(r.fecha_falla)}</td>
                        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(r.descripcion_falla || '').replace(/"/g, '&quot;')}">${r.descripcion_falla || '-'}</td>
                        <td><span class="status-badge ${r.estado === 'Reparada' ? 'status-realizada' : 'status-mantenimiento'}">${r.estado || 'En Mantención'}</span></td>
                        <td>${dias}</td>
                        <td>${r.horas_detencion}</td>
                        <td>${r.responsable || '-'}</td>
                        <td class="table-actions">
                            <button class="btn btn-sm btn-info" title="Ver detalle" onclick="App.modules.corrective.showDetail(${r.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
                            <button class="btn btn-sm btn-outline" title="Editar" onclick="App.modules.corrective.showForm(${r.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                            <button class="btn btn-sm btn-danger" title="Eliminar" onclick="App.modules.corrective.delete(${r.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                        </td>
                    </tr>`}).join('')}</tbody></table>`}
                </div>
            </div>`;
    },

    async showForm(id) {
        if (!window.correctiveToggleReparacion) {
            window.correctiveToggleReparacion = () => {
                const group = document.getElementById('corrFechaRepGroup');
                group.style.display = document.getElementById('corrEstado').value === 'Reparada' ? '' : 'none';
            };
        }
        const reg = id ? await db.getById('corrective_maintenance', id) : null;
        const maquinas = await db.getAll('machines');
        let componentes = await db.getAll('components');
        if (reg && reg.maquina_id) {
            const maq = await db.getById('machines', reg.maquina_id).catch(() => null);
            if (maq && maq.tipo_id) {
                componentes = await db.getComponentsByType(maq.tipo_id);
            }
        }
        const isReparada = reg && reg.estado === 'Reparada';
        App.showModal(`
            <div class="form-row">
                <div class="form-group"><label>Máquina *</label>
                    <select class="form-control" id="corrMaquina" onchange="App.modules.corrective.updateComponentes()">
                        <option value="">Seleccionar...</option>
                        ${maquinas.map(m => `<option value="${m.id}" ${reg && reg.maquina_id === m.id ? 'selected' : ''}>${m.codigo} - ${m.nombre}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group"><label>Componente *</label>
                    <select class="form-control" id="corrComponente">
                        <option value="">Seleccionar...</option>
                        ${componentes.map(c => `<option value="${c.id}" ${reg && reg.componente_id === c.id ? 'selected' : ''}>${c.nombre}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Fecha Falla *</label><input type="date" class="form-control" id="corrFecha" value="${reg ? reg.fecha_falla : ''}"></div>
                <div class="form-group"><label>Horas Detención</label><input type="number" class="form-control" id="corrHoras" value="${reg ? reg.horas_detencion : 0}" min="0" step="0.5"></div>
                <div class="form-group"><label>Turno</label>
                    <select class="form-control" id="corrTurno">
                        <option value="Dia" ${reg && reg.turno === 'Dia' ? 'selected' : ''}>Día</option>
                        <option value="Noche" ${reg && reg.turno === 'Noche' ? 'selected' : ''}>Noche</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Estado</label>
                    <select class="form-control" id="corrEstado" onchange="correctiveToggleReparacion()">
                        <option value="En Mantención" ${(reg && reg.estado === 'En Mantención') || !reg ? 'selected' : ''}>En Mantención</option>
                        <option value="Reparada" ${isReparada ? 'selected' : ''}>Reparada</option>
                    </select>
                </div>
                <div class="form-group" id="corrFechaRepGroup" style="display:${isReparada ? '' : 'none'}"><label>Fecha Reparación</label><input type="date" class="form-control" id="corrFechaRep" value="${reg ? reg.fecha_reparacion || '' : ''}"></div>
            </div>
            <div class="form-group"><label>Descripción de la Falla *</label><textarea class="form-control" id="corrDescripcion" placeholder="Describa la falla">${reg ? reg.descripcion_falla || '' : ''}</textarea></div>
            <div class="form-group"><label>Diagnóstico</label><textarea class="form-control" id="corrDiagnostico" placeholder="Causa raíz">${reg ? reg.diagnostico || '' : ''}</textarea></div>
            <div class="form-group"><label>Acción Correctiva</label><textarea class="form-control" id="corrAccion" placeholder="Acciones realizadas">${reg ? reg.accion_correctiva || '' : ''}</textarea></div>
            <div class="form-group"><label>Repuestos Utilizados</label><textarea class="form-control" id="corrRepuestos" placeholder="Detalle de repuestos">${reg ? reg.repuestos_utilizados || '' : ''}</textarea></div>
                <div class="form-group"><label>Técnico</label><input class="form-control" id="corrResponsable" value="${reg ? reg.responsable || '' : ''}"></div>
            <div class="form-group"><label>Imágenes</label>
                <input type="file" id="corrImagenes" multiple accept="image/*" onchange="App.modules.corrective.previewImages()" style="display:none">
                <button class="btn btn-outline" onclick="document.getElementById('corrImagenes').click()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Adjuntar imágenes</button>
                <div id="corrImagePreview" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">${this.renderExistingImages(reg)}</div>
            </div>
        `, { title: reg ? 'Editar Falla' : 'Registrar Falla', lg: true });
        const footer = document.querySelector('#modalOverlay .modal-footer');
        footer.innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.corrective.save(${id || 0})">${reg ? 'Actualizar' : 'Guardar'}</button>
        `;
    },

    async updateComponentes() {
        const maqId = parseInt(document.getElementById('corrMaquina').value);
        const select = document.getElementById('corrComponente');
        if (!maqId) { select.innerHTML = '<option value="">Seleccionar...</option>'; return; }
        const maq = await db.getById('machines', maqId);
        if (!maq) return;
        const comps = await db.getComponentsByType(maq.tipo_id);
        select.innerHTML = '<option value="">Seleccionar...</option>' + comps.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    },

    _newImages: [],

    renderExistingImages(reg) {
        if (!reg || !reg.imagenes) return '';
        try {
            const imgs = JSON.parse(reg.imagenes);
            return imgs.map((src, i) => `
                <div style="position:relative;display:inline-block">
                    <img src="${src}" onclick="App.modules.corrective.viewImage('${src.replace(/'/g, "\\'")}')" style="width:60px;height:60px;object-fit:cover;border-radius:4px;cursor:pointer;border:1px solid var(--border)">
                    <button onclick="App.modules.corrective.removeExistingImage(${i})" style="position:absolute;top:-4px;right:-4px;background:#dc3545;color:#fff;border:none;border-radius:50%;width:16px;height:16px;font-size:10px;cursor:pointer;line-height:1">&times;</button>
                </div>
            `).join('');
        } catch(e) { return ''; }
    },

    previewImages() {
        const input = document.getElementById('corrImagenes');
        const container = document.getElementById('corrImagePreview');
        if (!input.files || input.files.length === 0) return;
        const reg = this._currentReg || null;
        if (!this._newImages) this._newImages = [];
        Array.from(input.files).forEach(file => {
            const reader = new FileReader();
            reader.onload = function(e) {
                App.modules.corrective._newImages.push(e.target.result);
                const idx = App.modules.corrective._newImages.length - 1;
                const div = document.createElement('div');
                div.style.cssText = 'position:relative;display:inline-block';
                div.innerHTML = `
                    <img src="${e.target.result}" onclick="App.modules.corrective.viewImage(this.src)" style="width:60px;height:60px;object-fit:cover;border-radius:4px;cursor:pointer;border:1px solid var(--border)">
                    <button onclick="App.modules.corrective.removeNewImage(${idx}, this.parentElement)" style="position:absolute;top:-4px;right:-4px;background:#dc3545;color:#fff;border:none;border-radius:50%;width:16px;height:16px;font-size:10px;cursor:pointer;line-height:1">&times;</button>
                `;
                container.appendChild(div);
            };
            reader.readAsDataURL(file);
        });
        input.value = '';
    },

    removeNewImage(idx, el) {
        if (this._newImages) this._newImages[idx] = null;
        if (el) el.remove();
    },

    removeExistingImage(idx) {
        const reg = this._currentReg;
        if (!reg || !reg.imagenes) return;
        try {
            const imgs = JSON.parse(reg.imagenes);
            imgs.splice(idx, 1);
            reg.imagenes = JSON.stringify(imgs);
            const container = document.getElementById('corrImagePreview');
            container.innerHTML = this.renderExistingImages(reg);
        } catch(e) {}
    },

    viewImage(src) {
        App.showModal(`<img src="${src}" style="width:100%;max-height:70vh;object-fit:contain;border-radius:4px">`, { title: 'Vista de imagen' });
        const footer = document.querySelector('#modalOverlay .modal-footer');
        footer.innerHTML = '<button class="btn btn-outline" onclick="App.hideModal()">Cerrar</button>';
    },

    async showDetail(id) {
        const r = await db.getById('corrective_maintenance', id);
        if (!r) return;
        const maq = await db.getById('machines', r.maquina_id).catch(() => null);
        const comp = await db.getById('components', r.componente_id).catch(() => null);
        const dias = r.estado === 'Reparada' && r.fecha_falla && r.fecha_reparacion ? Math.round((new Date(r.fecha_reparacion) - new Date(r.fecha_falla)) / 86400000) : '-';
        App.showModal(`
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div><strong>Máquina:</strong> ${maq ? maq.nombre : '-'}</div>
                <div><strong>Componente:</strong> ${comp ? comp.nombre : '-'}</div>
                <div><strong>Fecha Falla:</strong> ${App.formatDate(r.fecha_falla)}</div>
                <div><strong>Estado:</strong> ${r.estado || 'En Mantención'}</div>
                <div><strong>Fecha Rep.:</strong> ${App.formatDate(r.fecha_reparacion)}</div>
                <div><strong>Días:</strong> ${dias}</div>
                <div><strong>Horas Det.:</strong> ${r.horas_detencion}</div>
                <div><strong>Técnico:</strong> ${r.responsable || '-'}</div>
                <div><strong>Turno:</strong> ${r.turno || 'Dia'}</div>
            </div>
            <hr style="margin:12px 0;border:none;border-top:1px solid var(--border)">
            <div class="form-group"><label style="font-weight:600">Falla</label><p>${r.descripcion_falla || '-'}</p></div>
            <div class="form-group"><label style="font-weight:600">Diagnóstico</label><p>${r.diagnostico || '-'}</p></div>
            <div class="form-group"><label style="font-weight:600">Acción Correctiva</label><p>${r.accion_correctiva || '-'}</p></div>
            <div class="form-group"><label style="font-weight:600">Repuestos</label><p>${r.repuestos_utilizados || '-'}</p></div>
            ${r.imagenes ? (() => { try { const imgs = JSON.parse(r.imagenes); return imgs.length > 0 ? `<div class="form-group"><label style="font-weight:600">Imágenes</label><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">${imgs.map(src => `<img src="${src}" onclick="App.modules.corrective.viewImage('${src.replace(/'/g, "\\'")}')" style="width:80px;height:80px;object-fit:cover;border-radius:4px;cursor:pointer;border:1px solid var(--border)">`).join('')}</div></div>` : ''; } catch(e) { return ''; } })() : ''}
        `, { title: 'Detalle de Falla' });
        const footer = document.querySelector('#modalOverlay .modal-footer');
        footer.innerHTML = `<button class="btn btn-outline" onclick="App.hideModal()">Cerrar</button>`;
    },

    async save(id) {
        try {
            let existingImgs = [];
            if (id > 0) {
                try {
                    const reg = await db.getById('corrective_maintenance', id);
                    if (reg && reg.imagenes) existingImgs = JSON.parse(reg.imagenes);
                } catch(e) {}
            }
            const newImgs = (this._newImages || []).filter(img => img);
            const allImgs = [...existingImgs, ...newImgs];
            const data = {
                maquina_id: parseInt(document.getElementById('corrMaquina').value),
                componente_id: parseInt(document.getElementById('corrComponente').value),
                fecha_falla: document.getElementById('corrFecha').value,
                descripcion_falla: App.capitalize(document.getElementById('corrDescripcion').value.trim()),
                diagnostico: App.capitalize(document.getElementById('corrDiagnostico').value.trim()),
                accion_correctiva: App.capitalize(document.getElementById('corrAccion').value.trim()),
                repuestos_utilizados: App.capitalize(document.getElementById('corrRepuestos').value.trim()),
                horas_detencion: parseFloat(document.getElementById('corrHoras').value) || 0,
                estado: document.getElementById('corrEstado').value,
                fecha_reparacion: document.getElementById('corrEstado').value === 'Reparada' ? document.getElementById('corrFechaRep').value : '',
                responsable: App.capitalize(document.getElementById('corrResponsable').value.trim()),
                turno: document.getElementById('corrTurno').value,
                imagenes: allImgs.length > 0 ? JSON.stringify(allImgs) : null
            };
            this._newImages = [];
            if (!data.maquina_id || !data.componente_id || !data.fecha_falla || !data.descripcion_falla) {
                App.showAlert('Complete los campos obligatorios', 'danger'); return;
            }
            if (id === 0) await db.insert('corrective_maintenance', data);
            else await db.update('corrective_maintenance', id, data);
            App.hideModal();
            App.showAlert(id === 0 ? 'Falla registrada' : 'Registro actualizado');
            this.render();
        } catch(e) { App.showAlert('Error al guardar: ' + e.message, 'danger'); }
    },

    async delete(id) {
        try {
            const confirmed = await App.confirm('¿Eliminar este registro?');
            if (!confirmed) return;
            await db.delete('corrective_maintenance', id);
            App.showAlert('Registro eliminado');
            this.render();
        } catch(e) { App.showAlert('Error al eliminar: ' + e.message, 'danger'); }
    }
});
