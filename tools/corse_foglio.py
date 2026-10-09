#!/usr/bin/env python3
# MAREA — foglio di confronto dei veicoli e dei piloti delle Corse: concept in alto, i modelli veri sotto (#178).
# Uso: python3 tools/corse_foglio.py <cartella anteprime> <out.jpg>
# Le anteprime sono quelle di build_all.py (cs_v_*.png e cs_p_*.png).
import os, sys
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
prev, out = sys.argv[1], sys.argv[2]
W, CELL = 1920, 320


def sezione(titolo, prefisso, concept):
    nomi = sorted(f for f in os.listdir(prev) if f.startswith(prefisso) and f.endswith('.png'))
    cols = W // CELL
    righe = (len(nomi) + cols - 1) // cols
    c = Image.open(os.path.join(ROOT, 'assets/concept/corse', concept)).convert('RGB')
    c = c.resize((W, int(c.height * W / c.width)))
    h = 40 + c.height + 40 + righe * (CELL + 24)
    im = Image.new('RGB', (W, h), (24, 22, 28))
    d = ImageDraw.Draw(im)
    d.text((12, 10), f'{titolo} — concept', fill=(255, 255, 255))
    im.paste(c, (0, 40))
    y0 = 40 + c.height
    d.text((12, y0 + 12), f'{titolo} — modelli in 3D ({len(nomi)})', fill=(255, 255, 255))
    for i, n in enumerate(nomi):
        x, y = (i % cols) * CELL, y0 + 40 + (i // cols) * (CELL + 24)
        t = Image.open(os.path.join(prev, n)).convert('RGB').resize((CELL, CELL))
        im.paste(t, (x, y))
        d.text((x + 6, y + CELL + 4), n[:-4], fill=(220, 220, 220))
    return im


a = sezione('Veicoli', 'cs_v_', 'corse_12_veicoli.jpg')
b = sezione('Piloti', 'cs_p_', 'corse_06_animali_piloti.jpg')
sheet = Image.new('RGB', (W, a.height + b.height), (24, 22, 28))
sheet.paste(a, (0, 0)); sheet.paste(b, (0, a.height))
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
sheet.save(out, quality=88)
print(out, sheet.size)
