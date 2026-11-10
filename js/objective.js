/* objective.js —— 客观掌握度（2026-11-03 新增，替代自评）
   原则：掌握度不再由使用者自己点“认识 / 很熟”决定，只由答题对错决定。
   答对一次连对 +1，答错清零；只有连对 >= 2 才写 CLS=1 已掌握，
   进度不再由本文件写：统一走 js/progress.js（KBProgress.record），本文件只做间隔调度。
   间隔调度仍复用刷卡的简化 SM-2（fcSm2），不另起一套。
   调用方：刷卡小测、复习小测、词汇练习（看答案算答错）。
   本文件不写今日进度，今日进度由调用方按原来那样各记一次，避免重复计分。 */
(function(){
  function esc(s){
    if (typeof kbEsc === 'function') return kbEsc(s);
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function shuffle(a){
    var r = a.slice();
    for (var i = r.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = r[i]; r[i] = r[j]; r[j] = t; }
    return r;
  }
  /* 四选一选项：优先同课干扰项，其次全部词表；释义相同的词不重复出现 */
  function quizOptsFor(w){
    if (!w || !w.z) return [];
    var pool = [];
    try { pool = allWords(); } catch (e) { return [w]; }
    var src = '';
    try { src = srcOf(w); } catch (e) { src = ''; }
    var seen = {};
    seen[w.z] = true;
    var same = [], rest = [];
    pool.forEach(function(x){
      if (!x || x.t === w.t || !x.z || seen[x.z]) return;
      seen[x.z] = true;
      try { if (src && srcOf(x) === src) same.push(x); else rest.push(x); } catch (e) { rest.push(x); }
    });
    var opts = shuffle(same).slice(0, 3);
    if (opts.length < 3) opts = opts.concat(shuffle(rest).slice(0, 3 - opts.length));
    return shuffle([w].concat(opts));
  }
  /* 客观计分：ok=true 答对，ok=false 答错。返回更新后的调度记录，失败返回 null */
  function objectiveGrade(t, ok){
    if (!t) return null;
    try {
      if (typeof fcRec !== 'function' || typeof fcSm2 !== 'function') {
        return null;
      }
      var rec = fcRec(t);
      var g = ok ? (rec.n >= 1 ? 3 : 2) : 0;
      var next = fcSm2(rec, g);
      if (typeof fcState !== 'undefined') fcState[t] = next;
      if (typeof fcSave === 'function') fcSave();
      return next;
    } catch (e) { return null; }
  }
  window.kbQuizOptsFor = quizOptsFor;
  window.kbObjectiveGrade = objectiveGrade;
  window.kbObjEsc = esc;
  /* 小测按钮样式：不改主页面 CSS，用注入样式，避免动其他标签页 */
  try {
    if (document && document.head && !document.getElementById('kbObjStyle')) {
      var st = document.createElement('style');
      st.id = 'kbObjStyle';
      st.textContent = '.fc-quiz,.rev-quiz{display:grid;gap:8px;margin-top:12px}'
        + '.fc-opt,.rev-opt{border:1px solid var(--line,#e6ddca);background:var(--card,#fffdf8);border-radius:12px;padding:10px 12px;font-size:15px;cursor:pointer;text-align:left;line-height:1.5;color:var(--ink,#2f2d29)}'
        + '.fc-opt:disabled,.rev-opt:disabled{cursor:default;opacity:.85}'
        + '.fc-opt.ok,.rev-opt.ok{border-color:var(--green,#2e7a53);background:var(--green-soft,#e4f0e8)}'
        + '.fc-opt.no,.rev-opt.no{border-color:var(--red,#b0433a);background:var(--red-soft,#f8e8e2)}'
        + '.fc-next,.rev-next{border:1px solid var(--teal,#34426b);background:var(--teal,#34426b);color:#fffdf8;border-radius:10px;padding:9px 14px;font-size:14px;cursor:pointer;font-weight:600;margin-top:4px}'
        + '.fc-quiz-hint,.rev-quiz-hint{font-size:12.5px;color:var(--muted,#6f6959)}';
      document.head.appendChild(st);
    }
  } catch (e) {}
})();
