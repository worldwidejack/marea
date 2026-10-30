#!/usr/bin/env python3
"""MAREA — il foglio degli sprite di un personaggio, da guardare prima che entrino nel gioco (e da allegare alla PR).

Per ogni mossa un blocco: le 9 viste disegnate in righe (S → N passando da destra; le 7 del lato sinistro sono lo specchio)
e i 4 disegni in colonne, ingranditi a pixel netti, ogni riga sulla sua linea di terra (si vede se i piedi ballano o se
una vista ha la testa più grande). Sotto, la camminata in piccolo, tutte le viste in fila.
Scrive <cartella>/_FOGLIO_sprite.jpg (nel repo vanno i JPG; i PNG restano sul computer).

Uso:  python tools/sprite/foglio.py <cartella> [--mosse cammina,scatto,bevi] [--zoom 4] [--titolo "…"] [--apri]
"""
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comune import CARTA, CODICI, FONDO, GRIGIO, INK, NOME_VISTA, cartella_da_argomenti, font, leggi_scheda, opzione  # noqa: E402


def apri(p):
    try:
        if sys.platform == 'darwin':
            subprocess.run(['open', p])
        elif os.name == 'nt':
            os.startfile(p)  # noqa: S606
        else:
            subprocess.Popen(['xdg-open', p])
    except Exception:
        pass


def main():
    cartella = cartella_da_argomenti(__doc__)
    scheda = leggi_scheda(cartella)
    cart = os.path.join(cartella, 'sprite')
    elenco = json.load(open(os.path.join(cart, 'elenco.json'), encoding='utf-8'))
    tutte = sorted({k.rsplit('_', 2)[1] for k in elenco})
    ordine = list(scheda['mosse']) + [m for m in tutte if m not in scheda['mosse']]
    mosse = [m for m in (opzione('mosse', '') or ','.join(ordine)).split(',') if m in tutte]
    viste = [v for v in CODICI if any(k.startswith(v + '_') for k in elenco)]
    K = int(opzione('zoom', 4))
    sp = {k: Image.open(os.path.join(cart, k + '.png')).convert('RGBA') for k in elenco}
    cw = max(i.width for i in sp.values()) * K + 16
    ch = max(i.height for i in sp.values()) * K + 14
    lab, sx, top = 150, 40, 210
    blocco = 4 * cw + 30
    W = max(sx + lab + len(mosse) * blocco + sx, 1500)  # almeno quanto il titolo e le due righe sotto
    piccoli_h = max(i.height for i in sp.values()) * 2 + 90
    H = top + 60 + len(viste) * ch + piccoli_h + 40
    fo = Image.new('RGB', (W, H), CARTA)
    d = ImageDraw.Draw(fo)
    nome = scheda.get('nome', os.path.basename(cartella))
    d.text((sx, 30), opzione('titolo', f'MAREA · {nome} a sprite'), fill=INK, font=font(56, True))
    viste_txt = ('9 viste disegnate (le altre 7 direzioni sono lo specchio)' if len(viste) == 9
                 else f'{len(viste)} {"vista disegnata" if len(viste) == 1 else "viste disegnate"} su 9 '
                      f'(mancano {" ".join(v for v in CODICI if v not in viste)})')
    d.text((sx, 108), f"{viste_txt} · 4 disegni per mossa · {len(elenco)} sprite, alti {scheda['alto']} px, qui ×{K}",
           fill=GRIGIO, font=font(28))
    d.text((sx, 148), 'Ogni riga sta sulla sua linea di terra: i piedi devono toccarla, la testa non deve cambiare taglia.',
           fill=GRIGIO, font=font(28))
    for j, m in enumerate(mosse):
        x0 = sx + lab + j * blocco
        d.text((x0, top), m, fill=INK, font=font(40, True))
        for i, v in enumerate(viste):
            y0 = top + 60 + i * ch
            d.rectangle((x0, y0, x0 + 4 * cw - 8, y0 + ch - 8), fill=FONDO)
            terra = y0 + ch - 14
            d.line([(x0 + 4, terra), (x0 + 4 * cw - 12, terra)], fill=(205, 196, 184), width=2)
            for n in range(1, 5):
                k = f'{v}_{m}_{n}'
                if k not in sp:
                    d.text((x0 + (n - 1) * cw + cw // 2 - 8, y0 + ch // 2 - 20), '—', fill=GRIGIO, font=font(30))
                    continue
                im = sp[k]
                g = im.resize((im.width * K, im.height * K), Image.NEAREST)
                # il punto d'appoggio (ax, ay) sulla linea di terra
                e = elenco[k]
                fo.paste(g, (x0 + (n - 1) * cw + cw // 2 - e['ax'] * K, terra - e['ay'] * K), g)
    for i, v in enumerate(viste):
        y0 = top + 60 + i * ch
        d.text((sx, y0 + ch // 2 - 34), v, fill=INK, font=font(34, True))
        d.text((sx, y0 + ch // 2 + 8), NOME_VISTA[v], fill=GRIGIO, font=font(19))
    # in piccolo (×2): la prima mossa, disegno 1, tutte le viste in fila, poi lo specchio a ritroso (il giro completo)
    y0 = H - piccoli_h - 20
    m0 = mosse[0]
    d.text((sx, y0), f'in piccolo (×2): {m0}, il giro delle 16 direzioni (a destra le specchiate)', fill=GRIGIO, font=font(26))
    x, terra = sx, H - 50
    giro = [(v, False) for v in viste] + [(v, True) for v in reversed(viste[1:-1])]
    for v, specchio in giro:
        k = f'{v}_{m0}_1'
        if k not in sp:
            continue
        im = sp[k].transpose(Image.FLIP_LEFT_RIGHT) if specchio else sp[k]
        g = im.resize((im.width * 2, im.height * 2), Image.NEAREST)
        fo.paste(g, (x, terra - g.height), g)
        x += g.width + 18
    out = os.path.join(cartella, '_FOGLIO_sprite.jpg')
    fo.save(out, quality=92, subsampling=0)
    print(out, fo.size, f'{os.path.getsize(out) // 1024} KB', '· mosse', ', '.join(mosse), '· viste', ' '.join(viste))
    if '--apri' in sys.argv:
        apri(out)


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    main()
