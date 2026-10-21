App.registerModule('prod_prog_estacion', {
    datos: null,
    filtros: { estacion_id: '', fecha_inicio: '', fecha_fin: '', estado: 'por_fabricar' },

    async render() {
        const el = document.getElementById('page-prod_prog_estacion');
        const hoy = this._hoyLocal();
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
                .ppe-table{width:100%;font-size:11px;border-collapse:collapse}
                .ppe-table th{padding:8px 10px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #e2e8f0;background:#f8fafc;position:sticky;top:0;z-index:1}
                .ppe-table th:nth-child(6),.ppe-table th:nth-child(7),.ppe-table th:nth-child(8),.ppe-table th:nth-child(9),.ppe-table td:nth-child(6),.ppe-table td:nth-child(7),.ppe-table td:nth-child(8),.ppe-table td:nth-child(9){text-align:right}
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
                .ppe-totales{display:flex;gap:16px;padding:8px 16px;background:#f8fafc;border-radius:0 0 10px 10px;font-size:11px;font-weight:600;color:#475569}
                .ppe-totales{display:flex;gap:16px;padding:8px 16px;background:#f8fafc;border-radius:0 0 10px 10px;font-size:11px;font-weight:600;color:#475569;flex-wrap:wrap}
                .ppe-totales span{color:#0f172a}
                /* Botones de cabecera del hero (patron MODULE_RESPONSIVE_V1) */
                .m-hero-btns{display:flex;gap:8px;flex-wrap:wrap}
                .ppe-hero{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 55%,#1e40af 100%);border-radius:16px;padding:20px 26px;display:flex;align-items:center;gap:14px;position:relative;overflow:hidden;margin-bottom:16px}
                .ppe-hero::after{content:'';position:absolute;left:0;right:0;bottom:0;height:1px;background:linear-gradient(90deg,transparent,rgba(147,197,253,.55),transparent)}
                .ppe-hero h2{color:#fff;font-size:20px;font-weight:700;margin:0}
                .ppe-hero p{color:rgba(255,255,255,.62);font-size:11px;margin:4px 0 0}
                .ppe-hero-actions{margin-left:auto;display:flex;gap:8px;align-items:center}
                .ppe-hbtn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);color:#fff;cursor:pointer;font-size:11px;font-weight:600;white-space:nowrap}
                .ppe-hbtn:hover{background:rgba(255,255,255,.2)}
                .ppe-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px;width:100%}
                .ppe-kpi{background:#fff;border:1px solid #e4e9f0;border-radius:12px;padding:10px 16px;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
                .ppe-kpi .k{font-size:10px;font-weight:600;letter-spacing:.7px;text-transform:uppercase;color:#8494a8}
                .ppe-kpi .v{font-size:18px;font-weight:700}
                .ppe-kpi .s{font-size:10px;color:#8494a8}
                @media(max-width:768px){.m-hero-btns .btn{height:40px;min-height:40px;flex:1}}
            </style>

            <div class="ppe-hero">
                <div>
                    <h2>Programación por Estación</h2>
                    <p>Vista de programación completa por estación y fecha</p>
                </div>
                <div class="ppe-hero-actions">
                    <button class="ppe-hbtn" onclick="App.modules.prod_prog_estacion.imprimir()" title="Imprimir el programa de máquinas (una hoja por estación)">🖨 Imprimir programa</button>
                    <button class="ppe-hbtn" onclick="App.modules.prod_prog_estacion.reporteCartas()" title="Cartas clave por estación: días de carga, unidades, m² y kilos">📊 Reporte</button>
                    <button class="ppe-hbtn" onclick="App.modules.prod_prog_estacion.exportarExcel()">⬇ Exportar CSV</button>
                </div>
            </div>

            <div style="background:white;border-radius:14px;padding:20px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,.04);margin-bottom:20px;animation:ppeFadeUp .5s ease both">
                <div class="m-filters">
                    <div style="flex:2;min-width:200px">
                        <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Estación</label>
                        <select id="ppeFilterEstacion" onchange="App.modules.prod_prog_estacion.aplicarFiltros()" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;background:white">
                            <option value="">Todas las estaciones</option>
                        </select>
                    </div>
                    <div style="flex:1;min-width:140px">
                        <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Desde</label>
                        <input type="date" id="ppeFilterInicio" value="${this.filtros.fecha_inicio}" onchange="App.modules.prod_prog_estacion.aplicarFiltros()" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none">
                    </div>
                    <div style="flex:1;min-width:140px">
                        <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Hasta</label>
                        <input type="date" id="ppeFilterFin" value="${this.filtros.fecha_fin}" onchange="App.modules.prod_prog_estacion.aplicarFiltros()" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none">
                    </div>
                    <div style="flex:1;min-width:140px">
                        <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Estado</label>
                        <select id="ppeFilterEstado" onchange="App.modules.prod_prog_estacion.aplicarFiltros()" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;background:white">
                            <option value="por_fabricar" selected>Por fabricar</option>
                            <option value="fabricado">Fabricado</option>
                            <option value="todos">Todos (por fabricar + fabricado)</option>
                        </select>
                    </div>
                    <div>
                        <button onclick="App.modules.prod_prog_estacion.limpiarFiltros()" style="padding:8px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:11px;cursor:pointer;background:white;color:#64748b;white-space:nowrap">Limpiar</button>
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
        if (this.filtros.estado) params.set('estado', this.filtros.estado);

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

    _hoyLocal() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },
    poblarEstaciones() {
        const sel = document.getElementById('ppeFilterEstacion');
        if (!sel || !this.datos) return;
        const val = sel.value;
        sel.innerHTML = '<option value="">Todas las estaciones</option>';
        for (const e of this.datos.todas_estaciones || []) {
            const cb = e.cuello_botella ? ' [CB]' : '';
            sel.innerHTML += `<option value="${e.id}" ${String(e.id) === String(val) ? 'selected' : ''}>${e.orden_secuencia_defecto || '?'}° ${escText(e.nombre_estacion)}${cb} (cap: ${e.cap_max} m²)</option>`;
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
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px;width:100%">
                <div style="background:#fff;border:1px solid #e4e9f0;border-radius:12px;padding:10px 16px;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap"><div style="font-size:10px;font-weight:600;letter-spacing:.7px;text-transform:uppercase;color:#8494a8">Estaciones</div><div style="font-size:18px;font-weight:700;color:#2563eb">${totalEstaciones}</div><div style="font-size:10px;color:#8494a8">con programación</div></div>
                <div style="background:#fff;border:1px solid #e4e9f0;border-radius:12px;padding:10px 16px;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap"><div style="font-size:10px;font-weight:600;letter-spacing:.7px;text-transform:uppercase;color:#8494a8">Órdenes</div><div style="font-size:18px;font-weight:700;color:#7c3aed">${Number(totalOrd).toLocaleString('es-CL')}</div><div style="font-size:10px;color:#8494a8">en el rango seleccionado</div></div>
                <div style="background:#fff;border:1px solid #e4e9f0;border-radius:12px;padding:10px 16px;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap"><div style="font-size:10px;font-weight:600;letter-spacing:.7px;text-transform:uppercase;color:#8494a8">Total m²</div><div style="font-size:18px;font-weight:700;color:#15803d">${Number(totalM2).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}</div><div style="font-size:10px;color:#8494a8">superficie total</div></div>
                <div style="background:#fff;border:1px solid #e4e9f0;border-radius:12px;padding:10px 16px;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap"><div style="font-size:10px;font-weight:600;letter-spacing:.7px;text-transform:uppercase;color:#8494a8">Total kg</div><div style="font-size:18px;font-weight:700;color:#b45309">${Number(totalKg).toLocaleString('es-CL',{minimumFractionDigits:0,maximumFractionDigits:0})}</div><div style="font-size:10px;color:#8494a8">peso total</div></div>
            </div>
        `;
    },

    renderContenido() {
        const el = document.getElementById('ppeContenido');
        if (!el || !this.datos) return;
        const estaciones = this.datos.estaciones || [];
        if (!estaciones.length) {
            el.innerHTML = '<div style="background:white;border-radius:14px;padding:40px;text-align:center;color:#94a3b8;border:1px solid #e2e8f0"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" style="margin-bottom:12px"><path d="M2 20h20"/><path d="M5 20V8l5 4V8l5 4V4h3v16"/></svg><div style="font-size:15px;font-weight:600">Sin programación</div><div style="font-size:10px;margin-top:4px">No hay ordenes programadas en el rango seleccionado</div></div>';
            return;
        }

        let html = '';
        for (const est of estaciones) {
            const color = est.cuello_botella ? '#ef4444' : '#3b82f6';
            html += `<div style="background:white;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,.04)">`;
            html += `<div style="background:linear-gradient(135deg,${color},${color}dd);color:white;padding:12px 16px;display:flex;justify-content:space-between;align-items:center">`;
            html += `<div><span style="font-size:15px;font-weight:800">${escText(est.orden)}° ${escText(est.nombre)}</span>`;
            if (est.cuello_botella) html += ` <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.2);margin-left:6px">CUELLO DE BOTELLA</span>`;
            html += `</div>`;
            html += `<div style="text-align:right;font-size:11px"><span>${est.total_ordenes} ord</span> · <span>${(est.fechas || []).reduce((s, d) => s + this._unidadesDia(d), 0).toLocaleString('es-CL')} und</span> · <span>${Number(est.total_m2).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})} m²</span> · <span>${Number(est.total_kg).toLocaleString('es-CL',{minimumFractionDigits:0,maximumFractionDigits:0})} kg</span></div>`;
            html += `</div>`;

            if (!est.fechas || est.fechas.length === 0) {
                html += `<div style="padding:16px;text-align:center;color:#94a3b8;font-size:13px">Sin programación en este rango</div>`;
            } else {
                for (const dia of est.fechas) {
                    const _fd = new Date(dia.fecha + 'T12:00:00');
                    const fechaFmt = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][_fd.getDay()] + ' ' + String(_fd.getDate()).padStart(2, '0') + '-' + String(_fd.getMonth() + 1).padStart(2, '0') + '-' + _fd.getFullYear();
                    const esHoy = dia.fecha === this._hoyLocal();
                    html += `<div class="ppe-date-header" style="${esHoy ? 'background:linear-gradient(135deg,#059669,#10b981)' : ''}">`;
                    html += `<div>${esHoy ? 'HOY - ' : ''}${fechaFmt}</div>`;
                    html += `<div>${dia.total_ordenes} ord · ${this._unidadesDia(dia).toLocaleString('es-CL')} und · ${Number(dia.total_m2).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})} m² · ${Number(dia.total_kg).toLocaleString('es-CL',{minimumFractionDigits:0,maximumFractionDigits:0})} kg</div>`;
                    html += `</div>`;
                    html += `<div class="m-table-wrap"><table class="ppe-table"><thead><tr>`;
                    html += `<th>Pedido</th><th>Item</th><th>Prioridad</th><th>Código</th><th>Ref/Padre</th><th>Dim</th><th>Cant. pend.</th><th>M²</th><th>Kg</th><th>Cliente</th><th>Estado</th><th>Ruta</th><th>Grupo</th>`;
                    html += `</tr></thead><tbody>`;

                    let cardsDia = '';
                    const groups = {};
                    const sinGrupo = [];
                    const _ord = [...(dia.ordenes || [])].sort((a, b) => ((({ 4: 0, 2: 1, 3: 2 }[Number(a.prioridad)] ?? 3) - ({ 4: 0, 2: 1, 3: 2 }[Number(b.prioridad)] ?? 3)) || ((Number(a.espesor ?? a.mp_espesor) || 0) - (Number(b.espesor ?? b.mp_espesor) || 0)) || String(a.pedido || a.ov || '').localeCompare(String(b.pedido || b.ov || ''), 'es', { numeric: true }) || ((Number(a.item) || 0) - (Number(b.item) || 0))));
                    for (const o of _ord) {
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
                        cardsDia += this._renderFilaCard(o);
                    }

                    const _vistos = new Set(); for (const o2 of _ord) { const key = (o2.pedido || o2.ov || '') + '|' + o2.item + '|' + o2.codigo_ref; if (!groups[key] || _vistos.has(key)) continue; _vistos.add(key); const grp = groups[key];
                        const p = grp.padre;
                        html += `<tr style="border-bottom:2px solid #e2e8f0">`;
                        html += `<td><strong>${this.esc(p.pedido || '-')}</strong></td>`;
                        html += `<td>${this.esc(p.item || '-')}</td>`;
                        html += `<td>${this._prioBadge(p.prioridad)}</td>`;
                        html += `<td><strong style="color:#0369a1">${this.esc(p.codigo_ref)}</strong></td>`;
                        html += `<td style="font-size:10px">${p.nombre_padre ? '<span style="color:#94a3b8">' + this.esc(p.nombre_padre) + '</span>' : ''}</td>`;
                        html += `<td>${Number(p.ancho).toLocaleString('es-CL')}×${Number(p.alto).toLocaleString('es-CL')}</td>`;
                        const undTotal = grp.hijos[0] ? (Number(grp.hijos[0].cantidad) || 0) : 0;
                        const undPend = grp.hijos[0] ? (Number(grp.hijos[0].cantidad_paso) || undTotal) : 0;
                        html += `<td title="Cantidad pendiente del pedido de ${undTotal.toLocaleString('es-CL')} und"><strong>${undPend.toLocaleString('es-CL')}</strong> und</td>`;
                        const totalM2Grupo = grp.hijos[0] ? (grp.hijos[0].m2_asignados || grp.hijos[0].m2) : 0;
                        const totalKgGrupo = grp.hijos.reduce((s, h) => s + h.kg, 0);
                        html += `<td><strong>${Number(totalM2Grupo).toLocaleString('es-CL',{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></td>`;
                        html += `<td><strong>${Number(totalKgGrupo).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}</strong></td>`;
                        html += `<td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${this.esc(this._titulo(p.cliente || '-'))}</td>`;
                        html += `<td>${p.estado === 'PENDIENTE' ? '' : `<span class="ppe-badge ppe-estado-${p.estado}">${this.esc(p.estado)}</span>`}</td>`;
                        html += `<td style="font-size:10px">${this.esc(p.ruta)}</td>`;
                        html += `<td><span style="padding:1px 6px;border-radius:4px;font-size:10px;background:#f0fdf4;color:#166534">${this.esc(p.grupo || '-')}</span></td>`;
                        html += `</tr>`;
                        cardsDia += this._renderGrupoCard(p, grp.hijos);
                    }

                    html += `</tbody></table></div>`;
                    html += `<div class="m-cards-mobile" style="display:none;padding:12px">${cardsDia}</div>`;
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
        const hoy = this._hoyLocal();
        const fin = new Date(); fin.setDate(fin.getDate() + 14);
        this.filtros = { estacion_id: '', fecha_inicio: hoy, fecha_fin: fin.toISOString().split('T')[0], estado: 'por_fabricar' };
        this.render();
    },

    formatFecha(fechaStr) {
        const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        const d = new Date(fechaStr + 'T12:00:00');
        return `${d.getDate()} de ${meses[d.getMonth()]} ${d.getFullYear()}`;
    },

    // Escapeo de texto/atributo: delega al helper global (el metodo viejo no escapaba comillas)
    esc(s) { return escText(s); },

    // Card movil para una orden suelta (patron MODULE_RESPONSIVE_V1)
    _renderFilaCard(o) {
        return `<div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:start;gap:8px;margin-bottom:6px">
                <div style="min-width:0">
                    <div style="font-weight:700;font-size:13px;color:#0f172a">${this.esc(o.pedido || '-')} <span style="font-weight:500;font-size:11px;color:#64748b">Item ${this.esc(o.item || '-')}</span></div>
                    <div style="font-size:10px;color:#475569;margin-top:2px">${this.esc(this._titulo(o.cliente || '-'))}</div>
                </div>
                <div style="flex-shrink:0"><span class="ppe-badge ppe-estado-${o.estado}">${this.esc(o.estado)}</span></div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-bottom:6px">
                <strong style="font-size:10px;color:#0f172a">${this.esc(o.codigo)}</strong>${o.es_compuesto ? ' <span style="font-size:10px;padding:1px 4px;border-radius:3px;background:#ede9fe;color:#7c3aed">BOM</span>' : ''}
                <span style="font-size:10px;color:#94a3b8">${this.esc(o.codigo_ref)}${o.nombre_padre ? ' · ' + this.esc(o.nombre_padre) : ''}</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px">
                <div><span style="color:#94a3b8">Dim:</span> <span style="color:#475569">${this.esc(o.ancho)}×${this.esc(o.alto)}</span></div>
                <div><span style="color:#94a3b8">Cant:</span> <span style="color:#475569">${this.esc(o.cantidad || 1)}</span></div>
                <div><span style="color:#94a3b8">M²:</span> <strong style="color:#0f172a">${Number((o.m2_asignados || o.m2)).toLocaleString('es-CL',{minimumFractionDigits:2,maximumFractionDigits:2})}</strong> <span style="color:#94a3b8">Kg:</span> <strong style="color:#0f172a">${Number(o.kg).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}</strong></div>
                <div><span style="padding:1px 6px;border-radius:4px;font-size:10px;background:#f0fdf4;color:#166534">${this.esc(o.grupo || '-')}</span></div>
                <div style="grid-column:1/-1"><span style="color:#94a3b8">Ruta:</span> <span style="font-size:10px;color:#7c3aed">${this.esc(o.ruta || '-')}</span></div>
            </div>
        </div>`;
    },

    // Card movil para un grupo padre (sin filas de materias primas: esa info
    // no se necesita en pantalla — solo las unidades)
    _renderGrupoCard(p, hijos) {
        const totalM2Grupo = hijos[0] ? (hijos[0].m2_asignados || hijos[0].m2) : 0;
        const totalKgGrupo = hijos.reduce((s, h) => s + h.kg, 0);
        const undPend = hijos[0] ? (Number(hijos[0].cantidad_paso) || Number(hijos[0].cantidad) || 0) : 0;
        return `<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:12px 14px;margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:start;gap:8px;margin-bottom:6px">
                <div style="min-width:0">
                    <div style="font-weight:700;font-size:13px;color:#0f172a">${this.esc(p.pedido || '-')} <span style="font-weight:500;font-size:11px;color:#64748b">Item ${this.esc(p.item || '-')}</span></div>
                    <div style="font-size:10px;color:#475569;margin-top:2px">${this.esc(this._titulo(p.cliente || '-'))}</div>
                </div>
                <div style="flex-shrink:0"><span class="ppe-badge ppe-estado-${p.estado}">${this.esc(p.estado)}</span></div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-bottom:6px">
                <strong style="color:#0369a1;font-size:11px">${this.esc(p.codigo_ref)}</strong>
               
                ${p.nombre_padre ? '<span style="font-size:10px;color:#94a3b8">' + this.esc(p.nombre_padre) + '</span>' : ''}
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;margin-bottom:4px">
                <div><span style="color:#94a3b8">Dim:</span> <span style="color:#475569">${this.esc(Number(p.ancho).toLocaleString('es-CL'))}×${this.esc(Number(p.alto).toLocaleString('es-CL'))}</span></div>
                <div><span style="color:#94a3b8">Und pend.:</span> <span style="color:#475569">${undPend.toLocaleString('es-CL')} und</span></div>
                <div><span style="color:#94a3b8">M²:</span> <strong style="color:#0f172a">${Number(totalM2Grupo).toLocaleString('es-CL',{minimumFractionDigits:2,maximumFractionDigits:2})}</strong> <span style="color:#94a3b8">Kg:</span> <strong style="color:#0f172a">${Number(totalKgGrupo).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}</strong></div>
                <div><span style="padding:1px 6px;border-radius:4px;font-size:10px;background:#f0fdf4;color:#166534">${this.esc(p.grupo || '-')}</span></div>
                <div style="grid-column:1/-1"><span style="color:#94a3b8">Ruta:</span> <span style="font-size:10px;color:#7c3aed">${this.esc(p.ruta)}</span></div>
            </div>
            ${hijos.map(h => {
                const mpInfo = h.mp_nombre ? `${this.esc(h.mp_nombre)}${h.mp_espesor ? ' ' + escText(h.mp_espesor) + 'mm' : ''}` : '';
                const mpPend = Number(h.cantidad_paso) || Number(h.cantidad) || 0;
                return `<div style="display:flex;justify-content:space-between;gap:6px;padding:4px 0;border-top:1px solid #f1f5f9;font-size:11px">
                    <div style="min-width:0"><span style="color:#7c3aed">└</span> <strong>${this.esc(h.codigo)}</strong> <span style="color:#94a3b8">${mpInfo || this.esc(h.codigo_ref)}</span></div>
                    <div style="white-space:nowrap;color:#475569">${mpPend.toLocaleString('es-CL')} und <span style="font-size:9px;color:#94a3b8">receta</span></div>
                </div>`;
            }).join('')}
        </div>`;
    },

    // Mayúsculas naturales: "VENTAGLASS SERVICIOS SPA" → "Ventaglass servicios SPA"
    // (siglas y palabras cortas se conservan; una sola palabra queda como viene)
    _titulo(t) {
        const s2 = String(t || '').trim();
        if (!s2 || !/\s/.test(s2)) return s2;
        return s2.split(/\s+/).map(w => (w.includes('.') || w.length <= 4) ? w : (w.charAt(0) + w.slice(1).toLowerCase())).join(' ');
    },

    // Unidades de un día: los grupos (padre + MPs) cuentan UNA vez las
    // unidades de la orden (las filas MP repiten la misma cantidad)
    _unidadesDia(dia) {
        const vistas = new Set();
        let und = 0;
        for (const o of [...(dia.ordenes || [])].sort((a, b) => ((({ 4: 0, 2: 1, 3: 2 }[Number(a.prioridad)] ?? 3) - ({ 4: 0, 2: 1, 3: 2 }[Number(b.prioridad)] ?? 3)) || ((Number(a.espesor ?? a.mp_espesor) || 0) - (Number(b.espesor ?? b.mp_espesor) || 0)) || String(a.pedido || a.ov || '').localeCompare(String(b.pedido || b.ov || ''), 'es', { numeric: true }) || ((Number(a.item) || 0) - (Number(b.item) || 0))))) {
            if (o.es_compuesto && o.codigo_ref) {
                const key = `${o.pedido}|${o.item}|${o.codigo_ref}`;
                if (vistas.has(key)) continue;
                vistas.add(key);
            }
            und += Number(o.cantidad) || 0;
        }
        return und;
    },

    // Badge de prioridad (numerada, idioma de etiquetas)
    _prioBadge(n) {
        const map = { 1: ['Normal', '#eff6ff', '#1d4ed8'], 2: ['Express', '#fef9c3', '#854d0e'], 3: ['Urgencia', '#dcfce7', '#15803d'], 4: ['Reposición', '#fee2e2', '#b91c1c'] };
        const m = map[Number(n) || 1] || map[1];
        return '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:' + m[1] + ';color:' + m[2] + ';white-space:nowrap">● ' + m[0] + '</span>';
    },

    _renderFila(o, estadoClass, esHijo) {
        let html = '<tr>';
        html += `<td><strong>${this.esc(o.pedido || '-')}</strong></td>`;
        html += `<td>${this.esc(o.item || '-')}</td>`;
        html += `<td>${this._prioBadge(o.prioridad)}</td>`;
        html += `<td><strong>${this.esc(o.codigo)}</strong>${o.es_compuesto ? ' <span style="font-size:10px;padding:1px 4px;border-radius:3px;background:#ede9fe;color:#7c3aed">BOM</span>' : ''}</td>`;
        html += `<td style="font-size:10px"><strong>${this.esc(o.codigo_ref)}</strong>${o.nombre_padre ? '<br><span style="color:#94a3b8">' + this.esc(o.nombre_padre) + '</span>' : ''}</td>`;
        html += `<td>${Number(o.ancho).toLocaleString('es-CL')}×${Number(o.alto).toLocaleString('es-CL')}</td>`;
        html += `<td title="Cantidad pendiente del pedido"><strong>${Number(o.cantidad_paso || o.cantidad || 1).toLocaleString('es-CL')}</strong> und</td>`;
        html += `<td><strong>${Number((o.m2_asignados || o.m2)).toLocaleString('es-CL',{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></td>`;
        html += `<td><strong>${Number(o.kg_paso != null ? o.kg_paso : o.kg).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}</strong></td>`;
        html += `<td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${this.esc(this._titulo(o.cliente || '-'))}</td>`;
        html += `<td>${o.estado === 'PENDIENTE' ? '' : `<span class="ppe-badge ${estadoClass}">${this.esc(o.estado)}</span>`}</td>`;
        html += `<td style="font-size:10px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escAttr(o.ruta)}">${this.esc(o.ruta)}</td>`;
        html += `<td><span style="padding:1px 6px;border-radius:4px;font-size:10px;background:#f0fdf4;color:#166534">${this.esc(o.grupo || '-')}</span></td>`;
        html += '</tr>';
        return html;
    },

    // ── Impresión del programa de máquinas ──────────────────────────────────
    // Una HOJA por estación (salto de página), con sus días y órdenes: se puede
    // colgar en la máquina. Usa los filtros activos (si filtras una estación,
    // imprime solo su programa).
    // ── Reporte: cartas clave por estación ─────────────────────────────────
    // Días de carga · unidades · m² · kilos (respeta el filtro de estación)
    reporteCartas() {
        if (!this.datos || !this.datos.estaciones || !this.datos.estaciones.length) {
            App.showAlert('No hay programación para el reporte', 'danger');
            return;
        }
        let ests = this.datos.estaciones || [];
        if (this.filtros && this.filtros.estacion_id) {
            const f = String(this.filtros.estacion_id);
            ests = ests.filter(e => String(e.id ?? e.estacion_id ?? '') === f || String(e.nombre || '') === f);
        }
        const fmtN = (v, dec) => Number(v || 0).toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec });
        const html = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px">`
            + ests.map(est => {
                const fechas = (est.fechas || []).filter(d => (d.total_ordenes || 0) > 0);
                const und = (est.fechas || []).reduce((s, d) => s + this._unidadesDia(d), 0);
                return `<div style="background:#fff;border:1px solid #e4e9f0;border-radius:12px;padding:14px 16px">
                    <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:8px">${escText(est.orden ? est.orden + '° ' : '')}${escText(est.nombre || '')}</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                        <div><div style="font-size:10px;color:#8494a8;text-transform:uppercase;letter-spacing:.5px">Días de carga</div><div style="font-size:18px;font-weight:700;color:#2563eb">${fechas.length}</div></div>
                        <div><div style="font-size:10px;color:#8494a8;text-transform:uppercase;letter-spacing:.5px">Unidades</div><div style="font-size:18px;font-weight:700;color:#7c3aed">${fmtN(und, 0)}</div></div>
                        <div><div style="font-size:10px;color:#8494a8;text-transform:uppercase;letter-spacing:.5px">M²</div><div style="font-size:18px;font-weight:700;color:#15803d">${fmtN(est.total_m2, 1)}</div></div>
                        <div><div style="font-size:10px;color:#8494a8;text-transform:uppercase;letter-spacing:.5px">Kilos</div><div style="font-size:18px;font-weight:700;color:#b45309">${fmtN(est.total_kg, 0)}</div></div>
                    </div>
                </div>`;
            }).join('')
            + `</div>`;
        App.showModalInv('📊 Reporte por estación — cartas clave', html,
            `<button class="ppe-hbtn" style="color:#475569;border-color:#e4e9f0;background:#fff" onclick="App.hideModal()">Cerrar</button>`);
    },

    imprimir() {
        if (!this.datos || !this.datos.estaciones || !this.datos.estaciones.length) {
            App.showAlert('No hay programación para imprimir con los filtros actuales', 'danger');
            return;
        }
        // La impresión respeta el filtro de estación activo (si hay una estación
        // seleccionada, se imprime SOLO su programa)
        if (this.filtros && this.filtros.estacion_id) {
            const f = String(this.filtros.estacion_id);
            const estFiltradas = (this.datos.estaciones || []).filter(e =>
                String(e.id ?? e.estacion_id ?? '') === f || String(e.nombre || '') === f);
            if (!estFiltradas.length) {
                App.showAlert('La estación filtrada no tiene programación para imprimir', 'danger');
                return;
            }
            this.datos = { ...this.datos, estaciones: estFiltradas };
        }
        let frame = document.getElementById('ppePrintFrame');
        if (!frame) {
            frame = document.createElement('iframe');
            frame.id = 'ppePrintFrame';
            frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
            document.body.appendChild(frame);
        }
        frame.onload = () => {
            try { frame.contentWindow.focus(); frame.contentWindow.print(); }
            catch (e) { App.showAlert('No se pudo abrir la impresión: ' + e.message, 'danger'); }
        };
        frame.srcdoc = this._htmlImpresion();
    },

    _num(v, dec) { return Number(v || 0).toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec }); },
    _fechaCorta(s) {
        if (!s) return '';
        const d = new Date(String(s).slice(0, 10) + 'T12:00:00');
        if (isNaN(d.getTime())) return String(s);
        const p = (x) => String(x).padStart(2, '0');
        return p(d.getDate()) + '-' + p(d.getMonth() + 1) + '-' + d.getFullYear();
    },
    _fechaLarga(s) {
        const d = new Date(String(s).slice(0, 10) + 'T12:00:00');
        if (isNaN(d.getTime())) return String(s);
        const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        return dias[d.getDay()] + ' ' + this._fechaCorta(s);
    },

    _htmlImpresion() {
        const d = this.datos;
        const hoy = new Date();
        const p = (x) => String(x).padStart(2, '0');
        const impreso = `${p(hoy.getDate())}-${p(hoy.getMonth() + 1)}-${hoy.getFullYear()} ${p(hoy.getHours())}:${p(hoy.getMinutes())}`;
        const rango = `${this._fechaCorta(this.filtros.fecha_inicio)} al ${this._fechaCorta(this.filtros.fecha_fin)}`;
        const E = (v) => this.esc(v == null ? '' : v);

        let cuerpo = '';
        let primero = true;
        for (const est of (d.estaciones || [])) {
            const nombre = E(est.nombre || est.nombre_estacion || 'Estación');
            const orden = est.orden != null ? est.orden + '° ' : (est.orden_secuencia_defecto != null ? est.orden_secuencia_defecto + '° ' : '');
            const cb = est.cuello_botella ? ' · CUELLO DE BOTELLA' : '';
            const cap = est.capacidad_m2_dia != null ? est.capacidad_m2_dia : est.cap_max;
            cuerpo += `<section class="hoja${primero ? '' : ' salto'}">`;
            cuerpo += `<header>
                <div class="t1">PROGRAMA DE MÁQUINA</div>
                <div class="t2">${orden}${nombre}${cb}</div>
                <div class="meta">Período: ${rango} · Capacidad: ${this._num(cap, 0)} m²/día · <strong>${est.total_ordenes || 0} órdenes</strong> · ${this._num(est.total_m2, 1)} m² · ${this._num(est.total_kg, 0)} kg</div>
            </header>`;
            for (const dia of (est.fechas || [])) {
                // Cada CAMBIO DE DÍA empieza hoja nueva (el primer día de la
                // estación queda junto al título de la estación)
                if (this._printEstPrev !== est) { this._printEstPrev = est; this._printDiaIdx = 0; }
                const _brkDia = this._printDiaIdx++ > 0 ? ' style="break-before:page;page-break-before:always"' : '';
                cuerpo += `<h3 class="dia"${_brkDia}>${(() => { const d = new Date(dia.fecha + 'T12:00:00'); return ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()] + ' ' + String(d.getDate()).padStart(2, '0') + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + d.getFullYear(); })()}<span>${dia.total_ordenes || 0} órdenes · ${this._num(dia.total_m2, 1)} m² · ${this._num(dia.total_kg, 0)} kg</span></h3>`;
                cuerpo += '<table><thead><tr>'
                    + '<th>Pedido</th><th>Item</th><th>Prioridad</th><th>Código SAP</th><th>Descripción</th><th>Código</th><th>Materia prima</th><th>Espesor</th><th>Ancho</th><th>Alto</th>'
                    + '<th>Cant</th><th>M²</th><th>Kg</th><th>Cliente</th><th>Ruta</th><th>Estado</th><th>QR</th>'
                    + '</tr></thead><tbody>';
                for (const o of [...(dia.ordenes || [])].sort((a, b) => ((({ 4: 0, 2: 1, 3: 2 }[Number(a.prioridad)] ?? 3) - ({ 4: 0, 2: 1, 3: 2 }[Number(b.prioridad)] ?? 3)) || ((Number(a.espesor ?? a.mp_espesor) || 0) - (Number(b.espesor ?? b.mp_espesor) || 0)) || String(a.pedido || a.ov || '').localeCompare(String(b.pedido || b.ov || ''), 'es', { numeric: true }) || ((Number(a.item) || 0) - (Number(b.item) || 0))))) {
                    cuerpo += `<tr>
                        <td class="c">${E(o.pedido)}</td>
                        <td class="c">${E(o.item)}</td>
                        <td class="c">${E(({ 1: 'Normal', 2: 'Express', 3: 'Urgencia', 4: 'Reposición' }[o.prioridad]) || '—')}</td>
                        <td class="c"><strong>${E(o.codigo_ref)}</strong></td>
                        <td>${E(o.nombre_padre || o.descripcion || '')}</td>
                        <td class="c">${E(o.codigo)}</td>
                        <td>${E(o.mp_nombre || '—')}</td>
                        <td class="n">${o.mp_espesor ? Number(o.mp_espesor).toLocaleString('es-CL', { maximumFractionDigits: 2 }) + ' mm' : '—'}</td>
                        <td class="n">${this._num(o.ancho, 0)}</td>
                        <td class="n">${this._num(o.alto, 0)}</td>
                        <td class="n">${this._num(o.cantidad_paso != null ? o.cantidad_paso : o.cantidad, 0)}</td>
                        <td class="n">${this._num(o.m2_asignados || o.m2, 2)}</td>
                        <td class="n">${this._num(o.kg_paso != null ? o.kg_paso : o.kg, 1)}</td>
                        <td>${E(o.cliente)}</td>
                        <td>${E(o.ruta)}</td>
                        <td class="c">${E(o.estado)}</td>
                        <td class="c"><img src="${(typeof location !== 'undefined' ? location.origin : '')}/api/taller/qr?d=${encodeURIComponent((typeof location !== 'undefined' ? location.origin : '') + '/taller/index.html?qr=VF:' + (o.pedido || '') + '|' + (o.item || 1) + '&estacion=' + (est.estacion_id || ''))}" width="44" height="44" alt="QR"></td>
                    </tr>`;
                }
                cuerpo += '</tbody></table>';
            }
            cuerpo += `<footer>VitroFlow · Programa de máquinas · Período ${rango} · Impreso ${impreso}</footer>`;
            cuerpo += '</section>';
            primero = false;
        }

        return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Programa de máquinas</title><style>'
            + '@page{size:A4 landscape;margin:10mm}'
            + '*{box-sizing:border-box}'
            + 'body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:10px;margin:0}'
            + '.hoja{padding:2px}'
            + '.salto{page-break-before:always}'
            + 'header{border-bottom:2px solid #111;padding-bottom:6px;margin-bottom:8px}'
            + '.t1{font-size:9px;letter-spacing:2px;color:#555}'
            + '.t2{font-size:17px;font-weight:800;margin:2px 0 3px}'
            + '.meta{font-size:10px;color:#333}'
            + 'h3.dia{font-size:11px;margin:10px 0 4px;padding:3px 6px;background:#eee;border-left:3px solid #111;display:flex;justify-content:space-between}'
            + 'h3.dia span{font-weight:400;color:#444;font-size:9.5px;align-self:center}'
            + 'table{width:100%;border-collapse:collapse}'
            + 'th{background:#e8e8e8;border:1px solid #999;padding:3px 5px;font-size:9px;text-transform:uppercase;text-align:left}'
            + 'td{border:1px solid #bbb;padding:3px 5px;font-size:10px}'
            + 'td.n{text-align:right;font-variant-numeric:tabular-nums}'
            + 'td.c{text-align:center}'
            + 'tbody tr:nth-child(even){background:#fafafa}'
            + 'footer{margin-top:10px;padding-top:5px;border-top:1px solid #999;font-size:8.5px;color:#555;display:flex;justify-content:space-between}'
            + '</style></head><body>' + cuerpo + '</body></html>';
    },

    exportarExcel() {
        if (!this.datos || !this.datos.estaciones || !this.datos.estaciones.length) return;
        let csv = 'Estacion;Fecha;Pedido;Item;Prioridad;Código SAP;Descripción;Código;Ancho;Alto;Cant;M2;Kg;Cliente;Estado;Ruta;Grupo\n';
        for (const est of this.datos.estaciones) {
            for (const dia of (est.fechas || [])) {
                for (const o of dia.ordenes) {
                    csv += [est.nombre, dia.fecha, o.pedido, o.item, o.prioridad, o.codigo_ref, (o.nombre_padre || o.descripcion || ''), o.codigo, o.ancho, o.alto, (o.cantidad_paso != null ? o.cantidad_paso : o.cantidad), Number((o.m2_asignados || o.m2)).toLocaleString('es-CL',{minimumFractionDigits:2,maximumFractionDigits:2}), Number(o.kg_paso != null ? o.kg_paso : o.kg).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1}), o.cliente, o.estado, o.ruta, o.grupo].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(';') + '\n';
                }
            }
        }
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `prog_estacion_${this._hoyLocal()}.csv`;
        a.click();
    }
});
