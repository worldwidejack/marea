# Prop (50-200 tri) e barca (≤ 600 tri). Pivot a terra al centro, davanti −Z.
import math
from lib import Mesh, Xf, beam, face, log, empty
from atlas import h01
from models_edifici import lantern


def _obj(m):
    return [m.build()]


def prop_lanterna():
    """Lampione del porto: palo con braccio e lanterna di carta accesa."""
    m = Mesh('prop_lanterna')
    m.prism(6, 0.16, 0.13, 0.0, 0.12, 'pietra_p', top='pietra_liscia')
    beam(m, (0, 0.12, 0), (0, 2.0, 0), 0.09, 0.09, 'legno_scuro', end='legno_scuro')
    beam(m, (0, 1.9, 0), (0, 1.9, -0.45), 0.07, 0.07, 'legno_scuro', end='legno_scuro')
    beam(m, (0, 1.55, 0), (0, 1.88, -0.3), 0.05, 0.05, 'legno_scuro')
    lantern(m, 0, 1.5, -0.42, r=0.15, h=0.34)
    return _obj(m)


def prop_torii():
    m = Mesh('prop_torii')
    W, H = 1.25, 2.6
    for sx in (-1, 1):
        m.prism(8, 0.13, 0.11, 0.0, H, 'rosso_lacca', cx=sx * W * 0.8)
        m.prism(8, 0.17, 0.17, 0.0, 0.22, 'nero_lacca', top='nero_lacca', cx=sx * W * 0.8)  # zoccolo nero
    # nuki (traversa bassa) e shimaki/kasagi (architrave curvo in 3 pezzi, estremità rialzate)
    beam(m, (-W * 1.05, H - 0.55, 0), (W * 1.05, H - 0.55, 0), 0.12, 0.16, 'rosso_lacca', end='rosso_lacca')
    beam(m, (-W * 0.35, H + 0.02, 0), (W * 0.35, H + 0.02, 0), 0.16, 0.2, 'rosso_lacca', end=None)
    beam(m, (-W * 0.35, H + 0.2, 0), (W * 0.35, H + 0.2, 0), 0.22, 0.14, 'nero_lacca', end=None)
    for sx in (-1, 1):
        beam(m, (sx * W * 0.35, H + 0.02, 0), (sx * W * 1.25, H + 0.12, 0), 0.16, 0.2, 'rosso_lacca', end='rosso_lacca')
        beam(m, (sx * W * 0.35, H + 0.2, 0), (sx * W * 1.35, H + 0.36, 0), 0.22, 0.14, 'nero_lacca', end='nero_lacca')
    # targa centrale
    m.box(-0.14, H - 0.47, -0.08, 0.14, H - 0.05, 0.08, 'nero_lacca', skip=('bottom', 'top'))
    return _obj(m)


def prop_palma():
    m = Mesh('prop_palma')
    # tronco curvo a 5 segmenti esagonali che si assottigliano
    pts = [(0, 0, 0), (0.08, 0.9, 0.02), (0.25, 1.8, 0.05), (0.5, 2.6, 0.08), (0.8, 3.3, 0.1)]
    rs = [0.17, 0.14, 0.12, 0.1, 0.09]
    rings = []
    for (x, y, z), r in zip(pts, rs):
        rings.append(m.ring(6, r, y, cx=x, cz=z))
    m.loft(rings, 'tronco_palma')
    top = pts[-1]
    m.cone(6, 0.12, top[1], top[1] + 0.18, 'foglia_palma', cx=top[0], cz=top[2])
    # foglie: lame ad arco con due falde (a V) sopra e sotto, 2 segmenti
    for i in range(6):
        a = 2 * math.pi * i / 6 + 0.4
        L = 1.35 + 0.25 * h01(i, 1, 3)
        dx, dz = math.cos(a), math.sin(a)
        px, pz = -dz, dx
        base = (top[0], top[1] + 0.12, top[2])
        mid = (base[0] + dx * L * 0.55, base[1] + 0.22, base[2] + dz * L * 0.55)
        tip = (base[0] + dx * L, base[1] - 0.45, base[2] + dz * L)
        w = 0.28
        ml = (mid[0] + px * w, mid[1] - 0.08, mid[2] + pz * w)
        mr = (mid[0] - px * w, mid[1] - 0.08, mid[2] - pz * w)
        for a_, b_, c_, d_ in ((base, ml, tip, mid), (base, mid, tip, mr)):
            up = (0, 1, 0)
            face(m, [a_, b_, c_, d_] if False else [a_, b_, d_], 'foglia_palma', up)
            face(m, [b_, c_, d_], 'foglia_palma', up)
            face(m, [a_, b_, d_], 'foglia_palma', (0, -1, 0))
            face(m, [b_, c_, d_], 'foglia_palma', (0, -1, 0))
    for i in range(3):
        a = 2 * math.pi * i / 3
        cx, cz = top[0] + math.cos(a) * 0.12, top[2] + math.sin(a) * 0.12
        m.cone(4, 0.08, top[1] - 0.05, top[1] - 0.2, 'cocco', cx=cx, cz=cz)
        m.cone(4, 0.08, top[1] - 0.05, top[1] + 0.07, 'cocco', cx=cx, cz=cz)
    return _obj(m)


def prop_cassa():
    m = Mesh('prop_cassa')
    s = 0.4
    m.box(-s, 0, -s, s, 2 * s, s, 'cassa', skip=('bottom',))
    for x in (-s, s):
        for z in (-s, s):
            beam(m, (x, 0, z), (x, 2 * s, z), 0.09, 0.09, 'legno_scuro', end='legno_scuro')
    for z in (-s - 0.01, s + 0.01):
        beam(m, (-s, 0.05, z), (s, 2 * s - 0.05, z), 0.07, 0.04, 'legno_scuro')  # croce di rinforzo
    for x in (-s - 0.01, s + 0.01):
        beam(m, (x, 0.05, -s), (x, 2 * s - 0.05, s), 0.04, 0.07, 'legno_scuro')
    return _obj(m)


def prop_insegna_neon():
    m = Mesh('prop_insegna_neon')
    beam(m, (0, 0, 0), (0, 2.3, 0), 0.1, 0.1, 'metallo', end='metallo')
    m.box(-0.2, 0, -0.2, 0.2, 0.08, 0.2, 'metallo', skip=('bottom',))
    # cassonetto con la scritta accesa davanti e dietro
    x0, x1, y0, y1, z0, z1 = -0.62, 0.62, 1.6, 2.2, -0.08, 0.08
    m.box(x0, y0, z0, x1, y1, z1, 'insegna_fondo', skip=('front', 'back'))
    face(m, [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)], 'em_insegna', (0, 0, -1), mat='mat_emissivo', uv='fit')
    face(m, [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], 'em_insegna', (0, 0, 1), mat='mat_emissivo', uv='fit')
    # tubo neon ciano sopra e freccia rosa di lato
    beam(m, (x0, y1 + 0.06, 0), (x1, y1 + 0.06, 0), 0.04, 0.04, 'em_neon_ciano', end='em_neon_ciano', mat='mat_emissivo')
    beam(m, (x0 + 0.1, y0 - 0.1, 0), (x1 - 0.1, y0 - 0.1, 0), 0.03, 0.03, 'em_neon_rosa', end='em_neon_rosa', mat='mat_emissivo')
    for x in (x0 + 0.1, x1 - 0.1):
        beam(m, (x, y1, 0), (x, y1 + 0.06, 0), 0.02, 0.02, 'metallo')
    return _obj(m)


def prop_barile():
    m = Mesh('prop_barile')
    n = 8
    rings = [m.ring(n, 0.24, 0.0), m.ring(n, 0.29, 0.25), m.ring(n, 0.29, 0.55), m.ring(n, 0.24, 0.8)]
    m.loft(rings, 'barile', top=None, bottom=None)
    m.poly(list(reversed(m.ring(n, 0.22, 0.78))), 'taglio')
    m.loft([m.ring(n, 0.24, 0.8), m.ring(n, 0.22, 0.78)], 'legno_scuro')
    m.prism(3, 0.03, 0.03, 0.78, 0.83, 'ferro', top='ferro', cx=0.08, cz=0.05)  # tappo
    return _obj(m)


def boat_barca():
    """Barca a remi di legno, 4,5 m, prua verso −Z; sedile e timone a poppa. Ancore: nodi `sedile` e `timone`."""
    m = Mesh('boat_barca')
    # sezioni: (z, mezza larghezza al bordo, al ginocchio, quota bordo, quota ginocchio, quota chiglia)
    S = [(2.2, 0.56, 0.44, 0.62, 0.22, 0.1), (1.3, 0.74, 0.6, 0.58, 0.18, 0.0), (0.0, 0.78, 0.62, 0.58, 0.17, 0.0),
         (-1.2, 0.64, 0.5, 0.62, 0.2, 0.02), (-1.85, 0.36, 0.26, 0.72, 0.3, 0.14), (-2.3, 0.0, 0.0, 0.88, 0.62, 0.5)]
    def pts(sec, sx, inset=0.0):
        z, wg, wc, yg, yc, yk = sec
        return [(sx * max(0.0, wg - inset), yg, z), (sx * max(0.0, wc - inset), yc + inset, z), (0.0, yk + inset * 1.6, z)]
    for a, b in zip(S, S[1:]):
        for sx in (1, -1):
            A, B = pts(a, sx), pts(b, sx)
            face(m, [A[0], B[0], B[1], A[1]], 'scafo', (sx, -0.2, 0))
            face(m, [A[1], B[1], B[2], A[2]], 'scafo_chiglia', (sx, -1, 0))
            Ai, Bi = pts(a, sx, 0.05), pts(b, sx, 0.05)
            face(m, [Ai[0], Bi[0], Bi[1], Ai[1]], 'legno_pieno', (-sx, 0.3, 0))
            face(m, [Ai[1], Bi[1], Bi[2], Ai[2]], 'tavole', (-sx, 1, 0))
            face(m, [A[0], B[0], Bi[0], Ai[0]], 'legno_scuro', (0, 1, 0))  # capodibanda
    # specchio di poppa
    for sx in (1, -1):
        A, Ai = pts(S[0], sx), pts(S[0], sx, 0.05)
        face(m, [A[0], A[1], A[2], (0, A[0][1], A[0][2])], 'scafo', (0, 0, 1))
        face(m, [Ai[0], Ai[1], Ai[2], (0, Ai[0][1], Ai[0][2])], 'legno_pieno', (0, 0, -1))
        face(m, [A[0], Ai[0], (0, Ai[0][1], Ai[0][2]), (0, A[0][1], A[0][2])], 'legno_scuro', (0, 1, 0))
    # sedili (banchi) e pagliolo
    for z, w in ((0.9, 0.66), (-0.5, 0.66), (1.85, 0.5)):
        m.box(-w, 0.4, z - 0.14, w, 0.46, z + 0.14, 'panca', skip=('bottom',))
    m.box(-0.35, 0.12, -1.0, 0.35, 0.15, 1.6, 'tavole', skip=('bottom', 'left', 'right', 'front', 'back'))
    # timone: pala dietro lo specchio + barra verso il sedile di poppa
    m.box(-0.03, -0.25, 2.24, 0.03, 0.55, 2.52, 'legno_pieno', top='legno_scuro')
    beam(m, (0, 0.6, 2.38), (0, 0.7, 1.75), 0.05, 0.05, 'legno_scuro', end='legno_scuro')
    # remi appoggiati sui banchi
    for sx in (1, -1):
        beam(m, (sx * 0.5, 0.5, 1.4), (sx * 0.25, 0.5, -1.1), 0.05, 0.05, 'remo', end='remo')
        beam(m, (sx * 0.25, 0.5, -1.1), (sx * 0.2, 0.5, -1.55), 0.14, 0.02, 'remo', end='remo')
        beam(m, (sx * 0.74, 0.6, 0.35), (sx * 0.74, 0.72, 0.35), 0.03, 0.03, 'ferro')  # scalmi
    # palo di prua con lanterna, rotolo di cima
    beam(m, (0, 0.6, -1.95), (0, 1.25, -2.05), 0.05, 0.05, 'legno_scuro', end='legno_scuro')
    lantern(m, 0, 1.05, -2.2, r=0.09, h=0.2)
    beam(m, (0, 1.22, -2.05), (0, 1.22, -2.2), 0.03, 0.03, 'legno_scuro')
    m.prism(8, 0.15, 0.15, 0.15, 0.22, 'corda', top='corda', cx=0.2, cz=-1.3)
    ob = m.build()
    a1 = empty('sedile', (0, 0.46, 0.9)); a2 = empty('timone', (0, 0.7, 1.75))
    a1.parent = ob; a2.parent = ob
    return [ob, a1, a2], {'anchors': {'sedile': [0, 0.46, 0.9], 'timone': [0, 0.7, 1.75], 'lunghezza': 4.5}}


MODELS = {f.__name__: f for f in (boat_barca, prop_lanterna, prop_torii, prop_palma, prop_cassa, prop_insegna_neon, prop_barile)}
