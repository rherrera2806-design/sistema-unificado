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
