/**
 * wordinfo.js —— 百词斩式单词详情页
 * 词表点卡片进入；数据 = 词表 + 词汇讲解 + 课文例句 + 辨析 本地聚合，
 * 另提供 LONGDO / thai2english / Google 翻译 在线查词按钮。
 */

/* ── 打开详情页（全局入口，词表/点词弹层都可调用） ── */
function openWordInfo(t) {
  const w = (typeof allWords === 'function' ? allWords() : []).find(x => x.t === t);
  if (!w) { toast && toast('词库里没有这个词：' + t); return; }
  renderWordInfo(w);
  /* 切到详情面板 */
  document.querySelectorAll('.pane').forEach(p => p.classList.remove('on'));
  const pane = document.getElementById('pane-wordInfo');
  if (pane) pane.classList.add('on');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── 数据聚合 ── */
function wiVok(t) {
  try { return (window.KB_VOK || []).find(v => v.w === t) || null; } catch (e) { return null; }
}
function wiSents(w) {
  const out = [];
  const seen = new Set();
  // 词汇讲解例句优先
  const vok = wiVok(w.t);
  if (vok && vok.sents) vok.sents.forEach(s => {
    if (s.t && !seen.has(s.t)) { seen.add(s.t); out.push(s); }
  });
  // 课文里含该词的句子
  try {
    const S = window.KB_SENTS || {};
    Object.keys(S).forEach(lesson => {
      const paras = S[lesson];
      if (!Array.isArray(paras)) return;
      paras.forEach(para => {
        if (!Array.isArray(para)) return;
        para.forEach(sent => {
          if (Array.isArray(sent) && sent[0] && sent[0].indexOf(w.t) >= 0 && !seen.has(sent[0])) {
            seen.add(sent[0]);
            out.push({ t: sent[0], z: sent[1] || '', src: lesson });
          }
        });
      });
    });
  } catch (e) {}
  return out;
}
function wiDiscGroups(t) {
  try { return (window.DISC || []).filter(c => (c.items || []).some(it => it.w === t)); } catch (e) { return []; }
}
function wiSimilar(w, limit) {
  limit = limit || 8;
  const wt = String(w.t || '');
  if (!wt) return [];
  const first = wt.charAt(0);
  const last = wt.charAt(wt.length - 1);
  const pool = (typeof allWords === 'function' ? allWords() : []).filter(x => x.t !== wt);
  const starts = pool.filter(x => x.t.startsWith(wt.substring(0, 2)));
  const ends = pool.filter(x => x.t.endsWith(last) && !starts.includes(x));
  return starts.concat(ends).slice(0, limit);
}
function wiPatterns(t) {
  try { return (window.allPatterns ? allPatterns() : []).filter(p => (p.ex || '').indexOf(t) >= 0); } catch (e) { return []; }
}

/* ── 渲染 ── */
let wiTab = 'def';   // def=释义 | sents=例句 | colloc=搭配用法 | rel=相关词
function renderWordInfo(w) {
  const box = document.getElementById('wordInfoBox');
  if (!box) return;
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const vok = wiVok(w.t);
  const sents = wiSents(w);
  const discs = wiDiscGroups(w.t);
  const similar = wiSimilar(w);
  const pats = wiPatterns(w.t);

  const enc = encodeURIComponent(w.t);
  const tabs = [
    ['def', '📖 释义'],
    ['sents', '💬 例句 ' + sents.length],
    ['colloc', '🧩 搭配用法' + ((vok && vok.note) || pats.length ? '' : '')],
    ['rel', '🔍 相关词 ' + (similar.length + discs.length)]
  ];

  let body = '';
  if (wiTab === 'def') {
    body += '<div class="wi-block">'
      + '<div class="wi-lbl">释义</div>'
      + '<div class="wi-def">' + esc(w.z || '（暂无释义）') + '</div>'
      + '<div class="wi-meta-line">'
      + (w.p ? '<span class="wi-chip">' + esc(w.p) + '</span>' : '')
      + (w.r ? '<span class="wi-chip">读音 ' + esc(w.r) + '</span>' : '')
      + '<span class="wi-chip src">📚 ' + esc(w.lesson || srcOf(w) || '') + '</span>'
      + '</div></div>';
    if (vok && vok.note) {
      body += '<div class="wi-block"><div class="wi-lbl">📌 词汇讲解</div>'
        + '<div class="wi-note">' + esc(vok.note).replace(/\n/g, '<br>') + '</div></div>';
    }
    body += '<div class="wi-block"><div class="wi-lbl">🌐 网上查词（更全的释义 / 词源 / 用法）</div>'
      + '<div class="wi-links">'
      + '<a class="wi-link" target="_blank" rel="noopener" href="https://dict.longdo.com/search/' + enc + '">LONGDO 泰英词典</a>'
      + '<a class="wi-link" target="_blank" rel="noopener" href="https://www.thai2english.com/search/' + enc + '">thai2english</a>'
      + '<a class="wi-link" target="_blank" rel="noopener" href="https://translate.google.com/?sl=th&tl=zh-CN&text=' + enc + '&op=translate">Google 翻译</a>'
      + '</div>'
      + '<div class="wi-hint">联网后点上面的词典按钮，查更完整的释义、例句和词源。</div></div>';
  }
  else if (wiTab === 'sents') {
    body += sents.length
      ? '<div class="wi-block">' + sents.map(s =>
          '<div class="wi-sent"><div class="wi-sent-th"><button class="spk wi-spk" data-say="' + esc(s.t) + '">🔊</button> ' + esc(s.t) + '</div>'
          + (s.z ? '<div class="wi-sent-zh">' + esc(s.z) + '</div>' : '')
          + (s.src ? '<div class="wi-sent-src">📚 ' + esc(s.src) + '</div>' : '')
          + '</div>').join('') + '</div>'
      : '<div class="wi-empty">暂无例句，去「🌐 网上查词」看词典例句。</div>';
  }
  else if (wiTab === 'colloc') {
    let has = false;
    if (vok && vok.note && /常用结构|搭配|用法/.test(vok.note)) {
      has = true;
      body += '<div class="wi-block"><div class="wi-lbl">📌 用法与搭配（来自词汇讲解）</div>'
        + '<div class="wi-note">' + esc(vok.note).replace(/\n/g, '<br>') + '</div></div>';
    }
    if (pats.length) {
      has = true;
      body += '<div class="wi-block"><div class="wi-lbl">🧩 相关句型</div>'
        + pats.map(p => '<div class="wi-sent"><div class="wi-sent-th"><b>' + esc(p.p) + '</b> — ' + esc(p.z || '') + '</div>'
          + (p.ex ? '<div class="wi-sent-th" style="font-size:15px;"><button class="spk wi-spk" data-say="' + esc(p.ex) + '">🔊</button> ' + esc(p.ex) + '</div>' : '')
          + (p.ez ? '<div class="wi-sent-zh">' + esc(p.ez) + '</div>' : '')
          + '</div>').join('') + '</div>';
    }
    if (!has) body += '<div class="wi-empty">暂无搭配数据。可以点「🌐 网上查词」在词典里看词组搭配。</div>';
  }
  else if (wiTab === 'rel') {
    body += similar.length
      ? '<div class="wi-block"><div class="wi-lbl">🔍 形近 / 相关词（点击查看详情）</div>'
        + similar.map(x => '<button class="wi-rel" data-w="' + esc(x.t) + '" type="button">'
          + '<b class="th">' + esc(x.t) + '</b><span>' + esc(x.z || '') + '</span></button>').join('')
        + '</div>'
      : '<div class="wi-block"><div class="wi-lbl">🔍 形近 / 相关词</div><div class="wi-empty">词库里暂无形近词。</div></div>';
    if (discs.length) {
      body += '<div class="wi-block"><div class="wi-lbl">📐 易混辨析</div>'
        + discs.map(c => '<div class="wi-note"><b>' + esc(c.t) + '</b><br>'
          + (c.items || []).map(it => '• <b>' + esc(it.w) + '</b> ' + esc(it.z || '')).join('<br>')
          + (c.d ? '<br>💡 ' + esc(c.d) : '') + '</div>').join('') + '</div>';
    }
  }

  box.innerHTML = ''
    /* 头部：词 + 读音 + 释义 */
    + '<div class="wi-head">'
    +   '<button class="wi-back" id="wiBack" type="button">← 返回词表</button>'
    +   '<div class="wi-word">' + esc(w.t) + '</div>'
    +   (w.r ? '<div class="wi-phone">🔊 ' + esc(w.r) + '</div>' : '')
    +   '<div class="wi-def-main">' + (w.p ? '<span class="wi-pos">' + esc(w.p) + '</span> ' : '') + esc(w.z || '') + '</div>'
    + '</div>'
    /* Tab */
    + '<div class="wi-tabs">'
    + tabs.map(t => '<button class="wi-tab' + (wiTab === t[0] ? ' on' : '') + '" data-wit="' + t[0] + '" type="button">' + t[1] + '</button>').join('')
    + '</div>'
    /* 内容 */
    + '<div class="wi-body">' + body + '</div>';

  /* 绑定 */
  box.querySelectorAll('[data-wit]').forEach(b => {
    b.onclick = () => { wiTab = b.dataset.wit; renderWordInfo(w); };
  });
  box.querySelectorAll('.wi-spk').forEach(b => {
    b.onclick = () => {
      const s = b.dataset.say;
      if (typeof KB !== 'undefined' && KB.audio && KB.audio.speak) KB.audio.speak(s);
      else if (typeof speakThai === 'function') speakThai(s);
    };
  });
  const back = document.getElementById('wiBack');
  if (back) back.onclick = () => {
    document.querySelectorAll('.pane').forEach(p => p.classList.remove('on'));
    const lp = document.getElementById('pane-list');
    if (lp) lp.classList.add('on');
  };
  box.querySelectorAll('.wi-rel[data-w]').forEach(b => {
    b.onclick = () => { wiTab = 'def'; openWordInfo(b.dataset.w); };
  });
  /* 头部发音 */
  const head = box.querySelector('.wi-phone');
  if (head) head.style.cursor = 'pointer', head.onclick = () => {
    if (typeof KB !== 'undefined' && KB.audio && KB.audio.speak) KB.audio.speak(w.t);
    else if (typeof speakThai === 'function') speakThai(w.t);
  };
}
