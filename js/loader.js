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
['words.json','patterns.json','lessons.json','quizzes.json','voice.json','vok.json','disc.json'].forEach(function(name){
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
/* 异步预取扩展发音（课文段落/vok例句等，~13MB），加载完合并进 VOICE */
window.KB_VOICE_EXT = null;
window.__loadVoiceExt = function(){
  if(window.KB_VOICE_EXT || window.__voiceExtLoading) return;
  if (window.KB_PACK) { /* 发布版：data/voice-lessons.js 约 47MB，动态插脚本按需加载 */
    window.__voiceExtLoading = true;
    var s = document.createElement('script');
    s.src = 'data/voice-lessons.js';
    s.onload = function(){ window.__applyVoiceExt(); };
    document.head.appendChild(s);
    return;
  }
  var x = new XMLHttpRequest();
  x.open('GET', 'data/voice-lessons.json?t=' + Date.now(), true);
  x.onload = function(){ window.__applyVoiceExt(x.responseText); };
  x.send();
};
window.__applyVoiceExt = function(text){
  try {
    var raw = text || (window.KB_RAW && window.KB_RAW['voice-lessons.json']) || '';
    window.KB_VOICE_EXT = JSON.parse(raw);
    if(typeof VOICE === 'object' && VOICE) Object.assign(VOICE, window.KB_VOICE_EXT);
  } catch(e){}
};
setTimeout(window.__loadVoiceExt, 0);
