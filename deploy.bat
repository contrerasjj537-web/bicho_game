@echo off
REM Doble clic para desplegar en Windows (requiere Git for Windows instalado)
"C:\Program Files\Git\bin\bash.exe" "%~dp0deploy.sh" %*
pause
