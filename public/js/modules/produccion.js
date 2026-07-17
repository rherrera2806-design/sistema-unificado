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
                ${puedeImportar ? '<button class="btn btn-primary" onclick="App.modules.produccion.showImportModal()">+ Importar SAP</button>' : ''}
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
                        </select>
                    </div>
                </div>
                <div class="card-body" style="padding:0">
                    <table><thead><tr>
                        <th>Pedido</th><th>Cliente</th><th>Codigo</th><th>Dimensiones</th><th>m2</th><th>Ruta</th><th>Estado</th><th>Acciones</th>
                    </tr></thead><tbody id="prodTable">
                        <tr><td colspan="8" style="text-align:center;padding:24px;color:#64748b">Cargando...</td></tr>
                    </tbody></table>
                </div>
            </div>

            <div class="modal-overlay" id="prodImportModal">
                <div class="modal" style="max-width:500px">
                    <div class="modal-header"><h3>Importar desde SAP</h3><button class="modal-close" onclick="App.modules.produccion.hideImportModal()">&times;</button></div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label style="font-weight:500">Archivo Excel de SAP</label>
                            <div id="prodImportArea" style="border:2px dashed #cbd5e1;border-radius:8px;padding:32px;text-align:center;cursor:pointer;transition:all .2s"
                                 onclick="document.getElementById('prodImportFile').click()">
                                <div style="font-size:32px;margin-bottom:8px">📊</div>
                                <div style="color:var(--text-light)">Arrastra un Excel o haz clic para seleccionar</div>
                                <div id="prodImportName" style="color:var(--success);font-weight:500;margin-top:8px;display:none"></div>
                            </div>
                            <input type="file" id="prodImportFile" accept=".xlsx,.xls,.csv" style="display:none" onchange="App.modules.produccion.handleImportFile(event)">
                        </div>
                        <div style="background:#f8fafc;border-radius:8px;padding:12px;margin-top:12px;font-size:12px;color:var(--text-light)">
                            <strong>Columnas esperadas del Excel:</strong><br>
                            Codigo, Pedido, Cliente, Descripcion, Ancho, Alto, Perforaciones (0/1), Familia
                        </div>
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

            <div class="modal-overlay" id="prodMaquinaModal">
                <div class="modal" style="max-width:400px">
                    <div class="modal-header"><h3>Nueva Maquina</h3><button class="modal-close" onclick="App.modules.produccion.hideMaquinaModal()">&times;</button></div>
                    <div class="modal-body">
                        <div class="form-group"><label>Nombre</label><input class="form-control" id="prodMaqNombre" placeholder="Ej: Cortadora 1"></div>
                        <div class="form-group"><label>Codigo</label><input class="form-control" id="prodMaqCodigo" placeholder="Ej: COR-01"></div>
                        <div class="form-group"><label>Capacidad Max m2/dia</label><input class="form-control" id="prodMaqCapacidad" type="number" step="0.01" value="0"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="App.modules.produccion.hideMaquinaModal()">Cancelar</button>
                        <button class="btn btn-primary" onclick="App.modules.produccion.saveMaquina()">Guardar</button>
                    </div>
                </div>
            </div>

            <div class="modal-overlay" id="prodRecetaModal">
                <div class="modal" style="max-width:500px">
                    <div class="modal-header"><h3>Nueva Receta BOM</h3><button class="modal-close" onclick="App.modules.produccion.hideRecetaModal()">&times;</button></div>
                    <div class="modal-body">
                        <div class="form-group"><label>Codigo SAP Padre</label><input class="form-control" id="prodRecCodigoPadre" placeholder="Ej: 500"></div>
                        <div class="form-group"><label>Codigo Materia Prima</label><input class="form-control" id="prodRecCodigoMP" placeholder="Ej: VID-4MM"></div>
                        <div class="form-group"><label>Descripcion</label><input class="form-control" id="prodRecDescripcion" placeholder="Vidrio 4mm templado"></div>
                        <div class="form-group"><label>Espesor (mm)</label><input class="form-control" id="prodRecEspesor" type="number" value="4"></div>
                        <div class="form-group"><label>Cantidad</label><input class="form-control" id="prodRecCantidad" type="number" value="1"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="App.modules.produccion.hideRecetaModal()">Cancelar</button>
                        <button class="btn btn-primary" onclick="App.modules.produccion.saveReceta()">Guardar</button>
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
        if (!ordenes.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:#64748b">No hay ordenes de produccion</td></tr>'; return; }

        const estadoBadge = (e) => {
            if (e === 'TERMINADO') return '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:#dcfce7;color:#166534">✓ TERMINADO</span>';
            if (e === 'EN_PROCESO') return '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:#dbeafe;color:#1e40af">⚙ EN PROCESO</span>';
            if (e === 'MERMADO') return '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:#fee2e2;color:#991b1b">✗ MERMADO</span>';
            return '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:#fef9c3;color:#854d0e">⏳ PENDIENTE</span>';
        };

        tbody.innerHTML = ordenes.map(o => {
            const progreso = o.total_pasos > 0 ? `${o.pasos_terminados}/${o.total_pasos}` : '-';
            return `<tr>
                <td><strong>${o.pedido_sap_id || '-'}</strong></td>
                <td>${o.cliente || '-'}</td>
                <td><strong>${o.codigo_producto}</strong>${o.es_compuesto ? ' <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:#ede9fe;color:#7c3aed">BOM</span>' : ''}</td>
                <td>${o.ancho} x ${o.alto} mm</td>
                <td>${o.metros_cuadrados ? Number(o.metros_cuadrados).toFixed(2) : '-'}</td>
                <td>${progreso}</td>
                <td>${estadoBadge(o.estado_programacion)}</td>
                <td><button class="btn btn-sm btn-outline" onclick="App.modules.produccion.verPasos(${o.id})">Ver Pasos</button></td>
            </tr>`;
        }).join('');
    },

    filter() {
        const search = (document.getElementById('prodFilterSearch')?.value || '').toLowerCase();
        const estado = document.getElementById('prodFilterEstado')?.value || 'todos';
        let filtered = this.ordenes;
        if (search) filtered = filtered.filter(o => (o.codigo_producto || '').toLowerCase().includes(search) || (o.pedido_sap_id || '').toLowerCase().includes(search) || (o.cliente || '').toLowerCase().includes(search));
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
    },

    async importar() {
        if (!this.selectedImportFile) return;
        const btn = document.getElementById('prodImportBtn');
        btn.textContent = 'Procesando...';
        btn.disabled = true;

        try {
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = () => reject(new Error('Error al leer archivo'));
                reader.readAsDataURL(this.selectedImportFile);
            });

            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const res = await fetch('/api/produccion/importar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' },
                body: JSON.stringify({ excel_data: base64, file_name: this.selectedImportFile.name })
            });

            const data = await res.json();
            if (res.ok) {
                let msg = `Importadas: ${data.importadas} ordenes, ${data.pasos_creados} pasos creados.`;
                if (data.errores && data.errores.length) msg += ` Errores: ${data.errores.length}`;
                App.toast(msg);
                this.hideImportModal();
                await this.load();
            } else {
                alert(data.error || 'Error al importar');
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
                        <td><strong>${p.estacion_nombre}</strong></td>
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

    showMaquinaModal() { document.getElementById('prodMaquinaModal').classList.add('show'); },
    hideMaquinaModal() { document.getElementById('prodMaquinaModal').classList.remove('show'); },

    async saveMaquina() {
        const nombre = document.getElementById('prodMaqNombre').value.trim();
        const codigo = document.getElementById('prodMaqCodigo').value.trim();
        const capacidad = Number(document.getElementById('prodMaqCapacidad').value) || 0;
        if (!nombre || !codigo) { alert('Nombre y codigo requeridos'); return; }
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            await fetch('/api/produccion/maquinas', {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' },
                body: JSON.stringify({ nombre, codigo, capacidad_max_m2_dia: capacidad })
            });
            this.hideMaquinaModal();
            App.toast('Maquina creada');
            await this.load();
        } catch(e) { alert('Error: ' + e.message); }
    },

    showRecetaModal() { document.getElementById('prodRecetaModal').classList.add('show'); },
    hideRecetaModal() { document.getElementById('prodRecetaModal').classList.remove('show'); },

    async saveReceta() {
        const codigo_sap_padre = document.getElementById('prodRecCodigoPadre').value.trim();
        const codigo_materia_prima = document.getElementById('prodRecCodigoMP').value.trim();
        const descripcion = document.getElementById('prodRecDescripcion').value.trim();
        const espesor = Number(document.getElementById('prodRecEspesor').value) || 0;
        const cantidad = Number(document.getElementById('prodRecCantidad').value) || 1;
        if (!codigo_sap_padre || !codigo_materia_prima) { alert('Codigos requeridos'); return; }
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            await fetch('/api/produccion/recetas', {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' },
                body: JSON.stringify({ codigo_sap_padre, codigo_materia_prima, descripcion, espesor, cantidad })
            });
            this.hideRecetaModal();
            App.toast('Receta BOM creada');
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
