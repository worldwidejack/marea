# MAREA — vestiti del Mercante, terza parte: le coppie nuove (turista, investigatore, artista, rana, postino, gelataio, magnate, cactus,
# cosmonauta). Stesse regole di abiti_set_a.py.
import math
import gente_kit
from abiti_kit import C, righe, righe_ang, dir_a
from abiti_capi import busto, manica, maniche, bacino, gambe, gamba, scarpa, veste, cintura, bottoni, risvolto, asse_braccio, quote
from abiti_dettagli import pannello, striscia, filo, su, colletto, toppa, pallino
from abiti_set_a import P, polsino, falda


def grembiule(p, col, y_top, y_giu, r_top, a=80, sz=0.75, giu_largo=0.12):
    rings = []
    for y in quote(y_top, y_giu, 0.06):
        r = r_top + (y_top - y) * giu_largo
        rings.append([(dir_a(t)[0] * r, y, dir_a(t)[2] * r * sz) for t in range(-a, a + 1, 20)])
    pts = [q for rr in rings for q in rr]
    m = len(rings[0]); faces = []
    for i in range(len(rings) - 1):
        faces += [(i * m + k, i * m + k + 1, (i + 1) * m + k + 1, (i + 1) * m + k) for k in range(m - 1)]
    i0 = p._verts(pts, lambda q: p._w(q, gente_kit.SKIRT()))
    p._faces(faces, i0, col, pts)


def macchie(p, corpo, zona, punti, off=0.05):
    """Dischetti piatti di colore (schizzi, fiori) sulla pelle: punti = [(y, a, r, colore)]."""
    for y, a, r, col in punti:
        q = corpo.punto(zona, y, a, off)
        d = dir_a(a)
        p.ell(q, (r * (1 - 0.7 * abs(d[0])), r, r * (1 - 0.7 * abs(d[2]))), col, corpo.pesi(zona), n=7, m=2)


def hawaiana(corpo):
    """Camicia hawaiana aperta azzurra a fiori gialli e rosa sopra la canottiera bianca, bermuda beige, macchina fotografica al collo."""
    p = P('abt_hawaiana')
    busto(p, corpo, C['acqua'], y0=0.82, off=0.03, collo_off=0.03)
    pannello(p, corpo, 'busto', C['bianco'], 0.84, 1.28, -20, 20, off=0.04, n=5)
    colletto(p, corpo, C['acqua'], y0=1.3, y1=1.35, off=0.05, svasa=0.03, aperto=90)
    maniche(p, corpo, C['acqua'], y_fine=1.0, largo=0.02)
    fiori = []
    for k in range(30):
        y = 0.86 + (k * 0.137) % 0.42
        a = (k * 71) % 300 + 30
        if abs(((a + 180) % 360) - 180) < 30:
            continue
        fiori.append((y, a, 0.022 if k % 3 else 0.028, C['giallo'] if k % 2 else C['rosa']))
    macchie(p, corpo, ('busto', 'braccio.L', 'braccio.R'), fiori, off=0.05)
    for y, a, r, col in fiori[::2]:
        macchie(p, corpo, ('busto', 'braccio.L', 'braccio.R'), [(y, a, r * 0.35, C['arancio'] if col == C['giallo'] else C['bianco'])], off=0.054)
    for k in (-1, 1):
        filo(p, corpo, C['nero'], [su(corpo, ('busto', 'testa'), 1.34, 120 * k, 0.04), su(corpo, 'busto', 1.24, 30 * k, 0.05), su(corpo, 'busto', 1.12, 6 * k, 0.06)], r=0.007)
    q = su(corpo, 'busto', 1.1, 0, 0.09)
    p.box(q, (0.1, 0.065, 0.05), C['roccia'], corpo.pesi('busto'))
    p.box((q[0], q[1] + 0.035, q[2] + 0.005), (0.04, 0.012, 0.03), C['nero'], corpo.pesi('busto'))
    p.lathe([(0.026, -0.0), (0.026, 0.04), (0.02, 0.045), (0.0, 0.045)], C['nero'], corpo.pesi('busto'), n=10, c=(q[0], 0, q[2]),
            deform=lambda v: (v[0], q[1] + v[2], -v[1] - 0.025))
    p.ell((q[0], q[1], q[2] - 0.072), (0.016, 0.016, 0.006), C['celeste'], corpo.pesi('busto'), n=8, m=2)
    bacino(p, corpo, C['sabbia'], y_top=0.84)
    gambe(p, corpo, C['sabbia'], y_fine=0.46, largo=0.02)
    for s in 'LR':
        toppa(p, corpo, 'gamba.' + s, C['cammello'], 0.58, 90 if s == 'R' else -90, 0.07, 0.08, off=0.044)
    return [(p, 'abito')]


def trench(corpo):
    """Trench color cammello con la mantellina sulle spalle, cintura annodata, lente d'ingrandimento appesa al fianco."""
    p, v = P('abt_trench'), P('abt_trench_vetro')
    busto(p, corpo, C['cammello'], y0=0.76, off=0.032, collo=False)
    veste(p, corpo, C['cammello'], y_top=0.8, y_giu=0.38, r_giu=0.25, off=0.038)
    colletto(p, corpo, C['sabbia'], y0=1.3, y1=1.4, off=0.04, svasa=0.03, aperto=50)
    zs = ('busto', 'braccio.L', 'braccio.R')
    rings = [corpo.anello(('busto', 'testa'), 1.345, 16, 0.05, c=(0, 0.01))]
    for y, o in ((1.28, 0.06), (1.2, 0.075)):
        rings.append(corpo.anello(zs, y, 16, o, c=(0, 0.01)))
    rings.append([(q[0] * 1.06, 1.07, q[2] * 1.06) for q in corpo.anello(zs, 1.16, 16, 0.08, c=(0, 0.01))])
    p.loft(rings, lambda q: C['cuoio'] if q[1] < 1.085 else C['sabbia'], corpo.pesi(zs))
    for s in 'LR':
        manica(p, corpo, s, C['cammello'], y_fine=0.8, largo=0.02)
        polsino(p, corpo, s, C['cuoio'], 0.84, off=0.045, alto=0.02)
    bottoni(p, corpo, C['cuoio_scuro'], [1.15, 1.0], a=-20, off=0.048)
    bottoni(p, corpo, C['cuoio_scuro'], [1.15, 1.0], a=20, off=0.048)
    cintura(p, corpo, C['cammello'], y=0.88, alto=0.045, off=0.052)
    q = su(corpo, 'busto', 0.88, -25, 0.07)
    p.ell(q, (0.03, 0.025, 0.02), C['cammello'], corpo.pesi('busto'), n=8, m=4)
    for d in (-1, 1):
        filo(p, corpo, C['cammello'], [q, (q[0] + 0.01 * d, q[1] - 0.09, q[2] - 0.01), (q[0] + 0.02 * d, q[1] - 0.17, q[2] - 0.01)], r=0.012)
    # lente: manico che pende dalla cintura, anello nero, vetro azzurro
    q = su(corpo, 'busto', 0.8, 75, 0.11)
    p.tube([(q[0], q[1] + 0.06, q[2]), (q[0], q[1], q[2])], [0.012, 0.014], C['cuoio_scuro'], corpo.pesi('busto'), n=6, res=1)
    centro = (q[0] + 0.01, q[1] - 0.06, q[2])
    anello = [(centro[0] + 0.006 * math.cos(math.radians(t)), centro[1] + 0.05 * math.sin(math.radians(t)), centro[2] + 0.05 * math.cos(math.radians(t))) for t in range(0, 361, 30)]
    p.tube(anello, [0.009] * len(anello), C['nero'], corpo.pesi('busto'), n=5, res=1, caps=(None, None))
    v.ell(centro, (0.006, 0.046, 0.046), C['celeste'], corpo.pesi('busto'), n=12, m=4)
    gambe(p, corpo, C['roccia'], y_top=0.6, y_fine=0.12, largo=0.014)
    for s in 'LR':
        scarpa(p, corpo, s, C['cuoio_scuro'], suola=C['nero'], alto=0.12)
    return [(p, 'abito'), (v, 'vetro')]


def atelier(corpo):
    """Maglia a righe orizzontali bianche e nere sotto un grembiule lungo color tela coperto di schizzi, tavolozza sul fianco."""
    p = P('abt_atelier')
    rg = righe(C['bianco'], C['nero'], 0.04, fase=0.02)
    busto(p, corpo, rg, y0=0.8, off=0.022, passo=0.04, collo_off=0.024)
    for s in 'LR':
        manica(p, corpo, s, rg, y_fine=0.84, largo=0.01, passo=0.04)
        polsino(p, corpo, s, C['nero'], 0.85, off=0.034, alto=0.02)
    pannello(p, corpo, 'busto', C['panna'], 0.86, 1.26, -44, 44, off=0.036, n=7)
    grembiule(p, C['panna'], 0.88, 0.38, 0.215, a=70, giu_largo=0.1)
    cintura(p, corpo, C['panna'], y=0.88, alto=0.03, off=0.04)
    for k in (-1, 1):
        striscia(p, corpo, C['panna'], [su(corpo, 'busto', 1.26, 36 * k, 0.04), su(corpo, ('busto', 'testa'), 1.36, 100 * k, 0.035), su(corpo, ('busto', 'testa'), 1.36, 175 * k, 0.03)],
                 larga=0.03, spessa=0.008, zone=('busto', 'testa'))
    schizzi = [(1.18, -20, 0.03, C['rosso']), (1.05, 25, 0.024, C['acqua']), (0.98, -30, 0.02, C['giallo']), (1.12, 10, 0.014, C['acqua']),
               (0.93, 5, 0.018, C['rosso']), (1.22, 30, 0.016, C['giallo'])]
    macchie(p, corpo, 'busto', schizzi, off=0.044)
    for y, x, r, col in ((0.75, -0.06, 0.03, C['giallo']), (0.62, 0.07, 0.035, C['rosso']), (0.5, -0.02, 0.026, C['acqua']), (0.68, 0.12, 0.018, C['acqua']),
                         (0.45, 0.1, 0.02, C['giallo'])):
        rr = 0.215 + (0.88 - y) * 0.1
        z = -math.sqrt(max(0.0, rr * rr - x * x)) * 0.75 - 0.006
        p.ell((x, y, z), (r, r * 0.9, 0.006), col, lambda q: p._w(q, gente_kit.SKIRT()), n=7, m=2)
    # tavolozza sul fianco destro, col buco per il pollice e tre colori
    q = su(corpo, ('busto', 'gamba.L', 'gamba.R'), 0.74, 90, 0.08)
    p.ell(q, (0.012, 0.075, 0.1), C['cammello'], corpo.pesi(('busto', 'gamba.R')), n=12, m=3)
    for j, col in enumerate((C['rosso'], C['giallo'], C['acqua'])):
        p.ell((q[0] + 0.012, q[1] + 0.03 - j * 0.02, q[2] - 0.05 + j * 0.035), (0.008, 0.016, 0.016), col, corpo.pesi(('busto', 'gamba.R')), n=6, m=3)
    bacino(p, corpo, C['roccia'], y_top=0.84)
    gambe(p, corpo, C['roccia'], y_fine=0.12, largo=0.012)
    for s in 'LR':
        scarpa(p, corpo, s, C['nero'], suola=C['bianco'], alto=0.12)
    return [(p, 'abito')]


def rana(corpo):
    """Impermeabile-tuta da rana verde brillante a goccia, pancia ovale giallo pastello, stivaletti verdi con le dita palmate."""
    p = P('abt_rana')
    busto(p, corpo, C['erba'], y0=0.72, off=lambda a, y: 0.04 + max(0.0, 1.05 - abs(y - 0.95) * 4) * 0.025, collo_off=0.034)
    veste(p, corpo, C['erba'], y_top=0.76, y_giu=0.56, r_giu=0.25, off=0.05)
    maniche(p, corpo, C['erba'], y_fine=0.82, largo=0.024)
    for s in 'LR':
        polsino(p, corpo, s, C['erba_chiara'], 0.83, off=0.05, alto=0.03)
    pannello(p, corpo, 'busto', C['erba_chiara'], 0.8, 1.18, -38, 38, off=0.078, n=7, piega=lambda y, a: -0.03 * ((abs(a) / 38) ** 2 + ((y - 0.99) / 0.19) ** 2))
    for y in (1.12, 1.0, 0.88):
        pallino(p, corpo, 'busto', C['erba_scura'], y, -50, r=0.014, off=0.07)
    gambe(p, corpo, C['erba_scura'], y_top=0.6, y_fine=0.22, largo=0.01)
    for s in 'LR':
        scarpa(p, corpo, s, C['erba'], suola=C['erba_scura'], alto=0.24, off=0.024)
        cb = corpo.centro('gamba.' + s, 0.012)
        for dx in (-0.045, 0.0, 0.045):
            p.ell((cb[0] + dx, 0.02, cb[1] - 0.17), (0.026, 0.018, 0.04), C['erba_chiara'], corpo.pesi('gamba.' + s), n=8, m=3)
    return [(p, 'abito')]


def bomber(corpo):
    """Giubbotto da aviatore in pelle marrone col collo e il fondo di lana, sciarpa bianca da pilota, borsa postale a tracolla."""
    p = P('abt_bomber')
    busto(p, corpo, C['cuoio'], y0=0.84, off=0.034, collo=False)
    # bordi di lana: collo e fondo, grossi e morbidi
    p.loft([corpo.anello('busto', 0.86, 16, 0.05), corpo.anello('busto', 0.82, 16, 0.062), corpo.anello('busto', 0.79, 16, 0.05)], C['lana'], corpo.pesi('busto'))
    p.loft([corpo.anello(('busto', 'braccio.L', 'braccio.R'), 1.27, 16, 0.07, c=(0, 0.01)), corpo.anello(('busto', 'testa'), 1.33, 16, 0.08, c=(0, 0.01)),
            corpo.anello(('busto', 'testa'), 1.39, 16, 0.05, c=(0, 0.01))], C['lana'], corpo.pesi(('busto', 'testa', 'braccio.L', 'braccio.R')))
    for s in 'LR':
        manica(p, corpo, s, C['cuoio'], y_fine=0.82, largo=0.02)
        polsino(p, corpo, s, C['lana'], 0.82, off=0.05, alto=0.04)
    striscia(p, corpo, C['cuoio_scuro'], [su(corpo, 'busto', 1.28, 0, 0.05), su(corpo, 'busto', 1.0, 0, 0.044), su(corpo, 'busto', 0.86, 0, 0.068)], larga=0.02, spessa=0.01)
    # sciarpa: anello al collo e la coda che scende sul petto
    p.loft([corpo.anello(('busto', 'testa'), 1.4, 14, 0.06, c=(0, 0.01)), corpo.anello(('busto', 'testa'), 1.37, 14, 0.07, c=(0, 0.01))], C['bianco'], corpo.pesi(('busto', 'testa')))
    striscia(p, corpo, C['bianco'], [su(corpo, ('busto', 'testa'), 1.37, -20, 0.08, c=(0, 0.01)), su(corpo, 'busto', 1.22, -18, 0.07), su(corpo, 'busto', 1.06, -24, 0.06)],
             larga=0.06, spessa=0.012)
    striscia(p, corpo, C['rosso'], [su(corpo, 'busto', 1.09, -24, 0.068), su(corpo, 'busto', 1.06, -24, 0.068)], larga=0.062, spessa=0.012)
    # borsa postale: tracolla dalla spalla destra, borsa sul fianco sinistro
    striscia(p, corpo, C['cuoio_scuro'], [su(corpo, ('busto', 'braccio.L', 'braccio.R'), 1.28, 40, 0.07), su(corpo, 'busto', 1.06, 0, 0.074), su(corpo, 'busto', 0.86, -70, 0.09)],
             larga=0.035, spessa=0.01)
    striscia(p, corpo, C['cuoio_scuro'], [su(corpo, ('busto', 'braccio.L', 'braccio.R'), 1.28, 40, 0.07), su(corpo, 'busto', 1.06, 180, 0.06), su(corpo, 'busto', 0.86, -110, 0.09)],
             larga=0.035, spessa=0.01)
    q = su(corpo, 'busto', 0.8, -90, 0.12)
    p.box(q, (0.07, 0.17, 0.22), C['cammello'], corpo.pesi('busto'))
    p.box((q[0] - 0.01, q[1] + 0.05, q[2]), (0.075, 0.08, 0.225), C['cuoio'], corpo.pesi('busto'))
    p.box((q[0] - 0.045, q[1] + 0.03, q[2]), (0.006, 0.03, 0.03), C['ottone'], corpo.pesi('busto'))
    bacino(p, corpo, C['militare'], y_top=0.86)
    gambe(p, corpo, C['militare'], y_fine=0.2, largo=0.02)
    for s in 'LR':
        scarpa(p, corpo, s, C['cuoio_scuro'], suola=C['nero'], alto=0.26, off=0.024)
        risvolto(p, corpo, s, C['lana'], 0.26, alto=0.035, off=0.05)
    return [(p, 'abito')]


def gelataio(corpo):
    """Camicia bianca con le maniche rimboccate, gilet a righe bianche e rosse, papillon rosso, mezzo grembiule con la paletta in tasca."""
    p = P('abt_gelataio')
    busto(p, corpo, C['bianco'], y0=0.84, off=0.02)
    colletto(p, corpo, C['bianco'], y0=1.33, y1=1.37, off=0.032, aperto=40)
    maniche(p, corpo, C['bianco'], y_fine=0.98, largo=0.016)
    for s in 'LR':
        polsino(p, corpo, s, C['bianco'], 0.99, off=0.05, alto=0.04)
    busto(p, corpo, righe_ang(C['rosso'], C['bianco'], 16, cz=0.01), y0=0.86, off=0.034, collo=False, n=16)
    pannello(p, corpo, 'busto', C['bianco'], 1.12, 1.3, -16, 16, off=0.046, n=3)
    bottoni(p, corpo, C['oro'], [1.1, 1.0, 0.92], off=0.044)
    q = su(corpo, ('busto', 'testa'), 1.345, 0, 0.045, c=(0, 0.01))
    for k in (-1, 1):
        p.tube([q, (q[0] + 0.05 * k, q[1] + 0.02, q[2] - 0.004), (q[0] + 0.055 * k, q[1] - 0.02, q[2] - 0.004)], [0.006, 0.026, 0.004], C['rosso'], corpo.pesi('busto'), n=6, res=2,
               sq=3.0)
    p.ell(q, (0.016, 0.016, 0.012), C['rosso'], corpo.pesi('busto'), n=6, m=3)
    grembiule(p, C['bianco'], 0.86, 0.5, 0.215, a=80, giu_largo=0.1)
    cintura(p, corpo, C['bianco'], y=0.86, alto=0.03, off=0.044)
    q = su(corpo, ('busto', 'gamba.L', 'gamba.R'), 0.7, 30, 0.09)
    p.box(q, (0.09, 0.07, 0.012), C['carta'], lambda x: p._w(x, gente_kit.SKIRT()), r=(0, -30, 0))
    p.tube([(q[0], q[1] + 0.02, q[2] - 0.01), (q[0], q[1] + 0.11, q[2] - 0.012)], [0.008, 0.008], C['argento'], lambda x: p._w(x, gente_kit.SKIRT()), n=5, res=1)
    p.ell((q[0], q[1] + 0.13, q[2] - 0.012), (0.022, 0.016, 0.022), C['argento'], lambda x: p._w(x, gente_kit.SKIRT()), n=8, m=3)
    p.ell((q[0], q[1] + 0.145, q[2] - 0.012), (0.024, 0.02, 0.024), C['rosa'], lambda x: p._w(x, gente_kit.SKIRT()), n=8, m=4)
    bacino(p, corpo, C['navy'], y_top=0.86)
    gambe(p, corpo, C['navy'], y_fine=0.12, largo=0.014)
    for s in 'LR':
        scarpa(p, corpo, s, C['nero'], suola=C['bianco'], alto=0.12)
    return [(p, 'abito')]


def frac(corpo):
    """Frac nero corto davanti con le due code lunghe dietro, gilet bordeaux, camicia bianca, catenella d'oro dell'orologio da taschino."""
    p = P('abt_frac')
    busto(p, corpo, C['nero'], y0=0.86, off=0.03, collo_off=0.03)
    pannello(p, corpo, 'busto', C['bianco'], 1.0, 1.3, -24, 24, off=0.04, n=5)
    pannello(p, corpo, 'busto', C['bordeaux'], 0.88, 1.14, -26, 26, off=0.044, n=5)
    for k in (-1, 1):
        striscia(p, corpo, C['roccia'], [su(corpo, ('busto', 'testa'), 1.35, 60 * k, 0.04), su(corpo, 'busto', 1.24, 28 * k, 0.046), su(corpo, 'busto', 1.1, 24 * k, 0.05)],
                 larga=0.05, spessa=0.01, zone=('busto', 'testa'))
    q = su(corpo, ('busto', 'testa'), 1.335, 0, 0.05, c=(0, 0.01))
    for k in (-1, 1):
        p.tube([q, (q[0] + 0.04 * k, q[1] + 0.015, q[2]), (q[0] + 0.045 * k, q[1] - 0.015, q[2])], [0.005, 0.02, 0.004], C['bianco'], corpo.pesi('busto'), n=6, res=2, sq=3.0)
    bottoni(p, corpo, C['oro'], [1.1, 1.02, 0.94], off=0.05, r=0.009)
    catena = [su(corpo, 'busto', 1.02 - 0.06 * math.sin(t * math.pi), 2 + 30 * t, 0.052) for t in [k / 8 for k in range(9)]]
    for c in catena[1:]:
        p.ell(c, (0.006,) * 3, C['oro'], corpo.pesi('busto'), n=6, m=3)
    toppa(p, corpo, 'busto', C['bordeaux'], 0.98, 32, 0.05, 0.012, off=0.05)
    pallino(p, corpo, 'busto', C['oro'], 0.97, 32, r=0.016, off=0.056)
    # code dietro
    for k in (-1, 1):
        rings = []
        for y in quote(0.88, 0.42, 0.06):
            t = (0.88 - y) / 0.46
            rings.append([corpo.punto(('busto', 'gamba.L', 'gamba.R'), max(0.64, y), 180 + k * (10 + 34 * j / 3), 0.05 + 0.04 * t, c=(0, 0.01)) for j in range(4)])
            rings[-1] = [(x, y, z) for x, _y, z in rings[-1]]
        pts = [q for r in rings for q in r]
        m = 4; faces = []
        for i in range(len(rings) - 1):
            faces += [(i * m + j, i * m + j + 1, (i + 1) * m + j + 1, (i + 1) * m + j) for j in range(m - 1)]
        i0 = p._verts(pts, lambda x: p._w(x, gente_kit.SKIRT()))
        p._faces(faces, i0, C['nero'], pts)
    for s in 'LR':
        manica(p, corpo, s, C['nero'], y_fine=0.82, largo=0.012)
        polsino(p, corpo, s, C['bianco'], 0.82, off=0.03, alto=0.025)
    bacino(p, corpo, C['nero'], y_top=0.88)
    gambe(p, corpo, C['nero'], y_fine=0.12, largo=0.012)
    for s in 'LR':
        scarpa(p, corpo, s, C['nero'], suola=C['roccia'], alto=0.12)
        risvolto(p, corpo, s, C['bianco'], 0.135, alto=0.03, off=0.03)                 # ghette
    return [(p, 'abito')]


def cactus(corpo):
    """Costume da cactus nel vaso: busto verde con le spine bianche e due rametti piegati in su, vaso di terracotta da cui escono le gambe."""
    p = P('abt_cactus')
    busto(p, corpo, lambda q: C['bosco'] if int((math.degrees(math.atan2(q[0], -q[2])) % 360) / 22.5) % 2 else C['erba_scura'], y0=0.84, off=0.036, collo_off=0.03)
    maniche(p, corpo, C['erba_scura'], y_fine=0.84, largo=0.014)
    for y in (1.24, 1.12, 1.0, 0.92):
        for a in range(int(y * 100) % 40, 360, 45):
            q = su(corpo, ('busto', 'braccio.L', 'braccio.R') if y > 1.14 else 'busto', y, a, 0.04, c=(0, 0.01) if y > 1.14 else None)
            d = dir_a(a)
            p.tube([q, (q[0] + d[0] * 0.03, q[1] + 0.008, q[2] + d[2] * 0.03)], [0.006, 0.001], C['bianco'], corpo.pesi('busto'), n=4, res=1, caps=('flat', 'flat'))
    for k in (-1, 1):  # rametti piegati a 90°
        b = su(corpo, 'busto', 1.0, 90 * k, 0.03)
        pts = [b, (b[0] + 0.08 * k, b[1], b[2]), (b[0] + 0.12 * k, b[1] + 0.03, b[2]), (b[0] + 0.12 * k, b[1] + 0.16, b[2])]
        p.tube(pts, [0.04, 0.04, 0.038, 0.034], C['erba_scura'], corpo.pesi('busto'), n=8, res=2)
    q = su(corpo, 'busto', 1.22, -30, 0.05)
    for a in range(0, 360, 60):
        p.ell((q[0] + 0.022 * math.cos(math.radians(a)), q[1] + 0.022 * math.sin(math.radians(a)), q[2]), (0.016, 0.016, 0.008), C['fucsia'], corpo.pesi('busto'), n=6, m=2)
    p.ell(q, (0.012, 0.012, 0.01), C['giallo'], corpo.pesi('busto'), n=6, m=2)
    # vaso: cono tronco rovesciato col bordo spesso, ci stanno dentro i fianchi
    vaso = [(0.2, 0.56), (0.25, 0.86), (0.29, 0.87), (0.295, 0.94), (0.26, 0.945), (0.25, 0.9)]
    p.lathe(vaso, C['terracotta'], lambda q: p._w(q, ['Hips']) if q[1] > 0.7 else p._w(q, gente_kit.SKIRT()), n=16, c=(0, 0, 0.01), sz=0.86, caps=False)
    p.lathe([(0.25, 0.9), (0.24, 0.9)], C['cuoio_scuro'], 'Hips', n=16, c=(0, 0, 0.01), sz=0.86, caps=True)
    p.lathe([(0.2, 0.56), (0.0, 0.56)], C['mattone'], lambda q: p._w(q, gente_kit.SKIRT()), n=16, c=(0, 0, 0.01), sz=0.86, caps=False)
    gambe(p, corpo, C['erba_scura'], y_top=0.62, y_fine=0.12, largo=0.012)
    for s in 'LR':
        scarpa(p, corpo, s, C['terracotta'], suola=C['mattone'], alto=0.12)
    return [(p, 'abito')]


def spaziale(corpo):
    """Tuta spaziale anni '60 argento e bombata, anelli blu e rossi ai polsi e in vita, scatola dei comandi sul petto, tubo verso le bombole."""
    p, l = P('abt_spaziale'), P('abt_spaziale_luce')
    busto(p, corpo, C['argento'], y0=0.8, off=0.044, collo_off=0.04)
    for s in 'LR':
        manica(p, corpo, s, C['argento'], y_fine=0.82, largo=lambda y: 0.024 + 0.01 * math.sin(y * 28))
        polsino(p, corpo, s, C['mare'], 0.85, off=0.06, alto=0.025)
        polsino(p, corpo, s, C['rosso'], 0.82, off=0.056, alto=0.025)
        polsino(p, corpo, s, C['bianco'], 0.79, off=0.046, alto=0.03)
    p.loft([corpo.anello(('busto', 'testa'), 1.335, 16, 0.07, c=(0, 0.01)), corpo.anello(('busto', 'testa'), 1.38, 16, 0.07, c=(0, 0.01))], C['argento_scuro'],
           corpo.pesi(('busto', 'testa')))
    cintura(p, corpo, C['mare'], y=0.88, alto=0.03, off=0.064)
    cintura(p, corpo, C['rosso'], y=0.85, alto=0.03, off=0.062)
    q = su(corpo, 'busto', 1.1, 0, 0.09)
    p.box(q, (0.14, 0.11, 0.06), C['bianco'], corpo.pesi('busto'))
    for j, cc in enumerate(('neon_rosso', 'neon_verde')):
        l.ell((q[0] - 0.03 + j * 0.06, q[1] + 0.01, q[2] - 0.032), (0.014, 0.014, 0.008), C[cc], corpo.pesi('busto'), n=8, m=3)
    l.box((q[0], q[1] - 0.03, q[2] - 0.031), (0.08, 0.012, 0.004), C['neon_ciano'], corpo.pesi('busto'))
    z = su(corpo, 'busto', 1.12, 180, 0.13)                                                 # bombole
    for k in (-1, 1):
        p.lathe([(0.0, 0.92), (0.05, 0.93), (0.055, 0.98), (0.055, 1.22), (0.04, 1.27), (0.0, 1.28)], C['bianco'], corpo.pesi('busto'), n=10, c=(0.06 * k, 0, z[2]))
    p.box((0, 1.1, z[2] - 0.02), (0.2, 0.05, 0.06), C['mare'], corpo.pesi('busto'))
    tubo = [(q[0] + 0.06, q[1] - 0.02, q[2]), su(corpo, 'busto', 1.0, 60, 0.1), su(corpo, 'busto', 1.0, 120, 0.11), (0.06, 1.0, z[2] - 0.02)]
    p.tube(tubo, [0.018] * len(tubo), C['nero'], corpo.pesi('busto'), n=6, res=3)
    bacino(p, corpo, C['argento'], y_top=0.84, off=0.044)
    gambe(p, corpo, C['argento'], y_fine=0.22, largo=lambda y: 0.024 + 0.01 * math.sin(y * 24))
    for s in 'LR':
        scarpa(p, corpo, s, C['bianco'], suola=C['argento_scuro'], alto=0.26, off=0.03, gonfia=1.3)
        risvolto(p, corpo, s, C['mare'], 0.26, alto=0.03, off=0.064)
    return [(p, 'abito'), (l, 'luce')]


ABITI = {'hawaiana': hawaiana, 'trench': trench, 'atelier': atelier, 'rana': rana, 'bomber': bomber, 'gelataio': gelataio, 'frac': frac, 'cactus': cactus,
         'spaziale': spaziale}
