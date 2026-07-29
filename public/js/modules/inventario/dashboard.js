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
                <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);border-radius:16px;padding:28px 32px;margin-bottom:24px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.3)">
<div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);border-radius:50%"></div>
<div style="position:relative;z-index:1"><h2 style="margin:0;font-size:24px;font-weight:800;color:white;letter-spacing:-0.5px">Dashboard Inventario</h2>
<p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.7)">Acciones Rapidas</p></div></div>
                <style>
@keyframes invDash_fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.invDash-card{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}
.invDash-card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.08)!important;transform:translateY(-3px)}
.invDash-row{transition:all 0.2s}
.invDash-row:hover{transform:translateX(2px);background:#f8fafc!important}
</style>
                <div class="quick-actions">
                    <div class="action-card" onclick="App.navigateInv('movimientos')"><div class="icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div><div class="label">Nuevo Movimiento</div></div>
                    <div class="action-card" onclick="App.navigateInv('inventario')"><div class="icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div><div class="label">Ver Inventario</div></div>
                    <div class="action-card" onclick="App.navigateInv('historial')"><div class="icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><div class="label">Historial</div></div>
                </div>
                <div class="stats-grid">
                    <div class="stat-card invDash-card primary"><div class="label">Total Movimientos</div><div class="value">${stats.totalMovimientos}</div></div>
                    <div class="stat-card invDash-card success"><div class="label">Entradas</div><div class="value">${stats.totalEntradas}</div></div>
                    <div class="stat-card invDash-card danger"><div class="label">Salidas</div><div class="value">${stats.totalSalidas}</div></div>
                    <div class="stat-card invDash-card warning"><div class="label">Stock m2</div><div class="value">${stats.stockM2.toFixed(2)} <span class="unit">m2</span></div></div>
                </div>
                ${porTipo.length > 0 ? `<div class="section-title">Stock por Tipo de Cristal</div><div class="stats-grid" style="margin-bottom:20px;">${porTipo.map(t => `<div class="stat-card invDash-card" style="border-left: 4px solid ${t.stock > 0 ? 'var(--success)' : 'var(--danger)'}"><div class="label">${t.tipo}</div><div class="value">${t.stock.toFixed(2)} <span class="unit">m2</span></div><div style="font-size:12px; color:var(--gray-500); margin-top:4px;">E: ${t.entradas.toFixed(2)} | S: ${t.salidas.toFixed(2)}</div></div>`).join('')}</div>` : ''}
                <div class="section-title">Movimientos Recientes</div>
                <div class="card"><div class="card-body">${recentes.length === 0 ? '<div class="empty-state"><p>No hay movimientos</p></div>' : `<div class="table-responsive"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Cristal</th><th>Espesor</th><th>Dimensiones</th><th>Cantidad</th><th>m2</th></tr></thead><tbody>${recentes.map(m => `<tr><td>${new Date(m.fecha_hora).toLocaleDateString('es-CL')}</td><td><span class="badge ${m.tipo_movimiento === 'entrada' ? 'badge-entrada' : 'badge-salida'}">${m.tipo_movimiento}</span></td><td>${m.tipo_cristal}</td><td>${m.espesor}mm</td><td>${m.ancho} x ${m.alto} mm</td><td>${m.cantidad_planchas}</td><td>${Number(m.metros_cuadrados).toFixed(2)}</td></tr>`).join('')}</tbody></table></div>`}</div></div>`;
        } catch(err) { page.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`; }
    }
};
