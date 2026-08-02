App.registerModule('notas', {
    _notasData: [],
    async render() {
        const el = document.getElementById('page-notas');
        el.innerHTML = `
            <style>
                @keyframes notaFadeUp {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .nota-hero {
                    background: linear-gradient(135deg, #0f172a 0%, #065f46 50%, #047857 100%);
                    border-radius: 12px;
                    padding: 28px 28px;
                    margin-bottom: 24px;
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 4px 20px rgba(4, 120, 87, .25);
                }
                .nota-hero::before {
                    content: '';
                    position: absolute;
                    width: 180px;
                    height: 180px;
                    background: radial-gradient(circle, rgba(34,197,94,.18) 0%, transparent 70%);
                    top: -50px;
                    right: -30px;
                    border-radius: 50%;
                    pointer-events: none;
                }
                .nota-hero::after {
                    content: '';
                    position: absolute;
                    width: 120px;
                    height: 120px;
                    background: radial-gradient(circle, rgba(16,185,129,.14) 0%, transparent 70%);
                    bottom: -40px;
                    left: 20%;
                    border-radius: 50%;
                    pointer-events: none;
                }
                .nota-hero h2 {
                    color: #fff;
                    margin: 0 0 4px 0;
                    font-size: 1.6rem;
                    font-weight: 700;
                    letter-spacing: -.02em;
                    position: relative;
                    z-index: 1;
                }
                .nota-hero .subtitle {
                    color: rgba(255,255,255,.7);
                    font-size: .85rem;
                    position: relative;
                    z-index: 1;
                }
                .nota-hero-actions {
                    position: relative;
                    z-index: 1;
                }
                .nota-hero-actions .btn {
                    background: rgba(255,255,255,.12);
                    color: #fff;
                    border: 1px solid rgba(255,255,255,.2);
                    border-radius: 8px;
                    padding: 10px 22px;
                    font-weight: 600;
                    font-size: .85rem;
                    cursor: pointer;
                    transition: all .2s ease;
                    backdrop-filter: blur(4px);
                }
                .nota-hero-actions .btn:hover {
                    background: rgba(255,255,255,.22);
                    transform: translateY(-1px);
                }
                .nota-card {
                    background: #fff;
                    border: 1px solid #e5e7eb;
                    border-radius: 10px;
                    padding: 18px 20px;
                    margin-bottom: 12px;
                    display: flex;
                    gap: 16px;
                    align-items: flex-start;
                    animation: notaFadeUp .35s ease both;
                    transition: box-shadow .2s ease, border-color .2s ease;
                }
                .nota-card:hover {
                    box-shadow: 0 4px 16px rgba(0,0,0,.06);
                    border-color: #d1d5db;
                }
                .nota-card.nueva {
                    background: #f0f7ff;
                    border-left: 3px solid #3b82f6;
                }
                .nota-card .nota-body {
                    flex: 1;
                    min-width: 0;
                }
                .nota-card .nota-meta {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 6px;
                    flex-wrap: wrap;
                }
                .nota-card .nota-author {
                    color: #047857;
                    font-weight: 600;
                    font-size: .9rem;
                }
                .nota-card .nota-date {
                    font-size: .75rem;
                    color: #9ca3af;
                }
                .nota-badge {
                    background: #ef4444;
                    color: #fff;
                    font-size: .6rem;
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-weight: 700;
                    letter-spacing: .04em;
                    text-transform: uppercase;
                }
                .nota-card .nota-text {
                    margin: 0;
                    color: #374151;
                    white-space: pre-wrap;
                    font-size: .88rem;
                    line-height: 1.55;
                }
                .nota-card .nota-actions {
                    display: flex;
                    gap: 4px;
                    flex-shrink: 0;
                    align-items: flex-start;
                }
                .nota-read-label {
                    font-size: .72rem;
                    color: #22c55e;
                    padding: 4px 10px;
                    font-weight: 600;
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                }
                .nota-container {
                    padding: 0 16px 16px 16px;
                }
                .nota-empty {
                    text-align: center;
                    padding: 56px 20px;
                    color: #9ca3af;
                }
                .nota-empty .icon {
                    font-size: 2.8rem;
                    margin-bottom: 10px;
                    display: block;
                }
                .nota-empty h4 {
                    margin: 0 0 6px 0;
                    color: #6b7280;
                    font-size: 1rem;
                }
                .nota-empty p {
                    margin: 0;
                    font-size: .85rem;
                }
            </style>
            <div class="nota-hero">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;position:relative;z-index:1">
                    <div>
                        <h2>Notas</h2>
                        <div class="subtitle">Comunicacion entre turnos</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:12px">
                        <div style="position:relative"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);pointer-events:none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" id="notaSearch" placeholder="Buscar por autor, contenido o fecha..." oninput="App.modules.notas.filtrar()" style="width:260px;padding:10px 14px 10px 38px;border:none;border-radius:10px;font-size:13px;color:white;background:rgba(255,255,255,0.15);backdrop-filter:blur(8px);outline:none;transition:all 0.2s" onfocus="this.style.background='rgba(255,255,255,0.25)'" onblur="this.style.background='rgba(255,255,255,0.15)'"></div>
                        <div class="nota-hero-actions"><button onclick="App.modules.notas.showForm()">+ Nueva Nota</button></div>
                    </div>
                </div>
            </div>
            <div id="notasContent">
                <div class="nota-empty"><p>Cargando...</p></div>
            </div>
        `;
        await this.loadNotas();
    },

    async loadNotas() {
        try {
            const data = await db.getAll('notas');
            this._notasData = data || [];
            this.renderNotas(this._notasData);
        } catch(e) {
            console.error('Error loading notas:', e);
            document.getElementById('notasContent').innerHTML = '<div class="empty-state"><p>Error al cargar notas</p></div>';
        }
    },

    filtrar() {
        const q = (document.getElementById('notaSearch')?.value || '').toLowerCase().trim();
        if (!q) { this.renderNotas(this._notasData); return; }
        const filtered = this._notasData.filter(n => {
            const t = (n.tecnico || '').toLowerCase();
            const nota = (n.nota || '').toLowerCase();
            const fecha = (n.fecha || '').toLowerCase();
            return t.includes(q) || nota.includes(q) || fecha.includes(q);
        });
        this.renderNotas(filtered);
    },

    renderNotas(data) {
        const container = document.getElementById('notasContent');
        data.sort((a, b) => {
            const fechaHoraA = (a.fecha || '') + ' ' + (a.hora || '');
            const fechaHoraB = (b.fecha || '') + ' ' + (b.hora || '');
            return fechaHoraB.localeCompare(fechaHoraA);
        });
        if (!data || data.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="icon">&#128213;</div><h4>Sin notas</h4><p>Registra la primera nota</p></div>';
            return;
        }
        let html = '<div style="padding:0">';
        for (const n of data) {
            const esNueva = !n.leido;
            const bgColor = esNueva ? '#f0f7ff' : 'transparent';
            const borderLeft = esNueva ? '3px solid #3b82f6' : 'none';
            html += '<div style="padding:16px;border-bottom:1px solid #e5e7eb;display:flex;gap:16px;align-items:flex-start;background:' + bgColor + ';border-left:' + borderLeft + '" id="nota-' + n.id + '">'
                + '<div style="flex:1">'
                + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
                + '<strong style="color:#047857">' + (n.tecnico || 'Sin autor') + '</strong>'
                + '<span style="font-size:11px;color:#9ca3af">' + App.formatDate(n.fecha) + ' ' + (n.hora || '') + '</span>'
                + (esNueva ? '<span style="background:#ef4444;color:#fff;font-size:9px;padding:2px 6px;border-radius:10px;font-weight:bold">NUEVA</span>' : '')
                + '</div>'
                + '<p style="margin:0;color:#374151;white-space:pre-wrap;font-size:13px;line-height:1.5">' + (n.nota || '') + '</p>'
                + '</div>'
                + '<div style="display:flex;gap:4px;flex-shrink:0;align-items:flex-start">'
                + (esNueva ? '<button onclick="App.modules.notas.marcarLeido(' + n.id + ')" title="Marcar como leido" style="font-size:11px;color:#22c55e;padding:4px 10px;font-weight:600;background:none;border:1px solid #bbf7d0;border-radius:6px;cursor:pointer">&#10003; Leido</button>' : '<span style="font-size:11px;color:#22c55e;padding:4px 10px;font-weight:600">Leido</span>')
                + '<button onclick="App.modules.notas.showForm(' + n.id + ')" style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;cursor:pointer;color:#64748b;font-size:13px" onmouseover="this.style.borderColor=\'#3b82f6\';this.style.color=\'#3b82f6\'" onmouseout="this.style.borderColor=\'#e2e8f0\';this.style.color=\'#64748b\'">&#9998;</button>'
                + '<button onclick="App.modules.notas.delete(' + n.id + ')" style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;cursor:pointer;color:#ef4444;font-size:13px" onmouseover="this.style.background=\'#fee2e2\';this.style.borderColor=\'#f87171\'" onmouseout="this.style.background=\'#fef2f2\';this.style.borderColor=\'#fecaca\'">&#128465;</button>'
                + '</div></div>';
        }
        html += '</div>';
        container.innerHTML = html;
    },

    async marcarLeido(id) {
        try {
            await db.update('notas', id, { leido: true });
            App.showAlert('Nota marcada como leída');
            await this.loadNotas();
            App.updateNotasBadge();
        } catch(e) { App.showAlert('Error al marcar nota', 'danger'); }
    },

    async showForm(id) {
        const reg = id ? await db.getById('notas', id) : null;
        const now = new Date();
        const fechaDefault = reg ? reg.fecha : now.toISOString().split('T')[0];
        const horaDefault = reg ? reg.hora : now.toTimeString().slice(0, 5);
        App.showModal(`
            <div class="form-group"><label>Técnico *</label><input class="form-control" id="notaTecnico" value="${reg ? reg.tecnico || '' : ''}" placeholder="Nombre del técnico"></div>
            <div class="form-row">
                <div class="form-group"><label>Fecha</label><input type="date" class="form-control" id="notaFecha" value="${fechaDefault}"></div>
                <div class="form-group"><label>Hora</label><input type="time" class="form-control" id="notaHora" value="${horaDefault}"></div>
            </div>
            <div class="form-group"><label>Nota *</label><textarea class="form-control" id="notaTexto" rows="5" placeholder="Escribe tu nota aquí...">${reg ? reg.nota || '' : ''}</textarea></div>
        `, { title: reg ? 'Editar Nota' : 'Nueva Nota' });
        const footer = document.querySelector('#modalOverlay .modal-footer');
        footer.innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.notas.save(${id || 0})">${reg ? 'Actualizar' : 'Guardar'}</button>
        `;
    },

    async save(id) {
        try {
            const data = {
                tecnico: App.capitalize(document.getElementById('notaTecnico').value.trim()),
                fecha: document.getElementById('notaFecha').value,
                hora: document.getElementById('notaHora').value,
                nota: document.getElementById('notaTexto').value.trim()
            };
            if (id === 0) data.leido = false;
            if (!data.tecnico || !data.nota) {
                App.showAlert('Técnico y nota son obligatorios', 'danger'); return;
            }
            if (id === 0) await db.insert('notas', data);
            else await db.update('notas', id, data);
            App.hideModal();
            App.showAlert(id === 0 ? 'Nota creada' : 'Nota actualizada');
            this.render();
        } catch(e) { App.showAlert('Error al guardar: ' + e.message, 'danger'); }
    },

    async delete(id) {
        try {
            const confirmed = await App.confirm('¿Eliminar esta nota?');
            if (!confirmed) return;
            await db.delete('notas', id);
            App.showAlert('Nota eliminada');
            this.render();
        } catch(e) { App.showAlert('Error al eliminar: ' + e.message, 'danger'); }
    }
});
