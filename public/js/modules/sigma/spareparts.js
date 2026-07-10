const SigmaSpareparts = {
  components: [],

  async render() {
    const container = document.querySelector('.page.active');
    container.innerHTML = '<div class="empty-state"><p>Cargando repuestos...</p></div>';

    try {
      const [parts, components] = await Promise.all([
        api.sigma().crud('spare_parts').getAll(),
        api.sigma().crud('components').getAll()
      ]);
      this.components = components || [];

      container.innerHTML = `
        <div class="section-title">
          <h2>Repuestos</h2>
          <button class="btn btn-primary" onclick="SigmaSpareparts.openAddModal()">+ Nuevo Repuesto</button>
        </div>
        <div class="card">
          <div class="card-body">
            <div class="table-responsive">
              <table>
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
                    ? '<tr><td colspan="8" class="empty-state"><p>No hay repuestos registrados</p></td></tr>'
                    : parts.map(p => {
                      const isLow = (p.stock_actual || 0) <= (p.stock_minimo || 0);
                      return `
                        <tr style="${isLow ? 'background:rgba(220,53,69,0.08);' : ''}">
                          <td>${this._esc(p.codigo)}</td>
                          <td>${this._esc(p.descripcion)}</td>
                          <td>${this._esc(this._getComponentName(p.componente_id))}</td>
                          <td style="font-weight:bold;${isLow ? 'color:#dc3545;' : ''}">${p.stock_actual || 0}</td>
                          <td>${p.stock_minimo || 0}</td>
                          <td>${this._esc(p.proveedor)}</td>
                          <td>${this._esc(p.ubicacion)}</td>
                          <td>
                            <button class="btn btn-sm btn-outline" onclick="SigmaSpareparts.openEditModal('${p.id}')">Editar</button>
                            <button class="btn btn-sm btn-danger" onclick="SigmaSpareparts.confirmDelete('${p.id}', '${this._esc(p.descripcion)}')">Eliminar</button>
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
        <div class="form-row">
          <div class="form-group">
            <label>Codigo *</label>
            <input type="text" class="form-control" name="codigo" required value="${this._esc(part ? part.codigo : '')}">
          </div>
          <div class="form-group">
            <label>Descripcion *</label>
            <input type="text" class="form-control" name="descripcion" required value="${this._esc(part ? part.descripcion : '')}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Componente</label>
            <select class="form-control" name="componente_id">
              <option value="">Seleccionar componente...</option>
              ${componentOptions}
            </select>
          </div>
          <div class="form-group">
            <label>Stock Actual</label>
            <input type="number" class="form-control" name="stock_actual" min="0" value="${part ? (part.stock_actual || 0) : 0}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Stock Minimo</label>
            <input type="number" class="form-control" name="stock_minimo" min="0" value="${part ? (part.stock_minimo || 0) : 0}">
          </div>
          <div class="form-group">
            <label>Proveedor</label>
            <input type="text" class="form-control" name="proveedor" value="${this._esc(part ? part.proveedor : '')}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Ubicacion</label>
            <input type="text" class="form-control" name="ubicacion" value="${this._esc(part ? part.ubicacion : '')}">
          </div>
          <div class="form-group">
            <label>Precio Unitario</label>
            <input type="number" step="0.01" class="form-control" name="precio_unitario" value="${part ? (part.precio_unitario || '') : ''}">
          </div>
        </div>
        <div class="form-group">
          <label>Observaciones</label>
          <textarea class="form-control" name="observaciones" rows="2">${this._esc(part ? part.observaciones : '')}</textarea>
        </div>
        <input type="hidden" name="id" value="${part ? part.id : ''}">
      </form>
    `;
  },

  openAddModal() {
    App.showModal('Nuevo Repuesto', this._getFormHtml(null),
      '<button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button> <button class="btn btn-primary" onclick="document.getElementById(\'sparepartForm\').requestSubmit()">Guardar</button>'
    );
  },

  async openEditModal(id) {
    try {
      const parts = await api.sigma().crud('spare_parts').getAll();
      const part = parts.find(p => p.id === id);
      if (!part) {
        App.toast('Repuesto no encontrado', 'error');
        return;
      }
      App.showModal('Editar Repuesto', this._getFormHtml(part),
        '<button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button> <button class="btn btn-primary" onclick="document.getElementById(\'sparepartForm\').requestSubmit()">Actualizar</button>'
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
      `<p>Seguro que desea eliminar el repuesto <strong>${name}</strong>?</p>`,
      `<button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button> <button class="btn btn-danger" onclick="SigmaSpareparts.doDelete('${id}')">Eliminar</button>`
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
