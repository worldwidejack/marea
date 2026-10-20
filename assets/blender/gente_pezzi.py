# MAREA — pezzi comuni dei personaggi del Borgo (tavolozza, occhi, mani, scarpe, pesi a zone). Vedi gente_kit.py.
import math
from gente_kit import Fig, TORSO, NECK, ARM, LEG, SKIRT

# ---------------------------------------------------------------- tavolozza (ART_BIBLE + toni nuovi caldi e saturi)
NERO = '#1E1B1A'
OCCHIO = '#221A17'
BIANCO_OCCHIO = '#F7F1E6'
PELLE = ['#FBE2C8', '#EFC29B', '#D9A070', '#B8784C', '#8C5636', '#5A3A28']
GUANCE = '#E98A73'
LEGNO = '#9A6334'
LEGNO_SCURO = '#5E3A1E'
ORO = '#F5C842'
ORO_SCURO = '#C9962A'


def zone(f, *pairs):
    """Pesi a zone: pairs = (ymin, ossa), ... il primo con y ≥ ymin vince (dall'alto in basso)."""
    def w(p):
        for ymin, b in pairs:
            if p[1] >= ymin:
                return f._w(p, b)
        return f._w(p, pairs[-1][1])
    return w


# ---------------------------------------------------------------- pezzi comuni (con parametri, mai uguali)
def occhi(f, c, dx, r=(0.022, 0.03, 0.012), col=OCCHIO, luce=True, sopr=None, sopr_col=None, sopr_k=(0.034, 0.012), sopr_ang=0.0, z=None):
    """Due occhi (ovali scuri con un puntino di luce) sulla faccia; c = centro fra gli occhi (sulla superficie)."""
    for k in (-1, 1):
        p = (c[0] + k * dx, c[1], c[2])
        f.ell(p, r, col, 'Head', n=8, m=4)
        if luce:
            f.ell((p[0] + k * r[0] * 0.25 - 0.004, p[1] + r[1] * 0.35, p[2] - r[2] * 0.9), (r[0] * 0.32, r[0] * 0.32, 0.004), BIANCO_OCCHIO, 'Head', n=6, m=3)
        if sopr:
            w, h = sopr_k
            f.push(t=(p[0], p[1] + r[1] + sopr, p[2] + 0.006), r=(0, 0, -k * sopr_ang))
            f.tube([(-w, 0, 0), (0, h * 0.4, -0.003), (w, 0, 0)], [h * 0.6, h, h * 0.6], sopr_col, 'Head', n=6, res=2, caps=('round', 'round'), ref=(0, 1, 0))
            f.pop()


def mano(f, s, p, r, col, dita='mittens', ang=0.0):
    """Mano a manopola col pollice in avanti; p = polso. ang ruota la mano attorno a x (gradi, positivo = palmo avanti)."""
    k = -1 if s == 'L' else 1
    f.push(t=p, r=(ang, 0, 0))
    f.ell((0, -r * 1.05, 0), (r * 0.82, r * 1.15, r * 0.62), col, f'LowerArm.{s}', n=8, m=5)
    f.ell((-k * r * 0.2, -r * 0.55, -r * 0.62), (r * 0.32, r * 0.5, r * 0.3), col, f'LowerArm.{s}', n=6, m=4)
    f.pop()


def scarpa(f, s, x, lung, larg, alt, col, suola=None, punta=0.0, tacco=0.0):
    """Scarpa: tallone a z ≈ +0.04, punta verso −Z. Rigida sul piede."""
    b = f'Foot.{s}'
    zc = -lung * 0.5 + 0.05
    f.ell((x, alt * 0.5, zc), (larg, alt * 0.75, lung * 0.62), col, b, n=10, m=5, cut=(-0.65, 1.0),
          deform=lambda p: (p[0] * (1 - 0.18 * max(0, p[2] / (lung * 0.62))), p[1] + punta * max(0, -p[2] / (lung * 0.62)) ** 2 * alt, p[2]))
    if suola:
        f.ell((x, alt * 0.06, zc), (larg * 1.08, alt * 0.12, lung * 0.66), suola, b, n=10, m=2)


def corpo(f, rings, col, b, n=16, res=2, caps=('flat', 'round'), capk=0.3, sq=2.0):
    """Busto/vestito da anelli (y, rx, rz, zc) dal basso in alto. Ritorna gli anelli (per pannelli e cinture che ci stanno sopra)."""
    f.tube([(0, y, zc) for y, _rx, _rz, zc in rings], [(rx, rz) for _y, rx, rz, _zc in rings], col, b, n=n, res=res, caps=caps, capk=capk, sq=sq)
    return rings


def _ring_at(rings, y):  # noqa: anche per chi importa *
    """Interpola (rx, rz, zc) sugli anelli alla quota y (lineare)."""
    for a, c in zip(rings, rings[1:]):
        if a[0] <= y <= c[0]:
            t = (y - a[0]) / ((c[0] - a[0]) or 1)
            return tuple(a[i] + (c[i] - a[i]) * t for i in (1, 2, 3))
    r = rings[0] if y < rings[0][0] else rings[-1]
    return r[1], r[2], r[3]


def pannello(f, rings, y0, y1, ang, col, b, off=0.008, th=0.014, ny=6, na=8):
    """Toppa che segue il corpo (grembiule, scialle, risvolto, fascia): da y0 a y1, ang(t) → (gradi da, gradi a) con 0 = davanti,
    positivo verso +x; t = 0 in basso, 1 in alto. off = quanto sta fuori dal corpo, th = spessore."""
    outer, inner = [], []
    for j in range(ny + 1):
        t = j / ny
        y = y0 + (y1 - y0) * t
        rx, rz, zc = _ring_at(rings, y)
        a0, a1 = ang(t)
        for i in range(na + 1):
            a = math.radians(a0 + (a1 - a0) * i / na)
            for lst, d in ((outer, off + th), (inner, off)):
                lst.append((math.sin(a) * (rx + d), y, zc - math.cos(a) * (rz + d)))
    pts = outer + inner
    N = (ny + 1) * (na + 1)
    idx = lambda j, i, k=0: k * N + j * (na + 1) + i
    faces = []
    for j in range(ny):
        for i in range(na):
            faces.append((idx(j, i), idx(j + 1, i), idx(j + 1, i + 1), idx(j, i + 1)))
            faces.append((idx(j, i, 1), idx(j, i + 1, 1), idx(j + 1, i + 1, 1), idx(j + 1, i, 1)))
    for j in range(ny):
        faces.append((idx(j, 0), idx(j, 0, 1), idx(j + 1, 0, 1), idx(j + 1, 0)))
        faces.append((idx(j, na), idx(j + 1, na), idx(j + 1, na, 1), idx(j, na, 1)))
    for i in range(na):
        faces.append((idx(0, i), idx(0, i + 1), idx(0, i + 1, 1), idx(0, i, 1)))
        faces.append((idx(ny, i), idx(ny, i, 1), idx(ny, i + 1, 1), idx(ny, i + 1)))
    i0 = f._verts(pts, b)
    f._faces(faces, i0, col, pts)


def anello(f, c, r, th, col, b, n=12, nt=5, r_xyz=(0, 0, 0), sy=1.0):
    """Anello (montatura degli occhiali, orecchino, fascia): sta nel piano xy, poi ruotato di r_xyz."""
    f.push(t=c, r=r_xyz)
    pts = [(math.cos(2 * math.pi * i / n) * r, math.sin(2 * math.pi * i / n) * r * sy, 0) for i in range(n + 1)]
    f.tube(pts, [th] * (n + 1), col, b, n=nt, res=1, caps=(None, None), ref=(0, 0, -1))
    f.pop()


def occhi_chiusi(f, c, dx, w=0.026, th=0.007, col=OCCHIO, su=True):
    """Occhi chiusi a mezzaluna (^ ^ se su, sennò sorriso all'ingiù)."""
    for k in (-1, 1):
        x = c[0] + k * dx
        h = w * 0.55 * (1 if su else -1)
        f.tube([(x - w, c[1] - h * 0.4, c[2] + 0.004), (x, c[1] + h * 0.6, c[2]), (x + w, c[1] - h * 0.4, c[2] + 0.004)], [th * 0.7, th, th * 0.7], col, 'Head', n=5, res=3)


def _rot_gioco(rs):
    """[(asse Blender X|Y|Z, gradi), ...] come nelle clip → matrice 4×4 in coordinate di gioco (Y Blender = −z, Z Blender = y)."""
    from mathutils import Matrix, Vector
    R = Matrix.Identity(4)
    for axis, deg in rs:
        ax = {(1, 0, 0): (1, 0, 0), (0, 1, 0): (0, 0, -1), (0, 0, 1): (0, 1, 0)}[tuple(axis)]
        R = Matrix.Rotation(math.radians(deg), 4, Vector(ax)) @ R
    return R


def in_mano(f, catena, fn):
    """Modella un oggetto come appare NELLA POSA e lo riporta a riposo. catena = [(perno a riposo, [(asse, gradi), ...]), ...] dalla
    spalla al polso, con gli stessi angoli che la clip dà alle ossa (posa). fn() disegna in coordinate finali; pesare rigido sull'ultimo osso."""
    from mathutils import Matrix
    M = Matrix.Identity(4)
    for pivot, rs in catena:
        M = M @ (Matrix.Translation(pivot) @ _rot_gioco(rs) @ Matrix.Translation([-c for c in pivot]))
    f.xf.append(f.xf[-1] @ M.inverted())
    fn()
    f.xf.pop()


def posa_braccio(catena_ossa, catena):
    """Dalla stessa catena di in_mano al dict della clip: [('UpperArm.L', ...), ('LowerArm.L', ...)]."""
    return {osso: list(rs) for osso, (_p, rs) in zip(catena_ossa, catena)}


def finale(catena, p):
    """Dove finisce il punto p (a riposo) con la catena di rotazioni della posa (vedi in_mano)."""
    from mathutils import Matrix, Vector
    M = Matrix.Identity(4)
    for pivot, rs in catena:
        M = M @ (Matrix.Translation(pivot) @ _rot_gioco(rs) @ Matrix.Translation([-c for c in pivot]))
    return tuple(M @ Vector(p))


def capelli_cap(f, c, r, col, fronte=0.35, dietro=-0.75, n=14, m=7, gonfio=1.0):
    """Calotta di capelli sulla testa: attaccatura alta sulla fronte (fronte, in frazioni del raggio y) e bassa dietro (dietro)."""
    rx, ry, rz = r

    def d(p):
        x, y, z = p
        fr = max(0.0, min(1.0, 0.5 - z / (2 * rz)))   # 0 dietro, 1 davanti
        lo = (dietro + (fronte - dietro) * fr) * ry
        if y < lo:
            y = lo
        return (x * gonfio, y, z)
    f.ell(c, r, col, 'Head', n=n, m=m, deform=d)


def caso(p, seme=0.0):
    """Numero «a caso» in [0, 1) ma fisso per la posizione p (motivi a pois e fiorellini sulle stoffe)."""
    v = math.sin(p[0] * 91.7 + p[1] * 53.3 + p[2] * 77.1 + seme * 13.1) * 43758.5453
    return v - math.floor(v)


def fiore(f, c, r, col, centro, b, n=5, normale=(0, 1, 0), rot=0.0):
    """Fiorellino: n petali tondi attorno a un bottone, sul piano perpendicolare a `normale` (y = guarda in su)."""
    import mathutils
    q = mathutils.Vector((0, 1, 0)).rotation_difference(mathutils.Vector(normale)).to_euler()
    f.push(t=c, r=tuple(math.degrees(a) for a in q))
    for i in range(n):
        a = rot + 2 * math.pi * i / n
        f.ell((math.cos(a) * r * 0.62, 0, math.sin(a) * r * 0.62), (r * 0.48, r * 0.18, r * 0.48), col, b, n=5, m=2)
    f.ell((0, r * 0.12, 0), (r * 0.3, r * 0.2, r * 0.3), centro, b, n=5, m=2)
    f.pop()


__all__ = [n for n in dir() if not n.startswith('__')]
