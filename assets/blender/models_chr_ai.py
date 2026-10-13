# Avatar fatto con l'AI 3D (#287, Jack 14 ott 2026): Hunyuan3D v3 «LowPoly» dalla vista a T dello sheet
# (assets/concept/avatar/avatar_sheet_completo.jpg), ridotto a 3.000 triangoli → assets/ai/avatar/hunyuan_3000.glb.
# Stesso contratto di chr_base (CONTRACTS §9): scheletro con gli stessi nomi, clip idle walk run sit row, materiali mat_pelle /
# mat_capelli / mat_vestito tinti dal client, cappelli cappello_<id>. I capelli sono quelli del modello: niente capelli_<n>.
# Come si fa:
#   1. il modello arriva a T, guarda verso −Y di Blender: si gira di 180° (il davanti del gioco è +Y), alto 1,68 m capelli compresi;
#   2. ossa a T sulle misure del modello, pesi per zona (braccia, testa, gambe, busto) con passaggi morbidi alle giunture;
#   3. le braccia si abbassano con le ossa e quella diventa la posa di riposo (come il chr_base di prima);
#   4. texture propria (`chr_base.png`, 512): pelle, capelli e camicia diventano grigi normalizzati (il client li moltiplica per il
#      colore scelto), pantaloncini, ciabatte e occhi restano coi colori veri.
import math, os
import bpy, bmesh
import numpy as np
from mathutils import Matrix, Vector
import models_chr
from models_chr import hat_piece, make_clips, apply_look, HATS, CLIPS, FPS

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'ai', 'avatar', 'hunyuan_3000.glb')
HEIGHT = 1.68  # dai piedi alla cima dei capelli; il cranio arriva a ~1,6 come il chr_base di prima

# ossa (coordinate di gioco, x destra, y su, z indietro): braccia a T come il modello, poi si abbassano (ARM_DOWN)
BONES_T = {
    'Hips': ((0, 0.80, 0), (0, 0.92, 0), None),
    'Spine': ((0, 0.92, 0), (0, 1.30, 0), 'Hips'),
    'Head': ((0, 1.32, 0), (0, 1.62, 0), 'Spine'),
    'UpperArm.L': ((-0.17, 1.24, 0), (-0.40, 1.24, 0), 'Spine'),
    'LowerArm.L': ((-0.40, 1.24, 0), (-0.64, 1.24, 0), 'UpperArm.L'),
    'UpperArm.R': ((0.17, 1.24, 0), (0.40, 1.24, 0), 'Spine'),
    'LowerArm.R': ((0.40, 1.24, 0), (0.64, 1.24, 0), 'UpperArm.R'),
    'UpperLeg.L': ((-0.10, 0.80, 0), (-0.10, 0.42, 0), 'Hips'),
    'LowerLeg.L': ((-0.10, 0.42, 0), (-0.10, 0.09, 0), 'UpperLeg.L'),
    'Foot.L': ((-0.10, 0.09, 0), (-0.10, 0.03, -0.12), 'LowerLeg.L'),
    'UpperLeg.R': ((0.10, 0.80, 0), (0.10, 0.42, 0), 'Hips'),
    'LowerLeg.R': ((0.10, 0.42, 0), (0.10, 0.09, 0), 'UpperLeg.R'),
    'Foot.R': ((0.10, 0.09, 0), (0.10, 0.03, -0.12), 'LowerLeg.R'),
}
TEX = 512
ARM_DOWN = 84  # gradi: le braccia scendono e restano appena aperte
TINTE = ('pelle', 'capelli', 'vestito')


def _ss(v, a, b):
    t = min(1.0, max(0.0, (v - a) / (b - a)))
    return t * t * (3 - 2 * t)


def _weights(x, y, z):
    """Pesi per zona sul modello a T (Blender: x lato, y avanti, z su)."""
    ax, side = abs(x), ('L' if x < 0 else 'R')
    arm = _ss(ax, 0.15, 0.22) * _ss(z, 1.08, 1.14)
    low = _ss(ax, 0.36, 0.44)
    head = _ss(z, 1.31, 1.37)
    leg = 1.0 - _ss(z, 0.58, 0.70)
    lower = 1.0 - _ss(z, 0.38, 0.46)
    foot = 1.0 - _ss(z, 0.07, 0.11)
    spine = _ss(z, 0.88, 0.98)
    rest = 1.0 - arm
    w = {
        f'UpperArm.{side}': arm * (1 - low), f'LowerArm.{side}': arm * low,
        'Head': rest * head,
        f'Foot.{side}': rest * (1 - head) * leg * foot,
        f'LowerLeg.{side}': rest * (1 - head) * leg * lower * (1 - foot),
        f'UpperLeg.{side}': rest * (1 - head) * leg * (1 - lower),
        'Hips': rest * (1 - head) * (1 - leg) * (1 - spine),
        'Spine': rest * (1 - head) * (1 - leg) * spine,
    }
    s = sum(w.values()) or 1.0
    return {k: v / s for k, v in w.items() if v / s > 0.01}


def _classe(rgb, c, n):
    """Zona di una faccia dal colore della texture sotto il suo centro (rgb), dal centro (c) e dalla normale (n)."""
    r, g, b = rgb
    z = c.z
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    sat = max(rgb) - min(rgb)
    if g > r and b > r * 0.9 and sat > 0.08:
        return 'fisso'                      # pantaloncini teal
    if z < 0.12 and not (r > 0.6 and r - b > 0.3):
        return 'fisso'                      # ciabatte (marrone come i capelli, ma ai piedi)
    if lum > 0.62 and sat < 0.16:
        return 'vestito' if 0.55 < z < 1.36 else 'fisso'   # camicia (in testa: bianchi degli occhi)
    if r > 0.55 and r - b > 0.3:
        return 'pelle'
    if 1.4 < z < 1.53 and abs(c.x) < 0.075 and n.y > 0.35:
        return 'fisso'                      # occhi e sopracciglia: restano coi colori veri, non prendono la tinta dei capelli
    if z > 1.28 and lum < 0.45:
        return 'capelli'
    return 'fisso'


def _immagine_tinta(px, faces_uv, classi):
    """Texture per il client: nelle facce da tingere il colore diventa grigio (luminanza / mediana della zona × 0,85)."""
    H, W = px.shape[:2]
    out = px.copy()
    lum = 0.3 * px[:, :, 0] + 0.59 * px[:, :, 1] + 0.11 * px[:, :, 2]
    mask = {c: np.zeros((H, W), bool) for c in TINTE}
    yy, xx = np.mgrid[0:H, 0:W]
    for uv, c in zip(faces_uv, classi):
        if c not in mask:
            continue
        P = np.array([(u * W, v * H) for u, v in uv])
        x0, y0 = np.floor(P.min(0) - 2).astype(int).clip(0, [W - 1, H - 1]); x1, y1 = np.ceil(P.max(0) + 2).astype(int).clip(0, [W - 1, H - 1])
        X, Y = xx[y0:y1 + 1, x0:x1 + 1] + 0.5, yy[y0:y1 + 1, x0:x1 + 1] + 0.5
        dentro = np.zeros(X.shape, bool)
        for k in range(1, len(P) - 1):  # ventaglio di triangoli, gonfiato di ~1,5 px contro le cuciture
            a, b, cc = P[0], P[k], P[k + 1]
            d = (b[1] - cc[1]) * (a[0] - cc[0]) + (cc[0] - b[0]) * (a[1] - cc[1])
            if abs(d) < 1e-9:
                continue
            l1 = ((b[1] - cc[1]) * (X - cc[0]) + (cc[0] - b[0]) * (Y - cc[1])) / d
            l2 = ((cc[1] - a[1]) * (X - cc[0]) + (a[0] - cc[0]) * (Y - cc[1])) / d
            l3 = 1 - l1 - l2
            eps = 1.5 / max(1.0, math.sqrt(abs(d)))
            dentro |= (l1 > -eps) & (l2 > -eps) & (l3 > -eps)
        mask[c][y0:y1 + 1, x0:x1 + 1] |= dentro
    for c, m in mask.items():
        if not m.any():
            continue
        ref = float(np.median(lum[m])) or 1.0
        g = np.clip(lum[m] / ref * 0.85, 0, 1)
        out[m, 0] = g; out[m, 1] = g; out[m, 2] = g
    return out


def _materiale(name, img):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img; tex.interpolation = 'Closest'
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 1.0; bsdf.inputs['Metallic'].default_value = 0.0
    m.use_backface_culling = True
    return m


def _corpo():
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=SRC)
    new = [o for o in bpy.data.objects if o not in before]
    ob = next(o for o in new if o.type == 'MESH')
    for o in new:
        if o is not ob:
            bpy.data.objects.remove(o, do_unlink=True)
    ob.parent = None
    me = ob.data
    me.transform(ob.matrix_world); ob.matrix_world = Matrix()
    V = np.array([v.co[:] for v in me.vertices])
    lo, hi = V.min(0), V.max(0)
    s = HEIGHT / (hi[2] - lo[2])
    c = Vector(((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]))
    me.transform(Matrix.Rotation(math.pi, 4, 'Z') @ Matrix.Scale(s, 4) @ Matrix.Translation(-c))  # davanti verso +Y
    ob.name = me.name = 'chr_base'
    # texture: zone per faccia, immagine tinta, quattro materiali
    src_img = next(i for i in bpy.data.images if i.size[0] > 0)
    if src_img.size[0] > TEX:
        src_img.scale(TEX, TEX)  # nel gioco l'avatar è alto 56-112 px: 512 basta e all'avvio pesa ~0,3 MB
    W, H = src_img.size
    px = np.array(src_img.pixels[:], dtype=np.float32).reshape(H, W, 4)
    bm = bmesh.new(); bm.from_mesh(me); uvl = bm.loops.layers.uv.active
    faces_uv, classi = [], []
    for f in bm.faces:
        uv = [tuple(l[uvl].uv) for l in f.loops]
        cu = sum(u for u, _ in uv) / len(uv); cv = sum(v for _, v in uv) / len(uv)
        rgb = px[min(H - 1, int(cv * H)), min(W - 1, int(cu * W)), :3]
        faces_uv.append(uv); classi.append(_classe(tuple(float(x) for x in rgb), f.calc_center_median(), f.normal))
    img = bpy.data.images.new('chr_base', W, H, alpha=True)
    img.pixels[:] = _immagine_tinta(px, faces_uv, classi).ravel()
    img.pack()
    me.materials.clear()
    nomi = ['mat_pelle', 'mat_capelli', 'mat_vestito', 'mat_avatar']
    for n in nomi:
        me.materials.append(_materiale(n, img))
    idx = {'pelle': 0, 'capelli': 1, 'vestito': 2, 'fisso': 3}
    for f, c in zip(bm.faces, classi):
        f.material_index = idx[c]
    bm.to_mesh(me); bm.free()
    for p in me.polygons:
        p.use_smooth = False
    for n in list(bpy.data.images):
        if n is not img and n.users == 0:
            bpy.data.images.remove(n)
    # pesi
    groups = {b: ob.vertex_groups.new(name=b) for b in BONES_T}
    for v in me.vertices:
        for b, w in _weights(*v.co).items():
            groups[b].add([v.index], w, 'REPLACE')
    conteggio = {c: classi.count(c) for c in set(classi)}
    return ob, conteggio


def _rig(mesh_obs):
    models_chr.BONES.clear(); models_chr.BONES.update(BONES_T)  # build_rig e le clip (seduto) leggono BONES
    rig = models_chr.build_rig(mesh_obs)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='POSE')
    for side, sgn in (('L', -1), ('R', 1)):
        pb = rig.pose.bones[f'UpperArm.{side}']
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = models_chr.rot(pb, (0, 1, 0), sgn * ARM_DOWN)
    bpy.ops.object.mode_set(mode='OBJECT')
    for mo in mesh_obs:  # la posa con le braccia giù diventa la forma a riposo
        bpy.context.view_layer.objects.active = mo
        mod = next(m for m in mo.modifiers if m.type == 'ARMATURE')
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.armature_apply()
    bpy.ops.object.mode_set(mode='OBJECT')
    for mo in mesh_obs:
        mod = mo.modifiers.new('Armature', 'ARMATURE'); mod.object = rig
    # BONES con le braccia giù, per chi lo rilegge (anteprime, test)
    for b in rig.data.bones:
        h, t = b.head_local, b.tail_local
        models_chr.BONES[b.name] = ((h.x, h.z, -h.y), (t.x, t.z, -t.y), b.parent.name if b.parent else None)
    return rig


DEFAULT_LOOK = {'pelle': '#D9A070', 'capelli': 0, 'coloreCapelli': '#5A3A1E', 'vestito': '#F4E3C1', 'cappello': 'nessuno'}
VARIANTS = [
    {'nome': 'A', 'pelle': '#D9A070', 'capelli': 0, 'coloreCapelli': '#2E1E14', 'vestito': '#E8433F', 'cappello': 'nessuno'},
    {'nome': 'B', 'pelle': '#EFC29B', 'capelli': 0, 'coloreCapelli': '#E8433F', 'vestito': '#F2A33A', 'cappello': 'nessuno'},
    {'nome': 'C', 'pelle': '#8C5636', 'capelli': 0, 'coloreCapelli': '#F4E3C1', 'vestito': '#3FB9C9', 'cappello': 'paglia'},
]
CATALOG = [{'nome': h, 'pelle': '#B8784C', 'capelli': 0, 'coloreCapelli': '#2E1E14', 'vestito': '#E8433F', 'cappello': h} for h in HATS]


def chr_base():
    body, conteggio = _corpo()
    hats = [hat_piece(h).build() for h in HATS]
    rig = _rig([body] + hats)
    make_clips(rig)
    tri = lambda ob: sum(len(p.vertices) - 2 for p in ob.data.polygons)
    print('[chr_ai] facce per zona', conteggio)
    return [rig, body] + hats, {
        'clips': list(CLIPS), 'durate': {k: round(n / FPS, 3) for k, (_f, n) in CLIPS.items()},
        'preview': {'walk': 4, 'run': 4, 'sit': 0, 'row': 10},
        'tri_pezzi': {ob.name: tri(ob) for ob in [body] + hats},
        'look_fn': apply_look, 'look': DEFAULT_LOOK, 'variants': VARIANTS, 'catalog': CATALOG,
    }


MODELS = {'chr_base': chr_base}
