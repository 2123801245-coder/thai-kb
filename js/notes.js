/* notes.js —— 笔记：文字、图片（IndexedDB）、附件、导入导出
   本文件由 泰语个人知识库.html 的内联脚本按行拆分而来，行为与原内联脚本一致；
   加载顺序见 HTML 底部的 <script src> 序列（顺序即原执行顺序）。 */
/* ============ 笔记 ============ */
/* ---- IndexedDB 媒体存储：图片/附件不再受 localStorage ~5MB 限制，可存 50MB+ ---- */
const IDB = (function(){
  const DB_NAME = 'kb_media', STORE = 'kv';
  let dbp = null;
  function open(){
    if(dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { if(!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    return dbp;
  }
  async function tx(mode){ const db = await open(); return db.transaction(STORE, mode).objectStore(STORE); }
  function wrap(req){ return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  return {
    async get(k){ try{ return await wrap((await tx('readonly')).get(k)); }catch(e){ return undefined; } },
    async set(k, v){ return wrap((await tx('readwrite')).put(v, k)); },
    async del(k){ return wrap((await tx('readwrite')).delete(k)); }
  };
})();
let NOTE_IMGS = [];
let NOTE_ATTS = [];
function saveNoteImgs(){
  IDB.set('kb_note_imgs', JSON.stringify(NOTE_IMGS)).catch(() => toast('图片保存失败：浏览器存储空间不足'));
}
function saveNoteAtts(){
  IDB.set('kb_note_atts', JSON.stringify(NOTE_ATTS)).catch(() => toast('附件保存失败：浏览器存储空间不足'));
}
/* 启动时异步加载 + 一次性迁移 localStorage 旧数据 */
(async function initNoteMedia(){
  try{
    let imgs = await IDB.get('kb_note_imgs');
    if(imgs === undefined || imgs === null){
      const legacy = (function(){ try{ return localStorage.getItem('kb_note_imgs'); }catch(e){ return null; } })();
      if(legacy){ imgs = legacy; IDB.set('kb_note_imgs', legacy); try{ localStorage.removeItem('kb_note_imgs'); }catch(e){} }
    }
    if(imgs) NOTE_IMGS = JSON.parse(imgs) || [];
  }catch(e){}
  try{
    let atts = await IDB.get('kb_note_atts');
    if(atts === undefined || atts === null){
      const legacy = (function(){ try{ return localStorage.getItem('kb_note_atts'); }catch(e){ return null; } })();
      if(legacy){ atts = legacy; IDB.set('kb_note_atts', legacy); try{ localStorage.removeItem('kb_note_atts'); }catch(e){} }
    }
    if(atts) NOTE_ATTS = JSON.parse(atts) || [];
  }catch(e){}
  renderNoteImgs();
  renderNoteAtts();
})();
function moveNoteImg(from, to){
  if(to < 0 || to >= NOTE_IMGS.length || from === to) return;
  const it = NOTE_IMGS.splice(from, 1)[0];
  NOTE_IMGS.splice(to, 0, it);
  saveNoteImgs(); renderNoteImgs();
  toast('✅ 已调整顺序');
}
function renderNoteImgs(){
  const box = $1('#noteImgs'); if(!box) return;
  box.innerHTML = '';
  NOTE_IMGS.forEach((im, i) => {
    const d = document.createElement('div'); d.className = 'nimg';
    const img = document.createElement('img'); img.src = im.src; img.alt = '';
    img.title = im.cap ? im.cap : '点击放大 · 拖⇄拖动图标可调整顺序';
    img.onclick = () => showLightbox(im.src);
    const rm = document.createElement('button'); rm.className = 'rm'; rm.textContent = '×'; rm.title = '删除图片';
    rm.onclick = () => { NOTE_IMGS.splice(i, 1); saveNoteImgs(); renderNoteImgs(); };
    d.appendChild(img); d.appendChild(rm);
    const drag = document.createElement('span'); drag.className = 'drag'; drag.textContent = '⇄'; drag.title = '拖动调整顺序（电脑）';
    d.appendChild(drag);
    /* 触屏设备没有 HTML5 拖放，给每张图配 ◀ ▶ 按钮 */
    const mv = document.createElement('span'); mv.className = 'mvbtns';
    const mvl = document.createElement('button'); mvl.type = 'button'; mvl.className = 'mv';
    mvl.textContent = '◀'; mvl.title = '前移一位'; mvl.disabled = (i === 0);
    mvl.onclick = ev => { ev.stopPropagation(); moveNoteImg(i, i - 1); };
    const mvr = document.createElement('button'); mvr.type = 'button'; mvr.className = 'mv';
    mvr.textContent = '▶'; mvr.title = '后移一位'; mvr.disabled = (i === NOTE_IMGS.length - 1);
    mvr.onclick = ev => { ev.stopPropagation(); moveNoteImg(i, i + 1); };
    mv.appendChild(mvl); mv.appendChild(mvr);
    d.appendChild(mv);
    const cap = document.createElement('input'); cap.className = 'cap'; cap.placeholder = '备注…'; cap.value = im.cap || '';
    cap.oninput = () => { im.cap = cap.value; saveNoteImgs(); };
    d.appendChild(cap);
    /* ---- 拖动排序 ---- */
    d.draggable = false;
    drag.addEventListener('mousedown', () => { d.draggable = true; });
    d.addEventListener('dragstart', ev => {
      if(!d.draggable){ ev.preventDefault(); return; }
      ev.dataTransfer.setData('text/plain', String(i));
      ev.dataTransfer.effectAllowed = 'move';
      requestAnimationFrame(() => d.classList.add('dragging'));
    });
    d.addEventListener('dragend', () => { d.classList.remove('dragging'); d.draggable = false; box.querySelectorAll('.nimg').forEach(x => x.classList.remove('droptarget')); });
    d.addEventListener('dragover', ev => {
      if(box.querySelector('.nimg.dragging') && box.querySelector('.nimg.dragging') !== d){ ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; d.classList.add('droptarget'); }
    });
    d.addEventListener('dragleave', () => d.classList.remove('droptarget'));
    d.addEventListener('drop', ev => {
      ev.preventDefault();
      d.classList.remove('droptarget');
      const from = parseInt(ev.dataTransfer.getData('text/plain'), 10);
      if(isNaN(from) || from === i || from < 0 || from >= NOTE_IMGS.length) return;
      const moved = NOTE_IMGS.splice(from, 1)[0];
      const to = NOTE_IMGS.indexOf(NOTE_IMGS.find(x => x === im));
      NOTE_IMGS.splice(from === i ? i : (from < i ? to + 1 : to), 0, moved);
      saveNoteImgs(); renderNoteImgs();
      toast('✅ 已调整顺序');
    });
    box.appendChild(d);
  });
}
let lbEl = null;
function showLightbox(src){
  if(!lbEl){ lbEl = document.createElement('div'); lbEl.id = 'imgLightbox'; lbEl.onclick = () => lbEl.classList.remove('on'); document.body.appendChild(lbEl); }
  lbEl.innerHTML = '<img src="' + src + '">';
  lbEl.classList.add('on');
}
function addNoteImage(file){
  if(!file || !/^image\//.test(file.type)){ toast('请选择图片文件'); return; }
  const maxSide = 1920;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      const scale = Math.min(1, maxSide / Math.max(w, h));
      w = Math.round(w * scale); h = Math.round(h * scale);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      let src;
      try{ src = cv.toDataURL('image/jpeg', 0.86); }catch(err){ src = reader.result; }
      NOTE_IMGS.push({ src, cap: '', hdLin: src.indexOf('data:image') === 0 });
      saveNoteImgs(); renderNoteImgs();
      toast('✅ 已插入图片 ' + NOTE_IMGS.length);
    };
    img.onerror = () => {
      NOTE_IMGS.push({ src: reader.result, cap: '' });
      saveNoteImgs(); renderNoteImgs();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
/* ---- 附件（任意文件，IndexedDB 存储，最大 50MB） ---- */
function fmtSize(n){
  if(n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
  if(n >= 1024) return (n / 1024).toFixed(0) + ' KB';
  return n + ' B';
}
function attIcon(name){
  const ext = (name.split('.').pop() || '').toLowerCase();
  if(['mp3','m4a','wav','aac','ogg'].includes(ext)) return '🎵';
  if(['mp4','mov','avi','mkv','webm'].includes(ext)) return '🎬';
  if(['pdf'].includes(ext)) return '📕';
  if(['doc','docx'].includes(ext)) return '📘';
  if(['xls','xlsx','csv'].includes(ext)) return '📗';
  if(['ppt','pptx'].includes(ext)) return '📙';
  if(['zip','rar','7z'].includes(ext)) return '🗜';
  if(['txt','md'].includes(ext)) return '📄';
  return '📎';
}
function renderNoteAtts(){
  const box = $1('#noteAtts'); if(!box) return;
  box.innerHTML = '';
  if(!NOTE_ATTS.length){ box.style.display = 'none'; return; }
  box.style.display = 'block';
  const total = NOTE_ATTS.reduce((a, b) => a + (b.data ? b.data.length : 0), 0);
  const h = document.createElement('div'); h.className = 'atthdr';
  h.innerHTML = '📎 附件 <span class="badge">' + NOTE_ATTS.length + ' 个 · 约 ' + fmtSize(Math.round(total * 0.75)) + '</span>';
  box.appendChild(h);
  NOTE_ATTS.forEach((att, i) => {
    const d = document.createElement('div'); d.className = 'attrow';
    const ic = document.createElement('span'); ic.className = 'attico'; ic.textContent = attIcon(att.name);
    const nm = document.createElement('span'); nm.className = 'attname'; nm.textContent = att.name; nm.title = att.name;
    const sz = document.createElement('span'); sz.className = 'attsize'; sz.textContent = fmtSize(att.size || 0);
    const open = document.createElement('button'); open.className = 'btn ghost2 sm'; open.textContent = '打开';
    open.onclick = () => openAtt(i);
    const dl = document.createElement('button'); dl.className = 'btn ghost2 sm'; dl.textContent = '下载';
    dl.onclick = () => dlAtt(i);
    const rm = document.createElement('button'); rm.className = 'btn ghost2 sm del'; rm.textContent = '删除';
    rm.onclick = () => { if(confirm('删除附件「' + att.name + '」？')){ NOTE_ATTS.splice(i, 1); saveNoteAtts(); renderNoteAtts(); } };
    d.appendChild(ic); d.appendChild(nm); d.appendChild(sz); d.appendChild(open); d.appendChild(dl); d.appendChild(rm);
    box.appendChild(d);
  });
}
function openAtt(i){
  const att = NOTE_ATTS[i]; if(!att) return;
  try{
    const byteStr = atob(att.data);
    const bytes = new Uint8Array(byteStr.length);
    for(let k = 0; k < byteStr.length; k++) bytes[k] = byteStr.charCodeAt(k);
    const blob = new Blob([bytes], { type: att.type || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if(!w){ /* 弹窗被拦时用下载兜底 */ dlAtt(i); setTimeout(() => URL.revokeObjectURL(url), 30000); return; }
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  }catch(e){ toast('打开失败'); }
}
function dlAtt(i){
  const att = NOTE_ATTS[i]; if(!att) return;
  try{
    const byteStr = atob(att.data);
    const bytes = new Uint8Array(byteStr.length);
    for(let k = 0; k < byteStr.length; k++) bytes[k] = byteStr.charCodeAt(k);
    const blob = new Blob([bytes], { type: att.type || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = att.name || 'attachment';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }catch(e){ toast('下载失败'); }
}
function addNoteFile(file){
  if(!file) return;
  if(file.size > 50 * 1024 * 1024){ toast('「' + file.name + '」超过 50MB，浏览器存不下，请先压缩'); return; }
  const rd = new FileReader();
  rd.onload = () => {
    const b64 = String(rd.result).split(',')[1] || '';
    NOTE_ATTS.push({ name: file.name || '未命名', type: file.type || '', size: file.size || 0, data: b64 });
    saveNoteAtts(); renderNoteAtts();
    toast('✅ 已添加附件 ' + NOTE_ATTS.length + '：' + (file.name || ''));
  };
  rd.onerror = () => toast('读取文件失败');
  rd.readAsDataURL(file);
}
function loadNote(){
  const ta = $1('#noteArea'); if(!ta) return;
  let saved = null;
  try{ saved = localStorage.getItem('kb_notes'); }catch(e){}
  /* 📌 本机没存过笔记时，从 data-personal/progress.json 的固定快照恢复文字 */
  if (saved === null && window.KB_PROGRESS && typeof KB_PROGRESS.notes === 'string' && KB_PROGRESS.notes){
    saved = KB_PROGRESS.notes;
    try{ localStorage.setItem('kb_notes', saved); }catch(e){}
  }
  if (saved !== null && saved !== undefined) ta.value = saved;
  else ta.value = NOTES_DEFAULT || (ta.dataset['default'] || '');
  renderNoteImgs();
  renderNoteAtts();
}
$1('#addImgBtn').addEventListener('click', () => $1('#imgFile').click());
$1('#addFileBtn').addEventListener('click', () => $1('#attFile').click());
$1('#attFile').addEventListener('change', ev => {
  Array.from(ev.target.files || []).forEach(addNoteFile);
  ev.target.value = '';
});
$1('#imgFile').addEventListener('change', ev => {
  Array.from(ev.target.files || []).forEach(addNoteImage);
  ev.target.value = '';
});
const _noteTa = $1('#noteArea');
if(_noteTa){
  _noteTa.addEventListener('paste', ev => {
    const items = (ev.clipboardData && ev.clipboardData.items) || [];
    let hit = false;
    for(const it of items){
      if(it.type && it.type.indexOf('image/') === 0){
        const f = it.getAsFile();
        if(f){ addNoteImage(f); hit = true; }
      }
    }
    for(const it of items){
      if(it.kind === 'file' && !(it.type && it.type.indexOf('image/') === 0)){
        const f = it.getAsFile();
        if(f && f.name){ addNoteFile(f); hit = true; }
      }
    }
    if(hit) ev.preventDefault();
  });
  _noteTa.addEventListener('dragover', ev => { ev.preventDefault(); _noteTa.classList.add('dragover'); });
  _noteTa.addEventListener('dragleave', () => _noteTa.classList.remove('dragover'));
  _noteTa.addEventListener('drop', ev => {
    ev.preventDefault(); _noteTa.classList.remove('dragover');
    Array.from(ev.dataTransfer.files || []).forEach(f => {
      if(f.type && f.type.indexOf('image/') === 0) addNoteImage(f); else addNoteFile(f);
    });
  });
}
$1('#saveNoteBtn').addEventListener('click', () => {
  try{ localStorage.setItem('kb_notes', $1('#noteArea').value); toast('✅ 笔记已保存（本机，含 ' + NOTE_IMGS.length + ' 张图片' + (NOTE_ATTS.length ? '、' + NOTE_ATTS.length + ' 个附件' : '') + '）'); }
  catch(e){ toast('保存失败'); }
});
$1('#exportNoteBtn').addEventListener('click', () => {
  let html = '';
  NOTE_IMGS.forEach(im => {
    html += '<div><img src="' + im.src + '" style="max-width:100%;">' + (im.cap ? '<div>' + im.cap + '</div>' : '') + '</div><hr>';
  });
  let attHtml = '';
  NOTE_ATTS.forEach((att, i) => {
    attHtml += '<div style="margin:6px 0;"><a download="' + (att.name || 'attachment') + '" href="data:' + (att.type || 'application/octet-stream') + ';base64,' + att.data + '">' + attIcon(att.name) + ' ' + (att.name || '') + '</a> <small>(' + fmtSize(att.size || 0) + ')</small></div>';
  });
  const body = '<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><title>泰语知识库-我的笔记</title></head><body>'
    + (NOTE_ATTS.length ? '<h3>📎 附件</h3>' + attHtml : '')
    + (NOTE_IMGS.length ? '<h3>📷 图片</h3>' + html : '')
    + '<h3>📝 文字笔记</h3><pre style="white-space:pre-wrap;font-family:inherit;line-height:1.8;">'
    + $1('#noteArea').value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    + '</pre></body></html>';
  const blob = new Blob([body], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '泰语知识库-我的笔记.html';
  a.click();
  URL.revokeObjectURL(a.href);
});
$1('#resetNoteBtn').addEventListener('click', () => {
  if(confirm('恢复默认笔记内容？（当前文字、图片与附件将被清除）')){ $1('#noteArea').value = NOTES_DEFAULT; try{ localStorage.removeItem('kb_notes'); }catch(e){} NOTE_IMGS = []; saveNoteImgs(); renderNoteImgs(); NOTE_ATTS = []; saveNoteAtts(); renderNoteAtts(); }
});

