/* loader.js —— 数据载入：syncGet / KB_META / KB_RAW 预取（head 内同步读入）
   本文件由 泰语个人知识库.html 的内联脚本按行拆分而来，行为与原内联脚本一致；
   加载顺序见 HTML 底部的 <script src> 序列（顺序即原执行顺序）。 */
/* 数据载入：data/ 目录的 json 在页面渲染前同步读入（同步 XHR 保证脚本执行顺序不变）。
   直接双击 HTML 会因浏览器安全限制读不到数据 —— 请用本地 HTTP 服务打开本页（见 data/README.txt）。 */
function syncGet(name) {
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
window.KB_RAW = {};
['words.json','patterns.json','lessons.json','quizzes.json','voice.json','vok.json','disc.json'].forEach(function(name){
  window.KB_RAW[name] = syncGet(name);
});
