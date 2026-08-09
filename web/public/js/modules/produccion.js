App.registerModule('produccion', {
    ordenes: [],
    maquinas: [],
    recetas: [],

    async render() {
        const el = document.getElementById('page-produccion');
        if (!el) { console.error('page-produccion element not found'); return; }
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const permisos = user.permisos || [];
        const esAdmin = permisos.includes('usuarios');
        const puedeImportar = esAdmin || permisos.includes('produccion');

        el.innerHTML = '<style>'
            + '@keyframes poFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}'
            + '.po-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}'
            + '.po-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important;transform:translateY(-2px)}'
            + '.po-table tbody tr{transition:background 0.15s}'
            + '.po-table tbody tr:hover{background:#f8fafc!important}'
            + '.po-table-wrapper{overflow:auto;max-height:calc(100vh - 280px);position:relative}'
            + '.po-table thead th{position:sticky;top:0;z-index:10;background:#f8fafc;border-bottom:2px solid #e2e8f0}'
            + '</style>'

            + '<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:8px 16px;margin-bottom:20px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">'
            + '<div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center"><div><h2 style="margin:0;font-size:15px;font-weight:800;color:white;letter-spacing:-0.5px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-3px;margin-right:6px"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>Produccion</h2>'
            + '<p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Gestion de ordenes de produccion y planificacion</p></div>'
            + (puedeImportar ? '<div style="display:flex;gap:8px">'
            + '<button class="btn btn-primary" onclick="App.modules.produccion.showImportModal()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Importar SAP</button>'
            + '<button class="btn btn-danger" style="background:#ef4444;border-color:#ef4444;color:white;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px" onclick="App.modules.produccion.reprogramarTodo()" title="Libera PROGRAMADO y re-asigna por prioridad"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Reprogramar Todo</button>'
            + '<button class="btn btn-outline" style="color:white;border-color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.1)" onclick="App.modules.produccion.eliminarTodas()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Limpiar Todo</button>'
            + '<button class="btn btn-outline" style="color:white;border-color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.1)" onclick="App.modules.produccion.showNewOrderModal()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nueva Orden</button>'
            + '</div>' : '')
            + '</div></div>'

            + '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:14px">'
            + '<div class="po-card" style="background:white;border-radius:10px;padding:10px 12px;border:1px solid #e2e8f0;border-left:4px solid #3b82f6;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:poFadeUp 0.5s ease both;height:55px;display:flex;align-items:center;gap:10px"><div style="width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,#eff6ff,#bfdbfe);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><div><div style="font-size:20px;font-weight:800;color:#0f172a;line-height:1" id="prodTotal">0</div><div style="color:#64748b;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">Total Ordenes</div></div></div>'
            + '<div class="po-card" style="background:white;border-radius:10px;padding:10px 12px;border:1px solid #e2e8f0;border-left:4px solid #f59e0b;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:poFadeUp 0.5s ease 0.05s both;height:55px;display:flex;align-items:center;gap:10px"><div style="width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,#fef3c7,#fde68a);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><div><div style="font-size:20px;font-weight:800;color:#f59e0b;line-height:1" id="prodPendientes">0</div><div style="color:#64748b;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">Pendientes</div></div></div>'
            + '<div class="po-card" style="background:white;border-radius:10px;padding:10px 12px;border:1px solid #e2e8f0;border-left:4px solid #3b82f6;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:poFadeUp 0.5s ease 0.1s both;height:55px;display:flex;align-items:center;gap:10px"><div style="width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,#eff6ff,#bfdbfe);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div><div><div style="font-size:20px;font-weight:800;color:#3b82f6;line-height:1" id="prodProgramadas">0</div><div style="color:#64748b;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">Programadas</div></div></div>'
            + '<div class="po-card" style="background:white;border-radius:10px;padding:10px 12px;border:1px solid #e2e8f0;border-left:4px solid #8b5cf6;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:poFadeUp 0.5s ease 0.15s both;height:55px;display:flex;align-items:center;gap:10px"><div style="width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,#f5f3ff,#ddd6fe);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></div><div><div style="font-size:20px;font-weight:800;color:#8b5cf6;line-height:1" id="prodProceso">0</div><div style="color:#64748b;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">En Proceso</div></div></div>'
            + '<div class="po-card" style="background:white;border-radius:10px;padding:10px 12px;border:1px solid #e2e8f0;border-left:4px solid #22c55e;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:poFadeUp 0.5s ease 0.2s both;height:55px;display:flex;align-items:center;gap:10px"><div style="width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,#f0fdf4,#bbf7d0);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></div><div><div style="font-size:20px;font-weight:800;color:#22c55e;line-height:1" id="prodTerminadas">0</div><div style="color:#64748b;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">Terminadas</div></div></div>'
            + '</div>'

            + '<div style="background:white;border-radius:14px;padding:24px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:poFadeUp 0.5s ease 0.25s both">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px">'
            + '<div style="display:flex;align-items:center;gap:12px"><h3 style="margin:0;font-size:18px;font-weight:700;color:#0f172a">Ordenes de Produccion</h3><span id="prodTotales" style="display:inline-flex;gap:8px;font-size:12px;font-weight:500"></span></div>'
            + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'
            + '<div style="position:relative"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" style="position:absolute;left:10px;top:50%;transform:translateY(-50%)"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" id="prodFilterSearch" placeholder="Buscar codigo, pedido..." oninput="App.modules.produccion.filter()" style="width:170px;padding:8px 8px 8px 32px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;outline:none;transition:border-color 0.2s" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'"></div>'
            + '<input type="date" id="prodFilterFecha" onchange="App.modules.produccion.filter()" style="width:130px;padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;outline:none" title="Filtrar por fecha programada">'
            + '<select id="prodFilterGrupo" onchange="App.modules.produccion.filter()" style="padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;outline:none;background:white"><option value="todos">Todos Grupos</option></select>'
            + '<select id="prodFilterFamilia" onchange="App.modules.produccion.filter()" style="padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;outline:none;background:white"><option value="todas">Todas Familias</option></select>'
            + '<select id="prodFilterEstacion" onchange="App.modules.produccion.filter()" style="padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;outline:none;background:white"><option value="todas">Todas Estaciones</option></select>'
            + '<select id="prodFilterEstado" onchange="App.modules.produccion.filter()" style="padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;outline:none;background:white"><option value="todos">Todos</option><option value="PENDIENTE">Pendientes</option><option value="PROGRAMADO">Programadas</option><option value="EN_PROCESO">En Proceso</option><option value="TERMINADO">Terminados</option><option value="CERRADO">Cerrados</option></select>'
            + '</div></div>'

            + '<div class="po-table-wrapper"><table class="po-table" style="width:100%;font-size:13px;border-collapse:collapse"><thead><tr>'
            + '<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">Pedido</th>'
            + '<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">Item</th>'
            + '<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">Cliente</th>'
            + '<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">Cod. Padre</th>'
            + '<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">Codigo</th>'
            + '<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">Nombre MP</th>'
            + '<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">Dimensiones</th>'
            + '<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">m2</th>'
            + '<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">Kilos</th>'
            + '<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">Cant.</th>'
            + '<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">Prioridad</th>'
            + '<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">F. Programado</th>'
            + '<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">F. Termino</th>'
            + '<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">Ruta</th>'
            + '<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">Reglas</th>'
            + '<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">C. Botella</th>'
            + '<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">Estado</th>'
            + '<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">Acciones</th>'
            + '</tr></thead><tbody id="prodTable"><tr><td colspan="18" style="text-align:center;padding:40px;color:#94a3b8"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" style="margin-bottom:8px"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg><div>Cargando...</div></td></tr></tbody></table></div></div>'

            + '<div class="modal-overlay" id="prodImportModal">'
            + '<div class="modal" style="max-width:500px;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.15)">'
            + '<div class="modal-header"><h3><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--info)" stroke-width="2" style="vertical-align:-3px;margin-right:6px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Importar desde Excel</h3><button class="modal-close" title="Cerrar" onclick="App.modules.produccion.hideImportModal()">&times;</button></div>'
            + '<div class="modal-body" style="padding:24px">'
            + '<div class="form-group"><label style="font-weight:600;color:#334155;font-size:13px">Archivo Excel</label>'
            + '<div id="prodImportArea" style="border:2px dashed #cbd5e1;border-radius:12px;padding:32px;text-align:center;cursor:pointer;transition:all .2s;background:#f8fafc"'
            + ' onclick="document.getElementById(\'prodImportFile\').click()">'
            + '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" style="margin-bottom:8px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
            + '<div style="color:#64748b;font-size:13px">Arrastra un Excel o haz clic para seleccionar</div>'
            + '<div id="prodImportName" style="color:#22c55e;font-weight:600;margin-top:8px;display:none;font-size:13px"></div></div>'
            + '<input type="file" id="prodImportFile" accept=".xlsx,.xls,.csv" style="display:none" onchange="App.modules.produccion.handleImportFile(event)">'
            + '</div>'
            + '<div style="background:#f1f5f9;border-radius:10px;padding:14px;margin-top:12px;font-size:12px;color:#64748b;line-height:1.6">'
            + '<strong style="color:#334155">Columnas esperadas:</strong><br>'
            + 'codigo, pedido, item, cliente, descripcion, cantidad, ancho, alto, perforaciones, pintado, tipo de venta, fecha_creacion, nota, posicion, orden de compra, tipo de entrega<br>'
            + '<em style="color:#94a3b8">Filas iguales (pedido+item+codigo) se fusionan sumando cantidad.</em>'
            + '<div style="margin-top:10px"><button class="btn btn-sm btn-outline" onclick="window.open(\'/api/produccion/importar/template\')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Descargar Plantilla</button></div></div>'
            + '<div id="prodImportPreview" style="max-height:200px;overflow-y:auto;margin-top:12px"></div></div>'
            + '<div class="modal-footer">'
            + '<button class="btn btn-outline" onclick="App.modules.produccion.hideImportModal()">Cancelar</button>'
            + '<button class="btn btn-primary" id="prodImportBtn" onclick="App.modules.produccion.importar()" disabled>Importar</button></div></div></div>'

            + '<div class="modal-overlay" id="prodPasosModal">'
            + '<div class="modal" style="max-width:600px;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.15)">'
            + '<div class="modal-header"><h3><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--info)" stroke-width="2" style="vertical-align:-3px;margin-right:6px"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51l.06.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>Pasos de Produccion</h3><button class="modal-close" title="Cerrar" onclick="App.modules.produccion.hidePasosModal()">&times;</button></div>'
            + '<div class="modal-body" id="prodPasosBody" style="padding:24px"></div></div></div>'

            + '<div class="modal-overlay" id="prodNewOrderModal">'
            + '<div class="modal" style="max-width:500px;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.15)">'
            + '<div class="modal-header"><h3><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--info)" stroke-width="2" style="vertical-align:-3px;margin-right:6px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Nueva Orden Manual</h3><button class="modal-close" title="Cerrar" onclick="App.modules.produccion.hideNewOrderModal()">&times;</button></div>'
            + '<div class="modal-body" style="padding:24px">'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
            + '<div class="form-group"><label style="font-weight:600;color:#334155;font-size:13px">Pedido *</label><input class="form-control" id="newOrdPedido" placeholder="Ej: 100500" style="padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px"></div>'
            + '<div class="form-group"><label style="font-weight:600;color:#334155;font-size:13px">Item</label><input class="form-control" id="newOrdItem" type="number" value="1" min="1" style="padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px"></div></div>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
            + '<div class="form-group"><label style="font-weight:600;color:#334155;font-size:13px">Cliente</label><input class="form-control" id="newOrdCliente" placeholder="NOMBRE DEL CLIENTE" style="text-transform:uppercase;padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px" oninput="this.value=this.value.toUpperCase()"></div>'
            + '<div class="form-group"><label style="font-weight:600;color:#334155;font-size:13px">Codigo Producto *</label><input class="form-control" id="newOrdCodigo" placeholder="Ej: 1240, 730" style="padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px"></div></div>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
            + '<div class="form-group"><label style="font-weight:600;color:#334155;font-size:13px">Ancho (mm) *</label><input class="form-control" id="newOrdAncho" type="number" value="0" style="padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px"></div>'
            + '<div class="form-group"><label style="font-weight:600;color:#334155;font-size:13px">Alto (mm) *</label><input class="form-control" id="newOrdAlto" type="number" value="0" style="padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px"></div></div>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
            + '<div class="form-group"><label style="font-weight:600;color:#334155;font-size:13px">Perforaciones</label><select class="form-control" id="newOrdPerforaciones" style="padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px"><option value="0">No</option><option value="1">Si</option></select></div>'
            + '<div class="form-group"><label style="font-weight:600;color:#334155;font-size:13px">Pintado</label><select class="form-control" id="newOrdPintado" style="padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px"><option value="0">No (0)</option><option value="1">Si (1)</option></select></div></div>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
            + '<div class="form-group"><label style="font-weight:600;color:#334155;font-size:13px">Tipo de Venta</label><select class="form-control" id="newOrdTipoVenta" style="padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px"><option value="Normal">Normal</option><option value="Express">Express</option><option value="Vta Region">Vta Region</option><option value="Urgencia">Urgencia</option></select></div>'
            + '<div class="form-group"><label style="font-weight:600;color:#334155;font-size:13px">Cantidad</label><input class="form-control" id="newOrdCantidad" type="number" value="1" min="1" style="padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px"></div></div>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
            + '<div class="form-group"><label style="font-weight:600;color:#334155;font-size:13px">Tipo de Entrega</label><select class="form-control" id="newOrdTipoEntrega" style="padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px"><option value="Despacho">Despacho</option><option value="Retira">Retira</option></select></div>'
            + '<div class="form-group"><label style="font-weight:600;color:#334155;font-size:13px">Orden de Compra</label><input class="form-control" id="newOrdOC" placeholder="OC-001" style="padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px"></div></div>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
            + '<div class="form-group"><label style="font-weight:600;color:#334155;font-size:13px">Posicion</label><input class="form-control" id="newOrdPosicion" placeholder="Ej: 1, 2, A1" style="padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px"></div>'
            + '<div class="form-group"><label style="font-weight:600;color:#334155;font-size:13px">Fecha Creacion</label><input class="form-control" id="newOrdFechaCreacion" type="date" style="padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px"></div></div>'
            + '<div class="form-group"><label style="font-weight:600;color:#334155;font-size:13px">Nota</label><textarea class="form-control" id="newOrdNota" rows="2" placeholder="Observaciones..." style="padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;resize:vertical"></textarea></div></div>'
            + '<div class="modal-footer">'
            + '<button class="btn btn-outline" onclick="App.modules.produccion.hideNewOrderModal()">Cancelar</button>'
            + '<button class="btn btn-primary" onclick="App.modules.produccion.saveNewOrder()">Crear Orden</button></div></div></div>'

            + '<div class="modal-overlay" id="prodCerrarModal">'
            + '<div class="modal" style="max-width:400px;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.15)">'
            + '<div class="modal-header"><h3><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2" style="vertical-align:-3px;margin-right:6px"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>Cerrar Orden</h3><button class="modal-close" title="Cerrar" onclick="App.modules.produccion.hideCerrarModal()">&times;</button></div>'
            + '<div class="modal-body" style="padding:24px">'
            + '<p style="font-size:13px;color:#64748b;margin-bottom:12px">Indica el motivo por el cual se cierra esta linea:</p>'
            + '<textarea class="form-control" id="cerrarNota" rows="3" placeholder="Ej: Cliente cancelo el pedido..." style="padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;resize:vertical"></textarea></div>'
            + '<div class="modal-footer">'
            + '<button class="btn btn-outline" onclick="App.modules.produccion.hideCerrarModal()">Cancelar</button>'
            + '<button class="btn btn-danger" onclick="App.modules.produccion.confirmCerrar()">Cerrar Orden</button></div></div></div>';

        await this.load();
        this.setupDragDrop();
        document.addEventListener('click', () => { document.querySelectorAll('.prioridad-dropdown').forEach(d => d.style.display = 'none'); });
    },

    async load() {
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const headers = { 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' };
            const [ordenesRes, maquinasRes, recetasRes] = await Promise.all([
                fetch('/api/produccion/ordenes', { headers }),
                fetch('/api/produccion/maquinas', { headers }),
                fetch('/api/produccion/recetas', { headers })
            ]);
            this.ordenes = await ordenesRes.json();
            this.maquinas = await maquinasRes.json();
            this.recetas = await recetasRes.json();
            this.renderStats();
            this.renderTable(this.ordenes);
            this.populateFilters();
        } catch(e) {
            console.error('Error loading produccion:', e);
            const tbody = document.getElementById('prodTable');
            if (tbody) tbody.innerHTML = '<tr><td colspan="18" style="text-align:center;padding:24px;color:#ef4444">Error: ' + (e.message || 'No se pudo cargar') + '</td></tr>';
        }
    },

    populateFilters() {
        const grupos = [...new Set(this.ordenes.map(o => o.grupo).filter(Boolean))].sort();
        const familias = [...new Set(this.ordenes.map(o => o.familia_nombre).filter(Boolean))].sort();
        const estaciones = [...new Set(this.ordenes.flatMap(o => o.estaciones || []).filter(Boolean))].sort();
        const gSel = document.getElementById('prodFilterGrupo');
        const fSel = document.getElementById('prodFilterFamilia');
        const eSel = document.getElementById('prodFilterEstacion');
        if (gSel) { const cur = gSel.value; gSel.innerHTML = '<option value="todos">Todos Grupos</option>' + grupos.map(g => `<option value="${g}" ${g===cur?'selected':''}>${g}</option>`).join(''); }
        if (fSel) { const cur = fSel.value; fSel.innerHTML = '<option value="todas">Todas Familias</option>' + familias.map(f => `<option value="${f}" ${f===cur?'selected':''}>${f}</option>`).join(''); }
        if (eSel) { const cur = eSel.value; eSel.innerHTML = '<option value="todas">Todas Estaciones</option>' + estaciones.map(e => `<option value="${e}" ${e===cur?'selected':''}>${e}</option>`).join(''); }
    },

    renderStats() {
        const total = this.ordenes.length;
        const pendientes = this.ordenes.filter(o => o.estado_programacion === 'PENDIENTE').length;
        const programadas = this.ordenes.filter(o => o.estado_programacion === 'PROGRAMADO').length;
        const enProceso = this.ordenes.filter(o => o.estado_programacion === 'EN_PROCESO').length;
        const terminadas = this.ordenes.filter(o => o.estado_programacion === 'TERMINADO').length;
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('prodTotal', total);
        set('prodPendientes', pendientes);
        set('prodProgramadas', programadas);
        set('prodProceso', enProceso);
        set('prodTerminadas', terminadas);
    },

    renderTable(ordenes) {
        const tbody = document.getElementById('prodTable');
        this.renderTotales(ordenes);
        if (!ordenes.length) { tbody.innerHTML = '<tr><td colspan="18" style="text-align:center;padding:48px;color:#94a3b8"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" style="margin-bottom:8px"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg><div style="font-size:14px;font-weight:500">No hay ordenes de produccion</div></td></tr>'; return; }

        const estadoBadge = (e) => {
            if (e === 'TERMINADO') return '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:#dcfce7;color:#166534">TERMINADO</span>';
            if (e === 'PROGRAMADO') return '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:#dbeafe;color:#1e40af">PROGRAMADO</span>';
            if (e === 'EN_PROCESO') return '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:#dbeafe;color:#1e40af">EN PROCESO</span>';
            if (e === 'MERMADO') return '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:#fee2e2;color:#991b1b">MERMADO</span>';
            if (e === 'CERRADO') return '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:#e5e7eb;color:#374151">CERRADO</span>';
            return '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:#fef9c3;color:#854d0e">PENDIENTE</span>';
        };

        const prioridadBadge = (nivel, ordenId) => {
            const n = Number(nivel) || 1;
            const map = {
                4: { label: 'Reposicion', bg: '#fef2f2', color: '#991b1b', border: '#ef4444', icon: '&#128293;' },
                3: { label: 'Urgencia', bg: '#fff7ed', color: '#9a3412', border: '#f97316', icon: '&#9889;' },
                2: { label: 'Express', bg: '#fefce8', color: '#854d0e', border: '#eab308', icon: '&#9889;' },
                1: { label: 'Normal', bg: '#f8fafc', color: '#64748b', border: '#e2e8f0', icon: '' }
            };
            const m = map[n] || map[1];
            return `<span class="tipo-venta-badge" data-orden-id="${ordenId}" style="padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;border:1px solid ${m.border};background:${m.bg};color:${m.color};cursor:pointer;position:relative;display:inline-block" onclick="event.stopPropagation();App.modules.produccion.togglePrioridadMenu(event, ${ordenId})" title="Click para cambiar prioridad">${m.icon ? '<span style="font-size:10px">' + m.icon + '</span> ' : ''}${m.label} &#9662;</span>
            <div class="prioridad-dropdown" id="prioDrop_${ordenId}" style="display:none;position:absolute;top:100%;left:0;z-index:50;background:white;border:1px solid #e2e8f0;border-radius:8px;padding:4px;min-width:160px;box-shadow:0 8px 24px rgba(0,0,0,0.15);margin-top:4px">
                <div onclick="event.stopPropagation();App.modules.produccion.cambiarPrioridad(${ordenId}, 1)" style="padding:6px 10px;border-radius:4px;cursor:pointer;font-size:12px;color:#334155;display:flex;align-items:center;gap:6px;transition:background 0.1s" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background=''"><span style="color:#94a3b8">&#9679;</span> 1 - Normal</div>
                <div onclick="event.stopPropagation();App.modules.produccion.cambiarPrioridad(${ordenId}, 2)" style="padding:6px 10px;border-radius:4px;cursor:pointer;font-size:12px;color:#334155;display:flex;align-items:center;gap:6px;transition:background 0.1s" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background=''"><span style="color:#eab308">&#9889;</span> 2 - Express</div>
                <div onclick="event.stopPropagation();App.modules.produccion.cambiarPrioridad(${ordenId}, 3)" style="padding:6px 10px;border-radius:4px;cursor:pointer;font-size:12px;color:#334155;display:flex;align-items:center;gap:6px;transition:background 0.1s" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background=''"><span style="color:#f97316">&#9889;</span> 3 - Urgencia</div>
                <div onclick="event.stopPropagation();App.modules.produccion.cambiarPrioridad(${ordenId}, 4)" style="padding:6px 10px;border-radius:4px;cursor:pointer;font-size:12px;color:#334155;display:flex;align-items:center;gap:6px;transition:background 0.1s" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background=''"><span style="color:#ef4444">&#128293;</span> 4 - Reposicion</div>
            </div>`;
        };

        tbody.innerHTML = ordenes.map(o => {
            const progreso = o.total_pasos > 0 ? o.pasos_terminados + '/' + o.total_pasos : '-';
            return '<tr style="line-height:1.3;border-bottom:1px solid #f1f5f9">'
                + '<td style="padding:10px 12px"><strong style="color:#0f172a">' + escapeHtml(o.pedido_sap_id || '-') + '</strong></td>'
                + '<td style="padding:10px 12px;color:#475569">' + (o.item_numero || '-') + '</td>'
                + '<td style="padding:10px 12px;color:#475569">' + escapeHtml((o.cliente || '-').toUpperCase()) + '</td>'
                + '<td style="padding:10px 12px;font-size:11px;color:#94a3b8">' + (o.codigo_padre ? escapeHtml(o.codigo_padre) + (o.nombre_codigo_padre ? ' - ' + escapeHtml(o.nombre_codigo_padre) : '') : '-') + '</td>'
                + '<td style="padding:10px 12px"><strong style="color:#0f172a">' + escapeHtml(o.codigo_producto) + '</strong>'
                + (o.es_compuesto ? ' <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:#ede9fe;color:#7c3aed;font-weight:600">BOM</span>' : ' <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:#fef2f2;color:#ef4444;font-weight:600" title="Sin receta BOM">SIN BOM</span>')
                + '</td>'
                + '<td style="padding:10px 12px;font-size:11px;color:#94a3b8">' + escapeHtml(o.nombre_mp || o.descripcion || '-') + '</td>'
                + '<td style="padding:10px 12px;color:#475569">' + o.ancho + ' x ' + o.alto + ' mm</td>'
                + '<td style="padding:10px 12px;color:#475569">' + (o.metros_cuadrados ? Number(o.metros_cuadrados).toFixed(2) : '-') + '</td>'
                + '<td style="padding:10px 12px;font-weight:600;color:#0f172a">' + (o.kilos ? Number(o.kilos).toFixed(1) : '-') + '</td>'
                + '<td style="padding:10px 12px;cursor:pointer" title="Click para editar" onclick="App.modules.produccion.editCantidad(' + o.id + ', ' + (o.cantidad || 1) + ')"><strong style="color:#3b82f6">' + (o.cantidad || 1) + '</strong></td>'
                + '<td style="padding:10px 12px">' + prioridadBadge(o.nivel_prioridad, o.id) + '</td>'
                + '<td style="padding:10px 12px;font-size:11px;color:#94a3b8">' + (() => { const f = o.fecha_programada; if (!f) return '<span style="color:#cbd5e1">-</span>'; const d = new Date(f); if (isNaN(d.getTime())) return '<span style="color:#cbd5e1">-</span>'; return String(d.getUTCDate()).padStart(2,'0') + '/' + String(d.getUTCMonth()+1).padStart(2,'0'); })() + '</td>'
                + '<td style="padding:10px 12px;font-size:11px;color:#94a3b8">' + (() => { const f = o.fecha_entrega_pactada; if (!f) return '<span style="color:#cbd5e1">-</span>'; const d = new Date(f); if (isNaN(d.getTime())) return '<span style="color:#cbd5e1">-</span>'; return String(d.getUTCDate()).padStart(2,'0') + '/' + String(d.getUTCMonth()+1).padStart(2,'0'); })() + '</td>'
                + '<td style="padding:10px 12px;color:#475569">' + (o.total_pasos === 0 ? '<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:#fef2f2;color:#ef4444;font-weight:600" title="Sin estaciones asociadas">SIN RUTA</span>' : progreso) + '</td>'
                + '<td style="padding:10px 12px">' + (() => {
                    let reglas = o.reglas_extras_json;
                    if (typeof reglas === 'string') { try { reglas = JSON.parse(reglas); } catch(e) { reglas = []; } }
                    if (!reglas || !reglas.length) return '<span style="color:#cbd5e1">-</span>';
                    const colors = { 'Radio': '#8b5cf6', 'Pulido': '#6366f1', 'Perforado': '#f59e0b', 'Destaje': '#ef4444', 'Sacado': '#ec4899', 'Ventana': '#14b8a6', 'Pintado': '#3b82f6', 'Pintado Car': '#0ea5e9' };
                    return reglas.map(r => '<span style="display:inline-block;font-size:9px;padding:1px 5px;border-radius:3px;background:' + (colors[r] || '#94a3b8') + ';color:white;margin:1px;font-weight:600">' + r + '</span>').join('');
                })() + '</td>'
                + '<td style="padding:10px 12px">' + (o.cuello_botella ? '<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:#fef2f2;color:#ef4444;font-weight:600">' + escapeHtml(o.cuello_botella) + '</span>' : '<span style="color:#cbd5e1">-</span>') + '</td>'
                + '<td style="padding:10px 12px">' + estadoBadge(o.estado_programacion) + (o.cerrado_nota ? ' <span title="' + o.cerrado_nota.replace(/"/g, '&quot;') + '" style="cursor:pointer;font-size:10px;color:#94a3b8"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></span>' : '') + '</td>'
                + '<td style="padding:10px 12px;white-space:nowrap">'
                + '<button class="btn btn-sm btn-info" title="Ver pasos" onclick="App.modules.produccion.verPasos(' + o.id + ')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>'
                + (o.estado_programacion !== 'CERRADO' ? ' <button class="btn btn-sm btn-outline" title="Cerrar orden" onclick="App.modules.produccion.cerrarOrden(' + o.id + ')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg></button>' : '')
                + ' <button class="btn btn-sm btn-danger" title="Eliminar" onclick="App.modules.produccion.eliminarOrden(' + o.id + ')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>'
                + '</td></tr>';
        }).join('');
    },

    filter() {
        const search = (document.getElementById('prodFilterSearch')?.value || '').toLowerCase();
        const estado = document.getElementById('prodFilterEstado')?.value || 'todos';
        const fechaFilter = document.getElementById('prodFilterFecha')?.value || '';
        const grupo = document.getElementById('prodFilterGrupo')?.value || 'todos';
        const familia = document.getElementById('prodFilterFamilia')?.value || 'todas';
        const estacion = document.getElementById('prodFilterEstacion')?.value || 'todas';
        let filtered = this.ordenes;
        if (search) filtered = filtered.filter(o => (o.codigo_producto || '').toLowerCase().includes(search) || (o.pedido_sap_id || '').toLowerCase().includes(search) || (o.cliente || '').toLowerCase().includes(search) || (o.nombre_codigo_padre || '').toLowerCase().includes(search) || (o.nombre_mp || '').toLowerCase().includes(search));
        if (estado !== 'todos') filtered = filtered.filter(o => o.estado_programacion === estado);
        if (fechaFilter) filtered = filtered.filter(o => { const f = o.fecha_programada; if (!f) return false; const d = new Date(f); const fs = d.getUTCFullYear() + '-' + String(d.getUTCMonth()+1).padStart(2,'0') + '-' + String(d.getUTCDate()).padStart(2,'0'); return fs === fechaFilter; });
        if (grupo !== 'todos') filtered = filtered.filter(o => o.grupo === grupo);
        if (familia !== 'todas') filtered = filtered.filter(o => o.familia_nombre === familia);
        if (estacion !== 'todas') filtered = filtered.filter(o => (o.estaciones || []).includes(estacion));
        this.renderTable(filtered);
    },

    renderTotales(ordenes) {
        const el = document.getElementById('prodTotales');
        if (!el) return;
        const totalM2 = ordenes.reduce((s, o) => s + Number(o.metros_cuadrados || 0), 0);
        const totalKg = ordenes.reduce((s, o) => s + Number(o.kilos || 0), 0);
        const totalCant = ordenes.reduce((s, o) => s + Number(o.cantidad || 0), 0);
        el.innerHTML = `
            <span style="padding:3px 8px;border-radius:4px;background:#dbeafe;color:#1e40af">${ordenes.length} ordenes</span>
            <span style="padding:3px 8px;border-radius:4px;background:#fef3c7;color:#854d0e">${totalCant} und</span>
            <span style="padding:3px 8px;border-radius:4px;background:#e0e7ff;color:#3730a3">${totalM2.toLocaleString('es-CL', {maximumFractionDigits:2})} m²</span>
            <span style="padding:3px 8px;border-radius:4px;background:#dcfce7;color:#166534"><strong>${totalKg.toLocaleString('es-CL', {maximumFractionDigits:1})} kg</strong></span>
        `;
    },

    setupDragDrop() {
        const area = document.getElementById('prodImportArea');
        if (!area) return;
        area.addEventListener('dragover', e => { e.preventDefault(); area.style.borderColor = '#3b82f6'; area.style.background = '#eff6ff'; });
        area.addEventListener('dragleave', () => { area.style.borderColor = '#cbd5e1'; area.style.background = ''; });
        area.addEventListener('drop', e => { e.preventDefault(); area.style.borderColor = '#cbd5e1'; area.style.background = ''; if (e.dataTransfer.files.length) this.handleImportFile({ target: { files: e.dataTransfer.files } }); });
    },

    selectedImportFile: null,

    handleImportFile(e) {
        const file = e.target.files[0];
        if (!file) return;
        this.selectedImportFile = file;
        document.getElementById('prodImportName').textContent = file.name;
        document.getElementById('prodImportName').style.display = 'block';
        document.getElementById('prodImportBtn').disabled = false;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const wb = XLSX.read(ev.target.result, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws);
                this._importRows = rows;
                const preview = document.getElementById('prodImportPreview');
                preview.innerHTML = `<div style="font-size:12px;margin-bottom:4px"><strong>${rows.length}</strong> items encontrados</div>
                    <table style="width:100%;font-size:11px"><thead><tr><th style="padding:4px 8px">Codigo</th><th style="padding:4px 8px">Pedido</th><th style="padding:4px 8px">Item</th><th style="padding:4px 8px">Cliente</th><th style="padding:4px 8px">Cant</th><th style="padding:4px 8px">Ancho</th><th style="padding:4px 8px">Alto</th><th style="padding:4px 8px">Pint</th><th style="padding:4px 8px">Tipo Venta</th><th style="padding:4px 8px">Fecha</th></tr></thead><tbody>
                    ${rows.slice(0, 10).map(r => {
                        const cod = r.codigo || r.Codigo || r.CODIGO || '';
                        const ped = r.pedido || r.Pedido || r.PEDIDO || '';
                        const it = r.item || r.Item || r.ITEM || '';
                        const cli = r.cliente || r.Cliente || '';
                        const cant = r.cantidad || r.Cantidad || 1;
                        const ancho = r.anho || r.ancho || r.Ancho || r.ANCHO || 0;
                        const alto = r.alto || r.Alto || r.ALTO || 0;
                        const pint = r.pintado || r.Pintado || r.PINTADO || 0;
                        const tipo = r['tipo de venta'] || r.tipo_de_venta || r.TipoVenta || 'Normal';
                        const fecha = r.fecha_creacion || r.FechaCreacion || r.fecha || r.Fecha || '';
                        return `<tr><td style="padding:4px 8px">${cod}</td><td style="padding:4px 8px">${ped}</td><td style="padding:4px 8px">${it}</td><td style="padding:4px 8px">${cli}</td><td style="padding:4px 8px">${cant}</td><td style="padding:4px 8px">${ancho}</td><td style="padding:4px 8px">${alto}</td><td style="padding:4px 8px">${pint}</td><td style="padding:4px 8px">${tipo}</td><td style="padding:4px 8px">${fecha}</td></tr>`;
                    }).join('')}
                    ${rows.length > 10 ? `<tr><td colspan="10" style="text-align:center;padding:4px;color:var(--text-light)">... y ${rows.length - 10} mas</td></tr>` : ''}
                    </tbody></table>`;
            } catch(err) { document.getElementById('prodImportPreview').innerHTML = '<span style="color:red">Error al leer archivo</span>'; }
        };
        reader.readAsArrayBuffer(file);
    },

    async importar() {
        console.log('[IMPORT] Iniciando importar, selectedImportFile:', this.selectedImportFile);
        if (!this.selectedImportFile) { console.log('[IMPORT] No hay archivo seleccionado'); return; }
        const btn = document.getElementById('prodImportBtn');
        btn.textContent = 'Procesando...';
        btn.disabled = true;

        try {
            const data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    try {
                        const wb = XLSX.read(reader.result, { type: 'array' });
                        const ws = wb.Sheets[wb.SheetNames[0]];
                        const rows = XLSX.utils.sheet_to_json(ws);
                        console.log('[IMPORT] Excel parseado:', rows.length, 'filas');
                        resolve(rows);
                    } catch(e) { console.error('[IMPORT] Error parseando XLSX:', e); reject(e); }
                };
                reader.onerror = () => reject(new Error('Error al leer archivo'));
                reader.readAsArrayBuffer(this.selectedImportFile);
            });

            if (!data.length) { alert('El archivo esta vacio'); btn.textContent = 'Importar'; btn.disabled = false; return; }

            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const payload = JSON.stringify({ rows: data });
            console.log('[IMPORT] Enviando payload:', payload.length, 'bytes');
            const res = await fetch('/api/produccion/importar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' },
                body: payload
            });

            console.log('[IMPORT] Response status:', res.status);
            const result = await res.json();
            console.log('[IMPORT] Resultado:', JSON.stringify(result).substring(0, 500));
            if (res.ok) {
                let msg = `Importadas: ${result.importadas} ordenes, ${result.pasos_creados} pasos.`;
                if (result.fusiones > 0) msg += `\nFusiones: ${result.fusiones} filas combinadas.`;
                if (result.costos_calculados > 0) msg += `\nCostos calculados: ${result.costos_calculados}.`;
                if (result.errores && result.errores.length) {
                    msg += `\n\nERRORES (${result.errores.length}):`;
                    result.errores.slice(0, 10).forEach(e => {
                        msg += `\n• [${e.codigo || e.fila}] ${e.error}`;
                    });
                    if (result.errores.length > 10) msg += `\n... y ${result.errores.length - 10} mas`;
                }
                App.toast(msg, result.errores?.length ? 'warn' : 'success');
                this.hideImportModal();
                await this.load();
            } else {
                alert(result.error || 'Error al importar');
            }
        } catch(e) { alert('Error: ' + e.message); }

        btn.textContent = 'Importar';
        btn.disabled = false;
    },

    async verPasos(ordenId) {
        try {
            const [pasosRes, estacionesRes] = await Promise.all([
                fetch(`/api/produccion/ordenes/${ordenId}/pasos`),
                fetch('/api/produccion/estaciones')
            ]);
            const pasos = await pasosRes.json();
            const todasEstaciones = await estacionesRes.json();
            const orden = this.ordenes.find(o => o.id === ordenId);
            const body = document.getElementById('prodPasosBody');
            const estadoEstilo = { PENDIENTE: 'background:#fef9c3;color:#854d0e', EN_PROCESO: 'background:#dbeafe;color:#1e40af', TERMINADO: 'background:#dcfce7;color:#166534', MERMADO: 'background:#fee2e2;color:#991b1b' };
            const estIdsActuales = pasos.map(p => p.estacion_id);
            const estDisponibles = todasEstaciones.filter(e => e.activa && !estIdsActuales.includes(e.id));
            body.innerHTML = `
                <div style="margin-bottom:12px"><strong>Pedido:</strong> ${orden?.pedido_sap_id || '-'} | <strong>Codigo:</strong> ${orden?.codigo_producto} | <strong>${orden?.ancho}x${orden?.alto}mm</strong></div>
                ${pasos.length === 0 ? '<div style="color:var(--text-light);text-align:center;padding:20px">Sin pasos definidos</div>' :
                `<table><thead><tr><th>#</th><th>Estacion</th><th>Estado</th><th>Inicio</th><th>Fin</th><th></th></tr></thead><tbody>${pasos.map(p => {
                    return `<tr>
                        <td>${p.orden_secuencia}</td>
                        <td><strong>${p.nombre_estacion || p.estacion_nombre}</strong></td>
                        <td><span style="padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;${estadoEstilo[p.estado] || ''}">${p.estado}</span></td>
                        <td>${p.hora_inicio ? new Date(p.hora_inicio).toLocaleString('es-CL') : '-'}</td>
                        <td>${p.hora_fin ? new Date(p.hora_fin).toLocaleString('es-CL') : '-'}</td>
                        <td>${p.estado === 'PENDIENTE' ? `<button class="btn btn-sm btn-danger" onclick="App.modules.produccion.eliminarPaso(${p.id}, ${ordenId})" title="Quitar estacion"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` : ''}</td>
                    </tr>`;
                }).join('')}</tbody></table>`}
                ${estDisponibles.length > 0 ? `
                <div style="margin-top:12px;display:flex;gap:8px;align-items:center">
                    <select id="addEstacion_${ordenId}" class="form-control" style="flex:1;padding:6px;font-size:12px">
                        <option value="">-- Agregar estacion --</option>
                        ${estDisponibles.map(e => `<option value="${e.id}">${e.orden_secuencia_defecto || '?'}° ${e.nombre_estacion}</option>`).join('')}
                    </select>
                    <button class="btn btn-sm btn-primary" onclick="App.modules.produccion.agregarPaso(${ordenId})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Agregar</button>
                </div>` : ''}
            `;
            document.getElementById('prodPasosModal').classList.add('show');
        } catch(e) { alert('Error al cargar pasos: ' + e.message); }
    },

    hidePasosModal() { document.getElementById('prodPasosModal').classList.remove('show'); },

    async updatePaso(pasoId, nuevoEstado, ordenId) {
        try {
            const res = await fetch(`/api/produccion/pasos/${pasoId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: nuevoEstado })
            });
            const data = await res.json();
            if (res.ok) {
                await this.verPasos(ordenId);
                await this.load();
            } else { alert(data.error || 'Error al actualizar'); }
        } catch(e) { alert('Error: ' + e.message); }
    },

    async agregarPaso(ordenId) {
        const select = document.getElementById(`addEstacion_${ordenId}`);
        const estacionId = Number(select?.value);
        if (!estacionId) return;
        try {
            const res = await fetch(`/api/produccion/ordenes/${ordenId}/pasos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estacion_id: estacionId })
            });
            const data = await res.json();
            if (res.ok) {
                App.toast('Estacion agregada');
                await this.verPasos(ordenId);
                await this.load();
            } else { alert(data.error || 'Error al agregar'); }
        } catch(e) { alert('Error: ' + e.message); }
    },

    async eliminarPaso(pasoId, ordenId) {
        if (!confirm('Quitar esta estacion de la ruta?')) return;
        try {
            const res = await fetch(`/api/produccion/pasos/${pasoId}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok) {
                App.toast('Estacion eliminada');
                await this.verPasos(ordenId);
                await this.load();
            } else { alert(data.error || 'Error al eliminar'); }
        } catch(e) { alert('Error: ' + e.message); }
    },

    showImportModal() { document.getElementById('prodImportModal').classList.add('show'); this.selectedImportFile = null; },
    hideImportModal() { document.getElementById('prodImportModal').classList.remove('show'); this.selectedImportFile = null; document.getElementById('prodImportName').style.display = 'none'; document.getElementById('prodImportBtn').disabled = true; },

    showNewOrderModal() {
        document.getElementById('newOrdPedido').value = '';
        document.getElementById('newOrdItem').value = '1';
        document.getElementById('newOrdCliente').value = '';
        document.getElementById('newOrdCodigo').value = '';
        document.getElementById('newOrdAncho').value = '0';
        document.getElementById('newOrdAlto').value = '0';
        document.getElementById('newOrdPerforaciones').value = '0';
        document.getElementById('newOrdPintado').value = '0';
        document.getElementById('newOrdTipoVenta').value = 'Normal';
        document.getElementById('newOrdCantidad').value = '1';
        document.getElementById('newOrdTipoEntrega').value = 'Despacho';
        document.getElementById('newOrdOC').value = '';
        document.getElementById('newOrdPosicion').value = '';
        document.getElementById('newOrdNota').value = '';
        document.getElementById('newOrdFechaCreacion').value = new Date().toISOString().split('T')[0];
        document.getElementById('prodNewOrderModal').classList.add('show');
    },
    hideNewOrderModal() { document.getElementById('prodNewOrderModal').classList.remove('show'); },

    async saveNewOrder() {
        const pedido = document.getElementById('newOrdPedido').value.trim();
        const item = Number(document.getElementById('newOrdItem').value) || 1;
        const cliente = document.getElementById('newOrdCliente').value.trim().toUpperCase();
        const codigo = document.getElementById('newOrdCodigo').value.trim();
        const ancho = Number(document.getElementById('newOrdAncho').value) || 0;
        const alto = Number(document.getElementById('newOrdAlto').value) || 0;
        const perforaciones = document.getElementById('newOrdPerforaciones').value === '1';
        const pintado = document.getElementById('newOrdPintado').value === '1';
        const tipo_venta = document.getElementById('newOrdTipoVenta').value;
        const cantidad = Number(document.getElementById('newOrdCantidad').value) || 1;
        const fecha_creacion = document.getElementById('newOrdFechaCreacion').value || null;
        const tipo_entrega = document.getElementById('newOrdTipoEntrega').value;
        const orden_compra = document.getElementById('newOrdOC').value.trim();
        const posicion = document.getElementById('newOrdPosicion').value.trim();
        const nota = document.getElementById('newOrdNota').value.trim();
        if (!pedido || !codigo || !ancho || !alto) { alert('Pedido, codigo, ancho y alto son requeridos'); return; }
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const headers = { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' };
            const res = await fetch('/api/produccion/ordenes', {
                method: 'POST', headers,
                body: JSON.stringify({ pedido_sap_id: pedido, item_numero: item, cliente, codigo_producto: codigo, ancho, alto, perforaciones, pintado, tipo_venta, cantidad, fecha_creacion, tipo_entrega, orden_compra, posicion, nota })
            });
            const data = await res.json();
            if (res.ok) {
                const msg = data.ordenes_creadas > 1 ? `${data.ordenes_creadas} ordenes creadas (explosion BOM)` : `Orden creada: ${codigo}`;
                App.toast(msg);
                this.hideNewOrderModal();
                await this.load();
            } else { alert(data.error || 'Error al crear orden'); }
        } catch(e) { alert('Error: ' + e.message); }
    },

    async editCantidad(id, current) {
        const nueva = prompt('Nueva cantidad:', current);
        if (nueva === null || isNaN(Number(nueva)) || Number(nueva) < 1) return;
        const cant = Number(nueva);
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const orden = this.ordenes.find(o => o.id === id);
            const ancho = orden?.ancho || 0;
            const alto = orden?.alto || 0;
            const m2 = ((ancho * alto) / 1000000) * cant;
            const res = await fetch(`/api/produccion/ordenes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' },
                body: JSON.stringify({ cantidad: cant, metros_cuadrados: m2 })
            });
            if (res.ok) { App.toast('Cantidad actualizada'); await this.load(); }
            else { const d = await res.json(); alert(d.error || 'Error'); }
        } catch(e) { alert('Error: ' + e.message); }
    },

    async cambiarPrioridad(id, nuevoNivel) {
        document.querySelectorAll('.prioridad-dropdown').forEach(d => d.style.display = 'none');
        if (![1, 2, 3, 4].includes(nuevoNivel)) return;
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const res = await fetch(`/api/produccion/ordenes/${id}/prioridad`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'X-User-Email': user.email || '' },
                body: JSON.stringify({ nivel_prioridad: nuevoNivel })
            });
            if (res.ok) { App.toast('Prioridad actualizada'); await this.load(); }
            else { const d = await res.json(); alert(d.error || 'Error'); }
        } catch(e) { alert('Error: ' + e.message); }
    },

    togglePrioridadMenu(e, id) {
        e.stopPropagation();
        const menu = document.getElementById('prioDrop_' + id);
        if (!menu) return;
        const wasVisible = menu.style.display === 'block';
        document.querySelectorAll('.prioridad-dropdown').forEach(d => d.style.display = 'none');
        if (!wasVisible) menu.style.display = 'block';
    },

    async reprogramarTodo() {
        if (!confirm('REPROGRAMAR TODO:\n\nSe liberaran TODAS las ordenes PROGRAMADO (se devuelven a PENDIENTE) y se re-asignaran automaticamente por prioridad (Reposicion > Urgencia > Express > Normal).\n\nLas ordenes EN PROCESO, MERMADAS y TERMINADAS NO seran tocadas.\n\nContinuar?')) return;
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            App.toast('Reprogramando... espere', 'info');
            const res = await fetch('/api/produccion/reprogramar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Email': user.email || '' },
                body: JSON.stringify({ dias: 21, inicio: new Date().toISOString().split('T')[0] })
            });
            const data = await res.json();
            if (res.ok) {
                const lib = data.ordenes_liberadas || 0;
                const asig = Array.isArray(data.asignados) ? data.asignados.length : 0;
                App.toast(`Reprogramado: ${lib} liberadas, ${asig} re-asignadas`);
                await this.load();
            } else { alert(data.error || 'Error al reprogramar'); }
        } catch(e) { alert('Error: ' + e.message); }
    },

    _cerrarId: null,

    cerrarOrden(id) {
        this._cerrarId = id;
        document.getElementById('cerrarNota').value = '';
        document.getElementById('prodCerrarModal').classList.add('show');
    },

    hideCerrarModal() {
        document.getElementById('prodCerrarModal').classList.remove('show');
        this._cerrarId = null;
    },

    async confirmCerrar() {
        const nota = document.getElementById('cerrarNota').value.trim();
        if (!nota) { alert('Debes indicar el motivo del cierre'); return; }
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const res = await fetch(`/api/produccion/ordenes/${this._cerrarId}/cerrar`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-User-Email': user.email || '' },
                body: JSON.stringify({ nota })
            });
            const data = await res.json();
            if (res.ok) {
                App.toast('Orden cerrada');
                this.hideCerrarModal();
                await this.load();
            } else { alert(data.error || 'Error al cerrar'); }
        } catch(e) { alert('Error: ' + e.message); }
    },

    async eliminarOrden(id) {
        if (!confirm('Eliminar esta orden de produccion? Esta accion no se puede deshacer.')) return;
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            await fetch(`/api/produccion/ordenes/${id}`, {
                method: 'DELETE', headers: { 'X-User-Email': user.email || '' }
            });
            App.toast('Orden eliminada');
            await this.load();
        } catch(e) { alert('Error: ' + e.message); }
    },

    async eliminarTodas() {
        if (!confirm('ELIMINAR TODAS las ordenes de produccion? Esta accion no se puede deshacer.')) return;
        if (!confirm('Se eliminaran todas las ordenes, pasos y datos de produccion. Continuar?')) return;
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const res = await fetch('/api/produccion/ordenes/all', {
                method: 'DELETE', headers: { 'X-User-Email': user.email || '' }
            });
            const data = await res.json();
            if (data.ok) {
                App.toast(`${data.eliminadas} ordenes eliminadas`);
                await this.load();
            } else { alert(data.error || 'Error al eliminar'); }
        } catch(e) { alert('Error: ' + e.message); }
    },

    async deleteReceta(id) {
        if (!confirm('Eliminar esta receta BOM?')) return;
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            await fetch(`/api/produccion/recetas/${id}`, {
                method: 'DELETE', headers: { 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' }
            });
            App.toast('Receta eliminada');
            await this.load();
        } catch(e) { alert('Error: ' + e.message); }
    }
});
