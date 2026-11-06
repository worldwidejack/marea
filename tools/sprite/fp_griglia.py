#!/usr/bin/env python3
"""MAREA, prima persona: da un foglio di Codex su fondo magenta agli sprite veri.

Il disegno di Codex sta già su una griglia di pixel grossi, con un passo non intero: qui si trova il passo (analisi di frequenza dei bordi),
si prende un colore per cella (la mediana del centro, niente medie sui bordi), si toglie il fondo e si portano i colori sulla tavolozza.
Ogni figura staccata dal fondo diventa uno sprite, da sinistra a destra.
Uso: fp_griglia.py <foglio.png> <cartella di uscita> [--passo 10.7] [--min-area 200]
"""
import math
import os
import sys

import numpy as np
from PIL import Image

# I colori del protagonista comuni a tutte le skin, i toni di pelle e i grigi dei metalli della palette (docs/ART_BIBLE.md §2)
TAVOLOZZA = ['#2E1E14', '#5A3A1E', '#5A3A28', '#8C5636', '#B8784C', '#D9A070', '#E2B97F', '#EFC29B', '#F4E3C1', '#E8E1D6', '#B9AFA3', '#7F7568', '#4A4644', '#23201F']


def hex_rgb(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.int32)


def magenta(a):
    r, g, b = a[..., 0].astype(np.int32), a[..., 1].astype(np.int32), a[..., 2].astype(np.int32)
    return (r > 170) & (b > 150) & (g < 90) & (np.abs(r - b) < 90)


def griglia(a):
    """(passo, fase x, fase y): il passo in cui i bordi cadono più regolari, cercato a centesimi attorno al migliore."""
    g = a.astype(np.int32).sum(axis=2)
    dx = np.abs(np.diff(g, axis=1)).sum(axis=0).astype(np.float64)
    dy = np.abs(np.diff(g, axis=0)).sum(axis=1).astype(np.float64)

    def forza(p):
        s = 0.0
        for ser in (dx, dy):
            ang = 2 * math.pi * np.arange(len(ser)) / p
            s += abs((ser * np.exp(1j * ang)).sum()) / max(1e-6, ser.sum())
        return s
    grezzo = max((p / 10 for p in range(50, 300)), key=forza)
    passo = max((grezzo + d / 100 for d in range(-20, 21)), key=forza)

    def fase(ser):
        ang = 2 * math.pi * np.arange(len(ser)) / passo
        return ((math.atan2((ser * np.sin(ang)).sum(), (ser * np.cos(ang)).sum()) / (2 * math.pi)) * passo + 1) % passo
    return passo, fase(dx), fase(dy)


def riduci(path, passo=None):
    out, p, _, _ = riduci_griglia(path, passo)
    return out, p


def riduci_griglia(path, passo=None):
    a = np.array(Image.open(path).convert('RGB'))
    p, fx, fy = griglia(a)
    if passo:
        p = passo
    w, h = int((a.shape[1] - fx) // p), int((a.shape[0] - fy) // p)
    tav = np.stack([hex_rgb(c) for c in TAVOLOZZA])
    out = np.zeros((h, w, 4), dtype=np.uint8)
    q = max(1, int(p / 2 if passo else p / 4))  # col passo imposto si guarda tutta la cella, così il contorno non si perde
    scuro = tav[0]
    for y in range(h):
        cy = int(fy + (y + 0.5) * p)
        for x in range(w):
            cx = int(fx + (x + 0.5) * p)
            cella = a[max(0, cy - q):cy + q, max(0, cx - q):cx + q].reshape(-1, 3)
            m = magenta(cella)
            if m.mean() > 0.5:
                continue
            piena = cella[~m]
            d0 = ((piena - scuro) ** 2).sum(axis=1)
            if passo and (d0 < 2500).mean() > 0.3:  # abbastanza inchiostro in questa cella: è contorno
                out[y, x, :3] = scuro; out[y, x, 3] = 255
                continue
            c = np.median(piena, axis=0)
            out[y, x, :3] = tav[int(((tav - c) ** 2).sum(axis=1).argmin())]
            out[y, x, 3] = 255
    return out, p, fx, fy


def figure(rgba, min_area=200):
    """Le figure staccate dal fondo, ognuna col suo riquadro."""
    alfa = rgba[..., 3] > 0
    visti = np.zeros(alfa.shape, dtype=bool)
    h, w = alfa.shape
    out = []
    for y0 in range(h):
        for x0 in range(w):
            if not alfa[y0, x0] or visti[y0, x0]:
                continue
            pila, celle = [(y0, x0)], []
            visti[y0, x0] = True
            while pila:
                y, x = pila.pop()
                celle.append((y, x))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w and alfa[ny, nx] and not visti[ny, nx]:
                            visti[ny, nx] = True
                            pila.append((ny, nx))
            if len(celle) >= min_area:
                ys, xs = zip(*celle)
                out.append((min(xs), min(ys), max(xs) + 1, max(ys) + 1, celle))
    out.sort(key=lambda f: f[0])
    return out


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    foglio, dove = sys.argv[1], sys.argv[2]
    passo = float(sys.argv[sys.argv.index('--passo') + 1]) if '--passo' in sys.argv else None
    min_area = int(sys.argv[sys.argv.index('--min-area') + 1]) if '--min-area' in sys.argv else 200
    os.makedirs(dove, exist_ok=True)
    rgba, p = riduci(foglio, passo)
    nome = os.path.splitext(os.path.basename(foglio))[0]
    print(f'{nome}: passo {p:.2f}, griglia {rgba.shape[1]}×{rgba.shape[0]}')
    for i, (x0, y0, x1, y1, celle) in enumerate(figure(rgba, min_area)):
        tela = np.zeros((y1 - y0, x1 - x0, 4), dtype=np.uint8)
        for y, x in celle:
            tela[y - y0, x - x0] = rgba[y, x]
        Image.fromarray(tela).save(os.path.join(dove, f'{nome}_{i + 1}.png'))
        print(f'  {nome}_{i + 1}.png {x1 - x0}×{y1 - y0}')


if __name__ == '__main__':
    main()
