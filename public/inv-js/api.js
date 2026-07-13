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
    async login(email, password) { 
        return this.request('POST', '/auth/login', { email, password }); 
    }

    // Catálogos
    catalogos = {
        // Tipos de Cristal
        getTiposCristal: () => this.request('GET', '/catalogos/tipos-cristal'),
        crearTipoCristal: (nombre) => this.request('POST', '/catalogos/tipos-cristal', { nombre }),
        eliminarTipoCristal: (id) => this.request('DELETE', `/catalogos/tipos-cristal/${id}`),
        
        // Espesores
        getEspesores: () => this.request('GET', '/catalogos/espesores'),
        crearEspesor: (valor) => this.request('POST', '/catalogos/espesores', { valor }),
        eliminarEspesor: (id) => this.request('DELETE', `/catalogos/espesores/${id}`)
    };

    // Inventario
    inv() {
        const self = this;
        return {
            getMovimientos: (f = {}) => {
                const qs = new URLSearchParams(f).toString();
                return self.request('GET', `/inv/movimientos${qs ? '?' + qs : ''}`);
            },
            crearMovimiento: (data) => self.request('POST', '/inv/movimientos', data),
            eliminarMovimiento: (id) => self.request('DELETE', `/inv/movimientos/${id}`),
            getInventario: (f = {}) => {
                const qs = new URLSearchParams(f).toString();
                return self.request('GET', `/inv/inventario${qs ? '?' + qs : ''}`);
            },
            getEstadisticas: () => self.request('GET', '/inv/estadisticas'),
            getEstadisticasPorTipo: () => self.request('GET', '/inv/estadisticas-por-tipo'),
            getTiposCristal: () => self.request('GET', '/catalogos/tipos-cristal'),
            getEspesores: () => self.request('GET', '/catalogos/espesores')
        };
    }

    // Sigma
    sigma() {
        const self = this;
        return {
            stats: () => self.request('GET', '/sigma/stats'),
            exportData: () => self.request('GET', '/sigma/export'),
            importData: (data) => self.request('POST', '/sigma/import', data),
            reset: () => self.request('POST', '/sigma/clear')
        };
    }

    // Turnos
    turnos = {
        getEstado: () => this.request('GET', '/turnos/estado'),
        crear: (nombre) => this.request('POST', '/turnos/crear', { nombre }),
        siguiente: () => this.request('POST', '/turnos/siguiente'),
        getCola: () => this.request('GET', '/turnos/cola')
    };

    // Admin
    admin = {
        getUsuarios: () => this.request('GET', '/admin/usuarios'),
        crearUsuario: (data) => this.request('POST', '/admin/usuarios', data)
    };
}

const api = new ApiClient();
