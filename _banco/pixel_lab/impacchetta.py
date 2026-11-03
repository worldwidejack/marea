#!/usr/bin/env python3
"""Banco dei pixel online: impacchetta dati/ in pochi fogli per la pagina pubblicata (online/).

Per ogni personaggio: px64.png, px96.png (gli sprite, a pixel netti) e codex.webp (i ritagli di Codex), ognuno un foglio
a righe; online/dati.json dice dove sta ogni disegno (x, y, w, h nel foglio) più le misure dello sprite; gli sfondi del
Borgo vanno così come sono. Poi si pubblica online/banco.html con i file di online/.

uso: <python del venv di Fenaki> _banco/pixel_lab/impacchetta.py
"""
import json
import os
import shutil

from PIL import Image

QUI = os.path.dirname(os.path.abspath(__file__))
DATI, OUT = os.path.join(QUI, 'dati'), os.path.join(QUI, 'online')
LARGO = 2400  # larghezza massima di un foglio, px


def foglio(nomi, cartella, uscita, fmt):
    """I PNG di cartella in righe da LARGO px → il foglio e {nome: [x, y, w, h]}."""
    ims = {n: Image.open(os.path.join(cartella, n + '.png')).convert('RGBA') for n in nomi}
    pos, x, y, riga = {}, 0, 0, 0
    for n in nomi:
        w, h = ims[n].size
        if x + w > LARGO:
            x, y, riga = 0, y + riga + 2, 0
        pos[n] = [x, y, w, h]
        x += w + 2
        riga = max(riga, h)
    tela = Image.new('RGBA', (LARGO, y + riga))
    for n, (a, b, _, _) in pos.items():
        tela.paste(ims[n], (a, b))
    if fmt == 'webp':
        tela.save(uscita, 'WEBP', quality=90, method=6)
    else:
        tela.save(uscita, 'PNG', optimize=True)
    return pos


# via i fogli vecchi, non la pagina (banco.html si scrive a mano)
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    if f != 'banco.html':
        os.remove(os.path.join(OUT, f))
indice = json.load(open(os.path.join(DATI, 'indice.json')))
dati = {'personaggi': {}, 'sfondi': {}}
# prima le opzioni nuove (gruppo «opzioni», 3/11), poi i personaggi dell'Atelier
ORDINE = {'pixellab': 0, 'opzioni': 1}  # prima PixelLab, poi le opzioni del 3/11, poi l'Atelier
for p, v in sorted(indice.items(), key=lambda pv: ORDINE.get(pv[1].get('gruppo'), 2)):
    d = {'alti': {}, 'gruppo': v.get('gruppo', 'atelier'), 'nome': v.get('nome', p)}
    nomi = list(next(iter(v['alti'].values())).keys())
    d['codex'] = foglio(nomi, os.path.join(DATI, p, 'codex'), os.path.join(OUT, f'{p}_codex.webp'), 'webp')
    for alto, el in v['alti'].items():
        pos = foglio(nomi, os.path.join(DATI, p, f'px{alto}'), os.path.join(OUT, f'{p}_px{alto}.png'), 'png')
        d['alti'][alto] = {n: {'r': pos[n], 'ax': e['ax'], 'ay': e['ay'], 'box': e['box']} for n, e in el.items()}
    dati['personaggi'][p] = d
for alto in ('64', '96'):
    shutil.copy(os.path.join(QUI, f'sfondo{alto}.png'), os.path.join(OUT, f'sfondo{alto}.png'))
    dati['sfondi'][alto] = json.load(open(os.path.join(QUI, f'sfondo{alto}.json')))
json.dump(dati, open(os.path.join(OUT, 'dati.json'), 'w'), separators=(',', ':'))
tot = 0
for f in sorted(os.listdir(OUT)):
    s = os.path.getsize(os.path.join(OUT, f)); tot += s
    print(f'{f:28s} {s / 1e6:5.2f} MB')
print(f'in tutto {tot / 1e6:.1f} MB, {len(os.listdir(OUT))} file')
