/**
 * Middleware para envolver handlers async y capturar errores automáticamente.
 * Reemplaza los try/catch repetidos en los routes.
 *
 * Uso:
 *   router.get('/ruta', canView, asyncHandler(async (req, res) => {
 *       res.json(await service.getData());
 *   }));
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { asyncHandler };
