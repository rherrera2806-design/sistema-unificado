App.registerModule('inst_detalle', {
    inst: null,
    historial: [],
    fotos: [],

    async render() {
        const el = document.getElementById('page-inst_detalle');
        if (!this.inst) {
            el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-light)">Selecciona una instalacion para ver el detalle</div>';
            return;
        }
        await this.cargarYRenderizar(this.inst.id);
    },

    async cargarYRenderizar(id) {
        try {
            const [instRes, histRes, fotosRes] = await Promise.all([
                fetch(`/api/instalaciones/${id}`),
                fetch(`/api/instalaciones/${id}/historial`),
                fetch(`/api/instalaciones/${id}/fotos`)
            ]);
            this.inst = await instRes.json();
            this.historial = await histRes.json();
            this.fotos = await fotosRes.json();
            this.renderDetalle();
        } catch(e) { console.error('Error cargando detalle:', e); }
    },

    async abrir(id) {
        this.inst = { id };
        App.loadModule('inst_detalle');
        await this.cargarYRenderizar(id);
    },

    renderDetalle() {
        const el = document.getElementById('page-inst_detalle');
        const inst = this.inst;
        if (!inst || !inst.id) { el.innerHTML = ''; return; }
        const estadoColor = { 'PROGRAMADA': '#3b82f6', 'EN_CAMINO': '#f59e0b', 'EN_CURSO': '#f59e0b', 'COMPLETADA': '#22c55e', 'CON_NOVEDADES': '#ef4444', 'CANCELADA': '#94a3b8' };
        const color = estadoColor[inst.estado] || '#3b82f6';
        const fecha = inst.fecha_programada ? inst.fecha_programada.substring(0, 10) : '-';
        el.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
                <div style="display:flex;align-items:center;gap:12px">
                    <button class="btn btn-sm btn-outline" onclick="App.loadModule('instalaciones')">← Volver</button>
                    <h2 style="margin:0">Instalacion #${inst.id}</h2>
                    <span style="background:${color};color:#fff;padding:4px 12px;border-radius:6px;font-size:12px;font-weight:600">${inst.estado}</span>
                </div>
                <div style="display:flex;gap:8px">
                    ${(() => { const user = JSON.parse(localStorage.getItem('unified_user') || '{}'); const p = user.permisos || []; return (p.includes('instalaciones.eliminar') || p.includes('usuarios')) ?
                        `<button class="btn btn-sm btn-primary" onclick="App.modules.inst_detalle.editarInstalacion(${inst.id})">✏️ Editar</button>
                        <button class="btn btn-sm btn-outline" style="color:#ef4444;border-color:#ef4444" onclick="App.modules.inst_detalle.eliminarInstalacion(${inst.id})">🗑️ Eliminar</button>` : ''; })()}
                    ${inst.estado === 'PROGRAMADA' ? `<button class="btn btn-sm" style="background:#f59e0b;color:#fff" onclick="App.modules.inst_detalle.cambiarEstado(${inst.id},'EN_CAMINO')">🚗 En Camino</button>` : ''}
                    ${inst.estado === 'EN_CAMINO' ? `<button class="btn btn-sm" style="background:#f59e0b;color:#fff" onclick="App.modules.inst_detalle.cambiarEstado(${inst.id},'EN_CURSO')">⚙ En Curso</button>` : ''}
                    ${inst.estado === 'EN_CURSO' ? `<button class="btn btn-sm" style="background:#22c55e;color:#fff" onclick="App.modules.inst_detalle.showCerrar(${inst.id})">✓ Completar</button>` : ''}
                    ${inst.estado === 'EN_CURSO' ? `<button class="btn btn-sm" style="background:#ef4444;color:#fff" onclick="App.modules.inst_detalle.showNovedad(${inst.id})">⚠ Novedad</button>` : ''}
                    ${inst.estado === 'CON_NOVEDADES' ? `<button class="btn btn-sm" style="background:#f59e0b;color:#fff" onclick="App.modules.inst_detalle.cambiarEstado(${inst.id},'EN_CURSO')">↩ Reanudar</button>` : ''}
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
                <div class="card"><div class="card-body">
                    <h3 style="margin:0 0 12px;font-size:16px">Informacion</h3>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px">
                        <div><strong>Cliente:</strong> ${escapeHtml(inst.cliente)}</div>
                        <div><strong>Tecnico:</strong> ${escapeHtml(inst.tecnico || '-')}</div>
                        <div><strong>Vendedor:</strong> ${escapeHtml(inst.vendedor || '-')}</div>
                        <div><strong>Orden:</strong> ${escapeHtml(inst.numero_orden || '-')}</div>
                        <div><strong>Fecha:</strong> ${fecha} ${inst.hora_programada || ''}</div>
                        <div style="grid-column:1/-1"><strong>Direccion:</strong> ${escapeHtml(inst.direccion)}
                            ${(() => { const user = JSON.parse(localStorage.getItem('unified_user') || '{}'); const p = user.permisos || []; return (p.includes('instalaciones.nueva') || p.includes('usuarios')) ?
                            `<span style="margin-left:8px;display:inline-flex;gap:4px;vertical-align:middle">
                                <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(inst.direccion)}" target="_blank" title="Google Maps" style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:4px;font-size:11px;background:#dcfce7;color:#166534;text-decoration:none;border:1px solid #bbf7d0;transition:background .15s" onmouseover="this.style.background='#bbf7d0'" onmouseout="this.style.background='#dcfce7'">📍 Maps</a>
                                <a href="https://www.waze.com/ul?q=${encodeURIComponent(inst.direccion)}" target="_blank" title="Waze" style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:4px;font-size:11px;background:#dbeafe;color:#1e40af;text-decoration:none;border:1px solid #bfdbfe;transition:background .15s" onmouseover="this.style.background='#bfdbfe'" onmouseout="this.style.background='#dbeafe'">🚗 Waze</a>
                            </span>` : ''; })()}
                        </div>
                        <div><strong>Fecha:</strong> ${fecha} ${inst.hora_programada || ''}</div>
                        <div style="grid-column:1/-1"><strong>Descripcion:</strong> ${escapeHtml(inst.descripcion || '-')}</div>
                        <div style="grid-column:1/-1"><strong>Notas Previas:</strong> ${escapeHtml(inst.notas_previas || '-')}</div>
                        ${inst.notas_cierre ? `<div style="grid-column:1/-1"><strong>Notas Cierre:</strong> ${escapeHtml(inst.notas_cierre)}</div>` : ''}
                        ${(() => {
                            if (!inst.firma_cliente) return '';
                            try {
                                const f = JSON.parse(inst.firma_cliente);
                                return `<div style="grid-column:1/-1"><strong>Firma Cliente:</strong> ${escapeHtml(f.nombre || '')}
                                    <div style="margin-top:6px"><img src="${f.firma}" style="max-width:280px;border:1px solid var(--border);border-radius:6px;background:#fff;padding:4px"></div>
                                </div>`;
                            } catch(e) {
                                return `<div style="grid-column:1/-1"><strong>Firma Cliente:</strong> ${escapeHtml(inst.firma_cliente)}</div>`;
                            }
                        })()}
                        <div><strong>Creado por:</strong> ${escapeHtml(inst.creado_por || '-')}</div>
                        <div><strong>Cerrado por:</strong> ${escapeHtml(inst.cerrado_por || '-')}</div>
                    </div>
                </div></div>
                <div class="card"><div class="card-body">
                    <h3 style="margin:0 0 12px;font-size:16px">Historial</h3>
                    <div style="max-height:300px;overflow-y:auto">
                        ${this.historial.length === 0 ? '<div style="color:var(--text-light);font-size:13px">Sin registros</div>' : this.historial.map(h => `
                            <div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
                                <span style="color:var(--text-light);min-width:130px">${h.created_at ? new Date(h.created_at).toLocaleString('es-CL') : '-'}</span>
                                <span style="font-weight:600;min-width:100px">${h.accion}</span>
                                <span style="flex:1">${escapeHtml(h.detalle || '')}</span>
                                <span style="color:var(--text-light)">${escapeHtml(h.usuario_nombre || h.usuario)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div></div>
            </div>
            <div class="card" style="margin-top:16px"><div class="card-body">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                    <h3 style="margin:0;font-size:16px">Fotografias (${this.fotos.length})</h3>
                    ${inst.estado === 'EN_CURSO' || inst.estado === 'COMPLETADA' || inst.estado === 'CON_NOVEDADES' ? `
                        <div style="display:flex;gap:8px;align-items:center">
                            <input type="file" id="instDetFotoInput" accept="image/*" multiple style="font-size:13px">
                            <button class="btn btn-sm btn-primary" onclick="App.modules.inst_detalle.subirFotos(${inst.id})">Subir</button>
                        </div>
                    ` : ''}
                </div>
                ${this.fotos.length > 0 ? `
                    <div style="display:flex;gap:8px;flex-wrap:wrap">
                        ${this.fotos.map(f => `
                            <div style="position:relative;display:inline-block">
                                <img src="/api/instalaciones/${inst.id}/foto/${f.id}" style="width:140px;height:105px;object-fit:cover;border-radius:8px;cursor:pointer" onclick="App.modules.inst_detalle.verFoto(${inst.id},${f.id})" title="${escapeHtml(f.descripcion || '')}">
                                ${(() => { const user = JSON.parse(localStorage.getItem('unified_user') || '{}'); const p = user.permisos || []; return (p.includes('instalaciones.eliminar') || p.includes('usuarios')) ?
                                `<button onclick="event.stopPropagation();App.modules.inst_detalle.eliminarFoto(${inst.id},${f.id})" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:#ef4444;color:#fff;border:none;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center" title="Eliminar">✕</button>` : ''; })()}
                            </div>
                        `).join('')}
                    </div>
                ` : '<div style="color:var(--text-light);font-size:13px">Sin fotografias</div>'}
            </div></div>
        `;
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
            await this.cargarYRenderizar(id);
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    showCerrar(id) {
        App.showModal(`
            <div class="form-group"><label>Notas de Cierre</label><textarea class="form-control" id="instCierreNotas" rows="3" placeholder="Observaciones finales" style="text-transform:capitalize"></textarea></div>
            <div class="form-group"><label>Nombre de quien recibe *</label><input class="form-control" id="instCierreFirma" placeholder="Nombre completo" style="text-transform:capitalize"></div>
            <div class="form-group">
                <label>Firma del Cliente *</label>
                <div style="position:relative;border:2px solid #334155;border-radius:8px;overflow:hidden;background:#fff">
                    <canvas id="firmaCanvas" width="460" height="180" style="display:block;width:100%;height:180px;touch-action:none;cursor:crosshair"></canvas>
                </div>
                <div style="display:flex;gap:8px;margin-top:6px">
                    <button type="button" class="btn btn-outline btn-sm" onclick="App.modules.inst_detalle.limpiarFirma()" style="font-size:11px">🗑️ Limpiar</button>
                    <span style="font-size:11px;color:#64748b;align-self:center">Firme aqui con el dedo o mouse</span>
                </div>
            </div>
        `, { title: 'Cerrar Instalacion #' + id });
        document.querySelector('#modalOverlay .modal-footer').innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.inst_detalle.cerrar(${id})">Completar</button>
        `;
        setTimeout(() => this.initFirmaCanvas(), 100);
    },

    initFirmaCanvas() {
        const canvas = document.getElementById('firmaCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let drawing = false;
        let lastX = 0, lastY = 0;

        const getPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            if (e.touches) {
                return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
            }
            return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
        };

        const startDraw = (e) => {
            e.preventDefault();
            drawing = true;
            const pos = getPos(e);
            lastX = pos.x; lastY = pos.y;
        };

        const draw = (e) => {
            e.preventDefault();
            if (!drawing) return;
            const pos = getPos(e);
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(pos.x, pos.y);
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
            lastX = pos.x; lastY = pos.y;
        };

        const stopDraw = (e) => { e.preventDefault(); drawing = false; };

        canvas.addEventListener('mousedown', startDraw);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDraw);
        canvas.addEventListener('mouseleave', stopDraw);
        canvas.addEventListener('touchstart', startDraw, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        canvas.addEventListener('touchend', stopDraw, { passive: false });
    },

    limpiarFirma() {
        const canvas = document.getElementById('firmaCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    },

    async cerrar(id) {
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
        const nombre = document.getElementById('instCierreFirma').value.trim();
        if (!nombre) { App.showAlert('Ingrese el nombre de quien recibe', 'danger'); return; }
        const canvas = document.getElementById('firmaCanvas');
        let firmaBase64 = '';
        if (canvas) {
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pixels = imageData.data;
            let hasContent = false;
            for (let i = 3; i < pixels.length; i += 4) { if (pixels[i] > 0) { hasContent = true; break; } }
            if (hasContent) firmaBase64 = canvas.toDataURL('image/png');
        }
        if (!firmaBase64) { App.showAlert('Por favor firme el documento', 'danger'); return; }
        const data = {
            notas_cierre: capitalize(document.getElementById('instCierreNotas').value.trim()),
            firma_cliente: JSON.stringify({ nombre: capitalize(nombre), firma: firmaBase64 })
        };
        try {
            await fetch(`/api/instalaciones/${id}/cerrar`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-User-Email': user.email || '' },
                body: JSON.stringify(data)
            });
            App.hideModal();
            App.showAlert('Instalacion completada');
            await this.cargarYRenderizar(id);
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    showNovedad(id) {
        App.showModal(`
            <div class="form-group"><label>Descripcion de la Novedad *</label><textarea class="form-control" id="instNovedadDesc" rows="4" placeholder="Describe que sucedio..." style="text-transform:capitalize"></textarea></div>
            <div class="form-group"><label>Fotos de la Novedad (opcional)</label><input type="file" id="instNovedadFotos" accept="image/*" multiple style="font-size:13px"></div>
        `, { title: 'Registrar Novedad #' + id });
        document.querySelector('#modalOverlay .modal-footer').innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-danger" onclick="App.modules.inst_detalle.registrarNovedad(${id})">Registrar</button>
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
            await this.cargarYRenderizar(id);
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    async subirFotos(id) {
        const input = document.getElementById('instDetFotoInput');
        if (!input || input.files.length === 0) { App.showAlert('Selecciona al menos una foto', 'danger'); return; }
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const fotos = [];
        for (const file of input.files) {
            const base64 = await new Promise(r => { const reader = new FileReader(); reader.onload = () => r(reader.result); reader.readAsDataURL(file); });
            fotos.push({ base64, descripcion: file.name });
        }
        try {
            await fetch(`/api/instalaciones/${id}/fotos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Email': user.email || '' },
                body: JSON.stringify({ fotos })
            });
            App.showAlert(fotos.length + ' foto(s) subida(s)');
            await this.cargarYRenderizar(id);
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    async eliminarFoto(instId, fotoId) {
        if (!confirm('Eliminar esta foto?')) return;
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        try {
            await fetch(`/api/instalaciones/${instId}/foto/${fotoId}`, {
                method: 'DELETE',
                headers: { 'X-User-Email': user.email || '' }
            });
            App.showAlert('Foto eliminada');
            await this.cargarYRenderizar(instId);
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    async editarInstalacion(id) {
        const inst = this.inst;
        if (!inst) return;
        let tecnicos = [];
        let vendedores = [];
        try { tecnicos = await fetch('/api/instalaciones/tecnicos').then(r => r.json()); } catch(e) {}
        try { vendedores = await fetch('/api/instalaciones/vendedores').then(r => r.json()); } catch(e) {}
        const datalistHtml = `<datalist id="tecnicosList">${(tecnicos || []).map(t => `<option value="${escapeHtml(t)}">`).join('')}</datalist><datalist id="vendedoresList">${(vendedores || []).map(v => `<option value="${escapeHtml(v)}">`).join('')}</datalist>`;
        App.showModal(`
            ${datalistHtml}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group"><label>Cliente *</label><input class="form-control" id="instCliente" value="${escapeHtml(inst.cliente)}" placeholder="Nombre del cliente" style="text-transform:uppercase"></div>
                <div class="form-group"><label>Tecnico Asignado</label><input class="form-control" id="instTecnico" value="${escapeHtml(inst.tecnico || '')}" placeholder="Nombre del tecnico" style="text-transform:capitalize" list="tecnicosList"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group"><label>Vendedor</label><input class="form-control" id="instVendedor" value="${escapeHtml(inst.vendedor || '')}" placeholder="Nombre del vendedor" style="text-transform:capitalize" list="vendedoresList"></div>
                <div class="form-group"><label>Numero de Orden</label><input class="form-control" id="instNumeroOrden" value="${escapeHtml(inst.numero_orden || '')}" placeholder="Numero de orden" style="text-transform:uppercase"></div>
            </div>
            <div class="form-group"><label>Direccion *</label>
                <div style="display:flex;gap:6px;align-items:center">
                    <input class="form-control" id="instDireccion" value="${escapeHtml(inst.direccion)}" placeholder="Direccion de la instalacion" style="text-transform:capitalize;flex:1">
                    <a href="https://www.google.com/maps/search/?api=1&query=" target="_blank" id="instMapGoogle" title="Google Maps" style="display:inline-flex;align-items:center;padding:6px 10px;border-radius:6px;font-size:12px;background:#dcfce7;color:#166534;text-decoration:none;border:1px solid #bbf7d0;white-space:nowrap" onclick="this.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(document.getElementById('instDireccion').value)">📍 Maps</a>
                    <a href="https://www.waze.com/ul?q=" target="_blank" id="instMapWaze" title="Waze" style="display:inline-flex;align-items:center;padding:6px 10px;border-radius:6px;font-size:12px;background:#dbeafe;color:#1e40af;text-decoration:none;border:1px solid #bfdbfe;white-space:nowrap" onclick="this.href='https://www.waze.com/ul?q='+encodeURIComponent(document.getElementById('instDireccion').value)">🚗 Waze</a>
                </div>
            </div>
            <div class="form-group"><label>Descripcion</label><textarea class="form-control" id="instDescripcion" rows="2" placeholder="Detalle de vidrios o estructuras a instalar" style="text-transform:capitalize">${escapeHtml(inst.descripcion || '')}</textarea></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group"><label>Fecha Programada *</label><input type="date" class="form-control" id="instFecha" value="${inst.fecha_programada ? inst.fecha_programada.substring(0, 10) : ''}"></div>
                <div class="form-group"><label>Hora</label><input type="time" class="form-control" id="instHora" value="${inst.hora_programada || '09:00'}"></div>
            </div>
            <div class="form-group"><label>Notas Previas</label><textarea class="form-control" id="instNotas" rows="2" placeholder="Notas o instrucciones previas" style="text-transform:capitalize">${escapeHtml(inst.notas_previas || '')}</textarea></div>
        `, { title: 'Editar Instalacion #' + id });
        document.querySelector('#modalOverlay .modal-footer').innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.inst_detalle.guardarEdicion(${id})">Actualizar</button>
        `;
    },

    async guardarEdicion(id) {
        const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
        const data = {
            cliente: document.getElementById('instCliente').value.trim().toUpperCase(),
            direccion: capitalize(document.getElementById('instDireccion').value.trim()),
            descripcion: capitalize(document.getElementById('instDescripcion').value.trim()),
            fecha_programada: document.getElementById('instFecha').value,
            hora_programada: document.getElementById('instHora').value,
            tecnico: capitalize(document.getElementById('instTecnico').value.trim()),
            vendedor: capitalize(document.getElementById('instVendedor').value.trim()),
            numero_orden: document.getElementById('instNumeroOrden').value.trim().toUpperCase(),
            notas_previas: capitalize(document.getElementById('instNotas').value.trim())
        };
        if (!data.cliente || !data.direccion || !data.fecha_programada) { App.showAlert('Cliente, direccion y fecha requeridos', 'danger'); return; }
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        try {
            await fetch(`/api/instalaciones/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-User-Email': user.email || '' },
                body: JSON.stringify(data)
            });
            App.hideModal();
            App.showAlert('Instalacion actualizada');
            await this.cargarYRenderizar(id);
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    async eliminarInstalacion(id) {
        if (!confirm('Eliminar esta instalacion y todo su historial? Esta accion no se puede deshacer.')) return;
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        try {
            await fetch(`/api/instalaciones/${id}`, {
                method: 'DELETE',
                headers: { 'X-User-Email': user.email || '' }
            });
            App.showAlert('Instalacion eliminada');
            App.loadModule('instalaciones');
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    verFoto(instId, fotoId) {
        const w = window.open('', '_blank');
        w.document.write(`<html><body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#111"><img src="/api/instalaciones/${instId}/foto/${fotoId}" style="max-width:100%;max-height:100vh"></body></html>`);
    }
});
