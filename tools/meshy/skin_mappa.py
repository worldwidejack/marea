# La mappa pelle/capelli del protagonista (assets/ai/eroe/eroe_mappa.png): quali pixel della texture sono pelle e quali capelli, uguale per
# TUTTE le skin (stesse UV). Il gioco (apps/client/src/game/avatar_skin.ts) li ridipinge coi colori scelti nell'editor, su qualsiasi skin.
# Fatta sulla FORMA, non sul colore: i capelli hanno lo stesso marrone del contorno, dei guanti e della borsa, e la suola ha il colore della
# pelle. Ogni faccia di eroe_3000.glb è classificata per posizione (testa sopra le sopracciglia = capelli, viso/collo/avambracci/gambe =
# pelle, il resto niente), poi cotta sulle UV; dentro la zona contano solo i colori di quella zona (gli occhi, il rosso della cicatrice,
# la fascia non si toccano).
# Valori del PNG (grigio, R=G=B; si legge arrotondando valore / 50):
#   0 niente · 1 pelle · 2 pelle in ombra · 3 capelli · 4 capelli in luce
# Lancio:  blender -b -P tools/meshy/skin_mappa.py     (VISTA=<cartella> aggiunge le foto di controllo da 4 lati)
# Scrive assets/ai/eroe/eroe_mappa.png (la sorgente, la leggono skin_tinta.py e skin_bake.py) e la copia che serve il gioco,
# apps/client/public/assets/skin/mappa.png. Va rifatta solo se cambia la mesh o la texture di partenza (eroe_leggero.py).
import bpy, os, sys
import numpy as np
SP = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, SP)
RADICE = os.path.abspath(os.path.join(SP, '..', '..'))
GLB = os.path.join(RADICE, 'assets', 'ai', 'eroe', 'eroe_3000.glb')
TEX = os.path.join(RADICE, 'assets', 'ai', 'eroe', 'eroe_tex.png')
MAPPA = os.path.join(RADICE, 'assets', 'ai', 'eroe', 'eroe_mappa.png')
PUBBLICA = os.path.join(RADICE, 'apps', 'client', 'public', 'assets', 'skin', 'mappa.png')
MARGINE = 8   # pixel: come il bordo delle isole UV, che la cottura ha già allargato (skin_bake.py, margin 6)
PASSO = 50    # valore nel PNG = ruolo × PASSO

# i colori della texture di partenza (tools/meshy/skin_tinta.py --colori) per ruolo, dentro la zona della faccia
PELLE = {'E2B97F': 1}
OMBRA_PELLE = {'B8784C': 2, 'C98A4B': 2}
CAPELLI = {'2E1E14': 3}
LUCE_CAPELLI = {'8C5636': 4, '5A3A28': 4, '5A3A1E': 4}
TESTA = 1.0       # sopra, la testa; il collo sta tra 1,0 e 1,1
CAPELLI_DA = 1.09  # i capelli (nuca) iniziano qui; sotto, il colletto della giacca ha lo stesso marrone
SOPRACCIGLIA = 1.29


PELLE_OK, CAPELLI_OK = 1, 2   # cosa può diventare una faccia (maschera di bit): i suoi pixel di quel colore cambiano, gli altri restano


def classe(c, n, fs):
    """Cosa può diventare una faccia (PELLE_OK, CAPELLI_OK, o 0) dalla posizione (c), dalla normale (n) e da quanta pelle (fs) ha la sua texture."""
    z = c.z
    if z > TESTA:   # la testa: i pixel color pelle sono pelle ovunque (viso, orecchie, collo); quelli color capelli sono capelli tranne sul viso
        viso = abs(c.x) < 0.115 and n.y > 0.25 and 1.1 < z < SOPRACCIGLIA and c.y > 0.0   # occhi, sopracciglia e bocca restano coi loro colori
        return PELLE_OK | (0 if viso or z < CAPELLI_DA else CAPELLI_OK)
    if fs < 0.15: return 0
    if 0.13 < z < 0.34: return PELLE_OK                     # le gambe tra la scarpa e il risvolto (la suola, sotto 0,13, ha il colore della pelle ma non lo è)
    if abs(c.x) > 0.12 and 0.4 < z < 0.98: return PELLE_OK  # avambracci e dita fuori dai guanti (il ciondolo sul petto, al centro, non lo è)
    if abs(c.x) < 0.1 and z > 0.96: return PELLE_OK         # l'attaccatura del collo
    return 0


def leggi(percorso):
    """PNG → array H×W×3 uint8 (byte sRGB come sono, riga 0 in alto)."""
    im = bpy.data.images.load(percorso); im.colorspace_settings.name = 'Non-Color'
    w, h = im.size
    px = np.empty(w * h * 4, dtype=np.float32); im.pixels.foreach_get(px)
    bpy.data.images.remove(im)
    return np.rint(px.reshape(h, w, 4)[::-1, :, :3] * 255).astype(np.uint8)


def scrivi(percorso, a):
    """Array H×W (0-255) → PNG a 8 bit in grigio (riga 0 in alto), pochi KB: il gioco lo scarica a ogni avvio."""
    h, w = a.shape
    im = bpy.data.images.new('mappa', w, h, alpha=False); im.colorspace_settings.name = 'Non-Color'
    px = np.ones((h, w, 4), dtype=np.float32); px[:, :, :3] = (a[::-1, :, None] / 255.0)
    im.pixels.foreach_set(px.ravel())
    rs = bpy.context.scene.render.image_settings
    rs.file_format = 'PNG'; rs.color_mode = 'BW'; rs.color_depth = '8'; rs.compression = 100
    bpy.context.scene.view_settings.view_transform = 'Raw'   # i valori restano quelli: niente curva di colore
    im.save_render(percorso)
    bpy.data.images.remove(im)


def facce_su_uv(me, w, h):
    """Per ogni pixel l'indice della faccia che lo copre (−1 fuori dalle isole), poi allargato di MARGINE pixel come il bordo della texture."""
    uv = me.uv_layers[0].data
    idx = np.full((h, w), -1, dtype=np.int32)
    yy, xx = np.mgrid[0:h, 0:w]
    for p in me.polygons:
        P = np.array([(uv[l].uv[0] * w, (1 - uv[l].uv[1]) * h) for l in p.loop_indices])
        x0, y0 = np.floor(P.min(0)).astype(int).clip(0, [w - 1, h - 1]); x1, y1 = np.ceil(P.max(0)).astype(int).clip(0, [w - 1, h - 1])
        X, Y = xx[y0:y1 + 1, x0:x1 + 1] + 0.5, yy[y0:y1 + 1, x0:x1 + 1] + 0.5
        a, b, c = P[0], P[1], P[2]
        d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(d) < 1e-9: continue
        l1 = ((b[1] - c[1]) * (X - c[0]) + (c[0] - b[0]) * (Y - c[1])) / d
        l2 = ((c[1] - a[1]) * (X - c[0]) + (a[0] - c[0]) * (Y - c[1])) / d
        m = (l1 >= 0) & (l2 >= 0) & (l1 + l2 <= 1)
        sub = idx[y0:y1 + 1, x0:x1 + 1]; sub[m] = p.index
        if not m.any():  # faccia più piccola di un pixel: almeno quello sotto il suo centro
            cy, cx = int(P[:, 1].mean()) % h, int(P[:, 0].mean()) % w
            if idx[cy, cx] < 0: idx[cy, cx] = p.index
    for _ in range(MARGINE):
        vuoti = idx < 0
        if not vuoti.any(): break
        pad = np.pad(idx, 1, constant_values=-1)
        nuovo = idx.copy()
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
            vic = pad[1 + dy:1 + dy + h, 1 + dx:1 + dx + w]
            prendi = vuoti & (nuovo < 0) & (vic >= 0)
            nuovo[prendi] = vic[prendi]
        idx = nuovo
    return idx


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=GLB)
    ob = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]; me = ob.data
    tex = leggi(TEX); h, w = tex.shape[:2]
    idx = facce_su_uv(me, w, h)
    hexs = np.array([('%02X%02X%02X' % tuple(p)) for p in tex.reshape(-1, 3)]).reshape(h, w)
    n = len(me.polygons); dentro = idx >= 0
    quota = lambda tab: np.bincount(idx[dentro], weights=np.isin(hexs, list(tab))[dentro], minlength=n) / np.maximum(np.bincount(idx[dentro], minlength=n), 1)
    fs = quota({**PELLE, **OMBRA_PELLE})
    zone = [classe(p.center, p.normal, fs[p.index]) for p in me.polygons]
    zona = np.array(zone)[np.maximum(idx, 0)] * dentro
    ruolo = np.zeros((h, w), dtype=np.uint8)
    for bit, tab in ((PELLE_OK, {**PELLE, **OMBRA_PELLE}), (CAPELLI_OK, {**CAPELLI, **LUCE_CAPELLI})):
        for col, r in tab.items(): ruolo[((zona & bit) != 0) & (hexs == col)] = r
    scrivi(MAPPA, ruolo.astype(np.int32) * PASSO)
    os.makedirs(os.path.dirname(PUBBLICA), exist_ok=True); scrivi(PUBBLICA, ruolo.astype(np.int32) * PASSO)
    for r, nome in ((1, 'pelle'), (2, 'pelle in ombra'), (3, 'capelli'), (4, 'capelli in luce')): print('RUOLO', nome, int((ruolo == r).sum()), 'pixel')
    print('FACCE', {z: zone.count(z) for z in sorted(set(zone))})
    if os.environ.get('VISTA'): foto_controllo(me, tex, ruolo, os.environ['VISTA'])


def foto_controllo(me, tex, ruolo, cartella):
    """4 foto del modello con la mappa sopra (pelle rosa, ombra magenta, capelli verde, luce giallo; il resto grigio scuro)."""
    import vista
    os.makedirs(cartella, exist_ok=True)
    h, w = ruolo.shape
    col = {0: (0.18, 0.18, 0.2), 1: (1.0, 0.55, 0.65), 2: (0.7, 0.1, 0.5), 3: (0.1, 0.8, 0.2), 4: (0.95, 0.9, 0.1)}
    px = np.ones((h, w, 4), dtype=np.float32)
    for r, c in col.items(): px[ruolo[::-1] == r, :3] = c
    for hx in ('E2B97F', 'B8784C', 'C98A4B', '2E1E14'):   # il colore di pelle/capelli rimasto fuori zona: azzurro (pelle) e arancio (capelli)
        c = tuple(int(hx[i:i + 2], 16) for i in (0, 2, 4))
        fuori = (tex == c).all(axis=2) & (ruolo == 0)
        print('FUORI', hx, int(fuori.sum()))
        if hx != '2E1E14': px[fuori[::-1], :3] = (0.1, 0.9, 0.95)
    im = bpy.data.images.new('ctrl', w, h, alpha=False); im.pixels.foreach_set(px.ravel())
    nt = me.materials[0].node_tree
    for n in nt.nodes:
        if n.type == 'TEX_IMAGE': n.image = im; n.interpolation = 'Closest'
    vista.foto(os.path.join(cartella, 'mappa'), viste=(('f', 180), ('l', 90), ('d', 0), ('r', 270)), w=500, h=760, centro=(0, 0, 0.81), alt=1.9)


main()
