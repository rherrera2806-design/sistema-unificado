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
router.use(require('./adminUsuarios'));
router.use(require('./r2Storage'));
router.use(require('./r2Legacy'));
router.use(require('./pedidos'));
router.use(require('./asistencia'));
router.use(require('./maintenance'));
router.use(require('./migrationFixCantidades'));
router.use(require('./costeo'));
router.use(require('./reclamos'));

module.exports = router;
