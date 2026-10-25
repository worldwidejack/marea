# MAREA — vestiti del Mercante, prima parte: i tre gratuiti e le coppie coi cappelli che c'erano già (avatar.json `abiti`).
# Ogni ricetta: fn(corpo) → [(Pezzo, 'abito' | 'luce' | 'vetro' | 'nascondi')]. Colori da abiti_kit.C. Pesi: corpo.pesi(zona).
import math
import models_chr
import gente_kit
from abiti_kit import Pezzo, C, righe, dir_a
from abiti_capi import busto, manica, maniche, bacino, gambe, gamba, scarpa, veste, cintura, bottoni, risvolto, asse_braccio, quote
from abiti_dettagli import pannello, striscia, filo, su, colletto, toppa, pallino


def P(nome):
    return Pezzo(nome, models_chr.BONES)


def polsino(p, corpo, s, col, y, off=0.03, alto=0.02, n=10):
    c = asse_braccio(corpo, s, y)
    p.loft([corpo.anello('braccio.' + s, y + alto / 2, n, off, c=c), corpo.anello('braccio.' + s, y - alto / 2, n, off, c=c)], col, corpo.pesi('braccio.' + s))


def falda(p, col, y_top, y_giu, r_top, r_giu, a0=30, a1=330, passo=0.06, sz=0.9):
    """Falda di cappotto aperta davanti (da a0 ad a1 gradi), a campana; pesi su bacino e cosce."""
    rings = []
    for y in quote(y_top, y_giu, passo):
        t = (y_top - y) / max(0.01, y_top - y_giu)
        rr = r_top + (r_giu - r_top) * t
        rings.append([(dir_a(a)[0] * rr, y, 0.01 + dir_a(a)[2] * rr * sz) for a in range(a0, a1 + 1, 30)])
    pts = [q for r in rings for q in r]
    m = len(rings[0]); faces = []
    for i in range(len(rings) - 1):
        faces += [(i * m + k, i * m + k + 1, (i + 1) * m + k + 1, (i + 1) * m + k) for k in range(m - 1)]
    i0 = p._verts(pts, lambda q: p._w(q, gente_kit.SKIRT()))
    p._faces(faces, i0, col, pts)


def base(corpo):
    """T-shirt corallo con le maniche a contrasto e pantaloncini beige: geometria pulita, colori pastello."""
    p = P('abt_base')
    busto(p, corpo, C['corallo'], y0=0.83)
    maniche(p, corpo, C['panna'], y_fine=1.04, largo=0.006)
    for s in 'LR':
        polsino(p, corpo, s, C['corallo'], 1.04, off=0.034)
    bacino(p, corpo, C['sabbia'], y_top=0.86)
    gambe(p, corpo, C['sabbia'], y_fine=0.5, largo=0.012)
    for s in 'LR':
        risvolto(p, corpo, s, C['panna'], 0.505, alto=0.022, off=0.036)
    toppa(p, corpo, 'busto', C['rosso'], 1.17, -28, 0.06, 0.05, off=0.026)
    return [(p, 'abito')]


def salopette(corpo):
    """Maglietta bianca sotto una salopette di jeans: pettorina, bretelle piatte coi bottoni d'ottone, risvoltini azzurri."""
    p = P('abt_salopette')
    busto(p, corpo, C['bianco'], y0=0.9)
    maniche(p, corpo, C['bianco'], y_fine=1.05)
    bacino(p, corpo, C['denim'], y_top=0.99, off=0.03)
    gambe(p, corpo, C['denim'], y_fine=0.14, largo=0.014)
    for s in 'LR':
        risvolto(p, corpo, s, C['denim_chiaro'], 0.15, alto=0.04, off=0.042)
    pannello(p, corpo, 'busto', C['denim'], 0.97, 1.2, -42, 42, off=0.034, n=7)
    toppa(p, corpo, 'busto', C['denim_chiaro'], 1.1, 0, 0.09, 0.07, off=0.042)
    for k in (-1, 1):
        a = 34 * k
        striscia(p, corpo, C['denim'], [su(corpo, 'busto', 1.2, a, 0.036), su(corpo, ('busto', 'braccio.L', 'braccio.R'), 1.28, 20 * k, 0.03), (0.09 * k, 1.335, 0.045),
                                        su(corpo, 'busto', 1.24, 180 - 30 * k, 0.03), su(corpo, 'busto', 1.0, 180 - 22 * k, 0.034)], larga=0.038, spessa=0.01,
                 zone=('busto', 'testa'))
        pallino(p, corpo, 'busto', C['ottone'], 1.18, a, r=0.016, off=0.048)
    toppa(p, corpo, 'busto', C['denim_chiaro'], 0.8, 180 + 40, 0.07, 0.07, off=0.034)
    return [(p, 'abito')]


def felpa(corpo):
    """Felpa oversize arancio con cappuccio abbassato e tasca a marsupio, cargo verde militare coi tasconi, sneaker."""
    p = P('abt_felpa')
    busto(p, corpo, C['arancio'], y0=0.78, off=0.04, flare=lambda y: 0.01 if y < 0.86 else 0.0, collo_off=0.03)
    pannello(p, corpo, 'busto', C['mattone'], 0.77, 0.81, -180, 180, off=0.058, n=17)
    for s in 'LR':
        manica(p, corpo, s, C['arancio'], y_fine=0.84, largo=0.02, polsino=C['mattone'])
    pannello(p, corpo, 'busto', C['mattone'], 0.86, 0.99, -38, 38, off=0.056, n=6)
    arco = [su(corpo, ('busto', 'testa'), 1.33 - 0.03 * math.cos(math.radians(a)), a, 0.05 + 0.02 * math.sin(math.radians(min(180, max(0, a))))) for a in range(60, 301, 30)]
    p.tube(arco, [(0.042, 0.03)] * len(arco), C['arancio'], corpo.pesi(('busto', 'testa')), n=8, res=2)
    p.tube(arco[1:-1], [(0.026, 0.02)] * (len(arco) - 2), C['mare'], corpo.pesi(('busto', 'testa')), n=6, res=2)
    for k in (-1, 1):
        filo(p, corpo, C['mare'], [su(corpo, 'busto', 1.3, 14 * k, 0.04), su(corpo, 'busto', 1.2, 16 * k, 0.05), su(corpo, 'busto', 1.12, 17 * k, 0.052)], r=0.006)
    bacino(p, corpo, C['militare'], y_top=0.82, off=0.03)
    gambe(p, corpo, C['militare'], y_fine=0.14, largo=lambda y: 0.024 + (0.01 if y > 0.3 else 0.0))
    for s in 'LR':
        a = 90 if s == 'R' else -90
        toppa(p, corpo, 'gamba.' + s, C['erba_scura'], 0.45, a, 0.09, 0.1, off=0.05, t=0.03)
        toppa(p, corpo, 'gamba.' + s, C['militare'], 0.51, a, 0.095, 0.03, off=0.066, t=0.012)
        scarpa(p, corpo, s, C['bianco'], suola=C['pietra'], alto=0.12)
    return [(p, 'abito')]


def cerata(corpo):
    """Cerata gialla svasata a campana, colletto alto, zip scura, maglia a righe che spunta, stivali di gomma neri."""
    p = P('abt_cerata')
    busto(p, corpo, C['giallo'], y0=0.8, off=0.03, flare=lambda y: max(0.0, (0.95 - y)) * 0.25, collo=False)
    veste(p, corpo, C['giallo'], y_top=0.82, y_giu=0.56, r_giu=0.27, off=0.04)
    righe_m = righe(C['bianco'], C['mare'], 0.018)
    colletto(p, corpo, C['giallo'], y0=1.3, y1=1.41, off=0.034, svasa=0.012)
    colletto(p, corpo, righe_m, y0=1.33, y1=1.37, off=0.022, svasa=0.0)
    for s in 'LR':
        manica(p, corpo, s, C['giallo'], y_fine=0.82, largo=0.022)
        polsino(p, corpo, s, C['arancio'], 0.83, off=0.05, alto=0.04)
    striscia(p, corpo, C['roccia'], [su(corpo, ('busto', 'testa'), 1.4, 0, 0.05), su(corpo, 'busto', 1.2, 0, 0.044), su(corpo, 'busto', 0.95, 0, 0.06)], larga=0.026, spessa=0.01)
    for y in (1.22, 1.08, 0.94):
        toppa(p, corpo, 'busto', C['arancio'], y, 0, 0.05, 0.016, off=0.06, t=0.016)
    for k in (-1, 1):
        toppa(p, corpo, 'busto', C['giallo'], 0.9, 32 * k, 0.1, 0.08, off=0.08, t=0.02)
        toppa(p, corpo, 'busto', C['arancio'], 0.94, 32 * k, 0.105, 0.03, off=0.092, t=0.012)
    gambe(p, corpo, righe_m, y_top=0.64, y_fine=0.54, largo=0.02)                       # la maglia a righe lunga che spunta sotto
    gambe(p, corpo, C['navy'], y_top=0.56, y_fine=0.3, largo=0.01)
    for s in 'LR':
        scarpa(p, corpo, s, C['nero'], suola=C['roccia'], alto=0.38, off=0.026)
        risvolto(p, corpo, s, C['roccia'], 0.38, alto=0.03, off=0.044)
    return [(p, 'abito')]


def kimono(corpo):
    """Veste da viaggio incrociata indaco, maniche larghe a cono, fascia bordeaux col nodo, pantaloni scuri stretti in caviglia."""
    p = P('abt_kimono')
    busto(p, corpo, C['navy'], y0=0.74, off=0.03, collo_off=0.03)
    veste(p, corpo, C['navy'], y_top=0.78, y_giu=0.52, r_giu=0.24, off=0.034)
    for k in (-1, 1):
        pts = [su(corpo, ('busto', 'testa'), 1.36, 150 * k, 0.03), su(corpo, ('busto', 'braccio.L', 'braccio.R'), 1.3, 40 * k, 0.034),
               su(corpo, 'busto', 1.12, 8 * k, 0.04), su(corpo, 'busto', 0.96, -16 * k, 0.048)]
        striscia(p, corpo, C['salvia'], pts, larga=0.07, spessa=0.012, zone=('busto', 'testa'))
    for s in 'LR':
        manica(p, corpo, s, C['navy'], y_fine=0.86, largo=lambda y: 0.01 + max(0.0, 1.1 - y) * 0.32)
        polsino(p, corpo, s, C['salvia'], 0.86, off=0.1, alto=0.02, n=12)
    cintura(p, corpo, C['bordeaux'], y=0.9, alto=0.085, off=0.05)
    nodo = su(corpo, 'busto', 0.9, -50, 0.07)
    p.ell(nodo, (0.04, 0.035, 0.03), C['bordeaux'], corpo.pesi('busto'), n=8, m=4)
    for dz in (-1, 1):
        filo(p, corpo, C['bordeaux'], [nodo, (nodo[0] - 0.02, nodo[1] - 0.08, nodo[2] + 0.02 * dz), (nodo[0] - 0.03, nodo[1] - 0.16, nodo[2] + 0.03 * dz)], r=0.014)
    gambe(p, corpo, C['roccia'], y_top=0.6, y_fine=0.1, largo=lambda y: 0.008 + 0.03 * math.sin(max(0.0, min(1.0, (y - 0.1) / 0.5)) * math.pi))
    for s in 'LR':
        risvolto(p, corpo, s, C['bordeaux'], 0.12, alto=0.03, off=0.026)
    return [(p, 'abito')]


def faro(corpo):
    """Cappotto pesante marrone col collo alto, bandoliera di cuoio, borraccia e corda arrotolata alla cintura, stivali."""
    p = P('abt_faro')
    busto(p, corpo, C['cuoio_scuro'], y0=0.76, off=0.034, collo=False)
    veste(p, corpo, C['cuoio_scuro'], y_top=0.8, y_giu=0.42, r_giu=0.26, off=0.04)
    colletto(p, corpo, C['cuoio'], y0=1.3, y1=1.43, off=0.04, svasa=0.016)
    for s in 'LR':
        manica(p, corpo, s, C['cuoio_scuro'], y_fine=0.8, largo=0.02)
        polsino(p, corpo, s, C['cuoio'], 0.83, off=0.05, alto=0.04)
    bottoni(p, corpo, C['ottone'], [1.2, 1.08, 0.96], a=-10, off=0.05, r=0.013)
    cintura(p, corpo, C['nero'], y=0.86, alto=0.05, off=0.052, fibbia=(0.06, 0.05), fibbia_col=C['ottone'])
    spalla = su(corpo, ('busto', 'braccio.L', 'braccio.R'), 1.28, -40, 0.05)
    striscia(p, corpo, C['cuoio'], [spalla, su(corpo, 'busto', 1.12, -5, 0.05), su(corpo, 'busto', 0.95, 45, 0.06), su(corpo, 'busto', 0.9, 90, 0.07)], larga=0.05, spessa=0.012)
    striscia(p, corpo, C['cuoio'], [spalla, su(corpo, ('busto', 'braccio.L', 'braccio.R'), 1.3, -120, 0.05), su(corpo, 'busto', 1.1, 180, 0.05), su(corpo, 'busto', 0.9, 100, 0.07)],
             larga=0.05, spessa=0.012)
    for y, a in ((1.1, 20), (1.0, 30)):
        toppa(p, corpo, 'busto', C['ottone'], y, a, 0.02, 0.02, off=0.066, t=0.01)
    q = su(corpo, 'busto', 0.82, 70, 0.1)
    p.lathe([(0.0, q[1] - 0.06), (0.04, q[1] - 0.055), (0.042, q[1] + 0.04), (0.018, q[1] + 0.055), (0.018, q[1] + 0.075), (0.0, q[1] + 0.075)],
            C['argento'], corpo.pesi('busto'), n=10, c=(q[0], 0, q[2]))
    q = su(corpo, 'busto', 0.82, -75, 0.1)
    for k in range(3):
        anello = [(q[0] - 0.012 * k + 0.02 * math.cos(math.radians(t)), q[1] + 0.05 * math.sin(math.radians(t)), q[2] + 0.05 * math.cos(math.radians(t))) for t in range(0, 361, 45)]
        p.tube(anello, [0.012] * len(anello), C['sabbia'], corpo.pesi('busto'), n=5, res=1, caps=(None, None))
    gambe(p, corpo, C['roccia'], y_top=0.6, y_fine=0.3, largo=0.012)
    for s in 'LR':
        scarpa(p, corpo, s, C['cuoio'], suola=C['nero'], alto=0.34, off=0.022)
        risvolto(p, corpo, s, C['cuoio_scuro'], 0.33, alto=0.04, off=0.046)
    return [(p, 'abito')]


def marina(corpo):
    """Uniforme di Alta Marina: doppiopetto blu navy squadrato, due file di bottoni d'oro, spalline dorate, pantaloni bianchi, scarpe lucide."""
    p = P('abt_marina')
    busto(p, corpo, C['navy'], y0=0.76, off=lambda a, y: 0.03 + 0.008 * abs(math.sin(math.radians(a * 2))), collo=False)
    colletto(p, corpo, C['bianco'], y0=1.31, y1=1.37, off=0.032, svasa=0.004)
    pannello(p, corpo, 'busto', C['navy'], 0.78, 1.26, -8, 34, off=0.042, n=5)
    for y in (1.18, 1.05, 0.92):
        for a in (-24, 24):
            pallino(p, corpo, 'busto', C['oro'], y, a, r=0.014, off=0.05)
    for s in 'LR':
        manica(p, corpo, s, C['navy'], y_fine=0.8, largo=0.012)
        for y in (0.86, 0.9):
            polsino(p, corpo, s, C['oro'], y, off=0.036, alto=0.016)
        k = -1 if s == 'L' else 1
        q = (0.17 * k, 1.305, 0.01)
        p.box(q, (0.11, 0.022, 0.1), C['oro'], corpo.pesi(('busto', 'braccio.' + s)), r=(0, 0, -16 * k))
        for j in range(5):
            p.box((q[0] + k * 0.055, q[1] - 0.03, q[2] - 0.04 + j * 0.02), (0.008, 0.05, 0.008), C['giallo'], corpo.pesi('braccio.' + s), r=(0, 0, -10 * k))
    cintura(p, corpo, C['navy'], y=0.8, alto=0.03, off=0.04)
    bacino(p, corpo, C['bianco'], y_top=0.82, off=0.022)
    gambe(p, corpo, C['bianco'], y_fine=0.12, largo=0.016)
    for s in 'LR':
        scarpa(p, corpo, s, C['nero'], suola=C['roccia'], alto=0.12)
    return [(p, 'abito')]


def stuntman(corpo):
    """Tuta intera da motocross a blocchi arancio, bianco e nero, con protezioni rigide: spalle, piastra sul petto, ginocchiere."""
    p = P('abt_stuntman')
    blocchi = lambda q: C['nero'] if 0.8 < q[1] < 0.9 else (C['bianco'] if abs(q[0]) > 0.11 and q[1] > 0.9 else C['arancio'])
    busto(p, corpo, blocchi, y0=0.8, off=0.022, collo_off=0.03)
    colletto(p, corpo, C['nero'], y0=1.33, y1=1.38, off=0.03)
    for s in 'LR':
        manica(p, corpo, s, lambda q: C['arancio'] if q[1] > 1.0 else C['bianco'], y_fine=0.8, polsino=C['nero'])
        k = -1 if s == 'L' else 1
        p.ell((0.2 * k, 1.27, 0.01), (0.085, 0.06, 0.085), C['bianco'], corpo.pesi(('braccio.' + s, 'busto')), n=10, m=4, cut=(-0.1, 1.0))
        p.ell((0.205 * k, 1.235, 0.01), (0.075, 0.03, 0.075), C['nero'], corpo.pesi(('braccio.' + s, 'busto')), n=10, m=2, cut=(-0.2, 0.6))
        p.ell((0.21 * k, 0.98, 0.04), (0.05, 0.06, 0.055), C['nero'], corpo.pesi('braccio.' + s), n=8, m=3)
    pannello(p, corpo, 'busto', C['nero'], 0.98, 1.24, -40, 40, off=0.05, n=6, piega=lambda y, a: 0.012 * (1 - abs(a) / 40))
    pannello(p, corpo, 'busto', C['rosso'], 1.04, 1.18, -10, 10, off=0.068, n=3)
    bacino(p, corpo, C['nero'], y_top=0.84, off=0.024)
    gambe(p, corpo, lambda q: C['arancio'] if q[1] > 0.5 else C['bianco'], y_fine=0.3, largo=0.016)
    for s in 'LR':
        c = corpo.centro('gamba.' + s, 0.42)
        p.box((c[0], 0.42, c[1] - 0.075), (0.11, 0.13, 0.05), C['nero'], corpo.pesi('gamba.' + s), r=(-6, 0, 0))
        p.box((c[0], 0.44, c[1] - 0.1), (0.07, 0.05, 0.01), C['arancio'], corpo.pesi('gamba.' + s), r=(-6, 0, 0))
        scarpa(p, corpo, s, lambda q: C['bianco'] if q[1] > 0.14 else C['nero'], suola=C['roccia'], alto=0.36, off=0.03)
        for y in (0.2, 0.28):
            risvolto(p, corpo, s, C['arancio'], y, alto=0.014, off=0.05)
    return [(p, 'abito')]


def synthwave(corpo):
    """Giacca nera-viola col colletto alto a V, fili neon ciano e magenta su braccia, bordi e pantaloni (sempre accesi)."""
    p, l = P('abt_synthwave'), P('abt_synthwave_luce')
    busto(p, corpo, C['viola_scuro'], y0=0.78, off=0.028, collo=False)
    colletto(p, corpo, C['nero'], y0=1.3, y1=1.45, off=0.036, svasa=0.03, aperto=70)
    bacino(p, corpo, C['nero'], y_top=0.8)
    gambe(p, corpo, C['nero'], y_fine=0.14, largo=0.012)
    for s in 'LR':
        manica(p, corpo, s, C['viola_scuro'], y_fine=0.8, largo=0.012, polsino=C['nero'])
        k = -1 if s == 'L' else 1
        filo(l, corpo, C['neon_ciano'], [(asse_braccio(corpo, s, y)[0] + 0.062 * k, y, asse_braccio(corpo, s, y)[1]) for y in (1.24, 1.1, 0.96, 0.84)], r=0.008, zone=('braccio.' + s,))
        filo(l, corpo, C['neon_rosa'], [corpo.punto('gamba.' + s, y, 90 * k, 0.036) for y in (0.62, 0.45, 0.3, 0.16)], r=0.008, zone=('gamba.' + s,))
        scarpa(p, corpo, s, C['nero'], suola=C['viola'], alto=0.12)
        risvolto(l, corpo, s, C['neon_ciano'], 0.014, alto=0.01, off=0.034)
    for k in (-1, 1):
        filo(l, corpo, C['neon_rosa'], [su(corpo, 'busto', y, 12 * k, 0.04) for y in (1.3, 1.1, 0.9, 0.8)], r=0.008)
    filo(l, corpo, C['neon_ciano'], [su(corpo, 'busto', 0.795, a, 0.046) for a in range(-170, 181, 30)], r=0.007)
    toppa(p, corpo, 'busto', C['nero'], 1.12, 180, 0.16, 0.16, off=0.04)
    for j, cc in enumerate(('neon_rosa', 'neon_ambra', 'neon_rosa')):
        toppa(l, corpo, 'busto', C[cc], 1.15 - j * 0.035, 180, 0.12 - j * 0.02, 0.012, off=0.05)
    return [(p, 'abito'), (l, 'luce')]


def pirata(corpo):
    """Soprabito cremisi lungo e aperto sulla camicia bianca, bordi d'oro, cinturone con fibbia; uno stivale col risvolto, l'altra gamba di legno."""
    p, h = P('abt_pirata'), P('abt_pirata_nascondi')
    busto(p, corpo, C['rosso'], y0=0.82, off=0.03, collo_off=0.03)
    pannello(p, corpo, 'busto', C['bianco'], 0.88, 1.27, -24, 24, off=0.042, n=5)
    pannello(p, corpo, 'busto', C['bianco'], 1.16, 1.28, -14, 14, off=0.054, n=3, piega=lambda y, a: 0.02 * (y - 1.16) / 0.12)
    falda(p, lambda q: C['oro'] if q[1] < 0.5 or abs(math.degrees(math.atan2(q[0], -q[2]))) < 36 else C['rosso'], 0.84, 0.46, 0.22, 0.28)
    for k in (-1, 1):
        filo(p, corpo, C['oro'], [su(corpo, 'busto', y, 28 * k, 0.044) for y in (1.28, 1.1, 0.9)], r=0.01)
    colletto(p, corpo, C['rosso'], y0=1.3, y1=1.38, off=0.05, svasa=0.03, aperto=80)
    for s in 'LR':
        manica(p, corpo, s, C['rosso'], y_fine=0.84, largo=0.018)
        polsino(p, corpo, s, C['oro'], 0.87, off=0.06, alto=0.06)
        polsino(p, corpo, s, C['bianco'], 0.81, off=0.04, alto=0.04)
    cintura(p, corpo, C['nero'], y=0.86, alto=0.07, off=0.05, fibbia=(0.09, 0.08), fibbia_col=C['giallo'])
    toppa(p, corpo, 'busto', C['nero'], 0.86, 0, 0.045, 0.04, off=0.07)
    bacino(p, corpo, C['cuoio_scuro'], y_top=0.84, off=0.02)
    gamba(p, corpo, 'L', C['cuoio_scuro'], y_fine=0.4, largo=0.014)
    gamba(p, corpo, 'R', C['cuoio_scuro'], y_fine=0.4, largo=0.03)
    scarpa(p, corpo, 'L', C['nero'], suola=C['roccia'], alto=0.38, off=0.026)
    risvolto(p, corpo, 'L', C['nero'], 0.38, alto=0.07, off=0.06)
    # gamba di legno a destra: sotto il ginocchio la gamba vera sparisce (pezzo invisibile che la copre), al suo posto un piolo
    c = corpo.centro('gamba.R', 0.4)
    p.lathe([(0.0, 0.0), (0.03, 0.0), (0.032, 0.02), (0.026, 0.1), (0.03, 0.34), (0.05, 0.38), (0.055, 0.44)], C['cuoio'], corpo.pesi('gamba.R'), n=8, c=(c[0], 0, c[1]))
    for y in (0.3, 0.18):
        p.lathe([(0.033, y - 0.008), (0.033, y + 0.008)], C['ottone'], corpo.pesi('gamba.R'), n=8, c=(c[0], 0, c[1]), caps=False)
    h.loft([corpo.anello('gamba.R', max(0.004, y), 12, 0.035, c=corpo.centro('gamba.R', 0.012) if y < 0.09 else None) for y in (0.4, 0.3, 0.2, 0.12, 0.08, 0.05, 0.02, 0.004)]
           + [[(q[0], -0.01, q[2]) for q in corpo.anello('gamba.R', 0.004, 12, 0.035, c=corpo.centro('gamba.R', 0.012))]], C['nero'], corpo.pesi('gamba.R'), bottom=True, top=True)
    return [(p, 'abito'), (h, 'nascondi')]


ABITI = {'base': base, 'salopette': salopette, 'felpa': felpa, 'cerata': cerata, 'kimono': kimono, 'faro': faro, 'marina': marina,
         'stuntman': stuntman, 'synthwave': synthwave, 'pirata': pirata}
