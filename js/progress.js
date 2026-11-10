/**
 * 统一学习进度模型 v2
 * ------------------------------------------------------------------
 * 主键 = 词书（课程）+ 单词。四类训练（四关 / 刷卡 / 百词斩 / 练习复习）
 * 只通过本模块写进度，不再各自维护私有计数。
 *
 * 状态三档：0 未学 / 1 学习中 / 2 已掌握
 *   已掌握 = 认、读、写、用 四关都通过过，且不在错题本里
 *
 * 存储（同一份，可随备份导出）：
 *   kb_progress_v2 = { schema:2, courses:{ 课程:{ 词:{ st, sk:{认,读,写,用}, ok, n, upd } } },
 *                      meta:{ migrated, pending:[{t,from,raw}], ver } }
 *   kb_wrongs_v2   = [{ t, course, skill, training, n, streak, first, last }]
 *   kb_active_course = 当前词书
 *
 * kb_cls / kb_wrongs 作为只读投影（词表与旧页面仍读），由本模块单向写出。
 */
(function () {
  'use strict';

  const PKEY = 'kb_progress_v2';
  const WKEY = 'kb_wrongs_v2';
  const CKEY = 'kb_active_course';
  const OUT = 2;                     /* 错题连续答对几次出本 */
  const SKILLS = ['认', '读', '写', '用'];

  let DB = null, WR = null;

  function read(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

  function blank() { return { schema: 2, courses: {}, meta: { migrated: 0, pending: [], ver: '' } }; }
  function load() {
    if (DB) return DB;
    DB = read(PKEY, null) || blank();
    if (!DB.courses) DB.courses = {};
    if (!DB.meta) DB.meta = { migrated: 0, pending: [], ver: '' };
    if (!Array.isArray(DB.meta.pending)) DB.meta.pending = [];
    return DB;
  }
  function loadW() {
    if (WR) return WR;
    WR = read(WKEY, null) || [];
    if (!Array.isArray(WR)) WR = [];
    return WR;
  }
  function save() { write(PKEY, DB); syncLegacy(); }
  function saveW() { write(WKEY, WR); }
  const KEY = (t) => String(t || '').replace(/[\s\u200b]+/g, '').trim();

  /* ---------- 词表索引：词 → 词书 ---------- */
  let IDX = null;
  function index() {
    if (IDX) return IDX;
    IDX = {};
    let ws = [];
    try { ws = (typeof allWords === 'function' ? allWords() : []) || []; } catch (e) { ws = []; }
    ws.forEach(w => {
      if (!w || typeof w.t !== 'string' || !w.t.trim()) return;
      const k = KEY(w.t);
      if (IDX[k]) return;
      let course = '';
      try { course = (typeof courseOfKey === 'function' ? courseOfKey(w.lesson) : '') || ''; } catch (e) { course = ''; }
      IDX[k] = { t: w.t, lesson: w.lesson || '', course: course || '未归类' };
    });
    return IDX;
  }
  function courses() {
    let cs = [];
    try { cs = (typeof COURSES !== 'undefined' && Array.isArray(COURSES)) ? COURSES.slice() : []; } catch (e) { cs = []; }
    if (!cs.length) {
      const set = {};
      Object.keys(index()).forEach(k => { set[index()[k].course] = 1; });
      cs = Object.keys(set);
    }
    return cs;
  }
  function courseOfWord(t) { const e = index()[KEY(t)]; return e ? e.course : ''; }
  function known(t) { return !!index()[KEY(t)]; }

  /* ---------- 状态读写 ---------- */
  function rec(course, t, mk) {
    const db = load();
    if (!db.courses[course]) db.courses[course] = {};
    const cell = db.courses[course][KEY(t)];
    if (cell) return cell;
    if (!mk) return null;
    return (db.courses[course][KEY(t)] = { st: 0, sk: {}, ok: 0, n: 0, upd: 0 });
  }
  function stat(t) {
    const c = courseOfWord(t);
    const cell = c ? rec(c, t, false) : null;
    return cell || { st: 0, sk: {}, ok: 0, n: 0, upd: 0 };
  }
  function stOf(t) { return stat(t).st; }

  function recompute(cell) {
    const passed = SKILLS.filter(s => (cell.sk[s] || 0) >= 1).length;
    const inBook = WR.some(m => m.t === cell._t && !m.out);
    cell.st = (passed === 4 && !inBook) ? 2 : (passed > 0 ? 1 : 0);
  }

  /* 唯一写入口：任何训练答完一题都走这里 */
  function record(opt) {
    const t = opt && opt.t;
    if (!t || !known(t)) return null;
    const course = opt.course || courseOfWord(t);
    const skill = opt.skill || '认';
    const ok = !!opt.ok;
    const db = load();
    const cell = rec(course, t, true);
    cell._t = t;
    if (!cell.sk) cell.sk = {};
    cell.n = (cell.n || 0) + 1;
    cell.upd = Date.now();
    if (ok) {
      cell.ok = (cell.ok || 0) + 1;
      cell.sk[skill] = Math.max(1, cell.sk[skill] || 0);
    } else {
      cell.sk[skill] = 0;
    }
    /* 错题本：答错入本 / 答对累积 streak */
    let outInfo = null;
    if (!ok) {
      outInfo = mistakeIn({ t: t, course: course, skill: skill, training: opt.training || '' });
    } else {
      outInfo = mistakeHit(t, skill);
    }
    cell.st = 0;
    const passed = SKILLS.filter(s => (cell.sk[s] || 0) >= 1).length;
    const inBook = WR.some(m => m.t === t);
    cell.st = (passed === 4 && !inBook) ? 2 : (passed > 0 ? 1 : 0);
    save(); saveW();
    return { st: cell.st, sk: cell.sk, fromBook: outInfo };
  }

  /* ---------- 错题本 ---------- */
  function mistakeIn(o) {
    const W = loadW();
    const k = KEY(o.t);
    let m = W.find(x => x.t === o.t);
    if (!m) {
      m = { t: o.t, course: o.course || courseOfWord(o.t), skill: o.skill || '认', training: o.training || '',
        n: 0, streak: 0, first: Date.now(), last: 0, reasons: {}, out: 0 };
      W.push(m);
    }
    m.n++; m.streak = 0; m.last = Date.now();
    m.skill = o.skill || m.skill;
    m.training = o.training || m.training;
    m.reasons = m.reasons || {};
    const r = o.reason || '拼写';
    m.reasons[r] = (m.reasons[r] || 0) + 1;
    saveW();
    return { added: m.n === 1 };
  }
  function mistakeHit(t, skill) {
    const W = loadW();
    const m = W.find(x => x.t === t);
    if (!m) return null;
    if (skill && m.skill && skill !== m.skill) {
      /* 换关答对也算一次干净回忆，但 streak 只统计同一关 */
      m.streak = 0;
      saveW();
      return { streak: 0 };
    }
    m.streak = (m.streak || 0) + 1;
    let removed = false;
    if (m.streak >= OUT) {
      m.out = 1; m.outAt = Date.now(); removed = true;
    }
    saveW();
    return { streak: m.streak, removed: removed };
  }
  function mistakes() { return loadW().filter(m => !m.out); }
  function mistakesAll() { return loadW(); }
  function dropMistake(t) {
    const W = loadW();
    WR = W.filter(m => m.t !== t);
    saveW();
    const cell = rec(courseOfWord(t), t, false);
    if (cell) { cell.st = Math.min(cell.st || 1, 1); save(); }
  }

  /* ---------- 词书 ---------- */
  function activeCourse() { try { return localStorage.getItem(CKEY) || ''; } catch (e) { return ''; } }
  function setActiveCourse(c) {
    try { localStorage.setItem(CKEY, c || ''); } catch (e) { }
    IDX && null;
    return activeCourse();
  }
  function courseCount(c) {
    const idx = index(), db = load();
    let total = 0;
    Object.keys(idx).forEach(k => { if (idx[k].course === c) total++; });
    const cell = db.courses[c] || {};
    let learned = 0, mastered = 0;
    Object.keys(cell).forEach(k => {
      if (cell[k].st === 2) mastered++;
      else if (cell[k].st === 1) learned++;
    });
    return { total: total, learned: learned, mastered: mastered,
      pct: total ? Math.round((mastered / total) * 100) : 0 };
  }

  /* ---------- 兼容迁移 ---------- */
  function migrate() {
    const db = load();
    if (db.meta && db.meta.migrated) return { skipped: true };
    const pending = [];
    db.meta.pending = pending;
    const push = (t, from, raw) => {
      const k = KEY(t);
      if (!k) return;
      if (!known(t)) { pending.push({ t: t, from: from, raw: raw || null }); return; }
      const course = courseOfWord(t);
      const cell = rec(course, t, true);
      cell._t = t;
      if (!cell.sk) cell.sk = {};
      cell.sk.认 = Math.max(cell.sk.认 || 0, 1);
    };

    /* kb_fsrs_v1：{ "词\u0001关": {skill, S, pass} } */
    try {
      const fsrs = read('kb_fsrs_v1', {}) || {};
      Object.keys(fsrs).forEach(k => {
        const c = fsrs[k]; if (!c) return;
        const t = k.split('\u0001')[0];
        if (!known(t)) { pending.push({ t: t, from: 'kb_fsrs_v1', raw: c.skill }); return; }
        const course = courseOfWord(t);
        const cell = rec(course, t, true);
        cell._t = t; cell.sk = cell.sk || {};
        if ((c.pass || 0) > 0 && c.skill) cell.sk[c.skill] = 1;
      });
    } catch (e) { }

    /* kb_cls：{ 词: 1|2|3 }，1 最熟 */
    try {
      const cls = read('kb_cls', {}) || {};
      Object.keys(cls).forEach(t => {
        if (!known(t)) { pending.push({ t: t, from: 'kb_cls', raw: cls[t] }); return; }
        const course = courseOfWord(t);
        const cell = rec(course, t, true);
        cell._t = t; cell.sk = cell.sk || {};
        cell.sk.认 = 1;
        if (cls[t] <= 1) cell.sk.读 = 1;
      });
    } catch (e) { }

    /* kb_mastery：{ 词: 0..3 }，>=2 视为已掌握 */
    try {
      const ms = read('kb_mastery', {}) || {};
      Object.keys(ms).forEach(t => {
        if (!known(t)) { pending.push({ t: t, from: 'kb_mastery', raw: ms[t] }); return; }
        const cell = rec(courseOfWord(t), t, true);
        cell._t = t; cell.sk = cell.sk || {};
        cell.sk.认 = 1;
        if (ms[t] >= 2) { cell.sk.读 = 1; cell.sk.写 = 1; }
      });
    } catch (e) { }

    /* kb_wrongs：旧错题 [{t,...}] */
    try {
      const ws = read('kb_wrongs', []) || [];
      ws.forEach(w => {
        const t = w && (w.t || w.word || w.w);
        if (!t || !known(t)) { if (t) pending.push({ t: t, from: 'kb_wrongs', raw: null }); return; }
        const W = loadW();
        if (W.some(x => x.t === t)) return;
        W.push({ t: t, course: courseOfWord(t), skill: '认', training: '旧错题本',
          n: 1, streak: 0, first: w.first || Date.now(), last: Date.now(), reasons: {}, out: 0 });
      });
      saveW();
    } catch (e) { }

    /* 重算状态 */
    Object.keys(db.courses).forEach(c => {
      Object.keys(db.courses[c]).forEach(k => {
        const cell = db.courses[c][k];
        cell._t = cell._t || k;
        const passed = SKILLS.filter(s => (cell.sk[s] || 0) >= 1).length;
        const inBook = loadW().some(m => m.t === cell._t);
        cell.st = (passed === 4 && !inBook) ? 2 : (passed > 0 ? 1 : 0);
      });
    });
    db.meta.migrated = 1;
    db.meta.ver = '1.8.0';
    save();
    return { pending: pending.length, from: ['kb_fsrs_v1', 'kb_cls', 'kb_mastery', 'kb_wrongs'] };
  }

  /* ---------- 旧视图投影 ---------- */
  /* kb_cls 的约定：1 最熟 / 2 中等 / 3 不熟 */
  function syncLegacy() {
    const db = load(), out = {};
    Object.keys(db.courses).forEach(c => {
      const cc = db.courses[c];
      Object.keys(cc).forEach(k => {
        const s = cc[k].st;
        out[cc[k]._t || k] = s === 2 ? 1 : (s === 1 ? 2 : 3);
      });
    });
    write('kb_cls', out);
    /* 旧错题本数组也保留投影，备份/导出仍能读到 */
    write('kb_wrongs', loadW().filter(m => !m.out).map(m => ({ t: m.t, z: '', n: m.n, first: m.first })));
  }

  function stats() {
    const c = activeCourse();
    const cs = courseCount(c || '');
    const book = mistakes().length;
    return { course: c, total: cs.total, learned: cs.learned, mastered: cs.mastered,
      pct: cs.pct, inBook: book, pending: load().meta.pending.length };
  }


  /* 当前词书下每一关通过过的词数 */
  function skillCounts(course) {
    const c = course || activeCourse();
    const cell = load().courses[c] || {};
    const out = { '认': 0, '读': 0, '写': 0, '用': 0 };
    Object.keys(cell).forEach(k => {
      const sk = cell[k].sk || {};
      SKILLS.forEach(x => { if ((sk[x] || 0) >= 1) out[x]++; });
    });
    return out;
  }

  /* ---------- 词书选择（所有训练的前置门） ---------- */
  function openPicker(nextPane) {
    const pane = document.getElementById('pane-coursepick');
    const box = document.getElementById('coursePickBox');
    if (!pane || !box) return false;
    document.querySelectorAll('.pane').forEach(p => p.classList.remove('on'));
    pane.classList.add('on');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const cur = activeCourse();
    const esc = (x) => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    box.innerHTML = '<div class="cp-wrap"><h2>先选一本词书</h2>' +
      '<p class="cp-sub">所有训练都按词书独立记录进度。选定后才能进入训练，换词书会先确认。</p>' +
      '<div class="cp-list">' + courses().map(c => {
        const cs = courseCount(c);
        return '<button class="cp-card' + (c === cur ? ' on' : '') + '" data-c="' + esc(c) + '" type="button">' +
          '<span class="cp-n">' + esc(c) + '</span>' +
          '<span class="cp-m">' + cs.mastered + ' / ' + cs.total + ' 已掌握 · 学习中 ' + cs.learned + '</span>' +
          '<span class="cp-bar"><i style="width:' + cs.pct + '%"></i></span>' +
          '</button>';
      }).join('') + '</div>' +
      (function () {
        const pend = load().meta.pending;
        if (!pend.length) return '';
        return '<div class="cp-pendbox"><p class="cp-pend">有 ' + pend.length +
          ' 条旧进度对不上现在的词表（旧词被删或改写了）。它们留着，不会丢，也不会算进任何词书：</p><ul class="cp-pendlist">' +
          pend.slice(0, 12).map(x => '<li><b>' + esc(x.t) + '</b><small>来自 ' + esc(x.from) + '</small>' +
            '<button type="button" data-drop="' + esc(x.t) + '">忽略</button></li>').join('') +
          '</ul></div>';
      })() +
      '<p class="cp-tip">换词书时进度不会互相覆盖：每本书各记各的。</p></div>';
    box.querySelectorAll('[data-drop]').forEach(b => {
      b.onclick = () => { KBProgress.resolvePending(b.getAttribute('data-drop'), ''); openPicker(nextPane); };
    });
    box.querySelectorAll('.cp-card').forEach(b => {
      b.onclick = () => {
        const c = b.getAttribute('data-c');
        if (cur && cur !== c && !confirm('切换到《' + c + '》？\n两个词书的进度分别保存，不会被覆盖。')) return;
        setActiveCourse(c);
        if (nextPane && typeof goPane === 'function') goPane(nextPane);
        else if (typeof goTrainHome === 'function') goTrainHome();
        else openPicker();
      };
    });
    return true;
  }

  /* 统一入口守卫：带词书要求的页面先过选书 */
  const GATED = { fourgate: 1, flash: 1, ex: 1, wrongbook: 1, review: 1 };
  function gate(paneName) {
    if (!GATED[paneName]) return false;
    if (activeCourse()) return false;
    return openPicker(paneName);
  }

  window.KBProgress = {
    version: 2, OUT: OUT, SKILLS: SKILLS,
    courses: courses, courseOfWord: courseOfWord, known: known,
    activeCourse: activeCourse, setActiveCourse: setActiveCourse, courseCount: courseCount,
    stat: stat, status: stOf, record: record,
    mistakes: mistakes, mistakesAll: mistakesAll, dropMistake: dropMistake,
    migrate: migrate, stats: stats,
    pending: function () { return load().meta.pending.slice(); },
    resolvePending: function (t, course) {
      const db = load();
      const i = db.meta.pending.findIndex(x => x.t === t);
      if (i >= 0) db.meta.pending.splice(i, 1);
      if (course && known(t)) {
        const cell = rec(course, t, true);
        cell._t = t; cell.sk = cell.sk || {}; cell.sk.认 = 1;
        save();
      } else { save(); }
      return db.meta.pending.length;
    },
    reset: function () { DB = blank(); WR = []; save(); saveW(); },
    skillCounts: skillCounts, openPicker: openPicker, gate: gate
  };

  /* 首次加载自动迁移旧进度（等词表索引可用） */
  (function boot() {
    const run = (tryN) => {
      try {
        if (load().meta.migrated) return;
        if (typeof allWords !== 'function' || !allWords().length) {
          if (tryN < 20) setTimeout(() => run(tryN + 1), 200);
          return;
        }
        migrate();
      } catch (e) { if (tryN < 20) setTimeout(() => run(tryN + 1), 200); }
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => run(0));
    else setTimeout(() => run(0), 50);
  })();
})();
