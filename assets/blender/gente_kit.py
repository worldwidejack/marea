# MAREA — kit per i personaggi del Borgo (paesani, gente del Porto, bottegai): `npc_<id>.glb`.
# Diverso da lib.Mesh (atlas e UV): qui i colori stanno nei vertici (COLOR_0, un materiale solo = 1 draw call a persona) e le forme
# sono morbide (tubi su curve di Catmull-Rom, torniti, ellissoidi deformati), così le sagome reggono anche da vicino nei ritratti.
# Coordinate «di gioco» come lib: x destra, y su, −Z davanti, piedi a y = 0. Il lato .L delle ossa è x < 0 (come models_chr).
# Pesi: ogni pezzo dice quali ossa può seguire; il peso va per distanza dai segmenti delle ossa (giunture morbide da sole).
import math
import bpy, bmesh
from mathutils import Matrix, Vector, Euler
import models_chr
from lib import to_blender


def lin(h):
    """#RRGGBB → RGB lineare (Blender e glTF tengono i colori dei vertici lineari)."""
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def _add(a, b): return (a[0] + b[0], a[1] + b[1], a[2] + b[2])
def _sub(a, b): return (a[0] - b[0], a[1] - b[1], a[2] - b[2])
def _mul(a, k): return (a[0] * k, a[1] * k, a[2] * k)
def _dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def _cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
def _len(a): return math.sqrt(_dot(a, a))
def _nrm(a):
    l = _len(a) or 1.0
    return (a[0] / l, a[1] / l, a[2] / l)


def _cr(p0, p1, p2, p3, t):
    t2, t3 = t * t, t * t * t
    return tuple(0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3) for a, b, c, d in zip(p0, p1, p2, p3))


def spline(vals, res):
    """Catmull-Rom attraverso i punti (tuple di qualunque lunghezza), `res` passi per tratto."""
    vals = [tuple(v) if isinstance(v, (tuple, list)) else (v,) for v in vals]
    if res <= 1 or len(vals) < 3:
        out = []
        for a, b in zip(vals, vals[1:]):
            for k in range(max(1, res)):
                t = k / max(1, res)
                out.append(tuple(x + (y - x) * t for x, y in zip(a, b)))
        out.append(vals[-1])
        return out
    P = [tuple(2 * a - b for a, b in zip(vals[0], vals[1]))] + vals + [tuple(2 * a - b for a, b in zip(vals[-1], vals[-2]))]
    out = []
    for i in range(len(vals) - 1):
        for k in range(res):
            out.append(_cr(P[i], P[i + 1], P[i + 2], P[i + 3], k / res))
    out.append(vals[-1])
    return out


def bones_for(hip=0.82, chest=1.27, neck=1.31, top=1.62, sh=(0.2, 1.24), elbow=0.95, wrist=0.64, leg_x=0.09, knee=0.45, ankle=0.08,
              foot=0.13, arm_out=0.03, lean=0.0):
    """Scheletro coi nomi di sempre (CONTRACTS §9) sulle misure del personaggio. `lean` sposta collo e testa in avanti (gobba)."""
    sx, sy = sh
    return {
        'Hips': ((0, hip, 0), (0, hip + 0.12, 0), None),
        'Spine': ((0, hip + 0.12, 0), (0, chest, -lean * 0.5), 'Hips'),
        'Head': ((0, neck, -lean), (0, top, -lean), 'Spine'),
        'UpperArm.L': ((-sx, sy, -lean * 0.4), (-sx - arm_out * 0.5, elbow, -lean * 0.3), 'Spine'),
        'LowerArm.L': ((-sx - arm_out * 0.5, elbow, -lean * 0.3), (-sx - arm_out, wrist, -lean * 0.3 - 0.02), 'UpperArm.L'),
        'UpperArm.R': ((sx, sy, -lean * 0.4), (sx + arm_out * 0.5, elbow, -lean * 0.3), 'Spine'),
        'LowerArm.R': ((sx + arm_out * 0.5, elbow, -lean * 0.3), (sx + arm_out, wrist, -lean * 0.3 - 0.02), 'UpperArm.R'),
        'UpperLeg.L': ((-leg_x, hip - 0.02, 0), (-leg_x, knee, 0), 'Hips'),
        'LowerLeg.L': ((-leg_x, knee, 0), (-leg_x, ankle, 0), 'UpperLeg.L'),
        'Foot.L': ((-leg_x, ankle, 0), (-leg_x, 0.03, -foot), 'LowerLeg.L'),
        'UpperLeg.R': ((leg_x, hip - 0.02, 0), (leg_x, knee, 0), 'Hips'),
        'LowerLeg.R': ((leg_x, knee, 0), (leg_x, ankle, 0), 'UpperLeg.R'),
        'Foot.R': ((leg_x, ankle, 0), (leg_x, 0.03, -foot), 'LowerLeg.R'),
    }


# insiemi di ossa per i pezzi più comuni
TORSO = ['Hips', 'Spine']
NECK = ['Spine', 'Head']
def ARM(s): return ['Spine', f'UpperArm.{s}', f'LowerArm.{s}']
def LEG(s): return ['Hips', f'UpperLeg.{s}', f'LowerLeg.{s}']
def SKIRT(): return ['Hips', 'UpperLeg.L', 'UpperLeg.R']


def _seg_dist(p, a, b):
    ab = _sub(b, a)
    t = max(0.0, min(1.0, _dot(_sub(p, a), ab) / (_dot(ab, ab) or 1e-9)))
    return _len(_sub(p, _add(a, _mul(ab, t))))


class Fig:
    """Un personaggio: vertici, facce col loro colore, pesi."""

    def __init__(self, name, bones):
        self.name, self.B = name, bones
        self.V, self.W, self.F = [], [], []   # vertici (gioco), pesi per vertice, (indici, colore hex)
        self.xf = [Matrix.Identity(4)]

    # ---------------------------------------------------------------- trasformazioni annidate (in coordinate di gioco)
    def push(self, t=(0, 0, 0), r=(0, 0, 0), s=1.0, pivot=None):
        s = s if isinstance(s, (tuple, list)) else (s, s, s)
        m = Matrix.Translation(t) @ Euler([math.radians(a) for a in r], 'XYZ').to_matrix().to_4x4() @ Matrix.Diagonal((*s, 1.0))
        if pivot:
            m = Matrix.Translation(pivot) @ m @ Matrix.Translation([-c for c in pivot])
        self.xf.append(self.xf[-1] @ m)
        return self

    def pop(self):
        self.xf.pop()
        return self

    def _p(self, p):
        return tuple(self.xf[-1] @ Vector(p))

    def _w(self, p, b):
        if isinstance(b, str):
            return {b: 1.0}
        if callable(b):
            return b(p)
        if isinstance(b, dict):
            return dict(b)
        ds = {n: _seg_dist(p, self.B[n][0], self.B[n][1]) for n in b}
        w = {n: 1.0 / (d + 0.015) ** 6 for n, d in ds.items()}
        s = sum(w.values())
        w = sorted(((n, v / s) for n, v in w.items()), key=lambda kv: -kv[1])[:3]
        w = [(n, v) for n, v in w if v > 0.04]
        s = sum(v for _n, v in w)
        return {n: v / s for n, v in w}

    def _verts(self, pts, b):
        i0 = len(self.V)
        for p in pts:
            q = self._p(p)
            self.V.append(q)
            self.W.append(self._w(q, b))
        return i0

    def _faces(self, faces, i0, col, pts):
        for f in faces:
            c = col
            if callable(col):
                cen = tuple(sum(self.V[i0 + i][k] for i in f) / len(f) for k in range(3))
                c = col(cen)
            self.F.append((tuple(i0 + i for i in f), c))

    # ---------------------------------------------------------------- primitive
    def lathe(self, prof, col, b, n=12, c=(0, 0, 0), sx=1.0, sz=1.0, a0=None, sq=2.0, deform=None, caps=True):
        """Tornito chiuso: prof = [(r, y), ...] dal basso in alto; r = 0 al primo/ultimo punto = polo (sennò tappo piatto).
        `sq` > 2 = sezione più squadrata (superellisse). `deform(p)` riceve il punto locale (prima dello spostamento in c)."""
        a0 = math.pi / n if a0 is None else a0
        pts, rings = [], []
        for r, y in prof:
            if r <= 1e-6:
                rings.append([len(pts)]); pts.append((0.0, y, 0.0)); continue
            ring = []
            for i in range(n):
                a = a0 + 2 * math.pi * i / n
                ca, sa = math.cos(a), math.sin(a)
                e = 2.0 / sq
                x, z = math.copysign(abs(ca) ** e, ca) * r * sx, math.copysign(abs(sa) ** e, sa) * r * sz
                ring.append(len(pts)); pts.append((x, y, z))
            rings.append(ring)
        if deform:
            pts = [deform(p) for p in pts]
        pts = [_add(p, c) for p in pts]
        faces = []
        for A, B in zip(rings, rings[1:]):
            if len(A) == 1 and len(B) == 1:
                continue
            if len(A) == 1:
                faces += [(A[0], B[(i + 1) % n], B[i]) for i in range(n)]
            elif len(B) == 1:
                faces += [(A[i], A[(i + 1) % n], B[0]) for i in range(n)]
            else:
                faces += [(A[i], A[(i + 1) % n], B[(i + 1) % n], B[i]) for i in range(n)]
        if caps and len(rings[0]) > 1:
            faces.append(tuple(reversed(rings[0])))
        if caps and len(rings[-1]) > 1:
            faces.append(tuple(rings[-1]))
        i0 = self._verts(pts, b)
        self._faces(faces, i0, col, pts)
        return self

    def ell(self, c, r, col, b, n=12, m=7, deform=None, cut=None, sq=2.0):
        """Ellissoide di raggi r = (rx, ry, rz) centrato in c. `cut` = (ymin, ymax) in unità del raggio (−1..1) per tagliarlo."""
        lo, hi = cut or (-1.0, 1.0)
        if max(r) < 0.02:  # bottoni, occhi, lentiggini: a pixel grossi bastano poche facce
            n, m = min(n, 6), min(m, 3)
        a_lo, a_hi = math.asin(max(-1, min(1, lo))), math.asin(max(-1, min(1, hi)))
        prof = []
        for k in range(m + 1):
            a = a_lo + (a_hi - a_lo) * k / m
            rr = math.cos(a)
            prof.append((0.0 if (k == 0 and lo <= -1) or (k == m and hi >= 1) else rr, math.sin(a)))
        rx, ry, rz = r
        dd = (lambda p: deform((p[0] * rx, p[1] * ry, p[2] * rz))) if deform else (lambda p: (p[0] * rx, p[1] * ry, p[2] * rz))
        return self.lathe(prof, col, b, n=n, c=c, deform=dd, sq=sq)

    def tube(self, pts, rads, col, b, n=10, res=2, caps=('round', 'round'), sq=2.0, capk=1.0, a0=None, ref=None):
        """Tubo morbido lungo la curva pts (Catmull-Rom); rads = r o (r_lato, r_avanti/su) per punto; caps: 'round' | 'flat' | None."""
        rads = [r if isinstance(r, (tuple, list)) else (r, r) for r in rads]
        rmax = max(max(r) for r in rads)
        if rmax < 0.02:  # frange, lacci, baffi sottili, canne: punte piatte e poche facce (a pixel grossi non si vede)
            caps = tuple('flat' if c == 'round' else c for c in caps)
            n = min(n, 5 if rmax < 0.012 else 6)
        P = spline(pts, res)
        R = spline(rads, res)
        a0 = math.pi / n if a0 is None else a0
        verts, rings = [], []
        T = []
        for i in range(len(P)):
            a, c = P[max(0, i - 1)], P[min(len(P) - 1, i + 1)]
            T.append(_nrm(_sub(c, a)))

        def frame(t):
            rf = ref or (0, 0, -1)
            if abs(_dot(t, _nrm(rf))) > 0.9:
                rf = (0, 1, 0) if abs(t[1]) < 0.9 else (0, 0, -1)
            ax = _nrm(_cross(t, rf))
            bx = _nrm(_cross(ax, t))
            return ax, bx

        def ring_at(p, t, ra, rb):
            ax, bx = frame(t)
            out = []
            e = 2.0 / sq
            for k in range(n):
                ang = a0 + 2 * math.pi * k / n
                ca, sa = math.cos(ang), math.sin(ang)
                u, v = math.copysign(abs(ca) ** e, ca) * ra, math.copysign(abs(sa) ** e, sa) * rb
                out.append(_add(p, _add(_mul(ax, u), _mul(bx, v))))
            return out

        body = [ring_at(p, t, r[0], r[1]) for p, t, r in zip(P, T, R)]

        def dome(end, p, t, r, sign):
            kind = caps[end]
            if not kind:
                return [], None
            if kind == 'flat':
                return [], p
            extra = []
            rr = max(1e-4, (r[0] + r[1]) / 2) * capk
            for ph in (math.radians(40), math.radians(70)):
                extra.append(ring_at(_add(p, _mul(t, sign * rr * math.sin(ph))), t, r[0] * math.cos(ph), r[1] * math.cos(ph)))
            return extra, _add(p, _mul(t, sign * rr))

        e0, tip0 = dome(0, P[0], T[0], R[0], -1)
        e1, tip1 = dome(1, P[-1], T[-1], R[-1], 1)
        all_rings = list(reversed(e0)) + body + e1
        for rg in all_rings:
            rings.append(list(range(len(verts), len(verts) + n))); verts += rg
        faces = []
        for A, B in zip(rings, rings[1:]):
            faces += [(A[k], A[(k + 1) % n], B[(k + 1) % n], B[k]) for k in range(n)]
        if tip0 is not None:
            ti = len(verts); verts.append(tip0)
            A = rings[0]
            faces += [(A[(k + 1) % n], A[k], ti) for k in range(n)]
        if tip1 is not None:
            ti = len(verts); verts.append(tip1)
            A = rings[-1]
            faces += [(A[k], A[(k + 1) % n], ti) for k in range(n)]
        i0 = self._verts(verts, b)
        self._faces(faces, i0, col, verts)
        return self

    def box(self, c, s, col, b, r=(0, 0, 0)):
        """Parallelepipedo di lati s centrato in c, ruotato di r gradi."""
        hx, hy, hz = s[0] / 2, s[1] / 2, s[2] / 2
        pts = [(x, y, z) for x in (-hx, hx) for y in (-hy, hy) for z in (-hz, hz)]
        rot = Euler([math.radians(a) for a in r], 'XYZ').to_matrix()
        pts = [tuple(Vector(c) + rot @ Vector(p)) for p in pts]
        faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
        i0 = self._verts(pts, b)
        self._faces(faces, i0, col, pts)
        return self

    def mirror(self, fn):
        """fn(s, k): s = 'L' | 'R', k = −1 | +1 (segno di x). Comodo per i pezzi doppi."""
        fn('L', -1)
        fn('R', 1)

    # ---------------------------------------------------------------- uscita
    @property
    def tris(self):
        return sum(len(f) - 2 for f, _c in self.F)

    def build(self):
        me = bpy.data.meshes.new(self.name)
        me.from_pydata([to_blender(p) for p in self.V], [], [f for f, _c in self.F])
        me.update()
        bm = bmesh.new(); bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        bm.to_mesh(me); bm.free()
        ca = me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
        cache = {}
        for poly, (_f, c) in zip(me.polygons, self.F):
            rgb = cache.setdefault(c, lin(c) + (1.0,))
            for li in poly.loop_indices:
                ca.data[li].color = rgb
        me.color_attributes.active_color = ca
        try:
            me.color_attributes.render_color_index = 0
        except Exception:
            pass
        for poly in me.polygons:
            poly.use_smooth = True  # normali condivise: il client disegna comunque a facce piatte (flatShading), il file pesa la metà
        ob = bpy.data.objects.new(self.name, me)
        bpy.context.scene.collection.objects.link(ob)
        mat = bpy.data.materials.new('mat_' + self.name)
        mat.use_nodes = True
        nt = mat.node_tree
        bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'
        nt.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
        bsdf.inputs['Roughness'].default_value = 1.0
        me.materials.append(mat)
        groups = {}
        for i, w in enumerate(self.W):
            for bn, v in w.items():
                g = groups.get(bn) or groups.setdefault(bn, ob.vertex_groups.new(name=bn))
                g.add([i], v, 'REPLACE')
        return ob


def build_rig(name, bones, mesh_obs):
    arm = bpy.data.armatures.new(name + '_rig')
    ob = bpy.data.objects.new(name + '_rig', arm)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.update()
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for bn, (h, t, parent) in bones.items():
        eb = arm.edit_bones.new(bn)
        eb.head, eb.tail = to_blender(h), to_blender(t)
        eb.roll = 0.0
        if parent:
            eb.parent = arm.edit_bones[parent]
            eb.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    for mo in mesh_obs:
        mo.parent = ob
        mod = mo.modifiers.new('Armature', 'ARMATURE'); mod.object = ob
    return ob


# ---------------------------------------------------------------- clip con carattere
X, Y, Z = models_chr.X, models_chr.Y, models_chr.Z
S = models_chr.S


def _merge(d, extra):
    for k, v in extra.items():
        if k == 'loc':
            d['loc'] = v
        else:
            d[k] = d.get(k, []) + list(v)
    return d


def make_clips(ob, bones, st):
    """Clip idle walk run sit row con lo stile del personaggio. st (tutto facoltativo):
    posa(t, moto) → dict extra sopra ogni clip (braccia che tengono qualcosa: moto = 0 fermo, 1 cammina, 2 corre);
    idle(t) → dict del gesto da fermo; passo (ampiezza coscia), braccia (oscillazione), molla (rimbalzo del bacino), curvo (gradi di
    schiena in avanti), ferme = ossa del braccio da non far oscillare."""
    hip = bones['Hips'][0][1]
    hl = lambda dz=0.0: models_chr.hips_loc(ob, dz=dz)
    passo, braccia, molla, curvo = st.get('passo', 26), st.get('braccia', 24), st.get('molla', 1.0), st.get('curvo', 0.0)
    ferme = set(st.get('ferme', ()))
    posa = st.get('posa', lambda t, moto: {})
    ap = st.get('aperte', 7)

    def arms_rest(extra=0.0):
        return {f'UpperArm.{s}': [(Y, (ap + extra) * S[s])] for s in 'LR' if f'UpperArm.{s}' not in ferme}

    def idle(t):
        b = math.sin(2 * math.pi * t)
        d = arms_rest(1.5 * b)
        d['Spine'] = [(X, -1.2 * b - curvo)]
        d['Head'] = [(X, 1.0 * b + curvo * 0.6), (Z, 3 * math.sin(math.pi * t))]
        for s in 'LR':
            if f'LowerArm.{s}' not in ferme:
                d[f'LowerArm.{s}'] = [(X, 8 + 2 * b)]
        d['loc'] = hl(0.004 * b)
        if 'idle' in st:
            d = _merge(d, st['idle'](t))
        return _merge(d, posa(t, 0))

    def walk(t):
        ph = 2 * math.pi * t
        d = arms_rest()
        for s, off in (('L', 0.0), ('R', math.pi)):
            p = ph + off
            d[f'UpperLeg.{s}'] = [(X, passo * math.sin(p))]
            d[f'LowerLeg.{s}'] = [(X, -(6 + 50 * (passo / 28) * max(0.0, math.cos(p)) ** 1.5))]
            d[f'Foot.{s}'] = [(X, 10 * math.sin(p + 0.6))]
            if f'UpperArm.{s}' not in ferme:
                d[f'UpperArm.{s}'] = d.get(f'UpperArm.{s}', []) + [(X, -braccia * math.sin(p))]
            if f'LowerArm.{s}' not in ferme:
                d[f'LowerArm.{s}'] = [(X, 14 + 12 * max(0.0, -math.sin(p)))]
        d['Hips'] = [(Z, 6 * math.sin(ph))]
        d['Spine'] = [(Z, -9 * math.sin(ph)), (X, -4 - curvo)]
        d['Head'] = [(Z, 4 * math.sin(ph)), (X, 2 + curvo * 0.6)]
        d['loc'] = hl((-0.035 * abs(math.sin(ph)) + 0.022) * molla)
        if 'walk' in st:
            d = _merge(d, st['walk'](t))
        return _merge(d, posa(t, 1))

    def run(t):
        ph = 2 * math.pi * t
        d = arms_rest(4)
        for s, off in (('L', 0.0), ('R', math.pi)):
            p = ph + off
            d[f'UpperLeg.{s}'] = [(X, 12 + 40 * math.sin(p))]
            d[f'LowerLeg.{s}'] = [(X, -(18 + 80 * max(0.0, math.cos(p)) ** 1.2))]
            d[f'Foot.{s}'] = [(X, 18 * math.sin(p + 0.8))]
            if f'UpperArm.{s}' not in ferme:
                d[f'UpperArm.{s}'] = d.get(f'UpperArm.{s}', []) + [(X, -42 * math.sin(p))]
            if f'LowerArm.{s}' not in ferme:
                d[f'LowerArm.{s}'] = [(X, 75 + 12 * math.sin(p))]
        d['Hips'] = [(Z, 8 * math.sin(ph))]
        d['Spine'] = [(X, -12 - curvo), (Z, -12 * math.sin(ph))]
        d['Head'] = [(X, 8)]
        d['loc'] = hl(0.08 * abs(math.cos(ph)) - 0.06)
        return _merge(d, posa(t, 2))

    knee = bones['UpperLeg.L'][1][1]
    thigh = math.degrees(math.acos(max(-1, min(1, (models_chr.SIT_HIP - knee) / max(0.05, hip - knee))))) if hip > models_chr.SIT_HIP else 90

    def seated(lean=0.0):
        d = {}
        for s in 'LR':
            d[f'UpperLeg.{s}'] = [(X, 90 + 7.4), (Y, 5 * S[s])]
            d[f'LowerLeg.{s}'] = [(X, -97.4)]
        d['Spine'] = [(X, lean)]
        d['loc'] = hl(models_chr.SIT_HIP - hip)
        return d

    def sit(t):
        b = math.sin(2 * math.pi * t)
        d = seated(-2 + 1.0 * b)
        for s in 'LR':
            d[f'UpperArm.{s}'] = [(Y, 10 * S[s]), (X, 28)]
            d[f'LowerArm.{s}'] = [(X, 42)]
        d['Head'] = [(X, 1.0 * b)]
        return d

    def row(t):
        c = math.cos(2 * math.pi * t)
        d = seated(12 * c - 4)
        for s in 'LR':
            d[f'UpperArm.{s}'] = [(Y, 14 * S[s]), (X, 40 + 32 * c)]
            d[f'LowerArm.{s}'] = [(X, 25 + 55 * (1 - c) / 2)]
        d['Head'] = [(X, -6 * c)]
        return d

    clips = {'idle': (idle, st.get('idle_n', 90)), 'walk': (walk, 16), 'run': (run, 16), 'sit': (sit, 60), 'row': (row, 42)}
    sc = bpy.context.scene
    sc.render.fps, sc.render.fps_base = models_chr.FPS, 1.0
    ob.animation_data_create()
    for cname, (fn, nfr) in clips.items():
        act = bpy.data.actions.new(cname)
        act.use_fake_user = True
        ob.animation_data.action = act
        for f in range(0, nfr + 1, 2):
            models_chr.pose(ob, f, fn(f / nfr))
        for fc in models_chr._fcurves(act):
            for kp in fc.keyframe_points:
                kp.interpolation = 'LINEAR'
    ob.animation_data.action = None
    for pb in ob.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
    return {k: round(n / models_chr.FPS, 3) for k, (_f, n) in clips.items()}
