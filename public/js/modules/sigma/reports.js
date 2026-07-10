const SigmaReports = {
  currentTab: 'vencidas',

  async render() {
    const container = document.getElementById('sigma-content');
    container.innerHTML = '<div class="text-center py-5"><div class="spinner-border"></div></div>';

    try {
      container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h2>Reportes</h2>
          <button class="btn btn-outline-success" onclick="SigmaReports.exportCSV()">
            <i class="fa fa-download me-1"></i> Exportar CSV
          </button>
        </div>
        <ul class="nav nav-tabs mb-3">
          <li class="nav-item">
            <a class="nav-link ${this.currentTab === 'vencidas' ? 'active' : ''}" href="#" onclick="SigmaReports.switchTab('vencidas'); return false;">Vencidas</a>
          </li>
          <li class="nav-item">
            <a class="nav-link ${this.currentTab === 'proximas' ? 'active' : ''}" href="#" onclick="SigmaReports.switchTab('proximas'); return false;">Proximas</a>
          </li>
          <li class="nav-item">
            <a class="nav-link ${this.currentTab === 'completadas' ? 'active' : ''}" href="#" onclick="SigmaReports.switchTab('completadas'); return false;">Completadas</a>
          </li>
          <li class="nav-item">
            <a class="nav-link ${this.currentTab === 'bitacora' ? 'active' : ''}" href="#" onclick="SigmaReports.switchTab('bitacora'); return false;">Bitacora</a>
          </li>
        </ul>
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

    content.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm"></div></div>';

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

    content.innerHTML = `
      <div class="card">
        <div class="card-header">Mantenimientos Preventivos Vencidos (${vencidas.length})</div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-hover mb-0">
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
                  ? '<tr><td colspan="5" class="text-center text-muted py-3">No hay mantenimientos vencidos</td></tr>'
                  : vencidas.map(r => `
                    <tr class="table-danger">
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

    content.innerHTML = `
      <div class="card">
        <div class="card-header">Mantenimientos Preventivos Programados (${proximas.length})</div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-hover mb-0">
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
                  ? '<tr><td colspan="5" class="text-center text-muted py-3">No hay mantenimientos programados</td></tr>'
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

    content.innerHTML = `
      <div class="card">
        <div class="card-header">Mantenimientos Preventivos Completados (${completadas.length})</div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-hover mb-0">
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
                  ? '<tr><td colspan="5" class="text-center text-muted py-3">No hay mantenimientos completados</td></tr>'
                  : completadas.map(r => `
                    <tr class="table-success">
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

    content.innerHTML = `
      <div class="card">
        <div class="card-header">Bitacora de Mantencion Correctiva (${(records || []).length})</div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-hover mb-0">
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
                  ? '<tr><td colspan="7" class="text-center text-muted py-3">No hay registros en la bitacora</td></tr>'
                  : records.map(r => `
                    <tr>
                      <td>${this._esc(this._findName(machines, r.maquina_id))}</td>
                      <td>${this._esc(this._findName(components, r.componente_id))}</td>
                      <td>${this._esc(r.fecha_falla)}</td>
                      <td class="text-truncate" style="max-width:200px" title="${this._esc(r.descripcion)}">${this._esc(r.descripcion)}</td>
                      <td><span class="badge ${r.estado === 'Reparada' ? 'bg-success' : 'bg-warning'}">${this._esc(r.estado)}</span></td>
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
