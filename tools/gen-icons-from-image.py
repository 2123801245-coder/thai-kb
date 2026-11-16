#!/usr/bin/env python3
"""tools/gen-icons-from-image.py — 用一张方图生成全套图标（PWA + Android）。

源图：tools/icon-source.png（圆角方形插画，外圈是白底+投影）。
输出：
  icons/icon-192.png、icon-512.png            透明圆角（PWA any）
  icons/icon-maskable-512.png                 满底深绿 + 图案缩到 84%（安全区）
  icons/apple-touch-icon.png                  不透明 180（iOS 自己切圆角）
  apk/android/app/src/main/res/mipmap-*/…     legacy / round / adaptive foreground
  apk/android/app/src/main/res/values/ic_launcher_background.xml  ← 底色同步
用法：python3 tools/gen-icons-from-image.py
"""
import os
import re

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'icon-source.png')
ICONS = os.path.join(ROOT, 'icons')
RES = os.path.join(ROOT, 'apk', 'android', 'app', 'src', 'main', 'res')

SRC_BOX = (66, 75, 1189, 1198)   # 去掉外圈白边与投影后的正方形
RADIUS_RATIO = 0.232            # 圆角方形常用比例
CORNER_BAND = 0.27               # 角落白边清理半径（占边长）


def clean_edges(im):
    """把四个角上残留的白底/投影替换成图案底色。"""
    a = np.asarray(im.convert('RGB')).astype(np.int16)
    h, w, _ = a.shape
    nw = (a.min(axis=2) > 224)
    yy, xx = np.mgrid[0:h, 0:w]
    band = (np.minimum(xx, w - 1 - xx) < w * 0.05) | (np.minimum(yy, h - 1 - yy) < h * 0.05)
    corners = np.zeros((h, w), bool)
    for cy, cx in ((0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1)):
        corners |= ((yy - cy) ** 2 + (xx - cx) ** 2) < (min(h, w) * CORNER_BAND) ** 2
    fill = nw & band & corners
    rgb = a.reshape(-1, 3)
    dark_green = rgb[(rgb[:, 1] > rgb[:, 0] + 6) & (rgb[:, 1] > rgb[:, 2] + 2) & (rgb[:, 1] < 130)]
    if len(dark_green) > 500:
        q = (dark_green // 8 * 8)
        uniq, cnt = np.unique(q, axis=0, return_counts=True)
        bg = tuple(int(v) for v in uniq[cnt.argmax()])
    else:
        edge = a[h // 2, :8].tolist() + a[h // 2, -8:].tolist()
        bg = tuple(int(v) for v in np.median(np.array(edge), axis=0))
    a[fill] = bg
    return Image.fromarray(a.astype(np.uint8)), bg


def rounded(im, size=None, radius_ratio=RADIUS_RATIO):
    if size and im.size != (size, size):
        im = im.resize((size, size), Image.LANCZOS)
    w = im.size[0]
    ss = 4
    mask = Image.new('L', (w * ss, w * ss), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, w * ss - 1, w * ss - 1), radius=int(w * ss * radius_ratio), fill=255)
    mask = mask.resize((w, w), Image.LANCZOS)
    out = im.convert('RGBA')
    out.putalpha(mask)
    return out


def circled(im, size):
    im = im.resize((size, size), Image.LANCZOS)
    ss = 4
    mask = Image.new('L', (size * ss, size * ss), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * ss - 1, size * ss - 1), fill=255)
    mask = mask.resize((size, size), Image.LANCZOS)
    out = im.convert('RGBA')
    out.putalpha(mask)
    return out


def main():
    src = Image.open(SRC).convert('RGB').crop(SRC_BOX)
    src, bg = clean_edges(src)
    print('底色', '#%02X%02X%02X' % bg)

    os.makedirs(ICONS, exist_ok=True)
    rounded(src, 512).save(os.path.join(ICONS, 'icon-512.png'))
    rounded(src, 192).save(os.path.join(ICONS, 'icon-192.png'))

    inner = rounded(src, int(512 * 0.84))
    canvas = Image.new('RGB', (512, 512), bg)
    off = (512 - inner.size[0]) // 2
    canvas.paste(inner, (off, off), inner)
    canvas.save(os.path.join(ICONS, 'icon-maskable-512.png'))

    rounded(src, 180).save(os.path.join(ICONS, 'apple-touch-icon.png'))
    print('icons/ 写好')

    legacy = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
    fg = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
    for dpi, px in legacy.items():
        d = os.path.join(RES, 'mipmap-' + dpi)
        if not os.path.isdir(d):
            continue
        rounded(src, px).save(os.path.join(d, 'ic_launcher.png'))
        circled(src, px).save(os.path.join(d, 'ic_launcher_round.png'))
        f = fg[dpi]
        face = rounded(src, int(f * 72 / 108))
        c = Image.new('RGBA', (f, f), (0, 0, 0, 0))
        o = (f - face.size[0]) // 2
        c.paste(face, (o, o), face)
        c.save(os.path.join(d, 'ic_launcher_foreground.png'))
    print('android mipmap 写好')

    p = os.path.join(RES, 'values', 'ic_launcher_background.xml')
    if os.path.exists(p):
        with open(p, encoding='utf-8') as f:
            s = f.read()
        s = re.sub(r'(<color name="ic_launcher_background">)#[0-9A-Fa-f]{6,8}',
                   r'\g<1>#%02X%02X%02X' % bg, s)
        with open(p, 'w', encoding='utf-8') as f:
            f.write(s)
        print('ic_launcher_background →', '#%02X%02X%02X' % bg)

    make_splash(src, bg)




# ── 启动屏（Capacitor drawable 各密度）──
SPLASH = {
    'mdpi':   {'land': (480, 320),   'port': (320, 480)},
    'hdpi':   {'land': (800, 480),   'port': (480, 800)},
    'xhdpi':  {'land': (1280, 720),  'port': (720, 1280)},
    'xxhdpi': {'land': (1920, 1280), 'port': (1280, 1920)},
    'xxxhdpi': {'land': (2560, 1600), 'port': (1600, 2560)},
}


def make_splash(src, bg):
    for dpi, sizes in SPLASH.items():
        for orient, (w, h) in sizes.items():
            d = os.path.join(RES, 'drawable-%s-%s' % (orient, dpi))
            if not os.path.isdir(d):
                continue
            side = int(min(w, h) * 0.34)
            face = rounded(src, side)
            canvas = Image.new('RGB', (w, h), bg)
            canvas.paste(face, ((w - side) // 2, (h - side) // 2), face)
            canvas.save(os.path.join(d, 'splash.png'))
    d = os.path.join(RES, 'drawable')
    if os.path.isdir(d):
        side = 220
        face = rounded(src, side)
        canvas = Image.new('RGB', (480, 800), bg)
        canvas.paste(face, ((480 - side) // 2, (800 - side) // 2), face)
        canvas.save(os.path.join(d, 'splash.png'))
    print('splash 写好')


if __name__ == '__main__':
    main()
