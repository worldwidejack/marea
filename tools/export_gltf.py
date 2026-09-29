# WP5: esportazione glTF da Blender headless (Y su, −Z avanti, modificatori applicati, niente Draco).
# Uso 1 (contratto): Blender -b <file>.blend -P tools/export_gltf.py -- <cartella_out>   → <cartella_out>/<nome_blend>.glb
# Uso 2 (libreria): import export_gltf; export_gltf.export(path, objects, animations=False)
import os, sys
import bpy


def export(path, objects=None, animations=False):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.context.view_layer.update()
    for ob in bpy.context.scene.objects:
        ob.select_set(objects is None or ob in objects)
    kw = dict(filepath=path, export_format='GLB', use_selection=objects is not None, export_apply=True, export_yup=True,
              export_texcoords=True, export_normals=True, export_materials='EXPORT', export_cameras=False, export_lights=False,
              export_animations=animations, export_extras=False)
    if animations:
        kw.update(export_animation_mode='ACTIONS', export_force_sampling=True, export_frame_step=1,
                  export_optimize_animation_size=True, export_anim_single_armature=True, export_reset_pose_bones=True)
    try:
        bpy.ops.export_scene.gltf(**kw, export_draco_mesh_compression_enable=False)
    except TypeError:
        bpy.ops.export_scene.gltf(**kw)
    print('[export_gltf] scritto', path)
    return path


if __name__ == '__main__' and bpy.data.filepath:
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = argv[0] if argv else os.path.join(os.getcwd(), 'assets', 'export')
    name = os.path.splitext(os.path.basename(bpy.data.filepath))[0] or 'scena'
    export(os.path.join(out, name + '.glb'), None, animations=bool(bpy.data.actions))
