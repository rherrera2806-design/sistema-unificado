// ═══════════════════════════════════════════════════════
// VitroFlow - Módulo de Asistencia
// ═══════════════════════════════════════════════════════

const Asistencia = {
    trabajadores: [],
    asistenciaHoy: [],
    
    // ── Inicialización ──
    async init() {
        this.setFechaActual();
        await this.cargarTrabajadores();
        await this.cargarAsistencia();
        this.cargarPermisos();
        this.cargarLicencias();
        this.cargarVacaciones();
        this.setCalendarioFecha();
    },
    
    setFechaActual() {
        const hoy = new Date().toISOString().split('T')[0];
        document.getElementById('fecha-selector').value = hoy;
        
        // Setear mes actual en filtros
        const mesActual = new Date().getMonth() + 1;
        document.getElementById('filtro-mes-permiso').value = mesActual;
        document.getElementById('filtro-mes-reporte').value = mesActual;
        document.getElementById('filtro-mes-licencia').value = mesActual;
    },
    
    setCalendarioFecha() {
        const hoy = new Date();
        document.getElementById('cal-mes').value = hoy.getMonth();
        document.getElementById('cal-anio').value = hoy.getFullYear();
    },
    
    // ── Trabajadores ──
    async cargarTrabajadores() {
        try {
            const r = await fetch('/api/asistencia/trabajadores');
            this.trabajadores = await r.json();
            this.renderTrabajadores();
            this.llenarSelectores();
        } catch(e) {
            console.error('Error cargando trabajadores:', e);
        }
    },
    
    renderTrabajadores() {
        const container = document.getElementById('trabajadores-list');
        if (!container) return;
        
        container.innerHTML = this.trabajadores.map(t => {
            const falta = this.asistenciaHoy.find(a => a.trabajador_id === t.id);
            const iniciales = t.nombre.split(' ').map(n => n[0]).join('').slice(0, 2);
            
            return `
                <div class="trabajador-item">
                    <div class="trabajador-avatar">${iniciales}</div>
                    <div class="trabajador-info">
                        <div class="trabajador-name">${t.nombre}</div>
                        <div class="trabajador-rut">${t.rut}</div>
                    </div>
                    <div class="flex gap-2 items-center">
                        ${falta ? 
                            `<span class="badge badge-danger">Falta</span>
                             <button class="check-btn" style="background:var(--success);color:white" 
                                     onclick="Asistencia.marcar(${t.id}, false)">✓ Corregir</button>` :
                            `<span class="badge badge-success">Presente</span>
                             <button class="check-btn" style="background:var(--danger);color:white" 
                                     onclick="Asistencia.marcar(${t.id}, true)">✗ Marcar Falta</button>`
                        }
                    </div>
                </div>
            `;
        }).join('');
    },
    
    // ── Marcar Falta ──
    async marcar(trabajadorId, falta) {
        try {
            const r = await fetch('/api/asistencia/marcar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trabajador_id: trabajadorId, falta })
            });
            
            if (r.ok) {
                await this.cargarAsistencia();
                this.mostrarExito(falta ? 'Falta registrada' : 'Falta eliminada');
            } else {
                const e = await r.json();
                this.mostrarError(e.error);
            }
        } catch(e) {
            this.mostrarError('Error de conexión');
        }
    },
    
    // ── Asistencia Diaria ──
    async cargarAsistencia() {
        const fecha = document.getElementById('fecha-selector').value;
        try {
            const r = await fetch(`/api/asistencia/diaria?fecha=${fecha}`);
            this.asistenciaHoy = await r.json();
            this.renderTrabajadores();
            this.renderTablaAsistencia();
            this.actualizarStats();
        } catch(e) {
            console.error('Error cargando asistencia:', e);
        }
    },
    
    renderTablaAsistencia() {
        const tbody = document.getElementById('tabla-asistencia');
        const badge = document.getElementById('badge-dia');
        
        if (!tbody) return;
        
        const faltas = this.asistenciaHoy.length;
        badge.textContent = `${faltas} faltas`;
        
        if (faltas === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Todos presentes hoy</td></tr>';
            return;
        }
        
        tbody.innerHTML = this.asistenciaHoy.map(a => `
            <tr>
                <td><strong>${a.nombre}</strong></td>
                <td class="text-muted">${a.rut}</td>
                <td><span class="badge badge-danger">Falta</span></td>
                <td>
                    <button class="btn btn-sm btn-success" 
                            onclick="Asistencia.marcar(${a.trabajador_id}, false)">✓ Corregir</button>
                </td>
            </tr>
        `).join('');
    },
    
    actualizarStats() {
        const total = this.trabajadores.length;
        const faltas = this.asistenciaHoy.length;
        const presentes = total - faltas;
        
        document.getElementById('stat-presentes').textContent = presentes;
        document.getElementById('stat-faltas').textContent = faltas;
        document.getElementById('stat-total').textContent = total;
    },
    
    // ── Permisos ──
    async cargarPermisos() {
        const mes = document.getElementById('filtro-mes-permiso').value;
        const anio = new Date().getFullYear();
        
        try {
            const r = await fetch(`/api/asistencia/permisos?mes=${mes}&anio=${anio}`);
            const permisos = await r.json();
            this.renderTablaPermisos(permisos);
        } catch(e) {
            console.error('Error cargando permisos:', e);
        }
    },
    
    renderTablaPermisos(permisos) {
        const tbody = document.getElementById('tabla-permisos');
        if (!tbody) return;
        
        if (permisos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Sin permisos registrados</td></tr>';
            return;
        }
        
        tbody.innerHTML = permisos.map(p => {
            const estadoBadge = p.estado === 'aprobado' ? 'badge-success' : 
                               p.estado === 'rechazado' ? 'badge-danger' : 'badge-warning';
            
            return `
                <tr>
                    <td><strong>${p.nombre}</strong></td>
                    <td>${this.tipoPermisoLabel(p.tipo)}</td>
                    <td>${this.formatDate(p.fecha_inicio)}</td>
                    <td>${this.formatDate(p.fecha_fin)}</td>
                    <td class="text-muted">${p.motivo || '-'}</td>
                    <td><span class="badge ${estadoBadge}">${p.estado}</span></td>
                    <td class="table-actions">
                        ${p.estado === 'pendiente' ? `
                            <button class="btn btn-sm btn-success" onclick="Asistencia.cambiarEstadoPermiso(${p.id}, 'aprobado')">✓</button>
                            <button class="btn btn-sm btn-danger" onclick="Asistencia.cambiarEstadoPermiso(${p.id}, 'rechazado')">✗</button>
                        ` : ''}
                    </td>
                </tr>
            `;
        }).join('');
    },
    
    async cambiarEstadoPermiso(id, estado) {
        try {
            await fetch(`/api/asistencia/permisos/${id}/estado`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado })
            });
            this.cargarPermisos();
        } catch(e) {
            this.mostrarError('Error actualizando permiso');
        }
    },
    
    tipoPermisoLabel(tipo) {
        const labels = {
            medico: 'Permiso Médico',
            personal: 'Permiso Personal',
            familiar: 'Permiso Familiar',
            otro: 'Otro'
        };
        return labels[tipo] || tipo;
    },
    
    // ── Calendario Mensual ──
    async cargarCalendario() {
        const mes = parseInt(document.getElementById('cal-mes').value) + 1;
        const anio = document.getElementById('cal-anio').value;
        
        try {
            const r = await fetch(`/api/asistencia/calendario?mes=${mes}&anio=${anio}`);
            const data = await r.json();
            this.renderCalendario(data);
        } catch(e) {
            console.error('Error cargando calendario:', e);
        }
    },
    
    renderCalendario(data) {
        const container = document.getElementById('calendario-container');
        if (!container) return;
        
        const { trabajadores, faltas, vacaciones, licencias, mes, anio } = data;
        
        const diasEnMes = new Date(anio, mes, 0).getDate();
        const primerDia = new Date(anio, mes - 1, 1).getDay();
        const hoy = new Date();
        const diaActual = hoy.getDate();
        const mesActual = hoy.getMonth() + 1;
        const anioActual = hoy.getFullYear();
        
        const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        
        let html = '<div class="calendar-scroll">';
        html += '<div class="calendar-fixed-header">';
        html += '<div class="worker-row" style="border-bottom:2px solid var(--border)">';
        html += '<div class="worker-name-cell" style="font-weight:700;background:var(--gray-100)">Trabajador</div>';
        html += `<div class="worker-days" style="grid-template-columns:repeat(${diasEnMes}, 1fr)">`;
        
        for (let d = 1; d <= diasEnMes; d++) {
            const fecha = new Date(anio, mes - 1, d);
            const diaSemana = diasSemana[fecha.getDay()];
            const esFinSemana = fecha.getDay() === 0 || fecha.getDay() === 6;
            const esHoy = d === diaActual && mes === mesActual && parseInt(anio) === anioActual;
            
            html += `<div class="worker-day ${esFinSemana ? 'fin-semana' : ''} ${esHoy ? 'hoy' : ''}" 
                         style="flex-direction:column;padding:4px 2px">
                <div style="font-weight:600">${d}</div>
                <div style="font-size:0.5rem;opacity:0.7">${diaSemana}</div>
            </div>`;
        }
        
        html += '</div></div></div>';
        
        // Filas de trabajadores
        trabajadores.forEach(t => {
            html += '<div class="worker-row">';
            html += `<div class="worker-name-cell">
                <div class="trabajador-avatar" style="width:24px;height:24px;font-size:0.625rem">
                    ${t.nombre.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <span style="font-size:0.75rem">${t.nombre}</span>
            </div>`;
            
            html += `<div class="worker-days" style="grid-template-columns:repeat(${diasEnMes}, 1fr)">`;
            
            for (let d = 1; d <= diasEnMes; d++) {
                const fechaStr = `${anio}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const fecha = new Date(anio, mes - 1, d);
                const esFinSemana = fecha.getDay() === 0 || fecha.getDay() === 6;
                const esHoy = d === diaActual && mes === mesActual && parseInt(anio) === anioActual;
                
                let clase = '';
                let tooltip = '';
                
                if (esFinSemana) {
                    clase = 'fin-semana';
                    tooltip = 'Fin de semana';
                } else {
                    // Verificar si tiene vacaciones este día
                    const enVacaciones = vacaciones.some(v => 
                        v.trabajador_id === t.id && 
                        new Date(v.fecha_inicio) <= fecha && 
                        new Date(v.fecha_fin) >= fecha
                    );
                    
                    // Verificar si tiene licencia médica este día
                    const enLicencia = licencias.some(l => 
                        l.trabajador_id === t.id && 
                        new Date(l.fecha_inicio) <= fecha && 
                        new Date(l.fecha_fin) >= fecha
                    );
                    
                    // Verificar si falta
                    const falta = faltas.some(f => 
                        f.trabajador_id === t.id && 
                        f.fecha === fechaStr
                    );
                    
                    if (enVacaciones) {
                        clase = 'vacaciones';
                        tooltip = 'Vacaciones';
                    } else if (enLicencia) {
                        clase = 'licencia';
                        tooltip = 'Licencia Médica';
                    } else if (falta) {
                        clase = 'falta';
                        tooltip = 'Falta';
                    } else if (d <= diaActual || mes < mesActual || parseInt(anio) < anioActual) {
                        clase = 'presente';
                        tooltip = 'Presente';
                    }
                }
                
                html += `<div class="worker-day ${clase} ${esHoy ? 'hoy' : ''}" 
                             title="${tooltip}" style="cursor:default"></div>`;
            }
            
            html += '</div></div>';
        });
        
        html += '</div>';
        
        container.innerHTML = html;
    },
    
    // ── Licencias Médicas ──
    async cargarLicencias() {
        const mes = document.getElementById('filtro-mes-licencia').value;
        const anio = new Date().getFullYear();
        
        try {
            const r = await fetch(`/api/asistencia/licencias?mes=${mes}&anio=${anio}`);
            const licencias = await r.json();
            this.renderTablaLicencias(licencias);
        } catch(e) {
            console.error('Error cargando licencias:', e);
        }
    },
    
    renderTablaLicencias(licencias) {
        const tbody = document.getElementById('tabla-licencias');
        if (!tbody) return;
        
        if (licencias.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Sin licencias médicas registradas</td></tr>';
            return;
        }
        
        tbody.innerHTML = licencias.map(l => {
            const estadoBadge = l.estado === 'aprobada' ? 'badge-success' : 
                               l.estado === 'rechazada' ? 'badge-danger' : 'badge-warning';
            
            const dias = Math.ceil((new Date(l.fecha_fin) - new Date(l.fecha_inicio)) / (1000 * 60 * 60 * 24)) + 1;
            
            return `
                <tr>
                    <td><strong>${l.nombre}</strong></td>
                    <td>${this.formatDate(l.fecha_inicio)}</td>
                    <td>${this.formatDate(l.fecha_fin)}</td>
                    <td><strong>${dias}</strong> días</td>
                    <td class="text-muted">${l.diagnostico || '-'}</td>
                    <td class="text-muted">${l.medico || '-'}</td>
                    <td><span class="badge ${estadoBadge}">${l.estado}</span></td>
                    <td class="table-actions">
                        ${l.estado === 'pendiente' ? `
                            <button class="btn btn-sm btn-success" onclick="Asistencia.cambiarEstadoLicencia(${l.id}, 'aprobada')">✓</button>
                            <button class="btn btn-sm btn-danger" onclick="Asistencia.cambiarEstadoLicencia(${l.id}, 'rechazada')">✗</button>
                        ` : ''}
                    </td>
                </tr>
            `;
        }).join('');
    },
    
    async cambiarEstadoLicencia(id, estado) {
        try {
            await fetch(`/api/asistencia/licencias/${id}/estado`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado })
            });
            this.cargarLicencias();
        } catch(e) {
            this.mostrarError('Error actualizando licencia');
        }
    },
    
    // ── Vacaciones ──
    async cargarVacaciones() {
        try {
            const r = await fetch('/api/asistencia/vacaciones');
            const vacaciones = await r.json();
            this.renderTablaVacaciones(vacaciones);
        } catch(e) {
            console.error('Error cargando vacaciones:', e);
        }
    },
    
    renderTablaVacaciones(vacaciones) {
        const tbody = document.getElementById('tabla-vacaciones');
        if (!tbody) return;
        
        if (vacaciones.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Sin vacaciones registradas</td></tr>';
            return;
        }
        
        tbody.innerHTML = vacaciones.map(v => `
            <tr>
                <td><strong>${v.nombre}</strong></td>
                <td>${this.formatDate(v.fecha_inicio)}</td>
                <td>${this.formatDate(v.fecha_fin)}</td>
                <td><strong>${v.dias}</strong> días</td>
                <td><span class="badge badge-info">${v.estado || 'Programado'}</span></td>
            </tr>
        `).join('');
    },
    
    // ── Reportes y Rankings ──
    async cargarReportes() {
        const mes = document.getElementById('filtro-mes-reporte').value;
        const anio = new Date().getFullYear();
        
        try {
            const [reporteR, rankingAsistenciaR, rankingHorasR] = await Promise.all([
                fetch(`/api/asistencia/reporte-mensual?mes=${mes}&anio=${anio}`),
                fetch(`/api/asistencia/ranking?mes=${mes}&anio=${anio}&tipo=asistencia`),
                fetch(`/api/asistencia/ranking?mes=${mes}&anio=${anio}&tipo=horas`)
            ]);
            
            const reporte = await reporteR.json();
            const rankingAsistencia = await rankingAsistenciaR.json();
            const rankingHoras = await rankingHorasR.json();
            
            this.renderReporte(reporte);
            this.renderRanking('ranking-asistencia', rankingAsistencia, 'días');
            this.renderRanking('ranking-horas', rankingHoras, 'horas');
        } catch(e) {
            console.error('Error cargando reportes:', e);
        }
    },
    
    renderReporte(reporte) {
        const tbody = document.getElementById('tabla-reporte');
        if (!tbody) return;
        
        if (reporte.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Sin datos para este mes</td></tr>';
            return;
        }
        
        tbody.innerHTML = reporte.map((r, i) => {
            const diasLaborables = 22;
            const asistidos = diasLaborables - r.faltas;
            const porcentaje = ((asistidos / diasLaborables) * 100).toFixed(0);
            
            return `
                <tr>
                    <td><strong>${i + 1}</strong></td>
                    <td><strong>${r.nombre}</strong></td>
                    <td>${asistidos}</td>
                    <td><span class="text-danger font-semibold">${r.faltas}</span></td>
                    <td>${r.permisos_aprobados}</td>
                    <td>${r.dias_licencia} días</td>
                    <td>${r.vacaciones}</td>
                    <td>
                        <div class="flex items-center gap-2">
                            <div style="width:60px;height:6px;background:var(--gray-200);border-radius:3px;overflow:hidden">
                                <div style="width:${porcentaje}%;height:100%;background:${porcentaje >= 80 ? 'var(--success)' : porcentaje >= 60 ? 'var(--warning)' : 'var(--danger)'};border-radius:3px"></div>
                            </div>
                            <span class="text-sm font-semibold">${porcentaje}%</span>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },
    
    renderRanking(containerId, ranking, unidad) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (ranking.length === 0) {
            container.innerHTML = '<p class="text-center text-muted">Sin datos</p>';
            return;
        }
        
        const medals = ['🥇', '🥈', '🥉'];
        
        container.innerHTML = ranking.slice(0, 3).map((r, i) => {
            const value = unidad === 'días' ? r.dias_asistidos : parseFloat(r.horas_totales).toFixed(1);
            const sizeClass = i === 0 ? 'podium-first' : i === 1 ? 'podium-second' : 'podium-third';
            
            return `
                <div class="ranking-card ${sizeClass}" style="min-width:150px">
                    <div class="ranking-position">${medals[i]}</div>
                    <div class="ranking-name">${r.nombre}</div>
                    <div class="ranking-value">${value}</div>
                    <div class="ranking-label">${unidad}</div>
                </div>
            `;
        }).join('');
    },
    
    // ── Modales ──
    abrirModalPermiso() {
        document.getElementById('modalPermiso').classList.add('show');
    },
    
    cerrarModalPermiso() {
        document.getElementById('modalPermiso').classList.remove('show');
    },
    
    async guardarPermiso() {
        const trabajador_id = document.getElementById('permiso-trabajador').value;
        const tipo = document.getElementById('permiso-tipo').value;
        const fecha_inicio = document.getElementById('permiso-inicio').value;
        const fecha_fin = document.getElementById('permiso-fin').value;
        const motivo = document.getElementById('permiso-motivo').value;
        
        if (!trabajador_id || !fecha_inicio || !fecha_fin) {
            this.mostrarError('Completa todos los campos obligatorios');
            return;
        }
        
        try {
            const r = await fetch('/api/asistencia/permisos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trabajador_id, tipo, fecha_inicio, fecha_fin, motivo })
            });
            
            if (r.ok) {
                this.cerrarModalPermiso();
                this.cargarPermisos();
                this.mostrarExito('Permiso registrado');
            }
        } catch(e) {
            this.mostrarError('Error guardando permiso');
        }
    },
    
    abrirModalLicencia() {
        document.getElementById('modalLicencia').classList.add('show');
    },
    
    cerrarModalLicencia() {
        document.getElementById('modalLicencia').classList.remove('show');
    },
    
    async guardarLicencia() {
        const trabajador_id = document.getElementById('licencia-trabajador').value;
        const fecha_inicio = document.getElementById('licencia-inicio').value;
        const fecha_fin = document.getElementById('licencia-fin').value;
        const diagnostico = document.getElementById('licencia-diagnostico').value;
        const medico = document.getElementById('licencia-medico').value;
        
        if (!trabajador_id || !fecha_inicio || !fecha_fin) {
            this.mostrarError('Completa todos los campos obligatorios');
            return;
        }
        
        try {
            const r = await fetch('/api/asistencia/licencias', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trabajador_id, fecha_inicio, fecha_fin, diagnostico, medico })
            });
            
            if (r.ok) {
                this.cerrarModalLicencia();
                this.cargarLicencias();
                this.mostrarExito('Licencia médica registrada');
            }
        } catch(e) {
            this.mostrarError('Error guardando licencia');
        }
    },
    
    abrirModalVacacion() {
        document.getElementById('modalVacacion').classList.add('show');
    },
    
    cerrarModalVacacion() {
        document.getElementById('modalVacacion').classList.remove('show');
    },
    
    async guardarVacacion() {
        const trabajador_id = document.getElementById('vacacion-trabajador').value;
        const fecha_inicio = document.getElementById('vacacion-inicio').value;
        const fecha_fin = document.getElementById('vacacion-fin').value;
        const dias = document.getElementById('vacacion-dias').value;
        
        if (!trabajador_id || !fecha_inicio || !fecha_fin || !dias) {
            this.mostrarError('Completa todos los campos obligatorios');
            return;
        }
        
        try {
            const r = await fetch('/api/asistencia/vacaciones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trabajador_id, fecha_inicio, fecha_fin, dias: parseInt(dias) })
            });
            
            if (r.ok) {
                this.cerrarModalVacacion();
                this.cargarVacaciones();
                this.mostrarExito('Vacación registrada');
            }
        } catch(e) {
            this.mostrarError('Error guardando vacación');
        }
    },
    
    // ── Helpers ──
    llenarSelectores() {
        const options = this.trabajadores.map(t => 
            `<option value="${t.id}">${t.nombre}</option>`
        ).join('');
        
        const defaultOption = '<option value="">Seleccionar...</option>';
        
        const permisoSelect = document.getElementById('permiso-trabajador');
        const licenciaSelect = document.getElementById('licencia-trabajador');
        const vacacionSelect = document.getElementById('vacacion-trabajador');
        
        if (permisoSelect) permisoSelect.innerHTML = defaultOption + options;
        if (licenciaSelect) licenciaSelect.innerHTML = defaultOption + options;
        if (vacacionSelect) vacacionSelect.innerHTML = defaultOption + options;
    },
    
    formatTime(timeStr) {
        if (!timeStr) return '-';
        return timeStr.slice(0, 5);
    },
    
    formatDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('es-CL');
    },
    
    mostrarExito(msg) {
        // TODO: Integrar con sistema de notificaciones
        alert(msg);
    },
    
    mostrarError(msg) {
        alert('Error: ' + msg);
    }
};

// ═══════ Funciones globales para onclick ═══════
function showTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(`tab-${tab}`).classList.add('active');
    event.target.classList.add('active');
    
    if (tab === 'reportes') {
        Asistencia.cargarReportes();
    }
    if (tab === 'calendario') {
        Asistencia.cargarCalendario();
    }
}

function marcarFalta(id) { Asistencia.marcar(id, true); }
function corregirFalta(id) { Asistencia.marcar(id, false); }
function cargarAsistencia() { Asistencia.cargarAsistencia(); }
function cargarPermisos() { Asistencia.cargarPermisos(); }
function cargarLicencias() { Asistencia.cargarLicencias(); }
function cargarVacaciones() { Asistencia.cargarVacaciones(); }
function cargarReportes() { Asistencia.cargarReportes(); }
function cargarCalendario() { Asistencia.cargarCalendario(); }
function abrirModalPermiso() { Asistencia.abrirModalPermiso(); }
function cerrarModalPermiso() { Asistencia.cerrarModalPermiso(); }
function guardarPermiso() { Asistencia.guardarPermiso(); }
function abrirModalLicencia() { Asistencia.abrirModalLicencia(); }
function cerrarModalLicencia() { Asistencia.cerrarModalLicencia(); }
function guardarLicencia() { Asistencia.guardarLicencia(); }
function abrirModalVacacion() { Asistencia.abrirModalVacacion(); }
function cerrarModalVacacion() { Asistencia.cerrarModalVacacion(); }
function guardarVacacion() { Asistencia.guardarVacacion(); }

// ═══════ Auto-init ═══════
document.addEventListener('DOMContentLoaded', () => Asistencia.init());
