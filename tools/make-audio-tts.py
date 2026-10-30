#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""tools/make-audio-tts.py —— 给「内嵌发音里没有」的词条补本地音频（完全离线）

为什么需要：词汇讲解里有 55 个词条是语法结构（เมื่อ…ก็…、ไม่ว่า、แม้ว่า…），
它们从来没被录音包覆盖；刷卡时要保证「点开就有声」，就得本地合成一份放进 audio/。
用 macOS 自带泰语语音 Kanya（`say -v Kanya`）离线合成，不走任何在线 TTS。
生成的文件与 make-audio-pack.py 同一套命名（<id>_word.mp3），清单也是同一份，
所以播放层不用区分「录的」还是「合成的」。

用法：python3 tools/make-audio-tts.py [--force]
依赖：macOS `say` + ffmpeg；其它系统会直接报错退出（发布包里已带上生成好的文件）。
"""
import json
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')


def id_of(text):
    """与 js/audio.js idOf() 逐位一致（djb2 → base36 后 7 位）"""
    h = 5381
    for ch in text:
        h = (h * 33 + ord(ch)) & 0xFFFFFFFF
    s, n = '', h
    if n == 0:
        s = '0'
    while n:
        s = '0123456789abcdefghijklmnopqrstuvwxyz'[n % 36] + s
        n //= 36
    return s.rjust(7, '0')[-7:]
MANIFEST = os.path.join(DATA, 'audio-manifest.json')
VOICE = 'Kanya'


def main():
    force = '--force' in sys.argv
    with open(os.path.join(DATA, 'vok.json'), encoding='utf-8') as f:
        vok = json.load(f)
    with open(os.path.join(DATA, 'words.json'), encoding='utf-8') as f:
        words = json.load(f)
    with open(os.path.join(DATA, 'voice-lessons.json'), encoding='utf-8') as f:
        voice_ext = json.load(f)
    with open(MANIFEST, encoding='utf-8') as f:
        man = json.load(f)
    files = man.setdefault('files', {})

    todo = []
    for it in vok:
        w = (it.get('w') or '').strip()
        if w and w not in files:
            todo.append(('word', w))
    # 例句：词表 ex 里、内置例句发音包没有的句子，用同一套设备语音补齐，
    # 这样刷卡翻面点例句也有声（离线），不会只剩静默。
    for e in words:
        for pair in (e.get('ex') or []):
            s = (pair[0] or '').strip() if pair else ''
            if s and s not in files:
                todo.append(('ex', s))
    # 词汇讲解卡里的例句同样要能点读
    for c in vok:
        for pair in (c.get('sents') or []):
            s = ((pair or {}).get('t') or '').strip()
            if s and s not in files:
                todo.append(('ex', s))
    print('待补 %d 条' % len(todo))
    made = 0
    for kind, w in todo:
        rel = 'audio/%s_%s.mp3' % (id_of(w), kind)
        dest = os.path.join(ROOT, rel)
        files[w] = rel
        if not force and os.path.exists(dest):
            continue
        # 语法结构的省略号念出来很怪：换成停顿符再合成
        spoken = re.sub(r'…+', ' , ', w)
        fd, aiff = tempfile.mkstemp(suffix='.aiff')
        os.close(fd)
        try:
            subprocess.run(['say', '-v', VOICE, '-o', aiff, spoken], check=True)
            subprocess.run(
                ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', aiff,
                 '-map_metadata', '-1', '-ac', '1', '-ar', '22050', '-b:a', '48k', dest],
                check=True)
        finally:
            try:
                os.unlink(aiff)
            except OSError:
                pass
        made += 1
        print('  + [%s] %s → %s' % (kind, w[:20], rel))

    with open(MANIFEST, 'w', encoding='utf-8') as f:
        json.dump(man, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print('新生成 %d 个，清单合计 %d 条' % (made, len(files)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
