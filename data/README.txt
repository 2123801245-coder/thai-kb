data/ —— 知识库数据目录（页面只负责界面，所有内容在这里维护）
（界面逻辑在同级 js/ 目录，模块划分与加载顺序见 js/README.txt）

  words.json         生词表（t泰语 · z中文 · p词性 · r读音 · lesson来源课）
  patterns.json      句型（p句型 · z中文 · ex/ez 例句 · lg来源课）
  lessons.json       课文（label页标签 · title泰文题 · titleZh · author · course · paras[{t泰语段,z中文段}]）
  quizzes.json       课文小测（key = 课文 titleZh；q题干 · opts选项 · a正确项下标 · note讲解）
  disc.json          辨析卡片
  vok.json           词汇讲解
  voice.json         内置发音（泰语词→base64 mp3，机器生成，勿手改）
  lessons.meta.json  课文→课程归类与图标（lessonKeys / courses / courseOf / courseIcon / lessonIcons）
  notes-default.txt  笔记默认文本（页面源码里 id=kb-notes-default 的区域是同一份内容的嵌入副本）

维护方法：用文本编辑器改对应 json，保存后刷新页面即可。
或者在页面「➕ 添加」页点「📌 固定到知识库」：浏览器里的「我的添加」
（生词/句型/导入课文）会直接写进这里（发布目录里会同步 data/*.js），
从此随版本更新与发版走，不依赖某个浏览器的存储；
固定写入的条目带 "pin": 1 标记（无内置发音，朗读走系统/在线语音，自检对这类条目免发音检查）。
学习进度（掌握度/错题本/笔记文字）的快照不写在本目录，而是 data-personal/progress.json
（个人数据：不入 git、不进发布包，浏览器清空后靠它自动恢复）。
注意：必须通过本地 HTTP 服务打开页面（推荐 python3 server.py —— 它支持 Range 请求，
视频进度条才能显示完整并可任意拖动；普通的 python3 -m http.server 不支持 Range，
会导致视听说视频无法拖动进度条）后访问 http://127.0.0.1:8765/泰语个人知识库.html；
直接双击 HTML 会因浏览器安全限制读不到数据。
增删课文时请同步改 lessons.meta.json：lessonKeys（顺序）、courseOf（归类）、lessonIcons（图标）。
