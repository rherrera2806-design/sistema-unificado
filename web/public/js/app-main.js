/* =============================================
   SISTEMA UNIFIED - App Object + Navigation
   Compatible with SIGMA + Inventario modules
   ============================================= */

// ─── SIGMA-compatible ApiClient (for `db`) ────
class SigmaApiClient {
    constructor() { this.baseUrl = '/api/sigma'; }
    async request(method, path, body = null) {
        const opts = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(`${this.baseUrl}${path}`, opts);
        if (!res.ok) { const err = await res.json().catch(() => ({ error: res.statusText })); throw new Error(err.error || `HTTP ${res.status}`); }
        return res.json();
    }
    async getAll(c) { return this.request('GET', `/${c}`); }
    async getById(c, id) { return this.request('GET', `/${c}/${id}`); }
    async insert(c, d) { return this.request('POST', `/${c}`, d); }
    async update(c, id, d) { return this.request('PUT', `/${c}/${id}`, d); }
    async delete(c, id) { return this.request('DELETE', `/${c}/${id}`); }
    async query(c, fn) { const all = await this.getAll(c); return all.filter(fn); }
    async getComponentsByType(id) { return this.request('GET', `/components/by-type/${id}`); }
    async getMachineWithDetails(id) { return this.request('GET', `/machines/${id}/details`); }
    async getOverdueMaintenance() { return this.request('GET', '/reports/overdue'); }
    async getUpcomingMaintenance(d = 15) { return this.request('GET', `/reports/upcoming?days=${d}`); }
    async getCompletedMaintenance() { return this.request('GET', '/reports/completed'); }
    async getRecentCompleted() { return this.request('GET', '/reports/recent-completed'); }
    async getBitacora() { return this.request('GET', '/reports/bitacora'); }
    async getMachineComponents(id) { return this.request('GET', `/machines/${id}/components`); }
    async saveMachineComponents(id, comps) { return this.request('PUT', `/machines/${id}/components`, { componentes: comps }); }
    async getStatsSummary() { return this.request('GET', '/stats/summary'); }
    async getTopFailingMachines() { return this.request('GET', '/reports/top-failing-machines'); }
    async exportJSON() { return this.request('GET', '/export'); }
    async importJSON(json) { const d = typeof json === 'string' ? JSON.parse(json) : json; return this.request('POST', '/import', d); }
    async resetDatabase() { return this.request('POST', '/reset'); }
    async getMaintenanceByPeriod(s, e) { return this.request('GET', `/reports/by-period?start=${s}&end=${e}`); }
}

// ─── Inventario-compatible ApiClient (for `api`) ────
class InvApiClient {
    constructor() { this.baseUrl = '/api'; }
    async request(method, path, body = null) {
        const opts = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(`${this.baseUrl}${path}`, opts);
        if (!res.ok) { const err = await res.json().catch(() => ({ error: res.statusText })); throw new Error(err.error || `HTTP ${res.status}`); }
        return res.json();
    }
    catalogos = {
        getTiposCristal: () => this.request('GET', '/catalogos/tipos-cristal'),
        crearTipoCristal: (data) => this.request('POST', '/catalogos/tipos-cristal', data),
        editarTipoCristal: (id, data) => this.request('PUT', `/catalogos/tipos-cristal/${id}`, data),
        eliminarTipoCristal: (id) => this.request('DELETE', `/catalogos/tipos-cristal/${id}`),
        getEspesores: () => this.request('GET', '/catalogos/espesores'),
        crearEspesor: (v) => this.request('POST', '/catalogos/espesores', { valor: v }),
        eliminarEspesor: (id) => this.request('DELETE', `/catalogos/espesores/${id}`)
    };
    inv() {
        const self = this;
        return {
            getMovimientos: (f = {}) => { const qs = new URLSearchParams(f).toString(); return self.request('GET', `/inv/movimientos${qs ? '?' + qs : ''}`); },
            crearMovimiento: (d) => self.request('POST', '/inv/movimientos', d),
            eliminarMovimiento: (id) => self.request('DELETE', `/inv/movimientos/${id}`),
            getInventario: (f = {}) => { const qs = new URLSearchParams(f).toString(); return self.request('GET', `/inv/inventario${qs ? '?' + qs : ''}`); },
            getEstadisticas: () => self.request('GET', '/inv/estadisticas'),
            getEstadisticasPorTipo: () => self.request('GET', '/inv/estadisticas-por-tipo'),
            getAutonomia: () => self.request('GET', '/inv/autonomia'),
            getAlertas: () => self.request('GET', '/inv/alertas'),
            getTiposCristal: async () => (await self.request('GET', '/catalogos/tipos-cristal')).map(t => t.nombre || t),
            getEspesores: async () => (await self.request('GET', '/catalogos/espesores')).map(e => e.valor || e)
        };
    }
    turnos = {
        getEstado: () => this.request('GET', '/turnos/estado'),
        crear: (n) => this.request('POST', '/turnos/crear', { nombre: n }),
        siguiente: () => this.request('POST', '/turnos/siguiente'),
        getCola: () => this.request('GET', '/turnos/cola')
    };
}

// ─── Create global instances ────
window.db = new SigmaApiClient();
window.api = new InvApiClient();

// ─── Unified App Object ────
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

const App = {
    modules: {},
    currentPage: null,

    // ── SIGMA module registration ──
    registerModule(name, handler) { this.modules[name] = handler; },

    // ── Navigation (SIGMA) ──
    async loadModule(name) {
        if (this.currentPage === name) return;
        document.querySelectorAll('#mainContent .page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

        let page = document.getElementById(`page-${name}`);
        if (!page) {
            page = document.createElement('div');
            page.id = `page-${name}`;
            page.className = 'page active';
            document.getElementById('mainContent').appendChild(page);
        }
        page.classList.add('active');
        page.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b">Cargando...</div>';

        const navItem = document.querySelector(`.nav-item[data-page="${name}"]`);
        if (navItem) navItem.classList.add('active');
        this.currentPage = name;

        if (this.modules[name]) {
            try { await this.modules[name].render(); }
            catch (e) { page.innerHTML = `<div class="alert alert-danger">Error al cargar: ${e.message}</div>`; console.error(e); }
        }
    },

    // ── Navigation (Inventario) ──
    navigateInv(name) {
        document.querySelectorAll('#mainContent .page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

        let page = document.getElementById(`page-${name}`);
        if (!page) {
            page = document.createElement('div');
            page.id = `page-${name}`;
            page.className = 'page active';
            document.getElementById('mainContent').appendChild(page);
        }
        page.classList.add('active');
        page.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b">Cargando...</div>';

        const navItem = document.querySelector(`.nav-item[data-page="${name}"]`);
        if (navItem) navItem.classList.add('active');
        this.currentPage = name;
    },

    // ── Modal (SIGMA-compatible) ──
    showModal(html, options = {}) {
        const overlay = document.getElementById('modalOverlay');
        const modal = overlay.querySelector('.modal');
        modal.className = `modal ${options.lg ? 'modal-lg' : ''}`;
        overlay.querySelector('.modal-body').innerHTML = html;
        const header = overlay.querySelector('.modal-header h3');
        if (header) header.textContent = options.title || '';
        const footer = overlay.querySelector('.modal-footer');
        footer.innerHTML = '<button class="btn btn-outline" onclick="App.hideModal()">Cerrar</button>';
        overlay.classList.add('show');
    },

    // ── Modal (Inventario-compatible: title, body, footer) ──
    showModalInv(title, bodyHtml, footerHtml) {
        const overlay = document.getElementById('modalOverlay');
        const modal = overlay.querySelector('.modal');
        modal.className = 'modal';
        overlay.querySelector('.modal-header h3').textContent = title || '';
        overlay.querySelector('.modal-body').innerHTML = bodyHtml || '';
        overlay.querySelector('.modal-footer').innerHTML = footerHtml || '<button class="btn btn-outline" onclick="App.hideModal()">Cerrar</button>';
        overlay.classList.add('show');
    },

    hideModal() { document.getElementById('modalOverlay').classList.remove('show'); },

    // ── Alert ──
    showAlert(message, type = 'success') {
        const container = document.getElementById('alertContainer') || (() => {
            const el = document.createElement('div');
            el.id = 'alertContainer';
            el.style.cssText = 'position:fixed;top:20px;right:20px;z-index:2000;max-width:400px;';
            document.body.appendChild(el);
            return el;
        })();
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.textContent = message;
        container.appendChild(alert);
        setTimeout(() => alert.remove(), 4000);
    },

    // ── Toast (Inventario-compatible) ──
    toast(message, type = 'success') {
        this.showAlert(message, type === 'error' ? 'danger' : type);
    },

    // ── Confirm ──
    confirm(message) {
        return new Promise((resolve) => {
            const overlay = document.getElementById('modalOverlay');
            const modal = overlay.querySelector('.modal');
            modal.className = 'modal';
            modal.style.maxWidth = '400px';
            overlay.querySelector('.modal-header h3').textContent = 'Confirmar';
            overlay.querySelector('.modal-body').innerHTML = `<p style="font-size:14px;margin:8px 0">${message}</p>`;
            const footer = overlay.querySelector('.modal-footer');
            footer.innerHTML = '';
            const btnCancel = document.createElement('button');
            btnCancel.className = 'btn btn-outline';
            btnCancel.textContent = 'Cancelar';
            btnCancel.onclick = () => { overlay.classList.remove('show'); modal.style.maxWidth = ''; resolve(false); };
            const btnConfirm = document.createElement('button');
            btnConfirm.className = 'btn btn-danger';
            btnConfirm.textContent = 'Confirmar';
            btnConfirm.onclick = () => { overlay.classList.remove('show'); modal.style.maxWidth = ''; resolve(true); };
            footer.appendChild(btnCancel);
            footer.appendChild(btnConfirm);
            overlay.classList.add('show');
        });
    },

    // ── Helpers ──
    formatDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    },
    formatCurrency(amount) {
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount || 0);
    },
    capitalize(str) {
        if (!str) return '';
        return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    },
    getEstadoClass(estado) {
        const map = { 'Operativo': 'status-operativo', 'En mantención': 'status-mantenimiento', 'Detenido': 'status-detenido', 'Realizada': 'status-realizada', 'Programada': 'status-programada', 'Vencida': 'status-vencida' };
        return map[estado] || 'status-programada';
    },
    isAdmin() {
        const u = getUser();
        return u && u.rol === 'admin';
    },

    // ── Sidebar ──
    toggleSidebar() {
        document.querySelector('.sidebar').classList.toggle('open');
        const overlay = document.getElementById('sidebarOverlay');
        if (overlay) overlay.classList.toggle('show');
    },
    closeSidebar() {
        document.querySelector('.sidebar').classList.remove('open');
        const overlay = document.getElementById('sidebarOverlay');
        if (overlay) overlay.classList.remove('show');
    },
    toggleSidebarCollapse() {
        const layout = document.querySelector('.app-layout');
        const btn = document.querySelector('.sidebar-collapse-btn');
        layout.classList.toggle('sidebar-collapsed');
        const collapsed = layout.classList.contains('sidebar-collapsed');
        btn.textContent = collapsed ? '▶' : '◀';
        try { localStorage.setItem('sidebar_collapsed_state', collapsed ? '1' : '0'); } catch(e) {}
    },

    showWelcome() {
        const user = getUser();
        const nombre = user ? (user.nombre || user.email) : 'Usuario';
        const html = `
            <div style="max-width:600px;margin:80px auto;text-align:center">
                <div style="font-size:48px;margin-bottom:12px">👋</div>
                <h2 style="margin:0 0 8px">Bienvenido, ${escapeHtml(nombre)}</h2>
                <p style="color:var(--text-light);font-size:14px">Usa el menu lateral para navegar entre los modulos</p>
            </div>
        `;
        document.getElementById('mainContent').innerHTML = `<div class="page active" id="page-welcome">${html}</div>`;
    },

    getFirstModule(section) {
        const items = SIDEBAR_SECTIONS[section] || [];
        for (const it of items) { if (canSeeItem(it, section)) return it; }
        return items[0] || 'dashboard';
    },

    // ── Notas badge ──
    async updateNotasBadge() {
        try {
            const data = await db.getAll('notas');
            const unread = data.filter(n => !n.leido).length;
            const navItem = document.querySelector(`.nav-item[data-page="notas"]`);
            if (!navItem) return;
            let badge = navItem.querySelector('.badge');
            if (unread > 0) {
                if (!badge) { badge = document.createElement('span'); badge.className = 'badge'; navItem.appendChild(badge); }
                badge.textContent = unread;
            } else if (badge) { badge.remove(); }
        } catch(e) {}
    },

    async updateNavBadge() {
        let count = 0;
        try { count = (await db.getOverdueMaintenance()).length; } catch(e) {}
        const navItem = document.querySelector(`.nav-item[data-page="preventive"]`);
        if (!navItem) return;
        let badge = navItem.querySelector('.badge');
        if (count > 0) {
            if (!badge) { badge = document.createElement('span'); badge.className = 'badge'; navItem.appendChild(badge); }
            badge.textContent = count;
        } else if (badge) { badge.remove(); }
        await this.updateNotasBadge();
        await this.updateTurnosBadges();
        await this.updateInvAlertasBadge();
        await this.updatePedidosBadge();
        await this.updateProdNotasBadge();
    },

    async updatePedidosBadge() {
        try {
            const user = getUser();
            const res = await fetch('/api/pedidos', {
                headers: { 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' }
            });
            if (!res.ok) return;
            const pedidos = await res.json();
            const pending = pedidos.filter(p => p.estado === 'pendiente').length;
            this._pedidosPending = pending;
            this.setSidebarBadge('pedidos', pending);
        } catch(e) {}
    },

    async updateTurnosBadges() {
        try {
            const [estadoRes, pendBodRes, pendAlmRes, pendFacRes] = await Promise.all([
                fetch('/api/turnos/estado'),
                fetch('/api/turnos/entregas/pendientes'),
                fetch('/api/turnos/almacen/pendientes'),
                fetch('/api/turnos/facturar/pendientes')
            ]);
            const estado = await estadoRes.json();
            const pendBod = await pendBodRes.json();
            const pendAlm = await pendAlmRes.json();
            const pendFac = await pendFacRes.json();
            this.setSidebarBadge('turnos_recepcion', estado.enCola || 0);
            this.setSidebarBadge('turnos_bodega', pendBod.length || 0);
            this.setSidebarBadge('turnos_almacen', pendAlm.length || 0);
            this.setSidebarBadge('turnos_facturar', pendFac.length || 0);
        } catch(e) {}
    },

    async updateInvAlertasBadge() {
        try {
            const res = await fetch('/api/inv/alertas');
            const alertas = await res.json();
            this.setSidebarBadge('inv_inventario', alertas.length || 0);
        } catch(e) {}
    },

    setSidebarBadge(page, count) {
        const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
        if (!navItem) return;
        let badge = navItem.querySelector('.badge');
        if (count > 0) {
            if (!badge) { badge = document.createElement('span'); badge.className = 'badge'; navItem.appendChild(badge); }
            badge.textContent = count;
            badge.style.background = 'rgba(239,68,68,0.9)';
            badge.style.color = 'white';
        } else if (badge) { badge.remove(); }
    },

    async updateProdNotasBadge() {
        try {
            const user = getUser();
            if (!user) return;
            const res = await fetch('/api/produccion/notas', {
                headers: { 'X-User-Email': user.email || '' }
            });
            if (!res.ok) return;
            const notas = await res.json();
            const pending = notas.filter(n => n.estado === 'pendiente').length;
            this.setSidebarBadge('prod_notas', pending);
        } catch(e) {}
    }
};

// ─── Auth ────
function getUser() {
    try { return JSON.parse(localStorage.getItem('unified_user')); } catch { return null; }
}
function doLogout() {
    localStorage.removeItem('unified_user');
    window.location.href = '/';
}

// ─── Sidebar Structure (permisos jerárquicos) ────
const SIDEBAR_SECTIONS = {
    mantencion: ['dashboard','machineTypes','machines','components','preventive','corrective','calendar','notas','reports','history','bitacora'],
    inventario: ['inv_inventario','inv_movimientos','inv_historial','inv_catalogos'],
    atencion: ['turnos_recepcion','turnos_bodega','turnos_almacen','turnos_facturar','turnos_qr','turnos_reporte'],
    ventas: ['pedidos'],
    produccion: ['prod_ordenes','prod_planificacion','prod_reportes','prod_notas','prod_config'],
    instalaciones: ['instalaciones','inst_detalle','inst_historial'],
    administracion: ['usuarios']
};

function getUserPerms() {
    const u = getUser();
    return u ? (u.permisos || []) : [];
}
function hasPerm(p) { return getUserPerms().includes(p); }
function isAdmin() { const u = getUser(); return u && u.rol === 'admin'; }
function hasSection(section) {
    if (isAdmin()) return true;
    if (hasPerm(section)) return true;
    const items = SIDEBAR_SECTIONS[section] || [];
    return items.some(it => hasPerm(it));
}
function canSeeItem(item, section) {
    return isAdmin() || hasPerm(section) || hasPerm(item);
}

function renderSidebar() {
    const nav = document.getElementById('sidebarNav');
    let html = '';

    // MANTENCION
    if (hasSection('mantencion')) {
        html += `<div class="nav-section" onclick="toggleSection('mantencion')"><span>MANTENCION</span><span class="toggle-icon">▼</span></div>`;
        html += `<div class="nav-section-group" id="section-mantencion">`;
        if (canSeeItem('dashboard','mantencion')) html += navI('dashboard', 'Dashboard', SVG.dashboard);
        if (canSeeItem('machineTypes','mantencion')) html += navI('machineTypes', 'Tipos de Area', SVG.layers);
        if (canSeeItem('machines','mantencion')) html += navI('machines', 'Maquinas', SVG.box);
        if (canSeeItem('components','mantencion')) html += navI('components', 'Componentes', SVG.wrench);
        if (canSeeItem('preventive','mantencion')) html += navI('preventive', 'Preventivo', SVG.check);
        if (canSeeItem('corrective','mantencion')) html += navI('corrective', 'Correctivo', SVG.alert);
        if (canSeeItem('calendar','mantencion')) html += navI('calendar', 'Calendario', SVG.calendar);
        if (canSeeItem('notas','mantencion')) html += navI('notas', 'Notas', SVG.file);
        if (canSeeItem('reports','mantencion')) html += navI('reports', 'Reportes', SVG.chart);
        if (canSeeItem('history','mantencion')) html += navI('history', 'Historial', SVG.clock);
        if (canSeeItem('bitacora','mantencion')) html += navI('bitacora', 'Bitacora de Mantencion', SVG.book);
        html += `</div>`;
    }

    // INVENTARIO
    if (hasSection('inventario')) {
        html += `<div class="nav-section" onclick="toggleSection('inventario')"><span>INVENTARIO</span><span class="toggle-icon">▼</span></div>`;
        html += `<div class="nav-section-group" id="section-inventario">`;
        if (canSeeItem('inv_inventario','inventario')) html += navI('inv_inventario', 'Inventario', SVG.clipboard);
        if (canSeeItem('inv_movimientos','inventario')) html += navI('inv_movimientos', 'Movimientos', SVG.list);
        if (canSeeItem('inv_historial','inventario')) html += navI('inv_historial', 'Historial Inventario', SVG.clock);
        if (canSeeItem('inv_catalogos','inventario')) html += navI('inv_catalogos', 'Catalogos', SVG.settings);
        html += `</div>`;
    }

    // ATENCION
    if (hasSection('atencion')) {
        html += `<div class="nav-section" onclick="toggleSection('atencion')"><span>ATENCION</span><span class="toggle-icon">▼</span></div>`;
        html += `<div class="nav-section-group" id="section-atencion">`;
        if (canSeeItem('turnos_recepcion','atencion')) html += navI('turnos_recepcion', 'Recepcion y Control', SVG.users);
        if (canSeeItem('turnos_bodega','atencion')) html += navI('turnos_bodega', 'Verificación Bodega', SVG.package);
        if (canSeeItem('turnos_almacen','atencion')) html += navI('turnos_almacen', 'Almacén', SVG.warehouse);
        if (canSeeItem('turnos_facturar','atencion')) html += navI('turnos_facturar', 'Por Facturar', SVG.receipt);
        if (canSeeItem('turnos_qr','atencion')) html += navI('turnos_qr', 'QR Clientes', SVG.qrcode);
        if (canSeeItem('turnos_reporte','atencion')) html += navI('turnos_reporte', 'Reporte', SVG.barChart);
        html += `</div>`;
    }

    // VENTAS
    if (hasSection('ventas')) {
        html += `<div class="nav-section" onclick="toggleSection('ventas')"><span>VENTAS</span><span class="toggle-icon">▼</span></div>`;
        html += `<div class="nav-section-group" id="section-ventas">`;
        if (canSeeItem('pedidos','ventas')) html += navI('pedidos', 'Pedidos / Ordenes', SVG.file);
        html += `</div>`;
    }

    // PRODUCCION
    if (hasSection('produccion')) {
        html += `<div class="nav-section" onclick="toggleSection('produccion')"><span>PRODUCCION</span><span class="toggle-icon">▼</span></div>`;
        html += `<div class="nav-section-group" id="section-produccion">`;
        if (canSeeItem('prod_ordenes','produccion')) html += navI('produccion', 'Produccion', SVG.box);
        if (canSeeItem('prod_planificacion','produccion')) html += navI('planificacion', 'Planificacion', SVG.calendar);
        if (canSeeItem('prod_reportes','produccion')) html += navI('prod_reportes', 'Reporte Fechas', SVG.chart);
        if (canSeeItem('prod_notas','produccion')) html += navI('prod_notas', 'Mis Pendientes', SVG.clipboard);
        if (canSeeItem('prod_config','produccion')) html += navI('prod_config', 'Configuracion', SVG.settings);
        html += `<div class="nav-item" onclick="window.open('/taller/','_blank')"><span class="nav-icon">${SVG.home}</span><span class="nav-text">Taller</span><span class="nav-badge" style="background:#f59e0b;color:#000;font-size:9px;padding:2px 6px;border-radius:8px;margin-left:auto">OPEN</span></div>`;
        html += `</div>`;
    }

    // INSTALACIONES
    if (hasSection('instalaciones')) {
        html += `<div class="nav-section" onclick="toggleSection('instalaciones')"><span>INSTALACIONES</span><span class="toggle-icon">▼</span></div>`;
        html += `<div class="nav-section-group" id="section-instalaciones">`;
        if (canSeeItem('instalaciones','instalaciones')) html += navI('instalaciones', 'Instalaciones', SVG.tool);
        if (canSeeItem('inst_historial','instalaciones')) html += navI('inst_historial', 'Historial', SVG.clock);
        html += `</div>`;
    }

    // ADMINISTRACION
    if (hasSection('administracion')) {
        html += `<div class="nav-section" onclick="toggleSection('administracion')"><span>ADMINISTRACION</span><span class="toggle-icon">▼</span></div>`;
        html += `<div class="nav-section-group" id="section-administracion">`;
        if (canSeeItem('usuarios','administracion')) html += navI('usuarios', 'Usuarios', SVG.users);
        html += `</div>`;
    }

    // Cerrar sesion
    html += `<div style="flex:1"></div>`;
    html += `<div class="nav-item" onclick="doLogout()" style="opacity:0.4;margin-top:8px">
        <span class="nav-icon">${SVG.logOut}</span> Cerrar Sesion</div>`;

    nav.innerHTML = html;

    // Bind clicks
    nav.querySelectorAll('.nav-item[data-page]').forEach(el => {
        el.addEventListener('click', () => {
            const page = el.dataset.page;
            if (page.startsWith('inv_')) {
                navigateToInv(page);
            } else if (page === 'turnos_recepcion') {
                App.loadModule('turnos');
                setTimeout(() => App.modules.turnos.showRecepcion(), 100);
            } else if (page === 'turnos_bodega') {
                App.loadModule('turnos');
                setTimeout(() => App.modules.turnos.showBodega(), 100);
            } else if (page === 'turnos_almacen') {
                App.loadModule('turnos');
                setTimeout(() => App.modules.turnos.showAlmacen(), 100);
            } else if (page === 'turnos_facturar') {
                App.loadModule('turnos');
                setTimeout(() => App.modules.turnos.showFacturar(), 100);
            } else if (page === 'turnos_qr') {
                App.loadModule('turnos');
                setTimeout(() => App.modules.turnos.showQR(), 100);
            } else if (page === 'turnos_reporte') {
                App.loadModule('reporte_turnos');
            } else if (page === 'pedidos') {
                App.loadModule('pedidos');
            } else {
                App.loadModule(page);
            }
            App.closeSidebar();
        });
    });
}

function toggleSection(section) {
    const group = document.getElementById('section-' + section);
    const sectionEl = group?.previousElementSibling;
    if (!group || !sectionEl) return;

    const isCollapsed = group.classList.contains('collapsed');
    if (isCollapsed) {
        group.classList.remove('collapsed');
        group.style.maxHeight = group.scrollHeight + 'px';
        sectionEl.classList.remove('collapsed');
    } else {
        group.style.maxHeight = '0px';
        group.classList.add('collapsed');
        sectionEl.classList.add('collapsed');
    }
    try { localStorage.setItem('sidebar_collapsed', JSON.stringify({ [section]: !isCollapsed })); } catch(e) {}
}

function navI(id, label, icon) {
    return `<div class="nav-item" data-page="${id}"><span class="nav-icon">${icon}</span> ${label}</div>`;
}

const SVG = {
    dashboard: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    layers: '<svg viewBox="0 0 24 24"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
    box: '<svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
    wrench: '<svg viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    alert: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    calendar: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    file: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    chart: '<svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    book: '<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    clipboard: '<svg viewBox="0 0 24 24"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
    list: '<svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    users: '<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    package: '<svg viewBox="0 0 24 24"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
    warehouse: '<svg viewBox="0 0 24 24"><path d="M3 21V8l9-5 9 5v13"/><path d="M9 21V12h6v9"/></svg>',
    receipt: '<svg viewBox="0 0 24 24"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1L4 2z"/><path d="M8 10h8"/><path d="M8 14h4"/></svg>',
    qrcode: '<svg viewBox="0 0 24 24"><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="2" width="8" height="8" rx="1"/><rect x="2" y="14" width="8" height="8" rx="1"/><rect x="14" y="14" width="4" height="4"/><line x1="22" y1="14" x2="22" y2="22"/><line x1="14" y1="22" x2="22" y2="22"/></svg>',
    barChart: '<svg viewBox="0 0 24 24"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>',
    home: '<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    tool: '<svg viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
    logOut: '<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>'
};

// ─── Inventario Navigation (inline) ────
const INV_PAGES = {
    inv_inventario: { label: 'Inventario', render: () => InvInventario.render() },
    inv_movimientos: { label: 'Movimientos', render: () => InvMovimientos.render() },
    inv_historial: { label: 'Historial Inventario', render: () => InvHistorial.render() },
    inv_catalogos: { label: 'Catalogos', render: () => InvCatalogos.render() }
};

function navigateToInv(name) {
    const pg = INV_PAGES[name];
    if (!pg) return;
    App.navigateInv(name);
    pg.render();
}

// ─── External Page (legacy, no longer used) ────
function openExternalPage(url, label) {
    window.open(url, '_blank');
}

// ─── Init ────
document.addEventListener('DOMContentLoaded', async () => {
    const user = getUser();
    if (!user) { window.location.href = '/'; return; }
    document.getElementById('userName').textContent = user.nombre || user.email || 'Usuario';
    document.getElementById('userAvatar').textContent = (user.nombre || 'U').charAt(0).toUpperCase();
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    renderSidebar();
    // Restaurar estado del sidebar colapsado
    try {
        const collapsed = localStorage.getItem('sidebar_collapsed_state');
        if (collapsed === '1') {
            document.querySelector('.app-layout').classList.add('sidebar-collapsed');
            const btn = document.querySelector('.sidebar-collapse-btn');
            if (btn) btn.textContent = '▶';
        }
    } catch(e) {}
    await App.updateNavBadge();
    setInterval(() => App.updateTurnosBadges(), 10000);
    setInterval(() => App.updateInvAlertasBadge(), 30000);
    setInterval(() => App.updatePedidosBadge(), 15000);
    setInterval(() => App.updateProdNotasBadge(), 15000);
    // Mostrar pagina de bienvenida en vez de cargar dashboard automaticamente
    App.showWelcome();
});
