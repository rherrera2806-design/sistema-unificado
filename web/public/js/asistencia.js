// ═══════════════════════════════════════════════════════
// VitroFlow - Módulo de Asistencia
// ═══════════════════════════════════════════════════════

const Asistencia = {
    trabajadores: [],
    asistenciaHoy: [],
    currentTab: 'diaria',
    lastLoadedDate: null,

    async render() {
        const el = document.getElementById('page-asistencia');
        if (!el) return;

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
            + '.ast-worker{display:flex;align-items:center;gap:14px;padding:14px 18px;border-bottom:1px solid #f1f5f9;transition:all 0.15s}'
            + '.ast-worker:last-child{border-bottom:none}'
            + '.ast-worker:hover{background:#f8fafc}'
            + '.ast-avatar{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:white;flex-shrink:0}'
            + '.ast-podium{display:flex;justify-content:center;align-items:flex-end;gap:20px;margin:24px 0}'
            + '.ast-rank{background:white;border:1px solid #e2e8f0;border-radius:14px;padding:20px;text-align:center;transition:all 0.2s;min-width:160px}'
            + '.ast-rank:hover{transform:translateY(-3px);box-shadow:0 8px 20px rgba(0,0,0,0.08)}'
            + '.ast-cal-header{display:grid;border-bottom:2px solid #e2e8f0;background:#f8fafc;position:sticky;top:0;z-index:2}'
            + '.ast-cal-row{display:grid;border-bottom:1px solid #f1f5f9}'
            + '.ast-cal-cell{padding:4px;text-align:center;font-size:10px;display:flex;align-items:center;justify-content:center;min-height:24px}'
            + '.ast-cal-cell.presente{background:#d1fae5}.ast-cal-cell.falta{background:#fee2e2;color:#dc2626;font-weight:700}'
            + '.ast-cal-cell.vacaciones{background:#dbeafe;color:#2563eb}.ast-cal-cell.licencia{background:#fef3c7;color:#d97706}'
            + '.ast-cal-cell.fin-semana{background:#f8fafc}.ast-cal-cell.hoy{outline:2px solid #3b82f6;outline-offset:-2px}'
            + '#ast-hero-buscar::placeholder{color:rgba(255,255,255,0.8)!important;opacity:1!important}'
            + '#ast-hero-fecha{color-scheme:dark}'
            + '#ast-hero-mes option,#ast-hero-anio option{color:#1e293b;background:white}'
            + '@media(max-width:768px){.ast-podium{flex-direction:column;align-items:center}}'
            + '</style>'

            // Hero
            + '<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:28px 32px;margin-bottom:24px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">'
            + '<div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="position:absolute;bottom:-50px;left:30%;width:250px;height:160px;background:radial-gradient(circle,rgba(245,158,11,0.12) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center">'
            + '<div><h2 style="margin:0;font-size:24px;font-weight:800;color:white;letter-spacing:-0.5px;text-shadow:0 2px 4px rgba(0,0,0,0.2)">Control de Asistencia</h2>'
            + '<p id="ast-hero-subtitle" style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.7)">Gestión diaria de asistencia, permisos y vacaciones</p></div>'
            + '<div id="ast-hero-filters" style="display:flex;gap:8px;align-items:center"></div>'
            + '</div></div>'

            // Tabs
            + '<div id="ast-tabs" style="display:flex;gap:8px;margin-bottom:24px;flex-wrap:wrap"></div>'

            // Content
            + '<div id="ast-content"></div>';

        this.renderTabs();
        this.showTab('diaria');
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
            `<button class="ast-tab${t.id === this.currentTab ? ' active' : ''}" onclick="Asistencia.showTab('${t.id}', event)" style="display:inline-flex;align-items:center;gap:6px">${t.icon}${t.label}</button>`
        ).join('');
    },

    showTab(tab, evt) {
        this.currentTab = tab;
        document.querySelectorAll('.ast-tab').forEach(el => el.classList.remove('active'));
        evt?.target?.closest('.ast-tab')?.classList.add('active');
        this.renderTabs();

        // Update subtitle and hero filters
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
        if (tab === 'trabajadores') {
            const permUser = typeof getUser === 'function' ? getUser() : null;
            const permPerms = permUser && permUser.permisos ? permUser.permisos : [];
            const canAgT = permPerms.includes('asistencia.agregar') || permPerms.includes('asistencia') || permPerms.length === 0;
            container.innerHTML = '<div style="display:flex;gap:6px;align-items:center">'
                + '<button onclick="Asistencia.filtrarTrabajadores(\'todos\')" class="ast-btn ast-hero-trab-filter" style="background:rgba(255,255,255,0.3);color:white;border:1px solid rgba(255,255,255,0.4);font-size:11px;padding:6px 12px" data-filter="todos">Todos</button>'
                + '<button onclick="Asistencia.filtrarTrabajadores(\'activos\')" class="ast-btn ast-hero-trab-filter" style="background:rgba(255,255,255,0.15);color:rgba(255,255,255,0.8);border:1px solid rgba(255,255,255,0.2);font-size:11px;padding:6px 12px" data-filter="activos">Activos</button>'
                + '<button onclick="Asistencia.filtrarTrabajadores(\'inactivos\')" class="ast-btn ast-hero-trab-filter" style="background:rgba(255,255,255,0.15);color:rgba(255,255,255,0.8);border:1px solid rgba(255,255,255,0.2);font-size:11px;padding:6px 12px" data-filter="inactivos">Inactivos</button>'
                + '</div>'
                + '<div style="position:relative">'
                + '<svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
                + '<input type="text" id="ast-hero-buscar" class="ast-input" placeholder="Buscar nombre o RUT..." oninput="Asistencia.buscarTrabajadoresAdmin()" style="padding-left:32px;width:180px;background:rgba(255,255,255,0.35);color:white;border:1px solid rgba(255,255,255,0.5);font-size:11px">'
                + '</div>'
                + (canAgT ? '<button onclick="Asistencia.showFormTrabajador()" class="ast-btn" style="background:rgba(255,255,255,0.95);color:#1e40af;font-weight:700;font-size:11px;padding:6px 14px;border-radius:8px;box-shadow:0 2px 8px rgba(30,64,175,0.15)">+ Nuevo</button>' : '')
                + '<button onclick="Asistencia.exportExcelTrabajadores()" class="ast-btn" style="background:rgba(255,255,255,0.95);color:#16a34a;font-weight:700;font-size:11px;padding:6px 14px;border-radius:8px;box-shadow:0 2px 8px rgba(22,163,74,0.15)">Excel</button>'
                + '<button onclick="Asistencia.exportPDFTrabajadores()" class="ast-btn" style="background:rgba(255,255,255,0.95);color:#dc2626;font-weight:700;font-size:11px;padding:6px 14px;border-radius:8px;box-shadow:0 2px 8px rgba(220,38,38,0.15)">PDF</button>';
        } else         if (tab === 'permisos') {
            let opts = meses.map((m, i) => '<option value="' + (i + 1) + '"' + (i === mesActual ? ' selected' : '') + '>' + m + '</option>').join('');
            container.innerHTML = '<select id="ast-hero-mes" class="ast-input" style="width:auto;background:rgba(255,255,255,0.3);color:white;border:1px solid rgba(255,255,255,0.5)">' + opts + '</select>'
                + '<button onclick="Asistencia.cargarPermisos()" class="ast-btn" style="background:rgba(255,255,255,0.3);color:white;border:1px solid rgba(255,255,255,0.5);backdrop-filter:blur(8px)">Filtrar</button>'
                + '<button onclick="Asistencia.abrirModalPermiso()" class="ast-btn" style="background:rgba(255,255,255,0.95);color:#1e40af;font-weight:700;font-size:11px;padding:6px 14px;border-radius:8px;box-shadow:0 2px 8px rgba(30,64,175,0.15)">+ Nuevo</button>';
        } else if (tab === 'licencias') {
            let opts = meses.map((m, i) => '<option value="' + (i + 1) + '"' + (i === mesActual ? ' selected' : '') + '>' + m + '</option>').join('');
            container.innerHTML = '<select id="ast-hero-mes" class="ast-input" style="width:auto;background:rgba(255,255,255,0.3);color:white;border:1px solid rgba(255,255,255,0.5)">' + opts + '</select>'
                + '<button onclick="Asistencia.cargarLicencias()" class="ast-btn" style="background:rgba(255,255,255,0.3);color:white;border:1px solid rgba(255,255,255,0.5);backdrop-filter:blur(8px)">Filtrar</button>'
                + '<button onclick="Asistencia.abrirModalLicencia()" class="ast-btn" style="background:rgba(255,255,255,0.95);color:#1e40af;font-weight:700;font-size:11px;padding:6px 14px;border-radius:8px;box-shadow:0 2px 8px rgba(30,64,175,0.15)">+ Nuevo</button>';
        } else if (tab === 'vacaciones') {
            let opts = meses.map((m, i) => '<option value="' + (i + 1) + '"' + (i === mesActual ? ' selected' : '') + '>' + m + '</option>').join('');
            container.innerHTML = '<select id="ast-hero-mes" class="ast-input" style="width:auto;background:rgba(255,255,255,0.3);color:white;border:1px solid rgba(255,255,255,0.5)">' + opts + '</select>'
                + '<button onclick="Asistencia.cargarVacaciones()" class="ast-btn" style="background:rgba(255,255,255,0.3);color:white;border:1px solid rgba(255,255,255,0.5);backdrop-filter:blur(8px)">Filtrar</button>'
                + '<button onclick="Asistencia.abrirModalVacacion()" class="ast-btn" style="background:rgba(255,255,255,0.95);color:#1e40af;font-weight:700;font-size:11px;padding:6px 14px;border-radius:8px;box-shadow:0 2px 8px rgba(30,64,175,0.15)">+ Nuevo</button>';
        } else if (tab === 'horas_extras') {
            let opts = meses.map((m, i) => '<option value="' + (i + 1) + '"' + (i === mesActual ? ' selected' : '') + '>' + m + '</option>').join('');
            container.innerHTML = '<select id="ast-hero-mes" class="ast-input" style="width:auto;background:rgba(255,255,255,0.3);color:white;border:1px solid rgba(255,255,255,0.5)">' + opts + '</select>'
                + '<button onclick="Asistencia.cargarHorasExtras()" class="ast-btn" style="background:rgba(255,255,255,0.3);color:white;border:1px solid rgba(255,255,255,0.5);backdrop-filter:blur(8px)">Filtrar</button>'
                + '<button onclick="Asistencia.abrirModalHorasExtras()" class="ast-btn" style="background:rgba(255,255,255,0.95);color:#1e40af;font-weight:700;font-size:11px;padding:6px 14px;border-radius:8px;box-shadow:0 2px 8px rgba(30,64,175,0.15)">+ Nuevo</button>';
        } else if (tab === 'calendario') {
            let mesOpts = meses.map((m, i) => '<option value="' + (i + 1) + '"' + (i === mesActual ? ' selected' : '') + '>' + m + '</option>').join('');
            let yearOpts = '';
            const yearActual = new Date().getFullYear();
            for (let y = 2024; y <= 2027; y++) yearOpts += '<option value="' + y + '"' + (y === yearActual ? ' selected' : '') + '>' + y + '</option>';
            container.innerHTML = '<select id="ast-hero-mes" class="ast-input" style="width:auto;background:rgba(255,255,255,0.3);color:white;border:1px solid rgba(255,255,255,0.5)">' + mesOpts + '</select>'
                + '<select id="ast-hero-anio" class="ast-input" style="width:auto;background:rgba(255,255,255,0.3);color:white;border:1px solid rgba(255,255,255,0.5)">' + yearOpts + '</select>'
                + '<button onclick="Asistencia.cargarCalendario()" class="ast-btn" style="background:rgba(255,255,255,0.95);color:#1e40af;font-weight:700;font-size:11px;padding:6px 14px;border-radius:8px;box-shadow:0 2px 8px rgba(30,64,175,0.15)">Cargar</button>';
        } else if (tab === 'reportes') {
            let opts = meses.map((m, i) => '<option value="' + (i + 1) + '"' + (i === mesActual ? ' selected' : '') + '>' + m + '</option>').join('');
            container.innerHTML = '<select id="ast-hero-mes" class="ast-input" style="width:auto;background:rgba(255,255,255,0.3);color:white;border:1px solid rgba(255,255,255,0.5)">' + opts + '</select>'
                + '<button onclick="Asistencia.cargarReportes()" class="ast-btn" style="background:rgba(255,255,255,0.95);color:#1e40af;font-weight:700;font-size:11px;padding:6px 14px;border-radius:8px;box-shadow:0 2px 8px rgba(30,64,175,0.15)">Generar</button>';
        } else if (tab === 'diaria') {
            container.innerHTML = '<div style="position:relative">'
                + '<svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
                + '<input type="text" id="ast-hero-buscar" class="ast-input" placeholder="Buscar nombre o RUT..." oninput="Asistencia.buscarTrabajadores()" style="padding-left:32px;width:160px;background:rgba(255,255,255,0.35);color:white;border:1px solid rgba(255,255,255,0.5);font-size:11px">'
                + '</div>'
                + '<input type="date" id="ast-hero-fecha" class="ast-input" style="width:auto;background:rgba(255,255,255,0.3);color:white;border:1px solid rgba(255,255,255,0.5);font-size:11px">'
                + '<button onclick="Asistencia.cargarAsistencia()" class="ast-btn" style="background:rgba(255,255,255,0.95);color:#1e40af;font-weight:700;font-size:11px;padding:6px 14px;border-radius:8px;box-shadow:0 2px 8px rgba(30,64,175,0.15)">Cargar</button>';
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
        const permUser = typeof getUser === 'function' ? getUser() : null;
        const permPerms = permUser && permUser.permisos ? permUser.permisos : [];
        const canAgT = permPerms.includes('asistencia.agregar') || permPerms.includes('asistencia') || permPerms.length === 0;
        const canEditT = permPerms.includes('asistencia.editar') || permPerms.includes('asistencia') || permPerms.length === 0;
        const canDeleteT = permPerms.includes('asistencia.eliminar') || permPerms.length === 0;
        c.innerHTML = `
            <div id="ast-form-trabajador" style="display:none;background:white;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);padding:20px 24px;margin-bottom:20px;animation:astFadeUp 0.3s ease both">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
                    <div style="width:28px;height:28px;border-radius:7px;background:linear-gradient(135deg,#eff6ff,#bfdbfe);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>
                    <h4 id="ast-form-title" style="margin:0;font-size:14px;font-weight:700;color:#1e293b">Nuevo Trabajador</h4>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:12px;align-items:end">
                    <div>
                        <label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">RUT</label>
                        <input type="text" id="ast-trab-rut" class="ast-input" placeholder="12.345.678-9" style="width:100%">
                    </div>
                    <div>
                        <label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Nombre Completo</label>
                        <input type="text" id="ast-trab-nombre" class="ast-input" placeholder="Nombre del trabajador" style="width:100%">
                    </div>
                    <div style="display:flex;gap:6px">
                        <button onclick="Asistencia.guardarTrabajador()" class="ast-btn" style="background:linear-gradient(135deg,#22c55e,#16a34a);color:white;padding:10px 20px">Guardar</button>
                        <button onclick="Asistencia.hideFormTrabajador()" class="ast-btn" style="background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;padding:10px 16px">Cancelar</button>
                    </div>
                </div>
                <input type="hidden" id="ast-trab-id">
            </div>

            <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:astFadeUp 0.4s ease 120ms both;overflow:hidden">
                <div style="overflow:auto;max-height:65vh">
                <table style="width:100%;border-collapse:collapse;font-size:13px">
                    <thead style="position:sticky;top:0;z-index:2"><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Trabajador</th>
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">RUT</th>
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Estado</th>
                        <th style="padding:11px 16px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Acciones</th>
                    </tr></thead>
                    <tbody id="ast-tabla-trabajadores"><tr><td colspan="4" style="text-align:center;padding:32px;color:#94a3b8">Cargando...</td></tr></tbody>
                </table>
                </div>
            </div>`;

        this.trabFilter = 'todos';
        await this.cargarTodosTrabajadores();
    },

    trabFilter: 'todos',
    todosTrabajadores: [],

    async cargarTodosTrabajadores() {
        try {
            const r = await fetch('/api/asistencia/trabajadores');
            this.todosTrabajadores = await r.json();
            this.renderTablaTrabajadores();
        } catch(e) { console.error('Error:', e); }
    },

    renderTablaTrabajadores() {
        const tbody = document.getElementById('ast-tabla-trabajadores');
        if (!tbody) return;
        let data = this.todosTrabajadores;
        const busqueda = (document.getElementById('ast-hero-buscar')?.value || '').toLowerCase();
        if (busqueda) data = data.filter(t => t.nombre.toLowerCase().includes(busqueda) || t.rut.toLowerCase().includes(busqueda));
        if (this.trabFilter === 'activos') data = data.filter(t => t.activo);
        else if (this.trabFilter === 'inactivos') data = data.filter(t => !t.activo);

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:32px;color:#94a3b8">Sin trabajadores</td></tr>';
            return;
        }

        const colors = ['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#06b6d4','#ef4444','#6366f1'];
        tbody.innerHTML = data.map((t, i) => {
            const ini = t.nombre.split(' ').map(n => n[0]).join('').slice(0, 2);
            const bg = colors[i % colors.length];
            return '<tr style="border-bottom:1px solid #f1f5f9' + (t.activo ? '' : ';opacity:0.55') + '">'
                + '<td style="padding:12px 16px"><div style="display:flex;align-items:center;gap:10px"><div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,' + bg + ',' + bg + 'dd);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:700">' + ini + '</div><strong style="color:#1e293b">' + t.nombre + '</strong></div></td>'
                + '<td style="padding:12px 16px;color:#475569;font-size:12px">' + t.rut + '</td>'
                + '<td style="padding:12px 16px"><span class="ast-badge" style="' + (t.activo ? 'background:#d1fae5;color:#059669' : 'background:#fee2e2;color:#dc2626') + '">' + (t.activo ? 'Activo' : 'Inactivo') + '</span></td>'
                + '<td style="padding:12px 16px;text-align:center"><div style="display:flex;gap:4px;justify-content:center">'
                + '<button onclick="Asistencia.editarTrabajador(' + t.id + ')" class="ast-btn" style="background:#eff6ff;color:#3b82f6;font-size:10px;padding:5px 10px;border:1px solid #bfdbfe">Editar</button>'
                + '<button onclick="Asistencia.toggleTrabajador(' + t.id + ',' + t.activo + ')" class="ast-btn" style="background:' + (t.activo ? '#fef3c7;color:#d97706;border:1px solid #fde68a' : '#d1fae5;color:#059669;border:1px solid #a7f3d0') + ';font-size:10px;padding:5px 10px">' + (t.activo ? 'Desactivar' : 'Activar') + '</button>'
                + '</div></td></tr>';
        }).join('');
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
        document.getElementById('ast-form-title').textContent = 'Editar Trabajador';
    },

    async guardarTrabajador() {
        const id = document.getElementById('ast-trab-id').value;
        const rut = document.getElementById('ast-trab-rut').value.trim();
        const nombre = document.getElementById('ast-trab-nombre').value.trim();
        if (!rut || !nombre) return;

        if (id) {
            await fetch('/api/asistencia/trabajadores/' + id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rut, nombre })
            });
        } else {
            await fetch('/api/asistencia/trabajadores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rut, nombre })
            });
        }
        this.hideFormTrabajador();
        await this.cargarTodosTrabajadores();
        this.llenarSelectores();
    },

    async toggleTrabajador(id, activo) {
        await fetch('/api/asistencia/trabajadores/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activo: !activo })
        });
        await this.cargarTodosTrabajadores();
        this.llenarSelectores();
    },

    // ═══════ ASISTENCIA DIARIA ═══════
    async renderDiaria(c) {
        c.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px">
                <div class="ast-card" style="background:white;border:1px solid #e2e8f0;border-left:4px solid #22c55e;border-radius:10px;padding:16px 18px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:astFadeUp 0.4s ease 0ms both">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px"><div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#f0fdf4,#bbf7d0);display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div><div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Presentes</div></div>
                    <div id="ast-stat-presentes" style="font-size:28px;font-weight:800;color:#059669;line-height:1">0</div>
                </div>
                <div class="ast-card" style="background:white;border:1px solid #e2e8f0;border-left:4px solid #ef4444;border-radius:10px;padding:16px 18px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:astFadeUp 0.4s ease 60ms both">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px"><div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#fef2f2,#fecaca);display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div><div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Faltas</div></div>
                    <div id="ast-stat-faltas" style="font-size:28px;font-weight:800;color:#dc2626;line-height:1">0</div>
                </div>
                <div class="ast-card" style="background:white;border:1px solid #e2e8f0;border-left:4px solid #3b82f6;border-radius:10px;padding:16px 18px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:astFadeUp 0.4s ease 120ms both">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px"><div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#eff6ff,#bfdbfe);display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div><div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Total</div></div>
                    <div id="ast-stat-total" style="font-size:28px;font-weight:800;color:#1e293b;line-height:1">0</div>
                </div>
            </div>

            <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);margin-bottom:20px;animation:astFadeUp 0.4s ease 180ms both">
                <div id="ast-trabajadores" style="max-height:500px;overflow-y:auto"></div>
            </div>

            <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:astFadeUp 0.4s ease 240ms both">
                <div style="padding:18px 22px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between">
                    <div style="display:flex;align-items:center;gap:10px">
                        <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#fef2f2,#fecaca);display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>
                        <div><h3 style="margin:0;font-size:14px;font-weight:700;color:#1e293b">Faltas del Día</h3></div>
                    </div>
                    <span id="ast-badge-faltas" style="background:#fee2e2;color:#dc2626;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700">0 faltas</span>
                </div>
                <div style="overflow-x:auto">
                    <table style="width:100%;border-collapse:collapse;font-size:13px">
                        <thead><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">
                            <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Trabajador</th>
                            <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">RUT</th>
                            <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Estado</th>
                            <th style="padding:11px 16px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Acción</th>
                        </tr></thead>
                        <tbody id="ast-tabla-faltas"><tr><td colspan="4" style="text-align:center;padding:32px;color:#94a3b8;font-size:13px">Cargando datos...</td></tr></tbody>
                    </table>
                </div>
            </div>`;

        document.getElementById('ast-hero-fecha').value = new Date().toISOString().split('T')[0];
        document.getElementById('ast-hero-fecha').addEventListener('change', () => { this.lastLoadedDate = null; });
        await this.cargarTrabajadores();
        await this.cargarAsistencia();
    },

    async cargarTrabajadores() {
        try {
            const r = await fetch('/api/asistencia/trabajadores/activos');
            this.trabajadores = await r.json();
            this.renderTrabajadores();
            this.llenarSelectores();
        } catch(e) { console.error('Error:', e); }
    },

    renderTrabajadores() {
        const c = document.getElementById('ast-trabajadores');
        if (!c) return;
        const busqueda = (document.getElementById('ast-hero-buscar')?.value || '').toLowerCase();
        const filtrados = this.trabajadores.filter(t => !busqueda || t.nombre.toLowerCase().includes(busqueda) || t.rut.toLowerCase().includes(busqueda));
        c.innerHTML = filtrados.map((t, i) => {
            const falta = this.asistenciaHoy.find(a => a.trabajador_id === t.id);
            const ini = t.nombre.split(' ').map(n => n[0]).join('').slice(0, 2);
            const colors = ['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#06b6d4','#ef4444','#6366f1'];
            const bg = colors[i % colors.length];
            return `<div class="ast-worker">
                <div class="ast-avatar" style="background:linear-gradient(135deg,${bg},${bg}dd)">${ini}</div>
                <div style="flex:1;min-width:0">
                    <div style="font-size:13px;font-weight:600;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.nombre}</div>
                    <div style="font-size:11px;color:#94a3b8;margin-top:1px">${t.rut}</div>
                </div>
                <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
                    ${falta
                        ? '<span class="ast-badge" style="background:#fee2e2;color:#dc2626">Falta</span><button onclick="Asistencia.marcar(' + t.id + ',false)" class="ast-btn" style="background:#22c55e;color:white;font-size:11px;padding:6px 12px">Corregir</button>'
                        : '<span class="ast-badge" style="background:#d1fae5;color:#059669">Presente</span><button onclick="Asistencia.marcar(' + t.id + ',true)" class="ast-btn" style="background:#ef4444;color:white;font-size:11px;padding:6px 12px">Marcar Falta</button>'
                    }
                </div>
            </div>`;
        }).join('');
    },

    buscarTrabajadores() {
        this.renderTrabajadores();
    },

    async marcar(trabajadorId, falta) {
        try {
            const r = await fetch('/api/asistencia/marcar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trabajador_id: trabajadorId, falta })
            });
            if (r.ok) await this.cargarAsistencia();
        } catch(e) { console.error('Error:', e); }
    },

    async cargarAsistencia() {
        const fecha = document.getElementById('ast-hero-fecha')?.value;
        if (!fecha) return;
        if (this.lastLoadedDate === fecha && this.asistenciaHoy.length > 0) {
            return;
        }
        try {
            const r = await fetch('/api/asistencia/diaria?fecha=' + fecha);
            this.asistenciaHoy = await r.json();
            this.lastLoadedDate = fecha;
            this.renderTrabajadores();
            this.renderTablaFaltas();
            this.actualizarStats();
        } catch(e) { console.error('Error:', e); }
    },

    exportExcelTrabajadores() {
        const trabajadores = this.trabajadoresAdmin || this.trabajadores || [];
        let csv = 'Nombre,RUT,Estado\n';
        trabajadores.forEach(t => {
            csv += `"${t.nombre}","${t.rut || ''}","${t.activo ? 'Activo' : 'Inactivo'}"\n`;
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
        html += '<table><thead><tr><th>Nombre</th><th>RUT</th><th>Estado</th></tr></thead><tbody>';
        trabajadores.forEach(t => {
            html += '<tr><td>' + t.nombre + '</td><td>' + (t.rut || '') + '</td><td class="' + (t.activo ? 'activo' : 'inactivo') + '">' + (t.activo ? 'Activo' : 'Inactivo') + '</td></tr>';
        });
        html += '</tbody></table></body></html>';
        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        setTimeout(() => { win.print(); }, 500);
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
            return;
        }
        tbody.innerHTML = f.map(a => '<tr style="border-bottom:1px solid #f1f5f9">'
            + '<td style="padding:12px 16px"><strong style="color:#1e293b">' + a.nombre + '</strong></td>'
            + '<td style="padding:12px 16px;color:#64748b;font-size:12px">' + a.rut + '</td>'
            + '<td style="padding:12px 16px"><span class="ast-badge" style="background:#fee2e2;color:#dc2626">Falta</span></td>'
            + '<td style="padding:12px 16px;text-align:center"><button onclick="Asistencia.marcar(' + a.trabajador_id + ',false)" class="ast-btn" style="background:#22c55e;color:white;font-size:11px">Corregir</button></td>'
            + '</tr>').join('');
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
                    <div style="margin-left:auto;position:relative">
                        <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" id="ast-cal-buscar" class="ast-input" placeholder="Buscar trabajador..." oninput="Asistencia.filtrarCalendario()" style="padding-left:32px;width:180px;font-size:11px">
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
            const r = await fetch('/api/asistencia/calendario?mes=' + mes + '&anio=' + anio);
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

        let html = '<div class="ast-cal-header" style="grid-template-columns:160px repeat(' + diasEnMes + ',1fr)">';
        html += '<div style="padding:8px 12px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;border-right:1px solid #e2e8f0">Trabajador</div>';
        for (let d = 1; d <= diasEnMes; d++) {
            const fecha = new Date(anio, mes - 1, d);
            const esFin = fecha.getDay() === 0 || fecha.getDay() === 6;
            const esHoy = d === hoy.getDate() && mes === (hoy.getMonth() + 1) && parseInt(anio) === hoy.getFullYear();
            html += '<div class="ast-cal-cell' + (esFin ? ' fin-semana' : '') + (esHoy ? ' hoy' : '') + '" style="flex-direction:column;padding:3px 1px;border-right:1px solid #f1f5f9"><div style="font-weight:600;font-size:9px">' + d + '</div><div style="font-size:7px;opacity:0.6">' + diasSemana[fecha.getDay()] + '</div></div>';
        }
        html += '</div>';

        filtered.forEach(t => {
            html += '<div class="ast-cal-row" style="grid-template-columns:160px repeat(' + diasEnMes + ',1fr)">';
            html += '<div style="padding:6px 10px;font-size:11px;font-weight:600;color:#1e293b;display:flex;align-items:center;gap:8px;border-right:1px solid #e2e8f0;background:#fafbfc;position:sticky;left:0;z-index:1"><div style="width:22px;height:22px;border-radius:6px;background:linear-gradient(135deg,#3b82f6,#2563eb);display:flex;align-items:center;justify-content:center;color:white;font-size:8px;font-weight:700">' + t.nombre.split(' ').map(n => n[0]).join('').slice(0, 2) + '</div><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + t.nombre + '">' + t.nombre + '</span></div>';

            for (let d = 1; d <= diasEnMes; d++) {
                const fechaStr = anio + '-' + String(mes).padStart(2, '0') + '-' + String(d).padStart(2, '0');
                const fecha = new Date(anio, mes - 1, d);
                const esFin = fecha.getDay() === 0 || fecha.getDay() === 6;
                let clase = esFin ? 'fin-semana' : '';
                let title = '';
                if (!esFin) {
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
                    else if (faltas.some(f => f.trabajador_id === t.id && f.fecha === fechaStr)) { clase = 'falta'; title = 'Falta'; }
                    else if (d <= hoy.getDate() && mes <= (hoy.getMonth() + 1) && parseInt(anio) <= hoy.getFullYear()) { clase = 'presente'; title = 'Presente'; }
                }
                let symbol = '';
                if (clase === 'presente') symbol = '<span style="color:#16a34a;font-weight:700;font-size:14px">&#10003;</span>';
                else if (clase === 'falta') symbol = '<span style="color:#dc2626;font-weight:700;font-size:14px">&#10005;</span>';
                else if (clase === 'vacaciones') symbol = '<span style="color:#2563eb;font-weight:700;font-size:12px">V</span>';
                else if (clase === 'licencia') symbol = '<span style="color:#ca8a04;font-weight:700;font-size:12px">L</span>';
                html += '<div class="ast-cal-cell ' + clase + '" title="' + title + '" style="border-right:1px solid #f1f5f9;cursor:default;display:flex;align-items:center;justify-content:center">' + symbol + '</div>';
            }
            html += '</div>';
        });
        c.innerHTML = html;
    },

    // ═══════ PERMISOS ═══════
    renderPermisosTab(c) {
        c.innerHTML = `
            <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:astFadeUp 0.4s ease 120ms both;overflow:hidden">
                <table style="width:100%;border-collapse:collapse;font-size:13px">
                    <thead><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Trabajador</th>
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Tipo</th>
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Inicio</th>
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Fin</th>
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Motivo</th>
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Estado</th>
                        <th style="padding:11px 16px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Acciones</th>
                    </tr></thead>
                    <tbody id="ast-tabla-permisos"><tr><td colspan="7" style="text-align:center;padding:32px;color:#94a3b8">Cargando...</td></tr></tbody>
                </table>
            </div>`;
        this.cargarPermisos();
    },

    async cargarPermisos() {
        const mes = document.getElementById('ast-hero-mes')?.value;
        if (!mes) return;
        try {
            const r = await fetch('/api/asistencia/permisos?mes=' + mes + '&anio=' + new Date().getFullYear());
            const permisos = await r.json();
            const tbody = document.getElementById('ast-tabla-permisos');
            if (!tbody) return;
            if (permisos.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:#94a3b8">Sin permisos registrados</td></tr>'; return; }
            const tipoL = { medico: 'Médico', personal: 'Personal', familiar: 'Familiar', otro: 'Otro' };
            tbody.innerHTML = permisos.map(p => {
                const ec = p.estado === 'aprobado' ? 'background:#d1fae5;color:#059669' : p.estado === 'rechazado' ? 'background:#fee2e2;color:#dc2626' : 'background:#fef3c7;color:#d97706';
                return '<tr style="border-bottom:1px solid #f1f5f9">'
                    + '<td style="padding:12px 16px"><strong style="color:#1e293b">' + p.nombre + '</strong></td>'
                    + '<td style="padding:12px 16px;color:#475569">' + (tipoL[p.tipo] || p.tipo) + '</td>'
                    + '<td style="padding:12px 16px;color:#475569;font-size:12px">' + this.fmtDate(p.fecha_inicio) + '</td>'
                    + '<td style="padding:12px 16px;color:#475569;font-size:12px">' + this.fmtDate(p.fecha_fin) + '</td>'
                    + '<td style="padding:12px 16px;color:#64748b;font-size:12px">' + (p.motivo || '-') + '</td>'
                    + '<td style="padding:12px 16px"><span class="ast-badge" style="' + ec + '">' + p.estado + '</span></td>'
                    + '<td style="padding:12px 16px;text-align:center;white-space:nowrap">'
                    + (p.estado === 'pendiente' && ((JSON.parse(localStorage.getItem('unified_user') || '{}').permisos || []).includes('asistencia.editar') || (JSON.parse(localStorage.getItem('unified_user') || '{}').permisos || []).includes('usuarios'))
                        ? '<button onclick="Asistencia.estadoPermiso(' + p.id + ',\'aprobado\')" class="ast-btn" style="background:#22c55e;color:white;font-size:10px;padding:4px 8px;margin-right:4px">&#10003;</button><button onclick="Asistencia.estadoPermiso(' + p.id + ',\'rechazado\')" class="ast-btn" style="background:#ef4444;color:white;font-size:10px;padding:4px 8px;margin-right:4px">&#10005;</button>'
                        : '')
                    + '<button onclick="Asistencia.editarPermiso(' + p.id + ')" style="background:#eff6ff;color:#3b82f6;border:1px solid #bfdbfe;padding:4px 8px;border-radius:6px;font-size:10px;font-weight:600;cursor:pointer;margin-right:4px" onmouseover="this.style.background=\'#dbeafe\'" onmouseout="this.style.background=\'#eff6ff\'">&#9998;</button>'
                    + '<button onclick="Asistencia.eliminarPermiso(' + p.id + ')" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;padding:4px 8px;border-radius:6px;font-size:10px;font-weight:600;cursor:pointer" onmouseover="this.style.background=\'#fee2e2\'" onmouseout="this.style.background=\'#fef2f2\'">&#128465;</button>'
                    + '</td></tr>';
            }).join('');
        } catch(e) { console.error('Error:', e); }
    },

    async estadoPermiso(id, estado) {
        await fetch('/api/asistencia/permisos/' + id + '/estado', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado }) });
        this.cargarPermisos();
    },

    editarPermiso(id) {
        fetch('/api/asistencia/permisos?mes=' + new Date().getMonth() + 1 + '&anio=' + new Date().getFullYear()).then(r => r.json()).then(permisos => {
            const p = permisos.find(x => x.id === id);
            if (!p) return;
            document.getElementById('permiso-trabajador').value = p.trabajador_id;
            document.getElementById('permiso-tipo').value = p.tipo;
            document.getElementById('permiso-inicio').value = p.fecha_inicio ? p.fecha_inicio.split('T')[0] : '';
            document.getElementById('permiso-fin').value = p.fecha_fin ? p.fecha_fin.split('T')[0] : '';
            document.getElementById('permiso-motivo').value = p.motivo || '';
            document.getElementById('modalPermiso').dataset.editId = id;
            document.getElementById('modalPermiso').classList.add('show');
        });
    },

    async eliminarPermiso(id) {
        if (!confirm('¿Eliminar este permiso?')) return;
        try {
            await fetch('/api/asistencia/permisos/' + id, { method: 'DELETE' });
            this.cargarPermisos();
        } catch(e) { console.error('Error:', e); }
    },

    abrirModalPermiso() { document.getElementById('modalPermiso').classList.add('show'); },
    cerrarModalPermiso() { document.getElementById('modalPermiso').classList.remove('show'); },
    async guardarPermiso() {
        const editId = document.getElementById('modalPermiso').dataset.editId;
        const d = { trabajador_id: document.getElementById('permiso-trabajador').value, tipo: document.getElementById('permiso-tipo').value, fecha_inicio: document.getElementById('permiso-inicio').value, fecha_fin: document.getElementById('permiso-fin').value, motivo: document.getElementById('permiso-motivo').value };
        if (!d.trabajador_id || !d.fecha_inicio || !d.fecha_fin) return;
        if (editId) {
            await fetch('/api/asistencia/permisos/' + editId, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
            delete document.getElementById('modalPermiso').dataset.editId;
        } else {
            await fetch('/api/asistencia/permisos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
        }
        this.cerrarModalPermiso(); this.cargarPermisos();
    },

    // ═══════ LICENCIAS ═══════
    renderLicenciasTab(c) {
        c.innerHTML = `
            <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:astFadeUp 0.4s ease 120ms both;overflow:hidden">
                <table style="width:100%;border-collapse:collapse;font-size:13px">
                    <thead><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Trabajador</th>
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Inicio</th>
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Fin</th>
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Días</th>
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Diagnóstico</th>
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Estado</th>
                        <th style="padding:11px 16px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Acciones</th>
                    </tr></thead>
                    <tbody id="ast-tabla-licencias"><tr><td colspan="7" style="text-align:center;padding:32px;color:#94a3b8">Cargando...</td></tr></tbody>
                </table>
            </div>`;
        this.cargarLicencias();
    },

    async cargarLicencias() {
        const mes = document.getElementById('ast-hero-mes')?.value;
        if (!mes) return;
        try {
            const r = await fetch('/api/asistencia/licencias?mes=' + mes + '&anio=' + new Date().getFullYear());
            const licencias = await r.json();
            const tbody = document.getElementById('ast-tabla-licencias');
            if (!tbody) return;
            if (licencias.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:#94a3b8">Sin licencias registradas</td></tr>'; return; }
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
                    + (l.estado === 'pendiente' && ((JSON.parse(localStorage.getItem('unified_user') || '{}').permisos || []).includes('asistencia.editar') || (JSON.parse(localStorage.getItem('unified_user') || '{}').permisos || []).includes('usuarios'))
                        ? '<button onclick="Asistencia.estadoLicencia(' + l.id + ',\'aprobada\')" class="ast-btn" style="background:#22c55e;color:white;font-size:10px;padding:4px 8px;margin-right:4px">&#10003;</button><button onclick="Asistencia.estadoLicencia(' + l.id + ',\'rechazada\')" class="ast-btn" style="background:#ef4444;color:white;font-size:10px;padding:4px 8px;margin-right:4px">&#10005;</button>'
                        : '')
                    + '<button onclick="Asistencia.editarLicencia(' + l.id + ')" style="background:#eff6ff;color:#3b82f6;border:1px solid #bfdbfe;padding:4px 8px;border-radius:6px;font-size:10px;font-weight:600;cursor:pointer;margin-right:4px" onmouseover="this.style.background=\'#dbeafe\'" onmouseout="this.style.background=\'#eff6ff\'">&#9998;</button>'
                    + '<button onclick="Asistencia.eliminarLicencia(' + l.id + ')" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;padding:4px 8px;border-radius:6px;font-size:10px;font-weight:600;cursor:pointer" onmouseover="this.style.background=\'#fee2e2\'" onmouseout="this.style.background=\'#fef2f2\'">&#128465;</button>'
                    + '</td></tr>';
            }).join('');
        } catch(e) { console.error('Error:', e); }
    },

    async estadoLicencia(id, estado) {
        await fetch('/api/asistencia/licencias/' + id + '/estado', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado }) });
        this.cargarLicencias();
    },

    editarLicencia(id) {
        fetch('/api/asistencia/licencias').then(r => r.json()).then(licencias => {
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
        if (!confirm('¿Eliminar esta licencia?')) return;
        try {
            await fetch('/api/asistencia/licencias/' + id, { method: 'DELETE' });
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
            await fetch('/api/asistencia/licencias/' + editId, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
            delete document.getElementById('modalLicencia').dataset.editId;
        } else {
            await fetch('/api/asistencia/licencias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
        }
        this.cerrarModalLicencia(); this.cargarLicencias();
    },

    // ═══════ VACACIONES ═══════
    renderVacacionesTab(c) {
        c.innerHTML = `
            <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:astFadeUp 0.4s ease 60ms both;overflow:hidden">
                <table style="width:100%;border-collapse:collapse;font-size:13px">
                    <thead><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Trabajador</th>
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Inicio</th>
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Fin</th>
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Días</th>
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Estado</th>
                        <th style="padding:11px 16px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Acciones</th>
                    </tr></thead>
                    <tbody id="ast-tabla-vacaciones"><tr><td colspan="6" style="text-align:center;padding:32px;color:#94a3b8">Cargando...</td></tr></tbody>
                </table>
            </div>`;
        this.cargarVacaciones();
    },

    async cargarVacaciones() {
        const mes = document.getElementById('ast-hero-mes')?.value;
        try {
            const url = '/api/asistencia/vacaciones' + (mes ? '?mes=' + mes + '&anio=' + new Date().getFullYear() : '');
            const r = await fetch(url);
            const vacaciones = await r.json();
            const tbody = document.getElementById('ast-tabla-vacaciones');
            if (!tbody) return;
            if (vacaciones.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:#94a3b8">Sin vacaciones registradas</td></tr>'; return; }
            tbody.innerHTML = vacaciones.map(v => '<tr style="border-bottom:1px solid #f1f5f9">'
                + '<td style="padding:12px 16px"><strong style="color:#1e293b">' + v.nombre + '</strong></td>'
                + '<td style="padding:12px 16px;color:#475569;font-size:12px">' + this.fmtDate(v.fecha_inicio) + '</td>'
                + '<td style="padding:12px 16px;color:#475569;font-size:12px">' + this.fmtDate(v.fecha_fin) + '</td>'
                + '<td style="padding:12px 16px"><strong style="color:#1e293b">' + v.dias + '</strong> días</td>'
                + '<td style="padding:12px 16px"><span class="ast-badge" style="background:#dbeafe;color:#2563eb">' + (v.estado || 'Programado') + '</span></td>'
                + '<td style="padding:12px 16px;text-align:center;white-space:nowrap">'
                + '<button onclick="Asistencia.editarVacacion(' + v.id + ')" style="background:#eff6ff;color:#3b82f6;border:1px solid #bfdbfe;padding:5px 10px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;margin-right:4px" onmouseover="this.style.background=\'#dbeafe\'" onmouseout="this.style.background=\'#eff6ff\'">&#9998; Editar</button>'
                + '<button onclick="Asistencia.eliminarVacacion(' + v.id + ')" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;padding:5px 10px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer" onmouseover="this.style.background=\'#fee2e2\'" onmouseout="this.style.background=\'#fef2f2\'">&#128465; Eliminar</button>'
                + '</td></tr>').join('');
        } catch(e) { console.error('Error:', e); }
    },

    editarVacacion(id) {
        fetch('/api/asistencia/vacaciones').then(r => r.json()).then(vacaciones => {
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
        if (!confirm('¿Eliminar este registro de vacaciones?')) return;
        try {
            await fetch('/api/asistencia/vacaciones/' + id, { method: 'DELETE' });
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
            await fetch('/api/asistencia/vacaciones/' + editId, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
            delete document.getElementById('modalVacacion').dataset.editId;
        } else {
            await fetch('/api/asistencia/vacaciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
        }
        this.cerrarModalVacacion(); this.cargarVacaciones();
    },

    // ═══════ HORAS EXTRAS ═══════
    renderHorasExtrasTab(c) {
        c.innerHTML = `
            <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:astFadeUp 0.4s ease 60ms both;overflow:hidden">
                <table style="width:100%;border-collapse:collapse;font-size:13px">
                    <thead><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Trabajador</th>
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Fecha</th>
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Horas</th>
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Motivo</th>
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Estado</th>
                        <th style="padding:11px 16px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Acciones</th>
                    </tr></thead>
                    <tbody id="ast-tabla-horas-extras"><tr><td colspan="6" style="text-align:center;padding:32px;color:#94a3b8">Cargando...</td></tr></tbody>
                </table>
            </div>`;
        this.cargarHorasExtras();
    },

    async cargarHorasExtras() {
        const mes = document.getElementById('ast-hero-mes')?.value;
        try {
            const url = '/api/asistencia/horas-extras' + (mes ? '?mes=' + mes + '&anio=' + new Date().getFullYear() : '');
            const r = await fetch(url);
            const horasExtras = await r.json();
            const tbody = document.getElementById('ast-tabla-horas-extras');
            if (!tbody) return;
            if (horasExtras.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:#94a3b8">Sin horas extras registradas</td></tr>'; return; }
            tbody.innerHTML = horasExtras.map(he => {
                const ec = he.estado === 'aprobada' ? 'background:#d1fae5;color:#059669' : he.estado === 'rechazada' ? 'background:#fee2e2;color:#dc2626' : 'background:#dbeafe;color:#2563eb';
                const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
                const permUser = user.permisos || [];
                const puedeAprobar = permUser.includes('asistencia.editar') || permUser.includes('usuarios');
                return '<tr style="border-bottom:1px solid #f1f5f9">'
                + '<td style="padding:12px 16px"><strong style="color:#1e293b">' + he.nombre + '</strong></td>'
                + '<td style="padding:12px 16px;color:#475569;font-size:12px">' + this.fmtDate(he.fecha) + '</td>'
                + '<td style="padding:12px 16px"><strong style="color:#1e293b">' + he.horas + '</strong> hrs</td>'
                + '<td style="padding:12px 16px;color:#475569;font-size:12px">' + (he.motivo || '-') + '</td>'
                + '<td style="padding:12px 16px"><span class="ast-badge" style="' + ec + '">' + (he.estado || 'pendiente') + '</span></td>'
                + '<td style="padding:12px 16px;text-align:center;white-space:nowrap">'
                + (puedeAprobar && (!he.estado || he.estado === 'pendiente') ? '<button onclick="Asistencia.estadoHorasExtras(' + he.id + ',\'aprobada\')" style="background:#22c55e;color:white;border:none;padding:5px 10px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;margin-right:4px">&#10003;</button><button onclick="Asistencia.estadoHorasExtras(' + he.id + ',\'rechazada\')" style="background:#ef4444;color:white;border:none;padding:5px 10px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;margin-right:4px">&#10005;</button>' : '')
                + '<button onclick="Asistencia.editarHorasExtras(' + he.id + ')" style="background:#eff6ff;color:#3b82f6;border:1px solid #bfdbfe;padding:5px 10px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;margin-right:4px" onmouseover="this.style.background=\'#dbeafe\'" onmouseout="this.style.background=\'#eff6ff\'">&#9998;</button>'
                + '<button onclick="Asistencia.eliminarHorasExtras(' + he.id + ')" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;padding:5px 10px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer" onmouseover="this.style.background=\'#fee2e2\'" onmouseout="this.style.background=\'#fef2f2\'">&#128465;</button>'
                + '</td></tr>';
            }).join('');
        } catch(e) { console.error('Error:', e); }
    },

    editarHorasExtras(id) {
        fetch('/api/asistencia/horas-extras').then(r => r.json()).then(horasExtras => {
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
        if (!confirm('¿Eliminar este registro de horas extras?')) return;
        try {
            await fetch('/api/asistencia/horas-extras/' + id, { method: 'DELETE' });
            this.cargarHorasExtras();
        } catch(e) { console.error('Error:', e); }
    },

    async estadoHorasExtras(id, estado) {
        try {
            await fetch('/api/asistencia/horas-extras/' + id + '/estado', {
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
        fetch('/api/asistencia/trabajadores').then(r => r.json()).then(trabajadores => {
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
            await fetch('/api/asistencia/horas-extras/' + editId, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
            delete document.getElementById('modalHorasExtras').dataset.editId;
        } else {
            await fetch('/api/asistencia/horas-extras', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
        }
        this.cerrarModalHorasExtras(); this.cargarHorasExtras();
    },

    // ═══════ REPORTES ═══════
    renderReportesTab(c) {
        c.innerHTML = `
            <div id="ast-ranking-container" style="margin-bottom:24px;animation:astFadeUp 0.4s ease 60ms both"></div>

            <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:astFadeUp 0.4s ease 120ms both;overflow:hidden">
                <div style="overflow:auto;max-height:65vh">
                <table style="width:100%;border-collapse:collapse;font-size:13px">
                    <thead style="position:sticky;top:0;z-index:2"><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">#</th>
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Trabajador</th>
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Asistidos</th>
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Faltas</th>
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Permisos</th>
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Licencias</th>
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Vacaciones</th>
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">H. Extras</th>
                        <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">% Asistencia</th>
                    </tr></thead>
                    <tbody id="ast-tabla-reporte"><tr><td colspan="9" style="text-align:center;padding:32px;color:#94a3b8">Cargando reporte...</td></tr></tbody>
                </table>
                </div>
            </div>`;

        setTimeout(() => this.cargarReportes(), 100);
    },

    async cargarReportes() {
        const mes = document.getElementById('ast-hero-mes')?.value || (new Date().getMonth() + 1);
        const anio = new Date().getFullYear();
        try {
            const [reporteR, rankAR] = await Promise.all([
                fetch('/api/asistencia/reporte-mensual?mes=' + mes + '&anio=' + anio),
                fetch('/api/asistencia/ranking?mes=' + mes + '&anio=' + anio + '&tipo=asistencia')
            ]);
            if (!reporteR.ok) { console.error('Reporte API error:', await reporteR.text()); return; }
            const reporte = await reporteR.json();
            const ranking = rankAR.ok ? await rankAR.json() : [];
            this.renderReporte(reporte);
            this.renderRanking(ranking);
        } catch(e) { console.error('Error cargando reportes:', e); }
    },

    renderReporte(reporte) {
        const tbody = document.getElementById('ast-tabla-reporte');
        if (!tbody) return;
        if (reporte.length === 0) { tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:#94a3b8">Sin datos</td></tr>'; return; }
        const mes = parseInt(document.getElementById('ast-hero-mes')?.value) || (new Date().getMonth() + 1);
        const anio = new Date().getFullYear();
        const hoy = new Date();
        let diasHabiles = 0;
        if (hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes) {
            for (let d = 1; d <= hoy.getDate(); d++) {
                const fecha = new Date(anio, mes - 1, d);
                const dow = fecha.getDay();
                if (dow !== 0 && dow !== 6) diasHabiles++;
            }
        } else if (hoy.getFullYear() > anio || (hoy.getFullYear() === anio && hoy.getMonth() + 1 > mes)) {
            const diasEnMes = new Date(anio, mes, 0).getDate();
            for (let d = 1; d <= diasEnMes; d++) {
                const fecha = new Date(anio, mes - 1, d);
                const dow = fecha.getDay();
                if (dow !== 0 && dow !== 6) diasHabiles++;
            }
        }
        tbody.innerHTML = reporte.map((r, i) => {
            const faltas = Number(r.faltas) || 0;
            const asistidos = Math.max(0, diasHabiles - faltas);
            const permisos = Number(r.permisos_aprobados) || 0;
            const licencias = Number(r.dias_licencia) || 0;
            const vacaciones = Number(r.dias_vacaciones) || 0;
            const pct = diasHabiles > 0 ? Math.round((asistidos / diasHabiles) * 100) : 0;
            const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';
            const he = Number(r.horas_extras) || 0;
            return '<tr style="border-bottom:1px solid #f1f5f9">'
                + '<td style="padding:12px 16px"><strong style="color:#1e293b">' + (i + 1) + '</strong></td>'
                + '<td style="padding:12px 16px"><strong style="color:#1e293b">' + r.nombre + '</strong></td>'
                + '<td style="padding:12px 16px;color:#475569">' + asistidos + '</td>'
                + '<td style="padding:12px 16px"><strong style="color:' + (faltas > 0 ? '#dc2626' : '#475569') + '">' + faltas + '</strong></td>'
                + '<td style="padding:12px 16px"><span style="font-weight:600;color:' + (permisos > 0 ? '#d97706' : '#475569') + '">' + permisos + '</span></td>'
                + '<td style="padding:12px 16px"><span style="font-weight:600;color:' + (licencias > 0 ? '#d97706' : '#475569') + '">' + licencias + ' días</span></td>'
                + '<td style="padding:12px 16px"><span style="font-weight:600;color:' + (vacaciones > 0 ? '#d97706' : '#475569') + '">' + vacaciones + ' días</span></td>'
                + '<td style="padding:12px 16px"><span style="font-weight:700;color:' + (he > 0 ? '#8b5cf6' : '#94a3b8') + '">' + he.toFixed(1) + ' hrs</span></td>'
                + '<td style="padding:12px 16px"><div style="display:flex;align-items:center;gap:8px"><div style="width:60px;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden"><div style="width:' + pct + '%;height:100%;background:' + color + ';border-radius:3px"></div></div><span style="font-size:12px;font-weight:700;color:' + color + '">' + pct + '%</span></div></td>'
                + '</tr>';
        }).join('');
    },

    renderRanking(ranking) {
        const c = document.getElementById('ast-ranking-container');
        if (!c) return;
        if (ranking.length === 0) { c.innerHTML = ''; return; }
        const medals = ['🥇','🥈','🥉'];
        const sizes = [180, 160, 150];
        const orders = [2, 1, 3];
        const colors = ['#f59e0b','#94a3b8','#cd7f32'];
        const mes = parseInt(document.getElementById('ast-hero-mes')?.value) || (new Date().getMonth() + 1);
        const anio = new Date().getFullYear();
        const hoy = new Date();
        let diasHabiles = 0;
        if (hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes) {
            for (let d = 1; d <= hoy.getDate(); d++) {
                const fecha = new Date(anio, mes - 1, d);
                if (fecha.getDay() !== 0 && fecha.getDay() !== 6) diasHabiles++;
            }
        } else if (hoy.getFullYear() > anio || (hoy.getFullYear() === anio && hoy.getMonth() + 1 > mes)) {
            const diasEnMes = new Date(anio, mes, 0).getDate();
            for (let d = 1; d <= diasEnMes; d++) {
                const fecha = new Date(anio, mes - 1, d);
                if (fecha.getDay() !== 0 && fecha.getDay() !== 6) diasHabiles++;
            }
        }
        c.innerHTML = '<div class="ast-podium">' + ranking.slice(0, 3).map((r, i) => {
            const dias = Math.max(0, diasHabiles - (Number(r.faltas) || 0));
            return '<div class="ast-rank" style="order:' + orders[i] + ';min-width:' + sizes[i] + 'px">'
            + '<div style="font-size:32px;margin-bottom:6px">' + medals[i] + '</div>'
            + '<div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px">' + r.nombre + '</div>'
            + '<div style="font-size:24px;font-weight:800;color:' + colors[i] + '">' + dias + '</div>'
            + '<div style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;font-weight:600;margin-top:2px">días</div>'
            + '</div>';
        }).join('') + '</div>';
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
    }
};

// ═══════ Registrar módulo ═══════
if (typeof App !== 'undefined') {
    App.registerModule('asistencia', Asistencia);
}
