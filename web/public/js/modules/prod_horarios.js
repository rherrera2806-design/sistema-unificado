// ============================================================================
// Horarios de Turno (Producción → Horarios de Turno)
// Configuración MES A MES de la SEMANA: por cada día de la semana, el turno
// ☀️ Día y el 🌙 Noche con su hora de inicio y fin (pueden terminar al día
// siguiente al cruzar medianoche). El recorte de horas en Chile es gradual
// (jueves -1h, viernes -2h, quizá miércoles...), por eso todo es configurable
// mes a mes. Lo que no esté contemplado en las ventanas = ⚡ Extra.
// El turno se acredita al día en que TERMINA (ej: Lun 22:00 → Mar 07:30 =
// Martes; el especial Dom 00:00 → Lun 07:30 = Lunes).
// Protegido por el permiso 'prod_horarios' (árbol de Usuarios).
// Escala 20/15/13/11/10 · estilo del sistema.
// ============================================================================
App.registerModule('prod_horarios', {
    _horarios: [],
    _dias: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],

    async render() {
        const el = document.getElementById('page-prod_horarios');
        if (!el) return;
        const hoy = new Date();
        const mesActual = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0');
        el.innerHTML = this._estilos() + `
            <div class="ht-hero">
                <div>
                    <h2>Horarios de Turno</h2>
                    <p>Horarios de la semana por mes (según la época y el recorte de horas) · lo no contemplado = ⚡ Extra</p>
                </div>
            </div>

            <div class="ht-panel">
                <div class="ht-p-head">
                    <h3>Configurar mes</h3>
                    <span class="sub">cada día tiene su turno Día y Noche · el turno se acredita al día en que termina</span>
                </div>
                <div class="ht-p-body">
                    <div class="ht-mes-row">
                        <div class="ht-field"><label>Mes</label><input type="month" id="htMes" value="${mesActual}" onchange="App.modules.prod_horarios.cargarMes()"></div>
                        <button class="ht-btn ghost" onclick="App.modules.prod_horarios.copiarMesAnterior()">Copiar mes anterior</button>
                    </div>
                    <div class="ht-hint">
                        El turno <strong>🌙 Noche</strong> que cruza medianoche marca <strong>"termina al día siguiente"</strong> y se acredita al día de término
                        (ej: Lun 22:00 → Mar 07:30 = <strong>Martes</strong>). El caso especial del <strong>domingo</strong>: Noche 00:00 → Lun 07:30 = <strong>Lunes</strong>.
                        Deja vacío un turno si ese día no se trabaja.
                    </div>
                    <div class="ht-table-wrap">
                        <table class="ht-table ht-semana">
                            <thead>
                                <tr>
                                    <th>Día</th>
                                    <th>☀️ Día inicio</th>
                                    <th>☀️ Día fin</th>
                                    <th>🌙 Noche inicio</th>
                                    <th>🌙 Noche fin</th>
                                    <th>Termina</th>
                                </tr>
                            </thead>
                            <tbody>${this._dias.map((nom, i) => `
                                <tr>
                                    <td class="c-dia"><strong>${nom}</strong></td>
                                    <td><input type="time" id="htDiaIni${i}"></td>
                                    <td><input type="time" id="htDiaFin${i}"></td>
                                    <td><input type="time" id="htNocIni${i}"></td>
                                    <td><input type="time" id="htNocFin${i}"></td>
                                    <td class="c-fin"><label class="ht-check"><input type="checkbox" id="htNocSig${i}"> día siguiente</label></td>
                                </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                    <button class="ht-btn" id="htGuardar" onclick="App.modules.prod_horarios.guardarMes()">Guardar mes</button>
                </div>
            </div>

            <div class="ht-panel" style="margin-top:14px">
                <div class="ht-p-head"><h3>Meses configurados</h3><span class="sub">elige "Editar" para ajustar la semana de un mes</span></div>
                <div class="ht-p-body" id="htLista"><div class="ht-loading">Cargando...</div></div>
            </div>`;
        await this.cargarTodo();
    },

    _mesTexto(ym) {
        const [anio, mes] = String(ym).split('-').map(Number);
        const nombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return (nombres[mes - 1] || '') + ' ' + (anio || '');
    },

    async cargarTodo() {
        try {
            const res = await fetch('/api/taller/horarios');
            this._horarios = res.ok ? await res.json() : [];
        } catch (e) {
            this._horarios = [];
            App.showAlert('Error al cargar los horarios: ' + e.message, 'danger');
        }
        this.renderLista();
        await this.cargarMes();
    },

    renderLista() {
        const el = document.getElementById('htLista');
        if (!el) return;
        const meses = {};
        for (const h of (this._horarios || [])) {
            const clave = h.anio + '-' + String(h.mes).padStart(2, '0');
            (meses[clave] = meses[clave] || []).push(h);
        }
        const claves = Object.keys(meses).sort().reverse();
        if (!claves.length) {
            el.innerHTML = '<div class="ht-loading">Todavía no hay meses configurados. Arriba elige el mes y carga la semana.</div>';
            return;
        }
        el.innerHTML = '<table class="ht-table"><thead><tr><th>Mes</th><th>Días con turno</th><th>Ejemplos</th><th></th></tr></thead><tbody>'
            + claves.map(k => {
                const filas = meses[k];
                const dias = [...new Set(filas.map(f => Number(f.dia_semana)))].sort((a, b) => a - b);
                const ejemplos = filas.slice(0, 2).map(f =>
                    this._dias[Number(f.dia_semana)].slice(0, 3) + ' ' + (f.turno === 'dia' ? '☀️' : '🌙') + ' ' + f.hora_inicio + '→' + f.hora_fin + (f.dia_siguiente ? '(+1)' : '')).join(' · ');
                return `<tr>
                    <td><strong>${this._mesTexto(k)}</strong></td>
                    <td>${dias.length} de 7</td>
                    <td class="c-ej">${escText(ejemplos)}</td>
                    <td class="c-acc"><button class="ht-btn ghost sm" onclick="App.modules.prod_horarios.editarMes('${k}')">Editar</button></td>
                </tr>`;
            }).join('')
            + '</tbody></table>';
    },

    editarMes(ym) {
        const input = document.getElementById('htMes');
        if (input) { input.value = ym; this.cargarMes(); }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    async cargarMes() {
        const ym = document.getElementById('htMes')?.value || '';
        const [anio, mes] = ym.split('-').map(Number);
        if (!anio || !mes) return;
        for (let i = 0; i < 7; i++) {
            const dia = (this._horarios || []).find(h => Number(h.anio) === anio && Number(h.mes) === mes && Number(h.dia_semana) === i && h.turno === 'dia');
            const noche = (this._horarios || []).find(h => Number(h.anio) === anio && Number(h.mes) === mes && Number(h.dia_semana) === i && h.turno === 'noche');
            document.getElementById('htDiaIni' + i).value = (dia && dia.hora_inicio) || '';
            document.getElementById('htDiaFin' + i).value = (dia && dia.hora_fin) || '';
            document.getElementById('htNocIni' + i).value = (noche && noche.hora_inicio) || '';
            document.getElementById('htNocFin' + i).value = (noche && noche.hora_fin) || '';
            document.getElementById('htNocSig' + i).checked = !!(noche && noche.dia_siguiente);
        }
    },

    copiarMesAnterior() {
        const ym = document.getElementById('htMes')?.value || '';
        const [anio, mes] = ym.split('-').map(Number);
        if (!anio || !mes) return;
        const prev = mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 };
        let copiados = 0;
        for (let i = 0; i < 7; i++) {
            const dia = (this._horarios || []).find(h => Number(h.anio) === prev.anio && Number(h.mes) === prev.mes && Number(h.dia_semana) === i && h.turno === 'dia');
            const noche = (this._horarios || []).find(h => Number(h.anio) === prev.anio && Number(h.mes) === prev.mes && Number(h.dia_semana) === i && h.turno === 'noche');
            if (dia || noche) copiados++;
            document.getElementById('htDiaIni' + i).value = (dia && dia.hora_inicio) || '';
            document.getElementById('htDiaFin' + i).value = (dia && dia.hora_fin) || '';
            document.getElementById('htNocIni' + i).value = (noche && noche.hora_inicio) || '';
            document.getElementById('htNocFin' + i).value = (noche && noche.hora_fin) || '';
            document.getElementById('htNocSig' + i).checked = !!(noche && noche.dia_siguiente);
        }
        if (copiados) App.showAlert('Semana copiada desde ' + this._mesTexto(prev.anio + '-' + String(prev.mes).padStart(2, '0')) + '. Revisa y guarda.', 'success');
        else App.showAlert('El mes anterior no tiene horarios cargados', 'danger');
    },

    async guardarMes() {
        const ym = document.getElementById('htMes')?.value || '';
        const [anio, mes] = ym.split('-').map(Number);
        if (!anio || !mes) { App.showAlert('Selecciona un mes', 'danger'); return; }
        const filas = [];
        for (let i = 0; i < 7; i++) {
            const dIni = document.getElementById('htDiaIni' + i).value;
            const dFin = document.getElementById('htDiaFin' + i).value;
            const nIni = document.getElementById('htNocIni' + i).value;
            const nFin = document.getElementById('htNocFin' + i).value;
            if (dIni && dFin) filas.push({ anio, mes, dia_semana: i, turno: 'dia', hora_inicio: dIni, hora_fin: dFin, dia_siguiente: false });
            if (nIni && nFin) filas.push({ anio, mes, dia_semana: i, turno: 'noche', hora_inicio: nIni, hora_fin: nFin, dia_siguiente: document.getElementById('htNocSig' + i).checked });
        }
        if (!filas.length) { App.showAlert('Carga al menos un turno (deja vacío lo que no aplica)', 'danger'); return; }
        const btn = document.getElementById('htGuardar');
        if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
        try {
            const res = await fetch('/api/taller/horarios', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filas })
            });
            const data = await res.json();
            if (res.ok) {
                App.showAlert('Horarios guardados para ' + this._mesTexto(ym) + ' (' + (data.guardadas || 0) + ' turnos)', 'success');
                await this.cargarTodo();
            } else {
                App.showAlert(data.error || 'Error al guardar', 'danger');
            }
        } catch (e) {
            App.showAlert('Error de conexión: ' + e.message, 'danger');
        }
        if (btn) { btn.disabled = false; btn.textContent = 'Guardar mes'; }
    },

    _estilos() {
        return `<style>
            .ht-hero{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 55%,#1e40af 100%);border-radius:16px;padding:20px 26px;position:relative;overflow:hidden;margin-bottom:16px}
            .ht-hero::after{content:'';position:absolute;left:0;right:0;bottom:0;height:1px;background:linear-gradient(90deg,transparent,rgba(147,197,253,.55),transparent)}
            .ht-hero h2{color:#fff;font-size:20px;font-weight:700;margin:0}
            .ht-hero p{color:rgba(255,255,255,.62);font-size:11px;margin:4px 0 0}
            .ht-panel{background:#fff;border:1px solid #e4e9f0;border-radius:14px;overflow:hidden}
            .ht-p-head{padding:13px 18px;display:flex;align-items:baseline;gap:10px;border-bottom:1px solid #e4e9f0}
            .ht-p-head h3{font-size:13px;font-weight:600;margin:0}
            .ht-p-head .sub{font-size:10px;color:#8494a8}
            .ht-p-body{padding:16px 18px}
            .ht-mes-row{display:flex;gap:12px;align-items:flex-end;margin-bottom:12px;flex-wrap:wrap}
            .ht-field label{display:block;font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#475569;margin-bottom:5px}
            .ht-field input{padding:9px 11px;border:1px solid #e4e9f0;border-radius:8px;font-size:13px;outline:none;color:#0f172a;background:#fff}
            .ht-field input:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.12)}
            .ht-hint{font-size:11px;color:#8494a8;margin:0 0 12px;line-height:1.6}
            .ht-table-wrap{overflow-x:auto;border:1px solid #e4e9f0;border-radius:10px}
            .ht-table{width:100%;border-collapse:collapse}
            .ht-table th{padding:10px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#8494a8;background:#f8fafc;border-bottom:1px solid #e4e9f0}
            .ht-table td{padding:9px 12px;font-size:13px;border-bottom:1px solid #f1f5f9}
            .ht-table tbody tr:hover{background:#f8fafc}
            .ht-table .c-acc{text-align:right}
            .ht-table .c-ej{font-size:11px;color:#64748b}
            .ht-semana .c-dia{white-space:nowrap}
            .ht-semana input[type="time"]{width:118px;padding:8px 10px;border:1px solid #e4e9f0;border-radius:8px;font-size:13px;outline:none;color:#0f172a;background:#fff}
            .ht-semana input[type="time"]:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.12)}
            .ht-check{font-size:11px;color:#475569;display:inline-flex;align-items:center;gap:5px;white-space:nowrap;cursor:pointer}
            .ht-check input{width:15px;height:15px;accent-color:#1e40af}
            .ht-btn{padding:9px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid transparent;background:#1e40af;color:#fff;margin-top:12px}
            .ht-btn:hover{background:#1e3a8a}
            .ht-btn:disabled{opacity:.6;cursor:default}
            .ht-btn.ghost{background:#fff;color:#475569;border-color:#e4e9f0;margin-top:0}
            .ht-btn.sm{padding:6px 11px;font-size:11px;margin-top:0}
            .ht-loading{text-align:center;padding:26px;color:#8494a8;font-size:13px}
            @media(max-width:768px){ .ht-semana input[type="time"]{width:100px} }
        </style>`;
    }
});
