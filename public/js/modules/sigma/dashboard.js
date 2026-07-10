const SigmaDashboard = {
  async render() {
    const container = document.getElementById('sigma-content');
    container.innerHTML = '<div class="text-center py-5"><div class="spinner-border"></div></div>';

    try {
      const stats = await api.sigma().stats();
      const machines = await api.sigma().getMachines();

      const recentFailures = (stats.recent_failures || []).slice(0, 5);
      const criticalParts = (stats.critical_spare_parts || []).slice(0, 5);

      container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h2>Dashboard SIGMA</h2>
          <div class="d-flex gap-2">
            <button class="btn btn-primary" onclick="App.navigateSigma('machines'); SigmaMachines.openAddModal();">
              <i class="fa fa-plus me-1"></i> Nueva Maquina
            </button>
            <button class="btn btn-warning" onclick="App.navigateSigma('preventive'); SigmaPreventive.openAddModal();">
              <i class="fa fa-wrench me-1"></i> Mant. Preventiva
            </button>
            <button class="btn btn-danger" onclick="App.navigateSigma('corrective'); SigmaCorrective.openAddModal();">
              <i class="fa fa-tools me-1"></i> Mant. Correctiva
            </button>
          </div>
        </div>

        <div class="row g-3 mb-4">
          <div class="col-md-2">
            <div class="card text-bg-primary h-100">
              <div class="card-body text-center">
                <div class="fs-2 fw-bold">${stats.total_machines || 0}</div>
                <div class="small">Total Maquinas</div>
              </div>
            </div>
          </div>
          <div class="col-md-2">
            <div class="card text-bg-success h-100">
              <div class="card-body text-center">
                <div class="fs-2 fw-bold">${stats.completed_maintenance || 0}</div>
                <div class="small">Mant. Completadas</div>
              </div>
            </div>
          </div>
          <div class="col-md-2">
            <div class="card text-bg-info h-100">
              <div class="card-body text-center">
                <div class="fs-2 fw-bold">${stats.upcoming || 0}</div>
                <div class="small">Proximas</div>
              </div>
            </div>
          </div>
          <div class="col-md-2">
            <div class="card text-bg-warning h-100">
              <div class="card-body text-center">
                <div class="fs-2 fw-bold">${stats.overdue || 0}</div>
                <div class="small">Vencidas</div>
              </div>
            </div>
          </div>
          <div class="col-md-2">
            <div class="card text-bg-danger h-100">
              <div class="card-body text-center">
                <div class="fs-2 fw-bold">${stats.total_failures || 0}</div>
                <div class="small">Total Fallas</div>
              </div>
            </div>
          </div>
          <div class="col-md-2">
            <div class="card text-bg-dark h-100">
              <div class="card-body text-center">
                <div class="fs-2 fw-bold">${stats.critical_spare_parts_count || 0}</div>
                <div class="small">Repuestos Criticos</div>
              </div>
            </div>
          </div>
        </div>

        <div class="row g-3">
          <div class="col-md-7">
            <div class="card h-100">
              <div class="card-header">Fallas Recientes</div>
              <div class="card-body p-0">
                <div class="table-responsive">
                  <table class="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th>Maquina</th>
                        <th>Componente</th>
                        <th>Fecha</th>
                        <th>Estado</th>
                        <th>Responsable</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${recentFailures.length === 0
                        ? '<tr><td colspan="5" class="text-center text-muted py-3">No hay fallas recientes</td></tr>'
                        : recentFailures.map(f => `
                          <tr>
                            <td>${this._esc(f.machine_name || '-')}</td>
                            <td>${this._esc(f.component_name || '-')}</td>
                            <td>${this._esc(f.fecha_falla || '-')}</td>
                            <td><span class="badge ${f.estado === 'Reparada' ? 'bg-success' : 'bg-warning'}">${this._esc(f.estado || '-')}</span></td>
                            <td>${this._esc(f.responsable || '-')}</td>
                          </tr>
                        `).join('')
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div class="col-md-5">
            <div class="card h-100">
              <div class="card-header">Repuestos Criticos (Stock Bajo)</div>
              <div class="card-body p-0">
                <div class="table-responsive">
                  <table class="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th>Codigo</th>
                        <th>Descripcion</th>
                        <th>Stock</th>
                        <th>Minimo</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${criticalParts.length === 0
                        ? '<tr><td colspan="4" class="text-center text-muted py-3">No hay repuestos criticos</td></tr>'
                        : criticalParts.map(p => `
                          <tr class="table-danger">
                            <td>${this._esc(p.codigo || '-')}</td>
                            <td>${this._esc(p.descripcion || '-')}</td>
                            <td class="fw-bold">${p.stock_actual || 0}</td>
                            <td>${p.stock_minimo || 0}</td>
                          </tr>
                        `).join('')
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="alert alert-danger">Error al cargar dashboard: ${this._esc(err.message)}</div>`;
    }
  },

  _esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }
};
