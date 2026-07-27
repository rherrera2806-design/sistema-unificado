# Informe Tecnico - Modulo de Instalaciones VitroFlow

## 1. Resumen Ejecutivo

El modulo de instalaciones es un sistema completo de gestion de trabajos en terreno para empresas de vidrieria y cristaleria. Permite programar, monitorear y documentar cada instalacion desde la oficina hasta la entrega al cliente, con trazabilidad total.

**Stack tecnologico:** Node.js + PostgreSQL + Socket.IO
**Acceso:** Web responsive (funciona en celular, tablet y desktop)
**Despliegue:** Automatico via GitHub en Railway (vitroflow.up.railway.app)

---

## 2. Funcionalidades Principales

### 2.1 Calendario Mensual
- Vista visual tipo calendario con todas las instalaciones programadas
- Colores por estado: azul (programada), amarillo (en camino/curso), verde (completada), rojo (novedad)
- Navegacion entre meses con un clic
- Estadisticas rapidas: total, programadas, en curso, completadas, novedades

### 2.2 CRUD de Instalaciones
- **Crear:** Formulario con campos: Cliente*, Direccion*, Tecnico, Vendedor, Orden, Descripcion, Fecha*, Hora, Notas Previas
- **Editar:** Mismos campos, disponible desde el detalle
- **Eliminar:** Solo usuarios con permiso, con confirmacion y cascada
- **Validacion:** Campos obligatorios (cliente, direccion, fecha)

### 2.3 Flujo de Estados (Maquina de Estados)
```
PROGRAMADA → EN_CAMINO → EN_CURSO → COMPLETADA
                                    ↓
                              CON_NOVEDADES → (Reanudar) → EN_CURSO
```
- Cada transicion se registra con usuario y timestamp
- Botones contextuales segun el estado actual
- Estados validos: PROGRAMADA, EN_CAMINO, EN_CURSO, COMPLETADA, CON_NOVEDADES, CANCELADA

### 2.4 Navegacion Integrada
- Google Maps: Busca la direccion en Maps con 1 clic
- Waze: Navegacion directa al sitio del cliente
- Links dinamicos basados en el campo direccion

### 2.5 Registro de Novedades
- Descripcion detallada del problema encontrado
- Fotos opcionales del incidente
- Transicion automatica a estado CON_NOVEDADES
- Posibilidad de reanudar y volver a EN_CURSO

### 2.6 Evidencia Fotografica
- Subida multiple de fotos (formato imagen)
- Almacenamiento en base de datos PostgreSQL (BYTEA)
- Visualizacion en galeria con click para ver completa
- Eliminacion individual con confirmacion
- Disponible en estados: EN_CURSO, COMPLETADA, CON_NOVEDADES

### 2.7 Cierre con Conformidad
- Notas de cierre obligatorias
- Firma/nombre del cliente que recibe
- Registro de usuario que cierra
- Timestamp de cierre

### 2.8 Gestion de Tecnicos (CRUD)
- Lista maestra de tecnicos
- Alta, baja y edicion
- Estado activo/inactivo
- Autocompletado en formulario de instalacion

### 2.9 Gestion de Vendedores (CRUD)
- Lista maestra de vendedores
- Misma estructura que tecnicos
- Permite rastrear que vendedor genero cada instalacion

### 2.10 Historial de Auditoria
- Registro inmutable de cada accion:
  - CREADA, EDITADA, CAMBIO_ESTADO, NOVEDAD, CERRADA, FOTOS_SUBIDAS, FOTO_ELIMINADA
- Timestamp + usuario + detalle
- Vista timeline en el detalle de cada instalacion

### 2.11 Busqueda e Historial
- Tabla completa de todas las instalaciones
- Busqueda en tiempo real por: cliente, direccion, tecnico, vendedor, orden
- Filtro por estado
- Acceso rapido al detalle

---

## 3. Arquitectura Tecnica

### 3.1 Base de Datos (PostgreSQL)

| Tabla | Descripcion |
|-------|-------------|
| `instalaciones` | Tabla principal con todos los campos de la instalacion |
| `instalaciones_historial` | Log de auditoria (FK cascada a instalaciones) |
| `instalaciones_fotos` | Almacenamiento de fotos (FK cascada a instalaciones) |
| `tecnicos` | Lista maestra de tecnicos |
| `vendedores` | Lista maestra de vendedores |

### 3.2 Endpoints API

| Metodo | Ruta | Funcion |
|--------|------|---------|
| GET | /api/instalaciones | Listar todas |
| GET | /api/instalaciones/calendario | Rango de fechas |
| GET | /api/instalaciones/:id | Detalle |
| POST | /api/instalaciones | Crear |
| PUT | /api/instalaciones/:id | Editar |
| PUT | /api/instalaciones/:id/estado | Cambiar estado |
| PUT | /api/instalaciones/:id/cerrar | Cerrar con firma |
| DELETE | /api/instalaciones/:id | Eliminar (cascada) |
| POST | /api/instalaciones/:id/fotos | Subir fotos |
| GET | /api/instalaciones/:id/fotos | Listar fotos |
| GET | /api/instalaciones/:id/foto/:fotoId | Ver foto |
| DELETE | /api/instalaciones/:id/foto/:fotoId | Eliminar foto |
| GET | /api/instalaciones/:id/historial | Ver historial |
| GET/POST/PUT/DELETE | /api/produccion/tecnicos | CRUD tecnicos |
| GET/POST/PUT/DELETE | /api/produccion/vendedores | CRUD vendedores |

### 3.3 Permisos de Usuario

| Permiso | Controla |
|---------|----------|
| `instalaciones.nueva` | Boton nueva instalacion, links Maps/Waze |
| `instalaciones.eliminar` | Botones editar, eliminar y eliminar fotos |
| `usuarios` | Superadmin: acceso a todo |

### 3.4 Frontend

- **Modulo principal:** `instalaciones.js` (315 lineas) - Calendario y CRUD
- **Detalle:** `inst_detalle.js` (318 lineas) - Workflow y documentos
- **Historial:** `inst_historial.js` (119 lineas) - Tabla y busqueda

---

## 4. Valor para la Empresa

| Impacto | Beneficio |
|---------|-----------|
| **Operativo** | Elimina coordinacion por WhatsApp/telefono. Vista centralizada. |
| **Legal** | Firma de conformidad + fotos + historial = evidencia ante reclamos |
| **Financiero** | Reduce segundas visitas por falta de informacion |
| **Gerencial** | Metricas de desempeno por tecnico y vendedor |
| **Cliente** | Servicio profesional documentado genera confianza |

---

## 5. Archivos de Presentacion

- **Presentacion HTML:** `docs/presentacion-instalaciones.html` (9 slides, navegar con flechas)
- **Flyer HTML:** `docs/flyer-instalaciones.html` (imagen tipo flyer para impresion/redes)

Ambos archivos son HTML standalone que se pueden abrir en cualquier navegador.
