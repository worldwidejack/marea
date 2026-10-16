#!/usr/bin/env python3
"""MAREA — foglio di confronto della Difesa (#358): immagini numerate con la didascalia sotto, in colonne, da guardare anche sul telefono.

Uso:  python3 tools/difesa_foglio.py <out.jpg> [--colonne 2] [--larga 960] <immagine>=<didascalia> ...
      il numero del riquadro è la posizione nell'elenco (1, 2, 3…); la didascalia può avere « · » per andare a capo.
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

FONT = next((f for f in ('/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/Library/Fonts/Arial Bold.ttf',
                         '/System/Library/Fonts/Helvetica.ttc', '/System/Library/Fonts/Supplemental/Arial.ttf') if os.path.exists(f)), None)


def font(px):
    return ImageFont.truetype(FONT, px) if FONT else ImageFont.load_default()


def main(argv):
    out, colonne, larga, voci = argv[0], 2, 960, []
    i = 1
    while i < len(argv):
        if argv[i] == '--colonne':
            colonne = int(argv[i + 1]); i += 2; continue
        if argv[i] == '--larga':
            larga = int(argv[i + 1]); i += 2; continue
        f, _, testo = argv[i].partition('=')
        voci.append((f, testo)); i += 1
    GAP, TESTO = 16, 92
    imgs = []
    for f, testo in voci:
        im = Image.open(f).convert('RGB')
        imgs.append((im.resize((larga, round(im.height * larga / im.width)), Image.LANCZOS), testo))
    alta = max(im.height for im, _ in imgs)
    righe = (len(imgs) + colonne - 1) // colonne
    W = colonne * larga + (colonne + 1) * GAP
    H = righe * (alta + TESTO) + (righe + 1) * GAP
    foglio = Image.new('RGB', (W, H), (24, 22, 28))
    d = ImageDraw.Draw(foglio)
    fn, ft, fs = font(54), font(30), font(24)
    for n, (im, testo) in enumerate(imgs):
        x = GAP + (n % colonne) * (larga + GAP)
        y = GAP + (n // colonne) * (alta + TESTO + GAP)
        foglio.paste(im, (x, y))
        # numero grande in un tondo giallo in alto a sinistra
        r = 44
        d.ellipse((x + 12, y + 12, x + 12 + 2 * r, y + 12 + 2 * r), fill=(255, 214, 64), outline=(20, 20, 20), width=4)
        num = str(n + 1)
        bw = d.textlength(num, font=fn)
        d.text((x + 12 + r - bw / 2, y + 12 + r - 32), num, font=fn, fill=(20, 20, 20))
        righe_t = [t.strip() for t in testo.split(' · ')]
        d.text((x + 4, y + im.height + 10), righe_t[0], font=ft, fill=(255, 255, 255))
        if len(righe_t) > 1:
            d.text((x + 4, y + im.height + 50), ' · '.join(righe_t[1:]), font=fs, fill=(200, 200, 210))
    foglio.save(out, quality=88)
    print(f'{out}: {W}×{H}, {len(imgs)} riquadri')


if __name__ == '__main__':
    main(sys.argv[1:])
