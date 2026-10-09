# MAREA — attrezzi comuni per i veicoli e i piloti dell'Isola delle Corse (#178).
# Colori: solo i campioni piatti `p_<colore>` dell'atlas (palette di ART_BIBLE §2), niente regioni nuove.
# Coordinate di gioco: x destra, y su, z verso la camera; il davanti è −Z. Pivot a terra, al centro.
import math
from lib import beam, fix_winding


def C(nome):
    """Regione piatta della palette: C('rosso') -> 'p_rosso'."""
    return 'p_' + nome


def ruota(m, x, z, r=0.28, larga=0.24, gomma='nero_caldo', cerchio='pietra', y=None, n=12):
    """Ruota con l'asse lungo X: gomma ottagonale e un cerchio che sporge dal lato esterno."""
    y = r if y is None else y
    lato = 1 if x >= 0 else -1
    beam(m, (x - larga / 2, y, z), (x + larga / 2, y, z), 2 * r, 2 * r, C(gomma), end=C(gomma), n=n)
    beam(m, (x + lato * (larga / 2 - 0.02), y, z), (x + lato * (larga / 2 + 0.03), y, z), 1.1 * r, 1.1 * r, C(cerchio), end=C(cerchio), n=8)


def sfera(m, cx, cy, cz, rx, ry=None, rz=None, reg='p_pietra', n=8, rings=3, top=True, bottom=True):
    """Palla/ellissoide a pochi poligoni: `rings` anelli tra due calotte."""
    ry = rx if ry is None else ry
    rz = rx if rz is None else rz
    rs = []
    for k in range(rings):
        t = math.pi * (k + 1) / (rings + 1)
        rs.append(m.ring(n, rx * math.sin(t), cy - ry * math.cos(t), rz=rz * math.sin(t), cx=cx, cz=cz))
    m.loft(rs, reg, top=reg if top else None, bottom=reg if bottom else None)


def casco(m, cx, cy, cz, r, colore, visiera='nero_caldo', striscia=None, davanti=-1):
    """Casco da pilota: calotta, visiera scura sul davanti (−Z) e una striscia."""
    sfera(m, cx, cy, cz, r, r * 0.95, r, C(colore), n=8, rings=3)
    m.box(cx - r * 0.7, cy - r * 0.25, cz + davanti * r * 0.55, cx + r * 0.7, cy + r * 0.3, cz + davanti * r * 1.02, C(visiera), skip=('back',))
    if striscia:
        m.box(cx - r * 0.12, cy + r * 0.3, cz - r * 0.8, cx + r * 0.12, cy + r * 0.98, cz + r * 0.8, C(striscia), skip=('bottom',))


def volante(m, x, y, z, r=0.17, colore='nero_caldo', inclina=-35):
    """Volante: ciambella ottagonale inclinata verso chi guida e piantone."""
    m.push(__import__('lib').Xf(t=(x, y, z), r=(inclina, 0, 0)))
    beam(m, (-r, 0, 0), (r, 0, 0), 0.05, 0.05, C(colore), end=C(colore))
    beam(m, (0, -r, 0), (0, r, 0), 0.05, 0.05, C(colore), end=C(colore))
    beam(m, (-r * 0.7, r * 0.7, 0), (r * 0.7, r * 0.7, 0), 0.05, 0.05, C(colore), end=C(colore))
    beam(m, (-r * 0.7, -r * 0.7, 0), (r * 0.7, -r * 0.7, 0), 0.05, 0.05, C(colore), end=C(colore))
    beam(m, (-r * 0.7, -r * 0.7, 0), (-r * 0.7, r * 0.7, 0), 0.05, 0.05, C(colore), end=C(colore))
    beam(m, (r * 0.7, -r * 0.7, 0), (r * 0.7, r * 0.7, 0), 0.05, 0.05, C(colore), end=C(colore))
    m.pop()
    beam(m, (x, y - 0.02, z + 0.03), (x, max(0.2, y - 0.3), z + 0.2), 0.05, 0.05, C('pietra_scura'), end=C('pietra_scura'))


def fascia(m, x0, y0, z0, x1, y1, z1, base, banda, larghezza=0.16):
    """Parallelepipedo con una banda centrale lungo Z (strisce da corsa) sulle facce alte."""
    cx = (x0 + x1) / 2
    m.box(x0, y0, z0, x1, y1, z1, C(base), C(base))
    m.box(cx - larghezza / 2, y1, z0, cx + larghezza / 2, y1 + 0.004, z1, C(banda), C(banda), skip=('bottom', 'front', 'back', 'left', 'right'))


# --- forme morbide (ritocco del 9 ott 2026: «troppo squadrati») ---------------------------------------------------

def anello_xy(cx, cy, z, w, h, r=None, seg=3):
    """Rettangolo con gli angoli arrotondati nel piano XY (larghezza w, altezza h) alla quota z; r = raggio degli angoli.
    Punti in ordine antiorario visto da +Z; sempre lo stesso numero di punti (4*(seg+1)) per ogni r, così si può fare il loft."""
    r = min(w, h) * 0.3 if r is None else min(r, w / 2 - 1e-4, h / 2 - 1e-4)
    pts = []
    for k, (qx, qy, a0) in enumerate(((1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270))):
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((cx + qx * (w / 2 - r) + r * math.cos(a), cy + qy * (h / 2 - r) + r * math.sin(a), z))
    return pts


def tubo_z(m, sezioni, reg, seg=3, chiuso=True, regioni_cap=None):
    """Corpo morbido lungo Z: ogni sezione è (z, cx, cy, larghezza, altezza, raggio_angoli). Facce rivolte fuori, cappe sui due capi.
    Per il muso di un veicolo: sezioni che si restringono e si abbassano verso −Z."""
    start = len(m.polys)
    rings = [anello_xy(cx, cy, z, w, h, r, seg) for (z, cx, cy, w, h, r) in sezioni]
    m.loft(rings, reg, top=reg if chiuso else None, bottom=reg if chiuso else None)
    fix_winding(m, start)


def scatola_tonda(m, x0, y0, z0, x1, y1, z1, reg, r=0.08, seg=2, muso=None):
    """Scatola con spigoli smussati. muso=(scala_larghezza, scala_altezza, scende) restringe la faccia davanti (−Z)."""
    cx, cy, w, h = (x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0
    sw, sh, giu = muso if muso else (1.0, 1.0, 0.0)
    tubo_z(m, [(z0, cx, cy - giu, w * sw, h * sh, r * min(sw, sh)), (z1, cx, cy, w, h, r)], reg, seg)


def corpo_y(m, anelli, reg, n=12, cima=True, fondo=True):
    """Corpo morbido in piedi (animali, busti): anelli = [(y, raggio_x, raggio_z, cx, cz), …] dal basso in alto, n lati."""
    rs = [m.ring(n, rx, y, rz=rz, cx=cx, cz=cz) for (y, rx, rz, cx, cz) in anelli]
    m.loft(rs, reg, top=reg if cima else None, bottom=reg if fondo else None)
