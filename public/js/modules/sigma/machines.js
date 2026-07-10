const SigmaMachines = {
  types: [],

  async render() {
    const container = document.querySelector('.page.active');
    container.innerHTML = '<div class="empty-state"><p>Cargando maquinas...</p></div>';

    try {
      const [machines, types] = await Promise.all([
        api.sigma().getMachines(),
        api.sigma().crud('machine_types').getAll()
      ]);
      this.types = types || [];

      container.innerHTML = `
        <div class="section-title">
          <h2>Maquinas</h2>
          <button class="btn btn-primary" onclick="SigmaMachines.openAddModal()">+ Nueva Maquina</button>
        </div>
        <div class="card">
          <div class="card-body">
            <div class="table-responsive">
              <table>
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
                    ? '<tr><td colspan="8" class="empty-state"><p>No hay maquinas registradas</p></td></tr>'
                    : machines.map(m => `
                      <tr>
                        <td>${this._esc(m.codigo)}</td>
                        <td>${this._esc(m.nombre)}</td>
                        <td>${this._esc(this._getTypeName(m.tipo_id))}</td>
                        <td>${this._esc(m.marca)}</td>
                        <td>${this._esc(m.modelo)}</td>
                        <td>${this._esc(m.ubicacion)}</td>
                        <td><span class="badge ${this._estadoBadge(m.estado_operativo)}">${this._esc(m.estado_operativo)}</span></td>
                        <td>
                          <button class="btn btn-sm btn-outline" onclick="SigmaMachines.openEditModal('${m.id}')">Editar</button>
                          <button class="btn btn-sm btn-danger" onclick="SigmaMachines.confirmDelete('${m.id}', '${this._esc(m.nombre)}')">Eliminar</button>
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
      'Activo': 'badge-salida',
      'Mantenimiento': 'badge-entrada',
      'Inactivo': 'badge-entrada',
      'Fuera de servicio': 'badge-entrada'
    };
    return map[estado] || 'badge-entrada';
  },

  _getFormHtml(machine) {
    const tipoOptions = this.types.map(t =>
      `<option value="${t.id}" ${machine && machine.tipo_id === t.id ? 'selected' : ''}>${this._esc(t.nombre)}</option>`
    ).join('');

    return `
      <form id="machineForm" onsubmit="SigmaMachines.saveForm(event)">
        <div class="form-row">
          <div class="form-group">
            <label>Codigo *</label>
            <input type="text" class="form-control" name="codigo" required value="${this._esc(machine ? machine.codigo : '')}">
          </div>
          <div class="form-group">
            <label>Nombre *</label>
            <input type="text" class="form-control" name="nombre" required value="${this._esc(machine ? machine.nombre : '')}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Tipo *</label>
            <select class="form-control" name="tipo_id" required>
              <option value="">Seleccionar tipo...</option>
              ${tipoOptions}
            </select>
          </div>
          <div class="form-group">
            <label>Marca</label>
            <input type="text" class="form-control" name="marca" value="${this._esc(machine ? machine.marca : '')}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Modelo</label>
            <input type="text" class="form-control" name="modelo" value="${this._esc(machine ? machine.modelo : '')}">
          </div>
          <div class="form-group">
            <label>Numero de Serie</label>
            <input type="text" class="form-control" name="numero_serie" value="${this._esc(machine ? machine.numero_serie : '')}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Ubicacion</label>
            <input type="text" class="form-control" name="ubicacion" value="${this._esc(machine ? machine.ubicacion : '')}">
          </div>
          <div class="form-group">
            <label>Fecha de Compra</label>
            <input type="date" class="form-control" name="fecha_compra" value="${this._esc(machine ? machine.fecha_compra : '')}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Estado Operativo</label>
            <select class="form-control" name="estado_operativo">
              <option value="Activo" ${machine && machine.estado_operativo === 'Activo' ? 'selected' : ''}>Activo</option>
              <option value="Mantenimiento" ${machine && machine.estado_operativo === 'Mantenimiento' ? 'selected' : ''}>Mantenimiento</option>
              <option value="Inactivo" ${machine && machine.estado_operativo === 'Inactivo' ? 'selected' : ''}>Inactivo</option>
              <option value="Fuera de servicio" ${machine && machine.estado_operativo === 'Fuera de servicio' ? 'selected' : ''}>Fuera de servicio</option>
            </select>
          </div>
          <div class="form-group">
            <label>Observaciones</label>
            <textarea class="form-control" name="observaciones" rows="2">${this._esc(machine ? machine.observaciones : '')}</textarea>
          </div>
        </div>
        <input type="hidden" name="id" value="${machine ? machine.id : ''}">
      </form>
    `;
  },

  openAddModal() {
    App.showModal('Nueva Maquina', this._getFormHtml(null),
      '<button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button> <button class="btn btn-primary" onclick="document.getElementById(\'machineForm\').requestSubmit()">Guardar</button>'
    );
  },

  async openEditModal(id) {
    try {
      const machine = await api.sigma().getMachineDetails(id);
      App.showModal('Editar Maquina', this._getFormHtml(machine),
        '<button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button> <button class="btn btn-primary" onclick="document.getElementById(\'machineForm\').requestSubmit()">Actualizar</button>'
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
      `<p>Seguro que desea eliminar la maquina <strong>${name}</strong>?</p><p style="color:#888;font-size:0.85rem;">Esta accion no se puede deshacer.</p>`,
      `<button class="btn btn-outline" onclick="App.hideModal()">Cancelar</button> <button class="btn btn-danger" onclick="SigmaMachines.doDelete('${id}')">Eliminar</button>`
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
