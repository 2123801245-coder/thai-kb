@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 泰语个人知识库 · 手机 / 平板访问模式
echo 下面会列出手机要输入的网址；请让手机连上跟这台电脑同一个 Wi-Fi。
echo 首次运行 Windows 会问「是否允许防火墙」，请选「允许访问」。
echo 这个窗口不要关，关掉服务就停了。
echo.
where py >nul 2>nul
if %errorlevel%==0 ( py -3 server.py 8765 --lan ) else ( python server.py 8765 --lan )
pause
