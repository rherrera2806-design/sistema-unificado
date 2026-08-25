# 🔘 Patrón: Botones VitroFlow

## Nombre: `BTN_VITRO`

Botones de acción con estilo sólido, colores semánticos, diseño consistente para heroes y toolbars.

---

## Estructura HTML

```html
<!-- Botón primario (accent/amarillo) -->
<button class="btn btn-accent" style="white-space:nowrap;padding:8px 14px;font-size:12px">
    + Nuevo
</button>

<!-- Botones de acción (colores sólidos) -->
<button class="btn" style="background:#16a34a;color:white;white-space:nowrap;padding:8px 14px;font-size:12px;border:none;border-radius:8px;font-weight:600;cursor:pointer">
    Excel
</button>

<button class="btn" style="background:#0891b2;color:white;white-space:nowrap;padding:8px 14px;font-size:12px;border:none;border-radius:8px;font-weight:600;cursor:pointer">
    Importar
</button>

<button class="btn" style="background:#dc2626;color:white;white-space:nowrap;padding:8px 14px;font-size:12px;border:none;border-radius:8px;font-weight:600;cursor:pointer">
    PDF
</button>
```

---

## Valores clave

| Propiedad | Valor |
|-----------|-------|
| padding | `8px 14px` |
| font-size | `12px` |
| border-radius | `8px` |
| font-weight | `600` |
| border | `none` |
| cursor | `pointer` |
| white-space | `nowrap` |

---

## Paleta de colores

| Uso | Color | Hex |
|-----|-------|-----|
| **Primario/Accent** | Amarillo | `btn-accent` (definido en CSS) |
| **Éxito/Exportar** | Verde | `#16a34a` |
| **Info/Importar** | Cyan | `#0891b2` |
| **Peligro/Eliminar** | Rojo | `#dc2626` |
| **Secundario** | Gris | `#64748b` |
| **Advertencia** | Naranja | `#f59e0b` |

---

## Botones en Hero (sobre fondo oscuro)

```html
<!-- Filtros (transparentes) -->
<button style="background:rgba(255,255,255,0.3);color:white;border:1px solid rgba(255,255,255,0.4);font-size:11px;padding:6px 12px;border-radius:6px">
    Todos
</button>

<!-- Acción principal (accent) -->
<button class="btn btn-accent" style="white-space:nowrap;padding:8px 14px;font-size:12px">
    + Nuevo
</button>

<!-- Acciones secundarias (sólidas) -->
<button style="background:#16a34a;color:white;padding:8px 14px;font-size:12px;border:none;border-radius:8px;font-weight:600">
    Excel
</button>
```

---

## Template JS reutilizable

```javascript
_btnVitro(text, color, icon) {
    const colorMap = {
        accent: 'btn-accent',
        green: '#16a34a',
        cyan: '#0891b2',
        red: '#dc2626',
        gray: '#64748b',
        orange: '#f59e0b'
    };
    const isAccent = color === 'accent';
    const bg = isAccent ? '' : 'background:' + (colorMap[color] || color) + ';';
    const cls = isAccent ? 'btn btn-accent' : 'btn';
    const style = bg + 'color:white;white-space:nowrap;padding:8px 14px;font-size:12px;border:none;border-radius:8px;font-weight:600;cursor:pointer';
    return '<button class="' + cls + '" style="' + style + '">' + (icon ? icon + ' ' : '') + text + '</button>';
},

// Uso:
container.innerHTML = this._btnVitro('Nuevo', 'accent')
    + this._btnVitro('Excel', 'green')
    + this._btnVitro('Importar', 'cyan')
    + this._btnVitro('PDF', 'red');
```

---

## Filtros en Hero (transparentes)

```javascript
_btnFiltro(text, active) {
    const bg = active ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)';
    const color = active ? 'white' : 'rgba(255,255,255,0.8)';
    const border = active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)';
    return '<button style="background:' + bg + ';color:' + color + ';border:1px solid ' + border + ';font-size:11px;padding:6px 12px;border-radius:6px;cursor:pointer">' + text + '</button>';
},
```

---

## Checklist

- [ ] padding `8px 14px` para acciones
- [ ] padding `6px 12px` para filtros
- [ ] font-size `12px` acciones, `11px` filtros
- [ ] border-radius `8px` acciones, `6px` filtros
- [ ] font-weight `600`
- [ ] border `none` para sólidos
- [ ] Colores semánticos: verde=éxito, cyan=info, rojo=peligro
