@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  泰语个人知识库 · APK 分片合并
echo  ========================================
echo.
if not exist thai-kb.apk.part1 (
  echo  [错误] 找不到 thai-kb.apk.part1
  echo         请把 {{parts}} 个 part 文件与本脚本放在同一个文件夹里再运行。
  pause & exit /b 1
)
echo  正在合并 {{parts}} 个分片 …
{{copyCmd}}
if not exist thai-kb.apk (
  echo  [错误] 合并失败，请重新下载分片。
  pause & exit /b 1
)
echo  合并完成：thai-kb.apk
echo.
echo  正在校验（请稍等，约 10 秒）…
echo  期望值： {{sha256}}
certutil -hashfile thai-kb.apk SHA256 | findstr /r /v "^$"
echo.
echo  上面那串与「期望值」一致 = 文件完好，可以传到手机安装。
echo  不一致 = 分片下载不完整，请删掉全部 part 重新下载。
echo.
echo  安装：把 thai-kb.apk 发到手机（微信/QQ/数据线都行），
echo        点开安装，若提示「未知来源」请选允许。
echo.
pause
