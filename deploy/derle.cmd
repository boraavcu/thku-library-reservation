@echo off
setlocal
cd /d "%~dp0..\backend"
call npm ci
if errorlevel 1 exit /b 1
call npx prisma generate
if errorlevel 1 exit /b 1
echo prisma generate yalnizca Prisma istemcisini uretir. Veritabanina yazmaz.
call npm run build
if errorlevel 1 exit /b 1
cd /d "%~dp0..\frontend"
call npm ci
if errorlevel 1 exit /b 1
call npm run build
if errorlevel 1 exit /b 1
echo Frontend dist hazir. Uretimde vite preview kullanmayin.
exit /b 0
