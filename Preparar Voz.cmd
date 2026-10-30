@echo off
setlocal
cd /d "%~dp0"
title Preparar voz brasileira do Jarvis
where py >nul 2>nul
if errorlevel 1 goto python_missing
py -3 -m venv .venv-voice
if errorlevel 1 goto voice_error
".venv-voice\Scripts\python.exe" -m pip install -r requirements-voice.txt
if errorlevel 1 goto voice_error
echo Voz brasileira preparada. Reinicie o Jarvis.
pause
exit /b 0
:python_missing
echo Instale Python 3 com o Python Launcher pelo site oficial:
echo https://www.python.org/downloads/windows/
echo A voz do navegador funciona enquanto isso.
pause
exit /b 1
:voice_error
echo Nao foi possivel preparar a voz. O Jarvis pode usar a voz do navegador.
pause
exit /b 1
