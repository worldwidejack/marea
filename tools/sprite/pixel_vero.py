#!/usr/bin/env python3
"""pixel_vero: dal disegno dell'AI alla pixel art vera (laboratorio sprite, 3/11/2026).

Perché: Codex e ChatGPT fanno pixel art «finta», un'immagine grande con quadretti di misura irregolare e bordi sfumati.
Rimpicciolirla facendo la media (come pixel_sprite.py) mescola due quadretti in ogni pixel nuovo: contorno spezzato,
occhi a grumo, macchioline. Qui tre metodi, per confrontarli nel gioco:
  media    quello di prima: media d'area all'altezza voluta, poi tavolozza e contorno (pixel_sprite.py)
  griglia  trova la griglia dei quadretti finti (il passo e dove cadono i bordi, riga per riga e colonna per colonna,
           anche se la griglia «balla») e prende il colore di ogni quadretto: la pixel art che l'AI voleva disegnare,
           alla SUA misura (non si sceglie l'altezza)
  hd       da un disegno pulito non a pixel (contorno e campiture) a qualsiasi altezza: in ogni cella il colore che vince
           (k-medie a 2 nella cella, il gruppo più grande, il contorno pesa di più), poi tavolozza comune e pulizia
Dopo ogni metodo: tavolozza comune a tutto il set (k-medie in Lab), pixel orfani tolti, contorno di 1 pixel.

Uso (python del venv di Fenaki):
  strumenti/pixel_vero.py set <metodo> [--alto N] [--nome NOME]   → public/lab/<nome>/ (9 viste × 12 come sprite_pixel)
  strumenti/pixel_vero.py atelier <personaggio dell'Atelier> <metodo> --alto N --nome NOME --uscita <cartella dei set>
  strumenti/pixel_vero.py foglio <immagine> <metodo> [--alto N] [--righe 3 --colonne 4]   → concept/lab/ (solo foglio)
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

QUI = os.path.dirname(os.path.abspath(__file__))
RADICE = os.path.join(QUI, '..')
SRC = os.path.join(RADICE, 'concept', 'sprite_pixel')
VISTE = ['S', 'SSE', 'SE', 'ESE', 'E', 'ENE', 'NE', 'NNE', 'N']
RIGHE = ['cammina', 'scatto', 'bevi']
INCHIOSTRO = np.array([21, 16, 14], np.float64)
ALTO_MONDO = 48 / 19.2  # il protagonista è alto 2,5 unità di mondo, a ogni densità


def arg(nome, d=None, tipo=str):
    return tipo(sys.argv[sys.argv.index(nome) + 1]) if nome in sys.argv else d


# ── lettura dei fogli ──

def alfa_magenta(rgb):
    r, g, b = [rgb[..., i].astype(np.float32) for i in range(3)]
    return 1 - np.clip((np.minimum(r, b) - g - 60) / 80, 0, 1)


def celle(im, righe=3, colonne=4):
    """Le figure del foglio: per ogni cella il ritaglio RGBA (alfa dal magenta) e il fondo della figura nella cella."""
    rgb = np.array(im.convert('RGB'))
    rgba = np.array(im.convert('RGBA'))
    # fogli già scontornati (quelli dell'Atelier) o su fondo magenta (quelli di Codex appena fatti)
    a = rgba[..., 3].astype(np.float32) / 255 if rgba[..., 3].min() < 128 else alfa_magenta(rgb)
    H, W = a.shape
    out = []
    for r in range(righe):
        for c in range(colonne):
            y0, y1, x0, x1 = r * H // righe, (r + 1) * H // righe, c * W // colonne, (c + 1) * W // colonne
            m = (a[y0:y1, x0:x1] > 0.5).astype(np.uint8)
            n, lab, st, _ = cv2.connectedComponentsWithStats(m)
            if n < 2:
                out.append(None)
                continue
            k = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
            vicino = cv2.dilate((lab == k).astype(np.uint8), np.ones((9, 9), np.uint8))
            tieni = np.isin(lab, [i for i in range(1, n) if i == k or (vicino[lab == i].any() and st[i, cv2.CC_STAT_AREA] > 40)])
            ys, xs = np.where(tieni)
            ya, yb, xa, xb = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
            alfa = a[y0:y1, x0:x1] * tieni
            rgba = np.dstack([rgb[y0:y1, x0:x1][ya:yb, xa:xb], (alfa[ya:yb, xa:xb] * 255).astype(np.uint8)])
            out.append({'rgba': rgba, 'fondo': yb, 'riga': r, 'col': c})
    return out


def da_png(f):
    """Un disegno su trasparente (o su bianco) → RGBA ritagliato."""
    im = Image.open(f).convert('RGBA')
    a = np.array(im)
    if a[..., 3].min() == 255:  # niente alfa: fondo bianco
        a[..., 3] = np.where(a[..., :3].min(-1) > 245, 0, 255)
    ys, xs = np.where(a[..., 3] > 127)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def lab(rgb):
    return cv2.cvtColor(np.ascontiguousarray(rgb, np.float32) / 255, cv2.COLOR_RGB2Lab).astype(np.float64)


# ── la griglia dei quadretti finti ──

def energia(rgba):
    """Quanto cambia il colore fra una colonna e la successiva (Ex) e fra una riga e la successiva (Ey)."""
    L = lab(rgba[..., :3]) * (rgba[..., 3:4] / 255) + (1 - rgba[..., 3:4] / 255) * np.array([0, 60, -60])
    gx = np.abs(np.diff(L, axis=1)).sum(-1)
    gy = np.abs(np.diff(L, axis=0)).sum(-1)
    return gx.sum(0), gy.sum(1)


def periodo(E, lo=3, hi=40):
    """Il passo della griglia: il primo picco forte dell'autocorrelazione dei bordi."""
    e = E - E.mean()
    ac = np.array([(e[:-k] * e[k:]).mean() for k in range(1, hi + 1)])
    ac /= ac.max() if ac.max() > 0 else 1
    best = max(range(lo, hi), key=lambda k: ac[k - 1] - 0.002 * k)
    # un multiplo del passo vero ha lo stesso picco: si prende il più piccolo che vale quasi quanto il migliore
    for k in range(lo, best):
        if ac[k - 1] > 0.85 * ac[best - 1] and ac[k - 1] >= ac[k - 2] and ac[k - 1] >= ac[k]:
            return k
    return best


def tagli(E, p, giu=0.7, su=1.35):
    """Dove cadono i bordi dei quadretti (programmazione dinamica): bordi distanti fra giu·p e su·p, sulle linee dove il
    colore cambia di più. E[i] = cambio fra la colonna i e i+1 → taglio in i+1. Ritorna i tagli, 0 e len compresi."""
    n = len(E) + 1
    a, b = max(1, int(round(giu * p))), max(2, int(round(su * p)))
    score = np.full(n + 1, -1e18)
    prima = np.full(n + 1, -1)
    val = np.concatenate([[0], E, [0]])  # val[t] = forza di un taglio in t
    val = val - 0.6 * np.median(E[E > 0]) if (E > 0).any() else val  # ogni taglio costa: solo dove il colore cambia davvero
    for t in range(0, min(b, n) + 1):
        score[t] = val[t] - 0.05 * abs(t - p) * np.abs(val).mean()
    for t in range(1, n + 1):
        for d in range(a, b + 1):
            s = t - d
            if s < 0:
                break
            v = score[s] + val[t] - 0.05 * abs(d - p) * np.abs(val).mean()
            if v > score[t]:
                score[t], prima[t] = v, s
    # l'ultimo taglio entro un passo dalla fine
    fine = max(range(max(0, n - b), n + 1), key=lambda t: score[t])
    out = [fine]
    while prima[out[-1]] >= 0:
        out.append(prima[out[-1]])
    out = sorted(set(out) | {0, n})
    # pezzetti ai bordi più corti di mezzo passo: via (sono il bordo sfumato)
    if len(out) > 2 and out[1] - out[0] < p / 2:
        out.pop(1)
    if len(out) > 2 and out[-1] - out[-2] < p / 2:
        out.pop(-2)
    return out


def linee(E, p, fase):
    """Le linee di una griglia regolare di passo p (con la virgola) che parte da fase, dentro 0..len(E)+1."""
    n = len(E) + 1
    return np.arange(fase, n + 1e-6, p)


def forza(E, xs):
    """Il cambio di colore medio sulle linee (interpolato fra le colonne vicine)."""
    val = np.concatenate([[0], E, [0]])
    i = np.clip(xs, 0, len(val) - 1)
    f, c = np.floor(i).astype(int), np.ceil(i).astype(int)
    w = i - f
    return (val[f] * (1 - w) + val[c] * w).mean() if len(i) else 0


def miglior_fase(E, p):
    fasi = np.arange(0, p, 0.25)
    sc = [forza(E, linee(E, p, f)) for f in fasi]
    k = int(np.argmax(sc))
    return fasi[k], sc[k]


def aggancia(E, xs, p):
    """Ogni linea al bordo vero più forte entro un quarto di passo: il numero di pixel non cambia."""
    val = np.concatenate([[0], E, [0]])
    out = []
    r = max(1, int(p / 4))
    for x in xs:
        x0 = int(round(x))
        lo, hi = max(0, x0 - r), min(len(val) - 1, x0 + r)
        cand = np.arange(lo, hi + 1)
        # vince il bordo più forte, a pari forza il più vicino alla linea regolare
        k = cand[np.argmax(val[cand] - 0.01 * np.abs(cand - x) * val.mean())]
        out.append(int(k))
    out = sorted(set([0] + out + [len(val) - 1]))
    # via i pezzetti più corti di mezzo passo (bordi sfumati)
    pul = [out[0]]
    for x in out[1:]:
        if x - pul[-1] >= p / 2:
            pul.append(x)
        else:
            pul[-1] = x if x == out[-1] else pul[-1]
    return pul


def defake(rgba, p):
    """La pixel art vera dentro quella finta: griglia regolare di passo p con la fase migliore, linee agganciate ai bordi
    veri, un pixel per quadretto col colore al centro (mediana del 60% interno)."""
    Ex, Ey = energia(rgba)
    xs = aggancia(Ex, linee(Ex, p, miglior_fase(Ex, p)[0]), p)
    ys = aggancia(Ey, linee(Ey, p, miglior_fase(Ey, p)[0]), p)
    H, W = len(ys) - 1, len(xs) - 1
    C = np.zeros((H, W, 3))
    A = np.zeros((H, W), bool)
    for j in range(H):
        y0, y1 = ys[j], ys[j + 1]
        my = max(0, int((y1 - y0) * 0.2))
        for i in range(W):
            x0, x1 = xs[i], xs[i + 1]
            mx = max(0, int((x1 - x0) * 0.2))
            blk = rgba[y0 + my:y1 - my or y1, x0 + mx:x1 - mx or x1]
            if blk.size == 0:
                blk = rgba[y0:y1, x0:x1]
            al = blk[..., 3].reshape(-1)
            A[j, i] = (al > 127).mean() > 0.5
            pieni = blk[..., :3].reshape(-1, 3)[al > 127]
            C[j, i] = np.median(pieni, 0) if len(pieni) else 0
    return C, A, (xs, ys)


# ── da un disegno HD ──

INK_L = 12  # sotto questa luce (Lab) è inchiostro: contorni, linee interne, pupille (i capelli scuri stanno sopra, 20-25)


def scheletro(m):
    """Lo scheletro di una maschera (linee spesse 1 pixel), per erosioni successive."""
    m = m.astype(np.uint8)
    out = np.zeros_like(m)
    k = cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3))
    while m.any():
        er = cv2.erode(m, k)
        out |= m & ~cv2.dilate(er, k)
        m = er
    return out.astype(bool)


def assottiglia(ink, dentro):
    """Le linee interne a 1 pixel: via i pixel «a gomito» (due vicini perpendicolari d'inchiostro e la diagonale fra
    loro vuota), che fanno le scalette doppie. Solo dentro la figura: il contorno esterno resta com'è."""
    ink = ink.copy()
    H, W = ink.shape
    for j in range(1, H - 1):
        for i in range(1, W - 1):
            if not ink[j, i] or not dentro[j, i]:
                continue
            n, s_, o, e = ink[j - 1, i], ink[j + 1, i], ink[j, i - 1], ink[j, i + 1]
            if n + s_ + o + e != 2:
                continue
            for a, b, d in ((n, e, ink[j - 1, i + 1]), (e, s_, ink[j + 1, i + 1]), (s_, o, ink[j + 1, i - 1]), (o, n, ink[j - 1, i - 1])):
                if a and b and not d:
                    ink[j, i] = False
                    break
    return ink


def pixelizza(rgba, alto):
    """Un disegno pulito → alto px: in ogni cella il gruppo di colore più grande (k-medie a 2), il contorno scuro vince
    se copre almeno un terzo della cella (sennò a 64 px il contorno sottile sparisce)."""
    h, w = rgba.shape[:2]
    s = alto / h
    H, W = alto, max(1, int(round(w * s)))
    ys = np.round(np.linspace(0, h, H + 1)).astype(int)
    xs = np.round(np.linspace(0, w, W + 1)).astype(int)
    L = lab(rgba[..., :3])
    C = np.zeros((H, W, 3))
    A = np.zeros((H, W), bool)
    # le linee d'inchiostro del disegno, ridotte a 1 pixel: una cella attraversata per buona parte da una linea è inchiostro
    sk = scheletro((L[..., 0] < INK_L) & (rgba[..., 3] > 127))
    cella = h / alto
    INK = np.zeros((H, W), bool)
    for j in range(H):
        for i in range(W):
            blk = rgba[ys[j]:ys[j + 1], xs[i]:xs[i + 1]].reshape(-1, 4)
            bl = L[ys[j]:ys[j + 1], xs[i]:xs[i + 1]].reshape(-1, 3)
            pieno = blk[:, 3] > 127
            A[j, i] = pieno.mean() > 0.45
            if not pieno.any():
                continue
            # il colore solo dai pixel pieni del tutto: quelli a metà sono l'alone del fondo magenta
            netto = blk[:, 3] > 235
            pieno = netto if netto.any() else pieno
            px, pl = blk[pieno, :3].astype(np.float64), bl[pieno]
            if sk[ys[j]:ys[j + 1], xs[i]:xs[i + 1]].sum() >= 0.6 * cella:
                INK[j, i] = True
            scuro = pl[:, 0] < 22
            if scuro.mean() > 0.33:
                C[j, i] = np.median(px[scuro], 0)
                continue
            px, pl = px[~scuro] if (~scuro).any() else px, pl[~scuro] if (~scuro).any() else pl
            if len(px) < 3:
                C[j, i] = px.mean(0)
                continue
            # k-medie a 2 in Lab: il gruppo più grande
            c0, c1 = pl[pl[:, 0].argmin()], pl[pl[:, 0].argmax()]
            for _ in range(6):
                e = ((pl - c0) ** 2).sum(1) > ((pl - c1) ** 2).sum(1)
                if e.all() or (~e).all():
                    break
                c0, c1 = pl[~e].mean(0), pl[e].mean(0)
            g = e if e.sum() > (~e).sum() else ~e
            C[j, i] = np.median(px[g], 0)
    # inchiostro: le celle delle linee (assottigliate dentro la figura) prendono il colore d'inchiostro del disegno
    pad = np.pad(A, 1)
    dentro = A & pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:]
    INK = assottiglia(INK & A, dentro)
    C[INK] = INCHIOSTRO
    return C, A


def rimpicciolisci(rgba, alto):
    """Il metodo di prima: media d'area pesata dall'alfa (pixel_sprite.py)."""
    h, w = rgba.shape[:2]
    s = alto / h
    W2, H2 = max(1, round(w * s)), max(1, round(h * s))
    a = rgba[..., 3:4].astype(np.float64) / 255
    pre = rgba[..., :3].astype(np.float64) * a
    im_pre = Image.fromarray(np.clip(pre, 0, 255).astype(np.uint8)).resize((W2, H2), Image.BOX)
    im_a = Image.fromarray((a[..., 0] * 255).astype(np.uint8)).resize((W2, H2), Image.BOX)
    A = np.array(im_a).astype(np.float64) / 255
    C = np.array(im_pre).astype(np.float64) / np.maximum(A[..., None], 1e-3)
    return np.clip(C, 0, 255), A > 0.5


# ── tavolozza e pulizia ──

def kmedie(x, k, giri=25):
    # partenza dai punti più lontani (il primo è il più comune): un colore piccolo ma diverso ha il suo posto
    q = np.round(x / 4)
    u, inv, cnt = np.unique(q, axis=0, return_inverse=True, return_counts=True)
    cand = np.array([x[inv.ravel() == i].mean(0) for i in range(len(u))]) if len(u) < 4000 else x[::max(1, len(x) // 4000)]
    peso = cnt if len(u) < 4000 else np.ones(len(cand))
    cand, peso = cand[peso >= max(2, peso.sum() * 0.0008)], peso[peso >= max(2, peso.sum() * 0.0008)]
    c = [cand[int(np.argmax(peso))]]
    dmin = ((cand - c[0]) ** 2).sum(1)
    while len(c) < min(k, len(cand)):
        c.append(cand[int(np.argmax(dmin))])
        dmin = np.minimum(dmin, ((cand - c[-1]) ** 2).sum(1))
    c = np.array(c)
    for _ in range(giri):
        e = ((x[:, None] - c[None]) ** 2).sum(2).argmin(1)
        c = np.array([x[e == i].mean(0) if np.any(e == i) else c[i] for i in range(len(c))])
    return c


def tavolozza(figure, k):
    """Una tavolozza per tutto il set: k-medie in Lab sui pixel pieni, colori quasi uguali fusi, più l'inchiostro."""
    px = np.concatenate([f['C'][f['A']] for f in figure])
    px = px[::max(1, len(px) // 30000)]
    Lp = lab(px[None].astype(np.float32))[0]
    cl = kmedie(Lp, k)
    e = ((Lp[:, None] - cl[None]) ** 2).sum(2).argmin(1)
    pal = [np.median(px[e == i], 0) for i in range(len(cl)) if (e == i).any()]
    # fusione: due colori a meno di 5 di distanza Lab sono lo stesso
    out = []
    for c in sorted(pal, key=lambda c: -((e == 0).sum())):
        if all(np.sqrt(((lab(np.array([[c]], np.float32))[0, 0] - lab(np.array([[o]], np.float32))[0, 0]) ** 2).sum()) > 5 for o in out):
            out.append(c)
    out.append(INCHIOSTRO)
    return np.array(out)


def quantizza(C, A, pal):
    Lp = lab(pal[None].astype(np.float32))[0]
    Lc = lab(C.astype(np.float32))
    idx = ((Lc[..., None, :] - Lp[None, None]) ** 2).sum(-1).argmin(-1)
    return idx


def pulisci(idx, A, pal, contorno=True):
    """Pixel orfani (diversi da tutti e 4 i vicini pieni) presi dal vicino più comune; contorno di 1 pixel."""
    H, W = idx.shape
    idx = idx.copy()
    ink = int(np.argmin(np.abs(pal - INCHIOSTRO).sum(1)))
    for _ in range(2):
        cambi = 0
        for j in range(H):
            for i in range(W):
                if not A[j, i] or idx[j, i] == ink:  # un pixel d'inchiostro da solo è una pupilla: resta
                    continue
                v = [idx[y, x] for y, x in ((j - 1, i), (j + 1, i), (j, i - 1), (j, i + 1))
                     if 0 <= y < H and 0 <= x < W and A[y, x]]
                if len(v) >= 3 and idx[j, i] not in v:
                    vals, cnt = np.unique(v, return_counts=True)
                    if cnt.max() >= 2:
                        idx[j, i] = vals[cnt.argmax()]
                        cambi += 1
        if not cambi:
            break
    Q = pal[idx]
    if contorno:
        pad = np.pad(A, 1)
        bordo = A & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
        Q[bordo] = INCHIOSTRO  # il contorno esterno tutto dello stesso inchiostro: niente bordi viola o marroni
    return Q


def tela(Q, A, giu=0):
    h, w = A.shape
    t = np.zeros((h + 2 + giu, w + 2, 4), np.uint8)
    t[1:1 + h, 1:1 + w, :3] = np.clip(Q, 0, 255).astype(np.uint8)
    t[1:1 + h, 1:1 + w, 3] = A * 255
    return t


# ── i set per il gioco ──

def figure_da(metodo, cs, alto, p=None):
    """Ogni cella del foglio → {'C', 'A'} al metodo scelto."""
    out = []
    for c in cs:
        if not c:
            out.append(None)
            continue
        if metodo == 'media':
            C, A = rimpicciolisci(c['rgba'], alto * c['rgba'].shape[0] / c['alto_rif'])
        elif metodo == 'griglia':
            C, A, _ = defake(c['rgba'], p)
        else:
            C, A = pixelizza(c['rgba'], round(alto * c['rgba'].shape[0] / c['alto_rif']))
        out.append(dict(c, C=C, A=A))
    return out


def corse(cs, soglia=25):
    """Le lunghezze dei tratti di colore uguale lungo righe e colonne (una su due) di tutte le figure."""
    rs = []
    for c in cs:
        if not c:
            continue
        r = c['rgba']
        L, A = lab(r[..., :3]), r[..., 3] > 127
        for M, LL in ((A, L), (A.T, L.transpose(1, 0, 2))):
            d = (np.abs(np.diff(LL, axis=1)).sum(-1) > soglia) | (np.diff(M.astype(int), axis=1) != 0)
            for j in range(0, M.shape[0], 2):
                rs += np.diff(np.where(d[j])[0]).tolist()
    return np.array([x for x in rs if 3 <= x <= 60])


def periodo_foglio(cs, lo=4.0, hi=14.0):
    """Il passo dei quadretti finti (px, con la virgola), uno per foglio: per ogni passo la griglia regolare con la fase
    migliore in ogni riga e colonna di ogni figura; vince il passo più piccolo che vale almeno il 92% del migliore (un
    multiplo del passo vero cade anche lui sui bordi, la metà no)."""
    Es = []
    for c in cs:
        if c:
            Ex, Ey = energia(c['rgba'])
            Es += [Ex / (Ex.mean() + 1e-9), Ey / (Ey.mean() + 1e-9)]
    ps = np.arange(lo, hi, 0.05)
    sc = np.array([np.mean([miglior_fase(E, p)[1] for E in Es]) for p in ps])
    ok = ps[sc >= 0.92 * sc.max()]
    return round(float(ok.min()), 2)


def fai_set(metodo, alto, nome, k=16, fogli=None, righe=None, out=None, originali=None):
    """Tutte le viste di un personaggio → un set di sprite (PNG + elenco.json). fogli = {vista: percorso}; righe = per ogni riga
    del foglio [(mossa, primo numero)] (la camminata a 8 pose è passo1 + passo2 = camminata_1..8)."""
    out = out or os.path.join(RADICE, 'public', 'lab', nome)
    os.makedirs(out, exist_ok=True)
    righe = righe or [[('cammina', 1)], [('scatto', 1)], [('bevi', 1)]]
    fogli = fogli or {v: os.path.join(SRC, f'pixel_{v}.png') for v in VISTE}
    fogli = {v: Image.open(f) for v, f in fogli.items() if os.path.exists(f)}
    tutte, righe_testo = {}, []
    for v, im in fogli.items():
        cs = celle(im, len(righe), 4)
        alt = max(c['rgba'].shape[0] for c in cs if c and c['riga'] == 0)
        for c in cs:
            if c:
                c['alto_rif'] = alt
        p = periodo_foglio(cs) if metodo == 'griglia' else None
        fs = figure_da(metodo, cs, alto, p)
        # quanto la figura sta sopra la base della riga, in pixel d'uscita
        basi = {r: max(c['fondo'] for c in cs if c and c['riga'] == r) for r in range(len(righe))}
        for f in fs:
            if f:
                f['giu'] = round((basi[f['riga']] - f['fondo']) * f['A'].shape[0] / f['rgba'].shape[0])
        tutte[v] = fs
        alti = [f['A'].shape[0] for f in fs if f and f['riga'] == 0]
        righe_testo.append(f"{v}: passo {p} px · prima riga alta {min(alti)}-{max(alti)} px")
    figure = [f for fs in tutte.values() for f in fs if f]
    pal = np.vstack([tavolozza(figure, k), [[120, 214, 182], [196, 246, 226]]])
    # la densità del set: il protagonista in piedi (prima riga) alto ALTO_MONDO unità
    alto_px = np.median([f['A'].shape[0] for f in figure if f['riga'] == 0])
    s = round(float(alto_px / ALTO_MONDO), 3)
    elenco = {}
    for v, fs in tutte.items():
        for f in fs:
            if not f:
                continue
            Q = pulisci(quantizza(f['C'], f['A'], pal), f['A'], pal)
            t = tela(Q, f['A'], max(0, f['giu']))
            mossa, primo = righe[f['riga']][0]
            n = f"{v}_{mossa}_{primo + f['col']}"
            Image.fromarray(t, 'RGBA').save(os.path.join(out, n + '.png'))
            H2, W2 = t.shape[:2]
            elenco[n] = {'w': W2, 'h': H2, 's': s, 'ax': W2 // 2, 'ay': H2 - 1, 'piede': [0.8, 0.8],
                         'scatola': [0.8, 0.8, 2.5], 'modo': 'piano', 'avanti': 0.3}
            # il ritaglio del disegno di Codex che è diventato questo sprite occupa il riquadro box (x, y, w, h) dello sprite
            elenco[n]['box'] = [1, 1, int(f['A'].shape[1]), int(f['A'].shape[0])]
            if originali:
                os.makedirs(originali, exist_ok=True)
                Image.fromarray(f['rgba'], 'RGBA').save(os.path.join(originali, n + '.png'))
    json.dump(elenco, open(os.path.join(out, 'elenco.json'), 'w'), indent=0)
    print(f'{nome}: {len(elenco)} sprite, alto {alto_px:.0f} px, {s} px per unità, {len(pal)} colori → {out}')
    print('\n'.join(righe_testo))


def fai_atelier(cartella, metodo, alto, nome, out, k=16, originali=None, prefisso=''):
    """Un personaggio dell'Atelier (fogli/<vista>_cammina-passo1-passo2.png) → set per il banco del Borgo."""
    fogli = {v: os.path.join(cartella, 'fogli', f'{prefisso}{v}_cammina-passo1-passo2.png') for v in VISTE}
    fai_set(metodo, alto, nome, k, fogli, [[('cammina', 1)], [('camminata', 1)], [('camminata', 5)]], os.path.join(out, nome),
            originali)


def fai_foglio(f, metodo, alto, righe, colonne, k=16):
    """Un foglio qualsiasi (magenta) → le figure col metodo, affiancate a ×6 (prima riga del foglio)."""
    im = Image.open(f)
    cs = celle(im, righe, colonne)
    alt = max(c['rgba'].shape[0] for c in cs if c)
    for c in cs:
        if c:
            c['alto_rif'] = alt
    p = periodo_foglio(cs) if metodo == 'griglia' else None
    fs = [x for x in figure_da(metodo, cs, alto, p) if x]
    pal = tavolozza(fs, k)
    sprite = [tela(pulisci(quantizza(x['C'], x['A'], pal), x['A'], pal), x['A']) for x in fs]
    base = os.path.splitext(os.path.basename(f))[0]
    cart = os.path.join(RADICE, 'concept', 'lab', base)
    os.makedirs(cart, exist_ok=True)
    tag = f"{metodo}{alto if metodo != 'griglia' else ''}"
    for i, sp in enumerate(sprite):
        Image.fromarray(sp, 'RGBA').save(os.path.join(cart, f'{tag}_{i + 1}.png'))
    print(f'{base} {tag}: {len(sprite)} figure, passo {p}, alte {[s.shape[0] - 2 for s in sprite]} px, {len(pal)} colori → {cart}')


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    if sys.argv[1] == 'set':
        m = sys.argv[2]
        alto = arg('--alto', 48, int)
        fai_set(m, alto, arg('--nome', f"{m}{alto if m != 'griglia' else ''}"), arg('--colori', 16, int))
    elif sys.argv[1] == 'atelier':  # atelier <cartella personaggio> <metodo> --alto N --nome NOME --uscita <cartella dei set>
        m = sys.argv[3]
        alto = arg('--alto', 48, int)
        fai_atelier(sys.argv[2], m, alto, arg('--nome'), arg('--uscita'), arg('--colori', 20, int))
    elif sys.argv[1] == 'foglio':
        fai_foglio(sys.argv[2], sys.argv[3], arg('--alto', 48, int), arg('--righe', 3, int), arg('--colonne', 4, int),
                   arg('--colori', 16, int))
