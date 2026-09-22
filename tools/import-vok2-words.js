#!/usr/bin/env node
/* 把《高泰1 第二课 词汇讲解》讲义里作为词条讲到的生词补进词库（data/words.json），
   并用与全库相同的泰语 TTS 管线为它们烤好内置发音（data/voice.json）。
   用法: node tools/import-vok2-words.js [--dry]
*/
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry');
const LESSON = '父亲给予我的 สิ่งที่พ่อมอบให้';

/* 讲义词条 → 词库字段（z 用讲义/词汇讲解卡里的中文释义，p 用泰语词性缩写） */
const NEW_WORDS = [
  ['เรียนจาก',    'ก',   '从……学；向……学；毕业于'],
  ['อ่าน',        'ก',   '读；看（观察、辨认、解读）'],
  ['ด้วย',        'บ',   '以……；用……（构成方式状语）'],
  ['น่า',         'ว',   '令人……的（前缀，加在动词/形容词前）'],
  ['ทำให้',       'ก',   '使；让；使得'],
  ['เต็มไปด้วย',  'ก',   '充满着；满是'],
  ['แต่',         'ว',   '只；净是（强调唯一的对象）'],
  ['อย่าง',       'บ',   '像……这样的；如同'],
  ['ไว้',         'ว',   '留着；放着（动词后附成分）'],
  ['สนุกกับ',     'ก',   '乐于……；对……感到开心'],
  ['ยิ่ง',        'ว',   '更；极其（放在副词后加强语气）'],
  ['ตาม',         'บ',   '沿着；顺着；跟随'],
  ['เว้นแต่',     'สัน', '除了……以外；除非'],
  ['แล้วแต่',     'ก',   '取决于；随……而定'],
  ['เอา',         'ก',   '拿；要；（置于动词后）持续、着力地做'],
  ['เชื้อ',       'น',   '种；菌；血统（เชื้อไฟ 引火物）'],
  ['แววตา',       'น',   '眼神；目光'],
  ['เชื้อโรค',    'น',   '病菌；病原体'],
  ['เชื้อไวรัส',  'น',   '病毒'],
  ['ติดเชื้อ',    'ก',   '感染；受传染'],
  ['เชื้อชาติ',   'น',   '民族；种族'],
  ['เชื้อสาย',    'น',   '血统；族裔（เชื้อสายจีน 华裔）'],
];

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
        if (!ok) return reject(new Error('响应不是音频（' + buf.length + ' 字节）'));
        resolve(buf);
      });
    }).on('error', reject);
  });
}

async function main() {
  const wordsPath = path.join(ROOT, 'data/words.json');
  const voicePath = path.join(ROOT, 'data/voice.json');
  const words = JSON.parse(fs.readFileSync(wordsPath, 'utf8'));
  const voice = JSON.parse(fs.readFileSync(voicePath, 'utf8'));

  const have = new Set(words.map(w => w.t));
  const todo = NEW_WORDS.filter(([t]) => !have.has(t));
  const skipped = NEW_WORDS.filter(([t]) => have.has(t)).map(([t]) => t);
  console.log('待新增 ' + todo.length + ' 词' + (skipped.length ? '，已在词库跳过: ' + skipped.join('、') : ''));

  let baked = 0, failed = [];
  for (const [t] of todo) {
    const key = norm(t);
    if (voice[key]) continue;                     // 已有发音不重烤
    try {
      const mp3 = await tts(key);
      voice[key] = mp3.toString('base64');
      baked++;
      process.stdout.write('🎙 ' + key + ' (' + mp3.length + 'B)\n');
    } catch (e) {
      failed.push(t + ': ' + e.message);
    }
  }

  todo.forEach(([t, p, z]) => words.push({ t, r: '', z, p, lesson: LESSON }));

  console.log('--- 烤制成功 ' + baked + '，失败 ' + failed.length + (failed.length ? '\n' + failed.join('\n') : ''));
  console.log('词库 ' + (words.length - todo.length) + ' → ' + words.length + ' 词；voice.json ' + Object.keys(voice).length + ' 条');

  const missing = words.filter(w => !voice[norm(w.t)]).map(w => w.t);
  console.log('仍无内置发音的词: ' + (missing.length ? missing.join('、') : '（无）'));

  if (DRY) return console.log('（--dry 未写入）');
  if (failed.length) return console.log('有烤制失败项，未写入，请重跑');
  fs.writeFileSync(wordsPath, JSON.stringify(words, null, 1) + '\n');
  fs.writeFileSync(voicePath, JSON.stringify(voice));
  console.log('已写入 data/words.json 与 data/voice.json');
}

main();
