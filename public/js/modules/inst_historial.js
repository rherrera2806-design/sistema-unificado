App.registerModule('inst_historial', {
    instalaciones: [],

    async render() {
        const el = document.getElementById('page-inst_historial');
        el.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">'
            + '<div><h2 style="margin:0;font-size:22px;font-weight:700;color:#1e293b">Historial de Instalaciones</h2>'
            + '<p style="margin:4px 0 0;font-size:13px;color:#64748b">Listado completo de todas las instalaciones</p></div></div>'
            + '<div id="instHistStats" style="display:grid;grid-template-columns:repeat(5,1fr);gap:16px;margin-bottom:24px"></div>'
            + '<div id="instHistContent"></div>';
        await this.loadData();
    },

    async loadData() {
        try {
            const res = await fetch('/api/instalaciones');
            this.instalaciones = await res.json();
            this.renderStats();
            this.renderTabla();
        } catch(e) { console.error('Error cargando historial:', e); }
    },

    renderStats() {
        const total = this.instalaciones.length;
        const prog = this.instalaciones.filter(i => i.estado === 'PROGRAMADA').length;
        const curso = this.instalaciones.filter(i => i.estado === 'EN_CURSO' || i.estado === 'EN_CAMINO').length;
        const comp = this.instalaciones.filter(i => i.estado === 'COMPLETADA').length;
        const nov = this.instalaciones.filter(i => i.estado === 'CON_NOVEDADES' || i.estado === 'CANCELADA').length;
        document.getElementById('instHistStats').innerHTML =
            '<div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:20px;border-left:4px solid #64748b">'
            + '<div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Total</div>'
            + '<div style="font-size:28px;font-weight:800;color:#1e293b;font-family:\'JetBrains Mono\',monospace">' + total + '</div></div>'
            + '<div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:20px;border-left:4px solid #3b82f6">'
            + '<div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Programadas</div>'
            + '<div style="font-size:28px;font-weight:800;color:#3b82f6;font-family:\'JetBrains Mono\',monospace">' + prog + '</div></div>'
            + '<div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:20px;border-left:4px solid #f59e0b">'
            + '<div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">En Curso</div>'
            + '<div style="font-size:28px;font-weight:800;color:#f59e0b;font-family:\'JetBrains Mono\',monospace">' + curso + '</div></div>'
            + '<div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:20px;border-left:4px solid #22c55e">'
            + '<div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Completadas</div>'
            + '<div style="font-size:28px;font-weight:800;color:#22c55e;font-family:\'JetBrains Mono\',monospace">' + comp + '</div></div>'
            + '<div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:20px;border-left:4px solid #ef4444">'
            + '<div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Novedades/Cancel</div>'
            + '<div style="font-size:28px;font-weight:800;color:#ef4444;font-family:\'JetBrains Mono\',monospace">' + nov + '</div></div>';
    },

    renderTabla() {
        const div = document.getElementById('instHistContent');
        const html = '<div style="background:white;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;padding:20px 24px;border-bottom:1px solid #e2e8f0">'
            + '<h3 style="margin:0;font-size:15px;font-weight:700;color:#1e293b">Todas las Instalaciones (' + this.instalaciones.length + ')</h3>'
            + '<div style="display:flex;gap:8px">'
            + '<input type="text" id="iHistSearch" placeholder="Buscar cliente, direccion..." oninput="App.modules.inst_historial.filtrar()" style="font-size:13px;padding:8px 14px;border:1px solid #e2e8f0;border-radius:8px;color:#1e293b;background:white;width:220px;box-sizing:border-box;outline:none;transition:border 0.15s" onfocus="this.style.borderColor=\'#3b82f6\'" onblur="this.style.borderColor=\'#e2e8f0\'">'
            + '<select id="iHistTipo" onchange="App.modules.inst_historial.filtrar()" style="font-size:13px;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;color:#1e293b;background:white;cursor:pointer;outline:none">'
            + '<option value="todos">Todos los tipos</option><option value="VISITA_TECNICA">Visita Tecnica</option><option value="INSTALACION">Instalacion</option><option value="POST_VENTA">Post-Venta</option></select>'
            + '<select id="iHistEstado" onchange="App.modules.inst_historial.filtrar()" style="font-size:13px;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;color:#1e293b;background:white;cursor:pointer;outline:none">'
            + '<option value="todos">Todos los estados</option><option value="PROGRAMADA">Programadas</option><option value="EN_CAMINO">En Camino</option><option value="EN_CURSO">En Curso</option><option value="COMPLETADA">Completadas</option><option value="CON_NOVEDADES">Novedades</option><option value="CANCELADA">Canceladas</option></select>'
            + '</div></div>'
            + '<div style="overflow-x:auto">'
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
        if (lista.length === 0) return '<tr><td colspan="10" style="text-align:center;padding:40px;color:#94a3b8;font-size:13px">No hay instalaciones que mostrar</td></tr>';
        return lista.map(inst => {
            const badge = this.badgeHtml(inst.estado);
            const fecha = inst.fecha_programada ? inst.fecha_programada.substring(0, 10) : '-';
            const hora = inst.hora_programada || '';
            return '<tr style="border-bottom:1px solid #f1f5f9;transition:background 0.1s" onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'white\'">'
                + '<td style="padding:10px 14px"><span style="font-weight:600;color:#1e293b">' + fecha + '</span>' + (hora ? ' <span style="color:#94a3b8;font-size:12px">' + hora + '</span>' : '') + '</td>'
                + '<td style="padding:10px 14px"><span style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;background:#f1f5f9;color:#475569">' + escapeHtml((inst.tipo || 'INSTALACION').replace('_',' ')) + '</span></td>'
                + '<td style="padding:10px 14px;font-weight:600;color:#1e293b">' + escapeHtml(inst.cliente) + '</td>'
                + '<td style="padding:10px 14px;font-size:12px;color:#64748b;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(inst.descripcion || '-') + '</td>'
                + '<td style="padding:10px 14px;font-size:12px;color:#64748b;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(inst.direccion) + '</td>'
                + '<td style="padding:10px 14px;font-size:13px;color:#1e293b">' + escapeHtml(inst.tecnico || '-') + '</td>'
                + '<td style="padding:10px 14px;font-size:13px;color:#1e293b">' + escapeHtml(inst.vendedor || '-') + '</td>'
                + '<td style="padding:10px 14px;font-size:12px;font-family:\'JetBrains Mono\',monospace;color:#64748b">' + escapeHtml(inst.numero_orden || '-') + '</td>'
                + '<td style="padding:10px 14px;text-align:center">' + badge + '</td>'
                + '<td style="padding:10px 14px;text-align:center;white-space:nowrap">'
                + '<button onclick="App.modules.inst_detalle.abrir(' + inst.id + ')" style="background:white;color:#3b82f6;border:1px solid #bfdbfe;padding:5px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.15s" onmouseover="this.style.background=\'#eff6ff\'" onmouseout="this.style.background=\'white\'">Ver</button>';
                + (puedeEliminar ? '<button onclick="App.modules.inst_historial.eliminar(' + inst.id + ')" style="background:white;color:#dc2626;border:1px solid #fecaca;padding:5px 10px;border-radius:6px;font-size:12px;cursor:pointer;margin-left:4px;transition:all 0.15s" onmouseover="this.style.background=\'#fef2f2\'" onmouseout="this.style.background=\'white\'">&#10005;</button>' : '')
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
        const search = (document.getElementById('iHistSearch')?.value || '').toLowerCase();
        const estado = document.getElementById('iHistEstado')?.value || 'todos';
        const tipo = document.getElementById('iHistTipo')?.value || 'todos';
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
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        try {
            await fetch('/api/instalaciones/' + id, {
                method: 'DELETE',
                headers: { 'X-User-Email': user.email || '' }
            });
            App.showAlert('Instalacion eliminada');
            await this.render();
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    }
});
