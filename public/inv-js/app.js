const App = {
    currentPage: null,
    userRole: null,

    pages: {
        inventario: { icon: '📦', label: 'Inventario', render: () => InvInventario.render() },
        movimientos: { icon: '📋', label: 'Movimientos', render: () => InvMovimientos.render() },
        historial: { icon: '🕐', label: 'Historial', render: () => InvHistorial.render() },
        catalogos: { icon: '⚙️', label: 'Catálogos', render: () => InvCatalogos.render(), adminOnly: true }
    },

    init() {
        this.renderSidebar();
        this.navigate('inventario');
        const user = this.getParentUser();
        if (user) {
            document.getElementById('headerUser').textContent = user.nombre;
            this.userRole = user.rol;
        }
    },

    getParentUser() {
        try { return JSON.parse(localStorage.getItem('unified_user')); } catch(e) { return null; }
    },

    isAdmin() {
        return this.userRole === 'admin';
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
        nav.innerHTML = Object.entries(this.pages)
            .filter(([key, page]) => !page.adminOnly || this.isAdmin())
            .map(([key, page]) =>
                `<a class="nav-item ${key === this.currentPage ? 'active' : ''}" onclick="App.navigate('${key}')" role="menuitem">
                    <span class="icon" aria-hidden="true">${page.icon}</span> ${page.label}
                </a>`
            ).join('');
    },

    navigate(page) {
        this.currentPage = page;
        this.renderNavItems();
        this.closeSidebar();
        
        // Update header title
        const headerTitle = document.querySelector('.header-title');
        if (headerTitle && this.pages[page]) {
            headerTitle.innerHTML = `<span>${this.pages[page].label}</span>`;
        }
        
        const main = document.getElementById('mainContent');
        main.innerHTML = `<div class="page active" id="page-${page}"></div>`;
        this.pages[page].render();
    },

    navigateInv(page) {
        this.navigate(page);
    },

    toggleSidebar() {
        document.querySelector('.sidebar').classList.toggle('open');
        document.getElementById('sidebarOverlay').classList.toggle('show');
    },

    closeSidebar() {
        document.querySelector('.sidebar').classList.remove('open');
        document.getElementById('sidebarOverlay').classList.remove('show');
    },

    showModal(title, bodyHtml, footerHtml) {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalBody').innerHTML = bodyHtml;
        document.getElementById('modalFooter').innerHTML = footerHtml || '<button class="btn btn-outline" onclick="App.hideModal()">Cerrar</button>';
        document.getElementById('modalOverlay').classList.add('show');
    },

    hideModal() { 
        document.getElementById('modalOverlay').classList.remove('show'); 
    },

    toast(msg, type = 'success') {
        const t = document.getElementById('toast');
        t.textContent = msg;
        t.className = 'toast ' + type + ' show';
        setTimeout(() => { t.className = 'toast'; }, 3000);
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
