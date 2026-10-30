// ============================================================================
// planificacionMotor.js — MOTOR ÚNICO DE PLANIFICACIÓN DE PRODUCCIÓN
// ============================================================================
// Reemplaza a los dos motores que convivían (planificacionAuto.js "DBR" y
// reprogramarService.reprogramarPorAvance) por UNA sola implementación, para
// que "Solo pendientes" y "Reprogramar todo" den exactamente el mismo plan.
//
// REGLAS DE NEGOCIO (confirmadas con la planta):
//   · COLA: atrasados primero, luego 4 Reposición → 2 Express → 3 Urgencia →
//     1 Normal. Express va ANTES que Urgencia (el cliente paga por eso).
//   · CUELOS DE BOTELLA: TODOS los marcados en estaciones_maestras cuentan.
//     La ruta se camina estación por estación y cada una valida su cupo; la más
//     cargada empuja la fecha sola. NO hay un "drum" único.
//   · VENTANA RÍGIDA = RESTRICCIÓN (bloquea), no aviso: Repo 2 · Express 3 ·
//     Urgencia 3 días hábiles desde el ingreso. Si no cabe, NO se agenda y sale
//     como "sin cupo en ventana". Si la ventana ya venció, se agenda lo antes
//     posible y se marca VENCIDA.
//   · CAPACIDAD ESTACIÓN (m²) por TURNO (día/noche).
//   · CAPACIDAD GRUPO (kg) por DÍA completo — no se divide entre turnos.
//   · SPLIT: un pedido que no cabe en un turno de la estación más restrictiva
//     se divide en 2 (A/B) SOLO si no tiene avance. Nunca se parte algo fabricado.
//   · HERMANOS BOM: las partes de un mismo compuesto se agendan juntas (mismo
//     día de Armado), porque el ensamblaje necesita todas las piezas.
//   · Un paso por TURNO: los procesos se encadenan de un turno al siguiente
//     sin esperar (Pulido 🌞 lun → Templado 🌙 lun).
//   · Nunca se programa para hoy: por defecto parte del siguiente día hábil.
//   · Avance implícito: un paso anterior intacto a uno avanzado se cierra solo.
//
// Columnas: estaciones_maestras.cap_max (m²/día, 0 = sin tope) y
// cuello_botella (bool). NO confundir con produccion_maquinas.capacidad_max_m2_dia.
// ============================================================================
const { query } = require('../config/database');
const { transaction } = require('../config/dbPool');
const calendario = require('./calendario');
const configTurnos = require('./configTurnos');
const turnosHoySvc = require('./turnosHoy');
const { cerrarPasosAtrasados } = require('./avanceImplicito');

// Orden de cola por prioridad. 4 Reposición es lo más urgente; Express (2)
// pasa antes que Urgencia (3) porque el cliente paga por Express.
const RANGO_PRIO = { 4: 0, 2: 1, 3: 2, 1: 3 };
// Días hábiles de ventana rígida desde el ingreso (created_at).
const VENTANA_DIAS = { 4: 2, 2: 3, 3: 3 };
const NOMBRE_PRIO = { 4: 'Reposición', 2: 'Express', 3: 'Urgencia', 1: 'Normal' };

const fmtL = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
// "Ahora" SIEMPRE en hora de Chile: el servidor corre en UTC y a la noche
// "hoy" se convertía en "mañana".
const ahoraCL = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }));
const esHecho = (estado) => estado === 'TERMINADO' || estado === 'MERMADO';

// Backfill una-sola-vez por proceso (evita recorrer tablas completas en cada
// corrida y la carrera entre ejecuciones concurrentes).
let backfillPromise = null;
const backfillUnaVez = (fn) => {
    if (!backfillPromise) {
        backfillPromise = fn().catch((e) => { backfillPromise = null; throw e; });
    }
    return backfillPromise;
};

// ═══════════════════════════════════════════════════════════════════════════
// PLANIFICAR — entrada única del motor
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @param {Object} opts
 * @param {'pendientes'|'todo'} opts.modo  'pendientes' = solo órdenes sin fecha
 *        (el plan ya programado NO se toca). 'todo' = libera lo no iniciado y
 *        rehace el plan completo por prioridad.
 * @param {string} [opts.fechaMinima]  'YYYY-MM-DD' de inicio. Por defecto el
 *        siguiente día hábil.
 * @param {string[]} [opts.turnosHoy]  turnos de HOY con capacidad restante
 *        (solo si el inicio es hoy): ['dia'] | ['noche'] | ['dia','noche'].
 * @param {number} [opts.dias]  horizonte en DÍAS HÁBILES a buscar cupo.
 * @param {boolean} [opts.permitirSplit]  dividir pedidos grandes sin avance.
 */
async function planificar({ modo = 'pendientes', fechaMinima, turnosHoy, dias = 45, permitirSplit = true } = {}) {
    dias = Math.max(Number(dias) || 45, 7);

    // ═══ 1. FECHA MÍNIMA ══════════════════════════════════════════════════
    // Por defecto NUNCA se parte de hoy ("hoy no alcanza": el día ya está en
    // curso). El planificador puede elegir otra fecha con el selector "Desde".
    const hoyCL = fmtL(ahoraCL());
    let desde = fechaMinima || await calendario.siguienteDiaHabil(hoyCL);

    // ═══ 2. MODO 'todo' — LIBERAR LO NO INICIADO ══════════════════════════
    // REGLA DE ORO: NUNCA se tocan EN_PROCESO, TERMINADO, MERMADO ni CERRADO.
    // fecha_entrega_pactada NO se limpia: puede ser un pacto cargado a mano.
    let ordenesLiberadas = 0;
    let idsLiberadas = [];
    if (modo === 'todo') {
        const liberar = await query(`
            UPDATE produccion_ordenes
            SET estado_programacion = 'PENDIENTE', fecha_programada = NULL
            WHERE estado_programacion NOT IN ('EN_PROCESO', 'TERMINADO', 'MERMADO', 'CERRADO')
              AND (estado_programacion = 'PROGRAMADO' OR fecha_programada IS NOT NULL)
            RETURNING id
        `);
        ordenesLiberadas = liberar.rowCount;
        idsLiberadas = liberar.rows.map(r => r.id);
    }

    // ═══ 3. AVANCE IMPLÍCITO ══════════════════════════════════════════════
    // Cierra pasos intactos que quedaron "atrás" del avance real: si Templado
    // avanzó, el Corte ocurrió. Sin esto se re-programaba trabajo fantasma.
    let avanceCerrado = 0;
    try {
        const ac = await cerrarPasosAtrasados({ motivo: modo === 'todo' ? 'reprogramación total' : 'auto-asignación' });
        avanceCerrado = ac.cerrados;
    } catch (_) { }

    // ═══ 4. SINCRONIZAR RUTAS CON LA RECETA ACTUAL ════════════════════════
    // Si cambió la receta de un código, las órdenes sin trabajar se regeneran
    // desde procesos_especificos_json. Solo si la receta define estaciones que
    // la ruta actual NO tiene. Nunca se tocan órdenes con pasos trabajados.
    let rutasActualizadas = 0;
    try {
        rutasActualizadas = await _sincronizarRutas();
    } catch (_) { }

    // ═══ 5. LIMPIAR FECHAS DE PASOS LIBERADOS ═════════════════════════════
    // Solo lo intacto (PENDIENTE sin horas). Se conserva el trabajo real.
    if (idsLiberadas.length > 0) {
        await query(`
            UPDATE cola_produccion_pasos
            SET fecha_programada = NULL, m2_asignados = 0
            WHERE orden_produccion_id = ANY($1)
              AND estado = 'PENDIENTE'
              AND hora_inicio IS NULL AND hora_fin IS NULL
        `, [idsLiberadas]);
    }

    // ═══ 6. DATOS BASE ════════════════════════════════════════════════════
    const estRes = await query(`
        SELECT id, nombre_estacion, cap_max, cuello_botella, orden_secuencia_defecto
        FROM estaciones_maestras WHERE activa = TRUE
        ORDER BY orden_secuencia_defecto
    `);
    const estMap = {};
    const caps = new Map();          // estId -> cap_max (m²/día); 0 = sin tope
    for (const e of estRes.rows) {
        estMap[e.id] = {
            nombre: e.nombre_estacion,
            orden: e.orden_secuencia_defecto,
            cap: Number(e.cap_max) || 0,
            esCuello: !!e.cuello_botella
        };
    }

    // Capacidad por GRUPO (kg/día) — POR DÍA completo.
    const capGruposRes = await query('SELECT grupo, capacidad_kg_dia FROM produccion_capacidad_grupo WHERE activo = TRUE');
    const capsGrupo = new Map();
    for (const g of capGruposRes.rows) capsGrupo.set(String(g.grupo || ''), Number(g.capacidad_kg_dia) || 0);

    // ═══ 7. TURNOS DE HOY ═════════════════════════════════════════════════
    // HOY NO ES DÍA COMPLETO: si el inicio es hoy, la capacidad se recorta a
    // los turnos elegidos y proporcionalmente al tiempo que FALTA de cada uno.
    let pctRestanteHoy = null;   // { dia: 0..1, noche: 0..1 } | null = sin recorte
    if (desde === hoyCL) {
        const info = (await turnosHoySvc.getTurnosRestantesHoy()).turnos || [];
        const elegidos = Array.isArray(turnosHoy)
            ? turnosHoy.filter(t => t === 'dia' || t === 'noche')
            : info.filter(t => t.pct_restante > 0).map(t => t.turno);
        pctRestanteHoy = { dia: 0, noche: 0 };
        for (const t of elegidos) {
            const i = info.find(x => x.turno === t);
            if (i) pctRestanteHoy[t] = Math.max(0, Math.min(1, Number(i.pct_restante) || 0));
        }
        if (pctRestanteHoy.dia <= 0 && pctRestanteHoy.noche <= 0) {
            // Hoy ya no queda nada: se obliga a partir del siguiente día hábil
            // con el turno 1 (noche) — nunca capacidad fantasma de hoy.
            desde = await calendario.siguienteDiaHabil(hoyCL);
            pctRestanteHoy = null;
        }
    }

    // ═══ 8. BACKFILL grupo / espesor / kilos ══════════════════════════════
    // Sin grupo o kilos la orden no se puede planificar. Las órdenes nuevas ya
    // los calculan al crearse; esto cubre lo importado de SAP.
    await backfillUnaVez(async () => {
        await query(`UPDATE produccion_ordenes o SET grupo = CASE
          WHEN o.es_compuesto = TRUE THEN COALESCE(
            (SELECT cc.grupo FROM produccion_codigos cc WHERE cc.codigo = o.codigo_padre),
            (SELECT cc2.grupo FROM recetas_bom rb JOIN produccion_codigos cc2 ON cc2.codigo = rb.codigo_sap_padre WHERE rb.id = o.bom_padre_id),
            (SELECT cc2.grupo FROM produccion_recetas_bom rb JOIN produccion_codigos cc2 ON cc2.codigo = rb.codigo_sap_padre WHERE rb.id = o.bom_padre_id),
            o.grupo
          )
          ELSE COALESCE((SELECT cc.grupo FROM produccion_codigos cc WHERE cc.codigo = o.codigo_producto), o.grupo)
        END
        WHERE o.grupo IS NULL OR o.grupo = ''
           OR (o.es_compuesto = TRUE AND o.grupo = (SELECT cc.grupo FROM produccion_codigos cc WHERE cc.codigo = o.codigo_producto))`);

        await query(`UPDATE produccion_ordenes o SET espesor_mm = COALESCE(
          (SELECT NULLIF(mp.espesor_mm, 0) FROM recetas_bom rb JOIN materias_primas mp ON mp.id = rb.materia_prima_id WHERE rb.id = o.bom_padre_id),
          (SELECT NULLIF(rb_old.espesor, 0) FROM produccion_recetas_bom rb_old WHERE rb_old.id = o.bom_padre_id),
          o.espesor_mm, 6
        ) WHERE o.es_compuesto = TRUE AND o.bom_padre_id IS NOT NULL
          AND (o.espesor_mm IS NULL OR o.espesor_mm = 0)`);

        await query(`UPDATE produccion_ordenes
          SET kilos = ROUND(COALESCE(metros_cuadrados, 0) * 2.5 * COALESCE(espesor_mm, 6)::numeric, 2)
          WHERE (kilos IS NULL OR kilos = 0) AND metros_cuadrados > 0`);
    });

    // ═══ 9. ÓRDENES A PLANIFICAR ══════════════════════════════════════════
    // En ambos modos se planifica lo PENDIENTE SIN FECHA: en 'todo' la
    // liberación del paso 2 dejó así a todo lo no fabricado; en 'pendientes'
    // el plan existente ya está fechado y su carga se cargó arriba (sección 10)
    // para no doble-reservar.
    const pendRes = await query(`
        SELECT o.*,
               COALESCE(NULLIF(o.grupo, ''), '(sin grupo)') as grupo_nombre,
               COALESCE((SELECT cc.grupo FROM produccion_codigos cc WHERE cc.codigo = o.codigo_padre),
                        (SELECT cc2.grupo FROM recetas_bom rb JOIN produccion_codigos cc2 ON cc2.codigo = rb.codigo_sap_padre WHERE rb.id = o.bom_padre_id),
                        (SELECT cc2.grupo FROM produccion_recetas_bom rb JOIN produccion_codigos cc2 ON cc2.codigo = rb.codigo_sap_padre WHERE rb.id = o.bom_padre_id)) as grupo_padre
        FROM produccion_ordenes o
        WHERE o.estado_programacion = 'PENDIENTE' AND o.fecha_programada IS NULL
        ORDER BY CASE COALESCE(o.nivel_prioridad, 1) WHEN 4 THEN 1 WHEN 2 THEN 2 WHEN 3 THEN 3 ELSE 4 END ASC,
                 COALESCE(CAST(NULLIF(REGEXP_REPLACE(o.pedido_sap_id, '[^0-9]', '', 'g'), '') AS INTEGER), 999999) ASC,
                 o.item_numero ASC
    `);

    // Rutas de cada orden pendiente (estación_id en secuencia).
    const rutasRes = await query(`
        SELECT p.orden_produccion_id, p.id as paso_id, p.estacion_id, p.orden_secuencia,
               p.estado, p.m2_asignados, p.fecha_programada, p.turno
        FROM cola_produccion_pasos p
        WHERE p.orden_produccion_id IN (SELECT id FROM produccion_ordenes WHERE estado_programacion = 'PENDIENTE' AND fecha_programada IS NULL)
        ORDER BY p.orden_produccion_id, p.orden_secuencia
    `);
    const pasosPorOrden = {};
    for (const p of rutasRes.rows) {
        (pasosPorOrden[p.orden_produccion_id] = pasosPorOrden[p.orden_produccion_id] || []).push(p);
    }

    // ═══ 10. CARGA EXISTENTE (plan ya programado y pasos en curso) ═══════
    // Se carga ANTES de planificar para no doble-reservar. Dedup por orden:
    // el split histórico dejó pasos duplicados que inflaban la ocupación.
    const carga = new Map();         // 'fecha|turno|estId' -> m²
    const cargaPend = new Map();     // 'fecha|turno|estId' -> m² SOLO pasos PENDIENTE
    const cargaCurso = new Map();    // 'fecha|turno|estId' -> m² SOLO pasos EN PROCESO
    const cargaGrupoDia = new Map();     // 'fecha|grupo' -> kg  (POR DÍA)
    const cargaPendGrupoDia = new Map(); // 'fecha|grupo' -> kg pendiente
    const cargaCursoGrupoDia = new Map();// 'fecha|grupo' -> kg en curso

    const agregarCarga = (estId, grupo, fecha, turno, m2, kg, tipo = 'pend') => {
        if (!estId || !fecha || !turno) return;
        const k = fecha + '|' + turno + '|' + estId;
        carga.set(k, (carga.get(k) || 0) + m2);
        if (tipo === 'pend') cargaPend.set(k, (cargaPend.get(k) || 0) + m2);
        else if (tipo === 'curso') cargaCurso.set(k, (cargaCurso.get(k) || 0) + m2);
        if (grupo) {
            const gk = fecha + '|' + String(grupo);   // POR DÍA completo
            cargaGrupoDia.set(gk, (cargaGrupoDia.get(gk) || 0) + (Number(kg) || 0));
            if (tipo === 'pend') cargaPendGrupoDia.set(gk, (cargaPendGrupoDia.get(gk) || 0) + (Number(kg) || 0));
            else if (tipo === 'curso') cargaCursoGrupoDia.set(gk, (cargaCursoGrupoDia.get(gk) || 0) + (Number(kg) || 0));
        }
    };

    // Carga inicial: órdenes FUERA de la cola (ya programadas en modo
    // 'pendientes') y pasos EN PROCESO de cualquier orden.
    const todasRes = await query(`
        SELECT o.id as orden_id, o.nivel_prioridad, o.metros_cuadrados, o.kilos,
               COALESCE(NULLIF(o.grupo, ''), '(sin grupo)') as grupo,
               p.estacion_id, p.estado, p.m2_asignados, p.fecha_programada, p.turno
        FROM produccion_ordenes o
        JOIN cola_produccion_pasos p ON p.orden_produccion_id = o.id
        WHERE o.estado_programacion NOT IN ('TERMINADO', 'CERRADO')
        ORDER BY o.id, p.orden_secuencia
    `);
    const pendIds = new Set(pendRes.rows.map(o => o.id));
    const turnoActual = ((h) => (h >= 6 && h < 22) ? 'dia' : 'noche')(ahoraCL().getHours());
    const vistoCarga = new Set();
    for (const r of todasRes.rows) {
        if (esHecho(r.estado)) continue;
        const fs = r.fecha_programada ? fmtL(new Date(r.fecha_programada)) : null;
        const m2 = Number(r.m2_asignados) > 0 ? Number(r.m2_asignados) : (Number(r.metros_cuadrados) || 0);
        const m2o = Number(r.metros_cuadrados) || 0;
        const kg = m2o > 0 ? Number(r.kilos || 0) * m2 / m2o : Number(r.kilos || 0);
        if (pendIds.has(r.orden_id) && (r.estado === 'EN_PROCESO' || r.estado === 'PAUSADO')) {
            // Pasos en curso de una orden en la cola: ocupan HOY con su turno.
            agregarCarga(r.estacion_id, r.grupo, hoyCL, r.turno || turnoActual, m2, kg, 'curso');
        } else if (!pendIds.has(r.orden_id) && fs) {
            // Plan ya programado: su carga existe y no se puede doble-reservar.
            const dedup = fs + '|' + r.estacion_id + '|' + r.orden_id;
            if (vistoCarga.has(dedup)) continue;
            vistoCarga.add(dedup);
            agregarCarga(r.estacion_id, r.grupo, fs, r.turno || 'dia', m2, kg,
                r.estado === 'PENDIENTE' ? 'pend' : 'curso');
        }
    }

    // ═══ 11. HELPERS DE SLOTS Y CAPACIDAD ═════════════════════════════════
    const cfgTurnos = await configTurnos.getConfigTurnos();

    // fh = % de turno RESTANTE (1 en días normales; en HOY aplica el recorte).
    // Los turnos no elegidos quedan en fh = 0 → bloqueados para hoy.
    const factorHoy = (fecha, turno) => (pctRestanteHoy && fecha === hoyCL)
        ? (pctRestanteHoy[turno] || 0) : 1;

    /**
     * BLOQUEO DURO — sin tolerancia. Versión GLOBAL pura (solo los mapas de
     * carga ya confirmados). La usan la selección del ancla BOM y el overlay.
     *   ESTACIÓN por TURNO (m²):  pend + curso×fh + nuevo ≤ capTurno×fh
     *   GRUPO   por DÍA   (kg):  pend + curso×fh + nuevo ≤ capDía×fh
     */
    const cabeSlotGlobal = (estId, grupo, fecha, turno, m2, kg) => {
        const fh = factorHoy(fecha, turno);
        if (fh <= 0) return false;   // turno agotado de hoy
        const capDia = caps.get(estId) || 0;
        if (capDia > 0) {
            const k = fecha + '|' + turno + '|' + estId;
            const capTurno = configTurnos.capacidadTurno(capDia, turno, cfgTurnos);
            const efectiva = (cargaPend.get(k) || 0) + (cargaCurso.get(k) || 0) * fh;
            if (efectiva + m2 > capTurno * fh) return false;
        }
        const capG = grupo ? (capsGrupo.get(String(grupo)) || 0) : 0;
        if (capG > 0) {
            const gk = fecha + '|' + String(grupo);   // POR DÍA completo
            const kgEfectivo = (cargaPendGrupoDia.get(gk) || 0) + (cargaCursoGrupoDia.get(gk) || 0) * fh;
            if (kgEfectivo + (Number(kg) || 0) > capG * fh) return false;
        }
        return true;
    };

    // El TURNO 1 del día productivo es el NOCHE (empieza el día anterior) y el
    // TURNO 2 el DÍA. La cascada avanza en orden cronológico real:
    //   🌙 T1 → 🌞 T2 → 🌙 T1 del día hábil siguiente → 🌞 T2 → …
    const siguienteSlot = async (slot) => slot.turno === 'noche'
        ? { fecha: slot.fecha, turno: 'dia' }
        : { fecha: await calendario.siguienteDiaHabil(slot.fecha), turno: 'noche' };
    const anteriorSlot = async (slot) => slot.turno === 'dia'
        ? { fecha: slot.fecha, turno: 'noche' }
        : { fecha: await calendario.anteriorDiaHabil(slot.fecha), turno: 'dia' };

    // OVERLAY por orden: lo que esta ruta va reservando EN MEMORIA mientras se
    // ubican sus pasos. Sin esto, dos pasos de la misma orden se servían el
    // mismo cupo (el segundo veía el mapa global todavía sin el primero).
    // Se confirma contra los mapas globales recién cuando TODA la ruta encaja.
    const nuevoOverlay = () => ({ m2: new Map(), kg: new Map() });
    const cabeConOverlay = (estId, grupo, fecha, turno, m2, kg, ov) => {
        const fh = factorHoy(fecha, turno);
        if (fh <= 0) return false;
        const capDia = caps.get(estId) || 0;
        if (capDia > 0) {
            const k = fecha + '|' + turno + '|' + estId;
            const capTurno = configTurnos.capacidadTurno(capDia, turno, cfgTurnos);
            const efectiva = (cargaPend.get(k) || 0) + (cargaCurso.get(k) || 0) * fh + (ov.m2.get(k) || 0);
            if (efectiva + m2 > capTurno * fh) return false;
        }
        const capG = grupo ? (capsGrupo.get(String(grupo)) || 0) : 0;
        if (capG > 0) {
            const gk = fecha + '|' + String(grupo);
            const kgEfectivo = (cargaPendGrupoDia.get(gk) || 0) + (cargaCursoGrupoDia.get(gk) || 0) * fh + (ov.kg.get(gk) || 0);
            if (kgEfectivo + (Number(kg) || 0) > capG * fh) return false;
        }
        return true;
    };
    // Marca la reserva en el overlay (solo memoria, se descarta si no encaja).
    const marcarOverlay = (estId, grupo, fecha, turno, m2, kg, ov) => {
        const k = fecha + '|' + turno + '|' + estId;
        ov.m2.set(k, (ov.m2.get(k) || 0) + m2);
        if (grupo && kg > 0) {
            const gk = fecha + '|' + String(grupo);
            ov.kg.set(gk, (ov.kg.get(gk) || 0) + Number(kg));
        }
    };
    /**
     * Busca el primer slot con cupo (global + overlay) desde `desdeSlot`.
     * @param {string|null} fechaMax  tope superior (ventana rígida). Si se pasa
     *        y no hay cupo antes, devuelve null → NO se agenda (bloqueo).
     */
    const buscarSlot = async (estId, grupo, m2, kg, desdeSlot, fechaMax, ov) => {
        let slot = desdeSlot;
        const maxIter = dias * 4;   // grano de turno dentro del horizonte hábil
        for (let i = 0; i < maxIter; i++) {
            if (fechaMax && slot.fecha > fechaMax) return null;   // ventana agotada
            if (cabeConOverlay(estId, grupo, slot.fecha, slot.turno, m2, kg, ov)) return slot;
            slot = await siguienteSlot(slot);
        }
        return null;
    };

    // ═══ 12. COLA (jerarquía) ═════════════════════════════════════════════
    const ordenes = new Map();
    for (const o of pendRes.rows) {
        const pasos = (pasosPorOrden[o.id] || []).map(p => ({
            paso_id: p.paso_id,
            estacion_id: p.estacion_id,
            estado: p.estado,
            m2: Number(p.m2_asignados) > 0 ? Number(p.m2_asignados) : (Number(o.metros_cuadrados) || 0),
            fecha_paso: p.fecha_programada ? fmtL(new Date(p.fecha_programada)) : null,
            turno: p.turno || null
        }));
        if (!pasos.length) continue;
        const grupo = (o.es_compuesto && o.bom_padre_id && o.grupo_padre) ? o.grupo_padre : o.grupo_nombre;
        ordenes.set(o.id, {
            orden_id: o.id,
            pedido: o.pedido_sap_id,
            item: o.item_numero,
            cliente: o.cliente,
            vendedor: o.vendedor,
            codigo_producto: o.codigo_producto,
            descripcion: o.descripcion,
            ancho: o.ancho, alto: o.alto,
            familia_id: o.familia_id, espesor_mm: o.espesor_mm,
            tipo_venta: o.tipo_venta, nota: o.nota, posicion: o.posicion,
            orden_compra: o.orden_compra, tipo_entrega: o.tipo_entrega,
            codigo_padre: o.codigo_padre, bom_padre_id: o.bom_padre_id,
            es_compuesto: o.es_compuesto,
            item_numero: o.item_numero,
            prioridad: Number(o.nivel_prioridad) || 1,
            fecha_pactada: o.fecha_entrega_pactada ? fmtL(new Date(o.fecha_entrega_pactada)) : null,
            fecha_ingreso: fmtL(new Date(o.created_at)),
            m2_orden: Number(o.metros_cuadrados) || 0,
            kilos_orden: Number(o.kilos) || 0,
            cantidad: Number(o.cantidad) || 1,
            grupo,
            pasos
        });
    }

    // Atrasados primero: fecha pactada vencida o ventana rígida ya vencida.
    // (Se evalúa DESPUÉS de calcular ventana/fecha_limite en cada orden.)
    const esAtrasada = (o) =>
        !!(o.fecha_pactada && o.fecha_pactada <= hoyCL) || o.ventanaVencida === true;

    // Ventana rígida: fecha límite = ingreso + N días hábiles.
    for (const o of ordenes.values()) {
        const v = VENTANA_DIAS[o.prioridad];
        o.ventana = v || null;
        o.fecha_limite = null;
        if (v && o.fecha_ingreso) {
            let lim = o.fecha_ingreso;
            for (let i = 0; i < v; i++) lim = await calendario.siguienteDiaHabil(lim);
            o.fecha_limite = lim;
            // Si la ventana ya venció, no se puede cumplir nunca: se agenda lo
            // antes posible y se marca VENCIDA (no se bloquea, no se pierde).
            o.ventanaVencida = lim < hoyCL;
            // Ventana todavía alcanzable → es RESTRICCIÓN: buscar solo hasta lim.
            o.restriccion = !o.ventanaVencida;
        } else {
            o.ventanaVencida = false;
            o.restriccion = false;
        }
        o.listo = true;
        o.tieneCuello = o.pasos.some(p => {
            const e = estMap[p.estacion_id];
            return e && e.esCuello && !esHecho(p.estado);
        });
    }

    const cola = [...ordenes.values()].filter(o => o.pasos.some(p => !esHecho(p.estado)));
    cola.sort((a, b) => {
        const atA = esAtrasada(a) ? 0 : 1;
        const atB = esAtrasada(b) ? 0 : 1;
        return (atA - atB)
            || ((RANGO_PRIO[a.prioridad] ?? 3) - (RANGO_PRIO[b.prioridad] ?? 3))
            || ((a.listo ? 0 : 1) - (b.listo ? 0 : 1))
            || ((a.tieneCuello ? 0 : 1) - (b.tieneCuello ? 0 : 1))
            || String(a.fecha_pactada || '9999').localeCompare(String(b.fecha_pactada || '9999'));
    });

    // ═══ 13. PROGRAMAR ════════════════════════════════════════════════════
    const updatesPasos = [];
    const updatesOrdenes = [];
    const alertas = [];
    const noAsignados = [];
    const splits = [];
    let pasosFechados = 0;
    let pasosEnCurso = 0;
    let primeraFechaGlobal = null;

    // Turno inicial: el TURNO 1 (noche) del primer día productivo. Con recorte
    // de hoy se arranca por el primer turno de hoy que quedó con capacidad.
    const slotInicial = async () => {
        if (desde === hoyCL && pctRestanteHoy) {
            const t = pctRestanteHoy.noche > 0 ? 'noche' : (pctRestanteHoy.dia > 0 ? 'dia' : 'noche');
            return { fecha: desde, turno: t };
        }
        return { fecha: desde, turno: 'noche' };
    };

    /**
     * Programa la ruta pendiente de una orden.
     * @param {Object} o      orden
     * @param {Object|null} anchor  { estId, slot } para hermanos BOM: fija el
     *        día de Armado y las estaciones previas/posteriores se encadenan.
     * @returns {Object|null} { estFechas, fechaPrimera, fechaUltima } o null si
     *          no cabe (bloqueo de ventana o sin cupo).
     */
    const programarOrden = async (o, anchor = null) => {
        const pendientes = o.pasos.filter(p => !esHecho(p.estado));
        if (!pendientes.length) return null;

        // El kg consume capacidad del GRUPO una sola vez: en el primer paso
        // pendiente por SECUENCIA (no por dirección de programación).
        const kgPasoId = pendientes[0].paso_id;

        // Overlay: las reservas de ESTA ruta viven en memoria. Si un paso
        // posterior no cabe, se descarta todo y la agenda queda intacta.
        const ov = nuevoOverlay();
        const estFechas = {};
        let fechadosLocal = 0;      // pasos recién fechados de ESTA orden
        let enCursoLocal = 0;       // pasos anclados a HOY (EN PROCESO)

        let slot = await slotInicial();

        // Con anchor (BOM): el paso de Armado se fija en anchor.slot y las
        // estaciones previas van hacia ATRÁS, las posteriores hacia ADELANTE.
        const anchorIdx = anchor ? pendientes.findIndex(p => p.estacion_id === anchor.estId) : -1;

        for (let i = 0; i < pendientes.length; i++) {
            const p = pendientes[i];
            const kgPaso = (p.paso_id === kgPasoId) ? o.kilos_orden : 0;
            const fechaMax = o.restriccion ? o.fecha_limite : null;

            // Pasos EN PROCESO/PAUSADO quedan anclados a HOY y ocupan capacidad
            // de hoy (ya cargada arriba como 'curso'); no se mueven.
            if (p.estado === 'EN_PROCESO' || p.estado === 'PAUSADO') {
                estFechas[p.paso_id] = { fecha: hoyCL, turno: p.turno || turnoActual, m2: p.m2 };
                enCursoLocal++;
                slot = await siguienteSlot({ fecha: hoyCL, turno: p.turno || turnoActual });
                continue;
            }

            let slotPaso = null;

            if (anchor && i === anchorIdx) {
                // Paso anclado (Armado del grupo BOM): su slot ya fue validado
                // contra el total del grupo, así que se respeta tal cual.
                slotPaso = anchor.slot;
            } else if (anchor && i < anchorIdx) {
                // Antes del ancla: hacia ATRÁS desde el slot ancla, sin bajar
                // del piso de fecha (`desde`).
                let s = await anteriorSlot(anchor.slot);
                for (let k = 0; k < dias * 4; k++) {
                    if (fechaMax && s.fecha > fechaMax) break;
                    if (s.fecha < desde) break;                        // REGLA 1: piso de fecha
                    if (cabeConOverlay(p.estacion_id, o.grupo, s.fecha, s.turno, p.m2, kgPaso, ov)) { slotPaso = s; break; }
                    s = await anteriorSlot(s);
                }
            } else {
                // Cascada normal hacia adelante.
                slotPaso = await buscarSlot(p.estacion_id, o.grupo, p.m2, kgPaso, slot, fechaMax, ov);
            }

            if (!slotPaso) return null;   // no cabe → bloqueo, sin reservas

            estFechas[p.paso_id] = { fecha: slotPaso.fecha, turno: slotPaso.turno, m2: p.m2 };
            marcarOverlay(p.estacion_id, o.grupo, slotPaso.fecha, slotPaso.turno, p.m2, kgPaso, ov);
            fechadosLocal++;
            // Un paso por TURNO: el siguiente va al turno siguiente.
            slot = await siguienteSlot(slotPaso);
        }

        // Toda la ruta encajó → confirmar las reservas contra los mapas globales
        // y recién entonces contar los pasos fechados (si un paso no cabe, la
        // orden entera se descarta y estos contadores no deben avanzar).
        for (const [k, m2] of ov.m2) {
            const [fecha, turno, estId] = k.split('|');
            const gk = fecha + '|' + String(o.grupo);
            agregarCarga(Number(estId), o.grupo, fecha, turno, m2, ov.kg.get(gk) || 0);
        }
        pasosFechados += fechadosLocal;
        pasosEnCurso += enCursoLocal;
        for (const f of Object.values(estFechas)) {
            if (!primeraFechaGlobal || f.fecha < primeraFechaGlobal) primeraFechaGlobal = f.fecha;
        }

        const fechas = Object.values(estFechas).map(f => f.fecha).sort();
        if (!fechas.length) return null;
        return { estFechas, fechaPrimera: fechas[0], fechaUltima: fechas[fechas.length - 1] };
    };

    // ─── 13a. Hermanos BOM: agendar juntos ────────────────────────────────
    // Las partes de un mismo compuesto se ensamblan juntas, así que todas
    // deben llegar a Armado el mismo día. Se busca el primer día donde Armado
    // tenga cupo para el TOTAL del grupo (m² sumados, kg sumados).
    const bomGroups = {};
    for (const o of cola) {
        if (o.es_compuesto && o.bom_padre_id) (bomGroups[o.bom_padre_id] = bomGroups[o.bom_padre_id] || []).push(o);
    }
    const procesadasBom = new Set();
    for (const [, siblings] of Object.entries(bomGroups)) {
        if (siblings.length < 2) continue;
        // Estación Armado (o la última de la ruta como respaldo).
        const ruta0 = siblings[0].pasos;
        let armadoIdx = ruta0.findIndex(p => {
            const e = estMap[p.estacion_id];
            return e && e.nombre === 'Armado';
        });
        if (armadoIdx < 0) continue;   // sin Armado definido → trato normal
        const armadoEstId = ruta0[armadoIdx].estacion_id;

        const totalM2 = siblings.reduce((s, o) => s + o.m2_orden, 0);   // SUMA (antes solo el primero)
        const totalKg = siblings.reduce((s, o) => s + o.kilos_orden, 0);

        // Primer día con cupo en Armado para el total, respetando grupo por día.
        let anchorSlot = null;
        let s = await slotInicial();
        for (let k = 0; k < dias * 4; k++) {
            if (cabeSlotGlobal(armadoEstId, siblings[0].grupo, s.fecha, s.turno, totalM2, totalKg)) { anchorSlot = s; break; }
            s = await siguienteSlot(s);
        }
        if (!anchorSlot) continue;   // no cabe junto → cada hermano va normal

        for (const o of siblings) {
            const r = await programarOrden(o, { estId: armadoEstId, slot: anchorSlot });
            if (r) {
                _registrarAsignacion(o, r);
                procesadasBom.add(o.orden_id);
            }
            // Si no cabe con el ancla, NO se marca procesada: cae al bucle
            // individual (13b) donde se le da la cascada normal.
        }
    }

    // ─── 13b. Órdenes individuales (con split si no cabe) ─────────────────
    for (const o of cola) {
        if (procesadasBom.has(o.orden_id)) continue;

        let r = await programarOrden(o, null);

        if (!r && permitirSplit && o.cantidad > 1 && _sinAvance(o)) {
            // SPLIT: la estación más restrictiva no admite el pedido completo
            // en un turno. Se parte en A (lo que cabe) y B (el resto, que
            // queda PENDIENTE y se planifica en esta misma corrida).
            const split = _intentarSplit(o, estMap, cfgTurnos);
            if (split) {
                const parteA = { ...o, cantidad: split.unitsA, m2_orden: split.m2A, kilos_orden: split.kgA };
                r = await programarOrden(parteA, null);
                if (r) {
                    // La orden original queda como la parte A (pedido + 'A') y
                    // se crea la parte B como orden nueva PENDIENTE.
                    const nuevaB = await _crearParteB(o, split);
                    splits.push({ pedido: o.pedido, units_a: split.unitsA, units_b: split.unitsB });
                    if (nuevaB) cola.push(nuevaB);   // se planifica abajo
                    // La orden original pasa a ser la parte A (mismo orden_id).
                    _registrarAsignacion(parteA, r);
                    continue;
                }
            }
        }

        if (r) {
            _registrarAsignacion(o, r);
        } else {
            noAsignados.push({
                orden_id: o.orden_id,
                pedido: o.pedido,
                item: o.item,
                motivo: o.restriccion
                    ? `No cabe en su ventana rígida de ${o.ventana} días hábiles (límite ${o.fecha_limite})`
                    : `Sin capacidad en el horizonte de ${dias} días hábiles`,
                grupo: o.grupo,
                kg_total: o.kilos_orden,
                m2_total: o.m2_orden,
                ventana_dias: o.ventana || null,
                fecha_limite: o.fecha_limite || null,
                prioridad: o.prioridad
            });
            if (o.restriccion) {
                alertas.push({
                    tipo: 'ventana_bloqueada',
                    pedido: o.pedido, item: o.item, prioridad: o.prioridad,
                    prioridad_nombre: NOMBRE_PRIO[o.prioridad] || '',
                    ventana_dias: o.ventana, fecha_limite: o.fecha_limite,
                    fecha_ingreso: o.fecha_ingreso,
                    motivo: 'Sin cupo dentro de la ventana rígida — requiere decisión del planificador'
                });
            }
        }
    }

    // Registra una orden ya planificada: acumula los UPDATE de pasos y de la
    // orden (sin tocar el estado si la orden ya tenía trabajo hecho).
    function _registrarAsignacion(o, r) {
        const esAvanzada = o.pasos.some(p => esHecho(p.estado));
        const pactadaAnterior = o.fecha_pactada;
        updatesOrdenes.push([r.fechaPrimera, r.fechaUltima, o.orden_id, esAvanzada]);
        for (const [pasoId, f] of Object.entries(r.estFechas)) {
            updatesPasos.push([f.fecha, f.turno, f.m2, pasoId]);
        }
        // VENCIDA: la ventana ya venció al planificar → no se puede cumplir.
        // excede_pacto: la nueva fecha entrega es PEOR que la pactada anterior.
        const excede = !!(pactadaAnterior && r.fechaUltima > pactadaAnterior);
        const vencida = !!o.ventanaVencida;
        if (vencida || excede || (o.fecha_pactada && o.fecha_pactada <= hoyCL)) {
            alertas.push({
                pedido: o.pedido, item: o.item, prioridad: o.prioridad,
                prioridad_nombre: NOMBRE_PRIO[o.prioridad] || '',
                fecha_anterior: pactadaAnterior, fecha_nueva: r.fechaUltima,
                ventana_dias: o.ventana || null, fecha_limite: o.fecha_limite || null,
                fecha_ingreso: o.fecha_ingreso || null,
                vencida,
                fuera_de_ventana: vencida,
                excede_pacto: excede,
                motivo: vencida
                    ? `Ventana ${o.ventana} días vencida (ingreso ${o.fecha_ingreso}) — se agenda lo antes posible`
                    : (excede ? 'La nueva fecha entrega es posterior a la pactada' : '')
            });
        }
    }

    // ═══ 14. ESCRITURA ATÓMICA ════════════════════════════════════════════
    await transaction(async ({ query: tx }) => {
        for (const [fecha, turno, m2, pasoId] of updatesPasos) {
            await tx(`UPDATE cola_produccion_pasos SET fecha_programada = $1, turno = $2, m2_asignados = $3 WHERE id = $4`, [fecha, turno, m2, pasoId]);
        }
        for (const [primera, ultima, ordenId, esAvanzada] of updatesOrdenes) {
            if (esAvanzada) {
                // Sin tocar estado: la orden ya estaba EN PROGRESO de algún modo.
                await tx(`UPDATE produccion_ordenes SET fecha_programada = $1, fecha_entrega_pactada = $2 WHERE id = $3`, [primera, ultima, ordenId]);
            } else {
                await tx(`UPDATE produccion_ordenes SET fecha_programada = $1, fecha_entrega_pactada = $2, estado_programacion = 'PROGRAMADO' WHERE id = $3`, [primera, ultima, ordenId]);
            }
        }
        // Las partes B creadas por split quedan PENDIENTE sin fecha: se
        // planifican solas en la próxima corrida o al terminar esta.
        await tx(`UPDATE produccion_ordenes SET needs_reprogramming = FALSE WHERE needs_reprogramming = TRUE`);
    });

    const total = cola.length;
    const mensaje = modo === 'todo'
        ? `Se liberaron ${ordenesLiberadas} órdenes y se re-planificó el plan completo: ${updatesOrdenes.length} de ${total} órdenes con fecha`
        : `Se asignaron ${updatesOrdenes.length} de ${total} órdenes pendientes sin tocar el plan existente`;

    return {
        modo,
        ordenes_liberadas: ordenesLiberadas,
        ordenes_reprogramadas: updatesOrdenes.length,
        pasos_fechados: pasosFechados,
        pasos_en_curso_respetados: pasosEnCurso,
        rutas_actualizadas: rutasActualizadas,
        avance_implicito: avanceCerrado,
        splits,
        alertas,
        noAsignados,
        primera_fecha: primeraFechaGlobal,
        total_procesados: total,
        mensaje: mensaje
            + (rutasActualizadas ? ` · ${rutasActualizadas} rutas sincronizadas` : '')
            + (avanceCerrado ? ` · ${avanceCerrado} pasos cerrados por avance implícito` : '')
            + (splits.length ? ` · ${splits.length} pedidos divididos` : '')
            + (noAsignados.length ? ` · ${noAsignados.length} sin cupo` : '')
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS PRIVADOS
// ═══════════════════════════════════════════════════════════════════════════

/** ¿La orden no tiene ningún paso trabajado? (condición para poder dividirla) */
function _sinAvance(o) {
    return !o.pasos.some(p => esHecho(p.estado));
}

/**
 * ¿Cuántas unidades caben en un turno de la estación más restrictiva de la
 * ruta? Devuelve { unitsA, unitsB, m2A, kgA } o null si no conviene partir.
 */
function _intentarSplit(o, estMap, cfgTurnos) {
    const m2PorUnidad = o.cantidad > 0 ? (o.m2_orden / o.cantidad) : o.m2_orden;
    if (!(m2PorUnidad > 0)) return null;
    // Capacidad máxima de un turno entre todas las estaciones de la ruta
    // (se usa la MAYOR para partir en el punto que más espacio da).
    let capMaxTurno = 0;
    for (const p of o.pasos) {
        const e = estMap[p.estacion_id];
        if (!e || e.cap <= 0) continue;   // sin tope → no limita
        const c = Math.max(
            configTurnos.capacidadTurno(e.cap, 'dia', cfgTurnos),
            configTurnos.capacidadTurno(e.cap, 'noche', cfgTurnos)
        );
        if (c > capMaxTurno) capMaxTurno = c;
    }
    if (capMaxTurno <= 0) return null;   // sin cuello definido → no partir
    const unitsA = Math.floor(capMaxTurno / m2PorUnidad);
    if (unitsA < 1 || unitsA >= o.cantidad) return null;   // no hace falta partir
    const unitsB = o.cantidad - unitsA;
    const kgPorUnidad = o.cantidad > 0 ? (o.kilos_orden / o.cantidad) : 0;
    return { unitsA, unitsB, m2A: m2PorUnidad * unitsA, kgA: kgPorUnidad * unitsA };
}

/** Crea la parte B de un split como orden nueva PENDIENTE sin fecha. */
async function _crearParteB(o, split) {
    const m2PorUnidad = o.cantidad > 0 ? (o.m2_orden / o.cantidad) : 0;
    const kgPorUnidad = o.cantidad > 0 ? (o.kilos_orden / o.cantidad) : 0;
    const letraA = String.fromCharCode(65 + 0);   // 'A'
    const letraB = String.fromCharCode(65 + 1);   // 'B'
    const base = String(o.pedido || '').replace(/[AB]$/, '');   // evita 112311AB
    try {
        const nuevaRes = await query(
            `INSERT INTO produccion_ordenes (pedido_sap_id, cliente, vendedor, codigo_producto, descripcion,
                ancho, alto, familia_id, espesor_mm, tipo_venta, item_numero, nota, posicion, orden_compra,
                tipo_entrega, grupo, codigo_padre, bom_padre_id, es_compuesto, cantidad, kilos,
                metros_cuadrados, estado_programacion, fecha_programada, created_at, nivel_prioridad)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
                'PENDIENTE',NULL,NOW(),$23) RETURNING *`,
            [base + letraB, o.cliente, o.vendedor || null, o.codigo_producto, o.descripcion,
             o.ancho, o.alto, o.familia_id, o.espesor_mm, o.tipo_venta, o.item_numero, o.nota,
             o.posicion, o.orden_compra, o.tipo_entrega, o.grupo, o.codigo_padre, o.bom_padre_id,
             o.es_compuesto, split.unitsB, kgPorUnidad * split.unitsB, m2PorUnidad * split.unitsB,
             o.prioridad]
        );
        const nueva = nuevaRes.rows[0];
        // Copiar la ruta. Se guarda el ID de cada paso nuevo: si la parte B se
        // planifica en ESTA misma corrida, el UPDATE de fechas usa esos IDs
        // (con NULL nunca escribiría nada).
        const pasosRes = await query('SELECT estacion_id, orden_secuencia FROM cola_produccion_pasos WHERE orden_produccion_id = $1', [o.orden_id]);
        const pasosNuevos = [];
        for (const p of pasosRes.rows) {
            const ins = await query(
                `INSERT INTO cola_produccion_pasos (orden_produccion_id, estacion_id, orden_secuencia, estado)
                 VALUES ($1,$2,$3,'PENDIENTE') RETURNING id`,
                [nueva.id, p.estacion_id, p.orden_secuencia]);
            pasosNuevos.push({
                paso_id: ins.rows[0].id,
                estacion_id: p.estacion_id,
                estado: 'PENDIENTE',
                m2: m2PorUnidad * split.unitsB,
                fecha_paso: null, turno: null
            });
        }
        // La orden original queda como la parte A.
        await query(`UPDATE produccion_ordenes SET pedido_sap_id = $1, cantidad = $2, kilos = $3, metros_cuadrados = $4 WHERE id = $5`,
            [base + letraA, split.unitsA, split.kgA, split.m2A, o.orden_id]);

        const grupo = nueva.grupo || o.grupo;
        return {
            orden_id: nueva.id, pedido: nueva.pedido_sap_id, item: nueva.item_numero,
            cliente: nueva.cliente, vendedor: nueva.vendedor,
            codigo_producto: nueva.codigo_producto, descripcion: nueva.descripcion,
            ancho: nueva.ancho, alto: nueva.alto, familia_id: nueva.familia_id,
            espesor_mm: nueva.espesor_mm, tipo_venta: nueva.tipo_venta, nota: nueva.nota,
            posicion: nueva.posicion, orden_compra: nueva.orden_compra,
            tipo_entrega: nueva.tipo_entrega, codigo_padre: nueva.codigo_padre,
            bom_padre_id: nueva.bom_padre_id, es_compuesto: nueva.es_compuesto,
            prioridad: Number(nueva.nivel_prioridad) || 1,
            fecha_pactada: null,
            fecha_ingreso: fmtL(new Date(nueva.created_at)),
            m2_orden: Number(nueva.metros_cuadrados) || 0,
            kilos_orden: Number(nueva.kilos) || 0,
            cantidad: Number(nueva.cantidad) || 1,
            grupo,
            ventana: null, fecha_limite: null, ventanaVencida: false, restriccion: false,
            listo: true, tieneCuello: false,
            pasos: pasosNuevos
        };
    } catch (e) {
        console.error('[PLAN] Error creando parte B del split:', e.message);
        return null;
    }
}

/** Sincroniza rutas con la receta actual (solo órdenes sin trabajar). */
async function _sincronizarRutas() {
    const recMap = {};
    for (const tabla of ['recetas_bom', 'produccion_recetas_bom']) {
        try {
            const rr = await query(`SELECT codigo_sap_padre, procesos_especificos_json FROM ${tabla} WHERE procesos_especificos_json IS NOT NULL`);
            for (const r of rr.rows) {
                const k = String(r.codigo_sap_padre || '').trim().toLowerCase();
                if (k && !recMap[k]) recMap[k] = r.procesos_especificos_json;
            }
        } catch (_) { }
    }
    const candRes = await query(`
        SELECT o.id, COALESCE(o.codigo_padre, o.codigo_producto) as codigo
        FROM produccion_ordenes o
        WHERE o.estado_programacion NOT IN ('EN_PROCESO','TERMINADO','MERMADO','CERRADO')`);
    let rutas = 0;
    for (const o of candRes.rows) {
        const ruta = recMap[String(o.codigo || '').trim().toLowerCase()];
        if (!Array.isArray(ruta) || !ruta.length) continue;
        const ids = ruta.map(x => Number(typeof x === 'object' ? (x.estacion_id || x.id) : x)).filter(Boolean);
        if (!ids.length) continue;
        const act = await query('SELECT estacion_id, estado, hora_inicio, hora_fin FROM cola_produccion_pasos WHERE orden_produccion_id = $1 ORDER BY orden_secuencia', [o.id]);
        if (act.rows.some(p => p.estado !== 'PENDIENTE' || p.hora_inicio || p.hora_fin)) continue;
        const actuales = act.rows.map(p => Number(p.estacion_id));
        if (ids.every(id => actuales.includes(id))) continue;   // ya contemplada
        await query(`DELETE FROM cola_produccion_pasos WHERE orden_produccion_id = $1 AND estado = 'PENDIENTE' AND hora_inicio IS NULL AND hora_fin IS NULL`, [o.id]);
        for (let i = 0; i < ids.length; i++) {
            await query(`INSERT INTO cola_produccion_pasos (orden_produccion_id, estacion_id, orden_secuencia, estado) VALUES ($1,$2,$3,'PENDIENTE')`, [o.id, ids[i], i + 1]);
        }
        rutas++;
    }
    return rutas;
}

// ═══════════════════════════════════════════════════════════════════════════
// KPI DE CUMPLIMIENTO (se mantiene: lo usa taller.js)
// % de órdenes RÍGIDAS (Reposición/Express/Urgencia) terminadas dentro de su
// ventana (ingreso + 2/3 días hábiles). Normal no tiene ventana.
// ═══════════════════════════════════════════════════════════════════════════
async function getCumplimiento() {
    try {
        const res = await query(`
            SELECT o.id, o.nivel_prioridad, o.created_at, MAX(p.hora_fin)::date as termino
            FROM produccion_ordenes o
            JOIN cola_produccion_pasos p ON p.orden_produccion_id = o.id
            WHERE o.estado_programacion = 'TERMINADO'
              AND o.nivel_prioridad IN (2, 3, 4)
            GROUP BY o.id, o.nivel_prioridad, o.created_at
            HAVING MAX(p.hora_fin) >= NOW() - INTERVAL '30 days'
        `);
        const fFecha = (v) => v ? (typeof v === 'string' ? String(v).split('T')[0]
            : new Date(v).getFullYear() + '-' + String(new Date(v).getMonth() + 1).padStart(2, '0') + '-' + String(new Date(v).getDate()).padStart(2, '0')) : null;
        let cumplidas = 0;
        for (const r of res.rows) {
            const ventana = VENTANA_DIAS[Number(r.nivel_prioridad)] || 0;
            const ingreso = fFecha(r.created_at);
            const termino = fFecha(r.termino);
            if (!ventana || !ingreso || !termino) continue;
            let limite = ingreso;
            for (let i = 0; i < ventana; i++) limite = await calendario.siguienteDiaHabil(limite);
            if (termino <= limite) cumplidas++;
        }
        const total = res.rows.length;
        return { pct: total > 0 ? Math.round((cumplidas / total) * 100) : 100, cumplidas, total };
    } catch (_) {
        return { pct: null, cumplidas: 0, total: 0 };
    }
}

module.exports = { planificar, getCumplimiento };
