# Il Tempio della «Doppia Nera» (Isola dell'Adrenalina): la baita alpina d'ingresso col cannone spara-neve, il kit di larice e moquette col
# battiscopa innevato e i frangivento da slalom (colonne). Scritto senza Blender: finché i modelli non vengono rigenerati su Mac/PC con Blender, il
# gioco usa i segnaposto in codice di apps/client/src/rpg/baita.ts (kit, nemici, colonnina termica) e apps/client/src/game/ingressi_forme.ts (`chalet`).
from lib import Mesh, Xf

EM = 'mat_emissivo'


def _obj(*ms, **info):
    out = [m.build() for m in ms]
    return (out, info) if info else out


def _quad(m, pts, reg, mat=None):
    m.poly(pts, reg, mat)


# ------------------------------------------------------------------ manifest principale: ingresso
def prop_ingresso_baita():
    """Baita alpina di larice col tetto a due falde innevato, sci rosa fluo incrociati sopra la porta, cartello «Doppia Nera» e cannone spara-neve."""
    m = Mesh('prop_ingresso_baita')
    m.cbox(0, 0.2, 3.8, 3.0, 0, 0.24, 'p_pietra', skip=('bottom',))
    m.cbox(0, 0.3, 3.2, 2.4, 0.24, 2.44, 'p_legno', skip=('bottom',))
    for y in (0.85, 1.85):
        m.cbox(0, 0.3, 3.3, 2.5, y - 0.08, y + 0.08, 'p_legno_scuro', skip=('bottom', 'top'))
    for sx in (-1, 1):
        m.push(Xf(t=(sx * 0.9, 2.85, 0.3), r=(0, 0, -sx * 31)))
        m.cbox(0, 0, 2.3, 2.8, -0.11, 0.11, 'p_legno_scuro')
        m.cbox(0, 0, 2.35, 2.85, 0.11, 0.27, 'p_sabbia_chiara')
        m.pop()
    m.cbox(0, 0.3, 1.4, 2.3, 2.3, 3.0, 'p_legno', skip=('bottom',))
    m.cbox(0, -0.92, 1.35, 0.14, 0.24, 1.89, 'p_nero_caldo', skip=('bottom',))
    m.cbox(0, -0.95, 1.6, 0.24, 1.83, 2.01, 'p_legno_chiaro')
    for sx in (-1, 1):
        m.push(Xf(t=(0, 2.55, -0.95), r=(0, 0, sx * 26))); m.cbox(0, 0, 1.7, 0.06, -0.06, 0.06, 'p_rosa_neon'); m.pop()
    m.push(Xf(t=(0, 3.15, -0.95), r=(0, 0, 45))); m.cbox(0, 0, 0.45, 0.06, -0.22, 0.22, 'p_giallo'); m.pop()
    m.push(Xf(t=(-1.45, 0.85, -1.25), r=(63, -17, 0))); m.prism(8, 0.28, 0.28, -0.42, 0.42, 'p_giallo', top='p_acqua_bassa'); m.pop()
    m.prism(5, 0.1, 0.1, 0, 0.68, 'p_roccia', cx=-1.45, cz=-1.25)
    m.cbox(1.35, -1.2, 1.1, 0.8, 0, 0.35, 'p_sabbia_chiara', skip=('bottom',))
    return _obj(m, footprint=[5, 5])


# ------------------------------------------------------------------ kit del dungeon (≤ 60 tri i moduli)
def dng_baita_pavimento():
    """Tavolato di larice 2×2 con striscia di gomma antiscivolo per gli scarponi da sci."""
    m = Mesh('dng_baita_pavimento')
    m.box(-1, -0.3, -1, 1, 0, 1, 'p_legno_scuro', top='p_legno', skip=('bottom',))
    y = 0.004
    for z in (-0.5, 0.5):
        _quad(m, [(-1, y, z + 0.025), (1, y, z + 0.025), (1, y, z - 0.025), (-1, y, z - 0.025)], 'p_legno_scuro')
    _quad(m, [(-1, y * 2, 0.18), (1, y * 2, 0.18), (1, y * 2, -0.18), (-1, y * 2, -0.18)], 'p_nero_caldo')
    return _obj(m)


def _parete_baita(m, H):
    m.box(-1, 0, -1, 1, H, 1, 'p_legno', top='p_sabbia_chiara', skip=('bottom',))
    if H > 1:
        for y in (0.8, 1.6):
            m.box(-1.01, y, -1.01, 1.01, y + 0.06, 1.01, 'p_legno_scuro', skip=('bottom', 'top'))
        m.box(-1.02, 0, -1.02, 1.02, 0.22, 1.02, 'p_sabbia_chiara', skip=('bottom', 'top'))


def dng_baita_muro():
    m = Mesh('dng_baita_muro')
    _parete_baita(m, 2.4)
    return _obj(m)


def dng_baita_muro_basso():
    m = Mesh('dng_baita_muro_basso')
    _parete_baita(m, 0.6)
    return _obj(m)


def dng_baita_colonna():
    """Cannone spara-neve giallo/azzurro su traliccio metallico."""
    m = Mesh('dng_baita_colonna')
    m.cbox(0, 0, 1.1, 1.1, 0, 0.22, 'p_roccia', skip=('bottom',))
    m.prism(6, 0.18, 0.14, 0.22, 1.15, 'p_pietra_scura')
    m.push(Xf(t=(0, 1.25, -0.05), r=(72, 0, 0)))
    m.prism(8, 0.34, 0.42, -0.55, 0.55, 'p_giallo', top='p_acqua_bassa', bottom='p_nero_caldo')
    m.pop()
    m.cbox(0, 0.52, 0.22, 0.22, 1.1, 1.32, 'p_rosso')
    return _obj(m)


MODELS_MAIN = [prop_ingresso_baita]
MODELS_RPG = [dng_baita_pavimento, dng_baita_muro, dng_baita_muro_basso, dng_baita_colonna]
MODELS = {f.__name__: f for f in MODELS_MAIN + MODELS_RPG}
