App.modules.planificacion = {
    nombre: 'Planificacion',
    cargaSemanal: [],
    cargaGrupoSemana: [],
    gruposSemana: [],
    diasSemana: [],
    pendientes: [],
    semanaInicio: null,
    semanaFin: null,
    capacidadGrupo: [],
    cargaGrupo: [],
    pendientesGrupo: [],
    fechaGrupo: null,

    fmtDate(d) {
        return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    },

    init() {
        this.calcSemana(new Date());
        if (!this.fechaGrupo) this.fechaGrupo = new Date().toISOString().split('T')[0];
    },

    // ── Vista por GRUPO (kg/dia) ──
    async cargarGrupo() {
        try {
            const res = await fetch(`/api/produccion/planificacion-grupo?fecha=${this.fechaGrupo}`);
            if (!res.ok) {
                const txt = await res.text();
                console.error('planificacion-grupo error:', res.status, txt);
                const elC = document.getElementById('planGrupoCards');
                if (elC) elC.innerHTML = `<div style="background:#fee2e2;border-radius:8px;padding:12px;color:#991b1b;font-size:13px">Error ${res.status} al cargar planificacion-grupo. Revisa la consola.</div>`;
                return;
            }
            const data = await res.json();
            this.capacidadGrupo = data.capacidad || [];
            this.cargaGrupo = data.carga || [];
            this.pendientesGrupo = data.pendientes || [];
            this.renderGrupoResumen();
            this.renderGrupoCards();
            this.renderGrupoPendientes();
        } catch(e) {
            console.error('Error cargarGrupo:', e);
            const elC = document.getElementById('planGrupoCards');
            if (elC) elC.innerHTML = `<div style="background:#fee2e2;border-radius:8px;padding:12px;color:#991b1b;font-size:13px">Error: ${e.message}</div>`;
        }
    },

    renderGrupoResumen() {
        const el = document.getElementById('planGrupoResumen');
        if (!el) return;
        const totalCap = this.capacidadGrupo.reduce((s, c) => s + Number(c.capacidad_kg_dia), 0);
        const totalUsado = this.cargaGrupo.reduce((s, c) => s + Number(c.kg_total), 0);
        const totalOrdenes = this.cargaGrupo.reduce((s, c) => s + Number(c.ordenes), 0);
        const pct = totalCap > 0 ? Math.round((totalUsado / totalCap) * 100) : 0;
        const color = pct > 100 ? '#ef4444' : pct > 85 ? '#f59e0b' : '#10b981';
        el.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
                <div class="card" style="text-align:center"><div class="card-body" style="padding:12px">
                    <div style="font-size:22px;font-weight:700;color:var(--primary)">${totalCap.toLocaleString('es-CL')}</div>
                    <div style="color:var(--text-light);font-size:12px">Capacidad (kg/dia)</div>
                </div></div>
                <div class="card" style="text-align:center"><div class="card-body" style="padding:12px">
                    <div style="font-size:22px;font-weight:700;color:${color}">${totalUsado.toLocaleString('es-CL', {maximumFractionDigits:1})}</div>
                    <div style="color:var(--text-light);font-size:12px">Kg Asignados</div>
                </div></div>
                <div class="card" style="text-align:center"><div class="card-body" style="padding:12px">
                    <div style="font-size:22px;font-weight:700;color:${color}">${pct}%</div>
                    <div style="color:var(--text-light);font-size:12px">Ocupacion</div>
                </div></div>
                <div class="card" style="text-align:center"><div class="card-body" style="padding:12px">
                    <div style="font-size:22px;font-weight:700;color:var(--info)">${totalOrdenes}</div>
                    <div style="color:var(--text-light);font-size:12px">Ordenes Asignadas</div>
                </div></div>
            </div>
        `;
    },

    renderGrupoCards() {
        const el = document.getElementById('planGrupoCards');
        if (!el) return;
        if (!this.capacidadGrupo.length) {
            el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-light)">No hay grupos configurados</div>';
            return;
        }
        el.innerHTML = this.capacidadGrupo.map(c => {
            const cData = this.cargaGrupo.find(x => x.grupo === c.grupo);
            const usado = Number(cData?.kg_total) || 0;
            const ordenes = Number(cData?.ordenes) || 0;
            const cap = Number(c.capacidad_kg_dia) || 0;
            const libre = cap - usado;
            const pct = cap > 0 ? Math.round((usado / cap) * 100) : 0;
            const colorBar = pct > 100 ? '#ef4444' : pct > 85 ? '#f59e0b' : (c.color || '#3b82f6');
            const status = pct > 100 ? 'SOBRECARGADO' : pct > 85 ? 'CASI LLENO' : pct > 0 ? 'OK' : 'VACIO';
            return `
                <div class="card" style="border-left:4px solid ${c.color || '#3b82f6'}">
                    <div class="card-body" style="padding:12px">
                        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                            <div>
                                <div style="font-size:10px;color:var(--text-light);text-transform:uppercase;font-weight:600">${c.grupo}</div>
                                <div style="font-size:18px;font-weight:700;color:${c.color || '#3b82f6'}">${usado.toLocaleString('es-CL', {maximumFractionDigits:1})} <span style="font-size:11px;color:var(--text-light);font-weight:500">/ ${cap.toLocaleString('es-CL')}</span></div>
                            </div>
                            <div style="text-align:right">
                                <div style="font-size:18px;font-weight:700;color:${colorBar}">${pct}%</div>
                                <div style="font-size:9px;padding:1px 6px;border-radius:3px;background:${pct > 100 ? '#fee2e2' : pct > 85 ? '#fef3c7' : '#dcfce7'};color:${pct > 100 ? '#991b1b' : pct > 85 ? '#854d0e' : '#166534'};font-weight:600">${status}</div>
                            </div>
                        </div>
                        <div style="background:#f1f5f9;border-radius:4px;height:8px;overflow:hidden;margin-bottom:6px">
                            <div style="height:100%;width:${Math.min(pct,100)}%;background:${colorBar};transition:width .3s"></div>
                        </div>
                        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-light)">
                            <span>📦 ${ordenes} ord.</span>
                            <span>Libre: <strong style="color:${libre < 0 ? '#ef4444' : '#10b981'}">${libre.toLocaleString('es-CL', {maximumFractionDigits:1})} kg</strong></span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    renderGrupoPendientes() {
        const el = document.getElementById('planGrupoPendientes');
        if (!el) return;
        const sinAsignar = this.pendientesGrupo;
        if (!sinAsignar.length) {
            el.innerHTML = '<div style="background:#dcfce7;border-radius:8px;padding:12px;text-align:center;color:#166534;font-size:13px">✓ No hay ordenes pendientes sin asignar</div>';
            return;
        }
        const kgTotal = sinAsignar.reduce((s, o) => s + Number(o.kilos || 0), 0);
        const sinGrupo = sinAsignar.filter(o => !o.grupo).length;
        const td = 'padding:5px 8px';
        let html = `<div style="background:#fef3c7;padding:8px 12px;font-size:12px;display:flex;justify-content:space-between;border-radius:8px 8px 0 0">
            <strong>${sinAsignar.length} pendientes sin asignar · ${kgTotal.toLocaleString('es-CL', {maximumFractionDigits:1})} kg${sinGrupo ? ` · <span style="color:#ef4444">${sinGrupo} sin grupo</span>` : ''}</strong>
            <span>Click "Asignar" para mover a ${this.fechaGrupo}</span>
        </div>`;
        html += `<div style="max-height:300px;overflow-y:auto"><table style="width:100%;font-size:12px"><thead><tr style="background:#f8fafc">
            <th style="${td}">Pedido</th><th style="${td}">Cliente</th><th style="${td}">Codigo</th>
            <th style="${td}">Padre</th><th style="${td}">Producto</th>
            <th style="${td}">Dim</th><th style="${td}">Cant</th><th style="${td}">kg</th><th style="${td}">Grupo</th><th style="${td}">Accion</th>
        </tr></thead><tbody>`;
        html += sinAsignar.map(o => {
            const grupoColor = o.grupo ? '#dcfce7' : '#fee2e2';
            const grupoText = o.grupo ? '#166534' : '#991b1b';
            return `<tr style="line-height:1.3;border-bottom:1px solid var(--border)">
                <td style="${td}"><strong>${escapeHtml(o.pedido_sap_id || '-')}</strong></td>
                <td style="${td}">${escapeHtml(o.cliente || '-')}</td>
                <td style="${td}"><strong>${escapeHtml(o.codigo_producto)}</strong>${o.es_compuesto ? ' <span style="font-size:9px;padding:1px 4px;border-radius:3px;background:#ede9fe;color:#7c3aed">BOM</span>' : ''}</td>
                <td style="${td};font-size:11px"><strong>${escapeHtml(o.codigo_padre || '-')}</strong></td>
                <td style="${td};font-size:11px;color:#6b7280">${escapeHtml(o.nombre_padre || '-')}</td>
                <td style="${td}">${o.ancho}x${o.alto}</td>
                <td style="${td}">${o.cantidad || 1}</td>
                <td style="${td}"><strong>${Number(o.kilos || 0).toFixed(1)}</strong></td>
                <td style="${td}"><span style="padding:1px 6px;border-radius:3px;font-size:10px;background:${grupoColor};color:${grupoText}">${o.grupo || 'sin grupo'}</span></td>
                <td style="${td}">${o.grupo ? `<button class="btn btn-sm btn-primary" style="padding:2px 8px;font-size:10px" onclick="App.modules.planificacion.asignarGrupo(${o.id})">Asignar</button>` : '<span style="font-size:10px;color:#ef4444">requiere grupo</span>'}</td>
            </tr>`;
        }).join('');
        html += '</tbody></table></div>';
        el.innerHTML = html;
    },

    cambiarFechaGrupo(delta) {
        if (delta === undefined) {
            this.fechaGrupo = document.getElementById('planGrupoFecha').value;
        } else {
            const d = new Date(this.fechaGrupo + 'T00:00:00');
            d.setDate(d.getDate() + delta);
            this.fechaGrupo = d.toISOString().split('T')[0];
        }
        const fEl = document.getElementById('planGrupoFecha');
        if (fEl) fEl.value = this.fechaGrupo;
        this.cargarGrupo();
    },

    async asignarGrupo(ordenId) {
        try {
            const res = await fetch('/api/produccion/planificacion-grupo/asignar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orden_id: ordenId, fecha: this.fechaGrupo })
            });
            if (res.ok) {
                App.toast('Orden asignada');
                await this.cargarGrupo();
            }
        } catch(e) { alert('Error: ' + e.message); }
    },

    showCapacidadGrupo() {
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        if (!(user.permisos || []).includes('usuarios') && !(user.permisos || []).includes('produccion')) {
            alert('Sin permiso para editar capacidad'); return;
        }
        const html = `
            <p style="font-size:12px;color:var(--text-light);margin-bottom:12px">Capacidad maxima en kg por dia para cada grupo:</p>
            ${this.capacidadGrupo.map(c => `
                <div style="display:grid;grid-template-columns:1fr 120px 60px;gap:8px;align-items:center;margin-bottom:8px">
                    <div style="font-weight:500"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${c.color};margin-right:6px"></span>${c.grupo}</div>
                    <input type="number" class="form-control" value="${c.capacidad_kg_dia}" id="planCapG_${c.id}" min="0">
                    <button class="btn btn-sm btn-primary" onclick="App.modules.planificacion.guardarCapacidadGrupo(${c.id})">💾</button>
                </div>
            `).join('')}
        `;
        App.showModalInv('Capacidad por Grupo (kg/dia)', html, '<button class="btn btn-outline" onclick="App.hideModal()">Cerrar</button>');
    },

    async guardarCapacidadGrupo(id) {
        const val = Number(document.getElementById('planCapG_' + id).value) || 0;
        try {
            const res = await fetch(`/api/produccion/capacidad-grupo/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ capacidad_kg_dia: val })
            });
            if (res.ok) { App.toast('Capacidad actualizada'); await this.cargarGrupo(); }
        } catch(e) { alert('Error: ' + e.message); }
    },

    showAutoAsignarGrupo() {
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        if (!(user.permisos || []).includes('usuarios') && !(user.permisos || []).includes('produccion')) {
            alert('Sin permiso'); return;
        }
        const html = `
            <p style="font-size:13px;color:var(--text-light);margin-bottom:12px">Reparte las ordenes PENDIENTES a los proximos dias respetando la capacidad maxima por grupo (kg/dia). Solo dias habiles.</p>
            <div class="form-group">
                <label style="font-weight:500">Desde</label>
                <input type="date" class="form-control" id="planAutoGInicio" value="${this.fechaGrupo}">
            </div>
            <div class="form-group">
                <label style="font-weight:500">Cantidad de dias habiles a buscar</label>
                <input type="number" class="form-control" id="planAutoGDias" value="14" min="1" max="60">
            </div>
            <div id="planAutoGResultado" style="margin-top:12px"></div>
        `;
        const footer = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.planificacion.ejecutarAutoAsignarGrupo()">Asignar</button>
        `;
        App.showModalInv('⚡ Auto-Asignar Pendientes', html, footer);
    },

    async ejecutarAutoAsignarGrupo() {
        const inicio = document.getElementById('planAutoGInicio').value;
        const dias = Number(document.getElementById('planAutoGDias').value) || 14;
        const resEl = document.getElementById('planAutoGResultado');
        resEl.innerHTML = '<div style="text-align:center;padding:12px">Asignando...</div>';
        try {
            const res = await fetch('/api/produccion/planificacion-grupo/auto-asignar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inicio, dias })
            });
            const data = await res.json();
            if (res.ok) {
                resEl.innerHTML = `<div style="background:#dcfce7;border-radius:8px;padding:12px;font-size:13px">
                    <div><strong>✓ Asignadas: ${data.asignados}</strong></div>
                    <div style="margin-top:4px;color:#166534">Sin capacidad: ${data.no_asignados}</div>
                </div>`;
                setTimeout(async () => { App.hideModal(); await this.cargarGrupo(); }, 1500);
            } else {
                resEl.innerHTML = `<div style="color:#ef4444">${data.error || 'Error'}</div>`;
            }
        } catch(e) {
            resEl.innerHTML = `<div style="color:#ef4444">Error: ${e.message}</div>`;
        }
    },

    calcSemana(fecha) {
        const d = new Date(fecha);
        if (isNaN(d.getTime())) { d = new Date(); }
        const dia = d.getDay();
        const diffLunes = dia === 0 ? -6 : 1 - dia;
        this.semanaInicio = new Date(d);
        this.semanaInicio.setDate(d.getDate() + diffLunes);
        this.semanaFin = new Date(this.semanaInicio);
        this.semanaFin.setDate(this.semanaFin.getDate() + 13);
    },

    async render() {
        if (!this.semanaInicio) this.calcSemana(new Date());
        if (!this.fechaGrupo) this.fechaGrupo = new Date().toISOString().split('T')[0];
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const puedeEditar = (user.permisos || []).includes('usuarios') || (user.permisos || []).includes('produccion');
        const page = document.getElementById('page-planificacion');
        if (!page) return;
        page.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                <div>
                    <h2 style="margin:0">Planificacion de Produccion</h2>
                    <p style="margin:4px 0 0;color:var(--text-light);font-size:13px">Carga por grupo (kg) + calendario semanal por estacion (m²)</p>
                </div>
            </div>

            <!-- VISTA POR GRUPO (kg/dia) - nueva -->
            <div class="card" style="margin-bottom:20px;border:2px solid #3b82f6">
                <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;background:linear-gradient(90deg,#eff6ff,#fff)">
                    <div>
                        <h3 style="margin:0;font-size:16px">⚖️ Vista por Grupo (kg/dia)</h3>
                        <div style="font-size:12px;color:var(--text-light)">Capacidad maxima diaria por grupo de productos</div>
                    </div>
                    <div style="display:flex;gap:6px;align-items:center">
                        <label style="font-size:12px;color:var(--text-light)">Fecha:</label>
                        <input type="date" class="form-control" id="planGrupoFecha" value="${this.fechaGrupo}" onchange="App.modules.planificacion.cambiarFechaGrupo()" style="width:140px;padding:4px 8px;font-size:12px">
                        <button class="btn btn-outline" style="padding:4px 10px;font-size:12px" onclick="App.modules.planificacion.cambiarFechaGrupo(-1)">◀</button>
                        <button class="btn btn-outline" style="padding:4px 10px;font-size:12px" onclick="App.modules.planificacion.cambiarFechaGrupo(1)">▶</button>
                        ${puedeEditar ? '<button class="btn btn-outline" style="padding:4px 10px;font-size:12px" onclick="App.modules.planificacion.showCapacidadGrupo()">⚙️ Capacidad</button>' : ''}
                        ${puedeEditar ? '<button class="btn btn-primary" style="padding:4px 12px;font-size:12px" onclick="App.modules.planificacion.showAutoAsignarGrupo()">⚡ Auto-Asignar</button>' : ''}
                    </div>
                </div>
                <div class="card-body" style="padding:16px">
                    <div id="planGrupoResumen"></div>
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:16px" id="planGrupoCards">
                        <div style="text-align:center;padding:20px;color:#64748b">Cargando...</div>
                    </div>
                    <h4 style="margin:16px 0 8px;font-size:14px">⏳ Pendientes sin Asignar</h4>
                    <div id="planGrupoPendientes"><div style="text-align:center;padding:12px;color:#64748b">Cargando...</div></div>
                </div>
            </div>

            <!-- VISTA SEMANAL (m² por estacion) - existente -->
            <div class="card" style="margin-bottom:20px">
                <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;background:#f8fafc">
                    <div>
                        <h3 style="margin:0;font-size:16px">📅 Vista Semanal (m² por Estacion)</h3>
                        <div style="font-size:12px;color:var(--text-light)">Backwards Scheduling - Capacidad por estacion y dia</div>
                    </div>
                </div>
                <div class="card-body" style="padding:16px">
                    <div id="planPendientes" style="margin-bottom:16px"></div>
                    <div id="planCalendario"></div>
                </div>
            </div>

            <div class="modal-overlay" id="planAsignarModal">
                <div class="modal" style="max-width:500px">
                    <div class="modal-header"><h3>Asignar Fecha de Entrega</h3><button class="modal-close" onclick="App.modules.planificacion.cerrarModal()">&times;</button></div>
                    <div class="modal-body" id="planAsignarBody"></div>
                </div>
            </div>
        `;
        await Promise.all([this.cargarGrupo(), this.cargarDatos()]);
    },

    async cargarDatos() {
        const inicio = this.fmtDate(this.semanaInicio);
        const fin = this.fmtDate(this.semanaFin);
        try {
            const [cargaGrupoRes, pendRes, cargaEstRes] = await Promise.all([
                fetch(`/api/produccion/planificacion-grupo/semana?inicio=${inicio}&fin=${fin}`),
                fetch('/api/produccion/planificacion/pendientes'),
                fetch(`/api/produccion/planificacion/carga-semanal?inicio=${inicio}&fin=${fin}`)
            ]);
            if (cargaGrupoRes.ok) {
                const data = await cargaGrupoRes.json();
                this.gruposSemana = data.grupos || [];
                this.diasSemana = data.dias || [];
            } else { console.error('carga-grupo-semana error:', cargaGrupoRes.status); this.gruposSemana = []; this.diasSemana = []; }
            if (pendRes.ok) this.pendientes = await pendRes.json();
            else { console.error('pendientes error:', pendRes.status); this.pendientes = []; }
            if (cargaEstRes.ok) this.cargaSemanal = await cargaEstRes.json();
            else { console.error('carga-semanal error:', cargaEstRes.status); this.cargaSemanal = []; }
            this.renderPendientes();
            this.renderCalendario();
        } catch(e) {
            console.error('Error cargando planificacion:', e);
            document.getElementById('planPendientes').innerHTML = '<div style="background:#fee2e2;border:1px solid #ef4444;border-radius:8px;padding:16px;color:#991b1b">Error al cargar datos de planificacion. Verifique la conexion.</div>';
        }
    },

    renderPendientes() {
        const div = document.getElementById('planPendientes');
        if (this.pendientes.length === 0) {
            div.innerHTML = '<div style="background:var(--card-bg);border-radius:12px;padding:20px;text-align:center;color:var(--text-light)">No hay ordenes pendientes de programar</div>';
            return;
        }
        div.innerHTML = `
            <div style="background:var(--card-bg);border-radius:12px;padding:16px;border:1px solid var(--border)">
                <h3 style="margin:0 0 12px;font-size:16px">Pedidos Pendientes (${this.pendientes.length})</h3>
                <div style="overflow-x:auto">
                    <table style="width:100%;font-size:13px;border-collapse:collapse">
                        <thead><tr style="border-bottom:2px solid var(--border)">
                            <th style="padding:8px;text-align:left">Pedido</th>
                            <th style="padding:8px;text-align:left">Item</th>
                            <th style="padding:8px;text-align:left">Cliente</th>
                            <th style="padding:8px;text-align:left">Codigo</th>
                            <th style="padding:8px;text-align:left">Descripcion</th>
                            <th style="padding:8px;text-align:right">M2</th>
                            <th style="padding:8px;text-align:right">Kilos</th>
                            <th style="padding:8px;text-align:center">Ruta</th>
                            <th style="padding:8px;text-align:center">Accion</th>
                        </tr></thead>
                        <tbody>${this.pendientes.map(o => {
                            const progreso = o.total_pasos > 0 ? `0/${o.total_pasos}` : '-';
                            return `<tr style="border-bottom:1px solid var(--border)">
                                <td style="padding:8px"><strong>${escapeHtml(o.pedido_sap_id || '-')}</strong></td>
                                <td style="padding:8px">${o.item_numero || '-'}</td>
                                <td style="padding:8px">${escapeHtml(o.cliente || '-')}</td>
                                <td style="padding:8px"><strong>${escapeHtml(o.codigo_producto)}</strong>${o.es_compuesto ? ' <span style="font-size:10px;padding:2px 5px;border-radius:4px;background:#ede9fe;color:#7c3aed">BOM</span>' : ''}</td>
                                <td style="padding:8px;font-size:12px;color:var(--text-light)">${escapeHtml(o.descripcion || o.nombre_mp || '-')}</td>
                                <td style="padding:8px;text-align:right;font-weight:600">${Number(o.metros_cuadrados || 0).toFixed(2)}</td>
                                <td style="padding:8px;text-align:right;font-weight:600">${Number(o.kilos || 0).toFixed(2)}</td>
                                <td style="padding:8px;text-align:center">${progreso}</td>
                                <td style="padding:8px;text-align:center"><button class="btn btn-primary btn-sm" style="padding:4px 12px;font-size:12px" onclick="App.modules.planificacion.abrirModal(${o.id})">Asignar Fecha</button></td>
                            </tr>`;
                        }).join('')}</tbody>
                    </table>
                </div>
            </div>
        `;
    },

    renderCalendario() {
        const div = document.getElementById('planCalendario');
        const diasSemana = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
        const inicio = this.semanaInicio;
        const finD = new Date(this.semanaFin);

        // Construir headers de dias desde this.diasSemana
        const diasInfo = this.diasSemana.map(f => {
            const d = new Date(f + 'T00:00:00');
            const dow = d.getDay();
            const diff = dow === 0 ? -6 : 1 - dow;
            const lunes = new Date(d);
            lunes.setDate(d.getDate() + diff);
            const isThisWeek = lunes.getTime() === new Date(inicio).getTime();
            return { fecha: f, dia: diasSemana[(dow + 6) % 7], fechaCorta: d.getDate() + '/' + (d.getMonth()+1), isThisWeek };
        });

        // Color de fondo segun capacidad kg/dia usada
        const colorCelda = (kg, capacidad, esLaboral) => {
            if (!esLaboral) return { bg: '#f1f5f9', border: '#cbd5e1', text: '#94a3b8' };
            const pct = capacidad > 0 ? (kg / capacidad) * 100 : 0;
            if (pct > 100) return { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' };
            if (pct >= 85) return { bg: '#fef3c7', border: '#f59e0b', text: '#854d0e' };
            if (pct > 0) return { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' };
            return { bg: '#f8fafc', border: '#e2e8f0', text: '#94a3b8' };
        };

        div.innerHTML = `
            <div style="background:var(--card-bg);border-radius:12px;padding:16px;border:1px solid var(--border)">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
                    <div>
                        <h3 style="margin:0;font-size:16px">Carga Semanal por Grupo</h3>
                        <div style="font-size:12px;color:var(--text-light)">m², metros lineales y kilos por dia y grupo</div>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center">
                        <button class="btn btn-outline btn-sm" onclick="App.modules.planificacion.cambiarSemana(-1)">◀</button>
                        <span style="font-size:13px;font-weight:600">${this.fmtDate(inicio)} al ${this.fmtDate(finD)}</span>
                        <button class="btn btn-outline btn-sm" onclick="App.modules.planificacion.cambiarSemana(1)">▶</button>
                    </div>
                </div>
                <div style="overflow-x:auto">
                    <table style="width:100%;font-size:11px;border-collapse:collapse;min-width:800px">
                        <thead><tr style="border-bottom:2px solid var(--border)">
                            <th style="padding:8px;text-align:left;min-width:120px">Grupo</th>
                            <th style="padding:8px;text-align:center;min-width:80px">Cap kg/dia</th>
                            ${diasInfo.map(d => {
                                const laboral = this.gruposSemana[0]?.dias.find(x => x.fecha === d.fecha)?.es_laboral !== false;
                                const headerBg = laboral ? '' : 'background:#f1f5f9;';
                                const headerColor = laboral ? '' : 'color:#94a3b8;';
                                return `<th style="padding:8px;text-align:center;min-width:90px;${headerBg}${headerColor}">
                                    <div style="font-weight:600">${d.dia}</div>
                                    <div style="font-weight:400;font-size:10px">${d.fechaCorta}</div>
                                    ${!laboral ? '<div style="font-size:9px;color:#ef4444">NO LAB</div>' : ''}
                                </th>`;
                            }).join('')}
                            <th style="padding:8px;text-align:center;min-width:90px;background:#f8fafc">Total Sem.</th>
                        </tr></thead>
                        <tbody>${this.gruposSemana.map(g => {
                            const colorBorde = g.color || '#3b82f6';
                            return `<tr style="border-bottom:1px solid var(--border)">
                                <td style="padding:8px;border-left:3px solid ${colorBorde}">
                                    <strong>${escapeHtml(g.grupo)}</strong>
                                </td>
                                <td style="padding:8px;text-align:center;font-size:11px;color:var(--text-light)">${g.capacidad_kg_dia.toLocaleString('es-CL')}</td>
                                ${diasInfo.map(d => {
                                    const cell = g.dias.find(x => x.fecha === d.fecha) || {};
                                    const c = colorCelda(cell.kilos || 0, g.capacidad_kg_dia, cell.es_laboral !== false);
                                    if (cell.es_laboral === false) {
                                        return `<td style="padding:6px;text-align:center">
                                            <div style="background:#f1f5f9;border:1px dashed #cbd5e1;border-radius:6px;padding:6px 4px">
                                                <div style="font-weight:600;font-size:11px;color:#94a3b8">✕</div>
                                                <div style="font-size:8px;color:#94a3b8">${cell.motivo || ''}</div>
                                            </div>
                                        </td>`;
                                    }
                                    const hasData = (cell.m2 || cell.m_lineales || cell.kilos) > 0;
                                    return `<td style="padding:4px;text-align:center">
                                        <div style="background:${hasData ? c.bg : '#f8fafc'};border:1px solid ${hasData ? c.border : '#e2e8f0'};border-radius:6px;padding:6px 4px;min-height:50px">
                                            ${hasData ? `
                                                <div style="font-size:11px;color:${c.text};font-weight:600">${Number(cell.m2 || 0).toFixed(1)} m²</div>
                                                <div style="font-size:10px;color:${c.text}">${Number(cell.m_lineales || 0).toFixed(1)} mL</div>
                                                <div style="font-size:11px;color:${c.text};font-weight:700">${Number(cell.kilos || 0).toFixed(0)} kg</div>
                                                <div style="font-size:9px;color:${c.text}">${cell.ordenes || 0} ord.</div>
                                            ` : '<div style="font-size:10px;color:#cbd5e1">-</div>'}
                                        </div>
                                    </td>`;
                                }).join('')}
                                <td style="padding:6px;text-align:center;background:#f8fafc">
                                    <div style="font-size:12px;font-weight:700;color:${colorBorde}">${Number(g.total.kilos || 0).toFixed(0)} kg</div>
                                    <div style="font-size:10px;color:var(--text-light)">${Number(g.total.m2 || 0).toFixed(1)} m²</div>
                                    <div style="font-size:10px;color:var(--text-light)">${Number(g.total.m_lineales || 0).toFixed(1)} mL</div>
                                    <div style="font-size:9px;color:var(--text-light)">${g.total.ordenes || 0} ord.</div>
                                </td>
                            </tr>`;
                        }).join('')}</tbody>
                    </table>
                </div>
                <div style="margin-top:12px;display:flex;gap:14px;font-size:11px;color:var(--text-light);flex-wrap:wrap">
                    <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#dbeafe;vertical-align:middle"></span> Con carga</span>
                    <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#fef3c7;vertical-align:middle"></span> 85-100% capacidad</span>
                    <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#fee2e2;vertical-align:middle"></span> Sobrecargado</span>
                    <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#f1f5f9;border:1px dashed #cbd5e1;vertical-align:middle"></span> No Laboral</span>
                </div>
            </div>
        `;
    },

    cambiarSemana(dir) {
        this.semanaInicio.setDate(this.semanaInicio.getDate() + (dir * 7));
        this.semanaFin.setDate(this.semanaFin.getDate() + (dir * 7));
        this.cargarDatos();
    },

    async abrirModal(ordenId) {
        const orden = this.pendientes.find(o => o.id === ordenId);
        if (!orden) return;
        const body = document.getElementById('planAsignarBody');
        body.innerHTML = `
            <div style="margin-bottom:16px">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px">
                    <div><strong>Pedido:</strong> ${orden.pedido_sap_id}</div>
                    <div><strong>Item:</strong> ${orden.item_numero}</div>
                    <div><strong>Codigo:</strong> ${orden.codigo_producto}</div>
                    <div><strong>M2:</strong> ${Number(orden.metros_cuadrados || 0).toFixed(2)}</div>
                    <div><strong>Kilos:</strong> ${Number(orden.kilos || 0).toFixed(2)}</div>
                    <div><strong>Cliente:</strong> ${escapeHtml(orden.cliente || '-')}</div>
                    <div><strong>Ruta:</strong> ${orden.total_pasos} estaciones</div>
                </div>
            </div>
            <div class="form-group">
                <label>Fecha de Entrega Propuesta *</label>
                <input class="form-control" type="date" id="planFechaEntrega" min="${new Date().toISOString().split('T')[0]}">
            </div>
            <div id="planError" style="display:none;background:#fee2e2;border:1px solid #ef4444;border-radius:8px;padding:12px;margin-top:12px;color:#991b1b;font-size:13px"></div>
            <div style="margin-top:16px;text-align:right">
                <button class="btn btn-outline" onclick="App.modules.planificacion.cerrarModal()">Cancelar</button>
                <button class="btn btn-primary" id="planBtnProgramar" onclick="App.modules.planificacion.programar(${ordenId})">Programar</button>
            </div>
        `;
        document.getElementById('planAsignarModal').classList.add('show');
    },

    cerrarModal() { document.getElementById('planAsignarModal').classList.remove('show'); },

    async programar(ordenId) {
        const fecha = document.getElementById('planFechaEntrega').value;
        if (!fecha) { alert('Seleccione una fecha'); return; }
        const btn = document.getElementById('planBtnProgramar');
        btn.textContent = 'Validando...';
        btn.disabled = true;
        try {
            const res = await fetch('/api/produccion/planificacion/programar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orden_id: ordenId, fecha_entrega_propuesta: fecha })
            });
            const data = await res.json();
            if (res.ok) {
                App.toast(data.mensaje || 'Orden programada correctamente');
                this.cerrarModal();
                await this.cargarDatos();
            } else {
                const errDiv = document.getElementById('planError');
                errDiv.style.display = 'block';
                errDiv.innerHTML = `<strong>Error:</strong> ${data.error}`;
                if (data.conflictos && data.conflictos.length > 0) {
                    errDiv.innerHTML += `<div style="margin-top:8px;font-size:12px"><strong>Detalle de conflictos:</strong><ul style="margin:4px 0;padding-left:20px">${data.conflictos.map(c => `<li>${c.fecha}: ${Number(c.disponibles).toFixed(2)} m² disponibles, ${c.necesarios} m² necesarios</li>`).join('')}</ul></div>`;
                }
            }
        } catch(e) { alert('Error: ' + e.message); }
        btn.textContent = 'Programar';
        btn.disabled = false;
    }
};
