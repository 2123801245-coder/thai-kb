#!/usr/bin/env node
/* tools/bake-lesson-audio.js —— 给课文整篇烤朗读音频（TTS 按段合成 → ffmpeg 拼接）
   用法：node tools/bake-lesson-audio.js [--only "千年雨"] [--rate 0.9]
     --only  只处理标题含该关键词的课文（其余跳过）
     --rate  TTS 语速参数（默认 0.9，稍慢便于跟读）

   流程：每段泰文调 Google TTS 得 mp3 分段 → ffmpeg concat 拼接（段间 0.6s 静音）
         → media/base-reading/<slug>.mp3 → lessons.json 对应课文挂 media 字段。
   幂等：课文已有 media 里同 label 的音频就跳过；--force 重烤。
   前置：ffmpeg（brew install ffmpeg）。 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'media', 'base-reading');
const LESSONS = path.join(ROOT, 'data', 'lessons.json');
const RATE = (() => { const i = process.argv.indexOf('--rate'); return i >= 0 ? parseFloat(process.argv[i + 1]) || 0.9 : 0.9; })();
const ONLY = (() => { const i = process.argv.indexOf('--only'); return i >= 0 ? process.argv[i + 1] : null; })();
const FORCE = process.argv.includes('--force');

const say = m => console.log('  ' + m);

/* 与 tools/import-vok2-words.js 同一 TTS 管线；网络抽风重试 3 次（指数退避） */
function ttsOnce(text, rate) {
  const url = 'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=th&q=' + encodeURIComponent(text)
    + '&ttsspeed=' + rate;
  const buf = execSync('curl -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" '
    + '-H "Referer: https://translate.google.com/" "' + url + '"', { maxBuffer: 64 * 1024 * 1024 });
  if (buf.length < 1200 || (buf[0] !== 0x49 && buf[0] !== 0xff)) throw new Error('TTS 返回不像 mp3（' + buf.length + 'B）');
  return buf;
}
function tts(text, rate) {
  let err = null;
  for (let i = 0; i < 3; i++) {
    try { return ttsOnce(text, rate); }
    catch (e) { err = e; execSync('sleep ' + (1.5 * (i + 1))); }
  }
  throw err;
}
const norm = s => String(s || '').replace(/\s+/g, ' ').trim();

/* 长段落切段（TTS 单次上限约 200 字符，按词间空格切） */
function splitText(t, max = 180) {
  if (t.length <= max) return [t];
  const words = t.split(' ');
  const out = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max && cur) { out.push(cur.trim()); cur = w; }
    else cur = (cur + ' ' + w).trim();
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/* 泰文标题 → 文件名 slug（保留泰文与短横） */
function slug(label) {
  return label.replace(/[^\u0E00-\u0E7Fa-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'lesson';
}

async function main() {
  const lessons = JSON.parse(fs.readFileSync(LESSONS, 'utf8'));
  const targets = lessons.filter(l => l.course === '泰语基础阅读'
    && (!ONLY || l.label.includes(ONLY) || (l.title || '').includes(ONLY)));
  if (!targets.length) { console.log('没有匹配的基础阅读课文'); return; }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const l of targets) {
    const file = slug(l.title || l.label) + '.mp3';
    const rel = 'media/base-reading/' + file;
    const have = (l.media || []).some(m => m.src === rel);
    if (have && !FORCE) { say('跳过（已有）：' + l.label); continue; }

    const paras = (l.paras || []).map(p => norm(p.t)).filter(Boolean);
    if (!paras.length) { say('无段落，跳过：' + l.label); continue; }
    const total = paras.join('').length;
    console.log('▶ ' + l.label + '（' + paras.length + ' 段 / ' + total + ' 字）');

    /* 逐段合成到临时目录 */
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-audio-'));
    let n = 0;
    try {
      for (let pi = 0; pi < paras.length; pi++) {
        const chunks = splitText(paras[pi]);
        for (let ci = 0; ci < chunks.length; ci++) {
          const buf = tts(chunks[ci], RATE);
          fs.writeFileSync(path.join(tmp, 'c' + String(n).padStart(4, '0') + '.mp3'), buf);
          n++;
          process.stdout.write('\r    合成 ' + n + ' 块…');
        }
        /* 段间静音 0.6s（用 ffmpeg 生成一次复用） */
        if (pi < paras.length - 1) {
          const sil = path.join(tmp, 'c' + String(n).padStart(4, '0') + '.mp3');
          if (!fs.existsSync(sil)) {
            execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', '0.6',
              '-b:a', '48k', sil], { stdio: 'ignore' });
          }
          n++;
        }
      }
      console.log('');
      /* ffmpeg concat 拼接 */
      fs.writeFileSync(path.join(tmp, 'list.txt'), fs.readdirSync(tmp).filter(f => f.endsWith('.mp3')).sort()
        .map(f => 'file \'' + f + '\'').join('\n'));
      const dest = path.join(OUT_DIR, file);
      execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'),
        '-c:a', 'libmp3lame', '-b:a', '48k', dest], { stdio: ['ignore', 'ignore', 'ignore'] });
      const mb = (fs.statSync(dest).size / 1048576).toFixed(2);
      say('✓ ' + rel + '（' + mb + 'MB）');

      /* lessons.json 挂 media（保持 indent1 排版） */
      l.media = (l.media || []).filter(m => m.src !== rel);
      l.media.push({ label: '课文朗读（TTS ' + RATE + '×）', src: rel });
      l.media.sort((a, b) => String(a.label).localeCompare(String(b.label), 'zh'));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  fs.writeFileSync(LESSONS, JSON.stringify(lessons));   /* lessons.json 是 compact 单行排版，保持不变 */
  console.log('\n✓ lessons.json 已更新（media 字段），跑 node tools/make-package.js 重新打包即可带上音频');
}

main().catch(e => { console.error('✗ ' + e.message); process.exit(1); });
