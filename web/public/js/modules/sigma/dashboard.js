App.registerModule('dashboard', {
    _periodo: 'anio', // 'anio' | 'mes'
    _mes: new Date().getMonth() + 1,
    _anio: new Date().getFullYear(),

    async render() {
        const el = document.getElementById('page-dashboard');
        await this.renderData();
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
        const footer = document.querySelector('#modalOverlay .modal-footer');
        footer.innerHTML = `<button class="btn btn-outline" onclick="App.hideModal()">Cerrar</button>`;
    },

    _datos: null,

    async renderData() {
        const el = document.getElementById('page-dashboard');
        const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

        if (!this._datos) {
            const [preventivos, correctivos, maquinas, componentes, overdue, upcoming, recentFailures, recentPreventive, statsSummary] = await Promise.all([
                db.getAll('preventive_maintenance').catch(() => []),
                db.getAll('corrective_maintenance').catch(() => []),
                db.getAll('machines').catch(() => []),
                db.getAll('components').catch(() => []),
                db.getOverdueMaintenance().catch(() => []),
                db.getUpcomingMaintenance(15).catch(() => []),
                db.getRecentCompleted().catch(() => []),
                db.getRecentCompleted().catch(() => []),
                db.getStatsSummary().catch(() => ({ completedMaintenance: 0, upcomingMaintenance: 0, overdueMaintenance: 0, totalFailures: 0 }))
            ]);
            this._datos = { preventivos, correctivos, maquinas, componentes, overdue, upcoming, recentFailures, recentPreventive, statsSummary };
        }
        const { preventivos, correctivos, maquinas, componentes, overdue, upcoming, recentFailures, recentPreventive, statsSummary } = this._datos;

        const topFallas = this.computeTopFallasPeriodo(correctivos, maquinas, this._periodo, this._anio, this._mes);

        const maqMap = {};
        maquinas.forEach(m => { maqMap[m.id] = m; });
        const compMap = {};
        componentes.forEach(c => { compMap[c.id] = c; });

        const inPeriod = (fecha) => {
            if (!fecha) return false;
            const f = fecha.split('T')[0];
            const [y, m, d] = f.split('-').map(Number);
            if (this._periodo === 'anio') return y === this._anio;
            return y === this._anio && m === this._mes;
        };

        const prevRealizadas = preventivos.filter(r => r.estado === 'Realizada' && inPeriod(r.fecha_ejecutada || r.fecha_programada));
        const fallas = correctivos.filter(r => inPeriod(r.fecha_falla));
        const totalMant = prevRealizadas.length + fallas.length;

        const years = [...new Set([
            ...preventivos.map(r => (r.fecha_ejecutada || r.fecha_programada || '').split('T')[0].split('-')[0]).filter(y => y && y.length === 4),
            ...correctivos.map(r => (r.fecha_falla || '').split('T')[0].split('-')[0]).filter(y => y && y.length === 4)
        ])].map(Number).sort((a, b) => b - a);
        if (years.length === 0) years.push(this._anio);
        if (!years.includes(this._anio)) this._anio = years[0];

        const rangoTexto = this._periodo === 'anio' ? 'Año ' + this._anio : meses[this._mes - 1] + ' ' + this._anio;

        el.innerHTML = `
            <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:8px 16px;margin-bottom:16px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">
            <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
            <div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
                <div><h2 style="margin:0;font-size:15px;font-weight:800;color:white;letter-spacing:-0.5px">Dashboard</h2>
                <p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Panel principal de control de mantenimiento · ${rangoTexto}</p></div>
                <div style="display:flex;gap:6px;align-items:center">
                    <div style="display:flex;gap:2px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:2px">
                        <button onclick="App.modules.dashboard.setPeriodo('anio')" class="btn btn-sm ${this._periodo === 'anio' ? 'btn-primary' : 'btn-ghost'}" style="color:${this._periodo === 'anio' ? 'white' : 'rgba(255,255,255,0.7)'}">Año</button>
                        <button onclick="App.modules.dashboard.setPeriodo('mes')" class="btn btn-sm ${this._periodo === 'mes' ? 'btn-primary' : 'btn-ghost'}" style="color:${this._periodo === 'mes' ? 'white' : 'rgba(255,255,255,0.7)'}">Por mes</button>
                    </div>
                    <select onchange="App.modules.dashboard.setAnio(this.value)" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);border-radius:6px;padding:5px 8px;font-size:11px;color:white;font-weight:600;cursor:pointer;outline:none;backdrop-filter:blur(8px)">
                        ${years.map(y => `<option value="${y}" style="color:#1e293b" ${y === this._anio ? 'selected' : ''}>${y}</option>`).join('')}
                    </select>
                    ${this._periodo === 'mes' ? `<select onchange="App.modules.dashboard.setMes(this.value)" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);border-radius:6px;padding:5px 8px;font-size:11px;color:white;font-weight:600;cursor:pointer;outline:none;backdrop-filter:blur(8px)">${meses.map((m, i) => `<option value="${i + 1}" style="color:#1e293b" ${(i + 1) === this._mes ? 'selected' : ''}>${m}</option>`).join('')}</select>` : ''}
                </div>
            </div></div>
            <style>
@keyframes dash_fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.dash-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}
.dash-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important;transform:translateY(-3px)}
.dash-row{transition:all 0.2s}
.dash-row:hover{transform:translateX(2px);background:#f8fafc!important}
</style>
            <div class="stats-grid">
                <div class="stat-card dash-card" style="border-left:4px solid #3b82f6">
                    <div class="stat-icon blue"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M2 20h20"/><path d="M5 20V8l5 4V8l5 4V4h3v16"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Total Mantenciones</p><p class="stat-sub">${rangoTexto}</p></div>
                    <div class="stat-value">${totalMant}</div>
                </div>
                <div class="stat-card dash-card" style="border-left:4px solid #22c55e">
                    <div class="stat-icon green"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" style="vertical-align:-2px"><polyline points="20 6 9 17 4 12"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Preventivas</p><p class="stat-sub">Realizadas · ${rangoTexto}</p></div>
                    <div class="stat-value">${prevRealizadas.length}</div>
                </div>
                <div class="stat-card dash-card" style="border-left:4px solid #ef4444">
                    <div class="stat-icon red"><svg width="12" height="12" viewBox="0 0 24 24" fill="#ef4444" style="vertical-align:-2px"><circle cx="12" cy="12" r="6"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Fallas</p><p class="stat-sub">Registradas · ${rangoTexto}</p></div>
                    <div class="stat-value">${fallas.length}</div>
                </div>
                <div class="stat-card dash-card" style="border-left:4px solid #f59e0b">
                    <div class="stat-icon orange"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Proximas (15d)</p><p class="stat-sub">Programadas</p></div>
                    <div class="stat-value">${statsSummary.upcomingMaintenance}</div>
                </div>
                <div class="stat-card dash-card" style="border-left:4px solid #ef4444">
                    <div class="stat-icon red"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" style="vertical-align:-2px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
                    <div class="stat-info"><p class="stat-label">Vencidas</p><p class="stat-sub">Requieren accion</p></div>
                    <div class="stat-value">${statsSummary.overdueMaintenance}</div>
                </div>
            </div>
            <div class="row" style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
                ${this.renderOverdueLocal(overdue, maqMap, compMap)}
                ${this.renderUpcomingLocal(upcoming, maqMap, compMap)}
            </div>
            ${this.renderTopFallas(topFallas)}
            ${this.renderRecentFailuresLocal(recentFailures, maqMap, compMap)}
            ${this.renderRecentPreventiveLocal(recentPreventive, maqMap, compMap)}
        `;
    },

    setPeriodo(periodo) { this._periodo = periodo; this.renderData(); },
    setMes(mes) { this._mes = parseInt(mes); this.renderData(); },
    setAnio(anio) { this._anio = parseInt(anio); this.renderData(); },

    computeTopFallasPeriodo(correctivos, maquinas, periodo, anio, mes) {
        const inPeriod = (fecha) => {
            if (!fecha) return false;
            const f = fecha.split('T')[0];
            const [y, m, d] = f.split('-').map(Number);
            if (periodo === 'anio') return y === anio;
            return y === anio && m === mes;
        };
        const fallasFiltradas = correctivos.filter(r => inPeriod(r.fecha_falla));
        const counts = {};
        for (const f of fallasFiltradas) {
            const maq = maquinas.find(m => m.id === f.maquina_id);
            const nombre = maq ? maq.nombre : 'Sin máquina';
            if (!counts[nombre]) counts[nombre] = { nombre, total_fallas: 0, maquina_id: f.maquina_id };
            counts[nombre].total_fallas++;
        }
        return Object.values(counts)
            .sort((a, b) => b.total_fallas - a.total_fallas)
            .slice(0, 5);
    },

    renderOverdueLocal(data, maqMap, compMap) {
        return `<div class="card dash-card">
            <div class="card-header"><h3><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" style="vertical-align:-2px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Mantenciones Vencidas</h3></div>
            <div class="card-body">${data.length === 0 ? '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">No hay mantenciones vencidas</h4><p style="margin:0;color:#94a3b8;font-size:13px">¡Todo al día!</p></div>' : `
            <div class="sigma-table-wrap"><table><thead><tr><th>Máquina</th><th>Componente</th><th>Fecha Prog.</th><th>Acción</th></tr></thead>
            <tbody>${data.slice(0,5).map(v => {
                const maq = maqMap[v.maquina_id];
                const comp = compMap[v.componente_id];
                return `<tr><td>${maq ? maq.nombre : '-'}</td><td>${comp ? comp.nombre : '-'}</td><td>${App.formatDate(v.fecha_programada)}</td><td><button class="btn btn-sm btn-info" title="Ir a registro" onclick="App.loadModule('preventive');setTimeout(()=>App.modules.preventive.showForm(${v.id}),300)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></td></tr>`;
            }).join('')}</tbody></table>
            ${SigmaCards.generate({
                title: v => `<strong>${maqMap[v.maquina_id]?.nombre || '-'}</strong>`,
                subtitle: v => compMap[v.componente_id]?.nombre || '-',
                badge: () => '<span class="sc-badge" style="background:#fee2e2;color:#991b1b">Vencida</span>',
                fields: [{ label: 'Fecha', value: v => App.formatDate(v.fecha_programada) }],
                actions: v => `<button class="btn btn-sm btn-info" onclick="App.loadModule('preventive');setTimeout(()=>App.modules.preventive.showForm(${v.id}),300)">Ver</button>`,
                cardClass: () => 'sc-vencida'
            }, data.slice(0,5))}</div>`}
            </div></div>`;
    },

    renderUpcomingLocal(data, maqMap, compMap) {
        return `<div class="card dash-card">
            <div class="card-header"><h3><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Próximas Mantenciones</h3></div>
            <div class="card-body">${data.length === 0 ? '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">No hay mantenciones próximas</h4><p style="margin:0;color:#94a3b8;font-size:13px">Programa la próxima mantención</p></div>' : `
            <div class="sigma-table-wrap"><table><thead><tr><th>Máquina</th><th>Componente</th><th>Fecha Prog.</th></tr></thead>
            <tbody>${data.slice(0,5).map(v => {
                const maq = maqMap[v.maquina_id];
                const comp = compMap[v.componente_id];
                return `<tr><td>${maq ? maq.nombre : '-'}</td><td>${comp ? comp.nombre : '-'}</td><td>${App.formatDate(v.fecha_programada)}</td></tr>`;
            }).join('')}</tbody></table>
            ${SigmaCards.generate({
                title: v => `<strong>${maqMap[v.maquina_id]?.nombre || '-'}</strong>`,
                subtitle: v => compMap[v.componente_id]?.nombre || '-',
                fields: [{ label: 'Fecha', value: v => App.formatDate(v.fecha_programada) }],
                cardClass: () => 'sc-proxima'
            }, data.slice(0,5))}</div>`}
            </div></div>`;
    },

    renderTopFallas(data) {
        const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        const rangoTexto = this._periodo === 'anio' ? 'Año ' + this._anio : meses[this._mes - 1] + ' ' + this._anio;
        if (!data || data.length === 0) {
            return `<div class="card mt-16 dash-card">
                <div class="card-header"><h3><svg width="14" height="14" viewBox="0 0 24 24" fill="#ef4444" style="vertical-align:-2px"><circle cx="12" cy="12" r="6"/></svg> Top 5 Máquinas con Más Fallas · ${rangoTexto}</h3></div>
                <div class="card-body" style="text-align:center;padding:32px;color:#94a3b8;font-size:13px">No hay fallas registradas en este período</div>
            </div>`;
        }
        const maxFallas = data[0] ? data[0].total_fallas : 1;
        const medals = ['#f59e0b','#94a3b8','#cd7f32','#6b7280','#6b7280'];
        let bars = '';
        data.forEach((item, i) => {
            const pct = maxFallas > 0 ? (item.total_fallas / maxFallas * 100) : 0;
            const clickId = item.maquina_id || '';
            const onclick = clickId ? `onclick="App.modules.dashboard.showMachineDetail(${clickId})"` : '';
            const cursor = clickId ? 'cursor:pointer' : '';
            bars += `<div class="dash-row" style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;background:#f8fafc;margin-bottom:6px;${cursor}" ${onclick}>
                <span style="width:24px;height:24px;border-radius:50%;background:${medals[i]};color:white;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${i + 1}</span>
                <span style="flex:1;font-size:13px;font-weight:600;color:#1e293b">${escapeHtml(item.nombre)}</span>
                <div style="width:120px;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;flex-shrink:0"><div style="width:${pct}%;height:100%;background:${i === 0 ? '#ef4444' : '#f97316'};border-radius:4px;transition:width 0.6s ease"></div></div>
                <span style="font-size:13px;font-weight:700;color:#ef4444;min-width:20px;text-align:right">${item.total_fallas}</span>
            </div>`;
        });
        return `<div class="card mt-16 dash-card">
            <div class="card-header"><h3><svg width="14" height="14" viewBox="0 0 24 24" fill="#ef4444" style="vertical-align:-2px"><circle cx="12" cy="12" r="6"/></svg> Top 5 Máquinas con Más Fallas · ${rangoTexto}</h3></div>
            <div class="card-body">${bars}</div></div>`;
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
                <td><button class="btn btn-sm btn-info" title="Ir a registro" onclick="App.loadModule('corrective');setTimeout(()=>App.modules.corrective.showForm(${c.id}),300)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></td>
            </tr>`;
        }
        const cardsHtml = SigmaCards.generate({
            title: c => `<strong>${maqMap[c.maquina_id]?.nombre || '-'}</strong>`,
            subtitle: c => compMap[c.componente_id]?.nombre || '-',
            badge: c => `<span class="sc-badge" style="background:${c.estado === 'Reparada' ? '#dcfce7;color:#166534' : '#fee2e2;color:#991b1b'}">${c.estado || 'En Mantención'}</span>`,
            fields: [
                { label: 'Fecha', value: c => App.formatDate(c.fecha_falla) },
                { label: 'Responsable', value: c => c.responsable || '-' },
                { label: 'Hs.Det.', value: c => c.horas_detencion }
            ],
            actions: c => `<button class="btn btn-sm btn-info" onclick="App.loadModule('corrective');setTimeout(()=>App.modules.corrective.showForm(${c.id}),300)">Ver</button>`
        }, recentFailures);
        return `<div class="card mt-16">
            <div class="card-header"><h3><svg width="14" height="14" viewBox="0 0 24 24" fill="#ef4444" style="vertical-align:-2px"><circle cx="12" cy="12" r="6"/></svg> Últimas Fallas Registradas</h3></div>
            <div class="card-body" style="padding:0">
                <div class="sigma-table-wrap"><table><thead><tr><th>Máquina</th><th>Componente</th><th>Fecha</th><th>Falla</th><th>Técnico</th><th>Estado</th><th>Hs.Det.</th><th>Acción</th></tr></thead>
                <tbody>${rows}</tbody></table>${cardsHtml}</div></div></div>`;
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
                <td><button class="btn btn-sm btn-info" title="Ir a registro" onclick="App.loadModule('preventive');setTimeout(()=>App.modules.preventive.showForm(${p.id}),300)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></td>
            </tr>`;
        }
        const cardsHtml = SigmaCards.generate({
            title: p => `<strong>${maqMap[p.maquina_id]?.nombre || '-'}</strong>`,
            subtitle: p => compMap[p.componente_id]?.nombre || '-',
            badge: () => '<span class="sc-badge" style="background:#dcfce7;color:#166534">Realizada</span>',
            fields: [
                { label: 'Fecha', value: p => App.formatDate(p.fecha_programada) },
                { label: 'Técnico', value: p => p.tecnico || '-' }
            ],
            actions: p => `<button class="btn btn-sm btn-info" onclick="App.loadModule('preventive');setTimeout(()=>App.modules.preventive.showForm(${p.id}),300)">Ver</button>`
        }, data);
        return `<div class="card mt-16">
            <div class="card-header"><h3><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" style="vertical-align:-2px"><polyline points="20 6 9 17 4 12"/></svg> Últimas Mantenciones Preventivas Realizadas</h3></div>
            <div class="card-body" style="padding:0">
                <div class="sigma-table-wrap"><table><thead><tr><th>Máquina</th><th>Componente</th><th>Observaciones</th><th>Fecha Prog.</th><th>Fecha Ejec.</th><th>Técnico</th><th>Turno</th><th>Acción</th></tr></thead>
                <tbody>${rows}</tbody></table>${cardsHtml}</div></div></div>`;
    }
});
