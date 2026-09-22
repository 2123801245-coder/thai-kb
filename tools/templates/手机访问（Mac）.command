#!/bin/bash
cd "$(dirname "$0")"
lsof -tiTCP:8765 -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null
echo "泰语个人知识库 · 手机 / 平板访问模式"
echo "下面会列出手机要输入的网址；请让手机连上跟这台电脑同一个 Wi-Fi。"
echo "这个窗口不要关，关掉服务就停了。"
echo
python3 server.py 8765 --lan
