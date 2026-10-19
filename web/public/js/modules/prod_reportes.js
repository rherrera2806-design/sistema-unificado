App.registerModule('prod_reportes', {
    datos: null,
    filtros: { familia: 'todas', fecha_inicio: '', fecha_fin: '', grupo: 'todos', estado: 'todos' },

    async render() {
        const el = document.getElementById('page-prod_reportes');
        const hoy = this._hoyLocal();
        if (!this.filtros.fecha_inicio) this.filtros.fecha_inicio = hoy;
        if (!this.filtros.fecha_fin) {
            const fin = new Date(); fin.setDate(fin.getDate() + 14);
            this.filtros.fecha_fin = fin.toISOString().split('T')[0];
        }

        el.innerHTML = `
            <style>
                @keyframes prFadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
                .pr-card{transition:all .3s cubic-bezier(.4,0,.2,1)}
                .pr-card:hover{box-shadow:0 6px 20px rgba(0,0,0,.06)!important;transform:translateY(-1px)}
                .pr-table{width:100%;font-size:11px;border-collapse:collapse}
                .pr-table th{padding:8px 10px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #e2e8f0;background:#f8fafc;position:sticky;top:0;z-index:1}
                .pr-table td{padding:6px 10px;border-bottom:1px solid #f1f5f9;color:#334155}
                .pr-table tbody tr{transition:background .15s}
                .pr-table tbody tr:hover{background:#f8fafc!important}
                .pr-date-header{background:linear-gradient(135deg,#0f172a,#1e3a5f);color:white;padding:10px 16px;font-weight:700;font-size:13px;display:flex;justify-content:space-between;align-items:center;border-radius:10px 10px 0 0;margin-top:16px}
                .pr-date-header:first-child{margin-top:0}
                .pr-badge{display:inline-block;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:600}
                .pr-estado-PENDIENTE{background:#fef3c7;color:#92400e}
                .pr-estado-PROGRAMADO{background:#dbeafe;color:#1e40af}
                .pr-estado-EN_PROCESO{background:#e0e7ff;color:#3730a3}
                .pr-estado-TERMINADO{background:#d1fae5;color:#065f46}
                .pr-estado-CERRADO{background:#f1f5f9;color:#64748b}
                .pr-proceso{font-size:11px;color:#475569;letter-spacing:.3px}
                .pr-hero{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 55%,#1e40af 100%);border-radius:16px;padding:20px 26px;display:flex;align-items:center;gap:14px;position:relative;overflow:hidden;margin-bottom:16px}
                .pr-hero::after{content:'';position:absolute;left:0;right:0;bottom:0;height:1px;background:linear-gradient(90deg,transparent,rgba(147,197,253,.55),transparent)}
                .pr-hero h2{color:#fff;font-size:20px;font-weight:700;margin:0}
                .pr-hero p{color:rgba(255,255,255,.62);font-size:11px;margin:4px 0 0}
                .pr-hero-actions{margin-left:auto;display:flex;gap:8px;align-items:center}
                .pr-hbtn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);color:#fff;cursor:pointer;font-size:11px;font-weight:600;white-space:nowrap}
                .pr-hbtn:hover{background:rgba(255,255,255,.2)}
                .pr-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}
                .pr-kpi{background:#fff;border:1px solid #e4e9f0;border-radius:12px;padding:13px 16px}
                .pr-kpi .k{font-size:10px;font-weight:600;letter-spacing:.7px;text-transform:uppercase;color:#8494a8}
                .pr-kpi .v{font-size:20px;font-weight:700;margin-top:4px}
                .pr-kpi .s{font-size:10px;color:#8494a8;margin-top:2px}
                .pr-totales{display:flex;gap:16px;padding:8px 16px;background:#f8fafc;border-radius:0 0 10px 10px;font-size:11px;font-weight:600;color:#475569;flex-wrap:wrap}
                .pr-totales span{color:#0f172a}
                /* Botones de cabecera del hero (patron MODULE_RESPONSIVE_V1) */
                .m-hero-btns{display:flex;gap:8px;flex-wrap:wrap}
                @media(max-width:768px){.m-hero-btns .btn{height:40px;min-height:40px;flex:1}}
            </style>

            <div class="pr-hero">
                <div>
                    <h2>Informe de Fechas</h2>
                    <p>Reporte de órdenes agrupadas por fecha de entrega</p>
                </div>
                <div class="pr-hero-actions">
                    <button class="pr-hbtn" onclick="App.modules.prod_reportes.exportarExcel()">⬇ Exportar Excel</button>
                </div>
            </div>

            <div style="background:white;border-radius:14px;padding:20px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,.04);margin-bottom:20px;animation:prFadeUp .5s ease both">
                <div class="m-filters">
                    <div style="flex:1;min-width:140px">
                        <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Familia</label>
                        <select id="prFilterFamilia" onchange="App.modules.prod_reportes.aplicarFiltros()" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;background:white">
                            <option value="todas">Todas las familias</option>
                        </select>
                    </div>
                    <div style="flex:1;min-width:140px">
                        <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Grupo</label>
                        <select id="prFilterGrupo" onchange="App.modules.prod_reportes.aplicarFiltros()" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;background:white">
                            <option value="todos">Todos los grupos</option>
                        </select>
                    </div>
                    <div style="flex:1;min-width:140px">
                        <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Estado</label>
                        <select id="prFilterEstado" onchange="App.modules.prod_reportes.aplicarFiltros()" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;background:white">
                            <option value="todos">Todos</option>
                            <option value="PENDIENTE">Pendientes</option>
                            <option value="PROGRAMADO">Programadas</option>
                            <option value="EN_PROCESO">En Proceso</option>
                            <option value="TERMINADO">Terminadas</option>
                            <option value="CERRADO">Cerradas</option>
                        </select>
                    </div>
                    <div style="flex:1;min-width:140px">
                        <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Desde</label>
                        <input type="date" id="prFilterDesde" onchange="App.modules.prod_reportes.aplicarFiltros()" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none">
                    </div>
                    <div style="flex:1;min-width:140px">
                        <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Hasta</label>
                        <input type="date" id="prFilterHasta" onchange="App.modules.prod_reportes.aplicarFiltros()" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none">
                    </div>
                    <div>
                        <button class="btn btn-outline btn-sm" title="Limpiar filtros" onclick="App.modules.prod_reportes.limpiarFiltros()">Limpiar</button>
                    </div>
                </div>
            </div>

            <div id="prResumen" class="pr-kpis"></div>
            <div id="prReporte" style="animation:prFadeUp .5s ease .1s both"></div>
        `;

        document.getElementById('prFilterDesde').value = this.filtros.fecha_inicio;
        document.getElementById('prFilterHasta').value = this.filtros.fecha_fin;

        await this.cargarDatos();
    },

    async cargarDatos() {
        try {
            const params = new URLSearchParams();
            if (this.filtros.familia !== 'todas') params.set('familia', this.filtros.familia);
            if (this.filtros.grupo !== 'todos') params.set('grupo', this.filtros.grupo);
            if (this.filtros.estado !== 'todos') params.set('estado', this.filtros.estado);
            if (this.filtros.fecha_inicio) params.set('fecha_inicio', this.filtros.fecha_inicio);
            if (this.filtros.fecha_fin) params.set('fecha_fin', this.filtros.fecha_fin);

            const res = await fetch(`/api/produccion/reporte-fechas?${params.toString()}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            this.datos = await res.json();

            this.poblarFiltros();
            this.renderResumen();
            this.renderTabla();
        } catch (e) {
            console.error('Error cargando reporte:', e);
            document.getElementById('prReporte').innerHTML = `
                <div style="background:#fee2e2;border-radius:12px;padding:20px;color:#991b1b;text-align:center">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" style="margin-bottom:8px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <div style="font-weight:600">Error al cargar reporte</div>
                    <div style="font-size:11px;margin-top:4px;opacity:.8">${escText(e.message)}</div>
                </div>`;
        }
    },

    _hoyLocal() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },
    poblarFiltros() {
        if (!this.datos) return;
        const selFam = document.getElementById('prFilterFamilia');
        const selGrp = document.getElementById('prFilterGrupo');
        if (selFam && this.datos.familias) {
            const val = selFam.value;
            selFam.innerHTML = '<option value="todas">Todas las familias</option>' +
                this.datos.familias.map(f => `<option value="${escAttr(f)}" ${f === val ? 'selected' : ''}>${escText(f)}</option>`).join('');
        }
        if (selGrp && this.datos.grupos) {
            const val = selGrp.value;
            selGrp.innerHTML = '<option value="todos">Todos los grupos</option>' +
                this.datos.grupos.map(g => `<option value="${escAttr(g)}" ${g === val ? 'selected' : ''}>${escText(g)}</option>`).join('');
        }
    },

    // Badge de prioridad (numerada, idioma de etiquetas)
    _prioBadge(n) {
        const map = { 1: ['1 · Normal', '#eff6ff', '#1d4ed8'], 2: ['2 · Express', '#fef9c3', '#854d0e'], 3: ['3 · Urgencia', '#dcfce7', '#15803d'], 4: ['4 · Reposición', '#fee2e2', '#b91c1c'] };
        const m = map[Number(n) || 1] || map[1];
        return '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:' + m[1] + ';color:' + m[2] + ';white-space:nowrap">● ' + m[0] + '</span>';
    },

    renderResumen() {
        const el = document.getElementById('prResumen');
        if (!el || !this.datos) return;
        const fechas = this.datos.fechas || [];
        let totalItems = 0, totalM2 = 0, totalKgs = 0, totalUnd = 0;
        for (const f of fechas) {
            totalItems += f.totales.items;
            totalM2 += f.totales.m2;
            totalKgs += f.totales.kgs;
            totalUnd += f.totales.unidades || 0;
        }
        el.innerHTML = `
                <div class="pr-kpi"><div class="k">Fechas</div><div class="v" style="color:#0f172a">${fechas.length}</div><div class="s">con órdenes para entregar</div></div>
                <div class="pr-kpi"><div class="k">Items</div><div class="v" style="color:#7c3aed">${totalItems}</div><div class="s">líneas de producción</div></div>
                <div class="pr-kpi"><div class="k">Unidades</div><div class="v" style="color:#15803d">${Math.round(totalUnd).toLocaleString('es-CL')}</div><div class="s">a fabricar</div></div>
                <div class="pr-kpi"><div class="k">M² total</div><div class="v" style="color:#2563eb">${Number(totalM2).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}</div><div class="s">superficie del período</div></div>
        `;
    },

    renderTabla() {
        const el = document.getElementById('prReporte');
        if (!el || !this.datos) return;
        const fechas = this.datos.fechas || [];
        if (fechas.length === 0) {
            el.innerHTML = `
                <div style="background:white;border-radius:14px;padding:40px;text-align:center;border:1px solid #e2e8f0">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" style="margin-bottom:12px"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                    <div style="color:#94a3b8;font-size:15px;font-weight:600">Sin datos para los filtros seleccionados</div>
                    <div style="color:#cbd5e1;font-size:11px;margin-top:4px">Intenta cambiar las fechas o los filtros</div>
                </div>`;
            return;
        }

        let html = '';
        for (const fecha of fechas) {
            const fechaFmt = this.formatFecha(fecha.fecha);
            html += `
                <div class="pr-date-header">
                    <span>FECHA: ${fechaFmt}</span>
                    <span style="font-size:11px;opacity:.7">${fecha.ordenes.length} items</span>
                </div>
                <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;margin-bottom:4px">
                    <div class="m-table-wrap">
                    <table class="pr-table">
                        <thead><tr>
                            <th>OV</th><th>Item</th><th>Pend.</th><th>Estado</th><th>Prioridad</th><th>Cliente</th><th>SAP Padre</th>
                            <th>Descripción Padre</th><th>Espesor</th><th>Ancho</th><th>Alto</th>
                            <th style="text-align:right">M²</th>
                            <th style="text-align:right">Kgs</th><th>Ruta</th><th>Tipo</th><th>Grupo</th>
                        </tr></thead>
                        <tbody>`;

            let cardsHtml = '';
            for (const o of this._agrupar(fecha.ordenes)) {
                const estadoClass = 'pr-estado-' + (o.estado || 'PENDIENTE');
                html += `<tr>
                    <td style="font-weight:600">${escText(o.ov || '')}</td>
                    <td>${escText(o.item || '')}</td>
                    <td style="text-align:center">${escText(o.pend || '')}</td>
                    <td><span class="pr-badge ${estadoClass}">${escText(o.estado || '')}</span></td>
                    <td>${this._prioBadge(o.prioridad)}</td>
                    <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escAttr(o.cliente || '')}">${escText(o.cliente || '')}</td>
                    <td style="font-weight:600;white-space:nowrap">${escText(o.codigo_sap_padre || '')}</td>
                    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escAttr(o.descripcion_padre || '')}">${escText(o.descripcion_padre || '')}</td>
                    <td style="text-align:center">${o.espesor ? escText(o.espesor) + 'mm' : ''}</td>
                    <td style="text-align:right">${escText(o.ancho || '')}</td>
                    <td style="text-align:right">${escText(o.alto || '')}</td>
                    <td style="text-align:right;font-weight:600">${Number(o.m2).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}</td>
                    <td style="text-align:right;font-weight:600">${Math.round(o.kgs)}</td>
                    <td style="font-size:11px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escAttr(o.ruta || '')}">${escText(o.ruta || '')}</td>
                    <td>${escText(o.tipo || '')}</td>
                    <td><span style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">${escText(o.grupo || '')}</span></td>
                </tr>`;

                // Card movil (patron MODULE_RESPONSIVE_V1): campos principales de la fila
                const dim = [o.espesor ? escText(o.espesor) + 'mm' : '', (o.ancho || o.alto) ? escText(o.ancho || '') + 'x' + escText(o.alto || '') : ''].filter(Boolean).join(' · ');
                cardsHtml += `<div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-bottom:10px">
                    <div style="display:flex;justify-content:space-between;align-items:start;gap:8px;margin-bottom:6px">
                        <div style="min-width:0">
                            <div style="font-weight:700;font-size:13px;color:#0f172a">${escText(o.ov || '')} <span style="font-weight:500;font-size:11px;color:#64748b">Item ${escText(o.item || '')}${o.pend ? ' · Pend ' + escText(o.pend) : ''}</span> ${this._prioBadge(o.prioridad)}</div>
                            <div style="font-size:11px;color:#475569;margin-top:2px">${escText(o.cliente || '')}</div>
                        </div>
                        <div style="flex-shrink:0"><span class="pr-badge ${estadoClass}">${escText(o.estado || '')}</span></div>
                    </div>
                    <div style="font-size:11px;color:#64748b;margin-bottom:6px">${escText(o.descripcion_padre || '-')}</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;margin-bottom:6px">
                        <div><span style="color:#94a3b8">Dim:</span> <span style="color:#475569">${dim || '-'}</span></div>
                        <div><span style="color:#94a3b8">M²:</span> <strong style="color:#0f172a">${Number(o.m2).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}</strong> <span style="color:#94a3b8">Kgs:</span> <strong style="color:#0f172a">${Math.round(o.kgs)}</strong></div>
                        <div style="grid-column:1/-1"><span style="color:#94a3b8">Ruta:</span> <span style="color:#7c3aed;font-size:10px">${escText(o.ruta || '-')}</span></div>
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:4px">
                        <span style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">${escText(o.tipo || '-')}</span>
                        <span style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">${escText(o.grupo || '-')}</span>
                    </div>
                </div>`;
            }
            html += `</tbody></table></div>
                <div class="m-cards-mobile" style="display:none;padding:12px">${cardsHtml}</div>
                </div>
                <div class="pr-totales">
                    <div>Items: <span>${fecha.totales.items}</span></div>
                    <div>Unid: <span>${Math.round(fecha.totales.unidades || 0).toLocaleString('es-CL')}</span></div>
                    <div>M²: <span>${Number(fecha.totales.m2).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}</span></div>
                    <div>Kgs: <span>${Math.round(fecha.totales.kgs).toLocaleString('es-CL')}</span></div>
                </div>`;
        }
        el.innerHTML = html;
    },

    formatFecha(fechaStr) {
        if (!fechaStr) return '';
        const [y, m, d] = fechaStr.split('-');
        const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        return `${d} de ${meses[parseInt(m) - 1]} de ${y}`;
    },

    aplicarFiltros() {
        this.filtros.familia = document.getElementById('prFilterFamilia')?.value || 'todas';
        this.filtros.grupo = document.getElementById('prFilterGrupo')?.value || 'todos';
        this.filtros.estado = document.getElementById('prFilterEstado')?.value || 'todos';
        this.filtros.fecha_inicio = document.getElementById('prFilterDesde')?.value || '';
        this.filtros.fecha_fin = document.getElementById('prFilterHasta')?.value || '';
        this.cargarDatos();
    },

    limpiarFiltros() {
        this.filtros = { familia: 'todas', fecha_inicio: this._hoyLocal(), fecha_fin: '', grupo: 'todos', estado: 'todos' };
        const fin = new Date(); fin.setDate(fin.getDate() + 14);
        this.filtros.fecha_fin = fin.toISOString().split('T')[0];
        this.render();
    },

    // Termopanel: las líneas de un mismo pedido-item se muestran en UNA sola
    // línea — se suman espesor y kilos (también m²). Los demás grupos van a la
    // vista tal cual, una fila por orden.
    _agrupar(ordenes) {
        const salida = [];
        const idx = {};
        for (const o of (ordenes || [])) {
            const clave = /termopanel/i.test(o.grupo || '') ? (o.ov + '|' + o.item) : null;
            if (!clave) { salida.push(o); continue; }
            if (!idx[clave]) {
                idx[clave] = { ...o, espesor: Number(o.espesor) || 0, kgs: Number(o.kgs) || 0, m2: Number(o.m2) || 0 };
                salida.push(idx[clave]);
            } else {
                const g = idx[clave];
                g.espesor = (Number(g.espesor) || 0) + (Number(o.espesor) || 0);
                g.kgs = (Number(g.kgs) || 0) + (Number(o.kgs) || 0);
                g.m2 = (Number(g.m2) || 0) + (Number(o.m2) || 0);
            }
        }
        return salida;
    },

    exportarExcel() {
        if (!this.datos || !this.datos.fechas.length) return App.showAlert('No hay datos para exportar', 'warning');
        let csv = 'FECHA;OV;Item;Pend;Estado;Prioridad;Cliente;SAP Padre;Descripción Padre;Ancho;Alto;Unidades;M2;Kgs;Ruta;Tipo;Grupo\n';
        for (const f of this.datos.fechas) {
            for (const o of this._agrupar(f.ordenes)) {
                csv += [
                    f.fecha, o.ov, o.item, o.pend, o.estado, o.prioridad,
                    `"${(o.cliente || '').replace(/"/g, '""')}"`,
                    `"${(o.codigo_sap_padre || '').replace(/"/g, '""')}"`,
                    `"${(o.descripcion_padre || '').replace(/"/g, '""')}"`,
                    o.ancho, o.alto, o.unidades || o.pend,
                    Number(o.m2).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1}), Math.round(o.kgs),
                    `"${(o.ruta || '').replace(/"/g, '""')}"`,
                    o.tipo, o.grupo
                ].join(';') + '\n';
            }
        }
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'reporte_fechas.csv'; a.click();
        URL.revokeObjectURL(url);
        App.showAlert('Reporte exportado', 'success');
    }
});
