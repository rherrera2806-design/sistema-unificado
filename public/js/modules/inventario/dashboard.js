const InvDashboard = {
    async render() {
        const page = document.querySelector('.page.active');
        page.innerHTML = '<div class="empty-state"><p>Cargando...</p></div>';
        try {
            const [stats, porTipo, recientes] = await Promise.all([
                api.inv().getEstadisticas(),
                api.inv().getEstadisticasPorTipo(),
                api.inv().getMovimientos()
            ]);
            const recentes = recientes.slice(0, 8);
            page.innerHTML = `
                <div class="section-title">Acciones Rapidas</div>
                <div class="quick-actions">
                    <div class="action-card" onclick="App.navigateInv('movimientos')"><div class="icon">➕</div><div class="label">Nuevo Movimiento</div></div>
                    <div class="action-card" onclick="App.navigateInv('inventario')"><div class="icon">📦</div><div class="label">Ver Inventario</div></div>
                    <div class="action-card" onclick="App.navigateInv('historial')"><div class="icon">🕐</div><div class="label">Historial</div></div>
                </div>
                <div class="stats-grid">
                    <div class="stat-card primary"><div class="label">Total Movimientos</div><div class="value">${stats.totalMovimientos}</div></div>
                    <div class="stat-card success"><div class="label">Entradas</div><div class="value">${stats.totalEntradas}</div></div>
                    <div class="stat-card danger"><div class="label">Salidas</div><div class="value">${stats.totalSalidas}</div></div>
                    <div class="stat-card warning"><div class="label">Stock m2</div><div class="value">${stats.stockM2.toFixed(2)} <span class="unit">m2</span></div></div>
                </div>
                ${porTipo.length > 0 ? `<div class="section-title">Stock por Tipo de Cristal</div><div class="stats-grid" style="margin-bottom:20px;">${porTipo.map(t => `<div class="stat-card" style="border-left: 4px solid ${t.stock > 0 ? 'var(--success)' : 'var(--danger)'}"><div class="label">${t.tipo}</div><div class="value">${t.stock.toFixed(2)} <span class="unit">m2</span></div><div style="font-size:12px; color:var(--gray-500); margin-top:4px;">E: ${t.entradas.toFixed(2)} | S: ${t.salidas.toFixed(2)}</div></div>`).join('')}</div>` : ''}
                <div class="section-title">Movimientos Recientes</div>
                <div class="card"><div class="card-body">${recentes.length === 0 ? '<div class="empty-state"><p>No hay movimientos</p></div>' : `<div class="table-responsive"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Cristal</th><th>Espesor</th><th>Dimensiones</th><th>Cantidad</th><th>m2</th></tr></thead><tbody>${recentes.map(m => `<tr><td>${new Date(m.fecha_hora).toLocaleDateString('es-CL')}</td><td><span class="badge ${m.tipo_movimiento === 'entrada' ? 'badge-entrada' : 'badge-salida'}">${m.tipo_movimiento}</span></td><td>${m.tipo_cristal}</td><td>${m.espesor}mm</td><td>${m.ancho} x ${m.alto} mm</td><td>${m.cantidad_planchas}</td><td>${Number(m.metros_cuadrados).toFixed(2)}</td></tr>`).join('')}</tbody></table></div>`}</div></div>`;
        } catch(err) { page.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`; }
    }
};
