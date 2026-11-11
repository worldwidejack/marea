# Nemici dell'Archivio dell'Astrolabio, snodati (issue 723; prima statici in models_archivio.py). Kit e nomi delle ossa: nemici_kit.py.
#   npm run assets nem_archivista nem_idroragno nem_aerostato nem_astrolabio nem_anello
# Gli anelli che girano attorno all'Astrolabio restano del client (rpg/archivio.ts, giriAstrolabio).
import math
from lib import Xf
from nemici_kit import Rig, Corpo, bipede, arto, anelli, R, tube, blob, cone_dir, quad2, slab, xf, face, EM
from models_rpg import band
from models_archivio import _disco, _anello


def _lama(r, c, p):
    m = r.m
    with xf(m, t=p, r=(-90, 0, 0)):  # il braccio finisce in una lama da tagliacarte
        m.prism(6, 0.05, 0.05, -0.03, 0.05, 'p_arancio', top='p_arancio', bottom='p_arancio')
        slab(m, [(-0.025, 0.04), (0.03, 0.04), (0.035, 0.45), (0.0, 0.62), (-0.025, 0.5)], -0.008, 0.008, 'p_pietra_chiara')


def nem_archivista():
    """Archivista a Molla: bipede alto e magro a orologeria, torso a cilindro d'ottone con le fasce scure e il quadrante, la chiave della
    carica sulla schiena (gira; quando ricarica la molla gira forte), testa a scatola col monocolo azzurro e la bombetta, braccia a lama."""
    r = Rig('nem_archivista')
    c = Corpo(1.85, k=0.85, gambe=1.02)
    c.r_coscia, c.r_stinco, c.r_braccio, c.r_avambraccio, c.mano = 0.035, 0.03, 0.03, 0.026, 0.0

    def busto(r, c):
        m = r.m
        m.prism(8, 0.17, 0.21, c.vita - 0.02, 1.42, 'p_arancio', top='p_arancio', bottom='p_arancio')
        for y in (0.98, 1.3):
            m.prism(8, 0.22, 0.22, y, y + 0.06, 'p_legno_scuro', top='p_legno_scuro', bottom='p_legno_scuro')
        _disco(m, (0, 1.15, -0.2), 0.11, 0.03, 'p_sabbia_chiara', n=10)                               # il quadrante
        m.box(-0.008, 1.15, -0.22, 0.008, 1.23, -0.213, 'p_nero_caldo', skip=())
        with r.osso('chiave', (0, 1.18, 0.22)):
            m.cbox(0, 0.3, 0.05, 0.18, 1.15, 1.21, 'p_giallo')
            with xf(m, t=(0, 1.18, 0.4), r=(0, 0, 0)):
                m.box(-0.17, -0.06, -0.02, 0.17, 0.06, 0.02, 'p_giallo', skip=())
                for sx in (-1, 1):
                    blob(m, (sx * 0.17, 0, 0), 0.06, 0.07, 0.03, 'p_giallo', n=6, k=2)

    def testa(r, c, base):
        m = r.m
        m.prism(6, 0.04, 0.04, 1.42, 1.5, 'p_pietra_scura')
        m.cbox(0, 0, 0.28, 0.26, 1.48, 1.72, 'p_legno_scuro', top='p_ombra_calda')
        _disco(m, (0.07, 1.62, -0.14), 0.07, 0.03, 'p_acqua_bassa', n=8)                                 # il monocolo
        face(m, [(0.04, 1.6, -0.156), (0.1, 1.6, -0.156), (0.1, 1.64, -0.156), (0.04, 1.64, -0.156)], 'p_acqua_bassa', (0, 0, -1), mat=EM)
        face(m, [(-0.1, 1.61, -0.131), (-0.04, 1.61, -0.131), (-0.04, 1.63, -0.131), (-0.1, 1.63, -0.131)], 'p_giallo', (0, 0, -1), mat=EM)
        tube(m, [(0.14, 1.62, -0.14), (0.16, 1.5, -0.12)], [0.006, 0.006], 3, 'p_giallo')               # la catenella
        m.prism(8, 0.22, 0.22, 1.72, 1.75, 'p_ombra_calda', top='p_ombra_calda', bottom='p_ombra_calda')  # la bombetta
        m.loft([m.ring(8, 0.13, 1.75), m.ring(8, 0.14, 1.86), m.ring(8, 0.1, 1.9)], 'p_ombra_calda', top='p_ombra_calda')

    def spalliera(r, c, p, sx):
        blob(r.m, p, 0.06, 0.06, 0.06, 'p_arancio', n=6, k=2)

    c.spalliera = spalliera
    bipede(r, c, gamba='p_pietra_scura', scarpa='p_nero_caldo', bacino='p_legno_scuro', busto=None, braccio='p_pietra_scura', mano='p_pietra_scura',
           testa=testa, mano_dx=_lama, mano_sx=_lama, sul_busto=busto, n=5)
    for lato, sx in (('sx', -1), ('dx', 1)):  # ginocchia e gomiti a ingranaggio
        with r.osso('stinco_' + lato):
            _disco(r.m, (sx * (c.hx + 0.035), c.ginocchio, 0), 0.05, 0.02, 'p_arancio', n=8)
    return r.build()


def nem_idroragno():
    """Drone Idro-Ragno: cupola d'ottone rivettata sul guscio scuro, otto zampe sottili a due segmenti, il lanciarpioni sulla schiena (si
    ritira e rincula), quattro occhi rossi."""
    r = Rig('nem_idroragno')
    m = r.m
    with r.osso('corpo', (0, 0.5, 0)):
        m.prism(8, 0.38, 0.32, 0.31, 0.53, 'p_legno_scuro', bottom='p_legno_scuro')
        m.loft([m.ring(8, 0.32, 0.53), m.ring(8, 0.24, 0.66), m.ring(8, 0.0001, 0.74)], 'p_arancio')
        band(m, (0, 0, 0), 0.385, 0.385, 0.42, 0.46, 'p_arancio', n=8, both=False)
        for x in (-0.06, 0.06, -0.15, 0.15):
            face(m, [(x - 0.025, 0.43, -0.37 + abs(x) * 0.15), (x + 0.025, 0.43, -0.37 + abs(x) * 0.15), (x + 0.025, 0.47, -0.37 + abs(x) * 0.15), (x - 0.025, 0.47, -0.37 + abs(x) * 0.15)], 'em_neon_rosso', (0, 0, -1), mat=EM)
        with r.osso('cannone', (0, 0.78, 0.05)):
            m.cbox(0, 0.05, 0.12, 0.18, 0.7, 0.78, 'p_pietra_scura')
            with xf(m, t=(0, 0.82, -0.15), r=(90, 0, 0)):
                m.prism(6, 0.07, 0.06, -0.35, 0.35, 'p_roccia', top='p_roccia', bottom='p_roccia')
            with xf(m, t=(0, 0.82, -0.5), r=(-90, 0, 0)):
                m.cone(6, 0.07, 0, 0.18, 'p_pietra_chiara', bottom='p_pietra_chiara')
                for k in range(3):
                    a = 2 * math.pi * k / 3
                    cone_dir(m, (math.cos(a) * 0.05, 0.03, math.sin(a) * 0.05), (math.cos(a) * 0.12, -0.06, math.sin(a) * 0.12), 0.015, 3, 'p_pietra_chiara')
        for k, z in enumerate((-0.25, -0.08, 0.08, 0.25)):
            for sx in (-1, 1):
                i = k + 1 if sx < 0 else k + 5
                hip = (sx * 0.34, 0.45, z)
                knee = (sx * 0.62, 0.72, z * 1.3)
                foot = (sx * 0.78, 0.0, z * 1.5)
                with r.osso('zampa_%d' % i, hip):
                    tube(m, [hip, knee], [0.035, 0.03], 4, 'p_pietra_scura')
                    blob(m, knee, 0.04, 0.04, 0.04, 'p_arancio', n=4, k=2)
                    with r.osso('punta_%d' % i, knee):
                        tube(m, [knee, foot], [0.028, 0.012], 4, 'p_pietra_scura')
    return r.build()


def nem_aerostato():
    """Aerostato-Spia: pallone rattoppato a spicchi con le fasce d'ottone, le funi, la gondola di legno con l'occhio-lente azzurro che
    guarda giù, l'elica dietro che gira, due bombe appese sotto."""
    r = Rig('nem_aerostato')
    m = r.m
    with r.osso('corpo', (0, 0.8, 0)):
        m.cbox(0, 0, 0.55, 0.6, 0.11, 0.39, 'p_legno', top='p_legno_scuro')
        m.cbox(0, 0, 0.6, 0.65, 0.36, 0.42, 'p_legno_scuro')
        _disco(m, (0, 0.24, -0.31), 0.11, 0.06, 'p_arancio', n=8)
        face(m, [(math.cos(2 * math.pi * i / 8) * 0.08, 0.24 + math.sin(2 * math.pi * i / 8) * 0.08, -0.345) for i in range(8)], 'p_acqua_bassa', (0, 0, -1), mat=EM)
        for sx in (-1, 1):
            m.prism(6, 0.1, 0.1, -0.08, 0.1, 'p_nero_caldo', top='p_nero_caldo', bottom='p_nero_caldo', cx=sx * 0.15)
            m.prism(4, 0.02, 0.02, 0.1, 0.13, 'p_rosso', top='p_rosso', cx=sx * 0.15)
        m.cbox(0, 0.36, 0.06, 0.1, 0.22, 0.3, 'p_pietra_scura')
        with r.osso('elica', (0, 0.26, 0.43)):
            for k in range(3):
                a = 2 * math.pi * k / 3
                with xf(m, t=(0, 0.26, 0.43), r=(0, 0, math.degrees(a))):
                    m.box(-0.03, 0, -0.01, 0.03, 0.22, 0.01, 'p_pietra', skip=())
        for x, z in ((-0.25, -0.25), (0.25, -0.25), (-0.25, 0.25), (0.25, 0.25)):
            tube(m, [(x, 0.4, z), (x * 1.5, 0.85, z * 1.5)], [0.012, 0.012], 3, 'p_ombra_calda')
        with r.osso('pallone', (0, 0.85, 0)):
            rings = [m.ring(8, 0.3, 0.8), m.ring(8, 0.6, 1.25), m.ring(8, 0.64, 1.75), m.ring(8, 0.32, 2.22), m.ring(8, 0.0001, 2.33)]
            m.loft(rings, 'p_sabbia', bottom='p_sabbia')
            for y in (1.24, 1.74):
                band(m, (0, 0, 0), 0.645 if y > 1.5 else 0.605, 0.645 if y > 1.5 else 0.605, y, y + 0.06, 'p_arancio', n=8, both=False)
            m.box(0.16, 1.45, -0.645, 0.36, 1.66, -0.6, 'p_legno_chiaro', skip=('back',))
            m.box(-0.4, 1.9, 0.5, -0.2, 2.05, 0.56, 'p_rosso', skip=('front',))
            for sx in (-1, 1):  # gli impennaggi
                quad2(m, [(sx * 0.0, 1.5, 0.6), (sx * 0.0, 1.9, 0.6), (sx * 0.0, 1.85, 0.85), (sx * 0.0, 1.55, 0.85)], 'p_rosso', (1, 0, 0))
    return r.build()


def nem_astrolabio():
    """L'Astrolabio Impazzito, il nucleo (boss): sfera d'ottone sfaccettata a 1,1 m da terra, il guscio interno che gira, la lente azzurra
    che cerca l'eroe, la punta in cima e la lancetta che pende come un pendolo. I tre anelli li mette il client."""
    r = Rig('nem_astrolabio')
    m = r.m
    with r.osso('corpo', (0, 1.1, 0)):
        m.loft([m.ring(8, 0.0001, 0.55), m.ring(8, 0.4, 0.7), m.ring(8, 0.55, 1.1), m.ring(8, 0.4, 1.5), m.ring(8, 0.0001, 1.65)], 'p_legno_scuro')
        band(m, (0, 0, 0), 0.56, 0.56, 1.06, 1.14, 'p_arancio', n=8, both=False)
        m.cbox(0, 0, 0.05, 0.05, 1.6, 1.85, 'p_giallo')
        m.cone(4, 0.1, 1.85, 2.05, 'p_giallo', bottom='p_giallo')
        with r.osso('testa', (0, 1.1, 0)):
            _disco(m, (0, 1.1, -0.56), 0.22, 0.08, 'p_arancio', n=10)
            face(m, [(math.cos(2 * math.pi * i / 10) * 0.17, 1.1 + math.sin(2 * math.pi * i / 10) * 0.17, -0.605) for i in range(10)], 'p_acqua_bassa', (0, 0, -1), mat=EM)
            _disco(m, (0, 1.1, -0.62), 0.07, 0.03, 'p_nero_caldo', n=6)
        with r.osso('ruota', (0, 1.1, 0)):
            m.loft([m.ring(6, 0.0001, 0.62, a0=0.3), m.ring(6, 0.5, 1.1, a0=0.3), m.ring(6, 0.0001, 1.58, a0=0.3)], 'p_arancio')
        with r.osso('lancetta', (0.0, 0.62, 0)):
            m.box(-0.02, 0.2, -0.02, 0.02, 0.62, 0.02, 'p_giallo', skip=())
            blob(m, (0, 0.18, 0), 0.06, 0.06, 0.03, 'p_giallo', n=6, k=2)
    return r.build()


def nem_anello():
    """Anello dell'Astrolabio: anello d'ottone in piedi, quattro tacche gialle e il segno azzurro al centro; rotola girando su sé stesso."""
    r = Rig('nem_anello')
    m = r.m
    with r.osso('anello', (0, 0.5, 0)):
        m.push(Xf(t=(0, 0.5, 0), r=(90, 0, 0)))
        _anello(m, 0.42, 0.06, 'p_arancio', n=14)
        for k in range(4):
            a = k * math.pi / 2
            m.box(math.cos(a) * 0.42 - 0.05, -0.05, math.sin(a) * 0.42 - 0.09, math.cos(a) * 0.42 + 0.05, 0.05, math.sin(a) * 0.42 + 0.09, 'p_giallo')
        m.pop()
        for k in range(4):
            a = k * math.pi / 2 + math.pi / 4
            tube(m, [(0, 0.5, 0), (math.cos(a) * 0.38, 0.5 + math.sin(a) * 0.38, 0)], [0.015, 0.015], 3, 'p_arancio')
        _disco(m, (0, 0.5, 0), 0.07, 0.05, 'p_acqua_bassa', n=6)
    return r.build()


MODELS = {f.__name__: f for f in (nem_archivista, nem_idroragno, nem_aerostato, nem_astrolabio, nem_anello)}
MODELS_RPG = list(MODELS.values())
