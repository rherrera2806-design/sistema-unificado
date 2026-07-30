App.registerModule('preventive', {
    async render() {
        const el = document.getElementById('page-preventive');
        const filterEstado = document.getElementById('filterPrevEstado')?.value || 'activas';
        const filterMaquina = document.getElementById('filterPrevMaq')?.value || '';

        const data = await fetch('/api/sigma/preventive-data').then(r => r.json()).catch(() => ({ preventivos: [], maquinas: [], componentes: [] }));
        const registros = data.preventivos || [];
        const maquinas = data.maquinas || [];
        const maqMap = {};
        (data.maquinas || []).forEach(m => { maqMap[m.id] = m; });
        const compMap = {};
        (data.componentes || []).forEach(c => { compMap[c.id] = c; });

        let filtered = registros.map(r => ({
            ...r,
            maquinaNombre: maqMap[r.maquina_id] ? maqMap[r.maquina_id].nombre : '',
            componenteNombre: compMap[r.componente_id] ? compMap[r.componente_id].nombre : ''
        }));
        
        if (filterEstado === 'activas') {
            filtered = filtered.filter(r => r.estado === 'Programada' || r.estado === 'Vencida');
        } else if (filterEstado) {
            filtered = filtered.filter(r => r.estado === filterEstado);
        }
        
        if (filterMaquina) filtered = filtered.filter(r => r.maquina_id === parseInt(filterMaquina));
        
        filtered.sort((a, b) => {
            const dateA = a.fecha_programada ? new Date(a.fecha_programada + 'T00:00:00') : new Date(0);
            const dateB = b.fecha_programada ? new Date(b.fecha_programada + 'T00:00:00') : new Date(0);
            return dateA - dateB;
        });
        
        const today = new Date().toISOString().split('T')[0];
        const total = registros.length;
        const programadas = registros.filter(r => r.estado === 'Programada').length;
        const realizadas = registros.filter(r => r.estado === 'Realizada').length;
        const vencidas = registros.filter(r => r.estado !== 'Realizada' && r.fecha_programada && r.fecha_programada < today).length;

        let tableHtml;
        if (filtered.length === 0) {
            tableHtml = '<tr><td colspan="10" style="text-align:center;padding:56px 20px">'
                + '<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#eff6ff,#bfdbfe);display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px;box-shadow:0 4px 12px rgba(59,130,246,0.15)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>'
                + '<div style="font-size:15px;font-weight:600;color:#0f172a;margin-bottom:4px">No hay registros</div>'
                + '<div style="color:#94a3b8;font-size:13px">Programa la primera mantencion preventiva</div></td></tr>';
        } else {
            tableHtml = filtered.map(r => {
                const dias = r.fecha_programada && r.fecha_ejecutada ? Math.round((new Date(r.fecha_ejecutada) - new Date(r.fecha_programada)) / 86400000) : '-';
                const isVencida = r.estado !== 'Realizada' && r.fecha_programada && r.fecha_programada < today;
                const displayEstado = isVencida ? 'Vencida' : r.estado;
                const checklistPreview = r.checklist ? r.checklist.split('\n').slice(0, 2).join(', ').substring(0, 40) + (r.checklist.length > 40 ? '...' : '') : '-';
                const badgeColor = displayEstado === 'Realizada' ? { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' }
                    : displayEstado === 'Vencida' ? { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' }
                    : { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' };
                const rowBg = isVencida ? 'background:#fef2f2;' : '';
                return '<tr style="border-bottom:1px solid #f1f5f9;transition:all 0.2s;' + rowBg + '" onmouseover="this.style.transform=\'translateX(2px)\'" onmouseout="this.style.transform=\'none\'">'
                    + '<td style="padding:11px 14px;font-weight:600;color:#0f172a">' + r.maquinaNombre + '</td>'
                    + '<td style="padding:11px 14px;color:#475569">' + r.componenteNombre + '</td>'
                    + '<td style="padding:11px 14px;font-size:12px;color:#64748b;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + (r.checklist || '').replace(/"/g, '&quot;') + '">' + checklistPreview + '</td>'
                    + '<td style="padding:11px 14px"><span style="font-family:\'JetBrains Mono\',monospace;font-size:12px;color:#64748b">' + App.formatDate(r.fecha_programada) + '</span></td>'
                    + '<td style="padding:11px 14px"><span style="font-family:\'JetBrains Mono\',monospace;font-size:12px;color:#64748b">' + App.formatDate(r.fecha_ejecutada) + '</span></td>'
                    + '<td style="padding:11px 14px;font-family:\'JetBrains Mono\',monospace;font-size:12px;color:#64748b;text-align:center">' + dias + '</td>'
                    + '<td style="padding:11px 14px;font-family:\'JetBrains Mono\',monospace;font-size:12px;color:#64748b;text-align:center">' + (r.horas_ocupadas || 0) + '</td>'
                    + '<td style="padding:11px 14px;color:#475569">' + (r.tecnico || 'Pendiente') + '</td>'
                    + '<td style="padding:11px 14px"><span style="font-size:11px;font-weight:600;padding:4px 12px;border-radius:20px;background:' + badgeColor.bg + ';color:' + badgeColor.color + ';border:1px solid ' + badgeColor.border + '">' + displayEstado + '</span></td>'
                    + '<td style="padding:11px 14px;text-align:center;white-space:nowrap">'
                    + '<button onclick="App.modules.preventive.showForm(' + r.id + ')" style="background:white;color:#64748b;border:1px solid #e2e8f0;padding:5px 10px;border-radius:6px;font-size:12px;cursor:pointer;transition:all 0.15s" onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'white\'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button> '
                    + '<button onclick="App.modules.preventive.delete(' + r.id + ')" style="background:white;color:#dc2626;border:1px solid #fecaca;padding:5px 10px;border-radius:6px;font-size:12px;cursor:pointer;transition:all 0.15s" onmouseover="this.style.background=\'#fef2f2\'" onmouseout="this.style.background=\'white\'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>'
                    + '</td></tr>';
            }).join('');
        }

        const maqOpts = '<option value="">Todas las maquinas</option>' + maquinas.map(m => '<option value="' + m.id + '"' + (filterMaquina === String(m.id) ? ' selected' : '') + '>' + m.nombre + '</option>').join('');

        el.innerHTML = '<style>'
            + '@keyframes prevFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}'
            + '.prev-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}'
            + '.prev-card:hover{transform:translateY(-3px)!important;box-shadow:0 12px 28px rgba(0,0,0,0.12)!important}'
            + '</style>'
            + '<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:32px 36px;margin-bottom:28px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">'
            + '<div style="position:absolute;top:-40px;right:-40px;width:200px;height:200px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="position:absolute;bottom:-60px;left:30%;width:300px;height:200px;background:radial-gradient(circle,rgba(139,92,246,0.15) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center">'
            + '<div><h2 style="margin:0;font-size:28px;font-weight:800;color:white;letter-spacing:-0.5px;text-shadow:0 2px 4px rgba(0,0,0,0.2)">Mantencion Preventiva</h2>'
            + '<p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.7)">Programacion y control de mantenciones periodicas</p></div>'
            + '<div style="display:flex;gap:10px">'
            + '<button onclick="App.modules.preventive.autoProgram()" style="padding:12px 20px;font-size:14px;font-weight:600;color:#1e40af;background:rgba(255,255,255,0.9);border:none;border-radius:10px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.1);transition:all 0.2s" onmouseover="this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 8px 24px rgba(0,0,0,0.15)\'" onmouseout="this.style.transform=\'none\';this.style.boxShadow=\'0 4px 12px rgba(0,0,0,0.1)\'">Auto-programar</button>'
            + '<button onclick="App.modules.preventive.showForm()" style="padding:12px 24px;font-size:14px;font-weight:600;color:#1e40af;background:white;border:none;border-radius:10px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.15);transition:all 0.2s" onmouseover="this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 8px 24px rgba(0,0,0,0.2)\'" onmouseout="this.style.transform=\'none\';this.style.boxShadow=\'0 4px 12px rgba(0,0,0,0.15)\'">+ Nueva Mantencion</button>'
            + '</div></div></div>'

            + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px">'
            + '<div class="prev-card" style="background:white;border:1px solid #e2e8f0;border-radius:14px;padding:22px;border-left:4px solid #64748b;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:prevFadeUp 0.5s ease 0ms both;position:relative;overflow:hidden">'
            + '<div style="position:absolute;top:-20px;right:-20px;width:80px;height:80px;background:#64748b;opacity:0.04;border-radius:50%"></div>'
            + '<div style="display:flex;align-items:flex-start;gap:16px;position:relative;z-index:1">'
            + '<div style="width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#64748b15,#64748b08);display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid #64748b20"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>'
            + '<div><div style="font-size:30px;font-weight:800;color:#0f172a;font-family:\'JetBrains Mono\',monospace;line-height:1">' + total + '</div>'
            + '<div style="font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px">Total</div></div></div></div>'
            + '<div class="prev-card" style="background:white;border:1px solid #e2e8f0;border-radius:14px;padding:22px;border-left:4px solid #3b82f6;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:prevFadeUp 0.5s ease 100ms both;position:relative;overflow:hidden">'
            + '<div style="position:absolute;top:-20px;right:-20px;width:80px;height:80px;background:#3b82f6;opacity:0.04;border-radius:50%"></div>'
            + '<div style="display:flex;align-items:flex-start;gap:16px;position:relative;z-index:1">'
            + '<div style="width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#3b82f615,#3b82f608);display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid #3b82f620"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>'
            + '<div><div style="font-size:30px;font-weight:800;color:#3b82f6;font-family:\'JetBrains Mono\',monospace;line-height:1">' + programadas + '</div>'
            + '<div style="font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px">Programadas</div></div></div></div>'
            + '<div class="prev-card" style="background:white;border:1px solid #e2e8f0;border-radius:14px;padding:22px;border-left:4px solid #22c55e;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:prevFadeUp 0.5s ease 200ms both;position:relative;overflow:hidden">'
            + '<div style="position:absolute;top:-20px;right:-20px;width:80px;height:80px;background:#22c55e;opacity:0.04;border-radius:50%"></div>'
            + '<div style="display:flex;align-items:flex-start;gap:16px;position:relative;z-index:1">'
            + '<div style="width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#22c55e15,#22c55e08);display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid #22c55e20"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>'
            + '<div><div style="font-size:30px;font-weight:800;color:#22c55e;font-family:\'JetBrains Mono\',monospace;line-height:1">' + realizadas + '</div>'
            + '<div style="font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px">Realizadas</div></div></div></div>'
            + '<div class="prev-card" style="background:white;border:1px solid #e2e8f0;border-radius:14px;padding:22px;border-left:4px solid #ef4444;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:prevFadeUp 0.5s ease 300ms both;position:relative;overflow:hidden">'
            + '<div style="position:absolute;top:-20px;right:-20px;width:80px;height:80px;background:#ef4444;opacity:0.04;border-radius:50%"></div>'
            + '<div style="display:flex;align-items:flex-start;gap:16px;position:relative;z-index:1">'
            + '<div style="width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#ef444415,#ef444408);display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid #ef444420"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>'
            + '<div><div style="font-size:30px;font-weight:800;color:#ef4444;font-family:\'JetBrains Mono\',monospace;line-height:1">' + vencidas + '</div>'
            + '<div style="font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px">Vencidas</div></div></div></div>'
            + '</div>'

            + '<div style="background:white;border:1px solid #e2e8f0;border-radius:14px;padding:20px 24px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:prevFadeUp 0.5s ease 400ms both">'
            + '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">'
            + '<select id="filterPrevMaq" onchange="App.modules.preventive.render()" style="font-size:13px;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;color:#1e293b;background:white;cursor:pointer;outline:none;min-width:200px;transition:all 0.2s" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'">' + maqOpts + '</select>'
            + '<select id="filterPrevEstado" onchange="App.modules.preventive.render()" style="font-size:13px;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;color:#1e293b;background:white;cursor:pointer;outline:none;min-width:180px;transition:all 0.2s" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'">'
            + '<option value="activas"' + (filterEstado === 'activas' ? ' selected' : '') + '>Programadas y Vencidas</option>'
            + '<option value=""' + (filterEstado === '' ? ' selected' : '') + '>Todos</option>'
            + '<option value="Programada"' + (filterEstado === 'Programada' ? ' selected' : '') + '>Programada</option>'
            + '<option value="Realizada"' + (filterEstado === 'Realizada' ? ' selected' : '') + '>Realizada</option>'
            + '<option value="Vencida"' + (filterEstado === 'Vencida' ? ' selected' : '') + '>Vencida</option>'
            + '</select>'
            + '<span style="font-size:12px;color:#94a3b8;font-weight:500">' + filtered.length + ' registros</span>'
            + '</div></div>'

            + '<div style="background:white;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:prevFadeUp 0.5s ease 500ms both">'
            + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">'
            + '<thead><tr style="background:#eff6ff;border-bottom:1px solid #bfdbfe">'
            + '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px">Maquina</th>'
            + '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px">Componente</th>'
            + '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px">Checklist</th>'
            + '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px">Fecha Prog.</th>'
            + '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px">Fecha Ejec.</th>'
            + '<th style="padding:11px 14px;text-align:center;font-size:11px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px">Dias</th>'
            + '<th style="padding:11px 14px;text-align:center;font-size:11px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px">Hs.Oc.</th>'
            + '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px">Tecnico</th>'
            + '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px">Estado</th>'
            + '<th style="padding:11px 14px;text-align:center;font-size:11px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px">Acciones</th>'
            + '</tr></thead><tbody>' + tableHtml + '</tbody></table></div></div>';
    },

    async showForm(id) {
        const reg = id ? await db.getById('preventive_maintenance', id) : null;
        const maquinas = await db.getAll('machines');
        const componentes = await db.getAll('components');
        App.showModal(`
            <div class="form-row">
                <div class="form-group"><label>Máquina *</label>
                    <select class="form-control" id="prevMaquina" onchange="App.modules.preventive.updateComponentes()">
                        <option value="">Seleccionar...</option>
                        ${maquinas.map(m => `<option value="${m.id}" ${reg && reg.maquina_id === m.id ? 'selected' : ''}>${m.codigo} - ${m.nombre}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group"><label>Componente *</label>
                    <select class="form-control" id="prevComponente">
                        <option value="">Seleccionar...</option>
                        ${componentes.map(c => `<option value="${c.id}" ${reg && reg.componente_id === c.id ? 'selected' : ''}>${c.nombre}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-group"><label>Frecuencias</label>
                <div class="form-row" style="grid-template-columns:1fr 1fr 1fr">
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="frecDiaria" ${reg && reg.frecuencia_diaria ? 'checked' : ''}> Diaria</label>
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="frecSemanal" ${reg && reg.frecuencia_semanal ? 'checked' : ''}> Semanal</label>
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="frecMensual" ${reg && reg.frecuencia_mensual ? 'checked' : ''}> Mensual</label>
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="frecTrimestral" ${reg && reg.frecuencia_trimestral ? 'checked' : ''}> Trimestral</label>
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="frecSemestral" ${reg && reg.frecuencia_semestral ? 'checked' : ''}> Semestral</label>
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="frecAnual" ${reg && reg.frecuencia_anual ? 'checked' : ''}> Anual</label>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Fecha Programada *</label><input type="date" class="form-control" id="prevFechaProg" value="${reg ? reg.fecha_programada : ''}"></div>
                <div class="form-group"><label>Fecha Ejecutada</label><input type="date" class="form-control" id="prevFechaEjec" value="${reg ? reg.fecha_ejecutada : ''}"></div>
                <div class="form-group"><label>Turno</label>
                    <select class="form-control" id="prevTurno">
                        <option value="Dia" ${reg && reg.turno === 'Dia' ? 'selected' : ''}>Día</option>
                        <option value="Noche" ${reg && reg.turno === 'Noche' ? 'selected' : ''}>Noche</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Horas Ocupadas</label><input type="number" class="form-control" id="prevHorasOc" value="${reg ? reg.horas_ocupadas || 0 : 0}" min="0" step="0.5"></div>
                <div class="form-group"><label>Técnico</label><input class="form-control" id="prevTecnico" value="${reg ? reg.tecnico || '' : ''}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Estado</label>
                    <select class="form-control" id="prevEstado">
                        <option value="Programada" ${reg && reg.estado === 'Programada' ? 'selected' : ''}>Programada</option>
                        <option value="Realizada" ${reg && reg.estado === 'Realizada' ? 'selected' : ''}>Realizada</option>
                        <option value="Vencida" ${reg && reg.estado === 'Vencida' ? 'selected' : ''}>Vencida</option>
                    </select>
                </div>
            </div>
            <div class="form-group"><label>Observaciones</label><textarea class="form-control" id="prevObs">${reg ? reg.observaciones || '' : ''}</textarea></div>
            <div class="form-group"><label>Checklist (uno por línea)</label><textarea class="form-control" id="prevChecklist" rows="4" placeholder="Verificar filtro&#10;Lubricar rodamientos&#10;Revisar correas">${reg ? reg.checklist || '' : ''}</textarea></div>
        `, { title: reg ? 'Editar Mantención Preventiva' : 'Nueva Mantención Preventiva', lg: true });
        const footer = document.querySelector('#modalOverlay .modal-footer');
        footer.innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.preventive.save(${id || 0})">${reg ? 'Actualizar' : 'Guardar'}</button>
        `;
    },

    async updateComponentes() {
        const maqId = parseInt(document.getElementById('prevMaquina').value);
        const select = document.getElementById('prevComponente');
        if (!maqId) { select.innerHTML = '<option value="">Seleccionar...</option>'; return; }
        const maq = await db.getById('machines', maqId);
        if (!maq) return;
        const comps = await db.getComponentsByType(maq.tipo_id);
        select.innerHTML = '<option value="">Seleccionar...</option>' + comps.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    },

    async save(id) {
        try {
            const data = {
                maquina_id: parseInt(document.getElementById('prevMaquina').value),
                componente_id: parseInt(document.getElementById('prevComponente').value),
                frecuencia_diaria: document.getElementById('frecDiaria').checked ? 1 : 0,
                frecuencia_semanal: document.getElementById('frecSemanal').checked ? 1 : 0,
                frecuencia_mensual: document.getElementById('frecMensual').checked ? 1 : 0,
                frecuencia_trimestral: document.getElementById('frecTrimestral').checked ? 1 : 0,
                frecuencia_semestral: document.getElementById('frecSemestral').checked ? 1 : 0,
                frecuencia_anual: document.getElementById('frecAnual').checked ? 1 : 0,
                fecha_programada: document.getElementById('prevFechaProg').value,
                fecha_ejecutada: document.getElementById('prevFechaEjec').value,
                horas_ocupadas: parseFloat(document.getElementById('prevHorasOc').value) || 0,
                tecnico: App.capitalize(document.getElementById('prevTecnico').value.trim()),
                turno: document.getElementById('prevTurno').value,
                estado: document.getElementById('prevEstado').value,
                observaciones: App.capitalize(document.getElementById('prevObs').value.trim()),
                checklist: document.getElementById('prevChecklist').value.trim()
            };
            if (!data.maquina_id || !data.componente_id || !data.fecha_programada) {
                App.showAlert('Máquina, componente y fecha programada son obligatorios', 'danger'); return;
            }
            if (id === 0) await db.insert('preventive_maintenance', data);
            else await db.update('preventive_maintenance', id, data);
            App.hideModal();
            App.showAlert(id === 0 ? 'Mantención creada' : 'Mantención actualizada');
            this.render();
        } catch(e) { App.showAlert('Error al guardar: ' + e.message, 'danger'); }
    },

    async autoProgram() {
        const confirmed = await App.confirm('¿Auto-programar mantenciones?\n\n• 2 tareas aleatorias por día\n• Desde mañana hasta completar 5 días hábiles');
        if (!confirmed) return;

        try {
            const maquinas = await db.getAll('machines');
            if (maquinas.length === 0) { App.showAlert('No hay máquinas registradas', 'danger'); return; }

            const workingDays = [];
            const day = new Date();
            day.setDate(day.getDate() + 1); // Empezar desde mañana

            while (workingDays.length < 5) {
                const dayOfWeek = day.getDay();
                if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                    workingDays.push(new Date(day));
                }
                day.setDate(day.getDate() + 1);
            }

            let created = 0;

            for (const d of workingDays) {
                const dateStr = d.toISOString().split('T')[0];
                const shuffledMaquinas = [...maquinas].sort(() => 0.5 - Math.random());
                const dailyMachines = shuffledMaquinas.slice(0, 2);

                for (const maq of dailyMachines) {
                    const comps = await db.getComponentsByType(maq.tipo_id).catch(() => []);
                    if (comps.length === 0) continue;
                    const comp = comps[Math.floor(Math.random() * comps.length)];

                    await db.insert('preventive_maintenance', {
                        maquina_id: maq.id,
                        componente_id: comp.id,
                        fecha_programada: dateStr,
                        estado: 'Programada',
                        checklist: ''
                    });
                    created++;
                }
            }

            const fechaInicio = workingDays[0].toISOString().split('T')[0];
            const fechaFin = workingDays[4].toISOString().split('T')[0];
            App.showAlert(`✅ ${created} mantenciones auto-programadas\n${fechaInicio} al ${fechaFin}`);
            this.render();
        } catch(e) { App.showAlert('Error al auto-programar: ' + e.message, 'danger'); }
    },

    getDefaultChecklist(tipoId) {
        const checklists = {
            1: 'Verificar nivel de aceite\nCambiar filtros\nRevisar válvulas\nVerificar temperatura',
            2: 'Revisar sellos mecánicos\nVerificar presión\nLubricar rodamientos\nRevisar fugas',
            3: 'Revisar nivel de aceite\nVerificar baterías\nProbar sistema de arranque\nRevisar filtros de aire',
            4: 'Verificar tensión de correas\nLubricar rodamientos\nRevisar alineación\nVerificar sensores',
            5: 'Revisar engranajes\nVerificar balance\nLubricar ejes\nRevisar motor',
            6: 'Verificar rodamientos\nRevisar sellos\nMedir vibraciones\nVerificar lubricación',
            7: 'Limpiar aspiración\nVerificar correas\nRevisar rodamientos\n平衡ar hélice',
            8: 'Revisar sistema hidráulico\nVerificar presión\nCambiar aceite\nRevisar válvulas'
        };
        return checklists[tipoId] || 'Verificar estado general\nLimpiar\nRevisar conexiones\nVerificar funcionamiento';
    },

    async delete(id) {
        try {
            const confirmed = await App.confirm('¿Eliminar este registro?');
            if (!confirmed) return;
            await db.delete('preventive_maintenance', id);
            App.showAlert('Registro eliminado');
            this.render();
        } catch(e) { App.showAlert('Error al eliminar: ' + e.message, 'danger'); }
    }
});
