App.registerModule('reports', {
    activeTab: 'periodo',

    async render() {
        const el = document.getElementById('page-reports');
        el.innerHTML = `
            <div class="page-header">
                <div><h2>Reportes</h2><div class="subtitle">Análisis y estadísticas del sistema</div></div>
                <button class="btn btn-outline" onclick="window.print()">🖨️ Imprimir</button>
            </div>
            <div class="tabs">
                <div class="tab ${this.activeTab === 'periodo' ? 'active' : ''}" onclick="App.modules.reports.switchTab('periodo')">📅 Por Periodo</div>
                <div class="tab ${this.activeTab === 'maquina' ? 'active' : ''}" onclick="App.modules.reports.switchTab('maquina')">🏭 Por Máquina</div>
                <div class="tab ${this.activeTab === 'fallas' ? 'active' : ''}" onclick="App.modules.reports.switchTab('fallas')">🔴 Más Fallas</div>
                <div class="tab ${this.activeTab === 'componentes' ? 'active' : ''}" onclick="App.modules.reports.switchTab('componentes')">🔧 Componentes</div>
                <div class="tab ${this.activeTab === 'vencidas' ? 'active' : ''}" onclick="App.modules.reports.switchTab('vencidas')">⚠️ Vencidas</div>
                <div class="tab ${this.activeTab === 'mensual' ? 'active' : ''}" onclick="App.modules.reports.switchTab('mensual')">📊 Mensual</div>
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
            content = '<div class="empty-state"><p>Ingrese ambas fechas para buscar</p></div>';
        }
        if (registros.length > 0) {
            content = `
            <div class="card">
                <div class="card-header"><h3>Mantenciones (${registros.length})</h3></div>
                <div class="card-body" style="padding:0">
                    <table><thead><tr><th>Máquina</th><th>Componente</th><th>Fecha Prog.</th><th>Fecha Ejec.</th><th>Técnico</th><th>Estado</th></tr></thead>
                    <tbody>${registros.map(r => `<tr><td>${r.maquina_nombre}</td><td>${r.componente_nombre}</td><td>${App.formatDate(r.fecha_programada)}</td><td>${App.formatDate(r.fecha_ejecutada)}</td><td>${r.tecnico || '-'}</td><td><span class="status-badge ${App.getEstadoClass(r.estado)}">${r.estado}</span></td></tr>`).join('')}</tbody></table>
                </div>
            </div>
            <div class="card">
                <div class="card-header"><h3>Resumen</h3></div>
                <div class="card-body">
                    <div class="stats-grid" style="grid-template-columns:1fr 1fr 1fr">
                        <div class="stat-card"><div class="stat-info"><h4>${registros.filter(r => r.estado === 'Realizada').length}</h4><p>Realizadas</p></div></div>
                        <div class="stat-card"><div class="stat-info"><h4>${registros.filter(r => r.estado === 'Vencida').length}</h4><p>Vencidas</p></div></div>
                        <div class="stat-card"><div class="stat-info"><h4>${registros.filter(r => r.estado === 'Programada').length}</h4><p>Programadas</p></div></div>
                    </div>
                </div>
            </div>`;
        } else if (startDate && endDate) {
            content = '<div class="empty-state"><p>No se encontraron registros</p></div>';
        }
        return `
            <div class="card">
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
            <div class="card">
                <div class="card-header"><h3>Intervenciones por Máquina</h3></div>
                <div class="card-body" style="padding:0">
                    <table><thead><tr><th>Máquina</th><th>Código</th><th>Tipo</th><th>Prev.</th><th>Fallas</th><th>Horas Det.</th></tr></thead><tbody>${rows}</tbody></table>
                </div>
            </div>
            <div class="card">
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
            <div class="card">
                <div class="card-header"><h3>Máquinas con más Fallas</h3></div>
                <div class="card-body">${data.length === 0 ? '<div class="empty-state"><p>Sin fallas</p></div>' : `<table><thead><tr><th>#</th><th>Máquina</th><th>Código</th><th>Fallas</th><th>Horas Det.</th></tr></thead><tbody>${rows}</tbody></table><div style="margin-top:20px">${bars}</div>`}
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
            <div class="card">
                <div class="card-header"><h3>Componentes más Intervenidos</h3></div>
                <div class="card-body">${data.length === 0 ? '<div class="empty-state"><p>Sin datos</p></div>' : `<table><thead><tr><th>#</th><th>Componente</th><th>Fallas</th><th>Prev.</th></tr></thead><tbody>${rows}</tbody></table><div style="margin-top:20px">${bars}</div>`}
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
            <div class="card">
                <div class="card-header"><h3>⚠️ Vencidas (${vencidas.length})</h3></div>
                <div class="card-body" style="padding:0">
                    ${vencidas.length === 0 ? '<div class="empty-state"><div class="icon">✅</div><h4>No hay vencidas</h4></div>' : `
                    <table><thead><tr><th>Máquina</th><th>Componente</th><th>Fecha Prog.</th><th>Días</th><th>Técnico</th></tr></thead><tbody>${rows}</tbody></table>
                    <div style="padding:16px;border-top:1px solid var(--border)"><p class="text-muted">Total: ${vencidas.length} vencidas. Reprogramar a la brevedad.</p></div>`}
                </div>
            </div>
            ${vencidas.length > 0 ? `<div class="card"><div class="card-header"><h3>Antigüedad</h3></div><div class="card-body">${bars}</div></div>` : ''}`;
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
            <div class="card">
                <div class="card-header"><h3>📊 Mantenciones por Mes</h3></div>
                <div class="card-body">
                    <div style="display:flex;gap:16px;margin-bottom:16px;font-size:12px">
                        <div><span style="display:inline-block;width:12px;height:12px;background:#28a745;border-radius:2px;margin-right:4px"></span> Preventivas</div>
                        <div><span style="display:inline-block;width:12px;height:12px;background:#dc3545;border-radius:2px;margin-right:4px"></span> Correctivas</div>
                    </div>
                    ${sorted.length === 0 ? '<div class="empty-state"><p>Sin datos</p></div>' : bars}
                </div>
            </div>
            ${sorted.length > 0 ? `
            <div class="card">
                <div class="card-header"><h3>Detalle</h3></div>
                <div class="card-body" style="padding:0">
                    <table><thead><tr><th>Mes</th><th>Preventivas</th><th>Correctivas</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
                </div>
            </div>` : ''}`;
    }
});
