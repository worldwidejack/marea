# MAREA — vestiti del Mercante, seconda parte: le ultime coppie coi cappelli di prima (alghe, toga, scafandro) e le prime coppie nuove
# (sottobosco, cucina, pigiama, mecha, apicoltore). Stesse regole di abiti_set_a.py.
import math
from abiti_kit import C, righe, righe_ang, dir_a
from abiti_capi import busto, manica, maniche, bacino, gambe, gamba, scarpa, veste, cintura, bottoni, risvolto, asse_braccio, quote
from abiti_dettagli import pannello, striscia, filo, su, colletto, toppa, pallino
from abiti_set_a import P, polsino, falda


def zigzag(c1, c2, y, alto=0.03, passo=40):
    """Orlo sfrangiato: sotto la quota y i denti alternati (strappi, petali)."""
    def f(q):
        a = math.degrees(math.atan2(q[0], -q[2])) % 360
        dente = alto * abs(((a % passo) / passo) * 2 - 1)
        return c2 if q[1] < y - dente else c1
    return f


def alghe(corpo):
    """Abito da naufrago blu petrolio con l'orlo strappato: alghe ondulate attorno al busto e a un braccio, due tentacoli rossi coi
    succhiatoi che scendono dalla spalla (come quelli del Polpo in testa)."""
    p = P('abt_alghe')
    busto(p, corpo, zigzag(C['petrolio'], C['bosco'], 0.86, 0.05), y0=0.76, off=0.026, collo_off=0.026)
    for s in 'LR':
        manica(p, corpo, s, zigzag(C['petrolio'], C['bosco'], 1.0, 0.04), y_fine=0.94 if s == 'L' else 0.98, largo=0.014)
    bacino(p, corpo, C['bosco'], y_top=0.8)
    gambe(p, corpo, zigzag(C['bosco'], C['petrolio'], 0.42, 0.05), y_fine=0.34, largo=0.018)
    # alghe: strisce verdi ondulate che girano attorno al busto e al braccio destro
    for j, (y0, giri, cc) in enumerate(((1.18, 1.0, 'erba'), (0.98, 0.9, 'erba_scura'))):
        pts = [su(corpo, 'busto', y0 - 0.18 * t + 0.03 * math.sin(t * 14), -60 + 360 * giri * t, 0.044 + 0.006 * j) for t in [k / 12 for k in range(13)]]
        striscia(p, corpo, C[cc], pts, larga=0.045, spessa=0.01)
    pts = []
    for k in range(9):
        y = 1.18 - k * 0.04
        c = asse_braccio(corpo, 'R', y)
        a = k * 70
        pts.append((c[0] + dir_a(a)[0] * 0.07, y, c[1] + dir_a(a)[2] * 0.07))
    striscia(p, corpo, C['erba'], pts, larga=0.04, spessa=0.01, zone=('braccio.R',))
    for k, y in enumerate((0.86, 0.74, 0.6)):  # nastri d'alga che pendono dalla vita
        q = su(corpo, ('busto', 'gamba.L', 'gamba.R'), y + 0.04, 140 + k * 40, 0.04)
        striscia(p, corpo, C['erba_chiara' if k == 1 else 'erba'], [q, (q[0] + 0.02, q[1] - 0.1, q[2] + 0.01), (q[0] - 0.01, q[1] - 0.2, q[2] + 0.02)], larga=0.03, spessa=0.008,
                 zone=('busto', 'gamba.L', 'gamba.R'))
    # tentacoli: escono dalla spalla sinistra e girano sul petto, succhiatoi chiari
    for j, (a0, a1, y1) in enumerate(((-40, 30, 0.96), (-60, -120, 1.0))):
        pts = [su(corpo, ('busto', 'braccio.L', 'braccio.R'), 1.3 - (1.3 - y1) * t, a0 + (a1 - a0) * t, 0.05 + 0.02 * math.sin(t * 3.1)) for t in [k / 6 for k in range(7)]]
        rads = [0.034 * (1 - t * 0.8) for t in [k / 6 for k in range(7)]]
        p.tube(pts, rads, C['rosso'], corpo.pesi(('busto', 'braccio.L')), n=8, res=2, caps=('round', 'round'))
        for k in range(1, 6):
            q = pts[k]
            p.ell((q[0] * 1.0, q[1] - 0.01, q[2] - rads[k] * 0.8), (rads[k] * 0.45,) * 3, C['panna'], corpo.pesi('busto'), n=6, m=3)
    for k in (-1, 1):  # conchiglia e stella marina appiccicate
        q = su(corpo, 'busto', 0.9, 150 * k, 0.05)
    q = su(corpo, 'busto', 1.06, 30, 0.05)
    for a in range(0, 360, 72):
        p.tube([q, (q[0] + 0.04 * math.cos(math.radians(a)), q[1] + 0.04 * math.sin(math.radians(a)), q[2] - 0.005)], [0.012, 0.004], C['arancio'], corpo.pesi('busto'), n=5, res=1)
    return [(p, 'abito')]


def toga(corpo):
    """Toga Imperiale delle Maree: veste lunga fino ai piedi turchese e bianca, cintura d'oro, mantello corto blu reale chiuso da una perla."""
    p = P('abt_toga')
    busto(p, corpo, C['acqua_bassa'], y0=0.84, off=0.026, collo_off=0.026)
    veste(p, corpo, lambda q: C['bianco'] if q[1] < 0.22 else (C['oro'] if q[1] < 0.25 else C['acqua_bassa']), y_top=0.88, y_giu=0.04, r_giu=0.3, off=0.03)
    pannello(p, corpo, 'busto', C['bianco'], 0.88, 1.24, -16, 16, off=0.036, n=3)
    maniche(p, corpo, C['bianco'], y_top=1.12, y_fine=0.96, largo=lambda y: 0.01 + max(0.0, 1.1 - y) * 0.2)
    for s in 'LR':
        polsino(p, corpo, s, C['oro'], 0.96, off=0.06, alto=0.02)
    cintura(p, corpo, C['oro'], y=0.9, alto=0.05, off=0.04, fibbia=(0.07, 0.06), fibbia_col=C['giallo'])
    # mantello: dalle spalle in giù fino ai fianchi, aperto davanti
    rings = []
    zs = ('busto', 'braccio.L', 'braccio.R')
    for y in (1.36, 1.31, 1.25, 1.18):
        zona = ('busto', 'testa') if y > 1.3 else zs
        rings.append([corpo.punto(zona, y, a, 0.05 + 0.03 * (1.36 - y) / 0.18, c=(0, 0.01)) for a in range(25, 336, 26)])
    for y in (1.08, 0.98, 0.9):
        t = (1.18 - y) / 0.28
        rings.append([(q[0] * (1 + 0.12 * t), y, q[2] * (1 + 0.12 * t)) for q in [corpo.punto(zs, 1.18, a, 0.08, c=(0, 0.01)) for a in range(25, 336, 26)]])
    pts = [q for r in rings for q in r]
    m = len(rings[0]); faces = []
    for i in range(len(rings) - 1):
        faces += [(i * m + k, i * m + k + 1, (i + 1) * m + k + 1, (i + 1) * m + k) for k in range(m - 1)]
    i0 = p._verts(pts, corpo.pesi(('busto', 'braccio.L', 'braccio.R')))
    p._faces(faces, i0, lambda q: C['oro'] if q[1] < 0.93 else C['abisso'], pts)
    q = su(corpo, 'busto', 1.24, 0, 0.06)                                                   # la perla con la ghiera d'oro
    p.lathe([(0.0, q[1] - 0.04), (0.045, q[1] - 0.03), (0.05, q[1]), (0.045, q[1] + 0.03), (0.0, q[1] + 0.04)], C['oro'], corpo.pesi('busto'), n=12, c=(q[0], 0, q[2] + 0.01),
            sz=0.4)
    p.ell((q[0], q[1], q[2] - 0.012), (0.034, 0.034, 0.03), C['perla'], corpo.pesi('busto'), n=10, m=5)
    for a in (-30, 30, 180):
        pallino(p, corpo, 'busto', C['perla'], 1.0, a, r=0.012, off=0.05)
    return [(p, 'abito')]


def scafandro(corpo):
    """Scafandro pesante: tuta gonfia color tela grezza, pettorale d'ottone coi bulloni attorno al collo, cintura di piombo, scarponi d'ottone."""
    p = P('abt_scafandro')
    busto(p, corpo, C['sabbia'], y0=0.78, off=0.05, collo_off=0.04)
    for s in 'LR':
        manica(p, corpo, s, C['sabbia'], y_fine=0.82, largo=lambda y: 0.03 + 0.012 * math.sin(y * 30))
        polsino(p, corpo, s, C['ottone'], 0.82, off=0.07, alto=0.05)
        polsino(p, corpo, s, C['cuoio_scuro'], 0.79, off=0.05, alto=0.02)
    bacino(p, corpo, C['sabbia'], y_top=0.82, off=0.05)
    gambe(p, corpo, C['sabbia'], y_fine=0.2, largo=lambda y: 0.03 + 0.012 * math.sin(y * 24))
    # pettorale: anello largo d'ottone sulle spalle, coi bulloni
    rings = [corpo.anello(('busto', 'braccio.L', 'braccio.R'), 1.2, 16, 0.075, c=(0, 0.01)), corpo.anello(('busto', 'testa'), 1.33, 16, 0.08, c=(0, 0.01)),
             corpo.anello(('busto', 'testa'), 1.38, 16, 0.07, c=(0, 0.01))]
    p.loft(rings, C['ottone'], corpo.pesi(('busto', 'testa', 'braccio.L', 'braccio.R')))
    for a in range(0, 360, 30):
        q = su(corpo, ('busto', 'braccio.L', 'braccio.R'), 1.235, a, 0.085, c=(0, 0.01))
        p.lathe([(0.012, q[1] - 0.01), (0.012, q[1] + 0.012), (0.0, q[1] + 0.012)], C['bronzo'], corpo.pesi('busto'), n=6, c=(q[0], 0, q[2]))
    for a in (0, 120, 240):
        q = su(corpo, ('busto', 'testa'), 1.37, a, 0.09, c=(0, 0.01))
        p.ell(q, (0.016, 0.016, 0.016), C['bronzo'], corpo.pesi(('busto', 'testa')), n=6, m=3)
    # cintura di piombo a blocchi
    for a in range(0, 360, 36):
        toppa(p, corpo, 'busto', C['roccia'], 0.86, a, 0.07, 0.07, off=0.075, t=0.04)
    cintura(p, corpo, C['grigio'], y=0.86, alto=0.04, off=0.07)
    for s in 'LR':
        scarpa(p, corpo, s, C['ottone'], suola=C['bronzo'], alto=0.2, off=0.03, gonfia=1.6)
        risvolto(p, corpo, s, C['bronzo'], 0.22, alto=0.04, off=0.07)
    return [(p, 'abito')]


def gnomo(corpo):
    """Tunica verde muschio da cercatore di funghi: colletto a foglie, cintura marrone, borsa a tracolla, pantaloni dentro stivaletti a punta."""
    p = P('abt_gnomo')
    busto(p, corpo, C['erba_scura'], y0=0.8, off=0.028, collo_off=0.026)
    veste(p, corpo, zigzag(C['erba_scura'], C['bosco'], 0.62, 0.05, 45), y_top=0.82, y_giu=0.56, r_giu=0.25, off=0.036)
    maniche(p, corpo, C['erba_scura'], y_fine=0.82, largo=0.016)
    for s in 'LR':
        polsino(p, corpo, s, C['erba'], 0.83, off=0.036, alto=0.03)
    # colletto a foglie: spicchi che si aprono attorno al collo
    for a in range(0, 360, 36):
        b = su(corpo, ('busto', 'testa'), 1.335, a, 0.03, c=(0, 0.01))
        t = su(corpo, ('busto', 'braccio.L', 'braccio.R'), 1.27, a, 0.09, c=(0, 0.01))
        p.tube([b, ((b[0] + t[0]) / 2, (b[1] + t[1]) / 2 + 0.01, (b[2] + t[2]) / 2), t], [(0.012, 0.004), (0.034, 0.006), (0.004, 0.003)], C['erba'] if a % 72 else C['erba_chiara'],
               corpo.pesi(('busto', 'testa')), n=4, res=2, caps=('flat', 'flat'), sq=4.0)
    cintura(p, corpo, C['cuoio'], y=0.86, alto=0.04, off=0.046, fibbia=(0.05, 0.045), fibbia_col=C['ottone'])
    striscia(p, corpo, C['cuoio'], [su(corpo, ('busto', 'braccio.L', 'braccio.R'), 1.28, 40, 0.05), su(corpo, 'busto', 1.1, 0, 0.044), su(corpo, 'busto', 0.94, -60, 0.05)],
             larga=0.03, spessa=0.008)
    striscia(p, corpo, C['cuoio'], [su(corpo, ('busto', 'braccio.L', 'braccio.R'), 1.28, 40, 0.05), su(corpo, 'busto', 1.1, 180, 0.044), su(corpo, 'busto', 0.94, -120, 0.05)],
             larga=0.03, spessa=0.008)
    q = su(corpo, 'busto', 0.86, -90, 0.11)
    p.ell(q, (0.05, 0.065, 0.08), C['cammello'], corpo.pesi('busto'), n=10, m=5)            # borsa
    p.ell((q[0] - 0.01, q[1] + 0.03, q[2]), (0.048, 0.03, 0.078), C['cuoio'], corpo.pesi('busto'), n=10, m=3, cut=(0.0, 1.0))
    p.ell((q[0] - 0.05, q[1] + 0.06, q[2] - 0.02), (0.022, 0.012, 0.022), C['rosso'], corpo.pesi('busto'), n=8, m=3)  # un funghetto che spunta
    gambe(p, corpo, C['cuoio_scuro'], y_top=0.6, y_fine=0.2, largo=0.01)
    for s in 'LR':
        scarpa(p, corpo, s, C['cuoio'], suola=C['cuoio_scuro'], alto=0.24, off=0.02, punta=0.06)
        risvolto(p, corpo, s, C['cammello'], 0.24, alto=0.04, off=0.05)
    return [(p, 'abito')]


def cuoco(corpo):
    """Casacca da cuoco bianca doppiopetto coi bottoni neri, fazzoletto rosso al collo, grembiule bianco con la macchia di sugo, pantaloni a quadretti."""
    p = P('abt_cuoco')
    busto(p, corpo, C['bianco'], y0=0.8, off=0.028, collo=False)
    colletto(p, corpo, C['bianco'], y0=1.31, y1=1.37, off=0.034)
    pannello(p, corpo, 'busto', C['carta'], 0.82, 1.26, -10, 32, off=0.038, n=5)
    for y in (1.2, 1.08, 0.96):
        for a in (-22, 26):
            pallino(p, corpo, 'busto', C['nero'], y, a, r=0.012, off=0.046)
    for s in 'LR':
        manica(p, corpo, s, C['bianco'], y_fine=0.88, largo=0.016)
        polsino(p, corpo, s, C['carta'], 0.9, off=0.044, alto=0.05)
    # fazzoletto rosso: anello al collo e la punta davanti
    p.loft([corpo.anello(('busto', 'testa'), 1.375, 14, 0.04, c=(0, 0.01)), corpo.anello(('busto', 'testa'), 1.355, 14, 0.044, c=(0, 0.01))], C['rosso'], corpo.pesi(('busto', 'testa')))
    q = su(corpo, ('busto', 'testa'), 1.35, 0, 0.05, c=(0, 0.01))
    p.tube([q, (q[0], q[1] - 0.05, q[2] - 0.01)], [(0.035, 0.01), (0.004, 0.004)], C['rosso'], corpo.pesi('busto'), n=4, res=1, caps=('flat', 'flat'), sq=6.0)
    bacino(p, corpo, righe_ang(C['roccia'], C['grigio'], 16, cz=0.01), y_top=0.8)
    for s in 'LR':
        c = corpo.centro('gamba.' + s, 0.4)
        gamba(p, corpo, s, righe_ang(C['roccia'], C['grigio'], 10, cx=c[0], cz=c[1]), y_fine=0.12, largo=0.018)
    # grembiule: dal fianco al ginocchio, davanti
    rings = []
    for y in quote(0.9, 0.42, 0.06):
        r = 0.2 + (0.9 - y) * 0.12
        rings.append([(dir_a(a)[0] * r, y, 0.0 + dir_a(a)[2] * (r * 0.75)) for a in range(-80, 81, 20)])
    pts = [q for r in rings for q in r]
    m = len(rings[0]); faces = []
    for i in range(len(rings) - 1):
        faces += [(i * m + k, i * m + k + 1, (i + 1) * m + k + 1, (i + 1) * m + k) for k in range(m - 1)]
    import gente_kit
    i0 = p._verts(pts, lambda q: p._w(q, gente_kit.SKIRT()))
    p._faces(faces, i0, lambda q: C['rosso'] if (q[0] - 0.08) ** 2 + (q[1] - 0.6) ** 2 < 0.0022 else C['bianco'], pts)
    cintura(p, corpo, C['bianco'], y=0.9, alto=0.03, off=0.04)
    for k in (-1, 1):  # lacci dietro
        filo(p, corpo, C['bianco'], [su(corpo, 'busto', 0.9, 180, 0.05), (0.04 * k, 0.8, su(corpo, 'busto', 0.9, 180, 0.05)[2] + 0.01)], r=0.008)
    for s in 'LR':
        scarpa(p, corpo, s, C['nero'], suola=C['roccia'], alto=0.12)
    return [(p, 'abito')]


def pigiama(corpo):
    """Pigiamone intero a righe verticali azzurre e bianche, tre bottoni bianchi, pantofole a coniglio rosa con le orecchie."""
    p = P('abt_pigiama')
    r = righe_ang(C['celeste'], C['bianco'], 16, cz=0.01)  # una riga per colonna di facce (16 per giro): niente quadretti rotti
    busto(p, corpo, r, y0=0.8, off=0.034, collo_off=0.03, n=16)
    colletto(p, corpo, C['celeste'], y0=1.32, y1=1.36, off=0.04, svasa=0.02, aperto=60)
    for s in 'LR':
        manica(p, corpo, s, C['celeste'], y_fine=0.8, largo=0.022)
        polsino(p, corpo, s, C['celeste'], 0.81, off=0.046, alto=0.03)
    for y in (1.2, 1.08, 0.96):
        pallino(p, corpo, 'busto', C['bianco'], y, 0, r=0.016, off=0.05)
    toppa(p, corpo, 'busto', C['celeste'], 1.14, -34, 0.08, 0.07, off=0.046)
    bacino(p, corpo, r, y_top=0.82, off=0.034)
    for s in 'LR':
        c = corpo.centro('gamba.' + s, 0.4)
        gamba(p, corpo, s, righe_ang(C['celeste'], C['bianco'], 10, cx=c[0], cz=c[1]), y_fine=0.14, largo=0.02)
        risvolto(p, corpo, s, C['celeste'], 0.15, alto=0.03, off=0.04)
        # pantofola a coniglio
        cb = corpo.centro('gamba.' + s, 0.012)
        p.ell((cb[0], 0.055, cb[1] - 0.01), (0.1, 0.07, 0.16), C['rosa_chiaro'], corpo.pesi('gamba.' + s), n=12, m=6, cut=(-0.8, 1.0))
        p.ell((cb[0], 0.005, cb[1] - 0.01), (0.1, 0.012, 0.16), C['rosa'], corpo.pesi('gamba.' + s), n=12, m=2)
        for k in (-1, 1):
            b = (cb[0] + 0.035 * k, 0.1, cb[1] - 0.09)
            p.tube([b, (b[0] + 0.015 * k, 0.17, b[2] + 0.02), (b[0] + 0.02 * k, 0.22, b[2] + 0.05)], [(0.022, 0.01), (0.026, 0.01), (0.012, 0.008)], C['rosa_chiaro'],
                   corpo.pesi('gamba.' + s), n=6, res=2, sq=3.0)
            p.ell((b[0] + 0.012 * k, 0.16, b[2] + 0.012), (0.012, 0.035, 0.004), C['rosa'], corpo.pesi('gamba.' + s), n=6, m=3)
        for k in (-1, 1):
            p.ell((cb[0] + 0.035 * k, 0.09, cb[1] - 0.15), (0.012, 0.012, 0.008), C['nero'], corpo.pesi('gamba.' + s), n=6, m=3)
        p.ell((cb[0], 0.075, cb[1] - 0.17), (0.014, 0.01, 0.01), C['fucsia'], corpo.pesi('gamba.' + s), n=6, m=3)
    return [(p, 'abito')]


def mecha(corpo):
    """Corazza Mecha Arcade: busto a scatola beige con la plancia (tre bottoni, contatore verde acceso), tubi corrugati su braccia e gambe."""
    p, l = P('abt_mecha'), P('abt_mecha_luce')
    busto(p, corpo, C['perla'], y0=0.8, off=lambda a, y: 0.05 + 0.03 * abs(math.sin(math.radians(a * 2))) ** 0.5, collo_off=0.03, n=8)
    pannello(p, corpo, 'busto', C['pietra'], 0.98, 1.22, -32, 32, off=0.098, n=4)
    for j, (cc, a) in enumerate((('rosso', -18), ('giallo', 0), ('mare', 18))):
        q = su(corpo, 'busto', 1.15, a, 0.104)
        p.lathe([(0.017, q[1] - 0.012), (0.017, q[1] + 0.012)], C[cc], corpo.pesi('busto'), n=8, c=(q[0], 0, q[2] - 0.012))
    toppa(p, corpo, 'busto', C['nero'], 1.05, 0, 0.12, 0.05, off=0.104)
    for j in range(4):
        toppa(l, corpo, 'busto', C['neon_verde'], 1.05, -12 + j * 8, 0.02, 0.028, off=0.112, t=0.006)
    toppa(p, corpo, 'busto', C['pietra'], 1.1, 180, 0.22, 0.26, off=0.09, t=0.05)            # zaino batteria
    toppa(l, corpo, 'busto', C['neon_ambra'], 1.18, 180, 0.12, 0.02, off=0.12, t=0.006)
    corrugato = lambda q: C['roccia'] if int(q[1] / 0.02) % 2 else C['grigio']
    for s in 'LR':
        manica(p, corpo, s, corrugato, y_fine=0.82, largo=lambda y: 0.012 + 0.006 * (int(y / 0.02) % 2), passo=0.02)
        polsino(p, corpo, s, C['perla'], 0.82, off=0.05, alto=0.05)
        k = -1 if s == 'L' else 1
        p.box((0.21 * k, 1.27, 0.01), (0.12, 0.06, 0.13), C['perla'], corpo.pesi(('braccio.' + s, 'busto')), r=(0, 0, -18 * k))
    bacino(p, corpo, C['pietra'], y_top=0.82, off=0.04)
    gambe(p, corpo, corrugato, y_top=0.62, y_fine=0.24, largo=lambda y: 0.014 + 0.006 * (int(y / 0.02) % 2), passo=0.02)
    for s in 'LR':
        scarpa(p, corpo, s, C['perla'], suola=C['roccia'], alto=0.24, off=0.03, gonfia=1.3)
        risvolto(p, corpo, s, C['rosso'], 0.24, alto=0.03, off=0.06)
    return [(p, 'abito'), (l, 'luce')]


def apicoltore(corpo):
    """Tuta bianca gonfia da apicoltore, guantoni e stivali gialli, vasetto di miele alla cintura."""
    p, v = P('abt_apicoltore'), P('abt_apicoltore_vetro')
    busto(p, corpo, C['lana'], y0=0.8, off=0.044, collo_off=0.034)
    for s in 'LR':
        manica(p, corpo, s, C['lana'], y_fine=0.86, largo=lambda y: 0.026 + 0.01 * math.sin(y * 26))
        # guantone giallo: dal polso giù fino a coprire la mano
        c = asse_braccio(corpo, s, 0.82)
        rr = [corpo.anello('braccio.' + s, y, 10, 0.03 + (0.012 if y > 0.83 else 0.0), c=asse_braccio(corpo, s, y)) for y in (0.9, 0.86, 0.82, 0.79, 0.76)]
        rr.append([(q[0], 0.74, q[2]) for q in corpo.anello('braccio.' + s, 0.765, 10, 0.02, c=asse_braccio(corpo, s, 0.765))])
        p.loft(rr, C['giallo'], corpo.pesi('braccio.' + s), top=True)
    bacino(p, corpo, C['lana'], y_top=0.82, off=0.044)
    gambe(p, corpo, C['lana'], y_fine=0.24, largo=lambda y: 0.026 + 0.01 * math.sin(y * 22))
    colletto(p, corpo, C['lana'], y0=1.31, y1=1.38, off=0.05)
    striscia(p, corpo, C['pietra'], [su(corpo, ('busto', 'testa'), 1.36, 0, 0.06), su(corpo, 'busto', 1.1, 0, 0.064), su(corpo, 'busto', 0.86, 0, 0.066)], larga=0.03, spessa=0.01)
    cintura(p, corpo, C['pietra'], y=0.86, alto=0.035, off=0.066)
    q = su(corpo, 'busto', 0.82, 70, 0.11)
    v.lathe([(0.0, q[1] - 0.05), (0.04, q[1] - 0.048), (0.042, q[1] + 0.03), (0.034, q[1] + 0.04), (0.0, q[1] + 0.04)], C['arancio'], corpo.pesi('busto'), n=10, c=(q[0], 0, q[2]))
    p.lathe([(0.0, q[1] - 0.025), (0.03, q[1] - 0.025), (0.032, q[1] + 0.02), (0.0, q[1] + 0.02)], C['neon_ambra'], corpo.pesi('busto'), n=10, c=(q[0], 0, q[2]))  # il miele
    p.lathe([(0.036, q[1] + 0.04), (0.04, q[1] + 0.045), (0.04, q[1] + 0.065), (0.0, q[1] + 0.065)], C['cuoio'], corpo.pesi('busto'), n=10, c=(q[0], 0, q[2]))
    for s in 'LR':
        scarpa(p, corpo, s, C['giallo'], suola=C['arancio'], alto=0.28, off=0.028, gonfia=1.2)
        risvolto(p, corpo, s, C['giallo'], 0.28, alto=0.04, off=0.06)
    toppa(p, corpo, 'busto', C['giallo'], 1.14, -30, 0.06, 0.06, off=0.064)               # toppa con l'ape
    toppa(p, corpo, 'busto', C['nero'], 1.14, -30, 0.06, 0.012, off=0.072, t=0.006)
    return [(p, 'abito'), (v, 'vetro')]


ABITI = {'alghe': alghe, 'toga': toga, 'scafandro': scafandro, 'gnomo': gnomo, 'cuoco': cuoco, 'pigiama': pigiama, 'mecha': mecha, 'apicoltore': apicoltore}
