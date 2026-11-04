@echo off
if "%BACKEND_PORT%"=="" (
  echo BACKEND_PORT bos. Ornek: set BACKEND_PORT=sunucudaki-bos-port
  exit /b 1
)
cd /d "%~dp0.."
call pm2 start ecosystem.config.cjs
call pm2 save
echo Backend yalnizca 127.0.0.1:%BACKEND_PORT% adresinde dinler.
exit /b %errorlevel%
