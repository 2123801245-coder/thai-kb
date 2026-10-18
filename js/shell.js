/* shell.js —— 应用外壳：左侧栏 / 底部导航 / 分组标签逻辑 / 顶栏快捷按钮
   分组只是「视图归属」：所有标签页仍在 .tabs 里、由 app.js 统一切换；
   这里负责：按组显示手机标签条、生成侧栏与底栏并同步选中态、
   顶栏的 🅰 字体 / 🔊 语速快捷键，以及「📌 使用说明」的跳转。
   初始选中页 = HTML 里 .tab.on（默认「🏠 首页」）。 */
(function () {
  const GROUPS = [
    { id: 'home',  icon: '🏠', label: '首页' },
    { id: 'learn', icon: '📖', label: '学习' },
    { id: 'train', icon: '🎯', label: '训练' },
    { id: 'mine',  icon: '👤', label: '我的' }
  ];
  const tabEls = $('.tabs .tab');
  const byV = {};
  tabEls.forEach(t => { byV[t.dataset.v] = t; });
  const groupCfg = id => GROUPS.find(g => g.id === id) || GROUPS[0];
  /* 每组「记住上次」：底栏切走再切回来，能回到之前那一页 */
  const lastTab = { home: 'home', learn: 'list', train: 'ex', mine: 'notes' };
  const defTab = { home: 'home', learn: 'list', train: 'ex', mine: 'notes' };

  /* 从标签文本里拆出图标和名字（"📋 词表" → 📋 / 词表） */
  function parts(t) {
    const txt = (t.textContent || '').trim();
    const i = txt.indexOf(' ');
    return i > 0 ? { ic: txt.slice(0, i), lb: txt.slice(i + 1) } : { ic: '•', lb: txt };
  }

  /* ---- 桌面侧栏 ---- */
  const sn = document.getElementById('sidenav');
  if (sn) {
    let html = '';
    GROUPS.forEach(g => {
      const items = tabEls.filter(t => t.dataset.g === g.id);
      if (!items.length) return;
      html += '<div class="sn-group"><div class="sn-gl">' + g.icon + ' ' + g.label + '</div>';
      items.forEach(t => {
        const p = parts(t);
        html += '<button class="snitem" type="button" data-go="' + t.dataset.v + '">'
          + '<span class="sn-ic">' + p.ic + '</span><span class="sn-b">' + p.lb + '</span></button>';
      });
      html += '</div>';
    });
    sn.innerHTML = html;
    sn.querySelectorAll('[data-go]').forEach(b => { b.onclick = () => activate(b.dataset.go); });
  }

  /* ---- 手机底部导航 ---- */
  const bn = document.getElementById('bottomnav');
  if (bn) {
    bn.innerHTML = GROUPS.map(g =>
      '<button class="bnitem" type="button" data-g="' + g.id + '">'
      + '<span class="bn-ic">' + g.icon + '</span><span class="bn-lb">' + g.label + '</span></button>'
    ).join('');
    bn.querySelectorAll('[data-g]').forEach(b => {
      b.onclick = () => {
        const g = b.dataset.g;
        if (g === document.body.dataset.group) {          /* 再点当前组：回组内默认页 + 顶部 */
          const cur = byV[defTab[g]];
          const on = document.querySelector('.tabs .tab.on');
          if (on && cur && on !== cur) cur.click();
          else if (g === 'home' && typeof renderHome === 'function') renderHome();
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        activate(lastTab[g] || defTab[g]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
    });
  }

  /* ---- 切页 & 各壳件同步 ---- */
  let activeV = 'home';
  function sync() {
    const t = byV[activeV];
    document.body.dataset.group = groupCfg(t && t.dataset.g).id;
    if (sn) sn.querySelectorAll('.snitem').forEach(b => b.classList.toggle('on', b.dataset.go === activeV));
    if (bn) bn.querySelectorAll('.bnitem').forEach(b => b.classList.toggle('on', b.dataset.g === document.body.dataset.group));
    window.dispatchEvent(new CustomEvent('kbshellgroup'));
  }
  function noteTab(t) {
    activeV = t.dataset.v;
    if (t.dataset.g) lastTab[t.dataset.g] = activeV;
    sync();
    if (activeV === 'home' && typeof renderHome === 'function') renderHome();
  }
  function activate(v) {
    const t = byV[v] || byV[defTab[v]];
    if (!t) return;
    if (t.classList.contains('on')) {
      if (t.dataset.v === 'home' && typeof renderHome === 'function') renderHome();
      sync();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    t.click();                                            /* 交给 app.js 的统一切换逻辑 */
  }
  tabEls.forEach(t => t.addEventListener('click', () => noteTab(t)));

  /* ---- 顶栏快捷按钮：字体 / 语速 ---- */
  const SPEEDS = [0.6, 0.8, 0.9, 1, 1.25, 1.5];
  const fmtSpd = v => String(v) + '×';
  const rp = document.getElementById('tbRate'), rpv = document.getElementById('tbRateVal');
  function paintRate() { if (rpv) rpv.textContent = fmtSpd(spd); }
  if (rp) rp.onclick = () => {
    const i = SPEEDS.indexOf(spd);
    spd = SPEEDS[(i + 1) % SPEEDS.length] || SPEEDS[0];
    try { localStorage.setItem('spd', String(spd)); } catch (e) {}
    const sel = document.getElementById('rateSel'); if (sel) sel.value = String(spd);
    paintRate();
    toast('语速 ' + fmtSpd(spd));
  };
  paintRate();
  /* #rateSel 的 change 由 core.js 负责；这里把顶栏标签同步上 */
  const rs = document.getElementById('rateSel');
  if (rs) rs.addEventListener('change', paintRate);

  const tf = document.getElementById('tbFont');
  if (tf) tf.onclick = () => { const b = document.getElementById('fontBtn'); if (b) b.click(); };
  const jf = document.getElementById('goFontBtn');
  if (jf) jf.onclick = () => { const b = document.getElementById('fontBtn'); if (b) b.click(); };
  const ja = document.getElementById('goAboutBtn');
  if (ja) ja.onclick = () => { const b = document.getElementById('aboutBtn'); if (b) b.click(); };
  const jh = document.getElementById('editHintJump');
  if (jh) jh.onclick = () => {
    activate('add');
    const box = document.getElementById('edithint');
    if (box && !box.classList.contains('open')) document.getElementById('edithintBtn').click();
    if (box) setTimeout(() => box.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
  };

  /* ---- 初始态：跟随 HTML 里已选中的标签 ---- */
  const onTab = document.querySelector('.tabs .tab.on') || byV['home'];
  if (onTab) {
    activeV = onTab.dataset.v;
    if (onTab.dataset.g) lastTab[onTab.dataset.g] = activeV;
  }
  sync();

  /* 供首页 / 复习等入口切换标签用（等价于点一下对应标签） */
  window.KB_SHELL = { activate: activate, group: () => document.body.dataset.group };
})();
