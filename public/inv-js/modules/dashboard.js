const InvDashboard = {
    async render() {
        const page = document.querySelector('.page.active');
        page.innerHTML = '<div class="empty-state"><p>Cargando...</p></div>';
        try {
            const [stats, recientes, alertas] = await Promise.all([
                api.inv().getEstadisticas(),
                api.inv().getMovimientos(),
                api.inv().getAlertas()
            ]);
            const recentes = recientes.slice(0, 8);
            page.innerHTML = `
                ${alertas.length > 0 ? `
                <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:12px;">
                    <span style="font-size:24px;">🚨</span>
                    <div>
                        <div style="font-weight:700;color:var(--danger);font-size:14px;">¡Quiebre de Stock!</div>
                        <div style="font-size:13px;color:var(--gray-600);">${alertas.length} tipo(s) por debajo del stock crítico: <strong>${alertas.map(a => a.tipo).join(', ')}</strong></div>
                    </div>
                </div>
                ` : ''}
                <div class="section-title">Acciones Rapidas</div>
                <div class="quick-actions">
                    <div class="action-card" onclick="App.navigateInv('movimientos')"><div class="icon">➕</div><div class="label">Nuevo Movimiento</div></div>
                    <div class="action-card" onclick="App.navigateInv('inventario')"><div class="icon">📦</div><div class="label">Ver Inventario</div></div>
                    <div class="action-card" onclick="App.navigateInv('historial')"><div class="icon">🕐</div><div class="label">Historial</div></div>
                </div>
                <div class="stats-grid-4">
                    <div class="stat-card-sm primary"><div class="label">Total</div><div class="value">${stats.totalMovimientos}</div></div>
                    <div class="stat-card-sm success"><div class="label">Entradas</div><div class="value">${stats.totalEntradas}</div></div>
                    <div class="stat-card-sm danger"><div class="label">Salidas</div><div class="value">${stats.totalSalidas}</div></div>
                    <div class="stat-card-sm warning"><div class="label">Stock m2</div><div class="value">${stats.stockM2.toFixed(1)} <span class="unit">m2</span></div></div>
                </div>
                <div class="section-title">Movimientos Recientes</div>
                <div class="card"><div class="card-body" style="padding:0">${recentes.length === 0 ? '<div class="empty-state"><p>No hay movimientos</p></div>' : `<div class="table-responsive"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Cristal</th><th>Espesor</th><th>Dimensiones</th><th>Cantidad</th><th>m2</th></tr></thead><tbody>${recentes.map(m => `<tr><td>${new Date(m.fecha_hora).toLocaleDateString('es-CL')}</td><td><span class="badge ${m.tipo_movimiento === 'entrada' ? 'badge-entrada' : 'badge-salida'}">${m.tipo_movimiento}</span></td><td>${m.tipo_cristal}</td><td>${m.espesor}mm</td><td>${m.ancho} x ${m.alto} mm</td><td>${m.cantidad_planchas}</td><td>${Number(m.metros_cuadrados).toFixed(2)}</td></tr>`).join('')}</tbody></table></div>`}</div></div>`;
        } catch(err) { page.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`; }
    }
};
