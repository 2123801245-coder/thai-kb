/* js/about.js —— 页头版本徽标 + 「关于」面板
   版本号唯一来源是 data/app.json（经 KB_RAW 注入，仓库/发布版/APK 同源）；
   环境识别：Capacitor（APK）/ 离线发布包（KB_PACK）/ 仓库 HTTP / Pages。 */
(function () {
  let APP = {};
  try { APP = JSON.parse(window.KB_RAW && window.KB_RAW['app.json'] || '{}'); } catch (e) {}
  /* 仓库 HTTP 模式没有注入 app.js：fetch data/app.json；file:// 下静默用默认值 */
  if (!APP.version && !(window.KB_RAW && window.KB_RAW['app.json'])) {
    try {
      const x = new XMLHttpRequest();
      x.open('GET', 'data/app.json', false);            /* 同步：初始化前就要版本号 */
      x.send(null);
      if (x.status === 200) APP = JSON.parse(x.responseText);
    } catch (e) { /* file:// 等：保持默认 */ }
  }

  function detectEnv() {
    const ua = navigator.userAgent || '';
    if (ua.indexOf('Capacitor') >= 0) return 'apk';
    if (window.KB_PACK) return 'pack';
    if (location.protocol === 'http:' || location.protocol === 'https:') return 'web';
    return 'file';
  }
  const ENV_TXT = {
    apk: '📱 安卓 App（全量离线）',
    pack: '💾 离线发布版（双击即用）',
    web: '🌐 网页版（GitHub Pages）',
    file: '📄 本地文件（file://）'
  };

  function fmt() {
    const v = 'v' + (APP.version || '1.0.0');
    const b = APP.build ? ' (' + APP.build + ')' : '';
    return v + b;
  }

  function panel() {
    const old = document.getElementById('aboutMask');
    if (old) { old.remove(); return; }
    const env = detectEnv();
    const notes = (APP.notes || []).map(n => '<li>' + n + '</li>').join('');
    const mask = document.createElement('div');
    mask.id = 'aboutMask';
    mask.style.cssText = 'position:fixed;inset:0;background:rgba(20,22,40,.45);z-index:99;display:grid;place-items:center;padding:20px;';
    mask.innerHTML =
      '<div style="background:var(--card,#fff);border-radius:18px;max-width:420px;width:100%;padding:22px 20px;box-shadow:0 12px 40px rgba(0,0,0,.25)">' +
      '<div style="text-align:center;font-size:34px">🇹🇭</div>' +
      '<div style="text-align:center;font-weight:700;font-size:17px;margin-top:6px">' + (APP.name || '泰语个人知识库') + '</div>' +
      '<div style="text-align:center;color:var(--muted,#7d8291);font-size:13px;margin-top:2px">' + fmt() + ' · ' + (APP.date || '') + '</div>' +
      '<div style="text-align:center;margin-top:4px"><span style="background:var(--teal-soft,#eceefc);color:var(--teal,#5b5fc7);border-radius:999px;padding:2px 12px;font-size:12px">' + (ENV_TXT[env] || env) + '</span></div>' +
      (notes ? '<div style="margin-top:14px;font-size:13px;color:var(--ink,#232633)"><div style="font-weight:600;margin-bottom:4px">本版要点</div><ul style="padding-left:18px;line-height:1.9">' + notes + '</ul></div>' : '') +
      '<div style="margin-top:14px;font-size:12px;color:var(--muted,#7d8291);line-height:1.8">生词、句型、课文、辨析与测验的离线泰语知识库。<br>掌握度/错题/笔记保存在本机；「➕添加」固定内容随版本更新。</div>' +
      '<button id="aboutClose" style="display:block;width:100%;margin-top:16px;border:none;background:var(--teal,#5b5fc7);color:#fff;border-radius:12px;padding:10px;font-size:14px;cursor:pointer">关闭</button>' +
      '</div>';
    mask.addEventListener('click', e => { if (e.target === mask) mask.remove(); });
    document.body.appendChild(mask);
    document.getElementById('aboutClose').onclick = () => mask.remove();
  }

  function init() {
    const sub = document.querySelector('.htop .sub');
    const h1 = document.querySelector('.htop h1');
    if (!h1) return;
    const b = document.createElement('button');
    b.id = 'aboutBtn';
    b.textContent = fmt();
    b.title = '关于';
    b.style.cssText = 'float:right;border:1px solid var(--line,#dfe1ef);background:var(--card,#fff);color:var(--muted,#7d8291);' +
      'border-radius:999px;padding:2px 10px;font-size:11px;cursor:pointer;font-weight:600;vertical-align:middle;';
    b.onclick = panel;
    if (sub) sub.parentNode.insertBefore(b, sub); else h1.appendChild(b);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
