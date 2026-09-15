/* add.js —— 添加：我的生词/句型，以及数据导出导入清空
   本文件由 泰语个人知识库.html 的内联脚本按行拆分而来，行为与原内联脚本一致；
   加载顺序见 HTML 底部的 <script src> 序列（顺序即原执行顺序）。 */
/* ============ 添加 ============ */
function uid(){ return 'm' + Date.now() + Math.floor(Math.random() * 1000); }
function addWord(){
  const t = $1('#awT').value.trim(), z = $1('#awZ').value.trim();
  if(!t || !z){ toast('泰语和释义不能为空'); return; }
  MY_WORDS.push({ id: uid(), t, z, p: $1('#awP').value.trim(), r: $1('#awR').value.trim(), lg: $1('#awLg').value });
  saveMine();  $1('#awT').value = ''; $1('#awZ').value = ''; $1('#awP').value = ''; $1('#awR').value = '';
  toast('✅ 已添加：' + t);
  renderMine(); renderList(); renderPatterns();
 }
function addPattern(){
  const p = $1('#apP').value.trim(), z = $1('#apZ').value.trim();
  if(!p || !z){ toast('句型和中文不能为空'); return; }
  MY_PATTERNS.push({ id: uid(), p, z, ex: $1('#apEx').value.trim(), ez: $1('#apEz').value.trim(), lg: $1('#apLg').value });
  saveMine();
  $1('#apP').value = ''; $1('#apZ').value = ''; $1('#apEx').value = ''; $1('#apEz').value = '';
  toast('✅ 已添加句型：' + p);
  renderMine(); renderPatterns();
}
$1('#awAdd').addEventListener('click', addWord);
$1('#apAdd').addEventListener('click', addPattern);
['awT','awZ','awP','awR'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', ev => { if(ev.key === 'Enter'){ ev.preventDefault(); addWord(); } });
});
['apP','apZ','apEx','apEz'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', ev => { if(ev.key === 'Enter'){ ev.preventDefault(); addPattern(); } });
});
function renderMine(){
  const box = $1('#myList'); if(!box) return;
  let html = '';
  MY_WORDS.forEach(w => {
    html += '<div class="myitem"><span class="tag">生词</span><span class="th">' + w.t + '</span><span class="pcol">' + (w.p || '') + '</span><span class="zcol">' + w.z + '</span><span class="rcol">' + (w.lg || '') + '</span><button class="del" data-id="' + w.id + '">🗑 删除</button></div>';
  });
  MY_PATTERNS.forEach(pt => {
    html += '<div class="myitem"><span class="tag tagp">句型</span><span class="th">' + pt.p + '</span><span class="zcol">' + pt.z + '</span><span class="rcol">' + (pt.lg || '') + '</span><button class="del" data-id="' + pt.id + '">🗑 删除</button></div>';
  });
  box.innerHTML = html || '<div class="noteinfo">还没有添加内容。用上方表单添加生词或句型，会立即出现在「📋 词表」「✍️ 拼写」「🧩 句型」里。</div>';
  box.querySelectorAll('.del').forEach(b => {
    b.onclick = () => {
      const id = b.dataset.id;
      MY_WORDS = MY_WORDS.filter(x => x.id !== id);
      MY_PATTERNS = MY_PATTERNS.filter(x => x.id !== id);
      saveMine(); renderMine(); renderList();
renderPatterns();
    };
  });
}
$1('#exportDataBtn').addEventListener('click', async () => {
  let storedImgs = [];
  try{ storedImgs = JSON.parse(await (IDB.get('kb_note_imgs') || '')) || []; }catch(e){}
  if(!Array.isArray(storedImgs) || !storedImgs.length) storedImgs = NOTE_IMGS;
  const data = { words: MY_WORDS, patterns: MY_PATTERNS, notes: (function(){ try{ return localStorage.getItem('kb_notes') || ''; }catch(e){ return ''; } })(), noteImgs: storedImgs, atts: NOTE_ATTS };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '泰语知识库-我的数据.json';
  a.click();
  URL.revokeObjectURL(a.href);
});
$1('#importDataBtn').addEventListener('click', () => $1('#importFile').click());
$1('#importFile').addEventListener('change', ev => {
  const f = ev.target.files[0]; if(!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try{
      const d = JSON.parse(rd.result);
      if(Array.isArray(d.words)){
        MY_WORDS = MY_WORDS.concat(d.words.filter(x => x && x.t).map(x => ({ id: uid(), t: x.t, z: x.z || '', p: x.p || '', r: x.r || '', lg: x.lg || '导入' })));
      }
      if(Array.isArray(d.patterns)){
        MY_PATTERNS = MY_PATTERNS.concat(d.patterns.filter(x => x && x.p).map(x => ({ id: uid(), p: x.p, z: x.z || '', ex: x.ex || '', ez: x.ez || '', lg: x.lg || '导入' })));
      }
      if(typeof d.notes === 'string'){ localStorage.setItem('kb_notes', d.notes); }
      if(Array.isArray(d.noteImgs)){ NOTE_IMGS = d.noteImgs.filter(x => x && x.src); saveNoteImgs(); renderNoteImgs(); }
      if(Array.isArray(d.atts)){ NOTE_ATTS = d.atts.filter(x => x && x.data && x.name); saveNoteAtts(); renderNoteAtts(); }
      if(d.notes || d.noteImgs || d.atts) loadNote();
      saveMine(); renderMine(); renderList();
renderPatterns();
    }catch(e){ toast('❌ JSON 格式不对'); }
    ev.target.value = '';
  };
  rd.readAsText(f);
});
$1('#clearDataBtn').addEventListener('click', () => {
  if(confirm('确定清空所有「我的添加」内容？')){ MY_WORDS = []; MY_PATTERNS = [];  saveMine(); renderMine(); renderList(); renderPatterns();
  toast('已清空'); }
});


