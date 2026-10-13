#!/usr/bin/env python3
"""Borgo Marea: il Porto e le 30 case in un'isola sola.

#247 (Jack, 12 ott 2026): la piazza del Porto (tools/borgo_piazza.json, il vecchio template `porto` 44×38) resta dov'era nel mondo;
attorno c'è la città, a sud resta aperta la baia col molo, e sulla punta del braccio a sud-ovest c'è il Grande Faro.
#265 (Riccardo, 13 ott 2026): pianta «a vicoli», più piccola e fitta. Un anello di via attorno alla piazza (con le vie che portano in
piazza) e vicoli stretti che scendono alla riva; le case stanno a schiera sui due lati, una ogni due celle, con la porta sulla via.
Lo script mette anche l'arredo del borgo nei `props`: lampioni, festoni tra le case dei vicoli, vaso e cassetta della posta a ogni porta,
siepi attorno alla piazza, alberi a gruppetti, fontana e panchine negli slarghi. Tutto deterministico: rigenerare dà lo stesso borgo.

Riscrive: islands.json (template `porto`), borgo.json (`case`), porto_amici.json (`faro`), gente.json (`giro` dei paesani). Il riquadro
del template è fisso (QUADRO): le celle della piazza stanno sempre a +SPOSTA da come erano nel vecchio Porto, così rigenerare non sposta
niente di quello che sta nelle celle del Porto (Mercante, Bacheca, Grotta, gente, posti dei minigiochi).
Attenzione: rigenerare sovrascrive il template `porto` di islands.json; le modifiche alla piazza si fanno in borgo_piazza.json.

  python tools/borgo_pianta.py              riscrive i contenuti
  python tools/borgo_pianta.py --anteprima  in più tests/out/borgo_pianta.png (vista dall'alto)
"""
import json, math, random, re, struct, sys, zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / 'packages/content/src'
PIAZZA = json.loads((ROOT / 'tools/borgo_piazza.json').read_text(encoding='utf-8'))

PORTO_AT = (110, 120)            # dove stava il vecchio Porto nel mondo (celle): la piazza resta lì
QUADRO = (88, 92, 166, 180)      # riquadro del template nel mondo [x0, z0, x1, z1): a est la Laguna parte da x 170 (4 celle di mare tra i riquadri)
SPOSTA = (PORTO_AT[0] - QUADRO[0], PORTO_AT[1] - QUADRO[1])
W, H = QUADRO[2] - QUADRO[0], QUADRO[3] - QUADRO[1]
C = (SPOSTA[0] + 22, SPOSTA[1] + 16)   # centro della piazza (il tavolo delle sfide), in celle del template

R_TERRA = 23.5                   # raggio della città (prima 39)
BAIA = (255, 335)                # gradi (0 = est, 90 = nord, 270 = sud): qui resta il mare, col molo del Porto
ANELLO = 15                      # la via che gira attorno alla piazza (larga due celle), appena fuori dai banchi
RAGGI = [180, 130, 80, 30, 230]  # vie dalla piazza all'anello
LUNGO = 21                       # il lungomare: la via sulla riva (larga una cella e mezza)
RIONI = [20, 115, 210]           # tre rioni di case a schiera (centro, gradi), larghi ±RIONE: tra l'uno e l'altro slarghi e giardini
RIONE = 22
VICOLI = [20, 115, 210, 65, 162, 345, 245]   # vicoli (una cella) dall'anello al lungomare: in mezzo ai rioni, agli slarghi e ai capi
SLARGHI = [65, 162]              # tra un rione e l'altro: slargo con la fontana
CASE = 30
FARO = (250, 21)                 # angolo e raggio del Grande Faro: in punta al braccio a sud-ovest, sulla bocca della baia
# posti fissi della piazza (celle del template): lì niente case né arredo. Grotta (game/ingressi.ts), Mercante, Bacheca, Furetto (gente.json),
# Tabellone (porto_amici.json), Consegne e Ingorgo (minigames/*.json)
POSTI = [(54, 35, 3.5), (40, 43.4, 2), (48, 43.6, 2), (53.2, 38.4, 2), (35.6, 46.2, 2), (40, 56, 2.5), (48, 56, 2.5)]
PAESANI = ['nella', 'tonio', 'bice', 'gaspare', 'ada_fiori']   # gente.json: il loro `giro` lo scrive lo script (lungo l'anello e i vicoli)
rnd = random.Random(265)


def ang(x, z):
    return math.degrees(math.atan2(-(z - C[1]), x - C[0])) % 360


def in_citta(a):
    return not (BAIA[0] <= a <= BAIA[1])


def terra(x, z):
    return in_citta(ang(x, z)) and math.hypot(x - C[0], z - C[1]) <= R_TERRA


def verso(a):  # versore (x, z) dell'angolo a (z cresce verso sud)
    ra = math.radians(a)
    return (math.cos(ra), -math.sin(ra))


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

# ——— vie: l'anello, le vie verso la piazza, i vicoli verso la riva, gli slarghi ———
anello, vicoli = set(), {}
def via(x, z):
    if get(x, z) in '~,rd': return False
    if get(x, z) == 'g': put(x, z, '.')
    paved.add((x, z)); return True
for z in range(H):
    for x in range(W):
        if get(x, z) in '~,' or not in_citta(ang(x, z)): continue
        px, pz = x - C[0], z - C[1]
        r = math.hypot(px, pz)
        if abs(r - ANELLO) < 1.0 and via(x, z): anello.add((x, z))
        if abs(r - LUNGO) < 0.8: via(x, z)
        for a in RAGGI:
            dx, dz = verso(a)
            if 5 < px * dx + pz * dz <= ANELLO and abs(px * dz - pz * dx) < 1.1: via(x, z)
        for a in VICOLI:
            dx, dz = verso(a)
            if ANELLO < px * dx + pz * dz <= LUNGO and abs(px * dz - pz * dx) < 0.55 and via(x, z): vicoli.setdefault(a, set()).add((x, z))
slarghi = []
for a in SLARGHI:
    dx, dz = verso(a)
    sx, sz = C[0] + (ANELLO + 1.5) * dx, C[1] + (ANELLO + 1.5) * dz
    for z in range(int(sz) - 3, int(sz) + 4):
        for x in range(int(sx) - 3, int(sx) + 4):
            if math.hypot(x - sx, z - sz) < 2.3: via(x, z)
    slarghi.append((a, sx, sz))

# gli edifici della piazza che stanno sopra una via nuova se ne vanno
def impronta(x, z): return [(x + dx, z + dz) for dx in (-1, 0, 1) for dz in (-1, 0, 1)]
slots = []
for s in PIAZZA['slots']:
    X, Z = SPOSTA[0] + s['at'][0], SPOSTA[1] + s['at'][1]
    if s['kind'] != 'tavolo' and any(c in paved for c in impronta(X, Z)): put(X, Z, 'g'); continue
    slots.append({'at': [X, Z], 'kind': s['kind'], 'rot': s['rot']})

# ——— case: nei rioni, due file schiena contro schiena (una guarda l'anello, una il lungomare), una casa ogni due celle ———
def rione(a):
    for i, c in enumerate(RIONI):
        if abs((a - c + 180) % 360 - 180) <= RIONE: return i
    return None
cand = []   # (preferenza, casa, porta, rione)
for rh, rp in ((ANELLO + 2.0, ANELLO + 0.6), (LUNGO - 2.0, LUNGO - 0.4)):
    n = int(2 * math.pi * rh * 2)
    for i in range(n):
        a = 360 * i / n
        if rione(a) is None: continue
        dx, dz = verso(a)
        h = (round(C[0] + rh * dx), round(C[1] + rh * dz))
        p = (round(C[0] + rp * dx), round(C[1] + rp * dz))
        cand.append((rh, h, p, rione(a)))
case = []   # (casa, porta, dove)
def libero(x, z):
    if get(x, z) != 'g' or (x, z) in paved: return False
    if any(get(cx, cz) in '~,rd' for cx, cz in impronta(x, z)): return False
    if not all(max(abs(hx - x), abs(hz - z)) >= 2 for (hx, hz), _, _ in case): return False
    if any(math.hypot(x + 0.5 - px, z + 0.5 - pz) < r + 1.2 for px, pz, r in POSTI): return False
    return all(abs(s['at'][0] - x) >= 4 or abs(s['at'][1] - z) >= 4 for s in slots)
def fuori(h, p):  # dove si nasce uscendo di casa: un passo fuori dalla porta, sulla via (borgo.ts portaDi)
    dx, dz = p[0] - h[0], p[1] - h[1]; l = math.hypot(dx, dz)
    return (p[0] + dx / l * 0.5, p[1] + dz / l * 0.5)
def porte_ok(h, p):  # porte ad almeno due celle l'una dall'altra; uscendo di casa la porta più vicina è la tua
    if p not in paved or get(*p) not in '.P' or p == h: return False
    return all(math.dist(p, p2) >= 2 and math.dist(fuori(h, p), p2) > math.dist(fuori(h, p), p) + 0.6 for h2, p2, _ in case)
validi = [c for c in cand if get(*c[2]) == '.']
# una alla volta: vince quella che allunga una schiera (vicina di due celle a una casa già messa), poi la più vicina alla piazza
while len(case) < CASE:
    best = None
    for pref, h, p, dove in validi:
        if not (libero(*h) and porte_ok(h, p)): continue
        vicine = sum(1 for (hx, hz), _, _ in case if max(abs(hx - h[0]), abs(hz - h[1])) == 2)
        # di fronte: dall'altra parte della stessa via (porte vicine, case che si guardano)
        fronte_ = any(math.dist(p, p2) < 2.6 and (p[0] - h[0]) * (p2[0] - h2[0]) + (p[1] - h[1]) * (p2[1] - h2[1]) < 0 for h2, p2, _ in case)
        nel_rione = sum(1 for _, _, r in case if r == dove)
        v = 3 * min(vicine, 1) + 2 * fronte_ - 0.1 * pref - 0.6 * nel_rione + rnd.random() * 0.1
        if best is None or v > best[0]: best = (v, h, p, dove)
    if not best: break
    case.append(best[1:])
if len(case) < CASE: sys.exit(f'solo {len(case)} case: allarga la città')
# numerazione: la 0 più vicina alla piazza, poi in giro (le case 0-7 sono di chi abitava già le isole)
case.sort(key=lambda c: (round(math.hypot(c[0][0] - C[0], c[0][1] - C[1]) / 4), (ang(*c[0]) - BAIA[1]) % 360))
def larga(i):  # casa_b è larga 4,5 m: solo dove le vicine stanno ad almeno tre celle
    (hx, hz), _, _ = case[i]
    return all(max(abs(hx - x), abs(hz - z)) >= 3 for j, ((x, z), _, _) in enumerate(case) if j != i)
for i, ((hx, hz), (px, pz), _) in enumerate(case):
    put(hx, hz, 'L')
    dx, dz = px - hx, pz - hz
    tipo = 'casa_b' if larga(i) else ('casa_a', 'casa_c')[i % 2]
    slots.append({'at': [hx, hz], 'kind': tipo, 'rot': round(math.atan2(-dx, -dz), 2)})

# ——— il Grande Faro sulla riva ———
dfx, dfz = verso(FARO[0])
faro = (C[0] + FARO[1] * dfx, C[1] + FARO[1] * dfz)
verso_faro = math.atan2(C[0] - faro[0], C[1] - faro[1])           # la porta guarda la piazza
fronte = (faro[0] + 2.4 * math.sin(verso_faro), faro[1] + 2.4 * math.cos(verso_faro))
for c in (faro, fronte):
    if get(int(c[0]), int(c[1])) not in '.g': sys.exit(f'il Faro cade su {get(int(c[0]), int(c[1]))!r} in {c}')

# ——— arredo del borgo (props, in celle del template; pivot al centro della decorazione) ———
arredo = []
occupati = [(h[0], h[1], 1.2) for h, _, _ in case] + [(p[0], p[1], 0.9) for _, p, _ in case] + [(s['at'][0], s['at'][1], 2.2) for s in slots[:1]]
occupati += [(s['at'][0], s['at'][1], 1.6) for s in slots if s['kind'].startswith('casa') and list(s['at']) not in [list(h) for h, _, _ in case]]
occupati += [(faro[0], faro[1], 3.0), (fronte[0], fronte[1], 1.5)] + POSTI
for p in PIAZZA['props']: occupati.append((p['at'][0] + SPOSTA[0], p['at'][1] + SPOSTA[1], 1.0))
def posto_libero(x, z, r=0.8):
    return all(math.hypot(x - ox, z - oz) >= r + orr for ox, oz, orr in occupati) and get(int(x), int(z)) in '.g'
def metti(k, x, z, rot=0.0, r=0.6):
    arredo.append({'k': k, 'at': [round(x, 2), round(z, 2)], 'rot': round(rot, 2)}); occupati.append((x, z, r))

# a ogni porta: vaso di fiori da un lato, cassetta della posta dall'altro (sulla facciata, verso la via)
for (hx, hz), (px, pz), _ in case:
    dx, dz = px - hx, pz - hz; l = math.hypot(dx, dz); dx, dz = dx / l, dz / l; tx, tz = -dz, dx
    rot = math.atan2(-dx, -dz)
    cx, cz = hx + 0.5 + dx * 0.75, hz + 0.5 + dz * 0.75
    arredo.append({'k': 'cassetta_posta', 'at': [round(cx + tx * 0.8, 2), round(cz + tz * 0.8, 2)], 'rot': round(rot, 2)})
    arredo.append({'k': 'vaso_fiori', 'at': [round(cx - tx * 0.8, 2), round(cz - tz * 0.8, 2)], 'rot': round(rot, 2)})
# slarghi: fontana al centro, panchine attorno che la guardano
for a, sx, sz in slarghi:
    metti('fontana', sx + 0.5, sz + 0.5, 0, 1.6)
    for da in (60, -60, 180):
        dx, dz = verso(a + da)
        bx, bz = sx + 0.5 + 2.0 * dx, sz + 0.5 + 2.0 * dz
        if posto_libero(bx, bz, 0.5): metti('panchina', bx, bz, math.atan2(dx, dz), 0.6)
# lampioni lungo l'anello, a lati alterni, uno ogni ~10° (≈ 4 celle), dove non c'è una casa o una porta
lato = 1
for i in range(36):
    a = i * 10 + 3
    if not in_citta(a): continue
    for l in (lato, -lato):
        dx, dz = verso(a)
        x, z = C[0] + 0.5 + (ANELLO + 1.35 * l) * dx, C[1] + 0.5 + (ANELLO + 1.35 * l) * dz
        if posto_libero(x, z, 0.6): metti('lampioncino', x, z, 0, 0.6); lato = -l; break
# vicoli: un festone di lampadine da una casa all'altra ogni tre celle, un lampioncino in fondo verso il mare
for a in VICOLI:
    dx, dz = verso(a)
    for s in [ANELLO + 3 + 3 * k for k in range(4)]:
        x, z = C[0] + 0.5 + s * dx, C[1] + 0.5 + s * dz
        if not terra(int(x), int(z)): break
        if math.hypot(x - C[0] - 0.5, z - C[1] - 0.5) > LUNGO - 1.5: break
        arredo.append({'k': 'filo_borgo', 'at': [round(x, 2), round(z, 2)], 'rot': round(math.atan2(dx, dz), 2)})
    for s in range(LUNGO - 1, ANELLO, -1):
        x, z = C[0] + 0.5 + s * dx + 0.9 * -dz, C[1] + 0.5 + s * dz + 0.9 * dx
        if get(int(x), int(z)) in '.g' and posto_libero(x, z, 0.5): metti('lampioncino', x, z, 0, 0.6); break
# siepi sul bordo interno dell'anello, dove davanti non c'è una casa (incorniciano la piazza); interrotte dalle vie
for i in range(int(2 * math.pi * (ANELLO - 1.6) / 1.2)):
    a = 360 * i / int(2 * math.pi * (ANELLO - 1.6) / 1.2)
    if not in_citta(a): continue
    dx, dz = verso(a)
    x, z = C[0] + 0.5 + (ANELLO - 1.6) * dx, C[1] + 0.5 + (ANELLO - 1.6) * dz
    if (int(x), int(z)) in paved or not posto_libero(x, z, 0.45): continue
    if any(math.hypot(x - (C[0] + 0.5 + q * verso(r)[0]), z - (C[1] + 0.5 + q * verso(r)[1])) < 1.8 for r in RAGGI for q in (ANELLO - 3, ANELLO - 1.6)): continue
    metti('siepe', x, z, math.atan2(dx, dz), 0.45)
# alberi a gruppetti di 2-3 sul prato libero tra le schiere (lontani da vie, case e porte)
semi = [(x, z) for z in range(H) for x in range(W) if get(x, z) == 'g' and (x, z) not in paved and terra(x, z)
        and math.hypot(x - C[0], z - C[1]) > ANELLO - 6 and not any((x + dx, z + dz) in paved for dx in (-1, 0, 1) for dz in (-1, 0, 1))]
rnd.shuffle(semi)
gruppi = 0
for x, z in semi:
    if gruppi >= 14: break
    if not posto_libero(x + 0.5, z + 0.5, 2.0): continue
    gruppi += 1
    for j in range(rnd.choice((2, 3))):
        ox, oz = x + 0.5 + rnd.uniform(-1.1, 1.1), z + 0.5 + rnd.uniform(-1.1, 1.1)
        if posto_libero(ox, oz, 0.7): metti('albero_tondo', ox, oz, rnd.uniform(0, 6.28), 0.9)

# ——— paesani: un giro avanti e indietro lungo un pezzo d'anello o un vicolo (celle del template, centro cella) ———
giri = {}
tratti = [(VICOLI[0], 'vicolo'), (40, ANELLO), (115, LUNGO), (190, ANELLO), (VICOLI[4], 'vicolo')]
for nome, (a, dove) in zip(PAESANI, tratti):
    if dove == 'vicolo':
        dx, dz = verso(a)
        g = [[round(C[0] + 0.5 + s * dx, 2), round(C[1] + 0.5 + s * dz, 2)] for s in (ANELLO, LUNGO)]
    else:
        g = []
        for b in (a - 14, a + 14):
            dx, dz = verso(b); g.append([round(C[0] + 0.5 + dove * dx, 2), round(C[1] + 0.5 + dove * dz, 2)])
    giri[nome] = g

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
props = [{**p, 'at': [round(p['at'][0] + SPOSTA[0], 2), round(p['at'][1] + SPOSTA[1], 2)]} for p in PIAZZA['props']] + arredo
porto = {'id': 'porto', 'nome': 'Borgo Marea', 'tile': 2, 'style': 'porto', 'scenery': 0.35, 'rows': rows,
         'paved': rettangoli(paved), 'slots': slots, 'props': props}


# ——— scrittura (a mano, nello stile dei file: una riga per elemento) ———
def riga(o): return json.dumps(o, ensure_ascii=False, separators=(', ', ': '))
def blocco_porto():
    L = ['  {', '    "id": "porto",', '    "nome": "Borgo Marea",', '    "tile": 2,', '    "style": "porto",', f'    "scenery": {porto["scenery"]},',
         '    "_pianta": "Generato da tools/borgo_pianta.py (#247, vicoli #265): la piazza sta in tools/borgo_piazza.json, a +' + f'{SPOSTA[0]},{SPOSTA[1]}' + ' celle da qui.",', '    "rows": [']
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

def leggi(p): return p.read_text(encoding='utf-8')
def scrivi(p, s): p.write_bytes(s.replace('\r\n', '\n').encode('utf-8'))

isl = leggi(CONTENT / 'islands.json').replace('\r\n', '\n')
blocchi = re.split(r'(?<=\n  \}),\n(?=  \{\n)', isl.strip()[1:-1].strip('\n'))
def bid(b): return re.search(r'"id": "([^"]+)"', b).group(1)
blocchi = [blocco_porto() if bid(b) == 'porto' else b for b in blocchi if bid(b) != 'borgo']
scrivi(CONTENT / 'islands.json', '[\n' + ',\n'.join(blocchi) + '\n]\n')

bj = leggi(CONTENT / 'borgo.json').replace('\r\n', '\n')
casej = ',\n'.join(f'    {{"at": [{h[0]},{h[1]}], "porta": [{p[0]},{p[1]}]}}' for h, p, _ in case)
bj = re.sub(r'"case": \[.*?\n  \]', lambda m: '"case": [\n' + casej + '\n  ]', bj, flags=re.S)
scrivi(CONTENT / 'borgo.json', bj)

pa = leggi(CONTENT / 'porto_amici.json').replace('\r\n', '\n')
f2 = lambda v: round(v, 1)
pa = re.sub(r'("nome": "Grande Faro", "cartello": "GRANDE FARO", )"at": \[[^\]]*\], "rot": [-\d.]+, "fronte": \[[^\]]*\]',
            lambda m: m.group(1) + f'"at": [{f2(faro[0])}, {f2(faro[1])}], "rot": {round(verso_faro, 2)}, "fronte": [{f2(fronte[0])}, {f2(fronte[1])}]', pa)
scrivi(CONTENT / 'porto_amici.json', pa)

ge = leggi(CONTENT / 'gente.json').replace('\r\n', '\n')
for nome, g in giri.items():
    ge = re.sub(r'("id": "' + nome + r'".*?"giro": )\[\[.*?\]\]', lambda m: m.group(1) + json.dumps(g, separators=(', ', ', ')).replace('], [', '], ['), ge, count=1, flags=re.S)
scrivi(CONTENT / 'gente.json', ge)

print(f'porto {W}×{H} a {QUADRO[0]},{QUADRO[1]} (piazza +{SPOSTA[0]},+{SPOSTA[1]}), {len(case)} case '
      f'(per rione {[sum(1 for c in case if c[2] == i) for i in range(len(RIONI))]}), {len(porto["paved"])} rettangoli di via, {len(arredo)} pezzi d\'arredo, faro {f2(faro[0])},{f2(faro[1])}')


# ——— anteprima dall'alto (PNG scritto a mano: niente dipendenze) ———
def png(path, w, h, pix):
    raw = b''.join(b'\x00' + bytes(pix[y * w * 3:(y + 1) * w * 3]) for y in range(h))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    path.write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))

if '--anteprima' in sys.argv:
    S = 8
    COL = {'~': '#2478A8', ',': '#7FE3E0', '.': '#E2B97F', 'g': '#8FC35B', 'r': '#7F7568', 'd': '#8E5A2B', 'P': '#E8433F', 'B': '#F5D547', 'L': '#8FC35B'}
    PROP = {'lampioncino': '#F5D547', 'filo_borgo': '#F2A33A', 'cassetta_posta': '#E8433F', 'vaso_fiori': '#C86FD8', 'siepe': '#2F6B3A',
            'albero_tondo': '#2F6B3A', 'fontana': '#7FE3E0', 'panchina': '#8E5A2B'}
    pix = bytearray(W * S * H * S * 3)
    def rect(x0, y0, x1, y1, col):
        c = bytes.fromhex(col[1:])
        for y in range(max(0, int(y0)), min(H * S, int(y1))):
            for x in range(max(0, int(x0)), min(W * S, int(x1))): pix[(y * W * S + x) * 3:(y * W * S + x) * 3 + 3] = c
    for z in range(H):
        for x in range(W): rect(x * S, z * S, x * S + S, z * S + S, '#B9AFA3' if (x, z) in paved else COL[grid[z][x]])
    for s in slots:
        x, z = s['at']; w2 = 2.2 if s['kind'] == 'casa_b' else (2 if s['kind'] == 'tavolo' else 1.2)
        rect((x + 0.5 - w2 / 2) * S, (z + 0.5 - 0.55) * S, (x + 0.5 + w2 / 2) * S, (z + 0.5 + 0.55) * S, '#5A3A1E' if s['kind'] != 'tavolo' else '#F2A33A')
    for _, (px, pz), _ in case: rect(px * S + 3, pz * S + 3, px * S + S - 3, pz * S + S - 3, '#E8433F')
    for p in props:
        if p['k'] in PROP:
            x, z = p['at']; r = 3 if p['k'] in ('albero_tondo', 'fontana') else 1
            rect(x * S - r, z * S - r, x * S + r + 1, z * S + r + 1, PROP[p['k']])
    rect((faro[0] - 1) * S, (faro[1] - 1) * S, (faro[0] + 1) * S, (faro[1] + 1) * S, '#F5D547')
    out = ROOT / 'tests/out/borgo_pianta.png'; out.parent.mkdir(exist_ok=True); png(out, W * S, H * S, pix); print(out)
