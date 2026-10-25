# MAREA — i cappelli che c'erano già (paglia, berretto, pescatore… casco), rifatti nello stile dei vestiti del Mercante: prima erano scatole
# in codice (game/avatar_cappelli.ts, che resta per i copricapi degli eroi e come ripiego senza manifest). Stessi id e prezzi di avatar.json.
import math
from abiti_kit import C, dir_a
from abiti_dettagli import tornito, tesa, a_testa
from abiti_cappelli import P, H, cupola, sfera_su


def anello(p, y, r, spess, col, sz=1.0, n=14, c=(0.0, 0.0)):
    pts = [(c[0] + r * dir_a(a)[0], y, c[1] + r * sz * dir_a(a)[2]) for a in range(0, 361, 360 // n)]
    p.tube(pts, [spess] * len(pts), col, H, n=6, res=1, caps=(None, None))


def paglia(corpo):
    """Cappello di paglia a tesa larga col nastro rosso, intreccio a giri chiari e scuri."""
    p = P('cap_paglia')
    tornito(p, [(0.172, 1.55), (0.17, 1.64), (0.15, 1.685), (0.0, 1.69)], lambda q: C['rosso'] if q[1] < 1.585 else (C['sabbia'] if int(q[1] / 0.02) % 2 else C['panna']), n=16, caps=False)
    tesa(p, C['panna'], 1.56, 0.165, 0.33, piega=-0.012, col_sotto=C['cammello'])
    tornito(p, [(0.176, 1.565), (0.176, 1.6)], C['rosso'], n=16, caps=False)
    anello(p, 1.56, 0.33, 0.008, C['sabbia'], n=20)
    return [(p, 'abito')]


def berretto(corpo):
    """Berretto blu con la visiera, il bottone in cima e gli spicchi cuciti."""
    p = P('cap_berretto')
    cupola(p, (0.0, 1.55, 0.005), (0.18, 0.15, 0.188), lambda q: C['mare'] if int((math.degrees(math.atan2(q[0], -q[2])) % 360) / 60) % 2 else C['denim'], e0=0, e1=90, n=18, m=6)
    p.ell((0.0, 1.553, -0.2), (0.15, 0.012, 0.11), C['abisso'], H, n=14, m=2, cut=(-1.0, 1.0))
    p.ell((0.0, 1.703, 0.005), (0.022, 0.014, 0.022), C['abisso'], H, n=8, m=3)
    anello(p, 1.56, 0.18, 0.012, C['abisso'], sz=1.04)
    return [(p, 'abito')]


def pescatore(corpo):
    """Cappello da pescatore di tela grigia, tesa morbida in giù, cucitura e un'esca colorata appuntata."""
    p = P('cap_pescatore')
    tornito(p, [(0.175, 1.55), (0.165, 1.66), (0.14, 1.7), (0.0, 1.705)], lambda q: C['grigio'] if 1.6 < q[1] < 1.62 else C['pietra'], n=16, caps=False)
    tesa(p, C['pietra'], 1.56, 0.17, 0.27, piega=-0.04, col_sotto=C['grigio'])
    q = a_testa(1.62, 50, 0.17)
    p.tube([q, (q[0] + 0.02, q[1] + 0.03, q[2] - 0.01)], [0.012, 0.004], C['rosso'], H, n=5, res=1)
    p.ell((q[0] + 0.004, q[1] - 0.008, q[2]), (0.012, 0.016, 0.012), C['giallo'], H, n=6, m=3)
    return [(p, 'abito')]


def lanterna(corpo):
    """Lanterna in testa: fascia di cuoio, lanterna rossa con la gabbia di ferro, il lume acceso dentro e il manico ad anello."""
    p, l = P('cap_lanterna'), P('cap_lanterna_luce')
    anello(p, 1.58, 0.172, 0.018, C['cuoio'])
    for a in (0, 90):  # cinghie incrociate sopra la testa fino alla base della lanterna
        arco = [a_testa(1.58 + 0.1 * math.sin(math.radians(t)), a + (180 if t > 90 else 0), 0.172 * abs(math.cos(math.radians(t))) + 0.02) for t in range(0, 181, 30)]
        p.tube(arco, [(0.022, 0.006)] * len(arco), C['cuoio'], H, n=4, res=2, caps=('flat', 'flat'), sq=6.0)
    tornito(p, [(0.05, 1.66), (0.05, 1.68), (0.0, 1.68)], C['cuoio_scuro'], n=10)
    tornito(p, [(0.0, 1.68), (0.07, 1.68), (0.075, 1.7), (0.075, 1.705)], C['roccia'], n=8)
    l.lathe([(0.0, 1.705), (0.055, 1.71), (0.06, 1.78), (0.0, 1.785)], C['neon_ambra'], H, n=8)
    for a in range(45, 360, 90):
        q = a_testa(0, a, 0.07)
        p.box((q[0], 1.745, q[2]), (0.014, 0.08, 0.014), C['rosso'], H)
    tornito(p, [(0.075, 1.785), (0.08, 1.8), (0.03, 1.83), (0.0, 1.83)], C['rosso'], n=8)
    arco = [(0.0, 1.83 + 0.04 * math.sin(math.radians(t)), 0.04 * math.cos(math.radians(t))) for t in range(0, 181, 30)]
    p.tube(arco, [0.007] * len(arco), C['roccia'], H, n=5, res=1, caps=(None, None))
    return [(p, 'abito'), (l, 'luce')]


def neon(corpo):
    """Visiera neon: fascia viola e visiera trasparente rosa che si accende."""
    p, l = P('cap_neon'), P('cap_neon_luce')
    anello(p, 1.555, 0.175, 0.016, C['viola'], sz=1.05)
    pts = [a_testa(1.53, a, 0.185) for a in range(-80, 81, 20)]
    l.tube(pts, [(0.05, 0.006)] * len(pts), C['neon_rosa'], H, n=4, res=2, caps=('flat', 'flat'), sq=6.0, ref=(0, 1, 0))
    for k in (-1, 1):
        p.ell(a_testa(1.555, 90 * k, 0.185), (0.015, 0.03, 0.03), C['neon_viola'], H, n=8, m=3)
    return [(p, 'abito'), (l, 'luce')]


def kasa(corpo):
    """Cappello a cono di paglia intrecciata, largo e basso, col cordino sotto il mento."""
    p = P('cap_kasa')
    tornito(p, [(0.36, 1.57), (0.3, 1.6), (0.18, 1.67), (0.06, 1.73), (0.0, 1.745)], lambda q: C['sabbia'] if int(math.hypot(q[0], q[2]) / 0.045) % 2 else C['cammello'], n=20)
    tornito(p, [(0.0, 1.565), (0.36, 1.57)], C['cammello'], n=20, caps=False)
    for k in (-1, 1):
        p.tube([a_testa(1.565, 90 * k, 0.16), a_testa(1.45, 90 * k, 0.13), (0.0, 1.38, -0.09)], [0.005] * 3, C['bordeaux'], H, n=4, res=2)
    return [(p, 'abito')]


def capitano(corpo):
    """Berretto da capitano: calotta bianca ampia, fascia nera, visiera lucida, ancora d'oro e cordone dorato."""
    p = P('cap_capitano')
    tornito(p, [(0.172, 1.55), (0.175, 1.62), (0.215, 1.67), (0.21, 1.69), (0.0, 1.695)], lambda q: C['nero'] if q[1] < 1.605 else C['bianco'], n=18, caps=False, c=(0.0, 0.01))
    p.ell((0.0, 1.56, -0.19), (0.16, 0.012, 0.1), C['nero'], H, n=14, m=2)
    anello(p, 1.612, 0.178, 0.008, C['oro'], sz=1.02)
    q = a_testa(1.585, 0, 0.18)
    p.box((q[0], q[1] + 0.005, q[2]), (0.012, 0.045, 0.01), C['oro'], H)
    p.box((q[0], q[1] - 0.012, q[2]), (0.04, 0.01, 0.01), C['oro'], H)
    p.box((q[0], q[1] + 0.022, q[2]), (0.026, 0.008, 0.01), C['oro'], H)
    return [(p, 'abito')]


def pirata(corpo):
    """Tricorno pirata nero con le tre falde alzate bordate d'oro e il teschio bianco davanti."""
    p = P('cap_pirata')
    tornito(p, [(0.172, 1.55), (0.168, 1.64), (0.14, 1.69), (0.0, 1.7)], C['nero'], n=16, caps=False)
    for a in (0, 120, 240):
        pts = [a_testa(1.56 + 0.07 * math.sin(math.radians(abs(t - a) * 1.5 + 0.01)), t, 0.26) for t in range(a - 60, a + 61, 15)]
        p.tube(pts, [(0.012, 0.06)] * len(pts), C['nero'], H, n=4, res=1, caps=('flat', 'flat'), sq=6.0, ref=(0, 1, 0))
    tesa(p, C['nero'], 1.56, 0.165, 0.26, spess=0.01)
    anello(p, 1.567, 0.262, 0.008, C['oro'], n=18)
    q = a_testa(1.62, 0, 0.17)
    p.ell(q, (0.03, 0.03, 0.01), C['bianco'], H, n=8, m=3)
    for k in (-1, 1):
        p.box((q[0] + 0.012 * k, q[1] + 0.005, q[2] - 0.009), (0.008, 0.008, 0.004), C['nero'], H)
    p.box((q[0], q[1] - 0.04, q[2]), (0.06, 0.012, 0.008), C['bianco'], H, r=(0, 0, 30))
    p.box((q[0], q[1] - 0.04, q[2]), (0.06, 0.012, 0.008), C['bianco'], H, r=(0, 0, -30))
    return [(p, 'abito')]


def polpo(corpo):
    """Polpo in testa: testone rosso a goccia con gli occhi, i tentacoli che scendono attorno alla testa coi succhiatoi chiari."""
    p = P('cap_polpo')
    p.ell((0.0, 1.7, 0.03), (0.17, 0.17, 0.18), C['rosso'], H, n=16, m=8, cut=(-0.5, 1.0))
    for k in (-1, 1):
        p.ell((0.07 * k, 1.66, -0.13), (0.04, 0.045, 0.03), C['panna'], H, n=8, m=4)
        p.ell((0.072 * k, 1.66, -0.155), (0.018, 0.025, 0.012), C['nero'], H, n=6, m=3)
    for j in range(8):
        a = 22.5 + j * 45
        if abs(((a + 180) % 360) - 180) < 30:
            continue
        pts = [a_testa(1.62 - 0.07 * t, a + 10 * math.sin(t * 3), 0.17 + 0.04 * math.sin(t * 2.6)) for t in [k / 4 for k in range(5)]]
        pts.append((pts[-1][0] * 1.25, pts[-1][1] + 0.02, pts[-1][2] * 1.25))
        p.tube(pts, [0.04, 0.034, 0.028, 0.02, 0.014, 0.008], C['rosso'], H, n=6, res=1)
        for q in pts[1:3]:
            p.ell((q[0] * 0.93, q[1], q[2] * 0.93), (0.01, 0.01, 0.01), C['rosa_chiaro'], H, n=6, m=3)
    return [(p, 'abito')]


def corona(corpo):
    """Corona di perle: fascia d'oro con le punte, perle in cima, gemme turchesi e rosse."""
    p = P('cap_corona')
    tornito(p, [(0.175, 1.56), (0.178, 1.62)], C['oro'], n=16, caps=False)
    for k in range(8):
        a = k * 45
        b = a_testa(1.62, a, 0.178)
        p.tube([b, a_testa(1.69 if k % 2 == 0 else 1.66, a, 0.185)], [(0.03, 0.008), (0.006, 0.006)], C['oro'], H, n=4, res=1, caps=('flat', 'flat'), sq=4.0)
        p.ell(a_testa(1.7 if k % 2 == 0 else 1.668, a, 0.186), (0.016, 0.016, 0.016), C['perla'], H, n=8, m=4)
        p.ell(a_testa(1.59, a + 22.5, 0.182), (0.012, 0.016, 0.008), C['acqua'] if k % 2 else C['rosso'], H, n=6, m=3)
    anello(p, 1.56, 0.18, 0.01, C['ottone'])
    return [(p, 'abito')]


def palombaro(corpo):
    """Elmo da palombaro d'ottone che chiude tutta la testa: oblò davanti e ai lati col vetro, bulloni, colletto di rame."""
    p, v = P('cap_palombaro'), P('cap_palombaro_vetro')
    p.ell((0.0, 1.53, 0.0), (0.24, 0.24, 0.24), C['ottone'], H, n=18, m=9, cut=(-0.62, 1.0))
    yb = 1.53 - 0.24 * 0.62
    tornito(p, [(0.21, yb - 0.04), (0.23, yb - 0.02), (0.23, yb + 0.02), (0.18, yb + 0.03)], C['bronzo'], n=18, caps=False)
    for a, r in ((0, 0.085), (90, 0.05), (-90, 0.05)):
        q = a_testa(1.52, a, 0.236)
        d = dir_a(a)
        u = (math.cos(math.radians(a)), 0.0, math.sin(math.radians(a)))
        cerchio = [(q[0] + u[0] * r * math.cos(math.radians(t)), 1.52 + r * math.sin(math.radians(t)), q[2] + u[2] * r * math.cos(math.radians(t))) for t in range(0, 361, 30)]
        p.tube(cerchio, [0.014] * len(cerchio), C['bronzo'], H, n=6, res=1, caps=(None, None))
        v.ell((q[0] + d[0] * 0.012, 1.52, q[2] + d[2] * 0.012), (max(0.008, r * abs(d[2])), r, max(0.008, r * abs(d[0]))), C['acqua_bassa'], H, n=12, m=4)
    for a in range(20, 360, 40):
        p.ell(a_testa(yb + 0.035, a, 0.2), (0.012, 0.012, 0.012), C['bronzo'], H, n=6, m=3)
    p.lathe([(0.03, 1.765), (0.03, 1.79), (0.0, 1.79)], C['bronzo'], H, n=8)
    return [(p, 'abito'), (v, 'vetro')]


def casco(corpo):
    """Casco arancione da motocross con la striscia bianca e la visiera scura, mentoniera sporgente."""
    p, v = P('cap_casco'), P('cap_casco_vetro')
    cupola(p, (0.0, 1.52, 0.01), (0.215, 0.215, 0.225), C['arancio'], e0=-48, e1=90, n=16, m=8,
           finestra=lambda a, e: abs(a) < 55 and -25 < e < 20)
    striscia = [(0.0, 1.52 + 0.222 * math.sin(math.radians(t)), 0.01 - 0.232 * math.cos(math.radians(t))) for t in range(25, 181, 22)]
    p.tube(striscia, [(0.03, 0.006)] * len(striscia), C['bianco'], H, n=4, res=1, caps=('flat', 'flat'), sq=6.0, ref=(1, 0, 0))
    v.ell((0.0, 1.5, -0.04), (0.17, 0.09, 0.2), C['nero'], H, n=14, m=4, cut=(-0.6, 0.9))
    p.ell((0.0, 1.39, -0.15), (0.12, 0.05, 0.08), C['arancio'], H, n=10, m=4)
    p.ell((0.0, 1.66, -0.2), (0.12, 0.012, 0.08), C['arancio'], H, n=10, m=2)
    return [(p, 'abito'), (v, 'vetro')]


CAPPELLI = {'paglia': paglia, 'berretto': berretto, 'pescatore': pescatore, 'lanterna': lanterna, 'neon': neon, 'kasa': kasa, 'capitano': capitano,
            'pirata': pirata, 'polpo': polpo, 'corona': corona, 'palombaro': palombaro, 'casco': casco}
