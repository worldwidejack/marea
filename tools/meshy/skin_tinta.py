#!/usr/bin/env python3
"""Una skin del protagonista cambiando i colori della sua texture (ogni colore del modello è un colore della palette, una zona piatta).

Uso:  python3 tools/meshy/skin_tinta.py --colori                       (i colori della texture di partenza e quanto pesano)
      python3 tools/meshy/skin_tinta.py <id> DA=A [DA=A …]            (es. marinaio E8433F=2478A8 163F73=F4E3C1; senza cambi = la skin `base`)
      python3 tools/meshy/skin_tinta.py --png8 <id> <file.png>        (una texture già a colori di palette, da skin_bake.py, in PNG a palette)
Legge assets/ai/eroe/eroe_tex.png, scrive apps/client/public/assets/skin/<id>.png (PNG a palette: pochi KB). Gli A devono essere colori
di docs/ART_BIBLE.md. Per skin con disegni nuovi (non solo tinte) c'è skin_bake.py (retexture di Meshy cotta sulle stesse UV).
PELLE E CAPELLI NON SI TOCCANO: assets/ai/eroe/eroe_mappa.png (skin_mappa.py) dice quali pixel sono pelle e capelli; il gioco li ridipinge
coi colori scelti nell'editor, su qualsiasi skin, e qui restano com'erano nella texture di partenza (anche in --png8). Un colore che sta in
parte dentro quelle zone (il marrone scuro dei capelli è anche il contorno, i guanti e la borsa) cambia solo fuori da esse: --colori dice
quanto pesa fuori. Una skin con la sua pelle (una rana verde) mette "pelleFissa": true nella voce di avatar.json e il gioco non la ridipinge.
Serve Pillow e numpy.
"""
import os
import re
import sys

import numpy as np
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
RADICE = os.path.abspath(os.path.join(AQUI, '..', '..'))
BASE = os.path.join(RADICE, 'assets', 'ai', 'eroe', 'eroe_tex.png')
MAPPA = os.path.join(RADICE, 'assets', 'ai', 'eroe', 'eroe_mappa.png')   # grigio, valore / 50 = ruolo: 0 niente, 1-4 pelle e capelli
USCITA = os.path.join(RADICE, 'apps', 'client', 'public', 'assets', 'skin')
# i colori di docs/ART_BIBLE.md (24 + 6 pelli): la stessa lista di eroe_palette.py
PAL = set('F4E3C1 E2B97F C98A4B 8E5A2B 5A3A1E 2E1E14 D9E872 8FC35B 4E9A46 2C6B3F 1E4A3A 7FE3E0 3FB9C9 2478A8 163F73 E8E1D6 B9AFA3 7F7568 4A4340 23201F E8433F F2A33A F5D547 A64DFF FBE2C8 EFC29B D9A070 B8784C 8C5636 5A3A28'.split())
rgb = lambda h: tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def colori(a):
    """(rgb, pixel) dei colori della texture, dal più grande; il nero fuori dalle isole UV non conta."""
    u, c = np.unique(a.reshape(-1, 3), axis=0, return_counts=True)
    return [(tuple(int(v) for v in u[i]), int(c[i])) for i in np.argsort(-c)]


def scrivi(nome, out):
    """PNG a palette (stessi colori, pochi KB): ogni colore diverso una voce."""
    tab = [k for k, _c in colori(out)]
    idx = np.zeros(out.shape[:2], dtype=np.uint8)
    for i, k in enumerate(tab): idx[(out == k).all(axis=2)] = i
    im = Image.fromarray(idx, 'P'); im.putpalette([v for k in tab for v in k])
    os.makedirs(USCITA, exist_ok=True)
    dove = os.path.join(USCITA, nome + '.png'); im.save(dove, optimize=True)
    print(f'{dove} ({os.path.getsize(dove) / 1024:.1f} KB, {len(tab)} colori)')


def libere():
    """I pixel di pelle e capelli (True), dalla mappa: il gioco li ridipinge, la skin non li tocca."""
    return np.rint(np.array(Image.open(MAPPA).convert('L')) / 50) > 0


def main():
    base = np.array(Image.open(BASE).convert('RGB'))
    zone = libere()
    if len(sys.argv) == 4 and sys.argv[1] == '--png8':
        out = np.array(Image.open(sys.argv[3]).convert('RGB'))
        out[zone] = base[zone]
        fuori = [k for k, _c in colori(out) if '%02X%02X%02X' % k not in PAL]
        if fuori: sys.exit('colori fuori palette: ' + ' '.join('%02X%02X%02X' % k for k in fuori) + ' (la cottura va rifatta con skin_bake.py)')
        return scrivi(sys.argv[2], out)
    if sys.argv[1:] == ['--colori']:
        fuori = base[~zone]
        tot = sum(c for _k, c in colori(fuori)) - (fuori.sum(axis=1) == 0).sum()
        dentro = {k: c for k, c in colori(base[zone])}
        for k, c in colori(fuori):
            if k != (0, 0, 0): print('%02X%02X%02X  %5.1f %%%s' % (*k, 100 * c / tot, '   (anche in pelle e capelli: in quelle zone non cambia)' if k in dentro else ''))
        return
    if len(sys.argv) < 2 or not re.fullmatch(r'[a-z0-9_]+', sys.argv[1]):
        sys.exit(__doc__)
    nome, cambi = sys.argv[1], {}
    for arg in sys.argv[2:]:
        da, a = arg.upper().split('=')
        if a not in PAL: sys.exit(f'{a} non è un colore della palette (docs/ART_BIBLE.md)')
        cambi[rgb(da)] = rgb(a)
    usati = {k for k, _c in colori(base[~zone])}
    for da in cambi:
        if da not in usati: sys.exit('%02X%02X%02X non c\'è nella texture (--colori li elenca)' % da)
    out = base.copy()
    for da, a in cambi.items(): out[(base == da).all(axis=2) & ~zone] = a
    scrivi(nome, out)


if __name__ == '__main__':
    main()
