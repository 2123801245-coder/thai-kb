/* nav.js —— 全站共享的两级导航脚手架（课程大类 → 课文/小类）
   本文件由 泰语个人知识库.html 的内联脚本按行拆分而来，行为与原内联脚本一致；
   加载顺序见 HTML 底部的 <script src> 序列（顺序即原执行顺序）。 */
/* ============ 共享两级导航脚手架（课程大类 → 课文/小类，全站统一） ============ */
function navScroll(){ window.scrollTo({ top: 0, behavior: 'smooth' }); }
function countByLesson(list, keyOf){
  const cnts = {};
  list.forEach(x => { const k = keyOf(x); cnts[k] = (cnts[k] || 0) + 1; });
  return cnts;
}
function lessonKeysFor(scope, keyAll, courseLessonsFn){
  if(COURSES.includes(scope)) return courseLessonsFn(scope);
  if(scope === '__other__') return keyAll().filter(k => !COURSES.includes(courseOfKey(k)));
  return courseLessonsFn(courseOfKey(scope));
}
function scopeLabel(scope, icons, allLabel, otherLabel){
  if(scope === '__allshow__') return allLabel;
  if(scope === '__other__') return '🗂 ' + (otherLabel || '其他 / 我的生词');
  if(COURSES.includes(scope)) return (COURSE_ICON[scope] || '📘') + ' ' + scope;
  return icons[scope] || ('📘 ' + scope);
}
function courseGridHtml(title, cards){
  return '<div class="readcrumb">' + title + '</div><div class="coursegrid">' + cards.join('') + '</div>';
}
function courseCardHtml(icon, name, metas, attr, val){
  return '<button class="coursecard"' + (attr ? ' data-' + attr + '="' + val + '"' : '') + '><span class="cc-icon">' + icon + '</span>'
    + '<span class="cc-name">' + name + '</span>'
    + metas.map(m => '<span class="cc-meta">' + m + '</span>').join('')
    + '</button>';
}
function lessonCardsHtml(cards){
  return '<div class="lessoncards">' + cards.join('') + '</div>';
}
function lessonCardHtml(current, title, meta, attr, val){
  return '<button class="lessoncard' + (current ? ' current' : '') + '"' + (attr ? ' data-' + attr + '="' + val + '"' : '') + '>'
    + '<span class="lc-title">' + title + '</span>'
    + '<span class="lc-meta">' + meta + '</span>'
    + '</button>';
}
function wireCards(box, attr, onPick){
  box.querySelectorAll('[data-' + attr + ']').forEach(b => {
    b.onclick = () => onPick(b.getAttribute('data-' + attr), b);
  });
}
function wireBack(id, onBack){
  const b = document.getElementById(id);
  if(b) b.onclick = () => { onBack(); navScroll(); };
}
function backRow(backId, label){
  return '<div class="readnavrow"><button class="btn ghost2 sm readback" id="' + backId + '">← ' + label + '</button>';
}

