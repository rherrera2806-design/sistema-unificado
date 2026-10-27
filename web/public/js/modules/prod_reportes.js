App.registerModule('prod_reportes', {
    datos: null,
    filtros: { familia: 'todas', fecha_inicio: '', fecha_fin: '', grupo: 'todos', estado: 'todos', pedido: '', cliente: '', espesor: '' },

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
                .pr-table{width:100%;font-size:10.5px;border-collapse:collapse}
                .pr-table th{padding:6px 7px;text-align:left;font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid #e2e8f0;background:#f8fafc;position:sticky;top:0;z-index:1;white-space:nowrap}
                .pr-table td{padding:4px 7px;border-bottom:1px solid #f1f5f9;color:#334155}
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
                .pr-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:14px}
                .pr-kpi{background:#fff;border:1px solid #e4e9f0;border-radius:12px;padding:13px 16px}
                /* KPIs NEUTROS: el color solo cuando significa algo (regla del sistema) */
                .pr-kpi .k{font-size:10px;font-weight:600;letter-spacing:.7px;text-transform:uppercase;color:#64748b}
                .pr-kpi .v{font-size:24px;font-weight:700;margin-top:2px;color:#0f172a;font-variant-numeric:tabular-nums;letter-spacing:-.3px;line-height:1.15}
                .pr-kpi .s{font-size:10px;color:#64748b;margin-top:3px}
                /* Filtros agrupados por tipo: Filtros (selects/fechas) vs Búsqueda (lupa) */
                .pr-fgrp{font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#64748b;margin-bottom:6px}
                .pr-busq{position:relative;flex:1;min-width:180px}
                .pr-busq input{width:100%;padding:10px 30px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;background:#fff}
                .pr-busq .ico{position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:12px;color:#64748b;pointer-events:none}
                .pr-busq .clr{position:absolute;right:6px;top:50%;transform:translateY(-50%);border:none;background:#f1f5f9;color:#475569;border-radius:6px;width:20px;height:20px;font-size:11px;cursor:pointer;line-height:1}
                .pr-busq .clr:hover{background:#e2e8f0}
                /* Foco visible (accesibilidad): nunca outline:none sin reemplazo */
                .m-filters select:focus,.m-filters input:focus,.pr-busq input:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.16);outline:none}
                .pr-totales{display:flex;gap:16px;padding:8px 16px;background:#f8fafc;border-radius:0 0 10px 10px;font-size:11px;font-weight:600;color:#475569;flex-wrap:wrap}
                .pr-totales span{color:#0f172a}
                /* Botones de cabecera del hero (patron MODULE_RESPONSIVE_V1) */
                .m-hero-btns{display:flex;gap:8px;flex-wrap:wrap}
                @media(max-width:768px){.m-hero-btns .btn{height:40px;min-height:40px;flex:1}}
            </style>

            <div class="pr-hero">
                <div>
                    <h2>Prog. General</h2>
                    <p>Reporte de órdenes agrupadas por fecha de entrega</p>
                </div>
                <div class="pr-hero-actions">
                    <button class="pr-hbtn" onclick="App.modules.prod_reportes.imprimir()" title="Imprimir el informe con los filtros activos">🖨 Imprimir</button>
                    <button class="pr-hbtn" onclick="App.modules.prod_reportes.exportarExcel()">⬇ Exportar Excel</button>
                </div>
            </div>

            <div style="background:white;border-radius:14px;padding:20px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,.04);margin-bottom:20px;animation:prFadeUp .5s ease both">
                <div class="pr-fgrp">Filtros</div>
                <div class="m-filters">
                    <div style="flex:1;min-width:140px">
                        <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px">Familia</label>
                        <select id="prFilterFamilia" onchange="App.modules.prod_reportes.aplicarFiltros()" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;background:white">
                            <option value="todas">Todas las familias</option>
                        </select>
                    </div>
                    <div style="flex:1;min-width:140px">
                        <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px">Grupo</label>
                        <select id="prFilterGrupo" onchange="App.modules.prod_reportes.aplicarFiltros()" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;background:white">
                            <option value="todos">Todos los grupos</option>
                        </select>
                    </div>
                    <div style="flex:1;min-width:140px">
                        <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px">Estado</label>
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
                        <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px">Desde</label>
                        <input type="date" id="prFilterDesde" onchange="App.modules.prod_reportes.aplicarFiltros()" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none">
                    </div>
                    <div style="flex:1;min-width:140px">
                        <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px">Hasta</label>
                        <input type="date" id="prFilterHasta" onchange="App.modules.prod_reportes.aplicarFiltros()" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none">
                    </div>
                    <div style="flex:1;min-width:120px">
                        <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px">Espesor</label>
                        <select id="prFilterEspesor" onchange="App.modules.prod_reportes._onBusqueda('espesor', this.value)" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;background:white">
                            <option value="">Todos los espesores</option>
                        </select>
                    </div>
                </div>
                <div class="pr-fgrp" style="margin-top:14px">Búsqueda</div>
                <div class="m-filters">
                    <div class="pr-busq">
                        <span class="ico">🔍</span>
                        <input id="prFilterPedido" placeholder="N° de pedido (OV)… filtra al escribir" value="${escText(this.filtros.pedido || '')}"
                            oninput="App.modules.prod_reportes._onBusqueda('pedido', this.value)"
                            onkeydown="if(event.key==='Escape')App.modules.prod_reportes._limpiarCampo('prFilterPedido','pedido')">
                        <button class="clr" title="Limpiar búsqueda de pedido" onclick="App.modules.prod_reportes._limpiarCampo('prFilterPedido','pedido')">×</button>
                    </div>
                    <div class="pr-busq">
                        <span class="ico">🔍</span>
                        <input id="prFilterCliente" placeholder="Nombre del cliente… filtra al escribir" value="${escText(this.filtros.cliente || '')}"
                            oninput="App.modules.prod_reportes._onBusqueda('cliente', this.value)"
                            onkeydown="if(event.key==='Escape')App.modules.prod_reportes._limpiarCampo('prFilterCliente','cliente')">
                        <button class="clr" title="Limpiar búsqueda de cliente" onclick="App.modules.prod_reportes._limpiarCampo('prFilterCliente','cliente')">×</button>
                    </div>
                    <div>
                        <button class="btn btn-outline btn-sm" title="Limpiar todos los filtros" onclick="App.modules.prod_reportes.limpiarFiltros()">Limpiar todo</button>
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
        // Espesores disponibles (de los datos cargados): filtro local instantáneo
        const selEsp = document.getElementById('prFilterEspesor');
        if (selEsp) {
            const val = this.filtros.espesor || '';
            const espesores = [...new Set((this.datos.fechas || []).flatMap(f => (f.ordenes || []).map(o => Number(o.espesor) || 0)).filter(e => e > 0))].sort((a, b) => a - b);
            selEsp.innerHTML = '<option value="">Todos los espesores</option>' +
                espesores.map(e => `<option value="${e}" ${String(e) === String(val) ? 'selected' : ''}>${Number(e).toLocaleString('es-CL',{maximumFractionDigits:2})} mm</option>`).join('');
        }
    },

    // Badge de prioridad (numerada, idioma de etiquetas)
    _prioBadge(n) {
        const map = { 1: ['Normal', '#eff6ff', '#1d4ed8'], 2: ['Express', '#fef9c3', '#854d0e'], 3: ['Urgencia', '#dcfce7', '#15803d'], 4: ['Reposición', '#fee2e2', '#b91c1c'] };
        const m = map[Number(n) || 1] || map[1];
        return '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:' + m[1] + ';color:' + m[2] + ';white-space:nowrap">● ' + m[0] + '</span>';
    },

    // Avance por proceso (letra de estación): unidades fabricadas en cada
    // estación de la ruta, EN EL ORDEN DE LA RUTA (la R va después de la P).
    // Verde = terminado · Ámbar = en curso · Gris = pendiente
    _avanceBadges(avance) {
        if (!avance || !avance.length) return '<span style="color:#cbd5e1">—</span>';
        return avance.map(a => {
            const bg = a.estado === 'ok' ? '#f0fdf4' : a.estado === 'curso' ? '#fffbeb' : '#f1f5f9';
            const fg = a.estado === 'ok' ? '#15803d' : a.estado === 'curso' ? '#b45309' : '#64748b';
            const val = a.cant > 0 ? Number(a.cant).toLocaleString('es-CL') : '—';
            const estTxt = a.estado === 'ok' ? 'terminado' : a.estado === 'curso' ? 'en curso' : 'pendiente';
            return `<span title="${escAttr((a.estacion || '') + ' · ' + estTxt)}" style="display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:5px;font-size:10px;font-weight:700;background:${bg};color:${fg};white-space:nowrap">${escText(a.letra)} ${val}</span>`;
        }).join(' ');
    },

    renderResumen() {
        const el = document.getElementById('prResumen');
        if (!el || !this.datos) return;
        const fechas = this._datosFiltrados().fechas || [];
        let totalItems = 0, totalM2 = 0, totalKgs = 0, totalUnd = 0;
        for (const f of fechas) {
            totalItems += f.totales.items;
            totalM2 += f.totales.m2;
            totalKgs += f.totales.kgs;
            totalUnd += f.totales.unidades || 0;
        }
        el.innerHTML = `
                <div class="pr-kpi"><div class="k">Fechas</div><div class="v">${fechas.length}</div><div class="s">con órdenes para entregar</div></div>
                <div class="pr-kpi"><div class="k">Items</div><div class="v">${Number(totalItems).toLocaleString('es-CL')}</div><div class="s">líneas de producción</div></div>
                <div class="pr-kpi"><div class="k">Unidades</div><div class="v">${Math.round(totalUnd).toLocaleString('es-CL')}</div><div class="s">a fabricar</div></div>
                <div class="pr-kpi"><div class="k">M² total</div><div class="v">${Number(totalM2).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}</div><div class="s">superficie del período</div></div>
                <div class="pr-kpi"><div class="k">Kgs total</div><div class="v">${Number(totalKgs).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}</div><div class="s">peso del período</div></div>
        `;
    },

    renderTabla() {
        const el = document.getElementById('prReporte');
        if (!el || !this.datos) return;
        const fechas = this._datosFiltrados().fechas || [];
        if (fechas.length === 0) {
            el.innerHTML = `
                <div style="background:white;border-radius:14px;padding:40px;text-align:center;border:1px solid #e2e8f0">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" style="margin-bottom:12px"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                    <div style="color:#64748b;font-size:15px;font-weight:600">Sin datos para los filtros seleccionados</div>
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
                            <th>OV</th><th>Item</th><th>Pend.</th><th>Ruta</th><th>Avance por proceso</th><th>Prioridad</th><th>SAP Padre</th>
                            <th>Descripción Padre</th><th>Espesor</th><th>Ancho</th><th>Alto</th>
                            <th style="text-align:right">M²</th>
                            <th style="text-align:right">Kgs</th><th>Cliente</th><th>Tipo</th><th>Estado</th><th>Grupo</th>
                        </tr></thead>
                        <tbody>`;

            let cardsHtml = '';
            for (const o of this._agrupar(fecha.ordenes)) {
                const estadoClass = 'pr-estado-' + (o.estado || 'PENDIENTE');
                html += `<tr>
                    <td style="font-weight:600">${escText(o.ov || '')}</td>
                    <td>${escText(o.item || '')}</td>
                    <td style="text-align:center">${o.pend ? Number(o.pend).toLocaleString('es-CL') : ''}</td>
                    <td style="font-size:10px;white-space:nowrap" title="${escAttr(o.ruta || '')}"><strong style="color:#7c3aed">${escText(o.proceso || o.ruta || '')}</strong></td>
                    <td style="white-space:nowrap">${this._avanceBadges(o.avance)}</td>
                    <td>${this._prioBadge(o.prioridad)}</td>
                    <td style="font-weight:600;white-space:nowrap">${escText(o.codigo_sap_padre || '')}</td>
                    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escAttr(o.descripcion_padre || '')}">${escText(o.descripcion_padre || '')}</td>
                    <td style="text-align:center">${o.espesor ? Number(o.espesor).toLocaleString('es-CL',{maximumFractionDigits:2}) + ' mm' : ''}</td>
                    <td style="text-align:right">${o.ancho ? Number(o.ancho).toLocaleString('es-CL') : ''}</td>
                    <td style="text-align:right">${o.alto ? Number(o.alto).toLocaleString('es-CL') : ''}</td>
                    <td style="text-align:right;font-weight:600">${Number(o.m2).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}</td>
                    <td style="text-align:right;font-weight:600">${Number(o.kgs).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}</td>
                    <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escAttr(o.cliente || '')}">${escText(o.cliente || '')}</td>
                    <td>${escText(o.tipo || '')}</td>
                    <td><span class="pr-badge ${estadoClass}">${escText(o.estado || '')}</span></td>
                    <td><span style="background:#f0fdf4;color:#166534;padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700;white-space:nowrap">${escText(o.grupo || '—')}</span></td>
                </tr>`;

                // Card movil (patron MODULE_RESPONSIVE_V1): campos principales de la fila
                const dim = [o.espesor ? Number(o.espesor).toLocaleString('es-CL',{maximumFractionDigits:2}) + ' mm' : '', (o.ancho || o.alto) ? Number(o.ancho || 0).toLocaleString('es-CL') + 'x' + Number(o.alto || 0).toLocaleString('es-CL') : ''].filter(Boolean).join(' · ');
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
                        <div><span style="color:#64748b">Dim:</span> <span style="color:#475569">${dim || '-'}</span></div>
                        <div><span style="color:#64748b">M²:</span> <strong style="color:#0f172a">${Number(o.m2).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}</strong> <span style="color:#64748b">Kgs:</span> <strong style="color:#0f172a">${Number(o.kgs).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}</strong></div>
                        <div style="grid-column:1/-1"><span style="color:#64748b">Ruta:</span> <span style="color:#7c3aed;font-size:10px" title="${escAttr(o.ruta || '')}">${escText(o.proceso || o.ruta || '-')}</span></div>
                        <div style="grid-column:1/-1"><span style="color:#64748b">Avance:</span> <span style="display:inline-flex;flex-wrap:wrap;gap:4px;margin-left:4px">${this._avanceBadges(o.avance)}</span></div>
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:4px">
                        <span style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">${escText(o.tipo || '-')}</span>
                        <span style="background:#f0fdf4;color:#166534;padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700">${escText(o.grupo || '—')}</span>
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
                    <div>Kgs: <span>${Number(fecha.totales.kgs).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}</span></div>
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
        this.filtros = { familia: 'todas', fecha_inicio: this._hoyLocal(), fecha_fin: '', grupo: 'todos', estado: 'todos', pedido: '', cliente: '', espesor: '' };
        const fin = new Date(); fin.setDate(fin.getDate() + 14);
        this.filtros.fecha_fin = fin.toISOString().split('T')[0];
        this.render();
    },

    // Laminado/Termopanel (detectado por producto, no por grupo — un laminado
    // puede estar en "Arquitectura"): cada MP pesa por su CANTIDAD DE RECETA
    // (ej: Extra Claro 8mm x4 = 32mm) y las líneas de un mismo pedido-item se
    // muestran en UNA sola fila sumando espesor y kilos.
    _agrupar(ordenes) {
        // Las filas ya vienen MACRO por codigo padre desde el servicio (reglas
        // 1+5): espesor = suma de espesores del BOM, kilos = suma de las partes,
        // m2/unidades = los del padre. NO multiplicar por cant_receta ni
        // re-agrupar (eso inflaba los kilos de los compuestos).
        return (ordenes || []).map(o => ({
            ...o,
            espesor: Number(o.espesor) || 0,
            kgs: Number(o.kgs) || 0
        }));
    },

    // ── Impresión del informe ─────────────────────────────────────────────
    // Imprime EXACTAMENTE lo que se ve: respeta los filtros activos (los datos
    // ya vienen filtrados del servidor) y el encabezado indica cuáles estaban
    // aplicados. Mismo orden de columnas y formatos que la pantalla.
    imprimir() {
        const dImp = this._datosFiltrados();
        if (!dImp || !dImp.fechas || !dImp.fechas.length) {
            App.showAlert('No hay datos para imprimir con los filtros actuales', 'danger');
            return;
        }
        let frame = document.getElementById('prPrintFrame');
        if (!frame) {
            frame = document.createElement('iframe');
            frame.id = 'prPrintFrame';
            frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
            document.body.appendChild(frame);
        }
        frame.onload = () => {
            try { frame.contentWindow.focus(); frame.contentWindow.print(); }
            catch (e) { App.showAlert('No se pudo abrir la impresión: ' + e.message, 'danger'); }
        };
        frame.srcdoc = this._htmlImpresion();
    },

    _htmlImpresion() {
        const d = this._datosFiltrados();
        const hoy = new Date();
        const p2 = (x) => String(x).padStart(2, '0');
        const impreso = `${p2(hoy.getDate())}-${p2(hoy.getMonth() + 1)}-${hoy.getFullYear()} ${p2(hoy.getHours())}:${p2(hoy.getMinutes())}`;
        const f = this.filtros || {};
        const filtrosTxt = [
            'Período: ' + (this.formatFecha(f.fecha_inicio) || '—') + ' al ' + (this.formatFecha(f.fecha_fin) || '—'),
            f.familia && f.familia !== 'todas' ? 'Familia: ' + f.familia : null,
            f.grupo && f.grupo !== 'todos' ? 'Grupo: ' + f.grupo : null,
            f.estado && f.estado !== 'todos' ? 'Estado: ' + f.estado : null,
            f.pedido ? 'Pedido: ' + f.pedido : null,
            f.cliente ? 'Cliente: ' + f.cliente : null,
            f.espesor ? 'Espesor: ' + f.espesor + ' mm' : null
        ].filter(Boolean).join(' · ');
        const num = (v, dec) => Number(v || 0).toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec });

        const fechas = d.fechas || [];
        let tItems = 0, tUnd = 0, tM2 = 0, tKg = 0;
        for (const fc of fechas) {
            tItems += fc.totales.items;
            tUnd += fc.totales.unidades || 0;
            tM2 += fc.totales.m2;
            tKg += fc.totales.kgs;
        }

        let cuerpo = '';
        for (const fc of fechas) {
            cuerpo += `<h3 class="dia">${this.formatFecha(fc.fecha)}<span>${num(fc.totales.items, 0)} items · ${num(fc.totales.unidades || 0, 0)} und · ${num(fc.totales.m2, 1)} m² · ${num(fc.totales.kgs, 1)} kg</span></h3>`;
            cuerpo += '<table><thead><tr>'
                + '<th>OV</th><th>Item</th><th>Pend</th><th>Ruta</th><th>Avance por proceso</th><th>Prioridad</th><th>SAP Padre</th><th>Descripción Padre</th><th>Espesor</th><th>Ancho</th><th>Alto</th><th>M²</th><th>Kgs</th><th>Cliente</th><th>Tipo</th><th>Estado</th><th>Grupo</th>'
                + '</tr></thead><tbody>';
            for (const o of this._agrupar(fc.ordenes)) {
                const avance = (o.avance || []).map(a => a.letra + ' ' + (a.cant > 0 ? num(a.cant, 0) : '—')).join(' · ');
                cuerpo += `<tr>
                    <td class="c"><strong>${escText(o.ov || '')}</strong></td>
                    <td class="c">${escText(o.item || '')}</td>
                    <td class="n">${o.pend ? num(o.pend, 0) : ''}</td>
                    <td class="c">${escText(o.proceso || o.ruta || '')}</td>
                    <td>${escText(avance)}</td>
                    <td class="c">${escText(({ 1: 'Normal', 2: 'Express', 3: 'Urgencia', 4: 'Reposición' })[o.prioridad] || '—')}</td>
                    <td class="c">${escText(o.codigo_sap_padre || '')}</td>
                    <td>${escText(o.descripcion_padre || '')}</td>
                    <td class="n">${o.espesor ? num(o.espesor, 2) + ' mm' : ''}</td>
                    <td class="n">${o.ancho ? num(o.ancho, 0) : ''}</td>
                    <td class="n">${o.alto ? num(o.alto, 0) : ''}</td>
                    <td class="n">${num(o.m2, 1)}</td>
                    <td class="n">${num(o.kgs, 1)}</td>
                    <td>${escText(o.cliente || '')}</td>
                    <td>${escText(o.tipo || '')}</td>
                    <td class="c">${escText(o.estado || '')}</td>
                    <td>${escText(o.grupo || '')}</td>
                </tr>`;
            }
            cuerpo += '</tbody></table>';
        }

        return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Prog. General</title><style>'
            + '@page{size:A4 landscape;margin:9mm}'
            + '*{box-sizing:border-box}'
            + 'body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:9px;margin:0}'
            + 'header{border-bottom:2px solid #111;padding-bottom:6px;margin-bottom:8px}'
            + '.t1{font-size:8px;letter-spacing:2px;color:#555}'
            + '.t2{font-size:16px;font-weight:800;margin:2px 0 3px}'
            + '.meta{font-size:9px;color:#333}'
            + '.kpis{display:flex;gap:16px;margin:6px 0 10px;font-size:9px}'
            + '.kpi b{font-size:12px}'
            + 'h3.dia{font-size:10px;margin:10px 0 4px;padding:3px 6px;background:#eee;border-left:3px solid #111;display:flex;justify-content:space-between}'
            + 'h3.dia span{font-weight:400;color:#444;font-size:8.5px;align-self:center}'
            + 'table{width:100%;border-collapse:collapse}'
            + 'th{background:#e8e8e8;border:1px solid #999;padding:2px 4px;font-size:7px;text-transform:uppercase;text-align:left}'
            + 'td{border:1px solid #bbb;padding:2px 4px;font-size:8px}'
            + 'td.n{text-align:right;font-variant-numeric:tabular-nums}'
            + 'td.c{text-align:center}'
            + 'tbody tr:nth-child(even){background:#fafafa}'
            + 'footer{margin-top:10px;padding-top:5px;border-top:1px solid #999;font-size:8px;color:#555;display:flex;justify-content:space-between}'
            + '</style></head><body>'
            + `<header>
                <div class="t1">VITROFLOW · PRODUCCIÓN</div>
                <div class="t2">Prog. General</div>
                <div class="meta">${escText(filtrosTxt)}</div>
               </header>`
            + `<div class="kpis">
                <div class="kpi">Fechas: <b>${num(fechas.length, 0)}</b></div>
                <div class="kpi">Items: <b>${num(tItems, 0)}</b></div>
                <div class="kpi">Unidades: <b>${num(tUnd, 0)}</b></div>
                <div class="kpi">M²: <b>${num(tM2, 1)}</b></div>
                <div class="kpi">Kgs: <b>${num(tKg, 1)}</b></div>
               </div>`
            + cuerpo
            + `<footer><span>VitroFlow · Prog. General</span><span>Impreso ${impreso}</span></footer>`
            + '</body></html>';
    },

    // ---------------- Filtros locales (pedido / cliente / espesor) ----------------
    // Se aplican AL ESCRIBIR sobre los datos ya cargados (instantáneo, sin ir
    // al servidor) y valen para pantalla, impresión y CSV
    _onBusqueda(campo, valor) {
        clearTimeout(this._busqTimer);
        this.filtros[campo] = valor;
        this._busqTimer = setTimeout(() => this._aplicarLocal(), campo === 'espesor' ? 0 : 350);
    },
    _limpiarCampo(inputId, campo) {
        const inp = document.getElementById(inputId);
        if (inp) { inp.value = ''; inp.focus(); }
        this._onBusqueda(campo, '');
    },
    _aplicarLocal() {
        this.renderResumen();
        this.renderTabla();
    },
    // Vista de los datos con los filtros locales aplicados y los totales
    // recalculados por fecha (KPIs, tabla, impresión y CSV usan esta vista)
    _datosFiltrados() {
        const f = this.filtros || {};
        const qPed = String(f.pedido || '').trim().toLowerCase();
        const qCli = String(f.cliente || '').trim().toLowerCase();
        const qEsp = Number(f.espesor) || 0;
        if (!qPed && !qCli && !qEsp) return this.datos;
        const fechas = [];
        for (const fc of ((this.datos && this.datos.fechas) || [])) {
            const ordenes = (fc.ordenes || []).filter(o => {
                if (qPed && !String(o.ov || '').toLowerCase().includes(qPed)) return false;
                if (qCli && !String(o.cliente || '').toLowerCase().includes(qCli)) return false;
                if (qEsp && (Number(o.espesor) || 0) !== qEsp) return false;
                return true;
            });
            if (!ordenes.length) continue;
            const totales = ordenes.reduce((t, o) => ({
                items: t.items + 1,
                unidades: t.unidades + (Number(o.pend) || 0),
                m2: t.m2 + (Number(o.m2) || 0),
                kgs: t.kgs + (Number(o.kgs) || 0)
            }), { items: 0, unidades: 0, m2: 0, kgs: 0 });
            fechas.push({ ...fc, ordenes, totales });
        }
        return { ...(this.datos || {}), fechas };
    },

    exportarExcel() {
        const d = this._datosFiltrados();
        if (!d || !d.fechas.length) return App.showAlert('No hay datos para exportar', 'warning');
        let csv = 'FECHA;OV;Item;Pend;Ruta;Avance;Prioridad;SAP Padre;Descripción Padre;Ancho;Alto;Unidades;M2;Kgs;Cliente;Tipo;Estado;Grupo\n';
        for (const f of d.fechas) {
            for (const o of this._agrupar(f.ordenes)) {
                csv += [
                    f.fecha, o.ov, o.item, o.pend,
                    `"${(o.proceso || o.ruta || '').replace(/"/g, '""')}"`,
                    `"${(o.avance || []).map(a => a.letra + ':' + (a.cant || 0)).join('|')}"`,
                    o.prioridad,
                    `"${(o.codigo_sap_padre || '').replace(/"/g, '""')}"`,
                    `"${(o.descripcion_padre || '').replace(/"/g, '""')}"`,
                    o.ancho, o.alto, o.unidades || o.pend,
                    Number(o.m2).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1}), Number(o.kgs).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1}),
                    `"${(o.cliente || '').replace(/"/g, '""')}"`,
                    o.tipo, o.estado, o.grupo
                ].join(';') + '\n';
            }
        }
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'prog_general.csv'; a.click();
        URL.revokeObjectURL(url);
        App.showAlert('Reporte exportado', 'success');
    }
});
