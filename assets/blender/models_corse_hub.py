# Isola delle Corse, kit dell'hub (#185): l'isola aperta alla Diddy Kong Racing da cui si entra nelle 6 zone.
# Concept: assets/concept/corse/corse_01_hub (mappa) e corse_13_hub_arrivo (paese dei piloti al molo).
# Paese dei piloti (garage, statua, podio, torre, trofeo, bancarelle, festoni…), molo, porte delle zone, vegetazione e i quartieri
# che si vedono da lontano (tempio, ruota panoramica, tendone, palazzi al neon, coralli, igloo). Tutto sull'atlas, colori della palette,
# pivot a terra al centro, davanti −Z, metri veri. Eccezioni: `cs_h_ruota_giro` ha il pivot sul mozzo (asse Z, il client la fa girare;
# il mozzo di `cs_h_ruota_base` sta a y = RUOTA_Y) e `cs_h_pontile` / `cs_h_palo_luce` hanno lo zero al piano delle tavole.
import math
from lib import Mesh, Xf, beam, face, _sub, _dot, _cross, _norm
from corse_kit import sfera, corpo_y
from models_corse_spiaggia import _sasso

EM = 'mat_emissivo'
RUOTA_Y = 11.2   # quota del mozzo della ruota panoramica sopra il basamento
RUOTA_R = 9.5    # raggio del cerchione


def _obj(m):
    return [m.build()]


def _add(a, b): return (a[0] + b[0], a[1] + b[1], a[2] + b[2])
def _mul(a, s): return (a[0] * s, a[1] * s, a[2] * s)
def _lerp(a, b, t): return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)
def _mo(mat): return {'mat': mat} if mat else {}


# ------------------------------------------------------------------ attrezzi
def tubo(m, punti, raggi, reg, n=6, cap0=None, cap1=None, mat=None, a0=0.0):
    """Tubo lungo una spezzata con un raggio per punto (tronchi curvi, braccia, megafoni, coralli). Raggio 0 = punta."""
    k = len(punti)
    T = []
    for i in range(k):
        if i == 0:
            t = _sub(punti[1], punti[0])
        elif i == k - 1:
            t = _sub(punti[-1], punti[-2])
        else:
            t = _add(_norm(_sub(punti[i + 1], punti[i])), _norm(_sub(punti[i], punti[i - 1])))
        T.append(_norm(t))
    ref = (0, 1, 0) if abs(T[0][1]) < 0.9 else (1, 0, 0)
    a = _norm(_cross(T[0], ref))
    rings = []
    for p, r, t in zip(punti, raggi, T):
        a = _norm(_sub(a, _mul(t, _dot(a, t))))
        b = _cross(t, a)
        rings.append([_add(p, _add(_mul(a, r * math.cos(a0 + 2 * math.pi * j / n)), _mul(b, r * math.sin(a0 + 2 * math.pi * j / n)))) for j in range(n)])
    o = _mo(mat)
    for i in range(k - 1):
        p0, p1 = punti[i], punti[i + 1]
        d = _sub(p1, p0)
        dd = _dot(d, d) or 1.0
        for j in range(n):
            jj = (j + 1) % n
            pts = [rings[i][j], rings[i][jj], rings[i + 1][jj], rings[i + 1][j]]
            if raggi[i] == 0:
                pts = [pts[0], pts[2], pts[3]]
            elif raggi[i + 1] == 0:
                pts = pts[:3]
            fc = _mul(tuple(sum(q[c] for q in pts) for c in range(3)), 1.0 / len(pts))
            q = _add(p0, _mul(d, _dot(_sub(fc, p0), d) / dd))
            face(m, pts, reg, _sub(fc, q), **o)
    if cap0 and raggi[0] > 0:
        face(m, rings[0], cap0, _mul(T[0], -1), **o)
    if cap1 and raggi[-1] > 0:
        face(m, rings[-1], cap1, T[-1], **o)


def tornio(m, prof, regs, n=8, cx=0.0, cy=0.0, cz=0.0, a0=None, mat=None):
    """Solido di rotazione attorno all'asse Y. prof = [(y, r), …] dal basso verso l'alto (dal centro sotto, fuori, su, al centro sopra).
    regs: una regione o una per tratto; una tupla (regione, materiale) per i tratti emissivi."""
    a0 = math.pi / n if a0 is None else a0
    if isinstance(regs, (str, tuple)):
        regs = [regs] * (len(prof) - 1)
    for (y0, r0), (y1, r1), reg in zip(prof, prof[1:], regs):
        if reg is None or (r0 == 0 and r1 == 0) or (y0 == y1 and r0 == r1):
            continue
        mt = mat
        if isinstance(reg, tuple):
            reg, mt = reg
        dy, dr = y1 - y0, r1 - r0
        for i in range(n):
            t0, t1 = a0 + 2 * math.pi * i / n, a0 + 2 * math.pi * (i + 1) / n
            tm = (t0 + t1) / 2
            P = lambda t, y, r: (cx + math.cos(t) * r, cy + y, cz + math.sin(t) * r)
            pts = [P(t0, y0, r0), P(t1, y0, r0), P(t1, y1, r1), P(t0, y1, r1)]
            if r0 == 0:
                pts = [pts[0], pts[2], pts[3]]
            elif r1 == 0:
                pts = pts[:3]
            face(m, pts, reg, (math.cos(tm) * dy, -dr, math.sin(tm) * dy), **_mo(mt))


def griglia(m, A, B, C, D, reg, nrm, passo=4.0, mat=None, uv='planar'):
    """Quadrilatero A-B-C-D diviso in pannelli di ~passo metri (le tessere dell'atlas si ripetono invece di stirarsi)."""
    nu = max(1, round(math.dist(A, B) / passo))
    nv = max(1, round(math.dist(A, D) / passo))
    P = lambda u, v: _lerp(_lerp(A, B, u), _lerp(D, C, u), v)
    for i in range(nu):
        for j in range(nv):
            face(m, [P(i / nu, j / nv), P((i + 1) / nu, j / nv), P((i + 1) / nu, (j + 1) / nv), P(i / nu, (j + 1) / nv)], reg, nrm, uv=uv, **_mo(mat))


def muro(m, x0, y0, z0, x1, y1, z1, reg, top=None, passo=4.0, skip=('bottom',), lati=None):
    """Parallelepipedo con le facce a pannelli. lati: regione diversa per {'front','back','left','right'}."""
    lati = lati or {}
    F = {
        'front': ([(x1, y0, z0), (x0, y0, z0), (x0, y1, z0), (x1, y1, z0)], (0, 0, -1)),
        'back': ([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], (0, 0, 1)),
        'left': ([(x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0)], (-1, 0, 0)),
        'right': ([(x1, y0, z1), (x1, y0, z0), (x1, y1, z0), (x1, y1, z1)], (1, 0, 0)),
        'top': ([(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)], (0, 1, 0)),
        'bottom': ([(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)], (0, -1, 0)),
    }
    for k, (pts, nrm) in F.items():
        if k in skip:
            continue
        r = top if k == 'top' and top else lati.get(k, reg)
        griglia(m, *pts, r, nrm, passo)


def insegna(m, cx, y0, w, h, z, reg, cornice='p_legno_scuro', spess=0.18, mat=None, retro=True, bordo=0.14):
    """Cartello centrato in cx a quota y0..y0+h sul piano z (davanti −Z) con la cornice in rilievo; retro=True lo dipinge anche dietro."""
    x0, x1 = cx - w / 2, cx + w / 2
    m.box(x0 - bordo, y0 - bordo, z - spess / 2, x1 + bordo, y0 + h + bordo, z + spess / 2, cornice)
    face(m, [(x0, y0, z - spess / 2 - 0.02), (x1, y0, z - spess / 2 - 0.02), (x1, y0 + h, z - spess / 2 - 0.02), (x0, y0 + h, z - spess / 2 - 0.02)], reg, (0, 0, -1), uv='fit', **_mo(mat))
    if retro:
        face(m, [(x0, y0, z + spess / 2 + 0.02), (x1, y0, z + spess / 2 + 0.02), (x1, y0 + h, z + spess / 2 + 0.02), (x0, y0 + h, z + spess / 2 + 0.02)], reg, (0, 0, 1), uv='fit', **_mo(mat))


def lanterna(m, x, y, z, s=1.0, luce='em_faro'):
    """Lanterna a gabbia: base nera, vetro acceso, tettuccio a piramide. y = base."""
    m.box(x - 0.17 * s, y, z - 0.17 * s, x + 0.17 * s, y + 0.07 * s, z + 0.17 * s, 'p_nero_caldo')
    m.box(x - 0.13 * s, y + 0.07 * s, z - 0.13 * s, x + 0.13 * s, y + 0.42 * s, z + 0.13 * s, luce, mat=EM, skip=('top', 'bottom'))
    m.cone(4, 0.25 * s, y + 0.42 * s, y + 0.64 * s, 'p_nero_caldo', bottom='p_nero_caldo', cx=x, cz=z, a0=math.pi / 4)


def bandierine(m, p0, p1, n, sag=0.6, h=0.55, colori=('p_rosso', 'p_giallo', 'p_acqua_profonda', 'p_erba', 'p_arancio', 'p_viola'), corda=6):
    """Fila di bandierine triangolari appese a una corda che si flette tra p0 e p1."""
    P = lambda t: (p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t - sag * 4 * t * (1 - t), p0[2] + (p1[2] - p0[2]) * t)
    for i in range(corda):
        beam(m, P(i / corda), P((i + 1) / corda), 0.035, 0.035, 'p_nero_caldo')
    d = _norm((p1[0] - p0[0], 0, p1[2] - p0[2]))
    nrm = (-d[2], 0, d[0])
    L = math.dist(p0, p1)
    for k in range(n):
        t = (k + 0.5) / n
        dt = 0.42 * L / n / L
        a, b, c = P(t - dt), P(t + dt), P(t)
        tip = (c[0], c[1] - h, c[2])
        reg = colori[k % len(colori)]
        face(m, [a, b, tip], reg, nrm)
        face(m, [a, b, tip], reg, _mul(nrm, -1))


def ciuffo(m, cx, cy, cz, r, reg='p_erba', n=6, ry=None):
    """Cespuglietto a palla schiacciata."""
    sfera(m, cx, cy, cz, r, r * 0.75 if ry is None else ry, r, reg, n=n, rings=2)


def _pennone(m, x, z, h, reg='p_nero_caldo'):
    beam(m, (x, 0, z), (x, h, z), 0.1, 0.1, reg)
    sfera(m, x, h + 0.08, z, 0.1, reg='p_giallo', n=5, rings=2)


# ------------------------------------------------------------------ paese dei piloti
def cs_h_garage():
    """Officina dei piloti (12 x 9 m): saracinesca alzata, officina accesa dentro (banco, carrelli rossi, gomme, pannello degli attrezzi),
    insegna con la chiave inglese, strisce di pericolo sugli stipiti, lampade, fusti e casse fuori."""
    m = Mesh('cs_h_garage')
    X, Z, H, T = 6.0, 4.5, 5.4, 0.3
    DX0, DX1, DH = -4.2, 3.2, 4.0
    W = 'cs_h_muro_garage'
    # muri esterni (davanti con l'apertura)
    griglia(m, (DX0, 0, -Z), (-X, 0, -Z), (-X, H, -Z), (DX0, H, -Z), W, (0, 0, -1))
    griglia(m, (X, 0, -Z), (DX1, 0, -Z), (DX1, H, -Z), (X, H, -Z), W, (0, 0, -1))
    griglia(m, (DX1, DH, -Z), (DX0, DH, -Z), (DX0, H, -Z), (DX1, H, -Z), W, (0, 0, -1))
    griglia(m, (-X, 0, Z), (X, 0, Z), (X, H, Z), (-X, H, Z), W, (0, 0, 1))
    griglia(m, (-X, 0, -Z), (-X, 0, Z), (-X, H, Z), (-X, H, -Z), W, (-1, 0, 0))
    griglia(m, (X, 0, Z), (X, 0, -Z), (X, H, -Z), (X, H, Z), W, (1, 0, 0))
    YR = H + 2.2
    for zz, s in ((-Z, -1), (Z, 1)):  # timpani
        face(m, [(-X, H, zz), (X, H, zz), (0, YR, zz)], W, (0, 0, s))
    # dentro: muri scuri, pannello degli attrezzi, pavimento di cemento, lampada al soffitto
    face(m, [(-X + T, 0, -Z + T), (DX0, 0, -Z + T), (DX0, H, -Z + T), (-X + T, H, -Z + T)], 'p_pietra', (0, 0, 1))
    face(m, [(DX1, 0, -Z + T), (X - T, 0, -Z + T), (X - T, H, -Z + T), (DX1, H, -Z + T)], 'p_pietra', (0, 0, 1))
    face(m, [(DX0, DH, -Z + T), (DX1, DH, -Z + T), (DX1, H, -Z + T), (DX0, H, -Z + T)], 'p_pietra', (0, 0, 1))
    griglia(m, (X - T, 0, Z - T), (-X + T, 0, Z - T), (-X + T, 3.2, Z - T), (X - T, 3.2, Z - T), 'cs_h_attrezzi', (0, 0, -1), passo=2.0)
    face(m, [(X - T, 3.2, Z - T), (-X + T, 3.2, Z - T), (-X + T, H, Z - T), (X - T, H, Z - T)], 'p_pietra_scura', (0, 0, -1))
    for xx, s in ((-X + T, 1), (X - T, -1)):
        face(m, [(xx, 0, -Z + T), (xx, 0, Z - T), (xx, H, Z - T), (xx, H, -Z + T)], 'p_pietra', (s, 0, 0))
    face(m, [(-X + T, H, -Z + T), (X - T, H, -Z + T), (X - T, H, Z - T), (-X + T, H, Z - T)], 'p_roccia', (0, -1, 0))
    face(m, [(-X + T, 0.02, -Z + T), (X - T, 0.02, -Z + T), (X - T, 0.02, Z - T), (-X + T, 0.02, Z - T)], 'p_pietra_scura', (0, 1, 0))
    for x0, z0, x1, z1 in ((-2.1, -2.6, -1.9, 2.4), (0.9, -2.6, 1.1, 2.4), (-2.1, 2.2, 1.1, 2.4)):  # posto auto a strisce gialle
        face(m, [(x0, 0.03, z0), (x1, 0.03, z0), (x1, 0.03, z1), (x0, 0.03, z1)], 'p_giallo', (0, 1, 0))
    m.box(-2.5, H - 0.12, -0.25, 1.5, H, 0.25, 'em_h_bianco', mat=EM, skip=('top',))
    # spessore degli stipiti, architrave, strisce di pericolo, saracinesca arrotolata e un pezzo abbassato
    for xx, s in ((DX0, 1), (DX1, -1)):
        face(m, [(xx, 0, -Z), (xx, 0, -Z + T), (xx, DH, -Z + T), (xx, DH, -Z)], 'p_pietra_scura', (s, 0, 0))
        x0, x1 = (DX0 - 0.35, DX0) if s > 0 else (DX1, DX1 + 0.35)
        face(m, [(x0, 0, -Z - 0.03), (x1, 0, -Z - 0.03), (x1, DH, -Z - 0.03), (x0, DH, -Z - 0.03)], 'cs_pericolo', (0, 0, -1))
    face(m, [(DX0, DH, -Z), (DX1, DH, -Z), (DX1, DH, -Z + T), (DX0, DH, -Z + T)], 'p_pietra_scura', (0, -1, 0))
    beam(m, (DX0, DH + 0.05, -Z + 0.45), (DX1, DH + 0.05, -Z + 0.45), 0.45, 0.45, 'cs_h_saracinesca', end='p_pietra_scura', n=6)
    face(m, [(DX0, DH - 0.55, -Z + 0.2), (DX1, DH - 0.55, -Z + 0.2), (DX1, DH, -Z + 0.2), (DX0, DH, -Z + 0.2)], 'cs_h_saracinesca', (0, 0, -1))
    face(m, [(DX0, DH - 0.55, -Z + 0.2), (DX1, DH - 0.55, -Z + 0.2), (DX1, DH, -Z + 0.2), (DX0, DH, -Z + 0.2)], 'cs_h_saracinesca', (0, 0, 1))
    # zoccolo e spigoli scuri
    for a, b, nrm in (((-X, -Z), (DX0, -Z), (0, 0, -1)), ((DX1, -Z), (X, -Z), (0, 0, -1)), ((X, -Z), (X, Z), (1, 0, 0)), ((X, Z), (-X, Z), (0, 0, 1)), ((-X, Z), (-X, -Z), (-1, 0, 0))):
        o = _mul(nrm, 0.06)
        face(m, [(a[0] + o[0], 0, a[1] + o[2]), (b[0] + o[0], 0, b[1] + o[2]), (b[0] + o[0], 0.45, b[1] + o[2]), (a[0] + o[0], 0.45, a[1] + o[2])], 'p_pietra_scura', nrm)
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box(sx * X - 0.22, 0, sz * Z - 0.22, sx * X + 0.22, H + 0.05, sz * Z + 0.22, 'p_pietra_scura', skip=('bottom',))
    # tetto a due falde (colmo lungo Z) con gronda
    O = 0.55
    for s in (-1, 1):
        A, B = (s * (X + O), H - 0.3, -Z - O), (0, YR + 0.1, -Z - O)
        C, D = (0, YR + 0.1, Z + O), (s * (X + O), H - 0.3, Z + O)
        griglia(m, A, B, C, D, 'tegole', (s * 0.5, 1, 0))
        face(m, [A, B, C, D], 'p_legno_scuro', (-s * 0.5, -1, 0))
        face(m, [A, D, (D[0], D[1] - 0.18, D[2]), (A[0], A[1] - 0.18, A[2])], 'p_nero_caldo', (s, 0, 0))
        for zz, sz in ((-Z - O, -1), (Z + O, 1)):
            face(m, [(s * (X + O), H - 0.3, zz), (0, YR + 0.1, zz), (0, YR - 0.1, zz), (s * (X + O), H - 0.48, zz)], 'p_nero_caldo', (0, 0, sz))
    beam(m, (0, YR + 0.12, -Z - O - 0.05), (0, YR + 0.12, Z + O + 0.05), 0.25, 0.2, 'p_nero_caldo', end='p_nero_caldo')
    # insegna con la chiave inglese sopra la porta, lampade a muro
    insegna(m, -0.5, 4.2, 3.6, 1.8, -Z - 0.14, 'cs_h_ins_chiave', cornice='p_nero_caldo', retro=False)
    for xx in (DX0 - 0.7, DX1 + 0.7):
        beam(m, (xx, 3.6, -Z), (xx, 3.6, -Z - 0.35), 0.06, 0.06, 'p_nero_caldo')
        lanterna(m, xx, 3.25, -Z - 0.38, 0.8, 'em_finestra')
    # finestre accese sui fianchi
    for s in (-1, 1):
        x = s * (X + 0.02)
        face(m, [(x, 1.5, -1.2), (x, 1.5, 1.2), (x, 3.2, 1.2), (x, 3.2, -1.2)], 'em_finestra', (s, 0, 0), mat=EM)
        m.box(x - 0.12 if s > 0 else x - 0.06, 1.35, -1.35, x + 0.06 if s < 0 else x + 0.12, 1.5, 1.35, 'p_pietra_scura')
    # officina: carrelli rossi degli attrezzi, banco con la morsa, gomme impilate
    for x0, z0 in ((-3.9, -2.4), (-3.9, -0.9), (1.6, 3.15)):
        m.box(x0, 0, z0, x0 + 1.3, 1.35, z0 + 1.0, 'p_rosso', top='p_pietra_scura', skip=('bottom',))
        for yy in (0.45, 0.78, 1.1):
            face(m, [(x0 - 0.02, yy, z0 + 0.08), (x0 - 0.02, yy, z0 + 0.92), (x0 - 0.02, yy + 0.06, z0 + 0.92), (x0 - 0.02, yy + 0.06, z0 + 0.08)], 'p_nero_caldo', (-1, 0, 0))
            face(m, [(x0 + 0.08, yy, z0 - 0.02), (x0 + 1.22, yy, z0 - 0.02), (x0 + 1.22, yy + 0.06, z0 - 0.02), (x0 + 0.08, yy + 0.06, z0 - 0.02)], 'p_nero_caldo', (0, 0, -1))
    m.box(-3.8, 1.35, -2.3, -2.7, 1.75, -1.5, 'p_rosso', top='p_rosso', skip=('bottom',))
    m.box(-3.75, 1.75, -2.2, -2.75, 1.9, -1.6, 'p_pietra', top='p_pietra')
    # cric idraulico e carrello col motore sul posto auto
    m.box(-1.2, 0, -1.6, 0.2, 0.25, -0.9, 'p_rosso', top='p_rosso', skip=('bottom',))
    beam(m, (-0.5, 0.25, -1.25), (-0.5, 1.1, -2.6), 0.08, 0.08, 'p_nero_caldo')
    m.box(-1.0, 0, 0.3, 0.2, 0.55, 1.3, 'p_pietra_scura', top='p_roccia', skip=('bottom',))
    m.box(-0.85, 0.55, 0.45, 0.05, 1.15, 1.15, 'p_roccia', top='p_pietra')
    for k in range(3):
        m.box(-0.8 + k * 0.3, 1.15, 0.55, -0.62 + k * 0.3, 1.35, 1.05, 'p_pietra', top='p_pietra_chiara')
    m.box(-3.8, 0.85, 3.3, 0.6, 0.98, 4.1, 'tavole', top='tavole')
    for xx in (-3.65, 0.45):
        for zz in (3.4, 4.0):
            beam(m, (xx, 0, zz), (xx, 0.85, zz), 0.1, 0.1, 'p_pietra_scura')
    m.box(-3.4, 0.98, 3.45, -2.9, 1.25, 3.8, 'p_acqua_profonda')
    m.box(-0.6, 0.98, 3.5, 0.3, 1.2, 3.95, 'p_rosso', top='p_pietra')
    for k in range(4):
        tornio(m, [(k * 0.24, 0), (k * 0.24, 0.36), (k * 0.24 + 0.22, 0.36), (k * 0.24 + 0.22, 0)], ['p_roccia', 'p_nero_caldo', 'p_roccia'], n=8, cx=2.4, cz=-3.4)
    for k in range(3):
        tornio(m, [(k * 0.24, 0), (k * 0.24, 0.36), (k * 0.24 + 0.22, 0.36), (k * 0.24 + 0.22, 0)], ['p_roccia', 'p_nero_caldo', 'p_roccia'], n=8, cx=2.4, cz=-2.55)
    # fuori: fusti dell'olio e gomme
    for (x, z, reg) in ((-6.7, -3.7, 'p_rosso'), (-6.75, -2.85, 'p_acqua_profonda')):
        m.prism(8, 0.32, 0.32, 0, 0.95, reg, top='p_pietra_scura', cx=x, cz=z)
        m.prism(8, 0.34, 0.34, 0.6, 0.68, 'p_pietra_scura', cx=x, cz=z)
    for k in range(3):
        tornio(m, [(k * 0.24, 0), (k * 0.24, 0.36), (k * 0.24 + 0.22, 0.36), (k * 0.24 + 0.22, 0)], ['p_roccia', 'p_nero_caldo', 'p_roccia'], n=8, cx=6.8, cz=-3.6)
    # marciapiede davanti
    m.box(-X - 0.6, 0, -Z - 2.2, X + 0.6, 0.06, -Z, 'p_pietra_scura', top='cemento', skip=('bottom', 'back'))
    return _obj(m)


def _manichino_eroe(m):
    """Manichino in piedi (unità umane, 1,6 m): una mano sul fianco, l'altra alzata col trofeo; cappellino rosso, fascia a scacchi."""
    MAN, GIU = 'p_pietra_chiara', 'p_pietra'
    for s in (-1, 1):
        m.box(s * 0.17 - 0.065, 0, -0.2, s * 0.17 + 0.065, 0.09, 0.07, MAN, top=MAN)                    # piedi
        tubo(m, [(s * 0.17, 0.08, 0), (s * 0.15, 0.45, -0.02), (s * 0.115, 0.84, 0)], [0.058, 0.072, 0.1], MAN, n=6)
        sfera(m, s * 0.15, 0.45, -0.02, 0.078, reg=GIU, n=6, rings=2)                                    # ginocchia
    corpo_y(m, [(0.76, 0.16, 0.11, 0, 0), (0.92, 0.175, 0.115, 0, 0), (1.02, 0.145, 0.1, 0, 0), (1.18, 0.19, 0.115, 0, 0), (1.32, 0.22, 0.115, 0, 0), (1.38, 0.1, 0.075, 0, 0)], MAN, n=8)
    beam(m, (0, 1.36, 0), (0, 1.45, 0), 0.07, 0.07, GIU, n=6)
    sfera(m, 0, 1.53, -0.005, 0.1, 0.125, 0.112, MAN, n=8, rings=3)                                     # testa
    corpo_y(m, [(1.56, 0.112, 0.122, 0, 0.005), (1.63, 0.1, 0.11, 0, 0.005), (1.67, 0.06, 0.07, 0, 0.005)], 'p_rosso', n=8)  # cappellino
    m.box(-0.085, 1.55, -0.25, 0.085, 1.575, -0.08, 'p_rosso', top='p_rosso')                            # visiera
    sfera(m, 0, 1.675, 0.005, 0.02, reg='p_pietra_chiara', n=4, rings=1)
    beam(m, (-0.17, 0.86, 0), (0.19, 1.34, 0), 0.27, 0.085, 'cs_scacchi')                                # fascia a scacchi
    for s in (-1, 1):
        sfera(m, s * 0.22, 1.31, 0, 0.075, reg=GIU, n=6, rings=2)                                        # spalle
    # braccio destro alzato col trofeo, braccio sinistro sul fianco
    tubo(m, [(0.23, 1.31, 0), (0.32, 1.53, -0.03), (0.27, 1.79, -0.02)], [0.06, 0.052, 0.042], MAN, n=6)
    sfera(m, 0.32, 1.53, -0.03, 0.058, reg=GIU, n=6, rings=2)
    sfera(m, 0.27, 1.82, -0.02, 0.05, reg=MAN, n=6, rings=2)
    tubo(m, [(-0.23, 1.31, 0), (-0.37, 1.09, 0.03), (-0.2, 0.93, -0.04)], [0.06, 0.052, 0.042], MAN, n=6)
    sfera(m, -0.37, 1.09, 0.03, 0.058, reg=GIU, n=6, rings=2)
    sfera(m, -0.19, 0.93, -0.04, 0.05, reg=MAN, n=6, rings=2)
    # trofeo in mano
    tornio(m, [(1.84, 0), (1.84, 0.05), (1.87, 0.05), (1.88, 0.018), (1.95, 0.018), (2.0, 0.07), (2.1, 0.1), (2.14, 0.11), (2.14, 0.09), (2.11, 0)],
           ['p_arancio', 'p_arancio', 'p_giallo', 'p_giallo', 'oro', 'oro', 'p_giallo', 'p_giallo', 'p_arancio'], n=8, cx=0.27, cz=-0.02)
    for s in (-1, 1):
        tubo(m, [(0.27 + s * 0.09, 2.11, -0.02), (0.27 + s * 0.15, 2.08, -0.02), (0.27 + s * 0.13, 2.0, -0.02), (0.27 + s * 0.07, 1.99, -0.02)], [0.014] * 4, 'p_giallo', n=4)


def cs_h_statua():
    """Statua del manichino campione (~9 m col trofeo alzato) sul basamento ottagonale con la targa d'oro."""
    m = Mesh('cs_h_statua')
    m.prism(8, 2.2, 2.2, 0, 0.35, 'p_pietra_scura', top='p_pietra')
    m.prism(8, 1.75, 1.65, 0.35, 1.25, 'pietra_muro', top='p_pietra_chiara')
    m.prism(8, 1.8, 1.8, 1.25, 1.4, 'p_pietra_chiara', top='p_pietra_chiara')
    face(m, [(-0.7, 0.55, -1.73), (0.7, 0.55, -1.73), (0.7, 1.05, -1.69), (-0.7, 1.05, -1.69)], 'oro', (0, 0, -1))
    for a in range(4):  # vasi di fiori agli angoli del basamento
        t = math.pi / 4 + a * math.pi / 2
        x, z = math.cos(t) * 1.75, math.sin(t) * 1.75
        m.prism(5, 0.22, 0.28, 0.35, 0.7, 'p_legno_chiaro', cx=x, cz=z)
        ciuffo(m, x, 0.78, z, 0.3, 'p_erba_scura', n=5)
        for k, c in enumerate(('p_rosso', 'p_giallo', 'p_pietra_chiara')):
            sfera(m, x + 0.15 * math.cos(k * 2.1), 0.98, z + 0.15 * math.sin(k * 2.1), 0.07, reg=c, n=4, rings=1)
    m.push(Xf(t=(0, 1.4, 0), s=4.2))
    _manichino_eroe(m)
    m.pop()
    return _obj(m)


def cs_h_podio():
    """Podio 1-2-3 (6,6 m): gradini di pietra chiara coi numeri, bordi oro-argento-bronzo, tappeto rosso e vasi di fiori."""
    m = Mesh('cs_h_podio')
    m.box(-3.4, 0, -1.4, 3.4, 0.15, 1.3, 'p_pietra_scura', top='p_pietra', skip=('bottom',))
    for x0, x1, h, n, orlo, lato in ((-1.0, 1.0, 1.6, '1', 'p_giallo', 0.7), (1.0, 3.0, 1.1, '2', 'p_pietra', 0.55), (-3.0, -1.0, 0.75, '3', 'p_legno_chiaro', 0.42)):
        muro(m, x0, 0.15, -1.0, x1, h, 1.0, 'cs_h_muro_garage', top='p_pietra_chiara', passo=2.0)
        m.box(x0 - 0.06, h, -1.06, x1 + 0.06, h + 0.1, 1.06, orlo, top=orlo)
        cy = 0.15 + (h - 0.15) / 2
        face(m, [(-lato / 2 + (x0 + x1) / 2, cy - lato / 2, -1.02), (lato / 2 + (x0 + x1) / 2, cy - lato / 2, -1.02),
                 (lato / 2 + (x0 + x1) / 2, cy + lato / 2, -1.02), (-lato / 2 + (x0 + x1) / 2, cy + lato / 2, -1.02)], 'cs_h_n' + n, (0, 0, -1), uv='fit')
    face(m, [(-0.75, 0.17, -3.0), (0.75, 0.17, -3.0), (0.75, 0.17, -1.0), (-0.75, 0.17, -1.0)], 'p_rosso', (0, 1, 0))
    for s in (-1, 1):
        face(m, [(s * 0.75, 0.17, -3.0), (s * 0.85, 0.17, -3.0), (s * 0.85, 0.17, -1.0), (s * 0.75, 0.17, -1.0)], 'p_giallo', (0, 1, 0))
        m.prism(6, 0.3, 0.36, 0.15, 0.6, 'p_legno_chiaro', top='p_legno', cx=s * 3.0, cz=-1.6)
        ciuffo(m, s * 3.0, 0.7, -1.6, 0.42, 'p_erba_scura', n=6)
        for k, c in enumerate(('p_rosso', 'p_giallo', 'p_rosso', 'p_pietra_chiara')):
            sfera(m, s * 3.0 + 0.24 * math.cos(k * 1.6), 0.95, -1.6 + 0.24 * math.sin(k * 1.6), 0.09, reg=c, n=4, rings=1)
    return _obj(m)


def cs_h_torre():
    """Torre di controllo (11,7 m): fusto di pietra, fascia a scacchi, balconata, sala coi vetri accesi, tetto rosso, megafoni e bandiera."""
    m = Mesh('cs_h_torre')
    m.box(-2.1, 0, -2.1, 2.1, 0.5, 2.1, 'p_pietra_scura', top='p_pietra', skip=('bottom',))
    muro(m, -1.8, 0.5, -1.8, 1.8, 5.8, 1.8, 'pietra_muro', skip=('bottom', 'top'))
    muro(m, -1.86, 5.8, -1.86, 1.86, 6.7, 1.86, 'cs_scacchi', passo=1.0, skip=('bottom', 'top'))
    m.box(-0.65, 0.5, -1.95, 0.65, 2.75, -1.8, 'p_pietra_chiara', skip=('back', 'bottom'))
    face(m, [(-0.5, 0.5, -1.96), (0.5, 0.5, -1.96), (0.5, 2.6, -1.96), (-0.5, 2.6, -1.96)], 'tavole_scure', (0, 0, -1))
    for yy in (3.4,):
        for nrm in ((0, 0, -1), (1, 0, 0), (-1, 0, 0), (0, 0, 1)):
            if nrm == (0, 0, -1):
                continue
            c = _mul(nrm, 1.82)
            u = (-nrm[2], 0, nrm[0])
            P = lambda a, y: (c[0] + u[0] * a, y, c[2] + u[2] * a)
            face(m, [P(-0.35, yy), P(0.35, yy), P(0.35, yy + 1.0), P(-0.35, yy + 1.0)], 'em_finestra', nrm, mat=EM)
    face(m, [(-0.35, 3.6, -1.82), (0.35, 3.6, -1.82), (0.35, 4.6, -1.82), (-0.35, 4.6, -1.82)], 'em_finestra', (0, 0, -1), mat=EM)
    # balconata e ringhiera
    m.box(-2.7, 6.7, -2.7, 2.7, 7.0, 2.7, 'p_pietra_scura', top='tavole')
    for a, b in (((-2.6, -2.6), (2.6, -2.6)), ((2.6, -2.6), (2.6, 2.6)), ((2.6, 2.6), (-2.6, 2.6)), ((-2.6, 2.6), (-2.6, -2.6))):
        beam(m, (a[0], 7.95, a[1]), (b[0], 7.95, b[1]), 0.1, 0.1, 'p_rosso')
        for t in (0.0, 0.5):
            x, z = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
            beam(m, (x, 7.0, z), (x, 7.95, z), 0.08, 0.08, 'p_pietra_chiara')
    # sala di controllo
    m.box(-2.0, 7.0, -2.0, 2.0, 7.6, 2.0, 'p_pietra_chiara', skip=('bottom', 'top'))
    for nrm in ((0, 0, -1), (1, 0, 0), (0, 0, 1), (-1, 0, 0)):
        c = _mul(nrm, 2.0)
        u = (-nrm[2], 0, nrm[0])
        P = lambda a, y: (c[0] + u[0] * a, y, c[2] + u[2] * a)
        face(m, [P(-2.0, 7.6), P(2.0, 7.6), P(2.0, 9.0), P(-2.0, 9.0)], 'em_finestra', nrm, mat=EM)
        for a in (-1.33, 0.0, 1.33):
            p = P(a, 0)
            q = _mul(nrm, 0.05)
            beam(m, (p[0] + q[0], 7.6, p[2] + q[2]), (p[0] + q[0], 9.0, p[2] + q[2]), 0.1, 0.1, 'p_nero_caldo')
    m.box(-2.0, 9.0, -2.0, 2.0, 9.35, 2.0, 'p_pietra_chiara', skip=('bottom',))
    # tetto rosso a piramide con la gronda
    E, YE, YA = 2.85, 9.35, 11.3
    pts = [(-E, YE, -E), (E, YE, -E), (E, YE, E), (-E, YE, E)]
    for i in range(4):
        a, b = pts[i], pts[(i + 1) % 4]
        nrm = _norm(_add(_mul(_add(a, b), 0.5), (0, -YE, 0)))
        face(m, [a, b, (0, YA, 0)], 'cs_coppi', (nrm[0], 1.0, nrm[2]))
        face(m, [a, b, (b[0], YE - 0.15, b[2]), (a[0], YE - 0.15, a[2])], 'p_rosso', (nrm[0], 0, nrm[2]))
    face(m, [(-E, YE - 0.15, -E), (E, YE - 0.15, -E), (E, YE - 0.15, E), (-E, YE - 0.15, E)], 'p_legno_scuro', (0, -1, 0))
    beam(m, (0, YA - 0.1, 0), (0, YA + 1.4, 0), 0.07, 0.07, 'p_nero_caldo')
    for nrm in ((0, 0, -1), (0, 0, 1)):
        face(m, [(0, YA + 1.35, 0), (1.1, YA + 1.35, 0), (1.1, YA + 0.6, 0), (0, YA + 0.6, 0)], 'cs_scacchi', nrm)
    # megafoni sui fianchi
    for s in (-1, 1):
        for zz in (-1.0, 1.0):
            beam(m, (s * 2.0, 9.15, zz), (s * 2.35, 9.15, zz), 0.08, 0.08, 'p_nero_caldo')
            tubo(m, [(s * 2.3, 9.2, zz), (s * 2.55, 9.15, zz), (s * 3.1, 9.0, zz)], [0.12, 0.16, 0.42], 'p_pietra_chiara', n=8, cap0='p_pietra', cap1='p_nero_caldo')
    return _obj(m)


def cs_h_trofeo():
    """Trofeo d'oro gigante (6,9 m) per la rotatoria: piedistallo di pietra a gradoni, zoccolo nero, coppa con i manici."""
    m = Mesh('cs_h_trofeo')
    m.box(-2.2, 0, -2.2, 2.2, 0.45, 2.2, 'pietra_muro', top='p_pietra', skip=('bottom',))
    m.prism(8, 1.7, 1.55, 0.45, 2.25, 'pietra_muro', top='p_pietra')
    m.prism(8, 1.78, 1.78, 2.25, 2.45, 'p_pietra_chiara', top='p_pietra_chiara', bottom='p_pietra_scura')
    m.prism(8, 1.78, 1.78, 0.45, 0.62, 'p_pietra_chiara')
    face(m, [(-0.75, 1.0, -1.63), (0.75, 1.0, -1.63), (0.75, 1.7, -1.6), (-0.75, 1.7, -1.6)], 'oro', (0, 0, -1))
    m.box(-0.85, 2.45, -0.85, 0.85, 3.05, 0.85, 'p_nero_caldo', top='p_roccia')
    m.box(-0.88, 2.65, -0.88, 0.88, 2.78, 0.88, 'p_giallo', skip=('top', 'bottom'))
    B = 3.05
    prof = [(0, 0.62), (0.12, 0.62), (0.2, 0.42), (0.55, 0.26), (0.75, 0.22), (0.85, 0.36), (0.98, 0.2), (1.25, 0.2), (1.5, 0.55),
            (2.05, 1.05), (2.75, 1.32), (3.25, 1.42), (3.42, 1.46), (3.5, 1.3), (3.35, 0)]
    prof = [(B + y, r) for y, r in prof]
    prof = [(B, 0)] + prof
    regs = ['p_arancio', 'p_giallo', 'p_arancio', 'oro', 'oro', 'p_giallo', 'p_arancio', 'oro', 'p_arancio', 'oro', 'oro', 'p_giallo', 'p_giallo', 'p_giallo', 'p_arancio']
    tornio(m, prof, regs, n=12)
    for s in (-1, 1):
        tubo(m, [(s * 1.25, B + 3.0, 0), (s * 1.95, B + 3.05, 0), (s * 2.25, B + 2.6, 0), (s * 1.95, B + 1.95, 0), (s * 1.2, B + 1.8, 0)], [0.13] * 5, 'p_giallo', n=6)
    return _obj(m)


def cs_h_bancarella():
    """Bancarella del paese: banco di legno con le cassette di frutta, tenda a strisce rosse e bianche con la mantovana a punte, lanterna."""
    m = Mesh('cs_h_bancarella')
    m.box(-1.7, 0, -0.55, 1.7, 0.95, 0.45, 'tavole', top='p_legno', skip=('bottom',))
    face(m, [(-1.7, 0.15, -0.57), (1.7, 0.15, -0.57), (1.7, 0.8, -0.57), (-1.7, 0.8, -0.57)], 'cs_tenda_rossa', (0, 0, -1))
    frutti = (('p_rosso', 'p_rosso'), ('p_arancio', 'p_giallo'), ('p_erba', 'p_erba_chiara'))
    for i, xx in enumerate((-1.1, 0.0, 1.1)):
        m.box(xx - 0.48, 0.95, -0.45, xx + 0.48, 1.12, 0.25, 'cassa', top='cassa')
        for k in range(3):
            sfera(m, xx - 0.25 + k * 0.25, 1.18, -0.12 + 0.1 * (k % 2), 0.13, reg=frutti[i][k % 2], n=5, rings=2)
    for xx in (-1.7, 1.7):
        beam(m, (xx, 0, -0.55), (xx, 2.3, -0.55), 0.1, 0.1, 'p_legno_scuro')
        beam(m, (xx, 0, 0.9), (xx, 2.75, 0.9), 0.1, 0.1, 'p_legno_scuro')
    A, B, C, D = (-1.95, 2.25, -1.05), (1.95, 2.25, -1.05), (1.95, 2.8, 1.05), (-1.95, 2.8, 1.05)
    face(m, [A, B, C, D], 'cs_tenda_rossa', (0, 1, -0.3))
    face(m, [A, B, C, D], 'cs_tenda_rossa', (0, -1, 0.3))
    for k in range(8):  # mantovana a punte
        x0, x1 = -1.95 + k * 3.9 / 8, -1.95 + (k + 1) * 3.9 / 8
        reg = 'p_rosso' if k % 2 == 0 else 'p_pietra_chiara'
        for s in (-1, 1):
            face(m, [(x0, 2.25, -1.05), (x1, 2.25, -1.05), ((x0 + x1) / 2, 1.95, -1.05)], reg, (0, 0, s))
    face(m, [(-0.9, 2.8, 1.0), (0.9, 2.8, 1.0), (0.9, 3.45, 1.0), (-0.9, 3.45, 1.0)], 'p_giallo', (0, 0, -1))
    face(m, [(-0.75, 2.92, 0.98), (0.75, 2.92, 0.98), (0.75, 3.33, 0.98), (-0.75, 3.33, 0.98)], 'p_rosso', (0, 0, -1))
    beam(m, (1.2, 2.25, -0.95), (1.2, 1.95, -0.95), 0.03, 0.03, 'p_nero_caldo')
    lanterna(m, 1.2, 1.55, -0.95, 0.9, 'em_lanterna')
    m.box(-2.4, 0, -0.3, -1.85, 0.5, 0.3, 'cassa', top='cassa')
    return _obj(m)


def cs_h_festone():
    """Festone: palo nel pivot e secondo palo 8 m verso +X, corda con 14 bandierine colorate."""
    m = Mesh('cs_h_festone')
    for x in (0.0, 8.0):
        m.prism(6, 0.2, 0.2, 0, 0.3, 'p_pietra_scura', top='p_pietra', cx=x)
        beam(m, (x, 0.3, 0), (x, 4.6, 0), 0.13, 0.13, 'p_legno_scuro')
        sfera(m, x, 4.7, 0, 0.12, reg='p_giallo', n=5, rings=2)
    bandierine(m, (0, 4.4, 0), (8.0, 4.4, 0), 14, sag=0.9, h=0.6)
    return _obj(m)


def cs_h_bandiera():
    """Pennone con la bandiera a scacchi mossa dal vento (6,5 m)."""
    m = Mesh('cs_h_bandiera')
    m.prism(6, 0.3, 0.25, 0, 0.3, 'p_pietra_scura', top='p_pietra')
    beam(m, (0, 0.3, 0), (0, 6.3, 0), 0.11, 0.11, 'p_nero_caldo', n=6)
    sfera(m, 0, 6.4, 0, 0.13, reg='p_giallo', n=6, rings=2)
    cols = [(0.0, 0.0), (0.6, -0.18), (1.2, 0.05), (1.8, 0.2), (2.3, 0.05)]
    for (x0, z0), (x1, z1) in zip(cols, cols[1:]):
        for nrm in ((0, 0, -1), (0, 0, 1)):
            face(m, [(x0 + 0.06, 6.15 - x0 * 0.06, z0), (x1 + 0.06, 6.15 - x1 * 0.06, z1), (x1 + 0.06, 4.75 - x1 * 0.06, z1), (x0 + 0.06, 4.75 - x0 * 0.06, z0)], 'cs_scacchi', nrm)
    return _obj(m)


def cs_h_staccionata():
    """Staccionata di legno (segmento di 3 m lungo X): tre paletti a punta e due traverse."""
    m = Mesh('cs_h_staccionata')
    for x in (-1.5, 0.0, 1.5):
        m.box(x - 0.08, 0, -0.08, x + 0.08, 1.05, 0.08, 'p_legno', skip=('bottom', 'top'))
        m.cone(4, 0.115, 1.05, 1.22, 'p_legno', cx=x, a0=math.pi / 4)
    for y in (0.42, 0.85):
        m.box(-1.55, y - 0.08, -0.13, 1.55, y + 0.08, -0.08, 'tavole', top='p_legno_chiaro', bottom='p_legno_scuro')
    return _obj(m)


def cs_h_cartello():
    """Cartello di legno con tre frecce verso le zone (colori della punta: neve, giungla, mare)."""
    m = Mesh('cs_h_cartello')
    m.prism(5, 0.3, 0.25, 0, 0.25, 'p_pietra_scura', top='p_pietra')
    beam(m, (0, 0.2, 0), (0, 2.9, 0), 0.17, 0.17, 'p_legno_scuro')
    m.cone(4, 0.2, 2.9, 3.1, 'p_legno_scuro', a0=math.pi / 4)
    freccia = [(-0.15, -0.17), (1.15, -0.17), (1.45, 0.0), (1.15, 0.17), (-0.15, 0.17)]
    for y, ang, verso, punta in ((2.5, 0, 1, 'p_acqua_profonda'), (2.05, 160, 1, 'p_erba_scura'), (1.6, -25, 1, 'p_rosso')):
        m.push(Xf(t=(0, y, 0), r=(0, ang, 0)))
        for zz, s in ((-0.04, -1), (0.04, 1)):
            face(m, [(u, v, zz) for u, v in freccia], 'tavole', (0, 0, s))
            face(m, [(1.0, -0.17, zz + s * 0.005), (1.15, -0.17, zz + s * 0.005), (1.45, 0, zz + s * 0.005), (1.15, 0.17, zz + s * 0.005), (1.0, 0.17, zz + s * 0.005)], punta, (0, 0, s))
        for (u0, v0), (u1, v1) in zip(freccia, freccia[1:] + freccia[:1]):
            face(m, [(u0, v0, -0.04), (u1, v1, -0.04), (u1, v1, 0.04), (u0, v0, 0.04)], 'p_legno_scuro', (v1 - v0, -(u1 - u0), 0))
        m.pop()
    ciuffo(m, 0.25, 0.1, 0.3, 0.3, 'p_erba_scura', n=5)
    return _obj(m)


def _cono(m, x, z, h=0.75):
    m.box(x - 0.27, 0, z - 0.27, x + 0.27, 0.05, z + 0.27, 'p_nero_caldo', skip=('bottom',))
    k = h / 0.75
    tornio(m, [(0.05, 0.2), (0.3 * k, 0.15), (0.42 * k, 0.12), (0.55 * k, 0.085), (h, 0.035), (h, 0)],
           ['p_arancio', 'p_pietra_chiara', 'p_arancio', 'p_arancio', 'p_arancio'], n=8, cx=x, cz=z)


def cs_h_coni():
    """Quattro coni stradali arancio e bianchi, uno rovesciato."""
    m = Mesh('cs_h_coni')
    _cono(m, -0.55, -0.2)
    _cono(m, 0.35, -0.45)
    _cono(m, 0.05, 0.45)
    m.push(Xf(t=(1.0, 0.2, 0.25), r=(0, 30, 90)))
    _cono(m, 0, 0)
    m.pop()
    return _obj(m)


def _gomma(m, x, y, z, rot=None):
    if rot:
        m.push(Xf(t=(x, y, z), r=rot))
        x = y = z = 0.0
    tornio(m, [(y, 0.16), (y, 0.32), (y + 0.11, 0.36), (y + 0.24, 0.32), (y + 0.24, 0.16), (y, 0.16)],
           ['p_roccia', 'p_nero_caldo', 'p_nero_caldo', 'p_roccia', 'p_ombra_calda'], n=8, cx=x, cz=z)
    if rot:
        m.pop()


def cs_h_gomme():
    """Pila di gomme da corsa (tre impilate più una appoggiata)."""
    m = Mesh('cs_h_gomme')
    for k in range(3):
        _gomma(m, 0.02 * k, k * 0.24, -0.01 * k)
    _gomma(m, 0.72, 0.36, 0.05, rot=(0, 0, 70))
    return _obj(m)


def cs_h_casse():
    """Casse di legno e un barile."""
    m = Mesh('cs_h_casse')
    m.box(-0.5, 0, -0.5, 0.5, 1.0, 0.5, 'cassa', top='cassa', skip=('bottom',))
    m.push(Xf(t=(0.05, 1.0, 0.0), r=(0, 18, 0)))
    m.box(-0.33, 0, -0.33, 0.33, 0.66, 0.33, 'cassa', top='cassa', skip=('bottom',))
    m.pop()
    m.push(Xf(t=(0.95, 0, 0.2), r=(0, -12, 0)))
    m.box(-0.4, 0, -0.4, 0.4, 0.8, 0.4, 'cassa', top='cassa', skip=('bottom',))
    m.pop()
    m.prism(8, 0.36, 0.36, 0, 1.0, 'barile', top='taglio', cx=-0.9, cz=0.3)
    for y in (0.2, 0.8):
        m.prism(8, 0.38, 0.38, y, y + 0.07, 'p_nero_caldo', cx=-0.9, cz=0.3)
    return _obj(m)


def cs_h_lampione():
    """Lampione del paese (3,9 m): zoccolo di pietra, palo di legno scuro, lanterna a gabbia accesa, stendardo rosso col rombo d'oro."""
    m = Mesh('cs_h_lampione')
    m.box(-0.28, 0, -0.28, 0.28, 0.4, 0.28, 'p_pietra_scura', top='p_pietra', skip=('bottom',))
    beam(m, (0, 0.4, 0), (0, 3.25, 0), 0.17, 0.17, 'p_legno_scuro')
    m.box(-0.14, 3.15, -0.14, 0.14, 3.25, 0.14, 'p_nero_caldo')
    lanterna(m, 0, 3.25, 0, 1.25, 'em_faro')
    beam(m, (0.4, 3.45, 0), (0.4, 3.62, 0), 0.04, 0.04, 'p_nero_caldo')
    beam(m, (0, 2.65, 0), (0.75, 2.65, 0), 0.06, 0.06, 'p_nero_caldo')
    for s in (-1, 1):
        face(m, [(0.15, 2.62, 0), (0.7, 2.62, 0), (0.7, 1.45, 0), (0.425, 1.25, 0), (0.15, 1.45, 0)], 'p_rosso', (0, 0, s))
        face(m, [(0.425, 2.3, s * 0.01), (0.55, 2.05, s * 0.01), (0.425, 1.8, s * 0.01), (0.3, 2.05, s * 0.01)], 'p_giallo', (0, 0, s))
    return _obj(m)


# ------------------------------------------------------------------ molo
def cs_h_pontile():
    """Modulo di pontile: 4 m (X) x 8 m (Z) di tavole su pali; piano delle tavole a quota 0, i pali scendono in acqua fino a −3 m."""
    m = Mesh('cs_h_pontile')
    for i in range(10):
        z0 = -4.0 + i * 0.8
        j0, j1 = 0.12 * (0.5 - (i * 7 % 5) / 5), 0.12 * (0.5 - (i * 3 % 5) / 5)
        m.box(-2.0 + j0, -0.14, z0 + 0.03, 2.0 + j1, 0.0, z0 + 0.77, 'tavole', top='tavole', skip=('bottom',))
    for x in (-1.6, 1.6):
        beam(m, (x, -0.24, -4.0), (x, -0.24, 4.0), 0.22, 0.2, 'p_legno_scuro')
    for x in (-1.95, 1.95):
        for z in (-3.6, 0.0, 3.6):
            m.prism(6, 0.2, 0.2, -3.0, 0.3, 'p_legno_scuro', top='taglio', cx=x, cz=z)
        for za, zb in ((-3.6, 0.0), (0.0, 3.6)):
            beam(m, (x, -0.35, za), (x, -2.2, zb), 0.12, 0.12, 'p_legno_scuro')
    return _obj(m)


def cs_h_palo_luce():
    """Palo del pontile con la lanterna accesa (zero al piano delle tavole, scende 2,5 m in acqua)."""
    m = Mesh('cs_h_palo_luce')
    m.prism(6, 0.24, 0.22, -2.5, 1.15, 'corteccia', top='taglio')
    for y in (0.35, 0.7):
        m.prism(6, 0.27, 0.27, y, y + 0.12, 'corda')
    lanterna(m, 0, 1.15, 0, 1.25, 'em_faro')
    return _obj(m)


def cs_h_salvagente():
    """Salvagente a spicchi rossi e bianchi (diametro 0,8 m) in piedi; pivot a terra."""
    m = Mesh('cs_h_salvagente')
    R, r, N, k = 0.31, 0.095, 16, 4
    C = (0, R + r, 0)
    for i in range(N):
        a0, a1 = 2 * math.pi * i / N, 2 * math.pi * (i + 1) / N
        reg = 'p_rosso' if (i // 4) % 2 == 0 else 'p_pietra_chiara'
        for j in range(k):
            b0, b1 = 2 * math.pi * j / k + math.pi / 4, 2 * math.pi * (j + 1) / k + math.pi / 4
            P = lambda a, b: (C[0] + math.cos(a) * (R + r * math.cos(b)), C[1] + math.sin(a) * (R + r * math.cos(b)), r * math.sin(b))
            am, bm = (a0 + a1) / 2, (b0 + b1) / 2
            nrm = (math.cos(am) * math.cos(bm), math.sin(am) * math.cos(bm), math.sin(bm))
            face(m, [P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1)], reg, nrm)
    return _obj(m)


# ------------------------------------------------------------------ porte delle zone
L = 6.0  # metà della luce interna (12 m)


def cs_h_porta_spiaggia():
    """Porta della Spiaggia: tronchi di legno legati con la corda, traverse, insegna blu con l'onda, lanterne, gavitelli e una rete."""
    m = Mesh('cs_h_porta_spiaggia')
    for s in (-1, 1):
        x = s * (L + 0.7)
        for zz in (-0.45, 0.45):
            tubo(m, [(x, 0, zz), (x + s * 0.05, 4.0, zz), (x, 8.0, zz)], [0.42, 0.38, 0.36], 'corteccia', n=7, cap1='taglio')
            for y in (1.2, 5.4):
                m.prism(7, 0.45, 0.45, y, y + 0.3, 'corda', cx=x + s * 0.03, cz=zz)
        m.box(x - 0.75, 0, -1.2, x + 0.75, 0.5, 1.2, 'p_pietra_scura', top='p_pietra', skip=('bottom',))
        lanterna(m, x, 8.0, -0.45, 1.3, 'em_faro')
        lanterna(m, x, 8.0, 0.45, 1.3, 'em_faro')
        tubo(m, [(x - s * 0.1, 3.5, -0.1), (x - s * 2.0, 6.4, -0.1)], [0.2, 0.2], 'corteccia', n=6, cap0='taglio', cap1='taglio')  # puntone
        # gavitello appeso
        beam(m, (x - s * 0.5, 6.3, -0.85), (x - s * 0.5, 5.6, -0.85), 0.03, 0.03, 'corda')
        tornio(m, [(5.1, 0), (5.1, 0.12), (5.3, 0.25), (5.45, 0.25), (5.6, 0.1), (5.6, 0)], ['p_pietra_chiara', 'p_rosso', 'p_pietra_chiara', 'p_rosso', 'p_rosso'], n=6, cx=x - s * 0.5, cz=-0.85)
    tubo(m, [(-L - 1.6, 6.9, 0), (0, 7.05, 0), (L + 1.6, 6.9, 0)], [0.45, 0.45, 0.45], 'corteccia', n=8, cap0='taglio', cap1='taglio')
    tubo(m, [(-L - 0.7, 6.1, -0.2), (L + 0.7, 6.1, -0.2)], [0.25, 0.25], 'corteccia', n=6, cap0='taglio', cap1='taglio')
    for s in (-1, 1):
        m.prism(7, 0.5, 0.5, 6.85, 7.25, 'corda', cx=s * (L + 0.7))
    insegna(m, 0, 7.45, 5.4, 2.7, 0.0, 'cs_h_ins_onda', cornice='p_legno', spess=0.25)
    for s in (-1, 1):
        beam(m, (s * 2.4, 7.3, 0), (s * 2.4, 7.5, 0), 0.2, 0.3, 'corda')
    # rete da pesca appesa a un fianco
    x0, zz = -(L + 1.1), -0.5
    for nrm in ((0, 0, -1), (0, 0, 1)):
        face(m, [(x0, 1.6, zz), (x0 - 1.7, 2.1, zz), (x0 - 1.5, 4.4, zz), (x0, 4.6, zz)], 'rete', nrm)
    return _obj(m)


def cs_h_porta_ghiaccio():
    """Porta del Ghiaccio: legno scuro su zoccoli di pietra, tettuccio a due falde carico di neve, ghiaccioli, insegna col fiocco, lanterne."""
    m = Mesh('cs_h_porta_ghiaccio')
    for s in (-1, 1):
        x = s * (L + 0.7)
        muro(m, x - 0.9, 0, -0.9, x + 0.9, 1.4, 0.9, 'pietra_muro', top='cs_h_neve', passo=2.0)
        m.box(x - 0.55, 1.4, -0.55, x + 0.55, 7.0, 0.55, 'tavole_scure', top='p_legno_scuro', skip=('bottom',))
        for y in (2.0, 4.5):
            m.box(x - 0.6, y, -0.6, x + 0.6, y + 0.22, 0.6, 'p_nero_caldo')
        tubo(m, [(x - s * 0.5, 4.2, 0), (x - s * 2.2, 6.3, 0)], [0.18, 0.18], 'p_legno_scuro', n=4)
        lanterna(m, x - s * 0.62, 3.2, -0.75, 1.2, 'em_faro')
        beam(m, (x - s * 0.55, 3.95, -0.4), (x - s * 0.62, 3.95, -0.75), 0.06, 0.06, 'p_nero_caldo')
        ciuffo(m, x, 1.35, 0, 0.95, 'cs_h_neve', ry=0.35)
    m.box(-L - 1.6, 6.3, -0.7, L + 1.6, 7.1, 0.7, 'tavole_scure', top='p_legno_scuro')
    # tettuccio con la neve
    Y0, Y1, E = 7.1, 8.4, 1.5
    for s in (-1, 1):
        A, B, C, D = (-L - 2.0, Y0 - 0.1, s * E), (L + 2.0, Y0 - 0.1, s * E), (L + 2.0, Y1, 0), (-L - 2.0, Y1, 0)
        face(m, [A, B, C, D], 'p_legno_scuro', (0, -1, -s * 0.5))
        A2, B2, C2, D2 = [(p[0], p[1] + 0.35, p[2]) for p in (A, B, C, D)]
        griglia(m, A2, B2, C2, D2, 'cs_h_neve', (0, 1, s * 0.5))
        face(m, [A, B, B2, A2], 'cs_h_neve', (0, -0.3, s))
    for xx, s in ((-L - 2.0, -1), (L + 2.0, 1)):
        face(m, [(xx, Y0 - 0.1, -E), (xx, Y0 - 0.1, E), (xx, Y0 + 0.25, E), (xx, Y1 + 0.35, 0), (xx, Y0 + 0.25, -E)], 'cs_h_neve', (s, 0, 0))
    for k in range(13):  # ghiaccioli
        x = -L - 1.4 + k * (2 * L + 2.8) / 12
        lung = 0.4 + 0.5 * ((k * 7) % 5) / 4
        for zz in (-1.45, 1.45):
            tornio(m, [(Y0 - 0.1 - lung, 0), (Y0 - 0.1, 0.1)], 'p_acqua_bassa', n=4, cx=x, cz=zz)
    insegna(m, 0, 3.75, 4.8, 2.4, 0.0, 'cs_h_ins_neve', cornice='p_legno_scuro', spess=0.3)
    return _obj(m)


def _torcia(m, x, y, z, s=1.0):
    tornio(m, [(y, 0), (y, 0.12 * s), (y + 0.3 * s, 0.36 * s), (y + 0.42 * s, 0.4 * s), (y + 0.42 * s, 0.3 * s), (y + 0.36 * s, 0)], ['p_roccia', 'p_roccia', 'p_nero_caldo', 'p_roccia', 'p_ombra_calda'], n=6, cx=x, cz=z)
    tornio(m, [(y + 0.3 * s, 0), (y + 0.3 * s, 0.3 * s), (y + 0.75 * s, 0.24 * s), (y + 1.35 * s, 0)], ('em_fuoco', EM), n=5, cx=x, cz=z, a0=0.3)


def cs_h_porta_giungla():
    """Porta della Giungla: pilastri di pietra muschiata a blocchi sfalsati, architrave coi glifi, bracieri accesi, liane, insegna con la foglia."""
    m = Mesh('cs_h_porta_giungla')
    for s in (-1, 1):
        x = s * (L + 0.9)
        muro(m, x - 1.1, 0, -1.1, x + 1.1, 1.0, 1.1, 'cs_h_tempio', top='muschio', passo=2.2)
        y = 1.0
        for k, (h, w, dx) in enumerate(((2.2, 0.85, 0.06), (2.0, 0.8, -0.08), (1.9, 0.82, 0.05))):
            muro(m, x - w + dx, y, -w, x + w + dx, y + h, w, 'cs_h_tempio', top='muschio', passo=2.0)
            y += h
        muro(m, x - 1.1, y, -1.1, x + 1.1, y + 0.55, 1.1, 'cs_h_glifi', top='muschio', passo=2.2)
        _torcia(m, x, y + 0.55, 0, 1.3)
        ciuffo(m, x + s * 0.6, 1.05, -0.7, 0.55, 'p_erba_scura')
        ciuffo(m, x - s * 0.3, 1.0, 0.8, 0.45, 'p_erba')
    YL = 6.5
    muro(m, -L - 2.0, YL, -1.2, L + 2.0, YL + 1.2, 1.2, 'cs_h_glifi', top='muschio', passo=2.4)
    for xx in (-L - 0.6, -3.2, 1.0, 3.6, L + 0.4):  # liane
        lung = 1.6 + ((int(xx * 10) % 7) / 7) * 1.6
        for zz, s in ((-1.25, -1), (1.25, 1)):
            face(m, [(xx - 0.12, YL + 0.4, zz), (xx + 0.12, YL + 0.4, zz), (xx + 0.22, YL - lung, zz), (xx + 0.02, YL - lung, zz)], 'p_erba_scura', (0, 0, s))
            face(m, [(xx + 0.1, YL - lung * 0.5, zz + s * 0.01), (xx + 0.42, YL - lung * 0.5 + 0.12, zz + s * 0.01), (xx + 0.14, YL - lung * 0.5 - 0.22, zz + s * 0.01)], 'p_erba', (0, 0, s))
    for xx in (-L - 1.2, -1.5, 2.5, L + 1.0):
        ciuffo(m, xx, YL + 1.2, 0.2, 0.75, 'p_erba_scura', ry=0.4)
    insegna(m, 0, YL + 1.25, 5.0, 2.5, 0.0, 'cs_h_ins_foglia', cornice='p_pietra_scura', spess=0.4, bordo=0.25)
    return _obj(m)


def cs_h_porta_neon():
    """Porta della città al Neon: pilastri di metallo scuro con le cornici al neon viola e ciano, insegne verticali, insegna della città accesa."""
    m = Mesh('cs_h_porta_neon')
    for s in (-1, 1):
        x = s * (L + 0.75)
        muro(m, x - 0.75, 0, -0.75, x + 0.75, 7.6, 0.75, 'metallo', top='p_nero_caldo', passo=2.0)
        m.box(x - 0.95, 0, -0.95, x + 0.95, 0.5, 0.95, 'p_nero_caldo', top='p_roccia', skip=('bottom',))
        for zz in (-0.8, 0.8):
            for xx in (x - 0.8, x + 0.8):
                beam(m, (xx, 0.5, zz), (xx, 7.6, zz), 0.1, 0.1, 'em_neon_viola' if s * (xx - x) < 0 else 'em_neon_ciano', mat=EM)
        for y in (2.4, 4.6):
            m.box(x - 0.82, y, -0.82, x + 0.82, y + 0.12, 0.82, 'em_neon_ciano', mat=EM, skip=('top', 'bottom'))
        # insegna verticale sul fianco esterno
        xs = x + s * 0.78
        for nrm in ((s, 0, 0),):
            face(m, [(xs, 2.6, 0.5), (xs, 2.6, -0.5), (xs, 6.4, -0.5), (xs, 6.4, 0.5)][::(1 if s > 0 else -1)], 'em_h_insegna_v', nrm, uv='fit', mat=EM)
        # faretti in cima
        m.box(x - 0.4, 7.6, -0.4, x + 0.4, 7.85, 0.4, 'p_roccia')
        tubo(m, [(x, 7.95, 0), (x, 8.2, -0.35)], [0.16, 0.22], 'p_roccia', n=6, cap1='em_h_bianco', mat=None)
    m.box(-L - 1.5, 6.5, -0.7, L + 1.5, 7.6, 0.7, 'p_nero_caldo', top='p_roccia')
    for zz in (-0.75, 0.75):
        for y in (6.55, 7.55):
            beam(m, (-L - 1.5, y, zz), (L + 1.5, y, zz), 0.1, 0.1, 'em_neon_viola' if y < 7 else 'em_neon_ciano', mat=EM)
    m.box(-3.1, 7.6, -0.25, 3.1, 10.5, 0.25, 'p_nero_caldo')
    for zz, nrm in ((-0.27, (0, 0, -1)), (0.27, (0, 0, 1))):
        face(m, [(-2.9, 7.75, zz), (2.9, 7.75, zz), (2.9, 10.35, zz), (-2.9, 10.35, zz)], 'em_h_citta', nrm, uv='fit', mat=EM)
    for s in (-1, 1):
        beam(m, (s * 3.15, 7.6, -0.3), (s * 3.15, 10.5, -0.3), 0.1, 0.1, 'em_neon_viola', mat=EM)
    beam(m, (0, 10.5, 0), (0, 11.6, 0), 0.07, 0.07, 'p_roccia')
    sfera(m, 0, 11.65, 0, 0.12, reg='em_neon_rosso', n=4, rings=1)
    return _obj(m)


def cs_h_porta_lunapark():
    """Porta del Luna park: torrette tonde a strisce rosse e gialle coi cappelli blu e le bandierine, file di lampadine, insegna col tendone."""
    m = Mesh('cs_h_porta_lunapark')
    for s in (-1, 1):
        x = s * (L + 1.0)
        tornio(m, [(0, 0), (0, 1.15), (0.5, 1.15), (0.5, 0.95), (6.4, 0.95), (6.4, 1.2), (6.7, 1.2), (6.7, 0.0)],
               ['p_pietra_scura', 'p_pietra_scura', 'p_giallo', 'cs_h_strisce_rg', 'p_giallo', 'p_giallo', 'p_acqua_profonda'], n=10, cx=x)
        tornio(m, [(5.7, 0.97), (6.2, 0.97)], ('em_h_lampadine', EM), n=10, cx=x)
        tornio(m, [(2.0, 0.97), (2.4, 0.97)], ('em_h_lampadine', EM), n=10, cx=x)
        tornio(m, [(6.7, 0), (6.7, 1.3), (7.0, 1.2), (8.8, 0)], ['p_acqua_profonda', 'p_giallo', 'p_acqua_profonda'], n=10, cx=x)
        beam(m, (x, 8.7, 0), (x, 9.9, 0), 0.06, 0.06, 'p_nero_caldo')
        face(m, [(x, 9.85, 0), (x + 0.9, 9.6, 0), (x, 9.35, 0)], 'p_giallo', (0, 0, -1))
        face(m, [(x, 9.85, 0), (x + 0.9, 9.6, 0), (x, 9.35, 0)], 'p_giallo', (0, 0, 1))
        sfera(m, x, 9.95, 0, 0.1, reg='p_rosso', n=4, rings=1)
    muro(m, -L - 0.2, 5.2, -0.6, L + 0.2, 6.6, 0.6, 'cs_h_strisce_rg', top='p_giallo', passo=2.0)
    m.box(-L - 0.2, 6.6, -0.65, L + 0.2, 6.8, 0.65, 'p_giallo')
    for zz, nrm in ((-0.62, (0, 0, -1)), (0.62, (0, 0, 1))):
        griglia(m, (-L, 5.3, zz), (L, 5.3, zz), (L, 5.6, zz), (-L, 5.6, zz), 'em_h_lampadine', nrm, passo=2.0, mat=EM)
    # festoni a punte sotto l'architrave
    for k in range(10):
        x0, x1 = -L + k * 1.2, -L + (k + 1) * 1.2
        for zz, nrm in ((-0.6, (0, 0, -1)), (0.6, (0, 0, 1))):
            face(m, [(x0, 5.2, zz), (x1, 5.2, zz), ((x0 + x1) / 2, 4.65, zz)], 'p_rosso' if k % 2 else 'p_giallo', nrm)
    insegna(m, 0, 6.85, 5.0, 2.5, 0.0, 'cs_h_ins_tendone', cornice='p_giallo', spess=0.3, bordo=0.2)
    for s in (-1, 1):
        for zz, nrm in ((-0.17, (0, 0, -1)), (0.17, (0, 0, 1))):
            face(m, [(s * 2.7, 6.65, zz), (s * 2.7 - s * 0.25, 6.65, zz), (s * 2.7 - s * 0.25, 9.55, zz), (s * 2.7, 9.55, zz)][::s], ('em_h_lampadine'), nrm, mat=EM, uv='fit')
    bandierine(m, (-L - 1.0, 8.6, 0), (-2.6, 8.2, 0), 5, sag=0.5, h=0.45)
    bandierine(m, (2.6, 8.2, 0), (L + 1.0, 8.6, 0), 5, sag=0.5, h=0.45)
    return _obj(m)


def cs_h_porta_fondale():
    """Porta del Fondale: pilastri di corallo coi rami, architrave di corallo arcuato, conchiglie giganti, stelle marine, bolle, insegna nuvola e pesce."""
    m = Mesh('cs_h_porta_fondale')
    for s in (-1, 1):
        x = s * (L + 0.9)
        tubo(m, [(x, 0, 0), (x + s * 0.3, 2.2, 0.1), (x - s * 0.1, 4.6, -0.1), (x + s * 0.1, 6.6, 0)], [1.05, 0.85, 0.8, 0.85], 'cs_h_corallo', n=8)
        tubo(m, [(x + s * 0.5, 3.2, 0), (x + s * 1.5, 4.4, -0.2), (x + s * 1.9, 5.9, 0)], [0.35, 0.28, 0.18], 'cs_h_corallo', n=6, cap1='p_arancio')
        tubo(m, [(x - s * 0.2, 5.4, 0.4), (x + s * 0.6, 6.6, 1.2), (x + s * 0.7, 7.8, 1.3)], [0.3, 0.24, 0.15], 'cs_h_corallo', n=6, cap1='p_arancio')
        # conchiglia a ventaglio alla base
        cx, cz = x + s * 0.2, -1.05
        for k in range(7):
            a0, a1 = math.radians(20 + k * 20), math.radians(20 + (k + 1) * 20)
            am = (a0 + a1) / 2
            p0 = (cx + math.cos(a0) * 1.25, 0.05 + math.sin(a0) * 1.25, cz - 0.1)
            p1 = (cx + math.cos(a1) * 1.25, 0.05 + math.sin(a1) * 1.25, cz - 0.1)
            pm = (cx + math.cos(am) * 1.3, 0.05 + math.sin(am) * 1.3, cz - 0.3)
            o = (cx, 0.05, cz)
            reg = 'p_pietra_chiara' if k % 2 == 0 else 'p_sabbia_chiara'
            face(m, [o, p0, pm], reg, (0, 0, -1))
            face(m, [o, pm, p1], 'p_sabbia', (0, 0, -1))
        face(m, [(cx - 1.3, 0.05, cz + 0.05), (cx + 1.3, 0.05, cz + 0.05), (cx, 1.4, cz + 0.05)], 'p_sabbia', (0, 0, 1))
        # stella marina sul pilastro
        sx, sy, sz = x - s * 0.4, 3.3, -0.92
        for k in range(5):
            a = math.radians(90 + k * 72)
            b0, b1 = math.radians(90 + k * 72 - 36), math.radians(90 + k * 72 + 36)
            tip = (sx + math.cos(a) * 0.6, sy + math.sin(a) * 0.6, sz)
            q0 = (sx + math.cos(b0) * 0.2, sy + math.sin(b0) * 0.2, sz)
            q1 = (sx + math.cos(b1) * 0.2, sy + math.sin(b1) * 0.2, sz)
            face(m, [q0, tip, q1, (sx, sy, sz - 0.08)], 'p_arancio', (0, 0, -1))
    tubo(m, [(-L - 1.9, 6.4, 0), (-L, 7.2, 0), (-3, 7.7, 0), (0, 7.85, 0), (3, 7.7, 0), (L, 7.2, 0), (L + 1.9, 6.4, 0)], [0.7, 0.75, 0.7, 0.7, 0.7, 0.75, 0.7], 'cs_h_corallo', n=8)
    insegna(m, 0, 8.2, 5.0, 2.5, 0.0, 'cs_h_ins_fondale', cornice='p_arancio', spess=0.3, bordo=0.2)
    for k in range(6):  # perle sulla cornice
        x = -2.5 + k * 1.0
        sfera(m, x, 10.85, 0, 0.16, reg='p_pietra_chiara', n=5, rings=2)
    for (x, y, r) in ((-3.6, 9.4, 0.3), (-4.2, 10.4, 0.2), (3.8, 9.8, 0.25), (4.3, 10.9, 0.18), (-4.6, 11.2, 0.13)):
        sfera(m, x, y, -0.2, r, reg='p_acqua_bassa', n=5, rings=2)
    return _obj(m)


def cs_h_sbarra():
    """Sbarramento della porta chiusa (12 m di luce): assi di legno incrociate, catena col lucchetto grande, cartello CHIUSO."""
    m = Mesh('cs_h_sbarra')
    for a, b in (((-L, 0.6), (L, 3.9)), ((-L, 3.9), (L, 0.6))):
        beam(m, (a[0], a[1], 0.12 if a[1] < b[1] else -0.12), (b[0], b[1], 0.12 if a[1] < b[1] else -0.12), 0.12, 0.55, 'tavole', end='p_legno_scuro')
    beam(m, (-L, 2.25, -0.25), (L, 2.25, -0.25), 0.12, 0.6, 'tavole', end='p_legno_scuro')
    for x in (-L + 0.2, L - 0.2):
        m.box(x - 0.25, 0, -0.35, x + 0.25, 4.4, 0.35, 'p_legno_scuro', top='taglio')
    # catena a maglie fino al lucchetto
    for s in (-1, 1):
        n = 9
        for k in range(n):
            t0, t1 = k / n, (k + 1) / n
            P = lambda t: (s * (L - 0.2) * (1 - t), 3.4 - 1.6 * t - 0.6 * math.sin(math.pi * t), -0.45)
            p0, p1 = P(t0), P(t1)
            w, h = (0.16, 0.05) if k % 2 == 0 else (0.05, 0.16)
            beam(m, p0, p1, w, h, 'p_pietra_scura')
    tubo(m, [(-0.3, 1.8, -0.5), (-0.3, 2.15, -0.5), (0, 2.4, -0.5), (0.3, 2.15, -0.5), (0.3, 1.8, -0.5)], [0.08] * 5, 'p_pietra', n=6)
    m.box(-0.5, 0.95, -0.7, 0.5, 1.85, -0.3, 'p_giallo', top='p_arancio')
    face(m, [(-0.08, 1.15, -0.72), (0.08, 1.15, -0.72), (0.08, 1.55, -0.72), (-0.08, 1.55, -0.72)], 'p_nero_caldo', (0, 0, -1))
    insegna(m, 2.3, 2.7, 2.6, 1.3, -0.45, 'cs_h_chiuso', cornice='p_legno_scuro', spess=0.12, bordo=0.1)
    return _obj(m)


# ------------------------------------------------------------------ vegetazione e rocce
def cs_h_palma():
    """Palma alta e curva (8 m) con due giri di foglie e le noci di cocco."""
    m = Mesh('cs_h_palma')
    pts = [(0, 0, 0), (0.25, 2.0, 0.05), (0.85, 4.0, 0.15), (1.7, 5.9, 0.2), (2.4, 7.3, 0.2)]
    tubo(m, pts, [0.32, 0.25, 0.22, 0.2, 0.18], 'tronco_palma', n=6)
    T = (2.4, 7.4, 0.2)
    for giro, (k, L1, L2, alza, cade, w) in enumerate(((9, 1.6, 3.5, 0.45, -1.7, 0.55), (6, 1.1, 2.4, 0.7, -0.5, 0.42))):
        for i in range(k):
            a = 2 * math.pi * (i + 0.5 * giro) / k
            d = (math.cos(a), 0, math.sin(a))
            p = (-d[2], 0, d[0])
            P1 = (T[0] + d[0] * L1, T[1] + alza, T[2] + d[2] * L1)
            P2 = (T[0] + d[0] * L2, T[1] + cade, T[2] + d[2] * L2)
            e1a, e1b = _add(P1, _mul(p, w)), _add(P1, _mul(p, -w))
            e1a, e1b = (e1a[0], e1a[1] + 0.15, e1a[2]), (e1b[0], e1b[1] + 0.15, e1b[2])
            for reg, sg in (('foglia_palma', 1), ('p_erba_scura', -1)):
                face(m, [T, e1a, P1], reg, (0, sg, 0))
                face(m, [T, P1, e1b], reg, (0, sg, 0))
                face(m, [e1a, P2, P1], reg, (0, sg, 0))
                face(m, [P1, P2, e1b], reg, (0, sg, 0))
    for k in range(3):
        a = k * 2.1
        sfera(m, T[0] + math.cos(a) * 0.3, T[1] - 0.3, T[2] + math.sin(a) * 0.3, 0.2, reg='p_legno', n=5, rings=2)
    return _obj(m)


def cs_h_albero():
    """Albero a chioma tonda (5 m): tronco con un ramo e tre palle di foglie."""
    m = Mesh('cs_h_albero')
    tubo(m, [(0, 0, 0), (0.1, 1.5, 0), (0, 2.6, 0.1)], [0.28, 0.2, 0.15], 'corteccia', n=6)
    tubo(m, [(0.08, 1.7, 0), (0.8, 2.5, 0.2)], [0.1, 0.06], 'corteccia', n=4)
    sfera(m, 0, 3.55, 0, 1.6, 1.35, 1.5, 'p_erba', n=8, rings=3)
    sfera(m, 0.95, 2.95, 0.4, 1.0, 0.85, 1.0, 'p_erba_scura', n=7, rings=3)
    sfera(m, -0.85, 3.0, -0.35, 1.05, 0.9, 1.0, 'p_erba_scura', n=7, rings=3)
    sfera(m, 0.5, 3.9, -0.9, 0.9, 0.8, 0.8, 'p_erba', n=6, rings=3)
    return _obj(m)


def cs_h_pino_neve():
    """Abete innevato (6 m): tre palchi verdi scuri con la neve sopra."""
    m = Mesh('cs_h_pino_neve')
    m.prism(6, 0.22, 0.18, 0, 1.2, 'corteccia')
    for y0, R, h in ((0.9, 1.9, 2.3), (2.4, 1.45, 2.0), (3.8, 1.0, 2.0)):
        tornio(m, [(y0, 0), (y0, R), (y0 + h * 0.4, R * 0.62), (y0 + h * 0.48, R * 0.6), (y0 + h, 0)],
               ['p_bosco_ombra', 'p_bosco', 'cs_h_neve', 'cs_h_neve'], n=7)
    return _obj(m)


def cs_h_albero_giungla():
    """Albero della giungla (9 m): tronco con le radici a contrafforte, chioma larga a due piani, liane."""
    m = Mesh('cs_h_albero_giungla')
    tubo(m, [(0, 0, 0), (0.2, 3.0, 0.1), (-0.2, 6.0, 0), (0.1, 7.6, 0)], [0.5, 0.38, 0.32, 0.25], 'corteccia', n=7)
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        d = (math.cos(a), 0, math.sin(a))
        p0, p1, p2 = (d[0] * 0.3, 2.2, d[2] * 0.3), (d[0] * 1.5, 0, d[2] * 1.5), (d[0] * 0.3, 0, d[2] * 0.3)
        nrm = (-d[2], 0, d[0])
        face(m, [p0, p1, p2], 'corteccia', nrm)
        face(m, [p0, p1, p2], 'corteccia', _mul(nrm, -1))
    tubo(m, [(0.0, 5.0, 0), (1.8, 6.3, 0.4)], [0.18, 0.1], 'corteccia', n=4)
    tubo(m, [(-0.1, 5.6, 0), (-1.9, 6.8, -0.3)], [0.16, 0.1], 'corteccia', n=4)
    sfera(m, 0.1, 8.0, 0, 3.2, 1.0, 3.0, 'p_bosco', n=9, rings=2)
    sfera(m, 0.2, 8.7, 0.1, 2.2, 0.8, 2.1, 'p_erba_scura', n=8, rings=2)
    sfera(m, 1.9, 6.6, 0.4, 1.4, 0.6, 1.3, 'p_erba_scura', n=7, rings=2)
    sfera(m, -2.0, 7.1, -0.3, 1.5, 0.6, 1.4, 'p_bosco', n=7, rings=2)
    for (x, z, lung) in ((2.4, 0.6, 3.0), (-2.3, -0.6, 2.6), (0.9, -2.2, 3.4), (-1.0, 2.0, 2.2)):
        for nrm in ((0, 0, -1), (0, 0, 1)):
            face(m, [(x - 0.07, 7.4, z), (x + 0.07, 7.4, z), (x + 0.12, 7.4 - lung, z), (x - 0.02, 7.4 - lung, z)], 'p_erba_scura', nrm)
    for k in range(5):  # felci alla base
        a = k * 2 * math.pi / 5 + 0.3
        d = (math.cos(a), 0, math.sin(a))
        p = (-d[2], 0, d[0])
        b = _mul(d, 0.6)
        tip = (d[0] * 1.9, 0.25, d[2] * 1.9)
        mid = (d[0] * 1.2, 0.9, d[2] * 1.2)
        for sg in (1, -1):
            face(m, [b, _add(mid, _mul(p, 0.35)), tip, _add(mid, _mul(p, -0.35))], 'foglia_palma' if sg > 0 else 'p_bosco', (0, sg, 0))
    return _obj(m)


def cs_h_cespuglio():
    """Cespuglio fiorito: tre palle di foglie e fiori rossi, gialli e bianchi."""
    m = Mesh('cs_h_cespuglio')
    for (x, y, z, r, reg) in ((0, 0.45, 0, 0.75, 'p_erba_scura'), (0.65, 0.35, 0.2, 0.55, 'p_erba'), (-0.6, 0.35, -0.15, 0.55, 'p_erba')):
        sfera(m, x, y, z, r, r * 0.8, r, reg, n=7, rings=3)
    fiori = ('p_rosso', 'p_giallo', 'p_pietra_chiara', 'p_viola')
    for k in range(12):
        a = k * 2.399
        rr = 0.35 + 0.35 * ((k * 5) % 7) / 7
        x, z = math.cos(a) * rr, math.sin(a) * rr * 0.8
        y = 0.45 + 0.6 * math.sqrt(max(0.0, 1 - (rr / 0.95) ** 2)) + 0.02
        sfera(m, x, y + 0.04, z, 0.1, reg=fiori[k % 4], n=4, rings=1)
    return _obj(m)


def cs_h_roccia_a():
    """Masso grande con la cima muschiata e i ciuffi d'erba alla base."""
    m = Mesh('cs_h_roccia_a')
    _sasso(m, 0, 0, 2.0, 2.6, 1.7, 61, n=8)
    _sasso(m, 1.7, 0.8, 0.9, 1.0, 0.8, 62, n=6)
    ciuffo(m, -1.5, 0.15, 0.9, 0.5, 'p_erba_scura')
    ciuffo(m, 1.0, 0.1, -1.3, 0.4, 'p_erba')
    for (x, z) in ((-1.9, -0.6), (0.6, -1.7), (2.2, -0.3)):
        m.cone(3, 0.25, 0, 0.45, 'p_erba', cx=x, cz=z)
    return _obj(m)


def cs_h_roccia_b():
    """Gruppo di tre sassi chiari."""
    m = Mesh('cs_h_roccia_b')
    _sasso(m, 0, 0, 1.2, 1.1, 1.1, 63, n=7)
    _sasso(m, 1.3, 0.4, 0.7, 0.6, 0.6, 64, n=6)
    _sasso(m, -1.0, 0.7, 0.55, 0.5, 0.5, 65, n=5)
    return _obj(m)


# ------------------------------------------------------------------ quartieri
def cs_h_tempio():
    """Tempio della giungla (20 m): piramide a gradoni con la faccia di pietra (occhi di fuoco, bocca-galleria), scalinata, sacrario, bracieri, liane."""
    m = Mesh('cs_h_tempio')
    S, TOP = 'cs_h_tempio', 'muschio'
    # gradone 0 con la faccia sul davanti (apertura della bocca x ±3, y 0-3,4)
    X0, Z0, H0, BX, BH = 10.0, 8.0, 7.5, 3.2, 3.8
    griglia(m, (-BX, 0, -Z0), (-X0, 0, -Z0), (-X0, H0, -Z0), (-BX, H0, -Z0), S, (0, 0, -1))
    griglia(m, (X0, 0, -Z0), (BX, 0, -Z0), (BX, H0, -Z0), (X0, H0, -Z0), S, (0, 0, -1))
    griglia(m, (BX, BH, -Z0), (-BX, BH, -Z0), (-BX, H0, -Z0), (BX, H0, -Z0), 'cs_h_glifi', (0, 0, -1))
    muro(m, -X0, 0, -Z0, X0, H0, Z0, S, top=TOP, skip=('bottom', 'front'))
    # bocca: galleria buia, denti, labbro
    for xx, s in ((-BX, 1), (BX, -1)):
        face(m, [(xx, 0, -Z0), (xx, 0, -Z0 + 3), (xx, BH, -Z0 + 3), (xx, BH, -Z0)], 'p_roccia', (s, 0, 0))
    face(m, [(-BX, BH, -Z0), (BX, BH, -Z0), (BX, BH, -Z0 + 3), (-BX, BH, -Z0 + 3)], 'p_roccia', (0, -1, 0))
    face(m, [(-BX, 0, -Z0 + 3), (BX, 0, -Z0 + 3), (BX, BH, -Z0 + 3), (-BX, BH, -Z0 + 3)], 'p_nero_caldo', (0, 0, -1))
    m.box(-BX - 0.6, BH, -Z0 - 0.7, BX + 0.6, BH + 0.7, -Z0, S, top=TOP, skip=('back',))
    for k in range(5):
        x = -BX + 0.55 + k * (2 * BX - 1.1) / 4
        m.box(x - 0.35, BH - 0.65, -Z0 - 0.45, x + 0.35, BH, -Z0 - 0.05, 'p_pietra_chiara', skip=('top', 'back'))
    for s in (-1, 1):
        m.box(s * BX - 0.5 if s > 0 else -BX - 0.3, 0, -Z0 - 0.6, s * BX + 0.3 if s > 0 else -BX + 0.5, BH, -Z0, S, top=TOP, skip=('back', 'bottom'))
    # naso, occhi di fuoco nelle orbite, sopracciglia arrabbiate
    m.box(-0.8, BH + 0.7, -Z0 - 1.1, 0.8, 6.0, -Z0, S, top=TOP, skip=('back',))
    m.box(-1.2, BH + 0.7, -Z0 - 1.2, 1.2, BH + 1.1, -Z0, S, top=TOP, skip=('back',))
    for s in (-1, 1):
        ex0, ex1 = sorted((s * 1.2, s * 3.8))
        m.box(ex0 - 0.3, 4.75, -Z0 - 0.45, ex1 + 0.3, 4.95, -Z0, 'p_roccia', skip=('back',))
        for xx in (ex0 - 0.3, ex1):
            m.box(xx, 4.75, -Z0 - 0.45, xx + 0.3, 6.4, -Z0, 'p_roccia', skip=('back',))
        face(m, [(ex0, 4.95, -Z0 - 0.05), (ex1, 4.95, -Z0 - 0.05), (ex1, 6.4, -Z0 - 0.05), (ex0, 6.4, -Z0 - 0.05)], 'em_fuoco', (0, 0, -1), mat=EM)
        face(m, [((ex0 + ex1) / 2 - 0.35, 5.3, -Z0 - 0.08), ((ex0 + ex1) / 2 + 0.35, 5.3, -Z0 - 0.08), ((ex0 + ex1) / 2 + 0.35, 6.0, -Z0 - 0.08), ((ex0 + ex1) / 2 - 0.35, 6.0, -Z0 - 0.08)], 'em_neon_ambra', (0, 0, -1), mat=EM)
        bi, be = (s * 0.9, 6.3), (s * 4.3, 7.0)
        A, B = (bi[0], bi[1], -Z0 - 0.8), (be[0], be[1], -Z0 - 0.8)
        C, D = (be[0], be[1] + 0.75, -Z0 - 0.8), (bi[0], bi[1] + 0.75, -Z0 - 0.8)
        face(m, [A, B, C, D], S, (0, 0, -1))
        face(m, [D, C, (C[0], C[1], -Z0), (D[0], D[1], -Z0)], TOP, (0, 1, 0))
        face(m, [A, B, (B[0], B[1], -Z0), (A[0], A[1], -Z0)], 'p_roccia', (0, -1, 0))
    # gradoni superiori e scalinata
    tiers = ((8.0, -6.0, 7.5, 7.5, 11.0), (6.0, -4.0, 6.5, 11.0, 14.5), (4.2, -2.0, 5.5, 14.5, 17.5))
    for x, z0, z1, y0, y1 in tiers:
        muro(m, -x, y0, z0, x, y1, z1, S, top=TOP)
        for xx in (-x + 1.0, x - 1.6):  # liane dal bordo
            for zz in ((z0 - 0.02),):
                face(m, [(xx, y1, zz), (xx + 0.3, y1, zz), (xx + 0.4, y1 - 2.2, zz), (xx + 0.2, y1 - 2.2, zz)], 'p_erba_scura', (0, 0, -1))
    # scalinata unica dal gradone 0 al sacrario, davanti ai gradoni
    STX, NS = 1.7, 20
    za, ya, zb, yb = -7.6, H0, 0.0, 17.5
    for i in range(NS):
        y0, y1 = ya + (yb - ya) * i / NS, ya + (yb - ya) * (i + 1) / NS
        z0, z1 = za + (zb - za) * i / NS, za + (zb - za) * (i + 1) / NS
        face(m, [(-STX, y0, z0), (STX, y0, z0), (STX, y1, z0), (-STX, y1, z0)], 'p_pietra', (0, 0, -1))
        face(m, [(-STX, y1, z0), (STX, y1, z0), (STX, y1, z1), (-STX, y1, z1)], 'p_pietra_chiara', (0, 1, 0))
    for sx in (-1, 1):
        x = sx * STX
        face(m, [(x, ya, za), (x, yb, zb), (x, yb - 4.0, zb), (x, ya - 0.01, za + 3.0)], S, (sx, 0, 0))
        beam(m, (sx * (STX + 0.3), ya + 0.35, za), (sx * (STX + 0.3), yb + 0.35, zb), 0.6, 0.7, S)
    # sacrario in cima con la porta buia e il tetto
    muro(m, -2.6, 17.5, 0.0, 2.6, 20.8, 4.5, 'cs_h_glifi', top=TOP, passo=2.6)
    face(m, [(-0.9, 17.5, -0.02), (0.9, 17.5, -0.02), (0.9, 19.7, -0.02), (-0.9, 19.7, -0.02)], 'p_nero_caldo', (0, 0, -1))
    m.box(-3.1, 20.8, -0.5, 3.1, 21.4, 5.0, S, top=TOP)
    m.box(-1.0, 21.4, 1.2, 1.0, 22.4, 3.2, S, top=TOP, skip=('bottom',))
    # bracieri ai lati della bocca e cespugli sui gradoni
    for s in (-1, 1):
        m.box(s * 5.0 - 0.45, 0, -Z0 - 1.6, s * 5.0 + 0.45, 2.0, -Z0 - 0.7, S, top=TOP, skip=('bottom',))
        _torcia(m, s * 5.0, 2.0, -Z0 - 1.15, 1.4)
        _torcia(m, s * 2.2, 17.5, -1.0, 1.0)
    for (x, y, z, r) in ((-7.5, 7.5, -5.5, 1.1), (6.8, 7.5, -6.6, 0.9), (-5.2, 11.0, -3.4, 0.8), (5.0, 14.5, -1.5, 0.7), (8.5, 7.5, 3.0, 1.2)):
        ciuffo(m, x, y, z, r, 'p_erba_scura', ry=r * 0.6)
    return _obj(m)


def cs_h_rovina():
    """Torre in rovina della giungla (10 m): muri a cima spezzata, finestre buie, fascia coi glifi, muschio, liane, blocchi caduti."""
    m = Mesh('cs_h_rovina')
    W, T = 2.2, 0.45
    m.box(-W - 0.5, 0, -W - 0.5, W + 0.5, 0.8, W + 0.5, 'cs_h_tempio', top='muschio', skip=('bottom',))
    alte = [[9.5, 10.2, 8.6, 7.4], [7.8, 9.0, 9.8, 8.4], [8.2, 6.9, 7.5, 8.9], [9.9, 8.8, 7.2, 6.5]]
    lati = [((0, 0, -1), (1, 0, 0)), ((1, 0, 0), (0, 0, 1)), ((0, 0, 1), (-1, 0, 0)), ((-1, 0, 0), (0, 0, -1))]
    for (nrm, u), hs in zip(lati, alte):
        for i, h in enumerate(hs):
            a, b = -W + i * W / 2, -W + (i + 1) * W / 2
            P = lambda t, y, d: (nrm[0] * d + u[0] * t, y, nrm[2] * d + u[2] * t)
            griglia(m, P(a, 0.8, W), P(b, 0.8, W), P(b, h, W), P(a, h, W), 'cs_h_tempio', nrm, passo=4.0)
            face(m, [P(a, 0.8, W - T), P(b, 0.8, W - T), P(b, h, W - T), P(a, h, W - T)], 'p_pietra_scura', _mul(nrm, -1))
            face(m, [P(a, h, W), P(b, h, W), P(b, h, W - T), P(a, h, W - T)], 'muschio', (0, 1, 0))
            if i < 3:
                h2 = hs[i + 1]
                face(m, [P(b, min(h, h2), W), P(b, max(h, h2), W), P(b, max(h, h2), W - T), P(b, min(h, h2), W - T)], 'p_pietra', (u[0] * (1 if h > h2 else -1), 0, u[2] * (1 if h > h2 else -1)))
        Pm = lambda t, y: (nrm[0] * (W + 0.03) + u[0] * t, y, nrm[2] * (W + 0.03) + u[2] * t)
        face(m, [Pm(-W, 3.6), Pm(W, 3.6), Pm(W, 4.4), Pm(-W, 4.4)], 'cs_h_glifi', nrm)
        for y0 in (1.8, 5.4):
            face(m, [Pm(-0.45, y0), Pm(0.45, y0), Pm(0.45, y0 + 1.3), Pm(0.0, y0 + 1.6), Pm(-0.45, y0 + 1.3)], 'p_nero_caldo', nrm)
        face(m, [Pm(W - 0.6, 6.5), Pm(W - 0.3, 6.5), Pm(W - 0.2, 2.5), Pm(W - 0.5, 2.5)], 'p_erba_scura', nrm)
    face(m, [(-W + T, 1.5, -W + T), (W - T, 1.5, -W + T), (W - T, 1.5, W - T), (-W + T, 1.5, W - T)], 'muschio', (0, 1, 0))
    ciuffo(m, -1.2, 9.8, -1.8, 0.7, 'p_erba_scura', ry=0.5)
    ciuffo(m, 1.6, 10.0, 0.4, 0.6, 'p_erba', ry=0.4)
    for (x, z, r, s) in ((3.5, -2.8, 20, 0.7), (-3.4, -1.6, -35, 0.55), (2.6, 3.3, 50, 0.6)):
        m.push(Xf(t=(x, 0, z), r=(0, r, 8)))
        m.box(-s, 0, -s * 0.7, s, s * 1.1, s * 0.7, 'cs_h_tempio', top='muschio', skip=('bottom',))
        m.pop()
    return _obj(m)


def cs_h_ruota_base():
    """Supporti della ruota panoramica: due cavalletti blu fino al mozzo (y = RUOTA_Y), asse dorato, pedana di legno coi gradini e la biglietteria."""
    m = Mesh('cs_h_ruota_base')
    Y = RUOTA_Y
    m.box(-7.0, 0, -3.2, 7.0, 0.5, 3.2, 'p_pietra_scura', top='tavole', skip=('bottom',))
    for k in range(3):
        m.box(-2.0, 0, -3.2 - 0.45 * (k + 1), 2.0, 0.5 - 0.16 * (k + 1) + 0.16, -3.2 - 0.45 * k, 'p_pietra', top='tavole', skip=('bottom', 'back'))
    for zz in (-1.7, 1.7):
        for s in (-1, 1):
            beam(m, (s * 5.6, 0.5, zz), (s * 0.35, Y, zz), 0.5, 0.5, 'p_acqua_profonda', end='p_abisso')
        for y in (3.8, 7.4):
            t = (y - 0.5) / (Y - 0.5)
            x = 5.6 + (0.35 - 5.6) * t
            beam(m, (-x, y, zz), (x, y, zz), 0.3, 0.3, 'p_acqua_profonda')
        for s in (-1, 1):
            t1, t2 = (3.8 - 0.5) / (Y - 0.5), (7.4 - 0.5) / (Y - 0.5)
            beam(m, (s * (5.6 + (0.35 - 5.6) * t1), 3.8, zz), (0, 7.4, zz), 0.2, 0.2, 'p_pietra_chiara')
        m.box(-0.5, Y - 0.6, zz - 0.3, 0.5, Y + 0.6, zz + 0.3, 'p_abisso')
    tubo(m, [(0, Y, -2.2), (0, Y, 2.2)], [0.35, 0.35], 'p_giallo', n=8, cap0='p_arancio', cap1='p_arancio')
    # biglietteria
    m.box(4.2, 0.5, -2.8, 6.2, 2.7, -1.2, 'cs_h_strisce_rg', top='p_rosso', skip=('bottom',))
    face(m, [(4.5, 1.4, -2.82), (5.9, 1.4, -2.82), (5.9, 2.3, -2.82), (4.5, 2.3, -2.82)], 'em_finestra', (0, 0, -1), mat=EM)
    m.cone(4, 1.6, 2.7, 3.7, 'p_acqua_profonda', bottom='p_rosso', cx=5.2, cz=-2.0, a0=math.pi / 4)
    for x in (-6.8, 6.8):
        lanterna(m, x, 0.5, -3.0, 1.0, 'em_faro')
    return _obj(m)


def cs_h_ruota_giro():
    """La ruota panoramica che gira (20 m di diametro). Pivot sul mozzo, asse Z: il client la mette a y = RUOTA_Y sopra cs_h_ruota_base
    e la fa girare attorno al suo Z. Due cerchioni blu con le lampadine, raggi bianchi, otto cabine colorate tra i cerchioni."""
    m = Mesh('cs_h_ruota_giro')
    R, N, ZR = RUOTA_R, 16, 0.95
    P = lambda a, r, z: (math.cos(a) * r, math.sin(a) * r, z)
    for zz in (-ZR, ZR):
        for i in range(N):
            a0, a1 = 2 * math.pi * i / N, 2 * math.pi * (i + 1) / N
            beam(m, P(a0, R, zz), P(a1, R, zz), 0.3, 0.3, 'p_acqua_profonda')
            beam(m, P(a0, 0.6, zz), P(a0, R, zz), 0.13, 0.13, 'p_pietra_chiara')
            # lampadine sulla faccia esterna del cerchione
            s = -1 if zz < 0 else 1
            z = zz + s * 0.16
            q0, q1 = P(a0, R - 0.12, z), P(a1, R - 0.12, z)
            q2, q3 = P(a1, R + 0.12, z), P(a0, R + 0.12, z)
            face(m, [q0, q1, q2, q3], 'em_h_lampadine', (0, 0, s), mat=EM, uv='fit')
            r0, r1 = 1.2, R - 0.3
            u = (-math.sin(a0) * 0.06, math.cos(a0) * 0.06, 0)
            z2 = zz + s * 0.08
            face(m, [_add(P(a0, r0, z2), u), _add(P(a0, r1, z2), u), _sub(P(a0, r1, z2), u), _sub(P(a0, r0, z2), u)], 'em_h_bianco', (0, 0, s), mat=EM)
        beam(m, P(0, R, -ZR), P(0, R, ZR), 0.2, 0.2, 'p_acqua_profonda')
    for i in range(N):
        a = 2 * math.pi * i / N
        beam(m, P(a, R, -ZR), P(a, R, ZR), 0.22, 0.22, 'p_acqua_profonda')
    tubo(m, [(0, 0, -1.3), (0, 0, 1.3)], [1.0, 1.0], 'p_giallo', n=10, cap0='oro', cap1='oro')
    tubo(m, [(0, 0, -1.45), (0, 0, -1.3)], [0.55, 0.7], 'p_arancio', n=8, cap0='p_rosso')
    tubo(m, [(0, 0, 1.3), (0, 0, 1.45)], [0.7, 0.55], 'p_arancio', n=8, cap1='p_rosso')
    colori = ('p_rosso', 'p_giallo', 'p_acqua', 'p_erba', 'p_viola', 'p_arancio', 'p_acqua_profonda', 'p_erba_chiara')
    for i in range(8):
        a = 2 * math.pi * (i + 0.5) / 8
        m.push(Xf(t=P(a, R, 0), r=(0, 0, math.degrees(a))))
        c = colori[i]
        m.box(-0.7, -1.0, -0.8, 1.0, 1.0, 0.8, c, top=c, bottom=c)
        for s in (-1, 1):
            face(m, [(-0.45, -0.75, s * 0.82), (0.7, -0.75, s * 0.82), (0.7, 0.75, s * 0.82), (-0.45, 0.75, s * 0.82)], 'em_finestra', (0, 0, s), mat=EM)
        m.box(1.0, -1.2, -0.95, 1.3, 1.2, 0.95, 'p_pietra_chiara')
        m.box(-0.95, -0.8, -0.65, -0.7, 0.8, 0.65, 'p_pietra_chiara')
        m.pop()
    return _obj(m)


def cs_h_tendone():
    """Tendone del circo (14 m di diametro, 11 m): pareti e tetto a spicchi rossi e bianchi, mantovana gialla a punte,
    giro di lampadine, ingresso col baldacchino, pennone con la bandiera, tiranti."""
    m = Mesh('cs_h_tendone')
    N, R, H = 18, 7.0, 3.4
    a0 = -math.pi / 2 - math.pi / N
    ring = lambda r, y: [(math.cos(a0 + 2 * math.pi * i / N) * r, y, math.sin(a0 + 2 * math.pi * i / N) * r) for i in range(N)]
    w0, w1 = ring(R, 0), ring(R, H)
    e, mid, top = ring(R + 0.7, H + 0.2), ring(3.7, 6.6), ring(0.55, 9.6)
    for i in range(N):
        j = (i + 1) % N
        am = a0 + 2 * math.pi * (i + 0.5) / N
        out = (math.cos(am), 0, math.sin(am))
        c = 'p_rosso' if i % 2 == 0 else 'p_pietra_chiara'
        if i == 0:  # ingresso
            face(m, [w0[i], w0[j], w1[j], w1[i]], 'p_rosso', out)
            mx, mz = (w0[i][0] + w0[j][0]) / 2, (w0[i][2] + w0[j][2]) / 2
            face(m, [(mx - 1.0, 0.02, mz - 0.05), (mx + 1.0, 0.02, mz - 0.05), (mx + 1.0, 2.6, mz - 0.05), (mx - 1.0, 2.6, mz - 0.05)], 'p_nero_caldo', out)
        else:
            face(m, [w0[i], w0[j], w1[j], w1[i]], c, out)
        face(m, [w1[i], w1[j], e[j], e[i]], 'p_giallo', (out[0], -1, out[2]))
        face(m, [e[i], e[j], mid[j], mid[i]], c, (out[0], 1.4, out[2]))
        face(m, [mid[i], mid[j], top[j], top[i]], c, (out[0], 2.2, out[2]))
        face(m, [(e[i][0], e[i][1] - 0.35, e[i][2]), (e[j][0], e[j][1] - 0.35, e[j][2]), e[j], e[i]], 'em_h_lampadine', out, mat=EM, uv='fit')
        p = _lerp(e[i], e[j], 0.5)
        face(m, [(e[i][0], e[i][1] - 0.35, e[i][2]), (p[0], p[1] - 1.1, p[2]), (e[j][0], e[j][1] - 0.35, e[j][2])], 'p_giallo', out)
        face(m, [(e[i][0], e[i][1] - 0.35, e[i][2]), (p[0], p[1] - 1.1, p[2]), (e[j][0], e[j][1] - 0.35, e[j][2])], 'p_arancio', _mul(out, -1))
        if i % 3 == 1:  # tiranti
            beam(m, e[i], (e[i][0] * 1.35, 0, e[i][2] * 1.35), 0.05, 0.05, 'p_pietra')
    face(m, top, 'p_giallo', (0, 1, 0))
    beam(m, (0, 9.5, 0), (0, 11.2, 0), 0.14, 0.14, 'p_legno_scuro')
    sfera(m, 0, 11.3, 0, 0.18, reg='p_giallo', n=5, rings=2)
    for s in (-1, 1):
        face(m, [(0, 11.1, 0), (1.5, 10.75, 0), (0, 10.4, 0)], 'p_rosso', (0, 0, s))
    # baldacchino dell'ingresso
    z0 = -R + 0.1
    for s in (-1, 1):
        beam(m, (s * 1.4, 0, z0 - 2.2), (s * 1.4, 3.0, z0 - 2.2), 0.14, 0.14, 'p_giallo')
    A, B, C, D = (-1.7, 3.0, z0 - 2.5), (1.7, 3.0, z0 - 2.5), (1.7, 3.9, z0 + 0.3), (-1.7, 3.9, z0 + 0.3)
    face(m, [A, B, C, D], 'cs_tenda_rossa', (0, 1, -0.5))
    face(m, [A, B, C, D], 'p_rosso', (0, -1, 0.5))
    for s in (-1, 1):
        face(m, [(s * 1.7, 3.0, z0 - 2.5), (s * 1.7, 3.9, z0 + 0.3), (s * 1.7, 3.0, z0 + 0.3)], 'p_giallo', (s, 0, 0))
    face(m, [(-1.7, 2.6, z0 - 2.5), (1.7, 2.6, z0 - 2.5), (1.7, 3.0, z0 - 2.5), (-1.7, 3.0, z0 - 2.5)], 'em_h_lampadine', (0, 0, -1), mat=EM, uv='fit')
    return _obj(m)


def _tetto_neon(m, x0, x1, z0, z1, y, neon):
    m.box(x0 - 0.15, y, z0 - 0.15, x1 + 0.15, y + 0.6, z1 + 0.15, 'p_roccia', top='p_pietra_scura')
    for a, b in (((x0 - 0.2, z0 - 0.2), (x1 + 0.2, z0 - 0.2)), ((x1 + 0.2, z0 - 0.2), (x1 + 0.2, z1 + 0.2)), ((x1 + 0.2, z1 + 0.2), (x0 - 0.2, z1 + 0.2)), ((x0 - 0.2, z1 + 0.2), (x0 - 0.2, z0 - 0.2))):
        beam(m, (a[0], y + 0.3, a[1]), (b[0], y + 0.3, b[1]), 0.1, 0.1, neon, mat=EM)


def cs_h_palazzo_a():
    """Grattacielo viola della città al neon (19 m): negozio acceso a pian terreno con la tenda, piani con le finestre (alcuni accesi),
    insegna verticale al neon sullo spigolo, bordo del tetto al neon ciano, cisterna, condizionatori, antenna con la luce rossa."""
    m = Mesh('cs_h_palazzo_a')
    X, Zh, H = 4.0, 4.0, 18.0
    m.box(-X, 0, -Zh, X, 3.6, Zh, 'p_roccia', skip=('bottom', 'top', 'front'))
    face(m, [(X, 0, -Zh), (-X, 0, -Zh), (-X, 3.6, -Zh), (X, 3.6, -Zh)], 'p_roccia', (0, 0, -1))
    face(m, [(-3.4, 0.4, -Zh - 0.02), (0.6, 0.4, -Zh - 0.02), (0.6, 2.8, -Zh - 0.02), (-3.4, 2.8, -Zh - 0.02)], 'em_finestra', (0, 0, -1), mat=EM)
    face(m, [(1.4, 0.0, -Zh - 0.02), (3.0, 0.0, -Zh - 0.02), (3.0, 2.6, -Zh - 0.02), (1.4, 2.6, -Zh - 0.02)], 'em_h_finestre', (0, 0, -1), mat=EM)
    A, B, C, D = (-3.7, 3.0, -Zh - 1.5), (0.9, 3.0, -Zh - 1.5), (0.9, 3.6, -Zh), (-3.7, 3.6, -Zh)
    face(m, [A, B, C, D], 'cs_tenda_blu', (0, 1, -0.6))
    face(m, [A, B, C, D], 'p_acqua_profonda', (0, -1, 0.6))
    m.box(-X - 0.1, 3.6, -Zh - 0.1, X + 0.1, 3.9, Zh + 0.1, 'p_nero_caldo')
    beam(m, (-X - 0.15, 3.75, -Zh - 0.16), (X + 0.15, 3.75, -Zh - 0.16), 0.08, 0.08, 'em_neon_rosa', mat=EM)
    accese = {(0, 1), (1, 3), (2, 0), (3, 2), (0, 4), (2, 3), (1, 0), (3, 4)}
    lati = [((0, 0, -1), (-1, 0, 0)), ((1, 0, 0), (0, 0, -1)), ((0, 0, 1), (1, 0, 0)), ((-1, 0, 0), (0, 0, 1))]
    for li, (nrm, u) in enumerate(lati):
        c = _mul(nrm, X)
        for i in range(2):
            for j in range(4):
                a, b = -X + i * X, -X + (i + 1) * X
                y0, y1 = 3.9 + j * (H - 3.9) / 4, 3.9 + (j + 1) * (H - 3.9) / 4
                P = lambda t, y: (c[0] + u[0] * t, y, c[2] + u[2] * t)
                acc = (li, i + 2 * j) in accese
                face(m, [P(b, y0), P(a, y0), P(a, y1), P(b, y1)], 'em_h_finestre' if acc else 'cs_h_palazzo_viola', nrm, **_mo(EM if acc else None))
    for y in (7.4, 10.9, 14.4):
        m.box(-X - 0.08, y, -Zh - 0.08, X + 0.08, y + 0.15, Zh + 0.08, 'p_roccia')
    _tetto_neon(m, -X, X, -Zh, Zh, H, 'em_neon_ciano')
    # insegna verticale sullo spigolo davanti a destra
    xs, zs = X + 0.15, -Zh + 0.9
    beam(m, (X, 12.5, zs), (xs + 0.15, 12.5, zs), 0.1, 0.1, 'p_nero_caldo')
    beam(m, (X, 6.5, zs), (xs + 0.15, 6.5, zs), 0.1, 0.1, 'p_nero_caldo')
    m.box(xs + 0.1, 5.8, zs - 0.12, xs + 1.5, 13.2, zs + 0.12, 'p_nero_caldo')
    for s in (-1, 1):
        face(m, [(xs + 0.2, 6.0, zs + s * 0.13), (xs + 1.4, 6.0, zs + s * 0.13), (xs + 1.4, 13.0, zs + s * 0.13), (xs + 0.2, 13.0, zs + s * 0.13)][::-s], 'em_h_insegna_v', (0, 0, s), mat=EM, uv='fit')
    # tetto: cisterna, condizionatori, antenna
    Y = H + 0.6
    for x, z in ((-1.8, 1.2), (-0.4, 1.2), (-1.8, 2.4), (-0.4, 2.4)):
        beam(m, (x, Y, z), (x, Y + 1.2, z), 0.12, 0.12, 'p_legno_scuro')
    m.prism(8, 1.0, 1.0, Y + 1.2, Y + 2.8, 'tavole_v', top='p_legno_scuro', cx=-1.1, cz=1.8)
    m.cone(8, 1.1, Y + 2.8, Y + 3.4, 'p_legno_scuro', cx=-1.1, cz=1.8)
    for x in (1.2, 2.6):
        m.box(x - 0.55, Y, -2.6, x + 0.55, Y + 0.8, -1.6, 'p_pietra', top='p_pietra_scura')
    beam(m, (2.5, Y, 2.5), (2.5, Y + 5.0, 2.5), 0.1, 0.1, 'p_pietra_scura')
    beam(m, (2.0, Y + 3.6, 2.5), (3.0, Y + 3.6, 2.5), 0.06, 0.06, 'p_pietra_scura')
    sfera(m, 2.5, Y + 5.1, 2.5, 0.15, reg='em_neon_rosso', n=4, rings=1)
    return _obj(m)


def cs_h_palazzo_b():
    """Palazzo blu largo della città al neon (13 m + cartellone): portici accesi, scala antincendio, piano arretrato,
    cartellone della città al neon sul tetto, bordi al neon rosa."""
    m = Mesh('cs_h_palazzo_b')
    X, Zh, H = 6.0, 4.0, 12.0
    m.box(-X, 0, -Zh, X, 3.2, Zh, 'p_nero_caldo', skip=('bottom', 'top'))
    for k in range(3):
        x0 = -X + 0.5 + k * 4.0
        face(m, [(x0, 0.3, -Zh - 0.02), (x0 + 3.0, 0.3, -Zh - 0.02), (x0 + 3.0, 2.7, -Zh - 0.02), (x0, 2.7, -Zh - 0.02)], 'em_finestra' if k != 1 else 'em_h_finestre', (0, 0, -1), mat=EM)
    m.box(-X - 0.1, 3.2, -Zh - 0.6, X + 0.1, 3.5, Zh + 0.1, 'p_roccia', top='p_pietra_scura')
    beam(m, (-X - 0.1, 3.35, -Zh - 0.66), (X + 0.1, 3.35, -Zh - 0.66), 0.08, 0.08, 'em_neon_rosa', mat=EM)
    muro(m, -X, 3.5, -Zh, X, H, Zh, 'cs_h_palazzo_blu', skip=('bottom', 'top'))
    for y in (6.3, 9.15):
        m.box(-X - 0.1, y, -Zh - 0.1, X + 0.1, y + 0.15, Zh + 0.1, 'p_abisso')
    _tetto_neon(m, -X, X, -Zh, Zh, H, 'em_neon_rosa')
    muro(m, -X + 1.5, H + 0.6, -Zh + 2.0, X - 2.5, H + 3.6, Zh - 0.5, 'cs_h_palazzo_viola', top='p_pietra_scura')
    # cartellone sul tetto
    for x in (-2.5, 2.5):
        beam(m, (x, H + 0.6, -Zh + 0.9), (x, H + 3.4, -Zh + 0.9), 0.15, 0.15, 'p_pietra_scura')
    m.box(-3.6, H + 3.2, -Zh + 0.7, 3.6, H + 7.0, -Zh + 1.0, 'p_nero_caldo')
    face(m, [(-3.4, H + 3.4, -Zh + 0.68), (3.4, H + 3.4, -Zh + 0.68), (3.4, H + 6.8, -Zh + 0.68), (-3.4, H + 6.8, -Zh + 0.68)], 'em_h_citta', (0, 0, -1), mat=EM, uv='fit')
    # scala antincendio sul fianco sinistro
    xs = -X - 0.05
    for k, y in enumerate((4.6, 7.4, 10.2)):
        m.box(xs - 1.1, y, -2.6, xs, y + 0.12, 2.6, 'p_nero_caldo')
        beam(m, (xs - 1.1, y + 0.9, -2.6), (xs - 1.1, y + 0.9, 2.6), 0.06, 0.06, 'p_nero_caldo')
        for z in (-2.6, 0.0, 2.6):
            beam(m, (xs - 1.1, y, z), (xs - 1.1, y + 0.9, z), 0.05, 0.05, 'p_nero_caldo')
        if k < 2:
            za, zb = (-2.3, 2.3) if k % 2 == 0 else (2.3, -2.3)
            beam(m, (xs - 0.55, y + 0.12, za), (xs - 0.55, y + 2.8, zb), 0.7, 0.08, 'p_roccia')
    for x0 in (-X + 0.6, X - 1.6):  # condizionatori
        m.box(x0, H + 0.6, Zh - 1.6, x0 + 1.0, H + 1.3, Zh - 0.6, 'p_pietra', top='p_pietra_scura')
    return _obj(m)


def cs_h_corallo():
    """Coralli e conchiglie giganti del fondale (~6 m): corallo ramificato, canne viola, corallo cervello, conchiglia aperta con la perla,
    tritone, stella marina, alghe."""
    m = Mesh('cs_h_corallo')
    tubo(m, [(0, 0, 0), (0.2, 1.8, 0), (-0.1, 3.4, 0.1), (0.2, 4.6, 0)], [0.5, 0.42, 0.33, 0.2], 'cs_h_corallo', n=7, cap1='p_arancio')
    for (a, b, c) in (((0.15, 1.5, 0), (1.3, 2.6, 0.2), (1.6, 3.8, 0.1)), ((0.0, 2.4, 0), (-1.2, 3.3, -0.2), (-1.3, 4.3, 0.0)), ((0.0, 3.0, 0), (0.6, 4.0, -0.8), (0.7, 5.0, -1.0))):
        tubo(m, [a, b, c], [0.25, 0.2, 0.13], 'cs_h_corallo', n=6, cap1='p_arancio')
    for (x, z, h, r) in ((-2.0, 0.8, 2.6, 0.35), (-2.6, 0.2, 1.9, 0.3), (-1.6, 1.5, 1.6, 0.28), (-2.5, 1.2, 2.2, 0.26)):
        tornio(m, [(0, r * 0.8), (h, r), (h, r * 0.6), (h - 0.4, 0)], ['p_viola', 'p_viola', 'p_abisso'], n=6, cx=x, cz=z)
    sfera(m, 1.9, 0.35, 1.2, 1.0, 0.75, 0.9, 'p_giallo', n=8, rings=3)
    # conchiglia gigante a ventaglio, in piedi, con la perla davanti
    cx, cz, RR = 2.3, -1.6, 1.7
    for k in range(9):
        a0, a1 = math.radians(10 + k * 17.8), math.radians(10 + (k + 1) * 17.8)
        am = (a0 + a1) / 2
        o = (cx, 0.1, cz)
        p0 = (cx + math.cos(a0) * RR, 0.1 + math.sin(a0) * RR, cz)
        p1 = (cx + math.cos(a1) * RR, 0.1 + math.sin(a1) * RR, cz)
        pm = (cx + math.cos(am) * (RR + 0.08), 0.1 + math.sin(am) * (RR + 0.08), cz - 0.28)
        face(m, [o, p0, pm], 'p_pietra_chiara' if k % 2 == 0 else 'p_sabbia_chiara', (0, 0, -1))
        face(m, [o, pm, p1], 'p_sabbia', (0, 0, -1))
        face(m, [o, p0, p1], 'p_legno_chiaro', (0, 0, 1))
    m.box(cx - 0.35, 0, cz - 0.25, cx + 0.35, 0.35, cz + 0.1, 'p_sabbia', top='p_sabbia_chiara')
    sfera(m, cx, 0.3, cz - 0.6, 0.3, reg='p_pietra_chiara', n=6, rings=2)
    # tritone
    m.push(Xf(t=(-0.9, 0.35, -1.9), r=(0, 30, 90)))
    tornio(m, [(-0.8, 0), (-0.6, 0.3), (0.0, 0.45), (0.5, 0.3), (0.9, 0.12), (1.2, 0)], ['p_sabbia_chiara', 'p_sabbia', 'p_sabbia_chiara', 'p_legno_chiaro', 'p_sabbia'], n=6)
    m.pop()
    face(m, [(-1.6, 0.05, -2.3), (-1.0, 0.05, -2.6), (-0.9, 0.7, -2.3)], 'p_rosso', (0, 0.2, -1))
    # stella marina
    sx, sz = 0.2, -2.4
    for k in range(5):
        a = math.radians(90 + k * 72)
        b0, b1 = math.radians(90 + k * 72 - 36), math.radians(90 + k * 72 + 36)
        tip = (sx + math.cos(a) * 0.8, 0.06, sz + math.sin(a) * 0.8)
        q0 = (sx + math.cos(b0) * 0.28, 0.06, sz + math.sin(b0) * 0.28)
        q1 = (sx + math.cos(b1) * 0.28, 0.06, sz + math.sin(b1) * 0.28)
        face(m, [q0, tip, q1, (sx, 0.2, sz)], 'p_arancio', (0, 1, 0))
    for (x, z, h) in ((1.0, 1.6, 2.4), (-0.8, 1.2, 1.9), (2.8, 0.2, 1.6)):  # alghe
        for nrm in ((0, 0, -1), (0, 0, 1)):
            face(m, [(x - 0.15, 0, z), (x + 0.15, 0, z), (x + 0.35, h * 0.5, z), (x - 0.05, h, z), (x + 0.05, h * 0.5, z)], 'p_erba_scura', nrm)
    return _obj(m)


def cs_h_igloo():
    """Igloo a blocchi di ghiaccio (5,6 m di diametro) con il tunnel d'ingresso, la porta buia e un cumulo di neve."""
    m = Mesh('cs_h_igloo')
    R = 2.8
    prof = [(0, R)] + [(R * math.sin(math.radians(a)), R * math.cos(math.radians(a))) for a in (25, 50, 70, 85)] + [(R, 0)]
    tornio(m, prof, 'cs_h_ghiaccio', n=12)
    # tunnel: archi a mezzo cerchio lungo −Z
    n = 6
    arc = lambda r, z: [(math.cos(math.pi * i / n) * r, math.sin(math.pi * i / n) * r, z) for i in range(n + 1)]
    a0, a1 = arc(1.15, -2.0), arc(1.15, -3.7)
    for i in range(n):
        mid = (math.cos(math.pi * (i + 0.5) / n), math.sin(math.pi * (i + 0.5) / n), 0)
        face(m, [a0[i], a0[i + 1], a1[i + 1], a1[i]], 'cs_h_ghiaccio', mid)
    inner = arc(0.75, -3.7)
    for i in range(n):
        face(m, [a1[i], a1[i + 1], inner[i + 1], inner[i]], 'p_pietra_chiara', (0, 0, -1))
    face(m, [(p[0], p[1], -3.68) for p in inner], 'p_nero_caldo', (0, 0, -1))
    face(m, [(1.15, 0, -3.7), (0.75, 0, -3.7), (-0.75, 0, -3.7), (-1.15, 0, -3.7)], 'p_pietra_chiara', (0, 0, -1))
    sfera(m, 2.9, 0.0, -2.2, 1.1, 0.6, 1.0, 'cs_h_neve', n=6, rings=2)
    sfera(m, -2.6, 0.0, 1.8, 1.3, 0.5, 1.1, 'cs_h_neve', n=6, rings=2)
    for (x, z, rot) in ((-2.4, -2.6, 20), (-1.6, -3.4, -15)):
        m.push(Xf(t=(x, 0, z), r=(0, rot, 0)))
        m.box(-0.45, 0, -0.3, 0.45, 0.5, 0.3, 'cs_h_ghiaccio', top='p_pietra_chiara', skip=('bottom',))
        m.pop()
    return _obj(m)


MODELS = {f.__name__: f for f in (
    cs_h_garage, cs_h_statua, cs_h_podio, cs_h_torre, cs_h_trofeo, cs_h_bancarella, cs_h_festone, cs_h_bandiera, cs_h_staccionata,
    cs_h_cartello, cs_h_coni, cs_h_gomme, cs_h_casse, cs_h_lampione,
    cs_h_pontile, cs_h_palo_luce, cs_h_salvagente,
    cs_h_porta_spiaggia, cs_h_porta_ghiaccio, cs_h_porta_giungla, cs_h_porta_neon, cs_h_porta_lunapark, cs_h_porta_fondale, cs_h_sbarra,
    cs_h_palma, cs_h_albero, cs_h_pino_neve, cs_h_albero_giungla, cs_h_cespuglio, cs_h_roccia_a, cs_h_roccia_b,
    cs_h_tempio, cs_h_rovina, cs_h_ruota_base, cs_h_ruota_giro, cs_h_tendone, cs_h_palazzo_a, cs_h_palazzo_b, cs_h_corallo, cs_h_igloo)}
