# Moduli terreno 2x2 m, pivot a terra al centro, ≤ 60 tri. Il lato «acqua» dei bordi è −Z (davanti).
from lib import Mesh


def _obj(m):
    return [m.build()]


def mod_sabbia():
    m = Mesh('mod_sabbia')
    m.box(-1, 0, -1, 1, 0.4, 1, 'sabbia_lato', top='sabbia', skip=('bottom',))
    # conchiglia e sassolino: due piramidi basse (leggono la scala senza sporgere dal modulo)
    m.cone(4, 0.09, 0.4, 0.47, 'pietra_liscia', cx=0.45, cz=-0.3)
    m.cone(3, 0.07, 0.4, 0.44, 'sabbia_bagnata', cx=-0.5, cz=0.55)
    return _obj(m)


def mod_sabbia_bordo():
    """Sabbia che scende a scalino verso l'acqua (lato −Z)."""
    m = Mesh('mod_sabbia_bordo')
    # profilo (z, y) da dietro (+Z) a davanti (−Z)
    prof = [(1.0, 0.4), (0.1, 0.4), (-0.35, 0.22), (-0.55, 0.2), (-0.6, 0.08), (-1.0, 0.06)]
    regs = ['sabbia', 'sabbia', 'sabbia_bagnata', 'sabbia_bagnata', 'sabbia_bagnata']
    for (z0, y0), (z1, y1), r in zip(prof, prof[1:], regs):
        m.poly([(-1, y0, z0), (1, y0, z0), (1, y1, z1), (-1, y1, z1)], r)
    # fianchi (poligoni del profilo) e retro
    left = [(-1, 0, 1)] + [(-1, 0, -1)] + [(-1, y, z) for z, y in reversed(prof)]
    m.poly(list(reversed(left)), 'sabbia_lato')
    right = [(1, 0, -1), (1, 0, 1)] + [(1, y, z) for z, y in prof]
    m.poly(list(reversed(right)), 'sabbia_lato')
    m.poly([(-1, 0, 1), (1, 0, 1), (1, 0.4, 1), (-1, 0.4, 1)], 'sabbia_lato')
    m.poly([(1, 0, -1), (-1, 0, -1), (-1, 0.06, -1), (1, 0.06, -1)], 'sabbia_bagnata')
    m.cone(4, 0.1, 0.06, 0.14, 'roccia', cx=0.5, cz=-0.8)
    return _obj(m)


def mod_erba():
    m = Mesh('mod_erba')
    m.box(-1, 0, -1, 1, 0.6, 1, 'erba_lato', top='erba_a', skip=('bottom',))
    for cx, cz, h in ((-0.5, -0.4, 0.22), (0.35, 0.45, 0.18), (0.55, -0.6, 0.15), (-0.3, 0.6, 0.2)):
        m.cone(3, 0.1, 0.6, 0.6 + h, 'erba_alta', cx=cx, cz=cz)
    m.cbox(0.1, 0.05, 0.5, 0.5, 0.6, 0.605, 'erba_b', skip=('bottom',))  # zolla di variante
    return _obj(m)


def mod_scogliera():
    """Masso di roccia 1,6 m: piede pieno 2x2 (niente buchi tra moduli), fianchi sfaccettati che rientrano verso
    la cima; tra due moduli vicini resta una piega a V che si legge come una scogliera di più massi."""
    import math
    from atlas import h01
    m = Mesh('mod_scogliera')
    sq = [(1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1), (1, -1)]  # ordine antiorario in (x, z)
    def ring(y, ins, seed, dy=0.0):
        pts = []
        for i, (x, z) in enumerate(sq):
            k = ins[0] + (ins[1] - ins[0]) * h01(i, seed, 91)
            l = math.hypot(x, z)
            yy = y + (h01(i, seed, 92) - 0.5) * dy
            pts.append((x - x / l * k * l, yy, z - z / l * k * l))
        return pts
    r0 = [(x, 0.0, z) for x, z in sq]
    r1 = ring(0.65, (0.02, 0.12), 1, 0.2)
    r2 = ring(1.3, (0.14, 0.3), 2, 0.2)
    r3 = ring(1.62, (0.32, 0.5), 3, 0.12)
    m.loft([r0, r1, r2, r3], 'roccia_lato')
    top = (0.1, 1.82, -0.08)
    for i in range(8):
        j = (i + 1) % 8
        m.poly([r3[j], r3[i], top], 'roccia')
    return _obj(m)


def mod_molo():
    """Tavolato a 0,5 m su 4 pali che scendono in acqua."""
    m = Mesh('mod_molo')
    m.box(-1, 0.38, -1, 1, 0.5, 1, 'legno_pieno', top='tavole', skip=('bottom',))
    for x in (-0.82, 0.82):
        for z in (-0.82, 0.82):
            m.prism(4, 0.1, 0.09, -1.0, 0.56, 'corteccia', top='taglio', cx=x, cz=z)
    m.cbox(0, -0.82, 2.0, 0.12, 0.26, 0.38, 'legno_scuro', skip=('bottom', 'top', 'left', 'right'))  # traverse
    m.cbox(0, 0.82, 2.0, 0.12, 0.26, 0.38, 'legno_scuro', skip=('bottom', 'top', 'left', 'right'))
    return _obj(m)


MODELS = {f.__name__: f for f in (mod_sabbia, mod_sabbia_bordo, mod_erba, mod_scogliera, mod_molo)}
