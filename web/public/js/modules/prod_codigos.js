// ============================================================================
// Códigos de Producto (Configuración → Códigos) — rediseño del sistema
//   · Búsqueda 100% local (instantánea) — antes cada tecla consultaba al server.
//   · KPIs + badge "⚠ Sin receta" (clave para entender el rechazo de importación).
//   · "Limpiar Todo" reubicado en Zona de mantenimiento (fuera de las acciones
//     comunes: antes estaba al lado de "Nuevo" y borraba TODOS los códigos).
//   · Confirmaciones en modal (sin confirm()/alert() nativos) · formularios con
//     validación clara · escala 20/15/13/11/10 · acentos · es-CL.
// Mantiene: importar Excel (preview + upsert), exportar, grupos/familias
// encadenados con colores de grupo, y atajo "ver recetas" → pestaña Recetas BOM.
// ============================================================================
App.registerModule('prod_codigos', {
    codigos: [],
    editingId: null,
    _grupoColores: {},
    _filterTimer: null,

    // ── Permisos del modulo ──────────────────────────────────────────────────
    // Claves REALES del backend (api/src/routes/produccionConfig.js, MOD='prod_config'):
    //   prod_config (ver) · prod_config.agregar · prod_config.editar · prod_config.eliminar
    // Antes se consultaba 'produccion', permiso que NO existe en ALL_PERMS
    // (dbSchema.js), asi que todo usuario no admin perdia "Nuevo" y "Acciones".
    _perm() {
        const u = JSON.parse(localStorage.getItem('unified_user') || '{}');
        const p = u.permisos || [];
        const admin = u.rol === 'admin' || p.includes('usuarios');
        return {
            admin,
            ver: admin || p.includes('prod_config'),
            crear: admin || p.includes('prod_config.agregar'),
            editar: admin || p.includes('prod_config.editar'),
            eliminar: admin || p.includes('prod_config.eliminar')
        };
    },

    async render() {
        const el = document.getElementById('page-prod_codigos');
        const perm = this._perm();

        el.innerHTML = this._estilos() + `
            <div class="pc-hero">
                <div>
                    <h2>Códigos de Producto</h2>
                    <p>Catálogo maestro de códigos SAP · Grupo, Familia, Bloque de Tela</p>
                </div>
                ${(perm.crear || perm.ver) ? `<div class="pc-hero-actions">
                    ${perm.crear ? `<button class="pc-hbtn" onclick="App.modules.prod_codigos.importarExcel()">⬆ Importar</button>` : ''}
                    <button class="pc-hbtn" onclick="App.modules.prod_codigos.exportarExcel()">⬇ Exportar</button>
                    ${perm.crear ? `<button class="pc-hbtn solid" onclick="App.modules.prod_codigos.showCreateModal()">＋ Nuevo Código</button>` : ''}
                    ${perm.admin ? `
                    <div class="pc-mant">
                        <button class="pc-hbtn ghost-danger" onclick="App.modules.prod_codigos.toggleMant(event)">⚠ Zona de mantenimiento</button>
                        <div class="pc-mant-drop" id="pcMantDrop">
                            <div class="it danger" onclick="App.modules.prod_codigos.deleteAll()">🗑 Limpiar Todo (eliminar todos los códigos)</div>
                        </div>
                    </div>` : ''}
                </div>` : ''}
            </div>

            <div class="pc-kpis">
                <div class="pc-kpi"><div class="k">Total códigos</div><div class="v" id="codTotal">0</div><div class="s">en el catálogo</div></div>
                <div class="pc-kpi"><div class="k">Grupos</div><div class="v" id="codGrupos">0</div><div class="s">de producción</div></div>
                <div class="pc-kpi"><div class="k">Familias</div><div class="v" id="codFamilias">0</div><div class="s">de producto</div></div>
                <div class="pc-kpi"><div class="k">Sin receta BOM</div><div class="v" id="codSinReceta">0</div><div class="s">no importables desde SAP</div></div>
            </div>

            <div class="pc-toolbar">
                <div class="pc-search">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8494a8" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" id="codFilterSearch" placeholder="Buscar código o descripción..." oninput="App.modules.prod_codigos.filter()">
                </div>
                <select id="codFilterGrupo" onchange="App.modules.prod_codigos.onGrupoChange()"><option value="">Todos los grupos</option></select>
                <select id="codFilterFamilia" onchange="App.modules.prod_codigos.filter()"><option value="">Todas las familias</option></select>
                <span class="pc-flimpiar" onclick="App.modules.prod_codigos.limpiarFiltros()">Limpiar filtros</span>
                <span class="pc-count" id="codCount"></span>
            </div>

            <div class="pc-panel">
                <div class="pc-table-wrap">
                    <table class="pc-table">
                        <thead><tr>
                            <th>Código</th><th>Descripción</th><th>Grupo</th><th>Familia</th><th>Recetas</th><th class="th-acc">Acciones</th>
                        </tr></thead>
                        <tbody id="codTable"><tr><td colspan="6" class="pc-loading">Cargando códigos...</td></tr></tbody>
                    </table>
                </div>
                <div id="codCardsMobile" class="pc-cards-mobile"></div>
            </div>

            <!-- Modal crear / editar -->
            <div class="pc-overlay" id="codCreateModal">
                <div class="pc-modal sm" onclick="event.stopPropagation()">
                    <div class="pc-modal-head"><h3 id="codModalTitle">Nuevo Código</h3><button class="pc-x" onclick="App.modules.prod_codigos.hideCreateModal()">✕</button></div>
                    <div class="pc-modal-body">
                        <div class="pc-field"><label>Código SAP *</label>
                            <input id="codCodigo" placeholder="Ej: V4761, V659, P123" autocomplete="off">
                            <div class="pc-err" id="codErrCodigo"></div></div>
                        <div class="pc-field"><label>Descripción</label>
                            <input id="codDescripcion" placeholder="Ej: PUERTA MP SENIOR G7 ELECTRICO"></div>
                        <div class="pc-field"><label>Grupo</label><select id="codGrupo"></select></div>
                        <div class="pc-field"><label>Familia</label><select id="codFamilia"></select></div>
                        <div class="pc-hint" id="codFormHint">Al guardar, el código quedará disponible para las Recetas BOM y la importación SAP.</div>
                    </div>
                    <div class="pc-modal-foot">
                        <button class="pc-btn ghost" onclick="App.modules.prod_codigos.hideCreateModal()">Cancelar</button>
                        <button class="pc-btn primary" id="codSaveBtn" onclick="App.modules.prod_codigos.save()">Guardar</button>
                    </div>
                </div>
            </div>

            <!-- Modal importar -->
            <div class="pc-overlay" id="codImportModal">
                <div class="pc-modal" onclick="event.stopPropagation()">
                    <div class="pc-modal-head"><h3>Importar Códigos SAP</h3><button class="pc-x" onclick="App.modules.prod_codigos.hideImportModal()">✕</button></div>
                    <div class="pc-modal-body">
                        <div id="codImportArea" class="pc-drop" onclick="document.getElementById('codImportFile').click()">
                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                            <div class="t">Arrastra un Excel o haz clic para seleccionar</div>
                            <div id="codImportName" class="ok"></div>
                        </div>
                        <input type="file" id="codImportFile" accept=".xlsx,.xls,.csv" style="display:none" onchange="App.modules.prod_codigos.handleImportFile(event)">
                        <div id="codImportPreview" class="pc-preview" style="display:none">
                            <div class="pc-info ok"><strong>Vista previa del archivo</strong><div id="codPreviewStats" style="margin-top:6px"></div></div>
                            <div id="codPreviewSample" class="pc-sample"></div>
                        </div>
                        <div class="pc-info" style="margin-top:12px">
                            <strong>Columnas esperadas:</strong> Codigo, Descripcion, Grupo, Familia<br>
                            <em>Si el código ya existe, actualiza los datos (upsert).</em>
                        </div>
                    </div>
                    <div class="pc-modal-foot">
                        <button class="pc-btn ghost" onclick="App.modules.prod_codigos.hideImportModal()">Cancelar</button>
                        <button class="pc-btn primary" id="codImportBtn" onclick="App.modules.prod_codigos.doImport()" disabled>Importar</button>
                    </div>
                </div>
            </div>

            <!-- Modal confirmación -->
            <div class="pc-overlay" id="pcConfirmOverlay">
                <div class="pc-modal sm" onclick="event.stopPropagation()">
                    <div class="pc-modal-head"><h3 id="pcConfirmTitle">Confirmar</h3><button class="pc-x" onclick="App.modules.prod_codigos.closeConfirm()">✕</button></div>
                    <div class="pc-modal-body"><p class="pc-confirm-text" id="pcConfirmText"></p></div>
                    <div class="pc-modal-foot">
                        <button class="pc-btn ghost" onclick="App.modules.prod_codigos.closeConfirm()">Cancelar</button>
                        <button class="pc-btn danger" id="pcConfirmBtn">Confirmar</button>
                    </div>
                </div>
            </div>`;
        await this.load();
        this.setupDragDrop();
        this._setupMenus();
    },

    // ---------------- Carga (una sola vez; el filtro es local) ----------------
    async load() {
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const headers = { 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' };
            const [res, capRes] = await Promise.all([
                fetch('/api/produccion/codigos', { headers }),
                fetch('/api/produccion/capacidad-grupo', { headers })
            ]);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            this.codigos = await res.json();
            const capGrupos = capRes.ok ? await capRes.json() : [];
            this._grupoColores = {};
            capGrupos.forEach(g => { this._grupoColores[g.grupo] = g.color || '#2563eb'; });
            this.renderStats();
            this.populateFilters();
            this._applyFilters(document.getElementById('codFilterGrupo')?.value || '', document.getElementById('codFilterFamilia')?.value || '');
        } catch (e) {
            console.error('Error loading codigos:', e);
            App.showAlert('Error al cargar códigos: ' + e.message, 'danger');
        }
    },

    renderStats() {
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('codTotal', this.codigos.length);
        set('codGrupos', new Set(this.codigos.map(c => c.grupo).filter(Boolean)).size);
        set('codFamilias', new Set(this.codigos.map(c => c.familia).filter(Boolean)).size);
        set('codSinReceta', this.codigos.filter(c => !(parseInt(c.recetas_count) > 0)).length);
    },

    populateFilters() {
        const grupos = [...new Set(this.codigos.map(c => c.grupo).filter(Boolean))].sort();
        const grupoSel = document.getElementById('codFilterGrupo');
        if (grupoSel) {
            const actual = grupoSel.value;
            grupoSel.innerHTML = '<option value="">Todos los grupos</option>' + grupos.map(g =>
                `<option value="${escAttr(g)}" data-color="${escAttr(this._grupoColores[g] || '#2563eb')}" ${g === actual ? 'selected' : ''}>${escText(g)}</option>`
            ).join('');
        }
        this._updateFamiliasFilter();
    },

    _updateFamiliasFilter() {
        const grupo = document.getElementById('codFilterGrupo')?.value || '';
        const familiaSel = document.getElementById('codFilterFamilia');
        if (!familiaSel) return;
        const actual = familiaSel.value;
        const filtered = grupo ? this.codigos.filter(c => c.grupo === grupo) : this.codigos;
        const familias = [...new Set(filtered.map(c => c.familia).filter(Boolean))].sort();
        familiaSel.innerHTML = '<option value="">Todas las familias</option>' + familias.map(f =>
            `<option value="${escAttr(f)}" ${f === actual ? 'selected' : ''}>${escText(f)}</option>`
        ).join('');
    },

    onGrupoChange() {
        this._updateFamiliasFilter();
        this.filter();
    },

    limpiarFiltros() {
        const s = document.getElementById('codFilterSearch'); if (s) s.value = '';
        const g = document.getElementById('codFilterGrupo'); if (g) g.value = '';
        const f = document.getElementById('codFilterFamilia'); if (f) f.value = '';
        this._updateFamiliasFilter();
        this.filter();
    },

    // Filtrado 100% local (instantáneo): nada de volver al servidor por tecla.
    filter() {
        clearTimeout(this._filterTimer);
        this._filterTimer = setTimeout(() => {
            this._applyFilters(
                document.getElementById('codFilterGrupo')?.value || '',
                document.getElementById('codFilterFamilia')?.value || ''
            );
        }, 80);
    },

    _applyFilters(grupo, familia) {
        const search = (document.getElementById('codFilterSearch')?.value || '').trim().toLowerCase();
        let filtered = this.codigos;
        if (grupo) filtered = filtered.filter(c => c.grupo === grupo);
        if (familia) filtered = filtered.filter(c => c.familia === familia);
        if (search) {
            filtered = filtered.filter(c =>
                (c.codigo || '').toLowerCase().includes(search)
                || (c.descripcion || '').toLowerCase().includes(search));
        }
        this.renderTable(filtered);
    },

    // ---------------- Tabla ----------------
    renderTable(codigos) {
        const tbody = document.getElementById('codTable');
        const cardsMobile = document.getElementById('codCardsMobile');
        const count = document.getElementById('codCount');
        if (count) count.textContent = '(' + codigos.length + ' código' + (codigos.length === 1 ? '' : 's') + ')';
        const perm = this._perm();
        const puedeEditar = perm.editar || perm.eliminar;

        if (!codigos.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="pc-loading">Sin resultados</td></tr>';
            if (cardsMobile) cardsMobile.innerHTML = '<div class="pc-loading">Sin resultados</div>';
            return;
        }

        const grupoBadge = (grupo) => {
            if (!grupo) return '<span class="pc-none">—</span>';
            const hex = this._grupoColores[grupo] || '#2563eb';
            return `<span class="pc-badge-grupo" style="background:${escAttr(hex)}1f;color:${escAttr(hex)}">${escText(grupo)}</span>`;
        };
        const familiaBadge = (familia) => familia
            ? `<span class="pc-badge-fam">${escText(familia)}</span>`
            : '<span class="pc-none">—</span>';
        const recetasBadge = (c) => {
            const rc = parseInt(c.recetas_count) || 0;
            if (rc > 0) {
                return `<span class="pc-badge-rec" onclick="App.modules.prod_codigos.verRecetas('${escJs(c.codigo)}')" title="Ver ${rc} receta(s) BOM">📄 ${rc}</span>`;
            }
            return '<span class="pc-badge-sin" title="Sin Receta BOM: la importación SAP rechazará este código hasta que cree su receta en Configuración → Recetas BOM">⚠ Sin receta</span>';
        };
        const acciones = (c) => puedeEditar ? `
            <div class="pc-amenu"><button class="pc-amenu-btn" onclick="App.modules.prod_codigos.toggleAcciones(event)">Acciones ▾</button>
            <div class="pc-amenu-drop">
                ${perm.editar ? `<div class="it" onclick="App.modules.prod_codigos.edit(${c.id})">✏️ Editar código</div>` : ''}
                ${perm.editar && perm.eliminar ? '<div class="sep"></div>' : ''}
                ${perm.eliminar ? `<div class="it danger" onclick="App.modules.prod_codigos.delete(${c.id})">🗑 Eliminar código</div>` : ''}
            </div></div>` : '';

        tbody.innerHTML = codigos.map(c => `
            <tr>
                <td class="c-cod"><strong>${escText(c.codigo)}</strong></td>
                <td class="c-desc">${escText(c.descripcion || '—')}</td>
                <td>${grupoBadge(c.grupo)}</td>
                <td>${familiaBadge(c.familia)}</td>
                <td class="c-rec">${recetasBadge(c)}</td>
                <td class="c-acc">${acciones(c)}</td>
            </tr>`).join('');

        if (cardsMobile) {
            cardsMobile.innerHTML = codigos.map(c => `
                <div class="pc-mcard">
                    <div class="t1"><strong>${escText(c.codigo)}</strong>${recetasBadge(c)}</div>
                    <div class="sub2">${escText(c.descripcion || '—')}</div>
                    <div class="badges">${grupoBadge(c.grupo)} ${familiaBadge(c.familia)}</div>
                    <div class="acc">${acciones(c)}</div>
                </div>`).join('');
        }
    },

    // ---------------- Modal crear / editar ----------------
    async _populateGrupoFamilia(selectedGrupo, selectedFamilia) {
        let capGrupos = [];
        try {
            const res = await fetch('/api/produccion/capacidad-grupo');
            capGrupos = await res.json();
        } catch (e) { /* el modal funciona sin colores */ }
        const grupos = capGrupos.map(g => g.grupo).sort();
        const colorMap = {};
        capGrupos.forEach(g => { colorMap[g.grupo] = g.color || '#2563eb'; });
        this._grupoColores = { ...this._grupoColores, ...colorMap };
        const grupoFamilias = {};
        (this.codigos || []).forEach(c => {
            if (c.grupo && c.familia) {
                if (!grupoFamilias[c.grupo]) grupoFamilias[c.grupo] = new Set();
                grupoFamilias[c.grupo].add(c.familia);
            }
        });
        this._grupoFamilias = grupoFamilias;
        const gSel = document.getElementById('codGrupo');
        const cur = selectedGrupo || '';
        if (gSel) {
            gSel.innerHTML = '<option value="">-- Seleccionar grupo --</option>'
                + grupos.map(g => {
                    const hex = colorMap[g] || '#2563eb';
                    return `<option value="${escAttr(g)}" data-color="${escAttr(hex)}" ${g === cur ? 'selected' : ''}>${escText(g)}</option>`;
                }).join('');
            if (cur && !grupos.includes(cur)) gSel.innerHTML += `<option value="${escAttr(cur)}" selected>${escText(cur)}</option>`;
            const applyGrupoColor = () => {
                const sel = gSel.options[gSel.selectedIndex];
                gSel.style.borderLeft = (sel && sel.value) ? `4px solid ${sel.getAttribute('data-color') || '#2563eb'}` : '';
            };
            gSel.onchange = () => { this._filterFamiliasByGrupo(); applyGrupoColor(); };
            applyGrupoColor();
        }
        this._filterFamiliasByGrupo(selectedFamilia);
    },

    _filterFamiliasByGrupo(selectedFamilia) {
        const gSel = document.getElementById('codGrupo');
        const fSel = document.getElementById('codFamilia');
        if (!fSel) return;
        const grupo = gSel ? gSel.value : '';
        const all = this.codigos || [];
        let familias;
        if (grupo && this._grupoFamilias && this._grupoFamilias[grupo]) {
            familias = [...this._grupoFamilias[grupo]].sort();
        } else {
            familias = [...new Set(all.map(c => c.familia).filter(Boolean))].sort();
        }
        const cur = selectedFamilia || fSel.value || '';
        fSel.innerHTML = '<option value="">-- Seleccionar familia --</option>'
            + familias.map(f => `<option value="${escAttr(f)}" ${f === cur ? 'selected' : ''}>${escText(f)}</option>`).join('');
        if (cur && !familias.includes(cur)) fSel.innerHTML += `<option value="${escAttr(cur)}" selected>${escText(cur)}</option>`;
    },

    async showCreateModal() {
        this.editingId = null;
        document.getElementById('codModalTitle').textContent = 'Nuevo Código';
        document.getElementById('codCodigo').value = '';
        document.getElementById('codCodigo').disabled = false;
        document.getElementById('codDescripcion').value = '';
        document.getElementById('codErrCodigo').style.display = 'none';
        document.getElementById('codFormHint').textContent = 'Al guardar, el código quedará disponible para las Recetas BOM y la importación SAP.';
        await this._populateGrupoFamilia('', '');
        document.getElementById('codCreateModal').style.display = 'flex';
    },

    async edit(id) {
        const c = (this.codigos || []).find(x => x.id === id);
        if (!c) return;
        this.editingId = id;
        document.getElementById('codModalTitle').textContent = 'Editar Código';
        document.getElementById('codCodigo').value = c.codigo || '';
        document.getElementById('codCodigo').disabled = true;
        document.getElementById('codDescripcion').value = c.descripcion || '';
        document.getElementById('codErrCodigo').style.display = 'none';
        document.getElementById('codFormHint').textContent = 'El código SAP no se puede cambiar; sí su descripción, grupo y familia.';
        await this._populateGrupoFamilia(c.grupo || '', c.familia || '');
        document.getElementById('codCreateModal').style.display = 'flex';
    },

    hideCreateModal() { document.getElementById('codCreateModal').style.display = 'none'; },

    async save() {
        const codigo = document.getElementById('codCodigo').value.trim();
        const descripcion = document.getElementById('codDescripcion').value.trim();
        const grupo = document.getElementById('codGrupo').value.trim();
        const familia = document.getElementById('codFamilia').value.trim();
        const err = document.getElementById('codErrCodigo');
        if (!codigo) {
            err.textContent = 'Escribe el código SAP (ej: V4761)';
            err.style.display = 'block';
            return;
        }
        err.style.display = 'none';
        const btn = document.getElementById('codSaveBtn');
        btn.disabled = true; btn.textContent = 'Guardando...';
        try {
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const headers = { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' };
            const res = this.editingId
                ? await fetch(`/api/produccion/codigos/${this.editingId}`, { method: 'PUT', headers, body: JSON.stringify({ descripcion, grupo, familia }) })
                : await fetch('/api/produccion/codigos', { method: 'POST', headers, body: JSON.stringify({ codigo, descripcion, grupo, familia }) });
            const data = await res.json();
            if (res.ok) {
                this.hideCreateModal();
                App.toast(this.editingId ? 'Código actualizado' : 'Código creado');
                await this.load();
            } else {
                if (/existe|registrado/i.test(data.error || '')) {
                    err.textContent = data.error;
                    err.style.display = 'block';
                } else {
                    App.showAlert(data.error || 'Error al guardar', 'danger');
                }
            }
        } catch (e) { App.showAlert('Error: ' + e.message, 'danger'); }
        btn.disabled = false; btn.textContent = 'Guardar';
    },

    // ---------------- Eliminar (con modal de confirmación) ----------------
    _confirmar(titulo, html, textoBoton, accion) {
        document.getElementById('pcConfirmTitle').textContent = titulo;
        document.getElementById('pcConfirmText').innerHTML = html;
        const btn = document.getElementById('pcConfirmBtn');
        btn.textContent = textoBoton;
        btn.onclick = () => { this.closeConfirm(); accion(); };
        document.getElementById('pcConfirmOverlay').style.display = 'flex';
    },
    closeConfirm() { document.getElementById('pcConfirmOverlay').style.display = 'none'; },

    delete(id) {
        const c = (this.codigos || []).find(x => x.id === id);
        if (!c) return;
        this._confirmar('Eliminar código',
            `Se eliminará el código <strong>${escText(c.codigo)}</strong>${c.descripcion ? ' (' + escText(c.descripcion) + ')' : ''} del catálogo.<br><br>⚠️ Si tiene Recetas BOM asociadas, la importación SAP dejará de reconocerlo.`,
            'Eliminar', async () => {
                try {
                    const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
                    await apiJson(await fetch(`/api/produccion/codigos/${id}`, {
                        method: 'DELETE', headers: { 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' }
                    }));
                    App.toast('Código eliminado');
                    await this.load();
                } catch (e) { App.showAlert('Error: ' + e.message, 'danger'); }
            });
    },

    deleteAll() {
        this._cerrarMant();
        this._confirmar('Limpiar TODO',
            'Se eliminarán <strong>TODOS los códigos de producto</strong> del catálogo. <strong>Esta acción no se puede deshacer.</strong><br><br>Las Recetas BOM asociadas quedarán huérfanas y la importación SAP dejará de reconocer esos códigos.',
            'Eliminar todos los códigos', async () => {
                try {
                    const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
                    const res = await fetch('/api/produccion/codigos/all', {
                        method: 'DELETE', headers: { 'X-User-Email': user.email || '' }
                    });
                    const data = await res.json();
                    if (res.ok) {
                        App.toast(`${data.eliminados} códigos eliminados`);
                        await this.load();
                    } else { App.showAlert(data.error || 'Error al eliminar', 'danger'); }
                } catch (e) { App.showAlert('Error: ' + e.message, 'danger'); }
            });
    },

    // ---------------- Importar / Exportar ----------------
    setupDragDrop() {
        const area = document.getElementById('codImportArea');
        if (!area) return;
        area.addEventListener('dragover', e => { e.preventDefault(); area.style.borderColor = '#3b82f6'; area.style.background = '#eff6ff'; });
        area.addEventListener('dragleave', () => { area.style.borderColor = '#cbd5e1'; area.style.background = ''; });
        area.addEventListener('drop', e => { e.preventDefault(); area.style.borderColor = '#cbd5e1'; area.style.background = ''; if (e.dataTransfer.files.length) this.handleImportFile({ target: { files: e.dataTransfer.files } }); });
    },

    selectedImportFile: null,

    handleImportFile(e) {
        const file = e.target.files[0];
        if (!file) return;
        this.selectedImportFile = file;
        const nameEl = document.getElementById('codImportName');
        nameEl.textContent = '✓ ' + file.name;
        nameEl.style.display = 'block';
        document.getElementById('codImportPreview').style.display = 'none';
        document.getElementById('codImportBtn').disabled = true;
        this.doPreview();
    },

    importarExcel() {
        document.getElementById('codImportModal').style.display = 'flex';
        this.selectedImportFile = null;
    },
    hideImportModal() {
        document.getElementById('codImportModal').style.display = 'none';
        this.selectedImportFile = null;
        const n = document.getElementById('codImportName'); if (n) n.style.display = 'none';
        const b = document.getElementById('codImportBtn'); if (b) b.disabled = true;
        const p = document.getElementById('codImportPreview'); if (p) p.style.display = 'none';
    },

    async doPreview() {
        if (!this.selectedImportFile) return;
        try {
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = () => reject(new Error('Error al leer'));
                reader.readAsDataURL(this.selectedImportFile);
            });
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const res = await fetch('/api/produccion/codigos/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' },
                body: JSON.stringify({ excel_data: base64 })
            });
            const data = await res.json();
            if (!res.ok) { App.showAlert(data.error || 'Error al leer el archivo', 'danger'); return; }

            document.getElementById('codPreviewStats').innerHTML = `
                <strong>${data.con_codigo}</strong> registros a importar<br>
                ${data.duplicados > 0 ? `<span style="color:#b45309">${data.duplicados}</span> duplicados (se omiten)<br>` : ''}
                ${data.sin_codigo > 0 ? `<span style="color:#dc2626">${data.sin_codigo}</span> filas sin código (se omiten)<br>` : ''}
                <span style="color:#8494a8">Columnas: ${escText(data.columnas_detectadas.slice(0, 6).join(', '))}${data.columnas_detectadas.length > 6 ? '...' : ''}</span>`;

            const sample = document.getElementById('codPreviewSample');
            if (data.muestra && data.muestra.length > 0) {
                sample.innerHTML = '<div style="font-weight:700;margin-bottom:6px;color:#334155;font-size:11px">Primeros registros:</div>'
                    + data.muestra.map(r => `<div class="row"><b>${this.esc(r.codigo)}</b> — ${this.esc(r.descripcion || '-')} <span class="sub2">| ${this.esc(r.grupo || '-')} | ${this.esc(r.familia || '-')}</span></div>`).join('');
            } else { sample.innerHTML = ''; }

            document.getElementById('codImportPreview').style.display = 'block';
            document.getElementById('codImportBtn').disabled = false;
            this._previewBase64 = base64;
        } catch (e) { App.showAlert('Error: ' + e.message, 'danger'); }
    },

    esc(s) { return escText(s); },

    async doImport() {
        if (!this.selectedImportFile) return;
        const btn = document.getElementById('codImportBtn');
        btn.textContent = 'Importando...';
        btn.disabled = true;
        try {
            const base64 = this._previewBase64 || await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = () => reject(new Error('Error al leer'));
                reader.readAsDataURL(this.selectedImportFile);
            });
            const user = JSON.parse(localStorage.getItem('unified_user') || '{}');
            const res = await fetch('/api/produccion/codigos/importar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Permisos': (user.permisos || []).join(','), 'X-User-Email': user.email || '' },
                body: JSON.stringify({ excel_data: base64 })
            });
            const data = await res.json();
            if (res.ok) {
                App.toast(`Importados: ${data.importados} códigos. Errores: ${data.errores?.length || 0}`);
                this.hideImportModal();
                await this.load();
            } else { App.showAlert(data.error || 'Error al importar', 'danger'); }
        } catch (e) { App.showAlert('Error: ' + e.message, 'danger'); }
        btn.textContent = 'Importar';
        btn.disabled = false;
    },

    exportarExcel() {
        if (!this.codigos.length) { App.showAlert('No hay códigos para exportar', 'danger'); return; }
        const rows = this.codigos.map(c => ({
            'Codigo': c.codigo,
            'Descripcion': c.descripcion || '',
            'Grupo': c.grupo || '',
            'Familia': c.familia || ''
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Codigos SAP');
        XLSX.writeFile(wb, 'codigos_sap_export.xlsx');
        App.toast('Archivo exportado: codigos_sap_export.xlsx');
    },

    // Atajo: ver las recetas BOM de un código (va a la pestaña y busca)
    verRecetas(codigo) {
        App.modules.prod_config.switchTab('recetas');
        setTimeout(() => {
            const searchInput = document.getElementById('recFilterSearch');
            if (searchInput) { searchInput.value = codigo; App.modules.prod_recetas.filter(); }
        }, 300);
    },

    // ---------------- Menú de acciones (popover fijo, patrón del sistema) ----------------
    toggleAcciones(e) {
        e.stopPropagation();
        const wrap = e.currentTarget.parentElement;
        const menu = wrap.querySelector('.pc-amenu-drop');
        if (!menu) return;
        const wasVisible = menu.style.display === 'block';
        this._cerrarMenus();
        if (wasVisible) return;
        const rect = e.currentTarget.getBoundingClientRect();
        menu.style.display = 'block';
        menu.style.top = '0px';
        menu.style.left = '0px';
        const mh = menu.offsetHeight, mw = menu.offsetWidth;
        const espacioAbajo = window.innerHeight - rect.bottom;
        menu.style.top = (espacioAbajo < mh + 12 ? Math.max(8, rect.top - mh - 6) : rect.bottom + 6) + 'px';
        menu.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - mw - 8)) + 'px';
    },
    _cerrarMenus() {
        document.querySelectorAll('.pc-amenu-drop').forEach(d => d.style.display = 'none');
    },
    _setupMenus() {
        if (this._menusBound) return;
        this._menusBound = true;
        document.addEventListener('click', () => this._cerrarMenus());
        window.addEventListener('scroll', () => this._cerrarMenus(), true);
        window.addEventListener('resize', () => this._cerrarMenus());
    },

    // ---------------- Zona de mantenimiento ----------------
    toggleMant(e) {
        e.stopPropagation();
        const drop = document.getElementById('pcMantDrop');
        const wasVisible = drop.style.display === 'block';
        drop.style.display = wasVisible ? 'none' : 'block';
    },
    _cerrarMant() {
        const drop = document.getElementById('pcMantDrop');
        if (drop) drop.style.display = 'none';
    },

    // ---------------- Estilos (escala 20/15/13/11/10) ----------------
    _estilos() {
        return `<style>
            .pc-hero{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 55%,#1e40af 100%);border-radius:16px;padding:20px 26px;display:flex;align-items:center;gap:14px;position:relative;overflow:hidden;margin-bottom:16px}
            .pc-hero::after{content:'';position:absolute;left:0;right:0;bottom:0;height:1px;background:linear-gradient(90deg,transparent,rgba(147,197,253,.55),transparent)}
            .pc-hero h2{color:#fff;font-size:20px;font-weight:700;margin:0}
            .pc-hero p{color:rgba(255,255,255,.62);font-size:11px;margin:4px 0 0}
            .pc-hero-actions{margin-left:auto;display:flex;gap:8px;align-items:center}
            .pc-hbtn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);color:#fff;cursor:pointer;font-size:11px;font-weight:600;white-space:nowrap}
            .pc-hbtn:hover{background:rgba(255,255,255,.2)}
            .pc-hbtn.solid{background:#fff;color:#1e3a5f;border-color:#fff}
            .pc-hbtn.solid:hover{background:#e8eefb}
            .pc-hbtn.ghost-danger{border-color:rgba(248,113,113,.5);color:#fca5a5}
            .pc-mant{position:relative}
            .pc-mant-drop{display:none;position:absolute;right:0;top:110%;background:#fff;border:1px solid #e4e9f0;border-radius:10px;box-shadow:0 12px 32px rgba(15,23,42,.16);min-width:250px;padding:5px;z-index:60}
            .pc-mant-drop .it{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap}
            .pc-mant-drop .it:hover{background:#f8fafc}
            .pc-mant-drop .it.danger{color:#dc2626}

            .pc-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}
            .pc-kpi{background:#fff;border:1px solid #e4e9f0;border-radius:12px;padding:13px 16px}
            .pc-kpi .k{font-size:10px;font-weight:600;letter-spacing:.7px;text-transform:uppercase;color:#8494a8}
            .pc-kpi .v{font-size:20px;font-weight:700;margin-top:4px;color:#0f172a}
            .pc-kpi .s{font-size:10px;color:#8494a8;margin-top:2px}

            .pc-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
            .pc-search{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #e4e9f0;border-radius:10px;padding:0 12px;flex:1;min-width:220px;max-width:340px}
            .pc-search input{border:none;outline:none;padding:10px 0;font-size:13px;width:100%;background:transparent;color:#0f172a}
            .pc-toolbar select{padding:10px 12px;border:1px solid #e4e9f0;border-radius:10px;font-size:11px;font-weight:600;background:#fff;color:#475569;outline:none}
            .pc-flimpiar{font-size:11px;font-weight:600;color:#b45309;cursor:pointer;padding:8px 10px}
            .pc-flimpiar:hover{text-decoration:underline}
            .pc-count{font-size:11px;color:#8494a8;font-weight:600}

            .pc-panel{background:#fff;border:1px solid #e4e9f0;border-radius:14px;overflow:hidden}
            .pc-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
            .pc-table{width:100%;border-collapse:collapse;min-width:760px}
            .pc-table th{padding:10px 14px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#8494a8;background:#f8fafc;border-bottom:1px solid #e4e9f0;white-space:nowrap}
            .pc-table td{padding:11px 14px;font-size:13px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
            .pc-table tbody tr:hover{background:#f8fafc}
            .pc-table .th-acc{text-align:right}
            .pc-table .c-cod strong{color:#0f172a}
            .pc-table .c-desc{color:#475569}
            .pc-table .c-acc{text-align:right;white-space:nowrap}
            .pc-loading{text-align:center;padding:32px;color:#8494a8;font-size:13px}
            .pc-none{color:#cbd5e1}

            .pc-badge-grupo{display:inline-flex;padding:3px 9px;border-radius:20px;font-size:10px;font-weight:700}
            .pc-badge-fam{display:inline-flex;padding:3px 9px;border-radius:20px;font-size:10px;font-weight:700;background:#dcfce7;color:#15803d}
            .pc-badge-rec{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:20px;font-size:10px;font-weight:700;background:#ede9fe;color:#7c3aed;cursor:pointer}
            .pc-badge-rec:hover{background:#ddd6fe}
            .pc-badge-sin{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:20px;font-size:10px;font-weight:700;background:#fef3c7;color:#b45309;cursor:help}

            .pc-icon-btn{width:28px;height:28px;border-radius:7px;border:1px solid #e2e8f0;background:#fff;color:#475569;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
            .pc-icon-btn:hover{background:#f1f5f9}
            .pc-icon-btn.danger{color:#dc2626;border-color:#fecaca}

            .pc-amenu{position:relative;display:inline-block}
            .pc-amenu-btn{padding:6px 11px;border-radius:7px;border:1px solid #e4e9f0;background:#fff;color:#475569;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap}
            .pc-amenu-btn:hover{background:#f8fafc}
            .pc-amenu-drop{display:none;position:fixed;z-index:95;background:#fff;border:1px solid #e4e9f0;border-radius:10px;box-shadow:0 12px 32px rgba(15,23,42,.16);min-width:190px;padding:5px}
            .pc-amenu-drop .it{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:7px;font-size:11px;font-weight:600;color:#475569;cursor:pointer;white-space:nowrap}
            .pc-amenu-drop .it:hover{background:#f8fafc}
            .pc-amenu-drop .it.danger{color:#dc2626}
            .pc-amenu-drop .sep{height:1px;background:#e4e9f0;margin:5px 8px}

            .pc-overlay{display:none;position:fixed;inset:0;z-index:80;align-items:center;justify-content:center;background:rgba(15,23,42,.5);backdrop-filter:blur(4px)}
            .pc-modal{background:#fff;border-radius:16px;width:92%;max-width:560px;max-height:86vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(15,23,42,.3)}
            .pc-modal.sm{max-width:420px}
            .pc-modal-head{padding:18px 24px;border-bottom:1px solid #e4e9f0;display:flex;align-items:center;justify-content:space-between;gap:10px}
            .pc-modal-head h3{margin:0;font-size:15px;font-weight:700}
            .pc-modal-body{padding:20px 24px;overflow-y:auto}
            .pc-modal-foot{padding:14px 24px 20px;display:flex;gap:8px;justify-content:flex-end;border-top:1px solid #e4e9f0}
            .pc-x{width:28px;height:28px;border-radius:8px;border:none;background:#f1f5f9;color:#64748b;cursor:pointer;font-size:13px}
            .pc-x:hover{background:#e2e8f0}

            .pc-btn{padding:9px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid transparent}
            .pc-btn.primary{background:#1e40af;color:#fff}
            .pc-btn.primary:hover{background:#1e3a8a}
            .pc-btn.primary:disabled{opacity:.6;cursor:default}
            .pc-btn.ghost{background:#fff;color:#475569;border-color:#e4e9f0}
            .pc-btn.ghost:hover{background:#f8fafc}
            .pc-btn.danger{background:#dc2626;color:#fff}
            .pc-btn.danger:hover{background:#b91c1c}

            .pc-field{margin-bottom:13px}
            .pc-field > label{display:block;font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#475569;margin-bottom:5px}
            .pc-field input,.pc-field select{width:100%;padding:10px 12px;border:1px solid #e4e9f0;border-radius:8px;font-size:13px;outline:none;color:#0f172a;background:#fff}
            .pc-field input:focus,.pc-field select:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.12)}
            .pc-err{display:none;color:#dc2626;font-size:11px;font-weight:600;margin-top:5px}
            .pc-hint{font-size:11px;color:#8494a8}
            .pc-confirm-text{font-size:13px;color:#475569;line-height:1.6;margin:0}

            .pc-drop{border:2px dashed #cbd5e1;border-radius:12px;padding:28px;text-align:center;cursor:pointer;transition:all .2s;background:#f8fafc}
            .pc-drop .t{color:#64748b;font-size:13px}
            .pc-drop .ok{color:#15803d;font-weight:600;margin-top:8px;display:none;font-size:11px}
            .pc-info{background:#f8fafc;border:1px solid #e4e9f0;border-radius:10px;padding:14px;font-size:11px;color:#64748b;line-height:1.6}
            .pc-info.ok{background:#f0fdf4;border-color:#bbf7d0;color:#166534}
            .pc-info strong{color:inherit}
            .pc-preview{margin-top:12px;display:flex;flex-direction:column;gap:8px}
            .pc-sample{max-height:150px;overflow-y:auto;font-size:11px;color:#475569}
            .pc-sample .row{padding:4px 0;border-bottom:1px solid #f1f5f9}
            .pc-sample .sub2{color:#8494a8}

            .pc-cards-mobile{display:none}
            .pc-mcard{border:1px solid #e4e9f0;border-radius:12px;padding:12px 14px;margin:0 12px 8px;background:#fff}
            .pc-mcard .t1{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px;font-size:13px}
            .pc-mcard .sub2{font-size:11px;color:#475569;margin-bottom:6px}
            .pc-mcard .badges{display:flex;gap:6px;flex-wrap:wrap}
            .pc-mcard .acc{display:flex;gap:6px;margin-top:8px;justify-content:flex-end}

            @media(max-width:768px){
                .pc-hero{flex-direction:column;align-items:flex-start;padding:16px}
                .pc-hero h2{font-size:15px}
                .pc-hero-actions{margin-left:0;width:100%;flex-wrap:wrap}
                .pc-kpis{grid-template-columns:1fr 1fr;gap:8px}
                .pc-kpi .v{font-size:15px}
                .pc-toolbar{flex-direction:column;align-items:stretch}
                .pc-search{max-width:none}
                .pc-table-wrap{display:none}
                .pc-cards-mobile{display:block;padding:12px 0}
                .pc-modal{width:96%}
            }
        </style>`;
    }
});
