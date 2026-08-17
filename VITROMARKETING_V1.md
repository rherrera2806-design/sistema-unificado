# 📣 Proyecto: Pagina de Marketing VitroFlow

## Nombre: `VITROMARKETING_V1`

Pagina de ventas/marketing para presentar el sistema VitroFlow a clientes potenciales.

**Archivo:** `docs/vitroflow-architecture.html` (49KB, ~1300 lineas)
**Commit inicial:** `ea78b1c`
**Tecnologia:** HTML puro + CSS + JS vanilla (sin frameworks)

---

## Estructura de la Pagina

### 1. Hero
- Titulo: "VitroFlow"
- Tagline: "La plataforma unificada que transforma la gestion industrial del vidrio"
- Pain hook: "Cansado de gestionar tu planta con Excel y WhatsApp?"
- Stats de dolor: 4.2h diarias, 37% errores, 2.3 dias para reportes
- CTA: "Explorar la Arquitectura"

### 2. Pain Points (6 tarjetas rojas)
- Datos fragmentados (10+ planillas Excel)
- Tiempo perdido (4.2h diarias en tareas manuales)
- Sin visibilidad en tiempo real
- Errores humanos (37% en datos duplicados)
- Comunicacion caotica (WhatsApp para emergencias)
- Crecimiento limitado (sin escalabilidad)

### 3. Solution (6 tarjetas verdes)
- Base de datos unica (reemplaza 10+ planillas)
- Automatizacion de procesos (reemplaza tareas manuales)
- Dashboards en tiempo real (reemplaza reportes manuales)
- Validaciones automaticas (reemplaza errores)
- Flujo centralizado (reemplaza WhatsApp)
- Escalabilidad (crece sin contratar mas gente)

### 4. Arquitectura Interactiva (diagrama hexagonal)
- 8 modulos en hexagonos alrededor de un hub central
- Lineas SVG con puntos animados
- Click en cualquier modulo abre popup centrado
- Datos reales del sistema (47+ tablas, 150+ endpoints, 60+ permisos)

### 5. Web y Movil (3 tarjetas)
- **Version Web** — Desde cualquier navegador, sin instalar
- **Version Movil** — PWA instalable, funciona sin conexion
- **Un Solo Sistema** — Mismos datos en todos los dispositivos

### 6. Precios (3 planes en UF)
- **Starter UF 8/mes** (~$320.000 CLP) — 5 usuarios
- **Professional UF 18/mes** (~$720.000 CLP) — 20 usuarios (DESTACADO)
- **Enterprise UF 32/mes** (~$1.280.000 CLP) — ilimitados

---

## Datos Reales del Sistema (usados en popups)

| Modulo | Tablas DB | Submodulos | Detalle clave |
|--------|-----------|------------|---------------|
| Produccion | 16 | 10 | DBR, SAP import, BOM, 8 estaciones, 4 prioridades |
| SIGMA | 9 | 12 | 6 frecuencias, MTBF/MTTR, repuestos con stock min |
| Instalaciones | 3 | 3 | Fotos, firma cliente, calendario |
| Inventario | 3 | 3 | Stock tiempo real, m2 automatico, autonomia |
| Pedidos | 2 | 1 | Flujo aprobacion, R2 nube, audit trail |
| Turnos | 5 | 6 | QR, cola tiempo real, workflow multi-paso |
| Asistencia | 6 | 1 | Permisos, vacaciones, licencias, horas extras |
| Costeo | 1 | 1 | 20 parametros, 4 tipos proceso, margenes |

**Totales:** 47+ tablas, 150+ endpoints API, 60+ permisos granulares, 8 areas conectadas

---

## Pendiente / Para ajustar

- [ ] Ajustar valores de precios (UF) segun feedback del cliente
- [ ] Agregar testimonios de clientes
- [ ] Agregar seccion "Casos de exito" con metrics reales
- [ ] Agregar video o demo interactiva
- [ ] Traducir a ingles si se necesita
- [ ] Ajustar colores/marca segun identidad visual del cliente
- [ ] Agregar formulario de contacto/leads
- [ ] Optimizar para SEO (meta tags, og:image, etc.)
- [ ] Agregar Analytics para medir conversiones
- [ ] Ajustar copy de dolor segun feedback real de clientes
- [ ] Agregar comparativa con competencia (Excel, SAP basico, etc.)
- [ ] Seccion FAQ