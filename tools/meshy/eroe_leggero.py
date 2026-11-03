# Il protagonista di Meshy (glb da ~600k triangoli, texture 2K) → mesh leggera a 3.000 triangoli con UV pulite e texture 512 sulla palette del gioco.
# Lancio:  ALTA=<glb di Meshy> OUT=<cartella> blender -b -P tools/meshy/eroe_leggero.py
# Esce: OUT/eroe_basso.blend (mesh + UV + immagine), OUT/eroe_tex.png (la texture a pochi colori), anteprime OUT/leggero_*.png.
# La stessa trasformazione (giro, scala, piedi a terra) vale per ogni altro glb Meshy dello stesso personaggio (skin_bake.py): `allinea()`.
import bpy, os, sys, math
from mathutils import Vector
SP = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, SP)
import vista


def allinea(alta_glb, altezza):
    """Importa il glb di Meshy: davanti verso +Y di Blender (−Z di gioco), alto `altezza` m, piedi a z=0, centrato tra i piedi."""
    bpy.ops.import_scene.gltf(filepath=alta_glb)
    ms = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in ms: o.select_set(True)
    bpy.context.view_layer.objects.active = ms[0]
    if len(ms) > 1: bpy.ops.object.join()
    alta = bpy.context.view_layer.objects.active
    alta.name = 'alta'
    alta.rotation_mode = 'XYZ'; alta.rotation_euler[2] = math.pi   # Meshy guarda a −Y, il gioco a +Y
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    co = [v.co.copy() for v in alta.data.vertices]
    zmin, zmax = min(c.z for c in co), max(c.z for c in co)
    k = altezza / (zmax - zmin)
    piedi = [c for c in co if c.z < zmin + 0.04 * (zmax - zmin)]
    cx = sum(c.x for c in piedi) / len(piedi); cy = sum(c.y for c in piedi) / len(piedi)
    for v in alta.data.vertices:
        v.co = Vector(((v.co.x - cx) * k, (v.co.y - cy) * k, (v.co.z - zmin) * k))
    return alta


if __name__ == '__main__':
    ALTA, OUT = os.environ['ALTA'], os.environ['OUT']
    TARGET = int(os.environ.get('TRIS', '3000')); RES = int(os.environ.get('RES', '512')); K = int(os.environ.get('K', '16'))
    ALTEZZA = float(os.environ.get('ALTEZZA', '1.62'))
    os.makedirs(OUT, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    high = allinea(ALTA, ALTEZZA)
    bpy.context.view_layer.objects.active = high
    # bassa: copia, saldata, decimata
    low = high.copy(); low.data = high.data.copy(); low.name = 'chr_eroe'
    bpy.context.scene.collection.objects.link(low)
    bpy.ops.object.select_all(action='DESELECT'); low.select_set(True); bpy.context.view_layer.objects.active = low
    low.data.materials.clear()
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=0.0005)
    bpy.ops.object.mode_set(mode='OBJECT')
    n0 = sum(len(p.vertices) - 2 for p in low.data.polygons)
    m = low.modifiers.new('dec', 'DECIMATE'); m.decimate_type = 'COLLAPSE'; m.ratio = min(1.0, TARGET / n0); m.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier='dec')
    print('TRI', n0, '->', sum(len(p.vertices) - 2 for p in low.data.polygons))
    # UV nuove
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004)
    bpy.ops.object.mode_set(mode='OBJECT')
    img = bpy.data.images.new('eroe_tex', RES, RES, alpha=False)
    mat = bpy.data.materials.new('mat_eroe'); mat.use_nodes = True
    nt = mat.node_tree; tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = img; tx.interpolation = 'Closest'
    nt.nodes.active = tx
    low.data.materials.append(mat)
    # cottura del colore dall'alta (Cycles)
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 8
    sc.render.bake.use_pass_direct = False; sc.render.bake.use_pass_indirect = False; sc.render.bake.use_pass_color = True
    sc.render.bake.margin = 6
    bpy.ops.object.select_all(action='DESELECT'); high.select_set(True); low.select_set(True); bpy.context.view_layer.objects.active = low
    bpy.ops.object.bake(type='DIFFUSE', use_selected_to_active=True, cage_extrusion=0.03, max_ray_distance=0.12)
    high.hide_render = True; high.hide_viewport = True
    import eroe_palette
    cotta, finale = os.path.join(OUT, 'eroe_tex_cotta.png'), os.path.join(OUT, 'eroe_tex.png')
    img.filepath_raw = cotta; img.file_format = 'PNG'; img.save()
    # la palette lavora sui byte sRGB: si rilegge la cottura come Non-Color e si riscrive il PNG a pochi colori
    nc = bpy.data.images.load(cotta); nc.colorspace_settings.name = 'Non-Color'
    print('COLORI', eroe_palette.quantizza(nc, K))
    nc.filepath_raw = finale; nc.file_format = 'PNG'; nc.save()
    bpy.data.images.remove(nc); bpy.data.images.remove(img)
    img = bpy.data.images.load(finale); img.name = 'eroe_tex'; img.pack()
    tx.image = img
    # materiale esportabile (texture → Base Color), facce piatte, e il glb leggero che il gioco usa come sorgente (assets/ai/eroe/eroe_3000.glb)
    bsdf = nt.nodes.get('Principled BSDF'); nt.links.new(tx.outputs['Color'], bsdf.inputs['Base Color']); bsdf.inputs['Roughness'].default_value = 1.0
    for p in low.data.polygons: p.use_smooth = False
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'eroe_basso.blend'))
    bpy.ops.object.select_all(action='DESELECT'); low.select_set(True); bpy.context.view_layer.objects.active = low
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'eroe_3000.glb'), export_format='GLB', use_selection=True, export_apply=False)
    vista.foto(os.path.join(OUT, 'leggero'), centro=(0, 0, 0.81), alt=1.9)
