/* js/about.js —— 页头版本徽标 + 「关于」面板 + 应用内更新检查
   版本号唯一来源是 data/app.json（发布版/APK 经 KB_RAW 注入；仓库 HTTP 下同步 XHR 读）；
   环境识别：Capacitor（APK）/ 离线发布包（KB_PACK）/ 仓库 HTTP / Pages。
   更新检查：启动后静默 fetch 远端 data/app.json（updateUrl），发现新版本时
   徽标变「v本机 ↗v远端」，关于面板给出更新说明；不打扰、失败即静默。 */
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

  /* ── 更新检查 ─────────────────────────────────────── */
  let UPDATE = null;                                   /* {version,build,notes,date} */
  const DISMISS_KEY = 'kbUpdateDismissed';

  function cmpVer(a, b) {                              /* a>b → 1，相等 → 0，a<b → -1 */
    const pa = String(a || '0').split('.').map(x => parseInt(x, 10) || 0);
    const pb = String(b || '0').split('.').map(x => parseInt(x, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d) return d > 0 ? 1 : -1;
    }
    return 0;
  }
  const isNewer = r => r && (cmpVer(r.version, APP.version) > 0 ||
    (cmpVer(r.version, APP.version) === 0 && (+r.build || 0) > (+APP.build || 0)));

  /* 新 APK 的下载地址：远端版本声明优先，回退本机声明；发布到 GitHub Releases 后恒可用 */
  function apkUrl() {
    return (UPDATE && UPDATE.apkUrl) || APP.apkUrl || '';
  }

  function refreshBadge() {
    const b = document.getElementById('aboutBtn');
    if (!b) return;
    if (UPDATE && isNewer(UPDATE)) {
      b.textContent = fmt() + ' ↗v' + UPDATE.version;
      b.style.color = '#fff';
      b.style.background = 'var(--teal,#5b5fc7)';
      b.style.borderColor = 'var(--teal,#5b5fc7)';
    } else {
      b.textContent = fmt();
      b.style.color = '';
      b.style.background = '';
      b.style.borderColor = '';
    }
  }

  async function checkUpdate(urlOverride) {
    const base = urlOverride || APP.updateUrl;
    if (!base) return;                                 /* 没配远端：不检查 */
    if (navigator.onLine === false) return;            /* 断网：不检查 */
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(base + 'data/app.json?t=' + Date.now(), { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) return;
      const remote = await res.json();
      if (!isNewer(remote)) return;                    /* 同版本/低版本：静默 */
      UPDATE = remote;
      if (localStorage.getItem(DISMISS_KEY) === remote.version + '/' + (remote.build || 0)) return;
      refreshBadge();
    } catch (e) { /* 网络不通/超时：静默 */ }
  }

  /* ── 关于面板 ─────────────────────────────────────── */
  function panel() {
    const old = document.getElementById('aboutMask');
    if (old) { old.remove(); return; }
    const env = detectEnv();
    const notes = (APP.notes || []).map(n => '<li>' + n + '</li>').join('');
    let updateHtml = '';
    if (UPDATE && isNewer(UPDATE)) {
      const unotes = (UPDATE.notes || []).map(n => '<li>' + n + '</li>').join('');
      updateHtml =
        '<div style="margin-top:14px;background:var(--teal-soft,#eceefc);border-radius:12px;padding:12px 14px">' +
        '<div style="font-weight:700;color:var(--teal,#5b5fc7)">🆕 发现新版本 v' + UPDATE.version +
        ' (' + (UPDATE.build || 1) + ') · ' + (UPDATE.date || '') + '</div>' +
        (unotes ? '<ul style="padding-left:18px;font-size:12.5px;line-height:1.9;margin-top:6px">' + unotes + '</ul>' : '') +
        (env === 'apk'
          ? '<div style="font-size:12px;margin-top:6px;line-height:1.7">下载新版 APK 重装即可；你的掌握度、错题、笔记都在本机，重装不丢。</div>' +
            (apkUrl() ? '<a id="aboutDl" href="' + apkUrl() + '" target="_blank" rel="noopener" style="display:block;text-align:center;margin-top:10px;background:var(--gold,#c2699e);color:#fff;border-radius:10px;padding:9px;font-size:14px;font-weight:600;text-decoration:none">⬇️ 下载新版 APK</a>' : '')
          : '<div style="font-size:12px;margin-top:6px">网页 / 离线发布版：<b>刷新页面</b>或用新版发布包替换后刷新即可。</div>') +
        '<button id="aboutDismiss" style="margin-top:8px;border:1px solid var(--line,#dfe1ef);background:#fff;color:var(--muted,#7d8291);border-radius:8px;padding:4px 12px;font-size:12px;cursor:pointer">本版先不提醒</button>' +
        '</div>';
    }
    const mask = document.createElement('div');
    mask.id = 'aboutMask';
    mask.style.cssText = 'position:fixed;inset:0;background:rgba(20,22,40,.45);z-index:99;display:grid;place-items:center;padding:20px;';
    mask.innerHTML =
      '<div style="background:var(--card,#fff);border-radius:18px;max-width:420px;width:100%;padding:22px 20px;box-shadow:0 12px 40px rgba(0,0,0,.25);max-height:86vh;overflow:auto">' +
      '<div style="text-align:center;font-size:34px">🇹🇭</div>' +
      '<div style="text-align:center;font-weight:700;font-size:17px;margin-top:6px">' + (APP.name || '泰语个人知识库') + '</div>' +
      '<div style="text-align:center;color:var(--muted,#7d8291);font-size:13px;margin-top:2px">' + fmt() + ' · ' + (APP.date || '') + '</div>' +
      '<div style="text-align:center;margin-top:4px"><span style="background:var(--teal-soft,#eceefc);color:var(--teal,#5b5fc7);border-radius:999px;padding:2px 12px;font-size:12px">' + (ENV_TXT[env] || env) + '</span></div>' +
      updateHtml +
      (notes ? '<div style="margin-top:14px;font-size:13px;color:var(--ink,#232633)"><div style="font-weight:600;margin-bottom:4px">本版要点</div><ul style="padding-left:18px;line-height:1.9">' + notes + '</ul></div>' : '') +
      '<div style="margin-top:14px;font-size:12px;color:var(--muted,#7d8291);line-height:1.8">生词、句型、课文、辨析与测验的离线泰语知识库。<br>掌握度/错题/笔记保存在本机；「➕添加」固定内容随版本更新。</div>' +
      '<button id="aboutClose" style="display:block;width:100%;margin-top:16px;border:none;background:var(--teal,#5b5fc7);color:#fff;border-radius:12px;padding:10px;font-size:14px;cursor:pointer">关闭</button>' +
      '</div>';
    mask.addEventListener('click', e => { if (e.target === mask) mask.remove(); });
    document.body.appendChild(mask);
    document.getElementById('aboutClose').onclick = () => mask.remove();
    const dis = document.getElementById('aboutDismiss');
    if (dis) dis.onclick = () => {
      try { localStorage.setItem(DISMISS_KEY, UPDATE.version + '/' + (UPDATE.build || 0)); } catch (e) {}
      UPDATE = null;
      refreshBadge();
      mask.remove();
    };
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
    /* 应用内更新检查：启动后 3 秒，静默（失败不打扰） */
    setTimeout(() => checkUpdate(), 3000);
    window.addEventListener('online', () => checkUpdate());
    /* 供调试/测试：KB_ABOUT.check('http://…/') 可指向任意远端 */
    window.KB_ABOUT = { check: checkUpdate, cmpVer: cmpVer };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
