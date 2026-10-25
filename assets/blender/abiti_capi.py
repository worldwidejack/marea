# MAREA — capi di base per i vestiti del Mercante: maglia (busto + maniche), pantaloni (bacino + gambe), veste lunga, scarpe e stivali,
# cintura, bottoni. Tutti su misura del chr_base (abiti_kit.Corpo). Ogni ricetta in abiti_set_*.py li combina e ci cuce sopra i dettagli.
import math
from abiti_kit import dir_a

SPALLA = {'L': (-0.17, 1.24, 0.0), 'R': (0.17, 1.24, 0.0)}
POLSO = {'L': (-0.219, 0.773, 0.0), 'R': (0.219, 0.773, 0.0)}
SX = {'L': -1, 'R': 1}


def _lerp(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def asse_braccio(corpo, s, y):
    """Centro del braccio a quota y: la linea delle ossa spostata dove sta davvero la carne (misurata tra 0,85 e 1,05 m)."""
    key = ('asse', s)
    if key not in corpo._centri:
        dx = dz = 0.0; k = 0
        for yy in (0.86, 0.9, 0.94, 0.98, 1.02):
            c = corpo.centro('braccio.' + s, yy)
            if c:
                t = (SPALLA[s][1] - yy) / (SPALLA[s][1] - POLSO[s][1])
                b = _lerp(SPALLA[s], POLSO[s], t)
                dx += c[0] - b[0]; dz += c[1] - b[2]; k += 1
        corpo._centri[key] = (dx / max(1, k), dz / max(1, k))
    dx, dz = corpo._centri[key]
    t = (SPALLA[s][1] - y) / (SPALLA[s][1] - POLSO[s][1])
    b = _lerp(SPALLA[s], POLSO[s], t)
    return (b[0] + dx, b[2] + dz)


def quote(a, b, passo):
    n = max(1, int(round(abs(b - a) / passo)))
    return [a + (b - a) * k / n for k in range(n + 1)]


def busto(p, corpo, col, y0=0.80, y1=1.30, off=0.022, n=16, collo=True, collo_off=0.02, sx=1.0, sz=1.0, flare=None, passo=0.04, bottom=False):
    """Busto della maglia da y0 alle spalle, poi il giro collo. off: numero o funzione (a, y). flare(y) = scarto in più (campana)."""
    rings = []
    # davanti, vicino al collo, il chr_base ha il colletto a V della sua camicia che sporge: lì un filo di stoffa in più
    o_di = lambda y, extra=0.0: (lambda a: (off(a, y) if callable(off) else off) + (flare(y) if flare else 0.0) + extra
                                 + (0.014 * max(0.0, math.cos(math.radians(a))) ** 2 if y > 1.22 else 0.0))
    # orlo: un filo più largo, così copre bene i pantaloni sotto
    rings.append(corpo.anello('busto', y0, n, o_di(y0, 0.012), sx=sx, sz=sz))
    for y in quote(y0, y1, passo)[1:]:
        # sopra le ascelle la maglia avvolge anche le spalle (le braccia fanno parte dell'anello): niente pelle tra busto e manica
        zona = ('busto', 'braccio.L', 'braccio.R') if y >= 1.14 else 'busto'
        rings.append(corpo.anello(zona, y, n, o_di(y), c=(0.0, 0.01) if y >= 1.14 else None, sx=sx, sz=sz))
    if collo:
        rings.append(corpo.anello(('busto', 'testa'), 1.33, n, off=collo_off + 0.006, c=(0.0, 0.01)))
        rings.append(corpo.anello(('busto', 'testa'), 1.355, n, off=collo_off, c=(0.0, 0.008)))
        rings.append(corpo.anello(('busto', 'testa'), 1.372, n, off=collo_off, c=(0.0, 0.008)))
    p.loft(rings, col, corpo.pesi(('busto', 'testa', 'braccio.L', 'braccio.R') if collo else ('busto', 'braccio.L', 'braccio.R')), bottom=bottom)
    return rings


def manica(p, corpo, s, col, y_fine=1.0, y_top=1.21, off=0.018, n=10, largo=0.0, passo=0.045, polsino=None, chiusa=False):
    """Manica attorno al braccio s ('L' | 'R') dalla spalla a y_fine (1,0 = corta, 0,80 = lunga al polso). largo(y) o numero = scarto in più."""
    rings = []
    ys = quote(y_top, y_fine, passo)
    for y in ys:
        c = asse_braccio(corpo, s, y)
        lg = largo(y) if callable(largo) else largo
        # sopra le ascelle il busto della maglia avvolge già la spalla: lì la manica sta un filo più fuori (attaccatura raglan, niente sfarfallio)
        su = max(0.0, min(1.0, (y - 1.05) / 0.1))
        if y > 1.17:
            r = 0.07 + lg + off
            rings.append([(c[0] + dir_a(360 * k / n)[0] * r, y, c[1] + dir_a(360 * k / n)[2] * r) for k in range(n)])
        else:
            rings.append(corpo.anello('braccio.' + s, y, n, off + lg + 0.016 * su, c=c))
    p.loft(rings, col, corpo.pesi(('braccio.' + s, 'busto') if y_fine > 1.05 else 'braccio.' + s), bottom=chiusa)
    if polsino:
        y = ys[-1]
        c = asse_braccio(corpo, s, y)
        r0 = corpo.anello('braccio.' + s, y + 0.012, n, off + (largo(y) if callable(largo) else largo) + 0.008, c=c)
        r1 = corpo.anello('braccio.' + s, y - 0.012, n, off + (largo(y) if callable(largo) else largo) + 0.008, c=c)
        p.loft([r0, r1], polsino, corpo.pesi('braccio.' + s))
    return rings


def maniche(p, corpo, col, **kw):
    return {s: manica(p, corpo, s, col, **kw) for s in 'LR'}


def bacino(p, corpo, col, y_top=0.95, y_giu=0.58, off=0.02, n=16, sx=1.0, sz=1.0, passo=0.05, chiudi=True):
    """Parte alta dei pantaloni: dalla vita al cavallo, un anello attorno a tutte e due le cosce, chiuso sotto (il cavallo)."""
    rings = []
    for y in quote(y_top, y_giu, passo):
        rings.append(corpo.anello(('busto', 'gamba.L', 'gamba.R'), y, n, off + (0.012 if y < 0.67 else 0.0), c=(0.0, 0.008), sx=sx, sz=sz))
    p.loft(rings, col, corpo.pesi(('busto', 'gamba.L', 'gamba.R')), top=False, bottom=False)
    if chiudi:
        r = rings[-1]
        c = (0.0, rings[-1][0][1] + 0.01, sum(q[2] for q in r) / len(r))
        p.loft([r], col, corpo.pesi(('busto', 'gamba.L', 'gamba.R')), bottom=True, cap_pt=c)
    return rings


def gamba(p, corpo, s, col, y_top=0.66, y_fine=0.12, off=0.018, n=10, largo=0.0, passo=0.05, chiusa=False):
    """Gamba dei pantaloni da y_top in giù fino a y_fine (0,12 = alla caviglia, 0,45 = al ginocchio)."""
    rings = []
    for y in quote(y_top, y_fine, passo):
        lg = largo(y) if callable(largo) else largo
        rings.append(corpo.anello('gamba.' + s, y, n, off + lg))
    p.loft(rings, col, corpo.pesi('gamba.' + s), bottom=chiusa)
    return rings


def gambe(p, corpo, col, **kw):
    return {s: gamba(p, corpo, s, col, **kw) for s in 'LR'}


def risvolto(p, corpo, s, col, y, alto=0.03, off=0.03, n=10):
    """Anello di stoffa spessa (risvolto, polsino largo, bordo di stivale) attorno alla gamba s a quota y."""
    r0 = corpo.anello('gamba.' + s, y + alto / 2, n, off)
    r1 = corpo.anello('gamba.' + s, y - alto / 2, n, off)
    r0i = corpo.anello('gamba.' + s, y + alto / 2, n, off - 0.012)
    p.loft([r0i, r0, r1], col, corpo.pesi('gamba.' + s))


def scarpa(p, corpo, s, col, suola=None, alto=0.11, off=0.012, punta=0.0, n=12, gonfia=1.0):
    """Scarpa chiusa sopra la ciabatta del chr_base: anelli su misura del piede, suola scura sotto. alto = fin dove sale (0,3 = stivale).
    punta: allunga il davanti (stivaletti a punta). gonfia > 1 = scarponi tondi."""
    z = 'gamba.' + s
    # il piede: pareti che seguono il contorno della suola (stesso centro per tutti gli anelli), così l'infradito resta dentro;
    # poi il collo del piede si chiude sulla caviglia
    cb = corpo.centro(z, 0.012)
    rb = [corpo.raggio(z, 0.012, 360.0 * k / n, cb) or 0.08 for k in range(n)]
    forma = {-0.006: 1.0, 0.03: 1.03, 0.06: 0.98, 0.09: 0.82}
    rings = []
    for y, f in forma.items():
        ring = []
        for k in range(n):
            a = 360.0 * k / n
            r = max(corpo.raggio(z, y, a, cb) or 0.0, rb[k] * f) + off * gonfia + (punta * max(0.0, math.cos(math.radians(a))) ** 3 if y < 0.07 else 0.0)
            d = dir_a(a)
            ring.append((cb[0] + d[0] * r, y, cb[1] + d[2] * r))
        rings.append(ring)
    for y in [0.12] + ([y for y in quote(0.16, alto, 0.05)] if alto > 0.15 else []):
        rings.append(corpo.anello(z, y, n, off * gonfia + 0.008))
    sol = suola or col
    colf = lambda c: sol if c[1] < 0.016 else (col(c) if callable(col) else col)
    top = rings[-1]
    p.loft(rings, colf, corpo.pesi(z), bottom=True)
    return top


def scarpe(p, corpo, col, **kw):
    return {s: scarpa(p, corpo, s, col, **kw) for s in 'LR'}


def veste(p, corpo, col, y_top=0.95, y_giu=0.12, r_giu=0.30, off=0.02, n=16, passo=0.06, sz=0.85):
    """Gonna o veste lunga: dal fianco si allarga a campana fino a r_giu (raggio in fondo). Pesi su bacino e cosce (si muove col passo)."""
    rings = []
    for y in quote(y_top, y_giu, passo):
        if y > 0.7:
            rings.append(corpo.anello(('busto', 'gamba.L', 'gamba.R'), y, n, off, c=(0.0, 0.008)))
        else:
            t = (0.7 - y) / max(0.01, 0.7 - y_giu)
            r0 = 0.21 + off
            r = r0 + (r_giu - r0) * (t ** 1.2)
            rings.append([(dir_a(360 * k / n)[0] * r, y, 0.01 + dir_a(360 * k / n)[2] * r * sz) for k in range(n)])
    import gente_kit
    p.loft(rings, col, lambda q: p._w(q, gente_kit.SKIRT()) if q[1] < 0.72 else corpo.pesi(('busto', 'gamba.L', 'gamba.R'))(q))
    return rings


def cintura(p, corpo, col, y=0.93, alto=0.035, off=0.024, n=14, fibbia=None, fibbia_col=None):
    """Cintura attorno ai fianchi; fibbia = (larghezza, altezza) davanti."""
    r0 = corpo.anello('busto', y + alto / 2, n, off)
    r1 = corpo.anello('busto', y - alto / 2, n, off)
    p.loft([r0, r1], col, corpo.pesi('busto'))
    if fibbia:
        q = corpo.punto('busto', y, 0, off + 0.006)
        p.box(q, (fibbia[0], fibbia[1], 0.012), fibbia_col or '#F2C14E', corpo.pesi('busto'))
    return r0


def bottoni(p, corpo, col, ys, a=0.0, off=0.02, r=0.011, zona='busto'):
    for y in ys:
        q = corpo.punto(zona, y, a, off)
        p.ell(q, (r, r, r * 0.6), col, corpo.pesi(zona), n=6, m=3)


def su_pelle(corpo, zona, y, a, off):
    return corpo.punto(zona, y, a, off)
