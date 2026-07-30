describe('Router structure', () => {
    it('loads all route modules without errors', () => {
        const router = require('../routes/router');
        expect(router).toBeDefined();
        expect(typeof router).toBe('function');
    });

    it('loads auth routes', () => {
        const r = require('../routes/authRoutes');
        expect(r).toBeDefined();
    });

    it('loads pedidos routes', () => {
        const r = require('../routes/pedidos');
        expect(r).toBeDefined();
    });

    it('loads admin routes', () => {
        const r = require('../routes/adminUsuarios');
        expect(r).toBeDefined();
    });

    it('loads R2 storage routes', () => {
        const r = require('../routes/r2Storage');
        expect(r).toBeDefined();
    });

    it('loads sigma extended routes', () => {
        const r = require('../routes/sigmaExtended');
        expect(r).toBeDefined();
    });

    it('loads turnos extended routes', () => {
        const r = require('../routes/turnosExtended');
        expect(r).toBeDefined();
    });

    it('loads instalaciones routes', () => {
        const r = require('../routes/instalaciones');
        expect(r).toBeDefined();
    });

    it('loads produccion ordenes routes', () => {
        const r = require('../routes/produccionOrdenes');
        expect(r).toBeDefined();
    });

    it('loads produccion config routes', () => {
        const r = require('../routes/produccionConfig');
        expect(r).toBeDefined();
    });

    it('loads produccion catalogos routes', () => {
        const r = require('../routes/produccionCatalogos');
        expect(r).toBeDefined();
    });

    it('loads produccion planificacion routes', () => {
        const r = require('../routes/produccionPlanificacion');
        expect(r).toBeDefined();
    });

    it('loads taller routes', () => {
        const r = require('../routes/taller');
        expect(r).toBeDefined();
    });
});

describe('Services', () => {
    it('loads sigma service', () => {
        const s = require('../services/sigma');
        expect(s).toBeDefined();
    });

    it('loads auth service', () => {
        const s = require('../services/auth');
        expect(s).toBeDefined();
    });

    it('loads turnos service', () => {
        const s = require('../services/turnos');
        expect(s).toBeDefined();
    });

    it('loads produccionOrdenes service', () => {
        const s = require('../services/produccionOrdenes');
        expect(s).toBeDefined();
    });

    it('loads produccionConfig service', () => {
        const s = require('../services/produccionConfig');
        expect(s).toBeDefined();
    });

    it('loads produccionCatalogos service', () => {
        const s = require('../services/produccionCatalogos');
        expect(s).toBeDefined();
    });

    it('loads planificacion service', () => {
        const s = require('../services/planificacion');
        expect(s).toBeDefined();
    });

    it('loads planificacionGrupo service', () => {
        const s = require('../services/planificacionGrupo');
        expect(s).toBeDefined();
    });

    it('loads taller service', () => {
        const s = require('../services/taller');
        expect(s).toBeDefined();
    });

    it('loads r2Storage service', () => {
        const s = require('../services/r2Storage');
        expect(s).toBeDefined();
    });

    it('loads adminUsuarios service', () => {
        const s = require('../services/adminUsuarios');
        expect(s).toBeDefined();
    });
});

describe('Config modules', () => {
    it('loads database config', () => {
        const c = require('../config/database');
        expect(c).toBeDefined();
    });

    it('loads R2 config', () => {
        const c = require('../config/r2');
        expect(c).toBeDefined();
    });

    it('loads constants', () => {
        const c = require('../config/constants');
        expect(c).toBeDefined();
        expect(c.MIME).toBeDefined();
    });
});

describe('R2 Storage service', () => {
    it('generates presign-post structure', () => {
        const { generatePresignPost } = require('../services/r2Storage');
        const result = generatePresignPost('test-file.pdf');
        expect(result).toHaveProperty('url');
        expect(result).toHaveProperty('key', 'pedidos/test-file.pdf');
        expect(result).toHaveProperty('publicUrl');
        expect(result).toHaveProperty('policy');
        expect(result).toHaveProperty('signature');
    });

    it('generates presign-put structure', () => {
        const { generatePresignPut } = require('../services/r2Storage');
        const result = generatePresignPut('test-file.pdf');
        expect(result).toHaveProperty('url');
        expect(result).toHaveProperty('key', 'pedidos/test-file.pdf');
        expect(result).toHaveProperty('queryParams');
    });

    it('gets public url', () => {
        const { getPublicUrl } = require('../services/r2Storage');
        const result = getPublicUrl('test/key.pdf');
        expect(result.url).toContain('test/key.pdf');
    });
});
