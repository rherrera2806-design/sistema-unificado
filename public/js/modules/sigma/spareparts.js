const SigmaSpareparts = {
  components: [],

  async render() {
    const container = document.getElementById('sigma-content');
    container.innerHTML = '<div class="text-center py-5"><div class="spinner-border"></div></div>';

    try {
      const [parts, components] = await Promise.all([
        api.sigma().crud('spare_parts').getAll(),
        api.sigma().crud('components').getAll()
      ]);
      this.components = components || [];

      container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h2>Repuestos</h2>
          <button class="btn btn-primary" onclick="SigmaSpareparts.openAddModal()">
            <i class="fa fa-plus me-1"></i> Nuevo Repuesto
          </button>
        </div>
        <div class="card">
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Codigo</th>
                    <th>Descripcion</th>
                    <th>Componente</th>
                    <th>Stock Actual</th>
                    <th>Stock Minimo</th>
                    <th>Proveedor</th>
                    <th>Ubicacion</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  ${parts.length === 0
                    ? '<tr><td colspan="8" class="text-center text-muted py-3">No hay repuestos registrados</td></tr>'
                    : parts.map(p => {
                      const isLow = (p.stock_actual || 0) <= (p.stock_minimo || 0);
                      return `
                        <tr class="${isLow ? 'table-danger' : ''}">
                          <td><code>${this._esc(p.codigo)}</code></td>
                          <td>${this._esc(p.descripcion)}</td>
                          <td>${this._esc(this._getComponentName(p.componente_id))}</td>
                          <td class="fw-bold">${p.stock_actual || 0}</td>
                          <td>${p.stock_minimo || 0}</td>
                          <td>${this._esc(p.proveedor)}</td>
                          <td>${this._esc(p.ubicacion)}</td>
                          <td>
                            <div class="btn-group btn-group-sm">
                              <button class="btn btn-outline-primary" onclick="SigmaSpareparts.openEditModal('${p.id}')" title="Editar">
                                <i class="fa fa-edit"></i>
                              </button>
                              <button class="btn btn-outline-danger" onclick="SigmaSpareparts.confirmDelete('${p.id}', '${this._esc(p.descripcion)}')" title="Eliminar">
                                <i class="fa fa-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      `;
                    }).join('')
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="alert alert-danger">Error al cargar repuestos: ${this._esc(err.message)}</div>`;
    }
  },

  _getComponentName(id) {
    const c = this.components.find(c => c.id === id);
    return c ? c.nombre : '-';
  },

  _getFormHtml(part) {
    const componentOptions = this.components.map(c =>
      `<option value="${c.id}" ${part && part.componente_id === c.id ? 'selected' : ''}>${this._esc(c.nombre)}</option>`
    ).join('');

    return `
      <form id="sparepartForm" onsubmit="SigmaSpareparts.saveForm(event)">
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label">Codigo *</label>
            <input type="text" class="form-control" name="codigo" required value="${this._esc(part ? part.codigo : '')}">
          </div>
          <div class="col-md-6">
            <label class="form-label">Descripcion *</label>
            <input type="text" class="form-control" name="descripcion" required value="${this._esc(part ? part.descripcion : '')}">
          </div>
          <div class="col-md-6">
            <label class="form-label">Componente</label>
            <select class="form-select" name="componente_id">
              <option value="">Seleccionar componente...</option>
              ${componentOptions}
            </select>
          </div>
          <div class="col-md-3">
            <label class="form-label">Stock Actual</label>
            <input type="number" class="form-control" name="stock_actual" min="0" value="${part ? (part.stock_actual || 0) : 0}">
          </div>
          <div class="col-md-3">
            <label class="form-label">Stock Minimo</label>
            <input type="number" class="form-control" name="stock_minimo" min="0" value="${part ? (part.stock_minimo || 0) : 0}">
          </div>
          <div class="col-md-6">
            <label class="form-label">Proveedor</label>
            <input type="text" class="form-control" name="proveedor" value="${this._esc(part ? part.proveedor : '')}">
          </div>
          <div class="col-md-6">
            <label class="form-label">Ubicacion</label>
            <input type="text" class="form-control" name="ubicacion" value="${this._esc(part ? part.ubicacion : '')}">
          </div>
          <div class="col-md-6">
            <label class="form-label">Precio Unitario</label>
            <input type="number" step="0.01" class="form-control" name="precio_unitario" value="${part ? (part.precio_unitario || '') : ''}">
          </div>
          <div class="col-12">
            <label class="form-label">Observaciones</label>
            <textarea class="form-control" name="observaciones" rows="2">${this._esc(part ? part.observaciones : '')}</textarea>
          </div>
        </div>
        <input type="hidden" name="id" value="${part ? part.id : ''}">
      </form>
    `;
  },

  openAddModal() {
    App.showModal('Nuevo Repuesto', this._getFormHtml(null),
      '<button class="btn btn-secondary" onclick="App.hideModal()">Cancelar</button> <button class="btn btn-primary" onclick="document.getElementById(\'sparepartForm\').requestSubmit()">Guardar</button>'
    );
  },

  async openEditModal(id) {
    try {
      const part = await api.sigma().crud('spare_parts').getById(id);
      App.showModal('Editar Repuesto', this._getFormHtml(part),
        '<button class="btn btn-secondary" onclick="App.hideModal()">Cancelar</button> <button class="btn btn-primary" onclick="document.getElementById(\'sparepartForm\').requestSubmit()">Actualizar</button>'
      );
    } catch (err) {
      App.toast('Error al cargar repuesto: ' + err.message, 'error');
    }
  },

  async saveForm(e) {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));
    data.componente_id = data.componente_id || null;
    data.stock_actual = parseInt(data.stock_actual) || 0;
    data.stock_minimo = parseInt(data.stock_minimo) || 0;

    try {
      if (data.id) {
        await api.sigma().crud('spare_parts').update(data.id, data);
        App.toast('Repuesto actualizado correctamente', 'success');
      } else {
        delete data.id;
        await api.sigma().crud('spare_parts').create(data);
        App.toast('Repuesto creado correctamente', 'success');
      }
      App.hideModal();
      this.render();
    } catch (err) {
      App.toast('Error al guardar: ' + err.message, 'error');
    }
  },

  confirmDelete(id, name) {
    App.showModal('Confirmar Eliminacion',
      `<p>¿Está seguro que desea eliminar el repuesto <strong>${name}</strong>?</p>`,
      `<button class="btn btn-secondary" onclick="App.hideModal()">Cancelar</button> <button class="btn btn-danger" onclick="SigmaSpareparts.doDelete('${id}')">Eliminar</button>`
    );
  },

  async doDelete(id) {
    try {
      await api.sigma().crud('spare_parts').delete(id);
      App.toast('Repuesto eliminado correctamente', 'success');
      App.hideModal();
      this.render();
    } catch (err) {
      App.toast('Error al eliminar: ' + err.message, 'error');
    }
  },

  _esc(str) {
    if (!str && str !== 0) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }
};
