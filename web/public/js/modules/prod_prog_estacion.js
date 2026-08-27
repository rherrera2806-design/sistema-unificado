App.registerModule('prod_prog_estacion', {
    datos: null,
    filtros: { estacion_id: '', fecha_inicio: '', fecha_fin: '', estado: 'todos' },

    async render() {
        const el = document.getElementById('page-prod_prog_estacion');
        const hoy = new Date().toISOString().split('T')[0];
        if (!this.filtros.fecha_inicio) this.filtros.fecha_inicio = hoy;
        if (!this.filtros.fecha_fin) {
            const fin = new Date(); fin.setDate(fin.getDate() + 14);
            this.filtros.fecha_fin = fin.toISOString().split('T')[0];
        }

        el.innerHTML = `
            <style>
                @keyframes ppeFadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
                .ppe-card{transition:all .3s cubic-bezier(.4,0,.2,1)}
                .ppe-card:hover{box-shadow:0 6px 20px rgba(0,0,0,.06)!important;transform:translateY(-1px)}
                .ppe-table{width:100%;font-size:12px;border-collapse:collapse}
                .ppe-table th{padding:8px 10px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #e2e8f0;background:#f8fafc;position:sticky;top:0;z-index:1}
                .ppe-table td{padding:6px 10px;border-bottom:1px solid #f1f5f9;color:#334155}
                .ppe-table tbody tr{transition:background .15s}
                .ppe-table tbody tr:hover{background:#f8fafc!important}
                .ppe-date-header{background:linear-gradient(135deg,#0f172a,#1e3a5f);color:white;padding:10px 16px;font-weight:700;font-size:13px;display:flex;justify-content:space-between;align-items:center;border-radius:10px 10px 0 0;margin-top:16px}
                .ppe-date-header:first-child{margin-top:0}
                .ppe-badge{display:inline-block;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:600}
                .ppe-estado-PENDIENTE{background:#fef3c7;color:#92400e}
                .ppe-estado-PROGRAMADO{background:#dbeafe;color:#1e40af}
                .ppe-estado-EN_PROCESO{background:#e0e7ff;color:#3730a3}
                .ppe-estado-TERMINADO{background:#d1fae5;color:#065f46}
                .ppe-estado-CERRADO{background:#f1f5f9;color:#64748b}
                .ppe-totales{display:flex;gap:16px;padding:8px 16px;background:#f8fafc;border-radius:0 0 10px 10px;font-size:12px;font-weight:600;color:#475569}
                .ppe-totales span{color:#0f172a}
            </style>

            <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:8px 16px;margin-bottom:20px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,.3)">
                <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,.2) 0%,transparent 70%);border-radius:50%"></div>
                <div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <h2 style="margin:0;font-size:15px;font-weight:800;color:white;letter-spacing:-.5px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-3px;margin-right:6px"><path d="M2 20h20"/><path d="M5 20V8l5 4V8l5 4V4h3v16"/></svg>Programacion por Estacion</h2>
                        <p style="margin:2px 0 0;font-size:11px;color:rgba(255,255,255,.7)">Vista de programacion completa por estacion y fecha</p>
                    </div>
                    <div style="display:flex;gap:8px">
                        <button onclick="App.modules.prod_prog_estacion.exportarExcel()" class="btn btn-outline" style="color:white;border-color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.1)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Exportar</button>
                    </div>
                </div>
            </div>

            <div style="background:white;border-radius:14px;padding:20px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,.04);margin-bottom:20px;animation:ppeFadeUp .5s ease both">
                <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:end">
                    <div style="flex:2;min-width:200px">
                        <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Estacion</label>
                        <select id="ppeFilterEstacion" onchange="App.modules.prod_prog_estacion.aplicarFiltros()" style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;background:white">
                            <option value="">Todas las estaciones</option>
                        </select>
                    </div>
                    <div style="flex:1;min-width:140px">
                        <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Desde</label>
                        <input type="date" id="ppeFilterInicio" value="${this.filtros.fecha_inicio}" onchange="App.modules.prod_prog_estacion.aplicarFiltros()" style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none">
                    </div>
                    <div style="flex:1;min-width:140px">
                        <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Hasta</label>
                        <input type="date" id="ppeFilterFin" value="${this.filtros.fecha_fin}" onchange="App.modules.prod_prog_estacion.aplicarFiltros()" style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none">
                    </div>
                    <div style="flex:1;min-width:140px">
                        <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Estado</label>
                        <select id="ppeFilterEstado" onchange="App.modules.prod_prog_estacion.aplicarFiltros()" style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;background:white">
                            <option value="todos">Todos</option>
                            <option value="PENDIENTE">Pendiente</option>
                            <option value="PROGRAMADO">Programado</option>
                            <option value="EN_PROCESO">En Proceso</option>
                            <option value="TERMINADO">Terminado</option>
                        </select>
                    </div>
                    <div>
                        <button onclick="App.modules.prod_prog_estacion.limpiarFiltros()" style="padding:8px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;cursor:pointer;background:white;color:#64748b;white-space:nowrap">Limpiar</button>
                    </div>
                </div>
            </div>

            <div id="ppeResumen" style="animation:ppeFadeUp .6s ease both"></div>
            <div id="ppeContenido" style="animation:ppeFadeUp .7s ease both"></div>
        `;

        await this.cargarDatos();
    },

    async cargarDatos() {
        const params = new URLSearchParams();
        if (this.filtros.estacion_id) params.set('estacion_id', this.filtros.estacion_id);
        if (this.filtros.fecha_inicio) params.set('fecha_inicio', this.filtros.fecha_inicio);
        if (this.filtros.fecha_fin) params.set('fecha_fin', this.filtros.fecha_fin);
        if (this.filtros.estado && this.filtros.estado !== 'todos') params.set('estado', this.filtros.estado);

        try {
            const res = await fetch(`/api/produccion/prog-estacion?${params}`);
            if (!res.ok) throw new Error(`Error ${res.status}`);
            this.datos = await res.json();
            this.poblarEstaciones();
            this.renderResumen();
            this.renderContenido();
        } catch(e) {
            document.getElementById('ppeContenido').innerHTML = `<div style="background:#fee2e2;border-radius:10px;padding:16px;color:#991b1b;text-align:center">Error al cargar: ${e.message}</div>`;
        }
    },

    poblarEstaciones() {
        const sel = document.getElementById('ppeFilterEstacion');
        if (!sel || !this.datos) return;
        const val = sel.value;
        sel.innerHTML = '<option value="">Todas las estaciones</option>';
        for (const e of this.datos.todas_estaciones || []) {
            const cb = e.cuello_botella ? ' [CB]' : '';
            sel.innerHTML += `<option value="${e.id}" ${String(e.id) === String(val) ? 'selected' : ''}>${e.orden_secuencia_defecto || '?'}° ${e.nombre_estacion}${cb} (cap: ${e.cap_max} m²)</option>`;
        }
    },

    renderResumen() {
        const el = document.getElementById('ppeResumen');
        if (!el || !this.datos) return;
        const estaciones = this.datos.estaciones || [];
        const totalEstaciones = estaciones.length;
        let totalOrd = 0, totalM2 = 0, totalKg = 0;
        for (const e of estaciones) {
            totalOrd += e.total_ordenes;
            totalM2 += e.total_m2;
            totalKg += e.total_kg;
        }
        el.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
                <div class="ppe-card" style="background:white;border-radius:12px;padding:16px;border:1px solid #e2e8f0;text-align:center">
                    <div style="font-size:24px;font-weight:800;color:#3b82f6">${totalEstaciones}</div>
                    <div style="font-size:11px;color:#64748b;font-weight:600">Estaciones</div>
                </div>
                <div class="ppe-card" style="background:white;border-radius:12px;padding:16px;border:1px solid #e2e8f0;text-align:center">
                    <div style="font-size:24px;font-weight:800;color:#8b5cf6">${totalOrd}</div>
                    <div style="font-size:11px;color:#64748b;font-weight:600">Total Ordenes</div>
                </div>
                <div class="ppe-card" style="background:white;border-radius:12px;padding:16px;border:1px solid #e2e8f0;text-align:center">
                    <div style="font-size:24px;font-weight:800;color:#10b981">${totalM2.toFixed(1)}</div>
                    <div style="font-size:11px;color:#64748b;font-weight:600">Total M²</div>
                </div>
                <div class="ppe-card" style="background:white;border-radius:12px;padding:16px;border:1px solid #e2e8f0;text-align:center">
                    <div style="font-size:24px;font-weight:800;color:#f59e0b">${totalKg.toFixed(0)}</div>
                    <div style="font-size:11px;color:#64748b;font-weight:600">Total Kg</div>
                </div>
            </div>
        `;
    },

    renderContenido() {
        const el = document.getElementById('ppeContenido');
        if (!el || !this.datos) return;
        const estaciones = this.datos.estaciones || [];
        if (!estaciones.length) {
            el.innerHTML = '<div style="background:white;border-radius:14px;padding:40px;text-align:center;color:#94a3b8;border:1px solid #e2e8f0"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" style="margin-bottom:12px"><path d="M2 20h20"/><path d="M5 20V8l5 4V8l5 4V4h3v16"/></svg><div style="font-size:14px;font-weight:600">Sin programacion</div><div style="font-size:12px;margin-top:4px">No hay ordenes programadas en el rango seleccionado</div></div>';
            return;
        }

        let html = '';
        for (const est of estaciones) {
            const color = est.cuello_botella ? '#ef4444' : '#3b82f6';
            html += `<div style="background:white;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,.04)">`;
            html += `<div style="background:linear-gradient(135deg,${color},${color}dd);color:white;padding:12px 16px;display:flex;justify-content:space-between;align-items:center">`;
            html += `<div><span style="font-size:15px;font-weight:800">${est.orden}° ${est.nombre}</span>`;
            if (est.cuello_botella) html += ` <span style="font-size:9px;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.2);margin-left:6px">CUELLO DE BOTELLA</span>`;
            html += `</div>`;
            html += `<div style="text-align:right;font-size:12px"><span>${est.total_ordenes} ord</span> · <span>${est.total_m2.toFixed(1)} m²</span> · <span>${est.total_kg.toFixed(0)} kg</span></div>`;
            html += `</div>`;

            if (!est.fechas || est.fechas.length === 0) {
                html += `<div style="padding:16px;text-align:center;color:#94a3b8;font-size:13px">Sin programacion en este rango</div>`;
            } else {
                for (const dia of est.fechas) {
                    const fechaFmt = this.formatFecha(dia.fecha);
                    const esHoy = dia.fecha === new Date().toISOString().split('T')[0];
                    html += `<div class="ppe-date-header" style="${esHoy ? 'background:linear-gradient(135deg,#059669,#10b981)' : ''}">`;
                    html += `<div>${esHoy ? 'HOY - ' : ''}${fechaFmt}</div>`;
                    html += `<div>${dia.total_ordenes} ord · ${dia.total_m2.toFixed(1)} m² · ${dia.total_kg.toFixed(0)} kg</div>`;
                    html += `</div>`;
                    html += `<div style="overflow-x:auto"><table class="ppe-table"><thead><tr>`;
                    html += `<th>Pedido</th><th>Item</th><th>Codigo</th><th>Ref/Padre</th><th>Dim</th><th>Cant</th><th>M²</th><th>Kg</th><th>Cliente</th><th>Estado</th><th>Ruta</th><th>Grupo</th>`;
                    html += `</tr></thead><tbody>`;

                    const groups = {};
                    const sinGrupo = [];
                    for (const o of dia.ordenes) {
                        if (o.es_compuesto && o.codigo_ref) {
                            const key = `${o.pedido}|${o.item}|${o.codigo_ref}`;
                            if (!groups[key]) groups[key] = { padre: o, hijos: [] };
                            groups[key].hijos.push(o);
                        } else {
                            sinGrupo.push(o);
                        }
                    }

                    for (const o of sinGrupo) {
                        const estadoClass = `ppe-estado-${o.estado}`;
                        html += this._renderFila(o, estadoClass, false);
                    }

                    for (const [key, grp] of Object.entries(groups)) {
                        const p = grp.padre;
                        html += `<tr style="background:#f0f9ff;border-bottom:2px solid #bae6fd">`;
                        html += `<td><strong>${this.esc(p.pedido || '-')}</strong></td>`;
                        html += `<td>${p.item || '-'}</td>`;
                        html += `<td><strong style="color:#0369a1">${this.esc(p.codigo_ref)}</strong> <span style="font-size:9px;padding:1px 4px;border-radius:3px;background:#0ea5e9;color:white">PADRE</span></td>`;
                        html += `<td style="font-size:11px"><strong>${this.esc(p.codigo_ref)}</strong>${p.nombre_padre ? '<br><span style="color:#94a3b8">' + this.esc(p.nombre_padre) + '</span>' : ''}</td>`;
                        html += `<td>${p.ancho}×${p.alto}</td>`;
                        html += `<td>${grp.hijos.length} MP</td>`;
                        const totalM2Grupo = grp.hijos[0] ? (grp.hijos[0].m2_asignados || grp.hijos[0].m2) : 0;
                        const totalKgGrupo = grp.hijos.reduce((s, h) => s + h.kg, 0);
                        html += `<td><strong>${totalM2Grupo.toFixed(2)}</strong></td>`;
                        html += `<td><strong>${totalKgGrupo.toFixed(1)}</strong></td>`;
                        html += `<td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${this.esc(p.cliente || '-')}</td>`;
                        html += `<td><span class="ppe-badge ppe-estado-${p.estado}">${p.estado}</span></td>`;
                        html += `<td style="font-size:11px">${this.esc(p.ruta)}</td>`;
                        html += `<td><span style="padding:1px 6px;border-radius:4px;font-size:10px;background:#f0fdf4;color:#166534">${this.esc(p.grupo || '-')}</span></td>`;
                        html += `</tr>`;

                        for (const h of grp.hijos) {
                            const estadoClass = `ppe-estado-${h.estado}`;
                            const mpInfo = h.mp_nombre ? `${this.esc(h.mp_nombre)}${h.mp_espesor ? ' ' + h.mp_espesor + 'mm' : ''}` : '';
                            html += `<tr style="background:#faf5ff">`;
                            html += `<td style="padding-left:24px"><span style="color:#7c3aed">└</span> ${this.esc(h.pedido || '-')}</td>`;
                            html += `<td>${h.item || '-'}</td>`;
                            html += `<td><strong>${this.esc(h.codigo)}</strong> <span style="font-size:9px;padding:1px 4px;border-radius:3px;background:#ede9fe;color:#7c3aed">MP</span></td>`;
                            html += `<td style="font-size:11px;color:#7c3aed;font-weight:600">${mpInfo || this.esc(h.codigo_ref)}</td>`;
                            html += `<td></td>`;
                            html += `<td>${h.cantidad || 1}</td>`;
                            html += `<td></td>`;
                            html += `<td><strong>${h.kg.toFixed(1)}</strong></td>`;
                            html += `<td></td>`;
                            html += `<td><span class="ppe-badge ${estadoClass}">${h.estado}</span></td>`;
                            html += `<td></td>`;
                            html += `<td></td>`;
                            html += `</tr>`;
                        }
                    }

                    html += `</tbody></table></div>`;
                    html += `<div class="ppe-totales"><div>M²: <span>${dia.total_m2.toFixed(2)}</span></div><div>Kg: <span>${dia.total_kg.toFixed(1)}</span></div><div>Ordenes: <span>${dia.total_ordenes}</span></div></div>`;
                }
            }
            html += `</div>`;
        }
        el.innerHTML = html;
    },

    aplicarFiltros() {
        this.filtros.estacion_id = document.getElementById('ppeFilterEstacion')?.value || '';
        this.filtros.fecha_inicio = document.getElementById('ppeFilterInicio')?.value || '';
        this.filtros.fecha_fin = document.getElementById('ppeFilterFin')?.value || '';
        this.filtros.estado = document.getElementById('ppeFilterEstado')?.value || 'todos';
        this.cargarDatos();
    },

    limpiarFiltros() {
        const hoy = new Date().toISOString().split('T')[0];
        const fin = new Date(); fin.setDate(fin.getDate() + 14);
        this.filtros = { estacion_id: '', fecha_inicio: hoy, fecha_fin: fin.toISOString().split('T')[0], estado: 'todos' };
        this.render();
    },

    formatFecha(fechaStr) {
        const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        const d = new Date(fechaStr + 'T12:00:00');
        return `${d.getDate()} de ${meses[d.getMonth()]} ${d.getFullYear()}`;
    },

    esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; },

    _renderFila(o, estadoClass, esHijo) {
        let html = '<tr>';
        html += `<td><strong>${this.esc(o.pedido || '-')}</strong></td>`;
        html += `<td>${o.item || '-'}</td>`;
        html += `<td><strong>${this.esc(o.codigo)}</strong>${o.es_compuesto ? ' <span style="font-size:9px;padding:1px 4px;border-radius:3px;background:#ede9fe;color:#7c3aed">BOM</span>' : ''}</td>`;
        html += `<td style="font-size:11px"><strong>${this.esc(o.codigo_ref)}</strong>${o.nombre_padre ? '<br><span style="color:#94a3b8">' + this.esc(o.nombre_padre) + '</span>' : ''}</td>`;
        html += `<td>${o.ancho}×${o.alto}</td>`;
        html += `<td>${o.cantidad || 1}</td>`;
        html += `<td><strong>${(o.m2_asignados || o.m2).toFixed(2)}</strong></td>`;
        html += `<td><strong>${o.kg.toFixed(1)}</strong></td>`;
        html += `<td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${this.esc(o.cliente || '-')}</td>`;
        html += `<td><span class="ppe-badge ${estadoClass}">${o.estado}</span></td>`;
        html += `<td style="font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${this.esc(o.ruta)}">${this.esc(o.ruta)}</td>`;
        html += `<td><span style="padding:1px 6px;border-radius:4px;font-size:10px;background:#f0fdf4;color:#166534">${this.esc(o.grupo || '-')}</span></td>`;
        html += '</tr>';
        return html;
    },

    exportarExcel() {
        if (!this.datos || !this.datos.estaciones || !this.datos.estaciones.length) return;
        let csv = 'Estacion;Fecha;Pedido;Item;Codigo;Ref/Padre;Ancho;Alto;Cant;M2;Kg;Cliente;Estado;Ruta;Grupo\n';
        for (const est of this.datos.estaciones) {
            for (const dia of (est.fechas || [])) {
                for (const o of dia.ordenes) {
                    csv += [est.nombre, dia.fecha, o.pedido, o.item, o.codigo, o.codigo_ref, o.ancho, o.alto, o.cantidad, (o.m2_asignados || o.m2).toFixed(2), o.kg.toFixed(1), o.cliente, o.estado, o.ruta, o.grupo].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(';') + '\n';
                }
            }
        }
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `prog_estacion_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    }
});
