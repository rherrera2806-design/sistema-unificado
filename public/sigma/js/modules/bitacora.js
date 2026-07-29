App.registerModule('bitacora', {
    _data: [],

    async render() {
        const el = document.getElementById('page-bitacora');
        el.innerHTML = `
        <style>
            @keyframes bitFadeUp {
                from { opacity: 0; transform: translateY(18px); }
                to   { opacity: 1; transform: translateY(0); }
            }
            .bit-hero { animation: bitFadeUp .5s ease-out both; }
            .bit-filter { animation: bitFadeUp .5s ease-out .1s both; }
            .bit-content { animation: bitFadeUp .5s ease-out .2s both; }
            .bit-card {
                transition: transform .2s ease, box-shadow .2s ease;
            }
            .bit-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(0,0,0,.1);
            }
            .bit-table-wrap {
                animation: bitFadeUp .5s ease-out .3s both;
            }
            .bit-table-wrap table { width: 100%; border-collapse: collapse; }
            .bit-table-wrap th {
                background: linear-gradient(135deg,#1e40af,#3b82f6);
                color: #fff;
                font-weight: 600;
                padding: 12px 16px;
                text-align: left;
                font-size: .85rem;
                letter-spacing: .03em;
            }
            .bit-table-wrap td {
                padding: 11px 16px;
                border-bottom: 1px solid #e5e7eb;
                font-size: .9rem;
                color: #334155;
            }
            .bit-table-wrap tbody tr {
                transition: background .15s ease, transform .15s ease;
            }
            .bit-table-wrap tbody tr:hover {
                background: #f0f6ff;
                transform: translateX(2px);
            }
            .bit-action-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 32px; height: 32px;
                border: none;
                border-radius: 8px;
                background: transparent;
                cursor: pointer;
                transition: background .15s, transform .15s;
            }
            .bit-action-btn:hover {
                background: #dbeafe;
                transform: scale(1.12);
            }
            .bit-action-btn svg { stroke: #1e40af; }
        </style>

        <!-- HERO HEADER -->
        <div class="bit-hero" style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:32px 36px;margin-bottom:24px;position:relative;overflow:hidden;">
            <div style="position:absolute;top:-40px;right:-30px;width:160px;height:160px;background:radial-gradient(circle,rgba(96,165,250,.25) 0%,transparent 70%);border-radius:50%;pointer-events:none;"></div>
            <div style="position:absolute;bottom:-50px;left:40px;width:200px;height:200px;background:radial-gradient(circle,rgba(59,130,246,.15) 0%,transparent 70%);border-radius:50%;pointer-events:none;"></div>
            <div style="position:relative;z-index:1;">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    <h2 style="margin:0;color:#fff;font-size:1.55rem;font-weight:700;">Bitácora de Mantención</h2>
                </div>
                <p style="margin:0;color:rgba(255,255,255,.7);font-size:.95rem;">Historial completo de mantenciones realizadas</p>
            </div>
        </div>

        <!-- FILTER SECTION -->
        <div class="bit-filter" style="background:#fff;border-radius:14px;padding:20px 28px;margin-bottom:24px;box-shadow:0 1px 6px rgba(0,0,0,.05);border:1px solid #f1f5f9;">
            <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:14px;align-items:end;">
                <div><label style="font-weight:600;color:#1e3a5f;font-size:.82rem;display:block;margin-bottom:6px;">Fecha Desde</label><input type="date" id="bitFechaDesde" onchange="App.modules.bitacora.applyFilters()" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:.88rem;color:#334155;background:#f8fafc;transition:border-color .2s,box-shadow .2s;outline:none;" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,.15)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
                <div><label style="font-weight:600;color:#1e3a5f;font-size:.82rem;display:block;margin-bottom:6px;">Fecha Hasta</label><input type="date" id="bitFechaHasta" onchange="App.modules.bitacora.applyFilters()" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:.88rem;color:#334155;background:#f8fafc;transition:border-color .2s,box-shadow .2s;outline:none;" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,.15)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
                <div><label style="font-weight:600;color:#1e3a5f;font-size:.82rem;display:block;margin-bottom:6px;">Tipo</label>
                    <select id="bitTipo" onchange="App.modules.bitacora.applyFilters()" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:.88rem;color:#334155;background:#f8fafc;cursor:pointer;transition:border-color .2s,box-shadow .2s;outline:none;" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,.15)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
                        <option value="">Todos</option>
                        <option value="Preventiva">Preventiva</option>
                        <option value="Correctiva">Correctiva</option>
                    </select>
                </div>
                <div><label style="font-weight:600;color:#1e3a5f;font-size:.82rem;display:block;margin-bottom:6px;">Turno</label>
                    <select id="bitTurno" onchange="App.modules.bitacora.applyFilters()" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:.88rem;color:#334155;background:#f8fafc;cursor:pointer;transition:border-color .2s,box-shadow .2s;outline:none;" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,.15)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
                        <option value="">Todos</option>
                        <option value="Dia">Día</option>
                        <option value="Noche">Noche</option>
                    </select>
                </div>
                <div><label style="font-weight:600;color:#1e3a5f;font-size:.82rem;display:block;margin-bottom:6px;">Estado</label>
                    <select id="bitEstado" onchange="App.modules.bitacora.applyFilters()" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:.88rem;color:#334155;background:#f8fafc;cursor:pointer;transition:border-color .2s,box-shadow .2s;outline:none;" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,.15)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
                        <option value="activos" selected>Reparada / Realizada</option>
                        <option value="">Todos</option>
                        <option value="Reparada">Reparada</option>
                        <option value="Realizada">Realizada</option>
                        <option value="Pendiente">Pendiente</option>
                    </select>
                </div>
                <div><label style="font-weight:600;color:#1e3a5f;font-size:.82rem;display:block;margin-bottom:6px;">Técnico</label>
                    <select id="bitTecnico" onchange="App.modules.bitacora.applyFilters()" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:.88rem;color:#334155;background:#f8fafc;cursor:pointer;transition:border-color .2s,box-shadow .2s;outline:none;" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,.15)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
                        <option value="">Todos</option>
                    </select>
                </div>
            </div>
        </div>

        <!-- CONTENT -->
        <div class="bit-content">
            <div style="padding:40px 20px;text-align:center;">
                <div style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#1e40af);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;box-shadow:0 6px 20px rgba(30,64,175,.3);">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <p style="margin:0;color:#64748b;font-size:.9rem;">Cargando...</p>
            </div>
        </div>
        `;
        await this.loadData();
    },

    async loadData() {
        try {
            this._data = await db.getBitacora();
            this.populateTecnicos();
            this.applyFilters();
        } catch(e) {
            console.error('Error loading bitacora:', e);
            document.getElementById('bitacoraContent').innerHTML = '<div class="empty-state"><p>Error al cargar datos</p></div>';
        }
    },

    populateTecnicos() {
        const tecnicos = [...new Set(this._data.map(r => r.tecnico || r.responsable).filter(t => t && t !== '-'))];
        const select = document.getElementById('bitTecnico');
        select.innerHTML = '<option value="">Todos</option>' + tecnicos.sort().map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
    },

    applyFilters() {
        const desde = document.getElementById('bitFechaDesde').value;
        const hasta = document.getElementById('bitFechaHasta').value;
        const tipo = document.getElementById('bitTipo').value;
        const turno = document.getElementById('bitTurno').value;
        const estado = document.getElementById('bitEstado').value;
        const tecnico = document.getElementById('bitTecnico').value;

        let filtered = this._data.filter(r => {
            const fecha = r.tipo_mantencion === 'Preventiva' ? (r.fecha_ejecutada || r.fecha_programada) : (r.fecha_falla || '');
            if (desde && fecha < desde) return false;
            if (hasta && fecha > hasta) return false;
            if (tipo && r.tipo_mantencion !== tipo) return false;
            if (turno && (r.turno || 'Dia') !== turno) return false;
            if (tecnico && (r.tecnico || r.responsable || '-') !== tecnico) return false;
            
            const est = r.tipo_mantencion === 'Preventiva' ? (r.estado || '-') : (r.estado || 'Reparada');
            if (estado === 'activos') {
                if (est !== 'Reparada' && est !== 'Realizada') return false;
            } else if (estado) {
                if (est !== estado) return false;
            }
            
            return true;
        });

        // Sort by date descending (newest first)
        filtered.sort((a, b) => {
            const fechaA = a.tipo_mantencion === 'Preventiva' ? (a.fecha_ejecutada || a.fecha_programada || '') : (a.fecha_falla || '');
            const fechaB = b.tipo_mantencion === 'Preventiva' ? (b.fecha_ejecutada || b.fecha_programada || '') : (b.fecha_falla || '');
            const dateA = fechaA ? new Date(fechaA + 'T00:00:00') : new Date(0);
            const dateB = fechaB ? new Date(fechaB + 'T00:00:00') : new Date(0);
            return dateB - dateA;
        });

        this.renderTable(filtered);
    },

    renderTable(data) {
        const container = document.getElementById('bitacoraContent');
        if (!data || data.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No hay registros con los filtros seleccionados</p></div>';
            return;
        }
        let rows = '';
        for (const r of data) {
            const fecha = r.tipo_mantencion === 'Preventiva' ? (r.fecha_ejecutada || r.fecha_programada) : (r.fecha_falla || '');
            const tipoColor = r.tipo_mantencion === 'Preventiva' ? '#28a745' : '#dc3545';
            const turno = r.turno || 'Dia';
            const tecnico = r.tecnico || r.responsable || '-';
            const maquina = r.maquina_nombre || '-';
            const componente = r.componente_nombre || '-';
            const detalle = r.detalle || '-';
            const estado = r.tipo_mantencion === 'Preventiva' ? (r.estado || '-') : (r.estado || 'Reparada');
            rows += `<tr>
                <td>${App.formatDate(fecha)}</td>
                <td><span style="background:${tipoColor};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px">${escapeHtml(r.tipo_mantencion)}</span></td>
                <td>${escapeHtml(turno)}</td>
                <td>${escapeHtml(maquina)}</td>
                <td>${escapeHtml(componente)}</td>
                <td>${escapeHtml(tecnico)}</td>
                <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(detalle)}">${escapeHtml(detalle)}</td>
                <td><span class="status-badge ${App.getEstadoClass(estado)}">${escapeHtml(estado)}</span></td>
                <td><button onclick="App.modules.bitacora.verDetalle(${JSON.stringify(r).replace(/"/g, '&quot;')})" style="background:rgba(59,130,246,0.1);color:#3b82f6;border:none;border-radius:6px;width:28px;height:28px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-size:14px" title="Ver detalle">&#128065;</button></td>
            </tr>`;
        }
        container.innerHTML = `<table><thead><tr><th>Fecha</th><th>Tipo</th><th>Turno</th><th>Máquina</th><th>Componente</th><th>Técnico</th><th>Detalle</th><th>Estado</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
    },

    verDetalle(r) {
        const fecha = r.tipo_mantencion === 'Preventiva' ? (r.fecha_ejecutada || r.fecha_programada) : (r.fecha_falla || '');
        const tipoColor = r.tipo_mantencion === 'Preventiva' ? '#28a745' : '#dc3545';
        const estado = r.tipo_mantencion === 'Preventiva' ? (r.estado || '-') : (r.estado || 'Reparada');
        const modal = document.createElement('div');
        modal.id = 'bitModalDetalle';
        modal.style.cssText = 'position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5)';
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
        modal.innerHTML = `
            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:24px;width:90%;max-width:500px;box-shadow:0 8px 32px rgba(0,0,0,0.2)">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                    <h3 style="font-size:16px;font-weight:700">Detalle de Mantención</h3>
                    <button onclick="document.getElementById('bitModalDetalle').remove()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--text-light)">&#10005;</button>
                </div>
                <div style="display:flex;flex-direction:column;gap:10px;font-size:13px">
                    <div style="display:flex;justify-content:space-between"><span style="color:var(--text-light)">Fecha:</span><span style="font-weight:600">${App.formatDate(fecha)}</span></div>
                    <div style="display:flex;justify-content:space-between"><span style="color:var(--text-light)">Tipo:</span><span style="background:${tipoColor};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px">${r.tipo_mantencion}</span></div>
                    <div style="display:flex;justify-content:space-between"><span style="color:var(--text-light)">Turno:</span><span style="font-weight:600">${r.turno || 'Dia'}</span></div>
                    <div style="display:flex;justify-content:space-between"><span style="color:var(--text-light)">Máquina:</span><span style="font-weight:600">${r.maquina_nombre || '-'}</span></div>
                    <div style="display:flex;justify-content:space-between"><span style="color:var(--text-light)">Componente:</span><span style="font-weight:600">${r.componente_nombre || '-'}</span></div>
                    <div style="display:flex;justify-content:space-between"><span style="color:var(--text-light)">Técnico:</span><span style="font-weight:600">${r.tecnico || r.responsable || '-'}</span></div>
                    <div style="display:flex;justify-content:space-between"><span style="color:var(--text-light)">Estado:</span><span class="status-badge ${App.getEstadoClass(estado)}">${estado}</span></div>
                    ${r.horas_detalles ? `<div style="display:flex;justify-content:space-between"><span style="color:var(--text-light)">Hs. Detalle:</span><span style="font-weight:600">${r.horas_detalles}</span></div>` : ''}
                    ${r.dias ? `<div style="display:flex;justify-content:space-between"><span style="color:var(--text-light)">Días:</span><span style="font-weight:600">${r.dias}</span></div>` : ''}
                    <div style="border-top:1px solid var(--border);padding-top:10px;margin-top:4px">
                        <span style="color:var(--text-light);font-size:12px">Detalle:</span>
                        <p style="margin:4px 0 0;font-weight:500;line-height:1.5">${r.detalle || '-'}</p>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
});
