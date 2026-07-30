const { query } = require('../config/database');

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

const { getStatsSummary, getOverdue, getUpcoming, getCompleted, getRecentCompleted, getTopFailingMachines, getByPeriod, getBitacora } = require('./sigmaReportData');
const { getComponentsByType, getMachineDetails, getMachineComponents, setMachineComponents } = require('./sigmaMachineDetails');

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
