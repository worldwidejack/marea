# MAREA — veicoli dell'Isola delle Corse (#178): ruote, due ruote, acqua, scivoli e i buffi.
# Riferimento: assets/concept/corse/corse_12_veicoli.jpg. Un veicolo = una guida (docs/CORSE.md A6).
# Davanti −Z, pivot a terra al centro, lunghezza lungo Z, seduta dove sta il pilota (il pilota si aggiunge dopo).
# Budget: fino a 1800 triangoli per le Corse (stile Mario Kart: forme tonde e smussate, flat shading), nomi cs_v_<nome>.
import math
from lib import Mesh, Xf, beam, face, fix_winding
from corse_kit import C, ruota, sfera, volante, fascia, scatola_tonda, tubo_z, corpo_y


def _obj(m):
    return [m.build()]


def gomma_x(m, x, z, r=0.28, larga=0.24, cerchio='pietra', gomma='nero_caldo', n=12):
    """Ruota con la gomma bombata (spalle smussate, asse X) e il cerchio chiaro che sporge fuori."""
    y = r
    lato = 1 if x >= 0 else -1
    h = larga / 2

    def an(xx, rr):
        return [(xx, y + rr * math.cos(2 * math.pi * i / n), z + rr * math.sin(2 * math.pi * i / n)) for i in range(n)]
    st = len(m.polys)
    rs = [an(x - h, r * 0.78), an(x - h * 0.72, r * 0.98), an(x + h * 0.72, r * 0.98), an(x + h, r * 0.78)]
    m.loft(rs, C(gomma), top=C(gomma), bottom=C(gomma))
    fix_winding(m, st)
    beam(m, (x + lato * (h - 0.02), y, z), (x + lato * (h + 0.03), y, z), 1.1 * r, 1.1 * r, C(cerchio), end=C(cerchio), n=8)


def cs_v_kart():
    """Kart da gara: musetto rosso e bianco, ala davanti, motore giallo dietro, sedile nero."""
    m = Mesh('cs_v_kart')
    # fondo e fianchi tondi
    scatola_tonda(m, -0.5, 0.1, -0.95, 0.5, 0.3, 0.85, C('pietra_scura'), r=0.07, seg=2)
    for s in (-1, 1):
        scatola_tonda(m, s * 0.5 - 0.14, 0.18, -0.35, s * 0.5 + 0.14, 0.44, 0.55, C('rosso'), r=0.09, seg=2, muso=(0.75, 0.8, 0.0))
        m.box(s * 0.5 - 0.03, 0.44, -0.3, s * 0.5 + 0.03, 0.447, 0.5, C('pietra_chiara'), skip=('bottom', 'front', 'back', 'left', 'right'))
    # musetto che si stringe (sezioni tonde) + striscia bianca
    tubo_z(m, [(-1.12, 0, 0.27, 0.4, 0.15, 0.07), (-0.85, 0, 0.29, 0.52, 0.19, 0.09), (-0.55, 0, 0.31, 0.68, 0.22, 0.1)], C('rosso'), seg=2)
    for (za, ya), (zb, yb) in (((-1.12, 0.345), (-0.85, 0.385)), ((-0.85, 0.385), (-0.55, 0.42))):
        face(m, [(-0.09, ya + 0.006, za), (0.09, ya + 0.006, za), (0.09, yb + 0.006, zb), (-0.09, yb + 0.006, zb)], C('pietra_chiara'), (0, 1, 0))
    sfera(m, 0, 0.26, -1.14, 0.2, 0.08, 0.09, C('pietra_chiara'), n=10, rings=3)       # paraurti tondo
    # ala davanti (profilo smussato) e piastre rosse
    scatola_tonda(m, -0.78, 0.12, -1.3, 0.78, 0.2, -1.05, C('pietra_chiara'), r=0.035, seg=2)
    for s in (-1, 1):
        scatola_tonda(m, s * 0.8 - 0.04, 0.12, -1.3, s * 0.8 + 0.04, 0.3, -1.05, C('rosso'), r=0.035, seg=2, muso=(1, 0.8, 0.02))
    # sedile a guscio
    scatola_tonda(m, -0.28, 0.3, -0.05, 0.28, 0.4, 0.42, C('nero_caldo'), r=0.045, seg=2)
    scatola_tonda(m, -0.3, 0.3, 0.38, 0.3, 0.88, 0.5, C('nero_caldo'), r=0.055, seg=2)
    # motore dietro: blocco tondo + due cilindri
    scatola_tonda(m, -0.3, 0.3, 0.55, 0.3, 0.7, 0.9, C('pietra_scura'), r=0.09, seg=2)
    beam(m, (-0.18, 0.6, 0.55), (-0.18, 0.6, 0.98), 0.2, 0.2, C('giallo'), end=C('giallo'), n=10)
    beam(m, (0.18, 0.6, 0.55), (0.18, 0.6, 0.98), 0.2, 0.2, C('arancio'), end=C('arancio'), n=10)
    volante(m, 0, 0.78, -0.3, 0.17)
    # ruote: dietro più grosse
    for s in (-1, 1):
        gomma_x(m, s * 0.66, -0.9, r=0.22, larga=0.2)
        gomma_x(m, s * 0.66, 0.55, r=0.28, larga=0.3)
    return _obj(m)


def cs_v_papera():
    """Papera di gomma gonfiabile: corpo giallo, becco arancio, motorino rosso dietro."""
    m = Mesh('cs_v_papera')
    # ciambella blu alla base (galleggiante), tonda
    corpo_y(m, [(0.0, 0.54, 0.84, 0, 0), (0.07, 0.65, 0.96, 0, 0), (0.18, 0.71, 1.02, 0, 0), (0.29, 0.69, 1.0, 0, 0)], C('acqua_profonda'), n=14, cima=False)
    # corpo giallo, panciuto
    corpo_y(m, [(0.27, 0.64, 0.96, 0, 0.0), (0.4, 0.72, 1.04, 0, 0.0), (0.58, 0.72, 1.04, 0, 0.0), (0.8, 0.6, 0.94, 0, 0.02), (0.94, 0.4, 0.74, 0, 0.04)], C('giallo'), n=14, fondo=False)
    # testa tonda e becco largo e curvo
    sfera(m, 0, 1.25, -0.5, 0.42, 0.4, 0.42, C('giallo'), n=14, rings=6)
    sfera(m, 0, 1.15, -1.0, 0.26, 0.075, 0.34, C('arancio'), n=12, rings=3)
    sfera(m, 0, 1.21, -0.96, 0.23, 0.075, 0.3, C('arancio'), n=12, rings=3)
    # occhi tondi
    for s in (-1, 1):
        sfera(m, s * 0.27, 1.35, -0.84, 0.075, 0.095, 0.06, C('nero_caldo'), n=8, rings=3)
    # ali ovali
    for s in (-1, 1):
        sfera(m, s * 0.72, 0.72, 0.2, 0.06, 0.26, 0.4, C('giallo'), n=10, rings=3)
    # coda a goccia
    sfera(m, 0, 0.9, 0.98, 0.13, 0.17, 0.24, C('giallo'), n=10, rings=3)
    # motorino
    scatola_tonda(m, -0.14, 0.35, 0.95, 0.14, 0.7, 1.2, C('rosso'), r=0.05, seg=2)
    scatola_tonda(m, -0.1, 0.7, 1.0, 0.1, 0.76, 1.16, C('nero_caldo'), r=0.025, seg=1)
    # volante
    volante(m, 0, 0.98, -0.1, 0.15)
    return _obj(m)


MODELS = {'cs_v_kart': cs_v_kart, 'cs_v_papera': cs_v_papera}
