App.registerModule('instalaciones', {
    instalaciones: [],
    calMonth: new Date().getMonth(),
    calYear: new Date().getFullYear(),

    fmtDate(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },

    async render() {
        const el = document.getElementById('page-instalaciones');
        el.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
                <div><h2 style="margin:0">Instalaciones</h2><div class="subtitle">Calendario mensual de trabajos en terreno</div></div>
                <button class="btn btn-primary" onclick="App.modules.instalaciones.showForm()">+ Nueva Instalacion</button>
            </div>
            <div id="instStats" style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px"></div>
            <div id="instCalendario"></div>
        `;
        await this.loadData();
    },

    async loadData() {
        const firstDay = this.fmtDate(new Date(this.calYear, this.calMonth, 1));
        const lastDay = this.fmtDate(new Date(this.calYear, this.calMonth + 1, 0));
        try {
            const res = await fetch(`/api/instalaciones/calendario?inicio=${firstDay}&fin=${lastDay}`);
            this.instalaciones = await res.json();
            this.renderStats();
            this.renderCalendario();
        } catch(e) { console.error('Error:', e); }
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
        const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        const diasSemana = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
        const year = this.calYear;
        const month = this.calMonth;
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startOffset = firstDay === 0 ? 6 : firstDay - 1;
        const hoyStr = this.fmtDate(new Date());

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
                    <h3 style="margin:0">${monthNames[month]} ${year}</h3>
                    <div style="display:flex;gap:8px;align-items:center">
                        <button class="btn btn-sm btn-outline" onclick="App.modules.instalaciones.cambiarMes(-1)">◀</button>
                        <button class="btn btn-sm btn-outline" onclick="App.modules.instalaciones.cambiarMes(0)">Hoy</button>
                        <button class="btn btn-sm btn-outline" onclick="App.modules.instalaciones.cambiarMes(1)">▶</button>
                    </div>
                </div>
                <div class="card-body" style="padding:0">
                    <div style="display:grid;grid-template-columns:repeat(7,1fr)">
                        ${diasSemana.map(d => `<div style="padding:10px;text-align:center;font-weight:600;font-size:12px;border-bottom:2px solid var(--border);color:var(--text-light)">${d}</div>`).join('')}
        `;
        for (let i = 0; i < startOffset; i++) html += '<div style="border-right:1px solid var(--border);border-bottom:1px solid var(--border);min-height:100px;background:var(--bg)"></div>';
        for (let d = 1; d <= daysInMonth; d++) {
            const fs = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
            const instDia = this.instalaciones.filter(inst => inst.fecha_programada && inst.fecha_programada.substring(0, 10) === fs);
            const esHoy = fs === hoyStr;
            const dt = new Date(year, month, d);
            const esFinde = dt.getDay() === 0 || dt.getDay() === 6;
            const bgBase = esHoy ? 'background:rgba(59,130,246,0.08)' : (esFinde ? 'background:var(--bg)' : '');
            html += `<div style="border-right:1px solid var(--border);border-bottom:1px solid var(--border);min-height:100px;padding:4px;${bgBase}">
                <div style="text-align:right;padding:2px 4px;font-size:12px;${esHoy ? 'background:var(--primary);color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;margin-left:auto;font-weight:700' : (esFinde ? 'color:var(--text-light)' : 'color:var(--text)')}">${d}</div>
            `;
            for (const inst of instDia) {
                const color = estadoColor(inst.estado);
                html += `<div onclick="App.modules.inst_detalle.abrir(${inst.id})" style="cursor:pointer;margin:1px 0;padding:3px 5px;border-radius:4px;border-left:3px solid ${color};font-size:10px;line-height:1.3;transition:all .15s" onmouseover="this.style.background='var(--border)'" onmouseout="this.style.background=''">
                    <div style="font-weight:600;color:${color}">${estadoIcon(inst.estado)} ${inst.hora_programada || '09:00'}</div>
                    <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(inst.cliente)}</div>
                </div>`;
            }
            html += '</div>';
        }
        html += '</div></div></div>';
        div.innerHTML = html;
    },

    cambiarMes(dir) {
        if (dir === 0) { this.calMonth = new Date().getMonth(); this.calYear = new Date().getFullYear(); }
        else {
            this.calMonth += dir;
            if (this.calMonth > 11) { this.calMonth = 0; this.calYear++; }
            if (this.calMonth < 0) { this.calMonth = 11; this.calYear--; }
        }
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
    }
});
