# MAREA — viso, capelli a punte e scollo del protagonista (models_chr_eroe.py).
# Il viso non è una texture: occhi, sopracciglia, bocca e cicatrice sono scatoline sottili appoggiate sulle faccette del cranio (un raggio
# da davanti trova la faccia giusta), colori veri in mat_avatar e sopracciglia in mat_capelli (prendono il colore dei capelli).
# A pixel grossi (avatar alto 56-112 px) un occhio è 3-5 pixel: forme grandi e contrasto, niente dettagli fini.
import math
from mathutils import Matrix, Vector

OCCHI = {'bianco': '#F4F0E6', 'iride': '#8E5A2B', 'pupilla': '#23201F', 'luce': '#FFFFFF', 'ciglia': '#23201F'}
BOCCA, CICATRICE = '#5A3A28', '#B5532E'


def _base(d):
    d = Vector(d).normalized()
    ref = Vector((0, 1, 0)) if abs(d.y) < 0.9 else Vector((0, 0, -1))
    a = d.cross(ref).normalized()
    return d, a, a.cross(d).normalized()


def punta(fig, base, d, lung, r, col, b, lati=4, piega=(0.0, 0.0, 0.0), r_mezzo=0.6):
    """Ciocca a punta: anello di base (r), anello a metà (r·r_mezzo, spostato di `piega`), punta. Chiusa, a faccette."""
    d, a, c = _base(d)
    B = Vector(base)
    M = B + d * (lung * 0.5) + Vector(piega)
    T = B + d * lung + Vector(piega) * 1.6
    ring = lambda o, rr: [tuple(o + (a * math.cos(2 * math.pi * k / lati + math.pi / 4) + c * math.sin(2 * math.pi * k / lati + math.pi / 4)) * rr)
                          for k in range(lati)]
    pts = ring(B, r) + ring(M, r * r_mezzo) + [tuple(T)]
    n = lati
    faces = [tuple(reversed(range(n)))]
    faces += [(k, (k + 1) % n, n + (k + 1) % n, n + k) for k in range(n)]
    faces += [(n + k, n + (k + 1) % n, 2 * n) for k in range(n)]
    i0 = fig._verts(pts, b)
    fig._faces(faces, i0, col, pts)


def _colpo(fig, facce, o, d):
    """Primo punto delle facce `facce` di fig lungo il raggio o + t·d, con la normale della faccia (verso fuori)."""
    best = None
    for fi in facce:
        idx, _c = fig.F[fi]
        P = [Vector(fig.V[i]) for i in idx]
        for k in range(1, len(P) - 1):
            a, b, c = P[0], P[k], P[k + 1]
            e1, e2 = b - a, c - a
            h = d.cross(e2); det = e1.dot(h)
            if abs(det) < 1e-12:
                continue
            s = o - a; u = s.dot(h) / det
            q = s.cross(e1); v = d.dot(q) / det
            if u < 0 or v < 0 or u + v > 1:
                continue
            t = e2.dot(q) / det
            if t > 0 and (best is None or t < best[0]):
                nn = e1.cross(e2).normalized()
                best = (t, o + d * t, nn if nn.dot(d) < 0 else -nn)
    return best


def adesivo(fig, testa, facce, x, y, w, h, col, rot=0.0, su=0.0, spess=0.003):
    """Scatolina w×h appoggiata sulla faccetta del cranio davanti al punto (x, y), ruotata di `rot` gradi nel suo piano, alzata di `su`."""
    hit = _colpo(testa, facce, Vector((x, y, -1.0)), Vector((0, 0, 1)))
    if not hit:
        return
    _t, p, n = hit
    dx = n.cross(Vector((0, 1, 0))).normalized()
    dy = dx.cross(n).normalized()
    r = math.radians(rot)
    ax, ay = dx * math.cos(r) + dy * math.sin(r), -dx * math.sin(r) + dy * math.cos(r)
    m = Matrix((ax, ay, n)).transposed()
    c = p + n * (su + spess / 2 - 0.001)
    fig.box(tuple(c), (w, h, spess), col, 'Head', r=tuple(math.degrees(v) for v in m.to_euler('XYZ')))


def viso(figs, facce, testa_c, cranio):
    pelle, av, cap = figs['pelle'], figs['avatar'], figs['capelli']
    ty, k0 = testa_c[1], cranio[1] / 0.17  # misure pensate per un cranio alto 0,17: crescono con la testa
    q = lambda v: v * k0
    for k in (-1, 1):  # k = +1 occhio destro (x > 0)
        ex, ey = k * q(0.064), ty - q(0.009)
        adesivo(av, pelle, facce, ex, ey, q(0.05), q(0.04), OCCHI['bianco'])
        adesivo(av, pelle, facce, ex - k * q(0.004), ey - q(0.001), q(0.027), q(0.04), OCCHI['iride'], su=0.0015)
        adesivo(av, pelle, facce, ex - k * q(0.004), ey - q(0.004), q(0.014), q(0.022), OCCHI['pupilla'], su=0.003)
        adesivo(av, pelle, facce, ex + k * q(0.002), ey + q(0.008), q(0.009), q(0.009), OCCHI['luce'], su=0.0045)
        adesivo(av, pelle, facce, ex + k * q(0.002), ey + q(0.021), q(0.058), q(0.012), OCCHI['ciglia'], rot=k * 10, su=0.0045)
        # sopracciglia spesse, più basse verso il naso: lo sguardo deciso del concept
        adesivo(cap, pelle, facce, ex + k * q(0.003), ey + q(0.048), q(0.062), q(0.018), '#6E6E6E', rot=k * 16, su=0.002)
    # mezzo sorriso storto (sale dal lato destro)
    adesivo(av, pelle, facce, q(0.004), ty - q(0.114), q(0.044), q(0.007), BOCCA, rot=7)
    adesivo(av, pelle, facce, q(0.028), ty - q(0.109), q(0.013), q(0.007), BOCCA, rot=32)
    # cicatrice sulla fronte, sopra il sopracciglio sinistro (x < 0): un taglio lungo e una tacca che lo incrocia
    adesivo(av, pelle, facce, -q(0.052), ty + q(0.072), q(0.058), q(0.011), CICATRICE, rot=58)
    adesivo(av, pelle, facce, -q(0.05), ty + q(0.074), q(0.026), q(0.009), CICATRICE, rot=-32, su=0.001)


# ciocche: (azimut°, elevazione°, lunghezza, raggio, direzione del flusso, piega, alta) — alta = va nel nodo `ciuffi` (sparisce sotto i cappelli)
CIOCCHE = [
    # frangia: ciocche larghe che sporgono sulla fronte, la grande verso destra; a sinistra resta scoperta la cicatrice
    (4, 34, 0.17, 0.06, (0.45, -0.75, -0.8), (0.02, -0.01, -0.01), False),
    (26, 30, 0.15, 0.056, (0.35, -0.8, -0.7), (0.015, -0.01, -0.01), False),
    (-16, 40, 0.09, 0.05, (-0.2, -0.5, -0.9), (0.0, 0.0, -0.01), False),
    (-40, 28, 0.14, 0.054, (-0.5, -0.9, -0.5), (-0.012, -0.01, -0.01), False),
    (48, 22, 0.13, 0.054, (0.6, -0.9, -0.3), (0.01, 0.0, 0.0), False),
    # lati: sopra le orecchie, verso il basso e in fuori
    (75, 18, 0.14, 0.058, (0.7, -1.0, 0.1), (0.012, 0.0, 0.0), False),
    (-72, 18, 0.14, 0.058, (-0.7, -1.0, 0.1), (-0.012, 0.0, 0.0), False),
    (105, 4, 0.12, 0.054, (0.5, -1.0, 0.4), (0.0, 0.0, 0.01), False),
    (-105, 4, 0.12, 0.054, (-0.5, -1.0, 0.4), (0.0, 0.0, 0.01), False),
    # nuca
    (180, 0, 0.13, 0.066, (0.0, -1.0, 0.45), (0.0, 0.0, 0.01), False),
    (160, -12, 0.1, 0.058, (0.2, -1.0, 0.4), (0.0, 0.0, 0.01), False),
    (-160, -12, 0.1, 0.058, (-0.2, -1.0, 0.4), (0.0, 0.0, 0.01), False),
    (145, 8, 0.13, 0.06, (0.45, -1.0, 0.6), (0.0, 0.0, 0.01), False),
    (-145, 8, 0.13, 0.06, (-0.45, -1.0, 0.6), (0.0, 0.0, 0.01), False),
    # corona: punte grosse in su e indietro (sotto un cappello spariscono)
    (0, 66, 0.15, 0.066, (0.15, 1.0, -0.45), (0.0, 0.01, 0.02), True),
    (32, 56, 0.17, 0.066, (0.7, 0.8, -0.1), (0.01, 0.01, 0.0), True),
    (-30, 56, 0.16, 0.066, (-0.7, 0.8, -0.1), (-0.01, 0.01, 0.0), True),
    (72, 40, 0.16, 0.064, (1.0, 0.4, 0.15), (0.0, 0.012, 0.01), True),
    (-72, 40, 0.16, 0.064, (-1.0, 0.4, 0.15), (0.0, 0.012, 0.01), True),
    (115, 46, 0.17, 0.066, (0.7, 0.45, 0.9), (0.0, 0.01, 0.01), True),
    (-115, 46, 0.17, 0.066, (-0.7, 0.45, 0.9), (0.0, 0.01, 0.01), True),
    (160, 52, 0.17, 0.068, (0.2, 0.35, 1.0), (0.0, -0.01, 0.0), True),
    (-160, 52, 0.17, 0.068, (-0.2, 0.35, 1.0), (0.0, -0.01, 0.0), True),
    (180, 26, 0.15, 0.066, (0.0, -0.2, 1.0), (0.0, -0.01, 0.0), True),
]


def ciocche(capelli, ciuffi, c, r):
    for i, (az, el, lung, rr, flusso, piega, alta) in enumerate(CIOCCHE):
        a, e = math.radians(az), math.radians(el)
        nrm = Vector((math.sin(a) * math.cos(e), math.sin(e), -math.cos(a) * math.cos(e)))
        base = Vector(c) + nrm * (r - 0.02)
        d = (nrm * 0.45 + Vector(flusso).normalized()).normalized()
        col = '#D9D9D9' if i % 2 == 0 else '#BFBFBF'
        punta(ciuffi if alta else capelli, tuple(base), tuple(d), lung, rr, col, 'Head', lati=4, piega=piega)


def scollo(vestito, G):
    """Scollo a V sul petto: un cuneo scuro (l'ombra dentro la scollatura) bordato di stoffa, appena sopra la tunica (davanti = −Z)."""
    def cuneo(col, w, top, giu, dz):
        zf = lambda y: -(0.14 + (0.168 - 0.14) * (0.965 - y) / 0.09) * 0.72 - dz
        P = [(-w, top, zf(top)), (w, top, zf(top)), (0.0, giu, zf(giu))]
        pts = P + [(x, y, z + 0.018) for x, y, z in P]
        faces = [(0, 2, 1), (3, 4, 5), (0, 1, 4, 3), (1, 2, 5, 4), (2, 0, 3, 5)]
        i0 = vestito._verts(pts, 'Spine')
        vestito._faces(faces, i0, col, pts)
    cuneo(G['ombra'], 0.044, 0.975, 0.875, 0.004)
    cuneo(G['scuro'], 0.03, 0.975, 0.895, 0.007)
