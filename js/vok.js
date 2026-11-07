/* vok.js —— 词汇讲解两级导航与卡片渲染（含让步连词总对比的归属）
   本文件由 泰语个人知识库.html 的内联脚本按行拆分而来，行为与原内联脚本一致；
   加载顺序见 HTML 底部的 <script src> 序列（顺序即原执行顺序）。 */
/* ============ 词汇讲解（两级导航：课程大类 → 讲解内容） ============ */
function vokGroups(){
  const g = {};
  VOK.forEach((it, i) => { const k = it.src || it.lg || '词汇讲解'; (g[k] = g[k] || []).push(i); });
  return g;
}
const VOK_CMP_GROUP = '词汇讲解 高泰1'; /* 让步连词总对比只在该组内显示 */
/* ── 单条翻页模式：一屏一个词条 ── */
let vokIdx = 0;  try { vokIdx = parseInt(localStorage.getItem('kbVokIdx') || '0', 10) || 0; } catch(e) {}
let vokTocOpen = false, vokCmpOpen = false;
function vokSaveIdx(){ try { localStorage.setItem('kbVokIdx', String(vokIdx)); } catch(e) {} }
function vokGo(delta){
  const g = vokGroups();
  const idxs = g[vokCourse] || [];
  if(!idxs.length) return;
  vokIdx = Math.min(idxs.length - 1, Math.max(0, vokIdx + delta));
  vokSaveIdx();
  renderVok();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
kbPagerKeys('pane-vok', () => vokGo(-1), () => vokGo(1));
function renderVok(){
  const box = $1('#vokBox'); if(!box) return;
  const cmp = document.getElementById('vokCompare');
  const g = vokGroups();
  const keys = Object.keys(g);
  const vc = $1('#vokCount'); if(vc) vc.textContent = VOK.length + ' 个词条 · ' + VOK.reduce((a,b)=>a+b.sents.length,0) + ' 个例句';
  if(!vokCourse || keys.indexOf(vokCourse) < 0){
    /* 一级：课程大类 */
    if(cmp) cmp.style.display = 'none';
    let html = '<div class="readcrumb">词汇讲解</div><div class="kbnote">共 ' + keys.length + ' 门讲解课程 · 点进去看词条、讲解与例句</div><div class="coursegrid">';
    keys.forEach(k => {
      const ns = g[k].reduce((a, i) => a + VOK[i].sents.length, 0);
      html += '<button class="coursecard" data-vkg="' + k + '">'
        + '<span class="cc-icon">📚</span>'
        + '<span class="cc-name">' + k + '</span>'
        + '<span class="cc-meta">' + g[k].length + ' 个词条 · ' + ns + ' 个例句</span>'
        + '</button>';
    });
    if(!keys.length) html += '<div class="hint" style="padding:18px 4px;">暂无词汇讲解，可在 data/vok.json 里添加。</div>';
    html += '</div>';
    box.innerHTML = html;
    if(window.kbLevel) kbLevel(box, 1);
    box.querySelectorAll('[data-vkg]').forEach(b => {
      b.onclick = () => { vokCourse = b.dataset.vkg; vokIdx = 0; vokSaveIdx(); vokTocOpen = false; vokCmpOpen = false; renderVok(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    });
    return;
  }
  /* 二级：单条翻页（一屏一个词条；总对比表收进按钮，点开才显示） */
  const key = vokCourse, idxs = g[key] || [];
  if(vokIdx >= idxs.length) vokIdx = Math.max(0, idxs.length - 1);
  if(cmp) cmp.style.display = (key === VOK_CMP_GROUP && vokCmpOpen) ? '' : 'none';
  let html = '<div class="readnavrow"><button class="btn ghost2 sm readback" id="vokBack1">← 全部课程</button><span class="badge">' + key + '</span><span class="badge">' + idxs.length + ' 个词条</span></div>';
  const k = idxs[vokIdx];
  if(k != null){
    const it = VOK[k];
    html += '<div class="card vokcard">'
      + '<div class="vokhdr"><span class="vokidx">' + (vokIdx + 1 < 10 ? '0' : '') + (vokIdx + 1) + '</span><span class="tag tagp">' + key + '</span></div>'
      + '<div class="vokw"><span class="th">' + it.w + '</span><button class="spk" data-w="' + k + '" title="播放词条发音">♪</button>'
      + '<span class="vokz">' + it.z + '</span><span class="vokp">' + (it.p || '') + '</span></div>'
      + '<div class="voknote"><span class="vok-lbl">讲解</span>' + it.note + '</div>'
      + '<div class="voksents">';
    it.sents.forEach((sn, si) => {
      html += '<div class="voks"><button class="spk" data-s="' + k + '|' + si + '">♪</button>'
        + '<div><div class="th">' + sn.t + '</div><div class="vokz2">' + sn.z + '</div></div></div>';
    });
    html += '</div></div>';
  }
  html += kbPagerHtml('vok', vokIdx, idxs.length);
  html += '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:8px;">'
    + '<button class="tocbtn" id="vokToc" type="button" style="margin:0;">' + (vokTocOpen ? '▲ 收起目录' : '📑 词条目录（' + idxs.length + ' 个）') + '</button>'
    + (key === VOK_CMP_GROUP ? '<button class="tocbtn" id="vokCmpBtn" type="button" style="margin:0;">' + (vokCmpOpen ? '▲ 收起总对比表' : '📊 让步连词总对比表') + '</button>' : '')
    + '</div>';
  if(vokTocOpen){
    html += '<div class="lessoncards">';
    idxs.forEach((ki, pos) => {
      const it2 = VOK[ki];
      html += '<button class="lessoncard' + (pos === vokIdx ? ' current' : '') + '" data-vi="' + pos + '" type="button">'
        + '<span class="lc-title">' + it2.w + '</span>'
        + '<span class="lc-meta">' + kbEsc(String(it2.z || '').slice(0, 24)) + '</span></button>';
    });
    html += '</div>';
  }
  box.innerHTML = html || '<div class="noteinfo">暂无词汇讲解。</div>';
  if(window.kbLevel) kbLevel(box, 2);
  const bk = document.getElementById('vokBack1');
  if(bk) bk.onclick = () => { vokCourse = null; renderVok(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  box.querySelectorAll('.spk').forEach(b => {
    b.onclick = () => {
      const d = b.dataset.s ? b.dataset.s.split('|') : [b.dataset.w, '-1'];
      const it = VOK[+d[0]];
      if(+d[1] >= 0) speakThai('vok|' + it.sents[+d[1]].t); else speakThai('vok|' + it.w);
    };
  });
  const pv = document.getElementById('vokPrev'); if(pv) pv.onclick = () => vokGo(-1);
  const nx = document.getElementById('vokNext'); if(nx) nx.onclick = () => vokGo(1);
  const toc = document.getElementById('vokToc'); if(toc) toc.onclick = () => { vokTocOpen = !vokTocOpen; renderVok(); };
  const cb = document.getElementById('vokCmpBtn'); if(cb) cb.onclick = () => { vokCmpOpen = !vokCmpOpen; renderVok(); };
  box.querySelectorAll('[data-vi]').forEach(b => {
    b.onclick = () => { vokIdx = +b.dataset.vi; vokSaveIdx(); renderVok(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  });
  if(cmp){
    cmp.querySelectorAll('.spk[data-cs]').forEach(b => {
      b.onclick = () => speakThai('vok|' + b.dataset.cs);
    });
  }
}

