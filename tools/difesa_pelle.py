#!/usr/bin/env python3
"""MAREA — dalle cartelle di Codex alla pelle animata della Difesa (#358, #379): fotogrammi → atlas WebP + pelle.json v2.

Legge un manifest (es. assets/concept/difesa/orto/manifest.json) che dice, per ogni chiave del gioco (sparatore, base, colpo…), dove
sono i PNG di Codex (1024², alpha vero, ogni fotogramma = modifica della posa base), quale è la posa base, quanto è alta in caselle e
quali clip ha. Per ogni chiave:
- pulisce la polvere d'alpha (< 8) e le briciole staccate;
- allinea ogni fotogramma alla posa base: stessa riga di terra (tranne le clip in volo) e lo spostamento orizzontale che sovrappone
  meglio la FASCIA BASSA della sagoma (piedi, cavalletto, suola): così il rinculo della carota e la scivolata del guscio restano;
- una scala sola per chiave; le varianti (`scala_di`) usano scala e piedi del padre e la loro posa base si allinea a quella del padre,
  così quando l'armatura si rompe il cambio di clip non salta;
- ridimensiona la tela intera e poi ritaglia ogni fotogramma tenendo l'offset: i piedi restano fermi tra un fotogramma e l'altro.
Poi impacca tutto su pagine WebP ≤ 2048², cuce il fondale (sinistra + centro + destra), scrive pelle.json e il foglio di controllo
(fuori dal gioco, in <cartella del manifest>/_controllo/).

Uso: /usr/local/bin/python3 tools/difesa_pelle.py assets/concept/difesa/orto/manifest.json [--solo base,cono] [--senza-controllo]
(serve il Python con PIL e WebP: /usr/local/bin/python3 sul Mac di Jack)
"""
import hashlib
import io
import json
import os
import sys
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageStat

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
POLVERE = 8      # alpha sotto questo = polvere di Codex
SAGOMA = 128     # alpha sopra questo = sagoma (per misurare)
BORDO = 128      # tela allargata attorno al 1024 (gli spostamenti non tagliano niente)
FASCIA = 0.2     # la fascia bassa della posa base usata per allineare (frazione dell'altezza)
MARGINE = 3      # px vuoti tra un fotogramma e l'altro sulla pagina
TETTO_MB = 3.5   # oltre questo il tool si ferma (budget difesaAssetsMB = 4)


def avviso(t):
    print(f'  ! {t}')


# ---------- immagini ----------
def apri(path):
    im = Image.open(path).convert('RGBA')
    if im.size != (1024, 1024):
        # Codex a volte consegna 1254² o simili: in proporzione dentro 1024, piedi dove erano in proporzione
        k = 1024 / max(im.size)
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        t = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
        t.paste(im, ((1024 - im.width) // 2, 1024 - im.height))
        im = t
    a = im.getchannel('A').point(lambda v: 0 if v < POLVERE else v)
    im.putalpha(a)
    t = Image.new('RGBA', (1024 + 2 * BORDO, 1024 + 2 * BORDO), (0, 0, 0, 0))
    t.paste(im, (BORDO, BORDO))
    return briciole(t)


def maschera(im, soglia=SAGOMA):
    return im.getchannel('A').point(lambda v: 255 if v > soglia else 0)


def scatola(im):
    return maschera(im).getbbox()


def briciole(im, minimo=0.002):
    """Toglie i pezzetti staccati piccolissimi (macchie di Codex), non gli sbuffi o le stelline: sotto lo 0,2 % della sagoma."""
    q = 4
    w, h = im.size
    m = im.getchannel('A').resize((w // q, h // q), Image.BOX).point(lambda v: 255 if v > 40 else 0)
    W, H = m.size
    px = m.load()
    visto = bytearray(W * H)
    pezzi = []
    for y in range(H):
        for x in range(W):
            if not px[x, y] or visto[y * W + x]:
                continue
            visto[y * W + x] = 1
            pila, celle = [(x, y)], []
            while pila:
                cx, cy = pila.pop()
                celle.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < W and 0 <= ny < H and not visto[ny * W + nx] and px[nx, ny]:
                        visto[ny * W + nx] = 1
                        pila.append((nx, ny))
            pezzi.append(celle)
    if len(pezzi) <= 1:
        return im
    tot = sum(len(c) for c in pezzi)
    via = [c for c in pezzi if len(c) < max(2, tot * minimo)]
    if not via:
        return im
    cancella = Image.new('L', (W, H), 0)
    cp = cancella.load()
    for c in via:
        for x, y in c:
            cp[x, y] = 255
    cancella = cancella.filter(ImageFilter.MaxFilter(3)).resize((w, h), Image.NEAREST)
    im.putalpha(ImageChops.subtract(im.getchannel('A'), cancella))
    return im


def pezzi_staccati(im):
    """I blocchi di un foglio separati da righe vuote, dall'alto in basso, ognuno ritagliato al contenuto."""
    a = im.getchannel('A').point(lambda v: 255 if v > 128 else 0)
    righe = [y for y in range(im.height) if a.crop((0, y, im.width, y + 1)).getbbox()]
    blocchi, ini, prima = [], righe[0], righe[0]
    for y in righe[1:]:
        if y > prima + 5:
            blocchi.append((ini, prima))
            ini = y
        prima = y
    blocchi.append((ini, prima))
    out = []
    for y0, y1 in blocchi:
        bb = a.crop((0, y0, im.width, y1 + 1)).getbbox()
        out.append(im.crop((bb[0], y0, bb[2], y1 + 1)))
    return out


def sposta(im, dx, dy):
    out = Image.new(im.mode, im.size, (0, 0, 0, 0) if im.mode == 'RGBA' else 0)
    out.paste(im, (dx, dy))
    return out


def punteggio(a, b):
    comune = ImageChops.logical_and(a.convert('1'), b.convert('1')).histogram()[-1]
    diversi = ImageChops.difference(a, b).histogram()[-1]
    return comune - diversi * 0.5


def fascia(base, zona=None):
    """La zona della posa base su cui allineare, come scatola in px della tela: di serie la fascia bassa (piedi, cavalletto, suola);
    `zona` = [x0, y0, x1, y1] in frazioni della sagoma (es. il corpo della cavalletta, che corre muovendo tutte le zampe)."""
    x0, y0, x1, y1 = scatola(base)
    if zona:
        w, h = x1 - x0, y1 - y0
        return (round(x0 + w * zona[0]), round(y0 + h * zona[1]), round(x0 + w * zona[2]), round(y0 + h * zona[3]))
    return (x0, round(y1 - (y1 - y0) * FASCIA), x1, y1)


def allinea(f, rif, terra=True, cerca=72, zona=None):
    """Sposta il fotogramma `f` (stessa tela di `rif`): riga di terra uguale (se `terra`) e dx che sovrappone meglio la fascia bassa."""
    dy = 0
    if terra:
        dy = scatola(rif)[3] - scatola(f)[3]
        f = sposta(f, 0, dy)
    q = 4
    W, H = rif.size
    R = maschera(rif).resize((W // q, H // q), Image.BOX).point(lambda v: 255 if v > 127 else 0)
    F = maschera(f).resize((W // q, H // q), Image.BOX).point(lambda v: 255 if v > 127 else 0)
    z = tuple(v // q for v in fascia(rif, zona))
    rz = R.crop(z)
    meglio = None
    for d in range(-cerca // q, cerca // q + 1):
        v = punteggio(rz, F.crop((z[0] - d, z[1], z[2] - d, z[3])))
        if meglio is None or v > meglio[0]:
            meglio = (v, d)
    dx = meglio[1] * q
    # rifinitura a piena risoluzione attorno al migliore
    zf = fascia(rif, zona)
    Rf, Ff = maschera(rif).crop(zf), maschera(f)
    fine = None
    for d in range(dx - q, dx + q + 1):
        v = punteggio(Rf, Ff.crop((zf[0] - d, zf[1], zf[2] - d, zf[3])))
        if fine is None or v > fine[0]:
            fine = (v, d)
    dx = fine[1]
    return sposta(f, dx, 0), dx, dy


def piedi(im, modo='terra'):
    """Il punto d'appoggio sulla tela: centro della fascia bassa e riga di terra; `centro` = centro della sagoma (colpi, monete)."""
    x0, y0, x1, y1 = scatola(im)
    if modo == 'centro':
        return ((x0 + x1) / 2, (y0 + y1) / 2)
    b = maschera(im).crop(fascia(im)).getbbox()
    fx0, fx1 = (b[0] + x0, b[2] + x0) if b else (x0, x1)
    return ((fx0 + fx1) / 2, y1)


def ritaglia(im):
    bb = im.getchannel('A').getbbox()
    if not bb:
        return None, (0, 0)
    bb = (max(0, bb[0] - 1), max(0, bb[1] - 1), min(im.width, bb[2] + 1), min(im.height, bb[3] + 1))
    return im.crop(bb), (bb[0], bb[1])


# ---------- manifest ----------
def clip_def(v):
    if isinstance(v, list):
        return {'f': v, 'fps': 8, 'giro': 0, 'terra': True}
    return {'f': v['f'], 'fps': v.get('fps', 8), 'giro': v.get('giro', 0), 'terra': v.get('terra', True)}


def cella_di(cart, foglio, griglia, i):
    """La cella `i` di un foglio a griglia (oggetti di Codex), ritagliata al contenuto."""
    sheet = Image.open(os.path.join(cart, foglio)).convert('RGBA')
    c, r = griglia
    w, h = sheet.width // c, sheet.height // r
    pezzo = sheet.crop(((i % c) * w, (i // c) * h, (i % c + 1) * w, (i // c + 1) * h))
    pezzo.putalpha(pezzo.getchannel('A').point(lambda v: 0 if v < POLVERE else v))
    bb = pezzo.getchannel('A').getbbox()
    return pezzo.crop(bb) if bb else pezzo


def componi(im, acc, cfg):
    """Mette l'accessorio (ghianda, vasetto) sul fotogramma: in cima alla parte `dietro` (il guscio: i nemici guardano a sinistra) o
    `davanti` (la testa), misurata sulla sagoma del fotogramma (senza antenne se `spesso`). `scala` = larghezza rispetto alla sagoma,
    `affonda` = quanto entra nella sagoma, `dx`/`dy` in frazioni della sagoma, `rot` in gradi."""
    m = maschera(im)
    if cfg.get('spesso'):
        m = m.filter(ImageFilter.MinFilter(cfg['spesso'])).filter(ImageFilter.MaxFilter(cfg['spesso']))
    x0, y0, x1, y1 = m.getbbox()
    w, h = x1 - x0, y1 - y0
    a, b = cfg.get('zona') or ((0.45, 1.0) if cfg.get('lato', 'dietro') == 'dietro' else (0.0, 0.42))
    zx0, zx1 = round(x0 + w * a), round(x0 + w * b)
    top = y0 + m.crop((zx0, y0, zx1, y1)).getbbox()[1]
    riga = m.crop((zx0, top, zx1, top + max(4, round(h * 0.05)))).getbbox()
    cx = zx0 + (riga[0] + riga[2]) / 2
    sw = round(w * cfg['scala'])
    a2 = acc.resize((sw, max(1, round(acc.height * sw / acc.width))), Image.LANCZOS)
    if cfg.get('rot'):
        a2 = a2.rotate(cfg['rot'], expand=True, resample=Image.BICUBIC)
    px = round(cx - a2.width / 2 + cfg.get('dx', 0) * w)
    py = round(top - a2.height * (1 - cfg.get('affonda', 0.3)) + cfg.get('dy', 0) * h)
    out = im.copy()
    out.alpha_composite(a2, (px, py))
    return out


def prepara_chiave(k, d, cart, cella, fatte):
    """Allinea e scala i fotogrammi di una chiave. Ritorna dict con scala, piedi, tela e i fotogrammi (immagine, offset) per clip."""
    if d.get('accessorio'):
        # variante fatta mettendo un pezzo di Codex sopra ogni fotogramma (già allineato) del padre: stessa scala, stessi piedi
        padre = fatte[d['scala_di']]
        ac = d['accessorio']
        acc = cella_di(cart, ac['foglio'], ac['griglia'], ac['cella'])
        clips = {n: clip_def(v) for n, v in d['clip'].items()}
        allineate = {}
        for c in clips.values():
            for f in c['f']:
                if f not in allineate:
                    allineate[f] = componi(padre['allineate'][f], acc, ac)
        s = padre['scala']
        W, H = padre['base'].size
        fotogrammi = {f: ritaglia(im.resize((round(W * s), round(H * s)), Image.LANCZOS)) for f, im in allineate.items()}
        print(f'  {k}: {len(allineate)} fotogrammi = {d["scala_di"]} + accessorio')
        return {'chiave': k, 'base': padre['base'], 'scala': s, 'piedi_tela': padre['piedi_tela'], 'piedi': padre['piedi'], 'clips': clips,
                'fotogrammi': fotogrammi, 'alto': padre['alto'], 'altoPx': padre['altoPx'], 'come': d.get('come'), 'allineate': allineate}
    if 'foglio' in d:
        pezzo = cella_di(cart, d['foglio'], d['griglia'], d['cella'])
        t = Image.new('RGBA', (pezzo.width + 2 * BORDO, pezzo.height + 2 * BORDO), (0, 0, 0, 0))
        t.paste(pezzo, (BORDO, BORDO))
        t = briciole(t)
        base = t
        clips = {'fermo': {'f': ['_cella'], 'fps': 8, 'giro': 0, 'terra': True}}
        immagini = {'_cella': base}
    else:
        dir_ = os.path.join(cart, d['cartella'])
        base = apri(os.path.join(dir_, d['base']))
        clips = {n: clip_def(v) for n, v in d['clip'].items()}
        immagini = {}
        for c in clips.values():
            for f in c['f']:
                if f not in immagini:
                    p = os.path.join(dir_, f)
                    if not os.path.exists(p):
                        raise SystemExit(f'{k}: manca {p}')
                    immagini[f] = base if f == d['base'] else apri(p)
    padre = fatte.get(d.get('scala_di')) if d.get('scala_di') else None
    if d.get('scala_di') and not padre:
        raise SystemExit(f'{k}: scala_di «{d["scala_di"]}» va messo prima nel manifest')
    if padre:
        base, dxb, dyb = allinea(base, padre['base'])
        if dxb or dyb:
            print(f'  {k}: posa base spostata di {dxb:+d},{dyb:+d} px sul padre {d["scala_di"]}')
        if d['base'] in immagini:
            immagini[d['base']] = base
        s, (px, py) = padre['scala'], padre['piedi_tela']
    else:
        bb = scatola(base)
        s = d['alto'] * cella / (bb[3] - bb[1])
        px, py = piedi(base, d.get('piedi', 'terra'))
        # piedi spostati (es. l'annaffiatoio: il gioco lo mette a -0,3 caselle, lo voglio tutto a sinistra del campo)
        px += d.get('piedi_dx', 0) * (bb[2] - bb[0])
    hb = scatola(base)[3] - scatola(base)[1]
    allineate = {}
    for nome, c in clips.items():
        for f in c['f']:
            if f in allineate:
                continue
            im = immagini[f]
            if im is base or d.get('allinea') is False or 'foglio' in d:
                allineate[f] = im
                continue
            im2, dx, dy = allinea(im, base, terra=c['terra'], zona=d.get('zona_allinea'))
            allineate[f] = im2
            h = scatola(im2)[3] - scatola(im2)[1]
            if abs(h - hb) / hb > 0.04 and c['terra']:
                avviso(f'{k}/{f}: alta {h} px contro {hb} della base ({(h - hb) / hb:+.0%})')
            print(f'  {k}/{f}: terra {dy:+d}, dx {dx:+d}')
            bb = im2.getchannel('A').getbbox()
            if bb and (bb[0] <= BORDO or bb[2] >= BORDO + 1024 or bb[1] <= BORDO) and 'foglio' not in d:
                avviso(f'{k}/{f}: tocca il bordo della tela di Codex (forse tagliato)')
    W, H = base.size
    Ws, Hs = round(W * s), round(H * s)
    fotogrammi = {}
    for f, im in allineate.items():
        im = im.resize((Ws, Hs), Image.LANCZOS)
        pezzo, off = ritaglia(im)
        fotogrammi[f] = (pezzo, off)
    return {'chiave': k, 'base': base, 'scala': s, 'piedi_tela': (px, py), 'piedi': (px * s, py * s), 'clips': clips,
            'fotogrammi': fotogrammi, 'alto': padre['alto'] if padre else d['alto'],
            # le varianti hanno la stessa misura del padre (la ghianda in testa non deve rimpicciolire la lumaca)
            'altoPx': padre['altoPx'] if padre else hb * s, 'come': d.get('come'),
            'allineate': allineate}


def impacca(pezzi, lato):
    """Scaffali su più pagine: dal più alto al più basso, da sinistra a destra. pezzi = {id: Image}. Ritorna pagine e posizioni."""
    ordine = sorted(pezzi.items(), key=lambda kv: -kv[1].height)
    pagine, pos = [], {}
    x = y = alto_riga = 0
    pagina = 0
    for k, im in ordine:
        if im.width + MARGINE > lato or im.height + MARGINE > lato:
            raise SystemExit(f'fotogramma {k} troppo grande ({im.width}×{im.height}) per pagine da {lato}')
        if x + im.width + MARGINE > lato:
            x, y, alto_riga = 0, y + alto_riga + MARGINE, 0
        if y + im.height + MARGINE > lato:
            pagine.append(y + alto_riga)
            pagina += 1
            x = y = alto_riga = 0
        pos[k] = (pagina, x + MARGINE, y + MARGINE)
        x += im.width + MARGINE
        alto_riga = max(alto_riga, im.height + MARGINE)
    pagine.append(y + alto_riga + MARGINE)
    out = []
    for i, h in enumerate(pagine):
        hh = min(lato, max(64, (h + 63) // 64 * 64))
        out.append(Image.new('RGBA', (lato, hh), (0, 0, 0, 0)))
    for k, im in pezzi.items():
        p, x, y = pos[k]
        out[p].paste(im, (x, y))
    return out, pos


def webp(im, qualita, alfa=True):
    b = io.BytesIO()
    if alfa:
        im.save(b, 'WEBP', quality=qualita, method=6, alpha_quality=100)
    else:
        im.convert('RGB').save(b, 'WEBP', quality=qualita, method=6)
    return b.getvalue()


def cuci_fondale(fd, cart):
    """Fondale: centro (il campo del concept) + le ali a sinistra e a destra, cucite bordo a bordo (Codex le disegna come proseguimento
    del centro: la casetta continua, il prato pure). `sfuma` px di dissolvenza sulla cucitura (sovrapposti), `dy` per l'altezza.
    Ritorna immagine e offset x del centro."""
    c = Image.open(os.path.join(cart, fd['centro'])).convert('RGB')
    ali = fd.get('ala', 320)
    ali = ali if isinstance(ali, dict) else {'sinistra': ali, 'destra': ali}
    sfuma = fd.get('sfuma', {})
    lati = {}
    for lato in ('sinistra', 'destra'):
        if fd.get(lato) and os.path.exists(os.path.join(cart, fd[lato])):
            im = Image.open(os.path.join(cart, fd[lato])).convert('RGB')
            im = im.resize((round(im.width * c.height / im.height), c.height), Image.LANCZOS)
            dy = fd.get('dy', {}).get(lato, 0)
            if dy:
                t = Image.new('RGB', im.size)
                t.paste(im, (0, dy))
                t.paste(im.crop((0, 0, im.width, max(1, dy))).resize((im.width, max(1, dy))), (0, 0)) if dy > 0 else None
                im = t
            if fd.get('colore'):
                # stessa luce del centro: mediana del prato vicino alla cucitura, guadagno per canale
                fascia_c = c.crop((0, 300, 60, 800)) if lato == 'sinistra' else c.crop((c.width - 60, 300, c.width, 800))
                fascia_a = im.crop((im.width - 60, 300, im.width, 800)) if lato == 'sinistra' else im.crop((0, 300, 60, 800))
                mc, ma = ImageStat.Stat(fascia_c).median, ImageStat.Stat(fascia_a).median
                k = [max(0.8, min(1.25, mc[i] / max(1, ma[i]))) for i in range(3)]
                im = Image.merge('RGB', [b.point(lambda v, kk=kk: min(255, round(v * kk))) for b, kk in zip(im.split(), k)])
            lati[lato] = im
        elif fd.get('ali') == 'specchio':
            pezzo = c.crop((0, 0, ali[lato], c.height)) if lato == 'sinistra' else c.crop((c.width - ali[lato], 0, c.width, c.height))
            lati[lato] = pezzo.transpose(Image.FLIP_LEFT_RIGHT)
    x0 = ali['sinistra'] if 'sinistra' in lati else 0
    W = c.width + x0 + (ali['destra'] if 'destra' in lati else 0)
    out = Image.new('RGB', (W, c.height))
    out.paste(c, (x0, 0))
    def rampa(n, cresce):
        g = Image.linear_gradient('L').rotate(90 if cresce else -90, expand=True)
        return g.resize((n, c.height))
    if 'sinistra' in lati:
        L, sf, ala = lati['sinistra'], sfuma.get('sinistra', 0), ali['sinistra']
        pezzo = L.crop((L.width - ala - sf, 0, L.width, c.height))
        m = Image.new('L', pezzo.size, 255)
        if sf:
            m.paste(rampa(sf, False), (ala, 0))
        out.paste(pezzo, (0, 0), m)
    if 'destra' in lati:
        R, sf, ala = lati['destra'], sfuma.get('destra', 0), ali['destra']
        pezzo = R.crop((0, 0, ala + sf, c.height))
        m = Image.new('L', pezzo.size, 255)
        if sf:
            m.paste(rampa(sf, True), (0, 0))
        out.paste(pezzo, (x0 + c.width - sf, 0), m)
    return out, x0


def main(argv):
    if not argv:
        raise SystemExit(__doc__)
    man = os.path.abspath(argv[0])
    cart = os.path.dirname(man)
    solo = None
    controllo = '--senza-controllo' not in argv
    if '--solo' in argv:
        solo = set(argv[argv.index('--solo') + 1].split(','))
    M = json.load(open(man))
    cella, lato = M.get('cella', 200), M.get('pagina', 2048)
    out = os.path.join(ROOT, M['uscita'])
    os.makedirs(out, exist_ok=True)
    fatte, alias = {}, {}
    for k, d in M['sprite'].items():
        if 'alias' in d:
            alias[k] = d['alias']
            continue
        if solo and k not in solo and not any(v.get('scala_di') == k for kk, v in M['sprite'].items() if kk in solo):
            continue
        print(f'{k}:')
        fatte[k] = prepara_chiave(k, d, cart, cella, fatte)
    if solo:
        print('(--solo: niente pagine né pelle.json)')
    else:
        # pagine dell'atlas, coi fotogrammi uguali messi una volta sola
        pezzi, id_di, uguali = {}, {}, {}
        for k, c in fatte.items():
            for f, (im, off) in c['fotogrammi'].items():
                if im is None:
                    continue
                h = hashlib.md5(im.tobytes()).hexdigest()
                if h in uguali:
                    id_di[(k, f)] = uguali[h]
                    continue
                pid = f'{k}/{f}'
                pezzi[pid] = im
                uguali[h] = pid
                id_di[(k, f)] = pid
        pagine, pos = impacca(pezzi, lato)
        for vecchio in os.listdir(out):
            if vecchio.startswith(('atlas', 'fondale', 'ui-')) and vecchio.endswith(('.webp', '.png', '.jpg')):
                os.remove(os.path.join(out, vecchio))
        nomi_pagine, peso = [], 0
        for i, p in enumerate(pagine):
            b = webp(p, M.get('qualita', 85))
            n = f'atlas{i}-{hashlib.md5(b).hexdigest()[:8]}.webp'
            open(os.path.join(out, n), 'wb').write(b)
            nomi_pagine.append(n)
            peso += len(b)
            print(f'pagina {i}: {p.width}×{p.height}, {len(b) // 1024} KB')
        sprite = {}
        for k, c in fatte.items():
            clip = {}
            for nome, cd in c['clips'].items():
                righe = []
                for f in cd['f']:
                    im, off = c['fotogrammi'][f]
                    pg, x, y = pos[id_di[(k, f)]]
                    righe.append([pg, x, y, im.width, im.height, off[0], off[1]])
                clip[nome] = {'fps': cd['fps'], 'giro': cd['giro'], 'f': righe}
            sprite[k] = {'alto': c['alto'], 'altoPx': round(c['altoPx'], 2), 'px': round(c['piedi'][0], 2), 'py': round(c['piedi'][1], 2), 'clip': clip}
            if c['come']:
                sprite[k]['come'] = c['come']
        for k, a in alias.items():
            if a in sprite:
                sprite[k] = sprite[a]
        # pezzi della UI (il legno della barra e del cartello dei menù): ritagliati dal foglio di Codex
        ui = {}
        for nome, u in M.get('ui', {}).items():
            im = Image.open(os.path.join(cart, u['file'])).convert('RGBA')
            pz = pezzi_staccati(im)[u.get('pezzo', 0)]
            if u.get('larghezza') and pz.width > u['larghezza']:
                pz = pz.resize((u['larghezza'], round(pz.height * u['larghezza'] / pz.width)), Image.LANCZOS)
            b = webp(pz, 90)
            n = f'ui-{nome}-{hashlib.md5(b).hexdigest()[:8]}.webp'
            open(os.path.join(out, n), 'wb').write(b)
            peso += len(b)
            ui[nome] = n
            print(f'ui {nome}: {pz.width}×{pz.height}, {len(b) // 1024} KB')
        fd = M['fondale']
        fo, x0 = cuci_fondale(fd, cart)
        b = webp(fo, fd.get('qualita', 82), alfa=False)
        nf = f'fondale-{hashlib.md5(b).hexdigest()[:8]}.webp'
        open(os.path.join(out, nf), 'wb').write(b)
        peso += len(b)
        print(f'fondale: {fo.width}×{fo.height}, {len(b) // 1024} KB')
        campo = {n: [v[0] + x0, v[1]] for n, v in fd['campo'].items()}
        pelle = {'versione': 2, 'id': M['id'], 'nome': M['nome'], 'fondale': nf, 'pagine': nomi_pagine, 'campo': campo, 'cella': cella,
                 'volo': M.get('volo', 0.45), 'nomi': M.get('nomi', {}), 'tema': M['tema'], 'sprite': sprite}
        if M.get('suoni'):
            pelle['suoni'] = M['suoni']
        if ui:
            pelle['ui'] = {**ui, **M.get('ui_extra', {})}
        if M.get('consigli'):
            pelle['consigli'] = M['consigli']
        json.dump(pelle, open(os.path.join(out, 'pelle.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
        peso += os.path.getsize(os.path.join(out, 'pelle.json'))
        print(f'pelle {M["id"]}: {len(pezzi)} fotogrammi su {len(pagine)} pagine, {peso / 1048576:.2f} MB in tutto (senza suoni)')
        if peso / 1048576 > TETTO_MB:
            raise SystemExit(f'troppo pesante: {peso / 1048576:.2f} MB > {TETTO_MB} MB (abbassa cella o qualita)')
        if controllo:
            foglio_campo(cart, fo, campo, fatte, cella)
    if controllo:
        fogli_chiavi(cart, fatte)


# ---------- foglio di controllo (fuori dal gioco) ----------
def fogli_chiavi(cart, fatte):
    dove = os.path.join(cart, '_controllo')
    os.makedirs(dove, exist_ok=True)
    for k, c in fatte.items():
        px, py = c['piedi']
        tutti = []
        for nome, cd in c['clips'].items():
            for f in cd['f']:
                tutti.append((nome, f))
        if not tutti:
            continue
        # tela comune: unione delle scatole di tutti i fotogrammi attorno ai piedi
        x0 = min(off[0] for im, off in c['fotogrammi'].values() if im)
        y0 = min(off[1] for im, off in c['fotogrammi'].values() if im)
        x1 = max(off[0] + im.width for im, off in c['fotogrammi'].values() if im)
        y1 = max(off[1] + im.height for im, off in c['fotogrammi'].values() if im)
        w, h = x1 - x0 + 8, y1 - y0 + 26
        foglio = Image.new('RGB', (w * (len(tutti) + 1), h), (74, 122, 58))
        d = ImageDraw.Draw(foglio)
        for i, (nome, f) in enumerate(tutti):
            im, off = c['fotogrammi'][f]
            foglio.paste(im, (i * w + 4 + off[0] - x0, 4 + off[1] - y0), im)
            fx, fy = i * w + 4 + px - x0, 4 + py - y0
            d.line([(fx - 8, fy), (fx + 8, fy)], fill=(255, 0, 255), width=2)
            d.line([(fx, fy - 8), (fx, fy + 8)], fill=(255, 0, 255), width=2)
            d.text((i * w + 4, h - 18), f'{nome}:{f}'[:28], fill=(255, 255, 255))
        # cipolla: tutti i fotogrammi al 35 % sopra la base
        i = len(tutti)
        cip = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        for nome, f in tutti:
            im, off = c['fotogrammi'][f]
            t = Image.new('RGBA', (w, h), (0, 0, 0, 0))
            t.paste(im, (4 + off[0] - x0, 4 + off[1] - y0), im)
            t.putalpha(t.getchannel('A').point(lambda v: v * 35 // 100))
            cip = Image.alpha_composite(cip, t)
        foglio.paste(cip, (i * w, 0), cip)
        d.text((i * w + 4, h - 18), 'cipolla', fill=(255, 255, 255))
        foglio.save(os.path.join(dove, f'{k}.png'))
        # una GIF per clip (fotogrammi a 8 al secondo o al loro fps)
        for nome, cd in c['clips'].items():
            if len(cd['f']) < 2:
                continue
            quadri = []
            for f in cd['f']:
                im, off = c['fotogrammi'][f]
                q = Image.new('RGB', (w, h - 22), (74, 122, 58))
                q.paste(im, (4 + off[0] - x0, 4 + off[1] - y0), im)
                quadri.append(q)
            quadri[0].save(os.path.join(dove, f'{k}_{nome}.gif'), save_all=True, append_images=quadri[1:],
                           duration=round(1000 / (cd['fps'] or 8)), loop=0, disposal=2)
    print(f'controllo: {dove}')


def foglio_campo(cart, fo, campo, fatte, cella):
    """Il fondale con la griglia 5 × 9 e i personaggi in campo alla misura del gioco (come lo disegna skin.ts)."""
    tl, tr, bl, br = campo['tl'], campo['tr'], campo['bl'], campo['br']

    def p(x, y):
        u, v = x / 9, y / 5
        ax, ay = tl[0] + (tr[0] - tl[0]) * u, tl[1] + (tr[1] - tl[1]) * u
        bx, by = bl[0] + (br[0] - bl[0]) * u, bl[1] + (br[1] - bl[1]) * u
        return (ax + (bx - ax) * v, ay + (by - ay) * v)
    c = fo.copy().convert('RGBA')
    d = ImageDraw.Draw(c)
    for x in range(10):
        d.line([p(x, 0), p(x, 5)], fill=(255, 0, 255, 180), width=2)
    for y in range(6):
        d.line([p(0, y), p(9, y)], fill=(255, 0, 255, 180), width=2)
    posti = [('produttore', 0, 0), ('sparatore', 1, 0), ('gelo', 2, 0), ('muro', 3, 0), ('mina', 4, 0), ('bomba', 5, 0),
             ('base', 7, 0), ('cono', 8, 0), ('secchio', 7, 1), ('bandiera', 8, 1), ('saltatore', 6, 1),
             ('produttore', 0, 2), ('sparatore', 1, 2), ('muro', 4, 2), ('base', 6, 2), ('secchio', 8, 2),
             ('sparatore', 1, 3), ('cono', 5, 3), ('produttore', 0, 4), ('gelo', 1, 4), ('saltatore', 7, 4)]
    for k, col, corsia in posti:
        if k not in fatte:
            continue
        ch = fatte[k]
        prima = next(iter(ch['clips'].values()))['f'][0]
        im, off = ch['fotogrammi'][prima]
        x, y = p(col + 0.5, corsia + 0.8)
        H = p(4.5, corsia + 1)[1] - p(4.5, corsia)[1]
        kk = H / cella
        w2, h2 = max(1, round(im.width * kk)), max(1, round(im.height * kk))
        im2 = im.resize((w2, h2), Image.LANCZOS)
        px, py = ch['piedi']
        c.alpha_composite(im2, (round(x - (px - off[0]) * kk), round(y - (py - off[1]) * kk)))
    for k, col, corsia in [('tosaerba', -0.3, r) for r in range(5)]:
        if k not in fatte:
            continue
        ch = fatte[k]
        im, off = ch['fotogrammi'][next(iter(ch['clips'].values()))['f'][0]]
        x, y = p(col, corsia + 0.8)
        H = p(4.5, corsia + 1)[1] - p(4.5, corsia)[1]
        kk = H / cella
        im2 = im.resize((max(1, round(im.width * kk)), max(1, round(im.height * kk))), Image.LANCZOS)
        px, py = ch['piedi']
        c.alpha_composite(im2, (round(x - (px - off[0]) * kk), round(y - (py - off[1]) * kk)))
    dove = os.path.join(cart, '_controllo')
    os.makedirs(dove, exist_ok=True)
    c.convert('RGB').save(os.path.join(dove, 'campo.jpg'), quality=88)
    print(f'controllo: {os.path.join(dove, "campo.jpg")}')


if __name__ == '__main__':
    main(sys.argv[1:])
