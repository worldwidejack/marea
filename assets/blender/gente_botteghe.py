# MAREA — i bottegai del Borgo (botteghe.json): Brando il fabbro, Sibilla l'alchimista, Bepi del cantiere navale.
# Copiati dai loro ritratti (apps/client/public/assets/botteghe/<bottega>.webp): stessi colori, stessi oggetti in mano.
import math
from gente_kit import Fig, bones_for, TORSO, NECK, ARM, LEG, SKIRT, X, Y, Z, S
from gente_pezzi import *

CUOIO, CUOIO_S = '#7A4524', '#5A3018'


def _pose(CAT):
    d = {}
    for s, ch in CAT.items():
        d[f'UpperArm.{s}'] = list(ch[0][1])
        d[f'LowerArm.{s}'] = list(ch[1][1])
    return d


def _ricci(f, c, r, col, n=16, seme=1.0, rr=0.045):
    """Riccioli: palline sparse sulla calotta (sopra e dietro)."""
    for i in range(n):
        a = 2 * math.pi * caso((i, seme, 0)) * 1.0
        el = math.radians(-10 + 80 * caso((seme, i, 1)))
        if math.cos(a) > 0.55 and el < math.radians(35):
            a += math.pi * 0.6  # non sulla fronte
        p = (c[0] + math.sin(a) * math.cos(el) * r[0], c[1] + math.sin(el) * r[1], c[2] - math.cos(a) * math.cos(el) * r[2])
        k = rr * (0.8 + 0.4 * caso((i, i, seme)))
        f.ell(p, (k, k * 0.9, k), col, 'Head', n=6, m=3)


# ---------------------------------------------------------------- Brando il fabbro: gigante, barbone nero, grembiule di cuoio, martello in spalla, occhiolino
def npc_brando():
    B = bones_for(hip=0.95, chest=1.45, neck=1.5, top=1.86, sh=(0.27, 1.45), elbow=1.17, wrist=0.9, leg_x=0.11, knee=0.52, ankle=0.08, foot=0.17, arm_out=0.06)
    f = Fig('npc_brando', B)
    CAMICIA, PEL, CAPELLI, GUANTI = '#EADBC0', PELLE[3], '#2A1B12', '#26211F'
    for s, k in (('L', -1), ('R', 1)):
        f.tube([(k * 0.11, 0.98, 0), (k * 0.11, 0.55, 0), (k * 0.11, 0.2, 0)], [0.1, 0.085, 0.075], '#3D3A44', LEG(s), n=9, caps=('round', 'flat'))
        f.tube([(k * 0.11, 0.3, 0), (k * 0.11, 0.06, 0)], [0.085, 0.08], '#3A2418', LEG(s), n=9, caps=('flat', 'flat'))
        scarpa(f, s, k * 0.11, 0.3, 0.085, 0.11, '#3A2418', suola='#1E1410', punta=0.1)
    R = [(0.88, 0.22, 0.17, 0.0), (1.04, 0.235, 0.185, -0.015), (1.2, 0.27, 0.2, -0.015), (1.36, 0.31, 0.2, -0.01), (1.45, 0.28, 0.18, 0.0),
         (1.5, 0.12, 0.1, 0.0)]
    corpo(f, R, CAMICIA, TORSO, n=18, caps=('flat', 'round'))
    pannello(f, R, 0.88, 0.95, lambda t: (-180, 180), CUOIO_S, TORSO, off=0.004, th=0.012, ny=1, na=18)
    f.box((0, 0.915, -0.19), (0.07, 0.06, 0.02), ORO, 'Hips')
    # grembiule di cuoio: pettorina, gonna fino al ginocchio, bretelle con le fibbie
    Rg = [(0.5, 0.25, 0.2, 0.0), (0.7, 0.24, 0.19, 0.0)] + R
    pannello(f, Rg, 0.5, 1.38, lambda t: (-58 + 28 * max(0, t - 0.5), 58 - 28 * max(0, t - 0.5)), CUOIO, zone(f, (0.95, TORSO), (0.0, SKIRT())),
             off=0.012, th=0.016, ny=8, na=8)
    pannello(f, Rg, 0.98, 1.16, lambda t: (-22, 22), CUOIO_S, TORSO, off=0.03, th=0.008, ny=2, na=3)  # tasca
    for sg in (-1, 1):
        pannello(f, R, 1.36, 1.5, lambda t, sg=sg: (sg * 30 - 7, sg * 30 + 7), CUOIO, TORSO, off=0.01, th=0.012, ny=2, na=1)
        f.box((sg * 0.12, 1.36, -0.225), (0.05, 0.05, 0.02), ORO, 'Spine')
        f.box((sg * 0.12, 1.36, -0.236), (0.025, 0.025, 0.01), CUOIO_S, 'Spine')
    # braccia enormi: maniche corte arrotolate, avambracci nudi, guantoni neri
    CAT = {'R': [((0.27, 1.45, 0.0), [(Y, -22), (X, 26)]), ((0.3, 1.17, 0.0), [(X, 128)])]}
    for s, k in (('L', -1), ('R', 1)):
        f.tube([(k * 0.22, 1.47, 0), (k * 0.3, 1.38, 0), (k * 0.31, 1.26, 0)], [0.105, 0.11, 0.105], CAMICIA, ARM(s), n=10, res=2, caps=('round', 'flat'))
        f.lathe([(0.0, -0.03), (0.11, -0.03), (0.112, 0.01), (0.0, 0.01)], '#D4C3A2', ARM(s), n=10, c=(k * 0.311, 1.25, 0))
        f.tube([(k * 0.31, 1.26, 0), (k * 0.315, 1.1, -0.005), (k * 0.325, 1.0, -0.01)], [0.085, 0.08, 0.07], PEL, ARM(s), n=9, caps=('flat', 'flat'))
        f.tube([(k * 0.326, 1.01, -0.01), (k * 0.33, 0.93, -0.012)], [0.08, 0.075], GUANTI, f'LowerArm.{s}', n=9, res=1, caps=('flat', 'flat'))
        mano(f, s, (k * 0.332, 0.925, -0.012), 0.072, GUANTI)
    hr = finale(CAT['R'], (0.332, 0.86, -0.03))

    def martello():
        x, y, z = hr
        d = (0.02, 0.45, 0.89)
        top = (x + d[0] * 0.42, y + d[1] * 0.42, z + d[2] * 0.42)
        f.tube([(x - d[0] * 0.12, y - d[1] * 0.12, z - d[2] * 0.12), top], [0.02, 0.022], '#8E5A2B', 'LowerArm.R', n=6, res=1)
        f.push(t=top, r=(math.degrees(math.atan2(d[2], d[1])), 0, 0))
        f.box((0, 0, 0), (0.22, 0.1, 0.1), '#4A4C55', 'LowerArm.R')
        f.box((0.12, 0, 0), (0.04, 0.12, 0.12), '#6E717C', 'LowerArm.R')
        f.box((-0.12, 0, 0), (0.04, 0.12, 0.12), '#6E717C', 'LowerArm.R')
        f.pop()
    in_mano(f, CAT['R'], martello)
    # testa: riccioli neri, barbone, nasone, occhiolino e sorrisone
    hc = (0, 1.67, -0.03)
    f.ell(hc, (0.135, 0.155, 0.135), PEL, 'Head', n=14, m=9, deform=lambda p: (p[0] * (1 + 0.05 * max(0, -p[1] / 0.155)), p[1], p[2]))
    f.ell((0, 1.52, -0.02), (0.1, 0.06, 0.09), PEL, NECK, n=10, m=4)
    capelli_cap(f, (0, 1.7, -0.01), (0.15, 0.15, 0.145), CAPELLI, fronte=0.32, dietro=-0.4)
    _ricci(f, (0, 1.72, -0.01), (0.15, 0.15, 0.145), CAPELLI, n=26, seme=2.0, rr=0.05)
    f.ell((0, 1.565, -0.07), (0.155, 0.11, 0.105), CAPELLI, ['Head'], n=14, m=7, deform=lambda p: (p[0], p[1] - 0.05 * max(0, -p[1] / 0.11) ** 2, p[2]))
    f.ell((0, 1.6, -0.155), (0.06, 0.035, 0.03), '#7A2A2A', 'Head', n=10, m=4)  # bocca aperta
    f.box((0, 1.612, -0.18), (0.085, 0.022, 0.012), '#F7F1E6', 'Head')
    for k in (-1, 1):
        f.tube([(k * 0.01, 1.64, -0.172), (k * 0.06, 1.635, -0.165), (k * 0.1, 1.615, -0.13)], [0.024, 0.02, 0.012], CAPELLI, 'Head', n=6, res=2)
        f.ell((k * 0.135, 1.68, -0.02), (0.022, 0.042, 0.03), PEL, 'Head', n=6, m=4)
        f.ell((k * 0.08, 1.66, -0.12), (0.03, 0.02, 0.012), '#C9634A', 'Head', n=6, m=3)
    f.ell((0, 1.675, -0.165), (0.036, 0.034, 0.03), '#A86444', 'Head', n=8, m=5)
    f.ell((0.05, 1.715, -0.13), (0.017, 0.024, 0.01), OCCHIO, 'Head', n=8, m=4)
    f.ell((0.046, 1.722, -0.139), (0.005, 0.005, 0.003), BIANCO_OCCHIO, 'Head', n=5, m=2)
    occhi_chiusi(f, (-0.05, 1.71, -0.128), 0.0, w=0.022, th=0.007, su=False)
    for k in (-1, 1):
        f.tube([(k * 0.025, 1.75, -0.13), (k * 0.05, 1.758 + (0.006 if k > 0 else -0.004), -0.128), (k * 0.08, 1.75, -0.115)], [0.011, 0.013, 0.008],
               CAPELLI, 'Head', n=5, res=2)
    posa = _pose(CAT)
    return f, B, {'passo': 22, 'braccia': 18, 'molla': 1.0, 'ferme': tuple(posa), 'posa': lambda t, moto: posa, 'aperte': 14,
                  'idle': lambda t: {'Spine': [(X, -2 * math.sin(2 * math.pi * t)), (Z, 3 * math.sin(2 * math.pi * t))], 'Head': [(Y, 5 * math.sin(2 * math.pi * t))]}}


# ---------------------------------------------------------------- Sibilla l'alchimista: cappellone viola da strega, chioma bionda, pozione verde alzata
def npc_sibilla():
    B = bones_for(hip=0.88, chest=1.3, neck=1.34, top=1.64, sh=(0.18, 1.3), elbow=1.05, wrist=0.8, leg_x=0.085, knee=0.47, ankle=0.08, foot=0.14, arm_out=0.04)
    f = Fig('npc_sibilla', B)
    VIOLA, VIOLA_S, PEL, CAPELLI, CAPELLI_S = '#6A3FA0', '#4E2C7A', PELLE[0], '#F2D27A', '#D9B455'
    for s, k in (('L', -1), ('R', 1)):
        scarpa(f, s, k * 0.085, 0.24, 0.065, 0.09, '#5A3018', punta=0.4)
        f.tube([(k * 0.085, 0.4, 0), (k * 0.085, 0.07, 0)], [0.055, 0.045], '#3A2A44', LEG(s), n=7, caps=('flat', 'flat'))
    R = [(0.08, 0.27, 0.24, 0.0), (0.4, 0.23, 0.2, 0.0), (0.72, 0.2, 0.17, 0.0), (0.92, 0.175, 0.15, 0.0), (1.08, 0.17, 0.145, -0.01), (1.2, 0.185, 0.155, -0.02),
         (1.29, 0.17, 0.14, 0.0), (1.35, 0.07, 0.065, 0.0)]
    gw = zone(f, (0.9, TORSO), (0.0, SKIRT()))
    corpo(f, R, VIOLA, gw, n=18)
    pannello(f, R, 0.08, 0.13, lambda t: (-180, 180), ORO_SCURO, SKIRT(), off=0.004, th=0.01, ny=1, na=20)
    pannello(f, R, 0.08, 1.3, lambda t: (-5, 5), ORO_SCURO, gw, off=0.003, th=0.006, ny=10, na=1)
    for y in (1.0, 1.1, 1.2):
        f.ell((0, y, _ring_at(R, y)[2] - _ring_at(R, y)[1] - 0.012), (0.017, 0.017, 0.01), ORO, 'Spine', n=6, m=3)
    # cintura di cuoio con la fibbia d'oro, borsello e fialette colorate
    pannello(f, R, 0.87, 0.94, lambda t: (-180, 180), CUOIO, gw, off=0.008, th=0.014, ny=1, na=18)
    f.box((0, 0.905, -0.175), (0.07, 0.06, 0.02), ORO, 'Hips')
    f.box((0, 0.905, -0.186), (0.035, 0.03, 0.01), CUOIO_S, 'Hips')
    f.lathe([(0.0, 0.72), (0.06, 0.73), (0.065, 0.83), (0.0, 0.84)], CUOIO_S, 'Hips', n=8, c=(-0.17, 0, -0.1), sz=0.6)
    for i, (a, col) in enumerate(((25, '#E8433F'), (40, '#3FB9C9'), (55, '#F5D547'))):
        ar = math.radians(a)
        cx, cz = math.sin(ar) * 0.2, -math.cos(ar) * 0.175
        f.lathe([(0.0, 0.8), (0.022, 0.8), (0.024, 0.86), (0.012, 0.88), (0.012, 0.9), (0.0, 0.9)], col, 'Hips', n=7, c=(cx, 0, cz))
        f.lathe([(0.0, 0.895), (0.013, 0.895), (0.013, 0.915), (0.0, 0.915)], '#C98A4B', 'Hips', n=6, c=(cx, 0, cz))
    # maniche larghe; la destra alza la pozione, la sinistra col guanto senza dita
    CAT = {'R': [((0.18, 1.3, 0.0), [(Y, -24), (X, 30)]), ((0.2, 1.05, 0.0), [(X, 108)])]}
    for s, k in (('L', -1), ('R', 1)):
        f.tube([(k * 0.15, 1.31, 0), (k * 0.2, 1.22, 0), (k * 0.21, 1.05, 0), (k * 0.225, 0.86, -0.01)], [0.06, 0.06, 0.07, 0.085], VIOLA, ARM(s), n=9,
               caps=('round', None))
        f.lathe([(0.07, 0.0), (0.088, 0.0), (0.088, 0.03), (0.07, 0.03), (0.07, 0.0)], ORO_SCURO, f'LowerArm.{s}', n=9, c=(k * 0.226, 0.84, -0.01), caps=False)
        f.lathe([(0.0, 0.035), (0.075, 0.035), (0.075, 0.045), (0.0, 0.045)], VIOLA_S, f'LowerArm.{s}', n=9, c=(k * 0.226, 0.84, -0.01))
        f.tube([(k * 0.226, 0.9, -0.01), (k * 0.228, 0.84, -0.012)], [0.042, 0.04], '#2E2430', f'LowerArm.{s}', n=7, res=1, caps=('flat', 'flat'))
        mano(f, s, (k * 0.229, 0.835, -0.012), 0.044, PEL)
    hr = finale(CAT['R'], (0.229, 0.79, -0.04))

    def pozione():
        x, y, z = hr
        c = (x - 0.01, y + 0.02, z - 0.02)
        f.ell((c[0], c[1] + 0.05, c[2]), (0.06, 0.058, 0.06), '#7CE05A', 'LowerArm.R', n=10, m=6)
        f.ell((c[0] - 0.02, c[1] + 0.075, c[2] - 0.04), (0.014, 0.018, 0.01), '#E8FFD8', 'LowerArm.R', n=6, m=3)
        f.lathe([(0.0, 0.1), (0.024, 0.1), (0.022, 0.16), (0.03, 0.17), (0.0, 0.17)], '#BFE8E0', 'LowerArm.R', n=8, c=(c[0], c[1], c[2]))
        f.lathe([(0.0, 0.165), (0.02, 0.165), (0.022, 0.2), (0.0, 0.2)], '#C98A4B', 'LowerArm.R', n=7, c=(c[0], c[1], c[2]))
        for dx, dy in ((0.01, 0.24), (-0.02, 0.29), (0.015, 0.33)):
            f.ell((c[0] + dx, c[1] + dy, c[2]), (0.012, 0.012, 0.012), '#B8F09A', 'LowerArm.R', n=6, m=3)  # bollicine
    in_mano(f, CAT['R'], pozione)
    # testa: occhioni con le ciglia, sorriso aperto; chioma bionda lunga e mossa fino alla vita
    hc = (0, 1.48, -0.02)
    f.ell(hc, (0.12, 0.14, 0.125), PEL, 'Head', n=14, m=9, deform=lambda p: (p[0] * (1 - 0.14 * max(0, -p[1] / 0.14)), p[1], p[2] - 0.01 * max(0, -p[1] / 0.14)))
    f.ell((0, 1.35, -0.02), (0.05, 0.05, 0.05), PEL, NECK, n=8, m=4)
    capelli_cap(f, (0, 1.505, -0.005), (0.136, 0.14, 0.14), CAPELLI, fronte=0.3, dietro=-0.8)
    onda = lambda p: CAPELLI if int(p[1] * 25) % 2 else CAPELLI_S
    f.tube([(0, 1.5, 0.06), (0, 1.3, 0.12), (0, 1.1, 0.16), (0, 0.95, 0.15)], [(0.17, 0.08), (0.2, 0.08), (0.18, 0.07), (0.1, 0.04)], onda, ['Head', 'Spine'], n=10, res=3)
    for k in (-1, 1):  # ciocche davanti sulle spalle, a onde
        f.tube([(k * 0.11, 1.52, -0.05), (k * 0.15, 1.38, -0.06), (k * 0.17, 1.26, -0.09), (k * 0.15, 1.12, -0.1), (k * 0.17, 1.02, -0.09)],
               [0.045, 0.05, 0.05, 0.042, 0.02], onda, ['Head', 'Spine'], n=8, res=3)
        f.ell((k * 0.065, 1.43, -0.11), (0.028, 0.02, 0.012), GUANCE, 'Head', n=6, m=3)
    occhi(f, (0, 1.48, -0.12), 0.048, r=(0.019, 0.027, 0.01), sopr=0.012, sopr_col=CAPELLI_S, sopr_k=(0.026, 0.008), sopr_ang=-8)
    for k in (-1, 1):
        f.tube([(k * 0.064, 1.495, -0.115), (k * 0.078, 1.505, -0.11)], [0.005, 0.003], NERO, 'Head', n=4, res=1)  # ciglia
    f.ell((0, 1.455, -0.14), (0.016, 0.016, 0.014), '#F0B897', 'Head', n=6, m=3)
    f.ell((0, 1.405, -0.118), (0.04, 0.022, 0.014), '#8C2A3A', 'Head', n=8, m=3, cut=(-1, 0.25))
    f.box((0, 1.41, -0.128), (0.045, 0.01, 0.006), BIANCO_OCCHIO, 'Head')
    # cappellone da strega: tesa larga, cono piegato in fondo, fascia di cuoio con la fibbia d'oro
    f.push(t=(0, 1.57, -0.01), r=(-6, 0, 5))
    f.lathe([(0.0, 0.0), (0.31, -0.01), (0.32, 0.005), (0.15, 0.02), (0.0, 0.025)], VIOLA, 'Head', n=18,
            deform=lambda p: (p[0], p[1] + 0.02 * (math.hypot(p[0], p[2]) / 0.3) ** 2 * (1 if p[2] < 0 else -0.5), p[2]))
    cono = [(0, 0.0, 0), (0.0, 0.12, 0.01), (0.02, 0.24, 0.03), (0.07, 0.33, 0.06), (0.15, 0.36, 0.06)]
    f.tube(cono, [(0.145, 0.14), (0.11, 0.105), (0.07, 0.068), (0.04, 0.04), (0.01, 0.01)], VIOLA, 'Head', n=14, res=3, caps=('flat', 'round'))
    f.lathe([(0.0, 0.02), (0.15, 0.02), (0.142, 0.07), (0.0, 0.07)], CUOIO, 'Head', n=18)
    f.box((0, 0.045, -0.148), (0.07, 0.06, 0.016), ORO, 'Head')
    f.box((0, 0.045, -0.156), (0.035, 0.03, 0.01), CUOIO, 'Head')
    f.pop()
    posa = _pose(CAT)
    return f, B, {'passo': 24, 'braccia': 20, 'molla': 1.2, 'ferme': tuple(posa), 'posa': lambda t, moto: posa, 'aperte': 8,
                  'idle': lambda t: {'LowerArm.R': [(Z, 10 * math.sin(4 * math.pi * t))], 'Head': [(Z, -8 * math.sin(2 * math.pi * t)), (X, -4)],
                                     'Hips': [(Y, 3 * math.sin(2 * math.pi * t))]}}


# ---------------------------------------------------------------- Bepi del cantiere: vecchio lupo, barba bianca, coppola blu, grembiule con gli attrezzi, saluta
def npc_bepi():
    B = bones_for(hip=0.82, chest=1.26, neck=1.3, top=1.6, sh=(0.22, 1.26), elbow=1.01, wrist=0.78, leg_x=0.1, knee=0.45, ankle=0.08, foot=0.15, arm_out=0.05)
    f = Fig('npc_bepi', B)
    CAMICIA, BLU, PEL, BIANCO = '#7FB2DE', '#2D4A7A', PELLE[1], '#F4F1EC'
    for s, k in (('L', -1), ('R', 1)):
        f.tube([(k * 0.1, 0.85, 0), (k * 0.1, 0.5, 0), (k * 0.1, 0.12, 0)], [0.09, 0.08, 0.072], '#4A4A52', LEG(s), n=9, caps=('round', 'flat'))
        scarpa(f, s, k * 0.1, 0.28, 0.08, 0.1, '#3A2418', suola='#1E1410', punta=0.1)
    R = [(0.75, 0.22, 0.19, 0.0), (0.9, 0.235, 0.21, -0.02), (1.05, 0.24, 0.21, -0.03), (1.18, 0.24, 0.19, -0.01), (1.27, 0.22, 0.17, 0.0), (1.32, 0.09, 0.08, 0.0)]
    corpo(f, R, CAMICIA, TORSO, n=16)
    pannello(f, R, 1.1, 1.3, lambda t: (-(6 + 10 * t), 6 + 10 * t), PEL, TORSO, off=0.0, th=0.006, ny=2, na=2)  # colletto aperto
    for sg in (-1, 1):
        pannello(f, R, 1.22, 1.31, lambda t, sg=sg: (sg * 12, sg * 34), '#9CC4E8', TORSO, off=0.006, th=0.01, ny=1, na=2)
    Rg = [(0.45, 0.25, 0.22, 0.0), (0.62, 0.235, 0.205, 0.0)] + R
    pannello(f, Rg, 0.45, 1.2, lambda t: (-55 + 25 * max(0, t - 0.55), 55 - 25 * max(0, t - 0.55)), CUOIO, zone(f, (0.85, TORSO), (0.0, SKIRT())),
             off=0.012, th=0.016, ny=7, na=8)
    for sg in (-1, 1):
        pannello(f, R, 1.18, 1.31, lambda t, sg=sg: (sg * 30 - 7, sg * 30 + 7), CUOIO, TORSO, off=0.01, th=0.012, ny=2, na=1)
    pannello(f, Rg, 0.66, 0.86, lambda t: (-40, 10), CUOIO_S, SKIRT(), off=0.03, th=0.01, ny=2, na=4)  # tascone degli attrezzi
    f.tube([(-0.08, 0.8, -0.26), (-0.09, 0.98, -0.27)], [0.016, 0.016], '#C98A4B', 'Hips', n=5, res=1)       # manico del martello
    f.box((-0.09, 0.99, -0.27), (0.09, 0.035, 0.035), '#4A4C55', 'Hips')
    f.tube([(0.0, 0.8, -0.27), (0.01, 0.93, -0.28)], [0.012, 0.01], '#F5D547', 'Hips', n=5, res=1)          # matitone
    f.box((-0.17, 0.82, -0.22), (0.05, 0.15, 0.03), '#8E5A2B', 'Hips', r=(0, 0, 8))                          # manico della sega
    # braccia: maniche arrotolate, polsino nero; la destra saluta
    CAT = {'R': [((0.22, 1.26, 0.0), [(Y, -70), (X, 18)]), ((0.245, 1.01, 0.0), [(Y, 8), (X, 92)])]}
    for s, k in (('L', -1), ('R', 1)):
        f.tube([(k * 0.19, 1.27, 0), (k * 0.25, 1.18, 0), (k * 0.255, 1.08, 0)], [0.08, 0.08, 0.075], CAMICIA, ARM(s), n=9, res=2, caps=('round', 'flat'))
        f.lathe([(0.0, -0.035), (0.08, -0.035), (0.082, 0.005), (0.0, 0.005)], '#9CC4E8', ARM(s), n=9, c=(k * 0.256, 1.075, 0))
        f.tube([(k * 0.255, 1.08, 0), (k * 0.26, 0.92, -0.005), (k * 0.27, 0.83, -0.01)], [0.062, 0.058, 0.05], PEL, ARM(s), n=8, caps=('flat', 'flat'))
        f.lathe([(0.0, 0.84), (0.056, 0.84), (0.056, 0.9), (0.0, 0.9)], NERO, f'LowerArm.{s}', n=8, c=(k * 0.268, 0, -0.01))
        mano(f, s, (k * 0.272, 0.825, -0.012), 0.058, PEL)
    # testa: barba e baffoni bianchi, nasone rosso, guance, coppola blu col bottone, matita dietro l'orecchio
    hc = (0, 1.43, -0.02)
    f.ell(hc, (0.13, 0.145, 0.13), PEL, 'Head', n=14, m=9)
    f.ell((0, 1.3, -0.02), (0.08, 0.05, 0.07), PEL, NECK, n=8, m=4)
    capelli_cap(f, (0, 1.43, -0.005), (0.137, 0.14, 0.137), BIANCO, fronte=-0.1, dietro=-0.55)
    f.ell((0, 1.355, -0.08), (0.14, 0.12, 0.09), BIANCO, 'Head', n=14, m=7, deform=lambda p: (p[0] * (1 - 0.3 * max(0, -p[1] / 0.12)), p[1], p[2]))
    for k in (-1, 1):
        f.tube([(k * 0.01, 1.4, -0.15), (k * 0.06, 1.395, -0.14), (k * 0.11, 1.38, -0.1)], [0.03, 0.026, 0.012], BIANCO, 'Head', n=7, res=2)
        f.ell((k * 0.13, 1.43, -0.01), (0.02, 0.04, 0.03), PEL, 'Head', n=6, m=4)
        f.ell((k * 0.075, 1.415, -0.115), (0.03, 0.02, 0.013), GUANCE, 'Head', n=6, m=3)
    f.ell((0, 1.375, -0.135), (0.045, 0.028, 0.02), '#7A2A2A', 'Head', n=10, m=4, cut=(-1, 0.3))  # bocca che ride
    f.box((0, 1.385, -0.148), (0.05, 0.012, 0.008), BIANCO_OCCHIO, 'Head')
    f.ell((0, 1.43, -0.155), (0.034, 0.03, 0.03), '#E2745E', 'Head', n=8, m=5)
    occhi_chiusi(f, (0, 1.465, -0.125), 0.05, w=0.022, th=0.007)
    for k in (-1, 1):
        f.tube([(k * 0.03, 1.5, -0.12), (k * 0.055, 1.505, -0.118), (k * 0.08, 1.497, -0.106)], [0.01, 0.012, 0.006], BIANCO, 'Head', n=4, res=2)
    f.tube([(0.1, 1.48, 0.04), (0.16, 1.44, 0.07)], [0.009, 0.007], '#F5D547', 'Head', n=5, res=1)
    f.push(t=(0, 1.525, -0.01), r=(-10, 0, -6))
    f.lathe([(0.0, -0.02), (0.145, -0.02), (0.15, 0.02), (0.13, 0.06), (0.0, 0.075)], BLU, 'Head', n=16, sz=1.08,
            deform=lambda p: (p[0], p[1], p[2] - (0.02 * max(0, -p[2] / 0.15) if p[1] > 0.0 else 0)))
    f.ell((0, -0.005, -0.15), (0.13, 0.014, 0.075), '#22385E', 'Head', n=12, m=3, cut=(-1, 1))
    f.ell((0, 0.075, -0.01), (0.022, 0.012, 0.022), '#22385E', 'Head', n=6, m=3)
    f.pop()
    up = _pose(CAT)

    def posa(t, moto):
        if moto:
            return {}
        a = max(0.0, min(1.0, 2.2 * math.sin(2 * math.pi * t) - 0.2))  # alza il braccio per metà del giro, poi lo riposa
        return {k: [(ax, deg * a) for ax, deg in v] + ([(Z, 22 * a * math.sin(6 * math.pi * t))] if k == 'LowerArm.R' else []) for k, v in up.items()}
    return f, B, {'passo': 20, 'braccia': 22, 'molla': 1.0, 'aperte': 10, 'posa': posa, 'idle_n': 120,
                  'ferme': ('UpperArm.R', 'LowerArm.R'),
                  'idle': lambda t: {'Spine': [(Z, 2 * math.sin(2 * math.pi * t))]}}


CHARS = {'npc_brando': npc_brando, 'npc_sibilla': npc_sibilla, 'npc_bepi': npc_bepi}
