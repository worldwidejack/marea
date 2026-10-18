#!/usr/bin/env python3
"""MAREA — dalle immagini di Codex alla pelle della Difesa (#358): fondale + atlas di sprite + pelle.json per apps/client/src/difesa/skin.ts.

Ogni foglio è una griglia (colonne × righe) di personaggi su fondo trasparente (o finto trasparente: un colore pieno, che si toglie
riempiendo dai bordi). Per ogni cella: scontorno, ritaglio al contenuto, scala all'altezza giusta, piedi = centro in basso. Gli sprite
finiscono in un atlas da 1024 × 1024 al massimo; il fondale diventa un JPG. Esce anche un foglio di controllo con la griglia del campo
disegnata sul fondale e gli sprite coi piedi segnati.

Uso:
  python3 tools/difesa_sprite.py <id> --nome "L'orto" --fondale fondale.png --campo "x,y x,y x,y x,y" \\
      --foglio difensori.png 3x2 sparatore,produttore,bomba,muro,mina,gelo \\
      --foglio nemici.png 3x2 base,bandiera,cono,saltatore,secchio,- \\
      --foglio oggetti.png 3x2 colpo,colpoGelo,moneta,tosaerba,minaSotto,- \\
      [--pixel] [--tema tema.json] [--nomi nomi.json] [--controllo out.jpg]
  --campo: angoli del campo 5 × 9 sul fondale (alto-sinistra, alto-destra, basso-sinistra, basso-destra), in px del fondale.
  «-» = cella da saltare.
"""
import json
import os
import sys
from collections import deque
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
# altezza dello sprite in caselle (quanto è alto in gioco rispetto a una casella) e altezza in px nell'atlas
ALTO = {'sparatore': 0.95, 'produttore': 0.95, 'bomba': 0.85, 'muro': 1.0, 'mina': 0.62, 'minaSotto': 0.5, 'gelo': 0.95,
        'base': 1.2, 'bandiera': 1.3, 'cono': 1.3, 'saltatore': 1.3, 'secchio': 1.3,
        'colpo': 0.24, 'colpoGelo': 0.24, 'moneta': 0.5, 'tosaerba': 0.6}
PX = {'colpo': 64, 'colpoGelo': 64, 'moneta': 96, 'minaSotto': 128, 'tosaerba': 160}


def alfa_da_bordi(im, toll=40):
    """Se l'immagine non ha trasparenza vera, toglie il colore del fondo riempiendo dai bordi (colori vicini a quelli degli angoli)."""
    im = im.convert('RGBA')
    px = im.load()
    w, h = im.size
    trasparenti = sum(1 for x in range(0, w, 7) for y in range(0, h, 7) if px[x, y][3] < 20)
    if trasparenti > (w // 7) * (h // 7) * 0.2:
        return im
    fondi = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    vicino = lambda c: any(abs(c[0] - f[0]) + abs(c[1] - f[1]) + abs(c[2] - f[2]) < toll for f in fondi)
    visto = bytearray(w * h)
    q = deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or visto[y * w + x]:
            continue
        visto[y * w + x] = 1
        if not vicino(px[x, y]):
            continue
        px[x, y] = (0, 0, 0, 0)
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return im


def taglia(im, colonne, righe):
    w, h = im.size
    for r in range(righe):
        for c in range(colonne):
            yield im.crop((c * w // colonne, r * h // righe, (c + 1) * w // colonne, (r + 1) * h // righe))


def ritaglia(cella):
    a = cella.split()[3].point(lambda v: 255 if v > 24 else 0)
    bb = a.getbbox()
    return cella.crop(bb) if bb else None


def impacca(sprite, lato=1024, margine=2):
    """Scaffali: dal più alto al più basso, da sinistra a destra."""
    ordine = sorted(sprite.items(), key=lambda kv: -kv[1].height)
    x = y = alto_riga = 0
    pos = {}
    for k, im in ordine:
        if x + im.width + margine > lato:
            x, y, alto_riga = 0, y + alto_riga + margine, 0
        pos[k] = (x, y)
        x += im.width + margine
        alto_riga = max(alto_riga, im.height)
    altezza = y + alto_riga
    if altezza > lato:
        raise SystemExit(f'atlas troppo pieno: {altezza} px > {lato} (riduci PX o le altezze)')
    h = 1 << (altezza - 1).bit_length()
    atlas = Image.new('RGBA', (lato, max(64, h)), (0, 0, 0, 0))
    for k, im in sprite.items():
        atlas.paste(im, pos[k])
    return atlas, pos


def main(argv):
    pid = argv[0]
    nome, fondale, campo, pixel, tema, nomi, controllo, fogli = pid, None, None, False, None, {}, None, []
    i = 1
    while i < len(argv):
        a = argv[i]
        if a == '--nome': nome = argv[i + 1]; i += 2
        elif a == '--fondale': fondale = argv[i + 1]; i += 2
        elif a == '--campo': campo = [tuple(float(v) for v in p.split(',')) for p in argv[i + 1].split()]; i += 2
        elif a == '--pixel': pixel = True; i += 1
        elif a == '--tema': tema = json.load(open(argv[i + 1])); i += 2
        elif a == '--nomi': nomi = json.load(open(argv[i + 1])); i += 2
        elif a == '--controllo': controllo = argv[i + 1]; i += 2
        elif a == '--foglio':
            c, r = (int(v) for v in argv[i + 2].lower().split('x'))
            fogli.append((argv[i + 1], c, r, argv[i + 3].split(','))); i += 4
        else: raise SystemExit(f'argomento sconosciuto: {a}')
    if not fondale or not campo or len(campo) != 4:
        raise SystemExit('servono --fondale e --campo con 4 angoli')
    out = os.path.join(ROOT, 'apps/client/public/assets/difesa', pid)
    os.makedirs(out, exist_ok=True)
    ricampiona = Image.NEAREST if pixel else Image.LANCZOS
    sprite = {}
    for f, c, r, chiavi in fogli:
        im = alfa_da_bordi(Image.open(f))
        for k, cella in zip(chiavi, taglia(im, c, r)):
            if k == '-':
                continue
            t = ritaglia(cella)
            if t is None:
                print(f'  ! {k}: cella vuota in {f}'); continue
            hpx = PX.get(k, 200)
            s = hpx / t.height
            sprite[k] = t.resize((max(1, round(t.width * s)), hpx), ricampiona)
    atlas, pos = impacca(sprite)
    atlas.save(os.path.join(out, 'atlas.png'), optimize=True)
    fo = Image.open(fondale).convert('RGB')
    fo.save(os.path.join(out, 'fondale.jpg'), quality=86)
    defs = {k: {'x': pos[k][0], 'y': pos[k][1], 'w': im.width, 'h': im.height, 'px': im.width / 2, 'py': im.height - 2, 'alto': ALTO.get(k, 1.0)} for k, im in sprite.items()}
    tl, tr, bl, br = campo
    pelle = {'id': pid, 'nome': nome, 'pixel': pixel, 'fondale': 'fondale.jpg', 'atlas': 'atlas.png',
             'campo': {'tl': tl, 'tr': tr, 'bl': bl, 'br': br}, 'sprite': defs, 'nomi': nomi,
             'tema': tema or {'pannello': 'rgba(40,30,22,0.9)', 'bordo': '#c99a5b', 'testo': '#fff6e0', 'ombra': '#1b120c', 'accento': '#ffd23f',
                              'carta': '#f3e3c0', 'cartaBordo': '#8a5a2b', 'barra': '#3b2a1c', 'barraPiena': '#7fd35a', 'sfondo': '#2e2a24'}}
    json.dump(pelle, open(os.path.join(out, 'pelle.json'), 'w'), ensure_ascii=False, indent=1)
    print(f'{out}: atlas {atlas.size[0]}×{atlas.size[1]} ({os.path.getsize(os.path.join(out, "atlas.png")) // 1024} KB), {len(sprite)} sprite, fondale {fo.size[0]}×{fo.size[1]} ({os.path.getsize(os.path.join(out, "fondale.jpg")) // 1024} KB)')
    if controllo:
        # griglia del campo sul fondale + gli sprite in fila coi piedi segnati
        c = fo.copy()
        d = ImageDraw.Draw(c)
        def p(x, y):
            u, v = x / 9, y / 5
            ax, ay = tl[0] + (tr[0] - tl[0]) * u, tl[1] + (tr[1] - tl[1]) * u
            bx, by = bl[0] + (br[0] - bl[0]) * u, bl[1] + (br[1] - bl[1]) * u
            return (ax + (bx - ax) * v, ay + (by - ay) * v)
        for x in range(10): d.line([p(x, 0), p(x, 5)], fill=(255, 0, 255), width=3)
        for y in range(6): d.line([p(0, y), p(9, y)], fill=(255, 0, 255), width=3)
        W = max(c.width, sum(im.width + 8 for im in sprite.values()))
        foglio = Image.new('RGB', (W, c.height + 230), (40, 36, 44))
        foglio.paste(c, (0, 0))
        x = 4
        for k, im in sprite.items():
            foglio.paste(im, (x, c.height + 10), im)
            dd = ImageDraw.Draw(foglio)
            dd.line([(x + im.width / 2 - 8, c.height + 10 + im.height - 2), (x + im.width / 2 + 8, c.height + 10 + im.height - 2)], fill=(255, 0, 255), width=3)
            dd.text((x, c.height + 214), k, fill=(255, 255, 255))
            x += im.width + 8
        foglio.save(controllo, quality=85)
        print(f'controllo: {controllo}')


if __name__ == '__main__':
    main(sys.argv[1:])
