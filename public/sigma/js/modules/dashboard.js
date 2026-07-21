App.registerModule('dashboard', {
    async render() {
        const el = document.getElementById('page-dashboard');
        let stats = { totalMachines: 0, completedMaintenance: 0, upcomingMaintenance: 0, overdueMaintenance: 0, totalFailures: 0, criticalSpareParts: 0, recentFailures: [] };
        try { stats = await db.getStatsSummary(); } catch(e) { console.error('Error loading stats:', e); }

        const [overdue, upcoming, recentFailures, recentPreventive, maquinas, componentes] = await Promise.all([
            db.getOverdueMaintenance().catch(() => []),
            db.getUpcomingMaintenance(15).catch(() => []),
            stats.recentFailures || [],
            db.getRecentCompleted().catch(() => []),
            db.getAll('machines').catch(() => []),
            db.getAll('components').catch(() => [])
        ]);

        const maqMap = {};
        maquinas.forEach(m => { maqMap[m.id] = m; });
        const compMap = {};
        componentes.forEach(c => { compMap[c.id] = c; });

        el.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon blue">🔧</div>
                    <div class="stat-info"><h4>${(stats.completedMaintenance || 0) + (stats.totalFailures || 0)}</h4><p>Total mantenciones</p></div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon green">✅</div>
                    <div class="stat-info"><h4>${stats.completedMaintenance}</h4><p>Preventivas realizadas</p></div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon red">🔴</div>
                    <div class="stat-info"><h4>${stats.totalFailures}</h4><p>Fallas registradas</p></div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon orange">⚠️</div>
                    <div class="stat-info"><h4>${stats.overdueMaintenance}</h4><p>Vencidas</p></div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background:#f3e8ff;color:#7c3aed">📅</div>
                    <div class="stat-info"><h4>${stats.upcomingMaintenance}</h4><p>Próximas (15 días)</p></div>
                </div>
            </div>
            <div class="row" style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
                ${this.renderOverdueLocal(overdue, maqMap, compMap)}
                ${this.renderUpcomingLocal(upcoming, maqMap, compMap)}
            </div>
            ${this.renderRecentFailuresLocal(recentFailures, maqMap, compMap)}
            ${this.renderRecentPreventiveLocal(recentPreventive, maqMap, compMap)}
        `;
    },

    renderOverdueLocal(data, maqMap, compMap) {
        return `<div class="card">
            <div class="card-header"><h3>⚠️ Mantenciones Vencidas</h3></div>
            <div class="card-body">${data.length === 0 ? '<div class="empty-state"><p>No hay mantenciones vencidas</p></div>' : `
            <table><thead><tr><th>Máquina</th><th>Componente</th><th>Fecha Prog.</th><th>Acción</th></tr></thead>
            <tbody>${data.slice(0,5).map(v => {
                const maq = maqMap[v.maquina_id];
                const comp = compMap[v.componente_id];
                return `<tr><td>${maq ? maq.nombre : '-'}</td><td>${comp ? comp.nombre : '-'}</td><td>${App.formatDate(v.fecha_programada)}</td><td><button class="btn btn-sm btn-outline" onclick="App.loadModule('preventive');setTimeout(()=>App.modules.preventive.showForm(${v.id}),300)">Ir</button></td></tr>`;
            }).join('')}</tbody></table>`}
            </div></div>`;
    },

    renderUpcomingLocal(data, maqMap, compMap) {
        return `<div class="card">
            <div class="card-header"><h3>📅 Próximas Mantenciones</h3></div>
            <div class="card-body">${data.length === 0 ? '<div class="empty-state"><p>No hay mantenciones próximas</p></div>' : `
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
            <div class="card-header"><h3>🔴 Últimas Fallas Registradas</h3></div>
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
            <div class="card-header"><h3>✅ Últimas Mantenciones Preventivas Realizadas</h3></div>
            <div class="card-body" style="padding:0">
                <table><thead><tr><th>Máquina</th><th>Componente</th><th>Observaciones</th><th>Fecha Prog.</th><th>Fecha Ejec.</th><th>Técnico</th><th>Turno</th><th>Acción</th></tr></thead>
                <tbody>${rows}</tbody></table></div></div>`;
    }
});
