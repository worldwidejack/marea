# MAREA — animali piloti dell'Isola delle Corse (#178): in piedi col casco sotto il braccio, come nel concept.
# Riferimento: assets/concept/corse/corse_06_animali_piloti.jpg. Statici (nessuno scheletro): servono a podio, hub e schermata di scelta.
# Davanti −Z, pivot ai piedi, altezza 1,5-1,9 m, nomi cs_p_<animale>. Budget Corse: fino a 3000 triangoli (look più morbido: sfere, cilindri, ellissoidi).
import math
from lib import Mesh, Xf, beam
from corse_kit import C, sfera, corpo_y


def _obj(m):
    return [m.build()]


def _cil(m, p0, p1, d, colore, n=10):
    """Cilindro tondo chiuso da p0 a p1, diametro d."""
    beam(m, p0, p1, d, d, C(colore), end=C(colore), n=n)


def _pal(m, x, y, z, r, colore, n=10, rings=4):
    """Palla (giunto, mano, occhio)."""
    sfera(m, x, y, z, r, r, r, C(colore), n=n, rings=rings)


def _casco(m, cx, cy, cz, r, colore, striscia=None, visiera='nero_caldo'):
    """Casco sferico con visiera a cupola scura sul davanti (−Z) e una striscia sopra."""
    sfera(m, cx, cy, cz, r, r * 0.95, r, C(colore), n=12, rings=4)
    sfera(m, cx, cy - r * 0.03, cz - r * 0.6, r * 0.74, r * 0.36, r * 0.42, C(visiera), n=10, rings=3)
    if striscia:
        sfera(m, cx, cy + r * 0.8, cz, r * 0.11, r * 0.22, r * 0.82, C(striscia), n=8, rings=3)


def cs_p_granchio():
    """Granchio campione: carapace tondo e bombato, occhi sfera su stelo, chele a pinza, gambe snodate, pettorina bianca col granchio."""
    m = Mesh('cs_p_granchio')
    # gambe snodate: 3 per lato, cosce che salgono al ginocchio e stinchi che scendono a terra
    for s in (-1, 1):
        for k, z in enumerate((-0.2, 0.02, 0.24)):
            ks = 1.0 + 0.12 * k
            gx, gy = s * 0.5, 0.36
            kx, ky, kz = s * 0.86 * ks, 0.52, z * 1.25
            fx, fz = s * 1.0 * ks, z * 1.45
            _cil(m, (gx, gy, z), (kx, ky, kz), 0.1, 'rosso', n=8)
            _pal(m, kx, ky, kz, 0.065, 'rosso', n=8, rings=3)
            _cil(m, (kx, ky, kz), (fx, 0.04, fz), 0.08, 'arancio', n=8)
            _pal(m, fx, 0.04, fz, 0.05, 'arancio', n=8, rings=3)
    # carapace: cupola larga e bassa, panciuta
    corpo_y(m, [(0.28, 0.4, 0.34, 0, 0), (0.4, 0.64, 0.52, 0, 0), (0.55, 0.7, 0.57, 0, 0), (0.7, 0.58, 0.47, 0, 0),
                (0.82, 0.34, 0.28, 0, 0), (0.88, 0.12, 0.1, 0, 0)], C('rosso'), n=16)
    # sotto più chiaro
    sfera(m, 0, 0.3, 0, 0.42, 0.06, 0.35, C('arancio'), n=12, rings=2)
    # tuta: pettorina bianca bombata col granchio, cintura nera
    sfera(m, 0, 0.58, -0.43, 0.34, 0.2, 0.13, C('pietra_chiara'), n=12, rings=4)
    sfera(m, 0, 0.6, -0.55, 0.13, 0.09, 0.03, C('rosso'), n=8, rings=3)
    for s in (-1, 1):
        sfera(m, s * 0.17, 0.5, -0.545, 0.06, 0.03, 0.025, C('rosso'), n=6, rings=2)   # zampette dell'emblema
    sfera(m, 0, 0.4, -0.45, 0.4, 0.04, 0.11, C('nero_caldo'), n=12, rings=2)
    sfera(m, 0, 0.4, -0.55, 0.08, 0.035, 0.02, C('giallo'), n=6, rings=2)             # fibbia
    # occhi sfera su stelo
    for s in (-1, 1):
        _cil(m, (s * 0.2, 0.7, -0.3), (s * 0.2, 1.0, -0.33), 0.1, 'rosso', n=8)
        _pal(m, s * 0.2, 1.1, -0.35, 0.14, 'pietra_chiara', n=10, rings=4)
        _pal(m, s * 0.2, 1.1, -0.47, 0.07, 'nero_caldo', n=8, rings=3)
        sfera(m, s * 0.2, 1.2, -0.38, 0.13, 0.04, 0.08, C('nero_caldo'), n=8, rings=2)   # sopracciglio serio
    # chele: braccio tondo, gomito a palla, mano grossa e due dita (pinza)
    for s in (-1, 1):
        _cil(m, (s * 0.55, 0.5, -0.28), (s * 0.84, 0.6, -0.5), 0.17, 'rosso')
        _pal(m, s * 0.84, 0.6, -0.5, 0.12, 'rosso')
        sfera(m, s * 0.93, 0.66, -0.78, 0.25, 0.22, 0.24, C('rosso'), n=12, rings=4)
        sfera(m, s * 0.9, 0.84, -1.12, 0.1, 0.11, 0.3, C('rosso'), n=10, rings=4)      # dito alto
        sfera(m, s * 0.93, 0.48, -1.1, 0.09, 0.09, 0.28, C('arancio'), n=10, rings=4)  # dito basso
    # casco sferico sotto la chela (lato +X)
    _casco(m, 1.04, 0.8, -0.32, 0.2, 'pietra_chiara', striscia='rosso')
    return _obj(m)


def cs_p_tricheco():
    """Tricheco campione: tuta blu con l'ancora, testa tonda e muso largo con baffi a cuscinetto e zanne, casco sferico sotto il braccio."""
    m = Mesh('cs_p_tricheco')
    # gambe tonde e scarpe arrotondate
    for s in (-1, 1):
        _cil(m, (s * 0.22, 0.12, 0), (s * 0.22, 0.72, 0), 0.34, 'acqua_profonda', n=10)
        sfera(m, s * 0.22, 0.12, -0.1, 0.19, 0.13, 0.31, C('nero_caldo'), n=12, rings=4)
        sfera(m, s * 0.22, 0.13, -0.1, 0.2, 0.022, 0.32, C('giallo'), n=12, rings=2)    # bordo suola giallo
    # tronco tondo: ventre grosso, spalle morbide
    corpo_y(m, [(0.62, 0.42, 0.34, 0, 0), (0.8, 0.53, 0.41, 0, 0), (1.0, 0.58, 0.45, 0, 0), (1.25, 0.55, 0.41, 0, 0),
                (1.45, 0.46, 0.34, 0, 0), (1.58, 0.3, 0.23, 0, 0), (1.63, 0.12, 0.1, 0, 0)], C('acqua_profonda'), n=16)
    # cintura nera e banda gialla
    corpo_y(m, [(0.66, 0.46, 0.37, 0, 0), (0.76, 0.525, 0.415, 0, 0)], C('nero_caldo'), n=16)
    corpo_y(m, [(0.93, 0.575, 0.45, 0, 0), (1.03, 0.595, 0.465, 0, 0)], C('giallo'), n=16)
    # ancora sul petto
    sfera(m, 0, 1.28, -0.41, 0.035, 0.2, 0.03, C('pietra_chiara'), n=8, rings=3)
    sfera(m, 0, 1.34, -0.405, 0.15, 0.035, 0.03, C('pietra_chiara'), n=8, rings=3)
    sfera(m, 0, 1.5, -0.33, 0.06, 0.06, 0.03, C('pietra_chiara'), n=8, rings=3)
    sfera(m, 0, 1.16, -0.4, 0.17, 0.045, 0.03, C('pietra_chiara'), n=8, rings=3)
    # braccia: spalla a palla, braccio e avambraccio cilindrici, mano sferica
    for s in (-1, 1):
        sfera(m, s * 0.56, 1.4, 0, 0.25, 0.23, 0.25, C('acqua_profonda'), n=12, rings=4)
        _cil(m, (s * 0.58, 1.38, 0), (s * 0.74, 0.98, -0.05), 0.3, 'acqua_profonda')
        _pal(m, s * 0.74, 0.98, -0.05, 0.16, 'acqua_profonda')
        _cil(m, (s * 0.74, 0.98, -0.05), (s * 0.7, 0.62, -0.2), 0.27, 'acqua_profonda')
        sfera(m, s * 0.7, 0.62, -0.2, 0.15, 0.15, 0.15, C('legno'), n=10, rings=4)
        sfera(m, s * 0.7, 0.76, -0.2, 0.14, 0.03, 0.14, C('giallo'), n=10, rings=2)      # polsino
    # testa: sfera schiacciata, muso largo e tondo, cuscinetti dei baffi
    sfera(m, 0, 1.83, -0.04, 0.46, 0.39, 0.42, C('legno'), n=14, rings=5)
    sfera(m, 0, 1.68, -0.32, 0.3, 0.22, 0.2, C('legno'), n=12, rings=4)
    for s in (-1, 1):
        sfera(m, s * 0.15, 1.62, -0.5, 0.16, 0.12, 0.12, C('legno_chiaro'), n=10, rings=4)   # cuscinetto baffi
        for k, dy in enumerate((-0.04, 0.03)):
            sfera(m, s * 0.17, 1.62 + dy, -0.6, 0.08, 0.012, 0.012, C('legno_scuro'), n=6, rings=2)  # baffi
    sfera(m, 0, 1.78, -0.58, 0.1, 0.07, 0.06, C('nero_caldo'), n=8, rings=3)               # naso
    # zanne coniche
    for s in (-1, 1):
        corpo_y(m, [(1.62, 0.09, 0.09, s * 0.14, -0.55), (1.4, 0.07, 0.07, s * 0.15, -0.6), (1.18, 0.015, 0.015, s * 0.14, -0.62)], C('pietra_chiara'), n=8)
    # occhi duri col sopracciglio
    for s in (-1, 1):
        sfera(m, s * 0.19, 1.9, -0.37, 0.06, 0.06, 0.05, C('nero_caldo'), n=8, rings=3)
        m.push(Xf(t=(s * 0.19, 1.99, -0.36), r=(0, 0, s * -16)))
        sfera(m, 0, 0, 0, 0.13, 0.04, 0.07, C('legno_scuro'), n=8, rings=3)
        m.pop()
    # casco sferico sotto il braccio sinistro (+X)
    _casco(m, 0.84, 0.72, -0.32, 0.22, 'giallo', striscia='acqua_profonda')
    return _obj(m)


MODELS = {'cs_p_granchio': cs_p_granchio, 'cs_p_tricheco': cs_p_tricheco}
