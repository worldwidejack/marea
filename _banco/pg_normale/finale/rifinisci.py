#!/usr/bin/env python3
"""Rifinitura del PG vincitore dopo edit-image-pixen: camicia coi colori del Lino, contorno scuro come il resto
del personaggio, orlo accorciato (i jeans tornano quelli dello sprite votato). Uso: rifinisci.py <da.png> <a.png>"""
import sys
from PIL import Image
import numpy as np

da, a = sys.argv[1], sys.argv[2]
b = np.array(Image.open(da).convert('RGBA')).astype(int)
orig = np.array(Image.open('../voto/n_maglietta_jeans.png').convert('RGBA')).astype(int)
ORLO = 43  # ultima riga di camicia: una sotto l'orlo della maglietta votata


def camicia(p):
    r, g, bl = p[:3]
    return p[3] > 0 and min(r, g, bl) > 110 and max(r, g, bl) - min(r, g, bl) < 62 and r >= bl


# rampa del Lino, dal chiaro allo scuro
RAMPA = [(225, (0xe9, 0xdb, 0xc2)), (175, (0xc4, 0xa9, 0x7e)), (150, (0xb4, 0x95, 0x6d)), (0, (0x9f, 0x7d, 0x5b))]
out = b.copy()
mask = np.zeros((64, 64), bool)
for y in range(28, 50):
    for x in range(18, 46):
        if camicia(b[y, x]):
            mask[y, x] = True
# sotto l'orlo: jeans dello sprite votato
for y in range(ORLO + 1, 50):
    for x in range(24, 39):
        if mask[y, x] or (b[y, x, 3] > 0 and y <= 47):
            out[y, x] = orig[y, x]
            mask[y, x] = False
for y, x in zip(*np.where(mask)):
    lum = int(b[y, x, :3].mean())
    out[y, x, :3] = next(c for s, c in RAMPA if lum >= s)
    out[y, x, 3] = 255
# pancia pulita: via le pieghe a macchia (pochi dettagli)
for y in range(37, ORLO):
    for x in range(27, 36):
        if mask[y, x]:
            out[y, x, :3] = (0xe9, 0xdb, 0xc2)
# ombra dell'orlo
for x in range(64):
    if mask[ORLO, x]:
        out[ORLO, x, :3] = (0xc4, 0xa9, 0x7e)
# contorno: i pixel di camicia che toccano il vuoto diventano scuri
vuoto = out[:, :, 3] == 0
for y, x in zip(*np.where(mask)):
    if vuoto[y - 1:y + 2, x - 1:x + 2].any():
        out[y, x, :3] = (0x1e, 0x14, 0x14)
Image.fromarray(out.astype('uint8')).save(a)
print('camicia', int(mask.sum()), 'pixel; contorno', sum(1 for y, x in zip(*np.where(mask)) if (out[y, x, :3] == (0x1e, 0x14, 0x14)).all()))
