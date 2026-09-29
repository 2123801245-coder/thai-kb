#!/usr/bin/env node
/* tools/gen-icons.js —— 生成 PWA 图标（纯 Node，不依赖字体/图片库）
   图案：主题紫蓝渐变底 + 泰国国旗；绘制与编码在 tools/lib/iconlib.js。
   输出 icons/：icon-192、icon-512（圆角透明底）、icon-maskable-512（满底安全区）、
   apple-touch-icon（不透明 180）。
   用法：node tools/gen-icons.js   （图标改版时重跑即可，结果逐字节可复现） */
const fs = require('fs');
const path = require('path');
const { encodePng, renderIconRGBA } = require('./lib/iconlib');

const OUT = path.join(__dirname, '..', 'icons');
fs.mkdirSync(OUT, { recursive: true });
const files = [
  ['icon-192.png', encodePng(...Object.values((() => { const r = renderIconRGBA(192); return { w: r.w, h: r.h, rgba: r.rgba }; })()))],
  ['icon-512.png', encodePng(...Object.values((() => { const r = renderIconRGBA(512); return { w: r.w, h: r.h, rgba: r.rgba }; })()))],
  ['icon-maskable-512.png', encodePng(...Object.values((() => { const r = renderIconRGBA(512, { maskable: true, opaque: true }); return { w: r.w, h: r.h, rgba: r.rgba }; })()))],
  ['apple-touch-icon.png', encodePng(...Object.values((() => { const r = renderIconRGBA(180, { opaque: true }); return { w: r.w, h: r.h, rgba: r.rgba }; })()))]
];
/* encodePng(w, h, rgba) —— 上面一行式太绕，直接重写清楚 */
function write(name, rgba, w, h) {
  const buf = encodePng(w, h, rgba);
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log('icons/' + name + '  ' + (buf.length / 1024).toFixed(1) + 'KB');
}
const a = renderIconRGBA(192);            write('icon-192.png', a.rgba, a.w, a.h);
const b = renderIconRGBA(512);            write('icon-512.png', b.rgba, b.w, b.h);
const c = renderIconRGBA(512, { maskable: true, opaque: true }); write('icon-maskable-512.png', c.rgba, c.w, c.h);
const d = renderIconRGBA(180, { opaque: true });                 write('apple-touch-icon.png', d.rgba, d.w, d.h);
void files;
