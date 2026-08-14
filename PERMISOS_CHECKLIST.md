# ⚠️ RECORDATORIO DE PERMISOS - VitroFlow

## CADA VEZ QUE CREES UN NUEVO MÓDULO/SUBMÓDULO/FORMULARIO:

### 1. Agregar permisos en `api/src/config/dbSchema.js`

```javascript
const ALL_PERMS = [
    // ... permisos existentes ...
    'nuevo_modulo',                    // Ver módulo
    'nuevo_modulo.agregar',            // Crear registros
    'nuevo_modulo.editar',             // Editar registros
    'nuevo_modulo.eliminar',           // Eliminar registros
];
```

### 2. Agregar middleware en el backend (`api/src/routes/tu_archivo.js`)

```javascript
const { requireAnyPerm } = require('../middleware/permisos');

const MOD = 'nuevo_modulo';
const canView   = requireAnyPerm(MOD, `${MOD}.editar`, `${MOD}.eliminar`, `${MOD}.agregar`);
const canCreate = requireAnyPerm(`${MOD}.agregar`, MOD);
const canUpdate = requireAnyPerm(`${MOD}.editar`, MOD);
const canDelete = requireAnyPerm(`${MOD}.eliminar`, MOD);

// Usar en cada ruta:
router.get('/api/nuevo-modulo', canView, async (req, res) => { ... });
router.post('/api/nuevo-modulo', canCreate, async (req, res) => { ... });
router.put('/api/nuevo-modulo/:id', canUpdate, async (req, res) => { ... });
router.delete('/api/nuevo-modulo/:id', canDelete, async (req, res) => { ... });
```

### 3. Verificar botones en el frontend

```javascript
// Botón "Nuevo" → verificar canCreate
${App.canCreate('nuevo_modulo') ? '<button>Nuevo</button>' : ''}

// Botón "Editar" → verificar canEdit
${App.canEdit('nuevo_modulo') ? '<button>Editar</button>' : ''}

// Botón "Eliminar" → verificar canDelete
${App.canDelete('nuevo_modulo') ? '<button>Eliminar</button>' : ''}
```

### 4. Agregar en el sidebar (`web/public/js/app-main.js`)

```javascript
const sections = [
    // ... secciones existentes ...
    { key: 'nuevo_modulo', label: 'NUEVO MÓDULO', items: [
        { id: 'nuevo_modulo', label: 'Submódulo', icon: SVG.icon }
    ]}
];
```

### 5. Agregar en la estructura de permisos del sidebar

```javascript
const SIDEBAR_SECTIONS = {
    // ... secciones existentes ...
    nuevo_modulo: ['nuevo_modulo'],
};
```

---

## 📋 Tipos de Permisos

| Permiso | Acción | HTTP Method | Botón |
|---------|--------|-------------|-------|
| `modulo` | Ver módulo | GET | - |
| `modulo.agregar` | Crear | POST | Nuevo |
| `modulo.editar` | Editar | PUT/PATCH | Editar |
| `modulo.eliminar` | Eliminar | DELETE | Eliminar |

---

## 🔍 Verificación Rápida

Para verificar que un módulo tiene los permisos correctos:

```bash
# Buscar rutas sin middleware
grep -n "router\.\(get\|post\|put\|delete\)" api/src/routes/tu_archivo.js | grep -v "canView\|canCreate\|canUpdate\|canDelete\|requireAuth\|requirePerm"

# Buscar botones sin verificación en frontend
grep -n "btn-primary.*Nuevo\|btn-outline.*Editar\|btn-danger.*Eliminar" web/public/js/modules/tu_modulo.js | grep -v "canCreate\|canEdit\|canDelete"
```

---

## ⚡ NO OLVIDES

- [ ] Backend: TODAS las rutas POST/PUT/DELETE deben tener middleware
- [ ] Frontend: TODOS los botones de acción deben verificar permisos
- [ ] DB: Agregar permisos en `ALL_PERMS` de `dbSchema.js`
- [ ] Sidebar: Agregar módulo en `SIDEBAR_SECTIONS`
