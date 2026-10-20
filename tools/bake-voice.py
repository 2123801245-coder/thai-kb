# -*- coding: utf-8 -*-
"""给 voice-lessons.json 补烤指定文本的发音（Edge 神经网络泰语女声 th-TH-Premwadee）。
用法：python3 tools/bake-voice.py <texts.json>
texts.json 是待烤文本数组；已存在同名 key 的会跳过。
每个子进程独立跑 asyncio（edge-tts 的 websocket 会话不能跨事件循环复用）。"""
import asyncio, base64, json, os, subprocess, sys, tempfile
from multiprocessing import Pool
import edge_tts

ROOT = __file__.rsplit('/tools/', 1)[0]
VOICE = 'th-TH-PremwadeeNeural'
OUT = ROOT + '/data/voice-lessons.json'

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
    texts = json.load(open(sys.argv[1]))
    data = json.load(open(OUT))
    todo = [t for t in texts if t not in data]
    print('待烤 %d 条（已有 %d 条）' % (len(todo), len(texts) - len(todo)), flush=True)
    done = 0
    with Pool(4) as pool:
        for t, b64 in zip(todo, pool.imap(one, todo, chunksize=1)):
            data[t] = b64
            done += 1
            if done % 20 == 0:
                json.dump(data, open(OUT, 'w'), ensure_ascii=False)
                print('  %d/%d' % (done, len(todo)), flush=True)
    json.dump(data, open(OUT, 'w'), ensure_ascii=False)
    print('完成，voice-lessons 共 %d 条，%0.1f MB' % (len(data), os.path.getsize(OUT) / 1e6), flush=True)

if __name__ == '__main__':
    main()
