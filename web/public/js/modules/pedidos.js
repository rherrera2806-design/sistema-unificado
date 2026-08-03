App.registerModule('pedidos', {
    allPedidos: [],
    currentPedido: null,
    selectedFile: null,
    isVendedor: false,
    canAuthorize: false,
    uploading: false,

    async render() {
        const el = document.getElementById('page-pedidos');
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const permisos = user.permisos || [];
        this.isVendedor = permisos.includes('pedidos') && !permisos.includes('pedidos.agregar');
        this.canAuthorize = permisos.includes('pedidos.editar') || permisos.includes('usuarios');
        this.canCreate = permisos.includes('pedidos.agregar') || permisos.includes('usuarios');
        const showNew = this.isVendedor || this.canAuthorize || this.canCreate;

        el.innerHTML = '<style>'
            + '@keyframes pedFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}'
            + '@keyframes pedCount{from{opacity:0;transform:scale(0.8)}to{opacity:1;transform:scale(1)}}'
            + '.ped-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}'
            + '.ped-card:hover{transform:translateY(-3px)!important;box-shadow:0 12px 28px rgba(0,0,0,0.12)!important}'
            + '.ped-row{transition:all 0.2s ease}'
            + '.ped-row:hover{transform:translateX(4px)!important}'
            + '.ped-section{animation:pedFadeUp 0.5s ease both}'
            + '.ped-badge{transition:all 0.2s ease}'
            + '.ped-badge:hover{transform:scale(1.08)}'
            + '.ped-btn{transition:all 0.2s cubic-bezier(0.4,0,0.2,1)}'
            + '.ped-btn:hover{transform:translateY(-1px)!important;box-shadow:0 4px 12px rgba(0,0,0,0.15)!important}'
            + '#pedFilterSearch::placeholder{color:rgba(255,255,255,0.6)}'
            + '</style>'

            + '<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:20px 36px;margin-bottom:28px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">'
            + '<div style="position:absolute;top:-40px;right:-40px;width:200px;height:200px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="position:absolute;bottom:-60px;left:30%;width:300px;height:200px;background:radial-gradient(circle,rgba(139,92,246,0.15) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">'
            + '<div><h2 style="margin:0;font-size:22px;font-weight:800;color:white;letter-spacing:-0.5px;text-shadow:0 2px 4px rgba(0,0,0,0.2)">Pedidos / Ordenes</h2>'
            + '<p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.7)">Gestion de pedidos y documentos de ventas</p></div>'
            + '<div style="display:flex;align-items:center;gap:12px">'
            + '<div style="position:relative"><svg style="position:absolute;left:12px;top:50%;transform:translateY(-50%);pointer-events:none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
            + '<input type="text" id="pedFilterSearch" placeholder="N Pedido, Cliente..." oninput="App.modules.pedidos.filter()" style="font-size:13px;padding:10px 14px 10px 38px;border:none;border-radius:10px;color:white;background:rgba(255,255,255,0.15);backdrop-filter:blur(8px);outline:none;transition:all 0.2s;width:200px" onfocus="this.style.background=\'rgba(255,255,255,0.25)\'" onblur="this.style.background=\'rgba(255,255,255,0.15)\'"></div>'
            + '<select id="pedFilterEstado" onchange="App.modules.pedidos.filter()" style="font-size:13px;padding:10px 14px;border:none;border-radius:10px;color:white;background:rgba(255,255,255,0.15);backdrop-filter:blur(8px);cursor:pointer;outline:none;transition:all 0.2s" onfocus="this.style.background=\'rgba(255,255,255,0.25)\'" onblur="this.style.background=\'rgba(255,255,255,0.15)\'">'
            + '<option value="" style="color:#1e293b;background:white">Todos</option><option value="pendiente" style="color:#1e293b;background:white">Pendiente</option><option value="aprobado" style="color:#1e293b;background:white">Aprobado</option><option value="rechazado" style="color:#1e293b;background:white">Rechazado</option></select>'
            + (showNew ? '<button onclick="App.modules.pedidos.showUploadModal()" class="ped-btn" style="padding:10px 20px;font-size:13px;font-weight:600;color:#1e40af;background:white;border:none;border-radius:10px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.15)">+ Nuevo Pedido</button>' : '')
            + '</div></div></div>'

            + '<div id="pedStats" style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px"></div>'

            + '<div class="ped-section" style="background:white;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:pedFadeUp 0.5s ease 400ms both">'
            + '<div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:12px">'
            + '<div style="width:36px;height:36px;border-radius:9px;background:linear-gradient(135deg,#eff6ff,#bfdbfe);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(59,130,246,0.15)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></div>'
            + '<div><h3 style="margin:0;font-size:15px;font-weight:700;color:#0f172a">Lista de Pedidos</h3>'
            + '<p style="margin:2px 0 0;font-size:11px;color:#94a3b8">Todos los pedidos registrados en el sistema</p></div></div>'
            + '<div style="overflow:auto;max-height:65vh"><table style="width:100%;border-collapse:collapse;font-size:13px">'
            + '<thead style="position:sticky;top:0;z-index:2"><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">'
            + '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">N Pedido</th>'
            + '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Cliente</th>'
            + '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Tipo OV</th>'
            + '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Vendedor</th>'
            + '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Fecha Subida</th>'
            + '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Estado</th>'
            + '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Revisor</th>'
            + '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Fecha Revision</th>'
            + '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Tiempo</th>'
            + '<th style="padding:11px 14px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Acciones</th>'
            + '</tr></thead><tbody id="pedidosTable">'
            + '<tr><td colspan="10" style="text-align:center;padding:48px;color:#94a3b8"><div style="font-size:14px">Cargando pedidos...</div></td></tr>'
            + '</tbody></table></div></div>'

            + this.uploadModalHtml()
            + this.reviewModalHtml()
            + this.editModalHtml();

        this.setupDragDrop();
        await this.load();
    },

    uploadModalHtml() {
        return '<div id="pedUploadModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(6px);z-index:1000;align-items:center;justify-content:center">'
            + '<div style="background:white;border-radius:16px;width:500px;max-width:95vw;box-shadow:0 24px 64px rgba(0,0,0,0.3);animation:pedFadeUp 0.3s ease both">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;padding:24px 28px;border-bottom:1px solid #e2e8f0">'
            + '<div style="display:flex;align-items:center;gap:12px">'
            + '<div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#eff6ff,#bfdbfe);display:flex;align-items:center;justify-content:center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>'
            + '<h3 style="margin:0;font-size:17px;font-weight:700;color:#0f172a">Nuevo Pedido</h3></div>'
            + '<button onclick="App.modules.pedidos.hideUploadModal()" style="background:none;border:none;font-size:22px;color:#94a3b8;cursor:pointer;padding:4px;line-height:1">&times;</button></div>'
            + '<div style="padding:28px">'
            + '<div style="margin-bottom:20px"><label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Numero de Pedido *</label>'
            + '<input type="text" id="pedNumero" placeholder="Ej: 12345" style="font-size:13px;width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;color:#1e293b;background:white;box-sizing:border-box;outline:none;transition:all 0.2s" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'"></div>'
            + '<div style="margin-bottom:20px"><label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Cliente *</label>'
            + '<input type="text" id="pedCliente" placeholder="Nombre del cliente" style="font-size:13px;width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;color:#1e293b;background:white;box-sizing:border-box;outline:none;transition:all 0.2s" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'"></div>'
            + '<div style="margin-bottom:20px"><label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Tipo de OV *</label>'
            + '<select id="pedTipoOV" style="font-size:13px;width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;color:#1e293b;background:white;box-sizing:border-box;outline:none;transition:all 0.2s" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'">'
            + '<option value="Normal" selected style="background:#e0f2fe;color:#0f172a">Normal</option>'
            + '<option value="Express" style="background:#fef3c7;color:#0f172a;font-weight:700">Express</option>'
            + '<option value="Vta. Region" style="background:#9333ea;color:white">Vta. Region</option>'
            + '<option value="Reposicion" style="background:#dc2626;color:white">Reposición</option>'
            + '</select></div>'
            + '<div><label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">PDF del Pedido *</label>'
            + '<div id="pedUploadArea" onclick="document.getElementById(\'pedFileInput\').click()" style="border:2px dashed #cbd5e1;border-radius:12px;padding:36px;text-align:center;cursor:pointer;transition:all 0.3s;background:#f8fafc">'
            + '<div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#eff6ff,#dbeafe);display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;box-shadow:0 4px 12px rgba(59,130,246,0.15)"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>'
            + '<div style="color:#64748b;font-size:13px;font-weight:500">Arrastra un PDF aqui o haz clic para seleccionar</div>'
            + '<div style="color:#94a3b8;font-size:11px;margin-top:4px">Solo archivos PDF</div>'
            + '<div id="pedUploadFilename" style="display:none;margin-top:14px;padding:8px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;color:#16a34a;font-weight:600;font-size:13px"></div></div>'
            + '<input type="file" id="pedFileInput" accept=".pdf" style="display:none" onchange="App.modules.pedidos.handleFileSelect(event)"></div></div>'
            + '<div style="display:flex;justify-content:flex-end;gap:10px;padding:20px 28px;border-top:1px solid #e2e8f0;background:#f8fafc;border-radius:0 0 16px 16px">'
            + '<button onclick="App.modules.pedidos.hideUploadModal()" class="ped-btn" style="padding:10px 20px;font-size:13px;font-weight:500;color:#64748b;background:white;border:1px solid #e2e8f0;border-radius:10px;cursor:pointer">Cancelar</button>'
            + '<button onclick="App.modules.pedidos.upload()" class="ped-btn" style="padding:10px 24px;font-size:13px;font-weight:600;color:white;background:linear-gradient(135deg,#3b82f6,#2563eb);border:none;border-radius:10px;cursor:pointer;box-shadow:0 4px 12px rgba(59,130,246,0.3)">Subir Pedido</button>'
            + '</div></div></div>';
    },

    reviewModalHtml() {
        return '<div id="pedReviewModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(6px);z-index:1000;align-items:center;justify-content:center">'
            + '<div style="background:white;border-radius:16px;width:620px;max-width:95vw;box-shadow:0 24px 64px rgba(0,0,0,0.3);animation:pedFadeUp 0.3s ease both">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;padding:24px 28px;border-bottom:1px solid #e2e8f0">'
            + '<div style="display:flex;align-items:center;gap:12px">'
            + '<div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#fef3c7,#fde68a);display:flex;align-items:center;justify-content:center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></div>'
            + '<h3 style="margin:0;font-size:17px;font-weight:700;color:#0f172a">Revisar Pedido</h3></div>'
            + '<button onclick="App.modules.pedidos.hideReviewModal()" style="background:none;border:none;font-size:22px;color:#94a3b8;cursor:pointer;padding:4px;line-height:1">&times;</button></div>'
            + '<div style="padding:28px">'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;padding:20px;background:linear-gradient(135deg,#f8fafc,#f1f5f9);border-radius:12px;border:1px solid #e2e8f0">'
            + '<div><span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">N Pedido</span><span id="pedReviewNumero" style="font-weight:700;color:#0f172a;font-family:\'JetBrains Mono\',monospace;font-size:15px"></span></div>'
            + '<div><span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Cliente</span><span id="pedReviewCliente" style="font-weight:700;color:#0f172a;font-size:15px"></span></div>'
            + '<div><span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Vendedor</span><span id="pedReviewVendedor" style="color:#475569;font-size:14px"></span></div>'
            + '<div><span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Fecha Subida</span><span id="pedReviewFecha" style="color:#475569;font-family:\'JetBrains Mono\',monospace;font-size:13px"></span></div></div>'
            + '<div id="pedMotivoGroup" style="display:none;margin-bottom:20px"><label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Motivo de Rechazo *</label>'
            + '<textarea id="pedMotivo" rows="3" placeholder="Indica el motivo del rechazo..." style="font-size:13px;width:100%;padding:12px 14px;border:1px solid #e2e8f0;border-radius:10px;color:#1e293b;background:white;box-sizing:border-box;outline:none;resize:vertical;transition:all 0.2s" onfocus="this.style.borderColor=\'#ef4444\';this.style.boxShadow=\'0 0 0 3px rgba(239,68,68,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'"></textarea></div></div>'
            + '<div style="display:flex;justify-content:flex-end;gap:10px;padding:20px 28px;border-top:1px solid #e2e8f0;background:#f8fafc;border-radius:0 0 16px 16px">'
            + '<button onclick="App.modules.pedidos.hideReviewModal()" class="ped-btn" style="padding:10px 20px;font-size:13px;font-weight:500;color:#64748b;background:white;border:1px solid #e2e8f0;border-radius:10px;cursor:pointer">Cancelar</button>'
            + '<button id="pedBtnRechazar" onclick="App.modules.pedidos.review(\'rechazado\')" class="ped-btn" style="padding:10px 24px;font-size:13px;font-weight:600;color:white;background:linear-gradient(135deg,#ef4444,#dc2626);border:none;border-radius:10px;cursor:pointer;box-shadow:0 4px 12px rgba(239,68,68,0.3)">Rechazar</button>'
            + '<button id="pedBtnAprobar" onclick="App.modules.pedidos.review(\'aprobado\')" class="ped-btn" style="padding:10px 24px;font-size:13px;font-weight:600;color:white;background:linear-gradient(135deg,#22c55e,#16a34a);border:none;border-radius:10px;cursor:pointer;box-shadow:0 4px 12px rgba(34,197,94,0.3)">Aprobar</button>'
            + '</div></div></div>';
    },

    editModalHtml() {
        return '<div id="pedEditModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(6px);z-index:1000;align-items:center;justify-content:center">'
            + '<div style="background:white;border-radius:16px;width:500px;max-width:95vw;box-shadow:0 24px 64px rgba(0,0,0,0.3);animation:pedFadeUp 0.3s ease both">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;padding:24px 28px;border-bottom:1px solid #e2e8f0">'
            + '<div style="display:flex;align-items:center;gap:12px">'
            + '<div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#eff6ff,#bfdbfe);display:flex;align-items:center;justify-content:center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>'
            + '<h3 style="margin:0;font-size:17px;font-weight:700;color:#0f172a">Editar Pedido</h3></div>'
            + '<button onclick="App.modules.pedidos.hideEditModal()" style="background:none;border:none;font-size:22px;color:#94a3b8;cursor:pointer;padding:4px;line-height:1">&times;</button></div>'
            + '<div style="padding:28px">'
            + '<div style="margin-bottom:20px"><label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Numero de Pedido *</label>'
            + '<input type="text" id="pedEditNumero" style="font-size:13px;width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;color:#1e293b;background:white;box-sizing:border-box;outline:none;transition:all 0.2s" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'"></div>'
            + '<div style="margin-bottom:20px"><label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Cliente *</label>'
            + '<input type="text" id="pedEditCliente" style="font-size:13px;width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;color:#1e293b;background:white;box-sizing:border-box;outline:none;transition:all 0.2s" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'"></div>'
            + '<div style="margin-bottom:20px"><label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Tipo de OV</label>'
            + '<select id="pedEditTipoOV" style="font-size:13px;width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;color:#1e293b;background:white;box-sizing:border-box;outline:none">'
            + '<option value="Normal">Normal</option>'
            + '<option value="Express">Express</option>'
            + '<option value="Vta. Region">Vta. Region</option>'
            + '<option value="Reposicion">Reposición</option>'
            + '</select></div></div>'
            + '<div style="display:flex;justify-content:flex-end;gap:10px;padding:20px 28px;border-top:1px solid #e2e8f0;background:#f8fafc;border-radius:0 0 16px 16px">'
            + '<button onclick="App.modules.pedidos.hideEditModal()" class="ped-btn" style="padding:10px 20px;font-size:13px;font-weight:500;color:#64748b;background:white;border:1px solid #e2e8f0;border-radius:10px;cursor:pointer">Cancelar</button>'
            + '<button onclick="App.modules.pedidos.saveEdit()" class="ped-btn" style="padding:10px 24px;font-size:13px;font-weight:600;color:white;background:linear-gradient(135deg,#3b82f6,#2563eb);border:none;border-radius:10px;cursor:pointer;box-shadow:0 4px 12px rgba(59,130,246,0.3)">Guardar</button>'
            + '</div></div></div>';
    },

    async load() {
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const res = await fetch('/api/pedidos', {
                headers: { 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' }
            });
            this.allPedidos = await res.json();
            this.renderStats();
            this.filter();
        } catch(e) {
            console.error('Error loading pedidos:', e);
            document.getElementById('pedidosTable').innerHTML = '<tr><td colspan="10" style="text-align:center;padding:48px;color:#94a3b8">Error al cargar pedidos</td></tr>';
        }
    },

    renderStats() {
        const p = this.allPedidos;
        const total = p.length;
        const pend = p.filter(x => x.estado === 'pendiente').length;
        const apr = p.filter(x => x.estado === 'aprobado').length;
        const rech = p.filter(x => x.estado === 'rechazado').length;
        document.getElementById('pedStats').innerHTML =
            this.statCard(total, 'Total Pedidos', '#64748b', '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>', 0)
            + this.statCard(pend, 'Pendientes', '#f59e0b', '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>', 100)
            + this.statCard(apr, 'Aprobados', '#22c55e', '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>', 200)
            + this.statCard(rech, 'Rechazados', '#ef4444', '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>', 300);
    },

    statCard(value, label, color, icon, delay) {
        return '<div class="ped-card" style="background:white;border:1px solid #e2e8f0;border-radius:14px;padding:22px;border-left:4px solid ' + color + ';box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:pedFadeUp 0.5s ease ' + delay + 'ms both;position:relative;overflow:hidden">'
            + '<div style="position:absolute;top:-20px;right:-20px;width:80px;height:80px;background:' + color + ';opacity:0.04;border-radius:50%"></div>'
            + '<div style="display:flex;align-items:flex-start;gap:16px;position:relative;z-index:1">'
            + '<div style="width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,' + color + '15,' + color + '08);display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid ' + color + '20">' + icon + '</div>'
            + '<div><div style="font-size:30px;font-weight:800;color:#0f172a;font-family:\'JetBrains Mono\',monospace;line-height:1;animation:pedCount 0.6s ease ' + (delay + 200) + 'ms both">' + value + '</div>'
            + '<div style="font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px">' + label + '</div></div></div></div>';
    },

    filter() {
        const search = (document.getElementById('pedFilterSearch')?.value || '').toLowerCase();
        const estado = document.getElementById('pedFilterEstado')?.value || '';
        const filtered = this.allPedidos.filter(p => {
            const matchSearch = !search || (p.numero_pedido || '').toLowerCase().includes(search) || (p.cliente || '').toLowerCase().includes(search) || (p.vendedor || '').toLowerCase().includes(search);
            const matchEstado = !estado || p.estado === estado;
            return matchSearch && matchEstado;
        });
        this.renderTable(filtered);
    },

    renderTable(pedidos) {
        const tbody = document.getElementById('pedidosTable');
        if (!pedidos.length) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:56px 20px">'
                + '<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px;box-shadow:0 4px 12px rgba(0,0,0,0.08)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>'
                + '<div style="font-size:15px;font-weight:600;color:#1e293b;margin-bottom:4px">Sin pedidos</div>'
                + '<div style="color:#94a3b8;font-size:13px">No hay pedidos que mostrar</div></td></tr>';
            return;
        }
        tbody.innerHTML = pedidos.map(p => {
            const badge = this.badgeHtml(p.estado, p.motivo_rechazo);
            return '<tr class="ped-row" style="border-bottom:1px solid #f1f5f9;cursor:pointer" '
                + 'onmouseover="this.style.background=\'#f8fafc\';this.style.transform=\'translateX(4px)\'" '
                + 'onmouseout="this.style.background=\'white\';this.style.transform=\'none\'">'
                + '<td style="padding:12px 14px"><span style="font-weight:700;color:#0f172a;font-family:\'JetBrains Mono\',monospace;font-size:13px;background:#f1f5f9;padding:4px 10px;border-radius:6px">' + escapeHtml(p.numero_pedido) + '</span></td>'
                + '<td style="padding:12px 14px;font-weight:600;color:#0f172a">' + escapeHtml(p.cliente) + '</td>'
                + '<td style="padding:12px 14px">' + this.tipoOvBadge(p.tipo_ov) + '</td>'
                + '<td style="padding:12px 14px;color:#475569">' + escapeHtml(p.vendedor_nombre || p.vendedor) + '</td>'
                + '<td style="padding:12px 14px"><span style="font-size:12px;color:#64748b;font-family:\'JetBrains Mono\',monospace">' + this.fmtDateTime(p.fecha_subida) + '</span></td>'
                + '<td style="padding:12px 14px">' + badge + '</td>'
                + '<td style="padding:12px 14px;color:#475569">' + escapeHtml(p.revisor_nombre || '-') + '</td>'
                + '<td style="padding:12px 14px"><span style="font-size:12px;color:#64748b;font-family:\'JetBrains Mono\',monospace">' + (p.fecha_revision ? this.fmtDateTime(p.fecha_revision) : '<span style="color:#cbd5e1">-</span>') + '</span></td>'
                + '<td style="padding:12px 14px"><span style="font-size:12px;color:#64748b;font-family:\'JetBrains Mono\',monospace">' + this.fmtTiempo(p.fecha_subida, p.fecha_revision) + '</span></td>'
                + '<td style="padding:12px 14px;text-align:center;white-space:nowrap">'
                + (p.estado === 'pendiente' ? '<button onclick="event.stopPropagation();App.modules.pedidos.viewPdf(' + p.id + ')" class="ped-btn" style="background:white;color:#3b82f6;border:1px solid #bfdbfe;padding:6px 10px;border-radius:8px;font-size:12px;cursor:pointer" onmouseover="this.style.background=\'#eff6ff\'" onmouseout="this.style.background=\'white\'"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></button> ' : '')
                + (this.canAuthorize && p.estado === 'pendiente' ? '<button onclick="event.stopPropagation();App.modules.pedidos.showReviewModal(' + p.id + ')" class="ped-btn" style="background:white;color:#f59e0b;border:1px solid #fde68a;padding:6px 10px;border-radius:8px;font-size:12px;cursor:pointer" onmouseover="this.style.background=\'#fef3c7\'" onmouseout="this.style.background=\'white\'"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button> ' : '')
                + (this.canAuthorize ? '<button onclick="event.stopPropagation();App.modules.pedidos.deletePedido(' + p.id + ',\'' + escapeHtml(p.numero_pedido) + '\')" class="ped-btn" style="background:white;color:#dc2626;border:1px solid #fecaca;padding:6px 10px;border-radius:8px;font-size:12px;cursor:pointer" onmouseover="this.style.background=\'#fef2f2\'" onmouseout="this.style.background=\'white\'"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' : '')
                + (this.canAuthorize ? '<button onclick="event.stopPropagation();App.modules.pedidos.showEditModal(' + p.id + ')" class="ped-btn" style="background:white;color:#3b82f6;border:1px solid #bfdbfe;padding:6px 10px;border-radius:8px;font-size:12px;cursor:pointer;margin-left:4px" onmouseover="this.style.background=\'#eff6ff\'" onmouseout="this.style.background=\'white\'"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>' : '')
                + '</td></tr>';
        }).join('');
        this.updatePendingBadge(pedidos);
    },

    badgeHtml(estado, motivo) {
        if (estado === 'aprobado') return '<span class="ped-badge" style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;padding:5px 12px;border-radius:20px;background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>APROBADO</span>';
        if (estado === 'rechazado') return '<span class="ped-badge" onclick="App.modules.pedidos.showMotivoRechazo(\'' + escapeHtml(motivo || '').replace(/'/g, "\\'") + '\')" style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;padding:5px 12px;border-radius:20px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;cursor:pointer" title="Ver motivo de rechazo"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>RECHAZADO</span>';
        return '<span class="ped-badge" style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;padding:5px 12px;border-radius:20px;background:#fefce8;color:#ca8a04;border:1px solid #fde68a"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>PENDIENTE</span>';
    },
    showMotivoRechazo(motivo) {
        if (!motivo) { App.toast('No hay motivo de rechazo registrado'); return; }
        App.toast('Motivo: ' + motivo);
    },
    tipoOvBadge(tipo) {
        const t = tipo || 'Normal';
        if (t === 'Express') return '<span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;background:#fef3c7;color:#0f172a">Express</span>';
        if (t === 'Vta. Region') return '<span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#9333ea;color:white">Vta. Region</span>';
        if (t === 'Reposicion') return '<span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#dc2626;color:white">Reposición</span>';
        return '<span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#e0f2fe;color:#0f172a">Normal</span>';
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

    handleFile(file) {
        if (file && file.type === 'application/pdf') {
            this.selectedFile = file;
            document.getElementById('pedUploadFilename').textContent = file.name;
            document.getElementById('pedUploadFilename').style.display = 'block';
            document.getElementById('pedUploadArea').style.borderColor = '#22c55e';
            document.getElementById('pedUploadArea').style.background = '#f0fdf4';
        } else { alert('Por favor selecciona un archivo PDF'); }
    },

    async upload() {
        const numero = document.getElementById('pedNumero').value.trim();
        const cliente = document.getElementById('pedCliente').value.trim().toUpperCase();
        const tipo_ov = document.getElementById('pedTipoOV').value;
        if (!numero || !cliente) { alert('Numero de pedido y cliente son requeridos'); return; }
        if (!this.selectedFile) { alert('Por favor selecciona un archivo PDF'); return; }
        if (this.uploading) return;
        this.uploading = true;
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const pdfBase64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error('Error al leer archivo'));
                reader.readAsDataURL(this.selectedFile);
            });
            const res = await fetch('/api/pedidos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' },
                body: JSON.stringify({ numero_pedido: numero, cliente: cliente, tipo_ov: tipo_ov, vendedor: user.email || '', pdf_base64: pdfBase64 })
            });
            if (res.ok) { this.hideUploadModal(); this.load(); App.toast('Pedido subido exitosamente'); }
            else { const data = await res.json(); alert(data.error || 'Error al guardar pedido'); }
        } catch(e) { alert('Error al subir pedido: ' + e.message); }
        this.uploading = false;
    },

    showReviewModal(id) {
        this.currentPedido = this.allPedidos.find(p => p.id === id);
        if (!this.currentPedido) return;
        document.getElementById('pedReviewNumero').textContent = this.currentPedido.numero_pedido;
        document.getElementById('pedReviewCliente').textContent = this.currentPedido.cliente;
        document.getElementById('pedReviewVendedor').textContent = this.currentPedido.vendedor_nombre || this.currentPedido.vendedor;
        document.getElementById('pedReviewFecha').textContent = this.fmtDateTime(this.currentPedido.fecha_subida);
        document.getElementById('pedMotivo').value = '';
        document.getElementById('pedMotivoGroup').style.display = 'none';
        document.getElementById('pedBtnRechazar').style.display = '';
        document.getElementById('pedBtnAprobar').style.display = '';
        document.getElementById('pedReviewModal').style.display = 'flex';
    },
    hideReviewModal() { document.getElementById('pedReviewModal').style.display = 'none'; this.currentPedido = null; },

    showEditModal(id) {
        const p = this.allPedidos.find(x => x.id === id);
        if (!p) return;
        this.currentPedido = p;
        document.getElementById('pedEditNumero').value = p.numero_pedido;
        document.getElementById('pedEditCliente').value = p.cliente;
        document.getElementById('pedEditTipoOV').value = p.tipo_ov || 'Normal';
        document.getElementById('pedEditModal').style.display = 'flex';
    },
    hideEditModal() { document.getElementById('pedEditModal').style.display = 'none'; this.currentPedido = null; },
    async saveEdit() {
        if (!this.currentPedido) return;
        const numero = document.getElementById('pedEditNumero').value.trim();
        const cliente = document.getElementById('pedEditCliente').value.trim().toUpperCase();
        const tipo_ov = document.getElementById('pedEditTipoOV').value;
        if (!numero || !cliente) { alert('Numero y cliente son requeridos'); return; }
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const res = await fetch('/api/pedidos/' + this.currentPedido.id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' },
                body: JSON.stringify({ numero_pedido: numero, cliente, tipo_ov })
            });
            if (res.ok) { this.hideEditModal(); this.load(); App.toast('Pedido actualizado'); }
            else { const data = await res.json(); alert(data.error || 'Error al guardar'); }
        } catch(e) { alert('Error al guardar: ' + e.message); }
    },

    async review(estado) {
        if (!this.currentPedido) return;
        if (estado === 'rechazado') {
            document.getElementById('pedMotivoGroup').style.display = 'block';
            if (!document.getElementById('pedMotivo').value.trim()) { alert('Por favor indica el motivo del rechazo'); return; }
        }
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const res = await fetch('/api/pedidos/' + this.currentPedido.id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' },
                body: JSON.stringify({ estado, motivo_rechazo: estado === 'rechazado' ? document.getElementById('pedMotivo').value.trim() : null, revisado_por: user.email || '' })
            });
            if (res.ok) {
                const link = document.createElement('a');
                link.href = '/api/pedidos/' + this.currentPedido.id + '/download-pdf';
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                this.hideReviewModal(); this.load();
                App.toast(estado === 'aprobado' ? 'Pedido aprobado. PDF descargado.' : 'Pedido rechazado. PDF descargado.');
            }
            else { const data = await res.json(); alert(data.error || 'Error al revisar pedido'); }
        } catch(e) { alert('Error al revisar pedido: ' + e.message); }
    },

    viewPdf(id) {
        window.open('/api/pedidos/' + id + '/pdf', '_blank');
    },

    async deletePedido(id, numero) {
        if (!confirm('Eliminar pedido ' + numero + '? Esta accion no se puede deshacer.')) return;
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const res = await fetch('/api/pedidos/' + id, {
                method: 'DELETE',
                headers: { 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' }
            });
            if (res.ok) { this.load(); App.toast('Pedido eliminado'); }
            else { const data = await res.json(); alert(data.error || 'Error al eliminar'); }
        } catch(e) { alert('Error al eliminar: ' + e.message); }
    },

    fmtDate(d) { if (!d) return '-'; return new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }); },
    fmtDateTime(d) { if (!d) return '-'; const f = new Date(d); return f.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + f.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }); },
    fmtTiempo(inicio, fin) {
        if (!inicio || !fin) return '<span style="color:#cbd5e1">-</span>';
        const diff = new Date(fin) - new Date(inicio);
        if (diff < 0) return '-';
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return mins + ' min';
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return h + 'h ' + m + 'min';
    }
});
