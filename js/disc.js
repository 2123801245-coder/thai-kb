/* disc.js —— 辨析卡片两级导航 + 辨析测验
   本文件由 泰语个人知识库.html 的内联脚本按行拆分而来，行为与原内联脚本一致；
   加载顺序见 HTML 底部的 <script src> 序列（顺序即原执行顺序）。 */
/* ============ 辨析（两级导航：分类大类 → 卡片索引 + 卡片内容） ============ */
let discGroup = null; /* null=分类选择页；'__allshow__' 或分组名 */
function discGroups(){
  const g = {};
  DISC.forEach((c, i) => { const k = c.g || '辨析'; (g[k] = g[k] || []).push(i); });
  return g;
}
function discCardHtml(c, i){
  let items = '';
  c.items.forEach(it => {
    items += '<div class="ditem">'
      + '<div class="dw th">' + it.w + '</div>'
      + '<div class="dz">' + it.z + '</div>'
      + (it.ex ? '<div class="dex"><span class="th">' + it.ex + '</span><button class="spk" data-ex="' + encodeURIComponent(it.ex) + '">🔊</button></div>' : '')
      + (it.ez ? '<div class="dez">' + it.ez + '</div>' : '')
      + '</div>';
  });
  return '<div class="pitem" style="page-break-inside:avoid;" id="dcard-' + i + '">'
    + '<div class="card dcard">'
    + '<div class="dhead"><span class="dtitle">' + c.t + '</span><span class="dgrp">' + (c.g || '辨析') + '</span></div>'
    + items
    + (c.d ? '<div class="ddiff">💡 区别：<b>' + c.d + '</b></div>' : '')
    + '</div>'
    + '</div>';
}
function renderDisc(){
  const box = $1('#discBox');
  if(!box) return;
  const g = discGroups();
  const keys = Object.keys(g);
  if(!discGroup){
    /* 一级：分类大类 */
    let html = '<div class="readcrumb">📐 易混词辨析 · 请选择分类</div><div class="coursegrid">';
    html += '<button class="coursecard" data-dg="__allshow__"><span class="cc-icon">☰</span><span class="cc-name">全部辨析</span><span class="cc-meta">' + DISC.length + ' 组卡片</span></button>';
    keys.forEach(k => {
      html += '<button class="coursecard" data-dg="' + k + '"><span class="cc-icon">📐</span><span class="cc-name">' + k + '</span><span class="cc-meta">' + g[k].length + ' 组卡片</span></button>';
    });
    html += '</div>';
    box.innerHTML = html;
    box.querySelectorAll('[data-dg]').forEach(b => {
      b.onclick = () => { discGroup = b.dataset.dg; renderDisc(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    });
    return;
  }
  /* 二级：卡片索引 + 卡片内容 */
  const idxs = discGroup === '__allshow__' ? DISC.map((c, i) => i) : (g[discGroup] || []);
  let html = '<div class="readnavrow"><button class="btn ghost2 sm readback" id="discBack1">← 选择分类</button><span class="badge">' + (discGroup === '__allshow__' ? '☰ 全部辨析' : discGroup) + '</span><span class="badge">' + idxs.length + ' 组</span></div>';
  if(idxs.length > 1){
    html += '<div class="lessoncards">';
    idxs.forEach(i => {
      const c = DISC[i];
      html += '<button class="lessoncard" data-dc="' + i + '">'
        + '<span class="lc-title">' + c.t + '</span>'
        + '<span class="lc-meta">' + c.items.length + ' 个词' + (c.d ? ' · 含区别讲解' : '') + '</span>'
        + '</button>';
    });
    html += '</div>';
  }
  idxs.forEach(i => { html += discCardHtml(DISC[i], i); });
  box.innerHTML = html || '<div class="noteinfo">还没有辨析内容，可在 data/disc.json 里添加。</div>';
  const bk = document.getElementById('discBack1');
  if(bk) bk.onclick = () => { discGroup = null; renderDisc(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  box.querySelectorAll('.lessoncard[data-dc]').forEach(b => {
    b.onclick = () => {
      const el = document.getElementById('dcard-' + b.dataset.dc);
      if(el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  });
  box.querySelectorAll('.spk[data-ex]').forEach(b => {
    b.onclick = () => speakThai(decodeURIComponent(b.dataset.ex));
  });
}

/* ============ 辨析测验 ============ */
let dqSess = [], dqi = 0, dqScore = 0, dqWrong = 0, dqLock = false, dqOn = false;
function dqNorm(w){ return w.replace(/[…\. ]+$/, ''); }
function dqFind(ex, w){
  let i = ex.indexOf(w);
  if(i >= 0) return [i, w];
  const w2 = dqNorm(w);
  if(w2 && (i = ex.indexOf(w2)) >= 0) return [i, w2];
  const w3 = w2.replace(/\s+/g, '');
  if(w3 && w3 !== w2 && (i = ex.indexOf(w3)) >= 0) return [i, w3];
  return null;
}
function dqShuffle(a){ const r = a.slice(); for(let i = r.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); const t = r[i]; r[i] = r[j]; r[j] = t; } return r; }
function dqBuild(){
  const groupWords = {};
  DISC.forEach(c => { (groupWords[c.g] = groupWords[c.g] || []).push(...c.items.map(it => dqNorm(it.w))); });
  const bank = [];
  DISC.forEach(c => {
    c.items.forEach(it => {
      if(!it.ex) return;
      const m = dqFind(it.ex, it.w);
      if(!m) return;
      let opts = [...new Set(c.items.map(x => dqNorm(x.w)))].filter(Boolean);
      if(opts.length < 2) opts = [...new Set(groupWords[c.g])].filter(Boolean);
      if(opts.length < 2) return;
      bank.push({ ex: it.ex, ez: it.ez || '', ans: m[1], opts, card: c.t });
    });
  });
  return dqShuffle(bank);
}
function dqStart(){
  dqSess = dqBuild();
  if(!dqSess.length){ toast('没有可测验的例句'); return; }
  dqi = 0; dqScore = 0; dqWrong = 0; dqOn = true;
  $1('#dqStart').style.display = 'none';
  $1('#dqExit').style.display = '';
  $1('#dqHint').textContent = '共 ' + dqSess.length + ' 题 · 选词填空';
  $1('#discBox').style.display = 'none';
  $1('#dqBox').style.display = '';
  dqQ();
}
function dqExit(){
  dqOn = false; clearTimeout(window.dqTimer);
  $1('#dqStart').style.display = '';
  $1('#dqExit').style.display = 'none';
  $1('#dqHint').textContent = '从易混词里选词填空，测测你分得清吗';
  $1('#dqBox').style.display = 'none';
  $1('#discBox').style.display = '';
}
function dqQ(){
  const box = $1('#dqBox');
  if(dqi >= dqSess.length){
    const n = dqSess.length, pct = Math.round(dqScore / n * 100);
    box.innerHTML = '<div class="card dcard" style="text-align:center;">'
      + '<div class="big" style="font-size:44px;">' + (pct >= 90 ? '🏆' : pct >= 70 ? '👏' : '💪') + '</div>'
      + '<div style="font-size:26px;font-weight:700;color:#2f7f77;margin:6px 0;">' + pct + '%</div>'
      + '<div style="color:#6b675c;margin-bottom:14px;">选对 <b>' + dqScore + '</b> / ' + n + ' 题 · 答错 ' + dqWrong + ' 次</div>'
      + '<button class="btn" id="dqAgain">🔄 再来一轮</button> '
      + '<button class="btn ghost2" id="dqBack">↩ 返回卡片</button>'
      + '</div>';
    $1('#dqAgain').onclick = dqStart;
    $1('#dqBack').onclick = dqExit;
    return;
  }
  const q = dqSess[dqi];
  dqLock = false;
  const [i, shown] = q.ans ? [q.ex.indexOf(dqNorm(q.ans)) >= 0 ? q.ex.indexOf(q.ans) : q.ex.indexOf(dqNorm(q.ans)), null] : [-1, null];
  let start = q.ex.indexOf(q.ans);
  if(start < 0) start = q.ex.indexOf(dqNorm(q.ans));
  const gapHtml = '<span class="dqgap" id="dqGap">____</span>';
  const marked = start >= 0
    ? q.ex.slice(0, start) + gapHtml + q.ex.slice(start + q.ans.length)
    : gapHtml + ' ' + q.ex;
  const opts = dqShuffle(q.opts.map(o => ({ o, isAns: o === q.ans || dqNorm(o) === dqNorm(q.ans) })));
  box.innerHTML = '<div class="card dcard">'
    + '<div class="phead"><span class="badge">' + q.card + '</span><span class="pno">第 ' + (dqi + 1) + ' / ' + dqSess.length + ' 题 · 得分 ' + dqScore + '</span></div>'
    + '<div class="hint" style="margin-bottom:8px;">选词填空：这个句子里该用哪个词？</div>'
    + '<div class="pex" style="font-size:18px;"><span class="th">' + marked + '</span><button class="spk" id="dqSay">🔊</button></div>'
    + (q.ez ? '<div class="pez">' + q.ez + '</div>' : '')
    + '<div style="margin-top:14px;">'
    + opts.map((x, k) => '<button class="dqopt th" data-k="' + k + '">' + x.o + '</button>').join('')
    + '</div>'
    + '<div class="dqfb" id="dqFb"></div>'
    + '</div>';
  $1('#dqSay').onclick = () => speakThai(q.ex);
  box.querySelectorAll('.dqopt').forEach(b => {
    b.onclick = () => {
      if(dqLock) return;
      dqLock = true;
      const pick = opts[+b.dataset.k];
      const good = pick.isAns;
      box.querySelectorAll('.dqopt').forEach(x => {
        x.disabled = true;
        const o = opts[+x.dataset.k];
        if(o.isAns) x.classList.add('ok');
        else if(x === b) x.classList.add('no');
      });
      const gap = document.getElementById('dqGap');
      if(gap){ gap.textContent = q.ans; gap.classList.add(good ? 'ok' : 'no'); }
      const fb = document.getElementById('dqFb');
      if(fb) fb.innerHTML = good
        ? '<span style="color:var(--teal);font-weight:700;">✓ 答对了！</span> ' + q.ans + ' —— 用得正确'
        : '<span style="color:var(--red);font-weight:700;">✗ 答错了。</span> 正确答案：<b style="font-size:17px;">' + q.ans + '</b>';
      speakThai(q.ex);
      if(good) dqScore++; else { dqWrong++; addWrong({ t: q.ans, z: '', kind: '辨析测验', mode: '选词填空', src: q.card, ex: q.ex }); }
      window.dqTimer = setTimeout(() => { dqi++; dqQ(); }, good ? 1400 : 2600);
    };
  });
}
$1('#dqStart').addEventListener('click', dqStart);
$1('#dqExit').addEventListener('click', dqExit);

