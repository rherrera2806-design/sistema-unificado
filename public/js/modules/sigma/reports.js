const SigmaReports = {
  currentTab: 'vencidas',
  _tabData: {},

  async render() {
    const container = document.querySelector('.page.active');
    container.innerHTML = '<div class="empty-state"><p>Cargando reportes...</p></div>';

    try {
      container.innerHTML = `
        <div class="section-title">
          <h2>Reportes</h2>
          <button class="btn btn-success" onclick="SigmaReports.exportCSV()">Exportar CSV</button>
        </div>
        <div class="filters-bar" style="margin-bottom:1.5rem;">
          <button class="filter-chip ${this.currentTab === 'vencidas' ? 'active' : ''}" onclick="SigmaReports.switchTab('vencidas')">Vencidas</button>
          <button class="filter-chip ${this.currentTab === 'proximas' ? 'active' : ''}" onclick="SigmaReports.switchTab('proximas')">Proximas</button>
          <button class="filter-chip ${this.currentTab === 'completadas' ? 'active' : ''}" onclick="SigmaReports.switchTab('completadas')">Completadas</button>
          <button class="filter-chip ${this.currentTab === 'bitacora' ? 'active' : ''}" onclick="SigmaReports.switchTab('bitacora')">Bitacora</button>
        </div>
        <div id="sigma-reports-content"></div>
      `;

      await this.loadTab();
    } catch (err) {
      container.innerHTML = `<div class="alert alert-danger">Error al cargar reportes: ${this._esc(err.message)}</div>`;
    }
  },

  switchTab(tab) {
    this.currentTab = tab;
    this.render();
  },

  async loadTab() {
    const content = document.getElementById('sigma-reports-content');
    if (!content) return;

    content.innerHTML = '<div class="empty-state"><p>Cargando...</p></div>';

    try {
      switch (this.currentTab) {
        case 'vencidas':
          await this.renderVencidas(content);
          break;
        case 'proximas':
          await this.renderProximas(content);
          break;
        case 'completadas':
          await this.renderCompletadas(content);
          break;
        case 'bitacora':
          await this.renderBitacora(content);
          break;
      }
    } catch (err) {
      content.innerHTML = `<div class="alert alert-danger">Error: ${this._esc(err.message)}</div>`;
    }
  },

  async renderVencidas(content) {
    const records = await api.sigma().crud('preventive_maintenance').getAll();
    const machines = await api.sigma().getMachines();
    const components = await api.sigma().crud('components').getAll();
    const vencidas = (records || []).filter(r => r.estado === 'Vencida');
    this._tabData.vencidas = vencidas;

    content.innerHTML = `
      <div class="card">
        <div class="card-header">Mantenimientos Preventivos Vencidos (${vencidas.length})</div>
        <div class="card-body">
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Maquina</th>
                  <th>Componente</th>
                  <th>Fecha Programada</th>
                  <th>Frecuencias</th>
                  <th>Tecnico</th>
                </tr>
              </thead>
              <tbody>
                ${vencidas.length === 0
                  ? '<tr><td colspan="5" class="empty-state"><p>No hay mantenimientos vencidos</p></td></tr>'
                  : vencidas.map(r => `
                    <tr style="background:rgba(220,53,69,0.08);">
                      <td>${this._esc(this._findName(machines, r.maquina_id))}</td>
                      <td>${this._esc(this._findName(components, r.componente_id))}</td>
                      <td>${this._esc(r.fecha_programada)}</td>
                      <td>${this._esc(r.frecuencias)}</td>
                      <td>${this._esc(r.tecnico)}</td>
                    </tr>
                  `).join('')
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  async renderProximas(content) {
    const records = await api.sigma().crud('preventive_maintenance').getAll();
    const machines = await api.sigma().getMachines();
    const components = await api.sigma().crud('components').getAll();
    const proximas = (records || []).filter(r => r.estado === 'Programada');
    this._tabData.proximas = proximas;

    content.innerHTML = `
      <div class="card">
        <div class="card-header">Mantenimientos Preventivos Programados (${proximas.length})</div>
        <div class="card-body">
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Maquina</th>
                  <th>Componente</th>
                  <th>Fecha Programada</th>
                  <th>Frecuencias</th>
                  <th>Tecnico</th>
                </tr>
              </thead>
              <tbody>
                ${proximas.length === 0
                  ? '<tr><td colspan="5" class="empty-state"><p>No hay mantenimientos programados</p></td></tr>'
                  : proximas.map(r => `
                    <tr>
                      <td>${this._esc(this._findName(machines, r.maquina_id))}</td>
                      <td>${this._esc(this._findName(components, r.componente_id))}</td>
                      <td>${this._esc(r.fecha_programada)}</td>
                      <td>${this._esc(r.frecuencias)}</td>
                      <td>${this._esc(r.tecnico)}</td>
                    </tr>
                  `).join('')
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  async renderCompletadas(content) {
    const records = await api.sigma().crud('preventive_maintenance').getAll();
    const machines = await api.sigma().getMachines();
    const components = await api.sigma().crud('components').getAll();
    const completadas = (records || []).filter(r => r.estado === 'Realizada');
    this._tabData.completadas = completadas;

    content.innerHTML = `
      <div class="card">
        <div class="card-header">Mantenimientos Preventivos Completados (${completadas.length})</div>
        <div class="card-body">
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Maquina</th>
                  <th>Componente</th>
                  <th>Fecha Programada</th>
                  <th>Frecuencias</th>
                  <th>Tecnico</th>
                </tr>
              </thead>
              <tbody>
                ${completadas.length === 0
                  ? '<tr><td colspan="5" class="empty-state"><p>No hay mantenimientos completados</p></td></tr>'
                  : completadas.map(r => `
                    <tr style="background:rgba(40,167,69,0.08);">
                      <td>${this._esc(this._findName(machines, r.maquina_id))}</td>
                      <td>${this._esc(this._findName(components, r.componente_id))}</td>
                      <td>${this._esc(r.fecha_programada)}</td>
                      <td>${this._esc(r.frecuencias)}</td>
                      <td>${this._esc(r.tecnico)}</td>
                    </tr>
                  `).join('')
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  async renderBitacora(content) {
    const records = await api.sigma().crud('corrective_maintenance').getAll();
    const machines = await api.sigma().getMachines();
    const components = await api.sigma().crud('components').getAll();
    this._tabData.bitacora = records || [];

    content.innerHTML = `
      <div class="card">
        <div class="card-header">Bitacora de Mantencion Correctiva (${(records || []).length})</div>
        <div class="card-body">
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Maquina</th>
                  <th>Componente</th>
                  <th>Fecha Falla</th>
                  <th>Descripcion</th>
                  <th>Estado</th>
                  <th>Responsable</th>
                  <th>Costo</th>
                </tr>
              </thead>
              <tbody>
                ${(!records || records.length === 0)
                  ? '<tr><td colspan="7" class="empty-state"><p>No hay registros en la bitacora</p></td></tr>'
                  : records.map(r => `
                    <tr>
                      <td>${this._esc(this._findName(machines, r.maquina_id))}</td>
                      <td>${this._esc(this._findName(components, r.componente_id))}</td>
                      <td>${this._esc(r.fecha_falla)}</td>
                      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${this._esc(r.descripcion)}">${this._esc(r.descripcion)}</td>
                      <td><span class="badge ${r.estado === 'Reparada' ? 'badge-salida' : 'badge-entrada'}">${this._esc(r.estado)}</span></td>
                      <td>${this._esc(r.responsable)}</td>
                      <td>${r.costo_reparacion ? '$' + Number(r.costo_reparacion).toLocaleString() : '-'}</td>
                    </tr>
                  `).join('')
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  async exportCSV() {
    try {
      const data = await api.sigma().reports(this.currentTab);
      const rows = data || [];
      if (rows.length === 0) {
        App.toast('No hay datos para exportar', 'info');
        return;
      }

      const headers = Object.keys(rows[0]);
      const csvRows = [headers.join(',')];
      for (const row of rows) {
        csvRows.push(headers.map(h => {
          const val = row[h] === null || row[h] === undefined ? '' : String(row[h]);
          return '"' + val.replace(/"/g, '""') + '"';
        }).join(','));
      }

      const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sigma_${this.currentTab}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      App.toast('CSV exportado correctamente', 'success');
    } catch (err) {
      App.toast('Error al exportar: ' + err.message, 'error');
    }
  },

  _findName(list, id) {
    const item = list.find(i => i.id === id);
    return item ? (item.nombre || item.codigo || '-') : '-';
  },

  _esc(str) {
    if (!str && str !== 0) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }
};
