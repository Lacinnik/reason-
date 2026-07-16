@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo RTE v2: clean GitHub publication
echo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\publish-rte-v2.ps1"
set "code=%ERRORLEVEL%"
echo.
if not "%code%"=="0" (
  echo Publication failed with code %code%.
  echo Read the message above; the working site in main was not replaced.
  pause
  exit /b %code%
)
echo RTE v2 branch and draft pull request were published.
echo The pull request URL is shown above.
pause
exit /b 0
