@echo off
chcp 65001 >nul
title SilenceCutter Pro - Premiere Pro Eklenti Kurulumu
echo ========================================================
echo   SilenceCutter Pro - Adobe Premiere Pro Eklenti Kurulumu
echo ========================================================
echo.

set "SRC_DIR=%~dp0"
if "%SRC_DIR:~-1%"=="\" set "SRC_DIR=%SRC_DIR:~0,-1%"
set "CEP_DIR=%APPDATA%\Adobe\CEP\extensions"
set "TARGET_DIR=%CEP_DIR%\com.silencecutter.pro"

echo [1/3] Adobe CEP PlayerDebugMode (Imzasiz Eklenti Izni) aktif ediliyor...
for %%V in (8 9 10 11 12 13) do (
    reg add "HKCU\Software\Adobe\CSXS.%%V" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
)
echo       Tamamlandi.

echo [2/3] Yerel Ses Analiz Motoru (AudioAnalyzer.exe) derleniyor...
if not exist "%SRC_DIR%\bin" mkdir "%SRC_DIR%\bin"
if exist "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" (
    "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /optimize+ /out:"%SRC_DIR%\bin\AudioAnalyzer.exe" "%SRC_DIR%\src\AudioAnalyzer.cs"
    echo       AudioAnalyzer.exe hazir.
) else (
    echo       .NET derleyici bulunamadi, varsayilan motor kullanilacak.
)

echo [3/3] Eklenti Premiere Pro CEP klasorune kopyalaniyor...
if not exist "%CEP_DIR%" mkdir "%CEP_DIR%"
if exist "%TARGET_DIR%" (
    rmdir /s /q "%TARGET_DIR%" >nul 2>&1
)
mkdir "%TARGET_DIR%"
xcopy "%SRC_DIR%\*" "%TARGET_DIR%\" /E /I /Y /Q >nul

echo.
echo ========================================================
echo   KURULUM BASARIYLA TAMAMLANDI!
echo ========================================================
echo   Hedef Klasor: %TARGET_DIR%
echo.
echo   Kullanim:
echo   1. Adobe Premiere Pro'yu (aciksa yeniden) baslatin.
echo   2. Ust menuden: Window ^> Extensions ^> SilenceCutter Pro
echo      secenegine tiklayarak paneli acin.
echo ========================================================
echo.
pause
