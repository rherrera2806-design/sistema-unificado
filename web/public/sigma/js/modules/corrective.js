App.registerModule('corrective', {
    async render() {
        const el = document.getElementById('page-corrective');
        const filterMaquina = document.getElementById('filterCorrMaq')?.value || '';

        const data = await fetch('/api/sigma/corrective-data').then(r => r.json()).catch(() => ({ correctivos: [], maquinas: [], componentes: [] }));
        const registros = data.correctivos || [];
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
        if (filterMaquina) filtered = filtered.filter(r => r.maquina_id === parseInt(filterMaquina));
        filtered.sort((a, b) => (b.fecha_falla || '').localeCompare(a.fecha_falla || ''));

        const total = registros.length;
        const reparadas = registros.filter(r => r.estado === 'Reparada').length;
        const activas = total - reparadas;

        let tableHtml;
        if (filtered.length === 0) {
            tableHtml = '<tr><td colspan="9" style="text-align:center;padding:56px 20px">'
                + '<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#fef2f2,#fecaca);display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px;box-shadow:0 4px 12px rgba(239,68,68,0.15)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>'
                + '<div style="font-size:15px;font-weight:600;color:#0f172a;margin-bottom:4px">No hay fallas registradas</div>'
                + '<div style="color:#94a3b8;font-size:13px">Registra la primera falla para comenzar</div></td></tr>';
        } else {
            tableHtml = filtered.map(r => {
                const dias = r.estado === 'Reparada' && r.fecha_falla && r.fecha_reparacion ? Math.round((new Date(r.fecha_reparacion) - new Date(r.fecha_falla)) / 86400000) : '-';
                const badge = r.estado === 'Reparada'
                    ? '<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:4px 12px;border-radius:20px;background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>Reparada</span>'
                    : '<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:4px 12px;border-radius:20px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>En Mantencion</span>';
                return '<tr style="border-bottom:1px solid #f1f5f9;transition:all 0.2s" onmouseover="this.style.background=\'#fef2f2\';this.style.transform=\'translateX(2px)\'" onmouseout="this.style.background=\'transparent\';this.style.transform=\'none\'">'
                    + '<td style="padding:11px 14px;font-weight:600;color:#0f172a">' + r.maquinaNombre + '</td>'
                    + '<td style="padding:11px 14px;color:#475569">' + r.componenteNombre + '</td>'
                    + '<td style="padding:11px 14px"><span style="font-family:\'JetBrains Mono\',monospace;font-size:12px;color:#64748b">' + App.formatDate(r.fecha_falla) + '</span></td>'
                    + '<td style="padding:11px 14px;font-size:12px;color:#64748b;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + (r.descripcion_falla || '').replace(/"/g, '&quot;') + '">' + (r.descripcion_falla || '-') + '</td>'
                    + '<td style="padding:11px 14px">' + badge + '</td>'
                    + '<td style="padding:11px 14px;font-family:\'JetBrains Mono\',monospace;font-size:12px;color:#64748b;text-align:center">' + dias + '</td>'
                    + '<td style="padding:11px 14px;font-family:\'JetBrains Mono\',monospace;font-size:12px;color:#64748b;text-align:center">' + r.horas_detencion + '</td>'
                    + '<td style="padding:11px 14px;color:#475569">' + (r.responsable || '-') + '</td>'
                    + '<td style="padding:11px 14px;text-align:center;white-space:nowrap">'
                    + '<button onclick="App.modules.corrective.showDetail(' + r.id + ')" style="background:white;color:#3b82f6;border:1px solid #bfdbfe;padding:5px 10px;border-radius:6px;font-size:12px;cursor:pointer;transition:all 0.15s" onmouseover="this.style.background=\'#eff6ff\'" onmouseout="this.style.background=\'white\'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button> '
                    + '<button onclick="App.modules.corrective.showForm(' + r.id + ')" style="background:white;color:#64748b;border:1px solid #e2e8f0;padding:5px 10px;border-radius:6px;font-size:12px;cursor:pointer;transition:all 0.15s" onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'white\'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button> '
                    + '<button onclick="App.modules.corrective.delete(' + r.id + ')" style="background:white;color:#dc2626;border:1px solid #fecaca;padding:5px 10px;border-radius:6px;font-size:12px;cursor:pointer;transition:all 0.15s" onmouseover="this.style.background=\'#fef2f2\'" onmouseout="this.style.background=\'white\'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>'
                    + '</td></tr>';
            }).join('');
        }

        const selectOpts = '<option value="">Todas las maquinas</option>' + maquinas.map(m => '<option value="' + m.id + '"' + (filterMaquina === String(m.id) ? ' selected' : '') + '>' + m.nombre + '</option>').join('');

        el.innerHTML = '<style>'
            + '@keyframes corrFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}'
            + '.corr-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}'
            + '.corr-card:hover{transform:translateY(-3px)!important;box-shadow:0 12px 28px rgba(0,0,0,0.12)!important}'
            + '</style>'
            + '<div style="background:linear-gradient(135deg,#0f172a 0%,#7f1d1d 50%,#991b1b 100%);border-radius:16px;padding:32px 36px;margin-bottom:28px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">'
            + '<div style="position:absolute;top:-40px;right:-40px;width:200px;height:200px;background:radial-gradient(circle,rgba(239,68,68,0.2) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="position:absolute;bottom:-60px;left:30%;width:300px;height:200px;background:radial-gradient(circle,rgba(220,38,38,0.15) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center">'
            + '<div><h2 style="margin:0;font-size:28px;font-weight:800;color:white;letter-spacing:-0.5px;text-shadow:0 2px 4px rgba(0,0,0,0.2)">Mantencion Correctiva</h2>'
            + '<p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.7)">Registro de fallas y acciones correctivas</p></div>'
            + '<button onclick="App.modules.corrective.showForm()" style="padding:12px 24px;font-size:14px;font-weight:600;color:#991b1b;background:white;border:none;border-radius:10px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.15);transition:all 0.2s" onmouseover="this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 8px 24px rgba(0,0,0,0.2)\'" onmouseout="this.style.transform=\'none\';this.style.boxShadow=\'0 4px 12px rgba(0,0,0,0.15)\'">+ Registrar Falla</button>'
            + '</div></div>'

            + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:28px">'
            + '<div class="corr-card" style="background:white;border:1px solid #e2e8f0;border-radius:14px;padding:22px;border-left:4px solid #64748b;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:corrFadeUp 0.5s ease 0ms both;position:relative;overflow:hidden">'
            + '<div style="position:absolute;top:-20px;right:-20px;width:80px;height:80px;background:#64748b;opacity:0.04;border-radius:50%"></div>'
            + '<div style="display:flex;align-items:flex-start;gap:16px;position:relative;z-index:1">'
            + '<div style="width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#64748b15,#64748b08);display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid #64748b20"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>'
            + '<div><div style="font-size:30px;font-weight:800;color:#0f172a;font-family:\'JetBrains Mono\',monospace;line-height:1">' + total + '</div>'
            + '<div style="font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px">Total Fallas</div></div></div></div>'
            + '<div class="corr-card" style="background:white;border:1px solid #e2e8f0;border-radius:14px;padding:22px;border-left:4px solid #ef4444;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:corrFadeUp 0.5s ease 100ms both;position:relative;overflow:hidden">'
            + '<div style="position:absolute;top:-20px;right:-20px;width:80px;height:80px;background:#ef4444;opacity:0.04;border-radius:50%"></div>'
            + '<div style="display:flex;align-items:flex-start;gap:16px;position:relative;z-index:1">'
            + '<div style="width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#ef444415,#ef444408);display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid #ef444420"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>'
            + '<div><div style="font-size:30px;font-weight:800;color:#ef4444;font-family:\'JetBrains Mono\',monospace;line-height:1">' + activas + '</div>'
            + '<div style="font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px">Activas</div></div></div></div>'
            + '<div class="corr-card" style="background:white;border:1px solid #e2e8f0;border-radius:14px;padding:22px;border-left:4px solid #22c55e;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:corrFadeUp 0.5s ease 200ms both;position:relative;overflow:hidden">'
            + '<div style="position:absolute;top:-20px;right:-20px;width:80px;height:80px;background:#22c55e;opacity:0.04;border-radius:50%"></div>'
            + '<div style="display:flex;align-items:flex-start;gap:16px;position:relative;z-index:1">'
            + '<div style="width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#22c55e15,#22c55e08);display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid #22c55e20"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>'
            + '<div><div style="font-size:30px;font-weight:800;color:#22c55e;font-family:\'JetBrains Mono\',monospace;line-height:1">' + reparadas + '</div>'
            + '<div style="font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px">Reparadas</div></div></div></div>'
            + '</div>'

            + '<div style="background:white;border:1px solid #e2e8f0;border-radius:14px;padding:20px 24px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:corrFadeUp 0.5s ease 300ms both">'
            + '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">'
            + '<div style="position:relative"><svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%)" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>'
            + '<select id="filterCorrMaq" onchange="App.modules.corrective.render()" style="font-size:13px;padding:10px 14px 10px 36px;border:1px solid #e2e8f0;border-radius:10px;color:#1e293b;background:white;cursor:pointer;outline:none;min-width:220px;transition:all 0.2s" onfocus="this.style.borderColor=\'#ef4444\';this.style.boxShadow=\'0 0 0 3px rgba(239,68,68,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'">' + selectOpts + '</select></div>'
            + '<span style="font-size:12px;color:#94a3b8;font-weight:500">' + filtered.length + ' registros</span>'
            + '</div></div>'

            + '<div style="background:white;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:corrFadeUp 0.5s ease 400ms both">'
            + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">'
            + '<thead><tr style="background:#fef2f2;border-bottom:1px solid #fecaca">'
            + '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.5px">Maquina</th>'
            + '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.5px">Componente</th>'
            + '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.5px">Fecha</th>'
            + '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.5px">Falla</th>'
            + '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.5px">Estado</th>'
            + '<th style="padding:11px 14px;text-align:center;font-size:11px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.5px">Dias</th>'
            + '<th style="padding:11px 14px;text-align:center;font-size:11px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.5px">Hs.Det.</th>'
            + '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.5px">Responsable</th>'
            + '<th style="padding:11px 14px;text-align:center;font-size:11px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.5px">Acciones</th>'
            + '</tr></thead><tbody>' + tableHtml + '</tbody></table></div></div>';
    },

    async showForm(id) {
        if (!window.correctiveToggleReparacion) {
            window.correctiveToggleReparacion = () => {
                const group = document.getElementById('corrFechaRepGroup');
                group.style.display = document.getElementById('corrEstado').value === 'Reparada' ? '' : 'none';
            };
        }
        const reg = id ? await db.getById('corrective_maintenance', id) : null;
        const maquinas = await db.getAll('machines');
        let componentes = await db.getAll('components');
        if (reg && reg.maquina_id) {
            const maq = await db.getById('machines', reg.maquina_id).catch(() => null);
            if (maq && maq.tipo_id) {
                componentes = await db.getComponentsByType(maq.tipo_id);
            }
        }
        const isReparada = reg && reg.estado === 'Reparada';
        App.showModal(`
            <div class="form-row">
                <div class="form-group"><label>Máquina *</label>
                    <select class="form-control" id="corrMaquina" onchange="App.modules.corrective.updateComponentes()">
                        <option value="">Seleccionar...</option>
                        ${maquinas.map(m => `<option value="${m.id}" ${reg && reg.maquina_id === m.id ? 'selected' : ''}>${m.codigo} - ${m.nombre}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group"><label>Componente *</label>
                    <select class="form-control" id="corrComponente">
                        <option value="">Seleccionar...</option>
                        ${componentes.map(c => `<option value="${c.id}" ${reg && reg.componente_id === c.id ? 'selected' : ''}>${c.nombre}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Fecha Falla *</label><input type="date" class="form-control" id="corrFecha" value="${reg ? reg.fecha_falla : ''}"></div>
                <div class="form-group"><label>Horas Detención</label><input type="number" class="form-control" id="corrHoras" value="${reg ? reg.horas_detencion : 0}" min="0" step="0.5"></div>
                <div class="form-group"><label>Turno</label>
                    <select class="form-control" id="corrTurno">
                        <option value="Dia" ${reg && reg.turno === 'Dia' ? 'selected' : ''}>Día</option>
                        <option value="Noche" ${reg && reg.turno === 'Noche' ? 'selected' : ''}>Noche</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Estado</label>
                    <select class="form-control" id="corrEstado" onchange="correctiveToggleReparacion()">
                        <option value="En Mantención" ${(reg && reg.estado === 'En Mantención') || !reg ? 'selected' : ''}>En Mantención</option>
                        <option value="Reparada" ${isReparada ? 'selected' : ''}>Reparada</option>
                    </select>
                </div>
                <div class="form-group" id="corrFechaRepGroup" style="display:${isReparada ? '' : 'none'}"><label>Fecha Reparación</label><input type="date" class="form-control" id="corrFechaRep" value="${reg ? reg.fecha_reparacion || '' : ''}"></div>
            </div>
            <div class="form-group"><label>Descripción de la Falla *</label><textarea class="form-control" id="corrDescripcion" placeholder="Describa la falla">${reg ? reg.descripcion_falla || '' : ''}</textarea></div>
            <div class="form-group"><label>Diagnóstico</label><textarea class="form-control" id="corrDiagnostico" placeholder="Causa raíz">${reg ? reg.diagnostico || '' : ''}</textarea></div>
            <div class="form-group"><label>Acción Correctiva</label><textarea class="form-control" id="corrAccion" placeholder="Acciones realizadas">${reg ? reg.accion_correctiva || '' : ''}</textarea></div>
            <div class="form-group"><label>Repuestos Utilizados</label><textarea class="form-control" id="corrRepuestos" placeholder="Detalle de repuestos">${reg ? reg.repuestos_utilizados || '' : ''}</textarea></div>
                <div class="form-group"><label>Técnico</label><input class="form-control" id="corrResponsable" value="${reg ? reg.responsable || '' : ''}"></div>
            <div class="form-group"><label>Imágenes</label>
                <input type="file" id="corrImagenes" multiple accept="image/*" onchange="App.modules.corrective.previewImages()" style="display:none">
                <button class="btn btn-outline" onclick="document.getElementById('corrImagenes').click()">📷 Adjuntar imágenes</button>
                <div id="corrImagePreview" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">${this.renderExistingImages(reg)}</div>
            </div>
        `, { title: reg ? 'Editar Falla' : 'Registrar Falla', lg: true });
        const footer = document.querySelector('#modalOverlay .modal-footer');
        footer.innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-danger" onclick="App.modules.corrective.save(${id || 0})">${reg ? 'Actualizar' : 'Guardar'}</button>
        `;
    },

    async updateComponentes() {
        const maqId = parseInt(document.getElementById('corrMaquina').value);
        const select = document.getElementById('corrComponente');
        if (!maqId) { select.innerHTML = '<option value="">Seleccionar...</option>'; return; }
        const maq = await db.getById('machines', maqId);
        if (!maq) return;
        const comps = await db.getComponentsByType(maq.tipo_id);
        select.innerHTML = '<option value="">Seleccionar...</option>' + comps.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    },

    _newImages: [],

    renderExistingImages(reg) {
        if (!reg || !reg.imagenes) return '';
        try {
            const imgs = JSON.parse(reg.imagenes);
            return imgs.map((src, i) => `
                <div style="position:relative;display:inline-block">
                    <img src="${src}" onclick="App.modules.corrective.viewImage('${src.replace(/'/g, "\\'")}')" style="width:60px;height:60px;object-fit:cover;border-radius:4px;cursor:pointer;border:1px solid var(--border)">
                    <button onclick="App.modules.corrective.removeExistingImage(${i})" style="position:absolute;top:-4px;right:-4px;background:#dc3545;color:#fff;border:none;border-radius:50%;width:16px;height:16px;font-size:10px;cursor:pointer;line-height:1">&times;</button>
                </div>
            `).join('');
        } catch(e) { return ''; }
    },

    previewImages() {
        const input = document.getElementById('corrImagenes');
        const container = document.getElementById('corrImagePreview');
        if (!input.files || input.files.length === 0) return;
        const reg = this._currentReg || null;
        if (!this._newImages) this._newImages = [];
        Array.from(input.files).forEach(file => {
            const reader = new FileReader();
            reader.onload = function(e) {
                App.modules.corrective._newImages.push(e.target.result);
                const idx = App.modules.corrective._newImages.length - 1;
                const div = document.createElement('div');
                div.style.cssText = 'position:relative;display:inline-block';
                div.innerHTML = `
                    <img src="${e.target.result}" onclick="App.modules.corrective.viewImage(this.src)" style="width:60px;height:60px;object-fit:cover;border-radius:4px;cursor:pointer;border:1px solid var(--border)">
                    <button onclick="App.modules.corrective.removeNewImage(${idx}, this.parentElement)" style="position:absolute;top:-4px;right:-4px;background:#dc3545;color:#fff;border:none;border-radius:50%;width:16px;height:16px;font-size:10px;cursor:pointer;line-height:1">&times;</button>
                `;
                container.appendChild(div);
            };
            reader.readAsDataURL(file);
        });
        input.value = '';
    },

    removeNewImage(idx, el) {
        if (this._newImages) this._newImages[idx] = null;
        if (el) el.remove();
    },

    removeExistingImage(idx) {
        const reg = this._currentReg;
        if (!reg || !reg.imagenes) return;
        try {
            const imgs = JSON.parse(reg.imagenes);
            imgs.splice(idx, 1);
            reg.imagenes = JSON.stringify(imgs);
            const container = document.getElementById('corrImagePreview');
            container.innerHTML = this.renderExistingImages(reg);
        } catch(e) {}
    },

    viewImage(src) {
        App.showModal(`<img src="${src}" style="width:100%;max-height:70vh;object-fit:contain;border-radius:4px">`, { title: 'Vista de imagen' });
        const footer = document.querySelector('#modalOverlay .modal-footer');
        footer.innerHTML = '<button class="btn btn-outline" onclick="App.hideModal()">Cerrar</button>';
    },

    async showDetail(id) {
        const r = await db.getById('corrective_maintenance', id);
        if (!r) return;
        const maq = await db.getById('machines', r.maquina_id).catch(() => null);
        const comp = await db.getById('components', r.componente_id).catch(() => null);
        const dias = r.estado === 'Reparada' && r.fecha_falla && r.fecha_reparacion ? Math.round((new Date(r.fecha_reparacion) - new Date(r.fecha_falla)) / 86400000) : '-';
        App.showModal(`
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div><strong>Máquina:</strong> ${maq ? maq.nombre : '-'}</div>
                <div><strong>Componente:</strong> ${comp ? comp.nombre : '-'}</div>
                <div><strong>Fecha Falla:</strong> ${App.formatDate(r.fecha_falla)}</div>
                <div><strong>Estado:</strong> ${r.estado || 'En Mantención'}</div>
                <div><strong>Fecha Rep.:</strong> ${App.formatDate(r.fecha_reparacion)}</div>
                <div><strong>Días:</strong> ${dias}</div>
                <div><strong>Horas Det.:</strong> ${r.horas_detencion}</div>
                <div><strong>Técnico:</strong> ${r.responsable || '-'}</div>
                <div><strong>Turno:</strong> ${r.turno || 'Dia'}</div>
            </div>
            <hr style="margin:12px 0;border:none;border-top:1px solid var(--border)">
            <div class="form-group"><label style="font-weight:600">Falla</label><p>${r.descripcion_falla || '-'}</p></div>
            <div class="form-group"><label style="font-weight:600">Diagnóstico</label><p>${r.diagnostico || '-'}</p></div>
            <div class="form-group"><label style="font-weight:600">Acción Correctiva</label><p>${r.accion_correctiva || '-'}</p></div>
            <div class="form-group"><label style="font-weight:600">Repuestos</label><p>${r.repuestos_utilizados || '-'}</p></div>
            ${r.imagenes ? (() => { try { const imgs = JSON.parse(r.imagenes); return imgs.length > 0 ? `<div class="form-group"><label style="font-weight:600">Imágenes</label><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">${imgs.map(src => `<img src="${src}" onclick="App.modules.corrective.viewImage('${src.replace(/'/g, "\\'")}')" style="width:80px;height:80px;object-fit:cover;border-radius:4px;cursor:pointer;border:1px solid var(--border)">`).join('')}</div></div>` : ''; } catch(e) { return ''; } })() : ''}
        `, { title: 'Detalle de Falla' });
        const footer = document.querySelector('#modalOverlay .modal-footer');
        footer.innerHTML = `<button class="btn btn-outline" onclick="App.hideModal()">Cerrar</button>`;
    },

    async save(id) {
        try {
            let existingImgs = [];
            if (id > 0) {
                try {
                    const reg = await db.getById('corrective_maintenance', id);
                    if (reg && reg.imagenes) existingImgs = JSON.parse(reg.imagenes);
                } catch(e) {}
            }
            const newImgs = (this._newImages || []).filter(img => img);
            const allImgs = [...existingImgs, ...newImgs];
            const data = {
                maquina_id: parseInt(document.getElementById('corrMaquina').value),
                componente_id: parseInt(document.getElementById('corrComponente').value),
                fecha_falla: document.getElementById('corrFecha').value,
                descripcion_falla: App.capitalize(document.getElementById('corrDescripcion').value.trim()),
                diagnostico: App.capitalize(document.getElementById('corrDiagnostico').value.trim()),
                accion_correctiva: App.capitalize(document.getElementById('corrAccion').value.trim()),
                repuestos_utilizados: App.capitalize(document.getElementById('corrRepuestos').value.trim()),
                horas_detencion: parseFloat(document.getElementById('corrHoras').value) || 0,
                estado: document.getElementById('corrEstado').value,
                fecha_reparacion: document.getElementById('corrEstado').value === 'Reparada' ? document.getElementById('corrFechaRep').value : '',
                responsable: App.capitalize(document.getElementById('corrResponsable').value.trim()),
                turno: document.getElementById('corrTurno').value,
                imagenes: allImgs.length > 0 ? JSON.stringify(allImgs) : null
            };
            this._newImages = [];
            if (!data.maquina_id || !data.componente_id || !data.fecha_falla || !data.descripcion_falla) {
                App.showAlert('Complete los campos obligatorios', 'danger'); return;
            }
            if (id === 0) await db.insert('corrective_maintenance', data);
            else await db.update('corrective_maintenance', id, data);
            App.hideModal();
            App.showAlert(id === 0 ? 'Falla registrada' : 'Registro actualizado');
            this.render();
        } catch(e) { App.showAlert('Error al guardar: ' + e.message, 'danger'); }
    },

    async delete(id) {
        try {
            const confirmed = await App.confirm('¿Eliminar este registro?');
            if (!confirmed) return;
            await db.delete('corrective_maintenance', id);
            App.showAlert('Registro eliminado');
            this.render();
        } catch(e) { App.showAlert('Error al eliminar: ' + e.message, 'danger'); }
    }
});
