# MAREA — la gente del Porto: Maestro Ishi, il Furetto, Gigi il Mozzo, Capitan Remo, Nonna Pina (gente.json).
import math
from gente_kit import Fig, bones_for, TORSO, NECK, ARM, LEG, SKIRT, X, Y, Z, S
from gente_pezzi import *


# ---------------------------------------------------------------- Capitan Remo: botte blu coi bottoni d'oro, barbone, gamba di legno, pipa
def npc_remo():
    B = bones_for(hip=0.70, chest=1.30, neck=1.36, top=1.64, sh=(0.25, 1.27), elbow=0.99, wrist=0.74, leg_x=0.115, knee=0.38, ankle=0.07, foot=0.15,
                  arm_out=0.12)
    f = Fig('npc_remo', B)
    BLU, BLU_SCURO, BIANCO, BARBA, PEL = '#24427A', '#172B55', '#F3EEE4', '#F1ECE3', PELLE[1]
    # gambe corte: pantaloni blu, stivale a sinistra, gamba di legno a destra
    for s, k in (('L', -1), ('R', 1)):
        x = k * 0.115
        f.tube([(x, 0.72, 0), (x, 0.55, -0.01), (x, 0.38, 0)], [0.105, 0.1, 0.085], BLU_SCURO, LEG(s), n=10)
    f.tube([(-0.115, 0.4, 0), (-0.115, 0.22, 0), (-0.115, 0.06, 0)], [0.09, 0.083, 0.08], NERO, LEG('L'), n=10, caps=('round', 'flat'))
    f.lathe([(0.0, 0.36), (0.1, 0.36), (0.1, 0.4), (0.0, 0.4)], '#3B2B25', LEG('L'), n=10, c=(-0.115, 0, 0))
    scarpa(f, 'L', -0.115, 0.27, 0.09, 0.11, NERO, suola='#3B2B25', punta=0.15)
    f.tube([(0.115, 0.4, 0), (0.115, 0.34, 0)], [0.085, 0.07], LEGNO_SCURO, LEG('R'), n=8)
    f.tube([(0.115, 0.36, 0), (0.115, 0.18, 0), (0.115, 0.02, 0)], [0.045, 0.035, 0.026], LEGNO, 'LowerLeg.R', n=7, caps=('flat', 'flat'))
    f.ell((0.115, 0.02, 0), (0.035, 0.02, 0.035), LEGNO_SCURO, 'LowerLeg.R', n=7, m=2)
    # cappotto: pancione in avanti, spalle spioventi, falde larghe sotto la cintura
    Y_ = [0.40, 0.56, 0.74, 0.92, 1.08, 1.2, 1.29, 1.35]
    R_ = [(0.27, 0.25), (0.29, 0.27), (0.31, 0.29), (0.32, 0.30), (0.3, 0.26), (0.26, 0.21), (0.2, 0.16), (0.1, 0.09)]
    Z_ = [0.02, 0.0, -0.035, -0.06, -0.04, -0.01, 0.0, 0.0]
    cw = zone(f, (0.74, TORSO), (0.0, SKIRT()))
    f.tube([(0, y, z) for y, z in zip(Y_, Z_)], R_, BLU, cw, n=18, res=3, caps=('flat', 'round'), capk=0.3)
    # cintura nera con la fibbia d'oro, bottoni a doppio petto
    f.tube([(0, 0.715, -0.033), (0, 0.765, -0.038)], [(0.313, 0.293), (0.316, 0.296)], NERO, TORSO, n=18, res=1, caps=('flat', 'flat'))
    f.box((0, 0.74, -0.33), (0.11, 0.08, 0.03), ORO, 'Hips')
    f.box((0, 0.74, -0.345), (0.06, 0.04, 0.01), NERO, 'Hips')
    for y, zf, dx in ((0.85, -0.355, 0.12), (0.97, -0.355, 0.12), (1.09, -0.30, 0.11)):
        for k in (-1, 1):
            f.ell((k * dx, y, zf), (0.026, 0.026, 0.016), ORO, 'Spine', n=8, m=3)
    # spalline d'oro con la frangia
    for s, k in (('L', -1), ('R', 1)):
        f.push(t=(k * 0.24, 1.29, 0.0), r=(0, 0, k * 22))
        f.ell((0, 0, 0), (0.1, 0.028, 0.09), ORO, ARM(s), n=12, m=3)
        for i in range(7):
            a = math.radians(-70 + i * 23.3)
            f.tube([(k * 0.085 * max(0.3, math.cos(a)), -0.01, 0.08 * math.sin(a)), (k * 0.095 * max(0.3, math.cos(a)), -0.075, 0.085 * math.sin(a))],
                   [0.012, 0.01], ORO_SCURO, ARM(s), n=4, res=1)
        f.pop()
    # braccia grosse che girano attorno alla pancia, polsini d'oro
    for s, k in (('L', -1), ('R', 1)):
        f.tube([(k * 0.2, 1.27, 0.0), (k * 0.29, 1.17, 0.0), (k * 0.33, 0.99, 0.0), (k * 0.36, 0.82, -0.02)], [0.095, 0.095, 0.085, 0.082], BLU, ARM(s), n=10)
        f.tube([(k * 0.362, 0.82, -0.02), (k * 0.368, 0.765, -0.025)], [0.087, 0.087], ORO, f'LowerArm.{s}', n=10, caps=('flat', 'flat'), res=1)
        mano(f, s, (k * 0.368, 0.76, -0.025), 0.064, PEL)
    # testa sopra il barile: barbone bianco, nasone rosso, guance rosa
    hc = (0, 1.5, -0.02)
    f.ell(hc, (0.13, 0.15, 0.135), PEL, 'Head', n=14, m=9, deform=lambda p: (p[0] * (1 + 0.08 * max(0, -p[1] / 0.15)), p[1], p[2]))
    f.ell((0, 1.37, -0.0), (0.12, 0.06, 0.11), PEL, NECK, n=10, m=4)
    # frangia di capelli bianchi dietro e sui lati, sotto il berretto
    f.ell((0, 1.53, 0.035), (0.145, 0.07, 0.115), BARBA, 'Head', n=14, m=5, cut=(-1, 0.6))
    # barba: grande pera bianca dal mento al petto
    f.ell((0, 1.34, -0.1), (0.21, 0.2, 0.13), BARBA, ['Head', 'Spine'], n=16, m=8,
          deform=lambda p: (p[0] * (1 - 0.4 * max(0, -p[1] / 0.2) ** 1.5), p[1] - 0.05 * (p[0] / 0.21) ** 2, p[2] + 0.04 * max(0, p[1] / 0.2) - 0.03 * max(0, -p[1] / 0.2)))
    f.ell((0, 1.44, -0.07), (0.155, 0.085, 0.1), BARBA, 'Head', n=12, m=5)
    for k in (-1, 1):  # baffi a manubrio
        f.tube([(k * 0.01, 1.465, -0.158), (k * 0.08, 1.452, -0.152), (k * 0.155, 1.475, -0.115), (k * 0.18, 1.51, -0.095)], [0.031, 0.029, 0.018, 0.008], BARBA, 'Head', n=7, res=3)
    f.ell((0, 1.5, -0.163), (0.042, 0.037, 0.037), '#E2745E', 'Head', n=8, m=5)
    for k in (-1, 1):
        f.ell((k * 0.078, 1.485, -0.125), (0.03, 0.022, 0.015), GUANCE, 'Head', n=6, m=3)
        f.ell((k * 0.13, 1.5, 0.0), (0.02, 0.04, 0.03), PEL, 'Head', n=6, m=4)
    occhi(f, (0, 1.535, -0.134), 0.05, r=(0.016, 0.022, 0.01), sopr=0.012, sopr_col=BARBA, sopr_k=(0.038, 0.016), sopr_ang=14)
    # berretto da capitano: cupola bianca, fascia nera, visiera lucida, ancora d'oro
    f.lathe([(0.0, 1.595), (0.14, 1.595), (0.148, 1.65), (0.178, 1.71), (0.172, 1.74), (0.0, 1.75)], BIANCO, 'Head', n=16, sz=1.05)
    f.lathe([(0.0, 1.585), (0.143, 1.585), (0.147, 1.64), (0.0, 1.64)], NERO, 'Head', n=16, sz=1.05)
    f.push(t=(0, 1.595, -0.135), r=(-20, 0, 0))
    f.ell((0, 0, -0.03), (0.13, 0.012, 0.08), NERO, 'Head', n=12, m=3)
    f.pop()
    f.box((0, 1.613, -0.156), (0.05, 0.045, 0.012), ORO, 'Head')
    # pipa in bocca
    f.tube([(0.03, 1.455, -0.165), (0.09, 1.435, -0.225)], [0.009, 0.009], LEGNO_SCURO, 'Head', n=5, res=1)
    f.lathe([(0.0, 1.40), (0.03, 1.405), (0.034, 1.46), (0.03, 1.46), (0.0, 1.445)], LEGNO, 'Head', n=8, c=(0.1, 0.0, -0.235))
    return f, B, {'passo': 18, 'braccia': 16, 'molla': 1.4, 'aperte': 16,
                  'idle': lambda t: {'Spine': [(Y, 3 * math.sin(2 * math.pi * t))], 'Hips': [(Y, -2 * math.sin(2 * math.pi * t))]}}




# ---------------------------------------------------------------- Nonna Pina: piccolina e curva, scialle senape, crocchia coi ferri, cesto di limoni
def npc_pina():
    B = bones_for(hip=0.54, chest=0.95, neck=0.97, top=1.24, sh=(0.165, 0.93), elbow=0.745, wrist=0.575, leg_x=0.07, knee=0.29, ankle=0.06,
                  foot=0.11, arm_out=0.03, lean=0.06)
    f = Fig('npc_pina', B)
    ABITO, SCIALLE, SCIALLE_S, GREMB, CAPELLI, PEL = '#2F2838', '#E3A33B', '#C47F22', '#F2E6CF', '#F2EEE8', PELLE[1]
    R = [(0.05, 0.2, 0.19, 0.0), (0.2, 0.19, 0.18, 0.0), (0.4, 0.18, 0.17, 0.0), (0.55, 0.19, 0.175, -0.01), (0.7, 0.185, 0.17, 0.0),
         (0.82, 0.175, 0.16, 0.02), (0.9, 0.145, 0.14, 0.01), (0.96, 0.08, 0.075, -0.03)]
    corpo(f, R, ABITO, zone(f, (0.58, TORSO), (0.0, SKIRT())), n=16)
    # grembiule panna con l'orlo rosso e il laccio
    pannello(f, R, 0.12, 0.56, lambda t: (-52 + 6 * t, 52 - 6 * t), GREMB, SKIRT(), off=0.006)
    pannello(f, R, 0.12, 0.16, lambda t: (-53, 53), '#D9473F', SKIRT(), off=0.02, th=0.006, ny=1)
    pannello(f, R, 0.55, 0.59, lambda t: (-180, 180), '#D9473F', TORSO, off=0.012, ny=1, na=16)
    # scialle senape sulle spalle, a punta dietro, nodo davanti
    pannello(f, R, 0.74, 0.955, lambda t: (-180, 180), SCIALLE, 'Spine', off=0.02, th=0.022, ny=4, na=18)
    pannello(f, R, 0.56, 0.78, lambda t: (180 - 8 - 46 * t, 180 + 8 + 46 * t), SCIALLE, 'Spine', off=0.03, th=0.016, ny=4, na=6)
    f.ell((0, 0.8, -0.205), (0.05, 0.04, 0.035), SCIALLE_S, 'Spine', n=8, m=4)
    for k in (-1, 1):
        f.tube([(k * 0.02, 0.79, -0.21), (k * 0.05, 0.7, -0.215), (k * 0.06, 0.63, -0.205)], [0.022, 0.018, 0.012], SCIALLE, 'Spine', n=5, res=2)
    # frange sul bordo dello scialle
    for i in range(14):
        a = math.radians(-160 + i * 320 / 13)
        x, z = math.sin(a) * 0.205, 0.02 - math.cos(a) * 0.19
        f.tube([(x, 0.745, z), (x * 1.05, 0.7, z * 1.05)], [0.007, 0.005], SCIALLE_S, 'Spine', n=3, res=1, caps=('flat', 'flat'))
    # gambe (calze scure) e scarpine
    for s, k in (('L', -1), ('R', 1)):
        f.tube([(k * 0.07, 0.3, 0), (k * 0.07, 0.06, 0)], [0.05, 0.042], '#3A3036', LEG(s), n=8)
        scarpa(f, s, k * 0.07, 0.18, 0.055, 0.07, NERO, punta=0.1)
    # braccia: il destro libero, il sinistro piegato col cesto
    sh_l, el_l = (-0.165, 0.93, -0.024), (-0.18, 0.745, -0.018)
    CAT = [(sh_l, [(Y, 14), (X, 12)]), (el_l, [(X, 82)])]
    for s, k in (('L', -1), ('R', 1)):
        f.tube([(k * 0.14, 0.94, -0.02), (k * 0.18, 0.86, -0.02), (k * 0.185, 0.745, -0.02), (k * 0.195, 0.6, -0.04)], [0.06, 0.055, 0.048, 0.042], ABITO, ARM(s), n=8)
        mano(f, s, (k * 0.197, 0.585, -0.042), 0.042, PEL)
    w0 = finale(CAT, (-0.19, 0.66, -0.03))

    def cesto():
        cx, cy, cz = w0[0] - 0.01, w0[1] - 0.17, w0[2] + 0.02
        f.lathe([(0.0, 0.0), (0.08, 0.005), (0.11, 0.07), (0.12, 0.12), (0.105, 0.125), (0.0, 0.06)], '#C98A4B', 'LowerArm.L', n=12, c=(cx, cy, cz))
        f.lathe([(0.115, 0.07), (0.122, 0.075), (0.122, 0.09), (0.115, 0.095)], '#9A6334', 'LowerArm.L', n=12, c=(cx, cy, cz))
        for dx, dz, dy in ((-0.04, -0.02, 0.135), (0.035, -0.03, 0.13), (0.0, 0.04, 0.14), (0.05, 0.035, 0.125)):
            f.ell((cx + dx, cy + dy, cz + dz), (0.042, 0.035, 0.035), '#F5D23A', 'LowerArm.L', n=8, m=5)
        f.ell((cx - 0.01, cy + 0.17, cz + 0.0), (0.03, 0.008, 0.016), '#4E9A46', 'LowerArm.L', n=6, m=3)
        f.ell((cx + 0.03, cy + 0.165, cz + 0.02), (0.016, 0.007, 0.03), '#4E9A46', 'LowerArm.L', n=6, m=3)
        pts = [(cx + 0.11 * math.cos(math.radians(a)), cy + 0.12 + 0.19 * math.sin(math.radians(a)), cz) for a in range(0, 181, 20)]
        f.tube(pts, [0.009] * len(pts), '#9A6334', 'LowerArm.L', n=5, res=1, caps=('flat', 'flat'))
    in_mano(f, CAT, cesto)
    # testa grande e tonda, guance rosa, occhi chiusi felici dietro gli occhiali tondi
    hc = (0, 1.08, -0.075)
    f.ell(hc, (0.125, 0.13, 0.12), PEL, 'Head', n=14, m=9, deform=lambda p: (p[0] * (1 + 0.1 * max(0, -p[1] / 0.13)), p[1], p[2]))
    capelli_cap(f, (0, 1.095, -0.062), (0.134, 0.135, 0.132), CAPELLI, fronte=0.4, dietro=-0.5)
    f.ell((0, 1.235, -0.035), (0.075, 0.062, 0.072), CAPELLI, 'Head', n=10, m=6)  # crocchia
    for a in (-30, 35):  # ferri da calza infilati nella crocchia
        f.push(t=(0, 1.24, -0.035), r=(0, 0, a))
        f.tube([(-0.13, 0, 0.0), (0.13, 0, 0.0)], [0.006, 0.006], '#B9AFA3', 'Head', n=4, res=1)
        f.ell((0.135, 0, 0), (0.014, 0.014, 0.014), '#D9473F', 'Head', n=6, m=3)
        f.pop()
    for k in (-1, 1):
        f.ell((k * 0.07, 1.035, -0.175), (0.032, 0.022, 0.014), GUANCE, 'Head', n=6, m=3)
        f.ell((k * 0.123, 1.075, -0.065), (0.018, 0.034, 0.026), PEL, 'Head', n=6, m=4)
        f.ell((k * 0.125, 1.035, -0.07), (0.011, 0.011, 0.011), '#F2EEE8', 'Head', n=6, m=3)  # perle
    f.ell((0, 1.065, -0.198), (0.023, 0.022, 0.02), '#E7A98A', 'Head', n=8, m=4)
    occhi_chiusi(f, (0, 1.095, -0.19), 0.047, w=0.02, th=0.006)
    f.tube([(-0.03, 1.025, -0.183), (0, 1.015, -0.186), (0.03, 1.025, -0.183)], [0.006, 0.007, 0.006], '#A8453B', 'Head', n=5, res=2)
    for k in (-1, 1):
        anello(f, (k * 0.047, 1.092, -0.197), 0.034, 0.0055, ORO_SCURO, 'Head', n=12, nt=4, r_xyz=(0, k * 8, 0))
    f.tube([(-0.013, 1.098, -0.2), (0.013, 1.098, -0.2)], [0.005, 0.005], ORO_SCURO, 'Head', n=4, res=1)
    return f, B, {'passo': 14, 'braccia': 10, 'molla': 0.6, 'curvo': 6, 'aperte': 9, 'ferme': ('UpperArm.L', 'LowerArm.L'),
                  'posa': lambda t, moto: {'UpperArm.L': list(CAT[0][1]), 'LowerArm.L': list(CAT[1][1])},
                  'idle': lambda t: {'Head': [(X, 4 * max(0, math.sin(4 * math.pi * t)) ** 2)]}}


# ---------------------------------------------------------------- Maestro Ishi: tondo, veste verde acqua e oro, una torre di tre cappelli
def npc_ishi():
    B = bones_for(hip=0.6, chest=1.0, neck=1.05, top=1.33, sh=(0.25, 0.99), elbow=0.8, wrist=0.62, leg_x=0.09, knee=0.33, ankle=0.06, foot=0.12, arm_out=0.06)
    f = Fig('npc_ishi', B)
    VESTE, ORLO, FASCIA, PEL, BIANCO = '#1E8C86', '#F2C14E', '#E2533A', PELLE[2], '#F1ECE3'
    R = [(0.04, 0.3, 0.27, 0.0), (0.22, 0.28, 0.255, 0.0), (0.42, 0.28, 0.26, -0.02), (0.6, 0.29, 0.28, -0.045), (0.78, 0.27, 0.25, -0.03),
         (0.92, 0.235, 0.2, 0.0), (1.0, 0.17, 0.14, 0.0), (1.06, 0.075, 0.075, 0.0)]
    corpo(f, R, VESTE, zone(f, (0.62, TORSO), (0.0, SKIRT())), n=18)
    pannello(f, R, 0.04, 0.09, lambda t: (-180, 180), ORLO, SKIRT(), off=0.004, th=0.01, ny=1, na=20)
    for sg in (-1, 1):  # bavero incrociato d'oro
        pannello(f, R, 0.6, 1.02, lambda t, sg=sg: (sg * 40 * t - 7, sg * 40 * t + 7), ORLO, TORSO, off=0.014, th=0.012, ny=5, na=2)
    pannello(f, R, 0.53, 0.68, lambda t: (-180, 180), FASCIA, TORSO, off=0.01, th=0.018, ny=2, na=20)
    f.ell((0.08, 0.6, -0.33), (0.06, 0.05, 0.04), FASCIA, 'Hips', n=8, m=4)  # nodo della fascia
    for k in (0.02, 0.13):
        f.tube([(k, 0.58, -0.34), (k + 0.01, 0.48, -0.335), (k + 0.02, 0.4, -0.31)], [0.026, 0.022, 0.02], FASCIA, SKIRT(), n=5, res=2)
    # borsello delle monete al fianco
    f.lathe([(0.0, 0.44), (0.06, 0.45), (0.07, 0.5), (0.04, 0.55), (0.025, 0.57), (0.0, 0.57)], '#B8862F', 'Hips', n=10, c=(-0.27, 0, -0.1))
    f.lathe([(0.026, 0.555), (0.03, 0.555), (0.03, 0.57), (0.026, 0.57)], FASCIA, 'Hips', n=10, c=(-0.27, 0, -0.1))
    for s, k in (('L', -1), ('R', 1)):
        scarpa(f, s, k * 0.09, 0.18, 0.06, 0.07, '#3A2B25', punta=0.3)
    # maniche larghe a campana: la sinistra sulla pancia, la destra alza una moneta d'oro
    CAT = {'L': [((-0.25, 0.99, 0.0), [(Y, 6), (X, 10)]), ((-0.28, 0.8, 0.0), [(X, 55), (Z, -30)])],
           'R': [((0.25, 0.99, 0.0), [(Y, -22), (X, 22)]), ((0.28, 0.8, 0.0), [(X, 105), (Z, 20)])]}
    for s, k in (('L', -1), ('R', 1)):
        f.tube([(k * 0.19, 1.0, 0), (k * 0.27, 0.93, 0), (k * 0.295, 0.8, 0), (k * 0.31, 0.66, -0.01)], [0.075, 0.085, 0.09, 0.1], VESTE, ARM(s), n=10,
               caps=('round', None))
        f.lathe([(0.085, 0.0), (0.104, 0.0), (0.104, 0.03), (0.085, 0.03), (0.085, 0.0)], ORLO, f'LowerArm.{s}', n=10, c=(k * 0.312, 0.64, -0.01), caps=False)
        f.lathe([(0.0, 0.03), (0.098, 0.03), (0.098, 0.04), (0.0, 0.04)], '#0E4A46', f'LowerArm.{s}', n=10, c=(k * 0.312, 0.64, -0.01))
        f.tube([(k * 0.313, 0.68, -0.01), (k * 0.315, 0.63, -0.012)], [0.048, 0.044], PEL, f'LowerArm.{s}', n=7, res=1, caps=('flat', 'flat'))
        mano(f, s, (k * 0.316, 0.625, -0.012), 0.05, PEL, ang=20)
    m0 = finale(CAT['R'], (0.316, 0.56, -0.03))

    def moneta():
        f.push(t=(m0[0] - 0.005, m0[1] + 0.06, m0[2] - 0.02), r=(90, 0, 0))
        f.lathe([(0.0, -0.008), (0.062, -0.008), (0.066, 0.0), (0.062, 0.008), (0.0, 0.008)], ORO, 'LowerArm.R', n=14)
        f.lathe([(0.0, 0.007), (0.035, 0.007), (0.035, 0.012), (0.0, 0.012)], ORO_SCURO, 'LowerArm.R', n=10)
        f.pop()
    in_mano(f, CAT['R'], moneta)
    # testa tonda, occhi a fessura sorridenti, occhialini, pizzetto bianco
    hc = (0, 1.18, -0.02)
    f.ell(hc, (0.135, 0.14, 0.13), PEL, 'Head', n=14, m=9, deform=lambda p: (p[0] * (1 + 0.12 * max(0, -p[1] / 0.14)), p[1], p[2]))
    capelli_cap(f, (0, 1.19, -0.005), (0.14, 0.14, 0.135), '#B9B2AA', fronte=0.25, dietro=-0.6)
    for k in (-1, 1):
        f.ell((k * 0.075, 1.12, -0.14), (0.04, 0.03, 0.02), '#E08A6C', 'Head', n=6, m=3)
        f.ell((k * 0.138, 1.17, -0.02), (0.022, 0.045, 0.03), PEL, 'Head', n=6, m=4)
    f.ell((0, 1.155, -0.16), (0.026, 0.028, 0.025), '#C98A62', 'Head', n=8, m=4)
    occhi_chiusi(f, (0, 1.2, -0.137), 0.052, w=0.024, th=0.007)
    for k in (-1, 1):
        f.push(t=(k * 0.052, 1.235, -0.13), r=(0, 0, k * 10))
        f.tube([(-0.034, 0, 0), (0, 0.006, -0.003), (0.034, 0, 0)], [0.009, 0.015, 0.009], '#8E8780', 'Head', n=6, res=2, ref=(0, 1, 0))
        f.pop()
        anello(f, (k * 0.052, 1.198, -0.15), 0.033, 0.006, NERO, 'Head', n=12, nt=4)
    f.tube([(-0.02, 1.205, -0.155), (0.02, 1.205, -0.155)], [0.005, 0.005], NERO, 'Head', n=4, res=1)
    for k in (-1, 1):  # baffetti all'insù
        f.tube([(k * 0.008, 1.125, -0.165), (k * 0.05, 1.12, -0.155), (k * 0.085, 1.14, -0.13)], [0.014, 0.011, 0.005], BIANCO, 'Head', n=5, res=2)
    f.ell((0, 1.06, -0.135), (0.05, 0.06, 0.035), BIANCO, 'Head', n=10, m=5, deform=lambda p: (p[0] * (1 - 0.5 * max(0, -p[1] / 0.06)), p[1], p[2]))
    f.tube([(-0.025, 1.095, -0.155), (0, 1.088, -0.158), (0.025, 1.095, -0.155)], [0.006, 0.007, 0.006], '#8C3A30', 'Head', n=4, res=2)
    # la torre dei cappelli: bombetta verde, fez rosso inclinato, cilindretto viola con la piuma
    f.lathe([(0.0, 1.26), (0.2, 1.26), (0.2, 1.275), (0.14, 1.285), (0.145, 1.35), (0.12, 1.4), (0.0, 1.415)], '#3E7A3A', 'Head', n=16, c=(0, 0, -0.01))
    f.lathe([(0.0, 1.282), (0.143, 1.282), (0.143, 1.31), (0.0, 1.31)], '#2B4A2A', 'Head', n=16, c=(0, 0, -0.01))
    f.push(t=(0.0, 1.405, -0.01), r=(-6, 0, 9))
    f.lathe([(0.0, 0.0), (0.105, 0.0), (0.085, 0.13), (0.0, 0.135)], '#D6403A', 'Head', n=14)
    f.tube([(0, 0.135, 0), (0.035, 0.12, -0.02), (0.07, 0.06, -0.05)], [0.01, 0.009, 0.008], NERO, 'Head', n=4, res=2)
    f.ell((0.075, 0.045, -0.053), (0.022, 0.03, 0.022), NERO, 'Head', n=6, m=4)
    f.push(t=(0.0, 0.13, 0.0), r=(4, 0, -16))
    f.lathe([(0.0, 0.0), (0.11, 0.0), (0.11, 0.012), (0.065, 0.016), (0.07, 0.12), (0.0, 0.12)], '#7A4BC2', 'Head', n=14)
    f.lathe([(0.0, 0.02), (0.069, 0.02), (0.07, 0.045), (0.0, 0.045)], ORO, 'Head', n=14)
    f.tube([(0.06, 0.03, 0.02), (0.09, 0.12, 0.05), (0.07, 0.22, 0.09), (0.03, 0.28, 0.1)], [0.012, 0.022, 0.018, 0.004], '#F5D547', 'Head', n=6, res=3,
           ref=(0, 0, 1))
    f.pop()
    f.pop()
    posa = {f'UpperArm.{s}': list(CAT[s][0][1]) for s in 'LR'}
    posa.update({f'LowerArm.{s}': list(CAT[s][1][1]) for s in 'LR'})

    def idle(t):
        w = math.sin(2 * math.pi * t * 2)
        return {'LowerArm.R': [(X, 6 * w)], 'LowerArm.L': [(X, 3 * w)], 'Spine': [(Z, 3 * math.sin(2 * math.pi * t))], 'Head': [(Y, 5 * math.sin(2 * math.pi * t))]}
    return f, B, {'passo': 16, 'braccia': 0, 'molla': 0.8, 'ferme': tuple(posa), 'posa': lambda t, moto: posa, 'idle': idle}


# ---------------------------------------------------------------- il Furetto: lungo e curvo, bavero alzato, cappellaccio, un furetto vero sulle spalle
def npc_furetto():
    B = bones_for(hip=0.92, chest=1.42, neck=1.46, top=1.74, sh=(0.18, 1.4), elbow=1.12, wrist=0.84, leg_x=0.08, knee=0.5, ankle=0.08, foot=0.17,
                  arm_out=0.03, lean=0.08)
    f = Fig('npc_furetto', B)
    CAPP, CAPP_S, FODERA, PEL = '#5E3B63', '#41284A', '#E0A63A', '#EDCDA8'
    riga = lambda p: '#2A2730' if int((p[0] + 0.3) / 0.022) % 2 else '#7A7484'
    for s, k in (('L', -1), ('R', 1)):  # pantaloni a righe e scarpe a punta
        f.tube([(k * 0.08, 0.9, 0), (k * 0.08, 0.5, 0), (k * 0.08, 0.1, 0)], [0.065, 0.055, 0.045], riga, LEG(s), n=8, res=2)
        scarpa(f, s, k * 0.08, 0.3, 0.055, 0.075, '#6B4026', punta=0.6)
    # cappotto lungo prugna: svasato in fondo, vita stretta, spalle larghe
    R = [(0.46, 0.25, 0.21, 0.03), (0.7, 0.205, 0.17, 0.01), (0.94, 0.16, 0.13, 0.0), (1.12, 0.18, 0.14, 0.0), (1.3, 0.215, 0.16, 0.02),
         (1.4, 0.19, 0.145, 0.01), (1.46, 0.08, 0.07, -0.04)]
    corpo(f, R, CAPP, zone(f, (0.94, TORSO), (0.0, SKIRT())), n=18)
    # spacco davanti con la fodera senape, revers larghi, cintura con la fibbia
    pannello(f, R, 0.46, 0.9, lambda t: (-14 + 13 * t, 14 - 13 * t), FODERA, SKIRT(), off=0.0, th=0.006)
    for sg in (-1, 1):
        pannello(f, R, 0.98, 1.42, lambda t, sg=sg: (sg * (4 + 34 * t), sg * (4 + 34 * t) + sg * (22 - 10 * t)), CAPP_S, TORSO, off=0.004, th=0.012, ny=5, na=3)
    pannello(f, R, 0.92, 0.985, lambda t: (-180, 180), '#2A1C2E', TORSO, off=0.006, th=0.012, ny=1, na=18)
    f.box((0, 0.952, -0.142), (0.06, 0.055, 0.02), ORO, 'Hips')
    f.box((0, 0.952, -0.152), (0.03, 0.028, 0.01), '#2A1C2E', 'Hips')
    for y in (1.04, 1.12):
        for k in (-1, 1):
            f.ell((k * 0.06, y, -0.145), (0.016, 0.016, 0.01), ORO_SCURO, 'Spine', n=6, m=3)
    # tasche con la pattina (piene di roba)
    for k in (-1, 1):
        pannello(f, R, 0.72, 0.76, lambda t, k=k: (k * 30, k * 62) if k > 0 else (k * 62, k * 30), CAPP_S, SKIRT(), off=0.004, th=0.014, ny=1, na=3)
    # bavero alzato: copre bocca e mento, lascia il naso e gli occhi
    f.lathe([(0.1, 1.38), (0.15, 1.42), (0.162, 1.5), (0.17, 1.565), (0.15, 1.565), (0.135, 1.5), (0.09, 1.42)], CAPP_S, ['Spine', 'Head'], n=14,
            c=(0, 0, -0.06), sz=0.95)
    for s, k in (('L', -1), ('R', 1)):  # braccia lunghe e magre
        f.tube([(k * 0.15, 1.4, -0.03), (k * 0.2, 1.3, -0.03), (k * 0.2, 1.12, -0.025), (k * 0.21, 0.88, -0.04)], [0.062, 0.062, 0.054, 0.056], CAPP, ARM(s), n=8)
        f.tube([(k * 0.211, 0.885, -0.04), (k * 0.212, 0.86, -0.042)], [0.058, 0.058], CAPP_S, f'LowerArm.{s}', n=8, res=1, caps=('flat', 'flat'))
        mano(f, s, (k * 0.213, 0.855, -0.043), 0.042, PEL)
    # testa lunga, naso a punta, occhi stretti e furbi, baffetto a matita
    hc = (0, 1.58, -0.09)
    f.ell(hc, (0.105, 0.13, 0.115), PEL, 'Head', n=14, m=9, deform=lambda p: (p[0] * (1 - 0.15 * max(0, -p[1] / 0.13)), p[1], p[2]))
    f.tube([(0, 1.6, -0.19), (0, 1.575, -0.27), (0, 1.55, -0.31)], [(0.026, 0.028), (0.016, 0.018), (0.004, 0.004)], '#EBC09A', 'Head', n=7, res=2)
    for k in (-1, 1):
        f.push(t=(k * 0.045, 1.625, -0.188), r=(0, 0, k * 10))
        f.ell((0, 0, 0), (0.026, 0.013, 0.01), '#F1EAD2', 'Head', n=8, m=3)
        f.ell((k * -0.007, -0.001, -0.005), (0.011, 0.011, 0.008), OCCHIO, 'Head', n=6, m=3)
        f.ell((0, 0.01, -0.002), (0.031, 0.009, 0.014), '#D9AE88', 'Head', n=8, m=3)  # palpebra pesante
        f.pop()
        f.tube([(k * 0.02, 1.652, -0.19), (k * 0.045, 1.66, -0.188), (k * 0.075, 1.672, -0.175)], [0.007, 0.009, 0.005], NERO, 'Head', n=4, res=2)
    # cappellaccio a tesa larga, appena calato sugli occhi
    f.push(t=(0, 1.69, -0.08), r=(-6, 0, -5))
    f.lathe([(0.0, 0.0), (0.25, 0.0), (0.26, 0.012), (0.145, 0.022), (0.128, 0.13), (0.06, 0.15), (0.0, 0.14)], '#221C1E', 'Head', n=18, sz=0.9,
            deform=lambda p: (p[0], p[1] + 0.03 * (abs(p[0]) / 0.25) ** 2 - (0.018 * (-p[2] / 0.22) if p[2] < 0 else 0), p[2]))
    f.lathe([(0.0, 0.025), (0.14, 0.025), (0.137, 0.06), (0.0, 0.06)], '#D9473F', 'Head', n=18, sz=0.9)
    f.pop()
    # il furetto: sdraiato sulle spalle, muso avanti sulla spalla destra, coda giù sul davanti a sinistra
    BODY, DORSO = '#F6E9CC', '#A8642E'
    path = [(0.22, 1.47, -0.12), (0.25, 1.5, 0.02), (0.12, 1.53, 0.16), (-0.1, 1.52, 0.17), (-0.24, 1.48, 0.04), (-0.23, 1.42, -0.11)]
    rads = [(0.06, 0.056), (0.068, 0.062), (0.07, 0.064), (0.068, 0.062), (0.06, 0.056), (0.046, 0.044)]
    f.tube(path, rads, lambda p: DORSO if p[1] > 1.5 or p[2] > 0.1 else BODY, 'Spine', n=10, res=3, ref=(0, 1, 0))
    f.tube([(-0.23, 1.43, -0.1), (-0.24, 1.3, -0.15), (-0.22, 1.15, -0.15), (-0.18, 1.04, -0.16)], [0.04, 0.036, 0.03, 0.014], DORSO, 'Spine', n=7, res=3)
    f.ell((-0.175, 1.03, -0.165), (0.026, 0.04, 0.026), '#3A2A22', 'Spine', n=6, m=4)
    hf = (0.22, 1.49, -0.18)
    f.ell(hf, (0.058, 0.052, 0.068), BODY, 'Spine', n=10, m=6)
    f.tube([(0.22, 1.485, -0.225), (0.22, 1.47, -0.27)], [(0.034, 0.03), (0.013, 0.013)], BODY, 'Spine', n=7, res=1)
    f.ell((0.22, 1.47, -0.276), (0.012, 0.011, 0.01), '#D46B7A', 'Spine', n=6, m=3)
    f.ell((0.22, 1.505, -0.205), (0.06, 0.024, 0.034), '#4A3024', 'Spine', n=8, m=3)  # mascherina
    for k in (-1, 1):
        f.ell((0.22 + k * 0.027, 1.507, -0.232), (0.01, 0.011, 0.006), OCCHIO, 'Spine', n=6, m=3)
        f.ell((0.22 + k * 0.04, 1.535, -0.16), (0.02, 0.022, 0.01), DORSO, 'Spine', n=6, m=3)
    for dx in (0.18, 0.26):
        f.ell((dx, 1.43, -0.15), (0.018, 0.034, 0.02), DORSO, 'Spine', n=6, m=3)

    def idle(t):
        a = math.sin(2 * math.pi * t)
        look = 26 * (1 if a > 0.3 else -1 if a < -0.3 else a / 0.3)
        return {'Head': [(Z, look)], 'Spine': [(Z, look * 0.15)]}
    return f, B, {'passo': 30, 'braccia': 12, 'molla': 0.7, 'curvo': 8, 'aperte': 4, 'idle': idle}


# ---------------------------------------------------------------- Gigi il Mozzo: ragazzino, maglia a righe, fazzoletto rosso, scalzo, sorriso coi denti
def npc_gigi():
    B = bones_for(hip=0.6, chest=0.95, neck=0.98, top=1.33, sh=(0.15, 0.95), elbow=0.77, wrist=0.6, leg_x=0.075, knee=0.33, ankle=0.06, foot=0.11)
    f = Fig('npc_gigi', B)
    BLU, BIANCO, ROSSO, PEL, CAPELLI = '#22427F', '#F4F0E6', '#E2403A', PELLE[1], '#D9682B'
    for s, k in (('L', -1), ('R', 1)):  # calzoni arrotolati, piedi nudi
        f.tube([(k * 0.075, 0.62, 0), (k * 0.078, 0.45, -0.005), (k * 0.08, 0.3, 0)], [0.07, 0.062, 0.058], '#3C6FB0', LEG(s), n=8, caps=('round', 'flat'))
        f.tube([(k * 0.08, 0.31, 0), (k * 0.08, 0.27, 0)], [0.066, 0.066], '#7FA5D6', LEG(s), n=8, res=1, caps=('flat', 'flat'))
        f.tube([(k * 0.08, 0.28, 0), (k * 0.08, 0.06, 0)], [0.04, 0.034], PEL, LEG(s), n=7, caps=('flat', 'flat'))
        scarpa(f, s, k * 0.08, 0.15, 0.048, 0.06, PEL, punta=-0.05)
    # maglia alla marinara: righe orizzontali, un anello ogni riga
    ys = [0.55 + i * 0.038 for i in range(11)]
    rings = [(y, 0.15 + 0.012 * math.sin((y - 0.55) * 7), 0.11, 0.0) for y in ys] + [(0.97, 0.09, 0.075, 0.0)]
    rings[-2] = (rings[-2][0], 0.13, 0.1, 0.0)

    def righe(p):
        return BIANCO if p[1] > 0.93 or int((p[1] - 0.55) / 0.038) % 2 else BLU
    f.tube([(0, y, z) for y, _a, _b, z in rings], [(a, b) for _y, a, b, _z in rings], righe, zone(f, (0.66, TORSO), (0.0, SKIRT())), n=14, res=1,
           caps=('flat', 'round'), capk=0.3)
    f.tube([(0, 0.58, 0), (0, 0.6, 0)], [(0.155, 0.115), (0.155, 0.115)], '#3C6FB0', 'Hips', n=14, res=1, caps=('flat', 'flat'))
    for s, k in (('L', -1), ('R', 1)):
        f.tube([(k * 0.12, 0.96, 0), (k * 0.17, 0.9, 0), (k * 0.175, 0.8, 0)], [0.052, 0.05, 0.05], righe, ARM(s), n=8, res=2, caps=('round', 'flat'))
        f.tube([(k * 0.175, 0.8, 0), (k * 0.18, 0.7, -0.01), (k * 0.19, 0.62, -0.02)], [0.036, 0.033, 0.03], PEL, ARM(s), n=7, caps=('flat', 'flat'))
        mano(f, s, (k * 0.19, 0.615, -0.02), 0.04, PEL)
    # fazzoletto rosso al collo col nodo e le punte
    f.lathe([(0.075, 0.95), (0.105, 0.96), (0.1, 1.0), (0.07, 1.0)], ROSSO, NECK, n=12)
    f.ell((0, 0.95, -0.105), (0.04, 0.032, 0.03), ROSSO, 'Spine', n=8, m=4)
    for k in (-1, 1):
        f.tube([(k * 0.01, 0.94, -0.11), (k * 0.04, 0.88, -0.12), (k * 0.03, 0.83, -0.115)], [(0.03, 0.01), (0.025, 0.008), (0.005, 0.005)], ROSSO, 'Spine', n=5, res=2)
    # testa grossa da ragazzino, capelli rossi a ciuffi, lentiggini, orecchie a sventola, sorrisone col dente mancante
    hc = (0, 1.14, -0.01)
    f.ell(hc, (0.14, 0.15, 0.135), PEL, 'Head', n=14, m=9, deform=lambda p: (p[0] * (1 - 0.12 * max(0, -p[1] / 0.15)), p[1], p[2] - 0.02 * max(0, -p[1] / 0.15)))
    f.ell((0, 1.0, -0.01), (0.05, 0.05, 0.05), PEL, NECK, n=8, m=4)
    capelli_cap(f, (0, 1.16, 0.0), (0.148, 0.148, 0.142), CAPELLI, fronte=0.32, dietro=-0.5)
    for a, el, ln in ((-40, 20, 0.08), (-10, 35, 0.1), (25, 25, 0.09), (60, 10, 0.07), (-70, 5, 0.07), (160, 0, 0.07), (120, 10, 0.07)):
        ar, er = math.radians(a), math.radians(el)
        base = (math.sin(ar) * 0.12, 1.2 + math.sin(er) * 0.06, -math.cos(ar) * 0.11 + 0.01)
        tip = (base[0] * 1.5, base[1] + 0.03 + 0.03 * math.sin(er), base[2] * 1.5 - 0.02)
        f.tube([base, tip], [0.04, 0.004], CAPELLI, 'Head', n=5, res=1, caps=('round', 'flat'))
    for k in (-1, 1):
        f.ell((k * 0.145, 1.135, -0.0), (0.03, 0.045, 0.022), PEL, 'Head', n=7, m=4)
        f.ell((k * 0.147, 1.135, -0.008), (0.016, 0.028, 0.012), '#E9A585', 'Head', n=6, m=3)
        for dx, dy in ((0.06, 1.1), (0.08, 1.11), (0.07, 1.09)):
            f.ell((k * dx, dy, -0.128), (0.006, 0.006, 0.004), '#B5643A', 'Head', n=4, m=2)
    occhi(f, (0, 1.155, -0.128), 0.052, r=(0.017, 0.025, 0.01), sopr=0.014, sopr_col='#B5501E', sopr_k=(0.028, 0.01), sopr_ang=-12)
    f.ell((0, 1.12, -0.152), (0.022, 0.02, 0.018), '#E9A585', 'Head', n=8, m=4)
    f.ell((0, 1.065, -0.128), (0.05, 0.026, 0.02), '#7A2A2A', 'Head', n=10, m=4, cut=(-1, 0.2))
    f.box((-0.017, 1.07, -0.145), (0.022, 0.018, 0.01), BIANCO, 'Head')
    f.box((0.017, 1.07, -0.145), (0.022, 0.018, 0.01), BIANCO, 'Head')
    # berrettino bianco da marinaio, tirato indietro
    f.push(t=(0, 1.265, 0.02), r=(16, 0, 8))
    f.lathe([(0.0, 0.0), (0.1, 0.0), (0.12, 0.06), (0.11, 0.08), (0.0, 0.085)], BIANCO, 'Head', n=14)
    f.lathe([(0.11, 0.0), (0.14, -0.005), (0.15, 0.04), (0.13, 0.05), (0.105, 0.03)], BIANCO, 'Head', n=14)
    f.lathe([(0.115, 0.06), (0.121, 0.06), (0.118, 0.075), (0.11, 0.075)], BLU, 'Head', n=14)
    f.pop()

    def idle(t):
        b = math.sin(4 * math.pi * t)
        return {'Hips': [(Y, 3 * math.sin(2 * math.pi * t))], 'Head': [(Y, -6 * math.sin(2 * math.pi * t))],
                'UpperLeg.L': [(X, 3 * b)], 'UpperLeg.R': [(X, -3 * b)]}
    return f, B, {'passo': 32, 'braccia': 38, 'molla': 2.0, 'aperte': 8, 'idle': idle}


CHARS = {'npc_remo': npc_remo, 'npc_pina': npc_pina, 'npc_ishi': npc_ishi, 'npc_furetto': npc_furetto, 'npc_gigi': npc_gigi}
