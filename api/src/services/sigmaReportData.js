const { query } = require('../config/database');

const JOINS_PM = `
    FROM preventive_maintenance pm
    LEFT JOIN machines m ON pm.maquina_id = m.id
    LEFT JOIN components c ON pm.componente_id = c.id
`;

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

module.exports = { getStatsSummary, getOverdue, getUpcoming, getCompleted, getRecentCompleted, getTopFailingMachines, getByPeriod, getBitacora };
