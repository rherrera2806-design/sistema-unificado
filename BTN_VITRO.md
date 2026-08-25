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
<!-- Filtros (sólidos) -->
<button style="background:white;color:#1e293b;padding:6px 12px;font-size:11px;border:none;border-radius:6px;font-weight:600;cursor:pointer">
    Todos
</button>
<button style="background:#16a34a;color:white;padding:6px 12px;font-size:11px;border:none;border-radius:6px;font-weight:600;cursor:pointer">
    Activos
</button>
<button style="background:#64748b;color:white;padding:6px 12px;font-size:11px;border:none;border-radius:6px;font-weight:600;cursor:pointer">
    Inactivos
</button>

<!-- Buscador (transparente) -->
<div style="position:relative">
    <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
    <input type="text" placeholder="Buscar..." style="padding-left:32px;width:100%;min-width:120px;max-width:200px;background:rgba(255,255,255,0.35);color:white;border:1px solid rgba(255,255,255,0.5);font-size:11px;border-radius:6px">
</div>

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

## Filtros en Hero (sólidos)

```javascript
_btnFiltro(text, color) {
    const colorMap = {
        white: 'background:white;color:#1e293b',
        green: 'background:#16a34a;color:white',
        gray: 'background:#64748b;color:white',
        red: 'background:#dc2626;color:white',
        blue: 'background:#3b82f6;color:white'
    };
    const styles = colorMap[color] || colorMap.white;
    return '<button style="' + styles + ';padding:6px 12px;font-size:11px;border:none;border-radius:6px;font-weight:600;cursor:pointer">' + text + '</button>';
},

// Uso:
container.innerHTML = this._btnFiltro('Todos', 'white')
    + this._btnFiltro('Activos', 'green')
    + this._btnFiltro('Inactivos', 'gray');
```

---

## Buscador en Hero (transparente)

```html
<div style="position:relative">
    <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
    <input type="text" placeholder="Buscar..." style="padding-left:32px;width:100%;min-width:120px;max-width:200px;background:rgba(255,255,255,0.35);color:white;border:1px solid rgba(255,255,255,0.5);font-size:11px;border-radius:6px">
</div>
```

### Valores buscador

| Propiedad | Valor |
|-----------|-------|
| padding-left | `32px` (para icono) |
| min-width | `120px` |
| max-width | `200px` |
| background | `rgba(255,255,255,0.35)` |
| color | `white` |
| border | `1px solid rgba(255,255,255,0.5)` |
| font-size | `11px` |
| border-radius | `6px` |

---

## Checklist

- [ ] padding `8px 14px` para acciones
- [ ] padding `6px 12px` para filtros
- [ ] font-size `12px` acciones, `11px` filtros
- [ ] border-radius `8px` acciones, `6px` filtros
- [ ] font-weight `600`
- [ ] border `none` para sólidos
- [ ] Colores semánticos: verde=éxito, cyan=info, rojo=peligro
