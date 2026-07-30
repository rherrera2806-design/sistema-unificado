App.registerModule('dashboard', {
    async render() {
        const el = document.getElementById('page-dashboard');
        let stats = { totalMachines: 0, completedMaintenance: 0, upcomingMaintenance: 0, overdueMaintenance: 0, totalFailures: 0, criticalSpareParts: 0, recentFailures: [] };
        try { stats = await db.getStatsSummary(); } catch(e) { console.error('Error loading stats:', e); }

        const [overdue, upcoming, recentFailures, recentPreventive, maquinas, componentes, topFailing] = await Promise.all([
            db.getOverdueMaintenance().catch(() => []),
            db.getUpcomingMaintenance(15).catch(() => []),
            stats.recentFailures || [],
            db.getRecentCompleted().catch(() => []),
            db.getAll('machines').catch(() => []),
            db.getAll('components').catch(() => []),
            db.getTopFailingMachines().catch(() => [])
        ]);

        const maqMap = {};
        maquinas.forEach(m => { maqMap[m.id] = m; });
        const compMap = {};
        componentes.forEach(c => { compMap[c.id] = c; });

        const totalMant = (stats.completedMaintenance || 0) + (stats.totalFailures || 0);

        el.innerHTML = '<style>'
            + '@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}'
            + '@keyframes countUp{from{opacity:0;transform:scale(0.8)}to{opacity:1;transform:scale(1)}}'
            + '.dash-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}'
            + '.dash-card:hover{transform:translateY(-3px);box-shadow:0 12px 28px rgba(0,0,0,0.12)!important}'
            + '.dash-podium{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}'
            + '.dash-podium:hover{transform:translateY(-6px) scale(1.02)!important}'
            + '.dash-row{transition:all 0.2s ease}'
            + '.dash-row:hover{transform:translateX(4px)!important;background:#f8fafc!important}'
            + '.dash-section{animation:fadeUp 0.5s ease both}'
            + '.dash-stat-num{animation:countUp 0.6s ease both}'
            + '</style>'

            + '<div class="dashboard-hero">'
            + '<div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px">'
            + '<div><h1>Dashboard Mantencion</h1>'
            + '<p class="subtitle">Vista general del estado de mantencion y fallas</p></div>'
            + '<div class="hero-stats">'
            + '<div class="hero-stat"><div class="hero-stat-value">' + maquinas.length + '</div><div class="hero-stat-label">Maquinas</div></div>'
            + '<div class="hero-stat"><div class="hero-stat-value">' + componentes.length + '</div><div class="hero-stat-label">Componentes</div></div>'
            + '</div></div></div>'

            + '<div class="stats-grid" style="grid-template-columns:repeat(5,1fr)">'
            + this.statCard(totalMant, 'Total Mantenciones', 'blue', '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>', 'M+R completados')
            + this.statCard(stats.completedMaintenance || 0, 'Preventivas', 'green', '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>', 'Realizadas')
            + this.statCard(stats.totalFailures || 0, 'Fallas', 'red', '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>', 'Registradas')
            + this.statCard(stats.overdueMaintenance || 0, 'Vencidas', 'amber', '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>', 'Requieren accion')
            + this.statCard(stats.upcomingMaintenance || 0, 'Proximas (15d)', 'glass', '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1e40af" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>', 'Programadas')
            + '</div>'

            + this.renderTopFailing(topFailing)

            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">'
            + this.renderOverdueLocal(overdue, maqMap, compMap)
            + this.renderUpcomingLocal(upcoming, maqMap, compMap)
            + '</div>'

            + this.renderRecentFailuresLocal(recentFailures, maqMap, compMap)
            + this.renderRecentPreventiveLocal(recentPreventive, maqMap, compMap);
    },

    statCard(value, label, accent, icon, subtitle) {
        return '<div class="stat-card" data-accent="' + accent + '">'
            + '<div class="stat-icon ' + accent + '">' + icon + '</div>'
            + '<div class="stat-info"><h4 class="dash-stat-num">' + value + '</h4>'
            + '<p>' + label + '</p>'
            + '<div style="font-size:0.6875rem;color:#94a3b8;margin-top:2px">' + subtitle + '</div></div></div>';
    },

    renderTopFailing(data) {
        if (!data || data.length === 0) return '';
        const medalStyles = [
            { bg: 'linear-gradient(135deg,#fffbeb,#fef3c7)', border: '#fbbf24', shadow: '0 8px 32px rgba(251,191,36,0.25)', glow: '#fbbf24', text: '#92400e', num: '#b45309', ring: '#f59e0b' },
            { bg: 'linear-gradient(135deg,#f8fafc,#e2e8f0)', border: '#94a3b8', shadow: '0 6px 20px rgba(148,163,184,0.2)', glow: '#94a3b8', text: '#334155', num: '#475569', ring: '#64748b' },
            { bg: 'linear-gradient(135deg,#fff7ed,#fed7aa)', border: '#fb923c', shadow: '0 6px 20px rgba(251,146,60,0.2)', glow: '#fb923c', text: '#7c2d12', num: '#c2410c', ring: '#ea580c' }
        ];
        const medalEmoji = ['&#127942;', '&#129352;', '&#129353;'];
        const order = [1, 0, 2];

        let podium = '<div style="display:flex;align-items:flex-end;justify-content:center;gap:28px;padding:30px 0 10px">';
        order.forEach((dataIdx, i) => {
            const item = data[dataIdx];
            if (!item) return;
            const ms = medalStyles[dataIdx];
            const isCenter = dataIdx === 0;
            const w = isCenter ? 220 : 190;
            const numSize = isCenter ? 48 : 38;
            const nameSize = isCenter ? 14 : 13;
            podium += '<div class="dash-podium" style="width:' + w + 'px;background:' + ms.bg + ';border:2px solid ' + ms.border + ';border-radius:20px;padding:28px 20px 24px;text-align:center;box-shadow:' + ms.shadow + ';cursor:pointer;animation:fadeUp 0.6s ease ' + (i * 150) + 'ms both;position:relative;overflow:hidden">'
                + '<div style="position:absolute;top:-30px;right:-30px;width:100px;height:100px;background:radial-gradient(circle,' + ms.glow + '30 0%,transparent 70%);border-radius:50%"></div>'
                + '<div style="position:relative;z-index:1">'
                + '<div style="font-size:' + (isCenter ? '44' : '36') + 'px;margin-bottom:6px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.1))">' + medalEmoji[dataIdx] + '</div>'
                + '<div style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:' + ms.ring + ';color:white;font-size:13px;font-weight:800;margin-bottom:10px;font-family:\'JetBrains Mono\',monospace">' + (dataIdx + 1) + '</div>'
                + '<div style="font-size:' + nameSize + 'px;font-weight:700;color:' + ms.text + ';margin-bottom:14px;line-height:1.3;min-height:36px;display:flex;align-items:center;justify-content:center">' + escapeHtml(item.nombre || 'Sin nombre') + '</div>'
                + '<div style="font-size:' + numSize + 'px;font-weight:900;color:' + ms.num + ';font-family:\'JetBrains Mono\',monospace;line-height:1">' + item.total_fallas + '</div>'
                + '<div style="font-size:11px;font-weight:700;color:' + ms.ring + ';text-transform:uppercase;letter-spacing:1.5px;margin-top:8px">FALLAS</div>'
                + '</div></div>';
        });
        podium += '</div>';

        let extras = '';
        if (data.length > 3) {
            extras = '<div style="border-top:1px solid #e2e8f0;margin-top:16px;padding-top:16px">';
            data.slice(3, 5).forEach((item, i) => {
                extras += '<div class="dash-row" style="display:flex;align-items:center;justify-content:space-between;padding:12px 20px;border-radius:10px;cursor:pointer;margin-bottom:6px;border:1px solid transparent;transition:all 0.2s ease" '
                    + 'onmouseover="this.style.background=\'#f8fafc\';this.style.borderColor=\'#e2e8f0\';this.style.transform=\'translateX(4px)\'" '
                    + 'onmouseout="this.style.background=\'transparent\';this.style.borderColor=\'transparent\';this.style.transform=\'none\'" '
                    + 'onclick="App.modules.dashboard.goToCorrective(' + item.maquina_id + ')">'
                    + '<div style="display:flex;align-items:center;gap:14px">'
                    + '<div style="width:32px;height:32px;border-radius:8px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#64748b;font-family:\'JetBrains Mono\',monospace">' + (i + 4) + '°</div>'
                    + '<span style="font-size:14px;font-weight:600;color:#1e293b">' + escapeHtml(item.nombre || 'Sin nombre') + '</span></div>'
                    + '<span style="font-size:13px;font-weight:700;color:#ef4444;font-family:\'JetBrains Mono\',monospace;background:#fef2f2;padding:4px 12px;border-radius:20px;border:1px solid #fecaca">' + item.total_fallas + ' fallas</span></div>';
            });
            extras += '</div>';
        }

        return '<div class="dash-section" style="background:white;border:1px solid #e2e8f0;border-radius:14px;margin-bottom:20px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:fadeUp 0.5s ease 200ms both">'
            + '<div style="padding:22px 28px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:12px">'
            + '<div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#fbbf24,#f59e0b);display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 2px 8px rgba(251,191,36,0.3)">&#127942;</div>'
            + '<div><h3 style="margin:0;font-size:17px;font-weight:700;color:#0f172a">Top Maquinas con mas Fallas</h3>'
            + '<p style="margin:2px 0 0;font-size:12px;color:#94a3b8">Ranking de maquinas con mayor cantidad de fallas registradas</p></div></div>'
            + '<div style="padding:24px 28px">' + podium + extras + '</div></div>';
    },

    renderOverdueLocal(data, maqMap, compMap) {
        let body;
        if (data.length === 0) {
            body = '<div style="text-align:center;padding:48px 20px">'
                + '<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#dcfce7,#bbf7d0);display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;box-shadow:0 4px 12px rgba(34,197,94,0.2)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>'
                + '<div style="font-size:14px;font-weight:600;color:#1e293b;margin-bottom:4px">Todo al dia</div>'
                + '<div style="color:#94a3b8;font-size:13px">No hay mantenciones vencidas</div></div>';
        } else {
            body = '<table style="width:100%;border-collapse:collapse;font-size:13px">'
                + '<thead><tr style="background:#fef2f2;border-bottom:1px solid #fecaca">'
                + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.5px">Maquina</th>'
                + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.5px">Componente</th>'
                + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.5px">Fecha</th>'
                + '<th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.5px">Accion</th>'
                + '</tr></thead><tbody>';
            data.slice(0, 5).forEach(v => {
                const maq = maqMap[v.maquina_id];
                const comp = compMap[v.componente_id];
                body += '<tr class="dash-row" style="border-bottom:1px solid #f1f5f9;cursor:pointer;transition:all 0.2s" '
                    + 'onmouseover="this.style.background=\'#fef2f2\';this.style.transform=\'translateX(2px)\'" '
                    + 'onmouseout="this.style.background=\'transparent\';this.style.transform=\'none\'">'
                    + '<td style="padding:10px 14px;font-weight:600;color:#1e293b">' + (maq ? maq.nombre : '-') + '</td>'
                    + '<td style="padding:10px 14px;color:#475569">' + (comp ? comp.nombre : '-') + '</td>'
                    + '<td style="padding:10px 14px"><span style="font-family:\'JetBrains Mono\',monospace;font-size:12px;color:#64748b;background:#fef2f2;padding:3px 8px;border-radius:6px;border:1px solid #fecaca">' + App.formatDate(v.fecha_programada) + '</span></td>'
                    + '<td style="padding:10px 14px;text-align:center"><button class="dash-btn" onclick="event.stopPropagation();App.loadModule(\'preventive\');setTimeout(()=>App.modules.preventive.showForm(' + v.id + '),300)" style="background:#ef4444;color:white;border:none;padding:6px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;box-shadow:0 2px 6px rgba(239,68,68,0.3)">Ir</button></td></tr>';
            });
            body += '</tbody></table>';
        }
        return '<div class="dash-section" style="background:white;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:fadeUp 0.5s ease 500ms both">'
            + '<div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:12px">'
            + '<div style="width:36px;height:36px;border-radius:9px;background:linear-gradient(135deg,#fef2f2,#fecaca);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(239,68,68,0.15)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>'
            + '<div><h3 style="margin:0;font-size:15px;font-weight:700;color:#0f172a">Mantenciones Vencidas</h3>'
            + '<p style="margin:2px 0 0;font-size:11px;color:#94a3b8">Requieren atencion inmediata</p></div>'
            + (data.length > 0 ? '<span class="dash-badge" style="margin-left:auto;font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;font-family:\'JetBrains Mono\',monospace">' + data.length + '</span>' : '')
            + '</div><div>' + body + '</div></div>';
    },

    renderUpcomingLocal(data, maqMap, compMap) {
        let body;
        if (data.length === 0) {
            body = '<div style="text-align:center;padding:48px 20px">'
                + '<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#e0e7ff,#c7d2fe);display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;box-shadow:0 4px 12px rgba(99,102,241,0.2)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>'
                + '<div style="font-size:14px;font-weight:600;color:#1e293b;margin-bottom:4px">Sin programaciones</div>'
                + '<div style="color:#94a3b8;font-size:13px">No hay mantenciones proximas</div></div>';
        } else {
            body = '<table style="width:100%;border-collapse:collapse;font-size:13px">'
                + '<thead><tr style="background:#eff6ff;border-bottom:1px solid #bfdbfe">'
                + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px">Maquina</th>'
                + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px">Componente</th>'
                + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px">Fecha Prog.</th>'
                + '</tr></thead><tbody>';
            data.slice(0, 5).forEach(v => {
                const maq = maqMap[v.maquina_id];
                const comp = compMap[v.componente_id];
                body += '<tr class="dash-row" style="border-bottom:1px solid #f1f5f9;cursor:pointer;transition:all 0.2s" '
                    + 'onmouseover="this.style.background=\'#eff6ff\';this.style.transform=\'translateX(2px)\'" '
                    + 'onmouseout="this.style.background=\'transparent\';this.style.transform=\'none\'">'
                    + '<td style="padding:10px 14px;font-weight:600;color:#1e293b">' + (maq ? maq.nombre : '-') + '</td>'
                    + '<td style="padding:10px 14px;color:#475569">' + (comp ? comp.nombre : '-') + '</td>'
                    + '<td style="padding:10px 14px"><span style="font-family:\'JetBrains Mono\',monospace;font-size:12px;color:#1e40af;background:#eff6ff;padding:3px 8px;border-radius:6px;border:1px solid #bfdbfe">' + App.formatDate(v.fecha_programada) + '</span></td></tr>';
            });
            body += '</tbody></table>';
        }
        return '<div class="dash-section" style="background:white;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:fadeUp 0.5s ease 600ms both">'
            + '<div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:12px">'
            + '<div style="width:36px;height:36px;border-radius:9px;background:linear-gradient(135deg,#eff6ff,#bfdbfe);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(59,130,246,0.15)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>'
            + '<div><h3 style="margin:0;font-size:15px;font-weight:700;color:#0f172a">Proximas Mantenciones</h3>'
            + '<p style="margin:2px 0 0;font-size:11px;color:#94a3b8">Programadas en los proximos 15 dias</p></div>'
            + (data.length > 0 ? '<span class="dash-badge" style="margin-left:auto;font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;font-family:\'JetBrains Mono\',monospace">' + data.length + '</span>' : '')
            + '</div><div>' + body + '</div></div>';
    },

    renderRecentFailuresLocal(recentFailures, maqMap, compMap) {
        if (!recentFailures || recentFailures.length === 0) return '';
        let rows = '';
        for (const c of recentFailures) {
            const maq = maqMap[c.maquina_id];
            const comp = compMap[c.componente_id];
            const estadoBadge = c.estado === 'Reparada'
                ? '<span class="dash-badge" style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:4px 12px;border-radius:20px;background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>Reparada</span>'
                : '<span class="dash-badge" style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:4px 12px;border-radius:20px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>En Mantencion</span>';
            rows += '<tr class="dash-row" style="border-bottom:1px solid #f1f5f9;cursor:pointer;transition:all 0.2s" '
                + 'onmouseover="this.style.background=\'#f8fafc\';this.style.transform=\'translateX(2px)\'" '
                + 'onmouseout="this.style.background=\'transparent\';this.style.transform=\'none\'">'
                + '<td style="padding:11px 14px;font-weight:600;color:#1e293b">' + (maq ? maq.nombre : '-') + '</td>'
                + '<td style="padding:11px 14px;color:#475569">' + (comp ? comp.nombre : '-') + '</td>'
                + '<td style="padding:11px 14px"><span style="font-family:\'JetBrains Mono\',monospace;font-size:12px;color:#64748b">' + App.formatDate(c.fecha_falla) + '</span></td>'
                + '<td style="padding:11px 14px;font-size:12px;color:#64748b;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escapeHtml(c.descripcion_falla || '') + '">' + escapeHtml(c.descripcion_falla || '-') + '</td>'
                + '<td style="padding:11px 14px;color:#475569">' + escapeHtml(c.responsable || '-') + '</td>'
                + '<td style="padding:11px 14px">' + estadoBadge + '</td>'
                + '<td style="padding:11px 14px;font-family:\'JetBrains Mono\',monospace;font-size:12px;color:#64748b;text-align:center">' + c.horas_detencion + '</td>'
                + '<td style="padding:11px 14px;text-align:center"><button class="dash-btn" onclick="event.stopPropagation();App.loadModule(\'corrective\');setTimeout(()=>App.modules.corrective.showForm(' + c.id + '),300)" style="background:#3b82f6;color:white;border:none;padding:6px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;box-shadow:0 2px 6px rgba(59,130,246,0.3)">Ir</button></td></tr>';
        }
        return '<div class="dash-section" style="background:white;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);margin-bottom:20px;animation:fadeUp 0.5s ease 700ms both">'
            + '<div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:12px">'
            + '<div style="width:36px;height:36px;border-radius:9px;background:linear-gradient(135deg,#fef2f2,#fecaca);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(239,68,68,0.15)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>'
            + '<div><h3 style="margin:0;font-size:15px;font-weight:700;color:#0f172a">Ultimas Fallas Registradas</h3>'
            + '<p style="margin:2px 0 0;font-size:11px;color:#94a3b8">Fallas reportadas recientemente</p></div></div>'
            + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">'
            + '<thead><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">'
            + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Maquina</th>'
            + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Componente</th>'
            + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Fecha</th>'
            + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Falla</th>'
            + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Tecnico</th>'
            + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Estado</th>'
            + '<th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Hs.Det.</th>'
            + '<th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Accion</th>'
            + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    },

    renderRecentPreventiveLocal(data, maqMap, compMap) {
        if (!data || data.length === 0) return '';
        let rows = '';
        for (const p of data) {
            const maq = maqMap[p.maquina_id];
            const comp = compMap[p.componente_id];
            rows += '<tr class="dash-row" style="border-bottom:1px solid #f1f5f9;cursor:pointer;transition:all 0.2s" '
                + 'onmouseover="this.style.background=\'#f0fdf4\';this.style.transform=\'translateX(2px)\'" '
                + 'onmouseout="this.style.background=\'transparent\';this.style.transform=\'none\'">'
                + '<td style="padding:11px 14px;font-weight:600;color:#1e293b">' + (maq ? maq.nombre : '-') + '</td>'
                + '<td style="padding:11px 14px;color:#475569">' + (comp ? comp.nombre : '-') + '</td>'
                + '<td style="padding:11px 14px;font-size:12px;color:#64748b;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escapeHtml(p.observaciones || '') + '">' + escapeHtml(p.observaciones || '-') + '</td>'
                + '<td style="padding:11px 14px"><span style="font-family:\'JetBrains Mono\',monospace;font-size:12px;color:#16a34a;background:#f0fdf4;padding:3px 8px;border-radius:6px;border:1px solid #bbf7d0">' + App.formatDate(p.fecha_programada) + '</span></td>'
                + '<td style="padding:11px 14px"><span style="font-family:\'JetBrains Mono\',monospace;font-size:12px;color:#64748b">' + App.formatDate(p.fecha_ejecutada) + '</span></td>'
                + '<td style="padding:11px 14px;color:#475569">' + escapeHtml(p.tecnico || '-') + '</td>'
                + '<td style="padding:11px 14px"><span style="font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);color:#475569;border:1px solid #e2e8f0">' + escapeHtml(p.turno || 'Dia') + '</span></td>'
                + '<td style="padding:11px 14px;text-align:center"><button class="dash-btn" onclick="event.stopPropagation();App.loadModule(\'preventive\');setTimeout(()=>App.modules.preventive.showForm(' + p.id + '),300)" style="background:#22c55e;color:white;border:none;padding:6px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;box-shadow:0 2px 6px rgba(34,197,94,0.3)">Ir</button></td></tr>';
        }
        return '<div class="dash-section" style="background:white;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:fadeUp 0.5s ease 800ms both">'
            + '<div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:12px">'
            + '<div style="width:36px;height:36px;border-radius:9px;background:linear-gradient(135deg,#f0fdf4,#bbf7d0);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(34,197,94,0.15)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>'
            + '<div><h3 style="margin:0;font-size:15px;font-weight:700;color:#0f172a">Ultimas Mantenciones Preventivas</h3>'
            + '<p style="margin:2px 0 0;font-size:11px;color:#94a3b8">Trabajos preventivos completados recientemente</p></div></div>'
            + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">'
            + '<thead><tr style="background:#f0fdf4;border-bottom:1px solid #bbf7d0">'
            + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.5px">Maquina</th>'
            + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.5px">Componente</th>'
            + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.5px">Observaciones</th>'
            + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.5px">Fecha Prog.</th>'
            + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.5px">Fecha Ejec.</th>'
            + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.5px">Tecnico</th>'
            + '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.5px">Turno</th>'
            + '<th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.5px">Accion</th>'
            + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    },

    goToCorrective(maquinaId) {
        App.loadModule('corrective');
        setTimeout(() => {
            const select = document.getElementById('filterCorrMaq');
            if (select) {
                select.value = maquinaId;
                App.modules.corrective.render();
            }
        }, 300);
    }
});
