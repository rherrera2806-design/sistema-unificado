App.registerModule('pedidos', {
    allPedidos: [],
    currentPedido: null,
    selectedFile: null,
    isVendedor: false,
    canAuthorize: false,
    uploading: false,
    _filterTimer: null,
    activeStatFilter: null,

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
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const permisos = user.permisos || [];
        this.isVendedor = permisos.includes('pedidos') && !permisos.includes('pedidos.agregar');
        this.canAuthorize = permisos.includes('pedidos.editar') || permisos.includes('usuarios');
        this.canCreate = permisos.includes('pedidos.agregar') || permisos.includes('usuarios');
        const showNew = this.isVendedor || this.canAuthorize || this.canCreate;

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
                + '.ped-badge{transition:all 0.2s ease}'
                + '.ped-badge:hover{transform:scale(1.08)}'
                + '.ped-btn{transition:all 0.2s cubic-bezier(0.4,0,0.2,1)}'
                + '.ped-btn:hover{transform:translateY(-1px)!important;box-shadow:0 4px 12px rgba(0,0,0,0.15)!important}'
                + '#pedFilterSearch::placeholder{color:rgba(255,255,255,0.6)}'
                + '.ped-th{padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px}'
                + '.ped-td{padding:10px 12px;border-bottom:1px solid #f1f5f9}'
                + '.ped-num{font-weight:700;color:#0f172a;font-size:13px;background:#f1f5f9;padding:4px 10px;border-radius:6px}'
                + '.ped-mono{font-size:12px;color:#64748b}'
                + '.ped-dt{line-height:1.4}'
                + '.ped-dt-sub{font-size:11px;color:#94a3b8;font-weight:400}'
                + '.ped-actions-btn{width:32px;height:32px;border-radius:8px;border:1px solid #e2e8f0;background:white;cursor:pointer;font-size:16px;color:#64748b;display:inline-flex;align-items:center;justify-content:center;transition:all 0.15s}'
                + '.ped-actions-btn:hover{background:#f1f5f9;color:#0f172a;border-color:#cbd5e1}'
                + '.ped-dropdown{display:none;background:white;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);z-index:9999;min-width:140px;padding:4px;overflow:hidden}'
                + '.ped-dropdown.open{display:block}'
                + '.ped-drop-item{padding:8px 12px;font-size:12px;color:#334155;cursor:pointer;border-radius:6px;transition:background 0.1s}'
                + '.ped-drop-item:hover{background:#f1f5f9}'
                + '.ped-drop-danger{color:#dc2626}'
                + '.ped-drop-danger:hover{background:#fef2f2}'
                + '</style>'

                + '<div class="m-page">'
                + '<div class="m-hero" style="padding:10px 14px">'
                + '<div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>'
                + '<div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">'
                + '<div style="flex-shrink:0"><h2 style="margin:0;font-size:15px;font-weight:800;color:white;letter-spacing:-0.5px">Pedidos / Ordenes</h2>'
                + '<p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Gestion de pedidos y documentos de ventas</p></div>'
                + '<div class="m-hero-btns" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0">'
                + '<div style="position:relative;width:180px;flex-shrink:0"><svg style="position:absolute;left:8px;top:50%;transform:translateY(-50%);pointer-events:none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
                + '<input type="text" id="pedFilterSearch" placeholder="Buscar..." oninput="App.modules.pedidos.debouncedFilter()" style="font-size:12px;padding:8px 10px 8px 28px;border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:white;background:rgba(255,255,255,0.1);outline:none;transition:border-color 0.2s;width:100%;box-sizing:border-box" onfocus="this.style.borderColor=\'rgba(255,255,255,0.5)\'" onblur="this.style.borderColor=\'rgba(255,255,255,0.2)\'"></div>'
                + '<select id="pedFilterAnio" onchange="App.modules.pedidos.filter()" style="font-size:12px;padding:8px 10px;border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:white;background:rgba(255,255,255,0.1);cursor:pointer;outline:none;transition:all 0.2s" onfocus="this.style.borderColor=\'rgba(255,255,255,0.5)\'" onblur="this.style.borderColor=\'rgba(255,255,255,0.2)\'">'
                + '<option value="" style="color:#1e293b;background:white">Año</option></select>'
                + '<select id="pedFilterMes" onchange="App.modules.pedidos.filter()" style="font-size:12px;padding:8px 10px;border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:white;background:rgba(255,255,255,0.1);cursor:pointer;outline:none;transition:all 0.2s" onfocus="this.style.borderColor=\'rgba(255,255,255,0.5)\'" onblur="this.style.borderColor=\'rgba(255,255,255,0.2)\'">'
                + '<option value="" style="color:#1e293b;background:white">Mes</option>'
                + '<option value="1" style="color:#1e293b;background:white">Ene</option><option value="2" style="color:#1e293b;background:white">Feb</option><option value="3" style="color:#1e293b;background:white">Mar</option><option value="4" style="color:#1e293b;background:white">Abr</option><option value="5" style="color:#1e293b;background:white">May</option><option value="6" style="color:#1e293b;background:white">Jun</option><option value="7" style="color:#1e293b;background:white">Jul</option><option value="8" style="color:#1e293b;background:white">Ago</option><option value="9" style="color:#1e293b;background:white">Sep</option><option value="10" style="color:#1e293b;background:white">Oct</option><option value="11" style="color:#1e293b;background:white">Nov</option><option value="12" style="color:#1e293b;background:white">Dic</option>'
                + '</select>'
                + (showNew ? '<button onclick="App.modules.pedidos.showUploadModal()" class="btn btn-accent" style="white-space:nowrap;padding:8px 14px;font-size:12px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo</button>' : '')
                + '</div></div></div>'

                + '<div id="pedStats" class="m-stats" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px"></div>'

                + '<div class="m-card">'
                + '<div class="m-card-header" style="padding:8px 14px;display:flex;align-items:center;justify-content:space-between">'
                + '<div style="display:flex;align-items:center;gap:8px">'
                + '<div style="width:28px;height:28px;border-radius:7px;background:linear-gradient(135deg,#eff6ff,#bfdbfe);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>'
                + '<span style="font-size:13px;font-weight:700;color:#0f172a">Pedidos <span id="pedCountLabel" style="color:#94a3b8;font-weight:400;font-size:12px"></span></span></div>'
                + '<div style="display:flex;gap:6px">'
                + '<button onclick="App.modules.pedidos.toggleDashboard()" id="pedBtnDashboard" class="btn btn-accent" style="padding:6px 12px;font-size:11px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> Dashboard</button>'
                + '<button onclick="App.modules.pedidos.toggleGrafico()" id="pedBtnGrafico" class="btn btn-info" style="padding:6px 12px;font-size:11px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> Gráfico</button>'
                + '</div></div>'
                + '<div id="pedDashboardContainer" style="display:none;padding:16px;border-bottom:1px solid #f1f5f9"></div>'
                + '<div id="pedGraficoContainer" style="display:none;padding:16px;border-bottom:1px solid #f1f5f9"></div>'
                + '<div class="m-card-body" style="padding:0">'
                + '<div class="m-table-wrap"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:800px">'
                + '<thead><tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0">'
                + '<th class="ped-th">N Pedido</th>'
                + '<th class="ped-th">Cliente</th>'
                + '<th class="ped-th">Tipo</th>'
                + '<th class="ped-th">Vendedor</th>'
                + '<th class="ped-th">Fecha</th>'
                + '<th class="ped-th">Estado</th>'
                + '<th class="ped-th">Revisor</th>'
                + '<th class="ped-th">Tiempo</th>'
                + '<th class="ped-th" style="text-align:center">Acciones</th>'
                + '</tr></thead><tbody id="pedidosTable">'
                + '<tr><td colspan="9" style="text-align:center;padding:48px;color:#94a3b8">Cargando pedidos...</td></tr>'
                + '</tbody></table></div>'
                + '<div id="pedidosCards" class="m-cards-mobile" style="display:none;padding:8px 12px"></div>'
                + '</div></div>'

                + this.uploadModalHtml()
                + this.reviewModalHtml()
                + this.editModalHtml()
                + '</div>'

                + '<style>'
                + '@media(max-width:768px){'
                + '.m-cards-mobile{display:block!important}'
                + '.m-table-wrap{display:none!important}'
                + '.m-hero-btns{flex-wrap:wrap}'
                + '.m-hero-btns .btn{height:40px;min-height:40px;flex:1}'
                + '.m-stats{grid-template-columns:repeat(2,1fr)!important}'
                + '.m-hero-btns select{padding:8px 10px;font-size:11px}'
                + '}'
                + '</style>';

            this.setupDragDrop();
            document.addEventListener('click', () => this.closeAllDropdowns());
        }
        await this.load();
    },

    uploadModalHtml() {
        return '<div id="pedUploadModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(6px);z-index:1000;align-items:center;justify-content:center">'
            + '<div style="background:white;border-radius:16px;width:500px;max-width:95vw;box-shadow:0 24px 64px rgba(0,0,0,0.3);animation:pedFadeUp 0.3s ease both">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;padding:24px 28px;border-bottom:1px solid #e2e8f0">'
            + '<div style="display:flex;align-items:center;gap:12px">'
            + '<div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#eff6ff,#bfdbfe);display:flex;align-items:center;justify-content:center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>'
            + '<h3 style="margin:0;font-size:17px;font-weight:700;color:#0f172a">Nuevo Pedido</h3></div>'
            + '<button class="modal-close" onclick="App.modules.pedidos.hideUploadModal()"></button></div>'
            + '<div style="padding:28px">'
            + '<div style="margin-bottom:20px"><label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Numero de Pedido *</label>'
            + '<input type="text" id="pedNumero" placeholder="Ej: 12345" style="font-size:13px;width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;color:#1e293b;background:white;box-sizing:border-box;outline:none;transition:all 0.2s" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'"></div>'
            + '<div style="margin-bottom:20px"><label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Cliente *</label>'
            + '<input type="text" id="pedCliente" placeholder="Nombre del cliente" style="font-size:13px;width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;color:#1e293b;background:white;box-sizing:border-box;outline:none;transition:all 0.2s" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'"></div>'
            + '<div style="margin-bottom:20px"><label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Tipo de OV *</label>'
            + '<select id="pedTipoOV" style="font-size:13px;width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;color:#1e293b;background:white;box-sizing:border-box;outline:none;transition:all 0.2s" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'">'
            + '<option value="Normal" selected style="background:#e0f2fe;color:#0f172a">Normal</option>'
            + '<option value="Express" style="background:#fde047;color:#0f172a;font-weight:700">Express</option>'
            + '<option value="Vta. Region" style="background:#9333ea;color:white">Vta. Region</option>'
            + '<option value="Reposicion" style="background:#dc2626;color:white">Reposición</option>'
            + '<option value="Urgencia" style="background:#f97316;color:white;font-weight:700">Urgencia</option>'
            + '</select></div>'
            + '<div><label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">PDF del Pedido *</label>'
            + '<div id="pedUploadArea" onclick="document.getElementById(\'pedFileInput\').click()" style="border:2px dashed #cbd5e1;border-radius:12px;padding:36px;text-align:center;cursor:pointer;transition:all 0.3s;background:#f8fafc">'
            + '<div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#eff6ff,#dbeafe);display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;box-shadow:0 4px 12px rgba(59,130,246,0.15)"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>'
            + '<div style="color:#64748b;font-size:13px;font-weight:500">Arrastra un PDF aqui o haz clic para seleccionar</div>'
            + '<div style="color:#94a3b8;font-size:11px;margin-top:4px">Solo archivos PDF</div>'
            + '<div id="pedUploadFilename" style="display:none;margin-top:14px;padding:8px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;color:#16a34a;font-weight:600;font-size:13px"></div></div>'
            + '<input type="file" id="pedFileInput" accept=".pdf" style="display:none" onchange="App.modules.pedidos.handleFileSelect(event)"></div></div>'
            + '<div style="display:flex;justify-content:flex-end;gap:10px;padding:20px 28px;border-top:1px solid #e2e8f0;background:#f8fafc;border-radius:0 0 16px 16px">'
                + '<button onclick="App.modules.pedidos.hideUploadModal()" class="btn btn-outline">Cancelar</button>'
                + '<button onclick="App.modules.pedidos.upload()" class="btn btn-primary">Subir Pedido</button>'
            + '</div></div></div>';
    },

    reviewModalHtml() {
        return '<div id="pedReviewModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(6px);z-index:1000;align-items:center;justify-content:center">'
            + '<div style="background:white;border-radius:16px;width:620px;max-width:95vw;box-shadow:0 24px 64px rgba(0,0,0,0.3);animation:pedFadeUp 0.3s ease both">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;padding:24px 28px;border-bottom:1px solid #e2e8f0">'
            + '<div style="display:flex;align-items:center;gap:12px">'
            + '<div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#fef3c7,#fde68a);display:flex;align-items:center;justify-content:center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></div>'
            + '<h3 style="margin:0;font-size:17px;font-weight:700;color:#0f172a">Revisar Pedido</h3></div>'
            + '<button class="modal-close" onclick="App.modules.pedidos.hideReviewModal()"></button></div>'
            + '<div style="padding:28px">'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;padding:20px;background:linear-gradient(135deg,#f8fafc,#f1f5f9);border-radius:12px;border:1px solid #e2e8f0">'
            + '<div><span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">N Pedido</span><span id="pedReviewNumero" style="font-weight:700;color:#0f172a;font-family:\'JetBrains Mono\',monospace;font-size:15px"></span></div>'
            + '<div><span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Cliente</span><span id="pedReviewCliente" style="font-weight:700;color:#0f172a;font-size:15px"></span></div>'
            + '<div><span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Vendedor</span><span id="pedReviewVendedor" style="color:#475569;font-size:14px"></span></div>'
            + '<div><span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Fecha Subida</span><span id="pedReviewFecha" style="color:#475569;font-family:\'JetBrains Mono\',monospace;font-size:13px"></span></div></div>'
            + '<div id="pedMotivoGroup" style="display:none;margin-bottom:20px"><label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Motivo de Rechazo *</label>'
            + '<textarea id="pedMotivo" rows="3" placeholder="Indica el motivo del rechazo..." style="font-size:13px;width:100%;padding:12px 14px;border:1px solid #e2e8f0;border-radius:10px;color:#1e293b;background:white;box-sizing:border-box;outline:none;resize:vertical;transition:all 0.2s" onfocus="this.style.borderColor=\'#ef4444\';this.style.boxShadow=\'0 0 0 3px rgba(239,68,68,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'"></textarea></div></div>'
            + '<div style="display:flex;justify-content:flex-end;gap:10px;padding:20px 28px;border-top:1px solid #e2e8f0;background:#f8fafc;border-radius:0 0 16px 16px">'
                + '<button onclick="App.modules.pedidos.hideReviewModal()" class="btn btn-outline">Cancelar</button>'
                + '<button id="pedBtnRechazar" onclick="App.modules.pedidos.review(\'rechazado\')" class="btn btn-danger">Rechazar</button>'
                + '<button id="pedBtnAprobar" onclick="App.modules.pedidos.review(\'aprobado\')" class="btn btn-primary">Aprobar</button>'
            + '</div></div></div>';
    },

    editModalHtml() {
        return '<div id="pedEditModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(6px);z-index:1000;align-items:center;justify-content:center">'
            + '<div style="background:white;border-radius:16px;width:500px;max-width:95vw;box-shadow:0 24px 64px rgba(0,0,0,0.3);animation:pedFadeUp 0.3s ease both">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;padding:24px 28px;border-bottom:1px solid #e2e8f0">'
            + '<div style="display:flex;align-items:center;gap:12px">'
            + '<div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#eff6ff,#bfdbfe);display:flex;align-items:center;justify-content:center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>'
            + '<h3 style="margin:0;font-size:17px;font-weight:700;color:#0f172a">Editar Pedido</h3></div>'
            + '<button class="modal-close" onclick="App.modules.pedidos.hideEditModal()"></button></div>'
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
            + '<option value="Urgencia">Urgencia</option>'
            + '</select></div></div>'
            + '<div style="display:flex;justify-content:flex-end;gap:10px;padding:20px 28px;border-top:1px solid #e2e8f0;background:#f8fafc;border-radius:0 0 16px 16px">'
                + '<button onclick="App.modules.pedidos.hideEditModal()" class="btn btn-outline">Cancelar</button>'
                + '<button onclick="App.modules.pedidos.saveEdit()" class="btn btn-primary">Guardar</button>'
            + '</div></div></div>';
    },

    async load() {
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const res = await fetch('/api/pedidos', {
                headers: { 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '', 'X-User-Area': user.area || '' }
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'HTTP ' + res.status);
            }
            const data = await res.json();
            this.allPedidos = Array.isArray(data) ? data : [];
            const lbl = document.getElementById('pedCountLabel');
            if (lbl) lbl.textContent = '(' + this.allPedidos.length + ')';
            this.renderStats();
            this.populateYears();
            this.filter();
            this.notifyRechazados(user);
        } catch(e) {
            console.error('Error loading pedidos:', e);
            document.getElementById('pedidosTable').innerHTML = '<tr><td colspan="10" style="text-align:center;padding:48px;color:#94a3b8">Error al cargar pedidos: ' + (e.message || '') + '</td></tr>';
        }
    },

    notifyRechazados(user) {
        if (!user.email) return;
        const esAdmin = (user.permisos || []).includes('pedidos.editar');
        if (esAdmin) return;
        const seen = JSON.parse(localStorage.getItem('ped_rechazados_seen') || '[]');
        const rechazados = this.allPedidos.filter(p => p.estado === 'rechazado' && p.vendedor === user.email && !seen.includes(p.id));
        if (rechazados.length === 0) return;
        setTimeout(() => {
            rechazados.forEach((p, i) => {
                setTimeout(() => {
                    App.toast('Pedido ' + p.numero_pedido + ' RECHAZADO — Motivo: ' + (p.motivo_rechazo || 'No especificado'), 'error', 8000);
                }, i * 2000);
            });
            localStorage.setItem('ped_rechazados_seen', JSON.stringify([...seen, ...rechazados.map(p => p.id)]));
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
        document.getElementById('pedStats').innerHTML =
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
            + '<div><div style="font-size:20px;font-weight:800;color:#0f172a;font-family:\'JetBrains Mono\',monospace;line-height:1;animation:pedCount 0.6s ease ' + (delay + 200) + 'ms both">' + value + '</div>'
            + '<div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">' + label + '</div></div></div></div>';
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
        this.filteredPedidos = filtered;
        const lbl = document.getElementById('pedCountLabel');
        if (lbl) lbl.textContent = '(' + filtered.length + ')';
        this.renderTable(filtered);
        const gc = document.getElementById('pedGraficoContainer');
        if (gc && gc.style.display !== 'none') this.renderGrafico();
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
        if (!pedidos.length) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:56px 20px">'
                + '<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px;box-shadow:0 4px 12px rgba(0,0,0,0.08)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>'
                + '<div style="font-size:15px;font-weight:600;color:#1e293b;margin-bottom:4px">Sin pedidos</div>'
                + '<div style="color:#94a3b8;font-size:13px">No hay pedidos que mostrar</div></td></tr>';
            if (cardsEl) cardsEl.innerHTML = '';
            return;
        }
        tbody.innerHTML = pedidos.map(p => {
            const badge = this.badgeHtml(p.estado, p.motivo_rechazo);
            return '<tr class="ped-row" style="cursor:pointer">'
                + '<td class="ped-td"><span class="ped-num">' + escapeHtml(p.numero_pedido) + '</span></td>'
                + '<td class="ped-td" style="font-weight:600;color:#0f172a">' + escapeHtml(p.cliente) + '</td>'
                + '<td class="ped-td">' + this.tipoOvBadge(p.tipo_ov) + '</td>'
                + '<td class="ped-td" style="color:#475569">' + escapeHtml(p.vendedor_nombre || p.vendedor) + '</td>'
                + '<td class="ped-td ped-mono">' + this.fmtDateTime(p.fecha_subida) + '</td>'
                + '<td class="ped-td">' + badge + '</td>'
                + '<td class="ped-td" style="color:#475569">' + escapeHtml(p.revisor_nombre || '-') + '</td>'
                + '<td class="ped-td ped-mono">' + (p.fecha_revision ? this.fmtDateTime(p.fecha_revision) : '<span style="color:#cbd5e1">-</span>') + '</td>'
                + '<td class="ped-td ped-mono">' + this.fmtTiempo(p.fecha_subida, p.fecha_revision) + '</td>'
                + '<td class="ped-td" style="text-align:center;white-space:nowrap;position:relative">'
                + '<button onclick="App.modules.pedidos.toggleActions(event,' + p.id + ')" class="ped-actions-btn">⋮</button>'
                + '<div class="ped-dropdown" id="pedDrop' + p.id + '">'
                + (p.estado === 'pendiente' ? '<div class="ped-drop-item" onclick="event.stopPropagation();App.modules.pedidos.viewPdf(' + p.id + ')">Ver PDF</div>' : '')
                + (this.canAuthorize && p.estado === 'pendiente' ? '<div class="ped-drop-item" onclick="event.stopPropagation();App.modules.pedidos.showReviewModal(' + p.id + ')">Revisar</div>' : '')
                + (this.canAuthorize && p.estado === 'aprobado' ? '<div class="ped-drop-item ped-drop-danger" onclick="event.stopPropagation();App.modules.pedidos.rechazarAprobado(' + p.id + ')">Rechazar</div>' : '')
                + (p.estado !== 'pendiente' ? '<div class="ped-drop-item" onclick="event.stopPropagation();App.modules.pedidos.showHistorial(' + p.id + ')">Historial</div>' : '')
                + (this.canAuthorize ? '<div class="ped-drop-item" onclick="event.stopPropagation();App.modules.pedidos.showEditModal(' + p.id + ')">Editar</div>' : '')
                + (this.canAuthorize ? '<div class="ped-drop-item ped-drop-danger" onclick="event.stopPropagation();App.modules.pedidos.deletePedido(' + p.id + ',\'' + escapeHtml(p.numero_pedido) + '\')">Eliminar</div>' : '')
                + '</div></td></tr>';
        }).join('');

        if (cardsEl && cardsEl.offsetParent !== null) {
            cardsEl.innerHTML = SigmaCards.generate({
                title: p => '<strong>' + escapeHtml(p.numero_pedido) + '</strong>',
                subtitle: p => escapeHtml(p.cliente),
                badge: p => this.badgeHtml(p.estado, p.motivo_rechazo),
                fields: [
                    { label: 'Tipo', value: p => this.tipoOvHtml(p.tipo_ov) },
                    { label: 'Vendedor', value: p => escapeHtml(p.vendedor_nombre || p.vendedor) },
                    { label: 'Fecha', value: p => this.fmtDateTime(p.fecha_subida) },
                    { label: 'Revisor', value: p => escapeHtml(p.revisor_nombre || '-') }
                ],
                actions: p => {
                    let html = '';
                    if (p.estado === 'pendiente') {
                        html += '<button onclick="event.stopPropagation();App.modules.pedidos.viewPdf(' + p.id + ')" class="btn btn-sm btn-info" style="margin-right:4px">PDF</button>';
                    }
                    if (this.canAuthorize && p.estado === 'pendiente') {
                        html += '<button onclick="event.stopPropagation();App.modules.pedidos.showReviewModal(' + p.id + ')" class="btn btn-sm btn-info" style="margin-right:4px">Revisar</button>';
                    }
                    if (this.canAuthorize) {
                        html += '<button onclick="event.stopPropagation();App.modules.pedidos.showEditModal(' + p.id + ')" class="btn btn-sm btn-outline">Editar</button>';
                    }
                    return html;
                }
            }, pedidos);
        }

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
        if (t === 'Express') return '<span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;background:#fde047;color:#0f172a">Express</span>';
        if (t === 'Vta. Region') return '<span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#9333ea;color:white">Vta. Region</span>';
        if (t === 'Reposicion') return '<span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#dc2626;color:white">Reposición</span>';
        if (t === 'Urgencia') return '<span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;background:#f97316;color:white">Urgencia</span>';
        return '<span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#e0f2fe;color:#0f172a">Normal</span>';
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
            const fd = new FormData();
            fd.append('numero_pedido', numero);
            fd.append('cliente', cliente);
            fd.append('tipo_ov', tipo_ov);
            fd.append('vendedor', user.email || '');
            fd.append('archivo_pdf', this.selectedFile);
            const res = await fetch('/api/pedidos', {
                method: 'POST',
                headers: { 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '', 'X-User-Area': user.area || '' },
                body: fd
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
        document.getElementById('pedReviewFecha').innerHTML = this.fmtDateTime(this.currentPedido.fecha_subida);
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
        const goingToPendiente = this.currentPedido.estado === 'aprobado';
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const body = { numero_pedido: numero, cliente, tipo_ov };
            if (goingToPendiente) body.estado = 'pendiente';
            const res = await fetch('/api/pedidos/' + this.currentPedido.id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '', 'X-User-Area': user.area || '' },
                body: JSON.stringify(body)
            });
            if (res.ok) { this.hideEditModal(); this.load(); App.toast(goingToPendiente ? 'Pedido editado, vuelve a pendiente para revisión' : 'Pedido actualizado'); }
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
                headers: { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '', 'X-User-Area': user.area || '' },
                body: JSON.stringify({ estado, motivo_rechazo: estado === 'rechazado' ? document.getElementById('pedMotivo').value.trim() : null, revisado_por: user.email || '' })
            });
            if (res.ok) {
                if (estado === 'aprobado') {
                    const link = document.createElement('a');
                    link.href = '/api/pedidos/' + this.currentPedido.id + '/download-pdf';
                    link.download = '';
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    await fetch('/api/pedidos/' + this.currentPedido.id + '/pdf', { method: 'DELETE' });
                }
                this.hideReviewModal(); this.load();
                App.toast(estado === 'aprobado' ? 'Pedido aprobado. PDF descargado y eliminado.' : 'Pedido rechazado. PDF eliminado.');
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
                headers: { 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '', 'X-User-Area': user.area || '' }
            });
            if (res.ok) { this.load(); App.toast('Pedido eliminado'); }
            else { const data = await res.json(); alert(data.error || 'Error al eliminar'); }
        } catch(e) { alert('Error al eliminar: ' + e.message); }
    },

    async rechazarAprobado(id) {
        const motivo = prompt('Motivo del rechazo del pedido aprobado:');
        if (motivo === null) return;
        if (!motivo.trim()) { alert('Debes indicar un motivo'); return; }
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const res = await fetch('/api/pedidos/' + id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '', 'X-User-Area': user.area || '' },
                body: JSON.stringify({ estado: 'rechazado', motivo_rechazo: motivo.trim(), revisado_por: user.email || '' })
            });
            if (res.ok) { this.load(); App.toast('Pedido rechazado'); }
            else { const data = await res.json(); alert(data.error || 'Error al rechazar'); }
        } catch(e) { alert('Error al rechazar: ' + e.message); }
    },

    async showHistorial(id) {
        try {
            const res = await fetch('/api/pedidos/' + id + '/historial');
            if (!res.ok) { App.toast('Error al cargar historial'); return; }
            const historial = await res.json();
            const ped = this.allPedidos.find(x => x.id === id);
            let html = '<div style="padding:0">';
            if (historial.length === 0) {
                html += '<div style="padding:32px;text-align:center;color:#94a3b8"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" style="margin-bottom:12px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><div style="font-size:13px">Sin cambios registrados</div></div>';
            } else {
                html += '<div style="padding:20px 24px 12px;border-bottom:1px solid #f1f5f9"><div style="font-size:14px;font-weight:600;color:#0f172a">' + escapeHtml(ped ? ped.numero_pedido : '') + '</div><div style="font-size:12px;color:#64748b;margin-top:2px">' + historial.length + ' evento(s)</div></div>';
                html += '<div style="max-height:400px;overflow-y:auto">';
                historial.forEach(h => {
                    const fecha = h.created_at ? new Date(h.created_at).toLocaleString('es-CL') : '-';
                    const iconColor = h.accion === 'Aprobado' ? '#16a34a' : h.accion === 'Rechazado' ? '#dc2626' : h.accion === 'Vuelto a pendiente' ? '#f59e0b' : '#8b5cf6';
                    html += '<div style="padding:16px 24px;border-bottom:1px solid #f8fafc">';
                    html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">';
                    html += '<div style="width:28px;height:28px;border-radius:50%;background:' + iconColor + '15;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="' + iconColor + '" stroke-width="2">';
                    if (h.accion === 'Aprobado') html += '<polyline points="20 6 9 17 4 12"/>';
                    else if (h.accion === 'Rechazado') html += '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>';
                    else if (h.accion === 'Vuelto a pendiente') html += '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>';
                    else html += '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>';
                    html += '</svg></div>';
                    html += '<div><div style="font-size:13px;font-weight:600;color:#0f172a">' + escapeHtml(h.accion) + '</div>';
                    html += '<div style="font-size:11px;color:#94a3b8">' + fecha + (h.usuario ? ' · ' + escapeHtml(h.usuario) : '') + '</div></div></div>';
                    if (h.campos_despues && typeof h.campos_despues === 'object') {
                        html += '<div style="margin-left:38px;font-size:12px;color:#475569">';
                        for (const [campo, vals] of Object.entries(h.campos_despues)) {
                            html += '<div style="margin-top:4px"><span style="color:#64748b">' + escapeHtml(campo) + ':</span> ';
                            if (vals.antes !== undefined && vals.antes !== null) html += '<span style="text-decoration:line-through;color:#dc2626">' + escapeHtml(String(vals.antes)) + '</span> ';
                            html += '<span style="color:#0f172a;font-weight:500">' + escapeHtml(String(vals.despues)) + '</span></div>';
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
                + '<div><div style="font-size:16px;font-weight:700;color:#0f172a">Historial de Cambios</div></div>'
                + '<button onclick="document.getElementById(\'pedHistorialModal\').remove()" style="background:none;border:none;cursor:pointer;padding:4px;color:#94a3b8"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>'
                + '</div>' + html + '</div>';
            document.body.appendChild(overlay);
        } catch(e) { alert('Error al cargar historial: ' + e.message); }
    },

    toggleDashboard() {
        const dc = document.getElementById('pedDashboardContainer');
        const gc = document.getElementById('pedGraficoContainer');
        const tc = document.querySelector('.m-table-wrap');
        const btn = document.getElementById('pedBtnDashboard');
        const btnG = document.getElementById('pedBtnGrafico');
        if (dc.style.display === 'none') {
            dc.style.display = 'block';
            gc.style.display = 'none';
            if (tc) tc.style.display = 'none';
            btn.style.opacity = '1';
            btnG.style.opacity = '0.6';
            this.renderDashboard();
        } else {
            dc.style.display = 'none';
            if (tc) tc.style.display = 'block';
            btn.style.opacity = '0.6';
        }
    },

    renderDashboard() {
        const dc = document.getElementById('pedDashboardContainer');
        if (!dc) return;

        const filterMes = document.getElementById('pedFilterMes')?.value;
        const filterAnio = document.getElementById('pedFilterAnio')?.value;
        const now = new Date();
        const mes = filterMes ? parseInt(filterMes) - 1 : now.getMonth();
        const anio = filterAnio ? parseInt(filterAnio) : now.getFullYear();
        const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

        const pedidosMes = this.allPedidos.filter(p => {
            const f = new Date(p.fecha_subida);
            return f.getMonth() === mes && f.getFullYear() === anio;
        });

        const total = pedidosMes.length;
        const aprobados = pedidosMes.filter(p => p.estado === 'aprobado').length;
        const pendientes = pedidosMes.filter(p => p.estado === 'pendiente').length;
        const rechazados = pedidosMes.filter(p => p.estado === 'rechazado').length;

        const coloresTipo = { Normal: '#3b82f6', Express: '#f59e0b', 'Vta. Region': '#8b5cf6', Reposicion: '#ef4444', Urgencia: '#f97316' };

        // 1. Pedidos por vendedor
        const porVendedor = {};
        pedidosMes.forEach(p => {
            const v = p.vendedor_nombre || p.vendedor || 'Sin vendedor';
            if (!porVendedor[v]) porVendedor[v] = { total: 0, aprobados: 0, pendientes: 0, rechazados: 0 };
            porVendedor[v].total++;
            if (p.estado === 'aprobado') porVendedor[v].aprobados++;
            else if (p.estado === 'pendiente') porVendedor[v].pendientes++;
            else if (p.estado === 'rechazado') porVendedor[v].rechazados++;
        });
        const vendedores = Object.entries(porVendedor).sort((a, b) => b[1].total - a[1].total);
        const maxVen = vendedores.length > 0 ? vendedores[0][1].total : 1;

        // 2. Ranking por tipo
        const porTipo = {};
        pedidosMes.forEach(p => {
            const t = p.tipo_ov || 'Normal';
            porTipo[t] = (porTipo[t] || 0) + 1;
        });
        const tipos = Object.entries(porTipo).sort((a, b) => b[1] - a[1]);
        const maxTipo = tipos.length > 0 ? tipos[0][1] : 1;

        // 3. Ranking de vendedores (top 10)
        const topVendedores = vendedores.slice(0, 10);
        const maxTop = topVendedores.length > 0 ? topVendedores[0][1].total : 1;

        let html = '<div style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">'
            + '<div><h3 style="margin:0;font-size:15px;font-weight:700;color:#0f172a">Dashboard de Pedidos</h3>'
            + '<p style="margin:2px 0 0;font-size:11px;color:#94a3b8">' + monthNames[mes] + ' ' + anio + ' — ' + total + ' pedido(s)</p></div></div>'

            // Resumen
            + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">'
            + '<div style="background:linear-gradient(135deg,#eff6ff,#dbeafe);border-radius:10px;padding:12px;text-align:center"><div style="font-size:22px;font-weight:800;color:#3b82f6">' + total + '</div><div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Total</div></div>'
            + '<div style="background:linear-gradient(135deg,#fefce8,#fef3c7);border-radius:10px;padding:12px;text-align:center"><div style="font-size:22px;font-weight:800;color:#ca8a04">' + pendientes + '</div><div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Pendientes</div></div>'
            + '<div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-radius:10px;padding:12px;text-align:center"><div style="font-size:22px;font-weight:800;color:#16a34a">' + aprobados + '</div><div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Aprobados</div></div>'
            + '<div style="background:linear-gradient(135deg,#fef2f2,#fee2e2);border-radius:10px;padding:12px;text-align:center"><div style="font-size:22px;font-weight:800;color:#dc2626">' + rechazados + '</div><div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Rechazados</div></div>'
            + '</div>'

            // Pedidos por vendedor + Ranking por tipo (2 columnas)
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">'

            // Pedidos por vendedor
            + '<div style="background:white;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">'
            + '<div style="padding:10px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:700;color:#0f172a;display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg> Pedidos por Vendedor</div>'
            + '<div style="padding:12px;max-height:300px;overflow-y:auto">';
        if (vendedores.length === 0) {
            html += '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px">Sin pedidos este mes</div>';
        } else {
            vendedores.forEach(([nombre, data], i) => {
                const pct = Math.round((data.total / maxVen) * 100);
                html += '<div style="margin-bottom:10px">'
                    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">'
                    + '<span style="font-size:11px;font-weight:600;color:#0f172a">' + (i + 1) + '. ' + escapeHtml(nombre) + '</span>'
                    + '<span style="font-size:11px;font-weight:700;color:#3b82f6">' + data.total + '</span></div>'
                    + '<div style="height:8px;background:#f1f5f9;border-radius:4px;overflow:hidden;display:flex">'
                    + '<div style="width:' + Math.round((data.aprobados / data.total) * pct) + '%;background:#22c55e;height:100%"></div>'
                    + '<div style="width:' + Math.round((data.pendientes / data.total) * pct) + '%;background:#f59e0b;height:100%"></div>'
                    + '<div style="width:' + Math.round((data.rechazados / data.total) * pct) + '%;background:#ef4444;height:100%"></div>'
                    + '</div>'
                    + '<div style="display:flex;gap:8px;margin-top:2px;font-size:9px;color:#94a3b8">'
                    + '<span style="color:#22c55e">●' + data.aprobados + '</span>'
                    + '<span style="color:#f59e0b">●' + data.pendientes + '</span>'
                    + '<span style="color:#ef4444">●' + data.rechazados + '</span></div>'
                    + '</div>';
            });
        }
        html += '</div></div>'

            // Ranking por tipo
            + '<div style="background:white;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">'
            + '<div style="padding:10px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:700;color:#0f172a;display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Ranking por Tipo</div>'
            + '<div style="padding:14px">';
        if (tipos.length === 0) {
            html += '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px">Sin pedidos este mes</div>';
        } else {
            tipos.forEach(([tipo, count], i) => {
                const pct = Math.round((count / maxTipo) * 100);
                const color = coloresTipo[tipo] || '#64748b';
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
                html += '<div style="margin-bottom:12px">'
                    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'
                    + '<span style="font-size:12px;font-weight:600;color:#0f172a">' + medal + ' ' + tipo + '</span>'
                    + '<span style="font-size:12px;font-weight:700;color:' + color + '">' + count + ' <span style="font-weight:400;color:#94a3b8;font-size:10px">(' + Math.round((count / total) * 100) + '%)</span></span></div>'
                    + '<div style="height:10px;background:#f1f5f9;border-radius:5px;overflow:hidden">'
                    + '<div style="width:' + pct + '%;background:' + color + ';height:100%;border-radius:5px;transition:width 0.5s ease"></div></div></div>';
            });
        }
        html += '</div></div></div>'

            // Ranking de vendedores (top 10) - tabla horizontal
            + '<div style="background:white;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">'
            + '<div style="padding:10px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:700;color:#0f172a;display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg> Top Vendedores — ' + monthNames[mes] + '</div>'
            + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">'
            + '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:#64748b">#</th>'
            + '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:#64748b">Vendedor</th>'
            + '<th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:#64748b">Total</th>'
            + '<th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:#64748b">Aprobados</th>'
            + '<th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:#64748b">Pendientes</th>'
            + '<th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:#64748b">Rechazados</th>'
            + '<th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:#64748b">% Aprob.</th>'
            + '<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:#64748b;min-width:120px">Distribución</th>'
            + '</tr></thead><tbody>';
        topVendedores.forEach(([nombre, data], i) => {
            const pctAprob = data.total > 0 ? Math.round((data.aprobados / data.total) * 100) : 0;
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
            html += '<tr style="border-bottom:1px solid #f1f5f9">'
                + '<td style="padding:8px 12px;font-weight:700;color:' + (i < 3 ? '#f59e0b' : '#64748b') + '">' + medal + '</td>'
                + '<td style="padding:8px 12px;font-weight:600;color:#0f172a">' + escapeHtml(nombre) + '</td>'
                + '<td style="padding:8px 12px;text-align:center;font-weight:700;color:#3b82f6">' + data.total + '</td>'
                + '<td style="padding:8px 12px;text-align:center;color:#22c55e">' + data.aprobados + '</td>'
                + '<td style="padding:8px 12px;text-align:center;color:#f59e0b">' + data.pendientes + '</td>'
                + '<td style="padding:8px 12px;text-align:center;color:#ef4444">' + data.rechazados + '</td>'
                + '<td style="padding:8px 12px;text-align:center;font-weight:600;color:' + (pctAprob >= 80 ? '#22c55e' : pctAprob >= 50 ? '#f59e0b' : '#ef4444') + '">' + pctAprob + '%</td>'
                + '<td style="padding:8px 12px"><div style="display:flex;height:8px;border-radius:4px;overflow:hidden;background:#f1f5f9">'
                + '<div style="width:' + Math.round((data.aprobados / data.total) * 100) + '%;background:#22c55e"></div>'
                + '<div style="width:' + Math.round((data.pendientes / data.total) * 100) + '%;background:#f59e0b"></div>'
                + '<div style="width:' + Math.round((data.rechazados / data.total) * 100) + '%;background:#ef4444"></div>'
                + '</div></td></tr>';
        });
        html += '</tbody></table></div></div>';

        dc.innerHTML = html;
    },

    toggleGrafico() {
        const gc = document.getElementById('pedGraficoContainer');
        const dc = document.getElementById('pedDashboardContainer');
        const tc = document.querySelector('.m-table-wrap');
        const btn = document.getElementById('pedBtnGrafico');
        const btnD = document.getElementById('pedBtnDashboard');
        if (gc.style.display === 'none') {
            gc.style.display = 'block';
            dc.style.display = 'none';
            if (tc) tc.style.display = 'none';
            btn.style.opacity = '1';
            btnD.style.opacity = '0.6';
            this.renderGrafico();
        } else {
            gc.style.display = 'none';
            if (tc) tc.style.display = 'block';
            btn.style.opacity = '0.6';
        }
    },

    renderGrafico() {
        const gc = document.getElementById('pedGraficoContainer');
        const filterMes = document.getElementById('pedFilterMes')?.value;
        const filterAnio = document.getElementById('pedFilterAnio')?.value;
        const now = new Date();
        const mes = filterMes ? parseInt(filterMes) - 1 : now.getMonth();
        const anio = filterAnio ? parseInt(filterAnio) : now.getFullYear();
        const diasEnMes = new Date(anio, mes + 1, 0).getDate();
        const colores = { Normal: '#3b82f6', Express: '#fde047', 'Vta. Region': '#9333ea', Reposicion: '#dc2626', Urgencia: '#f97316' };
        const tipos = ['Normal', 'Express', 'Vta. Region', 'Reposicion', 'Urgencia'];

        const source = this.filteredPedidos || this.allPedidos;
        const pedidosMes = source.filter(p => {
            const f = new Date(p.fecha_subida);
            return f.getMonth() === mes && f.getFullYear() === anio && p.estado !== 'rechazado';
        });

        const porDia = {};
        for (let d = 1; d <= diasEnMes; d++) {
            porDia[d] = {};
            tipos.forEach(t => porDia[d][t] = 0);
        }
        pedidosMes.forEach(p => {
            const dia = new Date(p.fecha_subida).getDate();
            const tipo = p.tipo_ov || 'Normal';
            if (porDia[dia] && porDia[dia][tipo] !== undefined) porDia[dia][tipo]++;
        });

        const maxVal = Math.max(1, ...Object.values(porDia).flatMap(d => Object.values(d)));
        const barH = 450;

        const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

        let legendHtml = '<div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap">';
        tipos.forEach(t => {
            const count = pedidosMes.filter(p => (p.tipo_ov || 'Normal') === t).length;
            legendHtml += '<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#64748b"><div style="width:12px;height:12px;border-radius:3px;background:' + colores[t] + '"></div>' + t + ' (' + count + ')</div>';
        });
        legendHtml += '</div>';

        let barsHtml = '';
        for (let d = 1; d <= diasEnMes; d++) {
            const total = tipos.reduce((s, t) => s + porDia[d][t], 0);
            let segmentsHtml = '';
            if (total > 0) {
                let stack = '';
                for (let i = tipos.length - 1; i >= 0; i--) {
                    const t = tipos[i];
                    const val = porDia[d][t];
                    if (val > 0) {
                        const h = Math.max((val / maxVal) * barH, 4);
                        stack += '<div style="width:100%;height:' + h + 'px;background:' + colores[t] + ';display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:white;text-shadow:0 1px 2px rgba(0,0,0,0.3)" title="Dia ' + d + ' - ' + t + ': ' + val + '">' + val + '</div>';
                    }
                }
                segmentsHtml = '<div style="display:flex;flex-direction:column-reverse;width:100%;height:' + barH + 'px;justify-content:flex-start">' + stack + '</div>';
            }
            barsHtml += '<td style="width:' + (100 / diasEnMes) + '%;vertical-align:bottom;padding:0 1px">' + (total > 0 ? '<div style="text-align:center;font-size:11px;font-weight:800;color:#0f172a;margin-bottom:2px">' + total + '</div>' : '') + segmentsHtml + '</td>';
        }

        let labelsHtml = '';
        for (let d = 1; d <= diasEnMes; d++) {
            labelsHtml += '<td style="width:' + (100 / diasEnMes) + '%;text-align:center;font-size:9px;color:#94a3b8;padding:4px 1px">' + d + '</td>';
        }

        gc.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
            + '<div><h4 style="margin:0;font-size:14px;font-weight:700;color:#0f172a">Ingresos por Dia - ' + monthNames[mes] + ' ' + anio + '</h4>'
            + '<p style="margin:2px 0 0;font-size:11px;color:#94a3b8">Total: ' + pedidosMes.length + ' pedidos</p></div></div>'
            + legendHtml
            + '<table style="width:100%;border-collapse:collapse"><tr style="height:' + barH + 'px">' + barsHtml + '</tr><tr>' + labelsHtml + '</tr></table>';
    },

    fmtDate(d) { if (!d) return '-'; return new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }); },
    fmtDateTime(d) { if (!d) return '-'; const f = new Date(d); return '<div class="ped-dt">' + f.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }) + '</div><div class="ped-dt-sub">' + f.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) + '</div>'; },
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
