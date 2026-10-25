# MAREA — vestiti e cappelli del Mercante (`abt_<id>`, `cap_<id>` → manifest_abiti.json, scaricato a richiesta da game/abiti.ts).
# Ricette: abiti_set_a/b/c.py (vestiti), abiti_cappelli.py (cappelli nuovi), abiti_cappelli_vecchi.py (quelli di prima, rifatti); kit: abiti_kit.py, abiti_capi.py, abiti_dettagli.py.
# Ogni glb = lo scheletro del chr_base (stesse ossa a riposo) + le SkinnedMesh del pezzo (mat_abito, mat_luce, mat_vetro, mat_nascondi).
# Anteprime 2D per il menù del Mercante: anteprime_abiti.py (npm run anteprime-abiti).
import importlib
import abiti_kit, abiti_capi, abiti_dettagli, abiti_set_a, abiti_set_b, abiti_set_c, abiti_cappelli, abiti_cappelli_vecchi
for _m in (abiti_kit, abiti_capi, abiti_dettagli, abiti_set_a, abiti_set_b, abiti_set_c, abiti_cappelli, abiti_cappelli_vecchi):
    importlib.reload(_m)

RICETTE = {**{'abt_' + k: v for m in (abiti_set_a, abiti_set_b, abiti_set_c) for k, v in m.ABITI.items()},
           **{'cap_' + k: v for m in (abiti_cappelli_vecchi, abiti_cappelli) for k, v in m.CAPPELLI.items()}}


def _model(fn):
    def run():
        corpo = abiti_kit.Corpo()
        objs = abiti_kit.costruisci(corpo, fn(corpo))
        bpy_body = corpo.ob
        bpy_body.hide_render = True  # il corpo serve solo per cucire: non si esporta
        return objs, {'tri_pezzi': {o.name: abiti_kit.tri(o) for o in objs if o.type == 'MESH'}}
    return run


MODELS = {n: _model(fn) for n, fn in RICETTE.items()}
