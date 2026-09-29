#!/bin/bash
# 一键发版：自检 → 打包 → 压缩 →（若桌面上有上一版 zip）生成增量更新包。
# 双击本文件即可；也可以在终端跑 node tools/release.js。窗口可以关了。
cd "$(dirname "$0")"
node tools/release.js
echo
echo "发版结束。桌面上：泰语知识库-发布版 / 泰语知识库-离线版.zip / 泰语知识库-更新包.zip（若有变化）"
read -p "按回车关闭…"
