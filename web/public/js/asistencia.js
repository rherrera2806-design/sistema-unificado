// ═══════════════════════════════════════════════════════
// VitroFlow - Módulo de Asistencia
// ═══════════════════════════════════════════════════════
// Garantizar que las funciones de permisos existan
(function() {
    function _getUser() { try { return JSON.parse(localStorage.getItem('unified_user')) || {}; } catch(e) { return {}; } }
    function _isAdmin() { var u = _getUser(); return u.rol === 'admin' || (u.permisos || []).indexOf('usuarios') !== -1; }
    function _hasPerm(p) { if (_isAdmin()) return true; return (_getUser().permisos || []).indexOf(p) !== -1; }

    if (typeof canCreate !== 'function') window.canCreate = function(m) { return _isAdmin() || _hasPerm(m + '.agregar'); };
    if (typeof canEdit !== 'function') window.canEdit = function(m) { return _isAdmin() || _hasPerm(m + '.editar'); };
    if (typeof canDelete !== 'function') window.canDelete = function(m) { return _isAdmin() || _hasPerm(m + '.eliminar'); };
    if (typeof canView !== 'function') window.canView = function(m) { return _isAdmin() || _hasPerm(m) || _hasPerm(m + '.editar') || _hasPerm(m + '.eliminar') || _hasPerm(m + '.agregar'); };
    if (typeof isAdmin !== 'function') window.isAdmin = _isAdmin;

    if (typeof getAuthHeaders !== 'function') window.getAuthHeaders = function() {
        var u = _getUser();
        return { 'Content-Type': 'application/json', 'X-User-Permisos': (u.permisos || []).join(','), 'X-User-Email': u.email || '' };
    };
    if (typeof authFetch !== 'function') window.authFetch = function(url, opts) {
        opts = opts || {}; var h = getAuthHeaders();
        opts.headers = Object.assign({}, h, opts.headers || {});
        return fetch(url, opts);
    };
})();

if (typeof BTN === 'undefined') window.BTN = { NUEVO:'Nuevo', EDITAR:'Editar', ELIMINAR:'Eliminar', FILTRAR:'Filtrar', CARGAR:'Cargar', EXPORTAR_EXCEL:'Excel', EXPORTAR_PDF:'PDF', IMPORTAR:'Importar', APROBAR:'Aprobar', RECHAZAR:'Rechazar', ACTIVAR:'Activar', DESACTIVAR:'Desactivar', ICON:{ NUEVO:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>', EDITAR:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>', ELIMINAR:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>', APROBAR:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>', RECHAZAR:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>' }};
if (typeof MSG === 'undefined') window.MSG = { SIN_DATOS:'Sin datos para mostrar', CARGANDO:'Cargando...', CONFIRMAR_ELIMINAR:'¿Está seguro de eliminar este registro?', CONFIRMAR_ELIMINAR_NOMBRE:function(n){ return '¿Está seguro de eliminar "'+n+'"?'; }};
if (typeof SYSTEM_MODULES === 'undefined') window.SYSTEM_MODULES = { ASISTENCIA:'asistencia' };
// ═══════════════════════════════════════════════════════

const Asistencia = {
    trabajadores: [],
    asistenciaHoy: [],
    currentTab: 'diaria',
    lastLoadedDate: null,
    _initialized: false,
    _filterTimer: null,
    _permCache: null,

    _getPerms() {
        if (!this._permCache) {
            const MOD = 'asistencia';
            this._permCache = {
                canCreate: canCreate(MOD),
                canEdit: canEdit(MOD),
                canDelete: canDelete(MOD),
                canView: canView(MOD)
            };
        }
        return this._permCache;
    },

    debouncedBuscarTrabajadores() {
        clearTimeout(this._filterTimer);
        this._filterTimer = setTimeout(() => this.buscarTrabajadores(), 200);
    },

    debouncedBuscarTrabajadoresAdmin() {
        clearTimeout(this._filterTimer);
        this._filterTimer = setTimeout(() => this.buscarTrabajadoresAdmin(), 200);
    },

    _calendarioTimer: null,
    debouncedFiltrarCalendario() {
        clearTimeout(this._calendarioTimer);
        this._calendarioTimer = setTimeout(() => this.filtrarCalendario(), 200);
    },

    async render() {
        const el = document.getElementById('page-asistencia');
        if (!el) return;

        if (!this._initialized || !document.getElementById('ast-content')) {
            this._initialized = false;
            el.innerHTML = '<style>'
                + '@keyframes astFadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}'
                + '.ast-card{transition:all 0.25s cubic-bezier(0.4,0,0.2,1)}'
                + '.ast-card:hover{transform:translateY(-2px)!important;box-shadow:0 8px 20px rgba(0,0,0,0.1)!important}'
                + '.ast-row{transition:all 0.15s ease;border-left:3px solid transparent}'
                + '.ast-row:hover{background:#f8fafc!important;border-left-color:#3b82f6}'
                + '.ast-tab{padding:8px 18px;font-size:12px;font-weight:600;border-radius:8px;border:1px solid #e2e8f0;background:white;color:#64748b;cursor:pointer;transition:all 0.15s}'
                + '.ast-tab:hover{border-color:#93c5fd;color:#3b82f6}'
                + '.ast-tab.active{background:linear-gradient(135deg,#1e40af,#2563eb);color:white;border-color:#1e40af;box-shadow:0 2px 8px rgba(30,64,175,0.3)}'
                + '.ast-badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;letter-spacing:0.3px}'
                + '.ast-btn{padding:8px 16px;font-size:12px;font-weight:600;border-radius:8px;border:none;cursor:pointer;transition:all 0.15s}'
                + '.ast-btn:hover{transform:translateY(-1px);box-shadow:0 3px 10px rgba(0,0,0,0.12)}'
                + '.ast-input{padding:9px 14px;font-size:13px;border:1px solid #e2e8f0;border-radius:8px;outline:none;transition:all 0.15s;font-family:inherit}'
                + '.ast-input:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,0.1)}'
                + '.ast-worker{display:flex;align-items:center;gap:10px;padding:8px 14px;border-bottom:1px solid #f1f5f9;transition:all 0.15s}'
                + '.ast-worker:last-child{border-bottom:none}'
                + '.ast-worker:hover{background:#f8fafc}'
                + '.ast-avatar{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;color:white;flex-shrink:0}'
                + '.ast-podium{display:flex;justify-content:center;align-items:flex-end;gap:20px;margin:24px 0}'
                + '.ast-rank{background:white;border:1px solid #e2e8f0;border-radius:14px;padding:20px;text-align:center;transition:all 0.2s;min-width:160px}'
                + '.ranking-container{display:flex;gap:10px;justify-content:flex-start;align-items:stretch;padding:12px 0;overflow-x:auto;-webkit-overflow-scrolling:touch}'
                + '.ranking-card{border-radius:12px;padding:12px 14px 10px;text-align:center;flex:0 0 auto;width:110px;box-shadow:0 2px 12px rgba(0,0,0,0.06)}'
                + '.ranking-name{font-size:11px;font-weight:700;margin-bottom:4px;line-height:1.2;min-height:28px;display:flex;align-items:center;justify-content:center}'
                + '@media(max-width:768px){'
                + '.ranking-container{gap:8px;padding:8px 0}'
                + '.ranking-card{padding:8px 6px 6px;border-radius:10px;width:85px}'
                + '.ranking-name{font-size:9px!important;min-height:20px}'
                + '}'
                + '.ast-rank:hover{transform:translateY(-3px);box-shadow:0 8px 20px rgba(0,0,0,0.08)}'
                + '.ast-cal-header{display:grid;border-bottom:2px solid #e2e8f0;background:#f8fafc;position:sticky;top:0;z-index:2}'
                + '.ast-cal-row{display:grid;border-bottom:1px solid #f1f5f9}'
                + '.ast-cal-cell{padding:4px;text-align:center;font-size:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:24px;gap:1px}'
                + '.ast-cal-cell.presente{background:#d1fae5}.ast-cal-cell.falta{background:#fee2e2;color:#dc2626;font-weight:700}'
                + '.ast-cal-cell.vacaciones{background:#dbeafe;color:#2563eb}.ast-cal-cell.licencia{background:#fef3c7;color:#d97706}'
                + '.ast-cal-cell.fin-semana{background:#f8fafc}.ast-cal-cell.hoy{outline:2px solid #3b82f6;outline-offset:-2px}'
                + '.ast-cal-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;position:relative}'
                + '.ast-cal-scroll::-webkit-scrollbar{height:6px}.ast-cal-scroll::-webkit-scrollbar-track{background:#f1f5f9;border-radius:3px}.ast-cal-scroll::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}'
                + '.ast-cal-sticky-col{position:sticky;left:0;z-index:20;background:white;border-right:2px solid #e2e8f0;box-shadow:2px 0 5px rgba(0,0,0,0.05)}'
                + '@media(max-width:640px){'
                + '.ast-cal-cell{min-height:40px;padding:4px 2px;font-size:11px;gap:2px}'
                + '.ast-cal-cell svg{width:14px;height:14px}'
                + '.ast-cal-day-num{font-size:12px;font-weight:700;line-height:1.1}'
                + '.ast-cal-day-name{font-size:8px;font-weight:500;opacity:0.7;line-height:1}'
                + '}'
                + '#ast-hero-buscar::placeholder{color:rgba(255,255,255,0.8)!important;opacity:1!important}'
                + '#ast-hero-fecha{color-scheme:dark}'
                + '#ast-hero-mes option,#ast-hero-anio option{color:#1e293b;background:white}'
                + '.ast-hero-wrap{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:10px;padding:10px 16px;margin-bottom:14px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3);max-width:100%;box-sizing:border-box}'
                + '.ast-hero-inner{position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;max-width:100%;overflow:hidden}'
                + '.ast-hero-title{flex:1;min-width:140px}'
                + '.ast-hero-filters{display:flex;gap:6px;align-items:center;flex-wrap:wrap;flex:1;justify-content:flex-end;min-width:0;max-width:100%;overflow:hidden}'
                + '@media(max-width:640px){'
                + '.ast-hero-inner{flex-direction:column;align-items:stretch;height:auto!important}'
                + '.ast-hero-title{text-align:center}'
                + '.ast-hero-filters{justify-content:center;gap:6px}'
                + '.ast-hero-filters input[type=text]{width:100%!important;min-width:0}'
                + '.ast-hero-filters select{flex:1;min-width:0}'
                + '.ast-hero-filters .ast-btn,.ast-hero-filters .btn{flex-shrink:0}'
                + '.ast-hero-filters>div{flex-wrap:wrap;justify-content:center}'
                + '}'
                + '@media(max-width:768px){.ast-podium{flex-direction:column;align-items:center}}'
                + '.ast-form-grid{display:flex;flex-wrap:wrap;gap:12px;align-items:end}'
                + '.ast-form-grid>div{flex:1 1 100%;min-width:0;box-sizing:border-box}'
                + '.ast-form-actions{display:flex;gap:6px;flex:1 1 100%}'
                + '@media(min-width:640px){.ast-form-grid>div{flex:1 1 calc(50% - 6px)}}'
                + '@media(min-width:1024px){.ast-form-grid>div{flex:1 1 calc(20% - 10px)}.ast-form-actions{flex:0 0 auto}}'
                + '</style>'

                + '<div class="ast-hero-wrap">'
                + '<div class="ast-hero-inner" style="min-height:44px">'
                + '<div class="ast-hero-title"><h2 style="margin:0;font-size:14px;font-weight:800;color:white;letter-spacing:-0.5px;text-shadow:0 2px 4px rgba(0,0,0,0.2)">Control de Asistencia</h2>'
                + '<p id="ast-hero-subtitle" style="margin:1px 0 0;font-size:9px;color:rgba(255,255,255,0.7)">Marca faltas del día</p></div>'
                + '<div id="ast-hero-filters" class="ast-hero-filters"></div>'
                + '</div></div>'

                + '<div id="ast-tabs" style="display:flex;gap:8px;margin-bottom:24px;flex-wrap:wrap;overflow-x:auto;max-width:100%"></div>'

                + '<div id="ast-content"></div>';

            this._initialized = true;
        }
        this.renderTabs();
        this.showTab(this.currentTab);
    },

    renderTabs() {
        const tabs = [
            { id: 'trabajadores', label: 'Trabajadores', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
            { id: 'diaria', label: 'Asistencia Diaria', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>' },
            { id: 'calendario', label: 'Calendario', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' },
            { id: 'permisos', label: 'Permisos', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' },
            { id: 'licencias', label: 'Licencias', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>' },
            { id: 'vacaciones', label: 'Vacaciones', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>' },
            { id: 'horas_extras', label: 'Horas Extras', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' },
            { id: 'reportes', label: 'Reportes', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>' }
        ];

        document.getElementById('ast-tabs').innerHTML = tabs.map(t =>
            `<button class="ast-tab${t.id === this.currentTab ? ' active' : ''}" data-tab="${t.id}" onclick="Asistencia.showTab('${t.id}', event)" style="display:inline-flex;align-items:center;gap:6px">${t.icon}${t.label}</button>`
        ).join('');
    },

    showTab(tab, evt) {
        this.currentTab = tab;
        document.querySelectorAll('.ast-tab').forEach(el => {
            el.classList.toggle('active', el.dataset.tab === tab);
        });

        const subtitles = {
            trabajadores: 'Administrar personal activo e inactivo',
            diaria: 'Marca faltas del día',
            calendario: 'Vista mensual de asistencia',
            permisos: 'Solicitudes de permiso y ausencias',
            licencias: 'Control de licencias médicas',
            vacaciones: 'Control de vacaciones del personal',
            horas_extras: 'Registro de horas extras trabajadas',
            reportes: 'Estadísticas y rankings de asistencia'
        };
        document.getElementById('ast-hero-subtitle').textContent = subtitles[tab] || '';
        this.renderHeroFilters(tab);

        const c = document.getElementById('ast-content');
        if (tab === 'trabajadores') this.renderTrabajadoresTab(c);
        else if (tab === 'diaria') this.renderDiaria(c);
        else if (tab === 'calendario') this.renderCalendarioTab(c);
        else if (tab === 'permisos') this.renderPermisosTab(c);
        else if (tab === 'licencias') this.renderLicenciasTab(c);
        else if (tab === 'vacaciones') this.renderVacacionesTab(c);
        else if (tab === 'horas_extras') this.renderHorasExtrasTab(c);
        else if (tab === 'reportes') this.renderReportesTab(c);
    },

    renderHeroFilters(tab) {
        const container = document.getElementById('ast-hero-filters');
        if (!container) return;
        const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        const mesActual = new Date().getMonth();
        const MOD = SYSTEM_MODULES.ASISTENCIA;
        const canAgT = canCreate(MOD);
        const canEdT = canEdit(MOD);
        const canDelT = canDelete(MOD);
        const canViewMod = canView(MOD);
        if (tab === 'trabajadores') {
            container.innerHTML = '<div style="display:flex;gap:6px;align-items:center">'
                + '<button onclick="Asistencia.filtrarTrabajadores(\'todos\')" class="ast-btn ast-hero-trab-filter" style="background:rgba(255,255,255,0.3);color:white;border:1px solid rgba(255,255,255,0.4);font-size:11px;padding:6px 12px" data-filter="todos">Todos</button>'
                + '<button onclick="Asistencia.filtrarTrabajadores(\'activos\')" class="ast-btn ast-hero-trab-filter" style="background:rgba(255,255,255,0.15);color:rgba(255,255,255,0.8);border:1px solid rgba(255,255,255,0.2);font-size:11px;padding:6px 12px" data-filter="activos">Activos</button>'
                + '<button onclick="Asistencia.filtrarTrabajadores(\'inactivos\')" class="ast-btn ast-hero-trab-filter" style="background:rgba(255,255,255,0.15);color:rgba(255,255,255,0.8);border:1px solid rgba(255,255,255,0.2);font-size:11px;padding:6px 12px" data-filter="inactivos">Inactivos</button>'
                + '</div>'
                + '<div style="position:relative">'
                + '<svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
                + '<input type="text" id="ast-hero-buscar" class="ast-input" placeholder="Buscar nombre o RUT..." oninput="Asistencia.debouncedBuscarTrabajadoresAdmin()" style="padding-left:32px;width:100%;min-width:120px;max-width:200px;background:rgba(255,255,255,0.35);color:white;border:1px solid rgba(255,255,255,0.5);font-size:11px">'
                + '</div>'
                + (canAgT ? `<button onclick="Asistencia.showFormTrabajador()" class="btn btn-primary" title="${BTN.NUEVO} trabajador" style="padding:5px 12px;font-size:12px">${BTN.ICON.NUEVO} ${BTN.NUEVO}</button>` : '')
                + `<button onclick="Asistencia.exportExcelTrabajadores()" class="ast-btn" style="background:rgba(255,255,255,0.95);color:#16a34a;font-weight:700;font-size:11px;padding:6px 14px;border-radius:8px;box-shadow:0 2px 8px rgba(22,163,74,0.15)">${BTN.EXPORTAR_EXCEL}</button>`
                + `<button onclick="Asistencia.importarExcelTrabajadores()" class="ast-btn" style="background:rgba(255,255,255,0.95);color:#0e7490;font-weight:700;font-size:11px;padding:6px 14px;border-radius:8px;box-shadow:0 2px 8px rgba(14,116,144,0.15)" title="${BTN.IMPORTAR} desde Excel/CSV">${BTN.IMPORTAR}</button>`
                + `<button onclick="Asistencia.exportPDFTrabajadores()" class="ast-btn" style="background:rgba(255,255,255,0.95);color:#dc2626;font-weight:700;font-size:11px;padding:6px 14px;border-radius:8px;box-shadow:0 2px 8px rgba(220,38,38,0.15)">${BTN.EXPORTAR_PDF}</button>`;
        } else         if (tab === 'permisos') {
            let opts = meses.map((m, i) => '<option value="' + (i + 1) + '"' + (i === mesActual ? ' selected' : '') + '>' + m + '</option>').join('');
            container.innerHTML = '<select id="ast-hero-mes" class="ast-input" style="width:auto;background:rgba(255,255,255,0.3);color:white;border:1px solid rgba(255,255,255,0.5)">' + opts + '</select>'
                + `<button onclick="Asistencia.cargarPermisos()" class="ast-btn" style="background:rgba(255,255,255,0.3);color:white;border:1px solid rgba(255,255,255,0.5);backdrop-filter:blur(8px)">${BTN.FILTRAR}</button>`
                + (canAgT ? `<button onclick="Asistencia.abrirModalPermiso()" class="btn btn-primary" title="${BTN.NUEVO} permiso" style="padding:5px 12px;font-size:12px">${BTN.ICON.NUEVO} ${BTN.NUEVO}</button>` : '');
        } else if (tab === 'licencias') {
            let opts = meses.map((m, i) => '<option value="' + (i + 1) + '"' + (i === mesActual ? ' selected' : '') + '>' + m + '</option>').join('');
            container.innerHTML = '<select id="ast-hero-mes" class="ast-input" style="width:auto;background:rgba(255,255,255,0.3);color:white;border:1px solid rgba(255,255,255,0.5)">' + opts + '</select>'
                + `<button onclick="Asistencia.cargarLicencias()" class="ast-btn" style="background:rgba(255,255,255,0.3);color:white;border:1px solid rgba(255,255,255,0.5);backdrop-filter:blur(8px)">${BTN.FILTRAR}</button>`
                + (canAgT ? `<button onclick="Asistencia.abrirModalLicencia()" class="btn btn-primary" title="${BTN.NUEVO} licencia" style="padding:5px 12px;font-size:12px">${BTN.ICON.NUEVO} ${BTN.NUEVO}</button>` : '');
        } else if (tab === 'vacaciones') {
            let opts = meses.map((m, i) => '<option value="' + (i + 1) + '"' + (i === mesActual ? ' selected' : '') + '>' + m + '</option>').join('');
            container.innerHTML = '<select id="ast-hero-mes" class="ast-input" style="width:auto;background:rgba(255,255,255,0.3);color:white;border:1px solid rgba(255,255,255,0.5)">' + opts + '</select>'
                + `<button onclick="Asistencia.cargarVacaciones()" class="ast-btn" style="background:rgba(255,255,255,0.3);color:white;border:1px solid rgba(255,255,255,0.5);backdrop-filter:blur(8px)">${BTN.FILTRAR}</button>`
                + (canAgT ? `<button onclick="Asistencia.abrirModalVacacion()" class="btn btn-primary" title="${BTN.NUEVO} vacación" style="padding:5px 12px;font-size:12px">${BTN.ICON.NUEVO} ${BTN.NUEVO}</button>` : '');
        } else if (tab === 'horas_extras') {
            let opts = meses.map((m, i) => '<option value="' + (i + 1) + '"' + (i === mesActual ? ' selected' : '') + '>' + m + '</option>').join('');
            container.innerHTML = '<select id="ast-hero-mes" class="ast-input" style="width:auto;background:rgba(255,255,255,0.3);color:white;border:1px solid rgba(255,255,255,0.5)">' + opts + '</select>'
                + `<button onclick="Asistencia.cargarHorasExtras()" class="ast-btn" style="background:rgba(255,255,255,0.3);color:white;border:1px solid rgba(255,255,255,0.5);backdrop-filter:blur(8px)">${BTN.FILTRAR}</button>`
                + (canAgT ? `<button onclick="Asistencia.abrirModalHorasExtras()" class="btn btn-primary" title="${BTN.NUEVO} horas extras" style="padding:5px 12px;font-size:12px">${BTN.ICON.NUEVO} ${BTN.NUEVO}</button>` : '');
        } else if (tab === 'calendario') {
            let mesOpts = meses.map((m, i) => '<option value="' + (i + 1) + '"' + (i === mesActual ? ' selected' : '') + '>' + m + '</option>').join('');
            let yearOpts = '';
            const yearActual = new Date().getFullYear();
            for (let y = 2024; y <= 2027; y++) yearOpts += '<option value="' + y + '"' + (y === yearActual ? ' selected' : '') + '>' + y + '</option>';
            container.innerHTML = '<select id="ast-hero-mes" class="ast-input" style="width:auto;background:rgba(255,255,255,0.3);color:white;border:1px solid rgba(255,255,255,0.5)">' + mesOpts + '</select>'
                + '<select id="ast-hero-anio" class="ast-input" style="width:auto;background:rgba(255,255,255,0.3);color:white;border:1px solid rgba(255,255,255,0.5)">' + yearOpts + '</select>'
                + `<button onclick="Asistencia.cargarCalendario()" class="ast-btn" style="background:rgba(255,255,255,0.95);color:#1e40af;font-weight:700;font-size:11px;padding:6px 14px;border-radius:8px;box-shadow:0 2px 8px rgba(30,64,175,0.15)">${BTN.CARGAR}</button>`;
        } else if (tab === 'reportes') {
            let opts = meses.map((m, i) => '<option value="' + (i + 1) + '"' + (i === mesActual ? ' selected' : '') + '>' + m + '</option>').join('');
            container.innerHTML = '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">'
                + '<select id="ast-hero-mes" class="ast-input" style="width:auto;background:rgba(255,255,255,0.3);color:white;border:1px solid rgba(255,255,255,0.5)">' + opts + '</select>'
                + `<button onclick="Asistencia.cargarReportes()" class="ast-btn" style="background:rgba(255,255,255,0.95);color:#1e40af;font-weight:700;font-size:11px;padding:6px 14px;border-radius:8px;box-shadow:0 2px 8px rgba(30,64,175,0.15)">${BTN.CARGAR}</button>`
                + '</div>'
                + '<div style="position:relative;width:100%;max-width:250px;margin-top:6px">'
                + '<svg style="position:absolute;left:8px;top:50%;transform:translateY(-50%)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
                + '<input type="text" id="ast-rep-buscar" placeholder="Buscar trabajador..." oninput="Asistencia.filtrarReporte()" style="width:100%;padding:6px 8px 6px 28px;font-size:11px;border:1px solid rgba(255,255,255,0.2);border-radius:6px;box-sizing:border-box;background:rgba(255,255,255,0.1);color:white;outline:none" onfocus="this.style.borderColor=\'rgba(255,255,255,0.5)\'" onblur="this.style.borderColor=\'rgba(255,255,255,0.2)\'">'
                + '</div>';
        } else if (tab === 'diaria') {
            container.innerHTML = '<div style="position:relative">'
                + '<svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
                + '<input type="text" id="ast-hero-buscar" class="ast-input" placeholder="Buscar nombre o RUT..." oninput="Asistencia.debouncedBuscarTrabajadores()" style="padding-left:32px;width:100%;min-width:100px;max-width:160px;background:rgba(255,255,255,0.35);color:white;border:1px solid rgba(255,255,255,0.5);font-size:11px">'
                + '</div>'
                + '<input type="date" id="ast-hero-fecha" class="ast-input" style="width:auto;background:rgba(255,255,255,0.3);color:white;border:1px solid rgba(255,255,255,0.5);font-size:11px">'
                + `<button onclick="Asistencia.cargarAsistencia()" class="ast-btn" style="background:rgba(255,255,255,0.95);color:#1e40af;font-weight:700;font-size:11px;padding:6px 14px;border-radius:8px;box-shadow:0 2px 8px rgba(30,64,175,0.15)">${BTN.CARGAR}</button>`;
        } else {
            container.innerHTML = '';
        }
    },

    setHeroDate() {
        const d = new Date();
        const dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
        const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        document.getElementById('ast-hero-date').innerHTML = dias[d.getDay()] + ' ' + d.getDate() + ' de ' + meses[d.getMonth()];
    },

    // ═══════ TRABAJADORES ═══════
    async renderTrabajadoresTab(c) {
        const MOD = 'asistencia';
        const canAgT = canCreate(MOD);
        const canEditT = canEdit(MOD);
        const canDeleteT = canDelete(MOD);
        c.innerHTML = `
            <div id="ast-form-trabajador" style="display:none;background:white;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);padding:20px 24px;margin-bottom:20px;animation:astFadeUp 0.3s ease both;overflow:hidden;width:100%;box-sizing:border-box">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
                    <div style="width:28px;height:28px;border-radius:7px;background:linear-gradient(135deg,#eff6ff,#bfdbfe);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>
                    <h4 id="ast-form-title" style="margin:0;font-size:14px;font-weight:700;color:#1e293b">Nuevo Trabajador</h4>
                </div>
                <div class="ast-form-grid">
                    <div>
                        <label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">RUT</label>
                        <input type="text" id="ast-trab-rut" class="ast-input" placeholder="12.345.678-9" style="width:100%">
                    </div>
                    <div>
                        <label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Nombre Completo</label>
                        <input type="text" id="ast-trab-nombre" class="ast-input" placeholder="Nombre del trabajador" style="width:100%">
                    </div>
                    <div>
                        <label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Telefono (+56 9...)</label>
                        <input type="text" id="ast-trab-telefono" class="ast-input" placeholder="+56 9 1234 5678" style="width:100%" maxlength="15" oninput="Asistencia.formatPhone(this)">
                    </div>
                    <div>
                        <label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Puesto</label>
                        <input type="text" id="ast-trab-puesto" class="ast-input" placeholder="Ej: Instalador" style="width:100%">
                    </div>
                    <div>
                        <label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Fecha de incorporación</label>
                        <input type="date" id="ast-trab-fecha-ingreso" class="ast-input" style="width:100%">
                    </div>
                    <div class="ast-form-actions">
                        <button onclick="Asistencia.guardarTrabajador()" class="btn btn-primary">Guardar</button>
                        <button onclick="Asistencia.hideFormTrabajador()" class="btn btn-outline">Cancelar</button>
                    </div>
                </div>
                <input type="hidden" id="ast-trab-id">
            </div>

            <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:astFadeUp 0.4s ease 120ms both;overflow:hidden">
                <div style="overflow:auto;max-height:65vh">
                <div class="sigma-table-wrap">
                <table style="width:100%;border-collapse:collapse;font-size:13px">
                    <thead style="position:sticky;top:0;z-index:2"><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Trabajador</th>
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">RUT</th>
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Telefono</th>
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Puesto</th>
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Estado</th>
                        <th style="padding:11px 16px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px" title="Fecha de incorporación">Fecha de incorporación</th>
                        <th style="padding:11px 16px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Acciones</th>
                    </tr></thead>
                    <tbody id="ast-tabla-trabajadores"><tr><td colspan="7" style="text-align:center;padding:32px;color:#94a3b8">${MSG.CARGANDO}</td></tr></tbody>
                </table>
                <div id="ast-cards-trabajadores"></div>
                </div>
                </div>
            </div>`;

        this.trabFilter = 'todos';
        await this.cargarTodosTrabajadores();
    },

    trabFilter: 'todos',
    todosTrabajadores: [],

    async cargarTodosTrabajadores() {
        try {
            console.log('[AST] Cargando todos los trabajadores...');
            const r = await authFetch('/api/asistencia/trabajadores');
            console.log('[AST] Response status:', r.status);
            if (!r.ok) { console.error('[AST] Error HTTP:', r.status); return; }
            this.todosTrabajadores = await r.json();
            console.log('[AST] Todos trabajadores cargados:', this.todosTrabajadores.length);
            this.renderTablaTrabajadores();
        } catch(e) { console.error('[AST] Error cargando todos trabajadores:', e); }
    },

    renderTablaTrabajadores() {
        const tbody = document.getElementById('ast-tabla-trabajadores');
        if (!tbody) return;
        let data = this.todosTrabajadores;
        const busqueda = (document.getElementById('ast-hero-buscar')?.value || '').toLowerCase();
        if (busqueda) data = data.filter(t => t.nombre.toLowerCase().includes(busqueda) || t.rut.toLowerCase().includes(busqueda));
        if (this.trabFilter === 'activos') data = data.filter(t => t.activo);
        else if (this.trabFilter === 'inactivos') data = data.filter(t => !t.activo);

        const perms = this._getPerms();
        if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:#94a3b8">${MSG.SIN_DATOS}</td></tr>`;
            const cardsEl = document.getElementById('ast-cards-trabajadores');
            if (cardsEl) cardsEl.innerHTML = '';
            return;
        }

        const colors = ['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#06b6d4','#ef4444','#6366f1'];
        tbody.innerHTML = data.map((t, i) => {
            const ini = t.nombre.split(' ').map(n => n[0]).join('').slice(0, 2);
            const bg = colors[i % colors.length];
            const fi = (t.fecha_ingreso || (t.created_at ? t.created_at.split('T')[0] : '')).split('T')[0];
            const fiFmt = fi ? this.fmtDate(fi) : '-';
            return '<tr style="border-bottom:1px solid #f1f5f9' + (t.activo ? '' : ';opacity:0.55') + '">'
                + '<td style="padding:12px 16px"><div style="display:flex;align-items:center;gap:10px"><div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,' + bg + ',' + bg + 'dd);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:700">' + ini + '</div><strong style="color:#1e293b">' + t.nombre + '</strong></div></td>'
                + '<td style="padding:12px 16px;color:#475569;font-size:12px">' + t.rut + '</td>'
                + '<td style="padding:12px 16px;color:#475569;font-size:12px">' + (t.telefono || '-') + '</td>'
                + '<td style="padding:12px 16px;color:#475569;font-size:12px">' + (t.puesto || '-') + '</td>'
                + '<td style="padding:12px 16px"><span class="ast-badge" style="' + (t.activo ? 'background:#d1fae5;color:#059669' : 'background:#fee2e2;color:#dc2626') + '">' + (t.activo ? 'Activo' : 'Inactivo') + '</span></td>'
                + '<td style="padding:12px 16px;text-align:center;font-size:12px;color:#475569;font-family:\'JetBrains Mono\',monospace" title="Fecha de incorporación">' + fiFmt + '</td>'
                + '<td style="padding:12px 16px;text-align:center"><div style="display:flex;gap:4px;justify-content:center">'
                + (perms.canEdit ? `<button onclick="Asistencia.editarTrabajador(${t.id})" class="btn btn-sm btn-outline" title="${BTN.EDITAR}">${BTN.ICON.EDITAR}</button>` : '')
                + (perms.canEdit ? `<button onclick="Asistencia.toggleTrabajador(${t.id},${t.activo})" class="btn btn-sm ${t.activo ? 'btn-outline' : 'btn-primary'}" title="${t.activo ? BTN.DESACTIVAR : BTN.ACTIVAR}">${t.activo ? BTN.DESACTIVAR : BTN.ACTIVAR}</button>` : '')
                + (perms.canDelete ? `<button onclick="Asistencia.eliminarTrabajador(${t.id},'${t.nombre.replace(/'/g, "\\'")}')" class="btn btn-sm btn-danger" title="${BTN.ELIMINAR}">${BTN.ICON.ELIMINAR}</button>` : '')
                + '</div></td></tr>';
        }).join('');

        const cardsEl = document.getElementById('ast-cards-trabajadores');
        if (cardsEl) {
            cardsEl.innerHTML = SigmaCards.generate({
                title: t => '<strong>' + t.nombre + '</strong>',
                subtitle: t => t.rut,
                badge: t => '<span class="sc-badge" style="background:' + (t.activo ? '#d1fae5;color:#059669' : '#fee2e2;color:#dc2626') + '">' + (t.activo ? 'Activo' : 'Inactivo') + '</span>',
                fields: [
                    { label: 'Telefono', value: t => t.telefono || '-' },
                    { label: 'Puesto', value: t => t.puesto || '-' },
                    { label: 'Ingreso', value: t => { const fi = (t.fecha_ingreso || (t.created_at ? t.created_at.split('T')[0] : '')).split('T')[0]; return fi ? this.fmtDate(fi) : '-'; } }
                ],
                actions: t => (perms.canEdit ? `<button onclick="Asistencia.editarTrabajador(${t.id})" class="btn btn-sm btn-outline">${BTN.EDITAR}</button> ` : '')
                    + (perms.canEdit ? `<button onclick="Asistencia.toggleTrabajador(${t.id},${t.activo})" class="btn btn-sm ${t.activo ? 'btn-outline' : 'btn-primary'}">${t.activo ? BTN.DESACTIVAR : BTN.ACTIVAR}</button>` : '')
            }, data);
        }
    },

    filtrarTrabajadores(filtro) {
        this.trabFilter = filtro;
        document.querySelectorAll('.ast-hero-trab-filter').forEach(b => {
            b.style.background = 'rgba(255,255,255,0.15)';
            b.style.color = 'rgba(255,255,255,0.8)';
            b.style.border = '1px solid rgba(255,255,255,0.2)';
        });
        const active = document.querySelector('[data-filter="' + filtro + '"]');
        if (active) {
            active.style.background = 'rgba(255,255,255,0.3)';
            active.style.color = 'white';
            active.style.border = '1px solid rgba(255,255,255,0.4)';
        }
        this.renderTablaTrabajadores();
    },

    buscarTrabajadoresAdmin() {
        this.renderTablaTrabajadores();
    },

    showFormTrabajador(id) {
        document.getElementById('ast-form-trabajador').style.display = 'block';
        document.getElementById('ast-trab-id').value = '';
        document.getElementById('ast-trab-rut').value = '';
        document.getElementById('ast-trab-nombre').value = '';
        document.getElementById('ast-trab-telefono').value = '';
        document.getElementById('ast-trab-puesto').value = '';
        document.getElementById('ast-trab-fecha-ingreso').value = new Date().toISOString().split('T')[0];
        document.getElementById('ast-form-title').textContent = 'Nuevo Trabajador';
    },

    hideFormTrabajador() {
        document.getElementById('ast-form-trabajador').style.display = 'none';
    },

    editarTrabajador(id) {
        const t = this.todosTrabajadores.find(w => w.id === id);
        if (!t) return;
        document.getElementById('ast-form-trabajador').style.display = 'block';
        document.getElementById('ast-trab-id').value = t.id;
        document.getElementById('ast-trab-rut').value = t.rut;
        document.getElementById('ast-trab-nombre').value = t.nombre;
        document.getElementById('ast-trab-telefono').value = t.telefono || '';
        document.getElementById('ast-trab-puesto').value = t.puesto || '';
        const fi = t.fecha_ingreso ? t.fecha_ingreso.split('T')[0] : (t.created_at ? t.created_at.split('T')[0] : new Date().toISOString().split('T')[0]);
        document.getElementById('ast-trab-fecha-ingreso').value = fi;
        document.getElementById('ast-form-title').textContent = 'Editar Trabajador';
    },

    async guardarTrabajador() {
        const id = document.getElementById('ast-trab-id').value;
        const rut = document.getElementById('ast-trab-rut').value.trim();
        const nombre = document.getElementById('ast-trab-nombre').value.trim();
        const telefono = document.getElementById('ast-trab-telefono').value.trim();
        const puesto = document.getElementById('ast-trab-puesto').value.trim();
        const fecha_ingreso = document.getElementById('ast-trab-fecha-ingreso').value || null;
        if (!rut || !nombre) return;

        if (id) {
            await authFetch('/api/asistencia/trabajadores/' + id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rut, nombre, fecha_ingreso, telefono, puesto })
            });
        } else {
            await authFetch('/api/asistencia/trabajadores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rut, nombre, fecha_ingreso, telefono, puesto })
            });
        }
        this.hideFormTrabajador();
        await this.cargarTodosTrabajadores();
        this.llenarSelectores();
    },

    async toggleTrabajador(id, activo) {
        await authFetch('/api/asistencia/trabajadores/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activo: !activo })
        });
        await this.cargarTodosTrabajadores();
        this.llenarSelectores();
    },

    async eliminarTrabajador(id, nombre) {
        if (!confirm(MSG.CONFIRMAR_ELIMINAR_NOMBRE(nombre))) return;
        try {
            const r = await authFetch('/api/asistencia/trabajadores/' + id, { method: 'DELETE' });
            if (!r.ok) {
                const err = await r.json().catch(() => ({}));
                throw new Error(err.error || 'Error al eliminar');
            }
            await this.cargarTodosTrabajadores();
            await this.cargarTrabajadores();
            this.llenarSelectores();
        } catch (e) {
            console.error('Error eliminando trabajador:', e);
            alert('Error al eliminar: ' + e.message);
        }
    },

    // ═══════ ASISTENCIA DIARIA ═══════
    async renderDiaria(c) {
        c.innerHTML = `
            <div style="display:flex;gap:8px;margin-bottom:12px;max-width:100%;overflow-x:auto;padding-bottom:4px">
                <div class="ast-card" style="background:white;border:1px solid #e2e8f0;border-left:4px solid #22c55e;border-radius:10px;padding:8px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:astFadeUp 0.4s ease 0ms both;min-width:120px;flex:1 0 0;display:flex;align-items:center;gap:8px">
                    <div style="width:30px;height:30px;border-radius:6px;background:linear-gradient(135deg,#f0fdf4,#bbf7d0);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>
                    <div><div id="ast-stat-presentes" style="font-size:18px;font-weight:800;color:#059669;line-height:1">0</div><div style="font-size:9px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Presentes</div></div>
                </div>
                <div class="ast-card" style="background:white;border:1px solid #e2e8f0;border-left:4px solid #ef4444;border-radius:10px;padding:8px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:astFadeUp 0.4s ease 60ms both;min-width:120px;flex:1 0 0;display:flex;align-items:center;gap:8px">
                    <div style="width:30px;height:30px;border-radius:6px;background:linear-gradient(135deg,#fef2f2,#fecaca);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>
                    <div><div id="ast-stat-faltas" style="font-size:18px;font-weight:800;color:#dc2626;line-height:1">0</div><div style="font-size:9px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Faltas</div></div>
                </div>
                <div class="ast-card" style="background:white;border:1px solid #e2e8f0;border-left:4px solid #3b82f6;border-radius:10px;padding:8px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:astFadeUp 0.4s ease 120ms both;min-width:120px;flex:1 0 0;display:flex;align-items:center;gap:8px">
                    <div style="width:30px;height:30px;border-radius:6px;background:linear-gradient(135deg,#eff6ff,#bfdbfe);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
                    <div><div id="ast-stat-total" style="font-size:18px;font-weight:800;color:#1e293b;line-height:1">0</div><div style="font-size:9px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Total</div></div>
                </div>
            </div>

            <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);margin-bottom:20px;animation:astFadeUp 0.4s ease 180ms both">
                <div id="ast-trabajadores" style="max-height:500px;overflow-y:auto"></div>
            </div>

            <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:astFadeUp 0.4s ease 240ms both">
                <div style="padding:10px 14px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between">
                    <div style="display:flex;align-items:center;gap:8px">
                        <div style="width:26px;height:26px;border-radius:6px;background:linear-gradient(135deg,#fef2f2,#fecaca);display:flex;align-items:center;justify-content:center"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>
                        <div><h3 style="margin:0;font-size:12px;font-weight:700;color:#1e293b">Faltas del Día</h3></div>
                    </div>
                    <span id="ast-badge-faltas" style="background:#fee2e2;color:#dc2626;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700">0 faltas</span>
                </div>
                <div style="overflow-x:auto">
                    <div class="sigma-table-wrap">
                    <table style="width:100%;border-collapse:collapse;font-size:13px">
                        <thead><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">
                            <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Trabajador</th>
                            <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">RUT</th>
                            <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Estado</th>
                            <th style="padding:11px 16px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Acción</th>
                        </tr></thead>
                        <tbody id="ast-tabla-faltas"><tr><td colspan="4" style="text-align:center;padding:32px;color:#94a3b8;font-size:13px">Cargando datos...</td></tr></tbody>
                    </table>
                    <div id="ast-cards-faltas"></div>
                    </div>
                </div>
            </div>`;

        document.getElementById('ast-hero-fecha').value = new Date().toISOString().split('T')[0];
        document.getElementById('ast-hero-fecha').addEventListener('change', () => { this.lastLoadedDate = null; });
        await this.cargarTrabajadores();
        await this.cargarAsistencia();
    },

    async cargarTrabajadores() {
        try {
            console.log('[AST] Cargando trabajadores...');
            const r = await authFetch('/api/asistencia/trabajadores/activos');
            console.log('[AST] Response status:', r.status);
            if (!r.ok) { console.error('[AST] Error HTTP:', r.status); return; }
            this.trabajadores = await r.json();
            console.log('[AST] Trabajadores cargados:', this.trabajadores.length);
            this.renderTrabajadores();
            this.llenarSelectores();
        } catch(e) { console.error('[AST] Error cargando trabajadores:', e); }
    },

    renderTrabajadores() {
        const c = document.getElementById('ast-trabajadores');
        if (!c) return;
        const busqueda = (document.getElementById('ast-hero-buscar')?.value || '').toLowerCase();
        const filtrados = this.trabajadores.filter(t => !busqueda || t.nombre.toLowerCase().includes(busqueda) || t.rut.toLowerCase().includes(busqueda));
        const fechaVista = document.getElementById('ast-hero-fecha')?.value || new Date().toISOString().split('T')[0];
        c.innerHTML = filtrados.map((t, i) => {
            const falta = this.asistenciaHoy.find(a => a.trabajador_id === t.id);
            const ini = t.nombre.split(' ').map(n => n[0]).join('').slice(0, 2);
            const colors = ['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#06b6d4','#ef4444','#6366f1'];
            const bg = colors[i % colors.length];
            const fi = (t.fecha_ingreso || (t.created_at ? t.created_at.split('T')[0] : '')).split('T')[0];
            const creadoDespues = fi && fechaVista < fi;
            let estadoHtml;
            if (creadoDespues) {
                estadoHtml = '<span class="ast-badge" style="background:#f1f5f9;color:#94a3b8;font-size:10px;padding:2px 8px" title="Fecha de incorporación: ' + this.fmtDate(fi) + '">N/A</span>';
            } else if (falta) {
                estadoHtml = '<span class="ast-badge" style="background:#fee2e2;color:#dc2626;font-size:10px;padding:2px 8px">Falta</span><button onclick="Asistencia.marcar(' + t.id + ',false)" class="btn btn-sm" title="Corregir a presente" style="background:#22c55e;color:white">Corregir</button>';
            } else {
                estadoHtml = '<span class="ast-badge" style="background:#d1fae5;color:#059669;font-size:10px;padding:2px 8px">Presente</span><button onclick="Asistencia.marcar(' + t.id + ',true)" class="btn btn-sm btn-danger" title="Marcar falta">Marcar Falta</button>';
            }
            return `<div class="ast-worker">
                <div class="ast-avatar" style="background:linear-gradient(135deg,${bg},${bg}dd)">${ini}</div>
                <div style="flex:1;min-width:0">
                    <div style="font-size:13px;font-weight:600;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.nombre}</div>
                    <div style="font-size:11px;color:#94a3b8;margin-top:1px">${t.rut}${fi ? ' · Ingreso: ' + this.fmtDate(fi) : ''}</div>
                </div>
                <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">${estadoHtml}</div>
            </div>`;
        }).join('');
    },

    buscarTrabajadores() {
        this.renderTrabajadores();
    },

    async marcar(trabajadorId, falta) {
        try {
            const fecha = document.getElementById('ast-hero-fecha')?.value || new Date().toISOString().split('T')[0];
            const r = await authFetch('/api/asistencia/marcar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trabajador_id: trabajadorId, falta, fecha })
            });
            if (r.ok) {
                this.lastLoadedDate = null;
                await this.cargarAsistencia();
            }
        } catch(e) { console.error('Error:', e); }
    },

    async cargarAsistencia() {
        const fecha = document.getElementById('ast-hero-fecha')?.value;
        if (!fecha) return;
        if (this.lastLoadedDate === fecha && this.asistenciaHoy.length > 0) {
            return;
        }
        try {
            console.log('[AST] Cargando asistencia para:', fecha);
            const r = await authFetch('/api/asistencia/diaria?fecha=' + fecha);
            console.log('[AST] Response status:', r.status);
            if (!r.ok) { console.error('[AST] Error HTTP:', r.status); return; }
            this.asistenciaHoy = await r.json();
            console.log('[AST] Asistencia cargada:', this.asistenciaHoy.length, 'registros');
            this.lastLoadedDate = fecha;
            this.renderTrabajadores();
            this.renderTablaFaltas();
            this.actualizarStats();
        } catch(e) { console.error('[AST] Error cargando asistencia:', e); }
    },

    exportExcelTrabajadores() {
        const trabajadores = this.trabajadoresAdmin || this.trabajadores || [];
        let csv = 'Nombre,RUT,Telefono,Puesto,Estado,Fecha de incorporación\n';
        trabajadores.forEach(t => {
            const fi = (t.fecha_ingreso || (t.created_at ? t.created_at.split('T')[0] : '')).split('T')[0];
            csv += `"${t.nombre}","${t.rut || ''}","${t.telefono || ''}","${t.puesto || ''}","${t.activo ? 'Activo' : 'Inactivo'}","${fi || ''}"\n`;
        });
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'trabajadores_' + new Date().toISOString().split('T')[0] + '.csv';
        link.click();
    },

    exportPDFTrabajadores() {
        const trabajadores = this.trabajadoresAdmin || this.trabajadores || [];
        const total = trabajadores.length;
        const activos = trabajadores.filter(t => t.activo).length;
        const inactivos = total - activos;
        let html = '<html><head><style>body{font-family:Arial,sans-serif;padding:20px}h1{font-size:18px;color:#0f172a}table{width:100%;border-collapse:collapse;margin-top:15px}th,td{border:1px solid #e2e8f0;padding:8px;text-align:left;font-size:12px}th{background:#f8fafc;font-weight:700;color:#64748b}.activo{color:#22c55e;font-weight:700}.inactivo{color:#dc2626}.stats{margin:15px 0;display:flex;gap:20px}.stat{padding:10px 15px;border-radius:8px;background:#f8fafc}</style></head><body>';
        html += '<h1>Listado de Trabajadores</h1>';
        html += '<div class="stats"><div class="stat"><strong>Total:</strong> ' + total + '</div><div class="stat"><strong>Activos:</strong> ' + activos + '</div><div class="stat"><strong>Inactivos:</strong> ' + inactivos + '</div></div>';
        html += '<table><thead><tr><th>Nombre</th><th>RUT</th><th>Telefono</th><th>Puesto</th><th>Estado</th><th>Fecha de incorporación</th></tr></thead><tbody>';
        trabajadores.forEach(t => {
            const fi = (t.fecha_ingreso || (t.created_at ? t.created_at.split('T')[0] : '')).split('T')[0];
            html += '<tr><td>' + t.nombre + '</td><td>' + (t.rut || '') + '</td><td>' + (t.telefono || '-') + '</td><td>' + (t.puesto || '-') + '</td><td class="' + (t.activo ? 'activo' : 'inactivo') + '">' + (t.activo ? 'Activo' : 'Inactivo') + '</td><td>' + (fi ? this.fmtDate(fi) : '-') + '</td></tr>';
        });
        html += '</tbody></table></body></html>';
        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        setTimeout(() => { win.print(); }, 500);
    },

    importarExcelTrabajadores() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv';
        input.onchange = (e) => this._procesarImportacionExcel(e.target.files[0]);
        input.click();
    },

    async _procesarImportacionExcel(file) {
        if (!file) return;
        try {
            const text = await file.text();
            const lines = text.split(/\r?\n/).filter(l => l.trim());
            if (lines.length < 2) { alert('El archivo está vacío o no tiene datos.'); return; }

            const firstLine = lines[0].toLowerCase();
            const hasHeader = firstLine.includes('rut') || firstLine.includes('nombre') || firstLine.includes('fecha');
            const dataLines = hasHeader ? lines.slice(1) : lines;

            const delimiter = lines[0].includes(';') ? ';' : ',';
            const rows = dataLines.map(l => this._parseCSVLine(l, delimiter));

            let rutIdx = 0, nombreIdx = 1, fechaIdx = 2;
            if (hasHeader) {
                const headers = this._parseCSVLine(lines[0], delimiter).map(h => h.toLowerCase().trim());
                rutIdx = headers.findIndex(h => h.includes('rut'));
                nombreIdx = headers.findIndex(h => h.includes('nombre'));
                fechaIdx = headers.findIndex(h => h.includes('fecha') || h.includes('ingreso') || h.includes('incorporaci'));
                if (rutIdx < 0) rutIdx = 0;
                if (nombreIdx < 0) nombreIdx = 1;
                if (fechaIdx < 0) fechaIdx = 2;
            }

            const fechaPorDefecto = new Date().toISOString().split('T')[0];
            const trabajadores = rows.map(cols => {
                const rut = (cols[rutIdx] || '').trim().replace(/['"]/g, '');
                const nombre = (cols[nombreIdx] || '').trim().replace(/['"]/g, '');
                let fecha = (cols[fechaIdx] || '').trim();
                if (!fecha) fecha = fechaPorDefecto;
                else if (fecha.includes('/')) {
                    const p = fecha.split('/');
                    if (p.length === 3) fecha = p[2].length === 2 ? '20' + p[2] + '-' + p[1].padStart(2, '0') + '-' + p[0].padStart(2, '0') : p[2] + '-' + p[1].padStart(2, '0') + '-' + p[0].padStart(2, '0');
                }
                return { rut, nombre, fecha_ingreso: fecha };
            }).filter(t => t.rut && t.nombre);

            if (trabajadores.length === 0) { alert('No se encontraron filas válidas (RUT y Nombre requeridos).'); return; }

            const confirmar = confirm('Se importarán ' + trabajadores.length + ' trabajadores.\n\n¿Continuar?');
            if (!confirmar) return;

            const r = await authFetch('/api/asistencia/trabajadores/importar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trabajadores })
            });
            const result = await r.json();
            if (!r.ok) throw new Error(result.error || 'Error en la importación');

            await this.cargarTodosTrabajadores();
            await this.cargarTrabajadores();
            this.llenarSelectores();
            alert('Importación completada:\n• ' + result.insertados + ' insertados\n• ' + result.actualizados + ' actualizados\n• ' + result.errores + ' errores');
        } catch (e) {
            console.error('Error importando:', e);
            alert('Error al importar: ' + e.message);
        }
    },

    _parseCSVLine(line, delimiter) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"' && (i === 0 || line[i-1] !== '\\')) {
                inQuotes = !inQuotes;
            } else if (c === delimiter && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += c;
            }
        }
        result.push(current);
        return result;
    },

    exportExcel() {
        const fecha = document.getElementById('ast-hero-fecha')?.value || new Date().toISOString().split('T')[0];
        const faltas = this.asistenciaHoy || [];
        const trabajadores = this.trabajadores || [];
        let csv = 'Trabajador,RUT,Estado\n';
        trabajadores.forEach(t => {
            const tieneFalta = faltas.some(f => f.trabajador_id === t.id);
            csv += `"${t.nombre}","${t.rut || ''}","${tieneFalta ? 'Falta' : 'Presente'}"\n`;
        });
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'asistencia_' + fecha + '.csv';
        link.click();
    },

    exportPDF() {
        const fecha = document.getElementById('ast-hero-fecha')?.value || new Date().toISOString().split('T')[0];
        const faltas = this.asistenciaHoy || [];
        const trabajadores = this.trabajadores || [];
        const total = trabajadores.length;
        const totalFaltas = faltas.length;
        const totalPresentes = total - totalFaltas;
        let html = '<html><head><style>body{font-family:Arial,sans-serif;padding:20px}h1{font-size:18px;color:#0f172a}table{width:100%;border-collapse:collapse;margin-top:15px}th,td{border:1px solid #e2e8f0;padding:8px;text-align:left;font-size:12px}th{background:#f8fafc;font-weight:700;color:#64748b}.falta{color:#dc2626;font-weight:700}.presente{color:#22c55e}.stats{margin:15px 0;display:flex;gap:20px}.stat{padding:10px 15px;border-radius:8px;background:#f8fafc}</style></head><body>';
        html += '<h1>Control de Asistencia - ' + fecha + '</h1>';
        html += '<div class="stats"><div class="stat"><strong>Total:</strong> ' + total + '</div><div class="stat"><strong>Presentes:</strong> ' + totalPresentes + '</div><div class="stat"><strong>Faltas:</strong> ' + totalFaltas + '</div></div>';
        html += '<table><thead><tr><th>Trabajador</th><th>RUT</th><th>Estado</th></tr></thead><tbody>';
        trabajadores.forEach(t => {
            const tieneFalta = faltas.some(f => f.trabajador_id === t.id);
            html += '<tr><td>' + t.nombre + '</td><td>' + (t.rut || '') + '</td><td class="' + (tieneFalta ? 'falta' : 'presente') + '">' + (tieneFalta ? 'Falta' : 'Presente') + '</td></tr>';
        });
        html += '</tbody></table></body></html>';
        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        setTimeout(() => { win.print(); }, 500);
    },

    renderTablaFaltas() {
        const tbody = document.getElementById('ast-tabla-faltas');
        const badge = document.getElementById('ast-badge-faltas');
        if (!tbody) return;
        const f = this.asistenciaHoy;
        if (badge) badge.textContent = f.length + ' faltas';
        if (f.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:32px;color:#22c55e;font-size:13px;font-weight:600">Todos presentes hoy</td></tr>';
            const cardsEl = document.getElementById('ast-cards-faltas');
            if (cardsEl) cardsEl.innerHTML = '';
            return;
        }
        const fechaVista = document.getElementById('ast-hero-fecha')?.value || new Date().toISOString().split('T')[0];
        tbody.innerHTML = f.map(a => {
            const fi = (a.fecha_ingreso || (a.created_at ? a.created_at.split('T')[0] : '')).split('T')[0];
            const creadoDespues = fi && fechaVista < fi;
            const badge = creadoDespues
                ? '<span class="ast-badge" style="background:#f1f5f9;color:#94a3b8" title="Fecha de incorporación: ' + this.fmtDate(fi) + '">N/A</span>'
                : '<span class="ast-badge" style="background:#fee2e2;color:#dc2626">Falta</span>';
            const accion = creadoDespues ? '' : '<button onclick="Asistencia.marcar(' + a.trabajador_id + ',false)" class="btn btn-sm" title="Corregir a presente" style="background:#22c55e;color:white">Corregir</button>';
            return '<tr style="border-bottom:1px solid #f1f5f9' + (creadoDespues ? ';opacity:0.55' : '') + '">'
                + '<td style="padding:12px 16px"><strong style="color:#1e293b">' + a.nombre + '</strong></td>'
                + '<td style="padding:12px 16px;color:#64748b;font-size:12px">' + a.rut + '</td>'
                + '<td style="padding:12px 16px">' + badge + '</td>'
                + '<td style="padding:12px 16px;text-align:center">' + accion + '</td>'
                + '</tr>';
        }).join('');

        const cardsEl = document.getElementById('ast-cards-faltas');
        if (cardsEl) {
            cardsEl.innerHTML = SigmaCards.generate({
                title: a => '<strong>' + a.nombre + '</strong>',
                subtitle: a => a.rut,
                badge: a => {
                    const fi = (a.fecha_ingreso || (a.created_at ? a.created_at.split('T')[0] : '')).split('T')[0];
                    const creadoDespues = fi && fechaVista < fi;
                    return creadoDespues
                        ? '<span class="sc-badge" style="background:#f1f5f9;color:#94a3b8">N/A</span>'
                        : '<span class="sc-badge" style="background:#fee2e2;color:#dc2626">Falta</span>';
                },
                fields: [],
                actions: a => {
                    const fi = (a.fecha_ingreso || (a.created_at ? a.created_at.split('T')[0] : '')).split('T')[0];
                    const creadoDespues = fi && fechaVista < fi;
                    return creadoDespues ? '' : '<button onclick="Asistencia.marcar(' + a.trabajador_id + ',false)" class="btn btn-sm" style="background:#22c55e;color:white">Corregir</button>';
                }
            }, f);
        }
    },

    actualizarStats() {
        const total = this.trabajadores.length;
        const faltas = this.asistenciaHoy.length;
        const p = document.getElementById('ast-stat-presentes');
        const f = document.getElementById('ast-stat-faltas');
        const t = document.getElementById('ast-stat-total');
        if (p) p.textContent = total - faltas;
        if (f) f.textContent = faltas;
        if (t) t.textContent = total;
    },

    // ═══════ CALENDARIO ═══════
    renderCalendarioTab(c) {
        c.innerHTML = `
            <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:astFadeUp 0.4s ease 0ms both;display:flex;flex-direction:column;height:750px">
                <div style="padding:10px 22px;display:flex;gap:16px;flex-wrap:wrap;border-bottom:1px solid #f1f5f9;align-items:center;flex-shrink:0">
                    <div style="display:flex;align-items:center;gap:6px"><div style="width:12px;height:12px;border-radius:3px;background:#d1fae5"></div><span style="font-size:11px;color:#64748b;font-weight:500">Presente</span></div>
                    <div style="display:flex;align-items:center;gap:6px"><div style="width:12px;height:12px;border-radius:3px;background:#fee2e2"></div><span style="font-size:11px;color:#64748b;font-weight:500">Falta</span></div>
                    <div style="display:flex;align-items:center;gap:6px"><div style="width:12px;height:12px;border-radius:3px;background:#dbeafe"></div><span style="font-size:11px;color:#64748b;font-weight:500">Vacaciones</span></div>
                    <div style="display:flex;align-items:center;gap:6px"><div style="width:12px;height:12px;border-radius:3px;background:#fef3c7"></div><span style="font-size:11px;color:#64748b;font-weight:500">Licencia</span></div>
                    <div style="display:flex;align-items:center;gap:6px"><div style="width:12px;height:12px;border-radius:3px;background:#fafbfc;border:1px solid #e2e8f0"></div><span style="font-size:11px;color:#64748b;font-weight:500">Antes de ingreso</span></div>
                    <div style="margin-left:auto;position:relative">
                        <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" id="ast-cal-buscar" class="ast-input" placeholder="Buscar trabajador..." oninput="Asistencia.debouncedFiltrarCalendario()" style="padding-left:32px;width:100%;min-width:120px;max-width:180px;font-size:11px">
                    </div>
                </div>
                <div style="flex:1;overflow:auto;min-height:0"><div id="ast-calendario"></div></div>
            </div>`;
        this.cargarCalendario();
    },

    calendarioData: null,

    async cargarCalendario() {
        const mes = document.getElementById('ast-hero-mes')?.value;
        const anio = document.getElementById('ast-hero-anio')?.value;
        if (!mes || !anio) return;
        try {
            const r = await authFetch('/api/asistencia/calendario?mes=' + mes + '&anio=' + anio);
            this.calendarioData = await r.json();
            if (this.calendarioData) this.renderCalendarioGrid(this.calendarioData);
        } catch(e) { console.error('Error:', e); }
    },

    filtrarCalendario() {
        if (this.calendarioData) this.renderCalendarioGrid(this.calendarioData);
    },

    renderCalendarioGrid(data) {
        const c = document.getElementById('ast-calendario');
        if (!c) return;
        const { trabajadores, faltas, vacaciones, licencias, mes, anio } = data;
        const diasEnMes = new Date(anio, mes, 0).getDate();
        const hoy = new Date();
        const diasSemana = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
        const busqueda = (document.getElementById('ast-cal-buscar')?.value || '').toLowerCase();
        const filtered = busqueda ? trabajadores.filter(t => t.nombre.toLowerCase().includes(busqueda) || (t.rut && t.rut.toLowerCase().includes(busqueda))) : trabajadores;

        let html = '<div class="ast-cal-scroll">';
        
        // Encabezado
        html += '<div style="display:grid;grid-template-columns:140px repeat(' + diasEnMes + ',minmax(36px,1fr));min-width:' + (140 + diasEnMes * 36) + 'px">';
        html += '<div class="ast-cal-sticky-col" style="padding:8px 12px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;background:white">Trabajador</div>';
        for (let d = 1; d <= diasEnMes; d++) {
            const fecha = new Date(anio, mes - 1, d);
            const esFin = fecha.getDay() === 0 || fecha.getDay() === 6;
            const esHoy = d === hoy.getDate() && mes === (hoy.getMonth() + 1) && parseInt(anio) === hoy.getFullYear();
            html += '<div class="ast-cal-cell' + (esFin ? ' fin-semana' : '') + (esHoy ? ' hoy' : '') + '"><div class="ast-cal-day-num">' + d + '</div><div class="ast-cal-day-name">' + diasSemana[fecha.getDay()] + '</div></div>';
        }
        html += '</div>';
        
        // Filas de trabajadores
        filtered.forEach(t => {
            const fi = (t.fecha_ingreso || (t.created_at ? t.created_at.split('T')[0] : '')).split('T')[0];
            html += '<div style="display:grid;grid-template-columns:140px repeat(' + diasEnMes + ',minmax(36px,1fr));min-width:' + (140 + diasEnMes * 36) + 'px;border-top:1px solid #f1f5f9">';
            html += '<div class="ast-cal-sticky-col" style="padding:6px 10px;font-size:11px;font-weight:600;color:#1e293b;display:flex;align-items:center;background:white"><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + t.nombre + (fi ? ' (Fecha de incorporación: ' + this.fmtDate(fi) + ')' : '') + '">' + t.nombre + '</span></div>';

            for (let d = 1; d <= diasEnMes; d++) {
                const fechaStr = anio + '-' + String(mes).padStart(2, '0') + '-' + String(d).padStart(2, '0');
                const fecha = new Date(anio, mes - 1, d);
                const esFin = fecha.getDay() === 0 || fecha.getDay() === 6;
                const antesDeIngreso = fi && fechaStr < fi;
                let clase = esFin ? 'fin-semana' : '';
                let title = '';
                if (antesDeIngreso) {
                    clase = 'antes-ingreso';
                    title = 'Fecha de incorporación: ' + this.fmtDate(fi);
                } else if (!esFin) {
                    if (vacaciones.some(v => {
                        const iniParts = v.fecha_inicio.split('T')[0].split('-');
                        const finParts = v.fecha_fin.split('T')[0].split('-');
                        const ini = new Date(parseInt(iniParts[0]), parseInt(iniParts[1]) - 1, parseInt(iniParts[2]));
                        const fin = new Date(parseInt(finParts[0]), parseInt(finParts[1]) - 1, parseInt(finParts[2]));
                        return v.trabajador_id === t.id && ini <= fecha && fin >= fecha;
                    })) { clase = 'vacaciones'; title = 'Vacaciones'; }
                    else if (licencias.some(l => {
                        const iniParts = l.fecha_inicio.split('T')[0].split('-');
                        const finParts = l.fecha_fin.split('T')[0].split('-');
                        const ini = new Date(parseInt(iniParts[0]), parseInt(iniParts[1]) - 1, parseInt(iniParts[2]));
                        const fin = new Date(parseInt(finParts[0]), parseInt(finParts[1]) - 1, parseInt(finParts[2]));
                        return l.trabajador_id === t.id && ini <= fecha && fin >= fecha;
                    })) { clase = 'licencia'; title = 'Licencia'; }
                    else if (faltas.some(f => f.trabajador_id === t.id && String(f.fecha).split('T')[0] === fechaStr)) { clase = 'falta'; title = 'Falta'; }
                    else if (d <= hoy.getDate() && mes <= (hoy.getMonth() + 1) && parseInt(anio) <= hoy.getFullYear()) { clase = 'presente'; title = 'Presente'; }
                }
                let symbol = '';
                if (clase === 'presente') symbol = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
                else if (clase === 'falta') symbol = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="3"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>';
                else if (clase === 'vacaciones') symbol = '<span style="color:#2563eb;font-weight:700;font-size:12px">V</span>';
                else if (clase === 'licencia') symbol = '<span style="color:#ca8a04;font-weight:700;font-size:12px">L</span>';
                else if (clase === 'antes-ingreso') symbol = '<span style="color:#cbd5e1;font-size:10px">·</span>';
                html += '<div class="ast-cal-cell ' + clase + '" title="' + title + '" style="border-right:1px solid #f1f5f9;cursor:default;display:flex;align-items:center;justify-content:center' + (clase === 'antes-ingreso' ? ';background:#fafbfc' : '') + '">' + symbol + '</div>';
            }
            html += '</div>';
        });
        html += '</div>';
        c.innerHTML = html;
    },

    // ═══════ PERMISOS ═══════
    renderPermisosTab(c) {
        c.innerHTML = `
            <div id="ast-ranking-permisos-container" style="margin-bottom:24px;animation:astFadeUp 0.4s ease 60ms both"></div>

            <div class="m-card">
                <div class="m-card-header" style="padding:6px 12px">
                    <h3 style="margin:0;font-size:14px;font-weight:700;color:#1e293b">Registro de Permisos</h3>
                </div>
                <div class="m-card-body" style="padding:0">
                    <div class="m-table-wrap">
                        <table style="width:100%;border-collapse:collapse;font-size:13px">
                            <thead><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">
                                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Trabajador</th>
                                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Tipo</th>
                                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Fecha</th>
                                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Horas</th>
                                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Motivo</th>
                                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Estado</th>
                                <th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Acciones</th>
                            </tr></thead>
                            <tbody id="ast-tabla-permisos"><tr><td colspan="7" style="text-align:center;padding:32px;color:#94a3b8">Cargando...</td></tr></tbody>
                        </table>
                    </div>
                    <div id="ast-cards-permisos" class="m-cards-mobile" style="display:none;padding:12px"></div>
                </div>
            </div>`;
        this.cargarPermisos();
    },

    async cargarPermisos() {
        const mes = document.getElementById('ast-hero-mes')?.value;
        if (!mes) return;
        try {
            const r = await authFetch('/api/asistencia/permisos?mes=' + mes + '&anio=' + new Date().getFullYear());
            const permisos = await r.json();
            
            // Calcular ranking de permisos por trabajador (horas aprobadas)
            const rankingMap = {};
            permisos.forEach(p => {
                if (p.estado === 'aprobado') {
                    const nombre = p.nombre || 'Desconocido';
                    if (!rankingMap[nombre]) rankingMap[nombre] = 0;
                    rankingMap[nombre] += Number(p.horas) || 0;
                }
            });
            const ranking = Object.entries(rankingMap)
                .map(([nombre, horas]) => ({ nombre, horas }))
                .sort((a, b) => b.horas - a.horas)
                .slice(0, 5);
            
            this.renderRankingPermisos(ranking);
            this.renderTablaPermisos(permisos);
        } catch(e) { console.error('Error:', e); }
    },

    // ═══════ RANKING COLORS (estandarizado) ═══════
    _rankingConfigs: [
        { border: '#f59e0b', bg: 'linear-gradient(135deg,#fffbeb,#fef3c7)', numBg: '#f59e0b', icon: '🏆', textColor: '#92400e', labelColor: '#b45309' },
        { border: '#94a3b8', bg: 'linear-gradient(135deg,#f8fafc,#f1f5f9)', numBg: '#94a3b8', icon: '🥈', textColor: '#334155', labelColor: '#64748b' },
        { border: '#f97316', bg: 'linear-gradient(135deg,#fff7ed,#ffedd5)', numBg: '#f97316', icon: '🥉', textColor: '#9a3412', labelColor: '#c2410c' },
        { border: '#8b5cf6', bg: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', numBg: '#8b5cf6', icon: '⭐', textColor: '#5b21b6', labelColor: '#7c3aed' },
        { border: '#3b82f6', bg: 'linear-gradient(135deg,#eff6ff,#dbeafe)', numBg: '#3b82f6', icon: '⭐', textColor: '#1e40af', labelColor: '#2563eb' }
    ],

    _renderRanking(containerId, data, valueKey, label) {
        const c = document.getElementById(containerId);
        if (!c) return;
        if (!data || data.length === 0) { c.innerHTML = ''; return; }
        const configs = this._rankingConfigs;
        c.innerHTML = '<div class="ranking-container">' + data.slice(0, 5).map((r, i) => {
            const cfg = configs[i] || configs[4];
            const valor = r[valueKey] !== undefined ? r[valueKey] : r.valor || 0;
            return `<div class="ranking-card" style="background:${cfg.bg};border:2px solid ${cfg.border}">
                <div style="font-size:20px;margin-bottom:2px">${cfg.icon}</div>
                <div style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:${cfg.numBg};color:white;font-size:10px;font-weight:800;margin-bottom:2px">${i + 1}</div>
                <div class="ranking-name" style="color:${cfg.textColor}">${r.nombre}</div>
                <div style="font-size:18px;font-weight:800;color:${cfg.numBg};line-height:1">${typeof valor === 'number' ? valor.toFixed(1) : valor}</div>
                <div style="font-size:8px;text-transform:uppercase;letter-spacing:0.8px;color:${cfg.labelColor};font-weight:700;margin-top:2px">${label}</div>
            </div>`;
        }).join('') + '</div>';
    },

    renderRanking(ranking) { this._renderRanking('ast-ranking-container', ranking, 'valor', 'Días fuera'); },
    renderRankingPermisos(ranking) { this._renderRanking('ast-ranking-permisos-container', ranking, 'horas', 'Horas Permiso'); },
    renderRankingLicencias(ranking) { this._renderRanking('ast-ranking-licencias-container', ranking, 'dias', 'Días Licencia'); },
    renderRankingVacaciones(ranking) { this._renderRanking('ast-ranking-vacaciones-container', ranking, 'dias', 'Días Vacaciones'); },
    renderRankingHorasExtras(ranking) { this._renderRanking('ast-ranking-he-container', ranking, 'horas', 'Horas Extras'); },

    renderTablaPermisos(permisos) {
            const tbody = document.getElementById('ast-tabla-permisos');
            if (!tbody) return;
            if (permisos.length === 0) { tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:#94a3b8">${MSG.SIN_DATOS}</td></tr>`; const cardsEl = document.getElementById('ast-cards-permisos'); if (cardsEl) cardsEl.innerHTML = ''; return; }
            const tipoL = { medico: 'Médico', personal: 'Personal', familiar: 'Familiar', otro: 'Otro' };
            const MOD = 'asistencia';
            const canEditP = canEdit(MOD);
            const canDeleteP = canDelete(MOD);
            tbody.innerHTML = permisos.map(p => {
                const ec = p.estado === 'aprobado' ? 'background:#d1fae5;color:#059669' : p.estado === 'rechazado' ? 'background:#fee2e2;color:#dc2626' : 'background:#fef3c7;color:#d97706';
                return '<tr style="border-bottom:1px solid #f1f5f9">'
                    + '<td style="padding:12px 16px"><strong style="color:#1e293b">' + p.nombre + '</strong></td>'
                    + '<td style="padding:12px 16px;color:#475569">' + (tipoL[p.tipo] || p.tipo) + '</td>'
                    + '<td style="padding:12px 16px;color:#475569;font-size:12px">' + this.fmtDate(p.fecha_inicio) + '</td>'
                    + '<td style="padding:12px 16px;color:#475569;font-size:12px"><strong>' + (Number(p.horas) || 0) + ' hrs</strong></td>'
                    + '<td style="padding:12px 16px;color:#64748b;font-size:12px">' + (p.motivo || '-') + '</td>'
                    + '<td style="padding:12px 16px"><span class="ast-badge" style="' + ec + '">' + p.estado + '</span></td>'
                    + '<td style="padding:12px 16px;text-align:center;white-space:nowrap">'
                    + (p.estado === 'pendiente' && canEditP
                        ? `<button onclick="Asistencia.estadoPermiso(${p.id},'aprobado')" class="btn btn-sm" title="${BTN.APROBAR}" style="background:#22c55e;color:white;margin-right:4px">${BTN.ICON.APROBAR}</button><button onclick="Asistencia.estadoPermiso(${p.id},'rechazado')" class="btn btn-sm btn-danger" title="${BTN.RECHAZAR}" style="margin-right:4px">${BTN.ICON.RECHAZAR}</button>`
                        : '')
                    + (canEditP ? `<button onclick="Asistencia.editarPermiso(${p.id})" class="btn btn-sm btn-outline" title="${BTN.EDITAR}" style="margin-right:4px">${BTN.ICON.EDITAR}</button>` : '')
                    + (canDeleteP ? `<button onclick="Asistencia.eliminarPermiso(${p.id})" class="btn btn-sm btn-danger" title="${BTN.ELIMINAR}">${BTN.ICON.ELIMINAR}</button>` : '')
                    + '</td></tr>';
            }).join('');

            const cardsEl = document.getElementById('ast-cards-permisos');
            if (cardsEl) {
                let cardsHtml = '';
                permisos.forEach(p => {
                    const ec = p.estado === 'aprobado' ? '#22c55e' : p.estado === 'rechazado' ? '#ef4444' : '#d97706';
                    cardsHtml += '<div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,0.04);border-left:4px solid ' + ec + '">'
                        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
                        + '<span style="font-weight:700;color:#0f172a;font-size:14px">' + p.nombre + '</span>'
                        + '<span class="ast-badge" style="background:' + (p.estado === 'aprobado' ? '#d1fae5;color:#059669' : p.estado === 'rechazado' ? '#fee2e2;color:#dc2626' : '#fef3c7;color:#d97706') + '">' + p.estado + '</span>'
                        + '</div>'
                        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;color:#64748b">'
                        + '<span>Tipo: <strong>' + (tipoL[p.tipo] || p.tipo) + '</strong></span>'
                        + '<span>Horas: <strong style="color:#8b5cf6">' + (Number(p.horas) || 0) + ' hrs</strong></span>'
                        + '<span>Fecha: <strong>' + this.fmtDate(p.fecha_inicio) + '</strong></span>'
                        + '</div>'
                        + (p.motivo ? '<div style="font-size:11px;color:#64748b;margin-top:4px">Motivo: ' + p.motivo + '</div>' : '')
                        + '</div>';
                });
                cardsEl.innerHTML = cardsHtml;
            }
    },

    async estadoPermiso(id, estado) {
        await authFetch('/api/asistencia/permisos/' + id + '/estado', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado }) });
        this.cargarPermisos();
    },

    editarPermiso(id) {
        authFetch('/api/asistencia/permisos').then(r => r.json()).then(permisos => {
            const p = permisos.find(x => x.id === id);
            if (!p) return;
            document.getElementById('permiso-trabajador').value = p.trabajador_id;
            document.getElementById('permiso-tipo').value = p.tipo;
            document.getElementById('permiso-fecha').value = p.fecha_inicio ? p.fecha_inicio.split('T')[0] : '';
            document.getElementById('permiso-motivo').value = p.motivo || '';
            if (document.getElementById('permiso-horas')) document.getElementById('permiso-horas').value = p.horas || 0;
            document.getElementById('modalPermiso').dataset.editId = id;
            document.getElementById('modalPermiso').classList.add('show');
        });
    },

    async eliminarPermiso(id) {
        if (!confirm(MSG.CONFIRMAR_ELIMINAR)) return;
        try {
            await authFetch('/api/asistencia/permisos/' + id, { method: 'DELETE' });
            this.cargarPermisos();
        } catch(e) { console.error('Error:', e); }
    },

    abrirModalPermiso() { document.getElementById('modalPermiso').classList.add('show'); },
    cerrarModalPermiso() { document.getElementById('modalPermiso').classList.remove('show'); },
    async guardarPermiso() {
        const editId = document.getElementById('modalPermiso').dataset.editId;
        const fecha = document.getElementById('permiso-fecha').value;
        const d = { trabajador_id: document.getElementById('permiso-trabajador').value, tipo: document.getElementById('permiso-tipo').value, fecha_inicio: fecha, fecha_fin: fecha, motivo: document.getElementById('permiso-motivo').value, horas: parseFloat(document.getElementById('permiso-horas')?.value) || 0 };
        if (!d.trabajador_id || !d.fecha_inicio) return;
        if (editId) {
            await authFetch('/api/asistencia/permisos/' + editId, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
            delete document.getElementById('modalPermiso').dataset.editId;
        } else {
            await authFetch('/api/asistencia/permisos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
        }
        this.cerrarModalPermiso(); this.cargarPermisos();
    },

    // ═══════ LICENCIAS ═══════
    renderLicenciasTab(c) {
        c.innerHTML = `
            <div id="ast-ranking-licencias-container" style="margin-bottom:24px;animation:astFadeUp 0.4s ease 60ms both"></div>

            <div class="m-card">
                <div class="m-card-header" style="padding:6px 12px">
                    <h3 style="margin:0;font-size:14px;font-weight:700;color:#1e293b">Registro de Licencias Médicas</h3>
                </div>
                <div class="m-card-body" style="padding:0">
                    <div class="m-table-wrap">
                        <table style="width:100%;border-collapse:collapse;font-size:13px">
                            <thead><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">
                                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Trabajador</th>
                                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Inicio</th>
                                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Fin</th>
                                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Días</th>
                                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Diagnóstico</th>
                                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Estado</th>
                                <th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Acciones</th>
                            </tr></thead>
                            <tbody id="ast-tabla-licencias"><tr><td colspan="7" style="text-align:center;padding:32px;color:#94a3b8">Cargando...</td></tr></tbody>
                        </table>
                    </div>
                    <div id="ast-cards-licencias" class="m-cards-mobile" style="display:none;padding:12px"></div>
                </div>
            </div>`;
        this.cargarLicencias();
    },

    async cargarLicencias() {
        const mes = document.getElementById('ast-hero-mes')?.value;
        if (!mes) return;
        try {
            const r = await authFetch('/api/asistencia/licencias?mes=' + mes + '&anio=' + new Date().getFullYear());
            const licencias = await r.json();
            
            // Calcular ranking de licencias por trabajador (días aprobados)
            const rankingMap = {};
            licencias.forEach(l => {
                if (l.estado === 'aprobada') {
                    const nombre = l.nombre || 'Desconocido';
                    if (!rankingMap[nombre]) rankingMap[nombre] = 0;
                    const dias = Math.ceil((new Date(l.fecha_fin) - new Date(l.fecha_inicio)) / 86400000) + 1;
                    rankingMap[nombre] += dias;
                }
            });
            const ranking = Object.entries(rankingMap)
                .map(([nombre, dias]) => ({ nombre, dias }))
                .sort((a, b) => b.dias - a.dias)
                .slice(0, 5);
            
            this.renderRankingLicencias(ranking);
            this.renderTablaLicencias(licencias);
        } catch(e) { console.error('Error:', e); }
    },

    renderTablaLicencias(licencias) {
            const tbody = document.getElementById('ast-tabla-licencias');
            if (!tbody) return;
            if (licencias.length === 0) { tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:#94a3b8">${MSG.SIN_DATOS}</td></tr>`; const cardsEl = document.getElementById('ast-cards-licencias'); if (cardsEl) cardsEl.innerHTML = ''; return; }
            const canEditL = canEdit('asistencia');
            const canDeleteL = canDelete('asistencia');
            tbody.innerHTML = licencias.map(l => {
                const ec = l.estado === 'aprobada' ? 'background:#d1fae5;color:#059669' : l.estado === 'rechazada' ? 'background:#fee2e2;color:#dc2626' : 'background:#fef3c7;color:#d97706';
                const dias = Math.ceil((new Date(l.fecha_fin) - new Date(l.fecha_inicio)) / 86400000) + 1;
                return '<tr style="border-bottom:1px solid #f1f5f9">'
                    + '<td style="padding:12px 16px"><strong style="color:#1e293b">' + l.nombre + '</strong></td>'
                    + '<td style="padding:12px 16px;color:#475569;font-size:12px">' + this.fmtDate(l.fecha_inicio) + '</td>'
                    + '<td style="padding:12px 16px;color:#475569;font-size:12px">' + this.fmtDate(l.fecha_fin) + '</td>'
                    + '<td style="padding:12px 16px"><strong style="color:#1e293b">' + dias + '</strong> días</td>'
                    + '<td style="padding:12px 16px;color:#64748b;font-size:12px">' + (l.diagnostico || '-') + '</td>'
                    + '<td style="padding:12px 16px"><span class="ast-badge" style="' + ec + '">' + l.estado + '</span></td>'
                    + '<td style="padding:12px 16px;text-align:center;white-space:nowrap">'
                    + (l.estado === 'pendiente' && canEditL
                        ? `<button onclick="Asistencia.estadoLicencia(${l.id},'aprobada')" class="btn btn-sm" title="${BTN.APROBAR}" style="background:#22c55e;color:white;margin-right:4px">${BTN.ICON.APROBAR}</button><button onclick="Asistencia.estadoLicencia(${l.id},'rechazada')" class="btn btn-sm btn-danger" title="${BTN.RECHAZAR}" style="margin-right:4px">${BTN.ICON.RECHAZAR}</button>`
                        : '')
                    + (canEditL ? `<button onclick="Asistencia.editarLicencia(${l.id})" class="btn btn-sm btn-outline" title="${BTN.EDITAR}" style="margin-right:4px">${BTN.ICON.EDITAR}</button>` : '')
                    + (canDeleteL ? `<button onclick="Asistencia.eliminarLicencia(${l.id})" class="btn btn-sm btn-danger" title="${BTN.ELIMINAR}">${BTN.ICON.ELIMINAR}</button>` : '')
                    + '</td></tr>';
            }).join('');

            const cardsEl = document.getElementById('ast-cards-licencias');
            if (cardsEl) {
                let cardsHtml = '';
                licencias.forEach(l => {
                    const dias = Math.ceil((new Date(l.fecha_fin) - new Date(l.fecha_inicio)) / 86400000) + 1;
                    const ec = l.estado === 'aprobada' ? '#22c55e' : l.estado === 'rechazada' ? '#ef4444' : '#d97706';
                    cardsHtml += '<div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,0.04);border-left:4px solid ' + ec + '">'
                        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
                        + '<span style="font-weight:700;color:#0f172a;font-size:14px">' + l.nombre + '</span>'
                        + '<span class="ast-badge" style="background:' + (l.estado === 'aprobada' ? '#d1fae5;color:#059669' : l.estado === 'rechazada' ? '#fee2e2;color:#dc2626' : '#fef3c7;color:#d97706') + '">' + l.estado + '</span>'
                        + '</div>'
                        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;color:#64748b">'
                        + '<span>Inicio: <strong>' + this.fmtDate(l.fecha_inicio) + '</strong></span>'
                        + '<span>Fin: <strong>' + this.fmtDate(l.fecha_fin) + '</strong></span>'
                        + '<span>Días: <strong style="color:#22c55e">' + dias + '</strong></span>'
                        + '</div>'
                        + (l.diagnostico ? '<div style="font-size:11px;color:#64748b;margin-top:4px">Diagnóstico: ' + l.diagnostico + '</div>' : '')
                        + '</div>';
                });
                cardsEl.innerHTML = cardsHtml;
            }
    },

    async estadoLicencia(id, estado) {
        await authFetch('/api/asistencia/licencias/' + id + '/estado', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado }) });
        this.cargarLicencias();
    },

    editarLicencia(id) {
        authFetch('/api/asistencia/licencias').then(r => r.json()).then(licencias => {
            const l = licencias.find(x => x.id === id);
            if (!l) return;
            document.getElementById('licencia-trabajador').value = l.trabajador_id;
            document.getElementById('licencia-inicio').value = l.fecha_inicio ? l.fecha_inicio.split('T')[0] : '';
            document.getElementById('licencia-fin').value = l.fecha_fin ? l.fecha_fin.split('T')[0] : '';
            document.getElementById('licencia-diagnostico').value = l.diagnostico || '';
            document.getElementById('modalLicencia').dataset.editId = id;
            document.getElementById('modalLicencia').classList.add('show');
        });
    },

    async eliminarLicencia(id) {
        if (!confirm(MSG.CONFIRMAR_ELIMINAR)) return;
        try {
            await authFetch('/api/asistencia/licencias/' + id, { method: 'DELETE' });
            this.cargarLicencias();
        } catch(e) { console.error('Error:', e); }
    },

    abrirModalLicencia() { document.getElementById('modalLicencia').classList.add('show'); },
    cerrarModalLicencia() { document.getElementById('modalLicencia').classList.remove('show'); },
    async guardarLicencia() {
        const editId = document.getElementById('modalLicencia').dataset.editId;
        const d = { trabajador_id: document.getElementById('licencia-trabajador').value, fecha_inicio: document.getElementById('licencia-inicio').value, fecha_fin: document.getElementById('licencia-fin').value, diagnostico: document.getElementById('licencia-diagnostico').value };
        if (!d.trabajador_id || !d.fecha_inicio || !d.fecha_fin) return;
        if (editId) {
            await authFetch('/api/asistencia/licencias/' + editId, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
            delete document.getElementById('modalLicencia').dataset.editId;
        } else {
            await authFetch('/api/asistencia/licencias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
        }
        this.cerrarModalLicencia(); this.cargarLicencias();
    },

    // ═══════ VACACIONES ═══════
    renderVacacionesTab(c) {
        c.innerHTML = `
            <div id="ast-ranking-vacaciones-container" style="margin-bottom:24px;animation:astFadeUp 0.4s ease 60ms both"></div>

            <div class="m-card">
                <div class="m-card-header" style="padding:6px 12px">
                    <h3 style="margin:0;font-size:14px;font-weight:700;color:#1e293b">Registro de Vacaciones</h3>
                </div>
                <div class="m-card-body" style="padding:0">
                    <div class="m-table-wrap">
                        <table style="width:100%;border-collapse:collapse;font-size:13px">
                            <thead><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">
                                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Trabajador</th>
                                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Inicio</th>
                                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Fin</th>
                                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Días</th>
                                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Estado</th>
                                <th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Acciones</th>
                            </tr></thead>
                            <tbody id="ast-tabla-vacaciones"><tr><td colspan="6" style="text-align:center;padding:32px;color:#94a3b8">Cargando...</td></tr></tbody>
                        </table>
                    </div>
                    <div id="ast-cards-vacaciones" class="m-cards-mobile" style="display:none;padding:12px"></div>
                </div>
            </div>`;
        this.cargarVacaciones();
    },

    async cargarVacaciones() {
        const mes = document.getElementById('ast-hero-mes')?.value;
        try {
            const url = '/api/asistencia/vacaciones' + (mes ? '?mes=' + mes + '&anio=' + new Date().getFullYear() : '');
            const r = await authFetch(url);
            const vacaciones = await r.json();
            
            // Calcular ranking de vacaciones por trabajador (días)
            const rankingMap = {};
            vacaciones.forEach(v => {
                const nombre = v.nombre || 'Desconocido';
                if (!rankingMap[nombre]) rankingMap[nombre] = 0;
                rankingMap[nombre] += Number(v.dias) || 0;
            });
            const ranking = Object.entries(rankingMap)
                .map(([nombre, dias]) => ({ nombre, dias }))
                .sort((a, b) => b.dias - a.dias)
                .slice(0, 5);
            
            this.renderRankingVacaciones(ranking);
            this.renderTablaVacaciones(vacaciones);
        } catch(e) { console.error('Error:', e); }
    },

    renderTablaVacaciones(vacaciones) {
            const tbody = document.getElementById('ast-tabla-vacaciones');
            if (!tbody) return;
            if (vacaciones.length === 0) { tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:#94a3b8">${MSG.SIN_DATOS}</td></tr>`; const cardsEl = document.getElementById('ast-cards-vacaciones'); if (cardsEl) cardsEl.innerHTML = ''; return; }
            const canEditV = canEdit('asistencia');
            const canDeleteV = canDelete('asistencia');
            tbody.innerHTML = vacaciones.map(v => '<tr style="border-bottom:1px solid #f1f5f9">'
                + '<td style="padding:12px 16px"><strong style="color:#1e293b">' + v.nombre + '</strong></td>'
                + '<td style="padding:12px 16px;color:#475569;font-size:12px">' + this.fmtDate(v.fecha_inicio) + '</td>'
                + '<td style="padding:12px 16px;color:#475569;font-size:12px">' + this.fmtDate(v.fecha_fin) + '</td>'
                + '<td style="padding:12px 16px"><strong style="color:#1e293b">' + v.dias + '</strong> días</td>'
                + '<td style="padding:12px 16px"><span class="ast-badge" style="background:#dbeafe;color:#2563eb">' + (v.estado || 'Programado') + '</span></td>'
                + '<td style="padding:12px 16px;text-align:center;white-space:nowrap">'
                + (canEditV ? `<button onclick="Asistencia.editarVacacion(${v.id})" class="btn btn-sm btn-outline" title="${BTN.EDITAR}" style="margin-right:4px">${BTN.ICON.EDITAR}</button>` : '')
                + (canDeleteV ? `<button onclick="Asistencia.eliminarVacacion(${v.id})" class="btn btn-sm btn-danger" title="${BTN.ELIMINAR}">${BTN.ICON.ELIMINAR}</button>` : '')
                + '</td></tr>').join('');

            const cardsEl = document.getElementById('ast-cards-vacaciones');
            if (cardsEl) {
                let cardsHtml = '';
                vacaciones.forEach(v => {
                    const ec = '#3b82f6';
                    cardsHtml += '<div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,0.04);border-left:4px solid ' + ec + '">'
                        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
                        + '<span style="font-weight:700;color:#0f172a;font-size:14px">' + v.nombre + '</span>'
                        + '<span class="ast-badge" style="background:#dbeafe;color:#2563eb">' + (v.estado || 'Programado') + '</span>'
                        + '</div>'
                        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;color:#64748b">'
                        + '<span>Inicio: <strong>' + this.fmtDate(v.fecha_inicio) + '</strong></span>'
                        + '<span>Fin: <strong>' + this.fmtDate(v.fecha_fin) + '</strong></span>'
                        + '<span>Días: <strong style="color:#3b82f6">' + v.dias + '</strong></span>'
                        + '</div></div>';
                });
                cardsEl.innerHTML = cardsHtml;
            }
    },

    editarVacacion(id) {
        authFetch('/api/asistencia/vacaciones').then(r => r.json()).then(vacaciones => {
            const v = vacaciones.find(x => x.id === id);
            if (!v) return;
            document.getElementById('vacacion-trabajador').value = v.trabajador_id;
            document.getElementById('vacacion-inicio').value = v.fecha_inicio ? v.fecha_inicio.split('T')[0] : '';
            document.getElementById('vacacion-fin').value = v.fecha_fin ? v.fecha_fin.split('T')[0] : '';
            document.getElementById('vacacion-dias').value = v.dias;
            document.getElementById('modalVacacion').dataset.editId = id;
            document.getElementById('modalVacacion').classList.add('show');
        });
    },

    async eliminarVacacion(id) {
        if (!confirm(MSG.CONFIRMAR_ELIMINAR)) return;
        try {
            await authFetch('/api/asistencia/vacaciones/' + id, { method: 'DELETE' });
            this.cargarVacaciones();
        } catch(e) { console.error('Error:', e); }
    },

    abrirModalVacacion() { document.getElementById('modalVacacion').classList.add('show'); },
    cerrarModalVacacion() { document.getElementById('modalVacacion').classList.remove('show'); },
    async guardarVacacion() {
        const editId = document.getElementById('modalVacacion').dataset.editId;
        const d = { trabajador_id: document.getElementById('vacacion-trabajador').value, fecha_inicio: document.getElementById('vacacion-inicio').value, fecha_fin: document.getElementById('vacacion-fin').value, dias: parseInt(document.getElementById('vacacion-dias').value) };
        if (!d.trabajador_id || !d.fecha_inicio || !d.fecha_fin || !d.dias) return;
        if (editId) {
            await authFetch('/api/asistencia/vacaciones/' + editId, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
            delete document.getElementById('modalVacacion').dataset.editId;
        } else {
            await authFetch('/api/asistencia/vacaciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
        }
        this.cerrarModalVacacion(); this.cargarVacaciones();
    },

    // ═══════ HORAS EXTRAS ═══════
    renderHorasExtrasTab(c) {
        c.innerHTML = `
            <div id="ast-ranking-he-container" style="margin-bottom:24px;animation:astFadeUp 0.4s ease 60ms both"></div>

            <div class="m-card">
                <div class="m-card-header" style="padding:6px 12px">
                    <h3 style="margin:0;font-size:14px;font-weight:700;color:#1e293b">Registro de Horas Extras</h3>
                </div>
                <div class="m-card-body" style="padding:0">
                    <div class="m-table-wrap">
                        <table style="width:100%;border-collapse:collapse;font-size:13px">
                            <thead><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">
                                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Trabajador</th>
                                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Fecha</th>
                                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Horas</th>
                                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Motivo</th>
                                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Estado</th>
                                <th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Acciones</th>
                            </tr></thead>
                            <tbody id="ast-tabla-horas-extras"><tr><td colspan="6" style="text-align:center;padding:32px;color:#94a3b8">Cargando...</td></tr></tbody>
                        </table>
                    </div>
                    <div id="ast-cards-horas-extras" class="m-cards-mobile" style="display:none;padding:12px"></div>
                </div>
            </div>`;
        this.cargarHorasExtras();
    },

    async cargarHorasExtras() {
        const mes = document.getElementById('ast-hero-mes')?.value;
        try {
            const url = '/api/asistencia/horas-extras' + (mes ? '?mes=' + mes + '&anio=' + new Date().getFullYear() : '');
            const r = await authFetch(url);
            const horasExtras = await r.json();
            
            // Calcular ranking de horas extras por trabajador
            const rankingMap = {};
            horasExtras.forEach(he => {
                const nombre = he.nombre || 'Desconocido';
                if (!rankingMap[nombre]) rankingMap[nombre] = 0;
                rankingMap[nombre] += Number(he.horas) || 0;
            });
            const ranking = Object.entries(rankingMap)
                .map(([nombre, horas]) => ({ nombre, horas }))
                .sort((a, b) => b.horas - a.horas)
                .slice(0, 5);
            
            this.renderRankingHorasExtras(ranking);
            this.renderTablaHorasExtras(horasExtras);
        } catch(e) { console.error('Error:', e); }
    },

    renderTablaHorasExtras(horasExtras) {
            const tbody = document.getElementById('ast-tabla-horas-extras');
            if (!tbody) return;
            if (horasExtras.length === 0) { tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:#94a3b8">${MSG.SIN_DATOS}</td></tr>`; const cardsEl = document.getElementById('ast-cards-horas-extras'); if (cardsEl) cardsEl.innerHTML = ''; return; }
            const canEditHE = canEdit('asistencia');
            const canDeleteHE = canDelete('asistencia');
            const puedeAprobar = canEditHE;
            tbody.innerHTML = horasExtras.map(he => {
                const ec = he.estado === 'aprobada' ? 'background:#d1fae5;color:#059669' : he.estado === 'rechazada' ? 'background:#fee2e2;color:#dc2626' : 'background:#dbeafe;color:#2563eb';
                return '<tr style="border-bottom:1px solid #f1f5f9">'
                + '<td style="padding:12px 16px"><strong style="color:#1e293b">' + he.nombre + '</strong></td>'
                + '<td style="padding:12px 16px;color:#475569;font-size:12px">' + this.fmtDate(he.fecha) + '</td>'
                + '<td style="padding:12px 16px"><strong style="color:#1e293b">' + he.horas + '</strong> hrs</td>'
                + '<td style="padding:12px 16px;color:#475569;font-size:12px">' + (he.motivo || '-') + '</td>'
                + '<td style="padding:12px 16px"><span class="ast-badge" style="' + ec + '">' + (he.estado || 'pendiente') + '</span></td>'
                + '<td style="padding:12px 16px;text-align:center;white-space:nowrap">'
                + (puedeAprobar && (!he.estado || he.estado === 'pendiente') ? `<button onclick="Asistencia.estadoHorasExtras(${he.id},'aprobada')" class="btn btn-sm" title="${BTN.APROBAR}" style="background:#22c55e;color:white;margin-right:4px">${BTN.ICON.APROBAR}</button><button onclick="Asistencia.estadoHorasExtras(${he.id},'rechazada')" class="btn btn-sm btn-danger" title="${BTN.RECHAZAR}" style="margin-right:4px">${BTN.ICON.RECHAZAR}</button>` : '')
                + (canEditHE ? `<button onclick="Asistencia.editarHorasExtras(${he.id})" class="btn btn-sm btn-outline" title="${BTN.EDITAR}" style="margin-right:4px">${BTN.ICON.EDITAR}</button>` : '')
                + (canDeleteHE ? `<button onclick="Asistencia.eliminarHorasExtras(${he.id})" class="btn btn-sm btn-danger" title="${BTN.ELIMINAR}">${BTN.ICON.ELIMINAR}</button>` : '')
                + '</td></tr>';
            }).join('');

            const cardsEl = document.getElementById('ast-cards-horas-extras');
            if (cardsEl) {
                let cardsHtml = '';
                horasExtras.forEach(he => {
                    const ec = he.estado === 'aprobada' ? '#22c55e' : he.estado === 'rechazada' ? '#ef4444' : '#3b82f6';
                    cardsHtml += '<div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,0.04);border-left:4px solid ' + ec + '">'
                        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
                        + '<span style="font-weight:700;color:#0f172a;font-size:14px">' + he.nombre + '</span>'
                        + '<span class="ast-badge" style="background:' + (he.estado === 'aprobada' ? '#d1fae5;color:#059669' : he.estado === 'rechazada' ? '#fee2e2;color:#dc2626' : '#dbeafe;color:#2563eb') + '">' + (he.estado || 'pendiente') + '</span>'
                        + '</div>'
                        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;color:#64748b">'
                        + '<span>Fecha: <strong>' + this.fmtDate(he.fecha) + '</strong></span>'
                        + '<span>Horas: <strong style="color:#8b5cf6">' + he.horas + ' hrs</strong></span>'
                        + '</div>'
                        + (he.motivo ? '<div style="font-size:11px;color:#64748b;margin-top:4px">Motivo: ' + he.motivo + '</div>' : '')
                        + '</div>';
                });
                cardsEl.innerHTML = cardsHtml;
            }
    },

    editarHorasExtras(id) {
        authFetch('/api/asistencia/horas-extras').then(r => r.json()).then(horasExtras => {
            const he = horasExtras.find(x => x.id === id);
            if (!he) return;
            document.getElementById('he-trabajador').value = he.trabajador_id;
            document.getElementById('he-fecha').value = he.fecha ? he.fecha.split('T')[0] : '';
            document.getElementById('he-horas').value = he.horas;
            document.getElementById('he-motivo').value = he.motivo || '';
            document.getElementById('modalHorasExtras').dataset.editId = id;
            document.getElementById('modalHorasExtras').classList.add('show');
        });
    },

    async eliminarHorasExtras(id) {
        if (!confirm(MSG.CONFIRMAR_ELIMINAR)) return;
        try {
            await authFetch('/api/asistencia/horas-extras/' + id, { method: 'DELETE' });
            this.cargarHorasExtras();
        } catch(e) { console.error('Error:', e); }
    },

    async estadoHorasExtras(id, estado) {
        try {
            await authFetch('/api/asistencia/horas-extras/' + id + '/estado', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado })
            });
            this.cargarHorasExtras();
        } catch(e) { console.error('Error:', e); }
    },

    abrirModalHorasExtras() {
        document.getElementById('he-trabajador').value = '';
        document.getElementById('he-fecha').value = new Date().toISOString().split('T')[0];
        document.getElementById('he-hora-inicio').value = '';
        document.getElementById('he-hora-fin').value = '';
        document.getElementById('he-horas').value = '';
        document.getElementById('he-motivo').value = '';
        delete document.getElementById('modalHorasExtras').dataset.editId;
        this.cargarTrabajadoresSelect('he-trabajador');
        document.getElementById('modalHorasExtras').classList.add('show');
    },
    cerrarModalHorasExtras() { document.getElementById('modalHorasExtras').classList.remove('show'); },
    calcularHorasExtras() {
        const inicio = document.getElementById('he-hora-inicio').value;
        const fin = document.getElementById('he-hora-fin').value;
        if (!inicio || !fin) return;
        const [h1, m1] = inicio.split(':').map(Number);
        const [h2, m2] = fin.split(':').map(Number);
        let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
        if (diff < 0) diff += 24 * 60;
        const horas = Math.round(diff / 60 * 2) / 2;
        document.getElementById('he-horas').value = horas > 0 ? horas.toFixed(1) : '';
    },
    cargarTrabajadoresSelect(selectId) {
        authFetch('/api/asistencia/trabajadores').then(r => r.json()).then(trabajadores => {
            const sel = document.getElementById(selectId);
            if (!sel) return;
            sel.innerHTML = '<option value="">Seleccionar...</option>' + trabajadores.filter(t => t.activo !== false).map(t => '<option value="' + t.id + '">' + t.nombre + '</option>').join('');
        });
    },
    async guardarHorasExtras() {
        const editId = document.getElementById('modalHorasExtras').dataset.editId;
        const d = { trabajador_id: document.getElementById('he-trabajador').value, fecha: document.getElementById('he-fecha').value, horas: parseFloat(document.getElementById('he-horas').value), motivo: document.getElementById('he-motivo').value };
        if (!d.trabajador_id || !d.fecha || !d.horas) return;
        if (editId) {
            await authFetch('/api/asistencia/horas-extras/' + editId, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
            delete document.getElementById('modalHorasExtras').dataset.editId;
        } else {
            await authFetch('/api/asistencia/horas-extras', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
        }
        this.cerrarModalHorasExtras(); this.cargarHorasExtras();
    },

    // ═══════ REPORTES ═══════
    renderReportesTab(c) {
        c.innerHTML = `
            <div id="ast-ranking-container" style="margin-bottom:24px;animation:astFadeUp 0.4s ease 60ms both"></div>

            <div class="m-card">
                <div class="m-card-header" style="padding:6px 12px">
                    <h3 style="margin:0;font-size:14px;font-weight:700;color:#1e293b">Reporte Mensual</h3>
                </div>
                <div class="m-card-body" style="padding:0">
                    <div class="m-table-wrap">
                        <table style="width:100%;min-width:900px;border-collapse:collapse;font-size:13px">
                            <thead style="position:sticky;top:0;z-index:2"><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">
                                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">#</th>
                                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Trabajador</th>
                                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Días Hábiles</th>
                                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Asistidos</th>
                                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Faltas</th>
                                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Permisos</th>
                                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Licencias</th>
                                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Vacaciones</th>
                                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">H. Extras</th>
                                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">% Asistencia</th>
                            </tr></thead>
                            <tbody id="ast-tabla-reporte"><tr><td colspan="10" style="text-align:center;padding:32px;color:#94a3b8">Cargando reporte...</td></tr></tbody>
                        </table>
                    </div>
                    <div id="ast-cards-reporte" class="m-cards-mobile" style="display:none;padding:12px"></div>
                </div>
            </div>`;

        setTimeout(() => this.cargarReportes(), 100);
    },

    async cargarReportes() {
        const mes = document.getElementById('ast-hero-mes')?.value || (new Date().getMonth() + 1);
        const anio = new Date().getFullYear();
        try {
            const [reporteR, rankAR] = await Promise.all([
                authFetch('/api/asistencia/reporte-mensual?mes=' + mes + '&anio=' + anio),
                authFetch('/api/asistencia/ranking?mes=' + mes + '&anio=' + anio + '&tipo=asistencia')
            ]);
            if (!reporteR.ok) { console.error('Reporte API error:', await reporteR.text()); return; }
            const reporte = await reporteR.json();
            const ranking = rankAR.ok ? await rankAR.json() : [];
            this.renderReporte(reporte);
            this.renderRanking(ranking);
        } catch(e) { console.error('Error cargando reportes:', e); }
    },

    _lastReporteData: null,

    renderReporte(reporte) {
        this._lastReporteData = reporte;
        const tbody = document.getElementById('ast-tabla-reporte');
        if (!tbody) return;
        if (reporte.length === 0) { tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:32px;color:#94a3b8">Sin datos</td></tr>'; const cardsEl = document.getElementById('ast-cards-reporte'); if (cardsEl) cardsEl.innerHTML = ''; return; }
        const mes = parseInt(document.getElementById('ast-hero-mes')?.value) || (new Date().getMonth() + 1);
        const anio = new Date().getFullYear();
        const hoy = new Date();
        const diasEnMes = new Date(anio, mes, 0).getDate();
        
        // Calcular días hábiles del mes completo
        let diasHabilesMes = 0;
        for (let d = 1; d <= diasEnMes; d++) {
            const fecha = new Date(anio, mes - 1, d);
            const dow = fecha.getDay();
            if (dow !== 0 && dow !== 6) diasHabilesMes++;
        }

        tbody.innerHTML = reporte.map((r, i) => {
            // Calcular días hábiles considerando fecha de ingreso
            let diasHabiles = diasHabilesMes;
            if (r.fecha_ingreso) {
                const fechaIngreso = new Date(r.fecha_ingreso);
                const inicioMes = new Date(anio, mes - 1, 1);
                if (fechaIngreso > inicioMes) {
                    // El trabajador entró después del inicio del mes
                    diasHabiles = 0;
                    for (let d = fechaIngreso.getDate(); d <= diasEnMes; d++) {
                        const fecha = new Date(anio, mes - 1, d);
                        const dow = fecha.getDay();
                        if (dow !== 0 && dow !== 6) diasHabiles++;
                    }
                }
            }
            
            // Si el mes es el actual, solo contar hasta hoy
            if (hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes) {
                const fechaIngreso = r.fecha_ingreso ? new Date(r.fecha_ingreso) : null;
                const inicioEfectivo = fechaIngreso && fechaIngreso > new Date(anio, mes - 1, 1) ? fechaIngreso.getDate() : 1;
                diasHabiles = 0;
                for (let d = inicioEfectivo; d <= hoy.getDate(); d++) {
                    const fecha = new Date(anio, mes - 1, d);
                    const dow = fecha.getDay();
                    if (dow !== 0 && dow !== 6) diasHabiles++;
                }
            }

            const faltas = Number(r.faltas) || 0;
            const permisos = Number(r.permisos_aprobados) || 0;
            const licencias = Number(r.dias_licencia) || 0;
            const vacaciones = Number(r.dias_vacaciones) || 0;
            const asistidos = Math.max(0, diasHabiles - faltas - permisos - licencias - vacaciones);
            const pct = diasHabiles > 0 ? Math.round((asistidos / diasHabiles) * 100) : 0;
            const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';
            const he = Number(r.horas_extras) || 0;
            return '<tr style="border-bottom:1px solid #f1f5f9">'
                + '<td style="padding:12px 16px"><strong style="color:#1e293b">' + (i + 1) + '</strong></td>'
                + '<td style="padding:12px 16px"><strong style="color:#1e293b">' + r.nombre + '</strong></td>'
                + '<td style="padding:12px 16px"><span style="font-weight:700;color:#3b82f6">' + diasHabiles + '</span></td>'
                + '<td style="padding:12px 16px;color:#475569">' + asistidos.toFixed(1) + '</td>'
                + '<td style="padding:12px 16px"><strong style="color:' + (faltas > 0 ? '#dc2626' : '#475569') + '">' + faltas + '</strong></td>'
                + '<td style="padding:12px 16px"><span style="font-weight:600;color:' + (permisos > 0 ? '#d97706' : '#475569') + '">' + permisos.toFixed(1) + '</span></td>'
                + '<td style="padding:12px 16px"><span style="font-weight:600;color:' + (licencias > 0 ? '#d97706' : '#475569') + '">' + licencias + ' días</span></td>'
                + '<td style="padding:12px 16px"><span style="font-weight:600;color:' + (vacaciones > 0 ? '#d97706' : '#475569') + '">' + vacaciones + ' días</span></td>'
                + '<td style="padding:12px 16px"><span style="font-weight:700;color:' + (he > 0 ? '#8b5cf6' : '#94a3b8') + '">' + he.toFixed(1) + ' hrs</span></td>'
                + '<td style="padding:12px 16px"><div style="display:flex;align-items:center;gap:8px"><div style="width:60px;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden"><div style="width:' + pct + '%;height:100%;background:' + color + ';border-radius:3px"></div></div><span style="font-size:12px;font-weight:700;color:' + color + '">' + pct + '%</span></div></td>'
                + '</tr>';
        }).join('');

        const cardsEl = document.getElementById('ast-cards-reporte');
        if (cardsEl) {
            let cardsHtml = '';
            reporte.forEach((r, i) => {
                const faltas = Number(r.faltas) || 0;
                const permisos = Number(r.permisos_aprobados) || 0;
                const licencias = Number(r.dias_licencia) || 0;
                const vacaciones = Number(r.dias_vacaciones) || 0;
                const he = Number(r.horas_extras) || 0;
                const diasHabiles = diasHabilesMes;
                const asistidos = Math.max(0, diasHabiles - faltas - permisos - licencias - vacaciones);
                const pct = diasHabiles > 0 ? Math.round((asistidos / diasHabiles) * 100) : 0;
                const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';
                cardsHtml += '<div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,0.04);border-left:4px solid ' + color + '">'
                    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
                    + '<span style="font-weight:700;color:#0f172a;font-size:14px">' + r.nombre + '</span>'
                    + '<span style="background:' + (pct >= 80 ? '#d1fae5;color:#059669' : pct >= 60 ? '#fef3c7;color:#d97706' : '#fee2e2;color:#dc2626') + ';padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600">' + pct + '%</span>'
                    + '</div>'
                    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;color:#64748b">'
                    + '<span>Días Hábiles: <strong style="color:#3b82f6">' + diasHabiles + '</strong></span>'
                    + '<span>Asistidos: <strong>' + asistidos.toFixed(1) + '</strong></span>'
                    + '<span>Faltas: <strong style="color:' + (faltas > 0 ? '#dc2626' : '#475569') + '">' + faltas + '</strong></span>'
                    + '<span>Permisos: <strong>' + permisos.toFixed(1) + '</strong></span>'
                    + '<span>Licencias: <strong>' + licencias + ' días</strong></span>'
                    + '<span>Vacaciones: <strong>' + vacaciones + ' días</strong></span>'
                    + '<span>H. Extras: <strong style="color:#8b5cf6">' + he.toFixed(1) + ' hrs</strong></span>'
                    + '</div></div>';
            });
            cardsEl.innerHTML = cardsHtml;
        }
    },

    filtrarReporte() {
        const input = document.getElementById('ast-rep-buscar');
        if (!input) return;
        const query = input.value.toLowerCase().trim();
        const mostrarTodos = query.length === 0;
        
        // Filtrar tabla desktop
        const tbody = document.getElementById('ast-tabla-reporte');
        if (tbody) {
            const rows = tbody.querySelectorAll('tr');
            rows.forEach(row => {
                const nombreCell = row.querySelector('td:nth-child(2)');
                if (!nombreCell) return;
                const nombre = nombreCell.textContent.toLowerCase();
                row.style.display = mostrarTodos || nombre.includes(query) ? '' : 'none';
            });
        }
        
        // Filtrar cards móvil - re-renderizar con datos filtrados
        if (this._lastReporteData) {
            const cardsEl = document.getElementById('ast-cards-reporte');
            if (cardsEl) {
                const mes = parseInt(document.getElementById('ast-hero-mes')?.value) || (new Date().getMonth() + 1);
                const anio = new Date().getFullYear();
                const diasEnMes = new Date(anio, mes, 0).getDate();
                const hoy = new Date();
                let diasHabilesMes = 0;
                for (let d = 1; d <= diasEnMes; d++) {
                    const fecha = new Date(anio, mes - 1, d);
                    const dow = fecha.getDay();
                    if (dow !== 0 && dow !== 6) diasHabilesMes++;
                }
                
                let cardsHtml = '';
                this._lastReporteData.forEach((r, i) => {
                    const nombre = r.nombre.toLowerCase();
                    if (!mostrarTodos && !nombre.includes(query)) return;
                    
                    let diasHabiles = diasHabilesMes;
                    if (r.fecha_ingreso) {
                        const fechaIngreso = new Date(r.fecha_ingreso);
                        const inicioMes = new Date(anio, mes - 1, 1);
                        if (fechaIngreso > inicioMes) {
                            diasHabiles = 0;
                            for (let d = fechaIngreso.getDate(); d <= diasEnMes; d++) {
                                const fecha = new Date(anio, mes - 1, d);
                                const dow = fecha.getDay();
                                if (dow !== 0 && dow !== 6) diasHabiles++;
                            }
                        }
                    }
                    if (hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes) {
                        const fechaIngreso = r.fecha_ingreso ? new Date(r.fecha_ingreso) : null;
                        const inicioEfectivo = fechaIngreso && fechaIngreso > new Date(anio, mes - 1, 1) ? fechaIngreso.getDate() : 1;
                        diasHabiles = 0;
                        for (let d = inicioEfectivo; d <= hoy.getDate(); d++) {
                            const fecha = new Date(anio, mes - 1, d);
                            const dow = fecha.getDay();
                            if (dow !== 0 && dow !== 6) diasHabiles++;
                        }
                    }
                    
                    const faltas = Number(r.faltas) || 0;
                    const permisos = Number(r.permisos_aprobados) || 0;
                    const licencias = Number(r.dias_licencia) || 0;
                    const vacaciones = Number(r.dias_vacaciones) || 0;
                    const he = Number(r.horas_extras) || 0;
                    const asistidos = Math.max(0, diasHabiles - faltas - permisos - licencias - vacaciones);
                    const pct = diasHabiles > 0 ? Math.round((asistidos / diasHabiles) * 100) : 0;
                    const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';
                    cardsHtml += '<div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,0.04);border-left:4px solid ' + color + '">'
                        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
                        + '<span style="font-weight:700;color:#0f172a;font-size:14px">' + r.nombre + '</span>'
                        + '<span style="background:' + (pct >= 80 ? '#d1fae5;color:#059669' : pct >= 60 ? '#fef3c7;color:#d97706' : '#fee2e2;color:#dc2626') + ';padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600">' + pct + '%</span>'
                        + '</div>'
                        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;color:#64748b">'
                        + '<span>Días Hábiles: <strong style="color:#3b82f6">' + diasHabiles + '</strong></span>'
                        + '<span>Asistidos: <strong>' + asistidos.toFixed(1) + '</strong></span>'
                        + '<span>Faltas: <strong style="color:' + (faltas > 0 ? '#dc2626' : '#475569') + '">' + faltas + '</strong></span>'
                        + '<span>Permisos: <strong>' + permisos.toFixed(1) + '</strong></span>'
                        + '<span>Licencias: <strong>' + licencias + ' días</strong></span>'
                        + '<span>Vacaciones: <strong>' + vacaciones + ' días</strong></span>'
                        + '<span>H. Extras: <strong style="color:#8b5cf6">' + he.toFixed(1) + ' hrs</strong></span>'
                        + '</div></div>';
                });
                cardsEl.innerHTML = cardsHtml;
            }
        }
    },

    // ═══════ HELPERS ═══════
    llenarSelectores() {
        const opts = this.trabajadores.map(t => '<option value="' + t.id + '">' + t.nombre + '</option>').join('');
        const def = '<option value="">Seleccionar...</option>';
        const ps = document.getElementById('permiso-trabajador');
        const ls = document.getElementById('licencia-trabajador');
        const vs = document.getElementById('vacacion-trabajador');
        if (ps) ps.innerHTML = def + opts;
        if (ls) ls.innerHTML = def + opts;
        if (vs) vs.innerHTML = def + opts;
    },

    fmtDate(d) {
        if (!d) return '-';
        const parts = d.split('T')[0].split('-');
        return parts[2] + '/' + parts[1] + '/' + parts[0];
    },

    formatPhone(input) {
        let v = input.value.replace(/\D/g, '');
        if (v.length > 0) {
            if (v.startsWith('56')) {
                v = '+56 ' + v.slice(2);
            } else if (v.startsWith('9')) {
                v = '+56 9 ' + v.slice(1);
            } else {
                v = '+56 9 ' + v;
            }
            if (v.length > 7) v = v.slice(0, 7) + ' ' + v.slice(7);
            if (v.length > 14) v = v.slice(0, 14);
        }
        input.value = v;
    }
};

// ═══════ Registrar módulo ═══════
if (typeof App !== 'undefined') {
    App.registerModule('asistencia', Asistencia);
}
