# Nemici del Tempio della «Doppia Nera» (Isola Adrenalina), snodati (issue 723; prima solo forme in codice in rpg/baita.ts).
#   npm run assets nem_acrobata nem_alchimista nem_sparaneve nem_jean_claude
import math
from nemici_kit import Rig, Corpo, bipede, arto, anelli, R, tube, blob, cone_dir, quad2, slab, xf, face, EM
from models_rpg import band
from models_baita import _quad

PELLE = 'p_legno_chiaro'


def nem_acrobata():
    """Acrobata del Fuoripista: snowboarder con la giacca a vento arancio larghissima, i pantaloni viola, il berretto di lana giallo, le
    cuffie enormi e gli occhialini azzurri; la tavola resta agganciata agli scarponi (osso `tavola`, sotto i piedi)."""
    r = Rig('nem_acrobata')
    c = Corpo(1.8, k=1.15, gambe=0.95)
    c.r_coscia, c.r_stinco, c.r_braccio, c.r_avambraccio = 0.1, 0.09, 0.08, 0.07

    def busto(r, c):
        m = r.m
        anelli(m, [R(m, 0.3, c.vita - 0.06, 0.24), R(m, 0.34, 1.2, 0.26), R(m, 0.35, 1.42, 0.26), R(m, 0.14, 1.52, 0.12)], 'p_arancio', top='p_arancio')
        m.box(-0.02, c.vita, -0.27, 0.02, 1.45, -0.25, 'p_nero_caldo', skip=('back',))                          # la zip
        anelli(m, [R(m, 0.18, 1.42, 0.16), R(m, 0.15, 1.52, 0.14)], 'p_giallo')                                   # lo scaldacollo

    def testa(r, c, base):
        m = r.m
        m.cbox(0, 0, 0.26, 0.26, 1.5, 1.76, PELLE)
        m.cbox(0, -0.135, 0.24, 0.02, 1.6, 1.66, 'p_acqua_bassa', mat=EM)
        m.loft([m.ring(6, 0.17, 1.72), m.ring(6, 0.16, 1.9), m.ring(6, 0.06, 1.98)], 'p_giallo', bottom='p_giallo')
        blob(m, (0, 2.02, 0.02), 0.06, 0.05, 0.06, 'p_rosso', n=5, k=2)
        m.cbox(0, 0, 0.36, 0.06, 1.8, 1.84, 'p_nero_caldo')
        for sx in (-1, 1):
            m.cbox(sx * 0.17, 0, 0.1, 0.16, 1.55, 1.72, 'p_nero_caldo')

    bipede(r, c, gamba='p_viola', scarpa='p_nero_caldo', bacino='p_viola', busto=None, braccio='p_arancio', mano='p_nero_caldo',
           testa=testa, sul_busto=busto, n=6)
    with r.osso('tavola', (0, 0.05, 0)):  # la tavola sotto gli scarponi, di traverso
        m = r.m
        m.cbox(0, 0, 1.75, 0.34, 0.0, 0.05, 'p_acqua', top='p_acqua_bassa')
        m.cbox(0, 0, 1.79, 0.36, -0.01, 0.01, 'p_pietra_chiara')
        for sx in (-1, 1):
            m.cbox(sx * 0.95, 0, 0.18, 0.3, 0.02, 0.1, 'p_acqua')
        m.cbox(0.4, 0, 0.3, 0.2, 0.051, 0.055, 'p_giallo')
    return r.build()


def nem_alchimista():
    """Alchimista del Bombardino: barista montanaro col maglione chiaro e il grembiule sporco di zabaione, il passamontagna, due caraffe
    fumanti nelle mani e il fusto giallo di Bombardino sulle spalle col rubinetto (il punto debole, dietro)."""
    r = Rig('nem_alchimista')
    c = Corpo(1.8, k=1.15)

    def busto(r, c):
        m = r.m
        anelli(m, [R(m, 0.28, c.vita - 0.04, 0.22), R(m, 0.31, 1.2, 0.24), R(m, 0.3, 1.42, 0.23), R(m, 0.13, 1.52, 0.11)], 'p_legno_chiaro', top='p_legno_chiaro')
        for y in (1.08, 1.3):
            band(m, (0, 0, 0), 0.315, 0.245, y, y + 0.04, 'p_rosso', n=8, both=False)
        m.box(-0.26, 0.6, -0.27, 0.26, 1.35, -0.24, 'p_sabbia_chiara', skip=('back',))                           # il grembiule
        m.box(-0.1, 0.8, -0.275, 0.05, 0.9, -0.27, 'p_giallo', skip=('back',))
        with xf(m, t=(0, 1.25, 0.42), r=(0, 0, 90)):                                                              # il fusto
            m.prism(8, 0.22, 0.22, -0.33, 0.33, 'p_giallo', top='p_arancio', bottom='p_arancio')
            band(m, (0, 0, 0), 0.225, 0.225, -0.2, -0.16, 'p_pietra_scura', n=8, both=False)
            band(m, (0, 0, 0), 0.225, 0.225, 0.16, 0.2, 'p_pietra_scura', n=8, both=False)
        m.cbox(0.38, 0.42, 0.12, 0.06, 1.22, 1.28, 'p_nero_caldo')
        for sx in (-1, 1):
            m.box(sx * 0.18 - 0.04, 0.95, -0.25, sx * 0.18 + 0.04, 1.5, 0.3, 'p_nero_caldo', skip=('bottom',))  # le cinghie

    def testa(r, c, base):
        m = r.m
        m.loft([m.ring(8, 0.14, 1.5), m.ring(8, 0.15, 1.65), m.ring(8, 0.13, 1.78), m.ring(8, 0.0001, 1.84)], 'p_sabbia_chiara', bottom='p_sabbia_chiara')
        m.box(-0.1, 1.62, -0.15, 0.1, 1.67, -0.13, 'p_nero_caldo', skip=('back',))
        m.box(-0.06, 1.63, -0.155, -0.02, 1.66, -0.15, 'p_arancio', skip=('back',), mat=EM)
        m.box(0.02, 1.63, -0.155, 0.06, 1.66, -0.15, 'p_arancio', skip=('back',), mat=EM)
        blob(m, (0, 1.86, 0), 0.05, 0.05, 0.05, 'p_rosso', n=5, k=2)

    def caraffa(r, c, p):
        m = r.m
        x, y, z = p
        m.prism(6, 0.09, 0.11, y - 0.24, y + 0.02, 'p_pietra_chiara', top='p_giallo', bottom='p_pietra_chiara', cx=x, cz=z - 0.08)
        blob(m, (x, y + 0.06, z - 0.08), 0.07, 0.05, 0.07, 'p_giallo', n=5, k=2, mat=EM)
        blob(m, (x + 0.03, y + 0.18, z - 0.06), 0.05, 0.05, 0.05, 'p_pietra_chiara', n=4, k=2)

    bipede(r, c, gamba='p_pietra_scura', scarpa='p_legno_scuro', bacino='p_pietra_scura', busto=None, braccio='p_legno_chiaro', mano=PELLE,
           testa=testa, mano_dx=caraffa, mano_sx=caraffa, sul_busto=busto, n=6)
    return r.build()


def nem_sparaneve():
    """Sparaneve Automatico «Valanga-2000»: treppiede d'acciaio, il giunto che gira, il cannone arancio con la bocca nera davanti, la
    ventola gialla dietro che gira sempre più forte prima della raffica, due LED rossi come occhi."""
    r = Rig('nem_sparaneve')
    m = r.m
    for (x, z, ax, az) in ((-0.42, -0.3, 0.3, -0.3), (0.42, -0.3, 0.3, 0.3), (0, 0.5, -0.35, 0.0)):
        tube(m, [(x * 1.2, 0.0, z * 1.2), (0, 1.0, 0)], [0.05, 0.05], 5, 'p_pietra_scura')
        m.cbox(x * 1.2, z * 1.2, 0.14, 0.14, 0.0, 0.05, 'p_nero_caldo')
    with r.osso('corpo', (0, 1.0, 0)):
        m.cbox(0, 0, 0.45, 0.45, 0.9, 1.12, 'p_pietra_scura')
        with r.osso('testa', (0, 1.25, 0)):
            with xf(m, t=(0, 1.3, 0), r=(90, 0, 0)):
                m.prism(8, 0.42, 0.48, -0.8, 0.8, 'p_arancio', top='p_arancio', bottom='p_arancio')
                band(m, (0, 0, 0), 0.47, 0.47, -0.3, -0.2, 'p_giallo', n=8, both=False)
                m.prism(8, 0.36, 0.36, 0.78, 0.86, 'p_pietra_scura', top='p_pietra_scura')
            for sx in (-1, 1):
                m.box(sx * 0.18 - 0.04, 1.62, -0.66, sx * 0.18 + 0.04, 1.7, -0.62, 'p_rosso', skip=('back',), mat=EM)
            m.box(-0.25, 1.75, -0.2, 0.25, 1.78, 0.4, 'p_giallo')                                                      # la scritta (una striscia)
            with r.osso('cannone', (0, 1.3, -0.8)):
                with xf(m, t=(0, 1.3, -0.8), r=(-90, 0, 0)):
                    m.prism(8, 0.5, 0.54, 0.0, 0.22, 'p_nero_caldo', top='p_nero_caldo', bottom='p_nero_caldo')
                    m.prism(8, 0.32, 0.32, 0.18, 0.24, 'p_pietra_chiara', top='p_nero_caldo')
            with r.osso('elica', (0, 1.3, 0.9)):
                for k in range(4):
                    with xf(m, t=(0, 1.3, 0.9), r=(0, 0, 45 + 90 * k)):
                        m.box(-0.06, 0.02, -0.02, 0.06, 0.32, 0.02, 'p_giallo', skip=())
    return r.build()


def nem_jean_claude():
    """Jean-Claude «Valanga» (boss, ≈ 3,3 m): fanatico del fitness abbronzatissimo, tuta viola fluo aperta sul petto scolpito, scarponi
    gialli, capelli biondi a punte, la mascherina arancio a specchio, il sorriso smagliante, la corona gialla da Re dello Sciolino; la
    tavola gigante «Valanga Pro-99» con le fiamme tribali impugnata come una clava (lungo il braccio destro)."""
    r = Rig('nem_jean_claude')
    c = Corpo(3.2, k=1.45, gambe=0.95)
    c.r_coscia, c.r_stinco, c.r_braccio, c.r_avambraccio, c.mano = 0.24, 0.2, 0.2, 0.18, 0.9

    def busto(r, c):
        m = r.m
        anelli(m, [R(m, 0.48, c.vita - 0.05, 0.36), R(m, 0.62, 2.0, 0.42), R(m, 0.7, 2.4, 0.42), R(m, 0.32, 2.62, 0.26)], 'p_viola', top='p_viola')
        _quad(m, [(-0.3, 1.75, -0.43), (0.3, 1.75, -0.43), (0.38, 2.45, -0.43), (-0.38, 2.45, -0.43)], PELLE)          # il petto nudo
        for x in (-0.14, 0.14):
            for y in (1.85, 2.02, 2.2):
                m.box(x - 0.1, y, -0.44, x + 0.1, y + 0.12, -0.43, 'p_legno', skip=('back',))                           # gli addominali
        for sx in (-1, 1):
            m.box(sx * 0.35 - 0.04, 1.75, -0.44, sx * 0.35 + 0.04, 2.45, -0.42, 'p_giallo', skip=('back',))              # le righe fluo

    def testa(r, c, base):
        m = r.m
        m.cbox(0, 0.05, 0.48, 0.5, 2.62, 3.1, PELLE)
        m.cbox(0, -0.21, 0.5, 0.08, 2.86, 2.98, 'p_arancio', mat=EM)
        m.cbox(0, -0.205, 0.3, 0.02, 2.7, 2.75, 'p_sabbia_chiara')
        m.cbox(0, 0.05, 0.54, 0.54, 3.08, 3.32, 'p_giallo')
        for k, x in enumerate((-0.16, 0, 0.16)):
            cone_dir(m, (x, 3.3, 0.05), (x * 1.6, 3.7 + (0.1 if k == 1 else 0), 0.1), 0.12, 4, 'p_giallo')
        m.prism(8, 0.33, 0.33, 3.22, 3.34, 'p_giallo', top='p_giallo', bottom='p_giallo', cz=0.05)
        for k in range(8):
            a = 2 * math.pi * k / 8
            cone_dir(m, (math.cos(a) * 0.3, 3.34, 0.05 + math.sin(a) * 0.3), (math.cos(a) * 0.32, 3.5, 0.05 + math.sin(a) * 0.32), 0.05, 3, 'p_giallo')

    def tavola(r, c, p):
        m = r.m
        x, y, z = p
        m.cbox(x, z - 0.1, 0.14, 0.6, y - 2.4, y + 0.6, 'p_viola', top='p_viola', bottom='p_viola')
        m.cbox(x, z - 0.1, 0.1, 0.64, y - 2.42, y + 0.62, 'p_pietra_chiara')
        m.cbox(x + 0.075, z - 0.1, 0.02, 0.36, y - 2.0, y - 0.8, 'p_arancio', mat=EM)
        for yy in (y + 0.2, y - 1.3):
            m.cbox(x - 0.1, z - 0.1, 0.2, 0.3, yy - 0.15, yy + 0.15, 'p_nero_caldo')

    bipede(r, c, gamba='p_viola', scarpa='p_giallo', bacino='p_viola', busto=None, braccio='p_viola', mano=PELLE,
           testa=testa, mano_dx=tavola, sul_busto=busto, n=6)
    return r.build()


MODELS = {f.__name__: f for f in (nem_acrobata, nem_alchimista, nem_sparaneve, nem_jean_claude)}
MODELS_RPG = list(MODELS.values())
