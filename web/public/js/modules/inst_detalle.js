App.registerModule('inst_detalle', {
    inst: null,
    historial: [],
    fotos: [],

    async render() {
        const el = document.getElementById('page-inst_detalle');
        if (!this.inst) {
            el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-light)">Selecciona una instalacion para ver el detalle</div>';
            return;
        }
        await this.cargarYRenderizar(this.inst.id);
    },

    async cargarYRenderizar(id) {
        try {
            const hdrs = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const [instRes, histRes, fotosRes] = await Promise.all([
                fetch(`/api/instalaciones/${id}`, { headers: hdrs }),
                fetch(`/api/instalaciones/${id}/historial`, { headers: hdrs }),
                fetch(`/api/instalaciones/${id}/fotos`, { headers: hdrs })
            ]);
            this.inst = await instRes.json();
            this.historial = await histRes.json();
            this.fotos = await fotosRes.json();
            this.renderDetalle();
        } catch(e) { console.error('Error cargando detalle:', e); }
    },

    async abrir(id) {
        this.inst = { id };
        App.loadModule('inst_detalle');
        await this.cargarYRenderizar(id);
    },

    renderDetalle() {
        const el = document.getElementById('page-inst_detalle');
        const inst = this.inst;
        if (!inst || !inst.id) { el.innerHTML = ''; return; }
        const estadoColor = { 'PROGRAMADA': '#3b82f6', 'EN_CAMINO': '#f59e0b', 'EN_CURSO': '#f59e0b', 'COMPLETADA': '#22c55e', 'CON_NOVEDADES': '#ef4444', 'CANCELADA': '#94a3b8' };
        const color = estadoColor[inst.estado] || '#3b82f6';
        const fecha = inst.fecha_programada ? inst.fecha_programada.substring(0, 10) : '-';
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const p = user.permisos || [];
        const canEdit = p.includes('instalaciones.eliminar') || p.includes('usuarios');

        const badge = '<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:4px 12px;border-radius:20px;background:' + color + '18;color:' + color + ';border:1px solid ' + color + '40">' + inst.estado + '</span>';

        let actionBtns = '';
        if (canEdit) {
            actionBtns += '<button class="btn btn-sm btn-outline" title="Editar" onclick="App.modules.inst_detalle.editarInstalacion(' + inst.id + ')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>';
            actionBtns += '<button class="btn btn-sm btn-danger" title="Eliminar" onclick="App.modules.inst_detalle.eliminarInstalacion(' + inst.id + ')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>';
        }
        if (inst.estado === 'PROGRAMADA') actionBtns += '<button class="btn btn-warning" onclick="App.modules.inst_detalle.cambiarEstado(' + inst.id + ',\'EN_CAMINO\')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg> En Camino</button>';
        if (inst.estado === 'EN_CAMINO') actionBtns += '<button class="btn btn-warning" onclick="App.modules.inst_detalle.cambiarEstado(' + inst.id + ',\'EN_CURSO\')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg> En Curso</button>';
        if (inst.estado === 'EN_CURSO') actionBtns += '<button class="btn btn-success" onclick="App.modules.inst_detalle.showCerrar(' + inst.id + ')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><polyline points="20 6 9 17 4 12"/></svg> Completar</button>';
        if (inst.estado === 'EN_CURSO') actionBtns += '<button class="btn btn-danger" onclick="App.modules.inst_detalle.showNovedad(' + inst.id + ')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Novedad</button>';
        if (inst.estado === 'CON_NOVEDADES') actionBtns += '<button class="btn btn-warning" onclick="App.modules.inst_detalle.cambiarEstado(' + inst.id + ',\'EN_CURSO\')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg> Reanudar</button>';

        el.innerHTML = '<style>'
            + '@keyframes detFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}'
            + '.det-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}'
            + '.det-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important}'
            + '.det-foto{transition:all 0.2s ease;cursor:pointer}'
            + '.det-foto:hover{transform:scale(1.03);box-shadow:0 8px 20px rgba(0,0,0,0.15)!important}'
            + '.det-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;max-width:100%}'
            + '.det-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;font-size:13px}'
            + '.det-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}'
            + '.det-actions .btn{min-height:32px;min-width:32px;display:inline-flex;align-items:center;justify-content:center}'
            + '.det-fotos-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}'
            + '.det-foto{position:relative;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);aspect-ratio:1/1;background:#f1f5f9}'
            + '.det-foto-img{width:100%;height:100%;object-fit:cover;display:block;border-radius:10px}'
            + '@media(max-width:768px){'
            + '.det-hero{padding:12px;border-radius:12px;margin-bottom:16px}'
            + '.det-grid{grid-template-columns:1fr;gap:16px}'
            + '.det-info-grid{grid-template-columns:1fr}'
            + '.det-actions{gap:6px;width:100%;justify-content:flex-start}'
            + '.det-actions .btn{font-size:12px;padding:8px 14px;min-height:40px;height:40px}'
            + '.det-actions .btn svg{width:14px;height:14px}'
            + '.det-foto-header{flex-direction:column;align-items:stretch;gap:8px}'
            + '.det-foto-upload{flex-direction:column;gap:8px}'
            + '.det-foto-upload input[type=file]{max-width:100%}'
            + '.det-foto-upload .btn{width:100%}'
            + '.det-fotos-grid{grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px}'
            + '}'
            + '</style>'

            + '<div class="det-hero" style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:8px 16px;margin-bottom:24px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3);max-width:100%;box-sizing:border-box">'
            + '<div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;max-width:100%">'
            + '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;min-width:0;flex:1">'
            + '<button class="btn btn-outline" style="color:white;border-color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.1);flex-shrink:0" onclick="App.loadModule(\'instalaciones\')" title="Volver a instalaciones"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><polyline points="15 18 9 12 15 6"/></svg> Volver</button>'
            + '<div style="min-width:0"><h2 style="margin:0;font-size:14px;font-weight:800;color:white;letter-spacing:-0.5px">Instalacion #' + inst.id + '</h2>'
            + '<p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:250px">' + escapeHtml(inst.cliente) + ' &middot; ' + escapeHtml(inst.direccion || '') + '</p></div>'
            + '</div>'
            + '<div class="det-actions" style="flex-shrink:0">' + badge + actionBtns + '</div>'
            + '</div></div>'

            + '<div class="det-grid">'

            + '<div class="det-card" style="background:white;border:1px solid #e2e8f0;border-radius:14px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:detFadeUp 0.5s ease 0ms both;max-width:100%;box-sizing:border-box;overflow:hidden">'
            + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #e2e8f0">'
            + '<div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#eff6ff,#bfdbfe);display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></div>'
            + '<h3 style="margin:0;font-size:15px;font-weight:700;color:#0f172a">Informacion</h3></div>'
            + '<div class="det-info-grid">'
            + '<div><span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:2px">Cliente</span><span style="font-weight:600;color:#0f172a">' + escapeHtml(inst.cliente) + '</span></div>'
            + '<div><span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:2px">Tecnico</span><span style="color:#475569">' + escapeHtml(inst.tecnico || '-') + '</span></div>'
            + '<div><span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:2px">Vendedor</span><span style="color:#475569">' + escapeHtml(inst.vendedor || '-') + '</span></div>'
            + '<div><span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:2px">Orden</span><span style="font-family:\'JetBrains Mono\',monospace;font-size:12px;color:#475569">' + escapeHtml(inst.numero_orden || '-') + '</span></div>'
            + '<div><span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:2px">Fecha</span><span style="font-family:\'JetBrains Mono\',monospace;font-size:12px;color:#475569">' + fecha + ' ' + (inst.hora_programada || '') + '</span></div>'
            + '<div style="grid-column:1/-1"><span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:2px">Direccion</span><span style="color:#475569">' + escapeHtml(inst.direccion)
            + (canEdit ? ' <a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(inst.direccion) + '" target="_blank" style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:6px;font-size:11px;background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;text-decoration:none;margin-left:6px;transition:all 0.15s" onmouseover="this.style.background=\'#dcfce7\'" onmouseout="this.style.background=\'#f0fdf4\'"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>Maps</a> <a href="https://www.waze.com/ul?q=' + encodeURIComponent(inst.direccion) + '" target="_blank" style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:6px;font-size:11px;background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;text-decoration:none;transition:all 0.15s" onmouseover="this.style.background=\'#dbeafe\'" onmouseout="this.style.background=\'#eff6ff\'"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>Waze</a>' : '')
            + '</span></div>'
            + '<div style="grid-column:1/-1"><span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:2px">Descripcion</span><span style="color:#475569;line-height:1.5">' + escapeHtml(inst.descripcion || '-') + '</span></div>'
            + '<div style="grid-column:1/-1"><span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:2px">Notas Previas</span><span style="color:#475569">' + escapeHtml(inst.notas_previas || '-') + '</span></div>'
            + (inst.notas_cierre ? '<div style="grid-column:1/-1"><span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:2px">Notas Cierre</span><span style="color:#475569">' + escapeHtml(inst.notas_cierre) + '</span></div>' : '')
            + (() => {
                if (!inst.firma_cliente) return '';
                try {
                    const f = JSON.parse(inst.firma_cliente);
                    return '<div style="grid-column:1/-1"><span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:2px">Firma: ' + escapeHtml(f.nombre || '') + '</span><img src="' + f.firma + '" style="max-width:280px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;padding:4px;margin-top:4px"></div>';
                } catch(e) { return '<div style="grid-column:1/-1"><span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:2px">Firma</span><span style="color:#475569">' + escapeHtml(inst.firma_cliente) + '</span></div>'; }
            })()
            + '<div><span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:2px">Creado por</span><span style="color:#475569">' + escapeHtml(inst.creado_por || '-') + '</span></div>'
            + '<div><span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:2px">Cerrado por</span><span style="color:#475569">' + escapeHtml(inst.cerrado_por || '-') + '</span></div>'
            + '</div></div>'

            + '<div class="det-card" style="background:white;border:1px solid #e2e8f0;border-radius:14px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:detFadeUp 0.5s ease 100ms both;max-width:100%;box-sizing:border-box;overflow:hidden">'
            + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #e2e8f0">'
            + '<div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#f0fdf4,#bbf7d0);display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></div>'
            + '<h3 style="margin:0;font-size:15px;font-weight:700;color:#0f172a">Historial</h3></div>'
            + '<div style="max-height:340px;overflow-y:auto;overflow-x:hidden">'
            + (this.historial.length === 0
                ? '<div style="text-align:center;padding:32px;color:#94a3b8;font-size:13px">Sin registros de actividad</div>'
                : this.historial.map(h => '<div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:12px;flex-wrap:wrap" onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'transparent\'">'
                    + '<span style="font-family:\'JetBrains Mono\',monospace;font-size:11px;color:#94a3b8;min-width:130px;flex-shrink:0">' + (h.created_at ? new Date(h.created_at).toLocaleString('es-CL') : '-') + '</span>'
                    + '<span style="font-weight:600;color:#0f172a;min-width:100px;flex-shrink:0">' + h.accion + '</span>'
                    + '<span style="flex:1;color:#475569;min-width:0">' + escapeHtml(h.detalle || '') + '</span>'
                    + '<span style="color:#94a3b8;flex-shrink:0">' + escapeHtml(h.usuario_nombre || h.usuario) + '</span>'
                    + '</div>').join('')
            )
            + '</div></div>'
            + '</div>'

            + '<div class="det-card" style="background:white;border:1px solid #e2e8f0;border-radius:14px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:detFadeUp 0.5s ease 200ms both;max-width:100%;box-sizing:border-box;overflow:hidden">'
            + '<div class="det-foto-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #e2e8f0;flex-wrap:wrap;gap:10px">'
            + '<div style="display:flex;align-items:center;gap:10px">'
            + '<div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#fef3c7,#fde68a);display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>'
            + '<h3 style="margin:0;font-size:15px;font-weight:700;color:#0f172a">Fotografias (' + this.fotos.length + ')</h3></div>'
            + ((inst.estado === 'EN_CURSO' || inst.estado === 'COMPLETADA' || inst.estado === 'CON_NOVEDADES')
                ? '<div class="det-foto-upload" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><input type="file" id="instDetFotoInput" accept="image/*" multiple style="font-size:12px;max-width:200px"><button class="btn btn-primary" onclick="App.modules.inst_detalle.subirFotos(' + inst.id + ')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Subir</button></div>'
                : '')
            + '</div>'
            + (this.fotos.length > 0
                ? '<div class="det-fotos-grid">'
                + this.fotos.map(f => '<div class="det-foto" style="position:relative;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);aspect-ratio:1/1;background:#f1f5f9">'
                    + '<img class="det-foto-img" src="/api/instalaciones/' + inst.id + '/foto/' + f.id + '" alt="' + escapeHtml(f.descripcion || 'Foto') + '" onclick="App.modules.inst_detalle.verFoto(' + inst.id + ',' + f.id + ')" title="' + escapeHtml(f.descripcion || '') + '" loading="lazy" onerror="this.style.display=\'none\';this.parentElement.innerHTML=\'<div style=\\\'display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:11px\\\'>Sin imagen</div>\'">'
                    + (canEdit ? '<button onclick="event.stopPropagation();App.modules.inst_detalle.eliminarFoto(' + inst.id + ',' + f.id + ')" style="position:absolute;top:6px;right:6px;width:24px;height:24px;border-radius:50%;background:rgba(239,68,68,0.9);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.2)" title="Eliminar"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' : '')
                    + '</div>').join('')
                + '</div>'
                : '<div style="text-align:center;padding:32px;color:#94a3b8;font-size:13px">Sin fotografias</div>'
            )
            + '</div>';
    },

    async cambiarEstado(id, estado) {
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        try {
            await fetch(`/api/instalaciones/${id}/estado`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-User-Email': user.email || '' },
                body: JSON.stringify({ estado })
            });
            App.showAlert('Estado actualizado');
            await this.cargarYRenderizar(id);
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    showCerrar(id) {
        App.showModal(`
            <div class="form-group"><label>Notas de Cierre</label><textarea class="form-control" id="instCierreNotas" rows="3" placeholder="Observaciones finales" style="text-transform:capitalize" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></textarea></div>
            <div class="form-group"><label>Nombre de quien recibe *</label><input class="form-control" id="instCierreFirma" placeholder="Nombre completo" style="text-transform:capitalize" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
            <div class="form-group">
                <label>Firma del Cliente *</label>
                <div style="position:relative;border:2px solid #334155;border-radius:8px;overflow:hidden;background:#fff">
                    <canvas id="firmaCanvas" width="460" height="180" style="display:block;width:100%;height:180px;touch-action:none;cursor:crosshair"></canvas>
                </div>
                <div style="display:flex;gap:8px;margin-top:6px">
                    <button type="button" class="btn btn-outline btn-sm" title="Limpiar firma" onclick="App.modules.inst_detalle.limpiarFirma()" style="font-size:11px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Limpiar</button>
                    <span style="font-size:11px;color:#64748b;align-self:center">Firme aqui con el dedo o mouse</span>
                </div>
            </div>
        `, { title: 'Cerrar Instalacion #' + id });
        document.querySelector('#modalOverlay .modal-footer').innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.inst_detalle.cerrar(${id})">Completar</button>
        `;
        setTimeout(() => this.initFirmaCanvas(), 100);
    },

    initFirmaCanvas() {
        const canvas = document.getElementById('firmaCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let drawing = false;
        let lastX = 0, lastY = 0;

        const getPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            if (e.touches) {
                return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
            }
            return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
        };

        const startDraw = (e) => {
            e.preventDefault();
            drawing = true;
            const pos = getPos(e);
            lastX = pos.x; lastY = pos.y;
        };

        const draw = (e) => {
            e.preventDefault();
            if (!drawing) return;
            const pos = getPos(e);
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(pos.x, pos.y);
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
            lastX = pos.x; lastY = pos.y;
        };

        const stopDraw = (e) => { e.preventDefault(); drawing = false; };

        canvas.addEventListener('mousedown', startDraw);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDraw);
        canvas.addEventListener('mouseleave', stopDraw);
        canvas.addEventListener('touchstart', startDraw, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        canvas.addEventListener('touchend', stopDraw, { passive: false });
    },

    limpiarFirma() {
        const canvas = document.getElementById('firmaCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    },

    async cerrar(id) {
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
        const nombre = document.getElementById('instCierreFirma').value.trim();
        if (!nombre) { App.showAlert('Ingrese el nombre de quien recibe', 'danger'); return; }
        const canvas = document.getElementById('firmaCanvas');
        let firmaBase64 = '';
        if (canvas) {
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pixels = imageData.data;
            let hasContent = false;
            for (let i = 3; i < pixels.length; i += 4) { if (pixels[i] > 0) { hasContent = true; break; } }
            if (hasContent) firmaBase64 = canvas.toDataURL('image/png');
        }
        if (!firmaBase64) { App.showAlert('Por favor firme el documento', 'danger'); return; }
        const data = {
            notas_cierre: capitalize(document.getElementById('instCierreNotas').value.trim()),
            firma_cliente: JSON.stringify({ nombre: capitalize(nombre), firma: firmaBase64 })
        };
        try {
            await fetch(`/api/instalaciones/${id}/cerrar`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-User-Email': user.email || '' },
                body: JSON.stringify(data)
            });
            App.hideModal();
            App.showAlert('Instalacion completada');
            await this.cargarYRenderizar(id);
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    showNovedad(id) {
        App.showModal(`
            <div class="form-group"><label>Descripcion de la Novedad *</label><textarea class="form-control" id="instNovedadDesc" rows="4" placeholder="Describe que sucedio..." style="text-transform:capitalize" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></textarea></div>
            <div class="form-group"><label>Fotos de la Novedad (opcional)</label><input type="file" id="instNovedadFotos" accept="image/*" multiple style="font-size:13px"></div>
        `, { title: 'Registrar Novedad #' + id });
        document.querySelector('#modalOverlay .modal-footer').innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.inst_detalle.registrarNovedad(${id})">Registrar</button>
        `;
    },

    async registrarNovedad(id) {
        const desc = document.getElementById('instNovedadDesc').value.trim();
        if (!desc) { App.showAlert('Describe la novedad', 'danger'); return; }
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const headers = { 'Content-Type': 'application/json', 'X-User-Email': user.email || '' };
        try {
            await fetch(`/api/instalaciones/${id}/estado`, {
                method: 'PUT', headers,
                body: JSON.stringify({ estado: 'CON_NOVEDADES', detalle: desc })
            });
            const fotosInput = document.getElementById('instNovedadFotos');
            if (fotosInput && fotosInput.files.length > 0) {
                const fotos = [];
                for (const file of fotosInput.files) {
                    const base64 = await new Promise(r => { const reader = new FileReader(); reader.onload = () => r(reader.result); reader.readAsDataURL(file); });
                    fotos.push({ base64, descripcion: '[Novedad] ' + file.name });
                }
                await fetch(`/api/instalaciones/${id}/fotos`, { method: 'POST', headers, body: JSON.stringify({ fotos }) });
            }
            App.hideModal();
            App.showAlert('Novedad registrada');
            await this.cargarYRenderizar(id);
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    async subirFotos(id) {
        const input = document.getElementById('instDetFotoInput');
        if (!input || input.files.length === 0) { App.showAlert('Selecciona al menos una foto', 'danger'); return; }
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const fotos = [];
        for (const file of input.files) {
            const base64 = await new Promise(r => { const reader = new FileReader(); reader.onload = () => r(reader.result); reader.readAsDataURL(file); });
            fotos.push({ base64, descripcion: file.name });
        }
        try {
            await fetch(`/api/instalaciones/${id}/fotos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Email': user.email || '' },
                body: JSON.stringify({ fotos })
            });
            App.showAlert(fotos.length + ' foto(s) subida(s)');
            await this.cargarYRenderizar(id);
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    async eliminarFoto(instId, fotoId) {
        if (!confirm('Eliminar esta foto?')) return;
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        try {
            await fetch(`/api/instalaciones/${instId}/foto/${fotoId}`, {
                method: 'DELETE',
                headers: { 'X-User-Email': user.email || '' }
            });
            App.showAlert('Foto eliminada');
            await this.cargarYRenderizar(instId);
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    async editarInstalacion(id) {
        const inst = this.inst;
        if (!inst) return;
        let tecnicos = [];
        let vendedores = [];
        try { tecnicos = await fetch('/api/instalaciones/tecnicos').then(r => r.json()); } catch(e) {}
        try { vendedores = await fetch('/api/instalaciones/vendedores').then(r => r.json()); } catch(e) {}
        const datalistHtml = `<datalist id="tecnicosList">${(tecnicos || []).map(t => `<option value="${escapeHtml(t)}">`).join('')}</datalist><datalist id="vendedoresList">${(vendedores || []).map(v => `<option value="${escapeHtml(v)}">`).join('')}</datalist>`;
        App.showModal(`
            ${datalistHtml}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group"><label>Cliente *</label><input class="form-control" id="instCliente" value="${escapeHtml(inst.cliente)}" placeholder="Nombre del cliente" style="text-transform:uppercase" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
                <div class="form-group"><label>Tecnico Asignado</label><input class="form-control" id="instTecnico" value="${escapeHtml(inst.tecnico || '')}" placeholder="Nombre del tecnico" style="text-transform:capitalize" list="tecnicosList" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group"><label>Vendedor</label><input class="form-control" id="instVendedor" value="${escapeHtml(inst.vendedor || '')}" placeholder="Nombre del vendedor" style="text-transform:capitalize" list="vendedoresList" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
                <div class="form-group"><label>Numero de Orden</label><input class="form-control" id="instNumeroOrden" value="${escapeHtml(inst.numero_orden || '')}" placeholder="Numero de orden" style="text-transform:uppercase" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
            </div>
            <div class="form-group"><label>Direccion *</label>
                <div style="display:flex;gap:6px;align-items:center">
                    <input class="form-control" id="instDireccion" value="${escapeHtml(inst.direccion)}" placeholder="Direccion de la instalacion" style="text-transform:capitalize;flex:1" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
                    <a href="https://www.google.com/maps/search/?api=1&query=" target="_blank" id="instMapGoogle" title="Google Maps" style="display:inline-flex;align-items:center;padding:6px 10px;border-radius:6px;font-size:12px;background:#dcfce7;color:#166534;text-decoration:none;border:1px solid #bbf7d0;white-space:nowrap" onclick="this.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(document.getElementById('instDireccion').value)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:3px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> Maps</a>
                    <a href="https://www.waze.com/ul?q=" target="_blank" id="instMapWaze" title="Waze" style="display:inline-flex;align-items:center;padding:6px 10px;border-radius:6px;font-size:12px;background:#dbeafe;color:#1e40af;text-decoration:none;border:1px solid #bfdbfe;white-space:nowrap" onclick="this.href='https://www.waze.com/ul?q='+encodeURIComponent(document.getElementById('instDireccion').value)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:3px"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> Waze</a>
                </div>
            </div>
            <div class="form-group"><label>Descripcion</label><textarea class="form-control" id="instDescripcion" rows="2" placeholder="Detalle de vidrios o estructuras a instalar" style="text-transform:capitalize" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">${escapeHtml(inst.descripcion || '')}</textarea></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group"><label>Fecha Programada *</label><input type="date" class="form-control" id="instFecha" value="${inst.fecha_programada ? inst.fecha_programada.substring(0, 10) : ''}" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
                <div class="form-group"><label>Hora</label><input type="time" class="form-control" id="instHora" value="${inst.hora_programada || '09:00'}" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'"></div>
            </div>
            <div class="form-group"><label>Notas Previas</label><textarea class="form-control" id="instNotas" rows="2" placeholder="Notas o instrucciones previas" style="text-transform:capitalize" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">${escapeHtml(inst.notas_previas || '')}</textarea></div>
        `, { title: 'Editar Instalacion #' + id });
        document.querySelector('#modalOverlay .modal-footer').innerHTML = `
            <button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.modules.inst_detalle.guardarEdicion(${id})">Actualizar</button>
        `;
    },

    async guardarEdicion(id) {
        const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
        const data = {
            cliente: document.getElementById('instCliente').value.trim().toUpperCase(),
            direccion: capitalize(document.getElementById('instDireccion').value.trim()),
            descripcion: capitalize(document.getElementById('instDescripcion').value.trim()),
            fecha_programada: document.getElementById('instFecha').value,
            hora_programada: document.getElementById('instHora').value,
            tecnico: capitalize(document.getElementById('instTecnico').value.trim()),
            vendedor: capitalize(document.getElementById('instVendedor').value.trim()),
            numero_orden: document.getElementById('instNumeroOrden').value.trim().toUpperCase(),
            notas_previas: capitalize(document.getElementById('instNotas').value.trim())
        };
        if (!data.cliente || !data.direccion || !data.fecha_programada) { App.showAlert('Cliente, direccion y fecha requeridos', 'danger'); return; }
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        try {
            await fetch(`/api/instalaciones/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-User-Email': user.email || '' },
                body: JSON.stringify(data)
            });
            App.hideModal();
            App.showAlert('Instalacion actualizada');
            await this.cargarYRenderizar(id);
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    async eliminarInstalacion(id) {
        if (!confirm('Eliminar esta instalacion y todo su historial? Esta accion no se puede deshacer.')) return;
        const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
        try {
            await fetch(`/api/instalaciones/${id}`, {
                method: 'DELETE',
                headers: { 'X-User-Email': user.email || '' }
            });
            App.showAlert('Instalacion eliminada');
            App.loadModule('instalaciones');
        } catch(e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    verFoto(instId, fotoId) {
        const w = window.open('', '_blank');
        w.document.write(`<html><body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#111"><img src="/api/instalaciones/${instId}/foto/${fotoId}" style="max-width:100%;max-height:100vh"></body></html>`);
    }
});
