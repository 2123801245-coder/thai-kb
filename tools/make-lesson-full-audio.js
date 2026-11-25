#!/usr/bin/env node
/* tools/make-lesson-full-audio.js —— 生成「整篇连读」音频（通勤模式）
   用法：node tools/make-lesson-full-audio.js [--force] [--gap 0.6]

   读 data/lessons.json 的段落顺序与 data/voice-lessons.json 的段落发音（base64），
   按课文拼成一条 mp3，写到 media/full/<标题哈希>.mp3，并把相对路径回填进
   lessons[i].full（read.js 用它渲染「🎧 整篇连读」播放器）。

   要点：
     · 段落顺序即课文顺序，段间插 --gap 秒静音（默认 0.6），不额外加开头静音；
     · 编码参数对齐库里现有段落音频：24 kHz / 32 kbps / 单声道；
     · 缺发音的段落跳过并列出（目前只有「高泰1·第三课 汉译泰参考」的 5 段无音）；
     · 输出文件名用标题哈希而不是序号，课文增删或调序不会让旧文件张冠李戴；
     · 默认增量：lessons.json / voice-lessons.json 都没更新时跳过已存在的文件，
       --force 强制重烤。
*/
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const LESSONS = path.join(ROOT, 'data', 'lessons.json');
const VOICE = path.join(ROOT, 'data', 'voice-lessons.json');
const OUTDIR = path.join(ROOT, 'media', 'full');
const FORCE = process.argv.includes('--force');
const gi = process.argv.indexOf('--gap');
const GAP = gi > 0 ? parseFloat(process.argv[gi + 1]) : 0.6;

const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
const say = m => console.log('  ' + m);
const mb = n => (n / 1048576).toFixed(1);
const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const lessons = JSON.parse(fs.readFileSync(LESSONS, 'utf8'));
const voice = JSON.parse(fs.readFileSync(VOICE, 'utf8'));
if (!Array.isArray(lessons)) throw new Error('lessons.json 不是数组');

const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
const ffprobe = (file) => {
  try {
    const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], { encoding: 'utf8' });
    return parseFloat(out.trim()) || 0;
  } catch (e) { return 0; }
};

if (!fs.existsSync(OUTDIR)) fs.mkdirSync(OUTDIR, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-full-'));
const silence = path.join(tmp, 'gap.mp3');
ff(['-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', String(GAP), '-c:a', 'libmp3lame', '-b:a', '32k', '-ar', '24000', '-ac', '1', silence]);

/* 增量依据：不改用文件时间戳——本脚本自己会回写 lessons.json，会把 mtime 抬高，
   导致每次都全量重烤。改用内容签名：段落文本序列 + 段间静音长度，记在 manifest 里。 */
const MANIFEST = path.join(OUTDIR, '.manifest.json');
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
const nextManifest = {};
let built = 0, skipped = 0, totalBytes = 0, totalDur = 0;
const missing = [];
const stale = new Set(fs.existsSync(OUTDIR) ? fs.readdirSync(OUTDIR).filter(f => f.endsWith('.mp3')) : []);

say('整篇连读：' + lessons.length + ' 篇课文，段间静音 ' + GAP + 's，24kHz/32kbps 单声道');

lessons.forEach((ls, li) => {
  const name = (ls.titleZh || ls.title || ls.label || ('第' + (li + 1) + '课'));
  const slug = crypto.createHash('sha1').update(String(ls.title || ls.label || name)).digest('hex').slice(0, 8);
  const rel = 'media/full/' + slug + '.mp3';
  const out = path.join(ROOT, rel);

  const parts = [];
  (ls.paras || []).forEach((p, pi) => {
    const key = norm(p.t);
    if (!key) return;
    const b = voice[key];
    if (!b) { missing.push(name + ' 第' + (pi + 1) + '段'); return; }
    parts.push(b);
  });

  if (!parts.length) {
    say('· ' + name + '：没有段落发音，跳过');
    return;
  }

  const sig = crypto.createHash('sha1').update(GAP + '\n' + parts.map(k => norm(k)).join('\n')).digest('hex');
  nextManifest[slug] = sig;
  if (!FORCE && fs.existsSync(out) && manifest[slug] === sig) {
    skipped++;
    totalBytes += fs.statSync(out).size;
    const d0 = ffprobe(out);
    totalDur += d0;
    stale.delete(slug + '.mp3');
    ls.full = rel;
    ls.fullSec = Math.round(d0);
    return;
  }

  const list = [];
  parts.forEach((b64, i) => {
    const f = path.join(tmp, slug + '-' + i + '.mp3');
    fs.writeFileSync(f, Buffer.from(b64, 'base64'));
    list.push(f);
  });
  const txt = path.join(tmp, slug + '.txt');
  fs.writeFileSync(txt, list.map((f, i) => "file '" + f + "'\n" + (i < list.length - 1 ? "file '" + silence + "'\n" : '')).join(''));

  ff(['-f', 'concat', '-safe', '0', '-i', txt, '-c:a', 'libmp3lame', '-b:a', '32k', '-ar', '24000', '-ac', '1', out]);
  built++;
  const size = fs.statSync(out).size;
  const dur = ffprobe(out);
  totalBytes += size;
  totalDur += dur;
  stale.delete(slug + '.mp3');
  ls.full = rel;
  ls.fullSec = Math.round(dur);
  say('✓ ' + name + '：' + parts.length + ' 段 · ' + Math.round(dur / 60) + ' 分 ' + Math.round(dur % 60) + ' 秒 · ' + mb(size) + 'MB');
});

/* 旧课文留下的孤立文件（标题改过就换了 slug）——删掉，别让补丁包越滚越大 */
[...stale].forEach(f => { try { fs.unlinkSync(path.join(OUTDIR, f)); say('－ 删除孤立文件 ' + f); } catch (e) {} });

fs.writeFileSync(LESSONS, JSON.stringify(lessons, null, 2) + '\n', 'utf8');
fs.rmSync(tmp, { recursive: true, force: true });

console.log('\n整篇连读完成：新建 ' + built + ' 篇、复用 ' + skipped + ' 篇 · 共 ' + mb(totalBytes) + 'MB · 总时长约 ' + Math.round(totalDur / 60) + ' 分钟');
fs.writeFileSync(MANIFEST, JSON.stringify(nextManifest, null, 2) + '\n', 'utf8');
console.log('  回填字段：lessons[].full → ' + 'media/full/<hash>.mp3');
if (missing.length) {
  console.log('  缺发音段落 ' + missing.length + ' 段（已跳过）：' + missing.slice(0, 8).join('、') + (missing.length > 8 ? ' …' : ''));
}
