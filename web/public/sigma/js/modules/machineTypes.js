App.registerModule('machineTypes', {
    async render() {
        const el = document.getElementById('page-machineTypes');
        const data = await fetch('/api/sigma/machine-types-data').then(r => r.json()).catch(() => ({ tipos: [], componentes: [], links: [], maquinas: [] }));
        const tipos = data.tipos || [];
        const allComps = data.componentes || [];
        const links = data.links || [];
        const allMaqs = data.maquinas || [];

        const linksByTipo = {};
        links.forEach(l => {
            if (!linksByTipo[l.tipo_id]) linksByTipo[l.tipo_id] = new Set();
            linksByTipo[l.tipo_id].add(l.componente_id);
        });
        const maqsByTipo = {};
        allMaqs.forEach(m => {
            if (!maqsByTipo[m.tipo_id]) maqsByTipo[m.tipo_id] = 0;
            maqsByTipo[m.tipo_id]++;
        });
        const compMap = {};
        allComps.forEach(c => { compMap[c.id] = c; });

        const totalTipos = tipos.length;
        const totalMaqs = allMaqs.length;
        const totalComps = allComps.length;
        const totalLinks = links.length;

        let rows = tipos.map(t => {
            const compIds = linksByTipo[t.id] ? Array.from(linksByTipo[t.id]) : [];
            const comps = compIds.map(id => compMap[id]).filter(Boolean);
            const maqsCount = maqsByTipo[t.id] || 0;
            return `<tr>
                <td style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#6b7280">${t.id}</td>
                <td><strong style="color:#1f2937">${t.nombre}</strong></td>
                <td>${comps.map(c => `<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:500;background:#fef3c7;color:#92400e;margin:1px 2px">${c.nombre}</span>`).join(' ') || '<span style="color:#9ca3af;font-style:italic">Sin componentes</span>'}</td>
                <td style="font-family:'JetBrains Mono',monospace;font-weight:600;color:#92400e">${maqsCount}</td>
                <td>
                    <button onclick="App.modules.machineTypes.showForm(${t.id})" style="background:none;border:none;cursor:pointer;padding:4px;border-radius:4px;transition:all .2s" onmouseover="this.style.background='#fef3c7';this.style.transform='scale(1.1)'" onmouseout="this.style.background='none';this.style.transform='scale(1)'" title="Editar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onclick="App.modules.machineTypes.delete(${t.id})" style="background:none;border:none;cursor:pointer;padding:4px;border-radius:4px;transition:all .2s" onmouseover="this.style.background='#fee2e2';this.style.transform='scale(1.1)'" onmouseout="this.style.background='none';this.style.transform='scale(1)'" title="Eliminar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                </td>
            </tr>`;
        }).join('');

        el.innerHTML = `
        <style>
            @keyframes typeFadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
            .type-card { transition: transform 0.2s, box-shadow 0.2s; }
            .type-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(180,83,9,0.13); }
            .type-row { transition: transform 0.15s; }
            .type-row:hover { transform: translateX(2px); }
        </style>

        <div style="background:linear-gradient(135deg,#0f172a 0%,#78350f 50%,#92400e 100%);border-radius:16px;padding:32px 36px;margin-bottom:28px;position:relative;overflow:hidden;animation:typeFadeUp .5s ease">
            <div style="position:absolute;top:-30px;right:-30px;width:120px;height:120px;background:radial-gradient(circle,rgba(251,191,36,0.15) 0%,transparent 70%);border-radius:50%"></div>
            <div style="position:absolute;bottom:-20px;left:40%;width:80px;height:80px;background:radial-gradient(circle,rgba(251,191,36,0.1) 0%,transparent 70%);border-radius:50%"></div>
            <div style="display:flex;justify-content:space-between;align-items:center;position:relative;z-index:1">
                <div>
                    <h2 style="margin:0 0 6px 0;color:#fff;font-size:24px;font-weight:700;letter-spacing:-0.3px">Tipos de Área</h2>
                    <div style="color:#fbbf24;font-size:13px;font-weight:500">Catálogo de clasificación de equipos</div>
                </div>
                <button onclick="App.modules.machineTypes.showForm()" style="background:#f59e0b;color:#1f2937;border:none;padding:10px 20px;border-radius:10px;font-weight:600;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all .2s;box-shadow:0 2px 8px rgba(245,158,11,0.3)" onmouseover="this.style.background='#fbbf24';this.style.transform='translateY(-1px)'" onmouseout="this.style.background='#f59e0b';this.style.transform='translateY(0)'">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1f2937" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nuevo Tipo
                </button>
            </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px">
            <div class="type-card" style="background:#fff;border-radius:12px;padding:20px;border-left:4px solid #f59e0b;box-shadow:0 1px 3px rgba(0,0,0,0.06);animation:typeFadeUp .5s ease">
                <div style="display:flex;align-items:center;gap:12px">
                    <div style="width:42px;height:42px;border-radius:10px;background:linear-gradient(135deg,#fef3c7,#fde68a);display:flex;align-items:center;justify-content:center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    </div>
                    <div>
                        <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Tipos</div>
                        <div style="font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:700;color:#1f2937">${totalTipos}</div>
                    </div>
                </div>
            </div>
            <div class="type-card" style="background:#fff;border-radius:12px;padding:20px;border-left:4px solid #3b82f6;box-shadow:0 1px 3px rgba(0,0,0,0.06);animation:typeFadeUp .6s ease">
                <div style="display:flex;align-items:center;gap:12px">
                    <div style="width:42px;height:42px;border-radius:10px;background:linear-gradient(135deg,#dbeafe,#bfdbfe);display:flex;align-items:center;justify-content:center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                    </div>
                    <div>
                        <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Máquinas</div>
                        <div style="font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:700;color:#1f2937">${totalMaqs}</div>
                    </div>
                </div>
            </div>
            <div class="type-card" style="background:#fff;border-radius:12px;padding:20px;border-left:4px solid #10b981;box-shadow:0 1px 3px rgba(0,0,0,0.06);animation:typeFadeUp .7s ease">
                <div style="display:flex;align-items:center;gap:12px">
                    <div style="width:42px;height:42px;border-radius:10px;background:linear-gradient(135deg,#d1fae5,#a7f3d0);display:flex;align-items:center;justify-content:center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    </div>
                    <div>
                        <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Componentes</div>
                        <div style="font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:700;color:#1f2937">${totalComps}</div>
                    </div>
                </div>
            </div>
            <div class="type-card" style="background:#fff;border-radius:12px;padding:20px;border-left:4px solid #8b5cf6;box-shadow:0 1px 3px rgba(0,0,0,0.06);animation:typeFadeUp .8s ease">
                <div style="display:flex;align-items:center;gap:12px">
                    <div style="width:42px;height:42px;border-radius:10px;background:linear-gradient(135deg,#ede9fe,#ddd6fe);display:flex;align-items:center;justify-content:center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    </div>
                    <div>
                        <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Vínculos</div>
                        <div style="font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:700;color:#1f2937">${totalLinks}</div>
                    </div>
                </div>
            </div>
        </div>

        <div style="background:#fff;border-radius:12px;padding:20px 24px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,0.06);animation:typeFadeUp .5s ease">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                <span style="font-size:13px;font-weight:600;color:#92400e">Filtros</span>
            </div>
            <div style="display:flex;gap:12px;flex-wrap:wrap">
                <input type="text" id="tipoSearch" placeholder="Buscar por nombre..." style="flex:1;min-width:200px;padding:8px 14px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;transition:border-color .2s" onfocus="this.style.borderColor='#f59e0b'" onblur="this.style.borderColor='#e5e7eb'" />
                <select id="tipoFilterComp" style="padding:8px 14px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;color:#6b7280;background:#fff;outline:none;cursor:pointer;transition:border-color .2s" onfocus="this.style.borderColor='#f59e0b'" onblur="this.style.borderColor='#e5e7eb'">
                    <option value="">Todos los componentes</option>
                    ${allComps.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}
                </select>
            </div>
        </div>

        <div style="background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.06);overflow:hidden;animation:typeFadeUp .6s ease">
            ${tipos.length === 0 ? `
            <div style="padding:60px 20px;text-align:center">
                <div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#fef3c7,#fde68a);display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                </div>
                <h4 style="margin:0 0 6px;color:#374151;font-size:16px">No hay tipos registrados</h4>
                <p style="margin:0;color:#9ca3af;font-size:13px">Crea el primer tipo de área para clasificar tus equipos</p>
            </div>` : `
            <table style="width:100%;border-collapse:collapse;font-size:13px">
                <thead>
                    <tr style="background:#fffbeb;border-bottom:1px solid #fde68a">
                        <th style="padding:12px 16px;text-align:left;color:#92400e;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.5px">ID</th>
                        <th style="padding:12px 16px;text-align:left;color:#92400e;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.5px">Nombre</th>
                        <th style="padding:12px 16px;text-align:left;color:#92400e;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.5px">Componentes</th>
                        <th style="padding:12px 16px;text-align:left;color:#92400e;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.5px">Máquinas</th>
                        <th style="padding:12px 16px;text-align:left;color:#92400e;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.5px">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${tipos.map((t, i) => {
                        const compIds = linksByTipo[t.id] ? Array.from(linksByTipo[t.id]) : [];
                        const comps = compIds.map(id => compMap[id]).filter(Boolean);
                        const maqsCount = maqsByTipo[t.id] || 0;
                        const bg = i % 2 === 0 ? '#ffffff' : '#fefce8';
                        return `<tr class="type-row" style="background:${bg};border-bottom:1px solid #f3f4f6;transition:all .15s">
                            <td style="padding:12px 16px;font-family:'JetBrains Mono',monospace;font-size:12px;color:#6b7280">${t.id}</td>
                            <td style="padding:12px 16px"><strong style="color:#1f2937">${t.nombre}</strong></td>
                            <td style="padding:12px 16px">${comps.map(c => `<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:500;background:#fef3c7;color:#92400e;margin:1px 2px">${c.nombre}</span>`).join(' ') || '<span style="color:#9ca3af;font-style:italic">Sin componentes</span>'}</td>
                            <td style="padding:12px 16px;font-family:'JetBrains Mono',monospace;font-weight:600;color:#92400e">${maqsCount}</td>
                            <td style="padding:12px 16px">
                                <button onclick="App.modules.machineTypes.showForm(${t.id})" style="background:none;border:none;cursor:pointer;padding:4px;border-radius:4px;transition:all .2s" onmouseover="this.style.background='#fef3c7';this.style.transform='scale(1.1)'" onmouseout="this.style.background='none';this.style.transform='scale(1)'" title="Editar">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </button>
                                <button onclick="App.modules.machineTypes.delete(${t.id})" style="background:none;border:none;cursor:pointer;padding:4px;border-radius:4px;transition:all .2s" onmouseover="this.style.background='#fee2e2';this.style.transform='scale(1.1)'" onmouseout="this.style.background='none';this.style.transform='scale(1)'" title="Eliminar">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                </button>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>`}
        </div>`;
    },

    async showForm(id) {
        const tipo = id ? await db.getById('machine_types', id) : null;
        const componentes = (await db.getAll('components')).sort((a, b) => a.nombre.localeCompare(b.nombre));
        const links = id ? (await db.query('component_type_links', l => l.tipo_id === id)).filter((l, i, a) => a.findIndex(x => x.componente_id === l.componente_id) === i) : [];
        const selectedCompIds = links.map(l => l.componente_id);
        App.showModal(`
            <div class="form-group">
                <label>Nombre del Tipo de Área</label>
                <input class="form-control" id="tipoNombre" value="${tipo ? tipo.nombre : ''}" placeholder="Ej: Corte, Pulido, Mecanizado...">
            </div>
            <div class="form-group">
                <label>Componentes asociados</label>
                <div style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;padding:8px">
                    ${componentes.map(c => `<label style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer">
                        <input type="checkbox" class="comp-check" value="${c.id}" ${selectedCompIds.includes(c.id) ? 'checked' : ''}>
                        <span>${c.nombre}</span>
                    </label>`).join('')}
                </div>
            </div>
        `, { title: tipo ? 'Editar Tipo de Área' : 'Nuevo Tipo de Área' });
        const footer = document.querySelector('#modalOverlay .modal-footer');
        footer.innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.machineTypes.save(${id || 0})">${tipo ? 'Actualizar' : 'Guardar'}</button>
        `;
    },

    async save(id) {
        try {
            const nombre = App.capitalize(document.getElementById('tipoNombre').value.trim());
            if (!nombre) { App.showAlert('Debe ingresar un nombre', 'danger'); return; }
            const selected = Array.from(document.querySelectorAll('.comp-check:checked')).map(c => parseInt(c.value));
            if (id === 0) {
                const tipo = await db.insert('machine_types', { nombre });
                for (const compId of selected) {
                    await db.insert('component_type_links', { tipo_id: tipo.id, componente_id: compId });
                }
            } else {
                await db.update('machine_types', id, { nombre });
                const existing = await db.query('component_type_links', l => l.tipo_id === id);
                for (const l of existing) await db.delete('component_type_links', l.id);
                for (const compId of selected) {
                    await db.insert('component_type_links', { tipo_id: id, componente_id: compId });
                }
            }
            App.hideModal();
            App.showAlert(id === 0 ? 'Tipo creado exitosamente' : 'Tipo actualizado exitosamente');
            this.render();
        } catch(e) { App.showAlert('Error al guardar: ' + e.message, 'danger'); }
    },

    async delete(id) {
        try {
            const maqs = await db.query('machines', m => m.tipo_id === id);
            if (maqs.length > 0) { App.showAlert('No se puede eliminar: hay máquinas asociadas', 'danger'); return; }
            const confirmed = await App.confirm('¿Eliminar este tipo de máquina?');
            if (!confirmed) return;
            const links = await db.query('component_type_links', l => l.tipo_id === id);
            for (const l of links) await db.delete('component_type_links', l.id);
            await db.delete('machine_types', id);
            App.showAlert('Tipo eliminado');
            this.render();
        } catch(e) { App.showAlert('Error al eliminar: ' + e.message, 'danger'); }
    }
});