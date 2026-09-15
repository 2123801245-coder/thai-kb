/* spell.js —— 拼写：点选/键盘两种模式、乱序校验、成绩统计与常错词
   本文件由 泰语个人知识库.html 的内联脚本按行拆分而来，行为与原内联脚本一致；
   加载顺序见 HTML 底部的 <script src> 序列（顺序即原执行顺序）。 */
/* ============ 拼写 ============ */
let spSess = [], spKey = '', spQi = 0, spScore = 0, spMiss = 0, spHinted = 0;
let spMode = 'tile', spTimer = null, spAns = '', spZh = '', spTiles = [], spPick = [], spUsed = [], spLock = false, spT0 = 0, spWrong = [];
try{ spMode = localStorage.getItem('spMode') || 'tile'; }catch(e){}
function spSegOne(w){
  const parts = [];
  try{
    if(window.Intl && Intl.Segmenter){
      const it = new Intl.Segmenter('th', {granularity:'grapheme'}).segment(w);
      for(const sg of it) parts.push(sg.segment);
    }
  }catch(err){}
  if(!parts.length){
    for(const c of Array.from(w)){
      if(parts.length && /[\u0E30-\u0E3A\u0E47-\u0E4E]/.test(c)) parts[parts.length - 1] += c;
      else parts.push(c);
    }
  }
  const out = [];
  for(const c of parts){
    if(out.length && RE_PURE.test(c)) out[out.length - 1] += c;
    else out.push(c);
  }
  return out;
}
/* 打字判分归一化：连续空白合一；ๆ（ mai yamok）前允许不敲空格——Thai 书写中该空格仅为习惯，输入时省略仍是正确拼写 */
function spNorm(s){ return String(s || '').replace(/\s+/g, ' ').replace(/\s*\u0E46\s*/g, '\u0E46').trim(); }
function spWordList(){ return allWords().filter(w => inPage(srcOf(w))); }
function spItem(w){ return { th: w.t, zh: w.z }; }
function spShuffle(a){ const r = a.slice(); for(let i = r.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); const t = r[i]; r[i] = r[j]; r[j] = t; } return r; }
function spBox(){ return document.getElementById('spellBox'); }
function spEnsure(){ const k = 'kb|' + listPage; if(!spSess.length || spKey !== k) spHome(); else spQ(); }
function spBegin(){ spKey = 'kb|' + listPage; spSess = spShuffle(spWordList()).map(spItem); spQi = 0; spScore = 0; spMiss = 0; spHinted = 0; spT0 = Date.now(); spWrong = []; spQ(); }
function spHome(){
  spKey = 'kb|' + listPage;
  const box = spBox(); if(!box) return;
  const n = spWordList().length;
  box.innerHTML = spToolbar()
    + '<div class="card spcard" style="text-align:center;">'
    + '<div style="font-size:40px;margin:8px 0;">✍️</div>'
    + '<div style="font-size:18px;font-weight:700;">拼写记忆 · 共 ' + n + ' 词</div>'
    + '<div class="hint" style="margin:8px 0 14px;">先听发音、凭记忆拼写；上方可按 课程 → 课文 选择范围。</div>'
    + (n ? '<button class="spchip solid" id="spStart" style="padding:10px 22px;">▶ 开始拼写（' + n + ' 词）</button>' : '<div class="hint">该范围暂无生词</div>')
    + '</div>';
  spWire();
  const b = document.getElementById('spStart'); if(b) b.onclick = spBegin;
}
function spNav(scope){
  if(scope === '__home__'){
    if(listPage !== 'all'){ listPage = 'all'; try{ localStorage.setItem('kbListPage', listPage); }catch(e){} renderList(); }
    spSess = []; spKey = '';
    spHome();
    return;
  }
  if(scope !== listPage){
    listPage = scope;
    try{ localStorage.setItem('kbListPage', listPage); }catch(e){}
    renderList();
  }
  spBegin();
}
function spScopeHome(){
  const cnts = {}; allWords().forEach(w => { const k = srcOf(w); cnts[k] = (cnts[k]||0)+1; });
  let html = '<div class="spsrc"><div class="readcrumb">✍️ 拼写 · 请选择课程大类</div><div class="coursegrid">';
  html += '<button class="coursecard" data-spsrc="__allshow__"><span class="cc-icon">☰</span><span class="cc-name">全部词汇</span><span class="cc-meta">' + allWords().length + ' 词 · 立即开始</span></button>';
  COURSES.forEach(c => {
    const ks = courseLessons(c);
    const n = ks.reduce((a,k) => a + (cnts[k]||0), 0);
    if(!n) return;
    const titles = ks.slice(0, 3).map(k => LESSON_ICONS[k] || k).join(' · ');
    html += '<button class="coursecard" data-spsrc="' + c + '">'
      + '<span class="cc-icon">' + (COURSE_ICON[c]||'📘') + '</span>'
      + '<span class="cc-name">' + c + '</span>'
      + '<span class="cc-meta">' + ks.length + ' 课 · ' + n + ' 词</span>'
      + (titles ? '<span class="cc-meta">' + titles + '</span>' : '')
      + '</button>';
  });
  const rest = lessonKeysAll().filter(k => !COURSES.includes(courseOfKey(k)) && cnts[k]);
  if(rest.length){
    html += '<button class="coursecard" data-spsrc="__other__"><span class="cc-icon">🗂</span><span class="cc-name">其他 / 我的生词</span><span class="cc-meta">' + rest.length + ' 课 · ' + rest.reduce((a,k)=>a+(cnts[k]||0),0) + ' 词</span></button>';
  }
  html += '</div></div>';
  return html;
}
function spScopeBar(showCards){
  const cnts = {}; allWords().forEach(w => { const k = srcOf(w); cnts[k] = (cnts[k]||0)+1; });
  const isCourse = COURSES.includes(listPage);
  const label = listPage === '__allshow__' ? '☰ 全部词汇' : listPage === '__other__' ? '🗂 其他 / 我的生词' : (isCourse ? (COURSE_ICON[listPage]||'📘') + ' ' + listPage : (LESSON_ICONS[listPage] || listPage));
  let html = '<div class="readnavrow"><button class="spchip" data-spsrc="__home__">← 选择课程大类</button><span class="badge">' + label + '</span></div>';
  if(showCards && listPage !== '__allshow__'){
    const ks = isCourse ? courseLessons(listPage) : (listPage === '__other__' ? lessonKeysAll().filter(k => !COURSES.includes(courseOfKey(k))) : courseLessons(courseOfKey(listPage)));
    if(ks.some(k => cnts[k])){
      html += '<div class="lessoncards">';
      ks.forEach(k => {
        if(!cnts[k]) return;
        html += '<button class="lessoncard' + (listPage === k ? ' current' : '') + '" data-spsrc="' + k + '">'
          + '<span class="lc-title">' + (LESSON_ICONS[k] || '📘 ' + k) + '</span>'
          + '<span class="lc-meta">' + (cnts[k]||0) + ' 词</span></button>';
      });
      html += '</div>';
    }
  }
  return '<div class="spsrc">' + html + '</div>';
}
function spToolbar(){
  const done = spSess.length && spQi >= spSess.length;
  let scope;
  if(listPage === 'all'){
    scope = (!spSess.length || done) ? spScopeHome()
      : '<div class="spsrc"><div class="readnavrow"><button class="spchip" data-spsrc="__home__">← 选择课程大类</button><span class="badge">☰ 全部词汇 · 测验中</span></div></div>';
  } else {
    scope = spScopeBar(!spSess.length || done);
  }
  return '<div class="spellbar">'
    + '<div class="spmode"><span class="srclabel">模式：</span>'
    + '<button class="spchip' + (spMode === 'tile' ? ' on' : '') + '" data-m="tile">🧩 点选拼写</button>'
    + '<button class="spchip' + (spMode === 'type' ? ' on' : '') + '" data-m="type">⌨️ 键盘输入</button>'
    + '</div></div>' + scope;
}

function spQ(){
  clearTimeout(spTimer);
  const box = spBox(); if(!box) return;
  if(spQi >= spSess.length){ spDone(); return; }
  const it = spSess[spQi];
  spAns = it.th; spZh = it.zh;
  spTiles = lqShuffle(spSegOne(spAns)); spPick = []; spUsed = spTiles.map(() => false); spLock = false; /* 字母块打乱顺序，防止顺着点 */
  box.innerHTML = spToolbar()
    + '<div class="card spcard">'
    + '<div class="spline"><span>第 ' + (spQi + 1) + ' / ' + spSess.length + ' 题</span><span>·</span><span>得分 ' + spScore + '</span>'
    + '<button class="spchip sm" id="spSay">🔊 再听一遍</button></div>'
    + '<div class="spzh">' + spZh + '</div>'
    + '<div class="sptip">' + (spMode === 'tile'
        ? '先听发音、凭记忆拼写：把下方打乱顺序的字母块按正确顺序点进上方空格。'
        : '先听发音、凭记忆拼写：用泰语键盘打出这个词（没泰语键盘就切到 🧩 点选）。') + '</div>'
    + (spMode === 'tile'
        ? '<div class="slots" id="spSlots"></div><div class="bank" id="spBank"></div>'
        : '<div style="margin:4px 0 12px;"><input id="spIn" class="spinput" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="输入泰语拼写…"></div>')
    + '<div class="spbtns">'
    + (spMode === 'tile' ? '<button class="spchip" id="spClear">↩ 清空重拼</button>' : '')
    + '<button class="spchip solid" id="spShow">💡 显示答案</button>'
    + (spMode === 'type' ? '<button class="spchip solid" id="spGo">✓ 检查</button>' : '')
    + '</div>'
    + '<div class="spfb" id="spFb"></div>'
    + '</div>';
  spWire();
  speakThai(spAns);
}
function spWire(){
  const mk = (id, fn) => { const el = document.getElementById(id); if(el) el.onclick = fn; };
  const box = spBox();
  if(box){
    box.querySelectorAll('.spmode .spchip[data-m]').forEach(b => {
      b.onclick = () => {
        if(b.dataset.m === spMode) return;
        spMode = b.dataset.m;
        try{ localStorage.setItem('spMode', spMode); }catch(e){}
        spQ();
      };
    });
    box.querySelectorAll('.spsrc [data-spsrc]').forEach(b => {
      b.onclick = () => spNav(b.dataset.spsrc);
    });
  }
  mk('spReset', spBegin);
  mk('spSay', () => speakThai(spAns));
  mk('spClear', () => { spPick = []; spUsed = spTiles.map(() => false); spPaint(); });
  mk('spShow', spReveal);
  mk('spGo', spCheck);
  const inp = document.getElementById('spIn');
  if(inp){
    inp.onkeydown = (ev) => { if(ev.key === 'Enter'){ ev.preventDefault(); spCheck(); } };
    setTimeout(() => { try{ inp.focus(); }catch(e){} }, 80);
  }
  spPaint();
}
function spPaint(){
  const sl = document.getElementById('spSlots');
  if(sl){
    let h = '';
    for(let i = 0; i < spTiles.length; i++){
      const v = (i < spPick.length) ? spTiles[spPick[i]] : '';
      h += '<div class="slot' + (v ? ' filled' : ' empty') + '" data-i="' + i + '">' + (v || '') + '</div>';
    }
    sl.innerHTML = h;
    if(!spLock){
      sl.querySelectorAll('.slot.filled').forEach(d => { d.onclick = () => spUndo(+d.dataset.i); });
    }
  }
  const bk = document.getElementById('spBank');
  if(bk){
    let h = '';
    for(let i = 0; i < spUsed.length; i++){ if(spUsed[i]) continue; h += '<button class="btile" data-i="' + i + '">' + spTiles[i] + '</button>'; }
    bk.innerHTML = h;
    if(!spLock){
      bk.querySelectorAll('.btile').forEach(d => { d.onclick = () => spPlace(+d.dataset.i); });
    }
  }
}
function spPlace(i){ if(spLock || spUsed[i]) return; spUsed[i] = true; spPick.push(i); spPaint(); if(spPick.length === spTiles.length) spCheck(); }
function spUndo(pos){ if(spLock || pos < 0 || pos >= spPick.length) return; const i = spPick[pos]; spPick.splice(pos, 1); spUsed[i] = false; spPaint(); }
function spGuess(){
  if(spMode === 'tile') return spPick.map(j => spTiles[j]).join('');
  const inp = document.getElementById('spIn');
  return inp ? String(inp.value || '').trim() : '';
}
function spCheck(){
  if(spLock) return;
  if(spMode === 'tile' && spPick.length < spTiles.length) return;
  spLock = true;
  const g = spGuess();
  const fb = document.getElementById('spFb');
  if(spNorm(g) === spNorm(spAns)){
    spScore++;
    if(spMode === 'tile'){ const sl = document.getElementById('spSlots'); if(sl) sl.querySelectorAll('.slot').forEach(d => d.classList.add('ok')); }
    if(fb) fb.innerHTML = '<span style="color:var(--teal);font-weight:700;">✓ 拼对了！</span>';
    speakThai(spAns);
    spNext(1500);
  } else {
    spMiss++;
    if(!spWrong.some(x => x.t === spAns)) spWrong.push({ t: spAns, z: spZh });
    addWrong({ t: spAns, z: spZh, kind: '拼写', mode: '拼错' });
    if(spMode === 'tile'){ const sl = document.getElementById('spSlots'); if(sl) sl.querySelectorAll('.slot').forEach(d => d.classList.add('no')); }
    if(fb) fb.innerHTML = '<span style="color:var(--red);font-weight:700;">✗ 拼错了。</span>　正确：<b style="font-size:21px;">' + spAns + '</b> <button class="spchip sm" id="fbSay">🔊</button>';
    const fs = document.getElementById('fbSay'); if(fs) fs.onclick = () => speakThai(spAns);
    speakThai(spAns);
    spNext(3200);
  }
}
function spReveal(){
  if(spLock) return;
  spLock = true; spHinted++;
  if(!spWrong.some(x => x.t === spAns)) spWrong.push({ t: spAns, z: spZh });
  addWrong({ t: spAns, z: spZh, kind: '拼写', mode: '看答案' });
  const fb = document.getElementById('spFb');
  if(spMode === 'tile'){
    const sl = document.getElementById('spSlots');
    if(sl){ sl.innerHTML = spTiles.map(v => '<div class="slot ok">' + v + '</div>').join(''); }
    const bk = document.getElementById('spBank'); if(bk) bk.innerHTML = '';
    spPick = spTiles.map((_, i) => i); spUsed = spTiles.map(() => true);
  } else {
    const inp = document.getElementById('spIn'); if(inp) inp.value = spAns;
  }
  if(fb) fb.innerHTML = '💡 答案已显示　正确：<b style="font-size:21px;">' + spAns + '</b> <button class="spchip sm" id="fbSay">🔊</button>';
  const fs = document.getElementById('fbSay'); if(fs) fs.onclick = () => speakThai(spAns);
  speakThai(spAns);
  spNext(3200);
}
function spNext(ms){ clearTimeout(spTimer); spTimer = setTimeout(() => { spQi++; spQ(); }, ms); }
function spFmtMs(ms){ const s = Math.round(ms / 1000); return Math.floor(s / 60) + ' 分 ' + (s % 60) + ' 秒'; }
function spDone(){
  const box = spBox(); if(!box) return;
  const n = spSess.length, pct = n ? Math.round(spScore / n * 100) : 0;
  const elapsed = spT0 ? Date.now() - spT0 : 0;
  const per = n ? Math.round(elapsed / n / 1000) : 0;
  let html = spToolbar()
    + '<div class="card spdone">'
    + '<div class="big">' + (pct >= 90 ? '🏆' : pct >= 70 ? '👏' : '💪') + '</div>'
    + '<div class="big" style="font-size:30px;margin-top:0;">' + pct + '%</div>'
    + '<div class="msg">拼对 <b>' + spScore + '</b> / ' + n + ' 词 · 失误 ' + spMiss + ' 次 · 看答案 ' + spHinted + ' 次</div>'
    + '<div class="hint" style="margin:4px 0 14px;">⏱ 用时 ' + spFmtMs(elapsed) + ' · 平均每词 ' + per + ' 秒</div>'
    + '<button class="spchip solid" id="spAgain" style="padding:10px 22px;">🔄 再来一轮</button>'
    + '</div>';
  if(spWrong.length){
    html += '<div class="card spwrong"><div class="spwrong-h">📝 本轮常错词 · ' + spWrong.length + ' 个（点 🔊 重听）</div>'
      + spWrong.map(w => '<div class="spwrong-row"><button class="spk" data-wt="' + w.t + '">🔊</button><span class="th">' + w.t + '</span><span class="spwrong-z">' + w.z + '</span></div>').join('')
      + '</div>';
  }
  box.innerHTML = html;
  spWire();
  const b = document.getElementById('spAgain'); if(b) b.onclick = spBegin;
  box.querySelectorAll('.spwrong .spk').forEach(d => { d.onclick = () => speakThai(d.dataset.wt); });
}

