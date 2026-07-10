App.registerModule('history', {
    _selectedMaq: 0,

    async render() {
        const el = document.getElementById('page-history');
        const maquinas = await db.getAll('machines');
        this._selectedMaq = document.getElementById('histMaquina') ? parseInt(document.getElementById('histMaquina').value) : this._selectedMaq;
        el.innerHTML = `
            <div class="page-header">
                <div><h2>Historial por Máquina</h2><div class="subtitle">Ficha completa de intervenciones</div></div>
            </div>
            <div class="card">
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
            ${this._selectedMaq ? await this.renderHistory(this._selectedMaq) : '<div class="empty-state" style="padding:60px"><div class="icon">📜</div><h4>Seleccione una máquina</h4></div>'}
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
            <div class="card">
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
                <div class="stat-card"><div class="stat-icon blue">📋</div><div class="stat-info"><h4>${preventivos.length}</h4><p>Mantenciones</p></div></div>
                <div class="stat-card"><div class="stat-icon red">🔴</div><div class="stat-info"><h4>${correctivos.length}</h4><p>Fallas</p></div></div>
                <div class="stat-card"><div class="stat-icon orange">⏱️</div><div class="stat-info"><h4>${totalHorasDet}</h4><p>Horas detención</p></div></div>
                <div class="stat-card"><div class="stat-icon green">🔧</div><div class="stat-info"><h4>${componentes.length}</h4><p>Componentes</p></div></div>
            </div>
            <div class="card">
                <div class="card-header"><h3>Componentes</h3></div>
                <div class="card-body">${componentes.map(c => `<span class="status-badge status-programada" style="margin:2px">${c.nombre}</span>`).join(' ') || 'Sin componentes'}</div>
            </div>
            <div class="card">
                <div class="card-header"><h3>📋 Preventivas</h3></div>
                <div class="card-body" style="padding:0">
                    ${preventivos.length === 0 ? '<div class="empty-state"><p>Sin registros</p></div>' : `<table><thead><tr><th>Componente</th><th>Observaciones</th><th>Fecha Prog.</th><th>Fecha Ejec.</th><th>Técnico</th><th>Turno</th><th>Estado</th></tr></thead><tbody>${prevRows}</tbody></table>`}
                </div>
            </div>
            <div class="card">
                <div class="card-header"><h3>🔴 Fallas</h3></div>
                <div class="card-body" style="padding:0">
                    ${correctivos.length === 0 ? '<div class="empty-state"><p>Sin registros</p></div>' : `<table><thead><tr><th>Componente</th><th>Fecha</th><th>Falla</th><th>Diagnóstico</th><th>Turno</th><th>Horas Det.</th></tr></thead><tbody>${corrRows}</tbody></table>`}
                </div>
            </div>
            ${repuestosUsados.length > 0 ? `
            <div class="card">
                <div class="card-header"><h3>📦 Repuestos Utilizados</h3></div>
                <div class="card-body"><ul style="margin-left:20px">${repuestosUsados.map(r => `<li style="margin:4px 0">${r}</li>`).join('')}</ul></div>
            </div>` : ''}
        `;
    }
});
