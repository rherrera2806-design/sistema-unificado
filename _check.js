const {query} = require('./api/src/config/database');
async function main() {
    const r = await query(`SELECT o.id, o.grupo, o.kilos, o.metros_cuadrados, o.cantidad, o.estado_programacion,
        (SELECT COUNT(*) FROM cola_produccion_pasos cp WHERE cp.orden_produccion_id = o.id) as num_pasos
        FROM produccion_ordenes o WHERE o.estado_programacion = 'PENDIENTE' LIMIT 5`);
    console.log('PENDIENTES:', JSON.stringify(r.rows, null, 2));
    const r2 = await query(`SELECT * FROM produccion_capacidad_grupo WHERE activo = TRUE`);
    console.log('CAP GRUPOS:', JSON.stringify(r2.rows, null, 2));
    process.exit();
}
main();
