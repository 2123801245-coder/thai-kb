#!/usr/bin/env python3
# tools/make-update.py —— 生成「增量更新包」：只装相对上一版 zip 变化过的文件。
# 用法：python3 tools/make-update.py [上一版zip] [输出zip] [新发布目录]
#   三个参数都可省略，默认：
#     上一版 zip   ~/Desktop/泰语知识库-离线版.zip
#     输出         ~/Desktop/泰语知识库-更新包.zip
#     新发布目录   ~/Desktop/泰语知识库-发布版（刚由 make-package.js 生成）
#
# 背景：完整 zip 400 多兆，给已拿到旧版的同学发补丁，只需传变化过的文件。
# 判定方式：把上一版 zip 里每个文件的 CRC 与新发布目录逐个比对，
# CRC 相同视为没变（zip 的 CRC 本就是内容指纹，不必解压旧包）。
# 新增的文件也会进补丁；上一版有、这版没有的文件不处理（不主动删同学手里的文件）。
#
# 为什么是 Python：与 make-zip.py 同理 —— 写 zip 要保证中文文件名带 UTF-8
# 标志位（macOS 自带 zip 不置位，Windows 解压乱码），Python zipfile 会正确置位；
# 且项目约定 tools/ 不装第三方依赖。
import os, sys, zipfile, zlib

old_zip  = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/Desktop/泰语知识库-离线版.zip')
out_zip  = sys.argv[2] if len(sys.argv) > 2 else os.path.expanduser('~/Desktop/泰语知识库-更新包.zip')
new_dir  = os.path.abspath(sys.argv[3] if len(sys.argv) > 3 else os.path.expanduser('~/Desktop/泰语知识库-发布版'))

if not os.path.exists(old_zip):
    sys.exit('找不到上一版 zip：%s（还没发过版就先跑完整发版）' % old_zip)
if not os.path.isdir(new_dir):
    sys.exit('找不到新发布目录：%s（先跑 node tools/make-package.js）' % new_dir)

# 旧包内文件 → CRC32。arcname 第一段是顶层目录名，比对时剥掉；
# 补丁沿用同一个顶层目录名，解压后正好盖在旧文件夹上。
old_crc, top = {}, None
with zipfile.ZipFile(old_zip) as z:
    for i in z.infolist():
        if i.is_dir():
            continue
        head, _, rest = i.filename.partition('/')
        if rest:
            top = top or head
            old_crc[rest] = i.CRC
top = top or os.path.basename(old_zip)[:-4]
crc32 = lambda p: zlib.crc32(open(p, 'rb').read())

changed, added = [], []
n = 0
if os.path.exists(out_zip):
    os.remove(out_zip)
with zipfile.ZipFile(out_zip, 'w', zipfile.ZIP_STORED) as z:   # 素材已压缩，存储即可
    for root, dirs, files in os.walk(new_dir):
        if 'data-personal' in dirs:
            dirs.remove('data-personal')   # 📌固定的学习进度是个人数据，不进增量包
        for f in sorted(files):
            full = os.path.join(root, f)
            rel = os.path.relpath(full, new_dir)
            if rel not in old_crc:
                added.append(rel)
            elif crc32(full) != old_crc[rel]:
                changed.append(rel)
            else:
                continue    # 没变，不进补丁
            z.write(full, os.path.join(top, rel))
            n += 1

mb = lambda p: os.path.getsize(p) / 1048576
print('已生成 %s（%d 个文件，%.1fMB；完整包 %.1fMB）' % (out_zip, n, mb(out_zip), mb(old_zip)))
if changed: print('  更新 %d 个：%s' % (len(changed), '、'.join(changed[:8]) + ('…' if len(changed) > 8 else '')))
if added:   print('  新增 %d 个：%s' % (len(added),   '、'.join(added[:8])   + ('…' if len(added) > 8 else '')))
if not changed and not added:
    print('  与上一版没有差异（这版 zip 和上次内容相同）')
