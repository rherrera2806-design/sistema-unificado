App.registerModule('prod_notas', {
    _data: [],

    // Usuario de sesion con default seguro (evita TypeError si no hay sesion)
    _user() {
        try { return JSON.parse(localStorage.getItem('unified_user')) || {}; } catch (e) { return {}; }
    },

    async render() {
        const el = document.getElementById('page-prod_notas');

        const user = this._user();
        const res = await fetch('/api/produccion/notas', {
            headers: { 'X-User-Email': user.email || '' }
        });
        this._data = await res.json();

        const totalPendientes = this._data.filter(n => n.estado === 'pendiente').length;
        const totalRealizados = this._data.filter(n => n.estado === 'realizado').length;

        el.innerHTML = '<style>'
            + '@keyframes pnFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}'
            + '.nota-hero{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 55%,#1e40af 100%);border-radius:16px;padding:20px 26px;display:flex;align-items:center;gap:14px;position:relative;overflow:hidden;margin-bottom:16px}'
            + '.nota-hero::after{content:\'\';position:absolute;left:0;right:0;bottom:0;height:1px;background:linear-gradient(90deg,transparent,rgba(147,197,253,.55),transparent)}'
            + '.nota-hero h2{color:#fff;font-size:20px;font-weight:700;margin:0}'
            + '.nota-hero p{color:rgba(255,255,255,.62);font-size:11px;margin:4px 0 0}'
            + '.nota-hero-actions{margin-left:auto;display:flex;gap:8px;align-items:center}'
            + '.nota-hbtn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);color:#fff;cursor:pointer;font-size:11px;font-weight:600;white-space:nowrap}'
            + '.nota-hbtn:hover{background:rgba(255,255,255,.2)}'
            + '.nota-hbtn.solid{background:#fff;color:#1e3a5f;border-color:#fff}'
            + '.nota-hbtn.solid:hover{background:#e8eefb}'
            + '.nota-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px}'
            + '.nota-kpi{background:#fff;border:1px solid #e4e9f0;border-radius:12px;padding:13px 16px}'
            + '.nota-kpi .k{font-size:10px;font-weight:600;letter-spacing:.7px;text-transform:uppercase;color:#8494a8}'
            + '.nota-kpi .v{font-size:20px;font-weight:700;margin-top:4px}'
            + '.nota-kpi .s{font-size:10px;color:#8494a8;margin-top:2px}'
            + '.nota-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}'
            + '.nota-search{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #e4e9f0;border-radius:10px;padding:0 12px;flex:1;min-width:220px;max-width:360px}'
            + '.nota-search input{border:none;outline:none;padding:10px 0;font-size:13px;width:100%;background:transparent;color:#0f172a}'
            + '.nota-count{font-size:11px;color:#8494a8;font-weight:600}'
            + '.nota-panel{background:#fff;border:1px solid #e4e9f0;border-radius:14px;overflow:hidden}'
            + '.nota-p-head{padding:13px 18px;display:flex;align-items:baseline;gap:10px;border-bottom:1px solid #e4e9f0}'
            + '.nota-p-head h3{font-size:13px;font-weight:600;margin:0}'
            + '.nota-p-head .sub{font-size:10px;color:#8494a8}'
            + '.nota-p-body{padding:16px 18px}'
            + '.nota-loading{text-align:center;padding:32px;color:#8494a8;font-size:13px}'
            + '.nota-amenu{position:relative;display:inline-block}'
            + '.nota-amenu-btn{padding:6px 11px;border-radius:7px;border:1px solid #e4e9f0;background:#fff;color:#475569;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap}'
            + '.nota-amenu-btn:hover{background:#f8fafc}'
            + '.nota-amenu-drop{display:none;position:fixed;z-index:95;background:#fff;border:1px solid #e4e9f0;border-radius:10px;box-shadow:0 12px 32px rgba(15,23,42,.16);min-width:200px;padding:5px}'
            + '.nota-amenu-drop .it{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:7px;font-size:11px;font-weight:600;color:#475569;cursor:pointer;white-space:nowrap}'
            + '.nota-amenu-drop .it:hover{background:#f8fafc}'
            + '.nota-amenu-drop .it.danger{color:#dc2626}'
            + '.nota-amenu-drop .sep{height:1px;background:#e4e9f0;margin:5px 8px}'
            + '</style>'

            + '<div class="nota-hero">'
            + '<div><h2>Bitácora de Producción</h2><p>Notas entre jefes de área y supervisores</p></div>'
            + '<div class="nota-hero-actions"><button class="nota-hbtn solid" onclick="App.modules.prod_notas.showForm()">＋ Nueva nota</button></div>'
            + '</div>'

            + '<div class="nota-kpis">'
            + '<div class="nota-kpi"><div class="k">Total notas</div><div class="v" style="color:#0f172a">' + this._data.length + '</div><div class="s">en la bitácora</div></div>'
            + '<div class="nota-kpi"><div class="k">Pendientes</div><div class="v" style="color:#b45309" id="pnPendientes">' + totalPendientes + '</div><div class="s">por resolver</div></div>'
            + '<div class="nota-kpi"><div class="k">Realizadas</div><div class="v" style="color:#15803d" id="pnRealizados">' + totalRealizados + '</div><div class="s">ya atendidas</div></div>'
            + '</div>'

            + '<div class="nota-toolbar">'
            + '<div class="nota-search"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8494a8" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" id="prodNotaSearch" placeholder="Buscar nota..." oninput="App.modules.prod_notas.filter()"></div>'
            + '<span class="nota-count" id="pnCount"></span>'
            + '</div>'

            + '<div class="nota-panel">'
            + '<div class="nota-p-head"><h3>Notas de la bitácora</h3><span class="sub">pendientes y realizadas</span></div>'
            + '<div class="nota-p-body"><div id="prodNotasContent"><div class="nota-loading">Cargando...</div></div></div>'
            + '</div>';

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

    // ── Menú de acciones (popover fijo, patrón del sistema) ──
    menuAcciones(n) {
        return `<div class="nota-amenu"><button class="nota-amenu-btn" onclick="App.modules.prod_notas.toggleAcciones(event)">Acciones ▾</button>
        <div class="nota-amenu-drop">
            ${n.estado === 'pendiente'
                ? '<div class="it" onclick="App.modules.prod_notas.marcarRealizado(' + n.id + ')">✅ Marcar como realizado</div>'
                : '<div class="it" onclick="App.modules.prod_notas.marcarPendiente(' + n.id + ')">↩️ Volver a pendiente</div>'}
            <div class="it" onclick="App.modules.prod_notas.showForm(' + n.id + ')">✏️ Editar nota</div>
            <div class="sep"></div>
            <div class="it danger" onclick="App.modules.prod_notas.delete(' + n.id + ')">🗑 Eliminar nota</div>
        </div></div>`;
    },
    toggleAcciones(e) {
        e.stopPropagation();
        this._setupMenus();
        const wrap = e.currentTarget.parentElement;
        const menu = wrap.querySelector('.nota-amenu-drop');
        if (!menu) return;
        const wasVisible = menu.style.display === 'block';
        this._cerrarMenus();
        if (wasVisible) return;
        const rect = e.currentTarget.getBoundingClientRect();
        menu.style.display = 'block';
        menu.style.top = '0px';
        menu.style.left = '0px';
        const mh = menu.offsetHeight, mw = menu.offsetWidth;
        const espacioAbajo = window.innerHeight - rect.bottom;
        menu.style.top = (espacioAbajo < mh + 12 ? Math.max(8, rect.top - mh - 6) : rect.bottom + 6) + 'px';
        menu.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - mw - 8)) + 'px';
    },
    _cerrarMenus() {
        document.querySelectorAll('.nota-amenu-drop').forEach(d => d.style.display = 'none');
    },
    _setupMenus() {
        if (this._menusBound) return;
        this._menusBound = true;
        document.addEventListener('click', () => this._cerrarMenus());
        window.addEventListener('scroll', () => this._cerrarMenus(), true);
        window.addEventListener('resize', () => this._cerrarMenus());
    },

    renderList(data) {
        const container = document.getElementById('prodNotasContent');
        const count = document.getElementById('pnCount');
        if (count) count.textContent = '(' + (data || []).length + ' nota' + ((data || []).length === 1 ? '' : 's') + ')';

        if (!data || data.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:48px 20px"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" style="margin-bottom:12px"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg><h4 style="margin:0 0 4px;color:#334155;font-size:15px">Sin resultados</h4><p style="margin:0;color:#94a3b8;font-size:13px">No se encontraron notas</p></div>';
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
                + this.menuAcciones(n)
                + '</div></div>';
        }
        html += '</div>';
        container.innerHTML = html;
    },

    async refresh() {
        const user = this._user();
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
            const user = this._user();
            const res = await fetch(`/api/produccion/notas/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-User-Email': user.email || '' },
                body: JSON.stringify({ estado: 'realizado' })
            });
            await apiJson(res); // lanza Error si la API respondio con fallo
            App.showAlert('Marcado como realizado');
            await this.refresh();
        } catch(e) { App.showAlert('Error al actualizar: ' + e.message, 'danger'); }
    },

    async marcarPendiente(id) {
        try {
            const user = this._user();
            const res = await fetch(`/api/produccion/notas/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-User-Email': user.email || '' },
                body: JSON.stringify({ estado: 'pendiente' })
            });
            await apiJson(res); // lanza Error si la API respondio con fallo
            App.showAlert('Vuelto a pendiente');
            await this.refresh();
        } catch(e) { App.showAlert('Error al actualizar: ' + e.message, 'danger'); }
    },

    async showForm(id) {
        const user = this._user();
        let reg = null;
        if (id) {
            const res = await fetch('/api/produccion/notas', {
                headers: { 'X-User-Email': user.email || '' }
            });
            const all = await res.json();
            reg = all.find(n => n.id === id);
        }
        App.showModal(`
            <div class="form-group"><label>Nota *</label><textarea class="form-control" id="prodNotaTexto" rows="5" placeholder="Escribe la nota aquí (entre jefes de área y supervisores)...">${escText(reg ? reg.nota || '' : '')}</textarea></div>
        `, { title: reg ? 'Editar nota' : 'Nueva nota' });
        const footer = document.querySelector('#modalOverlay .modal-footer');
        footer.innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.prod_notas.save(${id || 0})">${reg ? 'Actualizar' : 'Guardar'}</button>
        `;
    },

    async save(id) {
        try {
            const user = this._user();
            const nota = document.getElementById('prodNotaTexto').value.trim();
            if (!nota) { App.showAlert('Escribe la nota', 'danger'); return; }

            if (id === 0) {
                await apiJson(await fetch('/api/produccion/notas', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-User-Email': user.email || '' },
                    body: JSON.stringify({ nota })
                }));
            } else {
                await apiJson(await fetch(`/api/produccion/notas/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'X-User-Email': user.email || '' },
                    body: JSON.stringify({ nota })
                }));
            }
            App.hideModal();
            App.showAlert(id === 0 ? 'Nota creada' : 'Nota actualizada');
            this.refresh();
        } catch(e) { App.showAlert('Error al guardar: ' + e.message, 'danger'); }
    },

    async delete(id) {
        try {
            const confirmed = await App.confirm('¿Eliminar esta nota?');
            if (!confirmed) return;
            const user = this._user();
            await apiJson(await fetch(`/api/produccion/notas/${id}`, {
                method: 'DELETE',
                headers: { 'X-User-Email': user.email || '' }
            }));
            App.showAlert('Nota eliminada');
            this.refresh();
        } catch(e) { App.showAlert('Error al eliminar: ' + e.message, 'danger'); }
    }
});
