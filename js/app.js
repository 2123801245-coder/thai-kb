/* app.js —— 应用外壳：标签页切换 + 启动时依次调用各渲染器
   本文件由 泰语个人知识库.html 的内联脚本按行拆分而来，行为与原内联脚本一致；
   加载顺序见 HTML 底部的 <script src> 序列（顺序即原执行顺序）。 */
/* ============ Tab 切换 ============ */
const tabs = $('.tab');
tabs.forEach(t => t.addEventListener('click', () => {
  const pv = document.querySelector('.tab.on');
  if(pv && pv.dataset.v === 'ex' && exTimer){ clearTimeout(exTimer); exTimer = null; }
  tabs.forEach(x => x.classList.remove('on'));
  t.classList.add('on');
  $('.pane').forEach(p => p.classList.remove('on'));
  $1('#pane-' + t.dataset.v).classList.add('on');
  if(t.dataset.v === 'notes') loadNote();
  if(t.dataset.v === 'add') renderMine();
  if(t.dataset.v === 'vok') renderVok();
  if(t.dataset.v === 'ex') exEnsure();
  if(t.dataset.v === 'wrongbook') renderWrongBook();
  if(t.dataset.v === 'flash' && typeof fcEnsure === 'function') fcEnsure();
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


/* ============ 📱 手机 / 平板：顶栏高度同步 + 标签条滚动居中 ============ */
(function(){
  const mq = window.matchMedia('(max-width: 820px)');
  const topbar = document.querySelector('.topbar');

  /* 顶栏在窄屏是 fixed：把它的真实高度（含刘海安全区）写进 --tb-h，
     body 的 padding-top 与标签条的 sticky top 都跟着这个变量走。 */
  function measure(){
    if(!mq.matches || !topbar){ document.documentElement.style.removeProperty('--tb-h'); return; }
    const td = topbar.offsetHeight;
    if(td > 0) document.documentElement.style.setProperty('--tb-h', td + 'px');
  }
  window.addEventListener('resize', measure);
  window.addEventListener('orientationchange', () => setTimeout(measure, 250));
  if(mq.addEventListener) mq.addEventListener('change', measure);
  window.addEventListener('load', measure);

  /* 手机上标签条要横向滚动，点完把当前标签滚到中间 */
  function centerTab(t){
    if(!t || !t.parentElement) return;
    const box = t.parentElement;
    if(box.scrollWidth <= box.clientWidth + 2) return;
    const left = t.offsetLeft - (box.clientWidth - t.offsetWidth) / 2;
    box.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }
  tabs.forEach(t => t.addEventListener('click', () => centerTab(t)));
  /* 底部导航切分组后，当前标签可能还在屏幕外，也居中一下 */
  window.addEventListener('kbshellgroup', () => centerTab(document.querySelector('.tabs .tab.on')));

  measure();
  requestAnimationFrame(() => { measure(); centerTab(document.querySelector('.tabs .tab.on')); });
})();
