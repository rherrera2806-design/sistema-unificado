App.registerModule('instalaciones', {
    instalaciones: [],
    calMonth: new Date().getMonth(),
    calYear: new Date().getFullYear(),

    fmtDate(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },

    async render() {
        const el = document.getElementById('page-instalaciones');
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const permisos = user.permisos || [];
        const puedeCrear = permisos.includes('instalaciones.agregar') || permisos.includes('usuarios');
        el.innerHTML = '<style>'
            + '@keyframes instFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}'
            + '.inst-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}'
            + '.inst-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important}'
            + '.inst-stats{display:flex;gap:10px;margin-bottom:20px;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px}'
            + '.inst-stats .inst-card{min-width:140px;flex:1 0 0}'
            + '.inst-cal-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%}'
            + '.inst-cal-grid{display:grid;grid-template-columns:repeat(7,minmax(90px,1fr));min-width:630px}'
            + '.inst-cal-day{border-right:1px solid #f1f5f9;border-bottom:1px solid #f1f5f9;min-height:70px;padding:3px;overflow:hidden}'
            + '.inst-cal-header{padding:6px 4px;text-align:center;font-weight:700;font-size:10px;border-bottom:1px solid #f1f5f9;color:#64748b;text-transform:uppercase;letter-spacing:0.5px}'
            + '.inst-event{cursor:pointer;margin:1px 0;padding:2px 4px;border-radius:4px;border-left:2px solid;font-size:9px;line-height:1.2;overflow:hidden}'
            + '.inst-event-type{font-weight:700;font-size:8px;text-transform:uppercase;letter-spacing:0.3px}'
            + '.inst-event-time{font-weight:600;font-size:9px}'
            + '.inst-event-client{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#1e293b;font-weight:500;font-size:9px}'
            + '@media(max-width:768px){'
            + '.inst-stats{flex-direction:column;gap:8px;overflow-x:visible;padding-bottom:0}'
            + '.inst-stats .inst-card{min-width:100%;flex:1 1 auto}'
            + '.inst-cal-wrap{overflow-x:visible}'
            + '.inst-cal-grid{min-width:100%;grid-template-columns:1fr}'
            + '.inst-cal-header{display:none}'
            + '.inst-cal-day{min-height:auto;padding:8px 10px;border-right:none}'
            + '.inst-cal-day-empty{display:none}'
            + '.inst-event{padding:4px 6px;font-size:11px;margin:2px 0}'
            + '.inst-event-type{font-size:9px}'
            + '.inst-event-time{font-size:10px}'
            + '.inst-event-client{font-size:10px}'
            + '}'
            + '</style>'

            + '<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:8px 16px;margin-bottom:20px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3);max-width:100%;box-sizing:border-box">'
            + '<div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;max-width:100%">'
            + '<div style="min-width:0"><h2 style="margin:0;font-size:15px;font-weight:800;color:white;letter-spacing:-0.5px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-3px;margin-right:6px"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Instalaciones</h2>'
            + '<p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Calendario mensual de trabajos en terreno</p></div>'
            + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
            + '<button class="btn btn-outline" style="color:white;border-color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.1)" onclick="App.modules.instalaciones.showVendedores()" title="Configurar vendedores"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> Vendedores</button>'
            + '<button class="btn btn-outline" style="color:white;border-color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.1)" onclick="App.modules.instalaciones.showTecnicos()" title="Configurar tecnicos"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg> Tecnicos</button>'
            + (puedeCrear ? '<button class="btn btn-primary" onclick="App.modules.instalaciones.showForm()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo</button>' : '')
            + '</div></div></div>'

            + '<div id="instStats" class="inst-stats"></div>'
            + '<div id="instCalendario"></div>';
        await this.loadData();
    },

    async loadData() {
        const firstDay = this.fmtDate(new Date(this.calYear, this.calMonth, 1));
        const lastDay = this.fmtDate(new Date(this.calYear, this.calMonth + 1, 0));
        try {
            const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const res = await fetch(`/api/instalaciones/calendario?inicio=${firstDay}&fin=${lastDay}`, { headers });
            const data = await res.json();
            this.instalaciones = Array.isArray(data) ? data : [];
            this.renderStats();
            this.renderCalendario();
        } catch(e) { console.error('Error:', e); this.instalaciones = []; }
    },

    renderStats() {
        const total = this.instalaciones.length;
        const prog = this.instalaciones.filter(i => i.estado === 'PROGRAMADA').length;
        const curso = this.instalaciones.filter(i => i.estado === 'EN_CURSO' || i.estado === 'EN_CAMINO').length;
        const comp = this.instalaciones.filter(i => i.estado === 'COMPLETADA').length;
        const nov = this.instalaciones.filter(i => i.estado === 'CON_NOVEDADES' || i.estado === 'CANCELADA').length;
        document.getElementById('instStats').innerHTML = ''
            + '<div class="inst-card" style="background:white;border:1px solid #e2e8f0;border-left:4px solid #3b82f6;border-radius:10px;padding:8px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:instFadeUp 0.5s ease 0ms both;display:flex;align-items:center;gap:8px;box-sizing:border-box">'
            + '<div style="width:30px;height:30px;border-radius:6px;background:linear-gradient(135deg,#eff6ff,#bfdbfe);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></div>'
            + '<div style="min-width:0"><div style="font-size:18px;font-weight:800;color:#1e293b;line-height:1">' + total + '</div><div style="font-size:9px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Total</div></div></div>'

            + '<div class="inst-card" style="background:white;border:1px solid #e2e8f0;border-left:4px solid #3b82f6;border-radius:10px;padding:8px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:instFadeUp 0.5s ease 60ms both;display:flex;align-items:center;gap:8px;box-sizing:border-box">'
            + '<div style="width:30px;height:30px;border-radius:6px;background:linear-gradient(135deg,#eff6ff,#bfdbfe);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>'
            + '<div style="min-width:0"><div style="font-size:18px;font-weight:800;color:#3b82f6;line-height:1">' + prog + '</div><div style="font-size:9px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Programadas</div></div></div>'

            + '<div class="inst-card" style="background:white;border:1px solid #e2e8f0;border-left:4px solid #f59e0b;border-radius:10px;padding:8px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:instFadeUp 0.5s ease 120ms both;display:flex;align-items:center;gap:8px;box-sizing:border-box">'
            + '<div style="width:30px;height:30px;border-radius:6px;background:linear-gradient(135deg,#fef3c7,#fde68a);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></div>'
            + '<div style="min-width:0"><div style="font-size:18px;font-weight:800;color:#f59e0b;line-height:1">' + curso + '</div><div style="font-size:9px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">En Curso</div></div></div>'

            + '<div class="inst-card" style="background:white;border:1px solid #e2e8f0;border-left:4px solid #22c55e;border-radius:10px;padding:8px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:instFadeUp 0.5s ease 180ms both;display:flex;align-items:center;gap:8px;box-sizing:border-box">'
            + '<div style="width:30px;height:30px;border-radius:6px;background:linear-gradient(135deg,#f0fdf4,#bbf7d0);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>'
            + '<div style="min-width:0"><div style="font-size:18px;font-weight:800;color:#22c55e;line-height:1">' + comp + '</div><div style="font-size:9px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Completadas</div></div></div>'

            + '<div class="inst-card" style="background:white;border:1px solid #e2e8f0;border-left:4px solid #ef4444;border-radius:10px;padding:8px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:instFadeUp 0.5s ease 240ms both;display:flex;align-items:center;gap:8px;box-sizing:border-box">'
            + '<div style="width:30px;height:30px;border-radius:6px;background:linear-gradient(135deg,#fef2f2,#fecaca);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>'
            + '<div style="min-width:0"><div style="font-size:18px;font-weight:800;color:#ef4444;line-height:1">' + nov + '</div><div style="font-size:9px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Novedades</div></div></div>';
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
            if (e === 'COMPLETADA') return '#16a34a';
            if (e === 'EN_CURSO' || e === 'EN_CAMINO') return '#f59e0b';
            if (e === 'CON_NOVEDADES') return '#dc2626';
            if (e === 'CANCELADA') return '#94a3b8';
            return '#3b82f6';
        };
        const estadoBg = (e) => {
            if (e === 'COMPLETADA') return '#f0fdf4';
            if (e === 'EN_CURSO' || e === 'EN_CAMINO') return '#fffbeb';
            if (e === 'CON_NOVEDADES') return '#fef2f2';
            if (e === 'CANCELADA') return '#f8fafc';
            return '#eff6ff';
        };
        const estadoIcon = (e) => {
            if (e === 'COMPLETADA') return '✓';
            if (e === 'EN_CURSO') return '⚙';
            if (e === 'EN_CAMINO') return '→';
            if (e === 'CON_NOVEDADES') return '!';
            if (e === 'CANCELADA') return '×';
            return '';
        };

        let html = `
            <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.06);max-width:100%;overflow:hidden;box-sizing:border-box">
                <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #f1f5f9;flex-wrap:wrap;gap:8px">
                    <h3 style="margin:0;font-size:16px;font-weight:700;color:#1e293b">${monthNames[month]} ${year}</h3>
                    <div style="display:flex;gap:6px;align-items:center">
                        <button class="btn btn-outline" onclick="App.modules.instalaciones.cambiarMes(-1)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><polyline points="15 18 9 12 15 6"/></svg></button>
                        <button class="btn btn-info" onclick="App.modules.instalaciones.cambiarMes(0)">Hoy</button>
                        <button class="btn btn-outline" onclick="App.modules.instalaciones.cambiarMes(1)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><polyline points="9 18 15 12 9 6"/></svg></button>
                    </div>
                </div>
                <div class="inst-cal-wrap">
                <div class="inst-cal-grid">
                    ${diasSemana.map(d => `<div class="inst-cal-header">${d}</div>`).join('')}
        `;
        for (let i = 0; i < startOffset; i++) html += '<div class="inst-cal-day inst-cal-day-empty" style="background:#fafbfc"></div>';
        for (let d = 1; d <= daysInMonth; d++) {
            const fs = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
            const instDia = this.instalaciones.filter(inst => inst.fecha_programada && inst.fecha_programada.substring(0, 10) === fs);
            const esHoy = fs === hoyStr;
            const dt = new Date(year, month, d);
            const esFinde = dt.getDay() === 0 || dt.getDay() === 6;
            const bgBase = esHoy ? 'background:#eff6ff' : (esFinde ? 'background:#fafbfc' : '');
            html += `<div class="inst-cal-day" style="${bgBase}">
                <div style="text-align:right;padding:1px 3px;font-size:11px;${esHoy ? 'background:#3b82f6;color:#fff;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;margin-left:auto;font-weight:700' : (esFinde ? 'color:#94a3b8' : 'color:#1e293b')}">${d}</div>
            `;
            for (const inst of instDia) {
                const color = estadoColor(inst.estado);
                const bg = estadoBg(inst.estado);
                html += `<div class="inst-event" onclick="App.modules.inst_detalle.abrir(${inst.id})" style="border-left-color:${color};background:${bg}" onmouseover="this.style.transform='scale(1.02)';this.style.boxShadow='0 2px 4px rgba(0,0,0,0.1)'" onmouseout="this.style.transform='scale(1)';this.style.boxShadow='none'">
                    <div class="inst-event-type" style="color:${color}">${escapeHtml(inst.tipo || 'INSTALACION').replace('_',' ')}</div>
                    <div class="inst-event-time" style="color:${color}">${inst.hora_programada || '09:00'}${inst.numero_orden ? ' · ' + escapeHtml(inst.numero_orden) : ''}</div>
                    <div class="inst-event-client">${escapeHtml(inst.cliente)}</div>
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

    async showForm(id) {
        const inst = id ? (this.instalaciones || []).find(i => i.id === id) : null;
        const hoy = this.fmtDate(new Date());
        let tecnicos = [];
        let vendedores = [];
        const hdrs = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
        try { tecnicos = await fetch('/api/instalaciones/tecnicos', { headers: hdrs }).then(r => r.json()); } catch(e) {}
        try { vendedores = await fetch('/api/instalaciones/vendedores', { headers: hdrs }).then(r => r.json()); } catch(e) {}
        const datalistHtml = `<datalist id="tecnicosList">${(tecnicos || []).map(t => `<option value="${escapeHtml(t)}">`).join('')}</datalist><datalist id="vendedoresList">${(vendedores || []).map(v => `<option value="${escapeHtml(v)}">`).join('')}</datalist>`;
        App.showModal(`
            ${datalistHtml}
            <div class="form-group"><label>Tipo de servicio *</label>
                <select class="form-control" id="instTipo" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
                    <option value="VISITA_TECNICA" ${inst?.tipo === 'VISITA_TECNICA' ? 'selected' : ''}>Visita Tecnica</option>
                    <option value="INSTALACION" ${inst?.tipo === 'INSTALACION' || !inst ? 'selected' : ''}>Instalacion</option>
                    <option value="POST_VENTA" ${inst?.tipo === 'POST_VENTA' ? 'selected' : ''}>Post-Venta</option>
                </select>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group"><label>Cliente *</label><input class="form-control" id="instCliente" value="${inst ? escapeHtml(inst.cliente) : ''}" placeholder="Nombre del cliente" style="text-transform:uppercase" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
                <div class="form-group"><label>Tecnico Asignado</label><input class="form-control" id="instTecnico" value="${inst ? escapeHtml(inst.tecnico) : ''}" placeholder="Nombre del tecnico" style="text-transform:capitalize" list="tecnicosList" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group"><label>Vendedor</label><input class="form-control" id="instVendedor" value="${inst ? escapeHtml(inst.vendedor || '') : ''}" placeholder="Nombre del vendedor" style="text-transform:capitalize" list="vendedoresList" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
                <div class="form-group"><label>Numero de Orden</label><input class="form-control" id="instNumeroOrden" value="${inst ? escapeHtml(inst.numero_orden || '') : ''}" placeholder="Numero de orden" style="text-transform:uppercase" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
            </div>
            <div class="form-group"><label>Direccion *</label>
                <div style="display:flex;gap:6px;align-items:center">
                    <input class="form-control" id="instDireccion" value="${inst ? escapeHtml(inst.direccion) : ''}" placeholder="Direccion de la instalacion" style="text-transform:capitalize;flex:1" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
                    <a href="https://www.google.com/maps/search/?api=1&query=" target="_blank" id="instMapGoogle" title="Google Maps" style="display:inline-flex;align-items:center;padding:6px 10px;border-radius:6px;font-size:12px;background:#dcfce7;color:#166534;text-decoration:none;border:1px solid #bbf7d0;white-space:nowrap" onclick="this.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(document.getElementById('instDireccion').value)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:3px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> Maps</a>
                    <a href="https://www.waze.com/ul?q=" target="_blank" id="instMapWaze" title="Waze" style="display:inline-flex;align-items:center;padding:6px 10px;border-radius:6px;font-size:12px;background:#dbeafe;color:#1e40af;text-decoration:none;border:1px solid #bfdbfe;white-space:nowrap" onclick="this.href='https://www.waze.com/ul?q='+encodeURIComponent(document.getElementById('instDireccion').value)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:3px"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> Waze</a>
                </div>
            </div>
            <div class="form-group"><label>Descripcion</label><textarea class="form-control" id="instDescripcion" rows="2" placeholder="Detalle de vidrios o estructuras a instalar" style="text-transform:capitalize" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">${inst ? escapeHtml(inst.descripcion) : ''}</textarea></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group"><label>Fecha Programada *</label><input type="date" class="form-control" id="instFecha" value="${inst ? inst.fecha_programada.substring(0, 10) : hoy}" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
                <div class="form-group"><label>Hora</label><input type="time" class="form-control" id="instHora" value="${inst ? inst.hora_programada : '09:00'}" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
            </div>
            <div class="form-group"><label>Notas Previas</label><textarea class="form-control" id="instNotas" rows="2" placeholder="Notas o instrucciones previas" style="text-transform:capitalize" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">${inst ? escapeHtml(inst.notas_previas) : ''}</textarea></div>
        `, { title: inst ? 'Editar Registro' : 'Nuevo Registro' });
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
            vendedor: capitalize(document.getElementById('instVendedor').value.trim()),
            numero_orden: document.getElementById('instNumeroOrden').value.trim().toUpperCase(),
            notas_previas: capitalize(document.getElementById('instNotas').value.trim()),
            tipo: document.getElementById('instTipo').value
        };
        if (!data.cliente || !data.direccion || !data.fecha_programada) { App.showAlert('Cliente, direccion y fecha requeridos', 'danger'); return; }
        const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
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

    async showTecnicos() {
        let list = [];
        const hdrs = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
        try { list = await fetch('/api/produccion/tecnicos', { headers: hdrs }).then(r => r.json()); } catch(e) {}
        list = Array.isArray(list) ? list : [];
        const rows = list.map(t => {
            const badge = t.activo
                ? '<span style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;color:#166534;background:#dcfce7">Activo</span>'
                : '<span style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;color:#94a3b8;background:#f1f5f9">Inactivo</span>';
            const esc = escapeHtml(t.nombre).replace(/'/g,"\\'");
            return '<tr style="border-bottom:1px solid #f1f5f9;transition:background 0.1s" onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'white\'">'
                + '<td style="padding:10px 14px;font-weight:600;color:#1e293b">' + escapeHtml(t.nombre) + '</td>'
                + '<td style="padding:10px 14px">' + badge + '</td>'
                + '<td style="padding:10px 14px;text-align:right">'
                + '<button onclick="App.modules.instalaciones.formTecnico(' + t.id + ',\'' + esc + '\',' + t.activo + ')" title="Editar" class="btn btn-sm btn-outline" style="margin-right:4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>'
                + '<button onclick="App.modules.instalaciones.eliminarTecnico(' + t.id + ')" title="Eliminar" class="btn btn-sm btn-danger"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>'
                + '</td></tr>';
        }).join('');
        const tableHtml = list.length === 0
            ? '<div style="text-align:center;color:#94a3b8;padding:24px;font-size:13px">No hay tecnicos. Agrega uno para que aparezca en el desplegable.</div>'
            : '<div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden"><table style="width:100%;border-collapse:collapse;font-size:13px">'
            + '<thead><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">'
            + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Nombre</th>'
            + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Estado</th>'
            + '<th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Acciones</th>'
            + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
        const html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
            + '<h3 style="margin:0;font-size:16px;font-weight:700;color:#1e293b">Tecnicos (' + list.length + ')</h3>'
            + '<button onclick="App.modules.instalaciones.formTecnico()" class="btn btn-primary btn-sm"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo</button>'
            + '</div><div id="tecnicoFormInst"></div>' + tableHtml;
        App.showModal(html, { title: 'Configurar Tecnicos' });
    },

    formTecnico(id, nombre, activo) {
        const el = document.getElementById('tecnicoFormInst');
        if (!el) return;
        el.innerHTML = '<div style="display:flex;gap:8px;align-items:end;margin-bottom:16px;padding:14px;background:#f0f9ff;border-radius:8px;border:1px solid #bfdbfe">'
            + '<div style="flex:1"><label style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Nombre</label>'
            + '<input id="tecNombreInst" value="' + (nombre || '').replace(/"/g,'&quot;') + '" placeholder="Nombre del tecnico" style="font-size:13px;width:100%;background:white;border:1px solid #e2e8f0;color:#1e293b;padding:8px 12px;border-radius:6px;box-sizing:border-box" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'"></div>'
            + '<div style="flex:0"><label style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Activo</label>'
            + '<select id="tecActivoInst" style="font-size:13px;background:white;border:1px solid #e2e8f0;color:#1e293b;padding:8px 12px;border-radius:6px" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'">'
            + '<option value="true"' + (activo !== false ? ' selected' : '') + '>Si</option>'
            + '<option value="false"' + (activo === false ? ' selected' : '') + '>No</option>'
            + '</select></div>'
            + '<button onclick="App.modules.instalaciones.guardarTecnico(' + (id || 0) + ')" class="btn btn-primary"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Guardar</button>'
            + '<button onclick="document.getElementById(\'tecnicoFormInst\').innerHTML=\'\'" class="btn btn-outline">Cancelar</button>'
            + '</div>';
    },

    async guardarTecnico(id) {
        const nombre = (document.getElementById('tecNombreInst').value || '').trim();
        const activo = document.getElementById('tecActivoInst').value === 'true';
        if (!nombre) { App.showAlert('Nombre requerido', 'danger'); return; }
        const hdrs = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
        try {
            if (id === 0) await fetch('/api/produccion/tecnicos', { method: 'POST', headers: hdrs, body: JSON.stringify({ nombre, activo }) });
            else await fetch(`/api/produccion/tecnicos/${id}`, { method: 'PUT', headers: hdrs, body: JSON.stringify({ nombre, activo }) });
            await this.showTecnicos();
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    async eliminarTecnico(id) {
        if (!confirm('Eliminar este tecnico?')) return;
        const hdrs = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
        try {
            await fetch(`/api/produccion/tecnicos/${id}`, { method: 'DELETE', headers: hdrs });
            await this.showTecnicos();
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    async showVendedores() {
        let list = [];
        const hdrs = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
        try { list = await fetch('/api/produccion/vendedores', { headers: hdrs }).then(r => r.json()); } catch(e) {}
        list = Array.isArray(list) ? list : [];
        const rows = list.map(v => {
            const badge = v.activo
                ? '<span style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;color:#166534;background:#dcfce7">Activo</span>'
                : '<span style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;color:#94a3b8;background:#f1f5f9">Inactivo</span>';
            const esc = escapeHtml(v.nombre).replace(/'/g,"\\'");
            return '<tr style="border-bottom:1px solid #f1f5f9;transition:background 0.1s" onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'white\'">'
                + '<td style="padding:10px 14px;font-weight:600;color:#1e293b">' + escapeHtml(v.nombre) + '</td>'
                + '<td style="padding:10px 14px">' + badge + '</td>'
                + '<td style="padding:10px 14px;text-align:right">'
                + '<button onclick="App.modules.instalaciones.formVendedor(' + v.id + ',\'' + esc + '\',' + v.activo + ')" title="Editar" class="btn btn-sm btn-outline" style="margin-right:4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>'
                + '<button onclick="App.modules.instalaciones.eliminarVendedor(' + v.id + ')" title="Eliminar" class="btn btn-sm btn-danger"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>'
                + '</td></tr>';
        }).join('');
        const tableHtml = list.length === 0
            ? '<div style="text-align:center;color:#94a3b8;padding:24px;font-size:13px">No hay vendedores. Agrega uno para que aparezca en el desplegable.</div>'
            : '<div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden"><table style="width:100%;border-collapse:collapse;font-size:13px">'
            + '<thead><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">'
            + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Nombre</th>'
            + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Estado</th>'
            + '<th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Acciones</th>'
            + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
        const html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
            + '<h3 style="margin:0;font-size:16px;font-weight:700;color:#1e293b">Vendedores (' + list.length + ')</h3>'
            + '<button onclick="App.modules.instalaciones.formVendedor()" class="btn btn-primary btn-sm"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo</button>'
            + '</div><div id="vendedorFormInst"></div>' + tableHtml;
        App.showModal(html, { title: 'Configurar Vendedores' });
    },

    formVendedor(id, nombre, activo) {
        const el = document.getElementById('vendedorFormInst');
        if (!el) return;
        el.innerHTML = '<div style="display:flex;gap:8px;align-items:end;margin-bottom:16px;padding:14px;background:#f0f9ff;border-radius:8px;border:1px solid #bfdbfe">'
            + '<div style="flex:1"><label style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Nombre</label>'
            + '<input id="vendNombreInst" value="' + (nombre || '').replace(/"/g,'&quot;') + '" placeholder="Nombre del vendedor" style="font-size:13px;width:100%;background:white;border:1px solid #e2e8f0;color:#1e293b;padding:8px 12px;border-radius:6px;box-sizing:border-box" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'"></div>'
            + '<div style="flex:0"><label style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Activo</label>'
            + '<select id="vendActivoInst" style="font-size:13px;background:white;border:1px solid #e2e8f0;color:#1e293b;padding:8px 12px;border-radius:6px" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'">'
            + '<option value="true"' + (activo !== false ? ' selected' : '') + '>Si</option>'
            + '<option value="false"' + (activo === false ? ' selected' : '') + '>No</option>'
            + '</select></div>'
            + '<button onclick="App.modules.instalaciones.guardarVendedor(' + (id || 0) + ')" class="btn btn-primary"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Guardar</button>'
            + '<button onclick="document.getElementById(\'vendedorFormInst\').innerHTML=\'\'" class="btn btn-outline">Cancelar</button>'
            + '</div>';
    },

    async guardarVendedor(id) {
        const nombre = (document.getElementById('vedNombreInst').value || '').trim();
        const activo = document.getElementById('vedActivoInst').value === 'true';
        if (!nombre) { App.showAlert('Nombre requerido', 'danger'); return; }
        const hdrs = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
        try {
            if (id === 0) await fetch('/api/produccion/vendedores', { method: 'POST', headers: hdrs, body: JSON.stringify({ nombre, activo }) });
            else await fetch(`/api/produccion/vendedores/${id}`, { method: 'PUT', headers: hdrs, body: JSON.stringify({ nombre, activo }) });
            await this.showVendedores();
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    async eliminarVendedor(id) {
        if (!confirm('Eliminar este vendedor?')) return;
        const hdrs = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
        try {
            await fetch(`/api/produccion/vendedores/${id}`, { method: 'DELETE', headers: hdrs });
            await this.showVendedores();
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    }
});
