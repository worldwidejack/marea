# Una skin con un disegno nuovo (non solo tinte): la retexture di Meshy del protagonista, cotta sulle UV del modello del gioco.
# Il flusso (le skin sono texture da 512 px con le stesse UV di assets/ai/eroe/eroe_3000.glb):
#   1. Meshy: meshy_retexture sul task del protagonista (input_task_id = il multi-image-to-3d), text_style_prompt o immagine di stile → nuovo glb
#      (la geometria resta la stessa, cambia solo il colore; 10 crediti), si scarica in assets/prova_meshy/eroe2/ (non nel repo: pesa 26 MB);
#   2. ALTA=<glb della skin> ID=<id> blender -b -P tools/meshy/skin_bake.py   → OUT/skin_<id>_cotta.png (colori della palette, 512 px)
#   3. python3 tools/meshy/skin_tinta.py --png8 <id> OUT/skin_<id>_cotta.png    → apps/client/public/assets/skin/<id>.png (PNG a palette, pochi KB)
#   4. una voce in packages/content/src/avatar.json `abiti` con "skin": "<id>" (nome e prezzo): la vende il Mercante, il client cambia la texture.
# Pelle e capelli non sono della skin: assets/ai/eroe/eroe_mappa.png (skin_mappa.py) li segna, il gioco li ridipinge coi colori dell'editor e qui
# tornano com'erano nella texture di partenza (la fantasia di Meshy lì non conta: nel prompt viso e capelli restano semplici).
# Con ALTA = il glb originale di Meshy esce la texture di partenza (prova che UV e allineamento tornano).
import bpy, os, sys, math
import numpy as np
SP = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, SP)
import eroe_leggero, eroe_palette

ALTA, ID, OUT = os.environ['ALTA'], os.environ['ID'], os.environ.get('OUT', os.path.join(SP, '..', '..', 'assets', 'prova_meshy', 'eroe2', 'out'))
ALTEZZA = float(os.environ.get('ALTEZZA', '1.62')); RES = int(os.environ.get('RES', '512')); K = int(os.environ.get('K', '20'))
BASE = os.path.abspath(os.path.join(SP, '..', '..', 'assets', 'ai', 'eroe', 'eroe_3000.glb'))
bpy.ops.wm.read_factory_settings(use_empty=True)
high = eroe_leggero.allinea(ALTA, ALTEZZA)
bpy.ops.import_scene.gltf(filepath=BASE)
low = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o is not high][0]
low.name = 'chr_eroe'
# la texture vuota da cuocere sul materiale del modello leggero
img = bpy.data.images.new('skin_' + ID, RES, RES, alpha=False)
mat = bpy.data.materials.new('mat_skin'); mat.use_nodes = True
nt = mat.node_tree; tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = img; tx.interpolation = 'Closest'; nt.nodes.active = tx
low.data.materials.clear(); low.data.materials.append(mat)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 8
sc.render.bake.use_pass_direct = False; sc.render.bake.use_pass_indirect = False; sc.render.bake.use_pass_color = True; sc.render.bake.margin = 6
bpy.ops.object.select_all(action='DESELECT'); high.select_set(True); low.select_set(True); bpy.context.view_layer.objects.active = low
bpy.ops.object.bake(type='DIFFUSE', use_selected_to_active=True, cage_extrusion=0.03, max_ray_distance=0.12)
os.makedirs(OUT, exist_ok=True)
cotta = os.path.join(OUT, f'skin_{ID}_cotta.png')
img.filepath_raw = cotta; img.file_format = 'PNG'; img.save()
nc = bpy.data.images.load(cotta); nc.colorspace_settings.name = 'Non-Color'
print('COLORI', eroe_palette.quantizza(nc, K))
# pelle e capelli non sono della skin: la mappa (skin_mappa.py) li segna e il gioco li ridipinge coi colori dell'editor; qui tornano come nella texture di partenza
def pixel(im):
    a = np.empty(im.size[0] * im.size[1] * 4, dtype=np.float32); im.pixels.foreach_get(a); return a.reshape(im.size[1], im.size[0], 4)
def leggi(nome):
    im = bpy.data.images.load(os.path.join(os.path.dirname(BASE), nome)); im.colorspace_settings.name = 'Non-Color'; return pixel(im)
zone, partenza, px = leggi('eroe_mappa.png')[:, :, 0] > 0.1, leggi('eroe_tex.png'), pixel(nc)   # la mappa è grigia: valore / 50 = ruolo, 0,196 il più basso
px[zone] = partenza[zone]; nc.pixels.foreach_set(px.ravel()); nc.update()
nc.filepath_raw = os.path.join(OUT, f'skin_{ID}_cotta.png'); nc.file_format = 'PNG'; nc.save()
print('SKIN', nc.filepath_raw)
