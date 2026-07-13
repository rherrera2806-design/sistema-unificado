const App = {
    currentPage: null,
    userRole: null,

    pages: {
        inventario: { 
            icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>', 
            label: 'Inventario', 
            render: () => InvInventario.render() 
        },
        movimientos: { 
            icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>', 
            label: 'Movimientos', 
            render: () => InvMovimientos.render() 
        },
        historial: { 
            icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>', 
            label: 'Historial', 
            render: () => InvHistorial.render() 
        },
        catalogos: { 
            icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>', 
            label: 'Catalogos', 
            render: () => InvCatalogos.render(), 
            adminOnly: true 
        }
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
