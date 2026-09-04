App.registerModule('bodega', {
    _vista: 'listos',
    _carros: [],
    _itemsListos: [],
    _carrosPreEntrega: [],
    _entregas: [],
    _historial: [],
    _seleccionados: new Set(),
    _filtroPedido: '',
    _filtroEspesor: '',
    _searchTimer: null,

    _esc(s) {
        if (s == null) return '';
        return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    },

    _onSearchInput(value) {
        this._filtroPedido = value;
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => this._renderListos(document.getElementById('bodegaContent')), 250);
    },

    _onEspesorChange(value) {
        this._filtroEspesor = value;
        this._renderListos(document.getElementById('bodegaContent'));
    },

    _vista: 'listos', // listos | pre-entrega | entregas | historial | carros
    _carros: [],
    _itemsListos: [],
    _carrosPreEntrega: [],
    _entregas: [],
    _historial: [],
    _seleccionados: new Set(),

    async render() {
        const el = document.getElementById('page-bodega');
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const permisos = user.permisos || [];
        const isAdmin = user.rol === 'admin' || permisos.includes('usuarios');
        const canAdd = isAdmin || permisos.includes('bodega.agregar') || permisos.includes('bodega');
        const canEdit = isAdmin || permisos.includes('bodega.editar') || permisos.includes('bodega');
        const canDelete = isAdmin || permisos.includes('bodega.eliminar') || permisos.includes('bodega');

        el.innerHTML = `
            <div class="m-page">
                <div class="m-hero">
                    <div>
                        <h2 class="m-hero-title">Bodega - Producto Terminado</h2>
                        <p class="m-hero-sub">Armado de carros, pre-entrega y entrega a bodega</p>
                    </div>
                </div>

                <div class="m-actions">
                    <div style="display:flex;gap:6px;flex-wrap:wrap">
                        <button class="btn ${this._vista === 'listos' ? 'btn-primary' : 'btn-outline'}" onclick="App.modules.bodega.switchView('listos')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><polyline points="20 6 9 17 4 12"/></svg>
                            Listos <span id="cntListos" class="badge" style="margin-left:6px;background:#22c55e;color:white;border-radius:10px;padding:1px 8px;font-size:11px">0</span>
                        </button>
                        <button class="btn ${this._vista === 'pre-entrega' ? 'btn-primary' : 'btn-outline'}" onclick="App.modules.bodega.switchView('pre-entrega')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>
                            Pre-entrega <span id="cntPre" class="badge" style="margin-left:6px;background:#f59e0b;color:white;border-radius:10px;padding:1px 8px;font-size:11px">0</span>
                        </button>
                        <button class="btn ${this._vista === 'entregas' ? 'btn-primary' : 'btn-outline'}" onclick="App.modules.bodega.switchView('entregas')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            Entregas <span id="cntEnt" class="badge" style="margin-left:6px;background:#3b82f6;color:white;border-radius:10px;padding:1px 8px;font-size:11px">0</span>
                        </button>
                        <button class="btn ${this._vista === 'historial' ? 'btn-primary' : 'btn-outline'}" onclick="App.modules.bodega.switchView('historial')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            Historial
                        </button>
                        <button class="btn ${this._vista === 'carros' ? 'btn-primary' : 'btn-outline'}" onclick="App.modules.bodega.switchView('carros')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M5 17h14M5 17a2 2 0 1 1-2-2M19 17a2 2 0 1 0 2-2M3 12V8a1 1 0 0 1 1-1h12v9M9 7V4h6v3"/></svg>
                            Carros
                        </button>
                    </div>
                </div>

                <div id="bodegaContent"></div>
            </div>

            <div class="modal-overlay" id="bodAsignarModal">
                <div class="modal" style="max-width:480px">
                    <div class="modal-header"><h3>Asignar a Carro</h3><button class="modal-close" onclick="App.modules.bodega.closeAsignar()"></button></div>
                    <div class="modal-body" id="bodAsignarBody"></div>
                </div>
            </div>

            <div class="modal-overlay" id="bodEntregaModal">
                <div class="modal" style="max-width:560px">
                    <div class="modal-header"><h3 id="bodEntregaTitle">Detalle Entrega</h3><button class="modal-close" onclick="App.modules.bodega.closeEntrega()"></button></div>
                    <div class="modal-body" id="bodEntregaBody"></div>
                </div>
            </div>

            <div class="modal-overlay" id="bodCarroModal">
                <div class="modal" style="max-width:480px">
                    <div class="modal-header"><h3 id="bodCarroTitle">Nuevo Carro</h3><button class="modal-close" onclick="App.modules.bodega.closeCarroModal()"></button></div>
                    <div class="modal-body" id="bodCarroBody"></div>
                </div>
            </div>
        `;

        await this.refreshCounts();
        await this.renderView();
    },

    async refreshCounts() {
        try {
            const [listos, pre, ent] = await Promise.all([
                fetch('/api/bodega/items-listos', { headers: this._h() }).then(r => r.json()).catch(() => []),
                fetch('/api/bodega/pre-entrega', { headers: this._h() }).then(r => r.json()).catch(() => []),
                fetch('/api/bodega/entregas', { headers: this._h() }).then(r => r.json()).catch(() => [])
            ]);
            document.getElementById('cntListos').textContent = listos.length;
            document.getElementById('cntPre').textContent = pre.length;
            document.getElementById('cntEnt').textContent = ent.length;
        } catch (e) { console.error(e); }
    },

    async switchView(v) {
        this._vista = v;
        this._seleccionados.clear();
        this._filtroPedido = '';
        this._filtroEspesor = '';
        await this.render();
    },

    async renderView() {
        const target = document.getElementById('bodegaContent');
        target.innerHTML = '<div style="padding:40px;text-align:center;color:#64748b">Cargando...</div>';
        try {
            if (this._vista === 'listos') await this._renderListos(target);
            else if (this._vista === 'pre-entrega') await this._renderPreEntrega(target);
            else if (this._vista === 'entregas') await this._renderEntregas(target);
            else if (this._vista === 'historial') await this._renderHistorial(target);
            else if (this._vista === 'carros') await this._renderCarros(target);
        } catch (e) {
            target.innerHTML = `<div class="alert alert-danger">Error: ${e.message}</div>`;
            console.error(e);
        }
    },

    async _renderListos(target) {
        if (!this._itemsListos.length) {
            const r = await fetch('/api/bodega/items-listos', { headers: this._h() });
            const data = await r.json();
            this._itemsListos = Array.isArray(data) ? data : [];
            if (!Array.isArray(data)) console.warn('items-listos no devolvió array:', data);
        }
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const permisos = user.permisos || [];
        const isAdmin = user.rol === 'admin' || permisos.includes('usuarios');
        const canAdd = isAdmin || permisos.includes('bodega.agregar') || permisos.includes('bodega');

        const itemsFiltrados = this._itemsListos.filter(it => {
            if (this._filtroPedido && !String(it.pedido_sap_id || '').toLowerCase().includes(this._filtroPedido.toLowerCase())) return false;
            if (this._filtroEspesor && String(it.espesor_mm) !== String(this._filtroEspesor)) return false;
            return true;
        });

        const selCount = this._seleccionados.size;

        const espesoresDisponibles = [...new Set(this._itemsListos.map(it => it.espesor_mm).filter(e => e != null))].sort((a, b) => a - b);

        target.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px">
                <div style="position:relative">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);pointer-events:none">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input type="text" id="bodSearchPedido" placeholder="Buscar por pedido..." value="${this._esc(this._filtroPedido)}" oninput="App.modules.bodega._onSearchInput(this.value)" style="width:100%;padding:10px 12px 10px 38px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none">
                </div>
                ${espesoresDisponibles.length > 0 ? `
                <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
                    <span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Espesor:</span>
                    <button onclick="App.modules.bodega._onEspesorChange('')" style="padding:4px 10px;border-radius:14px;border:1px solid ${!this._filtroEspesor ? '#3b82f6' : '#e2e8f0'};background:${!this._filtroEspesor ? '#3b82f6' : 'transparent'};color:${!this._filtroEspesor ? 'white' : '#0f172a'};font-size:12px;font-weight:600;cursor:pointer">Todos</button>
                    ${espesoresDisponibles.map(e => `
                        <button onclick="App.modules.bodega._onEspesorChange('${e}')" style="padding:4px 10px;border-radius:14px;border:1px solid ${this._filtroEspesor == e ? '#3b82f6' : '#e2e8f0'};background:${this._filtroEspesor == e ? '#3b82f6' : 'transparent'};color:${this._filtroEspesor == e ? 'white' : '#0f172a'};font-size:12px;font-weight:600;cursor:pointer">${e}mm</button>
                    `).join('')}
                </div>
                ` : ''}
            </div>
            ${canAdd && selCount > 0 ? `
                <div style="background:linear-gradient(135deg,#3b82f615,#8b5cf615);border:1px solid #3b82f640;border-radius:12px;padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;gap:12px">
                    <strong>${selCount} items seleccionados</strong>
                    <button class="btn btn-primary btn-sm" onclick="App.modules.bodega.showAsignarV3()" style="margin-left:auto">Asignar a Carro</button>
                    <button class="btn btn-outline btn-sm" onclick="App.modules.bodega.toggleSeleccionarTodo()">Limpiar selección</button>
                </div>
            ` : ''}
            <div style="display:flex;flex-direction:column;gap:8px">
                ${itemsFiltrados.length === 0 ? '<div class="empty-state"><p>No hay coincidencias</p></div>' : ''}
                ${itemsFiltrados.map(it => `
                    <div style="background:white;border:1px solid ${this._seleccionados.has(it.paso_id) ? '#3b82f6' : '#e2e8f0'};border-radius:10px;padding:12px;display:flex;gap:12px;align-items:center;cursor:pointer" onclick="App.modules.bodega.toggleItem(${it.paso_id})">
                        ${canAdd ? `<input type="checkbox" ${this._seleccionados.has(it.paso_id) ? 'checked' : ''} onclick="event.stopPropagation(); App.modules.bodega.toggleItem(${it.paso_id})">` : ''}
                        <div style="flex:1;min-width:0">
                            <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:baseline;font-size:13px;font-weight:600">
                                <span><span style="color:#64748b;font-weight:500">Pedido:</span> <strong>${this._esc(it.pedido_sap_id) || '-'}</strong></span>
                                <span><span style="color:#64748b;font-weight:500">Item:</span> <strong>${it.item_numero != null ? it.item_numero : '-'}</strong></span>
                            </div>
                            <div style="font-size:11px;color:#64748b;margin-top:2px">${this._esc(it.cliente) || ''}</div>
                            <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:baseline;margin-top:6px">
                                <strong style="font-size:14px">${this._esc(it.codigo_producto) || '-'}</strong>
                                ${it.descripcion ? `<span style="font-size:12px;color:#64748b">${this._esc(it.descripcion)}</span>` : ''}
                                ${it.espesor_mm ? `<span style="padding:2px 6px;background:#f1f5f9;border-radius:8px;font-size:11px">${it.espesor_mm}mm</span>` : ''}
                            </div>
                            <div style="display:flex;gap:10px;font-size:12px;color:#64748b;margin-top:6px;flex-wrap:wrap">
                                <span><b>Dimensiones:</b> ${it.ancho}x${it.alto}mm</span>
                                <span><b>Cant:</b> ${it.cantidad || 1}</span>
                                <span><b>Kilos:</b> ${it.kilos ? Math.round(it.kilos) : '-'}</span>
                                ${it.ultima_estacion ? `<span style="color:#16a34a"><b>${this._esc(it.ultima_estacion)}</b></span>` : ''}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    async _renderPreEntrega(target) {
        const r = await fetch('/api/bodega/pre-entrega', { headers: this._h() });
        this._carrosPreEntrega = await r.json();

        if (this._carrosPreEntrega.length === 0) {
            target.innerHTML = '<div class="empty-state"><p>No hay carros en pre-entrega</p><p style="font-size:12px">Asigna items a un carro desde la vista "Listos"</p></div>';
            return;
        }

        target.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">
                ${this._carrosPreEntrega.map(c => `
                    <div style="background:white;border:1px solid #e2e8f0;border-radius:14px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.04)">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                            <div style="font-weight:800;font-size:18px">${c.codigo}</div>
                            <span style="padding:3px 10px;background:#f59e0b20;color:#f59e0b;border-radius:12px;font-size:11px;font-weight:700">${c.tipo}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid #f1f5f9;font-size:13px">
                            <span style="color:#64748b">Items</span><strong>${c.total_items}</strong>
                        </div>
                        <div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid #f1f5f9;font-size:13px">
                            <span style="color:#64748b">Kilos</span><strong>${Math.round(c.total_kilos || 0)} kg</strong>
                        </div>
                        <div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid #f1f5f9;font-size:13px">
                            <span style="color:#64748b">M²</span><strong>${(c.total_m2 || 0).toFixed(2)}</strong>
                        </div>
                        <div style="margin-top:12px;display:flex;gap:6px">
                            <button class="btn btn-outline btn-sm" style="flex:1" onclick="App.modules.bodega.verItemsCarro(${c.carro_id})">Ver items</button>
                            <button class="btn btn-success btn-sm" style="flex:1" onclick="App.modules.bodega.showGenerarEntrega(${c.carro_id})">Generar Entrega</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    async _renderEntregas(target) {
        const r = await fetch('/api/bodega/entregas', { headers: this._h() });
        this._entregas = await r.json();

        if (this._entregas.length === 0) {
            target.innerHTML = '<div class="empty-state"><p>No hay entregas pendientes de recepción</p></div>';
            return;
        }

        target.innerHTML = `
            <div class="m-card">
                <div class="m-table-wrap">
                    <table class="m-table">
                        <thead>
                            <tr>
                                <th>Documento</th>
                                <th>Carro</th>
                                <th>Items</th>
                                <th>Kilos</th>
                                <th>Generado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this._entregas.map(e => `
                                <tr>
                                    <td><strong>${e.numero_documento}</strong></td>
                                    <td>${e.carro_codigo} <span style="color:#64748b;font-size:11px">(${e.carro_tipo})</span></td>
                                    <td>${e.total_items}</td>
                                    <td>${Math.round(e.total_kilos || 0)} kg</td>
                                    <td>${new Date(e.generado_at).toLocaleString('es-CL')}</td>
                                    <td>
                                        <button class="btn btn-sm btn-outline" onclick="App.modules.bodega.verEntrega(${e.id})">Ver</button>
                                        <button class="btn btn-sm btn-success" onclick="App.modules.bodega.recibirEntrega(${e.id})">Recibir</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    async _renderHistorial(target) {
        const r = await fetch('/api/bodega/historial', { headers: this._h() });
        this._historial = await r.json();

        if (this._historial.length === 0) {
            target.innerHTML = '<div class="empty-state"><p>Sin historial aún</p></div>';
            return;
        }

        target.innerHTML = `
            <div class="m-card">
                <div class="m-table-wrap">
                    <table class="m-table">
                        <thead>
                            <tr>
                                <th>Documento</th>
                                <th>Carro</th>
                                <th>Items</th>
                                <th>Generado</th>
                                <th>Recibido</th>
                                <th>Recibido por</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this._historial.map(e => `
                                <tr>
                                    <td><strong>${e.numero_documento}</strong></td>
                                    <td>${e.carro_codigo}</td>
                                    <td>${e.total_items}</td>
                                    <td style="font-size:12px">${new Date(e.generado_at).toLocaleString('es-CL')}</td>
                                    <td style="font-size:12px">${e.recibido_at ? new Date(e.recibido_at).toLocaleString('es-CL') : '-'}</td>
                                    <td>${e.recibido_por_nombre || e.recibido_por_email || '-'}</td>
                                    <td>
                                        <button class="btn btn-sm btn-outline" onclick="App.modules.bodega.verEntrega(${e.id})">Ver</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    async _renderCarros(target) {
        const r = await fetch('/api/bodega/carros', { headers: this._h() });
        this._carros = await r.json();
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const isAdmin = user.rol === 'admin' || user.permisos?.includes('usuarios');
        const canEdit = isAdmin || user.permisos?.includes('bodega.editar') || user.permisos?.includes('bodega');
        const canDelete = isAdmin || user.permisos?.includes('bodega.eliminar') || user.permisos?.includes('bodega');

        target.innerHTML = `
            <div class="m-actions" style="margin-bottom:14px">
                <button class="btn btn-accent" onclick="App.modules.bodega.showNuevoCarro()">+ Nuevo Carro</button>
            </div>
            <div class="m-card">
                <div class="m-table-wrap">
                    <table class="m-table">
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Tipo</th>
                                <th>Capacidad</th>
                                <th>Items asignados</th>
                                <th>En carros</th>
                                <th>Activo</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this._carros.map(c => `
                                <tr>
                                    <td><strong>${c.codigo}</strong></td>
                                    <td>${c.tipo}</td>
                                    <td>${c.capacidad_items}</td>
                                    <td>${c.total_items_asignados}</td>
                                    <td>${c.items_en_carros}</td>
                                    <td>${c.activo ? '<span style="color:#16a34a">Sí</span>' : '<span style="color:#94a3b8">No</span>'}</td>
                                    <td>
                                        ${canEdit ? `<button class="btn btn-sm btn-outline" onclick="App.modules.bodega.editarCarro(${c.id})">Editar</button>` : ''}
                                        ${canDelete && c.total_items_asignados == 0 ? `<button class="btn btn-sm btn-danger" onclick="App.modules.bodega.eliminarCarro(${c.id})">Eliminar</button>` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    toggleItem(pasoId) {
        if (this._seleccionados.has(pasoId)) this._seleccionados.delete(pasoId);
        else this._seleccionados.add(pasoId);
        this._renderListos(document.getElementById('bodegaContent'));
    },

    toggleSeleccionarTodo() {
        this._seleccionados.clear();
        this._renderListos(document.getElementById('bodegaContent'));
    },

    async showAsignarV3() {
        // Mostrar modal inmediatamente para feedback visual
        const body = document.getElementById('bodAsignarBody');
        body.innerHTML = '<div style="padding:20px;text-align:center;color:#64748b">Cargando carros...</div>';
        const modal = document.getElementById('bodAsignarModal');
        if (modal) modal.classList.add('active');
        else { console.error('Modal bodAsignarModal no existe en el DOM'); alert('Error: modal no encontrado'); return; }

        try {
            const r = await fetch('/api/bodega/carros?cache=' + Date.now(), { headers: this._h() });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const text = await r.text();
            console.log('[V3] raw response:', text.substring(0, 500));
            const carros = JSON.parse(text);
            console.log('[V3] parsed:', carros.length, 'carros:', carros);

            const carrosLibres = carros.filter(c => c.codigo && (c.activo === true || c.activo === undefined) && (Number(c.items_en_carros) || 0) === 0);
            console.log('[V3] carrosLibres:', carrosLibres.length);

            if (carrosLibres.length === 0) {
                body.innerHTML = `
                    <p style="color:#94a3b8;text-align:center;padding:20px">No hay carros libres. Crea uno nuevo desde la sección Carros.</p>
                    <p style="color:#ef4444;font-size:11px;text-align:center">Debug V3: total=${carros.length}, libres=${carrosLibres.length}</p>
                    <p style="color:#94a3b8;font-size:10px;text-align:center;word-break:break-all">${text.substring(0, 300)}</p>
                `;
                return;
            }

            console.log('[V3] carrosLibres details:', JSON.stringify(carrosLibres));

            try {
                const htmlContent = carrosLibres.map(c => `
                    <div class="carro-option" data-id="${c.id}" data-codigo="${this._esc(c.codigo)}" onclick="App.modules.bodega.selectCarro(this)" style="background:#f8fafc;border:2px solid #e2e8f0;border-radius:10px;padding:12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center">
                        <div>
                            <div style="font-weight:700">${this._esc(c.codigo)}</div>
                            <div style="font-size:11px;color:#64748b">${this._esc(c.tipo || '')} - capacidad ${c.capacidad_items || 50}</div>
                        </div>
                        <span style="font-size:11px;color:#16a34a;font-weight:700">Libre</span>
                    </div>
                `).join('');
                console.log('[V3] htmlContent length:', htmlContent.length, 'first 200:', htmlContent.substring(0, 200));

                body.innerHTML = `
                    <p style="margin-bottom:14px;color:#64748b;font-size:13px">Selecciona el carro físico donde vas a apilar los <strong>${this._seleccionados.size}</strong> items seleccionados.</p>
                    <div style="display:flex;flex-direction:column;gap:8px;max-height:340px;overflow-y:auto">
                        ${htmlContent}
                    </div>
                    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
                        <button class="btn btn-outline" onclick="App.modules.bodega.closeAsignar()">Cancelar</button>
                        <button class="btn btn-primary" id="btnAsignar" disabled style="opacity:0.5" onclick="App.modules.bodega.confirmarAsignar()">Asignar ${this._seleccionados.size} items</button>
                    </div>
                `;
                console.log('[V3] body.innerHTML set OK');
            } catch (innerErr) {
                console.error('[V3] error en render:', innerErr);
                body.innerHTML = `<div style="padding:20px;color:red">Error render: ${innerErr.message}</div>`;
            }
        } catch (e) {
            console.error('[V3] error:', e);
            body.innerHTML = `<div style="padding:20px;text-align:center;color:#ef4444">Error: ${e.message}</div>`;
        }
    },

    _carroSeleccionado: null,
    selectCarro(el) {
        document.querySelectorAll('.carro-option').forEach(e => { e.style.borderColor = '#e2e8f0'; e.style.background = '#f8fafc'; });
        el.style.borderColor = '#3b82f6';
        el.style.background = '#eff6ff';
        this._carroSeleccionado = Number(el.dataset.id);
        const btn = document.getElementById('btnAsignar');
        btn.disabled = false;
        btn.style.opacity = '1';
    },

    async confirmarAsignar() {
        if (!this._carroSeleccionado || this._seleccionados.size === 0) return;
        const pasoIds = Array.from(this._seleccionados);
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        try {
            const r = await fetch('/api/bodega/asignar', {
                method: 'POST',
                headers: this._h(),
                body: JSON.stringify({
                    carro_id: this._carroSeleccionado,
                    paso_ids: pasoIds,
                    armador_nombre: user.nombre || user.email
                })
            });
            const data = await r.json();
            if (data.ok) {
                this.closeAsignar();
                this._seleccionados.clear();
                this._carroSeleccionado = null;
                await this.render();
            } else {
                alert(data.error || 'Error al asignar');
            }
        } catch (e) { alert('Error de conexión'); }
    },

    closeAsignar() {
        document.getElementById('bodAsignarModal').classList.remove('active');
    },

    async verItemsCarro(carroId) {
        const r = await fetch(`/api/bodega/carros/${carroId}/items`, { headers: this._h() });
        const items = await r.json();
        const carro = this._carrosPreEntrega.find(c => c.carro_id === carroId);

        const body = document.getElementById('bodEntregaBody');
        document.getElementById('bodEntregaTitle').textContent = `Carro ${carro ? carro.codigo : ''} - ${items.length} items`;
        body.innerHTML = `
            <div style="max-height:60vh;overflow-y:auto">
                ${items.map(it => `
                    <div style="padding:10px;border-bottom:1px solid #f1f5f9">
                        <div style="display:flex;gap:10px;align-items:center">
                            <strong>${it.codigo_producto}</strong>
                            <span style="color:#64748b;font-size:12px">${it.descripcion || ''}</span>
                        </div>
                        <div style="font-size:12px;color:#64748b;margin-top:4px">
                            Pedido <b>${it.pedido_sap_id}</b> · Item <b>${it.item_numero}</b> · ${it.cliente} · ${it.ancho}x${it.alto}mm · Cant ${it.cantidad} · ${Math.round(it.kilos || 0)} kg
                        </div>
                    </div>
                `).join('')}
            </div>
            <div style="display:flex;justify-content:flex-end;margin-top:14px">
                <button class="btn btn-outline" onclick="App.modules.bodega.closeEntrega()">Cerrar</button>
            </div>
        `;
        document.getElementById('bodEntregaModal').classList.add('active');
    },

    showGenerarEntrega(carroId) {
        const carro = this._carrosPreEntrega.find(c => c.carro_id === carroId);
        document.getElementById('bodEntregaTitle').textContent = `Generar Entrega - Carro ${carro ? carro.codigo : ''}`;
        document.getElementById('bodEntregaBody').innerHTML = `
            <p style="margin-bottom:14px">Vas a generar el documento de entrega para <strong>${carro ? carro.codigo : ''}</strong> con <strong>${carro ? carro.total_items : 0} items</strong>.</p>
            <div class="form-group">
                <label>Observaciones (opcional)</label>
                <textarea class="form-control" id="bodEntregaObs" rows="3" placeholder="Notas para bodega..."></textarea>
            </div>
            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px">
                <button class="btn btn-outline" onclick="App.modules.bodega.closeEntrega()">Cancelar</button>
                <button class="btn btn-success" onclick="App.modules.bodega.confirmarGenerarEntrega(${carroId})">Generar ${carro ? carro.codigo : ''}</button>
            </div>
        `;
        document.getElementById('bodEntregaModal').classList.add('active');
    },

    async confirmarGenerarEntrega(carroId) {
        const obs = document.getElementById('bodEntregaObs').value;
        try {
            const r = await fetch('/api/bodega/generar-entrega', {
                method: 'POST',
                headers: this._h(),
                body: JSON.stringify({ carro_id: carroId, observaciones: obs })
            });
            const data = await r.json();
            if (data.ok) {
                this.closeEntrega();
                await this.render();
            } else {
                alert(data.error || 'Error');
            }
        } catch (e) { alert('Error'); }
    },

    async verEntrega(entregaId) {
        const r = await fetch(`/api/bodega/entregas/${entregaId}`, { headers: this._h() });
        const ent = await r.json();
        const totalKilos = ent.items.reduce((a, i) => a + Number(i.kilos || 0), 0);
        const totalCant = ent.items.reduce((a, i) => a + Number(i.cantidad || 0), 0);

        document.getElementById('bodEntregaTitle').textContent = `Entrega ${ent.numero_documento}`;
        document.getElementById('bodEntregaBody').innerHTML = `
            <div style="background:#f8fafc;padding:12px;border-radius:8px;margin-bottom:14px">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:#64748b">Carro:</span><strong>${ent.carro_codigo} (${ent.carro_tipo})</strong></div>
                <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:#64748b">Generado por:</span><strong>${ent.generado_por_nombre || ent.generado_por_email || '-'}</strong></div>
                <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:#64748b">Fecha generación:</span><strong>${new Date(ent.generado_at).toLocaleString('es-CL')}</strong></div>
                ${ent.recibido_at ? `
                <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:#64748b">Recibido por:</span><strong>${ent.recibido_por_nombre || ent.recibido_por_email}</strong></div>
                <div style="display:flex;justify-content:space-between"><span style="color:#64748b">Fecha recepción:</span><strong>${new Date(ent.recibido_at).toLocaleString('es-CL')}</strong></div>
                ` : ''}
            </div>
            <div style="max-height:50vh;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px">
                <table class="m-table" style="margin:0">
                    <thead>
                        <tr>
                            <th>Pedido</th>
                            <th>Item</th>
                            <th>Cliente</th>
                            <th>Código</th>
                            <th>Dimensiones</th>
                            <th>Cant</th>
                            <th>Kg</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ent.items.map(i => `
                            <tr>
                                <td>${i.pedido_sap_id}</td>
                                <td>${i.item_numero}</td>
                                <td style="font-size:11px">${i.cliente || '-'}</td>
                                <td><strong>${i.codigo_producto}</strong></td>
                                <td style="font-size:11px">${i.ancho}x${i.alto}mm</td>
                                <td>${i.cantidad}</td>
                                <td>${Math.round(i.kilos || 0)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="background:#f1f5f9;font-weight:700">
                            <td colspan="5" style="text-align:right">Totales:</td>
                            <td>${totalCant}</td>
                            <td>${Math.round(totalKilos)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            ${ent.observaciones ? `<div style="margin-top:12px;padding:10px;background:#fef3c7;border-radius:6px;font-size:12px"><b>Observaciones:</b> ${ent.observaciones}</div>` : ''}
            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px">
                <button class="btn btn-outline" onclick="App.modules.bodega.closeEntrega()">Cerrar</button>
                ${!ent.recibido_at ? `<button class="btn btn-success" onclick="App.modules.bodega.recibirEntrega(${ent.id})">Marcar Recibido</button>` : ''}
            </div>
        `;
        document.getElementById('bodEntregaModal').classList.add('active');
    },

    async recibirEntrega(entregaId) {
        if (!confirm('¿Confirmar que bodega recibió este carro?')) return;
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        try {
            const r = await fetch(`/api/bodega/entregas/${entregaId}/recibir`, {
                method: 'POST',
                headers: this._h(),
                body: JSON.stringify({ usuario_nombre: user.nombre || user.email })
            });
            const data = await r.json();
            if (data.ok) {
                this.closeEntrega();
                await this.render();
            } else {
                alert(data.error || 'Error');
            }
        } catch (e) { alert('Error'); }
    },

    closeEntrega() {
        document.getElementById('bodEntregaModal').classList.remove('active');
    },

    showNuevoCarro() {
        this._editingCarro = null;
        this._showCarroModal('Nuevo Carro', {});
    },

    editarCarro(id) {
        const c = this._carros.find(x => x.id === id);
        if (!c) return;
        this._editingCarro = id;
        this._showCarroModal(`Editar Carro ${c.codigo}`, c);
    },

    _showCarroModal(title, carro) {
        document.getElementById('bodCarroTitle').textContent = title;
        document.getElementById('bodCarroBody').innerHTML = `
            <div class="form-group">
                <label>Código *</label>
                <input class="form-control" id="bodCarroCodigo" value="${carro.codigo || ''}" placeholder="Ej: C-001, A-005">
            </div>
            <div class="form-group">
                <label>Tipo</label>
                <select class="form-control" id="bodCarroTipo">
                    <option value="carro" ${carro.tipo === 'carro' ? 'selected' : ''}>Carro</option>
                    <option value="atril" ${carro.tipo === 'atril' ? 'selected' : ''}>Atril</option>
                    <option value="rack" ${carro.tipo === 'rack' ? 'selected' : ''}>Rack</option>
                </select>
            </div>
            <div class="form-group">
                <label>Capacidad (items)</label>
                <input type="number" class="form-control" id="bodCarroCap" value="${carro.capacidad_items || 50}">
            </div>
            ${this._editingCarro ? `
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="bodCarroActivo" ${carro.activo !== false ? 'checked' : ''}> Activo
                    </label>
                </div>
                <div class="form-group">
                    <label>Observaciones</label>
                    <textarea class="form-control" id="bodCarroObs" rows="2">${carro.observaciones || ''}</textarea>
                </div>
            ` : ''}
            <div style="display:flex;gap:10px;justify-content:flex-end">
                <button class="btn btn-outline" onclick="App.modules.bodega.closeCarroModal()">Cancelar</button>
                <button class="btn btn-primary" onclick="App.modules.bodega.guardarCarro()">Guardar</button>
            </div>
        `;
        document.getElementById('bodCarroModal').classList.add('active');
    },

    async guardarCarro() {
        const data = {
            codigo: document.getElementById('bodCarroCodigo').value.trim(),
            tipo: document.getElementById('bodCarroTipo').value,
            capacidad_items: Number(document.getElementById('bodCarroCap').value) || 50
        };
        if (!data.codigo) return alert('Código requerido');

        if (this._editingCarro) {
            const activoEl = document.getElementById('bodCarroActivo');
            const obsEl = document.getElementById('bodCarroObs');
            if (activoEl) data.activo = activoEl.checked;
            if (obsEl) data.observaciones = obsEl.value;
        }

        try {
            const url = this._editingCarro ? `/api/bodega/carros/${this._editingCarro}` : '/api/bodega/carros';
            const method = this._editingCarro ? 'PUT' : 'POST';
            const r = await fetch(url, { method, headers: this._h(), body: JSON.stringify(data) });
            const res = await r.json();
            if (res.id || !res.error) {
                this.closeCarroModal();
                await this.render();
            } else {
                alert(res.error || 'Error');
            }
        } catch (e) { alert('Error'); }
    },

    async eliminarCarro(id) {
        if (!confirm('¿Eliminar este carro?')) return;
        try {
            await fetch(`/api/bodega/carros/${id}`, { method: 'DELETE', headers: this._h() });
            await this.render();
        } catch (e) { alert('Error'); }
    },

    closeCarroModal() {
        document.getElementById('bodCarroModal').classList.remove('active');
        this._editingCarro = null;
    },

    _h() {
        const u = JSON.parse(localStorage.getItem('unified_user') || '{}');
        return {
            'Content-Type': 'application/json',
            'X-User-Email': u.email || '',
            'X-User-Permisos': (u.permisos || []).join(',')
        };
    }
});
