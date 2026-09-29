# MAREA — libreria bpy per modelli low-poly procedurali sull'atlas unico.
# Coordinate «di gioco»: x destra, y su, z verso la camera; il davanti è −Z (ART_BIBLE §4). La conversione verso
# Blender (Z su) avviene solo in to_blender(): l'esportatore glTF con export_yup la riporta identica.
import math, os
import bpy
import atlas

TPM = atlas.TPM
ATLAS_PNG = None  # impostato da build_all.py


def key(p):
    return (round(p[0], 4), round(p[1], 4), round(p[2], 4))


def to_blender(p):
    return (p[0], -p[2], p[1])


def _sub(a, b): return (a[0] - b[0], a[1] - b[1], a[2] - b[2])
def _dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def _cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
def _norm(a):
    l = math.sqrt(_dot(a, a)) or 1.0
    return (a[0] / l, a[1] / l, a[2] / l)


def newell(poly):
    n = [0.0, 0.0, 0.0]
    for i, a in enumerate(poly):
        b = poly[(i + 1) % len(poly)]
        n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1])
    return _norm(n)


class Xf:
    """Trasformazione affine semplice: scala, rotazioni (rx, ry, rz in gradi, ordine X→Y→Z), traslazione."""
    def __init__(self, t=(0, 0, 0), r=(0, 0, 0), s=(1, 1, 1)):
        self.t, self.r, self.s = t, r, (s if isinstance(s, (tuple, list)) else (s, s, s))

    def __call__(self, p):
        x, y, z = p[0] * self.s[0], p[1] * self.s[1], p[2] * self.s[2]
        rx, ry, rz = (math.radians(a) for a in self.r)
        y, z = y * math.cos(rx) - z * math.sin(rx), y * math.sin(rx) + z * math.cos(rx)
        x, z = x * math.cos(ry) + z * math.sin(ry), -x * math.sin(ry) + z * math.cos(ry)
        x, y = x * math.cos(rz) - y * math.sin(rz), x * math.sin(rz) + y * math.cos(rz)
        return (x + self.t[0], y + self.t[1], z + self.t[2])


class Mesh:
    def __init__(self, name):
        self.name = name
        self.polys = []  # (points, region, mat, uvmode, opts, bone)
        self.stack = []
        self.mat = 'mat_atlas'
        self.bone = None
        self.wmap = {}  # punto (arrotondato) -> [(osso, peso)] per pesi misti sulle giunture

    # --- trasformazioni annidate
    def push(self, xf):
        self.stack.append(xf); return self

    def pop(self):
        self.stack.pop(); return self

    def _x(self, p):
        for xf in reversed(self.stack):
            p = xf(p)
        return p

    @property
    def tris(self):
        return sum(len(p[0]) - 2 for p in self.polys)

    # --- primitive
    def poly(self, pts, region, mat=None, uv='planar', **o):
        self.polys.append(([self._x(p) for p in pts], region, mat or self.mat, uv, o, self.bone))

    def box(self, x0, y0, z0, x1, y1, z1, side, top=None, bottom=None, mat=None, skip=(), **o):
        """Parallelepipedo. skip: facce da omettere tra 'top','bottom','front'(−Z),'back','left','right'."""
        top = top or side
        v = lambda x, y, z: (x, y, z)
        F = {
            'top': ([v(x0, y1, z1), v(x1, y1, z1), v(x1, y1, z0), v(x0, y1, z0)], top),
            'bottom': ([v(x0, y0, z0), v(x1, y0, z0), v(x1, y0, z1), v(x0, y0, z1)], bottom),
            'front': ([v(x1, y0, z0), v(x0, y0, z0), v(x0, y1, z0), v(x1, y1, z0)], side),
            'back': ([v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1)], side),
            'left': ([v(x0, y0, z0), v(x0, y0, z1), v(x0, y1, z1), v(x0, y1, z0)], side),
            'right': ([v(x1, y0, z1), v(x1, y0, z0), v(x1, y1, z0), v(x1, y1, z1)], side),
        }
        for k, (pts, reg) in F.items():
            if k in skip or reg is None:
                continue
            self.poly(pts, reg, mat, **o)

    def cbox(self, cx, cz, w, d, y0, y1, side, top=None, bottom=None, **o):
        self.box(cx - w / 2, y0, cz - d / 2, cx + w / 2, y1, cz + d / 2, side, top, bottom, **o)

    def ring(self, n, r, y, rz=None, a0=0.0, cx=0.0, cz=0.0):
        rz = r if rz is None else rz
        return [(cx + math.cos(a0 + 2 * math.pi * i / n) * r, y, cz + math.sin(a0 + 2 * math.pi * i / n) * rz) for i in range(n)]

    def loft(self, rings, side, top=None, bottom=None, mat=None, **o):
        """Anelli con lo stesso numero di punti (ordine antiorario visto dall'alto = CCW in x,z con z giù)."""
        for a, b in zip(rings, rings[1:]):
            n = len(a)
            for i in range(n):
                j = (i + 1) % n
                pts = [a[j], a[i], b[i], b[j]]
                if pts[2] == pts[3]:
                    pts = pts[:3]
                elif pts[0] == pts[1]:
                    pts = pts[1:]
                self.poly(pts, side, mat, **o)
        if bottom:
            self.poly(list(rings[0]), bottom, mat, **o)
        if top:
            self.poly(list(reversed(rings[-1])), top, mat, **o)

    def prism(self, n, r0, r1, y0, y1, side, top=None, bottom=None, a0=None, cx=0.0, cz=0.0, **o):
        a0 = math.pi / n if a0 is None else a0
        self.loft([self.ring(n, r0, y0, a0=a0, cx=cx, cz=cz), self.ring(n, r1, y1, a0=a0, cx=cx, cz=cz)], side, top, bottom, **o)

    def cone(self, n, r, y0, y1, side, bottom=None, a0=None, cx=0.0, cz=0.0, **o):
        a0 = math.pi / n if a0 is None else a0
        base = self.ring(n, r, y0, a0=a0, cx=cx, cz=cz)
        tip = (cx, y1, cz)
        for i in range(n):
            j = (i + 1) % n
            self.poly([base[j], base[i], tip], side, **o)
        if bottom:
            self.poly(base, bottom, **o)

    # --- UV
    def _uv(self, pts, region, mode, o):
        rx, ry, rw, rh = atlas.REGIONS[region]
        n = newell(pts)
        if mode == 'head':  # facce rivolte in avanti: viso; le altre: pelle liscia
            if n[2] < -0.35:
                mode = 'front'
            else:
                return self._uv(pts, o['alt'], 'planar', {})
        if mode == 'front':  # proiezione frontale su bbox dato (viso)
            bx0, by0, bx1, by1 = o['bbox']
            uu = [(bx1 - p[0]) / (bx1 - bx0) * rw for p in pts]  # x cresce verso sinistra di chi guarda il viso
            vv = [(by1 - p[1]) / (by1 - by0) * rh for p in pts]
        else:
            if abs(n[1]) > 0.7:
                T, D = (1, 0, 0), (0, 0, 1)
            else:
                T = _norm((n[2], 0, -n[0])); D = _norm(_cross(T, n))
            if o.get('rot'):
                T, D = D, T
            uu = [_dot(p, T) * TPM for p in pts]
            vv = [_dot(p, D) * TPM for p in pts]
            mu, mv = min(uu), min(vv)
            uu = [u - mu + o.get('ou', 0) for u in uu]
            vv = [v - mv + o.get('ov', 0) for v in vv]
            if mode == 'fit':
                su = (rw - 0.1) / (max(uu) or 1); sv = (rh - 0.1) / (max(vv) or 1)
                uu = [u * su for u in uu]; vv = [v * sv for v in vv]
            else:
                eu, ev = max(uu), max(vv)
                if eu > rw - 0.1:
                    uu = [u * (rw - 0.1) / eu for u in uu]
                if ev > rh - 0.1:
                    vv = [v * (rh - 0.1) / ev for v in vv]
        return [((rx + 0.05 + u) / atlas.SIZE, 1 - (ry + 0.05 + v) / atlas.SIZE) for u, v in zip(uu, vv)]

    # --- verso Blender
    def build(self, collection=None):
        verts, faces, uvs, mats, bones = [], [], [], [], []
        mat_names = []
        for pts, region, mat, mode, o, bone in self.polys:
            base = len(verts)
            verts += [to_blender(p) for p in pts]
            faces.append(list(range(base, base + len(pts))))
            uvs += self._uv(pts, region, mode, o)
            if mat not in mat_names:
                mat_names.append(mat)
            mats.append(mat_names.index(mat))
            bones.append(bone)
        me = bpy.data.meshes.new(self.name)
        me.from_pydata(verts, [], faces)
        uvl = me.uv_layers.new(name='UVMap')
        for li, loop in enumerate(me.loops):
            uvl.data[li].uv = uvs[loop.vertex_index]
        for m in mat_names:
            me.materials.append(material(m))
        me.polygons.foreach_set('material_index', mats)
        try:
            me.shade_flat()
        except AttributeError:
            for p in me.polygons:
                p.use_smooth = False
        me.validate(); me.update()
        ob = bpy.data.objects.new(self.name, me)
        (collection or bpy.context.scene.collection).objects.link(ob)
        if any(bones):
            groups = {}
            def g(b):
                if b not in groups:
                    groups[b] = ob.vertex_groups.new(name=b)
                return groups[b]
            vi = 0
            for (pts, *_rest), b in zip(self.polys, bones):
                for p in pts:
                    ws = self.wmap.get(key(p)) or [(b, 1.0)]
                    for bn, w in ws:
                        g(bn).add([vi], w, 'REPLACE')
                    vi += 1
        return ob


_MATS = {}
EMISSIVE_MATS = {'mat_emissivo'}


def atlas_image():
    img = bpy.data.images.get('atlas.png')
    if not img:
        img = bpy.data.images.load(ATLAS_PNG)
        img.name = 'atlas.png'
    return img


def material(name):
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = atlas_image(); tex.interpolation = 'Closest'
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 1.0
    m.use_backface_culling = True
    bsdf.inputs['Metallic'].default_value = 0.0
    if name in EMISSIVE_MATS:
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Emission Color'])
        bsdf.inputs['Emission Strength'].default_value = 1.0
    return m


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _MATS.clear()


def empty(name, p, collection=None):
    ob = bpy.data.objects.new(name, None)
    ob.location = to_blender(p)
    ob.empty_display_size = 0.2
    (collection or bpy.context.scene.collection).objects.link(ob)
    return ob


def beam(m, p0, p1, w, h, side, end=None, up=(0, 1, 0), n=4, twist=0.0, **o):
    """Trave/palo a sezione n-gonale (n=4 → rettangolare w x h) da p0 a p1."""
    d = _norm(_sub(p1, p0))
    if abs(_dot(d, up)) > 0.95:
        up = (0, 0, 1)
    a = _norm(_cross(d, up)); b = _norm(_cross(a, d))
    def ring(p):
        pts = []
        for i in range(n):
            ang = twist + (math.pi / 4 if n == 4 else 0) + 2 * math.pi * i / n
            ca, sa = math.cos(ang) * (w / 2) * (math.sqrt(2) if n == 4 else 1), math.sin(ang) * (h / 2) * (math.sqrt(2) if n == 4 else 1)
            pts.append((p[0] + a[0] * ca + b[0] * sa, p[1] + a[1] * ca + b[1] * sa, p[2] + a[2] * ca + b[2] * sa))
        return pts
    r0, r1 = ring(p0), ring(p1)
    def out(pts, direction):
        return pts if _dot(newell(pts), direction) >= 0 else list(reversed(pts))
    mid = tuple((p0[k] + p1[k]) / 2 for k in range(3))
    for i in range(n):
        j = (i + 1) % n
        q = [r0[i], r0[j], r1[j], r1[i]]
        fc = tuple(sum(v[k] for v in q) / 4 for k in range(3))
        rad = _sub(fc, mid); rad = _sub(rad, tuple(d[k] * _dot(rad, d) for k in range(3)))
        m.poly(out(q, rad), side, **o)
    if end:
        m.poly(out(list(r0), tuple(-c for c in d)), end, **o)
        m.poly(out(list(r1), d), end, **o)


def fix_winding(m, start):
    """Rende le facce aggiunte da `start` in poi rivolte verso l'esterno rispetto al loro baricentro comune."""
    polys = m.polys[start:]
    pts = [p for poly in polys for p in poly[0]]
    c = tuple(sum(q[k] for q in pts) / len(pts) for k in range(3))
    for i, poly in enumerate(polys):
        pp = poly[0]
        fc = tuple(sum(q[k] for q in pp) / len(pp) for k in range(3))
        if _dot(newell(pp), _sub(fc, c)) < 0:
            m.polys[start + i] = (list(reversed(pp)),) + poly[1:]


def face(m, pts, region, n, **o):
    """Poligono orientato verso la direzione n (evita di pensare al verso dei vertici)."""
    m.poly(pts if _dot(newell(pts), n) >= 0 else list(reversed(pts)), region, **o)


def roof(m, x0, x1, zc, hd, ye, yr, thick=0.08, curl=0.1, top='tegole', under='legno_scuro', edge='nero_lacca', ridge='nero_lacca'):
    """Tetto a due falde con colmo lungo X e gronde rialzate (stile villaggio asiatico)."""
    prof = [(0.0, yr), (0.62 * hd, yr - (yr - ye) * 0.78), (hd, ye + curl * 0.2)]
    for s in (1, -1):
        P = [(zc + s * z, y) for z, y in prof]
        for (za, ya), (zb, yb) in zip(P, P[1:]):
            nrm = (0, 1, s * 0.5)
            face(m, [(x0, ya, za), (x1, ya, za), (x1, yb, zb), (x0, yb, zb)], top, nrm)
            face(m, [(x0, ya - thick, za), (x1, ya - thick, za), (x1, yb - thick, zb), (x0, yb - thick, zb)], under, (0, -1, 0))
        ze, yee = P[-1]
        face(m, [(x0, yee, ze), (x1, yee, ze), (x1, yee - thick, ze), (x0, yee - thick, ze)], edge, (0, 0, s))
        for x, sx in ((x0, -1), (x1, 1)):
            for (za, ya), (zb, yb) in zip(P, P[1:]):
                face(m, [(x, ya, za), (x, yb, zb), (x, yb - thick, zb), (x, ya - thick, za)], edge, (sx, 0, 0))
    if ridge:
        beam(m, (x0 - 0.05, yr + 0.03, zc), (x1 + 0.05, yr + 0.03, zc), 0.12, 0.1, ridge, end=ridge)
        for x, sx in ((x0 - 0.05, -1), (x1 + 0.05, 1)):
            beam(m, (x, yr + 0.03, zc), (x + sx * 0.18, yr + 0.2, zc), 0.1, 0.08, ridge, end=ridge)


def log(m, p0, p1, r, n=6, side='corteccia', end='taglio', **o):
    beam(m, p0, p1, 2 * r, 2 * r, side, end=end, n=n, **o)
