App.registerModule('dashboard', {
    async render() {
        const el = document.getElementById('page-dashboard');
        let stats = { totalMachines: 0, completedMaintenance: 0, upcomingMaintenance: 0, overdueMaintenance: 0, totalFailures: 0, criticalSpareParts: 0, recentFailures: [] };
        try { stats = await db.getStatsSummary(); } catch(e) { console.error('Error loading stats:', e); }

        const [overdue, upcoming, recentFailures, recentPreventive, maquinas, componentes] = await Promise.all([
            db.getOverdueMaintenance().catch(() => []),
            db.getUpcomingMaintenance(15).catch(() => []),
            db.getRecentCompleted().catch(() => []),
            db.getRecentCompleted().catch(() => []),
            db.getAll('machines').catch(() => []),
            db.getAll('components').catch(() => [])
        ]);

        const maqMap = {};
        maquinas.forEach(m => { maqMap[m.id] = m; });
        const compMap = {};
        componentes.forEach(c => { compMap[c.id] = c; });

        el.innerHTML = `
            <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:8px 16px;margin-bottom:20px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">
            <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
            <div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center"><div><h2 style="margin:0;font-size:15px;font-weight:800;color:white;letter-spacing:-0.5px">Dashboard</h2>
            <p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Panel principal de control de mantenimiento</p></div>
            <div style="display:flex;gap:8px">
                    <button class="btn btn-outline" style="color:white;border-color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.1)" onclick="App.exportData()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Exportar</button>
                    <button class="btn btn-outline" style="color:white;border-color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.1)" onclick="document.getElementById('importFile').click()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Importar</button>
                    <input type="file" id="importFile" accept=".json" style="display:none">
                </div></div></div>
            <style>
@keyframes dash_fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.dash-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}
.dash-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important;transform:translateY(-3px)}
.dash-row{transition:all 0.2s}
.dash-row:hover{transform:translateX(2px);background:#f8fafc!important}
</style>
            <div class="stats-grid">
                <div class="stat-card dash-card" style="border-left:4px solid #3b82f6">
                    <div class="stat-icon blue"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M2 20h20"/><path d="M5 20V8l5 4V8l5 4V4h3v16"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Total Mantenciones</p><p class="stat-sub">M+R completados</p></div>
                    <div class="stat-value">${stats.totalMachines}</div>
                </div>
                <div class="stat-card dash-card" style="border-left:4px solid #22c55e">
                    <div class="stat-icon green"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" style="vertical-align:-2px"><polyline points="20 6 9 17 4 12"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Preventivas</p><p class="stat-sub">Realizadas</p></div>
                    <div class="stat-value">${stats.completedMaintenance}</div>
                </div>
                <div class="stat-card dash-card" style="border-left:4px solid #f59e0b">
                    <div class="stat-icon orange"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Proximas (15d)</p><p class="stat-sub">Programadas</p></div>
                    <div class="stat-value">${stats.upcomingMaintenance}</div>
                </div>
                <div class="stat-card dash-card" style="border-left:4px solid #ef4444">
                    <div class="stat-icon red"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" style="vertical-align:-2px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Vencidas</p><p class="stat-sub">Requieren accion</p></div>
                    <div class="stat-value">${stats.overdueMaintenance}</div>
                </div>
                <div class="stat-card dash-card" style="border-left:4px solid #ef4444">
                    <div class="stat-icon red"><svg width="14" height="14" viewBox="0 0 24 24" fill="#ef4444" style="vertical-align:-2px"><circle cx="12" cy="12" r="6"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Fallas</p><p class="stat-sub">Registradas</p></div>
                    <div class="stat-value">${stats.totalFailures}</div>
                </div>
            </div>
            <div class="row" style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
                ${this.renderOverdueLocal(overdue, maqMap, compMap)}
                ${this.renderUpcomingLocal(upcoming, maqMap, compMap)}
            </div>
            ${this.renderRecentFailuresLocal(stats.recentFailures, maqMap, compMap)}
            ${this.renderRecentPreventiveLocal(recentPreventive, maqMap, compMap)}
        `;
    },

    renderOverdueLocal(data, maqMap, compMap) {
        return `<div class="card dash-card">
            <div class="card-header"><h3><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" style="vertical-align:-2px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Mantenciones Vencidas</h3></div>
            <div class="card-body">${data.length === 0 ? '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">No hay mantenciones vencidas</h4><p style="margin:0;color:#94a3b8;font-size:13px">¡Todo al día!</p></div>' : `
            <table><thead><tr><th>Máquina</th><th>Componente</th><th>Fecha Prog.</th><th>Acción</th></tr></thead>
            <tbody>${data.slice(0,5).map(v => {
                const maq = maqMap[v.maquina_id];
                const comp = compMap[v.componente_id];
                return `<tr><td>${maq ? maq.nombre : '-'}</td><td>${comp ? comp.nombre : '-'}</td><td>${App.formatDate(v.fecha_programada)}</td><td><button class="btn btn-sm btn-outline" onclick="App.loadModule('preventive');setTimeout(()=>App.modules.preventive.showForm(${v.id}),300)">Ir</button></td></tr>`;
            }).join('')}</tbody></table>`}
            </div></div>`;
    },

    renderUpcomingLocal(data, maqMap, compMap) {
        return `<div class="card dash-card">
            <div class="card-header"><h3><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Próximas Mantenciones</h3></div>
            <div class="card-body">${data.length === 0 ? '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">No hay mantenciones próximas</h4><p style="margin:0;color:#94a3b8;font-size:13px">Programa la próxima mantención</p></div>' : `
            <table><thead><tr><th>Máquina</th><th>Componente</th><th>Fecha Prog.</th></tr></thead>
            <tbody>${data.slice(0,5).map(v => {
                const maq = maqMap[v.maquina_id];
                const comp = compMap[v.componente_id];
                return `<tr><td>${maq ? maq.nombre : '-'}</td><td>${comp ? comp.nombre : '-'}</td><td>${App.formatDate(v.fecha_programada)}</td></tr>`;
            }).join('')}</tbody></table>`}
            </div></div>`;
    },

    renderRecentFailuresLocal(recentFailures, maqMap, compMap) {
        if (!recentFailures || recentFailures.length === 0) return '';
        let rows = '';
        for (const c of recentFailures) {
            const maq = maqMap[c.maquina_id];
            const comp = compMap[c.componente_id];
            const color = c.estado === 'Reparada' ? '#28a745' : '#dc3545';
            rows += `<tr>
                <td>${maq ? maq.nombre : '-'}</td>
                <td>${comp ? comp.nombre : '-'}</td>
                <td>${App.formatDate(c.fecha_falla)}</td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(c.descripcion_falla || '')}">${escapeHtml(c.descripcion_falla || '-')}</td>
                <td>${escapeHtml(c.responsable || '-')}</td>
                <td><span style="background:${color};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px">${escapeHtml(c.estado || 'En Mantención')}</span></td>
                <td>${c.horas_detencion}</td>
                <td><button class="btn btn-sm btn-outline" onclick="App.loadModule('corrective');setTimeout(()=>App.modules.corrective.showForm(${c.id}),300)">Ir</button></td>
            </tr>`;
        }
        return `<div class="card mt-16">
            <div class="card-header"><h3><svg width="14" height="14" viewBox="0 0 24 24" fill="#ef4444" style="vertical-align:-2px"><circle cx="12" cy="12" r="6"/></svg> Últimas Fallas Registradas</h3></div>
            <div class="card-body" style="padding:0">
                <table><thead><tr><th>Máquina</th><th>Componente</th><th>Fecha</th><th>Falla</th><th>Técnico</th><th>Estado</th><th>Hs.Det.</th><th>Acción</th></tr></thead>
                <tbody>${rows}</tbody></table></div></div>`;
    },

    renderRecentPreventiveLocal(data, maqMap, compMap) {
        if (!data || data.length === 0) return '';
        let rows = '';
        for (const p of data) {
            const maq = maqMap[p.maquina_id];
            const comp = compMap[p.componente_id];
            rows += `<tr>
                <td>${maq ? maq.nombre : '-'}</td>
                <td>${comp ? comp.nombre : '-'}</td>
                <td>${escapeHtml(p.observaciones || '-')}</td>
                <td>${App.formatDate(p.fecha_programada)}</td>
                <td>${App.formatDate(p.fecha_ejecutada)}</td>
                <td>${escapeHtml(p.tecnico || '-')}</td>
                <td>${escapeHtml(p.turno || 'Dia')}</td>
                <td><button class="btn btn-sm btn-outline" onclick="App.loadModule('preventive');setTimeout(()=>App.modules.preventive.showForm(${p.id}),300)">Ir</button></td>
            </tr>`;
        }
        return `<div class="card mt-16">
            <div class="card-header"><h3><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" style="vertical-align:-2px"><polyline points="20 6 9 17 4 12"/></svg> Últimas Mantenciones Preventivas Realizadas</h3></div>
            <div class="card-body" style="padding:0">
                <table><thead><tr><th>Máquina</th><th>Componente</th><th>Observaciones</th><th>Fecha Prog.</th><th>Fecha Ejec.</th><th>Técnico</th><th>Turno</th><th>Acción</th></tr></thead>
                <tbody>${rows}</tbody></table></div></div>`;
    }
});
