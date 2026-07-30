const { query } = require('../config/database');

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

module.exports = { getComponentsByType, getMachineDetails, getMachineComponents, setMachineComponents };
