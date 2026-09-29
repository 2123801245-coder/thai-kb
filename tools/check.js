#!/usr/bin/env node
/* tools/check.js —— 仓库自检：本地与 CI 跑的是同一条命令 `node tools/check.js`
   检查四组：① 骨架与 js 模块解析 ② data/ 解析与数据一致性 ③ 发音覆盖 ④ 发布包等价性
   约定：「硬失败」让退出码为 1（CI 以此判红绿）；「提示」只打印，不影响退出码，
   用于记录已知的、不阻塞交付的问题（例如重复词条、meta 里没有课文的键）。

   只用 Node 内置模块，不需要 npm install。
   注：媒体素材（media/）未入库，CI 上不存在，相关检查会自动跳过并说明。
*/
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { facts, mediaRefs, render, unmentionedTabs } = require('./lib/pkg-info');

const ROOT = path.resolve(__dirname, '..');
const HTML = '泰语个人知识库.html';
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const readJson = n => JSON.parse(read('data/' + n));
const jsonNames = () => fs.readdirSync(path.join(ROOT, 'data')).filter(f => f.endsWith('.json')).sort();
const sha = buf => crypto.createHash('sha1').update(buf).digest('hex');
const filesUnder = (dir, base = dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((acc, e) => {
  const full = path.join(dir, e.name);
  if (e.isDirectory()) return acc.concat(filesUnder(full, base));
  return acc.concat([path.relative(base, full)]);
}, []).sort();

const hard = [], soft = [];
let failed = 0;
function check(name, fn) {                       /* 硬检查：抛错即失败 */
  try { const note = fn(); hard.push(['✓', name, note || '']); }
  catch (e) { failed++; hard.push(['✗', name, e.message]); }
}
function hint(name, fn) {                        /* 提示：只记录 */
  try { const note = fn(); if (note) soft.push([note]); }
  catch (e) { soft.push([name + '：检查本身出错 — ' + e.message]); }
}
function must(cond, msg) { if (!cond) throw new Error(msg); }

/* ── ① 骨架与 js 模块 ─────────────────────────────── */
const html = read(HTML);
const jsFiles = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).sort();

check('骨架内无内联 <script>', () => {
  const inline = html.match(/<script\b(?![^>]*\bsrc=)[^>]*>/g) || [];
  must(inline.length === 0, '发现 ' + inline.length + ' 个内联 script');
  return '0 个内联';
});

check('骨架外链脚本都存在（' + jsFiles.length + ' 个模块）', () => {
  const refs = [...html.matchAll(/<script src="(js\/[^"]+)"/g)].map(m => m[1]);
  const missing = refs.filter(r => !fs.existsSync(path.join(ROOT, r)));
  must(missing.length === 0, '引用了不存在的文件：' + missing.join('、'));
  must(refs.length === jsFiles.length, '外链 ' + refs.length + ' 个，js/ 里却有 ' + jsFiles.length + ' 个文件');
  return refs.length + ' 个外链，无悬空引用';
});

check('js/ 全部模块语法可解析', () => {
  for (const f of jsFiles) new vm.Script(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), { filename: f });
  return jsFiles.length + ' 个模块解析通过';
});

/* ── ② data/ 解析与一致性 ─────────────────────────── */
const data = {};
check('data/*.json 全部可解析', () => {
  for (const n of jsonNames()) data[n] = readJson(n);
  return jsonNames().length + ' 个文件';
});

const words = data['words.json'], patterns = data['patterns.json'], lessons = data['lessons.json'];
const meta = data['lessons.meta.json'], vok = data['vok.json'], disc = data['disc.json'];
const voice = data['voice.json'], voiceLessons = data['voice-lessons.json'];

check('课程归类自洽（每篇课文的 course 都在 meta.courses 里）', () => {
  const bad = lessons.filter(l => !(meta.courses || []).includes(l.course)).map(l => l.label);
  must(bad.length === 0, 'course 不在课程表里：' + bad.join('、'));
  return lessons.length + ' 篇课文 / ' + meta.courses.length + ' 个课程';
});

check('每篇课文都有段落，且段落泰文正文非空', () => {
  const empty = lessons.filter(l => !(l.paras || []).length).map(l => l.label);
  must(empty.length === 0, '没有段落：' + empty.join('、'));
  const total = lessons.reduce((n, l) => n + l.paras.length, 0);
  const blank = lessons.reduce((n, l) => n + l.paras.filter(p => !String(p.t || '').trim()).length, 0);
  must(blank === 0, blank + ' 个段落泰文为空');
  return total + ' 个段落，泰文均非空';
});

check('课文标题都被 meta.lessonKeys 收录', () => {
  const missing = lessons.map(l => l.label).filter(k => !(meta.lessonKeys || []).includes(k));
  must(missing.length === 0, 'meta 里缺：' + missing.join('、'));
  return lessons.length + ' 篇均有归类';
});

check('data/ 引用的媒体文件都存在', () => {
  const m = mediaRefs(ROOT);
  if (!fs.existsSync(path.join(ROOT, 'media'))) return '跳过（本机/CI 无 media/ 目录）';
  must(m.missing.length === 0, '缺失：' + m.missing.join('、'));
  return m.list.length + ' 个引用文件齐全';
});

/* ── ③ 发音覆盖 ───────────────────────────────────── */
const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const voiceOf = k => (has(voiceLessons, k) ? 1 : (has(voice, k) ? 1 : 0));
/* pin=1 是「固定到知识库」写入的用户内容（server.py /api/pin）：
   没有内置发音，应用内自动降级到系统泰语 / 在线语音，所以发音硬检查跳过它们，
   只在下面的 hint 里报数；内置内容缺发音仍然是硬失败。 */
const isPinned = x => !!(x && x.pin);

check('词表每个词都有内置发音', () => {
  const miss = words.filter(w => !isPinned(w) && !voiceOf(norm(w.t))).map(w => w.t);
  must(miss.length === 0, miss.length + ' 个缺发音：' + miss.slice(0, 5).join('、'));
  const pinned = words.filter(isPinned).length;
  return words.length + ' 词全有' + (pinned ? '（含 ' + pinned + ' 条固定内容走 TTS）' : '');
});

check('词汇讲解的每个词条与例句都有内置发音', () => {
  let cards = 0, sents = 0;
  const miss = [];
  vok.forEach(c => {
    if (voiceOf('vok|' + norm(c.w))) cards++; else miss.push(c.w);
    (c.sents || []).forEach(s => { if (voiceOf('vok|' + norm(s.t))) sents++; else miss.push(String(s.t).slice(0, 20)); });
  });
  must(miss.length === 0, miss.length + ' 条缺发音：' + miss.slice(0, 5).join('、'));
  return cards + ' 词条 + ' + sents + ' 例句';
});

check('课文每个段落都有内置发音', () => {
  let hit = 0, total = 0, pinnedLessons = 0;
  const miss = [];
  lessons.forEach(l => {
    if (isPinned(l)) { pinnedLessons++; return; }   /* 用户固定进来的课文：发音走 TTS */
    (l.paras || []).forEach(p => {
      total++;
      if (voiceOf(norm(p.t))) hit++; else miss.push(String(p.t).slice(0, 20));
    });
  });
  must(miss.length === 0, miss.length + ' 段缺发音：' + miss.slice(0, 5).join('、'));
  return hit + '/' + total + ' 段' + (pinnedLessons ? '（另有 ' + pinnedLessons + ' 篇固定课文走 TTS）' : '');
});

/* ── ④ 发布包等价性（真跑一次打包脚本，打到临时目录）── */
const stats = facts(ROOT);
let out = null;
try {
  out = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-check-'));
  let buildLog = '';
  const run = spawnSync(process.execPath, [path.join(__dirname, 'make-package.js'), out], { encoding: 'utf8' });
  buildLog = (run.stdout || '') + (run.stderr || '');
  if (run.status !== 0) {
    throw new Error('打包脚本失败（退出码 ' + run.status + '）：'
      + buildLog.trim().split('\n')[0]);
  }
  const outFile = p => path.join(out, p);

  check('发布包：data/*.js 与源 data/*.json 逐字节等价', () => {
    const names = jsonNames();
    const packed = fs.readdirSync(path.join(out, 'data')).filter(f => f.endsWith('.js')).sort();
    must(packed.length === names.length, '包内 ' + packed.length + ' 个，源 ' + names.length + ' 个');
    for (const n of names) {
      const code = fs.readFileSync(outFile('data/' + n.replace(/\.json$/, '.js')), 'utf8');
      const m = code.match(/window\.KB_RAW\["([^"]+)"\]=([\s\S]*);\s*$/);
      must(m, n + ' 的注入格式不对');
      must(m[1] === n, n + ' 注入的键名是 ' + m[1]);
      must(JSON.parse(m[2]) === read('data/' + n), n + ' 注入内容与源文件不一致');
      must(code.includes('window.KB_PACK=1'), n + ' 缺 KB_PACK 标记');
    }
    return names.length + ' 个逐字节等价';
  });

  check('发布包：骨架里注入了全部同步数据脚本', () => {
    const packedHtml = fs.readFileSync(outFile(HTML), 'utf8');
    const deferred = ['voice-lessons.json'];
    const expect = jsonNames().filter(n => !deferred.includes(n));
    const missing = expect.filter(n => !packedHtml.includes('<script src="data/' + n.replace(/\.json$/, '.js') + '"></script>'));
    must(missing.length === 0, '缺注入：' + missing.join('、'));
    must(!packedHtml.includes('"data/voice-lessons.js"'), '按需加载的文件不该出现在 head 里');
    must(!packedHtml.includes('要用本地 HTTP 服务打开本页'), '离线版说明文字没被替换');
    return expect.length + ' 个同步注入 + 1 个按需加载';
  });

  check('发布包：js/ 与源逐字节一致', () => {
    const src = filesUnder(path.join(ROOT, 'js'));
    const dst = filesUnder(path.join(out, 'js'));
    must(src.length === dst.length, '包内 ' + dst.length + ' 个文件，源 ' + src.length + ' 个');
    const diff = src.filter(f => sha(fs.readFileSync(path.join(ROOT, 'js', f))) !== sha(fs.readFileSync(path.join(out, 'js', f))));
    must(diff.length === 0, '内容不同：' + diff.slice(0, 5).join('、'));
    return src.length + ' 个文件一致';
  });

  check('发布包：说明里的数字与 data/ 一致', () => {
    const txt = fs.readFileSync(outFile('使用说明.txt'), 'utf8');
    const want = [
      [stats.tabs + ' 个标签页', '标签页数'],
      ['词表 ' + stats.words + ' 词', '词数'],
      ['词汇讲解 ' + stats.vokCards + ' 词条', '词条数'],
      ['课文 ' + stats.lessons + ' 篇', '课文数'],
      [stats.videos + ' 个听力视频', '视频数'],
      ['泰语基础阅读 ' + stats.course['泰语基础阅读'] + ' 课', '基础阅读课数'],
      ['高级泰语精读 ' + stats.course['高级泰语精读'] + ' 课', '高泰课数'],
      ['视听说 ' + stats.course['泰语视听说'] + ' 课', '视听说课数']
    ];
    const bad = want.filter(([s]) => !txt.includes(s)).map(([, label]) => label);
    must(bad.length === 0, '与实数不符：' + bad.join('、'));
    return want.length + ' 处数字全部对得上';
  });

  check('发布包：模板里的 token 全部有对应值', () => {
    const names = fs.readdirSync(path.join(__dirname, 'templates'));
    for (const n of names) render(fs.readFileSync(path.join(__dirname, 'templates', n), 'utf8'), Object.assign({}, stats, { html: HTML, htmlEncoded: encodeURIComponent(HTML) }));
    const packTxt = fs.readFileSync(outFile('使用说明.txt'), 'utf8');
    const miss = unmentionedTabs(stats.tabLabels, packTxt);
    must(miss.length === 0, '说明里没提到：' + miss.join('、'));
    return names.length + ' 个模板渲染通过，说明覆盖全部标签页';
  });

  check('发布包：只拷 data/ 引用到的媒体', () => {
    const m = mediaRefs(ROOT);
    const packed = fs.existsSync(path.join(out, 'media')) ? filesUnder(path.join(out, 'media')) : [];
    if (!fs.existsSync(path.join(ROOT, 'media'))) return '跳过（本机/CI 无 media/，包内媒体 ' + packed.length + ' 个）';
    const expect = m.list.map(f => f.replace(/^media\//, '')).sort();
    const extra = packed.filter(f => !expect.includes(f));
    const absent = expect.filter(f => !packed.includes(f));
    must(extra.length === 0, '夹带了无引用素材：' + extra.join('、'));
    must(absent.length === 0, '少了引用素材：' + absent.join('、'));
    return packed.length + ' 个文件，与引用清单一致';
  });

  hint('打包脚本输出', () => buildLog.trim().split('\n').map(l => l.trim()).filter(Boolean).join(' ⏐ '));
} catch (e) {
  failed++;
  hard.push(['✗', '发布包等价性检查', e.message]);
} finally {
  if (out) fs.rmSync(out, { recursive: true, force: true });
}

/* ── 已知问题（提示，不影响退出码）────────────────── */
hint('meta 里没有对应课文的键', () => {
  const labels = new Set(lessons.map(l => l.label));
  const stray = (meta.lessonKeys || []).filter(k => !labels.has(k));
  return stray.length ? stray.join('、') + '（数据层遗留，非本次交付范围）' : '';
});

hint('固定到知识库的用户内容', () => {
  const w = words.filter(isPinned).length;
  const p = patterns.filter(isPinned).length;
  const l = lessons.filter(isPinned).length;
  if (!w && !p && !l) return '';
  return [w && w + ' 生词', p && p + ' 句型', l && l + ' 课文'].filter(Boolean).join('、')
    + '（无内置发音，朗读走系统/在线语音）';
});

hint('重复词条', () => {
  const seen = new Set(), dup = new Set();
  words.forEach(w => (seen.has(w.t) ? dup.add(w.t) : seen.add(w.t)));
  return dup.size ? dup.size + ' 个重复 t：' + [...dup].slice(0, 6).join('、') : '';
});

hint('缺中文对照的段落', () => {
  const n = lessons.reduce((s, l) => s + l.paras.filter(p => !String(p.z || '').trim()).length, 0);
  return n ? n + ' 段没有中文译文（界面上不会渲染空对照区）' : '';
});

hint('桌面发布包是否与仓库同步', () => {
  const desktop = path.join(os.homedir(), 'Desktop', '泰语知识库-发布版');
  if (!fs.existsSync(desktop)) return '本机没有桌面发布包，跳过';
  const stale = [];
  for (const n of jsonNames()) {
    const f = path.join(desktop, 'data', n.replace(/\.json$/, '.js'));
    if (!fs.existsSync(f)) { stale.push(n); continue; }
    const m = fs.readFileSync(f, 'utf8').match(/window\.KB_RAW\["([^"]+)"\]=([\s\S]*);\s*$/);
    if (!m || JSON.parse(m[2]) !== read('data/' + n)) stale.push(n);
  }
  const jsStale = filesUnder(path.join(ROOT, 'js')).filter(f =>
    !fs.existsSync(path.join(desktop, 'js', f)) ||
    sha(fs.readFileSync(path.join(ROOT, 'js', f))) !== sha(fs.readFileSync(path.join(desktop, 'js', f))));
  if (!stale.length && !jsStale.length) return '与仓库一致';
  return '★已过期：' + stale.length + ' 个数据文件、' + jsStale.length + ' 个 js 文件不同 —— 跑 node tools/make-package.js 重出';
});

/* ── 输出 ─────────────────────────────────────────── */
console.log('仓库自检（' + ROOT + '）');
console.log('事实：' + stats.tabs + ' 个标签页 · 词表 ' + stats.words + ' 词 · 词汇讲解 '
  + stats.vokCards + ' 词条/' + stats.vokSents + ' 例句 · 课文 ' + stats.lessons + ' 篇 · 听力视频 '
  + stats.videos + ' 个 · 发音 ' + (Object.keys(voice).length + Object.keys(voiceLessons).length) + ' 条');
console.log('');
for (const [mark, name, note] of hard) console.log('  ' + mark + ' ' + name + (note ? ' — ' + note : ''));
if (soft.length) {
  console.log('');
  console.log('提示（不影响退出码）：');
  for (const [note] of soft) console.log('  · ' + note);
}
console.log('');
if (failed) {
  console.log('✗ ' + failed + ' 项失败 / 共 ' + hard.length + ' 项硬检查');
  process.exit(1);
}
console.log('✓ 全部 ' + hard.length + ' 项硬检查通过' + (soft.length ? '（另有 ' + soft.length + ' 条提示）' : ''));
