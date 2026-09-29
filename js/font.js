/* js/font.js —— 泰文字体切换（Sarabun / Noto Sans / Noto Serif 衬线 / 系统）+ 字号档位
   偏好存 localStorage('kbThaiFont') / ('kbThaiSize')；默认 system / m。
   按钮挂在页头版本徽标旁：「🅰」→ 点开小面板选字体与字号。
   切到任一内嵌字体时才动态加载 css/fonts.css（默认系统字体零开销）。 */
(function () {
  const FKEY = 'kbThaiFont', SKEY = 'kbThaiSize';
  const FONTS = [
    ['sarabun',   'Sarabun（课本感）'],
    ['notosans',  'Noto Sans（锐利）'],
    ['notoserif', '衬线（印刷风）'],
    ['system',    '系统默认']
  ];
  const SIZES = [['s', '小'], ['m', '中'], ['l', '大'], ['xl', '特大']];

  function get(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function ensureCss() {
    if (document.getElementById('thaiFontCss')) return;
    const l = document.createElement('link');
    l.id = 'thaiFontCss'; l.rel = 'stylesheet'; l.href = 'css/fonts.css';
    document.head.appendChild(l);
  }
  function fontLabel(f) { const x = FONTS.find(y => y[0] === f); return x ? x[1].replace(/（.*）/, '') : '系统'; }
  function apply() {
    const f = get(FKEY, 'system'), s = get(SKEY, 'm');
    if (f !== 'system') { ensureCss(); }
    document.documentElement.setAttribute('data-thai-font', f);
    document.documentElement.setAttribute('data-thai-size', s);
    const btn = document.getElementById('fontBtn');
    if (btn) btn.textContent = '🅰 ' + fontLabel(f) + ' · ' + (SIZES.find(x => x[0] === s) || SIZES[1])[1];
  }

  function panel() {
    const old = document.getElementById('fontMask');
    if (old) { old.remove(); return; }
    const f = get(FKEY, 'system'), s = get(SKEY, 'm');
    const mask = document.createElement('div');
    mask.id = 'fontMask';
    mask.style.cssText = 'position:fixed;inset:0;background:rgba(20,22,40,.45);z-index:99;display:grid;place-items:center;padding:20px;';
    const opt = (val, cur, label, sample) =>
      '<button data-v="' + val + '" style="border:1px solid ' + (val === cur ? 'var(--teal,#5b5fc7)' : 'var(--line,#dfe1ef)') +
      ';background:' + (val === cur ? 'var(--teal-soft,#eceefc)' : '#fff') + ';color:' + (val === cur ? 'var(--teal,#5b5fc7)' : 'var(--ink,#232633)') +
      ';border-radius:12px;padding:10px 12px;font-size:13px;cursor:pointer;font-weight:600;text-align:left;width:100%">' +
      '<span style="' + (sample ? 'font-family:\'' + sample + '\';font-size:17px' : '') + '">ปลูก ขึ้น สวัสดี</span><br>' +
      '<span style="font-weight:500;font-size:12px">' + label + '</span></button>';
    mask.innerHTML =
      '<div style="background:var(--card,#fff);border-radius:16px;max-width:380px;width:100%;padding:18px 16px;box-shadow:0 12px 40px rgba(0,0,0,.25);max-height:86vh;overflow:auto">' +
      '<div style="font-weight:700;font-size:15px;margin-bottom:10px">🅰 泰文字体 <span style="font-weight:500;font-size:12px;color:var(--muted,#7d8291)">（示例字样即预览）</span></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">' +
      opt('sarabun', f, FONTS[0][1], 'Sarabun Thai') +
      opt('notosans', f, FONTS[1][1], 'Noto Sans Thai KB') +
      opt('notoserif', f, FONTS[2][1], 'Noto Serif Thai KB') +
      opt('system', f, FONTS[3][1], '') + '</div>' +
      '<div style="font-weight:700;font-size:15px;margin-bottom:10px">字号</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' + SIZES.map(x => opt(x[0], s, x[1], '')).join('') + '</div>' +
      '<div style="margin-top:12px;font-size:12px;color:var(--muted,#7d8291);line-height:1.7">选择会自动保存在本机；换设备需要重新选。首次选择某字体时才下载（各约 30KB）。</div>' +
      '<button id="fontClose" style="display:block;width:100%;margin-top:14px;border:none;background:var(--teal,#5b5fc7);color:#fff;border-radius:10px;padding:9px;font-size:13px;cursor:pointer">完成</button>' +
      '</div>';
    mask.addEventListener('click', e => { if (e.target === mask) mask.remove(); });
    document.body.appendChild(mask);
    /* 字体按钮的预览需要字体文件：先把 css 拉进来再开面板，示例字样才准 */
    if (!document.getElementById('thaiFontCss')) ensureCss();
    mask.querySelectorAll('button[data-v]').forEach(b => {
      b.onclick = () => {
        const v = b.dataset.v;
        if (SIZES.some(x => x[0] === v)) set(SKEY, v); else set(FKEY, v);
        apply();
        /* 刷新本面板所有按钮的选中态 */
        mask.querySelectorAll('button[data-v]').forEach(x => {
          const curVal = SIZES.some(z => z[0] === x.dataset.v) ? get(SKEY, 'm') : get(FKEY, 'system');
          const on = x.dataset.v === curVal;
          x.style.borderColor = on ? 'var(--teal,#5b5fc7)' : 'var(--line,#dfe1ef)';
          x.style.background = on ? 'var(--teal-soft,#eceefc)' : '#fff';
          x.style.color = on ? 'var(--teal,#5b5fc7)' : 'var(--ink,#232633)';
        });
      };
    });
    document.getElementById('fontClose').onclick = () => mask.remove();
  }

  function init() {
    const anchor = document.getElementById('aboutBtn');
    if (!anchor) return;
    const b = document.createElement('button');
    b.id = 'fontBtn';
    b.title = '泰文字体与字号';
    b.style.cssText = anchor.style.cssText.replace('float:right', 'float:right;margin-right:6px');
    b.onclick = panel;
    anchor.parentNode.insertBefore(b, anchor);
    apply();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.KB_FONT = { apply: apply, FONTS: FONTS };
})();
