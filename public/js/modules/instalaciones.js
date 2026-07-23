App.registerModule('instalaciones', {
    instalaciones: [],
    selectedInst: null,
    selectedFotos: [],
    calInicio: null,
    calFin: null,
    calModo: 'semana',

    init() {
        const hoy = new Date();
        const dia = hoy.getDay();
        const diffLunes = dia === 0 ? -6 : 1 - dia;
        this.calInicio = new Date(hoy);
        this.calInicio.setDate(hoy.getDate() + diffLunes);
        this.calFin = new Date(this.calInicio);
        this.calFin.setDate(this.calInicio.getDate() + 6);
    },

    fmtDate(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },

    async render() {
        if (!this.calInicio) this.init();
        const el = document.getElementById('page-instalaciones');
        el.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
                <div><h2 style="margin:0">Instalaciones</h2><div class="subtitle">Gestion de trabajos en terreno</div></div>
                <div style="display:flex;gap:8px">
                    <button class="btn btn-primary" onclick="App.modules.instalaciones.showForm()">+ Nueva Instalacion</button>
                </div>
            </div>
            <div id="instStats" style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px"></div>
            <div id="instCalendario"></div>
            <div id="instDetalle" style="display:none"></div>
        `;
        await this.loadData();
    },

    async loadData() {
        const inicio = this.fmtDate(this.calInicio);
        const fin = this.fmtDate(this.calFin);
        try {
            const res = await fetch(`/api/instalaciones/calendario?inicio=${inicio}&fin=${fin}`);
            this.instalaciones = await res.json();
            this.renderStats();
            this.renderCalendario();
        } catch(e) { console.error('Error cargando instalaciones:', e); }
    },

    renderStats() {
        const total = this.instalaciones.length;
        const prog = this.instalaciones.filter(i => i.estado === 'PROGRAMADA').length;
        const curso = this.instalaciones.filter(i => i.estado === 'EN_CURSO' || i.estado === 'EN_CAMINO').length;
        const comp = this.instalaciones.filter(i => i.estado === 'COMPLETADA').length;
        const nov = this.instalaciones.filter(i => i.estado === 'CON_NOVEDADES' || i.estado === 'CANCELADA').length;
        document.getElementById('instStats').innerHTML = `
            <div class="card" style="text-align:center;padding:12px"><div style="font-size:24px;font-weight:700;color:var(--primary)">${total}</div><div style="font-size:11px;color:var(--text-light)">Total</div></div>
            <div class="card" style="text-align:center;padding:12px"><div style="font-size:24px;font-weight:700;color:#3b82f6">${prog}</div><div style="font-size:11px;color:var(--text-light)">Programadas</div></div>
            <div class="card" style="text-align:center;padding:12px"><div style="font-size:24px;font-weight:700;color:#f59e0b">${curso}</div><div style="font-size:11px;color:var(--text-light)">En Curso</div></div>
            <div class="card" style="text-align:center;padding:12px"><div style="font-size:24px;font-weight:700;color:#22c55e">${comp}</div><div style="font-size:11px;color:var(--text-light)">Completadas</div></div>
            <div class="card" style="text-align:center;padding:12px"><div style="font-size:24px;font-weight:700;color:#ef4444">${nov}</div><div style="font-size:11px;color:var(--text-light)">Novedades</div></div>
        `;
    },

    renderCalendario() {
        const div = document.getElementById('instCalendario');
        const diasSemana = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
        const fechas = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(this.calInicio);
            d.setDate(this.calInicio.getDate() + i);
            fechas.push(d);
        }
        const estadoColor = (e) => {
            if (e === 'COMPLETADA') return '#22c55e';
            if (e === 'EN_CURSO' || e === 'EN_CAMINO') return '#f59e0b';
            if (e === 'CON_NOVEDADES') return '#ef4444';
            if (e === 'CANCELADA') return '#94a3b8';
            return '#3b82f6';
        };
        const estadoIcon = (e) => {
            if (e === 'COMPLETADA') return '✓';
            if (e === 'EN_CURSO') return '⚙';
            if (e === 'EN_CAMINO') return '🚗';
            if (e === 'CON_NOVEDADES') return '⚠';
            if (e === 'CANCELADA') return '✕';
            return '📅';
        };
        let html = `
            <div class="card">
                <div class="card-header" style="justify-content:space-between">
                    <h3 style="margin:0">Calendario de Instalaciones</h3>
                    <div style="display:flex;gap:8px;align-items:center">
                        <button class="btn btn-sm btn-outline" onclick="App.modules.instalaciones.cambiarSemana(-1)">◀</button>
                        <strong style="font-size:13px">${this.fmtDate(this.calInicio)} al ${this.fmtDate(fechas[6])}</strong>
                        <button class="btn btn-sm btn-outline" onclick="App.modules.instalaciones.cambiarSemana(1)">▶</button>
                    </div>
                </div>
                <div class="card-body" style="padding:0">
                    <div style="display:grid;grid-template-columns:repeat(7,1fr);min-height:400px">
        `;
        for (let i = 0; i < 7; i++) {
            const fs = this.fmtDate(fechas[i]);
            const instDia = this.instalaciones.filter(inst => inst.fecha_programada && inst.fecha_programada.substring(0, 10) === fs);
            const esHoy = fs === this.fmtDate(new Date());
            html += `
                <div style="border-right:1px solid var(--border);${i === 6 ? 'border-right:none' : ''}">
                    <div style="padding:8px;text-align:center;border-bottom:1px solid var(--border);${esHoy ? 'background:var(--primary);color:#fff' : ''}">
                        <div style="font-weight:600;font-size:12px">${diasSemana[i]}</div>
                        <div style="font-size:18px;font-weight:700">${fechas[i].getDate()}</div>
                    </div>
                    <div style="padding:4px;min-height:350px">
            `;
            for (const inst of instDia) {
                const color = estadoColor(inst.estado);
                html += `
                    <div onclick="App.modules.instalaciones.verDetalle(${inst.id})" style="cursor:pointer;margin:2px 0;padding:6px 8px;border-radius:6px;border-left:3px solid ${color};background:var(--card-bg);font-size:11px;transition:all .15s" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                        <div style="font-weight:600;color:${color}">${estadoIcon(inst.estado)} ${inst.hora_programada || '09:00'}</div>
                        <div style="font-weight:600;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(inst.cliente)}</div>
                        <div style="color:var(--text-light);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(inst.tecnico || '-')}</div>
                    </div>
                `;
            }
            if (instDia.length === 0) html += '<div style="text-align:center;padding:20px;color:var(--text-light);font-size:11px">Sin instalaciones</div>';
            html += `</div></div>`;
        }
        html += `</div></div></div>`;
        div.innerHTML = html;
    },

    cambiarSemana(dir) {
        this.calInicio.setDate(this.calInicio.getDate() + (dir * 7));
        this.calFin.setDate(this.calFin.getDate() + (dir * 7));
        this.loadData();
    },

    showForm(id) {
        const inst = id ? this.instalaciones.find(i => i.id === id) : null;
        const hoy = this.fmtDate(new Date());
        App.showModal(`
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group"><label>Cliente *</label><input class="form-control" id="instCliente" value="${inst ? escapeHtml(inst.cliente) : ''}" placeholder="Nombre del cliente" style="text-transform:uppercase"></div>
                <div class="form-group"><label>Tecnico Asignado</label><input class="form-control" id="instTecnico" value="${inst ? escapeHtml(inst.tecnico) : ''}" placeholder="Nombre del tecnico" style="text-transform:capitalize"></div>
            </div>
            <div class="form-group"><label>Direccion *</label><input class="form-control" id="instDireccion" value="${inst ? escapeHtml(inst.direccion) : ''}" placeholder="Direccion de la instalacion" style="text-transform:capitalize"></div>
            <div class="form-group"><label>Descripcion</label><textarea class="form-control" id="instDescripcion" rows="2" placeholder="Detalle de vidrios o estructuras a instalar" style="text-transform:capitalize">${inst ? escapeHtml(inst.descripcion) : ''}</textarea></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group"><label>Fecha Programada *</label><input type="date" class="form-control" id="instFecha" value="${inst ? inst.fecha_programada.substring(0, 10) : hoy}"></div>
                <div class="form-group"><label>Hora</label><input type="time" class="form-control" id="instHora" value="${inst ? inst.hora_programada : '09:00'}"></div>
            </div>
            <div class="form-group"><label>Notas Previas</label><textarea class="form-control" id="instNotas" rows="2" placeholder="Notas o instrucciones previas" style="text-transform:capitalize">${inst ? escapeHtml(inst.notas_previas) : ''}</textarea></div>
        `, { title: inst ? 'Editar Instalacion' : 'Nueva Instalacion' });
        document.querySelector('#modalOverlay .modal-footer').innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.instalaciones.guardar(${id || 0})">${inst ? 'Actualizar' : 'Crear'}</button>
        `;
    },

    async guardar(id) {
        const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
        const data = {
            cliente: document.getElementById('instCliente').value.trim().toUpperCase(),
            direccion: capitalize(document.getElementById('instDireccion').value.trim()),
            descripcion: capitalize(document.getElementById('instDescripcion').value.trim()),
            fecha_programada: document.getElementById('instFecha').value,
            hora_programada: document.getElementById('instHora').value,
            tecnico: capitalize(document.getElementById('instTecnico').value.trim()),
            notas_previas: capitalize(document.getElementById('instNotas').value.trim())
        };
        if (!data.cliente || !data.direccion || !data.fecha_programada) { App.showAlert('Cliente, direccion y fecha requeridos', 'danger'); return; }
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const headers = { 'Content-Type': 'application/json', 'X-User-Email': user.email || '' };
        try {
            if (id === 0) {
                await fetch('/api/instalaciones', { method: 'POST', headers, body: JSON.stringify(data) });
                App.showAlert('Instalacion creada');
            } else {
                await fetch(`/api/instalaciones/${id}`, { method: 'PUT', headers, body: JSON.stringify(data) });
                App.showAlert('Instalacion actualizada');
            }
            App.hideModal();
            await this.loadData();
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    async verDetalle(id) {
        try {
            const [instRes, histRes, fotosRes] = await Promise.all([
                fetch(`/api/instalaciones/${id}`),
                fetch(`/api/instalaciones/${id}/historial`),
                fetch(`/api/instalaciones/${id}/fotos`)
            ]);
            const inst = await instRes.json();
            const historial = await histRes.json();
            const fotos = await fotosRes.json();
            this.selectedInst = inst;
            const estadoColor = { 'PROGRAMADA': '#3b82f6', 'EN_CAMINO': '#f59e0b', 'EN_CURSO': '#f59e0b', 'COMPLETADA': '#22c55e', 'CON_NOVEDADES': '#ef4444', 'CANCELADA': '#94a3b8' };
            const color = estadoColor[inst.estado] || '#3b82f6';
            const div = document.getElementById('instDetalle');
            div.style.display = 'block';
            div.innerHTML = `
                <div class="card" style="margin-top:16px">
                    <div class="card-header" style="justify-content:space-between">
                        <div style="display:flex;align-items:center;gap:12px">
                            <h3 style="margin:0">Instalacion #${inst.id}</h3>
                            <span style="background:${color};color:#fff;padding:4px 12px;border-radius:6px;font-size:12px;font-weight:600">${inst.estado}</span>
                        </div>
                        <div style="display:flex;gap:8px">
                            ${inst.estado === 'PROGRAMADA' ? `<button class="btn btn-sm" style="background:#f59e0b;color:#fff" onclick="App.modules.instalaciones.cambiarEstado(${id},'EN_CAMINO')">🚗 En Camino</button>` : ''}
                            ${inst.estado === 'EN_CAMINO' ? `<button class="btn btn-sm" style="background:#f59e0b;color:#fff" onclick="App.modules.instalaciones.cambiarEstado(${id},'EN_CURSO')">⚙ En Curso</button>` : ''}
                            ${inst.estado === 'EN_CURSO' ? `<button class="btn btn-sm" style="background:#22c55e;color:#fff" onclick="App.modules.instalaciones.showCerrar(${id})">✓ Completar</button>` : ''}
                            ${inst.estado === 'EN_CURSO' ? `<button class="btn btn-sm" style="background:#ef4444;color:#fff" onclick="App.modules.instalaciones.showNovedad(${id})">⚠ Novedad</button>` : ''}
                            ${inst.estado === 'CON_NOVEDADES' ? `<button class="btn btn-sm" style="background:#f59e0b;color:#fff" onclick="App.modules.instalaciones.cambiarEstado(${id},'EN_CURSO')">↩ Reanudar</button>` : ''}
                            <button class="btn btn-sm btn-outline" onclick="document.getElementById('instDetalle').style.display='none'">✕ Cerrar</button>
                        </div>
                    </div>
                    <div class="card-body">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
                            <div><strong>Cliente:</strong> ${escapeHtml(inst.cliente)}</div>
                            <div><strong>Tecnico:</strong> ${escapeHtml(inst.tecnico || '-')}</div>
                            <div><strong>Direccion:</strong> ${escapeHtml(inst.direccion)}</div>
                            <div><strong>Fecha:</strong> ${inst.fecha_programada ? inst.fecha_programada.substring(0, 10) : '-'} ${inst.hora_programada || ''}</div>
                            <div style="grid-column:1/-1"><strong>Descripcion:</strong> ${escapeHtml(inst.descripcion || '-')}</div>
                            <div style="grid-column:1/-1"><strong>Notas Previas:</strong> ${escapeHtml(inst.notas_previas || '-')}</div>
                            ${inst.notas_cierre ? `<div style="grid-column:1/-1"><strong>Notas Cierre:</strong> ${escapeHtml(inst.notas_cierre)}</div>` : ''}
                        </div>
                        ${fotos.length > 0 ? `
                            <h4 style="margin:12px 0 8px">Fotografias (${fotos.length})</h4>
                            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
                                ${fotos.map(f => `<img src="/api/instalaciones/${id}/foto/${f.id}" style="width:120px;height:90px;object-fit:cover;border-radius:8px;cursor:pointer" onclick="App.modules.instalaciones.verFoto(${id},${f.id})" title="${escapeHtml(f.descripcion || '')}">`).join('')}
                            </div>
                        ` : ''}
                        ${inst.estado === 'EN_CURSO' || inst.estado === 'COMPLETADA' ? `
                            <h4 style="margin:12px 0 8px">Subir Fotos</h4>
                            <div style="display:flex;gap:8px;align-items:center;margin-bottom:16px">
                                <input type="file" id="instFotoInput" accept="image/*" multiple onchange="App.modules.instalaciones.prepFotos()" style="font-size:13px">
                                <button class="btn btn-sm btn-primary" onclick="App.modules.instalaciones.subirFotos(${id})">Subir</button>
                            </div>
                        ` : ''}
                        <h4 style="margin:12px 0 8px">Historial</h4>
                        <div style="max-height:200px;overflow-y:auto">
                            ${historial.map(h => `
                                <div style="display:flex;gap:12px;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
                                    <span style="color:var(--text-light);min-width:140px">${h.created_at ? new Date(h.created_at).toLocaleString('es-CL') : '-'}</span>
                                    <span style="font-weight:600;min-width:120px">${h.accion}</span>
                                    <span>${escapeHtml(h.detalle || '')}</span>
                                    <span style="color:var(--text-light);margin-left:auto">${escapeHtml(h.usuario)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
            div.scrollIntoView({ behavior: 'smooth' });
        } catch(e) { App.showAlert('Error cargando detalle', 'danger'); }
    },

    async cambiarEstado(id, estado) {
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        try {
            await fetch(`/api/instalaciones/${id}/estado`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-User-Email': user.email || '' },
                body: JSON.stringify({ estado })
            });
            App.showAlert('Estado actualizado');
            await this.loadData();
            await this.verDetalle(id);
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    showCerrar(id) {
        App.showModal(`
            <div class="form-group"><label>Notas de Cierre</label><textarea class="form-control" id="instCierreNotas" rows="3" placeholder="Observaciones finales de la instalacion" style="text-transform:capitalize"></textarea></div>
            <div class="form-group"><label>Firma / Conformidad Cliente</label><input class="form-control" id="instCierreFirma" placeholder="Nombre de quien recibe" style="text-transform:capitalize"></div>
        `, { title: 'Cerrar Instalacion #' + id });
        document.querySelector('#modalOverlay .modal-footer').innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.instalaciones.cerrar(${id})">Completar Instalacion</button>
        `;
    },

    showNovedad(id) {
        App.showModal(`
            <div class="form-group"><label>Descripcion de la Novedad *</label><textarea class="form-control" id="instNovedadDesc" rows="4" placeholder="Describe que sucedio: material dañado, falta de insumos, problema en terreno, etc." style="text-transform:capitalize"></textarea></div>
            <div class="form-group"><label>Fotos de la Novedad (opcional)</label><input type="file" id="instNovedadFotos" accept="image/*" multiple style="font-size:13px"></div>
        `, { title: 'Registrar Novedad #' + id });
        document.querySelector('#modalOverlay .modal-footer').innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-danger" onclick="App.modules.instalaciones.registrarNovedad(${id})">Registrar Novedad</button>
        `;
    },

    async registrarNovedad(id) {
        const desc = document.getElementById('instNovedadDesc').value.trim();
        if (!desc) { App.showAlert('Describe la novedad', 'danger'); return; }
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const headers = { 'Content-Type': 'application/json', 'X-User-Email': user.email || '' };
        try {
            await fetch(`/api/instalaciones/${id}/estado`, {
                method: 'PUT', headers,
                body: JSON.stringify({ estado: 'CON_NOVEDADES', detalle: desc })
            });
            const fotosInput = document.getElementById('instNovedadFotos');
            if (fotosInput && fotosInput.files.length > 0) {
                const fotos = [];
                for (const file of fotosInput.files) {
                    const base64 = await new Promise(r => { const reader = new FileReader(); reader.onload = () => r(reader.result); reader.readAsDataURL(file); });
                    fotos.push({ base64, descripcion: '[Novedad] ' + file.name });
                }
                await fetch(`/api/instalaciones/${id}/fotos`, { method: 'POST', headers, body: JSON.stringify({ fotos }) });
            }
            App.hideModal();
            App.showAlert('Novedad registrada');
            await this.loadData();
            await this.verDetalle(id);
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    async cerrar(id) {
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
        const data = {
            notas_cierre: capitalize(document.getElementById('instCierreNotas').value.trim()),
            firma_cliente: capitalize(document.getElementById('instCierreFirma').value.trim())
        };
        try {
            await fetch(`/api/instalaciones/${id}/cerrar`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-User-Email': user.email || '' },
                body: JSON.stringify(data)
            });
            App.hideModal();
            App.showAlert('Instalacion completada');
            await this.loadData();
            await this.verDetalle(id);
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    prepFotos() {
        const input = document.getElementById('instFotoInput');
        this.selectedFotos = Array.from(input.files);
    },

    async subirFotos(id) {
        if (this.selectedFotos.length === 0) { App.showAlert('Selecciona al menos una foto', 'danger'); return; }
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const fotos = [];
        for (const file of this.selectedFotos) {
            const base64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });
            fotos.push({ base64, descripcion: file.name });
        }
        try {
            await fetch(`/api/instalaciones/${id}/fotos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Email': user.email || '' },
                body: JSON.stringify({ fotos })
            });
            App.showAlert(fotos.length + ' foto(s) subida(s)');
            this.selectedFotos = [];
            await this.verDetalle(id);
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    verFoto(instId, fotoId) {
        const w = window.open('', '_blank');
        w.document.write(`<html><body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#111"><img src="/api/instalaciones/${instId}/foto/${fotoId}" style="max-width:100%;max-height:100vh"></body></html>`);
    }
});
