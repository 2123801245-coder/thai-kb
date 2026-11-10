/**
 * 四关训练：认 → 读 → 写 → 用
 * ------------------------------------------------------------------
 * 设计要点（依据见 docs/单词记忆产品设计.md）：
 *  · 一个词四张卡，互不折算：认得出来 ≠ 写得出来
 *  · 选择题只用于新词的「认」关；「写」必须默写、「用」必须填空/造句
 *  · 每关要两种不同题型各通过一次才算稳定
 *  · 错词按原因分类进错词本，下次换题型、换例句
 * 依赖：allWords()、KBFSRS、speakThai()、kbBumpToday()、toast()
 */
(function () {
  'use strict';

  const NEW_PER_DAY = 10;
  const SESSION_MAX = 20;
  const MKEY = 'kb_mistakes';

  let Q = [];          /* 今日队列 */
  let I = 0;
  let cur = null;      /* 当前题 */
  let stat = null;     /* 本轮统计 */
  let box = null;

  const el = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  /* ---------------- 工具 ---------------- */
  const TONE = /[\u0E48\u0E49\u0E4A\u0E4B]/g;          /* ่ ้ ๊ ๋ */
  const norm = (s) => String(s || '').replace(/[\s\u200b\u200c\u200d]/g, '');
  const noTone = (s) => norm(s).replace(TONE, '');
  const rnd = (n) => Math.floor(Math.random() * n);
  function shuffle(a) { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = rnd(i + 1); const t = r[i]; r[i] = r[j]; r[j] = t; } return r; }
  function lev(a, b) {
    a = norm(a); b = norm(b);
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = new Array(n + 1), cur2 = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      cur2[0] = i;
      for (let j = 1; j <= n; j++) {
        cur2[j] = Math.min(prev[j] + 1, cur2[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      const tmp = prev; prev = cur2; cur2 = tmp;
    }
    return prev[n];
  }
  const zhBrief = (z) => String(z || '').split(/[；;，,（(]/)[0].trim();

  function wordMap() {
    const m = {};
    (typeof allWords === 'function' ? allWords() : []).forEach(w => {
      if (w && typeof w.t === 'string' && w.t.trim() && !m[w.t]) m[w.t] = w;
    });
    return m;
  }
  function exOf(w) {
    if (!w || !Array.isArray(w.ex)) return null;
    const pairs = w.ex.filter(p => Array.isArray(p) && p[0] && p[1]);
    return pairs.length ? pairs : null;
  }
  function speak(t) {
    try {
      if (window.KB && KB.audio && typeof KB.audio.play === 'function') { KB.audio.play(t); return; }
      if (typeof speakThai === 'function') speakThai(t);
    } catch (e) { }
  }

  /* ---------------- 错词本 ---------------- */
  function mistakes() { return window.KBProgress ? KBProgress.mistakes() : []; }
  function addMistake(rec) { }
  function resolveMistake(t, skill) { }

  /* ---------------- 队列 ---------------- */
  let SETUP = { scope: 'due', skills: null, count: 20 };
  function setSetup(o) { SETUP = Object.assign({}, SETUP, o || {}); return SETUP; }
  function getSetup() { return SETUP; }

  function buildQueue(mode) {
    const wm = wordMap();
    const P = window.KBProgress;
    const course = P ? P.activeCourse() : '';
    const inCourse = (w) => !course || (P && P.courseOfWord(w.t) === course);
    const bank = Object.keys(wm).map(k => wm[k]).filter(inCourse);
    const only = (SETUP.skills && SETUP.skills.length) ? SETUP.skills : null;
    const want = Math.max(1, Math.min(100, SETUP.count || SESSION_MAX));
    const scope = SETUP.scope || 'due';
    let all = [];

    if (scope === 'wrong') {
      (P ? P.mistakes() : []).forEach(m => {
        const w = wm[m.t];
        if (!w || !inCourse(w)) return;
        all.push({ t: m.t, w: w, skill: m.skill || '写', fix: 1 });
      });
    } else if (scope === 'new') {
      bank.filter(w => !(P ? P.status(w.t) > 0 : false)).forEach(w => {
        all.push({ t: w.t, w: w, skill: (only && only[0]) || '认', isNew: 1 });
      });
    } else if (scope === 'all') {
      bank.forEach(w => all.push({ t: w.t, w: w, skill: (only && only[0]) || '认',
        due: (P ? P.status(w.t) : 0) > 0 ? 1 : 0 }));
    } else {
      KBFSRS.due(null).forEach(c => {
        const w = wm[c.t];
        if (!w || !inCourse(w)) return;
        if (only && only.indexOf(c.skill) < 0) return;
        all.push({ t: c.t, w: w, skill: c.skill, due: 1 });
      });
      const skills = only || SKILLS;
      let fresh = 0;
      for (let i = 0; i < bank.length && fresh < NEW_PER_DAY; i++) {
        const w = bank[i];
        if (P && P.status(w.t) > 0) continue;
        all.push({ t: w.t, w: w, skill: skills[0], isNew: 1 });
        fresh++;
      }
    }

    if (mode === 'review') all = all.filter(x => !x.isNew);
    if (scope === 'wrong' && only) all = all.filter(x => only.indexOf(x.skill) >= 0);
    let out = shuffle(all);
    for (let i = 1; i < out.length; i++) {
      if (out[i].t === out[i - 1].t) {
        for (let j = i + 1; j < out.length; j++) {
          if (out[j].t !== out[i - 1].t) { const tmp = out[i]; out[i] = out[j]; out[j] = tmp; break; }
        }
      }
    }
    return out.slice(0, want);
  }

  function distractZh(w, n) {
    const wm = wordMap(); const keys = shuffle(Object.keys(wm));
    const out = [];
    for (const k of keys) {
      if (out.length >= n) break;
      if (k === w.t) continue;
      const z = zhBrief(wm[k].z);
      if (!z || z === zhBrief(w.z) || out.indexOf(z) >= 0) continue;
      out.push(z);
    }
    return out;
  }
  function distractTh(w, n) {
    const wm = wordMap(); const base = norm(w.t);
    const keys = shuffle(Object.keys(wm));
    const out = [];
    for (const k of keys) {
      if (out.length >= n) break;
      const cand = wm[k].t;
      if (k === w.t || out.indexOf(cand) >= 0) continue;
      const c = norm(cand);
      if (Math.abs(c.length - base.length) > 3) continue;
      out.push(cand);
    }
    return out;
  }

  function mkQuestion(item) {
    const w = item.w, skill = item.skill;
    const q = { t: w.t, w: w, skill: skill };
    if (skill === '认') {
      q.qtype = '选择'; q.mode = 'choice';
      q.title = '① 认 · 看泰语选意思';
      q.prompt = w.t; q.promptCls = 'th';
      q.audio = true;
      const right = zhBrief(w.z);
      const opts = shuffle([right].concat(distractZh(w, 3)));
      q.options = opts; q.answer = right;
      return q;
    }
    if (skill === '读') {
      q.qtype = '听辨'; q.mode = 'choice';
      q.title = '② 读 · 听音选拼写';
      q.prompt = '🔊 听发音，选出正确拼写';
      q.audio = true;
      const opts = shuffle([w.t].concat(distractTh(w, 3)));
      q.options = opts; q.answer = w.t;
      return q;
    }
    if (skill === '写') {
      q.qtype = '听写'; q.mode = 'input';
      q.title = '③ 写 · 听音默写（含声调符号）';
      q.prompt = '🔊 听发音，写出泰语拼写';
      q.audio = true; q.answer = w.t;
      q.placeholder = '输入泰语（可用系统泰语键盘）';
      return q;
    }
    /* 用：有例句 → 填空；没有 → 造句自评 */
    const exs = exOf(w);
    if (exs) {
      const pair = exs[rnd(exs.length)];
      let blanked = pair[0], done = false;
      try {
        const re = new RegExp(w.t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        if (re.test(pair[0])) { blanked = pair[0].replace(re, '______'); done = true; }
      } catch (e) { }
      if (done) {
        q.qtype = '填空'; q.mode = 'input';
        q.title = '④ 用 · 句子填空（无选项）';
        q.prompt = blanked; q.promptCls = 'zh';
        q.hintZh = pair[1]; q.answer = w.t;
        q.placeholder = '填入这个词的泰语';
        return q;
      }
    }
    q.qtype = '造句'; q.mode = 'write';
    q.title = '④ 用 · 造一个句子';
    q.prompt = '用这个词造一句泰语（写完后按四项自评）';
    q.hintZh = w.z; q.answer = w.t;
    return q;
  }

  /* ---------------- 判分 ---------------- */
  function gradeChoice(q, val) {
    const ok = val === q.answer;
    return { ok: ok, g: ok ? 3 : 1, reason: ok ? '' : '意思' };
  }
  function gradeWrite(q, val) {
    const a = norm(val);
    if (!a) return { ok: false, g: 1, reason: '拼写' };
    if (a === norm(q.answer)) return { ok: true, g: 3, reason: '' };
    if (noTone(a) === noTone(q.answer)) return { ok: false, g: 2, reason: '声调' };
    const d = lev(a, q.answer);
    if (d <= 2) return { ok: false, g: 1, reason: '拼写' };
    return { ok: false, g: 1, reason: '意思' };
  }
  function gradeCloze(q, val) {
    const a = norm(val);
    if (!a) return { ok: false, g: 1, reason: '搭配' };
    if (a === norm(q.answer) || a.indexOf(norm(q.answer)) >= 0) return { ok: true, g: 3, reason: '' };
    if (noTone(a) === noTone(q.answer)) return { ok: false, g: 2, reason: '声调' };
    return { ok: false, g: 1, reason: '搭配' };
  }

  /* ---------------- 渲染 ---------------- */
  function shell(inner) {
    if (!box) box = el('fgBox');
    if (!box) return;
    box.innerHTML = inner;
  }

  function renderHome() {
    const fst = KBFSRS.stats();
    const sc = window.KBProgress ? KBProgress.skillCounts() : { 认: 0, 读: 0, 写: 0, 用: 0 };
    const P = window.KBProgress ? KBProgress.stats() : { total: 0, mastered: 0, inBook: 0, course: '' };
    const st = { 认: sc.认, 读: sc.读, 写: sc.写, 用: sc.用, dueToday: fst.dueToday,
                 wordsSeen: P.total, stable: sc };
    const dueN = fst.dueToday;
    const fake = st.认 ? Math.max(0, Math.round((1 - st.写 / st.认) * 100)) : 0;
    const col = (label, got, cls, note) =>
      '<div class="fg-col ' + cls + '"><b>' + got + '</b><span>' + label + '</span><small>' + note + '</small></div>';
    shell(
      '<div class="fg-home">' +
      '<div class="fg-head"><h2>🎯 四关训练</h2>' +
      '<p class="fg-course">词书：<b>' + (P.course || '未选择') + '</b> · 已掌握 ' + P.mastered + ' / ' + P.total + '</p>' +
      '<p class="fg-sub">认得出来 ≠ 写得出来。一个词要过四关才算会：认 → 读 → 写 → 用。</p></div>' +
      '<div class="fg-funnel">' +
      col('认得', st.认, 'c1', '看到词知道意思') +
      col('会读', st.读, 'c2', '听得出、读得对') +
      col('会写', st.写, 'c3', '默写拼写与声调') +
      col('会用', st.用, 'c4', '填得进句子、造得出句') +
      '</div>' +
      '<div class="fg-note">' +
      '<b>虚假记忆指数 ' + fake + '%</b> —— 认得 ' + st.认 + ' 个词里，有 ' + Math.max(0, st.认 - st.写) +
      ' 个还写不出来。这个数降下来，才叫真的会了。' +
      '<br><span class="fg-dim">已接触 ' + seenWords + ' 词 · 今天到期 ' + dueN + ' 张卡 · 稳定通过 ' +
      (st.stable.认 + st.stable.读 + st.stable.写 + st.stable.用) + ' 关次</span></div>' +
      '<div class="fg-actions">' +
      '<button class="btn primary wide" id="fgGoToday" type="button">▶ 开始今日训练' +
      (dueN ? '<span class="fg-sub2">' + dueN + ' 张到期 + 最多 ' + NEW_PER_DAY + ' 个新词</span>' : '<span class="fg-sub2">先认识几个新词</span>') + '</button>' +
      '<button class="btn ghost wide" id="fgGoReview" type="button">🔁 只复习，不学新词</button>' +
      '<button class="btn ghost wide" id="fgGoMist" type="button">📕 错词本 ' + mistakes().length + ' 条</button>' +
      '</div>' +
      '<div class="fg-why">' +
      '<b>为什么是四关</b>' +
      '<ul>' +
      '<li><b>认</b>只考「看到知道意思」——这是百词斩能帮你做到的全部，也是最容易产生虚假记忆的一关。</li>' +
      '<li><b>读</b>听音选拼写，拼错了说明你记的是形状不是声音。</li>' +
      '<li><b>写</b>关没有选项，只能默写：声调漏了会单独记成「声调」错，不跟拼写混在一起。</li>' +
      '<li><b>用</b>关是句子填空或造句，检验搭配与语法能不能真的调用出来。</li>' +
      '</ul>' +
      '<p class="fg-tip">四关互不折算，各自按 FSRS 排期：认得再熟，写那一关照样会到期待复习。队列每天打乱，新词与旧词混排，同一词至少隔 6 题；错了的词下次换题型、换例句再考。</p>' +
      '</div>' +
      '</div>'
    );
    const g1 = el('fgGoToday'), g2 = el('fgGoReview'), g3 = el('fgGoMist');
    if (g1) g1.onclick = () => fgStart('today');
    if (g2) g2.onclick = () => fgStart('review');
    if (g3) g3.onclick = () => renderMistakes();
  }

  function renderMistakes() {
    const list = mistakes().filter(m => !m.out);
    const OUT = (window.KBProgress && KBProgress.OUT) || 2;
    if (!list.length) {
      shell('<div class="fg-home"><div class="fg-head"><h2>📕 错词本</h2>' +
        '<p class="fg-sub">还没有错词。任何训练里答错都会自动收进来，并记录来源、错误次数与首次入本时间。</p></div>' +
        '<div class="fg-actions"><button class="btn ghost wide" id="fgBack" type="button">← 返回看板</button></div></div>');
      el('fgBack').onclick = renderHome;
      return;
    }
    const groups = {};
    list.forEach(m => {
      const rs = m.reasons || {};
      const top = Object.keys(rs).sort((a, b) => rs[b] - rs[a])[0] || '拼写';
      (groups[top] = groups[top] || []).push(m);
    });
    const order = ['拼写', '声调', '意思', '搭配', '语法', '语序'];
    const day = (ts) => { const d = new Date(ts || Date.now()); return (d.getMonth() + 1) + '/' + d.getDate(); };
    let html = '<div class="fg-home"><div class="fg-head"><h2>📕 错词本</h2>' +
      '<p class="fg-sub">' + list.length + ' 个词待清。答对不立刻出本：在同一关里连续答对 ' + OUT +
      ' 次才移出，移出时把主进度同步回四关。</p></div>';
    order.forEach(k => {
      if (!groups[k]) return;
      html += '<div class="fg-mgroup"><h3>' + k + ' <small>' + groups[k].length + ' 条</small></h3><ul class="fg-mlist">';
      groups[k].slice(0, 12).forEach(m => {
        html += '<li><b>' + esc(m.t) + '</b><span>' + esc(m.training || '训练') +
          ' · 错 ' + (m.n || 1) + ' 次 · ' + (m.streak || 0) + '/' + OUT + ' 连对 · 首次 ' + day(m.first) + '</span></li>';
      });
      html += '</ul></div>';
    });
    html += '<div class="fg-actions"><button class="btn primary wide" id="fgMistTrain" type="button">▶ 练这些错词</button>' +
      '<button class="btn ghost wide" id="fgBack" type="button">← 返回看板</button></div></div>';
    shell(html);
    el('fgBack').onclick = renderHome;
    el('fgMistTrain').onclick = () => {
      const wm = wordMap();
      Q = shuffle(list.filter(m => wm[m.t]).map(m => ({ t: m.t, w: wm[m.t], skill: m.skill || '写', fix: 1 }))).slice(0, SETUP.count || SESSION_MAX);
      if (!Q.length) { toast('错词都清了'); return; }
      stat = { n: 0, ok: 0, again: 0, start: Date.now() };
      I = 0; draw();
    };
  }

  function draw() {
    if (I >= Q.length) return renderSummary();
    const item = Q[I];
    cur = mkQuestion(item);
    cur.item = item;
    const q = cur;
    let body = '';
    if (q.mode === 'choice') {
      body = q.options.map((o, k) =>
        '<button class="fg-opt" data-o="' + esc(o) + '" type="button">' +
        (q.skill === '读' ? esc(o) : '<span class="fg-opt-i">' + 'ABCD'[k] + '</span>' + esc(o)) + '</button>').join('');
    } else if (q.mode === 'input') {
      body = '<div class="fg-promptline">' + esc(q.prompt) + '</div>' +
        (q.hintZh ? '<div class="fg-zh">' + esc(q.hintZh) + '</div>' : '') +
        '<input class="fg-input" id="fgInput" type="text" lang="th" autocomplete="off" ' +
        'placeholder="' + esc(q.placeholder || '') + '">';
    } else {
      body = '<div class="fg-promptline">' + esc(q.prompt) + '</div>' +
        '<div class="fg-zh">' + esc(q.hintZh || '') + '</div>' +
        '<textarea class="fg-input fg-area" id="fgInput" lang="th" rows="3" placeholder="用泰语写一句话"></textarea>' +
        '<div class="fg-rubric"><label><input type="checkbox" data-r="0"> 拼写与声调正确</label>' +
        '<label><input type="checkbox" data-r="1"> 义项用对</label>' +
        '<label><input type="checkbox" data-r="2"> 搭配自然</label>' +
        '<label><input type="checkbox" data-r="3"> 语法完整</label></div>';
    }
    const pct = Math.round((I / Math.max(1, Q.length)) * 100);
    shell(
      '<div class="fg-session">' +
      '<div class="fg-bar"><button class="btn ghost sm" id="fgQuit" type="button">← 结束</button>' +
      '<div class="fg-prog"><i style="width:' + pct + '%"></i></div>' +
      '<span class="fg-count">' + (I + 1) + ' / ' + Q.length + '</span></div>' +
      '<div class="fg-card">' +
      '<div class="fg-title">' + q.title + '</div>' +
      (q.skill === '认' ? '<div class="fg-th fg-thbig">' + esc(q.prompt) + '</div>' : '') +
      (q.audio ? '<button class="fg-spk" id="fgSpk" type="button" aria-label="再听一次">🔊 再听一次</button>' : '') +
      body +
      '</div>' +
      '<div class="fg-fb" id="fgFb" aria-live="polite"></div>' +
      '<div class="fg-actions" id="fgAct">' +
      (q.mode === 'choice' ? '' : '<button class="btn primary wide" id="fgSubmit" type="button">提交</button>') +
      '</div></div>'
    );
    const quit = el('fgQuit'); if (quit) quit.onclick = renderHome;
    const spk = el('fgSpk'); if (spk) spk.onclick = () => speak(q.answer);
    if (q.audio) speak(q.answer);
    if (q.mode === 'choice') {
      box.querySelectorAll('.fg-opt').forEach(b => {
        b.onclick = () => {
          const val = b.getAttribute('data-o');
          const r = gradeChoice(q, val);
          box.querySelectorAll('.fg-opt').forEach(x => {
            if (x.getAttribute('data-o') === q.answer) x.classList.add('ok');
            else if (x === b) x.classList.add('bad');
            x.disabled = true;
          });
          if (q.skill === '读' && r.ok) selfReadCheck(q, r);
          else answer(q, r, val);
        };
      });
    } else {
      const sub = el('fgSubmit');
      if (sub) sub.onclick = () => {
        const v = (el('fgInput') || {}).value || '';
        if (q.mode === 'write') {
          const boxes = [...box.querySelectorAll('.fg-rubric input[data-r]')];
          const on = boxes.filter(c => c.checked).length;
          const g = on >= 4 ? 4 : (on >= 3 ? 3 : (on >= 2 ? 2 : 1));
          const r = { ok: g >= 3, g: g, reason: on >= 2 ? '' : '语法', manual: 1, score: on * 2 };
          answer(q, r, v);
        } else {
          const r = q.qtype === '填空' ? gradeCloze(q, v) : gradeWrite(q, v);
          answer(q, r, v);
        }
      };
      const inp = el('fgInput');
      if (inp) inp.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (sub) sub.click(); } };
    }
  }

  /* 读关：拼写选对后，自评"有没有读顺" —— 读关考的是能开口，不只是能认出 */
  function selfReadCheck(q, base) {
    const fb = el('fgFb');
    fb.className = 'fg-fb on';
    fb.innerHTML = '<div class="fg-ok">拼写选对了 👍 再自评一下：你能读顺这个音吗？</div>' +
      '<div class="fg-actions"><button class="btn primary" id="fgReadOk" type="button">读顺了</button>' +
      '<button class="btn ghost" id="fgReadNo" type="button">还卡着</button></div>';
    el('fgReadOk').onclick = () => answer(q, { ok: true, g: 3, reason: '' }, q.answer);
    el('fgReadNo').onclick = () => answer(q, { ok: false, g: 2, reason: '声调', hint: '再听两遍，跟读时注意声调的高低' }, q.answer);
  }

  /* 一个词通过了某一关，就把它的下一关排进本轮（新词当天就能练到写和用） */
  function chainNext(item, g) {
    if (g < 3) return;
    const order = { '认': '读', '读': '写', '写': '用' };
    const nxt = order[item.skill];
    if (!nxt) return;
    if (item.isNew && item.skill !== '认') return;      /* 新词只从认开始链 */
    if (!item.isNew && item.chain == null) return;      /* 复习卡不链，交给排期 */
    const wm = wordMap();
    const w = wm[item.t];
    if (!w) return;
    const at = Math.min(Q.length, I + 1 + rnd(4));
    Q.splice(at, 0, { t: item.t, w: w, skill: nxt, chain: (item.chain || 1) + 1 });
  }

  function answer(q, r, val) {
    const item = q.item;
    const res = KBFSRS.grade(item.t, item.skill, r.g, { qtype: q.qtype });
    stat.n++;
  if (window.KBProgress) KBProgress.record({ t: item.t, skill: item.skill, ok: r.g >= 3,
    training: '四关训练·' + item.skill + (r.reason ? '（' + r.reason + '）' : '') });
    chainNext(item, r.g);
    if (r.g >= 3) { stat.ok++;  }
    else {
      stat.again++;
      /* 统一模型：答错入错题本并记录原因 */
    }
    /* 掌握度与首页计数沿用旧口径，词表/首页的数字不会失真 */
    try {
      if (typeof kbBumpToday === 'function') kbBumpToday(1);
      if (typeof CLS === 'object') {
        CLS[item.t] = r.g >= 3 ? (r.g === 4 ? 1 : 1) : (r.g === 2 ? 2 : 3);
        if (typeof saveCls === 'function') saveCls();
      }
    } catch (e) { }

    const ok = r.g >= 3;
    const fb = el('fgFb');
    const tips = {
      拼写: '拼写差一点：把它按音节拆开再记一遍（先记辅音，再记元音位置，最后补声调）。',
      声调: '声调符号漏了或写错：' + noTone(q.answer) + ' + ' + (norm(q.answer).match(TONE) || []).join('') + '，读的时候先定调再拼。',
      意思: '意思是另一回事：先确认这个中文义项，下面给了例句。',
      搭配: '搭配不自然：请看例句里的用法，泰语常常靠固定搭配成句。',
      语法: '句子结构有问题：先保证主谓完整，再看修饰语位置。',
      语序: '语序不自然：泰语的修饰语通常在中心词之后。'
    };
    const exs = exOf(item.w) || [];
    const exHtml = exs.slice(0, 1).map(p =>
      '<div class="fg-ex"><div class="fg-exth">' + esc(p[0]) + '</div><div class="fg-exzh">' + esc(p[1]) + '</div></div>').join('');
    const nextIn = res.nextIn;
    fb.className = 'fg-fb on ' + (ok ? 'good' : 'bad');
    fb.innerHTML =
      '<div class="fg-verdict">' + (ok ? '✓ 通过' : '✗ 记一笔') +
      '<span class="fg-ans">正确答案：<b>' + esc(q.answer) + '</b> <button class="fg-spk-sm" id="fgSpk2" type="button" aria-label="听答案">🔊</button></span></div>' +
      (ok ? '' : '<div class="fg-why">' + (r.hint || tips[r.reason] || '再记一次。') + '</div>') +
      (exHtml ? '<div class="fg-exwrap">' + exHtml + '</div>' : '') +
      '<div class="fg-next">下次：' + (nextIn <= 1 ? '明天' : nextIn + ' 天后') +
      ' · 写 ' + res.S.toFixed(1) + 'd / 难 ' + res.D.toFixed(1) +
      (r.g >= 3 && res.state === 'stable' ? ' · 这一关已稳定' : '') + '</div>' +
      '<div class="fg-actions"><button class="btn primary wide" id="fgCont" type="button">继续 →</button></div>';
    const s2 = el('fgSpk2'); if (s2) s2.onclick = () => speak(q.answer);
    el('fgCont').onclick = () => { I++; draw(); };
    el('fgCont').focus && el('fgCont').focus();
    const inp = el('fgInput'); if (inp) inp.disabled = true;
    const sub = el('fgSubmit'); if (sub) sub.disabled = true;
  }

  function renderSummary() {
    const st = KBFSRS.stats();
    const acc = stat.n ? Math.round((stat.ok / stat.n) * 100) : 0;
    shell('<div class="fg-home"><div class="fg-head"><h2>本轮结束</h2>' +
      '<p class="fg-sub">' + stat.n + ' 题 · 通过 ' + stat.ok + ' · 记为不会 ' + stat.again +
      ' · 正确率 ' + acc + '%</p></div>' +
      '<div class="fg-funnel">' +
      '<div class="fg-col c1"><b>' + st.认 + '</b><span>认得</span></div>' +
      '<div class="fg-col c2"><b>' + st.读 + '</b><span>会读</span></div>' +
      '<div class="fg-col c3"><b>' + st.写 + '</b><span>会写</span></div>' +
      '<div class="fg-col c4"><b>' + st.用 + '</b><span>会用</span></div>' +
      '</div>' +
      '<p class="fg-tip">错词已经进错词本，明天会换题型再考；明天到期 ' + st.dueToday + ' 张卡。</p>' +
      '<div class="fg-actions"><button class="btn primary wide" id="fgAgain" type="button">再来一轮</button>' +
      '<button class="btn ghost wide" id="fgBackHome" type="button">← 回训练场</button></div></div>');
    el('fgAgain').onclick = () => fgStart('today');
    el('fgBackHome').onclick = () => { if (typeof goTrainHome === 'function') goTrainHome(); else renderHome(); };
  }

  /* ---------------- 入口 ---------------- */
  function fgStart(mode) {
    KBFSRS.migrate();
    Q = buildQueue(mode);
    stat = { n: 0, ok: 0, again: 0, start: Date.now() };
    I = 0;
    if (!Q.length) {
      shell('<div class="fg-home"><div class="fg-head"><h2>今天没有要练的</h2>' +
        '<p class="fg-sub">四关都清空了，或者词表里已经没有新词。</p></div>' +
        '<div class="fg-actions"><button class="btn ghost wide" id="fgBack" type="button">← 回看板</button></div></div>');
      el('fgBack').onclick = renderHome;
      return;
    }
    draw();
  }

  function fgEnsure() {
    box = el('fgBox');
    if (!box) return;
    if (!Q.length || I >= Q.length) renderHome();
  }

  window.fgStart = fgStart;
  window.fgEnsure = fgEnsure;
  window.fgSetup = setSetup;
  window.fgGetSetup = getSetup;
  window.fgHome = renderHome;
  window.fgMistakes = renderMistakes;
})();
