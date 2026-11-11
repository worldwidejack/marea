# Nemici della Diga dei Disertori, snodati (issue 723; prima c'erano solo le forme in codice di rpg/diga.ts e le ricette statiche di
# models_diga.py mai costruite).   npm run assets nem_guardiano nem_fuciliere nem_albatros nem_vaelen
# La Guardia della Paratia ha il portello come mesh a parte (`portello`): il client la nasconde quando lo perde (dungeon_actors.ts).
import math
from lib import Mesh
from nemici_kit import Rig, Corpo, bipede, arto, anelli, R, tube, blob, cone_dir, quad2, slab, xf, face, EM
from models_rpg import band
from models_diga import _quad, _anello

ALZA = 80  # come nemici_mausoleo: lo scudo sull'avambraccio sinistro sta dritto in guardia


def nem_guardiano():
    """La Guardia della Paratia: colosso a torso nudo coi tatuaggi blu, calzoni scuri e stivaloni, lo scafandro di rame come elmo con
    l'oblò che brilla, l'ancora spezzata nella destra; il portello di quercia ferrata sul braccio sinistro (mesh `portello`)."""
    r = Rig('nem_guardiano')
    c = Corpo(2.4, k=1.35, gambe=0.88)
    c.r_braccio, c.r_avambraccio, c.mano = 0.17, 0.15, 1.0

    def busto(r, c):
        m = r.m
        anelli(m, [R(m, 0.32, c.vita - 0.02, 0.24), R(m, 0.4, 1.4, 0.28), R(m, 0.46, 1.72, 0.3), R(m, 0.3, 1.88, 0.24), R(m, 0.14, 1.95, 0.12)], 'p_legno_chiaro', top='p_legno_chiaro')
        _quad(m, [(-0.42, 1.5, -0.27), (-0.08, 1.66, -0.29), (-0.08, 1.72, -0.29), (-0.42, 1.56, -0.27)], 'p_acqua_profonda')     # i tatuaggi
        _quad(m, [(0.1, 1.3, -0.27), (0.3, 1.3, -0.26), (0.3, 1.36, -0.26), (0.1, 1.36, -0.27)], 'p_acqua_profonda')
        band(m, (0, 0, 0), 0.34, 0.26, c.vita - 0.02, c.vita + 0.08, 'p_ombra_calda', n=8, both=False)

    def testa(r, c, base):
        m = r.m
        m.prism(8, 0.42, 0.42, 1.86, 1.96, 'p_legno', top='p_legno', bottom='p_legno', cz=0.03)
        m.loft([m.ring(8, 0.4, 1.96, cz=0.03), m.ring(8, 0.4, 2.35, cz=0.03), m.ring(8, 0.3, 2.55, cz=0.03), m.ring(8, 0.0001, 2.6, cz=0.03)], 'p_arancio')
        with xf(m, t=(0, 2.2, -0.39), r=(90, 0, 0)):
            m.prism(8, 0.16, 0.16, -0.03, 0.03, 'p_legno', top='p_legno', bottom='p_legno')
            m.prism(8, 0.13, 0.13, -0.04, 0.04, 'p_acqua_bassa', top='p_acqua_bassa', bottom='p_acqua_bassa', mat=EM)
        for sx in (-1, 1):
            with xf(m, t=(sx * 0.4, 2.15, 0.03), r=(0, 0, 90)):
                m.prism(6, 0.09, 0.09, -0.03, 0.03, 'p_acqua_bassa', top='p_acqua_bassa', bottom='p_acqua_bassa')

    def ancora(r, c, p):
        m = r.m
        with xf(m, t=p, r=(-50, 0, 0)):  # il fuso avanti e giù, la marra rotta in fondo
            m.prism(5, 0.065, 0.065, -0.15, 1.5, 'p_roccia', top='p_roccia', bottom='p_roccia')
            _anello(m, (0, -0.2, 0), 0.1, 0.03, 'p_roccia', n=6, asse='z')
            m.cbox(0, 0, 0.9, 0.12, 1.45, 1.58, 'p_roccia')
            cone_dir(m, (0.45, 1.5, 0), (0.55, 1.2, 0), 0.08, 4, 'p_pietra_scura')
            cone_dir(m, (-0.45, 1.5, 0), (-0.47, 1.38, 0), 0.08, 4, 'p_pietra_scura')

    bipede(r, c, gamba='p_legno_scuro', scarpa='p_nero_caldo', bacino='p_legno_scuro', busto=None, braccio='p_legno_chiaro', mano='p_legno_chiaro',
           testa=testa, mano_dx=ancora, sul_busto=busto, n=6)
    for lato, sx in (('sx', -1), ('dx', 1)):
        with r.osso('stinco_' + lato):
            anelli(r.m, [R(r.m, 0.11, 0.0, 0.14, cx=sx * c.hx), R(r.m, 0.12, 0.45, 0.13, cx=sx * c.hx), R(r.m, 0.13, 0.5, 0.14, cx=sx * c.hx)], 'p_nero_caldo', top='p_nero_caldo')
    with r.osso('avambraccio_sx'):
        r.m.box(-c.sx - 0.18, c.gomito - 0.1, -0.1, -c.sx + 0.14, c.gomito + 0.02, 0.1, 'p_acqua_profonda')  # il bracciale
    p = Mesh('portello')
    p.bone = 'avambraccio_sx'
    g = (-c.sx - 0.012 * c.H, c.gomito, 0.005 * c.H)
    with xf(p, r=(-ALZA, 0, 0), pivot=g):
        z = g[2] - 0.55 * (c.gomito - c.polso) - 0.1
        x0, x1, y0, y1 = g[0] - 0.45, g[0] + 0.85, g[1] - 1.0, g[1] + 0.8
        p.box(x0, y0, z - 0.08, x1, y1, z + 0.08, 'p_legno_scuro')
        for y in (y0 + 0.4, y1 - 0.45):
            p.box(x0 - 0.03, y, z - 0.1, x1 + 0.03, y + 0.12, z + 0.1, 'p_roccia', skip=('bottom', 'top'))
        p.box((x0 + x1) / 2 - 0.15, y1 + 0.02, z - 0.05, (x0 + x1) / 2 + 0.15, y1 + 0.38, z + 0.01, 'p_giallo')
        _quad(p, [((x0 + x1) / 2 - 0.02, y1 + 0.07, z - 0.06), ((x0 + x1) / 2 + 0.02, y1 + 0.07, z - 0.06), ((x0 + x1) / 2 + 0.04, y1 + 0.33, z - 0.06), ((x0 + x1) / 2, y1 + 0.33, z - 0.06)], 'p_nero_caldo')
        p.box(g[0] - 0.07, g[1] - 0.07, z, g[0] + 0.07, g[1] + 0.07, g[2], 'p_roccia')
    return r.build(p)


def nem_fuciliere():
    """Il Fuciliere d'Acquafonda: smilzo, cerata gialla lunga con le macchie di catrame, bandana rossa, tricorno di cuoio calato sugli occhi
    (la faccia in ombra), il moschetto lungo con la baionetta arrugginita (lungo l'avambraccio destro: punta giù a riposo, avanti in mira)."""
    r = Rig('nem_fuciliere')
    c = Corpo(1.8, k=0.95)

    def bacino(r, c):  # la cerata lunga fino alle ginocchia
        m = r.m
        anelli(m, [R(m, 0.27, 0.5, 0.22), R(m, 0.22, c.vita + 0.05, 0.17)], 'p_giallo', bottom='p_nero_caldo')
        band(m, (0, 0, 0), 0.25, 0.2, 0.68, 0.72, 'p_nero_caldo', n=8, both=False)

    def busto(r, c):
        m = r.m
        anelli(m, [R(m, 0.21, c.vita, 0.16), R(m, 0.24, 1.2, 0.17), R(m, 0.25, 1.42, 0.17), R(m, 0.1, 1.52, 0.09)], 'p_giallo', top='p_giallo')
        for x, y in ((-0.12, 1.1), (0.1, 1.3), (0.15, 1.05)):
            m.box(x - 0.05, y - 0.04, -0.178, x + 0.05, y + 0.04, -0.17, 'p_nero_caldo', skip=('back',))
        with xf(m, t=(0, 1.25, 0), r=(0, 0, 35)):  # la bandoliera
            m.box(-0.29, -0.03, -0.19, 0.29, 0.03, 0.19, 'p_legno_scuro', skip=('top', 'bottom'))

    def testa(r, c, base):
        m = r.m
        m.cbox(0, 0, 0.24, 0.24, 1.5, 1.74, 'p_nero_caldo')
        m.cbox(0, 0.02, 0.27, 0.27, 1.66, 1.74, 'p_rosso')
        face(m, [(-0.08, 1.6, -0.121), (-0.03, 1.6, -0.121), (-0.03, 1.62, -0.121), (-0.08, 1.62, -0.121)], 'p_giallo', (0, 0, -1), mat=EM)
        face(m, [(0.03, 1.6, -0.121), (0.08, 1.6, -0.121), (0.08, 1.62, -0.121), (0.03, 1.62, -0.121)], 'p_giallo', (0, 0, -1), mat=EM)
        m.prism(3, 0.3, 0.3, 1.73, 1.8, 'p_legno_scuro', top='p_legno_scuro', bottom='p_legno_scuro', a0=-math.pi / 2)
        m.prism(6, 0.17, 0.14, 1.78, 1.92, 'p_legno_scuro', top='p_legno_scuro')

    def moschetto(r, c, p):
        m = r.m
        x, y, z = p
        m.cbox(x, z, 0.06, 0.12, y - 0.05, y + 0.25, 'p_legno_scuro')                                          # il calcio sopra la mano
        m.prism(5, 0.03, 0.03, y - 1.2, y - 0.05, 'p_roccia', top='p_roccia', bottom='p_roccia', cx=x, cz=z - 0.02)  # la canna giù
        m.cbox(x, z + 0.01, 0.05, 0.07, y - 0.7, y - 0.05, 'p_legno')
        m.cbox(x, z - 0.02, 0.025, 0.012, y - 1.6, y - 1.2, 'p_legno')                                        # la baionetta arrugginita

    bipede(r, c, gamba='p_ombra_calda', scarpa='p_nero_caldo', bacino=None, busto=None, braccio='p_giallo', mano='p_legno_chiaro',
           testa=testa, mano_dx=moschetto, sul_busto=busto, sul_bacino=bacino, n=6)
    return r.build()


def nem_albatros():
    """L'Albatros di Pece: grosso uccello marino scheletrico impeciato; ali larghe a due pezzi con le ossa bianche che sbattono, il becco
    d'osso, gli occhi arancio che brillano, la coda a ventaglio e il barilotto rosso di polvere da sparo tra gli artigli."""
    r = Rig('nem_albatros')
    m = r.m
    with r.osso('corpo', (0, 0.55, 0)):
        tube(m, [(0, 0.55, 0.45), (0, 0.6, 0.1), (0, 0.6, -0.25), (0, 0.62, -0.42)], [(0.12, 0.1), (0.22, 0.18), (0.22, 0.2), (0.14, 0.13)], 6, 'p_roccia', cap0='p_roccia')
        quad2(m, [(-0.1, 0.78, -0.2), (0.1, 0.78, -0.2), (0.08, 0.76, 0.3), (-0.08, 0.76, 0.3)], 'p_nero_caldo', (0, 1, 0))
        with r.osso('testa', (0, 0.65, -0.45)):
            blob(m, (0, 0.7, -0.6), 0.13, 0.13, 0.16, 'p_roccia', n=6, k=3)
            cone_dir(m, (0, 0.67, -0.72), (0, 0.6, -1.08), 0.07, 4, 'p_pietra_chiara')
            cone_dir(m, (0, 0.6, -1.05), (0, 0.55, -1.1), 0.03, 3, 'p_pietra_chiara')
            for sx in (-1, 1):
                face(m, [(sx * 0.125, 0.71, -0.66), (sx * 0.125, 0.71, -0.6), (sx * 0.125, 0.76, -0.6), (sx * 0.125, 0.76, -0.66)], 'p_arancio', (sx, 0, 0), mat=EM)
        with r.osso('coda', (0, 0.56, 0.45)):
            for k in (-1, 0, 1):
                quad2(m, [(k * 0.05, 0.56, 0.45), (k * 0.05 + 0.04, 0.56, 0.45), (k * 0.2 + 0.06, 0.53, 0.8), (k * 0.2 - 0.06, 0.53, 0.8)], 'p_roccia', (0, 1, 0))
        for lato, sx in (('sx', -1), ('dx', 1)):
            with r.osso('ala_' + lato, (sx * 0.18, 0.65, -0.05)):
                m.box(min(sx * 0.18, sx * 0.95), 0.63, -0.3, max(sx * 0.18, sx * 0.95), 0.67, 0.2, 'p_roccia', top='p_nero_caldo')
                for x in (0.3, 0.6, 0.85):
                    m.box(sx * x - 0.03, 0.66, -0.28, sx * x + 0.03, 0.69, 0.15, 'p_pietra_chiara', skip=())
                with r.osso('ala2_' + lato, (sx * 0.95, 0.65, -0.05)):
                    face(m, [(sx * 0.95, 0.65, -0.3), (sx * 1.75, 0.62, -0.12), (sx * 1.7, 0.62, 0.05), (sx * 0.95, 0.65, 0.2)], 'p_roccia', (0, 1, 0))
                    face(m, [(sx * 0.95, 0.65, -0.3), (sx * 1.75, 0.62, -0.12), (sx * 1.7, 0.62, 0.05), (sx * 0.95, 0.65, 0.2)], 'p_nero_caldo', (0, -1, 0))
                    m.box(min(sx * 0.95, sx * 1.7) , 0.645, -0.24, max(sx * 0.95, sx * 1.7), 0.665, -0.2, 'p_pietra_chiara', skip=())
        with r.osso('zampe', (0, 0.45, 0.05)):
            for sx in (-1, 1):
                tube(m, [(sx * 0.1, 0.46, 0.05), (sx * 0.1, 0.25, 0.02)], [0.025, 0.02], 4, 'p_pietra_chiara')
                for k in (-1, 0, 1):
                    cone_dir(m, (sx * 0.1, 0.25, 0.02), (sx * 0.1 + k * 0.04, 0.22, -0.08), 0.015, 3, 'p_pietra_chiara')
            with xf(m, t=(0, 0.17, 0.0), r=(0, 0, 90)):
                m.prism(8, 0.13, 0.13, -0.17, 0.17, 'p_rosso', top='p_legno_scuro', bottom='p_legno_scuro')
                band(m, (0, 0, 0), 0.135, 0.135, -0.1, -0.07, 'p_nero_caldo', n=8, both=False)
                band(m, (0, 0, 0), 0.135, 0.135, 0.07, 0.1, 'p_nero_caldo', n=8, both=False)
    return r.build()


def nem_vaelen():
    """Il Capitano Vaelen, l'Ancora dei Giusti (boss, ≈ 3 m): cappotto da ammiraglio blu scuro lacero, incrostato di sale e cirripedi, le
    spalline d'oro, il tricorno spezzato, gli occhi azzurri da spettro; il braccio sinistro avvolto nelle catene dell'ancora, nella destra
    il tronco spezzato dell'albero maestro come lancia con la ghiera, la punta d'acciaio e il brandello di vela che brilla."""
    r = Rig('nem_vaelen')
    c = Corpo(3.0, k=1.15)
    c.r_braccio, c.r_avambraccio = 0.13, 0.12

    def bacino(r, c):  # le falde del cappotto
        m = r.m
        anelli(m, [R(m, 0.5, 0.6, 0.38), R(m, 0.4, c.vita + 0.05, 0.3)], 'p_abisso', bottom='p_nero_caldo')

    def busto(r, c):
        m = r.m
        anelli(m, [R(m, 0.4, c.vita, 0.3), R(m, 0.46, 2.0, 0.32), R(m, 0.48, 2.42, 0.32), R(m, 0.22, 2.55, 0.18)], 'p_abisso', top='p_abisso')
        m.cbox(0, -0.31, 0.5, 0.06, 1.7, 2.5, 'p_acqua_profonda')
        for x in (-0.12, 0.12):
            for y in (1.9, 2.1, 2.3):
                blob(m, (x, y, -0.33), 0.025, 0.025, 0.015, 'p_giallo', n=4, k=2)
        for x, y, z in ((-0.3, 2.2, -0.3), (0.35, 1.9, -0.31), (0.15, 2.35, -0.3), (-0.4, 1.75, -0.28)):
            m.cbox(x, z, 0.12, 0.06, y - 0.06, y + 0.06, 'p_pietra_chiara')

    def spalliera(r, c, p, sx):
        m = r.m
        m.cbox(p[0], 0.0, 0.42, 0.5, p[1] - 0.02, p[1] + 0.1, 'p_giallo')
        for k in range(3):
            m.cbox(p[0] + (k - 1) * 0.12, 0.0, 0.03, 0.4, p[1] - 0.2, p[1] - 0.02, 'p_giallo')

    def testa(r, c, base):
        m = r.m
        m.cbox(0, 0.05, 0.42, 0.42, 2.55, 3.0, 'p_pietra')
        _quad(m, [(-0.15, 2.8, -0.165), (0.15, 2.8, -0.165), (0.15, 2.85, -0.165), (-0.15, 2.85, -0.165)], 'p_acqua_bassa', EM)
        m.cbox(0, -0.05, 0.3, 0.1, 2.55, 2.68, 'p_pietra_chiara')                                                  # la barba di sale
        m.prism(3, 0.55, 0.55, 3.0, 3.12, 'p_nero_caldo', top='p_nero_caldo', bottom='p_nero_caldo', cz=0.05, a0=-math.pi / 2)
        with xf(m, t=(0.06, 3.2, 0.05), r=(0, 0, 20)):
            m.prism(6, 0.28, 0.22, -0.08, 0.1, 'p_nero_caldo', top='p_nero_caldo')

    def catene(r, c, p):
        m = r.m
        for k in range(4):
            _anello(m, (p[0], p[1] + 0.15 + 0.2 * k, 0.0), 0.2, 0.04, 'p_roccia', n=8)
        tube(m, [(p[0], p[1], 0.05), (p[0] + 0.05, p[1] - 0.5, 0.15), (p[0], p[1] - 0.9, 0.1)], [0.03, 0.03, 0.03], 3, 'p_roccia')

    def lancia(r, c, p):
        m = r.m
        with xf(m, t=p, r=(-90, 0, 0)):
            m.prism(6, 0.15, 0.12, -1.6, 2.6, 'p_legno', top='p_legno_chiaro', bottom='p_legno_chiaro')
            m.prism(6, 0.18, 0.18, 2.5, 2.62, 'p_roccia', top='p_roccia', bottom='p_roccia')
            m.cone(4, 0.15, 2.62, 3.25, 'p_pietra', bottom='p_pietra')
            with xf(m, t=(0, 2.25, 0.05), r=(0, 0, 0)):
                face(m, [(0.04, -0.3, 0.0), (0.6, -0.25, 0.02), (0.55, 0.2, 0.0), (0.04, 0.25, 0.0)], 'p_sabbia_chiara', (0, 0, 1), mat=EM)
                face(m, [(0.04, -0.3, 0.0), (0.6, -0.25, 0.02), (0.55, 0.2, 0.0), (0.04, 0.25, 0.0)], 'p_sabbia_chiara', (0, 0, -1), mat=EM)

    c.spalliera = spalliera
    bipede(r, c, gamba='p_ombra_calda', scarpa='p_nero_caldo', bacino=None, busto=None, braccio='p_abisso', mano='p_pietra',
           testa=testa, mano_dx=lancia, mano_sx=catene, sul_busto=busto, sul_bacino=bacino, n=6)
    return r.build()


MODELS = {f.__name__: f for f in (nem_guardiano, nem_fuciliere, nem_albatros, nem_vaelen)}
MODELS_RPG = list(MODELS.values())
