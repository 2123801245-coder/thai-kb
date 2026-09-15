/* core.js —— 基础助手、我的添加的本地状态、发音链路（内置 mp3 → 系统泰语 → 在线语音）、toast
   本文件由 泰语个人知识库.html 的内联脚本按行拆分而来，行为与原内联脚本一致；
   加载顺序见 HTML 底部的 <script src> 序列（顺序即原执行顺序）。 */
/* ============ 基础 ============ */
const $ = (s, c) => Array.from((c || document).querySelectorAll(s));
const $1 = s => $(s)[0];
const RE_PURE = /^[ .]+$/;
let spd = 0.9;
try{ spd = parseFloat(localStorage.getItem('spd') || '0.9') || 0.9; }catch(e){}
let hideZh = false, showZh = false, curAudio = null;

/* ============ 我的添加（本机保存） ============ */
let MY_WORDS = [], MY_PATTERNS = [];
try{ const a = JSON.parse(localStorage.getItem('kb_my_words') || '[]'); if(Array.isArray(a)) MY_WORDS = a; }catch(e){}
try{ const b = JSON.parse(localStorage.getItem('kb_my_patterns') || '[]'); if(Array.isArray(b)) MY_PATTERNS = b; }catch(e){}
function saveMine(){
  try{
    localStorage.setItem('kb_my_words', JSON.stringify(MY_WORDS));
    localStorage.setItem('kb_my_patterns', JSON.stringify(MY_PATTERNS));
  }catch(e){ toast('保存失败：浏览器存储空间不足？'); }
  refreshCounts();
}
function allWords(){ return BUILTIN_WORDS.concat(MY_WORDS); }
function allPatterns(){ return BUILTIN_PATTERNS.concat(MY_PATTERNS); }
function refreshCounts(){
  const w = $1('#stWords'), p = $1('#stPatterns'), m = $1('#stMine');
  if(w) w.textContent = BUILTIN_WORDS.length;
  if(p) p.textContent = BUILTIN_PATTERNS.length;
  if(m) m.textContent = MY_WORDS.length + MY_PATTERNS.length;
  const mc = $1('#myCount'); if(mc) mc.textContent = MY_WORDS.length + MY_PATTERNS.length;
}

/* ============ 发音：内置 mp3 → 系统泰语 → 在线语音 ============ */
function speakThai(text){
  let t = String(text || '').replace(/\s+/g, ' ').trim();
  if(!t) return;
  let b64 = VOICE[t];
  if(!b64 && t.indexOf('vok|') === 0){ t = t.slice(4); b64 = VOICE['vok|' + t] || VOICE[t]; }
  if(b64){
    if(curAudio){ try{ curAudio.pause(); }catch(e){} curAudio = null; }
    try{ speechSynthesis.cancel(); }catch(e){}
    const a = new Audio('data:audio/mpeg;base64,' + b64);
    try{ a.playbackRate = spd; }catch(e){}
    curAudio = a; window.__au = a;
    a.onended = () => { if(curAudio === a) curAudio = null; };
    const fb = () => { if(curAudio === a){ curAudio = null; liveSpeak(t); } };
    a.onerror = fb;
    try{ const p = a.play(); if(p && p.catch) p.catch(fb); }catch(e){ fb(); }
    return;
  }
  liveSpeak(t);
}
function liveSpeak(t){
  try{
    const vs = speechSynthesis.getVoices();
    const v = vs.find(x => /^th/i.test(x.lang));
    if(vs.length && !v) return onlineSpeak(t);   /* 有语音列表却没有泰语语音时改用在线语音，避免拿非泰语语音念泰文 */
    const u = new SpeechSynthesisUtterance(t);
    u.lang = 'th-TH'; u.rate = spd; u.voice = v;
    u.onerror = () => onlineSpeak(t);
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }catch(e){ onlineSpeak(t); }
}
if('speechSynthesis' in window) speechSynthesis.getVoices();   /* 预热语音列表，避免首次点 🔊 时还没加载出泰语语音 */
function onlineSpeak(t){
  try{
    const a = new Audio('https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=th&q=' + encodeURIComponent(t));
    try{ a.playbackRate = spd; }catch(e){}
    curAudio = a;
    a.onended = () => { if(curAudio === a) curAudio = null; };
    a.play().catch(() => {});
  }catch(e){}
}
let toastTimer = null;
function toast(msg){
  let el = document.getElementById('toast');
  if(!el){ el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg; el.style.opacity = '1';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.style.opacity = '0', 3000);
}
(function(){
  const el = $1('#rateSel');
  if(el){
    el.value = String(spd);
    el.addEventListener('change', () => {
      spd = parseFloat(el.value) || 1;
      try{ localStorage.setItem('spd', String(spd)); }catch(e){}
      if(window.__au){ try{ window.__au.playbackRate = spd; if(!window.__au.paused) window.__au.currentTime = Math.max(0, window.__au.currentTime - 0.1); }catch(e){} }
    });
  }
})();

