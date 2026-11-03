# MAREA — il protagonista fatto con Meshy (Riccardo, 3 nov 2026): `chr_eroe`, il ragazzo con la fascia rossa, la cicatrice a X e la borsa a tracolla.
# Disegno di Riccardo (assets/concept/eroe/fronte.jpg) → tre viste di Codex (sinistra, dietro, destra, nella stessa cartella) → Meshy 7.1 a 4 viste
# (multi-image-to-3d, task 01a1a0d8-9a3a-745a-98f5-90a29a5a7988, ~780k triangoli, texture 2K, 30 crediti, il glb scade: non sta nel repo)
# → tools/meshy/eroe_leggero.py: 3.000 triangoli, UV nuove, texture 512 cotta e portata sui colori della palette → assets/ai/eroe/eroe_3000.glb.
# Qui lo si veste dello scheletro di sempre (CONTRACTS §9: stessi nomi di ossa, clip idle walk run sit row) con pesi calcolati a mano.
# La texture (`chr_eroe.png`, 512) è l'unico colore del modello: le SKIN sono altre texture con le stesse UV (tools/meshy/skin_tinta.py e
# skin_bake.py → apps/client/public/assets/skin/<id>.png), il client le cambia al volo sul materiale `mat_eroe` (game/avatar_skin.ts).
# Niente mat_pelle/capelli/vestito: la tinta di pelle e capelli non c'è più su questo corpo.
import math
import bpy
from mathutils import Vector
import gente_kit, models_chr_eroe
from lib import to_blender
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'ai', 'eroe', 'eroe_3000.glb')
# ossa a riposo misurate sul modello (1,62 m capelli compresi, braccia appena aperte come nel disegno, gambe corte da cartone)
OSSA = gente_kit.bones_for(hip=0.54, chest=0.88, neck=1.00, top=1.50, sh=(0.18, 0.89), elbow=0.72, wrist=0.60, leg_x=0.075, knee=0.32,
                           ankle=0.10, foot=0.17, arm_out=0.08)
TAU = 0.03            # quanto sfumano i pesi tra due ossa (m)
DENTRO = (0.10, 0.17)  # le braccia pesano solo fuori dal busto: da 0 a 1 tra queste due |x|
BORSA = ((0.05, 0.21), (0.46, 0.72), 0.16)  # la borsa sul fianco destro segue il bacino e basta: x, z, |y| massimi


def _ss(v, a, b):
    t = min(1.0, max(0.0, (v - a) / (b - a)))
    return t * t * (3 - 2 * t)


def _segd(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(1e-9, ab.dot(ab))))
    return (p - (a + ab * t)).length


def _mesh():
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=SRC)
    nuovi = [o for o in set(bpy.data.objects) - before]
    mesh = next(o for o in nuovi if o.type == 'MESH')
    for o in nuovi:
        if o is not mesh and o.type != 'MESH':
            bpy.data.objects.remove(o, do_unlink=True)
    mesh.parent = None
    mesh.name = 'chr_eroe'
    mesh.data.name = 'chr_eroe'
    for p in mesh.data.polygons:
        p.use_smooth = False
    mat = mesh.data.materials[0]
    mat.name = 'mat_eroe'
    img = next(n.image for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE')
    img.name = 'chr_eroe'   # build_assets.mjs: le texture `chr_*` escono in un file accanto (chr_eroe.png), non diventano l'atlas
    return mesh


def _pesi(mesh, ossa):
    """Ogni vertice segue l'osso più vicino (peso ∝ e^(−d/TAU)); le braccia solo fuori dal busto e ogni lato solo il suo; la borsa il bacino."""
    bl = {b: (Vector(to_blender(h)), Vector(to_blender(t))) for b, (h, t, _p) in ossa.items()}
    gr = {b: mesh.vertex_groups.new(name=b) for b in ossa}
    (bx0, bx1), (bz0, bz1), by = BORSA
    for v in mesh.data.vertices:
        p = v.co
        if bx0 < p.x < bx1 and bz0 < p.z < bz1 and abs(p.y) < by:
            gr['Hips'].add([v.index], 1.0, 'REPLACE')
            continue
        ds = {}
        for b, (h, t) in bl.items():
            if b.endswith('.L') and p.x > 0.02: continue
            if b.endswith('.R') and p.x < -0.02: continue
            d = _segd(p, h, t)
            if b.startswith(('UpperArm', 'LowerArm')): d -= TAU * math.log(max(1e-3, _ss(abs(p.x), *DENTRO)))
            ds[b] = d
        dm = min(ds.values())
        w = {b: math.exp(-(d - dm) / TAU) for b, d in ds.items()}
        w = {b: x for b, x in sorted(w.items(), key=lambda kv: -kv[1])[:4] if x > 0.02}
        s = sum(w.values())
        for b, x in w.items():
            gr[b].add([v.index], x / s, 'REPLACE')


def chr_eroe():
    ossa_m = models_chr_eroe.manichino()
    mesh = _mesh()
    rig = gente_kit.build_rig('chr_eroe', OSSA, [mesh])
    _pesi(mesh, OSSA)
    durate = gente_kit.make_clips(rig, OSSA, {'passo': 30, 'braccia': 26, 'molla': 0.8, 'walk_n': 14, 'run_n': 12, 'aperte': 2})
    tri = sum(len(p.vertices) - 2 for p in mesh.data.polygons)
    return [rig, mesh], {
        'clips': list(durate), 'durate': durate,
        'preview': {'walk': 3, 'run': 3, 'sit': 0, 'row': 10},
        'tri_pezzi': {mesh.name: tri},
        # ossa del corpo e del manichino dei vestiti: le armature in scatole (rpg/adatta.ts) si portano sul corpo nuovo osso per osso
        'corpo': {'ossa': {b: [h, t] for b, (h, t, _p) in OSSA.items()}, 'manichino': {b: [h, t] for b, (h, t, _p) in ossa_m.items()}},
    }


MODELS = {'chr_eroe': chr_eroe}
