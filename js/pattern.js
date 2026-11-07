/* pattern.js —— 句型：按课分组与渲染
   本文件由 泰语个人知识库.html 的内联脚本按行拆分而来，行为与原内联脚本一致；
   加载顺序见 HTML 底部的 <script src> 序列（顺序即原执行顺序）。 */
/* ============ 句型（一课一页翻页） ============ */
function patKeysAll(){
  const seen = {};
  allPatterns().forEach(p => { const k = p.lg || '未分组'; seen[k] = (seen[k]||0)+1; });
  const built = [];
  Object.keys(COURSE_OF).forEach(k => { if(seen[k]) built.push(k); });
  Object.keys(seen).forEach(k => { if(built.indexOf(k) < 0) built.push(k); });
  return built;
}
function patLessons(c){ return patKeysAll().filter(k => courseOfKey(k) === c); }
/* ── 单条翻页模式：一屏一个句型 ── */
let patIdx = 0;  try { patIdx = parseInt(localStorage.getItem('kbPatIdx') || '0', 10) || 0; } catch(e) {}
let patTocOpen = false;
function patSaveIdx(){ try { localStorage.setItem('kbPatIdx', String(patIdx)); } catch(e) {} }
function patFilter(){
  return allPatterns().filter(p => {
    const k = p.lg || '未分组';
    if(patLesson === '__allshow__') return true;
    if(patLesson === '__other__') return !COURSES.includes(courseOfKey(k));
    const isCourse = COURSES.includes(patLesson);
    if(isCourse) return courseOfKey(k) === patLesson;
    return k === patLesson;
  });
}
function patGo(delta){
  const pts = patFilter();
  if(!pts.length) return;
  patIdx = Math.min(pts.length - 1, Math.max(0, patIdx + delta));
  patSaveIdx();
  renderPatterns();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
kbPagerKeys('pane-pattern', () => patGo(-1), () => patGo(1));
function renderPatterns(){
  const box = $1('#patternBox');
  if(!box) return;
  const cnts = {};
  allPatterns().forEach(p => { const k = p.lg || '未分组'; cnts[k] = (cnts[k]||0)+1; });
  const PICONS = { '千年雨 ฝนพันปี':'📖 千年雨', '香榄传说 พิกุล':'🌳 香榄传说', '可选择 เลือกได้':'🎯 可选择', '可选择·对话 เลือกได้ บทสนทนา':'💬 可选择·对话', '野生动物灭绝 สัตว์ป่าสูญพันธุ์':'🐘 野生动物灭绝', '辨析 แท้ๆ vs จริงๆ':'⚖️ 让步&辨析' };
  let html = '';
  if(patLesson === 'all'){
    /* 一级：课程大类 */
    html += '<div class="readcrumb">🧩 句型 · 请选择课程大类</div><div class="coursegrid">';
    html += '<button class="coursecard" data-pl="__allshow__"><span class="cc-icon">☰</span><span class="cc-name">全部句型</span><span class="cc-meta">' + allPatterns().length + ' 条</span></button>';
    COURSES.forEach(c => {
      const ks = patLessons(c);
      const n = ks.reduce((a,k) => a + (cnts[k]||0), 0);
      if(!n) return;
      const titles = ks.slice(0, 3).map(k => PICONS[k] || k).join(' · ');
      html += '<button class="coursecard" data-pl="' + c + '">'
        + '<span class="cc-icon">' + (COURSE_ICON[c]||'📘') + '</span>'
        + '<span class="cc-name">' + c + '</span>'
        + '<span class="cc-meta">' + ks.length + ' 课 · ' + n + ' 条</span>'
        + (titles ? '<span class="cc-meta">' + titles + '</span>' : '')
        + '</button>';
    });
    const rest = patKeysAll().filter(k => !COURSES.includes(courseOfKey(k)) && cnts[k]);
    if(rest.length){
      html += '<button class="coursecard" data-pl="__other__"><span class="cc-icon">🗂</span><span class="cc-name">其他 / 我的句型</span><span class="cc-meta">' + rest.length + ' 课 · ' + rest.reduce((a,k)=>a+(cnts[k]||0),0) + ' 条</span></button>';
    }
    html += '</div>';
    box.innerHTML = html;
    box.querySelectorAll('[data-pl]').forEach(b => {
      b.onclick = () => {
        if(b.dataset.pl === patLesson) return;
        patLesson = b.dataset.pl;
        renderPatterns();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
    });
    return;
  }
  /* 二级：课文小类 + 句型卡片 */
  const isCourse = COURSES.includes(patLesson);
  const label = patLesson === '__allshow__' ? '☰ 全部句型' : patLesson === '__other__' ? '🗂 其他 / 我的句型' : (isCourse ? (COURSE_ICON[patLesson]||'📘') + ' ' + patLesson : (PICONS[patLesson] || patLesson));
  html += '<div class="readnavrow"><button class="btn ghost2 sm readback" id="patBack1">← 选择课程大类</button><span class="badge">' + label + '</span></div>';
  if(patLesson !== '__allshow__'){
    const ks = isCourse ? patLessons(patLesson) : (patLesson === '__other__' ? patKeysAll().filter(k => !COURSES.includes(courseOfKey(k))) : patLessons(courseOfKey(patLesson)));
    if(ks.some(k => cnts[k])){
      html += '<div class="lessoncards">';
      ks.forEach(k => {
        if(!cnts[k]) return;
        html += '<button class="lessoncard' + (patLesson === k ? ' current' : '') + '" data-pl="' + k + '">'
          + '<span class="lc-title">' + (PICONS[k] || '📘 ' + k) + '</span>'
          + '<span class="lc-meta">' + (cnts[k]||0) + ' 条</span></button>';
      });
      html += '</div>';
    }
  }
  const pts = allPatterns().filter(p => {
    const k = p.lg || '未分组';
    if(patLesson === '__allshow__') return true;
    if(patLesson === '__other__') return !COURSES.includes(courseOfKey(k));
    if(isCourse) return courseOfKey(k) === patLesson;
    return k === patLesson;
  });
  /* 单条翻页：一屏一个句型 */
  if(patIdx >= pts.length) patIdx = Math.max(0, pts.length - 1);
  const pt = pts[patIdx];
  if(pt){
    const i = allPatterns().indexOf(pt);
    html += '<div class="pitem">'
      + '<div class="card pcard">'
      + '<div class="phead"><span class="badge">' + (COURSE_ICON[courseOfKey(pt.lg || '')] || '') + ' ' + (pt.lg || '句型') + '</span><span class="pno">#' + (i + 1) + '</span></div>'
      + '<div class="ppat th">' + pt.p + '</div>'
      + '<div class="pzh">' + (pt.z || '') + '</div>'
      + (pt.ex ? '<div class="pex"><span class="th">' + pt.ex + '</span><button class="spk" data-i="' + i + '">🔊</button></div>' : '')
      + (pt.ez ? '<div class="pez">' + pt.ez + '</div>' : '')
      + '</div>'
      + '</div>';
  }
  html += kbPagerHtml('pat', patIdx, pts.length);
  html += '<button class="tocbtn" id="patToc" type="button">' + (patTocOpen ? '▲ 收起目录' : '📑 句型目录（' + pts.length + ' 条）') + '</button>';
  if(patTocOpen){
    html += '<div class="lessoncards">';
    pts.forEach((p2, k2) => {
      html += '<button class="lessoncard' + (k2 === patIdx ? ' current' : '') + '" data-pidx="' + k2 + '" type="button">'
        + '<span class="lc-title">' + p2.p + '</span>'
        + '<span class="lc-meta">' + kbEsc(String(p2.z || '').slice(0, 24)) + '</span></button>';
    });
    html += '</div>';
  }
  box.innerHTML = html || '<div class="noteinfo">还没有句型，去「➕ 添加」或编辑文件开头。</div>';
  const pb1 = document.getElementById('patBack1'); if(pb1) pb1.onclick = () => { patLesson = 'all'; renderPatterns(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  box.querySelectorAll('[data-pl]').forEach(b => {
    b.onclick = () => {
      if(b.dataset.pl === patLesson) return;
      patLesson = b.dataset.pl;
      patIdx = 0; patSaveIdx(); patTocOpen = false;
      renderPatterns();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  });
  box.querySelectorAll('.spk[data-i]').forEach(b => {
    b.onclick = () => speakThai(allPatterns()[+b.dataset.i].ex);
  });
  const pv = document.getElementById('patPrev'); if(pv) pv.onclick = () => patGo(-1);
  const nx = document.getElementById('patNext'); if(nx) nx.onclick = () => patGo(1);
  const toc = document.getElementById('patToc'); if(toc) toc.onclick = () => { patTocOpen = !patTocOpen; renderPatterns(); };
  box.querySelectorAll('[data-pidx]').forEach(b => {
    b.onclick = () => { patIdx = +b.dataset.pidx; patSaveIdx(); renderPatterns(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  });
}

