# Genera el APK firmado de VitroFlow Planta.
# Uso:  powershell -ExecutionPolicy Bypass -File mobile\build-apk.ps1
# Salida: mobile\android\app\build\outputs\apk\release\app-release.apk

# Nota visible en el aviso de actualización de la app (todas las versiones leen
# version.json.notas). Se puede sobreescribir: .\build-apk.ps1 -Notas "texto"
param(
    [string]$Notas = 'Mejoras y correcciones. La app se actualiza encima de la actual: no se pierden datos.'
)
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path

# Publica mobile/app/version.json con la versión del APK: la app lo consulta al
# abrir para avisar cuando hay una actualización disponible.
$gradle = Get-Content (Join-Path $raiz 'android\app\build.gradle') -Raw
$versionCode = [int]([regex]::Match($gradle, 'versionCode\s+(\d+)').Groups[1].Value)
$versionName = [regex]::Match($gradle, 'versionName\s+"([^"]+)"').Groups[1].Value
$version = @{
    versionCode = $versionCode
    versionName = $versionName
    apk         = '/planta/VitroFlow-Planta.apk'
    fecha       = (Get-Date -Format 'yyyy-MM-dd')
    notas       = $Notas
} | ConvertTo-Json
# Escribir sin BOM: un BOM al inicio puede romper el parseo JSON en algunos
# navegadores/WebView.
$sinBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $raiz 'app\version.json'), $version, $sinBom)
Write-Output "version.json = $versionName ($versionCode)"

# JDK 21 (Capacitor 8 lo exige). Si JAVA_HOME ya apunta a un JDK 21+, se respeta.
$jdk21 = Join-Path $env:LOCALAPPDATA 'jdk-21'
$jdkDir = Get-ChildItem $jdk21 -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
if ($jdkDir) { $env:JAVA_HOME = $jdkDir.FullName }
Write-Output "JAVA_HOME = $env:JAVA_HOME"

$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME

# 1) Bundle de la web de la app
Push-Location $raiz
npm run build
npx cap sync android
# El APK de distribución vive en app/ para servirlo en /planta/, pero NO debe
# empaquetarse dentro de la app (cap sync copia todo app/ a los assets: sin este
# borrado cada APK contiene al anterior y crece sin control).
Get-ChildItem (Join-Path $raiz 'android\app\src\main\assets\public') -Filter *.apk -ErrorAction SilentlyContinue | Remove-Item -Force
Pop-Location

# 2) Compilar y firmar
Push-Location (Join-Path $raiz 'android')
.\gradlew.bat assembleRelease --no-daemon
Pop-Location

$apk = Join-Path $raiz 'android\app\build\outputs\apk\release\app-release.apk'
if (Test-Path $apk) {
    # Copia al APK de DISTRIBUCIÓN servido en /planta/ (bajada directa al celular)
    $dist = Join-Path $raiz 'app\VitroFlow-Planta.apk'
    Copy-Item $apk $dist -Force
    Write-Output ""
    Write-Output "APK listo: $apk"
    Write-Output ("Tamano: " + [math]::Round((Get-Item $apk).Length / 1MB, 1) + " MB")
    Write-Output "APK de distribucion (se sirve en /planta/): $dist"
    Write-Output ""
    Write-Output "CHECKLIST antes de publicar (mobile/QA-CHECKLIST.md):"
    Write-Output "  - LOGIN con teclado abierto: los campos NO deben taparse ni irse hacia arriba"
    Write-Output "  - Cola: T1 Noche -> T2 Dia con badge de turno"
} else {
    Write-Output "No se genero el APK (revisa los errores de Gradle arriba)"
}
