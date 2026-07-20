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
                    <div class="form-row" style="grid-template-columns:1fr 1fr 1fr 1fr 1fr;gap:12px;align-items:end">
                        <div class="form-group"><label>Fecha Desde</label><input type="date" class="form-control" id="bitFechaDesde" onchange="App.modules.bitacora.applyFilters()"></div>
                        <div class="form-group"><label>Fecha Hasta</label><input type="date" class="form-control" id="bitFechaHasta" onchange="App.modules.bitacora.applyFilters()"></div>
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
        const tecnico = document.getElementById('bitTecnico').value;

        let filtered = this._data.filter(r => {
            const fecha = r.tipo_mantencion === 'Preventiva' ? (r.fecha_ejecutada || r.fecha_programada) : (r.fecha_falla || '');
            if (desde && fecha < desde) return false;
            if (hasta && fecha > hasta) return false;
            if (tipo && r.tipo_mantencion !== tipo) return false;
            if (turno && (r.turno || 'Dia') !== turno) return false;
            if (tecnico && (r.tecnico || r.responsable || '-') !== tecnico) return false;
            return true;
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
            const detalle = r.detalle || '-';
            const estado = r.tipo_mantencion === 'Preventiva' ? (r.estado || '-') : (r.estado || 'Reparada');
            rows += `<tr>
                <td>${App.formatDate(fecha)}</td>
                <td><span style="background:${tipoColor};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px">${escapeHtml(r.tipo_mantencion)}</span></td>
                <td>${escapeHtml(turno)}</td>
                <td>${escapeHtml(tecnico)}</td>
                <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(detalle)}">${escapeHtml(detalle)}</td>
                <td><span class="status-badge ${App.getEstadoClass(estado)}">${escapeHtml(estado)}</span></td>
            </tr>`;
        }
        container.innerHTML = `<table><thead><tr><th>Fecha</th><th>Tipo</th><th>Turno</th><th>Técnico</th><th>Detalle</th><th>Estado</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
});
