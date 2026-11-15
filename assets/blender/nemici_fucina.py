# Nemici della Fucina Sommersa, snodati (issue 723; prima statici in models_fucina.py). Kit e nomi delle ossa: nemici_kit.py.
#   npm run assets nem_scintilla nem_fornace nem_palombaro nem_forgiatore
# Le parti accese usano mat_emissivo: quando il Mastro Forgiatore è spento il client le fa diventare cenere (dungeon_actors.ts).
import math
from lib import Xf
from nemici_kit import Rig, Corpo, bipede, arto, anelli, R, tube, blob, cone_dir, quad2, slab, xf, face, EM
from models_rpg import band
from models_fucina import _disco, _sfera


def nem_scintilla():
    """Scintilla-Vapore: palla di fuoco a mezz'aria col cuore giallo, la faccia arrabbiata, due manine di fiamma, cinque schegge rosse
    che le girano attorno e gli sbuffi di vapore in cima."""
    r = Rig('nem_scintilla')
    m = r.m
    with r.osso('corpo', (0, 0.9, 0)):
        _sfera(m, (0, 0.9, 0), 0.34, 'p_arancio', n=8, mat=EM)
        _sfera(m, (0, 0.92, -0.1), 0.23, 'p_giallo', n=6, mat=EM)
        for sx in (-1, 1):
            m.cbox(sx * 0.09, -0.335, 0.08, 0.04, 0.93, 0.99, 'p_nero_caldo')                                   # occhi
            with xf(m, t=(sx * 0.1, 1.02, -0.33), r=(0, 0, -sx * 25)):
                m.box(-0.06, -0.012, -0.01, 0.06, 0.012, 0.01, 'p_nero_caldo', skip=())                          # sopracciglia arrabbiate
        m.box(-0.07, 0.8, -0.34, 0.07, 0.83, -0.325, 'p_nero_caldo', skip=())                                    # la bocca
        with r.osso('fiamma', (0, 1.15, 0)):
            for k, (x, z, h) in enumerate(((0, 0.05, 0.45), (0.14, 0.1, 0.32), (-0.13, 0.08, 0.35), (0.05, 0.2, 0.28))):
                cone_dir(m, (x, 1.12, z), (x * 1.3, 1.12 + h, z + 0.12), 0.11 - 0.015 * k, 4, 'p_arancio' if k % 2 else 'p_rosso', mat=EM)
            _sfera(m, (0.12, 1.5, 0.12), 0.13, 'p_pietra_chiara', n=5)
            _sfera(m, (-0.1, 1.6, 0.05), 0.1, 'p_sabbia_chiara', n=5)
        for lato, sx in (('sx', -1), ('dx', 1)):
            with r.osso('braccio_' + lato, (sx * 0.3, 0.9, 0)):
                cone_dir(m, (sx * 0.3, 0.88, 0), (sx * 0.52, 0.72, -0.12), 0.08, 4, 'p_arancio', mat=EM)
    with r.osso('schegge', (0, 0.9, 0)):
        for k in range(5):
            a = k * 1.257
            m.push(Xf(t=(math.cos(a) * 0.5, 0.75 + (k % 2) * 0.3, math.sin(a) * 0.5), r=(k * 57, k * 40, 0)))
            m.cone(3, 0.1, -0.08, 0.12, 'p_rosso', bottom='p_rosso', mat=EM)
            m.pop()
    return r.build()


def nem_fornace():
    """Fornace Semovente: forno di ghisa sui cingoli (le ruote girano), lo sportello davanti che si spalanca sul fuoco quando attacca, fasce
    d'ottone, il comignolo con la brace, la pala da carbone davanti."""
    r = Rig('nem_fornace')
    m = r.m
    for sx in (-1, 1):
        m.cbox(sx * 0.48, 0, 0.32, 1.5, 0.0, 0.08, 'p_nero_caldo')
        m.cbox(sx * 0.48, 0, 0.32, 1.5, 0.34, 0.4, 'p_nero_caldo')
        for z in (-0.75, 0.75):
            with xf(m, t=(sx * 0.48, 0.2, z), r=(0, 0, 90)):
                m.prism(8, 0.2, 0.2, -0.16, 0.16, 'p_nero_caldo', top='p_nero_caldo', bottom='p_nero_caldo')
    with r.osso('ruote', (0, 0.2, 0)):
        for sx in (-1, 1):
            for z in (-0.4, 0, 0.4):
                with xf(m, t=(sx * 0.48, 0.2, z), r=(0, 0, 90)):
                    m.prism(6, 0.15, 0.15, -0.17, 0.17, 'p_pietra_scura', top='p_arancio', bottom='p_arancio')
    with r.osso('corpo', (0, 0.4, 0)):
        m.cbox(0, 0.05, 1.05, 1.2, 0.375, 1.38, 'p_legno_scuro', top='p_nero_caldo')
        for y in (0.5, 1.18):
            m.cbox(0, 0.05, 1.1, 1.25, y, y + 0.1, 'p_arancio', skip=('top', 'bottom'))
        for x in (-0.4, 0.4):
            for y in (0.66, 1.0):
                blob(m, (x, y, -0.56), 0.035, 0.035, 0.02, 'p_arancio', n=4, k=2)
        m.box(-0.28, 0.66, -0.6, 0.28, 1.06, -0.54, 'p_nero_caldo', skip=('back',))
        m.box(-0.23, 0.7, -0.61, 0.23, 1.0, -0.58, 'p_arancio', skip=('back',), mat=EM)                          # il fuoco
        m.box(-0.15, 0.73, -0.62, 0.15, 0.87, -0.6, 'p_giallo', skip=('back',), mat=EM)
        with r.osso('sportello', (-0.3, 0.86, -0.62)):
            m.box(-0.31, 0.64, -0.67, 0.29, 1.08, -0.62, 'p_pietra_scura')
            for k in range(3):
                m.box(-0.25, 0.72 + 0.11 * k, -0.68, 0.23, 0.76 + 0.11 * k, -0.67, 'p_nero_caldo', skip=('back',))
            m.box(0.18, 0.84, -0.71, 0.24, 0.9, -0.67, 'p_arancio')
        m.prism(6, 0.16, 0.13, 1.3, 2.05, 'p_nero_caldo', cx=0.25, cz=0.35)
        m.prism(6, 0.1, 0.1, 2.03, 2.11, 'p_rosso', top='p_rosso', cx=0.25, cz=0.35, mat=EM)
        for k, (x, z) in enumerate(((-0.25, 0.25), (-0.35, -0.2))):                                           # carbone sopra
            blob(m, (x, 1.42, z), 0.12, 0.08, 0.12, 'p_nero_caldo', n=5, k=2, jit=0.3, seed=k)
        with r.osso('cannone', (0, 0.4, -0.6)):  # la pala davanti (si abbassa e spinge)
            with xf(m, t=(0, 0.25, -0.9), r=(-17, 0, 0)):
                m.box(-0.45, -0.04, -0.175, 0.45, 0.04, 0.175, 'p_pietra')
                m.box(-0.45, -0.04, -0.2, 0.45, 0.12, -0.17, 'p_pietra_scura')
            for sx in (-1, 1):
                tube(m, [(sx * 0.35, 0.5, -0.58), (sx * 0.35, 0.27, -0.82)], [0.03, 0.03], 4, 'p_pietra_scura')
    return r.build()


def nem_palombaro():
    """Golem-Palombaro: scafandro di tela e ottone, scarponi di piombo, il pettorale d'ottone coi bulloni, l'elmo tondo con i tre oblò
    (davanti brilla), i pugni di ferro, la bombola e il tubo dell'aria; sulla schiena le due valvole rosse, il suo punto debole."""
    r = Rig('nem_palombaro')
    c = Corpo(2.3, k=1.3, gambe=0.75)
    c.vita, c.spalla, c.collo, c.gomito, c.polso = 0.85, 1.55, 1.6, 1.2, 0.86
    c.sx, c.hx, c.r_coscia, c.r_stinco, c.r_braccio, c.r_avambraccio, c.mano = 0.6, 0.2, 0.15, 0.14, 0.15, 0.14, 0.0
    c.fianchi = (0.4, 0.3)

    def busto(r, c):
        m = r.m
        anelli(m, [R(m, 0.4, 0.84, 0.3), R(m, 0.47, 1.1, 0.34), R(m, 0.5, 1.45, 0.34), R(m, 0.34, 1.62, 0.28)], 'p_sabbia', top='p_sabbia')
        m.box(-0.42, 0.95, -0.38, 0.42, 1.6, -0.3, 'p_arancio')                                                 # il pettorale
        for x in (-0.33, 0.33):
            for y in (1.03, 1.52):
                blob(m, (x, y, -0.39), 0.03, 0.03, 0.02, 'p_pietra_scura', n=4, k=2)
        m.prism(8, 0.16, 0.16, 0.95, 1.55, 'p_pietra', top='p_pietra', bottom='p_pietra', cz=0.44)              # la bombola
        for sx in (-1, 1):
            _disco(m, (sx * 0.28, 1.35, 0.36), 0.15, 0.05, 'p_rosso', n=8, mat=EM)                                # le valvole: il punto debole
            m.cbox(sx * 0.28, 0.4, 0.28, 0.05, 1.33, 1.37, 'p_giallo')

    def testa(r, c, base):
        m = r.m
        _sfera(m, (0, 1.88, -0.02), 0.38, 'p_arancio', n=8)
        band(m, (0, 0, -0.02), 0.39, 0.39, 1.6, 1.68, 'p_legno_scuro', n=8, both=False)
        _disco(m, (0, 1.9, -0.37), 0.16, 0.08, 'p_legno_scuro', n=8)
        face(m, [(math.cos(2 * math.pi * i / 8) * 0.12, 1.9 + math.sin(2 * math.pi * i / 8) * 0.12, -0.415) for i in range(8)], 'p_acqua_bassa', (0, 0, -1), mat=EM)
        for sx in (-1, 1):
            m.push(Xf(t=(sx * 0.35, 1.9, -0.05), r=(0, 90, 0)))
            _disco(m, (0, 0, 0), 0.09, 0.07, 'p_acqua_bassa', n=8)
            m.pop()
        tube(m, [(0, 1.95, 0.35), (0, 1.75, 0.55), (0, 1.5, 0.48)], [0.04, 0.04, 0.04], 4, 'p_nero_caldo')     # il tubo dell'aria

    def pugno(r, c, p):
        m = r.m
        m.cbox(p[0], p[2], 0.34, 0.34, p[1] - 0.3, p[1] + 0.02, 'p_pietra_scura', top='p_roccia')
        band(m, (p[0], 0, p[2]), 0.18, 0.18, p[1] - 0.02, p[1] + 0.04, 'p_arancio', n=6, both=False)

    def spalliera(r, c, p, sx):
        blob(r.m, (p[0], p[1] - 0.05, 0), 0.2, 0.17, 0.2, 'p_sabbia', n=6, k=3)

    c.spalliera = spalliera
    bipede(r, c, gamba='p_sabbia', scarpa='p_nero_caldo', bacino='p_sabbia', busto=None, braccio='p_sabbia', mano='p_pietra_scura',
           testa=testa, mano_dx=pugno, mano_sx=pugno, sul_busto=busto, n=6)
    for lato, sx in (('sx', -1), ('dx', 1)):  # gli scarponi di piombo
        with r.osso('stinco_' + lato):
            r.m.cbox(sx * c.hx, -0.05, 0.38, 0.5, 0, 0.24, 'p_nero_caldo', top='p_pietra_scura', skip=('bottom',))
    return r.build()


def nem_forgiatore():
    """Il Mastro Forgiatore (boss): centauro di ferro e ottone. Corpo di cavallo su quattro zampe snodate con gli zoccoli, due comignoli
    sulla groppa, busto con la fornace accesa nella pancia, testa a maschera con la fronte d'ottone e gli occhi a fessura, il martello
    da forgia nella destra e le tenaglie col pezzo rovente nella sinistra."""
    r = Rig('nem_forgiatore')
    m = r.m
    with r.osso('corpo', (0, 1.25, 0.05)):
        m.cbox(0, 0.05, 1.0, 1.75, 0.9, 1.6, 'p_roccia', top='p_pietra_scura')
        for y in (0.95, 1.47):
            m.cbox(0, 0.05, 1.05, 1.8, y, y + 0.1, 'p_arancio', skip=('top', 'bottom'))
        m.prism(6, 0.15, 0.12, 1.55, 2.45, 'p_nero_caldo', cx=-0.25, cz=0.6)
        m.prism(6, 0.15, 0.12, 1.55, 2.25, 'p_nero_caldo', cx=0.25, cz=0.75)
        m.prism(6, 0.1, 0.1, 2.43, 2.5, 'p_rosso', top='p_rosso', cx=-0.25, cz=0.6, mat=EM)
        m.prism(6, 0.1, 0.1, 2.23, 2.3, 'p_rosso', top='p_rosso', cx=0.25, cz=0.75, mat=EM)
        with r.osso('coda', (0, 1.4, 0.95)):
            tube(m, [(0, 1.4, 0.92), (0, 1.15, 1.2), (0, 0.8, 1.3)], [0.08, 0.06, 0.03], 4, 'p_nero_caldo')
        for nome, x, z in (('as', -0.38, -0.55), ('ad', 0.38, -0.55), ('ps', -0.38, 0.65), ('pd', 0.38, 0.65)):
            with r.osso('zampa_' + nome, (x, 0.95, z)):
                m.cbox(x, z, 0.26, 0.28, 0.55, 0.98, 'p_pietra_scura')
                _disco(m, (x, 0.57, z - 0.15), 0.08, 0.04, 'p_arancio', n=6)
                with r.osso('piede_' + nome, (x, 0.55, z)):
                    m.cbox(x, z, 0.2, 0.22, 0.14, 0.58, 'p_pietra_scura')
                    m.cbox(x, z - 0.02, 0.32, 0.34, 0, 0.18, 'p_nero_caldo', skip=('bottom',))
                    m.cbox(x, z - 0.02, 0.34, 0.36, 0.16, 0.2, 'p_arancio')
        with r.osso('busto', (0, 1.55, -0.55)):
            m.cbox(0, -0.55, 0.9, 0.7, 1.525, 2.475, 'p_legno_scuro')
            m.cbox(0, -0.55, 0.96, 0.76, 2.4, 2.5, 'p_arancio')
            m.box(-0.28, 1.69, -0.94, 0.28, 2.11, -0.88, 'p_nero_caldo', skip=('back',))
            m.box(-0.23, 1.74, -0.975, 0.23, 2.06, -0.925, 'p_arancio', skip=('back',), mat=EM)
            m.box(-0.15, 1.76, -0.99, 0.15, 1.92, -0.93, 'p_giallo', skip=('back',), mat=EM)
            for k in range(3):
                m.box(-0.28, 1.76 + 0.11 * k, -0.99, 0.28, 1.79 + 0.11 * k, -0.94, 'p_nero_caldo', skip=('back',))
            with r.osso('testa', (0, 2.5, -0.6)):
                m.cbox(0, -0.6, 0.44, 0.4, 2.53, 2.91, 'p_pietra_scura')
                m.cbox(0, -0.6, 0.5, 0.46, 2.91, 2.99, 'p_giallo')
                m.box(-0.15, 2.73, -0.83, 0.15, 2.79, -0.79, 'p_giallo', skip=('back',), mat=EM)
                m.cbox(0, -0.82, 0.08, 0.06, 2.55, 2.7, 'p_pietra_scura')
            for lato, sx in (('sx', -1), ('dx', 1)):
                with r.osso('braccio_' + lato, (sx * 0.6, 2.35, -0.55)):
                    blob(m, (sx * 0.6, 2.38, -0.55), 0.2, 0.16, 0.2, 'p_arancio', n=6, k=3)
                    m.cbox(sx * 0.62, -0.55, 0.3, 0.3, 1.95, 2.4, 'p_legno_scuro')
                    with r.osso('avambraccio_' + lato, (sx * 0.62, 1.95, -0.55)):
                        m.cbox(sx * 0.62, -0.55, 0.26, 0.26, 1.5, 1.98, 'p_roccia')
                        m.cbox(sx * 0.62, -0.55, 0.3, 0.3, 1.42, 1.56, 'p_pietra_scura')
                        if sx > 0:  # il martello da forgia, in avanti
                            with xf(m, t=(0.62, 1.48, -0.6), r=(-90, 0, 0)):
                                m.prism(6, 0.06, 0.06, -0.1, 1.15, 'p_legno', top='p_legno', bottom='p_legno')
                                m.box(-0.25, 1.05, -0.2, 0.25, 1.45, 0.2, 'p_nero_caldo')
                                m.box(-0.27, 1.1, -0.22, 0.27, 1.16, 0.22, 'p_arancio')
                        else:       # le tenaglie col pezzo rovente
                            for k in (-1, 1):
                                with xf(m, t=(-0.62 + 0.06 * k, 1.48, -0.6), r=(-90, 0, 6 * k)):
                                    m.box(-0.025, -0.05, -0.025, 0.025, 0.75, 0.025, 'p_pietra')
                            m.cbox(-0.62, -1.35, 0.22, 0.1, 1.44, 1.52, 'p_rosso', mat=EM)
    return r.build()


MODELS = {f.__name__: f for f in (nem_scintilla, nem_fornace, nem_palombaro, nem_forgiatore)}
MODELS_RPG = list(MODELS.values())
