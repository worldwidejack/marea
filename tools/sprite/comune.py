"""MAREA — i pezzi comuni degli script degli sprite (tools/sprite/): le 9 viste, la scheda del personaggio, il magenta.

Un personaggio a sprite sta in una cartella (di solito assets/concept/sprite/<id>/) con:
  scheda.json   chi è e cosa fa (la scrive Claude, si committa): vedi SCHEDA qui sotto
  lavori.txt    i prompt per Codex, una riga per foglio (prompt.py, si committa)
  fogli/        i fogli di Codex o ChatGPT: <vista>_<mossa>-<mossa>-<mossa>.png, 4 colonne × una riga per mossa, su magenta
  sprite/       gli sprite a pixel (pixel.py): <vista>_<mossa>_<n>.png, elenco.json, tavolozza.json
  controllo/    gli sprite ingranditi e le animazioni per Fenaki (in_fenaki.py)
  _FOGLIO_sprite.jpg  il foglio da guardare (foglio.py, si committa: i PNG restano sul computer, .gitignore)
Le 16 direzioni del gioco: 9 viste disegnate (S → N passando da destra) e 7 specchiate (il lato sinistro).
"""
import json
import os
import sys

import numpy as np
from PIL import ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
FONDO = (233, 228, 220)                      # il grigio caldo dei fogli e delle sagome (#E9E4DC)
CARTA, INK, GRIGIO = (250, 246, 238), (52, 38, 28), (120, 108, 96)
INCHIOSTRO = (21, 16, 14)                    # il contorno di 1 pixel degli sprite

# le 9 viste disegnate: codice, gradi dal davanti (verso destra), nome per le persone, frase per il prompt.
# {he}/{his} = il pronome del personaggio (scheda: "pronome": "he" | "she" | "it")
VISTE = [
    ('S', 0, 'davanti', 'FRONT: {he} faces straight DOWN toward the viewer'),
    ('SSE', 22.5, 'tra davanti e 3/4', 'exactly HALFWAY between the FRONT view (FIRST image) and the THREE-QUARTER FRONT view '
     '(SECOND image): {he} faces down toward the viewer, turned only 22 degrees toward the right of the image'),
    ('SE', 45, '3/4 davanti', 'THREE-QUARTER FRONT: {he} faces DOWN-RIGHT toward the viewer'),
    ('ESE', 67.5, 'tra 3/4 e profilo', 'exactly HALFWAY between the THREE-QUARTER FRONT view (FIRST image) and the SIDE PROFILE '
     'facing right (SECOND image): {he} faces right and a little toward the viewer (67 degrees from the front)'),
    ('E', 90, 'profilo', 'SIDE PROFILE: {he} faces RIGHT'),
    ('ENE', 112.5, 'tra profilo e 3/4 dietro', 'exactly HALFWAY between the SIDE PROFILE facing right (FIRST image) and the '
     'THREE-QUARTER BACK view (SECOND image): {he} faces right and a little away from the viewer (112 degrees from the front), '
     'we see a bit of {his} back'),
    ('NE', 135, '3/4 dietro', 'THREE-QUARTER BACK: {he} faces UP-RIGHT, away from the viewer, we see {his} back and the back of '
     '{his} head'),
    ('NNE', 157.5, 'tra 3/4 dietro e dietro', 'exactly HALFWAY between the THREE-QUARTER BACK view (FIRST image) and the BACK '
     'view (SECOND image): {he} faces away from the viewer, turned only 22 degrees toward the right of the image, we see {his} '
     'back and the back of {his} head'),
    ('N', 180, 'dietro', 'BACK: {he} faces straight UP, away from the viewer, we see only {his} back and the back of {his} head'),
]
CODICI = [v[0] for v in VISTE]
NOME_VISTA = {v[0]: v[2] for v in VISTE}
# le 5 viste del foglio del modello (quelle che si disegnano prima, a mano libera dal generatore)
VISTE_MODELLO = ['S', 'SE', 'E', 'NE', 'N']
# giro 1: tre viste dal modello; giro 2: le altre sei, ognuna fra due viste del modello e con lo stile della vicina del giro 1
GIRO1 = ['SE', 'E', 'NE']
GIRO2 = {'S': (['S'], 'SE'), 'SSE': (['S', 'SE'], 'SE'), 'ESE': (['SE', 'E'], 'E'), 'ENE': (['E', 'NE'], 'E'),
         'NNE': (['NE', 'N'], 'NE'), 'N': (['N'], 'NE')}
PRONOMI = {'he': ('he', 'his'), 'she': ('she', 'her'), 'it': ('it', 'its')}

SCHEDA = """scheda.json (esempio):
{
  "nome": "il protagonista (F3)",
  "pronome": "he",
  "descrizione": "side-swept dark-brown hair with pointed locks, the big head about 45 % of his height on a short body, ...",
  "modello": "../../personaggio/F3_design.jpg",
  "viste": {"S": "../../personaggio/F3_vista_S.jpg", "SE": "...", "E": "...", "NE": "...", "N": "..."},
  "stile": {"SE": "../../personaggio/F3_foglio_pixel_SE.jpg", "E": "…_E.jpg", "NE": "…_NE.jpg"},
  "alto": 48,
  "mosse": {"cammina": "WALK CYCLE, 4 frames: ...", "scatto": "...", "bevi": "..."}
}
I percorsi sono relativi alla cartella del personaggio. "stile" (facoltativo, per un personaggio nuovo) = i fogli a pixel già
approvati di un altro personaggio del gioco, uno per vista del giro 1 o uno solo, per fare il nuovo «dello stesso artista».
"alto" = l'altezza in pixel del personaggio in piedi; "testa" = la testa coi capelli in % dell'altezza (per --modello)."""


def cartella_da_argomenti(uso):
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    if not a:
        sys.exit(uso)
    c = os.path.abspath(a[0])
    if not os.path.isdir(c):
        sys.exit(f'la cartella non c\'è: {c}')
    return c


def opzione(nome, di_serie=None):
    """--nome valore dalla riga di comando."""
    if f'--{nome}' in sys.argv:
        i = sys.argv.index(f'--{nome}')
        if i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return di_serie


def leggi_scheda(cartella):
    p = os.path.join(cartella, 'scheda.json')
    if not os.path.exists(p):
        sys.exit(f'manca {p}\n\n{SCHEDA}')
    with open(p, encoding='utf-8') as f:
        s = json.load(f)
    s.setdefault('pronome', 'he')
    s.setdefault('alto', 48)
    s.setdefault('mosse', {})
    s.setdefault('viste', {})
    return s


def nome_foglio(vista, mosse):
    return f"{vista}_{'-'.join(mosse)}"


def leggi_nome_foglio(nome):
    """«SE_cammina-scatto-bevi» → ('SE', ['cammina', 'scatto', 'bevi']); «viste_fermo» → ('viste', ['fermo'])."""
    vista, _, resto = os.path.splitext(os.path.basename(nome))[0].partition('_')
    return vista, [m for m in resto.split('-') if m]


def alfa_magenta(rgb):
    """Alfa dal fondo magenta #FF00FF dei fogli: 0 sul magenta, 1 sui colori veri (anche il rosa della pelle resta)."""
    r, g, b = [rgb[..., i].astype(np.float32) for i in range(3)]
    return 1 - np.clip((np.minimum(r, b) - g - 60) / 80, 0, 1)


def font(n, grassetto=False):
    """Un font che c'è su Mac, Windows e Linux; se no quello di Pillow (che scala)."""
    for f in (('Arial Bold.ttf', 'arialbd.ttf', 'DejaVuSans-Bold.ttf') if grassetto else ('Arial.ttf', 'arial.ttf', 'DejaVuSans.ttf')):
        for d in ('', '/System/Library/Fonts/Supplemental/', '/Library/Fonts/'):
            try:
                return ImageFont.truetype(d + f, n)
            except OSError:
                pass
    try:
        return ImageFont.load_default(n)
    except TypeError:
        return ImageFont.load_default()


def relativo(cartella, p):
    return os.path.normpath(os.path.join(cartella, p)) if p and not os.path.isabs(p) else p
