/* js/books.js —— 📚 课外阅读：books/ 里的原著与译本
   网页 / 离线包 / file://：直接新标签打开 PDF（浏览器自带阅读器）。
   APK 套壳：WebView 弹不了外部窗口、PDF 也无内置查看器 → 跳应用内阅读器
   books/viewer.html（PDF.js legacy 渲染，翻页/缩放/页码）。

   卡片是静态 HTML（#booksBox 里的 [data-book]，分泰文原版 / 中译本 / 研究著作三组），
   这里只负责把点击接到对应 PDF 上；加新书＝在骨架里加一张卡，不用改本文件。 */
(function () {
  function isApk() { return /Capacitor/.test(navigator.userAgent || ''); }

  function openBook(file, title) {
    if (isApk()) {
      /* 应用内阅读器：同源页面导航，Capacitor WebView 可以直接打开 */
      location.href = 'books/viewer.html?f=' + encodeURIComponent(file)
        + (title ? '&t=' + encodeURIComponent(title) : '');
      return;
    }
    window.open('books/' + file, '_blank', 'noopener');
  }

  function init() {
    var cards = document.querySelectorAll('#booksBox [data-book]');
    Array.prototype.forEach.call(cards, function (card) {
      card.addEventListener('click', function () {
        openBook(card.getAttribute('data-book'), card.getAttribute('data-title') || '');
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
