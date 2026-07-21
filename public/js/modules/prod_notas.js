App.registerModule('prod_notas', {
    _data: [],

    async render() {
        const el = document.getElementById('page-prod_notas');

        const user = JSON.parse(localStorage.getItem('unified_user'));
        const res = await fetch('/api/produccion/notas', {
            headers: { 'X-User-Email': user.email || '' }
        });
        this._data = await res.json();

        const totalPendientes = this._data.filter(n => n.estado === 'pendiente').length;
        const totalRealizados = this._data.filter(n => n.estado === 'realizado').length;

        el.innerHTML = `
            <div class="page-header">
                <div><h2>Mis Pendientes</h2><div class="subtitle">Notas personales de produccion</div></div>
                <button class="btn btn-primary" onclick="App.modules.prod_notas.showForm()">+ Nuevo Pendiente</button>
            </div>
            <div class="stats-grid" style="margin-bottom:20px">
                <div class="stat-card">
                    <div class="stat-icon" style="background:#fef3c7;color:#f59e0b">⏳</div>
                    <div class="stat-info"><h4>${totalPendientes}</h4><p>Pendientes</p></div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background:#dcfce7;color:#22c55e">✅</div>
                    <div class="stat-info"><h4>${totalRealizados}</h4><p>Realizados</p></div>
                </div>
            </div>
            <div class="card">
                <div class="card-header">
                    <input type="text" class="form-control" id="prodNotaSearch" placeholder="Buscar pendiente..." oninput="App.modules.prod_notas.filter()" style="max-width:300px">
                </div>
                <div class="card-body" style="padding:0" id="prodNotasContent">
                    <div class="empty-state"><p>Cargando...</p></div>
                </div>
            </div>
        `;
        this.renderList(this._data);
    },

    filter() {
        const q = (document.getElementById('prodNotaSearch')?.value || '').toLowerCase().trim();
        if (!q) { this.renderList(this._data); return; }
        const filtered = this._data.filter(n =>
            (n.nota || '').toLowerCase().includes(q) ||
            (n.estado || '').toLowerCase().includes(q)
        );
        this.renderList(filtered);
    },

    renderList(data) {
        const container = document.getElementById('prodNotasContent');

        if (!data || data.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="icon">📋</div><h4>Sin resultados</h4><p>No se encontraron pendientes</p></div>';
            return;
        }

        let html = '<div style="padding:0">';
        for (const n of data) {
            const esPendiente = n.estado === 'pendiente';
            const bgColor = esPendiente ? '#fffbeb' : '#f0fdf4';
            const borderLeft = esPendiente ? '3px solid #f59e0b' : '3px solid #22c55e';

            let tiempoTranscurrido = '';
            if (n.fecha_completado) {
                const inicio = new Date(n.fecha_creacion);
                const fin = new Date(n.fecha_completado);
                const diffMs = fin - inicio;
                const dias = Math.floor(diffMs / 86400000);
                const horas = Math.floor((diffMs % 86400000) / 3600000);
                const mins = Math.floor((diffMs % 3600000) / 60000);
                if (dias > 0) tiempoTranscurrido = `${dias}d ${horas}h ${mins}m`;
                else if (horas > 0) tiempoTranscurrido = `${horas}h ${mins}m`;
                else tiempoTranscurrido = `${mins}m`;
            } else if (esPendiente) {
                const inicio = new Date(n.fecha_creacion);
                const ahora = new Date();
                const diffMs = ahora - inicio;
                const dias = Math.floor(diffMs / 86400000);
                const horas = Math.floor((diffMs % 86400000) / 3600000);
                const mins = Math.floor((diffMs % 3600000) / 60000);
                if (dias > 0) tiempoTranscurrido = `${dias}d ${horas}h ${mins}m (en curso)`;
                else if (horas > 0) tiempoTranscurrido = `${horas}h ${mins}m (en curso)`;
                else tiempoTranscurrido = `${mins}m (en curso)`;
            }

            const fechaCreacion = new Date(n.fecha_creacion).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const fechaCompletado = n.fecha_completado ? new Date(n.fecha_completado).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

            html += `
                <div style="padding:16px;border-bottom:1px solid var(--border);display:flex;gap:16px;align-items:flex-start;background:${bgColor};border-left:${borderLeft}" id="prodnota-${n.id}">
                    <div style="flex:1">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
                            ${esPendiente ? '<span style="background:#f59e0b;color:#fff;font-size:9px;padding:2px 6px;border-radius:10px;font-weight:bold">PENDIENTE</span>' : '<span style="background:#22c55e;color:#fff;font-size:9px;padding:2px 6px;border-radius:10px;font-weight:bold">REALIZADO</span>'}
                            <span style="font-size:11px;color:var(--text-light)">Creado: ${fechaCreacion}</span>
                            ${n.fecha_completado ? `<span style="font-size:11px;color:var(--text-light)">Completado: ${fechaCompletado}</span>` : ''}
                            ${tiempoTranscurrido ? `<span style="font-size:11px;color:${esPendiente ? '#f59e0b' : '#22c55e'};font-weight:bold">⏱ ${tiempoTranscurrido}</span>` : ''}
                        </div>
                        <p style="margin:0;color:var(--text);white-space:pre-wrap">${escapeHtml(n.nota || '')}</p>
                    </div>
                    <div style="display:flex;gap:4px;flex-shrink:0;align-items:flex-start">
                        ${esPendiente ? `<button class="btn btn-sm btn-accent" onclick="App.modules.prod_notas.marcarRealizado(${n.id})" title="Marcar como realizado">✓ Realizado</button>` : `<button class="btn btn-sm btn-outline" onclick="App.modules.prod_notas.marcarPendiente(${n.id})" title="Volver a pendiente">↩ Pendiente</button>`}
                        <button class="btn btn-sm btn-outline" onclick="App.modules.prod_notas.showForm(${n.id})">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="App.modules.prod_notas.delete(${n.id})">🗑️</button>
                    </div>
                </div>`;
        }
        html += '</div>';
        container.innerHTML = html;
    },

    async refresh() {
        const user = JSON.parse(localStorage.getItem('unified_user'));
        const res = await fetch('/api/produccion/notas', {
            headers: { 'X-User-Email': user.email || '' }
        });
        this._data = await res.json();
        const totalPendientes = this._data.filter(n => n.estado === 'pendiente').length;
        const totalRealizados = this._data.filter(n => n.estado === 'realizado').length;
        const statsGrid = document.querySelector('.stats-grid');
        if (statsGrid) {
            const h4s = statsGrid.querySelectorAll('h4');
            if (h4s[0]) h4s[0].textContent = totalPendientes;
            if (h4s[1]) h4s[1].textContent = totalRealizados;
        }
        const searchVal = document.getElementById('prodNotaSearch')?.value || '';
        if (searchVal) this.filter();
        else this.renderList(this._data);
    },

    async marcarRealizado(id) {
        try {
            const user = JSON.parse(localStorage.getItem('unified_user'));
            await fetch(`/api/produccion/notas/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-User-Email': user.email || '' },
                body: JSON.stringify({ estado: 'realizado' })
            });
            App.showAlert('Marcado como realizado');
            await this.refresh();
        } catch(e) { App.showAlert('Error al actualizar', 'danger'); }
    },

    async marcarPendiente(id) {
        try {
            const user = JSON.parse(localStorage.getItem('unified_user'));
            await fetch(`/api/produccion/notas/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-User-Email': user.email || '' },
                body: JSON.stringify({ estado: 'pendiente' })
            });
            App.showAlert('Vuelto a pendiente');
            await this.refresh();
        } catch(e) { App.showAlert('Error al actualizar', 'danger'); }
    },

    async showForm(id) {
        const user = JSON.parse(localStorage.getItem('unified_user'));
        let reg = null;
        if (id) {
            const res = await fetch('/api/produccion/notas', {
                headers: { 'X-User-Email': user.email || '' }
            });
            const all = await res.json();
            reg = all.find(n => n.id === id);
        }
        App.showModal(`
            <div class="form-group"><label>Pendiente *</label><textarea class="form-control" id="prodNotaTexto" rows="5" placeholder="Escribe tu pendiente aqui...">${reg ? reg.nota || '' : ''}</textarea></div>
        `, { title: reg ? 'Editar Pendiente' : 'Nuevo Pendiente' });
        const footer = document.querySelector('#modalOverlay .modal-footer');
        footer.innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.prod_notas.save(${id || 0})">${reg ? 'Actualizar' : 'Guardar'}</button>
        `;
    },

    async save(id) {
        try {
            const user = JSON.parse(localStorage.getItem('unified_user'));
            const nota = document.getElementById('prodNotaTexto').value.trim();
            if (!nota) { App.showAlert('Escribe un pendiente', 'danger'); return; }

            if (id === 0) {
                await fetch('/api/produccion/notas', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-User-Email': user.email || '' },
                    body: JSON.stringify({ nota })
                });
            } else {
                await fetch(`/api/produccion/notas/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'X-User-Email': user.email || '' },
                    body: JSON.stringify({ nota })
                });
            }
            App.hideModal();
            App.showAlert(id === 0 ? 'Pendiente creado' : 'Pendiente actualizado');
            this.refresh();
        } catch(e) { App.showAlert('Error al guardar: ' + e.message, 'danger'); }
    },

    async delete(id) {
        try {
            const confirmed = await App.confirm('¿Eliminar este pendiente?');
            if (!confirmed) return;
            const user = JSON.parse(localStorage.getItem('unified_user'));
            await fetch(`/api/produccion/notas/${id}`, {
                method: 'DELETE',
                headers: { 'X-User-Email': user.email || '' }
            });
            App.showAlert('Pendiente eliminado');
            this.refresh();
        } catch(e) { App.showAlert('Error al eliminar', 'danger'); }
    }
});
