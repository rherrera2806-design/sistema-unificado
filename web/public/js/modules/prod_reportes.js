App.registerModule('prod_reportes', {
    datos: null,
    filtros: { familia: 'todas', fecha_inicio: '', fecha_fin: '', grupo: 'todos', estado: 'todos' },

    async render() {
        const el = document.getElementById('page-prod_reportes');
        const hoy = new Date().toISOString().split('T')[0];
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
                .pr-table{width:100%;font-size:12px;border-collapse:collapse}
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
                .pr-proceso{font-family:monospace;font-size:11px;color:#475569;letter-spacing:.3px}
                .pr-totales{display:flex;gap:16px;padding:8px 16px;background:#f8fafc;border-radius:0 0 10px 10px;font-size:12px;font-weight:600;color:#475569}
                .pr-totales span{color:#0f172a}
            </style>

            <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:8px 16px;margin-bottom:20px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,.3)">
                <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,.2) 0%,transparent 70%);border-radius:50%"></div>
                <div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <h2 style="margin:0;font-size:15px;font-weight:800;color:white;letter-spacing:-.5px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-3px;margin-right:6px"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>Informe de Fechas</h2>
                        <p style="margin:2px 0 0;font-size:11px;color:rgba(255,255,255,.7)">Reporte de ordenes programadas agrupadas por fecha</p>
                    </div>
                    <div style="display:flex;gap:8px">
                        <button onclick="App.modules.prod_reportes.exportarExcel()" class="btn btn-outline" style="color:white;border-color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.1)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Exportar</button>
                    </div>
                </div>
            </div>

            <div style="background:white;border-radius:14px;padding:20px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,.04);margin-bottom:20px;animation:prFadeUp .5s ease both">
                <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:end">
                    <div style="flex:1;min-width:140px">
                        <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Familia</label>
                        <select id="prFilterFamilia" onchange="App.modules.prod_reportes.aplicarFiltros()" style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;background:white">
                            <option value="todas">Todas las familias</option>
                        </select>
                    </div>
                    <div style="flex:1;min-width:140px">
                        <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Grupo</label>
                        <select id="prFilterGrupo" onchange="App.modules.prod_reportes.aplicarFiltros()" style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;background:white">
                            <option value="todos">Todos los grupos</option>
                        </select>
                    </div>
                    <div style="flex:1;min-width:140px">
                        <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Estado</label>
                        <select id="prFilterEstado" onchange="App.modules.prod_reportes.aplicarFiltros()" style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none;background:white">
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
                        <input type="date" id="prFilterDesde" onchange="App.modules.prod_reportes.aplicarFiltros()" style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none">
                    </div>
                    <div style="flex:1;min-width:140px">
                        <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Hasta</label>
                        <input type="date" id="prFilterHasta" onchange="App.modules.prod_reportes.aplicarFiltros()" style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;outline:none">
                    </div>
                    <div>
                        <button class="btn btn-outline btn-sm" title="Limpiar filtros" onclick="App.modules.prod_reportes.limpiarFiltros()">Limpiar</button>
                    </div>
                </div>
            </div>

            <div id="prResumen" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px"></div>
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
                    <div style="font-size:12px;margin-top:4px;opacity:.8">${e.message}</div>
                </div>`;
        }
    },

    poblarFiltros() {
        if (!this.datos) return;
        const selFam = document.getElementById('prFilterFamilia');
        const selGrp = document.getElementById('prFilterGrupo');
        if (selFam && this.datos.familias) {
            const val = selFam.value;
            selFam.innerHTML = '<option value="todas">Todas las familias</option>' +
                this.datos.familias.map(f => `<option value="${f}" ${f === val ? 'selected' : ''}>${f}</option>`).join('');
        }
        if (selGrp && this.datos.grupos) {
            const val = selGrp.value;
            selGrp.innerHTML = '<option value="todos">Todos los grupos</option>' +
                this.datos.grupos.map(g => `<option value="${g}" ${g === val ? 'selected' : ''}>${g}</option>`).join('');
        }
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
            <div class="pr-card" style="background:white;border-radius:10px;padding:10px 12px;border:1px solid #e2e8f0;border-left:4px solid #3b82f6;height:55px;display:flex;align-items:center;gap:10px">
                <div style="width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,#eff6ff,#bfdbfe);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
                <div><div style="font-size:20px;font-weight:800;color:#0f172a;line-height:1">${fechas.length}</div><div style="color:#64748b;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">Fechas</div></div>
            </div>
            <div class="pr-card" style="background:white;border-radius:10px;padding:10px 12px;border:1px solid #e2e8f0;border-left:4px solid #8b5cf6;height:55px;display:flex;align-items:center;gap:10px">
                <div style="width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,#f5f3ff,#ddd6fe);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div>
                <div><div style="font-size:20px;font-weight:800;color:#8b5cf6;line-height:1">${totalItems}</div><div style="color:#64748b;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">Items</div></div>
            </div>
            <div class="pr-card" style="background:white;border-radius:10px;padding:10px 12px;border:1px solid #e2e8f0;border-left:4px solid #10b981;height:55px;display:flex;align-items:center;gap:10px">
                <div style="width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,#ecfdf5,#a7f3d0);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div>
                <div><div style="font-size:20px;font-weight:800;color:#10b981;line-height:1">${Math.round(totalUnd).toLocaleString('es-CL')}</div><div style="color:#64748b;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">Unidades</div></div>
            </div>
            <div class="pr-card" style="background:white;border-radius:10px;padding:10px 12px;border:1px solid #e2e8f0;border-left:4px solid #6366f1;height:55px;display:flex;align-items:center;gap:10px">
                <div style="width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,#eef2ff,#c7d2fe);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg></div>
                <div><div style="font-size:20px;font-weight:800;color:#6366f1;line-height:1">${totalM2.toFixed(1)}</div><div style="color:#64748b;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">M² Total</div></div>
            </div>
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
                    <div style="color:#94a3b8;font-size:14px;font-weight:600">Sin datos para los filtros seleccionados</div>
                    <div style="color:#cbd5e1;font-size:12px;margin-top:4px">Intenta cambiar las fechas o los filtros</div>
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
                <div style="overflow-x:auto;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;margin-bottom:4px">
                    <table class="pr-table">
                        <thead><tr>
                            <th>OV</th><th>Item</th><th>Pend.</th><th>Estado</th><th>Cliente</th>
                            <th>Detalle SAP</th><th>Ancho</th><th>Alto</th>
                            <th style="text-align:right">Unid</th>
                            <th style="text-align:right">M²</th>
                            <th style="text-align:right">Kgs</th><th>Ruta</th><th>Tipo</th><th>Grupo</th>
                        </tr></thead>
                        <tbody>`;

            for (const o of fecha.ordenes) {
                const estadoClass = 'pr-estado-' + (o.estado || 'PENDIENTE');
                html += `<tr>
                    <td style="font-weight:600">${o.ov || ''}</td>
                    <td>${o.item || ''}</td>
                    <td style="text-align:center">${o.pend || ''}</td>
                    <td><span class="pr-badge ${estadoClass}">${o.estado || ''}</span></td>
                    <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${o.cliente || ''}">${o.cliente || ''}</td>
                    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${o.detalle_sap || ''}">${o.detalle_sap || ''}</td>
                    <td style="text-align:right">${o.ancho || ''}</td>
                    <td style="text-align:right">${o.alto || ''}</td>
                    <td style="text-align:right;font-weight:600">${o.unidades || o.pend || ''}</td>
                    <td style="text-align:right;font-weight:600">${o.m2.toFixed(1)}</td>
                    <td style="text-align:right;font-weight:600">${Math.round(o.kgs)}</td>
                    <td style="font-size:11px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${o.ruta || ''}">${o.ruta || ''}</td>
                    <td>${o.tipo || ''}</td>
                    <td><span style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">${o.grupo || ''}</span></td>
                </tr>`;
            }
            html += `</tbody></table></div>
                <div class="pr-totales">
                    <div>Items: <span>${fecha.totales.items}</span></div>
                    <div>Unid: <span>${Math.round(fecha.totales.unidades || 0).toLocaleString('es-CL')}</span></div>
                    <div>M²: <span>${fecha.totales.m2.toFixed(1)}</span></div>
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
        this.filtros = { familia: 'todas', fecha_inicio: new Date().toISOString().split('T')[0], fecha_fin: '', grupo: 'todos', estado: 'todos' };
        const fin = new Date(); fin.setDate(fin.getDate() + 14);
        this.filtros.fecha_fin = fin.toISOString().split('T')[0];
        this.render();
    },

    exportarExcel() {
        if (!this.datos || !this.datos.fechas.length) return App.showAlert('No hay datos para exportar', 'warning');
        let csv = 'FECHA;OV;Item;Pend;Estado;Cliente;Detalle SAP;Ancho;Alto;Unidades;M2;Kgs;Ruta;Tipo;Grupo\n';
        for (const f of this.datos.fechas) {
            for (const o of f.ordenes) {
                csv += [
                    f.fecha, o.ov, o.item, o.pend, o.estado,
                    `"${(o.cliente || '').replace(/"/g, '""')}"`,
                    `"${(o.detalle_sap || '').replace(/"/g, '""')}"`,
                    o.ancho, o.alto, o.unidades || o.pend,
                    o.m2.toFixed(1), Math.round(o.kgs),
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
