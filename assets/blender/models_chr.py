# Personaggio base: umano a 6 teste, 1,6 m, stile PS1 / FF IX. Davanti −Z. Un'unica mesh skinnata con 5 materiali:
# mat_pelle, mat_capelli, mat_vestito (maschere bianche tinte dal client), mat_cappello (paglia), mat_atlas (pantaloni, scarpe, cintura).
# Armatura semplice con pesi rigidi per segmento e pesi misti 50/50 sugli anelli di giuntura (gomiti, ginocchia, vita, collo).
# Animazioni procedurali: idle (respiro, 2 s), walk (1 s), run (1 s = 2 falcate), sit (seduto in barca), row (remata, 1 s).
import math
import bpy
from mathutils import Matrix, Quaternion, Vector
from lib import Mesh, key, to_blender

FPS = 30

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


def build_mesh():
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
    # --- collo e testa (viso dipinto, proiezione frontale)
    m.mat, m.bone = 'mat_pelle', 'Head'
    N = [ell(m, 6, 0.045, 1.26, 0.042), ell(m, 6, 0.042, 1.3, 0.04), ell(m, 6, 0.04, 1.37, 0.04, cz=0.01)]
    m.loft(N, 'pelle')
    weigh(m, N[0], [('Spine', 1.0)]); weigh(m, N[1], J('Spine', 'Head'))
    hb = dict(uv='head', bbox=(-0.1, 1.335, 0.1, 1.6), alt='pelle')
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
    # --- capelli corti: calotta che scende dietro, attaccatura alta sulla fronte
    m.mat = 'mat_capelli'
    def hair_ring(r, rz, y_front, y_back, n=8, cz=0.0):
        pts = []
        for i in range(n):
            a = math.pi / n + 2 * math.pi * i / n
            f = (-math.sin(a) + 1) / 2  # 1 davanti, 0 dietro
            pts.append((math.cos(a) * r, y_back + (y_front - y_back) * f, cz + math.sin(a) * rz))
        return pts
    Hr = [hair_ring(0.103, 0.114, 1.505, 1.36), hair_ring(0.108, 0.118, 1.535, 1.46), hair_ring(0.09, 0.1, 1.585, 1.56), hair_ring(0.05, 0.058, 1.625, 1.615)]
    m.loft(Hr, 'capelli', bottom='capelli')
    htop = (0.0, 1.635, 0.005)
    for i in range(8):
        j = (i + 1) % 8
        m.poly([Hr[-1][j], Hr[-1][i], htop], 'capelli')
    # ciuffo sulla fronte
    m.poly([(-0.07, 1.54, -0.1), (0.02, 1.54, -0.11), (-0.02, 1.49, -0.112)], 'capelli')
    m.poly([(-0.02, 1.54, -0.11), (0.07, 1.545, -0.1), (0.04, 1.5, -0.11)], 'capelli')
    # --- cappello di paglia a cono (kasa): sopra e sotto
    m.mat = 'mat_cappello'
    m.cone(10, 0.26, 1.57, 1.73, 'cappello_paglia', a0=0.0)
    base = m.ring(10, 0.26, 1.57, a0=0.0)
    inner = (0.0, 1.66, 0.0)
    for i in range(10):
        j = (i + 1) % 10
        m.poly([base[i], base[j], inner], 'cappello_paglia')  # sottotesa
    m.prism(10, 0.264, 0.264, 1.555, 1.572, 'cintura', a0=0.0)  # bordino
    return m


def build_rig(mesh_ob):
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
    mesh_ob.parent = ob
    mod = mesh_ob.modifiers.new('Armature', 'ARMATURE'); mod.object = ob
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


def clip_walk(ob, t):
    ph = 2 * math.pi * t
    d = arms_rest()
    for s, off in (('L', 0.0), ('R', math.pi)):
        p = ph + off
        d[f'UpperLeg.{s}'] = [(X, 26 * math.sin(p))]
        d[f'LowerLeg.{s}'] = [(X, -(6 + 48 * max(0.0, math.cos(p)) ** 1.5))]
        d[f'Foot.{s}'] = [(X, 10 * math.sin(p + 0.6))]
        d[f'UpperArm.{s}'] += [(X, -24 * math.sin(p))]
        d[f'LowerArm.{s}'] = [(X, 14 + 10 * max(0.0, -math.sin(p)))]
    d['Hips'] = [(Z, 6 * math.sin(ph))]
    d['Spine'] = [(Z, -9 * math.sin(ph)), (X, -3)]
    d['Head'] = [(Z, 4 * math.sin(ph))]
    d['loc'] = hips_loc(ob, dz=-0.035 * abs(math.sin(ph)) + 0.01)
    return d


def clip_run(ob, t):
    ph = 4 * math.pi * t  # 2 falcate al secondo: loop di 1 s
    d = arms_rest(4)
    for s, off in (('L', 0.0), ('R', math.pi)):
        p = ph + off
        d[f'UpperLeg.{s}'] = [(X, 12 + 40 * math.sin(p))]
        d[f'LowerLeg.{s}'] = [(X, -(18 + 80 * max(0.0, math.cos(p)) ** 1.2))]
        d[f'Foot.{s}'] = [(X, 18 * math.sin(p + 0.8))]
        d[f'UpperArm.{s}'] += [(X, -42 * math.sin(p))]
        d[f'LowerArm.{s}'] = [(X, 75 + 12 * math.sin(p))]
    d['Hips'] = [(Z, 8 * math.sin(ph)), (X, 0)]
    d['Spine'] = [(X, -12), (Z, -12 * math.sin(ph))]
    d['Head'] = [(X, 8)]
    d['loc'] = hips_loc(ob, dz=0.05 * abs(math.cos(ph)) - 0.06)
    return d


SEAT_DROP = -0.76  # bacino da 0,86 a ~0,10: il sedere sta all'origine → origine dell'avatar sul nodo `sedile` della barca


def seated(ob, lean=0.0):
    d = {}
    for s in 'LR':
        d[f'UpperLeg.{s}'] = [(X, 86), (Y, 6 * S[s])]
        d[f'LowerLeg.{s}'] = [(X, -84)]
        d[f'Foot.{s}'] = [(X, 4)]
    d['Spine'] = [(X, lean)]
    d['loc'] = hips_loc(ob, dz=SEAT_DROP)
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
    d = seated(ob, -10 * c)
    for s in 'LR':
        d[f'UpperArm.{s}'] = [(Y, 14 * S[s]), (X, 38 + 30 * c)]
        d[f'LowerArm.{s}'] = [(X, 30 + 45 * (1 - c) / 2)]
    d['Head'] = [(X, 8 * c)]
    return d


CLIPS = {'idle': (clip_idle, 2.0), 'walk': (clip_walk, 1.0), 'run': (clip_run, 1.0), 'sit': (clip_sit, 2.0), 'row': (clip_row, 1.0)}


def make_clips(ob):
    ob.animation_data_create()
    for name, (fn, secs) in CLIPS.items():
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        ob.animation_data.action = act
        n = int(round(secs * FPS))
        for f in range(0, n + 1, 2):
            pose(ob, f, fn(ob, f / n))
        # anelli perfetti: ultimo fotogramma = primo
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


def chr_base():
    m = build_mesh()
    mesh_ob = m.build()
    rig = build_rig(mesh_ob)
    make_clips(rig)
    return [rig, mesh_ob], {'clips': list(CLIPS), 'preview': {'walk': 8, 'run': 4, 'sit': 0, 'row': 16},
                            'sedile': 'origine = sedere in sit/row'}


MODELS = {'chr_base': chr_base}
