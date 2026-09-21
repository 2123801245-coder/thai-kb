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


/* ============ 📱 手机 / 平板：顶栏滚动收起 + 标签条滚动居中 ============ */
(function(){
  const hdr = document.querySelector('header');
  if(!hdr) return;
  const mq = window.matchMedia('(max-width: 820px)');
  let hdrPad = 0;

  /* 窄屏下顶栏改为 fixed，用 body 的 padding-top 顶开内容。
     量的是「展开态」高度，收起时不改 padding —— 否则滚到一半整页会跳一下。 */
  function measure(){
    if(!mq.matches){ document.body.style.paddingTop = ''; hdrPad = 0; return; }
    const wasCompact = hdr.classList.contains('compact');
    hdr.classList.remove('compact');
    hdrPad = hdr.offsetHeight;
    if(wasCompact) hdr.classList.add('compact');
    document.body.style.paddingTop = hdrPad + 'px';
  }
  function apply(){
    if(!mq.matches){ hdr.classList.remove('compact'); return; }
    hdr.classList.toggle('compact', window.scrollY > 32);
  }
  let raf = null;
  window.addEventListener('scroll', () => {
    if(raf) return;
    raf = requestAnimationFrame(() => { raf = null; apply(); });
  }, { passive: true });
  window.addEventListener('resize', () => { measure(); apply(); });
  window.addEventListener('orientationchange', () => setTimeout(() => { measure(); apply(); }, 250));
  if(mq.addEventListener) mq.addEventListener('change', () => { measure(); apply(); });

  /* 手机上标签条要横向滚动，点完把当前标签滚到中间 */
  function centerTab(t){
    if(!t || !t.parentElement) return;
    const box = t.parentElement;
    if(box.scrollWidth <= box.clientWidth + 2) return;
    const left = t.offsetLeft - (box.clientWidth - t.offsetWidth) / 2;
    box.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }
  tabs.forEach(t => t.addEventListener('click', () => centerTab(t)));

  measure(); apply();
  requestAnimationFrame(() => { measure(); centerTab(document.querySelector('.tab.on')); });
})();
