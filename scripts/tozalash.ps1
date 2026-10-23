# Keshlarni tozalash.
#
# ISHLATISH (C:\math-booster ichida):
#   powershell -ExecutionPolicy Bypass -File scripts\tozalash.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\tozalash.ps1 -Hammasi
#
# -Hammasi bo'lmasa: faqat qurilish keshlari o'chiriladi (xavfsiz).
# -Hammasi bilan: node_modules ham o'chadi, keyin "npm i" kerak.
#
# DIQQAT: backups\ papkasi HECH QACHON o'chirilmaydi -- bu loyihaning
# yagona tarixi (git yo'q). tests-data\ ham tegilmaydi.
#
# Eslatma: fayl ataylab toza ASCII da yozilgan. Windows PowerShell 5.1
# uzun tire va o'zbekcha apostrofni buzib ko'rsatadi.

param([switch]$Hammasi)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Loyiha: $root" -ForegroundColor Cyan

function Olchov($path) {
    if (-not (Test-Path $path)) { return 0 }
    $item = Get-Item $path
    if ($item.PSIsContainer) {
        $bytes = (Get-ChildItem $path -Recurse -Force -File -ErrorAction SilentlyContinue |
                  Measure-Object -Property Length -Sum).Sum
    } else {
        $bytes = $item.Length
    }
    if ($null -eq $bytes) { return 0 }
    return $bytes
}

function Ochir($path, $izoh) {
    $bytes = Olchov $path
    if ($bytes -eq 0 -and -not (Test-Path $path)) {
        Write-Host ("  yoq       {0}" -f $path) -ForegroundColor DarkGray
        return 0
    }
    $mb = [math]::Round($bytes / 1MB, 1)
    Remove-Item -Recurse -Force $path -ErrorAction SilentlyContinue
    Write-Host ("  ochirildi {0}  ({1} MB)  -- {2}" -f $path, $mb, $izoh) -ForegroundColor Green
    return $bytes
}

$jami = 0

Write-Host "`nQurilish keshlari:" -ForegroundColor Yellow
$jami += Ochir ".next"                 "Next.js / Turbopack qurilishi"
$jami += Ochir "tsconfig.tsbuildinfo"  "TypeScript bosqichma-bosqich keshi"
$jami += Ochir "node_modules\.cache"   "paketlar keshi"
$jami += Ochir ".vercel\output"        "Vercel mahalliy chiqishi"

if ($Hammasi) {
    Write-Host "`nPaketlar:" -ForegroundColor Yellow
    $jami += Ochir "node_modules" "qayta o'rnatish kerak: npm i"
}

$mb = [math]::Round($jami / 1MB, 1)
Write-Host ("`nJami bo'shatildi: {0} MB" -f $mb) -ForegroundColor Cyan

Write-Host "`nTegilmadi (ataylab):" -ForegroundColor DarkYellow
Write-Host "  backups\     -- loyiha tarixi, git yo'q"
Write-Host "  tests-data\  -- test ma'lumotlari"
Write-Host "  qoralama\    -- hali yuklanmagan qoralamalar"

if ($Hammasi) {
    Write-Host "`nKeyingi qadam: npm i" -ForegroundColor Cyan
} else {
    Write-Host "`nKeyingi qadam: npm run dev" -ForegroundColor Cyan
}
