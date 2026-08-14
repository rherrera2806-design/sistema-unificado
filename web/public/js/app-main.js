/* =============================================
   SISTEMA UNIFIED - App Object + Navigation
   Compatible with SIGMA + Inventario modules
   ============================================= */

// ─── Global Fetch Interceptor (adds auth headers to all /api/ calls) ────
(function() {
    const _origFetch = window.fetch;
    window.fetch = function(url, opts) {
        if (typeof url === 'string' && url.startsWith('/api/')) {
            opts = opts || {};
            const user = (() => { try { return JSON.parse(localStorage.getItem('unified_user')) || {}; } catch { return {}; } })();
            opts.headers = opts.headers || {};
            if (typeof opts.headers === 'object' && !(opts.headers instanceof Headers)) {
                if (!opts.headers['X-User-Permisos']) opts.headers['X-User-Permisos'] = (user.permisos || []).join(',');
                if (!opts.headers['X-User-Email']) opts.headers['X-User-Email'] = user.email || '';
            }
        }
        return _origFetch.call(this, url, opts);
    };
})();

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

    // ── Permission helpers for sigma modules ──
    _getUserPerms() {
        try {
            const u = JSON.parse(localStorage.getItem('unified_user')) || {};
            return {
                isAdmin: u.rol === 'admin' || (u.permisos || []).includes('usuarios'),
                perms: u.permisos || []
            };
        } catch(e) { return { isAdmin: false, perms: [] }; }
    },
    canCreate(mod) {
        const { isAdmin, perms } = this._getUserPerms();
        return isAdmin || perms.includes(mod + '.agregar');
    },
    canEdit(mod) {
        const { isAdmin, perms } = this._getUserPerms();
        return isAdmin || perms.includes(mod + '.editar');
    },
    canDelete(mod) {
        const { isAdmin, perms } = this._getUserPerms();
        return isAdmin || perms.includes(mod + '.eliminar');
    },

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
        overlay.querySelector('.modal-header h3').innerHTML = title || '';
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
        const sidebar = document.querySelector('.sidebar');
        const backdrop = document.getElementById('sidebarBackdrop');
        sidebar.classList.toggle('open');
        if (backdrop) backdrop.classList.toggle('show', sidebar.classList.contains('open'));
    },
    closeSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const backdrop = document.getElementById('sidebarBackdrop');
        if (sidebar) sidebar.classList.remove('open');
        if (backdrop) backdrop.classList.remove('show');
    },
    toggleCollapse() {
        const sidebar = document.getElementById('sidebar');
        const layout = document.querySelector('.app-layout');
        sidebar.classList.toggle('collapsed');
        layout.classList.toggle('sidebar-collapsed');
        const icon = document.querySelector('#sidebarCollapseBtn svg polyline');
        if (sidebar.classList.contains('collapsed')) {
            if (icon) icon.setAttribute('points', '9 18 15 12 9 6');
        } else {
            if (icon) icon.setAttribute('points', '15 18 9 12 15 6');
        }
        try { localStorage.setItem('sidebar_collapsed', sidebar.classList.contains('collapsed')); } catch(e) {}
    },

    async showWelcome() {
        const user = getUser();
        const nombre = user ? (user.nombre || user.email) : 'Usuario';
        const mesActual = new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
        const content = document.getElementById('mainContent');

        if (content) {
            content.innerHTML = '<div style="padding:24px 16px"><div style="max-width:1400px;margin:0 auto">'
                + '<div style="margin-bottom:24px"><h1 style="margin:0;font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.5px">Bienvenido, ' + escapeHtml(nombre) + '</h1>'
                + '<p style="margin:4px 0 0;font-size:12px;color:#64748b">Resumen del mes de ' + mesActual + '</p></div>'
                + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">'
                + '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:20px;min-height:160px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><div style="width:36px;height:36px;background:#e2e8f0;border-radius:8px;animation:pulse 1.5s infinite"></div><div style="height:14px;width:90px;background:#e2e8f0;border-radius:6px;animation:pulse 1.5s infinite"></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div style="height:48px;background:#e2e8f0;border-radius:8px;animation:pulse 1.5s infinite"></div><div style="height:48px;background:#e2e8f0;border-radius:8px;animation:pulse 1.5s infinite"></div><div style="height:48px;background:#e2e8f0;border-radius:8px;animation:pulse 1.5s infinite"></div><div style="height:48px;background:#e2e8f0;border-radius:8px;animation:pulse 1.5s infinite"></div></div></div>'
                + '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:20px;min-height:160px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><div style="width:36px;height:36px;background:#e2e8f0;border-radius:8px;animation:pulse 1.5s infinite"></div><div style="height:14px;width:90px;background:#e2e8f0;border-radius:6px;animation:pulse 1.5s infinite"></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div style="height:48px;background:#e2e8f0;border-radius:8px;animation:pulse 1.5s infinite"></div><div style="height:48px;background:#e2e8f0;border-radius:8px;animation:pulse 1.5s infinite"></div><div style="height:48px;background:#e2e8f0;border-radius:8px;animation:pulse 1.5s infinite"></div><div style="height:48px;background:#e2e8f0;border-radius:8px;animation:pulse 1.5s infinite"></div></div></div>'
                + '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:20px;min-height:160px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><div style="width:36px;height:36px;background:#e2e8f0;border-radius:8px;animation:pulse 1.5s infinite"></div><div style="height:14px;width:90px;background:#e2e8f0;border-radius:6px;animation:pulse 1.5s infinite"></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div style="height:48px;background:#e2e8f0;border-radius:8px;animation:pulse 1.5s infinite"></div><div style="height:48px;background:#e2e8f0;border-radius:8px;animation:pulse 1.5s infinite"></div><div style="height:48px;background:#e2e8f0;border-radius:8px;animation:pulse 1.5s infinite"></div><div style="height:48px;background:#e2e8f0;border-radius:8px;animation:pulse 1.5s infinite"></div></div></div>'
                + '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:20px;min-height:160px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><div style="width:36px;height:36px;background:#e2e8f0;border-radius:8px;animation:pulse 1.5s infinite"></div><div style="height:14px;width:90px;background:#e2e8f0;border-radius:6px;animation:pulse 1.5s infinite"></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div style="height:48px;background:#e2e8f0;border-radius:8px;animation:pulse 1.5s infinite"></div><div style="height:48px;background:#e2e8f0;border-radius:8px;animation:pulse 1.5s infinite"></div><div style="height:48px;background:#e2e8f0;border-radius:8px;animation:pulse 1.5s infinite"></div><div style="height:48px;background:#e2e8f0;border-radius:8px;animation:pulse 1.5s infinite"></div></div></div>'
                + '</div></div>'
                + '<style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}</style></div>';
        }

        let asistenciaStats = { faltas: 0, licencias: 0, licencias_dias: 0, vacaciones: 0, vacaciones_trabajadores: 0, trabajadores_total: 0 };
        let instalacionesStats = { programadas: 0, enCurso: 0, completadas: 0, novedades: 0 };
        let inventarioStats = { totalMovimientos: 0, totalEntradas: 0, totalSalidas: 0, tiposCristal: 0, stockM2: 0 };
        let mantencionStats = { preventivasTotal: 0, preventivasProgramadas: 0, preventivasRealizadas: 0, preventivasVencidas: 0, correctivasTotal: 0, correctivasEnMantencion: 0, correctivasReparadas: 0 };
        let pedidosStats = { total: 0, pendientes: 0, aprobados: 0, rechazados: 0 };
        let produccionStats = { total: 0, pendientes: 0, enProceso: 0, completadas: 0, totalPasos: 0, pasosCompletados: 0 };
        try {
            const [asistenciaRes, instalacionesRes, inventarioRes, mantencionRes, pedidosRes, produccionRes] = await Promise.all([
                fetch('/api/asistencia/dashboard'),
                fetch('/api/instalaciones/dashboard'),
                fetch('/api/inv/estadisticas'),
                fetch('/api/maintenance/dashboard'),
                fetch('/api/pedidos/dashboard'),
                fetch('/api/produccion/dashboard')
            ]);
            if (asistenciaRes.ok) asistenciaStats = await asistenciaRes.json();
            if (instalacionesRes.ok) instalacionesStats = await instalacionesRes.json();
            if (inventarioRes.ok) {
                const inv = await inventarioRes.json();
                inventarioStats = { totalMovimientos: inv.totalMovimientos || 0, totalEntradas: inv.totalEntradas || 0, totalSalidas: inv.totalSalidas || 0, tiposCristal: (inv.tiposCristal || []).length, stockM2: Math.round(inv.stockM2 || 0) };
            }
            if (mantencionRes.ok) mantencionStats = await mantencionRes.json();
            if (pedidosRes.ok) pedidosStats = await pedidosRes.json();
            if (produccionRes.ok) produccionStats = await produccionRes.json();
        } catch(e) {}

        const html = `
            <div style="max-width:1400px;margin:0 auto;padding:0 16px">
                <div style="margin-bottom:24px">
                    <h1 style="margin:0;font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.5px">Bienvenido, ${escapeHtml(nombre)}</h1>
                    <p style="margin:4px 0 0;font-size:12px;color:#64748b">Resumen del mes de ${mesActual}</p>
                </div>

                <div class="home-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
                    
                    <!-- ASISTENCIA -->
                    <div style="background:linear-gradient(135deg,#f0f9ff 0%,#e0f2fe 100%);border:1px solid #bae6fd;border-radius:14px;padding:20px;transition:all 0.2s">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
                            <div style="width:36px;height:36px;background:linear-gradient(135deg,#0ea5e9,#0284c7);border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(14,165,233,0.25)">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
                            </div>
                            <div>
                                <h3 style="margin:0;font-size:13px;font-weight:700;color:#0f172a">ASISTENCIA</h3>
                                <p style="margin:0;font-size:11px;color:#64748b">${asistenciaStats.trabajadores_total} trabajadores</p>
                            </div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                            <div style="background:white;border-radius:8px;padding:10px;text-align:center;border:1px solid #e0f2fe">
                                <div style="font-size:22px;font-weight:800;color:#ef4444;line-height:1">${asistenciaStats.faltas}</div>
                                <div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Faltas</div>
                            </div>
                            <div style="background:white;border-radius:8px;padding:10px;text-align:center;border:1px solid #e0f2fe">
                                <div style="font-size:22px;font-weight:800;color:#f59e0b;line-height:1">${asistenciaStats.licencias}</div>
                                <div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Licencias</div>
                            </div>
                            <div style="background:white;border-radius:8px;padding:10px;text-align:center;border:1px solid #e0f2fe">
                                <div style="font-size:22px;font-weight:800;color:#8b5cf6;line-height:1">${asistenciaStats.licencias_dias}</div>
                                <div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Dias Lic.</div>
                            </div>
                            <div style="background:white;border-radius:8px;padding:10px;text-align:center;border:1px solid #e0f2fe">
                                <div style="font-size:22px;font-weight:800;color:#3b82f6;line-height:1">${asistenciaStats.vacaciones}</div>
                                <div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Dias Vac.</div>
                            </div>
                        </div>
                    </div>

                    <!-- INSTALACIONES -->
                    <div style="background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%);border:1px solid #86efac;border-radius:14px;padding:20px;transition:all 0.2s">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
                            <div style="width:36px;height:36px;background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(34,197,94,0.25)">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                            </div>
                            <div>
                                <h3 style="margin:0;font-size:13px;font-weight:700;color:#0f172a">INSTALACIONES</h3>
                                <p style="margin:0;font-size:11px;color:#64748b">Mes actual</p>
                            </div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                            <div style="background:white;border-radius:8px;padding:10px;text-align:center;border:1px solid #dcfce7">
                                <div style="font-size:22px;font-weight:800;color:#3b82f6;line-height:1">${instalacionesStats.programadas}</div>
                                <div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Programadas</div>
                            </div>
                            <div style="background:white;border-radius:8px;padding:10px;text-align:center;border:1px solid #dcfce7">
                                <div style="font-size:22px;font-weight:800;color:#f59e0b;line-height:1">${instalacionesStats.enCurso}</div>
                                <div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">En curso</div>
                            </div>
                            <div style="background:white;border-radius:8px;padding:10px;text-align:center;border:1px solid #dcfce7">
                                <div style="font-size:22px;font-weight:800;color:#22c55e;line-height:1">${instalacionesStats.completadas}</div>
                                <div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Completadas</div>
                            </div>
                            <div style="background:white;border-radius:8px;padding:10px;text-align:center;border:1px solid #dcfce7">
                                <div style="font-size:22px;font-weight:800;color:#ef4444;line-height:1">${instalacionesStats.novedades}</div>
                                <div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Novedades</div>
                            </div>
                        </div>
                    </div>

                    <!-- INVENTARIO -->
                    <div style="background:linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%);border:1px solid #93c5fd;border-radius:14px;padding:20px;transition:all 0.2s">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
                            <div style="width:36px;height:36px;background:linear-gradient(135deg,#3b82f6,#2563eb);border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(59,130,246,0.25)">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                            </div>
                            <div>
                                <h3 style="margin:0;font-size:13px;font-weight:700;color:#0f172a">INVENTARIO</h3>
                                <p style="margin:0;font-size:11px;color:#64748b">${inventarioStats.stockM2.toLocaleString('es-CL')} m2 en stock</p>
                            </div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                            <div style="background:white;border-radius:8px;padding:10px;text-align:center;border:1px solid #dbeafe">
                                <div style="font-size:22px;font-weight:800;color:#0ea5e9;line-height:1">${inventarioStats.tiposCristal}</div>
                                <div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Tipos</div>
                            </div>
                            <div style="background:white;border-radius:8px;padding:10px;text-align:center;border:1px solid #dbeafe">
                                <div style="font-size:22px;font-weight:800;color:#22c55e;line-height:1">${inventarioStats.totalEntradas}</div>
                                <div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Entradas</div>
                            </div>
                            <div style="background:white;border-radius:8px;padding:10px;text-align:center;border:1px solid #dbeafe">
                                <div style="font-size:22px;font-weight:800;color:#ef4444;line-height:1">${inventarioStats.totalSalidas}</div>
                                <div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Salidas</div>
                            </div>
                            <div style="background:white;border-radius:8px;padding:10px;text-align:center;border:1px solid #dbeafe">
                                <div style="font-size:22px;font-weight:800;color:#8b5cf6;line-height:1">${inventarioStats.totalMovimientos}</div>
                                <div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Movimientos</div>
                            </div>
                        </div>
                    </div>

                    <!-- MANTENCION -->
                    <div style="background:linear-gradient(135deg,#fdf4ff 0%,#fae8ff 100%);border:1px solid #e879f9;border-radius:14px;padding:20px;transition:all 0.2s">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
                            <div style="width:36px;height:36px;background:linear-gradient(135deg,#a855f7,#9333ea);border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(168,85,247,0.25)">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                            </div>
                            <div>
                                <h3 style="margin:0;font-size:13px;font-weight:700;color:#0f172a">MANTENCION</h3>
                                <p style="margin:0;font-size:11px;color:#64748b">${mantencionStats.preventivasTotal + mantencionStats.correctivasTotal} registros</p>
                            </div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                            <div style="background:white;border-radius:8px;padding:10px;text-align:center;border:1px solid #fae8ff">
                                <div style="font-size:22px;font-weight:800;color:#3b82f6;line-height:1">${mantencionStats.preventivasProgramadas}</div>
                                <div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Proximas</div>
                            </div>
                            <div style="background:white;border-radius:8px;padding:10px;text-align:center;border:1px solid #fae8ff">
                                <div style="font-size:22px;font-weight:800;color:#22c55e;line-height:1">${mantencionStats.preventivasRealizadas}</div>
                                <div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Realizadas</div>
                            </div>
                            <div style="background:white;border-radius:8px;padding:10px;text-align:center;border:1px solid #fae8ff">
                                <div style="font-size:22px;font-weight:800;color:#ef4444;line-height:1">${mantencionStats.preventivasVencidas}</div>
                                <div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Vencidas</div>
                            </div>
                            <div style="background:white;border-radius:8px;padding:10px;text-align:center;border:1px solid #fae8ff">
                                <div style="font-size:22px;font-weight:800;color:#f59e0b;line-height:1">${mantencionStats.correctivasEnMantencion}</div>
                                <div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">En repar.</div>
                            </div>
                        </div>
                    </div>

                    <!-- PEDIDOS -->
                    <div style="background:linear-gradient(135deg,#fffbeb 0%,#fef3c7 100%);border:1px solid #fcd34d;border-radius:14px;padding:20px;transition:all 0.2s">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
                            <div style="width:36px;height:36px;background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(245,158,11,0.25)">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
                            </div>
                            <div>
                                <h3 style="margin:0;font-size:13px;font-weight:700;color:#0f172a">PEDIDOS</h3>
                                <p style="margin:0;font-size:11px;color:#64748b">${pedidosStats.total} pedidos</p>
                            </div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                            <div style="background:white;border-radius:8px;padding:10px;text-align:center;border:1px solid #fef3c7">
                                <div style="font-size:22px;font-weight:800;color:#f59e0b;line-height:1">${pedidosStats.pendientes}</div>
                                <div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Pendientes</div>
                            </div>
                            <div style="background:white;border-radius:8px;padding:10px;text-align:center;border:1px solid #fef3c7">
                                <div style="font-size:22px;font-weight:800;color:#22c55e;line-height:1">${pedidosStats.aprobados}</div>
                                <div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Aprobados</div>
                            </div>
                            <div style="background:white;border-radius:8px;padding:10px;text-align:center;border:1px solid #fef3c7">
                                <div style="font-size:22px;font-weight:800;color:#ef4444;line-height:1">${pedidosStats.rechazados}</div>
                                <div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Rechazados</div>
                            </div>
                            <div style="background:white;border-radius:8px;padding:10px;text-align:center;border:1px solid #fef3c7">
                                <div style="font-size:22px;font-weight:800;color:#0f172a;line-height:1">${pedidosStats.total}</div>
                                <div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Total</div>
                            </div>
                        </div>
                    </div>

                    <!-- PRODUCCION -->
                    <div style="background:linear-gradient(135deg,#f0fdfa 0%,#ccfbf1 100%);border:1px solid #5eead4;border-radius:14px;padding:20px;transition:all 0.2s">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
                            <div style="width:36px;height:36px;background:linear-gradient(135deg,#14b8a6,#0d9488);border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(20,184,166,0.25)">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                            </div>
                            <div>
                                <h3 style="margin:0;font-size:13px;font-weight:700;color:#0f172a">PRODUCCION</h3>
                                <p style="margin:0;font-size:11px;color:#64748b">${produccionStats.total} ordenes</p>
                            </div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                            <div style="background:white;border-radius:8px;padding:10px;text-align:center;border:1px solid #ccfbf1">
                                <div style="font-size:22px;font-weight:800;color:#f59e0b;line-height:1">${produccionStats.pendientes}</div>
                                <div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Pendientes</div>
                            </div>
                            <div style="background:white;border-radius:8px;padding:10px;text-align:center;border:1px solid #ccfbf1">
                                <div style="font-size:22px;font-weight:800;color:#3b82f6;line-height:1">${produccionStats.enProceso}</div>
                                <div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">En proceso</div>
                            </div>
                            <div style="background:white;border-radius:8px;padding:10px;text-align:center;border:1px solid #ccfbf1">
                                <div style="font-size:22px;font-weight:800;color:#22c55e;line-height:1">${produccionStats.completadas}</div>
                                <div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Completadas</div>
                            </div>
                            <div style="background:white;border-radius:8px;padding:10px;text-align:center;border:1px solid #ccfbf1">
                                <div style="font-size:22px;font-weight:800;color:#8b5cf6;line-height:1">${produccionStats.pasosCompletados}/${produccionStats.totalPasos}</div>
                                <div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Pasos</div>
                            </div>
                        </div>
                    </div>

                </div>

                <div class="home-logo" style="position:fixed;bottom:20px;right:20px;opacity:0.6;pointer-events:none;z-index:0">
                    <img src="/img/vitroflow-logo-final.png" alt="VitroFlow" style="height:120px;width:auto">
                </div>
            </div>
        `;
        document.getElementById('mainContent').innerHTML = `<div class="page active" id="page-welcome" style="padding:24px 16px">${html}</div>`;
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
            let badge = navItem.querySelector('.nav-badge');
            if (unread > 0) {
                if (!badge) { badge = document.createElement('span'); badge.className = 'nav-badge'; navItem.appendChild(badge); }
                badge.textContent = unread;
            } else if (badge) { badge.remove(); }
        } catch(e) {}
    },

    async updateNavBadge() {
        let count = 0;
        try { count = (await db.getOverdueMaintenance()).length; } catch(e) {}
        const navItem = document.querySelector(`.nav-item[data-page="preventive"]`);
        if (!navItem) return;
        let badge = navItem.querySelector('.nav-badge');
        if (count > 0) {
            if (!badge) { badge = document.createElement('span'); badge.className = 'nav-badge'; navItem.appendChild(badge); }
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
        let badge = navItem.querySelector('.nav-badge');
        if (count > 0) {
            if (!badge) { badge = document.createElement('span'); badge.className = 'nav-badge'; navItem.appendChild(badge); }
            badge.textContent = count;
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
    asistencia: ['asistencia'],
    atencion: ['turnos_recepcion', 'turnos_bodega', 'turnos_almacen', 'turnos_facturar', 'turnos_qr', 'turnos_reporte'],
    instalaciones: ['instalaciones', 'inst_historial'],
    inventario: ['inv_inventario', 'inv_movimientos', 'inv_historial', 'inv_catalogos'],
    mantencion: ['dashboard', 'machineTypes', 'machines', 'components', 'preventive', 'corrective', 'calendar', 'notas', 'reports', 'history', 'bitacora'],
    pedidos: ['pedidos'],
    produccion: ['prod_ordenes', 'prod_planificacion', 'prod_reportes', 'prod_notas', 'prod_config', 'taller'],
    costeo: ['costeo']
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
    const p = getUserPerms();
    if (p.some(perm => perm.startsWith(section + '.') || perm.startsWith(section + '_'))) return true;
    const sectionItems = SIDEBAR_SECTIONS[section] || [];
    if (sectionItems.some(item => p.includes(item))) return true;
    return false;
}
function canSeeItem(item, section) {
    if (isAdmin()) return true;
    return hasPerm(item) || hasPerm(section) || hasPerm(section + '.editar') || hasPerm(section + '.eliminar') || hasPerm(section + '.agregar');
}
function canCreate(item, section) {
    if (isAdmin()) return true;
    return hasPerm(item + '.agregar') || hasPerm(section + '.agregar');
}
function canEdit(item, section) {
    if (isAdmin()) return true;
    return hasPerm(item + '.editar') || hasPerm(section + '.editar');
}
function canDelete(item, section) {
    if (isAdmin()) return true;
    return hasPerm(item + '.eliminar') || hasPerm(section + '.eliminar');
}

function renderSidebar() {
    const nav = document.getElementById('sidebarNav');
    let html = '';

    const sections = [
        { key: 'asistencia', label: 'ASISTENCIA', items: [
            { id: 'asistencia', label: 'Control de Asistencia', icon: SVG.clipboard }
        ]},
        { key: 'atencion', label: 'ATENCION', items: [
            { id: 'turnos_recepcion', label: 'Recepcion y Control', icon: SVG.users },
            { id: 'turnos_bodega', label: 'Verificación Bodega', icon: SVG.package },
            { id: 'turnos_almacen', label: 'Almacén', icon: SVG.warehouse },
            { id: 'turnos_facturar', label: 'Por Facturar', icon: SVG.receipt },
            { id: 'turnos_qr', label: 'QR Clientes', icon: SVG.qrcode },
            { id: 'turnos_reporte', label: 'Reporte', icon: SVG.barChart }
        ]},
        { key: 'instalaciones', label: 'INSTALACIONES', items: [
            { id: 'instalaciones', label: 'Instalaciones', icon: SVG.tool },
            { id: 'inst_historial', label: 'Historial', icon: SVG.clock }
        ]},
        { key: 'inventario', label: 'INVENTARIO', items: [
            { id: 'inv_inventario', label: 'Inventario', icon: SVG.clipboard },
            { id: 'inv_movimientos', label: 'Movimientos', icon: SVG.list },
            { id: 'inv_historial', label: 'Historial Inventario', icon: SVG.clock },
            { id: 'inv_catalogos', label: 'Catalogos', icon: SVG.settings }
        ]},
        { key: 'mantencion', label: 'MANTENCION', items: [
            { id: 'dashboard', label: 'Dashboard', icon: SVG.dashboard },
            { id: 'machineTypes', label: 'Tipos de Area', icon: SVG.layers },
            { id: 'machines', label: 'Maquinas', icon: SVG.box },
            { id: 'components', label: 'Componentes', icon: SVG.wrench },
            { id: 'preventive', label: 'Preventivo', icon: SVG.check },
            { id: 'corrective', label: 'Correctivo', icon: SVG.alert },
            { id: 'calendar', label: 'Calendario', icon: SVG.calendar },
            { id: 'notas', label: 'Notas', icon: SVG.file },
            { id: 'reports', label: 'Reportes', icon: SVG.chart },
            { id: 'history', label: 'Historial', icon: SVG.clock },
            { id: 'bitacora', label: 'Bitacora de Mantencion', icon: SVG.book }
        ]},
        { key: 'pedidos', label: 'PEDIDOS', items: [
            { id: 'pedidos', label: 'Pedidos / Ordenes', icon: SVG.file }
        ]},
        { key: 'produccion', label: 'PRODUCCION', items: [
            { id: 'prod_ordenes', label: 'Produccion', icon: SVG.box },
            { id: 'prod_planificacion', label: 'Planificacion', icon: SVG.calendar },
            { id: 'prod_reportes', label: 'Reporte Fechas', icon: SVG.chart },
            { id: 'prod_notas', label: 'Mis Pendientes', icon: SVG.clipboard },
            { id: 'prod_config', label: 'Configuracion', icon: SVG.settings },
            { id: 'taller', label: 'Taller', icon: SVG.home, external: '/taller/' }
        ]},
        { key: 'costeo', label: 'COSTOS', items: [
            { id: 'costeo', label: 'Costeo', icon: SVG.chart }
        ]}
    ];

    sections.forEach(section => {
        if (!hasSection(section.key)) return;
        html += `<div class="nav-section" onclick="toggleSection('${section.key}')"><span>${section.label}</span><span class="toggle-icon">▼</span></div>`;
        html += `<div class="nav-section-group" id="section-${section.key}">`;
        section.items.forEach(item => {
            if (item.external) {
                html += `<div class="nav-item" onclick="window.open('${item.external}','_blank')"><span class="nav-icon">${item.icon}</span><span class="nav-text">${item.label}</span><span class="nav-badge" style="background:#f59e0b;color:#000;font-size:9px;padding:2px 6px;border-radius:8px;margin-left:auto">OPEN</span></div>`;
            } else if (canSeeItem(item.id, section.key)) {
                html += navI(item.id, item.label, item.icon);
            }
        });
        html += `</div>`;
    });

    // Admin section (solo admins)
    if (isAdmin()) {
        html += `<div class="nav-section" onclick="toggleSection('admin')"><span>ADMINISTRACION</span><span class="toggle-icon">▼</span></div>`;
        html += `<div class="nav-section-group" id="section-admin">`;
        html += navI('usuarios', 'Usuarios', SVG.users);
        html += `</div>`;
    }

    // Cerrar sesion (siempre al fondo)
    html += `<div style="flex:1"></div>`;
    html += `<div style="padding:8px 12px 16px;border-top:1px solid rgba(255,255,255,0.06)">`;
    html += `<div class="nav-item" onclick="doLogout()" style="opacity:0.5;justify-content:center">
        <span class="nav-icon">${SVG.logOut}</span><span class="nav-text">Cerrar Sesion</span></div>`;
    html += `</div>`;

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
            } else if (page === 'usuarios') {
                App.loadModule('usuarios');
            } else if (page === 'asistencia') {
                App.loadModule('asistencia');
            } else if (page === 'prod_ordenes') {
                App.loadModule('produccion');
            } else if (page === 'prod_planificacion') {
                App.loadModule('planificacion');
            } else if (page === 'costeo') {
                App.loadModule('costeo');
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
        sectionEl.classList.remove('collapsed');
    } else {
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

// ─── Module Iframe View ────
function openModule(url, label) {
    document.getElementById('launcherView').style.display = 'none';
    document.getElementById('moduleView').style.display = 'flex';
    document.getElementById('moduleLabel').textContent = label || '';
    document.getElementById('moduleFrame').src = url;
}

function closeModule() {
    document.getElementById('moduleView').style.display = 'none';
    document.getElementById('launcherView').style.display = '';
    document.getElementById('moduleFrame').src = '';
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
        if (localStorage.getItem('sidebar_collapsed') === 'true') {
            document.getElementById('sidebar').classList.add('collapsed');
            document.querySelector('.app-layout').classList.add('sidebar-collapsed');
            const icon = document.querySelector('#sidebarCollapseBtn svg polyline');
            if (icon) icon.setAttribute('points', '9 18 15 12 9 6');
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
