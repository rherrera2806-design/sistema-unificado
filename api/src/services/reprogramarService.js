const { query } = require('../config/database');
const { transaction } = require('../config/dbPool');
const { autoAsignarPendientes } = require('./planificacionAuto');

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  REPROGRAMAR PENDIENTES — Wipe & Re-run                       ║
 * ║  Paso A: Liberar órdenes PROGRAMADO → PENDIENTE (solo las que  ║
 * ║          NO están en proceso/terminadas/mermadas)              ║
 * ║  Paso B: Re-ejecutar auto-asignar con Priority Queue 4→1      ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * REGLA DE ORO: NUNCA tocar órdenes con estado EN PROCESO, MERMADO o TERMINADO.
 * Solo se liberan las que están PROGRAMADO (asignadas a fecha pero aún no iniciadas).
 */
async function reprogramarPendientes({ dias = 21, inicio } = {}) {
    // Fecha mínima en hora local (toISOString usa UTC y a la noche cambiaba el día)
    const calendario = require('./calendario');
    // Fecha mínima en hora local. REGLA: reprogramar NUNCA parte de HOY
    // ("hoy no alcanza"): sin fecha explícita, empieza el día siguiente hábil.
    // El planificador puede fijar otra fecha con el selector "Desde".
    const fechaMinima = inicio || await calendario.siguienteDiaHabil((() => {
        const h = new Date();
        return h.getFullYear() + '-' + String(h.getMonth() + 1).padStart(2, '0') + '-' + String(h.getDate()).padStart(2, '0');
    })());

    // ═══════════════════════════════════════════════════════════════
    // PASO A: LIBERACIÓN — Soltar TODO lo programable → PENDIENTE
    // ═══════════════════════════════════════════════════════════════
    // Se suelta TODO excepto EN PROCESO, MERMADO, TERMINADO y CERRADO
    // (antes solo se soltaban las PROGRAMADO y se escapaban órdenes con fecha
    // asignada en otro estado: quedaban sin re-ordenar por prioridad).
    // NOTA: NO se toca fecha_entrega_pactada; es una fecha pactada (puede haberse
    // cargado a mano) y no depende de la programación diaria. Antes se ponía en
    // NULL para todas las órdenes PROGRAMADO y se perdían pactos manuales.
    const liberar = await query(`
        UPDATE produccion_ordenes
        SET estado_programacion = 'PENDIENTE',
            fecha_programada = NULL
        WHERE estado_programacion NOT IN ('EN_PROCESO', 'TERMINADO', 'MERMADO', 'CERRADO')
          AND (estado_programacion = 'PROGRAMADO' OR fecha_programada IS NOT NULL)
        RETURNING id
    `);
    const ordenesLiberadas = liberar.rowCount;
    const idsLiberadas = liberar.rows.map(r => r.id);

    // REGLA: los días laborales se definen en Configuración → Calendario
    // (mes a mes); NO solo saltar sáb/dom. Ver services/calendario.js
    const sigHabil = (f) => calendario.siguienteDiaHabil(f);

    // ═══════════════════════════════════════════════════════════════
    // PASO A2: SINCRONIZAR RUTAS CON LA RECETA ACTUAL
    // ═══════════════════════════════════════════════════════════════
    // Si cambió la receta de un código (sus estaciones de paso), las órdenes
    // sin trabajar se quedaban con la ruta vieja. Se regeneran sus pasos desde
    // procesos_especificos_json SOLO cuando la receta define estaciones que la
    // ruta actual NO tiene; si la ruta actual ya las incluye (pasos agregados a
    // mano), se respeta. Nunca se tocan órdenes con pasos ya trabajados.
    let rutasActualizadas = 0;
    try {
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
        for (const o of candRes.rows) {
            const ruta = recMap[String(o.codigo || '').trim().toLowerCase()];
            if (!Array.isArray(ruta) || !ruta.length) continue;
            const ids = ruta.map(x => Number(typeof x === 'object' ? (x.estacion_id || x.id) : x)).filter(Boolean);
            if (!ids.length) continue;
            const act = await query('SELECT estacion_id, estado, hora_inicio, hora_fin FROM cola_produccion_pasos WHERE orden_produccion_id = $1 ORDER BY orden_secuencia', [o.id]);
            if (act.rows.some(p => p.estado !== 'PENDIENTE' || p.hora_inicio || p.hora_fin)) continue;
            const actuales = act.rows.map(p => Number(p.estacion_id));
            if (ids.every(id => actuales.includes(id))) continue; // la receta ya está contemplada
            await query(`DELETE FROM cola_produccion_pasos WHERE orden_produccion_id = $1 AND estado = 'PENDIENTE' AND hora_inicio IS NULL AND hora_fin IS NULL`, [o.id]);
            for (let i = 0; i < ids.length; i++) {
                await query(`INSERT INTO cola_produccion_pasos (orden_produccion_id, estacion_id, orden_secuencia, estado) VALUES ($1,$2,$3,'PENDIENTE')`, [o.id, ids[i], i + 1]);
            }
            rutasActualizadas++;
        }
    } catch (_) { }

    // Limpiar las fechas SOLO en los pasos de las órdenes recién liberadas (antes
    // se limpiaban pasos de cualquier orden PENDIENTE con fecha_programada NULL en
    // la orden, incluidas órdenes ajenas a esta reprogramación). Se conserva lo ya
    // trabajado: no se tocan pasos con horas reales ni con estado avanzado.
    if (idsLiberadas.length > 0) {
        await query(`
            UPDATE cola_produccion_pasos
            SET fecha_programada = NULL, m2_asignados = 0
            WHERE orden_produccion_id = ANY($1)
              AND estado = 'PENDIENTE'
              AND hora_inicio IS NULL AND hora_fin IS NULL
        `, [idsLiberadas]);
    }

    // ═══════════════════════════════════════════════════════════════
    // PASO B: RE-ASIGNACIÓN — Ejecutar auto-asignar con Priority Queue
    // ═══════════════════════════════════════════════════════════════
    const resultado = await autoAsignarPendientes({ dias, inicio: fechaMinima });

    // ═══════════════════════════════════════════════════════════════
    // PASO C: PASOS PENDIENTES SIN FECHA (agregados a mano, o de órdenes
    // protegidas como EN PROCESO) → fecha en cascada, al menos un día hábil
    // después del último paso ya programado de la misma orden.
    // ═══════════════════════════════════════════════════════════════
    let pasosFechados = 0;
    const baseMap = {};
    try {
        const baseRes = await query(`
            SELECT orden_produccion_id, to_char(MAX(fecha_programada), 'YYYY-MM-DD') as ultima
            FROM cola_produccion_pasos WHERE fecha_programada IS NOT NULL
            GROUP BY orden_produccion_id`);
        for (const r of baseRes.rows) baseMap[r.orden_produccion_id] = r.ultima;
        const sinFecha = await query(`
            SELECT p.id, p.orden_produccion_id
            FROM cola_produccion_pasos p
            JOIN produccion_ordenes o ON o.id = p.orden_produccion_id
            WHERE p.estado = 'PENDIENTE' AND p.fecha_programada IS NULL
              AND p.hora_inicio IS NULL AND p.hora_fin IS NULL
              AND o.estado_programacion NOT IN ('TERMINADO','MERMADO','CERRADO')
            ORDER BY p.orden_produccion_id, p.orden_secuencia`);
        for (const p of sinFecha.rows) {
            const ultima = baseMap[p.orden_produccion_id];
            const base = (ultima && ultima >= fechaMinima) ? ultima : fechaMinima;
            const fs = await sigHabil(base);
            await query('UPDATE cola_produccion_pasos SET fecha_programada = $1 WHERE id = $2', [fs, p.id]);
            baseMap[p.orden_produccion_id] = fs;
            pasosFechados++;
        }
    } catch (_) { }

    // Limpiar flag de necesidad de reprogramación
    await query('UPDATE produccion_ordenes SET needs_reprogramming = FALSE WHERE needs_reprogramming = TRUE');

    return {
        ordenes_liberadas: ordenesLiberadas,
        rutas_actualizadas: rutasActualizadas,
        pasos_fechados: pasosFechados,
        asignados: resultado.asignados,
        noAsignados: resultado.noAsignados,
        total_procesados: resultado.total_procesados,
        mensaje: `Se liberaron ${ordenesLiberadas} órdenes, se actualizaron ${rutasActualizadas} rutas desde la receta, se fecharon ${pasosFechados} pasos sueltos y se re-asignaron ${resultado.asignados.length} de ${resultado.total_procesados} pendientes`
    };
}

// KPI DE CUMPLIMIENTO: % de órdenes RÍGIDAS (Reposición/Express/Urgencia)
// terminadas dentro de su ventana (ingreso + 2/3 días hábiles). Normal no
// tiene ventana y no entra al cálculo. Ventana: últimos 30 días.
async function getCumplimiento() {
    try {
        const { siguienteDiaHabil } = require('./calendario');
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
            const ventana = ({ 4: 2, 2: 3, 3: 3 })[Number(r.nivel_prioridad)] || 0;
            const ingreso = fFecha(r.created_at);
            const termino = fFecha(r.termino);
            if (!ventana || !ingreso || !termino) continue;
            let limite = ingreso;
            for (let i = 0; i < ventana; i++) limite = await siguienteDiaHabil(limite);
            if (termino <= limite) cumplidas++;
        }
        const total = res.rows.length;
        return { pct: total > 0 ? Math.round((cumplidas / total) * 100) : 100, cumplidas, total };
    } catch (_) {
        return { pct: null, cumplidas: 0, total: 0 };
    }
}

module.exports = { reprogramarPendientes, reprogramarPorAvance };

/**
 * ============================ REPROGRAMACIÓN POR AVANCE ============================
 * Reprograma lo PENDIENTE respetando el avance real del piso. Reglas del
 * negocio confirmadas:
 *
 * 1. COLA: primero los ATRASADOS (fecha pactada ≤ hoy y no terminada) y
 *    después lo NUEVO; DENTRO de cada grupo: Reposición(4) → Express(2) →
 *    Urgencia(3) → Normal(1). Empate: fecha pactada más antigua primero.
 * 2. Solo se re-fechan los pasos PENDIENTE. Los TERMINADO/MERMADO son
 *    historia (el corte ya se hizo, su fecha no se mueve). El paso EN
 *    PROCESO/PAUSADO se mantiene HOY y OCUPA capacidad de hoy.
 * 3. SIN SPLITS: no se fragmentan órdenes ya avanzadas.
 * 4. fecha_entrega_pactada = fecha del último paso restante (la nueva fecha
 *    para el cliente) y se avisa si EXCEDE el compromiso anterior.
 * 5. FECHAS: cascada de 1 día hábil por paso (Configuración → Calendario)
 *    con BLOQUEO DURO de capacidad diaria por estación (cap_max m², sin
 *    tolerancia — misma regla que cabeEnDia del motor DBR).
 *    Cada paso se coloca en un día respetando la capacidad de SU estación:
 *    por eso no se generan cuellos nuevos (p.ej. Pulido lunes, Templado
 *    martes, sin exceder la capacidad de cada uno).
 */
async function reprogramarPorAvance({ fechaMinima } = {}) {
    const calendario = require('./calendario');
    const fmtL = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const hoy = fechaMinima || fmtL(new Date());
    // REGLA: reprogramar NUNCA fecha para hoy ("hoy no alcanza" — el día ya
    // está en curso): por defecto lo pendiente parte del SIGUIENTE día hábil.
    // El planificador puede elegir otra fecha de inicio (selector "Desde").
    const desde = fechaMinima || await calendario.siguienteDiaHabil(hoy);

    // 1) Todo el avance real: pasos de órdenes NO terminadas
    const res = await query(`
        SELECT o.id as orden_id, o.pedido_sap_id, o.item_numero, o.nivel_prioridad,
               o.fecha_entrega_pactada, o.espesor_mm, o.created_at,
               o.metros_cuadrados, o.cantidad, o.estado_programacion,
               COALESCE(NULLIF(o.grupo, ''), '(sin grupo)') as grupo,
               COALESCE(o.kilos, 0) as kilos,
               p.id as paso_id, p.estacion_id, p.orden_secuencia, p.estado,
               p.m2_asignados, p.fecha_programada as fecha_paso, p.turno, em.cap_max
        FROM cola_produccion_pasos p
        JOIN produccion_ordenes o ON p.orden_produccion_id = o.id
        LEFT JOIN estaciones_maestras em ON em.id = p.estacion_id
        WHERE o.estado_programacion NOT IN ('TERMINADO', 'CERRADO')
        ORDER BY o.id, p.orden_secuencia
    `);

    // 2) Agrupar por orden con su cadena de pasos
    const ordenes = new Map();
    const fFecha = (v) => v ? (typeof v === 'string' ? String(v).split('T')[0] : fmtL(new Date(v))) : null;
    for (const r of res.rows) {
        if (!ordenes.has(r.orden_id)) {
            ordenes.set(r.orden_id, {
                orden_id: r.orden_id,
                pedido: r.pedido_sap_id,
                item: r.item_numero,
                prioridad: Number(r.nivel_prioridad) || 1,
                fecha_pactada: fFecha(r.fecha_entrega_pactada),
                // REGLA DE NEGOCIO: lo único RÍGIDO son las ventanas por
                // prioridad, en DÍAS HÁBILES desde el INGRESO del pedido:
                //   Reposición(4) = 2 días · Express(2) = 3 días (el cliente
                //   paga por eso, va primero) · Urgencia(3) = 3 días ·
                //   Normal(1) = sin ventana (lo que deje la capacidad)
                fecha_ingreso: fFecha(r.created_at),
                ventana: ({ 4: 2, 2: 3, 3: 3 })[Number(r.nivel_prioridad) || 1] || null,
                // espesor viene de la RECETA (backfill lo llena en la orden);
                // nPasos = estaciones por las que pasa (se cuentan de los pasos)
                espesor: Number(r.espesor_mm) || 0,
                m2_orden: Number(r.metros_cuadrados) || 0,
                avance: 0,
                nPasos: 0,
                pasos: []
            });
        }
        const o = ordenes.get(r.orden_id);
        o.nPasos++;
        const m2p = Number(r.m2_asignados) > 0 ? Number(r.m2_asignados) : (Number(r.metros_cuadrados) || 0);
        const m2o = Number(r.metros_cuadrados) || 0;
        // kg_paso (fórmula estándar) = lo que consume capacidad del GRUPO
        const kgp = m2o > 0 ? Number(r.kilos || 0) * m2p / m2o : Number(r.kilos || 0);
        o.pasos.push({
            paso_id: r.paso_id,
            estacion_id: r.estacion_id,
            estado: r.estado,
            m2: m2p,
            kg: kgp,
            grupo: r.grupo || '(sin grupo)',
            cap: Number(r.cap_max) || 0
        });
        if (r.estado === 'TERMINADO' || r.estado === 'MERMADO') o.avance++;
    }

    // 3) COLA (jerarquía): primero ATRASADOS, luego prioridad 4→2→3→1, luego
    // LO LISTO para entrar a la estación antes que lo bloqueado (lo que ya
    // tiene proceso avanzado está disponible para pasar), y por último la
    // fecha pactada más antigua
    const rangoPrio = { 4: 0, 2: 1, 3: 2, 1: 3 };
    const esHecho = (estado) => estado === 'TERMINADO' || estado === 'MERMADO';
    const cola = [...ordenes.values()].filter(o =>
        o.pasos.some(p => !esHecho(p.estado)));
    for (const o of cola) {
        const idx = o.pasos.findIndex(p => !esHecho(p.estado));
        const prev = idx > 0 ? o.pasos[idx - 1] : null;
        o.listo = !prev || esHecho(prev.estado);
    }
    cola.sort((a, b) => {
        const atA = (a.fecha_pactada && a.fecha_pactada <= hoy) ? 0 : 1;
        const atB = (b.fecha_pactada && b.fecha_pactada <= hoy) ? 0 : 1;
        return (atA - atB)
            || ((rangoPrio[a.prioridad] ?? 3) - (rangoPrio[b.prioridad] ?? 3))
            || ((a.listo ? 0 : 1) - (b.listo ? 0 : 1))
            // SPT: las rutas CORTAS primero (un pedido de 2 procesos se libera
            // antes que uno de 5) — minimiza el tiempo promedio de entrega
            || ((a.nPasos || 0) - (b.nPasos || 0))
            // MISMO ESPESOR juntos = menos cambios de receta/herramienta
            || ((a.espesor || 0) - (b.espesor || 0))
            || String(a.fecha_pactada || '9999').localeCompare(String(b.fecha_pactada || '9999'));
    });

    // 4) CAPACIDAD POR TURNO: un día tiene 2 turnos (día y noche) y la
    // capacidad diaria de la estación se reparte entre ellos según
    // Configuración → Turnos (p.ej. 60/40 o 50/50). BLOQUEO DURO como cabeEnDia.
    const configTurnos = require('./configTurnos');
    const cfgTurnos = await configTurnos.getConfigTurnos();
    const carga = new Map();      // 'fecha|turno|estId' -> m²
    const caps = new Map();       // estId -> cap_max (m²/día)
    const cargaGrupo = new Map(); // 'fecha|turno|grupo' -> kg
    // Capacidad por GRUPO (kg/día) = la línea roja de los gráficos
    const capGruposRes = await query('SELECT grupo, capacidad_kg_dia FROM produccion_capacidad_grupo WHERE activo = TRUE');
    const capsGrupo = new Map();  // grupo -> kg/día
    for (const g of capGruposRes.rows) capsGrupo.set(String(g.grupo || ''), Number(g.capacidad_kg_dia) || 0);
    const agregarCarga = (estId, grupo, fecha, turno, m2, kg) => {
        const k = fecha + '|' + turno + '|' + estId;
        carga.set(k, (carga.get(k) || 0) + m2);
        if (grupo) {
            const gk = fecha + '|' + turno + '|' + grupo;
            cargaGrupo.set(gk, (cargaGrupo.get(gk) || 0) + (Number(kg) || 0));
        }
    };
    // BLOQUEO DURO doble: estación (m²) Y grupo (kg) — sin tolerancia
    const cabeEnTurno = (estId, grupo, fecha, turno, m2, kg) => {
        const capDia = caps.get(estId) || 0;
        if (capDia > 0) {
            const capTurno = configTurnos.capacidadTurno(capDia, turno, cfgTurnos);
            if (((carga.get(fecha + '|' + turno + '|' + estId) || 0) + m2) > capTurno) return false;
        }
        const capG = grupo ? (capsGrupo.get(String(grupo)) || 0) : 0;
        if (capG > 0) {
            const capGTurno = configTurnos.capacidadTurno(capG, turno, cfgTurnos);
            if (((cargaGrupo.get(fecha + '|' + turno + '|' + grupo) || 0) + (Number(kg) || 0)) > capGTurno) return false;
        }
        return true;
    };
    const turnoActual = (() => {
        const h = new Date().getHours();
        return (h >= 6 && h < 22) ? 'dia' : 'noche';
    })();
    // La cascada avanza de TURNO en TURNO: 🌞 → 🌙 → (día hábil siguiente) 🌞
    const siguienteSlot = async (slot) => slot.turno === 'dia'
        ? { fecha: slot.fecha, turno: 'noche' }
        : { fecha: await calendario.siguienteDiaHabil(slot.fecha), turno: 'dia' };
    for (const o of cola) {
        for (const p of o.pasos) {
            if (p.cap > 0) caps.set(p.estacion_id, p.cap);
            if (p.estado === 'EN_PROCESO' || p.estado === 'PAUSADO') {
                agregarCarga(p.estacion_id, p.grupo, hoy, p.turno || turnoActual, p.m2, p.kg);
            }
        }
    }
    const buscarSlot = async (paso, desdeSlot) => {
        let slot = desdeSlot;
        for (let i = 0; i < 600; i++) {
            if (cabeEnTurno(paso.estacion_id, paso.grupo, slot.fecha, slot.turno, paso.m2, paso.kg)) return slot;
            slot = await siguienteSlot(slot);
        }
        return slot;
    };

    // 5) Programar cada orden por su SUB-RUTA pendiente, TURNOS en cascada:
    //    Pulido 🌞 lunes → Templado 🌙 lunes → siguiente paso 🌞 martes
    const updatesPasos = [];
    const updatesOrdenes = [];
    const alertas = [];
    let pasosFechados = 0;
    let pasosEnCurso = 0;

    for (const o of cola) {
        let slot = { fecha: desde, turno: 'dia' };
        let primeraFecha = null;
        let ultimaFecha = null;

        for (const p of o.pasos) {
            if (esHecho(p.estado)) continue;   // historia
            let slotPaso;
            if (p.estado === 'EN_PROCESO' || p.estado === 'PAUSADO') {
                slotPaso = { fecha: hoy, turno: p.turno || turnoActual };   // decisión 2
                pasosEnCurso++;
            } else {
                slotPaso = await buscarSlot(p, slot);
                pasosFechados++;
            }
            agregarCarga(p.estacion_id, p.grupo, slotPaso.fecha, slotPaso.turno, p.m2, p.kg);
            const m2p = p.m2 > 0 ? p.m2 : (o.m2_orden || 0);
            updatesPasos.push([slotPaso.fecha, slotPaso.turno, m2p, p.paso_id]);
            if (!primeraFecha || slotPaso.fecha < primeraFecha) primeraFecha = slotPaso.fecha;
            if (!ultimaFecha || slotPaso.fecha > ultimaFecha) ultimaFecha = slotPaso.fecha;
            slot = await siguienteSlot(slotPaso);   // +1 TURNO (el turno siguiente)
        }

        if (!ultimaFecha) continue;
        // UNA sola fecha: la que calcula el sistema según la capacidad real.
        // VENTANA RÍGIDA (regla del negocio): Repo/Express/Urgencia deben caber
        // en ingreso + 2/3 DÍAS HÁBILES; Normal no tiene ventana (usa el
        // espacio que dejen los rígidos).
        let fechaLimite = null;
        if (o.ventana && o.fecha_ingreso) {
            fechaLimite = o.fecha_ingreso;
            for (let i = 0; i < o.ventana; i++) fechaLimite = await calendario.siguienteDiaHabil(fechaLimite);
        }
        const excede = !!(o.fecha_pactada && ultimaFecha > o.fecha_pactada);
        const fueraDeVentana = !!(fechaLimite && ultimaFecha > fechaLimite);
        updatesOrdenes.push([primeraFecha, ultimaFecha, o.orden_id, o.avance > 0]);
        if (fueraDeVentana || excede || (o.fecha_pactada && o.fecha_pactada <= hoy)) {
            alertas.push({
                pedido: o.pedido, item: o.item, prioridad: o.prioridad,
                fecha_anterior: o.fecha_pactada, fecha_nueva: ultimaFecha,
                ventana_dias: o.ventana || null,
                fecha_limite: fechaLimite,
                fuera_de_ventana: fueraDeVentana,
                excede_pacto: excede
            });
        }
    }

    // 6) Aplicar en BD (atómico: o todo o nada)
    await transaction(async ({ query: txQuery }) => {
        for (const [fecha, turno, m2, pasoId] of updatesPasos) {
            await txQuery(`UPDATE cola_produccion_pasos SET fecha_programada = $1, turno = $2, m2_asignados = $3 WHERE id = $4`, [fecha, turno, m2, pasoId]);
        }
        for (const [primera, ultima, ordenId, esAvanzada] of updatesOrdenes) {
            if (esAvanzada) {
                await txQuery(`UPDATE produccion_ordenes SET fecha_programada = $1, fecha_entrega_pactada = $2 WHERE id = $3`, [primera, ultima, ordenId]);
            } else {
                await txQuery(`UPDATE produccion_ordenes SET fecha_programada = $1, fecha_entrega_pactada = $2, estado_programacion = 'PROGRAMADO' WHERE id = $3`, [primera, ultima, ordenId]);
            }
        }
    });

    return {
        ordenes_reprogramadas: cola.length,
        pasos_fechados: pasosFechados,
        pasos_en_curso_respetados: pasosEnCurso,
        alertas,
        mensaje: `${cola.length} órdenes re-programadas respetando el avance (${pasosFechados} pasos fechados, ${pasosEnCurso} en curso mantenidos hoy)`
    };
}
