# Loyihani git ga olish -- BIR MARTALIK.
#
# ISHLATISH (C:\math-booster ichida):
#   powershell -ExecutionPolicy Bypass -File scripts\git-boshlash.ps1
#
# Skript nima qiladi:
#   1. .gitignore to'g'ri ekanini tekshiradi
#   2. git init qiladi (agar hali bo'lmasa)
#   3. MAXFIY fayllar repoga tushmasligini TEKSHIRADI va
#      tushayotgan bo'lsa TO'XTAYDI
#   4. birinchi commit qiladi
#
# Internetga hech narsa yubormaydi. GitHub ga ulash -- alohida
# qadam, pastda yozilgan.
#
# Fayl ataylab toza ASCII da: Windows PowerShell 5.1 uzun tire va
# o'zbekcha apostrofni buzadi.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Loyiha: $root" -ForegroundColor Cyan

# --- 1. git bormi
#
# Diqqat: git o'rnatilgan bo'lsa ham, ALLAQACHON OCHIQ turgan
# PowerShell oynasida topilmasligi mumkin -- oyna ochilganda PATH
# qanday bo'lsa, shunday qolib ketadi. Shuning uchun PATH da
# topilmasa, odatdagi joylarni ham qarab chiqamiz.
$git = $null

if (Get-Command git -ErrorAction SilentlyContinue) {
    $git = "git"
} else {
    $joylar = @(
        "$env:ProgramFiles\Git\cmd\git.exe",
        "${env:ProgramFiles(x86)}\Git\cmd\git.exe",
        "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe"
    )

    foreach ($joy in $joylar) {
        if (Test-Path $joy) { $git = $joy; break }
    }

    if ($git) {
        Write-Host "git PATH da yo'q, lekin topildi: $git" -ForegroundColor Yellow
        Write-Host "Keyingi safar YANGI PowerShell oynasini oching." -ForegroundColor Yellow
    }
}

if (-not $git) {
    Write-Host "XATO: git topilmadi." -ForegroundColor Red
    Write-Host "  1) O'rnatilganmi: https://git-scm.com/download/win" -ForegroundColor Yellow
    Write-Host "  2) O'rnatgan bo'lsangiz, YANGI PowerShell oynasini oching." -ForegroundColor Yellow
    exit 1
}

& $git --version

# --- 2. .gitignore
if (-not (Test-Path ".gitignore")) {
    Write-Host "XATO: .gitignore yo'q. Avval uni qo'ying." -ForegroundColor Red
    exit 1
}

# --- 3. init
if (Test-Path ".git") {
    Write-Host "git allaqachon boshlangan." -ForegroundColor Yellow
} else {
    & $git init -b main | Out-Null
    Write-Host "git boshlandi (tarmoq: main)" -ForegroundColor Green
}

# CRLF/LF ogohlantirishlari xato emas -- ular ham xato oqimiga
# yoziladi, shuning uchun shu yerda ham vaqtincha yumshatamiz.
$ErrorActionPreference = "Continue"
& $git add -A
$ErrorActionPreference = "Stop"

# --- 4. MAXFIY FAYL TEKSHIRUVI
# Bu eng muhim qadam: bir marta yuborilgan maxfiy fayl
# tarixda abadiy qoladi.
$xavfli = @()
$royxat = & $git diff --cached --name-only

foreach ($fayl in $royxat) {
    if ($fayl -match '^\.env' -or
        $fayl -match '/\.env' -or
        $fayl -match '^backups/' -or
        $fayl -match '^tests-data/' -or
        $fayl -match '^qoralama/' -or
        $fayl -match '^node_modules/' -or
        $fayl -match '\.pem$') {
        $xavfli += $fayl
    }
}

if ($xavfli.Count -gt 0) {
    Write-Host "`nTO'XTATILDI -- quyidagi fayllar repoga tushmasligi kerak:" -ForegroundColor Red
    $xavfli | Select-Object -First 20 | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    if ($xavfli.Count -gt 20) { Write-Host ("  ... yana {0} ta" -f ($xavfli.Count - 20)) -ForegroundColor Red }
    Write-Host "`n.gitignore ni tekshiring, keyin qaytadan urinib ko'ring." -ForegroundColor Yellow
    & $git reset | Out-Null
    exit 1
}

$soni = ($royxat | Measure-Object).Count
Write-Host ("Tekshiruv o'tdi. Repoga {0} ta fayl tushadi." -f $soni) -ForegroundColor Green

# --- 5. birinchi commit
#
# Diqqat: bo'sh repoda `git log` xato yozadi ("does not have any
# commits yet"). PowerShell native buyruqning xato oqimini
# $ErrorActionPreference = "Stop" bilan HALOKATLI xato deb
# qabul qiladi va skript to'xtab qoladi. Shuning uchun bu yerda
# xato oqimi vaqtincha e'tiborsiz qoldiriladi.
$ErrorActionPreference = "Continue"
& $git rev-parse --verify HEAD *> $null
$bor = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = "Stop"

if ($bor) {
    Write-Host "Commit allaqachon bor, yangisi qilinmadi." -ForegroundColor Yellow
} else {
    & $git -c user.name="Vepa" -c user.email="v.kurbanklichev@gmail.com" `
        commit -q -m "Boshlangich holat: vepa.uz sayti"
    Write-Host "Birinchi commit qilindi." -ForegroundColor Green
}

Write-Host "`n--- KEYINGI QADAM (GitHub) ---" -ForegroundColor Cyan
Write-Host @"
1. github.com -> New repository
     nomi: math-booster
     turi: PRIVATE (maxfiy) -- bu shart
     README, .gitignore, license QO'SHMANG

2. Shu ikki buyruqni yozing (URL ni o'zingiznikiga almashtiring):

     git remote add origin https://github.com/FOYDALANUVCHI/math-booster.git
     git push -u origin main

Bundan keyin har o'zgarishda:
     git add -A
     git commit -m "nima o'zgardi"
     git push
"@ -ForegroundColor White
