# MAREA — animali piloti dell'Isola delle Corse, gruppo b (#178): struzzo, gorilla, fenicottero, tartaruga.
# Vedi models_corse_piloti.py per lo stile. Riferimento: assets/concept/corse/corse_06_animali_piloti.jpg.
# Statici, in piedi, casco sotto il braccio sul lato +X, davanti −Z, pivot ai piedi.
import math
from lib import Mesh, Xf, beam
from corse_kit import C, sfera, casco


def _obj(m):
    return [m.build()]


# ---------------------------------------------------------------- helper locali
def _rr(hx, hz, y, c=0.06, cx=0.0, cz=0.0):
    """Anello rettangolare con gli angoli smussati (8 punti, stesso verso di Mesh.ring)."""
    c = min(c, hx * 0.9, hz * 0.9)
    return [(cx - hx + c, y, cz - hz), (cx + hx - c, y, cz - hz), (cx + hx, y, cz - hz + c), (cx + hx, y, cz + hz - c),
            (cx + hx - c, y, cz + hz), (cx - hx + c, y, cz + hz), (cx - hx, y, cz + hz - c), (cx - hx, y, cz - hz + c)]


def _loft(m, prof, col, top=None, bottom=None, cx=0.0, cz=0.0):
    """prof = [(y, hx, hz, smusso), ...] dal basso all'alto."""
    m.loft([_rr(hx, hz, y, c, cx, cz) for (y, hx, hz, c) in prof], C(col),
           top=C(top) if top else None, bottom=C(bottom) if bottom else None)


def _lerp(prof, y, k):
    if y <= prof[0][0]:
        return prof[0][k]
    for a, b in zip(prof, prof[1:]):
        if y <= b[0]:
            t = (y - a[0]) / ((b[0] - a[0]) or 1)
            return a[k] + (b[k] - a[k]) * t
    return prof[-1][k]


def _zf(prof, cz=0.0):
    """Funzione y -> z della faccia davanti del profilo."""
    return lambda y: cz - _lerp(prof, y, 2)


def _dF(m, x0, y0, x1, y1, zf, col, off=0.006):
    """Decalcomania piatta rivolta a −Z che segue il profilo del busto (bande, sponsor, stemmi)."""
    z0, z1 = zf(y0) - off, zf(y1) - off
    m.poly([(x1, y0, z0), (x0, y0, z0), (x0, y1, z1), (x1, y1, z1)], C(col))


def _dB(m, x0, y0, x1, y1, zb, col, off=0.006):
    """Decalcomania piatta rivolta a +Z sul dietro di un profilo (zb: y -> z della faccia dietro)."""
    z0, z1 = zb(y0) + off, zb(y1) + off
    m.poly([(x0, y0, z0), (x1, y0, z0), (x1, y1, z1), (x0, y1, z1)], C(col))


def _blocchi(m, zf, lista):
    """Sponsor a blocchetti: [(x0, y0, x1, y1, colore), ...]."""
    for x0, y0, x1, y1, col in lista:
        _dF(m, x0, y0, x1, y1, zf, col, 0.008)


def _arto(m, p0, p1, w, col, end=None, n=6, h=None):
    beam(m, p0, p1, w, h or w, C(col), end=C(end) if end else None, n=n)


def _pt(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)


def _fascia_arto(m, a, b, t0, t1, w, col, n=6):
    """Anello di colore (sponsor/banda) attorno a un arto, tra t0 e t1 della sua lunghezza."""
    beam(m, _pt(a, b, t0), _pt(a, b, t1), w, w, C(col), end=C(col), n=n)


def _scarpa(m, x, z=0.0, w=0.2, col='rosso', punta='nero_caldo', banda='pietra_chiara', alta=0.2, lung=0.42, suola='pietra_chiara'):
    """Scarpa da corsa: suola chiara, tomaia con puntale scuro, banda laterale, lacci e linguetta."""
    s = 1 if x >= 0 else -1
    z0 = z - lung * 0.7
    z1 = z + lung * 0.3
    m.box(x - w / 2 - 0.01, 0.0, z0 - 0.01, x + w / 2 + 0.01, 0.05, z1 + 0.01, C(suola))
    # tallone/caviglia alta
    m.box(x - w / 2, 0.05, z1 - lung * 0.45, x + w / 2, alta, z1, C(col))
    # collo del piede + puntale
    m.box(x - w / 2, 0.05, z0 + lung * 0.3, x + w / 2, alta * 0.62, z1 - lung * 0.45 + 0.01, C(col))
    m.box(x - w / 2, 0.05, z0, x + w / 2, alta * 0.5, z0 + lung * 0.3 + 0.01, C(punta))
    # banda laterale e lacci
    m.box(x + s * w / 2, 0.08, z1 - lung * 0.5, x + s * (w / 2 + 0.012), alta - 0.04, z1 - lung * 0.15, C(banda), skip=('top', 'bottom', 'front', 'back', 'left' if s > 0 else 'right'))
    m.box(x - 0.03, alta * 0.62, z1 - lung * 0.7, x + 0.03, alta * 0.62 + 0.012, z1 - lung * 0.4, C('pietra_chiara'), skip=('bottom',))
    m.box(x - w / 2 + 0.02, alta - 0.02, z1 - lung * 0.2, x + w / 2 - 0.02, alta + 0.02, z1 - 0.02, C('nero_caldo'), skip=('bottom',))


def _occhio(m, x, y, z, w=0.07, h=0.06, pupilla=0.035, sclera='pietra_chiara', pup='nero_caldo', dx=0.0):
    """Occhio duro, rivolto a −Z: sclera piatta e pupilla scura (dx sposta la pupilla verso il centro)."""
    m.box(x - w / 2, y - h / 2, z - 0.012, x + w / 2, y + h / 2, z, C(sclera), skip=('back',))
    m.box(x + dx - pupilla / 2, y - pupilla / 2, z - 0.02, x + dx + pupilla / 2, y + pupilla / 2 + 0.004, z - 0.008, C(pup), skip=('back',))


def _sopracciglio(m, x_in, x_out, y_in, y_out, z, sp=0.035, col='nero_caldo', prof=0.035):
    """Sopracciglio duro: più basso verso il centro (sguardo serio da F1)."""
    beam(m, (x_in, y_in, z), (x_out, y_out, z), prof, sp, C(col), end=C(col), n=4)


# ---------------------------------------------------------------- GORILLA
def cs_p_gorilla():
    """Gorilla pilota: spalle enormi, tuta nera e rossa col logo HR sul petto, stivali rossi, casco rosso sotto il braccio."""
    m = Mesh('cs_p_gorilla')
    # gambe e stivali
    for s in (-1, 1):
        cx = s * 0.22
        _loft(m, [(0.18, 0.15, 0.15, 0.04), (0.5, 0.18, 0.17, 0.05), (0.88, 0.21, 0.2, 0.06)], 'nero_caldo', bottom=None, cx=cx)
        # banda rossa esterna e ginocchiera
        beam(m, (s * 0.372, 0.2, 0.0), (s * 0.422, 0.86, 0.0), 0.03, 0.14, C('rosso'), end=C('rosso'), n=4)
        m.box(cx - 0.09, 0.46, -0.205, cx + 0.09, 0.6, -0.17, C('rosso'), skip=('back',))
        m.box(cx - 0.05, 0.5, -0.215, cx + 0.05, 0.56, -0.2, C('giallo'), skip=('back',))
        _scarpa(m, cx, 0.0, w=0.3, col='rosso', punta='nero_caldo', banda='nero_caldo', alta=0.24, lung=0.5)
    # busto
    torso = [(0.8, 0.42, 0.26, 0.07), (0.95, 0.5, 0.29, 0.09), (1.2, 0.62, 0.33, 0.12), (1.45, 0.74, 0.34, 0.14), (1.58, 0.55, 0.28, 0.14), (1.64, 0.32, 0.2, 0.1)]
    _loft(m, torso, 'nero_caldo', top='nero_caldo', bottom='nero_caldo')
    zf = _zf(torso)
    # fascia rossa centrale col logo, bande laterali, cintura, sponsor
    _dF(m, -0.34, 1.02, 0.34, 1.44, zf, 'rosso')
    _dF(m, -0.34, 1.02, 0.34, 1.06, zf, 'nero_caldo', 0.01)
    for sx in (-1, 1):
        _dF(m, sx * 0.4 - 0.045, 0.9, sx * 0.4 + 0.045, 1.42, zf, 'rosso', 0.006)
        _dF(m, sx * 0.4 - 0.012, 0.9, sx * 0.4 + 0.012, 1.42, zf, 'pietra_chiara', 0.012)
    _dF(m, -0.4, 0.82, 0.4, 0.9, zf, 'pietra_scura', 0.008)
    _dF(m, -0.08, 0.82, 0.08, 0.9, zf, 'giallo', 0.014)
    # logo H R (pietra_chiara)
    logo = [(-0.24, 1.12, -0.2, 1.36), (-0.1, 1.12, -0.06, 1.36), (-0.2, 1.22, -0.1, 1.27),
            (0.0, 1.12, 0.04, 1.36), (0.04, 1.31, 0.14, 1.36), (0.04, 1.22, 0.14, 1.27), (0.12, 1.27, 0.16, 1.33), (0.07, 1.12, 0.11, 1.22), (0.11, 1.12, 0.16, 1.2)]
    _blocchi(m, zf, [(-c, b, -a, d, 'pietra_chiara') for a, b, c, d in logo])
    _blocchi(m, zf, [(-0.58, 1.24, -0.46, 1.34, 'giallo'), (-0.58, 1.1, -0.5, 1.2, 'pietra_chiara'), (-0.5, 1.1, -0.44, 1.2, 'arancio'),
                     (0.46, 1.26, 0.6, 1.34, 'pietra_chiara'), (0.46, 1.12, 0.52, 1.22, 'giallo'), (0.54, 1.12, 0.6, 1.22, 'arancio'),
                     (-0.3, 0.94, -0.2, 1.0, 'giallo'), (0.2, 0.94, 0.3, 1.0, 'pietra_chiara')])
    zb = lambda y: _lerp(torso, y, 2)
    _dB(m, -0.4, 1.0, 0.4, 1.44, zb, 'rosso')
    _dB(m, -0.3, 1.1, 0.3, 1.34, zb, 'nero_caldo', 0.01)
    _dB(m, -0.2, 1.17, 0.2, 1.27, zb, 'pietra_chiara', 0.014)
    _dB(m, -0.4, 0.82, 0.4, 0.9, zb, 'pietra_scura', 0.008)
    # spalline rosse
    for s in (-1, 1):
        sfera(m, s * 0.76, 1.44, 0.0, 0.22, 0.17, 0.21, C('nero_caldo'), n=8, rings=2)
        m.box(s * 0.76 - 0.14, 1.575, -0.12, s * 0.76 + 0.14, 1.605, 0.12, C('rosso'), skip=('bottom',))
        m.box(s * 0.76 - 0.06, 1.5, -0.222, s * 0.76 + 0.06, 1.56, -0.2, C('pietra_chiara'), skip=('back',))
    # braccio sinistro (−X): mano sul fianco
    sh, el, wr = (-0.78, 1.38, 0.0), (-0.98, 1.02, 0.06), (-0.5, 0.9, -0.3)
    _arto(m, sh, el, 0.32, 'nero_caldo', 'nero_caldo', n=6)
    _arto(m, el, wr, 0.27, 'nero_caldo', 'nero_caldo', n=6)
    _fascia_arto(m, sh, el, 0.3, 0.45, 0.34, 'rosso')
    _fascia_arto(m, el, wr, 0.62, 0.74, 0.29, 'pietra_chiara')
    m.box(wr[0] - 0.1, wr[1] - 0.1, wr[2] - 0.12, wr[0] + 0.1, wr[1] + 0.1, wr[2] + 0.08, C('nero_caldo'), C('nero_caldo'))
    # braccio destro (+X) col casco
    sh, el, wr = (0.78, 1.38, 0.0), (1.0, 1.02, 0.02), (0.66, 0.88, -0.46)
    _arto(m, sh, el, 0.32, 'nero_caldo', 'nero_caldo', n=6)
    _arto(m, el, wr, 0.27, 'nero_caldo', 'nero_caldo', n=6)
    _fascia_arto(m, sh, el, 0.3, 0.45, 0.34, 'rosso')
    _fascia_arto(m, el, wr, 0.55, 0.66, 0.29, 'pietra_chiara')
    m.box(wr[0] - 0.11, wr[1] - 0.1, wr[2] - 0.14, wr[0] + 0.11, wr[1] + 0.1, wr[2] + 0.06, C('nero_caldo'), C('nero_caldo'))
    casco(m, 0.55, 1.02, -0.42, 0.21, 'rosso', visiera='nero_caldo', striscia='pietra_chiara')
    # testa: cranio con cresta, muso grigio, arcata sopraccigliare pesante
    sfera(m, 0, 1.66, -0.05, 0.3, 0.25, 0.28, C('nero_caldo'), n=8, rings=3)
    m.box(-0.09, 1.88, -0.12, 0.09, 1.94, 0.14, C('nero_caldo'), C('nero_caldo'))
    m.box(-0.23, 1.56, -0.36, 0.23, 1.8, -0.22, C('roccia'), C('roccia'))        # maschera della faccia
    m.box(-0.17, 1.5, -0.45, 0.17, 1.7, -0.34, C('pietra_scura'), C('pietra_scura'))   # muso
    m.box(-0.12, 1.58, -0.462, 0.12, 1.605, -0.448, C('nero_caldo'))              # bocca
    for s in (-1, 1):
        m.box(s * 0.07 - 0.03, 1.66, -0.462, s * 0.07 + 0.03, 1.69, -0.448, C('nero_caldo'))   # narici
        m.box(s * 0.3 - 0.03, 1.6, -0.2, s * 0.3 + 0.03, 1.72, -0.08, C('roccia'))             # orecchie
        m.box(s * 0.15, 1.46, -0.28, s * 0.3, 1.64, -0.1, C('nero_caldo'))                      # guance
    m.box(-0.25, 1.8, -0.4, 0.25, 1.865, -0.24, C('nero_caldo'), C('nero_caldo'))   # arcata sopraccigliare
    for s in (-1, 1):
        _occhio(m, s * 0.1, 1.76, -0.372, w=0.08, h=0.05, pupilla=0.035, sclera='legno', pup='nero_caldo')
        _sopracciglio(m, s * 0.03, s * 0.23, 1.805, 1.84, -0.43, sp=0.03, prof=0.04)
    return _obj(m)


# ---------------------------------------------------------------- STRUZZO
def _piuma(m, x, y, z, lung=0.26, r=0.07, rot=(180, 0, 0), col='nero_caldo'):
    """Piuma a punta (cono a 5 lati) con la base in (x, y, z), ruotata come serve."""
    m.push(Xf(t=(x, y, z), r=rot))
    m.cone(5, r, 0.0, lung, C(col))
    m.pop()


def cs_p_struzzo():
    """Struzzo pilota: collo lunghissimo, tuta bianca e rosa, piume nere sotto il braccio, becco arancio, scarpe rosa."""
    m = Mesh('cs_p_struzzo')
    # gambe: pantaloncini tuta, ginocchio e zampe nude sottili
    for s in (-1, 1):
        cx = s * 0.13
        _loft(m, [(0.8, 0.08, 0.08, 0.03), (1.0, 0.115, 0.11, 0.04)], 'pietra_chiara', cx=cx)
        m.box(cx + s * 0.1, 0.82, -0.045, cx + s * 0.118, 0.99, 0.045, C('rosa_neon'), skip=('left' if s > 0 else 'right',))
        _arto(m, (cx, 0.22, 0.0), (cx, 0.8, 0.0), 0.055, 'sabbia', None, n=4)
        m.box(cx - 0.05, 0.46, -0.05, cx + 0.05, 0.54, 0.05, C('sabbia_chiara'), C('sabbia_chiara'))
        m.box(cx - 0.045, 0.75, -0.045, cx + 0.045, 0.81, 0.045, C('rosa_neon'), C('rosa_neon'))   # fascetta
        for yy in (0.34, 0.62):
            m.box(cx - 0.035, yy, -0.04, cx + 0.035, yy + 0.04, -0.03, C('pietra_scura'))           # scaglie
        _scarpa(m, cx, 0.0, w=0.14, col='pietra_chiara', punta='rosa_neon', banda='rosa_neon', alta=0.21, lung=0.44, suola='nero_caldo')
    # busto che si stringe nel collo
    torso = [(0.96, 0.25, 0.16, 0.06), (1.2, 0.3, 0.19, 0.07), (1.4, 0.27, 0.17, 0.07), (1.5, 0.1, 0.08, 0.03)]
    _loft(m, torso, 'pietra_chiara', bottom='pietra_chiara', top='pietra_chiara')
    zf = _zf(torso)
    m.box(-0.095, 1.45, -0.095, 0.095, 1.53, 0.095, C('rosa_neon'), C('rosa_neon'))   # colletto
    for sx in (-1, 1):
        _dF(m, sx * 0.19 - 0.025, 0.98, sx * 0.19 + 0.025, 1.38, zf, 'rosa_neon', 0.006)
    _dF(m, -0.25, 0.96, 0.25, 1.02, zf, 'nero_caldo', 0.008)
    _dF(m, -0.05, 0.96, 0.05, 1.02, zf, 'giallo', 0.014)
    # stemma ali rosa sul petto (specchiato: +X sta a sinistra di chi guarda)
    _blocchi(m, zf, [(-0.15, 1.2, -0.1, 1.34, 'rosa_neon'), (-0.1, 1.14, -0.05, 1.28, 'rosa_neon'), (-0.05, 1.08, -0.01, 1.2, 'rosa_neon'),
                     (0.1, 1.2, 0.15, 1.34, 'rosa_neon'), (0.05, 1.14, 0.1, 1.28, 'rosa_neon'), (0.01, 1.08, 0.05, 1.2, 'rosa_neon')])
    _blocchi(m, zf, [(-0.27, 1.28, -0.2, 1.36, 'giallo'), (0.2, 1.28, 0.27, 1.36, 'nero_caldo'), (-0.12, 1.02, -0.04, 1.07, 'rosa_neon'),
                     (0.06, 1.02, 0.16, 1.07, 'arancio'), (-0.25, 1.06, -0.18, 1.13, 'nero_caldo'), (0.18, 1.06, 0.25, 1.13, 'giallo')])
    zb = lambda y: _lerp(torso, y, 2)
    _dB(m, -0.2, 1.1, 0.2, 1.2, zb, 'rosa_neon')
    _dB(m, -0.12, 1.22, -0.04, 1.3, zb, 'nero_caldo', 0.01)
    _dB(m, 0.04, 1.22, 0.12, 1.3, zb, 'giallo', 0.01)
    # collo lungo, leggermente a S
    pts = [(0.0, 1.5, 0.0), (0.0, 1.74, -0.025), (0.0, 1.92, -0.06), (0.0, 2.04, -0.1)]
    for a, b in zip(pts, pts[1:]):
        _arto(m, a, b, 0.115, 'sabbia_chiara', 'sabbia_chiara', n=6)
    for yy in (1.6, 1.74, 1.88):
        m.box(-0.05, yy, -0.08, 0.0, yy + 0.035, -0.063, C('pietra'))
    # testa e becco
    sfera(m, 0, 2.12, -0.11, 0.14, 0.115, 0.145, C('sabbia_chiara'), n=8, rings=3)
    m.box(-0.08, 2.06, -0.3, 0.08, 2.15, -0.2, C('arancio'), C('arancio'))
    m.box(-0.065, 2.07, -0.46, 0.065, 2.13, -0.3, C('arancio'), C('arancio'))
    m.box(-0.065, 2.05, -0.46, 0.065, 2.075, -0.2, C('legno_chiaro'), skip=('top',))
    m.box(-0.03, 2.085, -0.472, 0.03, 2.12, -0.455, C('legno'))
    m.box(-0.03, 2.2, -0.16, 0.03, 2.29, -0.07, C('pietra'))      # ciuffo
    m.box(-0.08, 2.19, -0.1, -0.03, 2.25, -0.03, C('pietra_scura'))
    for s in (-1, 1):
        _occhio(m, s * 0.085, 2.145, -0.245, w=0.09, h=0.085, pupilla=0.05, dx=-s * 0.006)
        _sopracciglio(m, s * 0.01, s * 0.14, 2.2, 2.245, -0.255, sp=0.035, prof=0.045)
        m.box(s * 0.11, 2.245, -0.255, s * 0.14, 2.285, -0.248, C('nero_caldo'))  # ciglia
    # ali nere: sinistra giù lungo il fianco, destra piegata col casco
    for s, (sh, el, wr) in ((-1, ((-0.32, 1.42, 0.02), (-0.42, 1.1, 0.06), (-0.4, 0.82, 0.1))), (1, ((0.32, 1.42, 0.02), (0.44, 1.12, 0.04), (0.32, 1.02, -0.3)))):
        m.box(sh[0] - 0.07, sh[1] - 0.1, -0.09, sh[0] + 0.07, sh[1] + 0.04, 0.1, C('pietra_chiara'), C('pietra_chiara'))   # manica tuta
        m.box(sh[0] - 0.072, sh[1] - 0.1, -0.092, sh[0] + 0.072, sh[1] - 0.07, 0.102, C('rosa_neon'), C('rosa_neon'))
        _arto(m, sh, el, 0.22, 'nero_caldo', 'nero_caldo', n=6)
        _arto(m, el, wr, 0.2, 'nero_caldo', 'nero_caldo', n=6)
        for k in range(5):
            t = k / 4.0
            p = _pt(el, wr, 0.15 + 0.85 * t)
            _piuma(m, p[0] + s * 0.07, p[1] - 0.08, p[2] - 0.1 + 0.03 * k, lung=0.2 + 0.05 * (k % 2), r=0.07, rot=(180, 0, s * 8))
    sfera(m, 0.0, 0.98, 0.26, 0.28, 0.2, 0.16, C('nero_caldo'), n=8, rings=3)       # coda
    for x in (-0.22, -0.08, 0.08, 0.22):
        _piuma(m, x, 1.05, 0.36, lung=0.36, r=0.08, rot=(-65, 0, x * 50))
    casco(m, 0.4, 1.1, -0.33, 0.18, 'pietra_chiara', visiera='nero_caldo', striscia='rosa_neon')
    return _obj(m)


# ---------------------------------------------------------------- FENICOTTERO
def cs_p_fenicottero():
    """Fenicottero pilota: collo a S, gambe sottili rosa, tuta bianca e rosa, becco nero-rosa, mano sul fianco."""
    m = Mesh('cs_p_fenicottero')
    for s in (-1, 1):
        cx = s * 0.11
        # coscia in tuta, gamba rosa con ginocchio che piega indietro
        _loft(m, [(0.82, 0.07, 0.07, 0.02), (1.02, 0.1, 0.1, 0.03)], 'pietra_chiara', cx=cx)
        m.box(cx + s * 0.085, 0.84, -0.03, cx + s * 0.105, 1.01, 0.03, C('rosa_neon'), skip=('left' if s > 0 else 'right',))
        kz = 0.06 if s > 0 else 0.02
        _arto(m, (cx, 0.82, 0.0), (cx, 0.56, kz), 0.055, 'rosa_neon', 'rosa_neon', n=4)
        _arto(m, (cx, 0.56, kz), (cx, 0.2, 0.0), 0.05, 'rosa_neon', 'rosa_neon', n=4)
        m.box(cx - 0.045, 0.52, kz - 0.045, cx + 0.045, 0.6, kz + 0.05, C('rosa_neon'), C('rosa_neon'))   # ginocchio
        m.box(cx - 0.06, 0.2, -0.05, cx + 0.06, 0.24, 0.05, C('rosa_neon'))
        _scarpa(m, cx, 0.0, w=0.13, col='pietra_chiara', punta='rosa_neon', banda='rosa_neon', alta=0.2, lung=0.42, suola='nero_caldo')
    torso = [(1.0, 0.19, 0.13, 0.05), (1.2, 0.23, 0.15, 0.06), (1.38, 0.22, 0.14, 0.06), (1.46, 0.1, 0.08, 0.03)]
    _loft(m, torso, 'pietra_chiara', bottom='pietra_chiara', top='pietra_chiara')
    zf = _zf(torso)
    m.box(-0.085, 1.42, -0.085, 0.085, 1.5, 0.085, C('rosa_neon'), C('rosa_neon'))
    for sx in (-1, 1):
        _dF(m, sx * 0.14 - 0.025, 1.02, sx * 0.14 + 0.025, 1.4, zf, 'rosa_neon', 0.006)
    _dF(m, -0.19, 1.0, 0.19, 1.05, zf, 'rosa_neon', 0.008)
    _dF(m, -0.045, 1.0, 0.045, 1.05, zf, 'giallo', 0.014)
    # stemma: rombo rosa e qualche sponsor
    _blocchi(m, zf, [(-0.03, 1.14, 0.03, 1.18, 'rosa_neon'), (-0.07, 1.18, 0.07, 1.22, 'rosa_neon'), (-0.1, 1.22, 0.1, 1.26, 'rosa_neon'),
                     (-0.07, 1.26, 0.07, 1.3, 'rosa_neon'), (-0.03, 1.3, 0.03, 1.34, 'rosa_neon'), (-0.02, 1.2, 0.02, 1.28, 'pietra_chiara'),
                     (-0.2, 1.26, -0.14, 1.32, 'giallo'), (0.14, 1.26, 0.2, 1.32, 'nero_caldo'), (-0.2, 1.12, -0.15, 1.18, 'nero_caldo'), (0.15, 1.12, 0.2, 1.18, 'arancio')])
    zb = lambda y: _lerp(torso, y, 2)
    _dB(m, -0.18, 1.08, 0.18, 1.16, zb, 'rosa_neon')
    _dB(m, -0.1, 1.2, -0.03, 1.3, zb, 'nero_caldo', 0.01)
    _dB(m, 0.03, 1.2, 0.1, 1.3, zb, 'giallo', 0.01)
    # collo a S (curva in avanti, poi indietro, poi la testa si protende)
    N = [(0.0, 1.46, 0.02), (-0.03, 1.58, -0.08), (-0.05, 1.72, -0.1), (-0.03, 1.84, -0.02), (0.0, 1.92, -0.06)]
    for a, b in zip(N, N[1:]):
        _arto(m, a, b, 0.13, 'rosa_neon', 'rosa_neon', n=6)
    for p in N[1:4]:
        sfera(m, p[0], p[1], p[2], 0.075, 0.075, 0.075, C('rosa_neon'), n=6, rings=2)
    # testa e becco (base chiara, punta nera piegata in giù)
    hx, hy, hz = 0.0, 2.0, -0.12
    sfera(m, hx, hy, hz, 0.125, 0.11, 0.125, C('rosa_neon'), n=8, rings=3)
    m.box(hx - 0.065, hy - 0.05, hz - 0.28, hx + 0.065, hy + 0.03, hz - 0.1, C('pietra_chiara'), C('pietra_chiara'))
    m.box(hx - 0.066, hy - 0.05, hz - 0.28, hx + 0.066, hy - 0.02, hz - 0.2, C('rosa_neon'), skip=('top', 'back'))
    beam(m, (hx, hy - 0.01, hz - 0.28), (hx, hy - 0.09, hz - 0.37), 0.13, 0.085, C('nero_caldo'), end=C('nero_caldo'), n=4)
    beam(m, (hx, hy - 0.09, hz - 0.37), (hx, hy - 0.2, hz - 0.37), 0.12, 0.07, C('nero_caldo'), end=C('nero_caldo'), n=4)
    for s in (-1, 1):
        _occhio(m, hx + s * 0.07, hy + 0.04, hz - 0.122, w=0.075, h=0.07, pupilla=0.045, dx=-s * 0.006)
        _sopracciglio(m, hx + s * 0.005, hx + s * 0.125, hy + 0.09, hy + 0.13, hz - 0.13, sp=0.032, prof=0.04)
    m.box(hx - 0.05, hy + 0.08, hz + 0.0, hx + 0.05, hy + 0.15, hz + 0.1, C('rosa_neon'))   # ciuffo
    # braccio sinistro (−X): mano sul fianco
    sh, el, wr = (-0.26, 1.38, 0.0), (-0.45, 1.12, 0.04), (-0.2, 1.02, -0.14)
    m.box(sh[0] - 0.05, 1.32, -0.06, sh[0] + 0.05, 1.44, 0.06, C('pietra_chiara'), C('pietra_chiara'))
    _arto(m, sh, el, 0.09, 'rosa_neon', 'rosa_neon', n=6)
    _arto(m, el, wr, 0.08, 'pietra_chiara', 'rosa_neon', n=6)
    _fascia_arto(m, el, wr, 0.55, 0.7, 0.1, 'rosa_neon')
    m.box(wr[0] - 0.05, wr[1] - 0.05, wr[2] - 0.06, wr[0] + 0.05, wr[1] + 0.05, wr[2] + 0.04, C('rosa_neon'), C('rosa_neon'))
    # braccio destro (+X) col casco
    sh, el, wr = (0.26, 1.38, 0.0), (0.36, 1.12, 0.02), (0.3, 1.04, -0.3)
    m.box(sh[0] - 0.05, 1.32, -0.06, sh[0] + 0.05, 1.44, 0.06, C('pietra_chiara'), C('pietra_chiara'))
    _arto(m, sh, el, 0.09, 'rosa_neon', 'rosa_neon', n=6)
    _arto(m, el, wr, 0.08, 'pietra_chiara', 'rosa_neon', n=6)
    _fascia_arto(m, el, wr, 0.55, 0.7, 0.1, 'rosa_neon')
    m.box(wr[0] - 0.05, wr[1] - 0.05, wr[2] - 0.08, wr[0] + 0.05, wr[1] + 0.05, wr[2] + 0.03, C('rosa_neon'), C('rosa_neon'))
    casco(m, 0.34, 1.14, -0.33, 0.17, 'pietra_chiara', visiera='nero_caldo', striscia='rosa_neon')
    # piume di coda rosa
    for x in (-0.08, 0.0, 0.08):
        _piuma(m, x, 1.04, 0.14, lung=0.3, r=0.045, rot=(-65, 0, x * 100), col='rosa_neon')
    return _obj(m)


# ---------------------------------------------------------------- TARTARUGA
def cs_p_tartaruga():
    """Tartaruga pilota: guscio sulla schiena, tuta verde con bande gialle e stemma-tartaruga, testa a becco, casco giallo."""
    m = Mesh('cs_p_tartaruga')
    skin = 'erba_scura'
    # guscio dietro la schiena: cupola a blocchi con scudi e bordo chiaro
    sh_ = [(0.5, 0.46, 0.1, 0.08), (0.78, 0.62, 0.3, 0.14), (1.1, 0.58, 0.3, 0.14), (1.38, 0.4, 0.2, 0.1), (1.48, 0.22, 0.1, 0.06)]
    _loft(m, sh_, 'legno_scuro', top='legno_scuro', bottom='legno_scuro', cz=0.4)
    zb = lambda y: 0.4 + _lerp(sh_, y, 2)
    _dB(m, -0.5, 0.6, 0.5, 0.7, zb, 'legno_chiaro', 0.008)           # bordo basso
    for x0, y0, x1, y1 in ((-0.14, 1.02, 0.14, 1.3), (-0.4, 0.8, -0.16, 1.04), (0.16, 0.8, 0.4, 1.04), (-0.14, 0.74, 0.14, 0.98), (-0.34, 1.06, -0.16, 1.26), (0.16, 1.06, 0.34, 1.26)):
        _dB(m, x0, y0, x1, y1, zb, 'legno', 0.01)
        _dB(m, x0 + 0.03, y0 + 0.03, x1 - 0.03, y1 - 0.03, zb, 'legno_chiaro' if (x0 * 7 + y0 * 3) % 2 > 1 else 'legno', 0.014)
    # gambe e stivali
    for s in (-1, 1):
        cx = s * 0.23
        _loft(m, [(0.16, 0.16, 0.16, 0.05), (0.4, 0.19, 0.19, 0.06), (0.66, 0.21, 0.2, 0.06)], 'bosco', cx=cx)
        beam(m, (s * 0.385, 0.2, 0.0), (s * 0.44, 0.66, 0.0), 0.03, 0.12, C('giallo'), end=C('giallo'), n=4)
        _scarpa(m, cx, 0.0, w=0.3, col='bosco', punta='nero_caldo', banda='giallo', alta=0.25, lung=0.5)
    torso = [(0.6, 0.38, 0.27, 0.08), (0.85, 0.52, 0.34, 0.1), (1.12, 0.56, 0.34, 0.11), (1.3, 0.44, 0.28, 0.1), (1.34, 0.3, 0.22, 0.08)]
    _loft(m, torso, 'bosco', top='bosco', bottom='bosco')
    zf = _zf(torso)
    # stemma: quadrato crema con tartaruga verde
    _dF(m, -0.27, 0.74, 0.27, 1.2, zf, 'sabbia_chiara', 0.006)
    _blocchi(m, zf, [(-0.15, 0.84, 0.15, 1.1, 'bosco'), (-0.1, 0.88, 0.1, 1.06, 'erba_scura'), (-0.04, 0.94, 0.04, 1.0, 'bosco'),
                     (-0.07, 1.1, 0.07, 1.17, 'bosco'), (-0.06, 1.17, 0.06, 1.19, 'bosco'), (-0.23, 0.78, -0.15, 0.86, 'bosco'), (0.15, 0.78, 0.23, 0.86, 'bosco'),
                     (-0.23, 1.06, -0.15, 1.14, 'bosco'), (0.15, 1.06, 0.23, 1.14, 'bosco'), (-0.04, 0.76, 0.04, 0.84, 'bosco')])
    for sx in (-1, 1):
        _dF(m, sx * 0.42 - 0.04, 0.64, sx * 0.42 + 0.04, 1.2, zf, 'giallo', 0.006)
    _dF(m, -0.38, 0.6, 0.38, 0.69, zf, 'nero_caldo', 0.008)
    _dF(m, -0.07, 0.6, 0.07, 0.69, zf, 'giallo', 0.014)
    _blocchi(m, zf, [(-0.5, 1.0, -0.4, 1.1, 'giallo'), (-0.5, 0.85, -0.44, 0.95, 'pietra_chiara'), (-0.43, 0.85, -0.37, 0.95, 'rosso'),
                     (0.4, 1.0, 0.5, 1.1, 'pietra_chiara'), (0.4, 0.85, 0.46, 0.95, 'arancio'), (0.47, 0.85, 0.52, 0.95, 'giallo'),
                     (-0.3, 1.2, -0.12, 1.26, 'giallo'), (0.1, 1.2, 0.28, 1.26, 'pietra_chiara')])
    # spalle
    for s in (-1, 1):
        sfera(m, s * 0.6, 1.16, 0.0, 0.17, 0.15, 0.17, C('bosco'), n=8, rings=2)
        m.box(s * 0.6 - 0.07, 1.2, -0.17, s * 0.6 + 0.07, 1.26, -0.12, C('giallo'), skip=('back',))
    # braccio sinistro (−X) lungo il fianco, pugno chiuso
    sh, el, wr = (-0.64, 1.1, 0.0), (-0.72, 0.84, -0.05), (-0.66, 0.6, -0.2)
    _arto(m, sh, el, 0.24, 'bosco', 'bosco', n=6)
    _arto(m, el, wr, 0.21, 'bosco', skin, n=6)
    _fascia_arto(m, sh, el, 0.35, 0.5, 0.26, 'giallo')
    m.box(wr[0] - 0.09, wr[1] - 0.14, wr[2] - 0.1, wr[0] + 0.09, wr[1] + 0.0, wr[2] + 0.08, C(skin), C(skin))
    # braccio destro (+X) col casco
    sh, el, wr = (0.64, 1.1, 0.0), (0.76, 0.84, 0.0), (0.58, 0.72, -0.42)
    _arto(m, sh, el, 0.24, 'bosco', 'bosco', n=6)
    _arto(m, el, wr, 0.21, 'bosco', skin, n=6)
    _fascia_arto(m, sh, el, 0.35, 0.5, 0.26, 'giallo')
    m.box(wr[0] - 0.1, wr[1] - 0.09, wr[2] - 0.12, wr[0] + 0.1, wr[1] + 0.09, wr[2] + 0.06, C(skin), C(skin))
    casco(m, 0.52, 0.9, -0.4, 0.2, 'giallo', visiera='nero_caldo', striscia='bosco')
    # collo e testa tonda a becco, sguardo duro con palpebre pesanti
    m.push(Xf(t=(0, -0.09, 0.0)))
    m.box(-0.18, 1.28, -0.24, 0.18, 1.46, 0.0, C(skin), C(skin))
    sfera(m, 0, 1.52, -0.2, 0.22, 0.19, 0.23, C(skin), n=8, rings=3)
    m.box(-0.14, 1.38, -0.5, 0.14, 1.52, -0.3, C(skin), C(skin))             # muso
    m.box(-0.13, 1.33, -0.49, 0.13, 1.42, -0.31, C('erba'), C('erba'))       # mascella
    m.box(-0.115, 1.395, -0.512, 0.115, 1.415, -0.488, C('nero_caldo'))      # bocca
    m.box(-0.13, 1.37, -0.512, -0.1, 1.395, -0.488, C('nero_caldo'))         # angoli giù
    m.box(0.1, 1.37, -0.512, 0.13, 1.395, -0.488, C('nero_caldo'))
    for s_ in (-1, 1):
        m.box(s_ * 0.045 - 0.015, 1.47, -0.512, s_ * 0.045 + 0.015, 1.5, -0.498, C('nero_caldo'))   # narici
        _occhio(m, s_ * 0.12, 1.58, -0.43, w=0.08, h=0.06, pupilla=0.04, sclera='giallo', dx=-s_ * 0.006)
        _sopracciglio(m, s_ * 0.02, s_ * 0.18, 1.625, 1.66, -0.44, sp=0.045, col='bosco', prof=0.05)
        m.box(s_ * 0.12 - 0.045, 1.55, -0.434, s_ * 0.12 + 0.045, 1.58, -0.424, C('erba_scura'))     # palpebra
    m.pop()
    return _obj(m)


MODELS = {'cs_p_struzzo': cs_p_struzzo, 'cs_p_gorilla': cs_p_gorilla, 'cs_p_fenicottero': cs_p_fenicottero, 'cs_p_tartaruga': cs_p_tartaruga}
