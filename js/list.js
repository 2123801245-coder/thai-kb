/* list.js —— 词表：分组过滤、掌握度标记、翻页与搜索、分类面板
   本文件由 泰语个人知识库.html 的内联脚本按行拆分而来，行为与原内联脚本一致；
   加载顺序见 HTML 底部的 <script src> 序列（顺序即原执行顺序）。 */
/* ============ 词表（一课一页翻页） ============ */
function listWordsFor(){
  const q = ($1('#searchInput') ? $1('#searchInput').value : '').trim().toLowerCase();
  const out = [];
  if(listPage === 'all' && !q) return out; /* 一级大类页只显示导航 */
  allWords().forEach((w, i) => {
    if(!inPage(srcOf(w))) return;
    if(q && !(w.t + ' ' + (w.z||'') + ' ' + (w.r||'') + ' ' + (w.p||'') + ' ' + srcOf(w)).toLowerCase().includes(q)) return;
    const c = CLS[w.t] || 0;
    if(curFilt === 'none' && c) return;
    if(curFilt !== 'all' && curFilt !== 'none' && c !== +curFilt) return;
    out.push({ w, i });
  });
  return out;
}
/* ---- 词表改版：课程 / 课文进度与复习入口 ----
   · 一级「课程进度」：每门课一张卡（已掌握 / 总数 + 进度条 + 待复习数）
   · 二级「课文列表」：一行一课（进度条 + ✓◔✗ 分布 + 🔁 一键复习本课）
   · 三级「本课词表」：头行（本课进度 + 🔁 复习本课）+ 课文芯片快速切换
   复习入口统一走 openReviewFor()：课文 → 课文范围，课程 → 课程范围，其余 → 全部。
   注意：课文名里可能出现英文引号（如「电视剧中的"方言"」），
   data-* 一律用 ltEsc() 转义，避免属性被截断。 */
const ltEsc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function openReviewFor(v){
  if(!v) startReview('due', null);
  else if(v.indexOf('@course:') === 0) startReview('due', { kind: 'course', course: v.slice(8) });
  else startReview('due', { kind: 'lesson', label: v });
}
function listStats(){
  const words = allWords();
  const byLesson = {};
  words.forEach(w => { const k = srcOf(w); (byLesson[k] = byLesson[k] || []).push(w); });
  const dueCnts = countByLesson(kbReviewPool(), srcOf);   /* 复习池按课计数：每次渲染只算一遍 */
  const statOf = k => {
    const arr = byLesson[k] || [];
    let m = 0, r = 0, f = 0;
    arr.forEach(w => { const c = CLS[w.t] || 0; if(c === 1) m++; else if(c === 2) r++; else if(c === 3) f++; });
    return { n: arr.length, m: m, r: r, f: f, due: dueCnts[k] || 0 };
  };
  return {
    words: words,
    cnts: countByLesson(words, srcOf),
    statOf: statOf,
    sumOf: ks => {
      let n = 0, m = 0, r = 0, f = 0, due = 0;
      ks.forEach(k => { const s = statOf(k); n += s.n; m += s.m; r += s.r; f += s.f; due += s.due; });
      return { n: n, m: m, r: r, f: f, due: due };
    }
  };
}
function wcourseHtml(icon, name, meta, val, st){
  const pct = st.n ? Math.round(st.m / st.n * 100) : 0;
  return '<button class="coursecard wcourse" data-lp="' + ltEsc(val) + '">'
    + '<span class="cc-icon">' + icon + '</span>'
    + '<span class="cc-name">' + ltEsc(name) + '<i class="cc-go">→</i></span>'
    + '<span class="cc-meta">' + ltEsc(meta) + '</span>'
    + '<span class="cc-bar"><i style="width:' + pct + '%"></i></span>'
    + '<span class="cc-stat">' + (st.n ? '✓ ' + st.m + ' / ' + st.n + '（' + pct + '%）' : '暂无生词')
    + (st.due ? ' · 🔁 待复习 ' + st.due : (st.m ? ' · ✨ 待复习已清' : '')) + '</span>'
    + '</button>';
}
function wlessonrowHtml(k, st, isCurrent, isLastRead){
  const ic = (LESSON_ICONS[k] || '📘').split(' ')[0];
  const pct = st.n ? Math.round(st.m / st.n * 100) : 0;
  return '<div class="wlessonrow' + (isCurrent ? ' on' : '') + '">'
    + '<button class="wl-main" type="button" data-lp="' + ltEsc(k) + '">'
    +   '<span class="wl-ic">' + ic + '</span>'
    +   '<span class="wl-b"><b>' + ltEsc(k) + (isLastRead ? '<span class="wl-now">📍 上次学到</span>' : '') + '</b>'
    +     '<span class="wl-m">' + st.n + ' 词 · ✓ ' + st.m + ' · ◔ ' + st.r + ' · ✗ ' + st.f + '</span>'
    +     '<span class="wl-bar"><i style="width:' + pct + '%"></i></span></span>'
    +   '<span class="wl-go">→</span>'
    + '</button>'
    + (st.due ? '<button class="wl-rev" type="button" data-rev="' + ltEsc(k) + '" title="复习本课生词"><b>🔁</b><small>' + st.due + ' 词</small></button>' : '')
    + '</div>';
}
function wlessonHeadHtml(o){
  const pct = o.n ? Math.round(o.m / o.n * 100) : 0;
  return '<div class="wlessonhead">'
    + '<button class="btn ghost2 sm" id="listBack1" type="button">← ' + o.back + '</button>'
    + '<div class="wlh-b"><b>' + o.title + '</b>'
    +   '<span class="wl-m">' + o.n + ' 词 · ✓ ' + o.m + ' · ◔ ' + o.r + ' · ✗ ' + o.f + '</span>'
    +   '<span class="wl-bar"><i style="width:' + pct + '%"></i></span></div>'
    + (o.due
        ? '<button class="btn" id="wlRevBtn" type="button" data-rev="' + ltEsc(o.rev) + '">🔁 ' + o.word + '（' + o.due + '）</button>'
        : '<span class="badge wlh-ok">✓ ' + (o.m ? '待复习已清' : '暂无待复习') + '</span>')
    + '</div>';
}
function lchipsHtml(ks, cur, statOf){
  return '<div class="lchips">' + ks.map(k => {
    const st = statOf(k);
    return '<button class="lchip' + (k === cur ? ' on' : '') + '" type="button" data-lp="' + ltEsc(k) + '">'
      + ltEsc(LESSON_ICONS[k] || k)
      + (st.due ? '<i class="lchip-dot">' + st.due + '</i>' : '')
      + '</button>';
  }).join('') + '</div>';
}
function renderListPager(){
  const bar = document.getElementById('listPager'); if(!bar) return;
  const LS = listStats();
  const words = LS.words, cnts = LS.cnts, statOf = LS.statOf;
  const total = words.length;
  const lastKey = (allSections()[readSec] || {}).label || '';
  if(listPage === '__courses__') listPage = 'all';
  let html = '';

  if(listPage === 'all'){
    /* 一级：课程进度 */
    const stAll = LS.sumOf(lessonKeysAll());
    const cards = [wcourseHtml('☰', '全部词汇', total + ' 词 · ' + lessonKeysAll().length + ' 课', '__allshow__', stAll)];
    COURSES.forEach(c => {
      const ks = courseLessons(c);
      const n = ks.reduce((a,k) => a + (cnts[k]||0), 0);
      if(!n) return;
      cards.push(wcourseHtml(COURSE_ICON[c] || '📘', c, ks.length + ' 课 · ' + n + ' 词', c, LS.sumOf(ks)));
    });
    const rest = lessonKeysAll().filter(k => !COURSES.includes(courseOfKey(k)) && cnts[k]);
    if(rest.length) cards.push(wcourseHtml('🗂', '其他 / 我的生词', rest.length + ' 课 · ' + LS.sumOf(rest).n + ' 词', '__other__', LS.sumOf(rest)));
    html = courseGridHtml('📋 词表 · 课程进度', cards);
  } else if(listPage === '__allshow__'){
    /* 全部词汇：一行头（进度 + 全局复习） */
    const st = LS.sumOf(lessonKeysAll());
    html = wlessonHeadHtml({ back: '课程大类', title: '☰ 全部词汇', n: st.n, m: st.m, r: st.r, f: st.f,
      due: st.due, rev: '@all', word: '复习待复习' });
  } else if(COURSES.includes(listPage) || listPage === '__other__'){
    /* 二级：课程内的课文列表（一行一课，带进度与复习入口） */
    const ks = lessonKeysFor(listPage, lessonKeysAll, courseLessons).filter(k => cnts[k]);
    const st = LS.sumOf(ks);
    const isCourse = COURSES.includes(listPage);
    html = '<div class="readnavrow">'
      + '<button class="btn ghost2 sm readback" id="listBack1" type="button">← 选择课程大类</button>'
      + '<span class="rn-right"><span class="badge">' + scopeLabel(listPage, LESSON_ICONS, '☰ 全部词汇') + '</span>'
      +   '<span class="wlh-sum">✓ ' + st.m + ' / ' + st.n + ' · 🔁 ' + st.due + '</span>'
      +   (isCourse && st.due ? '<button class="btn ghost2 sm" type="button" data-rev="@course:' + ltEsc(listPage) + '">🔁 全课程复习</button>' : '')
      + '</span></div>'
      + (ks.length
          ? '<div class="wlessons">' + ks.map(k => wlessonrowHtml(k, statOf(k), listPage === k, k === lastKey)).join('') + '</div>'
          : '<div class="pickempty">本课程暂无生词。</div>');
  } else {
    /* 三级：单课词表（头行 + 课文芯片） */
    const st = statOf(listPage);
    const course = courseOfKey(listPage);
    const ks = courseLessons(course).filter(k => cnts[k]);
    html = wlessonHeadHtml({
        back: COURSES.includes(course) ? '返回课程' : '课程大类',
        title: ltEsc(LESSON_ICONS[listPage] || ('📘 ' + listPage)),
        n: st.n, m: st.m, r: st.r, f: st.f, due: st.due, rev: listPage, word: '复习本课'
      })
      + (ks.length > 1 ? lchipsHtml(ks, listPage, statOf) : '');
  }
  bar.innerHTML = html;
  wireCards(bar, 'lp', v => {
    if(v === listPage) return;
    listPage = v;
    try{ localStorage.setItem('kbListPage', listPage); }catch(e){}
    renderList();
    navScroll();
  });
  bar.querySelectorAll('[data-rev]').forEach(b => { b.onclick = () => openReviewFor(b.dataset.rev); });
  wireBack('listBack1', () => {
    const dest = (!COURSES.includes(listPage) && listPage !== '__other__' && listPage !== '__allshow__'
      && COURSES.includes(courseOfKey(listPage))) ? courseOfKey(listPage) : 'all';
    listPage = dest;
    renderList();
  });
}
function renderList(){
  renderListPager();
  const rows = listWordsFor();
  const groups = {};
  rows.forEach(({ w, i }) => {
    const lg = srcOf(w);
    if(!inPage(lg)) return;
    (groups[lg] = groups[lg] || []).push({ w, i });
  });
  let html = '';
  let total = 0;
  const __q = ($1('#searchInput') ? $1('#searchInput').value : '').trim();
  const showGroups = listPage === '__allshow__' || listPage === '__other__' || COURSES.includes(listPage) || (listPage === 'all' && __q);
  const dueCnts = countByLesson(kbReviewPool(), srcOf);
  const __order = lessonKeysAll().filter(lg => groups[lg]);
  Object.keys(groups).forEach(lg => { if(__order.indexOf(lg) < 0) __order.push(lg); });
  __order.forEach(lg => {
    const arr = groups[lg];
    total += arr.length;
    if(showGroups){
      const gs = { 1: 0, 2: 0, 3: 0 };
      arr.forEach(({ w }) => { const c = CLS[w.t] || 0; if(c) gs[c]++; });
      html += '<div class="grprow"><span class="t">📚 ' + ltEsc(lg) + '</span><span class="badge">' + ltEsc((COURSE_ICON[courseOfKey(lg)] ? COURSE_ICON[courseOfKey(lg)] + ' ' : '') + courseOfKey(lg)) + ' · ' + arr.length + ' 词</span>'
        + '<span class="badge bp">✓ ' + gs[1] + ' · ◔ ' + gs[2] + ' · ✗ ' + gs[3] + '</span>'
        + (dueCnts[lg] ? '<button class="grp-rev" type="button" data-rev="' + ltEsc(lg) + '">🔁 复习 ' + dueCnts[lg] + '</button>' : '')
        + '</div>';
    }
    arr.forEach(({w, i}) => {
      const c = CLS[w.t] || 0;
      html += '<div class="wrow' + (hideZh ? ' selfhide' : '') + (c ? ' c' + c : '') + '" data-i="' + i + '">'
        + '<span class="n">' + (i + 1) + '.</span>'
        + '<span class="th">' + w.t + '<button class="spk" title="播放发音">🔊</button></span>'
        + '<span class="pcol">' + (w.p || '') + '</span>'
        + '<span class="zcol">' + (w.z || '') + '</span>'
        + '<span class="rcol">' + (w.r || '') + '</span>'
        + '<span class="srctag">' + srcOf(w).replace(/\s+/g, '&nbsp;') + '</span>'
        + '<span class="clsbtns">'
        + '<button class="clsbtn' + (c === 1 ? ' on1' : '') + '" data-c="1">✓</button>'
        + '<button class="clsbtn' + (c === 2 ? ' on2' : '') + '" data-c="2">◔</button>'
        + '<button class="clsbtn' + (c === 3 ? ' on3' : '') + '" data-c="3">✗</button>'
        + '</span>'
        + '</div>';
    });
  });
  const emptyHint = (listPage === 'all' && !__q)
    ? '<div class="pickempty">👆 点上方课程卡选课，再点课文看词表；每课旁的 🔁 可一键复习。</div>'
    : '<div class="pickempty">没有匹配的词，换个关键词试试。</div>';
  $1('#wtbl').innerHTML = html || emptyHint;
  const __q2 = ($1('#searchInput') ? $1('#searchInput').value : '').trim();
  const lc = $1('#listCount'); if(lc) lc.textContent = (listPage === 'all' && !__q2 ? allWords().length : total) + ' 词';
  $('#wtbl .wrow').forEach(row => {
    row.querySelector('.spk').onclick = (ev) => { ev.stopPropagation(); speakThai(allWords()[+row.dataset.i].t); };
    row.querySelectorAll('.clsbtn').forEach(b => {
      b.onclick = (ev) => {
        ev.stopPropagation();
        const w = allWords()[+row.dataset.i];
        const c = +b.dataset.c;
        if(CLS[w.t] === c) delete CLS[w.t]; else CLS[w.t] = c;
        saveCls();
        renderList();
      };
    });
    row.onclick = () => {
      if(hideZh){ row.classList.toggle('showed'); }
    };
  });
  $('#wtbl .grp-rev').forEach(b => { b.onclick = (ev) => { ev.stopPropagation(); openReviewFor(b.dataset.rev); }; });
}
/* ---- 掌握度分类 ---- */
let CLS = {};  try{ CLS = JSON.parse(localStorage.getItem('kb_cls') || '{}') || {}; }catch(e){}
/* 📌 固定过的学习进度：本机没有 kb_cls（新浏览器 / 清过数据）就从
   data-personal/progress.json 恢复掌握度，并立刻存回本机；本机有则以本机为准。 */
try{
  if(localStorage.getItem('kb_cls') === null && window.KB_PROGRESS && KB_PROGRESS.cls && typeof KB_PROGRESS.cls === 'object'){
    CLS = KB_PROGRESS.cls;
    localStorage.setItem('kb_cls', JSON.stringify(CLS));
  }
}catch(e){}
let curFilt = 'all', srcFilt = 'all', listPage = 'all', patPage = 0, patLesson = 'all', readSec = 0, rqRun = null, rqQi = 0, rqScore = 0, rqLocked = false, rqLQ = null, rqTimer = null;
try{ readSec = parseInt(localStorage.getItem('kbReadSec') || '0', 10) || 0; }catch(e){}
let readView = 'courses', readCourse = null, rqAutoStart = false, rqCourse = null, rqTitle = null; /* 课文两级导航：courses(大分类) → course(课文列表) → lesson(课文内容)；quizCourses/quizList = 课文小测目录；quizOnly = 独立小测（课文未导入） */
function rqCourseOfKey(k){ return COURSE_OF[k] || (courseOfLabel(k) || '未分类'); }
try{ srcFilt = localStorage.getItem('kbSrcFilt') || 'all'; }catch(e){}
try{ listPage = localStorage.getItem('kbListPage') || 'all'; }catch(e){}
const _SRC_KEYS = ['all'].concat(KB_META.lessonKeys);
if(_SRC_KEYS.indexOf(srcFilt) < 0) srcFilt = 'all';
function srcOf(w){ return w.lesson || w.lg || '未分组'; }
const LESSON_KEYS = KB_META.lessonKeys;
const LESSON_ICONS = KB_META.lessonIcons;
const COURSES = KB_META.courses;
const COURSE_OF = KB_META.courseOf;
const COURSE_ICON = KB_META.courseIcon;
function courseOfKey(k){ return COURSE_OF[k] || '未分类'; }
function courseOfLabel(label){ const s = allSections().find(x => x.label === label); return (s && s.course) || courseOfKey(label); }
function lessonKeysAll(){ return listLessonKeys(); }
function courseLessons(c){ return lessonKeysAll().filter(k => courseOfKey(k) === c); }
function inPage(k){ if(listPage === 'all' || listPage === '__allshow__') return true; if(listPage === '__other__') return !COURSES.includes(courseOfKey(k)); if(COURSES.includes(listPage)) return courseOfKey(k) === listPage; return k === listPage; }
function listLessonKeys(){
  const seen = {};
  allWords().forEach(w => { seen[srcOf(w)] = (seen[srcOf(w)]||0)+1; });
  const built = LESSON_KEYS.filter(k => seen[k]);
  Object.keys(seen).forEach(k => { if(LESSON_KEYS.indexOf(k) < 0) built.push(k); });
  return built;
}
function clampPage(){
  if(listPage !== 'all' && listPage !== '__allshow__' && listPage !== '__other__' && lessonKeysAll().indexOf(listPage) < 0 && COURSES.indexOf(listPage) < 0) listPage = 'all';
  if(patLesson !== 'all' && patLesson !== '__allshow__' && patLesson !== '__other__' && patKeysAll().indexOf(patLesson) < 0 && COURSES.indexOf(patLesson) < 0) patLesson = 'all';
}
function confCounts(){ try{ return { mastered: Object.values(CLS).filter(v=>v===1).length, review: Object.values(CLS).filter(v=>v===2).length, fresh: Object.values(CLS).filter(v=>v===3).length, unknown: Object.keys(CLS).length - Object.values(CLS).filter(v=>v).length }; }catch(e){ return {mastered:0,review:0,fresh:0,unknown:0}; } }
/* 复习池：错题本里的词优先 → ✗ 未掌握 → ◔ 需要复习，去重且保持词表顺序。
   错题本里的词一旦被判「✓ 记住了」（CLS=1）就不再进池；条目本身保留，清理仍去「📕 错题回顾」。
   首页（今日复习）、复习模式、词表进度（🔁 按钮）共用这一份口径。 */
function kbReviewPool(){
  const out = [], seen = new Set();
  const words = allWords();
  const find = t => words.find(w => w.t === t);
  WRONGS.forEach(g => {
    const w = find(g.t);
    if (w && !seen.has(w.t) && (CLS[w.t] || 0) !== 1) { seen.add(w.t); out.push(w); }
  });
  [3, 2].forEach(c => words.forEach(w => {
    if ((CLS[w.t] || 0) === c && !seen.has(w.t)) { seen.add(w.t); out.push(w); }
  }));
  return out;
}
function saveCls(){
    try{ localStorage.setItem('kb_cls', JSON.stringify(CLS)); }catch(e){}
    updateCountsDisplay();
}
function updateCountsDisplay(){
    const cc = $1('#clsCount'), mc = $1('#masteryPct');
    if(cc){ const n1 = Object.values(CLS).filter(v => v === 1).length, n2 = Object.values(CLS).filter(v => v === 2).length, n3 = Object.values(CLS).filter(v => v === 3).length; cc.textContent = '✓' + n1 + ' · ◔' + n2 + ' · ✗' + n3 + ' · 未标记 ' + (allWords().length - n1 - n2 - n3); }
    if(mc){ const c = confCounts(); if(allWords().length){ mc.textContent = Math.round(c.mastered / allWords().length * 100) + '% 已掌握'; } else mc.textContent = ''; }
}
function classifyAll(){ allWords().forEach(w => { const c = prompt('词：' + w.t + '\n0=清除标记  1=✓掌握  2=◔需要复习  3=✗未掌握', String((CLS[w.t] || 0))); if(c !== null){ const v = parseInt(c, 10); if(v === 0) delete CLS[w.t]; else if(v === 1 || v === 2 || v === 3) CLS[w.t] = v; } }); saveCls(); renderList(); toast('已按提示逐词分类'); }
  function clearCounts(){ if(!confirm('清除所有掌握度标记？（不会删除词表内容）')) return; CLS = {}; saveCls(); renderList(); toast('已清除所有标记'); }
  function resetAll(){ if(!confirm('清除本设备上所有的个人数据（词表、句型、分类、笔记、图片、练习记录）？')) return; MY_WORDS = []; MY_PATTERNS = []; CLS = {}; NOTE_IMGS = []; NOTE_ATTS = []; try{ localStorage.removeItem('kb_notes'); }catch(e){} IDB.del('kb_note_imgs'); IDB.del('kb_note_atts'); try{ localStorage.removeItem('kb_note_imgs'); }catch(e){} try{ localStorage.removeItem('kb_note_atts'); }catch(e){} try{ localStorage.removeItem('kb_cls'); }catch(e){} saveMine(); saveCls(); renderNoteImgs(); renderNoteAtts(); renderList(); renderMine(); toast('已重置'); }
/* 📌 使用说明默认折叠，点击展开/收起 */
$1('#edithintBtn').addEventListener('click', () => {
  const box = document.getElementById('edithint');
  const open = box.classList.toggle('open');
  $1('#edithintBtn').textContent = open ? '📌 使用说明 · 如何修改本知识库 ▴' : '📌 使用说明 · 如何修改本知识库 ▾';
});
$('#filtRow .filt').forEach(b => {
  b.onclick = () => {
    curFilt = b.dataset.f;
    $('#filtRow .filt').forEach(x => x.classList.toggle('on', x === b));
    renderList();
  };
});
/* 词表翻页按钮在 renderListPager 内绑定（listPage ↔ srcFilt 同步） */
$1('#hideZhBtn').addEventListener('click', () => {
  hideZh = !hideZh;
  $1('#hideZhBtn').textContent = hideZh ? '🌐 显示中文' : '🙈 遮住中文自测';
  $1('#unhideAllBtn').style.display = hideZh ? '' : 'none';
  renderList();
});
$1('#unhideAllBtn').addEventListener('click', () => {
  $('#wtbl .wrow.showed').forEach(r => r.classList.remove('showed'));
});
$1('#searchInput').addEventListener('input', renderList);

