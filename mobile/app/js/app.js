// VitroFlow Planta — vistas y lógica de la app.
// Pantallas: Login → Estaciones → Turno/Máquina → Cola → Escanear/Registro.
import { api, login, logout, getUser, ApiError } from './api.js';
import { parseQR, getTurnoSugerido } from './helpers.js';
import { scanCode } from './scan.js';
import { checkForUpdate, openDownload } from './update.js';

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
        </div>`;
    $('#lgPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
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
            const color = carga > 10 ? 'var(--danger)' : carga > 5 ? 'var(--warning)' : 'var(--success)';
            return `
            <div class="card tap" onclick="App.selectEstacion(${Number(e.id)}, '${esc(e.nombre_estacion || e.nombre)}')">
                <div class="q-head">
                    <div class="q-title" style="font-size:16px">${esc(e.nombre_estacion || e.nombre)}</div>
                    <span class="badge" style="background:${color}20;color:${color}">${carga} en cola</span>
                </div>
                <div class="stat-grid">
                    <div class="stat"><div class="v" style="color:var(--primary)">${e.pendientes || 0}</div><div class="l">Pendientes</div></div>
                    <div class="stat"><div class="v" style="color:var(--warning)">${e.en_proceso || 0}</div><div class="l">En proceso</div></div>
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
                <button class="back-link" onclick="App.refreshCola()">↻</button>
            </div>
        </div>
        <div class="container" id="colaList"><div class="loading">Cargando cola de trabajo…</div></div>
        <div class="action-bar">
            <button class="btn btn-outline" onclick="App.showRegistro()">✏️ Registro manual</button>
            <button class="btn btn-primary" onclick="App.scan()">📷 Escanear QR</button>
        </div>`;
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
    const PRIORIDAD = { 1: ['Normal', '#475569'], 2: ['Express', '#d97706'], 3: ['Urgencia', '#dc2626'], 4: ['Reposición', '#7c3aed'] };

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
            </div>` : lista.map(item => {
        const enProceso = item.estado === 'EN_PROCESO';
        const pausado = item.estado === 'PAUSADO';
        const cantPaso = item.cantidad_paso || item.cantidad || 1;
        const [prioTxt, prioColor] = PRIORIDAD[item.nivel_prioridad || 1] || PRIORIDAD[1];
        return `
            <div class="card q-item ${enProceso ? 'en-proceso' : ''}">
                <div class="q-head">
                    <div>
                        <div class="q-title">Pedido <strong>${esc(item.pedido_sap_id || '-')}</strong> · Item <strong>${item.item_numero != null ? item.item_numero : '-'}</strong></div>
                        <div class="q-sub">${esc(item.cliente || 'Sin cliente')}</div>
                    </div>
                    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                        <span class="badge" style="background:${prioColor}1c;color:${prioColor}">${prioTxt}</span>
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
    }).join('')}`;
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

function updateNow() {
    const url = (updatePendiente && updatePendiente.apk) || '/planta/VitroFlow-Planta.apk';
    closeSheet();
    openDownload(url);
}

// ============================ ARRANQUE ============================

async function boot() {
    state.user = getUser();
    if (state.user) {
        renderEstaciones();
        cargarHorarios();
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
    scan, qrManual, showRegistro, rmAgregar, rmPegado, rmCambiar, rmQuitar, rmRegistrar,
    updateNow,
    closeSheet,
};

boot();
