#!/usr/bin/env python3
"""MAREA — dai fogli in pixel art di Codex o ChatGPT agli sprite del gioco (look 3: personaggio 2.5D a pixel, 16 direzioni).

Legge <cartella>/fogli/<vista>_<mossa>-<mossa>-<mossa>.png (4 colonne × una riga per mossa, fondo magenta #FF00FF) e
<cartella>/fogli/viste_<mossa>.png (una riga di 5 figure ferme: S SE E NE N, per chi sta fermo come il barista):
- ogni cella si scontorna (alfa dal magenta) e si ritaglia; si tiene la figura e i pezzi attaccati (via polvere e righe
  di velocità staccate);
- ogni foglio si porta alla scala del personaggio: la PRIMA riga (la camminata, o la posa ferma) alta «alto» px della
  scheda; rimpicciolito a media d'area pesata dall'alfa (niente aloni magenta), poi alfa netta (0/1);
- tavolozza comune a tutte le viste (15 colori per k-medie, più l'inchiostro e gli --extra), salvata in
  sprite/tavolozza.json e riusata alle volte dopo (i fogli nuovi prendono gli stessi colori); contorno di 1 pixel dove manca;
- piedi: ogni riga ha la sua linea di base (il piede più basso della riga), il punto d'appoggio sta al centro, sulla riga
  sotto i piedi: una capriola resta in aria quanto la disegna il foglio.
Scrive <cartella>/sprite/<vista>_<mossa>_<n>.png (n da 1) e sprite/elenco.json (lo stesso formato della prova dei look).
Il lato sinistro non si disegna: è lo specchio (lo fa il gioco).

Uso:  python tools/sprite/pixel.py <cartella> [--alto 48] [--colori 15] [--extra "#78D6B6,#C4F6E2"]
                                           [--tavolozza file.json] [--nuova-tavolozza]
  --tavolozza: una tavolozza data (lista di "#RRGGBB"), per esempio quella dell'Art Bible; --nuova-tavolozza la rifà
  dai fogli invece di riusare sprite/tavolozza.json. Python con Pillow, numpy e OpenCV (quello del venv di Fenaki).
"""
import glob
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comune import (CODICI, INCHIOSTRO, VISTE_MODELLO, alfa_magenta, cartella_da_argomenti, leggi_nome_foglio,  # noqa: E402
                    leggi_scheda, opzione)

INK = np.array(INCHIOSTRO, dtype=np.float64)


def celle(im, righe, colonne):
    """Le figure del foglio (righe × colonne), tagliate per sagome e non a griglia fissa: Codex non tiene le figure dentro
    la sua griglia (nel foglio SSE della prova i capelli della riga «bevi» salivano oltre la riga e il taglio a griglia li
    mozzava piatti). Ogni macchia va alla cella dove cade il suo centro; per cella si tiene la più grande e i pezzi
    attaccati a lei (via polvere e righe di velocità staccate). Per ogni cella il ritaglio RGBA e il fondo della figura."""
    rgb = np.array(im.convert('RGB'))
    if 'A' in im.getbands() or 'transparency' in im.info:  # Codex a volte fa il fondo trasparente invece del magenta
        rgb[np.array(im.convert('RGBA'))[..., 3] < 128] = (255, 0, 255)
    a = alfa_magenta(rgb)
    H, W = a.shape
    n, lab, st, cen = cv2.connectedComponentsWithStats((a > 0.5).astype(np.uint8), connectivity=8)
    per_cella = {}
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] >= 8:  # i puntini isolati sono rumore
            cx, cy = cen[i]
            per_cella.setdefault((min(righe - 1, int(cy * righe / H)), min(colonne - 1, int(cx * colonne / W))), []).append(i)
    out = []
    for r in range(righe):
        for c in range(colonne):
            pezzi = per_cella.get((r, c), [])
            if not pezzi:
                out.append(None)
                continue
            k = max(pezzi, key=lambda i: st[i, cv2.CC_STAT_AREA])
            x, y, w, h = st[k, :4]
            x0, y0, x1, y1 = max(0, x - 10), max(0, y - 10), min(W, x + w + 10), min(H, y + h + 10)
            vicino = cv2.dilate((lab[y0:y1, x0:x1] == k).astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
            tenuti = [k] + [i for i in pezzi if i != k and st[i, cv2.CC_STAT_AREA] > 40
                            and (vicino & (lab[y0:y1, x0:x1] == i)).any()]
            tieni = np.isin(lab, tenuti)
            ys, xs = np.where(tieni)
            ya, yb, xa, xb = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
            alfa = a[ya:yb, xa:xb] * tieni[ya:yb, xa:xb]
            rgba = np.dstack([rgb[ya:yb, xa:xb], (alfa * 255).astype(np.uint8)])
            out.append({'rgba': rgba, 'fondo': yb, 'riga': r, 'col': c,
                        'tocca': ya == 0 or xa == 0 or yb == H or xb == W,                      # tagliata dal foglio
                        'larga': w > 1.25 * W / colonne or h > 1.25 * H / righe})               # due figure attaccate?
    return out


def rimpicciolisci(rgba, s):
    """Media d'area pesata dall'alfa (niente aloni magenta), poi alfa netta."""
    h, w = rgba.shape[:2]
    W2, H2 = max(1, round(w * s)), max(1, round(h * s))
    a = rgba[..., 3:4].astype(np.float64) / 255
    pre = rgba[..., :3].astype(np.float64) * a
    im_pre = Image.fromarray(np.clip(pre, 0, 255).astype(np.uint8)).resize((W2, H2), Image.BOX)
    im_a = Image.fromarray((a[..., 0] * 255).astype(np.uint8)).resize((W2, H2), Image.BOX)
    A = np.array(im_a).astype(np.float64) / 255
    C = np.array(im_pre).astype(np.float64) / np.maximum(A[..., None], 1e-3)
    return np.clip(C, 0, 255), A > 0.5


def kmedie(x, k, giri=20):
    rng = np.random.default_rng(3)
    c = x[rng.choice(len(x), min(k, len(x)), replace=False)]
    for _ in range(giri):
        e = ((x[:, None] - c[None]) ** 2).sum(2).argmin(1)
        c = np.array([x[e == i].mean(0) if np.any(e == i) else c[i] for i in range(len(c))])
    return c


def quantizza(c, pal):
    """Colori della tavolozza, contorno di 1 pixel dove manca, tela col margine e i piedi sulla riga di base."""
    C, M = c['C'], c['M']
    idx = ((C[..., None, :] - pal[None, None]) ** 2).sum(-1).argmin(-1)
    Q = pal[idx]
    pad = np.pad(M, 1)
    bordo = M & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    scuro = Q.sum(-1) < 150
    Q[bordo & ~scuro] = INK
    h, w = M.shape
    tela = np.zeros((h + 2 + c['giu'], w + 2, 4), np.uint8)
    tela[1:1 + h, 1:1 + w, :3] = Q.astype(np.uint8)
    tela[1:1 + h, 1:1 + w, 3] = M * 255
    return tela


def esadecimale(c):
    return '#%02X%02X%02X' % tuple(int(round(v)) for v in c)


def da_esadecimale(h):
    h = h.strip().lstrip('#')
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


def main():
    cartella = cartella_da_argomenti(__doc__)
    scheda = leggi_scheda(cartella)
    alto = int(opzione('alto', scheda['alto']))
    colori = int(opzione('colori', scheda.get('colori', 15)))
    extra = [da_esadecimale(x) for x in (opzione('extra', '') or ','.join(scheda.get('extra', []))).split(',') if x.strip()]
    # in ordine di vista (S → N), a pari vista il più vecchio prima: vince lui se due fogli danno lo stesso sprite
    ordine = lambda f: (CODICI.index(leggi_nome_foglio(f)[0]) if leggi_nome_foglio(f)[0] in CODICI else 99,  # noqa: E731
                        os.path.getmtime(f))
    fogli = sorted(glob.glob(os.path.join(cartella, 'fogli', '*.png')), key=ordine)
    if not fogli:
        sys.exit(f'nessun foglio in {os.path.join(cartella, "fogli")} (prompt.py → genera.py, o i PNG di ChatGPT salvati lì)')
    out = os.path.join(cartella, 'sprite')
    os.makedirs(out, exist_ok=True)
    tutte, avvisi = [], []
    for f in fogli:
        vista, mosse = leggi_nome_foglio(f)
        if vista == 'viste':           # 5 figure ferme in fila: S SE E NE N
            cs, righe = celle(Image.open(f), 1, 5), 1
            for c in cs:
                if c:
                    c['vista'], c['mossa'], c['n'] = VISTE_MODELLO[c['col']], mosse[0] if mosse else 'fermo', 1
        elif vista in CODICI and mosse:
            cs, righe = celle(Image.open(f), len(mosse), 4), len(mosse)
            for c in cs:
                if c:
                    c['vista'], c['mossa'], c['n'] = vista, mosse[c['riga']], c['col'] + 1
        else:
            avvisi.append(f'{os.path.basename(f)}: nome non valido (vista_mossa-mossa.png o viste_mossa.png), saltato')
            continue
        piene = [c for c in cs if c]
        if len(piene) < len(cs):
            avvisi.append(f'{os.path.basename(f)}: {len(cs) - len(piene)} celle vuote')
        avvisi += [f"{os.path.basename(f)}: {c['vista']}_{c['mossa']}_{c['n']} tocca il bordo del foglio (tagliata?)"
                   for c in piene if c['tocca']]
        avvisi += [f"{os.path.basename(f)}: {c['vista']}_{c['mossa']}_{c['n']} più grande di una cella (due figure attaccate?)"
                   for c in piene if c['larga']]
        # scala: la figura più alta della prima riga (in piedi) = alto px; ogni riga coi piedi sulla sua base
        metro = max(c['rgba'].shape[0] for c in piene if c['riga'] == 0)
        s = alto / metro
        basi = {r: max(c['fondo'] for c in piene if c['riga'] == r) for r in range(righe)}
        for c in piene:
            c['C'], c['M'] = rimpicciolisci(c['rgba'], s)
            c['giu'] = round((basi[c['riga']] - c['fondo']) * s)
            c['foglio'] = os.path.basename(f)
        tutte += piene
    # uno sprite che esce da due fogli: vince il foglio più vecchio (quello già guardato)
    visti, uniche = set(), []
    for c in tutte:
        k = f"{c['vista']}_{c['mossa']}_{c['n']}"
        if k in visti:
            avvisi.append(f"{k} anche in {c['foglio']}: tengo quello del foglio più vecchio")
            continue
        visti.add(k)
        uniche.append(c)
    p_tav = os.path.join(out, 'tavolozza.json')
    if opzione('tavolozza'):
        pal = np.array([da_esadecimale(x) for x in json.load(open(opzione('tavolozza'), encoding='utf-8'))], dtype=np.float64)
        origine = opzione('tavolozza')
    elif os.path.exists(p_tav) and '--nuova-tavolozza' not in sys.argv:
        pal = np.array([da_esadecimale(x) for x in json.load(open(p_tav, encoding='utf-8'))], dtype=np.float64)
        origine = 'sprite/tavolozza.json (di prima)'
    else:
        px = np.concatenate([c['C'][c['M']] for c in uniche])
        pal = np.vstack([kmedie(px[::max(1, len(px) // 20000)], colori), INK] + ([np.array(extra, dtype=np.float64)] if extra else []))
        origine = f'nuova: {colori} colori dai fogli + inchiostro' + (f' + {len(extra)} extra' if extra else '')
        with open(p_tav, 'w', encoding='utf-8') as fp:
            json.dump([esadecimale(c) for c in pal], fp, indent=0)
    piede, scatola = scheda.get('piede', [0.8, 0.8]), scheda.get('scatola', [0.8, 0.8, 2.5])
    elenco = {}
    for c in uniche:
        tela = quantizza(c, pal)
        nome = f"{c['vista']}_{c['mossa']}_{c['n']}"
        Image.fromarray(tela, 'RGBA').save(os.path.join(out, nome + '.png'))
        H2, W2 = tela.shape[:2]
        # punto d'appoggio: angolo fra due pixel (intero), al centro della figura, sulla riga sotto i piedi
        elenco[nome] = {'w': W2, 'h': H2, 's': 19.2, 'ax': W2 // 2, 'ay': H2 - 1, 'piede': piede, 'scatola': scatola,
                        'modo': 'piano', 'avanti': 0.3}
    with open(os.path.join(out, 'elenco.json'), 'w', encoding='utf-8') as fp:
        json.dump(dict(sorted(elenco.items())), fp, indent=0)
    viste = sorted({c['vista'] for c in uniche}, key=lambda v: CODICI.index(v))
    mosse = sorted({c['mossa'] for c in uniche})
    print(f"{len(elenco)} sprite da {len(fogli)} fogli · viste {' '.join(viste)} · mosse {', '.join(mosse)} · alto {alto} px")
    print(f'tavolozza {len(pal)} colori ({origine})')
    fatte = {(c['vista'], c['mossa']) for c in uniche if not c['foglio'].startswith('viste_')}
    for m in sorted({m for _, m in fatte}):
        manca = [v for v in CODICI if (v, m) not in fatte]
        if manca:
            print(f"  {m}: mancano {' '.join(manca)} (per le 16 direzioni servono tutte e 9 le viste)")
    for a in avvisi:
        print('  ! ' + a)
    print('→', out)


if __name__ == '__main__':
    main()
