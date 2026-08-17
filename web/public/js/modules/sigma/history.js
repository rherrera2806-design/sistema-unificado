App.registerModule('history', {
    _selectedMaq: 0,

    async render() {
        const el = document.getElementById('page-history');
        const maquinas = await db.getAll('machines');
        this._selectedMaq = document.getElementById('histMaquina') ? parseInt(document.getElementById('histMaquina').value) : this._selectedMaq;
        el.innerHTML = `
            <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:8px 16px;margin-bottom:16px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">
            <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
            <div style="position:relative;z-index:1"><h2 style="margin:0;font-size:15px;font-weight:800;color:white;letter-spacing:-0.5px">Historial por Maquina</h2>
            <p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Ficha completa de intervenciones</p></div></div>
            <style>
@keyframes hist_fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.hist-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}
.hist-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important;transform:translateY(-3px)}
.hist-row{transition:all 0.2s}
.hist-row:hover{transform:translateX(2px);background:#f8fafc!important}
</style>
            <div class="card hist-card">
                <div class="card-header">
                    <div class="flex items-center gap-16">
                        <label style="font-weight:500">Máquina:</label>
                        <select class="form-control" id="histMaquina" style="width:auto;min-width:300px" onchange="App.modules.history.render()">
                            <option value="0">-- Seleccione --</option>
                            ${maquinas.map(m => `<option value="${m.id}" ${this._selectedMaq === m.id ? 'selected' : ''}>${m.codigo} - ${m.nombre}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>
            ${this._selectedMaq ? await this.renderHistory(this._selectedMaq) : '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51l.06.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">Seleccione una máquina</h4><p style="margin:0;color:#94a3b8;font-size:13px">Elija una máquina para ver su historial</p></div>'}
        `;
    },

    async renderHistory(maquinaId) {
        const info = await db.getMachineWithDetails(maquinaId);
        if (!info) return '';
        const { maquina, tipo, componentes, preventivos, correctivos } = info;
        const totalHorasDet = correctivos.reduce((s, c) => s + (c.horas_detencion || 0), 0);
        const repuestosUsados = correctivos.filter(c => c.repuestos_utilizados).map(c => c.repuestos_utilizados);
        let prevRows = '', corrRows = '';
        for (const p of preventivos) {
            const comp = await db.getById('components', p.componente_id).catch(() => null);
            prevRows += `<tr><td>${comp ? comp.nombre : '-'}</td><td>${p.observaciones || '-'}</td><td>${App.formatDate(p.fecha_programada)}</td><td>${App.formatDate(p.fecha_ejecutada)}</td><td>${p.tecnico || '-'}</td><td>${p.turno || 'Dia'}</td><td><span class="status-badge ${App.getEstadoClass(p.estado)}">${p.estado}</span></td></tr>`;
        }
        for (const c of correctivos) {
            const comp = await db.getById('components', c.componente_id).catch(() => null);
            corrRows += `<tr><td>${comp ? comp.nombre : '-'}</td><td>${App.formatDate(c.fecha_falla)}</td><td>${c.descripcion_falla}</td><td>${c.diagnostico || '-'}</td><td>${c.turno || 'Dia'}</td><td>${c.horas_detencion}</td></tr>`;
        }
        return `
            <div class="card hist-card">
                <div class="card-header"><h3>${maquina.codigo} - ${maquina.nombre}</h3>
                    <span class="status-badge ${App.getEstadoClass(maquina.estado_operativo)}">${maquina.estado_operativo}</span>
                </div>
                <div class="card-body">
                    <div class="form-row" style="grid-template-columns:1fr 1fr 1fr">
                        <div><strong>Tipo:</strong> ${tipo ? tipo.nombre : '-'}</div>
                        <div><strong>Marca:</strong> ${maquina.marca || '-'}</div>
                        <div><strong>Modelo:</strong> ${maquina.modelo || '-'}</div>
                        <div><strong>Serie:</strong> ${maquina.numero_serie || '-'}</div>
                        <div><strong>Ubicación:</strong> ${maquina.ubicacion || '-'}</div>
                        <div><strong>Fecha Compra:</strong> ${App.formatDate(maquina.fecha_compra)}</div>
                    </div>
                </div>
            </div>
            <div class="stats-grid">
                <div class="stat-card dash-card hist-card" style="border-left:4px solid #3b82f6"><div class="stat-icon blue"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg></div><div class="stat-info"><p class="stat-label">Mantenciones</p><p class="stat-sub">Preventivas</p></div><div class="stat-value">${preventivos.length}</div></div>
                <div class="stat-card dash-card hist-card" style="border-left:4px solid #ef4444"><div class="stat-icon red"><svg width="12" height="12" viewBox="0 0 24 24" fill="#ef4444" style="vertical-align:-2px"><circle cx="12" cy="12" r="6"/></svg></div><div class="stat-info"><p class="stat-label">Fallas</p><p class="stat-sub">Correctivas</p></div><div class="stat-value">${correctivos.length}</div></div>
                <div class="stat-card dash-card hist-card" style="border-left:4px solid #f59e0b"><div class="stat-icon orange"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><div class="stat-info"><p class="stat-label">Horas detencion</p><p class="stat-sub">Acumuladas</p></div><div class="stat-value">${totalHorasDet}</div></div>
                <div class="stat-card dash-card hist-card" style="border-left:4px solid #22c55e"><div class="stat-icon green"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></div><div class="stat-info"><p class="stat-label">Componentes</p><p class="stat-sub">Registrados</p></div><div class="stat-value">${componentes.length}</div></div>
            </div>
            <div class="card hist-card">
                <div class="card-header"><h3>Componentes</h3></div>
                <div class="card-body">${componentes.map(c => `<span class="status-badge status-programada" style="margin:2px">${c.nombre}</span>`).join(' ') || 'Sin componentes'}</div>
            </div>
            <div class="card hist-card">
                <div class="card-header"><h3><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg> Preventivas</h3></div>
                <div class="card-body" style="padding:0">
                    <div class="sigma-table-wrap">
                    ${preventivos.length === 0 ? '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">Sin registros preventivos</h4><p style="margin:0;color:#94a3b8;font-size:13px">No hay mantenciones preventivas</p></div>' : `
                    <table><thead><tr><th>Componente</th><th>Observaciones</th><th>Fecha Prog.</th><th>Fecha Ejec.</th><th>Técnico</th><th>Turno</th><th>Estado</th></tr></thead><tbody>${prevRows}</tbody></table>
                    ${SigmaCards.generate({
                        title: (p, i) => `<strong>${preventivos[i]?.compNombre || 'Componente'}</strong>`,
                        badge: p => `<span class="sc-badge" style="background:${p.estado === 'Realizada' ? '#dcfce7;color:#166534' : '#dbeafe;color:#1e40af'}">${p.estado}</span>`,
                        fields: [
                            { label: 'Fecha', value: (p, i) => App.formatDate(p.fecha_programada) },
                            { label: 'Técnico', value: p => p.tecnico || '-' },
                            { label: 'Turno', value: p => p.turno || 'Dia' }
                        ]
                    }, preventivos)}`}
                    </div>
                </div>
            </div>
            <div class="card hist-card">
                <div class="card-header"><h3><svg width="14" height="14" viewBox="0 0 24 24" fill="#ef4444" style="vertical-align:-2px"><circle cx="12" cy="12" r="6"/></svg> Fallas</h3></div>
                <div class="card-body" style="padding:0">
                    <div class="sigma-table-wrap">
                    ${correctivos.length === 0 ? '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">Sin registros de fallas</h4><p style="margin:0;color:#94a3b8;font-size:13px">No hay fallas correctivas</p></div>' : `
                    <table><thead><tr><th>Componente</th><th>Fecha</th><th>Falla</th><th>Diagnóstico</th><th>Turno</th><th>Horas Det.</th></tr></thead><tbody>${corrRows}</tbody></table>
                    ${SigmaCards.generate({
                        title: (c, i) => `<strong>${correctivos[i]?.compNombre || 'Componente'}</strong>`,
                        badge: () => `<span class="sc-badge" style="background:#fee2e2;color:#991b1b">Falla</span>`,
                        fields: [
                            { label: 'Fecha', value: c => App.formatDate(c.fecha_falla) },
                            { label: 'Turno', value: c => c.turno || 'Dia' },
                            { label: 'Hs.Det.', value: c => c.horas_detencion }
                        ]
                    }, correctivos)}`}
                    </div>
                </div>
            </div>
            ${repuestosUsados.length > 0 ? `
            <div class="card hist-card">
                <div class="card-header"><h3><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> Repuestos Utilizados</h3></div>
                <div class="card-body"><ul style="margin-left:20px">${repuestosUsados.map(r => `<li style="margin:4px 0">${r}</li>`).join('')}</ul></div>
            </div>` : ''}
        `;
    }
});
