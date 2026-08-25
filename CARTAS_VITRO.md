# 📊 Patrón: StatCards VitroFlow

## Nombre: `CARTAS_VITRO`

Stat cards compactas con icono a la izquierda, valor y label apilados a la derecha. Responsive mobile-first.

---

## Estructura HTML

```html
<style>
    .ast-perm-stats{grid-template-columns:repeat(4,1fr)}
    .ast-perm-stats .m-stat-card{flex-direction:row;align-items:center;gap:6px;padding:6px 10px;min-height:48px;overflow:hidden}
    .ast-perm-stats .m-stat-icon{width:26px;height:26px;flex-shrink:0}
    .ast-perm-stats .m-stat-icon svg{width:12px;height:12px}
    .ast-perm-stats .m-stat-value{font-size:14px;white-space:nowrap}
    .ast-perm-stats .m-stat-label{font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    @media(max-width:768px){
        .ast-perm-stats{grid-template-columns:repeat(2,1fr);gap:6px}
        .ast-perm-stats .m-stat-card{padding:5px 8px;min-height:42px;gap:5px}
        .ast-perm-stats .m-stat-icon{width:22px;height:22px}
        .ast-perm-stats .m-stat-icon svg{width:10px;height:10px}
        .ast-perm-stats .m-stat-value{font-size:12px}
        .ast-perm-stats .m-stat-label{font-size:7px}
    }
</style>

<div class="m-stats ast-perm-stats">
    <!-- Card ejemplo -->
    <div class="m-stat-card stat-info">
        <div class="m-stat-icon" style="background:linear-gradient(135deg,#3b82f615,#3b82f630)">
            <!-- SVG icon 12x12 -->
        </div>
        <div style="display:flex;flex-direction:column;min-width:0;overflow:hidden">
            <div class="m-stat-value" style="color:#3b82f6">68.95h</div>
            <div class="m-stat-label">Total Horas</div>
        </div>
    </div>
</div>
```

---

## Valores clave

| Propiedad | Desktop | Mobile (<768px) |
|-----------|---------|-----------------|
| Grid columns | `repeat(4,1fr)` | `repeat(2,1fr)` |
| Grid gap | default (12px) | `6px` |
| Card direction | `row` | `row` |
| Card padding | `6px 10px` | `5px 8px` |
| Card min-height | `48px` | `42px` |
| Card gap (icon-text) | `6px` | `5px` |
| Icon size | `26x26px` | `22x22px` |
| SVG size | `12x12px` | `10x10px` |
| Value font-size | `14px` | `12px` |
| Label font-size | `8px` | `7px` |

---

## Clases de color (border-left)

| Clase | Color | Uso |
|-------|-------|-----|
| `stat-blue` | `--glass` (#1e40af) | Datos principales, totales |
| `stat-green` | `--success` (#059669) | Aprobados, positivos |
| `stat-amber` | `--accent` (#f59e0b) | Pendientes, advertencias |
| `stat-red` | `--danger` (#dc2626) | Alertas, rechazados |
| `stat-purple` | #8b5cf6 | Registros, categorías |
| `stat-info` | `--info` (#3b82f6) | Informativo secundario |

---

## Iconos SVG estándar

```javascript
// Check (aprobado/positivo)
'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'

// Reloj (horas/pendiente)
'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'

// Usuarios (trabajadores/registros)
'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>'
```

---

## Template JS reutilizable

```javascript
_cartasVitro(containerId, cards) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const colorMap = { blue: '#3b82f6', green: '#22c55e', amber: '#f59e0b', red: '#ef4444', purple: '#8b5cf6' };
    const iconMap = {
        check: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
        clock: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        users: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>'
    };

    container.innerHTML = '<style>'
        + '.ast-perm-stats{grid-template-columns:repeat(4,1fr)}'
        + '.ast-perm-stats .m-stat-card{flex-direction:row;align-items:center;gap:6px;padding:6px 10px;min-height:48px;overflow:hidden}'
        + '.ast-perm-stats .m-stat-icon{width:26px;height:26px;flex-shrink:0}'
        + '.ast-perm-stats .m-stat-icon svg{width:12px;height:12px}'
        + '.ast-perm-stats .m-stat-value{font-size:14px;white-space:nowrap}'
        + '.ast-perm-stats .m-stat-label{font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
        + '@media(max-width:768px){.ast-perm-stats{grid-template-columns:repeat(2,1fr);gap:6px}.ast-perm-stats .m-stat-card{padding:5px 8px;min-height:42px;gap:5px}.ast-perm-stats .m-stat-icon{width:22px;height:22px}.ast-perm-stats .m-stat-icon svg{width:10px;height:10px}.ast-perm-stats .m-stat-value{font-size:12px}.ast-perm-stats .m-stat-label{font-size:7px}}'
        + '</style>'
        + '<div class="m-stats ast-perm-stats">'
        + cards.map(c => {
            const clr = colorMap[c.color] || c.color;
            const ico = iconMap[c.icon] || c.icon;
            return '<div class="m-stat-card stat-' + (c.colorClass || c.color) + '">'
                + '<div class="m-stat-icon" style="background:linear-gradient(135deg,' + clr + '15,' + clr + '30)">' + ico + '</div>'
                + '<div style="display:flex;flex-direction:column;min-width:0;overflow:hidden">'
                + '<div class="m-stat-value" style="color:' + clr + '">' + c.value + '</div>'
                + '<div class="m-stat-label">' + c.label + '</div>'
                + '</div></div>';
        }).join('')
        + '</div>';
},

// Uso:
this._cartasVitro('container-id', [
    { value: '68.95h', label: 'Total Horas', color: 'blue', icon: 'clock' },
    { value: '13', label: 'Aprobados', color: 'green', icon: 'check' },
    { value: '1', label: 'Pendientes', color: 'amber', icon: 'clock' },
    { value: '14', label: 'Registros', color: 'purple', icon: 'users' }
]);
```

---

## Checklist

- [ ] Usar clase `ast-perm-stats` en el grid
- [ ] Icono a la izquierda (`flex-direction:row`)
- [ ] Valor + label apilados a la derecha
- [ ] `overflow:hidden` en card y contenedor texto
- [ ] `text-overflow:ellipsis` en label
- [ ] Grid 4 columnas desktop, 2 mobile
- [ ] SVG icons 12px desktop, 10px mobile
