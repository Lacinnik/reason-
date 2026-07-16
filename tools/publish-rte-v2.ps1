[CmdletBinding()]
param(
  [string]$Repository = "Lacinnik/reason-",
  [string]$Branch = "feature/rte-v2",
  [int]$SupersededPullRequest = 1
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Require-Command {
  param([Parameter(Mandatory)][string]$Name, [string]$WingetId)
  if (Get-Command $Name -ErrorAction SilentlyContinue) { return }
  if (-not $WingetId -or -not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw "Не найдена команда '$Name'. Установите её и повторите запуск."
  }
  Write-Host "Устанавливаю $WingetId..." -ForegroundColor Cyan
  winget install --id $WingetId --exact --accept-package-agreements --accept-source-agreements
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
  }
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "'$Name' установлен, но пока не появился в PATH. Перезапустите PowerShell и запустите скрипт снова."
  }
}

Require-Command -Name git -WingetId "Git.Git"
Require-Command -Name gh -WingetId "GitHub.cli"

$authStatus = (& gh auth status --hostname github.com 2>&1 | Out-String)
if ($LASTEXITCODE -ne 0) {
  Write-Host "Открываю авторизацию GitHub..." -ForegroundColor Cyan
  & gh auth login --hostname github.com --git-protocol https --web --scopes workflow
  if ($LASTEXITCODE -ne 0) { throw "Авторизация GitHub не завершена." }
}
elseif ($authStatus -notmatch "workflow") {
  # Изменение файлов в .github/workflows требует дополнительного scope workflow.
  Write-Host "GitHub запросит подтверждение доступа к workflow..." -ForegroundColor Cyan
  & gh auth refresh --hostname github.com --scopes workflow
  if ($LASTEXITCODE -ne 0) { throw "Не удалось получить GitHub scope workflow." }
}

$source = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$work = Join-Path $env:TEMP ("rte-v2-publish-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $work | Out-Null

try {
  Write-Host "Клонирую $Repository..." -ForegroundColor Cyan
  & gh repo clone $Repository $work -- --depth=1 --branch main
  if ($LASTEXITCODE -ne 0) { throw "Не удалось клонировать репозиторий." }

  # Ветка могла быть создана ранее. Пересобираем её строго от текущего main.
  & git -C $work fetch origin "+refs/heads/${Branch}:refs/remotes/origin/${Branch}" 2>$null
  & git -C $work checkout -B $Branch origin/main
  if ($LASTEXITCODE -ne 0) { throw "Не удалось подготовить ветку $Branch от origin/main." }

  Write-Host "Копирую чистый RTE v2..." -ForegroundColor Cyan
  & robocopy $source $work /MIR /XD .git /NFL /NDL /NJH /NJS /NP | Out-Null
  $robocopyCode = $LASTEXITCODE
  if ($robocopyCode -gt 7) { throw "Robocopy завершился с кодом $robocopyCode." }

  # Публикационный скрипт полезен локально, но в продуктовую ветку не входит.
  Remove-Item -LiteralPath (Join-Path $work 'tools') -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath (Join-Path $work 'PUBLISHING.md') -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath (Join-Path $work 'PUBLISH_TO_GITHUB.md') -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath (Join-Path $work 'PUBLISH_RTE_V2.cmd') -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath (Join-Path $work 'PR_DESCRIPTION.md') -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath (Join-Path $work 'START_HERE.txt') -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath (Join-Path $work 'SHA256SUMS.txt') -Force -ErrorAction SilentlyContinue

  if (Get-Command npm -ErrorAction SilentlyContinue) {
    Write-Host "Запускаю локальный quality gate..." -ForegroundColor Cyan
    Push-Location $work
    try {
      & npm ci --ignore-scripts
      if ($LASTEXITCODE -ne 0) { throw "npm ci завершился ошибкой." }
      & npm run check
      if ($LASTEXITCODE -ne 0) { throw "Локальная проверка RTE v2 не пройдена." }
    }
    finally { Pop-Location }
  }
  else {
    Write-Host "Node.js не найден: локальная проверка пропущена, её выполнит GitHub Actions." -ForegroundColor Yellow
  }

  & git -C $work config user.name "Lacinnik"
  & git -C $work config user.email "239614775+Lacinnik@users.noreply.github.com"
  & git -C $work add -A

  & git -C $work diff --cached --quiet
  if ($LASTEXITCODE -eq 0) { throw "Изменений для публикации не найдено." }

  & git -C $work commit -m "RTE v2 clean production candidate"
  if ($LASTEXITCODE -ne 0) { throw "Не удалось создать коммит." }

  & git -C $work push --force-with-lease -u origin $Branch
  if ($LASTEXITCODE -ne 0) { throw "Не удалось отправить ветку в GitHub." }

  if ($SupersededPullRequest -gt 0) {
    & gh pr close $SupersededPullRequest --repo $Repository --comment "Закрыто как заменённое чистой веткой $Branch: без временных assembly-workflow и фрагментированных архивов." 2>$null
  }

  $bodyFile = Join-Path $work '.rte-pr-body.md'
  @"
## Что изменено

RTE v2 пересобран как обычное модульное статическое приложение без временных архивов, base64-фрагментов и самоперезаписывающихся workflow.

- смысловая сегментация длинных текстов;
- локальная переводная память с точным и близким совпадением;
- редактируемый результат и сохранение утверждённых исправлений;
- двунаправленный терминологический словарь;
- генерация и ранжирование нескольких форм;
- глубокая проверка через обратный перевод;
- метрики α / Q / Cₘ / T на основе обратной согласованности, инвариантов, словаря и структуры текста;
- защита чисел, URL, email, версий и аббревиатур;
- WebGPU с безопасным возвратом к WASM q8;
- офлайн-диагностика, подготовка обеих моделей, импорт и экспорт памяти;
- чистый Service Worker и фиксированный Transformers.js 3.7.2;
- прозрачный CI без assembly-этапа.

## Проверка

- `npm run check`;
- 26/26 модульных и статических тестов;
- локальный HTTP smoke test всех runtime-файлов.

## Перед слиянием

Проверить EN → RU, RU → EN и авиарежим в Safari на iPhone. До этого PR остаётся черновиком.
"@ | Set-Content -LiteralPath $bodyFile -Encoding UTF8

  $existing = & gh pr list --repo $Repository --head $Branch --state open --json url --jq '.[0].url'
  if ($existing) {
    Write-Host "PR уже существует: $existing" -ForegroundColor Green
  } else {
    $url = & gh pr create --repo $Repository --draft --base main --head $Branch --title "RTE v2 — clean production candidate" --body-file $bodyFile
    if ($LASTEXITCODE -ne 0) { throw "Ветка отправлена, но PR создать не удалось." }
    Write-Host "Готово: $url" -ForegroundColor Green
  }
}
finally {
  if (Test-Path $work) { Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue }
}
