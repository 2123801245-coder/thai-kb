/* flash.js —— 刷卡背单词（百词斩式）：正面只给泰语和发音，翻面看释义/词性/例句，
   四档反馈写回简化版 SM-2 的调度，下一次什么时候再出现由它决定。

   与已有模块的关系：
     · 掌握度仍写 kb_cls（与词表、复习模式同源，首页「掌握度」跟着动）
     · 每判一个词记一次今日进度 kb_today / kb_log（首页「本周复习」柱状图用它）
     · 新词与复习词按 1:3 混排，一组 20 词，学满一组往 kb_fc_log 记一条
   调度存在 kb_fc：{ 泰文: {e:难易, i:间隔天, n:连对次数, d:到期日序号, l:上次档位} } */
const KB_FLASH_N = 20;                    /* 一组 20 词 */
const KB_FLASH_RATIO = 3;                 /* 复习 : 新词 = 3 : 1 */
let fcQ = [], fcI = 0, fcShown = false, fcStat = { 0: 0, 1: 0, 2: 0, 3: 0 }, fcOn = false;
let fcState = {};
try { fcState = JSON.parse(localStorage.getItem('kb_fc') || '{}') || {}; } catch (e) { fcState = {}; }

function fcToday() { return Math.floor(Date.now() / 86400000); }        /* 天序号：跨时区/夏令时都稳 */
function fcDate() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function fcSave() { try { localStorage.setItem('kb_fc', JSON.stringify(fcState)); } catch (e) {} }
function fcRec(t) { return fcState[t] || (fcState[t] = { e: 2.5, i: 0, n: 0, d: 0, l: -1 }); }
function fcDue(t) { const r = fcState[t]; return !!r && r.n > 0 && r.d <= fcToday(); }
function fcFresh(t) { return !fcState[t] || fcState[t].n === 0 && fcState[t].l === -1; }

/* 一组词：到期复习词按「最该先复习」排（到期早的、难易低的先来），再用未学过的词补齐，
   最后每隔 4 个插一个新词，让新词均匀分布而不是堆在开头。 */
function fcBuildQueue() {
  const words = allWords();
  const due = words.filter(w => fcDue(w.t)).sort((a, b) => (fcState[a.t].d - fcState[b.t].d) || (fcState[a.t].e - fcState[b.t].e));
  const fresh = words.filter(w => fcFresh(w.t));
  const wantNew = Math.round(KB_FLASH_N / (KB_FLASH_RATIO + 1));
  let picks = [];
  const rev = due.slice(0, KB_FLASH_N - wantNew);
  const nw = fresh.slice(0, wantNew);
  const out = [];
  const step = Math.max(1, Math.floor(KB_FLASH_N / Math.max(1, nw.length)));
  let ri = 0;
  for (let i = 0; i < KB_FLASH_N; i++) {
    const wantFresh = nw.length && (i % step === step - 1) && (nw.length > ri % 2);
    if (wantFresh || ri >= rev.length) {
      if (out.length + nw.length <= KB_FLASH_N && nw.length) out.push(nw.shift());
      else if (ri < rev.length) out.push(rev[ri++]);
    } else out.push(rev[ri++]);
  }
  /* 不够 20 词时用剩下的复习词补满 */
  const seen = new Set(out.map(w => w.t));
  for (const w of due.concat(fresh)) { if (out.length >= KB_FLASH_N) break; if (!seen.has(w.t)) { out.push(w); seen.add(w.t); } }
  return out.filter(Boolean).slice(0, KB_FLASH_N);
}

function fcStart() {
  fcQ = fcBuildQueue();
  fcI = 0; fcShown = false; fcOn = true; fcStat = { 0: 0, 1: 0, 2: 0, 3: 0 };
  if (!fcQ.length) { fcEnd(true); return; }
  fcRender();
}
/* 从标签栏进来：还有没判完的组就接着那一组，判完了才新开一组 */
function fcEnsure() {
  if (fcOn && fcI < fcQ.length) { fcRender(); return; }
  fcStart();
}
function fcExit() {
  fcOn = false;
  const t = document.querySelector('.tab[data-v="home"]'); if (t) t.click();
}
function fcExplain() { return fcQ.length ? '这组 ' + fcQ.length + ' 词 · 新词与复习词 1:' + KB_FLASH_RATIO + ' 混排' : ''; }

function fcRender() {
  const box = document.getElementById('flashBox'); if (!box) return;
  if (fcI >= fcQ.length) { fcEnd(false); return; }
  fcShown = false;
  const w = fcQ[fcI];
  const rec = fcRec(w.t);
  const exs = (w.ex || []).slice(0, 2);
  const dueTag = rec.n ? (rec.d <= fcToday() ? '复习' : '新') : (fcState[w.t] && rec.l >= 0 ? '复习' : '新词');
  box.innerHTML =
    '<div class="fc-top">'
    + '<button class="btn ghost2 sm" id="fcExit" type="button">✕ 结束</button>'
    + '<div class="fc-pg"><i style="width:' + Math.round(fcI / fcQ.length * 100) + '%"></i></div>'
    + '<span class="fc-n">' + (fcI + 1) + ' / ' + fcQ.length + '</span>'
    + '</div>'
    + '<div class="fc-stage" id="fcStage">'
    +   '<div class="fc-card" id="fcCard" role="button" tabindex="0" aria-label="卡片，空格翻面">'
    +     '<div class="fc-face fc-front">'
    +       '<div class="fc-tag"><span>' + kbEsc(srcOf(w)) + '</span><span class="fc-kind">' + dueTag + '</span></div>'
    +       '<div class="fc-th th">' + kbEsc(w.t) + '</div>'
    +       '<button class="fc-spk" id="fcSpk" type="button" aria-label="播放「' + kbEsc(w.t) + '」的发音">🔊<span class="fc-wave" aria-hidden="true"><i></i><i></i><i></i><i></i></span></button>'
    +       '<div class="fc-hint">点击或上滑看释义 · 空格翻面</div>'
    +     '</div>'
    +     '<div class="fc-face fc-back">'
    +       '<div class="fc-th-sm th">' + kbEsc(w.t) + '</div>'
    +       '<div class="fc-mean">'
    +         (w.p ? '<span class="fc-p">' + kbEsc(w.p) + '</span>' : '')
    +         '<span class="fc-z">' + kbEsc(w.z || '（暂无释义）') + '</span>'
    +       '</div>'
    +       (w.r ? '<div class="fc-r">读音：' + kbEsc(w.r) + '</div>' : '')
    +       (exs.length ? '<ol class="fc-ex">' + exs.map((p, k) =>
              '<li><span class="fc-ext th">' + kbEsc(p[0]) + '</span><span class="fc-exz">' + kbEsc(p[1] || '') + '</span>'
              + '<button class="fc-exspk" type="button" data-ex="' + kbEsc(p[0]) + '" data-k="' + k + '" aria-label="播放例句 ' + (k + 1) + ' 的发音">🔊</button></li>'
            ).join('') + '</ol>' : '<div class="fc-noex">这条例句暂时没有，先记词义。</div>')
    +       '<div class="fc-meta">下次出现：' + fcNextLabel(rec) + '</div>'
    +     '</div>'
    +   '</div>'
    + '</div>'
    + '<div class="fc-grades" id="fcGrades" aria-label="四档反馈">'
    +   '<button class="fc-g g0" type="button" data-g="0" aria-label="不认识"><b>不认识</b><i>1 天后</i></button>'
    +   '<button class="fc-g g1" type="button" data-g="1" aria-label="模糊"><b>模糊</b><i>1–3 天</i></button>'
    +   '<button class="fc-g g2" type="button" data-g="2" aria-label="认识"><b>认识</b><i>按间隔递增</i></button>'
    +   '<button class="fc-g g3" type="button" data-g="3" aria-label="很熟"><b>很熟</b><i>间隔更长</i></button>'
    + '</div>'
    + '<div class="fc-foot"><span id="fcStat">' + fcExplain() + '</span><span class="fc-keys">← → 切换 · 空格翻面 · 1–4 评价</span></div>'
    + '<div class="fc-live" id="fcLive" aria-live="polite"></div>';

  const card = document.getElementById('fcCard');
  const flip = () => fcFlip();
  card.onclick = e => { if (!e.target.closest('button')) flip(); };
  card.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); flip(); } };
  document.getElementById('fcExit').onclick = fcExit;
  document.getElementById('fcSpk').onclick = e => { e.stopPropagation(); fcSpeak(w.t, 'fcSpk'); };
  box.querySelectorAll('.fc-exspk').forEach(b => { b.onclick = e => { e.stopPropagation(); fcSpeak(b.dataset.ex, b); }; });
  box.querySelectorAll('#fcGrades .fc-g').forEach(b => { b.onclick = () => fcGrade(+b.dataset.g); });
  fcBindSwipe(card);
  fcPaintSpkState(w.t);
}

/* 播放：音源与降级都交给 KB.audio，这里只负责把「加载中 / 失败」画在按钮上 */
function fcSpeak(text, btnId) {
  const btn = typeof btnId === 'string' ? document.getElementById(btnId) : btnId;
  const live = document.getElementById('fcLive');
  const setState = (st) => {
    if (btn) {
      btn.classList.toggle('is-loading', st === 'loading');
      btn.classList.toggle('is-playing', st === 'playing' || st === 'fallback');
      btn.classList.toggle('is-dead', st === 'failed');
    }
    if (live) live.textContent = st === 'loading' ? '正在加载发音…' : st === 'failed' ? '这条没有内置发音' : '';
  };
  if (!window.KB || !KB.audio) { setState('failed'); return; }
  KB.audio.play(text, { onState: setState });
}
function fcPaintSpkState(text) {
  const btn = document.getElementById('fcSpk'); if (!btn) return;
  const ok = window.KB && KB.audio && KB.audio.ready(text);
  btn.classList.toggle('is-dead', !ok);
  if (!ok) btn.title = '这条没有内置发音（会退到系统语音）';
}
function fcFlip() {
  if (fcShown) { fcShown = false; const c = document.getElementById('fcCard'); if (c) c.classList.remove('flip'); return; }
  fcShown = true;
  const c = document.getElementById('fcCard'); if (c) c.classList.add('flip');
  const w = fcQ[fcI];
  if (w) fcSpeak(w.t, 'fcSpk');                 /* 翻面自动读一遍，和百词斩一致 */
}
/* 手机上滑 = 翻面；阈值 36px，只认纵向，避免和横向滚动打架 */
function fcBindSwipe(card) {
  if (!card) return;
  let y0 = null, x0 = null;
  card.addEventListener('touchstart', e => { const t = e.touches[0]; y0 = t.clientY; x0 = t.clientX; }, { passive: true });
  card.addEventListener('touchend', e => {
    if (y0 === null) return;
    const t = e.changedTouches[0], dy = t.clientY - y0, dx = t.clientX - x0;
    y0 = null; x0 = null;
    if (dy < -36 && Math.abs(dy) > Math.abs(dx) * 1.4) { e.preventDefault(); fcFlip(); }
  }, { passive: false });
}

/* 简化 SM-2：四档 → 间隔与难易度
   0 不认识：间隔清零、难易 -0.20、明天再来（本组内排到队尾再看一次）
   1 模糊：  1 天，难易 -0.15，连对清零
   2 认识：  第 1 次 1 天 → 第 2 次 3 天 → 之后 间隔×难易
   3 很熟：  第 1 次 3 天 → 第 2 次 7 天 → 之后 间隔×难易×1.3，难易 +0.10（上限 3.0） */
function fcSm2(rec, g) {
  const e0 = rec.e || 2.5;
  let e = e0, i = rec.i || 0, n = rec.n || 0;
  if (g === 0) { e = Math.max(1.3, e0 - 0.20); i = 0; n = 0; }
  else if (g === 1) { e = Math.max(1.3, e0 - 0.15); i = 1; n = 0; }
  else if (g === 2) { n += 1; i = n <= 1 ? 1 : (n === 2 ? 3 : Math.max(1, Math.round(i * e))); }
  else { n += 1; e = Math.min(3.0, e0 + 0.10); i = n <= 1 ? 3 : (n === 2 ? 7 : Math.max(1, Math.round(i * e * 1.3))); }
  return { e: Math.round(e * 100) / 100, i, n, d: fcToday() + i, l: g };
}
function fcNextLabel(rec) {
  const sim = fcSm2(rec, Math.max(0, (rec.l < 0 ? 2 : rec.l)));
  return sim.i <= 0 ? '明天' : sim.i === 1 ? '明天' : sim.i + ' 天后';
}
function fcGrade(g) {
  if (!fcShown) { fcFlip(); return; }          /* 还没翻面就按了评分：先翻面，别让人凭印象打分 */
  const w = fcQ[fcI]; if (!w) return;
  const rec = fcRec(w.t);
  const next = fcSm2(rec, g);
  fcState[w.t] = next;
  fcSave();
  /* 与词表同源：0→✗ 未掌握(3)，1→◔ 需复习(2)，2/3→✓ 已掌握(1) */
  CLS[w.t] = g === 0 ? 3 : g === 1 ? 2 : 1;
  saveCls();
  kbBumpToday(1);                              /* 今日进度 + 按天日志，首页本周柱状图跟着长 */
  fcStat[g]++;
  const live = document.getElementById('fcLive');
  if (live) live.textContent = '已记：' + ['不认识', '模糊', '认识', '很熟'][g] + '，' + (next.i ? next.i + ' 天后再见' : '本组稍后再看');
  /* 不认识 / 模糊：本组内队尾再排一次，当天就能再见一面 */
  if (g <= 1) fcQ.push(w);
  fcI++;
  if (fcI >= fcQ.length) fcEnd(false); else fcRender();
}
function fcEnd(done) {
  const box = document.getElementById('flashBox'); if (!box) return;
  const total = Object.values(fcStat).reduce((a, b) => a + b, 0);
  const okN = fcStat[2] + fcStat[3];
  if (total >= KB_FLASH_N) fcLogSession(total);
  const mastered = Object.values(fcState).filter(r => r.n >= 2).length;
  box.innerHTML =
    '<div class="fc-end">'
    + (done ? '<h3>全部复习完了 🎉</h3><p class="fc-sub">今天没有到期该复习的词，明天再来。</p>'
      : '<h3>这一组完了</h3>'
        + '<div class="fc-nums">'
        + '<div><b>' + total + '</b><span>本组词数</span></div>'
        + '<div><b>' + Math.round(okN / Math.max(1, total) * 100) + '%</b><span>认识 / 很熟</span></div>'
        + '<div><b>' + mastered + '</b><span>累计熟练词</span></div>'
        + '</div>'
        + '<p class="fc-sub">不认识的词已经排到本组后面再看一次，明天的安排也写进调度了。</p>')
    + '<div class="fc-ends"><button class="btn" id="fcAgain" type="button">再来一组</button>'
    + '<button class="btn ghost2" id="fcHome" type="button">回首页</button></div>'
    + '</div>';
  const again = document.getElementById('fcAgain');
  if (again) again.onclick = () => fcStart();
  const home = document.getElementById('fcHome');
  if (home) home.onclick = () => { const t = document.querySelector('.tab[data-v="home"]'); if (t) t.click(); };
}
/* 学满一组记一条会话日志，供「今天学了多少组」与以后做趋势用；随备份一起走。 */
function fcLogSession(n) {
  let log = [];
  try { log = JSON.parse(localStorage.getItem('kb_fc_log') || '[]') || []; } catch (e) { log = []; }
  log.push({ d: fcDate(), n: n, ok: fcStat[2] + fcStat[3], miss: fcStat[0] });
  if (log.length > 200) log = log.slice(-200);
  try { localStorage.setItem('kb_fc_log', JSON.stringify(log)); } catch (e) {}
}

/* 键盘：← → 切词（会跳过当前词，不评分），空格翻面，1–4 评价 */
document.addEventListener('keydown', e => {
  if (!fcOn) return;
  const tag = (e.target && e.target.tagName) || '';
  if (/INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable)) return;
  if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); fcFlip(); return; }
  if (e.key === 'ArrowLeft') { e.preventDefault(); if (fcI > 0) { fcI--; fcRender(); } return; }
  if (e.key === 'ArrowRight') { e.preventDefault(); if (fcI < fcQ.length - 1) { fcI++; fcRender(); } return; }
  if (/^[1-4]$/.test(e.key)) { e.preventDefault(); fcGrade(+e.key - 1); }
});
