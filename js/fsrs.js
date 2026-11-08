/**
 * FSRS（Free Spaced Repetition Scheduler）· 按「关」分别建卡
 * ------------------------------------------------------------------
 * 一条卡 = (词, 关)，关 ∈ 认 / 读 / 写 / 用。
 * 同一个词最多 4 条卡，各自有独立的稳定度 S、难度 D、到期日 due。
 * 存储：localStorage['kb_fsrs_v1']
 *   { "อพยพ\u0001写": {S,D,due,reps,lapses,last,grade,state,pass,qs:[题型...]} , ... }
 * 纯函数 + 一张权重表，不依赖任何 UI。
 */
window.KB = window.KB || {};
(function () {
  'use strict';

  const KEY = 'kb_fsrs_v1';
  const SKILLS = ['认', '读', '写', '用'];
  const DAY = 86400000;

  /* FSRS-5 默认权重（19 项），后续可用真实复习记录拟合替换 */
  const W = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046,
    1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898,
    0.51655, 0.6621];

  const DECAY = -0.5;
  const FACTOR = 19 / 81;
  const R_TARGET = 0.9;          // 目标保留率
  const MAX_I = 3650;            // 间隔上限（天）

  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

  /* ---------- 存储 ---------- */
  let DB = null;
  function load() {
    if (DB) return DB;
    try { DB = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { DB = {}; }
    return DB;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(load())); } catch (e) { }
  }
  const keyOf = (t, skill) => String(t) + '\u0001' + skill;

  /* ---------- 时间 ---------- */
  function dayIndex(ts) { return Math.floor((ts == null ? Date.now() : ts) / DAY); }
  function today() { return dayIndex(); }

  /* ---------- FSRS 核心 ---------- */
  const initStability = g => Math.max(0.1, W[clamp(g, 1, 4) - 1]);
  const initDifficulty = g => clamp(W[4] - (g - 3) * W[5], 1, 10);
  /* 可提取性：R(t,S) = (1 + FACTOR * t/S)^DECAY */
  function retrievability(elapsedDays, S) {
    if (!S || S <= 0) return 0;
    return Math.pow(1 + FACTOR * Math.max(0, elapsedDays) / S, DECAY);
  }
  /* 稳定度 → 下次间隔（天）：I = S/FACTOR * (R^(1/DECAY) - 1) */
  function intervalFromStability(S) {
    const i = (S / FACTOR) * (Math.pow(R_TARGET, 1 / DECAY) - 1);
    return clamp(Math.round(i), 1, MAX_I);
  }

  function nextDifficulty(D, g) {
    const d0 = initDifficulty(4);
    const raw = D - W[6] * (g - 3);
    return clamp(W[7] * d0 + (1 - W[7]) * raw, 1, 10);
  }

  function nextStabilityRecall(S, D, R, g) {
    const hard = g === 2 ? W[15] : 1;
    const easy = g === 4 ? W[16] : 1;
    const inc = Math.exp(W[8]) * (11 - D) * Math.pow(S, -W[9]) *
      (Math.exp(W[10] * (1 - R)) - 1) * hard * easy;
    return Math.max(0.1, S * (1 + inc));
  }

  function nextStabilityForget(S, D, R) {
    const s = W[11] * Math.pow(D, -W[12]) * (Math.pow(S + 1, W[13]) - 1) *
      Math.exp(W[14] * (1 - R));
    return clamp(s, 0.1, S);   /* 忘了之后稳定度不能反而变高 */
  }

  function nextStabilityShort(S, g) {
    return Math.max(0.1, S * Math.exp(W[17] * (g - 3 + W[18])));
  }

  /* 空卡（新词第一次评分） */
  function blank(t, skill) {
    return { t: t, skill: skill, S: 0, D: 0, due: today(), reps: 0, lapses: 0,
      last: 0, grade: 0, state: 'new', pass: 0, qs: [] };
  }

  function get(t, skill) {
    const db = load();
    return db[keyOf(t, skill)] || blank(t, skill);
  }

  /**
   * 打分并落库。
   * g: 1 Again / 2 Hard / 3 Good / 4 Easy
   * opts: {qtype:'听写'|'选择'|'填空'|'造句'...}
   * 返回更新后的卡片（含 nextIn 天数）。
   */
  function grade(t, skill, g, opts) {
    opts = opts || {};
    const db = load();
    const k = keyOf(t, skill);
    let c = db[k] || blank(t, skill);
    const now = Date.now();
    const el = c.last ? Math.max(0, (now - c.last) / DAY) : 0;

    if (c.state === 'new' || !c.S) {
      c.S = initStability(g);
      c.D = initDifficulty(g);
    } else if (el < 1) {
      /* 同一天内再评：走短期稳定度公式，避免"当天刷题把间隔刷长" */
      c.S = nextStabilityShort(c.S, g);
      c.D = nextDifficulty(c.D, g);
    } else {
      const R = retrievability(el, c.S);
      c.S = g === 1 ? nextStabilityForget(c.S, c.D, R) : nextStabilityRecall(c.S, c.D, R, g);
      c.D = nextDifficulty(c.D, g);
    }
    if (g === 1) c.lapses = (c.lapses || 0) + 1;
    else if (g >= 3) c.pass = (c.pass || 0) + 1;

    /* 题型覆盖：两关不同题型各通过一次才算「稳定」 */
    const qs = Array.isArray(c.qs) ? c.qs : (c.qs = []);
    if (g >= 3 && opts.qtype && qs.indexOf(opts.qtype) < 0) qs.push(opts.qtype);

    c.reps = (c.reps || 0) + 1;
    c.grade = g;
    c.last = now;
    c.due = dayIndex(now + (g === 1 ? 1 : intervalFromStability(c.S)) * DAY);
    c.state = g === 1 ? 'learning'
      : (qs.length >= 2 && c.pass >= 2 ? 'stable' : 'review');
    c.t = t; c.skill = skill;
    db[k] = c;
    save();
    return Object.assign({}, c, { nextIn: Math.max(1, c.due - today()), R: retrievability(0, c.S) });
  }

  /* 到期的词（按关过滤），逾期久的排前面 */
  function due(skill, nowDay) {
    const db = load(), d = nowDay == null ? today() : nowDay, out = [];
    Object.keys(db).forEach(k => {
      const c = db[k];
      if (!c) return;
      if (skill && c.skill !== skill) return;
      if ((c.due || 0) <= d) out.push(c);
    });
    out.sort((a, b) => (a.due - b.due) || ((b.lapses || 0) - (a.lapses || 0)));
    return out;
  }

  /* 四关统计：认 X / 读 Y / 写 Z / 用 W */
  function stats() {
    const db = load();
    const out = { 认: 0, 读: 0, 写: 0, 用: 0, stable: { 认: 0, 读: 0, 写: 0, 用: 0 },
      newCards: 0, dueToday: 0, total: 0 };
    const seen = {};
    Object.keys(db).forEach(k => {
      const c = db[k];
      if (!c) return;
      seen[c.t] = true;
      out.total++;
      if (c.state === 'stable') { out.stable[c.skill] = (out.stable[c.skill] || 0) + 1; }
      /* 通过 = 至少一次 Grade>=3 */
      if ((c.pass || 0) > 0) out[c.skill] = (out[c.skill] || 0) + 1;
      if ((c.due || 0) <= today()) out.dueToday++;
    });
    out.wordsSeen = Object.keys(seen).length;
    return out;
  }

  /* 从旧 SM-2（kb_fc）迁移：只生成「认」卡，不虚构其他关的掌握 */
  function migrate() {
    const db = load();
    let n = 0;
    try {
      const old = JSON.parse(localStorage.getItem('kb_fc') || '{}') || {};
      Object.keys(old).forEach(t => {
        const r = old[t];
        if (!r || !t) return;
        if (db[keyOf(t, '认')]) return;
        const S = Math.max(0.5, Number(r.i) || 1);          /* 旧间隔当稳定度初值 */
        const D = clamp(10 - (Number(r.e) || 2.3) * 3, 1, 10); /* 旧难易 1.3–3.0 → 难度 */
        db[keyOf(t, '认')] = {
          t: t, skill: '认', S: S, D: D, reps: Number(r.n) || 1,
          lapses: 0, last: Date.now(), grade: 3, state: 'review',
          pass: 1, qs: ['选择'], due: today() + Math.max(0, Math.round(S))
        };
        n++;
      });
      if (n) save();
    } catch (e) { }
    return n;
  }

  /* 清空（调试/重来用） */
  function reset() { DB = {}; save(); }

  window.KBFSRS = {
    KEY: KEY, SKILLS: SKILLS, R_TARGET: R_TARGET,
    get: get, grade: grade, due: due, stats: stats, migrate: migrate,
    reset: reset, retrievability: retrievability, intervalFromStability: intervalFromStability,
    today: today, blank: blank, _weights: W
  };
})();
