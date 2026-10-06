# Mondo Sotterraneo (6 ott 2026) — ingressi, edifici dell'isola (Banco, Alchimia, Forziere, Serra L1-L3),
# kit dei 3 dungeon, nemici statici, armi, fiammata. Convenzioni come gli altri models_*.py: coordinate di gioco
# (x destra, y su, davanti −Z), 1 unità = 1 m, pivot a terra al centro.
# - Manifest principale: prop_ingresso_*, bld_banco/alchimia/forziere/serra_l1..l3.
# - manifest_rpg.json (lo separa tools/build_assets.mjs): dng_*, nem_*, arm_*, fx_*, prop_sacco.
# - dng_*: il piano di calpestio è y = 0 (pavimenti con bordo che scende a −0,3), muri da 0 a 2,4 (bassi 0,6).
#   dng_torcia: origine sulla faccia del muro a terra, sporge verso −Z (anchor «fiamma»).
# - nem_*: piedi a terra all'origine, guardano −Z, statici (il client li anima con inclinazioni e affondi).
# - arm_*: impugnatura all'origine, lama/punta verso +Y; le facce della lama/testa usano `mat_lama` (maschera bianca
#   dell'atlas, regione `lama`): il client la tinge col colore del materiale.
# - fx_fiammata: centro della palla all'origine (non a terra), coda verso +Z (vola verso −Z).
import math
from contextlib import contextmanager
from lib import Mesh, Xf, beam, face, roof, log, key, _sub, _dot, _cross, _norm
from atlas import h01
from models_edifici import lantern
from models_m1 import lantern_lite, walls, gables, win, posts, skirt, hip, railing, stone_lantern, sign, noren

EM = 'mat_emissivo'
LAMA = 'mat_lama'


def _obj(m, **info):
    return ([m.build()], info) if info else [m.build()]


FP = lambda w, d: {'footprint': [w, d]}


# ------------------------------------------------------------------ aiuti geometrici
def _add(a, b): return (a[0] + b[0], a[1] + b[1], a[2] + b[2])
def _mul(a, k): return (a[0] * k, a[1] * k, a[2] * k)
def _mid(*ps): return tuple(sum(p[k] for p in ps) / len(ps) for k in range(3))


def _dedup(q):
    out = []
    for p in q:
        if not out or key(out[-1]) != key(p):
            out.append(p)
    if len(out) > 1 and key(out[0]) == key(out[-1]):
        out.pop()
    return out


@contextmanager
def xf(m, t=(0, 0, 0), r=(0, 0, 0), s=1, pivot=(0, 0, 0)):
    """Trasforma tutto ciò che si costruisce nel blocco: scala e ruota attorno a `pivot`, poi trasla di t."""
    m.push(Xf(t=_add(pivot, t)))
    m.push(Xf(r=r, s=s))
    m.push(Xf(t=_mul(pivot, -1)))
    try:
        yield m
    finally:
        m.pop(); m.pop(); m.pop()


def tube(m, pts, radii, n, region, cap0=None, cap1=None, a0=None, **o):
    """Tubo a sezione n-gonale lungo una polilinea (trasporto parallelo, niente torsioni). radii: r o (ra, rb) per punto; 0 = punta."""
    rings, a_prev = [], None
    base = math.pi / n if a0 is None else a0
    for i, p in enumerate(pts):
        if i == 0:
            d = _sub(pts[1], p)
        elif i == len(pts) - 1:
            d = _sub(p, pts[i - 1])
        else:
            d = _add(_norm(_sub(p, pts[i - 1])), _norm(_sub(pts[i + 1], p)))
        d = _norm(d)
        if a_prev is None:
            up = (0, 1, 0) if abs(d[1]) < 0.9 else (0, 0, -1)
            a = _norm(_cross(d, up))
        else:
            a = _norm(_sub(a_prev, _mul(d, _dot(a_prev, d))))
        b = _norm(_cross(a, d))
        a_prev = a
        r = radii[i]
        ra, rb = r if isinstance(r, tuple) else (r, r)
        rings.append([tuple(p[k] + a[k] * math.cos(base + 2 * math.pi * j / n) * ra + b[k] * math.sin(base + 2 * math.pi * j / n) * rb
                            for k in range(3)) for j in range(n)])
    for i in range(len(pts) - 1):
        axis = _norm(_sub(pts[i + 1], pts[i]))
        c = _mid(pts[i], pts[i + 1])
        for j in range(n):
            jj = (j + 1) % n
            q = _dedup([rings[i][j], rings[i][jj], rings[i + 1][jj], rings[i + 1][j]])
            if len(q) < 3:
                continue
            rad = _sub(_mid(*q), c)
            rad = _sub(rad, _mul(axis, _dot(rad, axis)))
            face(m, q, region, rad, **o)
    if cap0 and radii[0] != 0:
        face(m, rings[0], cap0, _sub(pts[0], pts[1]), **o)
    if cap1 and radii[-1] != 0:
        face(m, rings[-1], cap1, _sub(pts[-1], pts[-2]), **o)
    return rings


def blob(m, c, rx, ry, rz, region, n=6, k=4, jit=0.0, seed=0, a0=0.0, **o):
    """Ellissoide low-poly (poli in alto e in basso), facce orientate dal centro."""
    top, bot = (c[0], c[1] + ry, c[2]), (c[0], c[1] - ry, c[2])
    rings = []
    for i in range(1, k):
        t = math.pi * i / k
        y, s = c[1] + math.cos(t) * ry, math.sin(t)
        ring = []
        for j in range(n):
            a = a0 + 2 * math.pi * j / n
            f = 1 + jit * (h01(i, j, seed) - 0.5)
            ring.append((c[0] + math.cos(a) * rx * s * f, y + jit * 0.3 * ry * (h01(j, i, seed + 1) - 0.5), c[2] + math.sin(a) * rz * s * f))
        rings.append(ring)
    for j in range(n):
        jj = (j + 1) % n
        for tri in ([top, rings[0][j], rings[0][jj]], [bot, rings[-1][j], rings[-1][jj]]):
            face(m, tri, region, _sub(_mid(*tri), c), **o)
        for i in range(len(rings) - 1):
            q = [rings[i][j], rings[i][jj], rings[i + 1][jj], rings[i + 1][j]]
            face(m, q, region, _sub(_mid(*q), c), **o)


def dome(m, c, rx, h, rz, region, n=8, k=3, jit=0.0, seed=0, top_region=None, **o):
    """Cupola a terra (niente fondo): anelli che si stringono verso l'alto, punta in cima."""
    rings = []
    for i in range(k):
        t = i / k
        s = math.cos(t * math.pi / 2) ** 0.8
        y = c[1] + h * (t ** 0.9) * (1 if i else 0)
        ring = []
        for j in range(n):
            a = 2 * math.pi * j / n
            f = 1 + jit * (h01(i, j, seed) - 0.5)
            ring.append((c[0] + math.cos(a) * rx * s * f, y + (jit * 0.25 * h * (h01(j, i, seed + 3) - 0.5) if i else 0), c[2] + math.sin(a) * rz * s * f))
        rings.append(ring)
    top = (c[0] + jit * 0.1 * rx, c[1] + h, c[2])
    for j in range(n):
        jj = (j + 1) % n
        for i in range(k - 1):
            q = [rings[i][j], rings[i][jj], rings[i + 1][jj], rings[i + 1][j]]
            face(m, q, region, _sub(_mid(*q), (c[0], c[1] + h * 0.2, c[2])), **o)
        tri = [rings[-1][j], rings[-1][jj], top]
        face(m, tri, top_region or region, _sub(_mid(*tri), (c[0], c[1], c[2])), **o)


def slab(m, prof, z0, z1, region, side=None, **o):
    """Profilo 2D (x, y) estruso tra z0 e z1 (lame, teste d'ascia, sagome)."""
    area = sum(p[0] * q[1] - q[0] * p[1] for p, q in zip(prof, prof[1:] + prof[:1]))
    if area < 0:
        prof = list(reversed(prof))
    face(m, [(x, y, z0) for x, y in prof], region, (0, 0, -1), **o)
    face(m, [(x, y, z1) for x, y in prof], region, (0, 0, 1), **o)
    for p, q in zip(prof, prof[1:] + prof[:1]):
        face(m, [(p[0], p[1], z0), (q[0], q[1], z0), (q[0], q[1], z1), (p[0], p[1], z1)], side or region, (q[1] - p[1], -(q[0] - p[0]), 0), **o)


def band(m, c, rx, rz, y0, y1, region, n=8, both=True, **o):
    """Anello piatto verticale (costola, cerchio di ferro): facce esterne e, se both, interne."""
    ring = lambda y: [(c[0] + math.cos(2 * math.pi * j / n) * rx, y, c[2] + math.sin(2 * math.pi * j / n) * rz) for j in range(n)]
    a, b = ring(y0), ring(y1)
    for j in range(n):
        jj = (j + 1) % n
        q = [a[j], a[jj], b[jj], b[j]]
        rad = _sub(_mid(*q), (c[0], _mid(*q)[1], c[2]))
        face(m, q, region, rad, **o)
        if both:
            face(m, q, region, _mul(rad, -1), **o)


def quad2(m, pts, region, n, **o):
    """Quadrilatero a due facce (foglie, stoffe, raggi di luce)."""
    face(m, pts, region, n, **o)
    face(m, pts, region, _mul(n, -1), **o)


def cone_dir(m, base, tip, r, n, region, **o):
    """Cono orientato da base a punta (cristalli, spuntoni, artigli)."""
    tube(m, [base, tip], [r, 0], n, region, **o)


def crystal(m, base, tip, r, region='em_cristallo', mat=EM):
    """Cristallo: fusto a 4 facce e punta (12 tri)."""
    d = _sub(tip, base)
    mid = _add(base, _mul(d, 0.7))
    tube(m, [base, mid, tip], [r, r * 0.9, 0], 4, region, mat=mat)


# ------------------------------------------------------------------ INGRESSI (4×4 m, manifest principale)
def prop_ingresso_grotta():
    """Bocca di grotta nella roccia (Isola Selvaggia): arco di massi davanti a un dosso, buio dentro, torcia accesa."""
    m = Mesh('prop_ingresso_grotta')
    dome(m, (0, 0, 0.4), 1.9, 2.7, 1.55, 'roccia_lato', n=8, k=3, jit=0.25, seed=3, top_region='roccia')
    # bocca buia (arco) davanti al dosso
    arch = [(-0.7, 0.0), (0.7, 0.0), (0.72, 1.1), (0.45, 1.55), (0.0, 1.7), (-0.45, 1.55), (-0.72, 1.1)]
    face(m, [(x, y, -1.22) for x, y in arch], 'p_nero_caldo', (0, 0, -1))
    face(m, [(-0.7, 0.01, -1.22), (0.7, 0.01, -1.22), (0.6, 0.01, -1.55), (-0.6, 0.01, -1.55)], 'grotta_pav', (0, 1, 0))
    # pilastri e architrave di roccia
    for s in (-1, 1):
        tube(m, [(s * 1.05, 0, -1.3), (s * 1.12, 0.95, -1.32), (s * 1.0, 1.85, -1.28)], [0.42, 0.38, 0.3], 5, 'roccia_lato', cap1='roccia', a0=0.3 * s)
    tube(m, [(-1.4, 1.9, -1.3), (0.0, 2.08, -1.38), (1.4, 1.92, -1.3)], [(0.32, 0.36), (0.36, 0.42), (0.32, 0.36)], 5, 'roccia_lato', cap0='roccia', cap1='roccia')
    # massi sparsi, ciuffi d'erba, liane
    for i, (x, z, r) in enumerate(((-1.7, -1.5, 0.32), (1.65, -1.2, 0.26), (1.4, -1.85, 0.2), (-0.95, -1.85, 0.18))):
        m.cone(5, r, 0.0, r * 1.3, 'roccia', cx=x, cz=z, a0=h01(i, 1, 4) * 3)
    for x, z in ((-0.4, -1.4), (0.5, -1.45)):
        m.cone(4, 0.22, 2.0, 2.38, 'erba_alta', cx=x, cz=z)
    for x, l in ((-0.5, 0.6), (0.15, 0.85), (0.55, 0.5)):
        quad2(m, [(x - 0.06, 1.85, -1.62), (x + 0.06, 1.85, -1.62), (x + 0.04, 1.85 - l, -1.62), (x - 0.04, 1.85 - l, -1.62)], 'foglie', (0, 0, -1))
    # torcia piantata accanto alla bocca
    beam(m, (1.45, 0, -1.75), (1.45, 1.1, -1.75), 0.06, 0.06, 'legno_pieno', n=3)
    tube(m, [(1.45, 1.0, -1.75), (1.45, 1.12, -1.75), (1.45, 1.45, -1.75)], [0.06, 0.12, 0], 5, 'em_fuoco', mat=EM)
    return _obj(m, **FP(4, 4))


def prop_ingresso_cripta():
    """Porta di pietra di una cripta (Porto): mausoleo di pietra chiara, tetto di tegole, lastra socchiusa, tōrō accese."""
    m = Mesh('prop_ingresso_cripta')
    m.box(-1.9, 0, -1.7, 1.9, 0.2, 1.9, 'pietra_cripta', top='pietra_liscia', skip=('bottom',))
    m.box(-0.8, 0, -2.0, 0.8, 0.1, -1.7, 'pietra_cripta', top='pietra_liscia', skip=('bottom', 'back'))
    x0, x1, z0, z1, y0, y1 = -1.3, 1.3, -0.9, 1.3, 0.2, 2.2
    face(m, [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], 'pietra_cripta', (0, 0, 1))
    for x, sx in ((x0, -1), (x1, 1)):
        face(m, [(x, y0, z0), (x, y0, z1), (x, y1, z1), (x, y1, z0)], 'pietra_cripta', (sx, 0, 0))
    dx, dy = 0.55, 1.75
    face(m, [(x0, y0, z0), (-dx, y0, z0), (-dx, y1, z0), (x0, y1, z0)], 'pietra_cripta', (0, 0, -1))
    face(m, [(dx, y0, z0), (x1, y0, z0), (x1, y1, z0), (dx, y1, z0)], 'pietra_cripta', (0, 0, -1))
    face(m, [(-dx, dy, z0), (dx, dy, z0), (dx, y1, z0), (-dx, y1, z0)], 'pietra_cripta', (0, 0, -1))
    face(m, [(-dx, y0, z0 + 0.15), (dx, y0, z0 + 0.15), (dx, dy, z0 + 0.15), (-dx, dy, z0 + 0.15)], 'p_nero_caldo', (0, 0, -1))
    # lastra di pietra scostata: copre metà porta, il buio si vede a destra
    m.box(-0.75, y0, z0 - 0.12, 0.12, dy + 0.05, z0 - 0.02, 'pietra_p', top='pietra_liscia', skip=('bottom',))
    for x in (-dx - 0.06, dx + 0.06):
        beam(m, (x, y0, z0 - 0.05), (x, dy + 0.1, z0 - 0.05), 0.12, 0.12, 'lacca_scura')
    beam(m, (-dx - 0.2, dy + 0.12, z0 - 0.05), (dx + 0.2, dy + 0.12, z0 - 0.05), 0.14, 0.12, 'lacca_scura', end='lacca_scura')
    sign(m, -0.3, 0.3, 1.95, 2.12, z0 - 0.03, 'insegna_h')
    hip(m, -1.55, 1.55, -1.15, 1.55, 2.2, 2.95, top='tegole', curl=0.16)
    for x in (-1.45, 1.45):
        with xf(m, t=(0, 0.2, 0)):
            stone_lantern(m, x, -1.35, 1.25)
    return _obj(m, **FP(4, 4))


def prop_ingresso_vuoto():
    """Portale dimensionale (Distretto Neon): anello di metallo con rune ciano, centro viola neon, base di roccia nera e cristalli."""
    m = Mesh('prop_ingresso_vuoto')
    m.prism(6, 1.85, 1.55, 0, 0.3, 'vuoto_muro', top='vuoto_pav')
    cy, R, r, N = 1.95, 1.4, 0.17, 12
    for i in range(N):
        a0, a1 = 2 * math.pi * i / N, 2 * math.pi * (i + 1) / N
        c0, c1 = (math.cos(a0) * R, cy + math.sin(a0) * R, 0), (math.cos(a1) * R, cy + math.sin(a1) * R, 0)
        for k in range(4):
            b0, b1 = 2 * math.pi * k / 4 + math.pi / 4, 2 * math.pi * (k + 1) / 4 + math.pi / 4
            def p(c, a, b):
                rad = (math.cos(a), math.sin(a), 0)
                return (c[0] + rad[0] * math.cos(b) * r, c[1] + rad[1] * math.cos(b) * r, math.sin(b) * r)
            q = [p(c0, a0, b0), p(c1, a1, b0), p(c1, a1, b1), p(c0, a0, b1)]
            cm = _mid(c0, c1)
            nrm = _sub(_mid(*q), cm)
            inner = _dot(nrm, (math.cos((a0 + a1) / 2), math.sin((a0 + a1) / 2), 0)) < -0.05
            face(m, q, 'em_neon_ciano' if inner else 'metallo', nrm, mat=EM if inner else None)
    disc = [(math.cos(2 * math.pi * i / N) * (R - 0.12), cy + math.sin(2 * math.pi * i / N) * (R - 0.12), 0) for i in range(N)]
    face(m, disc, 'em_vuoto', (0, 0, -1), mat=EM)
    face(m, disc, 'em_vuoto', (0, 0, 1), mat=EM)
    for s in (-1, 1):  # piloni che reggono l'anello
        m.box(s * 1.25 - 0.22, 0.3, -0.3, s * 1.25 + 0.22, 1.2, 0.3, 'metallo', top='vuoto_pav', skip=('bottom',))
    for i, (x, z, h) in enumerate(((-1.3, -1.1, 0.8), (1.45, -0.7, 0.6), (0.9, 1.2, 0.7), (-1.0, 1.1, 0.5))):
        crystal(m, (x, 0.25, z), (x * 1.15, 0.25 + h, z * 1.15), 0.12)
    return _obj(m, **FP(4, 4))


# ------------------------------------------------------------------ pezzi degli edifici
def _bench(m, x0, x1, z0, z1, y=0.75, y0=0.1, top='tavole'):
    m.box(x0, y - 0.08, z0, x1, y, z1, 'legno_pieno', top=top, skip=('bottom',))
    for x in (x0 + 0.06, x1 - 0.06):
        for z in (z0 + 0.06, z1 - 0.06):
            beam(m, (x, y0, z), (x, y - 0.08, z), 0.07, 0.07, 'legno_scuro')


def _anvil(m, x, z, s=1.0, y0=0.1, stump=True):
    if stump:
        m.prism(7, 0.2 * s, 0.18 * s, y0, y0 + 0.34 * s, 'corteccia', top='taglio', cx=x, cz=z)
        y0 += 0.34 * s
    m.box(x - 0.1 * s, y0, z - 0.08 * s, x + 0.1 * s, y0 + 0.06 * s, z + 0.08 * s, 'ferro', skip=('bottom',))
    m.box(x - 0.05 * s, y0 + 0.06 * s, z - 0.05 * s, x + 0.05 * s, y0 + 0.16 * s, z + 0.05 * s, 'ferro', skip=('bottom', 'top'))
    m.box(x - 0.16 * s, y0 + 0.16 * s, z - 0.07 * s, x + 0.12 * s, y0 + 0.24 * s, z + 0.07 * s, 'ferro', top='metallo', skip=('bottom',))
    tube(m, [(x + 0.12 * s, y0 + 0.2 * s, z), (x + 0.3 * s, y0 + 0.22 * s, z)], [0.05 * s, 0], 4, 'ferro')


def _hammer(m, x, y, z, ang=0):
    with xf(m, t=(x, y, z), r=(0, ang, 0)):
        beam(m, (0, 0.02, -0.15), (0, 0.02, 0.12), 0.03, 0.03, 'legno_pieno', n=4)
        m.box(-0.05, 0.0, 0.1, 0.05, 0.07, 0.16, 'ferro', skip=('bottom',))


def _forge(m, x0, z0, x1, z1, h=0.55, y0=0.1, chimney=0.0):
    m.box(x0, y0, z0, x1, y0 + h, z1, 'pietra_p', top='pietra_liscia', skip=('bottom',))
    face(m, [(x0 + 0.08, y0 + h + 0.005, z0 + 0.08), (x1 - 0.08, y0 + h + 0.005, z0 + 0.08), (x1 - 0.08, y0 + h + 0.005, z1 - 0.08), (x0 + 0.08, y0 + h + 0.005, z1 - 0.08)], 'em_fuoco', (0, 1, 0), mat=EM)
    face(m, [(x0 + 0.12, y0 + 0.08, z0 - 0.005), (x1 - 0.12, y0 + 0.08, z0 - 0.005), (x1 - 0.12, y0 + 0.3, z0 - 0.005), (x0 + 0.12, y0 + 0.3, z0 - 0.005)], 'em_fuoco', (0, 0, -1), mat=EM)
    if chimney:
        cx, cz = (x0 + x1) / 2, z1 - 0.12
        m.box(cx - 0.16, y0 + h, cz - 0.12, cx + 0.16, y0 + h + chimney, cz + 0.12, 'pietra_muro', top='nero_p', skip=('bottom',))


def _bellows(m, x, z, y0=0.1, ang=0):
    with xf(m, t=(x, y0, z), r=(0, ang, 0)):
        m.box(-0.12, 0.1, -0.18, 0.12, 0.24, 0.18, 'cuoio', top='legno_pieno', skip=('bottom',))
        beam(m, (0, 0.16, -0.18), (0, 0.16, -0.36), 0.04, 0.04, 'ferro', n=4)
        beam(m, (0, 0.24, 0.18), (0, 0.4, 0.34), 0.03, 0.03, 'legno_pieno', n=3)


def _rack(m, x0, x1, z, y0=0.1, h=1.2, items=('ascia',)):
    for x in (x0, x1):
        beam(m, (x, y0, z), (x, y0 + h, z), 0.07, 0.07, 'legno_scuro', end='legno_scuro')
    beam(m, (x0 - 0.05, y0 + h - 0.1, z), (x1 + 0.05, y0 + h - 0.1, z), 0.06, 0.06, 'legno_scuro', end='legno_scuro')
    beam(m, (x0, y0 + 0.3, z), (x1, y0 + 0.3, z), 0.05, 0.05, 'legno_scuro')
    n = len(items)
    for i, it in enumerate(items):
        x = x0 + (x1 - x0) * (i + 1) / (n + 1)
        if it == 'ascia':
            beam(m, (x, y0 + 0.25, z - 0.06), (x, y0 + 1.05, z - 0.06), 0.035, 0.035, 'legno_pieno', n=4)
            slab(m, [(x, y0 + 0.85), (x + 0.2, y0 + 0.78), (x + 0.22, y0 + 1.02), (x, y0 + 0.98)], z - 0.08, z - 0.05, 'ferro')
        elif it == 'lancia':
            beam(m, (x, y0, z - 0.06), (x, y0 + 1.55, z - 0.06), 0.03, 0.03, 'legno_pieno', n=4)
            tube(m, [(x, y0 + 1.5, z - 0.06), (x, y0 + 1.75, z - 0.06)], [0.04, 0], 4, 'ferro')


def _rack_katana(m, x, z, y0, ylen=0.7):
    slab(m, [(x - 0.022, y0), (x + 0.022, y0), (x + 0.026, y0 + ylen), (x, y0 + ylen + 0.08), (x - 0.02, y0 + ylen)], z - 0.07, z - 0.05, 'ferro', side='metallo')
    beam(m, (x, y0 - 0.22, z - 0.06), (x, y0, z - 0.06), 0.04, 0.04, 'nero_p', n=4)
    m.box(x - 0.06, y0 - 0.01, z - 0.1, x + 0.06, y0 + 0.01, z - 0.02, 'oro', skip=())


def _chest(m, x, z, w, d, h, y0=0.0, open_deg=0.0, rot=0.0, body='tavole_scure', trim='ferro', lock='oro', inside=None):
    """Baule col coperchio a mezza botte (cerniera dietro). open_deg > 0 lo apre all'indietro."""
    with xf(m, t=(x, y0, z), r=(0, rot, 0)):
        m.box(-w / 2, 0, -d / 2, w / 2, h, d / 2, body, skip=('bottom', 'top'))
        if open_deg:
            face(m, [(-w / 2 + 0.03, h - 0.06, -d / 2 + 0.03), (w / 2 - 0.03, h - 0.06, -d / 2 + 0.03), (w / 2 - 0.03, h - 0.06, d / 2 - 0.03), (-w / 2 + 0.03, h - 0.06, d / 2 - 0.03)], inside or 'p_ombra_calda', (0, 1, 0))
            for zz, nz in ((-d / 2, 1), (d / 2, -1)):
                face(m, [(-w / 2, h - 0.06, zz), (w / 2, h - 0.06, zz), (w / 2, h, zz), (-w / 2, h, zz)], body, (0, 0, nz))
        for xx in (-w / 2 + 0.12 * w, w / 2 - 0.12 * w):
            m.box(xx - 0.025, 0, -d / 2 - 0.012, xx + 0.025, h, d / 2 + 0.012, trim, skip=('bottom', 'top'))
        m.box(-0.05, h - 0.14, -d / 2 - 0.03, 0.05, h - 0.02, -d / 2, lock, skip=('back',))
        # coperchio: profilo a mezza botte attorno all'asse x, cerniera in (y=h, z=d/2)
        with xf(m, r=(open_deg, 0, 0), pivot=(0, h, d / 2)):
            R = d / 2
            arc = [(-math.cos(math.pi * i / 4) * R, h + math.sin(math.pi * i / 4) * R * 0.75) for i in range(5)]  # (z, y)
            for (za, ya), (zb, yb) in zip(arc, arc[1:]):
                q = [(-w / 2, ya, za), (w / 2, ya, za), (w / 2, yb, zb), (-w / 2, yb, zb)]
                face(m, q, body, (0, (ya + yb) / 2 - h, (za + zb) / 2))
                for xx in (-w / 2 + 0.12 * w, w / 2 - 0.12 * w):
                    qq = [(xx - 0.025, ya + 0.012, za * 1.03), (xx + 0.025, ya + 0.012, za * 1.03), (xx + 0.025, yb + 0.012, zb * 1.03), (xx - 0.025, yb + 0.012, zb * 1.03)]
                    face(m, qq, trim, (0, (ya + yb) / 2 - h, (za + zb) / 2))
            for xx, sx in ((-w / 2, -1), (w / 2, 1)):
                face(m, [(xx, y, zz) for zz, y in arc], body, (sx, 0, 0))
            if open_deg:
                face(m, [(-w / 2, h, -R), (w / 2, h, -R), (w / 2, h, R), (-w / 2, h, R)], 'legno_scuro', (0, -1, 0))


def _plant(m, x, z, y0, h, r, region='foglie', flower=None, n=5):
    m.cone(n, r, y0, y0 + h, region, cx=x, cz=z, a0=h01(int(x * 10), int(z * 10), 3) * 3)
    if flower:
        m.prism(4, 0.04, 0.05, y0 + h * 0.7, y0 + h * 0.8, flower, top=flower, cx=x + r * 0.4, cz=z - r * 0.3)


def flask(m, x, z, y0, liquid='em_neon_verde', r=0.06, h=0.12):
    """Ampolla: pancia di liquido emissivo, collo di vetro col tappo."""
    m.prism(5, r, r * 0.75, y0, y0 + h, liquid, mat=EM, cx=x, cz=z)
    m.prism(4, r * 0.35, r * 0.35, y0 + h, y0 + h + 0.07, 'vetro', top='p_legno', cx=x, cz=z)


def _shelf(m, x0, x1, z, y0, levels=(0.5, 0.95), h=1.2, depth=0.22):
    for x in (x0, x1):
        m.box(x - 0.03, y0, z - depth / 2, x + 0.03, y0 + h, z + depth / 2, 'legno_scuro', skip=('bottom',))
    for y in levels:
        m.box(x0, y0 + y, z - depth / 2, x1, y0 + y + 0.04, z + depth / 2, 'legno_pieno', top='tavole', skip=('bottom',))


# ------------------------------------------------------------------ BANCO DA LAVORO
def bld_banco_l1():
    m = Mesh('bld_banco_l1')
    m.box(-0.95, 0, -0.95, 0.95, 0.1, 0.95, 'pietra_muro', top='terra', skip=('bottom',))
    _bench(m, -0.85, 0.35, 0.3, 0.75)
    _hammer(m, -0.45, 0.75, 0.5, 70)
    beam(m, (0.0, 0.76, 0.42), (0.18, 0.76, 0.62), 0.025, 0.025, 'ferro', n=3)
    beam(m, (0.03, 0.76, 0.4), (0.22, 0.76, 0.57), 0.025, 0.025, 'ferro', n=3)
    m.box(-0.8, 0.75, 0.62, -0.2, 0.765, 0.67, 'ferro', skip=('bottom',))
    _anvil(m, -0.45, -0.35)
    _forge(m, 0.3, -0.85, 0.88, -0.25)
    _bellows(m, 0.9, 0.1, ang=-90)
    m.prism(8, 0.17, 0.17, 0.1, 0.55, 'barile', top='acqua_bassa', cx=-0.78, cz=-0.75)
    for k, x in enumerate((0.55, 0.7)):
        m.box(x - 0.06, 0.1 + 0.05 * k, 0.45, x + 0.06, 0.15 + 0.05 * k, 0.75, 'oro' if k else 'ferro', skip=('bottom',))
    beam(m, (0.75, 0.1, 0.85), (0.75, 1.3, 0.85), 0.07, 0.07, 'legno_scuro', end='legno_scuro')
    beam(m, (0.75, 1.25, 0.85), (0.55, 1.25, 0.85), 0.05, 0.05, 'legno_scuro', end='legno_scuro')
    lantern_lite(m, 0.55, 1.02, 0.85)
    _rack(m, -0.95, -0.6, -0.85, y0=0.1, h=1.0, items=('ascia',))
    return _obj(m, **FP(2, 2))


def bld_banco_l2():
    m = Mesh('bld_banco_l2')
    m.box(-0.97, 0, -0.97, 0.97, 0.12, 0.97, 'pietra_muro', top='pietra_liscia', skip=('bottom',))
    _bench(m, -0.85, 0.3, 0.35, 0.8, y0=0.12)
    _hammer(m, -0.5, 0.77, 0.55, 60)
    m.box(-0.2, 0.77, 0.45, 0.1, 0.81, 0.7, 'ferro', skip=('bottom',))
    # tettoia di paglia sopra il banco
    for x in (-0.9, 0.35):
        beam(m, (x, 0.12, 0.9), (x, 1.95, 0.9), 0.1, 0.1, 'corteccia', end='taglio')
        beam(m, (x, 0.12, 0.2), (x, 1.65, 0.2), 0.1, 0.1, 'corteccia', end='taglio')
    face(m, [(-0.98, 1.62, 0.05), (0.42, 1.62, 0.05), (0.42, 1.98, 0.98), (-0.98, 1.98, 0.98)], 'paglia', (0, 1, -0.3))
    face(m, [(-0.98, 1.57, 0.05), (0.42, 1.57, 0.05), (0.42, 1.93, 0.98), (-0.98, 1.93, 0.98)], 'legno_scuro', (0, -1, 0))
    face(m, [(-0.98, 1.62, 0.05), (0.42, 1.62, 0.05), (0.42, 1.57, 0.05), (-0.98, 1.57, 0.05)], 'legno_scuro', (0, 0, -1))
    _anvil(m, -0.4, -0.4, s=1.2, y0=0.12)
    _forge(m, 0.3, -0.9, 0.92, -0.2, h=0.6, y0=0.12, chimney=1.2)
    _bellows(m, 0.15, -0.05, y0=0.12, ang=0)
    m.prism(8, 0.17, 0.17, 0.12, 0.55, 'barile', top='acqua_bassa', cx=-0.8, cz=-0.8)
    _rack(m, 0.5, 0.92, 0.6, y0=0.12, h=1.2, items=('ascia',))
    _rack_katana(m, 0.62, 0.6, 0.55)
    m.box(-0.95, 0.12, -0.2, -0.65, 0.42, 0.15, 'cassa', skip=('bottom',))
    lantern_lite(m, -0.25, 1.35, 0.15)
    return _obj(m, **FP(2, 2))


def bld_banco_l3():
    m = Mesh('bld_banco_l3')
    m.box(-1.0, 0, -1.0, 1.0, 0.15, 1.0, 'pietra_muro', top='pietra_liscia', skip=('bottom',))
    # fucina chiusa dietro: muri di pietra, tetto di rame, pilastri laccati
    x0, x1, z0, z1 = -0.95, 0.95, 0.15, 0.95
    face(m, [(x0, 0.15, z1), (x1, 0.15, z1), (x1, 1.5, z1), (x0, 1.5, z1)], 'pietra_muro', (0, 0, 1))
    for x, sx in ((x0, -1), (x1, 1)):
        face(m, [(x, 0.15, z0), (x, 0.15, z1), (x, 1.5, z1), (x, 1.5, z0)], 'pietra_muro', (sx, 0, 0))
        face(m, [(x, 0.15, z0), (x, 0.15, z1), (x, 1.5, z1), (x, 1.5, z0)], 'pietra_muro', (-sx, 0, 0))
    face(m, [(x0, 0.15, z1 - 0.01), (x1, 0.15, z1 - 0.01), (x1, 1.5, z1 - 0.01), (x0, 1.5, z1 - 0.01)], 'tavole_scure', (0, 0, -1))
    posts(m, [(x0, -0.75), (x1, -0.75), (x0, z0), (x1, z0)], 0.15, 1.6, reg='legno_lacca')
    hip(m, -1.1, 1.1, -0.95, 1.1, 1.55, 2.25, top='tegole_rame', curl=0.16)
    # camino di pietra con bagliore e pinnacolo d'oro
    m.box(0.35, 0.15, 0.45, 0.85, 0.75, 0.9, 'pietra_p', top='pietra_liscia', skip=('bottom',))
    face(m, [(0.42, 0.25, 0.445), (0.78, 0.25, 0.445), (0.78, 0.6, 0.445), (0.42, 0.6, 0.445)], 'em_fuoco', (0, 0, -1), mat=EM)
    m.box(0.45, 0.75, 0.55, 0.75, 2.75, 0.85, 'pietra_muro', top='nero_p', skip=('bottom',))
    face(m, [(0.46, 2.6, 0.545), (0.74, 2.6, 0.545), (0.74, 2.72, 0.545), (0.46, 2.72, 0.545)], 'em_fuoco', (0, 0, -1), mat=EM)
    m.prism(6, 0.05, 0.02, 2.75, 3.05, 'oro', cx=0.6, cz=0.7)
    _bench(m, -0.85, 0.15, 0.45, 0.85, y=0.8, y0=0.15)
    _hammer(m, -0.55, 0.8, 0.62, 60)
    _hammer(m, -0.2, 0.8, 0.6, 100)
    # incudine grande davanti, rastrelliera con tre armi, manichino con corazza
    _anvil(m, -0.05, -0.45, s=1.35, y0=0.15)
    _rack(m, -0.95, -0.45, -0.25, y0=0.15, h=1.25, items=('ascia', 'lancia'))
    _rack_katana(m, -0.7, -0.25, 0.6)
    beam(m, (0.6, 0.15, -0.5), (0.6, 1.15, -0.5), 0.05, 0.05, 'legno_scuro')
    m.loft([m.ring(8, 0.16, 0.85, cx=0.6, cz=-0.5), m.ring(8, 0.2, 1.08, cx=0.6, cz=-0.5), m.ring(8, 0.22, 1.3, cx=0.6, cz=-0.5), m.ring(8, 0.1, 1.38, cx=0.6, cz=-0.5)], 'ferro', top='ferro')
    for s in (-1, 1):
        m.box(0.6 + s * 0.2 - 0.06, 1.18, -0.6, 0.6 + s * 0.2 + 0.06, 1.34, -0.4, 'lacca_scura', skip=())
    m.prism(8, 0.17, 0.17, 0.15, 0.58, 'barile', top='acqua_bassa', cx=0.75, cz=-0.05)
    lantern(m, -0.95, 1.2, -0.85, r=0.1, h=0.22)
    lantern(m, 0.95, 1.2, -0.85, r=0.1, h=0.22)
    return _obj(m, **FP(2, 2))


# ------------------------------------------------------------------ TAVOLO ALCHEMICO
def _alembic(m, x, z, y0, s=1.0, liquid='em_neon_verde'):
    for i in range(3):
        a = 2 * math.pi * i / 3 + 0.4
        beam(m, (x + math.cos(a) * 0.12 * s, y0, z + math.sin(a) * 0.12 * s), (x, y0 + 0.2 * s, z), 0.02, 0.02, 'ferro', n=3)
    tube(m, [(x, y0 + 0.02, z), (x, y0 + 0.12 * s, z)], [0.04 * s, 0], 4, 'em_fuoco', mat=EM)
    blob(m, (x, y0 + 0.3 * s, z), 0.11 * s, 0.1 * s, 0.11 * s, liquid, n=6, k=3, mat=EM)
    m.prism(5, 0.035 * s, 0.025 * s, y0 + 0.38 * s, y0 + 0.5 * s, 'vetro', cx=x, cz=z)
    beam(m, (x, y0 + 0.48 * s, z), (x + 0.3 * s, y0 + 0.3 * s, z), 0.02 * s, 0.02 * s, 'vetro', n=3)
    flask(m, x + 0.32 * s, z, y0, liquid, r=0.05 * s, h=0.2 * s)


def bld_alchimia_l1():
    m = Mesh('bld_alchimia_l1')
    m.box(-0.95, 0, -0.95, 0.95, 0.1, 0.95, 'legno_pieno', top='tavole', skip=('bottom',))
    _bench(m, -0.7, 0.55, -0.1, 0.45, y=0.5, y0=0.1, top='tavole')
    _alembic(m, -0.35, 0.18, 0.5)
    for i, (x, liq) in enumerate(((0.15, 'em_neon_rosa'), (0.3, 'em_neon_ciano'), (0.42, 'em_neon_verde'))):
        flask(m, x, 0.05 + 0.08 * (i % 2), 0.5, liq, r=0.045, h=0.1)
    m.box(-0.95, 0.1, -0.85, -0.6, 0.15, -0.5, 'tessuto_blu', skip=('bottom',))
    _shelf(m, -0.8, 0.6, 0.82, 0.1, levels=(0.45, 0.9), h=1.15)
    for i, x in enumerate((-0.65, -0.4, -0.1, 0.2, 0.45)):
        m.prism(5, 0.06, 0.06, 0.59, 0.72 + 0.04 * (i % 2), 'secchio' if i % 2 else 'pietra_p', top='p_legno', cx=x, cz=0.82)
    for i, (x, liq) in enumerate(((-0.55, 'em_neon_ambra'), (-0.15, 'em_neon_viola'), (0.35, 'em_neon_rosa'))):
        flask(m, x, 0.82, 1.04, liq, r=0.05, h=0.1)
    # cassa di erbe, mortaio, mazzi appesi
    m.box(0.55, 0.1, -0.85, 0.9, 0.38, -0.55, 'cassa', top='foglie', skip=('bottom',))
    m.prism(6, 0.09, 0.07, 0.5, 0.58, 'pietra_p', top='p_pietra_scura', cx=0.42, cz=0.35)
    beam(m, (0.42, 0.56, 0.35), (0.5, 0.7, 0.3), 0.025, 0.025, 'legno_pieno', n=3)
    for x in (-0.5, -0.1, 0.3):
        tube(m, [(x, 1.22, 0.75), (x, 1.02, 0.7)], [0.06, 0], 4, 'foglie')
    return _obj(m, **FP(2, 2))


def bld_alchimia_l2():
    m = Mesh('bld_alchimia_l2')
    m.box(-0.97, 0, -0.97, 0.97, 0.12, 0.97, 'legno_pieno', top='tavole', skip=('bottom',))
    _bench(m, -0.75, 0.55, 0.05, 0.6, y=0.75, y0=0.12)
    _alembic(m, -0.4, 0.32, 0.75)
    for i, (x, liq) in enumerate(((0.12, 'em_neon_rosa'), (0.28, 'em_neon_ciano'), (0.42, 'em_neon_ambra'))):
        flask(m, x, 0.2 + 0.08 * (i % 2), 0.75, liq, r=0.045, h=0.11)
    # tenda di carta su quattro pali
    posts(m, [(-0.9, 0.9), (0.9, 0.9), (-0.9, -0.1), (0.9, -0.1)], 0.12, 1.75, w=0.08, reg='legno_scuro')
    face(m, [(-1.0, 1.72, -0.25), (1.0, 1.72, -0.25), (1.0, 2.05, 1.0), (-1.0, 2.05, 1.0)], 'tessuto_blu', (0, 1, -0.3))
    face(m, [(-1.0, 1.68, -0.25), (1.0, 1.68, -0.25), (1.0, 2.01, 1.0), (-1.0, 2.01, 1.0)], 'legno_scuro', (0, -1, 0))
    face(m, [(-1.0, 1.72, -0.25), (1.0, 1.72, -0.25), (1.0, 1.68, -0.25), (-1.0, 1.68, -0.25)], 'legno_scuro', (0, 0, -1))
    noren(m, 0.0, 1.7, -0.2, 1.6, 0.25, 'noren_blu')
    _shelf(m, -0.8, 0.8, 0.85, 0.12, levels=(0.5, 1.0), h=1.4)
    for i, x in enumerate((-0.6, -0.3, 0.0, 0.3, 0.6)):
        flask(m, x, 0.85, 0.66 if i % 2 else 1.16, ('em_neon_verde', 'em_neon_viola', 'em_neon_rosa', 'em_neon_ciano', 'em_neon_ambra')[i], r=0.05, h=0.11)
    # calderone sul treppiede col fuoco
    cx, cz = 0.45, -0.55
    for i in range(3):
        a = 2 * math.pi * i / 3 + 0.5
        beam(m, (cx + math.cos(a) * 0.32, 0.12, cz + math.sin(a) * 0.32), (cx, 0.95, cz), 0.04, 0.04, 'legno_scuro', n=3)
    m.loft([m.ring(8, 0.14, 0.3, cx=cx, cz=cz), m.ring(8, 0.24, 0.42, cx=cx, cz=cz), m.ring(8, 0.22, 0.6, cx=cx, cz=cz)], 'ferro', bottom='ferro')
    face(m, list(reversed(m.ring(8, 0.2, 0.57, cx=cx, cz=cz))), 'em_neon_verde', (0, 1, 0), mat=EM)
    tube(m, [(cx, 0.12, cz), (cx, 0.32, cz)], [0.16, 0], 5, 'em_fuoco', mat=EM)
    beam(m, (cx, 0.95, cz), (cx, 0.62, cz), 0.015, 0.015, 'corda', n=3)
    m.box(-0.95, 0.12, -0.9, -0.55, 0.42, -0.5, 'cassa', top='foglie', skip=('bottom',))
    m.prism(6, 0.13, 0.1, 0.12, 0.42, 'tela_sacco', top='tela_sacco', cx=-0.3, cz=-0.8)
    lantern_lite(m, -0.85, 1.4, -0.1)
    return _obj(m, **FP(2, 2))


def bld_alchimia_l3():
    m = Mesh('bld_alchimia_l3')
    m.box(-1.0, 0, -1.0, 1.0, 0.18, 1.0, 'pietra_muro', top='tavole', skip=('bottom',))
    # padiglione: pilastri laccati, tetto a padiglione di rame col pinnacolo d'oro
    posts(m, [(x, z) for x in (-0.88, 0.88) for z in (-0.88, 0.88)], 0.18, 1.85, reg='legno_lacca')
    hip(m, -1.12, 1.12, -1.12, 1.12, 1.8, 2.55, top='tegole_rame', curl=0.2, finial='oro')
    railing(m, [(-0.88, 0.88), (-0.88, -0.2)], 0.18, 0.55, reg='legno_lacca')
    railing(m, [(0.88, 0.88), (0.88, -0.2)], 0.18, 0.55, reg='legno_lacca')
    m.box(-0.88, 0.18, 0.86, 0.88, 1.1, 0.9, 'carta_tesa', skip=('bottom',))
    # distillatore grande: due bocce collegate, vasca di pozione
    _bench(m, -0.7, 0.7, 0.2, 0.7, y=0.75, y0=0.18)
    _alembic(m, -0.45, 0.45, 0.75, s=1.25, liquid='em_neon_viola')
    _alembic(m, 0.1, 0.45, 0.75, s=1.0, liquid='em_neon_ciano')
    beam(m, (-0.1, 1.38, 0.45), (0.1, 1.25, 0.45), 0.025, 0.025, 'vetro', n=3)
    for i, (x, liq) in enumerate(((0.5, 'em_neon_rosa'), (0.62, 'em_neon_ambra'))):
        flask(m, x, 0.3 + 0.1 * i, 0.75, liq, r=0.05, h=0.13)
    m.prism(8, 0.28, 0.3, 0.18, 0.62, 'barile', cx=0.45, cz=-0.5)
    face(m, list(reversed(m.ring(8, 0.26, 0.6, a0=math.pi / 8, cx=0.45, cz=-0.5))), 'em_neon_verde', (0, 1, 0), mat=EM)
    m.box(-0.9, 0.18, -0.9, -0.5, 0.5, -0.5, 'cassa', top='foglie', skip=('bottom',))
    for i, (x, liq) in enumerate(((-0.25, 'em_neon_verde'), (-0.1, 'em_neon_rosa'), (0.05, 'em_neon_ciano'))):
        flask(m, x, -0.75, 0.18, liq, r=0.06, h=0.15)
    for x in (-0.6, -0.2, 0.2, 0.6):
        tube(m, [(x, 1.72, 0.8), (x, 1.45, 0.78)], [0.07, 0], 4, 'foglie')
    lantern(m, -0.88, 1.35, -0.98, r=0.1, h=0.22)
    lantern(m, 0.88, 1.35, -0.98, r=0.1, h=0.22)
    return _obj(m, **FP(2, 2))


# ------------------------------------------------------------------ FORZIERE
def bld_forziere_l1():
    m = Mesh('bld_forziere_l1')
    m.box(-0.95, 0, -0.95, 0.95, 0.08, 0.95, 'pietra_liscia', top='ghiaia', skip=('bottom',))
    m.box(-0.6, 0.08, -0.45, 0.6, 0.16, 0.25, 'legno_pieno', top='tavole', skip=('bottom',))  # pedana
    _chest(m, 0.0, -0.1, 0.9, 0.55, 0.42, y0=0.16)
    _chest(m, 0.62, 0.6, 0.5, 0.35, 0.28, y0=0.08, rot=-20, body='cassa')
    m.box(-0.9, 0.08, 0.3, -0.45, 0.48, 0.75, 'cassa', skip=('bottom',))
    m.box(-0.85, 0.48, 0.38, -0.5, 0.75, 0.7, 'cassa', skip=('bottom',))
    for i, (x, z) in enumerate(((-0.75, -0.7), (-0.5, -0.82))):
        m.prism(6, 0.14 - 0.02 * i, 0.1, 0.08, 0.42 - 0.05 * i, 'tela_sacco', top='tela_sacco', cx=x, cz=z)
    m.prism(8, 0.16, 0.16, 0.08, 0.55, 'barile', top='taglio', cx=0.75, cz=-0.65)
    m.prism(8, 0.18, 0.18, 0.08, 0.15, 'corda', top='corda', cx=0.3, cz=0.75)
    for i in range(3):
        m.prism(6, 0.05, 0.05, 0.16 + 0.025 * i, 0.185 + 0.025 * i, 'oro', top='oro', cx=-0.48 + 0.02 * i, cz=-0.32)
    beam(m, (0.9, 0.08, 0.15), (0.9, 1.3, 0.15), 0.07, 0.07, 'legno_scuro', end='legno_scuro')
    beam(m, (0.9, 1.25, 0.15), (0.7, 1.25, 0.15), 0.05, 0.05, 'legno_scuro', end='legno_scuro')
    lantern_lite(m, 0.7, 1.02, 0.15)
    return _obj(m, **FP(2, 2))


def bld_forziere_l2():
    m = Mesh('bld_forziere_l2')
    m.box(-0.97, 0, -0.97, 0.97, 0.12, 0.97, 'pietra_muro', top='pietra_liscia', skip=('bottom',))
    m.box(-0.62, 0.12, -0.75, 0.62, 0.28, -0.05, 'pietra_p', top='pietra_liscia', skip=('bottom',))
    _chest(m, 0.0, -0.4, 1.05, 0.6, 0.48, y0=0.28, trim='oro')
    # scaffale con casse sotto una tettoia
    _shelf(m, -0.9, 0.9, 0.7, 0.12, levels=(0.55,), h=1.1, depth=0.4)
    for x in (-0.7, -0.25, 0.35):
        m.box(x - 0.17, 0.12, 0.55, x + 0.17, 0.45, 0.85, 'cassa', skip=('bottom',))
    for x in (-0.55, 0.15, 0.6):
        m.box(x - 0.15, 0.71, 0.56, x + 0.15, 0.95, 0.84, 'cassa' if x < 0.5 else 'barile', skip=('bottom',))
    posts(m, [(-0.92, 0.95), (0.92, 0.95), (-0.92, 0.25), (0.92, 0.25)], 0.12, 1.55, w=0.09, reg='legno_scuro')
    face(m, [(-1.0, 1.5, 0.12), (1.0, 1.5, 0.12), (1.0, 1.8, 1.0), (-1.0, 1.8, 1.0)], 'paglia', (0, 1, -0.3))
    face(m, [(-1.0, 1.45, 0.12), (1.0, 1.45, 0.12), (1.0, 1.75, 1.0), (-1.0, 1.75, 1.0)], 'legno_scuro', (0, -1, 0))
    face(m, [(-1.0, 1.5, 0.12), (1.0, 1.5, 0.12), (1.0, 1.45, 0.12), (-1.0, 1.45, 0.12)], 'legno_scuro', (0, 0, -1))
    for i, (x, z) in enumerate(((-0.85, -0.75), (-0.82, -0.45), (0.85, -0.8))):
        m.prism(6, 0.13, 0.1, 0.12, 0.45, 'tela_sacco', top='tela_sacco', cx=x, cz=z)
    m.prism(8, 0.16, 0.16, 0.12, 0.58, 'barile', top='taglio', cx=0.8, cz=-0.35)
    lantern_lite(m, 0.0, 1.25, 0.2)
    return _obj(m, **FP(2, 2))


def bld_forziere_l3():
    m = Mesh('bld_forziere_l3')
    m.box(-1.0, 0, -1.0, 1.0, 0.2, 1.0, 'pietra_muro', top='pietra_liscia', skip=('bottom',))
    # piccolo deposito (kura): zoccolo namako, intonaco sopra, porta laccata, tetto di rame col pinnacolo
    x0, x1, z0, z1 = -0.85, 0.85, 0.0, 0.92
    walls(m, x0, x1, z0, z1, 0.2, 0.75, 'namako')
    walls(m, x0, x1, z0, z1, 0.75, 1.75, 'intonaco')
    face(m, [(-0.3, 0.2, z0 - 0.02), (0.3, 0.2, z0 - 0.02), (0.3, 1.25, z0 - 0.02), (-0.3, 1.25, z0 - 0.02)], 'legno_lacca', (0, 0, -1))
    beam(m, (-0.36, 1.3, z0 - 0.04), (0.36, 1.3, z0 - 0.04), 0.08, 0.08, 'nero_lacca', end='nero_lacca')
    m.box(-0.06, 0.65, z0 - 0.07, 0.06, 0.8, z0 - 0.02, 'oro', skip=('back',))
    win(m, x1, 1.2, 1.5, 0.45, 0.35, (1, 0, 0))
    gables(m, x0, x1, z0, z1, 1.75, 2.2, reg='intonaco')
    roof(m, -1.0, 1.0, (z0 + z1) / 2, 0.68, 1.62, 2.3, top='tegole_rame', curl=0.16)
    m.prism(6, 0.05, 0.02, 2.33, 2.6, 'oro', cx=0.0, cz=(z0 + z1) / 2)
    # baule grande davanti, casse e lanterne
    m.box(-0.62, 0.2, -0.85, 0.62, 0.3, -0.25, 'pietra_p', top='pietra_liscia', skip=('bottom',))
    _chest(m, 0.0, -0.55, 1.1, 0.55, 0.5, y0=0.3, trim='oro', body='lacca_scura')
    m.box(0.68, 0.2, -0.95, 0.98, 0.5, -0.55, 'cassa', skip=('bottom',))
    m.box(0.72, 0.5, -0.9, 0.95, 0.72, -0.62, 'cassa', skip=('bottom',))
    m.prism(6, 0.13, 0.1, 0.2, 0.5, 'tela_sacco', top='tela_sacco', cx=-0.82, cz=-0.75)
    lantern(m, -0.6, 1.12, -0.1, r=0.1, h=0.22)
    lantern(m, 0.6, 1.12, -0.1, r=0.1, h=0.22)
    stone_lantern(m, -0.85, -0.3, 0.9)
    return _obj(m, **FP(2, 2))


# ------------------------------------------------------------------ SERRA
def _bed(m, x0, x1, z0, z1, y0, plants, h=0.3):
    m.box(x0, y0, z0, x1, y0 + h, z1, 'legno_pieno', top='terra', skip=('bottom',))
    for (x, z, ph, r, fl) in plants:
        _plant(m, x, z, y0 + h, ph, r, flower=fl)


def bld_serra_l1():
    m = Mesh('bld_serra_l1')
    m.box(-0.95, 0, -0.95, 0.95, 0.06, 0.95, 'erba_lato', top='erba_a', skip=('bottom',))
    _bed(m, -0.85, 0.2, 0.15, 0.85, 0.06, [(-0.65, 0.35, 0.3, 0.12, None), (-0.3, 0.6, 0.38, 0.13, None), (0.0, 0.35, 0.28, 0.11, 'p_rosso')])
    # cassone con coperchio di vetro inclinato
    m.box(-0.85, 0.06, -0.8, 0.2, 0.3, -0.2, 'tavole', top='terra', skip=('bottom',))
    for x in (-0.6, -0.3, 0.0):
        _plant(m, x, -0.55, 0.3, 0.2, 0.09)
    face(m, [(-0.85, 0.42, -0.8), (0.2, 0.42, -0.8), (0.2, 0.62, -0.2), (-0.85, 0.62, -0.2)], 'vetro_serra', (0, 1, -0.4), uv='fit')
    for x in (-0.85, 0.2):
        face(m, [(x, 0.3, -0.8), (x, 0.3, -0.2), (x, 0.62, -0.2), (x, 0.42, -0.8)], 'tavole', (1 if x > 0 else -1, 0, 0))
    beam(m, (-0.85, 0.62, -0.2), (0.2, 0.62, -0.2), 0.04, 0.04, 'legno_scuro', n=4)
    # pergola con rampicante
    for x in (0.5, 0.9):
        beam(m, (x, 0.06, 0.6), (x, 1.4, 0.6), 0.06, 0.06, 'legno_pieno', end='legno_pieno')
    for y in (0.5, 0.9, 1.3):
        beam(m, (0.47, y, 0.6), (0.93, y, 0.6), 0.03, 0.03, 'legno_pieno', n=3)
    for i, (x, y) in enumerate(((0.6, 0.6), (0.8, 0.95), (0.62, 1.2), (0.82, 0.35))):
        blob(m, (x, y, 0.6), 0.12, 0.1, 0.08, 'foglie', n=4, k=2)
    # annaffiatoio e vaso
    m.prism(6, 0.09, 0.09, 0.06, 0.26, 'metallo', top='metallo', cx=0.6, cz=-0.6)
    beam(m, (0.68, 0.12, -0.6), (0.85, 0.3, -0.6), 0.025, 0.025, 'metallo', n=3)
    m.prism(5, 0.1, 0.13, 0.06, 0.28, 'pietra_p', top='terra', cx=0.5, cz=0.05)
    _plant(m, 0.5, 0.05, 0.28, 0.35, 0.14, flower='p_giallo')
    # staccionata bassa sul lato sinistro e sacco di semi
    for z in (-0.9, -0.3, 0.3, 0.9):
        beam(m, (-0.95, 0.06, z), (-0.95, 0.5, z), 0.05, 0.05, 'legno_pieno', end='legno_pieno')
    for y in (0.22, 0.42):
        beam(m, (-0.95, y, -0.92), (-0.95, y, 0.92), 0.03, 0.04, 'legno_pieno')
    m.prism(6, 0.13, 0.1, 0.06, 0.38, 'tela_sacco', top='terra', cx=0.85, cz=-0.2)
    m.prism(6, 0.11, 0.09, 0.06, 0.3, 'tela_sacco', top='tela_sacco', cx=0.88, cz=0.15)
    for x, z in ((0.35, -0.85), (-0.2, 0.0), (0.3, 0.3)):
        _plant(m, x, z, 0.06, 0.18, 0.08, region='erba_alta', n=4)
    return _obj(m, **FP(2, 2))


def _greenhouse(m, x0, x1, z0, z1, y0, ye, yr, bays, ridge='legno_scuro', post='legno_pieno'):
    """Serra a due falde: telaio, vetri a campate alterne (le altre aperte: si vedono le piante)."""
    zc = (z0 + z1) / 2
    xs = [x0 + (x1 - x0) * i / bays for i in range(bays + 1)]
    for x in xs:
        for z in (z0, z1):
            beam(m, (x, y0, z), (x, ye, z), 0.06, 0.06, post)
        beam(m, (x, ye, z0), (x, yr, zc), 0.05, 0.05, post, n=4)
        beam(m, (x, ye, z1), (x, yr, zc), 0.05, 0.05, post, n=4)
    beam(m, (x0 - 0.05, yr, zc), (x1 + 0.05, yr, zc), 0.07, 0.07, ridge, end=ridge)
    for z in (z0, z1):
        beam(m, (x0, ye, z), (x1, ye, z), 0.05, 0.05, post, n=4)
    for i in range(bays):
        xa, xb = xs[i] + 0.03, xs[i + 1] - 0.03
        if i % 2 == 0:
            face(m, [(xa, ye, z0), (xb, ye, z0), (xb, yr, zc), (xa, yr, zc)], 'vetro_serra', (0, 1, -1), uv='fit')
            face(m, [(xa, y0 + 0.35, z1), (xb, y0 + 0.35, z1), (xb, ye, z1), (xa, ye, z1)], 'vetro_serra', (0, 0, 1), uv='fit')
        face(m, [(xa, ye, z1), (xb, ye, z1), (xb, yr, zc), (xa, yr, zc)], 'vetro_serra', (0, 1, 1), uv='fit')
        face(m, [(xa, y0, z0), (xb, y0, z0), (xb, y0 + 0.35, z0), (xa, y0 + 0.35, z0)], 'tavole', (0, 0, -1))
        face(m, [(xa, y0, z1), (xb, y0, z1), (xb, y0 + 0.35, z1), (xa, y0 + 0.35, z1)], 'tavole', (0, 0, 1))
    for x, sx in ((x0, -1), (x1, 1)):
        face(m, [(x, ye, z0), (x, ye, z1), (x, yr, zc)], 'vetro_serra', (sx, 0, 0), uv='fit')
        face(m, [(x, y0, z0), (x, y0, z1), (x, y0 + 0.35, z1), (x, y0 + 0.35, z0)], 'tavole', (sx, 0, 0))


def bld_serra_l2():
    m = Mesh('bld_serra_l2')
    m.box(-0.97, 0, -0.97, 0.97, 0.1, 0.97, 'pietra_liscia', top='ghiaia', skip=('bottom',))
    _greenhouse(m, -0.9, 0.9, 0.05, 0.92, 0.1, 1.05, 1.6, 3)
    _bed(m, -0.8, 0.8, 0.25, 0.75, 0.1, [(-0.6, 0.45, 0.42, 0.14, None), (-0.2, 0.55, 0.5, 0.15, 'p_rosso'), (0.25, 0.45, 0.4, 0.13, None), (0.6, 0.55, 0.45, 0.14, 'p_viola')], h=0.25)
    _bed(m, -0.85, 0.1, -0.85, -0.3, 0.1, [(-0.65, -0.6, 0.3, 0.12, None), (-0.35, -0.55, 0.36, 0.13, 'p_giallo'), (-0.05, -0.62, 0.3, 0.12, None)], h=0.22)
    m.prism(6, 0.09, 0.09, 0.1, 0.3, 'metallo', top='metallo', cx=0.45, cz=-0.55)
    beam(m, (0.53, 0.16, -0.55), (0.7, 0.34, -0.55), 0.025, 0.025, 'metallo', n=3)
    for i, x in enumerate((0.75, 0.85)):
        m.prism(5, 0.1, 0.12, 0.1, 0.3, 'pietra_p', top='terra', cx=x, cz=-0.2 - 0.3 * i)
        _plant(m, x, -0.2 - 0.3 * i, 0.3, 0.32, 0.13, flower='p_rosso')
    m.prism(6, 0.13, 0.1, 0.1, 0.4, 'tela_sacco', top='terra', cx=0.25, cz=-0.8)
    lantern_lite(m, 0.0, 1.4, 0.05)
    return _obj(m, **FP(2, 2))


def bld_serra_l3():
    m = Mesh('bld_serra_l3')
    m.box(-1.0, 0, -1.0, 1.0, 0.15, 1.0, 'pietra_muro', top='pietra_liscia', skip=('bottom',))
    _greenhouse(m, -0.95, 0.95, -0.35, 0.95, 0.15, 1.25, 2.0, 4, ridge='tegole_rame', post='legno_lacca')
    m.prism(6, 0.05, 0.02, 2.05, 2.35, 'oro', cx=0.0, cz=0.3)
    _bed(m, -0.85, 0.85, 0.45, 0.85, 0.15, [(-0.65, 0.65, 0.5, 0.15, 'p_rosso'), (-0.25, 0.62, 0.62, 0.17, None), (0.15, 0.68, 0.5, 0.15, 'p_giallo'), (0.6, 0.65, 0.58, 0.16, 'p_viola')], h=0.25)
    _bed(m, -0.85, -0.15, -0.25, 0.25, 0.15, [(-0.65, 0.0, 0.42, 0.14, 'p_viola'), (-0.35, 0.05, 0.5, 0.15, None)], h=0.22)
    _bed(m, 0.15, 0.85, -0.25, 0.25, 0.15, [(0.35, 0.0, 0.45, 0.14, None), (0.65, 0.05, 0.4, 0.14, 'p_rosso')], h=0.22)
    # piccolo albero da frutto in vaso e aiuola fuori
    m.prism(6, 0.16, 0.2, 0.15, 0.42, 'pietra_p', top='terra', cx=-0.65, cz=-0.7)
    beam(m, (-0.65, 0.42, -0.7), (-0.65, 0.85, -0.7), 0.06, 0.06, 'corteccia', n=4)
    blob(m, (-0.65, 1.0, -0.7), 0.28, 0.22, 0.28, 'foglie', n=6, k=3)
    for a in range(3):
        m.prism(4, 0.035, 0.035, 0.95, 1.0, 'p_arancio', top='p_arancio', cx=-0.65 + 0.2 * math.cos(a * 2.1), cz=-0.7 + 0.2 * math.sin(a * 2.1) - 0.08)
    _bed(m, 0.1, 0.9, -0.95, -0.55, 0.15, [(0.3, -0.75, 0.3, 0.12, 'p_giallo'), (0.55, -0.75, 0.34, 0.12, 'p_rosso'), (0.78, -0.72, 0.3, 0.12, None)], h=0.18)
    lantern(m, -0.95, 1.05, -0.45, r=0.1, h=0.22)
    lantern(m, 0.95, 1.05, -0.45, r=0.1, h=0.22)
    return _obj(m, **FP(2, 2))


MODELS_MAIN = [prop_ingresso_grotta, prop_ingresso_cripta, prop_ingresso_vuoto,
               bld_banco_l1, bld_banco_l2, bld_banco_l3, bld_alchimia_l1, bld_alchimia_l2, bld_alchimia_l3,
               bld_forziere_l1, bld_forziere_l2, bld_forziere_l3, bld_serra_l1, bld_serra_l2, bld_serra_l3]
# ================================================================== GDR (manifest_rpg.json)
# ------------------------------------------------------------------ kit dei dungeon (moduli ≤ 60 tri)
def _floor_jag(m, region, skirt, seed, bump=0.04):
    """Pavimento 2×2 a y = 0: centro appena rialzato, angoli e bordi fermi a 0 (si affiancano senza fessure)."""
    c = (h01(1, 2, seed) * 0.3 - 0.15, bump, h01(2, 1, seed) * 0.3 - 0.15)
    edge = [(-1, 0, -1), (0, 0, -1), (1, 0, -1), (1, 0, 0), (1, 0, 1), (0, 0, 1), (-1, 0, 1), (-1, 0, 0)]
    for a, b in zip(edge, edge[1:] + edge[:1]):
        face(m, [a, b, c], region, (0, 1, 0))
    for a, b, nn in (((-1, -1), (1, -1), (0, 0, -1)), ((1, -1), (1, 1), (1, 0, 0)), ((1, 1), (-1, 1), (0, 0, 1)), ((-1, 1), (-1, -1), (-1, 0, 0))):
        face(m, [(a[0], 0, a[1]), (b[0], 0, b[1]), (b[0], -0.3, b[1]), (a[0], -0.3, a[1])], skirt, nn)


def _rock_block(m, H, side, top, seed, jag=0.15, bands=2):
    """Blocco di roccia 2×2 alto H: base quadrata esatta, anelli sopra irregolari, cima a punte basse."""
    base = [(-1, -1), (0, -1), (1, -1), (1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0)]
    rings = [[(x, 0.0, z) for x, z in base]]
    levels = [H * 0.5, H] if H > 1 and bands > 1 else [H]
    for li, y in enumerate(levels):
        ring = []
        for i, (x, z) in enumerate(base):
            k = 1 - (0.04 + 0.08 * h01(i, li, seed)) * (li + 1) / len(levels)
            yy = y + (jag * (h01(i, li + 7, seed) - 0.5) * 2 if y == H else 0)
            ring.append((x * k, yy, z * k))
        rings.append(ring)
    for ra, rb in zip(rings, rings[1:]):
        for i in range(8):
            j = (i + 1) % 8
            q = [ra[i], ra[j], rb[j], rb[i]]
            face(m, q, side, (q[0][0] + q[1][0], 0, q[0][2] + q[1][2]))
    tip = (h01(3, 3, seed) * 0.4 - 0.2, H + jag * 0.8, h01(4, 4, seed) * 0.4 - 0.2)
    for i in range(8):
        j = (i + 1) % 8
        face(m, [rings[-1][i], rings[-1][j], tip], top, (0, 1, 0))


def dng_grotta_pavimento():
    m = Mesh('dng_grotta_pavimento')
    _floor_jag(m, 'grotta_pav', 'grotta_muro', 11)
    for i, (x, z, r) in enumerate(((0.5, -0.4, 0.1), (-0.55, 0.45, 0.08), (-0.3, -0.6, 0.06))):
        m.cone(4, r, 0.0, r * 0.9, 'grotta_muro', cx=x, cz=z, a0=i)
    return _obj(m)


def dng_grotta_muro():
    m = Mesh('dng_grotta_muro')
    _rock_block(m, 2.4, 'grotta_muro', 'grotta_muro', 12)
    for i, (x, z) in enumerate(((0.75, -1.05), (-0.8, 1.05))):
        m.cone(4, 0.2, 0.0, 0.3, 'grotta_muro', cx=x, cz=z, a0=i)
    return _obj(m)


def dng_grotta_muro_basso():
    m = Mesh('dng_grotta_muro_basso')
    _rock_block(m, 0.6, 'grotta_muro', 'grotta_pav', 13, jag=0.08)
    m.cone(4, 0.15, 0.0, 0.22, 'grotta_muro', cx=0.7, cz=-1.05)
    return _obj(m)


def _cripta_block(m, H):
    cap = min(0.25, H * 0.2)
    m.box(-1, 0, -1, 1, min(0.3, H * 0.3), 1, 'cripta_muro', top='cripta_pav', skip=('bottom',))
    m.box(-0.93, min(0.3, H * 0.3), -0.93, 0.93, H - cap, 0.93, 'cripta_muro', skip=('bottom', 'top'))
    m.box(-1, H - cap, -1, 1, H, 1, 'lacca_scura', top='nero_lacca', skip=('bottom',))


def dng_cripta_pavimento():
    m = Mesh('dng_cripta_pavimento')
    face(m, [(-1, 0, -1), (1, 0, -1), (1, 0, 1), (-1, 0, 1)], 'cripta_pav', (0, 1, 0))
    for a, b, nn in (((-1, -1), (1, -1), (0, 0, -1)), ((1, -1), (1, 1), (1, 0, 0)), ((1, 1), (-1, 1), (0, 0, 1)), ((-1, 1), (-1, -1), (-1, 0, 0))):
        face(m, [(a[0], 0, a[1]), (b[0], 0, b[1]), (b[0], -0.3, b[1]), (a[0], -0.3, a[1])], 'cripta_muro', nn)
    face(m, [(math.cos(2 * math.pi * i / 8 + math.pi / 8) * 0.32, 0.006, math.sin(2 * math.pi * i / 8 + math.pi / 8) * 0.32) for i in range(8)], 'p_roccia', (0, 1, 0))
    face(m, [(math.cos(2 * math.pi * i / 4) * 0.18, 0.012, math.sin(2 * math.pi * i / 4) * 0.18) for i in range(4)], 'p_rosso', (0, 1, 0))
    return _obj(m)


def dng_cripta_muro():
    m = Mesh('dng_cripta_muro')
    _cripta_block(m, 2.4)
    for z, nz in ((-0.94, -1), (0.94, 1)):  # talismani di carta
        face(m, [(-0.12, 1.1, z + 0.01 * nz), (0.12, 1.1, z + 0.01 * nz), (0.12, 1.6, z + 0.01 * nz), (-0.12, 1.6, z + 0.01 * nz)], 'carta_tesa', (0, 0, nz), uv='fit')
    return _obj(m)


def dng_cripta_muro_basso():
    m = Mesh('dng_cripta_muro_basso')
    _cripta_block(m, 0.6)
    return _obj(m)


def dng_vuoto_pavimento():
    m = Mesh('dng_vuoto_pavimento')
    _floor_jag(m, 'vuoto_pav', 'vuoto_muro', 21, bump=0.06)
    crystal(m, (0.55, -0.02, -0.45), (0.62, 0.28, -0.5), 0.07)
    crystal(m, (-0.5, -0.02, 0.5), (-0.58, 0.2, 0.55), 0.05)
    return _obj(m)


def dng_vuoto_muro():
    m = Mesh('dng_vuoto_muro')
    _rock_block(m, 2.4, 'vuoto_muro', 'vuoto_pav', 22, jag=0.25, bands=1)
    for base, tip, r in (((0.75, 2.1, -0.75), (1.15, 2.85, -1.1), 0.14), ((0.6, 1.9, -0.9), (0.75, 2.4, -1.35), 0.09), ((0.85, 1.8, -0.55), (1.35, 2.2, -0.6), 0.09)):
        crystal(m, base, tip, r)
    return _obj(m)


def dng_vuoto_muro_basso():
    m = Mesh('dng_vuoto_muro_basso')
    _rock_block(m, 0.6, 'vuoto_muro', 'vuoto_pav', 23, jag=0.1)
    crystal(m, (0.6, 0.45, -0.6), (0.8, 0.95, -0.85), 0.1)
    crystal(m, (-0.5, 0.45, 0.55), (-0.62, 0.8, 0.75), 0.07)
    return _obj(m)


# ------------------------------------------------------------------ prop del dungeon (50-200 tri)
def dng_colonna():
    m = Mesh('dng_colonna')
    m.box(-0.42, 0, -0.42, 0.42, 0.25, 0.42, 'pietra_p', top='pietra_liscia', skip=('bottom',))
    m.prism(8, 0.3, 0.26, 0.25, 0.4, 'pietra_liscia', a0=math.pi / 8)
    m.prism(8, 0.25, 0.23, 0.4, 2.05, 'pietra_p', a0=math.pi / 8)
    m.prism(8, 0.23, 0.32, 2.05, 2.18, 'pietra_liscia', a0=math.pi / 8)
    m.box(-0.4, 2.18, -0.4, 0.4, 2.4, 0.4, 'pietra_p', top='p_pietra_scura', skip=('bottom',))
    m.cone(4, 0.12, 0.0, 0.14, 'pietra_p', cx=0.5, cz=-0.35)  # scheggia caduta
    return _obj(m)


def dng_torcia():
    """Torcia da muro: origine sulla faccia del muro a terra, sporge verso −Z."""
    m = Mesh('dng_torcia')
    m.box(-0.07, 1.35, -0.03, 0.07, 1.65, 0.0, 'ferro', skip=('back',))
    beam(m, (0, 1.45, -0.02), (0, 1.55, -0.22), 0.04, 0.04, 'ferro', n=4)
    tube(m, [(0, 1.38, -0.18), (0, 1.62, -0.24), (0, 1.78, -0.28)], [0.03, 0.035, 0.04], 4, 'legno_pieno', cap0='legno_scuro')
    m.prism(5, 0.065, 0.075, 1.68, 1.82, 'tela', cx=0.0, cz=-0.28)
    tube(m, [(0, 1.8, -0.28), (0, 1.9, -0.28), (0.02, 2.12, -0.3)], [0.07, 0.1, 0], 5, 'em_fuoco', mat=EM)
    tube(m, [(0.03, 1.86, -0.26), (-0.04, 2.02, -0.31)], [0.05, 0], 3, 'em_fuoco', mat=EM)
    return _obj(m, anchors={'fiamma': [0, 1.95, -0.29]})


def dng_forziere():
    m = Mesh('dng_forziere')
    _chest(m, 0.0, 0.0, 0.9, 0.55, 0.42)
    return _obj(m)


def dng_forziere_aperto():
    m = Mesh('dng_forziere_aperto')
    _chest(m, 0.0, 0.0, 0.9, 0.55, 0.42, open_deg=105, inside='oro')
    m.cone(6, 0.24, 0.36, 0.5, 'oro', cx=-0.05, cz=0.0)
    blob(m, (0.22, 0.43, -0.05), 0.05, 0.05, 0.05, 'em_neon_rosso', n=4, k=2, mat=EM)
    for x, z in ((0.55, -0.4), (-0.6, -0.35)):
        m.prism(6, 0.05, 0.05, 0.0, 0.02, 'oro', top='oro', cx=x, cz=z)
    return _obj(m)


def dng_scala():
    """Scala d'uscita: sale verso +Z, in cima un'apertura di luce che scende sui gradini."""
    m = Mesh('dng_scala')
    n, run, rise = 6, 2.0 / 6, 2.4 / 6
    for i in range(n):
        z0 = -1 + i * run
        m.box(-0.72, 0, z0, 0.72, (i + 1) * rise, z0 + run, 'pietra_p', top='pietra_liscia' if i < n - 1 else 'em_scala', skip=('bottom', 'back'))
    for x in (-0.72, 0.72):
        with xf(m, t=(x, 0, 0), r=(0, 90, 0)):
            slab(m, [(1.0, 0.0), (-1.0, 0.0), (-1.0, 2.75), (0.98, 0.55)], -0.14 if x > 0 else 0.0, 0.0 if x > 0 else 0.14, 'pietra_muro', side='p_pietra_scura')
    face(m, [(-0.6, 2.4, 0.98), (0.6, 2.4, 0.98), (0.6, 3.5, 0.98), (-0.6, 3.5, 0.98)], 'em_scala', (0, 0, -1), mat=EM, uv='fit')
    for xx in (-0.68, 0.68):
        beam(m, (xx, 2.4, 0.95), (xx, 3.6, 0.95), 0.12, 0.12, 'pietra_p', end='pietra_liscia')
    beam(m, (-0.78, 3.6, 0.95), (0.78, 3.6, 0.95), 0.14, 0.14, 'pietra_p', end='pietra_liscia')
    for x, w in ((-0.3, 0.07), (0.05, 0.1), (0.35, 0.06)):
        quad2(m, [(x - w, 3.3, 0.9), (x + w, 3.3, 0.9), (x + w * 1.6, 0.9, -0.45), (x - w * 1.6, 0.9, -0.45)], 'em_scala', (0, 0.6, -1), mat=EM, uv='fit')
    return _obj(m, anchors={'luce': [0, 2.9, 0.8], 'uscita': [0, 0, -0.8]})


def dng_libro():
    m = Mesh('dng_libro')
    m.box(-0.2, 0, -0.16, 0.2, 0.08, 0.16, 'legno_scuro', skip=('bottom',))
    beam(m, (0, 0.08, 0), (0, 0.85, 0.02), 0.08, 0.08, 'legno_scuro')
    with xf(m, r=(-28, 0, 0), pivot=(0, 0.9, 0)):
        m.box(-0.26, 0.85, -0.18, 0.26, 0.9, 0.18, 'legno_pieno', top='legno_scuro', skip=())
        for s in (-1, 1):
            with xf(m, r=(0, 0, -6 * s), pivot=(0, 0.9, 0)):
                m.box(min(0, s * 0.22), 0.9, -0.15, max(0, s * 0.22), 0.94, 0.15, 'p_sabbia_chiara', top='pagine', skip=('bottom',), uv='fit')
            m.box(min(0, s * 0.24), 0.895, -0.165, max(0, s * 0.24), 0.905, 0.165, 'tessuto_rosso', skip=('top',))
    m.prism(5, 0.025, 0.025, 0.08, 0.22, 'p_sabbia_chiara', top='p_sabbia_chiara', cx=0.15, cz=-0.08)
    tube(m, [(0.15, 0.22, -0.08), (0.15, 0.3, -0.08)], [0.02, 0], 4, 'em_fuoco', mat=EM)
    quad2(m, [(-0.07, 1.12, -0.08), (0.07, 1.12, -0.08), (0.07, 1.26, -0.06), (-0.07, 1.26, -0.06)], 'em_runa', (0, 0.2, -1), mat=EM, uv='fit')
    return _obj(m, anchors={'luce': [0, 1.15, 0]})


def _bone(m, a, b, r, region='ossa'):
    mid = _mid(a, b)
    tube(m, [a, _mid(a, mid), _mid(mid, b), b], [r * 1.5, r, r, r * 1.5], 4, region, cap0=region, cap1=region)


def _skull(m, c, s, region='teschio', alt='ossa', eyes=None):
    """Teschio: anelli con il viso proiettato davanti (orbite, naso, denti), occhi accesi facoltativi."""
    x, y, z = c
    R = lambda rx, yy, rz, cz=0.0: m.ring(8, rx * s, y + yy * s, rz=rz * s, a0=math.pi / 8, cx=x, cz=z + cz * s)
    rings = [R(0.06, -0.13, 0.06, -0.03), R(0.085, -0.09, 0.09, -0.02), R(0.1, -0.02, 0.11), R(0.105, 0.05, 0.11, 0.01), R(0.085, 0.11, 0.09, 0.01)]
    bb = (x - 0.105 * s, y - 0.13 * s, x + 0.105 * s, y + 0.14 * s)
    m.loft(rings, region, bottom=alt, uv='head', bbox=bb, alt=alt)
    top = (x, y + 0.14 * s, z + 0.01 * s)
    for i in range(8):
        j = (i + 1) % 8
        m.poly([rings[-1][j], rings[-1][i], top], alt)
    if eyes:
        for sx in (-1, 1):
            ex, ey, ez = x + sx * 0.042 * s, y + 0.02 * s, z - 0.112 * s
            face(m, [(ex - 0.016 * s, ey - 0.012 * s, ez), (ex + 0.016 * s, ey - 0.012 * s, ez), (ex + 0.016 * s, ey + 0.012 * s, ez), (ex - 0.016 * s, ey + 0.012 * s, ez)], eyes, (0, 0, -1), mat=EM)


def dng_ossa():
    m = Mesh('dng_ossa')
    with xf(m, r=(0, -25, 18), pivot=(0.1, 0.09, -0.05)):
        _skull(m, (0.1, 0.12, -0.05), 0.9)
    for a, b in (((-0.4, 0.03, 0.1), (0.1, 0.03, 0.3)), ((-0.35, 0.03, -0.25), (-0.05, 0.03, 0.15)), ((0.25, 0.03, 0.2), (0.5, 0.03, -0.15))):
        _bone(m, a, b, 0.025)
    band(m, (-0.3, 0, -0.35), 0.13, 0.08, 0.02, 0.05, 'ossa', n=6)
    return _obj(m)


def dng_cristallo():
    m = Mesh('dng_cristallo')
    dome(m, (0, 0, 0), 0.45, 0.25, 0.4, 'vuoto_muro', n=6, k=2, jit=0.2, seed=5, top_region='vuoto_pav')
    for base, tip, r in (((0, 0.1, 0), (0.05, 1.1, -0.05), 0.14), ((0.2, 0.05, -0.1), (0.55, 0.7, -0.3), 0.1), ((-0.2, 0.05, 0.05), (-0.5, 0.75, 0.15), 0.1),
                         ((0.05, 0.05, 0.22), (0.15, 0.6, 0.5), 0.08), ((-0.1, 0.05, -0.2), (-0.25, 0.5, -0.5), 0.07)):
        crystal(m, base, tip, r)
    return _obj(m, anchors={'luce': [0, 0.6, 0]})


def prop_sacco():
    """Sacco del bottino a terra: iuta legata, monete sparse."""
    m = Mesh('prop_sacco')
    def ring(r, y, k):
        return [(math.cos(2 * math.pi * i / 7) * r * (1 + 0.12 * (h01(i, k, 9) - 0.5)), y + 0.03 * (h01(k, i, 9) - 0.5), math.sin(2 * math.pi * i / 7) * r * (1 + 0.12 * (h01(i, k, 8) - 0.5))) for i in range(7)]
    rings = [ring(0.24, 0.0, 0), ring(0.31, 0.16, 1), ring(0.26, 0.36, 2), ring(0.1, 0.47, 3), ring(0.15, 0.55, 4)]
    m.loft(rings, 'tela_sacco', bottom='tela_sacco')
    top = (0.02, 0.58, 0.0)
    for i in range(7):
        m.poly([rings[-1][(i + 1) % 7], rings[-1][i], top], 'tela_sacco')
    m.prism(7, 0.115, 0.115, 0.45, 0.5, 'corda')
    for i, (x, z) in enumerate(((0.36, -0.2), (0.28, -0.36), (-0.32, -0.28))):
        m.prism(6, 0.05, 0.05, 0.0, 0.02 + 0.015 * (i == 0), 'oro', top='oro', cx=x, cz=z)
    return _obj(m)


# ------------------------------------------------------------------ nemici (≤ 600 tri, boss ≤ 1.200)
def _shell(m, rings, region, front=-0.45, tip=None, **o):
    """Come loft, ma senza le facce che guardano avanti (cappucci, elmi aperti sul viso)."""
    c = _mid(*[p for r in rings for p in r])
    for ra, rb in zip(rings, rings[1:]):
        n = len(ra)
        for i in range(n):
            j = (i + 1) % n
            q = [ra[i], ra[j], rb[j], rb[i]]
            nn = _sub(_mid(*q), c)
            if _norm(nn)[2] < front:
                continue
            face(m, q, region, nn, **o)
            face(m, q, 'p_nero_caldo', _mul(nn, -1))
    if tip:
        for i in range(len(rings[-1])):
            j = (i + 1) % len(rings[-1])
            face(m, [rings[-1][i], rings[-1][j], tip], region, _sub(_mid(rings[-1][i], rings[-1][j], tip), c), **o)


def nem_bandito():
    """Bandito: umano a 6 teste, cappuccio verde scuro, fazzoletto rosso, giubba di cuoio, sciabola corta in pugno."""
    m = Mesh('nem_bandito')
    # gambe in posa di guardia (sinistra avanti)
    for s, zk, zf in ((-1, -0.1, -0.16), (1, 0.08, 0.16)):
        tube(m, [(0.1 * s, 0.88, 0.0), (0.13 * s, 0.47, zk), (0.14 * s, 0.12, zf)], [0.085, 0.062, 0.048], 6, 'pantaloni')
        m.box(0.14 * s - 0.055, 0.0, zf - 0.17, 0.14 * s + 0.055, 0.2, zf + 0.06, 'cuoio', top='scarpe', skip=('bottom',))
    with xf(m, r=(-7, 0, 0), pivot=(0, 0.9, 0)):
        R = lambda rx, y, rz, cz=0.0: m.ring(8, rx, y, rz=rz, a0=math.pi / 8, cz=cz)
        m.loft([R(0.15, 0.82, 0.1), R(0.14, 1.0, 0.095), R(0.165, 1.12, 0.11, -0.01), R(0.19, 1.25, 0.105), R(0.16, 1.34, 0.09), R(0.06, 1.39, 0.05)], 'cuoio', bottom='pantaloni')
        m.loft([R(0.152, 0.9, 0.103), R(0.152, 0.96, 0.103)], 'cintura')
        m.box(-0.06, 0.88, -0.13, 0.06, 0.98, -0.1, 'oro', skip=('back',))
        # braccia: destra avanti con la sciabola, sinistra larga
        tube(m, [(0.2, 1.31, 0.0), (0.27, 1.1, -0.14), (0.25, 1.02, -0.38)], [0.06, 0.05, 0.04], 6, 'cappuccio')
        m.box(0.21, 0.97, -0.46, 0.29, 1.07, -0.37, 'pelle_bandito', skip=())
        tube(m, [(-0.2, 1.31, 0.0), (-0.33, 1.06, 0.03), (-0.38, 0.86, -0.07)], [0.06, 0.05, 0.04], 6, 'cappuccio')
        m.box(-0.42, 0.78, -0.12, -0.34, 0.88, -0.03, 'pelle_bandito', skip=())
        with xf(m, t=(0.25, 1.02, -0.42), r=(-65, 0, 0)):
            beam(m, (0, -0.06, 0), (0, 0.06, 0), 0.035, 0.035, 'cuoio', n=4)
            m.box(-0.06, 0.06, -0.02, 0.06, 0.08, 0.02, 'ferro', skip=())
            slab(m, [(-0.02, 0.08), (0.025, 0.08), (0.03, 0.4), (-0.02, 0.52), (-0.035, 0.42)], -0.006, 0.006, 'ferro', side='metallo')
        # mantellina sulle spalle e sulla schiena
        quad2(m, [(-0.22, 1.36, 0.1), (0.22, 1.36, 0.1), (0.26, 0.98, 0.16), (-0.26, 0.98, 0.16)], 'cappuccio', (0, 0, 1))
    # testa (viso a colore fisso) e cappuccio a punta
    hx, hy, hz = 0.0, 1.535, -0.07
    H = lambda rx, y, rz, cz=0.0: m.ring(8, rx, hy + y, rz=rz, a0=math.pi / 8, cx=hx, cz=hz + cz)
    Hd = [H(0.05, -0.2, 0.05, -0.03), H(0.082, -0.165, 0.088, -0.005), H(0.097, -0.105, 0.105), H(0.1, -0.06, 0.11), H(0.097, -0.015, 0.11), H(0.075, 0.04, 0.088)]
    m.loft(Hd, 'testa_bandito', bottom='pelle_bandito', uv='head', bbox=(hx - 0.11, hy - 0.215, hx + 0.11, hy + 0.065), alt='pelle_bandito')
    for i in range(8):
        m.poly([Hd[-1][(i + 1) % 8], Hd[-1][i], (hx, hy + 0.07, hz)], 'pelle_bandito')
    _shell(m, [H(0.13, -0.17, 0.13, 0.02), H(0.13, -0.04, 0.14, 0.0), H(0.11, 0.07, 0.12, 0.01)], 'cappuccio', front=-0.5, tip=(hx, hy + 0.17, hz + 0.1))
    return _obj(m)


def nem_lupo():
    """Lupo grigio in carica: testa bassa, orecchie dritte, coda tesa, occhi gialli accesi."""
    m = Mesh('nem_lupo')
    tube(m, [(0, 0.62, 0.55), (0, 0.67, 0.3), (0, 0.69, -0.05), (0, 0.67, -0.3)], [(0.13, 0.14), (0.17, 0.18), (0.2, 0.22), (0.18, 0.23)], 7, 'pelliccia', cap0='pelliccia')
    tube(m, [(0, 0.7, -0.36), (0, 0.78, -0.55), (0, 0.74, -0.74), (0, 0.69, -0.88)], [(0.14, 0.13), (0.12, 0.11), (0.07, 0.065), (0.04, 0.035)], 6, 'pelliccia', cap1='p_nero_caldo')
    tube(m, [(0, 0.66, -0.6), (0, 0.6, -0.82)], [0.045, 0.025], 4, 'pelliccia', cap1='pelliccia')
    for sx in (-1, 1):
        cone_dir(m, (sx * 0.06, 0.86, -0.5), (sx * 0.09, 1.02, -0.46), 0.045, 3, 'pelliccia')
        face(m, [(sx * 0.055, 0.81, -0.66), (sx * 0.085, 0.8, -0.62), (sx * 0.085, 0.825, -0.615), (sx * 0.055, 0.835, -0.655)], 'em_neon_ambra', (sx * 0.5, 0.2, -1), mat=EM)
        cone_dir(m, (sx * 0.03, 0.68, -0.8), (sx * 0.03, 0.62, -0.81), 0.012, 3, 'p_pietra_chiara')
    for x, z0, zk, zf in ((-0.1, -0.28, -0.32, -0.42), (0.1, -0.28, -0.22, -0.2), (-0.1, 0.45, 0.58, 0.5), (0.1, 0.45, 0.62, 0.68)):
        tube(m, [(x, 0.62, z0), (x * 1.05, 0.33, zk + (0.1 if z0 > 0 else 0)), (x * 1.05, 0.03, zf)], [0.07, 0.045, 0.035], 4, 'pelliccia', cap1='p_roccia')
    tube(m, [(0, 0.63, 0.6), (0, 0.6, 0.82), (0, 0.5, 0.98)], [0.06, 0.07, 0], 4, 'pelliccia')
    for i, z in enumerate((-0.4, -0.15, 0.1)):  # criniera irta
        quad2(m, [(0, 0.86 - 0.04 * i, z - 0.1), (0, 0.86 - 0.04 * i, z + 0.12), (0, 0.98 - 0.05 * i, z + 0.04), (0, 0.98 - 0.05 * i, z - 0.02)], 'pelliccia', (1, 0, 0))
    return _obj(m)


def nem_ragno():
    """Ragno gigante: addome con segno rosso, otto zampe ad arco, occhi rossi accesi, cheliceri."""
    m = Mesh('nem_ragno')
    blob(m, (0, 0.62, 0.38), 0.42, 0.36, 0.5, 'chitina', n=8, k=4)
    face(m, [(0, 0.985, 0.2), (0.09, 0.96, 0.36), (0, 0.985, 0.52), (-0.09, 0.96, 0.36)], 'p_rosso', (0, 1, 0))
    blob(m, (0, 0.5, -0.25), 0.26, 0.2, 0.3, 'chitina', n=6, k=3)
    for x, y, z in ((-0.06, 0.6, -0.52), (0.06, 0.6, -0.52), (-0.13, 0.57, -0.48), (0.13, 0.57, -0.48)):
        face(m, [(x - 0.025, y - 0.02, z), (x + 0.025, y - 0.02, z), (x + 0.025, y + 0.02, z), (x - 0.025, y + 0.02, z)], 'em_neon_rosso', (x * 3, 0.2, -1), mat=EM)
    for sx in (-1, 1):
        cone_dir(m, (sx * 0.07, 0.42, -0.5), (sx * 0.05, 0.24, -0.58), 0.04, 3, 'p_nero_caldo')
    for sx in (-1, 1):
        for k, ang in enumerate((-60, -22, 18, 55)):
            a = math.radians(ang)
            d = (sx * math.cos(a), 0, math.sin(a))
            hip = (sx * 0.2, 0.52, -0.25 + 0.1 * math.sin(a))
            pt = lambda f, y: (hip[0] + d[0] * f, y, hip[2] + d[2] * f)
            tube(m, [hip, pt(0.42, 0.98), pt(0.9, 0.62), pt(1.15, 0.0)], [0.055, 0.045, 0.03, 0.012], 4, 'chitina')
    for i in range(6):
        a = 2 * math.pi * i / 6
        b = (math.cos(a) * 0.28, 0.85, 0.38 + math.sin(a) * 0.32)
        cone_dir(m, b, (b[0] * 1.3, 0.98, 0.38 + (b[2] - 0.38) * 1.3), 0.025, 3, 'chitina')
    return _obj(m)


def _skeleton(m, S=1.0, rib_n=4, bone=0.03, weapon='spada', eyes='em_neon_rosso', crown=False):
    """Scheletro alto 1,7·S m in guardia: teschio col viso, costole ad anello (si vede attraverso), spada alzata."""
    P = lambda x, y, z: (x * S, y * S, z * S)
    r = bone * S
    _skull(m, P(0, 1.56, -0.03), S, eyes=eyes)
    tube(m, [P(0, 0.9, 0.03), P(0, 1.15, 0.05), P(0, 1.42, -0.01)], [r * 1.1, r, r * 0.9], 4, 'ossa')
    for i in range(rib_n):
        y = 1.3 - i * (0.27 / max(1, rib_n - 1))
        band(m, P(0, 0, -0.01), (0.155 - 0.012 * i) * S, 0.105 * S, y * S, (y + 0.032) * S, 'ossa', n=8)
    tube(m, [P(0, 1.31, -0.115), P(0, 1.02, -0.1)], [r * 0.6, r * 0.5], 3, 'ossa')
    tube(m, [P(-0.2, 1.34, 0.0), P(0.2, 1.34, 0.0)], [r * 0.7, r * 0.7], 3, 'ossa')
    m.prism(6, 0.12 * S, 0.15 * S, 0.84 * S, 0.97 * S, 'ossa')
    # braccia: destra alzata in avanti con l'arma, sinistra protesa
    sh, el, wr = P(0.2, 1.34, 0.0), P(0.28, 1.12, -0.12), P(0.29, 1.2, -0.37)
    _bone(m, sh, el, r * 0.85); _bone(m, el, wr, r * 0.75)
    blob(m, wr, 0.04 * S, 0.04 * S, 0.04 * S, 'ossa', n=4, k=2)
    _bone(m, P(-0.2, 1.34, 0.0), P(-0.29, 1.09, 0.02), r * 0.85); _bone(m, P(-0.29, 1.09, 0.02), P(-0.31, 0.88, -0.14), r * 0.75)
    for k in range(3):
        cone_dir(m, P(-0.31 + 0.015 * k, 0.87, -0.14), P(-0.33 + 0.03 * k, 0.8, -0.2), r * 0.35, 3, 'ossa')
    for sx, zk, zf in ((-1, -0.08, -0.12), (1, 0.06, 0.12)):
        _bone(m, P(0.1 * sx, 0.88, 0.02), P(0.13 * sx, 0.47, zk), r * 1.0)
        _bone(m, P(0.13 * sx, 0.47, zk), P(0.14 * sx, 0.08, zf), r * 0.85)
        m.box((0.14 * sx - 0.045) * S, 0, (zf - 0.15) * S, (0.14 * sx + 0.045) * S, 0.07 * S, (zf + 0.04) * S, 'ossa', skip=('bottom',))
    if weapon:
        with xf(m, t=wr, r=(-55, 0, -8)):
            beam(m, (0, -0.07 * S, 0), (0, 0.07 * S, 0), 0.035 * S, 0.035 * S, 'cuoio', n=4)
            m.box(-0.09 * S, 0.07 * S, -0.025 * S, 0.09 * S, 0.1 * S, 0.025 * S, 'ferro_rotto', skip=())
            if weapon == 'spada':
                slab(m, [(-0.03 * S, 0.1 * S), (0.03 * S, 0.1 * S), (0.032 * S, 0.55 * S), (0.012 * S, 0.6 * S), (0.028 * S, 0.68 * S), (0.0, 0.8 * S), (-0.03 * S, 0.7 * S)], -0.008 * S, 0.008 * S, 'ferro_rotto')
            else:  # mazza d'osso del re
                tube(m, [(0, 0.1 * S, 0), (0, 0.5 * S, 0), (0, 0.8 * S, 0)], [0.03 * S, 0.05 * S, 0.06 * S], 5, 'ossa', cap1='ossa')
                for k in range(5):
                    a = 2 * math.pi * k / 5
                    cone_dir(m, (math.cos(a) * 0.05 * S, 0.72 * S, math.sin(a) * 0.05 * S), (math.cos(a) * 0.16 * S, 0.76 * S, math.sin(a) * 0.16 * S), 0.025 * S, 3, 'ossa')
    if crown:
        cy = 1.67 * S
        m.prism(8, 0.1 * S, 0.11 * S, cy, cy + 0.06 * S, 'oro', a0=math.pi / 8, cz=-0.02 * S)
        for k in range(8):
            a = 2 * math.pi * k / 8 + math.pi / 8
            b = (math.cos(a) * 0.105 * S, cy + 0.05 * S, -0.02 * S + math.sin(a) * 0.105 * S)
            cone_dir(m, b, (b[0] * 1.05, cy + (0.16 if k % 2 else 0.11) * S, b[2]), 0.025 * S, 3, 'oro')
        blob(m, (0, cy + 0.03 * S, -0.13 * S), 0.025 * S, 0.025 * S, 0.02 * S, 'em_neon_rosso', n=4, k=2, mat=EM)


def nem_scheletro():
    m = Mesh('nem_scheletro')
    _skeleton(m, 1.0)
    return _obj(m)


def nem_re_ossa():
    """Boss della Cripta: scheletro gigante (~3 m) coronato, mantello lacero, spallacci d'osso, mazza d'ossa."""
    m = Mesh('nem_re_ossa')
    S = 1.78
    _skeleton(m, S, rib_n=5, bone=0.036, weapon='mazza', eyes='em_neon_ambra', crown=True)
    for sx in (-1, 1):  # spallacci a punte
        blob(m, (sx * 0.22 * S, 1.36 * S, 0.0), 0.09 * S, 0.06 * S, 0.09 * S, 'ossa', n=6, k=3)
        for k in range(3):
            cone_dir(m, (sx * (0.2 + 0.04 * k) * S, 1.38 * S, (-0.04 + 0.04 * k) * S), (sx * (0.3 + 0.05 * k) * S, 1.58 * S, (-0.06 + 0.06 * k) * S), 0.03 * S, 3, 'ossa')
    # mantello lacero sulla schiena (due facce)
    cape = [(-0.26, 1.38, 0.12), (0.26, 1.38, 0.12), (0.34, 0.5, 0.26), (0.2, 0.62, 0.27), (0.08, 0.42, 0.28), (-0.06, 0.58, 0.28), (-0.2, 0.4, 0.27), (-0.34, 0.55, 0.26)]
    cape = [(x * S, y * S, z * S) for x, y, z in cape]
    face(m, cape, 'tessuto_rosso', (0, 0, 1))
    face(m, cape, 'lacca_scura', (0, 0, -1))
    # cintura con teschietto e gonnellino di ferro rotto
    band(m, (0, 0, 0.0), 0.16 * S, 0.12 * S, 0.9 * S, 0.96 * S, 'ferro_rotto', n=8)
    for k in range(4):
        x = (-0.15 + 0.1 * k) * S
        quad2(m, [(x - 0.045 * S, 0.9 * S, -0.13 * S), (x + 0.045 * S, 0.9 * S, -0.13 * S), (x + 0.04 * S, 0.66 * S, -0.16 * S), (x - 0.04 * S, 0.66 * S, -0.16 * S)], 'ferro_rotto', (0, 0, -1))
    return _obj(m)


def nem_nonmorto():
    """Non-morto antico: teschio con elmo a corna, corazza a lamelle rotta (si vedono le costole), katana spezzata."""
    m = Mesh('nem_nonmorto')
    _skull(m, (0, 1.58, -0.03), 1.0, eyes='em_neon_ciano')
    R = lambda rx, y, rz, cz=0.0: m.ring(8, rx, y, rz=rz, a0=math.pi / 8, cz=cz)
    _shell(m, [R(0.125, 1.6, 0.13), R(0.12, 1.68, 0.125), R(0.08, 1.74, 0.085)], 'lacca_scura', front=-0.6, tip=(0, 1.77, 0.0))
    face(m, [(-0.16, 1.62, -0.13), (0.16, 1.62, -0.13), (0.2, 1.6, -0.02), (-0.2, 1.6, -0.02)], 'lacca_scura', (0, 1, 0))
    for sx in (-1, 1):
        quad2(m, [(sx * 0.03, 1.68, -0.13), (sx * 0.06, 1.68, -0.13), (sx * 0.2, 1.9, -0.14), (sx * 0.16, 1.92, -0.14)], 'oro', (0, 0, -1))
    tube(m, [(0, 1.38, 0.0), (0, 1.47, -0.02)], [0.025, 0.025], 4, 'ossa')
    # corazza: anelli di lamelle, davanti a sinistra rotta: dentro le costole
    rings = [R(0.15, 0.9, 0.1), R(0.16, 1.05, 0.105), R(0.19, 1.2, 0.115), R(0.2, 1.35, 0.11)]
    for ra, rb in zip(rings, rings[1:]):
        for i in range(8):
            j = (i + 1) % 8
            q = [ra[i], ra[j], rb[j], rb[i]]
            c = _mid(*q)
            if c[1] > 1.0 and c[0] < -0.02 and c[2] < -0.02:
                continue  # breccia
            face(m, q, 'ferro_rotto', (c[0], 0, c[2]))
            face(m, q, 'p_nero_caldo', (-c[0], 0, -c[2]))
    for y in (1.12, 1.22):
        band(m, (0, 0, -0.005), 0.13, 0.085, y, y + 0.03, 'ossa', n=8)
    face(m, rings[-1], 'lacca_scura', (0, 1, 0))
    for sx in (-1, 1):  # spallacci (sode)
        with xf(m, r=(0, 0, -25 * sx), pivot=(sx * 0.22, 1.37, 0)):
            m.box(sx * 0.22 - 0.1, 1.2, -0.13, sx * 0.22 + 0.1, 1.38, 0.13, 'lacca_scura', top='ferro_rotto', skip=())
    for k, a in enumerate((-60, -20, 20, 60, 120, 180, 240)):  # gonnellino a lamelle
        aa = math.radians(a - 90)
        cx, cz = math.cos(aa) * 0.17, math.sin(aa) * 0.12
        if k == 3 or k == 5:
            continue
        quad2(m, [(cx - 0.06, 0.92, cz), (cx + 0.06, 0.92, cz), (cx * 1.25 + 0.05, 0.66, cz * 1.25), (cx * 1.25 - 0.05, 0.66, cz * 1.25)], 'lacca_scura', (cx, -0.2, cz))
    # braccia: destra d'osso con la katana spezzata, sinistra corazzata
    _bone(m, (0.22, 1.32, 0.0), (0.28, 1.08, -0.1), 0.026)
    _bone(m, (0.28, 1.08, -0.1), (0.27, 1.0, -0.36), 0.022)
    with xf(m, t=(0.27, 1.0, -0.4), r=(-75, 0, 0)):
        beam(m, (0, -0.1, 0), (0, 0.08, 0), 0.035, 0.035, 'nero_p', n=4)
        m.prism(6, 0.05, 0.05, 0.08, 0.1, 'ferro_rotto', top='ferro_rotto', bottom='ferro_rotto')
        slab(m, [(-0.016, 0.1), (0.016, 0.1), (0.02, 0.42), (0.004, 0.47), (-0.012, 0.44), (-0.02, 0.36)], -0.006, 0.006, 'ferro_rotto')
    tube(m, [(-0.22, 1.32, 0.0), (-0.32, 1.06, 0.03), (-0.34, 0.84, -0.08)], [0.065, 0.055, 0.05], 6, 'ferro_rotto', cap1='ossa')
    for sx, zk, zf in ((-1, -0.08, -0.12), (1, 0.06, 0.12)):
        tube(m, [(0.1 * sx, 0.88, 0.02), (0.13 * sx, 0.47, zk), (0.14 * sx, 0.1, zf)], [0.07, 0.06, 0.05], 6, 'lacca_scura')
        m.box(0.14 * sx - 0.045, 0, zf - 0.15, 0.14 * sx + 0.045, 0.07, zf + 0.04, 'ossa', skip=('bottom',))
    quad2(m, [(0.12, 0.98, -0.14), (0.2, 0.98, -0.12), (0.18, 0.55, -0.2), (0.12, 0.6, -0.2)], 'tessuto_rosso', (0, 0, -1))
    return _obj(m)


def nem_spettro():
    """Spettro fluttuante: veste viola neon a orlo frastagliato, cappuccio vuoto con occhi ciano, mani ossute protese."""
    m = Mesh('nem_spettro')
    n = 8
    def ring(r, y, jag=0.0, cz=0.0):
        return [(math.cos(2 * math.pi * i / n) * r, y + (jag if i % 2 else -jag), cz + math.sin(2 * math.pi * i / n) * r) for i in range(n)]
    rings = [ring(0.36, 0.38, 0.12, 0.06), ring(0.28, 0.85, 0, 0.03), ring(0.22, 1.25), ring(0.25, 1.5), ring(0.12, 1.58)]
    m.loft(rings, 'em_spettro', mat=EM)
    H = lambda r, y, cz=0.0: m.ring(8, r, y, a0=math.pi / 8, cz=cz)
    _shell(m, [H(0.17, 1.5, -0.02), H(0.18, 1.7, 0.0), H(0.13, 1.86, 0.04)], 'em_spettro', front=-0.55, tip=(0, 2.0, 0.12), mat=EM)
    face(m, [(math.cos(2 * math.pi * i / 6) * 0.11, 1.69 + math.sin(2 * math.pi * i / 6) * 0.13, -0.1) for i in range(6)], 'p_nero_caldo', (0, 0, -1))
    for sx in (-1, 1):
        face(m, [(sx * 0.05 - 0.025, 1.7, -0.11), (sx * 0.05 + 0.025, 1.7, -0.11), (sx * 0.05 + 0.02, 1.73, -0.11), (sx * 0.05 - 0.02, 1.73, -0.11)], 'em_neon_ciano', (0, 0, -1), mat=EM)
        tube(m, [(sx * 0.22, 1.46, 0.0), (sx * 0.3, 1.32, -0.24), (sx * 0.28, 1.26, -0.44)], [0.07, 0.09, 0.12], 6, 'em_spettro', mat=EM)
        for k in range(3):
            cone_dir(m, (sx * (0.25 + 0.03 * k), 1.26, -0.45), (sx * (0.24 + 0.05 * k), 1.18 - 0.02 * k, -0.62), 0.018, 3, 'ossa')
    for k, x in enumerate((-0.18, 0.05, 0.2)):
        tube(m, [(x, 0.4, 0.15), (x * 1.3, 0.25, 0.4), (x * 1.5, 0.3, 0.7)], [0.07, 0.05, 0], 3, 'em_spettro', mat=EM)
    return _obj(m)


def nem_golem():
    """Golem di cristallo: massa di roccia nera curva in avanti, braccia lunghe e pugni enormi, cristalli viola/ciano accesi."""
    m = Mesh('nem_golem')
    for sx in (-1, 1):
        tube(m, [(sx * 0.26, 0.85, 0.05), (sx * 0.3, 0.38, -0.02), (sx * 0.32, 0.12, 0.0)], [0.19, 0.16, 0.17], 5, 'vuoto_muro')
        m.box(sx * 0.32 - 0.16, 0.0, -0.22, sx * 0.32 + 0.16, 0.14, 0.16, 'vuoto_muro', top='vuoto_pav', skip=('bottom',))
    blob(m, (0, 0.88, 0.02), 0.32, 0.18, 0.22, 'vuoto_muro', n=6, k=3)
    with xf(m, r=(-18, 0, 0), pivot=(0, 0.95, 0)):
        blob(m, (0, 1.45, 0.05), 0.55, 0.5, 0.4, 'vuoto_muro', n=7, k=4, jit=0.2, seed=4)
        blob(m, (0, 1.42, -0.37), 0.08, 0.08, 0.05, 'em_cristallo', n=4, k=2, mat=EM)
        blob(m, (0, 1.98, -0.12), 0.16, 0.14, 0.16, 'vuoto_muro', n=5, k=3, jit=0.2, seed=6)
        for sx in (-1, 1):
            face(m, [(sx * 0.06 - 0.03, 1.98, -0.27), (sx * 0.06 + 0.03, 1.98, -0.27), (sx * 0.06 + 0.03, 2.01, -0.265), (sx * 0.06 - 0.03, 2.01, -0.265)], 'em_neon_ciano', (0, 0, -1), mat=EM)
        for base, tip, r in (((0.4, 1.8, 0.1), (0.62, 2.35, 0.2), 0.11), ((0.25, 1.85, 0.25), (0.3, 2.3, 0.5), 0.08), ((-0.4, 1.8, 0.1), (-0.6, 2.4, 0.15), 0.12),
                             ((-0.15, 1.75, 0.35), (-0.2, 2.15, 0.7), 0.09), ((0.1, 1.6, 0.4), (0.15, 1.85, 0.8), 0.08), ((-0.3, 1.5, 0.38), (-0.5, 1.6, 0.75), 0.07)):
            crystal(m, base, tip, r)
    for sx in (-1, 1):
        tube(m, [(sx * 0.58, 1.72, -0.12), (sx * 0.76, 1.22, -0.2), (sx * 0.74, 0.72, -0.3)], [0.17, 0.15, 0.13], 5, 'vuoto_muro')
        blob(m, (sx * 0.75, 0.55, -0.32), 0.2, 0.18, 0.2, 'vuoto_muro', n=6, k=3, jit=0.15, seed=7)
        crystal(m, (sx * 0.85, 1.05, -0.2), (sx * 1.05, 1.25, -0.25), 0.06)
    return _obj(m)


def nem_custode():
    """Boss del Vuoto (~3,5 m): figura fluttuante di ossidiana, aureola viola neon, lame di luce ciano, cristalli sulle spalle."""
    m = Mesh('nem_custode')
    tube(m, [(0, 0.45, 0), (0, 1.4, 0.02), (0, 2.0, 0.0), (0, 2.55, 0.0)], [0, 0.34, (0.44, 0.32), (0.6, 0.36)], 8, 'vuoto_muro', cap1='vuoto_pav')
    for y, r in ((1.15, 0.29), (1.75, 0.41)):
        band(m, (0, 0, 0.01), r + 0.015, r * 0.8 + 0.015, y, y + 0.06, 'em_neon_ciano', n=8, both=False, mat=EM)
    face(m, [(math.cos(2 * math.pi * i / 6) * 0.13, 2.2 + math.sin(2 * math.pi * i / 6) * 0.13, -0.33) for i in range(6)], 'em_vuoto', (0, 0, -1), mat=EM)
    for k in range(6):  # gonna di schegge
        a = 2 * math.pi * k / 6
        b = (math.cos(a) * 0.32, 1.35, math.sin(a) * 0.26)
        crystal(m, b, (b[0] * 1.5, 0.85, b[2] * 1.5), 0.06)
    blob(m, (0, 2.92, -0.04), 0.2, 0.27, 0.2, 'vuoto_muro', n=6, k=3)
    face(m, [(-0.13, 2.93, -0.235), (0.13, 2.93, -0.235), (0.11, 2.98, -0.225), (-0.11, 2.98, -0.225)], 'em_neon_ciano', (0, 0, -1), mat=EM)
    crystal(m, (0.1, 3.1, -0.02), (0.22, 3.55, 0.05), 0.06)
    crystal(m, (-0.1, 3.1, -0.02), (-0.22, 3.55, 0.05), 0.06)
    cx, cy, cz, R, rr, N = 0.0, 3.0, 0.32, 0.62, 0.05, 14
    for i in range(N):
        a0, a1 = 2 * math.pi * i / N, 2 * math.pi * (i + 1) / N
        tube(m, [(cx + math.cos(a0) * R, cy + math.sin(a0) * R, cz), (cx + math.cos(a1) * R, cy + math.sin(a1) * R, cz)], [rr, rr], 3, 'em_neon_viola', mat=EM)
    for sx in (-1, 1):
        for k, (dx, dy, dz) in enumerate(((0.1, 0.55, 0.0), (0.32, 0.3, 0.05), (0.15, 0.4, 0.25))):
            crystal(m, (sx * 0.52, 2.55, 0.0), (sx * (0.52 + dx), 2.55 + dy, dz), 0.1 - 0.02 * k)
        tube(m, [(sx * 0.58, 2.5, 0.0), (sx * 0.95, 2.0, -0.2), (sx * 1.02, 1.5, -0.5)], [0.13, 0.11, 0.09], 6, 'vuoto_muro')
        band(m, (sx * 0.95, 0, -0.2), 0.12, 0.12, 2.0, 2.06, 'em_neon_ciano', n=6, both=False, mat=EM)
        with xf(m, t=(sx * 1.02, 1.5, -0.5), r=(-120, 0, 0)):
            slab(m, [(-0.08, 0.0), (0.08, 0.0), (0.1, 0.45), (0.0, 0.95), (-0.06, 0.5)], -0.02, 0.02, 'em_neon_ciano', mat=EM)
    for k in range(3):
        a = 2 * math.pi * k / 3 + 0.5
        blob(m, (math.cos(a) * 0.95, 0.9 + 0.3 * k, math.sin(a) * 0.95), 0.08, 0.16, 0.08, 'em_cristallo', n=4, k=2, mat=EM)
    return _obj(m)


# ------------------------------------------------------------------ armi (impugnatura all'origine, punta +Y, ≤ 80 tri)
def arm_katana():
    m = Mesh('arm_katana')
    tube(m, [(0, -0.14, 0), (0, 0.13, 0)], [0.017, 0.016], 4, 'nero_p', cap0='oro')
    m.prism(6, 0.042, 0.042, 0.13, 0.145, 'oro', top='oro', bottom='oro')
    prof = [(-0.014, 0.145), (0.016, 0.145), (0.016, 0.45), (0.012, 0.7), (0.002, 0.88), (-0.02, 0.93), (-0.02, 0.86), (-0.016, 0.7), (-0.014, 0.45)]
    slab(m, prof, -0.005, 0.005, 'lama', mat=LAMA)
    return _obj(m)


def arm_nunchaku():
    m = Mesh('arm_nunchaku')
    m.prism(6, 0.017, 0.017, -0.15, 0.15, 'lama', top='lama', bottom='lama', mat=LAMA)
    m.prism(6, 0.02, 0.02, -0.12, 0.02, 'corda')
    beam(m, (0, 0.15, 0), (0.02, 0.26, 0), 0.008, 0.008, 'ferro', n=3)
    with xf(m, t=(0.02, 0.26, 0), r=(0, 0, -12)):
        m.prism(6, 0.017, 0.017, 0.0, 0.3, 'lama', top='lama', bottom='lama', mat=LAMA)
    return _obj(m)


def arm_ascia():
    m = Mesh('arm_ascia')
    tube(m, [(0, -0.25, 0), (0, 0.48, 0)], [0.018, 0.02], 5, 'legno_pieno', cap0='legno_scuro', cap1='legno_scuro')
    m.prism(5, 0.024, 0.024, -0.12, 0.04, 'cuoio')
    slab(m, [(0.025, 0.32), (0.025, 0.47), (-0.04, 0.46), (-0.17, 0.57), (-0.2, 0.42), (-0.17, 0.25), (-0.04, 0.35)], -0.012, 0.012, 'lama', mat=LAMA)
    slab(m, [(0.025, 0.36), (0.11, 0.4), (0.025, 0.44)], -0.008, 0.008, 'lama', mat=LAMA)
    return _obj(m)


def arm_lancia():
    m = Mesh('arm_lancia')
    tube(m, [(0, -0.45, 0), (0, 1.35, 0)], [0.02, 0.018], 6, 'legno_pieno', cap0='ferro')
    m.prism(6, 0.024, 0.024, -0.1, 0.12, 'cuoio')
    m.prism(6, 0.026, 0.022, 1.32, 1.42, 'ferro', top='ferro')
    tube(m, [(0, 1.4, 0), (0, 1.5, 0), (0, 1.68, 0)], [(0.01, 0.006), (0.045, 0.012), 0], 4, 'lama', mat=LAMA)
    quad2(m, [(-0.01, 1.33, 0), (0.01, 1.33, 0), (0.05, 1.18, 0.01), (-0.04, 1.2, 0.01)], 'tessuto_rosso', (0, 0, -1))
    return _obj(m)


def arm_spadone():
    m = Mesh('arm_spadone')
    tube(m, [(0, -0.2, 0), (0, 0.2, 0)], [0.02, 0.02], 6, 'cuoio')
    blob(m, (0, -0.23, 0), 0.035, 0.035, 0.035, 'ferro', n=4, k=2)
    m.box(-0.16, 0.2, -0.025, 0.16, 0.24, 0.025, 'ferro', skip=())
    slab(m, [(-0.032, 0.24), (0.032, 0.24), (0.03, 1.25), (0.0, 1.42), (-0.03, 1.25)], -0.008, 0.008, 'lama', mat=LAMA)
    return _obj(m)


def arm_martello():
    m = Mesh('arm_martello')
    tube(m, [(0, -0.35, 0), (0, 0.72, 0)], [0.02, 0.022], 5, 'legno_pieno', cap0='ferro')
    m.prism(5, 0.026, 0.026, -0.12, 0.12, 'cuoio')
    with xf(m, t=(0, 0.8, 0), r=(0, 0, 90)):
        m.prism(8, 0.11, 0.11, -0.2, 0.2, 'lama', top='lama', bottom='lama', mat=LAMA, a0=math.pi / 8)
    m.box(-0.06, 0.66, -0.12, 0.06, 0.94, 0.12, 'ferro', skip=())
    return _obj(m)


def arm_arco():
    m = Mesh('arm_arco')
    pts = [(0, 0.66, 0.17), (0, 0.48, 0.07), (0, 0.24, 0.01), (0, 0, 0), (0, -0.24, 0.01), (0, -0.48, 0.07), (0, -0.66, 0.17)]
    tube(m, pts, [0.008, 0.013, 0.017, 0.02, 0.017, 0.013, 0.008], 4, 'lama', mat=LAMA)
    tube(m, [(0, 0.65, 0.17), (0, -0.65, 0.17)], [0.003, 0.003], 3, 'p_sabbia_chiara')
    m.prism(4, 0.026, 0.026, -0.07, 0.07, 'cuoio')
    return _obj(m)


def arm_freccia():
    m = Mesh('arm_freccia')
    tube(m, [(0, 0, 0), (0, 0.68, 0)], [0.006, 0.006], 3, 'legno_pieno', cap0='legno_scuro')
    tube(m, [(0, 0.67, 0), (0, 0.76, 0)], [(0.016, 0.004), 0], 4, 'lama', cap0='lama', mat=LAMA)
    for k in range(3):
        a = 2 * math.pi * k / 3
        d = (math.cos(a), 0, math.sin(a))
        quad2(m, [(d[0] * 0.006, 0.02, d[2] * 0.006), (d[0] * 0.006, 0.15, d[2] * 0.006), (d[0] * 0.035, 0.12, d[2] * 0.035), (d[0] * 0.035, 0.03, d[2] * 0.035)], 'p_rosso', (-d[2], 0, d[0]))
    return _obj(m)


def fx_fiammata():
    """Palla di fuoco a pixel: nucleo, lingue in tutte le direzioni, coda verso +Z. Centro all'origine."""
    m = Mesh('fx_fiammata')
    blob(m, (0, 0, 0), 0.17, 0.17, 0.17, 'em_fuoco', n=4, k=2, mat=EM)
    for k, d in enumerate(((0, 1, 0), (0.85, 0.3, -0.3), (-0.85, 0.3, -0.3), (0.5, -0.7, -0.4), (-0.5, -0.7, -0.4), (0, 0.2, -1), (0.6, 0.6, 0.5), (-0.6, 0.6, 0.5))):
        d = _norm(d)
        cone_dir(m, _mul(d, 0.1), _mul(d, 0.3 if k % 2 else 0.26), 0.08, 3, 'em_fuoco', mat=EM)
    tube(m, [(0, 0, 0.1), (0, 0.04, 0.62)], [0.15, 0], 4, 'em_fuoco', mat=EM)
    return _obj(m, anchors={'centro': [0, 0, 0]})


MODELS_RPG = [dng_grotta_pavimento, dng_grotta_muro, dng_grotta_muro_basso, dng_cripta_pavimento, dng_cripta_muro, dng_cripta_muro_basso,
              dng_vuoto_pavimento, dng_vuoto_muro, dng_vuoto_muro_basso, dng_colonna, dng_torcia, dng_forziere, dng_forziere_aperto,
              dng_scala, dng_libro, dng_ossa, dng_cristallo, prop_sacco,
              nem_bandito, nem_lupo, nem_ragno, nem_scheletro, nem_nonmorto, nem_re_ossa, nem_spettro, nem_golem, nem_custode,
              arm_nunchaku, arm_katana, arm_ascia, arm_lancia, arm_spadone, arm_martello, arm_arco, arm_freccia, fx_fiammata]
MODELS = {f.__name__: f for f in MODELS_MAIN + MODELS_RPG}
