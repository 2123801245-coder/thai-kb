/* read.js —— 课文：三级导航、中文对照开关、媒体播放器、课文小测
   本文件由 泰语个人知识库.html 的内联脚本按行拆分而来，行为与原内联脚本一致；
   加载顺序见 HTML 底部的 <script src> 序列（顺序即原执行顺序）。 */
/* ============ 课文 ============ */
$1('#zhToggle').addEventListener('click', () => {
  showZh = !showZh;
  document.body.classList.toggle('showzh', showZh);
  $1('#zhToggle').textContent = showZh ? '🙈 隐藏中文对照' : '🌐 显示中文对照';
});
const mediaIsVideo = src => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(src || '');
function renderRead(){
  const box = $1('#readBox'); if(!box) return;
  const __secs = allSections();
  readSec = Math.max(0, Math.min(readSec, __secs.length - 1));
  const rsb = document.getElementById('rqStartBtn');
  const ztb = document.getElementById('zhToggle');
  const showLsUI = (v, hasZh) => {
    if(rsb) rsb.style.display = v ? '' : 'none';
    if(rqBadge) rqBadge.style.display = v ? '' : 'none';
    if(ztb) ztb.style.display = v && hasZh ? '' : 'none';
    if(!hasZh){
      showZh = false;
      document.body.classList.remove('showzh');
      if(ztb) ztb.textContent = '🌐 显示中文对照';
    } else if(ztb){
      ztb.textContent = showZh ? '🙈 隐藏中文对照' : '🌐 显示中文对照';
    }
  };

  /* 按课程分组（内置 + 导入课文）；三门大分类始终显示 */
  const groups = [];
  const gOf = c => { let g = groups.find(g2 => g2.course === c); if(!g){ g = { course: c, secs: [] }; groups.push(g); } return g; };
  COURSES.forEach(c => gOf(c));
  __secs.forEach((x, xi) => gOf(x.course || courseOfKey(x.label)).secs.push({ sec: x, xi: xi }));

  /* ---- 第 1 级：大分类入口 ---- */
  if(readView === 'courses'){
    showLsUI(false, false);
    let html = '<div class="readnavrow"><span class="readcrumb" style="margin:0;">📖 课文 · 请选择课程分类</span><button class="btn ghost2 sm" id="rqBrowseBtn">🎯 课文小测目录</button></div><div class="coursegrid">';
    groups.forEach(g => {
      const nWords = allWords().filter(w => courseOfLabel(srcOf(w)) === g.course).length;
      const titles = g.secs.slice(0, 3).map(it => (it.sec.titleZh || it.sec.label)).join(' · ');
      html += '<button class="coursecard" data-rc="' + g.course + '">'
        + '<span class="cc-icon">' + (COURSE_ICON[g.course] || '📘') + '</span>'
        + '<span class="cc-name">' + g.course + '</span>'
        + '<span class="cc-meta">' + (g.secs.length ? g.secs.length + ' 篇课文' : '暂无内置课文') + (nWords ? ' · ' + nWords + ' 词' : '') + '</span>'
        + (titles ? '<span class="cc-meta">' + titles + (g.secs.length > 3 ? ' …' : '') + '</span>' : '')
        + '</button>';
    });
    html += '</div>';
    box.innerHTML = html;
    box.querySelectorAll('.coursecard').forEach(b => {
      b.onclick = () => { readView = 'course'; readCourse = b.dataset.rc; renderRead(); };
    });
    /* 无内置课文的课程：给出诚实提示，避免「0 篇课文」死胡同 */
    box.querySelectorAll('.coursecard').forEach(b => {
      const g2 = groups.find(x => x.course === b.dataset.rc);
      if(g2 && !g2.secs.length){
        const tip = document.createElement('div');
        tip.className = 'pickempty';
        tip.style.gridColumn = '1 / -1';
        tip.innerHTML = '🎧 ' + b.dataset.rc + ' 暂无内置课文 · 可在「➕ 添加 → 📖 导入课文」中选择此分类导入，导入后显示在这里；本课程的课后小测仍可在「🎯 课文小测目录」中直接练习。';
        box.querySelector('.coursegrid').appendChild(tip);
      }
    });
    const rbBtn = document.getElementById('rqBrowseBtn');
    if(rbBtn) rbBtn.onclick = () => { readView = 'quizCourses'; renderRead(); };
    return;
  }

  /* ---- 课文小测目录 · 第 1 级：课程大类（含仅有小测、课文未导入的课程） ---- */
  if(readView === 'quizCourses'){
    showLsUI(false, false);
    let html = '<div class="readnavrow"><button class="btn ghost2 sm readback" id="quizBack0">← 返回课文目录</button></div>';
    html += '<div class="readcrumb">🎯 课文小测 · 请选择课程大类</div><div class="coursegrid">';
    let anyQ = false;
    groups.forEach(g => {
      const attached = new Set(g.secs.map(it => rqFind(it.sec) && (it.sec.titleZh || it.sec.label)));
      const withQ = g.secs.filter(it => rqFind(it.sec));
      Object.keys(LESSON_QUIZ).forEach(k => {
        const lq = LESSON_QUIZ[k];
        if(lq && lq.qs && lq.qs.length && rqCourseOfKey(k) === g.course && !attached.has(k)) withQ.push({ sec: null, xi: -1, orphan: k, lq: lq });
      });
      if(!withQ.length) return;
      anyQ = true;
      const total = withQ.reduce((a, it) => a + (it.lq || rqFind(it.sec)).qs.length, 0);
      const hasLesson = withQ.some(it => it.sec);
      html += '<button class="coursecard" data-qc="' + g.course + '">'
        + '<span class="cc-icon">🎯</span>'
        + '<span class="cc-name">' + (COURSE_ICON[g.course] || '📘') + ' ' + g.course + '</span>'
        + '<span class="cc-meta">' + (hasLesson ? withQ.length + ' 篇 · 共 ' + total + ' 题' : '课后小测 · 共 ' + total + ' 题 · 导入课文即可边学边测') + '</span>'
        + '</button>';
    });
    if(!anyQ) html += '<div class="hint" style="padding:18px 4px;">暂无课文小测。可在文件开头 LESSON_QUIZ 里按课文 titleZh 添加。</div>';
    html += '</div>';
    box.innerHTML = html;
    const qb0 = document.getElementById('quizBack0');
    if(qb0) qb0.onclick = () => { readView = 'courses'; renderRead(); };
    box.querySelectorAll('[data-qc]').forEach(b => {
      b.onclick = () => { readView = 'quizList'; readCourse = b.dataset.qc; renderRead(); };
    });
    return;
  }

  /* ---- 课文小测目录 · 第 2 级：该课程下的带测课文（含课文未导入的独立小测） ---- */
  if(readView === 'quizList'){
    showLsUI(false, false);
    const g = groups.find(x => x.course === readCourse) || groups[0];
    const attached = new Set(g.secs.map(it => rqFind(it.sec) && (it.sec.titleZh || it.sec.label)));
    const withQ = g.secs.filter(it => rqFind(it.sec));
    Object.keys(LESSON_QUIZ).forEach(k => {
      const lq = LESSON_QUIZ[k];
      if(lq && lq.qs && lq.qs.length && rqCourseOfKey(k) === g.course && !attached.has(k)) withQ.push({ sec: null, xi: -1, orphan: k, lq: lq });
    });
    let html = '<div class="readnavrow"><button class="btn ghost2 sm readback" id="quizBack1">← 选择课程大类</button><span class="badge">🎯 ' + (COURSE_ICON[g.course] || '') + ' ' + g.course + '</span><span class="badge">' + withQ.length + ' 篇</span></div>';
    html += '<div class="lessoncards">';
    withQ.forEach(it => {
      const lq = it.lq || rqFind(it.sec);
      const title = it.sec ? (it.sec.titleZh || it.sec.label) : (lq.title || it.orphan);
      const meta = it.sec ? (lq.qs.length + ' 道选择题 · 开始测验') : ('课后小测 · ' + lq.qs.length + ' 道选择题 · 课文未导入，可直接开始测试');
      html += '<button class="lessoncard" data-qls="' + it.xi + '">'
        + '<span class="lc-title">' + title + '</span>'
        + '<span class="lc-meta">' + meta + '</span>'
        + '</button>';
    });
    if(!withQ.length) html += '<div class="hint" style="padding:18px 4px;">该课程下暂无带小测的课文。</div>';
    html += '</div>';
    box.innerHTML = html;
    const qb1 = document.getElementById('quizBack1');
    if(qb1) qb1.onclick = () => { readView = 'quizCourses'; renderRead(); };
    box.querySelectorAll('.lessoncard[data-qls]').forEach(b => {
      b.onclick = () => {
        const xi = +b.dataset.qls;
        if(xi < 0){ /* 课文未导入：直接进入独立小测 */
          const entry = withQ[withQ.findIndex(it => it.xi === -1 && (it.lq ? (it.lq.title || it.orphan) : '') === b.querySelector('.lc-title').textContent)] || withQ.find(it => it.xi === -1);
          rqLQ = entry.lq; rqCourse = readCourse; rqTitle = entry.orphan; rqRun = null; rqQi = 0; rqScore = 0; rqLocked = false;
          if(rqTimer){ clearTimeout(rqTimer); rqTimer = null; }
          readView = 'quizOnly'; renderRead(); return;
        }
        readSec = xi; readView = 'lesson'; rqAutoStart = true;
        try{ localStorage.setItem('kbReadSec', String(readSec)); }catch(e){}
        renderRead();
      };
    });
    return;
  }

  /* ---- 独立小测页：课文未导入也能练课后小测 ---- */
  if(readView === 'quizOnly'){
    showLsUI(false, false);
    let html = '<div class="readnavrow"><button class="btn ghost2 sm" id="rqoBack">← 返回小测目录</button><span class="badge">🎯 ' + (COURSE_ICON[rqCourse] || '') + ' ' + rqCourse + '</span><span class="badge">' + (rqLQ ? rqLQ.qs.length : 0) + ' 题</span></div>';
    html += '<div class="secH"><span class="t">🎯 ' + (rqTitle || '课后小测') + '</span><span class="hint">课文尚未导入 · 可在「➕ 添加 → 📖 导入课文」中导入后边听边测</span></div>';
    html += '<div class="rqcard" id="rqWrap">' + rqBodyHtml() + '</div>';
    box.innerHTML = html;
    const ob = document.getElementById('rqoBack');
    if(ob) ob.onclick = () => { readView = 'quizList'; renderRead(); };
    rqWire();
    return;
  }

  /* ---- 第 2 级：分类下的课文列表 ---- */
  if(readView === 'course'){
    showLsUI(false, false);
    const g = groups.find(x => x.course === readCourse) || groups[0];
    let html = '<button class="btn ghost2 sm readback" id="readBack1">← 返回课程分类</button>';
    html += '<div class="secH"><span class="t">' + (COURSE_ICON[g.course] || '📘') + ' ' + g.course + '</span><span class="badge">' + g.secs.length + ' 篇课文</span><span class="hint">点击课文开始学习</span></div>';
    html += '<div class="lessoncards">';
    g.secs.forEach(it => {
      const s = it.sec;
      const hasQ = !!rqFind(s);
      const nv = (s.media || []).filter(m => m && mediaIsVideo(m.src)).length;
      const na = (s.media || []).length - nv;
      html += '<button class="lessoncard' + (it.xi === readSec ? ' current' : '') + '" data-ls="' + it.xi + '">'
        + '<span class="lc-title">' + (s.titleZh || s.label) + '</span>'
        + (s.title ? '<span class="lc-th th">' + s.title + '</span>' : '')
        + '<span class="lc-meta">' + s.paras.length + ' 段' + (nv ? ' · 🎬 视频×' + nv : '') + (na ? ' · 🎧 音频×' + na : '') + (hasQ ? ' · 🎯 含小测' : '') + (it.xi === readSec ? ' · 📍 上次读到' : '') + '</span>'
        + '</button>';
    });
    if(!g.secs.length) html += '<div class="hint" style="padding:18px 4px;">该分类下暂无课文。可在「➕ 添加 → 📖 导入课文」中选择此分类导入，或先用「📋 词表」学习本课程词汇。</div>';
    html += '</div>';
    box.innerHTML = html;
    const bk1 = document.getElementById('readBack1');
    if(bk1) bk1.onclick = () => { readView = 'courses'; renderRead(); };
    box.querySelectorAll('.lessoncard').forEach(b => {
      b.onclick = () => {
        readSec = +b.dataset.ls; readView = 'lesson';
        try{ localStorage.setItem('kbReadSec', String(readSec)); }catch(e){}
        renderRead();
      };
    });
    return;
  }

  /* ---- 第 3 级：课文内容 ---- */
  const sec = __secs[readSec];
  const secCourse = sec.course || courseOfKey(sec.label);
  const sib = groups.find(x => x.course === secCourse);
  const pos = sib ? sib.secs.findIndex(it => it.xi === readSec) : -1;
  let html = '<div class="readnavrow">'
    + '<button class="btn ghost2 sm" id="readBack2">← ' + (COURSE_ICON[secCourse] || '📘') + ' ' + secCourse + '</button>';
  if(sib && sib.secs.length > 1){
    html += '<span class="readpn">'
      + '<button class="btn ghost2 sm" id="readPrev"' + (pos <= 0 ? ' disabled' : '') + '>◀ 上一篇</button>'
      + '<span class="hint">' + (pos + 1) + ' / ' + sib.secs.length + '</span>'
      + '<button class="btn ghost2 sm" id="readNext"' + (pos >= sib.secs.length - 1 ? ' disabled' : '') + '>下一篇 ▶</button>'
      + '</span>';
  }
  html += '</div>';
  html += '<div class="secH"><span class="t">📄 ' + (sec.titleZh || sec.label) + '</span><span class="badge">' + (COURSE_ICON[sec.course || courseOfKey(sec.label)] || '') + ' ' + (sec.course || courseOfKey(sec.label)) + '</span><span class="hint">共 ' + sec.paras.length + ' 段</span></div>';
  /* 🎧 课文级媒体（视频/音频，边听边读）。
     视听说课按用户指定的二分归类：「中秋节听力练习」的练习/纪录片一类，其余材料一类；
     其他课程（如高级泰语精读的范读音频）只显示一个通用分组。 */
  if(sec.media && sec.media.length){
    const shown = sec.media.filter(m => m && m.src);
    const MOON_PAT = /0910-exercise|1112-doc/;   /* 练习(附文本) + 纪录片 */
    const moon = shown.filter(m => MOON_PAT.test(m.src));
    const others = shown.filter(m => !MOON_PAT.test(m.src));
    const put = (arr, catName) => {
      if(!arr.length) return;
      html += '<div class="vslbox">'
        + '<div class="vslcat">' + catName + ' <span class="hint">' + arr.length + ' 个</span></div>';
      arr.forEach((m, mi) => {
        const isVid = mediaIsVideo(m.src);
        html += '<div class="vslitem">'
          + '<div class="vslcap">' + (isVid ? '🎬' : '🎧') + ' ' + (m.label || '听力材料 ' + (mi + 1)) + '</div>'
          + (isVid
              ? '<video class="vslplayer" controls preload="metadata" src="' + m.src + '"></video>'
              : '<audio class="vslplayer" controls preload="metadata" src="' + m.src + '"></audio>')
          + '</div>';
      });
      html += '</div>';
    };
    if(moon.length){
      put(moon, '中秋节听力练习');
      put(others, '视听说练习材料');
    } else {
      put(others, '课文音视频');
    }
  }
  if(sec.title){
    html += '<div class="lesstitle">'
      + '<div class="lt-th th">' + sec.title + '</div>'
      + (sec.titleZh ? '<div class="lt-zh">' + sec.titleZh + '</div>' : '')
      + (sec.author ? '<div class="lt-author">✍️ ' + sec.author + '</div>' : '')
      + '</div>';
  }
  let global = 0;
  sec.paras.forEach((pa, pi) => {
    global++;
    html += '<div class="para">'
      + '<div class="parahdr"><span class="parano">' + global + '</span>'
      + '<button class="btn ghost2 sm" data-p="' + (sec.label) + '|' + pi + '">🔊 朗读本段</button></div>'
      + '<div class="thTxt th">' + pa.t + '</div>'
      + (pa.z ? '<div class="zhTxt">' + pa.z + '</div>' : '')
      + (pa.v ? '<video class="vslplayer" controls preload="metadata" src="' + pa.v + '"></video>' : '')
      + (pa.a ? '<audio class="vslplayer" controls preload="metadata" src="' + pa.a + '"></audio>' : '')
      + '</div>';
  });
  const prevLQ = rqLQ;
  rqLQ = rqFind(sec);
  if(rqLQ !== prevLQ){
    rqRun = null; rqQi = 0; rqScore = 0; rqLocked = false;
    if(rqTimer){ clearTimeout(rqTimer); rqTimer = null; }
  }
  if(rqLQ){
    html += '<div class="rqcard" id="rqWrap">' + rqBodyHtml() + '</div>';
  }
  showLsUI(true, sec.paras.some(pa => pa.z));
  box.innerHTML = html;
  const bk2 = document.getElementById('readBack2');
  if(bk2) bk2.onclick = () => { readView = 'course'; readCourse = secCourse; renderRead(); };
  const pvBtn = document.getElementById('readPrev'), nxBtn = document.getElementById('readNext');
  if(pvBtn && pos > 0) pvBtn.onclick = () => { readSec = sib.secs[pos - 1].xi; try{ localStorage.setItem('kbReadSec', String(readSec)); }catch(e){} renderRead(); };
  if(nxBtn && pos < sib.secs.length - 1) nxBtn.onclick = () => { readSec = sib.secs[pos + 1].xi; try{ localStorage.setItem('kbReadSec', String(readSec)); }catch(e){} renderRead(); };
  box.querySelectorAll('.parahdr .btn').forEach(b => {
    b.onclick = () => {
      const [label, pi] = b.dataset.p.split('|');
      const sec2 = allSections().find(x => x.label === label);
      if(sec2) speakThai(sec2.paras[+pi].t);
    };
  });
  if(rsb){
    rsb.style.display = rqLQ ? '' : 'none';
    rsb.onclick = () => {
      if(!rqLQ) return;
      if(!rqRun) rqBegin();
      const w = document.getElementById('rqWrap');
      if(w) w.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  }
  if(rqBadge) rqBadge.textContent = rqLQ ? (rqLQ.qs.length + ' 题') : '';
  rqWire();
  if(rqAutoStart){ rqAutoStart = false; if(rqLQ) rqBegin(); }
}

/* ---- 课文小测（数据在文件开头 LESSON_QUIZ，按课文 titleZh 配题） ---- */
function rqFind(sec){
  if(!sec) return null;
  const k1 = LESSON_QUIZ[sec.titleZh || ''], k2 = LESSON_QUIZ[sec.label || ''];
  if(k1 && k1.qs && k1.qs.length) return k1;
  if(k2 && k2.qs && k2.qs.length) return k2;
  return null;
}
function rqShuffle(arr){
  const r = arr.slice();
  for(let i = r.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); const t = r[i]; r[i] = r[j]; r[j] = t; }
  return r;
}
function rqBegin(){
  if(!rqLQ) return;
  if(rqTimer){ clearTimeout(rqTimer); rqTimer = null; }
  rqRun = rqShuffle(rqLQ.qs).map(q => ({ q: q, opts: rqShuffle(q.opts.map((t, i) => ({ t: t, ok: i === q.a }))) }));
  rqQi = 0; rqScore = 0; rqLocked = false;
  rqRender();
}
function rqStop(){
  rqRun = null; rqLocked = false;
  if(rqTimer){ clearTimeout(rqTimer); rqTimer = null; }
  rqRender();
}
function rqBodyHtml(){
  if(!rqLQ) return '';
  const head = '<div class="rqhead"><span class="rqtitle">🎯 课文小测 · ' + (rqLQ.title || '') + '</span><span class="rqscore">' + rqLQ.qs.length + ' 道选择题</span></div>';
  if(!rqRun){
    return head
      + '<div class="hint" style="margin:2px 0 12px;">读完课文测一测：内容理解 + 细节回顾，题目与选项每次随机打乱。</div>'
      + '<div style="text-align:center;"><button class="btn" id="rqGo">▶ 开始小测</button></div>';
  }
  if(rqQi >= rqRun.length){
    const n = rqRun.length, pct = n ? Math.round(rqScore / n * 100) : 0;
    const face = pct >= 85 ? '🏆' : pct >= 60 ? '👏' : '💪';
    return head
      + '<div class="rqresult"><div class="big">' + face + ' ' + pct + '%</div>'
      + '<div class="hint" style="margin:6px 0 14px;">答对 ' + rqScore + ' / ' + n + ' 题' + (pct === 100 ? ' · 满分！' : '') + '</div>'
      + '<button class="btn" id="rqAgain">🔄 再来一轮</button> <button class="btn ghost" id="rqExit">↩ 退出小测</button></div>';
  }
  const q = rqRun[rqQi];
  return head
    + '<div class="rqq">' + q.q.q + '</div>'
    + '<div class="rqopts">' + q.opts.map((o, i) => '<button class="rqopt" data-i="' + i + '">' + o.t + '</button>').join('') + '</div>'
    + '<div class="rqfb" id="rqFb"></div>';
}
function rqRender(){
  const box = document.getElementById('rqWrap'); if(!box) return;
  box.innerHTML = rqBodyHtml();
  rqWire();
}
function rqWire(){
  const wrap = document.getElementById('rqWrap'); if(!wrap) return;
  const go = document.getElementById('rqGo'); if(go) go.onclick = rqBegin;
  const ag = document.getElementById('rqAgain'); if(ag) ag.onclick = rqBegin;
  const ex = document.getElementById('rqExit'); if(ex) ex.onclick = rqStop;
  wrap.querySelectorAll('.rqopt').forEach(b => { b.onclick = () => rqPick(+b.dataset.i); });
}
function rqPick(i){
  if(rqLocked || !rqRun || rqQi >= rqRun.length) return;
  rqLocked = true;
  const item = rqRun[rqQi];
  const wrap = document.getElementById('rqWrap'); if(!wrap) return;
  const btns = wrap.querySelectorAll('.rqopt');
  btns.forEach((b, bi) => {
    b.disabled = true;
    if(item.opts[bi] && item.opts[bi].ok) b.classList.add('ok');
  });
  const ok = !!(item.opts[i] && item.opts[i].ok);
  if(!ok && btns[i]) btns[i].classList.add('no');
  if(!ok) addWrong({ t: item.q.qTitle || rqLQ.title || '', z: item.q.q || '', kind: '课文小测', mode: '', src: rqLQ.title || '' });
  if(ok) rqScore++;
  const fb = document.getElementById('rqFb');
  if(fb) fb.innerHTML = (ok ? '<span class="ok">✓ 答对了！</span>' : '<span class="no">✗ 答错了，正确答案已标绿。</span>')
    + (item.q.note ? '<div class="rqnote">💡 ' + item.q.note + '</div>' : '');
  rqTimer = setTimeout(() => { rqTimer = null; rqLocked = false; rqQi++; rqRender(); }, ok ? 1600 : 3200);
}

