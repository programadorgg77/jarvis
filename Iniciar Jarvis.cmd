@echo off
setlocal
cd /d "%~dp0"
title Jarvis - assistente local
if exist "runtime\node.exe" goto portable
where node >nul 2>nul
if errorlevel 1 goto not_ready
if not exist "node_modules\vite\bin\vite.js" goto not_ready
echo Abrindo o Jarvis neste computador...
echo Mantenha esta janela aberta durante o uso.
echo Para encerrar tudo, pressione Ctrl+C nesta janela.
node scripts/start.mjs --open
if errorlevel 1 pause
exit /b
:portable
echo Abrindo o Jarvis neste computador...
echo Mantenha esta janela aberta durante o uso.
"%~dp0runtime\node.exe" "%~dp0scripts\start-portable.mjs"
if errorlevel 1 pause
exit /b
:not_ready
echo Execute primeiro Instalar Jarvis.cmd.
pause
exit /b 1
