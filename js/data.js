/* data.js —— 把 KB_RAW 解析成全局数据状态（词/句型/课文/小测/发音/讲解/辨析）
   本文件由 泰语个人知识库.html 的内联脚本按行拆分而来，行为与原内联脚本一致；
   加载顺序见 HTML 底部的 <script src> 序列（顺序即原执行顺序）。 */
/* =====================================================================
   📦 数据加载区 —— 内容全部在 data/ 目录里维护（详见 data/README.txt）
   words.json 生词 · patterns.json 句型 · lessons.json 课文 · quizzes.json 课文小测
   voice.json 内置发音 · vok.json 词汇讲解 · disc.json 辨析卡片 · lessons.meta.json 归类与图标
   改完保存、刷新页面即生效（需通过本地 HTTP 服务打开本页）。
   ===================================================================== */
let vokCourse = null; /* 词汇讲解两级导航：null=大类选择页，否则为所选分组 */
let BUILTIN_WORDS = [], BUILTIN_PATTERNS = [], SECTIONS = [], LESSON_QUIZ = {}, VOICE = {}, NOTES_DEFAULT = '';
let VOK = [], DISC = [];
try {
  BUILTIN_WORDS = JSON.parse(window.KB_RAW['words.json'] || '[]');
  BUILTIN_PATTERNS = JSON.parse(window.KB_RAW['patterns.json'] || '[]');
  SECTIONS = JSON.parse(window.KB_RAW['lessons.json'] || '[]');
  LESSON_QUIZ = JSON.parse(window.KB_RAW['quizzes.json'] || '{}');
  VOICE = JSON.parse(window.KB_RAW['voice.json'] || '{}');
  /* 异步合并扩展发音（课文段落/vok例句等） */
  (function mergeExt(){
    if(window.KB_VOICE_EXT && Object.keys(window.KB_VOICE_EXT).length){
      Object.assign(VOICE, window.KB_VOICE_EXT);
    } else {
      setTimeout(mergeExt, 500);
    }
  })();
  VOK = JSON.parse(window.KB_RAW['vok.json'] || '[]');
  DISC = JSON.parse(window.KB_RAW['disc.json'] || '[]');
} catch (e) { console.error('数据解析失败', e); }
