// ═══════════════════════════════════════════════════════
// VitroFlow - Módulo de Reclamos y Devoluciones
// ═══════════════════════════════════════════════════════

const Reclamos = {
    _data: [],
    _responsables: [],
    _motivosCache: {},
    _currentFilter: 'TODOS',
    _editingId: null,

    async render() {
        const page = document.getElementById('page-reclamos');
        if (!page) return;

        page.innerHTML = `
            <style>
                .rc-hero{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#7c3aed 100%);border-radius:14px;padding:16px 20px;margin-bottom:16px;position:relative;overflow:hidden}
                .rc-hero-inner{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
                .rc-filter-btn{padding:6px 14px;font-size:11px;font-weight:600;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.7);cursor:pointer;transition:all 0.15s}
                .rc-filter-btn:hover{background:rgba(255,255,255,0.2);color:white}
                .rc-filter-btn.active{background:white;color:#1e293b;border-color:white;box-shadow:0 2px 8px rgba(0,0,0,0.2)}
                .rc-section{background:white;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:16px;overflow:hidden}
                .rc-section-header{padding:12px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #f1f5f9}
                .rc-section-body{padding:16px}
                .rc-form-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
                .rc-form-grid>div{min-width:0}
                .rc-form-grid label{display:block;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px}
                .rc-form-grid input,.rc-form-grid select,.rc-form-grid textarea{width:100%;box-sizing:border-box;padding:9px 12px;font-size:13px;border:1px solid #e2e8f0;border-radius:8px;outline:none;transition:all 0.15s;font-family:inherit}
                .rc-form-grid input:focus,.rc-form-grid select:focus,.rc-form-grid textarea:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,0.1)}
                .rc-form-grid input[readonly]{background:#f8fafc;color:#64748b}
                .rc-badge{display:inline-flex;align-items:center;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;letter-spacing:0.3px}
                .rc-badge-pendiente{background:#fef3c7;color:#92400e}
                .rc-badge-revision{background:#dbeafe;color:#1e40af}
                .rc-badge-finalizado{background:#d1fae5;color:#059669}
                .rc-stat-card{background:white;border:1px solid #e2e8f0;border-radius:12px;padding:14px;display:flex;align-items:center;gap:12px;transition:all 0.2s}
                .rc-stat-card:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,0.08)}
                .rc-stat-icon{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
                .rc-stat-value{font-size:22px;font-weight:800;line-height:1}
                .rc-stat-label{font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px}
                .rc-fotos-grid{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
                .rc-foto-thumb{width:60px;height:60px;border-radius:8px;object-fit:cover;border:2px solid #e2e8f0;cursor:pointer;transition:all 0.15s}
                .rc-foto-thumb:hover{border-color:#3b82f6;transform:scale(1.05)}
                @media(max-width:768px){
                    .rc-form-grid{grid-template-columns:1fr}
                    .rc-hero-inner{flex-direction:column;align-items:stretch}
                    .rc-stats-grid{grid-template-columns:repeat(2,1fr)!important}
                }
                @media(min-width:769px) and (max-width:1024px){
                    .rc-form-grid{grid-template-columns:repeat(2,1fr)}
                }
                .rc-codigo-wrap{position:relative}
                .rc-codigo-drop{position:absolute;top:100%;left:0;right:0;max-height:220px;overflow-y:auto;background:white;border:1px solid #e2e8f0;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.12);z-index:100;display:none;margin-top:2px}
                .rc-codigo-drop.show{display:block}
                .rc-codigo-drop input{width:100%;box-sizing:border-box;padding:8px 10px;font-size:12px;border:none;border-bottom:1px solid #e2e8f0;outline:none}
                .rc-codigo-item{padding:7px 10px;font-size:11px;cursor:pointer;display:flex;gap:8px;align-items:center;border-bottom:1px solid #f8fafc}
                .rc-codigo-item:hover{background:#eff6ff}
                .rc-codigo-item .rc-cod{font-weight:700;color:#3b82f6;min-width:50px}
                .rc-codigo-item .rc-desc{color:#475569;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
                .rc-codigo-item .rc-grp{font-size:10px;color:#94a3b8;white-space:nowrap}
            </style>

            <div class="rc-hero">
                <div style="position:absolute;top:-40px;right:-40px;width:200px;height:200px;background:radial-gradient(circle,rgba(124,58,237,0.3) 0%,transparent 70%);border-radius:50%"></div>
                <div class="rc-hero-inner">
                    <div>
                        <h2 style="margin:0;font-size:16px;font-weight:800;color:white">Reclamos y Devoluciones</h2>
                        <p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Gestión de control de calidad y reclamos de clientes</p>
                    </div>
                    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                        <button class="rc-filter-btn active" data-filter="TODOS" onclick="App.modules.reclamos.filtrar('TODOS')">Todos</button>
                        <button class="rc-filter-btn" data-filter="PENDIENTE" onclick="App.modules.reclamos.filtrar('PENDIENTE')">Pendientes</button>
                        <button class="rc-filter-btn" data-filter="EN REVISION" onclick="App.modules.reclamos.filtrar('EN REVISION')">En Revisión</button>
                        <button class="rc-filter-btn" data-filter="FINALIZADO" onclick="App.modules.reclamos.filtrar('FINALIZADO')">Finalizados</button>
                    </div>
                </div>
            </div>

            <div id="rc-stats" class="rc-stats-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px"></div>

            <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
                <div style="position:relative;flex:1;min-width:180px">
                    <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" id="rcBuscar" placeholder="Buscar por cliente, OV, código o folio..." oninput="App.modules.reclamos.buscar()" style="padding:9px 12px 9px 34px;width:100%;font-size:12px;border:1px solid #e2e8f0;border-radius:8px;outline:none">
                </div>
                <button onclick="App.modules.reclamos.showForm()" class="btn btn-accent" style="white-space:nowrap;padding:8px 14px;font-size:12px">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nuevo
                </button>
                <button onclick="App.modules.reclamos.showMatriz()" class="btn btn-accent" style="white-space:nowrap;padding:8px 14px;font-size:12px">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    Configuración
                </button>
            </div>

            <div id="rc-form-container" style="display:none"></div>
            <div id="rc-list-container"></div>
        `;

        await this.cargarDatos();
    },

    async cargarDatos() {
        try {
            const [reclamos, stats, responsables] = await Promise.all([
                authFetch('/api/reclamos').then(r => r.json()).catch(() => []),
                authFetch('/api/reclamos/dashboard/stats').then(r => r.json()).catch(() => ({})),
                authFetch('/api/reclamos/responsables/lista').then(r => r.json()).catch(() => [])
            ]);
            this._data = Array.isArray(reclamos) ? reclamos : [];
            this._responsables = Array.isArray(responsables) ? responsables : [];
            this.renderStats(stats || {});
            this.renderLista();
        } catch(e) { console.error('Error:', e); }
    },

    renderStats(s) {
        const el = document.getElementById('rc-stats');
        if (!el) return;
        el.innerHTML = `
            <div class="rc-stat-card">
                <div class="rc-stat-icon" style="background:linear-gradient(135deg,#eff6ff,#dbeafe)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                <div><div class="rc-stat-value" style="color:#3b82f6">${s.total || 0}</div><div class="rc-stat-label">Total</div></div>
            </div>
            <div class="rc-stat-card">
                <div class="rc-stat-icon" style="background:linear-gradient(135deg,#fffbeb,#fef3c7)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                <div><div class="rc-stat-value" style="color:#f59e0b">${s.pendientes || 0}</div><div class="rc-stat-label">Pendientes</div></div>
            </div>
            <div class="rc-stat-card">
                <div class="rc-stat-icon" style="background:linear-gradient(135deg,#eff6ff,#dbeafe)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
                <div><div class="rc-stat-value" style="color:#3b82f6">${s.en_revision || 0}</div><div class="rc-stat-label">En Revisión</div></div>
            </div>
            <div class="rc-stat-card">
                <div class="rc-stat-icon" style="background:linear-gradient(135deg,#f0fdf4,#dcfce7)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></div>
                <div><div class="rc-stat-value" style="color:#22c55e">${s.finalizados || 0}</div><div class="rc-stat-label">Finalizados</div></div>
            </div>
        `;
    },

    renderLista() {
        const el = document.getElementById('rc-list-container');
        if (!el) return;

        const buscar = (document.getElementById('rcBuscar')?.value || '').toLowerCase();
        let data = this._data;

        if (this._currentFilter !== 'TODOS') {
            data = data.filter(r => r.estado === this._currentFilter);
        }
        if (buscar) {
            data = data.filter(r => {
                const items = Array.isArray(r.items) ? r.items : [];
                const itemsText = items.map(it => (it.codigo + ' ' + it.descripcion + ' ' + it.item).toLowerCase()).join(' ');
                return (r.cliente || '').toLowerCase().includes(buscar) ||
                    (r.numero_orden || '').toLowerCase().includes(buscar) ||
                    (r.descripcion || '').toLowerCase().includes(buscar) ||
                    String(r.numero_reclamo || '').includes(buscar) ||
                    itemsText.includes(buscar);
            });
        }

        if (data.length === 0) {
            el.innerHTML = '<div style="text-align:center;padding:48px;background:white;border-radius:12px;border:1px solid #e2e8f0"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><h4 style="margin:12px 0 4px;color:#334155">Sin registros</h4><p style="margin:0;color:#94a3b8;font-size:13px">No hay reclamos con este filtro</p></div>';
            return;
        }

        // Tabla desktop
        let html = '<div style="background:white;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden"><div style="overflow-x:auto"><div class="sigma-table-wrap"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">';
        html += '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase">Folio</th>';
        html += '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase">Fecha</th>';
        html += '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase">Cliente</th>';
        html += '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase">OV</th>';
        html += '<th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase">Items</th>';
        html += '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase">Estado</th>';
        html += '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase">Resolución</th>';
        html += '<th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase">Acciones</th>';
        html += '</tr></thead><tbody>';

        data.forEach(r => {
            const badge = r.estado === 'PENDIENTE' ? 'rc-badge-pendiente' : r.estado === 'EN REVISION' ? 'rc-badge-revision' : 'rc-badge-finalizado';
            const resColor = r.resolucion === 'Rechazada' ? '#ef4444' : r.resolucion ? '#22c55e' : '#94a3b8';
            const items = Array.isArray(r.items) ? r.items : [];
            const itemsCount = items.length;
            const itemsResumen = itemsCount > 0
                ? (itemsCount === 1 ? (items[0].codigo || items[0].descripcion || '1 item') : itemsCount + ' items')
                : '-';
            html += '<tr style="border-bottom:1px solid #f1f5f9">';
            html += '<td style="padding:12px 14px"><strong style="color:#7c3aed;font-size:14px">#' + (r.numero_reclamo || '-') + '</strong></td>';
            html += '<td style="padding:12px 14px;color:#475569;font-size:12px">' + this.fmtDate(r.fecha_ingreso) + '</td>';
            html += '<td style="padding:12px 14px"><strong style="color:#1e293b">' + (r.cliente || '-') + '</strong></td>';
            html += '<td style="padding:12px 14px;color:#475569">' + (r.numero_orden || '-') + '</td>';
            html += '<td style="padding:12px 14px;text-align:center"><span style="background:#f1f5f9;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;color:#475569">' + itemsResumen + '</span></td>';
            html += '<td style="padding:12px 14px"><span class="rc-badge ' + badge + '">' + r.estado + '</span></td>';
            html += '<td style="padding:12px 14px"><span style="font-weight:600;color:' + resColor + ';font-size:12px">' + (r.resolucion || '-') + '</span></td>';
            html += '<td style="padding:12px 14px;text-align:center;white-space:nowrap">';
            // Botones de workflow rápido según estado
            if (r.estado === 'PENDIENTE') {
                html += '<button onclick="App.modules.reclamos.cambiarEstado(' + r.id + ',\'EN REVISION\')" class="btn btn-sm" style="background:#eff6ff;color:#3b82f6;border:1px solid #bfdbfe;margin-right:4px" title="Iniciar Revisión">🔍 Revisar</button>';
            } else if (r.estado === 'EN REVISION') {
                html += '<button onclick="App.modules.reclamos.cambiarEstado(' + r.id + ',\'FINALIZADO\')" class="btn btn-sm" style="background:#f0fdf4;color:#22c55e;border:1px solid #bbf7d0;margin-right:4px" title="Finalizar">✅ Fin</button>';
            }
            html += '<button onclick="App.modules.reclamos.showForm(' + r.id + ')" class="btn btn-sm btn-outline" style="margin-right:4px" title="Editar"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>';
            html += '<button onclick="App.modules.reclamos.showHistorial(' + r.id + ')" class="btn btn-sm btn-outline" style="margin-right:4px" title="Historial"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></button>';
            html += '<button onclick="App.modules.reclamos.eliminar(' + r.id + ')" class="btn btn-sm btn-danger" title="Eliminar"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>';
            html += '</td></tr>';
        });

        html += '</tbody></table></div></div></div>';

        // Cards móvil
        html += '<div class="m-cards-mobile" style="display:none">';
        data.forEach(r => {
            const badge = r.estado === 'PENDIENTE' ? 'rc-badge-pendiente' : r.estado === 'EN REVISION' ? 'rc-badge-revision' : 'rc-badge-finalizado';
            const borderColor = r.estado === 'PENDIENTE' ? '#f59e0b' : r.estado === 'EN REVISION' ? '#3b82f6' : '#22c55e';
            const items = Array.isArray(r.items) ? r.items : [];
            const itemsCount = items.length;
            html += '<div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:10px;border-left:4px solid ' + borderColor + '">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
            html += '<span style="font-weight:800;color:#7c3aed;font-size:16px">#' + (r.numero_reclamo || '-') + '</span>';
            html += '<span class="rc-badge ' + badge + '">' + r.estado + '</span>';
            html += '</div>';
            html += '<div style="font-weight:700;color:#0f172a;font-size:14px;margin-bottom:4px">' + (r.cliente || '-') + '</div>';
            html += '<div style="font-size:12px;color:#64748b;margin-bottom:6px">OV: ' + (r.numero_orden || '-') + ' · ' + itemsCount + ' item(s)</div>';
            if (items.length > 0) {
                html += '<div style="font-size:11px;color:#64748b;margin-bottom:6px">' + items.map(it => it.codigo || it.descripcion).filter(Boolean).join(', ') + '</div>';
            }
            if (r.resolucion) html += '<div style="font-size:11px;font-weight:600;color:' + (r.resolucion === 'Rechazada' ? '#ef4444' : '#22c55e') + ';margin-bottom:8px">Resolución: ' + r.resolucion + '</div>';
            html += '<div style="display:flex;gap:6px">';
            html += '<button onclick="App.modules.reclamos.showForm(' + r.id + ')" class="btn btn-sm btn-outline" style="flex:1">Editar</button>';
            html += '<button onclick="App.modules.reclamos.showHistorial(' + r.id + ')" class="btn btn-sm btn-outline" style="flex:1">Historial</button>';
            html += '<button onclick="App.modules.reclamos.eliminar(' + r.id + ')" class="btn btn-sm btn-danger">Eliminar</button>';
            html += '</div></div>';
        });
        html += '</div>';

        el.innerHTML = html;
    },

    filtrar(f) {
        this._currentFilter = f;
        document.querySelectorAll('.rc-filter-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.filter === f);
        });
        this.renderLista();
    },

    buscar() {
        this.renderLista();
    },

    async showForm(id) {
        this._editingId = id || null;
        let r = {};
        if (id) {
            r = this._data.find(x => x.id === id) || {};
        }

        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const permisos = user.permisos || [];
        const canCreate = permisos.includes('reclamos.agregar') || permisos.includes('usuarios');
        const canEdit = permisos.includes('reclamos.editar') || permisos.includes('usuarios');
        this._canCreate = canCreate;
        this._canEdit = canEdit;

        const container = document.getElementById('rc-form-container');
        container.style.display = 'block';

        // Cargar responsables si no están
        if (this._responsables.length === 0) {
            try {
                this._responsables = await authFetch('/api/reclamos/responsables/lista').then(r => r.json());
            } catch(e) {}
        }

        const respOptions = (Array.isArray(this._responsables) ? this._responsables : []).map(resp => '<option value="' + resp + '"' + (r.responsable_falla === resp ? ' selected' : '') + '>' + resp + '</option>').join('');
        const resolucionOptions = ['', 'Aceptada Fabricacion nueva', 'Aceptada Reproceso', 'Rechazada'].map(v =>
            '<option value="' + v + '"' + (r.resolucion === v ? ' selected' : '') + '>' + (v || 'Seleccionar...') + '</option>'
        ).join('');


        container.innerHTML = `
            <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:16px;overflow:hidden">
                <div style="padding:14px 18px;background:linear-gradient(135deg,#f8fafc,#f1f5f9);border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between">
                    <div style="display:flex;align-items:center;gap:10px">
                        <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#7c3aed,#6d28d9);display:flex;align-items:center;justify-content:center">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        </div>
                        <h3 style="margin:0;font-size:15px;font-weight:700;color:#1e293b">${id ? 'Editar Reclamo #' + (r.numero_reclamo || '') : 'Nuevo Reclamo / Devolución'}</h3>
                    </div>
                    <button onclick="App.modules.reclamos.hideForm()" class="btn btn-sm btn-outline">Cerrar</button>
                </div>

                <form onsubmit="App.modules.reclamos.guardar(event)" style="padding:16px">
                    <!-- SECCIÓN VENTAS (APERTURA) -->
                    <div class="rc-section">
                        <div class="rc-section-header" style="background:linear-gradient(135deg,#eff6ff,#dbeafe)">
                            <div style="width:28px;height:28px;border-radius:7px;background:linear-gradient(135deg,#3b82f6,#2563eb);display:flex;align-items:center;justify-content:center">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                            </div>
                            <div>
                                <h4 style="margin:0;font-size:13px;font-weight:700;color:#1e40af">Sección Ventas (Apertura)</h4>
                                <p style="margin:0;font-size:10px;color:#64748b">${canCreate ? 'Datos del cliente y detalle del reclamo' : 'Solo lectura — requiere permiso Agregar'}</p>
                            </div>
                        </div>
                        <div class="rc-section-body">
                            ${id ? '<div class="rc-form-grid" style="margin-bottom:10px">'
                                + '<div><label>Fecha Ingreso</label><input type="text" value="' + this.fmtDateTime(r.fecha_ingreso) + '" readonly style="background:#f8fafc;color:#64748b"></div>'
                                + '<div><label>Responsable Ingreso</label><input type="text" value="' + (r.responsable_ingreso || '') + '" readonly style="background:#f8fafc;color:#64748b"></div>'
                                + '<div><label>Estado</label><input type="text" value="' + (r.estado || 'PENDIENTE') + '" readonly style="background:#f8fafc;color:#64748b;font-weight:600"></div>'
                                + '</div>' : '<div class="rc-form-grid" style="margin-bottom:10px">'
                                + '<div><label>Fecha Ingreso</label><input type="text" value="' + new Date().toLocaleString('es-CL') + '" readonly style="background:#f8fafc;color:#64748b"></div>'
                                + '<div><label>Responsable Ingreso</label><input type="text" value="' + (JSON.parse(localStorage.getItem('unified_user') || '{}').nombre || JSON.parse(localStorage.getItem('unified_user') || '{}').email || '') + '" readonly style="background:#f8fafc;color:#64748b"></div>'
                                + '<div><label>Estado</label><input type="text" value="PENDIENTE" readonly style="background:#f8fafc;color:#64748b;font-weight:600"></div>'
                                + '</div>'}
                            <div class="rc-form-grid">
                                <div>
                                    <label>Cliente *</label>
                                    <input type="text" id="rcCliente" value="${r.cliente || ''}" required placeholder="Nombre del cliente" ${!canCreate ? 'readonly style="background:#f8fafc"' : ''}>
                                </div>
                                <div>
                                    <label>N° Orden de Venta (OV)</label>
                                    <input type="text" id="rcOrden" value="${r.numero_orden || ''}" placeholder="Ej: OV-12345" ${!canCreate ? 'readonly style="background:#f8fafc"' : ''}>
                                </div>
                                <div></div>
                            </div>

                            <!-- TABLA DE ITEMS -->
                            <div style="margin-top:14px">
                                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                                    <label style="margin:0;font-size:12px;font-weight:700;color:#1e293b">Items del Reclamo</label>
                                    ${canCreate ? '<button type="button" onclick="App.modules.reclamos.addItem()" class="btn btn-accent" style="padding:5px 12px;font-size:11px"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Agregar Item</button>' : ''}
                                </div>
                                <div style="overflow-x:auto;border:1px solid #e2e8f0;border-radius:8px">
                                    <table style="width:100%;border-collapse:collapse;font-size:11px" id="rcItemsTable">
                                        <thead>
                                            <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">
                                                <th style="padding:6px 8px;text-align:center;font-size:10px;font-weight:700;color:#64748b;min-width:30px">#</th>
                                                <th style="padding:6px 8px;text-align:left;font-size:10px;font-weight:700;color:#64748b;min-width:80px">Item</th>
                                                <th style="padding:6px 8px;text-align:left;font-size:10px;font-weight:700;color:#64748b;min-width:100px">Código</th>
                                                <th style="padding:6px 8px;text-align:left;font-size:10px;font-weight:700;color:#64748b;min-width:220px">Descripción</th>
                                                <th style="padding:6px 8px;text-align:right;font-size:10px;font-weight:700;color:#64748b;min-width:70px">Ancho</th>
                                                <th style="padding:6px 8px;text-align:right;font-size:10px;font-weight:700;color:#64748b;min-width:70px">Alto</th>
                                                <th style="padding:6px 8px;text-align:right;font-size:10px;font-weight:700;color:#64748b;min-width:60px">Espesor</th>
                                                <th style="padding:6px 8px;text-align:right;font-size:10px;font-weight:700;color:#64748b;min-width:60px">m²</th>
                                                <th style="padding:6px 8px;text-align:right;font-size:10px;font-weight:700;color:#64748b;min-width:60px">Kg</th>
                                                <th style="padding:6px 8px;text-align:right;font-size:10px;font-weight:700;color:#64748b;min-width:80px">V. Unitario</th>
                                                <th style="padding:6px 8px;text-align:center;font-size:10px;font-weight:700;color:#64748b;min-width:40px"></th>
                                            </tr>
                                        </thead>
                                        <tbody id="rcItemsBody"></tbody>
                                    </table>
                                </div>
                                <input type="hidden" id="rcItemsData" value='${JSON.stringify(r.items || [])}'>
                            </div>

                            <div style="margin-top:10px">
                                <label>Detalle del Reclamo *</label>
                                <textarea id="rcDetalle" rows="3" required placeholder="Describe el problema reportado por el cliente..." ${!canCreate ? 'readonly style="background:#f8fafc"' : ''}>${r.detalle_reclamo || ''}</textarea>
                            </div>
                            <div style="margin-top:10px">
                                <label>Fotos Adjuntas</label>
                                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                                    <input type="file" id="rcFotosInput" accept="image/*" multiple style="display:none" onchange="App.modules.reclamos.handleFotos(this)">
                                    <button type="button" onclick="document.getElementById('rcFotosInput').click()" class="btn btn-sm btn-outline" style="font-size:11px">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                        Adjuntar Fotos
                                    </button>
                                    <span id="rcFotosCount" style="font-size:11px;color:#64748b">${(r.fotos || []).length} foto(s) adjunta(s)</span>
                                </div>
                                <div id="rcFotosPreview" class="rc-fotos-grid"></div>
                                <input type="hidden" id="rcFotosData" value='${JSON.stringify(r.fotos || [])}'>
                            </div>
                        </div>
                    </div>

                    <!-- SECCIÓN CALIDAD / RESOLUCIÓN -->
                    <div class="rc-section">
                        <div class="rc-section-header" style="background:linear-gradient(135deg,#faf5ff,#f3e8ff)">
                            <div style="width:28px;height:28px;border-radius:7px;background:linear-gradient(135deg,#a855f7,#7c3aed);display:flex;align-items:center;justify-content:center">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                            </div>
                            <div>
                                <h4 style="margin:0;font-size:13px;font-weight:700;color:#6d28d9">Sección Calidad / Resolución</h4>
                                <p style="margin:0;font-size:10px;color:#64748b">${canEdit ? 'Análisis técnico y resolución del reclamo' : 'Solo lectura — requiere permiso Editar'}</p>
                            </div>
                        </div>
                        <div class="rc-section-body">
                            <div class="rc-form-grid">
                                <div>
                                    <label>Responsable de Falla</label>
                                    <select id="rcResponsableFalla" onchange="App.modules.reclamos.onResponsableChange()" ${!canEdit ? 'disabled' : ''}>
                                        <option value="">Seleccionar...</option>
                                        ${respOptions}
                                    </select>
                                </div>
                                <div>
                                    <label>Motivo</label>
                                    <select id="rcMotivo" ${!canEdit ? 'disabled' : ''}>
                                        <option value="">Seleccionar responsable primero...</option>
                                    </select>
                                </div>
                                <div>
                                    <label>Resolución</label>
                                    <select id="rcResolucion" ${!canEdit ? 'disabled' : ''}>${resolucionOptions}</select>
                                </div>
                            </div>
                            <div style="margin-top:10px">
                                <label>Observación / Análisis Técnico</label>
                                <textarea id="rcObservacion" rows="4" placeholder="Análisis técnico del problema, respuesta al cliente, acciones correctivas..." ${!canEdit ? 'readonly style="background:#f8fafc"' : ''}>${r.observacion_analisis || ''}</textarea>
                            </div>
                        </div>
                    </div>

                    <div style="display:flex;gap:8px;justify-content:flex-end;padding-top:12px;border-top:1px solid #f1f5f9">
                        <button type="button" onclick="App.modules.reclamos.hideForm()" class="btn btn-outline">Cancelar</button>
                        ${(canCreate || canEdit) ? '<button type="submit" class="btn btn-primary" style="padding:10px 28px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Guardar</button>' : ''}
                    </div>

                    ${id && canEdit ? this._renderWorkflowBar(r) : ''}
                </form>
            </div>
        `;

        // Renderizar items existentes
        this.renderItems();

        // Cerrar dropdown de código al hacer click fuera
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.rc-codigo-wrap')) this._closeCodigoSearch();
        });

        // Cargar motivos si hay responsable seleccionado
        if (r.responsable_falla) {
            await this.onResponsableChange();
            if (r.motivo) {
                document.getElementById('rcMotivo').value = r.motivo;
            }
        }

        // Scroll al formulario
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    hideForm() {
        const container = document.getElementById('rc-form-container');
        if (container) {
            container.style.display = 'none';
            container.innerHTML = '';
        }
        this._editingId = null;
    },

    async onResponsableChange() {
        const resp = document.getElementById('rcResponsableFalla')?.value;
        const motivoSel = document.getElementById('rcMotivo');
        if (!motivoSel) return;

        if (!resp) {
            motivoSel.innerHTML = '<option value="">Seleccionar responsable primero...</option>';
            return;
        }

        // Cache de motivos
        if (!this._motivosCache[resp]) {
            try {
                const data = await authFetch('/api/reclamos/motivos/' + encodeURIComponent(resp)).then(r => r.json());
                this._motivosCache[resp] = Array.isArray(data) ? data : [];
            } catch(e) { this._motivosCache[resp] = []; }
        }

        const motivos = this._motivosCache[resp] || [];
        motivoSel.innerHTML = '<option value="">Seleccionar motivo...</option>' +
            motivos.map(m => '<option value="' + m.motivo + '">' + m.motivo + '</option>').join('');
    },

    handleFotos(input) {
        const files = input.files;
        if (!files || files.length === 0) return;

        const preview = document.getElementById('rcFotosPreview');
        const countEl = document.getElementById('rcFotosCount');
        const dataEl = document.getElementById('rcFotosData');
        let fotos = [];
        try { fotos = JSON.parse(dataEl.value || '[]'); } catch(e) {}

        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                fotos.push(e.target.result);
                dataEl.value = JSON.stringify(fotos);
                countEl.textContent = fotos.length + ' foto(s) adjunta(s)';
                this.renderFotosPreview(fotos);
            };
            reader.readAsDataURL(file);
        });
    },

    renderFotosPreview(fotos) {
        const preview = document.getElementById('rcFotosPreview');
        if (!preview) return;
        preview.innerHTML = fotos.map((f, i) =>
            '<img src="' + f + '" class="rc-foto-thumb" onclick="App.modules.reclamos.removeFoto(' + i + ')" title="Click para eliminar">'
        ).join('');
    },

    removeFoto(idx) {
        const dataEl = document.getElementById('rcFotosData');
        const countEl = document.getElementById('rcFotosCount');
        let fotos = [];
        try { fotos = JSON.parse(dataEl.value || '[]'); } catch(e) {}
        fotos.splice(idx, 1);
        dataEl.value = JSON.stringify(fotos);
        countEl.textContent = fotos.length + ' foto(s) adjunta(s)';
        this.renderFotosPreview(fotos);
    },

    // ═══════════════════════════════════════════════════
    // ITEMS DINAMICOS
    // ═══════════════════════════════════════════════════
    _codigosCache: null,
    _lookupTimers: {},

    _itemDefaults() {
        return { item: '', codigo: '', descripcion: '', ancho: 0, alto: 0, espesor: 0, m2: 0, kg: 0, valor_unitario: 0 };
    },

    _getItems() {
        try { return JSON.parse(document.getElementById('rcItemsData').value || '[]'); } catch(e) { return []; }
    },

    _setItems(items) {
        const el = document.getElementById('rcItemsData');
        if (el) el.value = JSON.stringify(items);
    },

    _fmt(n) {
        if (!n && n !== 0) return '';
        return Number(n).toLocaleString('es-CL');
    },

    _parse(s) {
        if (!s) return 0;
        return parseFloat(String(s).replace(/\./g, '').replace(',', '.')) || 0;
    },

    _fmtCLP(n) {
        if (!n && n !== 0) return '';
        return '$' + Number(n).toLocaleString('es-CL');
    },

    addItem() {
        const items = this._getItems();
        items.push(this._itemDefaults());
        this._setItems(items);
        this.renderItems();
    },

    removeItem(idx) {
        const items = this._getItems();
        items.splice(idx, 1);
        this._setItems(items);
        this.renderItems();
    },

    _syncItemFromRow(idx) {
        const items = this._getItems();
        if (!items[idx]) return;
        const get = (id) => document.getElementById(id)?.value || '';
        items[idx].item = get('rcItem_' + idx);
        items[idx].codigo = get('rcCodigo_' + idx);
        items[idx].descripcion = get('rcDesc_' + idx);
        items[idx].ancho = this._parse(get('rcAncho_' + idx));
        items[idx].alto = this._parse(get('rcAlto_' + idx));
        items[idx].espesor = this._parse(get('rcEspesor_' + idx));
        items[idx].m2 = this._parse(get('rcM2_' + idx));
        items[idx].kg = this._parse(get('rcKg_' + idx));
        items[idx].valor_unitario = this._parse(get('rcValor_' + idx));
        this._setItems(items);
    },

    _calcItem(idx) {
        const items = this._getItems();
        const it = items[idx];
        if (!it) return;
        const ancho = this._parse(document.getElementById('rcAncho_' + idx)?.value);
        const alto = this._parse(document.getElementById('rcAlto_' + idx)?.value);
        const espesor = this._parse(document.getElementById('rcEspesor_' + idx)?.value);
        it.ancho = ancho;
        it.alto = alto;
        it.espesor = espesor;
        it.m2 = ancho && alto ? parseFloat(((ancho * alto) / 1000000).toFixed(4)) : 0;
        it.kg = it.m2 && espesor ? parseFloat((it.m2 * espesor * 2.5).toFixed(2)) : 0;
        this._setItems(items);
        const m2El = document.getElementById('rcM2_' + idx);
        const kgEl = document.getElementById('rcKg_' + idx);
        if (m2El) m2El.value = it.m2 || '';
        if (kgEl) kgEl.value = it.kg || '';
    },

    _onCodigoInput(idx) {
        clearTimeout(this._lookupTimers[idx]);
        this._lookupTimers[idx] = setTimeout(() => this._lookupCodigo(idx), 400);
    },

    async _lookupCodigo(idx) {
        const input = document.getElementById('rcCodigo_' + idx);
        const codigo = input?.value?.trim();
        if (!codigo || codigo.length < 1) return;

        try {
            if (!this._codigosCache) {
                const resp = await authFetch('/api/produccion/codigos?search=' + encodeURIComponent(codigo)).then(r => r.json());
                this._codigosCache = Array.isArray(resp) ? resp : [];
            }
            const match = this._codigosCache.find(c => c.codigo?.toLowerCase() === codigo.toLowerCase());
            if (match) {
                const descEl = document.getElementById('rcDesc_' + idx);
                if (descEl && !descEl.value) descEl.value = match.descripcion || '';
                const items = this._getItems();
                if (items[idx]) {
                    items[idx].descripcion = match.descripcion || '';
                    this._setItems(items);
                }
            }
        } catch(e) {}
    },

    // ═══════════════════════════════════════════════════
    // DROPDOWN BÚSQUEDA DE CÓDIGO
    // ═══════════════════════════════════════════════════
    _openCodigoSearch(idx) {
        this._closeCodigoSearch();
        const wrap = document.getElementById('rcCodigoWrap_' + idx);
        if (!wrap) return;
        let drop = wrap.querySelector('.rc-codigo-drop');
        if (!drop) {
            drop = document.createElement('div');
            drop.className = 'rc-codigo-drop';
            drop.innerHTML = '<input type="text" placeholder="Buscar código o descripción..." oninput="App.modules.reclamos._searchCodigo(this.value,' + idx + ')">'
                + '<div id="rcCodigoResults_' + idx + '" style="max-height:180px;overflow-y:auto"></div>';
            wrap.appendChild(drop);
        }
        drop.classList.add('show');
        const searchInput = drop.querySelector('input');
        setTimeout(() => searchInput.focus(), 50);
        searchInput.value = '';
        this._searchCodigo('', idx);
    },

    _closeCodigoSearch() {
        document.querySelectorAll('.rc-codigo-drop.show').forEach(d => d.classList.remove('show'));
    },

    async _searchCodigo(query, idx) {
        const resultsEl = document.getElementById('rcCodigoResults_' + idx);
        if (!resultsEl) return;

        if (!this._codigosCache) {
            try {
                const resp = await authFetch('/api/produccion/codigos').then(r => r.json());
                this._codigosCache = Array.isArray(resp) ? resp : [];
            } catch(e) { this._codigosCache = []; }
        }

        const q = query.toLowerCase().trim();
        let results = this._codigosCache;
        if (q) {
            results = results.filter(c =>
                (c.codigo || '').toLowerCase().includes(q) ||
                (c.descripcion || '').toLowerCase().includes(q) ||
                (c.grupo || '').toLowerCase().includes(q)
            );
        }
        results = results.slice(0, 50);

        if (results.length === 0) {
            resultsEl.innerHTML = '<div style="padding:12px;text-align:center;color:#94a3b8;font-size:11px">Sin resultados</div>';
            return;
        }

        resultsEl.innerHTML = results.map(c =>
            '<div class="rc-codigo-item" onclick="App.modules.reclamos._selectCodigo(' + idx + ',\'' + (c.codigo || '').replace(/'/g, "\\'") + '\',\'' + (c.descripcion || '').replace(/'/g, "\\'") + '\')">'
            + '<span class="rc-cod">' + (c.codigo || '') + '</span>'
            + '<span class="rc-desc">' + (c.descripcion || '') + '</span>'
            + (c.grupo ? '<span class="rc-grp">' + c.grupo + '</span>' : '')
            + '</div>'
        ).join('');
    },

    _selectCodigo(idx, codigo, descripcion) {
        const codEl = document.getElementById('rcCodigo_' + idx);
        const descEl = document.getElementById('rcDesc_' + idx);
        if (codEl) codEl.value = codigo;
        if (descEl) descEl.value = descripcion;
        const items = this._getItems();
        if (items[idx]) {
            items[idx].codigo = codigo;
            items[idx].descripcion = descripcion;
            this._setItems(items);
        }
        this._closeCodigoSearch();
    },

    _onValorBlur(idx) {
        const input = document.getElementById('rcValor_' + idx);
        if (!input) return;
        const raw = this._parse(input.value);
        const items = this._getItems();
        if (items[idx]) {
            items[idx].valor_unitario = raw;
            this._setItems(items);
        }
        input.value = raw ? this._fmtCLP(raw) : '';
    },

    _onValorInput(idx) {
        const input = document.getElementById('rcValor_' + idx);
        if (!input) return;
        const items = this._getItems();
        if (items[idx]) {
            items[idx].valor_unitario = this._parse(input.value);
            this._setItems(items);
        }
    },

    _onDimBlur(idx) {
        const items = this._getItems();
        const it = items[idx];
        if (!it) return;
        const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ? this._fmt(v) : ''; };
        setVal('rcAncho_' + idx, it.ancho);
        setVal('rcAlto_' + idx, it.alto);
        setVal('rcM2_' + idx, it.m2 || '');
        setVal('rcKg_' + idx, it.kg || '');
    },

    renderItems() {
        const tbody = document.getElementById('rcItemsBody');
        if (!tbody) return;
        const items = this._getItems();

        const thBase = 'padding:6px 8px;font-size:10px;font-weight:700;color:#64748b;';
        const tdBase = 'padding:0;';
        const inpBase = 'width:100%;box-sizing:border-box;padding:6px 8px;font-size:11px;border:1px solid #e2e8f0;border-radius:5px;outline:none;font-family:inherit;';

        if (items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" style="padding:16px;text-align:center;color:#94a3b8;font-size:12px">Sin items. Haz clic en "Agregar Item" para comenzar.</td></tr>';
            return;
        }

        const canCreate = this._canCreate !== false;
        const ro = canCreate ? '' : 'readonly style="background:#f8fafc"';
        const roInp = canCreate ? '' : 'readonly';

        tbody.innerHTML = items.map((it, i) => {
            const v = (x) => (x || x === 0) ? x : '';
            const onCalc = 'App.modules.reclamos._calcItem(' + i + ')';
            const onSync = 'App.modules.reclamos._syncItemFromRow(' + i + ')';
            const onCodigo = 'App.modules.reclamos._onCodigoInput(' + i + ')';
            const onValorIn = 'App.modules.reclamos._onValorInput(' + i + ')';
            const onValorBl = 'App.modules.reclamos._onValorBlur(' + i + ')';
            const onDimBl = 'App.modules.reclamos._onDimBlur(' + i + ')';
            return '<tr style="border-bottom:1px solid #f1f5f9">'
                + '<td style="' + tdBase + 'text-align:center;padding:6px 4px;font-weight:700;color:#7c3aed;font-size:12px">' + (i + 1) + '</td>'
                + '<td style="' + tdBase + '"><input id="rcItem_' + i + '" value="' + v(it.item) + '" style="' + inpBase + '" placeholder="#" oninput="' + onSync + '" ' + roInp + '></td>'
                + '<td style="' + tdBase + '" class="rc-codigo-wrap" id="rcCodigoWrap_' + i + '"><input id="rcCodigo_' + i + '" value="' + v(it.codigo) + '" style="' + inpBase + 'cursor:pointer" placeholder="🔍 Código SAP" readonly onclick="App.modules.reclamos._openCodigoSearch(' + i + ')"></td>'
                + '<td style="' + tdBase + '"><input id="rcDesc_' + i + '" value="' + v(it.descripcion) + '" style="' + inpBase + 'background:#f8fafc" placeholder="Descripción" readonly></td>'
                + '<td style="' + tdBase + '"><input id="rcAncho_' + i + '" type="text" inputmode="numeric" value="' + v(this._fmt(it.ancho)) + '" style="' + inpBase + 'text-align:right" placeholder="0" oninput="' + onCalc + '" onblur="' + onDimBl + '" ' + roInp + '></td>'
                + '<td style="' + tdBase + '"><input id="rcAlto_' + i + '" type="text" inputmode="numeric" value="' + v(this._fmt(it.alto)) + '" style="' + inpBase + 'text-align:right" placeholder="0" oninput="' + onCalc + '" onblur="' + onDimBl + '" ' + roInp + '></td>'
                + '<td style="' + tdBase + '"><input id="rcEspesor_' + i + '" type="text" inputmode="decimal" value="' + v(it.espesor || '') + '" style="' + inpBase + 'text-align:right" placeholder="0" oninput="' + onCalc + '" onblur="' + onDimBl + '" ' + roInp + '></td>'
                + '<td style="' + tdBase + '"><input id="rcM2_' + i + '" type="text" value="' + v(it.m2 || '') + '" style="' + inpBase + 'text-align:right;background:#f8fafc" readonly placeholder="0"></td>'
                + '<td style="' + tdBase + '"><input id="rcKg_' + i + '" type="text" value="' + v(it.kg || '') + '" style="' + inpBase + 'text-align:right;background:#f8fafc" readonly placeholder="0"></td>'
                + '<td style="' + tdBase + '"><input id="rcValor_' + i + '" type="text" inputmode="numeric" value="' + v(it.valor_unitario ? this._fmtCLP(it.valor_unitario) : '') + '" style="' + inpBase + 'text-align:right" placeholder="$0" oninput="' + onValorIn + '" onblur="' + onValorBl + '" ' + roInp + '></td>'
                + (canCreate ? '<td style="padding:4px 6px;text-align:center"><button type="button" onclick="App.modules.reclamos.removeItem(' + i + ')" style="background:none;border:none;cursor:pointer;color:#ef4444;padding:2px" title="Eliminar"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></td>' : '<td></td>')
                + '</tr>';
        }).join('');
    },

    async guardar(e) {
        e.preventDefault();
        let fotos = [];
        try { fotos = JSON.parse(document.getElementById('rcFotosData').value || '[]'); } catch(e) {}

        // Sincronizar todos los items desde la tabla
        const items = this._getItems();

        const data = {
            cliente: document.getElementById('rcCliente').value,
            numero_orden: document.getElementById('rcOrden').value,
            items: items,
            descripcion: items.map(it => it.descripcion).filter(Boolean).join(', '),
            detalle_reclamo: document.getElementById('rcDetalle').value,
            fotos: fotos,
            responsable_falla: document.getElementById('rcResponsableFalla').value,
            motivo: document.getElementById('rcMotivo').value,
            observacion_analisis: document.getElementById('rcObservacion').value,
            resolucion: document.getElementById('rcResolucion').value
        };

        try {
            if (this._editingId) {
                await authFetch('/api/reclamos/' + this._editingId, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                App.toast('Reclamo actualizado');
            } else {
                await authFetch('/api/reclamos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                App.toast('Reclamo registrado');
            }
            this.hideForm();
            await this.cargarDatos();
        } catch(e) {
            App.toast('Error: ' + e.message, 'error');
        }
    },

    async eliminar(id) {
        if (!confirm('¿Eliminar este reclamo?')) return;
        try {
            await authFetch('/api/reclamos/' + id, { method: 'DELETE' });
            App.toast('Reclamo eliminado');
            await this.cargarDatos();
        } catch(e) {
            App.toast('Error: ' + e.message, 'error');
        }
    },

    async showMatriz() {
        let matriz = [];
        try {
            const resp = await authFetch('/api/reclamos/matriz').then(r => r.json());
            matriz = Array.isArray(resp) ? resp : [];
        } catch(e) { matriz = []; }

        const agrupado = {};
        matriz.forEach(m => {
            if (!agrupado[m.responsable]) agrupado[m.responsable] = [];
            agrupado[m.responsable].push(m);
        });

        let bodyHtml = '<div style="max-height:400px;overflow-y:auto">';
        Object.keys(agrupado).sort().forEach(resp => {
            bodyHtml += '<div style="margin-bottom:12px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">';
            bodyHtml += '<div style="padding:8px 12px;background:#f8fafc;font-weight:700;font-size:12px;color:#1e293b;display:flex;align-items:center;gap:6px">';
            bodyHtml += '<span style="width:8px;height:8px;border-radius:50%;background:#7c3aed"></span>' + resp;
            bodyHtml += '</div>';
            agrupado[resp].forEach(m => {
                bodyHtml += '<div style="padding:6px 12px 6px 26px;font-size:12px;color:#475569;display:flex;align-items:center;justify-content:space-between;border-top:1px solid #f1f5f9">';
                bodyHtml += '<span>' + m.motivo + '</span>';
                bodyHtml += '<button onclick="App.modules.reclamos.eliminarMotivo(' + m.id + ')" style="background:none;border:none;cursor:pointer;color:#ef4444;padding:2px" title="Eliminar"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>';
                bodyHtml += '</div>';
            });
            bodyHtml += '</div>';
        });
        bodyHtml += '</div>';

        // Formulario para agregar nuevo
        bodyHtml += '<div style="margin-top:16px;padding-top:12px;border-top:1px solid #e2e8f0">';
        bodyHtml += '<h4 style="margin:0 0 8px;font-size:12px;font-weight:700;color:#1e293b">Agregar Nuevo</h4>';
        bodyHtml += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
        bodyHtml += '<input type="text" id="matrizResp" placeholder="Responsable (ej: CORTE)" style="flex:1;min-width:120px;padding:8px 10px;font-size:12px;border:1px solid #e2e8f0;border-radius:6px">';
        bodyHtml += '<input type="text" id="matrizMotivo" placeholder="Motivo (ej: MAL CORTADO)" style="flex:1;min-width:120px;padding:8px 10px;font-size:12px;border:1px solid #e2e8f0;border-radius:6px">';
        bodyHtml += '<button onclick="App.modules.reclamos.agregarMotivo()" class="btn btn-primary btn-sm" style="font-size:11px">Agregar</button>';
        bodyHtml += '</div></div>';

        App.showModal(bodyHtml, { title: 'Configuración - Responsables y Motivos' });
    },

    async agregarMotivo() {
        const resp = document.getElementById('matrizResp').value.trim();
        const motivo = document.getElementById('matrizMotivo').value.trim();
        if (!resp || !motivo) { App.toast('Completa ambos campos', 'error'); return; }

        try {
            await authFetch('/api/reclamos/matriz', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ responsable: resp, motivo: motivo })
            });
            App.toast('Motivo agregado');
            this._motivosCache = {};
            this.showMatriz();
        } catch(e) {
            App.toast('Error: ' + e.message, 'error');
        }
    },

    async eliminarMotivo(id) {
        if (!confirm('¿Eliminar este motivo?')) return;
        try {
            await authFetch('/api/reclamos/matriz/' + id, { method: 'DELETE' });
            App.toast('Motivo eliminado');
            this._motivosCache = {};
            this.showMatriz();
        } catch(e) {
            App.toast('Error: ' + e.message, 'error');
        }
    },

    _renderWorkflowBar(r) {
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const email = user.email || '';
        const estado = r.estado || 'PENDIENTE';

        const transitions = {
            'PENDIENTE': [
                { next: 'EN REVISION', label: 'Iniciar Revisión', icon: '🔍', color: '#3b82f6', bg: '#eff6ff' }
            ],
            'EN REVISION': [
                { next: 'FINALIZADO', label: 'Finalizar', icon: '✅', color: '#22c55e', bg: '#f0fdf4' },
                { next: 'PENDIENTE', label: 'Volver a Pendiente', icon: '↩️', color: '#64748b', bg: '#f1f5f9' }
            ],
            'FINALIZADO': []
        };

        const actions = transitions[estado] || [];
        if (actions.length === 0) return '';

        let html = '<div style="margin-top:16px;padding:14px;background:linear-gradient(135deg,#f8fafc,#f1f5f9);border-radius:10px;border:1px solid #e2e8f0">';
        html += '<div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:10px;letter-spacing:0.5px">Acciones de Flujo</div>';
        html += '<div style="display:flex;gap:8px;flex-wrap:wrap">';

        actions.forEach(a => {
            html += '<button type="button" onclick="App.modules.reclamos.cambiarEstado(' + r.id + ',\'' + a.next + '\')" '
                + 'style="padding:8px 16px;font-size:12px;font-weight:600;border-radius:8px;border:1px solid ' + a.color + '30;background:' + a.bg + ';color:' + a.color + ';cursor:pointer;display:flex;align-items:center;gap:6px;transition:all 0.15s" '
                + 'onmouseover="this.style.transform=\'translateY(-1px)\';this.style.boxShadow=\'0 2px 8px ' + a.color + '20\'" '
                + 'onmouseout="this.style.transform=\'\';this.style.boxShadow=\'\'">'
                + '<span>' + a.icon + '</span> ' + a.label + '</button>';
        });

        html += '<button type="button" onclick="App.modules.reclamos.showHistorial(' + r.id + ')" '
            + 'style="padding:8px 16px;font-size:12px;font-weight:600;border-radius:8px;border:1px solid #e2e8f0;background:white;color:#475569;cursor:pointer;display:flex;align-items:center;gap:6px" '
            + 'onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'white\'">'
            + '📋 Historial</button>';

        html += '</div></div>';

        // Timeline de estados
        const timestamps = [
            { label: 'Ingreso', fecha: r.fecha_ingreso, resp: r.responsable_ingreso },
            { label: 'Revisión', fecha: r.fecha_revision, resp: r.responsable_revision },
            { label: 'Fin', fecha: r.fecha_fin, resp: r.responsable_fin }
        ].filter(t => t.fecha);

        if (timestamps.length > 0) {
            html += '<div style="margin-top:12px;display:flex;gap:12px;flex-wrap:wrap">';
            timestamps.forEach((t, i) => {
                html += '<div style="font-size:10px;color:#64748b"><span style="font-weight:700;color:#475569">' + t.label + ':</span> ' + this.fmtDateTime(t.fecha);
                if (t.resp) html += ' <span style="color:#94a3b8">(' + t.resp + ')</span>';
                html += '</div>';
            });
            html += '</div>';
        }

        return html;
    },

    async cambiarEstado(id, nuevoEstado) {
        const msg = nuevoEstado === 'FINALIZADO' ? '¿Marcar como FINALIZADO?' : '¿Cambiar estado a ' + nuevoEstado + '?';
        if (!confirm(msg)) return;

        try {
            await authFetch('/api/reclamos/' + id + '/estado', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: nuevoEstado })
            });
            App.toast('Estado cambiado a ' + nuevoEstado);
            await this.cargarDatos();
            // Recargar formulario si está abierto
            const container = document.getElementById('rc-form-container');
            if (container && container.style.display !== 'none') {
                await this.showForm(id);
            }
        } catch(e) {
            App.toast('Error: ' + e.message, 'error');
        }
    },

    async showHistorial(id) {
        let historial = [];
        try {
            const resp = await authFetch('/api/reclamos/' + id + '/historial').then(r => r.json());
            historial = Array.isArray(resp) ? resp : [];
        } catch(e) {}

        let bodyHtml = '';
        if (historial.length === 0) {
            bodyHtml = '<div style="text-align:center;padding:24px;color:#94a3b8">Sin historial de cambios</div>';
        } else {
            bodyHtml = '<div style="max-height:400px;overflow-y:auto">';
            historial.forEach(h => {
                const color = h.estado_despues === 'FINALIZADO' ? '#22c55e' : h.estado_despues === 'EN REVISION' ? '#3b82f6' : '#64748b';
                bodyHtml += '<div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9">';
                bodyHtml += '<div style="width:8px;height:8px;border-radius:50%;background:' + color + ';margin-top:5px;flex-shrink:0"></div>';
                bodyHtml += '<div style="flex:1">';
                bodyHtml += '<div style="font-size:12px;font-weight:600;color:#1e293b">' + h.accion + '</div>';
                if (h.estado_antes) bodyHtml += '<div style="font-size:11px;color:#64748b">' + h.estado_antes + ' → ' + h.estado_despues + '</div>';
                if (h.responsable) bodyHtml += '<div style="font-size:11px;color:#94a3b8">' + h.responsable + '</div>';
                if (h.observacion) bodyHtml += '<div style="font-size:11px;color:#475569;margin-top:4px;font-style:italic">"' + h.observacion + '"</div>';
                bodyHtml += '<div style="font-size:10px;color:#cbd5e1;margin-top:2px">' + this.fmtDateTime(h.created_at) + '</div>';
                bodyHtml += '</div></div>';
            });
            bodyHtml += '</div>';
        }

        App.showModal(bodyHtml, { title: 'Historial del Reclamo #' + id });
    },

    fmtDate(d) {
        if (!d) return '-';
        const parts = d.split('T')[0].split('-');
        return parts[2] + '/' + parts[1] + '/' + parts[0];
    },

    fmtDateTime(d) {
        if (!d) return '-';
        try {
            const dt = new Date(d);
            const day = String(dt.getDate()).padStart(2, '0');
            const month = String(dt.getMonth() + 1).padStart(2, '0');
            const year = dt.getFullYear();
            const hours = String(dt.getHours()).padStart(2, '0');
            const mins = String(dt.getMinutes()).padStart(2, '0');
            return day + '/' + month + '/' + year + ' ' + hours + ':' + mins;
        } catch(e) {
            return this.fmtDate(d);
        }
    }
};

// Registrar módulo
if (typeof App !== 'undefined') {
    App.registerModule('reclamos', Reclamos);
}
