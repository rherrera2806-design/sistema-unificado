App.registerModule('usuarios', {
    async render() {
        const el = document.getElementById('page-usuarios');
        el.innerHTML = `
            <div style="padding:16px">
                <div style="max-width:900px;margin:0 auto">
                    <div class="page-header">
                        <div>
                            <h2>Usuarios</h2>
                            <div class="subtitle">Gestionar usuarios y permisos del sistema</div>
                        </div>
                        <div style="display:flex;gap:8px">
                            <button onclick="App.modules.usuarios.showForm()" class="btn btn-success">+ Nuevo Usuario</button>
                            <button onclick="window.open('/api/admin/usuarios/export','_blank')" class="btn btn-outline">Exportar TXT</button>
                        </div>
                    </div>
                    <div class="card">
                        <div style="overflow-x:auto">
                            <table class="admin-table">
                                <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Permisos</th><th>Estado</th><th>Acciones</th></tr></thead>
                                <tbody id="uTableBody"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            <div id="uModalOverlay" style="display:none;position:fixed;inset:0;z-index:40;align-items:center;justify-content:center;background:rgba(0,0,0,0.5)" onclick="if(event.target===this)App.modules.usuarios.closeModal()">
                <div onclick="event.stopPropagation()" style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:24px;width:90%;max-width:480px;max-height:85vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.2)">
                    <h3 id="uModalTitle" style="font-size:18px;font-weight:700;margin-bottom:16px">Nuevo Usuario</h3>
                    <div id="uModalBody"></div>
                    <div id="uModalError" style="color:var(--danger);font-size:12px;margin-top:8px;display:none"></div>
                    <div style="display:flex;gap:8px;margin-top:16px">
                        <button onclick="App.modules.usuarios.closeModal()" class="btn" style="flex:1;background:var(--border);color:var(--text)">Cancelar</button>
                        <button onclick="App.modules.usuarios.save()" id="uModalBtn" class="btn btn-primary" style="flex:2">Crear</button>
                    </div>
                </div>
            </div>
        `;
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
                const permisos = (u.permisos || []).map(p => `<span class="badge" style="background:rgba(59,130,246,0.1);color:var(--info);font-size:10px">${p}</span>`).join(' ');
                return `<tr>
                    <td><strong>${escapeHtml(u.nombre)}</strong></td>
                    <td style="font-size:13px">${escapeHtml(u.email)}</td>
                    <td><span class="badge" style="background:${u.rol==='admin'?'rgba(168,85,247,0.15)':'rgba(100,116,139,0.1)'};color:${u.rol==='admin'?'#a855f7':'var(--text-light)'}">${u.rol}</span></td>
                    <td>${permisos || '<span style="color:var(--text-light);font-size:12px">Sin permisos</span>'}</td>
                    <td><span class="badge" style="background:${u.activo!==false?'rgba(34,197,94,0.15)':'rgba(239,68,68,0.15)'};color:${u.activo!==false?'var(--success)':'var(--danger)'}">${u.activo!==false?'Activo':'Inactivo'}</span></td>
                    <td style="white-space:nowrap">
                        <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-start">
                            <button onclick="App.modules.usuarios.showForm(${u.id})" class="btn btn-sm" style="padding:4px 12px;font-size:11px;background:var(--border);color:var(--text);width:100%">Editar</button>
                            ${u.rol !== 'admin' ? `<button onclick="App.modules.usuarios.remove(${u.id})" class="btn btn-sm" style="padding:4px 12px;font-size:11px;background:rgba(239,68,68,0.08);color:var(--danger);border:1px solid rgba(239,68,68,0.2);width:100%">Eliminar</button>` : ''}
                        </div>
                    </td>
                </tr>`;
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
                { key: 'turnos_bodega', label: 'Entrega de Bodega' },
                { key: 'turnos_qr', label: 'QR Clientes' }
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
            permTreeHtml += `<div class="perm-section" style="margin-bottom:10px;border:1px solid var(--border);border-radius:8px;overflow:hidden">`;
            permTreeHtml += `<div class="perm-section-header" onclick="App.modules.usuarios.toggleSection('${sec.key}')" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(59,130,246,0.05);cursor:pointer;user-select:none">`;
            permTreeHtml += `<input type="checkbox" class="perm-sec-check" data-section="${sec.key}" ${allChecked?'checked':''} ${someChecked&&!allChecked?'style="accent-color:var(--info)"':''} onclick="event.stopPropagation();App.modules.usuarios.toggleSection('${sec.key}')">`;
            permTreeHtml += `<span style="font-size:13px;font-weight:700">${sec.label}</span>`;
            permTreeHtml += `</div><div class="perm-items" id="permItems_${sec.key}" style="padding:4px 12px 8px 28px;display:flex;flex-wrap:wrap;gap:4px 12px">`;
            sec.items.forEach(it => {
                permTreeHtml += `<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer"><input type="checkbox" class="perm-item-check" data-section="${sec.key}" data-item="${it.key}" ${up.includes(it.key)?'checked':''}> ${it.label}</label>`;
            });
            permTreeHtml += `</div></div>`;
        });
        permTreeHtml += `<div style="margin-top:8px;padding:8px 12px;border:1px solid var(--border);border-radius:8px"><label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer"><input type="checkbox" class="uPermCheck" value="pedidos.autorizar" ${up.includes('pedidos.autorizar')?'checked':''}> Autorizar Pedidos</label></div>`;

        document.getElementById('uModalTitle').textContent = id ? 'Editar Usuario' : 'Nuevo Usuario';
        document.getElementById('uModalError').style.display = 'none';
        document.getElementById('uModalBody').innerHTML = `
            <div style="margin-bottom:12px"><label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">Nombre</label>
                <input id="fUNombre" type="text" class="input" autocomplete="off" value="${user.nombre}"></div>
            <div style="margin-bottom:12px"><label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">Email</label>
                <input id="fUEmail" type="email" class="input" autocomplete="off" value="${user.email}"></div>
            <div style="margin-bottom:12px"><label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">${id ? 'Nueva contrasena (dejar vacio para no cambiar)' : 'Contrasena'}</label>
                <input id="fUPassword" type="password" class="input" autocomplete="new-password" ${id ? '' : 'required'}></div>
            <div style="margin-bottom:12px"><label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">Rol</label>
                <select id="fURol" class="input">
                    <option value="usuario" ${user.rol==='usuario'?'selected':''}>Usuario</option>
                    <option value="admin" ${user.rol==='admin'?'selected':''}>Administrador</option>
                </select>
            </div>
            <div style="margin-bottom:4px"><label style="display:block;font-size:13px;font-weight:600;margin-bottom:8px">Permisos del sistema</label>
                ${permTreeHtml}
            </div>
        `;
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
