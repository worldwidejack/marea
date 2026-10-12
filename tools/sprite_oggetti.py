#!/usr/bin/env python3
"""Gli sprite in pixel art degli oggetti delle Corse (#250) dalla concept approvata da Jack (assets/concept/corse/corse_20_oggetti.jpg).

Ritaglia ogni oggetto, toglie lo sfondo (riempimento dai bordi), porta ogni pixel al colore più vicino della palette (ART_BIBLE §2) e
riduce a blocchi col colore che vince nel blocco: pixel netti, solo colori della palette. Stampa le righe di lettere per
apps/client/src/corse/sprite_oggetti.ts (una lettera = un colore, '.' = trasparente) e salva un'anteprima ingrandita.

Uso:  python3 tools/sprite_oggetti.py [--scrivi] [--anteprima out.png] [nomi...]
      --scrivi riscrive il blocco tra «// <generati>» e «// </generati>» in sprite_oggetti.ts (senza stampa).
"""
import sys
from collections import Counter, deque
from PIL import Image

CONCEPT = 'assets/concept/corse/corse_20_oggetti.jpg'
# lettera → colore (la stessa tabella PAL di sprite_oggetti.ts)
PAL = {
    'g': '#F5D547', 'a': '#F2A33A', 'b': '#FFB03D', 'c': '#C98A4B', 'l': '#8E5A2B', 's': '#5A3A1E', 'n': '#23201F', 'h': '#F4E3C1',
    'r': '#E8433F', 'o': '#FF5C3D', 'w': '#E8E1D6', 'p': '#B9AFA3', 'k': '#7F7568', 'q': '#4A4340', 'u': '#2478A8', 'v': '#3FB9C9',
    'x': '#7FE3E0', 'e': '#D9E872', 'm': '#8FC35B', 'd': '#4E9A46', 't': '#2C6B3F',
}
RGB = {k: tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) for k, v in PAL.items()}
# ritaglio (x0, y0, x1, y1) sulla concept 1672×941, altezza in pixel dello sprite, lettere ammesse, e le sagome dove il bianco
# dell'oggetto tocca lo sfondo (stesso colore: il riempimento non le distingue). Sagome in coordinate della concept:
# ('e', cx, cy, rx, ry, ±1) ellisse, ('p', [(x, y), ...], ±1) poligono; +1 = è oggetto, −1 = buco (lì il chiaro è sfondo).
OGGETTI = {
    'LATTINA': ((140, 228, 528, 472), 26, 'rwpkqngab', [('p', [(300, 330), (455, 240), (525, 300), (420, 420), (330, 450)], 1)]),
    'TRIS': ((630, 245, 1072, 498), 26, 'rwpkqngab', []),
    'PALLA': ((262, 572, 516, 812), 24, 'rwpkuvxg', [('e', 391, 694, 121, 117, 1)]),
    'RAZZO': ((628, 578, 1052, 828), 26, 'rwpkqngab', [('p', [(722, 662), (905, 585), (1040, 605), (1012, 682), (870, 772), (790, 792), (752, 735)], 1)]),
    'SALVAGENTE': ((1180, 572, 1538, 828), 26, 'rwpkcls', [('e', 1360, 694, 160, 112, 1), ('e', 1381, 690, 70, 34, -1)]),
    'SCATOLA': ((690, 22, 978, 212), 22, 'gabclswn', []),
    # la Giungla (assets/concept/corse/corse_22_giungla_oggetti.jpg, 1672×941)
    'COCCO': ((245, 545, 508, 800), 22, 'clsnhwpk', [('e', 378, 672, 120, 115, 1)], 'assets/concept/corse/corse_22_giungla_oggetti.jpg'),
    'MASSO': ((700, 515, 1012, 812), 26, 'pkqwnmdte', [('e', 857, 666, 144, 140, 1)], 'assets/concept/corse/corse_22_giungla_oggetti.jpg'),
    'LIANA': ((1140, 505, 1535, 842), 26, 'emdtclsn', [], 'assets/concept/corse/corse_22_giungla_oggetti.jpg'),
}


def dentro(forme, x, y):
    """+1 se (x, y) della concept sta in una sagoma «oggetto» e in nessun buco, −1 se in un buco, 0 altrimenti."""
    esito = 0
    for f in forme:
        if f[0] == 'e':
            _, cx, cy, rx, ry, seg = f
            ok = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1
        else:
            _, pts, seg = f
            ok = False
            for i in range(len(pts)):
                (x1, y1), (x2, y2) = pts[i], pts[i - 1]
                if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
                    ok = not ok
        if ok:
            if seg < 0: return -1
            esito = 1
    return esito


def dist(c, d):
    r = (c[0] + d[0]) / 2
    return (2 + r / 256) * (c[0] - d[0]) ** 2 + 4 * (c[1] - d[1]) ** 2 + (2 + (255 - r) / 256) * (c[2] - d[2]) ** 2


def sfondo(img, tol=26):
    """Maschera dello sfondo: riempimento dai bordi sui pixel chiari e poco saturi (carta, ombre, scie)."""
    w, h = img.size
    px = img.load()
    def chiaro(c):
        return min(c) > 255 - tol * 3 and max(c) - min(c) < tol
    fuori = [[False] * w for _ in range(h)]
    q = deque((x, y) for x in range(w) for y in (0, h - 1)) + deque((x, y) for y in range(h) for x in (0, w - 1))
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or fuori[y][x] or not chiaro(px[x, y]):
            continue
        fuori[y][x] = True
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return fuori


def sprite(nome):
    box, alto, lettere, forme, *da = OGGETTI[nome]
    img = Image.open(da[0] if da else CONCEPT).convert('RGB').crop(box)
    w, h = img.size
    fuori = sfondo(img)
    px = img.load()
    chiaro = lambda c: min(c) > 200 and max(c) - min(c) < 26
    for y in range(h):
        for x in range(w):
            d = dentro(forme, x + box[0], y + box[1])
            if d > 0: fuori[y][x] = False
            elif d < 0 and chiaro(px[x, y]): fuori[y][x] = True
    passo = h / alto
    largo = round(w / passo)
    righe = []
    for j in range(alto):
        riga = ''
        for i in range(largo):
            voti = Counter()
            for y in range(int(j * passo), int((j + 1) * passo)):
                for x in range(int(i * passo), min(w, int((i + 1) * passo))):
                    if fuori[y][x]:
                        voti['.'] += 1
                    else:
                        c = px[x, y]
                        voti[min(lettere, key=lambda k: dist(c, RGB[k]))] += 1
            tot = sum(voti.values())
            pieni = Counter({k: v for k, v in voti.items() if k != '.'})
            riga += pieni.most_common(1)[0][0] if pieni and sum(pieni.values()) > tot * 0.45 else '.'
        righe.append(riga)
    # via i pixel isolati (scintille, sbavature): almeno due vicini pieni su quattro
    for _ in range(2):
        g = [list(r) for r in righe]
        for y, r in enumerate(righe):
            for x, ch in enumerate(r):
                if ch == '.': continue
                vic = sum(1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= y + dy < len(righe) and 0 <= x + dx < len(r) and righe[y + dy][x + dx] != '.')
                if vic < 2: g[y][x] = '.'
        righe = [''.join(r) for r in g]
    # via le colonne vuote ai lati
    while righe and all(r[0] == '.' for r in righe): righe = [r[1:] for r in righe]
    while righe and all(r[-1] == '.' for r in righe): righe = [r[:-1] for r in righe]
    while righe and set(righe[0]) == {'.'}: righe.pop(0)
    while righe and set(righe[-1]) == {'.'}: righe.pop()
    return righe


def faccia(path, quad, lato, lettere):
    """Una faccia di un oggetto in prospettiva (quad = alto-sx, basso-sx, basso-dx, alto-dx sulla concept) raddrizzata a `lato`×`lato`
    pixel della palette (blocchi col colore che vince): per le texture dei cubi (la cassa del relitto)."""
    img = Image.open(path).convert('RGB')
    n = lato * 12
    piatta = img.transform((n, n), Image.QUAD, [c for p in quad for c in p], Image.BILINEAR)
    px = piatta.load()
    righe = []
    for j in range(lato):
        riga = ''
        for i in range(lato):
            voti = Counter(min(lettere, key=lambda k: dist(px[x, y], RGB[k])) for y in range(j * 12, j * 12 + 12) for x in range(i * 12, i * 12 + 12))
            riga += voti.most_common(1)[0][0]
        righe.append(riga)
    return righe


SCATOLE = 'assets/concept/corse/corse_21_scatole.jpg'
# le facce dei cubi: (concept, quad, lato, lettere)
FACCE = {
    'CASSA_FIANCO': (SCATOLE, [(165, 175), (165, 415), (430, 460), (430, 215)], 16, 'clsahkqnro'),
    'CASSA_CIMA': (SCATOLE, [(165, 175), (430, 215), (555, 165), (300, 125)], 16, 'clsahkqn'),
}


def anteprima(fogli, path, scala=8):
    W = sum(len(r[0]) for r in fogli.values()) * scala + scala * 4 * len(fogli)
    H = max(len(r) for r in fogli.values()) * scala + 8
    out = Image.new('RGB', (W, H), (60, 120, 160))
    x0 = scala * 2
    for righe in fogli.values():
        for y, r in enumerate(righe):
            for x, ch in enumerate(r):
                if ch != '.':
                    out.paste(RGB[ch], (x0 + x * scala, 4 + y * scala, x0 + (x + 1) * scala, 4 + (y + 1) * scala))
        x0 += len(righe[0]) * scala + scala * 4
    out.save(path)


if __name__ == '__main__':
    args = sys.argv[1:]
    ant = None
    if '--anteprima' in args:
        i = args.index('--anteprima'); ant = args[i + 1]; del args[i:i + 2]
    nomi = args or [*OGGETTI, *FACCE]
    scrivi = '--scrivi' in args
    if scrivi: args.remove('--scrivi'); nomi = args or [*OGGETTI, *FACCE]
    fogli = {n: (faccia(*FACCE[n]) if n in FACCE else sprite(n)) for n in nomi}
    testo = ''
    for n, righe in fogli.items():
        testo += f'export const {n} = [\n' + ''.join(f"  '{r}',\n" for r in righe) + '];\n'
    if scrivi:
        TS = 'apps/client/src/corse/sprite_oggetti.ts'
        ts = open(TS).read()
        a, b = ts.index('// <generati>'), ts.index('// </generati>')
        open(TS, 'w').write(ts[:a] + '// <generati> (tools/sprite_oggetti.py --scrivi: non toccare a mano)\n' + testo + ts[b:])
    else:
        print(testo, end='')
    if ant: anteprima(fogli, ant)
