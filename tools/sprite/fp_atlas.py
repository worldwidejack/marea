#!/usr/bin/env python3
"""MAREA, prima persona: dai fogli di Codex all'atlante degli sprite davanti agli occhi.

Riduce ogni foglio sulla sua griglia (fp_griglia.py), stacca le figure da sinistra a destra, allunga gli avambracci oltre il bordo (così non si
vede mai dove finiscono), separa le lame grigie (il gioco le tinge col materiale) e disegna da codice le fiamme e i bagliori. Impacchetta tutto in
un PNG e scrive il JSON coi riquadri e i punti di presa. Per controllare: scrive anche un foglio ingrandito con i punti di presa segnati.
Le armi uniche (fogli `u*`, in un'altra cartella con --unici) hanno i loro colori: tutta la palette, niente lama da tingere, passo trovato da solo.
Uso: fp_atlas.py <cartella coi fogli> <png di uscita> <json di uscita> [--unici <cartella coi fogli u*>]
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fp_griglia as G  # noqa: E402

MANI = list(G.TAVOLOZZA)
# Il passo a cui si legge ogni foglio: Codex non tiene la stessa grandezza di pixel da un foglio all'altro, qui diventa la stessa per tutti
PASSI = {'h1': 17.5, 'h2': 17.5, 'h3': 17.5, 'h4': 17.5, 'h5': 17.5, 'a1': 20.1, 'a2': 16.8, 'a3': 17.6, 'b1': 20.0, 'b2': 22.2, 'b3': 23.1}
ARMI = ['#F4E3C1', '#E2B97F', '#C98A4B', '#8E5A2B', '#5A3A1E', '#2E1E14', '#D9E872', '#8FC35B', '#4E9A46', '#2C6B3F', '#1E4A3A', '#7FE3E0', '#3FB9C9', '#2478A8', '#163F73', '#E8E1D6', '#B9AFA3', '#7F7568', '#4A4340', '#23201F', '#E8433F', '#F2A33A', '#F5D547', '#A64DFF', '#3DF5FF', '#8A5CFF', '#FF5C3D']
GRIGI = {(0xE8, 0xE1, 0xD6), (0xB9, 0xAF, 0xA3), (0x7F, 0x75, 0x68)}
# (foglio, figura) -> nome, punto di presa sulla sagoma guida (pixel del foglio largo 1536), angolo dell'avambraccio, dove esce dal riquadro
MANO = {
    ('h1', 0): ('pugno', (395, 600), 35, 'giu'), ('h1', 1): ('colpo1', (768 + 555, 385), 14, 'giu'),
    ('h2', 0): ('colpo2', (300, 525), 58, 'destra'), ('h2', 1): ('colpo3', (768 + 170, 680), 70, 'destra'),
    ('h3', 0): ('affondo', (475, 470), 8, 'giu'), ('h3', 1): ('tiro', (768 + 425, 490), 22, 'giu'),
    ('h4', 0): ('regge', (465, 545), 20, 'giu'), ('h4', 1): ('tira', (768 + 255, 600), 52, 'destra'),
    ('h5', 0): ('pugno_tp', (395, 600), 35, 'giu'), ('h5', 1): ('colpo1_tp', (768 + 555, 385), 14, 'giu'),
}
# foglio -> [(nome, presa come frazione dell'altezza dal basso)]
OGGETTI = {
    'a1': [('katana', 0.1), ('ascia', 0.18), ('nunchaku_tutto', 0.3)],
    'a2': [('lancia', 0.3), ('spadone', 0.08), ('martello', 0.2)],
    'a3': [('arco', 0.5), ('freccia', 0.05), ('fiaccola', 0.22), ('pozione', 0.45)],
    'b1': [('b_fiammata', 0.14), ('b_fuoco_continuo', 0.14), ('b_bomba_fuoco', 0.14), ('b_fulmine', 0.14), ('b_elettro_continuo', 0.14)],
    'b2': [('b_bomba_elettrica', 0.14), ('b_lupo_spettrale', 0.14), ('b_scheletro_evocato', 0.14), ('b_golem_evocato', 0.14)],
    'b3': [('b_cura_flusso', 0.14), ('b_cura_bomba', 0.14), ('b_furia_flusso', 0.14), ('b_furia_bomba', 0.14)],
}
# Ritocchi di colore dopo la lettura: la pietra scura del Vuoto Codex la fa quasi nera e diventerebbe tutta contorno (dentro: '#2E1E14' non sul bordo)
VUOTO = {'dentro': '#163F73', '#4A4340': '#8A5CFF', '#7F7568': '#A64DFF'}
# Le armi uniche: foglio -> [(nome, presa come frazione dell'altezza dal basso, come si stacca, altezza in pixel dello sprite)]; l'altezza è quella
# dell'arma del suo tipo (un po' di più se arriva più lontano): ogni figura si legge col passo che la porta lì. «nunchaku» = due pezzi come il nunchaku,
# «arco» = senza la corda (la tira il gioco), «molla» = arco che tiene la sua corda (la molla dell'Arco Carillon)
UNICI = {
    'u1': [('u_unico_albero_stella', 0.3, '', 78), ('u_unico_tavola_valanga', 0.12, '', 70), ('u_unico_martello_re', 0.2, '', 60)],
    'u2': [('u_unico_katana_spettro', 0.1, '', 62), ('u_unico_nunchaku_bandito', 0.3, 'nunchaku', 52), ('u_unico_fendiflutti', 0.1, '', 62)],
    'u3': [('u_unico_grande_lancetta', 0.08, '', 70), ('u_unico_arco_custode', 0.5, 'arco', 64, VUOTO), ('u_unico_arco_carillon', 0.5, 'molla', 64)],
    # gli unici sparsi nei dungeon (docs/UNICI.md) e le bacchette delle loro magie
    'u4': [('u_unico_remo_contrabbandiere', 0.3, '', 76), ('u_unico_falce_becchino', 0.18, '', 54), ('u_unico_scheggia_orizzonte', 0.1, '', 62)],
    'u5': [('u_unico_chiave_capoturno', 0.2, '', 60), ('u_unico_arco_valvola', 0.5, 'arco', 64), ('u_unico_compasso_cartografo', 0.3, 'nunchaku', 52)],
    'u6': [('u_unico_tenaglia_mastro', 0.2, '', 66), ('u_unico_arpione_palombaro', 0.3, '', 78), ('u_unico_bastoncini_gemelli', 0.3, 'nunchaku', 52)],
    'u7': [('u_unico_arco_skilift', 0.5, 'arco', 64), ('u_unico_mazza_lucignolo', 0.2, '', 60)],
    'w1': [('b_lampo_faro', 0.14, '', 34), ('b_corteo_ossa', 0.14, '', 34), ('b_squarcio_vuoto', 0.14, '', 34), ('b_bussola_fulminante', 0.14, '', 34)],
    'w2': [('b_colata', 0.14, '', 34), ('b_valzer_lame', 0.14, '', 34), ('b_salva_fuciliere', 0.14, '', 34), ('b_pioggia_braci', 0.14, '', 34)],
}
# la palette intera (docs/ART_BIBLE.md §2): gli unici sono colorati; il primo è il contorno (fp_griglia lo riconosce per primo)
TUTTI = ['#2E1E14', '#F4E3C1', '#E2B97F', '#C98A4B', '#8E5A2B', '#5A3A1E', '#D9E872', '#8FC35B', '#4E9A46', '#2C6B3F', '#1E4A3A', '#E8E1D6', '#B9AFA3', '#7F7568',
         '#4A4340', '#23201F', '#E8433F', '#F2A33A', '#F5D547', '#FF3DA6', '#3DF5FF', '#FFB03D', '#8A5CFF', '#7FE3E0', '#3FB9C9', '#2478A8', '#163F73', '#A64DFF',
         '#B6FF3D', '#FF5C3D']
LAMA = {'katana', 'ascia', 'lancia', 'spadone', 'martello'}
ALLUNGA = 44


def estendi(a, ang, verso, ax, ay):
    """Allunga l'avambraccio tagliato dal bordo, ricopiando l'ultima riga (o colonna) lungo la sua direzione."""
    h, w = a.shape[:2]
    t = math.tan(math.radians(ang))
    if verso == 'giu':
        dx = int(ALLUNGA * t) + 1
        out = np.zeros((h + ALLUNGA, w + dx, 4), dtype=np.uint8)
        out[:h, :w] = a
        for r in range(ALLUNGA):
            s = int((r + 1) * t)
            out[h + r, s:w + s] = a[h - 1]
    else:
        dy = int(ALLUNGA / max(t, 0.2)) + 1
        out = np.zeros((h + dy, w + ALLUNGA, 4), dtype=np.uint8)
        out[:h, :w] = a
        for r in range(ALLUNGA):
            s = int((r + 1) / max(t, 0.2))
            out[s:h + s, w + r] = a[:, w - 1]
    return out, ax, ay


def ritaglio(a):
    ys, xs = np.where(a[..., 3] > 0)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1], xs.min(), ys.min()


def mediana_x(a, frazione):
    h = a.shape[0]
    ys, xs = np.where(a[int(h * (1 - frazione)):, :, 3] > 0)
    return int(np.median(xs)) if len(xs) else a.shape[1] // 2


def fiamme(fiaccola):
    """Quattro fiamme a pixel, da appoggiare in cima alla torcia: stessa presa della torcia."""
    (h_t, ay_t, ax_t) = fiaccola
    tav = [G.hex_rgb(c) for c in ['#E8433F', '#F2A33A', '#F5D547', '#F4E3C1']]
    out = {}
    W, H = 15, 20
    for f in range(4):
        a = np.zeros((H, W, 4), dtype=np.uint8)
        for y in range(H):
            q = y / (H - 1)  # 0 in cima, 1 alla base
            larg = (0.5 + 0.5 * math.sin(q * math.pi * 0.85)) * q ** 0.55 * (W / 2 - 1)
            cx = W / 2 + math.sin(q * 5 + f * 1.6) * (1 - q) * 3.2
            for x in range(W):
                d = abs(x + 0.5 - cx) / max(0.01, larg)
                if d > 1:
                    continue
                n = 0 if d > 0.72 else 1 if d > 0.42 else 2 if q > 0.3 else 1
                if d < 0.2 and q > 0.55:
                    n = 3
                a[y, x, :3] = tav[n]
                a[y, x, 3] = 255
        out[f'fiamma{f}'] = (a, W // 2, H + ay_t - 9)  # copre la testa fasciata della torcia
    return out


def bagliori():
    out = {}
    for f, r in enumerate((3.0, 3.8, 2.4)):
        n = 11
        a = np.zeros((n, n, 4), dtype=np.uint8)
        c = n // 2
        for y in range(n):
            for x in range(n):
                dx, dy = abs(x - c), abs(y - c)
                if (dx + dy) ** 1.2 <= r * 1.3 or (f == 1 and (dx == 0 or dy == 0) and dx + dy <= c):
                    a[y, x] = (255, 255, 255, 255) if dx + dy < r * 0.55 else (214, 214, 214, 255)
        out[f'bagliore{f}'] = (a, c, c)
    return out


def impacchetta(pezzi, W=1024):
    voci = sorted(pezzi.items(), key=lambda kv: -kv[1][0].shape[0])
    x = y = riga = 1
    pos = {}
    for nome, (a, _, _) in voci:
        h, w = a.shape[:2]
        if x + w + 1 > W:
            x = 1; y += riga + 1; riga = 0
        pos[nome] = (x, y)
        x += w + 1; riga = max(riga, h)
    H = y + riga + 1
    tela = np.zeros((H, W, 4), dtype=np.uint8)
    meta = {}
    for nome, (a, ax, ay) in pezzi.items():
        px, py = pos[nome]
        h, w = a.shape[:2]
        tela[py:py + h, px:px + w] = a
        meta[nome] = {'x': px, 'y': py, 'w': w, 'h': h, 'ax': int(ax), 'ay': int(ay)}
    return tela, meta


def ritocca(t, mappa):
    """Cambia i colori di `mappa` (hex -> hex); 'dentro' = il colore del contorno quando non tocca il vuoto."""
    pieno = t[..., 3] > 0
    bordo = np.zeros_like(pieno)
    bordo[1:] |= ~pieno[:-1]; bordo[:-1] |= ~pieno[1:]; bordo[:, 1:] |= ~pieno[:, :-1]; bordo[:, :-1] |= ~pieno[:, 1:]
    bordo[0] = bordo[-1] = True; bordo[:, 0] = bordo[:, -1] = True
    orig = t.copy()
    for da, a in mappa.items():
        if da == 'dentro':
            m = pieno & ~bordo & np.all(orig[..., :3] == G.hex_rgb(TUTTI[0]), axis=-1)
        else:
            m = pieno & np.all(orig[..., :3] == G.hex_rgb(da), axis=-1)
        t[m, :3] = G.hex_rgb(a)


def unici(dove):
    """I pezzi delle armi uniche: si trova il passo del foglio, poi ogni figura si rilegge col passo che le dà l'altezza voluta."""
    out = {}
    for foglio, voci in UNICI.items():
        G.TAVOLOZZA[:] = TUTTI
        path = os.path.join(dove, foglio + '.png')
        a, p0, _, _ = G.riduci_griglia(path)
        alte = [f[3] - f[1] for f in G.figure(a, 25)]
        if len(alte) != len(voci):
            print(f'!! {foglio}: {len(alte)} figure invece di {len(voci)}')
            continue
        for i, (nome, frac, come, alto, *ritocchi) in enumerate(voci):
            p = p0 * alte[i] / alto
            a, p, _, _ = G.riduci_griglia(path, p)
            fig = G.figure(a, 25)
            if len(fig) != len(voci):
                print(f'!! {foglio} a passo {p:.1f}: {len(fig)} figure')
                continue
            x0, y0, x1, y1, celle = fig[i]
            t = np.zeros((y1 - y0, x1 - x0, 4), dtype=np.uint8)
            for y, x in celle:
                t[y - y0, x - x0] = a[y, x]
            if ritocchi:
                ritocca(t, ritocchi[0])
            h, w = t.shape[:2]
            ay, ax = int(h * (1 - frac)), mediana_x(t, 0.12)
            if come == 'nunchaku':
                m = h // 2
                out[nome] = (t[m:].copy(), ax, (h - m) // 2)
                out[nome + '2'] = (t[:m].copy(), ax, m + (h - m) // 2)
            else:
                if come == 'arco':
                    t[:, w - 3:] = 0
                if come in ('arco', 'molla'):
                    ax = int(np.where(t[ay, :, 3] > 0)[0].min()) + 2
                out[nome] = (t, ax, ay)
            print(f'{nome}: passo {p:.1f}, {w}×{h}, presa {ax},{ay}')
    return out


def main():
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    dove, png, js = sys.argv[1:4]
    pezzi = {}
    for (foglio, i), (nome, presa, ang, verso) in MANO.items():
        G.TAVOLOZZA[:] = MANI
        a, p, fx, fy = G.riduci_griglia(os.path.join(dove, foglio + '.png'), PASSI[foglio])
        fig = G.figure(a)
        if i >= len(fig):
            print(f'!! {foglio}: {len(fig)} figure, manca la {i + 1} ({nome})')
            continue
        x0, y0, x1, y1, celle = fig[i]
        t = np.zeros((y1 - y0, x1 - x0, 4), dtype=np.uint8)
        for y, x in celle:
            t[y - y0, x - x0] = a[y, x]
        sc = Image.open(os.path.join(dove, foglio + '.png')).size[0] / 1536
        ax, ay = (presa[0] * sc - fx) / p - x0, (presa[1] * sc - fy) / p - y0
        t, ax, ay = estendi(t, ang, verso, ax, ay)
        pezzi[nome] = (t, round(ax), round(ay))
        print(f'{nome}: passo {p:.1f}, {t.shape[1]}×{t.shape[0]}, presa {round(ax)},{round(ay)}')
    for foglio, voci in OGGETTI.items():
        G.TAVOLOZZA[:] = ARMI
        a, p, _, _ = G.riduci_griglia(os.path.join(dove, foglio + '.png'), PASSI[foglio])
        fig = G.figure(a, 25)
        if len(fig) != len(voci):
            print(f'!! {foglio}: {len(fig)} figure invece di {len(voci)}: {[f[2] - f[0] for f in fig]}')
        for (nome, frac), (x0, y0, x1, y1, celle) in zip(voci, fig):
            t = np.zeros((y1 - y0, x1 - x0, 4), dtype=np.uint8)
            for y, x in celle:
                t[y - y0, x - x0] = a[y, x]
            h, w = t.shape[:2]
            ay, ax = int(h * (1 - frac)), mediana_x(t, 0.12)
            if nome == 'nunchaku_tutto':  # due pezzi: il legno in mano (sotto) e quello che dondola (sopra, appeso alla catena)
                m = h // 2
                pezzi['nunchaku'] = (t[m:].copy(), ax, (h - m) // 2)
                pezzi['nunchaku2'] = (t[:m].copy(), ax, m + (h - m) // 2)
                print(f'nunchaku: passo {p:.1f}, {w}×{h}')
                continue
            if nome == 'arco':  # la corda la disegna il gioco, che la tira: qui resta il legno, con la presa sul ventre dell'arco
                t[:, w - 3:] = 0
                ax = int(np.where(t[ay, :, 3] > 0)[0].min()) + 2
            if nome in LAMA:
                g = np.array([[tuple(v[:3]) in GRIGI and v[3] > 0 for v in r] for r in t])
                lama = np.zeros_like(t); lama[g] = t[g]
                resto = t.copy(); resto[g] = 0
                pezzi[nome] = (resto, ax, ay)
                pezzi[nome + '_lama'] = (lama, ax, ay)
            else:
                pezzi[nome] = (t, ax, ay)
            print(f'{nome}: passo {p:.1f}, {w}×{h}, presa {ax},{ay}')
    if '--unici' in sys.argv:
        pezzi.update(unici(sys.argv[sys.argv.index('--unici') + 1]))
    pezzi['nunchaku_lama'] = (np.zeros((1, 1, 4), dtype=np.uint8), 0, 0)
    f = pezzi.get('fiaccola')
    if f:
        pezzi.update(fiamme((f[0].shape[0], f[2], f[1])))
    pezzi.update(bagliori())
    px = np.zeros((2, 2, 4), dtype=np.uint8); px[...] = 255
    pezzi['px'] = (px, 1, 1)
    tela, meta = impacchetta(pezzi)
    Image.fromarray(tela).save(png)
    json.dump({'w': tela.shape[1], 'h': tela.shape[0], 'pezzi': meta}, open(js, 'w', encoding='utf-8'), separators=(',', ':'))
    print(f'atlante {tela.shape[1]}×{tela.shape[0]}, {len(meta)} pezzi, {tela.shape[0] * tela.shape[1] * 4 / 1e6:.2f} MB nel budget texture')
    # foglio di controllo, ingrandito coi punti di presa
    k = 3
    prova = Image.fromarray(tela).resize((tela.shape[1] * k, tela.shape[0] * k), Image.NEAREST).convert('RGBA')
    fondo = Image.new('RGBA', prova.size, (70, 70, 90, 255)); fondo.alpha_composite(prova)
    pix = fondo.load()
    for m in meta.values():
        cx, cy = (m['x'] + m['ax']) * k, (m['y'] + m['ay']) * k
        for d in range(-4, 5):
            for qx, qy in ((cx + d, cy), (cx, cy + d)):
                if 0 <= qx < fondo.width and 0 <= qy < fondo.height:
                    pix[qx, qy] = (0, 255, 0, 255)
    fondo.convert('RGB').save(os.path.join(dove, '_ATLANTE.png'))


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    main()
