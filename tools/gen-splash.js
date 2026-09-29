#!/usr/bin/env node
/* tools/gen-splash.js —— 生成安卓启动屏（Capacitor android/ 的 drawable-*）
   图案：紫蓝渐变底 + 居中泰国国旗（与 PWA 图标同一套，tools/lib/iconlib.js）。
   输出：drawable-land-*（横屏 6 档）+ drawable-port-*（竖屏 6 档）+ drawable/splash.png。
   用法：node tools/gen-splash.js   （在 tools/make-apk.js 里自动调用；也可单独跑） */
const fs = require('fs');
const path = require('path');
const { encodePng, renderIconRGBA } = require('./lib/iconlib');

const RES = path.join(__dirname, '..', 'apk', 'android', 'app', 'src', 'main', 'res');
if (!fs.existsSync(path.join(RES, 'values'))) {
  console.error('✗ 先跑 npx cap add android（找不到 ' + RES + '）');
  process.exit(1);
}

/* Capacitor 模板的横竖屏尺寸（density → 长边 px）；短边按屏幕比例给 */
const SIZES = {
  mdpi:    { land: [ 480,  320], port: [ 320,  480] },
  hdpi:    { land: [ 800,  480], port: [ 480,  800] },
  xhdpi:   { land: [1280,  720], port: [ 720, 1280] },
  xxhdpi:  { land: [1920, 1280], port: [1280, 1920] },
  xxxhdpi: { land: [2560, 1600], port: [1600, 2560] }
};

/* 在渐变底上画居中国旗（flagW = 短边的 34%，保证四周留白充足） */
function renderSplash(W, H) {
  const S = Math.min(W, H);
  const flagW = S * 0.34;
  const flagH = flagW * 2 / 3;
  return renderIconRGBA(S, { opaque: true, centerW: flagW, centerH: flagH, centerRing: Math.max(2, flagW * 0.02) });
}

/* 直接生成一张图：iconlib 的画布是正方形，这里整体生成后按目标尺寸放大居中
   （渐变底是纯线性渐变，任意尺寸直接重画更干净 —— 走 iconlib 的逐像素路径，尺寸由调用方定） */
function renderExact(W, H) {
  /* 简化：把 iconlib 当成「画正方形」的工具，这里手动把渐变底拉伸到 W×H、
     国旗按短边比例贴中央 —— 直接内联一份绘制（保持与图标同一套色值与几何）。 */
  const { RED, WHITE, BLUE, GRAD_TOP, GRAD_BOT } = require('./lib/iconlib');
  const sdRoundRect = (px, py, hw, hh, r) => {
    const qx = Math.abs(px) - (hw - r), qy = Math.abs(py) - (hh - r);
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  };
  const cov = d => Math.min(1, Math.max(0, 0.5 - d));
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  const rgba = new Uint8Array(W * H * 4);
  const S = Math.min(W, H);
  const flagW = S * 0.34, flagH = flagW * 2 / 3;
  const ring = Math.max(2, flagW * 0.02);
  const rIn = flagH * 0.10, rOut = rIn + ring;
  const cx = W / 2, cy = H / 2;
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1);
    const bg = mix(GRAD_TOP, GRAD_BOT, t);
    for (let x = 0; x < W; x++) {
      const px = x + 0.5 - cx, py = y + 0.5 - cy;
      let r = bg[0], g = bg[1], b = bg[2];
      const dOut = sdRoundRect(px, py, (flagW + ring * 2) / 2, (flagH + ring * 2) / 2, rOut);
      const dIn = sdRoundRect(px, py, flagW / 2, flagH / 2, rIn);
      if (dOut < 0.5) {
        const outA = cov(dOut), inA = cov(dIn);
        let flag = WHITE;
        if (inA > 0) {
          const fy = (py + flagH / 2) / flagH;
          const stripe = fy < 1 / 6 ? RED : fy < 2 / 6 ? WHITE : fy < 4 / 6 ? BLUE : fy < 5 / 6 ? WHITE : RED;
          flag = inA >= 1 ? stripe : mix(WHITE, stripe, inA);
        }
        r += (flag[0] - r) * outA; g += (flag[1] - g) * outA; b += (flag[2] - b) * outA;
      }
      const i = (y * W + x) * 4;
      rgba[i] = Math.round(r); rgba[i + 1] = Math.round(g); rgba[i + 2] = Math.round(b); rgba[i + 3] = 255;
    }
  }
  return encodePng(W, H, rgba);
}

let n = 0;
for (const [dpi, { land, port }] of Object.entries(SIZES)) {
  for (const [dir, [W, H]] of [['land', land], ['port', port]]) {
    const dirName = `drawable-${dir}-${dpi}`;
    fs.mkdirSync(path.join(RES, dirName), { recursive: true });
    const buf = renderExact(W, H);
    fs.writeFileSync(path.join(RES, dirName, 'splash.png'), buf);
    n++;
  }
}
/* 兜底默认（无密度限定） */
fs.mkdirSync(path.join(RES, 'drawable'), { recursive: true });
fs.writeFileSync(path.join(RES, 'drawable', 'splash.png'), renderExact(960, 640));
n++;
console.log(`✓ 启动屏 ${n} 张（land/port × 5 档密度 + 默认）`);
void SIZES; void renderSplash;
