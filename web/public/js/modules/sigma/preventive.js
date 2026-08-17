App.registerModule('preventive', {
    async render() {
        const el = document.getElementById('page-preventive');
        const registros = await db.getAll('preventive_maintenance');
        const [maquinas, componentes] = await Promise.all([
            db.getAll('machines'),
            db.getAll('components')
        ]);
        const maqMap = {};
        maquinas.forEach(m => { maqMap[m.id] = m; });
        const compMap = {};
        componentes.forEach(c => { compMap[c.id] = c; });
        const filterEstado = document.getElementById('filterPrevEstado')?.value || 'Programada';
        const filterMaquina = document.getElementById('filterPrevMaq')?.value || '';
        let filtered = registros.map(r => ({
            ...r,
            maquinaNombre: maqMap[r.maquina_id] ? maqMap[r.maquina_id].nombre : '',
            componenteNombre: compMap[r.componente_id] ? compMap[r.componente_id].nombre : ''
        }));
        if (filterEstado) filtered = filtered.filter(r => r.estado === filterEstado);
        if (filterMaquina) filtered = filtered.filter(r => r.maquina_id === parseInt(filterMaquina));
        const dir = this._sortDir === 'asc' ? 1 : -1;
        filtered.sort((a, b) => {
            const fa = (a.fecha_programada || '9999-12-31');
            const fb = (b.fecha_programada || '9999-12-31');
            if (fa !== fb) return fa.localeCompare(fb) * dir;
            return ((a.id || 0) - (b.id || 0)) * dir;
        });
        const today = new Date().toISOString().split('T')[0];

        el.innerHTML = `
            <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:8px 16px;margin-bottom:16px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">
            <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
            <div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center"><div><h2 style="margin:0;font-size:15px;font-weight:800;color:white;letter-spacing:-0.5px">Mantenccion Preventiva</h2>
            <p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Programacion y control de mantenciones periodicas</p></div>
            <div style="display:flex;gap:6px;align-items:center">
                <button class="btn btn-accent" style="padding:5px 12px;font-size:12px" onclick="App.modules.preventive.autoProgram()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Auto-programar</button>
                <button class="btn btn-primary" style="padding:5px 12px;font-size:12px" onclick="App.modules.preventive.showForm()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo</button>
                </div></div>
            </div>
            <div class="stats-grid">
                <div class="stat-card dash-card" style="border-left:4px solid #3b82f6">
                    <div class="stat-icon blue"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Total</p><p class="stat-sub">Mantenciones</p></div>
                    <div class="stat-value">${registros.length}</div>
                </div>
                <div class="stat-card dash-card" style="border-left:4px solid #22c55e">
                    <div class="stat-icon green"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" style="vertical-align:-2px"><polyline points="20 6 9 17 4 12"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Realizadas</p><p class="stat-sub">Completadas</p></div>
                    <div class="stat-value">${registros.filter(r => r.estado === 'Realizada').length}</div>
                </div>
                <div class="stat-card dash-card" style="border-left:4px solid #f59e0b">
                    <div class="stat-icon orange"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Programadas</p><p class="stat-sub">Pendientes</p></div>
                    <div class="stat-value">${registros.filter(r => r.estado === 'Programada').length}</div>
                </div>
                <div class="stat-card dash-card" style="border-left:4px solid #ef4444">
                    <div class="stat-icon red"><svg width="12" height="12" viewBox="0 0 24 24" fill="#ef4444" style="vertical-align:-2px"><circle cx="12" cy="12" r="6"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Vencidas</p><p class="stat-sub">Requieren accion</p></div>
                    <div class="stat-value">${registros.filter(r => r.estado === 'Vencida').length}</div>
                </div>
            </div>
            <style>
@keyframes prev_fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.prev-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}
.prev-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important;transform:translateY(-3px)}
.prev-row{transition:all 0.2s}
.prev-row:hover{transform:translateX(2px);background:#f8fafc!important}
</style>
            <div class="card prev-card">
                <div class="card-header">
                    <div class="flex items-center gap-16" style="flex-wrap:wrap">
                        <select class="form-control" id="filterPrevMaq" style="width:auto;min-width:180px" onchange="App.modules.preventive.render()">
                            <option value="">Todas las máquinas</option>
                            ${maquinas.map(m => `<option value="${m.id}" ${filterMaquina === String(m.id) ? 'selected' : ''}>${m.nombre}</option>`).join('')}
                        </select>
                        <select class="form-control" id="filterPrevEstado" style="width:auto;min-width:130px" onchange="App.modules.preventive.render()">
                            <option value="">Todos</option>
                            <option value="Programada" ${(!filterEstado || filterEstado === 'Programada') ? 'selected' : ''}>Programada</option>
                            <option value="Realizada" ${filterEstado === 'Realizada' ? 'selected' : ''}>Realizada</option>
                            <option value="Vencida" ${filterEstado === 'Vencida' ? 'selected' : ''}>Vencida</option>
                        </select>
                    </div>
                </div>
                <div class="card-body" style="padding:0">
                    <div class="sigma-table-wrap">
                    ${filtered.length === 0 ? '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">No hay registros</h4><p style="margin:0;color:#94a3b8;font-size:13px">Registra la primera mantención preventiva</p></div>' : `
                    <table><thead><tr><th>Máquina</th><th>Componente</th><th>Checklist</th><th onclick="App.modules.preventive.toggleSort()" style="cursor:pointer;user-select:none" title="Click para cambiar orden">Fecha Prog. <span id="prev-sort-icon">▲</span></th><th>Fecha Ejec.</th><th>Días</th><th>Hs.Oc.</th><th>Técnico</th><th>Estado</th><th>Acciones</th></tr></thead>
                    <tbody>${filtered.map(r => {
                        const dias = r.fecha_programada && r.fecha_ejecutada ? Math.round((new Date(r.fecha_ejecutada) - new Date(r.fecha_programada)) / 86400000) : '-';
                        const isVencida = r.estado !== 'Realizada' && r.fecha_programada && r.fecha_programada < today;
                        const rowStyle = isVencida ? 'background:#fff3f3;' : '';
                        const checklistPreview = r.checklist ? r.checklist.split('\n').slice(0, 2).join(', ').substring(0, 40) + (r.checklist.length > 40 ? '...' : '') : '-';
                        return `<tr style="${rowStyle}">
                        <td>${r.maquinaNombre}</td><td>${r.componenteNombre}</td>
                        <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(r.checklist || '').replace(/"/g, '&quot;')}">${checklistPreview}</td>
                        <td>${App.formatDate(r.fecha_programada)}</td>
                        <td>${App.formatDate(r.fecha_ejecutada)}</td>
                        <td>${dias}</td>
                        <td>${r.horas_ocupadas || 0}</td>
                        <td>${r.tecnico || 'Pendiente'}</td>
                        <td><span class="status-badge ${App.getEstadoClass(isVencida ? 'Vencida' : r.estado)}">${isVencida ? 'Vencida' : r.estado}</span></td>
                        <td class="table-actions">
                            <button class="btn btn-sm btn-outline" title="Editar" onclick="App.modules.preventive.showForm(${r.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                            <button class="btn btn-sm btn-danger" title="Eliminar" onclick="App.modules.preventive.delete(${r.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                        </td>
                    </tr>`}).join('')}</tbody></table>
                    ${SigmaCards.generate({
                        title: r => `<strong>${r.maquinaNombre}</strong>`,
                        subtitle: r => r.componenteNombre,
                        badge: r => { const isV = r.estado !== 'Realizada' && r.fecha_programada && r.fecha_programada < today; return `<span class="sc-badge" style="background:${isV ? '#fee2e2;color:#991b1b' : r.estado === 'Realizada' ? '#dcfce7;color:#166534' : '#dbeafe;color:#1e40af'}">${isV ? 'Vencida' : r.estado}</span>`; },
                        fields: [
                            { label: 'Fecha', value: r => App.formatDate(r.fecha_programada) },
                            { label: 'Técnico', value: r => r.tecnico || 'Pendiente' },
                            { label: 'Hs.Oc.', value: r => r.horas_ocupadas || 0 }
                        ],
                        actions: r => `<button class="btn btn-sm btn-outline" onclick="App.modules.preventive.showForm(${r.id})">Editar</button>`,
                        cardClass: r => { const isV = r.estado !== 'Realizada' && r.fecha_programada && r.fecha_programada < today; return isV ? 'sc-vencida' : ''; }
                    }, filtered)}`}
                    </div>
                </div>
            </div>`;
    },

    _sortDir: 'asc',
    toggleSort() {
        this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
        const icon = document.getElementById('prev-sort-icon');
        if (icon) icon.textContent = this._sortDir === 'asc' ? '▲' : '▼';
        this.render();
    },

    async showForm(id) {
        const reg = id ? await db.getById('preventive_maintenance', id) : null;
        const maquinas = await db.getAll('machines');
        const componentes = await db.getAll('components');
        App.showModal(`
            <div class="form-row">
                <div class="form-group"><label>Máquina *</label>
                    <select class="form-control" id="prevMaquina" onchange="App.modules.preventive.updateComponentes()">
                        <option value="">Seleccionar...</option>
                        ${maquinas.map(m => `<option value="${m.id}" ${reg && reg.maquina_id === m.id ? 'selected' : ''}>${m.codigo} - ${m.nombre}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group"><label>Componente *</label>
                    <select class="form-control" id="prevComponente">
                        <option value="">Seleccionar...</option>
                        ${componentes.map(c => `<option value="${c.id}" ${reg && reg.componente_id === c.id ? 'selected' : ''}>${c.nombre}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-group"><label>Frecuencias</label>
                <div class="form-row" style="grid-template-columns:1fr 1fr 1fr">
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="frecDiaria" ${reg && reg.frecuencia_diaria ? 'checked' : ''}> Diaria</label>
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="frecSemanal" ${reg && reg.frecuencia_semanal ? 'checked' : ''}> Semanal</label>
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="frecMensual" ${reg && reg.frecuencia_mensual ? 'checked' : ''}> Mensual</label>
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="frecTrimestral" ${reg && reg.frecuencia_trimestral ? 'checked' : ''}> Trimestral</label>
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="frecSemestral" ${reg && reg.frecuencia_semestral ? 'checked' : ''}> Semestral</label>
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="frecAnual" ${reg && reg.frecuencia_anual ? 'checked' : ''}> Anual</label>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Fecha Programada *</label><input type="date" class="form-control" id="prevFechaProg" value="${reg ? reg.fecha_programada : ''}"></div>
                <div class="form-group"><label>Fecha Ejecutada</label><input type="date" class="form-control" id="prevFechaEjec" value="${reg ? reg.fecha_ejecutada : ''}"></div>
                <div class="form-group"><label>Turno</label>
                    <select class="form-control" id="prevTurno">
                        <option value="Dia" ${reg && reg.turno === 'Dia' ? 'selected' : ''}>Día</option>
                        <option value="Noche" ${reg && reg.turno === 'Noche' ? 'selected' : ''}>Noche</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Horas Ocupadas</label><input type="number" class="form-control" id="prevHorasOc" value="${reg ? reg.horas_ocupadas || 0 : 0}" min="0" step="0.5"></div>
                <div class="form-group"><label>Técnico</label><input class="form-control" id="prevTecnico" value="${reg ? reg.tecnico || '' : ''}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Estado</label>
                    <select class="form-control" id="prevEstado">
                        <option value="Programada" ${reg && reg.estado === 'Programada' ? 'selected' : ''}>Programada</option>
                        <option value="Realizada" ${reg && reg.estado === 'Realizada' ? 'selected' : ''}>Realizada</option>
                        <option value="Vencida" ${reg && reg.estado === 'Vencida' ? 'selected' : ''}>Vencida</option>
                    </select>
                </div>
            </div>
            <div class="form-group"><label>Observaciones</label><textarea class="form-control" id="prevObs">${reg ? reg.observaciones || '' : ''}</textarea></div>
            <div class="form-group"><label>Checklist (uno por línea)</label><textarea class="form-control" id="prevChecklist" rows="4" placeholder="Verificar filtro&#10;Lubricar rodamientos&#10;Revisar correas">${reg ? reg.checklist || '' : ''}</textarea></div>
        `, { title: reg ? 'Editar Mantención Preventiva' : 'Nueva Mantención Preventiva', lg: true });
        const footer = document.querySelector('#modalOverlay .modal-footer');
        footer.innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.preventive.save(${id || 0})">${reg ? 'Actualizar' : 'Guardar'}</button>
        `;
    },

    async updateComponentes() {
        const maqId = parseInt(document.getElementById('prevMaquina').value);
        const select = document.getElementById('prevComponente');
        if (!maqId) { select.innerHTML = '<option value="">Seleccionar...</option>'; return; }
        const maq = await db.getById('machines', maqId);
        if (!maq) return;
        const comps = await db.getComponentsByType(maq.tipo_id);
        select.innerHTML = '<option value="">Seleccionar...</option>' + comps.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    },

    async save(id) {
        try {
            const data = {
                maquina_id: parseInt(document.getElementById('prevMaquina').value),
                componente_id: parseInt(document.getElementById('prevComponente').value),
                frecuencia_diaria: document.getElementById('frecDiaria').checked ? 1 : 0,
                frecuencia_semanal: document.getElementById('frecSemanal').checked ? 1 : 0,
                frecuencia_mensual: document.getElementById('frecMensual').checked ? 1 : 0,
                frecuencia_trimestral: document.getElementById('frecTrimestral').checked ? 1 : 0,
                frecuencia_semestral: document.getElementById('frecSemestral').checked ? 1 : 0,
                frecuencia_anual: document.getElementById('frecAnual').checked ? 1 : 0,
                fecha_programada: document.getElementById('prevFechaProg').value,
                fecha_ejecutada: document.getElementById('prevFechaEjec').value,
                horas_ocupadas: parseFloat(document.getElementById('prevHorasOc').value) || 0,
                tecnico: App.capitalize(document.getElementById('prevTecnico').value.trim()),
                turno: document.getElementById('prevTurno').value,
                estado: document.getElementById('prevEstado').value,
                observaciones: App.capitalize(document.getElementById('prevObs').value.trim()),
                checklist: document.getElementById('prevChecklist').value.trim()
            };
            if (!data.maquina_id || !data.componente_id || !data.fecha_programada) {
                App.showAlert('Máquina, componente y fecha programada son obligatorios', 'danger'); return;
            }
            if (id === 0) await db.insert('preventive_maintenance', data);
            else await db.update('preventive_maintenance', id, data);
            App.hideModal();
            App.showAlert(id === 0 ? 'Mantención creada' : 'Mantención actualizada');
            this.render();
        } catch(e) { App.showAlert('Error al guardar: ' + e.message, 'danger'); }
    },

    async autoProgram() {
        const confirmed = await App.confirm('¿Auto-programar mantenciones?\n\n• 2 tareas aleatorias por día\n• Desde mañana hasta completar 5 días hábiles');
        if (!confirmed) return;

        try {
            const maquinas = await db.getAll('machines');
            if (maquinas.length === 0) { App.showAlert('No hay máquinas registradas', 'danger'); return; }

            const workingDays = [];
            const day = new Date();
            day.setDate(day.getDate() + 1); // Empezar desde mañana

            while (workingDays.length < 5) {
                const dayOfWeek = day.getDay();
                if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                    workingDays.push(new Date(day));
                }
                day.setDate(day.getDate() + 1);
            }

            let created = 0;

            for (const d of workingDays) {
                const dateStr = d.toISOString().split('T')[0];
                const shuffledMaquinas = [...maquinas].sort(() => 0.5 - Math.random());
                const dailyMachines = shuffledMaquinas.slice(0, 2);

                for (const maq of dailyMachines) {
                    const comps = await db.getComponentsByType(maq.tipo_id).catch(() => []);
                    if (comps.length === 0) continue;
                    const comp = comps[Math.floor(Math.random() * comps.length)];
                    const checklist = this.getDefaultChecklist(maq.tipo_id);

                    await db.insert('preventive_maintenance', {
                        maquina_id: maq.id,
                        componente_id: comp.id,
                        fecha_programada: dateStr,
                        estado: 'Programada',
                        checklist: ''
                    });
                    created++;
                }
            }

            const fechaInicio = workingDays[0].toISOString().split('T')[0];
            const fechaFin = workingDays[4].toISOString().split('T')[0];
            App.showAlert(`${created} mantenciones auto-programadas\n${fechaInicio} al ${fechaFin}`);
            this.render();
        } catch(e) { App.showAlert('Error al auto-programar: ' + e.message, 'danger'); }
    },

    getDefaultChecklist(tipoId) {
        const checklists = {
            1: 'Verificar nivel de aceite\nCambiar filtros\nRevisar válvulas\nVerificar temperatura',
            2: 'Revisar sellos mecánicos\nVerificar presión\nLubricar rodamientos\nRevisar fugas',
            3: 'Revisar nivel de aceite\nVerificar baterías\nProbar sistema de arranque\nRevisar filtros de aire',
            4: 'Verificar tensión de correas\nLubricar rodamientos\nRevisar alineación\nVerificar sensores',
            5: 'Revisar engranajes\nVerificar balance\nLubricar ejes\nRevisar motor',
            6: 'Verificar rodamientos\nRevisar sellos\nMedir vibraciones\nVerificar lubricación',
            7: 'Limpiar aspiración\nVerificar correas\nRevisar rodamientos\n平衡ar hélice',
            8: 'Revisar sistema hidráulico\nVerificar presión\nCambiar aceite\nRevisar válvulas'
        };
        return checklists[tipoId] || 'Verificar estado general\nLimpiar\nRevisar conexiones\nVerificar funcionamiento';
    },

    async delete(id) {
        try {
            const confirmed = await App.confirm('¿Eliminar este registro?');
            if (!confirmed) return;
            await db.delete('preventive_maintenance', id);
            App.showAlert('Registro eliminado');
            this.render();
        } catch(e) { App.showAlert('Error al eliminar: ' + e.message, 'danger'); }
    }
});
