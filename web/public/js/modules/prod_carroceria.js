App.registerModule('prod_carroceria', {
    _items: [],
    _estaciones: [],
    _search: '',
    _importing: false,
    _selectedFile: null,

    async render() {
        const el = document.getElementById('page-prod_carroceria');
        if (!el) return;
        try {
            const [itemsRes, estRes] = await Promise.all([
                fetch('/api/produccion/procesos-carroceria', { headers: this._headers() }),
                fetch('/api/produccion/estaciones', { headers: this._headers() })
            ]);
            this._items = itemsRes.ok ? await itemsRes.json() : [];
            this._estaciones = estRes.ok ? await estRes.json() : [];
        } catch (e) { console.error('Error loading carroceria:', e); }
        this._renderHTML();
    },

    _headers() {
        const user = (typeof getUser === 'function') ? getUser() : null;
        const h = { 'Content-Type': 'application/json' };
        if (user) {
            if (user.email) h['X-User-Email'] = user.email;
            if (user.permisos) h['X-User-Permisos'] = JSON.stringify(user.permisos);
        }
        return h;
    },

    _estacionById() {
        const map = {};
        this._estaciones.forEach(e => { map[e.id] = e; });
        return map;
    },

    _renderHTML() {
        const el = document.getElementById('page-prod_carroceria');
        if (!el) return;
        const filtered = this._search
            ? this._items.filter(it => String(it.codigo_sap).toLowerCase().includes(this._search.toLowerCase()) ||
                (it.descripcion || '').toLowerCase().includes(this._search.toLowerCase()))
            : this._items;
        const estMap = this._estacionById();
        const conEstaciones = this._items.filter(it => Array.isArray(it.estaciones_json) && it.estaciones_json.length > 0).length;
        const sinEstaciones = this._items.length - conEstaciones;
        const totalEstacionesAsignadas = this._items.reduce((acc, it) => acc + (Array.isArray(it.estaciones_json) ? it.estaciones_json.length : 0), 0);
        const estacionesPromedio = this._items.length > 0 ? (totalEstacionesAsignadas / this._items.length).toFixed(1) : 0;

        el.innerHTML =
            '<div class="stats-grid" style="margin-bottom:14px">'
            + '<div class="stat-card dash-card" style="border-left:4px solid #8b5cf6">'
            + '<div class="stat-icon" style="background:#f3e8ff;color:#7c3aed"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg></div>'
            + '<div class="stat-info"><p class="stat-label">Total Codigos</p><p class="stat-sub">Mapeados en sistema</p></div>'
            + '<div class="stat-value">' + this._items.length + '</div>'
            + '</div>'
            + '<div class="stat-card dash-card" style="border-left:4px solid #22c55e">'
            + '<div class="stat-icon green"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" style="vertical-align:-2px"><polyline points="20 6 9 17 4 12"/></svg></div>'
            + '<div class="stat-info"><p class="stat-label">Con Estaciones</p><p class="stat-sub">Enrutamiento custom</p></div>'
            + '<div class="stat-value">' + conEstaciones + '</div>'
            + '</div>'
            + '<div class="stat-card dash-card" style="border-left:4px solid #f59e0b">'
            + '<div class="stat-icon orange"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>'
            + '<div class="stat-info"><p class="stat-label">Sin Estaciones</p><p class="stat-sub">Sin mapeo (vacio)</p></div>'
            + '<div class="stat-value">' + sinEstaciones + '</div>'
            + '</div>'
            + '<div class="stat-card dash-card" style="border-left:4px solid #3b82f6">'
            + '<div class="stat-icon blue"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></div>'
            + '<div class="stat-info"><p class="stat-label">Estaciones Asignadas</p><p class="stat-sub">Promedio ' + estacionesPromedio + ' por codigo</p></div>'
            + '<div class="stat-value">' + totalEstacionesAsignadas + '</div>'
            + '</div>'
            + '</div>'

            + '<div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:14px 18px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,0.04);display:flex;align-items:center;gap:12px;flex-wrap:wrap;animation:pcFadeUp 0.4s ease 60ms both">'
            + '<div style="position:relative;flex:1;min-width:200px">'
            + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
            + '<input type="text" placeholder="Buscar codigo SAP o descripcion..." value="' + escapeHtml(this._search) + '" oninput="App.modules.prod_carroceria.setSearch(this.value)" style="width:100%;padding:8px 12px 8px 32px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;outline:none" onfocus="this.style.borderColor=\'#3b82f6\';this.style.boxShadow=\'0 0 0 3px rgba(59,130,246,0.1)\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'none\'">'
            + '</div>'
            + '<button onclick="App.modules.prod_carroceria.showImportModal()" class="btn btn-primary" style="padding:7px 14px;font-size:12px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Importar Masivo</button>'
            + '<button onclick="App.modules.prod_carroceria.showAddModal()" class="btn btn-primary" style="padding:7px 14px;font-size:12px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo</button>'
            + '</div>'

            + (this._items.length === 0
                ? '<div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:48px 20px;text-align:center;color:#94a3b8;animation:pcFadeUp 0.4s ease 120ms both"><div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg></div><h4 style="margin:0 0 4px;color:#334155;font-size:15px">Sin mapeos registrados</h4><p style="margin:0;font-size:12px">Importa un Excel/CSV con columnas <code>codigo_sap</code> y <code>estaciones</code> (IDs separados por coma)</p></div>'
                : '<div style="background:white;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);overflow:hidden;animation:pcFadeUp 0.4s ease 120ms both">'
                + '<div style="overflow-x:auto;max-height:65vh">'
                + '<table style="width:100%;border-collapse:collapse;font-size:13px">'
                + '<thead style="position:sticky;top:0;z-index:2;background:#f8fafc"><tr style="border-bottom:2px solid #e2e8f0">'
                + '<th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Codigo SAP</th>'
                + '<th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Descripcion</th>'
                + '<th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Secuencia de Estaciones</th>'
                + '<th style="padding:11px 16px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;width:120px">Acciones</th>'
                + '</tr></thead>'
                + '<tbody>' + filtered.map(it => this._renderRow(it, estMap)).join('') + '</tbody>'
                + '</table></div></div>')
            + this._renderImportModal()
            + this._renderAddModal();
    },

    _renderRow(it, estMap) {
        const ids = Array.isArray(it.estaciones_json) ? it.estaciones_json : [];
        const chips = ids.map((id, idx) => {
            const e = estMap[id];
            const nombre = e ? e.nombre_estacion : ('#' + id);
            const color = e ? '#3b82f6' : '#94a3b8';
            return '<span style="display:inline-flex;align-items:center;gap:4px;background:' + color + '15;color:' + color + ';padding:3px 8px;border-radius:12px;font-size:11px;font-weight:600;margin-right:4px"><span style="font-size:9px;opacity:0.7">' + (idx + 1) + '</span>' + escapeHtml(nombre) + '</span>';
        }).join('');
        return '<tr style="border-bottom:1px solid #f1f5f9" onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'\'">'
            + '<td style="padding:11px 16px"><strong style="color:#0f172a;font-family:\'JetBrains Mono\',monospace;font-size:12px">' + escapeHtml(it.codigo_sap) + '</strong></td>'
            + '<td style="padding:11px 16px;color:#475569;font-size:12px">' + (it.descripcion ? escapeHtml(it.descripcion) : '<span style="color:#cbd5e1">-</span>') + '</td>'
            + '<td style="padding:11px 16px"><div style="display:flex;flex-wrap:wrap;gap:4px">' + (chips || '<span style="color:#cbd5e1">-</span>') + '</div></td>'
            + '<td style="padding:11px 16px;text-align:center;white-space:nowrap">'
            + '<button onclick="App.modules.prod_carroceria.showAddModal(' + it.id + ')" class="btn btn-sm btn-outline" title="Editar"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>'
            + '<button onclick="App.modules.prod_carroceria.deleteItem(' + it.id + ',\'' + escapeHtml(it.codigo_sap) + '\')" class="btn btn-sm btn-danger" title="Eliminar" style="margin-left:4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>'
            + '</td></tr>';
    },

    setSearch(v) { this._search = v; this._renderHTML(); },

    _renderImportModal() {
        return '<div id="carImportModal" class="modal-overlay" style="display:none;position:fixed;inset:0;background:rgba(15,23,42,0.5);backdrop-filter:blur(4px);z-index:9999;align-items:center;justify-content:center">'
            + '<div style="background:white;border-radius:16px;width:520px;max-width:95vw;max-height:90vh;overflow:auto;box-shadow:0 24px 64px rgba(0,0,0,0.3);animation:pcFadeUp 0.25s ease">'
            + '<div style="padding:18px 22px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between">'
            + '<h3 style="margin:0;font-size:16px;font-weight:700;color:#0f172a"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" style="vertical-align:-3px;margin-right:6px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Importar Enrutamiento Carroceros</h3>'
            + '<button class="modal-close" onclick="App.modules.prod_carroceria.hideImportModal()"></button>'
            + '</div>'
            + '<div style="padding:20px 22px">'
            + '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:12px;color:#1e40af">'
            + '<strong>Formato esperado (CSV/XLSX):</strong><br>'
            + 'Columnas: <code>codigo_sap</code>, <code>estaciones</code> (IDs separados por coma, ej: <code>1,2,3,4,6,7</code>), opcional <code>descripcion</code>'
            + '</div>'
            + '<div onclick="document.getElementById(\'carImportFile\').click()" style="border:2px dashed #cbd5e1;border-radius:10px;padding:24px;text-align:center;cursor:pointer;background:#f8fafc;transition:all 0.2s" onmouseover="this.style.borderColor=\'#3b82f6\';this.style.background=\'#eff6ff\'" onmouseout="this.style.borderColor=\'#cbd5e1\';this.style.background=\'#f8fafc\'">'
            + '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" style="margin-bottom:6px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
            + '<div id="carImportFileName" style="color:#64748b;font-size:13px">Arrastra un Excel/CSV o haz clic para seleccionar</div>'
            + '<input type="file" id="carImportFile" accept=".csv,.xlsx,.xls" style="display:none" onchange="App.modules.prod_carroceria.handleImportFile(event)">'
            + '</div>'
            + '<div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">'
            + '<button onclick="App.modules.prod_carroceria.hideImportModal()" class="btn btn-outline">Cancelar</button>'
            + '<button id="carImportBtn" onclick="App.modules.prod_carroceria.doImport()" class="btn btn-primary" disabled>Importar</button>'
            + '</div>'
            + '</div></div></div>';
    },

    showImportModal() { document.getElementById('carImportModal').style.display = 'flex'; this._selectedFile = null; const fn = document.getElementById('carImportFileName'); if (fn) fn.textContent = 'Arrastra un Excel/CSV o haz clic para seleccionar'; const btn = document.getElementById('carImportBtn'); if (btn) btn.disabled = true; },
    hideImportModal() { document.getElementById('carImportModal').style.display = 'none'; },

    handleImportFile(e) {
        const f = e.target.files[0];
        if (!f) return;
        this._selectedFile = f;
        const fn = document.getElementById('carImportFileName');
        if (fn) fn.innerHTML = '<strong style="color:#1e40af">' + escapeHtml(f.name) + '</strong> <span style="color:#94a3b8">(' + (f.size / 1024).toFixed(1) + ' KB)</span>';
        const btn = document.getElementById('carImportBtn');
        if (btn) btn.disabled = false;
    },

    async doImport() {
        if (!this._selectedFile || this._importing) return;
        this._importing = true;
        const btn = document.getElementById('carImportBtn');
        const origText = btn.textContent;
        btn.textContent = 'Procesando...';
        btn.disabled = true;
        try {
            const text = await this._selectedFile.text();
            const filas = this._parseCSV(text);
            if (filas.length === 0) { alert('El archivo esta vacio o no tiene filas validas'); return; }
            const r = await fetch('/api/produccion/procesos-carroceria/importar', {
                method: 'POST',
                headers: this._headers(),
                body: JSON.stringify({ filas })
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || 'Error en importacion');
            let msg = 'Importacion OK:\n' + data.insertados + ' insertados, ' + data.actualizados + ' actualizados';
            if (data.errores > 0) msg += '\n' + data.errores + ' errores';
            alert(msg);
            this.hideImportModal();
            this.render();
        } catch (e) {
            alert('Error: ' + e.message);
        } finally {
            this._importing = false;
            btn.textContent = origText;
            btn.disabled = false;
        }
    },

    _parseCSV(text) {
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) return [];
        const delimiter = lines[0].includes(';') ? ';' : ',';
        const first = this._parseLine(lines[0], delimiter).map(h => h.toLowerCase().trim().replace(/['"]/g, ''));
        const hasHeader = first.some(h => h.includes('sap') || h.includes('estacion') || h.includes('codigo'));
        const dataLines = hasHeader ? lines.slice(1) : lines;
        const codigoIdx = hasHeader ? first.findIndex(h => h.includes('sap') || h.includes('codigo')) : 0;
        const estIdx = hasHeader ? first.findIndex(h => h.includes('estacion')) : 1;
        const descIdx = hasHeader ? first.findIndex(h => h.includes('desc')) : -1;
        const result = [];
        for (const l of dataLines) {
            const cols = this._parseLine(l, delimiter);
            const codigo = (cols[codigoIdx] || '').trim().replace(/['"]/g, '');
            if (!codigo) continue;
            const estRaw = (cols[estIdx] || '').trim().replace(/['"]/g, '');
            const estaciones = estRaw.split(/[,;|]/).map(s => parseInt(s.trim(), 10)).filter(n => Number.isFinite(n) && n > 0);
            const descripcion = descIdx >= 0 ? (cols[descIdx] || '').trim().replace(/['"]/g, '') : null;
            result.push({ codigo_sap: codigo, estaciones, descripcion });
        }
        return result;
    },

    _parseLine(line, delimiter) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"' && (i === 0 || line[i - 1] !== '\\')) inQuotes = !inQuotes;
            else if (c === delimiter && !inQuotes) { result.push(current); current = ''; }
            else current += c;
        }
        result.push(current);
        return result;
    },

    _renderAddModal() {
        const estOpts = this._estaciones.map(e => '<option value="' + e.id + '">' + e.nombre_estacion + ' (orden ' + (e.orden_secuencia_defecto || '-') + ')</option>').join('');
        return '<div id="carAddModal" class="modal-overlay" style="display:none;position:fixed;inset:0;background:rgba(15,23,42,0.5);backdrop-filter:blur(4px);z-index:9999;align-items:center;justify-content:center">'
            + '<div style="background:white;border-radius:16px;width:560px;max-width:95vw;max-height:90vh;overflow:auto;box-shadow:0 24px 64px rgba(0,0,0,0.3);animation:pcFadeUp 0.25s ease">'
            + '<div style="padding:18px 22px;border-bottom:1px solid #e2e8f0">'
            + '<h3 id="carAddTitle" style="margin:0;font-size:16px;font-weight:700;color:#0f172a">Nuevo Mapeo Carroceros</h3>'
            + '</div>'
            + '<div style="padding:20px 22px">'
            + '<div style="margin-bottom:12px"><label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Codigo SAP *</label>'
            + '<input id="carAddCodigo" class="form-control" placeholder="Ej: 12345.678" style="width:100%"></div>'
            + '<div style="margin-bottom:12px"><label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Descripcion (opcional)</label>'
            + '<input id="carAddDesc" class="form-control" placeholder="Descripcion o nombre" style="width:100%"></div>'
            + '<div style="margin-bottom:8px"><label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Estaciones (en orden) *</label>'
            + '<div id="carAddEstList" style="display:flex;flex-direction:column;gap:6px;margin-bottom:6px"></div>'
            + '<button onclick="App.modules.prod_carroceria.addEstRow()" class="btn btn-outline btn-sm" type="button"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Agregar Estacion</button>'
            + '<div style="display:flex;gap:8px;margin-top:18px;justify-content:flex-end">'
            + '<button onclick="App.modules.prod_carroceria.hideAddModal()" class="btn btn-outline">Cancelar</button>'
            + '<button onclick="App.modules.prod_carroceria.saveItem()" class="btn btn-primary" id="carSaveBtn">Guardar</button>'
            + '</div></div></div></div>';
    },

    addEstRow(estId) {
        const list = document.getElementById('carAddEstList');
        if (!list) return;
        const estOpts = '<option value="">Seleccionar estacion...</option>' + this._estaciones.map(e => '<option value="' + e.id + '"' + (e.id === estId ? ' selected' : '') + '>' + e.nombre_estacion + ' (#' + e.id + ' · orden ' + (e.orden_secuencia_defecto || '-') + ')</option>').join('');
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:6px;align-items:center';
        row.innerHTML = '<span style="background:#3b82f6;color:white;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">' + (list.children.length + 1) + '</span>'
            + '<select class="form-control car-est-sel" style="flex:1">' + estOpts + '</select>'
            + '<button onclick="this.parentElement.remove(); App.modules.prod_carroceria.renumberEstRows()" class="btn btn-sm btn-danger" title="Quitar"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>';
        list.appendChild(row);
    },

    renumberEstRows() {
        const list = document.getElementById('carAddEstList');
        if (!list) return;
        Array.from(list.children).forEach((row, i) => {
            const badge = row.querySelector('span');
            if (badge) badge.textContent = i + 1;
        });
    },

    showAddModal(id) {
        const m = document.getElementById('carAddModal');
        if (m) m.style.display = 'flex';
        document.getElementById('carAddEstList').innerHTML = '';
        if (id) {
            const it = this._items.find(x => x.id === id);
            if (!it) return;
            document.getElementById('carAddTitle').textContent = 'Editar Mapeo · ' + it.codigo_sap;
            document.getElementById('carAddCodigo').value = it.codigo_sap;
            document.getElementById('carAddCodigo').disabled = true;
            document.getElementById('carAddDesc').value = it.descripcion || '';
            const ids = Array.isArray(it.estaciones_json) ? it.estaciones_json : [];
            if (ids.length === 0) this.addEstRow();
            else ids.forEach(eid => this.addEstRow(eid));
            document.getElementById('carSaveBtn').onclick = () => this.saveItem(id);
        } else {
            document.getElementById('carAddTitle').textContent = 'Nuevo Mapeo Carroceros';
            document.getElementById('carAddCodigo').value = '';
            document.getElementById('carAddCodigo').disabled = false;
            document.getElementById('carAddDesc').value = '';
            this.addEstRow();
            this.addEstRow();
            document.getElementById('carSaveBtn').onclick = () => this.saveItem(0);
        }
    },

    hideAddModal() {
        const m = document.getElementById('carAddModal');
        if (m) m.style.display = 'none';
    },

    async saveItem(id) {
        const codigo = document.getElementById('carAddCodigo').value.trim();
        const descripcion = document.getElementById('carAddDesc').value.trim();
        const sels = document.querySelectorAll('.car-est-sel');
        const estaciones = [];
        sels.forEach(s => { const v = parseInt(s.value, 10); if (Number.isFinite(v) && v > 0) estaciones.push(v); });
        if (!codigo) { alert('Codigo SAP requerido'); return; }
        if (estaciones.length === 0) { alert('Agrega al menos una estacion'); return; }
        try {
            const r = await fetch('/api/produccion/procesos-carroceria', {
                method: 'POST',
                headers: this._headers(),
                body: JSON.stringify({ codigo_sap: codigo, estaciones_json: estaciones, descripcion })
            });
            if (!r.ok) {
                const err = await r.json().catch(() => ({}));
                throw new Error(err.error || 'Error al guardar');
            }
            this.hideAddModal();
            this.render();
        } catch (e) { alert('Error: ' + e.message); }
    },

    async deleteItem(id, codigo) {
        if (!confirm('Eliminar el mapeo de "' + codigo + '"?\n\nEl codigo volvera al enrutamiento estandar (familia + banderas).')) return;
        try {
            const r = await fetch('/api/produccion/procesos-carroceria/' + id, { method: 'DELETE', headers: this._headers() });
            if (!r.ok) throw new Error('Error al eliminar');
            this.render();
        } catch (e) { alert('Error: ' + e.message); }
    }
});
