# Isola delle Corse, kit della zona Spiaggia e porto (docs/CORSE.md A9, #176). Concept in assets/concept/corse/.
# Riviera colorata: paese bianco coi coppi, lungomare con lampioni, ombrelloni e palme, faro a strisce, porto con gru e container,
# manichini del pubblico. Tutto sull'atlas, pivot a terra al centro, davanti −Z. I modelli `cs_*` finiscono in manifest_corse.json
# (li scarica solo il chunk delle Corse). Le teste dei manichini sono a parte (`cs_manichino_testa`): il client le gira verso chi passa.
import math
from lib import Mesh, beam, face
from atlas import h01

EM = 'mat_emissivo'


def _obj(m):
    return [m.build()]


def _pannelli(m, x0, x1, y0, y1, z, regs, n):
    """Muro piano a pannelli larghi ~2 m (così le tessere dell'atlas si ripetono invece di stirarsi), rivolto verso n."""
    k = len(regs)
    for i, reg in enumerate(regs):
        a, b = x0 + (x1 - x0) * i / k, x0 + (x1 - x0) * (i + 1) / k
        if n[2]:
            face(m, [(a, y0, z), (b, y0, z), (b, y1, z), (a, y1, z)], reg, n)
        else:
            face(m, [(z, y0, a), (z, y0, b), (z, y1, b), (z, y1, a)], reg, n)


def _casa(m, w, d, piani, regs_davanti, regs_lato, tetto='falde', hp=2.6, x=0.0, z=0.0):
    """Casa del paese: intonaco bianco a pannelli (finestre e porte), zoccolo, tetto a due falde coi coppi o terrazza."""
    x0, x1, z0, z1 = x - w / 2, x + w / 2, z - d / 2, z + d / 2
    H = hp * piani
    for p in range(piani):
        y0, y1 = p * hp, (p + 1) * hp
        fr = regs_davanti[p] if p < len(regs_davanti) else regs_davanti[-1]
        la = regs_lato[p] if p < len(regs_lato) else regs_lato[-1]
        _pannelli(m, x0, x1, y0, y1, z0, fr, (0, 0, -1))
        _pannelli(m, x0, x1, y0, y1, z1, ['cs_intonaco'] * len(fr), (0, 0, 1))
        _pannelli(m, z0, z1, y0, y1, x0, la, (-1, 0, 0))
        _pannelli(m, z0, z1, y0, y1, x1, la, (1, 0, 0))
    m.box(x0 - 0.04, 0, z0 - 0.04, x1 + 0.04, 0.35, z1 + 0.04, 'p_pietra', skip=('top', 'bottom'))  # zoccolo
    if tetto == 'falde':
        yr, o = H + d * 0.32, 0.25
        for s in (1, -1):
            zz = z1 + o if s > 0 else z0 - o
            face(m, [(x0 - o, H - 0.1, zz), (x1 + o, H - 0.1, zz), (x1 + o, yr, z), (x0 - o, yr, z)], 'cs_coppi', (0, 1, s))
            face(m, [(x0 - o, H - 0.1, zz), (x1 + o, H - 0.1, zz), (x1 + o, H - 0.05, zz - s * 0.01), (x0 - o, H - 0.05, zz - s * 0.01)], 'p_legno', (0, -1, 0))
        for xx, sx in ((x0, -1), (x1, 1)):
            face(m, [(xx, H, z0), (xx, H, z1), (xx, yr, z)], 'cs_intonaco', (sx, 0, 0))
    else:  # terrazza col parapetto
        m.box(x0, H, z0, x1, H + 0.12, z1, 'p_pietra_chiara', top='p_sabbia', skip=('bottom',))
        for a, b in (((x0, z0), (x1, z0)), ((x1, z0), (x1, z1)), ((x1, z1), (x0, z1)), ((x0, z1), (x0, z0))):
            beam(m, (a[0], H + 0.4, a[1]), (b[0], H + 0.4, b[1]), 0.15, 0.55, 'cs_intonaco')
    return H


def cs_casa_a():
    """Casa a due piani coi coppi, porta e finestre con le persiane verdi."""
    m = Mesh('cs_casa_a')
    F, I, P = 'cs_finestra', 'cs_intonaco', 'cs_porta'
    _casa(m, 6.0, 4.5, 2, [[F, P, F], [F, F, F]], [[I, F], [F, I]])
    return _obj(m)


def cs_casa_b():
    """Casa stretta a tre piani con la terrazza e un balconcino."""
    m = Mesh('cs_casa_b')
    F, I, P = 'cs_finestra', 'cs_intonaco', 'cs_porta'
    _casa(m, 4.0, 4.0, 3, [[P, F], [F, F], [F, F]], [[I, F], [F, I], [F, F]], tetto='terrazza')
    m.box(-1.9, 2.6, -2.55, -0.1, 2.72, -2.0, 'p_pietra_chiara', skip=())  # balcone
    beam(m, (-1.9, 3.15, -2.55), (-0.1, 3.15, -2.55), 0.05, 0.05, 'p_nero_caldo')
    for xx in (-1.85, -1.0, -0.15):
        beam(m, (xx, 2.72, -2.55), (xx, 3.15, -2.55), 0.04, 0.04, 'p_nero_caldo')
    return _obj(m)


def cs_casa_c():
    """Casa bassa e larga col bar: tenda a strisce sopra la porta."""
    m = Mesh('cs_casa_c')
    F, I, P = 'cs_finestra', 'cs_intonaco', 'cs_porta'
    _casa(m, 8.0, 5.0, 1, [[F, P, P, F]], [[I, F, I]], hp=3.0)
    # tenda: falda inclinata verso la strada con la mantovana
    face(m, [(-3.6, 2.7, -2.5), (3.6, 2.7, -2.5), (3.6, 2.2, -4.0), (-3.6, 2.2, -4.0)], 'cs_tenda_rossa', (0, 1, -0.4))
    face(m, [(-3.6, 2.2, -4.0), (3.6, 2.2, -4.0), (3.6, 1.9, -4.0), (-3.6, 1.9, -4.0)], 'cs_tenda_rossa', (0, 0, -1))
    for xx in (-3.5, 3.5):
        beam(m, (xx, 0, -3.95), (xx, 2.2, -3.95), 0.06, 0.06, 'p_nero_caldo')
    return _obj(m)


def cs_lampione():
    """Lampione del lungomare: palo nero, braccio e globo acceso (4 m)."""
    m = Mesh('cs_lampione')
    m.prism(6, 0.2, 0.16, 0, 0.35, 'p_nero_caldo', top='p_roccia')
    m.prism(6, 0.08, 0.06, 0.35, 3.6, 'p_nero_caldo')
    beam(m, (0, 3.5, 0), (0, 3.6, -0.6), 0.06, 0.06, 'p_nero_caldo', end='p_nero_caldo')
    m.prism(6, 0.05, 0.16, 3.0, 3.18, 'p_nero_caldo', cz=-0.6)
    m.prism(6, 0.16, 0.16, 3.18, 3.45, 'em_finestra', mat=EM, cz=-0.6)
    m.cone(6, 0.2, 3.45, 3.62, 'p_nero_caldo', cz=-0.6)
    return _obj(m)


def _ombrellone(name, a, b):
    m = Mesh(name)
    m.prism(6, 0.22, 0.2, 0, 0.15, 'p_pietra', top='p_pietra')
    beam(m, (0, 0.15, 0), (0, 2.5, 0), 0.05, 0.05, 'p_pietra_chiara')
    n, R, y0, y1 = 8, 1.35, 2.05, 2.55
    for i in range(n):
        t0, t1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        p0 = (math.cos(t0) * R, y0, math.sin(t0) * R)
        p1 = (math.cos(t1) * R, y0, math.sin(t1) * R)
        reg = a if i % 2 == 0 else b
        face(m, [p0, p1, (0, y1, 0)], reg, (0, 1, 0))
        face(m, [p0, (0, y1 - 0.06, 0), p1], reg, (0, -1, 0))
        face(m, [p0, p1, (p1[0] * 1.0, y0 - 0.15, p1[2] * 1.0), (p0[0], y0 - 0.15, p0[2])], reg, (math.cos((t0 + t1) / 2), 0, math.sin((t0 + t1) / 2)))
    return _obj(m)


def cs_ombrellone_rosso():
    return _ombrellone('cs_ombrellone_rosso', 'p_rosso', 'p_pietra_chiara')


def cs_ombrellone_blu():
    return _ombrellone('cs_ombrellone_blu', 'p_acqua_profonda', 'p_pietra_chiara')


def cs_ombrellone_giallo():
    return _ombrellone('cs_ombrellone_giallo', 'p_giallo', 'p_arancio')


def cs_sdraio():
    """Lettino da spiaggia col telo a strisce."""
    m = Mesh('cs_sdraio')
    face(m, [(-0.3, 0.32, 0.9), (0.3, 0.32, 0.9), (0.3, 0.32, -0.2), (-0.3, 0.32, -0.2)], 'cs_tenda_blu', (0, 1, 0))
    face(m, [(-0.3, 0.32, -0.2), (0.3, 0.32, -0.2), (0.3, 0.85, -0.75), (-0.3, 0.85, -0.75)], 'cs_tenda_blu', (0, 1, 0.5))
    for sx in (-1, 1):
        beam(m, (sx * 0.3, 0.32, 0.9), (sx * 0.3, 0.32, -0.2), 0.05, 0.05, 'p_pietra_chiara')
        beam(m, (sx * 0.3, 0.32, -0.2), (sx * 0.3, 0.85, -0.75), 0.05, 0.05, 'p_pietra_chiara')
        for zz in (0.85, -0.15):
            beam(m, (sx * 0.3, 0, zz), (sx * 0.3, 0.32, zz), 0.05, 0.05, 'p_pietra_chiara')
    return _obj(m)


def cs_faro():
    """Il faro a strisce bianche e rosse con la casetta del guardiano (14 m): sta al centro del tornante del Lungomare."""
    m = Mesh('cs_faro')
    m.prism(8, 2.0, 1.9, 0, 0.6, 'cs_muro_mare', top='p_pietra')
    r = lambda y: 1.35 - y * 0.035
    y, k = 0.6, 0
    while y < 11.0:
        y1 = min(11.0, y + 1.6)
        m.prism(10, r(y), r(y1), y, y1, 'p_pietra_chiara' if k % 2 == 0 else 'p_rosso')
        y, k = y1, k + 1
    m.prism(10, r(11) + 0.45, r(11) + 0.45, 11.0, 11.25, 'p_nero_caldo', top='p_roccia', bottom='p_nero_caldo')
    m.prism(8, 0.75, 0.75, 11.25, 12.4, 'em_faro', mat=EM)
    m.cone(8, 0.95, 12.4, 13.3, 'p_rosso', bottom='p_nero_caldo')
    beam(m, (0, 13.3, 0), (0, 13.9, 0), 0.06, 0.06, 'p_nero_caldo')
    for i in range(10):
        a, b = 2 * math.pi * i / 10, 2 * math.pi * (i + 1) / 10
        rr = r(11) + 0.4
        beam(m, (math.cos(a) * rr, 11.75, math.sin(a) * rr), (math.cos(b) * rr, 11.75, math.sin(b) * rr), 0.04, 0.04, 'p_nero_caldo')
    face(m, [(-0.4, 0.6, -r(0.6) - 0.02), (0.4, 0.6, -r(0.6) - 0.02), (0.4, 2.4, -r(2.4) - 0.02), (-0.4, 2.4, -r(2.4) - 0.02)], 'cs_porta', (0, 0, -1))
    for yy in (4.5, 7.6):
        face(m, [(-0.25, yy, -r(yy) - 0.02), (0.25, yy, -r(yy) - 0.02), (0.25, yy + 0.7, -r(yy + 0.7) - 0.02), (-0.25, yy + 0.7, -r(yy + 0.7) - 0.02)], 'em_finestra', (0, 0, -1), mat=EM)
    # casetta del guardiano attaccata dietro
    F, I = 'cs_finestra', 'cs_intonaco'
    _casa(m, 4.0, 3.5, 1, [[I, I]], [[F, I]], x=2.6, z=1.6)
    return _obj(m)


def _sasso(m, cx, cz, rx, ry, rz, seed, reg='cs_scoglio', n=7):
    """Scoglio sfaccettato: anello basso, anello medio sfalsato, punta, con un po' di rumore."""
    rings = []
    for k, (fy, fr) in enumerate(((0.0, 1.0), (0.45, 0.95), (0.85, 0.55))):
        pts = []
        for i in range(n):
            a = 2 * math.pi * (i + 0.5 * k) / n
            j = 0.8 + 0.4 * h01(i, k, seed)
            pts.append((cx + math.cos(a) * rx * fr * j, ry * fy, cz + math.sin(a) * rz * fr * j))
        rings.append(pts)
    m.loft(rings, reg)
    top = (cx + rx * 0.1 * (h01(9, 9, seed) - 0.5), ry, cz)
    for i in range(n):
        face(m, [rings[-1][i], rings[-1][(i + 1) % n], top], reg, (0, 1, 0))


def cs_scoglio_a():
    m = Mesh('cs_scoglio_a')
    _sasso(m, 0, 0, 2.2, 2.4, 1.8, 41)
    _sasso(m, 1.6, 0.9, 1.1, 1.2, 1.0, 42)
    return _obj(m)


def cs_scoglio_b():
    m = Mesh('cs_scoglio_b')
    _sasso(m, 0, 0, 1.3, 1.1, 1.4, 43, n=6)
    _sasso(m, -1.2, -0.5, 0.7, 0.6, 0.6, 44, n=5)
    _sasso(m, 0.9, -0.9, 0.5, 0.45, 0.5, 45, n=5)
    return _obj(m)


def cs_barca_vela():
    """Barca a vela bianca (6 m): scafo, albero e due vele."""
    m = Mesh('cs_barca_vela')
    S = [(2.6, 0.9, 0.6, 0.0), (0.5, 1.1, 0.6, -0.4), (-1.5, 0.9, 0.7, -0.35), (-3.0, 0.0, 1.0, 0.1)]  # z, mezza larghezza, bordo, chiglia
    for a, b in zip(S, S[1:]):
        for sx in (1, -1):
            face(m, [(sx * a[1], a[2], a[0]), (sx * b[1], b[2], b[0]), (0, b[3], b[0]), (0, a[3], a[0])], 'p_pietra_chiara', (sx, -0.3, 0))
            face(m, [(sx * a[1], a[2] - 0.12, a[0]), (sx * b[1], b[2] - 0.12, b[0]), (sx * b[1], b[2], b[0]), (sx * a[1], a[2], a[0])], 'p_acqua_profonda', (sx, 0, 0))
        face(m, [(-a[1], a[2], a[0]), (a[1], a[2], a[0]), (b[1], b[2], b[0]), (-b[1], b[2], b[0])], 'tavole', (0, 1, 0))
    face(m, [(-0.9, 0.6, 2.6), (0.9, 0.6, 2.6), (0, 0.0, 2.6)], 'p_pietra_chiara', (0, 0, 1))
    beam(m, (0, 0.6, 0), (0, 7.0, 0), 0.1, 0.1, 'p_pietra')
    face(m, [(0, 1.3, 0.1), (0, 6.8, 0.1), (0, 1.3, 2.4)], 'cs_vela', (1, 0, 0))
    face(m, [(0, 1.3, 0.1), (0, 1.3, 2.4), (0, 6.8, 0.1)], 'cs_vela', (-1, 0, 0))
    face(m, [(0, 1.0, -0.1), (0, 6.0, -0.1), (0, 0.9, -2.8)], 'p_pietra_chiara', (1, 0, 0))
    face(m, [(0, 1.0, -0.1), (0, 0.9, -2.8), (0, 6.0, -0.1)], 'p_pietra_chiara', (-1, 0, 0))
    return _obj(m)


def cs_tribuna():
    """Tribuna di legno da 8 m con 3 gradoni, tettoia a strisce e striscione: i manichini si siedono sui gradoni (y 0,6 / 1,2 / 1,8)."""
    m = Mesh('cs_tribuna')
    W = 4.0
    for k in range(3):
        y, z = 0.6 * (k + 1), 0.9 * k
        m.box(-W, y - 0.15, z - 0.45, W, y, z + 0.45, 'tavole', skip=('bottom',))
        face(m, [(-W, 0, z - 0.45), (W, 0, z - 0.45), (W, y - 0.15, z - 0.45), (-W, y - 0.15, z - 0.45)], 'legno_scuro', (0, 0, -1))
    for xx in (-W, -W / 3, W / 3, W):
        beam(m, (xx, 0, 2.3), (xx, 4.0, 2.3), 0.16, 0.16, 'legno_scuro')
        beam(m, (xx, 0, -0.45), (xx, 3.6, -0.45), 0.12, 0.12, 'legno_scuro')
    face(m, [(-W - 0.3, 3.6, -0.8), (W + 0.3, 3.6, -0.8), (W + 0.3, 4.1, 2.5), (-W - 0.3, 4.1, 2.5)], 'cs_tenda_rossa', (0, 1, 0))
    face(m, [(-W - 0.3, 3.6, -0.8), (-W - 0.3, 4.1, 2.5), (W + 0.3, 4.1, 2.5), (W + 0.3, 3.6, -0.8)], 'cs_tenda_rossa', (0, -1, 0))
    face(m, [(-W, 0.0, 2.35), (W, 0.0, 2.35), (W, 2.3, 2.35), (-W, 2.3, 2.35)], 'legno_scuro', (0, 0, 1))
    _pannelli(m, -W, W, 2.9, 3.55, -0.5, ['cs_sponsor'] * 4, (0, 0, -1))
    return _obj(m)


def cs_arco_via():
    """Portale del via (10 m di luce, il client lo scala sulla larghezza della pista): due torri a scacchi e lo striscione."""
    m = Mesh('cs_arco_via')
    L = 5.0
    for sx in (-1, 1):
        m.box(sx * L - 0.5, 0, -0.5, sx * L + 0.5, 6.0, 0.5, 'cs_scacchi', top='p_nero_caldo', skip=('bottom',))
    m.box(-L - 0.5, 4.6, -0.3, L + 0.5, 6.0, 0.3, 'cs_sponsor', top='p_rosso', bottom='p_nero_caldo')
    _pannelli(m, -L, L, 4.6, 6.0, -0.31, ['cs_sponsor'] * 5, (0, 0, -1))
    _pannelli(m, -L, L, 4.6, 6.0, 0.31, ['cs_sponsor'] * 5, (0, 0, 1))
    for sx in (-1, 1):  # bandierine sulle torri
        beam(m, (sx * L, 6.0, 0), (sx * L, 7.4, 0), 0.06, 0.06, 'p_nero_caldo')
        face(m, [(sx * L, 7.35, 0), (sx * L + sx * 1.0, 7.1, 0), (sx * L, 6.8, 0)], 'p_rosso', (0, 0, -1))
        face(m, [(sx * L, 7.35, 0), (sx * L, 6.8, 0), (sx * L + sx * 1.0, 7.1, 0)], 'p_rosso', (0, 0, 1))
    return _obj(m)


def _manichino(name, maglia, seduto=False):
    """Manichino del pubblico senza testa (la testa è `cs_manichino_testa`, girata dal client): legno chiaro, giunture scure,
    maglietta colorata, braccia alzate ad applaudire. In piedi alto 1,6 m (collo a 1,38), seduto sul gradone (collo a 0,95 sopra il sedile)."""
    m = Mesh(name)
    J = 'p_legno'
    if seduto:
        for sx in (-1, 1):
            beam(m, (sx * 0.1, 0.0, 0.0), (sx * 0.1, 0.0, -0.42), 0.12, 0.12, 'cs_manichino')  # cosce
            beam(m, (sx * 0.1, 0.0, -0.42), (sx * 0.1, -0.45, -0.45), 0.1, 0.1, 'cs_manichino')
        y0 = 0.0
    else:
        for sx in (-1, 1):
            beam(m, (sx * 0.1, 0.0, 0), (sx * 0.1, 0.42, 0), 0.1, 0.1, 'cs_manichino', end=J)
            beam(m, (sx * 0.1, 0.42, 0), (sx * 0.1, 0.8, 0), 0.12, 0.12, 'cs_manichino', end=J)
        y0 = 0.8
    beam(m, (0, y0 - 0.02, 0), (0, y0 + 0.12, 0), 0.32, 0.2, maglia, end=maglia)  # bacino (pantaloncini col colore)
    m.prism(6, 0.17, 0.21, y0 + 0.12, y0 + 0.5, maglia, top=maglia)              # busto
    beam(m, (0, y0 + 0.5, 0), (0, y0 + 0.58, 0), 0.08, 0.08, J)                 # collo
    for sx in (-1, 1):  # braccia: spalla, gomito in avanti, mani giunte davanti al petto
        sh = (sx * 0.22, y0 + 0.45, 0)
        el = (sx * 0.24, y0 + 0.28, -0.2)
        ha = (sx * 0.05, y0 + 0.5, -0.3)
        beam(m, sh, el, 0.08, 0.08, 'cs_manichino', end=J)
        beam(m, el, ha, 0.07, 0.07, 'cs_manichino', end='cs_manichino')
    return _obj(m)


def cs_manichino_rosso():
    return _manichino('cs_manichino_rosso', 'p_rosso')


def cs_manichino_blu():
    return _manichino('cs_manichino_blu', 'p_acqua_profonda')


def cs_manichino_giallo():
    return _manichino('cs_manichino_giallo', 'p_giallo', seduto=True)


def cs_manichino_verde():
    return _manichino('cs_manichino_verde', 'p_erba_scura', seduto=True)


def cs_manichino_testa():
    """Testa del manichino: ovale liscio senza faccia, legno chiaro, pivot alla base del collo, davanti −Z."""
    m = Mesh('cs_manichino_testa')
    rings = []
    for fy, fr in ((0.0, 0.5), (0.1, 0.95), (0.24, 0.9), (0.33, 0.4)):
        rings.append(m.ring(6, 0.12 * fr, fy, rz=0.135 * fr))
    m.loft(rings, 'cs_manichino', bottom='p_legno', top='cs_manichino')
    return _obj(m)


def cs_container():
    """Container da 6 m (2,6 m di lato), lamiera ondulata blu; ci sono anche rosso e verde. Il client li impila."""
    m = Mesh('cs_container')
    m.box(-1.3, 0, -3.0, 1.3, 2.6, 3.0, 'cs_container_blu', skip=('bottom',))
    return _obj(m)


def cs_container_rosso():
    m = Mesh('cs_container_rosso')
    m.box(-1.3, 0, -3.0, 1.3, 2.6, 3.0, 'cs_container_rosso', skip=('bottom',))
    return _obj(m)


def cs_container_verde():
    m = Mesh('cs_container_verde')
    m.box(-1.3, 0, -3.0, 1.3, 2.6, 3.0, 'cs_container_verde', skip=('bottom',))
    return _obj(m)


def _gru(name, reg, base):
    """Gru del porto (portale a traliccio, cabina, braccio inclinato con il cavo): alta ~16 m."""
    m = Mesh(name)
    for sx in (-1, 1):
        for sz in (-1, 1):
            beam(m, (sx * 2.2, 0, sz * 2.2), (sx * 1.2, 7.0, sz * 1.2), 0.5, 0.5, reg)
    for y in (2.5, 5.5):
        k = 2.2 - (y / 7.0) * 1.0
        for a, b in (((-k, -k), (k, -k)), ((k, -k), (k, k)), ((k, k), (-k, k)), ((-k, k), (-k, -k))):
            beam(m, (a[0], y, a[1]), (b[0], y, b[1]), 0.3, 0.3, reg)
    m.box(-1.6, 7.0, -1.6, 1.6, 7.4, 1.6, base, skip=())
    m.box(-1.3, 7.4, -0.4, 1.3, 9.6, 2.2, base, skip=('bottom',))                 # sala macchine
    m.box(-1.0, 7.8, -1.6, 1.0, 9.4, -0.4, 'vetro', top=base, skip=('bottom',))  # cabina
    beam(m, (0, 9.0, 0.5), (0, 16.0, -11.0), 0.8, 0.8, reg, end=base)            # braccio
    beam(m, (0, 9.6, 1.8), (0, 12.5, 1.0), 0.3, 0.3, reg)
    beam(m, (0, 12.5, 1.0), (0, 16.0, -11.0), 0.08, 0.08, 'p_nero_caldo')
    beam(m, (0, 16.0, -11.0), (0, 8.0, -11.0), 0.06, 0.06, 'p_nero_caldo')      # cavo
    m.box(-0.4, 7.6, -11.4, 0.4, 8.0, -10.6, 'cs_pericolo', skip=())            # gancio
    m.box(-2.6, 0, -2.6, 2.6, 0.5, 2.6, 'cs_pericolo', top='p_roccia', skip=('bottom',))
    return _obj(m)


def cs_gru_rossa():
    return _gru('cs_gru_rossa', 'cs_gru_rossa', 'p_rosso')


def cs_gru_blu():
    return _gru('cs_gru_blu', 'cs_gru_blu', 'p_acqua_profonda')


def cs_bancarella():
    """Bancarella del pesce: banco con le cassette, tenda a strisce blu, insegna col pesce."""
    m = Mesh('cs_bancarella')
    m.box(-1.6, 0, -0.5, 1.6, 0.9, 0.5, 'tavole', top='legno_scuro', skip=('bottom',))
    for i, xx in enumerate((-1.1, 0.0, 1.1)):
        m.box(xx - 0.45, 0.9, -0.4, xx + 0.45, 1.1, 0.3, 'cassa', top=('p_rosso', 'p_pietra_chiara', 'p_arancio')[i], skip=('bottom',))
    for xx in (-1.6, 1.6):
        for zz in (-0.5, 0.9):
            beam(m, (xx, 0, zz), (xx, 2.3 if zz < 0 else 2.7, zz), 0.08, 0.08, 'legno_scuro')
    face(m, [(-1.8, 2.7, 1.0), (1.8, 2.7, 1.0), (1.8, 2.2, -0.9), (-1.8, 2.2, -0.9)], 'cs_tenda_blu', (0, 1, -0.3))
    face(m, [(-1.8, 2.7, 1.0), (-1.8, 2.2, -0.9), (1.8, 2.2, -0.9), (1.8, 2.7, 1.0)], 'cs_tenda_blu', (0, -1, 0.3))
    face(m, [(-1.8, 2.2, -0.9), (1.8, 2.2, -0.9), (1.8, 1.95, -0.9), (-1.8, 1.95, -0.9)], 'cs_tenda_blu', (0, 0, -1))
    face(m, [(-0.8, 2.75, 1.0), (0.8, 2.75, 1.0), (0.8, 3.55, 1.0), (-0.8, 3.55, 1.0)], 'cs_pesce', (0, 0, -1))
    face(m, [(-0.8, 2.75, 1.01), (-0.8, 3.55, 1.01), (0.8, 3.55, 1.01), (0.8, 2.75, 1.01)], 'cs_pesce', (0, 0, 1))
    return _obj(m)


def cs_bitta():
    """Palo d'ormeggio col cappello bianco e il salvagente appeso."""
    m = Mesh('cs_bitta')
    m.prism(6, 0.22, 0.22, 0, 1.3, 'legno_scuro', top='p_pietra_chiara')
    m.prism(6, 0.24, 0.24, 1.3, 1.5, 'p_pietra_chiara', top='p_pietra_chiara')
    n = 8
    for i in range(n):
        a, b = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        c = (0, 0.75, -0.3)
        reg = 'p_rosso' if i % 2 == 0 else 'p_pietra_chiara'
        po = lambda t, r: (c[0] + math.cos(t) * r, c[1] + math.sin(t) * r, c[2])
        face(m, [po(a, 0.35), po(b, 0.35), po(b, 0.2), po(a, 0.2)], reg, (0, 0, -1))
    return _obj(m)


def cs_barriera():
    """Barriera di plastica con le frecce rosse e bianche (2 m), davanti −Z."""
    m = Mesh('cs_barriera')
    m.box(-1.0, 0, -0.3, 1.0, 0.25, 0.3, 'p_rosso', skip=('bottom',))
    m.box(-1.0, 0.25, -0.15, 1.0, 1.0, 0.15, 'p_pietra_chiara', top='p_pietra_chiara', skip=('bottom', 'front', 'back'))
    face(m, [(-1.0, 0.25, -0.16), (1.0, 0.25, -0.16), (1.0, 1.0, -0.16), (-1.0, 1.0, -0.16)], 'cs_chevron', (0, 0, -1))
    face(m, [(-1.0, 0.25, 0.16), (1.0, 0.25, 0.16), (1.0, 1.0, 0.16), (-1.0, 1.0, 0.16)], 'cs_chevron', (0, 0, 1))
    return _obj(m)


def cs_cartello():
    """Cartello della curva su due pali (frecce verso sinistra), 3 m di larghezza."""
    m = Mesh('cs_cartello')
    for xx in (-1.2, 1.2):
        beam(m, (xx, 0, 0.05), (xx, 1.9, 0.05), 0.1, 0.1, 'p_pietra')
    _pannelli(m, -1.5, 1.5, 1.0, 2.0, -0.02, ['cs_chevron', 'cs_chevron'], (0, 0, -1))
    face(m, [(-1.5, 1.0, 0.0), (-1.5, 2.0, 0.0), (1.5, 2.0, 0.0), (1.5, 1.0, 0.0)], 'p_pietra', (0, 0, 1))
    return _obj(m)


def cs_cabina():
    """Cabina da spiaggia a strisce col tetto a punta."""
    m = Mesh('cs_cabina')
    m.box(-0.8, 0, -0.8, 0.8, 2.2, 0.8, 'cs_cabina', skip=('top',))
    face(m, [(-0.35, 0.1, -0.81), (0.35, 0.1, -0.81), (0.35, 1.8, -0.81), (-0.35, 1.8, -0.81)], 'p_pietra_chiara', (0, 0, -1))
    m.cone(4, 1.25, 2.2, 3.0, 'p_rosso', bottom='p_pietra_chiara', a0=math.pi / 4)
    return _obj(m)


def cs_pino():
    """Pino marittimo a ombrello: tronco storto e chioma piatta a due piani."""
    m = Mesh('cs_pino')
    pts = [(0, 0, 0), (0.3, 2.0, 0.1), (0.9, 4.0, 0.2), (1.2, 5.4, 0.25)]
    rs = [0.28, 0.22, 0.18, 0.15]
    m.loft([m.ring(6, r, y, cx=x, cz=z) for (x, y, z), r in zip(pts, rs)], 'corteccia')
    for cx, cy, cz, r, h in ((1.2, 5.2, 0.25, 2.8, 1.1), (0.4, 4.6, -0.6, 1.7, 0.8)):
        lo = m.ring(8, r, cy, cx=cx, cz=cz)
        mi = m.ring(8, r * 0.9, cy + h * 0.55, cx=cx, cz=cz, a0=0.2)
        m.loft([lo, mi], 'erba_b', bottom='p_bosco_ombra')
        tip = (cx, cy + h, cz)
        for i in range(8):
            face(m, [mi[i], mi[(i + 1) % 8], tip], 'erba_b', (0, 1, 0))
    return _obj(m)


def cs_arco_roccia():
    """Arco di roccia in mezzo alla baia: due piloni e la volta, ~12 m di luce."""
    m = Mesh('cs_arco_roccia')
    _sasso(m, -7.0, 0, 3.2, 9.0, 3.0, 51)
    _sasso(m, 7.0, 0.5, 3.0, 8.0, 2.8, 52)
    sez = lambda x, y: [(x, y - 1.6, -2.2), (x, y - 1.6, 2.2), (x, y + 1.6, 2.0), (x, y + 1.8, -2.0)]
    arco = [(-7.0, 7.5), (-3.5, 10.0), (0.0, 10.8), (3.5, 10.0), (7.0, 7.0)]
    for (xa, ya), (xb, yb) in zip(arco, arco[1:]):
        A, B = sez(xa, ya), sez(xb, yb)
        for i in range(4):
            j = (i + 1) % 4
            mid = ((xa + xb) / 2, (ya + yb) / 2, 0)
            fc = [(A[i][k] + A[j][k] + B[i][k] + B[j][k]) / 4 for k in range(3)]
            face(m, [A[i], A[j], B[j], B[i]], 'cs_scoglio', (fc[0] - mid[0], fc[1] - mid[1], fc[2] - mid[2]))
    return _obj(m)


MODELS = {f.__name__: f for f in (
    cs_casa_a, cs_casa_b, cs_casa_c, cs_lampione, cs_ombrellone_rosso, cs_ombrellone_blu, cs_ombrellone_giallo, cs_sdraio, cs_faro,
    cs_scoglio_a, cs_scoglio_b, cs_barca_vela, cs_tribuna, cs_arco_via,
    cs_manichino_rosso, cs_manichino_blu, cs_manichino_giallo, cs_manichino_verde, cs_manichino_testa,
    cs_container, cs_container_rosso, cs_container_verde, cs_gru_rossa, cs_gru_blu, cs_bancarella, cs_bitta, cs_barriera,
    cs_cartello, cs_cabina, cs_pino, cs_arco_roccia)}
