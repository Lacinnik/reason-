$ErrorActionPreference = "Stop"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js не найден. Установите Node.js 20+ и повторите."
}
npm run check
Write-Host "RTE v2: все локальные проверки пройдены." -ForegroundColor Green
