#!/usr/bin/env node
/* 为「📐 辨析」卡片里缺内置发音的泰语例句补烤语音（幂等，可反复跑）。
   用途：辨析卡片的 🔊 只挂在例句上（disc.js 用 data-ex 调 speakThai），
   卡片是后加的时候常常没烤，点 🔊 会回退到系统语音或在线兜底，音色与全库不一致。
   本脚本把它们补成与词表/课文同一套女声。

   用法:
     node tools/bake-disc-voice.js            补烤全部缺失项
     node tools/bake-disc-voice.js --card "17."   只补标题里含该串的卡片
     node tools/bake-disc-voice.js --dry      只报告，不写文件
*/
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const cardIdx = argv.indexOf('--card');
const ONLY_CARD = cardIdx >= 0 ? argv[cardIdx + 1] : null;

const norm = t => String(t).replace(/\s+/g, ' ').trim();
/* 朗读文本：去掉展示用的省略号与括注（「…」「(介词)」），但键仍用展示原文，
   必须与 disc.js 点 🔊 时传进 speakThai 的字符串一致 */
const speakText = t => {
  const s = norm(String(t).replace(/[…\.]+\s*$/, '').replace(/\s*\([^)]*\)\s*/g, ' '));
  return s || norm(t);
};

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
        if (!ok) return reject(new Error('响应不是音频（' + buf.length + ' 字节）'));
        resolve(buf);
      });
    }).on('error', reject);
  });
}

async function main() {
  const discPath = path.join(ROOT, 'data/disc.json');
  const voicePath = path.join(ROOT, 'data/voice.json');
  const DISC = JSON.parse(fs.readFileSync(discPath, 'utf8'));
  const VOICE = JSON.parse(fs.readFileSync(voicePath, 'utf8'));

  const cards = ONLY_CARD ? DISC.filter(c => String(c.t || '').includes(ONLY_CARD)) : DISC;
  const jobs = [], seen = new Set();
  cards.forEach(c => (c.items || []).forEach(it => {
    if (!it.ex) return;
    const key = norm(it.ex);
    if (!key || seen.has(key) || VOICE[key]) return;   /* 已有内置发音的不重烤 */
    seen.add(key);
    jobs.push({ key, text: speakText(it.ex), what: c.t + ' · ' + key.slice(0, 28) });
  }));
  const total = DISC.reduce((n, c) => n + (c.items || []).filter(i => i.ex).length, 0);
  console.log('辨析例句共 ' + total + ' 条，待补烤 ' + jobs.length + ' 条'
    + (ONLY_CARD ? '（卡片：' + ONLY_CARD + '）' : '（全部卡片）'));

  let ok = 0; const failed = [];
  for (const j of jobs) {
    try {
      VOICE[j.key] = (await tts(j.text)).toString('base64');
      ok++;
      process.stdout.write('🎙 ' + j.what + '\n');
    } catch (e) { failed.push(j.what + ': ' + e.message); }
  }
  console.log('--- 成功 ' + ok + '，失败 ' + failed.length + (failed.length ? '\n' + failed.join('\n') : ''));
  if (DRY) return console.log('（--dry 未写入）');
  if (failed.length) return console.log('有失败项，未写入，请重跑（脚本幂等，已烤好的会跳过）');
  if (!ok) return console.log('没有需要补烤的例句，data/voice.json 未动');
  fs.writeFileSync(voicePath, JSON.stringify(VOICE));
  console.log('已写入 data/voice.json（' + Object.keys(VOICE).length + ' 条）');
}

main();
