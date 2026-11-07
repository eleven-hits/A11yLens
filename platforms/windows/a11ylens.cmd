@echo off
setlocal
set "A11YLENS_ROOT=%~dp0..\.."
if not exist "%A11YLENS_ROOT%\node_modules\axe-core" (
  echo A11yLens dependencies are missing.
  echo Run: powershell -ExecutionPolicy Bypass -File "%~dp0install.ps1"
  exit /b 2
)
node "%A11YLENS_ROOT%\bin\a11ylens.js" %*
exit /b %ERRORLEVEL%
