#!/usr/bin/env python3
"""Borgo Marea (#247): il Porto e le 30 case in un'isola sola, la pianta «ferro di cavallo» scelta da Jack il 12 ott 2026.

La piazza del Porto (tools/borgo_piazza.json, il vecchio template `porto` 44×38) resta dov'era nel mondo; attorno, due anelli
di vie e cinque raggi, con le case sui due lati degli anelli e la porta sulla via. A sud resta aperta la baia col molo, e sulla
punta del braccio a sud-ovest c'è il Grande Faro.

Riscrive: islands.json (template `porto`), borgo.json (`case`), porto_amici.json (`faro`). Il riquadro del template è fisso
(QUADRO): le celle della piazza stanno sempre a +SPOSTA da come erano nel vecchio Porto, così rigenerare non sposta niente
di quello che sta nelle celle del Porto (Mercante, Bacheca, Grotta, gente, posti dei minigiochi).
Attenzione: rigenerare sovrascrive il template `porto` di islands.json; le modifiche alla piazza si fanno in borgo_piazza.json.

  python3 tools/borgo_pianta.py              riscrive i contenuti
  python3 tools/borgo_pianta.py --anteprima  in più tests/out/borgo_pianta.png (vista dall'alto)
"""
import json, math, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / 'packages/content/src'
PIAZZA = json.loads((ROOT / 'tools/borgo_piazza.json').read_text())

PORTO_AT = (110, 120)            # dove stava il vecchio Porto nel mondo (celle): la piazza resta lì
QUADRO = (88, 92, 166, 180)      # riquadro del template nel mondo [x0, z0, x1, z1): a est la Laguna parte da x 170 (4 celle di mare tra i riquadri)
SPOSTA = (PORTO_AT[0] - QUADRO[0], PORTO_AT[1] - QUADRO[1])
W, H = QUADRO[2] - QUADRO[0], QUADRO[3] - QUADRO[1]
C = (SPOSTA[0] + 22, SPOSTA[1] + 16)   # centro della piazza (il tavolo delle sfide), in celle del template

R_TERRA = 39                     # raggio della città
EST = PORTO_AT[0] + 51 - QUADRO[0]   # ultima colonna di terra verso la Laguna
BAIA = (255, 335)                # gradi (0 = est, 90 = nord, 270 = sud): qui resta il mare, col molo del Porto
ANELLI = [23, 34]
RAGGI = [180, 130, 80, 30, 230]
CASE = 30
TIPI = ['casa_a', 'casa_b', 'casa_c']
FARO = (254, 33)                 # angolo e raggio del Grande Faro: in punta al braccio a sud-ovest, sulla bocca della baia


def ang(x, z):
    return math.degrees(math.atan2(-(z - C[1]), x - C[0])) % 360


def in_citta(a):
    return not (BAIA[0] <= a <= BAIA[1])


def terra(x, z):
    return x <= EST and in_citta(ang(x, z)) and math.hypot(x - C[0], z - C[1]) <= R_TERRA


grid = [['~'] * W for _ in range(H)]
def get(x, z): return grid[z][x] if 0 <= x < W and 0 <= z < H else '~'
def put(x, z, t):
    if 0 <= x < W and 0 <= z < H: grid[z][x] = t


# ——— terra, riva di acqua bassa, bordo di sabbia ———
for z in range(H):
    for x in range(W):
        if terra(x, z): put(x, z, 'g')
for z in range(H):
    for x in range(W):
        if grid[z][x] == 'g':
            for dz in range(-2, 3):
                for dx in range(-2, 3):
                    if get(x + dx, z + dz) == '~' and 0 <= x + dx < W and 0 <= z + dz < H: put(x + dx, z + dz, ',')
N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
for z in range(H):
    for x in range(W):
        if grid[z][x] == 'g' and any(get(x + dx, z + dz) == ',' for dx, dz in N4): put(x, z, '.')

# ——— la piazza del vecchio Porto, al suo posto: la sua acqua diventa città dove c'è la città ———
for z, row in enumerate(PIAZZA['rows']):
    for x, t in enumerate(row):
        X, Z = SPOSTA[0] + x, SPOSTA[1] + z
        if t in '~,' and terra(X, Z): continue
        if t == '~' and get(X, Z) != '~': continue
        put(X, Z, t)
paved = set()
for (x0, z0, x1, z1) in PIAZZA['paved']:
    for z in range(z0, z1 + 1):
        for x in range(x0, x1 + 1): paved.add((SPOSTA[0] + x, SPOSTA[1] + z))

# dentro la città la sabbia e i pontili della piazza non servono più: prato (i moli sul mare restano)
for z in range(H):
    for x in range(W):
        if grid[z][x] in '.d' and (x, z) not in paved and terra(x, z) and not any(get(x + dx, z + dz) in '~,' for dx in range(-2, 3) for dz in range(-2, 3)):
            put(x, z, 'g')

# ——— vie: due anelli attorno alla piazza e cinque raggi ———
def via(x, z):
    if get(x, z) in '~,rd': return
    if get(x, z) == 'g': put(x, z, '.')
    paved.add((x, z))
for z in range(H):
    for x in range(W):
        if get(x, z) in '~,' or not in_citta(ang(x, z)): continue
        px, pz = x - C[0], z - C[1]
        r = math.hypot(px, pz)
        if any(abs(r - R) < 1.0 for R in ANELLI): via(x, z)
        for a in RAGGI:
            ra = math.radians(a); dx, dz = math.cos(ra), -math.sin(ra)
            if px * dx + pz * dz > 8 and abs(px * dz - pz * dx) < 1.1: via(x, z)

# gli edifici della piazza che stanno sopra una via nuova se ne vanno
def impronta(x, z): return [(x + dx, z + dz) for dx in (-1, 0, 1) for dz in (-1, 0, 1)]
slots = []
for s in PIAZZA['slots']:
    X, Z = SPOSTA[0] + s['at'][0], SPOSTA[1] + s['at'][1]
    if s['kind'] != 'tavolo' and any(c in paved for c in impronta(X, Z)): put(X, Z, 'g'); continue
    slots.append({'at': [X, Z], 'kind': s['kind'], 'rot': s['rot']})

# ——— case: sui due lati degli anelli, distribuite per settore tra un raggio e l'altro ———
def settori():  # tra un raggio e l'altro, e la baia fa da confine
    a = sorted(RAGGI + list(BAIA)); out = []
    for i in range(len(a)):
        lo, hi = a[i], a[(i + 1) % len(a)]
        if hi <= lo: hi += 360
        if in_citta(((lo + hi) / 2) % 360): out.append((lo, hi))
    return out

cand = []
for R in ANELLI:
    for lato in (-1, 1):
        rh = R + 3 * lato
        for lo, hi in settori():
            # candidati fitti (un passo ogni ~2 celle di arco, lontani 4 celle dai raggi): la scelta la fanno spazi e porte, sotto
            arco = math.radians(hi - lo) * rh
            n = max(0, int((arco - 8) // 2) + 1)
            for i in range(n):
                ra = math.radians((lo + (hi - lo) * (4 + (arco - 8) * (i + 0.5) / n) / arco) % 360)
                h = (round(C[0] + rh * math.cos(ra)), round(C[1] - rh * math.sin(ra)))
                rp = R + 0.6 * lato   # la porta sul bordo della via dalla parte della casa
                p = (round(C[0] + rp * math.cos(ra)), round(C[1] - rp * math.sin(ra)))
                cand.append((abs(rh - 26) + (0.5 if lato > 0 else 0), h, p))
cand.sort()
case = []
def libero(x, z):
    return all(get(cx, cz) == 'g' and (cx, cz) not in paved for cx, cz in impronta(x, z)) and \
        all(abs(hx - x) >= 4 or abs(hz - z) >= 4 for (hx, hz), _ in case) and \
        all(abs(s['at'][0] - x) >= 4 or abs(s['at'][1] - z) >= 4 for s in slots)
def spawn(h, p):  # dove si nasce uscendo di casa: 1,5 celle lungo la via (borgo.ts portaDi)
    dx, dz = p[0] - h[0], p[1] - h[1]; l = math.hypot(dx, dz)
    return (p[0] - dz / l * 1.5, p[1] + dx / l * 1.5)
def porte_ok(h, p):  # una porta = un bottone (borgo.ts RAGGIO 2,2 m): niente porte vicine, niente spawn davanti alla porta di un altro
    return all(math.dist(p, p2) >= 3 and math.dist(spawn(h, p), p2) >= 1.6 and math.dist(spawn(h2, p2), p) >= 1.6 for h2, p2 in case)
# una alla volta, quella più lontana dalle case già messe (fino a 10 celle), preferendo l'anello più vicino alla piazza
validi = [(pref, h, p) for pref, h, p in cand if get(*p) == '.' and p in paved]
while len(case) < CASE:
    best = None
    for pref, h, p in validi:
        if not (libero(*h) and porte_ok(h, p)): continue
        lontana = min([math.dist(h, h2) for h2, _ in case] + [10])
        v = lontana - 0.3 * pref
        if best is None or v > best[0]: best = (v, h, p)
    if not best: break
    case.append(best[1:])
if len(case) < CASE: sys.exit(f'solo {len(case)} case: allarga la città')
# numerazione: la 0 più vicina alla piazza, poi in giro (le case 0-7 sono di chi abitava già le isole)
case.sort(key=lambda c: (round(math.hypot(c[0][0] - C[0], c[0][1] - C[1]) / 6), (ang(*c[0]) - BAIA[1]) % 360))
for i, ((hx, hz), (px, pz)) in enumerate(case):
    put(hx, hz, 'L')
    dx, dz = px - hx, pz - hz
    slots.append({'at': [hx, hz], 'kind': TIPI[i % 3], 'rot': round(math.atan2(-dx, -dz), 2)})

# ——— il Grande Faro sulla riva ———
ra = math.radians(FARO[0])
faro = (C[0] + FARO[1] * math.cos(ra), C[1] - FARO[1] * math.sin(ra))
verso = math.atan2(C[0] - faro[0], C[1] - faro[1])           # la porta guarda la piazza
fronte = (faro[0] + 2.4 * math.sin(verso), faro[1] + 2.4 * math.cos(verso))
for c in (faro, fronte):
    if get(int(c[0]), int(c[1])) not in '.g': sys.exit(f'il Faro cade su {get(int(c[0]), int(c[1]))!r} in {c}')

# ——— vie in rettangoli (corse di celle per riga, unite tra righe uguali) ———
def rettangoli(cells):
    runs = {}
    for z in range(H):
        x = 0
        while x < W:
            if (x, z) in cells:
                x0 = x
                while (x, z) in cells: x += 1
                runs.setdefault((x0, x - 1), []).append(z)
            else: x += 1
    out = []
    for (x0, x1), zs in runs.items():
        zs.sort(); s = zs[0]
        for a, b in zip(zs, zs[1:] + [None]):
            if b != a + 1: out.append([x0, s, x1, a]); s = b
    return sorted(out, key=lambda r: (r[1], r[0]))
paved = {c for c in paved if get(*c) in '.PL'}

rows = [''.join(r) for r in grid]
props = [{**p, 'at': [round(p['at'][0] + SPOSTA[0], 2), round(p['at'][1] + SPOSTA[1], 2)]} for p in PIAZZA['props']]
porto = {'id': 'porto', 'nome': 'Borgo Marea', 'tile': 2, 'style': 'porto', 'scenery': 0.15, 'rows': rows,
         'paved': rettangoli(paved), 'slots': slots, 'props': props}


# ——— scrittura (a mano, nello stile dei file: una riga per elemento) ———
def riga(o): return json.dumps(o, ensure_ascii=False, separators=(', ', ': '))
def blocco_porto():
    L = ['  {', '    "id": "porto",', '    "nome": "Borgo Marea",', '    "tile": 2,', '    "style": "porto",', f'    "scenery": {porto["scenery"]},',
         '    "_pianta": "Generato da tools/borgo_pianta.py (#247): la piazza sta in tools/borgo_piazza.json, a +' + f'{SPOSTA[0]},{SPOSTA[1]}' + ' celle da qui.",', '    "rows": [']
    L += [f'      "{r}"' + (',' if i < len(rows) - 1 else '') for i, r in enumerate(rows)]
    L += ['    ],', '    "paved": [']
    pr = porto['paved']; per = 8
    L += ['      ' + ', '.join(riga(r) for r in pr[i:i + per]) + (',' if i + per < len(pr) else '') for i in range(0, len(pr), per)]
    L += ['    ],', '    "slots": [']
    L += ['      ' + riga(s).replace('{', '{ ', 1)[:-1] + ' }' + (',' if i < len(slots) - 1 else '') for i, s in enumerate(slots)]
    L += ['    ],', '    "props": [']
    L += ['      ' + riga(p).replace('{', '{ ', 1)[:-1] + ' }' + (',' if i < len(props) - 1 else '') for i, p in enumerate(props)]
    L += ['    ]', '  }']
    return '\n'.join(L)

isl = (CONTENT / 'islands.json').read_text()
blocchi = re.split(r'(?<=\n  \}),\n(?=  \{\n)', isl.strip()[1:-1].strip('\n'))
def bid(b): return re.search(r'"id": "([^"]+)"', b).group(1)
blocchi = [blocco_porto() if bid(b) == 'porto' else b for b in blocchi if bid(b) != 'borgo']
(CONTENT / 'islands.json').write_text('[\n' + ',\n'.join(blocchi) + '\n]\n')

bj = (CONTENT / 'borgo.json').read_text()
casej = ',\n'.join(f'    {{"at": [{h[0]},{h[1]}], "porta": [{p[0]},{p[1]}]}}' for h, p in case)
bj = re.sub(r'"case": \[.*?\n  \]', '"case": [\n' + casej + '\n  ]', bj, flags=re.S)
(CONTENT / 'borgo.json').write_text(bj)

pa = (CONTENT / 'porto_amici.json').read_text()
f2 = lambda v: round(v, 1)
pa = re.sub(r'("nome": "Grande Faro", "cartello": "GRANDE FARO", )"at": \[[^\]]*\], "rot": [-\d.]+, "fronte": \[[^\]]*\]',
            lambda m: m.group(1) + f'"at": [{f2(faro[0])}, {f2(faro[1])}], "rot": {round(verso, 2)}, "fronte": [{f2(fronte[0])}, {f2(fronte[1])}]', pa)
(CONTENT / 'porto_amici.json').write_text(pa)

print(f'porto {W}×{H} a {QUADRO[0]},{QUADRO[1]} (piazza +{SPOSTA[0]},+{SPOSTA[1]}), {len(case)} case, {len(porto["paved"])} rettangoli di via, faro {f2(faro[0])},{f2(faro[1])}')

if '--anteprima' in sys.argv:
    from PIL import Image, ImageDraw
    COL = {'~': '#2478A8', ',': '#7FE3E0', '.': '#E2B97F', 'g': '#8FC35B', 'r': '#7F7568', 'd': '#8E5A2B', 'P': '#E8433F', 'B': '#F5D547', 'L': '#8FC35B'}
    S = 8
    im = Image.new('RGB', (W * S, H * S)); dr = ImageDraw.Draw(im)
    for z in range(H):
        for x in range(W):
            c = '#B9AFA3' if (x, z) in paved else COL[grid[z][x]]
            dr.rectangle([x * S, z * S, x * S + S - 1, z * S + S - 1], fill=c)
    for s in slots:
        x, z = s['at']; d = (-math.sin(s['rot']), -math.cos(s['rot'])); t = (-d[1], d[0]); h = 1.5 * S
        cx, cz = (x + 0.5) * S, (z + 0.5) * S
        dr.polygon([(cx + (a * t[0] + b * d[0]) * h, cz + (a * t[1] + b * d[1]) * h) for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))],
                   fill='#F2A33A' if s['kind'] == 'tavolo' else '#5A3A1E', outline='#23201F')
    for i, (h, p) in enumerate(case):
        dr.ellipse([p[0] * S + 2, p[1] * S + 2, p[0] * S + S - 3, p[1] * S + S - 3], fill='#E8433F')
        dr.text((h[0] * S - 2, h[1] * S - 2), str(i), fill='#F4E3C1')
    dr.ellipse([(faro[0] - 1) * S, (faro[1] - 1) * S, (faro[0] + 1) * S, (faro[1] + 1) * S], fill='#F5D547', outline='#23201F')
    out = ROOT / 'tests/out/borgo_pianta.png'; out.parent.mkdir(exist_ok=True); im.save(out); print(out)
