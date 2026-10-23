# ===========================================================================
#  vepa.uz - Claude uchun 5 ta skill'ni o'rnatish
#
#  Ishga tushirish (PowerShell'da, math-booster papkasida):
#    powershell -ExecutionPolicy Bypass -File tools\claude-skills\setup-skills.ps1
#
#  DIQQAT: bu skill'lar uchinchi tomon kodi. Ba'zilari har sessiyada
#  avtomatik ishga tushadigan hook o'rnatadi va kodingizni o'qiydi.
#  vepa.uz'da o'quvchilar ma'lumoti bor - bittalab o'rnating, shoshmang.
# ===========================================================================

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path "$PSScriptRoot\..\..").Path
$HomeDir   = $env:USERPROFILE
$ClaudeDir = Join-Path $HomeDir ".claude"
$ClaudeMd  = Join-Path $ClaudeDir "CLAUDE.md"
$Workspace = Join-Path $ClaudeDir "task-observer"

function Step($n, $t) { Write-Host ""; Write-Host "==== $n. $t" -ForegroundColor Cyan }
function Ask($q) {
  $a = Read-Host "$q [h/y]"
  return ($a -match '^(h|ha|y|yes)$')
}

Write-Host "Loyiha: $ProjectRoot"
$nodeVer = (node -v 2>$null)
Write-Host "Node:   $nodeVer"
if (-not $nodeVer) {
  Write-Host "Node topilmadi. nodejs.org dan LTS o'rnating." -ForegroundColor Red
  exit 1
}
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
  Write-Host "Claude Code topilmadi. Avval o'rnating:" -ForegroundColor Yellow
  Write-Host "    irm https://claude.ai/install.ps1 | iex" -ForegroundColor Yellow
  Write-Host "Keyin yangi oynada bu skriptni qayta ishlating." -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
# 1. claude-mem - sessiyalar orasida xotira
# ---------------------------------------------------------------------------
Step 1 "claude-mem (xotira)"
if (Ask "claude-mem o'rnatilsinmi?") {
  $env:CLAUDE_MEM_ONLINE_OPTIN = "false"
  npx --yes claude-mem install
}

# ---------------------------------------------------------------------------
# 2. impeccable - frontend dizayn tekshiruvi (vepa.uz uchun eng mosi)
# ---------------------------------------------------------------------------
Step 2 "impeccable (dizayn tekshiruvi)"
if (Ask "impeccable o'rnatilsinmi (shu loyihaga)?") {
  Push-Location $ProjectRoot
  npx --yes impeccable install --providers=claude --scope=project
  Pop-Location
  Write-Host "Keyin Claude Code ichida bir marta: /impeccable init" -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
# 3. find-skills - skill qidirish (Vercel skills CLI)
# ---------------------------------------------------------------------------
Step 3 "find-skills (skill qidiruvi)"
if (Ask "find-skills o'rnatilsinmi?") {
  npx --yes skills add vercel-labs/skills --skill find-skills -a claude-code
}

# ---------------------------------------------------------------------------
# 4. task-observer - skill'laringizni kuzatib yaxshilash takliflari
# ---------------------------------------------------------------------------
Step 4 "task-observer (meta-skill)"
if (Ask "task-observer o'rnatilsinmi (barcha loyihalar uchun)?") {
  npx --yes skills add rebelytics/one-skill-to-rule-them-all --skill task-observer -g -a claude-code

  # Activation blokini CLAUDE.md ga qo'shamiz.
  $skillDir = Get-ChildItem -Path $ClaudeDir -Recurse -Directory -Filter "task-observer" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($skillDir) { $skillPath = $skillDir.FullName } else { $skillPath = (Join-Path $ClaudeDir "skills\task-observer") }

  $tpl = Get-Content (Join-Path $PSScriptRoot "activation-template.txt") -Raw
  $block = $tpl.Replace("__WORKSPACE__", $Workspace).Replace("__PROJECTS__", $ProjectRoot).Replace("__SKILLDIR__", $skillPath)

  New-Item -ItemType Directory -Force -Path $ClaudeDir | Out-Null
  $marker = "<!-- task-observer activation (auto) -->"
  if (Test-Path $ClaudeMd) { $existing = Get-Content $ClaudeMd -Raw } else { $existing = "" }
  if ($existing -notmatch [regex]::Escape($marker)) {
    $append = "`r`n`r`n" + $marker + "`r`n" + $block + "`r`n<!-- /task-observer activation -->`r`n"
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::AppendAllText($ClaudeMd, $append, $enc)
    Write-Host "Activation bloki qo'shildi: $ClaudeMd" -ForegroundColor Green
    Write-Host "Workspace: $Workspace" -ForegroundColor Green
  } else {
    Write-Host "Activation bloki allaqachon bor - tegilmadi." -ForegroundColor Yellow
  }
}

# ---------------------------------------------------------------------------
# 5. superpowers - Claude Code ICHIDA o'rnatiladi (npx yo'li yo'q)
# ---------------------------------------------------------------------------
Step 5 "superpowers (ish jarayoni) - qo'lda"
Write-Host "superpowers'ni bu skript o'rnata olmaydi: u faqat Claude Code ichidan o'rnatiladi."
Write-Host "Claude Code'ni oching va yozing:" -ForegroundColor Yellow
Write-Host "    /plugin install superpowers@claude-plugins-official" -ForegroundColor Yellow
Write-Host "So'ngra Claude Code'ni qayta ishga tushiring." -ForegroundColor Yellow

Write-Host ""
Write-Host "Tayyor. Har bir skill ishlayotganini YANGI sessiyada tekshiring." -ForegroundColor Cyan
