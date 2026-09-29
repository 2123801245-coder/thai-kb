/* tools/lib/iconlib.js —— PWA 图标/启动屏共用的纯 Node PNG 绘制与编码
   被 tools/gen-icons.js（应用图标）与 tools/gen-splash.js（安卓启动屏）复用。
   不依赖字体与第三方库；图案 = 紫蓝渐变底 + 泰国国旗（红·白·蓝·白·红 = 1:1:2:1:1）。 */
const zlib = require('zlib');

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

/* ── 颜色 ───────────────────────────────────────────── */
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

/* 画布：渐变底 + 可选圆角裁剪；内容区（国旗）另画 */
function renderIconRGBA(S, { maskable = false, opaque = false, center = null, centerW = null, centerH = null, centerRing = null } = {}) {
  const rgba = new Uint8Array(S * S * 4);
  /* 图标：国旗占 62% 宽（maskable 缩进安全区 44%）；splash 由调用方给 center 尺寸 */
  const flagW = centerW != null ? centerW : S * (maskable ? 0.44 : 0.62);
  const flagH = centerH != null ? centerH : flagW * 2 / 3;     /* 国旗 3:2 */
  const ring = centerRing != null ? centerRing : Math.max(2, flagW * 0.026);   /* 白边 */
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
  return { rgba, w: S, h: S };
}

module.exports = { encodePng, renderIconRGBA, RED, WHITE, BLUE, GRAD_TOP, GRAD_BOT };
