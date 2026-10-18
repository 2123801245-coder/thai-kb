/* review.js —— 复习模式：待复习队列 → 卡片自测 → 立刻回写掌握度
   进入方式：首页「▶ 开始复习 / 🌱 学习新词」（不在标签栏，属于一条专注路径）。
   一组 KB_ROUND（10）个词：
     · due 模式：错题本词优先 → ✗ 未掌握 → ◔ 需要复习（kbReviewPool，定义在 list.js）
     · new 模式：还没标记过的词
   判词结果直接写 CLS（1=记住了 / 2=有点模糊 / 3=不认识），与词表同源；
   每个词计一次「今日进度」（kb_today），复习过的词本轮会话内不重复出现。 */
let revQ = [], revI = 0, revShown = false, revOn = false;
let revGrades = {}, revStat = { 1: 0, 2: 0, 3: 0 };
let revSkip = new Set();                 /* 本轮会话里已经复习过的词 */
let revScope = null;                     /* 复习范围：null=全部 | {kind:'lesson',label} | {kind:'course',course}（从词表 🔁 进来时限定本课/本课程） */
let revReturnTab = 'home';               /* 结束后回哪个标签：从词表进来的回词表，从首页进来的回首页 */

function revInScope(w){
  if (!revScope) return true;
  if (revScope.kind === 'lesson') return srcOf(w) === revScope.label;
  if (revScope.kind === 'course') return courseOfKey(srcOf(w)) === revScope.course;
  return true;
}
function revScopeWord(){ return revScope ? (revScope.kind === 'lesson' ? '本课' : '本课程') : ''; }
function revBuildPool(mode){
  if (mode === 'new') {
    let p = allWords().filter(w => !CLS[w.t] && revInScope(w) && !revSkip.has(w.t));
    if (!p.length) p = allWords().filter(w => !CLS[w.t] && revInScope(w));
    return p;
  }
  return kbReviewPool().filter(w => revInScope(w) && !revSkip.has(w.t));
}
/* scope：不传 → 全部范围；{kind:'lesson'|'course', …} → 课文 / 课程范围；
   'keep' → 沿用当前范围（结算页的「再来一组 / 学新词」用）。 */
function startReview(mode, scope){
  mode = mode || 'due';
  if (mode !== 'again' && scope !== 'keep') revScope = scope || null;
  if (mode !== 'again') {
    const on = document.querySelector('.tabs .tab.on');   /* 记下入口标签，结束后回到来的地方 */
    revReturnTab = (on && on.dataset.v) || 'home';
    revSkip = new Set();                      /* 新开一轮会话 */
  }
  revQ = revBuildPool(mode === 'again' ? 'due' : mode).slice(0, KB_ROUND);
  revI = 0; revShown = false; revGrades = {}; revStat = { 1: 0, 2: 0, 3: 0 };
  revOpenPane();
  if (revQ.length) revShowCard(); else revShowEnd();
}
function revOpenPane(){
  $('.pane').forEach(p => p.classList.remove('on'));
  const pane = document.getElementById('pane-review');
  if (pane) pane.classList.add('on');
  revOn = true;
  window.scrollTo({ top: 0 });
}
function revClose(){
  revSkip = new Set();
  revOn = false;
  const t = document.querySelector('.tab[data-v="' + revReturnTab + '"]') || document.querySelector('.tab[data-v="home"]');
  revScope = null;
  if (t) t.click();                               /* 回入口页：noteTab / 首页钩子会顺手刷新数字 */
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function revShowCard(){
  const box = document.getElementById('revBox'); if (!box) return;
  revShown = false;
  const w = revQ[revI];
  const src = srcOf(w);
  const poolN = kbReviewPool().filter(revInScope).length;
  box.innerHTML =
    '<div class="rev-top">'
    + '<button class="btn ghost2 sm" id="revExit" type="button">✕ 结束</button>'
    + '<div class="rev-pg"><i style="width:' + Math.round(revI / revQ.length * 100) + '%"></i></div>'
    + '<span class="rev-n">' + (revI + 1) + ' / ' + revQ.length + '</span>'
    + '</div>'
    + '<section class="card revcard" id="revCard">'
    +   '<div class="rev-src">' + kbEsc(src) + '</div>'
    +   '<div class="rev-th th">' + kbEsc(w.t) + '</div>'
    +   '<div class="rev-play"><button class="spk" id="revSpk" type="button" title="播放发音">🔊</button></div>'
    +   '<div class="rev-z rev-hidden" id="revZ">'
    +     (w.p ? '<span class="rv-p">' + kbEsc(w.p) + '</span>' : '')
    +     '<span class="rv-zz">' + kbEsc(w.z || '（暂无释义）') + '</span>'
    +     (w.r ? '<span class="rv-r">读音：' + kbEsc(w.r) + '</span>' : '')
    +     '<span class="rv-src2">来源：' + kbEsc(src) + '</span>'
    +   '</div>'
    +   '<div class="rev-ask" id="revAskWrap"><button class="btn wide" id="revShow" type="button">显示释义</button></div>'
    +   '<div class="rev-grades rev-hidden" id="revGrades">'
    +     '<button class="rvg g3" data-g="3" type="button">✗ 不认识</button>'
    +     '<button class="rvg g2" data-g="2" type="button">◔ 有点模糊</button>'
    +     '<button class="rvg g1" data-g="1" type="button">✓ 记住了</button>'
    +   '</div>'
    +   '<div class="rev-rest">本组共 ' + revQ.length + ' 词 · ' + (revScope ? revScopeWord() + '待复习 ' : '全部待复习 ') + poolN + ' 词</div>'
    + '</section>';

  document.getElementById('revExit').onclick = revClose;
  document.getElementById('revSpk').onclick = () => speakThai(w.t);
  document.getElementById('revShow').onclick = revReveal;
  box.querySelectorAll('#revGrades .rvg').forEach(b => { b.onclick = () => revGrade(+b.dataset.g); });
  const card = document.getElementById('revCard');
  card.onclick = e => { if (!revShown && !e.target.closest('button')) revReveal(); };
}
function revReveal(){
  if (revShown) return;
  revShown = true;
  const z = document.getElementById('revZ'); if (z) z.classList.remove('rev-hidden');
  const ask = document.getElementById('revAskWrap'); if (ask) ask.classList.add('rev-hidden');
  const g = document.getElementById('revGrades'); if (g) g.classList.remove('rev-hidden');
  const w = revQ[revI];
  if (w) speakThai(w.t);
}
function revGrade(gVal){
  if (!revShown) return;
  const w = revQ[revI]; if (!w) return;
  revGrades[w.t] = gVal;
  revStat[gVal]++;
  revSkip.add(w.t);
  CLS[w.t] = gVal;
  saveCls();
  kbBumpToday(1);
  revI++;
  if (revI >= revQ.length) revShowEnd(); else revShowCard();
}
function revRedoMissed(){
  const missed = revQ.filter(w => revGrades[w.t] > 1);
  if (!missed.length) return;
  revQ = missed.slice(0, KB_ROUND);
  revI = 0; revShown = false; revGrades = {}; revStat = { 1: 0, 2: 0, 3: 0 };
  revShowCard();
}
function revShowEnd(){
  const box = document.getElementById('revBox'); if (!box) return;
  const done = revStat[1] + revStat[2] + revStat[3];
  const rest = kbReviewPool().filter(w => revInScope(w) && !revSkip.has(w.t)).length;
  const missedN = Object.keys(revGrades).filter(t => revGrades[t] > 1).length;
  const newLeft = allWords().filter(w => !CLS[w.t] && revInScope(w)).length;
  const today = kbToday();
  const goalN = Math.min(today.n || 0, KB_GOAL);
  const streak = kbStreak();

  let msg;
  if (rest > 0) msg = (revScope ? revScopeWord() + '待复习还剩 ' : '待复习还剩 ') + rest + ' 词，趁热再来一组？';
  else if (missedN > 0) msg = '刚才没记住的 ' + missedN + ' 词，再来一遍加深印象？';
  else if (newLeft > 0) msg = (revScope ? revScopeWord() + '待复习已清空' : '待复习清单已清空') + '，要不要学 ' + KB_ROUND + ' 个新词？';
  else msg = revScope ? (revScopeWord() + '已经全部掌握，了不起 ✨') : '词表已全部掌握，了不起 ✨';

  let btns = '';
  if (rest > 0) btns += '<button class="btn" id="revAgain" type="button">▶ 再来一组（剩 ' + rest + '）</button>';
  else if (missedN > 0) btns += '<button class="btn" id="revRedo" type="button">🔁 再练没记住的 ' + missedN + ' 词</button>';
  if (newLeft > 0) btns += '<button class="btn ghost" id="revNew" type="button">🌱 学习 ' + KB_ROUND + ' 个新词</button>';
  btns += '<button class="btn ghost2" id="revHome" type="button">回首页</button>';

  box.innerHTML =
    '<section class="card rev-done">'
    + '<div class="rev-emoji">' + (done ? '🎉' : '✨') + '</div>'
    + '<div class="rev-dt">' + (done ? '本组完成！' : '暂时没有要复习的词') + '</div>'
    + (done ? '<div class="rev-dstat">✓ 记住了 ' + revStat[1] + ' · ◔ 有点模糊 ' + revStat[2] + ' · ✗ 不认识 ' + revStat[3] + '</div>' : '')
    + '<div class="hd-goal"><div class="hd-bar"><i style="width:' + Math.round(goalN / KB_GOAL * 100) + '%"></i></div>'
    +   '<span>' + (today.n >= KB_GOAL ? '✓ 今日目标已达成（' + today.n + ' 词）' : '今日已复习 ' + (today.n || 0) + ' / ' + KB_GOAL + ' 词')
    +   (streak > 1 ? ' · 🔥 连续 ' + streak + ' 天' : '') + '</span></div>'
    + '<div class="rev-dnext">' + msg + '</div>'
    + '<div class="rev-dbtns">' + btns + '</div>'
    + '</section>';

  const a = document.getElementById('revAgain'); if (a) a.onclick = () => startReview('again');
  const r = document.getElementById('revRedo'); if (r) r.onclick = revRedoMissed;
  const n = document.getElementById('revNew'); if (n) n.onclick = () => startReview('new', 'keep');
  const h = document.getElementById('revHome'); if (h) h.onclick = revClose;
}

/* 键盘：空格 / 回车翻面，1 / 2 / 3 判词（桌面顺手） */
document.addEventListener('keydown', e => {
  if (!revOn) return;
  const pane = document.getElementById('pane-review');
  if (!pane || !pane.classList.contains('on')) return;
  if (!revShown && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); revReveal(); return; }
  if (revShown) {
    if (e.key === '1') { e.preventDefault(); revGrade(1); }
    else if (e.key === '2') { e.preventDefault(); revGrade(2); }
    else if (e.key === '3') { e.preventDefault(); revGrade(3); }
  }
});
