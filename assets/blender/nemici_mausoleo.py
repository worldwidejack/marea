# Nemici del Mausoleo della Regina, snodati (issue 723; prima statici in models_mausoleo.py). Kit e nomi delle ossa: nemici_kit.py.
#   npm run assets nem_chierico nem_sentinella nem_guardia nem_custode_egida
# Gli scudi stanno sull'avambraccio sinistro: li disegno come devono stare in guardia (avambraccio in avanti, ALZA gradi) e li riporto
# indietro alla posa di riposo, così in guardia (nemici_pose.ts, stile «scudo») stanno dritti davanti.
import math
from lib import Xf
from nemici_kit import Rig, Corpo, bipede, arto, anelli, R, tube, blob, cone_dir, quad2, slab, xf, face, EM
from models_rpg import band
from models_mausoleo import _disco, _gemma, _quad

ALZA = 80  # gradi dell'avambraccio sinistro in guardia (nemici_pose.ts: GUARDIA.scudo, 1,4 rad)


def _gomito_sx(c):
    return (-c.sx - 0.012 * c.H, c.gomito, 0.005 * c.H)


def nem_chierico():
    """Chierico a Ingranaggi: tonaca di marmo bianco con l'orlo d'ottone, cintura d'ottone, mantellina, testa a cupola con l'occhio
    azzurro, l'ingranaggio come aureola dietro la testa (gira), le maniche larghe, il bastone con la lampada d'olio accesa."""
    r = Rig('nem_chierico')
    c = Corpo(2.0, k=1.05)

    def bacino(r, c):  # la tonaca: un cono che arriva a terra (le gambe dentro non si vedono)
        m = r.m
        anelli(m, [R(m, 0.46, 0.02, 0.4), R(m, 0.36, 0.5, 0.3), R(m, 0.26, c.vita + 0.04, 0.22)], 'p_pietra_chiara', bottom='p_nero_caldo')
        band(m, (0, 0, 0), 0.465, 0.405, 0.02, 0.1, 'p_giallo', n=8, both=False)

    def busto(r, c):
        m = r.m
        anelli(m, [R(m, 0.26, c.vita, 0.22), R(m, 0.28, 1.25, 0.23), R(m, 0.3, 1.5, 0.24), R(m, 0.12, 1.62, 0.1)], 'p_pietra', top='p_pietra')
        band(m, (0, 0, 0), 0.38, 0.3, 0.98, 1.06, 'p_giallo', n=8, both=False)
        anelli(m, [R(m, 0.36, 1.32, 0.3), R(m, 0.2, 1.6, 0.18)], 'p_pietra_chiara')                         # la mantellina
        with r.osso('aureola', (0, 1.72, 0.22)):
            _disco(m, (0, 1.72, 0.24), 0.44, 0.06, 'p_arancio', n=12)
            _disco(m, (0, 1.72, 0.2), 0.3, 0.02, 'p_pietra_scura', n=12)
            for k in range(8):
                a = k * math.pi / 4
                m.push(Xf(t=(math.cos(a) * 0.5, 1.72 + math.sin(a) * 0.5, 0.24), r=(0, 0, math.degrees(a))))
                m.box(-0.06, -0.05, -0.03, 0.06, 0.05, 0.03, 'p_arancio')
                m.pop()

    def testa(r, c, base):
        m = r.m
        m.loft([m.ring(8, 0.2, 1.6), m.ring(8, 0.22, 1.72), m.ring(8, 0.15, 1.88), m.ring(8, 0.0001, 1.95)], 'p_giallo', bottom='p_giallo')
        _quad(m, [(-0.12, 1.7, -0.218), (0.12, 1.7, -0.218), (0.12, 1.75, -0.218), (-0.12, 1.75, -0.218)], 'p_acqua_bassa', EM)

    def bastone(r, c, p):
        m = r.m
        m.prism(5, 0.035, 0.035, 0.05, 1.95, 'p_legno_scuro', top='p_legno_scuro', bottom='p_legno_scuro', cx=p[0], cz=p[2])
        m.prism(6, 0.12, 0.1, 1.94, 2.02, 'p_giallo', top='p_giallo', cx=p[0], cz=p[2])
        _gemma(m, (p[0], 2.1, p[2]), 0.11, 'p_acqua_bassa')
        for k in range(4):
            a = k * math.pi / 2
            tube(m, [(p[0] + math.cos(a) * 0.1, 2.0, p[2] + math.sin(a) * 0.1), (p[0] + math.cos(a) * 0.07, 2.22, p[2] + math.sin(a) * 0.07)], [0.012, 0.012], 3, 'p_giallo')

    bipede(r, c, gamba='p_pietra_scura', scarpa='p_nero_caldo', bacino=None, busto=None, braccio='p_pietra_chiara', avambraccio='p_pietra_chiara',
           mano='p_pietra_scura', testa=testa, mano_dx=bastone, sul_busto=busto, sul_bacino=bacino, n=6)
    for lato, sx in (('sx', -1), ('dx', 1)):  # le maniche larghe
        with r.osso('avambraccio_' + lato):
            anelli(r.m, [R(r.m, 0.06, c.gomito, 0.06, cx=sx * (c.sx + 0.02 * c.H)), R(r.m, 0.12, c.polso + 0.05, 0.12, cx=sx * (c.sx + 0.04 * c.H), cz=-0.04)], 'p_pietra_chiara')
    return r.build()


def nem_sentinella():
    """Sentinella dell'Egida: corazza pesante di marmo e ottone, elmo a celata che brilla d'azzurro, il braccio destro col pugno di ferro,
    e sul sinistro lo scudo torre a energia cinetica (cornice d'ottone, il pannello d'acqua che brilla)."""
    r = Rig('nem_sentinella')
    c = Corpo(2.3, k=1.3, gambe=0.85)
    c.r_coscia, c.r_stinco, c.r_braccio, c.r_avambraccio, c.mano = 0.15, 0.13, 0.13, 0.12, 0.0

    def busto(r, c):
        m = r.m
        m.cbox(0, 0.05, 1.05, 0.7, c.vita - 0.02, 1.86, 'p_pietra', top='p_pietra_scura')
        for y in (c.vita, 1.76):
            m.cbox(0, 0.05, 1.1, 0.75, y, y + 0.1, 'p_giallo', skip=('top', 'bottom'))
        m.cbox(0, -0.31, 0.5, 0.04, 1.3, 1.6, 'p_pietra_chiara')

    def testa(r, c, base):
        m = r.m
        m.cbox(0, 0.05, 0.44, 0.44, 1.86, 2.3, 'p_pietra_scura')
        m.cbox(0, 0.05, 0.48, 0.48, 2.3, 2.38, 'p_giallo')
        m.cbox(0, 0.05, 0.08, 0.5, 2.38, 2.5, 'p_giallo')
        _quad(m, [(-0.15, 2.06, -0.172), (0.15, 2.06, -0.172), (0.15, 2.11, -0.172), (-0.15, 2.11, -0.172)], 'p_acqua_bassa', EM)

    def pugno(r, c, p):
        m = r.m
        m.cbox(p[0], p[2], 0.34, 0.34, p[1] - 0.3, p[1] + 0.02, 'p_roccia', top='p_pietra_scura')

    def scudo(r, c, p):
        m = r.m
        g = _gomito_sx(c)
        with xf(m, r=(-ALZA, 0, 0), pivot=g):  # disegnato in guardia: avambraccio orizzontale, lo scudo dritto davanti
            z = g[2] - 0.62 * (c.gomito - c.polso) - 0.1
            x0, x1, y0, y1 = g[0] - 0.4, g[0] + 0.95, g[1] - 1.05, g[1] + 0.85
            m.box(x0, y0, z - 0.06, x1, y1, z + 0.06, 'p_acqua_profonda')
            for (a, b, cc, d) in ((x0 - 0.05, y1 - 0.05, x1 + 0.05, y1 + 0.05), (x0 - 0.05, y0 - 0.05, x1 + 0.05, y0 + 0.05), (x0 - 0.06, y0, x0 + 0.04, y1), (x1 - 0.04, y0, x1 + 0.06, y1)):
                m.box(a, b, z - 0.08, cc, d, z + 0.08, 'p_giallo')
            m.box(x0 + 0.17, y0 + 0.25, z - 0.075, x1 - 0.17, y1 - 0.25, z - 0.06, 'p_acqua_bassa', skip=('back',), mat=EM)
            m.box(g[0] - 0.06, g[1] - 0.06, z, g[0] + 0.06, g[1] + 0.06, g[2], 'p_pietra_scura')                    # la maniglia

    def spalliera(r, c, p, sx):
        r.m.prism(8, 0.24, 0.2, p[1] - 0.12, p[1] + 0.1, 'p_giallo', top='p_pietra', cx=p[0] + sx * 0.04)

    c.spalliera = spalliera
    bipede(r, c, gamba='p_pietra_scura', scarpa='p_roccia', bacino='p_pietra_scura', busto=None, braccio='p_pietra', mano='p_roccia',
           testa=testa, mano_dx=pugno, mano_sx=scudo, sul_busto=busto, n=6)
    return r.build()


def nem_guardia():
    """Guardia d'Onore: élite asimmetrica. Corazza bianca con la fascia rossa e il gonnellino a lamelle, l'elmo col pennacchio rosso; nella
    sinistra la spada d'acqua tagliente (brilla), la destra è un braccio-serbatoio d'ottone col manometro e il tubo che porta l'acqua alla
    spada."""
    r = Rig('nem_guardia')
    c = Corpo(2.2, k=1.0)

    def busto(r, c):
        m = r.m
        anelli(m, [R(m, 0.27, c.vita - 0.02, 0.19), R(m, 0.31, 1.3, 0.21), R(m, 0.33, 1.62, 0.21), R(m, 0.14, 1.78, 0.12)], 'p_pietra_chiara', top='p_pietra_chiara')
        band(m, (0, 0, 0), 0.32, 0.22, 1.14, 1.2, 'p_giallo', n=8, both=False)
        with xf(m, t=(0, 1.45, 0), r=(0, 0, 29)):
            m.box(-0.36, -0.06, -0.23, 0.36, 0.06, 0.23, 'p_rosso')
        tube(m, [(0.32, 1.5, 0.12), (0.0, 1.58, 0.24), (-0.3, 1.45, 0.15)], [0.04, 0.04, 0.04], 4, 'p_pietra_scura')  # il tubo dell'acqua

    def gonna(r, c, sx):
        m = r.m
        for k in range(2):
            x = sx * (0.07 + 0.12 * k)
            quad2(m, [(x - 0.07, c.anca + 0.05, -0.2), (x + 0.07, c.anca + 0.05, -0.2), (x + 0.06, c.anca - 0.3, -0.22), (x - 0.06, c.anca - 0.3, -0.22)], 'p_giallo', (0, 0, -1))

    def testa(r, c, base):
        m = r.m
        m.cbox(0, 0, 0.3, 0.32, 1.8, 2.12, 'p_pietra_scura')
        m.cbox(0, -0.15, 0.24, 0.04, 1.92, 1.96, 'p_acqua_bassa', mat=EM)
        m.cbox(0, 0.06, 0.08, 0.42, 2.1, 2.44, 'p_rosso', skip=('bottom',))
        tube(m, [(0, 2.3, 0.2), (0, 2.1, 0.42), (0, 1.8, 0.45)], [0.06, 0.05, 0.02], 4, 'p_rosso')

    def spada(r, c, p):
        m = r.m
        with xf(m, t=p, r=(-90, 0, 0)):
            m.cbox(0, 0, 0.18, 0.1, 0.0, 0.05, 'p_giallo')
            m.cbox(0, 0, 0.06, 0.06, -0.1, 0.0, 'p_legno_scuro')
            m.box(-0.035, 0.05, -0.012, 0.035, 1.25, 0.012, 'p_acqua_bassa', mat=EM)
            m.box(-0.06, 0.08, -0.004, 0.06, 1.2, 0.004, 'p_acqua', mat=EM)
            cone_dir(m, (0, 1.25, 0), (0, 1.38, 0), 0.04, 4, 'p_acqua_bassa', mat=EM)

    def serbatoio(r, c, p):
        m = r.m
        m.prism(8, 0.13, 0.1, p[1] - 0.25, p[1] + 0.05, 'p_pietra_scura', bottom='p_pietra_scura', cx=p[0], cz=p[2])

    bipede(r, c, gamba='p_pietra_chiara', scarpa='p_pietra_scura', bacino='p_pietra_scura', busto=None, braccio='p_pietra_chiara',
           avambraccio='p_pietra_chiara', mano='p_pietra_scura', testa=testa, mano_sx=spada, mano_dx=serbatoio, sul_busto=busto, n=6)
    c.gonna = gonna
    for lato in ('sx', 'dx'):
        with r.osso('coscia_' + lato):
            gonna(r, c, -1 if lato == 'sx' else 1)
    with r.osso('braccio_dx'):  # il braccio-serbatoio
        xs = c.sx
        r.m.prism(8, 0.2, 0.18, c.gomito - 0.05, c.spalla + 0.03, 'p_arancio', top='p_arancio', bottom='p_arancio', cx=xs + 0.03)
        r.m.box(xs - 0.06, 1.42, -0.2, xs + 0.06, 1.54, -0.17, 'p_giallo', skip=('back',))
        r.m.box(xs - 0.01, 1.47, -0.21, xs + 0.04, 1.49, -0.2, 'p_rosso', skip=('back',))
    return r.build()


def nem_custode_egida():
    """Il Custode dell'Egida (boss, ≈ 3,5 m): il guardiano della Regina. Gambe con le ginocchiere d'ottone, busto di marmo con la finestra
    dei tre cuori (acqua, vapore, moto: brillano), spallacci, elmo con la cresta e gli occhi che brillano, due pistoni sulla schiena;
    l'Egida (scudo rotondo d'ottone e acqua con l'onda) sul braccio sinistro, il tridente d'ottone nella destra."""
    r = Rig('nem_custode_egida')
    c = Corpo(3.5, k=1.25, gambe=0.85)
    c.r_coscia, c.r_stinco, c.r_braccio, c.r_avambraccio, c.mano = 0.24, 0.21, 0.19, 0.17, 0.8
    c.vita = 1.6

    def busto(r, c):
        m = r.m
        m.cbox(0, 0, 1.2, 0.8, 1.45, 1.75, 'p_pietra_scura')
        m.cbox(0, 0, 1.7, 1.0, 1.7, 2.8, 'p_pietra_chiara', top='p_pietra')
        for y in (1.7, 2.7):
            m.cbox(0, 0, 1.75, 1.05, y, y + 0.12, 'p_giallo', skip=('top', 'bottom'))
        m.box(-0.5, 2.0, -0.56, 0.5, 2.5, -0.48, 'p_nero_caldo', skip=('back',))
        for x, reg in ((-0.3, 'p_acqua'), (0, 'p_pietra_chiara'), (0.3, 'p_giallo')):
            _gemma(m, (x, 2.25, -0.56), 0.16, reg)
        for sx in (-1, 1):
            m.prism(6, 0.13, 0.13, 1.8, 2.95, 'p_pietra', top='p_giallo', cx=sx * 0.4, cz=0.6)

    def testa(r, c, base):
        m = r.m
        m.cbox(0, 0, 0.55, 0.55, 2.85, 3.45, 'p_pietra_scura')
        m.cbox(0, 0, 0.12, 0.62, 3.45, 3.8, 'p_giallo', skip=('bottom',))
        _quad(m, [(-0.2, 3.17, -0.278), (0.2, 3.17, -0.278), (0.2, 3.23, -0.278), (-0.2, 3.23, -0.278)], 'p_acqua_bassa', EM)

    def spalliera(r, c, p, sx):
        r.m.prism(8, 0.42, 0.36, p[1] - 0.2, p[1] + 0.22, 'p_arancio', top='p_arancio', cx=p[0] + sx * 0.06)

    def egida(r, c, p):
        m = r.m
        g = _gomito_sx(c)
        with xf(m, r=(-ALZA, 0, 0), pivot=g):
            z = g[2] - 0.6 * (c.gomito - c.polso) - 0.2
            cc = (g[0] - 0.1, g[1] - 0.15, z)
            _disco(m, cc, 0.95, 0.16, 'p_giallo', n=12)
            _disco(m, (cc[0], cc[1], z - 0.09), 0.78, 0.04, 'p_acqua_profonda', n=12)
            _disco(m, (cc[0], cc[1], z - 0.12), 0.45, 0.02, 'p_acqua_bassa', n=10, mat=EM)

    def tridente(r, c, p):
        m = r.m
        with xf(m, t=p, r=(-90, 0, 0)):
            m.prism(6, 0.06, 0.06, -1.2, 2.2, 'p_giallo', top='p_giallo', bottom='p_giallo')
            m.cbox(0, 0, 0.55, 0.08, 2.1, 2.2, 'p_giallo')
            for x in (-0.24, 0, 0.24):
                m.cbox(x, 0, 0.06, 0.06, 2.2, 2.7 if x == 0 else 2.55, 'p_pietra_chiara')
                cone_dir(m, (x, 2.7 if x == 0 else 2.55, 0), (x, 2.9 if x == 0 else 2.72, 0), 0.06, 4, 'p_pietra_chiara')

    c.spalliera = spalliera
    bipede(r, c, gamba='p_pietra', scarpa='p_roccia', bacino='p_pietra_scura', busto=None, braccio='p_pietra', mano='p_pietra_scura',
           testa=testa, mano_dx=tridente, mano_sx=egida, sul_busto=busto, n=6)
    for lato, sx in (('sx', -1), ('dx', 1)):
        with r.osso('stinco_' + lato):
            r.m.cbox(sx * c.hx, -0.3, 0.56, 0.2, c.ginocchio - 0.15, c.ginocchio + 0.15, 'p_giallo')
    return r.build()


MODELS = {f.__name__: f for f in (nem_chierico, nem_sentinella, nem_guardia, nem_custode_egida)}
MODELS_RPG = list(MODELS.values())
