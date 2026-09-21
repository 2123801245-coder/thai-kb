/* storage.js —— 存储自检 + 完整备份 / 恢复
   本文件由 泰语个人知识库.html 的加载序列引入，位置在 core.js 之后。

   为什么要有这个文件：
   有些打开方式下浏览器不让网页保存数据 —— 最典型的是 iPhone / iPad 上直接从
   「文件」App 点开 HTML（地址是 file://）。而原来各处的 save 都是
   `try{ ... }catch(e){}` 静默失败，同学会以为标记存住了，关掉页面才发现全没了。
   这里启动时实测一次 localStorage 与 IndexedDB：
     · 都正常   → 什么都不显示，行为和以前完全一样；
     · 存不住   → 顶部挂一条横幅把话说清楚，并当场给出「导出 / 导入备份」。
   另外提供一份「完整备份」：把掌握度、错题本、导入的课文、笔记、图片、附件、
   阅读位置与各种偏好打包成一个 JSON，换设备 / 换浏览器 / 手动保存都用它。

   注意：备份文件里含笔记图片与附件的 base64，可能几十 MB，属正常。 */

/* ============ 1) 启动自检 ============ */
const KB_LS_OK = (function(){
  try{
    const k = '__kb_probe__';
    localStorage.setItem(k, '1');
    const ok = localStorage.getItem(k) === '1';
    localStorage.removeItem(k);
    return ok;
  }catch(e){ return false; }
})();
let KB_IDB_OK = null;                       /* null = 还没测出来 */
let kbWarnOff = false;
try{ kbWarnOff = sessionStorage.getItem('kbStoreWarnOff') === '1'; }catch(e){}

function kbProbeIDB(){
  return new Promise(res => {
    let done = false;
    const finish = v => { if(!done){ done = true; res(v); } };
    try{
      const req = indexedDB.open('kb_probe', 1);
      req.onupgradeneeded = () => { try{ req.result.createObjectStore('kv'); }catch(e){} };
      req.onsuccess = () => finish(true);
      req.onerror = () => finish(false);
      req.onblocked = () => finish(false);
      setTimeout(() => finish(false), 4000);   /* 有些浏览器既不成功也不报错 */
    }catch(e){ finish(false); }
  });
}

/* ============ 2) 存不住时顶部的横幅 ============ */
function kbBannerText(){
  const byFile = location.protocol === 'file:';
  const out = [];
  if(!KB_LS_OK){
    out.push('<b>⚠️ 现在这种打开方式存不住数据：关掉页面后，掌握度标记、笔记、错题本都会丢。</b>');
    if(byFile){
      out.push('浏览器不允许 <code>file://</code> 页面保存数据（iPhone / iPad 上尤其常见）。两个办法：');
      out.push('① 学完点右边的「💾 导出备份」存成一个文件，下次打开点「📥 导入备份」恢复；');
      out.push('② 或者改用网址打开：电脑上跑 <code>手机访问</code> 启动器，手机用浏览器输网址进（见 <code>使用说明.txt</code> 方式二）。');
    }else{
      out.push('这个浏览器（可能是无痕 / 隐私模式，或禁用了网站数据）不让保存。换一个普通窗口打开就行。');
    }
  }else if(KB_IDB_OK === false){
    out.push('<b>⚠️ 这个浏览器不允许保存图片和附件。</b>笔记文字、进度、错题本都正常，但插进来的图片和附件关掉页面就没了。');
  }
  return out;
}

function kbBannerPad(){
  const el = document.getElementById('storewarn');
  if(!el) return;
  /* 横幅高度随文字换行变化，写进 CSS 变量，让 body 的底部留白与 toast 位置跟着走 */
  document.body.style.setProperty('--storewarn-h', Math.round(el.getBoundingClientRect().height) + 'px');
}

function kbRemoveBanner(){
  const el = document.getElementById('storewarn');
  if(el) el.remove();
  document.body.classList.remove('storagewarn');
  document.body.style.removeProperty('--storewarn-h');
}

function kbShowBanner(){
  if(kbWarnOff || (KB_LS_OK && KB_IDB_OK !== false)){ kbRemoveBanner(); return; }
  if(!document.body) return;
  let el = document.getElementById('storewarn');
  if(!el){
    el = document.createElement('div');
    el.id = 'storewarn';
    document.body.appendChild(el);
  }
  el.innerHTML = '<div class="sw-txt">' + kbBannerText().join(' ') + '</div>'
    + '<div class="sw-btns">'
    + '<button type="button" class="primary" id="swExport">💾 导出备份</button>'
    + '<button type="button" id="swImport">📥 导入备份</button>'
    + '<button type="button" id="swOff" title="先不管（本次有效）">✕</button>'
    + '</div>';
  document.body.classList.add('storagewarn');
  document.getElementById('swExport').onclick = kbDownloadBackup;
  document.getElementById('swImport').onclick = () => {
    const f = document.getElementById('importFile');
    if(f) f.click(); else toast('请到「➕ 添加」页用「📥 导入备份」');
  };
  document.getElementById('swOff').onclick = () => {
    kbWarnOff = true;
    try{ sessionStorage.setItem('kbStoreWarnOff', '1'); }catch(e){}
    kbRemoveBanner();
  };
  kbBannerPad();
  requestAnimationFrame(kbBannerPad);
  if(!kbShowBanner._wired){
    kbShowBanner._wired = true;
    window.addEventListener('resize', kbBannerPad);
    window.addEventListener('orientationchange', () => setTimeout(kbBannerPad, 250));
  }
}

/* ============ 3) 完整备份 ============ */
const KB_STORE_KEYS = ['kb_cls', 'kb_wrongs', 'kb_my_words', 'kb_my_patterns', 'kb_my_lessons',
  'kb_notes', 'kbReadSec', 'kbListPage', 'kbSrcFilt', 'spd', 'exMode', 'exCount', 'exSrc'];

function kbCollectLocal(){
  const out = {};
  /* 先按已知键名收，再扫一遍 kb 开头 / kbShCal: 前缀的键，避免漏掉逐句跟读校准这类数据 */
  KB_STORE_KEYS.forEach(k => { try{ const v = localStorage.getItem(k); if(v !== null) out[k] = v; }catch(e){} });
  try{
    for(let i = 0; i < localStorage.length; i++){
      const k = localStorage.key(i);
      if(!k || out.hasOwnProperty(k)) continue;
      if(k.indexOf('kb') === 0 || k.indexOf('kbShCal:') === 0) out[k] = localStorage.getItem(k);
    }
  }catch(e){}
  return out;
}

async function kbExportAll(){
  const store = kbCollectLocal();
  let imgs = [], atts = [];
  try{ imgs = JSON.parse((await IDB.get('kb_note_imgs')) || '[]') || []; }catch(e){}
  try{ atts = JSON.parse((await IDB.get('kb_note_atts')) || '[]') || []; }catch(e){}
  if(!imgs.length && typeof NOTE_IMGS !== 'undefined' && NOTE_IMGS.length) imgs = NOTE_IMGS;
  if(!atts.length && typeof NOTE_ATTS !== 'undefined' && NOTE_ATTS.length) atts = NOTE_ATTS;
  return {
    v: 2,
    app: '泰语个人知识库',
    exportedAt: new Date().toISOString(),
    /* 前 5 项保持旧版导出的字段名，老文件仍能读 */
    words: (typeof MY_WORDS !== 'undefined') ? MY_WORDS : [],
    patterns: (typeof MY_PATTERNS !== 'undefined') ? MY_PATTERNS : [],
    notes: store['kb_notes'] || '',
    noteImgs: imgs,
    atts: atts,
    store: store
  };
}

async function kbDownloadBackup(){
  let data;
  try{ data = await kbExportAll(); }
  catch(e){ toast('❌ 导出失败：' + (e && e.message ? e.message : e)); return; }
  let text;
  try{ text = JSON.stringify(data, null, 2); }
  catch(e){ toast('❌ 导出失败（数据里有无法序列化的内容）'); return; }
  const mb = (text.length / 1048576);
  const d = new Date();
  const pad = n => (n < 10 ? '0' : '') + n;
  const name = '泰语知识库-备份-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate())
    + '-' + pad(d.getHours()) + pad(d.getMinutes()) + '.json';
  try{
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    toast('✅ 已导出备份 ' + (mb >= 0.1 ? mb.toFixed(1) + 'MB' : '') + '：' + name);
  }catch(e){ toast('❌ 这个浏览器不让下载文件，换个打开方式再试'); }
}

/* ============ 4) 恢复 ============ */
async function kbImportAll(text){
  let d;
  try{ d = JSON.parse(text); }
  catch(e){ toast('❌ 这不是一个有效的备份文件'); return false; }

  /* 新版完整备份：整份覆盖，然后重载页面让各模块重新读 */
  if(d && typeof d === 'object' && d.store && typeof d.store === 'object'){
    let n = 0;
    Object.keys(d.store).forEach(k => { try{ localStorage.setItem(k, d.store[k]); n++; }catch(e){} });
    if(Array.isArray(d.noteImgs)){
      try{ NOTE_IMGS = d.noteImgs.filter(x => x && x.src); await IDB.set('kb_note_imgs', JSON.stringify(NOTE_IMGS)); }catch(e){}
    }
    if(Array.isArray(d.atts)){
      try{ NOTE_ATTS = d.atts.filter(x => x && x.data && x.name); await IDB.set('kb_note_atts', JSON.stringify(NOTE_ATTS)); }catch(e){}
    }
    toast('✅ 已恢复 ' + n + ' 项数据，正在重新载入…');
    setTimeout(() => location.reload(), 800);
    return true;
  }

  /* 旧版导出（只有 words / patterns / notes / noteImgs / atts）：按原来那样合并，不覆盖 */
  try{
    if(Array.isArray(d.words)){
      MY_WORDS = MY_WORDS.concat(d.words.filter(x => x && x.t).map(x => ({ id: uid(), t: x.t, z: x.z || '', p: x.p || '', r: x.r || '', lg: x.lg || '导入' })));
    }
    if(Array.isArray(d.patterns)){
      MY_PATTERNS = MY_PATTERNS.concat(d.patterns.filter(x => x && x.p).map(x => ({ id: uid(), p: x.p, z: x.z || '', ex: x.ex || '', ez: x.ez || '', lg: x.lg || '导入' })));
    }
    if(typeof d.notes === 'string'){ try{ localStorage.setItem('kb_notes', d.notes); }catch(e){} }
    if(Array.isArray(d.noteImgs)){ NOTE_IMGS = d.noteImgs.filter(x => x && x.src); saveNoteImgs(); renderNoteImgs(); }
    if(Array.isArray(d.atts)){ NOTE_ATTS = d.atts.filter(x => x && x.data && x.name); saveNoteAtts(); renderNoteAtts(); }
    if(d.notes || d.noteImgs || d.atts) loadNote();
    saveMine(); renderMine(); renderList(); renderPatterns();
    toast('✅ 已导入旧版数据（生词 / 句型 / 笔记，按合并处理）');
    return true;
  }catch(e){
    toast('❌ 备份文件内容不对');
    return false;
  }
}

function kbImportFromFile(file){
  if(!file) return;
  const rd = new FileReader();
  rd.onload = () => { kbImportAll(String(rd.result || '')); };
  rd.onerror = () => toast('❌ 读不了这个文件');
  rd.readAsText(file);
}

/* ============ 5) 启动：测完就决定要不要挂横幅 ============ */
(function(){
  const boot = () => {
    kbShowBanner();                       /* localStorage 的结果已经能定了 */
    kbProbeIDB().then(ok => { KB_IDB_OK = ok; kbShowBanner(); });
  };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
