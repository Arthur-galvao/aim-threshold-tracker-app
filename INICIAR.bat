@echo off
title Aim Threshold Tracker
color 0B
echo ===================================================
echo     Iniciando Aim Threshold Tracker (Tauri Desktop)
echo ===================================================
echo.
cd /d "%~dp0"
call npm run tauri:dev
if %errorlevel% neq 0 (
    echo.
    echo Ocorreu um problema ao iniciar. Pressione qualquer tecla para fechar...
    pause >nul
)
