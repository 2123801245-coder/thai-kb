/* ex.js —— 词汇练习（拼写 + 词汇测验合并，界面参考百词斩）
   六种斩词方式：听音选义 / 中→泰 选词 / 点选拼写 / 键盘拼写 / 混合 / 每轮随机；
   支持本轮词量（10/20/40/全部）与 课程→课文 范围选择；答错自动进错题本。 */
/* ============ 词汇练习 ============ */
let exSess = [], exQi = 0, exScore = 0, exMiss = 0, exHinted = 0, exLocked = false, exT0 = 0, exWrong = [];
let exSrc = 'all', exMode = 'random', exRoundMode = 'listen', exCount = '20', exInput = '';
let exTimer = null;
try{ exSrc = localStorage.getItem('exSrc') || 'all'; }catch(e){}
try{ exMode = localStorage.getItem('exMode') || 'random'; }catch(e){}
try{ exCount = localStorage.getItem('exCount') || '20'; }catch(e){}
const EX_MODES = ['listen', 'zhth', 'tile', 'type'];
const EX_LABEL = { listen: '🔊 听音选义', zhth: '中→泰 选词', tile: '🧩 点选拼写', type: '⌨️ 键盘拼写', mix: '🔀 混合出题', random: '🎲 每轮随机' };

function exPool(){
  return allWords().filter(w => {
    if(exSrc === 'all' || exSrc === '__allshow__') return true;
    const k = srcOf(w);
    if(exSrc === '__other__') return !COURSES.includes(courseOfKey(k));
    if(COURSES.includes(exSrc)) return courseOfKey(k) === exSrc;
    return k === exSrc;
  }).filter(w => w.z && String(w.z).trim());
}
function exShuffle(r){ for(let i = r.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); const t = r[i]; r[i] = r[j]; r[j] = t; } return r; }
function exTiles(w){
  /* 泰文字素切分（与原拼写页一致）：先按字形切，再合并纯元音/声调符号 */
  let parts = [];
  try{
    if(window.Intl && Intl.Segmenter){
      const it = new Intl.Segmenter('th', {granularity:'grapheme'}).segment(w);
      for(const sg of it) parts.push(sg.segment);
    }
  }catch(e){}
  if(!parts.length){
    for(const c of Array.from(w)){
      if(parts.length && /[\u0E30-\u0E3A\u0E47-\u0E4E]/.test(c)) parts[parts.length - 1] += c;
      else parts.push(c);
    }
  }
  const out = [];
  for(const c of parts){
    if(out.length && /[\u0E30-\u0E3A\u0E47-\u0E4E]/.test(c)) out[out.length - 1] += c;
    else out.push(c);
  }
  return out;
}
/* 打字判分归一化：空白合一；ๆ 前允许不敲空格 */
function exNorm(s){ return String(s || '').replace(/\s+/g, ' ').replace(/\s*\u0E46\s*/g, '\u0E46').trim(); }
function exMakeQ(w, pool, mode){
  const q = { w, mode };
  if(mode === 'tile' || mode === 'type') return q;
  let opts = exShuffle(pool.filter(x => x.t !== w.t && x.z !== w.z)).slice(0, 3);
  q.opts = exShuffle([w].concat(opts));
  if(mode === 'zhth'){
    const seen = new Set([w.t]); opts = [w];
    for(const x of exShuffle(pool.filter(x => x.t !== w.t))){
      if(seen.has(x.t)) continue; seen.add(x.t); opts.push(x); if(opts.length >= 4) break;
    }
    if(opts.length < 4){
      for(const x of exShuffle(allWords())){
        if(seen.has(x.t) || !x.z) continue; seen.add(x.t); opts.push(x); if(opts.length >= 4) break;
      }
    }
    q.opts = exShuffle(opts);
  }
  return q;
}
function exBegin(){
  const pool = exPool();
  exRoundMode = exMode === 'random' ? EX_MODES.concat('mix')[Math.floor(Math.random() * (EX_MODES.length + 1))] : exMode;
  let list = exShuffle(pool.slice());
  const n = exCount === 'all' ? list.length : Math.min(parseInt(exCount, 10) || 20, list.length);
  exSess = list.slice(0, n).map(w => exMakeQ(w, pool, exRoundMode === 'mix' ? 'mix' : exRoundMode));
  exQi = 0; exScore = 0; exMiss = 0; exHinted = 0; exT0 = Date.now(); exWrong = [];
  exQ();
}
function exEnsure(){
  const box = document.getElementById('exBox'); if(!box) return;
  if(exSess.length && exQi < exSess.length){
    /* 切走时已判分（反馈中）的题：回来直接进入下一题，不重复计分 */
    if(exLocked) exQi++;
    exQ();
  } else exHome();
}
function exScopeHtml(showCards){
  const cnts = countByLesson(allWords(), srcOf);
  if(exSrc === 'all'){
    if(!showCards){
      /* 答题中：紧凑返回条，避免整页课程网格压在题目上方 */
      return '<div class="readnavrow"><button class="spchip" data-exsrc="__home__">← 选择课程大类</button><span class="badge">☰ 全部词汇 · 练习中</span></div>';
    }
    const cards = [courseCardHtml('☰', '全部词汇', [allWords().length + ' 词 · 立即开始'], 'exsrc', '__allshow__')];
    COURSES.forEach(c => {
      const ks = courseLessons(c);
      const n = ks.reduce((a,k) => a + (cnts[k]||0), 0);
      if(!n) return;
      const titles = ks.slice(0, 3).map(k => LESSON_ICONS[k] || k).join(' · ');
      const metas = [ks.length + ' 课 · ' + n + ' 词'];
      if(titles) metas.push(titles);
      cards.push(courseCardHtml((COURSE_ICON[c]||'📘'), c, metas, 'exsrc', c));
    });
    const rest = lessonKeysAll().filter(k => !COURSES.includes(courseOfKey(k)) && cnts[k]);
    if(rest.length){
      cards.push(courseCardHtml('🗂', '其他 / 我的生词', [rest.length + ' 课 · ' + rest.reduce((a,k)=>a+(cnts[k]||0),0) + ' 词'], 'exsrc', '__other__'));
    }
    return courseGridHtml('🎯 词汇练习 · 请选择课程大类', cards);
  }
  const isCourse = COURSES.includes(exSrc);
  const label = scopeLabel(exSrc, LESSON_ICONS, '☰ 全部词汇');
  let html = '<div class="readnavrow"><button class="spchip" data-exsrc="__home__">← 选择课程大类</button><span class="badge">' + label + '</span><button class="spchip" id="exReset">↺ 重新开始</button></div>';
  if(showCards && exSrc !== '__allshow__'){
    const ks = isCourse ? courseLessons(exSrc) : (exSrc === '__other__' ? lessonKeysAll().filter(k => !COURSES.includes(courseOfKey(k))) : courseLessons(courseOfKey(exSrc)));
    if(ks.some(k => cnts[k])){
      const cards = [];
      ks.forEach(k => {
        if(!cnts[k]) return;
        cards.push(lessonCardHtml(exSrc === k, LESSON_ICONS[k] || ('📘 ' + k), (cnts[k]||0) + ' 词', 'exsrc', k));
      });
      html += lessonCardsHtml(cards);
    }
  }
  return html;
}
function exWireBar(){
  const box = document.getElementById('exBox'); if(!box) return;
  const rb = document.getElementById('exReset'); if(rb) rb.onclick = exBegin;
  box.querySelectorAll('[data-exsrc]').forEach(b => {
    b.onclick = () => {
      const v = b.dataset.exsrc;
      if(v === '__home__'){
        if(exSrc !== 'all'){ exSrc = 'all'; try{ localStorage.setItem('exSrc', exSrc); }catch(e){} }
        exSess = []; exQi = 0; exScore = 0; exMiss = 0;
        exHome();
        return;
      }
      if(v === exSrc) return;
      exSrc = v;
      try{ localStorage.setItem('exSrc', exSrc); }catch(e){}
      if(COURSES.includes(v) || v === '__other__') exHome();
      else exBegin();
    };
  });
}
function exHome(){
  const box = document.getElementById('exBox'); if(!box) return;
  const pool = exPool();
  const modes = [
    ['listen', '🔊', '听音选义', '只听发音选中文'],
    ['zhth', '中→泰', '选词', '看中文选出泰语词'],
    ['tile', '🧩', '点选拼写', '把打乱的音节块拼成词'],
    ['type', '⌨️', '键盘拼写', '用泰语键盘打出来'],
    ['mix', '🔀', '混合出题', '每题随机换方式'],
    ['random', '🎲', '每轮随机', '每轮抽一种方式']
  ];
  let html = exScopeHtml(true)
    + '<div class="card exhome">'
    + '<div class="exhome-icon">🎯</div>'
    + '<div class="exhome-title">词汇练习 · 共 ' + pool.length + ' 词</div>'
    + '<div class="exmodes">' + modes.map(m =>
        '<button class="exmode' + (exMode === m[0] ? ' on' : '') + '" data-exm="' + m[0] + '">'
        + '<span class="exmode-ico">' + m[1] + '</span><span class="exmode-name">' + m[2] + '</span><span class="exmode-tip">' + m[3] + '</span></button>').join('')
    + '</div>'
    + '<div class="exrow"><span class="exrowlabel">本轮词量</span>'
    + ['10','20','40','all'].map(n => '<button class="spchip' + (exCount === n ? ' on' : '') + '" data-exn="' + n + '">' + (n === 'all' ? '全部' : n + ' 词') + '</button>').join('')
    + '</div>'
    + '<button class="spchip solid exgo" id="exStart">▶ 开始练习（' + Math.min(exCount === 'all' ? pool.length : parseInt(exCount,10) || 20, pool.length) + ' 词）</button>'
    + '</div>';
  box.innerHTML = html;
  exWireBar();
  box.querySelectorAll('[data-exm]').forEach(b => {
    b.onclick = () => {
      exMode = b.dataset.exm;
      try{ localStorage.setItem('exMode', exMode); }catch(e){}
      box.querySelectorAll('[data-exm]').forEach(x => x.classList.toggle('on', x === b));
    };
  });
  box.querySelectorAll('[data-exn]').forEach(b => {
    b.onclick = () => {
      exCount = b.dataset.exn;
      try{ localStorage.setItem('exCount', exCount); }catch(e){}
      box.querySelectorAll('[data-exn]').forEach(x => x.classList.toggle('on', x === b));
      const st = document.getElementById('exStart');
      if(st) st.textContent = '▶ 开始练习（' + Math.min(exCount === 'all' ? exPool().length : parseInt(exCount,10) || 20, exPool().length) + ' 词）';
    };
  });
  const st = document.getElementById('exStart'); if(st) st.onclick = exBegin;
}
function exQ(){
  clearTimeout(exTimer);
  const box = document.getElementById('exBox'); if(!box) return;
  if(exQi >= exSess.length){ exDone(); return; }
  const q = exSess[exQi];
  const mode = q.mode === 'mix' ? EX_MODES[Math.floor(Math.random() * EX_MODES.length)] : q.mode;
  q.effMode = mode;
  exLocked = false; exInput = '';
  const progPct = Math.round(exQi / exSess.length * 100);
  let body = '<div class="exprog"><div class="exprog-in" style="width:' + progPct + '%"></div></div>'
    + '<div class="exmeta"><span>' + (exQi + 1) + ' / ' + exSess.length + '</span><span class="exmode-tag">' + (EX_LABEL[exRoundMode] || '') + '</span><span>✓ ' + exScore + '</span></div>'
    + '<div class="exstage">';
  if(mode === 'listen'){
    body += '<button class="exbig" id="exSay">🔊</button>';
  } else if(mode === 'zhth'){
    body += '<div class="exzh">' + q.w.z + '</div>';
  } else {
    body += '<div class="exzh">' + q.w.z + '</div>'
      + '<button class="spchip sm exsay" id="exSay">🔊 听发音</button>';
  }
  body += '</div>';
  if(mode === 'tile'){
    const tiles = exShuffle(exTiles(q.w.t));
    body += '<div class="slots" id="exSlots"></div><div class="bank">' + tiles.map((t, i) => '<button class="btile" data-ti="' + i + '">' + t + '</button>').join('') + '</div>'
      + '<div class="spbtns"><button class="spchip" id="exClear">↩ 清空</button><button class="spchip" id="exHint">💡 显示答案</button></div>'
      + '<div class="spfb" id="exFb"></div>';
  } else if(mode === 'type'){
    body += '<div class="exinputrow"><input id="exIn" class="spinput" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="输入泰语拼写…"></div>'
      + '<div class="spbtns"><button class="spchip solid" id="exGo">✓ 检查</button><button class="spchip" id="exHint">💡 显示答案</button></div>'
      + '<div class="spfb" id="exFb"></div>';
  } else {
    body += '<div class="exopts">' + q.opts.map((o, i) => '<button class="exopt" data-z="' + i + '">'
      + (mode === 'zhth' ? '<span class="th">' + o.t + '</span>' : '<span>' + o.z + '</span>')
      + '</button>').join('') + '</div>'
      + '<div class="spfb" id="exFb"></div>';
  }
  body += '</div>';
  box.innerHTML = exScopeHtml(false) + '<div class="card exqcard">' + body + '</div>';
  exWireBar();
  const say = document.getElementById('exSay'); if(say) say.onclick = () => speakThai(q.w.t);
  if(mode === 'listen') speakThai(q.w.t); /* 听音题自动读；其余题型不读，避免泄露答案 */
  if(mode === 'tile') exWireTile(q);
  if(mode === 'type') exWireType(q);
  if(mode === 'listen' || mode === 'zhth'){
    box.querySelectorAll('.exopt').forEach(b => { b.onclick = () => exPickOpt(q, +b.dataset.z); });
  }
}
function exPickOpt(q, i){
  if(exLocked) return;
  exLocked = true;
  const ok = q.opts[i].t === q.w.t && q.opts[i].z === q.w.z;
  const box = document.getElementById('exBox');
  box.querySelectorAll('.exopt').forEach(x => x.disabled = true);
  const pickBtn = box.querySelector('.exopt[data-z="' + i + '"]');
  if(pickBtn) pickBtn.classList.add(ok ? 'ok' : 'no');
  if(!ok){
    const right = [...box.querySelectorAll('.exopt')].find(x => q.opts[+x.dataset.z].t === q.w.t);
    if(right) right.classList.add('ok');
  }
  exJudge(q, ok, false);
}
function exWireTile(q){
  const box = document.getElementById('exBox');
  const slotsEl = document.getElementById('exSlots');
  const tiles = [...box.querySelectorAll('.btile')];
  let picked = [];
  const paint = () => {
    slotsEl.innerHTML = picked.map((ti, pos) => '<span class="slot filled" data-pos="' + pos + '">' + tiles[ti].textContent + '</span>').join('')
      || '<span class="slot empty"></span>';
    slotsEl.querySelectorAll('.slot').forEach(sl => {
      sl.onclick = () => { if(exLocked) return; const pos = +sl.dataset.pos; tiles[picked[pos]].disabled = false; picked.splice(pos, 1); paint(); };
    });
  };
  paint();
  tiles.forEach(t => {
    t.onclick = () => {
      if(exLocked || t.disabled) return;
      t.disabled = true; picked.push(+t.dataset.ti); paint();
      if(picked.length === tiles.length){
        const attempt = picked.map(ti => tiles[ti].textContent).join('');
        exJudge(q, exNorm(attempt) === exNorm(q.w.t), false);
        speakThai(q.w.t);
      }
    };
  });
  const clr = document.getElementById('exClear');
  if(clr) clr.onclick = () => { if(exLocked) return; picked = []; tiles.forEach(x => x.disabled = false); paint(); };
  const hint = document.getElementById('exHint');
  if(hint) hint.onclick = () => { if(exLocked) return; exLocked = true; exHinted++; exJudge(q, false, true); };
}
function exWireType(q){
  const box = document.getElementById('exBox');
  const go = document.getElementById('exGo');
  const hint = document.getElementById('exHint');
  const inp = document.getElementById('exIn');
  if(inp){
    inp.onkeydown = ev => { if(ev.key === 'Enter'){ ev.preventDefault(); if(!exLocked) exJudge(q, exNorm(inp.value) === exNorm(q.w.t), false); } };
    setTimeout(() => { try{ inp.focus(); }catch(e){} }, 80);
  }
  if(go) go.onclick = () => { if(!exLocked) exJudge(q, exNorm(inp.value) === exNorm(q.w.t), false); };
  if(hint) hint.onclick = () => { if(exLocked) return; exLocked = true; exHinted++; exJudge(q, false, true); };
}
function exJudge(q, ok, revealed){
  exLocked = true;
  if(ok) exScore++;
  else {
    exMiss++;
    if(!exWrong.some(x => x.t === q.w.t)) exWrong.push(q.w);
    addWrong({ t: q.w.t, z: q.w.z, kind: '词汇练习', mode: (revealed ? '看答案 · ' : '') + (EX_LABEL[q.effMode] || '') });
  }
  const fb = document.getElementById('exFb');
  if(fb) fb.innerHTML = (ok ? '<span class="exok">✓ 答对了！</span>'
      : (revealed ? '<span class="exno">💡 答案：</span>' : '<span class="exno">✗ 答错了。</span>正确：'))
    + '<b class="th exans">' + q.w.t + '</b>' + (q.w.r ? ' <span class="hint">(' + q.w.r + ')</span>' : '')
    + '<span class="hint"> ' + q.w.z + '</span>';
  speakThai(q.w.t);
  clearTimeout(exTimer);
  exTimer = setTimeout(() => { exQi++; exQ(); }, ok ? 1300 : 2600);
}
function exFmtMs(ms){ const s = Math.round(ms / 1000); return Math.floor(s / 60) + ' 分 ' + (s % 60) + ' 秒'; }
function exDone(){
  const box = document.getElementById('exBox'); if(!box) return;
  const n = exSess.length, pct = n ? Math.round(exScore / n * 100) : 0;
  const elapsed = exT0 ? Date.now() - exT0 : 0;
  const per = n ? Math.round(elapsed / n / 1000) : 0;
  const face = pct >= 90 ? '🏆' : pct >= 70 ? '👏' : '💪';
  let html = exScopeHtml(true)
    + '<div class="card exhome exdone">'
    + '<div class="exhome-icon">' + face + '</div>'
    + '<div class="exhome-title big">' + pct + '%</div>'
    + '<div class="hint exdoneline">拼对/答对 <b>' + exScore + '</b> · 答错 ' + exMiss + ' · 看答案 ' + exHinted + ' · 共 ' + n + ' 词</div>'
    + '<div class="hint exdonemeta">⏱ 用时 ' + exFmtMs(elapsed) + ' · 平均每词 ' + per + ' 秒</div>'
    + '<button class="spchip solid exgo" id="exAgain">🔄 再来一轮</button> '
    + '<button class="spchip" id="exBack">↩ 返回</button>'
    + '</div>';
  if(exWrong.length){
    html += '<div class="card spwrong"><div class="spwrong-h">📝 本轮常错词 · ' + exWrong.length + ' 个（点 🔊 重听）</div>'
      + exWrong.map(w => '<div class="spwrong-row"><button class="spk" data-exw="' + w.t + '">🔊</button><span class="th">' + w.t + '</span><span class="spwrong-z">' + (w.z || '') + '</span></div>').join('')
      + '</div>';
  }
  box.innerHTML = html;
  exWireBar();
  document.getElementById('exAgain').onclick = exBegin;
  document.getElementById('exBack').onclick = exHome;
  box.querySelectorAll('.spwrong .spk').forEach(d => { d.onclick = () => speakThai(d.dataset.exw); });
}
