# Genera los PNG del lanzador de VitroFlow Planta desde los SVG de iconos/.
# Uso: powershell -ExecutionPolicy Bypass -File mobile\iconos\generar-iconos.ps1
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$res = Join-Path $raiz '..\android\app\src\main\res'
$tmp = Join-Path $env:TEMP 'vf-iconos'
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

# msedge headless rasteriza cada SVG a PNG exacto (DPR 1)
$edge = @(
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw 'No se encontro Microsoft Edge para rasterizar los iconos' }

function New-Png([string]$svgPath, [int]$size, [string]$outPath, [bool]$transparente) {
    $svg = Get-Content $svgPath -Raw
    $html = "<!DOCTYPE html><html><head><meta charset='utf-8'><style>*{margin:0;padding:0}body{width:${size}px;height:${size}px;overflow:hidden}" + $(if ($transparente) { 'background:transparent' } else { 'background:#1e293b' }) + "}svg{width:${size}px;height:${size}px;display:block}</style></head><body>$svg</body></html>"
    $page = Join-Path $tmp ("p_" + [System.IO.Path]::GetFileNameWithoutExtension($svgPath) + "_$size.html")
    [System.IO.File]::WriteAllText($page, $html, (New-Object System.Text.UTF8Encoding($false)))
    $bg = if ($transparente) { '00000000' } else { 'ff1e293b' }
    $pageUrl = "file:///" + (($page -replace '\\', '/') -replace ' ', '%20')
    $shot = "--screenshot=`"$outPath`""
    $p = Start-Process -FilePath $edge -ArgumentList @('--headless', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', "--window-size=$size,$size", "--default-background-color=$bg", $shot, $pageUrl) -Wait -PassThru -WindowStyle Hidden
    if (-not (Test-Path $outPath)) { throw "No se genero $outPath (codigo $($p.ExitCode))" }
}

# tamanos por densidad: mdpi 1x, hdpi 1.5x, xhdpi 2x, xxhdpi 3x, xxxhdpi 4x
$dens = @(@('mdpi',1), @('hdpi',1.5), @('xhdpi',2), @('xxhdpi',3), @('xxxhdpi',4))
$full = Join-Path $raiz 'ic_launcher_full.svg'
$round = Join-Path $raiz 'ic_launcher_round.svg'
$fg = Join-Path $raiz 'ic_launcher_foreground.svg'

foreach ($d in $dens) {
    $carpeta = Join-Path $res ("mipmap-" + $d[0])
    $m = [double]$d[1]
    New-Png $full  ([int](48 * $m))  (Join-Path $carpeta 'ic_launcher.png')        $false
    New-Png $round ([int](48 * $m))  (Join-Path $carpeta 'ic_launcher_round.png')  $false
    New-Png $fg    ([int](108 * $m)) (Join-Path $carpeta 'ic_launcher_foreground.png') $true
    Write-Output ("mipmap-" + $d[0] + " listo")
}
Write-Output 'Iconos generados OK'
