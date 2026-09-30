/* js/books.js —— 📚 课外阅读：books/ 里的泰文原版书
   网页 / 离线包 / file://：直接新标签打开 PDF（浏览器自带阅读器）。
   APK 套壳：WebView 弹不了外部窗口、PDF 也无内置查看器 → 跳应用内阅读器
   books/viewer.html（PDF.js legacy 渲染，翻页/缩放/页码）。 */
(function () {
  function isApk() { return /Capacitor/.test(navigator.userAgent || ''); }

  function openBook(file) {
    if (isApk()) {
      /* 应用内阅读器：同源页面导航，Capacitor WebView 可以直接打开 */
      location.href = 'books/viewer.html?f=' + encodeURIComponent(file);
      return;
    }
    window.open(file, '_blank', 'noopener');
  }

  function init() {
    var b = document.getElementById('bookSiphaendin');
    if (b) b.onclick = function () { openBook('สี่แผ่นดิน.pdf'); };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
