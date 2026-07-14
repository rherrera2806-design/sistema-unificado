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
        crearTipoCristal: (n) => this.request('POST', '/catalogos/tipos-cristal', { nombre: n }),
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
    currentGroup: null,

    // ── SIGMA module registration ──
    registerModule(name, handler) { this.modules[name] = handler; },

    // ── Navigation ──
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

    // ── Modal ──
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
            btnCancel.onclick = () => { overlay.classList.remove('show'); resolve(false); };
            const btnConfirm = document.createElement('button');
            btnConfirm.className = 'btn btn-danger';
            btnConfirm.textContent = 'Confirmar';
            btnConfirm.onclick = () => { overlay.classList.remove('show'); resolve(true); };
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
    async getRelationName(collection, id, nameField = 'nombre') {
        if (!id) return '-';
        try { const item = await db.getById(collection, id); return item ? item[nameField] : '-'; } catch(e) { return '-'; }
    },

    // ── Sidebar ──
    toggleSidebar() {
        document.querySelector('.sidebar').classList.toggle('open');
        document.getElementById('sidebarOverlay').classList.toggle('show');
    },
    closeSidebar() {
        document.querySelector('.sidebar').classList.remove('open');
        document.getElementById('sidebarOverlay').classList.remove('show');
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
    },

    // ── Export/Import ──
    async exportData() {
        try {
            const data = await db.exportJSON();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `mantenimiento_backup_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            this.showAlert('Datos exportados correctamente');
        } catch(e) { this.showAlert('Error al exportar: ' + e.message, 'danger'); }
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

// ─── Sidebar Structure ────
function getAreas() {
    const u = getUser();
    return u ? (u.areas || (u.area ? [u.area] : [])) : [];
}
function hasArea(a) { return getAreas().includes(a); }
function isAdmin() { const u = getUser(); return u && u.rol === 'admin'; }

function renderSidebar() {
    const nav = document.getElementById('sidebarNav');
    const areas = getAreas();
    const adm = isAdmin() || hasArea('Gerencia');
    let html = '';

    // MANTENCION (todo junto, sin sub-secciones)
    if (adm || hasArea('Mantencion')) {
        html += `<div class="nav-section">MANTENCION</div>`;
        html += navI('dashboard', 'Dashboard', '📊');
        html += navI('machineTypes', 'Tipos de Area', '⚙️');
        html += navI('machines', 'Maquinas', '🏭');
        html += navI('components', 'Componentes', '🔧');
        html += navI('preventive', 'Preventivo', '📋');
        html += navI('corrective', 'Correctivo', '🔴');
        html += navI('calendar', 'Calendario', '📅');
        html += navI('notas', 'Notas', '📒');
        html += navI('reports', 'Reportes', '📈');
        html += navI('history', 'Historial', '📜');
        html += navI('bitacora', 'Bitacora de Mantencion', '📒');
    }

    // INVENTARIO
    if (adm || hasArea('Bodega')) {
        html += `<div class="nav-section">INVENTARIO</div>`;
        html += navI('inv_inventario', 'Inventario', '📦');
        html += navI('inv_movimientos', 'Movimientos', '📋');
        html += navI('inv_historial', 'Historial Inventario', '🕐');
        html += navI('inv_catalogos', 'Catalogos', '⚙️');
    }

    // ATENCION
    if (adm || hasArea('Recepcion')) {
        html += `<div class="nav-section">ATENCION</div>`;
        html += navI('turnos_page', 'Turnos QR', '🎫');
    }

    // VENTAS
    if (adm || hasArea('Ventas')) {
        html += `<div class="nav-section">VENTAS</div>`;
        html += navI('pedidos_page', 'Pedidos / Ordenes', '📄');
    }

    // ADMIN
    if (isAdmin()) {
        html += `<div class="nav-section">ADMINISTRACION</div>`;
        html += `<div class="nav-item" onclick="window.open('/?admin=1','_blank')">
            <span class="nav-icon">👥</span> Usuarios</div>`;
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
            if (page.startsWith('inv_') || page === 'turnos_page' || page === 'pedidos_page') {
                openExternalModule(page);
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

// ─── External Modules (iframe) ────
const EXTERNAL_MODULES = {
    inv_inventario: { url: '/inventario/', label: 'Inventario' },
    inv_movimientos: { url: '/inventario/?view=movimientos', label: 'Movimientos' },
    inv_historial: { url: '/inventario/?view=historial', label: 'Historial Inventario' },
    inv_catalogos: { url: '/inventario/?view=catalogos', label: 'Catalogos' },
    turnos_page: { url: '/turnos/', label: 'Turnos QR' },
    pedidos_page: { url: '/pedidos/', label: 'Pedidos' }
};

function openExternalModule(id) {
    const mod = EXTERNAL_MODULES[id];
    if (!mod) return;
    document.getElementById('launcherView').style.display = 'none';
    document.getElementById('moduleView').style.display = 'flex';
    document.getElementById('moduleLabel').textContent = mod.label;
    document.getElementById('moduleFrame').src = mod.url;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navItem = document.querySelector(`.nav-item[data-page="${id}"]`);
    if (navItem) navItem.classList.add('active');
}

function closeModule() {
    document.getElementById('moduleView').style.display = 'none';
    document.getElementById('launcherView').style.display = 'grid';
    document.getElementById('moduleFrame').src = 'about:blank';
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
}

// ─── Init ────
document.addEventListener('DOMContentLoaded', async () => {
    if (!getUser()) { window.location.href = '/'; return; }
    renderSidebar();
    await App.updateNavBadge();
    App.loadModule('dashboard');
});
