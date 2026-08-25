# 🔘 Patrón: Botones VitroFlow

## Nombre: `BTN_VITRO`

Botones de acción con estilo sólido, colores semánticos, diseño consistente para heroes y toolbars.

---

## 1. Botones de Acción (Hero)

### Estructura HTML

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

### Valores clave

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

## 2. Filtros en Hero (con efecto selección)

### Estructura HTML

```html
<button class="btn btn-vitro-filter" data-filter="todos"
    style="background:white;color:#1e293b;padding:6px 12px;font-size:11px;border:none;border-radius:6px;font-weight:600;cursor:pointer">
    Todos
</button>
<button class="btn btn-vitro-filter" data-filter="activos"
    style="background:#16a34a;color:white;padding:6px 12px;font-size:11px;border:none;border-radius:6px;font-weight:600;cursor:pointer">
    Activos
</button>
<button class="btn btn-vitro-filter" data-filter="inactivos"
    style="background:#64748b;color:white;padding:6px 12px;font-size:11px;border:none;border-radius:6px;font-weight:600;cursor:pointer">
    Inactivos
</button>
```

### Valores clave

| Propiedad | Valor |
|-----------|-------|
| padding | `6px 12px` |
| font-size | `11px` |
| border-radius | `6px` |
| font-weight | `600` |
| border | `none` |
| cursor | `pointer` |
| class | `btn-vitro-filter` |
| data-filter | nombre del filtro |

### Paleta de filtros

| Filtro | Background | Color texto |
|--------|------------|-------------|
| Todos | `#ffffff` | `#1e293b` |
| Activos | `#16a34a` | `white` |
| Inactivos | `#64748b` | `white` |
| Alertas | `#dc2626` | `white` |
| Info | `#3b82f6` | `white` |

### Efecto al seleccionar

```javascript
filtrarTrabajadores(filtro) {
    this.trabFilter = filtro;
    const colors = {
        todos: { bg: '#ffffff', text: '#1e293b' },
        activos: { bg: '#16a34a', text: '#ffffff' },
        inactivos: { bg: '#64748b', text: '#ffffff' }
    };
    document.querySelectorAll('.btn-vitro-filter').forEach(b => {
        const f = b.dataset.filter;
        const c = colors[f] || colors.todos;
        b.style.background = c.bg;
        b.style.color = c.text;
        b.style.opacity = f === filtro ? '1' : '0.5';
        b.style.transform = f === filtro ? 'scale(1.05)' : 'scale(1)';
        b.style.boxShadow = f === filtro ? '0 2px 8px rgba(0,0,0,0.2)' : 'none';
    });
    this.renderTablaTrabajadores();
},
```

### Efectos visuales

| Estado | opacity | transform | box-shadow |
|--------|---------|-----------|------------|
| **Activo** | `1` | `scale(1.05)` | `0 2px 8px rgba(0,0,0,0.2)` |
| **Inactivo** | `0.5` | `scale(1)` | `none` |

---

## 3. Buscador en Hero (transparente)

### Estructura HTML

```html
<div style="position:relative">
    <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
    <input type="text" class="ast-input" placeholder="Buscar..." style="padding-left:32px;width:100%;min-width:120px;max-width:200px;background:rgba(255,255,255,0.35);color:white;border:1px solid rgba(255,255,255,0.5);font-size:11px;border-radius:6px">
</div>
```

### Valores clave

| Propiedad | Valor |
|-----------|-------|
| class | `ast-input` |
| padding-left | `32px` (para icono) |
| width | `100%` |
| min-width | `120px` |
| max-width | `200px` |
| background | `rgba(255,255,255,0.35)` |
| color | `white` |
| border | `1px solid rgba(255,255,255,0.5)` |
| border-radius | `6px` |
| font-size | `11px` |
| icono SVG | `left:10px`, `width:14`, `height:14`, `stroke:rgba(255,255,255,0.5)` |

---

## 4. Paleta de Colores Completa

| Uso | Color | Hex |
|-----|-------|-----|
| **Primario/Accent** | Amarillo | `btn-accent` (CSS) |
| **Éxito/Exportar** | Verde | `#16a34a` |
| **Info/Importar** | Cyan | `#0891b2` |
| **Peligro/Eliminar** | Rojo | `#dc2626` |
| **Secundario** | Gris | `#64748b` |
| **Advertencia** | Naranja | `#f59e0b` |
| **Filtro Todos** | Blanco | `#ffffff` |
| **Filtro Activo** | Verde | `#16a34a` |
| **Filtro Inactivo** | Gris | `#64748b` |

---

## 5. Templates JS Reutilizables

### Botón de acción

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

### Filtro con efecto

```javascript
_btnFiltro(text, color) {
    const colorMap = {
        white: { bg: '#ffffff', text: '#1e293b' },
        green: { bg: '#16a34a', text: '#ffffff' },
        gray: { bg: '#64748b', text: '#ffffff' },
        red: { bg: '#dc2626', text: '#ffffff' },
        blue: { bg: '#3b82f6', text: '#ffffff' }
    };
    const c = colorMap[color] || colorMap.white;
    return '<button class="btn btn-vitro-filter" data-filter="' + text.toLowerCase() + '" style="background:' + c.bg + ';color:' + c.text + ';padding:6px 12px;font-size:11px;border:none;border-radius:6px;font-weight:600;cursor:pointer">' + text + '</button>';
},

// Uso:
container.innerHTML = this._btnFiltro('Todos', 'white')
    + this._btnFiltro('Activos', 'green')
    + this._btnFiltro('Inactivos', 'gray');
```

### Aplicar efecto selección

```javascript
_aplicarEfectoFiltro(filtro, colors) {
    document.querySelectorAll('.btn-vitro-filter').forEach(b => {
        const f = b.dataset.filter;
        const c = colors[f] || colors.todos;
        b.style.background = c.bg;
        b.style.color = c.text;
        b.style.opacity = f === filtro ? '1' : '0.5';
        b.style.transform = f === filtro ? 'scale(1.05)' : 'scale(1)';
        b.style.boxShadow = f === filtro ? '0 2px 8px rgba(0,0,0,0.2)' : 'none';
    });
},
```

---

## 6. Checklist

- [ ] Botones acción: `padding:8px 14px`, `font-size:12px`, `border-radius:8px`
- [ ] Filtros: `padding:6px 12px`, `font-size:11px`, `border-radius:6px`
- [ ] Buscador: `padding-left:32px`, `background:rgba(255,255,255,0.35)`
- [ ] Filtros con `class="btn-vitro-filter"` y `data-filter="..."`
- [ ] Efecto selección: `opacity`, `scale(1.05)`, `box-shadow`
- [ ] Colores semánticos: verde=éxito, cyan=info, rojo=peligro
- [ ] border `none` para sólidos
- [ ] font-weight `600` en todos
