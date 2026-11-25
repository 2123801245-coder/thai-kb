/* search.js —— 全局搜索 + 中文反查（Ctrl/⌘+K 或点顶栏 🔍）
   为什么单独做：词表页的搜索只过滤当前那一页的词；想在「生词 / 句型 / 课文 /
   词汇讲解 / 辨析」里一次找完、或者拿中文反查泰语，就没有入口了。

   匹配规则（按分数从高到低，每组最多 8 条）：
     · 泰文：完全相同 100 / 前缀 80 / 包含 60
     · 中文：词义里包含 50（这就是「中文反查」：输入中文，列出对应的泰语）
     · 读音（words 的 r 字段）：包含 30
   点结果直接跳到对应页面：生词 → 词表并带着关键词过滤；课文 → 打开那一篇；
   句型 / 词汇讲解 / 辨析 → 切到对应标签页。 */
(function () {
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[\s\u200b]+/g, ' ').trim();
  const hasCJK = s => /[\u4e00-\u9fff]/.test(s);
  const ROOM = 8;                    /* 每组最多显示几条 */

  function scoreIn(hay, q, exact, prefix, contains) {
    const h = norm(hay);
    if (!h) return 0;
    if (h === q) return exact;
    if (h.indexOf(q) === 0) return prefix;
    if (h.indexOf(q) >= 0) return contains;
    return 0;
  }

  let box = null, inputEl = null, resEl = null, items = [], cur = -1;

  function collect(q) {
    const out = { words: [], patterns: [], paras: [], vok: [], disc: [] };
    const words = (typeof allWords === 'function' ? allWords() : []) || [];
    words.forEach(w => {
      const s = Math.max(scoreIn(w.t, q, 100, 80, 60),
        scoreIn(w.z, q, 90, 70, 50),
        scoreIn(w.r, q, 40, 35, 30));
      if (s) out.words.push({ s: s, t: w.t, z: w.z || '', r: w.r || '', lesson: w.lesson || '' });
    });
    let pats = [];
    try { pats = (typeof allPatterns === 'function' ? allPatterns() : (typeof PATTERNS !== 'undefined' ? PATTERNS : [])) || []; } catch (e) { pats = []; }
    pats.forEach(p => {
      const s = Math.max(scoreIn(p.p, q, 100, 80, 60), scoreIn(p.z, q, 90, 70, 50), scoreIn(p.ex, q, 30, 25, 20));
      if (s) out.patterns.push({ s: s, p: p.p, z: p.z || '', lg: p.lg || '' });
    });
    const secs = (typeof allSections === 'function' ? allSections() : []) || [];
    secs.forEach((l, li) => {
      (l.paras || []).forEach((para, pi) => {
        const s = Math.max(scoreIn(para.t, q, 90, 70, 55), scoreIn(para.z, q, 80, 60, 45));
        if (s) out.paras.push({ s: s, li: li, pi: pi, label: l.label, t: para.t, z: para.z || '' });
      });
    });
    const vok = (typeof VOK !== 'undefined' && VOK) ? VOK : [];
    vok.forEach(c => {
      let s = Math.max(scoreIn(c.w, q, 100, 80, 60), scoreIn(c.z, q, 90, 70, 50));
      (c.sents || []).forEach(x => {
        s = Math.max(s, scoreIn(x.t, q, 40, 35, 30), scoreIn(x.z, q, 35, 30, 25));
      });
      if (s) out.vok.push({ s: s, w: c.w, z: c.z || '', src: c.src || '' });
    });
    const disc = (typeof DISC !== 'undefined' && DISC) ? DISC : [];
    disc.forEach(c => {
      let s = scoreIn(c.t, q, 70, 60, 45);
      (c.items || []).forEach(it => {
        s = Math.max(s, scoreIn(it.w, q, 100, 80, 60), scoreIn(it.z, q, 80, 60, 45), scoreIn(it.ex, q, 30, 25, 20));
      });
      if (s) out.disc.push({ s: s, t: c.t, g: c.g || '' });
    });
    Object.keys(out).forEach(k => out[k].sort((a, b) => b.s - a.s));
    return out;
  }

  function row(r, group) {
    const meta = [];
    if (r.lesson) meta.push(r.lesson);
    if (r.r) meta.push(r.r);
    if (r.lg) meta.push(r.lg);
    if (r.src) meta.push(r.src);
    if (r.g) meta.push(r.g);
    if (group === 'paras') meta.push(r.label + ' · 第 ' + (r.pi + 1) + ' 段');
    const main = group === 'patterns' ? r.p : (group === 'disc' ? r.t : (group === 'vok' ? r.w : r.t));
    const sub = group === 'patterns' ? r.z : (group === 'disc' ? '' : (r.z || ''));
    return '<button class="gs-row" type="button" data-g="' + group + '" data-i="' + items.length + '">'
      + '<span class="gs-main">' + esc(main) + '</span>'
      + (sub ? '<span class="gs-sub">' + esc(String(sub).slice(0, 70)) + '</span>' : '')
      + (meta.length ? '<span class="gs-meta">' + esc(meta.join(' · ')) + '</span>' : '')
      + '</button>';
  }

  function render(q) {
    if (!resEl) return;
    items = []; cur = -1;
    if (!q) {
      resEl.innerHTML = '<div class="gs-empty">输入泰语或中文开始搜索：<br>泰文查词/课文/例句，中文可以反查对应的泰语词。</div>';
      return;
    }
    const r = collect(q);
    const groups = [
      ['words', '📋 生词', r.words],
      ['patterns', '🧩 句型', r.patterns],
      ['paras', '📖 课文段落', r.paras],
      ['vok', '📚 词汇讲解', r.vok],
      ['disc', '📐 辨析', r.disc]
    ];
    let html = hasCJK(q) ? '<div class="gs-tip">中文反查：下面是中文里含「' + esc(q) + '」的词条</div>' : '';
    let total = 0;
    groups.forEach(([key, title, list]) => {
      if (!list.length) return;
      total += list.length;
      html += '<div class="gs-group">' + title + '<span>' + list.length + '</span></div>';
      list.slice(0, ROOM).forEach(x => { html += row(x, key); items.push({ key: key, x: x }); });
      if (list.length > ROOM) html += '<div class="gs-more">还有 ' + (list.length - ROOM) + ' 条…换个更具体的词试试</div>';
    });
    resEl.innerHTML = html || '<div class="gs-empty">没找到「' + esc(q) + '」。<br>试试只输入泰语词根或一个中文词。</div>';
    resEl.querySelectorAll('.gs-row').forEach(b => {
      b.onclick = () => openItem(items[+b.dataset.i]);
      b.onmouseenter = () => { mark(+b.dataset.i); };
    });
    resEl._total = total;
  }

  function mark(i) {
    if (!resEl) return;
    resEl.querySelectorAll('.gs-row').forEach(b => b.classList.remove('cur'));
    const b = resEl.querySelector('.gs-row[data-i="' + i + '"]');
    if (b) { b.classList.add('cur'); cur = i; }
  }

  function close() {
    if (box) { box.remove(); box = null; }
    inputEl = null; resEl = null; items = []; cur = -1;
  }

  function goTab(v) {
    const t = document.querySelector('.tab[data-v="' + v + '"]');
    if (t) t.click();
    else {
      document.querySelectorAll('.pane').forEach(p => p.classList.remove('on'));
      const p = document.getElementById('pane-' + v);
      if (p) p.classList.add('on');
    }
  }

  function openItem(it) {
    if (!it) return;
    const key = it.key, x = it.x;
    close();
    if (key === 'words') {
      goTab('list');
      const si = document.getElementById('searchInput');
      if (si) { si.value = x.t; si.dispatchEvent(new Event('input')); }
      window.scrollTo({ top: 0 });
      return;
    }
    if (key === 'paras') {
      if (typeof kbOpenLesson === 'function') kbOpenLesson(x.li);
      return;
    }
    if (key === 'patterns') { goTab('pattern'); return; }
    if (key === 'vok') { goTab('vok'); return; }
    if (key === 'disc') { goTab('disc'); return; }
  }

  function build() {
    if (box) return;
    box = document.createElement('div');
    box.id = 'gsMask';
    box.innerHTML = '<div class="gs-panel" role="dialog" aria-label="全局搜索">'
      + '<div class="gs-bar"><span class="gs-ic">🔍</span>'
      + '<input id="gsInput" type="search" placeholder="搜索泰语 / 中文 / 读音…（⌘K）" autocomplete="off" autocapitalize="off" spellcheck="false">'
      + '<button id="gsClose" type="button" title="关闭">✕</button></div>'
      + '<div class="gs-res" id="gsRes"></div></div>';
    document.body.appendChild(box);
    inputEl = document.getElementById('gsInput');
    resEl = document.getElementById('gsRes');
    inputEl.addEventListener('input', () => render(inputEl.value.trim().toLowerCase()));
    inputEl.addEventListener('keydown', e => {
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'Enter') { e.preventDefault(); openItem(items[cur >= 0 ? cur : 0]); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const n = items.length;
        if (!n) return;
        cur = e.key === 'ArrowDown' ? (cur + 1) % n : (cur <= 0 ? n - 1 : cur - 1);
        mark(cur);
        const b = resEl.querySelector('.gs-row.cur');
        if (b) b.scrollIntoView({ block: 'nearest' });
      }
    });
    document.getElementById('gsClose').onclick = close;
    box.addEventListener('click', e => { if (e.target === box) close(); });
    render('');
    inputEl.focus();
  }
  const open = () => { build(); if (inputEl) inputEl.focus(); };

  /* 入口：顶栏 🔍（手机）、侧栏「🔍 搜索」（桌面）、⌘/Ctrl+K、以及不在输入框里按 / */
  function wire() {
    const tb = document.getElementById('tbSearch');
    if (tb) tb.onclick = open;
    const go = document.getElementById('goSearchBtn');
    if (go) go.onclick = open;
    document.addEventListener('keydown', e => {
      const k = e.key;
      if ((e.metaKey || e.ctrlKey) && (k === 'k' || k === 'K')) { e.preventDefault(); open(); return; }
      if (k === '/' && !box) {
        const t = e.target;
        if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
        if (t && t.isContentEditable) return;
        e.preventDefault(); open();
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();

  window.KB_SEARCH = { open: open, close: close, search: q => collect(norm(q)) };
})();
