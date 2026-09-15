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
function renderVok(){
  const box = $1('#vokBox'); if(!box) return;
  const cmp = document.getElementById('vokCompare');
  const g = vokGroups();
  const keys = Object.keys(g);
  const vc = $1('#vokCount'); if(vc) vc.textContent = VOK.length + ' 个词条 · ' + VOK.reduce((a,b)=>a+b.sents.length,0) + ' 个例句';
  if(!vokCourse || keys.indexOf(vokCourse) < 0){
    /* 一级：课程大类 */
    if(cmp) cmp.style.display = 'none';
    let html = '<div class="readcrumb">📚 词汇讲解 · 请选择课程大类</div><div class="coursegrid">';
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
    box.querySelectorAll('[data-vkg]').forEach(b => {
      b.onclick = () => { vokCourse = b.dataset.vkg; renderVok(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    });
    return;
  }
  /* 二级：讲解内容（总对比表只在其所属组内显示） */
  const key = vokCourse, idxs = g[key] || [];
  if(cmp) cmp.style.display = (key === VOK_CMP_GROUP) ? '' : 'none';
  let html = '<div class="readnavrow"><button class="btn ghost2 sm readback" id="vokBack1">← 选择课程大类</button><span class="badge">📚 ' + key + '</span><span class="badge">' + idxs.length + ' 个词条</span></div>';
  idxs.forEach((k, pos) => {
    const it = VOK[k];
    html += '<div class="card vokcard">'
      + '<div class="vokhdr"><span class="tag tagp">' + key + '</span><span class="vokidx">#' + (pos + 1) + '</span></div>'
      + '<div class="vokw"><span class="th">' + it.w + '</span><button class="spk" data-w="' + k + '" title="播放词条发音">🔊</button>'
      + '<span class="vokz">' + it.z + '</span><span class="vokp">' + (it.p || '') + '</span></div>'
      + '<div class="voknote">💡 ' + it.note + '</div>'
      + '<div class="voksents">';
    it.sents.forEach((sn, si) => {
      html += '<div class="voks"><button class="spk" data-s="' + k + '|' + si + '">🔊</button>'
        + '<div><div class="th">' + sn.t + '</div><div class="vokz2">' + sn.z + '</div></div></div>';
    });
    html += '</div></div>';
  });
  box.innerHTML = html || '<div class="noteinfo">暂无词汇讲解。</div>';
  const bk = document.getElementById('vokBack1');
  if(bk) bk.onclick = () => { vokCourse = null; renderVok(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  box.querySelectorAll('.spk').forEach(b => {
    b.onclick = () => {
      const d = b.dataset.s ? b.dataset.s.split('|') : [b.dataset.w, '-1'];
      const it = VOK[+d[0]];
      if(+d[1] >= 0) speakThai('vok|' + it.sents[+d[1]].t); else speakThai('vok|' + it.w);
    };
  });
  if(cmp){
    cmp.querySelectorAll('.spk[data-cs]').forEach(b => {
      b.onclick = () => speakThai('vok|' + b.dataset.cs);
    });
  }
}

