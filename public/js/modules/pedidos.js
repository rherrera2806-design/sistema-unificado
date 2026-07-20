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

        el.innerHTML = `
            <div class="page-header">
                <div>
                    <h2>Pedidos</h2>
                    <div class="subtitle">Gestion de pedidos y documentos</div>
                </div>
                ${showNew ? '<button class="btn btn-primary" onclick="App.modules.pedidos.showUploadModal()">+ Nuevo Pedido</button>' : ''}
            </div>

            <div class="stats-grid" style="grid-template-columns: repeat(4, 1fr);">
                <div class="stat-card"><div class="stat-icon blue">📄</div><div class="stat-info"><h4 id="pedStatTotal">0</h4><p>Total Pedidos</p></div></div>
                <div class="stat-card"><div class="stat-icon orange">⏳</div><div class="stat-info"><h4 id="pedStatPendientes">0</h4><p>Pendientes</p></div></div>
                <div class="stat-card"><div class="stat-icon green">✅</div><div class="stat-info"><h4 id="pedStatAprobados">0</h4><p>Aprobados</p></div></div>
                <div class="stat-card"><div class="stat-icon red">❌</div><div class="stat-info"><h4 id="pedStatRechazados">0</h4><p>Rechazados</p></div></div>
            </div>

            <div class="card" style="margin-bottom:16px">
                <div class="card-body" style="padding:16px;display:flex;gap:12px;flex-wrap:wrap;align-items:end">
                    <div class="form-group"><label style="font-size:12px;color:#64748b;font-weight:500">Buscar</label>
                        <input type="text" class="form-control" id="pedFilterSearch" placeholder="N Pedido, Cliente..." oninput="App.modules.pedidos.filter()" style="min-width:200px"></div>
                    <div class="form-group"><label style="font-size:12px;color:#64748b;font-weight:500">Estado</label>
                        <select class="form-control" id="pedFilterEstado" onchange="App.modules.pedidos.filter()">
                            <option value="">Todos</option><option value="pendiente">Pendiente</option>
                            <option value="aprobado">Aprobado</option><option value="rechazado">Rechazado</option>
                        </select></div>
                </div>
            </div>

            <div class="card">
                <div class="card-header"><h3>Lista de Pedidos</h3></div>
                <div class="card-body" style="padding:0">
                    <table><thead><tr>
                        <th>N Pedido</th><th>Cliente</th><th>Vendedor</th><th>Fecha Subida</th><th>Estado</th><th>Fecha Revision</th><th>Acciones</th>
                    </tr></thead><tbody id="pedidosTable">
                        <tr><td colspan="7" style="text-align:center;padding:24px;color:#64748b">Cargando pedidos...</td></tr>
                    </tbody></table>
                </div>
            </div>

            <!-- Upload Modal -->
            <div class="modal-overlay" id="pedUploadModal">
                <div class="modal">
                    <div class="modal-header"><h3>Nuevo Pedido</h3><button class="modal-close" onclick="App.modules.pedidos.hideUploadModal()">&times;</button></div>
                    <div class="modal-body">
                        <div class="form-group" style="margin-bottom:12px"><label style="font-weight:500">Numero de Pedido *</label>
                            <input type="text" class="form-control" id="pedNumero" placeholder="Ej: 12345"></div>
                        <div class="form-group" style="margin-bottom:12px"><label style="font-weight:500">Cliente *</label>
                            <input type="text" class="form-control" id="pedCliente" placeholder="Nombre del cliente"></div>
                        <div class="form-group" style="margin-bottom:12px"><label style="font-weight:500">PDF del Pedido *</label>
                            <div class="upload-area" id="pedUploadArea" onclick="document.getElementById('pedFileInput').click()">
                                <div style="font-size:48px;margin-bottom:12px">📄</div>
                                <div style="color:#64748b">Arrastra un PDF aqui o haz clic para seleccionar</div>
                                <div id="pedUploadFilename" style="display:none;margin-top:12px;color:#1e40af;font-weight:500"></div>
                            </div>
                            <input type="file" id="pedFileInput" accept=".pdf" style="display:none" onchange="App.modules.pedidos.handleFileSelect(event)"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="App.modules.pedidos.hideUploadModal()">Cancelar</button>
                        <button class="btn btn-primary" onclick="App.modules.pedidos.upload()">Subir Pedido</button>
                    </div>
                </div>
            </div>

            <!-- Review Modal -->
            <div class="modal-overlay" id="pedReviewModal">
                <div class="modal" style="max-width:800px">
                    <div class="modal-header"><h3>Revisar Pedido</h3><button class="modal-close" onclick="App.modules.pedidos.hideReviewModal()">&times;</button></div>
                    <div class="modal-body">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
                            <div><strong>N Pedido:</strong> <span id="pedReviewNumero"></span></div>
                            <div><strong>Cliente:</strong> <span id="pedReviewCliente"></span></div>
                            <div><strong>Vendedor:</strong> <span id="pedReviewVendedor"></span></div>
                            <div><strong>Fecha:</strong> <span id="pedReviewFecha"></span></div>
                        </div>
                        <div class="form-group" id="pedMotivoGroup" style="display:none;margin-bottom:12px"><label style="font-weight:500">Motivo de Rechazo</label>
                            <textarea class="form-control" id="pedMotivo" rows="3" placeholder="Indica el motivo del rechazo..."></textarea></div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="App.modules.pedidos.hideReviewModal()">Cancelar</button>
                        <button class="btn btn-danger" id="pedBtnRechazar" onclick="App.modules.pedidos.review('rechazado')">Rechazar</button>
                        <button class="btn btn-success" id="pedBtnAprobar" onclick="App.modules.pedidos.review('aprobado')">Aprobar</button>
                    </div>
                </div>
            </div>

            <!-- View PDF Modal -->
            <div class="modal-overlay" id="pedViewPdfModal">
                <div class="modal" style="max-width:900px">
                    <div class="modal-header"><h3>Ver PDF</h3><button class="modal-close" onclick="App.modules.pedidos.hideViewPdf()">&times;</button></div>
                    <div class="modal-body"><iframe id="pedViewPdfFrame" style="width:100%;height:600px;border:1px solid #e2e8f0;border-radius:8px"></iframe></div>
                </div>
            </div>
        `;

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
            this.updateStats();
            this.filter();
        } catch(e) {
            console.error('Error loading pedidos:', e);
            document.getElementById('pedidosTable').innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#64748b">Error al cargar pedidos</td></tr>';
        }
    },

    updateStats() {
        const p = this.allPedidos;
        document.getElementById('pedStatTotal').textContent = p.length;
        document.getElementById('pedStatPendientes').textContent = p.filter(x => x.estado === 'pendiente').length;
        document.getElementById('pedStatAprobados').textContent = p.filter(x => x.estado === 'aprobado').length;
        document.getElementById('pedStatRechazados').textContent = p.filter(x => x.estado === 'rechazado').length;
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
        if (!pedidos.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:#64748b">No hay pedidos</td></tr>'; return; }
        const isAdmin = this.canAuthorize;
        const estadoBadge = (e) => {
            if (e === 'aprobado') return '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:#dcfce7;color:#166534">✓ APROBADO</span>';
            if (e === 'rechazado') return '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:#fee2e2;color:#991b1b">✗ RECHAZADO</span>';
            return '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:#fef9c3;color:#854d0e">⚡ PENDIENTE</span>';
        };
        tbody.innerHTML = pedidos.map(p => `<tr>
            <td><strong>${escapeHtml(p.numero_pedido)}</strong></td><td>${escapeHtml(p.cliente)}</td><td>${escapeHtml(p.vendedor_nombre || p.vendedor)}</td>
            <td>${this.fmtDateTime(p.fecha_subida)}</td>
            <td>${estadoBadge(p.estado)}</td>
            <td>${escapeHtml(p.revisor_nombre || '-')}</td>
            <td>${p.fecha_revision ? this.fmtDateTime(p.fecha_revision) : '-'}</td>
            <td>
                ${p.estado === 'pendiente' ? `<button class="btn btn-sm btn-outline" onclick="App.modules.pedidos.viewPdf(${p.id})">Ver PDF</button>` : ''}
                ${this.canAuthorize && p.estado === 'pendiente' ? `<button class="btn btn-sm btn-primary" style="margin-left:4px" onclick="App.modules.pedidos.showReviewModal(${p.id})">Revisar</button>` : ''}
                ${isAdmin ? `<button class="btn btn-sm btn-outline" style="margin-left:4px;color:#ef4444;border-color:#ef4444" onclick="App.modules.pedidos.deletePedido(${p.id},'${escapeHtml(p.numero_pedido)}')">Eliminar</button>` : ''}
            </td></tr>`).join('');
        this.updatePendingBadge(pedidos);
    },

    updatePendingBadge(pedidos) {
        const pending = pedidos.filter(p => p.estado === 'pendiente').length;
        App.setSidebarBadge('pedidos', pending);
    },

    showUploadModal() {
        document.getElementById('pedUploadModal').classList.add('show');
        document.getElementById('pedNumero').value = '';
        document.getElementById('pedCliente').value = '';
        document.getElementById('pedUploadFilename').style.display = 'none';
        document.getElementById('pedUploadArea').style.borderColor = '#cbd5e1';
        this.selectedFile = null;
    },
    hideUploadModal() { document.getElementById('pedUploadModal').classList.remove('show'); },

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
        document.getElementById('pedReviewModal').classList.add('show');
    },
    hideReviewModal() { document.getElementById('pedReviewModal').classList.remove('show'); this.currentPedido = null; },

    async review(estado) {
        if (!this.currentPedido) return;
        if (estado === 'rechazado') {
            document.getElementById('pedMotivoGroup').style.display = 'block';
            if (!document.getElementById('pedMotivo').value.trim()) { alert('Por favor indica el motivo del rechazo'); return; }
        }
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const res = await fetch(`/api/pedidos/${this.currentPedido.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' },
                body: JSON.stringify({ estado, motivo_rechazo: estado === 'rechazado' ? document.getElementById('pedMotivo').value.trim() : null, revisado_por: user.email || '' })
            });
            if (res.ok) {
                const link = document.createElement('a');
                link.href = `/api/pedidos/${this.currentPedido.id}/download-pdf`;
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

    viewPdf(id) { window.open(`/api/pedidos/${id}/pdf`, '_blank'); },

    async deletePedido(id, numero) {
        if (!confirm(`Eliminar pedido ${numero}? Esta accion no se puede deshacer.`)) return;
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const res = await fetch(`/api/pedidos/${id}`, {
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
