App.registerModule('machines', {
    async render() {
        const el = document.getElementById('page-machines');
        const maquinas = await db.getAll('machines');
        const tipos = await db.getAll('machine_types');
        const filterTipo = document.getElementById('filterTipoMaq')?.value || '';
        const filterEstado = document.getElementById('filterEstadoMaq')?.value || '';
        const searchTerm = (document.getElementById('searchMaquina')?.value || '').toLowerCase();
        let filtered = [...maquinas];
        if (filterTipo) filtered = filtered.filter(m => m.tipo_id === parseInt(filterTipo));
        if (filterEstado) filtered = filtered.filter(m => m.estado_operativo === filterEstado);
        if (searchTerm) filtered = filtered.filter(m => m.nombre.toLowerCase().includes(searchTerm) || (m.codigo || '').toLowerCase().includes(searchTerm));

        const total = maquinas.length;
        const operativos = maquinas.filter(m => m.estado_operativo === 'Operativo').length;
        const mantencion = maquinas.filter(m => m.estado_operativo === 'En mantención').length;
        const detenidos = maquinas.filter(m => m.estado_operativo === 'Detenido').length;

        let rows = '';
        for (const m of filtered) {
            const tipo = tipos.find(t => t.id === m.tipo_id);
            rows += '<tr class="mach-row">'
                + '<td><span style="font-family:\'JetBrains Mono\',monospace;font-size:12px;font-weight:700;color:#0f172a;background:#f0fdf4;padding:4px 10px;border-radius:6px;border:1px solid #bbf7d0">' + (m.codigo || '-') + '</span></td>'
                + '<td style="font-weight:600;color:#1e293b">' + m.nombre + '</td>'
                + '<td><span style="font-size:12px;color:#475569;background:#f1f5f9;padding:3px 10px;border-radius:20px;border:1px solid #e2e8f0">' + (tipo ? tipo.nombre : '-') + '</span></td>'
                + '<td style="color:#475569;font-size:13px">' + (m.marca || '-') + '</td>'
                + '<td style="color:#475569;font-size:13px">' + (m.ubicacion || '-') + '</td>'
                + '<td><span class="status-badge ' + App.getEstadoClass(m.estado_operativo) + '">' + m.estado_operativo + '</span></td>'
                + '<td style="text-align:center;white-space:nowrap">'
                + '<button class="mach-action-btn" onclick="App.modules.machines.showDetail(' + m.id + ')" title="Ver detalle"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>'
                + '<button class="mach-action-btn" style="color:#3b82f6" onclick="App.modules.machines.showForm(' + m.id + ')" title="Editar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>'
                + '<button class="mach-action-btn" style="color:#ef4444" onclick="App.modules.machines.delete(' + m.id + ')" title="Eliminar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>'
                + '</td></tr>';
        }

        el.innerHTML = '<style>'
            + '@keyframes machFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}'
            + '@keyframes machCountUp{from{opacity:0;transform:scale(0.8)}to{opacity:1;transform:scale(1)}}'
            + '.mach-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}'
            + '.mach-card:hover{transform:translateY(-3px);box-shadow:0 12px 28px rgba(0,0,0,0.12)!important}'
            + '.mach-row{transition:all 0.2s ease}'
            + '.mach-row:hover{transform:translateX(2px)!important;background:#f0fdf4!important}'
            + '.mach-section{animation:machFadeUp 0.5s ease both}'
            + '.mach-stat-num{animation:machCountUp 0.6s ease both}'
            + '.mach-action-btn{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;border:1px solid #e2e8f0;background:white;cursor:pointer;color:#64748b;transition:all 0.2s cubic-bezier(0.4,0,0.2,1);margin:0 2px}'
            + '.mach-action-btn:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,0.1);border-color:#bbf7d0;background:#f0fdf4}'
            + '.mach-filter-input{transition:all 0.2s ease}'
            + '.mach-filter-input:focus{box-shadow:0 0 0 3px rgba(34,197,94,0.15);border-color:#22c55e!important}'
            + '</style>'

            + '<div style="background:linear-gradient(135deg,#0f172a 0%,#065f46 50%,#047857 100%);border-radius:16px;padding:32px 36px;margin-bottom:28px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">'
            + '<div style="position:absolute;top:-40px;right:-40px;width:200px;height:200px;background:radial-gradient(circle,rgba(34,197,94,0.2) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="position:absolute;bottom:-60px;left:30%;width:300px;height:200px;background:radial-gradient(circle,rgba(16,185,129,0.15) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center">'
            + '<div><h2 style="margin:0;font-size:28px;font-weight:800;color:white;letter-spacing:-0.5px;text-shadow:0 2px 4px rgba(0,0,0,0.2)">Maquinas</h2>'
            + '<p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.7)">Registro y control de equipos industriales</p></div>'
            + '<div style="display:flex;gap:12px;align-items:center">'
            + '<div style="background:rgba(255,255,255,0.15);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:12px 20px;text-align:center">'
            + '<div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.5px">Operativas</div>'
            + '<div style="font-size:22px;font-weight:800;color:white;font-family:\'JetBrains Mono\',monospace">' + operativos + '</div></div>'
            + '<div style="background:rgba(255,255,255,0.15);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:12px 20px;text-align:center">'
            + '<div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.5px">Total</div>'
            + '<div style="font-size:22px;font-weight:800;color:white;font-family:\'JetBrains Mono\',monospace">' + total + '</div></div>'
            + '<button onclick="App.modules.machines.showForm()" style="background:rgba(255,255,255,0.15);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:12px 20px;color:white;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.2s ease;display:flex;align-items:center;gap:6px" onmouseover="this.style.background=\'rgba(255,255,255,0.25)\';this.style.transform=\'translateY(-1px)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.15)\';this.style.transform=\'none\'">'
            + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Nueva Maquina</button>'
            + '<button onclick="App.modules.machines.exportExcel()" style="background:rgba(255,255,255,0.15);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:12px 20px;color:white;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.2s ease;display:flex;align-items:center;gap:6px" onmouseover="this.style.background=\'rgba(255,255,255,0.25)\';this.style.transform=\'translateY(-1px)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.15)\';this.style.transform=\'none\'">'
            + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Exportar Excel</button>'
            + '</div></div></div>'

            + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px">'
            + '<div class="mach-card" style="background:white;border:1px solid #e2e8f0;border-radius:14px;padding:22px;border-left:4px solid #3b82f6;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:machFadeUp 0.5s ease 0ms both;position:relative;overflow:hidden">'
            + '<div style="position:absolute;top:-20px;right:-20px;width:80px;height:80px;background:#3b82f6;opacity:0.04;border-radius:50%"></div>'
            + '<div style="display:flex;align-items:flex-start;gap:16px;position:relative;z-index:1">'
            + '<div style="width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#3b82f615,#3b82f608);display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid #3b82f620"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></div>'
            + '<div><div class="mach-stat-num" style="font-size:30px;font-weight:800;color:#0f172a;font-family:\'JetBrains Mono\',monospace;line-height:1;animation-delay:200ms">' + total + '</div>'
            + '<div style="font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px">Total Maquinas</div>'
            + '<div style="font-size:11px;color:#94a3b8;margin-top:2px">Registradas en sistema</div></div></div></div>'

            + '<div class="mach-card" style="background:white;border:1px solid #e2e8f0;border-radius:14px;padding:22px;border-left:4px solid #22c55e;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:machFadeUp 0.5s ease 100ms both;position:relative;overflow:hidden">'
            + '<div style="position:absolute;top:-20px;right:-20px;width:80px;height:80px;background:#22c55e;opacity:0.04;border-radius:50%"></div>'
            + '<div style="display:flex;align-items:flex-start;gap:16px;position:relative;z-index:1">'
            + '<div style="width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#22c55e15,#22c55e08);display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid #22c55e20"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>'
            + '<div><div class="mach-stat-num" style="font-size:30px;font-weight:800;color:#0f172a;font-family:\'JetBrains Mono\',monospace;line-height:1;animation-delay:400ms">' + operativos + '</div>'
            + '<div style="font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px">Operativas</div>'
            + '<div style="font-size:11px;color:#94a3b8;margin-top:2px">En pleno funcionamiento</div></div></div></div>'

            + '<div class="mach-card" style="background:white;border:1px solid #e2e8f0;border-radius:14px;padding:22px;border-left:4px solid #f59e0b;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:machFadeUp 0.5s ease 200ms both;position:relative;overflow:hidden">'
            + '<div style="position:absolute;top:-20px;right:-20px;width:80px;height:80px;background:#f59e0b;opacity:0.04;border-radius:50%"></div>'
            + '<div style="display:flex;align-items:flex-start;gap:16px;position:relative;z-index:1">'
            + '<div style="width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#f59e0b15,#f59e0b08);display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid #f59e0b20"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></div>'
            + '<div><div class="mach-stat-num" style="font-size:30px;font-weight:800;color:#0f172a;font-family:\'JetBrains Mono\',monospace;line-height:1;animation-delay:600ms">' + mantencion + '</div>'
            + '<div style="font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px">En Mantencion</div>'
            + '<div style="font-size:11px;color:#94a3b8;margin-top:2px">En proceso de servicio</div></div></div></div>'

            + '<div class="mach-card" style="background:white;border:1px solid #e2e8f0;border-radius:14px;padding:22px;border-left:4px solid #ef4444;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:machFadeUp 0.5s ease 300ms both;position:relative;overflow:hidden">'
            + '<div style="position:absolute;top:-20px;right:-20px;width:80px;height:80px;background:#ef4444;opacity:0.04;border-radius:50%"></div>'
            + '<div style="display:flex;align-items:flex-start;gap:16px;position:relative;z-index:1">'
            + '<div style="width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#ef444415,#ef444408);display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid #ef444420"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>'
            + '<div><div class="mach-stat-num" style="font-size:30px;font-weight:800;color:#0f172a;font-family:\'JetBrains Mono\',monospace;line-height:1;animation-delay:800ms">' + detenidos + '</div>'
            + '<div style="font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px">Detenidas</div>'
            + '<div style="font-size:11px;color:#94a3b8;margin-top:2px">Fuera de operacion</div></div></div></div>'

            + '</div>'

            + '<div class="mach-section" style="background:white;border:1px solid #e2e8f0;border-radius:14px;padding:20px 24px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:machFadeUp 0.5s ease 400ms both">'
            + '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">'
            + '<div style="display:flex;align-items:center;gap:8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:0 14px;height:42px;flex:1;min-width:200px;max-width:320px">'
            + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
            + '<input type="text" id="searchMaquina" class="mach-filter-input" placeholder="Buscar por nombre o codigo..." value="' + searchTerm + '" oninput="App.modules.machines.render()" style="border:none;background:transparent;outline:none;font-size:13px;color:#1e293b;width:100%;padding:0">'
            + '</div>'
            + '<select id="filterTipoMaq" class="mach-filter-input" onchange="App.modules.machines.render()" style="border:1px solid #e2e8f0;border-radius:10px;padding:0 14px;height:42px;font-size:13px;color:#475569;background:white;min-width:160px;outline:none">'
            + '<option value="">Todos los tipos</option>'
            + tipos.map(function(t) { return '<option value="' + t.id + '"' + (filterTipo === String(t.id) ? ' selected' : '') + '>' + t.nombre + '</option>'; }).join('')
            + '</select>'
            + '<select id="filterEstadoMaq" class="mach-filter-input" onchange="App.modules.machines.render()" style="border:1px solid #e2e8f0;border-radius:10px;padding:0 14px;height:42px;font-size:13px;color:#475569;background:white;min-width:150px;outline:none">'
            + '<option value="">Todos los estados</option>'
            + '<option value="Operativo"' + (filterEstado === 'Operativo' ? ' selected' : '') + '>Operativo</option>'
            + '<option value="En mantencion"' + (filterEstado === 'En mantención' ? ' selected' : '') + '>En mantencion</option>'
            + '<option value="Detenido"' + (filterEstado === 'Detenido' ? ' selected' : '') + '>Detenido</option>'
            + '</select>'
            + '<span style="margin-left:auto;font-size:12px;font-weight:700;color:#64748b;background:#f1f5f9;padding:6px 14px;border-radius:20px;font-family:\'JetBrains Mono\',monospace">' + filtered.length + ' de ' + total + '</span>'
            + '</div></div>'

            + '<div class="mach-section" style="background:white;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:machFadeUp 0.5s ease 500ms both">'
            + (filtered.length === 0
                ? '<div style="text-align:center;padding:64px 20px">'
                + '<div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#f0fdf4,#bbf7d0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 4px 12px rgba(34,197,94,0.2)"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="1.5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></div>'
                + '<div style="font-size:16px;font-weight:700;color:#1e293b;margin-bottom:6px">No se encontraron maquinas</div>'
                + '<div style="color:#94a3b8;font-size:13px;margin-bottom:20px">Ajusta los filtros o agrega una nueva maquina</div>'
                + '<button onclick="App.modules.machines.showForm()" style="background:#22c55e;color:white;border:none;padding:10px 24px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(34,197,94,0.3);transition:all 0.2s ease" onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'none\'">+ Nueva Maquina</button></div>'
                : '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">'
                + '<thead><tr style="background:#f0fdf4;border-bottom:1px solid #bbf7d0">'
                + '<th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.5px">Codigo</th>'
                + '<th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.5px">Nombre</th>'
                + '<th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.5px">Tipo</th>'
                + '<th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.5px">Marca</th>'
                + '<th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.5px">Ubicacion</th>'
                + '<th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.5px">Estado</th>'
                + '<th style="padding:12px 16px;text-align:center;font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.5px">Acciones</th>'
                + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
            )
            + '</div>';
    },

    async showForm(id) {
        const maq = id ? await db.getById('machines', id) : null;
        const tipos = await db.getAll('machine_types');
        const tipoId = maq ? maq.tipo_id : null;
        let compsHtml = '<span class="text-muted">Cargando componentes...</span>';
        App.showModal(`
            <div class="form-row">
                <div class="form-group"><label>Código *</label><input class="form-control" id="maqCodigo" value="${maq ? maq.codigo : ''}" placeholder="Ej: COM-001"></div>
                <div class="form-group"><label>Nombre *</label><input class="form-control" id="maqNombre" value="${maq ? maq.nombre : ''}" placeholder="Nombre del equipo"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Tipo *</label>
                    <select class="form-control" id="maqTipo" onchange="App.modules.machines.onTipoChange()">
                        <option value="">Seleccionar...</option>
                        ${tipos.map(t => `<option value="${t.id}" ${maq && maq.tipo_id === t.id ? 'selected' : ''}>${t.nombre}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group"><label>Estado</label>
                    <select class="form-control" id="maqEstado">
                        <option value="Operativo" ${maq && maq.estado_operativo === 'Operativo' ? 'selected' : ''}>Operativo</option>
                        <option value="En mantención" ${maq && maq.estado_operativo === 'En mantención' ? 'selected' : ''}>En mantención</option>
                        <option value="Detenido" ${maq && maq.estado_operativo === 'Detenido' ? 'selected' : ''}>Detenido</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Marca</label><input class="form-control" id="maqMarca" value="${maq ? maq.marca || '' : ''}"></div>
                <div class="form-group"><label>Modelo</label><input class="form-control" id="maqModelo" value="${maq ? maq.modelo || '' : ''}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Serie</label><input class="form-control" id="maqSerie" value="${maq ? maq.numero_serie || '' : ''}"></div>
                <div class="form-group"><label>Fecha Compra</label><input type="date" class="form-control" id="maqFechaCompra" value="${maq ? maq.fecha_compra || '' : ''}"></div>
            </div>
            <div class="form-group"><label>Ubicación</label><input class="form-control" id="maqUbicacion" value="${maq ? maq.ubicacion || '' : ''}"></div>
            <div class="form-group"><label>Observaciones</label><textarea class="form-control" id="maqObs">${maq ? maq.observaciones || '' : ''}</textarea></div>
            <div class="form-group"><label>Componentes asociados</label><div id="componentesPreview">${compsHtml}</div></div>
        `, { title: maq ? 'Editar Máquina' : 'Nueva Máquina', lg: true });
        const footer = document.querySelector('#modalOverlay .modal-footer');
        footer.innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.machines.save(${id || 0})">${maq ? 'Actualizar' : 'Guardar'}</button>
        `;
        if (tipoId) {
            try {
                const html = await this.renderComponentesCheckboxes(tipoId, id || null);
                const el = document.getElementById('componentesPreview');
                if (el) el.innerHTML = html;
            } catch(e) { console.error('Error loading components:', e); }
        } else {
            const el = document.getElementById('componentesPreview');
            if (el) el.innerHTML = '<span class="text-muted">Seleccione un tipo para ver sus componentes</span>';
        }
    },

    async onTipoChange() {
        const tipoId = parseInt(document.getElementById('maqTipo').value);
        const preview = document.getElementById('componentesPreview');
        if (!tipoId) { preview.innerHTML = '<span class="text-muted">Seleccione un tipo</span>'; return; }
        preview.innerHTML = await this.renderComponentesCheckboxes(tipoId, null);
    },

    async renderComponentesCheckboxes(tipoId, maquinaId) {
        if (!tipoId) return '<span class="text-muted">Seleccione un tipo</span>';
        const comps = await db.getComponentsByType(tipoId);
        if (comps.length === 0) return '<span class="text-muted">Sin componentes definidos</span>';
        let selectedIds = comps.map(c => c.id);
        if (maquinaId) {
            try {
                const saved = await db.getMachineComponents(maquinaId);
                if (saved && saved.length > 0) selectedIds = saved;
            } catch(e) { }
        }
        return `<div style="display:flex;flex-wrap:wrap;gap:8px">${comps.map(c => `
            <label style="display:flex;align-items:center;gap:4px;cursor:pointer;background:#f5f5f5;padding:4px 8px;border-radius:4px;font-size:12px">
                <input type="checkbox" class="maq-comp-check" value="${c.id}" ${selectedIds.includes(c.id) ? 'checked' : ''}> ${c.nombre}
            </label>
        `).join('')}</div>`;
    },

    async save(id) {
        try {
            const data = {
                codigo: document.getElementById('maqCodigo').value.trim().toUpperCase(),
                nombre: App.capitalize(document.getElementById('maqNombre').value.trim()),
                tipo_id: document.getElementById('maqTipo').value ? parseInt(document.getElementById('maqTipo').value) : null,
                marca: App.capitalize(document.getElementById('maqMarca').value.trim()),
                modelo: document.getElementById('maqModelo').value.trim().toUpperCase(),
                numero_serie: document.getElementById('maqSerie').value.trim().toUpperCase(),
                ubicacion: App.capitalize(document.getElementById('maqUbicacion').value.trim()),
                fecha_compra: document.getElementById('maqFechaCompra').value,
                estado_operativo: document.getElementById('maqEstado').value,
                observaciones: App.capitalize(document.getElementById('maqObs').value.trim())
            };
            if (!data.codigo || !data.nombre || !data.tipo_id) {
                App.showAlert('Código, nombre y tipo son obligatorios', 'danger'); return;
            }
            const existing = await db.getAll('machines');
            const duplicate = existing.find(m => m.codigo === data.codigo && m.id !== id);
            if (duplicate) {
                App.showAlert('Ya existe una máquina con el código: ' + data.codigo, 'danger'); return;
            }
            let machineId = id;
            if (id === 0) {
                const result = await db.insert('machines', data);
                machineId = result.id;
            } else {
                await db.update('machines', id, data);
            }
            const checkboxes = document.querySelectorAll('.maq-comp-check');
            const selectedComps = Array.from(checkboxes).filter(cb => cb.checked).map(cb => parseInt(cb.value));
            await db.saveMachineComponents(machineId, selectedComps);
            App.hideModal();
            App.showAlert(id === 0 ? 'Máquina creada' : 'Máquina actualizada');
            this.render();
        } catch(e) { App.showAlert('Error al guardar: ' + e.message, 'danger'); }
    },

    async showDetail(id) {
        const info = await db.getMachineWithDetails(id);
        if (!info) return;
        const { maquina, tipo, componentes, preventivos, correctivos } = info;
        let prevRows = '', corrRows = '';
        for (const p of preventivos) {
            const comp = await db.getById('components', p.componente_id).catch(() => null);
            prevRows += `<tr><td>${comp ? comp.nombre : '-'}</td><td>${App.formatDate(p.fecha_programada)}</td><td><span class="status-badge ${App.getEstadoClass(p.estado)}">${p.estado}</span></td></tr>`;
        }
        for (const c of correctivos) {
            const comp = await db.getById('components', c.componente_id).catch(() => null);
            corrRows += `<tr><td>${comp ? comp.nombre : '-'}</td><td>${App.formatDate(c.fecha_falla)}</td><td>${c.descripcion_falla}</td><td>${c.horas_detencion}</td></tr>`;
        }
        App.showModal(`
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
                <div><strong>Código:</strong> ${maquina.codigo}</div>
                <div><strong>Estado:</strong> <span class="status-badge ${App.getEstadoClass(maquina.estado_operativo)}">${maquina.estado_operativo}</span></div>
                <div><strong>Nombre:</strong> ${maquina.nombre}</div>
                <div><strong>Tipo:</strong> ${tipo ? tipo.nombre : '-'}</div>
                <div><strong>Marca:</strong> ${maquina.marca || '-'}</div>
                <div><strong>Modelo:</strong> ${maquina.modelo || '-'}</div>
                <div><strong>Serie:</strong> ${maquina.numero_serie || '-'}</div>
                <div><strong>Ubicación:</strong> ${maquina.ubicacion || '-'}</div>
                <div><strong>Fecha Compra:</strong> ${App.formatDate(maquina.fecha_compra)}</div>
            </div>
            <h4 style="margin:16px 0 8px">Componentes</h4>
            <div>${componentes.map(c => `<span class="status-badge status-programada">${c.nombre}</span>`).join(' ') || 'Ninguno'}</div>
            <h4 style="margin:16px 0 8px">Preventivos (${preventivos.length})</h4>
            ${preventivos.length === 0 ? '<p class="text-muted">Sin registros</p>' : `<table><thead><tr><th>Componente</th><th>Fecha Prog.</th><th>Estado</th></tr></thead><tbody>${prevRows}</tbody></table>`}
            <h4 style="margin:16px 0 8px">Fallas (${correctivos.length})</h4>
            ${correctivos.length === 0 ? '<p class="text-muted">Sin registros</p>' : `<table><thead><tr><th>Componente</th><th>Fecha</th><th>Falla</th><th>Horas Det.</th></tr></thead><tbody>${corrRows}</tbody></table>`}
        `, { title: `Ficha: ${maquina.nombre}`, lg: true });
        const footer = document.querySelector('#modalOverlay .modal-footer');
        footer.innerHTML = `<button class="btn btn-outline" onclick="App.hideModal()">Cerrar</button>`;
    },

    async delete(id) {
        try {
            const preventivos = await db.query('preventive_maintenance', p => p.maquina_id === id);
            const correctivos = await db.query('corrective_maintenance', c => c.maquina_id === id);
            if (preventivos.length > 0 || correctivos.length > 0) {
                App.showAlert('No se puede eliminar: tiene registros de mantenimiento', 'danger'); return;
            }
            const confirmed = await App.confirm('¿Eliminar esta máquina?');
            if (!confirmed) return;
            await db.delete('machines', id);
            App.showAlert('Máquina eliminada');
            this.render();
        } catch(e) { App.showAlert('Error al eliminar: ' + e.message, 'danger'); }
    },

    async exportExcel() {
        try {
            const maquinas = await db.getAll('machines');
            const tipos = await db.getAll('machine_types');
            const rows = maquinas.map(m => {
                const tipo = tipos.find(t => t.id === m.tipo_id);
                return {
                    'Codigo': m.codigo || '',
                    'Nombre': m.nombre || '',
                    'Tipo': tipo ? tipo.nombre : '',
                    'Marca': m.marca || '',
                    'Modelo': m.modelo || '',
                    'Ubicacion': m.ubicacion || '',
                    'Estado': m.estado_operativo || '',
                    'Descripcion': m.descripcion || ''
                };
            });
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Maquinas');
            XLSX.writeFile(wb, 'Maquinas_VitroFlow.xlsx');
            App.showAlert('Excel exportado correctamente');
        } catch(e) { App.showAlert('Error al exportar: ' + e.message, 'danger'); }
    }
});
