#!/usr/bin/env python3
"""Le reference del PG (fogli/<nome>.png, una figura da davanti su magenta) → dati del banco dei pixel (3/11).

Ogni figura scontornata dal magenta, ritagliata e portata a 480 px d'altezza in pixel_lab/dati/reference/<nome>.png;
pixel_lab/dati/reference.json dà l'ordine e il nome da mostrare. Poi impacchetta.py le mette in online/reference.webp.

uso: <python del venv di Fenaki> _banco/reference_pg/nel_banco.py
"""
import json
import os
import shutil
import sys

import numpy as np
from PIL import Image

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(QUI, '..', '..', 'tools', 'sprite'))
sys.argv = sys.argv[:1]
import pixel_vero as pv  # noqa: E402

DATI = os.path.join(QUI, '..', 'pixel_lab', 'dati')
NOMI = {'quest1': 'quest 1 (di Riccardo)', 'f3': 'F3', 'bussola': 'la bussola', 'surfista': 'il surfista', 'fionda': 'la fionda',
        'meccanico': 'il meccanico', 'maglione': 'il maglione', 'postina': 'la postina'}
ALTO = 480

out = os.path.join(DATI, 'reference')
shutil.rmtree(out, ignore_errors=True)
os.makedirs(out)
elenco = {}
for n, mostra in NOMI.items():
    f = os.path.join(QUI, 'fogli', n + '.png')
    if not os.path.exists(f):
        continue
    rgb = np.array(Image.open(f).convert('RGB'))
    a = pv.alfa_magenta(rgb)
    ys, xs = np.where(a > 0.5)
    rgba = np.dstack([rgb, (a * 255).astype(np.uint8)])[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    im = Image.fromarray(rgba, 'RGBA')
    im.resize((round(im.size[0] * ALTO / im.size[1]), ALTO), Image.LANCZOS).save(os.path.join(out, n + '.png'))
    elenco[n] = {'nome': mostra}
json.dump(elenco, open(os.path.join(DATI, 'reference.json'), 'w'), ensure_ascii=False)
print(f'{len(elenco)} reference → {out}')
