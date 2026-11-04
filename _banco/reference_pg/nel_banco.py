#!/usr/bin/env python3
"""Le reference del PG (reference_pg2|3/fogli/<nome>.png, una figura da davanti su magenta) → dati del banco dei pixel (3/11).

Ogni figura scontornata dal magenta, ritagliata e portata a 480 px d'altezza in pixel_lab/dati/reference/<nome>.png;
pixel_lab/dati/reference.json dà l'ordine e il nome da mostrare. Poi impacchetta.py le mette in online/reference.webp.

uso: <python del venv di Fenaki> _banco/reference_pg/nel_banco.py

Candidato nuovo (chiunque del gruppo, senza chiedere a nessuno): il foglio in reference_pg/fogli/<autore>_<cosa>.png
(una figura da davanti su magenta), la riga col prompt in lavori.txt, poi
  python nel_banco.py && python ../pixel_lab/impacchetta.py
e si ripubblica pixel_lab/online/banco.html con dati.json e reference.webp sull'artifact
https://claude.ai/artifact/YFMuBTgatJ813rP5KtiAFd (serve essere editor dell'artifact: se il publish è rifiutato,
chiedi a Jack di aggiungerti da «Condividi»). Il commit da solo basta: il Claude di Jack ripubblica alla prima occasione.
"""
import json
import os
import shutil
import sys

import numpy as np
from PIL import Image

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(QUI, '..', '..', 'tools', 'sprite'))
sys.argv = sys.argv[:1]
import pixel_vero as pv  # noqa: E402

DATI = os.path.join(QUI, '..', 'pixel_lab', 'dati')
# i giri dal più nuovo (3/11, dopo Jack sul giro 2: «tutti dragon ballosi. cambia stile»: 10 stili lontani fra loro), poi il giro 2
# i candidati del gruppo, col nome dell'autore davanti (4/11, Jack: «permetti sempre anche agli altri di fare tutto»): ogni <autore>_<cosa>.png in reference_pg/fogli
# entra da solo, in testa, senza toccare questo file. Basta committare il foglio (e la riga in lavori.txt) e rilanciare.
_GRUPPO = os.path.join(QUI, 'fogli')
GIRI = [
    ('reference_pg', {f[:-4]: ' · '.join(f[:-4].replace('_', ' ', 1).split(' ', 1)) for f in sorted(os.listdir(_GRUPPO)) if f.endswith('.png') and '_' in f}),
    # giro 4 (3/11, Jack: il PG di Birba «alla goku bambino», semplificato per la pixel art)
    ('reference_pg4', {'p1_semplice': '1 · semplice, scalzo', 'p2_scarpe': '2 · con le scarpe', 'p3_canottiera': '3 · canottiera',
                       'p4_code_corte': '4 · code corte', 'p5_testone': '5 · testa grande', 'p6_slanciato': '6 · più grande (19)',
                       'p7_frangia': '7 · frangia'}),
    ('reference_pg3', {'n1_quest1_ligne_claire': '1 · ligne claire', 'n2_quest1_rubber_hose': "2 · rubber hose '30",
                       'n3_gross_out': "3 · gross-out '90", 'n4_mid_century': "4 · mid-century '50",
                       'n5_libro_illustrato': '5 · libro illustrato', 'n6_ghibli': '6 · Ghibli', 'n7_graffiti': '7 · graffiti Y2K',
                       'n8_ombre_nere': '8 · ombre nere', 'n9_low_poly_ps1': '9 · low-poly PS1', 'n11_risograph': '10 · risograph'}),
    # giro 2 (3/11, dopo Jack: «l'unica che salverei è la 1», niente donne né pelle scura, shonen / semplici / proporzioni)
    ('reference_pg2', {'n1_quest1_shonen': '1 · quest 1 shonen', 'n2_quest1_semplice': '2 · quest 1 semplice',
                       'n3_spettinato': '3 · spettinato', 'n4_ciuffo': '4 · ciuffo rosso', 'n5_camicia_bianca': '5 · maglia bianca',
                       'n6_maglietta': '6 · maglietta', 'n7_slanciato': '7 · più slanciato', 'n8_testone': '8 · testa grande'}),
]
ALTO = 480

out = os.path.join(DATI, 'reference')
shutil.rmtree(out, ignore_errors=True)
os.makedirs(out)
elenco = {}
for cartella, nomi in GIRI:
    giro = {'reference_pg': 'del gruppo · ', 'reference_pg4': 'giro 4 · ', 'reference_pg3': 'giro 3 · ', 'reference_pg2': 'giro 2 · '}[cartella]
    for n, mostra in nomi.items():
        f = os.path.join(QUI, '..', cartella, 'fogli', n + '.png')  # i nomi non si ripetono fra i giri
        if not os.path.exists(f):
            continue
        rgb = np.array(Image.open(f).convert('RGB'))
        a = pv.alfa_magenta(rgb)
        ys, xs = np.where(a > 0.5)
        rgba = np.dstack([rgb, (a * 255).astype(np.uint8)])[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        im = Image.fromarray(rgba, 'RGBA')
        im.resize((round(im.size[0] * ALTO / im.size[1]), ALTO), Image.LANCZOS).save(os.path.join(out, n + '.png'))
        elenco[n] = {'nome': giro + mostra}
json.dump(elenco, open(os.path.join(DATI, 'reference.json'), 'w'), ensure_ascii=False)
print(f'{len(elenco)} reference → {out}')
