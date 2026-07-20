App.registerModule('bitacora', {
    _data: [],

    async render() {
        const el = document.getElementById('page-bitacora');
        el.innerHTML = `
            <div class="page-header">
                <div><h2>Bitácora de Mantención</h2><div class="subtitle">Historial completo de mantenciones realizadas</div></div>
            </div>
            <div class="card">
                <div class="card-body">
                    <div class="form-row" style="grid-template-columns:1fr 1fr 1fr 1fr 1fr 1fr;gap:12px;align-items:end">
                        <div class="form-group"><label>Fecha Desde</label><input type="date" class="form-control" id="bitFechaDesde" onchange="App.modules.bitacora.applyFilters()" style="min-width:140px"></div>
                        <div class="form-group"><label>Fecha Hasta</label><input type="date" class="form-control" id="bitFechaHasta" onchange="App.modules.bitacora.applyFilters()" style="min-width:140px"></div>
                        <div class="form-group"><label>Tipo</label>
                            <select class="form-control" id="bitTipo" onchange="App.modules.bitacora.applyFilters()">
                                <option value="">Todos</option>
                                <option value="Preventiva">Preventiva</option>
                                <option value="Correctiva">Correctiva</option>
                            </select>
                        </div>
                        <div class="form-group"><label>Turno</label>
                            <select class="form-control" id="bitTurno" onchange="App.modules.bitacora.applyFilters()">
                                <option value="">Todos</option>
                                <option value="Dia">Día</option>
                                <option value="Noche">Noche</option>
                            </select>
                        </div>
                        <div class="form-group"><label>Estado</label>
                            <select class="form-control" id="bitEstado" onchange="App.modules.bitacora.applyFilters()">
                                <option value="activos" selected>Reparada / Realizada</option>
                                <option value="">Todos</option>
                                <option value="Reparada">Reparada</option>
                                <option value="Realizada">Realizada</option>
                                <option value="Pendiente">Pendiente</option>
                            </select>
                        </div>
                        <div class="form-group"><label>Técnico</label>
                            <select class="form-control" id="bitTecnico" onchange="App.modules.bitacora.applyFilters()">
                                <option value="">Todos</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
            <div class="card">
                <div class="card-body" style="padding:0" id="bitacoraContent">
                    <div class="empty-state"><p>Cargando...</p></div>
                </div>
            </div>
        `;
        await this.loadData();
    },

    async loadData() {
        try {
            this._data = await db.getBitacora();
            this.populateTecnicos();
            this.applyFilters();
        } catch(e) {
            console.error('Error loading bitacora:', e);
            document.getElementById('bitacoraContent').innerHTML = '<div class="empty-state"><p>Error al cargar datos</p></div>';
        }
    },

    populateTecnicos() {
        const tecnicos = [...new Set(this._data.map(r => r.tecnico || r.responsable).filter(t => t && t !== '-'))];
        const select = document.getElementById('bitTecnico');
        select.innerHTML = '<option value="">Todos</option>' + tecnicos.sort().map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
    },

    applyFilters() {
        const desde = document.getElementById('bitFechaDesde').value;
        const hasta = document.getElementById('bitFechaHasta').value;
        const tipo = document.getElementById('bitTipo').value;
        const turno = document.getElementById('bitTurno').value;
        const estado = document.getElementById('bitEstado').value;
        const tecnico = document.getElementById('bitTecnico').value;

        let filtered = this._data.filter(r => {
            const fecha = r.tipo_mantencion === 'Preventiva' ? (r.fecha_ejecutada || r.fecha_programada) : (r.fecha_falla || '');
            if (desde && fecha < desde) return false;
            if (hasta && fecha > hasta) return false;
            if (tipo && r.tipo_mantencion !== tipo) return false;
            if (turno && (r.turno || 'Dia') !== turno) return false;
            if (tecnico && (r.tecnico || r.responsable || '-') !== tecnico) return false;
            
            const est = r.tipo_mantencion === 'Preventiva' ? (r.estado || '-') : (r.estado || 'Reparada');
            if (estado === 'activos') {
                if (est !== 'Reparada' && est !== 'Realizada') return false;
            } else if (estado) {
                if (est !== estado) return false;
            }
            
            return true;
        });

        // Sort by date descending (newest first)
        filtered.sort((a, b) => {
            const fechaA = a.tipo_mantencion === 'Preventiva' ? (a.fecha_ejecutada || a.fecha_programada || '') : (a.fecha_falla || '');
            const fechaB = b.tipo_mantencion === 'Preventiva' ? (b.fecha_ejecutada || b.fecha_programada || '') : (b.fecha_falla || '');
            const dateA = fechaA ? new Date(fechaA + 'T00:00:00') : new Date(0);
            const dateB = fechaB ? new Date(fechaB + 'T00:00:00') : new Date(0);
            return dateB - dateA;
        });

        this.renderTable(filtered);
    },

    renderTable(data) {
        const container = document.getElementById('bitacoraContent');
        if (!data || data.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No hay registros con los filtros seleccionados</p></div>';
            return;
        }
        let rows = '';
        for (const r of data) {
            const fecha = r.tipo_mantencion === 'Preventiva' ? (r.fecha_ejecutada || r.fecha_programada) : (r.fecha_falla || '');
            const tipoColor = r.tipo_mantencion === 'Preventiva' ? '#28a745' : '#dc3545';
            const turno = r.turno || 'Dia';
            const tecnico = r.tecnico || r.responsable || '-';
            const maquina = r.maquina_nombre || '-';
            const componente = r.componente_nombre || '-';
            const detalle = r.detalle || '-';
            const estado = r.tipo_mantencion === 'Preventiva' ? (r.estado || '-') : (r.estado || 'Reparada');
            rows += `<tr>
                <td>${App.formatDate(fecha)}</td>
                <td><span style="background:${tipoColor};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px">${escapeHtml(r.tipo_mantencion)}</span></td>
                <td>${escapeHtml(turno)}</td>
                <td>${escapeHtml(maquina)}</td>
                <td>${escapeHtml(componente)}</td>
                <td>${escapeHtml(tecnico)}</td>
                <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(detalle)}">${escapeHtml(detalle)}</td>
                <td><span class="status-badge ${App.getEstadoClass(estado)}">${escapeHtml(estado)}</span></td>
                <td><button onclick="App.modules.bitacora.verDetalle(${JSON.stringify(r).replace(/"/g, '&quot;')})" style="background:rgba(59,130,246,0.1);color:#3b82f6;border:none;border-radius:6px;width:28px;height:28px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-size:14px" title="Ver detalle">&#128065;</button></td>
            </tr>`;
        }
        container.innerHTML = `<table><thead><tr><th>Fecha</th><th>Tipo</th><th>Turno</th><th>Máquina</th><th>Componente</th><th>Técnico</th><th>Detalle</th><th>Estado</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
    },

    verDetalle(r) {
        const fecha = r.tipo_mantencion === 'Preventiva' ? (r.fecha_ejecutada || r.fecha_programada) : (r.fecha_falla || '');
        const tipoColor = r.tipo_mantencion === 'Preventiva' ? '#28a745' : '#dc3545';
        const estado = r.tipo_mantencion === 'Preventiva' ? (r.estado || '-') : (r.estado || 'Reparada');
        const modal = document.createElement('div');
        modal.id = 'bitModalDetalle';
        modal.style.cssText = 'position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5)';
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
        modal.innerHTML = `
            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:24px;width:90%;max-width:500px;box-shadow:0 8px 32px rgba(0,0,0,0.2)">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                    <h3 style="font-size:16px;font-weight:700">Detalle de Mantención</h3>
                    <button onclick="document.getElementById('bitModalDetalle').remove()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--text-light)">&#10005;</button>
                </div>
                <div style="display:flex;flex-direction:column;gap:10px;font-size:13px">
                    <div style="display:flex;justify-content:space-between"><span style="color:var(--text-light)">Fecha:</span><span style="font-weight:600">${App.formatDate(fecha)}</span></div>
                    <div style="display:flex;justify-content:space-between"><span style="color:var(--text-light)">Tipo:</span><span style="background:${tipoColor};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px">${r.tipo_mantencion}</span></div>
                    <div style="display:flex;justify-content:space-between"><span style="color:var(--text-light)">Turno:</span><span style="font-weight:600">${r.turno || 'Dia'}</span></div>
                    <div style="display:flex;justify-content:space-between"><span style="color:var(--text-light)">Máquina:</span><span style="font-weight:600">${r.maquina_nombre || '-'}</span></div>
                    <div style="display:flex;justify-content:space-between"><span style="color:var(--text-light)">Componente:</span><span style="font-weight:600">${r.componente_nombre || '-'}</span></div>
                    <div style="display:flex;justify-content:space-between"><span style="color:var(--text-light)">Técnico:</span><span style="font-weight:600">${r.tecnico || r.responsable || '-'}</span></div>
                    <div style="display:flex;justify-content:space-between"><span style="color:var(--text-light)">Estado:</span><span class="status-badge ${App.getEstadoClass(estado)}">${estado}</span></div>
                    ${r.horas_detalles ? `<div style="display:flex;justify-content:space-between"><span style="color:var(--text-light)">Hs. Detalle:</span><span style="font-weight:600">${r.horas_detalles}</span></div>` : ''}
                    ${r.dias ? `<div style="display:flex;justify-content:space-between"><span style="color:var(--text-light)">Días:</span><span style="font-weight:600">${r.dias}</span></div>` : ''}
                    <div style="border-top:1px solid var(--border);padding-top:10px;margin-top:4px">
                        <span style="color:var(--text-light);font-size:12px">Detalle:</span>
                        <p style="margin:4px 0 0;font-weight:500;line-height:1.5">${r.detalle || '-'}</p>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
});
