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
            + '<div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center"><div><h2 style="margin:0;font-size:24px;font-weight:800;color:white;letter-spacing:-0.5px"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-4px;margin-right:8px"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Usuarios</h2>'
            + '<p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.7)">Gestionar usuarios y permisos del sistema</p></div>'
            + '<div style="display:flex;gap:8px">'
            + '<button onclick="App.modules.usuarios.showForm()" style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:linear-gradient(135deg,#22c55e,#16a34a);color:white;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(34,197,94,0.3);transition:all 0.2s" onmouseover="this.style.transform=\'translateY(-1px)\'" onmouseout="this.style.transform=\'\'"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo Usuario</button>'
            + '<button onclick="window.open(\'/api/admin/usuarios/export\',\'_blank\')" style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:rgba(255,255,255,0.15);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.25);border-radius:10px;color:white;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.2s" onmouseover="this.style.background=\'rgba(255,255,255,0.25)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.15)\'"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Exportar TXT</button>'
            + '</div></div></div>'

            + '<div style="background:white;border-radius:14px;padding:24px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:usFadeUp 0.5s ease both">'
            + '<div style="overflow-x:auto"><table class="us-table" style="width:100%;font-size:13px;border-collapse:collapse"><thead><tr>'
            + '<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">Nombre</th>'
            + '<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">Email</th>'
            + '<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">Rol</th>'
            + '<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">Permisos</th>'
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

    async loadUsers() {
        try {
            const res = await fetch('/api/admin/usuarios');
            const users = await res.json();
            const tbody = document.getElementById('uTableBody');
            if (!tbody) return;
            tbody.innerHTML = users.map(u => {
                const permisos = (u.permisos || []).map(p => '<span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:600;background:#eff6ff;color:#3b82f6;margin:2px">' + p + '</span>').join('');
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
                    + '<td style="padding:12px">' + (permisos || '<span style="color:#94a3b8;font-size:12px">Sin permisos</span>') + '</td>'
                    + '<td style="padding:12px">' + estadoBadge + '</td>'
                    + '<td style="padding:12px;white-space:nowrap">'
                    + '<div style="display:flex;gap:6px;align-items:center">'
                    + '<button onclick="App.modules.usuarios.showForm(' + u.id + ')" style="padding:6px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;color:#475569;transition:all 0.2s;display:inline-flex;align-items:center;gap:4px" onmouseover="this.style.background=\'#eff6ff\';this.style.borderColor=\'#3b82f6\';this.style.color=\'#3b82f6\'" onmouseout="this.style.background=\'#f8fafc\';this.style.borderColor=\'#e2e8f0\';this.style.color=\'#475569\'"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar</button>'
                    + (u.rol !== 'admin' ? '<button onclick="App.modules.usuarios.remove(' + u.id + ')" style="padding:6px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;color:#ef4444;transition:all 0.2s;display:inline-flex;align-items:center;gap:4px" onmouseover="this.style.background=\'#fee2e2\'" onmouseout="this.style.background=\'#fef2f2\'"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Eliminar</button>' : '')
                    + '</div></td></tr>';
            }).join('');
        } catch(e) { console.error(e); }
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
            { key: 'mantencion', label: 'MANTENCION', items: [
                { key: 'dashboard', label: 'Dashboard' },
                { key: 'machineTypes', label: 'Tipos de Area' },
                { key: 'machines', label: 'Maquinas' },
                { key: 'components', label: 'Componentes' },
                { key: 'preventive', label: 'Preventivo' },
                { key: 'corrective', label: 'Correctivo' },
                { key: 'calendar', label: 'Calendario' },
                { key: 'notas', label: 'Notas' },
                { key: 'reports', label: 'Reportes' },
                { key: 'history', label: 'Historial' },
                { key: 'bitacora', label: 'Bitacora' }
            ]},
            { key: 'inventario', label: 'INVENTARIO', items: [
                { key: 'inv_inventario', label: 'Inventario' },
                { key: 'inv_movimientos', label: 'Movimientos' },
                { key: 'inv_historial', label: 'Historial Inventario' },
                { key: 'inv_catalogos', label: 'Catalogos' }
            ]},
            { key: 'atencion', label: 'ATENCION', items: [
                { key: 'turnos_recepcion', label: 'Recepcion y Control' },
                { key: 'turnos_bodega', label: 'Verificación Bodega' },
                { key: 'turnos_almacen', label: 'Almacén' },
                { key: 'turnos_facturar', label: 'Por Facturar' },
                { key: 'turnos_qr', label: 'QR Clientes' },
                { key: 'turnos_reporte', label: 'Reporte' },
                { key: 'turnos_eliminar', label: 'Eliminar' }
            ]},
            { key: 'ventas', label: 'VENTAS', items: [
                { key: 'pedidos', label: 'Pedidos / Ordenes' }
            ]},
            { key: 'produccion', label: 'PRODUCCION', items: [
                { key: 'prod_ordenes', label: 'Produccion' },
                { key: 'prod_planificacion', label: 'Planificacion' },
                { key: 'prod_notas', label: 'Mis Pendientes' }
            ]},
            { key: 'instalaciones', label: 'INSTALACIONES', items: [
                { key: 'instalaciones', label: 'Instalaciones' },
                { key: 'inst_detalle', label: 'Detalle' },
                { key: 'inst_historial', label: 'Historial' },
                { key: 'instalaciones.nueva', label: 'Nueva' },
                { key: 'instalaciones.eliminar', label: 'Eliminar' }
            ]},
            { key: 'administracion', label: 'ADMINISTRACION', items: [
                { key: 'usuarios', label: 'Usuarios' }
            ]}
        ];

        let permTreeHtml = '';
        SECTIONS.forEach(sec => {
            const allChecked = sec.items.every(it => up.includes(it.key));
            const someChecked = sec.items.some(it => up.includes(it.key));
            permTreeHtml += '<div style="margin-bottom:10px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">';
            permTreeHtml += '<div onclick="App.modules.usuarios.toggleSection(\'' + sec.key + '\')" style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:#f8fafc;cursor:pointer;user-select:none;transition:background 0.15s" onmouseover="this.style.background=\'#f1f5f9\'" onmouseout="this.style.background=\'#f8fafc\'">';
            permTreeHtml += '<input type="checkbox" class="perm-sec-check" data-section="' + sec.key + '" ' + (allChecked ? 'checked' : '') + ' ' + (someChecked && !allChecked ? 'style="accent-color:#3b82f6"' : '') + ' onclick="event.stopPropagation();App.modules.usuarios.toggleSection(\'' + sec.key + '\')">';
            permTreeHtml += '<span style="font-size:12px;font-weight:700;color:#334155;letter-spacing:0.5px">' + sec.label + '</span>';
            permTreeHtml += '</div><div class="perm-items" id="permItems_' + sec.key + '" style="padding:8px 14px 10px 28px;display:flex;flex-wrap:wrap;gap:4px 14px">';
            sec.items.forEach(it => {
                permTreeHtml += '<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;color:#475569"><input type="checkbox" class="perm-item-check" data-section="' + sec.key + '" data-item="' + it.key + '" ' + (up.includes(it.key) ? 'checked' : '') + ' style="accent-color:#3b82f6"> ' + it.label + '</label>';
            });
            permTreeHtml += '</div></div>';
        });
        permTreeHtml += '<div style="margin-top:8px;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc"><label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;color:#475569"><input type="checkbox" class="uPermCheck" value="pedidos.autorizar" ' + (up.includes('pedidos.autorizar') ? 'checked' : '') + ' style="accent-color:#3b82f6"> Autorizar Pedidos</label></div>';

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

    toggleSection(sectionKey) {
        const secCheck = document.querySelector(`.perm-sec-check[data-section="${sectionKey}"]`);
        const itemChecks = document.querySelectorAll(`.perm-item-check[data-section="${sectionKey}"]`);
        const newState = !secCheck.checked;
        secCheck.checked = newState;
        itemChecks.forEach(cb => cb.checked = newState);
    },

    closeModal() { document.getElementById('uModalOverlay').style.display = 'none'; },

    async save() {
        const id = this.editingId;
        const itemPerms = Array.from(document.querySelectorAll('.perm-item-check:checked')).map(c => c.dataset.item);
        const extraPerms = Array.from(document.querySelectorAll('.uPermCheck:checked')).map(c => c.value);
        const data = {
            nombre: document.getElementById('fUNombre').value.trim(),
            email: document.getElementById('fUEmail').value.trim(),
            rol: document.getElementById('fURol').value,
            permisos: [...new Set([...itemPerms, ...extraPerms])]
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
