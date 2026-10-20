# MAREA — i personaggi di Borgo Marea, uno per uno (`npc_<id>`, gente.json → `modello`; botteghe.json → `modello`).
# Ognuno ha sagoma, colori e posa sue: si riconoscono da lontano (a pixel grossi) e nei ritratti. Kit: gente_kit.py, pezzi comuni:
# gente_pezzi.py, personaggi: gente_porto.py (gente del Porto), gente_borgo.py (paesani), gente_botteghe.py (bottegai).
# Davanti −Z, piedi a y = 0, scheletro coi nomi di sempre, clip idle walk run sit row (lo stile del passo cambia da persona a persona).
import importlib
import gente_kit, gente_pezzi, gente_porto, gente_borgo, gente_botteghe
for _m in (gente_kit, gente_pezzi, gente_porto, gente_borgo, gente_botteghe):
    importlib.reload(_m)
from gente_kit import build_rig, make_clips

CHARS = {**gente_porto.CHARS, **gente_borgo.CHARS, **gente_botteghe.CHARS}


def _model(fn):
    def run():
        f, B, st = fn()
        ob = f.build()
        rig = build_rig(f.name, B, [ob])
        durate = make_clips(rig, B, st)
        return [rig, ob], {'clips': list(durate), 'durate': durate, 'preview': {'walk': 4}}
    return run


MODELS = {n: _model(fn) for n, fn in CHARS.items()}
