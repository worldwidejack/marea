#!/usr/bin/env python3
"""MAREA — fotogrammi di Codex → animazione della Difesa (#358), col metodo delle pose di Gigi.

Ogni fotogramma è un PNG con alpha (Codex lo genera come modifica della posa base). Qui:
- pulizia dell'alpha (via la polvere quasi trasparente);
- stessa scala per tutti (quella del primo fotogramma, la posa base);
- piedi sulla stessa riga di terra (riga più bassa non trasparente);
- allineamento orizzontale: lo spostamento che sovrappone meglio la sagoma a quella della base (niente scatti tra un fotogramma e l'altro);
- uscita: i fotogrammi allineati (stesso quadrato), una striscia e una GIF d'anteprima su fondo pieno.

Uso: python3 tools/difesa_anim.py <out_dir> <nome> <fps> <f1.png> <f2.png> ... [--fondo #4a7a3a] [--lato 256] [--pixel]
"""
import os
import sys
from PIL import Image, ImageChops


def pulisci(im):
    im = im.convert('RGBA')
    a = im.getchannel('A').point(lambda v: 0 if v < 8 else v)
    im.putalpha(a)
    return im


def sagoma(im, lato):
    return im.getchannel('A').point(lambda v: 255 if v > 128 else 0).resize((lato, lato), Image.NEAREST)


def sovrapposizione(a, b):
    """Pixel in comune meno pixel diversi tra due sagome 0/255 della stessa misura."""
    comune = ImageChops.logical_and(a.convert('1'), b.convert('1')).histogram()[-1]
    diversi = ImageChops.difference(a, b).histogram()[-1]
    return comune - diversi * 0.5


def sposta(im, dx, dy):
    """Sposta senza far rientrare i pezzi dal lato opposto (ImageChops.offset li fa girare attorno)."""
    out = Image.new(im.mode, im.size, (0, 0, 0, 0) if im.mode == 'RGBA' else 0)
    out.paste(im, (dx, dy))
    return out


def terra(im):
    bb = im.getchannel('A').point(lambda v: 255 if v > 128 else 0).getbbox()
    return bb[3] if bb else im.height


def main(argv):
    out, nome, fps = argv[0], argv[1], float(argv[2])
    fondo, lato, pixel, files = (74, 122, 58), 256, False, []
    i = 3
    while i < len(argv):
        if argv[i] == '--fondo': h = argv[i + 1].lstrip('#'); fondo = tuple(int(h[k:k + 2], 16) for k in (0, 2, 4)); i += 2
        elif argv[i] == '--lato': lato = int(argv[i + 1]); i += 2
        elif argv[i] == '--pixel': pixel = True; i += 1
        else: files.append(argv[i]); i += 1
    os.makedirs(out, exist_ok=True)
    fr = [pulisci(Image.open(f)) for f in files]
    W, H = fr[0].size
    fr = [f if f.size == (W, H) else f.resize((W, H), Image.NEAREST if pixel else Image.LANCZOS) for f in fr]
    base = fr[0]
    g0 = terra(base)
    piccolo = 160
    # l'allineamento guarda solo dentro la sagoma della base (un colpo sparato o uno sbuffo fuori non lo tirano via)
    bb = base.getchannel('A').point(lambda v: 255 if v > 128 else 0).getbbox()
    k = piccolo / W
    zona = tuple(round(v * k) for v in bb)
    sb = sagoma(base, piccolo).crop(zona)
    allineati = [base]
    for k, f in enumerate(fr[1:], 2):
        dy = g0 - terra(f)
        f = sposta(f, 0, dy)
        sf = sagoma(f, piccolo)
        best, bdx = None, 0
        for dx in range(-14, 15):
            v = sovrapposizione(sb, sposta(sf, dx, 0).crop(zona))
            if best is None or v > best: best, bdx = v, dx
        dx = round(bdx * W / piccolo)
        allineati.append(sposta(f, dx, 0))
        print(f'{nome}_{k}: terra {dy:+d} px, spostato di {dx:+d} px')
    ricampiona = Image.NEAREST if pixel else Image.LANCZOS
    piccoli = []
    for k, f in enumerate(allineati, 1):
        f.save(os.path.join(out, f'{nome}_{k}_allineato.png'))
        p = Image.new('RGB', (lato, lato), fondo)
        q = f.resize((lato, lato), ricampiona)
        p.paste(q, (0, 0), q)
        piccoli.append(p)
    striscia = Image.new('RGB', (lato * len(piccoli) + 6 * (len(piccoli) - 1), lato), (30, 30, 30))
    for k, p in enumerate(piccoli): striscia.paste(p, (k * (lato + 6), 0))
    striscia.save(os.path.join(out, f'{nome}_striscia.png'))
    piccoli[0].save(os.path.join(out, f'{nome}.gif'), save_all=True, append_images=piccoli[1:], duration=round(1000 / fps), loop=0, disposal=2)
    print(f'{out}/{nome}.gif ({len(piccoli)} fotogrammi a {fps} al secondo)')


if __name__ == '__main__':
    main(sys.argv[1:])
