# MAREA — veicoli dell'Isola delle Corse, gruppo a (#178). Vedi models_corse_veicoli.py per lo stile e docs/CORSE.md A6.
# Concept: assets/concept/corse/corse_12_veicoli.jpg (riga alta: sportiva, fuoristrada, moto).
# Davanti −Z, pivot a terra al centro, il pilota si aggiunge dopo (seduta libera).
import math
from lib import Mesh, Xf, beam, face, fix_winding
from corse_kit import C, ruota, sfera, volante, fascia


def _obj(m):
    return [m.build()]


# ---------------------------------------------------------------- attrezzi locali
def _ring(s):
    """Sezione (z, hw, y0, y1[, xc]); hw può essere (largh. in basso, largh. in alto)."""
    z, hw, y0, y1 = s[:4]
    xc = s[4] if len(s) > 4 else 0.0
    hb, ht = hw if isinstance(hw, tuple) else (hw, hw)
    return [(xc - hb, y0, z), (xc + hb, y0, z), (xc + ht, y1, z), (xc - ht, y1, z)]


def pezzo(m, secs, col, caps=True):
    """Solido a sezioni rettangolari (loft chiuso), facce orientate all'esterno."""
    st = len(m.polys)
    cc = C(col)
    m.loft([_ring(s) for s in secs], cc, top=cc if caps else None, bottom=cc if caps else None)
    fix_winding(m, st)


def tubo(m, a, b, w, col, n=4, end=None):
    beam(m, a, b, w, w, C(col), end=C(end) if end else None, n=n)


def _lerp(a, b, t):
    return tuple(a[k] + (b[k] - a[k]) * t for k in range(3))


def lastra(m, c00, c10, c11, c01, u0, u1, v0, v1, col, n, off=(0, 0, 0)):
    """Quadro dentro il quadrilatero c00-c10-c11-c01 (parametri u lungo c00→c10, v verso c01), orientato verso n."""
    def P(u, v):
        p = _lerp(_lerp(c00, c10, u), _lerp(c01, c11, u), v)
        return (p[0] + off[0], p[1] + off[1], p[2] + off[2])
    face(m, [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)], C(col), n)


def strisce_alte(m, prof, xa, xb, col, dy=0.008):
    """Striscia sul dorso: prof = [(z, y), ...] da davanti a dietro; xa..xb in X."""
    for (za, ya), (zb, yb) in zip(prof, prof[1:]):
        face(m, [(xa, ya + dy, za), (xb, ya + dy, za), (xb, yb + dy, zb), (xa, yb + dy, zb)], C(col), (0, 1, 0))


def gomma_tassellata(m, x, z, r, w, cerchio='pietra', bordo='giallo'):
    """Ruota da fuoristrada: gomma piena + fascia di battistrada sfalsata (tasselli), cerchio esagonale con mozzo colorato."""
    y = r
    lato = 1 if x >= 0 else -1
    h = w / 2
    beam(m, (x - h, y, z), (x + h, y, z), 2 * r, 2 * r, C('nero_caldo'), end=C('nero_caldo'), n=10)
    beam(m, (x - h * 0.7, y, z), (x + h * 0.7, y, z), 2.14 * r, 2.14 * r, C('nero_caldo'), n=10, twist=math.pi / 10)
    xo = x + lato * (h + 0.012)
    for rr, col, dx in ((0.62 * r, cerchio, 0), (0.34 * r, bordo, lato * 0.008)):
        pts = [(xo + dx, y + rr * math.cos(a * math.pi / 3), z + rr * math.sin(a * math.pi / 3)) for a in range(6)]
        face(m, pts, C(col), (lato, 0, 0))


def ruota_moto(m, z, r, w):
    y = r
    beam(m, (-w / 2, y, z), (w / 2, y, z), 2 * r, 2 * r, C('nero_caldo'), end=C('nero_caldo'), n=10)
    beam(m, (-w / 2 - 0.025, y, z), (w / 2 + 0.025, y, z), 1.0 * r, 1.0 * r, C('pietra'), end=C('pietra_chiara'), n=6)


# ---------------------------------------------------------------- auto sportiva
def cs_v_sportiva():
    """Sportiva blu con le due strisce bianche sul cofano e sul tetto, alettone alto, fari bianchi."""
    m = Mesh('cs_v_sportiva')
    B, W = 'acqua_profonda', 'pietra_chiara'
    r = 0.3
    # profili del dorso, per le strisce e per il vetro
    hood = [(-1.25, 0.50), (-1.08, 0.64), (-0.48, 0.70)]
    # sotto-scocca scuro, dentro i passaruota
    m.box(-0.46, 0.2, -1.1, 0.46, 0.62, 1.1, C('pietra_scura'), C('pietra_scura'), skip=('top',))
    m.box(-0.5, 0.12, -1.0, 0.5, 0.22, 1.1, C('nero_caldo'), C('nero_caldo'))
    # muso, parafanghi, portiere, parafanghi dietro, coda
    pezzo(m, [(-1.25, 0.6, 0.22, 0.50), (-1.08, 0.72, 0.22, 0.64)], B)
    pezzo(m, [(-1.08, 0.74, 0.6, 0.64), (-0.48, 0.76, 0.6, 0.70)], B)
    pezzo(m, [(-0.48, 0.77, 0.22, 0.70), (0.5, 0.77, 0.22, 0.70)], B)
    pezzo(m, [(0.5, 0.76, 0.6, 0.70), (1.1, 0.74, 0.6, 0.76)], B)
    pezzo(m, [(1.1, 0.73, 0.22, 0.76), (1.25, 0.68, 0.22, 0.70)], B)
    # gonna laterale chiara
    for s in (-1, 1):
        m.box(s * 0.775 - 0.012, 0.22, -0.46, s * 0.775 + 0.012, 0.31, 0.48, C('pietra'), skip=('top', 'bottom'))
    # abitacolo (tetto basso, montanti inclinati)
    cab = [(-0.46, (0.66, 0.6), 0.66, 0.7), (0.0, (0.64, 0.54), 0.66, 1.08), (0.62, (0.64, 0.54), 0.66, 1.08), (1.05, (0.68, 0.6), 0.66, 0.78)]
    pezzo(m, cab, B)
    # parabrezza e lunotto scuri
    lastra(m, (-0.585, 0.71, -0.46), (0.585, 0.71, -0.46), (0.52, 1.08, 0.0), (-0.52, 1.08, 0.0), 0.06, 0.94, 0.1, 0.9, 'abisso', (0, 0.6, -0.8), off=(0, 0.006, -0.008))
    lastra(m, (-0.54, 1.08, 0.62), (0.54, 1.08, 0.62), (0.6, 0.78, 1.05), (-0.6, 0.78, 1.05), 0.1, 0.9, 0.12, 0.8, 'abisso', (0, 0.6, 0.8), off=(0, 0.006, 0.008))
    # finestrini laterali (due, con montante)
    for s in (-1, 1):
        def sx(z, y):  # x sulla fiancata dell'abitacolo
            f = (y - 0.66) / ((1.08 if z < 0.62 else 1.08 - (z - 0.62) / 0.43 * 0.3) - 0.66)
            hb, ht = (0.64, 0.54) if z < 0.62 else (0.64 + (z - 0.62) / 0.43 * 0.04, 0.54 + (z - 0.62) / 0.43 * 0.06)
            return s * (hb + (ht - hb) * f + 0.008)
        for z0, z1 in ((-0.04, 0.36), (0.44, 0.86)):
            top = lambda z: min(1.0, 1.04 if z < 0.62 else 1.04 - (z - 0.62) / 0.43 * 0.3) - 0.04
            pts = [(sx(z0, 0.76), 0.76, z0), (sx(z1, 0.76), 0.76, z1), (sx(z1, top(z1)), top(z1), z1), (sx(z0, top(z0)), top(z0), z0)]
            face(m, pts, C('abisso'), (s, 0, 0))
    # strisce bianche: cofano + muso, tetto + lunotto
    for xa, xb in ((0.1, 0.2), (-0.2, -0.1)):
        strisce_alte(m, hood, xa, xb, W)
        strisce_alte(m, [(0.0, 1.08), (0.62, 1.08), (1.05, 0.78)], xa - 0.0, xb, W)
    # fari (bianchi), frecce arancio, presa d'aria nera, spoiler anteriore
    for s in (-1, 1):
        m.box(s * 0.5 - 0.15, 0.32, -1.27, s * 0.5 + 0.15, 0.44, -1.2, C(W), skip=('back',))
        m.box(s * 0.62 - 0.05, 0.25, -1.26, s * 0.62 + 0.05, 0.3, -1.2, C('arancio'), skip=('back',))
    m.box(-0.3, 0.24, -1.27, 0.3, 0.32, -1.2, C('nero_caldo'), skip=('back',))
    m.box(-0.74, 0.14, -1.28, 0.74, 0.22, -1.1, C('nero_caldo'), C('nero_caldo'))
    # strisce sul labbro del paraurti
    for xa, xb in ((0.1, 0.2), (-0.2, -0.1)):
        m.box(xa, 0.22, -1.262, xb, 0.38, -1.25, C(W), skip=('back',))
    # fanali dietro
    for s in (-1, 1):
        m.box(s * 0.5 - 0.2, 0.46, 1.22, s * 0.5 + 0.2, 0.58, 1.265, C('rosso'), skip=('front',))
    # specchietti
    for s in (-1, 1):
        m.box(s * 0.7 - 0.08, 0.74, -0.38, s * 0.7 + 0.08, 0.86, -0.26, C(B))
    # alettone alto su due supporti
    for s in (-1, 1):
        tubo(m, (s * 0.36, 0.7, 1.08), (s * 0.36, 1.1, 1.12), 0.07, 'nero_caldo')
        m.box(s * 0.76 - 0.03, 1.02, 0.96, s * 0.76 + 0.03, 1.18, 1.32, C(B))
    m.box(-0.78, 1.1, 0.96, 0.78, 1.17, 1.32, C(B), C(B))
    for xa, xb in ((0.06, 0.16), (-0.16, -0.06)):
        face(m, [(xa, 1.178, 1.28), (xb, 1.178, 1.28), (xb, 1.178, 1.0), (xa, 1.178, 1.0)], C(W), (0, 1, 0))
    # scarichi doppi e presa d'aria laterale
    for xx in (-0.3, 0.3):
        tubo(m, (xx, 0.3, 1.2), (xx, 0.3, 1.32), 0.1, 'pietra', n=6, end='nero_caldo')
    for s in (-1, 1):
        m.box(s * 0.775 - 0.01, 0.42, 0.28, s * 0.775 + 0.01, 0.54, 0.46, C('nero_caldo'), skip=('top', 'bottom'))
    # volante visibile dal parabrezza (seduta libera per il pilota)
    volante(m, 0, 0.84, -0.18, 0.15)
    # ruote: cerchi chiari grandi
    for s in (-1, 1):
        ruota(m, s * 0.6, -0.78, r=r, larga=0.28, cerchio='pietra')
        ruota(m, s * 0.6, 0.8, r=r, larga=0.28, cerchio='pietra')
    return _obj(m)


# ---------------------------------------------------------------- fuoristrada
def cs_v_fuoristrada():
    """Buggy giallo con gabbia antiribaltamento, due fari sul tetto, ruote grosse tassellate, paraurti grigio."""
    m = Mesh('cs_v_fuoristrada')
    G, H = 'arancio', 'giallo'
    r = 0.38
    # pianale e telaio
    m.box(-0.4, 0.3, -0.95, 0.4, 0.4, 1.0, C('pietra_scura'), C('pietra_scura'))
    # cofano e fiancate
    pezzo(m, [(-1.05, 0.38, 0.4, 0.64), (-0.3, 0.46, 0.4, 0.86)], G)
    for s in (-1, 1):
        m.box(s * 0.4 - 0.07, 0.38, -0.3, s * 0.4 + 0.07, 0.66, 0.62, C(G), C(G))
    strisce_alte(m, [(-1.05, 0.64), (-0.3, 0.86)], -0.2, 0.2, H)
    # parafanghi sopra le ruote davanti, agganciati al cofano
    for s in (-1, 1):
        m.box(s * 0.55 - 0.25, 0.82, -1.08, s * 0.55 + 0.25, 0.9, -0.5, C(G), C(H))
    for s in (-1, 1):
        m.box(s * 0.6 - 0.25, 0.84, 0.5, s * 0.6 + 0.25, 0.9, 1.14, C(G), C(G))
    # fari sul muso e griglia
    for s in (-1, 1):
        m.box(s * 0.3 - 0.1, 0.6, -1.09, s * 0.3 + 0.1, 0.74, -1.04, C('pietra_chiara'), skip=('back',))
    m.box(-0.2, 0.44, -1.08, 0.2, 0.62, -1.04, C('nero_caldo'), skip=('back',))
    # paraurti grigio a tubi
    tubo(m, (-0.5, 0.48, -1.15), (0.5, 0.48, -1.15), 0.07, 'pietra')
    tubo(m, (-0.5, 0.78, -1.15), (0.5, 0.78, -1.15), 0.06, 'pietra')
    for s in (-1, 1):
        tubo(m, (s * 0.5, 0.48, -1.15), (s * 0.5, 0.78, -1.15), 0.06, 'pietra')
        tubo(m, (s * 0.5, 0.48, -1.15), (s * 0.4, 0.45, -0.9), 0.06, 'pietra')
    # ammortizzatori rossi
    for s in (-1, 1):
        tubo(m, (s * 0.47, 0.44, -0.8), (s * 0.47, 0.86, -0.74), 0.09, 'rosso')
        tubo(m, (s * 0.47, 0.44, 0.8), (s * 0.47, 0.86, 0.74), 0.09, 'rosso')
    # motore e scarico dietro
    m.box(-0.34, 0.4, 0.62, 0.34, 0.82, 1.1, C(G), C('pietra_scura'))
    m.box(-0.22, 0.82, 0.7, 0.22, 0.9, 1.0, C('nero_caldo'), C('nero_caldo'))
    tubo(m, (0.2, 0.5, 1.1), (0.2, 0.5, 1.28), 0.12, 'pietra', n=6, end='nero_caldo')
    tubo(m, (-0.4, 0.46, 1.2), (0.4, 0.46, 1.2), 0.07, 'pietra')
    # sedile nero (centrale), volante
    m.box(-0.28, 0.4, 0.0, 0.28, 0.56, 0.44, C('nero_caldo'), C('nero_caldo'))
    m.box(-0.28, 0.56, 0.4, 0.28, 1.08, 0.52, C('nero_caldo'), C('nero_caldo'))
    volante(m, 0, 0.98, -0.3, 0.16)
    # gabbia di tubi
    for s in (-1, 1):
        x = s * 0.44
        tubo(m, (x, 0.62, -0.3), (s * 0.4, 1.62, -0.08), 0.075, G)       # montante davanti
        tubo(m, (x, 0.6, 0.78), (s * 0.4, 1.62, 0.84), 0.075, G)          # montante dietro
        tubo(m, (s * 0.4, 1.62, -0.08), (s * 0.4, 1.62, 0.84), 0.075, G)  # longherone del tetto
        tubo(m, (x, 0.95, -0.28), (x, 0.95, 0.8), 0.06, G)                # corrimano
    tubo(m, (-0.4, 1.62, -0.08), (0.4, 1.62, -0.08), 0.075, G)
    tubo(m, (-0.4, 1.62, 0.84), (0.4, 1.62, 0.84), 0.075, G)
    tubo(m, (-0.4, 1.28, -0.19), (0.4, 1.28, -0.19), 0.05, 'pietra_scura')
    # due fari rotondi sul tetto
    for s in (-1, 1):
        tubo(m, (s * 0.2, 1.62, -0.08), (s * 0.2, 1.74, -0.12), 0.06, 'nero_caldo')
        tubo(m, (s * 0.2, 1.84, -0.1), (s * 0.2, 1.84, -0.2), 0.3, 'nero_caldo', n=8, end='nero_caldo')
        face(m, [(s * 0.2 + 0.1 * math.cos(a * math.pi / 4), 1.84 + 0.1 * math.sin(a * math.pi / 4), -0.208) for a in range(8)], C('pietra_chiara'), (0, 0, -1))
    # specchietto
    m.box(-0.6, 0.98, -0.34, -0.5, 1.1, -0.26, C('nero_caldo'))
    # ruote
    for s in (-1, 1):
        gomma_tassellata(m, s * 0.62, -0.82, r, 0.34)
        gomma_tassellata(m, s * 0.62, 0.82, r, 0.34)
    return _obj(m)


# ---------------------------------------------------------------- moto sportiva
def cs_v_moto():
    """Moto sportiva rossa con cupolino, forcelle gialle, serbatoio, sella nera e scarico grigio."""
    m = Mesh('cs_v_moto')
    R = 'rosso'
    # ruote
    ruota_moto(m, -0.68, 0.34, 0.15)
    ruota_moto(m, 0.7, 0.34, 0.22)
    # forcella: parte bassa chiara, alta gialla
    for s in (-1, 1):
        tubo(m, (s * 0.13, 0.34, -0.68), (s * 0.13, 0.52, -0.62), 0.09, 'pietra_chiara')
        tubo(m, (s * 0.13, 0.52, -0.62), (s * 0.13, 1.0, -0.43), 0.11, 'giallo')
    # parafango anteriore
    m.box(-0.12, 0.74, -0.9, 0.12, 0.8, -0.46, C(R), C(R))
    # carena alta (muso) e cupolino
    pezzo(m, [(-0.64, (0.1, 0.1), 0.82, 0.98), (-0.5, (0.2, 0.15), 0.68, 1.04), (-0.2, (0.27, 0.2), 0.6, 1.1)], R)
    pezzo(m, [(-0.4, (0.17, 0.15), 1.06, 1.1), (-0.12, (0.15, 0.13), 1.28, 1.32)], 'acqua_bassa')
    for s in (-1, 1):
        m.box(s * 0.11 - 0.06, 0.87, -0.655, s * 0.11 + 0.06, 0.95, -0.625, C('pietra_chiara'), skip=('back',))
    # carena bassa e fianchi
    pezzo(m, [(-0.46, (0.06, 0.14), 0.34, 0.68), (-0.2, (0.12, 0.28), 0.28, 0.8), (0.1, (0.16, 0.3), 0.28, 0.8), (0.3, (0.1, 0.2), 0.34, 0.7)], R)
    for s in (-1, 1):
        m.box(s * 0.29 - 0.008, 0.52, -0.12, s * 0.29 + 0.008, 0.64, 0.24, C('pietra_chiara'), skip=('top', 'bottom'))
    for s in (-1, 1):
        m.box(s * 0.29 - 0.012, 0.4, -0.34, s * 0.29 + 0.012, 0.5, -0.16, C('nero_caldo'), skip=('top', 'bottom'))
    # serbatoio, sella e codone
    pezzo(m, [(-0.2, (0.2, 0.15), 0.62, 1.1), (0.1, (0.2, 0.15), 0.62, 1.05), (0.34, (0.15, 0.13), 0.8, 0.93)], R)
    pezzo(m, [(0.3, 0.14, 0.8, 0.9), (0.68, 0.15, 0.8, 0.9)], 'nero_caldo')
    pezzo(m, [(0.62, 0.15, 0.8, 0.96), (1.04, 0.09, 0.9, 1.05)], R)
    m.box(-0.07, 0.93, 1.03, 0.07, 1.0, 1.07, C('arancio'), skip=('front',))
    # manubrio e specchietti
    tubo(m, (-0.34, 1.04, -0.08), (0.34, 1.04, -0.08), 0.05, 'nero_caldo')
    for s in (-1, 1):
        m.box(s * 0.34 - 0.03, 1.01, -0.12, s * 0.34 + 0.03, 1.07, -0.02, C('nero_caldo'))
        m.box(s * 0.3 - 0.05, 1.12, -0.38, s * 0.3 + 0.05, 1.2, -0.3, C('nero_caldo'))
        tubo(m, (s * 0.26, 1.04, -0.32), (s * 0.3, 1.14, -0.34), 0.03, 'nero_caldo')
    # motore, scarico, forcellone, pedane
    m.box(-0.14, 0.3, 0.2, 0.14, 0.72, 0.62, C('pietra_scura'), C('pietra'))
    m.box(-0.12, 0.5, 0.24, 0.12, 0.62, 0.5, C('pietra'), C('pietra_chiara'))
    tubo(m, (0.2, 0.34, 0.1), (0.22, 0.44, 1.0), 0.1, 'pietra', n=6, end='pietra_chiara')
    for s in (-1, 1):
        tubo(m, (s * 0.15, 0.4, 0.4), (s * 0.14, 0.34, 0.7), 0.07, 'pietra')
        m.box(s * 0.3 - 0.04, 0.3, 0.22, s * 0.3 + 0.04, 0.35, 0.36, C('pietra_scura'))
    tubo(m, (0.0, 0.74, 0.6), (0.0, 0.46, 0.66), 0.07, 'pietra_scura')
    return _obj(m)


MODELS = {'cs_v_sportiva': cs_v_sportiva, 'cs_v_fuoristrada': cs_v_fuoristrada, 'cs_v_moto': cs_v_moto}
