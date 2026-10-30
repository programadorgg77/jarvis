@echo off
setlocal
cd /d "%~dp0"
title Preparar Jarvis
where node >nul 2>nul
if errorlevel 1 goto node_missing
node -e "if(Number(process.versions.node.split('.')[0]) < 22) process.exit(1)"
if errorlevel 1 goto node_missing
echo Instalando os componentes locais do Jarvis...
call npm ci
if errorlevel 1 goto install_error
echo.
echo Jarvis preparado. Nenhuma hospedagem foi contratada.
echo Leia o arquivo LEIA-ME.txt para configurar a IA e as suas integracoes.
echo Para abrir, use Iniciar Jarvis.cmd.
echo.
pause
exit /b 0
:node_missing
echo Instale o Node.js 22 ou mais recente pelo site oficial:
echo https://nodejs.org/en/download
echo Depois feche e abra novamente este arquivo.
pause
exit /b 1
:install_error
echo A instalacao falhou. Confira sua conexao com a internet e tente novamente.
pause
exit /b 1
