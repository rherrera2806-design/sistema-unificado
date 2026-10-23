// Eventos en vivo (Socket.IO) para el dashboard de planta.
//
// Los endpoints de producción emiten 'dashboard:update' después de cada cambio
// (registro, iniciar/finalizar pasos, mermas, movimientos de planchas). El
// dashboard escucha y refresca sus datos: la pantalla queda siempre al día
// sin hacer polling agresivo.
let io = null;

function setIo(socketIo) { io = socketIo; }

function emitir(tipo, datos = {}) {
    if (!io) return;
    try { io.emit(tipo, datos); } catch (e) { /* el dashboard es best-effort */ }
}

/** Atajo: avisa que cambió algo de producción/inventario. */
function dashboardUpdate(origen) {
    emitir('dashboard:update', { origen, ts: Date.now() });
}

module.exports = { setIo, emitir, dashboardUpdate };
