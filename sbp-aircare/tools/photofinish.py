#!/usr/bin/env python3
"""r17 photo finishing for assets/photos (A3–C3): crop to the manifest aspect, optional inpaint boxes (remove brand-like marks
on the units), then one shared grade so AI illustrations read as ordinary photographs: lifted blacks, soft highlight roll-off,
calmer colour, a little micro-contrast, light vignette and fine grain. Needs numpy + opencv-python-headless.
usage: python3 tools/photofinish.py SRC.png assets/photos/NAME.webp 4:3 1400 [--lift .9] [--warm .3] [--sat .9]
       [--xbias .5] [--ybias .4] [--inpaint x0,y0,x1,y1 (fractions of the source, repeatable)]"""
# Photographic finishing for the site's illustration photos: one grade for the whole set so it reads as one photographer
# (matte blacks, rolled-off highlights instead of glowing white walls, slightly calmer colour, a little micro-contrast,
# lens vignette and fine grain), then crop to the planned aspect ratio and save as webp.
# usage: finish.py src dst AR MAXW [--lift G] [--warm W] [--ybias B] [--inpaint x0,y0,x1,y1 (fractions)]
import sys, argparse, cv2, numpy as np
ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('dst'); ap.add_argument('ar'); ap.add_argument('maxw', type=int)
ap.add_argument('--lift', type=float, default=1.0)     # gamma < 1 brightens the mid-tones (dark interiors)
ap.add_argument('--warm', type=float, default=0.0)     # + warmer, − cooler (white balance nudge)
ap.add_argument('--ybias', type=float, default=0.4)    # where to crop vertically (0 top … 1 bottom)
ap.add_argument('--xbias', type=float, default=0.5)
ap.add_argument('--inpaint', action='append', default=[])
ap.add_argument('--sat', type=float, default=0.93)
a = ap.parse_args()
im = cv2.imread(a.src, cv2.IMREAD_COLOR)
H, W = im.shape[:2]
for box in a.inpaint:   # remove a small distracting detail (e.g. debris), filled from its surroundings
    x0, y0, x1, y1 = (float(v) for v in box.split(','))
    m = np.zeros((H, W), np.uint8); cv2.rectangle(m, (int(x0 * W), int(y0 * H)), (int(x1 * W), int(y1 * H)), 255, -1)
    im = cv2.inpaint(im, m, 9, cv2.INPAINT_TELEA)
p, q = (int(v) for v in a.ar.split(':')); want = p / q
if W / H > want: nw = round(H * want); x = round((W - nw) * a.xbias); im = im[:, x:x + nw]
else: nh = round(W / want); y = round((H - nh) * a.ybias); im = im[y:y + nh]
if im.shape[1] > a.maxw: im = cv2.resize(im, (a.maxw, round(a.maxw * im.shape[0] / im.shape[1])), interpolation=cv2.INTER_AREA)
f = im.astype(np.float32) / 255.0
if a.lift != 1.0: f = np.power(f, a.lift)
# tone curve: matte shadow floor, gentle S in the mids, highlights rolled off below pure white
xs = np.array([0, .10, .25, .50, .75, .90, 1.0]); ys = np.array([.022, .105, .245, .50, .755, .875, .955])
f = np.interp(f, xs, ys).astype(np.float32)
# colour: calmer saturation + white balance nudge in Lab
lab = cv2.cvtColor(f, cv2.COLOR_BGR2LAB)
lab[..., 1] *= a.sat; lab[..., 2] = lab[..., 2] * a.sat + a.warm * 4.0
f = np.clip(cv2.cvtColor(lab, cv2.COLOR_LAB2BGR), 0, 1)
# micro-contrast (large-radius unsharp) — AI images are too smooth
blur = cv2.GaussianBlur(f, (0, 0), 12)
f = np.clip(f + 0.18 * (f - blur), 0, 1)
# lens vignette
h, w = f.shape[:2]; yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
r2 = ((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2
f *= (1 - 0.10 * np.clip(r2, 0, 2))[..., None]
# fine luminance grain (slightly soft, like a real sensor at ISO 400–800)
rng = np.random.default_rng(7); g = rng.normal(0, 0.016, (h, w)).astype(np.float32)
g = cv2.GaussianBlur(g, (0, 0), 0.6)
f = np.clip(f + g[..., None], 0, 1)
out = (f * 255 + 0.5).astype(np.uint8)
cv2.imwrite(a.dst, out, [cv2.IMWRITE_WEBP_QUALITY, 82])
import os; print(os.path.basename(a.dst), out.shape[1], 'x', out.shape[0], os.path.getsize(a.dst) // 1024, 'KB')
