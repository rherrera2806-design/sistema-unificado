# 📱 Patrón: Responsive Mobile-First para Módulos VitroFlow

## Nombre: `MODULE_RESPONSIVE_V1`

Aplica este patrón a cualquier módulo para hacerlo responsive en móvil.

---

## Paso 1: Estructura HTML con clases CSS compartidas

```javascript
page.innerHTML = `
    <div class="m-page">                          <!-- Contenedor seguro -->
        <div class="m-hero">                       <!-- Banner azul -->
            <div class="m-hero-inner">             <!-- Flex wrap -->
                <div class="m-hero-title">         <!-- Título -->
                    <h2>Mi Módulo</h2>
                    <p>Descripción</p>
                </div>
                <div class="m-filters">            <!-- Filtros -->
                    <input ...>
                    <select ...>
                </div>
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

## Paso 2: Renderizar contenido dinámico

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

## Paso 3: Archivos a modificar

| Archivo | Qué hacer |
|---------|-----------|
| `inv-js/modules/mimodulo.js` | Aplicar clases CSS + renderContent |
| `web/public/css/mobile.css` | Clases ya definidas (no cambiar) |
| `app.html` | Script tag con `?v=X.X.X` para cache bust |

---

## Clases CSS disponibles (mobile.css)

| Clase | Desktop | Mobile (<768px) |
|-------|---------|-----------------|
| `m-page` | max-width:100% | overflow-x:hidden |
| `m-hero` | flex horizontal | flex column |
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
- [ ] Usar `m-hero` para banner
- [ ] Usar `m-filters` para filtros
- [ ] Usar `m-actions` para botones
- [ ] Usar `m-card` + `m-card-header` + `m-card-body`
- [ ] Usar `m-table-wrap` para tabla
- [ ] Usar `m-cards-mobile` para cards móvil
- [ ] Guardar datos en `_data` o `_currentData`
- [ ] Llamar `renderContent()` después de cargar datos
- [ ] Actualizar cache bust en `app.html`
