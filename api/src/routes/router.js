const express = require('express');
const router = express.Router();

router.use(require('./authRoutes'));
router.use(require('./catalogosInventario'));
router.use(require('./sigmaExtended'));
router.use(require('./sigmaTurnosRoutes'));
router.use(require('./turnosExtended'));
router.use(require('./instalaciones'));
router.use(require('./produccionOrdenes'));
router.use(require('./produccionConfig'));
router.use(require('./produccionCatalogos'));
router.use(require('./produccionPlanificacion'));
router.use(require('./produccionReportes'));
router.use(require('./produccionProgEstacion'));
router.use(require('./taller'));
router.use(require('./tallerInspecciones'));
router.use(require('./tallerMetricas'));
router.use(require('./bodega'));
router.use(require('./adminUsuarios'));
// R2 LEGACY RETIRADO (seguridad): r2Legacy (upload por curl+exec) y r2Storage
// (delete por exec) permitían inyección de comandos vía fileName/key y no tenían
// consumidores en la app actual (los PDFs viajan como BYTEA en pedidos). El
// código queda en el repo documentado, pero sin montar.
router.use(require('./pedidos'));
router.use(require('./asistencia'));
router.use(require('./maintenance'));
router.use(require('./costeo'));
router.use(require('./reclamos'));

module.exports = router;
