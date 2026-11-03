# libreria: foto del modello in Workbench (luce piatta, colori della texture), da davanti/lato/dietro
import bpy, math, os
from mathutils import Vector

def foto(path_base, viste=(('f', 0), ('l', 90), ('d', 180)), w=420, h=620, centro=(0, 0, 0.79), alt=1.75, flat=True):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sh = sc.display.shading
    sh.light = 'FLAT' if flat else 'STUDIO'
    sh.color_type = 'TEXTURE'
    sh.show_object_outline = False
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.film_transparent = False
    sc.world = bpy.data.worlds.new('w') if sc.world is None else sc.world
    sc.world.color = (0.82, 0.88, 0.9)
    cam = bpy.data.objects.get('cam') or bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    if cam.name not in sc.collection.objects: sc.collection.objects.link(cam)
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = alt
    sc.camera = cam
    out = []
    for nome, ang in viste:
        a = math.radians(ang)
        # davanti = −Y in Blender (gioco −Z); la camera sta a −Y guardando +Y
        pos = Vector((math.sin(a) * 6, -math.cos(a) * 6, centro[2]))
        cam.location = pos
        d = Vector(centro) - pos
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        p = f'{path_base}_{nome}.png'
        sc.render.filepath = p
        bpy.ops.render.render(write_still=True)
        out.append(p)
    return out
