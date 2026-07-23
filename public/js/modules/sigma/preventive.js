App.registerModule('preventive', {
    async render() {
        const el = document.getElementById('page-preventive');
        const registros = await db.getAll('preventive_maintenance');
        const maquinas = await db.getAll('machines');
        const filterEstado = document.getElementById('filterPrevEstado')?.value || '';
        const filterMaquina = document.getElementById('filterPrevMaq')?.value || '';
        let filtered = [];
        for (const r of registros) {
            const maq = await db.getById('machines', r.maquina_id).catch(() => null);
            const comp = await db.getById('components', r.componente_id).catch(() => null);
            filtered.push({ ...r, maquinaNombre: maq ? maq.nombre : '', componenteNombre: comp ? comp.nombre : '' });
        }
        if (filterEstado) filtered = filtered.filter(r => r.estado === filterEstado);
        if (filterMaquina) filtered = filtered.filter(r => r.maquina_id === parseInt(filterMaquina));
        const today = new Date().toISOString().split('T')[0];

        el.innerHTML = `
            <div class="page-header">
                <div><h2>Mantención Preventiva</h2><div class="subtitle">Programación y control de mantenciones periódicas</div></div>
                <div class="btn-group">
                    <button class="btn btn-accent" onclick="App.modules.preventive.autoProgram()">🔄 Auto-programar Semana</button>
                    <button class="btn btn-primary" onclick="App.modules.preventive.showForm()">+ Nueva Mantención</button>
                </div>
            </div>
            <div class="card">
                <div class="card-header">
                    <div class="flex items-center gap-16" style="flex-wrap:wrap">
                        <select class="form-control" id="filterPrevMaq" style="width:auto;min-width:180px" onchange="App.modules.preventive.render()">
                            <option value="">Todas las máquinas</option>
                            ${maquinas.map(m => `<option value="${m.id}" ${filterMaquina === String(m.id) ? 'selected' : ''}>${m.nombre}</option>`).join('')}
                        </select>
                        <select class="form-control" id="filterPrevEstado" style="width:auto;min-width:130px" onchange="App.modules.preventive.render()">
                            <option value="">Todos</option>
                            <option value="Programada" ${filterEstado === 'Programada' ? 'selected' : ''}>Programada</option>
                            <option value="Realizada" ${filterEstado === 'Realizada' ? 'selected' : ''}>Realizada</option>
                            <option value="Vencida" ${filterEstado === 'Vencida' ? 'selected' : ''}>Vencida</option>
                        </select>
                    </div>
                </div>
                <div class="card-body" style="padding:0">
                    ${filtered.length === 0 ? '<div class="empty-state"><div class="icon">📋</div><h4>No hay registros</h4></div>' : `
                    <table><thead><tr><th>Máquina</th><th>Componente</th><th>Checklist</th><th>Fecha Prog.</th><th>Fecha Ejec.</th><th>Días</th><th>Hs.Oc.</th><th>Técnico</th><th>Estado</th><th>Acciones</th></tr></thead>
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
                            <button class="btn btn-sm btn-outline" onclick="App.modules.preventive.showForm(${r.id})">✏️</button>
                            <button class="btn btn-sm btn-danger" onclick="App.modules.preventive.delete(${r.id})">🗑️</button>
                        </td>
                    </tr>`}).join('')}</tbody></table>`}
                </div>
            </div>`;
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
            App.showAlert(`✅ ${created} mantenciones auto-programadas\n${fechaInicio} al ${fechaFin}`);
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
