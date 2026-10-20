# -*- coding: utf-8 -*-
"""给 voice.json 补烤生词发音（Edge 泰语女声 th-TH-Premwadee，24kHz 32kbps 单声道）。
自动扫描 data/words.json 里所有还没有发音的词。"""
import asyncio, base64, json, os, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(__file__))
from multiprocessing import Pool
import edge_tts

ROOT = __file__.rsplit('/tools/', 1)[0]
VOICE = 'th-TH-PremwadeeNeural'
OUT = ROOT + '/data/voice.json'

def synth(text):
    async def go():
        parts = []
        async for ch in edge_tts.Communicate(text, VOICE).stream():
            if ch['type'] == 'audio':
                parts.append(ch['data'])
        return b''.join(parts)
    for attempt in range(4):
        try:
            return asyncio.run(go())
        except Exception:
            if attempt == 3:
                raise
            import time; time.sleep(1.2 * (attempt + 1))

def one(text):
    raw = synth(text)
    with tempfile.TemporaryDirectory() as td:
        src, dst = os.path.join(td, 'a.mp3'), os.path.join(td, 'b.mp3')
        open(src, 'wb').write(raw)
        r = subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src,
                            '-ac', '1', '-ar', '24000', '-b:a', '32k', dst])
        if r.returncode != 0:
            raise RuntimeError('ffmpeg failed')
        return base64.b64encode(open(dst, 'rb').read()).decode()

def main():
    words = json.load(open(ROOT + '/data/words.json'))
    data = json.load(open(OUT))
    todo = []
    for w in words:
        t = w.get('t')
        if t and t not in data and t not in todo:
            todo.append(t)
    print('待烤 %d 个生词' % len(todo), flush=True)
    done = 0
    with Pool(4) as pool:
        for t, b64 in zip(todo, pool.imap(one, todo, chunksize=1)):
            data[t] = b64
            done += 1
            if done % 20 == 0:
                json.dump(data, open(OUT, 'w'), ensure_ascii=False)
                print('  %d/%d' % (done, len(todo)), flush=True)
    json.dump(data, open(OUT, 'w'), ensure_ascii=False)
    print('完成，voice.json 共 %d 条，%0.1f MB' % (len(data), os.path.getsize(OUT) / 1e6), flush=True)

if __name__ == '__main__':
    main()
