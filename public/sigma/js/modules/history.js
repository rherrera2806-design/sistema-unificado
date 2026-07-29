App.registerModule('history', {
    _selectedMaq: 0,

    async render() {
        const el = document.getElementById('page-history');
        const maquinas = await db.getAll('machines');
        this._selectedMaq = document.getElementById('histMaquina') ? parseInt(document.getElementById('histMaquina').value) : this._selectedMaq;

        const selectOptions = maquinas.map(m =>
            `<option value="${m.id}" ${this._selectedMaq === m.id ? 'selected' : ''}>${m.codigo} - ${m.nombre}</option>`
        ).join('');

        const historyContent = this._selectedMaq
            ? await this.renderHistory(this._selectedMaq)
            : `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 20px;">
                <div style="width:90px;height:90px;border-radius:50%;background:linear-gradient(135deg,#1e40af,#3b82f6);display:flex;align-items:center;justify-content:center;margin-bottom:24px;box-shadow:0 8px 30px rgba(30,64,175,0.35);">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>
                </div>
                <h4 style="margin:0 0 8px;color:#1e3a5f;font-size:1.25rem;">Seleccione una máquina</h4>
                <p style="margin:0;color:#64748b;font-size:.95rem;">Utilice el filtro superior para ver el historial completo</p>
               </div>`;

        el.innerHTML = `
        <style>
            @keyframes histFadeUp {
                from { opacity: 0; transform: translateY(18px); }
                to   { opacity: 1; transform: translateY(0); }
            }
            .hist-hero { animation: histFadeUp .5s ease-out both; }
            .hist-filter { animation: histFadeUp .5s ease-out .1s both; }
            .hist-content { animation: histFadeUp .5s ease-out .2s both; }
            .hist-card {
                transition: transform .2s ease, box-shadow .2s ease;
            }
            .hist-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(0,0,0,.1);
            }
            .hist-table-wrap {
                animation: histFadeUp .5s ease-out .3s both;
            }
            .hist-table-wrap table { width: 100%; border-collapse: collapse; }
            .hist-table-wrap th {
                background: linear-gradient(135deg,#1e40af,#3b82f6);
                color: #fff;
                font-weight: 600;
                padding: 12px 16px;
                text-align: left;
                font-size: .85rem;
                letter-spacing: .03em;
            }
            .hist-table-wrap td {
                padding: 11px 16px;
                border-bottom: 1px solid #e5e7eb;
                font-size: .9rem;
                color: #334155;
            }
            .hist-table-wrap tbody tr {
                transition: background .15s ease, transform .15s ease;
            }
            .hist-table-wrap tbody tr:hover {
                background: #f0f6ff;
                transform: translateX(2px);
            }
            .hist-action-btn {
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
            .hist-action-btn:hover {
                background: #dbeafe;
                transform: scale(1.12);
            }
            .hist-action-btn svg { stroke: #1e40af; }
        </style>

        <!-- HERO HEADER -->
        <div class="hist-hero" style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:32px 36px;margin-bottom:24px;position:relative;overflow:hidden;">
            <div style="position:absolute;top:-40px;right:-30px;width:160px;height:160px;background:radial-gradient(circle,rgba(96,165,250,.25) 0%,transparent 70%);border-radius:50%;pointer-events:none;"></div>
            <div style="position:absolute;bottom:-50px;left:40px;width:200px;height:200px;background:radial-gradient(circle,rgba(59,130,246,.15) 0%,transparent 70%);border-radius:50%;pointer-events:none;"></div>
            <div style="position:relative;z-index:1;">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <h2 style="margin:0;color:#fff;font-size:1.55rem;font-weight:700;">Historial por Máquina</h2>
                </div>
                <p style="margin:0;color:rgba(255,255,255,.7);font-size:.95rem;">Ficha completa de intervenciones y mantenimiento</p>
            </div>
        </div>

        <!-- FILTER SECTION -->
        <div class="hist-filter" style="background:#fff;border-radius:14px;padding:20px 28px;margin-bottom:24px;box-shadow:0 1px 6px rgba(0,0,0,.05);display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
            <label style="font-weight:600;color:#1e3a5f;font-size:.95rem;display:flex;align-items:center;gap:8px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1e40af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                Máquina:
            </label>
            <select class="form-control" id="histMaquina" onchange="App.modules.history.render()" style="flex:1;min-width:280px;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:.95rem;color:#1e3a5f;background:#f8fafc;transition:border-color .2s,box-shadow .2s;outline:none;" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,.15)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
                <option value="0">-- Seleccione una máquina --</option>
                ${selectOptions}
            </select>
        </div>

        <!-- HISTORY CONTENT -->
        <div class="hist-content">
            ${historyContent}
        </div>
        `;
    },

    async renderHistory(maquinaId) {
        const info = await db.getMachineWithDetails(maquinaId);
        if (!info) return '';
        const { maquina, tipo, componentes, preventivos, correctivos } = info;
        const totalHorasDet = correctivos.reduce((s, c) => s + (c.horas_detencion || 0), 0);
        const repuestosUsados = correctivos.filter(c => c.repuestos_utilizados).map(c => c.repuestos_utilizados);
        let prevRows = '', corrRows = '';
        for (const p of preventivos) {
            const comp = await db.getById('components', p.componente_id).catch(() => null);
            prevRows += `<tr><td>${comp ? comp.nombre : '-'}</td><td>${p.observaciones || '-'}</td><td>${App.formatDate(p.fecha_programada)}</td><td>${App.formatDate(p.fecha_ejecutada)}</td><td>${p.tecnico || '-'}</td><td>${p.turno || 'Dia'}</td><td><span class="status-badge ${App.getEstadoClass(p.estado)}">${p.estado}</span></td></tr>`;
        }
        for (const c of correctivos) {
            const comp = await db.getById('components', c.componente_id).catch(() => null);
            corrRows += `<tr><td>${comp ? comp.nombre : '-'}</td><td>${App.formatDate(c.fecha_falla)}</td><td>${c.descripcion_falla}</td><td>${c.diagnostico || '-'}</td><td>${c.turno || 'Dia'}</td><td>${c.horas_detencion}</td></tr>`;
        }
        return `
            <div class="card">
                <div class="card-header"><h3>${maquina.codigo} - ${maquina.nombre}</h3>
                    <span class="status-badge ${App.getEstadoClass(maquina.estado_operativo)}">${maquina.estado_operativo}</span>
                </div>
                <div class="card-body">
                    <div class="form-row" style="grid-template-columns:1fr 1fr 1fr">
                        <div><strong>Tipo:</strong> ${tipo ? tipo.nombre : '-'}</div>
                        <div><strong>Marca:</strong> ${maquina.marca || '-'}</div>
                        <div><strong>Modelo:</strong> ${maquina.modelo || '-'}</div>
                        <div><strong>Serie:</strong> ${maquina.numero_serie || '-'}</div>
                        <div><strong>Ubicación:</strong> ${maquina.ubicacion || '-'}</div>
                        <div><strong>Fecha Compra:</strong> ${App.formatDate(maquina.fecha_compra)}</div>
                    </div>
                </div>
            </div>
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-icon blue">📋</div><div class="stat-info"><h4>${preventivos.length}</h4><p>Mantenciones</p></div></div>
                <div class="stat-card"><div class="stat-icon red">🔴</div><div class="stat-info"><h4>${correctivos.length}</h4><p>Fallas</p></div></div>
                <div class="stat-card"><div class="stat-icon orange">⏱️</div><div class="stat-info"><h4>${totalHorasDet}</h4><p>Horas detención</p></div></div>
                <div class="stat-card"><div class="stat-icon green">🔧</div><div class="stat-info"><h4>${componentes.length}</h4><p>Componentes</p></div></div>
            </div>
            <div class="card">
                <div class="card-header"><h3>Componentes</h3></div>
                <div class="card-body">${componentes.map(c => `<span class="status-badge status-programada" style="margin:2px">${c.nombre}</span>`).join(' ') || 'Sin componentes'}</div>
            </div>
            <div class="card">
                <div class="card-header"><h3>📋 Preventivas</h3></div>
                <div class="card-body" style="padding:0">
                    ${preventivos.length === 0 ? '<div class="empty-state"><p>Sin registros</p></div>' : `<table><thead><tr><th>Componente</th><th>Observaciones</th><th>Fecha Prog.</th><th>Fecha Ejec.</th><th>Técnico</th><th>Turno</th><th>Estado</th></tr></thead><tbody>${prevRows}</tbody></table>`}
                </div>
            </div>
            <div class="card">
                <div class="card-header"><h3>🔴 Fallas</h3></div>
                <div class="card-body" style="padding:0">
                    ${correctivos.length === 0 ? '<div class="empty-state"><p>Sin registros</p></div>' : `<table><thead><tr><th>Componente</th><th>Fecha</th><th>Falla</th><th>Diagnóstico</th><th>Turno</th><th>Horas Det.</th></tr></thead><tbody>${corrRows}</tbody></table>`}
                </div>
            </div>
            ${repuestosUsados.length > 0 ? `
            <div class="card">
                <div class="card-header"><h3>📦 Repuestos Utilizados</h3></div>
                <div class="card-body"><ul style="margin-left:20px">${repuestosUsados.map(r => `<li style="margin:4px 0">${r}</li>`).join('')}</ul></div>
            </div>` : ''}
        `;
    }
});
