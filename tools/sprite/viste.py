#!/usr/bin/env python3
"""MAREA — il modello di un personaggio nuovo in 5 viste (davanti, 3/4 davanti, profilo, 3/4 dietro, dietro), da cui poi si
disegnano gli sprite. Due passi, prima e dopo il generatore:

  guida   la sagoma grigia: 5 figure in fila sullo stesso grigio caldo dei fogli, alla stessa altezza, piedi sulla stessa
          riga, testa alla percentuale del disegno approvato, braccia staccate di ~12°. Va allegata al generatore (prompt.py
          --modello) e non si mostra a Jack: serve a tenere le proporzioni (senza, Codex fa proporzioni da adulto normale).
  taglia  dal foglio fatto dal generatore alle 5 viste separate e scontornate, tagliate per sagome (una mano può stare
          sotto i capelli della vista accanto): modello/vista_<S|SE|E|NE|N>.png, le copie .jpg per il repo e
          modello/_FOGLIO_5_viste.jpg (grandi alla stessa scala + la misura in gioco), da far approvare a Jack.

Uso:  python tools/sprite/viste.py guida <cartella> [--testa 45] [--largo 0.82]
      python tools/sprite/viste.py taglia <cartella> <foglio.png>
--testa = altezza della testa coi capelli in % della figura (misurala sul disegno approvato); --largo = larghezza della
testa rispetto all'altezza (0,82 una testa stretta e lunga, 0,95 una tonda).
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comune import CARTA, FONDO, GRIGIO, INK, VISTE_MODELLO, font, opzione  # noqa: E402

SAGOMA, BORDO = (165, 165, 165), (95, 95, 95)
# per vista: larghezza della testa, del busto e del passo fra le gambe rispetto al davanti; braccia che si vedono (2 ai lati,
# 1 nel profilo); verso delle punte dei piedi (0 davanti e dietro, 1 a destra)
FORME = [(1.0, 1.0, 1.0, 2, 0), (.92, .78, .7, 2, .6), (.86, .5, .25, 1, 1), (.92, .78, .7, 2, .6), (1.0, 1.0, 1.0, 2, 0)]
NOMI = {'S': 'davanti', 'SE': '3/4 davanti', 'E': 'profilo', 'NE': '3/4 dietro', 'N': 'dietro'}


def figura(d, cx, testa, largo, lt, lb, lp, braccia, punta, alto=600, piedi=830):
    top = piedi - alto
    th = testa * alto
    tw = th * largo * lt
    spalla_y = top + th + 0.015 * alto
    anca_y = spalla_y + (0.94 - testa) * 0.45 * alto
    sp, an = 0.24 * alto * lb, 0.19 * alto * lb
    g, bw, m = 0.05 * alto, 0.042 * alto, 0.05 * alto
    pw, ph = 0.13 * alto, 0.05 * alto
    for s in ((-1, 1) if lp > .3 else (0,)):
        gx = cx + s * an * 0.27 * lp
        d.rectangle((gx - g / 2, anca_y - 20, gx + g / 2, piedi - ph / 2), fill=SAGOMA, outline=BORDO, width=3)
        ox, k = punta * pw * 0.35, 1 - .2 * (1 - punta)
        d.ellipse((gx - pw / 2 * k + ox, piedi - ph, gx + pw / 2 * k + ox, piedi), fill=SAGOMA, outline=BORDO, width=3)
    d.polygon([(cx - sp / 2, spalla_y), (cx + sp / 2, spalla_y), (cx + an / 2, anca_y), (cx - an / 2, anca_y)],
              fill=SAGOMA, outline=BORDO, width=3)
    d.rectangle((cx - bw * .45, top + th - 8, cx + bw * .45, spalla_y + 6), fill=SAGOMA, outline=BORDO, width=3)
    lungo = (anca_y - spalla_y) * 1.05
    for s in ((-1, 1) if braccia == 2 else (0,)):
        x0 = cx + s * (sp / 2 + bw * 0.1)
        x1, y1 = (x0 + s * lungo * 0.2, spalla_y + lungo * 0.98) if s else (cx + lungo * 0.08, spalla_y + lungo)
        for col, w in ((BORDO, bw + 6), (SAGOMA, bw)):
            d.line([(x0, spalla_y + bw * 0.5), (x1, y1)], fill=col, width=int(w))
        d.ellipse((x1 - m * .8, y1 - m * 0.3, x1 + m * .8, y1 + m * 1.5), fill=SAGOMA, outline=BORDO, width=3)
    d.ellipse((cx - tw / 2, top, cx + tw / 2, top + th), fill=SAGOMA, outline=BORDO, width=4)


def guida(cartella):
    testa = float(opzione('testa', 45))
    largo = float(opzione('largo', 0.82))
    im = Image.new('RGB', (1536, 1024), FONDO)
    d = ImageDraw.Draw(im)
    for i, forma in enumerate(FORME):
        figura(d, 1536 / 5 * (i + .5), testa / 100, largo, *forma)
    os.makedirs(os.path.join(cartella, 'modello'), exist_ok=True)
    out = os.path.join(cartella, 'modello', f'guida_{opzione("testa", "45")}.png')
    im.save(out)
    print(out)


def alfa_da_fondo(im):
    """Alfa dal fondo grigio piatto. Una maglietta bianca sta vicina al grigio e verrebbe mezza trasparente: tutto ciò che il
    contorno chiude è pieno; trasparenti solo il fondo esterno e i buchi veri (fra braccio e fianco, color fondo)."""
    a = np.asarray(im.convert('RGB')).astype(np.int16)
    f = np.median(np.concatenate([a[:8, :8].reshape(-1, 3), a[:8, -8:].reshape(-1, 3), a[-8:, :8].reshape(-1, 3)]), axis=0)
    d = np.abs(a - f).sum(axis=2)
    lum = a @ np.array([0.299, 0.587, 0.114])
    lum_f = float(f @ np.array([0.299, 0.587, 0.114]))
    scuro = lum < 110
    muro = cv2.dilate(scuro.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    k, et = cv2.connectedComponents((~muro).astype(np.uint8), connectivity=4)
    fondo_zona = np.zeros(k, bool)
    for i in range(1, k):
        fondo_zona[i] = np.median(d[et == i]) < 22
    fuori = fondo_zona[et] & ~muro
    anello = muro & ~scuro
    accanto = cv2.dilate(fuori.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    fuori |= anello & (d < 22) & accanto
    alfa = np.where(fuori, 0, 255).astype(np.uint8)
    # l'orlo verso il fondo diventa inchiostro semitrasparente (niente filo chiaro su un fondo scuro)
    orlo = anello & ~fuori & (lum > 110) & (cv2.dilate(fuori.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
    k_al = np.clip((lum_f - lum) / (lum_f - 60), 0.15, 1)
    alfa[orlo] = (k_al[orlo] * 255).astype(np.uint8)
    inchiostro = np.median(a[scuro], axis=0)
    a = np.where(orlo[..., None], inchiostro, a)
    return a.astype(np.uint8), alfa


def figure(im, n=5):
    """Le n figure di una riga, per sagome separate: le n macchie più grandi, i pezzetti staccati alla più vicina."""
    rgb, alfa = alfa_da_fondo(im)
    k, etichette, stat, centri = cv2.connectedComponentsWithStats((alfa > 40).astype(np.uint8), connectivity=8)
    ordine = sorted(range(1, k), key=lambda i: -stat[i, cv2.CC_STAT_AREA])
    semi = sorted(ordine[:n], key=lambda i: centri[i][0])
    figura_di = {s: j for j, s in enumerate(semi)}
    for i in ordine[n:]:
        if stat[i, cv2.CC_STAT_AREA] >= 30:  # i puntini di rumore no
            figura_di[i] = int(np.argmin([abs(centri[i][0] - centri[s][0]) for s in semi]))
    mappa = np.zeros(k, dtype=np.int16) - 1
    for i, j in figura_di.items():
        mappa[i] = j
    di_chi = mappa[etichette]
    out = []
    for j in range(n):
        ys, xs = np.where(di_chi == j)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        a = np.where(di_chi == j, alfa, 0)[y0:y1, x0:x1].astype(np.uint8)
        out.append(Image.fromarray(np.dstack([rgb[y0:y1, x0:x1], a]), 'RGBA'))
    return out


def taglia(cartella, foglio):
    viste = figure(Image.open(foglio))
    if len(viste) != 5:
        sys.exit(f'trovate {len(viste)} figure invece di 5')
    out = os.path.join(cartella, 'modello')
    os.makedirs(out, exist_ok=True)
    for v, fig in zip(VISTE_MODELLO, viste):
        fig.save(os.path.join(out, f'vista_{v}.png'))
        su = Image.new('RGB', fig.size, FONDO)
        su.paste(fig, (0, 0), fig)
        su.save(os.path.join(out, f'vista_{v}.jpg'), quality=92)
    alto = max(f.height for f in viste)
    scala, in_gioco = 640 / alto, 118
    cw, ch = 380, 960
    fo = Image.new('RGB', (40 + 5 * (cw + 16) + 24, 220 + ch + 40), CARTA)
    d = ImageDraw.Draw(fo)
    d.text((40, 30), 'MAREA · il modello in 5 viste', fill=INK, font=font(60, True))
    d.text((40, 116), 'Il foglio da cui si fanno gli sprite: posa neutra, braccia staccate, tutte alla stessa scala.',
           fill=GRIGIO, font=font(28))
    d.text((40, 156), 'Sotto ogni vista, in piccolo.', fill=GRIGIO, font=font(28))
    for i, (v, fig) in enumerate(zip(VISTE_MODELLO, viste)):
        x, y = 40 + i * (cw + 16), 220
        d.rectangle((x, y, x + cw, y + ch), fill=FONDO)
        d.text((x + 16, y + 12), NOMI[v], fill=INK, font=font(34, True))
        big = fig.resize((round(fig.width * scala), round(fig.height * scala)), Image.LANCZOS)
        fo.paste(big, (x + (cw - big.width) // 2, y + 90 + 640 - big.height), big)
        k = in_gioco / alto
        small = fig.resize((max(1, round(fig.width * k)), max(1, round(fig.height * k))), Image.LANCZOS)
        fo.paste(small, (x + (cw - small.width) // 2, y + ch - 24 - small.height), small)
    fo.save(os.path.join(out, '_FOGLIO_5_viste.jpg'), quality=90)
    # la scheda prende le viste da qui, se non le ha già
    p = os.path.join(cartella, 'scheda.json')
    if os.path.exists(p):
        scheda = json.load(open(p, encoding='utf-8'))
        if not scheda.get('viste'):
            scheda['viste'] = {v: f'modello/vista_{v}.jpg' for v in VISTE_MODELLO}
            json.dump(scheda, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            print('scheda.json: "viste" → modello/vista_*.jpg')
    print(os.path.join(out, '_FOGLIO_5_viste.jpg'), 'altezze', [f.height for f in viste], 'larghezze', [f.width for f in viste])


def main():
    a = [x for x in sys.argv[1:] if not x.startswith('--') and x not in (opzione('testa'), opzione('largo'))]
    if len(a) < 2 or a[0] not in ('guida', 'taglia') or (a[0] == 'taglia' and len(a) < 3):
        sys.exit(__doc__)
    cartella = os.path.abspath(a[1])
    os.makedirs(cartella, exist_ok=True)
    if a[0] == 'guida':
        guida(cartella)
    else:
        taglia(cartella, a[2])


if __name__ == '__main__':
    main()
