const { query } = require('../config/database');

// =====================================================
// DATOS COMBINADOS (N+1 fix endpoints)
// =====================================================

const getCalendarData = async (month, year) => {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    const [preventivos, correctivos, maquinas, componentes] = await Promise.all([
        query(`SELECT id, maquina_id, componente_id, fecha_programada, fecha_ejecutada, estado FROM preventive_maintenance WHERE fecha_programada >= $1 AND fecha_programada < $2`, [startDate, endDate]),
        query(`SELECT id, maquina_id, componente_id, fecha_falla, estado FROM corrective_maintenance WHERE fecha_falla >= $1 AND fecha_falla < $2`, [startDate, endDate]),
        query('SELECT id, codigo, nombre FROM machines'),
        query('SELECT id, nombre FROM components')
    ]);

    return {
        preventivos: preventivos.rows,
        correctivos: correctivos.rows,
        maquinas: maquinas.rows,
        componentes: componentes.rows
    };
};

const getDashboardData = async (getSigmaStats) => {
    const [stats, preventivos, correctivos, maquinas, componentes] = await Promise.all([
        getSigmaStats(),
        query('SELECT * FROM preventive_maintenance ORDER BY id'),
        query('SELECT * FROM corrective_maintenance ORDER BY id'),
        query('SELECT * FROM machines ORDER BY id'),
        query('SELECT * FROM components ORDER BY id')
    ]);

    return {
        stats,
        preventivos: preventivos.rows,
        correctivos: correctivos.rows,
        maquinas: maquinas.rows,
        componentes: componentes.rows
    };
};

const getPreventiveData = async () => {
    const [preventivos, maquinas, componentes] = await Promise.all([
        query('SELECT * FROM preventive_maintenance ORDER BY id'),
        query('SELECT id, codigo, nombre, tipo_id FROM machines ORDER BY id'),
        query('SELECT id, nombre FROM components ORDER BY id')
    ]);

    return {
        preventivos: preventivos.rows,
        maquinas: maquinas.rows,
        componentes: componentes.rows
    };
};

const getCorrectiveData = async () => {
    const [correctivos, maquinas, componentes] = await Promise.all([
        query('SELECT * FROM corrective_maintenance ORDER BY id'),
        query('SELECT id, codigo, nombre, tipo_id FROM machines ORDER BY id'),
        query('SELECT id, nombre FROM components ORDER BY id')
    ]);

    return {
        correctivos: correctivos.rows,
        maquinas: maquinas.rows,
        componentes: componentes.rows
    };
};

const getMachineTypesData = async () => {
    const [tipos, componentes, machineTypeLinks, maquinas] = await Promise.all([
        query('SELECT * FROM machine_types ORDER BY id'),
        query('SELECT id, nombre FROM components ORDER BY nombre'),
        query('SELECT * FROM component_type_links'),
        query('SELECT id, tipo_id FROM machines')
    ]);

    return {
        tipos: tipos.rows,
        componentes: componentes.rows,
        links: machineTypeLinks.rows,
        maquinas: maquinas.rows
    };
};

// =====================================================
// STATS SUMMARY
// =====================================================

const getStatsSummary = async () => {
    const hoy = new Date().toISOString().split('T')[0];
    const en15dias = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [machines, completedPreventive, upcoming, overdue, failures, criticalParts, recentFailures] = await Promise.all([
        query('SELECT COUNT(*) as c FROM machines'),
        query("SELECT COUNT(*) as c FROM preventive_maintenance WHERE estado = 'Realizada'"),
        query("SELECT COUNT(*) as c FROM preventive_maintenance WHERE fecha_programada >= $1 AND fecha_programada <= $2 AND estado != 'Realizada'", [hoy, en15dias]),
        query("SELECT COUNT(*) as c FROM preventive_maintenance WHERE fecha_programada < $1 AND estado != 'Realizada'", [hoy]),
        query('SELECT COUNT(*) as c FROM corrective_maintenance'),
        query('SELECT COUNT(*) as c FROM spare_parts WHERE stock_actual <= stock_minimo'),
        query('SELECT * FROM corrective_maintenance ORDER BY id DESC LIMIT 5')
    ]);

    const failuresReparadas = await query("SELECT COUNT(*) as c FROM corrective_maintenance WHERE estado = 'Reparada' OR fecha_reparacion IS NOT NULL");
    const totalFailures = Number(failures.rows[0].c);
    const reparadas = Number(failuresReparadas.rows[0].c);

    return {
        totalMachines: Number(machines.rows[0].c),
        completedMaintenance: Number(completedPreventive.rows[0].c),
        upcomingMaintenance: Number(upcoming.rows[0].c),
        overdueMaintenance: Number(overdue.rows[0].c),
        totalFailures,
        failuresReparadas: reparadas,
        failuresEnMantencion: totalFailures - reparadas,
        criticalSpareParts: Number(criticalParts.rows[0].c),
        recentFailures: recentFailures.rows
    };
};

// =====================================================
// MÁQUINAS: DETALLE Y COMPONENTES
// =====================================================

const getComponentsByType = async (tipoId) => {
    const result = await query(
        `SELECT c.* FROM components c
         INNER JOIN component_type_links ctl ON c.id = ctl.componente_id
         WHERE ctl.tipo_id = $1 ORDER BY c.nombre`, [tipoId]
    );
    return result.rows;
};

const getMachineDetails = async (id) => {
    const machineResult = await query('SELECT * FROM machines WHERE id = $1', [id]);
    if (machineResult.rows.length === 0) return null;

    const maquina = machineResult.rows[0];
    const tipoResult = maquina.tipo_id
        ? await query('SELECT * FROM machine_types WHERE id = $1', [maquina.tipo_id])
        : { rows: [] };

    const [comps, preventivos, correctivos] = await Promise.all([
        query(`SELECT c.* FROM components c
               INNER JOIN machine_components mc ON c.id = mc.componente_id
               WHERE mc.maquina_id = $1`, [id]),
        query('SELECT * FROM preventive_maintenance WHERE maquina_id = $1 ORDER BY fecha_programada DESC', [id]),
        query('SELECT * FROM corrective_maintenance WHERE maquina_id = $1 ORDER BY fecha_falla DESC', [id])
    ]);

    return {
        maquina,
        tipo: tipoResult.rows[0] || null,
        componentes: comps.rows,
        preventivos: preventivos.rows,
        correctivos: correctivos.rows
    };
};

const getMachineComponents = async (maquinaId) => {
    const result = await query(
        `SELECT c.* FROM components c
         INNER JOIN machine_components mc ON c.id = mc.componente_id
         WHERE mc.maquina_id = $1 ORDER BY c.nombre`, [maquinaId]
    );
    return result.rows;
};

const setMachineComponents = async (maquinaId, componentes) => {
    await query('DELETE FROM machine_components WHERE maquina_id = $1', [maquinaId]);
    for (const compId of componentes) {
        await query('INSERT INTO machine_components (maquina_id, componente_id) VALUES ($1, $2)', [maquinaId, compId]);
    }
};

// =====================================================
// REPORTES
// =====================================================

const JOINS_PM = `
    FROM preventive_maintenance pm
    LEFT JOIN machines m ON pm.maquina_id = m.id
    LEFT JOIN components c ON pm.componente_id = c.id
`;

const getOverdue = async () => {
    const hoy = new Date().toISOString().split('T')[0];
    const result = await query(
        `SELECT pm.*, m.nombre as maquina_nombre, c.nombre as componente_nombre
         ${JOINS_PM}
         WHERE pm.fecha_programada < $1 AND pm.estado != 'Realizada'
         ORDER BY pm.fecha_programada ASC`, [hoy]
    );
    return result.rows;
};

const getUpcoming = async (days = 15) => {
    const hoy = new Date().toISOString().split('T')[0];
    const futuro = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const result = await query(
        `SELECT pm.*, m.nombre as maquina_nombre, c.nombre as componente_nombre
         ${JOINS_PM}
         WHERE pm.fecha_programada >= $1 AND pm.fecha_programada <= $2 AND pm.estado != 'Realizada'
         ORDER BY pm.fecha_programada ASC`, [hoy, futuro]
    );
    return result.rows;
};

const getCompleted = async () => {
    const result = await query(
        `SELECT pm.*, m.nombre as maquina_nombre, c.nombre as componente_nombre
         ${JOINS_PM}
         WHERE pm.estado = 'Realizada'
         ORDER BY pm.fecha_ejecutada DESC`
    );
    return result.rows;
};

const getRecentCompleted = async () => {
    const result = await query(
        `SELECT pm.*, m.nombre as maquina_nombre, c.nombre as componente_nombre
         ${JOINS_PM}
         WHERE pm.estado = 'Realizada' AND pm.fecha_ejecutada IS NOT NULL
         ORDER BY pm.fecha_ejecutada DESC LIMIT 5`
    );
    return result.rows;
};

const getTopFailingMachines = async () => {
    const result = await query(
        `SELECT m.id as maquina_id, m.nombre, COUNT(cm.id) as total_fallas
         FROM corrective_maintenance cm
         JOIN machines m ON cm.maquina_id = m.id
         GROUP BY m.id, m.nombre
         ORDER BY total_fallas DESC
         LIMIT 5`
    );
    return result.rows;
};

const getByPeriod = async (start, end) => {
    const result = await query(
        `SELECT pm.*, m.nombre as maquina_nombre, c.nombre as componente_nombre
         ${JOINS_PM}
         WHERE pm.fecha_programada >= $1 AND pm.fecha_programada <= $2
         ORDER BY pm.fecha_programada ASC`, [start || '2000-01-01', end || '2099-12-31']
    );
    return result.rows;
};

const getBitacora = async () => {
    const preventivos = await query(
        `SELECT pm.*, m.nombre as maquina_nombre, c.nombre as componente_nombre,
                'Preventiva' as tipo_mantencion,
                pm.observaciones as detalle,
                pm.tecnico,
                pm.fecha_ejecutada,
                pm.fecha_programada
         ${JOINS_PM}`
    );

    const correctivos = await query(
        `SELECT cm.*, m.nombre as maquina_nombre, c.nombre as componente_nombre,
                'Correctiva' as tipo_mantencion,
                cm.descripcion_falla as detalle,
                cm.responsable as tecnico,
                cm.fecha_falla as fecha_ejecutada,
                cm.fecha_falla as fecha_programada
         FROM corrective_maintenance cm
         LEFT JOIN machines m ON cm.maquina_id = m.id
         LEFT JOIN components c ON cm.componente_id = c.id`
    );

    return [
        ...preventivos.rows.map(r => ({ ...r, tipo_mantencion: 'Preventiva' })),
        ...correctivos.rows.map(r => ({ ...r, tipo_mantencion: 'Correctiva' }))
    ].sort((a, b) => {
        const dateA = a.fecha_ejecutada || a.fecha_programada || '';
        const dateB = b.fecha_ejecutada || b.fecha_programada || '';
        return dateB.localeCompare(dateA);
    });
};

module.exports = {
    getCalendarData,
    getDashboardData,
    getPreventiveData,
    getCorrectiveData,
    getMachineTypesData,
    getStatsSummary,
    getComponentsByType,
    getMachineDetails,
    getMachineComponents,
    setMachineComponents,
    getOverdue,
    getUpcoming,
    getCompleted,
    getRecentCompleted,
    getTopFailingMachines,
    getByPeriod,
    getBitacora
};
