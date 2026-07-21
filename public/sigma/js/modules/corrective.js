App.registerModule('corrective', {
    async render() {
        const el = document.getElementById('page-corrective');
        const filterMaquina = document.getElementById('filterCorrMaq')?.value || '';

        const data = await fetch('/api/sigma/corrective-data').then(r => r.json()).catch(() => ({ correctivos: [], maquinas: [], componentes: [] }));
        const registros = data.correctivos || [];
        const maquinas = data.maquinas || [];
        const maqMap = {};
        (data.maquinas || []).forEach(m => { maqMap[m.id] = m; });
        const compMap = {};
        (data.componentes || []).forEach(c => { compMap[c.id] = c; });

        let filtered = registros.map(r => ({
            ...r,
            maquinaNombre: maqMap[r.maquina_id] ? maqMap[r.maquina_id].nombre : '',
            componenteNombre: compMap[r.componente_id] ? compMap[r.componente_id].nombre : ''
        }));
        if (filterMaquina) filtered = filtered.filter(r => r.maquina_id === parseInt(filterMaquina));
        filtered.sort((a, b) => (b.fecha_falla || '').localeCompare(a.fecha_falla || ''));

        el.innerHTML = `
            <div class="page-header">
                <div><h2>Mantención Correctiva</h2><div class="subtitle">Registro de fallas y acciones correctivas</div></div>
                <button class="btn btn-danger" onclick="App.modules.corrective.showForm()">+ Registrar Falla</button>
            </div>
            <div class="card">
                <div class="card-header">
                    <select class="form-control" id="filterCorrMaq" style="width:auto;min-width:180px" onchange="App.modules.corrective.render()">
                        <option value="">Todas las máquinas</option>
                        ${maquinas.map(m => `<option value="${m.id}" ${filterMaquina === String(m.id) ? 'selected' : ''}>${m.nombre}</option>`).join('')}
                    </select>
                    <span class="text-muted">${filtered.length} registros</span>
                </div>
                <div class="card-body" style="padding:0">
                    ${filtered.length === 0 ? '<div class="empty-state"><div class="icon">🔴</div><h4>No hay fallas registradas</h4></div>' : `
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
                            <button class="btn btn-sm btn-info" onclick="App.modules.corrective.showDetail(${r.id})">👁️</button>
                            <button class="btn btn-sm btn-outline" onclick="App.modules.corrective.showForm(${r.id})">✏️</button>
                            <button class="btn btn-sm btn-danger" onclick="App.modules.corrective.delete(${r.id})">🗑️</button>
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
                <button class="btn btn-outline" onclick="document.getElementById('corrImagenes').click()">📷 Adjuntar imágenes</button>
                <div id="corrImagePreview" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">${this.renderExistingImages(reg)}</div>
            </div>
        `, { title: reg ? 'Editar Falla' : 'Registrar Falla', lg: true });
        const footer = document.querySelector('#modalOverlay .modal-footer');
        footer.innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-danger" onclick="App.modules.corrective.save(${id || 0})">${reg ? 'Actualizar' : 'Guardar'}</button>
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
