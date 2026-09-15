/* quiz.js —— 词汇测验：池子、出题、四种模式判分、拼词板、结算与常错词
   本文件由 泰语个人知识库.html 的内联脚本按行拆分而来，行为与原内联脚本一致；
   加载顺序见 HTML 底部的 <script src> 序列（顺序即原执行顺序）。 */
/* ============ 词汇测验（按课） ============ */
let lqSess = [], lqQi = 0, lqScore = 0, lqMiss = 0, lqLocked = false, lqSrc = 'all', lqMode = 'random', lqRoundMode = 'listen', lqWrong = [];
try{ lqSrc = localStorage.getItem('lqSrc') || 'all'; }catch(e){}
try{ lqMode = localStorage.getItem('lqMode') || 'random'; }catch(e){}
const LQ_MODES3 = ['listen', 'zhth', 'spell'];
const LQ_LABEL = { listen: '🔊 听音选义', zhth: '中→泰 选词', spell: '⌨️ 看义拼词', mix: '🔀 混合出题' };
function lqPool(){
  return allWords().filter(w => {
    if(lqSrc === 'all' || lqSrc === '__allshow__') return true;
    const k = srcOf(w);
    if(lqSrc === '__other__') return !COURSES.includes(courseOfKey(k));
    if(COURSES.includes(lqSrc)) return courseOfKey(k) === lqSrc;
    return k === lqSrc;
  }).filter(w => w.z && String(w.z).trim());
}
function lqShuffle(r){ for(let i = r.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); const t = r[i]; r[i] = r[j]; r[j] = t; } return r; }
function lqMakeQ(w, pool, mode){
  if(mode === 'spell') return { w, opts: [], mode };
  const wrongZ = lqShuffle(pool.filter(x => x.t !== w.t && x.z !== w.z)).slice(0, 3);
  let opts = lqShuffle([w].concat(wrongZ));
  if(mode === 'zhth'){
    const seen = new Set([w.t]); opts = [w];
    for(const x of lqShuffle(pool.filter(x => x.t !== w.t))){
      if(seen.has(x.t)) continue; seen.add(x.t); opts.push(x); if(opts.length >= 4) break;
    }
    if(opts.length < 4){
      for(const x of lqShuffle(allWords())){
        if(seen.has(x.t) || !x.z) continue; seen.add(x.t); opts.push(x); if(opts.length >= 4) break;
      }
    }
    opts = lqShuffle(opts);
  }
  return { w, opts, mode };
}
function lqBegin(){
  const pool = lqPool();
  const cands = LQ_MODES3.concat('mix');
  lqRoundMode = lqMode === 'random' ? cands[Math.floor(Math.random() * cands.length)] : lqMode;
  lqSess = lqShuffle(pool.slice()).map(w => lqMakeQ(w, pool, lqRoundMode));
  lqQi = 0; lqScore = 0; lqMiss = 0; lqWrong = [];
  lqQ();
}
function lqEnsure(){
  if(lqSess.length && lqQi < lqSess.length && !lqLocked) lqQ();
  else lqHome();
}
function lqScope(showCards){
  const cnts = countByLesson(allWords(), srcOf);
  if(lqSrc === 'all'){
    /* 一级：课程大类 */
    const cards = [courseCardHtml('☰', '全部词汇', [allWords().length + ' 词 · 立即开始'], 'lqsrc', '__startall__')];
    COURSES.forEach(c => {
      const ks = courseLessons(c);
      const n = ks.reduce((a,k) => a + (cnts[k]||0), 0);
      if(!n) return;
      const titles = ks.slice(0, 3).map(k => LESSON_ICONS[k] || k).join(' · ');
      const metas = [ks.length + ' 课 · ' + n + ' 词'];
      if(titles) metas.push(titles);
      cards.push(courseCardHtml((COURSE_ICON[c]||'📘'), c, metas, 'lqsrc', c));
    });
    const rest = lessonKeysAll().filter(k => !COURSES.includes(courseOfKey(k)) && cnts[k]);
    if(rest.length){
      cards.push(courseCardHtml('🗂', '其他 / 我的生词', [rest.length + ' 课 · ' + rest.reduce((a,k)=>a+(cnts[k]||0),0) + ' 词'], 'lqsrc', '__other__'));
    }
    return courseGridHtml('🎯 词汇测验 · 请选择课程大类', cards);
  }
  /* 二级：课文小类 */
  const isCourse = COURSES.includes(lqSrc);
  const label = lqSrc === '__other__' ? scopeLabel('__other__', LESSON_ICONS) : scopeLabel(lqSrc, LESSON_ICONS);
  let html = '<div class="readnavrow"><button class="spchip" data-lqsrc="__home__">← 选择课程大类</button><span class="badge">' + label + '</span><button class="spchip" id="lqReset">↺ 重新开始</button></div>';
  if(showCards){
    const ks = lessonKeysFor(lqSrc, lessonKeysAll, courseLessons);
    if(ks.some(k => cnts[k])){
      const cards = [];
      ks.forEach(k => {
        if(!cnts[k]) return;
        cards.push(lessonCardHtml(lqSrc === k, LESSON_ICONS[k] || ('📘 ' + k), (cnts[k]||0) + ' 词', 'lqsrc', k));
      });
      html += lessonCardsHtml(cards);
    }
  }
  return html;
}
function lqWireBar(){
  const box = document.getElementById('lquizBox'); if(!box) return;
  const rb = document.getElementById('lqReset'); if(rb) rb.onclick = lqBegin;
  box.querySelectorAll('[data-lqsrc]').forEach(b => {
    b.onclick = () => {
      const v = b.dataset.lqsrc;
      if(v === '__startall__'){ lqBegin(); return; }
      if(v === '__home__'){
        if(lqSrc !== 'all'){ lqSrc = 'all'; try{ localStorage.setItem('lqSrc', lqSrc); }catch(e){} }
        lqSess = []; lqQi = 0; lqScore = 0; lqMiss = 0;
        lqHome();
        return;
      }
      if(v === lqSrc) return;
      lqSrc = v;
      try{ localStorage.setItem('lqSrc', lqSrc); }catch(e){}
      if(COURSES.includes(v) || v === '__other__') lqHome();
      else lqBegin();
    };
  });
}
function lqHome(){
  const box = document.getElementById('lquizBox'); if(!box) return;
  const MODES = [['random', '🎲 每轮随机'], ['listen', '🔊 听音选义'], ['zhth', '中→泰 选词'], ['spell', '⌨️ 看义拼词'], ['mix', '🔀 混合出题']];
  box.innerHTML = lqScope(true)
    + '<div class="card spcard" style="text-align:center;">'
    + '<div style="font-size:44px;margin:10px 0;">🎯</div>'
    + '<div style="font-size:18px;font-weight:700;">词汇测验 · 共 ' + lqPool().length + ' 词</div>'
    + '<div class="spline" style="margin:12px 0 6px;">检验方式</div>'
    + '<div class="bank" id="lqModes">' + MODES.map(m => '<button class="spchip' + (lqMode === m[0] ? ' on' : '') + '" data-lqm="' + m[0] + '">' + m[1] + '</button>').join('') + '</div>'
    + '<div class="hint" style="margin:10px 0 14px;">🔊 听音选义：只听发音选中文释义 · 中→泰：看中文选出泰语词 · 看义拼词：把泰语词拼出来 · 🔀 混合：每题随机换 · 🎲 每轮随机：每轮抽一种</div>'
    + '<button class="spchip solid" id="lqStart">▶ 开始测验</button>'
    + '</div>';
  lqWireBar();
  box.querySelectorAll('[data-lqm]').forEach(b => {
    b.onclick = () => {
      lqMode = b.dataset.lqm;
      try{ localStorage.setItem('lqMode', lqMode); }catch(e){}
      box.querySelectorAll('[data-lqm]').forEach(x => x.classList.toggle('on', x === b));
    };
  });
  const st = document.getElementById('lqStart'); if(st) st.onclick = lqBegin;
}
function lqQ(){
  clearTimeout(lqTimer);
  const box = document.getElementById('lquizBox'); if(!box) return;
  if(lqQi >= lqSess.length){ lqDone(); return; }
  const q = lqSess[lqQi];
  const mode = q.mode === 'mix' ? ['listen','zhth','spell'][Math.floor(Math.random()*3)] : q.mode;
  q.effMode = mode;
  lqLocked = false;
  let body = '';
  if(mode === 'spell'){
    /* 看义拼词：中文释义 + 打乱音节块 */
    const tiles = lqShuffle(lqTiles(q.w.t));
    body = '<div class="spzh">' + q.w.z + '</div>'
      + '<div class="sptip">把下面打乱的音节块按正确顺序拼成泰语词</div>'
      + '<div class="slots" id="lqSlots"></div>'
      + '<div class="bank">' + tiles.map((t, i) => '<button class="btile" data-ti="' + i + '">' + t + '</button>').join('') + '</div>'
      + '<div class="spbtns"><button class="spchip" id="lqSay">🔊 听发音</button><button class="spchip" id="lqClear">↩ 清空</button><button class="spchip" id="lqHint">💡 显示答案</button></div>'
      + '<div class="spfb" id="lqFb"></div>';
    box.innerHTML = lqScope(false)
      + '<div class="card spcard">'
      + '<div class="spline"><span>第 ' + (lqQi + 1) + ' / ' + lqSess.length + ' 题</span><span>·</span><span>得分 ' + lqScore + '</span><span>·</span><span>' + (LQ_LABEL[lqRoundMode] || '') + '</span>'
      + '</div>'
      + body + '</div>';
    lqWireBar();
    lqWireSpell(q);
  } else {
    body = '<div class="spzh">' + (mode === 'listen' ? '🔊 请听发音' : q.w.z) + '</div>'
      + (mode === 'listen' ? '<button class="spchip sm" id="lqSay" style="margin:6px 0;">🔊 再听一遍</button>' : '')
      + '<div class="sptip">' + (mode === 'listen' ? '从下面 4 个释义中选出正确的' : '从下面 4 个泰语词中选出正确的') + '</div>'
      + '<div id="lqOpts">' + q.opts.map((o, i) => '<button class="dqopt" data-z="' + i + '">' + (mode === 'zhth' ? '<span class="th" style="font-size:20px;">' + o.t + '</span>' : o.z) + '</button>').join('') + '</div>'
      + '<div class="spfb" id="lqFb"></div>';
    box.innerHTML = lqScope(false)
      + '<div class="card spcard">'
      + '<div class="spline"><span>第 ' + (lqQi + 1) + ' / ' + lqSess.length + ' 题</span><span>·</span><span>得分 ' + lqScore + '</span><span>·</span><span>' + (LQ_LABEL[lqRoundMode] || '') + '</span>'
      + '<button class="spchip sm" id="lqSay">🔊 再听一遍</button></div>'
      + body + '</div>';
    lqWireBar();
    document.getElementById('lqSay').onclick = () => speakThai(q.w.t);
    box.querySelectorAll('#lqOpts .dqopt').forEach(b => {
      b.onclick = () => {
        if(lqLocked) return;
        lqLocked = true;
        const pick = q.opts[+b.dataset.z];
        const ok = pick.t === q.w.t && pick.z === q.w.z;
        box.querySelectorAll('#lqOpts .dqopt').forEach(x => x.disabled = true);
        b.classList.add(ok ? 'ok' : 'no');
        if(ok) lqScore++; else { lqMiss++; if(!lqWrong.some(x => x.t === q.w.t)) lqWrong.push(q.w); addWrong({ t: q.w.t, z: q.w.z, kind: '词汇测验', mode: LQ_LABEL[lqRoundMode] || '' }); }
        if(!ok){
          const right = [...box.querySelectorAll('#lqOpts .dqopt')].find(x => q.opts[+x.dataset.z].t === q.w.t);
          if(right) right.classList.add('ok');
        }
        document.getElementById('lqFb').innerHTML = (ok ? '✓ 答对了' : '✗ 答错了。正确答案：')
          + '　<span class="th">' + q.w.t + '</span>' + (q.w.r ? ' <span class="hint">(' + q.w.r + ')</span>' : '')
          + '<span class="hint"> ' + q.w.z + '</span>';
        setTimeout(() => { lqQi++; lqQ(); }, ok ? 1100 : 2400);
      };
    });
    if(mode === 'listen') speakThai(q.w.t); /* 中→泰 模式不自动读题干，避免泄露答案 */
  }
}
function lqDone(){
  const box = document.getElementById('lquizBox'); if(!box) return;
  const n = lqSess.length, pct = n ? Math.round(lqScore / n * 100) : 0;
  const face = pct >= 85 ? '🏆' : pct >= 60 ? '👏' : '💪';
  let html = lqScope(true)
    + '<div class="card spcard" style="text-align:center;">'
    + '<div style="font-size:44px;margin:10px 0;">' + face + '</div>'
    + '<div style="font-size:20px;font-weight:700;">' + pct + '% 正确</div>'
    + '<div class="hint" style="margin:8px 0 14px;">' + lqScore + ' 对 · ' + lqMiss + ' 错 · 共 ' + n + ' 词</div>'
    + '<button class="spchip solid" id="lqAgain">🔄 再来一轮</button> '
    + '<button class="spchip" id="lqBack">↩ 返回</button>'
    + '</div>';
  if(lqWrong.length){
    html += '<div class="card spwrong"><div class="spwrong-h">📝 本轮常错词 · ' + lqWrong.length + ' 个（点 🔊 重听）</div>'
      + lqWrong.map(w => '<div class="spwrong-row"><button class="spk" data-lqw="' + w.t + '">🔊</button><span class="th">' + w.t + '</span><span class="spwrong-z">' + (w.z || '') + '</span></div>').join('')
      + '</div>';
  }
  box.innerHTML = html;
  lqWireBar();
  document.getElementById('lqAgain').onclick = lqBegin;
  document.getElementById('lqBack').onclick = lqHome;
  box.querySelectorAll('.spwrong .spk').forEach(d => { d.onclick = () => speakThai(d.dataset.lqw); });
}
function lqTiles(w){
  /* 复用拼写页的分词逻辑：先按字形切，再合并纯元音/声调符号 */
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
function lqWireSpell(q){
  const box = document.getElementById('lquizBox'); if(!box) return;
  const say = document.getElementById('lqSay'); if(say) say.onclick = () => speakThai(q.w.t);
  const slotsEl = document.getElementById('lqSlots');
  let picked = [];
  const tiles = [...box.querySelectorAll('.btile')];
  function paint(){
    slotsEl.innerHTML = picked.map((ti, pos) => '<span class="slot filled" data-pos="' + pos + '">' + tiles[ti].textContent + '</span>').join('')
      || '<span class="slot empty" style="min-width:120px;"></span>';
    slotsEl.querySelectorAll('.slot').forEach(sl => {
      sl.onclick = () => { if(lqLocked) return; const pos = +sl.dataset.pos; tiles[picked[pos]].disabled = false; picked.splice(pos, 1); paint(); };
    });
  }
  paint();
  tiles.forEach(t => {
    t.onclick = () => {
      if(lqLocked || t.disabled) return;
      t.disabled = true; picked.push(+t.dataset.ti); paint();
      if(picked.length === tiles.length) lqJudgeSpell(q, picked, tiles);
    };
  });
  const clr = document.getElementById('lqClear');
  if(clr) clr.onclick = () => { if(lqLocked) return; picked = []; tiles.forEach(x => x.disabled = false); paint(); };
  const hint = document.getElementById('lqHint');
  if(hint) hint.onclick = () => { if(lqLocked) return; lqLocked = true; lqMiss++; if(!lqWrong.some(x => x.t === q.w.t)) lqWrong.push(q.w); addWrong({ t: q.w.t, z: q.w.z, kind: '词汇测验·拼词', mode: '看答案' }); lqSpellFb(q, false, true); lqAdvance(2600); };
}
function lqSpellFb(q, ok, revealed){
  const fb = document.getElementById('lqFb'); if(!fb) return;
  fb.innerHTML = (ok ? '✓ 拼对了' : (revealed ? '💡 正确拼写：' : '✗ 拼错了。正确拼写：'))
    + '<span class="th">' + q.w.t + '</span>' + (q.w.r ? ' <span class="hint">(' + q.w.r + ')</span>' : '')
    + '<span class="hint"> ' + q.w.z + '</span>';
}
function lqJudgeSpell(q, picked, tiles){
  lqLocked = true;
  const attempt = picked.map(ti => tiles[ti].textContent).join('');
  const ok = attempt === q.w.t;
  if(ok) lqScore++; else { lqMiss++; if(!lqWrong.some(x => x.t === q.w.t)) lqWrong.push(q.w); addWrong({ t: q.w.t, z: q.w.z, kind: '词汇测验·拼词', mode: '拼错' }); }
  lqSpellFb(q, ok, false);
  speakThai(q.w.t);
  lqAdvance(ok ? 1300 : 2600);
}
function lqAdvance(ms){
  clearTimeout(lqTimer);
  lqTimer = setTimeout(() => { lqQi++; lqQ(); }, ms);
}
let lqTimer = null;

