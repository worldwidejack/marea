# MAREA — i personaggi di Borgo Marea, uno per uno (`npc_<id>`, gente.json → `modello`; botteghe.json → `modello`).
# Ognuno ha sagoma, colori e posa sue: si riconoscono da lontano (a pixel grossi) e nei ritratti. Kit: gente_kit.py, pezzi comuni:
# gente_pezzi.py, personaggi: gente_porto.py (gente del Porto), gente_borgo.py (paesani), gente_botteghe.py (bottegai).
# Davanti −Z, piedi a y = 0, scheletro coi nomi di sempre, clip idle walk run sit row (lo stile del passo cambia da persona a persona).
import importlib
import bpy
import gente_kit, gente_pezzi, gente_porto, gente_borgo, gente_botteghe
for _m in (gente_kit, gente_pezzi, gente_porto, gente_borgo, gente_botteghe):
    importlib.reload(_m)
from gente_kit import build_rig, make_clips

CHARS = {**gente_porto.CHARS, **gente_borgo.CHARS, **gente_botteghe.CHARS}


LOD_TRI = 1800  # la versione leggera (`npc_<id>_lod`): il client la mostra quando la camera è lontana (game/gente_lod.ts)


def _lod(ob, target=LOD_TRI):
    """Copia semplificata (decimate collapse): stessi colori nei vertici, stessi gruppi delle ossa, stesso materiale."""
    lo = ob.copy()
    lo.data = ob.data.copy()
    lo.name = lo.data.name = ob.name + '_lod'
    bpy.context.scene.collection.objects.link(lo)
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    # i vertici sul confine tra due colori (righe della maglia, barba, macchie del furetto) non si toccano: sennò i disegni spariscono
    ca = lo.data.color_attributes['Col']
    cols = {}
    for poly in lo.data.polygons:
        c = tuple(round(x, 3) for x in ca.data[poly.loop_indices[0]].color[:3])
        for v in poly.vertices:
            cols.setdefault(v, set()).add(c)
    g = lo.vertex_groups.new(name='_tieni')
    g.add([v for v, cs in cols.items() if len(cs) > 1], 1.0, 'REPLACE')
    mod = lo.modifiers.new('leggero', 'DECIMATE')
    mod.decimate_type, mod.ratio = 'COLLAPSE', min(1.0, target / tris)
    mod.vertex_group, mod.invert_vertex_group = '_tieni', True
    bpy.context.view_layer.objects.active = lo
    bpy.ops.object.modifier_apply(modifier='leggero')
    lo.vertex_groups.remove(lo.vertex_groups['_tieni'])
    return lo


def _model(fn):
    def run():
        f, B, st = fn()
        ob = f.build()
        lo = _lod(ob)
        rig = build_rig(f.name, B, [ob, lo])
        durate = make_clips(rig, B, st)
        tri = lambda o: sum(len(p.vertices) - 2 for p in o.data.polygons)
        return [rig, ob, lo], {'clips': list(durate), 'durate': durate, 'preview': {'walk': 4}, 'tri_pezzi': {ob.name: tri(ob), lo.name: tri(lo)}}
    return run


MODELS = {n: _model(fn) for n, fn in CHARS.items()}
