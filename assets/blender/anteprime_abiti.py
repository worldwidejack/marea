# MAREA — anteprime 2D dei vestiti e dei cappelli del Mercante (apps/client/public/assets/abiti/<abt_|cap_><id>.png, menù del Mercante e Borsa).
# Il pezzo da solo, senza il corpo, di tre quarti davanti, contorno scuro (scafo rovesciato) e sfondo trasparente: come le icone dei
# vestiti di un catalogo. Uso: node tools/anteprime_abiti.mjs [id...]  (Blender -b -P assets/blender/anteprime_abiti.py -- <cartella> [nomi])
import math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [HERE, os.path.join(HERE, '..', '..', 'tools')]
import bpy, mathutils
import lib, abiti_kit, models_abiti

argv = sys.argv[sys.argv.index('--') + 1:]
OUT = os.path.abspath(argv[0])
SOLO = set(argv[1:])
LATO = 192
CONTORNO = (0.18, 0.12, 0.08, 1.0)   # #2E1E14 ombra calda, lineare circa


def scena(objs):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x = sc.render.resolution_y = LATO
    sc.render.film_transparent = True
    sc.render.filter_size = 0.8
    sc.view_settings.view_transform = 'Standard'
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    w = bpy.data.worlds.new('w'); sc.world = w
    w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = (0.75, 0.78, 0.85, 1); bg.inputs['Strength'].default_value = 0.9
    sun = bpy.data.lights.new('sole', 'SUN'); sun.energy = 2.6; sun.color = (1.0, 0.92, 0.8); sun.angle = 0.2
    so = bpy.data.objects.new('sole', sun); sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(45), 0, math.radians(-40))
    # contorno: guscio rovesciato un filo più grande, visto solo da dietro
    mo = bpy.data.materials.new('contorno'); mo.use_nodes = True
    nt = mo.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL':
            nt.nodes.remove(n)
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Color'].default_value = CONTORNO
    nt.links.new(em.outputs['Emission'], next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL').inputs['Surface'])
    mo.use_backface_culling = True
    pts = []
    for ob in objs:
        if ob.type != 'MESH' or ob.hide_render:
            continue
        ob.data.materials.append(mo)
        sol = ob.modifiers.new('contorno', 'SOLIDIFY')
        sol.thickness = 0.009; sol.offset = 1.0; sol.use_flip_normals = True; sol.use_rim = False
        sol.material_offset = len(ob.data.materials) - 1
        pts += [ob.matrix_world @ v.co for v in ob.data.vertices]
    lo = mathutils.Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = mathutils.Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    c = (lo + hi) / 2
    cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'
    cam.ortho_scale = max(hi.x - lo.x, hi.z - lo.z, (hi.y - lo.y) * 0.8) * 1.14
    co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
    yaw, pitch, d = math.radians(156), math.radians(14), 6  # davanti, di tre quarti
    co.location = c + mathutils.Vector((math.sin(yaw) * math.cos(pitch) * d, -math.cos(yaw) * math.cos(pitch) * d, math.sin(pitch) * d))
    co.rotation_euler = (c - co.location).to_track_quat('-Z', 'Y').to_euler()


os.makedirs(OUT, exist_ok=True)
RICETTE = models_abiti.RICETTE
for name, fn in RICETTE.items():
    if SOLO and name not in SOLO:
        continue
    lib.reset()
    corpo = abiti_kit.Corpo()
    objs = abiti_kit.costruisci(corpo, fn(corpo))
    corpo.ob.hide_render = True
    scena(objs[1:])
    bpy.context.scene.render.filepath = os.path.join(OUT, name + '.png')
    bpy.ops.render.render(write_still=True)
    print('[anteprime] ' + name)
