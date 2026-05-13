@echo off
REM Script para gerar e assinar AAB no Windows
REM Ajuste os valores abaixo conforme necessário

set KEYSTORE=my-release-key.jks
set ALIAS=my-key-alias
set AAB_PATH=app\build\outputs\bundle\release\app-release.aab
set ANDROID_DIR=android

REM 1. Gerar keystore (execute apenas uma vez)
IF NOT EXIST %KEYSTORE% (
    echo Gerando keystore...
    keytool -genkeypair -v -keystore %KEYSTORE% -keyalg RSA -keysize 2048 -validity 10000 -alias %ALIAS%
) ELSE (
    echo Keystore ja existe: %KEYSTORE%
)

REM 2. Gerar o bundle AAB
cd %ANDROID_DIR%
call gradlew bundleRelease
cd ..

REM 3. Assinar o AAB
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 -keystore %KEYSTORE% %ANDROID_DIR%\%AAB_PATH% %ALIAS%

REM 4. Verificar assinatura
jarsigner -verify -verbose -certs %ANDROID_DIR%\%AAB_PATH%

echo Processo concluido!
pause
