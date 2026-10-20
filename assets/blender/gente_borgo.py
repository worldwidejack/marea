# MAREA — i paesani di Borgo Marea (paesani.json, Word «Dialoghi personaggi» di Riccardo): Zia Nella, Tonio il Pescatore, Bice,
# Sor Gaspare, Ada dei Fiori. Ognuno col suo oggetto in mano e la sua andatura.
import math
from gente_kit import Fig, bones_for, TORSO, NECK, ARM, LEG, SKIRT, X, Y, Z, S
from gente_pezzi import *


def _pose(CAT):
    """Dalla catena {lato: [(perno, rotazioni) spalla, (perno, rotazioni) gomito]} al dict fisso della clip."""
    d = {}
    for s, ch in CAT.items():
        d[f'UpperArm.{s}'] = list(ch[0][1])
        d[f'LowerArm.{s}'] = list(ch[1][1])
    return d


# ---------------------------------------------------------------- Zia Nella: vestaglia rosa a fiori, bigodini, occhiali a gatta, un gattone in braccio
def npc_nella():
    B = bones_for(hip=0.68, chest=1.15, neck=1.2, top=1.5, sh=(0.2, 1.15), elbow=0.95, wrist=0.76, leg_x=0.09, knee=0.38, ankle=0.06, foot=0.13, arm_out=0.04)
    f = Fig('npc_nella', B)
    ROSA, PEL, CAPELLI = '#E8618C', PELLE[2], '#B5452B'

    fiori = ROSA
    R = [(0.32, 0.23, 0.21, 0.0), (0.5, 0.255, 0.225, 0.0), (0.68, 0.275, 0.24, 0.0), (0.85, 0.245, 0.21, -0.01), (1.0, 0.23, 0.205, -0.025),
         (1.1, 0.215, 0.18, -0.01), (1.17, 0.17, 0.14, 0.0), (1.22, 0.08, 0.07, 0.0)]
    corpo(f, R, fiori, zone(f, (0.72, TORSO), (0.0, SKIRT())), n=18)
    pannello(f, R, 0.32, 0.36, lambda t: (-180, 180), '#C9426E', SKIRT(), off=0.004, th=0.01, ny=1, na=20)
    pannello(f, R, 1.13, 1.205, lambda t: (-180, 180), '#FFF1F5', TORSO, off=0.008, th=0.014, ny=2, na=18)  # colletto
    pannello(f, R, 0.74, 0.8, lambda t: (-180, 180), '#C9426E', TORSO, off=0.008, th=0.014, ny=1, na=18)   # cintura di stoffa
    f.ell((0.0, 0.77, -0.27), (0.05, 0.04, 0.03), '#C9426E', 'Hips', n=8, m=4)
    # fiori bianchi cuciti sulla vestaglia
    for a, y in ((-40, 0.45), (35, 0.58), (-5, 0.38), (60, 0.42), (-70, 0.62), (150, 0.5), (-150, 0.6), (110, 0.66), (-120, 0.4), (20, 0.95), (-30, 1.02)):
        rx, rz, zc = _ring_at(R, y)
        ar = math.radians(a)
        p = (math.sin(ar) * (rx + 0.004), y, zc - math.cos(ar) * (rz + 0.004))
        fiore(f, p, 0.045, '#FFF1F5', '#F7D046', zone(f, (0.72, TORSO), (0.0, SKIRT())), normale=(math.sin(ar), 0.0, -math.cos(ar)), rot=a)
    for k in (-1, 1):
        f.tube([(k * 0.02, 0.76, -0.27), (k * 0.05, 0.66, -0.28), (k * 0.045, 0.58, -0.27)], [0.02, 0.016, 0.012], '#C9426E', SKIRT(), n=5, res=2)
    for s, k in (('L', -1), ('R', 1)):  # polpacci e pantofole pelose
        f.tube([(k * 0.09, 0.4, 0), (k * 0.09, 0.22, -0.005), (k * 0.09, 0.07, 0)], [0.06, 0.055, 0.042], PEL, LEG(s), n=8, caps=('flat', 'flat'))
        scarpa(f, s, k * 0.09, 0.2, 0.075, 0.09, '#F7A8C4', punta=-0.1)
        f.ell((k * 0.09, 0.08, -0.12), (0.04, 0.04, 0.04), '#FFD6E5', f'Foot.{s}', n=8, m=4)
    # braccia piegate a culla col gatto
    CAT = {'L': [((-0.2, 1.15, 0.0), [(Y, -4), (X, 22)]), ((-0.22, 0.95, 0.0), [(X, 78), (Z, -28)])],
           'R': [((0.2, 1.15, 0.0), [(Y, 4), (X, 28)]), ((0.22, 0.95, 0.0), [(X, 84), (Z, 26)])]}
    for s, k in (('L', -1), ('R', 1)):
        f.tube([(k * 0.17, 1.16, 0), (k * 0.23, 1.08, 0), (k * 0.235, 0.98, 0)], [0.07, 0.07, 0.066], fiori, ARM(s), n=8, res=2, caps=('round', 'flat'))
        f.tube([(k * 0.235, 0.99, 0), (k * 0.24, 0.85, -0.005), (k * 0.245, 0.78, -0.01)], [0.055, 0.05, 0.044], PEL, ARM(s), n=8, caps=('flat', 'flat'))
        mano(f, s, (k * 0.247, 0.775, -0.012), 0.048, PEL)
    hl, hr = finale(CAT['L'], (-0.245, 0.74, -0.01)), finale(CAT['R'], (0.245, 0.74, -0.01))
    mid = tuple((a + b) / 2 for a, b in zip(hl, hr))
    # il gatto rosso tigrato, acciambellato sulle braccia (pesato sul busto: le braccia stanno ferme)
    GATTO, GATTO_S = '#F08A35', '#C2601E'
    tigre = lambda p: GATTO_S if int(p[0] * 40) % 3 == 0 else GATTO
    cx, cy, cz = mid[0], mid[1] + 0.07, mid[2] + 0.01
    f.ell((cx, cy, cz), (0.19, 0.1, 0.11), tigre, 'Spine', n=12, m=6)
    f.ell((cx + 0.17, cy + 0.08, cz - 0.04), (0.085, 0.08, 0.08), GATTO, 'Spine', n=10, m=6)
    for k in (-1, 1):
        f.tube([(cx + 0.17 + k * 0.045, cy + 0.13, cz - 0.04), (cx + 0.17 + k * 0.06, cy + 0.2, cz - 0.04)], [(0.03, 0.014), (0.004, 0.004)], GATTO_S, 'Spine', n=4, res=1,
               caps=('flat', 'flat'))
        f.ell((cx + 0.17 + k * 0.03, cy + 0.095, cz - 0.112), (0.012, 0.016, 0.006), '#3F6E2A', 'Spine', n=6, m=3)
    f.ell((cx + 0.17, cy + 0.065, cz - 0.118), (0.032, 0.022, 0.016), '#FBE7D2', 'Spine', n=6, m=3)
    f.ell((cx + 0.17, cy + 0.075, cz - 0.128), (0.01, 0.007, 0.006), '#D46B7A', 'Spine', n=5, m=2)
    f.tube([(cx - 0.17, cy - 0.02, cz), (cx - 0.24, cy - 0.12, cz - 0.04), (cx - 0.22, cy - 0.25, cz - 0.08)], [0.03, 0.026, 0.02], tigre, 'Spine', n=6, res=3)
    # testa: guance, rossetto, occhiali a gatta rossi, orecchini a cerchio, capelli ramati coi bigodini colorati
    hc = (0, 1.34, -0.01)
    f.ell(hc, (0.13, 0.145, 0.13), PEL, 'Head', n=14, m=9, deform=lambda p: (p[0] * (1 + 0.06 * max(0, -p[1] / 0.145)), p[1], p[2]))
    f.ell((0, 1.2, -0.01), (0.06, 0.05, 0.055), PEL, NECK, n=8, m=4)
    capelli_cap(f, (0, 1.37, 0.01), (0.15, 0.15, 0.145), CAPELLI, fronte=0.3, dietro=-0.55)
    for x, y, z, rz in ((-0.085, 1.47, -0.07, 70), (0.0, 1.5, -0.07, 90), (0.085, 1.47, -0.07, 110), (-0.06, 1.5, 0.05, 80), (0.06, 1.5, 0.05, 100)):
        f.push(t=(x, y, z), r=(0, 0, rz))
        f.lathe([(0.0, -0.06), (0.034, -0.06), (0.034, 0.06), (0.0, 0.06)], '#7FD3E0' if rz in (70, 90) else '#F5D547', 'Head', n=8)
        f.pop()
    for k in (-1, 1):
        f.ell((k * 0.07, 1.3, -0.11), (0.03, 0.022, 0.014), GUANCE, 'Head', n=6, m=3)
        f.ell((k * 0.13, 1.33, -0.0), (0.02, 0.038, 0.028), PEL, 'Head', n=6, m=4)
        anello(f, (k * 0.135, 1.27, -0.005), 0.026, 0.005, ORO, 'Head', n=10, nt=4, r_xyz=(0, 90, 0))
    f.ell((0, 1.325, -0.14), (0.022, 0.024, 0.02), '#C98A62', 'Head', n=8, m=4)
    occhi(f, (0, 1.36, -0.118), 0.05, r=(0.016, 0.022, 0.01))
    for k in (-1, 1):  # montatura a gatta
        f.push(t=(k * 0.05, 1.365, -0.13), r=(0, 0, k * -8))
        anello(f, (0, 0, 0), 0.032, 0.007, '#D9273F', 'Head', n=12, nt=4, sy=0.7)
        f.tube([(k * 0.02, 0.018, 0), (k * 0.045, 0.03, 0), (k * 0.055, 0.045, 0.005)], [0.008, 0.007, 0.003], '#D9273F', 'Head', n=4, res=2)
        f.pop()
    f.tube([(-0.032, 1.27, -0.122), (0, 1.262, -0.128), (0.032, 1.27, -0.122)], [0.008, 0.012, 0.008], '#C41E3A', 'Head', n=5, res=2)
    f.ell((0.06, 1.285, -0.118), (0.006, 0.006, 0.004), '#5A3A28', 'Head', n=4, m=2)  # neo
    posa = _pose(CAT)
    return f, B, {'passo': 18, 'braccia': 0, 'molla': 1.0, 'ferme': tuple(posa), 'posa': lambda t, moto: posa,
                  'idle': lambda t: {'Head': [(Y, 7 * math.sin(2 * math.pi * t)), (X, -3)], 'Spine': [(Y, 2 * math.sin(2 * math.pi * t))]}}


# ---------------------------------------------------------------- Tonio il Pescatore: lungo, cerata gialla, stivaloni, canna in spalla, pesciolino in mano
def npc_tonio():
    B = bones_for(hip=0.95, chest=1.43, neck=1.47, top=1.78, sh=(0.2, 1.42), elbow=1.14, wrist=0.87, leg_x=0.09, knee=0.52, ankle=0.08, foot=0.16, arm_out=0.04)
    f = Fig('npc_tonio', B)
    CERATA, CERATA_S, STIVALI, PEL = '#F4C430', '#D9A21B', '#3E7D4A', PELLE[2]
    for s, k in (('L', -1), ('R', 1)):
        f.tube([(k * 0.09, 0.95, 0), (k * 0.09, 0.6, 0)], [0.07, 0.065], '#2E3B55', LEG(s), n=8)
        f.tube([(k * 0.09, 0.62, 0), (k * 0.09, 0.35, 0), (k * 0.09, 0.06, 0)], [0.078, 0.07, 0.068], STIVALI, LEG(s), n=9, caps=('flat', 'flat'))
        f.lathe([(0.0, 0.56), (0.088, 0.56), (0.092, 0.63), (0.0, 0.63)], '#2F6339', LEG(s), n=9, c=(k * 0.09, 0, 0))
        scarpa(f, s, k * 0.09, 0.28, 0.075, 0.1, STIVALI, suola='#22302A', punta=0.1)
    R = [(0.6, 0.23, 0.2, 0.01), (0.8, 0.205, 0.175, 0.0), (0.98, 0.19, 0.155, 0.0), (1.16, 0.2, 0.155, 0.0), (1.32, 0.215, 0.16, 0.0),
         (1.42, 0.18, 0.14, 0.0), (1.48, 0.08, 0.07, 0.0)]
    corpo(f, R, CERATA, zone(f, (0.98, TORSO), (0.0, SKIRT())), n=16)
    pannello(f, R, 0.6, 1.44, lambda t: (-6, 6), CERATA_S, zone(f, (0.98, TORSO), (0.0, SKIRT())), off=0.002, th=0.008, ny=8, na=1)
    for y in (0.78, 0.95, 1.12, 1.29):  # alamari
        rx, rz, zc = 0.21, 0.165, 0.0
        f.box((0.0, y, zc - rz - 0.03 + (0.01 if y > 1.1 else 0)), (0.06, 0.018, 0.016), '#6B4026', 'Spine' if y > 1.0 else 'Hips')
    f.lathe([(0.12, 1.4), (0.165, 1.43), (0.17, 1.49), (0.14, 1.49), (0.11, 1.44)], CERATA, NECK, n=14, c=(0, 0, 0.01))
    # braccio destro alzato: tiene la canna sulla spalla; il sinistro giù col pesce
    CAT = {'R': [((0.2, 1.42, 0.0), [(Y, -14), (X, 38)]), ((0.22, 1.14, 0.0), [(X, 112)])]}
    for s, k in (('L', -1), ('R', 1)):
        f.tube([(k * 0.17, 1.43, 0), (k * 0.22, 1.33, 0), (k * 0.225, 1.14, 0), (k * 0.24, 0.9, -0.01)], [0.07, 0.07, 0.062, 0.064], CERATA, ARM(s), n=8)
        mano(f, s, (k * 0.242, 0.88, -0.012), 0.05, PEL)
    f.ell((-0.25, 0.83, -0.05), (0.018, 0.024, 0.018), '#F4F0E6', 'LowerArm.L', n=6, m=3)  # pollice fasciato
    hand_r = finale(CAT['R'], (0.242, 0.84, -0.03))

    def canna():
        x, y, z = hand_r
        d = (0.08, 0.55, 0.83)
        tip = (x + d[0] * 1.6, y + d[1] * 1.6, z + d[2] * 1.6)
        f.tube([(x - d[0] * 0.25, y - d[1] * 0.25, z - d[2] * 0.25), (x, y, z), tip], [0.016, 0.013, 0.004], '#7A4B26', 'LowerArm.R', n=5, res=1)
        f.lathe([(0.0, -0.03), (0.035, -0.03), (0.035, 0.03), (0.0, 0.03)], '#B9AFA3', 'LowerArm.R', n=8, c=(x + 0.04, y - 0.06, z - 0.06))
        f.tube([tip, (tip[0], tip[1] - 0.35, tip[2] + 0.02)], [0.003, 0.003], '#E8E1D6', 'LowerArm.R', n=3, res=1)
        f.ell((tip[0], tip[1] - 0.37, tip[2] + 0.02), (0.022, 0.03, 0.022), lambda p: '#E8433F' if p[1] > tip[1] - 0.37 else '#F4F0E6', 'LowerArm.R', n=8, m=4)
    in_mano(f, CAT['R'], canna)
    # il pesciolino (piccolo: «no, più piccolo») appeso per la coda
    fx, fy, fz = -0.245, 0.74, -0.03
    f.ell((fx, fy, fz), (0.025, 0.075, 0.045), lambda p: '#5E8FB8' if p[2] > fz else '#BFD6E6', 'LowerArm.L', n=8, m=6)
    f.tube([(fx, fy + 0.07, fz), (fx, fy + 0.11, fz)], [(0.008, 0.012), (0.012, 0.04)], '#5E8FB8', 'LowerArm.L', n=5, res=1, caps=('flat', 'flat'))
    f.ell((fx - 0.02, fy - 0.035, fz - 0.02), (0.006, 0.009, 0.009), OCCHIO, 'LowerArm.L', n=4, m=2)
    # faccia lunga cotta dal sole, barba di tre giorni, nasone storto, sorriso
    hc = (0, 1.62, -0.02)
    barba = lambda p: '#A8724F' if p[1] < 1.56 and p[2] < 0.03 else PEL
    f.ell(hc, (0.115, 0.15, 0.125), barba, 'Head', n=14, m=10, deform=lambda p: (p[0] * (1 - 0.1 * max(0, -p[1] / 0.15)), p[1], p[2] - 0.015 * max(0, -p[1] / 0.15)))
    f.ell((0.0, 1.605, -0.15), (0.034, 0.04, 0.036), '#D0805C', 'Head', n=10, m=6, deform=lambda p: (p[0], p[1], p[2] - 0.012 * max(0, -p[1] / 0.04)))  # nasone
    for k in (-1, 1):
        f.ell((k * 0.115, 1.62, 0.0), (0.02, 0.04, 0.028), PEL, 'Head', n=6, m=4)
        f.ell((k * 0.065, 1.6, -0.1), (0.028, 0.018, 0.012), '#C9634A', 'Head', n=6, m=3)
    occhi(f, (0, 1.655, -0.113), 0.05, r=(0.016, 0.02, 0.01), sopr=0.012, sopr_col='#3A2A22', sopr_k=(0.03, 0.013), sopr_ang=-12)
    f.ell((0, 1.552, -0.13), (0.042, 0.02, 0.016), '#6E2A24', 'Head', n=8, m=3, cut=(-1, 0.3))  # sorriso
    f.box((0, 1.557, -0.142), (0.046, 0.009, 0.008), BIANCO_OCCHIO, 'Head')
    # cappello da pioggia giallo: tesa lunga dietro
    f.push(t=(0, 1.71, 0.0), r=(6, 0, 0))
    f.lathe([(0.0, 0.0), (0.2, 0.0), (0.21, 0.012), (0.13, 0.03), (0.125, 0.09), (0.08, 0.12), (0.0, 0.125)], CERATA, 'Head', n=16,
            deform=lambda p: (p[0], p[1] - (0.06 * (p[2] / 0.2) ** 2 if p[2] > 0 else 0.0), p[2] * (1.35 if p[2] > 0 else 0.85)))
    f.lathe([(0.0, 0.035), (0.128, 0.035), (0.126, 0.05), (0.0, 0.05)], CERATA_S, 'Head', n=16)
    f.pop()
    posa = _pose(CAT)
    return f, B, {'passo': 30, 'braccia': 26, 'molla': 1.2, 'ferme': tuple(posa), 'posa': lambda t, moto: posa, 'aperte': 6,
                  'idle': lambda t: {'Head': [(X, -4 + 3 * math.sin(2 * math.pi * t)), (Z, 6 * math.sin(2 * math.pi * t))], 'LowerArm.L': [(X, 6 + 4 * math.sin(4 * math.pi * t))]}}


# ---------------------------------------------------------------- Bice: fazzoletto rosso a pois col fiocco, maniche arrotolate, ramazza in mano
def npc_bice():
    B = bones_for(hip=0.64, chest=1.08, neck=1.12, top=1.42, sh=(0.19, 1.07), elbow=0.88, wrist=0.7, leg_x=0.085, knee=0.36, ankle=0.06, foot=0.13, arm_out=0.05)
    f = Fig('npc_bice', B)
    VEST, PEL, CAPELLI, FAZZ = '#3F9BD6', PELLE[1], '#2E1E14', '#E2403A'
    for s, k in (('L', -1), ('R', 1)):
        f.tube([(k * 0.085, 0.42, 0), (k * 0.085, 0.2, -0.005), (k * 0.085, 0.08, 0)], [0.06, 0.05, 0.042], PEL, LEG(s), n=8, caps=('flat', 'flat'))
        f.lathe([(0.0, 0.06), (0.05, 0.06), (0.052, 0.14), (0.0, 0.14)], '#F4F0E6', LEG(s), n=8, c=(k * 0.085, 0, 0))
        scarpa(f, s, k * 0.085, 0.2, 0.065, 0.085, '#6B4026', suola='#2E1E14', punta=0.05)
    R = [(0.38, 0.24, 0.21, 0.0), (0.55, 0.23, 0.2, 0.0), (0.7, 0.215, 0.185, 0.0), (0.84, 0.2, 0.17, -0.01), (0.98, 0.215, 0.185, -0.02),
         (1.06, 0.19, 0.16, 0.0), (1.12, 0.08, 0.07, 0.0)]
    corpo(f, R, VEST, zone(f, (0.7, TORSO), (0.0, SKIRT())), n=16)
    pannello(f, R, 1.03, 1.11, lambda t: (-180, 180), '#F4F0E6', TORSO, off=0.008, th=0.014, ny=2, na=16)
    pannello(f, R, 0.4, 0.8, lambda t: (-48, 48), '#F4F0E6', SKIRT(), off=0.006, ny=4, na=8)  # grembiule
    pannello(f, R, 0.48, 0.6, lambda t: (-22, 22), '#D9E6EE', SKIRT(), off=0.022, th=0.008, ny=1, na=3)  # tascone
    pannello(f, R, 0.78, 0.82, lambda t: (-180, 180), '#F4F0E6', TORSO, off=0.01, th=0.01, ny=1, na=16)
    # braccia: maniche corte arrotolate, avambracci forti; la destra tiene la ramazza dritta
    CAT = {'R': [((0.19, 1.07, 0.0), [(Y, -16), (X, 16)]), ((0.215, 0.88, 0.0), [(X, 62)])]}
    for s, k in (('L', -1), ('R', 1)):
        f.tube([(k * 0.16, 1.08, 0), (k * 0.22, 1.0, 0), (k * 0.23, 0.93, 0)], [0.068, 0.066, 0.064], VEST, ARM(s), n=8, res=2, caps=('round', 'flat'))
        f.lathe([(0.0, -0.03), (0.07, -0.03), (0.072, 0.0), (0.0, 0.0)], '#F4F0E6', ARM(s), n=8, c=(k * 0.231, 0.925, 0))
        f.tube([(k * 0.23, 0.93, 0), (k * 0.235, 0.8, -0.005), (k * 0.24, 0.72, -0.01)], [0.052, 0.05, 0.04], PEL, ARM(s), n=8, caps=('flat', 'flat'))
        mano(f, s, (k * 0.242, 0.715, -0.012), 0.05, PEL)
    hr = finale(CAT['R'], (0.242, 0.67, -0.03))

    def ramazza():
        x, y, z = hr
        f.tube([(x, 1.28, z - 0.02), (x, y, z), (x + 0.01, 0.3, z - 0.07)], [0.016, 0.016, 0.016], '#8E5A2B', 'LowerArm.R', n=6, res=1)
        f.lathe([(0.0, 0.0), (0.12, 0.0), (0.1, 0.16), (0.04, 0.3), (0.0, 0.3)], lambda p: '#D9B25A' if caso(p, 3) > 0.25 else '#B98C3A', 'LowerArm.R', n=12,
                c=(x + 0.01, 0.02, z - 0.07), sz=0.6)
        f.lathe([(0.042, 0.24), (0.06, 0.24), (0.052, 0.27), (0.04, 0.27)], FAZZ, 'LowerArm.R', n=10, c=(x + 0.01, 0.02, z - 0.07))
    in_mano(f, CAT['R'], ramazza)
    # testa: sopracciglia decise, guance rosse, bocca a mezzo sorriso; fazzoletto a pois col fiocco in alto
    hc = (0, 1.25, -0.01)
    f.ell(hc, (0.125, 0.14, 0.125), PEL, 'Head', n=14, m=9, deform=lambda p: (p[0] * (1 - 0.06 * max(0, -p[1] / 0.14)), p[1], p[2]))
    f.ell((0, 1.12, -0.01), (0.055, 0.05, 0.05), PEL, NECK, n=8, m=4)
    pois = lambda p: '#F7F1E6' if caso(p, 7) < 0.22 else FAZZ
    capelli_cap(f, (0, 1.27, 0.0), (0.138, 0.14, 0.136), CAPELLI, fronte=0.25, dietro=-0.7)
    capelli_cap(f, (0, 1.285, 0.01), (0.142, 0.135, 0.14), pois, fronte=0.55, dietro=-0.2)
    f.ell((0, 1.42, -0.04), (0.035, 0.03, 0.03), FAZZ, 'Head', n=8, m=4)
    for k in (-1, 1):
        f.tube([(k * 0.02, 1.42, -0.04), (k * 0.07, 1.47, -0.05), (k * 0.09, 1.49, -0.03)], [(0.022, 0.01), (0.035, 0.012), (0.02, 0.008)], pois, 'Head', n=5, res=2)
        f.ell((k * 0.068, 1.205, -0.105), (0.03, 0.022, 0.014), '#E87562', 'Head', n=6, m=3)
        f.ell((k * 0.123, 1.24, -0.0), (0.018, 0.034, 0.026), PEL, 'Head', n=6, m=4)
    f.ell((0.0, 1.135, 0.075), (0.06, 0.05, 0.05), CAPELLI, 'Head', n=8, m=5)  # crocchia dietro
    f.ell((0, 1.235, -0.135), (0.02, 0.02, 0.018), '#E9A585', 'Head', n=8, m=4)
    occhi(f, (0, 1.27, -0.115), 0.048, r=(0.015, 0.021, 0.01), sopr=0.008, sopr_col=CAPELLI, sopr_k=(0.03, 0.012), sopr_ang=-16)
    f.tube([(-0.035, 1.18, -0.115), (0.0, 1.177, -0.123), (0.03, 1.188, -0.117), (0.042, 1.196, -0.112)], [0.006, 0.008, 0.007, 0.004], '#A8453B', 'Head', n=4, res=2)
    posa = _pose(CAT)
    return f, B, {'passo': 30, 'braccia': 30, 'molla': 1.5, 'ferme': tuple(posa), 'posa': lambda t, moto: posa, 'aperte': 10,
                  'idle': lambda t: {'Spine': [(Z, 5 * math.sin(2 * math.pi * t))], 'Hips': [(Z, -3 * math.sin(2 * math.pi * t))],
                                     'UpperArm.L': [(X, 10 * max(0, math.sin(2 * math.pi * t)))]}}


# ---------------------------------------------------------------- Sor Gaspare: lungo e dritto, completo panna, paglietta, baffoni bianchi, monocolo, bastone
def npc_gaspare():
    B = bones_for(hip=0.98, chest=1.48, neck=1.52, top=1.84, sh=(0.2, 1.46), elbow=1.18, wrist=0.9, leg_x=0.09, knee=0.54, ankle=0.08, foot=0.17, arm_out=0.04,
                  lean=0.03)
    f = Fig('npc_gaspare', B)
    PANNA, PANNA_S, GILET, PEL, BIANCO = '#ECE1C4', '#D4C7A3', '#7A4A2A', PELLE[1], '#F4F1EC'
    for s, k in (('L', -1), ('R', 1)):
        f.tube([(k * 0.09, 1.0, 0), (k * 0.09, 0.55, 0), (k * 0.09, 0.1, 0)], [0.075, 0.065, 0.058], PANNA, LEG(s), n=9, caps=('round', 'flat'))
        scarpa(f, s, k * 0.09, 0.3, 0.07, 0.085, lambda p: '#F4F1EC' if abs(p[2] + 0.1) < 0.07 else '#6B4026', suola='#3A2B25', punta=0.15)
    R = [(0.88, 0.2, 0.17, 0.0), (1.0, 0.195, 0.17, -0.01), (1.12, 0.205, 0.18, -0.025), (1.28, 0.21, 0.165, -0.01), (1.4, 0.21, 0.155, 0.0),
         (1.48, 0.17, 0.13, 0.0), (1.53, 0.07, 0.065, 0.0)]
    gw = zone(f, (1.0, TORSO), (0.0, SKIRT()))
    corpo(f, R, PANNA, gw, n=16)
    # gilet marrone e camicia bianca nel vano della giacca, cravattino rosso
    pannello(f, R, 0.98, 1.47, lambda t: (-(14 + 10 * t), 14 + 10 * t), GILET, gw, off=0.0, th=0.006, ny=5, na=4)
    pannello(f, R, 1.3, 1.5, lambda t: (-(4 + 14 * t), 4 + 14 * t), BIANCO, TORSO, off=0.008, th=0.006, ny=3, na=2)
    for sg in (-1, 1):  # revers
        pannello(f, R, 1.12, 1.5, lambda t, sg=sg: (sg * (16 + 10 * t), sg * (30 + 6 * t)), PANNA_S, TORSO, off=0.006, th=0.01, ny=4, na=2)
    for y in (1.04, 1.12, 1.2):
        f.ell((0, y, -0.205 + (y - 1.04) * 0.07), (0.012, 0.012, 0.008), '#F5D547', 'Spine', n=6, m=3)
    f.ell((0, 1.47, -0.15), (0.022, 0.02, 0.016), '#D9273F', 'Spine', n=6, m=3)
    for k in (-1, 1):
        f.ell((k * 0.04, 1.47, -0.145), (0.035, 0.024, 0.014), '#D9273F', 'Spine', n=6, m=3)
    f.tube([(0.08, 1.24, -0.18), (0.13, 1.2, -0.17), (0.17, 1.24, -0.12)], [0.006, 0.006, 0.006], ORO, 'Spine', n=4, res=2)  # catena dell'orologio
    # braccio destro avanti col bastone, il sinistro dietro la schiena
    CAT = {'R': [((0.2, 1.46, 0.0), [(Y, -8), (X, 14)]), ((0.22, 1.18, 0.0), [(X, 30)])],
}
    for s, k in (('L', -1), ('R', 1)):
        f.tube([(k * 0.17, 1.47, 0), (k * 0.215, 1.38, 0), (k * 0.22, 1.18, 0), (k * 0.235, 0.94, -0.01)], [0.065, 0.065, 0.058, 0.056], PANNA, ARM(s), n=8)
        f.tube([(k * 0.236, 0.945, -0.01), (k * 0.237, 0.925, -0.01)], [0.05, 0.05], BIANCO, f'LowerArm.{s}', n=8, res=1, caps=('flat', 'flat'))
        mano(f, s, (k * 0.238, 0.92, -0.012), 0.048, PEL)
    hr = finale(CAT['R'], (0.238, 0.87, -0.03))

    def bastone():
        x, y, z = hr
        f.tube([(x, y + 0.04, z), (x + 0.02, 0.45, z - 0.1), (x + 0.03, 0.01, z - 0.18)], [0.017, 0.016, 0.014], '#3A2418', 'LowerArm.R', n=6, res=2)
        f.ell((x, y + 0.06, z), (0.03, 0.03, 0.03), ORO, 'LowerArm.R', n=8, m=4)
    in_mano(f, CAT['R'], bastone)
    # testa lunga, nasone, baffoni bianchi all'insù, sopracciglia folte, monocolo
    hc = (0, 1.68, -0.04)
    f.ell(hc, (0.11, 0.15, 0.12), PEL, 'Head', n=14, m=10, deform=lambda p: (p[0] * (1 - 0.12 * max(0, -p[1] / 0.15)), p[1], p[2]))
    f.ell((0, 1.535, -0.03), (0.055, 0.05, 0.05), PEL, NECK, n=8, m=4)
    # corona di capelli bianchi: solo attorno alla nuca e sopra le orecchie, pelato in cima
    f.ell((0, 1.68, -0.025), (0.122, 0.11, 0.13), BIANCO, 'Head', n=14, m=5, cut=(-0.55, 0.3),
          deform=lambda p: (p[0], p[1], p[2] * (0.55 if p[2] < -0.02 else 1.0)))
    f.tube([(0, 1.705, -0.155), (0, 1.66, -0.19), (0, 1.635, -0.18)], [(0.022, 0.022), (0.03, 0.03), (0.024, 0.02)], '#E7A98A', 'Head', n=8, res=2)
    for k in (-1, 1):
        f.tube([(k * 0.005, 1.625, -0.165), (k * 0.06, 1.615, -0.155), (k * 0.12, 1.635, -0.13), (k * 0.16, 1.69, -0.11), (k * 0.145, 1.72, -0.1)],
               [0.022, 0.026, 0.018, 0.01, 0.004], BIANCO, 'Head', n=7, res=3)
        f.ell((k * 0.112, 1.67, -0.03), (0.02, 0.042, 0.03), PEL, 'Head', n=6, m=4)
        f.ell((k * 0.07, 1.65, -0.12), (0.025, 0.018, 0.012), GUANCE, 'Head', n=6, m=3)
    occhi(f, (0, 1.715, -0.135), 0.044, r=(0.013, 0.016, 0.008), sopr=0.008, sopr_col=BIANCO, sopr_k=(0.034, 0.016), sopr_ang=-14)
    anello(f, (0.044, 1.712, -0.148), 0.03, 0.006, ORO, 'Head', n=12, nt=4)
    f.tube([(0.074, 1.71, -0.145), (0.1, 1.62, -0.13), (0.11, 1.52, -0.13)], [0.003, 0.003, 0.003], ORO, ['Head', 'Spine'], n=3, res=2)
    # paglietta: cupola piatta, nastro nero, tesa dritta
    f.push(t=(0, 1.77, -0.03), r=(-4, 0, 3))
    f.lathe([(0.0, 0.0), (0.2, 0.0), (0.2, 0.014), (0.125, 0.016), (0.125, 0.085), (0.0, 0.085)], '#E8CF8A', 'Head', n=16, sz=0.95)
    f.lathe([(0.0, 0.016), (0.127, 0.016), (0.127, 0.045), (0.0, 0.045)], NERO, 'Head', n=16, sz=0.95)
    f.pop()
    posa = _pose(CAT)
    return f, B, {'passo': 22, 'braccia': 14, 'molla': 0.5, 'ferme': tuple(posa), 'posa': lambda t, moto: posa, 'curvo': -3,
                  'idle': lambda t: {'Head': [(X, -6), (Z, 10 * math.sin(2 * math.pi * t))], 'Spine': [(X, 3)]}}


# ---------------------------------------------------------------- Ada dei Fiori: salopette verde, cappellone di paglia coperto di fiori, treccia, cesoie
def npc_ada():
    B = bones_for(hip=0.9, chest=1.36, neck=1.4, top=1.7, sh=(0.18, 1.34), elbow=1.08, wrist=0.83, leg_x=0.085, knee=0.48, ankle=0.08, foot=0.14, arm_out=0.04)
    f = Fig('npc_ada', B)
    SALO, SALO_S, MAGLIA, PEL, CAPELLI = '#4E9A46', '#3B7A35', '#F49AB2', PELLE[4], '#1E1410'
    for s, k in (('L', -1), ('R', 1)):
        f.tube([(k * 0.085, 0.95, 0), (k * 0.088, 0.6, 0), (k * 0.09, 0.3, 0)], [0.08, 0.07, 0.066], SALO, LEG(s), n=9, caps=('round', 'flat'))
        f.lathe([(0.0, 0.28), (0.07, 0.28), (0.072, 0.33), (0.0, 0.33)], SALO_S, LEG(s), n=9, c=(k * 0.09, 0, 0))
        f.tube([(k * 0.09, 0.3, 0), (k * 0.09, 0.08, 0)], [0.042, 0.036], PEL, LEG(s), n=7, caps=('flat', 'flat'))
        scarpa(f, s, k * 0.09, 0.24, 0.07, 0.1, '#E8763A', punta=0.05)
    R = [(0.84, 0.195, 0.165, 0.0), (0.96, 0.18, 0.155, 0.0), (1.08, 0.165, 0.145, 0.0), (1.2, 0.185, 0.155, -0.015), (1.3, 0.19, 0.15, -0.01),
         (1.37, 0.16, 0.13, 0.0), (1.41, 0.07, 0.065, 0.0)]
    corpo(f, R, MAGLIA, zone(f, (0.96, TORSO), (0.0, SKIRT())), n=16)
    pannello(f, R, 0.84, 1.02, lambda t: (-180, 180), SALO, zone(f, (0.96, TORSO), (0.0, SKIRT())), off=0.004, th=0.012, ny=2, na=16)
    pannello(f, R, 1.0, 1.26, lambda t: (-40, 40), SALO, TORSO, off=0.004, th=0.012, ny=3, na=6)   # pettorina
    pannello(f, R, 1.1, 1.18, lambda t: (-20, 20), SALO_S, TORSO, off=0.016, th=0.006, ny=1, na=3)  # taschino
    f.ell((-0.02, 1.2, -0.185), (0.012, 0.03, 0.01), '#E8433F', 'Spine', n=5, m=3)  # un fiore nel taschino
    f.ell((-0.02, 1.23, -0.188), (0.022, 0.018, 0.014), '#F5D547', 'Spine', n=6, m=3)
    for sg in (-1, 1):  # bretelle
        pannello(f, R, 1.2, 1.37, lambda t, sg=sg: (sg * 28 - 6, sg * 28 + 6), SALO, TORSO, off=0.006, th=0.01, ny=2, na=1)
        pannello(f, R, 1.0, 1.37, lambda t, sg=sg: (180 + sg * 28 - 6, 180 + sg * 28 + 6), SALO, TORSO, off=0.006, th=0.01, ny=3, na=1)
        f.ell((sg * 0.09, 1.25, -0.165), (0.016, 0.016, 0.01), ORO, 'Spine', n=6, m=3)
    CAT = {'R': [((0.18, 1.34, 0.0), [(Y, -12), (X, 18)]), ((0.2, 1.08, 0.0), [(X, 58)])]}
    for s, k in (('L', -1), ('R', 1)):
        f.tube([(k * 0.15, 1.35, 0), (k * 0.2, 1.27, 0), (k * 0.205, 1.2, 0)], [0.058, 0.056, 0.055], MAGLIA, ARM(s), n=8, res=2, caps=('round', 'flat'))
        f.tube([(k * 0.205, 1.2, 0), (k * 0.21, 1.05, -0.005), (k * 0.22, 0.92, -0.01)], [0.042, 0.04, 0.036], PEL, ARM(s), n=8, caps=('flat', 'flat'))
        f.tube([(k * 0.22, 0.93, -0.01), (k * 0.223, 0.86, -0.012)], [0.044, 0.05], '#F5D547', f'LowerArm.{s}', n=8, res=1, caps=('flat', 'flat'))
        mano(f, s, (k * 0.224, 0.86, -0.012), 0.05, '#F5D547')
    hr = finale(CAT['R'], (0.224, 0.8, -0.04))

    def cesoie():
        x, y, z = hr
        for a in (-12, 12):
            f.push(t=(x, y, z), r=(0, 0, a))
            f.tube([(0, 0.0, 0), (0, -0.09, -0.01)], [0.016, 0.014], '#D9273F', 'LowerArm.R', n=5, res=1)
            f.push(r=(-90, 0, 0))
            f.tube([(0, 0.0, -0.01), (0.0, 0.0, 0.04), (0.012, 0.0, 0.17)], [(0.012, 0.004), (0.016, 0.004), (0.002, 0.002)], '#C9CDD2', 'LowerArm.R', n=4, res=1)
            f.pop()
            f.pop()
    in_mano(f, CAT['R'], cesoie)
    # testa: lentiggini, sorrisone, treccia lunga sulla spalla sinistra col fiore in fondo
    hc = (0, 1.55, -0.01)
    f.ell(hc, (0.118, 0.14, 0.125), PEL, 'Head', n=14, m=9, deform=lambda p: (p[0] * (1 - 0.1 * max(0, -p[1] / 0.14)), p[1], p[2]))
    f.ell((0, 1.42, -0.01), (0.05, 0.05, 0.05), PEL, NECK, n=8, m=4)
    capelli_cap(f, (0, 1.565, 0.0), (0.127, 0.135, 0.134), CAPELLI, fronte=0.3, dietro=-0.6)
    br = [(-0.08, 1.5, 0.08), (-0.15, 1.42, 0.02), (-0.17, 1.32, -0.08), (-0.155, 1.18, -0.13), (-0.14, 1.06, -0.14)]
    f.tube(br, [0.045, 0.042, 0.04, 0.035, 0.026], lambda p: CAPELLI if int(p[1] * 30) % 2 else '#3A2A20', ['Head', 'Spine'], n=8, res=2)
    fiore(f, (-0.14, 1.05, -0.155), 0.04, '#F7F1E6', '#F5D547', 'Spine', normale=(0, 0.2, -1))
    for k in (-1, 1):
        f.ell((k * 0.117, 1.545, -0.0), (0.018, 0.035, 0.026), PEL, 'Head', n=6, m=4)
        f.ell((k * 0.065, 1.505, -0.105), (0.026, 0.018, 0.012), '#B5503E', 'Head', n=6, m=3)
        for dx, dy in ((0.05, 1.525), (0.07, 1.53), (0.085, 1.52), (0.06, 1.512)):
            f.ell((k * dx, dy, -0.112), (0.005, 0.005, 0.004), '#3A2418', 'Head', n=4, m=2)
    f.ell((0, 1.535, -0.13), (0.02, 0.019, 0.018), '#7A4A30', 'Head', n=8, m=4)
    occhi(f, (0, 1.57, -0.115), 0.045, r=(0.016, 0.023, 0.01), sopr=0.01, sopr_col=CAPELLI, sopr_k=(0.026, 0.009), sopr_ang=8)
    f.ell((0, 1.48, -0.106), (0.042, 0.02, 0.014), '#6E2420', 'Head', n=8, m=3, cut=(-1, 0.3))
    f.box((0, 1.484, -0.118), (0.05, 0.01, 0.008), '#F7F1E6', 'Head')
    # cappellone di paglia con un mucchio di fiori
    f.push(t=(0, 1.635, -0.005), r=(-5, 0, -4))
    paglia = lambda p: '#EFD38A' if caso(p, 5) > 0.2 else '#D8B864'
    f.lathe([(0.0, 0.0), (0.32, -0.02), (0.33, -0.008), (0.14, 0.02), (0.13, 0.11), (0.0, 0.12)], paglia, 'Head', n=20,
            deform=lambda p: (p[0], p[1] - 0.03 * (math.hypot(p[0], p[2]) / 0.32) ** 3, p[2]))
    f.lathe([(0.0, 0.02), (0.135, 0.02), (0.132, 0.055), (0.0, 0.055)], '#F49AB2', 'Head', n=20)
    for i, (a, rr, col) in enumerate(((20, 0.13, '#E8433F'), (70, 0.15, '#F7F1E6'), (120, 0.13, '#F5D547'), (160, 0.16, '#A64DFF'), (-20, 0.16, '#FF8FB0'),
                                      (-60, 0.13, '#F7F1E6'), (-110, 0.15, '#E8433F'), (-150, 0.13, '#FF8FB0'), (45, 0.06, '#F5D547'), (-90, 0.06, '#E8433F'),
                                      (180, 0.06, '#F7F1E6'))):
        ar = math.radians(a)
        y = 0.07 if rr > 0.1 else 0.13
        fiore(f, (math.sin(ar) * rr, y, -math.cos(ar) * rr), 0.06 if rr > 0.1 else 0.05, col, '#F5B83D' if col != '#F5D547' else '#E8763A', 'Head',
              normale=(math.sin(ar) * 0.6, 1, -math.cos(ar) * 0.6), rot=i * 0.7)
        f.ell((math.sin(ar + 0.35) * (rr + 0.02), y - 0.012, -math.cos(ar + 0.35) * (rr + 0.02)), (0.028, 0.008, 0.016), '#4E9A46', 'Head', n=6, m=3)
    f.pop()
    posa = _pose(CAT)
    return f, B, {'passo': 26, 'braccia': 24, 'molla': 1.2, 'ferme': tuple(posa), 'posa': lambda t, moto: posa, 'aperte': 6,
                  'idle': lambda t: {'Head': [(Y, 8 * math.sin(2 * math.pi * t)), (X, -3)], 'LowerArm.R': [(X, 8 * max(0, math.sin(6 * math.pi * t)))]}}


CHARS = {'npc_nella': npc_nella, 'npc_tonio': npc_tonio, 'npc_bice': npc_bice, 'npc_gaspare': npc_gaspare, 'npc_ada': npc_ada}
