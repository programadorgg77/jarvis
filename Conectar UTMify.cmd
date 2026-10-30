@echo off
setlocal
cd /d "%~dp0"
title Jarvis - conectar UTMify
if not exist "runtime\node.exe" goto missing
"%~dp0runtime\node.exe" "%~dp0scripts\connect-utmify.mjs"
pause
exit /b
:missing
echo Extraia o ZIP portatil inteiro antes de abrir este atalho.
pause
exit /b 1
