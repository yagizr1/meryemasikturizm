@echo off
cd /d "%~dp0"
echo Yonetim sunucusu basliyor...
echo Site: http://127.0.0.1:8787/anasayfa
echo Panel: http://127.0.0.1:8787/admin
echo Giris: admin / admin123
node server.js
pause
