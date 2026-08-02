App.registerModule('usuarios', {
    async render() {
        const el = document.getElementById('page-usuarios');
        el.innerHTML = '<style>'
            + '@keyframes usFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}'
            + '.us-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}'
            + '.us-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important;transform:translateY(-2px)}'
            + '.us-table tbody tr{transition:background 0.15s;border-bottom:1px solid #f1f5f9}'
            + '.us-table tbody tr:hover{background:#f8fafc!important}'
            + '</style>'

            + '<div style="max-width:1100px;margin:0 auto;padding:0 16px">'
            + '<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:28px 32px;margin-bottom:24px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">'
            + '<div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px"><div><h2 style="margin:0;font-size:24px;font-weight:800;color:white;letter-spacing:-0.5px"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-4px;margin-right:8px"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Usuarios</h2>'
            + '<p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.7)">Gestionar usuarios y permisos del sistema</p></div>'
            + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
            + '<div style="position:relative"><svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" id="uSearch" placeholder="Buscar nombre o email..." oninput="App.modules.usuarios.filterUsers()" style="padding:9px 14px 9px 32px;border:1px solid rgba(255,255,255,0.25);border-radius:8px;background:rgba(255,255,255,0.15);backdrop-filter:blur(10px);color:white;font-size:12px;outline:none;width:180px" onfocus="this.style.borderColor=\'rgba(255,255,255,0.5)\'" onblur="this.style.borderColor=\'rgba(255,255,255,0.25)\'"></div>'
            + '<button onclick="App.modules.usuarios.showForm()" style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:linear-gradient(135deg,#22c55e,#16a34a);color:white;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(34,197,94,0.3);transition:all 0.2s" onmouseover="this.style.transform=\'translateY(-1px)\'" onmouseout="this.style.transform=\'\'"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo</button>'
            + '<button onclick="window.open(\'/api/admin/usuarios/export\',\'_blank\')" style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:rgba(255,255,255,0.15);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.25);border-radius:10px;color:white;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.2s" onmouseover="this.style.background=\'rgba(255,255,255,0.25)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.15)\'"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Exportar</button>'
            + '</div></div></div>'

            + '<div style="background:white;border-radius:14px;padding:24px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:usFadeUp 0.5s ease both">'
            + '<div style="overflow-x:auto"><table class="us-table" style="width:100%;font-size:13px;border-collapse:collapse"><thead><tr>'
            + '<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">Nombre</th>'
            + '<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">Email</th>'
            + '<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">Rol</th>'
            + '<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0;min-width:320px">Permisos</th>'
            + '<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">Estado</th>'
            + '<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">Acciones</th>'
            + '</tr></thead><tbody id="uTableBody"><tr><td colspan="6" style="text-align:center;padding:40px;color:#94a3b8"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" style="margin-bottom:8px"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg><div>Cargando...</div></td></tr></tbody></table></div></div></div>'

            + '<div id="uModalOverlay" style="display:none;position:fixed;inset:0;z-index:40;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px)" onclick="if(event.target===this)App.modules.usuarios.closeModal()">'
            + '<div onclick="event.stopPropagation()" style="background:white;border-radius:16px;width:90%;max-width:520px;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.2)">'
            + '<div style="padding:24px 28px;border-bottom:1px solid #e2e8f0"><div style="display:flex;align-items:center;justify-content:space-between"><h3 id="uModalTitle" style="margin:0;font-size:18px;font-weight:700;color:#0f172a"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" style="vertical-align:-3px;margin-right:6px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Nuevo Usuario</h3>'
            + '<button onclick="App.modules.usuarios.closeModal()" style="background:none;border:none;font-size:24px;cursor:pointer;color:#94a3b8;line-height:1">&times;</button></div></div>'
            + '<div style="padding:24px 28px" id="uModalBody"></div>'
            + '<div id="uModalError" style="color:#ef4444;font-size:12px;padding:0 28px;display:none"></div>'
            + '<div style="padding:16px 28px 24px;display:flex;gap:8px;justify-content:flex-end">'
            + '<button onclick="App.modules.usuarios.closeModal()" style="padding:10px 20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;color:#64748b">Cancelar</button>'
            + '<button onclick="App.modules.usuarios.save()" id="uModalBtn" style="padding:10px 24px;background:linear-gradient(135deg,#3b82f6,#2563eb);color:white;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(59,130,246,0.3)">Crear</button>'
            + '</div></div></div>';

        await this.loadUsers();
    },

    editingId: null,
    allUsers: [],

    async loadUsers() {
        try {
            const res = await fetch('/api/admin/usuarios');
            this.allUsers = await res.json();
            this.renderUsers(this.allUsers);
        } catch(e) { console.error(e); }
    },

    filterUsers() {
        const q = (document.getElementById('uSearch')?.value || '').toLowerCase();
        if (!q) return this.renderUsers(this.allUsers);
        const filtered = this.allUsers.filter(u => u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
        this.renderUsers(filtered);
    },

    renderUsers(users) {
        const tbody = document.getElementById('uTableBody');
        if (!tbody) return;
        if (users.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:#94a3b8">Sin resultados</td></tr>'; return; }
        const MOD_SUBS = {
            asistencia: [{id:'asistencia',l:'ASIST'}],
            atencion: [{id:'turnos_recepcion',l:'Recep'},{id:'turnos_bodega',l:'Bodega'},{id:'turnos_almacen',l:'Almacen'},{id:'turnos_facturar',l:'Facturar'},{id:'turnos_qr',l:'QR'},{id:'turnos_reporte',l:'Reporte'}],
            instalaciones: [{id:'instalaciones',l:'Inst'},{id:'inst_historial',l:'Historial'}],
            inventario: [{id:'inv_inventario',l:'Inv'},{id:'inv_movimientos',l:'Mov'},{id:'inv_historial',l:'Historial'},{id:'inv_catalogos',l:'Catalogos'}],
            mantencion: [{id:'dashboard',l:'Dash'},{id:'machineTypes',l:'Areas'},{id:'machines',l:'Maq'},{id:'components',l:'Comp'},{id:'preventive',l:'Prev'},{id:'corrective',l:'Correc'},{id:'calendar',l:'Cal'},{id:'notas',l:'Notas'},{id:'reports',l:'Rep'},{id:'history',l:'Hist'},{id:'bitacora',l:'Bitac'}],
            pedidos: [{id:'pedidos',l:'Pedidos'}],
            produccion: [{id:'prod_ordenes',l:'Prod'},{id:'prod_planificacion',l:'Plan'},{id:'prod_reportes',l:'Reportes'},{id:'prod_notas',l:'Pend'},{id:'prod_config',l:'Config'},{id:'taller',l:'Taller'}]
        };
        function permCell(up) {
            let h = '<div style="display:flex;flex-wrap:wrap;gap:3px">';
            Object.keys(MOD_SUBS).forEach(mod => {
                MOD_SUBS[mod].forEach(sub => {
                    const hasVer = up.includes(sub.id);
                    const hasEd = up.includes(sub.id+'.editar');
                    const hasEl = up.includes(sub.id+'.eliminar');
                    if (!hasVer && !hasEd && !hasEl) return;
                    const dots = [];
                    if (hasVer) dots.push('<span title="Ver" style="width:6px;height:6px;border-radius:50%;background:#22c55e;display:inline-block"></span>');
                    if (hasEd) dots.push('<span title="Editar" style="width:6px;height:6px;border-radius:50%;background:#3b82f6;display:inline-block"></span>');
                    if (hasEl) dots.push('<span title="Eliminar" style="width:6px;height:6px;border-radius:50%;background:#ef4444;display:inline-block"></span>');
                    h += '<span title="' + sub.l + '" style="display:inline-flex;align-items:center;gap:2px;padding:2px 5px;border-radius:5px;background:#f1f5f9;border:1px solid #e2e8f0;font-size:8px;font-weight:700;color:#475569">' + sub.l + ' ' + dots.join('') + '</span>';
                });
            });
            h += '</div>';
            return h;
        }
        tbody.innerHTML = users.map(u => {
                const up = Array.isArray(u.permisos) ? u.permisos : [];
                const rolBadge = u.rol === 'admin'
                    ? '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:linear-gradient(135deg,#ede9fe,#ddd6fe);color:#7c3aed">admin</span>'
                    : '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;background:#f1f5f9;color:#64748b">usuario</span>';
                const estadoBadge = u.activo !== false
                    ? '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;background:#dcfce7;color:#16a34a"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> Activo</span>'
                    : '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;background:#fee2e2;color:#ef4444"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Inactivo</span>';
                return '<tr>'
                    + '<td style="padding:12px"><strong style="color:#0f172a">' + escapeHtml(u.nombre) + '</strong></td>'
                    + '<td style="padding:12px;font-size:13px;color:#64748b">' + escapeHtml(u.email) + '</td>'
                    + '<td style="padding:12px">' + rolBadge + '</td>'
                    + '<td style="padding:12px">' + permCell(up) + '</td>'
                    + '<td style="padding:12px">' + estadoBadge + '</td>'
                    + '<td style="padding:12px;white-space:nowrap">'
                    + '<div style="display:flex;gap:6px;align-items:center">'
                    + '<button onclick="App.modules.usuarios.showForm(' + u.id + ')" style="padding:6px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;color:#475569;transition:all 0.2s;display:inline-flex;align-items:center;gap:4px" onmouseover="this.style.background=\'#eff6ff\';this.style.borderColor=\'#3b82f6\';this.style.color=\'#3b82f6\'" onmouseout="this.style.background=\'#f8fafc\';this.style.borderColor=\'#e2e8f0\';this.style.color=\'#475569\'"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar</button>'
                    + (u.rol !== 'admin' ? '<button onclick="App.modules.usuarios.remove(' + u.id + ')" style="padding:6px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;color:#ef4444;transition:all 0.2s;display:inline-flex;align-items:center;gap:4px" onmouseover="this.style.background=\'#fee2e2\'" onmouseout="this.style.background=\'#fef2f2\'"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Eliminar</button>' : '')
                    + '</div></td></tr>';
            }).join('');
    },

    async showForm(id) {
        this.editingId = id || null;
        let user = { nombre: '', email: '', password: '', rol: 'usuario', permisos: [] };
        if (id) {
            try {
                const res = await fetch('/api/admin/usuarios');
                const all = await res.json();
                user = all.find(u => u.id === id) || user;
            } catch(e) {}
        }
        const up = Array.isArray(user.permisos) ? user.permisos : [];

        const SECTIONS = [
            { key: 'asistencia', label: 'ASISTENCIA', subs: [
                { id: 'asistencia', label: 'Control de Asistencia' }
            ]},
            { key: 'atencion', label: 'ATENCION', subs: [
                { id: 'turnos_recepcion', label: 'Recepcion y Control' },
                { id: 'turnos_bodega', label: 'Verificación Bodega' },
                { id: 'turnos_almacen', label: 'Almacén' },
                { id: 'turnos_facturar', label: 'Por Facturar' },
                { id: 'turnos_qr', label: 'QR Clientes' },
                { id: 'turnos_reporte', label: 'Reporte' }
            ]},
            { key: 'instalaciones', label: 'INSTALACIONES', subs: [
                { id: 'instalaciones', label: 'Instalaciones' },
                { id: 'inst_historial', label: 'Historial' }
            ]},
            { key: 'inventario', label: 'INVENTARIO', subs: [
                { id: 'inv_inventario', label: 'Inventario' },
                { id: 'inv_movimientos', label: 'Movimientos' },
                { id: 'inv_historial', label: 'Historial Inventario' },
                { id: 'inv_catalogos', label: 'Catalogos' }
            ]},
            { key: 'mantencion', label: 'MANTENCION', subs: [
                { id: 'dashboard', label: 'Dashboard' },
                { id: 'machineTypes', label: 'Tipos de Area' },
                { id: 'machines', label: 'Maquinas' },
                { id: 'components', label: 'Componentes' },
                { id: 'preventive', label: 'Preventivo' },
                { id: 'corrective', label: 'Correctivo' },
                { id: 'calendar', label: 'Calendario' },
                { id: 'notas', label: 'Notas' },
                { id: 'reports', label: 'Reportes' },
                { id: 'history', label: 'Historial' },
                { id: 'bitacora', label: 'Bitacora' }
            ]},
            { key: 'pedidos', label: 'PEDIDOS', subs: [
                { id: 'pedidos', label: 'Pedidos / Ordenes' }
            ]},
            { key: 'produccion', label: 'PRODUCCION', subs: [
                { id: 'prod_ordenes', label: 'Produccion' },
                { id: 'prod_planificacion', label: 'Planificacion' },
                { id: 'prod_reportes', label: 'Reporte Fechas' },
                { id: 'prod_notas', label: 'Mis Pendientes' },
                { id: 'prod_config', label: 'Configuracion' },
                { id: 'taller', label: 'Taller' }
            ]}
        ];

        let permTreeHtml = '';
        SECTIONS.forEach(sec => {
            const allSubKeys = sec.subs.map(s => s.id);
            const allVer = allSubKeys.every(k => up.includes(k));
            const someVer = allSubKeys.some(k => up.includes(k));
            const allEd = allSubKeys.every(k => up.includes(k + '.editar'));
            const allEl = allSubKeys.every(k => up.includes(k + '.eliminar'));
            permTreeHtml += '<div style="margin-bottom:10px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">';
            permTreeHtml += '<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:#f8fafc">';
            permTreeHtml += '<span style="font-size:12px;font-weight:700;color:#334155;letter-spacing:0.5px">' + sec.label + '</span>';
            permTreeHtml += '<label style="margin-left:auto;display:flex;align-items:center;gap:4px;font-size:10px;color:#64748b;cursor:pointer"><input type="checkbox" ' + (allVer ? 'checked' : '') + ' style="accent-color:#22c55e" onchange="App.modules.usuarios.toggleSubPerm(\'' + sec.key + '\',\'ver\',this.checked)"> Todo Ver</label>';
            permTreeHtml += '<label style="display:flex;align-items:center;gap:4px;font-size:10px;color:#64748b;cursor:pointer"><input type="checkbox" ' + (allEd ? 'checked' : '') + ' style="accent-color:#3b82f6" onchange="App.modules.usuarios.toggleSubPerm(\'' + sec.key + '\',\'editar\',this.checked)"> Todo Editar</label>';
            permTreeHtml += '<label style="display:flex;align-items:center;gap:4px;font-size:10px;color:#64748b;cursor:pointer"><input type="checkbox" ' + (allEl ? 'checked' : '') + ' style="accent-color:#ef4444" onchange="App.modules.usuarios.toggleSubPerm(\'' + sec.key + '\',\'eliminar\',this.checked)"> Todo Eliminar</label>';
            permTreeHtml += '</div>';
            sec.subs.forEach(sub => {
                const hasVer = up.includes(sub.id);
                const hasEd = up.includes(sub.id + '.editar');
                const hasEl = up.includes(sub.id + '.eliminar');
                permTreeHtml += '<div style="display:flex;align-items:center;gap:10px;padding:8px 14px 8px 28px;border-top:1px solid #f1f5f9">';
                permTreeHtml += '<span style="font-size:12px;color:#475569;min-width:160px">' + sub.label + '</span>';
                permTreeHtml += '<label style="display:flex;align-items:center;gap:4px;font-size:11px;cursor:pointer;color:#475569"><input type="checkbox" class="perm-sub-check" data-section="' + sec.key + '" data-sub="' + sub.id + '" data-type="ver" ' + (hasVer ? 'checked' : '') + ' style="accent-color:#22c55e"> Ver</label>';
                permTreeHtml += '<label style="display:flex;align-items:center;gap:4px;font-size:11px;cursor:pointer;color:#475569"><input type="checkbox" class="perm-sub-check" data-section="' + sec.key + '" data-sub="' + sub.id + '" data-type="editar" ' + (hasEd ? 'checked' : '') + ' style="accent-color:#3b82f6"> Editar</label>';
                permTreeHtml += '<label style="display:flex;align-items:center;gap:4px;font-size:11px;cursor:pointer;color:#475569"><input type="checkbox" class="perm-sub-check" data-section="' + sec.key + '" data-sub="' + sub.id + '" data-type="eliminar" ' + (hasEl ? 'checked' : '') + ' style="accent-color:#ef4444"> Eliminar</label>';
                permTreeHtml += '</div>';
            });
            permTreeHtml += '</div>';
        });
        permTreeHtml += '</div>';

        document.getElementById('uModalTitle').innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" style="vertical-align:-3px;margin-right:6px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' + (id ? 'Editar Usuario' : 'Nuevo Usuario');
        document.getElementById('uModalError').style.display = 'none';
        document.getElementById('uModalBody').innerHTML = ''
            + '<div style="margin-bottom:14px"><label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:#334155">Nombre</label>'
            + '<input id="fUNombre" type="text" autocomplete="off" value="' + user.nombre + '" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;transition:border-color 0.2s" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'"></div>'
            + '<div style="margin-bottom:14px"><label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:#334155">Email</label>'
            + '<input id="fUEmail" type="email" autocomplete="off" value="' + user.email + '" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;transition:border-color 0.2s" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'"></div>'
            + '<div style="margin-bottom:14px"><label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:#334155">' + (id ? 'Nueva contrasena (dejar vacio para no cambiar)' : 'Contrasena') + '</label>'
            + '<input id="fUPassword" type="password" autocomplete="new-password" ' + (id ? '' : 'required') + ' style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;transition:border-color 0.2s" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'"></div>'
            + '<div style="margin-bottom:14px"><label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:#334155">Rol</label>'
            + '<select id="fURol" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;background:white">'
            + '<option value="usuario" ' + (user.rol === 'usuario' ? 'selected' : '') + '>Usuario</option>'
            + '<option value="admin" ' + (user.rol === 'admin' ? 'selected' : '') + '>Administrador</option></select></div>'
            + '<div style="margin-bottom:4px"><label style="display:block;font-size:13px;font-weight:600;margin-bottom:8px;color:#334155">Permisos del sistema</label>'
            + permTreeHtml
            + '</div>';
        document.getElementById('uModalBtn').textContent = id ? 'Actualizar' : 'Crear';
        document.getElementById('uModalOverlay').style.display = 'flex';
    },

    toggleSubPerm(sectionKey, type, checked) {
        document.querySelectorAll(`.perm-sub-check[data-section="${sectionKey}"][data-type="${type}"]`).forEach(cb => cb.checked = checked);
    },

    closeModal() { document.getElementById('uModalOverlay').style.display = 'none'; },

    async save() {
        const id = this.editingId;
        const subPerms = Array.from(document.querySelectorAll('.perm-sub-check:checked')).map(c => {
            const sub = c.dataset.sub;
            const type = c.dataset.type;
            if (type === 'ver') return sub;
            return sub + '.' + type;
        });
        const data = {
            nombre: document.getElementById('fUNombre').value.trim(),
            email: document.getElementById('fUEmail').value.trim(),
            rol: document.getElementById('fURol').value,
            permisos: [...new Set(subPerms)]
        };
        const pw = document.getElementById('fUPassword').value;
        if (pw) data.password = pw;
        const err = document.getElementById('uModalError');
        if (!data.nombre || !data.email) { err.textContent = 'Nombre y email son requeridos'; err.style.display = 'block'; return; }
        if (!id && !pw) { err.textContent = 'La contrasena es requerida'; err.style.display = 'block'; return; }
        const btn = document.getElementById('uModalBtn');
        btn.disabled = true; btn.textContent = id ? 'Actualizando...' : 'Creando...';
        try {
            const url = id ? `/api/admin/usuarios/${id}` : '/api/admin/usuarios';
            const method = id ? 'PUT' : 'POST';
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            if (!res.ok) { const e = await res.json(); err.textContent = e.error || 'Error'; err.style.display = 'block'; btn.disabled = false; btn.textContent = id ? 'Actualizar' : 'Crear'; return; }
            this.closeModal();
            await this.loadUsers();
        } catch(e) { err.textContent = 'Error de conexion'; err.style.display = 'block'; }
        btn.disabled = false; btn.textContent = id ? 'Actualizar' : 'Crear';
    },

    async remove(id) {
        if (!confirm('Eliminar este usuario?')) return;
        try { await fetch(`/api/admin/usuarios/${id}`, { method: 'DELETE' }); await this.loadUsers(); } catch(e) { alert('Error'); }
    }
});
