#!/usr/bin/env python3
"""报告 data/voice.json 里「已有分文件音频却还存着 base64」的条目（只读，不写文件）。

背景：前端取音顺序是「audio-manifest.json 登记的分文件 → 内置 base64 → 系统语音」，
所以清单里有登记、audio/ 里文件又在盘的文本，voice.json 里那份 base64 只在文件加载
失败时才用得上。当初为词汇讲解回填过 1957 条（25.8MB），已由
tools/prune-voice-inline.js 清掉；本脚本留作回归检查：正常应为 0 条。
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data = lambda n: json.load(open(os.path.join(ROOT, 'data', n), encoding='utf-8'))
man = data('audio-manifest.json').get('files') or {}
voice = data('voice.json')

redundant = []
chars = 0
for t, b64 in voice.items():
    rel = man.get(t)
    if rel and os.path.exists(os.path.join(ROOT, rel)):
        redundant.append(t)
        chars += len(b64)

if redundant:
    print('有 %d 条重复存了分文件音频（%.1fMB）：跑 node tools/prune-voice-inline.js 清理'
          % (len(redundant), chars / 1048576))
    print('  例如：' + '、'.join(redundant[:5]))
else:
    print('voice.json %d 条，没有与分文件音频重复的 base64' % len(voice))
