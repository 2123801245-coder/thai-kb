/* js/books.js —— 📚 课外阅读：books/ 里的泰文原版书
   点击卡片直接在浏览器新标签打开 PDF（GitHub Pages / 本地 HTTP / 双击 file:// 都能看）。
   APK 套壳里 WebView 无法弹外部浏览器窗口（未装 Browser 插件），
   提示去「关于」面板点「⬇️ 下载新版 APK」升级后阅读。 */
(function () {
  function openBook(file) {
    var isApk = /Capacitor/.test(navigator.userAgent || '');
    if (isApk) {
      if (confirm('📚《四朝代》原文 PDF 在手机 App 里暂不支持内置阅读。\n\n可以：\n1. 点「关于」面板里的「⬇️ 下载新版 APK」升级后阅读\n2. 用电脑/手机浏览器打开网页版阅读\n\n现在打开「关于」面板吗？')) {
        var ab = document.getElementById('aboutBtn');
        if (ab) ab.click();
      }
      return;
    }
    window.open(file, '_blank', 'noopener');
  }

  function init() {
    var b = document.getElementById('bookSiphaendin');
    if (b) b.onclick = function () { openBook('books/สี่แผ่นดิน.pdf'); };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
