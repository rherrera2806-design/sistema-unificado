App.registerModule('preventive', {
    _rankingConfigs: [
        { border: '#f59e0b', bg: 'linear-gradient(135deg,#fffbeb,#fef3c7)', numBg: '#f59e0b', icon: '🏆', textColor: '#92400e', labelColor: '#b45309' },
        { border: '#94a3b8', bg: 'linear-gradient(135deg,#f8fafc,#f1f5f9)', numBg: '#94a3b8', icon: '🥈', textColor: '#334155', labelColor: '#64748b' },
        { border: '#f97316', bg: 'linear-gradient(135deg,#fff7ed,#ffedd5)', numBg: '#f97316', icon: '🥉', textColor: '#9a3412', labelColor: '#c2410c' },
        { border: '#8b5cf6', bg: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', numBg: '#8b5cf6', icon: '⭐', textColor: '#5b21b6', labelColor: '#7c3aed' },
        { border: '#3b82f6', bg: 'linear-gradient(135deg,#eff6ff,#dbeafe)', numBg: '#3b82f6', icon: '⭐', textColor: '#1e40af', labelColor: '#2563eb' }
    ],
    _renderRanking(containerId, data, valueKey, label, onClickKey) {
        const c = document.getElementById(containerId);
        if (!c) return;
        if (!data || data.length === 0) { c.innerHTML = ''; return; }
        const configs = this._rankingConfigs;
        c.innerHTML = data.slice(0, 5).map((r, i) => {
            const cfg = configs[i] || configs[4];
            const valor = r[valueKey] !== undefined ? r[valueKey] : r.valor || 0;
            const clickId = onClickKey && r[onClickKey] ? r[onClickKey] : '';
            const onclick = clickId ? `onclick="App.modules.preventive.showMachineDetail(${clickId})"` : '';
            const cursor = clickId ? 'cursor:pointer' : '';
            return `<div class="ranking-card" style="background:${cfg.bg};border:2px solid ${cfg.border};${cursor}" ${onclick}>
                <div style="font-size:16px;margin-bottom:2px">${cfg.icon}</div>
                <div style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:${cfg.numBg};color:white;font-size:9px;font-weight:800;margin-bottom:2px">${i + 1}</div>
                <div class="ranking-name" style="color:${cfg.textColor}">${r.nombre}</div>
                <div style="font-size:16px;font-weight:800;color:${cfg.numBg};line-height:1">${typeof valor === 'number' ? valor.toFixed(1) : valor}</div>
                <div style="font-size:7px;text-transform:uppercase;letter-spacing:0.5px;color:${cfg.labelColor};font-weight:700;margin-top:2px">${label}</div>
            </div>`;
        }).join('');
    },
    async render() {
        const el = document.getElementById('page-preventive');
        const registros = await db.getAll('preventive_maintenance');
        const [maquinas, componentes, corrRecords] = await Promise.all([
            db.getAll('machines'),
            db.getAll('components'),
            db.getAll('corrective_maintenance')
        ]);
        const maqMap = {};
        maquinas.forEach(m => { maqMap[m.id] = m; });
        const compMap = {};
        componentes.forEach(c => { compMap[c.id] = c; });

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const maqPriority = {};
        maquinas.forEach(m => {
            const prevMaq = registros.filter(r => r.maquina_id === m.id && r.estado === 'Realizada');
            const corrMaq = corrRecords.filter(r => r.maquina_id === m.id);
            const lastPrev = prevMaq.length > 0 ? prevMaq.reduce((a, b) => (a.fecha_programada || '') > (b.fecha_programada || '') ? a : b) : null;
            const lastCorr = corrMaq.length > 0 ? corrMaq.reduce((a, b) => (a.fecha_falla || '') > (b.fecha_falla || '') ? a : b) : null;
            const lastDate = [lastPrev?.fecha_programada, lastCorr?.fecha_falla].filter(Boolean).sort().pop() || null;
            const recentCorr = corrMaq.filter(r => r.fecha_falla >= sixMonthsAgo.toISOString().split('T')[0]).length;
            let priority = 0;
            if (!lastDate) priority = 100;
            else {
                const daysSince = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000);
                priority = Math.max(0, 50 - Math.floor(daysSince / 30));
            }
            priority += recentCorr * 15;
            maqPriority[m.id] = priority;
        });

        const filterEstado = document.getElementById('filterPrevEstado')?.value || 'Programada';
        const filterMaquina = document.getElementById('filterPrevMaq')?.value || '';
        let filtered = registros.map(r => ({
            ...r,
            maquinaNombre: maqMap[r.maquina_id] ? maqMap[r.maquina_id].nombre : '',
            componenteNombre: compMap[r.componente_id] ? compMap[r.componente_id].nombre : '',
            priority: maqPriority[r.maquina_id] || 0
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
                <button class="btn btn-danger" style="padding:5px 12px;font-size:12px" onclick="App.modules.preventive.clearAll()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Limpiar todo</button>
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
            <div id="ranking-container" class="ranking-container"></div>
            <style>
@keyframes prev_fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.prev-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}
.prev-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important;transform:translateY(-3px)}
.prev-row{transition:all 0.2s}
.prev-row:hover{transform:translateX(2px);background:#f8fafc!important}
.ranking-container{display:flex;gap:6px;justify-content:space-between;align-items:stretch;padding:10px 0;width:100%;box-sizing:border-box}
.ranking-card{border-radius:10px;padding:8px 4px;text-align:center;flex:1 1 0;min-width:0;box-shadow:0 2px 8px rgba(0,0,0,0.06);box-sizing:border-box;transition:all 0.2s}
.ranking-card:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(0,0,0,0.1)}
.ranking-name{font-size:10px;font-weight:700;margin-bottom:2px;line-height:1.2;min-height:24px;display:flex;align-items:center;justify-content:center;word-break:break-word;overflow-wrap:break-word;hyphens:auto;padding:0 2px}
@media(max-width:768px){.ranking-container{gap:4px;padding:8px 0}.ranking-card{padding:6px 2px;border-radius:8px}.ranking-name{font-size:9px;min-height:22px}}
@media(max-width:640px){.ranking-grid{grid-template-columns:repeat(2,1fr)!important}.ranking-grid > :last-child:nth-child(odd){grid-column:span 2}}
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
                    <table><thead><tr><th>Máquina</th><th>Componente</th><th>Prioridad</th><th onclick="App.modules.preventive.toggleSort()" style="cursor:pointer;user-select:none" title="Click para cambiar orden">Fecha Prog. <span id="prev-sort-icon">▲</span></th><th>Fecha Ejec.</th><th>Días</th><th>Hs.Oc.</th><th>Técnico</th><th>Estado</th><th>Acciones</th></tr></thead>
                    <tbody>${filtered.map(r => {
                        const dias = r.fecha_programada && r.fecha_ejecutada ? Math.round((new Date(r.fecha_ejecutada) - new Date(r.fecha_programada)) / 86400000) : '-';
                        const isVencida = r.estado !== 'Realizada' && r.fecha_programada && r.fecha_programada < today;
                        const rowStyle = isVencida ? 'background:#fff3f3;' : '';
                        let pBadge, pLabel;
                        if (r.priority >= 100) { pBadge = '#dc2626'; pLabel = 'NUNCA'; }
                        else if (r.priority >= 60) { pBadge = '#f97316'; pLabel = 'URGENTE'; }
                        else if (r.priority >= 30) { pBadge = '#eab308'; pLabel = 'MEDIA'; }
                        else { pBadge = '#22c55e'; pLabel = 'OK'; }
                        return `<tr style="${rowStyle}">
                        <td>${r.maquinaNombre}</td><td>${r.componenteNombre}</td>
                        <td><span style="background:${pBadge};color:white;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700">${pLabel}</span></td>
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
        this._initRanking(maqMap);
    },

    _sortDir: 'asc',
    async _initRanking(maquinaIdMap) {
        const registros = await db.getAll('preventive_maintenance');
        const ranking = {};
        registros.forEach(r => {
            const name = maquinaIdMap[r.maquina_id]?.nombre || 'Sin máquina';
            if (!ranking[name]) ranking[name] = { nombre: name, total: 0, maquina_id: r.maquina_id };
            ranking[name].total++;
        });
        const rankingArray = Object.values(ranking)
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);
        this._renderRanking('ranking-container', rankingArray, 'total', 'Mantenciones', 'maquina_id');
    },
    toggleSort() {
        this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
        const icon = document.getElementById('prev-sort-icon');
        if (icon) icon.textContent = this._sortDir === 'asc' ? '▲' : '▼';
        this.render();
    },

    async showForm(id) {
        const reg = id ? await db.getById('preventive_maintenance', id) : null;
        const maquinas = await db.getAll('machines');
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
                        <option value="">Seleccionar máquina primero...</option>
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
        if (reg && reg.maquina_id) this.updateComponentes(reg.componente_id);
    },

    async updateComponentes(selectedId) {
        const maqId = parseInt(document.getElementById('prevMaquina').value);
        const select = document.getElementById('prevComponente');
        if (!maqId) { select.innerHTML = '<option value="">Seleccionar...</option>'; return; }
        const comps = await db.getMachineComponents(maqId);
        select.innerHTML = '<option value="">Seleccionar...</option>' + comps.map(c => `<option value="${c.id}" ${selectedId && c.id === selectedId ? 'selected' : ''}>${c.nombre}</option>`).join('');
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
        try {
            const [maquinas, machineComps, prevRecords, corrRecords] = await Promise.all([
                db.getAll('machines'),
                db.getAll('machine_components'),
                db.getAll('preventive_maintenance'),
                db.getAll('corrective_maintenance')
            ]);
            if (maquinas.length === 0) { App.showAlert('No hay máquinas registradas', 'danger'); return; }
            if (machineComps.length === 0) { App.showAlert('No hay componentes asignados a máquinas', 'danger'); return; }

            const maqMap = {};
            maquinas.forEach(m => { maqMap[m.id] = m; });

            const compsByMaq = {};
            machineComps.forEach(mc => {
                if (!compsByMaq[mc.maquina_id]) compsByMaq[mc.maquina_id] = [];
                compsByMaq[mc.maquina_id].push(mc.componente_id);
            });

            const maqConComps = Object.keys(compsByMaq).map(Number);
            const maqSinComps = maquinas.filter(m => !compsByMaq[m.id]).length;
            const totalAvailable = machineComps.length;
            const today = new Date().toISOString().split('T')[0];
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

            const maqPriority = maqConComps.map(id => {
                const prevMaq = prevRecords.filter(r => r.maquina_id === id && r.estado === 'Realizada');
                const corrMaq = corrRecords.filter(r => r.maquina_id === id);
                const lastPrev = prevMaq.length > 0 ? prevMaq.reduce((a, b) => (a.fecha_programada || '') > (b.fecha_programada || '') ? a : b) : null;
                const lastCorr = corrMaq.length > 0 ? corrMaq.reduce((a, b) => (a.fecha_falla || '') > (b.fecha_falla || '') ? a : b) : null;
                const lastDate = [lastPrev?.fecha_programada, lastCorr?.fecha_falla].filter(Boolean).sort().pop() || null;
                const recentCorr = corrMaq.filter(r => r.fecha_falla >= sixMonthsAgo.toISOString().split('T')[0]).length;
                let priority = 0;
                if (!lastDate) priority = 100;
                else {
                    const daysSince = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000);
                    priority = Math.max(0, 50 - Math.floor(daysSince / 30));
                }
                priority += recentCorr * 15;
                const comps = compsByMaq[id].length;
                return { id, lastDate, recentCorr, priority, total: comps };
            });

            maqPriority.sort((a, b) => b.priority - a.priority);
            const defaultTasks = Math.min(150, totalAvailable);

            App.showModal(`
                <div style="text-align:center;margin-bottom:16px">
                    <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#1d4ed8);display:inline-flex;align-items:center;justify-content:center;margin-bottom:8px">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                    </div>
                    <h3 style="margin:0;color:#1e293b;font-size:16px">Auto-programar Mantencion Preventiva</h3>
                    <p style="margin:4px 0 0;color:#64748b;font-size:12px">Distribucion inteligente por prioridad</p>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">
                    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:10px;text-align:center">
                        <div style="font-size:20px;font-weight:800;color:#0369a1">${maquinas.length}</div>
                        <div style="font-size:10px;color:#0284c7;font-weight:600">MAQUINAS</div>
                    </div>
                    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px;text-align:center">
                        <div style="font-size:20px;font-weight:800;color:#166534">${maqConComps.length}</div>
                        <div style="font-size:10px;color:#16a34a;font-weight:600">CON COMPONENTES</div>
                    </div>
                    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px;text-align:center">
                        <div style="font-size:20px;font-weight:800;color:#dc2626">${totalAvailable}</div>
                        <div style="font-size:10px;color:#dc2626;font-weight:600">COMP. DISPONIBLES</div>
                    </div>
                </div>

                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:16px">
                    <label style="font-size:11px;font-weight:600;color:#475569;display:block;margin-bottom:6px">Tareas a crear</label>
                    <div style="display:flex;align-items:center;gap:12px">
                        <input type="range" id="autoProgTotal" min="10" max="${totalAvailable}" value="${defaultTasks}" style="flex:1;accent-color:#3b82f6" oninput="App.modules.preventive.updateAutoProgPreview()">
                        <input type="number" id="autoProgTotalNum" value="${defaultTasks}" min="10" max="${totalAvailable}" style="width:70px;font-size:13px;padding:4px 8px;border:1px solid #e2e8f0;border-radius:6px;text-align:center" oninput="document.getElementById('autoProgTotal').value=this.value;App.modules.preventive.updateAutoProgPreview()">
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
                    <div class="form-group" style="margin:0">
                        <label style="font-size:11px;font-weight:600;color:#475569;margin-bottom:4px;display:block">Fecha inicio</label>
                        <input type="date" class="form-control" id="autoProgFecha" value="${today}" style="font-size:13px" onchange="App.modules.preventive.updateAutoProgPreview()">
                    </div>
                    <div class="form-group" style="margin:0">
                        <label style="font-size:11px;font-weight:600;color:#475569;margin-bottom:4px;display:block">Dias habiles</label>
                        <input type="number" class="form-control" id="autoProgDias" value="20" min="1" max="365" style="font-size:13px" onchange="App.modules.preventive.updateAutoProgPreview()" oninput="App.modules.preventive.updateAutoProgPreview()">
                    </div>
                </div>

                <div id="autoProgPreview" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px;margin-bottom:16px;text-align:center"></div>

                <div style="max-height:180px;overflow-y:auto;margin-bottom:16px">
                    <table style="width:100%;font-size:11px;border-collapse:collapse">
                        <thead><tr style="background:#f1f5f9"><th style="padding:6px 8px;text-align:center;color:#475569;width:28px">#</th><th style="padding:6px 8px;text-align:left;color:#475569">Maquina</th><th style="padding:6px 8px;text-align:center;color:#475569">Comp.</th><th style="padding:6px 8px;text-align:center;color:#475569">Prioridad</th></tr></thead>
                        <tbody id="autoProgTable"></tbody>
                    </table>
                </div>
            `, { title: '' });

            const footer = document.querySelector('#modalOverlay .modal-footer');
            if (footer) footer.innerHTML = `<button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button><button class="btn btn-accent" id="autoProgBtn" onclick="App.modules.preventive.executeAutoProgram()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Cargar tareas</button>`;

            this._autoProgData = { maquinas, machineComps, compsByMaq, maqConComps: maqPriority, totalAvailable };
            this.updateAutoProgPreview();
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    _calcDistribution(totalTasks, maqPriority) {
        const totalWeight = maqPriority.reduce((sum, m) => sum + m.priority + 1, 0);
        const distribution = [];
        let assigned = 0;
        maqPriority.forEach((m, i) => {
            const weight = (m.priority + 1) / totalWeight;
            let count = Math.round(totalTasks * weight);
            count = Math.min(count, m.total);
            count = Math.max(count, i < maqPriority.length ? 1 : 0);
            assigned += count;
            distribution.push({ ...m, assigned: count });
        });
        let diff = totalTasks - assigned;
        for (let i = 0; i < distribution.length && diff !== 0; i++) {
            if (diff > 0 && distribution[i].assigned < distribution[i].total) { distribution[i].assigned++; diff--; }
            else if (diff < 0 && distribution[i].assigned > 1) { distribution[i].assigned--; diff++; }
        }
        return distribution;
    },

    updateAutoProgPreview() {
        const totalTasks = parseInt(document.getElementById('autoProgTotal')?.value) || 150;
        const numInput = document.getElementById('autoProgTotalNum');
        if (numInput) numInput.value = totalTasks;
        const dias = parseInt(document.getElementById('autoProgDias')?.value) || 20;
        const { maqConComps } = this._autoProgData || {};
        if (!maqConComps) return;

        const distribution = this._calcDistribution(totalTasks, maqConComps);
        const activeMachines = distribution.filter(m => m.assigned > 0);

        const preview = document.getElementById('autoProgPreview');
        if (preview) {
            const porDia = Math.ceil(totalTasks / dias);
            preview.innerHTML = `<span style="font-size:12px;color:#1e40af">~${porDia} tareas/dia x ${dias} dias habiles = ${totalTasks} tareas en ${activeMachines.length} maquinas</span>`;
        }

        const table = document.getElementById('autoProgTable');
        if (table) {
            table.innerHTML = distribution.filter(m => m.assigned > 0).map((p, i) => {
                const m = this._autoProgData.maquinas.find(x => x.id === p.id);
                let badge, label;
                if (p.priority >= 100) { badge = '#dc2626'; label = 'NUNCA'; }
                else if (p.priority >= 60) { badge = '#f97316'; label = 'URGENTE'; }
                else if (p.priority >= 30) { badge = '#eab308'; label = 'MEDIA'; }
                else { badge = '#22c55e'; label = 'OK'; }
                const corrTag = p.recentCorr > 0 ? `<span style="background:#fef2f2;color:#dc2626;padding:1px 5px;border-radius:8px;font-size:9px;font-weight:600;margin-left:4px">${p.recentCorr} falla${p.recentCorr > 1 ? 's' : ''}</span>` : '';
                return `<tr style="border-bottom:1px solid #f1f5f9;${i < 3 ? 'background:#fffbeb' : ''}"><td style="padding:5px 8px;text-align:center;font-weight:700;color:#64748b">${i + 1}</td><td style="padding:5px 8px"><strong>${m.codigo}</strong> ${m.nombre}${corrTag}</td><td style="padding:5px 8px;text-align:center"><span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:10px;font-weight:700">${p.assigned}</span><span style="color:#94a3b8;font-size:9px">/${p.total}</span></td><td style="padding:5px 8px;text-align:center"><span style="background:${badge};color:white;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700">${label}</span></td></tr>`;
            }).join('');
        }

        const btn = document.getElementById('autoProgBtn');
        if (btn) btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Cargar ${totalTasks} tareas`;
    },

    async executeAutoProgram() {
        const { maquinas, machineComps, compsByMaq, maqConComps, totalAvailable } = this._autoProgData || {};
        if (!maquinas || !machineComps) { App.showAlert('Error: datos no cargados', 'danger'); return; }

        const fechaInicio = document.getElementById('autoProgFecha')?.value;
        const diasHabiles = parseInt(document.getElementById('autoProgDias')?.value) || 20;
        const totalTasks = parseInt(document.getElementById('autoProgTotal')?.value) || 150;

        if (!fechaInicio) { App.showAlert('Selecciona una fecha de inicio', 'danger'); return; }

        try {
            const workingDays = [];
            const day = new Date(fechaInicio + 'T12:00:00');
            while (workingDays.length < diasHabiles) {
                const dow = day.getDay();
                if (dow !== 0 && dow !== 6) workingDays.push(new Date(day));
                day.setDate(day.getDate() + 1);
            }

            const distribution = this._calcDistribution(totalTasks, maqConComps);
            const allTasks = [];
            for (const m of distribution) {
                if (m.assigned <= 0) continue;
                const available = [...compsByMaq[m.id]];
                for (let i = available.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [available[i], available[j]] = [available[j], available[i]];
                }
                const selected = available.slice(0, m.assigned);
                for (const compId of selected) {
                    allTasks.push({ maquina_id: m.id, componente_id: compId, priority: m.priority });
                }
            }

            allTasks.sort((a, b) => b.priority - a.priority);

            const tasksPerDay = Math.ceil(allTasks.length / workingDays.length);
            const tasks = [];
            for (let i = 0; i < workingDays.length && allTasks.length > 0; i++) {
                const dateStr = workingDays[i].toISOString().split('T')[0];
                const dayTasks = allTasks.splice(0, tasksPerDay);
                for (const task of dayTasks) {
                    tasks.push({ maquina_id: task.maquina_id, componente_id: task.componente_id, fecha_programada: dateStr, estado: 'Programada', checklist: '' });
                }
            }

            const modalBody = document.querySelector('#modalOverlay .modal-body');
            const modalFooter = document.querySelector('#modalOverlay .modal-footer');
            if (modalBody) modalBody.innerHTML = `
                <div style="text-align:center;padding:32px">
                    <div style="width:48px;height:48px;border:3px solid #e2e8f0;border-top-color:#f59e0b;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px"></div>
                    <h3 style="margin:0 0 8px;color:#1e293b;font-size:16px">Creando ${tasks.length} mantenciones...</h3>
                    <p style="margin:0;color:#64748b;font-size:13px">Distribuidas en ${workingDays.length} dias habiles</p>
                </div>`;
            if (modalFooter) modalFooter.innerHTML = '';

            const res = await fetch('/api/sigma/preventive/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tasks })
            });
            if (!res.ok) throw new Error('Error al crear mantenciones');
            const data = await res.json();

            const fechaFin = workingDays[Math.min(Math.ceil(data.created / tasksPerDay) - 1, workingDays.length - 1)].toISOString().split('T')[0];

            if (modalBody) modalBody.innerHTML = `
                <div style="text-align:center;padding:32px">
                    <div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#22c55e,#16a34a);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <h3 style="margin:0 0 8px;color:#1e293b;font-size:16px">${data.created} mantenciones creadas</h3>
                    <p style="margin:0;color:#64748b;font-size:13px">${fechaInicio} al ${fechaFin}</p>
                </div>`;
            if (modalFooter) modalFooter.innerHTML = `<button class="btn btn-primary" onclick="App.hideModal(); App.modules.preventive.render()">Cerrar</button>`;

        } catch(e) {
            App.hideModal();
            App.showAlert('Error al auto-programar: ' + e.message, 'danger');
        }
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

    async clearAll() {
        const count = (await db.getAll('preventive_maintenance')).filter(r => r.estado === 'Programada').length;
        if (count === 0) { App.showAlert('No hay mantenciones programadas para eliminar', 'warning'); return; }
        const confirmed = await App.confirm(`¿Eliminar todas las ${count} mantenciones programadas? Esta acción no se puede deshacer.`);
        if (!confirmed) return;
        try {
            const res = await fetch('/api/sigma/preventive/clear-programmed', { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
            if (!res.ok) throw new Error('Error al eliminar');
            const data = await res.json();
            App.showAlert(`Se eliminaron ${data.deleted} mantenciones programadas`);
            this.render();
        } catch (e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    async showMachineDetail(maquinaId) {
        App.showModal(`
            <div style="text-align:center;padding:32px">
                <div style="width:40px;height:40px;border:3px solid #e2e8f0;border-top-color:#3b82f6;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 12px"></div>
                <p style="color:#64748b;font-size:13px">Cargando ficha...</p>
            </div>
            <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
        `, { title: 'Ficha de Maquina', lg: true });

        const info = await db.getMachineWithDetails(maquinaId);
        if (!info) { App.hideModal(); return; }
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
        const modalBody = document.querySelector('#modalOverlay .modal-body');
        const modalTitle = document.querySelector('#modalOverlay .modal-title');
        if (modalTitle) modalTitle.textContent = `Ficha: ${maquina.nombre}`;
        if (modalBody) modalBody.innerHTML = `
            <div style="background:linear-gradient(135deg,#f8fafc,#f1f5f9);border-radius:10px;padding:16px;margin-bottom:16px;border:1px solid #e2e8f0">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
                    <div style="min-width:48px;height:48px;border-radius:10px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:white;box-shadow:0 2px 8px rgba(59,130,246,0.3);padding:0 6px;white-space:nowrap">${maquina.codigo || '-'}</div>
                    <div style="flex:1">
                        <h3 style="margin:0;font-size:16px;color:#1e293b">${maquina.nombre}</h3>
                        <p style="margin:2px 0 0;font-size:12px;color:#64748b">${tipo ? tipo.nombre : 'Sin tipo'} ${maquina.marca ? '• ' + maquina.marca : ''}</p>
                    </div>
                    <span class="status-badge ${App.getEstadoClass(maquina.estado_operativo)}" style="font-size:12px">${maquina.estado_operativo}</span>
                </div>
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font-size:12px">
                    <div><span style="color:#64748b">Modelo:</span> <strong>${maquina.modelo || '-'}</strong></div>
                    <div><span style="color:#64748b">Serie:</span> <strong>${maquina.numero_serie || '-'}</strong></div>
                    <div><span style="color:#64748b">Ubicacion:</span> <strong>${maquina.ubicacion || '-'}</strong></div>
                    <div><span style="color:#64748b">Compra:</span> <strong>${App.formatDate(maquina.fecha_compra)}</strong></div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">
                <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px;text-align:center">
                    <div style="font-size:18px;font-weight:800;color:#1d4ed8">${componentes.length}</div>
                    <div style="font-size:10px;color:#3b82f6;font-weight:600">COMPONENTES</div>
                </div>
                <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px;text-align:center">
                    <div style="font-size:18px;font-weight:800;color:#166534">${preventivos.length}</div>
                    <div style="font-size:10px;color:#16a34a;font-weight:600">PREVENTIVOS</div>
                </div>
                <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px;text-align:center">
                    <div style="font-size:18px;font-weight:800;color:#dc2626">${correctivos.length}</div>
                    <div style="font-size:10px;color:#dc2626;font-weight:600">FALLAS</div>
                </div>
            </div>
            <div style="margin-bottom:16px">
                <h4 style="margin:0 0 8px;font-size:13px;color:#475569;display:flex;align-items:center;gap:6px">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                    Componentes Asociados
                </h4>
                <div style="display:flex;flex-wrap:wrap;gap:6px">${componentes.map(c => `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;background:#eff6ff;color:#1e40af;font-size:11px;font-weight:500;border:1px solid #bfdbfe">${c.nombre}</span>`).join('') || '<span style="color:#94a3b8;font-size:12px">Sin componentes asignados</span>'}</div>
            </div>
            <div style="margin-bottom:16px">
                <h4 style="margin:0 0 8px;font-size:13px;color:#475569;display:flex;align-items:center;gap:6px">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                    Mantencion Preventiva (${preventivos.length})
                </h4>
                ${preventivos.length === 0 ? '<p style="color:#94a3b8;font-size:12px;margin:0">Sin registros</p>' : `
                <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
                    <table style="width:100%;font-size:12px;border-collapse:collapse">
                        <thead><tr style="background:#f8fafc"><th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600">Componente</th><th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600">Fecha Prog.</th><th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600">Estado</th></tr></thead>
                        <tbody>${prevRows}</tbody>
                    </table>
                </div>`}
            </div>
            <div>
                <h4 style="margin:0 0 8px;font-size:13px;color:#475569;display:flex;align-items:center;gap:6px">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    Fallas Registradas (${correctivos.length})
                </h4>
                ${correctivos.length === 0 ? '<p style="color:#94a3b8;font-size:12px;margin:0">Sin fallas registradas</p>' : `
                <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
                    <table style="width:100%;font-size:12px;border-collapse:collapse">
                        <thead><tr style="background:#f8fafc"><th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600">Componente</th><th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600">Fecha</th><th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600">Falla</th><th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600">Horas</th></tr></thead>
                        <tbody>${corrRows}</tbody>
                    </table>
                </div>`}
            </div>
        `;
        if (modalTitle) modalTitle.textContent = `Ficha: ${maquina.nombre}`;
        const footer = document.querySelector('#modalOverlay .modal-footer');
        footer.innerHTML = `<button class="btn btn-outline" onclick="App.hideModal()">Cerrar</button>`;
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
