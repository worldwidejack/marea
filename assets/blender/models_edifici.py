# Edifici livello 1: base 2x2 m, pivot a terra al centro, davanti −Z, 300-800 tri.
import math
from lib import Mesh, Xf, beam, face, roof, log
from atlas import h01


def _obj(m):
    return [m.build()]


def lantern(m, x, y, z, r=0.13, h=0.3):
    """Lanterna di carta appesa (corpo emissivo) con cappello e fondo scuri."""
    m.loft([m.ring(6, r * 0.7, y - h / 2, cx=x, cz=z), m.ring(6, r, y - h / 4, cx=x, cz=z), m.ring(6, r, y + h / 4, cx=x, cz=z), m.ring(6, r * 0.7, y + h / 2, cx=x, cz=z)],
           'em_lanterna', mat='mat_emissivo')
    m.prism(6, r * 0.75, r * 0.5, y + h / 2, y + h / 2 + 0.05, 'nero_lacca', top='nero_lacca', cx=x, cz=z)
    m.prism(6, r * 0.5, r * 0.75, y - h / 2 - 0.05, y - h / 2, 'nero_lacca', bottom='nero_lacca', cx=x, cz=z)
    m.prism(3, 0.015, 0.015, y + h / 2 + 0.05, y + h / 2 + 0.2, 'corda', cx=x, cz=z)


def bld_casa_l1():
    m = Mesh('bld_casa_l1')
    # zoccolo di pietra e gradino
    m.box(-0.9, 0, -0.9, 0.9, 0.25, 0.9, 'pietra_muro', top='pietra_liscia', skip=('bottom',))
    m.box(-0.35, 0, -1.05, 0.35, 0.12, -0.9, 'pietra_muro', top='pietra_liscia', skip=('bottom', 'back'))
    # pareti: carta (shoji) davanti, tavole scure ai lati e dietro
    x0, x1, z0, z1, y0, y1 = -0.75, 0.75, -0.72, 0.72, 0.25, 1.75
    m.box(x0, y0, z0, x1, y1, z1, 'tavole_scure', skip=('bottom', 'top', 'front'))
    face(m, [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)], 'carta', (0, 0, -1))
    # porta scorrevole socchiusa (buio dentro) e finestre accese ai lati
    face(m, [(-0.3, y0 + 0.02, z0 - 0.02), (0.05, y0 + 0.02, z0 - 0.02), (0.05, 1.45, z0 - 0.02), (-0.3, 1.45, z0 - 0.02)], 'em_finestra', (0, 0, -1), mat='mat_emissivo')
    m.box(0.05, y0, z0 - 0.06, 0.4, 1.5, z0 - 0.02, 'tavole_scure', skip=('bottom',))
    for sx in (-1, 1):
        x = sx * (x1 + 0.01)
        face(m, [(x, 0.8, -0.3), (x, 0.8, 0.3), (x, 1.25, 0.3), (x, 1.25, -0.3)], 'em_finestra', (sx, 0, 0), mat='mat_emissivo')
        beam(m, (x + sx * 0.03, 0.78, -0.35), (x + sx * 0.03, 0.78, 0.35), 0.06, 0.05, 'legno_scuro')  # davanzale
    # pilastri d'angolo e trave di bordo
    for x in (x0, x1):
        for z in (z0, z1):
            beam(m, (x, 0.25, z), (x, 1.85, z), 0.12, 0.12, 'legno_scuro', end=None)
    beam(m, (x0 - 0.08, 1.8, z0), (x1 + 0.08, 1.8, z0), 0.12, 0.12, 'legno_scuro', end='legno_scuro')
    beam(m, (x0 - 0.08, 1.8, z1), (x1 + 0.08, 1.8, z1), 0.12, 0.12, 'legno_scuro', end='legno_scuro')
    # frontone (triangolo di tavole) sui due lati corti
    for x, sx in ((x0, -1), (x1, 1)):
        face(m, [(x, 1.75, z0), (x, 1.75, z1), (x, 2.45, 0)], 'tavole_scure', (sx, 0, 0))
    roof(m, -1.02, 1.02, 0.0, 1.08, 1.62, 2.55, curl=0.18)
    # lanterna rossa appesa alla gronda, a destra della porta
    lantern(m, 0.62, 1.3, -0.98)
    beam(m, (0.62, 1.52, -0.98), (0.62, 1.66, -0.9), 0.02, 0.02, 'corda')
    # vaso con piantina e panca davanti
    m.prism(6, 0.12, 0.16, 0.25, 0.45, 'pietra_p', top='terra', cx=-0.6, cz=-0.82)
    m.cone(5, 0.14, 0.45, 0.72, 'erba_alta', cx=-0.6, cz=-0.82)
    m.box(0.45, 0.4, 0.95, 0.95 - 0.1, 0.46, 1.1, 'panca', skip=('bottom',))
    for x in (0.5, 0.8):
        beam(m, (x, 0.0, 1.02), (x, 0.4, 1.02), 0.05, 0.1, 'legno_scuro')
    # grondaia di bambù e barile per l'acqua sul retro-sinistra
    m.prism(8, 0.16, 0.16, 0.0, 0.42, 'barile', top='acqua_bassa', cx=-0.95, cz=0.75)
    # travi del colmo sporgenti sul frontone
    for x, sx in ((x0, -1), (x1, 1)):
        beam(m, (x, 2.1, -0.02), (x + sx * 0.25, 2.1, -0.02), 0.08, 0.08, 'legno_scuro', end='legno_scuro')
    return _obj(m)


def bld_segheria_l1():
    m = Mesh('bld_segheria_l1')
    # pedana di tavole
    m.box(-0.95, 0, -0.95, 0.95, 0.12, 0.95, 'legno_pieno', top='tavole', skip=('bottom',))
    # tettoia a una falda su 4 pali (dietro più alti)
    for x in (-0.85, 0.15):
        beam(m, (x, 0.12, -0.2), (x, 1.75, -0.2), 0.12, 0.12, 'corteccia', end='taglio')
        beam(m, (x, 0.12, 0.85), (x, 2.2, 0.85), 0.12, 0.12, 'corteccia', end='taglio')
    beam(m, (-0.95, 1.72, -0.2), (0.25, 1.72, -0.2), 0.1, 0.1, 'legno_scuro', end='legno_scuro')
    beam(m, (-0.95, 2.17, 0.85), (0.25, 2.17, 0.85), 0.1, 0.1, 'legno_scuro', end='legno_scuro')
    # falda: tavole con spessore
    y_f, y_b, t = 1.78, 2.24, 0.06
    zf, zb, xl, xr = -0.42, 1.0, -1.02, 0.35
    face(m, [(xl, y_f, zf), (xr, y_f, zf), (xr, y_b, zb), (xl, y_b, zb)], 'paglia', (0, 1, -0.3))
    face(m, [(xl, y_f - t, zf), (xr, y_f - t, zf), (xr, y_b - t, zb), (xl, y_b - t, zb)], 'legno_scuro', (0, -1, 0))
    face(m, [(xl, y_f, zf), (xr, y_f, zf), (xr, y_f - t, zf), (xl, y_f - t, zf)], 'legno_scuro', (0, 0, -1))
    face(m, [(xl, y_b, zb), (xr, y_b, zb), (xr, y_b - t, zb), (xl, y_b - t, zb)], 'legno_scuro', (0, 0, 1))
    for x, sx in ((xl, -1), (xr, 1)):
        face(m, [(x, y_f, zf), (x, y_b, zb), (x, y_b - t, zb), (x, y_f - t, zf)], 'legno_scuro', (sx, 0, 0))
    # cavalletto con tronco e sega
    for x in (-0.65, -0.05):
        beam(m, (x - 0.12, 0.12, 0.2), (x + 0.1, 0.62, 0.3), 0.06, 0.06, 'legno_pieno')
        beam(m, (x + 0.12, 0.12, 0.2), (x - 0.1, 0.62, 0.3), 0.06, 0.06, 'legno_pieno')
    log(m, (-0.95, 0.68, 0.3), (0.2, 0.68, 0.3), 0.13)
    m.push(Xf(t=(-0.3, 0.8, 0.3), r=(0, 0, 0)))
    m.box(-0.02, 0.0, -0.22, 0.02, 0.28, 0.22, 'ferro', skip=('bottom',))       # lama
    m.box(-0.04, 0.28, -0.06, 0.04, 0.4, 0.06, 'legno_scuro', skip=('bottom',))  # manico
    m.pop()
    # catasta di tronchi 3+2+1 a destra, lungo Z
    rs = 0.14
    for row, n in enumerate((3, 2, 1)):
        for i in range(n):
            x = 0.45 + (i - (n - 1) / 2) * 2 * rs * 1.02 + 0.08
            y = 0.12 + rs + row * rs * 1.72
            z0 = -0.85 + h01(row, i, 5) * 0.12
            log(m, (x, y, z0), (x, y, 0.75 - h01(i, row, 6) * 0.15), rs)
    # paletti che tengono la catasta
    for x in (0.12, 0.98):
        beam(m, (x, 0.12, -0.3), (x, 0.9, -0.3), 0.07, 0.07, 'corteccia', end='taglio')
    # ceppo con accetta
    m.prism(7, 0.17, 0.16, 0.12, 0.42, 'corteccia', top='taglio', cx=-0.55, cz=-0.65)
    beam(m, (-0.5, 0.42, -0.65), (-0.35, 0.8, -0.75), 0.04, 0.04, 'remo')
    m.box(-0.47, 0.36, -0.7, -0.38, 0.48, -0.6, 'ferro', skip=('bottom',))
    return _obj(m)


def bld_cava_l1():
    m = Mesh('bld_cava_l1')
    # parete di roccia sfaccettata dietro (fronte tagliato piatto verso −Z)
    sq = [(1, 0), (1, 0.6), (0.75, 1), (0, 1), (-0.75, 1), (-1, 0.6), (-1, 0)]
    def ring(y, k, s):
        pts = []
        for i, (x, z) in enumerate(sq):
            j = k * (0.6 + 0.8 * h01(i, s, 11))
            pts.append((x * (0.95 - j), y + (h01(i, s, 12) - 0.5) * 0.2, 0.15 + z * (0.8 - j)))
        return pts
    rings = [ring(0, 0.0, 1), ring(0.7, 0.06, 2), ring(1.35, 0.14, 3), ring(1.9, 0.24, 4), ring(2.3, 0.42, 5)]
    for a, b in zip(rings, rings[1:]):
        for i in range(len(sq) - 1):
            face(m, [a[i], a[i + 1], b[i + 1], b[i]], 'roccia_lato', (a[i][0] + a[i + 1][0], 0.2, a[i][2] + a[i + 1][2] - 0.3))
    top = (0.0, 2.55, 0.35)
    r3 = rings[-1]
    for i in range(len(sq) - 1):
        face(m, [r3[i], r3[i + 1], top], 'roccia', (0, 1, 0.2))
    # fronte tagliato a gradoni (blocchi di pietra chiara) — chiude la forma sul lato −Z
    face(m, [rings[0][0], rings[0][-1]] + [r[-1] for r in rings[1:]] + [top] + [r[0] for r in reversed(rings[1:])], 'roccia', (0, 0, -1))
    m.box(-0.8, 0, -0.35, 0.8, 0.45, 0.15, 'pietra_p', top='pietra_liscia', skip=('bottom', 'back'))
    m.box(-0.6, 0.45, -0.1, 0.55, 0.95, 0.15, 'pietra_p', top='pietra_liscia', skip=('bottom', 'back'))
    # impalcatura di legno a sinistra: 4 pali, piano, controvento, scala
    X0, X1, Z0, Z1 = -0.95, -0.25, -0.75, -0.3
    for x in (X0, X1):
        for z in (Z0, Z1):
            beam(m, (x, 0, z), (x, 1.75, z), 0.07, 0.07, 'corteccia', end='taglio')
    m.box(X0 - 0.05, 1.1, Z0 - 0.05, X1 + 0.05, 1.16, Z1 + 0.05, 'legno_pieno', top='tavole')
    beam(m, (X0, 0.15, Z0), (X1, 1.05, Z0), 0.05, 0.04, 'legno_pieno')
    beam(m, (X0, 1.7, Z0), (X1, 1.7, Z0), 0.06, 0.06, 'legno_scuro')
    beam(m, (X0, 1.7, Z1), (X1, 1.7, Z1), 0.06, 0.06, 'legno_scuro')
    # scala a pioli appoggiata al piano
    for dx in (0.0, 0.3):
        beam(m, (0.0 + dx - 0.15, 0, -1.0), (-0.3 + dx - 0.15, 1.16, -0.8), 0.05, 0.05, 'legno_pieno')
    for k in range(1, 4):
        t = k / 4
        beam(m, (-0.15 - 0.3 * t, 1.16 * t, -1.0 + 0.2 * t), (0.15 - 0.3 * t, 1.16 * t, -1.0 + 0.2 * t), 0.035, 0.035, 'remo')
    # carrucola: trave a sbalzo con corda e secchio di pietre
    beam(m, (X1, 1.75, -0.52), (0.35, 1.95, -0.52), 0.07, 0.07, 'legno_scuro', end='legno_scuro')
    beam(m, (0.3, 1.93, -0.52), (0.3, 1.2, -0.52), 0.02, 0.02, 'corda')
    m.prism(6, 0.12, 0.14, 0.95, 1.2, 'secchio', top='ghiaia', bottom='legno_scuro', cx=0.3, cz=-0.52)
    # blocchi squadrati pronti e un piccone
    m.box(0.35, 0, -0.95, 0.75, 0.3, -0.6, 'pietra_p', top='pietra_liscia', skip=('bottom',))
    m.box(0.45, 0.3, -0.9, 0.7, 0.5, -0.68, 'pietra_p', top='pietra_liscia', skip=('bottom',))
    beam(m, (0.85, 0, -0.45), (0.8, 0.7, -0.3), 0.035, 0.035, 'remo')
    for i, (x, z, r) in enumerate(((0.1, -0.7, 0.14), (-0.1, -0.85, 0.1), (0.2, -0.95, 0.09), (0.9, 0.3, 0.2), (-0.9, 0.5, 0.18))):
        m.cone(5, r, 0.0, r * 1.2, 'roccia', cx=x, cz=z, a0=h01(i, 3, 7) * 3)
    beam(m, (0.68, 0.72, -0.3), (0.92, 0.66, -0.3), 0.04, 0.04, 'ferro', end='ferro')
    return _obj(m)


def bld_magazzino_l1():
    m = Mesh('bld_magazzino_l1')
    m.box(-0.95, 0, -0.9, 0.95, 0.18, 0.9, 'pietra_muro', top='pietra_liscia', skip=('bottom',))
    x0, x1, z0, z1 = -0.85, 0.85, -0.7, 0.8
    m.box(x0, 0.18, z0, x1, 1.6, z1, 'tavole_scure', skip=('bottom', 'top'))
    # grande portone a due ante con traversa a X
    face(m, [(-0.5, 0.18, z0 - 0.02), (0.5, 0.18, z0 - 0.02), (0.5, 1.3, z0 - 0.02), (-0.5, 1.3, z0 - 0.02)], 'legno_scuro', (0, 0, -1))
    for sx in (-1, 1):
        beam(m, (sx * 0.47, 0.22, z0 - 0.04), (sx * 0.03, 1.26, z0 - 0.04), 0.05, 0.03, 'legno_pieno')
    beam(m, (-0.55, 1.33, z0 - 0.05), (0.55, 1.33, z0 - 0.05), 0.08, 0.08, 'legno_scuro', end='legno_scuro')
    for x in (x0, x1):
        for z in (z0, z1):
            beam(m, (x, 0.18, z), (x, 1.7, z), 0.12, 0.12, 'legno_scuro')
    for x, sx in ((x0, -1), (x1, 1)):
        face(m, [(x, 1.6, z0), (x, 1.6, z1), (x, 2.2, 0.05)], 'tavole_scure', (sx, 0, 0))
    roof(m, -0.98, 0.98, 0.05, 0.98, 1.5, 2.3, curl=0.14)
    # casse e sacchi davanti
    m.box(0.55, 0.18, -0.95, 0.9, 0.5, -0.72, 'cassa', skip=('bottom',))
    m.box(0.6, 0.5, -0.92, 0.85, 0.7, -0.74, 'cassa', skip=('bottom',))
    m.prism(6, 0.15, 0.12, 0.18, 0.48, 'tela', top='tela', cx=-0.72, cz=-0.85)
    m.prism(6, 0.13, 0.1, 0.18, 0.44, 'tela', top='tela', cx=-0.62, cz=-1.0)
    m.prism(8, 0.17, 0.17, 0.18, 0.65, 'barile', top='taglio', cx=0.95, cz=0.1)
    m.prism(8, 0.2, 0.2, 0.18, 0.26, 'corda', top='corda', cx=-0.95, cz=0.2)
    m.box(-0.3, 1.38, -0.8, 0.3, 1.52, -0.76, 'insegna_fondo', skip=('bottom',))
    lantern(m, -0.7, 1.15, -0.88, r=0.1, h=0.22)
    for sx in (-1, 1):
        x = sx * 0.86
        face(m, [(x, 0.8, 0.1), (x, 0.8, 0.5), (x, 1.2, 0.5), (x, 1.2, 0.1)], 'em_finestra', (sx, 0, 0), mat='mat_emissivo')
    return _obj(m)


def bld_tavolo_l1():
    m = Mesh('bld_tavolo_l1')
    m.box(-0.9, 0, -0.9, 0.9, 0.08, 0.9, 'pietra_liscia', top='ghiaia', skip=('bottom',))
    # tavolo basso con scacchiera
    m.box(-0.5, 0.45, -0.35, 0.5, 0.55, 0.35, 'legno_pieno', top='tavole', skip=('bottom',))
    face(m, [(-0.3, 0.552, -0.25), (0.3, 0.552, -0.25), (0.3, 0.552, 0.25), (-0.3, 0.552, 0.25)], 'rete', (0, 1, 0))
    for x in (-0.42, 0.42):
        for z in (-0.28, 0.28):
            beam(m, (x, 0.08, z), (x, 0.45, z), 0.07, 0.07, 'legno_scuro')
    # due sgabelli
    for z in (-0.65, 0.65):
        m.prism(6, 0.16, 0.16, 0.08, 0.35, 'barile', top='taglio', cx=0.0, cz=z)
    # stendardo rosso con asta
    beam(m, (0.78, 0.08, 0.7), (0.78, 2.0, 0.7), 0.06, 0.06, 'legno_scuro', end='legno_scuro')
    face(m, [(0.8, 1.95, 0.68), (0.8, 1.95, 0.2), (0.8, 1.2, 0.2), (0.8, 1.2, 0.68)], 'bandiera', (1, 0, 0))
    face(m, [(0.79, 1.95, 0.68), (0.79, 1.95, 0.2), (0.79, 1.2, 0.2), (0.79, 1.2, 0.68)], 'bandiera', (-1, 0, 0))
    for x, z in ((-0.78, -0.78), (-0.78, 0.78)):
        beam(m, (x, 0.08, z), (x, 1.2, z), 0.07, 0.07, 'legno_scuro', end='legno_scuro')
        beam(m, (x, 1.2, z), (x + 0.22, 1.2, z), 0.05, 0.05, 'legno_scuro', end='legno_scuro')
        lantern(m, x + 0.2, 0.92, z, r=0.1, h=0.22)
    # panca lunga dietro e pedine sulla scacchiera
    m.box(-0.5, 0.3, 0.7, 0.5, 0.36, 0.88, 'panca', skip=('bottom',))
    for x in (-0.4, 0.4):
        beam(m, (x, 0.08, 0.79), (x, 0.3, 0.79), 0.06, 0.12, 'legno_scuro')
    for i, (x, z) in enumerate(((-0.2, -0.15), (0.1, -0.05), (0.2, 0.15), (-0.1, 0.1))):
        m.prism(5, 0.03, 0.02, 0.555, 0.62, 'nero_p' if i % 2 else 'oro_perla', top='nero_p' if i % 2 else 'oro_perla', cx=x, cz=z)
    return _obj(m)


def bld_faro_l1():
    m = Mesh('bld_faro_l1')
    m.prism(8, 0.95, 0.9, 0, 0.3, 'pietra_muro', top='pietra_liscia')
    bands = [(0.3, 1.3, 'faro_bianco'), (1.3, 2.3, 'faro_rosso'), (2.3, 3.3, 'faro_bianco'), (3.3, 4.2, 'faro_rosso')]
    r = lambda y: 0.72 - (y - 0.3) * 0.075
    for y0, y1, reg in bands:
        m.prism(10, r(y0), r(y1), y0, y1, reg)
    face(m, [(-0.15, 0.3, -r(0.3) - 0.01), (0.15, 0.3, -r(0.3) - 0.01), (0.15, 0.95, -r(0.95) - 0.01), (-0.15, 0.95, -r(0.95) - 0.01)], 'legno_scuro', (0, 0, -1))
    m.prism(10, 0.62, 0.62, 4.2, 4.3, 'nero_lacca', top='metallo', bottom='nero_lacca')
    for i in range(7):
        a = 2 * math.pi * i / 7 + 0.3
        m.cone(5, 0.2 + 0.1 * h01(i, 1, 9), 0.0, 0.35 + 0.2 * h01(i, 2, 9), 'roccia', cx=math.cos(a) * 0.92, cz=math.sin(a) * 0.92 + (0.05 if i else 0))
    beam(m, (-0.2, 1.0, -0.66), (0.2, 1.0, -0.66), 0.08, 0.08, 'nero_lacca', end='nero_lacca')
    face(m, [(-0.14, 1.6, -0.62), (0.14, 1.6, -0.62), (0.14, 1.9, -0.6), (-0.14, 1.9, -0.6)], 'em_finestra', (0, 0, -1), mat='mat_emissivo')
    # stanza della luce (emissiva) e cupola
    m.prism(8, 0.36, 0.36, 4.3, 4.85, 'em_faro', mat='mat_emissivo')
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        beam(m, (math.cos(a) * 0.37, 4.3, math.sin(a) * 0.37), (math.cos(a) * 0.37, 4.85, math.sin(a) * 0.37), 0.04, 0.04, 'nero_lacca')
    m.cone(8, 0.45, 4.85, 5.3, 'rosso_lacca', bottom='nero_lacca')
    # ringhiera
    for i in range(8):
        a, b = 2 * math.pi * i / 8 + math.pi / 8, 2 * math.pi * (i + 1) / 8 + math.pi / 8
        beam(m, (math.cos(a) * 0.6, 4.55, math.sin(a) * 0.6), (math.cos(b) * 0.6, 4.55, math.sin(b) * 0.6), 0.03, 0.03, 'nero_lacca')
    return _obj(m)


MODELS = {f.__name__: f for f in (bld_segheria_l1, bld_cava_l1, bld_casa_l1, bld_magazzino_l1, bld_tavolo_l1, bld_faro_l1)}
