# WP5: esportazione glTF da Blender headless. Uso: Blender -b <file>.blend -P tools/export_gltf.py -- <cartella_out>
# Segnaposto (WP0): esporta tutta la scena in glb con nome del file.
import bpy, sys, os
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
out = argv[0] if argv else os.path.join(os.getcwd(), "assets", "export")
os.makedirs(out, exist_ok=True)
name = os.path.splitext(os.path.basename(bpy.data.filepath))[0] or "scena"
bpy.ops.export_scene.gltf(filepath=os.path.join(out, name + ".glb"), export_format="GLB", export_apply=True, export_yup=True)
print("[export_gltf] scritto", os.path.join(out, name + ".glb"))
