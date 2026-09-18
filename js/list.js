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
function renderListPager(){
  const bar = document.getElementById('listPager'); if(!bar) return;
  const cnts = countByLesson(allWords(), srcOf);
  const total = allWords().length;
  if(listPage === '__courses__') listPage = 'all';
  let html = '';
  if(listPage === 'all'){
    /* 一级：课程大类 */
    const cards = [courseCardHtml('☰', '全部词汇', [total + ' 词'], 'lp', '__allshow__')];
    COURSES.forEach(c => {
      const ks = courseLessons(c);
      const n = ks.reduce((a,k) => a + (cnts[k]||0), 0);
      if(!n) return;
      const titles = ks.slice(0, 3).map(k => LESSON_ICONS[k] || k).join(' · ');
      const metas = [ks.length + ' 课 · ' + n + ' 词'];
      if(titles) metas.push(titles);
      cards.push(courseCardHtml((COURSE_ICON[c]||'📘'), c, metas, 'lp', c));
    });
    const rest = lessonKeysAll().filter(k => !COURSES.includes(courseOfKey(k)) && cnts[k]);
    if(rest.length){
      cards.push(courseCardHtml('🗂', '其他 / 我的生词', [rest.length + ' 课 · ' + rest.reduce((a,k)=>a+(cnts[k]||0),0) + ' 词'], 'lp', '__other__'));
    }
    html = courseGridHtml('📋 词表 · 请选择课程大类', cards);
  } else {
    /* 二级：课文小类 + 词表 */
    const label = scopeLabel(listPage, LESSON_ICONS, '☰ 全部词汇');
    html += backRow('listBack1', '选择课程大类') + '<span class="badge">' + label + '</span></div>';
    if(listPage !== '__allshow__'){
      const ks = lessonKeysFor(listPage, lessonKeysAll, courseLessons);
      if(ks.some(k => cnts[k])){
        const cards = [];
        ks.forEach(k => {
          if(!cnts[k]) return;
          cards.push(lessonCardHtml(listPage === k, LESSON_ICONS[k] || ('📘 ' + k), (cnts[k]||0) + ' 词' + (listPage === k ? ' · 当前' : ''), 'lp', k));
        });
        html += lessonCardsHtml(cards);
      }
    }
  }
  bar.innerHTML = html;
  wireCards(bar, 'lp', v => {
    if(v === listPage) return;
    listPage = v;
    try{ localStorage.setItem('kbListPage', listPage); }catch(e){}
    renderList();
    navScroll();
  });
  wireBack('listBack1', () => { listPage = 'all'; renderList(); });
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
  const __order = lessonKeysAll().filter(lg => groups[lg]);
  Object.keys(groups).forEach(lg => { if(__order.indexOf(lg) < 0) __order.push(lg); });
  __order.forEach(lg => {
    const arr = groups[lg];
    total += arr.length;
    if(showGroups){
      html += '<div class="grprow"><span class="t">📚 ' + lg + '</span><span class="badge">' + (COURSE_ICON[courseOfKey(lg)] ? COURSE_ICON[courseOfKey(lg)] + ' ' + courseOfKey(lg) : courseOfKey(lg)) + ' · ' + arr.length + ' 词</span></div>';
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
    ? '<div class="pickempty">👆 请在上方点选课程大类，再选课文查看词表。</div>'
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
}
/* ---- 掌握度分类 ---- */
let CLS = {};  try{ CLS = JSON.parse(localStorage.getItem('kb_cls') || '{}') || {}; }catch(e){}
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

