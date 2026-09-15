/* app.js —— 应用外壳：标签页切换 + 启动时依次调用各渲染器
   本文件由 泰语个人知识库.html 的内联脚本按行拆分而来，行为与原内联脚本一致；
   加载顺序见 HTML 底部的 <script src> 序列（顺序即原执行顺序）。 */
/* ============ Tab 切换 ============ */
const tabs = $('.tab');
tabs.forEach(t => t.addEventListener('click', () => {
  const pv = document.querySelector('.tab.on');
  if(pv && pv.dataset.v === 'spell' && spTimer){ clearTimeout(spTimer); spTimer = null; }
  tabs.forEach(x => x.classList.remove('on'));
  t.classList.add('on');
  $('.pane').forEach(p => p.classList.remove('on'));
  $1('#pane-' + t.dataset.v).classList.add('on');
  if(t.dataset.v === 'spell') spEnsure();
  if(t.dataset.v === 'notes') loadNote();
  if(t.dataset.v === 'add') renderMine();
  if(t.dataset.v === 'vok') renderVok();
  if(t.dataset.v === 'lquiz') lqEnsure();
  if(t.dataset.v === 'wrongbook') renderWrongBook();
}));

/* ============ 启动 ============ */
refreshCounts();
saveCls();
clampPage();
renderDisc();
renderList();
renderPatterns();
renderVok();
renderRead();

/* 分类面板按钮（若面板存在则绑定） */
(function(){
  const b1 = document.getElementById('classifyAllBtn'); if(b1) b1.onclick = classifyAll;
  const b2 = document.getElementById('clearCountsBtn'); if(b2) b2.onclick = clearCounts;
  const b3 = document.getElementById('resetConfBtn'); if(b3) b3.onclick = resetAll;
})();
