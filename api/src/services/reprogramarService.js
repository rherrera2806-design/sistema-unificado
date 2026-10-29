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
    // AVANCE IMPLÍCITO (previo): se cierran los pasos intactos que quedaron
    // "atrás" del avance real (si un paso posterior ya se trabajó, los anteriores
    // ocurrieron físicamente). Así el trabajo fantasma no se re-programa ni
    // consume capacidad. Ver avanceImplicito.js.
    let avanceCerrado = 0;
    try {
        const ac = await require('./avanceImplicito').cerrarPasosAtrasados({ motivo: 'reprogramación' });
        avanceCerrado = ac.cerrados;
    } catch (_) { }
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
        avance_implicito: avanceCerrado,
        mensaje: `Se liberaron ${ordenesLiberadas} órdenes, se actualizaron ${rutasActualizadas} rutas desde la receta, se fecharon ${pasosFechados} pasos sueltos y se re-asignaron ${resultado.asignados.length} de ${resultado.total_procesados} pendientes` + (avanceCerrado ? ` · ${avanceCerrado} pasos cerrados automáticamente por avance implícito` : '')
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

module.exports = { reprogramarPendientes, reprogramarPorAvance, getCumplimiento };

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
async function reprogramarPorAvance({ fechaMinima, soloSinFecha, turnosHoy } = {}) {
    const calendario = require('./calendario');
    const fmtL = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const hoy = fechaMinima || fmtL(new Date());
    // REGLA: reprogramar NUNCA fecha para hoy ("hoy no alcanza" — el día ya
    // está en curso): por defecto lo pendiente parte del SIGUIENTE día hábil.
    // El planificador puede elegir otra fecha de inicio (selector "Desde").
    let desde = fechaMinima || await calendario.siguienteDiaHabil(hoy);

    // ═══ TURNOS DE HOY (solo si el inicio es HOY) ═══════════════════════════
    // HOY NO ES DÍA COMPLETO: la capacidad del día se recorta a los turnos
    // elegidos por el planificador y proporcionalmente al tiempo que FALTA de
    // cada uno (ej: 14:00 con turno día 08:00→18:00 = 40% de ese turno).
    // Los turnos no elegidos quedan en 0% → bloqueados para hoy.
    // Si HOY ya no queda nada (ej: 18:00+, día agotado y la noche de esta
    // noche se acredita a mañana): se obliga a partir del siguiente día hábil
    // con el TURNO 1 (noche) — nunca se programa capacidad fantasma de hoy.
    // turnosHoy: ['dia'] | ['noche'] | ['dia','noche'] (undefined = auto: los
    // turnos que aún tienen tiempo restante).
    const hoyReal = fmtL(new Date());
    let pctRestanteHoy = null;   // { dia: 0..1, noche: 0..1 } | null = sin recorte
    if (desde === hoyReal) {
        const turnos = (await require('./turnosHoy').getTurnosRestantesHoy()).turnos || [];
        const elegidos = Array.isArray(turnosHoy)
            ? turnosHoy.filter(t => t === 'dia' || t === 'noche')
            : turnos.filter(t => t.pct_restante > 0).map(t => t.turno);
        pctRestanteHoy = { dia: 0, noche: 0 };
        for (const t of elegidos) {
            const info = turnos.find(x => x.turno === t);
            if (info) pctRestanteHoy[t] = Math.max(0, Math.min(1, Number(info.pct_restante) || 0));
        }
        if (pctRestanteHoy.dia <= 0 && pctRestanteHoy.noche <= 0) {
            desde = await calendario.siguienteDiaHabil(hoyReal);
            pctRestanteHoy = null;
        }
    }

    // AVANCE IMPLÍCITO (previo): los pasos intactos que quedaron "atrás" del
    // avance real se cierran solos (si Pulido avanzó, el Corte ocurrió). Sin
    // esto, el motor re-programaba "trabajo fantasma" al futuro: robaba
    // capacidad de la estación, invertía el orden real (Corte después de
    // Pulido) y distorsionaba la fecha pactada. Ver avanceImplicito.js.
    let avanceCerrado = 0;
    try {
        const ac = await require('./avanceImplicito').cerrarPasosAtrasados({ motivo: 'reprogramación por avance' });
        avanceCerrado = ac.cerrados;
    } catch (_) { }

    // ===== SINCRONIZAR RUTAS CON LA RECETA ACTUAL (antes era exclusivo del
    // "Reprogramar" tradicional; ahora lo hace también Por Avance) =====
    // Si cambió la receta de un código (sus estaciones de paso), las órdenes
    // sin trabajar se regeneran desde procesos_especificos_json. Nunca se
    // tocan órdenes con pasos ya trabajados.
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
            if (ids.every(id => actuales.includes(id))) continue;
            await query(`DELETE FROM cola_produccion_pasos WHERE orden_produccion_id = $1 AND estado = 'PENDIENTE' AND hora_inicio IS NULL AND hora_fin IS NULL`, [o.id]);
            for (let i = 0; i < ids.length; i++) {
                await query(`INSERT INTO cola_produccion_pasos (orden_produccion_id, estacion_id, orden_secuencia, estado) VALUES ($1,$2,$3,'PENDIENTE')`, [o.id, ids[i], i + 1]);
            }
            rutasActualizadas++;
        }
    } catch (_) { }

    // 1) Todo el avance real: pasos de órdenes NO terminadas
    const res = await query(`
        SELECT o.id as orden_id, o.pedido_sap_id, o.item_numero, o.nivel_prioridad,
               o.fecha_entrega_pactada, o.espesor_mm, o.created_at,
               o.fecha_programada,
               o.metros_cuadrados, o.cantidad, o.estado_programacion,
               COALESCE(NULLIF(o.grupo, ''), '(sin grupo)') as grupo,
               COALESCE(o.kilos, 0) as kilos,
               p.id as paso_id, p.estacion_id, p.orden_secuencia, p.estado,
               p.m2_asignados, p.fecha_programada as fecha_paso, p.turno, em.cap_max, em.cuello_botella
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
                fecha_programada: fFecha(r.fecha_programada),
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
                kilos_orden: Number(r.kilos) || 0,
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
            ordenKg: Number(r.kilos) || 0,
            grupo: r.grupo || '(sin grupo)',
            cap: Number(r.cap_max) || 0,
            cuello: !!r.cuello_botella
        });
        if (r.estado === 'TERMINADO' || r.estado === 'MERMADO') o.avance++;
    }

    // 3) COLA (jerarquía): primero ATRASADOS, luego prioridad 4→2→3→1, luego
    // LO LISTO para entrar a la estación antes que lo bloqueado (lo que ya
    // tiene proceso avanzado está disponible para pasar), y por último la
    // fecha pactada más antigua
    const rangoPrio = { 4: 0, 2: 1, 3: 2, 1: 3 };
    const esHecho = (estado) => estado === 'TERMINADO' || estado === 'MERMADO';
    // modo soloSinFecha (Auto-Asignar): entra SOLO lo que nunca tuvo fecha —
    // el plan ya programado NO se toca (su carga existente se respeta)
    const cola = [...ordenes.values()].filter(o =>
        o.pasos.some(p => !esHecho(p.estado))
        && (!soloSinFecha || !o.fecha_programada));
    const enCola = new Set(cola.map(o => o.orden_id));
    for (const o of cola) {
        const idx = o.pasos.findIndex(p => !esHecho(p.estado));
        const prev = idx > 0 ? o.pasos[idx - 1] : null;
        o.listo = !prev || esHecho(prev.estado);
        // PRIORIDAD TOC: lo que alimenta los CUELLOS DE BOTELLA primero — el
        // cuello nunca debe quedar sin carga (si pierde 1 hora, la planta pierde
        // 1 hora). Se marca si su ruta tiene algún paso pendiente en un cuello.
        o.tieneCuello = o.pasos.some(p => p.cuello && !esHecho(p.estado));
    }
    cola.sort((a, b) => {
        const atA = (a.fecha_pactada && a.fecha_pactada <= hoy) ? 0 : 1;
        const atB = (b.fecha_pactada && b.fecha_pactada <= hoy) ? 0 : 1;
        return (atA - atB)
            || ((rangoPrio[a.prioridad] ?? 3) - (rangoPrio[b.prioridad] ?? 3))
            || ((a.listo ? 0 : 1) - (b.listo ? 0 : 1))
            || ((a.tieneCuello ? 0 : 1) - (b.tieneCuello ? 0 : 1))
            || String(a.fecha_pactada || '9999').localeCompare(String(b.fecha_pactada || '9999'));
    });

    // 4) CAPACIDAD POR TURNO: un día tiene 2 turnos (día y noche) y la
    // capacidad diaria de la estación se reparte entre ellos según
    // Configuración → Turnos (p.ej. 60/40 o 50/50). BLOQUEO DURO como cabeEnDia.
    const configTurnos = require('./configTurnos');
    const cfgTurnos = await configTurnos.getConfigTurnos();
    const carga = new Map();      // 'fecha|turno|estId' -> m²
    const cargaPend = new Map();  // 'fecha|turno|estId' -> m² SOLO de pasos PENDIENTE
    const caps = new Map();       // estId -> cap_max (m²/día)
    const cargaGrupo = new Map(); // 'fecha|turno|grupo' -> kg
    const cargaPendGrupo = new Map(); // 'fecha|turno|grupo' -> kg SOLO pendiente
    // Capacidad por GRUPO (kg/día) = la línea roja de los gráficos
    const capGruposRes = await query('SELECT grupo, capacidad_kg_dia FROM produccion_capacidad_grupo WHERE activo = TRUE');
    const capsGrupo = new Map();  // grupo -> kg/día
    for (const g of capGruposRes.rows) capsGrupo.set(String(g.grupo || ''), Number(g.capacidad_kg_dia) || 0);
    const agregarCarga = (estId, grupo, fecha, turno, m2, kg, esPendiente = true) => {
        const k = fecha + '|' + turno + '|' + estId;
        carga.set(k, (carga.get(k) || 0) + m2);
        // cargaPend = solo pasos PENDIENTE: lo que realmente correrá dentro de
        // la VENTANA RESTANTE de hoy. Los EN PROCESO no entran (su m² ya
        // "pagó" la mañana transcurrida; descontarlos dos veces dejaba la
        // ventana vacía y todo se iba a mañana — ver cabeEnTurno).
        if (esPendiente) cargaPend.set(k, (cargaPend.get(k) || 0) + m2);
        if (grupo) {
            const gk = fecha + '|' + turno + '|' + grupo;
            cargaGrupo.set(gk, (cargaGrupo.get(gk) || 0) + (Number(kg) || 0));
            if (esPendiente) cargaPendGrupo.set(gk, (cargaPendGrupo.get(gk) || 0) + (Number(kg) || 0));
        }
    };
    // BLOQUEO DURO doble: estación (m²) Y grupo (kg) — sin tolerancia.
    // HOY con recorte (pctRestanteHoy) la regla es de DOS condiciones:
    //   1) TOPE DEL TURNO: carga total + nuevo ≤ capacidad del turno COMPLETO
    //      (lo comprometido del turno —incluido lo EN PROCESO— sigue siendo
    //      límite absoluto, igual que siempre).
    //   2) VENTANA RESTANTE: lo nuevo + lo PENDIENTE de hoy ≤ capacidad ×
    //      %tiempo restante del turno. Los turnos no elegidos quedan en 0%
    //      → nada nuevo cabe ahí (la cascada salta al turno/día que sí).
    const factorHoy = (fecha, turno) => (pctRestanteHoy && fecha === hoyReal)
        ? (pctRestanteHoy[turno] || 0) : 1;
    const cabeEnTurno = (estId, grupo, fecha, turno, m2, kg) => {
        const fh = factorHoy(fecha, turno);
        const capDia = caps.get(estId) || 0;
        if (capDia > 0) {
            const k = fecha + '|' + turno + '|' + estId;
            const capTurno = configTurnos.capacidadTurno(capDia, turno, cfgTurnos);
            if (((carga.get(k) || 0) + m2) > capTurno) return false;                    // 1) tope turno
            if (fh < 1 && ((cargaPend.get(k) || 0) + m2) > capTurno * fh) return false; // 2) ventana
        }
        const capG = grupo ? (capsGrupo.get(String(grupo)) || 0) : 0;
        if (capG > 0) {
            const gk = fecha + '|' + turno + '|' + grupo;
            const capGTurno = configTurnos.capacidadTurno(capG, turno, cfgTurnos);
            if (((cargaGrupo.get(gk) || 0) + (Number(kg) || 0)) > capGTurno) return false;
            if (fh < 1 && ((cargaPendGrupo.get(gk) || 0) + (Number(kg) || 0)) > capGTurno * fh) return false;
        }
        return true;
    };
    const turnoActual = (() => {
        const h = new Date().getHours();
        return (h >= 6 && h < 22) ? 'dia' : 'noche';
    })();
    // REGLA DE TURNOS (acreditación al día en que TERMINA): el TURNO 1 del día
    // productivo es el NOCHE —comienza el día anterior (mar noche = lun 22:00 →
    // mar 07:30; el especial del lunes comienza el dom 00:00)— y el TURNO 2 es
    // el DÍA (07:30 → 22:00). La cascada avanza en orden cronológico real:
    // 🌙 T1 → 🌞 T2 → 🌙 T1 del día hábil siguiente → 🌞 T2 → …
    const siguienteSlot = async (slot) => slot.turno === 'noche'
        ? { fecha: slot.fecha, turno: 'dia' }
        : { fecha: await calendario.siguienteDiaHabil(slot.fecha), turno: 'noche' };
    for (const o of ordenes.values()) {
        let kgHecho = false;
        for (const p of o.pasos) {
            if (p.cap > 0) caps.set(p.estacion_id, p.cap);
            const kgOrden = kgHecho ? 0 : (o.kilos_orden || p.kg || 0);
            if (enCola.has(o.orden_id)) {
                // se va a re-fecha: solo lo EN CURSO ocupa capacidad de hoy.
                // esPendiente=FALSE: su m² ya pagó la mañana transcurrida, no
                // debe descontarse dos veces de la ventana restante de hoy.
                if (p.estado === 'EN_PROCESO' || p.estado === 'PAUSADO') {
                    agregarCarga(p.estacion_id, p.grupo, hoy, p.turno || turnoActual, p.m2, kgOrden, false);
                    kgHecho = true;
                }
            } else if (!esHecho(p.estado) && p.fecha_paso) {
                // fuera de la cola (modo Auto-Asignar): su carga YA asignada
                // ocupa capacidad real en su fecha — no se puede doble-reservar.
                // Lo EN CURSO de esas órdenes tampoco entra a la ventana (ya
                // pagó su parte del turno); solo lo PENDIENTE la consume.
                agregarCarga(p.estacion_id, p.grupo, p.fecha_paso, p.turno || 'dia', p.m2, kgOrden,
                    p.estado === 'PENDIENTE');
                kgHecho = true;
            }
        }
    }
    const buscarSlot = async (paso, desdeSlot, kgYaContado) => {
        let slot = desdeSlot;
        for (let i = 0; i < 600; i++) {
            if (cabeEnTurno(paso.estacion_id, paso.grupo, slot.fecha, slot.turno, paso.m2, kgYaContado ? 0 : (paso.ordenKg || paso.kg))) return slot;
            slot = await siguienteSlot(slot);
        }
        return slot;
    };

    // 5) Programar cada orden por su SUB-RUTA pendiente, TURNOS en cascada
    //    (T1 noche primero porque arranca la tarde anterior):
    //    Pulido 🌙 lunes (dom 22:00) → Templado 🌞 lunes → sig. paso 🌙 martes (lun 22:00)
    const updatesPasos = [];
    const updatesOrdenes = [];
    const alertas = [];
    let pasosFechados = 0;
    let pasosEnCurso = 0;

    for (const o of cola) {
        // El primer slot del día productivo es el TURNO 1 (noche), que comienza
        // la tarde anterior: desde = martes implica empezar en lun 22:00.
        // HOY con recorte: se arranca por el PRIMER turno de hoy que quedó con
        // capacidad (si solo queda el día, el slot inicial es el día; si no
        // quedó nada, `desde` ya se movió a mañana turno 1 arriba).
        let slot = { fecha: desde, turno: 'noche' };
        if (desde === hoyReal && pctRestanteHoy) {
            const primerTurno = pctRestanteHoy.noche > 0 ? 'noche' : (pctRestanteHoy.dia > 0 ? 'dia' : 'noche');
            slot = { fecha: desde, turno: primerTurno };
        }
        let primeraFecha = null;
        let ultimaFecha = null;
        // REGLA: el kg de la orden consume capacidad del GRUPO UNA sola vez
        // (en su primer paso). Contarlo en cada paso hacía que una orden de 5
        // procesos comiera 5 veces su peso y el plan se estrujara dejando los
        // cuellos de botella vacíos (el método original lo contaba una vez).
        let kgContado = false;
        // Los pasos EN PROCESO/PAUSADO de esta orden YA fueron contados en la
        // carga inicial (arriba, sección 4) en hoy|turno con su kg una vez.
        // Re-contarlos aquí duplicaba la ocupación de hoy y, con el recorte de
        // ventana, hacía imposible que cupiera trabajo nuevo → todo se iba a
        // mañana. Por eso: no se vuelven a agregar y el kg ya está contado.
        const tieneEnCurso = o.pasos.some(p => p.estado === 'EN_PROCESO' || p.estado === 'PAUSADO');
        if (tieneEnCurso) kgContado = true;

        for (const p of o.pasos) {
            if (esHecho(p.estado)) continue;   // historia
            let slotPaso;
            if (p.estado === 'EN_PROCESO' || p.estado === 'PAUSADO') {
                slotPaso = { fecha: hoy, turno: p.turno || turnoActual };   // decisión 2
                pasosEnCurso++;
                // sin agregarCarga: ya cuenta desde la carga inicial (sección 4)
            } else {
                slotPaso = await buscarSlot(p, slot, kgContado);
                pasosFechados++;
                agregarCarga(p.estacion_id, p.grupo, slotPaso.fecha, slotPaso.turno, p.m2, kgContado ? 0 : (o.kilos_orden || p.kg || 0));
            }
            kgContado = true;
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
        rutas_actualizadas: rutasActualizadas,
        avance_implicito: avanceCerrado,
        alertas: avanceCerrado > 0
            ? [{ tipo: 'avance_implicito', mensaje: `${avanceCerrado} pasos sin registrar se cerraron automáticamente porque su avance ya pasó por estaciones posteriores` }, ...alertas]
            : alertas,
        mensaje: `${cola.length} órdenes re-programadas respetando el avance (${pasosFechados} pasos fechados, ${pasosEnCurso} en curso mantenidos hoy${rutasActualizadas ? ', ' + rutasActualizadas + ' rutas sincronizadas con la receta' : ''}${avanceCerrado ? ', ' + avanceCerrado + ' pasos cerrados por avance implícito' : ''})`
    };
}
