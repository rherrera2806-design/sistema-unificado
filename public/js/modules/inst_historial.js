App.registerModule('inst_historial', {
    instalaciones: [],

    async render() {
        const el = document.getElementById('page-inst_historial');
        el.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
                <div><h2 style="margin:0">Historial de Instalaciones</h2><div class="subtitle">Listado completo de todas las instalaciones</div></div>
            </div>
            <div id="instHistContent"></div>
        `;
        await this.loadData();
    },

    async loadData() {
        try {
            const res = await fetch('/api/instalaciones');
            this.instalaciones = await res.json();
            this.renderTabla();
        } catch(e) { console.error('Error cargando historial:', e); }
    },

    renderTabla() {
        const div = document.getElementById('instHistContent');
        const estadoColor = { 'PROGRAMADA': '#3b82f6', 'EN_CAMINO': '#f59e0b', 'EN_CURSO': '#f59e0b', 'COMPLETADA': '#22c55e', 'CON_NOVEDADES': '#ef4444', 'CANCELADA': '#94a3b8' };
        const estadoIcon = { 'PROGRAMADA': '📅', 'EN_CAMINO': '🚗', 'EN_CURSO': '⚙', 'COMPLETADA': '✓', 'CON_NOVEDADES': '⚠', 'CANCELADA': '✕' };
        let html = `
            <div class="card">
                <div class="card-header" style="justify-content:space-between">
                    <h3 style="margin:0">Todas las Instalaciones (${this.instalaciones.length})</h3>
                    <div style="display:flex;gap:8px">
                        <input type="text" id="iHistSearch" placeholder="Buscar cliente, direccion..." oninput="App.modules.inst_historial.filtrar()" class="form-control" style="width:250px;font-size:13px">
                        <select id="iHistEstado" onchange="App.modules.inst_historial.filtrar()" class="form-control" style="width:140px;font-size:13px">
                            <option value="todos">Todos</option>
                            <option value="PROGRAMADA">Programadas</option>
                            <option value="EN_CAMINO">En Camino</option>
                            <option value="EN_CURSO">En Curso</option>
                            <option value="COMPLETADA">Completadas</option>
                            <option value="CON_NOVEDADES">Novedades</option>
                            <option value="CANCELADA">Canceladas</option>
                        </select>
                    </div>
                </div>
                <div class="card-body" style="padding:0;overflow-x:auto">
                    <table style="width:100%;font-size:13px">
                        <thead><tr style="border-bottom:2px solid var(--border)">
                            <th style="padding:10px 12px;text-align:left">Fecha</th>
                            <th style="padding:10px 12px;text-align:left">Cliente</th>
                            <th style="padding:10px 12px;text-align:left">Descripcion</th>
                            <th style="padding:10px 12px;text-align:left">Direccion</th>
                            <th style="padding:10px 12px;text-align:left">Tecnico</th>
                            <th style="padding:10px 12px;text-align:center">Estado</th>
                            <th style="padding:10px 12px;text-align:center">Accion</th>
                        </tr></thead>
                        <tbody id="iHistBody">${this.filasHtml(this.instalaciones)}</tbody>
                    </table>
                </div>
            </div>`;
        div.innerHTML = html;
    },

    filasHtml(lista) {
        const estadoColor = { 'PROGRAMADA': '#3b82f6', 'EN_CAMINO': '#f59e0b', 'EN_CURSO': '#f59e0b', 'COMPLETADA': '#22c55e', 'CON_NOVEDADES': '#ef4444', 'CANCELADA': '#94a3b8' };
        const estadoIcon = { 'PROGRAMADA': '📅', 'EN_CAMINO': '🚗', 'EN_CURSO': '⚙', 'COMPLETADA': '✓', 'CON_NOVEDADES': '⚠', 'CANCELADA': '✕' };
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const perm = user.permisos || [];
        const puedeEliminar = perm.includes('instalaciones.eliminar') || perm.includes('usuarios');
        if (lista.length === 0) return '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-light)">No hay instalaciones</td></tr>';
        return lista.map(inst => {
            const color = estadoColor[inst.estado] || '#3b82f6';
            const icon = estadoIcon[inst.estado] || '📅';
            const fecha = inst.fecha_programada ? inst.fecha_programada.substring(0, 10) : '-';
            return `<tr style="border-bottom:1px solid var(--border)">
                <td style="padding:10px 12px"><strong>${fecha}</strong> ${inst.hora_programada || ''}</td>
                <td style="padding:10px 12px">${escapeHtml(inst.cliente)}</td>
                <td style="padding:10px 12px;font-size:12px;color:var(--text-light)">${escapeHtml(inst.descripcion || '-')}</td>
                <td style="padding:10px 12px;font-size:12px;color:var(--text-light)">${escapeHtml(inst.direccion)}</td>
                <td style="padding:10px 12px">${escapeHtml(inst.tecnico || '-')}</td>
                <td style="padding:10px 12px;text-align:center"><span style="background:${color};color:#fff;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:600">${icon} ${inst.estado}</span></td>
                <td style="padding:10px 12px;text-align:center;white-space:nowrap">
                    <button class="btn btn-sm btn-outline" onclick="App.modules.inst_detalle.abrir(${inst.id})">Ver</button>
                    ${puedeEliminar ? `<button class="btn btn-sm btn-outline" style="margin-left:4px;color:#ef4444;border-color:#ef4444" onclick="App.modules.inst_historial.eliminar(${inst.id})">🗑️</button>` : ''}
                </td>
            </tr>`;
        }).join('');
    },

    filtrar() {
        const search = (document.getElementById('iHistSearch')?.value || '').toLowerCase();
        const estado = document.getElementById('iHistEstado')?.value || 'todos';
        let filtered = this.instalaciones;
        if (search) filtered = filtered.filter(i =>
            (i.cliente || '').toLowerCase().includes(search) ||
            (i.direccion || '').toLowerCase().includes(search) ||
            (i.tecnico || '').toLowerCase().includes(search)
        );
        if (estado !== 'todos') filtered = filtered.filter(i => i.estado === estado);
        document.getElementById('iHistBody').innerHTML = this.filasHtml(filtered);
    },

    async eliminar(id) {
        if (!confirm('Eliminar esta instalacion y todo su historial? Esta accion no se puede deshacer.')) return;
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        try {
            await fetch(`/api/instalaciones/${id}`, {
                method: 'DELETE',
                headers: { 'X-User-Email': user.email || '' }
            });
            App.showAlert('Instalacion eliminada');
            await this.render();
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    }
});
