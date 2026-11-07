/* home.js —— 首页：继续学习 / 今日复习 / 掌握进度 / 学习路径
   · 复习池 kbReviewPool()：定义在 list.js（首页 / 复习模式 / 词表进度共用同一份口径）
   · 今日目标与连续天数存本机（kb_today / kb_days，均已列入备份清单 KB_STORE_KEYS）
   · 页面上的跳转直接驱动既有视图状态（readSec / readView / listPage），不复制导航 */
const KB_GOAL = 20;      /* 今日复习目标：多少词 */
const KB_ROUND = 10;     /* 一组复习多少个词 */

const kbDateStr = dt => dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
const kbEsc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function kbToday(){
  const d = kbDateStr(new Date());
  let t = null;
  try { t = JSON.parse(localStorage.getItem('kb_today') || 'null'); } catch (e) {}
  if (!t || t.d !== d || typeof t.n !== 'number') t = { d: d, n: 0 };
  return t;
}
function kbBumpToday(n){
  const t = kbToday();
  t.n += (n || 1);
  try { localStorage.setItem('kb_today', JSON.stringify(t)); } catch (e) {}
  kbLogAdd(n);          /* 同一笔也记进按天的日志，首页「本周复习」用它画柱 */
}
function kbMarkDay(){
  const d = kbDateStr(new Date());
  let days = [];
  try { days = JSON.parse(localStorage.getItem('kb_days') || '[]') || []; } catch (e) {}
  if (days[days.length - 1] !== d) {
    days.push(d);
    if (days.length > 90) days = days.slice(-90);
    try { localStorage.setItem('kb_days', JSON.stringify(days)); } catch (e) {}
  }
  return days;
}
function kbStreak(){
  let days = [];
  try { days = JSON.parse(localStorage.getItem('kb_days') || '[]') || []; } catch (e) {}
  const set = new Set(days);
  const d = new Date();
  if (!set.has(kbDateStr(d))) d.setDate(d.getDate() - 1);   /* 今天还没学：从昨天数 */
  let n = 0;
  while (set.has(kbDateStr(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/* ---- 按天学习量：kb_log = { '2026-10-24': 24, ... }，只存本机，随备份快照一起走 ---- */
function kbDayLog(){
  let m = {};
  try { m = JSON.parse(localStorage.getItem('kb_log') || '{}') || {}; } catch (e) {}
  return m;
}
function kbLogAdd(n){
  const m = kbDayLog(), d = kbDateStr(new Date());
  m[d] = (m[d] || 0) + (n || 1);
  const keys = Object.keys(m).sort();
  while (keys.length > 120) { delete m[keys.shift()]; }   /* 最多留 120 天 */
  try { localStorage.setItem('kb_log', JSON.stringify(m)); } catch (e) {}
}
function kbWeekBars(){
  const m = kbDayLog(), out = [], now = new Date();
  const wd = ['日','一','二','三','四','五','六'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const k = kbDateStr(d);
    out.push({ k: k, lab: wd[d.getDay()], v: m[k] || 0, today: i === 0 });
  }
  return out;
}

/* ---- 首页跳转：直接驱动既有视图状态 ---- */
function kbOpenLesson(xi){
  const tab = document.querySelector('.tab[data-v="read"]'); if (tab) tab.click();
  readSec = Math.max(0, Math.min(xi | 0, allSections().length - 1));
  try { localStorage.setItem('kbReadSec', String(readSec)); } catch (e) {}
  readView = 'lesson'; renderRead();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function kbOpenCourse(c){
  const tab = document.querySelector('.tab[data-v="read"]'); if (tab) tab.click();
  readView = 'course'; readCourse = c; renderRead();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function kbOpenWordsFor(key){
  const tab = document.querySelector('.tab[data-v="list"]'); if (tab) tab.click();
  const keys = lessonKeysAll();
  listPage = (key === '__allshow__' || COURSES.includes(key) || keys.includes(key)) ? key : 'all';
  try { localStorage.setItem('kbListPage', listPage); } catch (e) {}
  renderList();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── 多学习包（词书）：kb_packs = [{label}]，可同时学多篇课文 ── */
function kbGetPacks(){
  let packs = [];
  try { packs = JSON.parse(localStorage.getItem('kb_packs') || '[]') || []; } catch(e) { packs = []; }
  packs = packs.filter(p => p && p.label);
  if(!packs.length){
    const secs = allSections();
    const cur = secs.length ? secs[Math.min(Math.max(0, readSec | 0), secs.length - 1)] : null;
    if(cur) packs = [{ label: cur.label }];
  }
  return packs;
}
function kbSavePacks(p){ try{ localStorage.setItem('kb_packs', JSON.stringify(p)); }catch(e){} }
function kbActiveLabel(packs){
  let a = '';
  try { a = localStorage.getItem('kb_activePack') || ''; } catch(e) {}
  if(!packs.some(p => p.label === a)) a = packs.length ? packs[0].label : '';
  return a;
}
function kbSetActivePack(label){
  try { localStorage.setItem('kb_activePack', label || ''); } catch(e) {}
}
/* 学习包管理弹层：查看 / 添加 / 删除 */
function openPackModal(){
  const old = document.getElementById('packModal'); if(old) old.remove();
  const m = document.createElement('div');
  m.id = 'packModal';
  const packs = kbGetPacks();
  const secs = allSections();
  const added = packs.map(p => p.label);
  const avail = secs.filter(s => added.indexOf(s.label) < 0);
  m.innerHTML = '<div class="pm-mask"></div><div class="pm-box">'
    + '<div class="pm-head"><b>📚 学习包管理</b><span class="pm-sub">可同时学多篇课文，点序号切换</span><button class="pm-x" id="pmClose" type="button">✕</button></div>'
    + '<div class="pm-sec">已添加 · ' + packs.length + ' 个</div>'
    + '<div class="pm-list">'
    + packs.map((p, i) => '<div class="pm-row"><span class="pm-no">' + String(i + 1).padStart(2, '0') + '</span>'
        + '<span class="pm-label">' + kbEsc(p.label) + '</span>'
        + (packs.length > 1
            ? '<button class="pm-del" data-del="' + kbEsc(p.label) + '" type="button" title="移除">🗑</button>'
            : '<span class="pm-hold">至少保留一个</span>')
        + '</div>').join('')
    + '</div>'
    + '<div class="pm-sec">➕ 可添加的课文</div>'
    + '<div class="pm-list">'
    + (avail.length
        ? avail.map(s => '<button class="pm-add" data-add="' + kbEsc(s.label) + '" type="button">'
            + '<span class="pm-al">' + kbEsc(s.label) + '</span>'
            + '<span class="pm-ac">' + kbEsc(s.course || courseOfKey(s.label)) + '</span>'
            + '<span class="pm-plus">＋ 添加</span></button>').join('')
        : '<div class="pm-empty">✨ 所有课文都已加入学习包</div>')
    + '</div></div>';
  document.body.appendChild(m);
  const close = () => m.remove();
  m.querySelector('.pm-mask').onclick = close;
  m.querySelector('#pmClose').onclick = close;
  m.querySelectorAll('[data-add]').forEach(b => {
    b.onclick = () => {
      const ps = kbGetPacks();
      ps.push({ label: b.dataset.add });
      kbSavePacks(ps);
      kbSetActivePack(b.dataset.add);
      close(); renderHome();
    };
  });
  m.querySelectorAll('[data-del]').forEach(b => {
    b.onclick = () => {
      const ps = kbGetPacks().filter(p => p.label !== b.dataset.del);
      kbSavePacks(ps);
      kbSetActivePack(kbActiveLabel(ps));
      close(); renderHome();
    };
  });
}

function renderHome(){
  const box = document.getElementById('homeBox'); if (!box) return;
  kbMarkDay();
  const streak = kbStreak();
  const today = kbToday();
  const words = allWords();
  const cc = confCounts();
  const total = words.length || 1;
  const pct = Math.round(cc.mastered / total * 100);
  const pool = kbReviewPool();
  const due = pool.length;
  const wrongN = WRONGS.length;
  const secs = allSections();
  const xi = secs.length ? Math.min(Math.max(0, readSec | 0), secs.length - 1) : -1;
  const cur = xi >= 0 ? secs[xi] : null;
  const curCourse = cur ? (cur.course || courseOfKey(cur.label)) : '';
  const curWords = cur ? words.filter(w => srcOf(w) === cur.label).length : 0;
  const readPct = secs.length ? Math.round((xi + 1) / secs.length * 100) : 0;
  const goalN = Math.min(today.n || 0, KB_GOAL);
  const now = new Date();
  const wd = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];
  const dateStr = (now.getMonth() + 1) + '月' + now.getDate() + '日 ' + wd;

  /* ── 当前学习包统计 ── */
  const packs = kbGetPacks();
  const activeLabel = kbActiveLabel(packs);
  const packSec = secs.find(s => s.label === activeLabel) || null;
  const packWords = activeLabel ? words.filter(w => srcOf(w) === activeLabel) : [];
  const packMastered = packWords.filter(w => CLS[w.t] === 1).length;
  const packFresh = packWords.filter(w => !CLS[w.t]).length;
  const packDue = pool.filter(w => srcOf(w) === activeLabel).length;
  const packPct = packWords.length ? Math.round(packMastered / packWords.length * 100) : 0;
  const packXi = packSec ? secs.indexOf(packSec) : -1;

  /* 学习路径：三门大分类（+ 导入课文带出的新分类） */
  const courseList = [];
  COURSES.forEach(c => courseList.push(c));
  secs.forEach(s => { const c = s.course || courseOfKey(s.label); if (courseList.indexOf(c) < 0) courseList.push(c); });
  const steps = courseList.map(c => {
    const ks = secs.filter(s => (s.course || courseOfKey(s.label)) === c);
    const labels = ks.map(s => s.label);
    const inC = words.filter(w => labels.indexOf(srcOf(w)) >= 0);
    const mast = inC.filter(w => CLS[w.t] === 1).length;
    const wp = inC.length ? Math.round(mast / inC.length * 100) : 0;
    const isCur = cur && curCourse === c;
    const pos = isCur ? ks.findIndex(s => s.label === cur.label) + 1 : 0;
    const meta = ks.length + ' 篇课文'
      + (inC.length ? ' · 已掌握词 ' + mast + '/' + inC.length : '')
      + (pos > 0 ? ' · 📍 读到第 ' + pos + ' 篇' : '');
    const go = isCur ? '继续 →' : (wp > 0 ? '复习 →' : '开始 →');
    return '<button class="hstep' + (isCur ? ' now' : '') + '" type="button" data-course="' + kbEsc(c) + '">'
      + '<span class="hstep-ic">' + (COURSE_ICON[c] || '📘') + '</span>'
      + '<span class="hstep-b"><b>' + kbEsc(c) + (isCur ? '<span class="hstep-now">📍 进行中</span>' : '') + '</b>'
      + '<span class="hstep-m">' + meta + '</span>'
      + '<span class="hstep-bar"><i style="width:' + wp + '%"></i></span></span>'
      + '<span class="hstep-go">' + go + '</span></button>';
  }).join('');

  /* ---- 本周曲线：最近 7 天的复习量（kb_log，按天累计） ---- */
  const wk = kbWeekBars();
  const wkMax = Math.max(KB_GOAL, wk.reduce((m, x) => Math.max(m, x.v), 0)) || 1;
  const wkSum = wk.reduce((a, x) => a + x.v, 0);
  const wkHtml = wk.map(x => {
    const h = Math.max(x.v > 0 ? 8 : 0, Math.round(x.v / wkMax * 100));
    return '<div class="wk-col' + (x.today ? ' today' : '') + '">'
      + '<div class="wk-v">' + (x.v || '') + '</div>'
      + '<div class="wk-box"><i class="wk-fill" style="height:' + h + '%"></i></div>'
      + '<div class="wk-lab">' + x.lab + '</div></div>';
  }).join('');

  /* ---- 本课生词速览：当前课文里的前 6 个词 ---- */
  const curWordsList = cur ? words.filter(w => srcOf(w) === cur.label) : [];
  const curPreview = curWordsList.slice(0, 6);
  const dwHtml = curPreview.length ? curPreview.map(w => {
    const c = CLS[w.t] | 0;
    return '<button class="dw' + (c ? ' on' + c : '') + '" type="button" data-t="' + kbEsc(w.t) + '">'
      + '<span class="t">' + kbEsc(w.t) + '</span>'
      + '<span class="z">' + kbEsc(w.z || '') + '</span></button>';
  }).join('') : '';

  box.innerHTML = ''
    + '<div class="home-top">'
    +   '<div class="home-hi"><b>' + dateStr + '</b><span>สวัสดี 👋 今天也读一点泰语吧</span></div>'
    +   '<div class="bzc-stats">'
    +     '<span class="bzcs pill"><i>⚡</i>' + streak + ' 天</span>'
    +     '<span class="bzcs pill"><i>🪙</i>' + ((today.n || 0) * 10 + streak * 50) + '</span>'
    +   '</div>'
    + '</div>'
    + '<button class="bzc-checkin" id="hmCheckin" type="button">📅 打卡</button>'

    /* ── 百词斩式学习包：多词书 tab（01/02…）＋ 添加 ＋ 按包渲染进度 ── */
    + '<section class="bzc-wrap">'
    +   '<div class="bzc-tabs">'
    +     packs.map((p, i) => '<button class="bzc-tab' + (p.label === activeLabel ? ' on' : '') + '" data-pack="' + kbEsc(p.label) + '" type="button" title="' + kbEsc(p.label) + '">' + String(i + 1).padStart(2, '0') + '</button>').join('')
    +     '<button class="bzc-tab-add" id="bpAdd" type="button" title="添加一篇课文，同时学">＋</button>'
    +   '</div>'
    +   '<section class="bzc-pack">'
    +     '<div class="bp-head">'
    +       '<span class="bp-name">' + kbEsc(activeLabel || '还没有学习包') + '</span>'
    +       (packSec ? '<button class="bp-go" id="hmGo" type="button" title="继续读这篇课文">📖 继续读</button>' : '')
    +     '</div>'
    +     '<div class="bp-progress">'
    +       '<div class="bp-bar"><i style="width:' + packPct + '%"></i></div>'
    +       '<button class="bp-count" id="bpCountBtn" type="button" title="看本课词表">' + packMastered + '/' + packWords.length + ' 词 ›</button>'
    +     '</div>'
    +     '<div class="bp-btns">'
    +       '<button class="bp-btn" id="hmNew" type="button">新学 <span>' + Math.min(KB_ROUND, packFresh) + ' 词</span></button>'
    +       '<button class="bp-btn" id="hmReview" type="button">复习 <span>' + packDue + ' 词到期</span></button>'
    +     '</div>'
    +     '<div class="bp-foot">'
    +       '<span>' + (today.n >= KB_GOAL ? '✓ 今日目标已达成（' + today.n + ' 词）'
                                        : '今日已学 ' + (today.n || 0) + ' / ' + KB_GOAL + ' 词') + '</span>'
    +       '<button class="bp-wrong" id="hmToWrong" type="button">'
    +         (wrongN ? '📕 错题 ' + wrongN + ' 条 →' : '✨ 错题本是空的') + '</button>'
    +     '</div>'
    +   '</section>'
    + '</section>'

    /* ── 数据行：掌握环形 + 快捷入口 ── */
    + '<div class="hrow">'
    +   '<section class="card hstat">'
    +     '<div class="hd-k">📈 掌握情况</div>'
    +     '<div class="hs-ringwrap">'
    +       '<svg viewBox="0 0 120 120" class="hs-ring" aria-hidden="true">'
    +         '<circle cx="60" cy="60" r="52" fill="none" stroke="rgba(52,66,107,.1)" stroke-width="11"></circle>'
    +         '<circle cx="60" cy="60" r="52" fill="none" stroke="var(--teal)" stroke-width="11" stroke-linecap="round" '
    +           'transform="rotate(-90 60 60)" stroke-dasharray="326.7" stroke-dashoffset="' + (326.7 * (1 - pct / 100)).toFixed(1) + '"></circle>'
    +       '</svg>'
    +       '<div class="hs-mid"><b>' + pct + '%</b><span>已掌握</span></div>'
    +     '</div>'
    +     '<div class="hs-legend">✓ ' + cc.mastered + ' · ◔ ' + cc.review + ' · ✗ ' + cc.fresh
    +       ' · 未标记 ' + Math.max(0, total - cc.mastered - cc.review - cc.fresh) + '</div>'
    +   '</section>'
    +   '<section class="card hdue">'
    +     '<div class="hd-k">⚡ 快速开始</div>'
    +     '<button class="btn wide" id="hmGoWords" type="button" style="margin-bottom:8px;'
    +       (cur && curWords ? '' : 'display:none;') + '">看本课生词（' + curWords + '）</button>'
    +     '<button class="btn ghost wide" id="hmTrain" type="button">🎯 去训练场</button>'
    +     '<div class="hd-tags" style="margin-top:10px;">◔ 需要复习 ' + cc.review + ' · ✗ 未掌握 ' + cc.fresh + '</div>'
    +   '</section>'
    + '</div>'

    + '<section class="card wkcard">'
    +   '<div class="wk-top"><div class="hd-k">📊 本周复习</div>'
    +     '<span class="wk-sum">合计 ' + wkSum + ' 词' + (wkSum ? '' : ' · 还没开始') + '</span></div>'
    +   '<div class="wk">' + wkHtml + '</div>'
    +   '<div class="wk-note">每天复习满 ' + KB_GOAL + ' 词，柱子和目标线一样高就算达标</div>'
    + '</section>'

    + (dwHtml ? '<section class="card dwcard">'
      + '<div class="wk-top"><div class="hd-k">🔤 本课生词</div><span class="wk-sum">' + curPreview.length + ' / ' + curWordsList.length + '</span></div>'
      + '<div class="dw-row">' + dwHtml + '</div>'
      + '<div class="wk-note">点一个词去词表里看例句、发音和掌握度</div>'
      + '</section>' : '')

    + '<section class="dash-short">'
    +   '<button class="ds-btn" id="hmWordLearning" type="button">🎯 百词斩背单词<small>四选一测试 + SM-2复习</small></button>'
    +   '<button class="ds-btn" id="hmEx" type="button">🎯 练一组<small>六种练法，20 词一轮</small></button>'
    +   '<button class="ds-btn" id="hmWrong" type="button">📕 背错题<small>' + (wrongN ? wrongN + ' 条等着清' : '错题本是空的') + '</small></button>'
    +   '<button class="ds-btn" id="hmNext" type="button">📖 读一篇<small>' + (secs.length ? '第 ' + Math.min(xi + 2, secs.length) + ' / ' + secs.length + ' 篇' : '还没有课文') + '</small></button>'
    + '</section>'

    + '<section class="card hpath">'
    +   '<div class="hd-k">🗺️ 学习路径<span class="hp-note">读完一篇课文，到「训练」里巩固，再把生词过进复习</span></div>'
    +   '<div class="hsteps">' + steps + '</div>'
    + '</section>';

  /* ---- 绑定 ---- */
  const g1 = document.getElementById('hmGo');
  if (g1) g1.onclick = () => kbOpenLesson(packXi >= 0 ? packXi : xi);
  /* 学习包：tab 切换 / ＋ 添加 / 双按钮按包范围 */
  box.querySelectorAll('.bzc-tab[data-pack]').forEach(t => {
    t.onclick = () => { kbSetActivePack(t.dataset.pack); renderHome(); };
  });
  const bpAdd = document.getElementById('bpAdd');
  if (bpAdd) bpAdd.onclick = () => openPackModal();
  const bpCnt = document.getElementById('bpCountBtn');
  if (bpCnt) bpCnt.onclick = () => kbOpenWordsFor(activeLabel);
  const ck = document.getElementById('hmCheckin');
  if (ck) ck.onclick = () => {
    kbMarkDay();
    ck.textContent = '✅ 已打卡';
    ck.classList.add('done');
    setTimeout(() => { ck.textContent = '📅 打卡'; ck.classList.remove('done'); }, 1600);
  };
  const g2 = document.getElementById('hmGoWords');
  if (g2 && cur) g2.onclick = () => kbOpenWordsFor(cur.label);
  /* 说明：学习包卡片上的词数按钮是 bpCountBtn（上面已绑定），这里的 hmGoWords 是「快速开始」卡里的 */
  const rv = document.getElementById('hmReview');
  if (rv) rv.onclick = () => {
    if (packDue > 0) startReview('due', { kind: 'lesson', label: activeLabel });   /* 只复习本包的词 */
    else if (typeof startTodayLearning === 'function') startTodayLearning();
  };
  const nw = document.getElementById('hmNew');
  if (nw) nw.onclick = () => {
    if (packFresh > 0) startReview('new', { kind: 'lesson', label: activeLabel }); /* 只学本包的新词 */
    else if (typeof startTodayLearning === 'function') startTodayLearning();
  };
  const tr = document.getElementById('hmTrain');
  if (tr) tr.onclick = () => {
    if (typeof goTrainHome === 'function') { goTrainHome(); return; }
    const t = document.querySelector('.tab[data-v="trainHome"]');
    if (t) t.click();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  /* 训练组标签已并入「训练场」首页：这里直接切面板，不依赖标签存在 */
  const kbGoPane = paneName => {
    document.querySelectorAll('.pane').forEach(p => p.classList.remove('on'));
    const pane = document.getElementById('pane-' + paneName);
    if (pane) pane.classList.add('on');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const tw = document.getElementById('hmToWrong');
  if (tw) tw.onclick = () => kbGoPane('wrongbook');
  const ex = document.getElementById('hmEx');
  if (ex) ex.onclick = () => kbGoPane('ex');
  const wr = document.getElementById('hmWrong');
  if (wr) wr.onclick = () => kbGoPane('wrongbook');
  const nx = document.getElementById('hmNext');
  const wl = document.getElementById("hmWordLearning");
  if (wl) wl.onclick = () => { if(typeof startTodayLearning === "function") startTodayLearning(); };
  if (nx) nx.onclick = () => kbOpenLesson(Math.min(xi + 1, secs.length - 1));
  box.querySelectorAll('.hstep').forEach(b => { b.onclick = () => kbOpenCourse(b.dataset.course); });
  box.querySelectorAll('.dw').forEach(b => { if (cur) b.onclick = () => kbOpenWordsFor(cur.label); });
}


renderHome();
