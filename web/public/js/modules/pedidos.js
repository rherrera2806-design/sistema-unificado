// ══════════════════════════════════════════════════════════════════════════
// Módulo: Pedidos / Órdenes (SPA — app.html)
// Flujo de revisión (pedido del usuario):
//   - La acción única "Revisar" ya NO existe.
//   - Pedido PENDIENTE  → acciones directas "Aprobar" y "Rechazar".
//   - Pedido APROBADO   → se mantiene "Rechazar" (rechazar aprobado).
//   - AL APROBAR: confirmar → PUT {estado:'aprobado'} → descargar el PDF de
//     forma segura (fetch → blob → objectURL → click, esperando a que la
//     descarga termine) → recién ahí DELETE /:id/pdf → toast honesto.
//   - AL RECHAZAR: modal con motivo obligatorio → PUT {estado:'rechazado',
//     motivo_rechazo} → el backend elimina el PDF él solo → toast.
//     El motivo queda visible en el badge RECHAZADO (click para verlo).
// Máquina de estados del backend: pendiente→aprobado/rechazado,
// aprobado→rechazado/pendiente, rechazado→pendiente (al editar).
// Notas de seguridad: texto en HTML = escText, atributos = escAttr y
// literales JS dentro de onclick = escJs (ver app-main.js).
// ══════════════════════════════════════════════════════════════════════════

App.registerModule('pedidos', {
    allPedidos: [],
    currentPedido: null,
    selectedFile: null,      // PDF elegido en el modal de "Nuevo Pedido"
    editFile: null,          // PDF elegido en el modal de edición (opcional)
    uploading: false,
    _ocupado: false,         // Guard anti doble-submit de aprobar/rechazar/editar/eliminar
    _filterTimer: null,
    _dropdownsGlobal: false, // El listener global de clics se registra UNA sola vez
    _rechazoKeyHandler: null,
    activeStatFilter: null,
    COLUMNAS: 10,            // Columnas reales de la tabla (th y td deben coincidir)

    // ──────────────────────────── Helpers locales ────────────────────────────

    // Usuario de sesión. Nunca lanzar si el JSON de localStorage está corrupto.
    _user() {
        try {
            return JSON.parse(localStorage.getItem('unified_user') || '{}') || {};
        } catch (e) { return {}; }
    },

    // Lectura segura de cualquier clave JSON de localStorage.
    _leerClave(clave, porDefecto) {
        try {
            const v = JSON.parse(localStorage.getItem(clave));
            return (v === null || v === undefined) ? porDefecto : v;
        } catch (e) { return porDefecto; }
    },

    // Permiso de creación UNIFICADO (antes estaba duplicado en render() y
    // upload()). Debe coincidir EXACTAMENTE con canCreate del backend
    // (api/src/routes/pedidos.js): requireAnyPerm('pedidos.agregar', 'pedidos')
    // + admin (rol 'admin' o permiso 'usuarios').
    _puedeCrear() {
        const user = this._user();
        const permisos = user.permisos || [];
        const esAdmin = user.rol === 'admin' || permisos.includes('usuarios');
        return esAdmin || permisos.includes('pedidos.agregar') || permisos.includes('pedidos');
    },

    // Igual que apiJson (app-main.js), pero traduce los errores 413/415 del
    // servidor (archivo demasiado grande / tipo no permitido) a mensajes amables.
    async _apiJson(res) {
        if (res.status === 413) throw new Error('El archivo supera el tamaño máximo permitido (50 MB)');
        if (res.status === 415) throw new Error('Formato no permitido: solo se aceptan archivos PDF');
        return apiJson(res);
    },

    // App.toast ignora el 3.er argumento (duración), así que los avisos largos
    // usan este toast local con tiempo configurable (mismo look que showAlert).
    _toastLargo(mensaje, tipo, ms) {
        let cont = document.getElementById('alertContainer');
        if (!cont) {
            cont = document.createElement('div');
            cont.id = 'alertContainer';
            cont.style.cssText = 'position:fixed;top:20px;right:20px;z-index:2000;max-width:400px;';
            document.body.appendChild(cont);
        }
        const el = document.createElement('div');
        el.className = 'alert alert-' + (tipo === 'error' ? 'danger' : (tipo || 'success'));
        el.textContent = mensaje;   // textContent: sin riesgo de XSS
        cont.appendChild(el);
        setTimeout(() => el.remove(), ms || 8000);
    },

    // Tamaño legible para validar/adjuntar PDFs. Decimales con coma (es-CL):
    // "1,5 MB", nunca "1.5 MB".
    _fmtTamano(bytes) {
        if (bytes === null || bytes === undefined) return '';
        if (bytes < 1024) return this._fmtNum(bytes) + ' B';
        if (bytes < 1024 * 1024) return this._fmtNum(Math.round(bytes / 1024)) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB';
    },

    // Entero con separador de miles es-CL (1.234). Solo para cantidades:
    // los años NUNCA se formatean (2026, no "2.026").
    _fmtNum(n) {
        const v = Number(n);
        return isNaN(v) ? String(n == null ? '' : n) : v.toLocaleString('es-CL');
    },

    // Descarga SEGURA de un blob: fetch → blob → objectURL → link.click(),
    // esperando a que el navegador procese la descarga antes de liberar la
    // URL (revocarla demasiado pronto corta la descarga).

    // Acciones disponibles para un pedido según su estado y los permisos del
    // usuario. Fuente única para el dropdown de la tabla y las cards móviles.
    //   - Eliminar exige pedidos.eliminar (App.canDelete), como el backend.
    //   - Aprobar/Rechazar/Editar exigen pedidos.editar (App.canEdit).
    _acciones(p) {
        const id = Number(p.id) || 0;
        const puedeEditar = App.canEdit('pedidos');
        const puedeEliminar = App.canDelete('pedidos');
        const acc = [];
        if (p.estado === 'pendiente') acc.push({ txt: 'Ver PDF', fn: 'viewPdf(' + id + ')' });
        if (puedeEditar && p.estado === 'pendiente') acc.push({ txt: 'Aprobar', fn: 'aprobarPedido(' + id + ')', ok: true });
        if (puedeEditar && (p.estado === 'pendiente' || p.estado === 'aprobado')) acc.push({ txt: 'Rechazar', fn: 'showRechazoModal(' + id + ')', danger: true });
        if (p.estado !== 'pendiente') acc.push({ txt: 'Historial', fn: 'showHistorial(' + id + ')' });
        if (puedeEditar) acc.push({ txt: 'Editar', fn: 'showEditModal(' + id + ')' });
        if (puedeEliminar) acc.push({ txt: 'Eliminar', fn: 'deletePedido(' + id + ',\'' + escJs(p.numero_pedido) + '\')', danger: true });
        return acc;
    },

    debouncedFilter() {
        clearTimeout(this._filterTimer);
        this._filterTimer = setTimeout(() => this.filter(), 200);
    },

    toggleActions(evt, id) {
        if (evt) evt.stopPropagation();
        const drop = document.getElementById('pedDrop' + id);
        if (!drop) return;
        const wasOpen = drop.classList.contains('open');
        this.closeAllDropdowns();
        if (!wasOpen) {
            const rect = drop.parentElement.getBoundingClientRect();
            drop.style.position = 'fixed';
            drop.style.top = (rect.bottom + 4) + 'px';
            drop.style.left = (rect.right - 150) + 'px';
            drop.style.right = 'auto';
            drop.classList.add('open');
            const close = (e) => {
                if (!drop.contains(e.target)) {
                    drop.classList.remove('open');
                    drop.style.position = '';
                    drop.style.top = '';
                    drop.style.left = '';
                    drop.style.right = '';
                    document.removeEventListener('click', close);
                }
            };
            setTimeout(() => document.addEventListener('click', close), 0);
        }
    },

    closeAllDropdowns() {
        document.querySelectorAll('.ped-dropdown.open').forEach(d => d.classList.remove('open'));
    },

    async render() {
        const el = document.getElementById('page-pedidos');
        const showNew = this._puedeCrear();

        const modalesReady = document.getElementById('pedUploadModal');
        if (!modalesReady) {
            el.innerHTML = '<style>'
                + '@keyframes pedFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}'
                + '@keyframes pedCount{from{opacity:0;transform:scale(0.8)}to{opacity:1;transform:scale(1)}}'
                + '.ped-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1);cursor:pointer}'
                + '.ped-card:hover{transform:translateY(-3px)!important;box-shadow:0 12px 28px rgba(0,0,0,0.12)!important}'
                + '.ped-card-active{outline:2px solid #3b82f6;outline-offset:-2px;background:#f0f7ff!important}'
                + '.ped-row{will-change:auto;transition:background 0.15s ease}'
                + '.ped-row:hover{background:#f8fafc}'
                + '.ped-section{animation:pedFadeUp 0.5s ease both}'
                + '.ped-btn{transition:all 0.2s cubic-bezier(0.4,0,0.2,1)}'
                + '.ped-btn:hover{transform:translateY(-1px)!important;box-shadow:0 4px 12px rgba(0,0,0,0.15)!important}'
                + '#pedFilterSearch::placeholder{color:rgba(255,255,255,0.6)}'
                // ── Regla tipográfica del sistema (misma escala que css/inv-pro.css) ──
                // Fuente única: Inter (la de la app). SIN monoespaciadas ni
                // "numerales máquina de escribir": los números se alinean por
                // alineación de columna, no por fuente mecánica.
                // Escala única (5 tamaños):
                //   20px display  → números de stats (única excepción)
                //   15px títulos  → hero, modales, mensajes principales
                //   13px datos    → celdas, cards, inputs, menús, títulos de card/stat label
                //   11px labels   → headers de tabla, etiquetas de formulario, badges/chips
                //   10px notas    → subtítulos, notas, ayudas, unidades
                + '.ped-th{padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px}'
                + '.ped-th-right{text-align:right}'
                + '.ped-th-center{text-align:center}'
                + '.ped-td{padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px}'
                + '.ped-td-right{text-align:right}'
                + '.ped-td-center{text-align:center}'
                + '.ped-num{font-weight:700;color:#0f172a;font-size:13px;background:#f1f5f9;padding:4px 10px;border-radius:6px}'
                // Celda de fecha/hora (antes .ped-mono: el nombre "mono" confundía,
                // nunca fue fuente monoespaciada).
                + '.ped-fecha{font-size:13px;color:#64748b;text-align:right}'
                + '.ped-dt{line-height:1.4}'
                + '.ped-dt-sub{font-size:10px;color:#94a3b8;font-weight:400}'
                + '.ped-vacio{color:#cbd5e1}'
                + '.ped-nota{font-size:10px;color:#94a3b8}'
                + '.ped-label{display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px}'
                + '.ped-mini-label{display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase}'
                + '.ped-badge{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;padding:5px 12px;border-radius:20px;transition:all 0.2s ease}'
                + '.ped-badge:hover{transform:scale(1.08)}'
                + '.ped-chip{display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600}'
                + '.ped-stat-num{font-size:20px;font-weight:700;color:#0f172a;line-height:1}'
                + '.ped-stat-label{font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px}'
                + '.ped-actions-btn{width:32px;height:32px;border-radius:8px;border:1px solid #e2e8f0;background:white;cursor:pointer;font-size:15px;color:#64748b;display:inline-flex;align-items:center;justify-content:center;transition:all 0.15s}'
                + '.ped-actions-btn:hover{background:#f1f5f9;color:#0f172a;border-color:#cbd5e1}'
                + '.ped-dropdown{display:none;background:white;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);z-index:9999;min-width:140px;padding:4px;overflow:hidden}'
                + '.ped-dropdown.open{display:block}'
                + '.ped-drop-item{padding:8px 12px;font-size:13px;color:#334155;cursor:pointer;border-radius:6px;transition:background 0.1s}'
                + '.ped-drop-item:hover{background:#f1f5f9}'
                + '.ped-drop-danger{color:#dc2626}'
                + '.ped-drop-danger:hover{background:#fef2f2}'
                + '</style>'

                + '<div class="m-page">'
                + '<div class="m-hero" style="padding:10px 14px">'
                + '<div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>'
                + '<div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">'
                + '<div style="flex-shrink:0"><h2 style="margin:0;font-size:15px;font-weight:700;color:white;letter-spacing:-0.5px">Pedidos / Ordenes</h2>'
                + '<p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Gestion de pedidos y documentos de ventas</p></div>'
                + '<div class="m-hero-btns" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0">'
                + '<div style="position:relative;width:180px;flex-shrink:0"><svg style="position:absolute;left:8px;top:50%;transform:translateY(-50%);pointer-events:none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
                + '<input type="text" id="pedFilterSearch" placeholder="Buscar..." oninput="App.modules.pedidos.debouncedFilter()" style="font-size:13px;padding:8px 10px 8px 28px;border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:white;background:rgba(255,255,255,0.1);outline:none;transition:border-color 0.2s;width:100%;box-sizing:border-box" onfocus="this.style.borderColor=\'rgba(255,255,255,0.5)\'" onblur="this.style.borderColor=\'rgba(255,255,255,0.2)\'"></div>'
                + '<select id="pedFilterAnio" onchange="App.modules.pedidos.filter()" style="font-size:13px;padding:8px 10px;border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:white;background:rgba(255,255,255,0.1);cursor:pointer;outline:none;transition:all 0.2s" onfocus="this.style.borderColor=\'rgba(255,255,255,0.5)\'" onblur="this.style.borderColor=\'rgba(255,255,255,0.2)\'">'
                + '<option value="" style="color:#1e293b;background:white">Año</option></select>'
                + '<select id="pedFilterMes" onchange="App.modules.pedidos.filter()" style="font-size:13px;padding:8px 10px;border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:white;background:rgba(255,255,255,0.1);cursor:pointer;outline:none;transition:all 0.2s" onfocus="this.style.borderColor=\'rgba(255,255,255,0.5)\'" onblur="this.style.borderColor=\'rgba(255,255,255,0.2)\'">'
                + '<option value="" style="color:#1e293b;background:white">Mes</option>'
                + '<option value="1" style="color:#1e293b;background:white">Ene</option><option value="2" style="color:#1e293b;background:white">Feb</option><option value="3" style="color:#1e293b;background:white">Mar</option><option value="4" style="color:#1e293b;background:white">Abr</option><option value="5" style="color:#1e293b;background:white">May</option><option value="6" style="color:#1e293b;background:white">Jun</option><option value="7" style="color:#1e293b;background:white">Jul</option><option value="8" style="color:#1e293b;background:white">Ago</option><option value="9" style="color:#1e293b;background:white">Sep</option><option value="10" style="color:#1e293b;background:white">Oct</option><option value="11" style="color:#1e293b;background:white">Nov</option><option value="12" style="color:#1e293b;background:white">Dic</option>'
                + '</select>'
                + (showNew ? '<button onclick="App.modules.pedidos.showUploadModal()" class="btn btn-accent" style="white-space:nowrap;padding:8px 14px;font-size:13px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo</button>' : '')
                + '</div></div></div>'

                + '<div id="pedStats" class="m-stats" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px"></div>'

                + '<div class="m-card">'
                + '<div class="m-card-header" style="padding:8px 14px;display:flex;align-items:center;justify-content:space-between">'
                + '<div style="display:flex;align-items:center;gap:8px">'
                + '<div style="width:28px;height:28px;border-radius:7px;background:linear-gradient(135deg,#eff6ff,#bfdbfe);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>'
                + '<span style="font-size:13px;font-weight:600;color:#0f172a">Pedidos <span id="pedCountLabel" style="color:#94a3b8;font-weight:400;font-size:10px"></span></span></div>'
                + '</div>'
                + '<div class="m-card-body" style="padding:0">'
                + '<div class="m-table-wrap"><table style="width:100%;border-collapse:collapse;font-size:13px;min-width:800px">'
                + '<thead><tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0">'
                + '<th class="ped-th">N Pedido</th>'
                + '<th class="ped-th">Cliente</th>'
                + '<th class="ped-th ped-th-center">Tipo</th>'
                + '<th class="ped-th">Vendedor</th>'
                + '<th class="ped-th ped-th-right">Fecha</th>'
                + '<th class="ped-th ped-th-center">Estado</th>'
                + '<th class="ped-th">Revisor</th>'
                + '<th class="ped-th ped-th-right">Fecha Revisión</th>'
                + '<th class="ped-th ped-th-right">Tiempo</th>'
                + '<th class="ped-th ped-th-center">Acciones</th>'
                + '</tr></thead><tbody id="pedidosTable">'
                + '<tr><td colspan="' + this.COLUMNAS + '" style="text-align:center;padding:48px;color:#94a3b8">Cargando pedidos...</td></tr>'
                + '</tbody></table></div>'
                + '<div id="pedidosCards" class="m-cards-mobile" style="display:none;padding:8px 12px"></div>'
                + '</div></div>'

                + this.uploadModalHtml()
                + this.editModalHtml()
                + '</div>'

                + '<style>'
                + '@media(max-width:768px){'
                + '.m-cards-mobile{display:block!important}'
                + '.m-table-wrap{display:none!important}'
                + '.m-hero-btns{flex-wrap:wrap}'
                + '.m-hero-btns .btn{height:40px;min-height:40px;flex:1}'
                + '.m-stats{grid-template-columns:repeat(2,1fr)!important}'
                + '.m-hero-btns select{padding:8px 10px}'
                + '}'
                + '</style>';

            this.setupDragDrop();
            // Registrar el listener global UNA sola vez: el DOM del módulo se
            // reconstruye en cada visita y antes este listener se acumulaba
            // (memory leak + handlers huérfanos).
            if (!this._dropdownsGlobal) {
                this._dropdownsGlobal = true;
                document.addEventListener('click', () => this.closeAllDropdowns());
            }
        }
        await this.load();
    },

    uploadModalHtml() {
        return '<div id="pedUploadModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(6px);z-index:1000;align-items:center;justify-content:center">'
            + '<div style="background:white;border-radius:16px;width:500px;max-width:95vw;box-shadow:0 24px 64px rgba(0,0,0,0.3);animation:pedFadeUp 0.3s ease both">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;padding:24px 28px;border-bottom:1px solid #e2e8f0">'
            + '<div style="display:flex;align-items:center;gap:12px">'
            + '<div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#eff6ff,#bfdbfe);display:flex;align-items:center;justify-content:center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>'
            + '<h3 style="margin:0;font-size:15px;font-weight:700;color:#0f172a">Nuevo Pedido</h3></div>'
            + '<button class="modal-close" onclick="App.modules.pedidos.hideUploadModal()"></button></div>'
            + '<div style="padding:28px">'
            + '<div style="margin-bottom:20px"><label class="ped-label">Numero de Pedido *</label>'
            + '<input type="text" id="pedNumero" placeholder="Ej: 12345" style="font-size:13px;width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;color:#1e293b;background:white;box-sizing:border-box;outline:none;transition:all 0.2s" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'"></div>'
            + '<div style="margin-bottom:20px"><label class="ped-label">Cliente *</label>'
            + '<input type="text" id="pedCliente" placeholder="Nombre del cliente" style="font-size:13px;width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;color:#1e293b;background:white;box-sizing:border-box;outline:none;transition:all 0.2s" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'"></div>'
            + '<div style="margin-bottom:20px"><label class="ped-label">Tipo de OV *</label>'
            + '<select id="pedTipoOV" style="font-size:13px;width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;color:#1e293b;background:white;box-sizing:border-box;outline:none;transition:all 0.2s" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'">'
            + '<option value="Normal" selected style="background:#e0f2fe;color:#0f172a">Normal</option>'
            + '<option value="Express" style="background:#fde047;color:#0f172a;font-weight:700">Express</option>'
            + '<option value="Vta. Region" style="background:#9333ea;color:white">Vta. Region</option>'
            + '<option value="Reposicion" style="background:#dc2626;color:white">Reposición</option>'
            + '<option value="Urgencia" style="background:#f97316;color:white;font-weight:700">Urgencia</option>'
            + '</select></div>'
            + '<div><label class="ped-label">PDF del Pedido *</label>'
            + '<div id="pedUploadArea" onclick="document.getElementById(\'pedFileInput\').click()" style="border:2px dashed #cbd5e1;border-radius:12px;padding:36px;text-align:center;cursor:pointer;transition:all 0.3s;background:#f8fafc">'
            + '<div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#eff6ff,#dbeafe);display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;box-shadow:0 4px 12px rgba(59,130,246,0.15)"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>'
            + '<div style="color:#64748b;font-size:13px;font-weight:500">Arrastra un PDF aqui o haz clic para seleccionar</div>'
            + '<div class="ped-nota" style="margin-top:4px">Solo archivos PDF (máximo 50 MB)</div>'
            + '<div id="pedUploadFilename" style="display:none;margin-top:14px;padding:8px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;color:#16a34a;font-weight:600;font-size:13px"></div></div>'
            + '<input type="file" id="pedFileInput" accept=".pdf,application/pdf" style="display:none" onchange="App.modules.pedidos.handleFileSelect(event)"></div></div>'
            + '<div style="display:flex;justify-content:flex-end;gap:10px;padding:20px 28px;border-top:1px solid #e2e8f0;background:#f8fafc;border-radius:0 0 16px 16px">'
                + '<button onclick="App.modules.pedidos.hideUploadModal()" class="btn btn-outline">Cancelar</button>'
                + '<button onclick="App.modules.pedidos.upload()" class="btn btn-primary">Subir Pedido</button>'
            + '</div></div></div>';
    },

    editModalHtml() {
        return '<div id="pedEditModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(6px);z-index:1000;align-items:center;justify-content:center">'
            + '<div style="background:white;border-radius:16px;width:500px;max-width:95vw;box-shadow:0 24px 64px rgba(0,0,0,0.3);animation:pedFadeUp 0.3s ease both">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;padding:24px 28px;border-bottom:1px solid #e2e8f0">'
            + '<div style="display:flex;align-items:center;gap:12px">'
            + '<div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#eff6ff,#bfdbfe);display:flex;align-items:center;justify-content:center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>'
            + '<h3 style="margin:0;font-size:15px;font-weight:700;color:#0f172a">Editar Pedido</h3></div>'
            + '<button class="modal-close" onclick="App.modules.pedidos.hideEditModal()"></button></div>'
            + '<div style="padding:28px">'
            + '<div id="pedEditAviso" style="display:none;margin-bottom:16px;padding:10px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;color:#92400e;font-size:10px"></div>'
            + '<div style="margin-bottom:20px"><label class="ped-label">Numero de Pedido *</label>'
            + '<input type="text" id="pedEditNumero" style="font-size:13px;width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;color:#1e293b;background:white;box-sizing:border-box;outline:none;transition:all 0.2s" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'"></div>'
            + '<div style="margin-bottom:20px"><label class="ped-label">Cliente *</label>'
            + '<input type="text" id="pedEditCliente" style="font-size:13px;width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;color:#1e293b;background:white;box-sizing:border-box;outline:none;transition:all 0.2s" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'"></div>'
            + '<div style="margin-bottom:20px"><label class="ped-label">Tipo de OV</label>'
            + '<select id="pedEditTipoOV" style="font-size:13px;width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;color:#1e293b;background:white;box-sizing:border-box;outline:none">'
            + '<option value="Normal">Normal</option>'
            + '<option value="Express">Express</option>'
            + '<option value="Vta. Region">Vta. Region</option>'
            + '<option value="Reposicion">Reposición</option>'
            + '<option value="Urgencia">Urgencia</option>'
            + '</select></div>'
            + '<div><label class="ped-label">PDF del Pedido (opcional)</label>'
            + '<div class="ped-nota" style="margin-bottom:8px">El PDF se elimina automaticamente al rechazar un pedido. Si no tiene PDF, adjunta uno nuevo aqui.</div>'
            + '<input type="file" id="pedEditFileInput" accept=".pdf,application/pdf" style="font-size:13px;width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:10px;color:#1e293b;background:white;box-sizing:border-box;outline:none" onchange="App.modules.pedidos.handleEditFileSelect(event)">'
            + '<div id="pedEditFilename" style="display:none;margin-top:8px;padding:8px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;color:#16a34a;font-weight:600;font-size:13px"></div></div></div>'
            + '<div style="display:flex;justify-content:flex-end;gap:10px;padding:20px 28px;border-top:1px solid #e2e8f0;background:#f8fafc;border-radius:0 0 16px 16px">'
                + '<button onclick="App.modules.pedidos.hideEditModal()" class="btn btn-outline">Cancelar</button>'
                + '<button onclick="App.modules.pedidos.saveEdit()" class="btn btn-primary">Guardar</button>'
            + '</div></div></div>';
    },

    async load() {
        try {
            // La identidad/permisos los resuelve el backend desde la sesión:
            // no enviar headers X-User-* (eran ignorables y engañosos).
            const res = await fetch('/api/pedidos');
            const data = await this._apiJson(res);
            this.allPedidos = Array.isArray(data) ? data : [];
            const lbl = document.getElementById('pedCountLabel');
            if (lbl) lbl.textContent = '(' + this._fmtNum(this.allPedidos.length) + ')';
            this.renderStats();
            this.populateYears();
            this.filter();
            this.notifyRechazados();
        } catch(e) {
            console.error('Error loading pedidos:', e);
            const tb = document.getElementById('pedidosTable');
            if (tb) tb.innerHTML = '<tr><td colspan="' + this.COLUMNAS + '" style="text-align:center;padding:48px;color:#94a3b8">Error al cargar pedidos: ' + escText(e.message || '') + '</td></tr>';
        }
    },

    notifyRechazados() {
        const user = this._user();
        if (!user.email) return;
        const esAdmin = (user.permisos || []).includes('pedidos.editar');
        if (esAdmin) return;
        const seen = this._leerClave('ped_rechazados_seen', []);
        const rechazados = this.allPedidos.filter(p => p.estado === 'rechazado' && p.vendedor === user.email && !seen.includes(p.id));
        if (rechazados.length === 0) return;
        setTimeout(() => {
            rechazados.forEach((p, i) => {
                setTimeout(() => {
                    // Aviso largo con toast local: App.toast ignora la duración.
                    this._toastLargo('Pedido ' + p.numero_pedido + ' RECHAZADO — Motivo: ' + (p.motivo_rechazo || 'No especificado'), 'error', 8000);
                }, i * 2000);
            });
            try {
                localStorage.setItem('ped_rechazados_seen', JSON.stringify([...seen, ...rechazados.map(p => p.id)]));
            } catch (e) { /* cuota de localStorage llena: se reintenta en la próxima carga */ }
        }, 800);
    },

    renderStats() {
        const p = this.allPedidos;
        let total = p.length, pend = 0, apr = 0, rech = 0;
        for (let i = 0; i < p.length; i++) {
            const e = p[i].estado;
            if (e === 'pendiente') pend++;
            else if (e === 'aprobado') apr++;
            else if (e === 'rechazado') rech++;
        }
        const af = this.activeStatFilter;
        const statsEl = document.getElementById('pedStats');
        if (!statsEl) return;
        statsEl.innerHTML =
            this.statCard(total, 'Total', '#64748b', '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>', 0, 'stat-blue', !af)
            + this.statCard(pend, 'Pendientes', '#f59e0b', '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>', 100, 'stat-green', af === 'pendiente')
            + this.statCard(apr, 'Aprobados', '#22c55e', '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>', 200, 'stat-green', af === 'aprobado')
            + this.statCard(rech, 'Rechazados', '#ef4444', '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>', 300, 'stat-red', af === 'rechazado');
    },

    populateYears() {
        const sel = document.getElementById('pedFilterAnio');
        if (!sel) return;
        const current = sel.value;
        const years = [...new Set(this.allPedidos.map(p => new Date(p.fecha_subida).getFullYear()))].sort((a, b) => b - a);
        sel.innerHTML = '<option value="" style="color:#1e293b;background:white">Año</option>'
            + years.map(y => '<option value="' + y + '" style="color:#1e293b;background:white">' + y + '</option>').join('');
        if (current && years.includes(parseInt(current))) sel.value = current;
    },

    statCard(value, label, color, icon, delay, cls, active) {
        cls = cls || 'stat-blue';
        const activeCls = active ? ' ped-card-active' : '';
        return '<div class="m-stat-card ' + cls + ' ped-card' + activeCls + '" style="animation:pedFadeUp 0.5s ease ' + delay + 'ms both" onclick="App.modules.pedidos.toggleStatFilter(\'' + (label === 'Total' ? '' : label.toLowerCase().replace(/s$/, '')) + '\')">'
            + '<div style="display:flex;align-items:center;gap:10px;position:relative;z-index:1">'
            + '<div style="width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,' + color + '15,' + color + '08);display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid ' + color + '20">' + icon + '</div>'
            + '<div><div class="ped-stat-num" style="animation:pedCount 0.6s ease ' + (delay + 200) + 'ms both">' + this._fmtNum(value) + '</div>'
            + '<div class="ped-stat-label">' + label + '</div></div></div></div>';
    },

    filter() {
        const search = (document.getElementById('pedFilterSearch')?.value || '').toLowerCase();
        const estado = this.activeStatFilter || '';
        const anio = document.getElementById('pedFilterAnio')?.value || '';
        const mes = document.getElementById('pedFilterMes')?.value || '';
        const filtered = this.allPedidos.filter(p => {
            const matchSearch = !search || (p.numero_pedido || '').toLowerCase().includes(search) || (p.cliente || '').toLowerCase().includes(search) || (p.vendedor || '').toLowerCase().includes(search);
            const matchEstado = !estado || p.estado === estado;
            const fecha = new Date(p.fecha_subida);
            const matchAnio = !anio || fecha.getFullYear() === parseInt(anio);
            const matchMes = !mes || (fecha.getMonth() + 1) === parseInt(mes);
            return matchSearch && matchEstado && matchAnio && matchMes;
        });
        const lbl = document.getElementById('pedCountLabel');
        if (lbl) lbl.textContent = '(' + this._fmtNum(filtered.length) + ')';
        this.renderTable(filtered);
    },

    toggleStatFilter(estado) {
        if (this.activeStatFilter === estado) {
            this.activeStatFilter = null;
        } else {
            this.activeStatFilter = estado;
        }
        this.renderStats();
        this.filter();
    },

    renderTable(pedidos) {
        const tbody = document.getElementById('pedidosTable');
        const cardsEl = document.getElementById('pedidosCards');
        if (!tbody) return;
        if (!pedidos.length) {
            tbody.innerHTML = '<tr><td colspan="' + this.COLUMNAS + '" style="text-align:center;padding:56px 20px">'
                + '<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px;box-shadow:0 4px 12px rgba(0,0,0,0.08)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>'
                + '<div style="font-size:15px;font-weight:700;color:#1e293b;margin-bottom:4px">Sin pedidos</div>'
                + '<div class="ped-nota">No hay pedidos que mostrar</div></td></tr>';
            if (cardsEl) cardsEl.innerHTML = '';
            return;
        }
        tbody.innerHTML = pedidos.map(p => {
            const badge = this.badgeHtml(p.estado, p.motivo_rechazo);
            const dropItems = this._acciones(p).map(a =>
                '<div class="ped-drop-item' + (a.danger ? ' ped-drop-danger' : '') + '" onclick="event.stopPropagation();App.modules.pedidos.' + a.fn + '">' + a.txt + '</div>'
            ).join('');
            return '<tr class="ped-row" style="cursor:pointer">'
                + '<td class="ped-td"><span class="ped-num">' + escText(p.numero_pedido) + '</span></td>'
                + '<td class="ped-td" style="font-weight:600;color:#0f172a">' + escText(p.cliente) + '</td>'
                + '<td class="ped-td ped-td-center">' + this.tipoOvBadge(p.tipo_ov) + '</td>'
                + '<td class="ped-td" style="color:#475569">' + escText(p.vendedor_nombre || p.vendedor) + '</td>'
                + '<td class="ped-td ped-fecha">' + this.fmtDateTime(p.fecha_subida) + '</td>'
                + '<td class="ped-td ped-td-center">' + badge + '</td>'
                + '<td class="ped-td" style="color:#475569">' + escText(p.revisor_nombre || '-') + '</td>'
                + '<td class="ped-td ped-fecha">' + (p.fecha_revision ? this.fmtDateTime(p.fecha_revision) : '<span class="ped-vacio">-</span>') + '</td>'
                + '<td class="ped-td ped-td-right">' + this.fmtTiempo(p.fecha_subida, p.fecha_revision) + '</td>'
                + '<td class="ped-td ped-td-center" style="white-space:nowrap;position:relative">'
                + '<button onclick="App.modules.pedidos.toggleActions(event,' + (Number(p.id) || 0) + ')" class="ped-actions-btn">⋮</button>'
                + '<div class="ped-dropdown" id="pedDrop' + (Number(p.id) || 0) + '">'
                + dropItems
                + '</div></td></tr>';
        }).join('');

        if (cardsEl && cardsEl.offsetParent !== null) {
            cardsEl.innerHTML = SigmaCards.generate({
                title: p => '<strong>' + escText(p.numero_pedido) + '</strong>',
                subtitle: p => escText(p.cliente),
                badge: p => this.badgeHtml(p.estado, p.motivo_rechazo),
                fields: [
                    { label: 'Tipo', value: p => this.tipoOvHtml(p.tipo_ov) },
                    { label: 'Vendedor', value: p => escText(p.vendedor_nombre || p.vendedor) },
                    { label: 'Fecha', value: p => this.fmtDateTime(p.fecha_subida) },
                    { label: 'Revisor', value: p => escText(p.revisor_nombre || '-') }
                ],
                // Mismas acciones que el dropdown (incluye Eliminar, Historial y
                // Rechazar aprobado, que antes faltaban en móvil).
                actions: p => this._acciones(p).map(a =>
                    '<button onclick="event.stopPropagation();App.modules.pedidos.' + a.fn + '" class="btn btn-sm ' + (a.danger ? 'btn-danger' : (a.ok ? 'btn-primary' : 'btn-outline')) + '" style="margin:2px">' + a.txt + '</button>'
                ).join('')
            }, pedidos);
        }

        this.updatePendingBadge(pedidos);
    },

    badgeHtml(estado, motivo) {
        if (estado === 'aprobado') return '<span class="ped-badge" style="background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>APROBADO</span>';
        // El motivo viaja como literal JS dentro del onclick: escJs (NO
        // escapeHtml, que dejaba escapar el atributo y permitía breakout XSS).
        if (estado === 'rechazado') return '<span class="ped-badge" onclick="App.modules.pedidos.showMotivoRechazo(\'' + escJs(motivo || '') + '\')" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;cursor:pointer" title="Ver motivo de rechazo"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>RECHAZADO</span>';
        return '<span class="ped-badge" style="background:#fefce8;color:#ca8a04;border:1px solid #fde68a"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>PENDIENTE</span>';
    },
    showMotivoRechazo(motivo) {
        if (!motivo) { App.toast('No hay motivo de rechazo registrado'); return; }
        App.toast('Motivo: ' + motivo);
    },
    tipoOvBadge(tipo) {
        const t = tipo || 'Normal';
        if (t === 'Express') return '<span class="ped-chip" style="font-weight:700;background:#fde047;color:#0f172a">Express</span>';
        if (t === 'Vta. Region') return '<span class="ped-chip" style="background:#9333ea;color:white">Vta. Region</span>';
        if (t === 'Reposicion') return '<span class="ped-chip" style="background:#dc2626;color:white">Reposición</span>';
        if (t === 'Urgencia') return '<span class="ped-chip" style="font-weight:700;background:#f97316;color:white">Urgencia</span>';
        return '<span class="ped-chip" style="background:#e0f2fe;color:#0f172a">Normal</span>';
    },
    tipoOvHtml(tipo) {
        return tipo || 'Normal';
    },

    updatePendingBadge(pedidos) {
        const pending = pedidos.filter(p => p.estado === 'pendiente').length;
        App.setSidebarBadge('pedidos', pending);
    },

    showUploadModal() {
        document.getElementById('pedUploadModal').style.display = 'flex';
        document.getElementById('pedNumero').value = '';
        document.getElementById('pedCliente').value = '';
        document.getElementById('pedTipoOV').value = 'Normal';
        document.getElementById('pedUploadFilename').style.display = 'none';
        document.getElementById('pedUploadArea').style.borderColor = '#cbd5e1';
        document.getElementById('pedUploadArea').style.background = '#f8fafc';
        this.selectedFile = null;
    },
    hideUploadModal() { document.getElementById('pedUploadModal').style.display = 'none'; },

    setupDragDrop() {
        const area = document.getElementById('pedUploadArea');
        if (!area) return;
        area.addEventListener('dragover', e => { e.preventDefault(); area.style.borderColor = '#3b82f6'; area.style.background = '#eff6ff'; });
        area.addEventListener('dragleave', () => { area.style.borderColor = '#cbd5e1'; area.style.background = '#f8fafc'; });
        area.addEventListener('drop', e => { e.preventDefault(); area.style.borderColor = '#cbd5e1'; area.style.background = '#f8fafc'; if (e.dataTransfer.files.length) this.handleFile(e.dataTransfer.files[0]); });
    },

    handleFileSelect(e) { this.handleFile(e.target.files[0]); },

    // Validación del PDF: tipo + tamaño máximo 50 MB (igual que el límite de
    // multer en el backend), con mensajes claros.
    _validarPdf(file) {
        if (!file) return null;
        const esPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
        if (!esPdf) return 'Por favor selecciona un archivo PDF';
        if (file.size > 50 * 1024 * 1024) return 'El PDF "' + file.name + '" pesa ' + this._fmtTamano(file.size) + '. El máximo permitido es 50 MB';
        return null;
    },

    handleFile(file) {
        const error = this._validarPdf(file);
        if (error) { App.toast(error, 'error'); return; }
        this.selectedFile = file;
        const fname = document.getElementById('pedUploadFilename');
        if (fname) {
            fname.textContent = file.name + ' (' + this._fmtTamano(file.size) + ')';
            fname.style.display = 'block';
        }
        document.getElementById('pedUploadArea').style.borderColor = '#22c55e';
        document.getElementById('pedUploadArea').style.background = '#f0fdf4';
    },

    handleEditFileSelect(e) { this._setEditFile(e.target.files[0]); },

    _setEditFile(file) {
        const fname = document.getElementById('pedEditFilename');
        if (!file) {
            this.editFile = null;
            if (fname) fname.style.display = 'none';
            return;
        }
        const error = this._validarPdf(file);
        if (error) { App.toast(error, 'error'); return; }
        this.editFile = file;
        if (fname) {
            fname.textContent = file.name + ' (' + this._fmtTamano(file.size) + ')';
            fname.style.display = 'block';
        }
    },

    async upload() {
        const numero = document.getElementById('pedNumero').value.trim();
        const cliente = document.getElementById('pedCliente').value.trim().toUpperCase();
        const tipo_ov = document.getElementById('pedTipoOV').value;
        if (!numero || !cliente) { App.toast('Numero de pedido y cliente son requeridos', 'error'); return; }
        if (!this.selectedFile) { App.toast('Por favor selecciona un archivo PDF', 'error'); return; }
        // El backend rechaza igual (canCreate), pero conviene avisar antes de
        // recorrer todo el formulario y adjuntar el PDF que perderlo con un 403.
        if (!this._puedeCrear()) {
            App.toast('No tienes permiso para crear pedidos. Pide al administrador el permiso "Pedidos / Ordenes - Agregar" y recarga la pagina.', 'error');
            return;
        }
        if (this.uploading) return;
        this.uploading = true;
        try {
            const fd = new FormData();
            fd.append('numero_pedido', numero);
            fd.append('cliente', cliente);
            fd.append('tipo_ov', tipo_ov);
            // El vendedor lo determina el backend desde la sesión.
            fd.append('archivo_pdf', this.selectedFile);
            const res = await fetch('/api/pedidos', { method: 'POST', body: fd });
            await this._apiJson(res);
            this.hideUploadModal();
            App.toast('Pedido subido exitosamente');
            this.load();
        } catch(e) {
            App.toast('Error al subir pedido: ' + e.message, 'error');
        }
        this.uploading = false;
    },

    showEditModal(id) {
        const p = this.allPedidos.find(x => x.id === id);
        if (!p) return;
        this.currentPedido = p;
        document.getElementById('pedEditNumero').value = p.numero_pedido;
        document.getElementById('pedEditCliente').value = p.cliente;
        document.getElementById('pedEditTipoOV').value = p.tipo_ov || 'Normal';
        // Aviso de rescate: editar un APROBADO/RECHAZADO lo devuelve a 'pendiente'.
        const aviso = document.getElementById('pedEditAviso');
        if (aviso) {
            if (p.estado !== 'pendiente') {
                aviso.textContent = 'Este pedido está ' + (p.estado === 'aprobado' ? 'APROBADO' : 'RECHAZADO') + '. Al guardarlo volverá a PENDIENTE para poder revisarlo de nuevo.'
                    + (p.estado === 'rechazado' ? ' Su PDF fue eliminado: puedes adjuntar uno nuevo aquí abajo.' : '');
                aviso.style.display = 'block';
            } else {
                aviso.style.display = 'none';
            }
        }
        // Limpiar el PDF opcional de una edición anterior.
        this.editFile = null;
        const fileInput = document.getElementById('pedEditFileInput');
        if (fileInput) fileInput.value = '';
        const fname = document.getElementById('pedEditFilename');
        if (fname) fname.style.display = 'none';
        document.getElementById('pedEditModal').style.display = 'flex';
    },
    hideEditModal() {
        document.getElementById('pedEditModal').style.display = 'none';
        this.currentPedido = null;
        this.editFile = null;
    },

    async saveEdit() {
        if (this._ocupado) return;
        const p = this.currentPedido;
        if (!p) return;
        const numero = document.getElementById('pedEditNumero').value.trim();
        const cliente = document.getElementById('pedEditCliente').value.trim().toUpperCase();
        const tipo_ov = document.getElementById('pedEditTipoOV').value;
        if (!numero || !cliente) { App.toast('Numero y cliente son requeridos', 'error'); return; }
        // Al editar, un pedido APROBADO o RECHAZADO vuelve a 'pendiente'
        // (rechazado→pendiente y aprobado→pendiente los permite el backend):
        // así un pedido rechazado puede rescatarse en vez de quedar en un
        // callejón sin salida.
        const volverAPendiente = p.estado !== 'pendiente';
        this._ocupado = true;
        try {
            const body = { numero_pedido: numero, cliente, tipo_ov };
            if (volverAPendiente) body.estado = 'pendiente';
            const res = await fetch('/api/pedidos/' + (Number(p.id) || 0), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            await this._apiJson(res);
        } catch(e) {
            this._ocupado = false;
            App.toast('Error al guardar: ' + e.message, 'error');
            return;
        }
        // PDF nuevo (opcional): si el pedido no tiene PDF (se borró al
        // rechazar), se puede re-adjuntar aquí vía POST /api/pedidos/:id/pdf.
        let pdfError = '';
        if (this.editFile) {
            try {
                const fd = new FormData();
                fd.append('archivo_pdf', this.editFile);
                const rPdf = await fetch('/api/pedidos/' + (Number(p.id) || 0) + '/pdf', { method: 'POST', body: fd });
                await this._apiJson(rPdf);
            } catch(e) {
                pdfError = e.message;
            }
        }
        this._ocupado = false;
        this.hideEditModal();
        this.load();
        if (pdfError) {
            App.toast('Pedido guardado, pero no se pudo adjuntar el PDF nuevo: ' + pdfError, 'error');
        } else {
            App.toast(volverAPendiente ? 'Pedido editado y vuelto a pendiente para revisión' : 'Pedido actualizado');
        }
    },

    // ───────────────────── Flujo APROBAR (pendiente → aprobado) ─────────────────────
    // 1) Confirmar (App.confirm)
    // 2) PUT {estado:'aprobado'}
    // 3) Descargar el PDF de forma segura y ESPERAR a que la descarga complete
    // 4) Recién entonces DELETE /:id/pdf
    // APROBAR: el backend elimina el PDF al aprobar (sin descarga).
    async aprobarPedido(id) {
        if (this._ocupado) return;
        const p = this.allPedidos.find(x => x.id === id);
        if (!p) return;
        const ok = await App.confirm('�Aprobar el pedido <strong>' + escText(p.numero_pedido) + '</strong>?<br>El PDF ser� eliminado del servidor.');
        if (!ok) return;
        this._ocupado = true;
        try {
            const res = await fetch('/api/pedidos/' + (Number(id) || 0), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: 'aprobado' })
            });
            await this._apiJson(res);   // 409/400 del backend muestran su mensaje
            App.toast('Pedido aprobado. PDF eliminado por el sistema.');
        } catch(e) {
            App.toast('No se pudo aprobar el pedido: ' + e.message, 'error');
        } finally {
            this._ocupado = false;
            this.load();
        }
    },

    // ───────────────────── Flujo RECHAZAR (→ rechazado) ─────────────────────
    // Modal con motivo OBLIGATORIO (estilo del sistema, sin prompt() nativo).
    // El backend elimina el PDF él solo al rechazar. El motivo queda visible
    // después en el badge RECHAZADO (click → showMotivoRechazo).
    showRechazoModal(id) {
        const p = this.allPedidos.find(x => x.id === id);
        if (!p) return;
        if (document.getElementById('pedRechazoModal')) return;
        // Mismo patrón de overlay que el modal de historial: clic-fuera cierra.
        const overlay = document.createElement('div');
        overlay.id = 'pedRechazoModal';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:10000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
        overlay.onclick = (e) => { if (e.target === overlay) this._cerrarRechazoModal(); };
        overlay.innerHTML = '<div style="background:white;border-radius:16px;width:520px;max-width:95vw;box-shadow:0 25px 60px rgba(0,0,0,0.15);overflow:hidden">'
            + '<div style="padding:20px 24px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:12px;justify-content:space-between">'
            + '<div style="display:flex;align-items:center;gap:12px">'
            + '<div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#fef2f2,#fee2e2);display:flex;align-items:center;justify-content:center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>'
            + '<div><div style="font-size:15px;font-weight:700;color:#0f172a">Rechazar Pedido</div>'
            + '<div class="ped-nota">El PDF será eliminado por el sistema</div></div></div>'
            + '<button onclick="App.modules.pedidos._cerrarRechazoModal()" style="background:none;border:none;cursor:pointer;padding:4px;color:#94a3b8"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>'
            + '</div>'
            + '<div style="padding:24px">'
            + '<div style="display:flex;gap:16px;margin-bottom:18px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px">'
            + '<div><span class="ped-mini-label">N Pedido</span><span style="font-size:13px;font-weight:700;color:#0f172a">' + escText(p.numero_pedido) + '</span></div>'
            + '<div><span class="ped-mini-label">Cliente</span><span style="font-size:13px;font-weight:600;color:#475569">' + escText(p.cliente) + '</span></div>'
            + '</div>'
            + '<label class="ped-label">Motivo de Rechazo *</label>'
            + '<textarea id="pedRechazoMotivo" rows="4" placeholder="Indica el motivo del rechazo..." style="font-size:13px;width:100%;padding:12px 14px;border:1px solid #e2e8f0;border-radius:10px;color:#1e293b;background:white;box-sizing:border-box;outline:none;resize:vertical;transition:all 0.2s" onfocus="this.style.borderColor=\'#ef4444\';this.style.boxShadow=\'0 0 0 3px rgba(239,68,68,0.1)\'" oninput="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'"></textarea>'
            + '<div class="ped-nota" style="margin-top:6px">El motivo es obligatorio y quedará visible en el badge RECHAZADO.</div>'
            + '</div>'
            + '<div style="display:flex;justify-content:flex-end;gap:10px;padding:16px 24px;border-top:1px solid #f1f5f9;background:#f8fafc">'
            + '<button onclick="App.modules.pedidos._cerrarRechazoModal()" class="btn btn-outline">Cancelar</button>'
            + '<button onclick="App.modules.pedidos.confirmarRechazo(' + (Number(p.id) || 0) + ')" class="btn btn-danger">Rechazar</button>'
            + '</div></div>';
        document.body.appendChild(overlay);
        // Cierre con Escape (además del clic-fuera).
        this._rechazoKeyHandler = (e) => { if (e.key === 'Escape') this._cerrarRechazoModal(); };
        document.addEventListener('keydown', this._rechazoKeyHandler);
        const ta = document.getElementById('pedRechazoMotivo');
        if (ta) ta.focus();
    },

    _cerrarRechazoModal() {
        const overlay = document.getElementById('pedRechazoModal');
        if (overlay) overlay.remove();
        if (this._rechazoKeyHandler) {
            document.removeEventListener('keydown', this._rechazoKeyHandler);
            this._rechazoKeyHandler = null;
        }
    },

    async confirmarRechazo(id) {
        if (this._ocupado) return;
        const ta = document.getElementById('pedRechazoMotivo');
        const motivo = (ta ? ta.value : '').trim();
        if (!motivo) {
            App.toast('Debes indicar el motivo del rechazo', 'error');
            if (ta) { ta.style.borderColor = '#ef4444'; ta.focus(); }
            return;
        }
        this._ocupado = true;
        try {
            const res = await fetch('/api/pedidos/' + (Number(id) || 0), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: 'rechazado', motivo_rechazo: motivo })
            });
            await this._apiJson(res);   // 409/400 del backend muestran su mensaje
        } catch(e) {
            this._ocupado = false;
            App.toast('No se pudo rechazar el pedido: ' + e.message, 'error');
            return;
        }
        this._ocupado = false;
        this._cerrarRechazoModal();
        App.toast('Pedido rechazado. Motivo registrado y PDF eliminado por el sistema');
        this.load();
    },

    viewPdf(id) {
        window.open('/api/pedidos/' + (Number(id) || 0) + '/pdf', '_blank');
    },

    async deletePedido(id, numero) {
        if (this._ocupado) return;
        // App.confirm (modal del sistema) en vez de confirm() nativo.
        // OJO: el mensaje se inyecta como HTML → escText.
        const ok = await App.confirm('¿Eliminar el pedido ' + escText(numero) + '?<br>Esta acción no se puede deshacer.');
        if (!ok) return;
        this._ocupado = true;
        try {
            const res = await fetch('/api/pedidos/' + (Number(id) || 0), { method: 'DELETE' });
            await this._apiJson(res);
            App.toast('Pedido eliminado');
            this.load();
        } catch(e) {
            App.toast('Error al eliminar: ' + e.message, 'error');
        }
        this._ocupado = false;
    },

    async showHistorial(id) {
        if (this._ocupado) return;
        try {
            const res = await fetch('/api/pedidos/' + (Number(id) || 0) + '/historial');
            const historial = await this._apiJson(res);
            const ped = this.allPedidos.find(x => x.id === id);
            let html = '<div style="padding:0">';
            if (!Array.isArray(historial) || historial.length === 0) {
                html += '<div style="padding:32px;text-align:center;color:#94a3b8"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" style="margin-bottom:12px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><div class="ped-nota">Sin cambios registrados</div></div>';
            } else {
                html += '<div style="padding:20px 24px 12px;border-bottom:1px solid #f1f5f9"><div style="font-size:13px;font-weight:600;color:#0f172a">' + escText(ped ? ped.numero_pedido : '') + '</div><div class="ped-nota" style="margin-top:2px">' + this._fmtNum(historial.length) + ' evento(s)</div></div>';
                html += '<div style="max-height:400px;overflow-y:auto">';
                historial.forEach(h => {
                    // Fecha+hora en el MISMO patrón que la tabla: dd-mm-yyyy HH:mm.
                    const fecha = h.created_at ? this.fmtFechaHoraTexto(h.created_at) : '-';
                    const iconColor = h.accion === 'Aprobado' ? '#16a34a' : h.accion === 'Rechazado' ? '#dc2626' : h.accion === 'Vuelto a pendiente' ? '#f59e0b' : '#8b5cf6';
                    html += '<div style="padding:16px 24px;border-bottom:1px solid #f8fafc">';
                    html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">';
                    html += '<div style="width:28px;height:28px;border-radius:50%;background:' + iconColor + '15;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="' + iconColor + '" stroke-width="2">';
                    if (h.accion === 'Aprobado') html += '<polyline points="20 6 9 17 4 12"/>';
                    else if (h.accion === 'Rechazado') html += '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>';
                    else if (h.accion === 'Vuelto a pendiente') html += '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>';
                    else html += '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>';
                    html += '</svg></div>';
                    html += '<div><div style="font-size:13px;font-weight:600;color:#0f172a">' + escText(h.accion) + '</div>';
                    html += '<div class="ped-nota">' + fecha + (h.usuario ? ' · ' + escText(h.usuario) : '') + '</div></div></div>';
                    if (h.campos_despues && typeof h.campos_despues === 'object') {
                        html += '<div style="margin-left:38px;font-size:13px;color:#475569">';
                        for (const [campo, vals] of Object.entries(h.campos_despues)) {
                            html += '<div style="margin-top:4px"><span style="color:#64748b">' + escText(campo) + ':</span> ';
                            if (vals.antes !== undefined && vals.antes !== null) html += '<span style="text-decoration:line-through;color:#dc2626">' + escText(String(vals.antes)) + '</span> ';
                            html += '<span style="color:#0f172a;font-weight:500">' + escText(String(vals.despues)) + '</span></div>';
                        }
                        html += '</div>';
                    }
                    html += '</div>';
                });
                html += '</div>';
            }
            html += '</div>';
            const overlay = document.createElement('div');
            overlay.id = 'pedHistorialModal';
            overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:10000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
            overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
            overlay.innerHTML = '<div style="background:white;border-radius:16px;width:460px;max-width:95vw;box-shadow:0 25px 60px rgba(0,0,0,0.15);overflow:hidden">'
                + '<div style="padding:20px 24px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between">'
                + '<div><div style="font-size:15px;font-weight:700;color:#0f172a">Historial de Cambios</div></div>'
                + '<button onclick="document.getElementById(\'pedHistorialModal\').remove()" style="background:none;border:none;cursor:pointer;padding:4px;color:#94a3b8"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>'
                + '</div>' + html + '</div>';
            document.body.appendChild(overlay);
        } catch(e) {
            App.toast('Error al cargar historial: ' + e.message, 'error');
        }
    },

    // ─────────────────── Formatos es-CL (un solo patrón en el módulo) ───────────────────
    // Fecha: dd-mm-yyyy · Hora: HH:mm (24h) · Fecha+hora: dd-mm-yyyy HH:mm.

    _fmtFecha(d) {
        return new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    },
    _fmtHora(d) {
        return new Date(d).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
    },
    // Fecha+hora en texto plano (historial): mismo patrón que la tabla.
    fmtFechaHoraTexto(d) {
        if (!d) return '-';
        return this._fmtFecha(d) + ' ' + this._fmtHora(d);
    },
    // Celda de fecha/hora de la tabla: fecha arriba (dato) y hora abajo (nota).
    fmtDateTime(d) {
        if (!d) return '-';
        return '<div class="ped-dt">' + this._fmtFecha(d) + '</div><div class="ped-dt-sub">' + this._fmtHora(d) + '</div>';
    },
    // Duración: SIEMPRE las 2 unidades más significativas con espacio —
    // "5 min", "2 h 30 min", "2 d 4 h" (un solo formato en todo el módulo).
    fmtTiempo(inicio, fin) {
        if (!inicio || !fin) return '<span class="ped-vacio">-</span>';
        const diff = new Date(fin) - new Date(inicio);
        if (diff < 0) return '<span class="ped-vacio">-</span>';
        const mins = Math.floor(diff / 60000);
        const d = Math.floor(mins / 1440);
        const h = Math.floor((mins % 1440) / 60);
        const m = mins % 60;
        if (d > 0) return d + ' d ' + h + ' h';
        if (h > 0) return h + ' h ' + m + ' min';
        return m + ' min';
    }
});
