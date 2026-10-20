# -*- coding: utf-8 -*-
"""生成词表新分组「例句讲解生词」：词汇讲解例句里出现、但词表原本没有的词。

释义不靠猜：词表写在 tools/data/exwords.tsv（词<TAB>中文释义<TAB>词性），
脚本只负责把该词在「词汇讲解」例句里的原句找出来（pythainlp newmm 整词命中，
不用字符最长匹配，避免 ขอ 从 ขอร้อง 里切出来的错配），并按课文样式存进 words.json 的 ex 字段。

用法（需要 pythainlp）：
  .kb/venv/bin/python tools/build-exwords.py
"""
import json
import re
from pythainlp.tokenize import word_tokenize

ROOT = __file__.rsplit('/tools/', 1)[0]
GROUP = '例句讲解生词'
MAIN = ROOT + '/data/words.json'
VOK = ROOT + '/data/vok.json'
TSV = ROOT + '/tools/data/exwords.tsv'

words = json.load(open(MAIN))
vok = json.load(open(VOK))
words = [w for w in words if w.get('lesson') != GROUP]          # 可重复运行

known = {w['t'] for w in words if w.get('t')}                    # 词表已有 = 之前学过

curated = []
for line in open(TSV, encoding='utf-8'):
    line = line.rstrip('\n')
    if not line or line.startswith('#'):
        continue
    parts = line.split('\t')
    if len(parts) < 3:
        continue
    curated.append({'t': parts[0].strip(), 'z': parts[1].strip(), 'p': parts[2].strip()})

sents = [s for v in vok for s in v.get('sents', [])]
tok_cache = {}

def toks(sentence):
    if sentence not in tok_cache:
        tok_cache[sentence] = [t for t in word_tokenize(sentence, engine='newmm') if t.strip()]
    return tok_cache[sentence]

added, skipped = [], []
for item in curated:
    t = item['t']
    if t in known:
        skipped.append(t)                                        # 词表里已有，不算新词
        continue
    if not re.match(r'^[\u0E00-\u0E7F]+$', t):
        skipped.append(t)
        continue
    ex = []
    for s in sents:
        if t in toks(s['t']) and [s['t'], s['z']] not in ex:
            ex.append([s['t'], s['z']])
        if len(ex) >= 3:
            break
    if not ex:
        skipped.append(t)
        continue
    added.append({'t': t, 'z': item['z'], 'r': '', 'p': item['p'],
                  'lesson': GROUP, 'ex': ex, 'n': len(ex)})

words.extend(added)
json.dump(words, open(MAIN, 'w'), ensure_ascii=False)
print('「%s」新增 %d 条，共 %d 词；跳过 %d（已在词表 / 例句里没找到）：%s'
      % (GROUP, len(added), len(words), len(skipped), '、'.join(skipped[:12])))
