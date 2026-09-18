js/ —— 页面脚本目录（泰语个人知识库.html 只保留骨架与样式，界面逻辑都在这里）

加载顺序就是下面的排列顺序，也是重构前内联脚本的执行顺序，不要随意调换：
HTML 的 <head> 里先加载 loader.js，</main> 之后按 data.js → core.js → … → app.js 依次加载。
classic script 之间共享顶层作用域，函数声明彼此可见，但「顶层立即执行的语句」
（读 localStorage、addEventListener、启动渲染）仍按此顺序发生，改顺序会改变行为。

  loader.js          数据载入：syncGet（同步 XHR + 防缓存时间戳）、KB_META、预取 KB_RAW
  data.js            把 KB_RAW 解析成全局数据状态：BUILTIN_WORDS / BUILTIN_PATTERNS /
                     SECTIONS / LESSON_QUIZ / VOICE / VOK / DISC
  core.js            基础助手（$ / $1 / spd）、我的添加的本地状态、发音链路
                     （内置 mp3 → 系统泰语 → 在线语音）、toast
  nav.js             全站共享的两级导航脚手架（课程大类 → 课文/小类）：
                     卡片与课程网格 HTML、wireCards/wireBack、滚动与计数
  wrongbook.js       错题本（所有练习共用）：WRONGS 状态、addWrong/delWrong、渲染与清空
  ex.js              词汇练习（原拼写+词汇测验合并，界面参考百词斩）：六种斩词方式
                     （听音选义/中→泰/点选拼写/键盘拼写/混合/每轮随机）、本轮词量、
                     课程→课文范围、进度条、结算与常错词
  list.js            词表：按课分组、掌握度标记（CLS）、搜索与筛选、分类面板
  pattern.js         句型：按课分组与渲染
  disc.js            辨析卡片两级导航 + 辨析测验
  vok.js             词汇讲解两级导航与卡片渲染（含「让步连词总对比」的归属组）
  read.js            课文：三级导航、中文对照开关、课文/段落媒体播放器、课文小测
  notes.js           笔记：文字、图片（IndexedDB）、附件、导入导出
  add.js             添加：我的生词/句型，以及全部数据的导出/导入/清空
  import.js          导入课文：本机课文（MY_LESSONS）持久化、课程归类、渲染
  app.js             应用外壳：标签页切换 + 启动时依次调用各渲染器

状态归属（谁的变量谁负责，别在别的文件里改）：
  data.js            BUILTIN_WORDS / BUILTIN_PATTERNS / SECTIONS / LESSON_QUIZ / VOICE / VOK / DISC
  core.js            MY_WORDS / MY_PATTERNS / spd / hideZh / showZh / curAudio / VOICE 播放
  list.js            CLS、curFilt/srcFilt/listPage、readSec/readView/readCourse（阅读位置）
  ex.js / disc.js / wrongbook.js / import.js
                     各自的会话状态（exSess、dqSess、WRONGS、MY_LESSONS）
  app.js             只做外壳与启动，不持有业务状态

维护约定：改一个标签页只动它自己的文件；跨页共用的东西放 core.js / nav.js；
数据一律改 data/ 目录（见 data/README.txt），不要在 js/ 里写死内容。
