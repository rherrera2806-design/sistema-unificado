class ApiClient {
    constructor() {
        this.baseUrl = '/api';
        this.cache = {};
    }

    async request(method, path, body = null) {
        const opts = {
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(`${this.baseUrl}${path}`, opts);
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(err.error || `HTTP ${res.status}`);
        }
        return res.json();
    }

    async getAll(collection) {
        const data = await this.request('GET', `/${collection}`);
        return data;
    }

    async getById(collection, id) {
        return this.request('GET', `/${collection}/${id}`);
    }

    async insert(collection, data) {
        return this.request('POST', `/${collection}`, data);
    }

    async update(collection, id, data) {
        return this.request('PUT', `/${collection}/${id}`, data);
    }

    async delete(collection, id) {
        return this.request('DELETE', `/${collection}/${id}`);
    }

    async query(collection, filterFn) {
        const all = await this.getAll(collection);
        return all.filter(filterFn);
    }

    async getComponentsByType(tipoId) {
        return this.request('GET', `/components/by-type/${tipoId}`);
    }

    async getMachineWithDetails(maquinaId) {
        return this.request('GET', `/machines/${maquinaId}/details`);
    }

    async getOverdueMaintenance() {
        return this.request('GET', '/reports/overdue');
    }

    async getUpcomingMaintenance(days = 15) {
        return this.request('GET', `/reports/upcoming?days=${days}`);
    }

    async getCompletedMaintenance() {
        return this.request('GET', '/reports/completed');
    }

    async getMaintenanceByPeriod(startDate, endDate) {
        return this.request('GET', `/reports/by-period?start=${startDate}&end=${endDate}`);
    }

    async exportJSON() {
        return this.request('GET', '/export');
    }

    async importJSON(json) {
        const data = typeof json === 'string' ? JSON.parse(json) : json;
        return this.request('POST', '/import', data);
    }

    async resetDatabase() {
        return this.request('POST', '/reset');
    }

    async getStatsSummary() {
        return this.request('GET', '/stats/summary');
    }

    async getRecentCompleted() {
        return this.request('GET', '/reports/recent-completed');
    }

    async getBitacora() {
        return this.request('GET', '/reports/bitacora');
    }

    async getMachineComponents(maquinaId) {
        return this.request('GET', `/machines/${maquinaId}/components`);
    }

    async saveMachineComponents(maquinaId, componentes) {
        return this.request('PUT', `/machines/${maquinaId}/components`, { componentes });
    }
}

window.db = new ApiClient();
