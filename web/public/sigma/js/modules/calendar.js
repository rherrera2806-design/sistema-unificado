App.registerModule('calendar', {
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),

    async render() {
        const el = document.getElementById('page-calendar');
        const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        const today = new Date();
        const firstDay = new Date(this.currentYear, this.currentMonth, 1);
        const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
        const startDay = firstDay.getDay();
        const daysInMonth = lastDay.getDate();
        const daysInPrev = new Date(this.currentYear, this.currentMonth, 0).getDate();
        const events = await this.getEvents();

        el.innerHTML = '<style>'
            + '@keyframes calFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}'
            + '.cal-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}'
            + '.cal-card:hover{transform:translateY(-3px);box-shadow:0 12px 28px rgba(0,0,0,0.12)!important}'
            + '.cal-day{transition:all 0.2s cubic-bezier(0.4,0,0.2,1);cursor:pointer}'
            + '.cal-day:hover{transform:scale(1.06);box-shadow:0 6px 16px rgba(59,130,246,0.18)!important;z-index:2}'
            + '.cal-event{transition:all 0.2s ease;border-radius:6px}'
            + '.cal-event:hover{transform:translateX(3px);filter:brightness(0.95)}'
            + '.cal-nav-btn{transition:all 0.2s cubic-bezier(0.4,0,0.2,1)}'
            + '.cal-nav-btn:hover{transform:translateY(-1px)!important;box-shadow:0 4px 12px rgba(0,0,0,0.15)!important}'
            + '.cal-legend{transition:all 0.2s ease}'
            + '.cal-legend:hover{transform:scale(1.05)!important}'
            + '.cal-header-cell{transition:all 0.2s ease}'
            + '.cal-header-cell:hover{background:#e0e7ff!important}'
            + '</style>'

            + '<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:20px 36px;margin-bottom:20px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3);animation:calFadeUp 0.5s ease both">'
            + '<div style="position:absolute;top:-40px;right:-40px;width:200px;height:200px;background:radial-gradient(circle,rgba(59,130,246,0.25) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="position:absolute;bottom:-60px;left:30%;width:300px;height:200px;background:radial-gradient(circle,rgba(139,92,246,0.18) 0%,transparent 70%);border-radius:50%"></div>'
            + '<div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">'
            + '<div>'
            + '<h2 style="margin:0;font-size:22px;font-weight:800;color:white;letter-spacing:-0.5px;text-shadow:0 2px 4px rgba(0,0,0,0.2)">Calendario de Mantenimiento</h2>'
            + '<p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.7)">Visualización mensual de actividades</p>'
            + '</div>'
            + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
            + '<button class="cal-nav-btn" onclick="App.modules.calendar.navigate(-1)" style="background:rgba(255,255,255,0.15);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:8px 16px;color:white;font-size:12px;font-weight:600;cursor:pointer">◀ Anterior</button>'
            + '<button class="cal-nav-btn" onclick="App.modules.calendar.navigate(0, true)" style="background:rgba(255,255,255,0.2);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.25);border-radius:10px;padding:8px 16px;color:white;font-size:12px;font-weight:700;cursor:pointer">Hoy</button>'
            + '<button class="cal-nav-btn" onclick="App.modules.calendar.navigate(1)" style="background:rgba(255,255,255,0.15);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:8px 16px;color:white;font-size:12px;font-weight:600;cursor:pointer">Siguiente ▶</button>'
            + '</div></div></div>'

            + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;animation:calFadeUp 0.5s ease 0.1s both">'
            + '<div style="background:white;border:1px solid #e2e8f0;border-radius:14px;padding:12px 24px;box-shadow:0 1px 3px rgba(0,0,0,0.04);display:flex;align-items:center;gap:16px">'
            + '<h3 style="margin:0;font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-0.3px">' + monthNames[this.currentMonth] + ' ' + this.currentYear + '</h3>'
            + '</div>'
            + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
            + '<span class="cal-legend" style="display:inline-flex;align-items:center;gap:6px;background:white;border:1px solid #e2e8f0;border-radius:10px;padding:6px 14px;font-size:12px;font-weight:600;color:#c62828;box-shadow:0 1px 3px rgba(0,0,0,0.04)">'
            + '<span style="width:8px;height:8px;border-radius:50%;background:#c62828"></span>Vencida</span>'
            + '<span class="cal-legend" style="display:inline-flex;align-items:center;gap:6px;background:white;border:1px solid #e2e8f0;border-radius:10px;padding:6px 14px;font-size:12px;font-weight:600;color:#0277bd;box-shadow:0 1px 3px rgba(0,0,0,0.04)">'
            + '<span style="width:8px;height:8px;border-radius:50%;background:#0277bd"></span>Programada</span>'
            + '<span class="cal-legend" style="display:inline-flex;align-items:center;gap:6px;background:white;border:1px solid #e2e8f0;border-radius:10px;padding:6px 14px;font-size:12px;font-weight:600;color:#2e7d32;box-shadow:0 1px 3px rgba(0,0,0,0.04)">'
            + '<span style="width:8px;height:8px;border-radius:50%;background:#2e7d32"></span>Realizada</span>'
            + '</div></div>'

            + '<div style="background:white;border:1px solid #e2e8f0;border-radius:16px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:calFadeUp 0.5s ease 0.2s both">'
            + '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:2px">'
            + '<div class="cal-header-cell" style="background:#f1f5f9;border-radius:8px 0 0 0;padding:12px 8px;text-align:center;font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.5px">Dom</div>'
            + '<div class="cal-header-cell" style="background:#f1f5f9;padding:12px 8px;text-align:center;font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.5px">Lun</div>'
            + '<div class="cal-header-cell" style="background:#f1f5f9;padding:12px 8px;text-align:center;font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.5px">Mar</div>'
            + '<div class="cal-header-cell" style="background:#f1f5f9;padding:12px 8px;text-align:center;font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.5px">Mié</div>'
            + '<div class="cal-header-cell" style="background:#f1f5f9;padding:12px 8px;text-align:center;font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.5px">Jue</div>'
            + '<div class="cal-header-cell" style="background:#f1f5f9;padding:12px 8px;text-align:center;font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.5px">Vie</div>'
            + '<div class="cal-header-cell" style="background:#f1f5f9;border-radius:0 8px 0 0;padding:12px 8px;text-align:center;font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.5px">Sáb</div>'
            + '</div>'
            + '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px">'
            + this.renderDays(startDay, daysInMonth, daysInPrev, today, events)
            + '</div></div>';
    },

    async getEvents() {
        const events = [];
        const today = new Date().toISOString().split('T')[0];

        const data = await fetch(`/api/sigma/calendar-data?month=${this.currentMonth + 1}&year=${this.currentYear}`).then(r => r.json()).catch(() => ({ preventivos: [], correctivos: [], maquinas: [], componentes: [] }));

        const maqMap = {};
        (data.maquinas || []).forEach(m => { maqMap[m.id] = m; });
        const compMap = {};
        (data.componentes || []).forEach(c => { compMap[c.id] = c; });

        for (const r of (data.preventivos || [])) {
            const maq = maqMap[r.maquina_id];
            const comp = compMap[r.componente_id];
            const label = `${maq ? maq.codigo : ''}: ${comp ? comp.nombre : ''}`;
            if (r.fecha_programada) {
                let status = r.estado;
                if (r.estado !== 'Realizada' && r.fecha_programada < today) {
                    status = 'Vencida';
                }
                events.push({ date: r.fecha_programada, title: label, status: status });
            }
            if (r.fecha_ejecutada && r.fecha_ejecutada !== r.fecha_programada)
                events.push({ date: r.fecha_ejecutada, title: `✅ ${label}`, status: 'Realizada' });
        }

        for (const r of (data.correctivos || [])) {
            const maq = maqMap[r.maquina_id];
            const comp = compMap[r.componente_id];
            if (r.fecha_falla) {
                const status = r.estado === 'Reparada' ? 'Realizada' : 'Vencida';
                const icon = r.estado === 'Reparada' ? '✅' : '🔴';
                events.push({ date: r.fecha_falla, title: `${icon} ${maq ? maq.codigo : ''}: ${comp ? comp.nombre : ''}`, status: status });
            }
        }
        return events;
    },

    renderDays(startDay, daysInMonth, daysInPrev, today, allEvents) {
        let html = '';
        const baseDayStyle = 'background:#f8fafc;border-radius:10px;padding:10px 8px;min-height:100px;position:relative;overflow:hidden';
        const baseNumStyle = 'font-size:14px;font-weight:700;margin-bottom:6px';
        for (let d = startDay - 1; d >= 0; d--) html += '<div class="cal-day cal-other-month" style="' + baseDayStyle + ';opacity:0.5"><div style="' + baseNumStyle + ';color:#94a3b8">' + (daysInPrev - d) + '</div></div>';
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = today.getFullYear() === this.currentYear && today.getMonth() === this.currentMonth && today.getDate() === day;
            const dayEvents = allEvents.filter(e => e.date === dateStr);
            const bgStyle = isToday ? 'background:linear-gradient(135deg,#3b82f6,#1e40af);box-shadow:0 4px 14px rgba(59,130,246,0.35)' : 'background:white;border:1px solid #e2e8f0';
            const numColor = isToday ? 'color:#ffffff' : 'color:#0f172a';
            html += '<div class="cal-day cal-day-cell" style="' + baseDayStyle + ';' + bgStyle + '">'
                + '<div style="' + baseNumStyle + ';' + numColor + '">' + day + '</div>'
                + dayEvents.map(function(e) {
                    const bg = e.status === 'Realizada' ? '#e8f5e9' : e.status === 'Vencida' ? '#ffebee' : '#e3f2fd';
                    const fg = e.status === 'Realizada' ? '#2e7d32' : e.status === 'Vencida' ? '#c62828' : '#0277bd';
                    return '<div class="cal-event" style="background:' + bg + ';color:' + fg + ';padding:4px 8px;border-radius:6px;font-size:11px;font-weight:600;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.06)" title="' + (e.title || '').replace(/"/g, '&quot;') + '">' + e.title + '</div>';
                }).join('')
                + '</div>';
        }
        const remaining = 7 - ((startDay + daysInMonth) % 7 || 7);
        for (let day = 1; day <= remaining; day++) html += '<div class="cal-day cal-other-month" style="' + baseDayStyle + ';opacity:0.5"><div style="' + baseNumStyle + ';color:#94a3b8">' + day + '</div></div>';
        return html;
    },

    navigate(delta, toToday = false) {
        if (toToday) { this.currentMonth = new Date().getMonth(); this.currentYear = new Date().getFullYear(); }
        else { this.currentMonth += delta; if (this.currentMonth > 11) { this.currentMonth = 0; this.currentYear++; } if (this.currentMonth < 0) { this.currentMonth = 11; this.currentYear--; } }
        this.render();
    },

    async exportICS() {
        const events = await this.getEvents();
        const monthEvents = events.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === this.currentMonth && d.getFullYear() === this.currentYear;
        });

        if (monthEvents.length === 0) {
            App.showAlert('No hay eventos este mes para exportar', 'warning');
            return;
        }

        let ical = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//SIGMA//Mantenimiento//ES\nCALSCALE:GREGORIAN\n';

        for (const e of monthEvents) {
            const date = e.date.replace(/-/g, '');
            ical += `BEGIN:VEVENT\nDTSTART:${date}\nSUMMARY:${e.title}\nDESCRIPTION:Estado: ${e.status}\nEND:VEVENT\n`;
        }

        ical += 'END:VCALENDAR';

        const blob = new Blob([ical], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mantenimiento_${this.currentYear}_${String(this.currentMonth + 1).padStart(2, '0')}.ics`;
        a.click();
        URL.revokeObjectURL(url);

        App.showAlert(`📅 Archivo .ics exportado con ${monthEvents.length} eventos`);
    },

    async exportImage() {
        const events = await this.getEvents();
        const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        const monthEvents = events.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === this.currentMonth && d.getFullYear() === this.currentYear;
        });

        let text = `📋 *Calendario de Mantenimiento*\n🗓️ ${monthNames[this.currentMonth]} ${this.currentYear}\n\n`;

        const grouped = {};
        for (const e of monthEvents) {
            if (!grouped[e.date]) grouped[e.date] = [];
            grouped[e.date].push(e);
        }

        const sortedDates = Object.keys(grouped).sort();
        for (const date of sortedDates) {
            const d = new Date(date + 'T12:00:00');
            const dayName = d.toLocaleDateString('es-CL', { weekday: 'long' });
            const dayNum = d.getDate();
            text += `*${dayName} ${dayNum}:*\n`;
            for (const e of grouped[date]) {
                const icon = e.status === 'Realizada' ? '✅' : e.status === 'Vencida' ? '🔴' : '🔵';
                text += `${icon} ${e.title}\n`;
            }
            text += '\n';
        }

        if (monthEvents.length === 0) {
            text += '_No hay mantenciones programadas este mes_\n';
        }

        text += `\n_Total: ${monthEvents.length} mantenciones_`;

        if (navigator.share) {
            try {
                await navigator.share({ title: 'Calendario SIGMA', text: text });
            } catch(e) {
                this.copyToClipboard(text);
            }
        } else {
            this.copyToClipboard(text);
        }
    },

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            App.showAlert('📋 Texto copiado. Pégalo en WhatsApp');
        }).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            App.showAlert('📋 Texto copiado. Pégalo en WhatsApp');
        });
    }
});
