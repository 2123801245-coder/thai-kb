/* wrongbook.js —— 错题本：状态、增删 API、渲染（所有练习共用）
   本文件由 泰语个人知识库.html 的内联脚本按行拆分而来，行为与原内联脚本一致；
   加载顺序见 HTML 底部的 <script src> 序列（顺序即原执行顺序）。 */
/* ============ 📕 错题本：所有练习共用（localStorage 持久化） ============ */
let WRONGS = [];
try { WRONGS = JSON.parse(localStorage.getItem('kb_wrongs') || '[]') || []; } catch (e) { WRONGS = []; }
/* 📌 本机没有错题本时，从 data-personal/progress.json 的固定快照恢复 */
try {
  if (localStorage.getItem('kb_wrongs') === null && window.KB_PROGRESS && Array.isArray(KB_PROGRESS.wrongs) && KB_PROGRESS.wrongs.length) {
    WRONGS = KB_PROGRESS.wrongs;
    localStorage.setItem('kb_wrongs', JSON.stringify(WRONGS));
  }
} catch (e) {}
function saveWrongs(){
  try { localStorage.setItem('kb_wrongs', JSON.stringify(WRONGS)); } catch (e) { toast('错题本保存失败：存储空间不足？'); }
}
function addWrong(entry){
  if(!entry || !entry.t) return;
  const old = WRONGS.find(x => x.t === entry.t);
  if(old){ old.n = (old.n || 1) + 1; old.last = entry.last || old.last || ''; }
  else WRONGS.unshift(Object.assign({ n: 1 }, entry));
  saveWrongs();
}
function delWrong(t){
  WRONGS = WRONGS.filter(x => x.t !== t);
  saveWrongs();
}
function wordMetaFor(t){
  const w = allWords().find(x => x.t === t);
  if(w) return { z: w.z, src: w.lesson || w.lg || '' };
  const v = VOK.find(x => x.w === t);
  if(v) return { z: v.z, src: v.src || '' };
  const d = DISC.flatMap(c => c.items.map(it => ({ t: it.w, z: it.z, src: c.g }))).find(x => x.t === t);
  if(d) return { z: d.z, src: d.src };
  const s = SECTIONS.find(x => x.titleZh === t);
  if(s) return { z: s.title || '', src: s.course || '' };
  return { z: '', src: '' };
}
/* ============ 📕 错题回顾 ============ */
function renderWrongBook(){
  const box = $1('#wbBox'); if(!box) return;
  const cnt = $1('#wbCount'); if(cnt) cnt.textContent = WRONGS.length + ' 错';
  if(!WRONGS.length){
    box.innerHTML = '<div class="wb-empty">✨ 错题本是空的。<br>在词汇练习、辨析或课文小测里答错的词，会自动收进这里。</div>';
    return;
  }
  const rows = WRONGS.map((w, i) => {
    const m = wordMetaFor(w.t);
    const zh = w.z || m.z || '';
    const src = w.src || m.src || '';
    const chips = [
      '<span class="wbchip warn">✗ ' + (w.n || 1) + ' 次</span>',
      w.kind ? '<span class="wbchip">' + w.kind + '</span>' : '',
      w.mode ? '<span class="wbchip">' + w.mode + '</span>' : '',
      src ? '<span class="wbchip src">' + src + '</span>' : '',
      w.last ? '<span class="wbchip">' + w.last + '</span>' : ''
    ].filter(Boolean).join('');
    return '<div class="wbrow">'
      + '<button class="spk" data-wbs="' + i + '">🔊</button>'
      + '<div style="flex:1;min-width:0;">'
      + '<div class="wbth th">' + w.t + '</div>'
      + (zh ? '<div class="wbzh">' + zh + '</div>' : '')
      + '<div class="wbmeta">' + chips + '</div>'
      + '</div>'
      + '<button class="wb-del" data-wbd="' + i + '">移出</button>'
      + '</div>';
  }).join('');
  box.innerHTML = rows;
  box.querySelectorAll('[data-wbs]').forEach(b => { b.onclick = () => speakThai(WRONGS[+b.dataset.wbs].t); });
  box.querySelectorAll('[data-wbd]').forEach(b => { b.onclick = () => { delWrong(WRONGS[+b.dataset.wbd].t); renderWrongBook(); }; });
}
$1('#wbClear').addEventListener('click', () => {
  if(!WRONGS.length){ toast('错题本已经是空的'); return; }
  if(confirm('清空全部 ' + WRONGS.length + ' 条错题记录？此操作不可撤销。')){
    WRONGS = []; saveWrongs(); renderWrongBook();
  }
});

