#!/usr/bin/env python3
# tools/make-zip.py —— 把发布目录压成一个 zip（给同学方便传输）
# 用法：python3 tools/make-zip.py [发布目录] [zip 路径]
# 为什么不用 zip 命令：macOS 的 zip 写中文文件名时不置 UTF-8 标志位（bit 11），
# Windows 自带解压会按 ANSI 解码 → 中文全变乱码；Python 的 zipfile 会正确置位。
import os, sys, zipfile

src = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/Desktop/泰语知识库-发布版')
out = sys.argv[2] if len(sys.argv) > 2 else os.path.expanduser('~/Desktop/泰语知识库-离线版.zip')
src = os.path.abspath(src)
top = os.path.basename(src)

if os.path.exists(out):
    os.remove(out)
n = 0
with zipfile.ZipFile(out, 'w', zipfile.ZIP_STORED) as z:   # 素材本身已压缩，存储即可（秒级）
    for root, dirs, files in os.walk(src):
        for f in files:
            full = os.path.join(root, f)
            z.write(full, os.path.join(top, os.path.relpath(full, src)))
            n += 1
print('已生成 %s（%d 个文件，%.1fMB）' % (out, n, os.path.getsize(out) / 1048576))
