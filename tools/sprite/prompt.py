#!/usr/bin/env python3
"""MAREA — i prompt per Codex (o ChatGPT) che disegnano gli sprite di un personaggio, dalla scheda: <cartella>/lavori.txt.

La ricetta che ha funzionato al primo colpo nella prova dei look (108 disegni da 9 fogli, tutti buoni):
- la riga di stile IN TESTA («TRUE PIXEL ART, the most important thing…»): la cosa più importante va per prima (nei giri
  del personaggio Codex ha rispettato la testa grande solo quando la frase della testa stava in testa al prompt);
- una vista per immagine: un foglio = una vista, 4 colonne (i 4 disegni della mossa) × una riga per mossa (al massimo 3),
  la camminata sempre nella prima riga (fa da metro: altezza e piedi), fondo magenta pieno #FF00FF;
- allegati: la vista giusta del modello approvato (il foglio delle 5 viste) e il disegno approvato; dal giro 2 anche il
  foglio a pixel già fatto della vista vicina, «dello stesso artista»: stessa grandezza dei pixel, tavolozza, testa.
Giro 1: SE, E, NE (dal modello). Giro 2, dopo l'ok sul giro 1: S, SSE, ESE, ENE, NNE, N. 9 viste + 7 specchiate = 16 direzioni.

Uso:  python tools/sprite/prompt.py <cartella> [--giro 1|2] [--viste SE,E] [--mosse cammina,scatto,bevi]
      python tools/sprite/prompt.py <cartella> --modello [--testa 45]   il foglio delle 5 viste sopra la sagoma grigia
      python tools/sprite/prompt.py <cartella> --stampa <nome>           un prompt e le immagini da allegare, per ChatGPT
Ogni riga di lavori.txt: nome|immagine,immagine|prompt (immagini relative alla cartella); genera.py le manda a Codex e
salva fogli/<nome>.png (modello/<nome>.png per il foglio delle 5 viste). Con ChatGPT a mano: --stampa, allega le immagini nell'ordine, salva il PNG in fogli/<nome>.png.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comune import (CODICI, GIRO1, GIRO2, PRONOMI, VISTE, VISTE_MODELLO, cartella_da_argomenti, leggi_scheda,  # noqa: E402
                    nome_foglio, opzione)

STILE = ('TRUE PIXEL ART, the most important thing: a retro 2D game sprite sheet made of big square pixels on a visible pixel '
         'grid, like a 16-bit SNES / GBA RPG sprite, NO anti-aliasing, NO gradients, NO smooth painting, a small limited palette '
         '(about 14 flat colours), a 1-pixel dark outline around the figure.')
DALL_ALTO = 'seen slightly from above like an isometric RPG character'
FRASE = {v[0]: v[3] for v in VISTE}

MODELLO = (
    'HEAD FIRST, the most important thing: in EVERY view the head (hair included) is as tall as {testa} % of the whole figure, '
    'exactly filling the big grey head shapes of the FIRST image, on a small short body: NOT normal human proportions. Two '
    'images are attached. The FIRST image is a grey proportion guide with FIVE silhouettes in one row on a plain warm-grey '
    'background: draw the SAME character five times EXACTLY over the five grey silhouettes, same positions, same total height, '
    'the feet of all five on the same line; the grey silhouettes disappear completely under the drawing. The SECOND image is '
    'the approved character design: keep EXACTLY the face, hair, skin, outfit and drawing style of the SECOND image ({desc}), '
    'change only the pose and the angle. THE FIVE VIEWS, from left to right: 1) FRONT view, facing the viewer; 2) THREE-QUARTER '
    'FRONT view, body and face turned 45 degrees toward the right of the image; 3) SIDE PROFILE view facing right; 4) '
    'THREE-QUARTER BACK view, {he} faces away from the viewer and toward the upper right: we see {his} back, the back of {his} '
    'head and a little of the right cheek and ear; 5) BACK view: only {his} back and the back of {his} head. It is a CHARACTER '
    'TURNAROUND MODEL SHEET: the five views match each other exactly (same hair shape and volume from different angles, same '
    'height, same head size, same clothes), straight-on eye-level orthographic views, no perspective, not seen from above. '
    'POSE: the same neutral standing pose in all five views: standing straight, feet slightly apart, arms straight down and '
    'held slightly away from the body (about 12 degrees, a small gap of background between arm and torso), hands relaxed; '
    'the same calm face. {carattere}FRAME: landscape image 1536x1024, the five figures evenly spaced in one row, each one whole '
    'and separate with a clear gap of background between them, nothing overlapping. Plain flat light warm-grey background '
    '#E9E4DC and nothing else: no floor, no cast shadows, no text, no labels, no numbers, no arrows, no border, no guide lines. '
    'AVOID: a different hairstyle in some view, a sixth figure, perspective, dynamic poses, extra or missing fingers.')


def pixel(scheda, vista, mosse, rif_viste, stile_vicino):
    he, his = PRONOMI.get(scheda['pronome'], PRONOMI['he'])
    frase = FRASE[vista].format(he=he, his=his)
    if vista in VISTE_MODELLO:
        view = f'VIEW: {frase}, {DALL_ALTO} (the FIRST image shows this view).'
    else:
        view = f'VIEW: {frase}, {DALL_ALTO}.'
    desc = scheda['descrizione']
    if stile_vicino:
        chi = ('Attached images: the first image(s) show the character from the angles named above, the last one is the style '
               f'reference; copy EXACTLY the same character ({desc}).')
    else:
        chi = (f'{"Three" if scheda.get("stile") else "Two"} images are attached. The FIRST image is the character seen from the '
               'needed angle, the SECOND image is the approved character design: copy EXACTLY the same character '
               f'({desc}), only turned into pixel art.')
        if scheda.get('stile'):
            chi += (' The THIRD image is an existing pixel art sheet of another character of the same game: match EXACTLY its '
                    'pixel size, palette style, outline and proportions (big head, short body).')
    n = len(mosse)
    layout = (f'LAYOUT: one image, a grid of 4 columns x {n} rows = {4 * n} frames on a flat pure magenta background #FF00FF '
              '(no floor, no shadow, no text, no grid lines), each frame the same size, the character the same size in every '
              f'frame and {his} feet on the same baseline in every cell of a row, nothing touching the cell borders, a wide empty '
              'magenta gap between the rows (no hair or foot crosses into another row).')
    righe = ' '.join(f'ROW {i} = {scheda["mosse"][m]}.' for i, m in enumerate(mosse, 1))
    fine = f'All {4 * n} frames in the SAME view and the same pixel scale.'
    if stile_vicino:
        fine += (' The LAST attached image is an existing pixel art sheet of the SAME character from a nearby angle: match '
                 'EXACTLY its pixel size, palette, outline, proportions, head size and frame layout, so the new sheet looks drawn '
                 'by the same artist.')
    return ' '.join([STILE, view, chi, layout, righe, fine])


def righe_pixel(cartella, scheda):
    giro = opzione('giro', '1')
    mosse_tutte = [m for m in (opzione('mosse', '') or ','.join(scheda['mosse'])).split(',') if m]
    for m in mosse_tutte:
        if m not in scheda['mosse']:
            sys.exit(f'la mossa «{m}» non è nella scheda (mosse: {", ".join(scheda["mosse"])})')
    if 'cammina' in scheda['mosse'] and 'cammina' not in mosse_tutte:
        mosse_tutte = ['cammina'] + mosse_tutte  # la camminata fa da metro: sempre nella prima riga
    elif 'cammina' in mosse_tutte:
        mosse_tutte = ['cammina'] + [m for m in mosse_tutte if m != 'cammina']
    gruppi = [mosse_tutte[:3]] + [['cammina'] + mosse_tutte[i:i + 2] for i in range(3, len(mosse_tutte), 2)]
    viste = [v for v in (opzione('viste', '') or ','.join(GIRO1 if giro == '1' else list(GIRO2))).split(',') if v]
    out = []
    for v in viste:
        if v not in CODICI:
            sys.exit(f'vista «{v}» sconosciuta: {" ".join(CODICI)}')
        for mosse in gruppi:
            if v in GIRO1:
                stile = scheda.get('stile')
                if isinstance(stile, dict):  # uno per vista: il profilo col profilo
                    stile = stile.get(v) or next(iter(stile.values()), None)
                rif = [scheda['viste'].get(v), scheda.get('modello')] + ([stile] if stile else [])
                vicino = None
            else:
                da, vicina = GIRO2[v]
                vicino = os.path.join('fogli', nome_foglio(vicina, mosse) + '.png')
                if not os.path.exists(os.path.join(cartella, vicino)):
                    sys.exit(f'per {v} serve prima il foglio {vicino} (giro 1, guardato e approvato)')
                rif = [scheda['viste'].get(x) for x in da] + [vicino]
            if not all(rif):
                sys.exit(f'nella scheda mancano le immagini per {v}: "viste" ({", ".join(VISTE_MODELLO)}) e "modello"')
            out.append(f"{nome_foglio(v, mosse)}|{','.join(rif)}|{pixel(scheda, v, mosse, rif, vicino)}")
    return out


def righe_modello(scheda):
    he, his = PRONOMI.get(scheda['pronome'], PRONOMI['he'])
    testa = opzione('testa', scheda.get('testa', 45))
    guida = os.path.join('modello', f'guida_{testa}.png')
    carattere = (scheda['carattere'].rstrip('.') + '. ') if scheda.get('carattere') else ''
    testo = MODELLO.format(testa=testa, desc=scheda['descrizione'], he=he, his=his, carattere=carattere)
    return [f"modello_{t}|{guida},{scheda['modello']}|{testo}" for t in 'ab']


def main():
    cartella = cartella_da_argomenti(__doc__)
    scheda = leggi_scheda(cartella)
    p = os.path.join(cartella, 'lavori.txt')
    if opzione('stampa'):
        nome = opzione('stampa')
        riga = next((r for r in open(p, encoding='utf-8').read().splitlines() if r.split('|')[0] == nome), None)
        if not riga:
            sys.exit(f'«{nome}» non è in {p}')
        _, rif, testo = riga.split('|', 2)
        print('ALLEGA, in quest\'ordine:\n' + '\n'.join(f'  {i}. {os.path.normpath(os.path.join(cartella, r))}'
                                                    for i, r in enumerate(rif.split(','), 1)))
        dove = 'modello' if nome.startswith('modello_') else 'fogli'
        print(f'\nSALVA il PNG come: {os.path.join(cartella, dove, nome + ".png")}\n\nPROMPT:\n{testo}')
        return
    righe = righe_modello(scheda) if '--modello' in sys.argv else righe_pixel(cartella, scheda)
    with open(p, 'w', encoding='utf-8') as f:
        f.write('\n'.join(righe) + '\n')
    print(f'{len(righe)} fogli in {p}:', ' '.join(r.split('|')[0] for r in righe))


if __name__ == '__main__':
    main()
