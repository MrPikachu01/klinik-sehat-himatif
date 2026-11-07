@echo off
cd /d "%~dp0"
echo Menjalankan Klinik Sehat di http://localhost:8000 (tekan Ctrl+C untuk berhenti)
where python >nul 2>nul && (python dev_server.py) || (py dev_server.py)
pause
