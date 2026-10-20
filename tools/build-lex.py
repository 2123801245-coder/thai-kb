# -*- coding: utf-8 -*-
"""build-lex.py —— 建立「句内词条词典」data/lex.json

背景：课文每句里的词都应能点开看释义，而词表/词汇讲解只收了精讲词。
做法：
  1. 用 pythainlp newmm 切分所有课文句子（段落的 ss，没有 ss 用整段）；
  2. 词表( words.json ) + 词汇讲解( vok.json ) 里已有的词直接沿用人工释义；
  3. 其余词用 Chrome 词典接口（clients5.google.com/translate_a/t?client=dict-chrome-ex）
     取简明中文释义，标 auto=1，词性用 pythainlp pos_tag 给；
  4. 结果写进 data/lex.json { 词: { z: 中文, p: 词性, auto: 1 } }，前端 token.js 载入。

用法：.kb/venv/bin/python tools/build-lex.py [--limit N]
"""
import json
import os
import re
import sys
import threading
import time
import urllib.parse
import urllib.request

from pythainlp.tokenize import word_tokenize
from pythainlp.tag import pos_tag

ROOT = '/Users/zhb/Desktop/大二上（泰语）'
LEX = ROOT + '/data/lex.json'
THAI = re.compile(r'^[\u0E00-\u0E7F]+$')

TAGS = {
    'NCMN': 'น.', 'NTTL': 'น.', 'NPRP': 'น.', 'CNIT': 'น.', 'CLAS': 'น.', 'CMTR': 'น.',
    'VACT': 'ก.', 'VSTA': 'ก.', 'VIMP': 'ก.', 'VATT': 'ก.', 'VINV': 'ก.',
    'ADVN': 'ว.', 'ADVI': 'ว.', 'ADVP': 'ว.', 'ADVS': 'ว.',
    'PREL': 'ส.', 'DDAN': 'ว.', 'DDAC': 'ว.', 'DDBQ': 'ว.', 'DDMN': 'ว.', 'DDAQ': 'ว.',
    'DONM': 'ว.', 'DCNM': 'ว.', 'DTPM': 'ว.', 'DTRV': 'ว.',
}


def load_json(path):
    return json.load(open(path, encoding='utf-8'))


def sentences():
    out = []
    for l in load_json(ROOT + '/data/lessons.json'):
        for p in l.get('paras', []):
            for sn in (p.get('ss') or [[p['t'], '']]):
                if sn and sn[0]:
                    out.append(sn[0])
    return out


def gloss(word, tries=3):
    url = ('https://clients5.google.com/translate_a/t?client=dict-chrome-ex'
           '&sl=th&tl=zh-CN&q=' + urllib.parse.quote(word))
    for i in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=15) as r:
                data = json.loads(r.read().decode('utf-8'))
            if isinstance(data, list) and data and isinstance(data[0], str):
                return data[0].strip()
        except Exception:
            time.sleep(0.8 * (i + 1))
    return None


def main():
    limit = None
    if '--limit' in sys.argv:
        limit = int(sys.argv[sys.argv.index('--limit') + 1])

    hand = load_json(ROOT + '/data/lex-curated.json') if os.path.exists(ROOT + '/data/lex-curated.json') else {}
    curated = dict(hand)
    for w in load_json(ROOT + '/data/words.json'):
        curated.setdefault(w['t'], {'z': w.get('z') or '', 'p': w.get('p') or ''})
    for v in load_json(ROOT + '/data/vok.json'):
        if v.get('w') and v['w'] not in curated:
            curated[v['w']] = {'z': v.get('z') or '', 'p': v.get('p') or ''}

    toks = set()
    for s in sentences():
        for t in word_tokenize(s, engine='newmm'):
            if THAI.match(t) and (len(t) > 1 or t == 'ๆ'):
                toks.add(t)
    missing = sorted(t for t in toks if t not in curated)
    print('句子 %d · 唯一词 %d · 词典外 %d' % (len(sentences()), len(toks), len(missing)), flush=True)
    if limit:
        missing = missing[:limit]

    old = {}
    try:
        old = load_json(LEX)
    except Exception:
        pass
    todo = [w for w in missing if w not in old or not old[w].get('z')]
    print('待查 %d（已有缓存 %d）' % (len(todo), len(old)), flush=True)

    tags = dict(pos_tag(todo, engine='perceptron')) if todo else {}
    lock = threading.Lock()
    done = [0]

    def work(w):
        z = gloss(w)
        with lock:
            done[0] += 1
            if z:
                old[w] = {'z': z, 'p': TAGS.get(tags.get(w, ''), ''), 'auto': 1}
            else:
                old[w] = {'z': '', 'p': TAGS.get(tags.get(w, ''), ''), 'auto': 1}
            if done[0] % 50 == 0:
                json.dump(old, open(LEX, 'w'), ensure_ascii=False)
                print('  %d/%d' % (done[0], len(todo)), flush=True)

    threads = []
    for w in todo:
        t = threading.Thread(target=work, args=(w,))
        t.start()
        threads.append(t)
        if len(threads) >= 12:
            for t in threads:
                t.join()
            threads = []
    for t in threads:
        t.join()

    old.update({w: dict(v, auto=0) for w, v in (load_json(ROOT + '/data/lex-curated.json') if os.path.exists(ROOT + '/data/lex-curated.json') else {}).items()})
    json.dump(old, open(LEX, 'w'), ensure_ascii=False)
    bad = sum(1 for w, v in old.items() if not v.get('z'))
    print('lex.json 词条 %d · 无释义 %d · %.0f KB' %
          (len(old), bad, len(json.dumps(old, ensure_ascii=False)) / 1024), flush=True)


if __name__ == '__main__':
    main()
