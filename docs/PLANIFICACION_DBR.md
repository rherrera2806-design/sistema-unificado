# Planificación Auto-Asignar — Drum-Buffer-Rope (DBR)

> **ARCHIVO CRÍTICO:** `api/src/services/planificacionAuto.js`
> **Última revisión:** Agosto 2026
> **No modificar sin leer esta documentación completa.**

---

## Resumen del Algoritmo

El sistema de auto-asignación usa la metodología **Drum-Buffer-Rope (TOC)** para
distribuir órdenes de producción respetando capacidad real de cada estación.

### Las 4 Reglas Inviolables

| # | Regla | Implementación |
|---|---|---|
| 1 | **PISO DE FECHA** | Ninguna estación se agenda antes de `fecha_inicio_solicitada`. `backwardRope` hace `break` si `fs < fechaMinima`. |
| 2 | **BLOQUEO DURO** | `cabeEnDia()` verifica `actual + consumo <= cap_max` **sin tolerancia**. Si supera, el día queda bloqueado. |
| 3 | **DRUM** | El cuello de botella (`cuello_botella=TRUE`) se agenda PRIMERO. Define el "Día Cero" del pedido. |
| 4 | **ROPE** | Estaciones previas se programan ANTES del cuello (cascada hacia atrás). Estaciones posteriores DESPUÉS (cascada hacia adelante). |

---

## Schema de BD Relevante

### `estaciones_maestras`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | SERIAL PK | ID de la estación |
| `nombre_estacion` | VARCHAR(50) | Nombre (Corte, Pulido, Ventana, etc.) |
| `orden_secuencia_defecto` | INTEGER | Orden en la línea de producción |
| `cap_max` | DECIMAL(10,2) | **Capacidad máxima en m²/día** |
| `cuello_botella` | BOOLEAN | **TRUE = estación limitante (DRUM)** |
| `activa` | BOOLEAN | Si está operativa |

> ⚠️ **NO CONFUNDIR** con `produccion_maquinas.capacidad_max_m2_dia` (otra tabla).
> Las columnas renombradas son SOLO de `estaciones_maestras`.

### `cola_produccion_pasos`

| Columna | Tipo | Descripción |
|---|---|---|
| `orden_produccion_id` | INTEGER FK | Orden de producción |
| `estacion_id` | INTEGER FK | Estación asignada |
| `orden_secuencia` | INTEGER | Posición en la ruta |
| `fecha_programada` | DATE | **Fecha asignada por DBR (cada paso tiene la SUYA)** |
| `m2_asignados` | DECIMAL | m² asignados a este paso |
| `estado` | VARCHAR(20) | PENDIENTE / EN_PROCESO / TERMINADO |

### `produccion_ordenes`

| Columna | Tipo | Descripción |
|---|---|---|
| `fecha_programada` | DATE | **Primera estación de la ruta** (inicio producción) |
| `fecha_entrega_pactada` | DATE | **Última estación de la ruta** (fin producción) |
| `estado_programacion` | VARCHAR(20) | PENDIENTE / PROGRAMADO / CERRADO / TERMINADO |

---

## Flujo del Algoritmo

```
Para cada orden PENDIENTE (orden por created_at):

1. OBTENER RUTA
   SELECT estacion_id FROM cola_produccion_pasos
   WHERE orden_produccion_id = ? ORDER BY orden_secuencia

2. IDENTIFICAR CUELLO DE BOTELLA
   cuelloIdx = primer estación con cuello_botella=TRUE en la ruta
   drumEstId = route[cuelloIdx] (o route[0] si no hay cuello)

3. REINTENTAR (loop de 0 a dias):
   Para cada día candidato desde fechaMinima:

   a. ¿El cuello tiene capacidad este día?
      cabeEnDia(drumEstId, drumFecha, consumoM2) → hard stop

   b. backwardRope(): estaciones ANTES del cuello
      - Busca día = drumFecha - 1 (hábil)
      - REGLA 1: No antes de fechaMinima
      - NO modifica cargaMap (computa sin efectos secundarios)

   c. forwardRope(): estaciones DESPUÉS del cuello
      - Busca día = drumFecha + 1 (hábil)
      - NO modifica cargaMap

   d. Si TODAS las estaciones tienen fecha → APLICAR CARGAS
      agregarCarga() para: drum + backward + forward

   e. Si alguna estación no tiene fecha → continue (probar siguiente día)

4. ACTUALIZAR BD (solo si asignación exitosa):
   - produccion_ordenes: fecha_programada = primera, fecha_entrega_pactada = última
   - cola_produccion_pasos: cada paso con SU fecha_programada individual

5. SPLIT (si el cuello solo acepta una parte):
   - Asignar lo que cabe
   - Crear nueva orden para el resto con sufijo de letra
```

---

## Funciones Clave

### `cabeEnDia(estId, fecha, consumoM2)`
```
REGLA 2: BLOQUEO DURO
retorna (cargaMap[fecha|estId] + consumoM2) <= est.cap
Sin tolerancia. Sin decimales.
```

### `drumFindDate(route, consumoM2, fechaMin)`
```
REGLA 3: DRUM
Busca primer día >= fechaMin donde el cuello tiene capacidad.
```

### `backwardRope(route, cuelloIdx, drumFecha, consumoM2, fechaMinima)`
```
REGLA 4: ROPE (hacia atrás)
- Para cada estación ANTES del cuello:
  - Busca último día hábil con capacidad
  - REGLA 1: Se detiene en fechaMinima
- NO modifica cargaMap (usa cargaLocal interna)
- Retorna [{ estId, fecha }] — null si no encontró
```

### `forwardRope(route, cuelloIdx, drumFecha, consumoM2)`
```
REGLA 4: ROPE (hacia adelante)
- Para cada estación DESPUÉS del cuello:
  - Busca primer día hábil con capacidad
- NO modifica cargaMap (usa cargaLocal interna)
- Retorna [{ estId, fecha }] — null si no encontró
```

### `agregarCarga(fecha, estId, consumoM2)`
```
Solo se llama DESPUÉS de verificar que toda la ruta es válida.
Modifica cargaMap para que las siguientes órdenes vean la carga real.
```

---

## Carga en Memoria (`cargaMap`)

```javascript
cargaMap['2026-08-10|5'] = 45.5  // fecha|estacion_id = m2 acumulados
```

**Reglas de uso:**
- Se carga INICIALMENTE desde `cola_produccion_pasos` (con dedup por orden)
- Se ACTUALIZA solo cuando una asignación es confirmada (todas las estaciones OK)
- `forwardRope` y `backwardRope` NO lo modifican (usan `cargaLocal` interna)

---

## Estaciones de Referencia (Cuellos de Botella)

| Estación | cap_max | cuello_botella | Notas |
|---|---|---|---|
| Corte | 450 m² | No | Primera estación |
| Corte Laminado | 100 m² | No | |
| Pulido Rectilinea | 350 m² | No | |
| Pulido CNC | 100 m² | **Sí** | Cuello |
| Pulido Manual | 100 m² | No | |
| Radio Manual | 100 m² | **Sí** | Cuello |
| Mecanizado | 150 m² | **Sí** | Cuello |
| Ventana | 45 m² | **Sí** | Cuello más restrictivo |
| Pintado Arq | 100 m² | **Sí** | Cuello |
| Pintado Car | 150 m² | **Sí** | Cuello |
| Templado | 400 m² | No | |
| Laminado VM | 100 m² | No | |
| Armado | 100 m² | No | Última estación |

---

## Errores Comunes y Causas

| Error | Causa | Solución |
|---|---|---|
| "Sin capacidad en los próximos X días" | El cuello no tiene espacio en ningún día | Verificar `cap_max` en BD, Limpiar datos viejos |
| "Estación previa sin capacidad" | Backward no encontró día para estación antes del cuello | El reintento automático debería manejarlo |
| `cap_max` es 0 o NULL | Columna no migrada correctamente | Verificar migración en `dbSchema.js` |
| Todo se agenda el mismo día | `cuello_botella` no está en TRUE para la estación correcta | Verificar BD: `SELECT cuello_botella FROM estaciones_maestras` |
| Sobregiro de capacidad | `cabeEnDia` usa tolerancia | **NUNCA** agregar tolerancia a `cabeEnDia` |

---

## Archivos Relacionados (NO TOCAR sin entender)

| Archivo | Función | Relación con DBR |
|---|---|---|
| `api/src/services/planificacionAuto.js` | **ALGORITMO DBR** | Archivo principal |
| `api/src/services/planificacionCapacidad.js` | Consulta de carga semanal | Lee `cap_max`, `cuello_botella` |
| `api/src/services/planificacion.js` | Asignación manual | Usa `cap_max` |
| `api/src/services/produccionConfig.js` | CRUD estaciones | INSERT/UPDATE con `cap_max`, `cuello_botella` |
| `api/src/services/produccionOrdenes.js` | Consulta de órdenes | Subquery con `cuello_botella` |
| `api/src/services/taller.js` | Vista de taller | Lee `cap_max` |
| `api/src/config/dbSchema.js` | Migraciones y seed | ALTER TABLE + data migration |
| `web/public/js/modules/prod_config.js` | UI de estaciones | Muestra `cap_max`, `cuello_botella` |
| `web/public/js/modules/planificacion.js` | UI de planificación | Badge CB para cuellos |

---

## Checklist antes de Modificar

- [ ] ¿El cambio afecta `estaciones_maestras`? → Actualizar `dbSchema.js`
- [ ] ¿El cambio afecta `cola_produccion_pasos`? → Verificar `planificacionAuto.js`
- [ ] ¿El cambio modifica `cap_max` o `cuello_botella`? → Actualizar TODOS los archivos listados arriba
- [ ] ¿El cambio es en el algoritmo DBR? → Releer las 4 reglas antes de modificar
- [ ] ¿Agrega una nueva estación? → Agregar a `estacionesDefault` en `dbSchema.js`
- [ ] ¿Cambia la secuencia de estaciones? → Verificar que `orden_secuencia_defecto` es consistente
