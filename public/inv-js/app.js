const App = {
    currentPage: null,

    pages: {
        dashboard: { icon: '📊', label: 'Dashboard', render: () => InvDashboard.render() },
        movimientos: { icon: '📋', label: 'Movimientos', render: () => InvMovimientos.render() },
        inventario: { icon: '📦', label: 'Inventario', render: () => InvInventario.render() },
        historial: { icon: '🕐', label: 'Historial', render: () => InvHistorial.render() }
    },

    init() {
        this.renderSidebar();
        this.navigate('dashboard');
        const user = this.getParentUser();
        if (user) document.getElementById('headerUser').textContent = user.nombre;
    },

    getParentUser() {
        try { return JSON.parse(localStorage.getItem('unified_user')); } catch(e) { return null; }
    },

    renderSidebar() {
        const nav = document.getElementById('sidebar');
        nav.innerHTML = `
            <div class="sidebar-header">
                <div class="logo" style="background:#2563eb;">I</div>
                <div class="logo-text">INVENTARIO<small>Vidrieria</small></div>
            </div>
            <nav class="sidebar-nav" id="sidebarNav"></nav>
        `;
        this.renderNavItems();
    },

    renderNavItems() {
        const nav = document.getElementById('sidebarNav');
        nav.innerHTML = Object.entries(this.pages).map(([key, page]) =>
            `<a class="nav-item ${key === this.currentPage ? 'active' : ''}" onclick="App.navigate('${key}')">
                <span class="icon">${page.icon}</span> ${page.label}
            </a>`
        ).join('');
    },

    navigate(page) {
        this.currentPage = page;
        this.renderNavItems();
        this.closeSidebar();
        const main = document.getElementById('mainContent');
        main.innerHTML = `<div class="page active" id="page-${page}"></div>`;
        this.pages[page].render();
    },

    navigateInv(page) {
        this.navigate(page);
    },

    toggleSidebar() {
        document.querySelector('.sidebar').classList.toggle('open');
        document.getElementById('sidebarOverlay').classList.toggle('active');
    },

    closeSidebar() {
        document.querySelector('.sidebar').classList.remove('open');
        document.getElementById('sidebarOverlay').classList.remove('active');
    },

    showModal(title, bodyHtml, footerHtml) {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalBody').innerHTML = bodyHtml;
        document.getElementById('modalFooter').innerHTML = footerHtml || '<button class="btn btn-outline" onclick="App.hideModal()">Cerrar</button>';
        document.getElementById('modalOverlay').classList.add('active');
    },

    hideModal() { document.getElementById('modalOverlay').classList.remove('active'); },

    toast(msg, type = 'success') {
        const t = document.getElementById('toast');
        t.textContent = msg;
        t.className = 'toast ' + type + ' show';
        setTimeout(() => { t.className = 'toast'; }, 3000);
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
