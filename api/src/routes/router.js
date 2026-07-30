const { handleSigmaExtended } = require('./sigmaExtended');
const { handleTurnosExtended } = require('./turnosExtended');
const { handleInstalaciones } = require('./instalaciones');
const { handleProduccionOrdenes } = require('./produccionOrdenes');
const { handleProduccionConfig } = require('./produccionConfig');
const { handleProduccionCatalogos } = require('./produccionCatalogos');
const { handleProduccionPlanificacion } = require('./produccionPlanificacion');
const { handleTaller } = require('./taller');
const { handleAdminUsuarios } = require('./adminUsuarios');
const { handleR2Storage } = require('./r2Storage');
const { handleAuth, handleHealth, handleUsuarios } = require('./authRoutes');
const { handleCatalogos, handleInventario } = require('./catalogosInventario');
const { handleSigmaRoutes, handleTurnosRoutes } = require('./sigmaTurnosRoutes');
const { handleR2Legacy } = require('./r2Legacy');
const { handlePedidos } = require('./pedidos');

const handlers = [
    handleSigmaExtended,
    handleTurnosExtended,
    handleInstalaciones,
    handleProduccionOrdenes,
    handleProduccionConfig,
    handleProduccionCatalogos,
    handleProduccionPlanificacion,
    handleTaller,
    handleAdminUsuarios,
    handleR2Storage,
    handleAuth,
    handleHealth,
    handleUsuarios,
    handleCatalogos,
    handleInventario,
    handleSigmaRoutes,
    handleTurnosRoutes,
    handleR2Legacy,
    handlePedidos,
];

async function handleRoute(req, res, urlPath, q) {
    for (const handler of handlers) {
        if (await handler(req, res, urlPath, q)) return true;
    }
    return false;
}

module.exports = { handleRoute };
