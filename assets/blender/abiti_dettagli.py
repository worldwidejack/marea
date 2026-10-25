# MAREA — dettagli da cucire sui vestiti e sui cappelli del Mercante: pannelli (pettorine, grembiuli, risvolti), strisce lungo la pelle
# (bretelle, bandoliere, sciarpe, fili neon), colletti, toppe, e i torniti dei cappelli centrati sulla testa del chr_base.
import math
from abiti_kit import dir_a
from abiti_capi import quote

TESTA = (0.0, 0.0)          # centro (x, z) della testa: il cranio sta in x ±0,12, z da −0,17 (frangia) a +0,17
FASCIA = 1.555              # quota della fascia dei cappelli: sopra le orecchie, dove i capelli sono più larghi
R_FASCIA = 0.168            # raggio della fascia: abbraccia i capelli a punte


def pannello(p, corpo, zona, col, y0, y1, a0, a1, off=0.03, n=8, passo=0.04, b=None, piega=None):
    """Toppa curva sulla pelle della zona: da quota y0 a y1, dall'angolo a0 ad a1 (0 = davanti). piega(y, a) = scarto in più."""
    rings = []
    for y in quote(y0, y1, passo):
        rings.append([corpo.punto(zona, y, a0 + (a1 - a0) * k / (n - 1), off + (piega(y, a0 + (a1 - a0) * k / (n - 1)) if piega else 0.0)) for k in range(n)])
    pts = [q for r in rings for q in r]
    faces = []
    for i in range(len(rings) - 1):
        A, B = i * n, (i + 1) * n
        faces += [(A + k, A + k + 1, B + k + 1, B + k) for k in range(n - 1)]
    i0 = p._verts(pts, b or corpo.pesi(zona))
    p._faces(faces, i0, col, pts)
    return rings


def striscia(p, corpo, col, punti, larga=0.04, spessa=0.008, zone=('busto',), ref=None, n=4):
    """Fascia piatta (bretella, bandoliera, sciarpa) lungo una curva di punti. Sezione rettangolare larga × spessa."""
    p.tube(punti, [(larga / 2, spessa / 2)] * len(punti), col, corpo.pesi(zone), n=n, res=3, caps=('flat', 'flat'), sq=8.0, a0=math.pi / 4, ref=ref)


def filo(p, corpo, col, punti, r=0.008, zone=('busto',), n=5):
    p.tube(punti, [r] * len(punti), col, corpo.pesi(zone), n=n, res=3, caps=('flat', 'flat'))


def su(corpo, zona, y, a, off, c=None):
    return corpo.punto(zona, y, a, off, c=c)


def colletto(p, corpo, col, y0=1.33, y1=1.4, off=0.03, n=14, svasa=0.01, aperto=0):
    """Colletto alto attorno al collo (cilindro un po' svasato). aperto = gradi tolti davanti (colletto a V aperto)."""
    rings = []
    for i, y in enumerate((y0, (y0 + y1) / 2, y1)):
        rings.append(corpo.anello(('busto', 'testa'), y, n, off + svasa * i, c=(0.0, 0.01)))
    if not aperto:
        p.loft(rings, col, corpo.pesi(('busto', 'testa')))
        return rings
    m = n
    ang = [aperto / 2 + (360 - aperto) * k / (m - 1) for k in range(m)]
    rr = [[corpo.punto(('busto', 'testa'), y, a, off + svasa * i, c=(0.0, 0.01)) for a in ang] for i, y in enumerate((y0, (y0 + y1) / 2, y1))]
    pts = [q for r in rr for q in r]
    faces = []
    for i in range(2):
        A, B = i * m, (i + 1) * m
        faces += [(A + k, A + k + 1, B + k + 1, B + k) for k in range(m - 1)]
    i0 = p._verts(pts, corpo.pesi(('busto', 'testa')))
    p._faces(faces, i0, col, pts)
    return rr


def toppa(p, corpo, zona, col, y, a, w, h, off=0.03, t=0.012, rz=0.0):
    """Scatola piatta appoggiata sulla pelle (tasca, placca, etichetta), girata verso fuori."""
    q = corpo.punto(zona, y, a, off)
    p.box(q, (w, h, t), col, corpo.pesi(zona), r=(0, -a, rz))
    return q


def pallino(p, corpo, zona, col, y, a, r=0.012, off=0.028, schiaccia=0.6):
    q = corpo.punto(zona, y, a, off)
    d = dir_a(a)
    p.ell(q, (r * (1 - abs(d[0]) * (1 - schiaccia)), r, r * (1 - abs(d[2]) * (1 - schiaccia))), col, corpo.pesi(zona), n=6, m=3)
    return q


# ---------------------------------------------------------------- cappelli (pesati tutti sull'osso Head)
def tornito(p, prof, col, n=16, c=(0.0, 0.0), sx=1.0, sz=1.0, caps=True, deform=None, sq=2.0):
    """Tornito attorno all'asse della testa: prof = [(r, y)] in quote assolute."""
    p.lathe(prof, col, 'Head', n=n, c=(c[0], 0.0, c[1]), sx=sx, sz=sz, caps=caps, deform=deform, sq=sq)


def tesa(p, col, y, r_in, r_out, spess=0.012, n=20, piega=0.0, c=(0.0, 0.0), sx=1.0, sz=1.0, col_sotto=None):
    """Tesa piatta (anello spesso) a quota y; piega > 0 alza il bordo esterno (cappello da cowboy), < 0 lo abbassa."""
    prof = [(r_in, y - spess / 2), (r_out, y - spess / 2 + piega), (r_out, y + spess / 2 + piega), (r_in, y + spess / 2)]
    p.lathe(prof, col if not col_sotto else (lambda q: col_sotto if q[1] < y - spess * 0.2 + piega * 0.5 else (col(q) if callable(col) else col)), 'Head', n=n, c=(c[0], 0.0, c[1]), sx=sx, sz=sz, caps=False)
    # chiude l'anello tra il primo e l'ultimo profilo
    p.lathe([(r_in, y + spess / 2), (r_in, y - spess / 2)], col, 'Head', n=n, c=(c[0], 0.0, c[1]), sx=sx, sz=sz, caps=False)


def a_testa(y, a, r):
    """Punto attorno alla testa a quota y, angolo a, raggio r."""
    d = dir_a(a)
    return (TESTA[0] + d[0] * r, y, TESTA[1] + d[2] * r)
