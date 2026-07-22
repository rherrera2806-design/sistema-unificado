App.registerModule('produccion', {
    ordenes: [],
    maquinas: [],
    recetas: [],

    async render() {
        const el = document.getElementById('page-produccion');
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const permisos = user.permisos || [];
        const esAdmin = permisos.includes('usuarios');
        const puedeImportar = esAdmin || permisos.includes('produccion');

        el.innerHTML = `
            <div class="page-header">
                <div>
                    <h2 style="margin:0">Produccion</h2>
                    <div class="subtitle">Gestion de ordenes de produccion y planificacion</div>
                </div>
                ${puedeImportar ? `
                    <div style="display:flex;gap:8px">
                        <button class="btn btn-primary" onclick="App.modules.produccion.showImportModal()">+ Importar SAP</button>
                        <button class="btn btn-outline" onclick="App.modules.produccion.showNewOrderModal()">+ Nueva Orden</button>
                    </div>
                ` : ''}
            </div>

            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px">
                <div class="card" style="text-align:center"><div class="card-body">
                    <div style="font-size:28px;font-weight:700;color:var(--primary)" id="prodTotal">0</div>
                    <div style="color:var(--text-light);font-size:13px">Total Ordenes</div>
                </div></div>
                <div class="card" style="text-align:center"><div class="card-body">
                    <div style="font-size:28px;font-weight:700;color:var(--warning)" id="prodPendientes">0</div>
                    <div style="color:var(--text-light);font-size:13px">Pendientes</div>
                </div></div>
                <div class="card" style="text-align:center"><div class="card-body">
                    <div style="font-size:28px;font-weight:700;color:var(--info)" id="prodProceso">0</div>
                    <div style="color:var(--text-light);font-size:13px">En Proceso</div>
                </div></div>
                <div class="card" style="text-align:center"><div class="card-body">
                    <div style="font-size:28px;font-weight:700;color:var(--success)" id="prodTerminadas">0</div>
                    <div style="color:var(--text-light);font-size:13px">Terminadas</div>
                </div></div>
            </div>

            <div class="card">
                <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
                    <h3 style="margin:0">Ordenes de Produccion</h3>
                    <div style="display:flex;gap:8px">
                        <input type="text" class="form-control" id="prodFilterSearch" placeholder="Buscar codigo, pedido..." oninput="App.modules.produccion.filter()" style="width:200px">
                        <select class="form-control" id="prodFilterEstado" onchange="App.modules.produccion.filter()" style="width:140px">
                            <option value="todos">Todos</option>
                            <option value="PENDIENTE">Pendientes</option>
                            <option value="EN_PROCESO">En Proceso</option>
                            <option value="TERMINADO">Terminados</option>
                            <option value="CERRADO">Cerrados</option>
                        </select>
                    </div>
                </div>
                <div class="card-body" style="padding:0">
                    <table style="font-size:13px"><thead><tr>
                        <th style="padding:6px 12px">Pedido</th><th style="padding:6px 12px">Item</th><th style="padding:6px 12px">Cliente</th><th style="padding:6px 12px">Cod. Padre</th><th style="padding:6px 12px">Codigo</th><th style="padding:6px 12px">Nombre MP</th><th style="padding:6px 12px">Dimensiones</th><th style="padding:6px 12px">m2</th><th style="padding:6px 12px">Cant.</th><th style="padding:6px 12px">Tipo Venta</th><th style="padding:6px 12px">Ruta</th><th style="padding:6px 12px">Estado</th><th style="padding:6px 12px">Acciones</th>
                    </tr></thead><tbody id="prodTable">
                        <tr><td colspan="13" style="text-align:center;padding:24px;color:#64748b">Cargando...</td></tr>
                    </tbody></table>
                </div>
            </div>

            <div class="modal-overlay" id="prodImportModal">
                <div class="modal" style="max-width:500px">
                    <div class="modal-header"><h3>Importar desde Excel</h3><button class="modal-close" onclick="App.modules.produccion.hideImportModal()">&times;</button></div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label style="font-weight:500">Archivo Excel</label>
                            <div id="prodImportArea" style="border:2px dashed #cbd5e1;border-radius:8px;padding:32px;text-align:center;cursor:pointer;transition:all .2s"
                                 onclick="document.getElementById('prodImportFile').click()">
                                <div style="font-size:32px;margin-bottom:8px">📊</div>
                                <div style="color:var(--text-light)">Arrastra un Excel o haz clic para seleccionar</div>
                                <div id="prodImportName" style="color:var(--success);font-weight:500;margin-top:8px;display:none"></div>
                            </div>
                            <input type="file" id="prodImportFile" accept=".xlsx,.xls,.csv" style="display:none" onchange="App.modules.produccion.handleImportFile(event)">
                        </div>
                        <div style="background:#f8fafc;border-radius:8px;padding:12px;margin-top:12px;font-size:12px;color:var(--text-light)">
                            <strong>Columnas esperadas:</strong><br>
                            codigo, pedido, item, cliente, descripcion, cantidad, anho, alto, perforaciones, pintado, tipo de venta, fecha_creacion<br>
                            <em>Filas iguales (pedido+item+codigo) se fusionan sumando cantidad. Cada fila = 1 item.</em>
                        </div>
                        <div id="prodImportPreview" style="max-height:200px;overflow-y:auto;margin-top:12px"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="App.modules.produccion.hideImportModal()">Cancelar</button>
                        <button class="btn btn-primary" id="prodImportBtn" onclick="App.modules.produccion.importar()" disabled>Importar</button>
                    </div>
                </div>
            </div>

            <div class="modal-overlay" id="prodPasosModal">
                <div class="modal" style="max-width:600px">
                    <div class="modal-header"><h3>Pasos de Produccion</h3><button class="modal-close" onclick="App.modules.produccion.hidePasosModal()">&times;</button></div>
                    <div class="modal-body" id="prodPasosBody"></div>
                </div>
            </div>

            <div class="modal-overlay" id="prodNewOrderModal">
                <div class="modal" style="max-width:500px">
                    <div class="modal-header"><h3>Nueva Orden Manual</h3><button class="modal-close" onclick="App.modules.produccion.hideNewOrderModal()">&times;</button></div>
                    <div class="modal-body">
                        <div class="form-group"><label>Pedido *</label><input class="form-control" id="newOrdPedido" placeholder="Ej: PED-001"></div>
                        <div class="form-group"><label>Item</label><input class="form-control" id="newOrdItem" type="number" value="1" min="1"></div>
                        <div class="form-group"><label>Cliente</label><input class="form-control" id="newOrdCliente" placeholder="Nombre del cliente"></div>
                        <div class="form-group"><label>Codigo Producto *</label><input class="form-control" id="newOrdCodigo" placeholder="Ej: 100, V659"></div>
                        <div class="form-group"><label>Descripcion</label><input class="form-control" id="newOrdDescripcion" placeholder="Descripcion del producto"></div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                            <div class="form-group"><label>Ancho (mm) *</label><input class="form-control" id="newOrdAncho" type="number" value="0"></div>
                            <div class="form-group"><label>Alto (mm) *</label><input class="form-control" id="newOrdAlto" type="number" value="0"></div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                            <div class="form-group"><label>Perforaciones</label>
                                <select class="form-control" id="newOrdPerforaciones"><option value="0">No</option><option value="1">Si</option></select>
                            </div>
                            <div class="form-group"><label>Pintado</label>
                                <select class="form-control" id="newOrdPintado"><option value="0">No (0)</option><option value="1">Si (1)</option></select>
                            </div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                            <div class="form-group"><label>Tipo de Venta</label>
                                <select class="form-control" id="newOrdTipoVenta">
                                    <option value="Normal">Normal</option>
                                    <option value="Express">Express</option>
                                    <option value="Vta Region">Vta Region</option>
                                    <option value="Urgencia">Urgencia</option>
                                </select>
                            </div>
                            <div class="form-group"><label>Cantidad</label><input class="form-control" id="newOrdCantidad" type="number" value="1" min="1"></div>
                        </div>
                        <div class="form-group"><label>Fecha Creacion</label><input class="form-control" id="newOrdFechaCreacion" type="date"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="App.modules.produccion.hideNewOrderModal()">Cancelar</button>
                        <button class="btn btn-primary" onclick="App.modules.produccion.saveNewOrder()">Crear Orden</button>
                    </div>
                </div>
            </div>

            <div class="modal-overlay" id="prodCerrarModal">
                <div class="modal" style="max-width:400px">
                    <div class="modal-header"><h3>Cerrar Orden</h3><button class="modal-close" onclick="App.modules.produccion.hideCerrarModal()">&times;</button></div>
                    <div class="modal-body">
                        <p style="font-size:13px;color:var(--text-light);margin-bottom:12px">Indica el motivo por el cual se cierra esta linea:</p>
                        <textarea class="form-control" id="cerrarNota" rows="3" placeholder="Ej: Cliente cancelo el pedido..."></textarea>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="App.modules.produccion.hideCerrarModal()">Cancelar</button>
                        <button class="btn btn-primary" onclick="App.modules.produccion.confirmCerrar()">Cerrar Orden</button>
                    </div>
                </div>
            </div>
        `;

        await this.load();
        this.setupDragDrop();
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
        } catch(e) { console.error('Error loading produccion:', e); }
    },

    renderStats() {
        const total = this.ordenes.length;
        const pendientes = this.ordenes.filter(o => o.estado_programacion === 'PENDIENTE').length;
        const enProceso = this.ordenes.filter(o => o.estado_programacion === 'EN_PROCESO').length;
        const terminadas = this.ordenes.filter(o => o.estado_programacion === 'TERMINADO').length;
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('prodTotal', total);
        set('prodPendientes', pendientes);
        set('prodProceso', enProceso);
        set('prodTerminadas', terminadas);
    },

    renderTable(ordenes) {
        const tbody = document.getElementById('prodTable');
        if (!ordenes.length) { tbody.innerHTML = '<tr><td colspan="13" style="text-align:center;padding:24px;color:#64748b">No hay ordenes de produccion</td></tr>'; return; }

        const estadoBadge = (e) => {
            if (e === 'TERMINADO') return '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:#dcfce7;color:#166534">✓ TERMINADO</span>';
            if (e === 'EN_PROCESO') return '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:#dbeafe;color:#1e40af">⚙ EN PROCESO</span>';
            if (e === 'MERMADO') return '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:#fee2e2;color:#991b1b">✗ MERMADO</span>';
            if (e === 'CERRADO') return '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:#e5e7eb;color:#374151">✕ CERRADO</span>';
            return '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:#fef9c3;color:#854d0e">⏳ PENDIENTE</span>';
        };

        const tipoBadge = (t) => {
            const styles = { 'Express': 'background:#fee2e2;color:#991b1b', 'Urgencia': 'background:#fecaca;color:#991b1b', 'Vta Region': 'background:#dbeafe;color:#1e40af' };
            return `<span style="padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500;${styles[t] || 'background:#f1f5f9;color:#64748b'}">${t || 'Normal'}</span>`;
        };

        tbody.innerHTML = ordenes.map(o => {
            const progreso = o.total_pasos > 0 ? `${o.pasos_terminados}/${o.total_pasos}` : '-';
            return `<tr style="line-height:1.3">
                <td style="padding:6px 12px"><strong>${escapeHtml(o.pedido_sap_id || '-')}</strong></td>
                <td style="padding:6px 12px">${o.item_numero || '-'}</td>
                <td style="padding:6px 12px">${escapeHtml(o.cliente || '-')}</td>
                <td style="padding:6px 12px;font-size:11px;color:#6b7280">${escapeHtml(o.nombre_codigo_padre || '-')}</td>
                <td style="padding:6px 12px"><strong>${escapeHtml(o.codigo_producto)}</strong>${o.es_compuesto ? ' <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:#ede9fe;color:#7c3aed">BOM</span>' : ''}</td>
                <td style="padding:6px 12px;font-size:11px;color:#6b7280">${escapeHtml(o.nombre_mp || o.descripcion || '-')}</td>
                <td style="padding:6px 12px">${o.ancho} x ${o.alto} mm</td>
                <td style="padding:6px 12px">${o.metros_cuadrados ? Number(o.metros_cuadrados).toFixed(2) : '-'}</td>
                <td style="padding:6px 12px;cursor:pointer" title="Click para editar" onclick="App.modules.produccion.editCantidad(${o.id}, ${o.cantidad || 1})"><strong>${o.cantidad || 1}</strong></td>
                <td style="padding:6px 12px">${tipoBadge(o.tipo_venta)}</td>
                <td style="padding:6px 12px">${progreso}</td>
                <td style="padding:6px 12px">${estadoBadge(o.estado_programacion)}${o.cerrado_nota ? ` <span title="${o.cerrado_nota.replace(/"/g, '&quot;')}" style="cursor:pointer;font-size:10px">ℹ️</span>` : ''}</td>
                <td style="padding:6px 12px">
                    <button class="btn btn-sm btn-outline" onclick="App.modules.produccion.verPasos(${o.id})" style="padding:2px 8px;font-size:11px">Ver Pasos</button>
                    ${o.estado_programacion !== 'CERRADO' ? `<button class="btn btn-sm btn-outline" style="padding:2px 8px;font-size:11px;margin-left:4px" onclick="App.modules.produccion.cerrarOrden(${o.id})">Cerrar</button>` : ''}
                    <button class="btn btn-sm btn-outline" style="padding:2px 8px;font-size:11px;margin-left:4px;color:#ef4444;border-color:#ef4444" onclick="App.modules.produccion.eliminarOrden(${o.id})">Eliminar</button>
                </td>
            </tr>`;
        }).join('');
    },

    filter() {
        const search = (document.getElementById('prodFilterSearch')?.value || '').toLowerCase();
        const estado = document.getElementById('prodFilterEstado')?.value || 'todos';
        let filtered = this.ordenes;
        if (search) filtered = filtered.filter(o => (o.codigo_producto || '').toLowerCase().includes(search) || (o.pedido_sap_id || '').toLowerCase().includes(search) || (o.cliente || '').toLowerCase().includes(search) || (o.nombre_codigo_padre || '').toLowerCase().includes(search) || (o.nombre_mp || '').toLowerCase().includes(search));
        if (estado !== 'todos') filtered = filtered.filter(o => o.estado_programacion === estado);
        this.renderTable(filtered);
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
        if (!this.selectedImportFile) return;
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
                        resolve(XLSX.utils.sheet_to_json(ws));
                    } catch(e) { reject(e); }
                };
                reader.onerror = () => reject(new Error('Error al leer archivo'));
                reader.readAsArrayBuffer(this.selectedImportFile);
            });

            if (!data.length) { alert('El archivo esta vacio'); btn.textContent = 'Importar'; btn.disabled = false; return; }

            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const res = await fetch('/api/produccion/importar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' },
                body: JSON.stringify({ rows: data })
            });

            const result = await res.json();
            if (res.ok) {
                let msg = `Importadas: ${result.importadas} ordenes, ${result.pasos_creados} pasos.`;
                if (result.fusiones > 0) msg += ` Fusiones: ${result.fusiones} filas combinadas.`;
                if (result.costos_calculados > 0) msg += ` Costos calculados: ${result.costos_calculados}.`;
                if (result.errores && result.errores.length) {
                    msg += `\n\nErrores (${result.errores.length}):\n`;
                    result.errores.slice(0, 5).forEach(e => msg += `• Fila ${e.fila}: ${e.error}\n`);
                    if (result.errores.length > 5) msg += `... y ${result.errores.length - 5} mas`;
                }
                App.toast(msg);
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
            const res = await fetch(`/api/produccion/ordenes/${ordenId}/pasos`);
            const pasos = await res.json();
            const orden = this.ordenes.find(o => o.id === ordenId);
            const body = document.getElementById('prodPasosBody');
            body.innerHTML = `
                <div style="margin-bottom:12px"><strong>Pedido:</strong> ${orden?.pedido_sap_id || '-'} | <strong>Codigo:</strong> ${orden?.codigo_producto} | <strong>${orden?.ancho}x${orden?.alto}mm</strong></div>
                ${pasos.length === 0 ? '<div style="color:var(--text-light);text-align:center;padding:20px">Sin pasos definidos</div>' :
                `<table><thead><tr><th>#</th><th>Estacion</th><th>Estado</th><th>Inicio</th><th>Fin</th></tr></thead><tbody>${pasos.map(p => {
                    const estadoEstilo = { PENDIENTE: 'background:#fef9c3;color:#854d0e', EN_PROCESO: 'background:#dbeafe;color:#1e40af', TERMINADO: 'background:#dcfce7;color:#166534', MERMADO: 'background:#fee2e2;color:#991b1b' };
                    return `<tr>
                        <td>${p.orden_secuencia}</td>
                        <td><strong>${p.nombre_estacion || p.estacion_nombre}</strong></td>
                        <td><span style="padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;${estadoEstilo[p.estado] || ''}">${p.estado}</span></td>
                        <td>${p.hora_inicio ? new Date(p.hora_inicio).toLocaleString('es-CL') : '-'}</td>
                        <td>${p.hora_fin ? new Date(p.hora_fin).toLocaleString('es-CL') : '-'}</td>
                    </tr>`;
                }).join('')}</tbody></table>`}
            `;
            document.getElementById('prodPasosModal').classList.add('show');
        } catch(e) { alert('Error al cargar pasos: ' + e.message); }
    },

    hidePasosModal() { document.getElementById('prodPasosModal').classList.remove('show'); },

    showImportModal() { document.getElementById('prodImportModal').classList.add('show'); this.selectedImportFile = null; },
    hideImportModal() { document.getElementById('prodImportModal').classList.remove('show'); this.selectedImportFile = null; document.getElementById('prodImportName').style.display = 'none'; document.getElementById('prodImportBtn').disabled = true; },

    showNewOrderModal() {
        document.getElementById('newOrdPedido').value = '';
        document.getElementById('newOrdItem').value = '1';
        document.getElementById('newOrdCliente').value = '';
        document.getElementById('newOrdCodigo').value = '';
        document.getElementById('newOrdDescripcion').value = '';
        document.getElementById('newOrdAncho').value = '0';
        document.getElementById('newOrdAlto').value = '0';
        document.getElementById('newOrdPerforaciones').value = '0';
        document.getElementById('newOrdPintado').value = '0';
        document.getElementById('newOrdTipoVenta').value = 'Normal';
        document.getElementById('newOrdCantidad').value = '1';
        document.getElementById('newOrdFechaCreacion').value = new Date().toISOString().split('T')[0];
        document.getElementById('prodNewOrderModal').classList.add('show');
    },
    hideNewOrderModal() { document.getElementById('prodNewOrderModal').classList.remove('show'); },

    async saveNewOrder() {
        const pedido = document.getElementById('newOrdPedido').value.trim();
        const item = Number(document.getElementById('newOrdItem').value) || 1;
        const cliente = document.getElementById('newOrdCliente').value.trim();
        const codigo = document.getElementById('newOrdCodigo').value.trim();
        const descripcion = document.getElementById('newOrdDescripcion').value.trim();
        const ancho = Number(document.getElementById('newOrdAncho').value) || 0;
        const alto = Number(document.getElementById('newOrdAlto').value) || 0;
        const perforaciones = document.getElementById('newOrdPerforaciones').value === '1';
        const pintado = document.getElementById('newOrdPintado').value === '1';
        const tipo_venta = document.getElementById('newOrdTipoVenta').value;
        const cantidad = Number(document.getElementById('newOrdCantidad').value) || 1;
        const fecha_creacion = document.getElementById('newOrdFechaCreacion').value || null;
        if (!pedido || !codigo || !ancho || !alto) { alert('Pedido, codigo, ancho y alto son requeridos'); return; }
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const headers = { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' };
            const res = await fetch('/api/produccion/ordenes', {
                method: 'POST', headers,
                body: JSON.stringify({ pedido_sap_id: pedido, item_numero: item, cliente, codigo_producto: codigo, descripcion, ancho, alto, perforaciones, pintado, tipo_venta, cantidad, fecha_creacion })
            });
            const data = await res.json();
            if (res.ok) {
                App.toast(`Orden ${data.codigo_producto} creada`);
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
