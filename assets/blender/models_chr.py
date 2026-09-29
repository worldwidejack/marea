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


# ---------------------------------------------------------------- corpo
def build_body():
    m = Mesh('chr_base')
    J = lambda a, b: [(a, 0.5), (b, 0.5)]

    # --- busto (vestito): fianchi → vita → petto → spalle → base del collo
    m.mat, m.bone = 'mat_vestito', 'Spine'
    R = [ell(m, 8, 0.155, 0.9, 0.1), ell(m, 8, 0.14, 1.0, 0.095, cz=0.005), ell(m, 8, 0.165, 1.1, 0.108, cz=-0.01),
         ell(m, 8, 0.185, 1.2, 0.1, cz=0.0), ell(m, 8, 0.15, 1.265, 0.085), ell(m, 8, 0.055, 1.3, 0.05)]
    m.loft(R, 'vestito')
    weigh(m, R[0], [('Hips', 1.0)]); weigh(m, R[1], J('Hips', 'Spine'))
    # --- bacino e cintura (pantaloni, colore fisso)
    m.mat, m.bone = 'mat_atlas', 'Hips'
    P = [ell(m, 8, 0.12, 0.74, 0.08), ell(m, 8, 0.165, 0.8, 0.1), ell(m, 8, 0.158, 0.88, 0.1)]
    m.loft(P, 'pantaloni', bottom='pantaloni')
    B = [ell(m, 8, 0.16, 0.875, 0.103), ell(m, 8, 0.16, 0.925, 0.103)]
    m.loft(B, 'cintura')
    # --- gambe (pantaloni fino alla caviglia) e scarpe
    for s, side in ((-1, 'L'), (1, 'R')):
        x = 0.09 * s
        m.bone = f'UpperLeg.{side}'
        L = [ell(m, 7, 0.045, 0.1, 0.045, cx=x, cz=0.005), ell(m, 7, 0.058, 0.3, 0.06, cx=x, cz=0.012), ell(m, 7, 0.058, 0.46, 0.058, cx=x),
             ell(m, 7, 0.078, 0.66, 0.078, cx=x), ell(m, 7, 0.088, 0.82, 0.085, cx=x)]
        m.loft(L, 'pantaloni')
        weigh(m, L[0], [(f'LowerLeg.{side}', 1.0)]); weigh(m, L[1], [(f'LowerLeg.{side}', 1.0)]); weigh(m, L[2], J(f'UpperLeg.{side}', f'LowerLeg.{side}'))
        m.bone = f'Foot.{side}'
        m.box(x - 0.048, 0.0, -0.16, x + 0.048, 0.07, 0.055, 'scarpe', skip=('bottom',))
        m.box(x - 0.04, 0.07, -0.05, x + 0.04, 0.11, 0.05, 'scarpe', skip=('bottom',))
    # --- braccia: manica corta (vestito), braccio e mano (pelle)
    for s, side in ((-1, 'L'), (1, 'R')):
        ua, la = f'UpperArm.{side}', f'LowerArm.{side}'
        m.mat, m.bone = 'mat_vestito', ua
        S = [ell(m, 7, 0.062, 1.08, 0.06, cx=0.208 * s), ell(m, 7, 0.064, 1.2, 0.062, cx=0.198 * s), ell(m, 7, 0.045, 1.28, 0.05, cx=0.18 * s)]
        m.loft(S, 'vestito', bottom='vestito')
        m.mat = 'mat_pelle'
        A = [ell(m, 6, 0.03, 0.72, 0.028, cx=0.226 * s), ell(m, 6, 0.036, 0.82, 0.034, cx=0.222 * s), ell(m, 6, 0.04, 0.965, 0.04, cx=0.215 * s),
             ell(m, 6, 0.046, 1.1, 0.046, cx=0.207 * s)]
        m.loft(A, 'pelle')
        for r in A[:2]:
            weigh(m, r, [(la, 1.0)])
        weigh(m, A[2], J(ua, la))
        m.bone = la
        H = [ell(m, 6, 0.024, 0.6, 0.014, cx=0.232 * s), ell(m, 6, 0.036, 0.66, 0.02, cx=0.23 * s), ell(m, 6, 0.03, 0.72, 0.024, cx=0.226 * s)]
        m.loft(H, 'mano', bottom='mano')
        m.box(0.226 * s - 0.012, 0.64, -0.045, 0.226 * s + 0.012, 0.69, -0.018, 'mano', skip=('top',))  # pollice
    # --- collo e testa (viso dipinto: proiezione frontale su 0,22 × 0,28 m = regione `testa` 14×18 → 64 texel/m)
    m.mat, m.bone = 'mat_pelle', 'Head'
    N = [ell(m, 6, 0.045, 1.26, 0.042), ell(m, 6, 0.042, 1.3, 0.04), ell(m, 6, 0.04, 1.37, 0.04, cz=0.01)]
    m.loft(N, 'pelle')
    weigh(m, N[0], [('Spine', 1.0)]); weigh(m, N[1], J('Spine', 'Head'))
    hb = dict(uv='head', bbox=(-0.11, 1.32, 0.11, 1.6), alt='pelle')
    Hd = [ell(m, 8, 0.05, 1.335, 0.05, cz=-0.03), ell(m, 8, 0.082, 1.37, 0.088, cz=-0.005), ell(m, 8, 0.097, 1.43, 0.105),
          ell(m, 8, 0.1, 1.475, 0.11), ell(m, 8, 0.097, 1.52, 0.11), ell(m, 8, 0.075, 1.575, 0.088)]
    m.loft(Hd, 'testa', bottom='pelle', **hb)
    top = (0.0, 1.605, 0.005)
    for i in range(8):
        j = (i + 1) % 8
        m.poly([Hd[-1][j], Hd[-1][i], top], 'pelle')
    # orecchie
    for s in (-1, 1):
        m.box(s * 0.1 - 0.012, 1.44, -0.0, s * 0.1 + 0.012, 1.5, 0.035, 'pelle', skip=())
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
    elif style == 'spettinati':  # frangia a zig-zag e ciuffi dritti in cima
        R = [hring(0.108, 0.119, (1.5, 1.37), jag=0.022), hring(0.113, 0.123, (1.55, 1.48)), hring(0.095, 0.105, (1.6, 1.575)),
             hring(0.05, 0.058, (1.635, 1.628))]
        shell(m, R, (0.0, 1.645, 0.005))
        for k in (7, 0, 1, 2, 3):  # lati e dietro (davanti c'è la frangia a zig-zag)
            a, b = R[2][k], R[2][(k + 1) % 8]
            mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
            fin(m, a, b, (mid[0] * 1.2, mid[1] + 0.05, mid[2] * 1.2 + 0.02), 'capelli')
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
DEFAULT_LOOK = {'pelle': '#D9A070', 'capelli': 0, 'coloreCapelli': '#2E1E14', 'vestito': '#3FB9C9', 'cappello': 'paglia'}
VARIANTS = [
    {'nome': 'A', 'pelle': '#D9A070', 'capelli': 0, 'coloreCapelli': '#2E1E14', 'vestito': '#3FB9C9', 'cappello': 'paglia'},
    {'nome': 'B', 'pelle': '#FBE2C8', 'capelli': 2, 'coloreCapelli': '#E8433F', 'vestito': '#F2A33A', 'cappello': 'nessuno'},
    {'nome': 'C', 'pelle': '#8C5636', 'capelli': 5, 'coloreCapelli': '#2E1E14', 'vestito': '#A64DFF', 'cappello': 'pescatore'},
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
