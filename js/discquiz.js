/* 词汇辨析练习：从辨析卡的例句里挖空，同组易混词当选项
   与辨析页的「辨析测验」共用数据，但独立成训练场入口，成绩记进统一进度（关：用） */
(function () {
  var N = 20;
  var S = [], i = 0, okN = 0, badN = 0, on = false, lock = false, timer = null;

  function $(id) { return document.getElementById(id); }
  function norm(w) { return String(w == null ? '' : w).replace(/[…\. ]+$/, ''); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function shuffle(a) {
    var r = a.slice();
    for (var k = r.length - 1; k > 0; k--) { var j = Math.floor(Math.random() * (k + 1)); var t = r[k]; r[k] = r[j]; r[j] = t; }
    return r;
  }
  function find(ex, w) {
    if (!ex) return null;
    var i1 = ex.indexOf(w);
    if (i1 >= 0) return { i: i1, s: w };
    var w2 = norm(w);
    if (w2 && (i1 = ex.indexOf(w2)) >= 0) return { i: i1, s: w2 };
    var w3 = w2.replace(/\s+/g, '');
    if (w3 && w3 !== w2 && (i1 = ex.indexOf(w3)) >= 0) return { i: i1, s: w3 };
    return null;
  }

  function build() {
    var cards = (typeof DISC !== 'undefined' && DISC) ? DISC : [];
    var all = [];
    cards.forEach(function (c) { (c.items || []).forEach(function (it) { var n = norm(it.w); if (n) all.push(n); }); });
    var uniqAll = all.filter(function (x, k) { return all.indexOf(x) === k; });
    var pool = [];
    cards.forEach(function (c) {
      var ws = [];
      (c.items || []).forEach(function (x) { var n = norm(x.w); if (n && ws.indexOf(n) < 0) ws.push(n); });
      (c.items || []).forEach(function (it) {
        var m = find(it.ex, it.w);
        if (!m) return;
        var opts = ws.map(function (w) { return w === norm(it.w) ? m.s : w; });
        if (opts.indexOf(m.s) < 0) opts.unshift(m.s);
        if (opts.length < 4) {
          var extra = shuffle(uniqAll.filter(function (x) { return opts.indexOf(x) < 0; })).slice(0, 4 - opts.length);
          opts = opts.concat(extra);
        }
        pool.push({ ex: it.ex, ez: it.ez || '', ans: m.s, at: m.i, opts: shuffle(opts), card: c.t || '', why: c.d || '' });
      });
    });
    return shuffle(pool);
  }

  function start() {
    S = build();
    if (!S.length) { if (typeof toast === 'function') toast('辨析卡里还没有可出题的例句'); return; }
    if (S.length > N) S = S.slice(0, N);
    i = 0; okN = 0; badN = 0; on = true; lock = false;
    render();
  }

  function enter() {
    var box = $('dxBox');
    if (!box) return;
    if (S.length && i < S.length && on) { render(); return; }
    if (!on) {
      box.innerHTML = '<div class="card dcard dx-intro">'
        + '<div class="phead"><span class="badge">词汇辨析</span><span class="pno">共 ' + build().length + ' 道可练</span></div>'
        + '<div style="font-size:19px;font-weight:700;margin:6px 0 10px;">这一句该用哪个词？</div>'
        + '<div class="hint" style="line-height:1.8;">从辨析卡里抽例句，把关键词挖空，同组的易混词就是选项。'
        + '答错会进错题本，并记成「用」关的一次失败；答对按时复习。<br>每轮 20 题，答完给解析。</div>'
        + '<div style="margin-top:16px;"><button class="btn" id="dxGo">▶ 开始练习</button> '
        + '<button class="btn ghost2" id="dxHome">← 回训练场</button></div></div>';
      $('dxGo').onclick = start;
      $('dxHome').onclick = function () { if (typeof goTrainHome === 'function') goTrainHome(); };
    } else { render(); }
  }

  function head() {
    var doneN = 0;
    for (var k = 0; k < S.length; k++) if (S[k].st) doneN++;
    var pct = Math.round((doneN / Math.max(1, S.length)) * 100);
    return '<div class="dx-bar"><button class="btn ghost2 sm" id="dxExit">← 结束</button>'
      + '<div class="dx-prog"><i style="width:' + pct + '%"></i></div>'
      + '<span class="dx-num">' + Math.min(i + 1, S.length) + ' / ' + S.length + ' · 对 ' + okN + ' 错 ' + badN +
      ' · 已答 ' + doneN + '</span></div>'
      + '<div class="dx-nav"><button class="btn ghost2 sm" id="dxPrev"' + (i <= 0 ? ' disabled' : '') + '>← 上一题</button>'
      + '<button class="btn ghost2 sm" id="dxNext">下一题 →</button></div>';
  }

  function wireNav() {
    var pv = $('dxPrev'), nx = $('dxNext');
    if (pv) pv.onclick = function () { if (i > 0) { i--; render(); } };
    if (nx) nx.onclick = function () {
      if (i + 1 < S.length) { i++; render(); return; }
      var left = 0;
      for (var k = 0; k < S.length; k++) if (!S[k].st) left++;
      if (left) { if (typeof toast === 'function') toast('还有 ' + left + ' 题没答，已经带你回去'); 
        for (var j = 0; j < S.length; j++) if (!S[j].st) { i = j; break; }
        render(); return; }
      done();
    };
  }

  function render() {
    var box = $('dxBox');
    if (!box) return;
    if (i >= S.length) { done(); return; }
    var q = S[i];
    lock = !!q.st;
    var before = q.ex.slice(0, q.at), after = q.ex.slice(q.at + q.ans.length);
    box.innerHTML = head()
      + '<div class="card dcard">'
      + '<div class="phead"><span class="badge">' + esc(q.card) + '</span><span class="pno">选词填空</span></div>'
      + '<div class="pex" style="font-size:19px;"><span class="th">' + esc(before) + '<span class="dqgap" id="dxGap">____</span>' + esc(after) + '</span>'
      + '<button class="spk" id="dxSay" aria-label="朗读整句">🔊</button></div>'
      + (q.ez ? '<div class="pez">' + esc(q.ez) + '</div>' : '')
      + '<div class="dx-opts">' + q.opts.map(function (o, k) {
          var cls = '';
          if (q.st) {
            if (norm(o) === norm(q.ans)) cls = ' ok';
            else if (q.st.k === k) cls = ' no';
          }
          return '<button class="dqopt th' + cls + '" data-k="' + k + '"' + (q.st ? ' disabled' : '') + '>' + esc(o) + '</button>';
        }).join('') + '</div>'
      + '<div class="dqfb" id="dxFb"></div></div>';

    try { window.scrollTo(0, 0); } catch (e) {}
    $('dxExit').onclick = stop;
    $('dxSay').onclick = function () { if (typeof speakThai === 'function') speakThai(q.ex); };
    wireNav();
    if (q.st) {
      /* 回看：把当时的空、对错、解析还原出来 */
      var gp = $('dxGap');
      if (gp) { gp.textContent = q.ans; gp.classList.add(q.st.good ? 'ok' : 'no'); }
      var fb0 = $('dxFb');
      if (fb0) {
        fb0.innerHTML = (q.st.good ? '<div class="dx-res ok">✓ 对了</div>'
          : '<div class="dx-res no">✗ 这里应该用 <b class="th">' + esc(q.ans) + '</b></div>')
          + (q.why ? '<div class="dx-why">' + esc(q.why) + '</div>' : '')
          + '<div class="hint" style="margin-top:8px;">已作答，可用上面的「上一题 / 下一题」回看其它题。</div>';
      }
      return;
    }
    box.querySelectorAll('.dqopt').forEach(function (b) {
      b.onclick = function () { answer(q, +b.dataset.k, box); };
    });
  }

  function answer(q, k, box) {
    if (lock) return;
    lock = true;
    var pick = q.opts[k];
    var good = norm(pick) === norm(q.ans);
    box.querySelectorAll('.dqopt').forEach(function (x) {
      x.disabled = true;
      var o = q.opts[+x.dataset.k];
      if (norm(o) === norm(q.ans)) x.classList.add('ok');
      else if (x === box.querySelectorAll('.dqopt')[k]) x.classList.add('no');
    });
    var gap = $('dxGap');
    if (gap) { gap.textContent = q.ans; gap.classList.add(good ? 'ok' : 'no'); }
    var fb = $('dxFb');
    if (fb) {
      fb.innerHTML = (good
        ? '<div class="dx-res ok">✓ 对了</div>'
        : '<div class="dx-res no">✗ 这里应该用 <b class="th">' + esc(q.ans) + '</b></div>')
        + (q.why ? '<div class="dx-why">' + esc(q.why) + '</div>' : '');
    }
    if (typeof speakThai === 'function') speakThai(q.ex);
    if (good) okN++; else badN++;
    q.st = { k: k, good: good };
    try {
      if (window.KBProgress && KBProgress.record) {
        KBProgress.record({ t: q.ans, skill: '用', ok: good, training: '词汇辨析练习' });
      } else if (!good && typeof addWrong === 'function') {
        addWrong({ t: q.ans, z: '', kind: '词汇辨析练习', mode: '选词填空', src: q.card, ex: q.ex });
      }
    } catch (e) {}
    /* 不自动跳题：作答后停在本题，用「下一题」自己走，也能「上一题」回去看 */
    var nx = $('dxNext');
    if (nx && !nx.dataset.armed) { nx.dataset.armed = '1'; nx.classList.add('primary-hint'); }
  }

  function done() {
    var box = $('dxBox');
    var n = S.length, pct = Math.round((okN / Math.max(1, n)) * 100);
    box.innerHTML = head()
      + '<div class="card dcard" style="text-align:center;">'
      + '<div style="font-size:40px;">' + (pct >= 90 ? '🏆' : pct >= 70 ? '👏' : '💪') + '</div>'
      + '<div style="font-size:30px;font-weight:700;margin:6px 0;">' + pct + '%</div>'
      + '<div class="hint">对 ' + okN + ' / ' + n + ' 题 · 错 ' + badN + ' 次，错的已经进错题本</div>'
      + '<div style="margin-top:16px;"><button class="btn" id="dxAgain">🔄 再来一轮</button> '
      + '<button class="btn ghost2" id="dxBack">← 回训练场</button></div></div>';
    $('dxAgain').onclick = start;
    $('dxBack').onclick = function () { if (typeof goTrainHome === 'function') goTrainHome(); };
  }

  function stop() {
    on = false; clearTimeout(timer);
    document.querySelectorAll('#pane-discquiz .pane, #pane-discquiz').forEach(function () {});
    if (typeof goTrainHome === 'function') goTrainHome(); else enter();
  }

  window.dxEnter = enter;
  window.dxStart = start;
})();
