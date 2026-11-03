#!/usr/bin/env python3
"""Una skin del protagonista cambiando i colori della sua texture (ogni colore del modello è un colore della palette, una zona piatta).

Uso:  python3 tools/meshy/skin_tinta.py --colori                       (i colori della texture di partenza e quanto pesano)
      python3 tools/meshy/skin_tinta.py <id> DA=A [DA=A …]            (es. marinaio E8433F=2478A8 163F73=F4E3C1; senza cambi = la skin `base`)
      python3 tools/meshy/skin_tinta.py --png8 <id> <file.png>        (una texture già a colori di palette, da skin_bake.py, in PNG a palette)
Legge assets/ai/eroe/eroe_tex.png, scrive apps/client/public/assets/skin/<id>.png (PNG a palette: pochi KB). Gli A devono essere colori
di docs/ART_BIBLE.md. Per skin con disegni nuovi (non solo tinte) c'è skin_bake.py (retexture di Meshy cotta sulle stesse UV).
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


def main():
    if len(sys.argv) == 4 and sys.argv[1] == '--png8':
        out = np.array(Image.open(sys.argv[3]).convert('RGB'))
        fuori = [k for k, _c in colori(out) if '%02X%02X%02X' % k not in PAL]
        if fuori: sys.exit('colori fuori palette: ' + ' '.join('%02X%02X%02X' % k for k in fuori) + ' (la cottura va rifatta con skin_bake.py)')
        return scrivi(sys.argv[2], out)
    base = np.array(Image.open(BASE).convert('RGB'))
    if sys.argv[1:] == ['--colori']:
        tot = sum(c for _k, c in colori(base)) - (base.reshape(-1, 3).sum(axis=1) == 0).sum()
        for k, c in colori(base):
            if k != (0, 0, 0): print('%02X%02X%02X  %5.1f %%' % (*k, 100 * c / tot))
        return
    if len(sys.argv) < 2 or not re.fullmatch(r'[a-z0-9_]+', sys.argv[1]):
        sys.exit(__doc__)
    nome, cambi = sys.argv[1], {}
    for arg in sys.argv[2:]:
        da, a = arg.upper().split('=')
        if a not in PAL: sys.exit(f'{a} non è un colore della palette (docs/ART_BIBLE.md)')
        cambi[rgb(da)] = rgb(a)
    usati = {k for k, _c in colori(base)}
    for da in cambi:
        if da not in usati: sys.exit('%02X%02X%02X non c\'è nella texture (--colori li elenca)' % da)
    out = base.copy()
    for da, a in cambi.items(): out[(base == da).all(axis=2)] = a
    scrivi(nome, out)


if __name__ == '__main__':
    main()
