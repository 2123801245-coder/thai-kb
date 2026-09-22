/* lib/pkg-info.js —— 发布包里那些「事实」的唯一来源。
   为什么单独一层：说明文本（tools/templates/ 下的说明与启动器）里出现的每个数字，
   都必须与 data/ 跟骨架一致；上一版把这些数字写死在构建脚本里，结果给同学发出去的包
   印着「10 个标签页 … 添加 / 导入」，而实际是 9 个、也没有「导入」这个标签页。
   现在数字只在打包时从这里现场推导，模板里只写 {{token}}。

   导出：
     facts(srcDir)        → 说明模板可用的 {{token}} 表（含 course.<课程名>）
     mediaRefs(srcDir)    → data/ 真正引用到的媒体清单（发布包只拷这些），并标出缺失的文件
     render(tpl, vars)    → 替换 {{token}}；遇到不认识的 token 直接抛错，防止写错名字后静默印出原文
     unmentionedTabs(...)  → 骨架里有、说明文本里却没提到的标签页（发货前自查说明是否过期）
*/
const fs = require('fs');
const path = require('path');

const readJson = (srcDir, name) => JSON.parse(fs.readFileSync(path.join(srcDir, 'data', name), 'utf8'));

/* 骨架里真实存在的标签页：以 <div class="tab" data-v="…">标签</div> 为准，
   标签文本去掉前面的图标（有些是 emoji，有些带变体选择符）。 */
function tabLabels(srcDir) {
  const html = fs.readFileSync(path.join(srcDir, '泰语个人知识库.html'), 'utf8');
  const out = [];
  const re = /<div class="tab[^"]*"[^>]*data-v="([^"]+)"[^>]*>([^<]*)</g;
  let m;
  while ((m = re.exec(html))) out.push(m[2].replace(/^[^\p{L}\p{N}]+/u, '').trim());
  return out;
}

/* data/ 里任何位置出现过的 src（课程级 media、段落级引用都算），去重排序 */
function mediaRefs(srcDir) {
  const list = [];
  (function walk(o) {
    if (Array.isArray(o)) return o.forEach(walk);
    if (o && typeof o === 'object') {
      if (typeof o.src === 'string' && o.src) list.push(o.src);
      Object.values(o).forEach(walk);
    }
  })(readJson(srcDir, 'lessons.json'));
  const uniq = [...new Set(list)].sort();
  return {
    list: uniq,
    videos: uniq.filter(f => /\.(mp4|webm|mov|m4v)$/i.test(f)),
    audios: uniq.filter(f => /\.(mp3|m4a|wav|ogg)$/i.test(f)),
    missing: uniq.filter(f => !fs.existsSync(path.join(srcDir, f)))
  };
}

function facts(srcDir) {
  const words = readJson(srcDir, 'words.json');
  const vok = readJson(srcDir, 'vok.json');
  const lessons = readJson(srcDir, 'lessons.json');
  const media = mediaRefs(srcDir);
  const course = {};
  lessons.forEach(l => { if (l.course) course[l.course] = (course[l.course] || 0) + 1; });
  const tabs = tabLabels(srcDir);
  return {
    words: words.length,
    vokCards: vok.length,
    vokSents: vok.reduce((n, c) => n + ((c.sents || []).length), 0),
    lessons: lessons.length,
    tabs: tabs.length,
    tabLabels: tabs,
    videos: media.videos.length,
    audios: media.audios.length,
    course
  };
}

/* 说明文本是否跟上了骨架：返回骨架里有、但说明里一个字都没提的标签页。
   上一版就是漏了这一步——骨架早已把「导入」并进「添加」、标签页从 10 变 9，
   而说明里还印着「10 个标签页 … 添加 / 导入」。 */
function unmentionedTabs(labels, text) {
  return labels.filter(l => !String(text).includes(l));
}

function render(tpl, vars) {
  return tpl.replace(/\{\{([^}]+)\}\}/g, (_, raw) => {
    const key = raw.trim();
    const v = key.split('.').reduce((o, seg) => (o == null ? undefined : o[seg]), vars);
    if (v === undefined || v === null) {
      throw new Error('模板里的 {{' + key + '}} 没有对应值；可用 token：' + Object.keys(vars).join('、'));
    }
    return String(v);
  });
}

module.exports = { facts, mediaRefs, render, tabLabels, unmentionedTabs };
