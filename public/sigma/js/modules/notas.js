App.registerModule('notas', {
    async render() {
        const el = document.getElementById('page-notas');
        el.innerHTML = `
            <div class="page-header">
                <div><h2>Notas</h2><div class="subtitle">Comunicación entre turnos</div></div>
                <button class="btn btn-primary" onclick="App.modules.notas.showForm()">+ Nueva Nota</button>
            </div>
            <div class="card">
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
            const container = document.getElementById('notasContent');
            data.sort((a, b) => {
                const fechaHoraA = (a.fecha || '') + ' ' + (a.hora || '');
                const fechaHoraB = (b.fecha || '') + ' ' + (b.hora || '');
                return fechaHoraB.localeCompare(fechaHoraA);
            });
            if (!data || data.length === 0) {
                container.innerHTML = '<div class="empty-state"><div class="icon">📒</div><h4>Sin notas</h4><p>Registra la primera nota</p></div>';
                return;
            }
            let html = '<div style="padding:0">';
            for (const n of data) {
                const esNueva = !n.leido;
                const bgColor = esNueva ? '#f0f7ff' : 'transparent';
                const borderLeft = esNueva ? '3px solid #3b82f6' : 'none';
                html += `
                    <div style="padding:16px;border-bottom:1px solid var(--border);display:flex;gap:16px;align-items:flex-start;background:${bgColor};border-left:${borderLeft}" id="nota-${n.id}">
                        <div style="flex:1">
                            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                                <strong style="color:var(--primary)">${n.tecnico || 'Sin autor'}</strong>
                                <span style="font-size:11px;color:var(--text-light)">${App.formatDate(n.fecha)} ${n.hora || ''}</span>
                                ${esNueva ? '<span style="background:#ef4444;color:#fff;font-size:9px;padding:2px 6px;border-radius:10px;font-weight:bold">NUEVA</span>' : ''}
                            </div>
                            <p style="margin:0;color:var(--text);white-space:pre-wrap">${n.nota || ''}</p>
                        </div>
                        <div style="display:flex;gap:4px;flex-shrink:0;align-items:flex-start">
                            ${esNueva ? `<button class="btn btn-sm btn-accent" onclick="App.modules.notas.marcarLeido(${n.id})" title="Marcar como leído">✓ Leído</button>` : '<span style="font-size:11px;color:#22c55e;padding:4px 8px">Leído</span>'}
                            <button class="btn btn-sm btn-outline" onclick="App.modules.notas.showForm(${n.id})">✏️</button>
                            <button class="btn btn-sm btn-danger" onclick="App.modules.notas.delete(${n.id})">🗑️</button>
                        </div>
                    </div>`;
            }
            html += '</div>';
            container.innerHTML = html;
        } catch(e) {
            console.error('Error loading notas:', e);
            document.getElementById('notasContent').innerHTML = '<div class="empty-state"><p>Error al cargar notas</p></div>';
        }
    },

    async marcarLeido(id) {
        try {
            await db.update('notas', id, { leido: true });
            App.showAlert('Nota marcada como leída');
            await this.loadNotas();
            App.updateNotasBadge();
        } catch(e) { App.showAlert('Error al marcar nota', 'danger'); }
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
            if (id === 0) data.leido = false;
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
