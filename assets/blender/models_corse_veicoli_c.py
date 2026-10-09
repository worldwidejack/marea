# MAREA — veicoli dell'Isola delle Corse, gruppo c (#178). Vedi models_corse_veicoli.py per lo stile e docs/CORSE.md A6.
# Carrello della spesa, vasca da bagno, divano a motore, Ape car, struzzo, fetta di pizza.
# Davanti −Z, pivot a terra al centro, il pilota si aggiunge dopo (seduta libera).
import math
from lib import Mesh, Xf, beam, face, fix_winding
from corse_kit import C, ruota, sfera, volante, fascia, scatola_tonda, tubo_z, corpo_y


def _obj(m):
    return [m.build()]


# ---------------------------------------------------------------- attrezzi locali
def bx(m, x0, y0, z0, x1, y1, z1, col, top=None, bot=None, skip=()):
    """Parallelepipedo a colori della palette (il fondo manca se non lo chiedi)."""
    m.box(x0, y0, z0, x1, y1, z1, C(col), C(top) if top else None, C(bot) if bot else None, skip=skip)


def rod(m, p0, p1, t, col, n=4, caps=True, t2=None, cap=None):
    beam(m, p0, p1, t, t2 or t, C(col), end=(C(cap or col) if caps else None), n=n)


def anello(n, rx, rz, y, cx=0.0, cz=0.0, p=0.65):
    """Anello squadrato (superellisse) di n punti, per vasche e scafi."""
    pts = []
    for i in range(n):
        a = 2 * math.pi * (i + 0.5) / n
        c, s = math.cos(a), math.sin(a)
        pts.append((cx + rx * math.copysign(abs(c) ** p, c), y, cz + rz * math.copysign(abs(s) ** p, s)))
    return pts


def fascio(m, rings, reg, dentro=False, dirz=None):
    """Fasce tra anelli, sempre con le facce verso l'esterno (o l'interno se dentro=True)."""
    regs = reg if isinstance(reg, (list, tuple)) else [reg] * (len(rings) - 1)
    for k, (a, b) in enumerate(zip(rings, rings[1:])):
        n = len(a)
        cx = sum(p[0] for p in a) / n
        cz = sum(p[2] for p in a) / n
        for i in range(n):
            j = (i + 1) % n
            q = [a[i], a[j], b[j], b[i]]
            if dirz:
                h = dirz
            else:
                mx = sum(p[0] for p in q) / 4
                mz = sum(p[2] for p in q) / 4
                h = (mx - cx, 0, mz - cz)
                if dentro:
                    h = (-h[0], 0, -h[2])
            face(m, q, C(regs[k]), h)


def tappo(m, ring, col, su=True):
    face(m, list(ring), C(col), (0, 1 if su else -1, 0))


def vol(m, x, y, z, r=0.17, incl=-35, col='nero_caldo', colonna=0.3):
    """Volante a ottagono inclinato verso chi guida, piantone che scende in avanti."""
    m.push(Xf(t=(x, y, z), r=(incl, 0, 0)))
    pts = [(r * math.cos((i + 0.5) * math.pi / 4), r * math.sin((i + 0.5) * math.pi / 4), 0) for i in range(8)]
    for i in range(8):
        a, b = pts[i], pts[(i + 1) % 8]
        d = (b[0] - a[0], b[1] - a[1], 0)
        beam(m, (a[0] - d[0] * 0.15, a[1] - d[1] * 0.15, 0), (b[0] + d[0] * 0.15, b[1] + d[1] * 0.15, 0), 0.055, 0.055, C(col), end=None, n=6)
    beam(m, (-r * 0.9, 0, 0), (r * 0.9, 0, 0), 0.045, 0.045, C(col), end=None, n=6)
    beam(m, (0, 0, 0), (0, -r * 0.9, 0), 0.045, 0.045, C(col), end=None, n=6)
    m.pop()
    beam(m, (x, y - 0.03, z - 0.02), (x, max(0.3, y - colonna), z - 0.2), 0.05, 0.05, C('pietra_scura'), end=C('pietra_scura'), n=8)


def lastra(m, pts, col, nrm):
    """Vetro a due facce."""
    face(m, pts, C(col), nrm)
    face(m, list(reversed(pts)), C(col), tuple(-c for c in nrm))


def vasca_anello(m, cx, cy, cz, r, t, n=8, a=0.0, colori=('rosso', 'pietra_chiara')):
    """Salvagente sul fianco x: spicchi alternati rosso/bianco nel piano YZ."""
    pts = [(cx, cy + r * math.cos(a + 2 * math.pi * i / n), cz + r * math.sin(a + 2 * math.pi * i / n)) for i in range(n)]
    for i in range(n):
        p, q = pts[i], pts[(i + 1) % n]
        d = (q[0] - p[0], q[1] - p[1], q[2] - p[2])
        beam(m, (p[0], p[1] - d[1] * 0.12, p[2] - d[2] * 0.12), (q[0], q[1] + d[1] * 0.12, q[2] + d[2] * 0.12), t, t, C(colori[i % 2]), end=None, n=6)


def sf(m, x, y, z, rx, ry, rz, col, n=10, rings=4):
    """Palla/ellissoide con colore della palette."""
    if max(rx, ry, rz) < 0.1:                 # le palline piccole non servono fitte
        n, rings = min(n, 8), min(rings, 2)
    sfera(m, x, y, z, rx, ry, rz, C(col), n=n, rings=rings)


def blob(m, x0, y0, z0, x1, y1, z1, col, r=0.08, b=None, seg=2):
    """Cuscino/scatola gonfia: sezione tonda lungo Z e testate smussate (nessuno spigolo vivo)."""
    w, h = x1 - x0, y1 - y0
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    r = min(r, w / 2 - 0.002, h / 2 - 0.002)
    b = r * 0.9 if b is None else b
    b = min(b, (z1 - z0) / 2 - 0.004, w / 2 - 0.004, h / 2 - 0.004)
    rb = max(r * 0.5, 0.01)
    tubo_z(m, [(z0, cx, cy, w - 2 * b, h - 2 * b, rb), (z0 + b, cx, cy, w, h, r), (z1 - b, cx, cy, w, h, r), (z1, cx, cy, w - 2 * b, h - 2 * b, rb)], C(col), seg)


def tubo(m, sezioni, col, seg=2):
    tubo_z(m, sezioni, C(col), seg)


def vetro_curvo(m, righe, bulge, col, nrm, segs=6, indietro=False):
    """Vetro bombato: righe = [(y, z, mezza_larghezza)] dal basso in alto; il centro sporge di `bulge`."""
    griglia = []
    for (y, z, hw) in righe:
        riga = []
        for i in range(segs + 1):
            u = -1 + 2 * i / segs
            riga.append((u * hw, y, z + (1 if indietro else -1) * bulge * (1 - u * u)))
        griglia.append(riga)
    for a, b in zip(griglia, griglia[1:]):
        for i in range(segs):
            lastra(m, [a[i], a[i + 1], b[i + 1], b[i]], col, nrm)


# ---------------------------------------------------------------- carrello della spesa
def cs_v_carrello_spesa():
    """Carrello della spesa a motore: cestello a griglia, bandierina rossa, motorino dietro (versione morbida)."""
    m = Mesh('cs_v_carrello_spesa')
    G, GC = 'pietra', 'pietra_chiara'
    # telaio basso: tubi tondi con gomiti a palla
    for s in (-1, 1):
        rod(m, (s * 0.4, 0.36, -0.8), (s * 0.4, 0.36, 0.62), 0.085, G, n=8)
        sf(m, s * 0.4, 0.36, -0.8, 0.055, 0.055, 0.055, G, n=8, rings=2)
        sf(m, s * 0.4, 0.36, 0.62, 0.055, 0.055, 0.055, G, n=8, rings=2)
    rod(m, (-0.64, 0.24, -0.8), (0.64, 0.24, -0.8), 0.08, G, n=8)
    rod(m, (-0.64, 0.28, 0.55), (0.64, 0.28, 0.55), 0.09, 'pietra_scura', n=8)
    # fondo del cestello, gonfio
    blob(m, -0.4, 0.45, -0.9, 0.4, 0.52, 0.32, GC, r=0.03, b=0.04, seg=1)
    # lati a griglia: sbarre tonde che si aprono verso l'alto
    zs = (-0.84, -0.6, -0.36, -0.12, 0.1, 0.32)
    for s in (-1, 1):
        for z in zs:
            rod(m, (s * 0.4, 0.5, z), (s * 0.56, 1.1, z), 0.04, GC, n=4, caps=False)
        rod(m, (s * 0.56, 1.1, -0.9), (s * 0.56, 1.1, 0.32), 0.075, GC, n=8)
        rod(m, (s * 0.48, 0.8, -0.9), (s * 0.48, 0.8, 0.32), 0.04, G, n=4, caps=False)
        rod(m, (s * 0.44, 0.65, -0.9), (s * 0.44, 0.65, 0.32), 0.04, G, n=4, caps=False)
    for x in (-0.36, -0.2, -0.06, 0.06, 0.2, 0.36):
        rod(m, (x * 0.9, 0.5, -0.9), (x * 1.4, 1.1, -0.9), 0.04, GC, n=4, caps=False)
    rod(m, (-0.56, 1.1, -0.9), (0.56, 1.1, -0.9), 0.075, GC, n=8)
    rod(m, (-0.47, 0.8, -0.9), (0.47, 0.8, -0.9), 0.04, G, n=4, caps=False)
    rod(m, (-0.44, 0.65, -0.9), (0.44, 0.65, -0.9), 0.04, G, n=4, caps=False)
    # angoli rossi davanti: palle di gomma
    for s in (-1, 1):
        sf(m, s * 0.56, 1.1, -0.9, 0.1, 0.1, 0.1, 'rosso', n=8, rings=3)
    # sedile nero dentro, imbottito
    blob(m, -0.3, 0.5, -0.12, 0.3, 0.62, 0.3, 'nero_caldo', r=0.06, b=0.05, seg=1)
    blob(m, -0.3, 0.6, 0.2, 0.3, 1.02, 0.34, 'nero_caldo', r=0.07, b=0.06, seg=1)
    # montanti e manico rosso dietro
    for s in (-1, 1):
        rod(m, (s * 0.54, 1.08, 0.3), (s * 0.5, 1.32, 0.66), 0.075, GC, n=8)
        sf(m, s * 0.5, 1.32, 0.66, 0.065, 0.065, 0.065, GC, n=8, rings=2)
    rod(m, (-0.5, 1.32, 0.66), (0.5, 1.32, 0.66), 0.09, 'rosso', n=10)
    for s in (-1, 1):
        sf(m, s * 0.52, 1.32, 0.66, 0.1, 0.1, 0.1, 'rosso', n=10, rings=3)
    # asta e bandierina
    rod(m, (0.0, 0.7, 0.66), (0.0, 2.1, 0.66), 0.05, GC, n=8)
    sf(m, 0.0, 2.12, 0.66, 0.04, 0.04, 0.04, GC, n=8, rings=2)
    pts = [(0.0, 2.1, 0.66), (0.58, 1.99, 0.66), (0.4, 1.9, 0.66), (0.58, 1.8, 0.66), (0.0, 1.76, 0.66)]
    lastra(m, pts, 'rosso', (0, 0, 1))
    # motorino dietro
    blob(m, -0.26, 0.34, 0.42, 0.26, 0.64, 0.8, 'nero_caldo', r=0.12, b=0.1)
    blob(m, -0.22, 0.6, 0.46, 0.22, 0.8, 0.76, 'rosso', r=0.1, b=0.08)
    rod(m, (0.3, 0.46, 0.6), (0.5, 0.46, 0.6), 0.2, 'giallo', n=10)
    sf(m, 0.52, 0.46, 0.6, 0.06, 0.1, 0.1, 'giallo', n=8, rings=3)
    rod(m, (-0.1, 0.5, 0.8), (-0.1, 0.5, 0.96), 0.09, 'pietra', n=8)
    sf(m, -0.1, 0.5, 0.98, 0.06, 0.06, 0.05, 'pietra_scura', n=8, rings=2)
    # ruote
    for s in (-1, 1):
        ruota(m, s * 0.64, -0.8, r=0.24, larga=0.2)
        ruota(m, s * 0.66, 0.55, r=0.3, larga=0.26)
    return _obj(m)


# ---------------------------------------------------------------- vasca da bagno
def cs_v_vasca():
    """Vasca da bagno ovale con bordo tondo e piedini a zampa, paperella, salvagente e fuoribordo rosso."""
    m = Mesh('cs_v_vasca')
    W, B = 'pietra_chiara', 'acqua_profonda'
    N, Pw = 16, 0.88
    R0 = anello(N, 0.40, 0.86, 0.2, p=Pw)
    R1 = anello(N, 0.49, 0.95, 0.5, p=Pw)
    R2 = anello(N, 0.55, 1.03, 0.75, p=Pw)
    R3 = anello(N, 0.585, 1.08, 0.9, p=Pw)
    R4 = anello(N, 0.6, 1.095, 0.96, p=Pw)        # pancia del bordo arrotondato
    R5 = anello(N, 0.55, 1.05, 1.01, p=Pw)         # cresta
    R6 = anello(N, 0.49, 0.99, 0.97, p=Pw)
    R7 = anello(N, 0.455, 0.955, 0.86, p=Pw)
    R8 = anello(N, 0.37, 0.83, 0.4, p=Pw)
    fascio(m, [R0, R1, R2, R3, R4], [B, W, W, W])
    tappo(m, R0, B, su=False)
    fascio(m, [R4, R5, R6], W, dirz=(0, 1, 0))
    fascio(m, [R6, R7, R8], 'pietra', dentro=True)
    tappo(m, R8, 'pietra')
    # piedini a zampa: gamba tonda + palla
    for sx in (-1, 1):
        for sz in (-1, 1):
            x, z = sx * 0.3, sz * 0.58
            rod(m, (x, 0.3, z), (x, 0.12, z), 0.17, W, n=8)
            sf(m, x, 0.1, z, 0.13, 0.1, 0.13, W, n=8, rings=3)
    # panchetta del pilota e ponte di prua, gonfi
    blob(m, -0.3, 0.34, -0.12, 0.3, 0.56, 0.42, W, r=0.09, b=0.08)
    blob(m, -0.3, 0.34, -0.92, 0.3, 0.62, -0.5, W, r=0.1, b=0.1)
    # paperella gialla di prua
    sf(m, 0, 0.84, -0.7, 0.22, 0.2, 0.27, 'giallo', n=10, rings=4)
    sf(m, 0, 1.12, -0.8, 0.14, 0.14, 0.14, 'giallo', n=10, rings=4)
    sf(m, 0, 1.06, -0.96, 0.085, 0.04, 0.11, 'arancio', n=10, rings=3)
    sf(m, 0, 1.1, -0.93, 0.075, 0.025, 0.08, 'arancio', n=8, rings=2)
    sf(m, 0, 0.9, -0.44, 0.04, 0.09, 0.07, 'giallo', n=8, rings=2)       # codina
    for s in (-1, 1):
        sf(m, s * 0.12, 1.16, -0.92, 0.03, 0.03, 0.03, 'nero_caldo', n=6, rings=2)
        sf(m, s * 0.22, 0.82, -0.7, 0.03, 0.09, 0.14, 'giallo', n=8, rings=2)      # alette
    # volante
    vol(m, 0, 1.0, -0.3, 0.16, incl=-30, colonna=0.4)
    # salvagente sul fianco destro
    vasca_anello(m, 0.62, 0.64, 0.15, 0.23, 0.12, n=10, a=math.pi / 10)
    # fuoribordo appeso al bordo dietro
    blob(m, -0.15, 0.82, 0.86, 0.15, 0.98, 1.12, 'pietra_scura', r=0.07, b=0.05, seg=1)       # morsa sul bordo
    blob(m, -0.22, 0.96, 0.84, 0.22, 1.3, 1.2, 'rosso', r=0.12, b=0.1)                  # cofano
    blob(m, -0.2, 0.96, 0.86, 0.2, 1.06, 1.18, 'nero_caldo', r=0.05, b=0.05, seg=1)
    rod(m, (0.0, 0.3, 1.14), (0.0, 0.98, 1.14), 0.14, 'roccia', n=8)                    # gambo
    sf(m, 0, 0.27, 1.14, 0.2, 0.06, 0.1, 'pietra', n=10, rings=2)                      # elica
    rod(m, (0.0, 1.16, 0.84), (0.0, 1.22, 0.55), 0.07, 'nero_caldo', n=8)              # barra del timone
    sf(m, 0.0, 1.22, 0.53, 0.06, 0.06, 0.06, 'nero_caldo', n=8, rings=2)
    return _obj(m)


# ---------------------------------------------------------------- divano a motore
def cs_v_divano():
    """Divano marrone imbottito con volante, fari tondi gialli, paraurti e tubo di scappamento."""
    m = Mesh('cs_v_divano')
    S, SC = 'legno', 'legno_chiaro'
    # telaio
    blob(m, -0.46, 0.28, -0.95, 0.46, 0.44, 0.85, 'roccia', r=0.07, b=0.06, seg=1)
    # paraurti e fari tondi
    blob(m, -0.46, 0.3, -1.06, 0.46, 0.5, -0.9, 'pietra', r=0.1, b=0.08, seg=1)
    blob(m, -0.22, 0.34, -1.12, 0.22, 0.46, -1.02, 'pietra_scura', r=0.05, b=0.04, seg=1)
    for s in (-1, 1):
        rod(m, (s * 0.38, 0.63, -0.94), (s * 0.38, 0.63, -1.02), 0.24, 'pietra_chiara', n=12)
        sf(m, s * 0.38, 0.63, -1.03, 0.1, 0.1, 0.05, 'giallo', n=10, rings=3)
    # base imbottita
    blob(m, -0.55, 0.42, -0.64, 0.55, 0.7, 0.74, S, r=0.12, b=0.1)
    # braccioli a rotolo: tubi grossi con la testa tonda davanti
    for s in (-1, 1):
        blob(m, s * 0.45 - 0.12, 0.62, -0.7, s * 0.45 + 0.12, 1.0, 0.78, SC, r=0.12, b=0.1, seg=2)
        sf(m, s * 0.45, 0.82, -0.7, 0.11, 0.17, 0.05, S, n=10, rings=3)
    # cuscini del sedile e schienale alto in due pezzi, tutti gonfi
    for s in (-1, 1):
        x0, x1 = (0.01, 0.34) if s > 0 else (-0.34, -0.01)
        blob(m, x0, 0.66, -0.6, x1, 0.86, 0.36, S, r=0.09, b=0.09)
        b0, b1 = (0.01, 0.5) if s > 0 else (-0.5, -0.01)
        m.push(Xf(t=(0, 0.68, 0.5), r=(10, 0, 0)))
        blob(m, b0, 0.0, -0.15, b1, 0.86, 0.15, S, r=0.15, b=0.11, seg=2)
        m.pop()
    # volante
    vol(m, 0, 1.0, -0.3, 0.17, incl=-35, colonna=0.35)
    # scappamento: sale da dietro a destra e si piega, con giunti tondi
    rod(m, (0.5, 0.5, 0.78), (0.5, 0.5, 1.0), 0.13, 'pietra', n=8)
    rod(m, (0.5, 0.5, 1.0), (0.5, 1.7, 1.0), 0.14, 'pietra', n=8)
    sf(m, 0.5, 0.5, 1.0, 0.075, 0.075, 0.075, 'pietra', n=10, rings=3)
    sf(m, 0.5, 1.7, 1.0, 0.08, 0.08, 0.08, 'pietra', n=10, rings=3)
    rod(m, (0.5, 1.7, 1.0), (0.64, 1.95, 0.9), 0.15, 'pietra', n=8)
    rod(m, (0.64, 1.95, 0.9), (0.72, 2.08, 0.84), 0.22, 'pietra_scura', n=8)
    for y in (0.9, 1.4):
        rod(m, (0.45, y, 1.0), (0.55, y, 1.0), 0.2, 'pietra_scura', n=8)
    # ruote
    for s in (-1, 1):
        ruota(m, s * 0.66, -0.74, r=0.27, larga=0.24)
        ruota(m, s * 0.68, 0.58, r=0.32, larga=0.26)
    return _obj(m)


# ---------------------------------------------------------------- Ape car
def cs_v_ape():
    """Ape car a tre ruote: cabina azzurra con tetto bombato e vetri curvi, cassone di legno, faro tondo davanti."""
    m = Mesh('cs_v_ape')
    A, T, L = 'acqua_profonda', 'pietra_chiara', 'acqua'
    blob(m, -0.5, 0.3, -0.8, 0.5, 0.44, 1.05, 'nero_caldo', r=0.07, b=0.06, seg=1)
    # ruota davanti con parafango tondo
    ruota(m, 0.0, -0.98, r=0.27, larga=0.2)
    tubo(m, [(-1.2, 0, 0.57, 0.34, 0.14, 0.07), (-0.98, 0, 0.66, 0.52, 0.22, 0.11), (-0.74, 0, 0.6, 0.48, 0.16, 0.08)], L, 1)
    for s in (-1, 1):
        rod(m, (s * 0.2, 0.3, -0.98), (s * 0.2, 0.62, -0.98), 0.05, L, n=6)
    # scudo davanti: muso tondo che si allarga verso la cabina
    tubo(m, [(-0.98, 0, 0.84, 0.74, 0.34, 0.17), (-0.86, 0, 0.78, 0.96, 0.56, 0.22), (-0.62, 0, 0.7, 1.16, 0.56, 0.22)], A, 2)
    # faro tondo e frecce
    rod(m, (0.0, 0.88, -1.06), (0.0, 0.88, -0.94), 0.27, T, n=12)
    sf(m, 0.0, 0.88, -1.07, 0.1, 0.1, 0.05, 'giallo', n=10, rings=3)
    for s in (-1, 1):
        sf(m, s * 0.37, 0.86, -0.97, 0.06, 0.06, 0.05, 'arancio', n=8, rings=2)
    # cabina: fiancate arrotondate
    tubo(m, [(-0.64, 0, 0.7, 1.16, 0.56, 0.22), (0.0, 0, 0.7, 1.2, 0.56, 0.22), (0.22, 0, 0.7, 1.16, 0.54, 0.2)], A, 2)
    for s in (-1, 1):
        blob(m, s * 0.6 - 0.02, 0.5, -0.5, s * 0.6 + 0.04, 0.54, 0.15, L, r=0.02, b=0.02, seg=1)   # modanatura
        rod(m, (s * 0.61, 0.65, -0.12), (s * 0.61, 0.65, 0.0), 0.05, T, n=6)                       # maniglia
        rod(m, (s * 0.54, 1.0, -0.62), (s * 0.5, 1.64, -0.5), 0.09, T, n=8)                        # montante anteriore
        rod(m, (s * 0.56, 0.98, 0.18), (s * 0.56, 1.64, 0.18), 0.09, T, n=8)                       # montante posteriore
        rod(m, (s * 0.58, 1.1, -0.6), (s * 0.7, 1.12, -0.7), 0.04, 'pietra_scura', n=6)            # specchietto
        sf(m, s * 0.7, 1.13, -0.73, 0.04, 0.08, 0.07, 'pietra_scura', n=8, rings=2)
    # parabrezza e lunotto bombati
    vetro_curvo(m, [(1.0, -0.64, 0.52), (1.31, -0.57, 0.51), (1.62, -0.5, 0.5)], 0.09, 'acqua_bassa', (0, 0.35, -1), segs=4)
    vetro_curvo(m, [(1.0, 0.2, 0.5), (1.62, 0.2, 0.5)], 0.05, 'acqua_bassa', (0, 0, 1), indietro=True, segs=4)
    # tetto bianco bombato
    tubo(m, [(-0.78, 0, 1.64, 1.2, 0.1, 0.05), (-0.62, 0, 1.69, 1.32, 0.15, 0.07), (-0.1, 0, 1.73, 1.36, 0.19, 0.09), (0.34, 0, 1.65, 1.22, 0.1, 0.05)], T, 2)
    # sedile e volante
    blob(m, -0.4, 0.42, -0.14, 0.4, 0.6, 0.16, 'roccia', r=0.08, b=0.06, seg=1)
    blob(m, -0.4, 0.56, 0.08, 0.4, 1.1, 0.2, 'roccia', r=0.1, b=0.05, seg=1)
    vol(m, 0, 1.12, -0.4, 0.17, incl=-50, colonna=0.35)
    # cassone di legno
    blob(m, -0.62, 0.5, 0.22, 0.62, 0.6, 1.12, 'legno', r=0.04, b=0.03, seg=1)
    for s in (-1, 1):
        blob(m, s * 0.62 - 0.04, 0.58, 0.22, s * 0.62 + 0.04, 0.98, 1.12, 'legno', r=0.04, b=0.03, seg=1)
        bx(m, s * 0.62 - 0.045, 0.74, 0.24, s * 0.62 + 0.045, 0.78, 1.1, 'legno_scuro')
    blob(m, -0.62, 0.58, 1.08, 0.62, 0.98, 1.16, 'legno', r=0.04, b=0.03, seg=1)
    bx(m, -0.6, 0.74, 1.08, 0.6, 0.78, 1.165, 'legno_scuro')
    # ruote dietro con parafanghi tondi
    for s in (-1, 1):
        ruota(m, s * 0.66, 0.72, r=0.28, larga=0.24)
        tubo(m, [(0.4, s * 0.66, 0.58, 0.3, 0.12, 0.05), (0.72, s * 0.66, 0.67, 0.34, 0.2, 0.09), (1.04, s * 0.66, 0.58, 0.3, 0.12, 0.05)], L, 1)
    return _obj(m)


# ---------------------------------------------------------------- struzzo
def cs_v_struzzo():
    """Struzzo da cavalcare: corpo tondo di piume, collo a cilindro, testa sferica, gambe rosa, sella e manubrio."""
    m = Mesh('cs_v_struzzo')
    PEL, PEL2 = 'sabbia', 'sabbia_chiara'
    by = 0.86                                   # quota del centro del corpo
    # corpo piumato, grosso e tondo
    sf(m, 0, by, 0.1, 0.55, 0.45, 0.74, 'nero_caldo', n=12, rings=5)
    sf(m, 0, by - 0.12, 0.02, 0.5, 0.32, 0.6, 'roccia', n=10, rings=3)       # pancia piu chiara
    # ali tonde sui fianchi con punte bianche
    for s in (-1, 1):
        sf(m, s * 0.5, by + 0.02, 0.18, 0.12, 0.25, 0.5, 'roccia', n=10, rings=3)
        sf(m, s * 0.55, by - 0.02, 0.66, 0.1, 0.19, 0.2, 'pietra_chiara', n=8, rings=2)
    # coda: ciuffo di piume bianche a goccia, in su e indietro
    for ang, dx in ((-34, -0.3), (-12, -0.1), (12, 0.1), (34, 0.3)):
        m.push(Xf(t=(dx * 0.5, by + 0.14, 0.8), r=(52, 0, ang)))
        sfera(m, 0, 0.26, 0, 0.1, 0.34, 0.1, C('pietra_chiara'), n=6, rings=3)
        m.pop()
    # collare bianco alla base del collo
    sf(m, 0, by + 0.28, -0.54, 0.25, 0.2, 0.22, 'pietra_chiara', n=10, rings=3)
    # collo a cilindri e testa sferica
    sf(m, 0, by + 0.3, -0.54, 0.12, 0.12, 0.12, PEL, n=10, rings=2)
    rod(m, (0, by + 0.3, -0.54), (0, by + 0.95, -0.72), 0.2, PEL, n=10)
    sf(m, 0, by + 0.95, -0.72, 0.11, 0.11, 0.11, PEL, n=10, rings=3)
    rod(m, (0, by + 0.95, -0.72), (0, by + 1.5, -0.84), 0.16, PEL, n=10)
    sf(m, 0, by + 1.6, -0.9, 0.2, 0.18, 0.2, PEL2, n=10, rings=4)
    sf(m, 0, by + 1.55, -1.18, 0.09, 0.05, 0.19, 'arancio', n=10, rings=3)    # becco
    sf(m, 0, by + 1.6, -1.12, 0.08, 0.03, 0.12, 'arancio', n=8, rings=2)
    for s in (-1, 1):
        sf(m, s * 0.15, by + 1.66, -1.0, 0.04, 0.05, 0.04, 'nero_caldo', n=6, rings=2)
    # gambe lunghe rosa con ginocchio avanti e piedi a tre dita tonde
    for s in (-1, 1):
        x = s * 0.26
        rod(m, (x, by + 0.02, 0.1), (x, 0.46, -0.14), 0.18, PEL, n=8)
        sf(m, x, 0.46, -0.16, 0.11, 0.11, 0.11, PEL, n=8, rings=3)               # ginocchio
        rod(m, (x, 0.46, -0.14), (x, 0.07, 0.06), 0.14, PEL, n=8)
        sf(m, x, 0.07, 0.07, 0.09, 0.07, 0.09, PEL, n=8, rings=2)
        rod(m, (x, 0.07, 0.1), (x, 0.07, -0.42), 0.12, PEL, n=4)
        rod(m, (x, 0.07, 0.1), (x + s * 0.22, 0.07, -0.36), 0.12, PEL, n=4)
        rod(m, (x, 0.07, 0.1), (x - s * 0.18, 0.07, -0.34), 0.12, PEL, n=4)
    # sella di cuoio col pomolo, cantale e staffe
    t = by + 0.4                               # dorso del corpo
    blob(m, -0.27, t - 0.06, -0.24, 0.27, t + 0.08, 0.38, 'legno', r=0.07, b=0.07, seg=1)
    sf(m, 0, t + 0.12, -0.26, 0.09, 0.09, 0.09, 'legno', n=8, rings=3)
    blob(m, -0.27, t + 0.03, 0.28, 0.27, t + 0.2, 0.4, 'legno', r=0.07, b=0.05)
    for s in (-1, 1):
        blob(m, s * 0.31 - 0.04, t - 0.4, -0.14, s * 0.31 + 0.04, t - 0.02, 0.3, 'legno_chiaro', r=0.04, b=0.03, seg=1)
        rod(m, (s * 0.35, t - 0.3, 0.0), (s * 0.35, t - 0.44, 0.0), 0.04, 'pietra', n=6)
        sf(m, s * 0.35, t - 0.48, 0.0, 0.05, 0.05, 0.1, 'pietra_scura', n=8, rings=2)
    # manubrio sul collo
    rod(m, (0, t - 0.1, -0.54), (0, t + 0.5, -0.6), 0.08, 'pietra', n=8)
    rod(m, (-0.34, t + 0.52, -0.6), (0.34, t + 0.52, -0.6), 0.08, 'legno', n=8)
    for s in (-1, 1):
        rod(m, (s * 0.26, t + 0.52, -0.6), (s * 0.4, t + 0.52, -0.6), 0.11, 'nero_caldo', n=8)
        sf(m, s * 0.41, t + 0.52, -0.6, 0.06, 0.06, 0.06, 'nero_caldo', n=8, rings=2)
    return _obj(m)


# ---------------------------------------------------------------- fetta di pizza
def cs_v_pizza():
    """Fetta di pizza da corsa: punta tonda davanti, cornicione cilindrico dietro, pomodori e basilico."""
    m = Mesh('cs_v_pizza')
    y0, y1 = 0.36, 0.56
    zt, zr = -1.15, 0.66
    ht, hr = 0.12, 0.58
    # contorno della fetta (x, z): punta con arco tondo, lati dritti, dietro largo
    rt = 0.16
    cz = zt + 0.177
    arco = []
    for k in range(9):
        a = math.radians(-76 + 152 * k / 8)
        arco.append((rt * math.sin(a), cz - rt * math.cos(a)))
    contorno = [(-hr, zr)] + arco + [(hr, zr)]
    gx, gz = 0.0, -0.2

    def anello_p(f, y):
        return [(gx + (x - gx) * f, y, gz + (z - gz) * f) for (x, z) in contorno]
    rb, rm, rt_ = anello_p(1.0, y0), anello_p(1.0, y1 - 0.05), anello_p(0.95, y1)
    n = len(contorno)
    for (a, b, reg) in ((rb, rm, 'sabbia'), (rm, rt_, 'giallo')):
        for i in range(n):
            j = (i + 1) % n
            q = [a[i], a[j], b[j], b[i]]
            mx = sum(p[0] for p in q) / 4
            mz = sum(p[2] for p in q) / 4
            face(m, q, C(reg), (mx - gx, 0.15 if reg == 'giallo' else 0, mz - gz))
    face(m, rt_, C('giallo'), (0, 1, 0))
    face(m, rb, C('sabbia'), (0, -1, 0))
    # formaggio colato che sgocciola sul bordo: gocce tonde
    for s in (-1, 1):
        for (z, l) in ((-0.7, 0.14), (-0.1, 0.11), (0.4, 0.16)):
            hw = ht + (z - zt) / (zr - zt) * (hr - ht)
            sf(m, s * (hw - 0.01), y1 - l / 2 - 0.03, z, 0.045, l / 2 + 0.04, 0.075, 'arancio', n=8, rings=3)
    # pomodori (dischi rossi bombati) e basilico
    for (x, z, r) in ((-0.1, -0.7, 0.12), (0.18, -0.35, 0.17), (-0.3, -0.05, 0.19), (0.38, 0.12, 0.15), (-0.02, 0.1, 0.13), (-0.38, 0.45, 0.12), (0.2, 0.45, 0.14)):
        sf(m, x, y1 - 0.005, z, r, 0.07, r, 'rosso', n=10, rings=3)
    for (x, z) in ((0.04, -0.95), (-0.28, -0.4), (0.3, -0.05), (-0.15, 0.3), (0.5, 0.4), (-0.5, 0.15), (0.0, 0.5), (0.08, -0.6)):
        sf(m, x, y1 + 0.01, z, 0.065, 0.03, 0.05, 'erba_scura', n=6, rings=2)
    # cornicione arrotolato dietro: cilindro con fasce e testate tonde
    rod(m, (-0.58, 0.62, 0.78), (0.58, 0.62, 0.78), 0.48, 'legno_chiaro', n=16, caps=False)
    for s in (-1, 1):
        sf(m, s * 0.58, 0.62, 0.78, 0.1, 0.24, 0.24, 'legno', n=12, rings=3)
    for x in (-0.3, 0.3):
        rod(m, (x - 0.025, 0.62, 0.78), (x + 0.025, 0.62, 0.78), 0.5, 'legno', n=16)
    # assi di legno sotto, tonde
    rod(m, (-0.52, 0.27, -0.74), (0.52, 0.27, -0.74), 0.08, 'legno', n=8)
    rod(m, (-0.66, 0.3, 0.4), (0.66, 0.3, 0.4), 0.08, 'legno', n=8)
    rod(m, (0.0, 0.27, -0.74), (0.0, 0.3, 0.4), 0.08, 'legno', n=8)
    # volante
    vol(m, 0, 1.0, -0.2, 0.17, incl=-40, colonna=0.4)
    for s in (-1, 1):
        ruota(m, s * 0.5, -0.74, r=0.25, larga=0.22)
        ruota(m, s * 0.72, 0.4, r=0.33, larga=0.26)
    return _obj(m)


MODELS = {
    'cs_v_carrello_spesa': cs_v_carrello_spesa,
    'cs_v_vasca': cs_v_vasca,
    'cs_v_divano': cs_v_divano,
    'cs_v_ape': cs_v_ape,
    'cs_v_struzzo': cs_v_struzzo,
    'cs_v_pizza': cs_v_pizza,
}
