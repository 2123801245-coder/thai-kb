/* memory.js —— 记忆拆解（2026-11-03 新增，不改数据、不改掌握度）
   用途：刷卡背单词翻面后多一行“部件拆解”，先按部件读，再合起来想意思。
   部件表只用知识库词表里已经核对过的部件和释义，没有把握的词不硬拆，
   这时只显示罗马音分段，提示按读音分段记。
   依赖：全局 kbEsc（core.js 已提供）；没有 kbEsc 时用本地转义兜底。 */
var KB_MEM_PARTS = [
  ['กรุงเทพมหานคร', '曼谷（全称）'],
  ['กระดาษ', '纸'],
  ['คำนวณ', '计算'],
  ['ป้องกัน', '防止、预防'],
  ['เปลี่ยน', '换、改变'],
  ['แปลง', '变'],
  ['ห้อง', '房间'],
  ['เรียน', '学习'],
  ['กลับ', '回、返回'],
  ['การ', '名词化前缀'],
  ['น้ำ', '水'],
  ['โรง', '建筑、厅'],
  ['วาง', '放、制定'],
  ['แผน', '计划'],
  ['ท่วม', '泛滥']
];
KB_MEM_PARTS.sort(function(a, b){ return b[0].length - a[0].length; });
function kbMemEsc(s){
  if (typeof kbEsc === 'function') return kbEsc(s);
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function kbMemPartsFor(text){
  var parts = [];
  var segs = String(text || '').split(' ');
  for (var si = 0; si < segs.length; si++) {
    var seg = segs[si];
    if (!seg) continue;
    var i = 0;
    while (i < seg.length) {
      var matched = null;
      for (var k = 0; k < KB_MEM_PARTS.length; k++) {
        var p = KB_MEM_PARTS[k][0];
        if (seg.substr(i, p.length) === p) { matched = KB_MEM_PARTS[k]; break; }
      }
      if (matched) { parts.push({ t: matched[0], z: matched[1] }); i += matched[0].length; }
      else { parts.push({ t: seg.charAt(i), z: '' }); i += 1; }
    }
    if (si < segs.length - 1) parts.push({ t: ' ', z: '' });
  }
  return parts;
}
function kbMemHtml(w){
  if (!w || !w.t) return '';
  var parts = kbMemPartsFor(w.t);
  var known = parts.filter(function(p){ return p.z; });
  if (known.length >= 2) {
    var line = known.map(function(p){ return kbMemEsc(p.t) + '（' + kbMemEsc(p.z) + '）'; }).join(' + ');
    return '<div class="fc-r">部件拆解：' + line + ' · 先按部件读，再合起来想意思</div>';
  }
  if (known.length === 1 && parts.length >= 3) {
    var p0 = known[0];
    return '<div class="fc-r">部件提示：' + kbMemEsc(p0.t) + '（' + kbMemEsc(p0.z) + '） · 其余部分按读音分段记</div>';
  }
  if (w.r) {
    var chunks = String(w.r).split(/\s+/).filter(Boolean).join(' · ');
    return '<div class="fc-r">读音分段：' + kbMemEsc(chunks) + ' · 按分段读，再合起来想意思</div>';
  }
  return '';
}
window.kbMemHtml = kbMemHtml;
window.kbMemPartsFor = kbMemPartsFor;
