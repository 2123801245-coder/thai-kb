#!/usr/bin/env node
/* tools/make-package.js —— 生成给同学的离线发布版（双击 HTML 即用，不需要装 Python / 起服务器）
   用法：node tools/make-package.js [输出目录]   默认 ~/Desktop/泰语知识库-发布版

   为什么 data/*.json 要额外生成一份 data/*.js：
     浏览器禁止 file:// 页面发 XHR，而 head 里的 <script src> 不受此限。
     于是每个 json 生成 window.KB_RAW["x.json"]="<json 原文>" 的包装脚本，
     在 js/loader.js 之前用 script 标签注入，loader 的 syncGet() 优先读它。
     体积最大的 voice-lessons.js 不进 head，由 loader 按需动态插入。

   本文件只做编排；改行为前先看 tools/README.txt：
     tools/lib/pkg-info.js  发布包的「事实」：从 data/ 与骨架推导的计数、媒体引用清单
     tools/templates/       说明文本与启动器（正文照旧，数字写成 {{token}}，由这里渲染）
*/
const fs = require('fs');
const path = require('path');
const os = require('os');
const { facts, mediaRefs, render, unmentionedTabs } = require('./lib/pkg-info');

const SRC = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(os.homedir(), 'Desktop', '泰语知识库-发布版'));
const TEMPLATES = path.join(__dirname, 'templates');
const HTML = '泰语个人知识库.html';

/* 不在 head 里同步注入的 json（太大，交给 loader 按需插标签）；其余 json 一律同步注入 */
const DEFERRED = ['voice-lessons.json'];

/* 骨架里那句「要用 HTTP 服务打开」的说法，在离线包里要换成双击即用的说法 */
const HINT_HTTP = '（详读 <code>data/README.txt</code>；注意要用本地 HTTP 服务打开本页）';
const HINT_OFFLINE = '（离线版：data/ 里是同名 .js 数据文件，改完保存、刷新页面即生效）';

/* 生成到发布版的模板里，哪些需要可执行位 */
const EXECUTABLE = ['备用启动（Mac）.command', '手机访问（Mac）.command'];

const jsString = s => JSON.stringify(s).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const mb = n => (n / 1048576).toFixed(1) + 'MB';
const jsonFiles = () => fs.readdirSync(path.join(SRC, 'data')).filter(f => f.endsWith('.json')).sort();
const fileSize = p => fs.statSync(p).size;
const dirSize = dir => fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) =>
  n + (e.isDirectory() ? dirSize(path.join(dir, e.name)) : fileSize(path.join(dir, e.name))), 0);

/* 1) 输出目录重来一遍，避免残留旧文件。
   data-personal/（📌固定的学习进度，个人数据、不入库不进包）先搬出来，重出后放回去 ——
   重出发布目录不能把用户已经固定过的掌握度/笔记删掉。 */
const personalDir = path.join(OUT, 'data-personal');
let personalBak = null;
if (fs.existsSync(personalDir)) {
  personalBak = path.join(os.tmpdir(), 'kb-personal-' + Date.now());
  fs.cpSync(personalDir, personalBak, { recursive: true });
}
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });
if (personalBak) {
  fs.cpSync(personalBak, personalDir, { recursive: true });
  fs.rmSync(personalBak, { recursive: true, force: true });
}

/* 2) 事实与模板变量：数字全部现推，不写死 */
const stats = facts(SRC);
const media = mediaRefs(SRC);
const vars = Object.assign({}, stats, { html: HTML, htmlEncoded: encodeURIComponent(HTML) });

/* 3) 骨架：注入数据脚本标签 + 把 HTTP 说法换成离线说法 */
const anchor = '<script src="js/loader.js"></script>';
const srcHtml = fs.readFileSync(path.join(SRC, HTML), 'utf8');
if (!srcHtml.includes(anchor)) throw new Error('骨架里找不到 ' + anchor);
const syncJsons = jsonFiles().filter(f => !DEFERRED.includes(f));
const tags = syncJsons.map(f => `<script src="data/${f.replace(/\.json$/, '.js')}"></script>`).join('\n');
let html = srcHtml.replace(anchor, tags + '\n' + anchor);
if (html.includes(HINT_HTTP)) html = html.replace(HINT_HTTP, HINT_OFFLINE);
else console.warn('警告：骨架里没找到使用说明原文，发布版里那段文字仍写着「需 HTTP 服务」');
fs.writeFileSync(path.join(OUT, HTML), html, 'utf8');

/* 4) data/*.js：每个 json 一个注入包装（含 voice-lessons，但不进 head） */
let dataBytes = 0;
for (const f of jsonFiles()) {
  const text = fs.readFileSync(path.join(SRC, 'data', f), 'utf8');
  const body = `window.KB_RAW=window.KB_RAW||{};window.KB_PACK=1;window.KB_RAW[${JSON.stringify(f)}]=${jsString(text)};`;
  const dest = path.join(OUT, 'data', f.replace(/\.json$/, '.js'));
  fs.writeFileSync(dest, body, 'utf8');
  dataBytes += fileSize(dest);
}
/* app.json 额外保留裸 json：APK/PWA 的应用内更新检查要 fetch 它对比版本号 */
fs.copyFileSync(path.join(SRC, 'data', 'app.json'), path.join(OUT, 'data', 'app.json'));

/* 5) 程序原样拷贝 */
fs.cpSync(path.join(SRC, 'js'), path.join(OUT, 'js'), { recursive: true });
fs.copyFileSync(path.join(SRC, 'server.py'), path.join(OUT, 'server.py'));
if (fs.existsSync(path.join(SRC, 'css'))) fs.cpSync(path.join(SRC, 'css'), path.join(OUT, 'css'), { recursive: true });
if (fs.existsSync(path.join(SRC, 'fonts'))) fs.cpSync(path.join(SRC, 'fonts'), path.join(OUT, 'fonts'), { recursive: true });

/* 5.5 PWA 资源：manifest、Service Worker、图标 —— 手机「添加到主屏幕」与以后套壳 APK 用。
   发布版里双击 HTML 的 file:// 不会注册 SW（js/pwa.js 有协议守卫），但用 server.py
   或放到 https 上时就自动变成可安装的 PWA。 */
for (const f of ['manifest.webmanifest', 'sw.js', 'index.html']) fs.copyFileSync(path.join(SRC, f), path.join(OUT, f));
fs.cpSync(path.join(SRC, 'icons'), path.join(OUT, 'icons'), { recursive: true });
/* 课外书库：books/ 泰文原版 PDF（如《四朝代》），随包发布供「课外阅读」页打开 */
if (fs.existsSync(path.join(SRC, 'books'))) fs.cpSync(path.join(SRC, 'books'), path.join(OUT, 'books'), { recursive: true });
/* TWA 全屏校验文件：PWABuilder 出 APK 后会把 assetlinks.json 放进来，有就带上 */
const alDir = path.join(SRC, '.well-known');
if (fs.existsSync(alDir)) fs.cpSync(alDir, path.join(OUT, '.well-known'), { recursive: true });

/* 6) 媒体：只拷 data/ 真正引用到的文件（发布包里不再夹带没人用的素材） */
let mediaBytes = 0;
for (const rel of media.list) {
  const from = path.join(SRC, rel);
  if (!fs.existsSync(from)) continue;              /* 缺失的已在 facts 阶段列为 warning */
  const to = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  mediaBytes += fileSize(to);
}

/* 7) 说明文本与启动器：模板渲染（数字来自第 2 步） */
let templateWarning = '';
for (const name of fs.readdirSync(TEMPLATES)) {
  const body = render(fs.readFileSync(path.join(TEMPLATES, name), 'utf8'), vars);
  const dest = path.join(OUT, name);
  fs.writeFileSync(dest, body, 'utf8');
  if (EXECUTABLE.includes(name)) fs.chmodSync(dest, 0o755);
  /* 发货前自查：说明文本有没有漏掉骨架里新增的标签页 */
  if (name === '使用说明.txt') {
    const missing = unmentionedTabs(stats.tabLabels, body);
    if (missing.length) templateWarning = '使用说明里没提到这些标签页：' + missing.join('、')
      + '（骨架里共 ' + stats.tabs + ' 个）';
  }
}

/* 8) 汇总 */
console.log('发布目录：' + OUT);
console.log('  事实：' + stats.tabs + ' 个标签页 · 词表 ' + stats.words + ' 词 · 词汇讲解 '
  + stats.vokCards + ' 词条/' + stats.vokSents + ' 例句 · 课文 ' + stats.lessons + ' 篇（'
  + Object.entries(stats.course).map(([c, n]) => c + ' ' + n).join('、') + '）· 听力视频 '
  + stats.videos + ' 个 · 音频 ' + stats.audios + ' 个');
console.log('  骨架 ' + mb(fileSize(path.join(OUT, HTML))) + ' · data/*.js ' + mb(dataBytes)
  + ' · media ' + mb(mediaBytes) + '（' + media.list.length + ' 个引用到的文件）'
  + ' · 合计 ' + mb(dirSize(OUT)));
console.log('  同步注入 ' + syncJsons.length + ' 个数据标签；按需加载：' + (DEFERRED.join('、') || '无'));
if (media.missing.length) console.warn('警告：data/ 引用了但磁盘上不存在：' + media.missing.join('、'));
if (templateWarning) console.warn('警告：' + templateWarning);
