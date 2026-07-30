App.registerModule('spareparts', {
    async render() {
        const el = document.getElementById('page-spareparts');
        const repuestos = await db.getAll('spare_parts');
        const filterCritico = document.getElementById('filterCritico')?.value || '';
        let filtered = [];
        for (const r of repuestos) {
            const comp = await db.getById('components', r.componente_id).catch(() => null);
            filtered.push({ ...r, componenteNombre: comp ? comp.nombre : '-' });
        }
        if (filterCritico === 'critico') filtered = filtered.filter(r => r.stock_actual <= r.stock_minimo);
        else if (filterCritico === 'normal') filtered = filtered.filter(r => r.stock_actual > r.stock_minimo);
        const criticos = repuestos.filter(r => r.stock_actual <= r.stock_minimo);
        const normales = repuestos.filter(r => r.stock_actual > r.stock_minimo);

        el.innerHTML = `
        <style>
            @keyframes spFadeUp {
                from { opacity: 0; transform: translateY(18px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .sp-hero { background: linear-gradient(135deg,#0f172a 0%,#78350f 50%,#92400e 100%); border-radius: 16px; padding: 36px 40px 28px; position: relative; overflow: hidden; margin-bottom: 28px; animation: spFadeUp .45s ease-out both; }
            .sp-hero::before { content: ''; position: absolute; top: -40px; right: -40px; width: 180px; height: 180px; background: radial-gradient(circle,rgba(251,191,36,.25) 0%,transparent 70%); border-radius: 50%; pointer-events: none; }
            .sp-hero::after { content: ''; position: absolute; bottom: -30px; left: 30%; width: 120px; height: 120px; background: radial-gradient(circle,rgba(251,191,36,.12) 0%,transparent 70%); border-radius: 50%; pointer-events: none; }
            .sp-hero h2 { margin: 0 0 4px; font-size: 1.65rem; font-weight: 800; color: #fff; letter-spacing: -.3px; }
            .sp-hero p { margin: 0; font-size: .88rem; color: rgba(255,255,255,.7); }
            .sp-hero .sp-hero-btn { position: relative; z-index: 1; }
            .sp-hero .sp-hero-btn button { background: #f59e0b; color: #0f172a; border: none; padding: 10px 22px; border-radius: 10px; font-weight: 700; font-size: .85rem; cursor: pointer; transition: background .2s,transform .15s; }
            .sp-hero .sp-hero-btn button:hover { background: #fbbf24; transform: translateY(-1px); }
            .sp-stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; margin-bottom: 24px; animation: spFadeUp .5s ease-out .1s both; }
            .sp-stat { background: #fff; border-radius: 12px; padding: 20px 22px; display: flex; align-items: center; gap: 14px; box-shadow: 0 1px 4px rgba(0,0,0,.06); border: 1px solid #f1f5f9; transition: transform .2s,box-shadow .2s; }
            .sp-stat:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,.08); }
            .sp-stat-icon { width: 46px; height: 46px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
            .sp-stat-icon.total { background: #eff6ff; color: #3b82f6; }
            .sp-stat-icon.critico { background: #fef2f2; color: #ef4444; }
            .sp-stat-icon.normal { background: #f0fdf4; color: #22c55e; }
            .sp-stat-icon svg { width: 22px; height: 22px; }
            .sp-stat-info h4 { margin: 0; font-size: 1.45rem; font-weight: 800; color: #1e293b; }
            .sp-stat-info p { margin: 0; font-size: .78rem; color: #64748b; font-weight: 500; }
            .sp-filter { background: #fff; border-radius: 14px; padding: 18px 24px; margin-bottom: 22px; box-shadow: 0 1px 4px rgba(0,0,0,.06); border: 1px solid #f1f5f9; display: flex; align-items: center; gap: 12px; animation: spFadeUp .5s ease-out .15s both; }
            .sp-filter label { font-size: .82rem; font-weight: 600; color: #475569; }
            .sp-filter select { padding: 8px 14px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: .84rem; color: #334155; background: #f8fafc; cursor: pointer; transition: border-color .2s; }
            .sp-filter select:focus { outline: none; border-color: #f59e0b; }
            .sp-table-wrap { background: #fff; border-radius: 14px; box-shadow: 0 1px 4px rgba(0,0,0,.06); border: 1px solid #f1f5f9; overflow: hidden; animation: spFadeUp .5s ease-out .2s both; }
            .sp-table { width: 100%; border-collapse: collapse; }
            .sp-table thead th { background: linear-gradient(135deg,#78350f,#92400e); color: #fef3c7; font-size: .78rem; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; padding: 13px 16px; text-align: left; border-bottom: 2px solid #78350f; }
            .sp-table tbody tr { border-bottom: 1px solid #f1f5f9; transition: background .15s,transform .15s; }
            .sp-table tbody tr:hover { background: #fffbeb; transform: translateX(2px); }
            .sp-table tbody td { padding: 12px 16px; font-size: .84rem; color: #334155; vertical-align: middle; }
            .sp-table tbody td strong { color: #1e293b; }
            .sp-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: .74rem; font-weight: 600; }
            .sp-badge.critico { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
            .sp-badge.normal { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
            .sp-actions { display: flex; gap: 6px; }
            .sp-actions button { background: none; border: 1px solid #e2e8f0; border-radius: 8px; width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all .2s; color: #64748b; }
            .sp-actions button:hover { background: #fffbeb; border-color: #f59e0b; color: #92400e; }
            .sp-actions button.del:hover { background: #fef2f2; border-color: #ef4444; color: #dc2626; }
            .sp-actions button svg { width: 16px; height: 16px; }
            .sp-empty { padding: 56px 20px; text-align: center; animation: spFadeUp .5s ease-out .25s both; }
            .sp-empty-circle { width: 72px; height: 72px; border-radius: 50%; background: linear-gradient(135deg,#f59e0b,#d97706); display: flex; align-items: center; justify-content: center; margin: 0 auto 18px; }
            .sp-empty-circle svg { width: 32px; height: 32px; color: #fff; }
            .sp-empty h4 { margin: 0 0 6px; font-size: 1.05rem; color: #1e293b; }
            .sp-empty p { margin: 0; font-size: .84rem; color: #94a3b8; }
        </style>

        <div class="sp-hero">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;">
                <div>
                    <h2>Repuestos</h2>
                    <p>Control de inventario de repuestos industriales</p>
                </div>
                <div class="sp-hero-btn">
                    <button onclick="App.modules.spareparts.showForm()">
                        <svg style="width:14px;height:14px;display:inline;vertical-align:-1px;margin-right:4px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Nuevo Repuesto
                    </button>
                </div>
            </div>
        </div>

        <div class="sp-stats">
            <div class="sp-stat">
                <div class="sp-stat-icon total">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                </div>
                <div class="sp-stat-info"><h4>${repuestos.length}</h4><p>Total repuestos</p></div>
            </div>
            <div class="sp-stat">
                <div class="sp-stat-icon critico">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </div>
                <div class="sp-stat-info"><h4>${criticos.length}</h4><p>Stock crítico</p></div>
            </div>
            <div class="sp-stat">
                <div class="sp-stat-icon normal">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <div class="sp-stat-info"><h4>${normales.length}</h4><p>Stock normal</p></div>
            </div>
        </div>

        <div class="sp-filter">
            <label>Filtrar:</label>
            <select id="filterCritico" onchange="App.modules.spareparts.render()">
                <option value="">Todos</option>
                <option value="critico" ${filterCritico === 'critico' ? 'selected' : ''}>Stock crítico</option>
                <option value="normal" ${filterCritico === 'normal' ? 'selected' : ''}>Stock normal</option>
            </select>
        </div>

        ${filtered.length === 0 ? `
        <div class="sp-empty">
            <div class="sp-empty-circle">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
            </div>
            <h4>No hay repuestos registrados</h4>
            <p>Comienza agregando repuestos al inventario</p>
        </div>
        ` : `
        <div class="sp-table-wrap">
            <table class="sp-table">
                <thead>
                    <tr>
                        <th>Código</th>
                        <th>Descripción</th>
                        <th>Componente</th>
                        <th>Stock Actual</th>
                        <th>Stock Mín.</th>
                        <th>Estado</th>
                        <th>Proveedor</th>
                        <th>Ubicación</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map(r => {
                        const critico = r.stock_actual <= r.stock_minimo;
                        return `<tr>
                            <td><strong>${r.codigo || '-'}</strong></td>
                            <td>${r.descripcion || '-'}</td>
                            <td>${r.componenteNombre}</td>
                            <td><strong>${r.stock_actual}</strong></td>
                            <td>${r.stock_minimo}</td>
                            <td>${critico ? '<span class="sp-badge critico">Crítico</span>' : '<span class="sp-badge normal">Normal</span>'}</td>
                            <td>${r.proveedor || '-'}</td>
                            <td>${r.ubicacion_bodega || '-'}</td>
                            <td class="sp-actions">
                                <button onclick="App.modules.spareparts.showForm(${r.id})" title="Editar">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </button>
                                <button class="del" onclick="App.modules.spareparts.delete(${r.id})" title="Eliminar">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                </button>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
        `}`;
    },

    async showForm(id) {
        const rep = id ? await db.getById('spare_parts', id) : null;
        const componentes = await db.getAll('components');
        App.showModal(`
            <div class="form-row">
                <div class="form-group"><label>Código *</label><input class="form-control" id="repCodigo" value="${rep ? rep.codigo : ''}" placeholder="Ej: ROD-001"></div>
                <div class="form-group"><label>Componente</label>
                    <select class="form-control" id="repComponente">
                        <option value="">Ninguno</option>
                        ${componentes.map(c => `<option value="${c.id}" ${rep && rep.componente_id === c.id ? 'selected' : ''}>${c.nombre}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-group"><label>Descripción *</label><input class="form-control" id="repDesc" value="${rep ? rep.descripcion : ''}"></div>
            <div class="form-row">
                <div class="form-group"><label>Stock Actual *</label><input type="number" class="form-control" id="repStockAct" value="${rep ? rep.stock_actual : 0}" min="0"></div>
                <div class="form-group"><label>Stock Mínimo *</label><input type="number" class="form-control" id="repStockMin" value="${rep ? rep.stock_minimo : 1}" min="0"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Proveedor</label><input class="form-control" id="repProveedor" value="${rep ? rep.proveedor || '' : ''}"></div>
                <div class="form-group"><label>Ubicación</label><input class="form-control" id="repUbicacion" value="${rep ? rep.ubicacion_bodega || '' : ''}"></div>
            </div>
        `, { title: rep ? 'Editar Repuesto' : 'Nuevo Repuesto', lg: true });
        const footer = document.querySelector('#modalOverlay .modal-footer');
        footer.innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.spareparts.save(${id || 0})">${rep ? 'Actualizar' : 'Guardar'}</button>
        `;
    },

    async save(id) {
        try {
            const data = {
                codigo: document.getElementById('repCodigo').value.trim().toUpperCase(),
                descripcion: App.capitalize(document.getElementById('repDesc').value.trim()),
                componente_id: document.getElementById('repComponente').value ? parseInt(document.getElementById('repComponente').value) : null,
                stock_actual: parseInt(document.getElementById('repStockAct').value) || 0,
                stock_minimo: parseInt(document.getElementById('repStockMin').value) || 0,
                proveedor: App.capitalize(document.getElementById('repProveedor').value.trim()),
                ubicacion_bodega: document.getElementById('repUbicacion').value.trim().toUpperCase()
            };
            if (!data.codigo || !data.descripcion) { App.showAlert('Código y descripción obligatorios', 'danger'); return; }
            if (id === 0) await db.insert('spare_parts', data);
            else await db.update('spare_parts', id, data);
            App.hideModal();
            App.showAlert(id === 0 ? 'Repuesto creado' : 'Repuesto actualizado');
            this.render();
        } catch(e) { App.showAlert('Error al guardar: ' + e.message, 'danger'); }
    },

    async delete(id) {
        try {
            const confirmed = await App.confirm('¿Eliminar este repuesto?');
            if (!confirmed) return;
            await db.delete('spare_parts', id);
            App.showAlert('Repuesto eliminado');
            this.render();
        } catch(e) { App.showAlert('Error al eliminar: ' + e.message, 'danger'); }
    }
});
