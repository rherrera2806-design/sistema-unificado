# Checklist antes de publicar cada versión de VitroFlow Planta

Cada vez que se actualiza la app (bundle + APK), probar en un celular REAL:

## 🔴 OBLIGATORIO — Login con teclado abierto
- [ ] Probar en el celular **REAL** y con la app **ACTUALIZADA** (el código de la
      UI va dentro del APK: un cambio de interfaz NO se ve hasta actualizar).
- [ ] Al tocar **Email** y **Contraseña**, el teclado **no debe tapar ni expulsar
      los campos hacia arriba**: ambos campos y el botón "Ingresar" deben quedar
      visibles mientras se escribe. (Bug clásico que se repitió: los campos se
      perdían hacia arriba al abrir el teclado.)
- [ ] Repetir la prueba en el formulario de **registro de producción** (cantidad)
      y en **Movimientos**.

## Resto de la app
- [ ] Cola de trabajo: orden **T1 Noche → T2 Día** y badge de turno visible.
- [ ] Escaneo QR abre el registro pre-cargado.
- [ ] Al abrir con versión nueva disponible, muestra el aviso de actualización.

## Comandos
```powershell
# 1) Bundle (web de la app)
cd mobile; npm run build

# 2) APK firmado + copia automática al APK de distribución (/planta/)
powershell -ExecutionPolicy Bypass -File mobile\build-apk.ps1 -Notas "texto de la actualización"

# 3) Subir versión (versionCode/versionName viven en mobile/android/app/build.gradle)
git add mobile; git commit -m "app vX.Y"; git push origin master
```

> El orden de la cola y los datos los da el SERVIDOR (cambian sin actualizar la
> app). La UI (badges, formularios, teclado) va dentro del APK: cada cambio de
> interfaz requiere build + publicar APK nuevo.
