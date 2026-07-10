const SigmaMachines = {
  types: [],

  async render() {
    const container = document.getElementById('sigma-content');
    container.innerHTML = '<div class="text-center py-5"><div class="spinner-border"></div></div>';

    try {
      const [machines, types] = await Promise.all([
        api.sigma().getMachines(),
        api.sigma().crud('machine_types').getAll()
      ]);
      this.types = types || [];

      container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h2>Maquinas</h2>
          <button class="btn btn-primary" onclick="SigmaMachines.openAddModal()">
            <i class="fa fa-plus me-1"></i> Nueva Maquina
          </button>
        </div>
        <div class="card">
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Codigo</th>
                    <th>Nombre</th>
                    <th>Tipo</th>
                    <th>Marca</th>
                    <th>Modelo</th>
                    <th>Ubicacion</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  ${machines.length === 0
                    ? '<tr><td colspan="8" class="text-center text-muted py-3">No hay maquinas registradas</td></tr>'
                    : machines.map(m => `
                      <tr>
                        <td><code>${this._esc(m.codigo)}</code></td>
                        <td>${this._esc(m.nombre)}</td>
                        <td>${this._esc(this._getTypeName(m.tipo_id))}</td>
                        <td>${this._esc(m.marca)}</td>
                        <td>${this._esc(m.modelo)}</td>
                        <td>${this._esc(m.ubicacion)}</td>
                        <td><span class="badge ${this._estadoBadge(m.estado_operativo)}">${this._esc(m.estado_operativo)}</span></td>
                        <td>
                          <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" onclick="SigmaMachines.openEditModal('${m.id}')" title="Editar">
                              <i class="fa fa-edit"></i>
                            </button>
                            <button class="btn btn-outline-danger" onclick="SigmaMachines.confirmDelete('${m.id}', '${this._esc(m.nombre)}')" title="Eliminar">
                              <i class="fa fa-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    `).join('')
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="alert alert-danger">Error al cargar maquinas: ${this._esc(err.message)}</div>`;
    }
  },

  _getTypeName(tipoId) {
    const t = this.types.find(t => t.id === tipoId);
    return t ? t.nombre : '-';
  },

  _estadoBadge(estado) {
    const map = {
      'Activo': 'bg-success',
      'Mantenimiento': 'bg-warning text-dark',
      'Inactivo': 'bg-secondary',
      'Fuera de servicio': 'bg-danger'
    };
    return map[estado] || 'bg-secondary';
  },

  _getFormHtml(machine) {
    const tipoOptions = this.types.map(t =>
      `<option value="${t.id}" ${machine && machine.tipo_id === t.id ? 'selected' : ''}>${this._esc(t.nombre)}</option>`
    ).join('');

    return `
      <form id="machineForm" onsubmit="SigmaMachines.saveForm(event)">
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label">Codigo *</label>
            <input type="text" class="form-control" name="codigo" required value="${this._esc(machine ? machine.codigo : '')}">
          </div>
          <div class="col-md-6">
            <label class="form-label">Nombre *</label>
            <input type="text" class="form-control" name="nombre" required value="${this._esc(machine ? machine.nombre : '')}">
          </div>
          <div class="col-md-6">
            <label class="form-label">Tipo *</label>
            <select class="form-select" name="tipo_id" required>
              <option value="">Seleccionar tipo...</option>
              ${tipoOptions}
            </select>
          </div>
          <div class="col-md-6">
            <label class="form-label">Marca</label>
            <input type="text" class="form-control" name="marca" value="${this._esc(machine ? machine.marca : '')}">
          </div>
          <div class="col-md-6">
            <label class="form-label">Modelo</label>
            <input type="text" class="form-control" name="modelo" value="${this._esc(machine ? machine.modelo : '')}">
          </div>
          <div class="col-md-6">
            <label class="form-label">Numero de Serie</label>
            <input type="text" class="form-control" name="numero_serie" value="${this._esc(machine ? machine.numero_serie : '')}">
          </div>
          <div class="col-md-6">
            <label class="form-label">Ubicacion</label>
            <input type="text" class="form-control" name="ubicacion" value="${this._esc(machine ? machine.ubicacion : '')}">
          </div>
          <div class="col-md-6">
            <label class="form-label">Fecha de Compra</label>
            <input type="date" class="form-control" name="fecha_compra" value="${this._esc(machine ? machine.fecha_compra : '')}">
          </div>
          <div class="col-md-6">
            <label class="form-label">Estado Operativo</label>
            <select class="form-select" name="estado_operativo">
              <option value="Activo" ${machine && machine.estado_operativo === 'Activo' ? 'selected' : ''}>Activo</option>
              <option value="Mantenimiento" ${machine && machine.estado_operativo === 'Mantenimiento' ? 'selected' : ''}>Mantenimiento</option>
              <option value="Inactivo" ${machine && machine.estado_operativo === 'Inactivo' ? 'selected' : ''}>Inactivo</option>
              <option value="Fuera de servicio" ${machine && machine.estado_operativo === 'Fuera de servicio' ? 'selected' : ''}>Fuera de servicio</option>
            </select>
          </div>
          <div class="col-12">
            <label class="form-label">Observaciones</label>
            <textarea class="form-control" name="observaciones" rows="3">${this._esc(machine ? machine.observaciones : '')}</textarea>
          </div>
        </div>
        <input type="hidden" name="id" value="${machine ? machine.id : ''}">
      </form>
    `;
  },

  openAddModal() {
    App.showModal('Nueva Maquina', this._getFormHtml(null),
      '<button class="btn btn-secondary" onclick="App.hideModal()">Cancelar</button> <button class="btn btn-primary" onclick="document.getElementById(\'machineForm\').requestSubmit()">Guardar</button>'
    );
  },

  async openEditModal(id) {
    try {
      const machine = await api.sigma().getMachineDetails(id);
      App.showModal('Editar Maquina', this._getFormHtml(machine),
        '<button class="btn btn-secondary" onclick="App.hideModal()">Cancelar</button> <button class="btn btn-primary" onclick="document.getElementById(\'machineForm\').requestSubmit()">Actualizar</button>'
      );
    } catch (err) {
      App.toast('Error al cargar maquina: ' + err.message, 'error');
    }
  },

  async saveForm(e) {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));
    data.tipo_id = data.tipo_id || null;

    try {
      if (data.id) {
        await api.sigma().crud('machines').update(data.id, data);
        App.toast('Maquina actualizada correctamente', 'success');
      } else {
        delete data.id;
        await api.sigma().crud('machines').create(data);
        App.toast('Maquina creada correctamente', 'success');
      }
      App.hideModal();
      this.render();
    } catch (err) {
      App.toast('Error al guardar: ' + err.message, 'error');
    }
  },

  confirmDelete(id, name) {
    App.showModal('Confirmar Eliminacion',
      `<p>¿Está seguro que desea eliminar la maquina <strong>${name}</strong>?</p><p class="text-muted small">Esta accion no se puede deshacer.</p>`,
      `<button class="btn btn-secondary" onclick="App.hideModal()">Cancelar</button> <button class="btn btn-danger" onclick="SigmaMachines.doDelete('${id}')">Eliminar</button>`
    );
  },

  async doDelete(id) {
    try {
      await api.sigma().crud('machines').delete(id);
      App.toast('Maquina eliminada correctamente', 'success');
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
