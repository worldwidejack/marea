# MAREA — veicoli dell'Isola delle Corse (#178): ruote, due ruote, acqua, scivoli e i buffi.
# Riferimento: assets/concept/corse/corse_12_veicoli.jpg. Un veicolo = una guida (docs/CORSE.md A6).
# Davanti −Z, pivot a terra al centro, lunghezza lungo Z, seduta dove sta il pilota (il pilota si aggiunge dopo).
# Budget: fino a 800 triangoli (come gli edifici piccoli), nomi cs_v_<nome>.
import math
from lib import Mesh, Xf, beam
from corse_kit import C, ruota, sfera, volante, fascia


def _obj(m):
    return [m.build()]


def cs_v_kart():
    """Kart da gara: musetto rosso e bianco, ala davanti, motore giallo dietro, sedile nero."""
    m = Mesh('cs_v_kart')
    # fondo e fianchi
    m.box(-0.5, 0.1, -0.95, 0.5, 0.3, 0.85, C('pietra_scura'), C('pietra_scura'))
    for s in (-1, 1):
        fascia(m, s * 0.5 - 0.14, 0.18, -0.35, s * 0.5 + 0.14, 0.44, 0.55, 'rosso', 'pietra_chiara', 0.1)
    # musetto che si stringe
    m.loft([[(-0.34, 0.2, -0.55), (0.34, 0.2, -0.55), (0.34, 0.42, -0.55), (-0.34, 0.42, -0.55)],
            [(-0.2, 0.2, -1.12), (0.2, 0.2, -1.12), (0.2, 0.34, -1.12), (-0.2, 0.34, -1.12)]],
           C('rosso'), top=None, bottom=None)
    m.box(-0.34, 0.42, -1.12 + 0.0, 0.34, 0.43, -0.55, C('pietra_chiara'), C('pietra_chiara'), skip=('bottom', 'front', 'back', 'left', 'right'))
    # ala davanti e dietro
    m.box(-0.78, 0.12, -1.3, 0.78, 0.2, -1.05, C('pietra_chiara'), C('pietra_chiara'))
    m.box(-0.82, 0.12, -1.3, -0.74, 0.3, -1.05, C('rosso'))
    m.box(0.74, 0.12, -1.3, 0.82, 0.3, -1.05, C('rosso'))
    # sedile
    m.box(-0.28, 0.3, -0.05, 0.28, 0.4, 0.42, C('nero_caldo'), C('nero_caldo'))
    m.box(-0.3, 0.3, 0.38, 0.3, 0.88, 0.5, C('nero_caldo'), C('nero_caldo'))
    # motore giallo dietro
    m.box(-0.3, 0.3, 0.55, 0.3, 0.7, 0.9, C('pietra_scura'), C('pietra'))
    beam(m, (-0.18, 0.6, 0.55), (-0.18, 0.6, 0.98), 0.2, 0.2, C('giallo'), end=C('giallo'), n=6)
    beam(m, (0.18, 0.6, 0.55), (0.18, 0.6, 0.98), 0.2, 0.2, C('arancio'), end=C('arancio'), n=6)
    volante(m, 0, 0.78, -0.3, 0.17)
    # ruote: dietro più grosse
    for s in (-1, 1):
        ruota(m, s * 0.66, -0.9, r=0.22, larga=0.2)
        ruota(m, s * 0.66, 0.55, r=0.28, larga=0.3)
    return _obj(m)


def cs_v_papera():
    """Papera di gomma gonfiabile: corpo giallo, becco arancio, motorino rosso dietro."""
    m = Mesh('cs_v_papera')
    # ciambella blu alla base (galleggiante)
    m.loft([m.ring(8, 0.62, 0.0, rz=0.9), m.ring(8, 0.7, 0.14, rz=1.0), m.ring(8, 0.68, 0.28, rz=0.98)], C('acqua_profonda'), bottom=C('acqua_profonda'))
    # corpo giallo
    m.loft([m.ring(8, 0.66, 0.26, rz=0.96), m.ring(8, 0.7, 0.5, rz=1.02), m.ring(8, 0.62, 0.78, rz=0.92), m.ring(8, 0.4, 0.96, rz=0.7)], C('giallo'))
    # testa
    sfera(m, 0, 1.25, -0.5, 0.42, 0.4, 0.42, C('giallo'), n=8, rings=3)
    # becco arancio (piatto e largo)
    m.box(-0.2, 1.14, -1.1, 0.2, 1.22, -0.8, C('arancio'), C('arancio'))
    m.box(-0.19, 1.22, -1.06, 0.19, 1.28, -0.84, C('arancio'), C('arancio'), skip=('bottom',))
    # occhi
    for s in (-1, 1):
        m.box(s * 0.26 - 0.04, 1.3, -0.88, s * 0.26 + 0.04, 1.4, -0.82, C('nero_caldo'))
    # ala
    for s in (-1, 1):
        m.box(s * 0.7 - 0.03, 0.55, -0.1, s * 0.7 + 0.03, 0.9, 0.5, C('giallo'))
    # coda
    m.box(-0.12, 0.7, 0.85, 0.12, 1.02, 1.1, C('giallo'), C('giallo'))
    # motorino
    m.box(-0.14, 0.35, 0.95, 0.14, 0.7, 1.2, C('rosso'), C('rosso'))
    m.box(-0.1, 0.7, 1.0, 0.1, 0.76, 1.16, C('nero_caldo'))
    # volante
    volante(m, 0, 0.98, -0.1, 0.15)
    return _obj(m)


MODELS = {'cs_v_kart': cs_v_kart, 'cs_v_papera': cs_v_papera}
