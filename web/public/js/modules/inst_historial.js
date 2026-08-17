App.registerModule('inst_historial', {
    instalaciones: [],
    _ready: false,

    async render() {
        const el = document.getElementById('page-inst_historial');
        el.innerHTML = `<style>
            @keyframes ihFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
            .ih-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}
            .ih-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important}
            .ih-row{transition:background 0.1s}
            .ih-row:hover{background:#f8fafc!important}
            #iHistSearch::placeholder{color:rgba(255,255,255,0.6)}
            .ih-page{width:100%;max-width:100%;overflow-x:hidden;box-sizing:border-box}
            .ih-hero{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:16px;margin-bottom:20px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3);width:100%;max-width:100%;box-sizing:border-box}
            .ih-hero-top{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;width:100%;max-width:100%;box-sizing:border-box}
            .ih-filters{display:flex;align-items:center;gap:8px;flex-wrap:wrap;width:100%;max-width:100%;box-sizing:border-box}
            .ih-filters>div,.ih-filters>select{flex:1;min-width:0;max-width:100%}
            .ih-filters input,.ih-filters select{width:100%;max-width:100%;box-sizing:border-box}
            .ih-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px;width:100%;max-width:100%;box-sizing:border-box}
            .ih-table-card{background:white;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);width:100%;max-width:100%;box-sizing:border-box}
            .ih-scroll{width:100%;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;box-sizing:border-box}
            .ih-scroll table{border-collapse:collapse;font-size:13px;min-width:800px;width:100%}
            @media(max-width:768px){
                .ih-hero{border-radius:12px;padding:12px;margin-bottom:16px}
                .ih-hero-top{flex-direction:column;align-items:stretch;gap:8px}
                .ih-filters{flex-direction:column;gap:8px}
                .ih-filters>div,.ih-filters>select{width:100%;max-width:100%}
                .ih-filters input,.ih-filters select{font-size:14px;padding:12px}
                .ih-stats{grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:16px}
                .ih-scroll{display:none}
                .ih-cards-mobile{display:block!important}
            }
        </style>

        <div class="ih-page">
            <div class="ih-hero">
                <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
                <div class="ih-hero-top">
                    <div style="min-width:0">
                        <h2 style="margin:0;font-size:15px;font-weight:800;color:white;letter-spacing:-0.5px">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-3px;margin-right:6px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            Historial de Instalaciones
                        </h2>
                        <p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Listado completo de todas las instalaciones</p>
                    </div>
                    <div class="ih-filters">
                        <div style="position:relative">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="2" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);pointer-events:none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" id="iHistSearch" placeholder="Buscar cliente, direccion..." oninput="App.modules.inst_historial.filtrar()" style="font-size:13px;padding:10px 14px 10px 38px;border:none;border-radius:10px;color:white;background:rgba(255,255,255,0.15);backdrop-filter:blur(8px);outline:none;width:100%;box-sizing:border-box" onfocus="this.style.background='rgba(255,255,255,0.25)'" onblur="this.style.background='rgba(255,255,255,0.15)'">
                        </div>
                        <select id="iHistTipo" onchange="App.modules.inst_historial.filtrar()" style="font-size:12px;padding:10px 12px;border:none;border-radius:10px;color:white;background:rgba(255,255,255,0.15);backdrop-filter:blur(8px);cursor:pointer;outline:none;box-sizing:border-box" onfocus="this.style.background='rgba(255,255,255,0.25)'" onblur="this.style.background='rgba(255,255,255,0.15)'">
                            <option value="todos" selected style="color:#1e293b;background:white">Todos los tipos</option>
                            <option value="VISITA_TECNICA" style="color:#1e293b;background:white">Visita Tecnica</option>
                            <option value="INSTALACION" style="color:#1e293b;background:white">Instalacion</option>
                            <option value="POST_VENTA" style="color:#1e293b;background:white">Post-Venta</option>
                        </select>
                        <select id="iHistEstado" onchange="App.modules.inst_historial.filtrar()" style="font-size:12px;padding:10px 12px;border:none;border-radius:10px;color:white;background:rgba(255,255,255,0.15);backdrop-filter:blur(8px);cursor:pointer;outline:none;box-sizing:border-box" onfocus="this.style.background='rgba(255,255,255,0.25)'" onblur="this.style.background='rgba(255,255,255,0.15)'">
                            <option value="todos" selected style="color:#1e293b;background:white">Todos los estados</option>
                            <option value="PROGRAMADA" style="color:#1e293b;background:white">Programadas</option>
                            <option value="EN_CAMINO" style="color:#1e293b;background:white">En Camino</option>
                            <option value="EN_CURSO" style="color:#1e293b;background:white">En Curso</option>
                            <option value="COMPLETADA" style="color:#1e293b;background:white">Completadas</option>
                            <option value="CON_NOVEDADES" style="color:#1e293b;background:white">Novedades</option>
                            <option value="CANCELADA" style="color:#1e293b;background:white">Canceladas</option>
                        </select>
                    </div>
                </div>
            </div>
            <div id="instHistStats" class="ih-stats"></div>
            <div id="instHistContent"></div>
        </div>`;
        await this.loadData();
    },

    async loadData() {
        try {
            const hdrs = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const res = await fetch('/api/instalaciones', { headers: hdrs });
            const data = await res.json();
            this.instalaciones = Array.isArray(data) ? data : [];
            this.renderStats();
            this.renderTabla();
            this._ready = true;
        } catch(e) { console.error('Error cargando historial:', e); this.instalaciones = []; }
    },

    renderStats() {
        const total = this.instalaciones.length;
        const prog = this.instalaciones.filter(i => i.estado === 'PROGRAMADA').length;
        const curso = this.instalaciones.filter(i => i.estado === 'EN_CURSO' || i.estado === 'EN_CAMINO').length;
        const comp = this.instalaciones.filter(i => i.estado === 'COMPLETADA').length;
        const nov = this.instalaciones.filter(i => i.estado === 'CON_NOVEDADES' || i.estado === 'CANCELADA').length;
        document.getElementById('instHistStats').innerHTML =
            '<div class="m-stat-card stat-blue"><div class="m-stat-value">' + total + '</div><div class="m-stat-label">Total</div></div>'
            + '<div class="m-stat-card stat-info"><div class="m-stat-value">' + prog + '</div><div class="m-stat-label">Programadas</div></div>'
            + '<div class="m-stat-card stat-amber"><div class="m-stat-value">' + curso + '</div><div class="m-stat-label">En Curso</div></div>'
            + '<div class="m-stat-card stat-green"><div class="m-stat-value">' + comp + '</div><div class="m-stat-label">Completadas</div></div>'
            + '<div class="m-stat-card stat-red"><div class="m-stat-value">' + nov + '</div><div class="m-stat-label">Novedades</div></div>';
    },

    renderTabla() {
        const div = document.getElementById('instHistContent');
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const perm = user.permisos || [];
        const puedeEliminar = perm.includes('instalaciones.eliminar') || perm.includes('usuarios');
        
        // Cards para móvil
        let cardsHtml = '';
        if (this.instalaciones.length === 0) {
            cardsHtml = '<div style="text-align:center;padding:40px;color:#94a3b8;font-size:13px">No hay instalaciones que mostrar</div>';
        } else {
            cardsHtml = this.instalaciones.map(inst => {
                const badge = this.badgeHtml(inst.estado);
                const fecha = inst.fecha_programada ? inst.fecha_programada.substring(0, 10) : '-';
                const hora = inst.hora_programada || '';
                const colorEstado = this.estadoColor(inst.estado);
                return `<div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,0.04);border-left:4px solid ${colorEstado};width:100%;box-sizing:border-box">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                        <span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600;color:#1e293b">${fecha}${hora ? ' ' + hora : ''}</span>
                        ${badge}
                    </div>
                    <div style="font-weight:700;color:#0f172a;font-size:14px;margin-bottom:4px">${escapeHtml(inst.cliente)}</div>
                    <div style="font-size:12px;color:#475569;margin-bottom:4px">${escapeHtml((inst.tipo || 'INSTALACION').replace('_',' '))}</div>
                    ${inst.direccion ? '<div style="font-size:11px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:6px">' + escapeHtml(inst.direccion) + '</div>' : ''}
                    ${inst.tecnico ? '<div style="font-size:11px;color:#64748b">Tecnico: ' + escapeHtml(inst.tecnico) + '</div>' : ''}
                    <div style="display:flex;gap:6px;margin-top:8px;justify-content:flex-end">
                        <button onclick="App.modules.inst_detalle.abrir(${inst.id})" class="btn btn-sm btn-info">Ver</button>
                        ${puedeEliminar ? '<button onclick="App.modules.inst_historial.eliminar(' + inst.id + ')" class="btn btn-sm btn-danger">Eliminar</button>' : ''}
                    </div>
                </div>`;
            }).join('');
        }

        // Tabla para desktop
        let tablaHtml = '';
        if (this.instalaciones.length === 0) {
            tablaHtml = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#94a3b8;font-size:13px">No hay instalaciones que mostrar</td></tr>';
        } else {
            tablaHtml = this.instalaciones.map(inst => {
                const badge = this.badgeHtml(inst.estado);
                const fecha = inst.fecha_programada ? inst.fecha_programada.substring(0, 10) : '-';
                const hora = inst.hora_programada || '';
                return '<tr class="ih-row" style="border-bottom:1px solid #f1f5f9">'
                    + '<td style="padding:10px 14px"><span style="font-weight:600;color:#1e293b;font-family:\'JetBrains Mono\',monospace;font-size:12px">' + fecha + '</span>' + (hora ? ' <span style="color:#94a3b8;font-size:12px">' + hora + '</span>' : '') + '</td>'
                    + '<td style="padding:10px 14px"><span style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;background:#f1f5f9;color:#475569">' + escapeHtml((inst.tipo || 'INSTALACION').replace('_',' ')) + '</span></td>'
                    + '<td style="padding:10px 14px;font-weight:600;color:#1e293b;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(inst.cliente) + '</td>'
                    + '<td style="padding:10px 14px;font-size:12px;color:#64748b;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(inst.direccion) + '</td>'
                    + '<td style="padding:10px 14px;font-size:13px;color:#1e293b">' + escapeHtml(inst.tecnico || '-') + '</td>'
                    + '<td style="padding:10px 14px;text-align:center">' + badge + '</td>'
                    + '<td style="padding:10px 14px;text-align:center;white-space:nowrap">'
                    + '<button onclick="App.modules.inst_detalle.abrir(' + inst.id + ')" title="Ver detalle" class="btn btn-sm btn-info"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>'
                    + (puedeEliminar ? ' <button onclick="App.modules.inst_historial.eliminar(' + inst.id + ')" title="Eliminar" class="btn btn-sm btn-danger"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' : '')
                    + '</td></tr>';
            }).join('');
        }

        div.innerHTML = `<div class="ih-table-card">
            <div style="padding:16px 24px;border-bottom:1px solid #f1f5f9">
                <h3 style="margin:0;font-size:15px;font-weight:700;color:#1e293b">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" style="vertical-align:-3px;margin-right:6px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    Todas las Instalaciones (${this.instalaciones.length})
                </h3>
            </div>
            <div class="ih-cards-mobile" style="display:none;padding:12px">${cardsHtml}</div>
            <div class="ih-scroll">
                <table>
                    <thead><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">
                        <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Fecha</th>
                        <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Tipo</th>
                        <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Cliente</th>
                        <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Direccion</th>
                        <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Tecnico</th>
                        <th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Estado</th>
                        <th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Accion</th>
                    </tr></thead>
                    <tbody id="iHistBody">${tablaHtml}</tbody>
                </table>
            </div>
        </div>`;
    },

    estadoColor(estado) {
        const map = { 'PROGRAMADA': '#3b82f6', 'EN_CAMINO': '#f59e0b', 'EN_CURSO': '#ea580c', 'COMPLETADA': '#22c55e', 'CON_NOVEDADES': '#dc2626', 'CANCELADA': '#94a3b8' };
        return map[estado] || '#3b82f6';
    },

    filasHtml(lista) {
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const perm = user.permisos || [];
        const puedeEliminar = perm.includes('instalaciones.eliminar') || perm.includes('usuarios');
        if (lista.length === 0) return '<tr><td colspan="7" style="text-align:center;padding:40px;color:#94a3b8;font-size:13px">No hay instalaciones que mostrar</td></tr>';
        return lista.map(inst => {
            const badge = this.badgeHtml(inst.estado);
            const fecha = inst.fecha_programada ? inst.fecha_programada.substring(0, 10) : '-';
            const hora = inst.hora_programada || '';
            return '<tr class="ih-row" style="border-bottom:1px solid #f1f5f9">'
                + '<td style="padding:10px 14px"><span style="font-weight:600;color:#1e293b;font-family:\'JetBrains Mono\',monospace;font-size:12px">' + fecha + '</span>' + (hora ? ' <span style="color:#94a3b8;font-size:12px">' + hora + '</span>' : '') + '</td>'
                + '<td style="padding:10px 14px"><span style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;background:#f1f5f9;color:#475569">' + escapeHtml((inst.tipo || 'INSTALACION').replace('_',' ')) + '</span></td>'
                + '<td style="padding:10px 14px;font-weight:600;color:#1e293b;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(inst.cliente) + '</td>'
                + '<td style="padding:10px 14px;font-size:12px;color:#64748b;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(inst.direccion) + '</td>'
                + '<td style="padding:10px 14px;font-size:13px;color:#1e293b">' + escapeHtml(inst.tecnico || '-') + '</td>'
                + '<td style="padding:10px 14px;text-align:center">' + badge + '</td>'
                + '<td style="padding:10px 14px;text-align:center;white-space:nowrap">'
                + '<button onclick="App.modules.inst_detalle.abrir(' + inst.id + ')" title="Ver detalle" class="btn btn-sm btn-info"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>'
                + (puedeEliminar ? ' <button onclick="App.modules.inst_historial.eliminar(' + inst.id + ')" title="Eliminar" class="btn btn-sm btn-danger"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' : '')
                + '</td></tr>';
        }).join('');
    },

    badgeHtml(estado) {
        const map = {
            'PROGRAMADA': { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', label: 'PROGRAMADA' },
            'EN_CAMINO': { bg: '#fefce8', color: '#ca8a04', border: '#fde68a', label: 'EN CAMINO' },
            'EN_CURSO': { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa', label: 'EN CURSO' },
            'COMPLETADA': { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', label: 'COMPLETADA' },
            'CON_NOVEDADES': { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', label: 'CON NOVEDADES' },
            'CANCELADA': { bg: '#f8fafc', color: '#94a3b8', border: '#e2e8f0', label: 'CANCELADA' }
        };
        const s = map[estado] || map['PROGRAMADA'];
        return '<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;background:' + s.bg + ';color:' + s.color + ';border:1px solid ' + s.border + '">' + s.label + '</span>';
    },

    filtrar() {
        if (!this._ready) return;
        const searchEl = document.getElementById('iHistSearch');
        const estadoEl = document.getElementById('iHistEstado');
        const tipoEl = document.getElementById('iHistTipo');
        if (!searchEl || !estadoEl || !tipoEl) return;
        const search = searchEl.value.toLowerCase();
        const estado = estadoEl.value;
        const tipo = tipoEl.value;
        let filtered = this.instalaciones;
        if (search) filtered = filtered.filter(i =>
            (i.cliente || '').toLowerCase().includes(search) ||
            (i.direccion || '').toLowerCase().includes(search) ||
            (i.tecnico || '').toLowerCase().includes(search) ||
            (i.vendedor || '').toLowerCase().includes(search) ||
            (i.numero_orden || '').toLowerCase().includes(search)
        );
        if (estado !== 'todos') filtered = filtered.filter(i => i.estado === estado);
        if (tipo !== 'todos') filtered = filtered.filter(i => (i.tipo || 'INSTALACION') === tipo);
        document.getElementById('iHistBody').innerHTML = this.filasHtml(filtered);
    },

    async eliminar(id) {
        if (!confirm('Eliminar esta instalacion y todo su historial? Esta accion no se puede deshacer.')) return;
        try {
            const hdrs = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            await fetch('/api/instalaciones/' + id, { method: 'DELETE', headers: hdrs });
            App.showAlert('Instalacion eliminada');
            await this.render();
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    }
});
