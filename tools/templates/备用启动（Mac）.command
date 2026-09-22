#!/bin/bash
cd "$(dirname "$0")"
lsof -tiTCP:8765 -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null
python3 server.py &
sleep 1.5
open "http://127.0.0.1:8765/{{htmlEncoded}}"
echo "知识库已启动；关掉这个终端窗口即关闭。"
