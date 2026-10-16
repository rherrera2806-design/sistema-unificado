// ============================================================================
// Horarios de Turno (Producción → Horarios de Turno)
// Configuración MES A MES de los horarios de Día y Noche (cambian según la
// época). Lo que no esté contemplado en esos rangos se registra como ⚡ Extra.
// Protegido por el permiso 'prod_horarios' (visible en el árbol de Usuarios):
// el Taller solo LEE esta configuración para sugerir el turno; modificarla
// exige este permiso. Escala 20/15/13/11/10 · estilo del sistema.
// ============================================================================
App.registerModule('prod_horarios', {
    _horarios: [],

    async render() {
        const el = document.getElementById('page-prod_horarios');
        if (!el) return;
        const hoy = new Date();
        const mesActual = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0');
        el.innerHTML = this._estilos() + `
            <div class="ht-hero">
                <div>
                    <h2>Horarios de Turno</h2>
                    <p>Horarios de Día y Noche por mes (según la época) · lo no contemplado en el rango = ⚡ Extra</p>
                </div>
            </div>

            <div class="ht-panel">
                <div class="ht-p-head"><h3>Configurar mes</h3><span class="sub">aplica a la sugerencia de turno del Taller y a la clasificación de horas</span></div>
                <div class="ht-p-body">
                    <div class="ht-grid">
                        <div class="ht-field"><label>Mes</label><input type="month" id="htMes" value="${mesActual}" onchange="App.modules.prod_horarios.cargarMes()"></div>
                        <div class="ht-field"><label>☀️ Día inicio</label><input type="time" id="htDiaIni" value="06:00"></div>
                        <div class="ht-field"><label>☀️ Día fin</label><input type="time" id="htDiaFin" value="22:00"></div>
                        <div class="ht-field"><label>🌙 Noche inicio</label><input type="time" id="htNocIni" value="22:00"></div>
                        <div class="ht-field"><label>🌙 Noche fin</label><input type="time" id="htNocFin" value="06:00"></div>
                    </div>
                    <div class="ht-hint">Los horarios cambian según la época: configúralos <strong>mes a mes</strong>. Ejemplo de turno nocturno que cruza medianoche: inicio 22:00 · fin 06:00. Todo minuto fuera de estos rangos se registra como <strong>⚡ Extra</strong>.</div>
                    <button class="ht-btn" id="htGuardar" onclick="App.modules.prod_horarios.guardarMes()">Guardar mes</button>
                </div>
            </div>

            <div class="ht-panel" style="margin-top:14px">
                <div class="ht-p-head"><h3>Meses configurados</h3><span class="sub">los últimos configurados</span></div>
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
            if (!meses[clave]) meses[clave] = {};
            meses[clave][h.turno] = h;
        }
        const claves = Object.keys(meses).sort().reverse();
        if (!claves.length) {
            el.innerHTML = '<div class="ht-loading">Todavía no hay meses configurados. Arriba elige el mes y guarda.</div>';
            return;
        }
        el.innerHTML = '<table class="ht-table"><thead><tr><th>Mes</th><th>☀️ Día</th><th>🌙 Noche</th><th></th></tr></thead><tbody>'
            + claves.map(k => {
                const d = meses[k].dia || {};
                const n = meses[k].noche || {};
                return `<tr>
                    <td><strong>${this._mesTexto(k)}</strong></td>
                    <td>${d.hora_inicio || '—'} → ${d.hora_fin || '—'}</td>
                    <td>${n.hora_inicio || '—'} → ${n.hora_fin || '—'}</td>
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
        const dia = (this._horarios || []).find(h => Number(h.anio) === anio && Number(h.mes) === mes && h.turno === 'dia');
        const noche = (this._horarios || []).find(h => Number(h.anio) === anio && Number(h.mes) === mes && h.turno === 'noche');
        document.getElementById('htDiaIni').value = (dia && dia.hora_inicio) || '06:00';
        document.getElementById('htDiaFin').value = (dia && dia.hora_fin) || '22:00';
        document.getElementById('htNocIni').value = (noche && noche.hora_inicio) || '22:00';
        document.getElementById('htNocFin').value = (noche && noche.hora_fin) || '06:00';
    },

    async guardarMes() {
        const ym = document.getElementById('htMes')?.value || '';
        const [anio, mes] = ym.split('-').map(Number);
        if (!anio || !mes) { App.showAlert('Selecciona un mes', 'danger'); return; }
        const filas = [
            { anio, mes, turno: 'dia', hora_inicio: document.getElementById('htDiaIni').value, hora_fin: document.getElementById('htDiaFin').value },
            { anio, mes, turno: 'noche', hora_inicio: document.getElementById('htNocIni').value, hora_fin: document.getElementById('htNocFin').value }
        ];
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
                App.showAlert('Horarios guardados para ' + this._mesTexto(ym), 'success');
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
            .ht-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
            .ht-field label{display:block;font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#475569;margin-bottom:5px}
            .ht-field input{width:100%;padding:10px 12px;border:1px solid #e4e9f0;border-radius:8px;font-size:13px;outline:none;color:#0f172a;background:#fff}
            .ht-field input:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.12)}
            .ht-hint{font-size:11px;color:#8494a8;margin:12px 0}
            .ht-btn{padding:9px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid transparent;background:#1e40af;color:#fff}
            .ht-btn:hover{background:#1e3a8a}
            .ht-btn:disabled{opacity:.6;cursor:default}
            .ht-btn.ghost{background:#fff;color:#475569;border-color:#e4e9f0}
            .ht-btn.sm{padding:6px 11px;font-size:11px}
            .ht-loading{text-align:center;padding:26px;color:#8494a8;font-size:13px}
            .ht-table{width:100%;border-collapse:collapse}
            .ht-table th{padding:10px 14px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#8494a8;background:#f8fafc;border-bottom:1px solid #e4e9f0}
            .ht-table td{padding:11px 14px;font-size:13px;border-bottom:1px solid #f1f5f9}
            .ht-table tbody tr:hover{background:#f8fafc}
            .ht-table .c-acc{text-align:right}
            @media(max-width:768px){ .ht-grid{grid-template-columns:1fr 1fr} }
        </style>`;
    }
});
