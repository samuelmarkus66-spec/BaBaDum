@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Bitte zuerst Node.js 24 LTS von https://nodejs.org installieren.
  pause
  exit /b 1
)
if exist dist\index.html goto serve
if not exist node_modules (
  echo Abhaengigkeiten werden einmalig installiert. Internetzugang erforderlich.
  call npm ci --no-audit --no-fund
  if errorlevel 1 goto failed
)
call npm run build
if errorlevel 1 goto failed
:serve
node scripts/serve.mjs --open
if errorlevel 1 goto failed
exit /b 0
:failed
echo Der Start ist fehlgeschlagen. Die Fehlermeldung steht oben.
pause
exit /b 1
