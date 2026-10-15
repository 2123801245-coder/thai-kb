/* loader.js —— 数据载入：syncGet / KB_META / KB_RAW 预取（head 内同步读入）
   本文件由 泰语个人知识库.html 的内联脚本按行拆分而来，行为与原内联脚本一致；
   加载顺序见 HTML 底部的 <script src> 序列（顺序即原执行顺序）。 */
/* 数据载入：data/ 目录的 json 在页面渲染前同步读入（同步 XHR 保证脚本执行顺序不变）。
   两种打开方式：
   ① 双击 HTML（发布版）—— head 里的 <script src="data/*.js"> 已把数据注入 window.KB_RAW，
      此处直接取用，绕开 file:// 下被浏览器拦截的 XHR；
   ② 本地 HTTP 服务（python3 server.py，见 data/README.txt）—— 走下面的同步 XHR。 */
function syncGet(name) {
  if (window.KB_RAW && typeof window.KB_RAW[name] === 'string') return window.KB_RAW[name];
  try {
    const x = new XMLHttpRequest();
    x.open('GET', 'data/' + name + '?t=' + Date.now(), false); /* 加时间戳防 HTTP 缓存读到旧数据（本地 server 无 Cache-Control） */
    x.send(null);
    if (x.status !== 200 && x.status !== 0) throw new Error('HTTP ' + x.status);
    return x.responseText;
  } catch (e) {
    document.addEventListener('DOMContentLoaded', () => alert('知识库数据加载失败：' + name + '\n请通过本地 HTTP 服务打开本页（见 data/README.txt），不要直接双击 HTML 文件。'));
    return null;
  }
}
const KB_META = { /* 课文→课程归类与图标；增删课文后请同步更新 data/lessons.meta.json */
  lessonKeys: [], courses: [], courseOf: {}, courseIcon: {}, lessonIcons: {}
};
try {
  const meta = JSON.parse(syncGet('lessons.meta.json'));
  if (meta) Object.assign(KB_META, meta);
} catch (e) {}
/* 预取其余数据文件；真正赋值在正文第一个 <script> 数据区完成 */
window.KB_RAW = window.KB_RAW || {}; /* 发布版已由 data/*.js 预置，勿覆盖 */
['words.json','patterns.json','lessons.json','quizzes.json','vok.json','disc.json'].forEach(function(name){
  window.KB_RAW[name] = syncGet(name);
});
/* 学习进度基线 data-personal/progress.json：「📌 固定到知识库」写入的掌握度/错题/笔记快照。
   个人数据，不入 git、不进发布包，所以这里用安静读取 —— 文件不存在、
   或 file:// 下被拦，都只是“没有基线”，绝不能走到 syncGet 的报错弹窗。 */
window.KB_PROGRESS = null;
(function () {
  try {
    var x = new XMLHttpRequest();
    x.open('GET', 'data-personal/progress.json?t=' + Date.now(), false);
    x.send(null);
    if (x.status === 200) window.KB_PROGRESS = JSON.parse(x.responseText);
  } catch (e) {}
})();
/* ── 发音数据按需加载 ──────────────────────────────────────────────
   两份发音都不进 head：voice.json 约 9MB（词表读音）、voice-lessons.js 约 56MB
   （课文段落与例句读音）。放进 head 会让首屏白等十几秒 —— 手机上尤其明显。
   现在的顺序是：先把页面渲染出来 → 空闲时后台预取词表发音 → 段落发音等用户
   真要用（首次交互后、或点 🔊）再拉。点 🔊 时若还没就绪，现拉一次再补播。 */
window.KB_VOICE_READY = false;   /* 词表发音（voice.json）是否已合并进 VOICE */
window.KB_VOICE_EXT = null;      /* 段落 / 例句发音（voice-lessons.json） */
function __mergeVoice(obj) {
  try { if (obj && typeof VOICE === 'object' && VOICE) Object.assign(VOICE, obj); } catch (e) {}
}
/* 发布版插脚本 / 开发态（本地 HTTP 服务）用 XHR 拉 json，两种打开方式各走各的 */
function __pull(name, onDone) {
  if (window.KB_PACK) {
    var s = document.createElement('script');
    s.src = 'data/' + name + '.js';
    s.onload = onDone; s.onerror = onDone;
    document.head.appendChild(s);
    return;
  }
  var x = new XMLHttpRequest();
  x.open('GET', 'data/' + name + '.json?t=' + Date.now(), true);
  x.onload = function () { onDone(x.responseText); };
  x.onerror = function () { onDone(); };
  x.send();
}
/* ① 词表发音：没就绪就现拉，好了再把这次点击补上（core.js 的 speakThai 调用） */
window.__loadVoice = function (cb) {
  if (window.KB_VOICE_READY) { if (cb) cb(); return; }
  if (cb) (window.__voiceCbs = window.__voiceCbs || []).push(cb);
  if (window.__voiceLoading) return;
  window.__voiceLoading = true;
  __pull('voice', function (text) {
    var raw = text || (window.KB_RAW && window.KB_RAW['voice.json']) || '';
    try { __mergeVoice(JSON.parse(raw)); } catch (e) {}
    window.KB_VOICE_READY = true;
    var cbs = window.__voiceCbs || []; window.__voiceCbs = [];
    cbs.forEach(function (f) { try { f(); } catch (e) {} });
  });
};
/* ② 段落 / 例句发音：体量大，等用户真进课文、词汇讲解或点 🔊 再拉 */
window.__loadVoiceExt = function () {
  if (window.KB_VOICE_EXT || window.__voiceExtLoading) return;
  window.__voiceExtLoading = true;
  __pull('voice-lessons', function (text) {
    var raw = text || (window.KB_RAW && window.KB_RAW['voice-lessons.json']) || '';
    try { window.KB_VOICE_EXT = JSON.parse(raw); __mergeVoice(window.KB_VOICE_EXT); } catch (e) {}
  });
};
/* 空闲预取：排版与首屏资源优先；「省流量 / 2G」下不主动预取，只等按需 */
(function () {
  var conn = navigator.connection || navigator.mozConnection || {};
  var stingy = conn.saveData === true || /(^|-)2g$/.test(conn.effectiveType || '');
  var idle = function (fn, delay) {
    setTimeout(function () {
      if (window.requestIdleCallback) requestIdleCallback(fn, { timeout: 3000 });
      else fn();
    }, delay);
  };
  idle(window.__loadVoice, 1200);
  if (stingy) return;
  var fired = false;
  var go = function () { if (fired) return; fired = true; window.__loadVoiceExt(); };
  ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) {
    window.addEventListener(ev, go, { once: true, passive: true });
  });
  setTimeout(go, 20000);
})();
