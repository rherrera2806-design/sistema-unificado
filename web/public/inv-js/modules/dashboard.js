const InvDashboard = {
    selectedMes: null,

    fmtKg(v) { return Math.round(v || 0).toLocaleString('es-CL'); },
    fmtNum(v) { return Math.round(v || 0).toLocaleString('es-CL'); },

    sparkline(data, color, w, h) {
        if (!data || data.length < 2) return '';
        const max = Math.max(...data, 1);
        const min = Math.min(...data, 0);
        const range = max - min || 1;
        const step = w / (data.length - 1);
        const pts = data.map((v, i) => (i * step).toFixed(1) + ',' + (h - ((v - min) / range) * (h - 4) - 2).toFixed(1));
        const area = '0,' + h + ' ' + pts.join(' ') + ' ' + w + ',' + h;
        const last = pts[pts.length - 1].split(',');
        return `<svg width="${w}" height="${h}" style="display:block;margin-top:6px">
            <polygon points="${area}" fill="${color}" opacity="0.15"/>
            <polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="${last[0]}" cy="${last[1]}" r="3" fill="${color}"/></svg>`;
    },

    lineChart(data, labels, color, w, h, unit) {
        if (!data || data.length < 2) return '<div style="text-align:center;padding:40px;color:var(--gray-400);font-size:12px">Sin datos</div>';
        const pad = { t: 20, r: 20, b: 35, l: 50 };
        const cw = w - pad.l - pad.r;
        const ch = h - pad.t - pad.b;
        const max = Math.max(...data) * 1.1 || 1;
        const step = cw / (data.length - 1);
        const pts = data.map((v, i) => (pad.l + i * step).toFixed(1) + ',' + (pad.t + ch - (v / max) * ch).toFixed(1));
        const area = pad.l + ',' + (pad.t + ch) + ' ' + pts.join(' ') + ' ' + (pad.l + cw) + ',' + (pad.t + ch);
        const yTicks = 5;
        let grid = '';
        for (let i = 0; i <= yTicks; i++) {
            const y = pad.t + (ch / yTicks) * i;
            const val = Math.round(max - (max / yTicks) * i);
            grid += `<line x1="${pad.l}" y1="${y}" x2="${pad.l + cw}" y2="${y}" stroke="var(--gray-100)" stroke-width="1"/>`;
            grid += `<text x="${pad.l - 8}" y="${y + 4}" text-anchor="end" fill="var(--gray-400)" font-size="10">${this.fmtNum(val)}</text>`;
        }
        let xLabels = '';
        data.forEach((v, i) => {
            const x = pad.l + i * step;
            xLabels += `<text x="${x}" y="${pad.t + ch + 18}" text-anchor="middle" fill="var(--gray-500)" font-size="10">${labels[i]}</text>`;
            xLabels += `<circle cx="${x}" cy="${(pad.t + ch - (v / max) * ch).toFixed(1)}" r="4" fill="${color}" stroke="white" stroke-width="2"/>`;
            xLabels += `<text x="${x}" y="${(pad.t + ch - (v / max) * ch - 10).toFixed(1)}" text-anchor="middle" fill="var(--gray-700)" font-size="10" font-weight="600">${this.fmtNum(v)}</text>`;
        });
        const lineLen = pts.length * 50;
        return `<svg width="100%" viewBox="0 0 ${w} ${h}" style="display:block">
            <defs><linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity="0.25"/><stop offset="100%" stop-color="${color}" stop-opacity="0.02"/></linearGradient></defs>
            ${grid}<polygon points="${area}" fill="url(#lineAreaGrad)"/>
            <polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${lineLen}" stroke-dashoffset="${lineLen}" style="animation:lineDraw 1.2s ease 0.3s forwards"/>
            ${xLabels}</svg>`;
    },

    hBarChart(items, color, w, h) {
        if (!items.length) return '<div style="text-align:center;padding:20px;color:var(--gray-400);font-size:12px">Sin datos</div>';
        const max = Math.max(...items.map(i => i.value)) || 1;
        const barH = Math.min(28, (h - 10) / items.length - 4);
        const labelW = 120;
        const barW = w - labelW - 70;
        let defs = '';
        items.forEach((item, i) => {
            defs += `<linearGradient id="barGrad${i}" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${item.color}" stop-opacity="0.9"/><stop offset="100%" stop-color="${item.color}" stop-opacity="0.5"/></linearGradient>`;
        });
        return '<svg width="100%" viewBox="0 0 ' + w + ' ' + (items.length * (barH + 6) + 10) + '" style="display:block">'
            + '<defs>' + defs + '</defs>'
            + items.map((item, i) => {
                const y = i * (barH + 6) + 5;
                const bw = (item.value / max) * barW;
                const shortLabel = item.label.length > 18 ? item.label.substring(0, 16) + '...' : item.label;
                return `<text x="${labelW - 8}" y="${y + barH / 2 + 4}" text-anchor="end" fill="var(--gray-700)" font-size="11" font-weight="600">${shortLabel}</text>
                    <rect class="inv-bar-rect" x="${labelW}" y="${y}" width="${bw}" height="${barH}" rx="4" fill="url(#barGrad${i})" opacity="0.85" style="animation:barGrow 0.8s ease ${i * 50}ms both"/>
                    <text x="${labelW + bw + 6}" y="${y + barH / 2 + 4}" fill="var(--gray-600)" font-size="10" font-weight="600">${this.fmtNum(item.value)} ${item.unit || ''}</text>`;
            }).join('') + '</svg>';
    },

    donutChart(items, w, h) {
        if (!items.length) return '';
        const totalPlanchas = items.reduce((s, i) => s + i.value, 0);
        if (totalPlanchas <= 0) return '';
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.min(w, h) / 2 - 20;
        const inner = r * 0.55;
        const labelR = (r + inner) / 2;
        let angle = -90;
        let paths = '';
        let labels = '';
        items.forEach(item => {
            const pct = item.value / totalPlanchas;
            const sweep = pct * 360;
            const startRad = (angle * Math.PI) / 180;
            const endRad = ((angle + sweep) * Math.PI) / 180;
            const x1 = cx + r * Math.cos(startRad);
            const y1 = cy + r * Math.sin(startRad);
            const x2 = cx + r * Math.cos(endRad);
            const y2 = cy + r * Math.sin(endRad);
            const ix1 = cx + inner * Math.cos(endRad);
            const iy1 = cy + inner * Math.sin(endRad);
            const ix2 = cx + inner * Math.cos(startRad);
            const iy2 = cy + inner * Math.sin(startRad);
            const large = sweep > 180 ? 1 : 0;
            paths += `<path class="inv-donut-slice" d="M${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${large},1 ${x2.toFixed(1)},${y2.toFixed(1)} L${ix1.toFixed(1)},${iy1.toFixed(1)} A${inner},${inner} 0 ${large},0 ${ix2.toFixed(1)},${iy2.toFixed(1)} Z" fill="${item.color}" opacity="0.9" style="transform-origin:${cx}px ${cy}px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.15))"/>`;
            if (sweep > 18) {
                const midRad = ((angle + sweep / 2) * Math.PI) / 180;
                const lx = cx + labelR * Math.cos(midRad);
                const ly = cy + labelR * Math.sin(midRad);
                labels += `<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="middle" fill="white" font-size="11" font-weight="700" style="text-shadow:0 1px 3px rgba(0,0,0,0.3);pointer-events:none">${Math.round(pct * 100)}%</text>`;
            }
            angle += sweep;
        });
        return `<svg width="100%" viewBox="0 0 ${w} ${h}" style="display:block;margin:0 auto;animation:donutSpin 0.8s ease-out"><g>${paths}</g>${labels}
            <text x="${cx}" y="${cy - 6}" text-anchor="middle" fill="var(--gray-800)" font-size="22" font-weight="900">${this.fmtNum(totalPlanchas)}</text>
            <text x="${cx}" y="${cy + 12}" text-anchor="middle" fill="var(--gray-400)" font-size="10" font-weight="600">Planchas</text></svg>`;
    },

    heatmap(data, rowLabels, colLabels, w, h) {
        if (!data.length || !rowLabels.length || !colLabels.length) return '';
        const pad = { t: 25, l: 80, r: 10, b: 10 };
        const cw = w - pad.l - pad.r;
        const ch = h - pad.t - pad.b;
        const cellW = cw / colLabels.length;
        const cellH = Math.min(24, ch / rowLabels.length);
        const max = Math.max(...data.map(d => d.v), 1);
        const colors = ['#f0fdf4', '#86efac', '#22c55e', '#15803d', '#14532d'];
        let cells = '';
        data.forEach(d => {
            const x = pad.l + d.col * cellW;
            const y = pad.t + d.row * cellH;
            const intensity = d.v / max;
            const ci = Math.min(Math.floor(intensity * (colors.length - 1)), colors.length - 1);
            const bg = d.v > 0 ? colors[ci] : 'var(--gray-50)';
            const textColor = ci >= 3 ? 'white' : 'var(--gray-700)';
            cells += `<rect class="inv-heatmap-rect" x="${x}" y="${y}" width="${cellW - 1}" height="${cellH - 1}" rx="3" fill="${bg}" style="animation:heatFade 0.4s ease ${(d.row * colLabels.length + d.col) * 30}ms both;transform-origin:${x + cellW/2}px ${y + cellH/2}px"/>`;
            if (d.v > 0) cells += `<text x="${x + cellW / 2}" y="${y + cellH / 2 + 4}" text-anchor="middle" fill="${textColor}" font-size="10" font-weight="700" style="pointer-events:none">${Math.round(d.v)}</text>`;
        });
        let labels = '';
        rowLabels.forEach((label, i) => {
            labels += `<text x="${pad.l - 6}" y="${pad.t + i * cellH + cellH / 2 + 4}" text-anchor="end" fill="var(--gray-600)" font-size="10">${label}</text>`;
        });
        colLabels.forEach((label, i) => {
            labels += `<text x="${pad.l + i * cellW + cellW / 2}" y="${pad.t - 8}" text-anchor="middle" fill="var(--gray-500)" font-size="10">${label}</text>`;
        });
        return `<svg width="100%" viewBox="0 0 ${w} ${pad.t + rowLabels.length * cellH + pad.b}" style="display:block">${labels}${cells}</svg>`;
    },

    kpiCard(label, value, suffix, sparkHtml, trendPct, trendColor, delay) {
        const trendHtml = trendPct !== null && trendPct !== undefined
            ? `<div style="font-size:11px;font-weight:600;margin-top:4px;color:${trendColor}">${trendPct > 0 ? '↑' : trendPct < 0 ? '↓' : '→'} ${Math.abs(trendPct)}% vs mes ant.</div>`
            : '';
        return `<div style="flex:1;min-width:170px;background:white;border-radius:12px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.06);border:1px solid var(--gray-200);animation:kpiUp 0.5s ease ${delay}ms both">
            <div style="font-size:11px;font-weight:600;color:var(--gray-500);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">${label}</div>
            <div style="font-size:32px;font-weight:800;color:var(--gray-900);line-height:1">${value}<span style="font-size:14px;font-weight:600;color:var(--gray-400);margin-left:4px">${suffix}</span></div>
            ${trendHtml}${sparkHtml}</div>`;
    },

    kpiCardGlass(label, value, suffix, sparkHtml, trendPct, trendColor, delay) {
        const trendHtml = trendPct !== null && trendPct !== undefined
            ? `<div style="font-size:11px;font-weight:600;margin-top:6px;color:${trendColor}">${trendPct > 0 ? '↑' : trendPct < 0 ? '↓' : '→'} ${Math.abs(trendPct)}% vs mes ant.</div>`
            : '';
        return `<div class="inv-kpi" style="animation-delay:${delay}ms">
            <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px">${label}</div>
            <div style="font-size:36px;font-weight:900;color:white;line-height:1">${value}<span style="font-size:14px;font-weight:600;color:rgba(255,255,255,0.4);margin-left:4px">${suffix}</span></div>
            ${trendHtml}${sparkHtml}</div>`;
    },

    rankingCard(r, i, maxPl) {
        const pct = maxPl > 0 ? Math.round((Number(r.planchas_salidas) / maxPl) * 100) : 0;
        const configs = [
            { medal: '🥇', bg: 'linear-gradient(135deg,#fef3c7,#fde68a)', accent: '#b45309', bar: '#f59e0b', border: '#fcd34d' },
            { medal: '🥈', bg: 'linear-gradient(135deg,#f1f5f9,#e2e8f0)', accent: '#475569', bar: '#94a3b8', border: '#cbd5e1' },
            { medal: '🥉', bg: 'linear-gradient(135deg,#fef2e8,#fed7aa)', accent: '#9a3412', bar: '#ea580c', border: '#fdba74' },
            { medal: '4', bg: 'linear-gradient(135deg,#f8fafc,#f1f5f9)', accent: '#64748b', bar: '#3b82f6', border: '#e2e8f0' },
            { medal: '5', bg: 'linear-gradient(135deg,#f8fafc,#f1f5f9)', accent: '#64748b', bar: '#3b82f6', border: '#e2e8f0' }
        ];
        const c = configs[i] || configs[4];
        return `<div style="flex:1;min-width:180px;background:${c.bg};border-radius:14px;padding:20px;border:1.5px solid ${c.border};position:relative;overflow:hidden;animation:kpiUp 0.5s ease ${i * 60}ms both">
            <div style="position:absolute;top:12px;right:14px;font-size:28px;opacity:0.7;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.1))">${c.medal}</div>
            <div style="font-size:10px;font-weight:700;color:${c.accent};text-transform:uppercase;letter-spacing:0.08em;opacity:0.7;margin-bottom:12px">#${i + 1} Top Material</div>
            <div style="font-size:14px;font-weight:800;color:${c.accent};margin-bottom:2px;line-height:1.2">${r.nombre || r.codigo_mp}</div>
            <div style="font-size:11px;color:${c.accent};opacity:0.6;margin-bottom:14px">Espesor: ${r.espesor_mm || '-'} mm</div>
            <div style="font-size:36px;font-weight:900;color:${c.accent};line-height:1;margin-bottom:4px">${this.fmtNum(r.planchas_salidas)}</div>
            <div style="font-size:10px;font-weight:600;color:${c.accent};opacity:0.5;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.05em">planchas cortadas</div>
            <div style="height:5px;background:rgba(0,0,0,0.08);border-radius:3px;overflow:hidden"><div style="width:${pct}%;background:${c.bar};height:100%;border-radius:3px;transition:width 0.6s ease"></div></div>
        </div>`;
    },

    async render() {
        const page = document.querySelector('.page.active');
        page.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray-400)">Cargando dashboard...</div>';
        try {
            const hdrs = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const analytics = await fetch('/api/inv/analytics?meses=6', { headers: hdrs }).then(r => r.json()).catch(() => ({}));
            const a = analytics || {};
            window._invDashRanking = a.rankingSalida || [];
            window._invDashPlanchasMes = a.planchasPorMes || [];
            window._invDashStock = a.stockActual || [];
            window._invDashConsumo = a.consumoMensual || [];
            window._invDashHdrs = hdrs;
            this.selectedMes = null;
            this._renderContent(page);
        } catch(err) { page.innerHTML = '<div class="alert alert-danger">Error: ' + err.message + '</div>'; }
    },

    _renderContent(page) {
        const ranking = window._invDashRanking || [];
        const planchasMesRaw = window._invDashPlanchasMes || [];
        const stock = window._invDashStock || [];
        const consumoRaw = window._invDashConsumo || [];
        const monthNames = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const sel = this.selectedMes;

        // ── Filter data by selected month ──
        const planchasMes = sel ? planchasMesRaw.filter(p => p.mes === sel) : planchasMesRaw;
        const consumo = sel ? consumoRaw.filter(c => c.mes === sel) : consumoRaw;
        const sorted = [...planchasMes].sort((a,b) => a.mes.localeCompare(b.mes));
        const planchasArr = sorted.map(p => Number(p.total_planchas) || 0);
        const m2Arr = sorted.map(p => Number(p.total_m2) || 0);
        const kgArr = sorted.map(p => Number(p.total_kg) || 0);
        const lastP = planchasArr[planchasArr.length - 1] || 0;
        const prevP = planchasArr[planchasArr.length - 2] || 0;
        const lastM2 = m2Arr[m2Arr.length - 1] || 0;
        const prevM2 = m2Arr[m2Arr.length - 2] || 0;
        const pctP = prevP > 0 ? Math.round(((lastP - prevP) / prevP) * 100) : null;
        const pctM2 = prevM2 > 0 ? Math.round(((lastM2 - prevM2) / prevM2) * 100) : null;
        const totalPlStock = stock.reduce((s, r) => s + Math.max(0, (Number(r.entradas) || 0) - (Number(r.salidas) || 0)), 0);
        const totalKgStock = stock.reduce((s, r) => s + (Number(r.kg_stock) || 0), 0);
        const stockWithAuto = stock.filter(r => r.autonomia_meses > 0);
        const avgAuto = stockWithAuto.length > 0
            ? (stockWithAuto.reduce((s, r) => s + r.autonomia_meses, 0) / stockWithAuto.length).toFixed(1) : 0;
        const autoColor = avgAuto >= 4 ? 'var(--success)' : avgAuto >= 2 ? 'var(--warning)' : 'var(--danger)';

        // ── Line chart data: planchas por mes ──
        const lineLabels = sorted.map(p => { const parts = p.mes.split('-'); return monthNames[parseInt(parts[1])]; });

        // ── Shared color map by material+espesor ──
        const palette = ['#3b82f6','#8b5cf6','#f59e0b','#22c55e','#ef4444','#06b6d4','#ec4899','#f97316','#14b8a6','#6366f1'];
        const colorMap = {};
        let colorIdx = 0;
        const getColor = (key) => { if (!colorMap[key]) { colorMap[key] = palette[colorIdx % palette.length]; colorIdx++; } return colorMap[key]; };

        // ── Bar chart: planchas por material (nombre + espesor) ──
        const porMaterial = {};
        consumo.forEach(c => {
            const key = (c.nombre || c.codigo_mp) + '|' + (c.espesor_mm || '');
            if (!porMaterial[key]) porMaterial[key] = { nombre: c.nombre || c.codigo_mp, espesor: c.espesor_mm, planchas: 0 };
            porMaterial[key].planchas += Number(c.planchas_consumidas) || 0;
        });
        const barItems = Object.entries(porMaterial)
            .map(([key, m]) => ({ key, label: m.nombre + (m.espesor ? ' ' + m.espesor + 'mm' : ''), value: m.planchas, color: getColor(key), unit: 'pl.' }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);

        // ── Donut chart: top 5 materiales por planchas consumidas ──
        const consumoPorMat = {};
        consumo.forEach(c => {
            const key = (c.nombre || c.codigo_mp) + '|' + (c.espesor_mm || '');
            if (!consumoPorMat[key]) consumoPorMat[key] = { nombre: c.nombre || c.codigo_mp, espesor: c.espesor_mm, planchas: 0 };
            consumoPorMat[key].planchas += Number(c.planchas_consumidas) || 0;
        });
        const consumoSorted = Object.entries(consumoPorMat).filter(([, m]) => m.planchas > 0).sort(([, a], [, b]) => b.planchas - a.planchas);
        const top5 = consumoSorted.slice(0, 5);
        const otrosPlanchas = consumoSorted.slice(5).reduce((s, [, r]) => s + r.planchas, 0);
        const donutItems = top5.map(([key, s]) => ({ label: s.nombre + (s.espesor ? ' ' + s.espesor + 'mm' : ''), value: s.planchas, color: getColor(key) }));
        if (otrosPlanchas > 0) donutItems.push({ label: 'Otros', value: otrosPlanchas, color: '#94a3b8' });

        // ── Heatmap data: planchas por espesor × mes ──
        const heatData = {};
        const heatEspesores = new Set();
        const heatMeses = new Set();
        consumo.forEach(c => {
            const esp = (c.espesor_mm || 'Otro') + 'mm';
            heatEspesores.add(esp);
            heatMeses.add(c.mes);
            const key = esp + '|' + c.mes;
            heatData[key] = (heatData[key] || 0) + (Number(c.planchas_consumidas) || 0);
        });
        const heatCols = [...heatMeses].sort().map(m => { const parts = m.split('-'); return monthNames[parseInt(parts[1])]; });
        const heatRows = [...heatEspesores].sort();
        const heatColsRaw = [...heatMeses].sort();
        const heatCells = [];
        heatRows.forEach((row, ri) => {
            heatColsRaw.forEach((col, ci) => {
                const v = heatData[row + '|' + col] || 0;
                if (v > 0) heatCells.push({ row: ri, col: ci, v });
            });
        });

        // ── Alertas con espesor ──
        const alertas = [];
        stock.forEach(s => {
            const auto = s.autonomia_meses || 0;
            const nombre = s.nombre || s.codigo_mp;
            const esp = s.espesor_mm ? ' ' + s.espesor_mm + 'mm' : '';
            if (s.stock > 0 && auto < 2) alertas.push({ tipo: 'danger', msg: `Stock bajo: ${nombre}${esp} — ${auto.toFixed(1)} meses de autonomia` });
            else if (s.stock > 0 && auto < 4) alertas.push({ tipo: 'warning', msg: `Stock medio: ${nombre}${esp} — ${auto.toFixed(1)} meses de autonomia` });
        });
        if (pctP !== null && pctP < -10) alertas.push({ tipo: 'warning', msg: `Planchas en baja: ${pctP}% vs mes anterior` });

        // ── Ranking top 5 por planchas ──
        const rankingTop5 = [...ranking].sort((a, b) => Number(b.planchas_salidas) - Number(a.planchas_salidas)).slice(0, 5);
        const maxPlRank = Number(rankingTop5[0]?.planchas_salidas) || 1;

        // ── Filtered ranking for table ──
        let rankingFiltrado = ranking;
        let rankingTitle = 'Ranking MP + Salida (6 meses)';
        if (sel) {
            const parts = sel.split('-');
            rankingTitle = 'Ranking MP + Salida (' + monthNames[parseInt(parts[1])] + ' ' + parts[0] + ')';
        }

        page.innerHTML = `
                <div style="width:100%">
                <style>
                    @keyframes kpiUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
                    @keyframes donutSpin { from { transform:rotate(-90deg) } to { transform:rotate(0deg) } }
                    @keyframes barGrow { from { width:0 } }
                    @keyframes lineDraw { from { stroke-dashoffset:2000 } to { stroke-dashoffset:0 } }
                    @keyframes fadeRow { from { opacity:0; transform:translateX(-8px) } to { opacity:1; transform:translateX(0) } }
                    @keyframes heatFade { from { opacity:0; transform:scale(0.8) } to { opacity:1; transform:scale(1) } }
                    .inv-donut-slice{transition:transform 0.2s,opacity 0.2s;cursor:pointer}
                    .inv-donut-slice:hover{transform:scale(1.04);opacity:1!important}
                    .inv-bar-rect{transition:opacity 0.15s;cursor:pointer}
                    .inv-bar-rect:hover{opacity:1!important}
                    .inv-table tbody tr{animation:fadeRow 0.3s ease both}
                    .inv-heatmap-rect{transition:opacity 0.15s;cursor:pointer}
                    .inv-heatmap-rect:hover{opacity:0.8!important}
                    .inv-hero{position:relative;overflow:hidden;background:linear-gradient(135deg,#0f172a 0%,#1e293b 40%,#334155 100%);border-radius:20px;padding:32px;margin-bottom:20px;color:white}
                    .inv-hero::before{content:'';position:absolute;top:-50%;right:-20%;width:400px;height:400px;border-radius:50%;background:radial-gradient(circle,rgba(245,158,11,0.12) 0%,transparent 70%);pointer-events:none}
                    .inv-hero::after{content:'';position:absolute;bottom:-30%;left:10%;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(59,130,246,0.08) 0%,transparent 70%);pointer-events:none}
                    .inv-kpi{flex:1;min-width:170px;background:rgba(255,255,255,0.07);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:20px;animation:kpiUp 0.5s ease both;transition:transform 0.2s,box-shadow 0.2s}
                    .inv-kpi:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.2)}
                    .inv-table{width:100%;border-collapse:collapse;font-size:12px}
                    .inv-table thead th{padding:10px 14px;text-align:left;font-size:10px;font-weight:700;color:var(--gray-500);text-transform:uppercase;letter-spacing:0.04em;border-bottom:2px solid var(--gray-200);background:white;position:sticky;top:0;z-index:2}
                    .inv-table td{padding:10px 14px;border-bottom:1px solid var(--gray-100);transition:all 0.15s}
                    .inv-table tbody tr:nth-child(even){background:var(--gray-50)}
                    .inv-table tbody tr:hover{background:#eff6ff!important}
                    .inv-table tbody tr.selected{background:var(--primary)!important;color:white;border-left:4px solid var(--primary-dark,#1e40af);box-shadow:inset 0 0 0 1px rgba(37,99,235,0.2)}
                    .inv-table tbody tr.selected td{color:white;border-color:rgba(255,255,255,0.15)}
                    .inv-alert{display:flex;align-items:center;gap:12px;padding:14px 18px;border-radius:12px;font-size:12px;font-weight:600;animation:kpiUp 0.4s ease both}
                    .inv-alert.danger{background:linear-gradient(135deg,#fef2f2,#fee2e2);border:1px solid #fecaca;color:#991b1b}
                    .inv-alert.warning{background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1px solid #fde68a;color:#92400e}
                    .inv-heatmap-legend{display:flex;align-items:center;gap:10px;margin-top:10px;font-size:12px;color:var(--gray-600);flex-wrap:wrap}
                    .inv-heatmap-legend span{width:22px;height:14px;border-radius:3px;display:inline-block}
                </style>

                <div class="inv-hero">
                    <div style="position:relative;z-index:1">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
                        <div>
                            <h2 style="margin:0;font-size:22px;font-weight:800;letter-spacing:-0.03em">Dashboard Inventario</h2>
                            <p style="margin:4px 0 0;font-size:12px;opacity:0.4">${sel ? 'Filtrado: ' + sel : 'Analisis de materia prima — Ultimos 6 meses'}</p>
                        </div>
                        ${sel ? '<button onclick="InvDashboard.clearFilter()" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:white;padding:8px 16px;border-radius:10px;font-size:11px;font-weight:600;cursor:pointer;backdrop-filter:blur(8px);transition:background 0.15s" onmouseover="this.style.background=\'rgba(255,255,255,0.15)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.08)\'">✕ Limpiar filtro</button>' : ''}
                    </div>
                    <div style="display:flex;gap:16px;flex-wrap:wrap">
                        ${this.kpiCardGlass('Planchas este mes', this.fmtNum(lastP), '', this.sparkline(planchasArr, '#f59e0b', 120, 32), pctP, pctP >= 0 ? '#4ade80' : '#f87171', 0)}
                        ${this.kpiCardGlass('Stock planchas', this.fmtNum(totalPlStock), 'pl.', '', null, '', 80)}
                        ${this.kpiCardGlass('Kg en stock', this.fmtKg(totalKgStock), 'kg', this.sparkline(kgArr, '#8b5cf6', 120, 32), null, '', 160)}
                        ${this.kpiCardGlass('Autonomia prom.', avgAuto, 'meses', '', null, '', 240)}
                    </div>
                    </div>
                </div>

                <div class="card" style="margin-bottom:16px;overflow:hidden">
                    <div style="padding:14px 18px;background:var(--gray-50);border-bottom:1px solid var(--gray-200);font-size:13px;font-weight:700;color:var(--gray-800)">Planchas Cortadas por Mes <span style="font-weight:400;font-size:11px;color:var(--gray-400)">(clic para filtrar todo el dashboard)</span></div>
                    <div style="padding:0;overflow-x:auto;max-height:400px;overflow-y:auto">
                        ${planchasMes.length === 0 ? '<div style="text-align:center;padding:20px;color:var(--gray-400);font-size:12px">Sin datos</div>' :
                        '<table class="inv-table"><thead><tr>'
                        + '<th style="padding:12px 14px">Mes</th>'
                        + '<th style="padding:12px 14px;text-align:center">Mov.</th>'
                        + '<th style="padding:12px 14px;text-align:center">Planchas</th>'
                        + '<th style="padding:12px 14px;text-align:center">m2</th>'
                        + '<th style="padding:12px 14px;text-align:center">Kg</th>'
                        + '<th style="padding:12px 14px">Tendencia</th>'
                        + '</tr></thead><tbody>'
                        + sorted.map((p, ri) => {
                            const maxPl = Math.max(...sorted.map(x => Number(x.total_planchas)));
                            const pct = maxPl > 0 ? Math.round((Number(p.total_planchas) / maxPl) * 100) : 0;
                            const parts = p.mes.split('-');
                            const mesLabel = monthNames[parseInt(parts[1])] + ' ' + parts[0];
                            const isSel = sel === p.mes;
                            return '<tr onclick="InvDashboard.filterByMes(\'' + p.mes + '\')" style="cursor:pointer;animation-delay:' + (ri * 40) + 'ms' + (isSel ? ';background:var(--primary)!important;color:white;border-left:4px solid var(--primary-dark,#1e40af)' : '') + '">'
                                + '<td style="font-weight:600' + (isSel ? '' : ';color:var(--gray-800)') + '">' + mesLabel + '</td>'
                                + '<td style="text-align:center;color:' + (isSel ? 'inherit' : 'var(--gray-500)') + '">' + p.total_movimientos + '</td>'
                                + '<td style="text-align:center;font-weight:700' + (isSel ? '' : ';color:var(--primary)') + '">' + p.total_planchas + '</td>'
                                + '<td style="text-align:center">' + Number(p.total_m2).toFixed(2) + '</td>'
                                + '<td style="text-align:center;font-weight:600">' + InvDashboard.fmtKg(p.total_kg) + '</td>'
                                + '<td><div style="height:8px;background:' + (isSel ? 'rgba(255,255,255,0.25)' : 'var(--gray-100)') + ';border-radius:4px;overflow:hidden;width:180px"><div style="width:' + pct + '%;background:' + (isSel ? 'white' : 'var(--primary)') + ';height:100%;border-radius:4px;animation:barGrow 0.6s ease ' + (ri * 60) + 'ms both"></div></div></td>'
                                + '</tr>';
                        }).join('')
                        + '</tbody></table>'}
                    </div>
                </div>

                ${alertas.length > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px">
                    ${alertas.slice(0, 4).map((a, i) => `<div class="inv-alert ${a.tipo}" style="animation-delay:${i * 60}ms">
                        <span style="font-size:16px">${a.tipo === 'danger' ? '🔴' : '🟡'}</span>
                        <span>${a.msg}</span>
                    </div>`).join('')}
                </div>` : ''}

                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:16px">
                    <div class="card" style="grid-column:1/3;overflow:hidden">
                        <div style="padding:14px 18px;background:var(--gray-50);border-bottom:1px solid var(--gray-200);font-size:13px;font-weight:700;color:var(--gray-800)">Consumo Mensual de Planchas</div>
                        <div style="padding:16px">${this.lineChart(planchasArr, lineLabels, '#3b82f6', 600, 220, 'pl.')}</div>
                    </div>
                    <div class="card" style="overflow:hidden">
                        <div style="padding:14px 18px;background:var(--gray-50);border-bottom:1px solid var(--gray-200);font-size:13px;font-weight:700;color:var(--gray-800)">Consumo por Material (Planchas)</div>
                        <div style="padding:16px">${this.donutChart(donutItems, 260, 200)}</div>
                        <div style="padding:0 16px 14px;display:flex;flex-wrap:wrap;gap:6px">
                            ${donutItems.map(d => `<span style="font-size:12px;color:var(--gray-700);display:flex;align-items:center;gap:6px;font-weight:500"><span style="width:12px;height:12px;border-radius:3px;display:inline-block;background:${d.color}"></span>${d.label}</span>`).join('')}
                        </div>
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
                    <div class="card" style="overflow:hidden">
                        <div style="padding:14px 18px;background:var(--gray-50);border-bottom:1px solid var(--gray-200);font-size:13px;font-weight:700;color:var(--gray-800)">Consumo por Material</div>
                        <div style="padding:16px">${this.hBarChart(barItems, '#3b82f6', 400, 200)}</div>
                    </div>
                    <div class="card" style="overflow:hidden">
                        <div style="padding:14px 18px;background:var(--gray-50);border-bottom:1px solid var(--gray-200);font-size:13px;font-weight:700;color:var(--gray-800)">Heatmap: Planchas por Espesor × Mes</div>
                        <div style="padding:16px">${this.heatmap(heatCells, heatRows, heatCols, 400, 180)}</div>
                        <div class="inv-heatmap-legend" style="padding:0 16px 14px">
                            <span style="font-weight:700;color:var(--gray-700)">Escala:</span>
                            <span style="background:#f0fdf4"></span> Bajo
                            <span style="background:#86efac"></span> Medio
                            <span style="background:#22c55e"></span> Alto
                            <span style="background:#15803d"></span> Muy alto
                            <span style="background:#14532d"></span> Max
                        </div>
                    </div>
                </div>

                <div style="margin-bottom:16px">
                    <div style="font-size:13px;font-weight:700;color:var(--gray-800);margin-bottom:12px">Top 5 Materiales por Planchas Cortadas</div>
                    <div style="display:flex;gap:12px;flex-wrap:wrap">
                        ${rankingTop5.map((r, i) => this.rankingCard(r, i, maxPlRank)).join('')}
                    </div>
                </div>

                <div class="card" style="overflow:hidden;margin-bottom:16px">
                    <div style="padding:14px 18px;background:var(--gray-50);border-bottom:1px solid var(--gray-200);font-size:13px;font-weight:700;color:var(--gray-800)">${rankingTitle}</div>
                    <div style="padding:0;overflow-x:auto;max-height:500px;overflow-y:auto">
                        ${rankingFiltrado.length === 0 ? '<div style="text-align:center;padding:20px;color:var(--gray-400);font-size:12px">Sin datos</div>' :
                        '<table class="inv-table"><thead><tr>'
                        + '<th style="padding:12px 14px">#</th>'
                        + '<th style="padding:12px 14px">Material</th>'
                        + '<th style="padding:12px 14px">Esp.</th>'
                        + '<th style="padding:12px 14px;text-align:right">m2</th>'
                        + '<th style="padding:12px 14px;text-align:right">Kg</th>'
                        + '<th style="padding:12px 14px;text-align:right">Planchas</th>'
                        + '<th style="padding:12px 14px">Tendencia</th>'
                        + '</tr></thead><tbody>'
                        + rankingFiltrado.map((r, i) => {
                            const maxM2 = Number(rankingFiltrado[0].m2_salidos) || 1;
                            const pct = Math.round((Number(r.m2_salidos) / maxM2) * 100);
                            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
                            return '<tr style="animation-delay:' + (i * 40) + 'ms">'
                                + '<td style="font-weight:700;color:' + (i < 3 ? 'var(--warning)' : 'var(--gray-400)') + '">' + medal + '</td>'
                                + '<td style="font-weight:600;color:var(--gray-800)">' + (r.nombre || r.codigo_mp) + '</td>'
                                + '<td>' + (r.espesor_mm || '') + '</td>'
                                + '<td style="text-align:right;font-weight:700;color:var(--danger)">' + Number(r.m2_salidos).toFixed(2) + '</td>'
                                + '<td style="text-align:right;font-weight:600">' + InvDashboard.fmtKg(r.kg_salidos) + '</td>'
                                + '<td style="text-align:right;font-weight:600">' + r.planchas_salidas + '</td>'
                                + '<td><div style="height:6px;background:var(--gray-100);border-radius:3px;overflow:hidden;width:100%"><div style="width:' + pct + '%;background:var(--danger);height:100%;border-radius:3px;animation:barGrow 0.6s ease ' + (i * 60) + 'ms both"></div></div></td>'
                                + '</tr>';
                        }).join('')
                        + '</tbody></table>'}
                    </div>
                </div>

            </div>`;
    },

    async filterByMes(mes) {
        if (this.selectedMes === mes) { this.clearFilter(); return; }
        this.selectedMes = mes;
        const page = document.querySelector('.page.active');
        const hdrs = window._invDashHdrs || {};
        try {
            const data = await fetch('/api/inv/analytics?mes=' + mes, { headers: hdrs }).then(r => r.json()).catch(() => ({}));
            if (data.rankingSalida) window._invDashRanking = data.rankingSalida;
            this._renderContent(page);
        } catch(e) { this._renderContent(page); }
    },

    clearFilter() {
        this.selectedMes = null;
        this.render();
    }
};
