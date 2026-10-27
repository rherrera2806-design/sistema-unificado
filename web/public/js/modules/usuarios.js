// ============================================================================
// Administración → Usuarios (módulo sensible)
//   · Formulario amigable: validación clara campo a campo, generador de
//     contraseña, mostrar/ocultar, requisitos visibles, áreas con sugerencias.
//   · Al crear: credenciales con botón "Copiar" (reemplaza al export con
//     contraseñas en claro, que ya no existe).
//   · Activar / Desactivar sin borrar (conserva historial) + Eliminar con
//     confirmación en modal (sin confirm() nativo).
//   · Bitácora visible: quién hizo qué y cuándo (usuarios_audit).
//   · XSS: TODO dato del usuario pasa por escapeHtml (atributos incluidos).
//   · Errores visibles (App.showAlert + res.ok en cada fetch).
// Escala tipográfica 20/15/13/11/10 · fechas dd-mm-yyyy HH:mm · es-CL.
// ============================================================================
App.registerModule('usuarios', {
    editingId: null,
    allUsers: [],
    selectedArea: null,

    // Árbol de permisos (IDs EXACTOS que consume el backend)
    SECTIONS: [
        { key: 'asistencia', label: 'ASISTENCIA', subs: [
            { id: 'asistencia', label: 'Ver' },
            { id: 'asistencia.editar', label: 'Editar / Autorizar' }
        ]},
        { key: 'atencion', label: 'ATENCIÓN', subs: [
            { id: 'turnos_recepcion', label: 'Recepción y Control' },
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
            { id: 'inv_dashboard', label: 'Dashboard Inventario' },
            { id: 'inv_inventario', label: 'Inventario' },
            { id: 'inv_inventario.sensible', label: 'Ver Sensible (costos/CPM)' },
            { id: 'inv_movimientos', label: 'Movimientos' },
            { id: 'inv_historial', label: 'Historial Inventario' },
            { id: 'inv_consumo', label: 'Consumo por Meses' },
            { id: 'inv_autonomia', label: 'Autonomía (proyección de stock)' },
            { id: 'inv_catalogos', label: 'Catálogos (tipos de cristal / espesores)' }
        ]},
        { key: 'reclamos', label: 'RECLAMOS', subs: [
            { id: 'reclamos', label: 'Reclamos y Devoluciones' }
        ]},
        { key: 'mantencion', label: 'MANTENCIÓN', subs: [
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'machineTypes', label: 'Tipos de Área' },
            { id: 'machines', label: 'Máquinas' },
            { id: 'components', label: 'Componentes' },
            { id: 'preventive', label: 'Preventivo' },
            { id: 'corrective', label: 'Correctivo' },
            { id: 'calendar', label: 'Calendario' },
            { id: 'notas', label: 'Notas' },
            { id: 'reports', label: 'Reportes' },
            { id: 'history', label: 'Historial' },
            { id: 'bitacora', label: 'Bitácora' },
            { id: 'proveedores', label: 'Proveedores' }
        ]},
        { key: 'pedidos', label: 'PEDIDOS', subs: [
            { id: 'pedidos', label: 'Pedidos / Órdenes' }
        ]},
        { key: 'produccion', label: 'PRODUCCIÓN', subs: [
            { id: 'prod_ordenes', label: 'Producción' },
            { id: 'prod_planificacion', label: 'Planificación' },
            { id: 'prod_reportes', label: 'Prog. General' },
            { id: 'prod_prog_estacion', label: 'Programación Estación' },
            { id: 'prod_notas', label: 'Bitácora de Producción' },
            { id: 'prod_horarios', label: 'Horarios de Turno' },
            { id: 'prod_config', label: 'Configuración' },
            { id: 'taller', label: 'Taller' },
            { id: 'bodega', label: 'Bodega' }
        ]},
        { key: 'costeo', label: 'COSTEO', subs: [
            { id: 'costeo', label: 'Costeo' }
        ]}
    ],

    async render() {
        const el = document.getElementById('page-usuarios');
        el.innerHTML = this._estilos() + `
            <div class="us-hero">
                <div>
                    <h2>Usuarios</h2>
                    <p>Gestión de accesos y permisos del sistema · las contraseñas solo existen cifradas</p>
                </div>
                <div class="us-hero-actions">
                    <button class="us-btn-hero" onclick="window.open('/api/admin/usuarios/export','_blank')" title="Descargar el listado (sin contraseñas)">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Exportar
                    </button>
                    <button class="us-btn-hero" onclick="App.modules.usuarios.mostrarAuditoria()" title="Ver bitácora de cambios">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        Bitácora
                    </button>
                    <button class="us-btn-hero solid" onclick="App.modules.usuarios.showForm()">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Nuevo usuario
                    </button>
                </div>
            </div>

            <div class="us-stats" id="uStats"></div>

            <div class="us-toolbar">
                <div class="us-search">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8494a8" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" id="uSearch" placeholder="Buscar por nombre, email o área..." oninput="App.modules.usuarios.filterUsers()">
                </div>
                <span class="us-count" id="uCount"></span>
            </div>

            <div class="us-panel">
                <div class="us-table-wrap">
                    <table class="us-table">
                        <thead><tr>
                            <th>Nombre</th><th>Email</th><th>Rol</th><th>Área</th><th>Permisos</th><th>Estado</th><th class="th-acc">Acciones</th>
                        </tr></thead>
                        <tbody id="uTableBody"><tr><td colspan="7" class="us-loading">Cargando usuarios...</td></tr></tbody>
                    </table>
                </div>
                <div id="uCardsMobile" class="us-cards-mobile"></div>
            </div>

            <!-- Modal formulario -->
            <div id="uModalOverlay" class="us-overlay" onclick="if(event.target===this)App.modules.usuarios.tryCloseModal()">
                <div class="us-modal" onclick="event.stopPropagation()">
                    <div class="us-modal-head">
                        <h3 id="uModalTitle">Nuevo usuario</h3>
                        <button class="us-x" onclick="App.modules.usuarios.pedirCerrarForm()" aria-label="Cerrar">✕</button>
                    </div>
                    <div class="us-modal-body" id="uModalBody"></div>
                    <div class="us-modal-foot">
                        <button class="us-btn-ghost" onclick="App.modules.usuarios.pedirCerrarForm()">Cancelar</button>
                        <button class="us-btn-primary" id="uModalBtn" onclick="App.modules.usuarios.save()">Crear usuario</button>
                    </div>
                </div>
            </div>

            <!-- Modal confirmación -->
            <div id="uConfirmOverlay" class="us-overlay" onclick="if(event.target===this)App.modules.usuarios.closeConfirm()">
                <div class="us-modal us-modal-sm" onclick="event.stopPropagation()">
                    <div class="us-modal-head"><h3 id="uConfirmTitle">Confirmar</h3>
                        <button class="us-x" onclick="App.modules.usuarios.closeConfirm()" aria-label="Cerrar">✕</button></div>
                    <div class="us-modal-body"><p id="uConfirmText" class="us-confirm-text"></p></div>
                    <div class="us-modal-foot">
                        <button class="us-btn-ghost" onclick="App.modules.usuarios.closeConfirm()">Cancelar</button>
                        <button class="us-btn-danger" id="uConfirmBtn">Confirmar</button>
                    </div>
                </div>
            </div>

            <!-- Modal credenciales (tras crear) -->
            <div id="uCredOverlay" class="us-overlay">
                <div class="us-modal us-modal-sm" onclick="event.stopPropagation()">
                    <div class="us-modal-head"><h3>✅ Usuario creado</h3>
                        <button class="us-x" onclick="App.modules.usuarios.closeCred()" aria-label="Cerrar">✕</button></div>
                    <div class="us-modal-body">
                        <p class="us-confirm-text">Entrega estas credenciales. <strong>La contraseña no se puede volver a ver</strong> (solo se guarda cifrada).</p>
                        <div class="us-cred">
                            <div><span class="k">Email</span><span class="v" id="uCredEmail"></span></div>
                            <div><span class="k">Contraseña</span><span class="v" id="uCredPass"></span></div>
                        </div>
                        <button class="us-btn-primary" style="width:100%;margin-top:10px" onclick="App.modules.usuarios.copyCred()">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                            Copiar credenciales
                        </button>
                    </div>
                    <div class="us-modal-foot"><button class="us-btn-ghost" onclick="App.modules.usuarios.closeCred()">Cerrar</button></div>
                </div>
            </div>

            <!-- Modal bitácora -->
            <div id="uAuditOverlay" class="us-overlay" onclick="if(event.target===this)App.modules.usuarios.closeAuditoria()">
                <div class="us-modal" onclick="event.stopPropagation()">
                    <div class="us-modal-head"><h3>Bitácora de administración</h3>
                        <button class="us-x" onclick="App.modules.usuarios.closeAuditoria()" aria-label="Cerrar">✕</button></div>
                    <div class="us-modal-body" id="uAuditBody"></div>
                    <div class="us-modal-foot"><button class="us-btn-ghost" onclick="App.modules.usuarios.closeAuditoria()">Cerrar</button></div>
                </div>
            </div>`;
        await this.loadUsers();
    },

    _fecha(s) {
        if (!s) return '—';
        const d = new Date(s);
        if (isNaN(d)) return '—';
        const p = n => String(n).padStart(2, '0');
        return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
    },

    async loadUsers() {
        try {
            const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const res = await fetch('/api/admin/usuarios', { headers });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                if (res.status === 401 || res.status === 403) {
                    App.showAlert('No tienes permisos para ver usuarios o tu sesión expiró', 'danger');
                } else {
                    App.showAlert('Error al cargar usuarios: ' + (err.error || ('HTTP ' + res.status)), 'danger');
                }
                return;
            }
            this.allUsers = await res.json();
            if (!Array.isArray(this.allUsers)) this.allUsers = [];
            this.renderStats(this.allUsers);
            this.renderUsers(this.allUsers);
        } catch (e) {
            console.error(e);
            App.showAlert('Error de conexión al cargar usuarios', 'danger');
        }
    },

    renderStats(users) {
        const stats = document.getElementById('uStats');
        if (!stats) return;
        const areas = {};
        users.forEach(u => {
            const area = (u.area || '').trim() || 'Sin área';
            areas[area] = (areas[area] || 0) + 1;
        });
        const sorted = Object.entries(areas).sort((a, b) => b[1] - a[1]);
        stats.innerHTML = sorted.map(([area, count]) => {
            const sel = this.selectedArea === area;
            return `<div class="us-stat ${sel ? 'sel' : ''}" data-area="${escapeHtml(area)}" onclick="App.modules.usuarios.filterByArea(this.dataset.area)">
                <div class="v">${count}</div><div class="k">${escapeHtml(area)}</div>
            </div>`;
        }).join('');
    },

    filterByArea(area) {
        this.selectedArea = this.selectedArea === area ? null : area;
        this.renderStats(this.allUsers);
        if (!this.selectedArea) return this.renderUsers(this.allUsers);
        this.renderUsers(this.allUsers.filter(u => ((u.area || '').trim() || 'Sin área') === this.selectedArea));
    },

    filterUsers() {
        const q = (document.getElementById('uSearch')?.value || '').toLowerCase();
        let list = this.allUsers;
        if (this.selectedArea) list = list.filter(u => ((u.area || '').trim() || 'Sin área') === this.selectedArea);
        if (q) {
            list = list.filter(u =>
                (u.nombre || '').toLowerCase().includes(q)
                || (u.email || '').toLowerCase().includes(q)
                || (u.area || '').toLowerCase().includes(q));
        }
        this.renderUsers(list);
    },

    // Etiquetas compactas de permisos (sincronizadas con el árbol del formulario)
    _permBadges(up) {
        const MAPA = [];
        this.SECTIONS.forEach(sec => sec.subs.forEach(sub => MAPA.push({ id: sub.id, l: sub.label })));
        let h = '<div class="us-perms">';
        MAPA.forEach(sub => {
            const hasVer = up.includes(sub.id);
            const hasEd = up.includes(sub.id + '.editar');
            const hasEl = up.includes(sub.id + '.eliminar');
            const hasAg = up.includes(sub.id + '.agregar');
            if (!hasVer && !hasEd && !hasEl && !hasAg) return;
            const dots = [];
            if (hasVer) dots.push('<span class="dot d-v" title="Ver"></span>');
            if (hasAg) dots.push('<span class="dot d-a" title="Agregar"></span>');
            if (hasEd) dots.push('<span class="dot d-e" title="Editar"></span>');
            if (hasEl) dots.push('<span class="dot d-x" title="Eliminar"></span>');
            h += `<span class="us-perm" title="${escapeHtml(sub.l)}">${escapeHtml(sub.l)} ${dots.join('')}</span>`;
        });
        return h + '</div>';
    },

    renderUsers(users) {
        const tbody = document.getElementById('uTableBody');
        const cards = document.getElementById('uCardsMobile');
        const count = document.getElementById('uCount');
        if (count) count.textContent = '(' + users.length + ' usuario' + (users.length === 1 ? '' : 's') + ')';
        if (!tbody) return;
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="us-loading">Sin resultados</td></tr>';
            if (cards) cards.innerHTML = '<div class="us-loading">Sin resultados</div>';
            return;
        }
        tbody.innerHTML = users.map(u => {
            const rolBadge = u.rol === 'admin'
                ? '<span class="us-badge b-admin">admin</span>'
                : '<span class="us-badge b-user">usuario</span>';
            const estadoBadge = u.activo !== false
                ? '<span class="us-badge b-on">● Activo</span>'
                : '<span class="us-badge b-off">● Inactivo</span>';
            return '<tr>'
                + `<td class="c-nom">${escapeHtml(u.nombre)}</td>`
                + `<td class="c-email">${escapeHtml(u.email)}</td>`
                + `<td>${rolBadge}</td>`
                + `<td class="c-area">${u.area ? escapeHtml(u.area) : '<span class="us-none">—</span>'}</td>`
                + `<td>${this._permBadges(Array.isArray(u.permisos) ? u.permisos : [])}</td>`
                + `<td>${estadoBadge}</td>`
                + '<td class="c-acc">'
                + `<button class="us-icon-btn" title="Editar" onclick="App.modules.usuarios.showForm(${u.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>`
                + (u.activo !== false
                    ? `<button class="us-icon-btn warn" title="Desactivar" onclick="App.modules.usuarios.pedirActivo(${u.id},false)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></button>`
                    : `<button class="us-icon-btn ok" title="Activar" onclick="App.modules.usuarios.pedirActivo(${u.id},true)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></button>`)
                + `<button class="us-icon-btn danger" title="Eliminar" onclick="App.modules.usuarios.pedirEliminar(${u.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>`
                + '</td></tr>';
        }).join('');

        if (cards) {
            cards.innerHTML = users.map(u => {
                const rolBadge = u.rol === 'admin'
                    ? '<span class="us-badge b-admin">admin</span>'
                    : '<span class="us-badge b-user">usuario</span>';
                const estado = u.activo !== false
                    ? '<span class="us-badge b-on">● Activo</span>'
                    : '<span class="us-badge b-off">● Inactivo</span>';
                return '<div class="us-mcard">'
                    + '<div class="top"><strong>' + escapeHtml(u.nombre) + '</strong><div class="b">' + rolBadge + estado + '</div></div>'
                    + '<div class="meta">' + escapeHtml(u.email) + '</div>'
                    + '<div class="meta">' + (u.area ? escapeHtml(u.area) : 'Sin área') + '</div>'
                    + '<div class="acc">'
                    + `<button class="us-btn-ghost sm" onclick="App.modules.usuarios.showForm(${u.id})">Editar</button>`
                    + (u.activo !== false
                        ? `<button class="us-btn-ghost sm warn" onclick="App.modules.usuarios.pedirActivo(${u.id},false)">Desactivar</button>`
                        : `<button class="us-btn-ghost sm ok" onclick="App.modules.usuarios.pedirActivo(${u.id},true)">Activar</button>`)
                    + `<button class="us-btn-ghost sm danger" onclick="App.modules.usuarios.pedirEliminar(${u.id})">Eliminar</button>`
                    + '</div></div>';
            }).join('');
        }
    },

    // ---------------- Formulario ----------------
    showForm(id) {
        this.editingId = id || null;
        const user = id
            ? (this.allUsers.find(u => u.id === id) || { nombre: '', email: '', rol: 'usuario', area: '', permisos: [] })
            : { nombre: '', email: '', rol: 'usuario', area: '', permisos: [], activo: true };
        const up = Array.isArray(user.permisos) ? user.permisos : [];
        const areasExistentes = [...new Set(this.allUsers.map(u => (u.area || '').trim()).filter(Boolean))];

        let permTreeHtml = '';
        this.SECTIONS.forEach(sec => {
            const allSubKeys = sec.subs.map(s => s.id);
            const allVer = allSubKeys.length > 0 && allSubKeys.every(k => up.includes(k));
            const allAg = allSubKeys.length > 0 && allSubKeys.every(k => up.includes(k + '.agregar'));
            const allEd = allSubKeys.length > 0 && allSubKeys.every(k => up.includes(k + '.editar'));
            const allEl = allSubKeys.length > 0 && allSubKeys.every(k => up.includes(k + '.eliminar'));
            permTreeHtml += '<div class="us-permsec">';
            permTreeHtml += '<div class="us-permsec-head"><span class="t">' + escapeHtml(sec.label) + '</span>'
                + '<label><input type="checkbox" ' + (allVer ? 'checked' : '') + ' onchange="App.modules.usuarios.toggleSubPerm(\'' + sec.key + '\',\'ver\',this.checked)"> Ver todo</label>'
                + '<label><input type="checkbox" ' + (allAg ? 'checked' : '') + ' onchange="App.modules.usuarios.toggleSubPerm(\'' + sec.key + '\',\'agregar\',this.checked)"> Agregar todo</label>'
                + '<label><input type="checkbox" ' + (allEd ? 'checked' : '') + ' onchange="App.modules.usuarios.toggleSubPerm(\'' + sec.key + '\',\'editar\',this.checked)"> Editar todo</label>'
                + '<label><input type="checkbox" ' + (allEl ? 'checked' : '') + ' onchange="App.modules.usuarios.toggleSubPerm(\'' + sec.key + '\',\'eliminar\',this.checked)"> Eliminar todo</label>'
                + '</div>';
            sec.subs.forEach(sub => {
                permTreeHtml += '<div class="us-permrow">'
                    + '<span class="s">' + escapeHtml(sub.label) + '</span>'
                    + `<label><input type="checkbox" class="perm-sub-check" data-section="${sec.key}" data-sub="${sub.id}" data-type="ver" ${up.includes(sub.id) ? 'checked' : ''}> Ver</label>`
                    + `<label><input type="checkbox" class="perm-sub-check" data-section="${sec.key}" data-sub="${sub.id}" data-type="agregar" ${up.includes(sub.id + '.agregar') ? 'checked' : ''}> Agregar</label>`
                    + `<label><input type="checkbox" class="perm-sub-check" data-section="${sec.key}" data-sub="${sub.id}" data-type="editar" ${up.includes(sub.id + '.editar') ? 'checked' : ''}> Editar</label>`
                    + `<label><input type="checkbox" class="perm-sub-check" data-section="${sec.key}" data-sub="${sub.id}" data-type="eliminar" ${up.includes(sub.id + '.eliminar') ? 'checked' : ''}> Eliminar</label>`
                    + '</div>';
            });
            permTreeHtml += '</div>';
        });

        document.getElementById('uModalTitle').textContent = id ? 'Editar usuario' : 'Nuevo usuario';
        document.getElementById('uModalBody').innerHTML = ''
            + '<div class="us-field"><label>Nombre completo</label>'
            + `<input id="fUNombre" type="text" autocomplete="off" value="${escapeHtml(user.nombre)}" placeholder="Ej: María Pérez">`
            + '<div class="us-err" id="eUNombre"></div></div>'

            + '<div class="us-field"><label>Email</label>'
            + `<input id="fUEmail" type="email" autocomplete="off" value="${escapeHtml(user.email)}" placeholder="nombre@empresa.cl">`
            + '<div class="us-err" id="eUEmail"></div></div>'

            + '<div class="us-field"><label>' + (id ? 'Nueva contraseña' : 'Contraseña') + '</label>'
            + '<div class="us-pass-row">'
            + '<input id="fUPassword" type="password" autocomplete="new-password" placeholder="' + (id ? 'Dejar vacío para no cambiar' : 'Mínimo 6 caracteres') + '">'
            + '<button type="button" class="us-btn-ghost sm" onclick="App.modules.usuarios.togglePass()">Mostrar</button>'
            + '<button type="button" class="us-btn-ghost sm" onclick="App.modules.usuarios.generarPass()">Generar</button>'
            + '</div>'
            + '<div class="us-hint" id="hintPass">' + (id ? 'Solo se cambia si escribes una nueva.' : 'Se guarda cifrada: nadie puede volver a verla.') + '</div>'
            + '<div class="us-err" id="eUPassword"></div></div>'

            + '<div class="us-field"><label>Rol</label>'
            + '<select id="fURol">'
            + '<option value="usuario" ' + (user.rol !== 'admin' ? 'selected' : '') + '>Usuario — solo los módulos que le asignes</option>'
            + '<option value="admin" ' + (user.rol === 'admin' ? 'selected' : '') + '>Administrador — acceso total</option>'
            + '</select><div class="us-err" id="eURol"></div></div>'

            + '<div class="us-field"><label>Área</label>'
            + `<input id="fUArea" type="text" list="usAreas" autocomplete="off" value="${escapeHtml(user.area || '')}" placeholder="Ej: Mantención, Producción, Ventas...">`
            + '<datalist id="usAreas">' + areasExistentes.map(a => '<option value="' + escapeHtml(a) + '">').join('') + '</datalist>'
            + '<div class="us-hint">Aparece como filtro en el listado.</div></div>'

            + '<div class="us-field"><label>Permisos del sistema</label>'
            + '<div class="us-hint">Marca qué puede hacer. El permiso "Ver" habilita el módulo; Agregar / Editar / Eliminar son acciones sueltas.</div>'
            + '<div class="us-permtree">' + permTreeHtml + '</div></div>';

        document.getElementById('uModalBtn').textContent = id ? 'Guardar cambios' : 'Crear usuario';
        document.getElementById('uModalOverlay').style.display = 'flex';
        this._formInicial = this._capturarForm();
        setTimeout(() => document.getElementById('fUNombre')?.focus(), 60);
    },

    togglePass() {
        const inp = document.getElementById('fUPassword');
        if (!inp) return;
        inp.type = inp.type === 'password' ? 'text' : 'password';
    },

    generarPass() {
        const inp = document.getElementById('fUPassword');
        if (!inp) return;
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%';
        const arr = new Uint32Array(14);
        (window.crypto || window.msCrypto).getRandomValues(arr);
        inp.value = Array.from(arr).map(n => chars[n % chars.length]).join('');
        inp.type = 'text';
        App.showAlert('Contraseña generada: cópiala antes de guardar', 'success');
    },

    toggleSubPerm(sectionKey, type, checked) {
        document.querySelectorAll(`.perm-sub-check[data-section="${sectionKey}"][data-type="${type}"]`).forEach(cb => cb.checked = checked);
    },

    // Cierre protegido: nunca se pierde lo escrito sin avisar.
    // · Click fuera del formulario → si hay datos, NO cierra (avisa).
    // · ✕ / Cancelar → si hay datos, pregunta antes de descartar.
    _capturarForm() {
        const g = id => (document.getElementById(id) || {}).value || '';
        const perm = Array.from(document.querySelectorAll('.perm-sub-check:checked'))
            .map(c => c.dataset.sub + '.' + c.dataset.type).sort().join(',');
        return [g('fUNombre'), g('fUEmail'), g('fUPassword'), g('fURol'), g('fUArea'), perm].join('¦');
    },
    _formDirty() {
        if (!document.getElementById('uModalOverlay') || document.getElementById('uModalOverlay').style.display === 'none') return false;
        return this._capturarForm() !== this._formInicial;
    },
    tryCloseModal() {
        if (this._formDirty()) {
            App.showAlert('Tienes datos sin guardar. Usa "Cancelar" o ✕ si quieres descartarlos.', 'danger');
            return;
        }
        this.closeModal();
    },
    pedirCerrarForm() {
        if (this._formDirty()) {
            this._confirmar('Descartar cambios',
                'Tienes datos sin guardar en el formulario. <strong>Se perderán</strong> si continúas.',
                'Descartar cambios', true, () => this.closeModal());
            return;
        }
        this.closeModal();
    },
    closeModal() { document.getElementById('uModalOverlay').style.display = 'none'; },

    _fieldError(id, msg) {
        const el = document.getElementById('eU' + id);
        if (el) { el.textContent = msg || ''; el.style.display = msg ? 'block' : 'none'; }
    },

    async save() {
        const id = this.editingId;
        const nombre = document.getElementById('fUNombre').value.trim();
        const email = document.getElementById('fUEmail').value.trim();
        const pw = document.getElementById('fUPassword').value;
        const rol = document.getElementById('fURol').value;
        const area = document.getElementById('fUArea').value.trim();
        const subPerms = Array.from(document.querySelectorAll('.perm-sub-check:checked')).map(c =>
            c.dataset.type === 'ver' ? c.dataset.sub : c.dataset.sub + '.' + c.dataset.type
        );

        // Validación amigable, campo por campo
        ['Nombre', 'Email', 'Password'].forEach(f => this._fieldError(f, ''));
        let invalido = false;
        if (!nombre) { this._fieldError('Nombre', 'Escribe el nombre completo'); invalido = true; }
        if (!email) { this._fieldError('Email', 'Escribe el email'); invalido = true; }
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { this._fieldError('Email', 'El email no tiene un formato válido (ej: nombre@empresa.cl)'); invalido = true; }
        if (!id && !pw) { this._fieldError('Password', 'Escribe una contraseña (o presiona "Generar")'); invalido = true; }
        else if (pw && pw.length < 6) { this._fieldError('Password', 'La contraseña debe tener al menos 6 caracteres'); invalido = true; }
        if (invalido) return;

        const data = { nombre, email, rol, area, permisos: [...new Set(subPerms)] };
        if (pw) data.password = pw;

        const btn = document.getElementById('uModalBtn');
        btn.disabled = true; btn.textContent = id ? 'Guardando...' : 'Creando...';
        try {
            const url = id ? `/api/admin/usuarios/${id}` : '/api/admin/usuarios';
            const method = id ? 'PUT' : 'POST';
            const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const res = await fetch(url, { method, headers, body: JSON.stringify(data) });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = body.error || ('Error al guardar (HTTP ' + res.status + ')');
                // Errores conocidos → campo correspondiente
                if (/email/i.test(msg) && /registrado|válido|formato/i.test(msg)) this._fieldError('Email', msg);
                else if (/contrase/i.test(msg)) this._fieldError('Password', msg);
                else App.showAlert(msg, 'danger');
                btn.disabled = false; btn.textContent = id ? 'Guardar cambios' : 'Crear usuario';
                return;
            }
            this.closeModal();
            await this.loadUsers();
            if (!id && pw) {
                this._cred = { email, pass: pw };
                document.getElementById('uCredEmail').textContent = email;
                document.getElementById('uCredPass').textContent = pw;
                document.getElementById('uCredOverlay').style.display = 'flex';
            }
            App.showAlert(id ? 'Usuario actualizado' : 'Usuario creado', 'success');
        } catch (e) {
            App.showAlert('Error de conexión al guardar', 'danger');
        }
        btn.disabled = false; btn.textContent = id ? 'Guardar cambios' : 'Crear usuario';
    },

    // ---------------- Confirmaciones (modal, sin confirm() nativo) ----------------
    _confirmar(titulo, texto, textoBoton, esRojo, accion) {
        document.getElementById('uConfirmTitle').textContent = titulo;
        document.getElementById('uConfirmText').innerHTML = texto;
        const btn = document.getElementById('uConfirmBtn');
        btn.textContent = textoBoton;
        btn.className = esRojo ? 'us-btn-danger' : 'us-btn-primary';
        btn.onclick = () => { this.closeConfirm(); accion(); };
        document.getElementById('uConfirmOverlay').style.display = 'flex';
    },
    closeConfirm() { document.getElementById('uConfirmOverlay').style.display = 'none'; },

    _yoId() {
        try { return JSON.parse(localStorage.getItem('unified_user') || '{}').id; } catch (e) { return null; }
    },

    pedirEliminar(id) {
        const u = this.allUsers.find(x => x.id === id);
        if (!u) return;
        const esYo = this._yoId() === u.id;
        this._confirmar('Eliminar usuario',
            `Se eliminará <strong>${escapeHtml(u.nombre)}</strong> (${escapeHtml(u.email)}) de forma permanente.`
            + (esYo ? '<br><br>⚠️ <strong>Es la cuenta con la que entraste</strong>: al eliminarla se cerrará tu sesión.' : '')
            + '<br><br>Si solo quieres que no entre al sistema, es mejor <strong>desactivarlo</strong>.',
            'Eliminar definitivamente', true,
            () => this.doEliminar(id));
    },

    async doEliminar(id) {
        try {
            const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const res = await fetch(`/api/admin/usuarios/${id}`, { method: 'DELETE', headers });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) { App.showAlert(body.error || 'No se pudo eliminar', 'danger'); return; }
            if (this._yoId() === id) {
                // Se eliminó la cuenta propia: cerrar sesión y volver al login.
                if (typeof doLogout === 'function') return doLogout();
                localStorage.removeItem('unified_user');
                return location.reload();
            }
            App.showAlert('Usuario eliminado', 'success');
            await this.loadUsers();
        } catch (e) { App.showAlert('Error de conexión', 'danger'); }
    },

    pedirActivo(id, activo) {
        const u = this.allUsers.find(x => x.id === id);
        if (!u) return;
        this._confirmar(activo ? 'Activar usuario' : 'Desactivar usuario',
            activo
                ? `Se activará <strong>${escapeHtml(u.nombre)}</strong> y podrá entrar al sistema nuevamente.`
                : `Se desactivará <strong>${escapeHtml(u.nombre)}</strong>: no podrá entrar, pero se conserva su historial.`,
            activo ? 'Activar' : 'Desactivar', !activo,
            () => this.doActivo(id, activo));
    },

    async doActivo(id, activo) {
        try {
            const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const res = await fetch(`/api/admin/usuarios/${id}/activo`, { method: 'PATCH', headers, body: JSON.stringify({ activo }) });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) { App.showAlert(body.error || 'No se pudo cambiar el estado', 'danger'); return; }
            App.showAlert(activo ? 'Usuario activado' : 'Usuario desactivado', 'success');
            await this.loadUsers();
        } catch (e) { App.showAlert('Error de conexión', 'danger'); }
    },

    // ---------------- Credenciales / bitácora ----------------
    closeCred() { document.getElementById('uCredOverlay').style.display = 'none'; },
    copyCred() {
        const txt = 'Email: ' + (this._cred?.email || '') + '\nContraseña: ' + (this._cred?.pass || '');
        const done = () => App.showAlert('Credenciales copiadas', 'success');
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(txt).then(done).catch(() => window.prompt('Copia las credenciales:', txt));
        } else {
            window.prompt('Copia las credenciales:', txt);
        }
    },

    async mostrarAuditoria() {
        const body = document.getElementById('uAuditBody');
        body.innerHTML = '<div class="us-loading">Cargando bitácora...</div>';
        document.getElementById('uAuditOverlay').style.display = 'flex';
        try {
            const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const res = await fetch('/api/admin/usuarios/auditoria', { headers });
            if (!res.ok) { body.innerHTML = '<div class="us-loading">No se pudo cargar la bitácora</div>'; return; }
            const rows = await res.json();
            if (!Array.isArray(rows) || rows.length === 0) {
                body.innerHTML = '<div class="us-loading">Sin registros todavía</div>';
                return;
            }
            body.innerHTML = '<div class="us-audit">' + rows.map(r => {
                const col = r.accion === 'eliminar' ? 'danger' : (r.accion === 'crear' ? 'ok' : 'info');
                return `<div class="us-audit-row">
                    <span class="us-badge b-${col}">${escapeHtml(r.accion)}</span>
                    <span class="who">${escapeHtml(r.actor_email)} → ${escapeHtml(r.usuario_email)}</span>
                    <span class="det">${escapeHtml(r.detalle || '')}</span>
                    <span class="f">${this._fecha(r.created_at)}</span>
                </div>`;
            }).join('') + '</div>';
        } catch (e) {
            body.innerHTML = '<div class="us-loading">Error de conexión</div>';
        }
    },
    closeAuditoria() { document.getElementById('uAuditOverlay').style.display = 'none'; },

    // ---------------- Estilos (escala 20/15/13/11/10) ----------------
    _estilos() {
        return `<style>
            .us-hero{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 55%,#1e40af 100%);border-radius:16px;padding:20px 26px;display:flex;align-items:center;gap:14px;position:relative;overflow:hidden;margin-bottom:16px}
            .us-hero::after{content:'';position:absolute;left:0;right:0;bottom:0;height:1px;background:linear-gradient(90deg,transparent,rgba(147,197,253,.55),transparent)}
            .us-hero h2{color:#fff;font-size:20px;font-weight:700;margin:0;display:flex;align-items:center;gap:8px}
            .us-hero p{color:rgba(255,255,255,.62);font-size:11px;margin:4px 0 0}
            .us-hero-actions{margin-left:auto;display:flex;gap:8px}
            .us-btn-hero{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);color:#fff;cursor:pointer;font-size:11px;font-weight:600;white-space:nowrap}
            .us-btn-hero:hover{background:rgba(255,255,255,.2)}
            .us-btn-hero.solid{background:#fff;color:#1e3a5f;border-color:#fff}
            .us-btn-hero.solid:hover{background:#e8eefb}

            .us-stats{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}
            .us-stat{background:#fff;border:1px solid #e4e9f0;border-radius:12px;padding:10px 16px;cursor:pointer;transition:all .2s;min-width:96px}
            .us-stat:hover{box-shadow:0 4px 14px rgba(15,23,42,.08);transform:translateY(-1px)}
            .us-stat.sel{border-color:#1e3a5f;box-shadow:0 4px 16px rgba(15,23,42,.16)}
            .us-stat .v{font-size:20px;font-weight:700;color:#0f172a}
            .us-stat .k{font-size:10px;font-weight:600;color:#8494a8;text-transform:uppercase;letter-spacing:.6px;white-space:nowrap;max-width:130px;overflow:hidden;text-overflow:ellipsis}

            .us-toolbar{display:flex;align-items:center;gap:12px;margin-bottom:12px}
            .us-search{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #e4e9f0;border-radius:10px;padding:0 12px;flex:1;max-width:380px}
            .us-search input{border:none;outline:none;padding:10px 0;font-size:13px;width:100%;background:transparent;color:#0f172a}
            .us-count{font-size:11px;color:#8494a8;font-weight:600}

            .us-panel{background:#fff;border:1px solid #e4e9f0;border-radius:14px;overflow:hidden}
            .us-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
            .us-table{width:100%;border-collapse:collapse;min-width:900px}
            .us-table th{padding:11px 14px;text-align:left;font-size:10px;font-weight:700;color:#8494a8;text-transform:uppercase;letter-spacing:.7px;border-bottom:1px solid #e4e9f0;background:#f8fafc}
            .us-table td{padding:11px 14px;font-size:13px;border-bottom:1px solid #f1f5f9;vertical-align:top}
            .us-table tbody tr:hover{background:#f8fafc}
            .us-table .c-nom{font-weight:600;color:#0f172a}
            .us-table .c-email,.us-table .c-area{color:#475569;font-size:11px}
            .us-table .th-acc{text-align:right}
            .us-table .c-acc{text-align:right;white-space:nowrap}
            .us-loading{text-align:center;padding:34px;color:#8494a8;font-size:13px}
            .us-none{color:#cbd5e1}

            .us-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap}
            .b-admin{background:#ede9fe;color:#7c3aed}
            .b-user{background:#f1f5f9;color:#64748b}
            .b-on{background:#dcfce7;color:#15803d}
            .b-off{background:#fee2e2;color:#dc2626}
            .b-ok{background:#dcfce7;color:#15803d}
            .b-danger{background:#fee2e2;color:#dc2626}
            .b-info{background:#e0e7ff;color:#4338ca}

            .us-perms{display:flex;flex-wrap:wrap;gap:3px}
            .us-perm{display:inline-flex;align-items:center;gap:3px;padding:2px 6px;border-radius:5px;background:#f1f5f9;border:1px solid #e2e8f0;font-size:10px;font-weight:600;color:#475569}
            .us-perm .dot{width:6px;height:6px;border-radius:50%;display:inline-block}
            .d-v{background:#22c55e}.d-a{background:#f59e0b}.d-e{background:#3b82f6}.d-x{background:#ef4444}

            .us-icon-btn{width:28px;height:28px;border-radius:7px;border:1px solid #e2e8f0;background:#fff;color:#475569;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
            .us-icon-btn:hover{background:#f1f5f9}
            .us-icon-btn.warn{color:#b45309;border-color:#fde68a}.us-icon-btn.ok{color:#15803d;border-color:#bbf7d0}.us-icon-btn.danger{color:#dc2626;border-color:#fecaca}

            .us-cards-mobile{display:none}

            .us-overlay{display:none;position:fixed;inset:0;z-index:40;align-items:center;justify-content:center;background:rgba(15,23,42,.5);backdrop-filter:blur(4px)}
            .us-modal{background:#fff;border-radius:16px;width:92%;max-width:560px;max-height:86vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(15,23,42,.3)}
            .us-modal-sm{max-width:420px}
            .us-modal-head{padding:18px 24px;border-bottom:1px solid #e4e9f0;display:flex;align-items:center;justify-content:space-between}
            .us-modal-head h3{margin:0;font-size:15px;font-weight:700;color:#0f172a}
            .us-x{width:28px;height:28px;border-radius:8px;border:none;background:#f1f5f9;color:#64748b;cursor:pointer;font-size:13px}
            .us-x:hover{background:#e2e8f0}
            .us-modal-body{padding:20px 24px;overflow-y:auto}
            .us-modal-foot{padding:14px 24px 20px;display:flex;gap:8px;justify-content:flex-end;border-top:1px solid #e4e9f0}

            .us-btn-primary,.us-btn-ghost,.us-btn-danger{padding:9px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid transparent}
            .us-btn-primary{background:#1e40af;color:#fff}.us-btn-primary:hover{background:#1e3a8a}
            .us-btn-primary:disabled{opacity:.6;cursor:default}
            .us-btn-ghost{background:#fff;color:#475569;border-color:#e2e8f0}
            .us-btn-ghost:hover{background:#f8fafc}
            .us-btn-danger{background:#dc2626;color:#fff}.us-btn-danger:hover{background:#b91c1c}
            .us-btn-ghost.sm{padding:5px 10px;font-size:11px}
            .us-btn-ghost.sm.warn{color:#b45309;border-color:#fde68a}
            .us-btn-ghost.sm.ok{color:#15803d;border-color:#bbf7d0}
            .us-btn-ghost.sm.danger{color:#dc2626;border-color:#fecaca}

            .us-field{margin-bottom:14px}
            .us-field > label{display:block;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#475569;margin-bottom:6px}
            .us-field input[type=text],.us-field input[type=email],.us-field input[type=password],.us-field select{width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;color:#0f172a;background:#fff}
            .us-field input:focus,.us-field select:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.12)}
            .us-pass-row{display:flex;gap:8px}
            .us-pass-row input{flex:1}
            .us-hint{font-size:11px;color:#8494a8;margin-top:5px}
            .us-err{display:none;color:#dc2626;font-size:11px;font-weight:600;margin-top:5px}

            .us-permtree{border:1px solid #e4e9f0;border-radius:10px;overflow:hidden;max-height:320px;overflow-y:auto}
            .us-permsec{border-bottom:1px solid #f1f5f9}
            .us-permsec:last-child{border-bottom:none}
            .us-permsec-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:9px 14px;background:#f8fafc}
            .us-permsec-head .t{font-size:11px;font-weight:700;color:#334155;letter-spacing:.7px}
            .us-permsec-head label{font-size:10px;color:#64748b;cursor:pointer;display:flex;align-items:center;gap:4px}
            .us-permrow{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:7px 14px 7px 26px;border-top:1px solid #f1f5f9}
            .us-permrow .s{font-size:13px;color:#475569;min-width:180px}
            .us-permrow label{font-size:11px;color:#475569;cursor:pointer;display:flex;align-items:center;gap:4px}
            .us-permsec input,.us-permrow input{accent-color:#3b82f6}

            .us-confirm-text{font-size:13px;color:#475569;line-height:1.6;margin:0}
            .us-cred{background:#f8fafc;border:1px solid #e4e9f0;border-radius:10px;padding:14px;margin-top:12px}
            .us-cred > div{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:5px 0}
            .us-cred .k{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#8494a8}
            .us-cred .v{font-size:13px;font-weight:700;color:#0f172a;user-select:all}

            .us-audit{display:flex;flex-direction:column;gap:8px}
            .us-audit-row{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;padding:9px 12px;border:1px solid #e4e9f0;border-radius:9px;font-size:11px}
            .us-audit-row .who{font-weight:600;color:#334155}
            .us-audit-row .det{color:#64748b;flex:1;min-width:120px}
            .us-audit-row .f{color:#8494a8;font-size:10px;white-space:nowrap}

            @media(max-width:768px){
                .us-hero{flex-direction:column;align-items:flex-start;padding:16px}
                .us-hero h2{font-size:15px}
                .us-hero-actions{margin-left:0;width:100%}
                .us-btn-hero{flex:1;justify-content:center}
                .us-stats{gap:8px}
                .us-stat{min-width:80px;padding:8px 12px}
                .us-stat .v{font-size:15px}
                .us-stat .k{font-size:10px}
                .us-toolbar{flex-direction:column;align-items:stretch}
                .us-search{max-width:none}
                .us-table-wrap{display:none}
                .us-cards-mobile{display:block;padding:12px}
                .us-mcard{background:#fff;border:1px solid #e4e9f0;border-radius:10px;padding:12px;margin-bottom:8px}
                .us-mcard .top{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;font-size:13px}
                .us-mcard .top .b{display:flex;gap:4px}
                .us-mcard .meta{font-size:11px;color:#64748b;margin-bottom:3px}
                .us-mcard .acc{display:flex;gap:6px;margin-top:8px}
                .us-modal{width:96%}
                .us-permrow .s{min-width:120px}
            }
        </style>`;
    }
});
