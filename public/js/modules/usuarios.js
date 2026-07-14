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
                        <button onclick="App.modules.usuarios.showForm()" class="btn btn-success">+ Nuevo Usuario</button>
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
                <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:24px;width:90%;max-width:480px;max-height:85vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.2)">
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
                    <td><strong>${u.nombre}</strong></td>
                    <td style="font-size:13px">${u.email}</td>
                    <td><span class="badge" style="background:${u.rol==='admin'?'rgba(168,85,247,0.15)':'rgba(100,116,139,0.1)'};color:${u.rol==='admin'?'#a855f7':'var(--text-light)'}">${u.rol}</span></td>
                    <td>${permisos || '<span style="color:var(--text-light);font-size:12px">Sin permisos</span>'}</td>
                    <td><span class="badge" style="background:${u.activo!==false?'rgba(34,197,94,0.15)':'rgba(239,68,68,0.15)'};color:${u.activo!==false?'var(--success)':'var(--danger)'}">${u.activo!==false?'Activo':'Inactivo'}</span></td>
                    <td>
                        <button onclick="App.modules.usuarios.showForm(${u.id})" class="btn btn-sm" style="padding:4px 10px;font-size:11px;background:var(--border);color:var(--text)">Editar</button>
                        ${u.rol !== 'admin' ? `<button onclick="App.modules.usuarios.remove(${u.id})" class="btn btn-sm" style="padding:4px 10px;font-size:11px;background:rgba(239,68,68,0.1);color:var(--danger)">Eliminar</button>` : ''}
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
        document.getElementById('uModalTitle').textContent = id ? 'Editar Usuario' : 'Nuevo Usuario';
        document.getElementById('uModalError').style.display = 'none';
        document.getElementById('uModalBody').innerHTML = `
            <div style="margin-bottom:12px"><label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">Nombre</label>
                <input id="fUNombre" type="text" class="input" value="${user.nombre}"></div>
            <div style="margin-bottom:12px"><label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">Email</label>
                <input id="fUEmail" type="email" class="input" value="${user.email}"></div>
            <div style="margin-bottom:12px"><label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">${id ? 'Nueva contrasena (dejar vacio para no cambiar)' : 'Contrasena'}</label>
                <input id="fUPassword" type="password" class="input" ${id ? '' : 'required'}></div>
            <div style="margin-bottom:12px"><label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">Rol</label>
                <select id="fURol" class="input">
                    <option value="usuario" ${user.rol==='usuario'?'selected':''}>Usuario</option>
                    <option value="admin" ${user.rol==='admin'?'selected':''}>Administrador</option>
                </select>
            </div>
            <div style="margin-bottom:4px"><label style="display:block;font-size:13px;font-weight:600;margin-bottom:8px">Modulos permitidos</label>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
                    <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer"><input type="checkbox" class="uPermCheck" value="sigma" ${up.includes('sigma')?'checked':''}> Mantencion (SIGMA)</label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer"><input type="checkbox" class="uPermCheck" value="inventario" ${up.includes('inventario')?'checked':''}> Inventario</label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer"><input type="checkbox" class="uPermCheck" value="turnos" ${up.includes('turnos')?'checked':''}> Turnos QR</label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer"><input type="checkbox" class="uPermCheck" value="pedidos" ${up.includes('pedidos')?'checked':''}> Pedidos</label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer"><input type="checkbox" class="uPermCheck" value="pedidos.autorizar" ${up.includes('pedidos.autorizar')?'checked':''}> Autorizar Pedidos</label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer"><input type="checkbox" class="uPermCheck" value="usuarios" ${up.includes('usuarios')?'checked':''}> Administrar Usuarios</label>
                </div>
            </div>
        `;
        document.getElementById('uModalBtn').textContent = id ? 'Actualizar' : 'Crear';
        document.getElementById('uModalOverlay').style.display = 'flex';
    },

    closeModal() { document.getElementById('uModalOverlay').style.display = 'none'; },

    async save() {
        const id = this.editingId;
        const data = {
            nombre: document.getElementById('fUNombre').value.trim(),
            email: document.getElementById('fUEmail').value.trim(),
            rol: document.getElementById('fURol').value,
            permisos: Array.from(document.querySelectorAll('.uPermCheck:checked')).map(c => c.value)
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
