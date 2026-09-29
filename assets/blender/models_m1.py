# M1 · Fetta 1 — edifici L2/L3, cantiere, prop del molo, kit del Porto, facciate.
# Convenzioni come models_edifici.py: coordinate di gioco (y su, davanti −Z), pivot a terra al centro, 300-800 tri
# per gli edifici. Lo stesso edificio cresce: L2 più alto e più ricco, L3 con tetto di rame verde, pilastri laccati,
# ornamenti d'oro (il «segno» del livello massimo, uguale per tutta la famiglia, leggibile dall'alto).
import math
from lib import Mesh, Xf, beam, face, roof, log
from atlas import h01
from models_edifici import lantern


def _obj(m, **info):
    return ([m.build()], info) if info else [m.build()]


FP = lambda w, d: {'footprint': [w, d]}  # impronta a terra in metri (x, z), per il manifest


# ------------------------------------------------------------------ aiuti
def lantern_lite(m, x, y, z, r=0.12, h=0.26, n=6, cord=0.12):
    """Lanterna di carta economica (~38 tri): corpo emissivo a botte, tappi scuri, cordino."""
    a = m.ring(n, r * 0.62, y - h / 2, cx=x, cz=z)
    b = m.ring(n, r, y, cx=x, cz=z)
    c = m.ring(n, r * 0.62, y + h / 2, cx=x, cz=z)
    m.loft([a, b, c], 'em_lanterna', mat='mat_emissivo')
    m.poly(list(reversed(c)), 'nero_lacca')
    m.poly(list(a), 'nero_lacca')
    if cord:
        beam(m, (x, y + h / 2, z), (x, y + h / 2 + cord, z), 0.02, 0.02, 'corda', n=3)


def walls(m, x0, x1, z0, z1, y0, y1, side, front=None, back=None):
    """Quattro pareti (senza tetto né fondo); `front`/`back` cambiano la regione di quelle facce."""
    face(m, [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)], front or side, (0, 0, -1))
    face(m, [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], back or side, (0, 0, 1))
    face(m, [(x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0)], side, (-1, 0, 0))
    face(m, [(x1, y0, z0), (x1, y0, z1), (x1, y1, z1), (x1, y1, z0)], side, (1, 0, 0))


def gables(m, x0, x1, z0, z1, y0, yr, reg='tavole_scure'):
    zc = (z0 + z1) / 2
    for x, sx in ((x0, -1), (x1, 1)):
        face(m, [(x, y0, z0), (x, y0, z1), (x, yr, zc)], reg, (sx, 0, 0))


def win(m, x, y0, y1, z, w, n, reg='em_finestra'):
    """Finestra piatta su una parete: n = normale (asse ±x o ±z)."""
    if abs(n[2]) > 0.5:
        zz = z + 0.012 * n[2]
        face(m, [(x - w / 2, y0, zz), (x + w / 2, y0, zz), (x + w / 2, y1, zz), (x - w / 2, y1, zz)], reg, n, mat='mat_emissivo' if reg.startswith('em_') else None)
    else:
        xx = x + 0.012 * n[0]
        face(m, [(xx, y0, z - w / 2), (xx, y0, z + w / 2), (xx, y1, z + w / 2), (xx, y1, z - w / 2)], reg, n, mat='mat_emissivo' if reg.startswith('em_') else None)


def posts(m, pts, y0, y1, w=0.12, reg='legno_scuro', end=None):
    for x, z in pts:
        beam(m, (x, y0, z), (x, y1, z), w, w, reg, end=end)


def skirt(m, x0, x1, z0, z1, yt, yb, out, top='tegole', edge='nero_lacca', t=0.07):
    """Tettoia a quattro falde attorno a un piano (mokoshi): dal muro a quota yt fino alla gronda yb sporgente di out."""
    X0, X1, Z0, Z1 = x0 - out, x1 + out, z0 - out, z1 + out
    face(m, [(x0, yt, z0), (x1, yt, z0), (X1, yb, Z0), (X0, yb, Z0)], top, (0, 1, -0.6))
    face(m, [(x0, yt, z1), (x1, yt, z1), (X1, yb, Z1), (X0, yb, Z1)], top, (0, 1, 0.6))
    face(m, [(x0, yt, z0), (x0, yt, z1), (X0, yb, Z1), (X0, yb, Z0)], top, (-0.6, 1, 0))
    face(m, [(x1, yt, z0), (x1, yt, z1), (X1, yb, Z1), (X1, yb, Z0)], top, (0.6, 1, 0))
    for (a, b, n) in (((X0, Z0), (X1, Z0), (0, 0, -1)), ((X0, Z1), (X1, Z1), (0, 0, 1)), ((X0, Z0), (X0, Z1), (-1, 0, 0)), ((X1, Z0), (X1, Z1), (1, 0, 0))):
        face(m, [(a[0], yb, a[1]), (b[0], yb, b[1]), (b[0], yb - t, b[1]), (a[0], yb - t, a[1])], edge, n)


def hip(m, x0, x1, z0, z1, ye, yr, top='tegole', edge='nero_lacca', t=0.09, curl=0.14, ridge='nero_lacca', finial=None):
    """Tetto a padiglione con angoli rialzati (curl). Colmo lungo il lato più lungo; `finial` = regione del pinnacolo."""
    cx, cz, hw, hd = (x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (z1 - z0) / 2
    if hw >= hd:
        A, B = (cx - (hw - hd), yr, cz), (cx + (hw - hd), yr, cz)
    else:
        A, B = (cx, yr, cz - (hd - hw)), (cx, yr, cz + (hd - hw))
    ec = ye + curl
    c00, c10, c11, c01 = (x0, ec, z0), (x1, ec, z0), (x1, ec, z1), (x0, ec, z1)
    mf, mb, ml, mr = (cx, ye, z0), (cx, ye, z1), (x0, ye, cz), (x1, ye, cz)
    same = abs(hw - hd) < 1e-4
    # davanti / dietro
    for c_a, mid, c_b, n in ((c00, mf, c10, (0, 1, -0.7)), (c01, mb, c11, (0, 1, 0.7))):
        if hw >= hd:
            face(m, [c_a, mid, A], top, n); face(m, [mid, c_b, B], top, n)
            if not same:
                face(m, [mid, B, A], top, n)
        else:
            apex = A if n[2] < 0 else B
            face(m, [c_a, mid, apex], top, n); face(m, [mid, c_b, apex], top, n)
    for c_a, mid, c_b, n in ((c00, ml, c01, (-0.7, 1, 0)), (c10, mr, c11, (0.7, 1, 0))):
        if hw >= hd:
            apex = A if n[0] < 0 else B
            face(m, [c_a, mid, apex], top, n); face(m, [mid, c_b, apex], top, n)
        else:
            face(m, [c_a, mid, A], top, n); face(m, [mid, c_b, B], top, n)
            if not same:
                face(m, [mid, B, A], top, n)
    # fascia di gronda
    for a, mid, b, n in ((c00, mf, c10, (0, 0, -1)), (c01, mb, c11, (0, 0, 1)), (c00, ml, c01, (-1, 0, 0)), (c10, mr, c11, (1, 0, 0))):
        for p, q in ((a, mid), (mid, b)):
            face(m, [p, q, (q[0], q[1] - t, q[2]), (p[0], p[1] - t, p[2])], edge, n)
    if ridge and not same:
        beam(m, (A[0], yr + 0.02, A[2]), (B[0], yr + 0.02, B[2]), 0.1, 0.08, ridge, end=ridge)
    if finial:
        m.prism(6, 0.07, 0.02, yr, yr + 0.45, finial, cx=cx, cz=cz)
        m.prism(6, 0.12, 0.12, yr + 0.12, yr + 0.18, finial, top=finial, bottom=finial, cx=cx, cz=cz)


def railing(m, pts, y0, y1, reg='legno_scuro', w=0.05):
    """Ringhiera: montanti ai vertici e corrimano tra un vertice e l'altro."""
    for p in pts:
        beam(m, (p[0], y0, p[1]), (p[0], y1, p[1]), w, w, reg)
    for p, q in zip(pts, pts[1:]):
        beam(m, (p[0], y1, p[1]), (q[0], y1, q[1]), w, w, reg)


def noren(m, x, y1, z, w, h, reg='noren_blu'):
    """Tenda corta sulla porta (davanti −Z), due facce."""
    for zz, n in ((z - 0.03, (0, 0, -1)), (z - 0.02, (0, 0, 1))):
        face(m, [(x - w / 2, y1 - h, zz), (x + w / 2, y1 - h, zz), (x + w / 2, y1, zz), (x - w / 2, y1, zz)], reg, n, uv='fit')
    beam(m, (x - w / 2 - 0.05, y1, z - 0.04), (x + w / 2 + 0.05, y1, z - 0.04), 0.03, 0.03, 'legno_scuro', n=3)


def sign(m, x0, x1, y0, y1, z, reg, n=(0, 0, -1), back='legno_scuro', t=0.04):
    """Insegna piatta con spessore (UV «fit» sulla regione)."""
    sz = n[2]
    face(m, [(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], reg, n, uv='fit')
    face(m, [(x0, y0, z - sz * t), (x1, y0, z - sz * t), (x1, y1, z - sz * t), (x0, y1, z - sz * t)], back, (0, 0, -sz))
    face(m, [(x0, y1, z), (x1, y1, z), (x1, y1, z - sz * t), (x0, y1, z - sz * t)], back, (0, 1, 0))


def rock_wall(m, H, W=1.0, D=0.8, z=0.15, seed=0):
    """Parete di roccia sfaccettata (come la cava L1), alta H, fronte piatto verso −Z."""
    sq = [(1, 0), (1, 0.6), (0.75, 1), (0, 1), (-0.75, 1), (-1, 0.6), (-1, 0)]
    def ring(y, k, s):
        return [(x * (0.95 - k * (0.6 + 0.8 * h01(i, s + seed, 11))) * W, y + (h01(i, s + seed, 12) - 0.5) * 0.2,
                 z + zz * (D - k * (0.6 + 0.8 * h01(i, s + seed, 11)))) for i, (x, zz) in enumerate(sq)]
    ys = [0, H * 0.3, H * 0.55, H * 0.78, H * 0.93]
    ks = [0.0, 0.06, 0.14, 0.24, 0.42]
    rings = [ring(y, k, i + 1) for i, (y, k) in enumerate(zip(ys, ks))]
    for a, b in zip(rings, rings[1:]):
        for i in range(len(sq) - 1):
            face(m, [a[i], a[i + 1], b[i + 1], b[i]], 'roccia_lato', (a[i][0] + a[i + 1][0], 0.2, a[i][2] + a[i + 1][2] - z * 2))
    top = (0.0, H * 1.08, z + 0.2)
    for i in range(len(sq) - 1):
        face(m, [rings[-1][i], rings[-1][i + 1], top], 'roccia', (0, 1, 0.2))
    face(m, [rings[0][0], rings[0][-1]] + [r[-1] for r in rings[1:]] + [top] + [r[0] for r in reversed(rings[1:])], 'roccia', (0, 0, -1))


def wheel(m, cx, cy, cz, r, w, paddles=8):
    """Ruota ad acqua con asse lungo X."""
    m.push(Xf(t=(cx, cy, cz), r=(0, 0, 90)))
    m.prism(8, r * 0.82, r * 0.82, -w / 2, w / 2, 'legno_scuro', top='legno_pieno', bottom='legno_pieno', a0=0)
    m.prism(6, 0.07, 0.07, -w / 2 - 0.2, w / 2 + 0.05, 'ferro', a0=0)
    m.pop()
    for i in range(paddles):
        a = 2 * math.pi * i / paddles
        y, z = cy + math.sin(a) * r * 0.9, cz + math.cos(a) * r * 0.9
        m.push(Xf(t=(cx, y, z), r=(-math.degrees(a), 0, 0)))
        m.box(-w / 2 - 0.02, -0.03, -0.14, w / 2 + 0.02, 0.03, 0.14, 'tavole', skip=('bottom',))
        m.pop()


def stone_lantern(m, x, z, s=1.0):
    """Tōrō di pietra (lanterna da giardino): base, fusto, camera accesa, cappello."""
    m.prism(4, 0.14 * s, 0.14 * s, 0, 0.08 * s, 'pietra_p', top='pietra_liscia', cx=x, cz=z)
    m.prism(4, 0.06 * s, 0.06 * s, 0.08 * s, 0.42 * s, 'pietra_p', cx=x, cz=z)
    m.prism(4, 0.1 * s, 0.1 * s, 0.42 * s, 0.58 * s, 'em_lanterna', mat='mat_emissivo', cx=x, cz=z)
    m.cone(4, 0.18 * s, 0.58 * s, 0.78 * s, 'pietra_p', bottom='pietra_liscia', cx=x, cz=z)


# ------------------------------------------------------------------ CASA
def bld_casa_l2():
    m = Mesh('bld_casa_l2')
    m.box(-0.95, 0, -0.95, 0.95, 0.25, 0.95, 'pietra_muro', top='pietra_liscia', skip=('bottom',))
    m.box(-0.35, 0, -1.08, 0.35, 0.12, -0.95, 'pietra_muro', top='pietra_liscia', skip=('bottom', 'back'))
    x0, x1, z0, z1, y0, y1 = -0.78, 0.78, -0.74, 0.74, 0.25, 1.55
    walls(m, x0, x1, z0, z1, y0, y1, 'tavole_scure', front='carta')
    face(m, [(-0.32, y0 + 0.02, z0 - 0.02), (0.08, y0 + 0.02, z0 - 0.02), (0.08, 1.35, z0 - 0.02), (-0.32, 1.35, z0 - 0.02)], 'em_finestra', (0, 0, -1), mat='mat_emissivo')
    noren(m, -0.12, 1.42, z0, 0.56, 0.36, 'noren_blu')
    for sx in (-1, 1):
        win(m, sx * x1, 0.75, 1.2, 0.0, 0.6, (sx, 0, 0))
    posts(m, [(x, z) for x in (x0, x1) for z in (z0, z1)], 0.25, 1.62)
    skirt(m, x0, x1, z0, z1, 1.62, 1.4, 0.26)
    # primo piano, un po' più stretto, intonaco chiaro con balconcino
    X0, X1, Z0, Z1, Y0, Y1 = -0.66, 0.66, -0.58, 0.62, 1.62, 2.6
    walls(m, X0, X1, Z0, Z1, Y0, Y1, 'intonaco', front='carta')
    win(m, 0.0, 1.95, 2.4, Z0, 0.8, (0, 0, -1))
    win(m, X0, 1.95, 2.35, 0.05, 0.45, (-1, 0, 0))
    posts(m, [(x, z) for x in (X0, X1) for z in (Z0, Z1)], Y0, 2.65, w=0.1)
    gables(m, X0, X1, Z0, Z1, Y1, 3.12)
    roof(m, -0.92, 0.92, 0.02, 0.88, 2.48, 3.22, curl=0.2)
    m.box(-0.66, 1.62, -0.88, 0.66, 1.68, -0.58, 'tavole', skip=('bottom', 'back'))
    railing(m, [(-0.64, -0.86), (0.64, -0.86)], 1.68, 1.95)
    # due lanterne alla gronda, vaso, barile
    lantern_lite(m, 0.6, 1.18, -1.02)
    lantern_lite(m, -0.6, 1.18, -1.02)
    m.prism(6, 0.12, 0.16, 0.25, 0.45, 'pietra_p', top='terra', cx=0.62, cz=-0.8)
    m.cone(5, 0.14, 0.45, 0.75, 'erba_alta', cx=0.62, cz=-0.8)
    m.prism(8, 0.16, 0.16, 0.0, 0.42, 'barile', top='acqua_bassa', cx=-0.95, cz=0.75)
    return _obj(m, **FP(2, 2))


def bld_casa_l3():
    m = Mesh('bld_casa_l3')
    m.box(-1.0, 0, -1.0, 1.0, 0.3, 1.0, 'pietra_muro', top='pietra_liscia', skip=('bottom',))
    m.box(-0.4, 0, -1.12, 0.4, 0.15, -1.0, 'pietra_muro', top='pietra_liscia', skip=('bottom', 'back'))
    x0, x1, z0, z1, y0, y1 = -0.8, 0.8, -0.72, 0.76, 0.3, 1.55
    walls(m, x0, x1, z0, z1, y0, y1, 'tavole_scure', front='carta')
    face(m, [(-0.3, y0 + 0.02, z0 - 0.02), (0.3, y0 + 0.02, z0 - 0.02), (0.3, 1.35, z0 - 0.02), (-0.3, 1.35, z0 - 0.02)], 'em_finestra', (0, 0, -1), mat='mat_emissivo')
    noren(m, 0.0, 1.42, z0, 0.66, 0.36, 'noren_rosso')
    for sx in (-1, 1):
        win(m, sx * x1, 0.75, 1.2, 0.0, 0.7, (sx, 0, 0))
    posts(m, [(x, z) for x in (x0, x1) for z in (z0, z1)], 0.3, 1.6, reg='legno_lacca')
    skirt(m, x0, x1, z0, z1, 1.6, 1.38, 0.28, top='tegole_rame')
    # primo piano con balcone
    X0, X1, Z0, Z1, Y0, Y1 = -0.66, 0.66, -0.56, 0.62, 1.6, 2.5
    walls(m, X0, X1, Z0, Z1, Y0, Y1, 'intonaco', front='carta')
    win(m, 0.0, 1.85, 2.3, Z0, 0.9, (0, 0, -1))
    for sx in (-1, 1):
        win(m, sx * X1, 1.85, 2.25, 0.05, 0.4, (sx, 0, 0))
    posts(m, [(x, z) for x in (X0, X1) for z in (Z0, Z1)], Y0, 2.55, w=0.1, reg='legno_lacca')
    m.box(-0.7, 1.6, -0.9, 0.7, 1.66, -0.56, 'tavole', skip=('bottom', 'back'))
    railing(m, [(-0.68, -0.56), (-0.68, -0.88), (0.68, -0.88), (0.68, -0.56)], 1.66, 1.92, reg='legno_lacca')
    skirt(m, X0, X1, Z0, Z1, 2.55, 2.36, 0.24, top='tegole_rame')
    # torretta e tetto a padiglione con pinnacolo d'oro
    walls(m, -0.42, 0.42, -0.36, 0.44, 2.55, 3.15, 'intonaco', front='carta')
    win(m, 0.0, 2.7, 3.0, -0.36, 0.5, (0, 0, -1))
    hip(m, -0.72, 0.72, -0.66, 0.74, 3.05, 3.75, top='tegole_rame', curl=0.18, finial='oro')
    # lanterne grandi, tōrō in giardino, bonsai
    lantern(m, 0.62, 1.12, -1.04)
    lantern(m, -0.62, 1.12, -1.04)
    stone_lantern(m, -0.82, -0.88)
    m.prism(6, 0.12, 0.16, 0.3, 0.48, 'pietra_p', top='terra', cx=0.78, cz=-0.82)
    m.cone(5, 0.2, 0.52, 0.8, 'erba_alta', cx=0.78, cz=-0.82)
    beam(m, (0.78, 0.48, -0.82), (0.78, 0.56, -0.82), 0.04, 0.04, 'legno_scuro', n=3)
    return _obj(m, **FP(2, 2))


# ------------------------------------------------------------------ SEGHERIA
def _log_pile(m, x0, z0, z1, rows, rs=0.13, y0=0.12, seed=0):
    for row, n in enumerate(rows):
        for i in range(n):
            x = x0 + (i - (n - 1) / 2) * 2 * rs * 1.02
            y = y0 + rs + row * rs * 1.72
            log(m, (x, y, z0 + h01(row, i, 5 + seed) * 0.12), (x, y, z1 - h01(i, row, 6 + seed) * 0.15), rs)


def bld_segheria_l2():
    m = Mesh('bld_segheria_l2')
    m.box(-0.98, 0, -0.98, 0.98, 0.12, 0.98, 'legno_pieno', top='tavole', skip=('bottom',))
    # capanno a due falde di paglia su 6 pali, parete di tavole dietro
    for x in (-0.9, -0.3, 0.3):
        for z in (-0.55, 0.85):
            beam(m, (x, 0.12, z), (x, 1.75, z), 0.12, 0.12, 'corteccia', end='taglio')
    walls_back = [(-0.9, 0.12, 0.88), (0.3, 0.12, 0.88), (0.3, 1.1, 0.88), (-0.9, 1.1, 0.88)]
    face(m, walls_back, 'tavole_v', (0, 0, -1))
    face(m, walls_back, 'tavole_v', (0, 0, 1))
    beam(m, (-0.98, 1.72, -0.55), (0.38, 1.72, -0.55), 0.1, 0.1, 'legno_scuro', end='legno_scuro')
    beam(m, (-0.98, 1.72, 0.85), (0.38, 1.72, 0.85), 0.1, 0.1, 'legno_scuro', end='legno_scuro')
    roof(m, -1.02, 0.42, 0.15, 0.95, 1.68, 2.55, top='paglia', edge='legno_scuro', ridge='legno_scuro', curl=0.05)
    gables(m, -0.9, 0.3, -0.55, 0.85, 1.75, 2.45, reg='tavole_v')
    # sega a telaio verticale sul tronco
    for z in (-0.05, 0.55):
        beam(m, (-0.35, 0.12, z), (-0.35, 1.45, z), 0.08, 0.08, 'legno_scuro')
    beam(m, (-0.35, 1.45, -0.1), (-0.35, 1.45, 0.6), 0.08, 0.08, 'legno_scuro', end='legno_scuro')
    m.box(-0.37, 0.5, 0.2, -0.33, 1.4, 0.3, 'ferro', skip=('bottom',))
    for x in (-0.8, 0.1):
        beam(m, (x - 0.1, 0.12, 0.25), (x + 0.08, 0.55, 0.25), 0.06, 0.06, 'legno_pieno')
        beam(m, (x + 0.1, 0.12, 0.25), (x - 0.08, 0.55, 0.25), 0.06, 0.06, 'legno_pieno')
    log(m, (-0.98, 0.62, 0.25), (0.3, 0.62, 0.25), 0.14)
    # catasta grande 3+2+1 a destra e pila di assi pronte davanti
    _log_pile(m, 0.66, -0.9, 0.85, (3, 2, 1), rs=0.12)
    for x in (0.34, 0.98):
        beam(m, (x, 0.12, -0.25), (x, 0.95, -0.25), 0.07, 0.07, 'corteccia', end='taglio')
    for k in range(3):
        m.box(-0.85, 0.12 + k * 0.07, -0.95 + k * 0.02, -0.2, 0.19 + k * 0.07, -0.72 - k * 0.02, 'tavole', skip=('bottom',))
    m.prism(7, 0.16, 0.15, 0.12, 0.4, 'corteccia', top='taglio', cx=0.05, cz=-0.8)
    beam(m, (0.1, 0.4, -0.8), (0.24, 0.75, -0.9), 0.04, 0.04, 'remo')
    lantern_lite(m, -0.3, 1.45, -0.62)
    return _obj(m, **FP(2, 2))


def bld_segheria_l3():
    m = Mesh('bld_segheria_l3')
    m.box(-1.0, 0, -1.0, 1.0, 0.15, 1.0, 'pietra_muro', top='tavole', skip=('bottom',))
    # mulino chiuso a due piani a destra, ruota ad acqua sul lato sinistro (verso la camera del diorama)
    x0, x1, z0, z1, y0, y1 = -0.3, 0.95, -0.55, 0.85, 0.15, 1.95
    walls(m, x0, x1, z0, z1, y0, y1, 'tavole_scure')
    face(m, [(-0.1, y0, z0 - 0.02), (0.6, y0, z0 - 0.02), (0.6, 1.2, z0 - 0.02), (-0.1, 1.2, z0 - 0.02)], 'em_finestra', (0, 0, -1), mat='mat_emissivo')
    beam(m, (-0.16, 1.25, z0 - 0.05), (0.66, 1.25, z0 - 0.05), 0.08, 0.08, 'legno_lacca', end='legno_lacca')
    win(m, 0.78, 1.45, 1.75, z0, 0.25, (0, 0, -1))
    win(m, x1, 1.3, 1.7, 0.15, 0.5, (1, 0, 0))
    posts(m, [(x, z) for x in (x0, x1) for z in (z0, z1)], y0, 2.0, reg='legno_lacca')
    gables(m, x0, x1, z0, z1, y1, 2.65)
    roof(m, -0.42, 1.08, 0.15, 0.92, 1.8, 2.72, top='tegole_rame', curl=0.2)
    # lanternino di ventilazione sul colmo
    m.box(0.12, 2.7, -0.03, 0.5, 2.95, 0.33, 'tavole_scure', skip=('bottom',))
    hip(m, 0.02, 0.6, -0.13, 0.43, 2.92, 3.15, top='tegole_rame', curl=0.06, ridge=None, finial='oro')
    # ruota, gora di bambù e vasca
    m.box(-0.98, 0.0, -0.45, -0.32, 0.3, 1.0, 'pietra_muro', top='acqua_bassa', skip=('bottom',))
    wheel(m, -0.62, 1.0, 0.3, 0.72, 0.26)
    beam(m, (-0.62, 1.86, 0.98), (-0.62, 1.8, 0.45), 0.16, 0.1, 'bambu', end='bambu')
    beam(m, (-0.62, 0.3, 0.98), (-0.62, 1.8, 0.98), 0.07, 0.07, 'corteccia', end='taglio')
    # carrello della sega con tronco davanti, pila di assi, lanterne
    m.box(-0.9, 0.15, -0.9, 0.1, 0.35, -0.62, 'legno_pieno', top='tavole', skip=('bottom',))
    log(m, (-0.95, 0.5, -0.76), (0.15, 0.5, -0.76), 0.14)
    m.box(-0.42, 0.35, -0.8, -0.38, 0.95, -0.72, 'ferro', skip=('bottom',))
    beam(m, (-0.4, 0.95, -0.9), (-0.4, 0.95, -0.55), 0.06, 0.06, 'legno_scuro', end='legno_scuro')
    for k in range(4):
        m.box(0.35, 0.15 + k * 0.07, -0.98, 0.95, 0.22 + k * 0.07, -0.7, 'tavole', skip=('bottom',))
    lantern(m, 0.95, 1.35, -0.7, r=0.11, h=0.24)
    lantern(m, -0.24, 1.35, -0.7, r=0.11, h=0.24)
    return _obj(m, **FP(2, 2))


# ------------------------------------------------------------------ CAVA
def bld_cava_l2():
    m = Mesh('bld_cava_l2')
    rock_wall(m, 2.9, W=1.0, D=0.82, seed=10)
    m.box(-0.85, 0, -0.4, 0.85, 0.5, 0.15, 'pietra_p', top='pietra_liscia', skip=('bottom', 'back'))
    m.box(-0.7, 0.5, -0.15, 0.7, 1.05, 0.15, 'pietra_p', top='pietra_liscia', skip=('bottom', 'back'))
    m.box(-0.5, 1.05, 0.05, 0.5, 1.5, 0.2, 'pietra_p', top='pietra_liscia', skip=('bottom', 'back'))
    # impalcatura a due piani a sinistra
    X0, X1, Z0, Z1 = -0.97, -0.3, -0.8, -0.35
    for x in (X0, X1):
        for z in (Z0, Z1):
            beam(m, (x, 0, z), (x, 2.3, z), 0.07, 0.07, 'corteccia', end='taglio')
    for y in (1.0, 1.9):
        m.box(X0 - 0.05, y, Z0 - 0.05, X1 + 0.05, y + 0.06, Z1 + 0.05, 'legno_pieno', top='tavole')
    beam(m, (X0, 0.1, Z0), (X1, 0.95, Z0), 0.05, 0.04, 'legno_pieno')
    beam(m, (X1, 1.05, Z0), (X0, 1.85, Z0), 0.05, 0.04, 'legno_pieno')
    # gru a braccio (derrick) con blocco appeso
    beam(m, (0.75, 0, -0.55), (0.75, 2.6, -0.55), 0.1, 0.1, 'corteccia', end='taglio')
    beam(m, (0.75, 2.5, -0.55), (-0.1, 2.25, -0.75), 0.08, 0.08, 'legno_scuro', end='legno_scuro')
    beam(m, (0.75, 0.6, -0.55), (0.1, 2.28, -0.73), 0.05, 0.05, 'legno_pieno')
    beam(m, (0.0, 2.24, -0.75), (0.0, 1.35, -0.75), 0.02, 0.02, 'corda', n=3)
    m.box(-0.14, 1.05, -0.88, 0.14, 1.35, -0.62, 'pietra_p', top='pietra_liscia')
    m.prism(8, 0.14, 0.14, 0.35, 0.5, 'corda', top='corda', cx=0.75, cz=-0.75)
    # carrello con ruote e blocchi pronti
    m.box(0.25, 0.14, -0.98, 0.7, 0.4, -0.7, 'legno_pieno', top='ghiaia', skip=('bottom',))
    for x in (0.3, 0.65):
        m.push(Xf(t=(x, 0.1, -0.84), r=(0, 0, 90)))
        m.prism(6, 0.1, 0.1, -0.16, 0.16, 'ferro', top='nero_p', bottom='nero_p')
        m.pop()
    m.box(-0.2, 0, -1.0, 0.15, 0.3, -0.7, 'pietra_p', top='pietra_liscia', skip=('bottom',))
    m.box(-0.15, 0.3, -0.95, 0.1, 0.5, -0.75, 'pietra_p', top='pietra_liscia', skip=('bottom',))
    for i, (x, z, r) in enumerate(((0.9, 0.35, 0.2), (-0.92, 0.5, 0.18), (0.95, -0.95, 0.12))):
        m.cone(5, r, 0.0, r * 1.2, 'roccia', cx=x, cz=z, a0=h01(i, 3, 7) * 3)
    lantern_lite(m, -0.3, 1.75, -0.86)
    return _obj(m, **FP(2, 2))


def bld_cava_l3():
    m = Mesh('bld_cava_l3')
    rock_wall(m, 3.4, W=1.0, D=0.85, z=0.2, seed=20)
    # galleria nella roccia: portale di legno laccato e buio dentro
    face(m, [(-0.45, 0, -0.12), (0.35, 0, -0.12), (0.35, 1.2, -0.12), (-0.45, 1.2, -0.12)], 'nero_p', (0, 0, -1))
    for x in (-0.5, 0.4):
        beam(m, (x, 0, -0.16), (x, 1.35, -0.16), 0.12, 0.12, 'legno_lacca', end='legno_lacca')
    beam(m, (-0.65, 1.3, -0.16), (0.55, 1.3, -0.16), 0.12, 0.14, 'legno_lacca', end='legno_lacca')
    beam(m, (-0.72, 1.48, -0.16), (0.62, 1.48, -0.16), 0.16, 0.1, 'nero_lacca', end='nero_lacca')
    lantern_lite(m, -0.05, 1.1, -0.24, r=0.1, h=0.22)
    # binari e carrello che esce dalla galleria
    for x in (-0.22, 0.12):
        beam(m, (x, 0.03, -0.12), (x, 0.03, -1.0), 0.04, 0.04, 'ferro')
    for z in (-0.3, -0.6, -0.9):
        m.box(-0.32, 0, z - 0.05, 0.22, 0.03, z + 0.05, 'legno_scuro', skip=('bottom',))
    m.box(-0.28, 0.1, -0.85, 0.18, 0.42, -0.45, 'ferro', top='ghiaia', skip=('bottom',))
    # capanno degli scalpellini a sinistra con tetto di rame
    X0, X1, Z0, Z1 = -1.0, -0.55, -0.95, -0.25
    walls(m, X0, X1, Z0, Z1, 0, 1.2, 'pietra_muro')
    win(m, X0, 0.55, 0.9, -0.6, 0.35, (-1, 0, 0))
    hip(m, X0 - 0.12, X1 + 0.12, Z0 - 0.12, Z1 + 0.12, 1.15, 1.6, top='tegole_rame', curl=0.08)
    # gru di pietra e legno a destra, con tettuccio e blocco appeso
    beam(m, (0.8, 0, -0.5), (0.8, 2.8, -0.5), 0.14, 0.14, 'legno_lacca', end='legno_lacca')
    beam(m, (0.8, 2.65, -0.5), (0.2, 2.45, -0.95), 0.09, 0.09, 'legno_scuro', end='legno_scuro')
    beam(m, (0.2, 2.44, -0.95), (0.2, 1.7, -0.95), 0.02, 0.02, 'corda', n=3)
    m.box(0.05, 1.4, -1.08, 0.35, 1.7, -0.82, 'pietra_p', top='pietra_liscia')
    hip(m, 0.55, 1.05, -0.75, -0.25, 2.8, 3.05, top='tegole_rame', curl=0.05, ridge=None, finial='oro')
    # pila di blocchi squadrati a gradoni
    for i, (x0, y0, z0, x1, y1, z1) in enumerate(((0.35, 0, -0.35, 0.98, 0.35, 0.15), (0.45, 0.35, -0.25, 0.9, 0.65, 0.1), (0.55, 0.65, -0.18, 0.82, 0.9, 0.02))):
        m.box(x0, y0, z0, x1, y1, z1, 'pietra_p', top='pietra_liscia', skip=('bottom',))
    lantern(m, -0.72, 0.95, -1.05, r=0.1, h=0.22)
    beam(m, (-0.72, 1.2, -1.05), (-0.72, 1.3, -0.95), 0.02, 0.02, 'corda', n=3)
    return _obj(m, **FP(2, 2))


# ------------------------------------------------------------------ MAGAZZINO
def bld_magazzino_l2():
    """Magazzino col soppalco: piano terra di tavole scure, piano alto più chiaro con botola e carrucola."""
    m = Mesh('bld_magazzino_l2')
    m.box(-0.98, 0, -0.92, 0.98, 0.2, 0.92, 'pietra_muro', top='pietra_liscia', skip=('bottom',))
    x0, x1, z0, z1 = -0.86, 0.86, -0.72, 0.8
    walls(m, x0, x1, z0, z1, 0.2, 1.5, 'tavole_scure')
    face(m, [(-0.5, 0.2, z0 - 0.02), (0.5, 0.2, z0 - 0.02), (0.5, 1.25, z0 - 0.02), (-0.5, 1.25, z0 - 0.02)], 'legno_scuro', (0, 0, -1))
    for sx in (-1, 1):
        beam(m, (sx * 0.47, 0.24, z0 - 0.04), (sx * 0.03, 1.21, z0 - 0.04), 0.05, 0.03, 'legno_pieno')
    beam(m, (-0.55, 1.28, z0 - 0.05), (0.55, 1.28, z0 - 0.05), 0.08, 0.08, 'legno_scuro', end='legno_scuro')
    posts(m, [(x, z) for x in (x0, x1) for z in (z0, z1)], 0.2, 1.56)
    skirt(m, x0, x1, z0, z1, 1.56, 1.34, 0.24)
    # soppalco
    X0, X1, Z0, Z1 = -0.8, 0.8, -0.64, 0.74
    walls(m, X0, X1, Z0, Z1, 1.56, 2.35, 'tavole_v')
    face(m, [(-0.22, 1.65, Z0 - 0.02), (0.22, 1.65, Z0 - 0.02), (0.22, 2.15, Z0 - 0.02), (-0.22, 2.15, Z0 - 0.02)], 'em_finestra', (0, 0, -1), mat='mat_emissivo')
    posts(m, [(x, z) for x in (X0, X1) for z in (Z0, Z1)], 1.56, 2.4, w=0.1)
    gables(m, X0, X1, Z0, Z1, 2.35, 2.95)
    roof(m, -0.98, 0.98, 0.05, 0.95, 2.22, 3.05, curl=0.16)
    beam(m, (0.0, 2.45, -0.3), (0.0, 2.45, -1.05), 0.1, 0.1, 'legno_scuro', end='legno_scuro')
    beam(m, (0.0, 2.43, -0.99), (0.0, 1.75, -0.99), 0.02, 0.02, 'corda', n=3)
    m.box(-0.14, 1.47, -1.11, 0.14, 1.75, -0.87, 'cassa')
    # tettoia laterale (lato −x) con sacchi
    face(m, [(x0, 1.3, -0.6), (x0, 1.3, 0.7), (-1.04, 1.05, 0.7), (-1.04, 1.05, -0.6)], 'paglia', (-1, 1, 0))
    for z in (-0.55, 0.65):
        beam(m, (-1.0, 0.2, z), (-1.0, 1.08, z), 0.06, 0.06, 'corteccia')
    for i, z in enumerate((-0.35, 0.0, 0.35)):
        m.prism(6, 0.13, 0.1, 0.2, 0.5, 'tela', top='tela', cx=-0.98 + 0.02 * i, cz=z)
    # casse impilate e barile davanti
    m.box(0.55, 0.2, -0.98, 0.9, 0.52, -0.74, 'cassa', skip=('bottom',))
    m.box(0.6, 0.52, -0.95, 0.86, 0.74, -0.76, 'cassa', skip=('bottom',))
    m.prism(8, 0.15, 0.15, 0.2, 0.62, 'barile', top='taglio', cx=-0.72, cz=-0.86)
    sign(m, -0.32, 0.32, 1.02, 1.1, z0 - 0.06, 'insegna_h')
    lantern_lite(m, -0.66, 1.1, -0.84)
    lantern_lite(m, 0.66, 1.1, -0.84)
    for sx in (-1, 1):
        win(m, sx * X1, 1.8, 2.1, 0.1, 0.4, (sx, 0, 0))
    return _obj(m, **FP(2, 2))


def bld_magazzino_l3():
    """Kura: magazzino di pietra e intonaco bianco, zoccolo namako, due piani, tetto di rame con stemma d'oro."""
    m = Mesh('bld_magazzino_l3')
    m.box(-1.0, 0, -1.0, 1.0, 0.25, 0.95, 'pietra_muro', top='pietra_liscia', skip=('bottom',))
    m.box(-0.45, 0, -1.12, 0.45, 0.13, -1.0, 'pietra_muro', top='pietra_liscia', skip=('bottom', 'back'))
    x0, x1, z0, z1 = -0.85, 0.85, -0.75, 0.82
    walls(m, x0, x1, z0, z1, 0.25, 0.95, 'namako')
    walls(m, x0, x1, z0, z1, 0.95, 2.45, 'intonaco')
    # portone blindato nero con cornice spessa
    m.box(-0.42, 0.25, z0 - 0.12, 0.42, 1.45, z0, 'nero_lacca', skip=('bottom',))
    face(m, [(-0.3, 0.25, z0 - 0.125), (0.3, 0.25, z0 - 0.125), (0.3, 1.25, z0 - 0.125), (-0.3, 1.25, z0 - 0.125)], 'ferro', (0, 0, -1))
    skirt(m, -0.46, 0.46, z0 - 0.12, z0 - 0.05, 1.62, 1.5, 0.08, top='tegole_rame')
    # finestrelle del piano alto con scuri di ferro, fascia scura a metà
    for x in (-0.5, 0.5):
        win(m, x, 1.8, 2.1, z0, 0.28, (0, 0, -1))
        face(m, [(x + 0.15, 1.78, z0 - 0.02), (x + 0.3, 1.78, z0 - 0.02), (x + 0.3, 2.12, z0 - 0.02), (x + 0.15, 2.12, z0 - 0.02)], 'ferro', (0, 0, -1))
    for sx in (-1, 1):
        win(m, sx * x1, 1.8, 2.1, 0.05, 0.3, (sx, 0, 0))
    for y in (0.95, 1.65):
        beam(m, (x0 - 0.02, y, z0 - 0.02), (x1 + 0.02, y, z0 - 0.02), 0.05, 0.05, 'nero_lacca')
    posts(m, [(x, z) for x in (x0, x1) for z in (z0, z1)], 0.25, 2.5, w=0.1, reg='nero_lacca')
    gables(m, x0, x1, z0, z1, 2.45, 3.25, reg='intonaco')
    roof(m, -1.05, 1.05, 0.03, 1.02, 2.3, 3.4, top='tegole_rame', curl=0.22)
    # stemma d'oro sui frontoni
    for x, sx in ((x0, -1), (x1, 1)):
        m.push(Xf(t=(x + sx * 0.02, 2.8, 0.03), r=(0, 0, 90)))
        m.prism(8, 0.16, 0.16, -0.03 if sx > 0 else 0.0, 0.03 if sx < 0 else 0.0, 'oro', top='oro', bottom='oro')
        m.pop()
    # carretto con sacchi, lanterne a stelo, casse
    m.box(0.45, 0.25, -0.98, 0.95, 0.5, -0.8, 'legno_pieno', top='tavole', skip=('bottom',))
    for i, x in enumerate((0.55, 0.72, 0.88)):
        m.prism(6, 0.09, 0.07, 0.5, 0.72, 'tela', top='tela', cx=x, cz=-0.89)
    m.box(-0.95, 0.25, -0.98, -0.6, 0.55, -0.78, 'cassa', skip=('bottom',))
    for x in (-0.55, 0.55):
        beam(m, (x, 0.25, -1.08), (x, 1.2, -1.08), 0.05, 0.05, 'nero_lacca')
        lantern_lite(m, x, 1.35, -1.08, r=0.11, cord=0.0)
    return _obj(m, **FP(2, 2))


# ------------------------------------------------------------------ TAVOLO DELLE SFIDE
def _table(m, y=0.55, s=1.0, board='rete'):
    m.box(-0.5 * s, y - 0.1, -0.35 * s, 0.5 * s, y, 0.35 * s, 'legno_pieno', top='tavole', skip=('bottom',))
    face(m, [(-0.3 * s, y + 0.002, -0.25 * s), (0.3 * s, y + 0.002, -0.25 * s), (0.3 * s, y + 0.002, 0.25 * s), (-0.3 * s, y + 0.002, 0.25 * s)], board, (0, 1, 0))
    for x in (-0.42 * s, 0.42 * s):
        for z in (-0.28 * s, 0.28 * s):
            beam(m, (x, 0.08, z), (x, y - 0.1, z), 0.07, 0.07, 'legno_scuro')
    for i, (x, z) in enumerate(((-0.2, -0.15), (0.1, -0.05), (0.2, 0.15), (-0.1, 0.1))):
        m.prism(5, 0.03, 0.02, y + 0.005, y + 0.07, 'nero_p' if i % 2 else 'oro_perla', top='nero_p' if i % 2 else 'oro_perla', cx=x * s, cz=z * s)


def bld_tavolo_l2():
    m = Mesh('bld_tavolo_l2')
    m.box(-0.95, 0, -0.95, 0.95, 0.1, 0.95, 'pietra_liscia', top='ghiaia', skip=('bottom',))
    _table(m, 0.57)
    for x, z in ((0, -0.65), (0, 0.65), (-0.72, 0), (0.72, 0)):
        m.prism(6, 0.15, 0.15, 0.1, 0.36, 'barile', top='taglio', cx=x, cz=z)
    # pergola: 4 pali e tetto a due falde
    P = [(-0.82, -0.82), (0.82, -0.82), (-0.82, 0.82), (0.82, 0.82)]
    posts(m, P, 0.1, 2.0, w=0.1)
    for z in (-0.82, 0.82):
        beam(m, (-0.9, 1.95, z), (0.9, 1.95, z), 0.1, 0.1, 'legno_scuro', end='legno_scuro')
    roof(m, -1.0, 1.0, 0.0, 1.02, 1.92, 2.55, curl=0.18)
    gables(m, -0.82, 0.82, -0.82, 0.82, 2.0, 2.5)
    # due stendardi e lanterne sotto la gronda
    for x, sx in ((-0.93, -1), (0.93, 1)):
        face(m, [(x, 1.85, -0.6), (x, 1.85, -0.1), (x, 1.05, -0.1), (x, 1.05, -0.6)], 'bandiera', (sx, 0, 0))
        face(m, [(x - sx * 0.01, 1.85, -0.6), (x - sx * 0.01, 1.85, -0.1), (x - sx * 0.01, 1.05, -0.1), (x - sx * 0.01, 1.05, -0.6)], 'bandiera', (-sx, 0, 0))
    for x in (-0.55, 0.55):
        lantern_lite(m, x, 1.6, -0.88)
    sign(m, -0.4, 0.4, 1.62, 1.86, -0.9, 'insegna_sfide')
    return _obj(m, **FP(2, 2))


def bld_tavolo_l3():
    m = Mesh('bld_tavolo_l3')
    m.prism(8, 1.05, 1.0, 0, 0.2, 'pietra_muro', top='pietra_liscia', a0=math.pi / 8)
    m.box(-0.35, 0, -1.12, 0.35, 0.1, -0.95, 'pietra_muro', top='pietra_liscia', skip=('bottom', 'back'))
    _table(m, 0.68, s=1.15)
    for x, z in ((0, -0.72), (0, 0.72), (-0.78, 0), (0.78, 0)):
        m.prism(6, 0.15, 0.15, 0.2, 0.46, 'lacca_rossa_p', top='tessuto_rosso', cx=x, cz=z)
    # padiglione: 4 colonne laccate, travi, tetto a padiglione di rame con pinnacolo d'oro
    P = [(-0.78, -0.78), (0.78, -0.78), (0.78, 0.78), (-0.78, 0.78)]
    for x, z in P:
        m.prism(6, 0.09, 0.08, 0.2, 2.25, 'legno_lacca', cx=x, cz=z)
        m.prism(6, 0.13, 0.13, 0.2, 0.32, 'nero_lacca', top='nero_lacca', cx=x, cz=z)
    for (a, b) in zip(P, P[1:] + P[:1]):
        beam(m, (a[0], 2.2, a[1]), (b[0], 2.2, b[1]), 0.12, 0.14, 'legno_lacca')
    hip(m, -1.12, 1.12, -1.12, 1.12, 2.2, 3.3, top='tegole_rame', curl=0.25, finial='oro')
    # insegna «SFIDE» appesa davanti, 4 lanterne agli angoli
    sign(m, -0.55, 0.55, 1.62, 2.1, -0.82, 'insegna_sfide')
    for x in (-0.3, 0.3):
        beam(m, (x, 2.1, -0.8), (x, 2.15, -0.8), 0.02, 0.02, 'corda', n=3)
    for x, z in P:
        lantern(m, x * 1.18, 1.72, z * 1.18, r=0.12, h=0.26)
    return _obj(m, **FP(2, 2))


# ------------------------------------------------------------------ FARO
def bld_faro_l2():
    m = Mesh('bld_faro_l2')
    m.prism(8, 1.0, 0.95, 0, 0.35, 'pietra_muro', top='pietra_liscia')
    bands = [(0.35, 1.45, 'faro_bianco'), (1.45, 2.55, 'faro_rosso'), (2.55, 3.65, 'faro_bianco'), (3.65, 4.75, 'faro_rosso'), (4.75, 5.6, 'faro_bianco')]
    r = lambda y: 0.7 - (y - 0.35) * 0.058
    for y0, y1, reg in bands:
        m.prism(10, r(y0), r(y1), y0, y1, reg)
    face(m, [(-0.17, 0.35, -r(0.35) - 0.01), (0.17, 0.35, -r(0.35) - 0.01), (0.17, 1.05, -r(1.05) - 0.01), (-0.17, 1.05, -r(1.05) - 0.01)], 'legno_scuro', (0, 0, -1))
    for y in (2.0, 3.2, 4.3):
        face(m, [(-0.12, y, -r(y) - 0.01), (0.12, y, -r(y) - 0.01), (0.12, y + 0.3, -r(y + 0.3) - 0.01), (-0.12, y + 0.3, -r(y + 0.3) - 0.01)], 'em_finestra', (0, 0, -1), mat='mat_emissivo')
    # casetta del guardiano addossata a destra
    walls(m, 0.45, 1.0, -0.45, 0.45, 0.35, 1.25, 'intonaco')
    win(m, 1.0, 0.65, 0.95, 0.0, 0.3, (1, 0, 0))
    hip(m, 0.35, 1.1, -0.55, 0.55, 1.2, 1.6, top='tegole', curl=0.06)
    # doppio ballatoio, stanza della luce grande, cupola d'oro
    y = 5.6
    m.prism(10, 0.66, 0.66, y, y + 0.1, 'nero_lacca', top='metallo', bottom='nero_lacca')
    for i in range(8):
        a, b = 2 * math.pi * i / 8 + math.pi / 8, 2 * math.pi * (i + 1) / 8 + math.pi / 8
        beam(m, (math.cos(a) * 0.63, y + 0.35, math.sin(a) * 0.63), (math.cos(b) * 0.63, y + 0.35, math.sin(b) * 0.63), 0.03, 0.03, 'nero_lacca')
    m.prism(8, 0.42, 0.42, y + 0.1, y + 0.8, 'em_faro', mat='mat_emissivo')
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        beam(m, (math.cos(a) * 0.43, y + 0.1, math.sin(a) * 0.43), (math.cos(a) * 0.43, y + 0.8, math.sin(a) * 0.43), 0.05, 0.05, 'nero_lacca')
    m.prism(8, 0.5, 0.5, y + 0.8, y + 0.88, 'nero_lacca', top='nero_lacca')
    m.cone(8, 0.5, y + 0.88, y + 1.4, 'oro')
    beam(m, (0, y + 1.38, 0), (0, y + 1.75, 0), 0.04, 0.04, 'nero_lacca')
    for i in range(7):
        a = 2 * math.pi * i / 7 + 0.3
        if math.cos(a) > 0.3 and abs(math.sin(a)) < 0.7:
            continue
        m.cone(5, 0.2 + 0.1 * h01(i, 1, 9), 0.0, 0.35 + 0.2 * h01(i, 2, 9), 'roccia', cx=math.cos(a) * 0.98, cz=math.sin(a) * 0.98)
    lantern_lite(m, -0.3, 0.9, -0.82)
    lantern_lite(m, 0.3, 0.9, -0.82)
    return _obj(m, **FP(2, 2))


# ------------------------------------------------------------------ CANTIERE e DEPOSITO
def bld_cantiere():
    """Impalcatura di pali e tavole con teli blu, mostrata durante la costruzione (qualsiasi edificio da 1 cella)."""
    m = Mesh('bld_cantiere')
    # tracciato di fondazione e picchetti
    for a, b in (((-0.9, -0.9), (0.9, -0.9)), ((0.9, -0.9), (0.9, 0.9)), ((0.9, 0.9), (-0.9, 0.9)), ((-0.9, 0.9), (-0.9, -0.9))):
        beam(m, (a[0], 0.06, a[1]), (b[0], 0.06, b[1]), 0.12, 0.12, 'pietra_p')
    P = [(-0.85, -0.85), (0.85, -0.85), (0.85, 0.85), (-0.85, 0.85)]
    for x, z in P:
        beam(m, (x, 0, z), (x, 2.4, z), 0.08, 0.08, 'corteccia', end='taglio')
    for y in (1.1, 2.2):
        for a, b in zip(P, P[1:] + P[:1]):
            beam(m, (a[0], y, a[1]), (b[0], y, b[1]), 0.06, 0.06, 'legno_pieno')
    # controventi a X davanti e a destra
    beam(m, (-0.85, 0.1, -0.87), (0.85, 1.08, -0.87), 0.05, 0.04, 'legno_pieno')
    beam(m, (0.85, 1.12, -0.87), (-0.85, 2.18, -0.87), 0.05, 0.04, 'legno_pieno')
    beam(m, (0.87, 0.1, -0.85), (0.87, 1.08, 0.85), 0.04, 0.05, 'legno_pieno')
    # piani di tavole
    m.box(-0.9, 1.12, -0.9, 0.9, 1.17, -0.4, 'legno_pieno', top='tavole')
    m.box(-0.9, 2.22, 0.3, 0.9, 2.27, 0.9, 'legno_pieno', top='tavole')
    # teli blu sul retro e a sinistra (due facce)
    for pts, n in (([(-0.85, 0.3, 0.88), (0.85, 0.3, 0.88), (0.85, 2.3, 0.88), (-0.85, 2.3, 0.88)], (0, 0, 1)),
                   ([(-0.88, 0.5, -0.85), (-0.88, 0.5, 0.85), (-0.88, 2.3, 0.85), (-0.88, 2.3, -0.85)], (-1, 0, 0))):
        face(m, pts, 'telo_blu', n)
        face(m, pts, 'telo_blu', tuple(-c for c in n))
    # scala, carrucola con secchio, pila di tavole e sacco
    for dx in (0.0, 0.3):
        beam(m, (0.2 + dx, 0, -1.05), (0.2 + dx, 1.15, -0.88), 0.05, 0.05, 'legno_pieno')
    for k in range(1, 4):
        t = k / 4
        beam(m, (0.2, 1.15 * t, -1.05 + 0.17 * t), (0.5, 1.15 * t, -1.05 + 0.17 * t), 0.035, 0.035, 'remo')
    beam(m, (-0.85, 2.4, -0.85), (-0.85, 2.4, -1.15), 0.07, 0.07, 'legno_scuro', end='legno_scuro')
    beam(m, (-0.85, 2.38, -1.1), (-0.85, 1.5, -1.1), 0.02, 0.02, 'corda', n=3)
    m.prism(6, 0.1, 0.12, 1.3, 1.5, 'secchio', top='ghiaia', bottom='legno_scuro', cx=-0.85, cz=-1.1)
    for k in range(3):
        m.box(-0.55, k * 0.07, -0.7 + k * 0.02, 0.1, 0.07 + k * 0.07, -0.45 - k * 0.02, 'tavole', skip=('bottom',))
    m.prism(6, 0.14, 0.11, 0, 0.35, 'tela', top='tela', cx=0.5, cz=0.4)
    m.box(0.1, 0, 0.1, 0.4, 0.3, 0.4, 'pietra_p', top='pietra_liscia', skip=('bottom',))
    return _obj(m, **FP(2, 2))


def prop_deposito():
    """Cassa aperta piena di tronchi e pietre: il deposito dell'edificio è pieno, tocca raccogliere."""
    m = Mesh('prop_deposito')
    s = 0.32
    m.box(-s, 0, -s, s, 0.4, s, 'cassa', skip=('bottom', 'top'))
    face(m, [(-s, 0.3, -s), (s, 0.3, -s), (s, 0.3, s), (-s, 0.3, s)], 'legno_scuro', (0, 1, 0))
    for x in (-s, s):
        beam(m, (x, 0.38, -s), (x, 0.38, s), 0.05, 0.05, 'legno_scuro', end='legno_scuro')
    for i, (x, y, r) in enumerate(((-0.14, 0.4, 0.09), (0.05, 0.4, 0.09), (-0.05, 0.54, 0.085))):
        log(m, (x, y, -0.4 + 0.05 * i), (x, y, 0.36 - 0.04 * i), r)
    for i, (x, z, r) in enumerate(((0.2, -0.12, 0.1), (0.22, 0.14, 0.09))):
        m.cone(5, r, 0.35, 0.35 + r * 1.5, 'roccia', cx=x, cz=z, a0=h01(i, 4, 7) * 3)
    return _obj(m)


# ------------------------------------------------------------------ MOLO (prop da appoggiare sul mod_molo)
MOLO_Y = 0.5  # piano del tavolato di mod_molo: i prop del molo hanno già questa quota


def _bitta(m, x, z, reg='legno_scuro', top='taglio', r=0.09):
    m.prism(6, r, r, MOLO_Y, MOLO_Y + 0.3, reg, cx=x, cz=z)
    m.prism(6, r * 1.35, r * 1.2, MOLO_Y + 0.3, MOLO_Y + 0.38, reg, top=top, cx=x, cz=z)


def prop_molo_l2():
    m = Mesh('prop_molo_l2')
    _bitta(m, -0.8, -0.82)
    _bitta(m, 0.8, -0.82)
    m.prism(8, 0.17, 0.17, MOLO_Y, MOLO_Y + 0.08, 'corda', top='corda', cx=-0.45, cz=-0.7)
    beam(m, (-0.8, MOLO_Y + 0.25, -0.82), (-0.5, MOLO_Y + 0.05, -0.72), 0.03, 0.03, 'corda', n=3)
    # lampione con lanterna
    beam(m, (0.82, MOLO_Y, 0.8), (0.82, MOLO_Y + 1.7, 0.8), 0.08, 0.08, 'legno_scuro', end='legno_scuro')
    beam(m, (0.82, MOLO_Y + 1.62, 0.8), (0.82, MOLO_Y + 1.62, 0.45), 0.06, 0.06, 'legno_scuro', end='legno_scuro')
    lantern_lite(m, 0.82, MOLO_Y + 1.35, 0.5, r=0.13, h=0.28)
    return _obj(m, **FP(2, 2))


def prop_molo_l3():
    m = Mesh('prop_molo_l3')
    for x in (-0.8, 0.8):
        _bitta(m, x, -0.82, reg='pietra_p', top='pietra_liscia', r=0.11)
    # due lampioni laccati con fune di bandierine tra i due
    for x in (-0.82, 0.82):
        m.prism(4, 0.06, 0.05, MOLO_Y, MOLO_Y + 1.8, 'legno_lacca', cx=x, cz=0.82)
        beam(m, (x, MOLO_Y + 1.72, 0.82), (x * 0.72, MOLO_Y + 1.72, 0.82), 0.05, 0.05, 'nero_lacca', end='nero_lacca')
        lantern_lite(m, x * 0.72, MOLO_Y + 1.45, 0.82, r=0.13, h=0.28, n=5)
    for a, b in (((-0.82, 1.78), (0.0, 1.55)), ((0.0, 1.55), (0.82, 1.78))):
        face(m, [(a[0], MOLO_Y + a[1], 0.82), (b[0], MOLO_Y + b[1], 0.82), (b[0], MOLO_Y + b[1] - 0.12, 0.82), (a[0], MOLO_Y + a[1] - 0.12, 0.82)], 'fune_bandierine', (0, 0, -1), uv='fit')
        face(m, [(a[0], MOLO_Y + a[1], 0.82), (b[0], MOLO_Y + b[1], 0.82), (b[0], MOLO_Y + b[1] - 0.12, 0.82), (a[0], MOLO_Y + a[1] - 0.12, 0.82)], 'fune_bandierine', (0, 0, 1), uv='fit')
    m.prism(8, 0.18, 0.18, MOLO_Y, MOLO_Y + 0.1, 'corda', top='corda', cx=0.4, cz=-0.7)
    return _obj(m, **FP(2, 2))


# ------------------------------------------------------------------ PORTO
def bld_porto_casa_a():
    """Bottega a due piani (2×2 m): banco aperto sul davanti con noren blu, insegna verticale, balcone di carta."""
    m = Mesh('bld_porto_casa_a')
    m.box(-0.98, 0, -0.95, 0.98, 0.18, 0.95, 'pietra_muro', top='pietra_liscia', skip=('bottom',))
    x0, x1, z0, z1 = -0.85, 0.85, -0.72, 0.8
    walls(m, x0, x1, z0, z1, 0.18, 1.6, 'tavole_scure')
    win(m, 0.0, 0.7, 1.45, z0, 1.5, (0, 0, -1))  # bottega aperta: interno illuminato sopra il banco
    # banco con merce e noren
    m.box(-0.8, 0.18, -0.95, 0.8, 0.7, -0.75, 'legno_pieno', top='tavole', skip=('bottom',))
    for i, x in enumerate((-0.55, -0.2, 0.15, 0.5)):
        m.prism(6, 0.1, 0.12, 0.7, 0.82, 'secchio', top=('acqua_bassa', 'oro_perla', 'taglio', 'erba_alta')[i], cx=x, cz=-0.85)
    noren(m, 0.0, 1.55, z0 - 0.03, 1.5, 0.4, 'noren_blu')
    posts(m, [(x, z) for x in (x0, x1) for z in (z0, z1)], 0.18, 1.66)
    skirt(m, x0, x1, z0, z1, 1.66, 1.42, 0.28)
    # primo piano sporgente sul davanti
    X0, X1, Z0, Z1 = -0.82, 0.82, -0.82, 0.78
    walls(m, X0, X1, Z0, Z1, 1.66, 2.75, 'intonaco', front='carta_tesa')
    win(m, -0.35, 1.95, 2.45, Z0, 0.5, (0, 0, -1))
    win(m, 0.35, 1.95, 2.45, Z0, 0.5, (0, 0, -1))
    win(m, X0, 1.95, 2.4, 0.0, 0.5, (-1, 0, 0))
    gables(m, X0, X1, Z0, Z1, 2.75, 3.3)
    roof(m, -1.0, 1.0, -0.02, 1.0, 2.62, 3.4, curl=0.2)
    # insegna verticale a bandiera sul lato sinistro, lanterne
    beam(m, (x0 - 0.02, 2.55, -0.9), (x0 - 0.3, 2.55, -0.9), 0.05, 0.05, 'legno_scuro', end='legno_scuro')
    for sx in (-1, 1):
        face(m, [(x0 - 0.1, 1.45, -0.9 + 0.001 * sx), (x0 - 0.35, 1.45, -0.9 + 0.001 * sx), (x0 - 0.35, 2.5, -0.9 + 0.001 * sx), (x0 - 0.1, 2.5, -0.9 + 0.001 * sx)], 'insegna_v', (0, 0, sx), uv='fit')
    lantern_lite(m, 0.72, 1.28, -1.02)
    lantern_lite(m, 0.72, 2.35, -1.0)
    return _obj(m, **FP(2, 2))


def bld_porto_casa_b():
    """Locanda lunga (4×2 m): due piani, fila di lanterne rosse, noren rosso, balcone sul davanti."""
    m = Mesh('bld_porto_casa_b')
    m.box(-1.98, 0, -0.96, 1.98, 0.2, 0.96, 'pietra_muro', top='pietra_liscia', skip=('bottom',))
    x0, x1, z0, z1 = -1.85, 1.85, -0.72, 0.8
    walls(m, x0, x1, z0, z1, 0.2, 1.6, 'tavole_scure', front='carta')
    for x in (-1.2, 1.2):
        face(m, [(x - 0.35, 0.22, z0 - 0.02), (x + 0.35, 0.22, z0 - 0.02), (x + 0.35, 1.35, z0 - 0.02), (x - 0.35, 1.35, z0 - 0.02)], 'em_finestra', (0, 0, -1), mat='mat_emissivo')
    noren(m, -1.2, 1.45, z0, 0.7, 0.4, 'noren_rosso')
    noren(m, 1.2, 1.45, z0, 0.7, 0.4, 'noren_rosso')
    posts(m, [(x, z) for x in (x0, 0.0, x1) for z in (z0, z1)], 0.2, 1.66)
    skirt(m, x0, x1, z0, z1, 1.66, 1.42, 0.28)
    X0, X1, Z0, Z1 = -1.75, 1.75, -0.6, 0.72
    walls(m, X0, X1, Z0, Z1, 1.66, 2.7, 'intonaco', front='carta_tesa')
    for x in (-1.1, 0.0, 1.1):
        win(m, x, 1.95, 2.45, Z0, 0.6, (0, 0, -1))
    m.box(-1.75, 1.66, -0.95, 1.75, 1.72, -0.6, 'tavole', skip=('bottom', 'back'))
    railing(m, [(-1.73, -0.6), (-1.73, -0.93), (0.0, -0.93), (1.73, -0.93), (1.73, -0.6)], 1.72, 1.98)
    gables(m, X0, X1, Z0, Z1, 2.7, 3.3)
    roof(m, -1.98, 1.98, 0.06, 1.02, 2.55, 3.42, curl=0.22)
    sign(m, -0.55, 0.55, 1.1, 1.36, z0 - 0.02, 'insegna_h')
    for x in (-1.65, -0.55, 0.55, 1.65):
        lantern_lite(m, x, 1.25, -1.03)
    return _obj(m, **FP(4, 2))


def bld_porto_casa_c():
    """Casa-torre stretta a tre piani (2×2 m): rossa, tetto a padiglione, ballatoio in cima, bambù."""
    m = Mesh('bld_porto_casa_c')
    m.box(-0.95, 0, -0.95, 0.95, 0.22, 0.95, 'pietra_muro', top='pietra_liscia', skip=('bottom',))
    x0, x1, z0, z1 = -0.72, 0.72, -0.7, 0.72
    walls(m, x0, x1, z0, z1, 0.22, 1.5, 'intonaco_rosso', front='carta')
    face(m, [(-0.25, 0.24, z0 - 0.02), (0.25, 0.24, z0 - 0.02), (0.25, 1.25, z0 - 0.02), (-0.25, 1.25, z0 - 0.02)], 'em_finestra', (0, 0, -1), mat='mat_emissivo')
    posts(m, [(x, z) for x in (x0, x1) for z in (z0, z1)], 0.22, 1.56, reg='nero_lacca')
    skirt(m, x0, x1, z0, z1, 1.56, 1.36, 0.22)
    walls(m, x0 + 0.04, x1 - 0.04, z0 + 0.04, z1 - 0.04, 1.56, 2.6, 'intonaco_rosso')
    for x in (-0.3, 0.3):
        win(m, x, 1.85, 2.3, z0 + 0.04, 0.35, (0, 0, -1))
    win(m, x0 + 0.04, 1.85, 2.3, 0.0, 0.5, (-1, 0, 0))
    posts(m, [(x, z) for x in (x0 + 0.04, x1 - 0.04) for z in (z0 + 0.04, z1 - 0.04)], 1.56, 2.66, w=0.1, reg='nero_lacca')
    skirt(m, x0 + 0.04, x1 - 0.04, z0 + 0.04, z1 - 0.04, 2.66, 2.48, 0.2)
    # ultimo piano con ballatoio tutt'intorno
    walls(m, -0.52, 0.52, -0.5, 0.52, 2.66, 3.5, 'carta_tesa')
    m.box(-0.78, 2.66, -0.76, 0.78, 2.72, 0.78, 'tavole', skip=('bottom',))
    railing(m, [(-0.76, -0.74), (0.76, -0.74), (0.76, 0.76), (-0.76, 0.76), (-0.76, -0.74)], 2.72, 2.98, reg='nero_lacca')
    hip(m, -0.85, 0.85, -0.82, 0.84, 3.4, 4.2, curl=0.2, finial='nero_lacca')
    # bambù in vaso e lanterne sugli angoli
    for x, z in ((-0.85, -0.85), (0.85, -0.85)):
        m.prism(6, 0.13, 0.15, 0.22, 0.45, 'pietra_p', top='terra', cx=x, cz=z)
        for k, (dx, dz, h) in enumerate(((0.0, 0.0, 1.6), (0.06, 0.05, 1.2), (-0.05, 0.04, 1.4))):
            m.prism(4, 0.025, 0.02, 0.45, 0.45 + h, 'bambu', cx=x + dx, cz=z + dz)
    lantern_lite(m, -0.76, 3.25, -0.76)
    lantern_lite(m, 0.76, 3.25, -0.76)
    lantern_lite(m, 0.0, 1.2, -0.95)
    return _obj(m, **FP(2, 2))


def bld_porto_tavolo():
    """Il Tavolo delle Sfide del Porto (4×4 m): piattaforma a gradoni, padiglione laccato, grande insegna «SFIDE»."""
    m = Mesh('bld_porto_tavolo')
    m.prism(8, 2.05, 1.98, 0, 0.18, 'pietra_muro', top='pietra_liscia', a0=math.pi / 8)
    m.prism(8, 1.6, 1.55, 0.18, 0.36, 'pietra_muro', top='ghiaia', a0=math.pi / 8)
    m.box(-0.5, 0, -2.12, 0.5, 0.18, -1.85, 'pietra_muro', top='pietra_liscia', skip=('bottom', 'back'))
    # tavolo grande e sgabelli
    m.push(Xf(t=(0, 0.28, 0)))
    _table(m, 0.62, s=1.6)
    m.pop()
    for x, z in ((0, -0.95), (0, 0.95), (-1.15, 0), (1.15, 0), (-0.6, -0.95), (0.6, 0.95)):
        m.prism(6, 0.16, 0.16, 0.36, 0.62, 'lacca_rossa_p', top='tessuto_rosso', cx=x, cz=z)
    # padiglione: 4 colonne, travi, doppio tetto di rame
    P = [(-1.35, -1.35), (1.35, -1.35), (1.35, 1.35), (-1.35, 1.35)]
    for x, z in P:
        m.prism(6, 0.12, 0.11, 0.36, 2.8, 'legno_lacca', cx=x, cz=z)
        m.prism(6, 0.17, 0.17, 0.36, 0.5, 'nero_lacca', top='nero_lacca', cx=x, cz=z)
    for a, b in zip(P, P[1:] + P[:1]):
        beam(m, (a[0], 2.75, a[1]), (b[0], 2.75, b[1]), 0.16, 0.18, 'legno_lacca')
    skirt(m, -1.35, 1.35, -1.35, 1.35, 3.05, 2.72, 0.45, top='tegole_rame')
    walls(m, -0.9, 0.9, -0.9, 0.9, 2.75, 3.4, 'legno_lacca')
    hip(m, -1.3, 1.3, -1.3, 1.3, 3.3, 4.4, top='tegole_rame', curl=0.28, finial='oro')
    # grande insegna sul davanti, bandiere, lanterne agli angoli
    sign(m, -0.9, 0.9, 1.5, 2.4, -1.42, 'insegna_sfide')
    for x in (-0.6, 0.6):
        beam(m, (x, 2.4, -1.4), (x, 2.72, -1.4), 0.03, 0.03, 'corda', n=3)
    for x in (-1.6, 1.6):
        beam(m, (x, 0.18, -1.75), (x, 3.6, -1.75), 0.07, 0.07, 'nero_lacca', end='nero_lacca')
        sx = 1 if x < 0 else -1
        face(m, [(x, 3.5, -1.75), (x + sx * 0.45, 3.5, -1.75), (x + sx * 0.45, 2.3, -1.75), (x, 2.3, -1.75)], 'bandiera', (0, 0, -1))
        face(m, [(x, 3.5, -1.745), (x + sx * 0.45, 3.5, -1.745), (x + sx * 0.45, 2.3, -1.745), (x, 2.3, -1.745)], 'bandiera', (0, 0, 1))
    for x, z in P:
        lantern_lite(m, x * 1.1, 2.3, z * 1.1, r=0.17, h=0.36)
    return _obj(m, **FP(4, 4))


def _boa(name, next_):
    m = Mesh(name)
    # corpo galleggiante: la linea d'acqua è y = 0 (una parte sta sotto)
    m.prism(8, 0.18, 0.5, -0.45, 0.0, 'lacca_rossa_p', bottom='nero_p')
    m.prism(8, 0.5, 0.46, 0.0, 0.55, 'boa_strisce', uv='fit')
    m.prism(8, 0.46, 0.14, 0.55, 0.8, 'boa_strisce' if not next_ else 'em_neon_ambra', top='nero_p', mat='mat_emissivo' if next_ else None)
    beam(m, (0, 0.8, 0), (0, 2.8, 0), 0.08, 0.08, 'nero_lacca')
    # bandiera doppia e fanale in cima
    reg, mat = ('em_neon_ambra', 'mat_emissivo') if next_ else ('bandiera', None)
    for z, n in ((-0.005, (0, 0, -1)), (0.005, (0, 0, 1))):
        face(m, [(0.04, 2.75, z), (0.75, 2.62, z), (0.75, 2.12, z), (0.04, 2.02, z)], reg, n, mat=mat)
    m.prism(6, 0.1, 0.1, 2.8, 3.0, 'em_lanterna' if not next_ else 'em_neon_ambra', mat='mat_emissivo')
    m.cone(6, 0.14, 3.0, 3.12, 'nero_lacca')
    if next_:  # anello acceso sull'acqua: «la prossima» si vede da lontano
        ring_o, ring_i = m.ring(10, 1.05, 0.02), m.ring(10, 0.75, 0.02)
        for i in range(10):
            j = (i + 1) % 10
            face(m, [ring_o[i], ring_o[j], ring_i[j], ring_i[i]], 'em_neon_ambra', (0, 1, 0), mat='mat_emissivo')
    return _obj(m)


def prop_boa():
    return _boa('prop_boa', False)


def prop_boa_next():
    return _boa('prop_boa_next', True)


def prop_filo_lanterne():
    """Filo di lanterne tra due pali a 4 m (x = ±2): pivot al centro, lanterne lungo la catenaria."""
    m = Mesh('prop_filo_lanterne')
    H = 2.7
    for x in (-2.0, 2.0):
        m.prism(4, 0.07, 0.06, 0, H + 0.1, 'legno_scuro', cx=x)
        m.prism(4, 0.13, 0.13, 0, 0.12, 'pietra_p', top='pietra_liscia', cx=x)
    N = 5
    pts = [(-2.0 + 4.0 * i / N, H - 0.45 * (1 - ((i / N) * 2 - 1) ** 2), 0.0) for i in range(N + 1)]
    for a, b in zip(pts, pts[1:]):
        beam(m, a, b, 0.025, 0.025, 'corda', n=3)
    for i in range(1, N):
        x, y, z = pts[i]
        lantern_lite(m, x, y - 0.2, z, r=0.15, h=0.3, n=5, cord=0.0)
    return _obj(m, **FP(4, 0.3))


# ------------------------------------------------------------------ FACCIATE (solo da lontano, dal mare)
def fac_neon():
    """Distretto Neon: skyline di torri scure con fasce e insegne emissive, 16 × 4 m, fino a 14 m."""
    m = Mesh('fac_neon')
    towers = [(-7.2, 2.4, 9.0, 'em_neon_rosa'), (-4.4, 2.2, 13.5, 'em_neon_ciano'), (-1.6, 2.6, 7.5, 'em_neon_viola'),
              (1.4, 2.0, 11.5, 'em_neon_rosa'), (4.0, 2.6, 8.5, 'em_neon_ciano'), (6.8, 2.2, 12.5, 'em_neon_viola')]
    for i, (cx, w, h, neon) in enumerate(towers):
        d = 3.0 + h01(i, 1, 3)
        z0, z1 = -d / 2, d / 2
        m.box(cx - w / 2, 0, z0, cx + w / 2, h, z1, 'metallo', top='cemento', skip=('bottom', 'back'))
        # fasce di finestre accese e un tubo neon verticale
        for k in range(int(h // 3)):
            y = 1.5 + k * 3
            face(m, [(cx - w / 2 + 0.25, y, z0 - 0.02), (cx + w / 2 - 0.25, y, z0 - 0.02), (cx + w / 2 - 0.25, y + 0.9, z0 - 0.02), (cx - w / 2 + 0.25, y + 0.9, z0 - 0.02)],
                 'em_finestra' if (i + k) % 3 else 'em_neon_viola', (0, 0, -1), mat='mat_emissivo')
        beam(m, (cx + w / 2 + 0.05, 1.0, z0 + 0.3), (cx + w / 2 + 0.05, h - 0.5, z0 + 0.3), 0.14, 0.14, neon, mat='mat_emissivo')
        beam(m, (cx - w / 2, h + 0.05, z0), (cx + w / 2, h + 0.05, z0), 0.14, 0.14, neon, mat='mat_emissivo')
    # antenne e insegna grande
    beam(m, (-4.4, 13.5, 0), (-4.4, 16.0, 0), 0.12, 0.12, 'metallo')
    m.prism(4, 0.14, 0.14, 16.0, 16.3, 'em_neon_rosa', mat='mat_emissivo', cx=-4.4)
    beam(m, (6.8, 12.5, 0), (6.8, 14.5, 0), 0.1, 0.1, 'metallo')
    face(m, [(0.4, 6.0, -1.3), (2.4, 6.0, -1.3), (2.4, 7.0, -1.3), (0.4, 7.0, -1.3)], 'em_insegna', (0, 0, -1), mat='mat_emissivo', uv='fit')
    # molo di cemento con fila di lampioni
    m.box(-8.4, 0, -3.2, 8.4, 0.5, -1.6, 'cemento', top='cemento', skip=('bottom', 'back'))
    for x in (-6, -2, 2, 6):
        beam(m, (x, 0.5, -3.0), (x, 3.0, -3.0), 0.08, 0.08, 'metallo')
        m.prism(4, 0.16, 0.16, 3.0, 3.25, 'em_neon_ciano', mat='mat_emissivo', cx=x, cz=-3.0)
    return _obj(m, **FP(17, 7))


def fac_selvaggia():
    """Isola Selvaggia: collina di roccia ed erba con palme in controluce, 16 × 6 m, fino a 9 m."""
    m = Mesh('fac_selvaggia')
    # dorso di collina: profilo a 9 punti estruso, facce superiori d'erba, fianco davanti di roccia
    prof = [(-8.0, 0.0), (-6.5, 2.2), (-4.5, 3.4), (-2.5, 6.5), (-0.8, 8.8), (1.0, 7.4), (3.2, 5.0), (5.5, 3.6), (8.0, 0.0)]
    zf, zb, zt = -2.0, 2.5, 0.3
    for (xa, ya), (xb, yb) in zip(prof, prof[1:]):
        face(m, [(xa, 0, zf), (xb, 0, zf), (xb, yb * 0.55, zf - 0.4), (xa, ya * 0.55, zf - 0.4)], 'roccia_lato', (0, 0, -1))
        face(m, [(xa, ya * 0.55, zf - 0.4), (xb, yb * 0.55, zf - 0.4), (xb, yb, zt), (xa, ya, zt)], 'erba_alta', (0, 0.4, -1))
        face(m, [(xa, ya, zt), (xb, yb, zt), (xb, yb * 0.7, zb), (xa, ya * 0.7, zb)], 'erba_alta', (0, 1, 0.3))
    # scogli in acqua e spiaggia davanti
    m.box(-7.5, 0, -3.6, 7.5, 0.25, -2.0, 'sabbia_lato', top='sabbia', skip=('bottom', 'back'))
    for i, (x, z, r) in enumerate(((-6.8, -3.9, 0.7), (4.8, -4.0, 0.9), (7.2, -3.4, 0.6))):
        m.cone(5, r, 0.0, r * 1.6, 'roccia', cx=x, cz=z, a0=h01(i, 2, 5) * 3)
    # palme: tronco inclinato e 5 foglie piatte (silhouette)
    for i, (x, z, h, lean) in enumerate(((-5.2, -2.6, 4.2, 0.6), (-4.0, -2.9, 3.4, -0.5), (3.6, -2.8, 4.6, -0.7), (6.0, -2.6, 3.8, 0.4), (0.8, 2.0, 11.5, 0.3))):
        y0 = 0.25 if z < -2 else 6.0
        top = (x + lean, y0 + h if z < -2 else y0 + 3.6, z)
        beam(m, (x, y0, z), top, 0.24, 0.24, 'tronco_palma', n=4)
        for k in range(5):
            a = 2 * math.pi * k / 5 + i
            tip = (top[0] + math.cos(a) * 1.5, top[1] - 0.6, top[2] + math.sin(a) * 1.5)
            side = (-math.sin(a) * 0.35, 0, math.cos(a) * 0.35)
            mid = (top[0] + math.cos(a) * 0.8, top[1] + 0.2, top[2] + math.sin(a) * 0.8)
            face(m, [top, (mid[0] + side[0], mid[1], mid[2] + side[2]), tip, (mid[0] - side[0], mid[1], mid[2] - side[2])], 'foglia_palma', (0, 1, 0))
            face(m, [top, (mid[0] + side[0], mid[1], mid[2] + side[2]), tip, (mid[0] - side[0], mid[1], mid[2] - side[2])], 'foglia_palma', (0, -1, 0))
    return _obj(m, **FP(16, 7))


MODELS = {f.__name__: f for f in (
    bld_segheria_l2, bld_segheria_l3, bld_cava_l2, bld_cava_l3, bld_magazzino_l2, bld_magazzino_l3,
    bld_casa_l2, bld_casa_l3, bld_tavolo_l2, bld_tavolo_l3, bld_faro_l2,
    bld_cantiere, prop_deposito, prop_molo_l2, prop_molo_l3,
    bld_porto_casa_a, bld_porto_casa_b, bld_porto_casa_c, bld_porto_tavolo,
    prop_boa, prop_boa_next, prop_filo_lanterne, fac_neon, fac_selvaggia)}
