App.registerModule('notas', {
    _notasData: [],
    async render() {
        const el = document.getElementById('page-notas');
        el.innerHTML = `
            <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:28px 32px;margin-bottom:24px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">
            <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
            <div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap"><div><h2 style="margin:0;font-size:24px;font-weight:800;color:white;letter-spacing:-0.5px">Notas</h2>
            <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.7)">Comunicación entre turnos</p></div>
                <div style="display:flex;align-items:center;gap:12px">
                    <div style="position:relative"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);pointer-events:none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" id="notaSearch" placeholder="Buscar por autor, contenido o fecha..." oninput="App.modules.notas.filtrar()" style="width:280px;padding:10px 14px 10px 38px;border:none;border-radius:10px;font-size:13px;color:white;background:rgba(255,255,255,0.15);backdrop-filter:blur(8px);outline:none;transition:all 0.2s" onfocus="this.style.background='rgba(255,255,255,0.25)'" onblur="this.style.background='rgba(255,255,255,0.15)'"></div>
                    <button onclick="App.modules.notas.showForm()" style="display:inline-flex;align-items:center;gap:6px;padding:10px 20px;background:linear-gradient(135deg,#22c55e,#16a34a);color:white;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(34,197,94,0.4);transition:all 0.2s" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 16px rgba(34,197,94,0.5)'" onmouseout="this.style.transform='';this.style.boxShadow='0 4px 12px rgba(34,197,94,0.4)'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Nueva Nota</button>
                </div>
            </div></div>
            <style>
@keyframes nota_fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.nota-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}
.nota-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important;transform:translateY(-3px)}
.nota-row{transition:all 0.2s}
.nota-row:hover{transform:translateX(2px);background:#f8fafc!important}
</style>
            <div class="card nota-card">
                <div class="card-body" style="padding:0" id="notasContent">
                    <div class="empty-state"><p>Cargando...</p></div>
                </div>
            </div>
        `;
        await this.loadNotas();
    },

    async loadNotas() {
        try {
            const data = await db.getAll('notas');
            this._notasData = data || [];
            this.renderNotas(this._notasData);
        } catch(e) {
            console.error('Error loading notas:', e);
            document.getElementById('notasContent').innerHTML = '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">Error al cargar notas</h4><p style="margin:0;color:#94a3b8;font-size:13px">Intenta recargar la página</p></div>';
        }
    },

    filtrar() {
        const q = (document.getElementById('notaSearch')?.value || '').toLowerCase().trim();
        if (!q) { this.renderNotas(this._notasData); return; }
        const filtered = this._notasData.filter(n => {
            const t = (n.tecnico || '').toLowerCase();
            const nota = (n.nota || '').toLowerCase();
            const fecha = (n.fecha || '').toLowerCase();
            return t.includes(q) || nota.includes(q) || fecha.includes(q);
        });
        this.renderNotas(filtered);
    },

    renderNotas(data) {
        const container = document.getElementById('notasContent');
        data.sort((a, b) => {
            const fechaHoraA = (a.fecha || '') + ' ' + (a.hora || '');
            const fechaHoraB = (b.fecha || '') + ' ' + (b.hora || '');
            return fechaHoraB.localeCompare(fechaHoraA);
        });
        if (!data || data.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:48px 20px"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:16px">Sin notas</h4><p style="margin:0;color:#94a3b8;font-size:13px">Registra la primera nota</p></div>';
            return;
        }
        let html = '<div style="padding:0">';
        for (const n of data) {
            html += `
                <div style="padding:16px;border-bottom:1px solid var(--border);display:flex;gap:16px;align-items:flex-start">
                    <div style="flex:1">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                            <strong style="color:var(--primary)">${n.tecnico || 'Sin autor'}</strong>
                            <span style="font-size:11px;color:var(--text-light)">${App.formatDate(n.fecha)} ${n.hora || ''}</span>
                        </div>
                        <p style="margin:0;color:var(--text);white-space:pre-wrap">${n.nota || ''}</p>
                    </div>
                    <div style="display:flex;gap:4px;flex-shrink:0">
                        <button class="btn btn-sm btn-outline" onclick="App.modules.notas.showForm(${n.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                        <button class="btn btn-sm btn-danger" onclick="App.modules.notas.delete(${n.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                    </div>
                </div>`;
        }
        html += '</div>';
        container.innerHTML = html;
    },

    async showForm(id) {
        const reg = id ? await db.getById('notas', id) : null;
        const now = new Date();
        const fechaDefault = reg ? reg.fecha : now.toISOString().split('T')[0];
        const horaDefault = reg ? reg.hora : now.toTimeString().slice(0, 5);
        App.showModal(`
            <div class="form-group"><label>Técnico *</label><input class="form-control" id="notaTecnico" value="${reg ? reg.tecnico || '' : ''}" placeholder="Nombre del técnico"></div>
            <div class="form-row">
                <div class="form-group"><label>Fecha</label><input type="date" class="form-control" id="notaFecha" value="${fechaDefault}"></div>
                <div class="form-group"><label>Hora</label><input type="time" class="form-control" id="notaHora" value="${horaDefault}"></div>
            </div>
            <div class="form-group"><label>Nota *</label><textarea class="form-control" id="notaTexto" rows="5" placeholder="Escribe tu nota aquí...">${reg ? reg.nota || '' : ''}</textarea></div>
        `, { title: reg ? 'Editar Nota' : 'Nueva Nota' });
        const footer = document.querySelector('#modalOverlay .modal-footer');
        footer.innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.notas.save(${id || 0})">${reg ? 'Actualizar' : 'Guardar'}</button>
        `;
    },

    async save(id) {
        try {
            const data = {
                tecnico: App.capitalize(document.getElementById('notaTecnico').value.trim()),
                fecha: document.getElementById('notaFecha').value,
                hora: document.getElementById('notaHora').value,
                nota: document.getElementById('notaTexto').value.trim()
            };
            if (!data.tecnico || !data.nota) {
                App.showAlert('Técnico y nota son obligatorios', 'danger'); return;
            }
            if (id === 0) await db.insert('notas', data);
            else await db.update('notas', id, data);
            App.hideModal();
            App.showAlert(id === 0 ? 'Nota creada' : 'Nota actualizada');
            this.render();
        } catch(e) { App.showAlert('Error al guardar: ' + e.message, 'danger'); }
    },

    async delete(id) {
        try {
            const confirmed = await App.confirm('¿Eliminar esta nota?');
            if (!confirmed) return;
            await db.delete('notas', id);
            App.showAlert('Nota eliminada');
            this.render();
        } catch(e) { App.showAlert('Error al eliminar: ' + e.message, 'danger'); }
    }
});
