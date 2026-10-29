# Il Santuario del Capo Ardente (Isola Vulcano): l'altare di basalto d'ingresso col braciere acceso, il kit di basalto nero con venature
# magmatiche e le torri-braciere (colonne). Scritto senza Blender: finché i modelli non vengono rigenerati su Mac/PC con Blender, il gioco usa i
# segnaposto in codice di apps/client/src/rpg/ceneri.ts (kit, braciere, e i nemici: Lanciatore di Lava, Guerriero Colossale, Sciamano del Fumo,
# fuoco fatuo, Mite di lava e Korok) e di apps/client/src/game/ingressi_forme.ts (`santuario`).
from lib import Mesh, Xf

EM = 'mat_emissivo'


def _obj(*ms, **info):
    out = [m.build() for m in ms]
    return (out, info) if info else out


def _quad(m, pts, reg, mat=None):
    m.poly(pts, reg, mat)


# ------------------------------------------------------------------ manifest principale: ingresso
def prop_ingresso_ceneri():
    """Santuario vulcanico scavato nel basalto con colonne d'ossidiana, architrave solare d'oro, braciere acceso e targa del culto."""
    m = Mesh('prop_ingresso_ceneri')
    m.cbox(0, 0.2, 3.8, 3.0, 0, 0.28, 'p_nero_caldo', skip=('bottom',))
    m.cbox(0, 0.35, 3.2, 2.3, 0.28, 2.68, 'p_pietra_scura', skip=('bottom',))
    for sx in (-1, 1):
        m.prism(6, 0.34, 0.28, 0.28, 2.88, 'p_nero_caldo', cx=sx * 1.25, cz=-0.75)
        m.cbox(sx * 1.25, -0.75, 0.56, 0.56, 2.72, 2.94, 'p_giallo')
    m.cbox(0, -0.75, 3.1, 0.62, 2.54, 2.96, 'p_nero_caldo')
    m.cbox(0, -1.07, 2.6, 0.08, 2.67, 2.83, 'p_arancio', mat=EM)
    m.cbox(0, -0.72, 1.5, 0.28, 0.28, 2.38, 'p_abisso', skip=('bottom',))
    m.prism(6, 0.42, 0.32, 2.95, 3.35, 'p_nero_caldo', top='p_pietra_scura', cz=-0.75)
    m.cone(5, 0.28, 3.32, 3.92, 'p_arancio', cz=-0.75, mat=EM)
    return _obj(m, footprint=[5, 5])


# ------------------------------------------------------------------ kit del dungeon (≤ 60 tri i moduli)
def dng_ceneri_pavimento():
    """Basalto nero levigato 2×2 con venature magmatiche arancioni."""
    m = Mesh('dng_ceneri_pavimento')
    m.box(-1, -0.3, -1, 1, 0, 1, 'p_nero_caldo', top='p_pietra_scura', skip=('bottom',))
    y = 0.004
    for z in (-0.5, 0.5):
        _quad(m, [(-1, y, z + 0.025), (1, y, z + 0.025), (1, y, z - 0.025), (-1, y, z - 0.025)], 'p_nero_caldo')
    _quad(m, [(-0.85, y * 2, 0.04), (0.85, y * 2, 0.04), (0.85, y * 2, -0.04), (-0.85, y * 2, -0.04)], 'p_arancio', mat=EM)
    return _obj(m)


def _parete_ceneri(m, H):
    m.box(-1, 0, -1, 1, H, 1, 'p_nero_caldo', top='p_pietra_scura', skip=('bottom',))
    if H > 1:
        for y in (0.7, 1.5):
            m.box(-1.01, y, -1.01, 1.01, y + 0.06, 1.01, 'p_rosso', skip=('bottom', 'top'))
        m.box(-1.02, 0, -1.02, 1.02, 0.22, 1.02, 'p_pietra_scura', skip=('bottom', 'top'))


def dng_ceneri_muro():
    m = Mesh('dng_ceneri_muro')
    _parete_ceneri(m, 2.4)
    return _obj(m)


def dng_ceneri_muro_basso():
    m = Mesh('dng_ceneri_muro_basso')
    _parete_ceneri(m, 0.6)
    return _obj(m)


def dng_ceneri_colonna():
    """Torre-braciere d'ossidiana con anelli d'oro brunito e nucleo di brace viva."""
    m = Mesh('dng_ceneri_colonna')
    m.cbox(0, 0, 1.1, 1.1, 0, 0.24, 'p_nero_caldo', skip=('bottom',))
    m.prism(6, 0.34, 0.28, 0.24, 1.54, 'p_pietra_scura')
    m.cbox(0, 0, 0.72, 0.72, 0.9, 1.04, 'p_giallo')
    m.prism(6, 0.44, 0.32, 1.5, 1.88, 'p_nero_caldo', top='p_arancio')
    m.cone(5, 0.26, 1.85, 2.4, 'p_arancio', mat=EM)
    return _obj(m)


MODELS_MAIN = [prop_ingresso_ceneri]
MODELS_RPG = [dng_ceneri_pavimento, dng_ceneri_muro, dng_ceneri_muro_basso, dng_ceneri_colonna]
MODELS = {f.__name__: f for f in MODELS_MAIN + MODELS_RPG}
