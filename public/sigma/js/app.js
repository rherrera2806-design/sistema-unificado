const App = {
    modules: {},
    currentPage: null,

    init() {
        this.updateDate();
        this.renderNav();
        this.loadModule('dashboard');
        this.bindEvents();
        setInterval(() => this.updateDate(), 60000);
    },

    updateDate() {
        const el = document.getElementById('currentDate');
        if (el) {
            const opts = { year: 'numeric', month: 'long', day: 'numeric' };
            el.textContent = new Date().toLocaleDateString('es-CL', opts);
        }
    },

    async renderNav() {
        const nav = document.getElementById('sidebarNav');
        let overdueCount = 0;
        try { overdueCount = (await db.getOverdueMaintenance()).length; } catch(e) {}

        const sections = [
            { label: 'PRINCIPAL', items: [
                { id: 'dashboard', icon: '📊', label: 'Dashboard' }
            ]},
            { label: 'EQUIPOS', items: [
                { id: 'machineTypes', icon: '⚙️', label: 'Tipos de Área' },
                { id: 'machines', icon: '🏭', label: 'Máquinas' },
                { id: 'components', icon: '🔧', label: 'Componentes' }
            ]},
            { label: 'MANTENCIÓN', items: [
                { id: 'preventive', icon: '📋', label: 'Preventivo', badge: overdueCount },
                { id: 'corrective', icon: '🔴', label: 'Correctivo' },
                { id: 'calendar', icon: '📅', label: 'Calendario' },
                { id: 'notas', icon: '📒', label: 'Notas' }
            ]},
            { label: 'REPORTES', items: [
                { id: 'reports', icon: '📈', label: 'Reportes' },
                { id: 'history', icon: '📜', label: 'Historial' },
                { id: 'bitacora', icon: '📒', label: 'Bitácora de Mantención' }
            ]}
        ];

        nav.innerHTML = '';
        sections.forEach(section => {
            const secEl = document.createElement('div');
            secEl.className = 'nav-section';
            secEl.textContent = section.label;
            nav.appendChild(secEl);
            section.items.forEach(item => {
                const el = document.createElement('div');
                el.className = 'nav-item';
                el.dataset.page = item.id;
                el.innerHTML = `<span class="nav-icon">${item.icon}</span>${item.label}`;
                if (item.badge && item.badge > 0) {
                    const badge = document.createElement('span');
                    badge.className = 'badge';
                    badge.textContent = item.badge;
                    el.appendChild(badge);
                }
                nav.appendChild(el);
            });
        });
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
    },

    async loadModule(name) {
        await this.updateNavBadge();
        if (this.currentPage === name) return;
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

        let page = document.getElementById(`page-${name}`);
        if (!page) {
            page = document.createElement('div');
            page.id = `page-${name}`;
            page.className = 'page active';
            document.getElementById('mainContent').appendChild(page);
        }
        page.classList.add('active');
        page.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-light)">Cargando...</div>';

        const navItem = document.querySelector(`.nav-item[data-page="${name}"]`);
        if (navItem) navItem.classList.add('active');
        this.currentPage = name;

        if (this.modules[name]) {
            try {
                await this.modules[name].render();
            } catch (e) {
                page.innerHTML = `<div class="alert alert-danger">Error al cargar módulo: ${e.message}</div>`;
            }
        }
    },

    registerModule(name, handler) {
        this.modules[name] = handler;
    },

    showModal(html, options = {}) {
        const overlay = document.getElementById('modalOverlay');
        const content = overlay.querySelector('.modal');
        content.className = `modal ${options.lg ? 'modal-lg' : ''}`;
        overlay.querySelector('.modal-body').innerHTML = html;
        const header = overlay.querySelector('.modal-header h3');
        if (header) header.textContent = options.title || '';
        overlay.classList.add('show');
    },

    hideModal() {
        document.getElementById('modalOverlay').classList.remove('show');
    },

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

    confirm(message) {
        return new Promise((resolve) => {
            const overlay = document.getElementById('modalOverlay');
            const content = overlay.querySelector('.modal');
            content.className = 'modal';
            content.style.maxWidth = '400px';
            document.getElementById('modalHeaderTitle').textContent = 'Confirmar';
            overlay.querySelector('.modal-body').innerHTML = `<p style="font-size:14px;margin:8px 0">${message}</p>`;
            const footer = overlay.querySelector('.modal-footer');
            const btnCancel = document.createElement('button');
            btnCancel.className = 'btn btn-outline';
            btnCancel.textContent = 'Cancelar';
            btnCancel.onclick = () => { overlay.classList.remove('show'); resolve(false); };
            const btnConfirm = document.createElement('button');
            btnConfirm.className = 'btn btn-danger';
            btnConfirm.textContent = 'Confirmar';
            btnConfirm.onclick = () => { overlay.classList.remove('show'); resolve(true); };
            footer.innerHTML = '';
            footer.appendChild(btnCancel);
            footer.appendChild(btnConfirm);
            overlay.classList.add('show');
        });
    },

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
        const map = {
            'Operativo': 'status-operativo', 'En mantención': 'status-mantenimiento',
            'Detenido': 'status-detenido', 'Realizada': 'status-realizada',
            'Programada': 'status-programada', 'Vencida': 'status-vencida'
        };
        return map[estado] || 'status-programada';
    },

    async getRelationName(collection, id, nameField = 'nombre') {
        if (!id) return '-';
        try {
            const item = await db.getById(collection, id);
            return item ? item[nameField] : '-';
        } catch(e) { return '-'; }
    },

    bindEvents() {
        document.getElementById('sidebarNav').addEventListener('click', (e) => {
            const item = e.target.closest('.nav-item');
            if (item && item.dataset.page) {
                this.loadModule(item.dataset.page);
                this.closeSidebar();
            }
        });
        document.querySelector('.modal-close').addEventListener('click', () => this.hideModal());
        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.hideModal();
        });
        document.getElementById('btnExport')?.addEventListener('click', () => this.exportData());
        document.getElementById('btnImport')?.addEventListener('click', () => document.getElementById('importFile')?.click());
        document.getElementById('importFile')?.addEventListener('change', (e) => {
            if (e.target.files.length) {
                const reader = new FileReader();
                reader.onload = async (ev) => {
                    try { await db.importJSON(ev.target.result); this.showAlert('Datos importados correctamente'); this.loadModule(this.currentPage); }
                    catch(err) { this.showAlert('Error al importar datos: ' + err.message, 'danger'); }
                };
                reader.readAsText(e.target.files[0]);
            }
        });
    },

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
    },

    showResetOptions() {
        const overlay = document.getElementById('modalOverlay');
        document.getElementById('modalHeaderTitle').textContent = 'Reiniciar Base de Datos';
        overlay.querySelector('.modal-body').innerHTML = `
            <p style="margin-bottom:16px">¿Qué deseas hacer?</p>
            <div style="display:flex;flex-direction:column;gap:8px">
                <button class="btn btn-lg btn-primary" onclick="App.hideModal(); App.resetWithData()" style="justify-content:center">
                    🔄 Cargar datos de ejemplo
                </button>
                <button class="btn btn-lg btn-danger" onclick="App.hideModal(); App.resetBlank()" style="justify-content:center">
                    🗑️ Dejar sistema en blanco
                </button>
            </div>
        `;
        const footer = overlay.querySelector('.modal-footer');
        footer.innerHTML = '<button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>';
        overlay.classList.add('show');
    },

    async resetWithData() {
        if (!(await this.confirm('¿Estás seguro? Se eliminarán TODOS los datos.'))) return;
        try { await fetch('/api/sigma/reset', { method: 'POST' }); this.showAlert('Base de datos reiniciada'); }
        catch(e) { this.showAlert('Error: ' + e.message, 'danger'); }
        this.loadModule('dashboard');
    },

    async resetBlank() {
        try {
            await fetch('/api/sigma/clear', { method: 'POST' });
            this.showAlert('Sistema limpiado: todos los datos eliminados');
        } catch(e) { this.showAlert('Error: ' + e.message, 'danger'); }
        this.loadModule('dashboard');
    },

    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
    },

    closeSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
