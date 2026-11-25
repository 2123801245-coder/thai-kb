#!/usr/bin/env node
/* make-hotupdate.js —— 生成「数据热更新」清单 data/hotupdate.json
   为什么要有：APK 与离线发布版把 data/ 打在本地，内容更新本来只能重装/重下载。
   有了这份清单，应用内就能比对远端版本、只下变化的文字数据（发音包不动），
   存进 localStorage，下次启动由 js/hotupdate.js 覆盖 KB_RAW —— 不用重装。

   清单只收「文字数据」：words/patterns/lessons/quizzes/vok/disc/lessons.meta/
   sents/lex/lex-curated/app.json。voice*.json（发音）与 audio-manifest 体积大、
   缓存策略另有一套，不在这条通道里；新内容的发音回退系统泰语。

   用法：node tools/make-hotupdate.js
   产物：data/hotupdate.json
     { version, build, date, files: { 'words.json': { sha256, bytes }, ... } }
   每次发版必须重跑（tools/release.js 已排在自检之后、打包之前），
   check.js 会校验清单与 data/ 当前内容一致。 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'hotupdate.json');

/* 与浏览器端 js/hotupdate.js 用同一份清单；顺序固定，diff 干净 */
const FILES = [
  'app.json', 'words.json', 'patterns.json', 'lessons.json', 'lessons.meta.json',
  'quizzes.json', 'vok.json', 'disc.json', 'sents.json', 'lex.json', 'lex-curated.json'
];

const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'app.json'), 'utf8'));
const files = {};
for (const n of FILES) {
  const p = path.join(ROOT, 'data', n);
  if (!fs.existsSync(p)) throw new Error('缺文件：data/' + n);
  const buf = fs.readFileSync(p);
  files[n] = {
    sha256: crypto.createHash('sha256').update(buf).digest('hex'),
    bytes: buf.length
  };
}
const out = {
  version: app.version,
  build: app.build,
  date: app.date || new Date().toISOString().slice(0, 10),
  note: '文字数据热更新清单（发音包不在其中）',
  files
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
const total = Object.values(files).reduce((n, f) => n + f.bytes, 0);
console.log('已写 data/hotupdate.json：v' + out.version + ' build ' + out.build
  + '，' + FILES.length + ' 个文件 / ' + (total / 1048576).toFixed(2) + 'MB');
