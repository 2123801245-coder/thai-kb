#!/usr/bin/env node
/* tools/make-package.js —— 生成给同学的离线发布版（双击 HTML 即用，不需要装 Python / 起服务器）
   用法：node tools/make-package.js [输出目录]   默认 ~/Desktop/泰语知识库-发布版

   原理：data/*.json 额外生成一份 data/*.js（内容为 window.KB_RAW["x.json"]="<json 原文>"），
         并在骨架的 <script src="js/loader.js"> 之前插入这些脚本标签。
         js/loader.js 里 syncGet() 优先读 window.KB_RAW，因此 file:// 下也不再需要 XHR。
         47MB 的 voice-lessons.js 不插标签，由 loader 动态按需插入。
   注意：改了 data/ 或 js/ 之后要重新跑一次本脚本，发布版才会跟着更新。 */
const fs = require('fs'), path = require('path'), os = require('os');

const SRC = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(os.homedir(), 'Desktop', '泰语知识库-发布版'));
const HTML = '泰语个人知识库.html';

/* 其余 data/*.json 都按需加载，只有这几个在 head 里同步注入 */
const SYNC = ['words.json', 'patterns.json', 'lessons.json', 'quizzes.json',
  'voice.json', 'vok.json', 'disc.json', 'lessons.meta.json'];

const jsString = s => JSON.stringify(s).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const mb = n => (n / 1048576).toFixed(1) + 'MB';

/* 1) 输出目录重来一遍，避免残留旧文件 */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });

/* 2) 骨架 HTML：在 loader.js 之前插入数据脚本标签 */
const anchor = '<script src="js/loader.js"></script>';
const srcHtml = fs.readFileSync(path.join(SRC, HTML), 'utf8');
if (!srcHtml.includes(anchor)) throw new Error('骨架里找不到 ' + anchor);
const tags = SYNC.map(f => `<script src="data/${f.replace(/\.json$/, '.js')}"></script>`).join('\n');
/* 页面内「使用说明」写的是 HTTP 服务版的说法，发布版要改成双击即用的说法 */
const stale = '（详读 <code>data/README.txt</code>；注意要用本地 HTTP 服务打开本页）';
const fresh = '（离线版：data/ 里是同名 .js 数据文件，改完保存、刷新页面即生效）';
let html = srcHtml.replace(anchor, tags + '\n' + anchor);
if (html.includes(stale)) html = html.replace(stale, fresh);
else console.warn('警告：骨架里没找到使用说明原文，发布版里那段文字仍写着「需 HTTP 服务」');
fs.writeFileSync(path.join(OUT, HTML), html, 'utf8');

/* 3) data/：每个 json 生成一个 js 包装（含 voice-lessons，但不进 head） */
const jsons = fs.readdirSync(path.join(SRC, 'data')).filter(f => f.endsWith('.json'));
let dataBytes = 0;
for (const f of jsons) {
  const text = fs.readFileSync(path.join(SRC, 'data', f), 'utf8');
  const body = `window.KB_RAW=window.KB_RAW||{};window.KB_PACK=1;window.KB_RAW[${JSON.stringify(f)}]=${jsString(text)};`;
  const dest = path.join(OUT, 'data', f.replace(/\.json$/, '.js'));
  fs.writeFileSync(dest, body, 'utf8');
  dataBytes += fs.statSync(dest).size;
}

/* 4) 程序与素材原样拷贝 */
fs.cpSync(path.join(SRC, 'js'), path.join(OUT, 'js'), { recursive: true });
fs.copyFileSync(path.join(SRC, 'server.py'), path.join(OUT, 'server.py'));
fs.cpSync(path.join(SRC, 'media'), path.join(OUT, 'media'), { recursive: true });

/* 5) 启动器（万一双击 HTML 出问题时的备用方式，需要系统里有 Python 3） */
fs.writeFileSync(path.join(OUT, '备用启动（Mac）.command'),
`#!/bin/bash
cd "$(dirname "$0")"
lsof -tiTCP:8765 -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null
python3 server.py &
sleep 1.5
open "http://127.0.0.1:8765/${encodeURIComponent(HTML)}"
echo "知识库已启动；关掉这个终端窗口即关闭。"
`, 'utf8');
fs.chmodSync(path.join(OUT, '备用启动（Mac）.command'), 0o755);

fs.writeFileSync(path.join(OUT, '备用启动（Windows）.bat'),
`@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 ( start "" /b py -3 server.py ) else ( start "" /b python server.py )
timeout /t 3 >nul
start "" "http://127.0.0.1:8765/${encodeURIComponent(HTML)}"
`, 'utf8');

/* 6) 手机 / 平板：局域网方式（手机直接开文件会存不住笔记，用网址就没这个问题） */
fs.writeFileSync(path.join(OUT, '手机访问（Mac）.command'),
`#!/bin/bash
cd "$(dirname "$0")"
lsof -tiTCP:8765 -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null
echo "泰语个人知识库 · 手机 / 平板访问模式"
echo "下面会列出手机要输入的网址；请让手机连上跟这台电脑同一个 Wi-Fi。"
echo "这个窗口不要关，关掉服务就停了。"
echo
python3 server.py 8765 --lan
`, 'utf8');
fs.chmodSync(path.join(OUT, '手机访问（Mac）.command'), 0o755);

fs.writeFileSync(path.join(OUT, '手机访问（Windows）.bat'),
`@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 泰语个人知识库 · 手机 / 平板访问模式
echo 下面会列出手机要输入的网址；请让手机连上跟这台电脑同一个 Wi-Fi。
echo 首次运行 Windows 会问「是否允许防火墙」，请选「允许访问」。
echo 这个窗口不要关，关掉服务就停了。
echo.
where py >nul 2>nul
if %errorlevel%==0 ( py -3 server.py 8765 --lan ) else ( python server.py 8765 --lan )
pause
`, 'utf8');

fs.writeFileSync(path.join(OUT, '使用说明.txt'),
`泰语个人知识库（离线版）
========================================

【怎么打开 · 方式一：直接开文件（最简单）】
双击「${HTML}」就行。
  · Mac：双击即可（若弹出选择程序，选 Safari 或 Chrome）
  · Windows：双击，或右键 → 打开方式 → Chrome / Edge
  · 手机 / 平板：把整个文件夹拷进设备，用浏览器打开同一个 HTML 文件即可
    （Android 可以这么用；iPhone / iPad 请另见「手机使用指南.txt」）。
    界面已适配窄屏与触屏：顶栏下滑后自动收起只留标签条（标签条可左右滑动）、
    词表在手机上按「泰语词 / 中文释义 / 词性·读音·来源」三行显示、
    按钮和输入框按触屏尺寸放大、笔记图片用 ◀ ▶ 调顺序。
    ⚠️ 手机上直接开文件时，部分浏览器（尤其 iPhone）不让网页保存数据，
       笔记、图片、掌握度标记可能存不住。想在手机上正经用，见方式二。

【怎么打开 · 方式二：手机 / 平板访问（推荐，需要电脑在旁边）】
  1. 让手机和电脑连上同一个 Wi-Fi；
  2. 电脑上双击「手机访问（Mac）.command」或「手机访问（Windows）.bat」；
  3. 窗口里会列出手机要输入的网址（形如 http://192.168.1.5:8765），
     在手机浏览器地址栏里输进去，会看到一个「📖 打开知识库」的按钮，点它即可；
     （iOS 可以用「分享 → 添加到主屏幕」变成桌面图标，下次一点就进。）
  · 这样打开的是一个真正的网址，笔记、图片、掌握度都能正常存在手机上；
  · 电脑那个窗口别关，关掉服务就停了；同一个 Wi-Fi 里的其他设备也能打开，
    所以公共 Wi-Fi（咖啡厅 / 机场）下不要开这个模式。

【里面有什么】
10 个标签页：词表 293 词 / 词汇练习（百词斩式六种练法）/ 句型 / 辨析 /
词汇讲解 / 错题回顾 / 课文阅读 / 笔记 / 添加 / 导入
课文 15 篇（泰语基础阅读 1–11 课、高级泰语精读 2 课、视听说 1 课），
每篇带中文对照；点 🔊 有全部朗读（词表、例句、课文段落都是同一套女声）。
视听说里有 5 个听力视频，点开即可播放、进度条可拖动；
中秋节那篇还有「逐句跟读」（点句子 = 循环播那一句，可 0.75× 慢速）。

【记录存在哪】
生词、笔记、错题、学习进度都保存在你自己浏览器的本地存储里，与别人互不影响。
换浏览器或清理浏览器数据会丢，重要内容请用「导入/导出」备份。
用方式二（网址）打开时，数据和电脑上的互不相通，各存各的。

【如果双击打不开】
用备用的服务器方式：双击「备用启动（Mac）.command」或「备用启动（Windows）.bat」
（Windows 上如提示找不到 Python，去 python.org 装一个 Python 3 再双击即可。）

【请勿外传】
课文与音频来自教材，仅限班内学习使用。请不要上传到公开网络、公开网盘链接
或任何公开平台，也不要再转发给班外的人。
`, 'utf8');

/* 6) 手机 / 平板使用指南（单独一份，方便直接转给同学） */
fs.writeFileSync(path.join(OUT, '手机使用指南.txt'),
`泰语个人知识库 · 手机 / 平板使用指南
========================================

结论先说：手机上不用电脑也能用，但 Android 和 iPhone / iPad 难度差很多。

────────────────────────────────
一、Android —— 最省事，完全不用电脑
────────────────────────────────
1. 把「泰语知识库-离线版.zip」发到手机（微信 / QQ / 网盘都行）；
2. 在手机上解压；
3. 打开文件管理器，进到解压出来的文件夹，点「${HTML}」，
   选「用浏览器 / Chrome 打开」。
   ✅ 用浏览器打开本地文件时存储是正常的：掌握度标记、笔记、错题本、
      阅读位置都存得住（我在 Chrome 里实测过 localStorage 与 IndexedDB 都可用）。
   · 如果点开只看到一堆代码，说明是当成文本打开了：长按文件 →
     打开方式 → 选浏览器。
   · 如果打开后页面底部出现「存不住数据」的横幅，说明你这台机器
     不允许，请改用办法三。

────────────────────────────────
二、iPhone / iPad —— 手机上要有个「本地服务器」App
────────────────────────────────
iOS 的 Safari 不能直接打开本地文件，从「文件」App 点开 HTML 只是受限预览，
网页存不了数据（笔记、掌握度都会丢）。所以要在手机上装一个能起本地服务的 App：

1. App Store 搜「a-Shell」或「iSH」（都免费），装一个；
2. 用这个 App 的「选取文件夹 / pickFolder」把「文件」App 里解压好的
   文件夹挂进来；
3. 在 App 里 cd 进这个文件夹，起一个静态服务，例如：
       python3 -m http.server 8765
4. 打开 Safari，地址栏输 http://localhost:8765 —— 会看到
   「📖 打开知识库」按钮，点它即可。这样是正常网址，数据能存住，
   还能「分享 → 添加到主屏幕」变成桌面图标。

⚠️ 老实说：第 2、3 步的细节会因 App 而异，我在这台电脑上没法验证 iPhone
   上的实际操作，请以 App 自己的说明为准。卡住就用办法三，最稳。

────────────────────────────────
三、iOS 兜底：手动备份（不需要装任何 App）
────────────────────────────────
接受"存不住"，用备份文件记进度：
  · 学完在页面底部点「💾 导出备份」→ 存成一个 .json 文件；
  · 下次打开在「➕ 添加」页点「📥 导入备份」→ 选那个文件，进度就回来了。
页面一旦发现存不住数据，会自动在底部挂一条横幅提醒，横幅上就有这两个按钮。

────────────────────────────────
四、班里同学混着用怎么办
────────────────────────────────
· Android 同学：把 zip 发过去，让他按办法一自己打开，不用你管；
· iPhone 同学：
  - 让他装个本地服务器 App 走办法二；或
  - 用任何一台 Android 手机 / 电脑开一次服务，iPhone 用浏览器输网址进
    （见 使用说明.txt「方式二：手机 / 平板访问」）；或
  - 走办法三，用备份文件记进度。

────────────────────────────────
五、为什么不放到网上
────────────────────────────────
传到 GitHub Pages / 网盘直链确实最省事，手机点开就能用，但那样教材和音频
就离开你的电脑、进了别人的服务器了。使用说明里写明「请勿外传」，
所以不提供这条路 —— 请不要把本文件夹传到任何公开平台。
`, 'utf8');

/* 6) 汇总 */
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) =>
  n + (e.isDirectory() ? walk(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0);
console.log('发布目录：' + OUT);
console.log('  骨架 ' + mb(fs.statSync(path.join(OUT, HTML)).size)
  + ' · data/*.js ' + mb(dataBytes)
  + ' · media ' + mb(walk(path.join(OUT, 'media')))
  + ' · 合计 ' + mb(walk(OUT)));
console.log('  注入的同步数据标签：' + SYNC.length + ' 个；voice-lessons.js 由 loader 按需插入');
