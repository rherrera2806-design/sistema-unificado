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

        el.innerHTML = '<style>'
            + '@keyframes pnFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}'
            + '.pn-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}'
            + '.pn-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important;transform:translateY(-2px)}'
            + '</style>'

            + '<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:14px 24px;margin-bottom:20px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">'
            + '<div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center"><div><h2 style="margin:0;font-size:18px;font-weight:800;color:white;letter-spacing:-0.5px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-3px;margin-right:6px"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>Mis Pendientes</h2>'
            + '<p style="margin:2px 0 0;font-size:11px;color:rgba(255,255,255,0.7)">Notas personales de produccion</p></div>'
            + '<button onclick="App.modules.prod_notas.showForm()" style="display:inline-flex;align-items:center;gap:8px;padding:12px 24px;background:linear-gradient(135deg,#3b82f6,#2563eb);color:white;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(59,130,246,0.4);transition:all 0.2s" onmouseover="this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 6px 16px rgba(59,130,246,0.5)\'" onmouseout="this.style.transform=\'\';this.style.boxShadow=\'0 4px 12px rgba(59,130,246,0.4)\'"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo Pendiente</button>'
            + '</div></div>'

            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px">'
            + '<div class="pn-card" style="background:white;border-radius:14px;padding:24px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:pnFadeUp 0.5s ease both;position:relative;overflow:hidden">'
            + '<div style="position:absolute;top:-20px;right:-20px;width:80px;height:80px;background:radial-gradient(circle,rgba(245,158,11,0.12) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="display:flex;align-items:center;gap:16px"><div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#fef3c7,#fde68a);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(245,158,11,0.25)"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><div><h4 style="margin:0;font-size:24px;font-weight:800;color:#0f172a;line-height:1" id="pnPendientes">' + totalPendientes + '</h4><p style="margin:2px 0 0;font-size:11px;color:#64748b;font-weight:500">Pendientes</p></div></div></div>'

            + '<div class="pn-card" style="background:white;border-radius:14px;padding:24px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:pnFadeUp 0.5s ease 0.1s both;position:relative;overflow:hidden">'
            + '<div style="position:absolute;top:-20px;right:-20px;width:80px;height:80px;background:radial-gradient(circle,rgba(34,197,94,0.12) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="display:flex;align-items:center;gap:16px"><div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#dcfce7,#bbf7d0);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(34,197,94,0.25)"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div><div><h4 style="margin:0;font-size:24px;font-weight:800;color:#0f172a;line-height:1" id="pnRealizados">' + totalRealizados + '</h4><p style="margin:2px 0 0;font-size:11px;color:#64748b;font-weight:500">Realizados</p></div></div></div>'

            + '</div>'

            + '<div style="background:white;border-radius:14px;padding:24px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:pnFadeUp 0.5s ease 0.2s both">'
            + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">'
            + '<div style="position:relative;flex:1;max-width:360px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" style="position:absolute;left:12px;top:50%;transform:translateY(-50%)"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" id="prodNotaSearch" placeholder="Buscar pendiente..." oninput="App.modules.prod_notas.filter()" style="width:100%;padding:10px 10px 10px 36px;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;outline:none;transition:border-color 0.2s" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'"></div></div>'
            + '<div id="prodNotasContent"><div style="text-align:center;padding:40px;color:#94a3b8">Cargando...</div></div></div>';

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
            container.innerHTML = '<div style="text-align:center;padding:48px 20px"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" style="margin-bottom:12px"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg><h4 style="margin:0 0 4px;color:#334155;font-size:16px">Sin resultados</h4><p style="margin:0;color:#94a3b8;font-size:13px">No se encontraron pendientes</p></div>';
            return;
        }

        let html = '<div style="display:flex;flex-direction:column;gap:8px">';
        for (const n of data) {
            const esPendiente = n.estado === 'pendiente';
            const bgColor = esPendiente ? '#fffbeb' : '#f0fdf4';
            const borderColor = esPendiente ? '#f59e0b' : '#22c55e';

            let tiempoTranscurrido = '';
            if (n.fecha_completado) {
                const inicio = new Date(n.fecha_creacion);
                const fin = new Date(n.fecha_completado);
                const diffMs = fin - inicio;
                const dias = Math.floor(diffMs / 86400000);
                const horas = Math.floor((diffMs % 86400000) / 3600000);
                const mins = Math.floor((diffMs % 3600000) / 60000);
                if (dias > 0) tiempoTranscurrido = dias + 'd ' + horas + 'h ' + mins + 'm';
                else if (horas > 0) tiempoTranscurrido = horas + 'h ' + mins + 'm';
                else tiempoTranscurrido = mins + 'm';
            } else if (esPendiente) {
                const inicio = new Date(n.fecha_creacion);
                const ahora = new Date();
                const diffMs = ahora - inicio;
                const dias = Math.floor(diffMs / 86400000);
                const horas = Math.floor((diffMs % 86400000) / 3600000);
                const mins = Math.floor((diffMs % 3600000) / 60000);
                if (dias > 0) tiempoTranscurrido = dias + 'd ' + horas + 'h ' + mins + 'm (en curso)';
                else if (horas > 0) tiempoTranscurrido = horas + 'h ' + mins + 'm (en curso)';
                else tiempoTranscurrido = mins + 'm (en curso)';
            }

            const fechaCreacion = new Date(n.fecha_creacion).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const fechaCompletado = n.fecha_completado ? new Date(n.fecha_completado).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

            html += '<div class="pn-card" style="padding:16px 20px;border-radius:12px;display:flex;gap:16px;align-items:flex-start;background:' + bgColor + ';border:1px solid ' + borderColor + '20;border-left:4px solid ' + borderColor + ';animation:pnFadeUp 0.4s ease both" id="prodnota-' + n.id + '">'
                + '<div style="flex:1;min-width:0">'
                + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">'
                + (esPendiente
                    ? '<span style="background:linear-gradient(135deg,#f59e0b,#d97706);color:white;font-size:10px;padding:3px 10px;border-radius:20px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase">Pendiente</span>'
                    : '<span style="background:linear-gradient(135deg,#22c55e,#16a34a);color:white;font-size:10px;padding:3px 10px;border-radius:20px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase">Realizado</span>')
                + '<span style="font-size:11px;color:#94a3b8"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:3px"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Creado: ' + fechaCreacion + '</span>'
                + (fechaCompletado ? '<span style="font-size:11px;color:#94a3b8"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:3px"><polyline points="20 6 9 17 4 12"/></svg>Completado: ' + fechaCompletado + '</span>' : '')
                + (tiempoTranscurrido ? '<span style="font-size:11px;color:' + (esPendiente ? '#f59e0b' : '#22c55e') + ';font-weight:700"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:3px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' + tiempoTranscurrido + '</span>' : '')
                + '</div>'
                + '<p style="margin:0;color:#1e293b;white-space:pre-wrap;line-height:1.5">' + escapeHtml(n.nota || '') + '</p>'
                + '</div>'
                + '<div style="display:flex;gap:6px;flex-shrink:0;align-items:flex-start">'
                + (esPendiente
                    ? '<button onclick="App.modules.prod_notas.marcarRealizado(' + n.id + ')" title="Marcar como realizado" style="display:inline-flex;align-items:center;gap:5px;padding:7px 14px;background:linear-gradient(135deg,#22c55e,#16a34a);color:white;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.2s" onmouseover="this.style.transform=\'translateY(-1px)\';this.style.boxShadow=\'0 4px 12px rgba(34,197,94,0.4)\'" onmouseout="this.style.transform=\'\';this.style.boxShadow=\'none\'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Realizado</button>'
                    : '<button onclick="App.modules.prod_notas.marcarPendiente(' + n.id + ')" title="Volver a pendiente" style="display:inline-flex;align-items:center;gap:5px;padding:7px 14px;background:#f8fafc;color:#64748b;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.2s" onmouseover="this.style.borderColor=\'#cbd5e1\'" onmouseout="this.style.borderColor=\'#e2e8f0\'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg> Pendiente</button>')
                + '<button onclick="App.modules.prod_notas.showForm(' + n.id + ')" title="Editar" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;transition:all 0.2s;color:#64748b" onmouseover="this.style.background=\'#eff6ff\';this.style.borderColor=\'#3b82f6\';this.style.color=\'#3b82f6\'" onmouseout="this.style.background=\'#f8fafc\';this.style.borderColor=\'#e2e8f0\';this.style.color=\'#64748b\'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>'
                + '<button onclick="App.modules.prod_notas.delete(' + n.id + ')" title="Eliminar" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;cursor:pointer;transition:all 0.2s;color:#ef4444" onmouseover="this.style.background=\'#fee2e2\';this.style.borderColor=\'#f87171\'" onmouseout="this.style.background=\'#fef2f2\';this.style.borderColor=\'#fecaca\'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>'
                + '</div></div>';
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
        const el1 = document.getElementById('pnPendientes');
        const el2 = document.getElementById('pnRealizados');
        if (el1) el1.textContent = totalPendientes;
        if (el2) el2.textContent = totalRealizados;
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
