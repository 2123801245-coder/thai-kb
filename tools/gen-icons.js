#!/usr/bin/env node
/* tools/gen-icons.js —— 生成 PWA 图标（纯 Node 内置模块，不依赖字体/图片库）
   图案：主题紫蓝渐变底 + 泰国国旗（红·白·蓝·白·红 = 1:1:2:1:1），泰语项目的辨识度最高。
   输出 icons/：icon-192、icon-512（圆角透明底）、icon-maskable-512（满底安全区）、apple-touch-icon（不透明 180）。
   用法：node tools/gen-icons.js   （图标改版时重跑即可，结果逐字节可复现） */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'icons');

/* ── PNG 编码：签名 + IHDR + IDAT + IEND ─────────────── */
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[n] = c >>> 0;
}
const crc32 = buf => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
function encodePng(w, h, rgba) {
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * stride + 1);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   /* 8bit / RGBA */
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ── 绘制 ───────────────────────────────────────────── */
const RED = [165, 25, 49];        /* 泰国国旗 official：#A51931 */
const WHITE = [255, 255, 255];
const BLUE = [45, 42, 74];        /* #2D2A4A */
const GRAD_TOP = [111, 116, 226]; /* 贴 --teal:#5b5fc7 的渐变 */
const GRAD_BOT = [91, 95, 199];

/* 圆角矩形 SDF：负值在内，正值在外（单位 px） */
const sdRoundRect = (px, py, hw, hh, r) => {
  const qx = Math.abs(px) - (hw - r), qy = Math.abs(py) - (hh - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};
/* 覆盖度：d 为 SDF，1px 抗锯齿过渡带 */
const cov = d => Math.min(1, Math.max(0, 0.5 - d));
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/* maskable：内容缩进到中央安全区（80% 圆内）；apple：满底不透明（iOS 忽略 alpha 自己切圆角） */
function renderIcon(size, { maskable = false, opaque = false } = {}) {
  const S = size;
  const rgba = new Uint8Array(S * S * 4);
  const flagW = S * (maskable ? 0.44 : 0.62);
  const flagH = flagW * 2 / 3;                 /* 国旗 3:2 */
  const ring = Math.max(2, S * 0.016);          /* 国旗外描白边，和紫底拉开对比 */
  const rIn = flagH * 0.10, rOut = rIn + ring;
  const corner = S * 0.20;                      /* 「any」图标自身圆角 */
  const cx = S / 2, cy = S / 2;

  for (let y = 0; y < S; y++) {
    const t = y / (S - 1);
    const bg = mix(GRAD_TOP, GRAD_BOT, t);
    for (let x = 0; x < S; x++) {
      const px = x + 0.5 - cx, py = y + 0.5 - cy;
      /* 背景 alpha：满底或圆角方块 */
      const bgA = opaque ? 1 : cov(sdRoundRect(px, py, S / 2, S / 2, corner));
      let r = bg[0], g = bg[1], b = bg[2];

      /* 国旗：外白边 + 内五条纹（1:1:2:1:1） */
      const dOut = sdRoundRect(px, py, (flagW + ring * 2) / 2, (flagH + ring * 2) / 2, rOut);
      const dIn = sdRoundRect(px, py, flagW / 2, flagH / 2, rIn);
      if (dOut < 0.5) {
        const outA = cov(dOut);
        const inA = cov(dIn);
        let flag = WHITE;                                    /* 默认落在白边上 */
        if (inA > 0) {                                        /* 条纹区 */
          const fy = (py + flagH / 2) / flagH;                /* 0=顶 1=底 */
          const stripe = fy < 1 / 6 ? RED : fy < 2 / 6 ? WHITE
            : fy < 4 / 6 ? BLUE : fy < 5 / 6 ? WHITE : RED;
          flag = inA >= 1 ? stripe : mix(WHITE, stripe, inA);
        }
        r = r + (flag[0] - r) * outA;
        g = g + (flag[1] - g) * outA;
        b = b + (flag[2] - b) * outA;
      }

      const i = (y * S + x) * 4;
      rgba[i] = Math.round(r); rgba[i + 1] = Math.round(g); rgba[i + 2] = Math.round(b);
      rgba[i + 3] = Math.round(bgA * 255);
    }
  }
  return encodePng(S, S, rgba);
}

/* ── 输出 ───────────────────────────────────────────── */
fs.mkdirSync(OUT, { recursive: true });
const files = [
  ['icon-192.png', renderIcon(192)],
  ['icon-512.png', renderIcon(512)],
  ['icon-maskable-512.png', renderIcon(512, { maskable: true, opaque: true })],
  ['apple-touch-icon.png', renderIcon(180, { opaque: true })]
];
for (const [name, buf] of files) {
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log('icons/' + name + '  ' + (buf.length / 1024).toFixed(1) + 'KB');
}
