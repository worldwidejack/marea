#!/usr/bin/env python3
"""Il foglio delle reference del PG da mandare nel gruppo: le figure scontornate dal magenta, numerate, su sabbia chiara.
uso: <python del venv di Fenaki> foglio.py <uscita.jpg> nome:etichetta …   (i PNG in fogli/ accanto a questo file)"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(QUI, '..', '..', 'tools', 'sprite'))
out, voci = sys.argv[1], [a.split(':', 1) for a in sys.argv[2:]]
sys.argv = sys.argv[:1]
import pixel_vero as pv  # noqa: E402

H, CW, COL = 560, 380, 4
righe = (len(voci) + COL - 1) // COL
T = Image.new('RGB', (CW * COL, (H + 60) * righe), (244, 227, 193))
d = ImageDraw.Draw(T)
f = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 30)
for i, (n, t) in enumerate(voci):
    p = n if os.path.exists(n) else os.path.join(QUI, 'fogli', n + '.png')
    rgb = np.array(Image.open(p).convert('RGB'))
    a = pv.alfa_magenta(rgb)
    ys, xs = np.where(a > 0.5)
    im = Image.fromarray(np.dstack([rgb, (a * 255).astype(np.uint8)])[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 'RGBA')
    s = min((H - 20) / im.size[1], (CW - 20) / im.size[0])
    im = im.resize((round(im.size[0] * s), round(im.size[1] * s)), Image.LANCZOS)
    x, y = (i % COL) * CW + (CW - im.size[0]) // 2, (i // COL) * (H + 60) + 10 + (H - 20 - im.size[1])
    T.paste(im, (x, y), im)
    d.text(((i % COL) * CW + 20, (i // COL) * (H + 60) + H + 5), t, fill=(46, 30, 20), font=f)
T.save(out, quality=90)
print(out, T.size)
