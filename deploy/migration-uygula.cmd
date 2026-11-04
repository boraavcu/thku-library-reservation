@echo off
echo Bu komut hazir migration dosyasini uygular.
echo Seed calistirmaz, veritabanini sifirlamaz ve mevcut satirlari silmez.
cd /d "%~dp0..\backend"
call npx prisma migrate deploy
exit /b %errorlevel%
