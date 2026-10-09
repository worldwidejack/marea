# MAREA — animali piloti dell'Isola delle Corse, gruppo b (#178): struzzo, gorilla, fenicottero, tartaruga.
# Vedi models_corse_piloti.py per lo stile. Riferimento: assets/concept/corse/corse_06_animali_piloti.jpg.
# Statici, in piedi, casco sotto il braccio sul lato +X, davanti −Z, pivot ai piedi.
# Ritocco del 9 ott 2026 («troppo squadrati»): tutto a forme tonde e morbide (tubi, ellissoidi, torsi ellittici),
# decalcomanie che avvolgono il busto. Budget alzato a 3000 triangoli per pilota.
import math
from lib import Mesh, newell, _norm, _cross, _sub, _dot
from corse_kit import C, corpo_y, scatola_tonda


def _obj(m):
    return [m.build()]


# ---------------------------------------------------------------- attrezzi locali (forme morbide)
def _lerp3(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)


def _ell(m, c, r, col, n=10, rings=3):
    """Ellissoide morbido: centro c, raggi r=(rx, ry, rz); ai poli una punta (non una calotta piatta)."""
    reg = C(col)
    rx, ry, rz = r
    rs = []
    for k in range(rings):
        t = math.pi * (k + 1) / (rings + 1)
        rs.append([(c[0] + math.cos(2 * math.pi * i / n) * rx * math.sin(t), c[1] - ry * math.cos(t), c[2] + math.sin(2 * math.pi * i / n) * rz * math.sin(t)) for i in range(n)])

    def put(q):
        fc = tuple(sum(v[k] for v in q) / len(q) for k in range(3))
        out = ((fc[0] - c[0]) / rx ** 2, (fc[1] - c[1]) / ry ** 2, (fc[2] - c[2]) / rz ** 2)
        m.poly(q if _dot(newell(q), out) >= 0 else q[::-1], reg)
    for a, b in zip(rs, rs[1:]):
        for i in range(n):
            j = (i + 1) % n
            put([a[i], a[j], b[j], b[i]])
    for i in range(n):
        j = (i + 1) % n
        put([(c[0], c[1] - ry, c[2]), rs[0][j], rs[0][i]])
        put([(c[0], c[1] + ry, c[2]), rs[-1][i], rs[-1][j]])


def _frame(t):
    a = (1.0, 0.0, 0.0)
    if abs(_dot(t, a)) > 0.9:
        a = (0.0, 1.0, 0.0)
    d = _dot(a, t)
    a = _norm((a[0] - t[0] * d, a[1] - t[1] * d, a[2] - t[2] * d))
    return a, _cross(t, a)


def _tubo(m, path, radii, col, n=10, caps=(True, True)):
    """Tubo morbido lungo una spezzata: un anello per punto, raggio (o (rx, ry)) per punto, facce verso fuori, cappe sui capi."""
    P = [tuple(p) for p in path]
    R = [r if isinstance(r, tuple) else (r, r) for r in radii]
    T = [_norm(_sub(P[min(i + 1, len(P) - 1)], P[max(i - 1, 0)])) for i in range(len(P))]
    rings = []
    for p, t, (rx, ry) in zip(P, T, R):
        a, b = _frame(t)
        rings.append([tuple(p[k] + a[k] * math.cos(2 * math.pi * i / n) * rx + b[k] * math.sin(2 * math.pi * i / n) * ry for k in range(3)) for i in range(n)])
    reg = C(col)
    for i in range(len(P) - 1):
        mid = _lerp3(P[i], P[i + 1], 0.5)
        r0, r1 = rings[i], rings[i + 1]
        for j in range(n):
            k = (j + 1) % n
            q = [r0[j], r0[k], r1[k], r1[j]]
            fc = tuple(sum(v[c] for v in q) / 4 for c in range(3))
            m.poly(q if _dot(newell(q), _sub(fc, mid)) >= 0 else q[::-1], reg)
    if caps[0]:
        q = rings[0]
        m.poly(q if _dot(newell(q), (-T[0][0], -T[0][1], -T[0][2])) >= 0 else q[::-1], reg)
    if caps[1]:
        q = rings[-1]
        m.poly(q if _dot(newell(q), T[-1]) >= 0 else q[::-1], reg)


def _curva(m, pts, radii, col, k=3, n=8, caps=(True, True)):
    """Tubo che passa liscio (Catmull-Rom) per i punti: colli a S, becchi curvi."""
    R = [r if isinstance(r, tuple) else (r, r) for r in radii]
    P = [pts[0]] + list(pts) + [pts[-1]]
    dp, dr = [], []
    for i in range(1, len(pts)):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for j in range(k):
            t = j / k
            dp.append(tuple(0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t * t
                                   + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t ** 3) for c in range(3)))
            dr.append((R[i - 1][0] + (R[i][0] - R[i - 1][0]) * t, R[i - 1][1] + (R[i][1] - R[i - 1][1]) * t))
    dp.append(tuple(pts[-1])); dr.append(R[-1])
    _tubo(m, dp, dr, col, n=n, caps=caps)


def _pluma(m, base, tip, w, col, n=5):
    """Piuma morbida: foglia allungata (sottile alla base, larga a metà, a punta)."""
    _tubo(m, [base, _lerp3(base, tip, 0.4), _lerp3(base, tip, 0.8), tip], [(w * 0.35, w * 0.25), (w, w * 0.55), (w * 0.8, w * 0.45), (w * 0.3, w * 0.2)], col, n=n)


def _fascia(m, a, b, t0, t1, r, col, n=10):
    """Anello di colore attorno a un arto (banda/sponsor), tra t0 e t1 della sua lunghezza."""
    _tubo(m, [_lerp3(a, b, t0), _lerp3(a, b, t1)], [r, r], col, n=n)


# --- torsi ellittici e decalcomanie che avvolgono la superficie
def _pr(lista):
    """[(y, rx, rz) o (y, rx, rz, cz)] -> profilo per corpo_y [(y, rx, rz, cx, cz)]."""
    return [(e[0], e[1], e[2], 0.0, e[3] if len(e) > 3 else 0.0) for e in lista]


def _corpo(m, prof, col, n=16):
    corpo_y(m, prof, C(col), n=n)


def _pv(prof, y):
    if y <= prof[0][0]:
        return prof[0][1:]
    for a, b in zip(prof, prof[1:]):
        if y <= b[0]:
            t = (y - a[0]) / ((b[0] - a[0]) or 1)
            return tuple(a[k] + (b[k] - a[k]) * t for k in range(1, 5))
    return prof[-1][1:]


def _sp(prof, x, y, back, off):
    """Punto sulla superficie del busto (davanti −Z o dietro +Z), spinto fuori di `off` lungo la normale."""
    rx, rz, cx, cz = _pv(prof, y)
    u = max(-0.97, min(0.97, (x - cx) / rx))
    dz = math.sqrt(1 - u * u)
    nx, nz = u / rx, dz / rz
    l = math.hypot(nx, nz)
    nx, nz = nx / l, nz / l
    px = cx + u * rx + off * nx
    pz = (cz + rz * dz + off * nz) if back else (cz - rz * dz - off * nz)
    return (px, y, pz)


def _orient(m, q, col, back):
    nrm = (0, 0, 1) if back else (0, 0, -1)
    m.poly(q if _dot(newell(q), nrm) >= 0 else q[::-1], C(col))


def _dW(m, prof, x0, y0, x1, y1, col, back=False, off=0.016):
    """Decalcomania rettangolare avvolta sul busto (bande, sponsor, logo). Strati diversi → off diversi (+0.005)."""
    ys = sorted(set([y0, y1] + [p[0] for p in prof if y0 < p[0] < y1]))
    ys2 = []
    for a, b in zip(ys, ys[1:]):
        k = max(1, math.ceil((b - a) / 0.2))
        ys2 += [a + (b - a) * i / k for i in range(k)]
    ys2.append(ys[-1])
    nx = max(1, math.ceil((x1 - x0) / 0.1))
    xs = [x0 + (x1 - x0) * i / nx for i in range(nx + 1)]
    for i in range(nx):
        for j in range(len(ys2) - 1):
            q = [_sp(prof, xs[i + 1], ys2[j], back, off), _sp(prof, xs[i], ys2[j], back, off),
                 _sp(prof, xs[i], ys2[j + 1], back, off), _sp(prof, xs[i + 1], ys2[j + 1], back, off)]
            _orient(m, q, col, back)


def _dE(m, prof, xc, yc, a, b, col, back=False, off=0.016, n=12):
    """Decalcomania ellittica (stemmi, scudi) avvolta sul busto."""
    def P(f, i):
        ang = 2 * math.pi * i / n
        return _sp(prof, xc + a * f * math.cos(ang), yc + b * f * math.sin(ang), back, off)
    c0 = _sp(prof, xc, yc, back, off)
    for i in range(n):
        j = (i + 1) % n
        _orient(m, [c0, P(0.55, i), P(0.55, j)], col, back)
        _orient(m, [P(0.55, i), P(1.0, i), P(1.0, j), P(0.55, j)], col, back)


def _blocchi(m, prof, lista, off=0.021):
    """Sponsor a blocchetti colorati: [(x0, y0, x1, y1, colore), ...]."""
    for x0, y0, x1, y1, col in lista:
        _dW(m, prof, x0, y0, x1, y1, col, False, off)


# --- volto, scarpe, casco
def _occhio(m, x, y, z, w=0.08, h=0.07, pup=0.04, sclera='pietra_chiara', dx=0.0):
    """Occhio duro: bianco ovale piatto e pupilla scura (dx la sposta verso il centro)."""
    _ell(m, (x, y, z), (w / 2, h / 2, 0.022), sclera, 8, 2)
    _ell(m, (x + dx, y - 0.002, z - 0.016), (pup / 2, pup * 0.55, 0.014), 'nero_caldo', 6, 2)


def _sopr(m, x_in, x_out, y_in, y_out, z, th=0.04, col='nero_caldo'):
    """Sopracciglio: basso verso il centro (sguardo serio da F1)."""
    _tubo(m, [(x_in, y_in, z), (x_out, y_out, z)], [th / 2, th / 2], col, n=6)


def _scarpa(m, x, w, col, punta, banda, alta, lung, suola):
    """Scarpa da corsa tonda: suola, tomaia che si abbassa verso la punta, puntale, banda laterale e lacci."""
    s = 1 if x >= 0 else -1
    z0, z1 = -lung * 0.72, lung * 0.28
    h = alta - 0.05
    scatola_tonda(m, x - w / 2 - 0.012, 0.0, z0 - 0.01, x + w / 2 + 0.012, 0.06, z1 + 0.01, C(suola), r=0.03, seg=1, muso=(0.9, 1.0, 0.0))
    scatola_tonda(m, x - w / 2, 0.05, z0, x + w / 2, alta, z1, C(col), r=min(0.1, w * 0.45), seg=3, muso=(0.86, 0.55, h * 0.225))
    _ell(m, (x, 0.05 + h * 0.2, z0 + lung * 0.2), (w / 2 * 0.9, h * 0.3, lung * 0.2), punta, 8, 3)
    _ell(m, (x + s * w / 2, 0.05 + h * 0.55, z1 - lung * 0.3), (0.02, h * 0.28, lung * 0.16), banda, 8, 2)
    _ell(m, (x, alta - 0.005, z1 - lung * 0.42), (w * 0.28, 0.025, lung * 0.17), 'pietra_chiara', 6, 2)


def _casco(m, cx, cy, cz, r, colore, visiera='nero_caldo', striscia=None):
    """Casco da pilota: calotta tonda, visiera scura a ellissoide sul davanti (−Z), cresta colorata sopra."""
    _ell(m, (cx, cy, cz), (r, r * 0.95, r), colore, 12, 4)
    _ell(m, (cx, cy + 0.03 * r, cz - 0.6 * r), (0.72 * r, 0.34 * r, 0.46 * r), visiera, 10, 2)
    if striscia:
        pts = [(cx, cy + 0.95 * r * 1.04 * math.cos(math.radians(a)), cz + r * 1.04 * math.sin(math.radians(a))) for a in (-60, -22, 16, 54, 85)]
        _tubo(m, pts, [r * 0.1] * len(pts), striscia, n=5)


# ---------------------------------------------------------------- GORILLA
def cs_p_gorilla():
    """Gorilla pilota: spalle e petto enormi e tondi, tuta nera e rossa col logo HR, stivali rossi, casco rosso sotto il braccio."""
    m = Mesh('cs_p_gorilla')
    for s in (-1, 1):
        cx = s * 0.23
        _tubo(m, [(cx, 0.92, 0), (cx, 0.58, 0), (cx, 0.26, 0)], [0.2, 0.19, 0.145], 'nero_caldo', n=10)
        _ell(m, (cx, 0.58, -0.17), (0.1, 0.09, 0.05), 'rosso', 8, 2)                 # ginocchiera
        _ell(m, (cx, 0.58, -0.205), (0.045, 0.04, 0.03), 'giallo', 6, 2)
        _ell(m, (cx + s * 0.185, 0.6, 0.0), (0.03, 0.28, 0.07), 'rosso', 8, 2)      # banda esterna
        _scarpa(m, cx, 0.31, 'rosso', 'nero_caldo', 'pietra_chiara', 0.27, 0.52, 'pietra_chiara')
    # busto: petto e spalle larghissimi, bacino stretto
    T = _pr([(0.82, 0.4, 0.27), (0.98, 0.48, 0.3), (1.22, 0.6, 0.33, -0.01), (1.45, 0.7, 0.35, -0.02), (1.6, 0.54, 0.29), (1.7, 0.3, 0.2, 0.02)])
    _corpo(m, T, 'nero_caldo')
    _dW(m, T, -0.34, 1.02, 0.34, 1.44, 'rosso')
    _dW(m, T, -0.34, 1.02, 0.34, 1.06, 'nero_caldo', off=0.021)
    for sx in (-1, 1):
        _dW(m, T, sx * 0.43 - 0.045, 0.9, sx * 0.43 + 0.045, 1.42, 'rosso')
        _dW(m, T, sx * 0.43 - 0.012, 0.9, sx * 0.43 + 0.012, 1.42, 'pietra_chiara', off=0.021)
    _dW(m, T, -0.4, 0.82, 0.4, 0.9, 'pietra_scura', off=0.019)
    _dW(m, T, -0.08, 0.82, 0.08, 0.9, 'giallo', off=0.024)
    logo = [(-0.24, 1.12, -0.2, 1.36), (-0.1, 1.12, -0.06, 1.36), (-0.2, 1.22, -0.1, 1.27),
            (0.0, 1.12, 0.04, 1.36), (0.04, 1.31, 0.14, 1.36), (0.04, 1.22, 0.14, 1.27), (0.12, 1.27, 0.16, 1.33), (0.07, 1.12, 0.11, 1.22), (0.11, 1.12, 0.16, 1.2)]
    _blocchi(m, T, [(-c, b, -a, d, 'pietra_chiara') for a, b, c, d in logo], off=0.022)
    _blocchi(m, T, [(-0.56, 1.24, -0.46, 1.34, 'giallo'), (-0.56, 1.1, -0.5, 1.2, 'pietra_chiara'), (-0.5, 1.1, -0.44, 1.2, 'arancio'),
                    (0.46, 1.26, 0.56, 1.34, 'pietra_chiara'), (0.46, 1.12, 0.52, 1.22, 'giallo'), (0.52, 1.12, 0.58, 1.22, 'arancio'),
                    (-0.3, 0.94, -0.2, 1.0, 'giallo'), (0.2, 0.94, 0.3, 1.0, 'pietra_chiara')])
    _dW(m, T, -0.4, 1.0, 0.4, 1.44, 'rosso', back=True)
    _dW(m, T, -0.3, 1.1, 0.3, 1.34, 'nero_caldo', back=True, off=0.021)
    _dW(m, T, -0.2, 1.17, 0.2, 1.27, 'pietra_chiara', back=True, off=0.026)
    _dW(m, T, -0.4, 0.82, 0.4, 0.9, 'pietra_scura', back=True, off=0.019)
    # spalle a palla con spallina rossa
    for s in (-1, 1):
        _ell(m, (s * 0.8, 1.45, 0.0), (0.28, 0.25, 0.26), 'nero_caldo', 12, 5)
        _ell(m, (s * 0.8, 1.47, -0.255), (0.07, 0.06, 0.02), 'pietra_chiara', 6, 2)
    # braccio sinistro (−X): mano sul fianco
    sh, el, wr = (-0.8, 1.44, 0.0), (-1.0, 1.04, 0.04), (-0.52, 0.9, -0.3)
    _tubo(m, [sh, el], [0.25, 0.2], 'nero_caldo', n=10)
    _ell(m, el, (0.2, 0.2, 0.2), 'nero_caldo', 10, 3)
    _tubo(m, [el, wr], [0.19, 0.155], 'nero_caldo', n=10)
    _fascia(m, sh, el, 0.3, 0.48, 0.245, 'rosso')
    _fascia(m, el, wr, 0.6, 0.74, 0.175, 'pietra_chiara')
    _ell(m, wr, (0.17, 0.16, 0.16), 'nero_caldo', 10, 3)
    # braccio destro (+X) col casco
    sh, el, wr = (0.8, 1.44, 0.0), (1.0, 1.04, 0.02), (0.66, 0.88, -0.46)
    _tubo(m, [sh, el], [0.25, 0.2], 'nero_caldo', n=10)
    _ell(m, el, (0.2, 0.2, 0.2), 'nero_caldo', 10, 3)
    _tubo(m, [el, wr], [0.19, 0.155], 'nero_caldo', n=10)
    _fascia(m, sh, el, 0.3, 0.48, 0.245, 'rosso')
    _fascia(m, el, wr, 0.55, 0.68, 0.175, 'pietra_chiara')
    _casco(m, 0.55, 1.02, -0.42, 0.21, 'rosso', visiera='nero_caldo', striscia='pietra_chiara')
    _ell(m, wr, (0.17, 0.16, 0.16), 'nero_caldo', 10, 3)
    # testa: cranio con cresta, maschera e muso grigi, arcata sopraccigliare pesante, occhi grandi
    _ell(m, (0, 1.75, -0.04), (0.31, 0.28, 0.29), 'nero_caldo', 12, 4)
    _ell(m, (0, 1.94, 0.02), (0.1, 0.1, 0.2), 'nero_caldo', 10, 4)                              # cresta
    _ell(m, (0, 1.69, -0.25), (0.24, 0.22, 0.14), 'roccia', 12, 4)                              # maschera grigia
    _ell(m, (0, 1.6, -0.35), (0.18, 0.14, 0.12), 'pietra_scura', 12, 4)                         # muso
    _ell(m, (0, 1.535, -0.455), (0.11, 0.016, 0.02), 'nero_caldo', 8, 2)                        # bocca
    for s in (-1, 1):
        _ell(m, (s * 0.055, 1.635, -0.45), (0.028, 0.018, 0.018), 'nero_caldo', 6, 2)           # narici
        _ell(m, (s * 0.31, 1.72, -0.02), (0.05, 0.08, 0.06), 'roccia', 6, 2)                    # orecchie
        _ell(m, (s * 0.23, 1.55, -0.2), (0.1, 0.1, 0.1), 'nero_caldo', 8, 2)                    # guance
    _ell(m, (0, 1.835, -0.285), (0.26, 0.055, 0.075), 'nero_caldo', 12, 3)                          # arcata sopraccigliare
    for s in (-1, 1):
        _occhio(m, s * 0.105, 1.765, -0.368, w=0.12, h=0.08, pup=0.05, sclera='legno')
        _sopr(m, s * 0.02, s * 0.24, 1.825, 1.87, -0.39, th=0.055)
    return _obj(m)


# ---------------------------------------------------------------- STRUZZO
def cs_p_struzzo():
    """Struzzo pilota: collo lunghissimo e curvo, tuta bianca e rosa, ali nere di piume morbide, becco arancio, scarpe rosa."""
    m = Mesh('cs_p_struzzo')
    for s in (-1, 1):
        cx = s * 0.12
        _tubo(m, [(cx, 1.04, 0), (cx, 0.82, 0)], [0.12, 0.09], 'pietra_chiara', n=10)             # pantaloncino
        _fascia(m, (cx, 0.84, 0), (cx, 0.8, 0), 0.0, 1.0, 0.093, 'rosa_neon')
        _ell(m, (cx + s * 0.1, 0.94, 0.0), (0.02, 0.1, 0.045), 'rosa_neon', 8, 2)
        _tubo(m, [(cx, 0.8, 0), (cx, 0.5, 0.012), (cx, 0.24, 0)], [0.05, 0.044, 0.04], 'sabbia', n=8)   # zampa nuda
        _ell(m, (cx, 0.5, 0.0), (0.06, 0.06, 0.065), 'sabbia_chiara', 8, 2)
        _ell(m, (cx, 0.64, -0.04), (0.03, 0.03, 0.012), 'pietra_scura', 6, 2)                   # scaglia
        _scarpa(m, cx, 0.15, 'pietra_chiara', 'rosa_neon', 'rosa_neon', 0.22, 0.46, 'nero_caldo')
    # busto a uovo che si stringe nel collo
    T = _pr([(0.97, 0.2, 0.15), (1.12, 0.29, 0.2), (1.3, 0.3, 0.2), (1.45, 0.2, 0.15), (1.57, 0.09, 0.08)])
    _corpo(m, T, 'pietra_chiara')
    _ell(m, (0, 1.5, 0.0), (0.125, 0.04, 0.125), 'rosa_neon', 10, 2)                           # colletto
    for sx in (-1, 1):
        _dW(m, T, sx * 0.2 - 0.025, 0.99, sx * 0.2 + 0.025, 1.38, 'rosa_neon')
    _dW(m, T, -0.26, 0.97, 0.26, 1.02, 'nero_caldo', off=0.02)
    _dW(m, T, -0.05, 0.97, 0.05, 1.02, 'giallo', off=0.025)
    for s in (-1, 1):                                                                           # stemma ali rosa
        _dE(m, T, s * 0.075, 1.24, 0.05, 0.1, 'rosa_neon')
        _dE(m, T, s * 0.12, 1.28, 0.03, 0.06, 'rosa_neon', off=0.021)
    _blocchi(m, T, [(-0.27, 1.28, -0.2, 1.36, 'giallo'), (0.2, 1.28, 0.27, 1.36, 'nero_caldo'), (-0.12, 1.06, -0.04, 1.11, 'rosa_neon'),
                    (0.06, 1.06, 0.16, 1.11, 'arancio'), (-0.25, 1.1, -0.18, 1.17, 'nero_caldo'), (0.18, 1.1, 0.25, 1.17, 'giallo')])
    _dW(m, T, -0.2, 1.1, 0.2, 1.2, 'rosa_neon', back=True)
    _dW(m, T, -0.12, 1.22, -0.04, 1.3, 'nero_caldo', back=True, off=0.021)
    _dW(m, T, 0.04, 1.22, 0.12, 1.3, 'giallo', back=True, off=0.021)
    # collo lungo e curvo (cilindro che si assottiglia)
    _curva(m, [(0, 1.5, 0.0), (0, 1.74, 0.03), (0, 1.97, -0.01), (0, 2.17, -0.08), (0, 2.3, -0.16)], [0.095, 0.075, 0.065, 0.062, 0.066], 'sabbia_chiara', k=3, n=8)
    # testa tonda e becco arancio
    _ell(m, (0, 2.36, -0.2), (0.125, 0.115, 0.135), 'sabbia_chiara', 12, 4)
    _tubo(m, [(0, 2.34, -0.28), (0, 2.325, -0.4), (0, 2.3, -0.52)], [(0.075, 0.05), (0.062, 0.036), (0.03, 0.02)], 'arancio', n=8)
    _tubo(m, [(0, 2.3, -0.3), (0, 2.29, -0.4), (0, 2.275, -0.5)], [(0.06, 0.02), (0.05, 0.016), (0.025, 0.012)], 'legno_chiaro', n=6)
    _ell(m, (0, 2.355, -0.52), (0.025, 0.014, 0.012), 'legno', 6, 2)
    _pluma(m, (0, 2.45, -0.2), (0, 2.58, -0.14), 0.035, 'pietra_scura')
    _pluma(m, (0.03, 2.45, -0.18), (0.1, 2.55, -0.1), 0.03, 'pietra')
    _pluma(m, (-0.03, 2.45, -0.18), (-0.1, 2.55, -0.1), 0.03, 'pietra')
    for s in (-1, 1):
        _occhio(m, s * 0.075, 2.385, -0.31, w=0.1, h=0.095, pup=0.058, dx=-s * 0.006)
        _sopr(m, s * 0.01, s * 0.13, 2.44, 2.485, -0.295, th=0.035)
    # ali nere: sinistra giù lungo il fianco, destra piegata col casco
    sh, el = (-0.33, 1.4, 0.02), (-0.45, 1.1, 0.06)
    _ell(m, (sh[0], 1.36, 0.02), (0.1, 0.1, 0.1), 'pietra_chiara', 8, 3)                      # manica
    _ell(m, (sh[0], 1.3, 0.02), (0.105, 0.025, 0.105), 'rosa_neon', 8, 2)
    _tubo(m, [(-0.35, 1.36, 0.03), el], [0.1, 0.125], 'nero_caldo', n=8)
    _ell(m, (-0.46, 0.98, 0.08), (0.12, 0.26, 0.13), 'nero_caldo', 10, 3)
    for k, z in enumerate((-0.04, 0.03, 0.1, 0.17)):
        _pluma(m, (-0.46 + 0.01 * (k % 2), 0.9, z), (-0.45, 0.52 + 0.07 * (k % 2), z + 0.02), 0.055, 'nero_caldo')
    sh, el, wr = (0.33, 1.4, 0.02), (0.46, 1.12, 0.05), (0.34, 1.02, -0.3)
    _ell(m, (sh[0], 1.36, 0.02), (0.1, 0.1, 0.1), 'pietra_chiara', 8, 3)
    _ell(m, (sh[0], 1.3, 0.02), (0.105, 0.025, 0.105), 'rosa_neon', 8, 2)
    _tubo(m, [(0.34, 1.36, 0.03), el], [0.1, 0.125], 'nero_caldo', n=8)
    _ell(m, el, (0.125, 0.125, 0.125), 'nero_caldo', 10, 3)
    _tubo(m, [el, wr], [0.115, 0.085], 'nero_caldo', n=8)
    _ell(m, wr, (0.1, 0.1, 0.1), 'nero_caldo', 10, 3)
    for k, z in enumerate((0.0, 0.07, 0.14, 0.21)):
        _pluma(m, (0.5, 1.04, z), (0.52, 0.7 + 0.06 * (k % 2), z + 0.03), 0.055, 'nero_caldo')
    _casco(m, 0.4, 1.1, -0.34, 0.18, 'pietra_chiara', visiera='nero_caldo', striscia='rosa_neon')
    # coda: batuffolo nero con piume che salgono all'indietro
    _ell(m, (0.0, 1.0, 0.26), (0.26, 0.2, 0.16), 'nero_caldo', 10, 3)
    for x in (-0.2, -0.07, 0.07, 0.2):
        _pluma(m, (x, 1.06, 0.3), (x * 1.5, 1.34 - abs(x) * 0.5, 0.6), 0.08, 'nero_caldo')
    return _obj(m)


# ---------------------------------------------------------------- FENICOTTERO
def cs_p_fenicottero():
    """Fenicottero pilota: collo a S di segmenti raccordati, gambe sottili rosa, tuta bianca e rosa, becco curvo bicolore."""
    m = Mesh('cs_p_fenicottero')
    for s in (-1, 1):
        cx = s * 0.11
        _tubo(m, [(cx, 1.04, 0), (cx, 0.84, 0)], [0.1, 0.075], 'pietra_chiara', n=10)
        _ell(m, (cx + s * 0.085, 0.95, 0.0), (0.016, 0.09, 0.04), 'rosa_neon', 8, 2)
        kz = 0.06 if s > 0 else 0.02
        _tubo(m, [(cx, 0.84, 0), (cx, 0.56, kz), (cx, 0.24, 0)], [0.055, 0.047, 0.04], 'rosa_neon', n=8)
        _ell(m, (cx, 0.56, kz), (0.058, 0.058, 0.062), 'rosa_neon', 8, 2)
        _scarpa(m, cx, 0.13, 'pietra_chiara', 'rosa_neon', 'rosa_neon', 0.22, 0.42, 'nero_caldo')
    T = _pr([(1.0, 0.18, 0.13), (1.2, 0.23, 0.16), (1.38, 0.21, 0.15), (1.5, 0.09, 0.08)])
    _corpo(m, T, 'pietra_chiara')
    _ell(m, (0, 1.46, 0.0), (0.11, 0.035, 0.11), 'rosa_neon', 10, 2)
    for sx in (-1, 1):
        _dW(m, T, sx * 0.14 - 0.025, 1.02, sx * 0.14 + 0.025, 1.4, 'rosa_neon')
    _dW(m, T, -0.19, 1.0, 0.19, 1.05, 'rosa_neon', off=0.02)
    _dW(m, T, -0.045, 1.0, 0.045, 1.05, 'giallo', off=0.025)
    _dE(m, T, 0.0, 1.22, 0.06, 0.1, 'rosa_neon')                       # stemma fenicottero
    _dE(m, T, 0.0, 1.22, 0.025, 0.06, 'pietra_chiara', off=0.021)
    _blocchi(m, T, [(-0.2, 1.26, -0.14, 1.32, 'giallo'), (0.14, 1.26, 0.2, 1.32, 'nero_caldo'), (-0.2, 1.1, -0.15, 1.16, 'nero_caldo'), (0.15, 1.1, 0.2, 1.16, 'arancio')])
    _dW(m, T, -0.18, 1.08, 0.18, 1.16, 'rosa_neon', back=True)
    _dW(m, T, -0.1, 1.2, -0.03, 1.3, 'nero_caldo', back=True, off=0.021)
    _dW(m, T, 0.03, 1.2, 0.1, 1.3, 'giallo', back=True, off=0.021)
    # collo a S: in avanti, poi indietro, poi la testa si protende
    _curva(m, [(0, 1.46, 0.02), (0, 1.6, -0.1), (0, 1.77, -0.12), (0, 1.93, -0.03), (0, 2.03, -0.08)], [0.1, 0.075, 0.068, 0.064, 0.068], 'rosa_neon', k=3, n=10)
    hx, hy, hz = 0.0, 2.1, -0.13
    _ell(m, (hx, hy, hz), (0.11, 0.1, 0.115), 'rosa_neon', 12, 4)
    # becco: base chiara e punta nera piegata in giù
    _tubo(m, [(hx, hy - 0.02, hz - 0.08), (hx, hy - 0.03, hz - 0.2)], [(0.066, 0.05), (0.06, 0.046)], 'pietra_chiara', n=8)
    _curva(m, [(hx, hy - 0.03, hz - 0.19), (hx, hy - 0.05, hz - 0.3), (hx, hy - 0.11, hz - 0.35), (hx, hy - 0.2, hz - 0.35)],
           [(0.058, 0.044), (0.052, 0.04), (0.042, 0.034), (0.015, 0.015)], 'nero_caldo', k=2, n=8)
    for s in (-1, 1):
        _occhio(m, hx + s * 0.065, hy + 0.035, hz - 0.1, w=0.075, h=0.07, pup=0.045, dx=-s * 0.006)
        _sopr(m, hx + s * 0.005, hx + s * 0.115, hy + 0.09, hy + 0.13, hz - 0.1, th=0.032)
    _pluma(m, (hx, hy + 0.1, hz + 0.02), (hx, hy + 0.2, hz + 0.08), 0.035, 'rosa_neon')
    # braccio sinistro (−X): mano sul fianco
    sh, el, wr = (-0.25, 1.38, 0.0), (-0.45, 1.12, 0.04), (-0.2, 1.02, -0.14)
    _ell(m, (sh[0], 1.37, 0.0), (0.075, 0.075, 0.075), 'pietra_chiara', 8, 3)
    _tubo(m, [sh, el], [0.06, 0.055], 'rosa_neon', n=8)
    _ell(m, el, (0.058, 0.058, 0.058), 'rosa_neon', 8, 2)
    _tubo(m, [el, wr], [0.052, 0.045], 'rosa_neon', n=8)
    _fascia(m, el, wr, 0.55, 0.72, 0.062, 'pietra_chiara', n=8)
    _ell(m, wr, (0.06, 0.055, 0.06), 'rosa_neon', 8, 2)
    # braccio destro (+X) col casco
    sh, el, wr = (0.25, 1.38, 0.0), (0.37, 1.12, 0.02), (0.3, 1.04, -0.3)
    _ell(m, (sh[0], 1.37, 0.0), (0.075, 0.075, 0.075), 'pietra_chiara', 8, 3)
    _tubo(m, [sh, el], [0.06, 0.055], 'rosa_neon', n=8)
    _ell(m, el, (0.058, 0.058, 0.058), 'rosa_neon', 8, 2)
    _tubo(m, [el, wr], [0.052, 0.045], 'rosa_neon', n=8)
    _fascia(m, el, wr, 0.55, 0.72, 0.062, 'pietra_chiara', n=8)
    _casco(m, 0.34, 1.14, -0.33, 0.17, 'pietra_chiara', visiera='nero_caldo', striscia='rosa_neon')
    _ell(m, wr, (0.06, 0.055, 0.06), 'rosa_neon', 8, 2)
    # piume di coda rosa
    for x in (-0.09, 0.0, 0.09):
        _pluma(m, (x, 1.06, 0.12), (x * 2.2, 1.28 - abs(x), 0.42), 0.06, 'rosa_neon')
    return _obj(m)


# ---------------------------------------------------------------- TARTARUGA
def cs_p_tartaruga():
    """Tartaruga pilota: guscio a cupola sulla schiena, tuta verde con bande gialle e stemma-tartaruga, testa tonda dal muso corto, casco giallo."""
    m = Mesh('cs_p_tartaruga')
    skin = 'erba_scura'
    # guscio a cupola dietro la schiena, con bordo chiaro e scudi
    SH = _pr([(0.5, 0.5, 0.2, 0.42), (0.7, 0.7, 0.36, 0.42), (0.98, 0.7, 0.42, 0.42), (1.2, 0.6, 0.4, 0.42), (1.36, 0.42, 0.3, 0.42), (1.46, 0.22, 0.17, 0.42), (1.52, 0.08, 0.06, 0.42)])
    _corpo(m, SH, 'legno_scuro')
    _ell(m, (0, 0.64, 0.42), (0.72, 0.09, 0.44), 'legno_chiaro', 16, 2)                        # bordo
    for xc, yc, a, b in ((0.0, 1.02, 0.22, 0.24), (-0.44, 0.9, 0.17, 0.21), (0.44, 0.9, 0.17, 0.21), (-0.34, 1.26, 0.15, 0.16), (0.34, 1.26, 0.15, 0.16), (0.0, 0.76, 0.2, 0.1)):
        _dE(m, SH, xc, yc, a, b, 'legno', back=True, n=6)                                      # scudi esagonali
        _dE(m, SH, xc, yc, a * 0.58, b * 0.58, 'legno_chiaro', back=True, off=0.021, n=6)
    # gambe tozze e stivali
    for s in (-1, 1):
        cx = s * 0.23
        _tubo(m, [(cx, 0.68, 0), (cx, 0.42, 0), (cx, 0.26, 0)], [0.2, 0.19, 0.16], 'bosco', n=10)
        _ell(m, (cx + s * 0.185, 0.46, 0.0), (0.03, 0.2, 0.06), 'giallo', 8, 2)
        _scarpa(m, cx, 0.3, 'bosco', 'nero_caldo', 'giallo', 0.27, 0.5, 'pietra_chiara')
    T = _pr([(0.6, 0.38, 0.27), (0.85, 0.52, 0.34), (1.12, 0.56, 0.34), (1.3, 0.44, 0.28), (1.4, 0.28, 0.2)])
    _corpo(m, T, 'bosco')
    # stemma: disco crema con la tartaruga verde
    _dE(m, T, 0.0, 0.98, 0.27, 0.26, 'sabbia_chiara')
    _dE(m, T, 0.0, 0.96, 0.17, 0.18, 'bosco', off=0.021, n=6)
    _dE(m, T, 0.0, 0.96, 0.09, 0.1, 'erba_scura', off=0.026, n=6)
    _dE(m, T, 0.0, 1.17, 0.065, 0.06, 'bosco', off=0.021)
    for sx in (-1, 1):
        _dE(m, T, sx * 0.19, 0.8, 0.06, 0.055, 'bosco', off=0.021)
        _dE(m, T, sx * 0.19, 1.1, 0.06, 0.055, 'bosco', off=0.021)
    for sx in (-1, 1):
        _dW(m, T, sx * 0.44 - 0.04, 0.64, sx * 0.44 + 0.04, 1.2, 'giallo')
    _dW(m, T, -0.4, 0.6, 0.4, 0.69, 'nero_caldo', off=0.02)
    _dW(m, T, -0.07, 0.6, 0.07, 0.69, 'giallo', off=0.025)
    _blocchi(m, T, [(-0.52, 1.0, -0.42, 1.1, 'giallo'), (-0.52, 0.85, -0.46, 0.95, 'pietra_chiara'), (-0.45, 0.85, -0.4, 0.95, 'rosso'),
                    (0.42, 1.0, 0.52, 1.1, 'pietra_chiara'), (0.42, 0.85, 0.48, 0.95, 'arancio'), (0.49, 0.85, 0.54, 0.95, 'giallo'),
                    (-0.32, 1.2, -0.14, 1.26, 'giallo'), (0.1, 1.2, 0.28, 1.26, 'pietra_chiara')])
    # spalle tonde
    for s in (-1, 1):
        _ell(m, (s * 0.62, 1.15, 0.0), (0.2, 0.18, 0.2), 'bosco', 10, 4)
    # braccio sinistro (−X) lungo il fianco, pugno chiuso
    sh, el, wr = (-0.64, 1.1, 0.0), (-0.74, 0.84, -0.04), (-0.68, 0.6, -0.2)
    _tubo(m, [sh, el], [0.18, 0.165], 'bosco', n=10)
    _ell(m, el, (0.165, 0.165, 0.165), 'bosco', 10, 3)
    _tubo(m, [el, wr], [0.16, 0.14], 'bosco', n=10)
    _fascia(m, sh, el, 0.35, 0.52, 0.195, 'giallo')
    _ell(m, wr, (0.14, 0.14, 0.14), skin, 10, 3)
    # braccio destro (+X) col casco
    sh, el, wr = (0.64, 1.1, 0.0), (0.76, 0.84, 0.0), (0.58, 0.72, -0.42)
    _tubo(m, [sh, el], [0.18, 0.165], 'bosco', n=10)
    _ell(m, el, (0.165, 0.165, 0.165), 'bosco', 10, 3)
    _tubo(m, [el, wr], [0.16, 0.14], 'bosco', n=10)
    _fascia(m, sh, el, 0.35, 0.52, 0.195, 'giallo')
    _casco(m, 0.52, 0.9, -0.4, 0.2, 'giallo', visiera='nero_caldo', striscia='bosco')
    _ell(m, wr, (0.14, 0.14, 0.14), skin, 10, 3)
    # collo e testa tonda: muso corto e arrotondato, mascella, occhio serio con palpebra pesante
    hy, hz = 1.57, -0.16
    _tubo(m, [(0, 1.28, -0.02), (0, 1.46, -0.1)], [0.19, 0.16], skin, n=10)
    _ell(m, (0, hy, hz), (0.23, 0.21, 0.22), skin, 12, 4)
    _ell(m, (0, hy - 0.05, hz - 0.15), (0.13, 0.09, 0.11), skin, 10, 3)
    _ell(m, (0, hy - 0.1, hz - 0.12), (0.11, 0.045, 0.09), 'erba', 10, 2)
    _ell(m, (0, hy - 0.08, hz - 0.256), (0.09, 0.012, 0.015), 'nero_caldo', 8, 2)
    for s in (-1, 1):
        _ell(m, (s * 0.092, hy - 0.1, hz - 0.23), (0.012, 0.03, 0.014), 'nero_caldo', 6, 2)    # angoli giù
        _ell(m, (s * 0.035, hy - 0.03, hz - 0.257), (0.017, 0.012, 0.012), 'nero_caldo', 6, 2) # narici
        _occhio(m, s * 0.11, hy + 0.04, hz - 0.192, w=0.085, h=0.065, pup=0.042, sclera='giallo', dx=-s * 0.006)
        _ell(m, (s * 0.11, hy + 0.068, hz - 0.194), (0.058, 0.024, 0.032), skin, 8, 2)         # palpebra
        _sopr(m, s * 0.02, s * 0.14, hy + 0.105, hy + 0.125, hz - 0.17, th=0.04, col='bosco')
    return _obj(m)


MODELS = {'cs_p_struzzo': cs_p_struzzo, 'cs_p_gorilla': cs_p_gorilla, 'cs_p_fenicottero': cs_p_fenicottero, 'cs_p_tartaruga': cs_p_tartaruga}
