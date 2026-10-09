/**
 * RUTAS R2 LEGADAS (/api/r2/upload, /api/r2/direct-upload, /api/r2/test) — RETIRADAS.
 *
 * ── Vulnerabilidad (motivo principal del retiro) ─────────────────────────────
 * /api/r2/direct-upload pasaba 'fileName' sin sanitizar a config/r2.js
 * (r2CurlUpload), que lo incorpora a un comando de shell vía exec() para llamar
 * a curl. El quoting del comando es de comillas simples y encodeURIComponent()
 * NO escapa la comilla simple, así que un fileName como  x'.pdf'...  rompe el
 * quoting y permite ejecución de comandos arbitrarios en el servidor. Además
 * r2CurlUpload escribe en '/tmp' (no existe en Windows) y arma el curl con
 * comillas simples que cmd.exe tampoco interpreta: el código era inviable aquí.
 *
 * ── Consumidores verificados (oct-2026): NINGUNO real ────────────────────────
 *  - web/public/js/modules/pedidos.js (frontend actual, SPA de /app.html): sube
 *    el PDF como BYTEA en multipart a POST /api/pedidos. No llama a /api/r2/*.
 *  - web/public/pedidos/index.html (página legada, huérfana igual que
 *    /inventario/, que ya fue eliminada): llama a /api/r2/upload pero espera
 *    { uploadUrl, headers }, respuesta que este API NUNCA devolvió (devolvía
 *    { key, url }), o sea su flujo de subida ya estaba roto. Usa además el
 *    permiso inexistente 'pedidos.autorizar' (hoy: pedidos.agregar/editar/eliminar).
 *  - /api/r2/direct-upload y /api/r2/test no tienen ningún llamador en el repo.
 *
 * ── Decisión ────────────────────────────────────────────────────────────────
 * Se retiran los tres endpoints dejando este router VACÍO, en vez de editar
 * routes/router.js, para no pisar los archivos de los agentes que trabajan en
 * paralelo (el alcance de edición era solo pedidos.js / r2Legacy.js /
 * validate.js). El efecto es el mismo que desmontarlo: routes/router.js:22
 * (`router.use(require('./r2Legacy'))`) puede borrarse sin ningún otro cambio.
 *
 * ── Riesgo residual FUERA de este alcance (dejar con su dueño) ──────────────
 * routes/r2Storage.js + services/r2Storage.js + config/r2.js siguen exponiendo
 * /api/r2/* (presign-*, download, delete) y services/r2Storage.js llama a
 * r2CurlDelete → exec() de shell con el mismo patrón de quoting. Requieren la
 * misma revisión: sanitizar fileName ([a-zA-Z0-9._-], sin separadores de ruta)
 * y reemplazar exec() por una petición HTTP firmada (fetch/https nativo).
 */

const express = require('express');
const router = express.Router();

// Sin rutas registradas: ver documentación superior.
module.exports = router;
