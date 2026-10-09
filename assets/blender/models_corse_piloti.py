# MAREA — animali piloti dell'Isola delle Corse (#178): in piedi col casco sotto il braccio, come nel concept.
# Riferimento: assets/concept/corse/corse_06_animali_piloti.jpg. Statici (nessuno scheletro): servono a podio, hub e schermata di scelta.
# Davanti −Z, pivot ai piedi, altezza 1,5-1,9 m, nomi cs_p_<animale>. Budget: fino a 1500 triangoli come gli avatar.
import math
from lib import Mesh, Xf, beam
from corse_kit import C, sfera, casco


def _obj(m):
    return [m.build()]


def _braccio(m, s, y_spalla, z, lungo, colore, mano, x_spalla):
    """Braccio piegato in avanti (casco sotto il braccio)."""
    beam(m, (x_spalla, y_spalla, z), (x_spalla + s * 0.06, y_spalla - lungo * 0.55, z - 0.04), 0.2, 0.2, C(colore), end=C(colore), n=6)
    beam(m, (x_spalla + s * 0.06, y_spalla - lungo * 0.55, z - 0.04), (x_spalla + s * 0.02, y_spalla - lungo * 0.85, z - 0.22), 0.17, 0.17, C(colore), end=C(mano), n=6)


def cs_p_granchio():
    """Granchio campione: corpo rosso largo, occhi su stelo, due chele, tuta bianca col granchio sul petto."""
    m = Mesh('cs_p_granchio')
    # gambe: 3 per lato
    for s in (-1, 1):
        for k, z in enumerate((-0.18, 0.0, 0.18)):
            beam(m, (s * 0.35, 0.3, z), (s * 0.62, 0.16, z + 0.02 * (k - 1)), 0.07, 0.07, C('rosso'), end=C('rosso'), n=4)
            beam(m, (s * 0.62, 0.16, z + 0.02 * (k - 1)), (s * 0.7, 0.0, z + 0.04 * (k - 1)), 0.06, 0.06, C('arancio'), end=C('arancio'), n=4)
    # corpo: carapace schiacciato
    m.loft([m.ring(8, 0.5, 0.26, rz=0.42), m.ring(8, 0.62, 0.46, rz=0.5), m.ring(8, 0.5, 0.66, rz=0.42)], C('rosso'), top=C('rosso'), bottom=C('arancio'))
    # tuta: pettorina bianca davanti con un granchio
    m.box(-0.28, 0.32, -0.52, 0.28, 0.62, -0.4, C('pietra_chiara'), C('pietra_chiara'))
    m.box(-0.12, 0.4, -0.535, 0.12, 0.52, -0.52, C('rosso'))
    m.box(-0.28, 0.32, -0.536, 0.28, 0.36, -0.52, C('nero_caldo'))
    # occhi su stelo
    for s in (-1, 1):
        beam(m, (s * 0.2, 0.62, -0.25), (s * 0.2, 0.98, -0.28), 0.08, 0.08, C('rosso'), end=None, n=4)
        sfera(m, s * 0.2, 1.04, -0.3, 0.1, 0.1, 0.1, C('pietra_chiara'), n=6, rings=2)
        m.box(s * 0.2 - 0.035, 1.02, -0.405, s * 0.2 + 0.035, 1.08, -0.39, C('nero_caldo'))
    # chele
    for s in (-1, 1):
        beam(m, (s * 0.55, 0.5, -0.2), (s * 0.82, 0.62, -0.5), 0.16, 0.14, C('rosso'), end=C('rosso'), n=4)
        m.box(s * 0.82 - 0.2, 0.5, -0.9, s * 0.82 + 0.2, 0.74, -0.46, C('rosso'), C('arancio'))
        m.box(s * 0.82 - 0.04, 0.5, -1.0, s * 0.82 + 0.04, 0.74, -0.9, C('rosso'))
    # casco sotto la chela sinistra (di chi guarda: lato +X)
    casco(m, 0.95, 0.88, -0.42, 0.18, 'pietra_chiara', striscia='rosso')
    return _obj(m)


def cs_p_tricheco():
    """Tricheco campione: tuta blu con l'ancora, muso marrone con baffi e zanne, casco giallo e blu sotto il braccio."""
    m = Mesh('cs_p_tricheco')
    # gambe e scarpe
    for s in (-1, 1):
        beam(m, (s * 0.2, 0.1, 0), (s * 0.2, 0.7, 0), 0.3, 0.3, C('acqua_profonda'), end=None, n=6)
        m.box(s * 0.2 - 0.17, 0.0, -0.36, s * 0.2 + 0.17, 0.16, 0.14, C('nero_caldo'), C('nero_caldo'))
        m.box(s * 0.2 - 0.17, 0.08, -0.36, s * 0.2 + 0.17, 0.12, 0.14, C('giallo'), skip=('top', 'bottom'))
    # tronco: tuta blu, ventre grosso
    m.loft([m.ring(8, 0.44, 0.65, rz=0.34), m.ring(8, 0.56, 1.0, rz=0.42), m.ring(8, 0.54, 1.34, rz=0.4), m.ring(8, 0.4, 1.52, rz=0.3)], C('acqua_profonda'), top=C('acqua_profonda'))
    # bande gialle sulla tuta e ancora sul petto
    m.box(-0.5, 0.95, -0.431, 0.5, 1.03, -0.42, C('giallo'))
    m.box(-0.07, 1.08, -0.435, 0.07, 1.42, -0.42, C('pietra_chiara'))
    m.box(-0.2, 1.12, -0.435, 0.2, 1.2, -0.42, C('pietra_chiara'))
    m.box(-0.22, 1.38, -0.435, 0.22, 1.44, -0.42, C('pietra_chiara'))
    m.box(-0.5, 0.62, -0.38, 0.5, 0.7, 0.38, C('nero_caldo'))
    # braccia
    for s in (-1, 1):
        beam(m, (s * 0.56, 1.4, 0), (s * 0.72, 0.95, -0.05), 0.26, 0.26, C('acqua_profonda'), end=C('acqua_profonda'), n=6)
        beam(m, (s * 0.72, 0.95, -0.05), (s * 0.68, 0.6, -0.2), 0.22, 0.22, C('acqua_profonda'), end=C('legno'), n=6)
    # testa marrone con muso grosso
    sfera(m, 0, 1.78, -0.05, 0.4, 0.38, 0.4, C('legno'), n=8, rings=3)
    m.box(-0.27, 1.5, -0.62, 0.27, 1.78, -0.28, C('legno_chiaro'), C('legno_chiaro'))
    m.box(-0.3, 1.53, -0.64, 0.3, 1.63, -0.34, C('legno_scuro'), C('legno_scuro'))   # baffi
    m.box(-0.1, 1.72, -0.66, 0.1, 1.82, -0.58, C('nero_caldo'))                        # naso
    # zanne
    for s in (-1, 1):
        beam(m, (s * 0.15, 1.56, -0.6), (s * 0.17, 1.14, -0.62), 0.09, 0.09, C('pietra_chiara'), end=C('pietra_chiara'), n=4)
    # occhi con sopracciglio duro
    for s in (-1, 1):
        m.box(s * 0.2 - 0.05, 1.88, -0.44, s * 0.2 + 0.05, 1.96, -0.4, C('nero_caldo'))
        m.box(s * 0.2 - 0.09, 1.97, -0.46, s * 0.2 + 0.09, 2.03, -0.4, C('legno_scuro'))
    # casco sotto il braccio sinistro (+X)
    casco(m, 0.8, 0.72, -0.38, 0.2, 'giallo', striscia='acqua_profonda')
    return _obj(m)


MODELS = {'cs_p_granchio': cs_p_granchio, 'cs_p_tricheco': cs_p_tricheco}
