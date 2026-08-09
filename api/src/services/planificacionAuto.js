const { query } = require('../config/database');

async function autoAsignarPendientes({ dias = 14, inicio } = {}) {
  const inicioDate = inicio ? new Date(inicio + 'T00:00:00') : new Date();
  inicioDate.setHours(0, 0, 0, 0);

  // 2. Capacidades por grupo
  const capRes = await query('SELECT * FROM produccion_capacidad_grupo WHERE activo = TRUE');
  const capMap = {};
  for (const r of capRes.rows) {
    capMap[r.grupo] = Number(r.capacidad_kg_dia) || 0;
  }

  // 3. Cuellos de botella
  const cuelloRes = await query('SELECT id, nombre_estacion, capacidad_max_m2_dia FROM estaciones_maestras WHERE es_cuello_botella = TRUE AND activa = TRUE');
  const cuellosMap = {};
  const cuelloIds = new Set();
  for (const e of cuelloRes.rows) {
    cuellosMap[e.id] = Number(e.capacidad_max_m2_dia) || 0;
    cuelloIds.add(e.id);
  }

  // 3b. Todas las estaciones (para calcular fecha de entrega)
  const allEstRes = await query('SELECT id, capacidad_max_m2_dia, unidad_capacidad FROM estaciones_maestras WHERE activa = TRUE');
  const estCapMap = {};
  for (const e of allEstRes.rows) {
    estCapMap[e.id] = { cap: Number(e.capacidad_max_m2_dia) || 100, unidad: e.unidad_capacidad || 'm2' };
  }

  // 4. Carga actual de m2 por estación por día
  const cargaEstRes = await query(
    `SELECT cp.fecha_programada, cp.estacion_id, COALESCE(SUM(cp.m2_asignados),0) as m2_total
     FROM cola_produccion_pasos cp
     JOIN produccion_ordenes o ON o.id = cp.orden_produccion_id
     WHERE cp.fecha_programada IS NOT NULL AND cp.estado != 'TERMINADO'
     AND cp.estacion_id = ANY($1)
     GROUP BY cp.fecha_programada, cp.estacion_id`,
    [cuelloRes.rows.map(e => e.id)]
  );
  const cargaEstMap = {};
  for (const r of cargaEstRes.rows) {
    const fs = fmt(new Date(r.fecha_programada));
    cargaEstMap[fs + '|' + r.estacion_id] = Number(r.m2_total) || 0;
  }

  // 5. Backfill
  // 5a: Backfill grupo
  await query(
    `UPDATE produccion_ordenes o
     SET grupo = CASE
         WHEN o.es_compuesto = TRUE THEN COALESCE(
             (SELECT cc.grupo FROM produccion_codigos cc WHERE cc.codigo = o.codigo_padre),
             (SELECT cc2.grupo FROM produccion_recetas_bom rb JOIN produccion_codigos cc2 ON cc2.codigo = rb.codigo_sap_padre WHERE rb.id = o.bom_padre_id)
         )
         ELSE (SELECT cc.grupo FROM produccion_codigos cc WHERE cc.codigo = o.codigo_producto)
     END
     WHERE o.grupo IS NULL`
  );

  // 5b: Re-resolver BOM
  await query(
    `UPDATE produccion_ordenes o
     SET grupo = COALESCE(
         (SELECT cc.grupo FROM produccion_codigos cc WHERE cc.codigo = o.codigo_padre),
         (SELECT cc2.grupo FROM produccion_recetas_bom rb JOIN produccion_codigos cc2 ON cc2.codigo = rb.codigo_sap_padre WHERE rb.id = o.bom_padre_id)
     )
     WHERE o.es_compuesto = TRUE AND o.bom_padre_id IS NOT NULL`
  );

  // 5c: Forzar espesor desde recetas
  await query(
    `UPDATE produccion_ordenes o
     SET espesor_mm = COALESCE(
         (SELECT rb.espesor FROM produccion_recetas_bom rb WHERE rb.id = o.bom_padre_id),
         o.espesor_mm, 6
     )
     WHERE o.es_compuesto = TRUE AND o.bom_padre_id IS NOT NULL`
  );

  // 5d: Backfill kilos
  await query(
    `UPDATE produccion_ordenes
     SET kilos = ROUND(COALESCE(metros_cuadrados, 0) * 2.5 * COALESCE(espesor_mm, 6)::numeric, 2)
     WHERE (kilos IS NULL OR kilos = 0) AND metros_cuadrados > 0`
  );

  // 6. Pendientes
  const pendRes = await query(
    `SELECT o.* FROM produccion_ordenes o
     WHERE o.estado_programacion = 'PENDIENTE' AND o.fecha_programada IS NULL
     ORDER BY o.created_at`
  );

  // 7. Grupo del padre para BOM
  const padreRes = await query(
    `SELECT o.id as orden_id, o.bom_padre_id, o.codigo_padre, COALESCE(
         (SELECT cc.grupo FROM produccion_codigos cc WHERE cc.codigo = o.codigo_padre),
         (SELECT cc2.grupo FROM produccion_recetas_bom rb2 JOIN produccion_codigos cc2 ON cc2.codigo = rb2.codigo_sap_padre WHERE rb2.id = o.bom_padre_id)
     ) as grupo_padre
     FROM produccion_ordenes o
     WHERE o.es_compuesto = TRUE`
  );
  const padreGrupoMap = {};
  for (const r of padreRes.rows) {
    if (r.bom_padre_id != null && r.grupo_padre != null) {
      padreGrupoMap[r.bom_padre_id] = r.grupo_padre;
    }
  }

  // 8. Carga actual por fecha/grupo
  const cargaRes = await query(
    `SELECT fecha_programada, grupo, COALESCE(SUM(kilos),0) as kg
     FROM produccion_ordenes
     WHERE fecha_programada IS NOT NULL AND estado_programacion NOT IN ('CERRADO','TERMINADO')
     GROUP BY fecha_programada, grupo`
  );
  const cargaMap = {};
  for (const r of cargaRes.rows) {
    const fs = fmt(new Date(r.fecha_programada));
    if (!cargaMap[fs]) cargaMap[fs] = {};
    cargaMap[fs][r.grupo] = Number(r.kg) || 0;
  }

  // 9. Calendario laboral
  const calMap = {};
  try {
    const calRes = await query(`SELECT to_char(fecha, 'YYYY-MM-DD') as fs, es_laboral FROM calendario_produccion`);
    for (const r of calRes.rows) {
      calMap[r.fs] = r.es_laboral;
    }
  } catch (e) {
    // silencioso
  }

  // 10. Helpers
  function fmt(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function esLaboral(fStr) {
    if (Object.prototype.hasOwnProperty.call(calMap, fStr)) {
      return !!calMap[fStr];
    }
    const d = new Date(fStr + 'T00:00:00');
    const dow = d.getDay();
    return dow !== 0 && dow !== 6;
  }

  function findDateWithCapacity(grupo, kg, m2, estacionesIds) {
    const capGrupo = capMap[grupo] || 0;
    for (let i = 0; i < dias; i++) {
      const d = new Date(inicioDate);
      d.setDate(d.getDate() + i);
      const fs = fmt(d);
      if (!esLaboral(fs)) continue;
      const usados = (cargaMap[fs] && cargaMap[fs][grupo]) || 0;
      if (usados + kg > capGrupo) continue;
      let ok = true;
      for (const estId of (estacionesIds || [])) {
        if (!cuelloIds.has(estId)) continue;
        const capEst = cuellosMap[estId] || 0;
        const usadosEst = cargaEstMap[fs + '|' + estId] || 0;
        if (usadosEst + m2 > capEst) { ok = false; break; }
      }
      if (ok) return fs;
    }
    return null;
  }

  function calcUnitsForDay(grupo, kgPorUnidad, m2PorUnidad, estacionesIds) {
    const capGrupo = capMap[grupo] || 0;
    let best = { units: 0, fecha: null, score: -1 };

    for (let i = 0; i < dias; i++) {
      const d = new Date(inicioDate);
      d.setDate(d.getDate() + i);
      const fs = fmt(d);
      if (!esLaboral(fs)) continue;

      const usadosGrupo = (cargaMap[fs] && cargaMap[fs][grupo]) || 0;
      const resteGrupo = capGrupo - usadosGrupo;
      if (resteGrupo <= 0) continue;

      let feasible = true;
      for (const estId of (estacionesIds || [])) {
        if (!cuelloIds.has(estId)) continue;
        const capEst = cuellosMap[estId] || 0;
        const usadosEst = cargaEstMap[fs + '|' + estId] || 0;
        const estUnidad = estCapMap[estId]?.unidad || 'm2';
        if (estUnidad === 'unidades') {
          if (capEst - usadosEst < 1) { feasible = false; break; }
        } else {
          if (m2PorUnidad > 0 && capEst - usadosEst < m2PorUnidad) { feasible = false; break; }
        }
      }
      if (!feasible) continue;

      let unitsByGrupo = Infinity;
      if (kgPorUnidad > 0) unitsByGrupo = Math.floor(resteGrupo / kgPorUnidad);
      if (unitsByGrupo <= 0) continue;

      let unitsByEstaciones = Infinity;
      let worstUsedRatio = 1;
      let worstEstId = null;
      for (const estId of (estacionesIds || [])) {
        if (!cuelloIds.has(estId)) continue;
        const capEst = cuellosMap[estId] || 0;
        const usadosEst = cargaEstMap[fs + '|' + estId] || 0;
        const estUnidad = estCapMap[estId]?.unidad || 'm2';
        let estUnits;
        if (estUnidad === 'unidades') {
          estUnits = Math.floor(capEst - usadosEst);
        } else {
          estUnits = m2PorUnidad > 0 ? Math.floor((capEst - usadosEst) / m2PorUnidad) : Infinity;
        }
        unitsByEstaciones = Math.min(unitsByEstaciones, estUnits);
        if (capEst > 0) {
          const usedRatio = usadosEst / capEst;
          if (usedRatio < worstUsedRatio) {
            worstUsedRatio = usedRatio;
            worstEstId = estId;
          }
        }
      }
      if (unitsByEstaciones <= 0) continue;

      const units = Math.min(unitsByGrupo, unitsByEstaciones);

      const estCapAfter = {};
      for (const estId of (estacionesIds || [])) {
        if (!cuelloIds.has(estId)) continue;
        const capEst = cuellosMap[estId] || 0;
        if (capEst <= 0) continue;
        const usadosEst = cargaEstMap[fs + '|' + estId] || 0;
        const estUnidad = estCapMap[estId]?.unidad || 'm2';
        const amount = estUnidad === 'unidades' ? units : units * m2PorUnidad;
        estCapAfter[estId] = (usadosEst + amount) / capEst;
      }

      let maxFill = 0;
      let tightestId = null;
      for (const [estId, fill] of Object.entries(estCapAfter)) {
        if (fill > maxFill) {
          maxFill = fill;
          tightestId = Number(estId);
        }
      }

      if (units > 0 && maxFill > best.score) {
        best = { units, fecha: fs, score: maxFill, tightestId };
      }
    }
    return { units: best.units, fecha: best.fecha };
  }

  function addToCarga(fecha, grupo, kg) {
    if (!cargaMap[fecha]) cargaMap[fecha] = {};
    cargaMap[fecha][grupo] = (cargaMap[fecha][grupo] || 0) + kg;
  }

  function addToCargaEst(fecha, estacionId, m2, cantidad) {
    const k = fecha + '|' + estacionId;
    const estUnidad = estCapMap[estacionId]?.unidad || 'm2';
    if (estUnidad === 'unidades') {
      cargaEstMap[k] = (cargaEstMap[k] || 0) + (cantidad || 0);
    } else {
      cargaEstMap[k] = (cargaEstMap[k] || 0) + m2;
    }
  }

  function calcFechaEntrega(fechaInicio, estacionesIds, m2, cantidad) {
    let fechaMax = new Date(fechaInicio + 'T00:00:00');
    for (const estId of estacionesIds) {
      const info = estCapMap[estId];
      if (!info) continue;
      const cap = info.cap;
      if (cap <= 0) continue;
      let diasEstacion;
      if (info.unidad === 'unidades') {
        diasEstacion = Math.ceil(cantidad / cap);
      } else {
        diasEstacion = Math.ceil(m2 / cap);
      }
      diasEstacion = Math.max(diasEstacion, 1);
      const fechaFin = new Date(fechaInicio + 'T00:00:00');
      fechaFin.setDate(fechaFin.getDate() + diasEstacion - 1);
      if (fechaFin > fechaMax) fechaMax = fechaFin;
    }
    const y = fechaMax.getFullYear();
    const m = String(fechaMax.getMonth() + 1).padStart(2, '0');
    const d = String(fechaMax.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  // 11. Procesar pendientes (ordenados de mayor a menor para llenar máquinas primero)
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
      'SELECT estacion_id FROM cola_produccion_pasos WHERE orden_produccion_id = $1',
      [o.id]
    );
    const estacionesIds = rutaRes.rows.map(r => r.estacion_id);

    const kgPorUnidad = cantidad > 0 ? kg / cantidad : kg;
    const m2PorUnidad = cantidad > 0 ? m2 / cantidad : m2;

    const fit = calcUnitsForDay(grupo, kgPorUnidad, m2PorUnidad, estacionesIds);

    if (fit.fecha && fit.units >= cantidad) {
      // Asignación completa
      const fechaEntrega = calcFechaEntrega(fit.fecha, estacionesIds, m2, cantidad);
      await query(
        `UPDATE produccion_ordenes SET fecha_programada = $1, fecha_entrega_pactada = $2, estado_programacion = 'PROGRAMADO' WHERE id = $3`,
        [fit.fecha, fechaEntrega, o.id]
      );
      await query(
        `UPDATE cola_produccion_pasos SET fecha_programada = $1, m2_asignados = $2 WHERE orden_produccion_id = $3`,
        [fit.fecha, m2, o.id]
      );
      addToCarga(fit.fecha, grupo, kg);
      for (const estId of estacionesIds) {
        addToCargaEst(fit.fecha, estId, m2, cantidad);
      }
      asignados.push({ orden_id: o.id, fecha: fit.fecha, grupo, kg, unidades: cantidad });
    } else if (fit.fecha && fit.units >= 1) {
      // SPLIT parcial
      const unitsAsignadas = fit.units;
      const kgAsignados = kgPorUnidad * unitsAsignadas;
      const m2Asignados = m2PorUnidad * unitsAsignadas;
      const resto = cantidad - unitsAsignadas;
      const fechaEntrega = calcFechaEntrega(fit.fecha, estacionesIds, m2Asignados, unitsAsignadas);

      const origPedido = o.pedido_sap_id || '';
      if (!splitLetters[origPedido]) splitLetters[origPedido] = 0;
      splitLetters[origPedido]++;
      const letterA = String.fromCharCode(64 + splitLetters[origPedido]);
      const letterB = String.fromCharCode(65 + splitLetters[origPedido]);

      await query(
        `UPDATE produccion_ordenes
         SET fecha_programada = $1, fecha_entrega_pactada = $2, estado_programacion = 'PROGRAMADO',
             cantidad = $3, kilos = $4, metros_cuadrados = $5,
             pedido_sap_id = $6
         WHERE id = $7`,
        [fit.fecha, fechaEntrega, unitsAsignadas, kgAsignados, m2Asignados, origPedido + letterA, o.id]
      );

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

      addToCarga(fit.fecha, grupo, kgAsignados);
      for (const estId of estacionesIds) {
        addToCargaEst(fit.fecha, estId, m2Asignados, unitsAsignadas);
      }

      pendRes.rows.push({
        ...o,
        id: nuevaOrdenId,
        cantidad: resto,
        kilos: kgPorUnidad * resto,
        metros_cuadrados: m2PorUnidad * resto,
        estado_programacion: 'PENDIENTE',
        fecha_programada: null
      });

      asignados.push({ orden_id: o.id, fecha: fit.fecha, grupo, kg: kgAsignados, unidades: unitsAsignadas, nota: 'Split parcial' });
    } else {
      noAsignados.push({ orden_id: o.id, pedido: o.pedido_sap_id, motivo: 'Sin capacidad en los próximos ' + dias + ' días', grupo, kg_total: kg, m2_total: m2 });
    }
  }

  // 12. Resultado
  return { asignados, noAsignados, total_procesados: pendRes.rows.length };
}

module.exports = { autoAsignarPendientes };
