#!/usr/bin/env python3
"""Banco dei pixel (3/11): prepara i dati della pagina che mette accanto il disegno di Codex e lo sprite a 64 px.

Per ogni personaggio dell'Atelier con la camminata in 9 viste: tools/sprite/pixel_vero.py (metodo hd, 64 px) → dati/<personaggio>/px<alto>/
(gli sprite) e dati/<personaggio>/codex/ (il ritaglio del foglio di Codex che è diventato ogni sprite), più dati/indice.json.
Lo sfondo del Borgo (sfondo.png, un pixel = un pixel di gioco) lo fa _banco/sfondo.mjs.

uso: <python del venv di Fenaki> _banco/pixel_lab/costruisci.py [personaggio …] [--alti 64,96]
"""
import json
import os
import shutil
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
WT = os.path.abspath(os.path.join(QUI, '..', '..'))
sys.path.insert(0, os.path.join(WT, 'tools', 'sprite'))
sys.argv, ARGV = sys.argv[:1], sys.argv[1:]  # pixel_vero legge sys.argv: gli argomenti li leggo io
import pixel_vero as pv  # noqa: E402

ATELIER = os.path.expanduser(os.environ.get('ATELIER', '~/Desktop/JACK/_GITHUB/marea-atelier')) + '/personaggi'
PERSONAGGI = {'protagonista': '', 'viandante': '', 'scugnizzo': '', 'f3-prova': 'ciclo8_'}
ALTI = [int(x) for x in (ARGV[ARGV.index('--alti') + 1].split(',') if '--alti' in ARGV else ['64', '96'])]
scelti = [a for a in ARGV if a in PERSONAGGI] or list(PERSONAGGI)
DATI = os.path.join(QUI, 'dati')

indice_f = os.path.join(DATI, 'indice.json')
indice = json.load(open(indice_f)) if os.path.exists(indice_f) else {}
for p in scelti:
    base = os.path.join(DATI, p)
    shutil.rmtree(base, ignore_errors=True)
    indice[p] = {'metodo': 'hd', 'alti': {}}
    for alto in ALTI:
        # i ritagli di Codex sono gli stessi a ogni altezza: si salvano una volta (con la prima)
        pv.fai_atelier(os.path.join(ATELIER, p), 'hd', alto, f'px{alto}', base, 24,
                       os.path.join(base, 'codex') if alto == ALTI[0] else None, PERSONAGGI[p])
        indice[p]['alti'][str(alto)] = json.load(open(os.path.join(base, f'px{alto}', 'elenco.json')))
json.dump(indice, open(indice_f, 'w'), ensure_ascii=False)
print('indice:', {p: {a: len(e) for a, e in v['alti'].items()} for p, v in indice.items()})
