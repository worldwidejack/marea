# Il Santuario del Capo Ardente (Isola Vulcano): l'altare di basalto d'ingresso col braciere acceso, il kit di basalto nero con venature
# magmatiche, le torri-braciere (colonne), la chiusa termale, lo sfiato termico del Santuario, il ponte levatoio d'ossidiana e i nemici
# (la Sentinella del Braciere col pavese `portello`, il Cantore della Fuliggine, il Totem del Censo e l'Arconte Solan). Scritto senza
# Blender: finché i modelli non vengono rigenerati su Mac/PC con Blender, il gioco usa i segnaposto in codice di
# apps/client/src/rpg/ceneri.ts e apps/client/src/game/ingressi_forme.ts (`santuario`).
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


def dng_ceneri_ruota():
    """Colonna della chiusa termale in basalto e rame (la ruota termale che gira la mette il client)."""
    m = Mesh('dng_ceneri_ruota')
    m.prism(8, 0.5, 0.45, 0, 0.22, 'p_nero_caldo', top='p_nero_caldo')
    m.cbox(0, 0, 0.44, 0.36, 0.22, 1.24, 'p_pietra_scura')
    m.cbox(0, -0.18, 0.34, 0.05, 0.5, 1.06, 'p_rosso')
    m.cbox(0, -0.2, 0.16, 0.04, 0.7, 0.86, 'p_arancio', mat=EM)
    return _obj(m)


def dng_ceneri_pilone():
    """Sfiato termico del Santuario: colonna fessurata di basalto incandescente col cappello d'ottone."""
    m = Mesh('dng_ceneri_pilone')
    m.prism(8, 0.62, 0.54, 0, 0.35, 'p_nero_caldo', top='p_nero_caldo')
    m.prism(7, 0.48, 0.42, 0.35, 2.15, 'p_pietra_scura')
    for y in (0.75, 1.35, 1.85):
        m.prism(7, 0.5, 0.5, y, y + 0.1, 'p_arancio', mat=EM)
    m.prism(8, 0.56, 0.48, 2.1, 2.42, 'p_giallo', top='p_rosso')
    return _obj(m)


def dng_ceneri_ponte():
    """Ponte levatoio in lastre d'ossidiana incatenate con catene d'oro brunito."""
    m = Mesh('dng_ceneri_ponte')
    for k in range(8):
        z0 = -2 + k * 0.5
        m.box(-6, 0, z0 + 0.03, 0, 0.14, z0 + 0.47, 'p_nero_caldo' if k % 2 else 'p_pietra_scura', skip=('bottom',))
    for x in (0.4, 3.0, 5.6):
        m.box(-x - 0.08, 0.14, -2, -x + 0.08, 0.22, 2, 'p_giallo' if x == 3.0 else 'p_rosso', skip=('bottom',))
    return _obj(m)


# ------------------------------------------------------------------ nemici
def nem_sentinella_braciere():
    """Sentinella del Braciere: colosso in armatura d'ossidiana con venature incandescenti, maglio-braciere e pavese `portello`."""
    m = Mesh('nem_sentinella_braciere')
    for sx in (-1, 1):
        m.cbox(sx * 0.28, 0.05, 0.42, 0.42, 0, 0.88, 'p_nero_caldo')
        m.cbox(sx * 0.28, -0.02, 0.46, 0.54, 0, 0.18, 'p_rosso', skip=('bottom',))
    m.cbox(0, 0.05, 1.14, 0.74, 0.88, 1.9, 'p_pietra_scura')
    m.cbox(0, -0.33, 0.86, 0.08, 1.2, 1.62, 'p_arancio', mat=EM)
    m.cbox(0.76, 0, 0.36, 0.36, 0.9, 1.8, 'p_nero_caldo')
    m.push(Xf(t=(-0.7, 1.45, -0.25), r=(40, 0, 0))); m.cbox(0, 0, 0.36, 0.36, -0.35, 0.35, 'p_nero_caldo'); m.pop()
    m.prism(6, 0.32, 0.26, 1.88, 2.38, 'p_nero_caldo', top='p_giallo', cz=0.05)
    m.cbox(0, -0.2, 0.42, 0.08, 2.04, 2.16, 'p_arancio', mat=EM)
    m.cbox(0.84, -0.35, 0.14, 0.14, 0.35, 1.55, 'p_giallo')
    m.cbox(0.84, -0.45, 0.46, 0.38, 0.08, 0.46, 'p_arancio', mat=EM)
    p = Mesh('portello')
    p.box(-0.95, 0.1, -0.78, 0.45, 2.02, -0.62, 'p_nero_caldo')
    for y in (0.65, 1.45):
        p.box(-0.98, y, -0.82, 0.48, y + 0.12, -0.6, 'p_giallo', skip=('bottom', 'top'))
    p.box(-0.42, 0.9, -0.83, -0.08, 1.35, -0.77, 'p_arancio', mat=EM)
    return _obj(m, p)


def nem_cantore():
    """Cantore della Fuliggine: sacerdote del culto in tunica cremisi e nera con maschera solare d'oro e canna piroclastica."""
    m = Mesh('nem_cantore')
    for sx in (-1, 1):
        m.cbox(sx * 0.13, 0, 0.18, 0.2, 0, 0.78, 'p_nero_caldo')
    m.prism(6, 0.34, 0.24, 0.45, 1.52, 'p_rosso')
    m.cbox(0, 0, 0.48, 0.38, 1.05, 1.21, 'p_giallo', skip=('bottom', 'top'))
    m.cbox(0, 0, 0.28, 0.28, 1.52, 1.8, 'p_nero_caldo')
    m.prism(8, 0.24, 0.24, 1.62, 1.86, 'p_giallo', top='p_giallo', cz=-0.12)
    m.cbox(0, -0.18, 0.26, 0.08, 1.66, 1.74, 'p_arancio', mat=EM)
    for sx, rx in ((-1, 52), (1, 46)):
        m.push(Xf(t=(sx * 0.28, 1.22, -0.18), r=(rx, 0, -sx * 11))); m.cbox(0, 0, 0.14, 0.14, -0.3, 0.3, 'p_rosso'); m.pop()
    m.push(Xf(t=(0.05, 1.35, -1.0), r=(90, 0, 0))); m.prism(6, 0.05, 0.04, -0.78, 0.78, 'p_nero_caldo', top='p_giallo'); m.pop()
    m.cbox(0.05, -1.84, 0.12, 0.16, 1.29, 1.41, 'p_arancio', mat=EM)
    return _obj(m)


def nem_totem_censo():
    """Totem del Censo: incensiere rituale alato in bronzo ed ebano che levita sopra un globo di magma."""
    m = Mesh('nem_totem_censo')
    m.prism(6, 0.32, 0.22, 0.35, 1.05, 'p_nero_caldo', top='p_giallo', bottom='p_rosso')
    m.cbox(0, 0, 0.52, 0.52, 0.65, 0.79, 'p_giallo')
    m.cbox(0, -0.28, 0.26, 0.08, 0.72, 0.92, 'p_arancio', mat=EM)
    for sx in (-1, 1):
        m.push(Xf(t=(sx * 0.85, 0.76, 0), r=(0, 0, -sx * 12))); m.cbox(0, 0, 1.35, 0.36, -0.04, 0.04, 'p_giallo'); m.pop()
    m.prism(6, 0.22, 0.18, 0.08, 0.34, 'p_arancio', top='p_giallo', bottom='p_rosso', mat=EM)
    return _obj(m)


def nem_solan():
    """Arconte Solan (boss, ≈ 3,2 m): sovrano-sacerdote del Santuario del Capo Ardente in manto di basalto e oro, aureola solare
    incandescente dietro il capo e scettro-lancia del Sole Sepolto."""
    m = Mesh('nem_solan')
    for sx in (-1, 1):
        m.cbox(sx * 0.32, 0, 0.44, 0.48, 0, 1.08, 'p_nero_caldo')
        m.cbox(sx * 0.32, -0.05, 0.5, 0.64, 0, 0.22, 'p_giallo', skip=('bottom',))
    m.prism(6, 0.82, 0.62, 0.62, 2.08, 'p_rosso', cz=0.05)
    m.cbox(0, 0.05, 1.44, 0.86, 1.68, 2.64, 'p_nero_caldo')
    m.cbox(0, -0.39, 1.12, 0.08, 1.92, 2.34, 'p_arancio', mat=EM)
    for x in (-0.52, 0.52):
        m.cbox(x, 0.05, 0.5, 0.54, 2.4, 2.6, 'p_giallo')
    m.cbox(0, 0.05, 0.44, 0.44, 2.62, 3.1, 'p_nero_caldo')
    m.cbox(0, -0.2, 0.46, 0.1, 2.8, 2.96, 'p_arancio', mat=EM)
    m.prism(8, 0.34, 0.24, 3.08, 3.45, 'p_giallo', top='p_arancio', cz=0.05)
    m.cbox(0, 0.34, 1.35, 0.08, 2.45, 3.55, 'p_giallo', mat=EM)
    m.cbox(-0.85, 0.05, 0.38, 0.38, 1.48, 2.52, 'p_rosso')
    m.push(Xf(t=(0.85, 2.1, -0.2), r=(29, 0, 0))); m.cbox(0, 0, 0.38, 0.38, -0.45, 0.45, 'p_rosso'); m.pop()
    m.push(Xf(t=(0.9, 1.75, -1.2), r=(83, 0, 0)))
    m.cbox(0, 0, 0.14, 0.14, -2.1, 1.6, 'p_giallo')
    m.cbox(0, 0, 0.44, 0.1, 1.35, 2.25, 'p_arancio', mat=EM)
    m.pop()
    return _obj(m)


MODELS_MAIN = [prop_ingresso_ceneri]
MODELS_RPG = [dng_ceneri_pavimento, dng_ceneri_muro, dng_ceneri_muro_basso, dng_ceneri_colonna, dng_ceneri_ruota, dng_ceneri_pilone, dng_ceneri_ponte,
              nem_sentinella_braciere, nem_cantore, nem_totem_censo, nem_solan]
MODELS = {f.__name__: f for f in MODELS_MAIN + MODELS_RPG}
