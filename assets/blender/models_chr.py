# Personaggio base: umano a 6 teste, 1,6 m, stile PS1 / FF IX. Davanti −Z, piedi a y = 0, origine ai piedi al centro.
# Nodi (tutti SkinnedMesh sullo stesso scheletro, figli di `chr_base_rig`):
#   chr_base            corpo: mat_pelle, mat_vestito (maschere bianche tinte dal client), mat_atlas (pantaloni, scarpe, cintura)
#   capelli_0..7        corti, spettinati, coda, caschetto, rasati, ricci, lunghi, chignon (mat_capelli, maschera bianca)
#   cappello_<id>       paglia, berretto, pescatore, lanterna, neon (mat_cappello, maschera bianca; accenti mat_emissivo)
# Il client mostra un solo capelli_* e al più un cappello_* (avatar.json). Viso dipinto sull'atlas (regione `testa`).
# Armatura semplice con pesi rigidi per segmento e pesi misti 50/50 sugli anelli di giuntura (gomiti, ginocchia, vita, collo).
# Clip procedurali (loop): idle 2 s · walk 0,53 s (1 falcata ≈ 1,6 m → 3 m/s) · run 0,53 s (1 falcata ≈ 2,7 m → 5 m/s)
#                          sit 2 s (bacino a 0,42 m, piedi a terra) · row 1,4 s (remata da seduti).
import math
import bpy
from mathutils import Quaternion, Vector
from lib import Mesh, key, to_blender

FPS = 30
HAIR = ['corti', 'spettinati', 'coda', 'caschetto', 'rasati', 'ricci', 'lunghi', 'chignon']  # = avatar.json → capelli
HATS = ['paglia', 'berretto', 'pescatore', 'lanterna', 'neon']  # = avatar.json → cappelli (senza «nessuno»)

# ossa: nome -> (testa, coda, genitore) in coordinate di gioco
BONES = {
    'Hips': ((0, 0.86, 0), (0, 0.98, 0), None),
    'Spine': ((0, 0.98, 0), (0, 1.27, 0), 'Hips'),
    'Head': ((0, 1.29, 0), (0, 1.6, 0), 'Spine'),
    'UpperArm.L': ((-0.2, 1.24, 0), (-0.215, 0.965, 0), 'Spine'),
    'LowerArm.L': ((-0.215, 0.965, 0), (-0.228, 0.62, 0), 'UpperArm.L'),
    'UpperArm.R': ((0.2, 1.24, 0), (0.215, 0.965, 0), 'Spine'),
    'LowerArm.R': ((0.215, 0.965, 0), (0.228, 0.62, 0), 'UpperArm.R'),
    'UpperLeg.L': ((-0.09, 0.85, 0), (-0.09, 0.46, 0), 'Hips'),
    'LowerLeg.L': ((-0.09, 0.46, 0), (-0.09, 0.08, 0), 'UpperLeg.L'),
    'Foot.L': ((-0.09, 0.08, 0), (-0.09, 0.03, -0.13), 'LowerLeg.L'),
    'UpperLeg.R': ((0.09, 0.85, 0), (0.09, 0.46, 0), 'Hips'),
    'LowerLeg.R': ((0.09, 0.46, 0), (0.09, 0.08, 0), 'UpperLeg.R'),
    'Foot.R': ((0.09, 0.08, 0), (0.09, 0.03, -0.13), 'LowerLeg.R'),
}


def ell(m, n, rx, y, rz, cx=0.0, cz=0.0, a0=None):
    return m.ring(n, rx, y, rz=rz, a0=math.pi / n if a0 is None else a0, cx=cx, cz=cz)


def weigh(m, ring, ws):
    for p in ring:
        m.wmap[key(p)] = ws


# ---------------------------------------------------------------- corpo (#287: sheet di Jack del 13 ott, assets/concept/avatar/)
def spike(m, base, tip, r, region, n=3, rot=0.0):
    """Ciocca a punta: piramide a n lati dalla base (dentro la calotta) alla punta, facce verso l'esterno."""
    d = _vnorm(_vsub(tip, base))
    u = _vnorm(_vcross(d, (0.0, 1.0, 0.0) if abs(d[1]) < 0.9 else (1.0, 0.0, 0.0)))
    v = _vcross(d, u)
    ring = [tuple(base[k] + r * (math.cos(rot + 2 * math.pi * i / n) * u[k] + math.sin(rot + 2 * math.pi * i / n) * v[k]) for k in range(3))
            for i in range(n)]
    for i in range(n):
        a, b = ring[i], ring[(i + 1) % n]
        mid = tuple((a[k] + b[k]) / 2 - base[k] for k in range(3))
        nrm = _vcross(_vsub(b, a), _vsub(tip, a))
        m.poly([a, b, tip] if sum(nrm[k] * mid[k] for k in range(3)) > 0 else [b, a, tip], region)


def _vsub(a, b): return (a[0] - b[0], a[1] - b[1], a[2] - b[2])
def _vcross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
def _vnorm(a):
    l = math.sqrt(a[0] ** 2 + a[1] ** 2 + a[2] ** 2) or 1.0
    return (a[0] / l, a[1] / l, a[2] / l)


def profile_x(m, x0, x1, prof, region, top=True):
    """Solido estruso lungo x da un profilo (z, y_basso, y_alto) dal tallone alla punta: piede nudo."""
    for (za, ya0, ya1), (zb, yb0, yb1) in zip(prof, prof[1:]):
        m.poly([(x0, ya1, za), (x1, ya1, za), (x1, yb1, zb), (x0, yb1, zb)], region)      # sopra
        m.poly([(x0, ya0, za), (x0, ya1, za), (x0, yb1, zb), (x0, yb0, zb)], region)      # fianco sinistro
        m.poly([(x1, ya1, za), (x1, ya0, za), (x1, yb0, zb), (x1, yb1, zb)], region)      # fianco destro
    zt, yt0, yt1 = prof[-1]
    m.poly([(x1, yt0, zt), (x0, yt0, zt), (x0, yt1, zt), (x1, yt1, zt)], region)          # punta
    zh, yh0, yh1 = prof[0]
    m.poly([(x0, yh0, zh), (x1, yh0, zh), (x1, yh1, zh), (x0, yh1, zh)], region)          # tallone


def build_body():
    m = Mesh('chr_base')
    J = lambda a, b: [(a, 0.5), (b, 0.5)]

    # --- camicia aperta a maniche corte (mat_vestito, tinta scelta), fuori dai pantaloncini. Anelli a 12 con un vertice davanti (a0 = 0):
    #     il vertice davanti dell'anello delle spalle scende a 1,13 → la V del collo, riempita di pelle.
    m.mat, m.bone = 'mat_vestito', 'Spine'
    E = lambda rx, y, rz, cz=0.0: ell(m, 12, rx, y, rz, cz=cz, a0=0.0)
    R = [E(0.162, 0.79, 0.11), E(0.152, 0.88, 0.102), E(0.145, 0.98, 0.098), E(0.16, 1.08, 0.108, cz=-0.008), E(0.17, 1.19, 0.096)]
    Nk = E(0.062, 1.285, 0.056, cz=0.004)
    FV = 9  # indice del vertice davanti (270° = −z)
    R[4][FV] = (0.0, 1.16, -0.104)
    m.loft(R, 'vestito', bottom='vestito')
    weigh(m, R[0], [('Hips', 1.0)]); weigh(m, R[1], [('Hips', 1.0)]); weigh(m, R[2], J('Hips', 'Spine'))
    for i in range(12):  # spalle → collo; ai lati della V la faccia si spezza: metà camicia (bavero), metà pelle (la V)
        j = (i + 1) % 12
        if j == FV:
            m.poly([R[4][j], R[4][i], Nk[i]], 'vestito')
            m.mat = 'mat_pelle'; m.poly([R[4][j], Nk[i], Nk[j]], 'pelle'); m.mat = 'mat_vestito'
        elif i == FV:
            m.poly([R[4][j], R[4][i], Nk[j]], 'vestito')
            m.mat = 'mat_pelle'; m.poly([R[4][i], Nk[i], Nk[j]], 'pelle'); m.mat = 'mat_vestito'
        else:
            m.poly([R[4][j], R[4][i], Nk[i], Nk[j]], 'vestito')
    for side in (FV - 1, FV + 1):  # baveri: alette rivoltate lungo i bordi della V
        a, b = R[4][side], R[4][FV]
        out = (a[0] * 1.15, a[1] + 0.03, a[2] - 0.016)
        fin(m, a, Nk[side], out, 'vestito')
    # --- pantaloncini teal (colore fisso): bacino e due gambe larghe fino a sopra il ginocchio
    m.mat, m.bone = 'mat_atlas', 'Hips'
    P = [ell(m, 8, 0.12, 0.71, 0.085), ell(m, 8, 0.158, 0.78, 0.102), ell(m, 8, 0.15, 0.86, 0.098)]
    m.loft(P, 'pantaloncini', bottom='pantaloncini')
    for s, side in ((-1, 'L'), (1, 'R')):
        x = 0.09 * s
        m.bone = f'UpperLeg.{side}'
        Sh = [ell(m, 7, 0.074, 0.52, 0.074, cx=x * 1.06, cz=-0.004), ell(m, 7, 0.08, 0.64, 0.08, cx=x * 1.02), ell(m, 7, 0.084, 0.76, 0.084, cx=x)]
        m.loft(Sh, 'pantaloncini', bottom='pantaloncini')
        weigh(m, Sh[2], J('Hips', f'UpperLeg.{side}'))
    # --- gambe nude (pelle) dalla caviglia a dentro i pantaloncini, piedi nudi e ciabatte
    for s, side in ((-1, 'L'), (1, 'R')):
        x = 0.09 * s
        m.mat, m.bone = 'mat_pelle', f'UpperLeg.{side}'
        L = [ell(m, 6, 0.032, 0.1, 0.032, cx=x), ell(m, 6, 0.052, 0.28, 0.056, cx=x, cz=0.012), ell(m, 6, 0.042, 0.41, 0.043, cx=x),
             ell(m, 6, 0.048, 0.47, 0.05, cx=x, cz=-0.004), ell(m, 6, 0.064, 0.6, 0.064, cx=x)]
        m.loft(L, 'pelle')
        for r in L[:3]:
            weigh(m, r, [(f'LowerLeg.{side}', 1.0)])
        weigh(m, L[3], J(f'UpperLeg.{side}', f'LowerLeg.{side}'))
        m.bone = f'Foot.{side}'
        profile_x(m, x - 0.034, x + 0.034, [(0.045, 0.02, 0.07), (0.0, 0.02, 0.1), (-0.055, 0.02, 0.066), (-0.11, 0.02, 0.042), (-0.138, 0.02, 0.034)], 'pelle')
        m.mat = 'mat_atlas'
        m.box(x - 0.046, 0.0, -0.155, x + 0.046, 0.02, 0.062, 'ciabatte', skip=('bottom',))
        m.box(x - 0.037, 0.03, -0.09, x + 0.037, 0.06, -0.072, 'ciabatte', skip=('bottom',))  # fascetta sul collo del piede
    # --- braccia: manica corta larga (vestito), braccio e mano (pelle)
    for s, side in ((-1, 'L'), (1, 'R')):
        ua, la = f'UpperArm.{side}', f'LowerArm.{side}'
        m.mat, m.bone = 'mat_vestito', ua
        S = [ell(m, 7, 0.058, 1.03, 0.056, cx=0.212 * s), ell(m, 7, 0.054, 1.12, 0.055, cx=0.198 * s), ell(m, 7, 0.036, 1.18, 0.042, cx=0.17 * s)]
        m.loft(S, 'vestito', bottom='vestito')
        m.mat = 'mat_pelle'
        A = [ell(m, 6, 0.03, 0.72, 0.028, cx=0.226 * s), ell(m, 6, 0.04, 0.85, 0.038, cx=0.222 * s), ell(m, 6, 0.039, 0.965, 0.039, cx=0.215 * s),
             ell(m, 6, 0.048, 1.08, 0.048, cx=0.209 * s)]
        m.loft(A, 'pelle')
        for r in A[:2]:
            weigh(m, r, [(la, 1.0)])
        weigh(m, A[2], J(ua, la))
        m.bone = la
        H = [ell(m, 6, 0.022, 0.6, 0.013, cx=0.232 * s), ell(m, 6, 0.034, 0.66, 0.019, cx=0.23 * s), ell(m, 6, 0.029, 0.72, 0.023, cx=0.226 * s)]
        m.loft(H, 'mano', bottom='mano')
        m.box(0.226 * s - 0.011, 0.64, -0.043, 0.226 * s + 0.011, 0.69, -0.017, 'mano', skip=('top',))  # pollice
    # --- collo e testa a faccette (mascella e mento in avanti, nuca tonda); viso dipinto: proiezione frontale su 0,22 × 0,28 m
    #     = regione `viso` 28×36 → 128 texel/m
    m.mat, m.bone = 'mat_pelle', 'Head'
    N = [ell(m, 6, 0.046, 1.25, 0.043), ell(m, 6, 0.042, 1.3, 0.04), ell(m, 6, 0.04, 1.37, 0.04, cz=0.012)]
    m.loft(N, 'pelle')
    weigh(m, N[0], [('Spine', 1.0)]); weigh(m, N[1], J('Spine', 'Head'))
    hb = dict(uv='head', bbox=(-0.11, 1.32, 0.11, 1.6), alt='pelle')
    Hd = [ell(m, 8, 0.058, 1.335, 0.044, cz=-0.038), ell(m, 8, 0.084, 1.37, 0.086, cz=-0.014), ell(m, 8, 0.09, 1.425, 0.1, cz=-0.002),
          ell(m, 8, 0.094, 1.475, 0.108, cz=0.004), ell(m, 8, 0.091, 1.525, 0.108, cz=0.006), ell(m, 8, 0.07, 1.578, 0.088, cz=0.008)]
    m.loft(Hd, 'viso', bottom='pelle', **hb)
    top = (0.0, 1.603, 0.01)
    for i in range(8):
        j = (i + 1) % 8
        m.poly([Hd[-1][j], Hd[-1][i], top], 'pelle')
    # orecchie
    for s in (-1, 1):
        m.box(s * 0.089 - 0.007, 1.415, -0.01, s * 0.089 + 0.007, 1.465, 0.016, 'pelle', skip=())
    return m


# ---------------------------------------------------------------- capelli
F_KNOTS = (0.0381, 0.3087, 0.6913, 0.9619)  # «frontalità» dei punti di un anello a 8: dietro, lato-dietro, lato-davanti, davanti


def hring(rx, rz, ys, cz=0.0, n=8, jag=0.0, rot=0.0, cx=0.0):
    """Anello di capelli: ys = (davanti, dietro) lineare, oppure (davanti, lato-davanti, lato-dietro, dietro) a tratti."""
    if len(ys) == 2:
        yf, yb = ys
        yat = lambda f: yb + (yf - yb) * f
    else:
        vals = (ys[3], ys[2], ys[1], ys[0])
        def yat(f):
            if f <= F_KNOTS[0]:
                return vals[0]
            for k in range(3):
                if f <= F_KNOTS[k + 1]:
                    t = (f - F_KNOTS[k]) / (F_KNOTS[k + 1] - F_KNOTS[k])
                    return vals[k] + (vals[k + 1] - vals[k]) * t
            return vals[3]
    pts = []
    for i in range(n):
        a = math.pi / n + 2 * math.pi * i / n + rot
        f = (-math.sin(a) + 1) / 2
        pts.append((cx + math.cos(a) * rx, yat(f) + (jag if i % 2 else -jag), cz + math.sin(a) * rz))
    return pts


def shell(m, rings, top, region='capelli'):
    m.loft(rings, region)
    n = len(rings[-1])
    for i in range(n):
        j = (i + 1) % n
        m.poly([rings[-1][j], rings[-1][i], top], region)


def fin(m, a, b, tip, region):
    """Ciocca/aletta piatta visibile dai due lati."""
    m.poly([a, b, tip], region)
    m.poly([b, a, tip], region)


def hair_piece(i):
    m = Mesh(f'capelli_{i}')
    m.mat, m.bone = 'mat_capelli', 'Head'
    style = HAIR[i]
    if style == 'corti':  # attaccatura alta, scende dietro fino alla nuca, ciuffo sulla fronte
        shell(m, [hring(0.106, 0.117, (1.505, 1.37)), hring(0.11, 0.12, (1.54, 1.47)), hring(0.092, 0.102, (1.59, 1.565)),
                  hring(0.05, 0.058, (1.625, 1.618))], (0.0, 1.635, 0.005))
        m.poly([(-0.07, 1.545, -0.103), (0.02, 1.545, -0.113), (-0.025, 1.49, -0.116)], 'capelli')
        m.poly([(-0.02, 1.545, -0.113), (0.07, 1.55, -0.103), (0.04, 1.5, -0.113)], 'capelli')
    elif style == 'spettinati':  # sheet #283: ciocche grosse a punta tutto attorno, frangia a ciuffi sulla fronte
        R = [hring(0.11, 0.121, (1.52, 1.49, 1.43, 1.37)), hring(0.122, 0.132, (1.57, 1.55, 1.52, 1.49)), hring(0.104, 0.114, (1.62, 1.6)),
             hring(0.056, 0.064, (1.66, 1.654))]
        shell(m, R, (0.0, 1.672, 0.006))
        c = (0.0, 1.5, 0.012)
        # (azimut: 0 = davanti, 90 = destra di chi guarda; elevazione; lunghezza; raggio della base)
        for az, el, ln, r in ((0, 72, 0.07, 0.03), (55, 62, 0.075, 0.032), (125, 55, 0.07, 0.034), (180, 58, 0.06, 0.034),
                              (235, 55, 0.07, 0.034), (305, 62, 0.075, 0.032), (90, 34, 0.055, 0.03), (270, 34, 0.055, 0.03),
                              (150, 22, 0.05, 0.032), (210, 22, 0.05, 0.032), (180, 5, 0.04, 0.03), (120, 2, 0.045, 0.026),
                              (240, 2, 0.045, 0.026), (35, 38, 0.055, 0.028), (325, 38, 0.055, 0.028)):
            ca, sa = math.cos(math.radians(az)), math.sin(math.radians(az))
            ce, se = math.cos(math.radians(el)), math.sin(math.radians(el))
            d = (sa * ce, se, -ca * ce)
            base = (c[0] + d[0] * 0.08, c[1] + d[1] * 0.08, c[2] + d[2] * 0.09)
            tip = (base[0] + d[0] * ln * 1.45, base[1] + d[1] * ln * 1.45 - (0.03 if el < 30 else 0.0), base[2] + d[2] * ln * 1.45)
            spike(m, base, tip, r * 2.3, 'capelli', rot=az * 0.05)
        for x0, x1, tx, ty in ((-0.105, -0.025, -0.08, 1.49), (-0.045, 0.045, -0.01, 1.5), (0.025, 0.105, 0.07, 1.495)):  # frangia a 3 ciocche
            fin(m, (x0, 1.585, -0.1), (x1, 1.585, -0.108), (tx, ty, -0.122), 'capelli')
    elif style == 'coda':  # tirati indietro, coda alta che scende sulla schiena
        shell(m, [hring(0.106, 0.117, (1.53, 1.4)), hring(0.11, 0.12, (1.56, 1.48)), hring(0.09, 0.1, (1.6, 1.57)),
                  hring(0.05, 0.058, (1.628, 1.62))], (0.0, 1.638, 0.005))
        T = [m.ring(5, 0.028, 1.24, a0=0.3, cz=0.17), m.ring(5, 0.042, 1.35, a0=0.3, cz=0.175), m.ring(5, 0.04, 1.45, a0=0.3, cz=0.15),
             m.ring(5, 0.03, 1.5, a0=0.3, cz=0.115)]
        m.loft(T, 'capelli')
        tip = (0.0, 1.16, 0.15)
        for k in range(5):
            m.poly([T[0][k], T[0][(k + 1) % 5], tip], 'capelli')
    elif style == 'caschetto':  # a scodella fino al mento, frangia dritta
        shell(m, [hring(0.118, 0.128, (1.49, 1.37, 1.36, 1.36)), hring(0.122, 0.132, (1.55, 1.52, 1.5, 1.49)),
                  hring(0.095, 0.105, (1.605, 1.6, 1.59, 1.585))], (0.0, 1.64, 0.005))
    elif style == 'rasati':  # calotta aderente, attaccatura alta
        shell(m, [hring(0.103, 0.114, (1.54, 1.43)), hring(0.1, 0.113, (1.565, 1.52)), hring(0.078, 0.09, (1.597, 1.588))],
              (0.0, 1.617, 0.005))
    elif style == 'ricci':  # volume grande e bitorzoluto
        shell(m, [hring(0.122, 0.132, (1.5, 1.37), jag=0.02), hring(0.132, 0.142, (1.56, 1.5), rot=math.pi / 8),
                  hring(0.112, 0.122, (1.625, 1.605), jag=0.012), hring(0.06, 0.066, (1.66, 1.655), rot=math.pi / 8)], (0.0, 1.672, 0.005))
    elif style == 'lunghi':  # frangia, ai lati fino alle spalle, dietro a metà schiena
        shell(m, [hring(0.115, 0.135, (1.5, 1.28, 1.2, 1.16), cz=0.01), hring(0.114, 0.126, (1.52, 1.44, 1.4, 1.38)),
                  hring(0.11, 0.12, (1.55, 1.52, 1.49, 1.48)), hring(0.09, 0.1, (1.598, 1.59, 1.58, 1.575))], (0.0, 1.635, 0.005))
    elif style == 'chignon':  # tirati indietro, crocchia alta dietro
        shell(m, [hring(0.105, 0.116, (1.53, 1.39)), hring(0.108, 0.119, (1.56, 1.49)), hring(0.085, 0.096, (1.6, 1.58))],
              (0.0, 1.625, 0.005))
        c = (0.0, 1.585, 0.1)
        Rb = m.ring(6, 0.055, c[1], cz=c[2], a0=0.0)
        top, bot = (c[0], c[1] + 0.06, c[2] + 0.01), (c[0], c[1] - 0.05, c[2])
        for k in range(6):
            j = (k + 1) % 6
            m.poly([Rb[j], Rb[k], top], 'capelli')
            m.poly([Rb[k], Rb[j], bot], 'capelli')
    return m


# ---------------------------------------------------------------- cappelli
def hat_piece(hid):
    m = Mesh(f'cappello_{hid}')
    m.mat, m.bone = 'mat_cappello', 'Head'
    if hid == 'paglia':  # kasa conico, sopra e sotto
        m.cone(10, 0.26, 1.575, 1.73, 'cappello', a0=0.0)
        base = m.ring(10, 0.26, 1.575, a0=0.0)
        inner = (0.0, 1.665, 0.0)
        for i in range(10):
            m.poly([base[i], base[(i + 1) % 10], inner], 'cappello')
    elif hid == 'berretto':  # berretto con visiera
        R = [hring(0.148, 0.158, (1.53, 1.5)), hring(0.13, 0.14, (1.63, 1.62))]
        shell(m, R, (0.0, 1.69, 0.005), 'cappello')
        v = [(-0.09, 1.535, -0.13), (0.09, 1.535, -0.13), (0.08, 1.51, -0.245), (0.0, 1.505, -0.265), (-0.08, 1.51, -0.245)]
        m.poly(v, 'cappello')
        m.poly(list(reversed(v)), 'cappello')
    elif hid == 'pescatore':  # a secchiello: calotta tronca e tesa inclinata
        L0 = hring(0.152, 0.162, (1.515, 1.515))
        shell(m, [L0, hring(0.135, 0.145, (1.665, 1.665))], (0.0, 1.69, 0.005), 'cappello')
        brim = hring(0.23, 0.24, (1.465, 1.465))
        m.loft([brim, L0], 'cappello')
        m.loft([L0, brim], 'cappello')  # sotto della tesa
    elif hid == 'lanterna':  # lanterna di carta sulla testa: fasce tinte, corpo emissivo
        yb = 1.6
        C = [m.ring(6, 0.075, yb, a0=0.0), m.ring(6, 0.075, yb + 0.02, a0=0.0)]
        m.loft(C, 'cappello')
        m.mat = 'mat_emissivo'
        L = [C[1], m.ring(6, 0.1, yb + 0.07, a0=0.0), m.ring(6, 0.1, yb + 0.14, a0=0.0), m.ring(6, 0.075, yb + 0.19, a0=0.0)]
        m.loft(L, 'em_lanterna')
        m.mat = 'mat_cappello'
        T = [L[-1], m.ring(6, 0.075, yb + 0.21, a0=0.0)]
        m.loft(T, 'cappello', top='cappello')
    elif hid == 'neon':  # visiera: fascia sulla fronte, tesa con bordo al neon
        band = [hring(0.125, 0.135, (1.5, 1.505)), hring(0.125, 0.135, (1.535, 1.54))]
        m.loft(band, 'cappello')
        m.loft(list(reversed(band)), 'cappello')  # interno, visibile dall'alto dietro la testa
        v = [(-0.1, 1.53, -0.1), (0.1, 1.53, -0.1), (0.09, 1.51, -0.23), (0.0, 1.505, -0.255), (-0.09, 1.51, -0.23)]
        m.poly(v, 'cappello')
        m.poly(list(reversed(v)), 'cappello')
        m.mat = 'mat_emissivo'
        e = [(0.09, 1.51, -0.23), (0.0, 1.505, -0.255), (-0.09, 1.51, -0.23)]
        for a, b in zip(e, e[1:]):
            q = [a, b, (b[0], b[1] - 0.018, b[2]), (a[0], a[1] - 0.018, a[2])]
            m.poly(q, 'em_neon_rosa')
            m.poly(list(reversed(q)), 'em_neon_rosa')
    return m


# ---------------------------------------------------------------- scheletro
def build_rig(mesh_obs):
    arm = bpy.data.armatures.new('rig')
    ob = bpy.data.objects.new('chr_base_rig', arm)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.update()
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for name, (h, t, parent) in BONES.items():
        b = arm.edit_bones.new(name)
        b.head, b.tail = to_blender(h), to_blender(t)
        b.roll = 0.0
        if parent:
            b.parent = arm.edit_bones[parent]
            b.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    for mo in mesh_obs:
        mo.parent = ob
        mod = mo.modifiers.new('Armature', 'ARMATURE'); mod.object = ob
    return ob


# ---------------------------------------------------------------- animazioni
def rot(pb, axis, deg):
    """Rotazione attorno a un asse dello spazio armatura (a riposo), espressa nel locale dell'osso."""
    B = pb.bone.matrix_local.to_3x3()
    a = B.inverted() @ Vector(axis)
    return Quaternion(a, math.radians(deg))


X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)  # Blender: X lato, Y avanti (−Z di gioco), Z su
S = {'L': 1, 'R': -1}  # segno per l'apertura laterale delle braccia (attorno a Y)


def pose(ob, frame, d):
    """d: {osso: [(asse, gradi), ...] | 'loc': (x, y, z)}"""
    for pb in ob.pose.bones:
        rs = d.get(pb.name, [])
        q = Quaternion()
        for axis, deg in rs:
            q = rot(pb, axis, deg) @ q
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = q
        pb.keyframe_insert('rotation_quaternion', frame=frame)
        loc = d.get('loc') if pb.name == 'Hips' else None
        pb.location = Vector(loc) if loc else Vector((0, 0, 0))
        if pb.name == 'Hips':
            pb.keyframe_insert('location', frame=frame)


def hips_loc(ob, dz=0.0, dy=0.0):
    """Spostamento del bacino in spazio armatura → locale dell'osso Hips."""
    B = ob.pose.bones['Hips'].bone.matrix_local.to_3x3()
    return tuple(B.inverted() @ Vector((0, dy, dz)))


def arms_rest(extra=0.0):
    return {f'UpperArm.{s}': [(Y, (7 + extra) * S[s])] for s in 'LR'}


def clip_idle(ob, t):
    b = math.sin(2 * math.pi * t)
    d = arms_rest(1.5 * b)
    d['Spine'] = [(X, -1.2 * b)]
    d['Head'] = [(X, 1.0 * b), (Z, 3 * math.sin(math.pi * t))]
    for s in 'LR':
        d[f'LowerArm.{s}'] = [(X, 8 + 2 * b)]
    d['loc'] = hips_loc(ob, dz=0.004 * b)
    return d


def clip_walk(ob, t):  # 1 falcata (2 passi) per ciclo: coscia ±28° → passo ≈ 0,8 m
    ph = 2 * math.pi * t
    d = arms_rest()
    for s, off in (('L', 0.0), ('R', math.pi)):
        p = ph + off
        d[f'UpperLeg.{s}'] = [(X, 28 * math.sin(p))]
        d[f'LowerLeg.{s}'] = [(X, -(6 + 50 * max(0.0, math.cos(p)) ** 1.5))]
        d[f'Foot.{s}'] = [(X, 10 * math.sin(p + 0.6))]
        d[f'UpperArm.{s}'] += [(X, -26 * math.sin(p))]
        d[f'LowerArm.{s}'] = [(X, 14 + 12 * max(0.0, -math.sin(p)))]
    d['Hips'] = [(Z, 6 * math.sin(ph))]
    d['Spine'] = [(Z, -9 * math.sin(ph)), (X, -4)]
    d['Head'] = [(Z, 4 * math.sin(ph)), (X, 2)]
    d['loc'] = hips_loc(ob, dz=-0.035 * abs(math.sin(ph)) + 0.022)
    return d


def clip_run(ob, t):  # 1 falcata per ciclo, fase di volo
    ph = 2 * math.pi * t
    d = arms_rest(4)
    for s, off in (('L', 0.0), ('R', math.pi)):
        p = ph + off
        d[f'UpperLeg.{s}'] = [(X, 12 + 40 * math.sin(p))]
        d[f'LowerLeg.{s}'] = [(X, -(18 + 80 * max(0.0, math.cos(p)) ** 1.2))]
        d[f'Foot.{s}'] = [(X, 18 * math.sin(p + 0.8))]
        d[f'UpperArm.{s}'] += [(X, -42 * math.sin(p))]
        d[f'LowerArm.{s}'] = [(X, 75 + 12 * math.sin(p))]
    d['Hips'] = [(Z, 8 * math.sin(ph))]
    d['Spine'] = [(X, -12), (Z, -12 * math.sin(ph))]
    d['Head'] = [(X, 8)]
    d['loc'] = hips_loc(ob, dz=0.08 * abs(math.cos(ph)) - 0.06)
    return d


SIT_HIP = 0.42  # altezza del bacino da seduti (= SIT_HIP del client)
THIGH = 97.4    # coscia appena in salita: ginocchio a 0,46 → stinco verticale → piede a terra


def seated(ob, lean=0.0):
    d = {}
    for s in 'LR':
        d[f'UpperLeg.{s}'] = [(X, THIGH), (Y, 5 * S[s])]
        d[f'LowerLeg.{s}'] = [(X, -THIGH)]
    d['Spine'] = [(X, lean)]
    d['loc'] = hips_loc(ob, dz=SIT_HIP - BONES['Hips'][0][1])
    return d


def clip_sit(ob, t):
    b = math.sin(2 * math.pi * t)
    d = seated(ob, -2 + 1.0 * b)
    for s in 'LR':
        d[f'UpperArm.{s}'] = [(Y, 10 * S[s]), (X, 28)]
        d[f'LowerArm.{s}'] = [(X, 42)]
    d['Head'] = [(X, 1.0 * b)]
    return d


def clip_row(ob, t):
    ph = 2 * math.pi * t
    c = math.cos(ph)  # 1 = braccia avanti (attacco), −1 = tirata finita
    d = seated(ob, 12 * c - 4)
    for s in 'LR':
        d[f'UpperArm.{s}'] = [(Y, 14 * S[s]), (X, 40 + 32 * c)]
        d[f'LowerArm.{s}'] = [(X, 25 + 55 * (1 - c) / 2)]
    d['Head'] = [(X, -6 * c)]
    return d


# nome: (funzione, fotogrammi a 30 fps; pari perché le chiavi sono ogni 2)
CLIPS = {'idle': (clip_idle, 60), 'walk': (clip_walk, 16), 'run': (clip_run, 16), 'sit': (clip_sit, 60), 'row': (clip_row, 42)}


def make_clips(ob):
    sc = bpy.context.scene
    sc.render.fps, sc.render.fps_base = FPS, 1.0  # il default di Blender è 24: le durate uscirebbero ×1,25
    ob.animation_data_create()
    for name, (fn, n) in CLIPS.items():
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        ob.animation_data.action = act
        for f in range(0, n + 1, 2):
            pose(ob, f, fn(ob, f / n))  # anelli perfetti: ultimo fotogramma = primo
        for fc in _fcurves(act):
            for kp in fc.keyframe_points:
                kp.interpolation = 'LINEAR'
    ob.animation_data.action = None
    for pb in ob.pose.bones:
        pb.rotation_quaternion = Quaternion(); pb.location = Vector()


def _fcurves(act):
    try:
        return list(act.fcurves)
    except AttributeError:  # azioni a strati (Blender 4.4+)
        out = []
        for layer in act.layers:
            for strip in layer.strips:
                for cb in strip.channelbags:
                    out += list(cb.fcurves)
        return out


# ---------------------------------------------------------------- look per le anteprime (solo Blender: il glb esce già esportato)
HAT_COLOR = {'paglia': '#E2B97F', 'berretto': '#2478A8', 'pescatore': '#B9AFA3', 'lanterna': '#E8433F', 'neon': '#FF3DA6'}  # come avatar.ts
DEFAULT_LOOK = {'pelle': '#D9A070', 'capelli': 1, 'coloreCapelli': '#5A3A1E', 'vestito': '#F4E3C1', 'cappello': 'nessuno'}  # = sheet #283
VARIANTS = [  # i tre look dello sheet (#283): capelli neri a punte e rosso, coda rossa e giallo, biondo corto
    {'nome': 'A', 'pelle': '#D9A070', 'capelli': 1, 'coloreCapelli': '#2E1E14', 'vestito': '#E8433F', 'cappello': 'nessuno'},
    {'nome': 'B', 'pelle': '#EFC29B', 'capelli': 2, 'coloreCapelli': '#8E5A2B', 'vestito': '#F2A33A', 'cappello': 'nessuno'},
    {'nome': 'C', 'pelle': '#D9A070', 'capelli': 0, 'coloreCapelli': '#C98A4B', 'vestito': '#3FB9C9', 'cappello': 'paglia'},
]
# catalogo dei pezzi (primi piani): 8 capelli senza cappello, poi 5 cappelli
CATALOG = ([{'nome': f'{i} {h}', 'pelle': '#EFC29B', 'capelli': i, 'coloreCapelli': '#5A3A1E', 'vestito': '#8FC35B', 'cappello': 'nessuno'} for i, h in enumerate(HAIR)]
           + [{'nome': h, 'pelle': '#B8784C', 'capelli': 0, 'coloreCapelli': '#2E1E14', 'vestito': '#E8433F', 'cappello': h} for h in HATS])


def _lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)


def _tint(mat, hexcol):
    nt = mat.node_tree
    mix = next((n for n in nt.nodes if n.name == 'tinta'), None)
    if not mix:
        tex = next(n for n in nt.nodes if n.type == 'TEX_IMAGE')
        bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        mix = nt.nodes.new('ShaderNodeMix'); mix.name = 'tinta'
        mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
        mix.inputs[0].default_value = 1.0
        a = [s for s in mix.inputs if s.type == 'RGBA'][0]
        nt.links.new(tex.outputs['Color'], a)
        nt.links.new([s for s in mix.outputs if s.type == 'RGBA'][0], bsdf.inputs['Base Color'])
    [s for s in mix.inputs if s.type == 'RGBA'][1].default_value = _lin(hexcol)


def apply_look(objs, look):
    """Mostra i pezzi scelti e tinge i materiali come fa il client. Ritorna gli oggetti visibili."""
    vis = []
    for ob in objs:
        if ob.type != 'MESH':
            continue
        show = True
        if ob.name.startswith('capelli_'):
            show = ob.name == f"capelli_{look['capelli']}"
        elif ob.name.startswith('cappello_'):
            show = ob.name == f"cappello_{look['cappello']}"
        ob.hide_render = ob.hide_viewport = not show
        if show:
            vis.append(ob)
    tints = {'mat_pelle': look['pelle'], 'mat_capelli': look['coloreCapelli'], 'mat_vestito': look['vestito'],
             'mat_cappello': HAT_COLOR.get(look['cappello'], '#E2B97F')}
    for name, col in tints.items():
        if name in bpy.data.materials:
            _tint(bpy.data.materials[name], col)
    return vis


def chr_base():
    body = build_body().build()
    parts = [hair_piece(i).build() for i in range(len(HAIR))] + [hat_piece(h).build() for h in HATS]
    rig = build_rig([body] + parts)
    make_clips(rig)
    tri = lambda ob: sum(len(p.vertices) - 2 for p in ob.data.polygons)
    return [rig, body] + parts, {
        'clips': list(CLIPS), 'durate': {k: round(n / FPS, 3) for k, (_f, n) in CLIPS.items()},
        'preview': {'walk': 4, 'run': 4, 'sit': 0, 'row': 10},
        'tri_pezzi': {ob.name: tri(ob) for ob in [body] + parts},
        'look_fn': apply_look, 'look': DEFAULT_LOOK, 'variants': VARIANTS, 'catalog': CATALOG,
    }


MODELS = {'chr_base': chr_base}
