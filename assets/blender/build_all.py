# MAREA — costruisce tutti i modelli procedurali, li esporta in glb e ne fa l'anteprima.
# Uso: Blender -b -P assets/blender/build_all.py -- <atlas.png> <out_glb_dir> <out_preview_dir> [nomi...] [--no-preview]
import json, math, os, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [HERE, os.path.join(HERE, '..', '..', 'tools')]
import bpy
import lib, export_gltf
import models_terreno, models_edifici, models_prop, models_chr

argv = sys.argv[sys.argv.index('--') + 1:]
flags = {a for a in argv if a.startswith('--')}
args = [a for a in argv if not a.startswith('--')]
lib.ATLAS_PNG, OUT, PREV = os.path.abspath(args[0]), os.path.abspath(args[1]), os.path.abspath(args[2])
only = set(args[3:])
REG = {}
for m in (models_terreno, models_edifici, models_prop, models_chr):
    REG.update(m.MODELS)


def setup_preview(objs, name, extra_frames=()):
    sc = bpy.context.scene
    try:
        sc.render.engine = 'BLENDER_EEVEE'
    except TypeError:
        sc.render.engine = 'BLENDER_WORKBENCH'
    sc.render.resolution_x = sc.render.resolution_y = 384
    sc.render.film_transparent = False
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


def main():
  for name, fn in REG.items():
      if only and name not in only:
          continue
      t0 = time.time()
      lib.reset()
      res = fn()
      objs, info = (res if isinstance(res, tuple) else (res, {}))
      clips = info.get('clips')
      glb = export_gltf.export(os.path.join(OUT, name + '.glb'), objs, animations=bool(clips))
      tris = sum(len(p.vertices) - 2 for ob in objs if ob.type == 'MESH' for p in ob.data.polygons)
      report[name] = {'tris_blender': tris, **info}
      if '--no-preview' not in flags:
          setup_preview(objs, name)
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
      print(f'[build_all] {name}: {tris} tri, {time.time() - t0:.1f}s')


try:
    main()
except Exception:
    import traceback; traceback.print_exc(); sys.exit(1)
with open(os.path.join(OUT, '_report.json'), 'w') as f:
    json.dump(report, f, indent=1)
print('[build_all] fatto', len(report))
