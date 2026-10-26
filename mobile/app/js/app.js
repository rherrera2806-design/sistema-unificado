// VitroFlow Planta — vistas y lógica de la app.
// Pantallas: Login → Estaciones → Turno/Máquina → Cola → Escanear/Registro.
import { api, login, logout, getUser, ApiError } from './api.js';
import { getApiBase } from './config.js';
import { parseQR, getTurnoSugerido } from './helpers.js';
import { scanCode } from './scan.js';
import { checkForUpdate, descargarEInstalar } from './update.js';
import { escuchar, parseComandoVoz } from './voice.js';

const state = {
    view: 'login',
    user: null,
    estacion: null,      // { id, nombre }
    maquina: null,       // { id, nombre } | null
    turno: null,         // 'dia' | 'noche' | 'extra'
    cola: [],
    horarios: [],
    filtroPedido: '',
    filtroEspesor: '',
    registroFilas: [],
    registroOrigen: 'manual',
    cargando: false,
};

// ============================ UTILIDADES UI ============================

const $ = (sel) => document.querySelector(sel);

function toast(msg, tipo = '') {
    const el = $('#toast');
    el.textContent = msg;
    el.className = 'toast show' + (tipo ? ' ' + tipo : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.className = 'toast'; }, 3200);
}

function openSheet(titulo, cuerpoHtml, footHtml = '') {
    $('#sheetTitle').textContent = titulo;
    $('#sheetBody').innerHTML = cuerpoHtml;
    $('#sheetFoot').innerHTML = footHtml;
    $('#overlay').classList.add('active');
}
function closeSheet() { $('#overlay').classList.remove('active'); }

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function manejarError(err) {
    if (err instanceof ApiError && err.status === 401) {
        state.user = null;
        renderLogin();
        toast('Sesión expirada. Vuelve a ingresar.', 'err');
        return;
    }
    toast((err && err.message) || 'Error inesperado', 'err');
}

// ============================ LOGIN ============================

function renderLogin() {
    state.view = 'login';
    $('#app').innerHTML = `
        <div class="header">
            <h1>🏭 VitroFlow Planta</h1>
            <div class="sub">Escaneo de etiquetas y registro de producción</div>
        </div>
        <div class="container" style="padding-top:26px">
            <div class="card" style="padding:22px">
                <div class="field">
                    <label>Email</label>
                    <input id="lgEmail" type="email" inputmode="email" autocomplete="username" placeholder="tu@email.com">
                </div>
                <div class="field">
                    <label>Contraseña</label>
                    <input id="lgPass" type="password" autocomplete="current-password" placeholder="••••••••">
                </div>
                <button class="btn btn-primary btn-block" id="lgBtn" onclick="App.doLogin()">Ingresar</button>
            </div>
            <div id="lgVersion" style="text-align:center;font-size:11px;color:#94a3b8;margin-top:14px">VitroFlow Planta</div>
        </div>`;
    $('#lgPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
    // Versión visible en el login: con una captura de pantalla se sabe exactamente
    // qué versión corre en el celular (clave para depurar a distancia)
    fetch('version.json', { cache: 'no-store' })
        .then(r => r.json())
        .then(v => { const el = $('#lgVersion'); if (el && v) el.textContent = `VitroFlow Planta · v${v.versionName} (${v.versionCode})`; })
        .catch(() => { });
}

async function doLogin() {
    const email = $('#lgEmail').value.trim();
    const password = $('#lgPass').value;
    if (!email || !password) { toast('Completa email y contraseña', 'err'); return; }
    const btn = $('#lgBtn');
    btn.disabled = true;
    btn.textContent = 'Ingresando…';
    try {
        state.user = await login(email, password);
        toast(`Bienvenido ${state.user.nombre || state.user.email}`, 'ok');
        await cargarHorarios();
        renderEstaciones();
    } catch (err) {
        manejarError(err);
    } finally {
        if ($('#lgBtn')) { $('#lgBtn').disabled = false; $('#lgBtn').textContent = 'Ingresar'; }
    }
}

// ============================ ESTACIONES ============================

async function renderEstaciones() {
    state.view = 'estaciones';
    state.estacion = null;
    state.maquina = null;
    const u = state.user || getUser();
    $('#app').innerHTML = `
        <div class="header">
            <div class="row">
                <div>
                    <h1>🏭 Estaciones</h1>
                    <div class="sub">${esc(u.nombre || u.email)} · elige dónde vas a trabajar</div>
                </div>
                <button class="back-link" onclick="App.doLogout()">Salir</button>
            </div>
        </div>
        <div class="container" id="estList"><div class="loading">Cargando estaciones…</div></div>`;
    try {
        const estaciones = await api('/api/taller/estaciones');
        if (!estaciones || !estaciones.length) {
            $('#estList').innerHTML = '<div class="empty">No hay estaciones configuradas</div>';
            return;
        }
        $('#estList').innerHTML = estaciones.map(e => {
            const carga = (e.pendientes || 0) + (e.en_proceso || 0);
            const unidades = Number(e.total_unidades || 0);
            const color = carga > 10 ? 'var(--danger)' : carga > 5 ? 'var(--warning)' : 'var(--success)';
            return `
            <div class="card tap" onclick="App.selectEstacion(${Number(e.id)}, '${esc(e.nombre_estacion || e.nombre)}')">
                <div class="q-head">
                    <div class="q-title" style="font-size:16px">${esc(e.nombre_estacion || e.nombre)}</div>
                    <span class="badge" style="background:${color}20;color:${color}">${unidades.toLocaleString('es-CL')} und en cola</span>
                </div>
                <div class="stat-grid">
                    <div class="stat"><div class="v" style="color:var(--primary)">${unidades.toLocaleString('es-CL')}</div><div class="l">Unidades pend.</div></div>
                    <div class="stat"><div class="v" style="color:var(--warning)">${carga}</div><div class="l">Trabajos</div></div>
                    <div class="stat"><div class="v">${e.total_kilos ? Number(Math.round(e.total_kilos)).toLocaleString('es-CL') : 0}</div><div class="l">Kilos</div></div>
                </div>
            </div>`;
        }).join('');
    } catch (err) {
        manejarError(err);
        $('#estList').innerHTML = '<div class="empty">Error al cargar estaciones</div>';
    }
}

async function doLogout() {
    await logout();
    state.user = null;
    renderLogin();
}

// ============================ TURNO / MÁQUINA ============================

function selectEstacion(id, nombre) {
    state.estacion = { id, nombre };
    state.turno = null;
    state.maquina = null;
    mostrarTurno();
}

function mostrarTurno() {
    const sugerido = getTurnoSugerido(state.horarios);
    const opciones = [
        { v: 'dia', t: '☀️ Día', d: '' },
        { v: 'noche', t: '🌙 Noche', d: '' },
        { v: 'extra', t: '⏱️ Extra', d: 'Fuera de los horarios de día/noche' },
    ];
    openSheet('Seleccionar turno', `
        <p style="font-size:13px;color:var(--muted);margin-bottom:14px">¿En qué turno vas a trabajar en <strong>${esc(state.estacion.nombre)}</strong>?</p>
        ${opciones.map(o => `
            <div class="opt ${o.v === sugerido ? 'sel' : ''}" data-turno="${o.v}" onclick="App.pickTurno(this)">
                <div class="t">${o.t} ${o.v === sugerido ? '<span class="badge" style="background:var(--primary);color:#fff;margin-left:6px">Sugerido</span>' : ''}</div>
                ${o.d ? `<div class="d">${o.d}</div>` : ''}
            </div>`).join('')}
    `, `
        <button class="btn btn-outline" onclick="App.closeSheet()">Cancelar</button>
        <button class="btn btn-primary" id="btnTurno" onclick="App.confirmTurno()" ${sugerido ? '' : 'disabled'}>Continuar</button>
    `);
    state.turno = sugerido || null;
}

function pickTurno(el) {
    document.querySelectorAll('.opt').forEach(o => o.classList.remove('sel'));
    el.classList.add('sel');
    state.turno = el.dataset.turno;
    const btn = $('#btnTurno');
    if (btn) btn.disabled = false;
}

function confirmTurno() {
    if (!state.turno) return;
    closeSheet();
    mostrarMaquina();
}

async function mostrarMaquina() {
    openSheet('Seleccionar máquina', '<div class="loading">Cargando máquinas…</div>', '');
    try {
        const maquinas = await api(`/api/taller/maquinas/${state.estacion.id}`);
        if (!maquinas || !maquinas.length) {
            openSheet('Sin máquinas', `
                <p style="font-size:13px;color:var(--muted);text-align:center;padding:8px 0">
                    No hay máquinas configuradas para esta estación. Puedes continuar sin máquina.
                </p>`, `
                <button class="btn btn-outline" onclick="App.closeSheet()">Cancelar</button>
                <button class="btn btn-primary" onclick="App.continuarSinMaquina()">Continuar</button>`);
            return;
        }
        openSheet('Seleccionar máquina', `
            <p style="font-size:13px;color:var(--muted);margin-bottom:14px">Máquina en <strong>${esc(state.estacion.nombre)}</strong></p>
            <div id="maqList">
                ${maquinas.map(m => `
                    <div class="opt" data-id="${Number(m.id)}" data-nombre="${esc(m.nombre)}" onclick="App.pickMaquina(this)">
                        <div class="q-head">
                            <div>
                                <div class="t">${esc(m.nombre)}</div>
                                <div class="d">${esc(m.codigo || 'Sin código')}</div>
                            </div>
                            <div style="text-align:right">
                                <span class="badge" style="background:${m.estado === 'ACTIVA' ? 'rgba(22,163,74,.15)' : 'rgba(220,38,38,.15)'};color:${m.estado === 'ACTIVA' ? 'var(--success)' : 'var(--danger)'}">${esc(m.estado || '')}</span>
                                ${m.capacidad_max_m2_dia ? `<div class="d">${Number(m.capacidad_max_m2_dia).toLocaleString('es-CL')} m²/día</div>` : ''}
                            </div>
                        </div>
                    </div>`).join('')}
            </div>`, `
            <button class="btn btn-outline" onclick="App.closeSheet()">Cancelar</button>
            <button class="btn btn-primary" id="btnMaq" onclick="App.confirmMaquina()" disabled>Continuar</button>`);
    } catch (err) {
        manejarError(err);
        closeSheet();
    }
}

function pickMaquina(el) {
    document.querySelectorAll('.opt').forEach(o => o.classList.remove('sel'));
    el.classList.add('sel');
    state.maquina = { id: Number(el.dataset.id), nombre: el.dataset.nombre };
    const btn = $('#btnMaq');
    if (btn) btn.disabled = false;
}

function confirmMaquina() {
    if (!state.maquina) return;
    closeSheet();
    renderCola();
}

function continuarSinMaquina() {
    state.maquina = null;
    closeSheet();
    renderCola();
}

// ============================ COLA ============================

function headersTurno() {
    return state.turno ? { 'X-Turno': state.turno } : {};
}

async function cargarHorarios() {
    try {
        const data = await api('/api/taller/horarios');
        if (Array.isArray(data)) state.horarios = data;
    } catch (_) { }
}

async function renderCola() {
    state.view = 'cola';
    const est = state.estacion;
    const maq = state.maquina;
    $('#app').innerHTML = `
        <div class="header">
            <div class="row">
                <div>
                    <button class="back-link" onclick="App.volverEstaciones()">← Estaciones</button>
                    <h1 style="margin-top:9px">${esc(est.nombre)}</h1>
                    <div class="sub">
                        ${maq ? '🔧 ' + esc(maq.nombre) + ' · ' : ''}
                        ${state.turno ? '🕐 Turno ' + esc(state.turno) : ''}
                    </div>
                </div>
                <button class="back-link" style="padding:10px 15px;font-size:12.5px;min-height:42px" onclick="App.refreshColaManual()">↻ Actualizar</button>
            </div>
        </div>
        <div class="container" id="colaList"><div class="loading">Cargando cola de trabajo…</div></div>
        <div class="action-bar">
            ${esEstacionCorte() && puedeMovimientos() ? `<button class="btn btn-outline" onclick="App.showMovimientos()">📦 Planchas</button>` : ''}
            <button class="btn btn-outline" onclick="App.showRegistro()">✏️ Registro</button>
            <button class="btn btn-primary" onclick="App.scan()">📷 Escanear</button>
        </div>
        <button onclick="App.voice()" title="Comando de voz"
            style="position:fixed;right:16px;bottom:calc(86px + env(safe-area-inset-bottom, 0px));width:60px;height:60px;border-radius:50%;background:var(--primary);color:#fff;border:none;box-shadow:0 8px 22px rgba(37,99,235,.45);font-size:25px;z-index:61">🎤</button>`;
    await refreshCola();
}

async function refreshCola() {
    try {
        const data = await api(`/api/taller/colaxestacion/${state.estacion.id}`);
        state.cola = Array.isArray(data) ? data : [];
        pintarCola();
    } catch (err) {
        manejarError(err);
    }
}

// Actualizar a mano (botón del header): con confirmación visible para que no
// parezca que "no hizo nada".
async function refreshColaManual() {
    const antes = state.cola.length;
    await refreshCola();
    toast(`Cola actualizada ✓ · ${state.cola.length} trabajos${state.cola.length !== antes ? ' (cambió)' : ''}`, 'ok');
}

// ===== Agrupación visual por FECHA DE PROGRAMACIÓN =====
// La cola viene ordenada por fecha→T1 Noche/T2 Día→prioridad→espesor→
// pedido/item (mismo orden que Prog. por Estación): estos encabezados
// muestran el programa diario y cuánto queda de cada día.
function keyFecha(item) {
    const f = item && item.fecha_programada ? String(item.fecha_programada).slice(0, 10) : '';
    return f || 'sin';
}

function headerFecha(key, lista) {
    const n = lista.filter(it => keyFecha(it) === key).length;
    let etiqueta;
    if (key === 'sin') {
        etiqueta = 'Sin fecha programada';
    } else {
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        const f = new Date(key + 'T00:00:00');
        const dif = Math.round((f - hoy) / 86400000);
        const larga = f.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
        etiqueta = dif === 0 ? 'Hoy · ' + larga
            : dif === 1 ? 'Mañana · ' + larga
                : larga.charAt(0).toUpperCase() + larga.slice(1);
    }
    return `<div style="display:flex;align-items:center;gap:9px;margin:15px 2px 8px">
        <div style="font-size:13px;font-weight:800;color:var(--text)">📅 ${etiqueta}</div>
        <div style="flex:1;height:1px;background:var(--border)"></div>
        <div class="badge" style="background:var(--bg);color:var(--muted)">${n} ${n === 1 ? 'trabajo' : 'trabajos'}</div>
    </div>`;
}

function pintarCola() {
    const box = $('#colaList');
    if (!box) return;

    const filtro = state.filtroPedido.toLowerCase();
    const lista = state.cola.filter(it => {
        if (filtro && !String(it.pedido_sap_id || '').toLowerCase().includes(filtro)) return false;
        if (state.filtroEspesor && String(it.espesor_mm) !== String(state.filtroEspesor)) return false;
        return true;
    });

    const espesores = [...new Set(state.cola.map(it => it.espesor_mm).filter(e => e != null))].sort((a, b) => a - b);

    // Tipo de pedido (nivel_prioridad): 1 Normal · 2 Express · 3 Urgencia · 4 Reposición
    // Colores ESTÁNDAR (iguales que Órdenes de producción): azul/amarillo/verde/rojo
    const PRIORIDAD = { 1: ['Normal', '#eff6ff', '#1d4ed8'], 2: ['Express', '#fef9c3', '#854d0e'], 3: ['Urgencia', '#dcfce7', '#15803d'], 4: ['Reposición', '#fee2e2', '#b91c1c'] };

    box.innerHTML = `
        <div class="field" style="margin-bottom:10px">
            <input id="qSearch" placeholder="🔍 Buscar por pedido…" value="${esc(state.filtroPedido)}"
                oninput="App.onSearch(this.value)" style="padding-left:13px">
        </div>
        ${espesores.length ? `
        <div class="chips">
            <button class="chip ${!state.filtroEspesor ? 'sel' : ''}" onclick="App.onEspesor('')">Todos</button>
            ${espesores.map(e => `<button class="chip ${String(state.filtroEspesor) === String(e) ? 'sel' : ''}" onclick="App.onEspesor('${e}')">${e}mm</button>`).join('')}
        </div>` : ''}
        ${lista.length === 0 ? `
            <div class="empty">
                <p>${filtro ? 'Sin coincidencias para ese pedido' : 'No hay trabajos en esta estación'}</p>
            </div>` : (() => { let lastF = null; return lista.map(item => {
        const f = keyFecha(item);
        let cabeza = '';
        if (f !== lastF) { lastF = f; cabeza = headerFecha(f, lista); }
        const enProceso = item.estado === 'EN_PROCESO';
        const pausado = item.estado === 'PAUSADO';
        const cantPaso = item.cantidad_paso || item.cantidad || 1;
        const [prioTxt, prioBg, prioFg] = PRIORIDAD[item.nivel_prioridad || 1] || PRIORIDAD[1];
        return cabeza + `
            <div class="card q-item ${enProceso ? 'en-proceso' : ''}">
                <div class="q-head">
                    <div>
                        <div class="q-title">Pedido <strong>${esc(item.pedido_sap_id || '-')}</strong> · Item <strong>${item.item_numero != null ? item.item_numero : '-'}</strong></div>
                        <div class="q-sub">${esc(item.cliente || 'Sin cliente')}</div>
                    </div>
                    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                        <span class="badge" title="Turno programado (T1 Noche arranca la tarde anterior)" style="background:${String(item.turno || '').toLowerCase() === 'noche' ? '#0f172a' : '#eff6ff'};color:${String(item.turno || '').toLowerCase() === 'noche' ? '#93c5fd' : '#1d4ed8'}">${String(item.turno || '').toLowerCase() === 'noche' ? '🌙 T1 Noche' : '🌞 T2 Día'}</span>
                        <span class="badge" style="background:${prioBg};color:${prioFg}">${prioTxt}</span>
                        <span class="status status-${String(item.estado || '').toLowerCase().replace('_', '-')}">${esc(item.estado || '')}</span>
                    </div>
                </div>
                <div class="q-prod">${esc(item.codigo_producto || '-')}${item.descripcion_padre ? ' <span style="font-size:12px;font-weight:600;color:var(--muted)">· ' + esc(item.descripcion_padre) + '</span>' : ''}</div>
                <div class="q-sub">${esc(item.descripcion || '')}${item.espesor_mm ? ' · ' + esc(item.espesor_mm) + 'mm' : ''}</div>
                <div class="q-details">
                    <div class="q-detail"><div class="l">Cantidad</div><div class="v">${cantPaso}${item.cantidad_paso && item.cantidad && item.cantidad_paso < item.cantidad ? ' <span style="color:#94a3b8;font-size:9px">de ' + item.cantidad + '</span>' : ''}</div></div>
                    <div class="q-detail"><div class="l">Medidas</div><div class="v">${esc(item.ancho)}x${esc(item.alto)}mm</div></div>
                    <div class="q-detail"><div class="l">Kilos</div><div class="v">${item.kilos_paso || item.kilos ? Number(Math.round(item.kilos_paso || item.kilos)).toLocaleString('es-CL') : '-'}</div></div>
                </div>
                <div class="q-paso">
                    <span style="color:var(--muted)">Paso ${item.orden_secuencia}:</span>
                    <strong>${esc(item.estacion_actual || '-')}</strong>
                    ${item.proxima_estacion ? `<span style="color:var(--muted)">→</span><strong style="color:var(--primary)">${esc(item.proxima_estacion)}</strong>` : '<span style="color:var(--success);font-weight:700">(último paso)</span>'}
                </div>
                <div class="q-actions">
                    ${enProceso ? `
                        <button class="btn btn-warning btn-sm" onclick="App.pausar(${item.id})">⏸ Pausar</button>
                        <button class="btn btn-success btn-sm" onclick="App.showFinalizar(${item.id})">✔ Finalizar</button>
                    ` : pausado ? `
                        <button class="btn btn-primary btn-sm" onclick="App.reanudar(${item.id})">▶ Reanudar</button>
                    ` : `
                        <button class="btn btn-primary btn-sm" onclick="App.iniciar(${item.id})">▶ Iniciar</button>
                        <button class="btn btn-outline btn-sm" onclick="App.showProcesar(${item.id}, ${cantPaso})">⚙ Procesar</button>
                    `}
                    <button class="btn btn-danger btn-sm" onclick="App.showMerma(${item.id})">✕ Merma</button>
                </div>
            </div>`;
    }).join(''); })()}`;
}

function onSearch(v) {
    state.filtroPedido = v;
    pintarCola();
    const inp = $('#qSearch');
    if (inp) { inp.focus(); inp.setSelectionRange(v.length, v.length); }
}
function onEspesor(v) {
    state.filtroEspesor = v;
    pintarCola();
}

function volverEstaciones() {
    state.turno = null;
    state.maquina = null;
    renderEstaciones();
}

// ============================ ACCIONES DE PASO ============================

async function accionPasos(path, body, msgOk) {
    try {
        const data = await api(path, {
            method: 'POST',
            headers: headersTurno(),
            body: { ...body, operario_nombre: (state.user || {}).nombre || (state.user || {}).email }
        });
        toast((data && data.mensaje) || msgOk, 'ok');
        await refreshCola();
    } catch (err) {
        manejarError(err);
    }
}

function iniciar(pasoId) { accionPasos('/api/taller/iniciar', { paso_id: pasoId, maquina_id: state.maquina ? state.maquina.id : null }, 'Paso iniciado'); }
function pausar(pasoId) { accionPasos('/api/taller/pausar', { paso_id: pasoId }, 'Paso pausado'); }
function reanudar(pasoId) { accionPasos('/api/taller/reanudar', { paso_id: pasoId }, 'Paso reanudado'); }

function showFinalizar(pasoId) {
    openSheet('Finalizar paso', `
        <p style="font-size:13px;color:var(--muted);margin-bottom:13px">¿Cuántas <strong>unidades reales</strong> se produjeron en este paso?</p>
        <div class="field">
            <label>Cantidad real</label>
            <input id="finCantidad" type="number" min="0" step="1" inputmode="numeric" placeholder="Vacío = todo lo asignado">
        </div>
        <p style="font-size:11px;color:var(--muted)">Si produces menos, el resto queda pendiente de corte (no es merma).</p>
    `, `
        <button class="btn btn-outline" onclick="App.closeSheet()">Cancelar</button>
        <button class="btn btn-success" onclick="App.confirmFinalizar(${pasoId})">Finalizar</button>
    `);
}

async function confirmFinalizar(pasoId) {
    const v = $('#finCantidad').value;
    closeSheet();
    try {
        const data = await api('/api/taller/finalizar', {
            method: 'POST',
            headers: headersTurno(),
            body: {
                paso_id: pasoId,
                cantidad: v === '' ? null : Number(v),
                operario_nombre: (state.user || {}).nombre || (state.user || {}).email
            }
        });
        let msg = 'Paso finalizado';
        if (data) {
            if (data.restoCantidad > 0) msg = `Registradas ${data.cantidadReal}; ${data.restoCantidad} quedan pendientes de corte`;
            else if (data.cantidadReal != null) msg = `Registradas ${data.cantidadReal} unidades`;
        }
        toast(msg, 'ok');
        await refreshCola();
    } catch (err) {
        manejarError(err);
    }
}

function showProcesar(pasoId, cantidadMax) {
    openSheet('Procesar cantidad', `
        <div class="field">
            <label>Cantidad a procesar</label>
            <input id="proCantidad" type="number" min="1" max="${cantidadMax}" inputmode="numeric" value="${cantidadMax}">
            <p style="font-size:11px;color:var(--muted);margin-top:5px">Máximo: ${cantidadMax} unidades</p>
        </div>
    `, `
        <button class="btn btn-outline" onclick="App.closeSheet()">Cancelar</button>
        <button class="btn btn-primary" onclick="App.confirmProcesar(${pasoId})">Procesar</button>
    `);
}

async function confirmProcesar(pasoId) {
    const cantidad = Number($('#proCantidad').value);
    closeSheet();
    if (!(cantidad > 0)) { toast('Cantidad inválida', 'err'); return; }
    try {
        const data = await api('/api/taller/procesar', {
            method: 'POST',
            headers: headersTurno(),
            body: {
                paso_id: pasoId, cantidad, maquina_id: state.maquina ? state.maquina.id : null,
                operario_nombre: (state.user || {}).nombre || (state.user || {}).email
            }
        });
        toast((data && data.mensaje) || 'Cantidad procesada', 'ok');
        await refreshCola();
    } catch (err) {
        manejarError(err);
    }
}

function showMerma(pasoId) {
    const causas = ['Rayón', 'Quiebre', 'Defecto de templado', 'Defecto de pintado', 'Fuera de dimensión', 'Otro'];
    openSheet('Registrar merma', `
        <div class="field">
            <label>Causa de la merma</label>
            <select id="merCausa">${causas.map(c => `<option>${c}</option>`).join('')}</select>
        </div>
        <div class="field">
            <label>Cantidad</label>
            <input id="merCantidad" type="number" min="1" inputmode="numeric" value="1">
        </div>
        <div class="field">
            <label>Observación</label>
            <textarea id="merObs" rows="3" placeholder="Detalles de la merma…"></textarea>
        </div>
    `, `
        <button class="btn btn-outline" onclick="App.closeSheet()">Cancelar</button>
        <button class="btn btn-danger" onclick="App.confirmMerma(${pasoId})">Registrar merma</button>
    `);
}

async function confirmMerma(pasoId) {
    const causa = $('#merCausa').value;
    const cantidad = Number($('#merCantidad').value) || 1;
    const observacion = $('#merObs').value.trim();
    closeSheet();
    try {
        const data = await api('/api/taller/merma', {
            method: 'POST',
            headers: headersTurno(),
            body: { paso_id: pasoId, causa, cantidad, observacion, operario: (state.user || {}).email }
        });
        toast((data && data.mensaje) || 'Merma registrada', 'ok');
        await refreshCola();
    } catch (err) {
        manejarError(err);
    }
}

// ============================ ESCANEO + REGISTRO ============================

async function scan() {
    if (!state.estacion) { toast('Primero elige una estación', 'err'); return; }
    let crudo = null;
    try {
        crudo = await scanCode();
    } catch (err) {
        manejarError(err);
        return;
    }
    if (!crudo) return; // cancelado
    const leido = parseQR(crudo);
    if (!leido) {
        openSheet('QR no reconocido', `
            <p style="font-size:13px;color:var(--muted)">Contenido: <strong>${esc(String(crudo).slice(0, 120))}</strong></p>
            <p style="font-size:11.5px;color:var(--muted);margin-top:9px">Formatos aceptados: QR del programa (VF:...) o etiqueta Optiway (SAP|fecha|OV-10item|m2).</p>
            <div class="divider"></div>
            <div class="field" style="margin-bottom:0">
                <label>¿No detecta? Escribe el código</label>
                <input id="qrManual" placeholder="700123|2025-06-12|111805-101|12.5">
            </div>
        `, `
            <button class="btn btn-outline" onclick="App.closeSheet()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.qrManual()">Continuar</button>
        `);
        return;
    }
    showRegistro([{ pedido: leido.pedido, item: leido.item, cantidad: 1 }], 'qr');
}

function qrManual() {
    const v = $('#qrManual').value;
    const leido = parseQR(v);
    if (!leido) { toast('Código no reconocido', 'err'); return; }
    showRegistro([{ pedido: leido.pedido, item: leido.item, cantidad: 1 }], 'qr');
}

// ============================ COMANDO DE VOZ ============================

async function voice() {
    if (!state.estacion) { toast('Primero elige una estación', 'err'); return; }
    openSheet('Comando de voz', `
        <div style="text-align:center;padding:14px 0">
            <div style="font-size:54px;line-height:1">🎤</div>
            <p style="font-size:15px;font-weight:700;margin-top:10px">Escuchando…</p>
            <p style="font-size:12.5px;color:var(--muted);margin-top:10px;line-height:1.7">
                Di por ejemplo:<br>
                <strong style="color:var(--text)">"Registrar 5 del pedido 111836"</strong><br>
                <span style="font-size:11px">también: "…pedido 111836 item 2"</span>
            </p>
        </div>
    `, `<button class="btn btn-outline" onclick="App.cancelVoice()">Cancelar</button>`);
    voiceCancelado = false;
    let texto = null;
    try {
        texto = await escuchar();
    } catch (err) {
        closeSheet();
        manejarError(err);
        return;
    }
    if (voiceCancelado) return;
    closeSheet();
    if (!texto) return;

    const cmd = parseComandoVoz(texto);
    if (!cmd) {
        openSheet('No entendí el comando', `
            <p style="font-size:13px;color:var(--muted);line-height:1.7">Escuché:<br><strong style="color:var(--text)">${esc(texto)}</strong></p>
            <p style="font-size:12px;color:var(--muted);margin-top:10px">Prueba con:<br><strong>"Registrar 5 del pedido 111836"</strong></p>
        `, `
            <button class="btn btn-outline" onclick="App.closeSheet()">Cerrar</button>
            <button class="btn btn-primary" onclick="App.closeSheet();App.voice()">Intentar de nuevo</button>
        `);
        return;
    }
    showRegistro([{ pedido: cmd.pedido, item: cmd.item, cantidad: cmd.cantidad }], 'voz');
}

let voiceCancelado = false;
function cancelVoice() {
    voiceCancelado = true;
    closeSheet();
}

function showRegistro(filas, origen) {
    state.registroOrigen = origen || 'manual';
    state.registroFilas = filas ? filas.map(f => ({ ...f })) : [];
    pintarRegistro();
}

function pintarRegistro() {
    const desdeQR = state.registroOrigen === 'qr';
    openSheet(desdeQR ? 'Registrar producción' : 'Registro manual', `
        <p style="font-size:12px;color:var(--muted);margin-bottom:12px">
            ${desdeQR
            ? 'Etiqueta escaneada. Revisa la cantidad (por defecto <strong>1 vidrio</strong>) y registra.'
            : 'Digitación directa o pegado desde Excel (una fila por línea: <strong>pedido · item · cantidad</strong>, separados por tabulador, coma o punto y coma).'}
        </p>
        <div style="display:grid;grid-template-columns:1.3fr .8fr .9fr auto;gap:7px;align-items:end">
            <div class="field" style="margin:0"><label>Pedido</label><input id="rmPedido" placeholder="111805"></div>
            <div class="field" style="margin:0"><label>Item</label><input id="rmItem" type="number" min="1" value="1" inputmode="numeric"></div>
            <div class="field" style="margin:0"><label>Cant.</label><input id="rmCant" type="number" min="1" inputmode="numeric" placeholder="5"></div>
            <button class="btn btn-primary btn-sm" onclick="App.rmAgregar()" style="height:47px">＋</button>
        </div>
        <div class="divider"></div>
        <div class="field">
            <label>Pegar desde Excel</label>
            <textarea id="rmPegado" rows="3" placeholder="111805&#9;1&#9;5&#10;111807&#9;3&#9;10" style="font-family:monospace;font-size:12px"></textarea>
            <button class="btn btn-outline btn-sm btn-block" style="margin-top:7px" onclick="App.rmPegado()">Cargar filas</button>
        </div>
        <div id="rmLista"></div>
    `, `
        <button class="btn btn-outline" onclick="App.closeSheet()">Cancelar</button>
        <button class="btn btn-success" id="rmBtn" onclick="App.rmRegistrar()">Registrar producción</button>
    `);
    pintarFilas();
}

function pintarFilas() {
    const box = $('#rmLista');
    if (!box) return;
    const btn = $('#rmBtn');
    if (btn) btn.textContent = state.registroFilas.length ? `Registrar producción (${state.registroFilas.length})` : 'Registrar producción';
    if (!state.registroFilas.length) {
        box.innerHTML = '<div class="empty" style="padding:18px 0">Sin filas por registrar</div>';
        return;
    }
    box.innerHTML = '<div style="font-size:10px;font-weight:700;color:var(--muted);margin:2px 0 7px">POR REGISTRAR</div>'
        + state.registroFilas.map((f, i) => `
        <div class="reg-row">
            <strong style="min-width:74px">${esc(f.pedido)}</strong>
            <span style="color:var(--muted)">Item ${esc(f.item)}</span>
            <span style="display:flex;align-items:center;gap:4px;margin-left:auto">
                <input type="number" min="1" step="1" inputmode="numeric" value="${Number(f.cantidad) || 1}" oninput="App.rmCambiar(${i}, this.value)">
                <span style="font-size:11px;color:var(--muted)">und</span>
            </span>
            <button class="reg-x" onclick="App.rmQuitar(${i})">✕</button>
        </div>`).join('');
}

function rmCambiar(i, valor) {
    const n = Number(valor);
    if (state.registroFilas[i] && Number.isFinite(n) && n >= 1) state.registroFilas[i].cantidad = n;
}
function rmQuitar(i) {
    state.registroFilas.splice(i, 1);
    pintarFilas();
}
function rmAgregar() {
    const pedido = ($('#rmPedido').value || '').trim();
    const item = Number($('#rmItem').value) || 1;
    const cantidad = Number($('#rmCant').value);
    if (!pedido || !(cantidad > 0)) { toast('Completa pedido y cantidad', 'err'); return; }
    state.registroFilas.push({ pedido, item, cantidad });
    $('#rmPedido').value = '';
    $('#rmCant').value = '';
    pintarFilas();
}
function rmPegado() {
    const texto = $('#rmPegado').value || '';
    const lineas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let cargadas = 0;
    for (const linea of lineas) {
        const partes = linea.split(/[\t;,\|]+/).map(s => s.trim());
        if (partes.length < 2) continue;
        const pedido = partes[0];
        let item = 1, cantidad = 0;
        if (partes.length >= 3) { item = Number(partes[1]) || 1; cantidad = Number(partes[2]); }
        else { cantidad = Number(partes[1]); }
        if (!pedido || !(cantidad > 0)) continue;
        state.registroFilas.push({ pedido, item, cantidad });
        cargadas++;
    }
    pintarFilas();
    toast(cargadas ? `${cargadas} filas cargadas` : 'No se reconocieron filas', cargadas ? 'ok' : 'err');
}

async function rmRegistrar() {
    if (!state.registroFilas.length) { toast('Agrega al menos una fila', 'err'); return; }
    const invalidas = state.registroFilas.filter(f => !(Number(f.cantidad) > 0));
    if (invalidas.length) { toast('Revisa las cantidades: deben ser 1 o más', 'err'); return; }
    const btn = $('#rmBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Registrando…'; }
    try {
        const data = await api('/api/taller/registro-manual', {
            method: 'POST',
            headers: headersTurno(),
            body: {
                filas: state.registroFilas,
                estacion_id: state.estacion ? state.estacion.id : null,
                maquina_id: state.maquina ? state.maquina.id : null,
                turno: state.turno,
                operario_nombre: (state.user || {}).nombre || (state.user || {}).email
            }
        });
        const resultados = (data && data.resultados) || [];
        const ok = resultados.filter(r => r.ok).length;
        const fallos = resultados.filter(r => !r.ok);
        openSheet('Resultado del registro', `
            <div style="background:#dcfce7;border:1px solid #bbf7d0;border-radius:11px;padding:12px;font-size:13.5px;color:#166534;margin-bottom:${fallos.length ? '11px' : '0'}">
                <strong>✓ ${ok} de ${resultados.length}</strong> registros aplicados
            </div>
            ${fallos.map(f => `
                <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:10px 12px;font-size:12.5px;color:#991b1b;margin-bottom:7px">
                    <strong>${esc(f.pedido)}</strong> · Item ${esc(f.item)}: ${esc(f.mensaje)}
                </div>`).join('')}
        `, state.registroOrigen === 'qr' ? `
            <button class="btn btn-outline" onclick="App.closeSheet();App.refreshCola()">Volver a la cola</button>
            <button class="btn btn-primary" onclick="App.closeSheet();App.scan()">📷 Escanear otro</button>
        ` : state.registroOrigen === 'voz' ? `
            <button class="btn btn-outline" onclick="App.closeSheet();App.refreshCola()">Volver a la cola</button>
            <button class="btn btn-primary" onclick="App.closeSheet();App.voice()">🎤 Hablar otro</button>
        ` : `
            <button class="btn btn-outline" onclick="App.showRegistro()">Seguir registrando</button>
            <button class="btn btn-primary" onclick="App.closeSheet();App.refreshCola()">Cerrar</button>
        `);
        state.registroFilas = [];
    } catch (err) {
        manejarError(err);
        if (btn) { btn.disabled = false; btn.textContent = 'Registrar producción'; }
    }
}

// ============================ MOVIMIENTOS DE PLANCHAS ============================
// Mismo formulario que Inventario → Movimientos, accesible desde la cola de
// la estación de Corte: entradas/salidas de planchas sin salir de la app.

let movMP = [];          // materias primas
let movDims = [];        // stock por medida de la MP seleccionada
let movTipo = 'entrada'; // 'entrada' | 'salida'
let movTipoSalida = '';  // 'plancha_completa' | 'trozo'
// Estado del formulario: el form se re-renderiza al cambiar tipo/materia prima
// (para mostrar/ocultar campos) y sin esto se pierde lo ya ingresado.
let movSel = { mp: '', dim: '', ancho: '', alto: '', cant: '', turno: '', fecha: '', hora: '', proveedor: '', obs: '' };

function capturarMovForm() {
    const g = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    movSel = {
        mp: g('mvMP'), dim: g('mvDim'), ancho: g('mvAncho'), alto: g('mvAlto'),
        cant: g('mvCant'), turno: g('mvTurno'), fecha: g('mvFecha'), hora: g('mvHora'),
        proveedor: g('mvProveedor'), obs: g('mvObs')
    };
}

function puedeMovimientos() {
    const u = state.user || {};
    if (u.rol === 'admin') return true;
    const p = u.permisos || [];
    return p.includes('inv_movimientos') || p.includes('inv_movimientos.agregar');
}

function esEstacionCorte() {
    return /corte/i.test((state.estacion && state.estacion.nombre) || '');
}

async function showMovimientos() {
    movTipo = 'entrada';
    movTipoSalida = '';
    movDims = [];
    movSel = { mp: '', dim: '', ancho: '', alto: '', cant: '', turno: '', fecha: '', hora: '', proveedor: '', obs: '' };
    openSheet('Movimientos de planchas', '<div class="loading">Cargando materias primas…</div>', '');
    try {
        movMP = (await api('/api/inv/materias-primas')) || [];
    } catch (err) {
        manejarError(err);
        closeSheet();
        return;
    }
    pintarMovForm();
}

function pintarMovForm() {
    const ahora = new Date();
    const hhmm = String(ahora.getHours()).padStart(2, '0') + ':' + String(ahora.getMinutes()).padStart(2, '0');
    const hoy = ahora.getFullYear() + '-' + String(ahora.getMonth() + 1).padStart(2, '0') + '-' + String(ahora.getDate()).padStart(2, '0');
    const turnoVal = movSel.turno || (state.turno === 'dia' ? 'Dia' : state.turno === 'noche' ? 'Noche' : '');
    const esSalida = movTipo === 'salida';
    const esPlancha = esSalida && movTipoSalida === 'plancha_completa';

    openSheet('Movimientos de planchas', `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
            <button class="btn ${movTipo === 'entrada' ? 'btn-success' : 'btn-outline'}" onclick="App.mvSetTipo('entrada')">⬆ Entrada</button>
            <button class="btn ${movTipo === 'salida' ? 'btn-danger' : 'btn-outline'}" onclick="App.mvSetTipo('salida')">⬇ Salida</button>
        </div>
        ${esSalida ? `
        <div class="chips" style="margin-bottom:12px">
            <span style="font-size:11px;color:var(--muted);align-self:center">Tipo de salida:</span>
            <button class="chip ${movTipoSalida === 'plancha_completa' ? 'sel' : ''}" onclick="App.mvSetTipoSalida('plancha_completa')">Plancha completa</button>
            <button class="chip ${movTipoSalida === 'trozo' ? 'sel' : ''}" onclick="App.mvSetTipoSalida('trozo')">Trozo</button>
        </div>` : ''}
        <div class="field">
            <label>Materia prima *</label>
            <select id="mvMP" onchange="App.mvMpChange()">
                <option value="">Seleccionar…</option>
                ${movMP.map(mp => `<option value="${mp.id}" ${String(mp.id) === String(movSel.mp) ? 'selected' : ''}>${esc(mp.nombre)} (${esc(mp.espesor_mm)}mm)</option>`).join('')}
            </select>
        </div>
        ${esPlancha ? `
        <div class="field">
            <label>Medida disponible (stock) *</label>
            <select id="mvDim" onchange="App.mvDimChange()">
                <option value="">Seleccionar medida…</option>
                ${movDims.map((d, i) => `<option value="${i}" ${String(i) === String(movSel.dim) ? 'selected' : ''}>${esc(d.ancho)} x ${esc(d.alto)} mm — ${esc(d.stock)} en stock</option>`).join('')}
            </select>
        </div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
            <div class="field" style="margin:0"><label>Ancho (mm) *</label><input id="mvAncho" type="number" min="1" inputmode="numeric" placeholder="2000" value="${esc(movSel.ancho)}" oninput="App.mvCalc()"></div>
            <div class="field" style="margin:0"><label>Alto (mm) *</label><input id="mvAlto" type="number" min="1" inputmode="numeric" placeholder="1500" value="${esc(movSel.alto)}" oninput="App.mvCalc()"></div>
            <div class="field" style="margin:0"><label>Cantidad *</label><input id="mvCant" type="number" min="1" inputmode="numeric" placeholder="5" value="${esc(movSel.cant)}" oninput="App.mvCalc()"></div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;background:var(--bg);border-radius:11px;padding:11px 13px;margin:11px 0">
            <span style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;font-weight:700">M² total</span>
            <span id="mvM2" style="font-size:16px;font-weight:800">0.00 m²</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div class="field" style="margin:0"><label>Turno *</label>
                <select id="mvTurno"><option value="">Seleccionar…</option>
                    <option ${turnoVal === 'Dia' ? 'selected' : ''}>Dia</option>
                    <option ${turnoVal === 'Noche' ? 'selected' : ''}>Noche</option>
                </select></div>
            <div class="field" style="margin:0"><label>Fecha</label><input id="mvFecha" type="date" value="${esc(movSel.fecha) || hoy}" max="${hoy}"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:11px">
            <div class="field" style="margin:0"><label>Hora</label><input id="mvHora" type="time" value="${esc(movSel.hora) || hhmm}"></div>
            <div class="field" style="margin:0"><label>Proveedor</label><input id="mvProveedor" placeholder="Opcional" value="${esc(movSel.proveedor)}"></div>
        </div>
        <div class="field" style="margin-top:11px"><label>Observaciones</label><input id="mvObs" placeholder="Notas…" value="${esc(movSel.obs)}"></div>
    `, `
        <button class="btn btn-outline" onclick="App.closeSheet()">Cancelar</button>
        <button class="btn btn-success" id="mvBtn" onclick="App.mvRegistrar()">Registrar movimiento</button>
    `);
    mvCalc();
}

function mvSetTipo(t) {
    capturarMovForm();
    movTipo = t;
    if (t !== 'salida') movTipoSalida = '';
    pintarMovForm();
}
function mvSetTipoSalida(t) {
    capturarMovForm();
    movTipoSalida = t;
    pintarMovForm();
}

async function mvMpChange() {
    capturarMovForm();
    movSel.dim = '';
    movDims = [];
    const mpId = Number(movSel.mp) || 0;
    if (mpId) {
        try {
            const body = await api(`/api/inv/stock-por-dimension?mp_id=${mpId}`);
            movDims = Array.isArray(body) ? body : [];
        } catch (_) { }
    }
    // Re-render para mostrar/ocultar el selector de medidas (sin perder datos)
    pintarMovForm();
}

function mvDimChange() {
    capturarMovForm();
    const i = Number(movSel.dim);
    const d = movDims[i];
    if (d) {
        movSel.ancho = d.ancho;
        movSel.alto = d.alto;
        const ae = $('#mvAncho'); const al = $('#mvAlto');
        if (ae) ae.value = d.ancho;
        if (al) al.value = d.alto;
        mvCalc();
    }
}

function mvCalc() {
    const a = Number($('#mvAncho') && $('#mvAncho').value) || 0;
    const h = Number($('#mvAlto') && $('#mvAlto').value) || 0;
    const c = Number($('#mvCant') && $('#mvCant').value) || 0;
    const m2 = (a * h * c) / 1000000;
    const el = $('#mvM2');
    if (el) el.textContent = m2.toFixed(2) + ' m²';
}

async function mvRegistrar() {
    const mpId = Number($('#mvMP').value) || 0;
    const ancho = Number($('#mvAncho').value) || 0;
    const alto = Number($('#mvAlto').value) || 0;
    const cantidad = Number($('#mvCant').value) || 0;
    const turno = $('#mvTurno').value || null;

    if (!movTipo) { toast('Selecciona tipo de movimiento', 'err'); return; }
    if (!mpId) { toast('Selecciona una materia prima', 'err'); return; }
    if (movTipo === 'salida' && !movTipoSalida) { toast('Selecciona tipo de salida: Plancha o Trozo', 'err'); return; }
    if (!(ancho > 0 && alto > 0 && cantidad > 0)) { toast('Completa ancho, alto y cantidad', 'err'); return; }
    if (!turno) { toast('Selecciona el turno', 'err'); return; }

    if (movTipo === 'salida' && movTipoSalida === 'plancha_completa') {
        const i = Number($('#mvDim').value);
        const d = movDims[i];
        if ($('#mvDim').value === '' || !d) { toast('Selecciona una medida disponible', 'err'); return; }
        if (cantidad > Number(d.stock)) { toast(`Cantidad excede stock disponible (${d.stock} planchas)`, 'err'); return; }
    }

    const fecha = $('#mvFecha').value || '';
    const hora = $('#mvHora').value || '';
    const ahora = new Date();
    const hhmmss = String(ahora.getHours()).padStart(2, '0') + ':' + String(ahora.getMinutes()).padStart(2, '0') + ':' + String(ahora.getSeconds()).padStart(2, '0');
    const fechaHora = fecha
        ? fecha + 'T' + (hora ? hora + ':00' : hhmmss)
        : ahora.getFullYear() + '-' + String(ahora.getMonth() + 1).padStart(2, '0') + '-' + String(ahora.getDate()).padStart(2, '0') + 'T' + hhmmss;

    const btn = $('#mvBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }
    try {
        await api('/api/inv/movimientos', {
            method: 'POST',
            body: {
                tipo_movimiento: movTipo,
                materia_prima_id: mpId,
                ancho, alto, cantidad_planchas: cantidad,
                proveedor: ($('#mvProveedor').value || '').trim() || null,
                turno,
                tipo_salida: movTipo === 'salida' ? movTipoSalida : null,
                observaciones: ($('#mvObs').value || '').trim() || null,
                fecha_hora: fechaHora
            }
        });
        toast('Movimiento registrado', 'ok');
        closeSheet();
    } catch (err) {
        manejarError(err);
        if (btn) { btn.disabled = false; btn.textContent = 'Registrar movimiento'; }
    }
}

// ============================ ACTUALIZACIONES ============================
// La app consulta /planta/version.json al abrir: si el APK publicado es más
// nuevo que el instalado, avisa con un botón que instala la actualización
// encima (misma firma, no se pierden datos ni hay que desinstalar).

let updatePendiente = null;

async function checkUpdate() {
    try {
        updatePendiente = await checkForUpdate();
    } catch (_) {
        return;
    }
    if (!updatePendiente) return;
    openSheet('Nueva versión disponible', `
        <p style="font-size:13.5px;color:var(--text);line-height:1.6">
            Hay una versión más nueva de <strong>VitroFlow Planta</strong>
            (${esc(updatePendiente.versionName || '')} — tienes la ${esc(updatePendiente.versionLocal || '?')}).
        </p>
        ${updatePendiente.notas ? `<div style="background:var(--bg);border-radius:11px;padding:11px 13px;font-size:12.5px;color:var(--muted);margin-top:11px">${esc(updatePendiente.notas)}</div>` : ''}
        <p style="font-size:11.5px;color:var(--muted);margin-top:11px">
            Toca <strong>Actualizar ahora</strong>, espera la descarga y confirma la instalación.
            La app se actualiza encima de la actual: no se pierde nada ni hay que desinstalar.
        </p>
    `, `
        <button class="btn btn-outline" onclick="App.closeSheet()">Después</button>
        <button class="btn btn-primary" onclick="App.updateNow()">⬆ Actualizar ahora</button>
    `);
}

let updateDescargando = false;
function updateNow() {
    const url = (updatePendiente && updatePendiente.apk) || '/planta/VitroFlow-Planta.apk';
    if (updateDescargando) return;
    updateDescargando = true;
    openSheet('Actualizando VitroFlow Planta', `
        <div style="text-align:center;padding:10px 0">
            <div style="font-size:46px;line-height:1">⬇️</div>
            <p style="font-size:14.5px;font-weight:700;margin-top:12px" id="updTxt">Descargando…</p>
            <div style="height:11px;background:var(--bg);border-radius:999px;margin:15px 4px 6px;overflow:hidden">
                <div id="updBar" style="height:100%;width:2%;background:var(--primary);border-radius:999px;transition:width .3s"></div>
            </div>
            <div id="updLog" style="font-size:11.5px;color:var(--muted);margin-top:12px;min-height:36px;line-height:1.7;text-align:left;background:var(--bg);border-radius:10px;padding:9px 12px"></div>
            <p style="font-size:11px;color:var(--muted);margin-top:10px;line-height:1.6">
                No cierres la app. Al terminar se abrirá el instalador de Android:<br>
                toca <strong>Instalar</strong> y listo.
            </p>
        </div>
    `, '');
    descargarEInstalar(url, (pct) => {
        const bar = $('#updBar');
        const txt = $('#updTxt');
        if (bar && pct != null) bar.style.width = Math.max(2, pct) + '%';
        if (txt && pct != null) txt.textContent = `Descargando… ${pct}%`;
    }, (paso) => {
        const log = $('#updLog');
        if (log) log.innerHTML = (log.innerHTML ? log.innerHTML + '<br>' : '') + '· ' + esc(paso);
    }).then((modo) => {
        updateDescargando = false;
        if (modo === 'instalador') {
            closeSheet();
            toast('Descarga lista: confirma la instalación', 'ok');
        } else {
            // Respaldo vía navegador: explicar dónde está el archivo
            openSheet('Descarga en el navegador', `
                <p style="font-size:13px;color:var(--text);line-height:1.7">
                    La descarga continúa en el <strong>navegador del celular</strong>. Para instalar:
                </p>
                <ol style="font-size:12.5px;color:var(--muted);line-height:2;padding-left:20px;margin-top:10px">
                    <li>Espera a que termine la descarga 📥</li>
                    <li>Toca la <strong>notificación</strong> de descarga, o abre <strong>Archivos → Descargas</strong></li>
                    <li>Toca <strong>VitroFlow-Planta.apk</strong> → <strong>Instalar</strong></li>
                </ol>
                <p style="font-size:11px;color:var(--muted);margin-top:10px">Si el teléfono pide "permitir instalación de apps desconocidas", actívala para el navegador y vuelve a tocar el archivo.</p>
            `, `<button class="btn btn-primary" onclick="App.closeSheet()">Entendido</button>`);
        }
    }).catch((err) => {
        updateDescargando = false;
        const msg = String((err && err.message) || err);
        openSheet('No se pudo actualizar', `
            <p style="font-size:13px;color:var(--text);line-height:1.7">Ocurrió un problema:</p>
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:11px 13px;font-size:12px;color:#991b1b;margin:10px 0;word-break:break-word">${esc(msg)}</div>
            <p style="font-size:11.5px;color:var(--muted);line-height:1.7">
                Puedes instalarla a mano: abre <strong>Chrome</strong> y ve a<br>
                <strong style="color:var(--text);word-break:break-all">${esc(getApiBase())}/planta/VitroFlow-Planta.apk</strong><br>
                y toca el archivo descargado para instalar.
            </p>
        `, `
            <button class="btn btn-outline" onclick="App.closeSheet()">Cerrar</button>
            <button class="btn btn-primary" onclick="App.closeSheet();App.updateNow()">Reintentar</button>
        `);
    });
}

// ============================ ALERTA DE DESVÍO ============================
// "El programa va al 72%, ¿reprogramo?" — al abrir la app, si el programa de
// hoy quedó corto (o hay vencido), se avisa y se ofrece reprogramar EN 1 CLIC
// (POST /api/produccion/reprogramar: re-asigna fechas por prioridad DBR sin
// tocar lo en proceso ni las fechas de entrega pactadas).

function fmtN(n) { return Number(n || 0).toLocaleString('es-CL'); }

async function checkDesvio() {
    let d;
    try {
        d = await api('/api/taller/dashboard');
    } catch (_) { return; }
    const dv = d.desvio || {};
    const vencidas = dv.vencidas || [];
    const porVencer = dv.por_vencer || [];
    // Decisión 5: vencidas (pactada < hoy) siempre alertan; las del día se
    // muestran como "por vencer" para poder monitorear
    if (vencidas.length || porVencer.length) {
        mostrarDesvio(dv);
    }
}

function filaIncumplida(o, esVencida) {
    const prio = ({ 1: 'Normal', 2: 'Express', 3: 'Urgencia', 4: 'Reposición' })[o.prioridad] || 'Normal';
    const avance = (o.avance || []).map(a => {
        const ok = a.estado === 'TERMINADO' || a.estado === 'MERMADO';
        const curso = a.estado === 'EN_PROCESO' || a.estado === 'PAUSADO';
        return `<span style="color:${ok ? 'var(--success)' : curso ? 'var(--warning)' : 'var(--muted)'}">${ok ? '✅' : curso ? '⏳' : '❌'} ${esc(a.estacion || '')}</span>`;
    }).join(' <span style="color:var(--muted)">·</span> ');
    return `
        <div style="background:${esVencida ? '#fef2f2' : '#fffbeb'};border:1px solid ${esVencida ? '#fecaca' : '#fde68a'};border-radius:11px;padding:10px 12px;margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
                <strong style="font-size:13px">${esc(o.pedido || '')} <span style="color:var(--muted);font-weight:500">item ${o.item != null ? o.item : '—'}</span></strong>
                <span class="badge" style="background:${esVencida ? '#fee2e2' : '#fef3c7'};color:${esVencida ? '#b91c1c' : '#b45309'};font-size:9.5px">${esVencida ? 'VENCIDA' : 'POR VENCER'} ${esc(String(o.fecha_pactada || '').slice(5))}</span>
            </div>
            <div style="font-size:10.5px;color:var(--muted);margin:3px 0 6px">${esc(o.cliente || '')} · ${esc(prio)}</div>
            <div style="font-size:10.5px;line-height:1.7">${avance}</div>
        </div>`;
}

function mostrarDesvio(dv) {
    const u = state.user || {};
    const puede = u.rol === 'admin' || (u.permisos || []).includes('prod_planificacion.agregar');
    const vencidas = dv.vencidas || [];
    const porVencer = dv.por_vencer || [];
    const lista = [
        ...vencidas.map(o => filaIncumplida(o, true)),
        ...porVencer.map(o => filaIncumplida(o, false))
    ].slice(0, 6).join('');
    openSheet('⚠️ ' + vencidas.length + ' vencidas · ' + porVencer.length + ' por vencer', `
        <div style="max-height:44vh;overflow:auto">${lista || '<p style="color:var(--muted);font-size:12px">Sin órdenes incumplidas</p>'}</div>
        <div style="background:var(--bg);border-radius:11px;padding:12px 14px;margin-top:12px;font-size:12px;color:var(--muted);line-height:1.8">
            <strong style="color:var(--text)">Para dar nueva fecha</strong><br>
            La reprogramación se hace desde la web en <strong style="color:var(--text)">Producción → Planificación → 🔔 Por Avance</strong>
            (re-programa solo lo pendiente, respetando lo ya fabricado).
        </div>
    `, `
        <button class="btn btn-primary" onclick="App.closeSheet()">Entendido</button>
    `);
}

async function reprogramarAhora() {
    closeSheet();
    toast('Reprogramando por avance…', 'ok');
    try {
        const r = await api('/api/produccion/reprogramar/avance', { method: 'POST', body: {} });
        const alertas = (r && r.alertas) || [];
        const exceden = alertas.filter(a => a.excede_pacto).length;
        toast((r && r.mensaje) || 'Reprogramado ✅' + (exceden ? ` · ${exceden} exceden el compromiso` : ''), 'ok');
        if (exceden) {
            setTimeout(() => {
                openSheet('📅 Fechas que exceden el compromiso', `
                    ${alertas.filter(a => a.excede_pacto).slice(0, 8).map(a => `
                        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:9px 12px;margin-bottom:7px;font-size:12px">
                            <strong>${esc(a.pedido || '')}</strong> item ${a.item != null ? a.item : '—'}:
                            pactada <strong>${esc(String(a.fecha_anterior || '').slice(5))}</strong>
                            → nueva <strong style="color:var(--danger)">${esc(String(a.fecha_nueva || '').slice(5))}</strong>
                        </div>`).join('')}
                    <p style="font-size:11.5px;color:var(--muted);margin-top:8px">Comunica las nuevas fechas a los clientes.</p>
                `, `<button class="btn btn-primary" onclick="App.closeSheet()">Entendido</button>`);
            }, 900);
        }
    } catch (err) {
        manejarError(err);
    }
}

// ============================ ARRANQUE ============================

// Teclado del celular: el campo enfocado debe quedar SIEMPRE visible.
// REGLA DE ORO: si el campo YA se ve completo, NO MOVER NADA (el bug clásico
// del login —los campos volando hacia arriba— era sobrereaccionar y hacer
// scroll innecesario). Solo se actúa si el campo está REALMENTE oculto por el
// teclado superpuesto (Android 15+ / Samsung), con delta plausible y limitado.
// ⚠️ MANTENER ESTE BLOQUE en toda actualización de la app (mobile/QA-CHECKLIST.md).
(function () {
    const MARGEN = 12;
    const esCampo = (t) => t && t.matches && t.matches('input, select, textarea');
    const vv = () => window.visualViewport;
    // Altura del teclado como padding inferior del área de scroll (variable --kb)
    const aplicarAlturaTeclado = () => {
        const v = vv();
        if (!v) return;
        const kb = Math.max(0, Math.min(Math.round(window.innerHeight - v.height - v.offsetTop), Math.round(window.innerHeight * 0.6)));
        document.documentElement.style.setProperty('--kb', kb + 'px');
    };
    const mantenerVisible = () => {
        const t = document.activeElement;
        if (!esCampo(t)) return;
        try {
            const v = vv();
            const r = t.getBoundingClientRect();
            if (!v || v.height < 200) return;               // teclado a medio abrir: no tocar
            const visTop = v.offsetTop + MARGEN;
            const visBottom = v.offsetTop + v.height - MARGEN;
            // 1) ¿El campo ya se ve completo? → NO MOVER NADA
            if (r.top >= visTop && r.bottom <= visBottom) return;
            // 2) Teclado SUPERPUESTO (la vista visual es más chica que el layout):
            //    corregir con el área visible. Si el layout ya viene recortado
            //    (resize clásico), basta el scroll mínimo del navegador.
            const kbSuperpuesto = (window.innerHeight - v.height - v.offsetTop) > 120;
            if (kbSuperpuesto) {
                let delta = 0;
                if (r.bottom > visBottom) delta = r.bottom - visBottom;
                else if (r.top < visTop) delta = r.top - visTop;
                // Delta implausible = métrica en transición → NO mover (evita el
                // "vuelo" de los campos hacia arriba)
                if (delta !== 0 && Math.abs(delta) <= 220) window.scrollBy(0, delta);
                return;
            }
            // 3) Sin teclado superpuesto: scroll mínimo nativo (nunca 'center')
            t.scrollIntoView({ block: 'nearest' });
        } catch (_) { }
    };
    const alCambiarVista = () => { aplicarAlturaTeclado(); setTimeout(mantenerVisible, 80); setTimeout(mantenerVisible, 300); };
    document.addEventListener('focusin', (e) => {
        if (esCampo(e.target)) {
            aplicarAlturaTeclado();
            setTimeout(mantenerVisible, 100);
            setTimeout(mantenerVisible, 350);
        }
    });
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', alCambiarVista);
        window.visualViewport.addEventListener('scroll', alCambiarVista);
    }
    window.addEventListener('resize', alCambiarVista);
    aplicarAlturaTeclado();
})();

async function boot() {
    state.user = getUser();
    if (state.user) {
        renderEstaciones();
        cargarHorarios();
        checkDesvio();
    } else {
        renderLogin();
    }
    checkUpdate();
}

window.App = {
    doLogin, doLogout,
    selectEstacion, pickTurno, confirmTurno, pickMaquina, confirmMaquina, continuarSinMaquina,
    refreshCola, onSearch, onEspesor, volverEstaciones,
    iniciar, pausar, reanudar,
    showFinalizar, confirmFinalizar, showProcesar, confirmProcesar, showMerma, confirmMerma,
    scan, qrManual, voice, cancelVoice, showRegistro, rmAgregar, rmPegado, rmCambiar, rmQuitar, rmRegistrar,
    refreshColaManual, reprogramarAhora,
    showMovimientos, mvSetTipo, mvSetTipoSalida, mvMpChange, mvDimChange, mvCalc, mvRegistrar,
    updateNow,
    closeSheet,
};

boot();
