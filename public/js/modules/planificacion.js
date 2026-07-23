App.modules.planificacion = {
    nombre: 'Planificacion',
    cargaSemanal: [],
    pendientes: [],
    semanaInicio: null,
    semanaFin: null,

    fmtDate(d) {
        return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    },

    init() {
        this.calcSemana(new Date());
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
        const page = document.getElementById('page-planificacion');
        if (!page) return;
        page.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
                <div>
                    <h2 style="margin:0">Planificacion de Produccion</h2>
                    <p style="margin:4px 0 0;color:var(--text-light);font-size:14px">Backwards Scheduling - Asignacion de fechas por carga de planta</p>
                </div>
            </div>
            <div id="planPendientes" style="margin-bottom:24px"></div>
            <div id="planCalendario"></div>
            <div class="modal-overlay" id="planAsignarModal">
                <div class="modal" style="max-width:500px">
                    <div class="modal-header"><h3>Asignar Fecha de Entrega</h3><button class="modal-close" onclick="App.modules.planificacion.cerrarModal()">&times;</button></div>
                    <div class="modal-body" id="planAsignarBody"></div>
                </div>
            </div>
        `;
        await this.cargarDatos();
    },

    async cargarDatos() {
        const inicio = this.fmtDate(this.semanaInicio);
        const fin = this.fmtDate(this.semanaFin);
        try {
            const [cargaRes, pendRes] = await Promise.all([
                fetch(`/api/produccion/planificacion/carga-semanal?inicio=${inicio}&fin=${fin}`),
                fetch('/api/produccion/planificacion/pendientes')
            ]);
            if (cargaRes.ok) this.cargaSemanal = await cargaRes.json();
            else { console.error('carga-semanal error:', cargaRes.status); this.cargaSemanal = []; }
            if (pendRes.ok) this.pendientes = await pendRes.json();
            else { console.error('pendientes error:', pendRes.status); this.pendientes = []; }
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
        const colores = (pct, esLaboral) => {
            if (!esLaboral) return { bg: '#f1f5f9', border: '#cbd5e1', text: '#94a3b8', bar: '#cbd5e1' };
            if (pct > 95) return { bg: '#fee2e2', border: '#ef4444', text: '#991b1b', bar: '#ef4444' };
            if (pct >= 75) return { bg: '#fef9c3', border: '#eab308', text: '#854d0e', bar: '#eab308' };
            return { bg: '#dcfce7', border: '#22c55e', text: '#166534', bar: '#22c55e' };
        };
        const inicio = this.semanaInicio;
        const fechas = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(inicio);
            d.setDate(inicio.getDate() + i);
            fechas.push(d);
        }
        div.innerHTML = `
            <div style="background:var(--card-bg);border-radius:12px;padding:16px;border:1px solid var(--border)">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                    <h3 style="margin:0;font-size:16px">Carga Semanal de Planta</h3>
                    <div style="display:flex;gap:8px;align-items:center">
                        <button class="btn btn-outline btn-sm" onclick="App.modules.planificacion.cambiarSemana(-1)">◀</button>
                        <span style="font-size:13px;font-weight:600">${this.fmtDate(inicio)} al ${this.fmtDate(fechas[6])}</span>
                        <button class="btn btn-outline btn-sm" onclick="App.modules.planificacion.cambiarSemana(1)">▶</button>
                    </div>
                </div>
                <div style="overflow-x:auto">
                    <table style="width:100%;font-size:12px;border-collapse:collapse;min-width:700px">
                        <thead><tr style="border-bottom:2px solid var(--border)">
                            <th style="padding:8px;text-align:left;min-width:120px">Estacion</th>
                            <th style="padding:8px;text-align:center;min-width:60px">Cap/ Dia</th>
                            ${fechas.map((f, i) => {
                                const dStr = this.fmtDate(f);
                                const esLaboral = this.cargaSemanal.length > 0 ? this.cargaSemanal[0].dias[i]?.es_laboral !== false : (f.getDay() !== 0);
                                const headerBg = esLaboral ? '' : 'background:#f1f5f9;';
                                const headerColor = esLaboral ? '' : 'color:#94a3b8;';
                                return `<th style="padding:8px;text-align:center;${headerBg}${headerColor}"><div>${diasSemana[i]}</div><div style="font-weight:400;font-size:11px">${f.getDate()}/${f.getMonth()+1}</div>${!esLaboral ? '<div style="font-size:9px;color:#ef4444">NO LABORAL</div>' : ''}</th>`;
                            }).join('')}
                        </tr></thead>
                        <tbody>${this.cargaSemanal.map(est => {
                            return `<tr style="border-bottom:1px solid var(--border)">
                                <td style="padding:8px"><strong>${escapeHtml(est.nombre)}</strong></td>
                                <td style="padding:8px;text-align:center;font-size:11px;color:var(--text-light)">${est.capacidad_dia} m²</td>
                                ${est.dias.map(d => {
                                    const c = colores(d.pct_ocupacion, d.es_laboral);
                                    if (!d.es_laboral) {
                                        return `<td style="padding:6px;text-align:center">
                                            <div style="background:#f1f5f9;border:1px dashed #cbd5e1;border-radius:6px;padding:6px 4px">
                                                <div style="font-weight:600;font-size:12px;color:#94a3b8">✕</div>
                                                <div style="font-size:9px;color:#94a3b8">${d.motivo || 'No laboral'}</div>
                                            </div>
                                        </td>`;
                                    }
                                    return `<td style="padding:6px;text-align:center">
                                        <div style="background:${c.bg};border:1px solid ${c.border};border-radius:6px;padding:6px 4px">
                                            <div style="font-weight:700;font-size:14px;color:${c.text}">${d.pct_ocupacion}%</div>
                                            <div style="font-size:10px;color:${c.text}">${Number(d.m2).toFixed(1)} / ${d.capacidad} m²</div>
                                            ${d.ordenes > 0 ? `<div style="font-size:10px;color:${c.text}">${d.ordenes} ord.</div>` : ''}
                                        </div>
                                    </td>`;
                                }).join('')}
                            </tr>`;
                        }).join('')}</tbody>
                    </table>
                </div>
                <div style="margin-top:12px;display:flex;gap:16px;font-size:11px;color:var(--text-light)">
                    <span><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#dcfce7;vertical-align:middle"></span> &lt;75% Normal</span>
                    <span><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#fef9c3;vertical-align:middle"></span> 75-95% Alerta</span>
                    <span><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#fee2e2;vertical-align:middle"></span> &gt;95% Saturado</span>
                    <span><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#f1f5f9;border:1px dashed #cbd5e1;vertical-align:middle"></span> No Laboral</span>
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
