# Nemici dell'Impianto di Drenaggio (il Collettivo Rottamautomi), snodati (issue 723; prima scatole statiche in models_drenaggio.py).
#   npm run assets nem_tubo nem_operaio nem_valvola nem_capoturno
# Ruggine, ottone, lamiera chiodata, vapore: ferro_rotto e roccia per il metallo vecchio, arancio per l'ottone, giallo acceso per gli occhi.
import math
from nemici_kit import Rig, Corpo, bipede, arto, anelli, R, tube, blob, cone_dir, quad2, slab, xf, face, EM
from models_rpg import band, beam

MURO = 'ferro_rotto'


def _bulloni(m, c, rx, rz, y, n=8, r='p_arancio'):
    for i in range(n):
        a = 2 * math.pi * i / n + math.pi / n
        x, z = c[0] + math.cos(a) * rx, c[2] + math.sin(a) * rz
        blob(m, (x, y, z), 0.025, 0.025, 0.025, r, n=4, k=2)


def nem_tubo():
    """Tubo-strisciante: una lumaca di fanghiglia, ruggine e olio motore che si trascina a onde; un pezzo di tubo d'ottone piantato
    nella schiena che sbuffa, due occhi gialli su peduncoli, la bava nera sotto."""
    r = Rig('nem_tubo')
    m = r.m
    with r.osso('corpo', (0, 0.25, 0.0)):
        m.prism(8, 0.62, 0.58, 0, 0.06, 'p_nero_caldo', top='p_nero_caldo')                                 # la bava
        blob(m, (0, 0.28, 0.0), 0.42, 0.28, 0.38, 'p_legno_scuro', n=8, k=4, jit=0.12, seed=3)
        blob(m, (0.12, 0.42, 0.05), 0.2, 0.16, 0.2, 'p_ombra_calda', n=6, k=3, jit=0.2, seed=5)               # grumi d'olio
        with r.osso('tubo', (-0.08, 0.45, 0.12)):
            with xf(m, t=(-0.08, 0.4, 0.12), r=(-12, 0, 18)):
                m.prism(8, 0.1, 0.1, 0.0, 0.55, 'p_pietra_scura', top='p_nero_caldo')
                m.prism(8, 0.125, 0.125, 0.3, 0.36, 'p_arancio', top='p_arancio', bottom='p_arancio')
                m.prism(8, 0.13, 0.11, 0.52, 0.6, 'p_arancio', top='p_nero_caldo', bottom='p_arancio')
        with r.osso('testa', (0, 0.25, -0.35)):
            blob(m, (0, 0.24, -0.5), 0.3, 0.22, 0.25, 'p_legno', n=8, k=3, jit=0.1, seed=7)
            face(m, [(-0.16, 0.12, -0.74), (0.16, 0.12, -0.74), (0.12, 0.2, -0.72), (-0.12, 0.2, -0.72)], 'p_nero_caldo', (0, 0, -1))  # la bocca
            for sx in (-1, 1):
                tube(m, [(sx * 0.1, 0.38, -0.55), (sx * 0.16, 0.62, -0.62)], [0.035, 0.025], 4, 'p_legno')
                blob(m, (sx * 0.16, 0.65, -0.63), 0.06, 0.06, 0.06, 'p_giallo', n=6, k=3, mat=EM)
                blob(m, (sx * 0.16, 0.65, -0.685), 0.025, 0.025, 0.012, 'p_nero_caldo', n=4, k=2)
        with r.osso('coda', (0, 0.22, 0.35)):
            blob(m, (0, 0.2, 0.55), 0.32, 0.2, 0.3, 'p_legno_scuro', n=8, k=3, jit=0.1, seed=9)
            with r.osso('coda2', (0, 0.15, 0.75)):
                blob(m, (0, 0.13, 0.92), 0.2, 0.13, 0.25, 'p_legno_scuro', n=6, k=3, jit=0.1, seed=11)
                cone_dir(m, (0, 0.12, 1.08), (0, 0.06, 1.3), 0.09, 5, 'p_ombra_calda')
    return r.build()


def _chiave(r, c, p):
    m = r.m
    x, y, z = p
    with xf(m, t=(x, y, z), r=(-90, 0, 0)):  # chiave inglese lunga: manico avanti, la ganascia in fondo
        m.cbox(0, 0, 0.07, 0.05, -0.08, 0.62, 'p_pietra')
        m.cbox(0, 0, 0.22, 0.09, 0.6, 0.72, 'p_pietra')
        m.cbox(-0.08, 0, 0.06, 0.09, 0.72, 0.86, 'p_pietra')
        m.cbox(0.08, 0, 0.06, 0.09, 0.72, 0.8, 'p_pietra_scura')
        m.prism(6, 0.05, 0.05, 0.48, 0.56, 'p_arancio', top='p_arancio', bottom='p_arancio')


def nem_operaio():
    """Operaio Arrugginito: automa del Collettivo col barile chiodato per torso e le fasce d'ottone, la testa a scatola con la visiera
    gialla accesa, il comignolo che fuma sulla spalla, gambe a pistone, la chiave inglese lunga nella destra."""
    r = Rig('nem_operaio')
    c = Corpo(1.85, k=1.15, gambe=0.92)
    c.vita, c.spalla, c.collo = 0.82, 1.42, 1.48
    c.sx, c.r_braccio, c.r_avambraccio, c.r_coscia, c.r_stinco = 0.36, 0.06, 0.055, 0.07, 0.06

    def busto(r, c):
        m = r.m
        m.prism(8, 0.29, 0.33, 0.8, 1.48, MURO, top='p_legno', bottom='p_legno')
        for y in (0.86, 1.36):
            m.prism(8, 0.345, 0.345, y, y + 0.07, 'p_arancio', top='p_arancio', bottom='p_arancio')
            _bulloni(r.m, (0, 0, 0), 0.35, 0.35, y + 0.035)
        m.cbox(0, -0.3, 0.2, 0.06, 1.0, 1.2, 'p_nero_caldo')                                             # lo sportello
        m.cbox(0, -0.33, 0.12, 0.02, 1.05, 1.15, 'p_arancio', mat=EM)
        m.prism(6, 0.075, 0.06, 1.3, 1.85, 'p_nero_caldo', top='p_nero_caldo', cx=-0.2, cz=0.24)          # il comignolo
        m.prism(6, 0.09, 0.09, 1.8, 1.86, 'p_arancio', top='p_nero_caldo', cx=-0.2, cz=0.24)

    def testa(r, c, base):
        m = r.m
        m.cbox(0, 0, 0.1, 0.1, 1.46, 1.54, 'p_roccia')
        m.cbox(0, 0, 0.38, 0.34, 1.52, 1.8, 'p_pietra_scura', top='p_roccia')
        m.cbox(0, -0.172, 0.3, 0.02, 1.62, 1.69, 'p_giallo', mat=EM)                                        # la visiera
        for sx in (-1, 1):
            with xf(m, t=(sx * 0.2, 1.66, 0), r=(0, 0, 90)):
                m.prism(6, 0.05, 0.05, -0.02, 0.02, 'p_arancio', top='p_arancio', bottom='p_arancio')
        m.cbox(0.1, 0.05, 0.04, 0.04, 1.8, 1.95, 'p_roccia'); blob(m, (0.1, 1.97, 0.05), 0.04, 0.04, 0.04, 'p_rosso', n=4, k=2, mat=EM)  # antenna

    def spalliera(r, c, p, sx):
        blob(r.m, (p[0], p[1] - 0.02, 0), 0.12, 0.1, 0.12, 'p_roccia', n=6, k=3)

    def pinza(r, c, p):
        m = r.m
        for k in (-1, 1):
            m.cbox(p[0] + k * 0.04, p[2] - 0.02, 0.03, 0.06, p[1] - 0.12, p[1] + 0.02, 'p_pietra_scura')

    c.spalliera = spalliera
    bipede(r, c, gamba='p_roccia', scarpa='p_nero_caldo', bacino='p_pietra_scura', busto=None, braccio='p_legno_scuro', avambraccio='p_roccia',
           mano='p_pietra_scura', testa=testa, mano_dx=_chiave, mano_sx=pinza, sul_busto=busto)
    for lato, sx in (('sx', -1), ('dx', 1)):  # i pistoni delle ginocchia
        with r.osso('stinco_' + lato):
            r.m.cbox(sx * c.hx, -0.07, 0.1, 0.08, c.ginocchio - 0.06, c.ginocchio + 0.06, 'p_arancio')
            r.m.cbox(sx * c.hx, -0.02, 0.2, 0.3, 0, 0.12, 'p_nero_caldo')
    return r.build()


def nem_valvola():
    """Valvola-SparaVapore: torretta fissata al tubo; il basamento chiodato, la colonna di lamiera, la testa che ruota col manometro
    (lancetta che sale), il volantino rosso del vapore sopra, l'ugello d'ottone che rincula."""
    r = Rig('nem_valvola')
    m = r.m
    m.prism(8, 0.52, 0.46, 0, 0.18, 'p_pietra_scura', top='p_pietra_scura')
    _bulloni(m, (0, 0, 0), 0.47, 0.47, 0.18)
    with xf(m, t=(0, 0.12, 0.55), r=(90, 0, 0)):
        m.prism(8, 0.18, 0.18, -0.4, 0.4, MURO, top='p_arancio', bottom='p_arancio')                       # il tubo a cui è fissata
    with r.osso('corpo', (0, 0.18, 0)):
        m.prism(8, 0.2, 0.2, 0.18, 0.9, MURO, top='p_legno')
        band(m, (0, 0, 0), 0.21, 0.21, 0.55, 0.6, 'p_arancio', n=8, both=False)
        with r.osso('testa', (0, 0.92, 0)):
            m.prism(8, 0.3, 0.3, 0.9, 1.22, MURO, top='p_roccia', bottom='p_roccia')
            m.prism(8, 0.32, 0.32, 1.0, 1.06, 'p_arancio', top='p_arancio', bottom='p_arancio')
            with xf(m, t=(0.31, 1.06, -0.05), r=(0, 0, 90)):                                                 # il manometro di lato
                m.prism(8, 0.12, 0.12, 0.0, 0.04, 'p_arancio', top='p_sabbia_chiara')
            with r.osso('lancetta', (0.36, 1.06, -0.05)):
                m.box(0.355, 1.06, -0.06, 0.365, 1.15, -0.04, 'p_rosso', skip=())
            m.prism(4, 0.03, 0.03, 1.22, 1.38, 'p_roccia', top='p_roccia')
            with r.osso('ruota', (0, 1.38, 0)):
                band(m, (0, 0, 0), 0.26, 0.26, 1.36, 1.42, 'p_rosso', n=8)
                for k in range(4):
                    a = math.pi * k / 2
                    tube(m, [(0, 1.39, 0), (math.cos(a) * 0.25, 1.39, math.sin(a) * 0.25)], [0.02, 0.02], 3, 'p_rosso')
            with r.osso('cannone', (0, 1.06, -0.3)):
                with xf(m, t=(0, 1.06, -0.25), r=(-90, 0, 0)):
                    m.prism(8, 0.12, 0.1, 0.0, 0.5, 'p_arancio', top='p_arancio', bottom='p_arancio')
                    m.prism(8, 0.14, 0.14, 0.42, 0.52, 'p_arancio', top='p_nero_caldo')
                    m.prism(8, 0.13, 0.13, 0.1, 0.16, 'p_roccia', top='p_roccia', bottom='p_roccia')
    return r.build()


def _martello(r, c, p):
    m = r.m
    x, y, z = p
    with xf(m, t=(x, y, z), r=(-90, 0, 0)):  # il martello pneumatico: impugnatura, il cilindro, il pistone, la testa piatta
        m.cbox(0, 0, 0.36, 0.08, -0.04, 0.04, 'p_nero_caldo')
        m.prism(8, 0.16, 0.16, 0.05, 0.75, 'p_pietra_scura', top='p_roccia', bottom='p_roccia')
        for yy in (0.2, 0.5):
            m.prism(8, 0.18, 0.18, yy, yy + 0.06, 'p_arancio', top='p_arancio', bottom='p_arancio')
        m.prism(6, 0.07, 0.07, 0.75, 1.1, 'p_pietra', top='p_pietra')
        m.cbox(0, 0, 0.6, 0.5, 1.1, 1.45, 'p_roccia', top='p_pietra_scura', bottom='p_pietra_scura')
        m.cbox(0, 0, 0.64, 0.54, 1.18, 1.24, 'p_arancio')
        tube(m, [(0.16, 0.3, 0), (0.35, 0.1, 0.1), (0.4, -0.3, 0.2)], [0.03, 0.03, 0.03], 4, 'p_nero_caldo')  # il tubo dell'aria


def nem_capoturno():
    """Il Capoturno (boss, ≈ 3 m): grosso automa logoro, il caschetto giallo da cantiere, la fornace nel petto che arde, due comignoli
    sulla schiena, il braccio sinistro a tenaglia, il martello pneumatico gigante nella destra."""
    r = Rig('nem_capoturno')
    c = Corpo(2.9, k=1.25, gambe=0.85)
    c.vita, c.spalla, c.collo = 1.0, 2.02, 2.1
    c.sx, c.hx, c.r_braccio, c.r_avambraccio, c.r_coscia, c.r_stinco = 0.66, 0.3, 0.14, 0.13, 0.16, 0.14

    def busto(r, c):
        m = r.m
        m.cbox(0, 0, 1.2, 0.85, 0.98, 2.05, MURO, top='p_legno')
        for y in (1.0, 1.9):
            m.cbox(0, 0, 1.26, 0.9, y, y + 0.12, 'p_arancio')
        m.cbox(0, -0.44, 0.56, 0.06, 1.25, 1.68, 'p_nero_caldo')
        m.cbox(0, -0.47, 0.46, 0.04, 1.32, 1.58, 'p_arancio', mat=EM)                                       # la fornace accesa
        for k in range(4):
            m.cbox(0, -0.495, 0.48, 0.02, 1.34 + 0.065 * k, 1.36 + 0.065 * k, 'p_nero_caldo')               # la griglia
        for sx in (-1, 1):
            m.prism(6, 0.12, 0.1, 1.9, 2.6, 'p_nero_caldo', top='p_nero_caldo', cx=sx * 0.32, cz=0.36)
            m.prism(6, 0.14, 0.14, 2.55, 2.62, 'p_arancio', top='p_nero_caldo', cx=sx * 0.32, cz=0.36)

    def testa(r, c, base):
        m = r.m
        m.cbox(0, -0.05, 0.5, 0.46, 2.08, 2.46, 'p_pietra_scura')
        m.cbox(0, -0.29, 0.38, 0.04, 2.24, 2.31, 'p_rosso', mat=EM)
        m.prism(8, 0.4, 0.34, 2.44, 2.62, 'p_giallo', top='p_giallo', cz=-0.05)                             # il caschetto
        m.prism(8, 0.46, 0.46, 2.44, 2.48, 'p_giallo', top='p_giallo', bottom='p_legno', cz=-0.1)
        m.cbox(0, -0.05, 0.06, 0.5, 2.6, 2.66, 'p_arancio')

    def tenaglia(r, c, p):
        m = r.m
        for k in (-1, 1):
            with xf(m, t=(p[0] + 0.07 * k, p[1], p[2]), r=(0, 0, 12 * k)):
                m.cbox(0, -0.04, 0.08, 0.14, -0.35, 0.02, 'p_pietra')

    bipede(r, c, gamba='p_roccia', scarpa='p_nero_caldo', bacino='p_pietra_scura', busto=None, braccio='p_legno_scuro', avambraccio='p_roccia',
           mano='p_pietra_scura', testa=testa, mano_dx=_martello, mano_sx=tenaglia, sul_busto=busto, n=6)
    for lato, sx in (('sx', -1), ('dx', 1)):
        with r.osso('braccio_' + lato):
            blob(r.m, (sx * c.sx, c.spalla, 0), 0.22, 0.17, 0.22, 'p_arancio', n=6, k=3)
        with r.osso('stinco_' + lato):
            r.m.cbox(sx * c.hx, -0.04, 0.42, 0.62, 0, 0.18, 'p_nero_caldo')
    return r.build()


MODELS = {f.__name__: f for f in (nem_tubo, nem_operaio, nem_valvola, nem_capoturno)}
MODELS_RPG = list(MODELS.values())
