/* sw.js —— PWA 的 Service Worker：离线可用的缓存策略
   只碰同源 GET；跨域（Google TTS 在线兜底）一律放行。
   规则：
     · 页面导航、js/、data/*.js（voice-lessons 除外）：网络优先，断网回退缓存
       —— 本机改完数据刷新即见（不给缓存挡新数据），断网照样能开
     · index.html：纯跳转页不缓存，导航请求落到主页
     · data/voice-lessons.js（47MB，进课文才按需下载）：缓存优先
       —— 一次下载后进课文不再重复拉
     · media/ 视频：整档缓存 + 本地分片（videoHandler）
       —— <video> 发的是 Range 请求，Cache API 没法直接存 206；
          第一次看某个视频时下载完整文件进缓存（头几个字节要等整档下完，
          196MB 的最大的那部会等一会儿），之后断网也能看，倍速/拖动不卡；
          已缓存时把 Range 请求在本地切成 206 响应，支持任意拖动。
   发大版本时把 CACHE 版本号 +1，旧缓存会在 activate 时整批作废。 */
const CACHE = 'kb-pwa-v2';
const SHELL = ['./', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
const IMMUTABLE = /\/data\/voice-lessons\.js$/;
const MEDIA = /\/media\//;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    /* 逐个抓，单个 404 不拖垮安装 */
    await Promise.all(SHELL.map(u => cache.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) return hit;
    if (request.mode === 'navigate') {
      const shell = await cache.match('./');   /* 断网兜底：回到缓存的主页 */
      if (shell) return shell;
    }
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res && res.ok) cache.put(request, res.clone()).catch(() => {});
  return res;
}

/* media/ 视频：整档缓存 + 本地 Range 分片。
   同一时刻浏览器会对同一个视频并发发好几个 Range 请求，去重整档下载。 */
const inflight = new Map();
function fetchFull(url, cache) {
  if (inflight.has(url)) return inflight.get(url);
  const p = (async () => {
    const res = await fetch(url);              /* 不带 Range → 完整 200 */
    if (res && res.ok) await cache.put(url, res.clone()).catch(() => {});
    return res;
  })().finally(() => inflight.delete(url));
  inflight.set(url, p);
  return p;
}
async function videoHandler(request) {
  const cache = await caches.open(CACHE);
  let hit = await cache.match(request.url);
  if (!hit) hit = await fetchFull(request.url, cache);
  if (!hit || !hit.ok) throw new Error('media fetch failed');
  const range = request.headers.get('range');
  if (!range || hit.status !== 200) return hit;
  /* cache.match 每次返回独立副本，直接消费不影响缓存本体，不用 clone */
  const buf = await hit.arrayBuffer();
  const m = /bytes=(\d+)-(\d*)/.exec(range) || [];
  const start = Number(m[1] || 0);
  if (start >= buf.byteLength) {
    return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + buf.byteLength } });
  }
  const end = Math.min(m[2] ? Number(m[2]) : buf.byteLength - 1, buf.byteLength - 1);
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': hit.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Range': 'bytes ' + start + '-' + end + '/' + buf.byteLength,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes'
    }
  });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.headers.has('range') && !MEDIA.test(url.pathname)) return;  /* 视频 Range 由 videoHandler 接，其他放行 */
  if (url.pathname.endsWith('/index.html')) return;                        /* 跳转页不进 SW */
  if (MEDIA.test(url.pathname)) return event.respondWith(videoHandler(request));
  event.respondWith(IMMUTABLE.test(url.pathname) ? cacheFirst(request) : networkFirst(request));
});
