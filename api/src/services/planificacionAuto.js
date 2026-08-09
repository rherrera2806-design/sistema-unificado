const { query } = require('../config/database');

/**
 * AUTO-ASIGNAR PENDIENTES — TOC + Cascada Secuencial
 *
 * 1. NORMALIZACIÓN: cada pedido → kg, m2, unidades
 * 2. CUELLO DE BOTELLA: la estación más restrictiva de la ruta define el día ancla
 * 3. CASCADA: estaciones posteriores buscan capacidad DESPUÉS del cuello,
 *             estaciones previas buscan capacidad ANTES del cuello
 * 4. BLOQUEO ESTRICTO: NUNCA se sobrepasa capacidad de ninguna estación
 * 5. DÍAS HÁBILES: se saltan fines de semana
 */
async function autoAsignarPendientes({ dias = 14, inicio } = {}) {
  const inicioDate = inicio ? new Date(inicio + 'T00:00:00') : new Date();
  inicioDate.setHours(0, 0, 0, 0);

  // ═══════════════════════════════════════════════════════════════
  // 1. TODAS LAS ESTACIONES
  // ═══════════════════════════════════════════════════════════════
  const allEstRes = await query(`
    SELECT id, nombre_estacion, capacidad_max_m2_dia, unidad_capacidad,
           orden_secuencia_defecto, es_cuello_botella
    FROM estaciones_maestras WHERE activa = TRUE
    ORDER BY orden_secuencia_defecto
  `);
  const estMap = {};
  for (const e of allEstRes.rows) {
    estMap[e.id] = {
      cap: Number(e.capacidad_max_m2_dia) || 0,
      unidad: e.unidad_capacidad || 'm2',
      nombre: e.nombre_estacion,
      orden: e.orden_secuencia_defecto,
      esCuello: !!e.es_cuello_botella
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. CARGA ACTUAL POR ESTACIÓN POR DÍA (con dedup por orden)
  // ═══════════════════════════════════════════════════════════════
  const cargaEstRes = await query(
    `SELECT cp.fecha_programada, cp.estacion_id, cp.orden_produccion_id,
            cp.m2_asignados, o.kilos, o.cantidad
     FROM cola_produccion_pasos cp
     JOIN produccion_ordenes o ON o.id = cp.orden_produccion_id
     WHERE cp.fecha_programada IS NOT NULL AND cp.estado != 'TERMINADO'`
  );
  const cargaEstMap = {};
  for (const r of cargaEstRes.rows) {
    const fs = fmt(new Date(r.fecha_programada));
    const k = fs + '|' + r.estacion_id + '|' + r.orden_produccion_id;
    if (cargaEstMap[k]) continue;
    const est = estMap[r.estacion_id];
    if (!est) continue;
    let consumo = 0;
    if (est.unidad === 'unidades') consumo = Number(r.cantidad) || 0;
    else if (est.unidad === 'kg') consumo = Number(r.kilos) || 0;
    else consumo = Number(r.m2_asignados) || 0;
    const stationKey = fs + '|' + r.estacion_id;
    cargaEstMap[stationKey] = (cargaEstMap[stationKey] || 0) + consumo;
    cargaEstMap[k] = true;
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. BACKFILL: grupo, espesor, kilos
  // ═══════════════════════════════════════════════════════════════
  await query(`UPDATE produccion_ordenes o SET grupo = CASE
    WHEN o.es_compuesto = TRUE THEN COALESCE(
      (SELECT cc.grupo FROM produccion_codigos cc WHERE cc.codigo = o.codigo_padre),
      (SELECT cc2.grupo FROM produccion_recetas_bom rb JOIN produccion_codigos cc2 ON cc2.codigo = rb.codigo_sap_padre WHERE rb.id = o.bom_padre_id)
    )
    ELSE (SELECT cc.grupo FROM produccion_codigos cc WHERE cc.codigo = o.codigo_producto)
  END WHERE o.grupo IS NULL`);

  await query(`UPDATE produccion_ordenes o SET grupo = COALESCE(
    (SELECT cc.grupo FROM produccion_codigos cc WHERE cc.codigo = o.codigo_padre),
    (SELECT cc2.grupo FROM produccion_recetas_bom rb JOIN produccion_codigos cc2 ON cc2.codigo = rb.codigo_sap_padre WHERE rb.id = o.bom_padre_id)
  ) WHERE o.es_compuesto = TRUE AND o.bom_padre_id IS NOT NULL`);

  await query(`UPDATE produccion_ordenes o SET espesor_mm = COALESCE(
    (SELECT rb.espesor FROM produccion_recetas_bom rb WHERE rb.id = o.bom_padre_id),
    o.espesor_mm, 6
  ) WHERE o.es_compuesto = TRUE AND o.bom_padre_id IS NOT NULL`);

  await query(`UPDATE produccion_ordenes
    SET kilos = ROUND(COALESCE(metros_cuadrados, 0) * 2.5 * COALESCE(espesor_mm, 6)::numeric, 2)
    WHERE (kilos IS NULL OR kilos = 0) AND metros_cuadrados > 0`);

  // ═══════════════════════════════════════════════════════════════
  // 4. CAPACIDAD POR GRUPO Y CARGA ACTUAL
  // ═══════════════════════════════════════════════════════════════
  const capRes = await query('SELECT * FROM produccion_capacidad_grupo WHERE activo = TRUE');
  const capGrupoMap = {};
  for (const r of capRes.rows) capGrupoMap[r.grupo] = Number(r.capacidad_kg_dia) || 0;

  const cargaGrupoRes = await query(
    `SELECT fecha_programada, grupo, COALESCE(SUM(kilos),0) as kg
     FROM produccion_ordenes
     WHERE fecha_programada IS NOT NULL AND estado_programacion NOT IN ('CERRADO','TERMINADO')
     GROUP BY fecha_programada, grupo`
  );
  const cargaGrupoMap = {};
  for (const r of cargaGrupoRes.rows) {
    const fs = fmt(new Date(r.fecha_programada));
    if (!cargaGrupoMap[fs]) cargaGrupoMap[fs] = {};
    cargaGrupoMap[fs][r.grupo] = Number(r.kg) || 0;
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. PENDIENTES
  // ═══════════════════════════════════════════════════════════════
  const pendRes = await query(
    `SELECT o.* FROM produccion_ordenes o
     WHERE o.estado_programacion = 'PENDIENTE' AND o.fecha_programada IS NULL
     ORDER BY o.created_at`
  );

  const padreRes = await query(
    `SELECT o.id as orden_id, o.bom_padre_id, o.codigo_padre, COALESCE(
      (SELECT cc.grupo FROM produccion_codigos cc WHERE cc.codigo = o.codigo_padre),
      (SELECT cc2.grupo FROM produccion_recetas_bom rb2 JOIN produccion_codigos cc2 ON cc2.codigo = rb2.codigo_sap_padre WHERE rb2.id = o.bom_padre_id)
    ) as grupo_padre
    FROM produccion_ordenes o WHERE o.es_compuesto = TRUE`
  );
  const padreGrupoMap = {};
  for (const r of padreRes.rows) {
    if (r.bom_padre_id != null && r.grupo_padre != null) padreGrupoMap[r.bom_padre_id] = r.grupo_padre;
  }

  // Calendario laboral
  const calMap = {};
  try {
    const calRes = await query(`SELECT to_char(fecha, 'YYYY-MM-DD') as fs, es_laboral FROM calendario_produccion`);
    for (const r of calRes.rows) calMap[r.fs] = r.es_laboral;
  } catch (e) { /* silencioso */ }

  // ═══════════════════════════════════════════════════════════════
  // 6. HELPERS
  // ═══════════════════════════════════════════════════════════════
  function fmt(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function esLaboral(fStr) {
    if (Object.prototype.hasOwnProperty.call(calMap, fStr)) return !!calMap[fStr];
    const d = new Date(fStr + 'T00:00:00');
    return d.getDay() !== 0 && d.getDay() !== 6;
  }

  function sumarDias(fStr, n) {
    const d = new Date(fStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return fmt(d);
  }

  function siguienteDiaHabil(fechaStr) {
    let d = new Date(fechaStr + 'T00:00:00');
    do { d.setDate(d.getDate() + 1); } while (!esLaboral(fmt(d)));
    return fmt(d);
  }

  function anteriorDiaHabil(fechaStr) {
    let d = new Date(fechaStr + 'T00:00:00');
    do { d.setDate(d.getDate() - 1); } while (!esLaboral(fmt(d)));
    return fmt(d);
  }

  function consumoEnEstacion(estId, cantidad, m2, kg) {
    const est = estMap[estId];
    if (!est) return 0;
    switch (est.unidad) {
      case 'unidades': return Number(cantidad) || 0;
      case 'kg': return Number(kg) || 0;
      default: return Number(m2) || 0;
    }
  }

  function capacidadRestante(estId, fecha) {
    const est = estMap[estId];
    if (!est || est.cap <= 0) return Infinity;
    const actual = cargaEstMap[fecha + '|' + estId] || 0;
    return Math.max(0, est.cap - actual);
  }

  function cabeEnEstacion(estId, fecha, cantidad, m2, kg) {
    const est = estMap[estId];
    if (!est || est.cap <= 0) return true;
    const consumo = consumoEnEstacion(estId, cantidad, m2, kg);
    const actual = cargaEstMap[fecha + '|' + estId] || 0;
    return (actual + consumo) <= est.cap + 0.001;
  }

  function agregarConsumo(fecha, estId, ordenId, cantidad, m2, kg) {
    const stationKey = fecha + '|' + estId;
    const consumo = consumoEnEstacion(estId, cantidad, m2, kg);
    cargaEstMap[stationKey] = (cargaEstMap[stationKey] || 0) + consumo;
  }

  /**
   * Encontrar el mejor día para la estación cuello de botella de la ruta.
   * Solo verifica capacidad de la estación cuello (las demás se resuelven por cascada).
   */
  function encontrarDiaOptimo(route, cantidad, m2, kg, grupo) {
    const capGrupo = capGrupoMap[grupo] || 0;
    const kgPorUnidad = cantidad > 0 ? kg / cantidad : 0;
    const m2PorUnidad = cantidad > 0 ? m2 / cantidad : 0;

    const cuelloId = route.find(id => estMap[id] && estMap[id].esCuello);
    if (!cuelloId) return { fecha: null, score: -1, units: 0 };

    let best = { fecha: null, score: -1, units: 0 };

    for (let i = 0; i < dias; i++) {
      const d = new Date(inicioDate);
      d.setDate(d.getDate() + i);
      const fs = fmt(d);
      if (!esLaboral(fs)) continue;

      if (capGrupo > 0) {
        const kgGrupoUsados = (cargaGrupoMap[fs] && cargaGrupoMap[fs][grupo]) || 0;
        if (kgGrupoUsados + kg > capGrupo) continue;
      }

      const est = estMap[cuelloId];
      if (!est || est.cap <= 0) continue;
      const reste = capacidadRestante(cuelloId, fs);
      let maxUnits;
      switch (est.unidad) {
        case 'unidades': maxUnits = Math.floor(reste); break;
        case 'kg': maxUnits = kgPorUnidad > 0 ? Math.floor(reste / kgPorUnidad) : Infinity; break;
        default: maxUnits = m2PorUnidad > 0 ? Math.floor(reste / m2PorUnidad) : Infinity;
      }
      if (maxUnits < 1) continue;

      const unitsToAssign = Math.min(cantidad, maxUnits);
      const kgAsignados = kgPorUnidad * unitsToAssign;

      if (capGrupo > 0) {
        const kgGrupoUsados = (cargaGrupoMap[fs] && cargaGrupoMap[fs][grupo]) || 0;
        if (kgGrupoUsados + kgAsignados > capGrupo) continue;
      }

      const actual = cargaEstMap[fs + '|' + cuelloId] || 0;
      const consumo = consumoEnEstacion(cuelloId, unitsToAssign, m2PorUnidad * unitsToAssign, kgAsignados);
      const utilization = (actual + consumo) / est.cap;

      if (utilization > best.score) {
        best = { fecha: fs, score: utilization, units: unitsToAssign };
      }
    }
    return best;
  }

  /**
   * Cascada hacia adelante: asigna estaciones DESPUÉS del cuello.
   * Cada estación busca el primer día hábil con capacidad, mínimo +1 día
   * hábil después de la estación anterior.
   */
  function forwardCascade(route, cuelloIdx, fechaCuello, cantidad, m2, kg) {
    const asignaciones = [];
    let fechaMinima = fechaCuello;

    for (let i = cuelloIdx + 1; i < route.length; i++) {
      const estId = route[i];
      const est = estMap[estId];
      if (!est || est.cap <= 0) { asignaciones.push({ estId, fecha: null }); continue; }

      const diaInicio = siguienteDiaHabil(fechaMinima);
      let fechaAsignada = null;

      for (let offset = 0; offset < dias; offset++) {
        const d = new Date(diaInicio + 'T00:00:00');
        d.setDate(d.getDate() + offset);
        const fs = fmt(d);
        if (!esLaboral(fs)) continue;
        if (cabeEnEstacion(estId, fs, cantidad, m2, kg)) {
          fechaAsignada = fs;
          break;
        }
      }

      if (fechaAsignada) {
        agregarConsumo(fechaAsignada, estId, null, cantidad, m2, kg);
        fechaMinima = fechaAsignada;
      }
      asignaciones.push({ estId, fecha: fechaAsignada });
    }
    return asignaciones;
  }

  /**
   * Cascada hacia atrás: asigna estaciones ANTES del cuello.
   * Cada estación busca el último día hábil con capacidad, máximo -1 día
   * hábil antes de la estación siguiente.
   */
  function backwardCascade(route, cuelloIdx, fechaCuello, cantidad, m2, kg) {
    const asignaciones = [];
    let fechaMaxima = fechaCuello;

    for (let i = cuelloIdx - 1; i >= 0; i--) {
      const estId = route[i];
      const est = estMap[estId];
      if (!est || est.cap <= 0) { asignaciones.unshift({ estId, fecha: null }); continue; }

      const diaLimite = anteriorDiaHabil(fechaMaxima);
      let fechaAsignada = null;

      for (let offset = 0; offset < dias; offset++) {
        const d = new Date(diaLimite + 'T00:00:00');
        d.setDate(d.getDate() - offset);
        const fs = fmt(d);
        if (!esLaboral(fs)) continue;
        if (cabeEnEstacion(estId, fs, cantidad, m2, kg)) {
          fechaAsignada = fs;
          break;
        }
      }

      if (fechaAsignada) {
        agregarConsumo(fechaAsignada, estId, null, cantidad, m2, kg);
        fechaMaxima = fechaAsignada;
      }
      asignaciones.unshift({ estId, fecha: fechaAsignada });
    }
    return asignaciones;
  }

  // ═══════════════════════════════════════════════════════════════
  // 7. PROCESAR PENDIENTES
  // ═══════════════════════════════════════════════════════════════
  const asignados = [];
  const noAsignados = [];
  const splitLetters = {};

  pendRes.rows.sort((a, b) => (Number(b.cantidad) || 0) - (Number(a.cantidad) || 0));

  for (let idx = 0; idx < pendRes.rows.length; idx++) {
    const o = pendRes.rows[idx];
    const kg = Number(o.kilos) || 0;
    const m2 = Number(o.metros_cuadrados) || 0;
    const cantidad = Number(o.cantidad) || 1;

    let grupo;
    if (o.es_compuesto && o.bom_padre_id) {
      grupo = padreGrupoMap[o.bom_padre_id] || o.grupo;
    } else {
      grupo = o.grupo;
    }

    if (!grupo || kg <= 0) {
      noAsignados.push({ orden_id: o.id, pedido: o.pedido_sap_id, motivo: 'Sin grupo o sin kilos', grupo: grupo || null, kg_total: kg, m2_total: m2 });
      continue;
    }

    const rutaRes = await query(
      'SELECT estacion_id FROM cola_produccion_pasos WHERE orden_produccion_id = $1 ORDER BY orden_secuencia',
      [o.id]
    );
    const route = rutaRes.rows.map(r => r.estacion_id);

    if (route.length === 0) {
      noAsignados.push({ orden_id: o.id, pedido: o.pedido_sap_id, motivo: 'Sin ruta definida', grupo, kg_total: kg, m2_total: m2 });
      continue;
    }

    const kgPorUnidad = cantidad > 0 ? kg / cantidad : 0;
    const m2PorUnidad = cantidad > 0 ? m2 / cantidad : 0;

    // ─── PASO A: encontrar día del cuello de botella ───
    const fit = encontrarDiaOptimo(route, cantidad, m2, kg, grupo);

    if (!fit.fecha || fit.units < 1) {
      noAsignados.push({ orden_id: o.id, pedido: o.pedido_sap_id, motivo: 'Sin capacidad en los próximos ' + dias + ' días', grupo, kg_total: kg, m2_total: m2 });
      continue;
    }

    const unitsToAssign = fit.units;
    const kgAsignados = kgPorUnidad * unitsToAssign;
    const m2Asignados = m2PorUnidad * unitsToAssign;
    let cuelloIdx = route.findIndex(id => estMap[id] && estMap[id].esCuello);
    if (cuelloIdx < 0) cuelloIdx = 0;

    // ─── PASO B: cascada hacia adelante (después del cuello) ───
    const forward = forwardCascade(route, cuelloIdx, fit.fecha, unitsToAssign, m2Asignados, kgAsignados);

    // ─── PASO C: cascada hacia atrás (antes del cuello) ───
    const backward = backwardCascade(route, cuelloIdx, fit.fecha, unitsToAssign, m2Asignados, kgAsignados);

    // ─── PASO D: consolidar fechas por estación ───
    const estacionFechas = {};
    estacionFechas[route[cuelloIdx]] = fit.fecha;
    for (const a of forward) if (a.fecha) estacionFechas[a.estId] = a.fecha;
    for (const a of backward) if (a.fecha) estacionFechas[a.estId] = a.fecha;

    const todasTienenFecha = route.every(id => estacionFechas[id]);
    if (!todasTienenFecha) {
      noAsignados.push({ orden_id: o.id, pedido: o.pedido_sap_id, motivo: 'Una o más estaciones sin capacidad en el rango de días', grupo, kg_total: kg, m2_total: m2 });
      continue;
    }

    const fechasValues = Object.values(estacionFechas);
    const fechaPrimera = fechasValues.sort()[0];
    const fechaUltima = fechasValues.sort().pop();

    if (fit.units >= cantidad) {
      // ═══ ASIGNACIÓN COMPLETA ═══
      await query(
        `UPDATE produccion_ordenes SET fecha_programada = $1, fecha_entrega_pactada = $2, estado_programacion = 'PROGRAMADO' WHERE id = $3`,
        [fechaPrimera, fechaUltima, o.id]
      );
      for (const estId of route) {
        await query(
          `UPDATE cola_produccion_pasos SET fecha_programada = $1, m2_asignados = $2 WHERE orden_produccion_id = $3 AND estacion_id = $4`,
          [estacionFechas[estId], m2Asignados, o.id, estId]
        );
      }

      if (!cargaGrupoMap[fechaPrimera]) cargaGrupoMap[fechaPrimera] = {};
      cargaGrupoMap[fechaPrimera][grupo] = (cargaGrupoMap[fechaPrimera][grupo] || 0) + kg;

      asignados.push({ orden_id: o.id, fecha: fechaPrimera, fecha_entrega: fechaUltima, grupo, kg, unidades: cantidad });

    } else if (fit.units >= 1) {
      // ═══ SPLIT PARCIAL ═══
      const unitsAsignadas = fit.units;
      const resto = cantidad - unitsAsignadas;

      const origPedido = o.pedido_sap_id || '';
      if (!splitLetters[origPedido]) splitLetters[origPedido] = 0;
      splitLetters[origPedido]++;
      const letterA = String.fromCharCode(64 + splitLetters[origPedido]);
      const letterB = String.fromCharCode(65 + splitLetters[origPedido]);

      await query(
        `UPDATE produccion_ordenes
         SET fecha_programada = $1, fecha_entrega_pactada = $2, estado_programacion = 'PROGRAMADO',
             cantidad = $3, kilos = $4, metros_cuadrados = $5, pedido_sap_id = $6
         WHERE id = $7`,
        [fechaPrimera, fechaUltima, unitsAsignadas, kgAsignados, m2Asignados, origPedido + letterA, o.id]
      );
      for (const estId of route) {
        await query(
          `UPDATE cola_produccion_pasos SET fecha_programada = $1, m2_asignados = $2 WHERE orden_produccion_id = $3 AND estacion_id = $4`,
          [estacionFechas[estId], m2Asignados, o.id, estId]
        );
      }

      const nuevaRes = await query(
        `INSERT INTO produccion_ordenes (
          pedido_sap_id, cliente, codigo_producto, descripcion, ancho, alto,
          familia_id, espesor_mm, tipo_venta, item_numero, nota, posicion,
          orden_compra, tipo_entrega, grupo, codigo_padre, bom_padre_id, es_compuesto,
          cantidad, kilos, metros_cuadrados,
          estado_programacion, fecha_programada, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,'PENDIENTE',NULL,NOW())
        RETURNING id`,
        [
          origPedido + letterB, o.cliente, o.codigo_producto, o.descripcion, o.ancho, o.alto,
          o.familia_id, o.espesor_mm, o.tipo_venta, o.item_numero, o.nota, o.posicion,
          o.orden_compra, o.tipo_entrega, o.grupo, o.codigo_padre, o.bom_padre_id, o.es_compuesto,
          resto, kgPorUnidad * resto, m2PorUnidad * resto
        ]
      );
      const nuevaOrdenId = nuevaRes.rows[0].id;

      const pasosRes = await query(
        'SELECT estacion_id, orden_secuencia FROM cola_produccion_pasos WHERE orden_produccion_id = $1',
        [o.id]
      );
      for (const p of pasosRes.rows) {
        await query(
          `INSERT INTO cola_produccion_pasos (orden_produccion_id, estacion_id, orden_secuencia) VALUES ($1, $2, $3)`,
          [nuevaOrdenId, p.estacion_id, p.orden_secuencia]
        );
      }

      if (!cargaGrupoMap[fechaPrimera]) cargaGrupoMap[fechaPrimera] = {};
      cargaGrupoMap[fechaPrimera][grupo] = (cargaGrupoMap[fechaPrimera][grupo] || 0) + kgAsignados;

      pendRes.rows.push({
        ...o,
        id: nuevaOrdenId,
        cantidad: resto,
        kilos: kgPorUnidad * resto,
        metros_cuadrados: m2PorUnidad * resto,
        estado_programacion: 'PENDIENTE',
        fecha_programada: null
      });

      asignados.push({ orden_id: o.id, fecha: fechaPrimera, fecha_entrega: fechaUltima, grupo, kg: kgAsignados, unidades: unitsAsignadas, nota: 'Split parcial' });

    } else {
      noAsignados.push({ orden_id: o.id, pedido: o.pedido_sap_id, motivo: 'Sin capacidad en los próximos ' + dias + ' días', grupo, kg_total: kg, m2_total: m2 });
    }
  }

  return { asignados, noAsignados, total_procesados: pendRes.rows.length };
}

module.exports = { autoAsignarPendientes };
