# 📱 Patrón: Responsive Mobile-First para Módulos VitroFlow

## Nombre: `MODULE_RESPONSIVE_V1`

Aplica este patrón a cualquier módulo para hacerlo responsive en móvil.

---

## Paso 1: Estructura HTML con clases CSS compartidas

```javascript
page.innerHTML = `
    <div class="m-page">                          <!-- Contenedor seguro -->
        <div class="m-hero" style="padding:10px 14px">  <!-- Banner azul compacto -->
            <div style="position:relative;z-index:1">
                <h2 style="margin:0;font-size:14px;font-weight:800;color:white">Título</h2>
                <p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.7)">Descripción</p>
            </div>
        </div>

        <div class="m-actions">                    <!-- Botones superiores -->
            <button>Exportar</button>
            <button>Imprimir</button>
        </div>

        <div class="m-card">                       <!-- Card contenedor -->
            <div class="m-card-header">            <!-- Header card -->
                <h3>Título <span>(count)</span></h3>
            </div>
            <div class="m-card-body" id="content"> <!-- Contenido dinámico -->
            </div>
        </div>
    </div>`;
```

---

## Paso 2: Formularios - Estilo Compacto Aprobado

```html
<style>
    .inv-form-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px 10px;align-items:end}
    .inv-form-dims{display:grid;grid-template-columns:repeat(4,1fr);gap:6px 10px;align-items:end}
    .inv-form-grid>div,.inv-form-dims>div{min-width:0;margin:0}
    .inv-form-grid input,.inv-form-grid select,.inv-form-dims input,.inv-form-dims select{width:100%;box-sizing:border-box}
    .inv-form-grid label,.inv-form-dims label{font-size:10px;margin-bottom:2px;display:block;font-weight:600;color:#64748b}
    .inv-form-grid input,.inv-form-grid select,.inv-form-dims input,.inv-form-dims select{padding:10px 12px;font-size:13px;border:1px solid #e2e8f0;border-radius:8px}
    .inv-form-bottom{display:flex;gap:8px;margin-top:6px;align-items:end;padding-top:6px;border-top:1px solid #f1f5f9}
    @media(max-width:768px){
        .inv-form-grid{grid-template-columns:1fr}
        .inv-form-dims{grid-template-columns:1fr 1fr}
        .inv-form-bottom{flex-direction:column}
        .inv-form-bottom .btn{width:100%}
    }
</style>

<div class="m-card" style="margin-bottom:10px">
    <div class="m-card-header" style="padding:6px 12px;font-size:12px;font-weight:600">Título Formulario</div>
    <div class="m-card-body" style="padding:8px 12px">
        <form>
            <div class="inv-form-grid">
                <div class="form-group"><label>Campo 1</label><input type="text" class="form-control"></div>
                <div class="form-group"><label>Campo 2</label><select class="form-control">...</select></div>
                <div class="form-group"><label>Campo 3</label><input type="text" class="form-control"></div>
            </div>
            <div class="inv-form-dims" style="margin-top:4px">
                <div class="form-group"><label>Ancho</label><input type="number"></div>
                <div class="form-group"><label>Alto</label><input type="number"></div>
                <div class="form-group"><label>Cantidad</label><input type="number"></div>
                <div class="form-group"><label>Resultado</label><div style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-weight:700;color:#2563eb">0.00</div></div>
            </div>
            <div class="inv-form-bottom">
                <button type="submit" class="btn btn-primary">Guardar</button>
            </div>
        </form>
    </div>
</div>
```

### Valores clave del formulario:
- **Grid gap:** `6px 10px`
- **Labels:** `font-size:10px; margin-bottom:2px`
- **Inputs:** `padding:10px 12px; font-size:13px; border-radius:8px`
- **Card header:** `padding:6px 12px; font-size:12px`
- **Card body:** `padding:8px 12px`
- **Secciones margin:** `margin-top:4px`
- **Botón submit:** `padding:10px 28px; font-size:13px`
- **Botones acción (sm):** `padding:5px 12px; font-size:11px`
- **Filtros botones:** `padding:5px 12px; font-size:11px; border-radius:8px`

---

## Paso 3: Filtros - Estilo Botón

```html
<button class="btn btn-sm inv-filter-btn active">Todos</button>
<button class="btn btn-sm inv-filter-btn">Entradas</button>
<button class="btn btn-sm inv-filter-btn">Salidas</button>

<style>
    .inv-filter-btn{padding:5px 12px;font-size:11px;font-weight:600;border-radius:8px;border:1px solid #e2e8f0;background:white!important;color:#64748b!important;cursor:pointer;transition:all 0.15s}
    .inv-filter-btn:hover{border-color:#93c5fd;color:#3b82f6!important;background:#eff6ff!important}
    .inv-filter-btn.active{background:linear-gradient(135deg,#1e40af,#2563eb)!important;color:white!important;border-color:#1e40af!important;box-shadow:0 2px 8px rgba(30,64,175,0.3)}
</style>
```

---

## Paso 4: Renderizar contenido dinámico

```javascript
renderContent() {
    const container = document.getElementById('content');
    if (!container) return;

    if (this._data.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:48px">Sin datos</div>';
        return;
    }

    // Tabla desktop
    let tableHtml = '<div class="m-table-wrap"><table><thead><tr>'
        + '<th>Col1</th><th>Col2</th><th>Col3</th>'
        + '</tr></thead><tbody>';
    
    this._data.forEach(item => {
        tableHtml += '<tr><td>' + item.campo1 + '</td><td>' + item.campo2 + '</td></tr>';
    });
    
    tableHtml += '</tbody></table></div>';

    // Cards móvil
    let cardsHtml = '<div class="m-cards-mobile" style="display:none">';
    this._data.forEach(item => {
        cardsHtml += '<div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:10px">'
            + '<div style="font-weight:700">' + item.campo1 + '</div>'
            + '<div style="font-size:12px;color:#64748b">' + item.campo2 + '</div>'
            + '</div>';
    });
    cardsHtml += '</div>';

    container.innerHTML = tableHtml + cardsHtml;
}
```

---

## Clases CSS disponibles (mobile.css)

| Clase | Desktop | Mobile (<768px) |
|-------|---------|-----------------|
| `m-page` | max-width:100% | overflow-x:hidden |
| `m-hero` | padding:16px | padding:12px |
| `m-hero-inner` | flex row | flex column |
| `m-filters` | flex row | flex column |
| `m-stats` | grid 5col | grid 1col |
| `m-actions` | flex end | flex full-width |
| `m-table-wrap` | visible | `display:none` |
| `m-cards-mobile` | `display:none` | visible |
| `m-card` | max-width:100% | box-sizing:border-box |
| `m-form-grid` | grid 2col | grid 1col |

### Stat Cards - Sistema de Colores

```css
/* Estructura base */
.m-stat-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 12px 14px;
    border-left: 4px solid var(--gray-300);  /* default */
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
}
.m-stat-value { font-size: 18px; font-weight: 800; }
.m-stat-label { font-size: 9px; font-weight: 600; color: #64748b; text-transform: uppercase; }
```

**Clases de color (elegir según significado):**

| Clase | Color | Uso |
|-------|-------|-----|
| `stat-blue` | `--glass` (#1e40af) | Datos principales, totales |
| `stat-green` | `--success` (#059669) | Activos, positivos, completados |
| `stat-amber` | `--accent` (#f59e0b) | Advertencias, cantidades |
| `stat-red` | `--danger` (#dc2626) | Alertas, negativos, bloqueados |
| `stat-purple` | #8b5cf6 | Categorías, grupos, custom |
| `stat-info` | `--info` (#3b82f6) | Informativo secundario |

**Mobile:** 3 columnas iguales, labels con `text-overflow: ellipsis`

---

## Header/Hero Estándar (Todos los módulos)

```css
/* Desktop */
.m-hero {
    background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1e40af 100%);
    border-radius: 16px;
    padding: 8px 16px;
    margin-bottom: 20px;
    position: relative;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(15,23,42,0.3);
}
.m-hero h2 { margin:0; font-size:15px; font-weight:800; color:white; letter-spacing:-0.5px }
.m-hero p  { margin:2px 0 0; font-size:10px; color:rgba(255,255,255,0.7) }

/* Mobile */
@media(max-width:768px) {
    .m-hero { padding:12px; border-radius:12px; margin-bottom:16px }
}
```

### Botones en Header (siempre dentro de `.m-hero`)

```html
<!-- Botón outline transparente -->
<button class="btn btn-outline"
    style="color:white;border-color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.1)">
    Texto
</button>

<!-- Botón primario (accent) -->
<button class="btn btn-primary">+ Nuevo</button>
```

### Mobile botones en header
```css
@media(max-width:768px) {
    .m-hero-btns { display:flex; gap:8px; flex-wrap:wrap }
    .m-hero-btns .btn { height:40px; min-height:40px; flex:1 }
}
```

### Valores estándar

| Propiedad | Desktop | Mobile |
|-----------|---------|--------|
| Header padding | `8px 16px` | `12px` |
| Border-radius | `16px` | `12px` |
| h2 font-size | `15px` | `15px` |
| Subtitle font-size | `10px` | `10px` |
| Radial gradient | `180x180px` | `180x180px` |
| Botón height | normal | `40px` |

---

## ⚠️ LECCIÓN APRENDIDA: Revisión Exhaustiva

Cuando el usuario pida "revisar" un módulo, **NO asumas que está bien**. Revisa CADA detalle:

### Checklist de revisión obligatoria:

| Elemento | Qué revisar | Valor estándar |
|----------|-------------|----------------|
| **Header/Banner** | padding, font-size título, font-size subtítulo | `8px 16px`, `15px`, `10px` |
| **Filtros** | gap, padding inputs, border-radius | `8px`, `10px 12px`, `8px` |
| **StatCards** | grid columns, gap, padding, font-size | 5col→3col mobile, `12px`, `12px 14px`, `18px`/`9px` |
| **Botones** | altura mobile, font-size mobile | `40px`, `12px` |
| **Tabla** | min-width, overflow-x, headers font-size | `800px`, auto, `11px` |
| **Cards móvil** | border-radius, padding, font-size texto | `10px`, `12px`, `12px` |
| **Formularios** | gap, padding inputs, labels font-size, margin secciones | `12px`, `10px 12px`, `11px`, `16px` |
| **Espaciado** | margin-bottom entre secciones, padding cards | `20px`, `16px` |

### Preguntas obligatorias antes de responder "está bien":

1. ¿Los botones tienen `btn-sm`? → Siempre cambiar a `padding:8px 16px; font-size:12px`
2. ¿Los inputs tienen padding suficiente? → Mínimo `padding:10px 12px`
3. ¿El gap del grid es muy grande? → Máximo `6px 10px` para formularios
4. ¿Los labels son muy grandes? → `font-size:10px; margin-bottom:2px`
5. ¿Las cards tienen mucho padding? → `padding:8px 12px` para cards compactas

---

## 🏆 Patrón: Ranking Cards (`RANKING_CARDS_V1`)

Diseño de tarjetas de ranking para mostrar top 5 de cualquier métrica.

### Uso:
```javascript
// Datos del ranking:
const ranking = [
    { nombre: 'Juan Pérez', horas: 12.0 },
    { nombre: 'Pedro Gómez', horas: 8.5 },
    { nombre: 'María López', horas: 6.0 }
];

// Renderizar:
this._renderRanking('container-id', ranking, 'horas', 'Horas Extras');
```

### Helper centralizado (agregar al inicio del módulo):
```javascript
_rankingConfigs: [
    { border: '#f59e0b', bg: 'linear-gradient(135deg,#fffbeb,#fef3c7)', numBg: '#f59e0b', icon: '🏆', textColor: '#92400e', labelColor: '#b45309' },
    { border: '#94a3b8', bg: 'linear-gradient(135deg,#f8fafc,#f1f5f9)', numBg: '#94a3b8', icon: '🥈', textColor: '#334155', labelColor: '#64748b' },
    { border: '#f97316', bg: 'linear-gradient(135deg,#fff7ed,#ffedd5)', numBg: '#f97316', icon: '🥉', textColor: '#9a3412', labelColor: '#c2410c' },
    { border: '#8b5cf6', bg: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', numBg: '#8b5cf6', icon: '⭐', textColor: '#5b21b6', labelColor: '#7c3aed' },
    { border: '#3b82f6', bg: 'linear-gradient(135deg,#eff6ff,#dbeafe)', numBg: '#3b82f6', icon: '⭐', textColor: '#1e40af', labelColor: '#2563eb' }
],

_renderRanking(containerId, data, valueKey, label) {
    const c = document.getElementById(containerId);
    if (!c) return;
    if (!data || data.length === 0) { c.innerHTML = ''; return; }
    const configs = this._rankingConfigs;
    c.innerHTML = '<div class="ranking-container">' + data.slice(0, 5).map((r, i) => {
        const cfg = configs[i] || configs[4];
        const valor = r[valueKey] !== undefined ? r[valueKey] : r.valor || 0;
        return `<div class="ranking-card" style="background:${cfg.bg};border:2px solid ${cfg.border}">
            <div style="font-size:16px;margin-bottom:2px">${cfg.icon}</div>
            <div style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:${cfg.numBg};color:white;font-size:9px;font-weight:800;margin-bottom:2px">${i + 1}</div>
            <div class="ranking-name" style="color:${cfg.textColor}">${r.nombre}</div>
            <div style="font-size:16px;font-weight:800;color:${cfg.numBg};line-height:1">${typeof valor === 'number' ? valor.toFixed(1) : valor}</div>
            <div style="font-size:7px;text-transform:uppercase;letter-spacing:0.5px;color:${cfg.labelColor};font-weight:700;margin-top:2px">${label}</div>
        </div>`;
    }).join('') + '</div>';
},
```

### CSS (agregar al inicio del módulo):
```css
.ranking-container {
    display: flex;
    gap: 6px;
    justify-content: space-between;
    align-items: stretch;
    padding: 10px 0;
    width: 100%;
    box-sizing: border-box;
}
.ranking-card {
    border-radius: 10px;
    padding: 8px 4px;
    text-align: center;
    flex: 1 1 0;
    min-width: 0;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    box-sizing: border-box;
}
.ranking-name {
    font-size: 10px;
    font-weight: 700;
    margin-bottom: 2px;
    line-height: 1.2;
    min-height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    word-break: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
    padding: 0 2px;
}
@media (max-width: 768px) {
    .ranking-container { gap: 4px; padding: 8px 0; }
    .ranking-card { padding: 6px 2px; border-radius: 8px; }
    .ranking-name { font-size: 9px; min-height: 22px; }
}
```

### Colores estandarizados:
| Lugar | Color | Hex | Icono |
|-------|-------|-----|-------|
| 🥇 1er | Dorado | `#f59e0b` | 🏆 |
| 🥈 2do | Plata | `#94a3b8` | 🥈 |
| 🥉 3er | Bronce | `#f97316` | 🥉 |
| 4to | Púrpura | `#8b5cf6` | ⭐ |
| 5to | Azul | `#3b82f6` | ⭐ |

### Contenedor HTML:
```html
<div id="ranking-container"></div>
```

### Ejemplo de uso:
```javascript
// En el render del módulo:
c.innerHTML = `<div id="mi-ranking-container"></div>`;

// Calcular ranking:
const ranking = datos.reduce((acc, d) => {
    const nombre = d.nombre;
    if (!acc[nombre]) acc[nombre] = 0;
    acc[nombre] += d.horas;
    return acc;
}, {});
const rankingArray = Object.entries(ranking)
    .map(([nombre, horas]) => ({ nombre, horas }))
    .sort((a, b) => b.horas - a.horas)
    .slice(0, 5);

// Renderizar:
this._renderRanking('mi-ranking-container', rankingArray, 'horas', 'Horas Extras');
```

---

## Checklist

- [ ] Usar `m-page` como wrapper
- [ ] Usar `m-hero` para banner (compacto: `padding:10px 14px`)
- [ ] Usar `m-filters` para filtros
- [ ] Usar `m-actions` para botones
- [ ] Usar `m-card` + `m-card-header` + `m-card-body`
- [ ] Usar `m-table-wrap` para tabla
- [ ] Usar `m-cards-mobile` para cards móvil
- [ ] Formularios: `inv-form-grid` con `gap:6px 10px`
- [ ] Inputs: `padding:10px 12px; font-size:13px; border-radius:8px`
- [ ] Labels: `font-size:10px; margin-bottom:2px`
- [ ] Filtros: `inv-filter-btn` con estilos de botón
- [ ] Guardar datos en `_data` o `_currentData`
- [ ] Llamar `renderContent()` después de cargar datos
- [ ] Actualizar cache bust en `app.html`
