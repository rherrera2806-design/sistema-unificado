App.registerModule('dashboard', {
    async render() {
        const el = document.getElementById('page-dashboard');
        let stats = { totalMachines: 0, completedMaintenance: 0, upcomingMaintenance: 0, overdueMaintenance: 0, totalFailures: 0, criticalSpareParts: 0, recentFailures: [] };
        try { stats = await db.getStatsSummary(); } catch(e) { console.error('Error loading stats:', e); }

        el.innerHTML = `
            <div class="page-header">
                <div>
                    <h2>Dashboard</h2>
                    <div class="subtitle">Panel principal de control de mantenimiento</div>
                </div>
                <div class="btn-group">
                    <button class="btn btn-outline" onclick="App.exportData()">📤 Exportar</button>
                    <button class="btn btn-outline" onclick="document.getElementById('importFile').click()">📥 Importar</button>
                    <input type="file" id="importFile" accept=".json" style="display:none">
                </div>
            </div>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon blue">🏭</div>
                    <div class="stat-info"><h4>${stats.totalMachines}</h4><p>Máquinas registradas</p></div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon green">✅</div>
                    <div class="stat-info"><h4>${stats.completedMaintenance}</h4><p>Mantenciones preventivas realizadas</p></div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon orange">📅</div>
                    <div class="stat-info"><h4>${stats.upcomingMaintenance}</h4><p>Próximas (15 días)</p></div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon red">⚠️</div>
                    <div class="stat-info"><h4>${stats.overdueMaintenance}</h4><p>Mantenciones vencidas</p></div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon red">🔴</div>
                    <div class="stat-info"><h4>${stats.totalFailures}</h4><p>Fallas registradas</p><p style="font-size:11px;color:var(--success)">✅ ${stats.failuresReparadas} reparadas</p><p style="font-size:11px;color:var(--danger)">🔧 ${stats.failuresEnMantencion} en mantención</p></div>
                </div>
            </div>
            <div class="row" style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
                ${await this.renderOverdue()}
                ${await this.renderUpcoming()}
            </div>
            ${await this.renderRecentFailures(stats.recentFailures)}
            ${await this.renderRecentPreventive()}
        `;
    },

    async renderOverdue() {
        try {
            const data = await db.getOverdueMaintenance();
            return `<div class="card">
                <div class="card-header"><h3>⚠️ Mantenciones Vencidas</h3></div>
                <div class="card-body">${data.length === 0 ? '<div class="empty-state"><p>No hay mantenciones vencidas</p></div>' : `
                <table><thead><tr><th>Máquina</th><th>Componente</th><th>Fecha Prog.</th><th>Acción</th></tr></thead>
                <tbody>${data.slice(0,5).map(v => `<tr><td>${v.maquina_nombre}</td><td>${v.componente_nombre}</td><td>${App.formatDate(v.fecha_programada)}</td><td><button class="btn btn-sm btn-outline" onclick="App.loadModule('preventive');setTimeout(()=>App.modules.preventive.showForm(${v.id}),300)">Ir</button></td></tr>`).join('')}</tbody></table>`}
                </div></div>`;
        } catch(e) { console.error('Error loading overdue:', e); return '<div class="card"><div class="card-body"><p class="text-muted">Error al cargar datos</p></div></div>'; }
    },

    async renderUpcoming() {
        try {
            const data = await db.getUpcomingMaintenance(15);
            return `<div class="card">
                <div class="card-header"><h3>📅 Próximas Mantenciones</h3></div>
                <div class="card-body">${data.length === 0 ? '<div class="empty-state"><p>No hay mantenciones próximas</p></div>' : `
                <table><thead><tr><th>Máquina</th><th>Componente</th><th>Fecha Prog.</th></tr></thead>
                <tbody>${data.slice(0,5).map(v => `<tr><td>${v.maquina_nombre}</td><td>${v.componente_nombre}</td><td>${App.formatDate(v.fecha_programada)}</td></tr>`).join('')}</tbody></table>`}
                </div></div>`;
        } catch(e) { console.error('Error loading upcoming:', e); return '<div class="card"><div class="card-body"><p class="text-muted">Error al cargar datos</p></div></div>'; }
    },

    async renderRecentFailures(recentFailures) {
        if (!recentFailures || recentFailures.length === 0) return '';
        let rows = '';
        for (const c of recentFailures) {
            const maq = await db.getById('machines', c.maquina_id).catch(() => null);
            const comp = await db.getById('components', c.componente_id).catch(() => null);
            const color = c.estado === 'Reparada' ? '#28a745' : '#dc3545';
            rows += `<tr>
                <td>${maq ? maq.nombre : '-'}</td>
                <td>${comp ? comp.nombre : '-'}</td>
                <td>${App.formatDate(c.fecha_falla)}</td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(c.descripcion_falla || '').replace(/"/g, '&quot;')}">${c.descripcion_falla || '-'}</td>
                <td>${c.responsable || '-'}</td>
                <td><span style="background:${color};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px">${c.estado || 'En Mantención'}</span></td>
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

    async renderRecentPreventive() {
        try {
            const data = await db.getRecentCompleted();
            if (!data || data.length === 0) return '';
            let rows = '';
            for (const p of data) {
                const maq = await db.getById('machines', p.maquina_id).catch(() => null);
                const comp = await db.getById('components', p.componente_id).catch(() => null);
                rows += `<tr>
                    <td>${maq ? maq.nombre : '-'}</td>
                    <td>${comp ? comp.nombre : '-'}</td>
                    <td>${p.observaciones || '-'}</td>
                    <td>${App.formatDate(p.fecha_programada)}</td>
                    <td>${App.formatDate(p.fecha_ejecutada)}</td>
                    <td>${p.tecnico || '-'}</td>
                    <td>${p.turno || 'Dia'}</td>
                    <td><button class="btn btn-sm btn-outline" onclick="App.loadModule('preventive');setTimeout(()=>App.modules.preventive.showForm(${p.id}),300)">Ir</button></td>
                </tr>`;
            }
            return `<div class="card mt-16">
                <div class="card-header"><h3>✅ Últimas Mantenciones Preventivas Realizadas</h3></div>
                <div class="card-body" style="padding:0">
                    <table><thead><tr><th>Máquina</th><th>Componente</th><th>Observaciones</th><th>Fecha Prog.</th><th>Fecha Ejec.</th><th>Técnico</th><th>Turno</th><th>Acción</th></tr></thead>
                    <tbody>${rows}</tbody></table></div></div>`;
        } catch(e) { console.error('Error loading recent preventive:', e); return ''; }
    }
});
