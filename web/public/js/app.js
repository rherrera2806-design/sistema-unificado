const App = {
    currentUser: null,
    currentModule: null,
    currentPage: null,

    sigmaPages: {
        dashboard: { icon: '📊', label: 'Dashboard', render: () => SigmaDashboard.render() },
        machines: { icon: '🏭', label: 'Maquinas', render: () => SigmaMachines.render() },
        preventive: { icon: '🔧', label: 'Mant. Preventiva', render: () => SigmaPreventive.render() },
        corrective: { icon: '⚠️', label: 'Mant. Correctiva', render: () => SigmaCorrective.render() },
        spareparts: { icon: '📦', label: 'Repuestos', render: () => SigmaSpareparts.render() },
        reports: { icon: '📈', label: 'Reportes', render: () => SigmaReports.render() }
    },

    inventarioPages: {
        dashboard: { icon: '📊', label: 'Dashboard', render: () => InvDashboard.render() },
        movimientos: { icon: '📋', label: 'Movimientos', render: () => InvMovimientos.render() },
        inventario: { icon: '📦', label: 'Inventario', render: () => InvInventario.render() },
        historial: { icon: '🕐', label: 'Historial', render: () => InvHistorial.render() }
    },

    init() {
        const saved = localStorage.getItem('currentUser');
        if (saved) {
            this.currentUser = JSON.parse(saved);
            this.showSelector();
        } else {
            this.showLogin();
        }
    },

    showLogin() {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('selectorScreen').style.display = 'none';
        document.getElementById('appScreen').style.display = 'none';
    },

    showSelector() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('selectorScreen').style.display = 'flex';
        document.getElementById('appScreen').style.display = 'none';
        document.getElementById('userName').textContent = this.currentUser.nombre;
        document.getElementById('userAvatar').textContent = this.currentUser.nombre.charAt(0).toUpperCase();
    },

    showApp() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('selectorScreen').style.display = 'none';
        document.getElementById('appScreen').style.display = 'flex';
        document.getElementById('headerUser').textContent = this.currentUser.nombre;
    },

    async login(e) {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const btn = document.getElementById('loginBtn');
        const errDiv = document.getElementById('loginError');
        btn.textContent = 'Ingresando...';
        btn.disabled = true;
        errDiv.style.display = 'none';
        try {
            this.currentUser = await api.login(email, password);
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            this.showSelector();
        } catch(err) {
            errDiv.textContent = err.message;
            errDiv.style.display = 'block';
        } finally {
            btn.textContent = 'Iniciar Sesion';
            btn.disabled = false;
        }
    },

    logout() {
        this.currentUser = null;
        this.currentModule = null;
        localStorage.removeItem('currentUser');
        this.showLogin();
    },

    enterModule(mod) {
        this.currentModule = mod;
        this.showApp();
        if (mod === 'sigma') {
            document.getElementById('moduleTitle').textContent = 'SIGMA - Mantencion Industrial';
            this.renderSigmaSidebar();
            this.navigateSigma('dashboard');
        } else {
            document.getElementById('moduleTitle').textContent = 'Control Inventario - TEMPLAGLASS';
            this.renderInventarioSidebar();
            this.navigateInv('dashboard');
        }
    },

    backToSelector() {
        this.currentModule = null;
        this.showSelector();
    },

    renderSigmaSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.innerHTML = `
            <div class="sidebar-header">
                <div class="logo" style="background:#16a34a;">M</div>
                <div class="logo-text">SIGMA<small>Mantencion Industrial</small></div>
            </div>
            <nav class="sidebar-nav" id="sidebarNav"></nav>
        `;
        this.renderNavItems(this.sigmaPages);
    },

    renderInventarioSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.innerHTML = `
            <div class="sidebar-header">
                <div class="logo" style="background:#2563eb;">I</div>
                <div class="logo-text">INVENTARIO<small>TEMPLAGLASS</small></div>
            </div>
            <nav class="sidebar-nav" id="sidebarNav"></nav>
        `;
        this.renderNavItems(this.inventarioPages);
    },

    renderNavItems(pages) {
        const nav = document.getElementById('sidebarNav');
        nav.innerHTML = Object.entries(pages).map(([key, page]) =>
            `<a class="nav-item ${key === this.currentPage ? 'active' : ''}" onclick="App.${this.currentModule === 'sigma' ? 'navigateSigma' : 'navigateInv'}('${key}')">
                <span class="icon">${page.icon}</span> ${page.label}
            </a>`
        ).join('');
    },

    navigateSigma(page) {
        this.currentPage = page;
        this.renderNavItems(this.sigmaPages);
        this.closeSidebar();
        const main = document.getElementById('mainContent');
        main.innerHTML = `<div class="page active" id="page-${page}"></div>`;
        this.sigmaPages[page].render();
    },

    navigateInv(page) {
        this.currentPage = page;
        this.renderNavItems(this.inventarioPages);
        this.closeSidebar();
        const main = document.getElementById('mainContent');
        main.innerHTML = `<div class="page active" id="page-${page}"></div>`;
        this.inventarioPages[page].render();
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
