#!/usr/bin/env node
/* 为「📖 课文」段落补烤内置发音（幂等，可反复跑）。
   用途：新导入的课文如果没烤段落音频，点段落上的 🔊 会回退到系统泰语 / 在线兜底，
   音色与全库不一致；check.js 的「课文每个段落都有内置发音」也会报红。
   键 = 段落泰文原文（与 core.js 的 speakThai 归一化方式一致：空白折叠 + 去首尾）。

   用法:
     node tools/bake-lesson-voice.js                     补烤全部缺失段落
     node tools/bake-lesson-voice.js --only "课外听力练习"   只处理标题/标签含该关键词的课文
     node tools/bake-lesson-voice.js --dry               只报告，不写文件

   与 bake-lesson-audio.js 的分工：那个烤「整篇范读」到 media/（音频文件），
   本脚本烤「逐段发音」到 data/voice-lessons.json（页面点 🔊 用）。 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const onlyIdx = argv.indexOf('--only');
const ONLY = onlyIdx >= 0 ? argv[onlyIdx + 1] : null;

/* 与 core.js speakThai 相同的归一化：键必须对得上，否则页面查不到 */
const norm = t => String(t).replace(/\s+/g, ' ').trim();

function tts(text) {
  const url = 'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=th&q=' +
    encodeURIComponent(text);
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        'Referer': 'https://translate.google.com/',
      },
    }, res => {
      const bufs = [];
      res.on('data', c => bufs.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(bufs);
        const ok = buf.length > 1200 && (buf.slice(0, 3).toString('latin1') === 'ID3' ||
          (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0));
        if (!ok) return reject(new Error('响应不是音频（HTTP ' + res.statusCode + '，' + buf.length + ' 字节）'));
        resolve(buf);
      });
    }).on('error', reject);
  });
}

async function main() {
  const lessons = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/lessons.json'), 'utf8'));
  const extPath = path.join(ROOT, 'data/voice-lessons.json');
  const EXT = JSON.parse(fs.readFileSync(extPath, 'utf8'));

  const picked = ONLY
    ? lessons.filter(l => (l.label || '').includes(ONLY) || (l.titleZh || '').includes(ONLY))
    : lessons;
  const jobs = [];
  picked.forEach(l => {
    (l.paras || []).forEach((p, i) => {
      const key = norm(p.t);
      if (key && !EXT[key]) jobs.push({ key, text: key, what: l.titleZh || l.label, i: i + 1 });
    });
  });
  console.log('待补烤 ' + jobs.length + ' 段' + (ONLY ? '（课文含「' + ONLY + '」的 ' + picked.length + ' 篇）' : '（全部 ' + picked.length + ' 篇）'));

  let ok = 0; const failed = [];
  for (const j of jobs) {
    try {
      EXT[j.key] = (await tts(j.text)).toString('base64');
      ok++;
      process.stdout.write('🎙 ' + j.what + ' 第 ' + j.i + ' 段（' + j.key.slice(0, 26) + '…）\n');
    } catch (e) { failed.push(j.what + ' 第 ' + j.i + ' 段: ' + e.message); }
  }
  console.log('--- 成功 ' + ok + '，失败 ' + failed.length + (failed.length ? '\n' + failed.join('\n') : ''));
  if (DRY) return console.log('（--dry 未写入）');
  if (failed.length) return console.log('有失败项，未写入，请重跑（脚本幂等，已烤好的会跳过）');
  if (!ok) return console.log('没有需要补烤的段落，data/voice-lessons.json 未动');
  fs.writeFileSync(extPath, JSON.stringify(EXT));
  console.log('已写入 data/voice-lessons.json（' + Object.keys(EXT).length + ' 条）');
}

main();
