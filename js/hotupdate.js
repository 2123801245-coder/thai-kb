/* js/hotupdate.js —— 数据热更新通道（APK / 离线发布版专用，网页版走 SW 网络优先）
   要解决的问题：APK 与离线版把 data/ 打在本地，过去内容更新只能重装 APK 或重下整包。
   这里的做法：
     ① 启动时（本文件在 loader.js 之前执行）读 localStorage 里上次同步的内容，
        如果它比内置版本新，就覆盖 window.KB_RAW —— 同步的数据立刻生效，可离线；
     ② 暴露 KB_HOT.sync()：比对远端 data/hotupdate.json，只下变化的文字数据，
        校验 sha256 后整包存进 localStorage，成功后由调用方刷新页面。

   为什么不用 Cache API：启动时必须同步拿到数据（loader.js 的 syncGet 是同步的），
   只有 localStorage 能同步读。文字数据约 1.3MB，放得下；发音包不在这条通道里。

   环境：
     apk  Capacitor（userAgent 带 Capacitor）
     pack 离线发布版（data/*.js 里写了 window.KB_PACK=1）
     web  HTTP(S) 打开的仓库/Pages —— 数据本来就是网络优先，不需要热更，KB_HOT 直接停用
   失败一律静默：热更是增强，不能影响应用启动。 */
window.KB = window.KB || {};
(function () {
  const HOT_KEY = 'kb_hot_data_v1';
  const isCap = /Capacitor/i.test(navigator.userAgent || '');
  const env = isCap ? 'apk' : (window.KB_PACK ? 'pack' : 'web');

  let APP = {};
  try { APP = JSON.parse((window.KB_RAW && window.KB_RAW['app.json']) || '{}'); } catch (e) {}

  const localBuild = () => +APP.build || 0;
  function readHot() {
    try {
      const raw = localStorage.getItem(HOT_KEY);
      if (!raw) return null;
      const pack = JSON.parse(raw);
      return (pack && pack.files && typeof pack.build === 'number') ? pack : null;
    } catch (e) { return null; }
  }
  function clearHot() { try { localStorage.removeItem(HOT_KEY); } catch (e) {} }

  /* ① 启动应用已同步的数据：比内置新才用，旧的就清掉（防止版本回退后卡在旧数据） */
  let hot = env === 'web' ? null : readHot();
  let appliedBuild = 0;
  if (hot) {
    if (hot.build > localBuild()) {
      window.KB_RAW = window.KB_RAW || {};
      Object.keys(hot.files).forEach(function (n) { window.KB_RAW[n] = hot.files[n]; });
      /* app.json 也在热更包里：徽标/关于面板显示的应是「现在真正在用的版本」 */
      try { APP = JSON.parse(hot.files['app.json'] || '{}'); } catch (e) {}
      appliedBuild = hot.build;
    } else {
      clearHot(); hot = null;
    }
  }

  const remoteBase = () => String((hot && hot.updateUrl) || APP.updateUrl || '').replace(/\/?$/, '/');

  async function sha256(text) {
    if (!(window.crypto && crypto.subtle && crypto.subtle.digest)) return '';   /* 非安全上下文：跳过校验 */
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function fetchText(url) {
    const res = await fetch(url + (url.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status + '：' + url);
    return res.text();
  }

  /* ② 同步：只下与本地不同的文件，全部校验通过才落盘（半途失败不留坏数据） */
  async function sync(onProgress) {
    const base = remoteBase();
    if (!base) throw new Error('没有配置更新地址');
    if (navigator.onLine === false) throw new Error('当前离线');
    const manifest = JSON.parse(await fetchText(base + 'data/hotupdate.json'));
    const target = +manifest.build || 0;
    if (target <= localBuild()) return { state: 'latest', version: APP.version, build: localBuild() };

    const names = Object.keys(manifest.files || {});
    const files = {};
    let done = 0;
    for (const n of names) {
      const text = await fetchText(base + 'data/' + n);
      const want = manifest.files[n] && manifest.files[n].sha256;
      if (want) {
        const got = await sha256(text);
        if (got && got !== want) throw new Error('校验失败：' + n);
      }
      files[n] = text;
      done++;
      if (typeof onProgress === 'function') { try { onProgress(done, names.length, n); } catch (e) {} }
    }
    const pack = { version: manifest.version, build: target, date: manifest.date, updateUrl: base, files };
    try {
      localStorage.setItem(HOT_KEY, JSON.stringify(pack));
    } catch (e) {
      throw new Error('本机存储空间不足，请直接安装新版 APK');
    }
    return { state: 'synced', version: manifest.version, build: target };
  }

  window.KB_HOT = {
    env,
    enabled: env !== 'web',
    get builtBuild() { return localBuild(); },
    get appliedBuild() { return appliedBuild; },
    get appliedVersion() { return appliedBuild ? (APP.version || '') : ''; },
    /* 清掉已同步内容，回到内置版本（关于面板里给个退路） */
    reset() { clearHot(); return true; },
    sync
  };
})();
