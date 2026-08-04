App.registerModule('bitacora', {
    _data: [],

    async render() {
        const el = document.getElementById('page-bitacora');
        el.innerHTML = `
            <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:14px 24px;margin-bottom:20px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">
<div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
<div style="position:relative;z-index:1"><h2 style="margin:0;font-size:18px;font-weight:800;color:white;letter-spacing:-0.5px">Bitácora de Mantención</h2>
<p style="margin:2px 0 0;font-size:11px;color:rgba(255,255,255,0.7)">Historial completo de mantenciones realizadas</p></div></div>
            <style>
@keyframes bita_fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.bita-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}
.bita-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important;transform:translateY(-3px)}
.bita-row{transition:all 0.2s}
.bita-row:hover{transform:translateX(2px);background:#f8fafc!important}
</style>
            <div class="card bita-card">
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
            <div class="card bita-card">
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
            document.getElementById('bitacoraContent').innerHTML = '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">Error al cargar datos</h4><p style="margin:0;color:#94a3b8;font-size:13px">Intenta recargar la página</p></div>';
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
            container.innerHTML = '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">No hay registros con los filtros seleccionados</h4><p style="margin:0;color:#94a3b8;font-size:13px">Intenta con otros criterios de búsqueda</p></div>';
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
