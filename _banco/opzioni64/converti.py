#!/usr/bin/env python3
"""Opzioni del protagonista pensate per 64 px (3/11): dai fogli di Codex (una riga di 5 figure su magenta, vista SE:
1 in piedi + 4 della camminata) agli sprite a 64 px col metodo hd di tools/sprite/pixel_vero.py, nel formato del banco
dei pixel (_banco/pixel_lab/dati/<opzione>/px64 e codex, più la voce in dati/indice.json con gruppo «opzioni»).

Le figure si trovano per macchie (non a celle fisse: Codex non le mette a distanze uguali), da sinistra a destra.
La figura 1 (in piedi) è il metro: lei è alta 64, le altre in proporzione; i piedi stanno sulla stessa linea di terra.

uso: <python del venv di Fenaki> _banco/opzioni64/converti.py [opzione …] [--alto 64] [--colori 20]
"""
import json
import os
import shutil
import sys

import cv2
import numpy as np
from PIL import Image

QUI = os.path.dirname(os.path.abspath(__file__))
WT = os.path.abspath(os.path.join(QUI, '..', '..'))
sys.path.insert(0, os.path.join(WT, 'tools', 'sprite'))
ARGV = sys.argv[1:]
import pixel_vero as pv  # noqa: E402

DATI = os.path.join(WT, '_banco', 'pixel_lab', 'dati')
ALTO = int(ARGV[ARGV.index('--alto') + 1]) if '--alto' in ARGV else 64
K = int(ARGV[ARGV.index('--colori') + 1]) if '--colori' in ARGV else 20
NOMI_MOSSE = ['SE_fermo_1', 'SE_passo_1', 'SE_passo_2', 'SE_passo_3', 'SE_passo_4']
NOMI = {'mozzo': 'il mozzo', 'pescatrice': 'la pescatrice', 'guardiano': 'il guardiano del faro', 'tuffatrice': 'la tuffatrice',
        'cuoco': 'il cuoco', 'sciarpa': 'il viaggiatore', 'esploratrice': "l'esploratrice", 'capitana': 'la capitana'}


def figure(f, n=5):
    """Le n figure del foglio, da sinistra: [{'rgba', 'fondo'}]. Pezzi staccati (lanterna, sciarpa) uniti alla figura vicina."""
    im = Image.open(f)
    rgb = np.array(im.convert('RGB'))
    a = pv.alfa_magenta(rgb)
    m = (a > 0.5).astype(np.uint8)
    # le 5 macchie più grandi sono le figure; i pezzi piccoli vanno alla figura che li ha sopra o sotto (più vicina in x)
    k, lab, st, _ = cv2.connectedComponentsWithStats(cv2.dilate(m, np.ones((5, 5), np.uint8)))
    gr = sorted(range(1, k), key=lambda i: -st[i, cv2.CC_STAT_AREA])[:n]
    gr = sorted(gr, key=lambda i: st[i, cv2.CC_STAT_LEFT])
    cx = lambda i: st[i, cv2.CC_STAT_LEFT] + st[i, cv2.CC_STAT_WIDTH] / 2
    di = {i: i for i in gr}
    for i in range(1, k):
        if i not in di and st[i, cv2.CC_STAT_AREA] > 30:
            di[i] = min(gr, key=lambda g: abs(cx(g) - cx(i)))
    out = []
    for i in gr:
        tieni = np.isin(lab, [j for j, g in di.items() if g == i]) & (m > 0)
        ys, xs = np.where(tieni)
        ya, yb, xa, xb = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        alfa = (a * tieni)[ya:yb, xa:xb]
        out.append({'rgba': np.dstack([rgb[ya:yb, xa:xb], (alfa * 255).astype(np.uint8)]), 'fondo': yb})
    return out


def converti(nome):
    f = os.path.join(QUI, 'fogli', nome + '.png')
    fs = figure(f)
    if len(fs) != 5:
        print(f'{nome}: trovate {len(fs)} figure invece di 5, salto')
        return None
    rif = fs[0]['rgba'].shape[0]
    base_y = max(x['fondo'] for x in fs)
    for x in fs:
        x['C'], x['A'] = pv.pixelizza(x['rgba'], round(ALTO * x['rgba'].shape[0] / rif))
        x['giu'] = round((base_y - x['fondo']) * x['A'].shape[0] / x['rgba'].shape[0])
    pal = pv.tavolozza(fs, K)
    base = os.path.join(DATI, nome)
    shutil.rmtree(base, ignore_errors=True)
    px, cod = os.path.join(base, f'px{ALTO}'), os.path.join(base, 'codex')
    os.makedirs(px)
    os.makedirs(cod)
    elenco = {}
    for n, x in zip(NOMI_MOSSE, fs):
        Q = pv.pulisci(pv.quantizza(x['C'], x['A'], pal), x['A'], pal)
        t = pv.tela(Q, x['A'], max(0, x['giu']))
        Image.fromarray(t, 'RGBA').save(os.path.join(px, n + '.png'))
        Image.fromarray(x['rgba'], 'RGBA').save(os.path.join(cod, n + '.png'))
        H2, W2 = t.shape[:2]
        elenco[n] = {'w': W2, 'h': H2, 'ax': W2 // 2, 'ay': H2 - 1, 'box': [1, 1, int(x['A'].shape[1]), int(x['A'].shape[0])]}
    json.dump(elenco, open(os.path.join(px, 'elenco.json'), 'w'), indent=0)
    alti = [x['A'].shape[0] for x in fs]
    print(f'{nome}: alte {alti} px, {len(pal)} colori, foglio {Image.open(f).size}')
    return elenco


if __name__ == '__main__':
    tutti = sorted(os.path.splitext(x)[0] for x in os.listdir(os.path.join(QUI, 'fogli')) if x.endswith('.png'))
    scelti = [a for a in ARGV if a in tutti] or tutti
    indice_f = os.path.join(DATI, 'indice.json')
    indice = json.load(open(indice_f)) if os.path.exists(indice_f) else {}
    for nome in scelti:
        el = converti(nome)
        if el:
            indice[nome] = {'metodo': 'hd', 'gruppo': 'opzioni', 'nome': NOMI.get(nome, nome), 'alti': {str(ALTO): el}}
    json.dump(indice, open(indice_f, 'w'), ensure_ascii=False)
