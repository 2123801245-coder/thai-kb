@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 ( start "" /b py -3 server.py ) else ( start "" /b python server.py )
timeout /t 3 >nul
start "" "http://127.0.0.1:8765/{{htmlEncoded}}"
