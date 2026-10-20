# -*- coding: utf-8 -*-
"""补烤缺失的段落发音（Edge 泰语女声），只处理 lessons.json 里还没有 audio 的段落。"""
import asyncio
import base64
import json
import os
import subprocess
import sys
import tempfile
import time
from multiprocessing import Pool

import edge_tts

ROOT = '/Users/zhb/Desktop/大二上（泰语）'
VOICE = 'th-TH-PremwadeeNeural'
EXT = ROOT + '/data/voice-lessons.json'


def synth(text):
    async def go():
        parts = []
        async for ch in edge_tts.Communicate(text, VOICE).stream():
            if ch['type'] == 'audio':
                parts.append(ch['data'])
        return b''.join(parts)
    for i in range(3):
        try:
            return asyncio.run(asyncio.wait_for(go(), 30))
        except Exception:
            time.sleep(1.0 * (i + 1))
    return None


def one(t):
    raw = synth(t)
    if not raw:
        return t, None
    with tempfile.TemporaryDirectory() as td:
        src = os.path.join(td, 'a.mp3')
        dst = os.path.join(td, 'b.mp3')
        open(src, 'wb').write(raw)
        r = subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src,
                            '-ac', '1', '-ar', '24000', '-b:a', '32k', dst])
        if r.returncode != 0:
            return t, None
        return t, base64.b64encode(open(dst, 'rb').read()).decode()


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else ''
    lessons = json.load(open(ROOT + '/data/lessons.json'))
    data = json.load(open(EXT))
    todo = []
    for l in lessons:
        if only and only not in l.get('label', '') and only not in l.get('titleZh', ''):
            continue
        for p in l.get('paras', []):
            t = p.get('t')
            if t and t not in data and t not in todo:
                todo.append(t)
    print('待烤段落 %d' % len(todo), flush=True)
    fail = []
    done = 0
    with Pool(4) as pool:
        for t, b64 in pool.imap(one, todo, chunksize=1):
            if b64 is None:
                fail.append(t)
                continue
            data[t] = b64
            done += 1
            if done % 20 == 0:
                json.dump(data, open(EXT, 'w'), ensure_ascii=False)
                print('  %d/%d' % (done, len(todo)), flush=True)
    json.dump(data, open(EXT, 'w'), ensure_ascii=False)
    print('完成：voice-lessons %d 条，%.1f MB，失败 %d' %
          (len(data), os.path.getsize(EXT) / 1e6, len(fail)), flush=True)
    if fail:
        print('失败：' + '、'.join(f[:30] for f in fail[:10]), flush=True)


if __name__ == '__main__':
    main()
