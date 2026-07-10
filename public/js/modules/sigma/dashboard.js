const SigmaDashboard = {
  async render() {
    const container = document.querySelector('.page.active');
    container.innerHTML = '<div class="empty-state"><p>Cargando dashboard...</p></div>';

    try {
      const [stats, allSpareParts] = await Promise.all([
        api.sigma().stats(),
        api.sigma().crud('spare_parts').getAll()
      ]);

      const recentFailures = (stats.recentFailures || []).slice(0, 5);
      const criticalParts = allSpareParts.filter(p => (p.stock_actual || 0) <= (p.stock_minimo || 0)).slice(0, 5);

      container.innerHTML = `
        <div class="section-title">
          <h2>Dashboard SIGMA</h2>
        </div>

        <div class="quick-actions" style="margin-bottom:1.5rem;">
          <div class="action-card" onclick="App.navigateSigma('machines')">
            <div class="icon">&#128295;</div>
            <div class="label">Maquinas</div>
          </div>
          <div class="action-card" onclick="App.navigateSigma('preventive')">
            <div class="icon">&#128197;</div>
            <div class="label">Preventiva</div>
          </div>
          <div class="action-card" onclick="App.navigateSigma('corrective')">
            <div class="icon">&#9888;</div>
            <div class="label">Correctiva</div>
          </div>
          <div class="action-card" onclick="App.navigateSigma('spareparts')">
            <div class="icon">&#128230;</div>
            <div class="label">Repuestos</div>
          </div>
          <div class="action-card" onclick="App.navigateSigma('reports')">
            <div class="icon">&#128202;</div>
            <div class="label">Reportes</div>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card primary">
            <div class="label">Total Maquinas</div>
            <div class="value">${stats.totalMachines || 0}</div>
          </div>
          <div class="stat-card success">
            <div class="label">Mant. Completadas</div>
            <div class="value">${stats.completedMaintenance || 0}</div>
          </div>
          <div class="stat-card warning">
            <div class="label">Proximas</div>
            <div class="value">${stats.upcomingMaintenance || 0}</div>
          </div>
          <div class="stat-card danger">
            <div class="label">Vencidas</div>
            <div class="value">${stats.overdueMaintenance || 0}</div>
          </div>
          <div class="stat-card danger">
            <div class="label">Total Fallas</div>
            <div class="value">${stats.totalFailures || 0}</div>
          </div>
          <div class="stat-card primary">
            <div class="label">Repuestos Criticos</div>
            <div class="value">${stats.criticalSpareParts || 0}</div>
          </div>
        </div>

        <div style="display:flex;gap:1.5rem;margin-top:1.5rem;flex-wrap:wrap;">
          <div style="flex:2;min-width:300px;">
            <div class="card">
              <div class="card-header">Fallas Recientes</div>
              <div class="card-body">
                <div class="table-responsive">
                  <table>
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
                        ? '<tr><td colspan="5" class="empty-state"><p>No hay fallas recientes</p></td></tr>'
                        : recentFailures.map(f => `
                          <tr>
                            <td>${this._esc(f.maquina_nombre || '-')}</td>
                            <td>${this._esc(f.componente_nombre || '-')}</td>
                            <td>${this._esc(f.fecha_falla || '-')}</td>
                            <td><span class="badge ${f.estado === 'Reparada' ? 'badge-salida' : 'badge-entrada'}">${this._esc(f.estado || '-')}</span></td>
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

          <div style="flex:1;min-width:250px;">
            <div class="card">
              <div class="card-header">Repuestos Criticos (Stock Bajo)</div>
              <div class="card-body">
                <div class="table-responsive">
                  <table>
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
                        ? '<tr><td colspan="4" class="empty-state"><p>No hay repuestos criticos</p></td></tr>'
                        : criticalParts.map(p => `
                          <tr style="background:rgba(220,53,69,0.08);">
                            <td>${this._esc(p.codigo || '-')}</td>
                            <td>${this._esc(p.descripcion || '-')}</td>
                            <td style="font-weight:bold;">${p.stock_actual || 0}</td>
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
    if (!str && str !== 0) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }
};
