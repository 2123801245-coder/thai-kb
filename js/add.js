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
  box.innerHTML = html || '<div class="noteinfo">还没有添加内容。用上方表单添加生词或句型，会立即出现在「📋 词表」「🎯 词汇练习」「🧩 句型」里。</div>';
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
/* 导出 / 导入：完整备份（实现见 js/storage.js；旧版导出的 JSON 仍然读得进来） */
$1('#exportDataBtn').addEventListener('click', kbDownloadBackup);
$1('#importDataBtn').addEventListener('click', () => $1('#importFile').click());
$1('#importFile').addEventListener('change', ev => {
  const f = ev.target.files[0];
  if(f) kbImportFromFile(f);
  ev.target.value = '';
});
$1('#clearDataBtn').addEventListener('click', () => {
  if(confirm('确定清空所有「我的添加」内容？')){ MY_WORDS = []; MY_PATTERNS = [];  saveMine(); renderMine(); renderList(); renderPatterns();
  toast('已清空'); }
});

/* 📌 固定到知识库：把「我的添加」写进 data/*.json（发布版同步 data/*.js），
   成为知识库本体，随版本更新与发版走，不再只存在浏览器里。
   服务端实现见 server.py 的 POST /api/pin（只收本机请求，按 t / p / label 去重）。 */
async function pinToData(){
  if(location.protocol === 'file:'){
    toast('⚠️ 直接双击文件打开时写不进知识库：请用启动器以网址方式打开后再固定');
    return;
  }
  const myLessons = (typeof MY_LESSONS !== 'undefined') ? MY_LESSONS : [];
  /* 学习进度快照：掌握度 + 错题本 + 笔记文字（图片/附件仍在本机，靠导出备份）。
     笔记优先取编辑框里的最新内容，没打开过笔记页就取已保存的 kb_notes。 */
  let progress = null;
  try{
    let notes = null;
    const ta = $1('#noteArea');
    if(ta && ta.value) notes = ta.value;
    if(notes === null) notes = localStorage.getItem('kb_notes');
    progress = {
      cls: (typeof CLS !== 'undefined') ? CLS : {},
      wrongs: JSON.parse(localStorage.getItem('kb_wrongs') || '[]'),
      notes: notes || ''
    };
  }catch(e){ progress = null; }
  if(!MY_WORDS.length && !MY_PATTERNS.length && !myLessons.length && !progress){
    toast('没有可固定的内容');
    return;
  }
  const btn = $1('#pinBtn');
  /* 静态托管（GitHub Pages 等）没有 server.py，POST /api/pin 必然 404/405 ——
     先探明环境再给对应提示，而不是把原始报错甩给同学 */
  const host = location.hostname;
  const onStaticHost = /github\.io|githubusercontent\.com$/.test(host) ||
    (location.protocol === 'https:' && !/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(host) && !/^192\.168\./.test(host) && !/^10\./.test(host) && !/^172\.(1[6-9]|2\d|3[01])\./.test(host));
  if(onStaticHost && (typeof MY_LESSONS === 'undefined' ? false : true) || onStaticHost){
    if(btn){
      const n = (typeof MY_WORDS !== 'undefined' ? MY_WORDS.length : 0) + (typeof MY_PATTERNS !== 'undefined' ? MY_PATTERNS.length : 0);
      btn.textContent = n ? '📌 固定需在电脑上打开本库（网页版只读）' : btn.textContent;
    }
  }
  if(btn){ btn.disabled = true; btn.textContent = '⏳ 固定中…'; }
  try{
    const res = await fetch(location.origin + '/api/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ words: MY_WORDS, patterns: MY_PATTERNS, lessons: myLessons, progress: progress })
    });
    const txt = await res.text();
    let d = null;
    try{ d = JSON.parse(txt); }catch(e){ throw new Error('服务器返回不对：' + txt.slice(0, 60)); }
    if(!res.ok || !d.ok) throw new Error(d && d.error ? d.error : ('HTTP ' + res.status));
    const aw = (d.added && d.added.words) || [], ap = (d.added && d.added.patterns) || [], al = (d.added && d.added.lessons) || [];
    const sk = d.skipped || {};
    const pc = !!d.progressChanged;
    if(aw.length || ap.length || al.length || typeof MY_LESSONS !== 'undefined'){
      MY_WORDS = MY_WORDS.filter(w => aw.indexOf(w.t) < 0);
      MY_PATTERNS = MY_PATTERNS.filter(p => ap.indexOf(p.p) < 0);
      if(typeof MY_LESSONS !== 'undefined'){
        MY_LESSONS = MY_LESSONS.filter(l => al.indexOf(l.label) < 0);
        saveMyLessons();
        if(typeof renderMyLessons === 'function') renderMyLessons();
        if(al.length){ try{ localStorage.removeItem('kbReadSec'); }catch(e){} } /* 课文进了内置列表，索引会变，清掉阅读位置让页面重新定位 */
      }
      saveMine(); renderMine(); renderList(); renderPatterns();
    }
    const parts = [];
    if(aw.length) parts.push(aw.length + ' 生词');
    if(ap.length) parts.push(ap.length + ' 句型');
    if(al.length) parts.push(al.length + ' 课文');
    if(pc) parts.push('掌握度/错题/笔记');
    const skipped = (sk.words || 0) + (sk.patterns || 0) + (sk.lessons || 0);
    if(!parts.length){
      toast(skipped ? '没有新增：内容与进度都和上次固定相同' : '没有变化');
      if(btn){ btn.disabled = false; btn.textContent = '📌 固定到知识库（更新不丢）'; }
      return;
    }
    const tail = skipped ? '（' + skipped + ' 条已存在，跳过）' : '';
    if(aw.length || ap.length || al.length){
      toast('✅ 已固定：' + parts.join('、') + tail + '，稍后自动刷新…');
      setTimeout(() => location.reload(), 1500);   /* 只有内容入库才需要刷新重算计数与分类 */
    }else{
      toast('✅ 学习进度已固定：掌握度、错题本、笔记已写进 data-personal/progress.json');
      if(btn){ btn.disabled = false; btn.textContent = '📌 固定到知识库（更新不丢）'; }
    }
  }catch(e){
    const msg = (e && e.message ? e.message : String(e));
    if(/405|404|Not Allowed|Failed to fetch|Unexpected token/.test(msg) && onStaticHost){
      toast('ℹ️ 网页版（GitHub Pages）是只读的：生词已存在「我的添加」本机里不会丢；要固定进知识库，请在电脑上用仓库入口打开本库再点固定，或发给我帮你加进去');
    } else {
      toast('❌ 固定失败：' + msg);
    }
    if(btn){ btn.disabled = false; btn.textContent = '📌 固定到知识库（更新不丢）'; }
  }
}
$1('#pinBtn').addEventListener('click', pinToData);


