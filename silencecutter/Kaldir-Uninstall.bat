@echo off
chcp 65001 >nul
title SilenceCutter Pro - Kaldırma Aracı
echo ========================================================
echo   SilenceCutter Pro - Premiere Pro Eklentisi Kaldiriliyor
echo ========================================================
echo.

set "TARGET_DIR=%APPDATA%\Adobe\CEP\extensions\com.silencecutter.pro"

if exist "%TARGET_DIR%" (
    rmdir /s /q "%TARGET_DIR%"
    echo Eklenti basariyla kaldirildi: %TARGET_DIR%
) else (
    echo Kurulu eklenti bulunamadi.
)

echo.
pause
