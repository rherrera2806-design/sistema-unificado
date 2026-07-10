const SigmaPreventive = {
  machines: [],
  components: [],

  async render() {
    const container = document.getElementById('sigma-content');
    container.innerHTML = '<div class="text-center py-5"><div class="spinner-border"></div></div>';

    try {
      const [records, machines, components] = await Promise.all([
        api.sigma().crud('preventive_maintenance').getAll(),
        api.sigma().getMachines(),
        api.sigma().crud('components').getAll()
      ]);
      this.machines = machines || [];
      this.components = components || [];

      container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h2>Mantencion Preventiva</h2>
          <button class="btn btn-primary" onclick="SigmaPreventive.openAddModal()">
            <i class="fa fa-plus me-1"></i> Nueva Programacion
          </button>
        </div>
        <div class="card">
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Maquina</th>
                    <th>Componente</th>
                    <th>Frecuencias</th>
                    <th>Fecha Programada</th>
                    <th>Tecnico</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  ${records.length === 0
                    ? '<tr><td colspan="7" class="text-center text-muted py-3">No hay mantenimientos preventivos programados</td></tr>'
                    : records.map(r => `
                      <tr>
                        <td>${this._esc(this._getMachineName(r.maquina_id))}</td>
                        <td>${this._esc(this._getComponentName(r.componente_id))}</td>
                        <td>${this._esc(r.frecuencias)}</td>
                        <td>${this._esc(r.fecha_programada)}</td>
                        <td>${this._esc(r.tecnico)}</td>
                        <td><span class="badge ${this._estadoBadge(r.estado)}">${this._esc(r.estado)}</span></td>
                        <td>
                          <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" onclick="SigmaPreventive.openEditModal('${r.id}')" title="Editar">
                              <i class="fa fa-edit"></i>
                            </button>
                            <button class="btn btn-outline-danger" onclick="SigmaPreventive.confirmDelete('${r.id}')" title="Eliminar">
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
      container.innerHTML = `<div class="alert alert-danger">Error al cargar mantenimientos preventivos: ${this._esc(err.message)}</div>`;
    }
  },

  _getMachineName(id) {
    const m = this.machines.find(m => m.id === id);
    return m ? m.nombre : '-';
  },

  _getComponentName(id) {
    const c = this.components.find(c => c.id === id);
    return c ? c.nombre : '-';
  },

  _estadoBadge(estado) {
    const map = {
      'Programada': 'bg-info',
      'En Proceso': 'bg-warning text-dark',
      'Realizada': 'bg-success',
      'Vencida': 'bg-danger'
    };
    return map[estado] || 'bg-secondary';
  },

  _getFormHtml(record) {
    const machineOptions = this.machines.map(m =>
      `<option value="${m.id}" ${record && record.maquina_id === m.id ? 'selected' : ''}>${this._esc(m.nombre)}</option>`
    ).join('');

    const componentOptions = this.components.map(c =>
      `<option value="${c.id}" ${record && record.componente_id === c.id ? 'selected' : ''}>${this._esc(c.nombre)}</option>`
    ).join('');

    return `
      <form id="preventiveForm" onsubmit="SigmaPreventive.saveForm(event)">
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label">Maquina *</label>
            <select class="form-select" name="maquina_id" required>
              <option value="">Seleccionar maquina...</option>
              ${machineOptions}
            </select>
          </div>
          <div class="col-md-6">
            <label class="form-label">Componente *</label>
            <select class="form-select" name="componente_id" required>
              <option value="">Seleccionar componente...</option>
              ${componentOptions}
            </select>
          </div>
          <div class="col-md-6">
            <label class="form-label">Frecuencias</label>
            <input type="text" class="form-control" name="frecuencias" value="${this._esc(record ? record.frecuencias : '')}">
          </div>
          <div class="col-md-6">
            <label class="form-label">Fecha Programada *</label>
            <input type="date" class="form-control" name="fecha_programada" required value="${this._esc(record ? record.fecha_programada : '')}">
          </div>
          <div class="col-md-6">
            <label class="form-label">Tecnico</label>
            <input type="text" class="form-control" name="tecnico" value="${this._esc(record ? record.tecnico : '')}">
          </div>
          <div class="col-md-6">
            <label class="form-label">Estado</label>
            <select class="form-select" name="estado">
              <option value="Programada" ${record && record.estado === 'Programada' ? 'selected' : ''}>Programada</option>
              <option value="En Proceso" ${record && record.estado === 'En Proceso' ? 'selected' : ''}>En Proceso</option>
              <option value="Realizada" ${record && record.estado === 'Realizada' ? 'selected' : ''}>Realizada</option>
              <option value="Vencida" ${record && record.estado === 'Vencida' ? 'selected' : ''}>Vencida</option>
            </select>
          </div>
          <div class="col-12">
            <label class="form-label">Observaciones</label>
            <textarea class="form-control" name="observaciones" rows="3">${this._esc(record ? record.observaciones : '')}</textarea>
          </div>
        </div>
        <input type="hidden" name="id" value="${record ? record.id : ''}">
      </form>
    `;
  },

  openAddModal() {
    App.showModal('Nueva Mantencion Preventiva', this._getFormHtml(null),
      '<button class="btn btn-secondary" onclick="App.hideModal()">Cancelar</button> <button class="btn btn-primary" onclick="document.getElementById(\'preventiveForm\').requestSubmit()">Guardar</button>'
    );
  },

  async openEditModal(id) {
    try {
      const record = await api.sigma().crud('preventive_maintenance').getById(id);
      App.showModal('Editar Mantencion Preventiva', this._getFormHtml(record),
        '<button class="btn btn-secondary" onclick="App.hideModal()">Cancelar</button> <button class="btn btn-primary" onclick="document.getElementById(\'preventiveForm\').requestSubmit()">Actualizar</button>'
      );
    } catch (err) {
      App.toast('Error al cargar registro: ' + err.message, 'error');
    }
  },

  async saveForm(e) {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));
    data.maquina_id = data.maquina_id || null;
    data.componente_id = data.componente_id || null;

    try {
      if (data.id) {
        await api.sigma().crud('preventive_maintenance').update(data.id, data);
        App.toast('Registro actualizado correctamente', 'success');
      } else {
        delete data.id;
        await api.sigma().crud('preventive_maintenance').create(data);
        App.toast('Registro creado correctamente', 'success');
      }
      App.hideModal();
      this.render();
    } catch (err) {
      App.toast('Error al guardar: ' + err.message, 'error');
    }
  },

  confirmDelete(id) {
    App.showModal('Confirmar Eliminacion',
      '<p>¿Está seguro que desea eliminar este registro de mantenimiento preventivo?</p>',
      `<button class="btn btn-secondary" onclick="App.hideModal()">Cancelar</button> <button class="btn btn-danger" onclick="SigmaPreventive.doDelete('${id}')">Eliminar</button>`
    );
  },

  async doDelete(id) {
    try {
      await api.sigma().crud('preventive_maintenance').delete(id);
      App.toast('Registro eliminado correctamente', 'success');
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
