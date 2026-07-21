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

        el.innerHTML = `
            <div class="page-header">
                <div><h2>Calendario de Mantenimiento</h2><div class="subtitle">Visualización mensual de actividades</div></div>
                <div class="btn-group">
                    <button class="btn btn-outline" onclick="App.modules.calendar.navigate(-1)">◀ Anterior</button>
                    <button class="btn btn-outline" onclick="App.modules.calendar.navigate(0, true)">Hoy</button>
                    <button class="btn btn-outline" onclick="App.modules.calendar.navigate(1)">Siguiente ▶</button>
                    <button class="btn btn-success" onclick="App.modules.calendar.exportICS()">📅 Exportar .ics</button>
                    <button class="btn btn-info" onclick="App.modules.calendar.exportImage()">📱 Enviar WhatsApp</button>
                </div>
            </div>
            <div style="text-align:center;margin-bottom:16px"><h3 style="font-size:22px">${monthNames[this.currentMonth]} ${this.currentYear}</h3></div>
            <div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap">
                <span class="status-badge" style="background:#ffebee;color:#c62828;padding:4px 12px">Vencida</span>
                <span class="status-badge" style="background:#e3f2fd;color:#0277bd;padding:4px 12px">Programada</span>
                <span class="status-badge" style="background:#e8f5e9;color:#2e7d32;padding:4px 12px">Realizada</span>
            </div>
            <div class="calendar-grid">
                <div class="calendar-header">Dom</div><div class="calendar-header">Lun</div><div class="calendar-header">Mar</div>
                <div class="calendar-header">Mié</div><div class="calendar-header">Jue</div><div class="calendar-header">Vie</div><div class="calendar-header">Sáb</div>
                ${this.renderDays(startDay, daysInMonth, daysInPrev, today, events)}
            </div>`;
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
        for (let d = startDay - 1; d >= 0; d--) html += `<div class="calendar-day other-month"><div class="day-number">${daysInPrev - d}</div></div>`;
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = today.getFullYear() === this.currentYear && today.getMonth() === this.currentMonth && today.getDate() === day;
            const dayEvents = allEvents.filter(e => e.date === dateStr);
            html += `<div class="calendar-day ${isToday ? 'today' : ''}">
                <div class="day-number">${day}</div>
                ${dayEvents.map(e => {
                    const cls = e.status === 'Realizada' ? 'status-realizada' : e.status === 'Vencida' ? 'status-vencida' : 'status-programada';
                    return `<div class="calendar-event" style="background:${e.status === 'Realizada' ? '#e8f5e9' : e.status === 'Vencida' ? '#ffebee' : '#e3f2fd'};color:${e.status === 'Realizada' ? '#2e7d32' : e.status === 'Vencida' ? '#c62828' : '#0277bd'}" title="${(e.title || '').replace(/"/g, '&quot;')}">${e.title}</div>`;
                }).join('')}
            </div>`;
        }
        const remaining = 7 - ((startDay + daysInMonth) % 7 || 7);
        for (let day = 1; day <= remaining; day++) html += `<div class="calendar-day other-month"><div class="day-number">${day}</div></div>`;
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
