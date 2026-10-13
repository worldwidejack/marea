# MAREA — giro attorno all'avatar come lo sheet di Jack (#283): fronte, 3/4, lato, retro + pose, su fondo grigio chiaro.
# Uso: Blender -b -P tools/avatar_giro.py -- <atlas.png> <cartella_out> [indice_look | json]   (look: DEFAULT_LOOK, VARIANTS[i] o pezzi da cambiare)
# Esce <out>/giro.png (4 viste + 3 pose) e <out>/viso.png (primi piani). Serve per confrontare il modello con assets/concept/avatar/.
import math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [os.path.join(HERE, '..', 'assets', 'blender'), HERE]
import bpy, mathutils
import lib, models_chr

argv = sys.argv[sys.argv.index('--') + 1:]
lib.ATLAS_PNG, OUT = os.path.abspath(argv[0]), os.path.abspath(argv[1])
os.makedirs(OUT, exist_ok=True)
lib.reset()
objs, info = models_chr.chr_base()
import json
look = info['look'] if len(argv) < 3 else json.loads(argv[2]) if argv[2].startswith('{') else info['variants'][int(argv[2])]
look = {**info['look'], **look}
models_chr.apply_look(objs, look)
rig = next(o for o in objs if o.type == 'ARMATURE')

sc = bpy.context.scene
try:
    sc.render.engine = 'BLENDER_EEVEE'
except TypeError:
    sc.render.engine = 'BLENDER_WORKBENCH'
try:
    sc.view_settings.view_transform = 'Standard'
except TypeError:
    pass
sc.render.film_transparent = False
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
bg.inputs['Color'].default_value = (0.62, 0.64, 0.68, 1); bg.inputs['Strength'].default_value = 1.0
sun = bpy.data.lights.new('sole', 'SUN'); sun.energy = 3.0; sun.color = (1.0, 0.92, 0.8); sun.angle = 0.1
so = bpy.data.objects.new('sole', sun); sc.collection.objects.link(so)
so.rotation_euler = (math.radians(40), 0, math.radians(200))
cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'
co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co


def shot(path, yaw, cz, ortho, rx, ry, pitch=4):
    sc.render.resolution_x, sc.render.resolution_y = rx, ry
    cam.ortho_scale = ortho
    y, p, d = math.radians(yaw), math.radians(pitch), 8.0
    c = mathutils.Vector((0, 0, cz))
    co.location = c + mathutils.Vector((math.sin(y) * math.cos(p) * d, math.cos(y) * math.cos(p) * d, math.sin(p) * d))
    co.rotation_euler = (c - co.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


def clip(name, frame):
    if name is None:
        rig.animation_data.action = None
        for pb in rig.pose.bones:
            pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
        sc.frame_set(0)
        return
    act = bpy.data.actions[name]
    rig.animation_data.action = act
    try:
        rig.animation_data.action_slot = act.slots[0]
    except Exception:
        pass
    sc.frame_set(frame)


tmp = os.path.join(OUT, '_pezzi'); os.makedirs(tmp, exist_ok=True)
files = []
clip(None, 0)
for i, yaw in enumerate((0, -35, -90, 180)):  # davanti = +Y di Blender
    f = os.path.join(tmp, f'v{i}.png'); shot(f, yaw, 0.82, 1.85, 300, 560); files.append(f)
for i, (cl, fr) in enumerate((('walk', 4), ('run', 4), ('sit', 0))):
    clip(cl, fr)
    f = os.path.join(tmp, f'p{i}.png'); shot(f, -35, 0.82, 1.85, 300, 560); files.append(f)
clip(None, 0)
vis = []
for i, yaw in enumerate((0, -35, -90)):
    f = os.path.join(tmp, f'f{i}.png'); shot(f, yaw, 1.47, 0.5, 360, 360, pitch=2); vis.append(f)
with open(os.path.join(OUT, '_pezzi.txt'), 'w') as fh:
    fh.write('\n'.join(files) + '\n#\n' + '\n'.join(vis) + '\n')
print('[avatar_giro] fatto')
