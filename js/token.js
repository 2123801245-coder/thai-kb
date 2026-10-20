/* token.js —— 泰语长句分词与「点词看讲解」
   词库三层：①生词表 words.json（t/r/z）②词汇讲解 vok.json（w/z/note/sents）
   ③词典库 lex.json（build-lex.py 生成：句子里的全部词，人工优先、机译兜底标 auto）。
   最长匹配切分：命中词条才变成可点词，没收录的字符原样保留 —— 不猜词义、不虚构讲解。 */
(function(){
  let IDX = null, MAXLEN = 2, POP = null, CUR = null;
  const THAI = /[\u0E00-\u0E7F]/;
  const PURE = /^[\u0E00-\u0E7F]+$/;
  const MARK = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/;   /* 声调符号与元音附标：不能作为词首 */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function put(w, info){
    if(!w) return;
    w = String(w).trim();
    if(!PURE.test(w)) return;                     /* 含数字/缩写点/空格的词条不参与切分 */
    if(w.length < 2 && !info) return;             /* 单字只在词典库显式收录时才切 */
    let e = IDX.get(w);
    if(!e){
      e = { w: w, z: '', r: '', lessons: [], notes: [], auto: 0 };
      IDX.set(w, e);
      if(w.length > MAXLEN) MAXLEN = w.length;
    }
    if(!info) return;
    if(info.z && !e.z){ e.z = info.z; e.auto = info.auto ? 1 : 0; }
    if(info.p && !e.p) e.p = info.p;
    if(info.r && !e.r) e.r = info.r;
    if(info.lesson && e.lessons.indexOf(info.lesson) < 0) e.lessons.push(info.lesson);
    if(info.note) e.notes.push({ note: info.note, src: info.src || '', sents: info.sents || [] });
  }

  function build(){
    if(IDX) return IDX;
    IDX = new Map();
    try{ (typeof allWords === 'function' ? allWords() : []).forEach(w => put(w.t, { z: w.z, r: w.r, lesson: (typeof srcOf === 'function' ? srcOf(w) : w.lesson) })); }catch(e){}
    try{ (typeof VOK !== 'undefined' ? VOK : []).forEach(it => put(it.w, { z: it.z, note: it.note, src: it.src, sents: it.sents })); }catch(e){}
    /* 词典库：句子里的全部词（人工释义优先，机译兜底） */
    try{
      const raw = (window.KB_RAW && window.KB_RAW['lex.json']) || null;
      const lex = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
      if(lex) Object.keys(lex).forEach(w => put(w, { z: lex[w] && lex[w].z, p: lex[w] && lex[w].p, auto: lex[w] && lex[w].auto }));
    }catch(e){}
    return IDX;
  }

  /* 泰语串 → 带 <b class="kw"> 的 HTML；非泰文（空格、标点、数字）原样输出 */
  function render(text){
    build();
    text = String(text == null ? '' : text);
    let out = '', plain = '', i = 0;
    const flush = () => { if(plain){ out += esc(plain); plain = ''; } };
    while(i < text.length){
      const ch = text[i];
      if(!THAI.test(ch)){ plain += ch; i++; continue; }
      let hit = '';
      const maxL = Math.min(MAXLEN, text.length - i);
      for(let L = maxL; L >= 1; L--){
        const cand = text.substr(i, L);
        if(!IDX.has(cand)) continue;
        /* 词边界校验：后面紧跟声调符号/元音附标，说明把词切断了（如 มาก|่อน） */
        if(MARK.test(text[i + L] || '')) continue;
        hit = cand; break;
      }
      if(hit){
        flush();
        out += '<b class="kw" data-k="' + esc(hit) + '">' + esc(hit) + '</b>';
        i += hit.length;
      } else { plain += ch; i++; }
    }
    flush();
    return out;
  }

  function popHtml(e){
    build();
    let h = '<div class="kbp-head"><span class="kbp-w th">' + esc(e.w) + '</span>'
      + '<button class="kbp-spk" type="button" title="播放发音">♪</button>'
      + '<button class="kbp-x" type="button" title="关闭">✕</button></div>';
    if(e.r) h += '<div class="kbp-r">' + esc(e.r) + '</div>';
    if(e.z) h += '<div class="kbp-z">' + esc(e.z) + (e.p ? '<span class="kbp-p">' + esc(e.p) + '</span>' : '') + (e.auto ? '<span class="kbp-auto">机译</span>' : '') + '</div>';
    else if(e.p && !e.notes.length) h += '<div class="kbp-z kbp-muted">' + esc(e.p) + '（暂无释义）</div>';
    if(e.lessons.length) h += '<div class="kbp-src">生词表 · ' + esc(e.lessons.slice(0, 3).join('、')) + (e.lessons.length > 3 ? ' 等' : '') + '</div>';
    e.notes.forEach(n => {
      h += '<div class="kbp-note"><span class="kbp-lbl">讲解 · ' + esc(n.src || '词汇讲解') + '</span>' + esc(n.note) + '</div>';
      if(n.sents && n.sents.length){
        h += '<div class="kbp-sents">' + n.sents.slice(0, 2).map(sn =>
          '<div class="kbp-s"><span class="th">' + esc(sn.t) + '</span><span class="kbp-sz">' + esc(sn.z) + '</span></div>').join('') + '</div>';
      }
    });
    if(!e.z && !e.notes.length && !e.p) h += '<div class="kbp-empty">词库里没有这个词的释义。</div>';
    return h;
  }

  function hide(){
    if(POP){ POP.remove(); POP = null; }
    if(CUR){ CUR.classList.remove('on'); CUR = null; }
  }

  function show(el, word){
    build();
    const e = IDX.get(word);
    if(!e) return;
    if(CUR === el){ hide(); return; }
    hide();
    CUR = el; el.classList.add('on');
    POP = document.createElement('div');
    POP.className = 'kbp';
    POP.innerHTML = popHtml(e);
    document.body.appendChild(POP);
    const r = el.getBoundingClientRect();
    if(window.innerWidth < 760){
      /* 手机：改成底部抽屉，不再压在正文上 */
      POP.classList.add('kbp-m');
      const hh = POP.offsetHeight;
      if(r.top > window.innerHeight - hh - 24){
        window.scrollTo({ top: window.scrollY + (r.top - window.innerHeight + hh + 60), behavior: 'smooth' });
      }
    } else {
      const w = POP.offsetWidth, h = POP.offsetHeight;
      let left = Math.min(Math.max(8, r.left - 10), window.innerWidth - w - 8);
      let top = r.bottom + 8;
      if(top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 8);
      POP.style.left = left + 'px';
      POP.style.top = top + 'px';
    }
    if(window.kbPop) kbPop(POP);
    POP.querySelector('.kbp-spk').onclick = ev => { ev.stopPropagation(); if(typeof speakThai === 'function') speakThai('kw|' + e.w); };
    POP.querySelector('.kbp-x').onclick = ev => { ev.stopPropagation(); hide(); };
  }

  document.addEventListener('click', ev => {
    const b = ev.target.closest ? ev.target.closest('.kw') : null;
    if(b && b.dataset.k){ ev.preventDefault(); show(b, b.dataset.k); return; }
    if(POP && !ev.target.closest('.kbp')) hide();
  });
  document.addEventListener('keydown', ev => { if(ev.key === 'Escape') hide(); });
  window.addEventListener('resize', hide);

  window.KB_TOK = { render: render, hide: hide, reset: () => { IDX = null; MAXLEN = 2; /* 数据变动后重建词典 */ } };
})();
