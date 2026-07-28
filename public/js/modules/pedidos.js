App.registerModule('pedidos', {
    allPedidos: [],
    currentPedido: null,
    selectedFile: null,
    isVendedor: false,
    canAuthorize: false,

    async render() {
        const el = document.getElementById('page-pedidos');
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const permisos = user.permisos || [];
        this.isVendedor = permisos.includes('pedidos') && !permisos.includes('pedidos.autorizar');
        this.canAuthorize = permisos.includes('pedidos.autorizar') || permisos.includes('usuarios');
        const showNew = this.isVendedor || this.canAuthorize;

        el.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">'
            + '<div><h2 style="margin:0;font-size:22px;font-weight:700;color:#1e293b">Pedidos</h2>'
            + '<p style="margin:4px 0 0;font-size:13px;color:#64748b">Gestion de pedidos y documentos</p></div>'
            + (showNew ? '<button onclick="App.modules.pedidos.showUploadModal()" style="padding:10px 20px;font-size:13px;font-weight:600;color:white;background:#3b82f6;border:none;border-radius:8px;cursor:pointer;transition:background 0.15s" onmouseover="this.style.background=\'#2563eb\'" onmouseout="this.style.background=\'#3b82f6\'">+ Nuevo Pedido</button>' : '')
            + '</div>'
            + '<div id="pedStats" style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px"></div>'
            + '<div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:20px 24px;margin-bottom:16px">'
            + '<div style="display:flex;gap:12px;align-items:end;flex-wrap:wrap">'
            + '<div><label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Buscar</label>'
            + '<input type="text" id="pedFilterSearch" placeholder="N Pedido, Cliente..." oninput="App.modules.pedidos.filter()" style="font-size:13px;padding:8px 14px;border:1px solid #e2e8f0;border-radius:8px;color:#1e293b;background:white;width:220px;box-sizing:border-box;outline:none;transition:border 0.15s" onfocus="this.style.borderColor=\'#3b82f6\'" onblur="this.style.borderColor=\'#e2e8f0\'"></div>'
            + '<div><label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Estado</label>'
            + '<select id="pedFilterEstado" onchange="App.modules.pedidos.filter()" style="font-size:13px;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;color:#1e293b;background:white;cursor:pointer;outline:none">'
            + '<option value="">Todos</option><option value="pendiente">Pendiente</option><option value="aprobado">Aprobado</option><option value="rechazado">Rechazado</option></select></div>'
            + '</div></div>'
            + '<div style="background:white;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">'
            + '<div style="padding:20px 24px;border-bottom:1px solid #e2e8f0"><h3 style="margin:0;font-size:15px;font-weight:700;color:#1e293b">Lista de Pedidos</h3></div>'
            + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">'
            + '<thead><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">'
            + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">N Pedido</th>'
            + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Cliente</th>'
            + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Vendedor</th>'
            + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Fecha Subida</th>'
            + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Estado</th>'
            + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Revisor</th>'
            + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Fecha Revision</th>'
            + '<th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Acciones</th>'
            + '</tr></thead><tbody id="pedidosTable">'
            + '<tr><td colspan="8" style="text-align:center;padding:40px;color:#94a3b8">Cargando pedidos...</td></tr>'
            + '</tbody></table></div></div>'

            + '<div id="pedUploadModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);backdrop-filter:blur(4px);z-index:1000;align-items:center;justify-content:center">'
            + '<div style="background:white;border-radius:12px;width:480px;max-width:95vw;box-shadow:0 20px 60px rgba(0,0,0,0.2)">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;padding:20px 24px;border-bottom:1px solid #e2e8f0">'
            + '<h3 style="margin:0;font-size:16px;font-weight:700;color:#1e293b">Nuevo Pedido</h3>'
            + '<button onclick="App.modules.pedidos.hideUploadModal()" style="background:none;border:none;font-size:20px;color:#94a3b8;cursor:pointer;padding:4px">&times;</button></div>'
            + '<div style="padding:24px">'
            + '<div style="margin-bottom:16px"><label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Numero de Pedido *</label>'
            + '<input type="text" id="pedNumero" placeholder="Ej: 12345" style="font-size:13px;width:100%;padding:8px 14px;border:1px solid #e2e8f0;border-radius:8px;color:#1e293b;background:white;box-sizing:border-box;outline:none"></div>'
            + '<div style="margin-bottom:16px"><label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Cliente *</label>'
            + '<input type="text" id="pedCliente" placeholder="Nombre del cliente" style="font-size:13px;width:100%;padding:8px 14px;border:1px solid #e2e8f0;border-radius:8px;color:#1e293b;background:white;box-sizing:border-box;outline:none"></div>'
            + '<div><label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">PDF del Pedido *</label>'
            + '<div id="pedUploadArea" onclick="document.getElementById(\'pedFileInput\').click()" style="border:2px dashed #cbd5e1;border-radius:8px;padding:32px;text-align:center;cursor:pointer;transition:all 0.15s">'
            + '<div style="font-size:36px;margin-bottom:8px;color:#94a3b8">&#128196;</div>'
            + '<div style="color:#64748b;font-size:13px">Arrastra un PDF aqui o haz clic para seleccionar</div>'
            + '<div id="pedUploadFilename" style="display:none;margin-top:12px;color:#2563eb;font-weight:600;font-size:13px"></div></div>'
            + '<input type="file" id="pedFileInput" accept=".pdf" style="display:none" onchange="App.modules.pedidos.handleFileSelect(event)"></div></div>'
            + '<div style="display:flex;justify-content:flex-end;gap:8px;padding:16px 24px;border-top:1px solid #e2e8f0">'
            + '<button onclick="App.modules.pedidos.hideUploadModal()" style="padding:8px 16px;font-size:13px;font-weight:500;color:#64748b;background:white;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer">Cancelar</button>'
            + '<button onclick="App.modules.pedidos.upload()" style="padding:8px 16px;font-size:13px;font-weight:600;color:white;background:#3b82f6;border:none;border-radius:8px;cursor:pointer;transition:background 0.15s" onmouseover="this.style.background=\'#2563eb\'" onmouseout="this.style.background=\'#3b82f6\'">Subir Pedido</button>'
            + '</div></div></div>'

            + '<div id="pedReviewModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);backdrop-filter:blur(4px);z-index:1000;align-items:center;justify-content:center">'
            + '<div style="background:white;border-radius:12px;width:600px;max-width:95vw;box-shadow:0 20px 60px rgba(0,0,0,0.2)">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;padding:20px 24px;border-bottom:1px solid #e2e8f0">'
            + '<h3 style="margin:0;font-size:16px;font-weight:700;color:#1e293b">Revisar Pedido</h3>'
            + '<button onclick="App.modules.pedidos.hideReviewModal()" style="background:none;border:none;font-size:20px;color:#94a3b8;cursor:pointer;padding:4px">&times;</button></div>'
            + '<div style="padding:24px">'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0">'
            + '<div><span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:2px">N Pedido</span><span id="pedReviewNumero" style="font-weight:700;color:#1e293b;font-family:\'JetBrains Mono\',monospace"></span></div>'
            + '<div><span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:2px">Cliente</span><span id="pedReviewCliente" style="font-weight:700;color:#1e293b"></span></div>'
            + '<div><span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:2px">Vendedor</span><span id="pedReviewVendedor" style="color:#475569"></span></div>'
            + '<div><span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:2px">Fecha Subida</span><span id="pedReviewFecha" style="color:#475569;font-family:\'JetBrains Mono\',monospace;font-size:12px"></span></div></div>'
            + '<div id="pedMotivoGroup" style="display:none;margin-bottom:16px"><label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Motivo de Rechazo</label>'
            + '<textarea id="pedMotivo" rows="3" placeholder="Indica el motivo del rechazo..." style="font-size:13px;width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:8px;color:#1e293b;background:white;box-sizing:border-box;outline:none;resize:vertical"></textarea></div></div>'
            + '<div style="display:flex;justify-content:flex-end;gap:8px;padding:16px 24px;border-top:1px solid #e2e8f0">'
            + '<button onclick="App.modules.pedidos.hideReviewModal()" style="padding:8px 16px;font-size:13px;font-weight:500;color:#64748b;background:white;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer">Cancelar</button>'
            + '<button id="pedBtnRechazar" onclick="App.modules.pedidos.review(\'rechazado\')" style="padding:8px 16px;font-size:13px;font-weight:600;color:white;background:#ef4444;border:none;border-radius:8px;cursor:pointer;transition:background 0.15s" onmouseover="this.style.background=\'#dc2626\'" onmouseout="this.style.background=\'#ef4444\'">Rechazar</button>'
            + '<button id="pedBtnAprobar" onclick="App.modules.pedidos.review(\'aprobado\')" style="padding:8px 16px;font-size:13px;font-weight:600;color:white;background:#22c55e;border:none;border-radius:8px;cursor:pointer;transition:background 0.15s" onmouseover="this.style.background=\'#16a34a\'" onmouseout="this.style.background=\'#22c55e\'">Aprobar</button>'
            + '</div></div></div>'

            + '<div id="pedViewPdfModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);backdrop-filter:blur(4px);z-index:1000;align-items:center;justify-content:center">'
            + '<div style="background:white;border-radius:12px;width:900px;max-width:95vw;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.2)">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;padding:20px 24px;border-bottom:1px solid #e2e8f0;flex-shrink:0">'
            + '<h3 style="margin:0;font-size:16px;font-weight:700;color:#1e293b">Ver PDF</h3>'
            + '<button onclick="App.modules.pedidos.hideViewPdf()" style="background:none;border:none;font-size:20px;color:#94a3b8;cursor:pointer;padding:4px">&times;</button></div>'
            + '<div style="padding:24px;flex:1;overflow:auto"><iframe id="pedViewPdfFrame" style="width:100%;height:600px;border:1px solid #e2e8f0;border-radius:8px"></iframe></div></div></div>';

        this.setupDragDrop();
        await this.load();
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
            document.getElementById('pedidosTable').innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:#94a3b8">Error al cargar pedidos</td></tr>';
        }
    },

    renderStats() {
        const p = this.allPedidos;
        const total = p.length;
        const pend = p.filter(x => x.estado === 'pendiente').length;
        const apr = p.filter(x => x.estado === 'aprobado').length;
        const rech = p.filter(x => x.estado === 'rechazado').length;
        document.getElementById('pedStats').innerHTML =
            '<div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:20px;border-left:4px solid #64748b">'
            + '<div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Total Pedidos</div>'
            + '<div style="font-size:28px;font-weight:800;color:#1e293b;font-family:\'JetBrains Mono\',monospace">' + total + '</div></div>'
            + '<div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:20px;border-left:4px solid #f59e0b">'
            + '<div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Pendientes</div>'
            + '<div style="font-size:28px;font-weight:800;color:#f59e0b;font-family:\'JetBrains Mono\',monospace">' + pend + '</div></div>'
            + '<div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:20px;border-left:4px solid #22c55e">'
            + '<div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Aprobados</div>'
            + '<div style="font-size:28px;font-weight:800;color:#22c55e;font-family:\'JetBrains Mono\',monospace">' + apr + '</div></div>'
            + '<div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:20px;border-left:4px solid #ef4444">'
            + '<div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Rechazados</div>'
            + '<div style="font-size:28px;font-weight:800;color:#ef4444;font-family:\'JetBrains Mono\',monospace">' + rech + '</div></div>';
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
        if (!pedidos.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:#94a3b8">No hay pedidos que mostrar</td></tr>'; return; }
        const isAdmin = this.canAuthorize;
        tbody.innerHTML = pedidos.map(p => {
            const badge = this.badgeHtml(p.estado);
            return '<tr style="border-bottom:1px solid #f1f5f9;transition:background 0.1s" onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'white\'">'
                + '<td style="padding:10px 14px;font-weight:600;color:#1e293b;font-family:\'JetBrains Mono\',monospace;font-size:12px">' + escapeHtml(p.numero_pedido) + '</td>'
                + '<td style="padding:10px 14px;font-weight:600;color:#1e293b">' + escapeHtml(p.cliente) + '</td>'
                + '<td style="padding:10px 14px;color:#475569">' + escapeHtml(p.vendedor_nombre || p.vendedor) + '</td>'
                + '<td style="padding:10px 14px;font-size:12px;color:#64748b;font-family:\'JetBrains Mono\',monospace">' + this.fmtDateTime(p.fecha_subida) + '</td>'
                + '<td style="padding:10px 14px">' + badge + '</td>'
                + '<td style="padding:10px 14px;color:#475569">' + escapeHtml(p.revisor_nombre || '-') + '</td>'
                + '<td style="padding:10px 14px;font-size:12px;color:#64748b;font-family:\'JetBrains Mono\',monospace">' + (p.fecha_revision ? this.fmtDateTime(p.fecha_revision) : '<span style="color:#cbd5e1">-</span>') + '</td>'
                + '<td style="padding:10px 14px;text-align:center;white-space:nowrap">'
                + (p.estado === 'pendiente' ? '<button onclick="App.modules.pedidos.viewPdf(' + p.id + ')" style="background:white;color:#3b82f6;border:1px solid #bfdbfe;padding:5px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.15s" onmouseover="this.style.background=\'#eff6ff\'" onmouseout="this.style.background=\'white\'">Ver PDF</button> ' : '')
                + (this.canAuthorize && p.estado === 'pendiente' ? '<button onclick="App.modules.pedidos.showReviewModal(' + p.id + ')" style="background:#3b82f6;color:white;border:none;padding:5px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;transition:background 0.15s" onmouseover="this.style.background=\'#2563eb\'" onmouseout="this.style.background=\'#3b82f6\'">Revisar</button> ' : '')
                + (isAdmin ? '<button onclick="App.modules.pedidos.deletePedido(' + p.id + ',\'' + escapeHtml(p.numero_pedido) + '\')" style="background:white;color:#dc2626;border:1px solid #fecaca;padding:5px 10px;border-radius:6px;font-size:12px;cursor:pointer;transition:all 0.15s" onmouseover="this.style.background=\'#fef2f2\'" onmouseout="this.style.background=\'white\'">&#10005;</button>' : '')
                + '</td></tr>';
        }).join('');
        this.updatePendingBadge(pedidos);
    },

    badgeHtml(estado) {
        if (estado === 'aprobado') return '<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0">&#10003; APROBADO</span>';
        if (estado === 'rechazado') return '<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca">&#10005; RECHAZADO</span>';
        return '<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;background:#fefce8;color:#ca8a04;border:1px solid #fde68a">&#9201; PENDIENTE</span>';
    },

    updatePendingBadge(pedidos) {
        const pending = pedidos.filter(p => p.estado === 'pendiente').length;
        App.setSidebarBadge('pedidos', pending);
    },

    showUploadModal() {
        document.getElementById('pedUploadModal').style.display = 'flex';
        document.getElementById('pedNumero').value = '';
        document.getElementById('pedCliente').value = '';
        document.getElementById('pedUploadFilename').style.display = 'none';
        document.getElementById('pedUploadArea').style.borderColor = '#cbd5e1';
        document.getElementById('pedUploadArea').style.background = '';
        this.selectedFile = null;
    },
    hideUploadModal() { document.getElementById('pedUploadModal').style.display = 'none'; },

    setupDragDrop() {
        const area = document.getElementById('pedUploadArea');
        if (!area) return;
        area.addEventListener('dragover', e => { e.preventDefault(); area.style.borderColor = '#3b82f6'; area.style.background = '#eff6ff'; });
        area.addEventListener('dragleave', () => { area.style.borderColor = '#cbd5e1'; area.style.background = ''; });
        area.addEventListener('drop', e => { e.preventDefault(); area.style.borderColor = '#cbd5e1'; area.style.background = ''; if (e.dataTransfer.files.length) this.handleFile(e.dataTransfer.files[0]); });
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
        const cliente = document.getElementById('pedCliente').value.trim().replace(/\b\w/g, c => c.toUpperCase());
        if (!numero || !cliente) { alert('Numero de pedido y cliente son requeridos'); return; }
        if (!this.selectedFile) { alert('Por favor selecciona un archivo PDF'); return; }

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
                body: JSON.stringify({ numero_pedido: numero, cliente: cliente, vendedor: user.email || '', pdf_base64: pdfBase64 })
            });

            if (res.ok) { this.hideUploadModal(); this.load(); App.toast('Pedido subido exitosamente'); }
            else { const data = await res.json(); alert(data.error || 'Error al guardar pedido'); }
        } catch(e) { alert('Error al subir pedido: ' + e.message); }
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
        document.getElementById('pedViewPdfFrame').src = '/api/pedidos/' + id + '/pdf';
        document.getElementById('pedViewPdfModal').style.display = 'flex';
    },
    hideViewPdf() {
        document.getElementById('pedViewPdfFrame').src = '';
        document.getElementById('pedViewPdfModal').style.display = 'none';
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
    fmtDateTime(d) { if (!d) return '-'; const f = new Date(d); return f.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + f.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }); }
});
