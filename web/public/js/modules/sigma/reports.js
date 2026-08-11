App.registerModule('reports', {
    activeTab: 'periodo',

    async render() {
        const el = document.getElementById('page-reports');
        el.innerHTML = `
            <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:12px;padding:6px 14px;margin-bottom:16px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">
            <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
            <div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center"><div><h2 style="margin:0;font-size:14px;font-weight:800;color:white;letter-spacing:-0.5px">Reportes</h2>
            <p style="margin:2px 0 0;font-size:9px;color:rgba(255,255,255,0.7)">Analisis y estadisticas del sistema</p></div>
                <button class="btn btn-outline" style="color:white;border-color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.1);padding:5px 12px;font-size:12px" onclick="window.print()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Imprimir</button>
            </div></div>
            <style>
@keyframes rep_fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.rep-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}
.rep-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important;transform:translateY(-3px)}
.rep-row{transition:all 0.2s}
.rep-row:hover{transform:translateX(2px);background:#f8fafc!important}
</style>
            <div class="tabs">
                <div class="tab ${this.activeTab === 'periodo' ? 'active' : ''}" onclick="App.modules.reports.switchTab('periodo')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Por Periodo</div>
                <div class="tab ${this.activeTab === 'maquina' ? 'active' : ''}" onclick="App.modules.reports.switchTab('maquina')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M2 20h20"/><path d="M5 20V8l5 4V8l5 4V4h3v16"/></svg> Por Máquina</div>
                <div class="tab ${this.activeTab === 'fallas' ? 'active' : ''}" onclick="App.modules.reports.switchTab('fallas')"><svg width="14" height="14" viewBox="0 0 24 24" fill="#ef4444" style="vertical-align:-2px"><circle cx="12" cy="12" r="6"/></svg> Más Fallas</div>
                <div class="tab ${this.activeTab === 'componentes' ? 'active' : ''}" onclick="App.modules.reports.switchTab('componentes')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg> Componentes</div>
                <div class="tab ${this.activeTab === 'vencidas' ? 'active' : ''}" onclick="App.modules.reports.switchTab('vencidas')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" style="vertical-align:-2px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Vencidas</div>
                <div class="tab ${this.activeTab === 'mensual' ? 'active' : ''}" onclick="App.modules.reports.switchTab('mensual')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> Mensual</div>
            </div>
            <div id="reportContent">${await this.renderTabContent()}</div>
        `;
    },

    async switchTab(tab) {
        this.activeTab = tab;
        await this.render();
    },

    async renderTabContent() {
        switch(this.activeTab) {
            case 'periodo': return await this.renderPeriodo();
            case 'maquina': return await this.renderPorMaquina();
            case 'fallas': return await this.renderFallas();
            case 'componentes': return await this.renderComponentes();
            case 'vencidas': return await this.renderVencidas();
            case 'mensual': return await this.renderMensual();
            default: return '';
        }
    },

    async renderPeriodo() {
        const startDate = document.getElementById('repStart')?.value || '';
        const endDate = document.getElementById('repEnd')?.value || '';
        let registros = [], content = '';
        if (startDate && endDate) {
            registros = await db.getMaintenanceByPeriod(startDate, endDate);
        } else if (startDate || endDate) {
            content = '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">Ingrese ambas fechas para buscar</h4><p style="margin:0;color:#94a3b8;font-size:13px">Selecciona fecha inicio y fin</p></div>';
        }
        if (registros.length > 0) {
            content = `
            <div class="card rep-card">
                <div class="card-header"><h3>Mantenciones (${registros.length})</h3></div>
                <div class="card-body" style="padding:0">
                    <div class="sigma-table-wrap"><table><thead><tr><th>Máquina</th><th>Componente</th><th>Fecha Prog.</th><th>Fecha Ejec.</th><th>Técnico</th><th>Estado</th></tr></thead>
                    <tbody>${registros.map(r => `<tr><td>${r.maquina_nombre}</td><td>${r.componente_nombre}</td><td>${App.formatDate(r.fecha_programada)}</td><td>${App.formatDate(r.fecha_ejecutada)}</td><td>${r.tecnico || '-'}</td><td><span class="status-badge ${App.getEstadoClass(r.estado)}">${r.estado}</span></td></tr>`).join('')}</tbody></table>
                    ${SigmaCards.generate({
                        title: r => `<strong>${r.maquina_nombre}</strong>`,
                        subtitle: r => r.componente_nombre,
                        badge: r => `<span class="sc-badge" style="background:${r.estado === 'Realizada' ? '#dcfce7;color:#166534' : r.estado === 'Vencida' ? '#fee2e2;color:#991b1b' : '#dbeafe;color:#1e40af'}">${r.estado}</span>`,
                        fields: [
                            { label: 'Fecha', value: r => App.formatDate(r.fecha_programada) },
                            { label: 'Técnico', value: r => r.tecnico || '-' }
                        ]
                    }, registros)}</div>
                </div>
            </div>
            <div class="card rep-card">
                <div class="card-header"><h3>Resumen</h3></div>
                <div class="card-body">
                    <div class="stats-grid" style="grid-template-columns:1fr 1fr 1fr">
                        <div class="stat-card dash-card rep-card" style="border-left:4px solid #22c55e"><div class="stat-info"><p class="stat-label">Realizadas</p><p class="stat-sub">Mantenciones</p></div><div class="stat-value">${registros.filter(r => r.estado === 'Realizada').length}</div></div>
                        <div class="stat-card dash-card rep-card" style="border-left:4px solid #ef4444"><div class="stat-info"><p class="stat-label">Vencidas</p><p class="stat-sub">Requieren acción</p></div><div class="stat-value">${registros.filter(r => r.estado === 'Vencida').length}</div></div>
                        <div class="stat-card dash-card rep-card" style="border-left:4px solid #3b82f6"><div class="stat-info"><p class="stat-label">Programadas</p><p class="stat-sub">Pendientes</p></div><div class="stat-value">${registros.filter(r => r.estado === 'Programada').length}</div></div>
                    </div>
                </div>
            </div>`;
        } else if (startDate && endDate) {
            content = '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">No se encontraron registros</h4><p style="margin:0;color:#94a3b8;font-size:13px">Intenta con otro rango de fechas</p></div>';
        }
        return `
            <div class="card rep-card">
                <div class="card-header"><h3>Filtrar por Periodo</h3></div>
                <div class="card-body">
                    <div class="flex items-center gap-16" style="flex-wrap:wrap">
                        <div class="form-group" style="margin:0"><label>Desde</label><input type="date" class="form-control" id="repStart" value="${startDate}" style="width:180px"></div>
                        <div class="form-group" style="margin:0"><label>Hasta</label><input type="date" class="form-control" id="repEnd" value="${endDate}" style="width:180px"></div>
                        <button class="btn btn-primary" style="margin-top:18px" onclick="App.modules.reports.render()">Buscar</button>
                    </div>
                </div>
            </div>${content}`;
    },

    async renderPorMaquina() {
        const maquinas = await db.getAll('machines');
        let data = [], rows = '', bars = '';
        for (const m of maquinas) {
            const prevs = await db.query('preventive_maintenance', p => p.maquina_id === m.id);
            const corrs = await db.query('corrective_maintenance', c => c.maquina_id === m.id);
            const horasDet = corrs.reduce((s, c) => s + (c.horas_detencion || 0), 0);
            const tipo = await db.getById('machine_types', m.tipo_id).catch(() => null);
            data.push({ maquina: m, tipo, totalPrev: prevs.length, totalCorr: corrs.length, horasDet });
        }
        const maxTotal = Math.max(...data.map(d => d.totalPrev + d.totalCorr), 1);
        for (const d of data) {
            const total = d.totalPrev + d.totalCorr;
            const pct = (total / maxTotal) * 100;
            const color = d.totalCorr > d.totalPrev ? '#c62828' : '#2e7d32';
            rows += `<tr><td>${d.maquina.nombre}</td><td>${d.maquina.codigo}</td><td>${d.tipo ? d.tipo.nombre : '-'}</td><td>${d.totalPrev}</td><td>${d.totalCorr}</td><td>${d.horasDet}</td></tr>`;
            bars += `<div class="chart-bar"><div class="label" title="${d.maquina.nombre}">${d.maquina.codigo}</div><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}">${total}</div></div></div>`;
        }
        return `
            <div class="card rep-card">
                <div class="card-header"><h3>Intervenciones por Máquina</h3></div>
                <div class="card-body" style="padding:0">
                    <div class="sigma-table-wrap"><table><thead><tr><th>Máquina</th><th>Código</th><th>Tipo</th><th>Prev.</th><th>Fallas</th><th>Horas Det.</th></tr></thead><tbody>${rows}</tbody></table>
                    ${SigmaCards.generate({
                        title: d => `<strong>${d.maquina.nombre}</strong>`,
                        subtitle: d => d.maquina.codigo,
                        fields: [
                            { label: 'Tipo', value: d => d.tipo ? d.tipo.nombre : '-' },
                            { label: 'Prev.', value: d => d.totalPrev },
                            { label: 'Fallas', value: d => d.totalCorr },
                            { label: 'Hs.Det.', value: d => d.horasDet }
                        ]
                    }, data)}</div>
                </div>
            </div>
            <div class="card rep-card">
                <div class="card-header"><h3>Gráfico</h3></div>
                <div class="card-body">${bars}</div>
            </div>`;
    },

    async renderFallas() {
        const correctivos = await db.getAll('corrective_maintenance');
        const maquinaFallas = {};
        for (const c of correctivos) {
            if (!maquinaFallas[c.maquina_id]) maquinaFallas[c.maquina_id] = { count: 0, horas: 0 };
            maquinaFallas[c.maquina_id].count++;
            maquinaFallas[c.maquina_id].horas += c.horas_detencion || 0;
        }
        let data = [];
        for (const [id, info] of Object.entries(maquinaFallas)) {
            const maq = await db.getById('machines', parseInt(id)).catch(() => null);
            if (maq) data.push({ maquina: maq, ...info });
        }
        data.sort((a, b) => b.count - a.count);
        let rows = '', bars = '';
        const maxCount = data.length > 0 ? data[0].count : 1;
        data.forEach((d, i) => {
            const pct = (d.count / maxCount) * 100;
            rows += `<tr><td>${i+1}</td><td>${d.maquina.nombre}</td><td>${d.maquina.codigo}</td><td><strong>${d.count}</strong></td><td>${d.horas}</td></tr>`;
            bars += `<div class="chart-bar"><div class="label">${d.maquina.codigo}</div><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:#c62828">${d.count}</div></div></div>`;
        });
        return `
            <div class="card rep-card">
                <div class="card-header"><h3>Máquinas con más Fallas</h3></div>
                <div class="card-body">${data.length === 0 ? '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">Sin fallas</h4><p style="margin:0;color:#94a3b8;font-size:13px">No hay fallas registradas</p></div>' : `
                    <div class="sigma-table-wrap"><table><thead><tr><th>#</th><th>Máquina</th><th>Código</th><th>Fallas</th><th>Horas Det.</th></tr></thead><tbody>${rows}</tbody></table>
                    ${SigmaCards.generate({
                        title: d => `<strong>${d.maquina.nombre}</strong>`,
                        subtitle: d => d.maquina.codigo,
                        fields: [
                            { label: 'Fallas', value: d => d.count },
                            { label: 'Hs.Det.', value: d => d.horas }
                        ]
                    }, data)}</div>
                    <div style="margin-top:20px">${bars}</div>`}
                </div>
            </div>`;
    },

    async renderComponentes() {
        const correctivos = await db.getAll('corrective_maintenance');
        const preventivos = await db.getAll('preventive_maintenance');
        const compFallas = {}, compPrev = {};
        for (const c of correctivos) { compFallas[c.componente_id] = (compFallas[c.componente_id] || 0) + 1; }
        for (const p of preventivos) { compPrev[p.componente_id] = (compPrev[p.componente_id] || 0) + 1; }
        let data = [];
        for (const [id, count] of Object.entries(compFallas)) {
            const comp = await db.getById('components', parseInt(id)).catch(() => null);
            if (comp) data.push({ componente: comp, count });
        }
        data.sort((a, b) => b.count - a.count);
        let rows = '', bars = '';
        const maxCount = data.length > 0 ? data[0].count : 1;
        data.forEach((d, i) => {
            const pct = (d.count / maxCount) * 100;
            rows += `<tr><td>${i+1}</td><td><strong>${d.componente.nombre}</strong></td><td>${d.count}</td><td>${compPrev[d.componente.id] || 0}</td></tr>`;
            bars += `<div class="chart-bar"><div class="label">${d.componente.nombre}</div><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:#ff6f00">${d.count}</div></div></div>`;
        });
        return `
            <div class="card rep-card">
                <div class="card-header"><h3>Componentes más Intervenidos</h3></div>
                <div class="card-body">${data.length === 0 ? '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">Sin datos</h4><p style="margin:0;color:#94a3b8;font-size:13px">No hay componentes intervenidos</p></div>' : `
                    <div class="sigma-table-wrap"><table><thead><tr><th>#</th><th>Componente</th><th>Fallas</th><th>Prev.</th></tr></thead><tbody>${rows}</tbody></table>
                    ${SigmaCards.generate({
                        title: d => `<strong>${d.componente.nombre}</strong>`,
                        fields: [
                            { label: 'Fallas', value: d => d.count },
                            { label: 'Prev.', value: d => compPrev[d.componente.id] || 0 }
                        ]
                    }, data)}</div>
                    <div style="margin-top:20px">${bars}</div>`}
                </div>
            </div>
            </div>`;
    },

    async renderVencidas() {
        const vencidas = await db.getOverdueMaintenance();
        let rows = '', bars = '';
        vencidas.sort((a, b) => a.fecha_programada.localeCompare(b.fecha_programada));
        vencidas.slice(0, 10).forEach(v => {
            const dias = Math.floor((new Date() - new Date(v.fecha_programada + 'T12:00:00')) / 86400000);
            const pct = Math.min(dias / 90 * 100, 100);
            const color = dias > 60 ? '#c62828' : dias > 30 ? '#f57f17' : '#ff6f00';
            rows += `<tr><td>${v.maquina_nombre}</td><td>${v.componente_nombre}</td><td>${App.formatDate(v.fecha_programada)}</td><td><span class="status-badge status-vencida">${dias} días</span></td><td>${v.tecnico || 'Pendiente'}</td></tr>`;
            bars += `<div class="chart-bar"><div class="label" title="${v.maquina_nombre}">${(v.maquina_nombre || '').substring(0, 20)}</div><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}">${dias}d</div></div></div>`;
        });
        return `
            <div class="card rep-card">
                <div class="card-header"><h3><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" style="vertical-align:-2px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Vencidas (${vencidas.length})</h3></div>
                <div class="card-body" style="padding:0">
                    <div class="sigma-table-wrap">
                    ${vencidas.length === 0 ? '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><polyline points="20 6 9 17 4 12"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">No hay vencidas</h4><p style="margin:0;color:#94a3b8;font-size:13px">¡Todo al día!</p></div>' : `
                    <table><thead><tr><th>Máquina</th><th>Componente</th><th>Fecha Prog.</th><th>Días</th><th>Técnico</th></tr></thead><tbody>${rows}</tbody></table>
                    ${SigmaCards.generate({
                        title: v => `<strong>${v.maquina_nombre}</strong>`,
                        subtitle: v => v.componente_nombre,
                        badge: v => { const dias = Math.floor((new Date() - new Date(v.fecha_programada + 'T12:00:00')) / 86400000); return `<span class="sc-badge" style="background:#fee2e2;color:#991b1b">${dias} días</span>`; },
                        fields: [
                            { label: 'Fecha', value: v => App.formatDate(v.fecha_programada) },
                            { label: 'Técnico', value: v => v.tecnico || 'Pendiente' }
                        ],
                        cardClass: () => 'sc-vencida'
                    }, vencidas.slice(0,10))}
                    <div style="padding:16px;border-top:1px solid var(--border)"><p class="text-muted">Total: ${vencidas.length} vencidas. Reprogramar a la brevedad.</p></div>`}
                </div>
            </div>
            ${vencidas.length > 0 ? `<div class="card rep-card"><div class="card-header"><h3>Antigüedad</h3></div><div class="card-body">${bars}</div></div>` : ''}`;
    },

    async renderMensual() {
        const preventivos = await db.getAll('preventive_maintenance');
        const correctivos = await db.getAll('corrective_maintenance');
        const months = {};
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

        for (const p of preventivos) {
            const date = p.fecha_ejecutada || p.fecha_programada;
            if (!date) continue;
            const d = new Date(date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!months[key]) months[key] = { prev: 0, corr: 0, label: `${monthNames[d.getMonth()]} ${d.getFullYear()}` };
            months[key].prev++;
        }

        for (const c of correctivos) {
            const date = c.fecha_falla;
            if (!date) continue;
            const d = new Date(date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!months[key]) months[key] = { prev: 0, corr: 0, label: `${monthNames[d.getMonth()]} ${d.getFullYear()}` };
            months[key].corr++;
        }

        const sorted = Object.entries(months).sort((a, b) => a[0].localeCompare(b[0]));
        const maxTotal = Math.max(...sorted.map(([, v]) => v.prev + v.corr), 1);

        let bars = '';
        let rows = '';
        for (const [key, val] of sorted) {
            const total = val.prev + val.corr;
            const pctPrev = (val.prev / maxTotal) * 100;
            const pctCorr = (val.corr / maxTotal) * 100;
            rows += `<tr><td>${val.label}</td><td>${val.prev}</td><td>${val.corr}</td><td><strong>${total}</strong></td></tr>`;
            bars += `
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                    <div style="width:60px;font-size:12px;text-align:right">${val.label}</div>
                    <div style="flex:1;display:flex;gap:2px">
                        <div style="width:${pctPrev}%;background:#28a745;height:24px;border-radius:3px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;min-width:${val.prev > 0 ? '20px' : '0'}">${val.prev}</div>
                        <div style="width:${pctCorr}%;background:#dc3545;height:24px;border-radius:3px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;min-width:${val.corr > 0 ? '20px' : '0'}">${val.corr}</div>
                    </div>
                </div>`;
        }

        return `
            <div class="card rep-card">
                <div class="card-header"><h3><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> Mantenciones por Mes</h3></div>
                <div class="card-body">
                    <div style="display:flex;gap:16px;margin-bottom:16px;font-size:12px">
                        <div><span style="display:inline-block;width:12px;height:12px;background:#28a745;border-radius:2px;margin-right:4px"></span> Preventivas</div>
                        <div><span style="display:inline-block;width:12px;height:12px;background:#dc3545;border-radius:2px;margin-right:4px"></span> Correctivas</div>
                    </div>
                    ${sorted.length === 0 ? '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">Sin datos</h4><p style="margin:0;color:#94a3b8;font-size:13px">No hay mantenciones por mes</p></div>' : bars}
                </div>
            </div>
            ${sorted.length > 0 ? `
            <div class="card rep-card">
                <div class="card-header"><h3>Detalle</h3></div>
                <div class="card-body" style="padding:0">
                    <div class="sigma-table-wrap"><table><thead><tr><th>Mes</th><th>Preventivas</th><th>Correctivas</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
                    ${SigmaCards.generate({
                        title: ([, val]) => `<strong>${val.label}</strong>`,
                        fields: [
                            { label: 'Prev.', value: ([, val]) => val.prev },
                            { label: 'Corr.', value: ([, val]) => val.corr },
                            { label: 'Total', value: ([, val]) => val.prev + val.corr }
                        ]
                    }, sorted)}</div>
                </div>
            </div>` : ''}`;
    }
});
