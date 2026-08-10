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
    cargaPorGrupo: null,
    cargaPorGrupoFinales: null,
    chartModo: 'inicio',
    _chartInstance: null,
    semanaEstaciones: null,

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
                <div class="card plan-card" style="text-align:center"><div class="card-body" style="padding:12px">
                    <div style="font-size:22px;font-weight:700;color:var(--primary)">${totalCap.toLocaleString('es-CL')}</div>
                    <div style="color:var(--text-light);font-size:12px">Capacidad (kg/dia)</div>
                </div></div>
                <div class="card plan-card" style="text-align:center"><div class="card-body" style="padding:12px">
                    <div style="font-size:22px;font-weight:700;color:${color}">${totalUsado.toLocaleString('es-CL', {maximumFractionDigits:1})}</div>
                    <div style="color:var(--text-light);font-size:12px">Kg Asignados</div>
                </div></div>
                <div class="card plan-card" style="text-align:center"><div class="card-body" style="padding:12px">
                    <div style="font-size:22px;font-weight:700;color:${color}">${pct}%</div>
                    <div style="color:var(--text-light);font-size:12px">Ocupacion</div>
                </div></div>
                <div class="card plan-card" style="text-align:center"><div class="card-body" style="padding:12px">
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
                <div class="card plan-card" style="border-left:4px solid ${c.color || '#3b82f6'}">
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
                            <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> ${ordenes} ord.</span>
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
            el.innerHTML = '<div style="background:#dcfce7;border-radius:8px;padding:12px;text-align:center;color:#166534;font-size:13px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" style="vertical-align:-2px"><polyline points="20 6 9 17 4 12"/></svg> No hay ordenes pendientes sin asignar</div>';
            return;
        }
        const kgTotal = sinAsignar.reduce((s, o) => s + Number(o.kilos || 0), 0);
        const sinGrupo = sinAsignar.filter(o => !o.grupo).length;
        const td = 'padding:5px 8px';
        let html = `<div style="background:#fef3c7;padding:8px 12px;font-size:12px;display:flex;justify-content:space-between;border-radius:8px 8px 0 0">
            <strong>${sinAsignar.length} pendientes sin asignar · ${kgTotal.toLocaleString('es-CL', {maximumFractionDigits:1})} kg${sinGrupo ? ` · <span style="color:#ef4444">${sinGrupo} sin grupo</span>` : ''}</strong>
            <span>Usa <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Auto-Asignar para programar todas</span>
        </div>`;
        html += `<div style="max-height:300px;overflow-y:auto"><table style="width:100%;font-size:12px"><thead><tr style="background:#f8fafc">
            <th style="${td}">Pedido</th><th style="${td}">Cliente</th><th style="${td}">Codigo</th>
            <th style="${td}">Padre</th><th style="${td}">Producto</th>
            <th style="${td}">Dim</th><th style="${td}">Cant</th><th style="${td}">kg</th><th style="${td}">Grupo</th><th style="${td}">Accion</th>
        </tr></thead><tbody>`;
        html += sinAsignar.map(o => {
            const grupoColor = o.grupo ? '#dcfce7' : '#fee2e2';
            const grupoText = o.grupo ? '#166534' : '#991b1b';
            return `<tr class="plan-row" style="line-height:1.3;border-bottom:1px solid var(--border)">
                <td style="${td}"><strong>${escapeHtml(o.pedido_sap_id || '-')}</strong></td>
                <td style="${td}">${escapeHtml(o.cliente || '-')}</td>
                <td style="${td}"><strong>${escapeHtml(o.codigo_producto)}</strong>${o.es_compuesto ? ' <span style="font-size:9px;padding:1px 4px;border-radius:3px;background:#ede9fe;color:#7c3aed">BOM</span>' : ''}</td>
                <td style="${td};font-size:11px"><strong>${escapeHtml(o.codigo_padre || '-')}</strong></td>
                <td style="${td};font-size:11px;color:#6b7280">${escapeHtml(o.nombre_padre || '-')}</td>
                <td style="${td}">${o.ancho}x${o.alto}</td>
                <td style="${td}">${o.cantidad || 1}</td>
                <td style="${td}"><strong>${Number(o.kilos || 0).toFixed(1)}</strong></td>
                <td style="${td}"><span style="padding:1px 6px;border-radius:3px;font-size:10px;background:${grupoColor};color:${grupoText}">${o.grupo || 'sin grupo'}</span></td>
                <td style="${td}">${o.grupo ? `<span style="font-size:10px;color:#6b7280">usa <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Auto-Asignar</span>` : '<span style="font-size:10px;color:#ef4444">requiere grupo</span>'}</td>
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
        await Promise.all([this.cargarGrupo(), this.cargarDatos()]);
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
                    <input type="number" class="form-control" value="${c.capacidad_kg_dia}" id="planCapG_${c.id}" min="0" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
                    <button class="btn btn-sm btn-primary" title="Guardar capacidad" onclick="App.modules.planificacion.guardarCapacidadGrupo(${c.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg></button>
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
                <input type="date" class="form-control" id="planAutoGInicio" value="${this.fechaGrupo}" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
            </div>
            <div class="form-group">
                <label style="font-weight:500">Cantidad de dias habiles a buscar</label>
                <input type="number" class="form-control" id="planAutoGDias" value="14" min="1" max="60" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
            </div>
            <div id="planAutoGResultado" style="margin-top:12px"></div>
        `;
        const footer = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.planificacion.ejecutarAutoAsignarGrupo()">Asignar</button>
        `;
        App.showModalInv('<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Auto-Asignar Pendientes', html, footer);
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
                const numAsignados = Array.isArray(data.asignados) ? data.asignados.length : 0;
                const numNoAsignados = Array.isArray(data.noAsignados) ? data.noAsignados.length : 0;
                const esExito = numAsignados > 0;
                let html = `<div style="background:${esExito ? '#dcfce7' : '#fef2f2'};border-radius:8px;padding:12px;font-size:13px">
                    <div><strong>${esExito ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" style="vertical-align:-2px"><polyline points="20 6 9 17 4 12"/></svg>' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" style="vertical-align:-2px"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'} Asignadas: ${numAsignados}</strong></div>`;
                if (numNoAsignados > 0) {
                    html += `<div style="margin-top:8px;color:#991b1b;font-weight:600">Sin capacidad (${numNoAsignados}):</div>`;
                    const muestra = data.noAsignados.slice(0, 20);
                    html += muestra.map(n => 
                        `<div style="margin-top:4px;padding:6px 8px;background:#fef2f2;border-radius:6px;border-left:3px solid #ef4444">
                            <div><strong>${escapeHtml(n.pedido || n.id || n.orden_id)}</strong> — ${escapeHtml(n.motivo)}</div>
                            <div style="font-size:11px;color:#6b7280">Grupo: ${escapeHtml(n.grupo || '?')} | ${Number(n.m2_total || 0).toFixed(1)} m² | ${Number(n.kg_total || 0).toFixed(0)} kg</div>
                        </div>`
                    ).join('');
                    if (numNoAsignados > 20) html += `<div style="margin-top:4px;font-size:11px;color:#6b7280">... y ${numNoAsignados - 20} mas</div>`;
                }
                html += '</div>';
                resEl.innerHTML = html;
                if (esExito) {
                    setTimeout(async () => { App.hideModal(); await this.cargarGrupo(); await this.cargarDatos(); await this.cargarEstaciones(); }, 1500);
                }
            } else {
                resEl.innerHTML = `<div style="color:#ef4444">${data.error || 'Error'}</div>`;
            }
        } catch(e) {
            resEl.innerHTML = `<div style="color:#ef4444">Error: ${e.message}</div>`;
        }
    },

    showReprogramar() {
        const html = `
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px;color:#991b1b">
                <strong>Atencion:</strong> Esta accion liberara TODAS las ordenes en estado PROGRAMADO (las devolvera a PENDIENTE) y luego re-asignaran automaticamente respetando la prioridad:
                <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
                    <span style="padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;background:#fef2f2;color:#991b1b;border:1px solid #ef4444">4. Reposicion</span>
                    <span style="padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;background:#fff7ed;color:#9a3412;border:1px solid #f97316">3. Urgencia</span>
                    <span style="padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;background:#fefce8;color:#854d0e;border:1px solid #eab308">2. Express</span>
                    <span style="padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;background:#f8fafc;color:#64748b;border:1px solid #e2e8f0">1. Normal</span>
                </div>
                <div style="margin-top:8px;font-size:12px;color:#6b7280">
                    <strong>Protegidos:</strong> Ordenes EN PROCESO, MERMADAS y TERMINADAS NO seran tocadas.
                </div>
            </div>
            <div class="form-group">
                <label style="font-weight:500">Desde (fecha inicio busqueda)</label>
                <input type="date" class="form-control" id="reprogInicio" value="${this.fechaGrupo}" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
            </div>
            <div class="form-group">
                <label style="font-weight:500">Dias habiles a buscar capacidad</label>
                <input type="number" class="form-control" id="reprogDias" value="21" min="1" max="60" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
            </div>
            <div id="reprogResultado" style="margin-top:12px"></div>
        `;
        const footer = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-danger" style="background:#ef4444;border-color:#ef4444;color:white" onclick="App.modules.planificacion.ejecutarReprogramar()">Reprogramar Todo</button>
        `;
        App.showModalInv('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Reprogramar Pendientes', html, footer);
    },

    async ejecutarReprogramar() {
        const inicio = document.getElementById('reprogInicio').value;
        const dias = Number(document.getElementById('reprogDias').value) || 21;
        const resEl = document.getElementById('reprogResultado');
        resEl.innerHTML = '<div style="text-align:center;padding:12px;color:#64748b">Reprogramando... liberando y re-asignando por prioridad...</div>';
        try {
            const res = await fetch('/api/produccion/reprogramar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inicio, dias })
            });
            const data = await res.json();
            if (res.ok) {
                const numLiberadas = data.ordenes_liberadas || 0;
                const numAsignados = Array.isArray(data.asignados) ? data.asignados.length : 0;
                const numNoAsignados = Array.isArray(data.noAsignados) ? data.noAsignados.length : 0;
                let html = `<div style="background:#dcfce7;border-radius:8px;padding:12px;font-size:13px">
                    <div style="font-weight:700;color:#166534;margin-bottom:8px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" style="vertical-align:-2px"><polyline points="20 6 9 17 4 12"/></svg> Reprogramacion completada</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center">
                        <div style="background:white;border-radius:6px;padding:8px"><div style="font-size:18px;font-weight:800;color:#f59e0b">${numLiberadas}</div><div style="font-size:10px;color:#64748b">Liberadas</div></div>
                        <div style="background:white;border-radius:6px;padding:8px"><div style="font-size:18px;font-weight:800;color:#22c55e">${numAsignados}</div><div style="font-size:10px;color:#64748b">Re-asignadas</div></div>
                        <div style="background:white;border-radius:6px;padding:8px"><div style="font-size:18px;font-weight:800;color:#ef4444">${numNoAsignados}</div><div style="font-size:10px;color:#64748b">Sin cupo</div></div>
                    </div>`;
                if (numNoAsignados > 0) {
                    html += `<div style="margin-top:10px;color:#991b1b;font-weight:600">Sin capacidad (${numNoAsignados}):</div>`;
                    data.noAsignados.slice(0, 15).forEach(n => {
                        html += `<div style="margin-top:3px;padding:4px 8px;background:#fef2f2;border-radius:4px;border-left:3px solid #ef4444;font-size:12px">
                            <strong>${escapeHtml(n.pedido || n.orden_id)}</strong> — ${escapeHtml(n.motivo)} (${escapeHtml(n.grupo || '?')})
                        </div>`;
                    });
                }
                html += '</div>';
                resEl.innerHTML = html;
                setTimeout(async () => { App.hideModal(); await this.cargarGrupo(); await this.cargarDatos(); await this.cargarEstaciones(); }, 2000);
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
        this.semanaFin.setDate(this.semanaFin.getDate() + 9);
    },

    async render() {
        if (!this.semanaInicio) this.calcSemana(new Date());
        if (!this.fechaGrupo) this.fechaGrupo = new Date().toISOString().split('T')[0];
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const puedeEditar = (user.permisos || []).includes('usuarios') || (user.permisos || []).includes('produccion');
        const page = document.getElementById('page-planificacion');
        if (!page) return;
        page.innerHTML = `
            <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:8px 16px;margin-bottom:20px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">
<div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
<div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center"><div><h2 style="margin:0;font-size:15px;font-weight:800;color:white;letter-spacing:-0.5px">Planificacion</h2>
<p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Carga por grupo (kg) + calendario por estacion (m2) - 15 dias corridos</p></div>
</div></div>

<style>
@keyframes plan_fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.plan-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}
.plan-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important;transform:translateY(-3px)}
.plan-row{transition:all 0.2s}
.plan-row:hover{transform:translateX(2px);background:#f8fafc!important}
</style>

            <!-- VISTA POR GRUPO (kg/dia) - nueva -->
            <div class="card plan-card" style="margin-bottom:20px;border:2px solid #3b82f6">
                <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;background:linear-gradient(90deg,#eff6ff,#fff)">
                    <div>
                        <h3 style="margin:0;font-size:16px">⚖️ Vista por Grupo (kg/dia)</h3>
                        <div style="font-size:12px;color:var(--text-light)">Capacidad maxima diaria por grupo de productos</div>
                    </div>
                    <div style="display:flex;gap:6px;align-items:center">
                        <label style="font-size:12px;color:var(--text-light)">Fecha:</label>
                        <input type="date" class="form-control" id="planGrupoFecha" value="${this.fechaGrupo}" onchange="App.modules.planificacion.cambiarFechaGrupo()" style="width:140px;padding:4px 8px;font-size:12px" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
                        <button class="btn btn-outline" style="padding:4px 10px;font-size:12px" onclick="App.modules.planificacion.cambiarFechaGrupo(-1)">◀</button>
                        <button class="btn btn-outline" style="padding:4px 10px;font-size:12px" onclick="App.modules.planificacion.cambiarFechaGrupo(1)">▶</button>
                        ${puedeEditar ? '<button class="btn btn-outline" style="padding:4px 10px;font-size:12px" onclick="App.modules.planificacion.showCapacidadGrupo()" title="Configurar capacidad"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51l.06.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> Capacidad</button>' : ''}
                        ${puedeEditar ? '<button class="btn btn-primary" style="padding:4px 12px;font-size:12px" onclick="App.modules.planificacion.showAutoAsignarGrupo()" title="Auto-asignar"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Auto-Asignar</button>' : ''}
                        ${puedeEditar ? '<button class="btn btn-danger" style="padding:4px 12px;font-size:12px;background:#ef4444;border-color:#ef4444;color:white" onclick="App.modules.planificacion.showReprogramar()" title="Reprogramar: libera PROGRAMADO y re-asigna por prioridad"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Reprogramar</button>' : ''}
                    </div>
                </div>
                <div class="card-body" style="padding:16px">
                    <div id="planGrupoResumen"></div>
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:16px" id="planGrupoCards">
                        <div style="text-align:center;padding:20px;color:#64748b">Cargando...</div>
                    </div>
                    <h4 style="margin:16px 0 8px;font-size:14px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" style="vertical-align:-2px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Pendientes sin Asignar</h4>
                    <div id="planGrupoPendientes"><div style="text-align:center;padding:12px;color:#64748b">Cargando...</div></div>
                </div>
            </div>

            <!-- VISTA SEMANAL POR GRUPO (la nueva util) -->
            <div id="planCalendario"><div style="text-align:center;padding:20px;color:#64748b">Cargando calendario...</div></div>

            <!-- CHART: Carga por Grupo -->
            <div id="planChart" style="margin-top:24px"></div>

            <!-- CARGA POR ESTACIONES -->
            <div class="card plan-card" style="margin-top:24px;border:2px solid #f59e0b">
                <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;background:linear-gradient(90deg,#fffbeb,#fff)">
                    <div>
                        <h3 style="margin:0;font-size:16px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M2 20h20"/><path d="M5 20V8l5 4V8l5 4V4h3v16"/></svg> Carga por Estaciones</h3>
                        <div style="font-size:12px;color:var(--text-light)">Ocupacion de m2 por estacion y dia - 15 dias corridos</div>
                    </div>
                    <div style="display:flex;gap:6px;align-items:center">
                        <label style="font-size:12px;color:var(--text-light)">Periodo:</label>
                        <button class="btn btn-outline" style="padding:4px 10px;font-size:12px" onclick="App.modules.planificacion.cambiarSemanaEstaciones(-1)">◀</button>
                        <button class="btn btn-outline" style="padding:4px 10px;font-size:12px" onclick="App.modules.planificacion.cambiarSemanaEstaciones(1)">▶</button>
                    </div>
                </div>
                <div class="card-body" style="padding:16px">
                    <div id="planEstaciones"><div style="text-align:center;padding:20px;color:#64748b">Cargando...</div></div>
                </div>
            </div>

            <div class="modal-overlay" id="planAsignarModal">
                <div class="modal" style="max-width:500px">
                    <div class="modal-header"><h3>Asignar Fecha de Entrega</h3><button class="modal-close" title="Cerrar" onclick="App.modules.planificacion.cerrarModal()">&times;</button></div>
                    <div class="modal-body" id="planAsignarBody"></div>
                </div>
            </div>
        `;
        await Promise.all([this.cargarGrupo(), this.cargarDatos()]);
        await this.cargarEstaciones().catch(e => console.error('cargarEstaciones:', e));
    },

    async cargarDatos() {
        const inicio = this.fmtDate(this.semanaInicio);
        const fin = this.fmtDate(this.semanaFin);
        try {
            const [cargaGrupoRes, pendRes, cargaEstRes, grupoChartRes, grupoFinalesRes] = await Promise.all([
                fetch(`/api/produccion/planificacion-grupo/semana?inicio=${inicio}&fin=${fin}`),
                fetch('/api/produccion/planificacion/pendientes'),
                fetch(`/api/produccion/planificacion/carga-semanal?inicio=${inicio}&fin=${fin}`),
                fetch(`/api/produccion/planificacion/carga-por-grupo?inicio=${inicio}&fin=${fin}`),
                fetch(`/api/produccion/planificacion/carga-por-grupo-finales?inicio=${inicio}&fin=${fin}`)
            ]);
            if (cargaGrupoRes.ok) {
                const data = await cargaGrupoRes.json();
                this.gruposSemana = data.grupos || [];
                this.diasSemana = data.dias || [];
                this.calendario = data.calendario || {};
            } else { console.error('carga-grupo-semana error:', cargaGrupoRes.status); this.gruposSemana = []; this.diasSemana = []; this.calendario = {}; }
            if (pendRes.ok) this.pendientes = await pendRes.json();
            else { console.error('pendientes error:', pendRes.status); this.pendientes = []; }
            if (cargaEstRes.ok) this.cargaSemanal = await cargaEstRes.json();
            else { console.error('carga-semanal error:', cargaEstRes.status); this.cargaSemanal = []; }
            if (grupoChartRes.ok) this.cargaPorGrupo = await grupoChartRes.json();
            else { console.error('carga-por-grupo error:', grupoChartRes.status); this.cargaPorGrupo = null; }
            if (grupoFinalesRes.ok) this.cargaPorGrupoFinales = await grupoFinalesRes.json();
            else { console.error('carga-por-grupo-finales error:', grupoFinalesRes.status); this.cargaPorGrupoFinales = null; }

            // Primera carga: ajustar rango al primer dia con carga + 10 dias
            if (!this._dataLoaded) {
                this._dataLoaded = true;
                const primerDia = this._findFirstDayWithData();
                if (primerDia) {
                    const d = new Date(primerDia + 'T00:00:00');
                    const curInicio = new Date(this.semanaInicio);
                    if (d.getTime() !== curInicio.getTime()) {
                        this.semanaInicio = d;
                        this.semanaFin = new Date(d);
                        this.semanaFin.setDate(this.semanaFin.getDate() + 14);
                        await this.cargarDatos();
                        return;
                    }
                }
            }
        } catch(e) {
            console.error('Error cargando planificacion:', e);
        }
        this.renderCalendario();
        this.renderChart();
        this.cargarEstaciones();
    },

    _findFirstDayWithData() {
        // Buscar en gruposSemana el primer dia con kilos > 0
        for (const g of this.gruposSemana) {
            for (const d of (g.dias || [])) {
                if ((d.kilos || 0) > 0) return d.fecha;
            }
        }
        return null;
    },

    renderPendientes() {
        const div = document.getElementById('planPendientes');
        if (!div) return;
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
                            return `<tr class="plan-row" style="border-bottom:1px solid var(--border)">
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
        if (!div) { console.warn('planCalendario div no existe'); return; }
        const diasSemana = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
        const inicio = this.semanaInicio;
        const finD = new Date(this.semanaFin);

        // Construir headers de dias desde this.diasSemana
        let diasInfo = this.diasSemana.map(f => {
            const d = new Date(f + 'T00:00:00');
            const dow = d.getDay();
            const diaCorto = diasSemana[(dow + 6) % 7];
            const fechaCorta = diaCorto + ', ' + d.getDate() + '/' + (d.getMonth()+1);
            return { fecha: f, dia: diaCorto, fechaCorta };
        }).filter(d => {
            // Ocultar dias desactivados (sab/dom) del calendario
            const cal = this.calendario ? this.calendario[d.fecha] : null;
            const es_laboral = cal ? cal.es_laboral : (new Date(d.fecha + 'T12:00:00').getDay() !== 0 && new Date(d.fecha + 'T12:00:00').getDay() !== 6);
            return es_laboral;
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
                        <h3 style="margin:0;font-size:16px">Carga por Grupo (15 dias)</h3>
                        <div style="font-size:12px;color:var(--text-light)">m2, metros lineales y kilos por dia y grupo</div>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center">
                        <button class="btn btn-outline btn-sm" onclick="App.modules.planificacion.cambiarSemana(-1)">◀</button>
                        <span style="font-size:13px;font-weight:600">${this.fmtDate(inicio)} al ${this.fmtDate(finD)}</span>
                        <button class="btn btn-outline btn-sm" onclick="App.modules.planificacion.cambiarSemana(1)">▶</button>
                    </div>
                </div>
                <div style="overflow-x:auto">
                    <table style="width:100%;font-size:10px;border-collapse:collapse;table-layout:fixed">
                        <colgroup>
                            <col style="width:180px">
                            <col style="width:70px">
                            ${diasInfo.map(() => '<col>').join('')}
                        </colgroup>
                        <thead><tr style="border-bottom:2px solid var(--border)">
                            <th style="padding:6px;text-align:left">Grupo</th>
                            <th style="padding:6px;text-align:center">Cap kg/dia</th>
                            ${diasInfo.map(d => {
                                return `<th style="padding:4px;text-align:center">
                                    <div style="font-weight:600;font-size:11px">${d.fechaCorta}</div>
                                </th>`;
                            }).join('')}
                        </tr></thead>
                        <tbody>${this.gruposSemana.map(g => {
                            const colorBorde = g.color || '#3b82f6';
                            return `<tr class="plan-row" style="border-bottom:1px solid var(--border)">
                                <td style="padding:8px;border-left:3px solid ${colorBorde}">
                                    <strong>${escapeHtml(g.grupo)}</strong>
                                </td>
                                <td style="padding:6px;text-align:center;font-size:10px;color:var(--text-light)">${g.capacidad_kg_dia.toLocaleString('es-CL')}</td>
                                ${diasInfo.map(d => {
                                    const cell = g.dias.find(x => x.fecha === d.fecha) || {};
                                    const c = colorCelda(cell.kilos || 0, g.capacidad_kg_dia, true);
                                    const hasData = (cell.m2 || cell.m_lineales || cell.kilos) > 0;
                                    return `<td style="padding:2px;text-align:center">
                                        <div style="background:${hasData ? c.bg : '#f8fafc'};border:1px solid ${hasData ? c.border : '#e2e8f0'};border-radius:4px;padding:4px 2px">
                                            ${hasData ? `
                                                <div style="font-size:10px;color:${c.text};font-weight:600;line-height:1.2">${Number(cell.m2 || 0).toFixed(0)}m²</div>
                                                <div style="font-size:9px;color:${c.text};line-height:1.2">${Number(cell.m_lineales || 0).toFixed(0)}mL</div>
                                                <div style="font-size:10px;color:${c.text};font-weight:700;line-height:1.2">${Number(cell.kilos || 0).toFixed(0)}kg</div>
                                            ` : '<div style="font-size:9px;color:#cbd5e1">-</div>'}
                                        </div>
                                    </td>`;
                                }).join('')}
                            </tr>`;
                        }).join('')}</tbody>
                    </table>
                </div>
                <div style="margin-top:12px;display:flex;gap:14px;font-size:11px;color:var(--text-light);flex-wrap:wrap">
                    <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#dbeafe;vertical-align:middle"></span> Con carga</span>
                    <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#fef3c7;vertical-align:middle"></span> 85-100% capacidad</span>
                    <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#fee2e2;vertical-align:middle"></span> Sobrecargado</span>
                </div>
            </div>
        `;
    },

    cambiarSemana(dir) {
        this.semanaInicio.setDate(this.semanaInicio.getDate() + (dir * 15));
        this.semanaFin.setDate(this.semanaFin.getDate() + (dir * 15));
        this._dataLoaded = false;
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
                <input class="form-control" type="date" id="planFechaEntrega" min="${new Date().toISOString().split('T')[0]}" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
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
    },

    cambiarModoChart(modo) {
        this.chartModo = modo;
        this.renderChart();
    },

    renderChart() {
        const div = document.getElementById('planChart');
        if (!div) return;
        const data = this.chartModo === 'finales' ? this.cargaPorGrupoFinales : this.cargaPorGrupo;
        if (!data || !data.familias || data.familias.length === 0) {
            div.innerHTML = '';
            return;
        }
        const colores = [
            { bg: 'rgba(34,197,94,0.85)', border: 'rgba(34,197,94,1)' },
            { bg: 'rgba(30,64,175,0.85)', border: 'rgba(30,64,175,1)' },
            { bg: 'rgba(124,58,237,0.85)', border: 'rgba(124,58,237,1)' },
            { bg: 'rgba(234,179,8,0.85)', border: 'rgba(234,179,8,1)' },
            { bg: 'rgba(239,68,68,0.85)', border: 'rgba(239,68,68,1)' },
            { bg: 'rgba(6,182,212,0.85)', border: 'rgba(6,182,212,1)' },
            { bg: 'rgba(249,115,22,0.85)', border: 'rgba(249,115,22,1)' },
            { bg: 'rgba(168,85,247,0.85)', border: 'rgba(168,85,247,1)' }
        ];

        const diasSemana = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
        const labels = data.fechas.map(f => {
            const d = new Date(f + 'T12:00:00');
            const nombreDia = diasSemana[d.getDay()];
            const dia = d.getDate();
            const mes = d.getMonth() + 1;
            return `${nombreDia}, ${dia}/${mes}`;
        });

        const datasets = data.familias.map((fam, i) => ({
            label: fam,
            data: data.fechas.map(f => data.datos[fam][f] || 0),
            backgroundColor: colores[i % colores.length].bg,
            borderColor: colores[i % colores.length].border,
            borderWidth: 1,
            borderRadius: 2
        }));

        const capacidades = data.fechas.map(f => data.capacidad_por_dia[f] || 0);
        const capacidadPromedio = capacidades.reduce((a, b) => a + b, 0) / capacidades.length;
        datasets.push({
            label: 'Capacidad Produccion',
            data: data.fechas.map(() => Math.round(capacidadPromedio * 100) / 100),
            type: 'line',
            borderColor: 'rgba(239,68,68,1)',
            borderWidth: 2,
            borderDash: [6, 3],
            pointRadius: 0,
            fill: false,
            order: -1
        });

        div.innerHTML = `
            <div style="background:var(--card-bg);border-radius:12px;padding:16px;border:1px solid var(--border)">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                    <h3 style="margin:0;font-size:16px">Carga por Grupo</h3>
                    <div style="display:flex;gap:6px;align-items:center">
                        <button onclick="App.modules.planificacion.cambiarModoChart('inicio')" style="padding:4px 12px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid ${this.chartModo === 'inicio' ? '#3b82f6' : '#e2e8f0'};background:${this.chartModo === 'inicio' ? '#3b82f6' : 'transparent'};color:${this.chartModo === 'inicio' ? 'white' : '#64748b'}">F. Inicio</button>
                        <button onclick="App.modules.planificacion.cambiarModoChart('finales')" style="padding:4px 12px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid ${this.chartModo === 'finales' ? '#8b5cf6' : '#e2e8f0'};background:${this.chartModo === 'finales' ? '#8b5cf6' : 'transparent'};color:${this.chartModo === 'finales' ? 'white' : '#64748b'}">F. Termino</button>
                        <span style="font-size:12px;color:var(--text-light);margin-left:8px">Capacidad promedio: <strong>${Math.round(capacidadPromedio).toLocaleString('es-CL')} kg/día</strong></span>
                    </div>
                </div>
                <div style="display:flex;gap:16px;align-items:center">
                    <div style="display:flex;flex-direction:column;gap:6px;font-size:11px;color:var(--text-light);min-width:120px">
                        <div style="font-weight:600;font-size:12px;margin-bottom:4px">Grupo</div>
                        ${data.familias.map((fam, i) => `<span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${colores[i % colores.length].bg};vertical-align:middle"></span> ${fam}</span>`).join('')}
                    </div>
                    <div style="position:relative;height:300px;flex:1">
                        <canvas id="chartCargaGrupo"></canvas>
                    </div>
                </div>
            </div>
        `;

        if (this._chartInstance) { this._chartInstance.destroy(); this._chartInstance = null; }
        const ctx = document.getElementById('chartCargaGrupo');
        if (!ctx) return;
        this._chartInstance = new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets },
            plugins: [ChartDataLabels],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { left: 100 } },
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        display: function(ctx) {
                            if (ctx.dataset.type === 'line') return false;
                            const val = ctx.dataset.data[ctx.dataIndex];
                            return val > 0;
                        },
                        color: '#fff',
                        font: { size: 10, weight: 'bold' },
                        formatter: function(value) {
                            if (!value || value <= 0) return '';
                            return value >= 1000 ? (value / 1000).toFixed(1) + 'k' : Math.round(value);
                        },
                        anchor: 'center',
                        align: 'center'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                const val = ctx.parsed ? ctx.parsed.y : ctx.raw;
                                if (ctx.dataset.type === 'line') return `Capacidad: ${Number(val).toLocaleString('es-CL')} kg`;
                                return `${ctx.dataset.label}: ${Number(val).toLocaleString('es-CL', {maximumFractionDigits:1})} kg`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        grid: { color: 'rgba(148,163,184,0.15)' },
                        ticks: { font: { size: 11 } }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        grid: { color: 'rgba(148,163,184,0.15)' },
                        title: { display: false },
                        ticks: { display: false }
                    }
                }
            }
        });
    },

    // ── CARGA POR ESTACIONES ──
    cambiarSemanaEstaciones(delta) {
        this.semanaInicio.setDate(this.semanaInicio.getDate() + delta * 15);
        this.semanaFin = new Date(this.semanaInicio);
        this.semanaFin.setDate(this.semanaFin.getDate() + 14);
        this._dataLoaded = false;
        this.cargarDatos();
    },

    async cargarEstaciones() {
        const inicio = this.fmtDate(this.semanaInicio);
        const finD = new Date(this.semanaFin);
        const fin = this.fmtDate(finD);

        try {
            const res = await fetch(`/api/produccion/planificacion/carga-estaciones?inicio=${inicio}&fin=${fin}`);
            if (!res.ok) return;
            const data = await res.json();
            this.renderEstaciones(data);
        } catch(e) { console.error('cargarEstaciones:', e); }
    },

    renderEstaciones(data) {
        const el = document.getElementById('planEstaciones');
        if (!el) return;
        const { estaciones, carga, calendario } = data;

        if (!estaciones || estaciones.length === 0) {
            el.innerHTML = '<div style="text-align:center;padding:20px;color:#64748b">No hay estaciones configuradas</div>';
            return;
        }

        // Generar 15 dias corridos desde semanaInicio, filtrando solo dias laborales
        const todosDias = [];
        for (let i = 0; i < 15; i++) {
            const d = new Date(this.semanaInicio);
            d.setDate(d.getDate() + i);
            const fs = this.fmtDate(d);
            const cal = calendario ? calendario[fs] : null;
            const es_laboral = cal ? cal.es_laboral : (d.getDay() !== 0 && d.getDay() !== 6);
            if (es_laboral) todosDias.push(fs);
        }

        // Encontrar primer dia con carga (>0 m2 en alguna estacion)
        let primerDiaConCarga = null;
        for (const f of todosDias) {
            const diaCarga = carga[f] || {};
            const tieneCarga = Object.values(diaCarga).some(est => (est.m2 || 0) > 0);
            if (tieneCarga) { primerDiaConCarga = f; break; }
        }

        // Filtrar: solo desde el primer dia con carga
        const dias = primerDiaConCarga
            ? todosDias.filter(f => f >= primerDiaConCarga)
            : todosDias;

        const nombreDia = (f) => {
            const d = new Date(f + 'T12:00:00');
            const diasSemana = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
            return diasSemana[d.getDay()] + ', ' + d.getDate() + '/' + (d.getMonth() + 1);
        };

        const pct = (usado, cap) => cap > 0 ? Math.round((usado / cap) * 100) : 0;
        const barColor = (p) => p >= 100 ? '#ef4444' : p >= 85 ? '#f59e0b' : p >= 50 ? '#3b82f6' : '#22c55e';

        let html = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed">';
        html += '<colgroup><col style="width:180px"><col style="width:70px">';
        dias.forEach(() => { html += '<col>'; });
        html += '</colgroup>';
        // Header
        html += '<thead><tr style="border-bottom:2px solid var(--border)">';
        html += '<th style="padding:8px;text-align:left">Estacion</th>';
        html += '<th style="padding:6px 2px 6px 0;text-align:left">Cap</th>';
        dias.forEach(f => {
            html += `<th style="padding:6px;text-align:center;min-width:90px;white-space:nowrap">${nombreDia(f)}</th>`;
        });
        html += '</tr></thead><tbody>';

        estaciones.forEach(est => {
            html += '<tr class="plan-row" style="border-bottom:1px solid var(--border)">';
            html += `<td style="padding:8px;font-weight:600;white-space:nowrap">${est.nombre}${est.cuello_botella ? ' <span style="font-size:9px;padding:1px 4px;border-radius:3px;background:#fef2f2;color:#ef4444">CB</span>' : ''}</td>`;
            html += `<td style="padding:6px 2px 6px 0;text-align:left;font-size:11px;color:var(--text-light)">${est.capacidad_m2_dia}</td>`;

            dias.forEach(f => {
                const datos = (carga[f] && carga[f][est.id]) || { m2: 0, ordenes: 0 };
                const p = pct(datos.m2, est.capacidad_m2_dia);
                html += `<td style="padding:6px;text-align:center">
                    <div style="margin-bottom:3px;font-weight:600;color:${barColor(p)}">${datos.m2.toFixed(1)}</div>
                    <div style="background:#e5e7eb;border-radius:4px;height:6px;overflow:hidden">
                        <div style="background:${barColor(p)};height:100%;width:${Math.min(p, 100)}%;transition:width 0.3s"></div>
                    </div>
                    <div style="font-size:10px;color:#6b7280;margin-top:2px">${p}% · ${datos.ordenes} ord</div>
                </td>`;
            });

            html += '</tr>';
        });

        html += '</tbody></table></div>';

        // Leyenda
        html += '<div style="margin-top:10px;display:flex;gap:16px;font-size:11px;color:#6b7280">';
        html += '<span><svg width="14" height="14" viewBox="0 0 24 24" fill="#22c55e" style="vertical-align:-2px"><circle cx="12" cy="12" r="6"/></svg> &lt;50%</span><span><svg width="14" height="14" viewBox="0 0 24 24" fill="#3b82f6" style="vertical-align:-2px"><circle cx="12" cy="12" r="6"/></svg> 50-84%</span><span><svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" style="vertical-align:-2px"><circle cx="12" cy="12" r="6"/></svg> 85-99%</span><span><svg width="14" height="14" viewBox="0 0 24 24" fill="#ef4444" style="vertical-align:-2px"><circle cx="12" cy="12" r="6"/></svg> ≥100%</span>';
        html += '<span style="margin-left:auto">CB = Cuello de Botella</span></div>';

        el.innerHTML = html;
    }
};
