App.registerModule('inst_historial', {
    instalaciones: [],
    _ready: false,

    async render() {
        const el = document.getElementById('page-inst_historial');
        el.innerHTML = '<style>'
            + '@keyframes ihFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}'
            + '.ih-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}'
            + '.ih-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important}'
            + '.ih-row{transition:background 0.1s}'
            + '.ih-row:hover{background:#f8fafc!important}'
            + '#iHistSearch::placeholder{color:rgba(255,255,255,0.6)}'
            + '.ih-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-bottom:24px;max-width:100%}'
            + '.ih-stats .ih-card{height:55px;display:flex;align-items:center;gap:10px}'
            + '.ih-filters{display:flex;align-items:center;gap:10px;flex-wrap:wrap;max-width:100%}'
            + '.ih-filters input,.ih-filters select{flex:1;min-width:120px}'
            + '.ih-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%}'
            + '.ih-table-wrap table{min-width:900px;width:100%}'
            + '@media(max-width:768px){'
            + '.ih-stats{grid-template-columns:1fr;gap:8px}'
            + '.ih-stats .ih-card{height:auto;min-height:45px}'
            + '.ih-filters{flex-direction:column;gap:8px}'
            + '.ih-filters input,.ih-filters select{width:100%;min-width:100%}'
            + '.ih-table-wrap{overflow-x:auto}'
            + '.ih-table-wrap table{min-width:800px}'
            + '}'
            + '</style>'

            + '<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:8px 16px;margin-bottom:20px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3);max-width:100%;box-sizing:border-box">'
            + '<div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;max-width:100%"><div style="min-width:0"><h2 style="margin:0;font-size:15px;font-weight:800;color:white;letter-spacing:-0.5px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-3px;margin-right:6px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Historial de Instalaciones</h2>'
            + '<p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Listado completo de todas las instalaciones</p></div>'
            + '<div class="ih-filters">'
            + '<div style="position:relative;flex:1;min-width:120px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="2" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);pointer-events:none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
            + '<input type="text" id="iHistSearch" placeholder="Buscar cliente, direccion..." oninput="App.modules.inst_historial.filtrar()" style="font-size:13px;padding:10px 14px 10px 38px;border:none;border-radius:10px;color:white;background:rgba(255,255,255,0.15);backdrop-filter:blur(8px);outline:none;width:100%;transition:all 0.2s" onfocus="this.style.background=\'rgba(255,255,255,0.25)\'" onblur="this.style.background=\'rgba(255,255,255,0.15)\'"></div>'
            + '<select id="iHistTipo" onchange="App.modules.inst_historial.filtrar()" style="font-size:12px;padding:10px 12px;border:none;border-radius:10px;color:white;background:rgba(255,255,255,0.15);backdrop-filter:blur(8px);cursor:pointer;outline:none;transition:all 0.2s;flex:1;min-width:120px" onfocus="this.style.background=\'rgba(255,255,255,0.25)\'" onblur="this.style.background=\'rgba(255,255,255,0.15)\'">'
            + '<option value="todos" selected style="color:#1e293b;background:white">Todos los tipos</option><option value="VISITA_TECNICA" style="color:#1e293b;background:white">Visita Tecnica</option><option value="INSTALACION" style="color:#1e293b;background:white">Instalacion</option><option value="POST_VENTA" style="color:#1e293b;background:white">Post-Venta</option></select>'
            + '<select id="iHistEstado" onchange="App.modules.inst_historial.filtrar()" style="font-size:12px;padding:10px 12px;border:none;border-radius:10px;color:white;background:rgba(255,255,255,0.15);backdrop-filter:blur(8px);cursor:pointer;outline:none;transition:all 0.2s;flex:1;min-width:120px" onfocus="this.style.background=\'rgba(255,255,255,0.25)\'" onblur="this.style.background=\'rgba(255,255,255,0.15)\'">'
            + '<option value="todos" selected style="color:#1e293b;background:white">Todos los estados</option><option value="PROGRAMADA" style="color:#1e293b;background:white">Programadas</option><option value="EN_CAMINO" style="color:#1e293b;background:white">En Camino</option><option value="EN_CURSO" style="color:#1e293b;background:white">En Curso</option><option value="COMPLETADA" style="color:#1e293b;background:white">Completadas</option><option value="CON_NOVEDADES" style="color:#1e293b;background:white">Novedades</option><option value="CANCELADA" style="color:#1e293b;background:white">Canceladas</option></select>'
            + '</div></div></div>'

            + '<div id="instHistStats" class="ih-stats"></div>'
            + '<div id="instHistContent"></div>';
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
        document.getElementById('instHistStats').innerHTML = ''
            + '<div class="ih-card" style="background:white;border:1px solid #e2e8f0;border-left:4px solid #64748b;border-radius:10px;padding:8px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:ihFadeUp 0.5s ease 0ms both;display:flex;align-items:center;gap:8px;box-sizing:border-box">'
            + '<div style="width:30px;height:30px;border-radius:6px;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></div>'
            + '<div style="min-width:0"><div style="font-size:18px;font-weight:800;color:#1e293b;line-height:1">' + total + '</div><div style="font-size:9px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Total</div></div></div>'

            + '<div class="ih-card" style="background:white;border:1px solid #e2e8f0;border-left:4px solid #3b82f6;border-radius:10px;padding:8px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:ihFadeUp 0.5s ease 60ms both;display:flex;align-items:center;gap:8px;box-sizing:border-box">'
            + '<div style="width:30px;height:30px;border-radius:6px;background:linear-gradient(135deg,#eff6ff,#bfdbfe);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>'
            + '<div style="min-width:0"><div style="font-size:18px;font-weight:800;color:#3b82f6;line-height:1">' + prog + '</div><div style="font-size:9px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Programadas</div></div></div>'

            + '<div class="ih-card" style="background:white;border:1px solid #e2e8f0;border-left:4px solid #f59e0b;border-radius:10px;padding:8px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:ihFadeUp 0.5s ease 120ms both;display:flex;align-items:center;gap:8px;box-sizing:border-box">'
            + '<div style="width:30px;height:30px;border-radius:6px;background:linear-gradient(135deg,#fef3c7,#fde68a);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></div>'
            + '<div style="min-width:0"><div style="font-size:18px;font-weight:800;color:#f59e0b;line-height:1">' + curso + '</div><div style="font-size:9px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">En Curso</div></div></div>'

            + '<div class="ih-card" style="background:white;border:1px solid #e2e8f0;border-left:4px solid #22c55e;border-radius:10px;padding:8px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:ihFadeUp 0.5s ease 180ms both;display:flex;align-items:center;gap:8px;box-sizing:border-box">'
            + '<div style="width:30px;height:30px;border-radius:6px;background:linear-gradient(135deg,#f0fdf4,#bbf7d0);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>'
            + '<div style="min-width:0"><div style="font-size:18px;font-weight:800;color:#22c55e;line-height:1">' + comp + '</div><div style="font-size:9px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Completadas</div></div></div>'

            + '<div class="ih-card" style="background:white;border:1px solid #e2e8f0;border-left:4px solid #ef4444;border-radius:10px;padding:8px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:ihFadeUp 0.5s ease 240ms both;display:flex;align-items:center;gap:8px;box-sizing:border-box">'
            + '<div style="width:30px;height:30px;border-radius:6px;background:linear-gradient(135deg,#fef2f2,#fecaca);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>'
            + '<div style="min-width:0"><div style="font-size:18px;font-weight:800;color:#ef4444;line-height:1">' + nov + '</div><div style="font-size:9px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Novedades</div></div></div>';
    },

    renderTabla() {
        const div = document.getElementById('instHistContent');
        const html = '<div class="ih-card" style="background:white;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);max-width:100%;box-sizing:border-box">'
            + '<div style="padding:16px 24px;border-bottom:1px solid #f1f5f9">'
            + '<h3 style="margin:0;font-size:15px;font-weight:700;color:#1e293b"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" style="vertical-align:-3px;margin-right:6px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>Todas las Instalaciones (' + this.instalaciones.length + ')</h3>'
            + '</div>'
            + '<div class="ih-table-wrap">'
            + '<table style="width:100%;border-collapse:collapse;font-size:13px">'
            + '<thead><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">'
            + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Fecha</th>'
            + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Tipo</th>'
            + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Cliente</th>'
            + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Descripcion</th>'
            + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Direccion</th>'
            + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Tecnico</th>'
            + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Vendedor</th>'
            + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Orden</th>'
            + '<th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Estado</th>'
            + '<th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Accion</th>'
            + '</tr></thead><tbody id="iHistBody">' + this.filasHtml(this.instalaciones) + '</tbody></table></div></div>';
        div.innerHTML = html;
    },

    filasHtml(lista) {
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const perm = user.permisos || [];
        const puedeEliminar = perm.includes('instalaciones.eliminar') || perm.includes('usuarios');
        if (lista.length === 0) return '<tr><td colspan="10" style="text-align:center;padding:40px;color:#94a3b8;font-size:13px"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" style="display:block;margin:0 auto 8px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>No hay instalaciones que mostrar</td></tr>';
        return lista.map(inst => {
            const badge = this.badgeHtml(inst.estado);
            const fecha = inst.fecha_programada ? inst.fecha_programada.substring(0, 10) : '-';
            const hora = inst.hora_programada || '';
            return '<tr class="ih-row" style="border-bottom:1px solid #f1f5f9">'
                + '<td style="padding:10px 14px"><span style="font-weight:600;color:#1e293b;font-family:\'JetBrains Mono\',monospace;font-size:12px">' + fecha + '</span>' + (hora ? ' <span style="color:#94a3b8;font-size:12px">' + hora + '</span>' : '') + '</td>'
                + '<td style="padding:10px 14px"><span style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;background:#f1f5f9;color:#475569">' + escapeHtml((inst.tipo || 'INSTALACION').replace('_',' ')) + '</span></td>'
                + '<td style="padding:10px 14px;font-weight:600;color:#1e293b">' + escapeHtml(inst.cliente) + '</td>'
                + '<td style="padding:10px 14px;font-size:12px;color:#64748b;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(inst.descripcion || '-') + '</td>'
                + '<td style="padding:10px 14px;font-size:12px;color:#64748b;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(inst.direccion) + '</td>'
                + '<td style="padding:10px 14px;font-size:13px;color:#1e293b">' + escapeHtml(inst.tecnico || '-') + '</td>'
                + '<td style="padding:10px 14px;font-size:13px;color:#1e293b">' + escapeHtml(inst.vendedor || '-') + '</td>'
                + '<td style="padding:10px 14px;font-size:12px;font-family:\'JetBrains Mono\',monospace;color:#64748b">' + escapeHtml(inst.numero_orden || '-') + '</td>'
                + '<td style="padding:10px 14px;text-align:center">' + badge + '</td>'
                + '<td style="padding:10px 14px;text-align:center;white-space:nowrap">'
                + '<button onclick="App.modules.inst_detalle.abrir(' + inst.id + ')" title="Ver detalle" class="btn btn-sm btn-info"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>';
                + (puedeEliminar ? '<button onclick="App.modules.inst_historial.eliminar(' + inst.id + ')" title="Eliminar" class="btn btn-sm btn-danger" style="margin-left:4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' : '')
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
