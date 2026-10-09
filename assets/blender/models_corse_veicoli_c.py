# MAREA — veicoli dell'Isola delle Corse, gruppo c (#178). Vedi models_corse_veicoli.py per lo stile e docs/CORSE.md A6.
# Carrello della spesa, vasca da bagno, divano a motore, Ape car, struzzo, fetta di pizza.
# Davanti −Z, pivot a terra al centro, il pilota si aggiunge dopo (seduta libera).
import math
from lib import Mesh, Xf, beam, face
from corse_kit import C, ruota, sfera, volante, fascia


def _obj(m):
    return [m.build()]


# ---------------------------------------------------------------- attrezzi locali
def bx(m, x0, y0, z0, x1, y1, z1, col, top=None, bot=None, skip=()):
    """Parallelepipedo a colori della palette (il fondo manca se non lo chiedi)."""
    m.box(x0, y0, z0, x1, y1, z1, C(col), C(top) if top else None, C(bot) if bot else None, skip=skip)


def rod(m, p0, p1, t, col, n=4, caps=True, t2=None, cap=None):
    beam(m, p0, p1, t, t2 or t, C(col), end=(C(cap or col) if caps else None), n=n)


def anello(n, rx, rz, y, cx=0.0, cz=0.0, p=0.65):
    """Anello squadrato (superellisse) di n punti, per vasche e scafi."""
    pts = []
    for i in range(n):
        a = 2 * math.pi * (i + 0.5) / n
        c, s = math.cos(a), math.sin(a)
        pts.append((cx + rx * math.copysign(abs(c) ** p, c), y, cz + rz * math.copysign(abs(s) ** p, s)))
    return pts


def fascio(m, rings, reg, dentro=False, dirz=None):
    """Fasce tra anelli, sempre con le facce verso l'esterno (o l'interno se dentro=True)."""
    regs = reg if isinstance(reg, (list, tuple)) else [reg] * (len(rings) - 1)
    for k, (a, b) in enumerate(zip(rings, rings[1:])):
        n = len(a)
        cx = sum(p[0] for p in a) / n
        cz = sum(p[2] for p in a) / n
        for i in range(n):
            j = (i + 1) % n
            q = [a[i], a[j], b[j], b[i]]
            if dirz:
                h = dirz
            else:
                mx = sum(p[0] for p in q) / 4
                mz = sum(p[2] for p in q) / 4
                h = (mx - cx, 0, mz - cz)
                if dentro:
                    h = (-h[0], 0, -h[2])
            face(m, q, C(regs[k]), h)


def tappo(m, ring, col, su=True):
    face(m, list(ring), C(col), (0, 1 if su else -1, 0))


def vol(m, x, y, z, r=0.17, incl=-35, col='nero_caldo', colonna=0.3):
    """Volante a ottagono inclinato verso chi guida, piantone che scende in avanti."""
    m.push(Xf(t=(x, y, z), r=(incl, 0, 0)))
    pts = [(r * math.cos((i + 0.5) * math.pi / 4), r * math.sin((i + 0.5) * math.pi / 4), 0) for i in range(8)]
    for i in range(8):
        a, b = pts[i], pts[(i + 1) % 8]
        d = (b[0] - a[0], b[1] - a[1], 0)
        beam(m, (a[0] - d[0] * 0.15, a[1] - d[1] * 0.15, 0), (b[0] + d[0] * 0.15, b[1] + d[1] * 0.15, 0), 0.05, 0.05, C(col), end=None)
    beam(m, (-r * 0.9, 0, 0), (r * 0.9, 0, 0), 0.045, 0.045, C(col), end=None)
    beam(m, (0, 0, 0), (0, -r * 0.9, 0), 0.045, 0.045, C(col), end=None)
    m.pop()
    beam(m, (x, y - 0.03, z - 0.02), (x, max(0.3, y - colonna), z - 0.2), 0.05, 0.05, C('pietra_scura'), end=C('pietra_scura'))


def lastra(m, pts, col, nrm):
    """Vetro a due facce."""
    face(m, pts, C(col), nrm)
    face(m, list(reversed(pts)), C(col), tuple(-c for c in nrm))


def vasca_anello(m, cx, cy, cz, r, t, n=8, a=0.0, colori=('rosso', 'pietra_chiara')):
    """Salvagente sul fianco x: spicchi alternati rosso/bianco nel piano YZ."""
    pts = [(cx, cy + r * math.cos(a + 2 * math.pi * i / n), cz + r * math.sin(a + 2 * math.pi * i / n)) for i in range(n)]
    for i in range(n):
        p, q = pts[i], pts[(i + 1) % n]
        d = (q[0] - p[0], q[1] - p[1], q[2] - p[2])
        beam(m, (p[0], p[1] - d[1] * 0.12, p[2] - d[2] * 0.12), (q[0], q[1] + d[1] * 0.12, q[2] + d[2] * 0.12), t, t, C(colori[i % 2]), end=None)


# ---------------------------------------------------------------- carrello della spesa
def cs_v_carrello_spesa():
    """Carrello della spesa a motore: cestello a griglia, bandierina rossa, motorino dietro."""
    m = Mesh('cs_v_carrello_spesa')
    G, GC = 'pietra', 'pietra_chiara'
    # telaio basso
    for s in (-1, 1):
        rod(m, (s * 0.4, 0.36, -0.8), (s * 0.4, 0.36, 0.62), 0.07, G)
    rod(m, (-0.64, 0.24, -0.8), (0.64, 0.24, -0.8), 0.07, G)
    rod(m, (-0.64, 0.28, 0.55), (0.64, 0.28, 0.55), 0.08, 'pietra_scura')
    # fondo del cestello
    bx(m, -0.4, 0.47, -0.9, 0.4, 0.5, 0.32, G, GC)
    # lati a griglia: sbarre che si aprono verso l'alto
    zs = (-0.84, -0.6, -0.36, -0.12, 0.1, 0.32)
    for s in (-1, 1):
        for z in zs:
            rod(m, (s * 0.4, 0.5, z), (s * 0.56, 1.1, z), 0.035, GC, caps=False)
        rod(m, (s * 0.56, 1.1, -0.9), (s * 0.56, 1.1, 0.32), 0.06, GC)
        rod(m, (s * 0.48, 0.8, -0.9), (s * 0.48, 0.8, 0.32), 0.035, G, caps=False)
        rod(m, (s * 0.44, 0.65, -0.9), (s * 0.44, 0.65, 0.32), 0.035, G, caps=False)
    for x in (-0.36, -0.2, -0.06, 0.06, 0.2, 0.36):
        rod(m, (x * 0.9, 0.5, -0.9), (x * 1.4, 1.1, -0.9), 0.035, GC, caps=False)
    rod(m, (-0.57, 1.1, -0.9), (0.57, 1.1, -0.9), 0.06, GC)
    rod(m, (-0.47, 0.8, -0.9), (0.47, 0.8, -0.9), 0.035, G, caps=False)
    rod(m, (-0.44, 0.65, -0.9), (0.44, 0.65, -0.9), 0.035, G, caps=False)
    # angoli rossi davanti
    for s in (-1, 1):
        bx(m, s * 0.56 - 0.07, 1.05, -0.97, s * 0.56 + 0.07, 1.17, -0.83, 'rosso')
    # sedile nero dentro
    bx(m, -0.3, 0.5, -0.12, 0.3, 0.6, 0.3, 'nero_caldo')
    bx(m, -0.3, 0.6, 0.22, 0.3, 1.0, 0.32, 'nero_caldo')
    # montanti e manico rosso dietro
    for s in (-1, 1):
        rod(m, (s * 0.54, 1.08, 0.3), (s * 0.5, 1.32, 0.66), 0.06, GC)
    rod(m, (-0.5, 1.32, 0.66), (0.5, 1.32, 0.66), 0.08, 'rosso')
    for s in (-1, 1):
        bx(m, s * 0.5 - 0.07, 1.25, 0.6, s * 0.5 + 0.07, 1.39, 0.74, 'rosso')
    # asta e bandierina
    rod(m, (0.0, 0.7, 0.66), (0.0, 2.1, 0.66), 0.04, GC)
    pts = [(0.0, 2.1, 0.66), (0.58, 1.99, 0.66), (0.4, 1.9, 0.66), (0.58, 1.8, 0.66), (0.0, 1.76, 0.66)]
    lastra(m, pts, 'rosso', (0, 0, 1))
    # motorino dietro
    bx(m, -0.26, 0.34, 0.42, 0.26, 0.64, 0.8, 'nero_caldo', 'pietra_scura')
    bx(m, -0.22, 0.64, 0.46, 0.22, 0.78, 0.76, 'rosso')
    rod(m, (0.3, 0.46, 0.6), (0.52, 0.46, 0.6), 0.2, 'giallo', n=6)
    rod(m, (-0.1, 0.5, 0.8), (-0.1, 0.5, 0.98), 0.08, 'pietra')
    # ruote
    for s in (-1, 1):
        ruota(m, s * 0.64, -0.8, r=0.24, larga=0.2)
        ruota(m, s * 0.66, 0.55, r=0.3, larga=0.26)
    return _obj(m)


# ---------------------------------------------------------------- vasca da bagno
def cs_v_vasca():
    """Vasca da bagno bianca con fascia blu, salvagente, paperella e fuoribordo rosso."""
    m = Mesh('cs_v_vasca')
    W, B = 'pietra_chiara', 'acqua_profonda'
    N, Pw = 16, 0.42
    R0 = anello(N, 0.42, 0.88, 0.2, p=Pw)
    R1 = anello(N, 0.49, 0.95, 0.5, p=Pw)
    R2 = anello(N, 0.54, 1.02, 0.66, p=Pw)
    R3 = anello(N, 0.56, 1.06, 0.9, p=Pw)
    fascio(m, [R0, R1, R2, R3], [B, W, W])
    tappo(m, R0, B, su=False)
    Ri3 = anello(N, 0.45, 0.95, 0.9, p=Pw)
    for i in range(N):                      # bordo piatto
        j = (i + 1) % N
        face(m, [R3[i], R3[j], Ri3[j], Ri3[i]], C(W), (0, 1, 0))
    Ri4 = anello(N, 0.36, 0.82, 0.36, p=Pw)
    fascio(m, [Ri3, Ri4], 'pietra', dentro=True)
    tappo(m, Ri4, 'pietra')
    # piedini a zampa
    for sx in (-1, 1):
        for sz in (-1, 1):
            bx(m, sx * 0.34 - 0.08, 0.0, sz * 0.6 - 0.08, sx * 0.34 + 0.08, 0.22, sz * 0.6 + 0.08, W)
            bx(m, sx * 0.34 - 0.11, 0.0, sz * 0.6 - 0.14, sx * 0.34 + 0.11, 0.07, sz * 0.6 + 0.11, W)
    # panchetta del pilota e ponte di prua
    bx(m, -0.34, 0.34, -0.12, 0.34, 0.55, 0.42, W)
    bx(m, -0.36, 0.34, -0.92, 0.36, 0.6, -0.5, W)
    # paperella gialla di prua, in piedi sul ponte
    sfera(m, 0, 0.82, -0.7, 0.21, 0.18, 0.26, C('giallo'), n=8, rings=2)
    sfera(m, 0, 1.08, -0.8, 0.13, 0.13, 0.13, C('giallo'), n=8, rings=2)
    bx(m, -0.08, 1.02, -1.0, 0.08, 1.09, -0.9, 'arancio')
    bx(m, -0.07, 1.09, -0.98, 0.07, 1.12, -0.9, 'arancio')
    bx(m, -0.04, 0.84, -0.46, 0.04, 0.98, -0.38, 'giallo')       # codina
    for s in (-1, 1):
        bx(m, s * 0.12 - 0.025, 1.1, -0.93, s * 0.12 + 0.025, 1.16, -0.89, 'nero_caldo')
        bx(m, s * 0.21 - 0.02, 0.76, -0.76, s * 0.21 + 0.02, 0.92, -0.62, 'giallo')      # alette
    # volante
    vol(m, 0, 1.0, -0.3, 0.16, incl=-30, colonna=0.4)
    # salvagente sul fianco destro
    vasca_anello(m, 0.6, 0.64, 0.15, 0.23, 0.11, n=8, a=math.pi / 8)
    # fuoribordo appeso al bordo dietro
    bx(m, -0.16, 0.8, 0.86, 0.16, 0.96, 1.16, 'pietra_scura')           # morsa sul bordo
    bx(m, -0.16, 0.8, 0.86, 0.16, 0.9, 0.92, 'pietra_scura')
    bx(m, -0.22, 0.96, 0.84, 0.22, 1.28, 1.2, 'rosso')                   # cofano
    bx(m, -0.22, 0.96, 0.84, 0.22, 1.04, 1.2, 'nero_caldo')
    bx(m, -0.08, 0.3, 1.08, 0.08, 0.98, 1.22, 'roccia')                  # gambo
    bx(m, -0.12, 0.24, 1.02, 0.12, 0.38, 1.26, 'pietra')                 # elica
    rod(m, (0.0, 1.16, 0.84), (0.0, 1.22, 0.55), 0.06, 'nero_caldo')      # barra del timone
    return _obj(m)


# ---------------------------------------------------------------- divano a motore
def cs_v_divano():
    """Divano marrone con volante, fari gialli, paraurti e tubo di scappamento."""
    m = Mesh('cs_v_divano')
    S, SC = 'legno', 'legno_chiaro'
    # telaio
    bx(m, -0.46, 0.28, -0.95, 0.46, 0.42, 0.85, 'roccia', 'pietra_scura')
    # paraurti e fari
    bx(m, -0.46, 0.3, -1.04, 0.46, 0.5, -0.92, 'pietra', 'pietra_chiara')
    bx(m, -0.22, 0.34, -1.1, 0.22, 0.46, -1.02, 'pietra_scura')
    for s in (-1, 1):
        bx(m, s * 0.38 - 0.1, 0.52, -1.02, s * 0.38 + 0.1, 0.72, -0.9, 'pietra_chiara', 'pietra_chiara')
        bx(m, s * 0.38 - 0.07, 0.55, -1.06, s * 0.38 + 0.07, 0.69, -1.01, 'giallo')
    # base e braccioli con il rotolo davanti
    bx(m, -0.54, 0.42, -0.62, 0.54, 0.66, 0.74, S, SC)
    for s in (-1, 1):
        bx(m, s * 0.45 - 0.09, 0.66, -0.62, s * 0.45 + 0.09, 0.9, 0.74, S, SC)
        rod(m, (s * 0.45, 0.95, -0.66), (s * 0.45, 0.95, 0.74), 0.24, SC, n=8, cap=S)
    # cuscini del sedile e schienale alto in due pezzi
    for s in (-1, 1):
        x0, x1 = (0.02, 0.36) if s > 0 else (-0.36, -0.02)
        bx(m, x0, 0.66, -0.58, x1, 0.8, 0.34, S, SC)
        b0, b1 = (0.02, 0.54) if s > 0 else (-0.54, -0.02)
        m.loft([[(b1, 0.66, 0.3), (b1, 0.66, 0.74), (b0, 0.66, 0.74), (b0, 0.66, 0.3)],
                [(b1 - 0.02, 1.38, 0.34), (b1 - 0.02, 1.38, 0.72), (b0 + 0.02, 1.38, 0.72), (b0 + 0.02, 1.38, 0.34)],
                [(b1 - 0.08, 1.5, 0.4), (b1 - 0.08, 1.5, 0.68), (b0 + 0.08, 1.5, 0.68), (b0 + 0.08, 1.5, 0.4)]],
               C(S), top=C(SC))
    # volante
    vol(m, 0, 1.0, -0.3, 0.17, incl=-35, colonna=0.35)
    # scappamento: sale da dietro a destra e si piega
    rod(m, (0.5, 0.5, 0.78), (0.5, 0.5, 1.0), 0.12, 'pietra', n=6)
    rod(m, (0.5, 0.5, 1.0), (0.5, 1.7, 1.0), 0.13, 'pietra', n=6)
    rod(m, (0.5, 1.7, 1.0), (0.64, 1.95, 0.9), 0.14, 'pietra', n=6)
    rod(m, (0.64, 1.95, 0.9), (0.72, 2.08, 0.84), 0.2, 'pietra_scura', n=6)
    for y in (0.9, 1.4):
        rod(m, (0.45, y, 1.0), (0.55, y, 1.0), 0.19, 'pietra_scura', n=6)
    # ruote
    for s in (-1, 1):
        ruota(m, s * 0.66, -0.74, r=0.27, larga=0.24)
        ruota(m, s * 0.68, 0.58, r=0.32, larga=0.26)
    return _obj(m)


# ---------------------------------------------------------------- Ape car
def cs_v_ape():
    """Ape car a tre ruote: cabina azzurra col tetto bianco, cassone di legno, faro tondo davanti."""
    m = Mesh('cs_v_ape')
    A, AD, T = 'acqua_profonda', 'abisso', 'pietra_chiara'
    L = 'acqua'
    bx(m, -0.5, 0.3, -0.8, 0.5, 0.42, 1.05, 'nero_caldo', 'roccia')
    # ruota davanti con parafango tondeggiante
    ruota(m, 0.0, -0.98, r=0.27, larga=0.2)
    bx(m, -0.22, 0.6, -1.18, 0.22, 0.7, -0.74, L, L)
    for s in (-1, 1):
        bx(m, s * 0.22 - 0.02, 0.4, -1.18, s * 0.22 + 0.02, 0.62, -0.74, L)
    # scudo davanti: sotto e sopra al parafango
    bx(m, -0.5, 0.42, -0.8, 0.5, 0.7, -0.62, A)
    bx(m, -0.5, 0.7, -0.96, 0.5, 1.02, -0.62, A, L)
    rod(m, (0.0, 0.88, -1.07), (0.0, 0.88, -0.96), 0.26, T, n=8)
    rod(m, (0.0, 0.88, -1.11), (0.0, 0.88, -1.07), 0.15, 'giallo', n=8)
    for s in (-1, 1):
        bx(m, s * 0.38 - 0.06, 0.8, -1.0, s * 0.38 + 0.06, 0.92, -0.95, 'arancio')
    # cabina: fiancate azzurre
    bx(m, -0.6, 0.42, -0.62, 0.6, 0.98, 0.22, A, L)
    for s in (-1, 1):
        bx(m, s * 0.6 - 0.02, 0.62, -0.12, s * 0.6 + 0.02, 0.68, 0.0, T)     # maniglia
        bx(m, s * 0.6 - 0.02, 0.5, -0.5, s * 0.6 + 0.02, 0.54, 0.15, L)      # modanatura
        rod(m, (s * 0.54, 1.0, -0.62), (s * 0.5, 1.64, -0.5), 0.08, T)       # montante anteriore
        rod(m, (s * 0.56, 0.98, 0.18), (s * 0.56, 1.64, 0.18), 0.08, T)      # montante posteriore
        rod(m, (s * 0.58, 1.1, -0.6), (s * 0.7, 1.12, -0.7), 0.04, 'pietra_scura')   # specchietto
        bx(m, s * 0.7 - 0.03, 1.07, -0.78, s * 0.7 + 0.03, 1.19, -0.68, 'pietra_scura')
    # parabrezza e lunotto
    lastra(m, [(-0.52, 1.0, -0.64), (0.52, 1.0, -0.64), (0.5, 1.62, -0.5), (-0.5, 1.62, -0.5)], 'acqua_bassa', (0, 0.35, -1))
    lastra(m, [(-0.5, 1.0, 0.2), (0.5, 1.0, 0.2), (0.5, 1.62, 0.2), (-0.5, 1.62, 0.2)], 'acqua_bassa', (0, 0, 1))
    # tetto bianco
    bx(m, -0.66, 1.62, -0.74, 0.66, 1.74, 0.32, T)
    # sedile e volante
    bx(m, -0.4, 0.42, -0.14, 0.4, 0.58, 0.16, 'roccia')
    bx(m, -0.4, 0.58, 0.1, 0.4, 1.1, 0.2, 'roccia')
    vol(m, 0, 1.12, -0.4, 0.17, incl=-50, colonna=0.35)
    # cassone di legno
    bx(m, -0.62, 0.52, 0.22, 0.62, 0.58, 1.12, 'legno', 'legno_chiaro')
    for s in (-1, 1):
        bx(m, s * 0.62 - 0.03, 0.58, 0.22, s * 0.62 + 0.03, 0.98, 1.12, 'legno', 'legno_chiaro')
        bx(m, s * 0.62 - 0.035, 0.74, 0.22, s * 0.62 + 0.035, 0.78, 1.12, 'legno_scuro')
    bx(m, -0.62, 0.58, 1.09, 0.62, 0.98, 1.15, 'legno', 'legno_chiaro')
    bx(m, -0.62, 0.74, 1.09, 0.62, 0.78, 1.155, 'legno_scuro')
    # ruote dietro con parafanghi azzurri
    for s in (-1, 1):
        ruota(m, s * 0.66, 0.72, r=0.28, larga=0.24)
        bx(m, s * 0.66 - 0.14, 0.58, 0.4, s * 0.66 + 0.14, 0.66, 1.04, L)
    return _obj(m)


# ---------------------------------------------------------------- struzzo
def cs_v_struzzo():
    """Struzzo da cavalcare: piume nere, code bianche, collo lungo, gambe rosa, sella e manubrio."""
    m = Mesh('cs_v_struzzo')
    PEL, PEL2 = 'sabbia', 'sabbia_chiara'
    by = 0.86                                   # quota del centro del corpo
    # corpo piumato, grosso e tondo
    sfera(m, 0, by, 0.1, 0.52, 0.42, 0.72, C('nero_caldo'), n=10, rings=3)
    sfera(m, 0, by - 0.1, 0.05, 0.5, 0.3, 0.62, C('roccia'), n=10, rings=2)      # pancia piu chiara
    # ali scure sui fianchi con punte bianche
    for s in (-1, 1):
        m.loft([[(s * 0.48, by - 0.1, -0.15), (s * 0.48, by - 0.1, 0.55), (s * 0.58, by, 0.55), (s * 0.58, by, -0.15)],
                [(s * 0.52, by + 0.14, -0.1), (s * 0.52, by + 0.14, 0.55), (s * 0.46, by + 0.26, 0.55), (s * 0.46, by + 0.26, -0.1)]],
               C('roccia'))
        bx(m, s * 0.56 - 0.04, by - 0.12, 0.45, s * 0.56 + 0.04, by + 0.1, 0.82, 'pietra_chiara')
    # coda: ciuffo di piume bianche in su e indietro
    for dx, dy, dz in ((-0.28, 0.2, 1.08), (-0.1, 0.36, 1.18), (0.1, 0.36, 1.18), (0.28, 0.2, 1.08)):
        rod(m, (dx * 0.4, by + 0.3, 0.72), (dx, by + 0.3 + dy, dz), 0.16, 'pietra_chiara', n=4)
    # collare bianco alla base del collo
    rod(m, (0, by + 0.2, -0.5), (0, by + 0.46, -0.58), 0.3, 'pietra_chiara', n=6)
    # collo e testa
    rod(m, (0, by + 0.3, -0.54), (0, by + 0.95, -0.72), 0.19, PEL, n=6)
    rod(m, (0, by + 0.95, -0.72), (0, by + 1.5, -0.84), 0.15, PEL, n=6)
    sfera(m, 0, by + 1.6, -0.9, 0.17, 0.15, 0.17, C(PEL2), n=8, rings=2)
    bx(m, -0.1, by + 1.51, -1.32, 0.1, by + 1.58, -1.02, 'arancio')
    bx(m, -0.09, by + 1.58, -1.26, 0.09, by + 1.62, -1.02, 'arancio')
    for s in (-1, 1):
        bx(m, s * 0.15 - 0.025, by + 1.61, -1.0, s * 0.15 + 0.025, by + 1.71, -0.92, 'nero_caldo')
    # gambe lunghe rosa con ginocchio avanti e piedi a tre dita
    for s in (-1, 1):
        x = s * 0.26
        rod(m, (x, by + 0.02, 0.1), (x, 0.46, -0.14), 0.17, PEL, n=6)
        bx(m, x - 0.09, 0.4, -0.24, x + 0.09, 0.52, -0.12, PEL)                  # ginocchio
        rod(m, (x, 0.46, -0.14), (x, 0.07, 0.06), 0.13, PEL, n=6)
        rod(m, (x, 0.06, 0.12), (x, 0.06, -0.46), 0.11, PEL)
        rod(m, (x, 0.06, 0.12), (x + s * 0.24, 0.06, -0.38), 0.1, PEL)
        rod(m, (x, 0.06, 0.12), (x - s * 0.2, 0.06, -0.36), 0.1, PEL)
    # sella di cuoio col pomolo, cantale e staffe
    t = by + 0.4                               # dorso del corpo
    bx(m, -0.27, t - 0.04, -0.24, 0.27, t + 0.07, 0.38, 'legno', 'legno_chiaro')
    bx(m, -0.12, t + 0.07, -0.32, 0.12, t + 0.2, -0.22, 'legno')
    bx(m, -0.27, t + 0.07, 0.31, 0.27, t + 0.2, 0.4, 'legno')
    for s in (-1, 1):
        bx(m, s * 0.31 - 0.03, t - 0.4, -0.14, s * 0.31 + 0.03, t, 0.3, 'legno_chiaro')
        rod(m, (s * 0.33, t - 0.3, 0.0), (s * 0.33, t - 0.44, 0.0), 0.04, 'pietra')
        bx(m, s * 0.33 - 0.03, t - 0.52, -0.1, s * 0.33 + 0.03, t - 0.44, 0.1, 'pietra_scura')
    # manubrio sul collo
    rod(m, (0, t - 0.1, -0.54), (0, t + 0.5, -0.6), 0.07, 'pietra')
    rod(m, (-0.34, t + 0.52, -0.6), (0.34, t + 0.52, -0.6), 0.07, 'legno')
    for s in (-1, 1):
        rod(m, (s * 0.26, t + 0.52, -0.6), (s * 0.4, t + 0.52, -0.6), 0.1, 'nero_caldo')
    return _obj(m)


# ---------------------------------------------------------------- fetta di pizza
def cs_v_pizza():
    """Fetta di pizza da corsa: punta davanti, cornicione arrotolato dietro, pomodori e basilico."""
    m = Mesh('cs_v_pizza')
    y0, y1 = 0.36, 0.56
    zt, zr = -1.15, 0.66
    ht, hr = 0.12, 0.58
    P = [(-ht, zt), (ht, zt), (hr, zr), (-hr, zr)]
    top = [(x, y1, z) for x, z in P]
    bot = [(x, y0, z) for x, z in P]
    face(m, top, C('giallo'), (0, 1, 0))
    face(m, bot, C('sabbia'), (0, -1, 0))
    for i in range(4):
        j = (i + 1) % 4
        q = [bot[i], bot[j], top[j], top[i]]
        mx = (q[0][0] + q[1][0]) / 2
        mz = (q[0][2] + q[1][2]) / 2
        face(m, q, C('sabbia'), (mx, 0, mz + 0.45))
    # formaggio colato che sgocciola sul bordo
    for s in (-1, 1):
        for (z, l) in ((-0.7, 0.12), (-0.1, 0.1), (0.4, 0.14)):
            hw = ht + (z - zt) / (zr - zt) * (hr - ht)
            bx(m, s * hw - 0.03 * s - (0.0 if s > 0 else 0.0) - 0.0, y1 - l, z - 0.07, s * hw + 0.005 * s, y1 + 0.004, z + 0.07, 'arancio', skip=('bottom',))
    # pomodori (dischi rossi) e basilico
    for (x, z, r) in ((-0.1, -0.7, 0.12), (0.18, -0.35, 0.17), (-0.3, -0.05, 0.19), (0.38, 0.12, 0.15), (-0.02, 0.1, 0.13), (-0.38, 0.45, 0.12), (0.2, 0.45, 0.14)):
        m.prism(8, r, r, y1, y1 + 0.04, C('rosso'), top=C('rosso'), cx=x, cz=z)
    for (x, z) in ((0.04, -0.95), (-0.28, -0.4), (0.3, -0.05), (-0.15, 0.3), (0.5, 0.4), (-0.5, 0.15), (0.0, 0.5), (0.08, -0.6)):
        bx(m, x - 0.045, y1, z - 0.045, x + 0.045, y1 + 0.035, z + 0.045, 'erba_scura')
    # cornicione arrotolato dietro
    rod(m, (-0.62, 0.62, 0.78), (0.62, 0.62, 0.78), 0.48, 'legno_chiaro', n=8, cap='legno')
    for x in (-0.3, 0.3):
        rod(m, (x - 0.02, 0.62, 0.78), (x + 0.02, 0.62, 0.78), 0.5, 'legno', n=8)
    # assi di legno sotto
    rod(m, (-0.52, 0.27, -0.74), (0.52, 0.27, -0.74), 0.07, 'legno')
    rod(m, (-0.66, 0.3, 0.4), (0.66, 0.3, 0.4), 0.07, 'legno')
    rod(m, (0.0, 0.27, -0.74), (0.0, 0.3, 0.4), 0.07, 'legno')
    # volante
    vol(m, 0, 1.0, -0.2, 0.17, incl=-40, colonna=0.4)
    for s in (-1, 1):
        ruota(m, s * 0.5, -0.74, r=0.25, larga=0.22)
        ruota(m, s * 0.72, 0.4, r=0.33, larga=0.26)
    return _obj(m)


MODELS = {
    'cs_v_carrello_spesa': cs_v_carrello_spesa,
    'cs_v_vasca': cs_v_vasca,
    'cs_v_divano': cs_v_divano,
    'cs_v_ape': cs_v_ape,
    'cs_v_struzzo': cs_v_struzzo,
    'cs_v_pizza': cs_v_pizza,
}
