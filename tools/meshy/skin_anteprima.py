# I disegni delle skin per il menù del Mercante e la Borsa: il protagonista con la skin addosso, 192×192 con lo sfondo trasparente, dalla stessa
# angolazione dei vestiti (assets/blender/anteprime_abiti.py). Una passata per tutte le skin di apps/client/public/assets/skin/*.png.
# Lancio:  blender -b -P tools/meshy/skin_anteprima.py   → apps/client/public/assets/skin/<id>_anteprima.png
import bpy, os, glob, math
from mathutils import Vector
SP = os.path.dirname(os.path.abspath(__file__)); RADICE = os.path.abspath(os.path.join(SP, '..', '..'))
SKIN = os.path.join(RADICE, 'apps', 'client', 'public', 'assets', 'skin')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(RADICE, 'assets', 'ai', 'eroe', 'eroe_3000.glb'))
mesh = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
nt = mesh.data.materials[0].node_tree
tx = [n for n in nt.nodes if n.type == 'TEX_IMAGE'][0]; tx.interpolation = 'Closest'
sc = bpy.context.scene; sc.render.engine = 'BLENDER_WORKBENCH'
sh = sc.display.shading; sh.light = 'FLAT'; sh.color_type = 'TEXTURE'; sh.show_object_outline = False
sc.render.film_transparent = True; sc.render.resolution_x = sc.render.resolution_y = 192
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
sc.view_settings.view_transform = 'Standard'
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 1.95
yaw, pitch, d = math.radians(-30), math.radians(20), 8.0   # da davanti (il protagonista guarda +Y), un po' di lato e dall'alto
c = Vector((0, 0, 0.8))
cam.location = c + Vector((math.sin(yaw) * math.cos(pitch) * d, math.cos(yaw) * math.cos(pitch) * d, math.sin(pitch) * d))
cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
for f in sorted(glob.glob(os.path.join(SKIN, '*.png'))):
    nome = os.path.basename(f)[:-4]
    if nome.endswith('_anteprima') or nome == 'mappa': continue   # mappa.png non è una skin (skin_mappa.py)
    img = bpy.data.images.load(f); img.alpha_mode = 'NONE'; tx.image = img
    sc.render.filepath = os.path.join(SKIN, nome + '_anteprima.png')
    bpy.ops.render.render(write_still=True); print('ANTEPRIMA', nome)
