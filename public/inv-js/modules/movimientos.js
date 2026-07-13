const InvMovimientos = {
    tipoMovimiento: '',
    tipoSalida: '',
    allMovimientos: [],
    tiposCristal: [],
    espesores: [],

    async render() {
        const page = document.querySelector('.page.active');
        page.innerHTML = '<div class="empty-state"><p>Cargando...</p></div>';
        
        try {
            // Cargar catálogos y movimientos en paralelo
            const [movimientos, tiposCristal, espesores] = await Promise.all([
                api.inv().getMovimientos(),
                api.catalogos.getTiposCristal(),
                api.catalogos.getEspesores()
            ]);
            
            this.allMovimientos = movimientos;
            this.tiposCristal = tiposCristal;
            this.espesores = espesores;

            page.innerHTML = `
                <div class="card" style="margin-bottom:20px;">
                    <div class="card-header">Nuevo Movimiento</div>
                    <div class="card-body">
                        <form onsubmit="InvMovimientos.guardar(event)">
                            <div class="form-group">
                                <label>Tipo de Movimiento *</label>
                                <div style="display:flex; gap:12px;">
                                    <label class="tipo-btn" id="btnEntrada" onclick="InvMovimientos.setTipo('entrada')">➕ Entrada</label>
                                    <label class="tipo-btn" id="btnSalida" onclick="InvMovimientos.setTipo('salida')">➖ Salida</label>
                                </div>
                            </div>
                            <div class="form-group" id="tipoSalidaGroup" style="display:none;">
                                <label>Tipo de Salida *</label>
                                <div style="display:flex; gap:12px;">
                                    <label class="tipo-btn" id="btnPlancha" onclick="InvMovimientos.setTipoSalida('plancha_completa')">Plancha Completa</label>
                                    <label class="tipo-btn" id="btnTrozo" onclick="InvMovimientos.setTipoSalida('trozo')">Trozo</label>
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="tipoCristal">Tipo de Cristal *</label>
                                    <select id="tipoCristal" class="form-control" required>
                                        <option value="">Seleccionar...</option>
                                        ${tiposCristal.map(t => `<option value="${this.escapeHtml(t.nombre)}">${this.escapeHtml(t.nombre)}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="espesor">Espesor (mm) *</label>
                                    <select id="espesor" class="form-control" required>
                                        <option value="">Seleccionar...</option>
                                        ${espesores.map(e => `<option value="${e.valor}">${e.valor} mm</option>`).join('')}
                                    </select>
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="ancho">Ancho (mm) *</label>
                                    <input type="number" id="ancho" class="form-control" placeholder="ej: 2000" required min="1" step="1" oninput="InvMovimientos.calcM2()">
                                </div>
                                <div class="form-group">
                                    <label for="alto">Alto (mm) *</label>
                                    <input type="number" id="alto" class="form-control" placeholder="ej: 1500" required min="1" step="1" oninput="InvMovimientos.calcM2()">
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="cantidadPlanchas">Cantidad de Planchas *</label>
                                    <input type="number" id="cantidadPlanchas" class="form-control" placeholder="ej: 5" required min="1" step="1" oninput="InvMovimientos.calcM2()">
                                </div>
                                <div class="form-group">
                                    <label>Metros Cuadrados</label>
                                    <div id="m2Display" style="padding:12px; background:var(--gray-50); border:1px solid var(--gray-200); border-radius:8px; font-size:20px; font-weight:700; color:var(--primary);">0.00 m²</div>
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="proveedor">Proveedor (opcional)</label>
                                    <input type="text" id="proveedor" class="form-control" placeholder="Nombre del proveedor">
                                </div>
                                <div class="form-group"></div>
                            </div>
                            <div class="form-group">
                                <label for="observaciones">Observaciones (opcional)</label>
                                <textarea id="observaciones" class="form-control" rows="2" placeholder="Notas..."></textarea>
                            </div>
                            <button type="submit" class="btn btn-primary" style="width:100%;">Registrar Movimiento</button>
                        </form>
                    </div>
                </div>
                <div class="filters-bar">
                    <span style="font-weight:500; color:var(--gray-700); font-size:13px;">Filtrar:</span>
                    <select onchange="InvMovimientos.filtrar(this.value)" class="form-control" style="width:auto; min-height:32px; padding:4px 32px 4px 12px; font-size:13px;">
                        <option value="">Todos</option>
                        <option value="entrada">Entradas</option>
                        <option value="salida">Salidas</option>
                    </select>
                </div>
                <div class="card">
                    <div class="card-header">Movimientos <span style="color:var(--gray-500); font-weight:400; font-size:13px;">(${movimientos.length})</span></div>
                    <div class="card-body">
                        ${movimientos.length === 0 ? '<div class="empty-state"><p>No hay movimientos</p></div>' : `
                            <div class="table-responsive">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Fecha</th>
                                            <th>Tipo</th>
                                            <th>Cristal</th>
                                            <th>Espesor</th>
                                            <th>Dimensiones</th>
                                            <th>Cantidad</th>
                                            <th>m²</th>
                                            <th>Proveedor</th>
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody id="invMovBody">${this.renderRows(movimientos)}</tbody>
                                </table>
                            </div>
                        `}
                    </div>
                </div>`;
        } catch(err) { 
            page.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`; 
        }
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    renderRows(movs) {
        return movs.map(m => {
            const fecha = new Date(m.fecha_hora);
            const fechaStr = fecha.toLocaleDateString('es-CL');
            const horaStr = fecha.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
            return `
            <tr>
                <td>${fechaStr}<br><small style="color:var(--gray-500);">${horaStr}</small></td>
                <td>
                    <span class="badge ${m.tipo_movimiento === 'entrada' ? 'badge-entrada' : 'badge-salida'}">${m.tipo_movimiento}</span>
                    ${m.tipo_salida ? `<span class="badge badge-trozo" style="margin-left:4px;">${m.tipo_salida === 'trozo' ? 'Trozo' : 'Plancha'}</span>` : ''}
                </td>
                <td>${this.escapeHtml(m.tipo_cristal)}</td>
                <td>${m.espesor}mm</td>
                <td>${parseInt(m.ancho)} x ${parseInt(m.alto)} mm</td>
                <td>${m.cantidad_planchas}</td>
                <td>${Number(m.metros_cuadrados).toFixed(2)}</td>
                <td>${m.proveedor || '-'}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="InvMovimientos.eliminar(${m.id})">Eliminar</button>
                </td>
            </tr>`;
        }).join('');
    },

    setTipo(t) {
        this.tipoMovimiento = t;
        document.getElementById('btnEntrada').className = t === 'entrada' ? 'tipo-btn active-success' : 'tipo-btn';
        document.getElementById('btnSalida').className = t === 'salida' ? 'tipo-btn active-danger' : 'tipo-btn';
        document.getElementById('tipoSalidaGroup').style.display = t === 'salida' ? 'block' : 'none';
    },

    setTipoSalida(t) {
        this.tipoSalida = t;
        document.getElementById('btnPlancha').className = t === 'plancha_completa' ? 'tipo-btn active-primary' : 'tipo-btn';
        document.getElementById('btnTrozo').className = t === 'trozo' ? 'tipo-btn active-warning' : 'tipo-btn';
    },

    calcM2() {
        const a = parseInt(document.getElementById('ancho').value) || 0;
        const b = parseInt(document.getElementById('alto').value) || 0;
        const c = parseInt(document.getElementById('cantidadPlanchas').value) || 0;
        document.getElementById('m2Display').textContent = ((a * b * c) / 1000000).toFixed(2) + ' m²';
    },

    async guardar(e) {
        e.preventDefault();
        
        if (!this.tipoMovimiento) { 
            App.toast('Selecciona tipo de movimiento', 'error'); 
            return; 
        }
        
        if (this.tipoMovimiento === 'salida' && !this.tipoSalida) { 
            App.toast('Selecciona tipo de salida', 'error'); 
            return; 
        }

        // Validar dimensiones como enteros
        const ancho = document.getElementById('ancho').value;
        const alto = document.getElementById('alto').value;
        const cantidad = document.getElementById('cantidadPlanchas').value;

        if (!Number.isInteger(Number(ancho)) || Number(ancho) <= 0) {
            App.toast('El ancho debe ser un número entero positivo', 'error');
            return;
        }
        if (!Number.isInteger(Number(alto)) || Number(alto) <= 0) {
            App.toast('El alto debe ser un número entero positivo', 'error');
            return;
        }
        if (!Number.isInteger(Number(cantidad)) || Number(cantidad) <= 0) {
            App.toast('La cantidad debe ser un número entero positivo', 'error');
            return;
        }

        try {
            // Obtener fecha y hora actual del sistema
            const now = new Date();
            const fechaHora = now.toISOString();
            
            await api.inv().crearMovimiento({
                tipo_movimiento: this.tipoMovimiento,
                tipo_cristal: document.getElementById('tipoCristal').value,
                espesor: parseInt(document.getElementById('espesor').value),
                ancho: parseInt(ancho),
                alto: parseInt(alto),
                cantidad_planchas: parseInt(cantidad),
                proveedor: document.getElementById('proveedor').value || null,
                tipo_salida: this.tipoMovimiento === 'salida' ? this.tipoSalida : null,
                observaciones: document.getElementById('observaciones').value || null,
                fecha_hora: fechaHora
            });
            App.toast('Movimiento registrado');
            this.tipoMovimiento = '';
            this.tipoSalida = '';
            this.render();
        } catch(err) { 
            App.toast('Error: ' + err.message, 'error'); 
        }
    },

    async eliminar(id) {
        if (!confirm('¿Eliminar este movimiento?')) return;
        try { 
            await api.inv().eliminarMovimiento(id); 
            App.toast('Eliminado'); 
            this.render(); 
        } catch(err) { 
            App.toast('Error: ' + err.message, 'error'); 
        }
    },

    async filtrar(tipo) {
        const tbody = document.getElementById('invMovBody');
        if (!tbody) return;
        
        let filtered = this.allMovimientos;
        if (tipo) filtered = filtered.filter(m => m.tipo_movimiento === tipo);
        tbody.innerHTML = this.renderRows(filtered);
    }
};
