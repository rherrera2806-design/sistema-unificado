const { query } = require('../config/database');

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  AUTO-ASIGNAR PENDIENTES — Drum-Buffer-Rope (DBR)              ║
 * ║  ARCHIVO CRÍTICO — Ver docs/PLANIFICACION_DBR.md antes de      ║
 * ║  modificar. Las 5 reglas son inviolables.                      ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * REGLA 1: PISO DE FECHA — Ninguna estación antes de fecha_inicio
 * REGLA 2: BLOQUEO DURO — cap_max es límite absoluto, cero tolerancia
 * REGLA 3: DRUM — El cuello de botella marca el ritmo (agenda primero)
 * REGLA 4: ROPE — Estaciones previas amarradas al día del cuello
 * REGLA 5: PRIORITY QUEUE — Se procesa de mayor a menor prioridad:
 *          4=Reposición > 3=Urgencia > 2=Express > 1=Normal
 *
 * Columnas BD: estaciones_maestras.cap_max (m2/día), cuello_botella (bool)
 * NO CONFUNDIR con produccion_maquinas.capacidad_max_m2_dia (otra tabla)
 */
async function autoAsignarPendientes({ dias = 14, inicio } = {}) {
  const fechaMinima = inicio || new Date().toISOString().split('T')[0];

  // ═══════════════════════════════════════════════════════════════
  // 1. CARGAR ESTACIONES (cap_max en m2, cuello_botella flag)
  // ═══════════════════════════════════════════════════════════════
  const allEstRes = await query(`
    SELECT id, nombre_estacion, cap_max, cuello_botella, orden_secuencia_defecto
    FROM estaciones_maestras WHERE activa = TRUE
    ORDER BY orden_secuencia_defecto
  `);
  const estMap = {};
  for (const e of allEstRes.rows) {
    estMap[e.id] = {
      cap: Number(e.cap_max) || 0,
      nombre: e.nombre_estacion,
      orden: e.orden_secuencia_defecto,
      esCuello: !!e.cuello_botella
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. CARGA ACTUAL POR ESTACIÓN POR DÍA (dedup por orden)
  // ═══════════════════════════════════════════════════════════════
  const cargaRes = await query(
    `SELECT cp.fecha_programada, cp.estacion_id, cp.orden_produccion_id, cp.m2_asignados
     FROM cola_produccion_pasos cp
     WHERE cp.fecha_programada IS NOT NULL AND cp.estado != 'TERMINADO'`
  );
  const cargaMap = {};
  const cargaDedup = {};
  for (const r of cargaRes.rows) {
    const fs = fmt(new Date(r.fecha_programada));
    const dk = fs + '|' + r.estacion_id + '|' + r.orden_produccion_id;
    if (cargaDedup[dk]) continue;
    cargaDedup[dk] = true;
    const sk = fs + '|' + r.estacion_id;
    cargaMap[sk] = (cargaMap[sk] || 0) + (Number(r.m2_asignados) || 0);
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
  // 4. CAPACIDAD POR GRUPO
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
     ORDER BY COALESCE(o.nivel_prioridad, 1) DESC, o.created_at ASC`
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

  /**
   * REGLA 2: BLOQUEO DURO — ¿Cabe el consumo en la estación ese día?
   * Cero tolerancia. Si carga_actual + consumo > cap_max → NO.
   */
  function cabeEnDia(estId, fecha, consumoM2) {
    const est = estMap[estId];
    if (!est || est.cap <= 0) return true;
    const actual = cargaMap[fecha + '|' + estId] || 0;
    return (actual + consumoM2) <= est.cap;
  }

  /**
   * Agregar consumo al mapa de carga (actualiza en memoria)
   */
  function agregarCarga(fecha, estId, consumoM2) {
    const sk = fecha + '|' + estId;
    cargaMap[sk] = (cargaMap[sk] || 0) + consumoM2;
  }

  /**
   * REGLA 3: DRUM — Buscar primer día para el cuello de botella
   * Donde la estación cuello tenga capacidad para el consumo del pedido.
   */
  function drumFindDate(route, consumoM2, fechaMin) {
    let cuelloId = route.find(id => estMap[id] && estMap[id].esCuello);
    if (!cuelloId) cuelloId = route[0];
    if (!cuelloId) return { fecha: null, estId: null };

    for (let i = 0; i < dias; i++) {
      const d = new Date(fechaMin + 'T00:00:00');
      d.setDate(d.getDate() + i);
      const fs = fmt(d);
      if (!esLaboral(fs)) continue;
      if (cabeEnDia(cuelloId, fs, consumoM2)) {
        return { fecha: fs, estId: cuelloId };
      }
    }
    return { fecha: null, estId: cuelloId };
  }

  /**
   * REGLA 3: DRUM — Capacidad máxima del cuello en un día
   */
  function drumMaxDia(route, fecha) {
    const cuelloId = route.find(id => estMap[id] && estMap[id].esCuello) || route[0];
    const est = estMap[cuelloId];
    if (!est || est.cap <= 0) return Infinity;
    const actual = cargaMap[fecha + '|' + cuelloId] || 0;
    return Math.max(0, est.cap - actual);
  }

  /**
   * REGLA 4: ROPE — Cascada hacia adelante (después del cuello)
   * NO modifica cargaMap — solo computa asignaciones.
   * Retorna array de { estId, fecha } para applyCascade().
   */
  function forwardRope(route, cuelloIdx, drumFecha, consumoM2) {
    const resultado = [];
    let fechaMinima = drumFecha;
    const cargaLocal = {};

    for (let i = cuelloIdx + 1; i < route.length; i++) {
      const estId = route[i];
      const est = estMap[estId];
      if (!est || est.cap <= 0) { resultado.push({ estId, fecha: null }); continue; }

      const diaInicio = siguienteDiaHabil(fechaMinima);
      let fechaAsignada = null;

      for (let offset = 0; offset < dias; offset++) {
        const d = new Date(diaInicio + 'T00:00:00');
        d.setDate(d.getDate() + offset);
        const fs = fmt(d);
        if (!esLaboral(fs)) continue;
        const actualReal = (cargaMap[fs + '|' + estId] || 0) + (cargaLocal[fs + '|' + estId] || 0);
        if (actualReal + consumoM2 <= est.cap) {
          fechaAsignada = fs;
          cargaLocal[fs + '|' + estId] = (cargaLocal[fs + '|' + estId] || 0) + consumoM2;
          break;
        }
      }

      if (fechaAsignada) fechaMinima = fechaAsignada;
      resultado.push({ estId, fecha: fechaAsignada });
    }
    return resultado;
  }

  /**
   * REGLA 4: ROPE — Cascada hacia atrás (antes del cuello)
   * NO modifica cargaMap — solo computa asignaciones.
   * REGLA 1: Nunca antes de fechaMinima.
   */
  function backwardRope(route, cuelloIdx, drumFecha, consumoM2, fechaMinima) {
    const resultado = [];
    let fechaMaxima = drumFecha;
    const cargaLocal = {};

    for (let i = cuelloIdx - 1; i >= 0; i--) {
      const estId = route[i];
      const est = estMap[estId];
      if (!est || est.cap <= 0) { resultado.unshift({ estId, fecha: null }); continue; }

      const diaLimite = anteriorDiaHabil(fechaMaxima);
      let fechaAsignada = null;

      for (let offset = 0; offset < dias; offset++) {
        const d = new Date(diaLimite + 'T00:00:00');
        d.setDate(d.getDate() - offset);
        const fs = fmt(d);
        if (fs < fechaMinima) break;
        if (!esLaboral(fs)) continue;
        const actualReal = (cargaMap[fs + '|' + estId] || 0) + (cargaLocal[fs + '|' + estId] || 0);
        if (actualReal + consumoM2 <= est.cap) {
          fechaAsignada = fs;
          cargaLocal[fs + '|' + estId] = (cargaLocal[fs + '|' + estId] || 0) + consumoM2;
          break;
        }
      }

      if (fechaAsignada) fechaMaxima = fechaAsignada;
      resultado.unshift({ estId, fecha: fechaAsignada });
    }
    return resultado;
  }

  // ═══════════════════════════════════════════════════════════════
  // 7. PRE-PROCESAR BOM SIBLINGS (Armado conjunto)
  // ═══════════════════════════════════════════════════════════════
  const asignados = [];
  const noAsignados = [];
  const bomGroups = {};
  const bomProcessedIds = new Set();
  for (const o of pendRes.rows) {
    if (o.es_compuesto && o.bom_padre_id) {
      if (!bomGroups[o.bom_padre_id]) bomGroups[o.bom_padre_id] = [];
      bomGroups[o.bom_padre_id].push(o);
    }
  }

  for (const [bomPadreId, siblings] of Object.entries(bomGroups)) {
    if (siblings.length < 2) continue;

    const totalM2Grupo = siblings[0] ? (Number(siblings[0].metros_cuadrados) || 0) : 0;
    const totalKgGrupo = siblings.reduce((s, o) => s + (Number(o.kilos) || 0), 0);
    const grupo = padreGrupoMap[bomPadreId] || siblings[0].grupo;

    if (!grupo || totalM2Grupo <= 0) continue;

    // Obtener ruta del primer hermano para encontrar Armado
    const rutaRes = await query(
      'SELECT estacion_id FROM cola_produccion_pasos WHERE orden_produccion_id = $1 ORDER BY orden_secuencia',
      [siblings[0].id]
    );
    const route = rutaRes.rows.map(r => r.estacion_id);
    if (route.length === 0) continue;

    // Buscar estación Armado en la ruta
    const armadoEstId = route.find(id => estMap[id] && estMap[id].nombre === 'Armado');
    if (!armadoEstId) continue;

    // Buscar día donde Armado tenga capacidad para el total del grupo
    let drumFechaGrupo = null;
    for (let i = 0; i < dias; i++) {
      const d = new Date(fechaMinima + 'T00:00:00');
      d.setDate(d.getDate() + i);
      const fs = fmt(d);
      if (!esLaboral(fs)) continue;
      if (cabeEnDia(armadoEstId, fs, totalM2Grupo)) {
        drumFechaGrupo = fs;
        break;
      }
    }

    if (!drumFechaGrupo) continue;

    // Asignar TODOS los hermanos en el mismo día de Armado
    agregarCarga(drumFechaGrupo, armadoEstId, totalM2Grupo);

    // Para cada hermano: Corte puede ser antes, Armado es el día común
    for (const sib of siblings) {
      const sibRoute = route;
      const sibM2 = Number(sib.metros_cuadrados) || 0;
      const sibKg = Number(sib.kilos) || 0;
      const sibCantidad = Number(sib.cantidad) || 1;

      // Backward desde Armado para estaciones previas (Corte)
      const armadoIdx = sibRoute.indexOf(armadoEstId);
      const backward = armadoIdx > 0 ? backwardRope(sibRoute, armadoIdx, drumFechaGrupo, sibM2, fechaMinima) : [];

      const estFechas = {};
      estFechas[armadoEstId] = drumFechaGrupo;
      for (const a of backward) if (a.fecha) {
        estFechas[a.estId] = a.fecha;
        agregarCarga(a.fecha, a.estId, sibM2);
      }

      const fechas = Object.values(estFechas);
      const fechaPrimera = fechas.sort()[0];
      const fechaUltima = fechas.sort().pop();

      await query(`UPDATE produccion_ordenes SET fecha_programada = $1, fecha_entrega_pactada = $2, estado_programacion = 'PROGRAMADO' WHERE id = $3`, [fechaPrimera, fechaUltima, sib.id]);
      for (const estId of sibRoute) {
        if (estFechas[estId]) {
          await query(`UPDATE cola_produccion_pasos SET fecha_programada = $1, m2_asignados = $2 WHERE orden_produccion_id = $3 AND estacion_id = $4`, [estFechas[estId], sibM2, sib.id, estId]);
        }
      }

      if (!cargaGrupoMap[fechaPrimera]) cargaGrupoMap[fechaPrimera] = {};
      cargaGrupoMap[fechaPrimera][grupo] = (cargaGrupoMap[fechaPrimera][grupo] || 0) + sibKg;

      bomProcessedIds.add(sib.id);
      asignados.push({ orden_id: sib.id, fecha: fechaPrimera, fecha_entrega: fechaUltima, grupo, kg: sibKg, unidades: sibCantidad, nota: 'BOM grupo (' + siblings.length + ' hermanos)' });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 8. PROCESAR PENDIENTES RESTANTES
  // ═══════════════════════════════════════════════════════════════
  const splitLetters = {};

  for (let idx = 0; idx < pendRes.rows.length; idx++) {
    const o = pendRes.rows[idx];
    if (bomProcessedIds.has(o.id)) continue;

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

    const consumoM2 = m2;
    const cuelloIdx = route.findIndex(id => estMap[id] && estMap[id].esCuello);
    const drumEstId = cuelloIdx >= 0 ? route[cuelloIdx] : route[0];

    // ─── REINTENTAR: probar múltiples días del drum ───
    let asignado = false;
    for (let drumTry = 0; drumTry < dias && !asignado; drumTry++) {
      const dTry = new Date(fechaMinima + 'T00:00:00');
      dTry.setDate(dTry.getDate() + drumTry);
      const drumFecha = fmt(dTry);
      if (!esLaboral(drumFecha)) continue;

      // ¿El cuello tiene capacidad este día?
      if (!cabeEnDia(drumEstId, drumFecha, consumoM2)) continue;

      const maxEnCuello = drumMaxDia(route, drumFecha);
      if (consumoM2 > maxEnCuello && maxEnCuello > 0) {
        // Split parcial en el cuello
        const unitsAsignadas = Math.floor(maxEnCuello / (consumoM2 / cantidad));
        if (unitsAsignadas < 1) continue;
        const m2Parcial = (consumoM2 / cantidad) * unitsAsignadas;
        const kgParcial = (kg / cantidad) * unitsAsignadas;
        const resto = cantidad - unitsAsignadas;

        const backward = cuelloIdx > 0 ? backwardRope(route, cuelloIdx, drumFecha, m2Parcial, fechaMinima) : [];
        if (!backward.every(a => a.fecha !== null)) continue;

        const forward = cuelloIdx >= 0 ? forwardRope(route, cuelloIdx, drumFecha, m2Parcial) : (route.length > 1 ? forwardRope(route, 0, drumFecha, m2Parcial) : []);
        if (!forward.every(a => a.fecha !== null)) continue;

        // ✅ Todo encaja — aplicar cargas
        agregarCarga(drumFecha, drumEstId, m2Parcial);
        for (const a of backward) if (a.fecha) agregarCarga(a.fecha, a.estId, m2Parcial);
        for (const a of forward) if (a.fecha) agregarCarga(a.fecha, a.estId, m2Parcial);

        const estFechas = {};
        estFechas[drumEstId] = drumFecha;
        for (const a of forward) if (a.fecha) estFechas[a.estId] = a.fecha;
        for (const a of backward) if (a.fecha) estFechas[a.estId] = a.fecha;

        const fechas = Object.values(estFechas);
        const fechaPrimera = fechas.sort()[0];
        const fechaUltima = fechas.sort().pop();

        const origPedido = o.pedido_sap_id || '';
        if (!splitLetters[origPedido]) splitLetters[origPedido] = 0;
        splitLetters[origPedido]++;
        const letterA = String.fromCharCode(64 + splitLetters[origPedido]);
        const letterB = String.fromCharCode(65 + splitLetters[origPedido]);

        await query(
          `UPDATE produccion_ordenes SET fecha_programada = $1, fecha_entrega_pactada = $2, estado_programacion = 'PROGRAMADO', cantidad = $3, kilos = $4, metros_cuadrados = $5, pedido_sap_id = $6 WHERE id = $7`,
          [fechaPrimera, fechaUltima, unitsAsignadas, kgParcial, m2Parcial, origPedido + letterA, o.id]
        );
        for (const estId of route) {
          await query(`UPDATE cola_produccion_pasos SET fecha_programada = $1, m2_asignados = $2 WHERE orden_produccion_id = $3 AND estacion_id = $4`, [estFechas[estId], m2Parcial, o.id, estId]);
        }

        const kgPorUnidad = kg / cantidad;
        const m2PorUnidad = m2 / cantidad;
        const nuevaRes = await query(
          `INSERT INTO produccion_ordenes (pedido_sap_id, cliente, codigo_producto, descripcion, ancho, alto, familia_id, espesor_mm, tipo_venta, item_numero, nota, posicion, orden_compra, tipo_entrega, grupo, codigo_padre, bom_padre_id, es_compuesto, cantidad, kilos, metros_cuadrados, estado_programacion, fecha_programada, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,'PENDIENTE',NULL,NOW()) RETURNING id`,
          [origPedido + letterB, o.cliente, o.codigo_producto, o.descripcion, o.ancho, o.alto, o.familia_id, o.espesor_mm, o.tipo_venta, o.item_numero, o.nota, o.posicion, o.orden_compra, o.tipo_entrega, o.grupo, o.codigo_padre, o.bom_padre_id, o.es_compuesto, resto, kgPorUnidad * resto, m2PorUnidad * resto]
        );
        const nuevaOrdenId = nuevaRes.rows[0].id;
        const pasosRes = await query('SELECT estacion_id, orden_secuencia FROM cola_produccion_pasos WHERE orden_produccion_id = $1', [o.id]);
        for (const p of pasosRes.rows) {
          await query(`INSERT INTO cola_produccion_pasos (orden_produccion_id, estacion_id, orden_secuencia) VALUES ($1, $2, $3)`, [nuevaOrdenId, p.estacion_id, p.orden_secuencia]);
        }

        if (!cargaGrupoMap[fechaPrimera]) cargaGrupoMap[fechaPrimera] = {};
        cargaGrupoMap[fechaPrimera][grupo] = (cargaGrupoMap[fechaPrimera][grupo] || 0) + kgParcial;

        pendRes.rows.push({ ...o, id: nuevaOrdenId, cantidad: resto, kilos: kgPorUnidad * resto, metros_cuadrados: m2PorUnidad * resto, estado_programacion: 'PENDIENTE', fecha_programada: null });

        asignados.push({ orden_id: o.id, fecha: fechaPrimera, fecha_entrega: fechaUltima, grupo, kg: kgParcial, unidades: unitsAsignadas, nota: 'Split parcial' });
        asignado = true;

      } else if (consumoM2 <= maxEnCuello) {
        // ═══ ASIGNACIÓN COMPLETA ═══
        const backward = cuelloIdx > 0 ? backwardRope(route, cuelloIdx, drumFecha, consumoM2, fechaMinima) : [];
        if (!backward.every(a => a.fecha !== null)) continue;

        const forward = cuelloIdx >= 0 ? forwardRope(route, cuelloIdx, drumFecha, consumoM2) : (route.length > 1 ? forwardRope(route, 0, drumFecha, consumoM2) : []);
        if (!forward.every(a => a.fecha !== null)) continue;

        // ✅ Todo encaja — aplicar cargas
        agregarCarga(drumFecha, drumEstId, consumoM2);
        for (const a of backward) if (a.fecha) agregarCarga(a.fecha, a.estId, consumoM2);
        for (const a of forward) if (a.fecha) agregarCarga(a.fecha, a.estId, consumoM2);

        const estFechas = {};
        estFechas[drumEstId] = drumFecha;
        for (const a of forward) if (a.fecha) estFechas[a.estId] = a.fecha;
        for (const a of backward) if (a.fecha) estFechas[a.estId] = a.fecha;

        const fechas = Object.values(estFechas);
        const fechaPrimera = fechas.sort()[0];
        const fechaUltima = fechas.sort().pop();

        await query(`UPDATE produccion_ordenes SET fecha_programada = $1, fecha_entrega_pactada = $2, estado_programacion = 'PROGRAMADO' WHERE id = $3`, [fechaPrimera, fechaUltima, o.id]);
        for (const estId of route) {
          await query(`UPDATE cola_produccion_pasos SET fecha_programada = $1, m2_asignados = $2 WHERE orden_produccion_id = $3 AND estacion_id = $4`, [estFechas[estId], consumoM2, o.id, estId]);
        }

        if (!cargaGrupoMap[fechaPrimera]) cargaGrupoMap[fechaPrimera] = {};
        cargaGrupoMap[fechaPrimera][grupo] = (cargaGrupoMap[fechaPrimera][grupo] || 0) + kg;

        asignados.push({ orden_id: o.id, fecha: fechaPrimera, fecha_entrega: fechaUltima, grupo, kg, unidades: cantidad });
        asignado = true;
      }
    }

    if (!asignado) {
      noAsignados.push({ orden_id: o.id, pedido: o.pedido_sap_id, motivo: 'Sin capacidad en los próximos ' + dias + ' días (cuello + previas)', grupo, kg_total: kg, m2_total: m2 });
    }
  }

  return { asignados, noAsignados, total_procesados: pendRes.rows.length };
}

module.exports = { autoAsignarPendientes };
