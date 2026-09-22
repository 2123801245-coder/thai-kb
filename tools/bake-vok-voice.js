#!/usr/bin/env node
/* 为「📚 词汇讲解」里缺内置发音的例句 / 词条补烤语音（幂等，可反复跑）。
   用途：卡片是后加的，若当时没烤语音，点 🔊 会回退到系统语音或在线兜底，
   音色与全库不一致。本脚本把它们补成同一套女声。

   用法:
     node tools/bake-vok-voice.js            补烤全部缺失项
     node tools/bake-vok-voice.js --src "词汇讲解 高泰1 第二课"   只补某一组
     node tools/bake-vok-voice.js --dry      只报告，不写文件
*/
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const srcIdx = argv.indexOf('--src');
const ONLY_SRC = srcIdx >= 0 ? argv[srcIdx + 1] : null;

const norm = t => String(t).replace(/\s+/g, ' ').trim();
/* 朗读文本：去掉卡片显示用的省略号与词性括注（「น่า…」「ตาม (介词)」→「น่า」「ตาม」） */
const speakText = w => norm(String(w).replace(/[…\.]+\s*$/, '').replace(/\s*\([^)]*\)\s*/g, ' '));

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
  const vokPath = path.join(ROOT, 'data/vok.json');
  const extPath = path.join(ROOT, 'data/voice-lessons.json');
  const VOK = JSON.parse(fs.readFileSync(vokPath, 'utf8'));
  const EXT = JSON.parse(fs.readFileSync(extPath, 'utf8'));
  const has = key => !!EXT[key];

  const cards = ONLY_SRC ? VOK.filter(c => c.src === ONLY_SRC) : VOK;
  const jobs = [];
  cards.forEach(c => {
    /* 键必须与卡片渲染时查的键一致（reader 用 vok| + it.w） */
    if (!has('vok|' + c.w)) jobs.push({ key: 'vok|' + c.w, text: speakText(c.w), what: '词条 ' + c.w });
    c.sents.forEach(s => {
      const k = 'vok|' + norm(s.t);
      if (!has(k)) jobs.push({ key: k, text: norm(s.t), what: '例句 ' + s.t.slice(0, 28) });
    });
  });
  console.log('待补烤 ' + jobs.length + ' 条' + (ONLY_SRC ? '（组：' + ONLY_SRC + '）' : '（全部组）'));

  let ok = 0; const failed = [];
  for (const j of jobs) {
    try {
      EXT[j.key] = (await tts(j.text)).toString('base64');
      ok++;
      process.stdout.write('🎙 ' + j.what + '\n');
    } catch (e) { failed.push(j.what + ': ' + e.message); }
  }
  console.log('--- 成功 ' + ok + '，失败 ' + failed.length + (failed.length ? '\n' + failed.join('\n') : ''));
  if (DRY) return console.log('（--dry 未写入）');
  if (failed.length) return console.log('有失败项，未写入，请重跑（脚本幂等，已烤好的会跳过）');
  fs.writeFileSync(extPath, JSON.stringify(EXT));
  console.log('已写入 data/voice-lessons.json（' + Object.keys(EXT).length + ' 条）');
}

main();
