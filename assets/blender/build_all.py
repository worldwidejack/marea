# MAREA — costruisce tutti i modelli procedurali, li esporta in glb e ne fa l'anteprima.
# Uso: Blender -b -P assets/blender/build_all.py -- <atlas.png> <out_glb_dir> <out_preview_dir> [nomi...] [--no-preview]
import json, math, os, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [HERE, os.path.join(HERE, '..', '..', 'tools')]
import bpy
import lib, export_gltf
import models_terreno, models_edifici, models_prop, models_chr, models_m1, models_rpg, models_drenaggio, models_archivio, models_fucina, models_corse_spiaggia, models_corse_veicoli, models_corse_piloti, models_corse_veicoli_a, models_corse_veicoli_b, models_corse_veicoli_c, models_corse_piloti_b, models_corse_hub

argv = sys.argv[sys.argv.index('--') + 1:]
flags = {a for a in argv if a.startswith('--')}
args = [a for a in argv if not a.startswith('--')]
lib.ATLAS_PNG, OUT, PREV = os.path.abspath(args[0]), os.path.abspath(args[1]), os.path.abspath(args[2])
only = set(args[3:])
REG = {}
for m in (models_terreno, models_edifici, models_prop, models_chr, models_m1, models_rpg, models_drenaggio, models_archivio, models_fucina, models_corse_spiaggia, models_corse_veicoli, models_corse_piloti, models_corse_veicoli_a, models_corse_veicoli_b, models_corse_veicoli_c, models_corse_piloti_b, models_corse_hub):
    REG.update(m.MODELS)


def setup_preview(objs, name, extra_frames=()):
    sc = bpy.context.scene
    try:
        sc.render.engine = 'BLENDER_EEVEE'
    except TypeError:
        sc.render.engine = 'BLENDER_WORKBENCH'
    sc.render.resolution_x = sc.render.resolution_y = 384
    sc.render.film_transparent = False
    try:
        sc.view_settings.view_transform = 'Standard'  # colori della palette senza la desaturazione di AgX
    except TypeError:
        pass
    sc.render.image_settings.file_format = 'PNG'
    world = bpy.data.worlds.new('w'); sc.world = world
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = (0.35, 0.55, 0.75, 1); bg.inputs['Strength'].default_value = 0.9
    try:
        sc.eevee.use_shadows = True
    except Exception:
        pass
    sun = bpy.data.lights.new('sole', 'SUN'); sun.energy = 3.2; sun.color = (1.0, 0.85, 0.64); sun.angle = 0.05
    so = bpy.data.objects.new('sole', sun); sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(50), 0, math.radians(-135 + 180))
    # bounding box in coordinate Blender
    pts = []
    for ob in objs:
        if ob.type == 'MESH':
            pts += [ob.matrix_world @ v.co for v in ob.data.vertices]
    xs, ys, zs = [p.x for p in pts], [p.y for p in pts], [p.z for p in pts]
    c = ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, (min(zs) + max(zs)) / 2)
    size = max(max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs))
    # famiglie di edifici a livelli (bld_<id>_l<n>, cantiere): inquadratura fissa, così L1/L2/L3 affiancati mostrano la crescita
    import re
    if re.match(r'bld_[a-z]+_l\d$', name) or name == 'bld_cantiere':
        size = 6.8 if name.startswith('bld_faro') else 4.2
        c = (0.0, 0.0, size * 0.34)
    cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = size * 1.45
    co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
    # diorama: yaw 45°, pitch ~35° (visto da sud-est, davanti = −Z di gioco = +Y Blender → camera dal lato −Y? no: guardiamo il davanti)
    yaw, pitch, d = math.radians(-30), math.radians(30), size * 4
    import mathutils
    pos = mathutils.Vector((c[0] + math.sin(yaw) * math.cos(pitch) * d, c[1] + math.cos(yaw) * math.cos(pitch) * d, c[2] + math.sin(pitch) * d))
    co.location = pos
    co.rotation_euler = (mathutils.Vector(c) - pos).to_track_quat('-Z', 'Y').to_euler()
    # piano di terra
    bpy.ops.mesh.primitive_plane_add(size=size * 6, location=(c[0], c[1], min(zs) - 0.001))
    pl = bpy.context.active_object
    m = bpy.data.materials.new('terra'); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'); b.inputs['Base Color'].default_value = (0.22, 0.48, 0.55, 1); b.inputs['Roughness'].default_value = 1
    pl.data.materials.append(m)
    return pl


def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


report = {}


def look_camera(center_z, ortho, res_x, res_y, yaw_deg=-28, pitch_deg=12):
    """Camera ortografica per i primi piani dell'avatar (3/4 davanti), centrata a quota center_z (Blender Z)."""
    import mathutils
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = res_x, res_y
    co = sc.camera
    co.data.ortho_scale = ortho
    yaw, pitch, d = math.radians(yaw_deg), math.radians(pitch_deg), 8.0
    c = mathutils.Vector((0, 0, center_z))
    co.location = c + mathutils.Vector((math.sin(yaw) * math.cos(pitch) * d, math.cos(yaw) * math.cos(pitch) * d, math.sin(pitch) * d))
    co.rotation_euler = (c - co.location).to_track_quat('-Z', 'Y').to_euler()


def main():
  for name, fn in REG.items():
      if only and name not in only:
          continue
      t0 = time.time()
      lib.reset()
      res = fn()
      objs, info = (res if isinstance(res, tuple) else (res, {}))
      look_fn, look = info.pop('look_fn', None), info.pop('look', None)
      variants, catalog = info.pop('variants', []), info.pop('catalog', [])
      clips = info.get('clips')
      glb = export_gltf.export(os.path.join(OUT, name + '.glb'), objs, animations=bool(clips))
      tris = sum(len(p.vertices) - 2 for ob in objs if ob.type == 'MESH' for p in ob.data.polygons)
      report[name] = {'tris_blender': tris, **info}
      if '--no-preview' not in flags:
          vis = look_fn(objs, look) if look_fn else objs
          setup_preview(vis, name)
          arm = next((o for o in objs if o.type == 'ARMATURE'), None)
          if arm and clips:
              for clip, fr in info.get('preview', {}).items():
                  act = bpy.data.actions[clip]
                  arm.animation_data.action = act
                  try:
                      arm.animation_data.action_slot = act.slots[0]
                  except Exception:
                      pass
                  bpy.context.scene.frame_set(fr)
                  render(os.path.join(PREV, f'{name}_{clip}.png'))
              arm.animation_data.action = None
              for pb in arm.pose.bones:
                  pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
              bpy.context.scene.frame_set(0)
          render(os.path.join(PREV, name + '.png'))
          # varianti di look (figura intera + primo piano) e catalogo dei pezzi: PNG singoli, li monta build_assets.mjs
          for sub, looks, shots in (('_varianti', variants, (('corpo', 0.86, 1.95, 360, 560), ('viso', 1.47, 0.52, 360, 360))),
                                    ('_catalogo', catalog, (('viso', 1.55, 0.72, 240, 240),))):
              if not looks:
                  continue
              os.makedirs(os.path.join(PREV, sub), exist_ok=True)
              for i, lk in enumerate(looks):
                  look_fn(objs, lk)
                  for tag, cz, ortho, rx, ry in shots:
                      look_camera(cz, ortho, rx, ry)
                      render(os.path.join(PREV, sub, f'{name}_{i:02d}_{tag}.png'))
              with open(os.path.join(PREV, sub, f'{name}.json'), 'w') as f:
                  json.dump([lk.get('nome', str(i)) for i, lk in enumerate(looks)], f)
      print(f'[build_all] {name}: {tris} tri, {time.time() - t0:.1f}s')


try:
    main()
except Exception:
    import traceback; traceback.print_exc(); sys.exit(1)
with open(os.path.join(OUT, '_report.json'), 'w') as f:
    json.dump(report, f, indent=1)
print('[build_all] fatto', len(report))
