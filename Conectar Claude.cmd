@echo off
setlocal
cd /d "%~dp0"
title Jarvis - conectar sua conta Claude
echo Entre com a SUA conta Claude no navegador que sera aberto.
echo O acesso ao Claude Code precisa estar incluido no seu plano.
echo.
if not exist "node_modules\@anthropic-ai\claude-agent-sdk-win32-x64\claude.exe" goto missing
"%~dp0node_modules\@anthropic-ai\claude-agent-sdk-win32-x64\claude.exe" auth login --claudeai
if errorlevel 1 goto failed
echo.
echo Agora abra Iniciar Jarvis.cmd.
pause
exit /b
:missing
echo Extraia a pasta inteira do ZIP antes de executar este atalho.
pause
exit /b 1
:failed
echo.
echo Nao foi possivel concluir a conexao. Confira a mensagem acima e tente novamente.
pause
exit /b 1
