# Nemici della Grotta, della Cripta e del Vuoto, snodati (issue 723; prima statici in models_rpg.py). Kit e nomi delle ossa: nemici_kit.py.
#   npm run assets nem_bandito nem_lupo nem_ragno nem_scheletro nem_nonmorto nem_re_ossa nem_spettro nem_golem nem_custode
# A riposo: in piedi, braccia lungo i fianchi, armi in pugno puntate avanti; le guardie e i colpi li fa il client (nemici_pose.ts).
import math
from nemici_kit import Rig, Corpo, bipede, arto, anelli, R, tube, blob, cone_dir, quad2, slab, xf, face, EM
from models_rpg import _skull, _bone, _shell, crystal, band, beam, _mid


# ------------------------------------------------------------------ armi in pugno (p = centro del pugno; la lama va avanti, −Z)
def _sciabola(r, c, p, regione='ferro', lato='metallo', lunga=0.62):
    m = r.m
    x, y, z = p
    m.box(x - 0.02, y - 0.03, z - 0.02, x + 0.02, y + 0.03, z + 0.02, 'cuoio')
    m.box(x - 0.07, y - 0.012, z - 0.045, x + 0.07, y + 0.012, z - 0.025, 'oro')
    with xf(m, t=(x, y, z - 0.035), r=(-90, 0, 0)):
        L = lunga
        slab(m, [(-0.018, 0.0), (0.022, 0.0), (0.03, 0.65 * L), (0.0, L), (-0.03, 0.78 * L)], -0.006, 0.006, regione, side=lato)


def _spada_rotta(r, c, p):
    m = r.m
    x, y, z = p
    with xf(m, t=(x, y, z), r=(-90, 0, 0)):
        beam(m, (0, -0.07, 0), (0, 0.07, 0), 0.03, 0.03, 'cuoio', n=4)
        m.box(-0.09, 0.07, -0.022, 0.09, 0.1, 0.022, 'ferro_rotto', skip=())
        slab(m, [(-0.03, 0.1), (0.03, 0.1), (0.032, 0.55), (0.012, 0.6), (0.028, 0.68), (0.0, 0.8), (-0.03, 0.7)], -0.008, 0.008, 'ferro_rotto')


# ------------------------------------------------------------------ bandito
def _testa_bandito(r, c, base):
    m = r.m
    hx, hy, hz = 0.0, base[1] + 0.13, -0.01
    Hh = lambda rx, y, rz, cz=0.0: m.ring(8, rx, hy + y, rz=rz, a0=math.pi / 8, cx=hx, cz=hz + cz)
    Hd = [Hh(0.05, -0.12, 0.05, -0.01), Hh(0.082, -0.085, 0.088, -0.005), Hh(0.097, -0.025, 0.105), Hh(0.1, 0.02, 0.11),
          Hh(0.097, 0.065, 0.11), Hh(0.075, 0.12, 0.088)]
    m.loft(Hd, 'testa_bandito', bottom='pelle_bandito', uv='head', bbox=(hx - 0.11, hy - 0.135, hx + 0.11, hy + 0.145), alt='pelle_bandito')
    for i in range(8):
        m.poly([Hd[-1][(i + 1) % 8], Hd[-1][i], (hx, hy + 0.15, hz)], 'pelle_bandito')
    anelli(m, [Hh(0.103, -0.1, 0.112, -0.004), Hh(0.106, -0.03, 0.116, -0.006)], 'p_rosso')                  # il fazzoletto
    face(m, [(-0.06, hy - 0.1, hz - 0.115), (0.06, hy - 0.1, hz - 0.115), (0.0, hy - 0.2, hz - 0.1)], 'p_rosso', (0, 0, -1))
    rings = [Hh(0.13, -0.09, 0.13, 0.02), Hh(0.135, 0.04, 0.14, 0.0), Hh(0.115, 0.15, 0.12, 0.015)]      # il cappuccio aperto davanti
    for a, b in zip(rings, rings[1:]):
        for i in range(8):
            j = (i + 1) % 8
            if i in (5, 6):
                continue
            m.poly([a[j], a[i], b[i], b[j]], 'cappuccio')
            m.poly([a[i], a[j], b[j], b[i]], 'p_ombra_calda')
    tip = (hx, hy + 0.2, hz + 0.2)
    for i in range(8):
        m.poly([rings[-1][(i + 1) % 8], rings[-1][i], tip], 'cappuccio')
    tube(m, [tip, (hx, hy + 0.12, hz + 0.3), (hx, hy - 0.02, hz + 0.32)], [0.04, 0.03, 0], 4, 'cappuccio')


def nem_bandito():
    """Bandito: cappuccio verde scuro aperto sul viso, fazzoletto rosso, giubba di cuoio con le cinghie e la fibbia d'oro, mantellina,
    la borsa al fianco, gli stivali alti, la sciabola corta nella destra."""
    r = Rig('nem_bandito')
    c = Corpo(1.75, k=1.12, gambe=0.94)
    c.petto, c.fianchi = (0.2, 0.125), (0.15, 0.105)

    def busto(r, c):
        m = r.m
        m.box(-0.06, 0.92, -0.13, 0.06, 1.0, -0.1, 'oro', skip=('back',))
        quad2(m, [(-0.24, 1.38, 0.1), (0.24, 1.38, 0.1), (0.29, 1.0, 0.18), (-0.29, 1.0, 0.18)], 'cappuccio', (0, 0, 1))
        anelli(m, [R(m, 0.235, 1.3, 0.16), R(m, 0.18, 1.4, 0.12)], 'cappuccio')
        for x in (-0.1, 0.1):
            m.box(x - 0.014, 0.98, -0.132, x + 0.014, 1.34, -0.118, 'p_nero_caldo', skip=('back',))
        anelli(m, [R(m, 0.16, 0.9, 0.115), R(m, 0.165, 0.96, 0.12)], 'cintura')

    def bacino(r, c):
        m = r.m
        m.box(-0.25, 0.7, -0.05, -0.15, 0.88, 0.08, 'tela_sacco')
        m.box(-0.255, 0.84, -0.055, -0.145, 0.89, 0.085, 'cuoio')

    bipede(r, c, gamba='p_ombra_calda', scarpa='p_nero_caldo', bacino='p_legno', busto='p_legno', braccio='cappuccio', avambraccio='cuoio',
           mano='pelle_bandito', testa=_testa_bandito, mano_dx=_sciabola, sul_busto=busto, sul_bacino=bacino)
    for lato, sx in (('sx', -1), ('dx', 1)):  # gli stivali alti, sopra lo stinco
        with r.osso('stinco_' + lato):
            x = sx * c.hx
            anelli(r.m, [R(r.m, 0.065, 0.09, 0.07, cx=x), R(r.m, 0.07, 0.36, 0.075, cx=x), R(r.m, 0.078, 0.4, 0.082, cx=x)], 'p_nero_caldo', top='p_legno_scuro')
    return r.build()


# ------------------------------------------------------------------ scheletri
def _scheletro(r, S=1.0, occhi='em_neon_rosso', corona=False, arma=_spada_rotta, coste=4):
    c = Corpo(1.7 * S, k=0.95)
    c.r_coscia, c.r_stinco, c.r_braccio, c.r_avambraccio, c.mano = 0.032 * S, 0.026 * S, 0.028 * S, 0.023 * S, 0.7
    P = lambda x, y, z: (x * S, y * S, z * S)

    def busto(r, c):
        m = r.m
        tube(m, [P(0, 0.92, 0.03), P(0, 1.15, 0.05), P(0, 1.43, -0.01)], [0.033 * S, 0.03 * S, 0.027 * S], 4, 'ossa')   # la spina
        for i in range(coste):
            y = 1.32 - i * (0.27 / max(1, coste - 1))
            band(m, P(0, 0, -0.01), (0.16 - 0.012 * i) * S, 0.105 * S, y * S, (y + 0.034) * S, 'ossa', n=8)
        tube(m, [P(0, 1.33, -0.115), P(0, 1.03, -0.1)], [0.018 * S, 0.015 * S], 3, 'ossa')                                # lo sterno
        tube(m, [P(-0.21, 1.35, 0.0), P(0.21, 1.35, 0.0)], [0.02 * S, 0.02 * S], 3, 'ossa')                               # le clavicole

    def bacino(r, c):
        r.m.prism(6, 0.12 * S, 0.15 * S, 0.84 * S, 0.97 * S, 'ossa')

    def testa(r, c, base):
        m = r.m
        _skull(m, P(0, 1.565, -0.03), S, eyes=occhi)
        if corona:
            cy = 1.68 * S
            m.prism(8, 0.1 * S, 0.11 * S, cy, cy + 0.06 * S, 'oro', a0=math.pi / 8, cz=-0.02 * S)
            for k in range(8):
                a = 2 * math.pi * k / 8 + math.pi / 8
                b = (math.cos(a) * 0.105 * S, cy + 0.05 * S, -0.02 * S + math.sin(a) * 0.105 * S)
                cone_dir(m, b, (b[0] * 1.05, cy + (0.17 if k % 2 else 0.11) * S, b[2]), 0.025 * S, 3, 'oro')
            blob(m, (0, cy + 0.03 * S, -0.13 * S), 0.025 * S, 0.025 * S, 0.02 * S, 'em_neon_rosso', n=4, k=2, mat=EM)

    def dita(r, c, p, lato):
        for k in range(3):
            cone_dir(r.m, (p[0] + 0.015 * (k - 1) * S, p[1] - 0.02 * S, p[2]), (p[0] + 0.02 * (k - 1) * S, p[1] - 0.09 * S, p[2] - 0.03 * S), 0.012 * S, 3, 'ossa')

    bipede(r, c, gamba='ossa', scarpa='ossa', bacino=None, busto=None, braccio='ossa', avambraccio='ossa', mano='ossa', testa=testa,
           mano_dx=arma, mano_sx=lambda r, c, p: dita(r, c, p, 'sx'), sul_busto=busto, sul_bacino=bacino, n=4)
    for lato in ('sx', 'dx'):  # le rotule
        sx = -1 if lato == 'sx' else 1
        with r.osso('stinco_' + lato):
            blob(r.m, (sx * c.hx, c.ginocchio, -0.02 * S), 0.035 * S, 0.03 * S, 0.035 * S, 'ossa', n=4, k=2)
    return c


def nem_scheletro():
    """Scheletro: teschio col viso e gli occhi rossi, costole ad anello (ci si vede attraverso), ossa sottili, spada arrugginita e
    sbeccata nella destra (l'arciere ha in più l'arco, che mette il client)."""
    r = Rig('nem_scheletro')
    _scheletro(r)
    return r.build()


def _mazza_ossa(S):
    def f(r, c, p):
        m = r.m
        with xf(m, t=p, r=(-90, 0, 0)):
            beam(m, (0, -0.1 * S, 0), (0, 0.08 * S, 0), 0.035 * S, 0.035 * S, 'cuoio', n=4)
            tube(m, [(0, 0.08 * S, 0), (0, 0.5 * S, 0), (0, 0.82 * S, 0)], [0.03 * S, 0.05 * S, 0.065 * S], 5, 'ossa', cap1='ossa')
            for k in range(5):
                a = 2 * math.pi * k / 5
                cone_dir(m, (math.cos(a) * 0.05 * S, 0.74 * S, math.sin(a) * 0.05 * S), (math.cos(a) * 0.17 * S, 0.78 * S, math.sin(a) * 0.17 * S), 0.025 * S, 3, 'ossa')
            _skull(m, (0, 0.9 * S, 0.0), 0.55 * S)
    return f


def nem_re_ossa():
    """Il Re delle Ossa (boss della Cripta, ≈ 3 m): scheletro gigante coronato, occhi ambra, spallacci d'osso a punte, mantello rosso
    lacero, cintura e gonnellino di ferro rotto, la mazza d'ossa con un teschio in cima."""
    r = Rig('nem_re_ossa')
    S = 1.78
    c = _scheletro(r, S, occhi='em_neon_ambra', corona=True, arma=_mazza_ossa(S), coste=5)
    m = r.m
    with r.osso('busto'):
        cape = [(-0.26, 1.38, 0.12), (0.26, 1.38, 0.12), (0.34, 0.5, 0.26), (0.2, 0.62, 0.27), (0.08, 0.42, 0.28), (-0.06, 0.58, 0.28), (-0.2, 0.4, 0.27), (-0.34, 0.55, 0.26)]
        cape = [(x * S, y * S, z * S) for x, y, z in cape]
        face(m, cape, 'tessuto_rosso', (0, 0, 1))
        face(m, cape, 'lacca_scura', (0, 0, -1))
    for lato, sx in (('sx', -1), ('dx', 1)):
        with r.osso('braccio_' + lato):
            blob(m, (sx * 0.22 * S, 1.36 * S, 0.0), 0.09 * S, 0.06 * S, 0.09 * S, 'ossa', n=6, k=3)
            for k in range(3):
                cone_dir(m, (sx * (0.2 + 0.04 * k) * S, 1.38 * S, (-0.04 + 0.04 * k) * S), (sx * (0.3 + 0.05 * k) * S, 1.6 * S, (-0.06 + 0.06 * k) * S), 0.03 * S, 3, 'ossa')
    with r.osso('bacino'):
        band(m, (0, 0, 0.0), 0.16 * S, 0.12 * S, 0.9 * S, 0.96 * S, 'ferro_rotto', n=8)
    for lato, sx in (('sx', -1), ('dx', 1)):
        with r.osso('coscia_' + lato):
            for k in range(2):
                x = sx * (0.05 + 0.1 * k) * S
                quad2(m, [(x - 0.045 * S, 0.9 * S, -0.13 * S), (x + 0.045 * S, 0.9 * S, -0.13 * S), (x + 0.04 * S, 0.66 * S, -0.16 * S), (x - 0.04 * S, 0.66 * S, -0.16 * S)], 'ferro_rotto', (0, 0, -1))
    return r.build()


def nem_nonmorto():
    """Non-morto antico: teschio con l'elmo a corna d'oro e gli occhi ciano, corazza a lamelle laccata e sfondata (dentro le costole),
    spallacci, gonnellino a lamelle che segue le gambe, la katana spezzata nella destra, il drappo rosso."""
    r = Rig('nem_nonmorto')
    c = Corpo(1.8, k=1.05)
    c.r_braccio, c.r_avambraccio, c.mano = 0.05, 0.042, 0.8

    def testa(r, c, base):
        m = r.m
        _skull(m, (0, 1.6, -0.03), 1.0, eyes='em_neon_ciano')
        Rr = lambda rx, y, rz, cz=0.0: m.ring(8, rx, y, rz=rz, a0=math.pi / 8, cz=cz)
        _shell(m, [Rr(0.125, 1.62, 0.13), Rr(0.12, 1.7, 0.125), Rr(0.08, 1.76, 0.085)], 'lacca_scura', front=-0.6, tip=(0, 1.79, 0.0))
        face(m, [(-0.16, 1.64, -0.13), (0.16, 1.64, -0.13), (0.2, 1.62, -0.02), (-0.2, 1.62, -0.02)], 'lacca_scura', (0, 1, 0))
        for sx in (-1, 1):
            quad2(m, [(sx * 0.03, 1.7, -0.13), (sx * 0.06, 1.7, -0.13), (sx * 0.2, 1.94, -0.14), (sx * 0.16, 1.96, -0.14)], 'oro', (0, 0, -1))
        tube(m, [(0, 1.43, 0.0), (0, 1.5, -0.02)], [0.025, 0.025], 4, 'ossa')

    def busto(r, c):
        m = r.m
        Rr = lambda rx, y, rz, cz=0.0: m.ring(8, rx, y, rz=rz, a0=math.pi / 8, cz=cz)
        rings = [Rr(0.15, 0.94, 0.1), Rr(0.16, 1.08, 0.105), Rr(0.19, 1.23, 0.115), Rr(0.2, 1.4, 0.11)]
        for ra, rb in zip(rings, rings[1:]):
            for i in range(8):
                j = (i + 1) % 8
                q = [ra[i], ra[j], rb[j], rb[i]]
                cc = _mid(*q)
                if cc[1] > 1.05 and cc[0] < -0.02 and cc[2] < -0.02:
                    continue  # la breccia
                face(m, q, 'ferro_rotto', (cc[0], 0, cc[2]))
                face(m, q, 'p_nero_caldo', (-cc[0], 0, -cc[2]))
        for y in (1.15, 1.25):
            band(m, (0, 0, -0.005), 0.13, 0.085, y, y + 0.03, 'ossa', n=8)
        face(m, rings[-1], 'lacca_scura', (0, 1, 0))
        quad2(m, [(0.12, 1.02, -0.14), (0.2, 1.02, -0.12), (0.18, 0.62, -0.2), (0.12, 0.66, -0.2)], 'tessuto_rosso', (0, 0, -1))

    def spalliera(r, c, p, sx):
        with xf(r.m, r=(0, 0, -25 * sx), pivot=p):
            r.m.box(p[0] - 0.1, p[1] - 0.17, -0.13, p[0] + 0.1, p[1] + 0.03, 0.13, 'lacca_scura', top='ferro_rotto', skip=())

    def gonna(r, c, sx):
        m = r.m
        for k in range(2):
            aa = math.radians((-60 if k == 0 else 200) if sx < 0 else (-120 if k == 0 else -20)) - math.pi / 2
            cx, cz = math.cos(aa) * 0.17, math.sin(aa) * 0.12
            cx = abs(cx) * sx
            quad2(m, [(cx - 0.06, 0.92, cz), (cx + 0.06, 0.92, cz), (cx * 1.25 + 0.05, 0.66, cz * 1.25), (cx * 1.25 - 0.05, 0.66, cz * 1.25)], 'lacca_scura', (cx, -0.2, cz))

    def katana(r, c, p):
        m = r.m
        with xf(m, t=p, r=(-90, 0, 0)):
            beam(m, (0, -0.1, 0), (0, 0.08, 0), 0.035, 0.035, 'nero_p', n=4)
            m.prism(6, 0.05, 0.05, 0.08, 0.1, 'ferro_rotto', top='ferro_rotto', bottom='ferro_rotto')
            slab(m, [(-0.016, 0.1), (0.016, 0.1), (0.02, 0.48), (0.004, 0.53), (-0.012, 0.5), (-0.02, 0.4)], -0.006, 0.006, 'ferro_rotto')

    c.spalliera, c.gonna = spalliera, gonna
    bipede(r, c, gamba='lacca_scura', scarpa='ossa', bacino='lacca_scura', busto=None, braccio='ferro_rotto', avambraccio='ossa', mano='ossa',
           testa=testa, mano_dx=katana, sul_busto=busto)
    return r.build()


# ------------------------------------------------------------------ bestie
def nem_lupo():
    """Lupo grigio: muso lungo con la mascella che si apre, orecchie dritte, criniera irta, coda folta, occhi gialli accesi, zampe a due
    segmenti (ginocchio e garretto)."""
    r = Rig('nem_lupo')
    m = r.m
    with r.osso('corpo', (0, 0.66, 0.1)):
        tube(m, [(0, 0.62, 0.55), (0, 0.67, 0.3), (0, 0.69, -0.05), (0, 0.67, -0.3)], [(0.13, 0.14), (0.17, 0.18), (0.2, 0.22), (0.18, 0.23)], 7, 'pelliccia', cap0='pelliccia')
        for i, z in enumerate((-0.25, 0.0, 0.25)):  # criniera irta lungo la schiena
            quad2(m, [(0, 0.86 - 0.04 * i, z - 0.1), (0, 0.86 - 0.04 * i, z + 0.12), (0, 0.97 - 0.05 * i, z + 0.04), (0, 0.97 - 0.05 * i, z - 0.02)], 'pelliccia', (1, 0, 0))
        with r.osso('collo', (0, 0.7, -0.3)):
            tube(m, [(0, 0.68, -0.25), (0, 0.76, -0.45)], [(0.15, 0.16), (0.13, 0.12)], 6, 'pelliccia')
            with r.osso('testa', (0, 0.77, -0.5)):
                tube(m, [(0, 0.78, -0.42), (0, 0.79, -0.58), (0, 0.74, -0.74), (0, 0.71, -0.88)], [(0.13, 0.12), (0.12, 0.11), (0.07, 0.06), (0.04, 0.035)], 6, 'pelliccia', cap1='p_nero_caldo')
                for sx in (-1, 1):
                    cone_dir(m, (sx * 0.06, 0.88, -0.5), (sx * 0.09, 1.04, -0.46), 0.045, 3, 'pelliccia')
                    face(m, [(sx * 0.055, 0.81, -0.66), (sx * 0.085, 0.8, -0.62), (sx * 0.085, 0.826, -0.615), (sx * 0.055, 0.836, -0.655)], 'em_neon_ambra', (sx * 0.5, 0.2, -1), mat=EM)
                    cone_dir(m, (sx * 0.03, 0.7, -0.8), (sx * 0.03, 0.64, -0.81), 0.012, 3, 'p_pietra_chiara')   # zanne di sopra
                with r.osso('mascella', (0, 0.69, -0.58)):
                    tube(m, [(0, 0.67, -0.58), (0, 0.65, -0.84)], [(0.06, 0.035), (0.035, 0.02)], 4, 'pelliccia', cap1='pelliccia')
                    for sx in (-1, 1):
                        cone_dir(m, (sx * 0.025, 0.67, -0.78), (sx * 0.025, 0.72, -0.79), 0.01, 3, 'p_pietra_chiara')
        with r.osso('coda', (0, 0.64, 0.58)):
            tube(m, [(0, 0.64, 0.58), (0, 0.62, 0.78)], [0.06, 0.075], 5, 'pelliccia')
            with r.osso('coda2', (0, 0.6, 0.78)):
                tube(m, [(0, 0.61, 0.76), (0, 0.52, 0.98)], [0.075, 0], 5, 'pelliccia')
    for nome, x, z0 in (('as', -0.1, -0.28), ('ad', 0.1, -0.28), ('ps', -0.1, 0.45), ('pd', 0.1, 0.45)):
        dietro = z0 > 0
        with r.osso('zampa_' + nome, (x, 0.64, z0), padre='corpo'):
            kz = z0 + (0.1 if dietro else -0.02)
            tube(m, [(x, 0.66, z0), (x * 1.05, 0.36, kz)], [0.085 if dietro else 0.075, 0.05], 5, 'pelliccia')
            with r.osso('piede_' + nome, (x * 1.05, 0.36, kz)):
                fz = z0 + (0.02 if dietro else -0.06)
                tube(m, [(x * 1.05, 0.36, kz), (x * 1.05, 0.04, fz)], [0.045, 0.035], 4, 'pelliccia')
                m.box(x * 1.05 - 0.045, 0, fz - 0.09, x * 1.05 + 0.045, 0.05, fz + 0.03, 'p_roccia', skip=('bottom',))
    return r.build()


def nem_ragno():
    """Ragno gigante delle grotte: addome gonfio col segno rosso, otto zampe a due segmenti, quattro occhi rossi, cheliceri che si aprono."""
    r = Rig('nem_ragno')
    m = r.m
    with r.osso('corpo', (0, 0.5, -0.2)):
        blob(m, (0, 0.5, -0.25), 0.26, 0.2, 0.3, 'chitina', n=6, k=3)
        for x, y, z in ((-0.06, 0.6, -0.52), (0.06, 0.6, -0.52), (-0.13, 0.57, -0.48), (0.13, 0.57, -0.48)):
            face(m, [(x - 0.025, y - 0.02, z), (x + 0.025, y - 0.02, z), (x + 0.025, y + 0.02, z), (x - 0.025, y + 0.02, z)], 'em_neon_rosso', (x * 3, 0.2, -1), mat=EM)
        with r.osso('addome', (0, 0.55, 0.0)):
            blob(m, (0, 0.62, 0.38), 0.42, 0.36, 0.5, 'chitina', n=8, k=4)
            face(m, [(0, 0.985, 0.2), (0.09, 0.96, 0.36), (0, 0.985, 0.52), (-0.09, 0.96, 0.36)], 'p_rosso', (0, 1, 0))
            for i in range(6):
                a = 2 * math.pi * i / 6
                b = (math.cos(a) * 0.28, 0.85, 0.38 + math.sin(a) * 0.32)
                cone_dir(m, b, (b[0] * 1.3, 0.98, 0.38 + (b[2] - 0.38) * 1.3), 0.025, 3, 'chitina')
        with r.osso('zanne', (0, 0.44, -0.5)):
            for sx in (-1, 1):
                cone_dir(m, (sx * 0.07, 0.42, -0.5), (sx * 0.05, 0.24, -0.6), 0.04, 3, 'p_nero_caldo')
        for k, ang in enumerate((-60, -22, 18, 55)):
            for sx in (-1, 1):
                i = k + 1 if sx < 0 else k + 5
                a = math.radians(ang)
                d = (sx * math.cos(a), 0, math.sin(a))
                hip = (sx * 0.2, 0.52, -0.25 + 0.1 * math.sin(a))
                pt = lambda f, y: (hip[0] + d[0] * f, y, hip[2] + d[2] * f)
                with r.osso('zampa_%d' % i, hip):
                    tube(m, [hip, pt(0.42, 0.98)], [0.055, 0.045], 4, 'chitina')
                    with r.osso('punta_%d' % i, pt(0.42, 0.98)):
                        tube(m, [pt(0.42, 0.98), pt(0.9, 0.62), pt(1.15, 0.0)], [0.045, 0.03, 0.012], 4, 'chitina')
    return r.build()


def nem_spettro():
    """Spettro fluttuante: veste viola che brilla con l'orlo a brandelli (la coda ondeggia), cappuccio vuoto con gli occhi ciano, braccia
    lunghe con le mani ossute."""
    r = Rig('nem_spettro')
    m = r.m
    n = 8
    def ring(rr, y, jag=0.0, cz=0.0):
        return [(math.cos(2 * math.pi * i / n) * rr, y + (jag if i % 2 else -jag), cz + math.sin(2 * math.pi * i / n) * rr) for i in range(n)]
    with r.osso('corpo', (0, 1.0, 0)):
        m.loft([ring(0.27, 0.8, 0, 0.03), ring(0.22, 1.25), ring(0.25, 1.5), ring(0.12, 1.58)], 'em_spettro', mat=EM)
        with r.osso('coda', (0, 0.85, 0.03)):
            m.loft([ring(0.3, 0.55, 0.06, 0.05), ring(0.28, 0.88, 0, 0.03)], 'em_spettro', mat=EM)
            with r.osso('coda2', (0, 0.55, 0.05)):
                m.loft([ring(0.36, 0.3, 0.12, 0.08), ring(0.3, 0.58, 0.04, 0.05)], 'em_spettro', mat=EM)
                for x in (-0.18, 0.05, 0.2):
                    tube(m, [(x, 0.3, 0.15), (x * 1.3, 0.15, 0.4), (x * 1.5, 0.2, 0.7)], [0.07, 0.05, 0], 3, 'em_spettro', mat=EM)
        with r.osso('testa', (0, 1.52, 0)):
            Hh = lambda rr, y, cz=0.0: m.ring(8, rr, y, a0=math.pi / 8, cz=cz)
            _shell(m, [Hh(0.17, 1.5, -0.02), Hh(0.18, 1.7, 0.0), Hh(0.13, 1.86, 0.04)], 'em_spettro', front=-0.55, tip=(0, 2.0, 0.12), mat=EM)
            face(m, [(math.cos(2 * math.pi * i / 6) * 0.11, 1.69 + math.sin(2 * math.pi * i / 6) * 0.13, -0.1) for i in range(6)], 'p_nero_caldo', (0, 0, -1))
            for sx in (-1, 1):
                face(m, [(sx * 0.05 - 0.025, 1.7, -0.11), (sx * 0.05 + 0.025, 1.7, -0.11), (sx * 0.05 + 0.02, 1.73, -0.11), (sx * 0.05 - 0.02, 1.73, -0.11)], 'em_neon_ciano', (0, 0, -1), mat=EM)
        for lato, sx in (('sx', -1), ('dx', 1)):
            with r.osso('braccio_' + lato, (sx * 0.22, 1.46, 0)):
                tube(m, [(sx * 0.22, 1.46, 0.0), (sx * 0.3, 1.15, -0.05)], [0.07, 0.09], 6, 'em_spettro', mat=EM)
                with r.osso('avambraccio_' + lato, (sx * 0.3, 1.15, -0.05)):
                    tube(m, [(sx * 0.3, 1.15, -0.05), (sx * 0.31, 0.88, -0.1)], [0.09, 0.12], 6, 'em_spettro', mat=EM)
                    for k in range(3):
                        cone_dir(m, (sx * (0.28 + 0.03 * k), 0.88, -0.1), (sx * (0.27 + 0.05 * k), 0.7, -0.14 - 0.02 * k), 0.018, 3, 'ossa')
    return r.build()


def nem_golem():
    """Golem di cristallo: massa di roccia nera curva in avanti, gambe corte e tozze, braccia lunghissime con pugni enormi, cristalli
    accesi sulla schiena e sulle braccia, il nucleo e gli occhi ciano."""
    r = Rig('nem_golem')
    c = Corpo(2.3)
    c.anca, c.ginocchio, c.caviglia, c.vita, c.spalla, c.collo, c.gomito, c.polso = 0.85, 0.45, 0.12, 0.95, 1.72, 1.9, 1.2, 0.74
    c.sx, c.hx, c.r_coscia, c.r_stinco, c.r_braccio, c.r_avambraccio, c.mano = 0.6, 0.27, 0.19, 0.16, 0.17, 0.14, 0.0

    def busto(r, c):
        m = r.m
        with xf(m, r=(-18, 0, 0), pivot=(0, 0.95, 0)):
            blob(m, (0, 1.45, 0.05), 0.55, 0.5, 0.4, 'vuoto_muro', n=7, k=4, jit=0.2, seed=4)
            blob(m, (0, 1.42, -0.37), 0.08, 0.08, 0.05, 'em_cristallo', n=4, k=2, mat=EM)
            for base, tip, rr in (((0.4, 1.8, 0.1), (0.62, 2.35, 0.2), 0.11), ((0.25, 1.85, 0.25), (0.3, 2.3, 0.5), 0.08), ((-0.4, 1.8, 0.1), (-0.6, 2.4, 0.15), 0.12),
                                  ((-0.15, 1.75, 0.35), (-0.2, 2.15, 0.7), 0.09), ((0.1, 1.6, 0.4), (0.15, 1.85, 0.8), 0.08), ((-0.3, 1.5, 0.38), (-0.5, 1.6, 0.75), 0.07)):
                crystal(m, base, tip, rr)

    def testa(r, c, base):
        m = r.m
        blob(m, (0, 1.88, -0.32), 0.16, 0.14, 0.16, 'vuoto_muro', n=5, k=3, jit=0.2, seed=6)
        for sx in (-1, 1):
            face(m, [(sx * 0.06 - 0.03, 1.88, -0.47), (sx * 0.06 + 0.03, 1.88, -0.47), (sx * 0.06 + 0.03, 1.91, -0.465), (sx * 0.06 - 0.03, 1.91, -0.465)], 'em_neon_ciano', (0, 0, -1), mat=EM)

    def pugno(r, c, p):
        blob(r.m, (p[0], p[1] - 0.12, p[2] - 0.02), 0.2, 0.18, 0.2, 'vuoto_muro', n=6, k=3, jit=0.15, seed=7)

    def spalliera(r, c, p, sx):
        crystal(r.m, (sx * 0.72, 1.3, -0.05), (sx * 0.95, 1.55, -0.1), 0.06)

    c.spalliera = spalliera
    bipede(r, c, gamba='vuoto_muro', scarpa='vuoto_muro', bacino='vuoto_muro', busto=None, braccio='vuoto_muro', mano='vuoto_muro',
           testa=testa, mano_dx=pugno, mano_sx=pugno, sul_busto=busto, n=5)
    with r.osso('bacino'):
        blob(r.m, (0, 0.88, 0.02), 0.32, 0.18, 0.22, 'vuoto_muro', n=6, k=3)
    return r.build()


def nem_custode():
    """Il Custode del Vuoto (boss, ≈ 3,5 m): figura d'ossidiana che fluttua, gonna di schegge (la coda), aureola viola neon dietro la testa,
    occhi ciano, cristalli sulle spalle, braccia con le lame di luce ciano."""
    r = Rig('nem_custode')
    m = r.m
    with r.osso('corpo', (0, 1.6, 0)):
        tube(m, [(0, 1.2, 0.02), (0, 2.0, 0.0), (0, 2.55, 0.0)], [0.3, (0.44, 0.32), (0.6, 0.36)], 8, 'vuoto_muro', cap0='vuoto_muro', cap1='vuoto_pav')
        band(m, (0, 0, 0.01), 0.425, 0.343, 1.75, 1.81, 'em_neon_ciano', n=8, both=False, mat=EM)
        face(m, [(math.cos(2 * math.pi * i / 6) * 0.13, 2.2 + math.sin(2 * math.pi * i / 6) * 0.13, -0.33) for i in range(6)], 'em_vuoto', (0, 0, -1), mat=EM)
        with r.osso('coda', (0, 1.3, 0)):
            tube(m, [(0, 0.45, 0), (0, 1.35, 0.02)], [0, 0.32], 8, 'vuoto_muro')
            band(m, (0, 0, 0.01), 0.305, 0.247, 1.15, 1.21, 'em_neon_ciano', n=8, both=False, mat=EM)
            for k in range(6):
                a = 2 * math.pi * k / 6
                b = (math.cos(a) * 0.32, 1.35, math.sin(a) * 0.26)
                crystal(m, b, (b[0] * 1.5, 0.85, b[2] * 1.5), 0.06)
        with r.osso('testa', (0, 2.6, 0)):
            blob(m, (0, 2.92, -0.04), 0.2, 0.27, 0.2, 'vuoto_muro', n=6, k=3)
            face(m, [(-0.13, 2.93, -0.235), (0.13, 2.93, -0.235), (0.11, 2.98, -0.225), (-0.11, 2.98, -0.225)], 'em_neon_ciano', (0, 0, -1), mat=EM)
            crystal(m, (0.1, 3.1, -0.02), (0.22, 3.55, 0.05), 0.06)
            crystal(m, (-0.1, 3.1, -0.02), (-0.22, 3.55, 0.05), 0.06)
        with r.osso('aureola', (0, 3.0, 0.32)):
            cx, cy, cz, RR, rr, N = 0.0, 3.0, 0.32, 0.62, 0.05, 14
            for i in range(N):
                a0, a1 = 2 * math.pi * i / N, 2 * math.pi * (i + 1) / N
                tube(m, [(cx + math.cos(a0) * RR, cy + math.sin(a0) * RR, cz), (cx + math.cos(a1) * RR, cy + math.sin(a1) * RR, cz)], [rr, rr], 3, 'em_neon_viola', mat=EM)
        for lato, sx in (('sx', -1), ('dx', 1)):
            for k, (dx, dy, dz) in enumerate(((0.1, 0.55, 0.0), (0.32, 0.3, 0.05), (0.15, 0.4, 0.25))):
                crystal(m, (sx * 0.52, 2.55, 0.0), (sx * (0.52 + dx), 2.55 + dy, dz), 0.1 - 0.02 * k)
            with r.osso('braccio_' + lato, (sx * 0.6, 2.48, 0)):
                tube(m, [(sx * 0.58, 2.5, 0.0), (sx * 0.72, 1.95, -0.02)], [0.13, 0.11], 6, 'vuoto_muro')
                with r.osso('avambraccio_' + lato, (sx * 0.72, 1.95, -0.02)):
                    tube(m, [(sx * 0.72, 1.95, -0.02), (sx * 0.76, 1.42, -0.06)], [0.11, 0.09], 6, 'vuoto_muro')
                    band(m, (sx * 0.72, 0, -0.02), 0.12, 0.12, 1.95, 2.01, 'em_neon_ciano', n=6, both=False, mat=EM)
                    with xf(m, t=(sx * 0.76, 1.4, -0.08), r=(-90, 0, 0)):  # la lama di luce in avanti
                        slab(m, [(-0.08, 0.0), (0.08, 0.0), (0.1, 0.45), (0.0, 0.95), (-0.06, 0.5)], -0.02, 0.02, 'em_neon_ciano', mat=EM)
    with r.osso('schegge', (0, 1.4, 0)):  # le tre schegge che gli girano attorno
        for k in range(3):
            a = 2 * math.pi * k / 3 + 0.5
            blob(m, (math.cos(a) * 0.95, 0.9 + 0.3 * k, math.sin(a) * 0.95), 0.08, 0.16, 0.08, 'em_cristallo', n=4, k=2, mat=EM)
    return r.build()


MODELS = {f.__name__: f for f in (nem_bandito, nem_lupo, nem_ragno, nem_scheletro, nem_nonmorto, nem_re_ossa, nem_spettro, nem_golem, nem_custode)}
MODELS_RPG = list(MODELS.values())
