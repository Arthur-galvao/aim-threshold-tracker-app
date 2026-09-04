@echo off
title Aim Threshold Tracker (Web)
color 0A
echo ===================================================
echo     Iniciando Servidor Web (http://localhost:1420)
echo ===================================================
echo.
cd /d "%~dp0"
call npm run dev
pause
