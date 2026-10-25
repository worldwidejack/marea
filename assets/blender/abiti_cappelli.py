# MAREA — i cappelli nuovi del Mercante (`cap_<id>`, avatar.json `cappelli`): uno per ogni coppia nuova di docs (sottobosco, cucina…).
# Pesati tutti sull'osso Head; coordinate di gioco con la testa del chr_base a riposo: fascia a 1,555 m, raggio dei capelli ~0,17,
# cima dei capelli a 1,68. Il client nasconde i capelli coperti dal cappello (non quelli sotto il vetro della bolla).
import math
import models_chr
from abiti_kit import Pezzo, C, dir_a
from abiti_dettagli import tornito, tesa, a_testa, FASCIA, R_FASCIA

H = 'Head'


def P(nome):
    return Pezzo(nome, models_chr.BONES)


def cupola(p, c, r, col, e0=-30, e1=90, n=16, m=7, finestra=None):
    """Calotta di ellissoide (centro c, raggi r) dall'elevazione e0 a e1 (gradi); finestra(a, e) = True → lì niente faccia (il viso)."""
    rows = []
    for j in range(m + 1):
        e = math.radians(e0 + (e1 - e0) * j / m)
        rows.append([(c[0] + r[0] * math.cos(e) * dir_a(360 * k / n)[0], c[1] + r[1] * math.sin(e), c[2] + r[2] * math.cos(e) * dir_a(360 * k / n)[2]) for k in range(n)])
    pts = [q for row in rows for q in row]
    faces = []
    for j in range(m):
        for k in range(n):
            a = (360 * (k + 0.5) / n + 180) % 360 - 180
            e = e0 + (e1 - e0) * (j + 0.5) / m
            if finestra and finestra(a, e):
                continue
            faces.append((j * n + k, j * n + (k + 1) % n, (j + 1) * n + (k + 1) % n, (j + 1) * n + k))
    i0 = p._verts(pts, H)
    p._faces(faces, i0, col, pts)


def sfera_su(p, c, r, e, a, rr, col, schiaccia=0.45):
    """Pallino appoggiato sull'ellissoide (c, r) all'elevazione e, azimut a."""
    er, d = math.radians(e), dir_a(a)
    q = (c[0] + r[0] * math.cos(er) * d[0], c[1] + r[1] * math.sin(er), c[2] + r[2] * math.cos(er) * d[2])
    p.ell(q, (rr, rr * schiaccia + rr * (1 - schiaccia) * math.cos(er), rr), col, H, n=8, m=3)


def fungo(corpo):
    """Cappello Fungo (Amanita): cupola larga rosso acceso coi puntini bianchi in rilievo, gambo beige che poggia sulla testa."""
    p = P('cap_fungo')
    tornito(p, [(0.17, 1.53), (0.165, 1.6), (0.15, 1.66)], C['panna'], caps=False)
    tornito(p, [(0.0, 1.635), (0.3, 1.64), (0.31, 1.65)], C['carta'], n=20)
    c, r = (0.0, 1.645, 0.0), (0.31, 0.17, 0.31)
    cupola(p, c, r, C['rosso'], e0=0, e1=90, n=20, m=6)
    for e, a in ((70, 0), (40, 30), (35, -50), (50, 110), (30, 160), (55, -140), (25, 80), (20, -95), (25, -10), (45, 200), (80, 140)):
        sfera_su(p, c, r, e, a, 0.035 if e < 60 else 0.04, C['bianco'])
    return [(p, 'abito')]


def toque(corpo):
    """Toque da chef: cilindro bianco rigido che in cima si allarga in una corona di sbuffi."""
    p = P('cap_toque')
    tornito(p, [(0.172, 1.53), (0.174, 1.62), (0.18, 1.69)], lambda q: C['perla'] if q[1] < 1.55 else C['bianco'], caps=False, n=16)
    for k in range(8):
        a = 360 * k / 8
        d = dir_a(a)
        p.ell((d[0] * 0.115, 1.75, d[2] * 0.115), (0.085, 0.07, 0.085), C['bianco'], H, n=10, m=5)
    p.ell((0.0, 1.78, 0.0), (0.1, 0.075, 0.1), C['carta'], H, n=10, m=5)
    return [(p, 'abito')]


def notte(corpo):
    """Berretto da notte: cono lungo a righe azzurre e bianche che si piega di lato, pon-pon bianco in punta."""
    p = P('cap_notte')
    tornito(p, [(0.178, 1.53), (0.18, 1.575)], C['bianco'], caps=False, n=16)
    pts = [(0.0, 1.57, 0.0), (0.01, 1.66, 0.01), (0.06, 1.75, 0.03), (0.15, 1.76, 0.04), (0.22, 1.68, 0.05)]
    rads = [0.172, 0.15, 0.1, 0.055, 0.02]
    # righe vere: il cono a tratti, un colore per tratto (il colore per faccia farebbe quadretti)
    import gente_kit
    P_, R_ = gente_kit.spline(pts, 3), gente_kit.spline(rads, 3)
    for i in range(len(P_) - 1):
        p.tube([P_[i], P_[i + 1]], [R_[i][0], R_[i + 1][0]], C['celeste'] if i % 2 else C['bianco'], H, n=12, res=1, caps=('flat', 'flat'))
    p.ell((0.225, 1.655, 0.05), (0.045, 0.045, 0.045), C['bianco'], H, n=10, m=5)
    return [(p, 'abito')]


def monitor(corpo):
    """Testa Monitor CRT: cubo smussato beige che avvolge la testa, schermo nero con due occhi verdi accesi, antenna con la pallina rossa."""
    p, l = P('cap_monitor'), P('cap_monitor_luce')
    p.lathe([(0.0, 1.33), (0.2, 1.33), (0.218, 1.35), (0.218, 1.69), (0.2, 1.71), (0.0, 1.71)], C['perla'], H, n=16, sq=7.0, a0=math.pi / 4)
    p.lathe([(0.0, 1.38), (0.13, 1.38), (0.14, 1.4), (0.12, 1.64), (0.0, 1.64)], C['pietra'], H, n=12, sq=5.0, c=(0, 0, 0.16), a0=math.pi / 4, sz=0.7)
    p.box((0.0, 1.52, -0.21), (0.35, 0.29, 0.008), C['roccia'], H)
    p.box((0.0, 1.52, -0.215), (0.32, 0.26, 0.008), C['nero'], H)
    for k in (-1, 1):
        l.box((0.065 * k, 1.55, -0.221), (0.05, 0.022, 0.006), C['neon_verde'], H)
    l.box((0.0, 1.47, -0.221), (0.09, 0.012, 0.006), C['neon_verde'], H)
    for j, cc in enumerate(('rosso', 'giallo')):
        p.ell((0.222, 1.42 + j * 0.05, -0.12), (0.01, 0.016, 0.016), C[cc], H, n=6, m=3)
    p.tube([(0.06, 1.7, 0.02), (0.08, 1.8, 0.03), (0.1, 1.88, 0.04)], [0.008, 0.007, 0.006], C['argento_scuro'], H, n=5, res=1)
    p.ell((0.1, 1.9, 0.04), (0.025, 0.025, 0.025), C['rosso'], H, n=8, m=4)
    return [(p, 'abito'), (l, 'luce')]


def apicoltore(corpo):
    """Cappello con la rete da apicoltore: cilindro bianco a tesa larga, rete scura semitrasparente fino al collo, anello bianco in fondo."""
    p, v = P('cap_apicoltore'), P('cap_apicoltore_vetro')
    tornito(p, [(0.17, 1.55), (0.168, 1.68), (0.0, 1.69)], C['bianco'], caps=False, n=16)
    tesa(p, C['bianco'], 1.56, 0.16, 0.3, col_sotto=C['perla'])
    v.lathe([(0.255, 1.555), (0.26, 1.45), (0.25, 1.37)], C['roccia'], H, n=16, caps=False)
    anello = [(0.25 * dir_a(a)[0], 1.37, 0.25 * dir_a(a)[2]) for a in range(0, 361, 30)]
    p.tube(anello, [0.016] * len(anello), C['bianco'], H, n=6, res=1, caps=(None, None))
    return [(p, 'abito'), (v, 'vetro')]


def panama(corpo):
    """Panama crema con la fascia nera e gli occhiali da sole parcheggiati sopra la fascia, davanti."""
    p = P('cap_panama')
    tornito(p, [(0.172, 1.55), (0.168, 1.66), (0.15, 1.705), (0.05, 1.69), (0.0, 1.7)], lambda q: C['nero'] if q[1] < 1.6 else C['panna'], caps=False, n=16)
    tesa(p, C['panna'], 1.56, 0.165, 0.3, piega=-0.015, col_sotto=C['sabbia'])
    for k in (-1, 1):
        p.box((0.058 * k, 1.585, -0.178), (0.075, 0.04, 0.012), C['nero'], H, r=(-12, 8 * k, 0))
    p.box((0.0, 1.595, -0.18), (0.04, 0.008, 0.008), C['nero'], H)
    for k in (-1, 1):
        p.box((0.1 * k, 1.592, -0.12), (0.006, 0.006, 0.12), C['nero'], H, r=(0, -8 * k, 0))
    return [(p, 'abito')]


def sherlock(corpo):
    """Deerstalker: cupola marrone a coste più scure, visiere a mezzaluna davanti e dietro, paraorecchie legati in cima col fiocco nero."""
    p = P('cap_sherlock')
    c, r = (0.0, 1.545, 0.0), (0.188, 0.165, 0.195)
    cupola(p, c, r, lambda q: C['cuoio'] if int(((math.degrees(math.atan2(q[0], -q[2])) % 360) / 22.5 + (q[1] / 0.05))) % 2 else C['cammello'], e0=0, e1=90, n=16, m=6)
    for z in (-1, 1):
        p.ell((0.0, 1.55, 0.17 * z), (0.13, 0.012, 0.09), C['cuoio'], H, n=12, m=2)
    for k in (-1, 1):
        p.tube([(0.18 * k, 1.56, 0.0), (0.17 * k, 1.66, 0.0), (0.06 * k, 1.715, 0.0)], [(0.012, 0.06), (0.012, 0.055), (0.01, 0.03)], C['cammello'], H, n=4, res=2,
               caps=('flat', 'flat'), sq=6.0, ref=(0, 0, -1))
    p.ell((0.0, 1.72, 0.0), (0.02, 0.016, 0.016), C['nero'], H, n=6, m=3)
    for k in (-1, 1):
        p.ell((0.03 * k, 1.722, 0.0), (0.028, 0.014, 0.01), C['nero'], H, n=6, m=3)
    return [(p, 'abito')]


def basco(corpo):
    """Basco francese macchiato: disco bombato blu notte inclinato di lato, picciolo in cima, macchie di vernice colorate."""
    p = P('cap_basco')
    p.push(t=(0.0, 0.0, 0.0), r=(0, 0, -14), pivot=(0.0, 1.6, 0.0))
    tornito(p, [(0.165, 1.58), (0.168, 1.61)], C['navy'], caps=False)
    c, r = (0.03, 1.64, 0.01), (0.215, 0.065, 0.215)
    cupola(p, c, r, C['navy'], e0=-60, e1=90, n=18, m=5)
    p.lathe([(0.008, 1.7), (0.008, 1.73), (0.0, 1.73)], C['navy'], H, n=5, c=(0.03, 0, 0.01))
    for e, a, rr, cc in ((50, -30, 0.035, 'rosso'), (35, 80, 0.03, 'giallo'), (60, 160, 0.028, 'acqua'), (20, -120, 0.024, 'giallo')):
        sfera_su(p, c, r, e, a, rr, C[cc], schiaccia=0.1)
    p.pop()
    return [(p, 'abito')]


def ranocchio(corpo):
    """Cappuccio Ranocchio: caschetto verde che avvolge la testa lasciando il viso, due occhioni sopra, guanciotte rosa."""
    p = P('cap_ranocchio')
    c, r = (0.0, 1.52, 0.012), (0.205, 0.185, 0.205)
    cupola(p, c, r, C['erba'], e0=-50, e1=90, n=16, m=8, finestra=lambda a, e: abs(a) < 62 and e < 22)
    cupola(p, (c[0], c[1], c[2]), (r[0] * 0.97, r[1] * 0.97, r[2] * 0.97), C['erba_scura'], e0=-50, e1=-35, n=16, m=1, finestra=lambda a, e: abs(a) < 62)
    for k in (-1, 1):
        p.ell((0.085 * k, 1.69, -0.06), (0.062, 0.058, 0.058), C['bianco'], H, n=10, m=5)
        p.ell((0.088 * k, 1.695, -0.112), (0.026, 0.03, 0.012), C['nero'], H, n=8, m=3)
        p.ell((0.15 * k, 1.44, -0.135), (0.03, 0.022, 0.01), C['rosa'], H, n=8, m=2)
    p.tube([(-0.04, 1.62, -0.19), (0.0, 1.61, -0.2), (0.04, 1.62, -0.19)], [0.006] * 3, C['erba_scura'], H, n=4, res=2)
    return [(p, 'abito')]


def aviatore(corpo):
    """Caschetto da aviatore in cuoio marrone scuro coi paraorecchie, occhialoni d'ottone con le lenti azzurre sulla fronte."""
    p = P('cap_aviatore')
    c, r = (0.0, 1.53, 0.005), (0.19, 0.165, 0.198)
    cupola(p, c, r, C['cuoio_scuro'], e0=-55, e1=90, n=16, m=8, finestra=lambda a, e: abs(a) < 58 and e < 18)
    for k in (-1, 1):
        p.ell((0.195 * k, 1.47, 0.0), (0.018, 0.06, 0.055), C['cuoio'], H, n=10, m=4)
    anello = [(0.17 * dir_a(a)[0], 1.62, 0.178 * dir_a(a)[2]) for a in range(0, 361, 30)]
    p.tube(anello, [(0.012, 0.012)] * len(anello), C['nero'], H, n=4, res=1, caps=(None, None))
    for k in (-1, 1):
        q = (0.062 * k, 1.635, -0.175)
        p.tube([(q[0], q[1] - 0.006, q[2] + 0.03), (q[0], q[1], q[2] - 0.01)], [0.045, 0.048], C['ottone'], H, n=10, res=1, caps=('flat', 'flat'))
        p.ell((q[0], q[1] + 0.001, q[2] - 0.012), (0.036, 0.036, 0.008), C['celeste'], H, n=10, m=2)
    p.box((0.0, 1.635, -0.19), (0.04, 0.012, 0.012), C['ottone'], H)
    return [(p, 'abito')]


def bustina(corpo):
    """Bustina di carta da gelataio anni '50: barchetta stretta e lunga piegata sopra la testa, bianca con la striscia rossa."""
    p = P('cap_bustina')
    p.push(r=(0, 0, 6), pivot=(0.0, 1.62, 0.0))
    for k in (-1, 1):
        p.box((0.06 * k, 1.68, 0.0), (0.014, 0.15, 0.42), C['carta'], H, r=(0, 0, 20 * k))
        p.box((0.085 * k, 1.622, 0.0), (0.014, 0.03, 0.422), C['rosso'], H, r=(0, 0, 20 * k))
    p.box((0.0, 1.75, 0.0), (0.04, 0.014, 0.41), C['bianco'], H)
    p.pop()
    return [(p, 'abito')]


def cilindro(corpo):
    """Cilindro da gentiluomo: tesa stretta incurvata ai lati, cilindro nero altissimo un po' più largo in cima, fascia di raso rosso."""
    p = P('cap_cilindro')
    tesa(p, C['nero'], 1.565, 0.16, 0.245, piega=0.02, sz=0.92)
    tornito(p, [(0.158, 1.56), (0.16, 1.62), (0.165, 1.78), (0.176, 1.87), (0.0, 1.875)], lambda q: C['rosso'] if q[1] < 1.615 else C['nero'], caps=False, n=18, sz=0.92)
    return [(p, 'abito')]


def fiore_cactus(corpo):
    """Fiore di Cactus: calotta verde scuro a coste, corona di petali fucsia a raggiera, centro giallo."""
    p = P('cap_fiore_cactus')
    c, r = (0.0, 1.55, 0.0), (0.185, 0.15, 0.19)
    cupola(p, c, r, lambda q: C['bosco'] if int((math.degrees(math.atan2(q[0], -q[2])) % 360) / 22.5) % 2 else C['erba_scura'], e0=-10, e1=90, n=16, m=6)
    for e, a in ((20, 10), (45, 100), (30, 200), (60, -60), (15, -150), (40, 150)):
        er, d = math.radians(e), dir_a(a)
        q = (r[0] * math.cos(er) * d[0], c[1] + r[1] * math.sin(er), r[2] * math.cos(er) * d[2])
        p.tube([q, (q[0] * 1.2, q[1] + 0.02, q[2] * 1.2)], [0.006, 0.001], C['bianco'], H, n=4, res=1, caps=('flat', 'flat'))
    top = (0.0, 1.705, 0.0)
    for k in range(9):
        d = dir_a(360 * k / 9)
        p.tube([top, (d[0] * 0.06, 1.73, d[2] * 0.06), (d[0] * 0.12, 1.76, d[2] * 0.12)], [(0.012, 0.004), (0.035, 0.006), (0.004, 0.003)],
               C['fucsia'] if k % 2 else C['rosa'], H, n=4, res=2, caps=('flat', 'flat'), sq=4.0)
    p.ell((0.0, 1.73, 0.0), (0.04, 0.03, 0.04), C['giallo'], H, n=10, m=4, cut=(0.0, 1.0))
    return [(p, 'abito')]


def bolla(corpo):
    """Casco a bolla retrò: sfera di vetro che racchiude la testa, anello metallico sul collo, astina con la pallina luminosa."""
    p, v, l = P('cap_bolla'), P('cap_bolla_vetro'), P('cap_bolla_luce')
    v.ell((0.0, 1.52, -0.01), (0.25, 0.25, 0.25), C['celeste'], H, n=18, m=9, cut=(-0.62, 1.0))
    yb = 1.52 - 0.25 * 0.62
    rb = 0.25 * math.sqrt(1 - 0.62 ** 2)
    tornito(p, [(rb + 0.01, yb - 0.03), (rb + 0.03, yb - 0.01), (rb + 0.03, yb + 0.02), (rb - 0.005, yb + 0.025)], C['argento_scuro'], caps=False, n=18, c=(0.0, -0.01))
    for a in range(0, 360, 60):
        q = a_testa(yb, a, rb + 0.032)
        p.ell((q[0], q[1], q[2] - 0.01), (0.01, 0.01, 0.01), C['argento'], H, n=6, m=3)
    p.tube([(0.0, 1.765, -0.01), (0.0, 1.85, -0.01)], [0.008, 0.006], C['argento_scuro'], H, n=5, res=1)
    l.ell((0.0, 1.865, -0.01), (0.022, 0.022, 0.022), C['neon_rosso'], H, n=8, m=4)
    return [(p, 'abito'), (v, 'vetro'), (l, 'luce')]


CAPPELLI = {'fungo': fungo, 'toque': toque, 'notte': notte, 'monitor': monitor, 'apicoltore': apicoltore, 'panama': panama, 'sherlock': sherlock,
            'basco': basco, 'ranocchio': ranocchio, 'aviatore': aviatore, 'bustina': bustina, 'cilindro': cilindro, 'fiore_cactus': fiore_cactus, 'bolla': bolla}
