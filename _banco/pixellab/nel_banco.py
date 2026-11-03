#!/usr/bin/env python3
"""Un personaggio scaricato da PixelLab (tools/sprite/pixellab.py scarica) → dati del banco dei pixel (3/11).

Le 5 direzioni disegnate (S, SE, E, NE, N: le altre 3 sono lo specchio) diventano <V>_fermo_1 (la rotazione) e
<V>_passo_N (i fotogrammi della camminata). Tutti i disegni si ritagliano sullo stesso riquadro (l'unione di tutti),
così i piedi restano sulla stessa linea. Il pannello «disegno» mostra lo sprite originale di PixelLab ingrandito.

uso: <python del venv di Fenaki> _banco/pixellab/nel_banco.py <cartella scaricata> <nome> ["nome da mostrare"]
"""
import json
import os
import shutil
import sys

import numpy as np
from PIL import Image

QUI = os.path.dirname(os.path.abspath(__file__))
DATI = os.path.join(QUI, '..', 'pixel_lab', 'dati')
VISTE = {'south': 'S', 'south-east': 'SE', 'east': 'E', 'north-east': 'NE', 'north': 'N'}

src, nome = sys.argv[1], sys.argv[2]
mostra = sys.argv[3] if len(sys.argv) > 3 else nome
disegni = {}
for d, v in VISTE.items():
    f = os.path.join(src, 'direzioni', d + '.png')
    if os.path.exists(f):
        disegni[f'{v}_fermo_1'] = Image.open(f).convert('RGBA')
    cart = os.path.join(src, 'animazioni', 'walking', d)
    if os.path.isdir(cart):
        for i, x in enumerate(sorted(os.listdir(cart))):
            disegni[f'{v}_passo_{i + 1}'] = Image.open(os.path.join(cart, x)).convert('RGBA')
# il riquadro comune: l'unione dei pixel pieni di tutti i disegni
m = np.zeros(next(iter(disegni.values())).size[::-1], bool)
for im in disegni.values():
    m |= np.array(im)[..., 3] > 0
ys, xs = np.where(m)
box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
base = os.path.join(DATI, nome)
shutil.rmtree(base, ignore_errors=True)
px, cod = os.path.join(base, 'px64'), os.path.join(base, 'codex')
os.makedirs(px)
os.makedirs(cod)
elenco = {}
for n, im in disegni.items():
    t = im.crop(box)
    t.save(os.path.join(px, n + '.png'))
    t.resize((t.size[0] * 8, t.size[1] * 8), Image.NEAREST).save(os.path.join(cod, n + '.png'))
    W, H = t.size
    elenco[n] = {'w': W, 'h': H, 'ax': W // 2, 'ay': H - 1, 'box': [0, 0, W, H]}
json.dump(elenco, open(os.path.join(px, 'elenco.json'), 'w'), indent=0)
f = os.path.join(DATI, 'indice.json')
indice = json.load(open(f))
indice[nome] = {'metodo': 'pixellab', 'gruppo': 'pixellab', 'nome': mostra, 'alti': {'64': elenco}}
json.dump(indice, open(f, 'w'), ensure_ascii=False)
alto = box[3] - box[1]
print(f'{nome}: {len(elenco)} disegni, riquadro {box[2] - box[0]}×{alto} px → {base}')
