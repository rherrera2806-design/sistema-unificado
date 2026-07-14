/* =============================================
   SISTEMA UNIFICADO - Panel Principal
   Sidebar unificado que carga modulos completos
   ============================================= */

let currentUser = null;
let sidebarOpen = false;

// ─── Auth ──────────────────────────────────────
function getUser() {
    try { return JSON.parse(localStorage.getItem('unified_user')); } catch { return null; }
}

function doLogout() {
    localStorage.removeItem('unified_user');
    window.location.href = '/';
}

// ─── Init ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    currentUser = getUser();
    if (!currentUser) { window.location.href = '/'; return; }
    document.getElementById('userName').textContent = currentUser.nombre || currentUser.email;
    document.getElementById('userAvatar').textContent = (currentUser.nombre || 'U').charAt(0).toUpperCase();
    const now = new Date();
    document.getElementById('currentDate').textContent = now.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    renderSidebar();
    renderModuleGrid();
});

// ─── Sidebar ───────────────────────────────────
function getAreas() {
    return currentUser.areas || (currentUser.area ? [currentUser.area] : []);
}
function hasArea(a) { return getAreas().includes(a); }
function isAdmin() { return currentUser.rol === 'admin'; }

function renderSidebar() {
    const nav = document.getElementById('sidebarNav');
    const areas = getAreas();
    const isAdminOrGerencia = isAdmin() || hasArea('Gerencia');
    let html = '';

    // Inicio
    html += `<div class="nav-section">PRINCIPAL</div>`;
    html += `<div class="nav-item active" onclick="showLauncher()" data-page="inicio">
        <span class="nav-icon"><svg viewBox="0 0 24 24"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1"/></svg></span>
        Inicio</div>`;

    // SIGMA
    if (isAdminOrGerencia || hasArea('Mantencion')) {
        html += `<div class="nav-section">SIGMA</div>`;
        html += navItem('sigma', 'Mantenimiento Industrial', 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z');
    }

    // Ventas / Pedidos
    if (isAdminOrGerencia || hasArea('Ventas')) {
        html += `<div class="nav-section">VENTAS</div>`;
        html += navItem('pedidos', 'Pedidos / Ordenes', 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2');
    }

    // Stock / Inventario
    if (isAdminOrGerencia || hasArea('Bodega')) {
        html += `<div class="nav-section">STOCK</div>`;
        html += navItem('inventario', 'Inventario', 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4');
    }

    // Turnos
    if (isAdminOrGerencia || hasArea('Recepcion')) {
        html += `<div class="nav-section">ATENCION</div>`;
        html += navItem('turnos', 'Turnos QR', 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z');
    }

    // Admin
    if (isAdmin()) {
        html += `<div class="nav-section">ADMINISTRACION</div>`;
        html += `<div class="nav-item" onclick="window.open('/?admin=1','_blank')" data-page="usuarios">
            <span class="nav-icon"><svg viewBox="0 0 24 24"><path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg></span>
            Usuarios</div>`;
    }

    // Cerrar sesion
    html += `<div class="nav-section" style="margin-top:auto; padding-bottom:16px;"></div>`;
    html += `<div class="nav-item" onclick="doLogout()" style="color:rgba(255,255,255,0.45);">
        <span class="nav-icon"><svg viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg></span>
        Cerrar Sesion</div>`;

    nav.innerHTML = html;
}

function navItem(id, label, path) {
    return `<div class="nav-item" onclick="openModule('${id}')" data-page="${id}">
        <span class="nav-icon"><svg viewBox="0 0 24 24">${path}</svg></span>
        ${label}
    </div>`;
}

// ─── Module Grid (launcher cards) ──────────────
const MODULES = [
    { id: 'sigma',    name: 'SIGMA',          desc: 'Mantenimiento Industrial',  icon: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z', color: '#1a237e', url: '/sigma/' },
    { id: 'pedidos',  name: 'Pedidos',        desc: 'Ordenes de Venta',          icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', color: '#0369a1', url: '/pedidos/' },
    { id: 'inventario', name: 'Inventario',   desc: 'Stock y Control',           icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', color: '#1e40af', url: '/inventario/' },
    { id: 'turnos',    name: 'Turnos QR',     desc: 'Atencion al Cliente',       icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', color: '#b45309', url: '/turnos/' },
];

function renderModuleGrid() {
    const grid = document.getElementById('moduleGrid');
    const areas = getAreas();
    const isAdminOrGerencia = isAdmin() || hasArea('Gerencia');

    const visible = MODULES.filter(m => {
        if (m.id === 'sigma')    return isAdminOrGerencia || hasArea('Mantencion');
        if (m.id === 'pedidos')  return isAdminOrGerencia || hasArea('Ventas');
        if (m.id === 'inventario') return isAdminOrGerencia || hasArea('Bodega');
        if (m.id === 'turnos')   return isAdminOrGerencia || hasArea('Recepcion');
        return false;
    });

    grid.innerHTML = visible.map(m => `
        <div class="module-card" onclick="openModule('${m.id}')" style="--mc:${m.color}">
            <div class="module-card-icon" style="background:${m.color}">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${m.icon}</svg>
            </div>
            <div class="module-card-info">
                <div class="module-card-name">${m.name}</div>
                <div class="module-card-desc">${m.desc}</div>
            </div>
            <div class="module-card-arrow">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7"/></svg>
            </div>
        </div>
    `).join('');
}

// ─── Module Loading (iframe) ───────────────────
function openModule(id) {
    const mod = MODULES.find(m => m.id === id);
    if (!mod) return;

    document.getElementById('launcherView').style.display = 'none';
    document.getElementById('moduleView').style.display = 'flex';
    document.getElementById('moduleLabel').textContent = mod.name;

    const frame = document.getElementById('moduleFrame');
    frame.src = mod.url;

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navItem = document.querySelector(`.nav-item[data-page="${id}"]`);
    if (navItem) navItem.classList.add('active');
}

function closeModule() {
    document.getElementById('moduleView').style.display = 'none';
    document.getElementById('launcherView').style.display = 'grid';
    document.getElementById('moduleFrame').src = 'about:blank';

    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const homeItem = document.querySelector('.nav-item[data-page="inicio"]');
    if (homeItem) homeItem.classList.add('active');
}

function showLauncher() {
    closeModule();
}

// ─── Sidebar Toggle ────────────────────────────
function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
    document.getElementById('sidebar').classList.toggle('open', sidebarOpen);
}

document.addEventListener('click', (e) => {
    if (sidebarOpen && !e.target.closest('.sidebar') && !e.target.closest('.menu-toggle')) {
        sidebarOpen = false;
        document.getElementById('sidebar').classList.remove('open');
    }
});
