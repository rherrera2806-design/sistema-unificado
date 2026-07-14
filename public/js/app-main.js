const USER_KEY = 'unified_user';
let currentUser = null;
let currentModule = null;

function getUser() { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch(e) { return null; } }
function getPermisos(u) { const p = (u||{}).permisos || []; return Array.isArray(p) ? p : []; }

// =====================================================
// SIDEBAR NAVIGATION
// =====================================================
const menuConfig = [
    {
        id: 'sigma', label: 'MANTENCIÓN', icon: '🔧', permiso: 'sigma',
        children: [
            { id: 'sigma-dashboard', label: 'Dashboard', icon: '📊' },
            { id: 'sigma-preventivo', label: 'Preventivo', icon: '📋' },
            { id: 'sigma-correctivo', label: 'Correctivo', icon: '🔴' },
            { id: 'sigma-calendario', label: 'Calendario', icon: '📅' },
            { id: 'sigma-notas', label: 'Notas', icon: '📒' },
            { id: 'sigma-maquinas', label: 'Máquinas', icon: '🏭' },
            { id: 'sigma-componentes', label: 'Componentes', icon: '🔧' },
            { id: 'sigma-tiposarea', label: 'Tipos de Área', icon: '⚙️' },
            { id: 'sigma-reportes', label: 'Reportes', icon: '📈' },
            { id: 'sigma-historial', label: 'Historial', icon: '📜' },
            { id: 'sigma-bitacora', label: 'Bitácora', icon: '📒' }
        ]
    },
    { id: 'usuarios', label: 'USUARIOS', icon: '👥', permiso: 'usuarios' },
    { id: 'ventas', label: 'VENTAS', icon: '💰', permiso: 'pedidos' },
    { id: 'produccion', label: 'PRODUCCIÓN', icon: '⚙️', permiso: 'produccion' },
    {
        id: 'stock', label: 'STOCK', icon: '📦', permiso: 'inventario',
        children: [
            { id: 'stock-inventario', label: 'Inventario', icon: '📋' },
            { id: 'stock-movimientos', label: 'Movimientos', icon: '🔄', permiso: 'inventario.movimientos' },
            { id: 'stock-historial', label: 'Historial', icon: '📜', permiso: 'inventario.historial' },
            { id: 'stock-catalogos', label: 'Catálogos', icon: '📚', permiso: 'inventario.catalogos' }
        ]
    },
    {
        id: 'turnos', label: 'TURNOS QR', icon: '🎫', permiso: 'turnos',
        children: [
            { id: 'turnos-recepcion', label: 'Recepción', icon: '📋', permiso: 'turnos.recepcion' },
            { id: 'turnos-bodega', label: 'Bodega', icon: '📦', permiso: 'turnos.bodega' },
            { id: 'turnos-qr', label: 'Código QR', icon: '📱' }
        ]
    }
];

function renderSidebar() {
    const nav = document.getElementById('sidebarNav');
    const permisos = getPermisos(currentUser);
    let html = '';

    for (const item of menuConfig) {
        if (!permisos.includes(item.permiso) && !permisos.includes('usuarios')) continue;

        if (item.children) {
            html += `<div class="nav-section">${item.label}</div>`;
            for (const child of item.children) {
                if (child.permiso && !permisos.includes(child.permiso) && !permisos.includes('usuarios')) continue;
                html += `
                    <div class="nav-item nav-sub" data-page="${child.id}" onclick="loadPage('${child.id}')">
                        <span class="nav-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/></svg></span>
                        ${child.label}
                    </div>`;
            }
        } else {
            html += `
                <div class="nav-item" data-page="${item.id}" onclick="loadPage('${item.id}')">
                    <span class="nav-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/></svg></span>
                    ${item.label}
                </div>`;
        }
    }

    nav.innerHTML = html;
}

// =====================================================
// PAGE LOADING
// =====================================================
async function loadPage(pageId) {
    currentModule = pageId;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navItem = document.querySelector(`.nav-item[data-page="${pageId}"]`);
    if (navItem) navItem.classList.add('active');

    const main = document.getElementById('mainContent');
    const headerTitle = document.getElementById('headerTitle');

    // Update header
    const titles = {
        'sigma-dashboard': 'Dashboard', 'sigma-preventivo': 'Mantención Preventiva',
        'sigma-correctivo': 'Mantención Correctiva', 'sigma-calendario': 'Calendario',
        'sigma-notas': 'Notas', 'sigma-maquinas': 'Máquinas', 'sigma-componentes': 'Componentes',
        'sigma-tiposarea': 'Tipos de Área', 'sigma-reportes': 'Reportes', 'sigma-historial': 'Historial',
        'sigma-bitacora': 'Bitácora de Mantención',
        'usuarios': 'Administración de Usuarios', 'ventas': 'Ventas - Pedidos',
        'produccion': 'Producción', 'stock-inventario': 'Inventario',
        'stock-movimientos': 'Movimientos', 'stock-historial': 'Historial de Stock',
        'stock-catalogos': 'Catálogos', 'turnos-recepcion': 'Recepción',
        'turnos-bodega': 'Bodega', 'turnos-qr': 'Código QR'
    };
    headerTitle.textContent = titles[pageId] || pageId;

    // Load content
    main.innerHTML = '<div class="empty-state"><p>Cargando...</p></div>';

    try {
        if (pageId.startsWith('sigma-')) await loadSigmaModule(pageId.replace('sigma-', ''));
        else if (pageId === 'usuarios') await loadUsuarios();
        else if (pageId === 'ventas') await loadVentas();
        else if (pageId === 'produccion') await loadProduccion();
        else if (pageId.startsWith('stock-')) await loadStockModule(pageId.replace('stock-', ''));
        else if (pageId.startsWith('turnos-')) await loadTurnosModule(pageId.replace('turnos-', ''));
    } catch(e) {
        main.innerHTML = `<div class="alert alert-danger">Error al cargar: ${e.message}</div>`;
    }
}

// =====================================================
// SIGMA MODULES
// =====================================================
async function loadSigmaModule(sub) {
    const main = document.getElementById('mainContent');

    if (sub === 'dashboard') {
        const [prev, corr, machines] = await Promise.all([
            db.sigma.getAll('preventive_maintenance'), db.sigma.getAll('corrective_maintenance'), db.sigma.getAll('machines')
        ]);
        const pendientes = prev.filter(p => p.estado === 'Programada' || p.estado === 'Vencida').length;
        const enMantencion = corr.filter(c => c.estado === 'En Mantención').length;
        main.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-value" style="color:var(--info)">${machines.length}</div><div class="stat-label">Máquinas</div></div>
                <div class="stat-card"><div class="stat-value" style="color:var(--warning)">${pendientes}</div><div class="stat-label">Pendientes</div></div>
                <div class="stat-card"><div class="stat-value" style="color:var(--danger)">${enMantencion}</div><div class="stat-label">En Mantención</div></div>
                <div class="stat-card"><div class="stat-value" style="color:var(--success)">${prev.filter(p=>p.estado==='Realizada').length}</div><div class="stat-label">Realizadas</div></div>
            </div>
            <div class="card"><div class="card-header"><h3>Últimas Mantenciones</h3></div><div class="card-body">
                <table><thead><tr><th>Máquina</th><th>Tipo</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>
                ${[...prev.slice(0,5).map(p=>`<tr><td>${p.maquina_id||'-'}</td><td>Preventiva</td><td><span class="badge badge-${p.estado==='Realizada'?'success':p.estado==='Vencida'?'danger':'warning'}">${p.estado}</span></td><td>${p.fecha_programada||'-'}</td></tr>`),
                   ...corr.slice(0,5).map(c=>`<tr><td>${c.maquina_id||'-'}</td><td>Correctiva</td><td><span class="badge badge-danger">${c.estado||'En Mantención'}</span></td><td>${c.fecha_falla||'-'}</td></tr>`)].join('')}
                </tbody></table>
            </div></div>`;
    } else if (sub === 'preventivo') {
        const [registros, maquinas] = await Promise.all([db.sigma.getAll('preventive_maintenance'), db.sigma.getAll('machines')]);
        const sorted = registros.sort((a,b) => {
            const dA = a.fecha_programada ? new Date(a.fecha_programada+'T00:00:00') : new Date(0);
            const dB = b.fecha_programada ? new Date(b.fecha_programada+'T00:00:00') : new Date(0);
            return dA - dB;
        });
        const filtered = sorted.filter(r => r.estado === 'Programada' || r.estado === 'Vencida');
        main.innerHTML = `
            <div class="card"><div class="card-header"><h3>Mantención Preventiva</h3><span class="badge badge-info">${filtered.length} pendientes</span></div>
            <div class="card-body" style="padding:0"><table><thead><tr><th>Máquina</th><th>Componente</th><th>Fecha Programada</th><th>Técnico</th><th>Estado</th></tr></thead><tbody>
            ${filtered.map(r => {
                const maq = maquinas.find(m=>m.id===r.maquina_id);
                return `<tr><td>${maq?maq.nombre:'-'}</td><td>${r.componente_id||'-'}</td><td>${r.fecha_programada||'-'}</td><td>${r.tecnico||'-'}</td><td><span class="badge badge-${r.estado==='Vencida'?'danger':'warning'}">${r.estado}</span></td></tr>`;
            }).join('')}
            </tbody></table></div></div>`;
    } else if (sub === 'bitacora') {
        const bitacora = await db.sigma.getBitacora();
        main.innerHTML = `
            <div class="card"><div class="card-header"><h3>Bitácora de Mantención</h3></div>
            <div class="card-body" style="padding:0"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Máquina</th><th>Componente</th><th>Técnico</th><th>Estado</th></tr></thead><tbody>
            ${bitacora.filter(b=>b.estado==='Reparada'||b.estado==='Realizada').slice(0,30).map(b => {
                const f = b.tipo_mantencion==='Preventiva' ? (b.fecha_ejecutada||b.fecha_programada) : (b.fecha_falla||'');
                const fc = f ? new Date(f+'T12:00:00').toLocaleDateString('es-CL') : '-';
                return `<tr><td>${fc}</td><td><span class="badge badge-${b.tipo_mantencion==='Preventiva'?'success':'danger'}">${b.tipo_mantencion}</span></td><td>${b.maquina_nombre||'-'}</td><td>${b.componente_nombre||'-'}</td><td>${b.tecnico||'-'}</td><td><span class="badge badge-success">${b.estado}</span></td></tr>`;
            }).join('')}
            </tbody></table></div></div>`;
    } else {
        main.innerHTML = `<div class="card"><div class="card-header"><h3>${sub}</h3></div><div class="card-body"><p>Módulo en desarrollo...</p></div></div>`;
    }
}

// =====================================================
// USUARIOS
// =====================================================
async function loadUsuarios() {
    const main = document.getElementById('mainContent');
    const users = await db.request('GET', '/admin/usuarios');
    main.innerHTML = `
        <div class="card">
            <div class="card-header"><h3>Usuarios</h3><button class="btn btn-success btn-sm" onclick="showUserForm()">+ Nuevo</button></div>
            <div class="card-body" style="padding:0">
                <table><thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Permisos</th><th>Acciones</th></tr></thead><tbody>
                ${users.map(u => `<tr>
                    <td><strong>${u.nombre}</strong></td><td>${u.email}</td>
                    <td><span class="badge badge-info">${u.rol}</span></td>
                    <td>${(u.permisos||[]).map(p=>`<span class="badge badge-success" style="margin:1px">${p}</span>`).join(' ')||'-'}</td>
                    <td><button class="btn btn-outline btn-sm" onclick='showUserForm(${JSON.stringify(u)})'>Editar</button>
                    ${u.rol!=='admin'?`<button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})">Eliminar</button>`:''}</td>
                </tr>`).join('')}
                </tbody></table>
            </div>
        </div>`;
}

async function showUserForm(user) {
    const isEdit = !!user;
    document.getElementById('modalTitle').textContent = isEdit ? 'Editar Usuario' : 'Nuevo Usuario';
    document.getElementById('modalBody').innerHTML = `
        <div class="form-group"><label>Nombre</label><input class="form-control" id="fNombre" value="${user?.nombre||''}"></div>
        <div class="form-group"><label>Email</label><input class="form-control" id="fEmail" type="email" value="${user?.email||''}"></div>
        <div class="form-group"><label>${isEdit?'Nueva contraseña (vacío = no cambiar)':'Contraseña'}</label><input class="form-control" id="fPassword" type="password"></div>
        <div class="form-group"><label>Rol</label><select class="form-control" id="fRol">
            <option value="usuario" ${user?.rol==='usuario'?'selected':''}>Usuario</option>
            <option value="admin" ${user?.rol==='admin'?'selected':''}>Admin</option></select></div>
        <div class="form-group"><label>Permisos</label><div style="display:flex;flex-wrap:wrap;gap:8px">
            ${['sigma','inventario','inventario.movimientos','inventario.historial','inventario.catalogos','turnos','turnos.recepcion','turnos.bodega','pedidos','pedidos.autorizar','usuarios','produccion'].map(p =>
                `<label style="font-size:12px;display:flex;align-items:center;gap:4px"><input type="checkbox" class="perm-check" value="${p}" ${(user?.permisos||[]).includes(p)?'checked':''}> ${p}</label>`
            ).join('')}</div></div>`;
    document.getElementById('modalFooter').innerHTML = `
        <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="saveUser(${user?.id||0})">${isEdit?'Actualizar':'Crear'}</button>`;
    document.getElementById('modalOverlay').classList.add('show');
}

async function saveUser(id) {
    const data = {
        nombre: document.getElementById('fNombre').value.trim(),
        email: document.getElementById('fEmail').value.trim(),
        rol: document.getElementById('fRol').value,
        permisos: Array.from(document.querySelectorAll('.perm-check:checked')).map(c=>c.value)
    };
    const pw = document.getElementById('fPassword').value;
    if (pw) data.password = pw;
    if (!data.nombre || !data.email) return alert('Nombre y email requeridos');
    if (!id && !pw) return alert('Contraseña requerida');
    try {
        await db.request(id?'PUT':'POST', id?`/admin/usuarios/${id}`:'/admin/usuarios', data);
        closeModal(); loadUsuarios();
    } catch(e) { alert('Error: '+e.message); }
}

async function deleteUser(id) {
    if (!confirm('¿Eliminar este usuario?')) return;
    await db.request('DELETE', `/admin/usuarios/${id}`);
    loadUsuarios();
}

// =====================================================
// VENTAS (PEDIDOS)
// =====================================================
async function loadVentas() {
    const main = document.getElementById('mainContent');
    const permisos = getPermisos(currentUser);
    const canAuthorize = permisos.includes('pedidos.autorizar') || permisos.includes('usuarios');

    const res = await fetch('/api/pedidos', { headers: { 'X-User-Permisos': permisos.join(','), 'X-User-Email': currentUser.email||'' }});
    const pedidos = await res.json();

    main.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-value" style="color:var(--info)">${pedidos.length}</div><div class="stat-label">Total</div></div>
            <div class="stat-card"><div class="stat-value" style="color:var(--warning)">${pedidos.filter(p=>p.estado==='pendiente').length}</div><div class="stat-label">Pendientes</div></div>
            <div class="stat-card"><div class="stat-value" style="color:var(--success)">${pedidos.filter(p=>p.estado==='aprobado').length}</div><div class="stat-label">Aprobados</div></div>
            <div class="stat-card"><div class="stat-value" style="color:var(--danger)">${pedidos.filter(p=>p.estado==='rechazado').length}</div><div class="stat-label">Rechazados</div></div>
        </div>
        <div class="card">
            <div class="card-header"><h3>Pedidos</h3><button class="btn btn-success btn-sm" onclick="showUploadPedido()">+ Nuevo Pedido</button></div>
            <div class="card-body" style="padding:0">
                <table><thead><tr><th>N° Pedido</th><th>Cliente</th><th>Vendedor</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
                ${pedidos.map(p => `<tr>
                    <td><strong>${p.numero_pedido}</strong></td><td>${p.cliente}</td><td>${p.vendedor}</td>
                    <td>${p.fecha_subida?new Date(p.fecha_subida).toLocaleDateString('es-CL'):'-'}</td>
                    <td><span class="badge badge-${p.estado==='aprobado'?'success':p.estado==='rechazado'?'danger':'warning'}">${p.estado}</span></td>
                    <td>
                        ${p.archivo_url?`<a href="${p.archivo_url}" target="_blank" class="btn btn-outline btn-sm">Ver PDF</a>`:''}
                        ${canAuthorize&&p.estado==='pendiente'?`<button class="btn btn-success btn-sm" onclick="reviewPedido(${p.id},'aprobado')">✓</button><button class="btn btn-danger btn-sm" onclick="reviewPedido(${p.id},'rechazado')">✗</button>`:''}
                    </td>
                </tr>`).join('')}
                </tbody></table>
            </div>
        </div>`;
}

async function showUploadPedido() {
    document.getElementById('modalTitle').textContent = 'Nuevo Pedido';
    document.getElementById('modalBody').innerHTML = `
        <div class="form-group"><label>Número de Pedido *</label><input class="form-control" id="pNumero"></div>
        <div class="form-group"><label>Cliente *</label><input class="form-control" id="pCliente"></div>
        <div class="form-group"><label>PDF</label><input type="file" class="form-control" id="pFile" accept=".pdf"></div>`;
    document.getElementById('modalFooter').innerHTML = `
        <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-success" onclick="uploadPedido()">Subir</button>`;
    document.getElementById('modalOverlay').classList.add('show');
}

async function uploadPedido() {
    const numero = document.getElementById('pNumero').value.trim();
    const cliente = document.getElementById('pCliente').value.trim();
    const file = document.getElementById('pFile').files[0];
    if (!numero || !cliente) return alert('Número y cliente requeridos');

    let archivoUrl = '';
    if (file) {
        const base64 = await new Promise(r => { const reader = new FileReader(); reader.onload = () => r(reader.result.split(',')[1]); reader.readAsDataURL(file); });
        const fileName = `${numero}_${Date.now()}.pdf`;
        const upRes = await fetch('/api/r2/upload', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({fileName, fileContent:base64, contentType:'application/pdf'}) });
        const upData = await upRes.json();
        if (!upRes.ok) return alert(upData.error||'Error al subir PDF');
        archivoUrl = upData.url;
    }

    await fetch('/api/pedidos', { method:'POST', headers:{'Content-Type':'application/json','X-User-Permisos':getPermisos(currentUser).join(','),'X-User-Email':currentUser.email||''},
        body:JSON.stringify({numero_pedido:numero, cliente, vendedor:currentUser.email||'', archivo_url:archivoUrl}) });
    closeModal(); loadVentas();
}

async function reviewPedido(id, estado) {
    const motivo = estado==='rechazado'?prompt('Motivo del rechazo:'):null;
    if (estado==='rechazado' && !motivo) return;
    await fetch(`/api/pedidos/${id}`, { method:'PUT', headers:{'Content-Type':'application/json','X-User-Permisos':getPermisos(currentUser).join(','),'X-User-Email':currentUser.email||''},
        body:JSON.stringify({estado, motivo_rechazo:motivo, revisado_por:currentUser.email||''}) });
    loadVentas();
}

// =====================================================
// PRODUCCIÓN
// =====================================================
async function loadProduccion() {
    document.getElementById('mainContent').innerHTML = `
        <div class="card"><div class="card-body"><div class="empty-state">
            <p style="font-size:48px;margin-bottom:16px">⚙️</p>
            <h3>Producción</h3>
            <p>Módulo en desarrollo. Próximamente se agregarán informes y formularios.</p>
        </div></div></div>`;
}

// =====================================================
// STOCK MODULES
// =====================================================
async function loadStockModule(sub) {
    const main = document.getElementById('mainContent');

    if (sub === 'inventario') {
        const inv = await db.inv.getInventario();
        main.innerHTML = `
            <div class="card"><div class="card-header"><h3>Inventario de Cristales</h3></div>
            <div class="card-body" style="padding:0"><table><thead><tr><th>Tipo</th><th>Espesor</th><th>Ancho</th><th>Alto</th><th>Stock (m²)</th></tr></thead><tbody>
            ${inv.map(i => `<tr><td>${i.tipo_cristal}</td><td>${i.espesor}mm</td><td>${i.ancho}</td><td>${i.alto}</td><td><strong>${Math.round(i.metros_cuadrados||0)}</strong></td></tr>`).join('')}
            </tbody></table></div></div>`;
    } else if (sub === 'movimientos') {
        const movs = await db.inv.getMovimientos();
        main.innerHTML = `
            <div class="card"><div class="card-header"><h3>Movimientos</h3></div>
            <div class="card-body" style="padding:0"><table><thead><tr><th>Fecha</th><th>Tipo</th><th> Cristal</th><th>Espesor</th><th>Dimensiones</th><th>Cant.</th><th>m²</th></tr></thead><tbody>
            ${movs.slice(0,50).map(m => {
                const f = m.fecha_hora ? new Date(m.fecha_hora).toLocaleDateString('es-CL') : '-';
                return `<tr><td>${f}</td><td><span class="badge badge-${m.tipo_movimiento==='Entrada'?'success':'danger'}">${m.tipo_movimiento}</span></td><td>${m.tipo_cristal}</td><td>${m.espesor}mm</td><td>${m.ancho}×${m.alto}</td><td>${m.cantidad_planchas}</td><td>${Math.round(m.metros_cuadrados)}</td></tr>`;
            }).join('')}
            </tbody></table></div></div>`;
    } else {
        main.innerHTML = `<div class="card"><div class="card-header"><h3>${sub}</h3></div><div class="card-body"><p>Módulo en desarrollo...</p></div></div>`;
    }
}

// =====================================================
// TURNOS MODULES
// =====================================================
async function loadTurnosModule(sub) {
    const main = document.getElementById('mainContent');

    if (sub === 'recepcion') {
        const [estado, cola] = await Promise.all([db.turnos.getEstado(), db.turnos.getCola()]);
        main.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-value" style="color:var(--info)">${estado.total||0}</div><div class="stat-label">Total Hoy</div></div>
                <div class="stat-card"><div class="stat-value" style="color:var(--warning)">${estado.enCola||0}</div><div class="stat-label">En Cola</div></div>
            </div>
            <div class="card"><div class="card-header"><h3>Turno Actual</h3><button class="btn btn-primary btn-sm" onclick="siguienteTurno()">Siguiente →</button></div>
            <div class="card-body">
                <p style="font-size:24px;font-weight:700;color:var(--info)">${estado.actual?`#${estado.actual.numero} - ${estado.actual.nombre}`:'Sin turno'}</p>
            </div></div>
            <div class="card" style="margin-top:16px"><div class="card-header"><h3>Cola de Espera (${cola.length})</h3></div>
            <div class="card-body" style="padding:0"><table><thead><tr><th>#</th><th>Nombre</th><th>Hora</th></tr></thead><tbody>
            ${cola.map((c,i) => `<tr><td>${i+1}</td><td>${c.nombre}</td><td>${c.hora_creacion||'-'}</td></tr>`).join('')}
            </tbody></table></div></div>`;
    } else if (sub === 'qr') {
        const estado = await db.turnos.getEstado();
        main.innerHTML = `
            <div class="card" style="text-align:center"><div class="card-body">
                <h3 style="margin-bottom:16px">Código QR para Turnos</h3>
                <div style="background:white;padding:16px;display:inline-block;border-radius:12px">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(window.location.origin+'/turnos/?view=registro')}" alt="QR">
                </div>
                <p style="margin-top:16px;color:var(--text-light)">Escanea para tomar turno</p>
                <div class="stats-grid" style="margin-top:16px;justify-content:center">
                    <div class="stat-card"><div class="stat-value" style="color:var(--info)">${estado.total||0}</div><div class="stat-label">Total hoy</div></div>
                    <div class="stat-card"><div class="stat-value" style="color:var(--warning)">${estado.enCola||0}</div><div class="stat-label">En espera</div></div>
                </div>
            </div></div>`;
    } else {
        main.innerHTML = `<div class="card"><div class="card-header"><h3>${sub}</h3></div><div class="card-body"><p>Módulo en desarrollo...</p></div></div>`;
    }
}

async function siguienteTurno() {
    await db.turnos.siguiente();
    loadTurnosModule('recepcion');
}

// =====================================================
// UTILS
// =====================================================
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }
function closeModal() { document.getElementById('modalOverlay').classList.remove('show'); }
function doLogout() { localStorage.removeItem(USER_KEY); window.location.href = '/'; }
function updateDate() {
    const el = document.getElementById('currentDate');
    if (el) el.textContent = new Date().toLocaleDateString('es-CL', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
}

// =====================================================
// INIT
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    currentUser = getUser();
    if (!currentUser) { window.location.href = '/'; return; }
    document.getElementById('userName').textContent = currentUser.nombre;
    document.getElementById('userAvatar').textContent = (currentUser.nombre||'U').charAt(0).toUpperCase();
    updateDate();
    renderSidebar();
    loadPage('sigma-dashboard');
});
