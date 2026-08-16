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
