#!/usr/bin/env python3
"""把 audio/ 分文件音频回填进 data/voice.json（只写纯文本键）。

背景：make-audio-tts.py 只写 audio/ 与 manifest、不写 voice.json。
词汇讲解播放时用 'vok|<文本>' 作键，但音频层会回退到纯文本键
（js/audio.js:51-53），所以这里只存一份，不为 vok| 再复制一份 base64。
"""
import base64, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data = lambda n: json.load(open(os.path.join(ROOT, 'data', n), encoding='utf-8'))
man = data('audio-manifest.json').get('files') or {}
voice = data('voice.json')

def norm(s):
    return re.sub(r'\s+', ' ', str(s or '')).strip()

added = 0
def put(text):
    global added
    t = norm(text)
    if not t or t in voice:
        return
    rel = man.get(t)
    if not rel:
        return
    p = os.path.join(ROOT, rel)
    if not os.path.exists(p):
        return
    b64 = base64.b64encode(open(p, 'rb').read()).decode()
    voice[t] = b64
    added += 1

for e in data('vok.json'):
    put(e.get('w'))
    for s in e.get('sents') or []:
        put(s.get('t'))
for e in data('words.json'):
    put(e.get('t'))
    for pair in (e.get('ex') or []):
        put(pair[0])
for e in data('disc.json'):
    for it in (e.get('items') or []):
        put(it.get('ex'))

json.dump(voice, open(os.path.join(ROOT, 'data', 'voice.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, separators=(',', ':'))
print('voice.json 新增 %d 条，共 %d 条' % (added, len(voice)))
