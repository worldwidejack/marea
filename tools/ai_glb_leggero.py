# Modello generato con l'AI (glb) → glb leggero per il gioco: triangoli ridotti, texture rimpicciolita, scala in metri,
# origine al centro della base, asse lungo su X. Si lancia dentro Blender (MCP execute_blender_code o
# `blender -b -P tools/ai_glb_leggero.py -- in.glb out.glb tris lato_m tex`).
# Uso dall'MCP: exec(open('tools/ai_glb_leggero.py').read()); leggero(in, out, tris=3000, size_m=4.6, tex=512)
import bpy, sys, math


def leggero(src, dst, tris=3000, size_m=4.0, tex=512, along_x=True):
    for o in list(bpy.data.objects):
        if o.name.startswith("_leggero"):
            bpy.data.objects.remove(o, do_unlink=True)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=src)
    objs = [o for o in set(bpy.data.objects) - before if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = "_leggero"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # asse lungo su X (in glTF: X resta X, Y su diventa Z in Blender)
    d = o.dimensions
    if along_x and d.y > d.x:
        o.rotation_euler.z = math.pi / 2
        bpy.ops.object.transform_apply(rotation=True)
    # scala: lato più lungo in orizzontale = size_m
    d = o.dimensions
    s = size_m / max(d.x, d.y)
    o.scale = (s, s, s)
    bpy.ops.object.transform_apply(scale=True)
    # origine al centro della base
    xs = [v.co.x for v in o.data.vertices]; ys = [v.co.y for v in o.data.vertices]; zs = [v.co.z for v in o.data.vertices]
    cx, cy, z0 = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)
    for v in o.data.vertices:
        v.co.x -= cx; v.co.y -= cy; v.co.z -= z0
    # meno triangoli
    n0 = sum(len(p.vertices) - 2 for p in o.data.polygons)
    if n0 > tris:
        m = o.modifiers.new("dec", "DECIMATE")
        m.ratio = tris / n0
        bpy.ops.object.modifier_apply(modifier=m.name)
    n1 = sum(len(p.vertices) - 2 for p in o.data.polygons)
    # texture più piccola
    for mat in o.data.materials:
        if not mat or not mat.use_nodes:
            continue
        for nd in mat.node_tree.nodes:
            if nd.type == "TEX_IMAGE" and nd.image and max(nd.image.size) > tex:
                nd.image.scale(tex, tex)
                nd.image.pack()
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=dst, use_selection=True, export_format="GLB", export_image_format="JPEG", export_jpeg_quality=85, export_apply=True)
    dims = tuple(round(x, 2) for x in o.dimensions)
    bpy.data.objects.remove(o, do_unlink=True)
    return {"tris_prima": n0, "tris_dopo": n1, "dimensioni_m": dims}


if __name__ == "__main__" and "--" in sys.argv:
    a = sys.argv[sys.argv.index("--") + 1:]
    print(leggero(a[0], a[1], int(a[2]), float(a[3]), int(a[4])))
