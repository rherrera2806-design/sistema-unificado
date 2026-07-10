class ApiClient {
    constructor() { this.baseUrl = '/api'; }
    async request(method, path, body = null) {
        const opts = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(`${this.baseUrl}${path}`, opts);
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(err.error || `HTTP ${res.status}`);
        }
        return res.json();
    }
    // Auth
    async login(email, password) { return this.request('POST', '/auth/login', { email, password }); }
    async register(nombre, email, password) { return this.request('POST', '/auth/registro', { nombre, email, password }); }
    // Generic CRUD
    async getAll(collection, params = {}) {
        const qs = new URLSearchParams(params).toString();
        return this.request('GET', `/${collection}${qs ? '?' + qs : ''}`);
    }
    async insert(collection, data) { return this.request('POST', `/${collection}`, data); }
    async update(collection, id, data) { return this.request('PUT', `/${collection}/${id}`, data); }
    async delete(collection, id) { return this.request('DELETE', `/${collection}/${id}`); }
    // Sigma shortcuts
    sigma() {
        const self = this;
        return {
            stats: () => self.request('GET', '/sigma/stats/summary'),
            getMachines: () => self.getAll('sigma/machines'),
            getMachineDetails: (id) => self.request('GET', `/sigma/machines/${id}/details`),
            getMachineComponents: (id) => self.request('GET', `/sigma/machines/${id}/components`),
            saveMachineComponents: (id, componentes) => self.request('PUT', `/sigma/machines/${id}/components`, { componentes }),
            getComponentsByType: (tipoId) => self.request('GET', `/sigma/components/by-type/${tipoId}`),
            reports: (type, params = {}) => self.request('GET', `/sigma/reports/${type}`, null),
            reportsUrl: (type, qs) => self.request('GET', `/sigma/reports/${type}${qs ? '?' + qs : ''}`),
            crud: (table) => ({
                getAll: () => self.getAll(`sigma/${table}`),
                getById: (id) => self.request('GET', `/sigma/${table}/${id}`),
                create: (data) => self.insert(`sigma/${table}`, data),
                update: (id, data) => self.request('PUT', `/sigma/${table}/${id}`, data),
                delete: (id) => self.delete(`sigma/${table}`, id)
            }),
            exportData: () => self.request('GET', '/sigma/export'),
            importData: (data) => self.insert('sigma/import', data),
            reset: () => self.request('POST', '/sigma/reset'),
            clear: () => self.request('POST', '/sigma/clear')
        };
    }
    // Inventario shortcuts
    inv() {
        const self = this;
        return {
            getMovimientos: (f = {}) => self.getAll('inv/movimientos', f),
            crearMovimiento: (data) => self.insert('inv/movimientos', data),
            eliminarMovimiento: (id) => self.delete('inv/movimientos', id),
            getInventario: (f = {}) => self.getAll('inv/inventario', f),
            getEstadisticas: () => self.request('GET', '/inv/estadisticas'),
            getEstadisticasPorTipo: () => self.request('GET', '/inv/estadisticas-por-tipo'),
            getTiposCristal: () => self.request('GET', '/inv/tipos-cristal')
        };
    }
}
const api = new ApiClient();
