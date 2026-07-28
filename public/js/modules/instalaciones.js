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
        const puedeCrear = permisos.includes('instalaciones.nueva') || permisos.includes('usuarios');
        el.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
                <div>
                    <h2 style="margin:0;font-size:22px;font-weight:700;color:#1e293b">Instalaciones</h2>
                    <p style="margin:4px 0 0;font-size:13px;color:#64748b">Calendario mensual de trabajos en terreno</p>
                </div>
                <div style="display:flex;gap:8px">
                    <button onclick="App.modules.instalaciones.showVendedores()" title="Configurar vendedores" style="padding:8px 16px;font-size:12px;font-weight:600;color:#64748b;background:white;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;transition:all 0.15s" onmouseover="this.style.background='#f8fafc';this.style.borderColor='#cbd5e1'" onmouseout="this.style.background='white';this.style.borderColor='#e2e8f0'">Vendedores</button>
                    <button onclick="App.modules.instalaciones.showTecnicos()" title="Configurar tecnicos" style="padding:8px 16px;font-size:12px;font-weight:600;color:#64748b;background:white;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;transition:all 0.15s" onmouseover="this.style.background='#f8fafc';this.style.borderColor='#cbd5e1'" onmouseout="this.style.background='white';this.style.borderColor='#e2e8f0'">Tecnicos</button>
                    ${puedeCrear ? '<button onclick="App.modules.instalaciones.showForm()" style="padding:8px 18px;font-size:13px;font-weight:600;color:white;background:#3b82f6;border:none;border-radius:8px;cursor:pointer;transition:background 0.15s" onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">+ Nuevo</button>' : ''}
                </div>
            </div>
            <div id="instStats" style="display:grid;grid-template-columns:repeat(5,1fr);gap:16px;margin-bottom:24px"></div>
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
            <div style="background:white;border:1px solid #e2e8f0;border-left:4px solid #3b82f6;border-radius:10px;padding:16px 20px;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
                <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Total</div>
                <div style="font-size:28px;font-weight:800;color:#1e293b;line-height:1">${total}</div>
            </div>
            <div style="background:white;border:1px solid #e2e8f0;border-left:4px solid #3b82f6;border-radius:10px;padding:16px 20px;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
                <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Programadas</div>
                <div style="font-size:28px;font-weight:800;color:#3b82f6;line-height:1">${prog}</div>
            </div>
            <div style="background:white;border:1px solid #e2e8f0;border-left:4px solid #f59e0b;border-radius:10px;padding:16px 20px;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
                <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">En Curso</div>
                <div style="font-size:28px;font-weight:800;color:#f59e0b;line-height:1">${curso}</div>
            </div>
            <div style="background:white;border:1px solid #e2e8f0;border-left:4px solid #16a34a;border-radius:10px;padding:16px 20px;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
                <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Completadas</div>
                <div style="font-size:28px;font-weight:800;color:#16a34a;line-height:1">${comp}</div>
            </div>
            <div style="background:white;border:1px solid #e2e8f0;border-left:4px solid #dc2626;border-radius:10px;padding:16px 20px;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
                <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Novedades</div>
                <div style="font-size:28px;font-weight:800;color:#dc2626;line-height:1">${nov}</div>
            </div>
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
            <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
                <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #f1f5f9">
                    <h3 style="margin:0;font-size:16px;font-weight:700;color:#1e293b">${monthNames[month]} ${year}</h3>
                    <div style="display:flex;gap:6px;align-items:center">
                        <button onclick="App.modules.instalaciones.cambiarMes(-1)" style="padding:6px 12px;font-size:12px;font-weight:600;color:#64748b;background:white;border:1px solid #e2e8f0;border-radius:6px;cursor:pointer;transition:all 0.15s" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">&#9664;</button>
                        <button onclick="App.modules.instalaciones.cambiarMes(0)" style="padding:6px 12px;font-size:12px;font-weight:600;color:#3b82f6;background:white;border:1px solid #bfdbfe;border-radius:6px;cursor:pointer;transition:all 0.15s" onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='white'">Hoy</button>
                        <button onclick="App.modules.instalaciones.cambiarMes(1)" style="padding:6px 12px;font-size:12px;font-weight:600;color:#64748b;background:white;border:1px solid #e2e8f0;border-radius:6px;cursor:pointer;transition:all 0.15s" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">&#9654;</button>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(7,1fr)">
                    ${diasSemana.map(d => `<div style="padding:10px;text-align:center;font-weight:700;font-size:11px;border-bottom:1px solid #f1f5f9;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">${d}</div>`).join('')}
        `;
        for (let i = 0; i < startOffset; i++) html += '<div style="border-right:1px solid #f1f5f9;border-bottom:1px solid #f1f5f9;min-height:100px;background:#fafbfc"></div>';
        for (let d = 1; d <= daysInMonth; d++) {
            const fs = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
            const instDia = this.instalaciones.filter(inst => inst.fecha_programada && inst.fecha_programada.substring(0, 10) === fs);
            const esHoy = fs === hoyStr;
            const dt = new Date(year, month, d);
            const esFinde = dt.getDay() === 0 || dt.getDay() === 6;
            const bgBase = esHoy ? 'background:#eff6ff' : (esFinde ? 'background:#fafbfc' : '');
            html += `<div style="border-right:1px solid #f1f5f9;border-bottom:1px solid #f1f5f9;min-height:100px;padding:4px;${bgBase}">
                <div style="text-align:right;padding:2px 4px;font-size:12px;${esHoy ? 'background:#3b82f6;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;margin-left:auto;font-weight:700' : (esFinde ? 'color:#94a3b8' : 'color:#1e293b')}">${d}</div>
            `;
            for (const inst of instDia) {
                const color = estadoColor(inst.estado);
                const bg = estadoBg(inst.estado);
                html += `<div onclick="App.modules.inst_detalle.abrir(${inst.id})" style="cursor:pointer;margin:2px 0;padding:4px 6px;border-radius:6px;border-left:3px solid ${color};background:${bg};font-size:10px;line-height:1.3;transition:all .15s" onmouseover="this.style.transform='scale(1.02)';this.style.boxShadow='0 2px 4px rgba(0,0,0,0.1)'" onmouseout="this.style.transform='scale(1)';this.style.boxShadow='none'">
                    <div style="font-weight:700;color:${color};font-size:9px;text-transform:uppercase;letter-spacing:0.5px">${escapeHtml(inst.tipo || 'INSTALACION').replace('_',' ')}</div>
                    <div style="font-weight:600;color:${color}">${inst.hora_programada || '09:00'}${inst.numero_orden ? ' · ' + escapeHtml(inst.numero_orden) : ''}</div>
                    <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#1e293b;font-weight:500">${escapeHtml(inst.cliente)}</div>
                </div>`;
            }
            html += '</div>';
        }
        html += '</div></div>';
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
        const inst = id ? this.instalaciones.find(i => i.id === id) : null;
        const hoy = this.fmtDate(new Date());
        let tecnicos = [];
        let vendedores = [];
        try { tecnicos = await fetch('/api/instalaciones/tecnicos').then(r => r.json()); } catch(e) {}
        try { vendedores = await fetch('/api/instalaciones/vendedores').then(r => r.json()); } catch(e) {}
        const datalistHtml = `<datalist id="tecnicosList">${(tecnicos || []).map(t => `<option value="${escapeHtml(t)}">`).join('')}</datalist><datalist id="vendedoresList">${(vendedores || []).map(v => `<option value="${escapeHtml(v)}">`).join('')}</datalist>`;
        App.showModal(`
            ${datalistHtml}
            <div class="form-group"><label>Tipo de servicio *</label>
                <select class="form-control" id="instTipo">
                    <option value="VISITA_TECNICA" ${inst?.tipo === 'VISITA_TECNICA' ? 'selected' : ''}>Visita Tecnica</option>
                    <option value="INSTALACION" ${inst?.tipo === 'INSTALACION' || !inst ? 'selected' : ''}>Instalacion</option>
                    <option value="POST_VENTA" ${inst?.tipo === 'POST_VENTA' ? 'selected' : ''}>Post-Venta</option>
                </select>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group"><label>Cliente *</label><input class="form-control" id="instCliente" value="${inst ? escapeHtml(inst.cliente) : ''}" placeholder="Nombre del cliente" style="text-transform:uppercase"></div>
                <div class="form-group"><label>Tecnico Asignado</label><input class="form-control" id="instTecnico" value="${inst ? escapeHtml(inst.tecnico) : ''}" placeholder="Nombre del tecnico" style="text-transform:capitalize" list="tecnicosList"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group"><label>Vendedor</label><input class="form-control" id="instVendedor" value="${inst ? escapeHtml(inst.vendedor || '') : ''}" placeholder="Nombre del vendedor" style="text-transform:capitalize" list="vendedoresList"></div>
                <div class="form-group"><label>Numero de Orden</label><input class="form-control" id="instNumeroOrden" value="${inst ? escapeHtml(inst.numero_orden || '') : ''}" placeholder="Numero de orden" style="text-transform:uppercase"></div>
            </div>
            <div class="form-group"><label>Direccion *</label>
                <div style="display:flex;gap:6px;align-items:center">
                    <input class="form-control" id="instDireccion" value="${inst ? escapeHtml(inst.direccion) : ''}" placeholder="Direccion de la instalacion" style="text-transform:capitalize;flex:1">
                    <a href="https://www.google.com/maps/search/?api=1&query=" target="_blank" id="instMapGoogle" title="Google Maps" style="display:inline-flex;align-items:center;padding:6px 10px;border-radius:6px;font-size:12px;background:#dcfce7;color:#166534;text-decoration:none;border:1px solid #bbf7d0;white-space:nowrap" onclick="this.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(document.getElementById('instDireccion').value)">📍 Maps</a>
                    <a href="https://www.waze.com/ul?q=" target="_blank" id="instMapWaze" title="Waze" style="display:inline-flex;align-items:center;padding:6px 10px;border-radius:6px;font-size:12px;background:#dbeafe;color:#1e40af;text-decoration:none;border:1px solid #bfdbfe;white-space:nowrap" onclick="this.href='https://www.waze.com/ul?q='+encodeURIComponent(document.getElementById('instDireccion').value)">🚗 Waze</a>
                </div>
            </div>
            <div class="form-group"><label>Descripcion</label><textarea class="form-control" id="instDescripcion" rows="2" placeholder="Detalle de vidrios o estructuras a instalar" style="text-transform:capitalize">${inst ? escapeHtml(inst.descripcion) : ''}</textarea></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group"><label>Fecha Programada *</label><input type="date" class="form-control" id="instFecha" value="${inst ? inst.fecha_programada.substring(0, 10) : hoy}"></div>
                <div class="form-group"><label>Hora</label><input type="time" class="form-control" id="instHora" value="${inst ? inst.hora_programada : '09:00'}"></div>
            </div>
            <div class="form-group"><label>Notas Previas</label><textarea class="form-control" id="instNotas" rows="2" placeholder="Notas o instrucciones previas" style="text-transform:capitalize">${inst ? escapeHtml(inst.notas_previas) : ''}</textarea></div>
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
    },

    async showTecnicos() {
        let list = [];
        try { list = await fetch('/api/produccion/tecnicos').then(r => r.json()); } catch(e) {}
        list = Array.isArray(list) ? list : [];
        const html = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                <h3 style="margin:0;font-size:16px;font-weight:700;color:#1e293b">Tecnicos (${list.length})</h3>
                <button onclick="App.modules.instalaciones.formTecnico()" style="padding:6px 14px;font-size:12px;font-weight:600;color:white;background:#3b82f6;border:none;border-radius:6px;cursor:pointer;transition:background 0.15s" onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">+ Nuevo</button>
            </div>
            <div id="tecnicoFormInst"></div>
            ${list.length === 0 ? '<div style="text-align:center;color:#94a3b8;padding:24px;font-size:13px">No hay tecnicos. Agrega uno para que aparezca en el desplegable.</div>' :
            `<div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
                <table style="width:100%;border-collapse:collapse;font-size:13px">
                    <thead><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">
                        <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Nombre</th>
                        <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Estado</th>
                        <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Acciones</th>
                    </tr></thead>
                    <tbody>${list.map(t => `
                        <tr style="border-bottom:1px solid #f1f5f9;transition:background 0.1s" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                            <td style="padding:10px 14px;font-weight:600;color:#1e293b">${escapeHtml(t.nombre)}</td>
                            <td style="padding:10px 14px"><span style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;${t.activo ? 'color:#166534;background:#dcfce7' : 'color:#94a3b8;background:#f1f5f9'}">${t.activo ? 'Activo' : 'Inactivo'}</span></td>
                            <td style="padding:10px 14px;text-align:right">
                                <button onclick="App.modules.instalaciones.formTecnico(${t.id},'${escapeHtml(t.nombre).replace(/'/g,"\\'")}',${t.activo})" style="background:white;color:#64748b;border:1px solid #e2e8f0;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:12px;display:inline-flex;align-items:center;justify-content:center;transition:all 0.15s;margin-right:4px" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">&#9998;</button>
                                <button onclick="App.modules.instalaciones.eliminarTecnico(${t.id})" style="background:white;color:#dc2626;border:1px solid #fecaca;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:12px;display:inline-flex;align-items:center;justify-content:center;transition:all 0.15s" onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='white'">&#10005;</button>
                            </td>
                        </tr>
                    `).join('')}</tbody>
                </table>
            </div>`};
        App.showModal(html, { title: 'Configurar Tecnicos' });
    },

    formTecnico(id, nombre, activo) {
        const el = document.getElementById('tecnicoFormInst');
        if (el) el.innerHTML = `
            <div style="display:flex;gap:8px;align-items:end;margin-bottom:16px;padding:14px;background:#f0f9ff;border-radius:8px;border:1px solid #bfdbfe">
                <div style="flex:1">
                    <label style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Nombre</label>
                    <input id="tecNombreInst" value="${nombre || ''}" placeholder="Nombre del tecnico" style="font-size:13px;width:100%;background:white;border:1px solid #e2e8f0;color:#1e293b;padding:8px 12px;border-radius:6px;box-sizing:border-box">
                </div>
                <div style="flex:0">
                    <label style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Activo</label>
                    <select id="tecActivoInst" style="font-size:13px;background:white;border:1px solid #e2e8f0;color:#1e293b;padding:8px 12px;border-radius:6px"><option value="true" ${activo !== false ? 'selected' : ''}>Si</option><option value="false" ${activo === false ? 'selected' : ''}>No</option></select>
                </div>
                <button onclick="App.modules.instalaciones.guardarTecnico(${id || 0})" style="padding:8px 16px;font-size:12px;font-weight:600;color:white;background:#3b82f6;border:none;border-radius:6px;cursor:pointer">Guardar</button>
                <button onclick="document.getElementById('tecnicoFormInst').innerHTML=''" style="padding:8px 16px;font-size:12px;font-weight:500;color:#64748b;background:white;border:1px solid #e2e8f0;border-radius:6px;cursor:pointer">Cancelar</button>
            </div>`;
    },

    async guardarTecnico(id) {
        const nombre = (document.getElementById('tecNombreInst').value || '').trim();
        const activo = document.getElementById('tecActivoInst').value === 'true';
        if (!nombre) { App.showAlert('Nombre requerido', 'danger'); return; }
        try {
            if (id === 0) await fetch('/api/produccion/tecnicos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, activo }) });
            else await fetch(`/api/produccion/tecnicos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, activo }) });
            await this.showTecnicos();
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    async eliminarTecnico(id) {
        if (!confirm('Eliminar este tecnico?')) return;
        try {
            await fetch(`/api/produccion/tecnicos/${id}`, { method: 'DELETE' });
            await this.showTecnicos();
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    async showVendedores() {
        let list = [];
        try { list = await fetch('/api/produccion/vendedores').then(r => r.json()); } catch(e) {}
        list = Array.isArray(list) ? list : [];
        const html = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                <h3 style="margin:0;font-size:16px;font-weight:700;color:#1e293b">Vendedores (${list.length})</h3>
                <button onclick="App.modules.instalaciones.formVendedor()" style="padding:6px 14px;font-size:12px;font-weight:600;color:white;background:#3b82f6;border:none;border-radius:6px;cursor:pointer;transition:background 0.15s" onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">+ Nuevo</button>
            </div>
            <div id="vendedorFormInst"></div>
            ${list.length === 0 ? '<div style="text-align:center;color:#94a3b8;padding:24px;font-size:13px">No hay vendedores. Agrega uno para que aparezca en el desplegable.</div>' :
            `<div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
                <table style="width:100%;border-collapse:collapse;font-size:13px">
                    <thead><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">
                        <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Nombre</th>
                        <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Estado</th>
                        <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Acciones</th>
                    </tr></thead>
                    <tbody>${list.map(v => `
                        <tr style="border-bottom:1px solid #f1f5f9;transition:background 0.1s" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                            <td style="padding:10px 14px;font-weight:600;color:#1e293b">${escapeHtml(v.nombre)}</td>
                            <td style="padding:10px 14px"><span style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;${v.activo ? 'color:#166534;background:#dcfce7' : 'color:#94a3b8;background:#f1f5f9'}">${v.activo ? 'Activo' : 'Inactivo'}</span></td>
                            <td style="padding:10px 14px;text-align:right">
                                <button onclick="App.modules.instalaciones.formVendedor(${v.id},'${escapeHtml(v.nombre).replace(/'/g,"\\'")}',${v.activo})" style="background:white;color:#64748b;border:1px solid #e2e8f0;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:12px;display:inline-flex;align-items:center;justify-content:center;transition:all 0.15s;margin-right:4px" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">&#9998;</button>
                                <button onclick="App.modules.instalaciones.eliminarVendedor(${v.id})" style="background:white;color:#dc2626;border:1px solid #fecaca;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:12px;display:inline-flex;align-items:center;justify-content:center;transition:all 0.15s" onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='white'">&#10005;</button>
                            </td>
                        </tr>
                    `).join('')}</tbody>
                </table>
            </div>`};
        App.showModal(html, { title: 'Configurar Vendedores' });
    },

    formVendedor(id, nombre, activo) {
        const el = document.getElementById('vendedorFormInst');
        if (el) el.innerHTML = `
            <div style="display:flex;gap:8px;align-items:end;margin-bottom:16px;padding:14px;background:#f0f9ff;border-radius:8px;border:1px solid #bfdbfe">
                <div style="flex:1">
                    <label style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Nombre</label>
                    <input id="vedNombreInst" value="${nombre || ''}" placeholder="Nombre del vendedor" style="font-size:13px;width:100%;background:white;border:1px solid #e2e8f0;color:#1e293b;padding:8px 12px;border-radius:6px;box-sizing:border-box">
                </div>
                <div style="flex:0">
                    <label style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Activo</label>
                    <select id="vedActivoInst" style="font-size:13px;background:white;border:1px solid #e2e8f0;color:#1e293b;padding:8px 12px;border-radius:6px"><option value="true" ${activo !== false ? 'selected' : ''}>Si</option><option value="false" ${activo === false ? 'selected' : ''}>No</option></select>
                </div>
                <button onclick="App.modules.instalaciones.guardarVendedor(${id || 0})" style="padding:8px 16px;font-size:12px;font-weight:600;color:white;background:#3b82f6;border:none;border-radius:6px;cursor:pointer">Guardar</button>
                <button onclick="document.getElementById('vendedorFormInst').innerHTML=''" style="padding:8px 16px;font-size:12px;font-weight:500;color:#64748b;background:white;border:1px solid #e2e8f0;border-radius:6px;cursor:pointer">Cancelar</button>
            </div>`;
    },

    async guardarVendedor(id) {
        const nombre = (document.getElementById('vedNombreInst').value || '').trim();
        const activo = document.getElementById('vedActivoInst').value === 'true';
        if (!nombre) { App.showAlert('Nombre requerido', 'danger'); return; }
        try {
            if (id === 0) await fetch('/api/produccion/vendedores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, activo }) });
            else await fetch(`/api/produccion/vendedores/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, activo }) });
            await this.showVendedores();
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    async eliminarVendedor(id) {
        if (!confirm('Eliminar este vendedor?')) return;
        try {
            await fetch(`/api/produccion/vendedores/${id}`, { method: 'DELETE' });
            await this.showVendedores();
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    }
});
