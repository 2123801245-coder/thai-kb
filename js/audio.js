/* audio.js —— 发音播放层：内置音频优先，读失败静默降级，不依赖任何 CDN
   为什么单独一层：以前 speakThai() 里把「查内置音频 / 补拉发音包 / 系统语音 / 在线语音」
   全揉在一起，刷卡页要显示「加载中 / 失败」状态却没地方挂。这里把取音频这件事收成
   一个播放器，界面只订阅状态，不再自己判断有没有音频。

   取音顺序（全部是本机能力，断网可用）：
     ① data/audio-manifest.json 里登记的分文件音频  audio/<词条ID>_<类型>.mp3
     ② 内置 base64 发音包  VOICE（词表 9MB，按需加载） / KB_VOICE_EXT（课文与例句 56MB）
     ③ 设备自带泰语语音 speechSynthesis
     ④ 都没有 → 静默（界面显示「无发音」，不报错、不弹窗）
   在线语音只在 KB.audio.allowCDN = true 时才用，默认关闭，避免断网时卡在超时上。

   状态：loading（正在取/正在加载发音包）→ playing → ended
         fallback（走了系统语音） / failed（彻底没声音，界面按「无发音」处理） */
window.KB = window.KB || {};
(function () {
  const MANIFEST_URL = 'data/audio-manifest.json';
  const cfg = { allowCDN: false };
  const cache = new Map();          /* 文本 → { b64, url } 只缓存 dataURL，省得反复拼字符串 */
  const subs = new Set();           /* 界面订阅：onState(fn) */
  let manifest = null, manifestTried = false;
  let cur = null, curText = '', curState = 'idle';

  /* 词条 ID：泰文没有稳定自增 id，用文本哈希保证「同一词永远同一文件名」不随排序变化 */
  function idOf(text) {
    let h = 5381;
    for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36).padStart(7, '0').slice(-7);
  }
  function pick(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : ''; }
  function emit(st, text) {
    curState = st;
    subs.forEach(fn => { try { fn(st, text || curText); } catch (e) {} });
  }
  function loadManifest() {
    if (manifestTried) return Promise.resolve(manifest);
    manifestTried = true;
    return fetch(MANIFEST_URL, { cache: 'force-cache' })
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null)
      .then(j => { manifest = j || null; return manifest; });
  }
  /* ① 分文件音频：清单里登记过才算数，没登记就不去试 404 */
  function fileFor(text) {
    if (!manifest || !manifest.files) return '';
    return pick(manifest.files, text) || '';
  }
  /* ② 内置音频包 */
  function builtin(text) {
    let b = VOICE[text];
    if (!b && text.indexOf('vok|') === 0) {
      const k = text.slice(4);
      b = VOICE['vok|' + k] || VOICE[k];
    }
    return b || '';
  }
  function stop() {
    if (cur) { try { cur.pause(); } catch (e) {} cur = null; }
    try { speechSynthesis.cancel(); } catch (e) {}
  }
  function playUrl(url, text, onFail) {
    stop();
    const fail = onFail || (() => tts(text));
    const a = new Audio(url);
    a.playbackRate = (typeof spd === 'number' && spd > 0) ? spd : 1;
    cur = a;
    a.onended = () => { if (cur === a) { cur = null; emit('ended', text); } };
    a.onerror = () => { if (cur === a) { cur = null; fail(); } };
    try {
      const p = a.play();
      emit('playing', text);
      if (p && p.catch) p.catch(() => { if (cur === a) { cur = null; fail(); } });   /* 自动播放被拦也一样降级 */
    } catch (e) { fail(); }
  }
  /* 分文件音频取不到（断网没缓存、文件被删）时的第二顺位：内置 base64 */
  function builtinThenTts(text) {
    const b = builtin(text);
    if (b) { playUrl('data:audio/mpeg;base64,' + b, text, () => tts(text)); return; }
    tts(text);
  }
  function tts(text) {
    try {
      const vs = speechSynthesis.getVoices() || [];
      const v = vs.find(x => /^th/i.test(x.lang));
      if (vs.length && !v) { if (cfg.allowCDN) online(text); else emit('failed', text); return; }
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'th-TH';
      u.rate = (typeof spd === 'number' && spd > 0) ? spd : 1;
      if (v) u.voice = v;
      u.onerror = () => { if (cfg.allowCDN) online(text); else emit('failed', text); };
      u.onend = () => emit('ended', text);
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
      emit('fallback', text);
    } catch (e) { if (cfg.allowCDN) online(text); else emit('failed', text); }
  }
  function online(text) {
    try {
      const a = new Audio('https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=th&q=' + encodeURIComponent(text));
      a.playbackRate = (typeof spd === 'number' && spd > 0) ? spd : 1;
      cur = a;
      a.onended = () => { if (cur === a) { cur = null; emit('ended', text); } };
      a.onerror = () => emit('failed', text);
      a.play().then(() => emit('fallback', text)).catch(() => emit('failed', text));
    } catch (e) { emit('failed', text); }
  }
  function play(text, opts) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) { emit('failed', ''); return Promise.resolve(false); }
    curText = t;
    const o = opts || {};
    if (o.rate) cfg.rate = o.rate;
    return loadManifest().then(() => {
      const f = fileFor(t);
      if (f) { emit('loading', t); playUrl(f, t, () => builtinThenTts(t)); return true; }
      if (!window.KB_VOICE_READY && window.__loadVoice) {
        emit('loading', t);
        window.__loadVoice(() => play(t));      /* 加载完补播这一次点击 */
        if (typeof toast === 'function') toast('正在加载发音…');
        return true;
      }
      const b = builtin(t);
      if (b) {
        playUrl('data:audio/mpeg;base64,' + b, t, () => tts(t));
        return true;
      }
      if (window.KB_VOICE_EXT === null && window.__loadVoiceExt) window.__loadVoiceExt();
      tts(t);                                    /* 没有就交给设备语音；再不行就静默 */
      return true;
    });
  }
  /* 界面用：这个词到底有没有得听（有内置、有分文件、或有系统泰语语音） */
  function ready(text) {
    const t = String(text || '').trim();
    if (!t) return false;
    if (fileFor(t) || builtin(t)) return true;
    /* 发音包还没拉下来时别急着说「没发音」：清单里没登记缺失，就按「点了会现拉」算 */
    const missList = (manifest && manifest.missing && manifest.missing.words) || [];
    if (missList.indexOf(t) >= 0) return false;
    if (!window.KB_VOICE_READY && window.__loadVoice) return true;
    try {
      const vs = speechSynthesis.getVoices() || [];
      return vs.some(x => /^th/i.test(x.lang));
    } catch (e) { return false; }
  }
  window.KB.audio = {
    play, ready, stop,
    idOf, loadManifest,
    onState(fn) { subs.add(fn); return () => subs.delete(fn); },
    get state() { return curState; },
    get current() { return curText; },
    set allowCDN(v) { cfg.allowCDN = !!v; },
    get allowCDN() { return cfg.allowCDN; },
    get manifest() { return manifest; }
  };
})();
