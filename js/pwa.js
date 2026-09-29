/* js/pwa.js —— 注册 Service Worker，让知识库离线也能打开（PWA 的前端一半）
   只在 http(s) 下注册：双击 HTML 的 file:// 没有 Service Worker，注册会直接抛异常。
   注册失败一律静默 —— PWA 是增强，不该影响页面本身。 */
(function () {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
  window.addEventListener('load', function () {
    try {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    } catch (e) { /* 静默 */ }
  });
})();
