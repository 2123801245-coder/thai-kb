/* import.js —— 导入课文：本机课文持久化、课程归类、渲染
   本文件由 泰语个人知识库.html 的内联脚本按行拆分而来，行为与原内联脚本一致；
   加载顺序见 HTML 底部的 <script src> 序列（顺序即原执行顺序）。 */
/* ============ 导入课文（localStorage 持久化，按课程分类） ============ */
let MY_LESSONS = [];
try{ MY_LESSONS = JSON.parse(localStorage.getItem('kb_my_lessons') || '[]') || []; }catch(e){}
function saveMyLessons(){ try{ localStorage.setItem('kb_my_lessons', JSON.stringify(MY_LESSONS)); }catch(e){} }
function allSections(){ return SECTIONS.concat(MY_LESSONS); }
$1('#impAdd').addEventListener('click', () => {
  const th = $1('#impTh').value.trim(), zh = $1('#impZh').value.trim();
  const course = $1('#impCourse').value;
  const raw = $1('#impParas').value;
  if(!zh && !th){ toast('请至少填写一个标题'); return; }
  const lines = raw.split('\n').map(x => x.trim()).filter(Boolean);
  if(!lines.length){ toast('请粘贴至少一个段落'); return; }
  const paras = lines.map(line => {
    const m2 = line.split(/＝|=/);
    if(m2.length >= 2) return { t: m2[0].trim(), z: m2.slice(1).join('=').trim() };
    return { t: line, z: '' };
  });
  const label = (zh || th) + ' ' + (th || '');
  MY_LESSONS.push({ label: label.trim(), title: th, titleZh: zh, course: course, imported: true, paras: paras });
  saveMyLessons();
  $1('#impTh').value = ''; $1('#impZh').value = ''; $1('#impAuthor').value = ''; $1('#impParas').value = '';
  toast('✅ 已导入课文到「' + course + '」');
  readSec = allSections().length - 1;
  readView = 'lesson'; readCourse = course;
  try{ localStorage.setItem('kbReadSec', String(readSec)); }catch(e){}
  renderRead();
  renderMyLessons();
});
function renderMyLessons(){
  const box = $1('#myLessonsBox'); if(!box) return;
  if(!MY_LESSONS.length){ box.innerHTML = '<span class="hint">暂无导入的课文。</span>'; return; }
  let html = '<div class="hint" style="margin-bottom:6px;"><b>已导入 ' + MY_LESSONS.length + ' 篇：</b></div>';
  MY_LESSONS.forEach((ls, i) => {
    html += '<div class="mylesson">'
      + '<span class="th">' + (ls.titleZh || ls.title || ls.label) + '</span>'
      + '<span class="hint">' + ls.paras.length + ' 段</span>'
      + '<select data-mlc="' + i + '">'
      + COURSES.map(c => '<option value="' + c + '"' + (ls.course === c ? ' selected' : '') + '>' + (COURSE_ICON[c] || '') + ' ' + c + '</option>').join('')
      + '</select>'
      + '<button class="btn ghost2 sm" data-mldel="' + i + '">🗑 删除</button>'
      + '</div>';
  });
  box.innerHTML = html;
  box.querySelectorAll('select[data-mlc]').forEach(sel => {
    sel.onchange = () => {
      const ls = MY_LESSONS[+sel.dataset.mlc];
      ls.course = sel.value;
      saveMyLessons();
      readView = 'course'; readCourse = sel.value;
      renderRead();
      toast('✅ 已移到「' + sel.value + '」');
    };
  });
  box.querySelectorAll('button[data-mldel]').forEach(btn => {
    btn.onclick = () => {
      const i = +btn.dataset.mldel;
      const ls = MY_LESSONS[i];
      if(!confirm('删除导入的课文「' + (ls.titleZh || ls.title || ls.label) + '」？（不影响文件内置课文）')) return;
      MY_LESSONS.splice(i, 1);
      saveMyLessons();
      readSec = Math.min(readSec, allSections().length - 1);
      readView = 'course'; readCourse = ls.course;
      renderRead();
      renderMyLessons();
      toast('已删除');
    };
  });
}
renderMyLessons();

