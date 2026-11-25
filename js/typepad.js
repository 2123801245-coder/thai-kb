/* typepad.js —— 泰文输入 / 手写练习（训练场 → ✍️ 泰文输入 · 手写）
   为什么要有：四关的「写」关是默写输入，但多数人电脑/手机没装泰文键盘，敲不出来；
   词表里的「键盘拼写」也有同样门槛。这里给两条不用泰文键盘也能练写的路：
     ⌨️ 输入模式：屏幕上给一副泰文键盘（辅音 / 元音 / 声调符号），点着拼出答案
     ✍️ 手写模式：在画板上写，写完自己对照答案判对错（不识别笔迹，只练手感）
   题干一律是「中文 + 读音 + 🔊」，答案才是泰文 —— 练的是「想到 → 写出来」。
   判分写进统一进度（KBProgress.record，skill=写），和四关的「写」同一份账。 */
(function () {
  const ROUND = 10;
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const norm = s => String(s == null ? '' : s).replace(/[\s\u200b]+/g, '').trim();

  /* 泰文键盘：常用辅音 + 元音 + 声调/符号。点按拼词，够覆盖词表里的词。 */
  const KEYS = [
    'ก', 'ข', 'ค', 'ง', 'จ', 'ฉ', 'ช', 'ซ', 'ญ', 'ด', 'ต', 'ถ', 'ท', 'ธ', 'น',
    'บ', 'ป', 'ผ', 'พ', 'ฟ', 'ภ', 'ม', 'ย', 'ร', 'ล', 'ว', 'ศ', 'ส', 'ห', 'อ', 'ฮ',
    'ะ', 'ั', 'า', 'ำ', 'ิ', 'ี', 'ึ', 'ื', 'ุ', 'ู', 'เ', 'แ', 'โ', 'ใ', 'ไ',
    '่', '้', '๊', '๋', '์', '็', 'ๆ'
  ];

  let tpQ = [], tpI = 0, tpOk = 0, tpMode = 'type', tpInput = '', tpAnswered = false;
  let tpDrawn = false, tpCanvas = null, tpCtx = null;

  function pool() {
    const words = (typeof allWords === 'function' ? allWords() : []) || [];
    let course = '';
    try { course = window.KBProgress ? KBProgress.activeCourse() : ''; } catch (e) {}
    let list = words.filter(w => w && w.t);
    if (course && course !== '__ALL__') {
      const picked = list.filter(w => {
        try { return KBProgress.courseOfWord(w.t) === course; } catch (e) { return false; }
      });
      if (picked.length) list = picked;
    }
    return list;
  }

  function startRound() {
    const all = pool();
    const seen = {};
    tpQ = [];
    while (tpQ.length < ROUND && all.length) {
      const w = all[Math.floor(Math.random() * all.length)];
      if (!w || seen[w.t]) { if (Object.keys(seen).length >= all.length) break; continue; }
      seen[w.t] = 1;
      tpQ.push(w);
    }
    tpI = 0; tpOk = 0;
    tpNext();
  }

  function box() { return document.getElementById('tpBox'); }

  function shell(inner) {
    const b = box(); if (!b) return;
    b.innerHTML = '<div class="tpwrap">' + inner + '</div>';
  }

  function topBar(extra) {
    return '<div class="tp-top">'
      + '<button class="tp-back" id="tpBack" type="button">‹ 训练场</button>'
      + '<div class="tp-modes">'
      +   '<button class="tp-mode' + (tpMode === 'type' ? ' on' : '') + '" data-mode="type" type="button">⌨️ 输入</button>'
      +   '<button class="tp-mode' + (tpMode === 'write' ? ' on' : '') + '" data-mode="write" type="button">✍️ 手写</button>'
      + '</div>'
      + '<span class="tp-prog">' + Math.min(tpI + 1, tpQ.length) + ' / ' + tpQ.length + '</span>'
      + '</div>' + (extra || '');
  }

  function next() { tpI++; tpNext(); }

  function tpNext() {
    tpAnswered = false; tpInput = ''; tpDrawn = false;
    if (tpI >= tpQ.length) return summary();
    const w = tpQ[tpI];
    const head = topBar()
      + '<div class="tp-card">'
      +   '<div class="tp-zh">' + esc(w.z || '（没有中文释义）') + '</div>'
      +   '<div class="tp-read">' + esc(w.r || '') + '</div>'
      +   '<div class="tp-ask">写出这个泰语词</div>'
      +   '<button class="tp-say" id="tpSay" type="button" title="听发音">🔊 听一听</button>'
      + '</div>';
    if (tpMode === 'type') shell(head + typePad() + '<div id="tpBody"></div>');
    else shell(head + writePad());
    bindCommon();
    if (tpMode === 'type') bindKeys();
    else initCanvas();
  }

  function typePad() {
    return '<div class="tp-answer" id="tpAns">' + (tpInput ? esc(tpInput) : '<span class="tp-ph">点下面的泰文键拼出来</span>') + '</div>'
      + '<div class="tp-keys">' + KEYS.map(k => '<button class="tp-k" type="button" data-k="' + esc(k) + '">' + esc(k) + '</button>').join('') + '</div>'
      + '<div class="tp-tools">'
      +   '<button class="tp-tool" id="tpBack2" type="button">⌫ 删除</button>'
      +   '<button class="tp-tool" id="tpTip" type="button">💡 提示</button>'
      +   '<button class="tp-tool pri" id="tpCheck" type="button">✓ 确认</button>'
      + '</div>';
  }

  function writePad() {
    return '<div class="tp-pad"><canvas id="tpCanvas" width="720" height="280" aria-label="手写板"></canvas>'
      + '<div class="tp-padline"></div></div>'
      + '<div class="tp-tools">'
      +   '<button class="tp-tool" id="tpClear" type="button">🧽 清空</button>'
      +   '<button class="tp-tool" id="tpShow" type="button">👀 对照答案</button>'
      +   '<button class="tp-tool pri" id="tpRight" type="button">✓ 写对了</button>'
      +   '<button class="tp-tool" id="tpWrong" type="button">✗ 没写对</button>'
      + '</div>'
      + '<div class="tp-answer-tip" id="tpReveal"></div>';
  }

  function bindCommon() {
    const b = box(); if (!b) return;
    const back = document.getElementById('tpBack');
    if (back) back.onclick = () => { if (typeof goTrainHome === 'function') goTrainHome(); };
    b.querySelectorAll('.tp-mode').forEach(m => {
      m.onclick = () => { tpMode = m.dataset.mode; tpNext(); };
    });
    const say = document.getElementById('tpSay');
    if (say) say.onclick = () => { const w = tpQ[tpI]; if (w) speakThai(w.t); };
  }

  function paintAns() {
    const el = document.getElementById('tpAns'); if (!el) return;
    el.innerHTML = tpInput ? esc(tpInput) : '<span class="tp-ph">点下面的泰文键拼出来</span>';
  }

  function bindKeys() {
    const b = box(); if (!b) return;
    b.querySelectorAll('.tp-k').forEach(k => {
      k.onclick = () => {
        if (tpAnswered) return;
        tpInput += k.dataset.k;
        paintAns();
      };
    });
    const del = document.getElementById('tpBack2');
    if (del) del.onclick = () => { if (tpAnswered) return; tpInput = tpInput.slice(0, -1); paintAns(); };
    const tip = document.getElementById('tpTip');
    if (tip) tip.onclick = () => {
      const w = tpQ[tpI]; if (!w || tpAnswered) return;
      const target = norm(w.t);
      const cur = norm(tpInput);
      if (cur.length >= target.length) return;
      tpInput = target.slice(0, cur.length + 1);   /* 按答案顺序提示下一个字 */
      paintAns();
    };
    const ck = document.getElementById('tpCheck');
    if (ck) ck.onclick = () => judge(norm(tpInput) === norm(tpQ[tpI].t));
  }

  function judge(ok) {
    const w = tpQ[tpI];
    const body = document.getElementById('tpBody');
    tpAnswered = true;
    if (ok) {
      tpOk++;
      if (slide(body, '<div class="tp-ok">✓ 写对了：<b>' + esc(w.t) + '</b></div>', true)) return;
      return;
    }
    const html = '<div class="tp-bad">✗ 差一点</div>'
      + '<div class="tp-cmp"><span>你写的</span><b>' + (tpInput ? esc(tpInput) : '（空）') + '</b></div>'
      + '<div class="tp-cmp ok"><span>正确写法</span><b>' + esc(w.t) + '</b></div>'
      + '<div class="tp-tools">'
      +   '<button class="tp-tool" id="tpRetry" type="button">↺ 再试一次</button>'
      +   '<button class="tp-tool pri" id="tpNextBtn" type="button">下一个 →</button>'
      + '</div>';
    if (slide(body, html, false)) return;
  }

  /* 答完的反馈：先亮出来，再记进度；点「下一个」继续 */
  function slide(body, html, ok) {
    if (!body) return false;
    body.innerHTML = html;
    record(ok);
    const nx = document.getElementById('tpNextBtn');
    if (nx) nx.onclick = next;
    if (ok) {
      setTimeout(() => { if (!document.getElementById('tpBody')) return; next(); }, 620);
    }
    const rt = document.getElementById('tpRetry');
    if (rt) rt.onclick = () => { tpAnswered = false; tpInput = ''; paintAns(); const bd = document.getElementById('tpBody'); if (bd) bd.innerHTML = ''; };
    return true;
  }

  function record(ok) {
    const w = tpQ[tpI];
    if (!w || !window.KBProgress) return;
    try {
      KBProgress.record({ t: w.t, skill: '写', ok: !!ok, training: '泰文输入练习' });
    } catch (e) {}
  }

  /* ---- 手写板 ---- */
  function initCanvas() {
    tpCanvas = document.getElementById('tpCanvas');
    if (!tpCanvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    tpCanvas.width = 720 * ratio;
    tpCanvas.height = 280 * ratio;
    tpCtx = tpCanvas.getContext('2d');
    tpCtx.scale(ratio, ratio);
    tpCtx.lineWidth = 5;
    tpCtx.lineCap = 'round';
    tpCtx.lineJoin = 'round';
    tpCtx.strokeStyle = '#232633';
    tpDrawn = false;
    let drawing = false, last = null;
    const pos = e => {
      const r = tpCanvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * 720 / r.width, y: (e.clientY - r.top) * 280 / r.height };
    };
    tpCanvas.onpointerdown = e => {
      drawing = true; tpDrawn = true;
      last = pos(e);
      try { tpCanvas.setPointerCapture(e.pointerId); } catch (err) {}
      tpCtx.beginPath(); tpCtx.moveTo(last.x, last.y); tpCtx.lineTo(last.x + 0.1, last.y); tpCtx.stroke();
    };
    tpCanvas.onpointermove = e => {
      if (!drawing) return;
      const p = pos(e);
      tpCtx.beginPath(); tpCtx.moveTo(last.x, last.y); tpCtx.lineTo(p.x, p.y); tpCtx.stroke();
      last = p;
    };
    tpCanvas.onpointerup = tpCanvas.onpointercancel = () => { drawing = false; last = null; };

    const clr = document.getElementById('tpClear');
    if (clr) clr.onclick = () => { tpCtx.clearRect(0, 0, 720, 280); tpDrawn = false; const r = document.getElementById('tpReveal'); if (r) r.innerHTML = ''; };
    const show = document.getElementById('tpShow');
    if (show) show.onclick = () => {
      const w = tpQ[tpI];
      const r = document.getElementById('tpReveal');
      if (r) r.innerHTML = '正确写法：<b>' + esc(w.t) + '</b>';
    };
    const rg = document.getElementById('tpRight');
    if (rg) rg.onclick = () => { tpOk++; record(true); tpFlash('✓ 记下了'); next(); };
    const wg = document.getElementById('tpWrong');
    if (wg) wg.onclick = () => {
      const w = tpQ[tpI];
      record(false);
      tpFlash('答案：' + w.t + '（已记入错题本）');
      next();
    };
  }

  function tpFlash(msg) {
    if (typeof toast === 'function') toast(msg);
  }

  function summary() {
    shell('<div class="tp-sum"><div class="tp-sum-h">这一组写完啦</div>'
      + '<div class="tp-sum-n">' + tpOk + ' / ' + tpQ.length + '</div>'
      + '<div class="tp-sum-t">' + (tpOk === tpQ.length ? '全对，去练下一组吧' : '写错的词会进错题本，明天再练一次') + '</div>'
      + '<div class="tp-tools" style="justify-content:center">'
      +   '<button class="tp-tool pri" id="tpAgain" type="button">再来一组</button>'
      +   '<button class="tp-tool" id="tpHome" type="button">回训练场</button>'
      + '</div></div>');
    const ag = document.getElementById('tpAgain');
    if (ag) ag.onclick = startRound;
    const hm = document.getElementById('tpHome');
    if (hm) hm.onclick = () => { if (typeof goTrainHome === 'function') goTrainHome(); };
  }

  function enter() {
    tpMode = tpMode || 'type';
    startRound();
  }

  /* current() 给调试/自测用：当前题的答案与进度（不影响界面） */
  window.KB_TYPEPAD = { enter: enter, start: startRound, current: () => tpQ[tpI] || null, get index() { return tpI; }, get ok() { return tpOk; } };
})();
