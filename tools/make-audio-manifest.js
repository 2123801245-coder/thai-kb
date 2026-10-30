#!/usr/bin/env node
/* make-audio-manifest.js —— 生成发音清单 data/audio-manifest.json
   为什么要有清单：刷卡页要在「还没点播放」时就知道哪个词有得听、哪个词没有，
   不能靠点击后才报错。分文件音频（audio/<词条ID>_<类型>.mp3）这条路保留着——
   清单里列出路径，前端 KB.audio 就优先读文件；没列出的走内置 base64 发音包。

   用法：node tools/make-audio-manifest.js
   产物：data/audio-coverage.json（覆盖率报告；data/audio-manifest.json 由
         tools/make-audio-pack.py 生成，这里只读不写，避免两边互相覆盖）
     {
       generated: '2026-10-30',
       naming: 'audio/<词条ID>_<word|ex>.mp3',
       counts: { words, wordsAudio, examples, examplesAudio, missingWords, missingExamples, missingParas },
       files:  { '<泰文文本>': 'audio/xxx_word.mp3' },   // 只有真的放了文件才写进来，现在为空
       missing:{ words: [...], examples: [...], paras: [...] }
     } */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

/* 词条 ID：与 js/audio.js 的 idOf() 完全同一算法（djb2 → base36 取 7 位），
   保证「同一词」在清单与前端得到同一个文件名。 */
function idOf(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36).padStart(7, '0').slice(-7);
}

const words = J('data/words.json');
const vok = J('data/vok.json');
const lessons = J('data/lessons.json');
const voice = J('data/voice.json');
/* 分文件音频清单（tools/make-audio-pack.py / make-audio-tts.py 产出）：
   清单里登记过且文件真的在盘上，才算「有得听」，否则前端会用到 404 的路径 */
let PACK = {};
try { PACK = J('data/audio-manifest.json').files || {}; } catch (e) { PACK = {}; }
const packHas = t => !!PACK[t] && fs.existsSync(path.join(ROOT, PACK[t]));
const has = t => !!voice[t] || !!voice['vok|' + t] || packHas(t);

const missingWords = [], missingExamples = [], missingParas = [];
let examples = 0, examplesAudio = 0;

/* 1) 单词发音 */
words.forEach(w => { if (!has(w.t)) missingWords.push(w.t); });

/* 2) 词条例句发音（words.json 里只有 108 条带 ex） */
words.forEach(w => (w.ex || []).forEach(pair => {
  const s = (pair && pair[0]) || '';
  if (!s) return;
  examples++;
  if (voice[s] || voice['vok|' + s] || packHas(s)) examplesAudio++;
  else missingExamples.push(s);
}));
/* 3) 词汇讲解卡里的例句也算，一起报覆盖 */
vok.forEach(c => (c.sents || []).forEach(s => {
  if (!s.t) return;
  examples++;
  if (voice['vok|' + s.t] || voice[s.t] || packHas(s.t)) examplesAudio++;
  else missingExamples.push(s.t);
}));
/* 4) 课文段落发音在 voice-lessons（KB_VOICE_EXT），不属于本清单，只统计缺段 */
lessons.forEach(l => (l.paras || []).forEach(p => { if (!p.t) missingParas.push(l.label + ' 第' + (l.paras.indexOf(p) + 1) + '段'); }));

/* 分文件音频（tools/make-audio-pack.py 产出）：清单里登记的文件必须真的在盘上，
   否则前端按清单取路径会 404，再退回内置包，等于白记一条。 */
let packFiles = 0, packMissing = [];
try {
  Object.keys(PACK).forEach(k => {
    const f = path.join(ROOT, PACK[k]);
    if (fs.existsSync(f)) packFiles++; else packMissing.push(k);
  });
} catch (e) { packMissing = ['（还没有 data/audio-manifest.json）']; }

const dedup = a => Array.from(new Set(a));
const out = {
  generated: new Date().toISOString().slice(0, 10),
  naming: 'audio/<词条ID>_<word|ex>.mp3',
  counts: {
    words: words.length,
    wordsAudio: words.length - missingWords.length,
    examples,
    examplesAudio,
    missingWords: missingWords.length,
    missingExamples: dedup(missingExamples).length,
    missingParas: missingParas.length
  },
  pack: { files: packFiles, broken: packMissing.length },
  missing: {
    words: missingWords,
    examples: dedup(missingExamples).slice(0, 80),
    paras: missingParas.slice(0, 40)
  }
};
fs.writeFileSync(path.join(ROOT, 'data/audio-coverage.json'), JSON.stringify(out, null, 1));
console.log('单词 ' + out.counts.wordsAudio + '/' + out.counts.words
  + ' 有内置发音；例句 ' + examplesAudio + '/' + examples
  + '；缺词 ' + missingWords.length + '，缺例句 ' + out.counts.missingExamples
  + '，缺段 ' + missingParas.length
  + '；清单文件 ' + packFiles + ' 个在线（坏链 ' + packMissing.length + '）');
console.log('已写 data/audio-coverage.json');
