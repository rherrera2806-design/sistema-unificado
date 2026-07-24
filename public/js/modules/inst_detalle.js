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
                        ${inst.firma_cliente ? `<div style="grid-column:1/-1"><strong>Firma Cliente:</strong> ${escapeHtml(inst.firma_cliente)}</div>` : ''}
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
                                <button onclick="event.stopPropagation();App.modules.inst_detalle.eliminarFoto(${inst.id},${f.id})" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:#ef4444;color:#fff;border:none;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center" title="Eliminar">✕</button>
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
            <div class="form-group"><label>Firma / Conformidad Cliente</label><input class="form-control" id="instCierreFirma" placeholder="Nombre de quien recibe" style="text-transform:capitalize"></div>
        `, { title: 'Cerrar Instalacion #' + id });
        document.querySelector('#modalOverlay .modal-footer').innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.inst_detalle.cerrar(${id})">Completar</button>
        `;
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

    verFoto(instId, fotoId) {
        const w = window.open('', '_blank');
        w.document.write(`<html><body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#111"><img src="/api/instalaciones/${instId}/foto/${fotoId}" style="max-width:100%;max-height:100vh"></body></html>`);
    }
});
