# -*- coding: utf-8 -*-
"""把「例句讲解生词」并进「词汇讲解」：每个词条带上它例句里出现的生词（nw 字段）。

· 生词释义仍由 tools/data/exwords.tsv 人工维护（词<TAB>中文释义<TAB>词性），脚本只做归属。
· 归好用 newmm 整词命中（不接受 ขอ 从 ขอร้อง 里切出来的错配）。
· 同步把旧版单独成组的 lesson=例句讲解生词 从 words.json 里清掉。
用法： .kb/venv/bin/python tools/build-vok-nw.py
"""
import json
from pythainlp.tokenize import word_tokenize

ROOT = __file__.rsplit('/tools/', 1)[0]
GROUP = '例句讲解生词'
TSV = ROOT + '/tools/data/exwords.tsv'

words = json.load(open(ROOT + '/data/words.json'))
vok = json.load(open(ROOT + '/data/vok.json'))

curated = []
for line in open(TSV, encoding='utf-8'):
    line = line.rstrip('\n')
    if not line or line.startswith('#'):
        continue
    p = line.split('\t')
    if len(p) >= 3:
        curated.append({'t': p[0].strip(), 'z': p[1].strip(), 'p': p[2].strip()})

known = {w['t'] for w in words if w.get('lesson') != GROUP}
cache = {}

def toks(s):
    if s not in cache:
        cache[s] = set(word_tokenize(s, engine='newmm'))
    return cache[s]

total = 0
used = set()
for it in vok:
    pool = set()
    for sn in it.get('sents', []):
        pool |= toks(sn['t'])
    it['nw'] = [dict(x) for x in curated if x['t'] not in known and x['t'] in pool]
    for x in it['nw']:
        used.add(x['t'])
    total += len(it['nw'])

rest = [w for w in words if w.get('lesson') != GROUP]
json.dump(rest, open(ROOT + '/data/words.json', 'w'), ensure_ascii=False)
json.dump(vok, open(ROOT + '/data/vok.json', 'w'), ensure_ascii=False)
print('词表回到 %d 词；%d 个词条挂上例句生词（合计 %d 条，去重 %d 个）；未归入任何词条的：%s'
      % (len(rest), sum(1 for it in vok if it['nw']), total, len(used),
         '、'.join(x['t'] for x in curated if x['t'] not in used and x['t'] not in known)))
