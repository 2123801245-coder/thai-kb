#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""tools/make-audio-pack.py —— 把内嵌的 base64 发音拆成独立音频文件 + 清单
   为什么要拆：词表发音现在整包塞在 data/voice.json（11MB base64），刷卡页要播
   一个词也得等整包解析；拆成「一个词一个文件 + 清单」后，<<audio src>> 直接按需
   取，断网也能播（发布包 / APK 里是本地相对路径）。

   产出：
     audio/<词条ID>_word.mp3    词表词条发音（48kbps 单声道 22.05kHz）
     audio/<词条ID>_ex.mp3      该词条第一条例句发音（没有例句的词条不生成）
     data/audio-manifest.json   { files: { <泰语原文>: "audio/xxx_word.mp3" } }

   词条ID 与 js/audio.js 的 idOf() 完全一致（djb2 → base36 取后 7 位），
   用哈希而不是自增序号：泰文没有稳定 id，词表排序一变自增号就全错位。

   用法：
     python3 tools/make-audio-pack.py           增量（已存在且清单一致的跳过）
     python3 tools/make-audio-pack.py --force   全量重建
"""
import base64
import hashlib
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
AUDIO = os.path.join(ROOT, 'audio')
MANIFEST = os.path.join(DATA, 'audio-manifest.json')
BITRATE = '48k'


def id_of(text):
    """与 js/audio.js idOf() 逐位一致：djb2 累加后取 32 位无符号数的 base36 后 7 位"""
    h = 5381
    for ch in text:
        h = (h * 33 + ord(ch)) & 0xFFFFFFFF
    s = ''
    n = h
    if n == 0:
        s = '0'
    while n:
        s = '0123456789abcdefghijklmnopqrstuvwxyz'[n % 36] + s
        n //= 36
    return s.rjust(7, '0')[-7:]


def load_json(name):
    with open(os.path.join(DATA, name), encoding='utf-8') as f:
        return json.load(f)


def encode(b64, dest):
    """base64 mp3 → 48kbps 单声道 mp3；先落临时文件再让 ffmpeg 覆盖写"""
    raw = base64.b64decode(b64)
    fd, tmp = tempfile.mkstemp(suffix='.mp3')
    try:
        with os.fdopen(fd, 'wb') as f:
            f.write(raw)
        subprocess.run(
            ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', tmp,
             '-map_metadata', '-1', '-ac', '1', '-ar', '22050', '-b:a', BITRATE, dest],
            check=True)
    finally:
        try:
            os.unlink(tmp)
        except OSError:
            pass


def main():
    force = '--force' in sys.argv
    words = load_json('words.json')
    vok = load_json('vok.json')
    voice = load_json('voice.json')

    # 旧清单：增量时复用，避免重复编码
    old = {}
    if os.path.exists(MANIFEST):
        try:
            with open(MANIFEST, encoding='utf-8') as f:
                old = json.load(f).get('files') or {}
        except Exception:
            old = {}

    os.makedirs(AUDIO, exist_ok=True)
    files = {}
    made = skipped = 0
    missing_words, missing_ex = [], []

    # ① 词表词条：words.json 全部 + 词汇讲解里出现过的词（都有内置发音）
    entries = []
    seen = set()
    for w in words:
        t = (w.get('t') or '').strip()
        if t and t not in seen:
            seen.add(t)
            entries.append(t)
    for it in vok:
        t = (it.get('w') or '').strip()
        if t and t not in seen:
            seen.add(t)
            entries.append(t)

    for t in entries:
        b64 = voice.get(t)
        if not b64:
            missing_words.append(t)
            continue
        rel = 'audio/%s_word.mp3' % id_of(t)
        dest = os.path.join(ROOT, rel)
        files[t] = rel
        if not force and os.path.exists(dest) and old.get(t) == rel:
            skipped += 1
            continue
        encode(b64, dest)
        made += 1

    # ② 例句：词条的第一条例句（泰语原文做 key，播放层按文本查表）
    ex_pairs = {}
    for w in words:
        ex = w.get('ex') or []
        if ex and isinstance(ex[0], list) and ex[0]:
            ex_pairs.setdefault(w.get('t'), ex[0][0])

    vl = load_json('voice-lessons.json')
    for t, text in ex_pairs.items():
        b64 = vl.get(text)
        if not b64:
            missing_ex.append((t, text[:24]))
            continue
        rel = 'audio/%s_ex.mp3' % id_of(text)
        dest = os.path.join(ROOT, rel)
        files[text] = rel
        if not force and os.path.exists(dest) and old.get(text) == rel:
            skipped += 1
            continue
        encode(b64, dest)
        made += 1

    payload = {
        'generated': __import__('datetime').datetime.now().strftime('%Y-%m-%d'),
        'bitrate': BITRATE,
        'note': '词条与例句的本地音频清单（tools/make-audio-pack.py 生成）；键是泰语原文，值是相对路径',
        'files': files,
    }
    with open(MANIFEST, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)
        f.write('\n')

    total = sum(os.path.getsize(os.path.join(ROOT, p)) for p in files.values() if os.path.exists(os.path.join(ROOT, p)))
    print('词条 %d 个（%d 个生成 / %d 个跳过）' % (len(entries), made, skipped))
    print('音频文件 %d 个：%.1f MB（平均 %.1f KB）' % (len(files), total / 1048576.0,
                                                    total / 1024.0 / max(1, len(files))))
    print('清单：%s' % os.path.relpath(MANIFEST, ROOT))
    if missing_words:
        print('⚠️ 缺词条发音 %d 个：%s' % (len(missing_words), '、'.join(missing_words[:12])))
    else:
        print('✅ 词条发音无缺失')
    if missing_ex:
        print('⚠️ 缺例句发音 %d 条：%s' % (len(missing_ex), '；'.join(t for t, _ in missing_ex[:8])))
    return 0


if __name__ == '__main__':
    sys.exit(main())
