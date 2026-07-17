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
            const [estadoRes, entregasRes] = await Promise.all([
                fetch('/api/turnos/estado'),
                fetch('/api/turnos/entregas/pendientes')
            ]);
            const estado = await estadoRes.json();
            const entregas = await entregasRes.json();
            this.setSidebarBadge('turnos_recepcion', estado.enCola || 0);
            this.setSidebarBadge('turnos_bodega', entregas.length || 0);
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
    atencion: ['turnos_recepcion','turnos_bodega','turnos_qr'],
    ventas: ['pedidos'],
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
        html += `<div class="nav-section">MANTENCION</div>`;
        if (canSeeItem('dashboard','mantencion')) html += navI('dashboard', 'Dashboard', '📊');
        if (canSeeItem('machineTypes','mantencion')) html += navI('machineTypes', 'Tipos de Area', '⚙️');
        if (canSeeItem('machines','mantencion')) html += navI('machines', 'Maquinas', '🏭');
        if (canSeeItem('components','mantencion')) html += navI('components', 'Componentes', '🔧');
        if (canSeeItem('preventive','mantencion')) html += navI('preventive', 'Preventivo', '📋');
        if (canSeeItem('corrective','mantencion')) html += navI('corrective', 'Correctivo', '🔴');
        if (canSeeItem('calendar','mantencion')) html += navI('calendar', 'Calendario', '📅');
        if (canSeeItem('notas','mantencion')) html += navI('notas', 'Notas', '📒');
        if (canSeeItem('reports','mantencion')) html += navI('reports', 'Reportes', '📈');
        if (canSeeItem('history','mantencion')) html += navI('history', 'Historial', '📜');
        if (canSeeItem('bitacora','mantencion')) html += navI('bitacora', 'Bitacora de Mantencion', '📒');
    }

    // INVENTARIO
    if (hasSection('inventario')) {
        html += `<div class="nav-section">INVENTARIO</div>`;
        if (canSeeItem('inv_inventario','inventario')) html += navI('inv_inventario', 'Inventario', '📦');
        if (canSeeItem('inv_movimientos','inventario')) html += navI('inv_movimientos', 'Movimientos', '📋');
        if (canSeeItem('inv_historial','inventario')) html += navI('inv_historial', 'Historial Inventario', '🕐');
        if (canSeeItem('inv_catalogos','inventario')) html += navI('inv_catalogos', 'Catalogos', '⚙️');
    }

    // ATENCION
    if (hasSection('atencion')) {
        html += `<div class="nav-section">ATENCION</div>`;
        if (canSeeItem('turnos_recepcion','atencion')) html += navI('turnos_recepcion', 'Recepcion y Control', '📋');
        if (canSeeItem('turnos_bodega','atencion')) html += navI('turnos_bodega', 'Entrega de Bodega', '📦');
        if (canSeeItem('turnos_qr','atencion')) html += navI('turnos_qr', 'QR Clientes', '💻');
    }

    // VENTAS
    if (hasSection('ventas')) {
        html += `<div class="nav-section">VENTAS</div>`;
        if (canSeeItem('pedidos','ventas')) html += navI('pedidos', 'Pedidos / Ordenes', '📄');
    }

    // PRODUCCION
    if (hasSection('produccion')) {
        html += `<div class="nav-section">PRODUCCION</div>`;
        if (canSeeItem('prod_ordenes','produccion')) html += navI('produccion', 'Produccion', '🏭');
        if (canSeeItem('prod_codigos','produccion')) html += navI('prod_codigos', 'Codigos', '🏷️');
        if (canSeeItem('prod_maquinas','produccion')) html += navI('prod_maquinas', 'Maquinas', '⚙️');
        if (canSeeItem('prod_recetas','produccion')) html += navI('prod_recetas', 'Recetas BOM', '📦');
    }

    // ADMINISTRACION
    if (hasSection('administracion')) {
        html += `<div class="nav-section">ADMINISTRACION</div>`;
        if (canSeeItem('usuarios','administracion')) html += navI('usuarios', 'Usuarios', '👥');
    }

    // Cerrar sesion
    html += `<div style="flex:1"></div>`;
    html += `<div class="nav-item" onclick="doLogout()" style="opacity:0.5;margin-top:8px">
        <span class="nav-icon">🚪</span> Cerrar Sesion</div>`;

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
            } else if (page === 'turnos_qr') {
                App.loadModule('turnos');
                setTimeout(() => App.modules.turnos.showQR(), 100);
            } else if (page === 'pedidos') {
                App.loadModule('pedidos');
            } else {
                App.loadModule(page);
            }
            App.closeSidebar();
        });
    });
}

function navI(id, label, icon) {
    return `<div class="nav-item" data-page="${id}"><span class="nav-icon">${icon}</span> ${label}</div>`;
}

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
    await App.updateNavBadge();
    setInterval(() => App.updateTurnosBadges(), 5000);
    setInterval(() => App.updateInvAlertasBadge(), 30000);
    setInterval(() => App.updatePedidosBadge(), 10000);
    App.loadModule('dashboard');
});
