# Texture cotta da Meshy → pochi colori, tutti della palette del gioco (docs/ART_BIBLE.md: 24 colori + 6 pelli).
# k-means a K gruppi, ogni gruppo al colore più vicino della palette (le zone piatte restano di un colore solo), poi moda 3×3 contro le macchioline
# (il centro pesa 3: occhi e cicatrice sottili restano). Gira dentro Blender (bpy + numpy).
import numpy as np

PAL = '''F4E3C1 E2B97F C98A4B 8E5A2B 5A3A1E 2E1E14 D9E872 8FC35B 4E9A46 2C6B3F 1E4A3A 7FE3E0 3FB9C9 2478A8 163F73 E8E1D6 B9AFA3 7F7568 4A4340 23201F E8433F F2A33A F5D547 A64DFF FBE2C8 EFC29B D9A070 B8784C 8C5636 5A3A28'''.split()
PALRGB = np.array([[int(h[i:i + 2], 16) for i in (0, 2, 4)] for h in PAL], dtype=np.float32)


def oklab(rgb):
    """sRGB 0-255 (N×3) → OKLab: le distanze somigliano a come l'occhio vede i colori (il blu dei jeans non finisce nel marrone scuro)."""
    c = rgb / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    l = np.cbrt(c @ np.array([0.4122214708, 0.5363325363, 0.0514459929]))
    m = np.cbrt(c @ np.array([0.2119034982, 0.6806995451, 0.1073969566]))
    s = np.cbrt(c @ np.array([0.0883024619, 0.2817188376, 0.6299787005]))
    return np.stack([0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
                     0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s], axis=1)


CROMA = 2.2   # la tinta pesa più della luce: il blu scuro dei jeans resta blu e non diventa il nero del contorno
BLU = ('163F73', '2478A8', '3FB9C9', '7FE3E0')
PALLAB = oklab(PALRGB) * np.array([1, CROMA, CROMA])


def quantizza(img, K=16, seed=7):
    """Rifà i pixel di `img` (immagine di Blender, colorspace Non-Color) con ≤ K colori della palette. Ritorna la lista (esadecimale, pixel) dei colori usati."""
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32); img.pixels.foreach_get(px); px = px.reshape(-1, 4)
    rgb = px[:, :3] * 255.0   # l'immagine va letta 'Non-Color': i byte dell'sRGB come sono

    def vicini(lab):
        d = ((lab[:, None, :] - PALLAB[None, :, :]) ** 2).sum(axis=2)
        # blu e verde-acqua anche scuri (i jeans) vanno su un blu della palette, non sul nero del contorno: la palette non ha un blu-grigio
        croma, tinta = np.hypot(lab[:, 1], lab[:, 2]) / CROMA, np.degrees(np.arctan2(lab[:, 2], lab[:, 1])) % 360
        blu = (croma > 0.028) & (tinta > 180) & (tinta < 290)
        d[np.ix_(blu, [i for i in range(len(PAL)) if PAL[i] not in BLU])] = 1e9
        return d.argmin(axis=1)
    lab_px = oklab(rgb) * np.array([1, CROMA, CROMA])
    rng = np.random.default_rng(seed)
    buoni = np.flatnonzero(rgb.sum(axis=1) > 60)   # il nero fuori dalle isole UV non conta
    sub = lab_px[rng.choice(buoni, 40000, replace=False)]
    cen = sub[rng.choice(len(sub), K, replace=False)].copy()
    for _ in range(20):
        g = ((sub[:, None, :] - cen[None, :, :]) ** 2).sum(axis=2).argmin(axis=1)
        for k in range(K):
            m = g == k
            if m.any(): cen[k] = sub[m].mean(axis=0)
    g_all = np.concatenate([((lab_px[i:i + 100000, None, :] - cen[None, :, :]) ** 2).sum(axis=2).argmin(axis=1) for i in range(0, len(lab_px), 100000)])
    cen_pal = vicini(cen)
    im = cen_pal[g_all].reshape(h, w)
    for _ in range(2):
        cnt = np.zeros((len(PAL), h, w), dtype=np.int16)
        pad = np.pad(im, 1, mode='edge')
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                sh = pad[1 + dy:1 + dy + h, 1 + dx:1 + dx + w]
                wt = 3 if (dy == 0 and dx == 0) else 1
                for k in np.unique(sh):
                    cnt[k] += wt * (sh == k)
        im = cnt.argmax(axis=0)
    idx = im.reshape(-1)
    px[:, :3] = PALRGB[idx] / 255.0; px[:, 3] = 1.0
    img.pixels.foreach_set(px.ravel()); img.update()
    usati = np.bincount(idx, minlength=len(PAL))
    return [(PAL[i], int(usati[i])) for i in np.argsort(-usati) if usati[i]]
