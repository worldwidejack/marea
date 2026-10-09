# MAREA — veicoli dell'Isola delle Corse, gruppo a (#178). Vedi models_corse_veicoli.py per lo stile e docs/CORSE.md A6.
# Concept: assets/concept/corse/corse_12_veicoli.jpg (riga alta: sportiva, fuoristrada, moto).
# Davanti −Z, pivot a terra al centro, il pilota si aggiunge dopo (seduta libera).
import math
from lib import Mesh, Xf, beam, face, fix_winding, newell
from corse_kit import anello_xy
from corse_kit import C, ruota, sfera, volante, fascia, scatola_tonda, tubo_z, corpo_y


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


def tubo(m, a, b, w, col, n=8, end=None):
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


def tubo_arco(m, sezioni, reg, seg=2):
    """Come tubo_z ma per corpi con la pancia scavata (passaruota, parafanghi ad arco): fix_winding rispetto al baricentro
    sbaglierebbe i soffitti degli archi. Qui il verso si decide una volta sola, dalla faccia più alta (deve guardare in su)."""
    st = len(m.polys)
    m.loft([anello_xy(cx, cy, z, w, h, r, seg) for (z, cx, cy, w, h, r) in sezioni], reg, top=reg, bottom=reg)
    polys = m.polys[st:]
    alta = max(polys, key=lambda p: sum(q[1] for q in p[0]) / len(p[0]))
    if newell(alta[0])[1] < 0:
        for i, p in enumerate(polys):
            m.polys[st + i] = (list(reversed(p[0])),) + p[1:]


def sul_profilo(prof, z):
    """Quota y del profilo [(z, y), ...] (lineare tra i punti)."""
    for (za, ya), (zb, yb) in zip(prof, prof[1:]):
        if za <= z <= zb:
            return ya + (yb - ya) * (z - za) / (zb - za) if zb > za else ya
    return prof[0][1] if z < prof[0][0] else prof[-1][1]


def tratto(prof, z0, z1):
    """Il pezzo di profilo tra z0 e z1 (con i punti agli estremi)."""
    zs = sorted({z0, z1} | {z for z, _ in prof if z0 < z < z1})
    return [(z, sul_profilo(prof, z)) for z in zs]


def vetro(m, prof, z0, z1, hw, col='abisso', dy=0.006):
    """Vetro piatto che segue il dorso dell'abitacolo (tra z0 e z1, mezza larghezza hw)."""
    pr = tratto(prof, z0, z1)
    strisce_alte(m, pr, -hw, hw, col, dy=dy)


def gomma_tassellata(m, x, z, r, w, cerchio='pietra', bordo='giallo'):
    """Ruota da fuoristrada: gomma piena bombata + fascia di battistrada sfalsata (tasselli), cerchio con mozzo colorato."""
    y = r
    lato = 1 if x >= 0 else -1
    h = w / 2
    n = 12

    def an(xx, rr, tw=0.0, k=12):
        return [(xx, y + rr * math.cos(2 * math.pi * i / k + tw), z + rr * math.sin(2 * math.pi * i / k + tw)) for i in range(k)]
    st = len(m.polys)
    m.loft([an(x - h, r * 0.72), an(x, r * 1.0), an(x + h, r * 0.72)], C('nero_caldo'), top=C('nero_caldo'), bottom=C('nero_caldo'))
    fix_winding(m, st)
    st = len(m.polys)
    m.loft([an(x - h * 0.6, r * 0.97, math.pi / 6, 6), an(x, r * 1.12, math.pi / 6, 6), an(x + h * 0.6, r * 0.97, math.pi / 6, 6)], C('nero_caldo'))  # tasselli a 6 denti
    fix_winding(m, st)
    xo = x + lato * (h + 0.012)
    for rr, col, dx in ((0.62 * r, cerchio, 0), (0.34 * r, bordo, lato * 0.008)):
        pts = [(xo + dx, y + rr * math.cos(a * math.pi / 6), z + rr * math.sin(a * math.pi / 6)) for a in range(12)]
        face(m, pts, C(col), (lato, 0, 0))


def ruota_moto(m, z, r, w, n=12):
    """Ruota di moto: gomma bombata, cerchio chiaro che sporge da entrambi i lati."""
    y = r
    h = w / 2

    def an(xx, rr):
        return [(xx, y + rr * math.cos(2 * math.pi * i / n), z + rr * math.sin(2 * math.pi * i / n)) for i in range(n)]
    st = len(m.polys)
    m.loft([an(-h, r * 0.78), an(-h * 0.5, r * 0.99), an(h * 0.5, r * 0.99), an(h, r * 0.78)], C('nero_caldo'), top=C('nero_caldo'), bottom=C('nero_caldo'))
    fix_winding(m, st)
    beam(m, (-h - 0.025, y, z), (h + 0.025, y, z), 1.0 * r, 1.0 * r, C('pietra'), end=C('pietra_chiara'), n=8)


# ---------------------------------------------------------------- auto sportiva
def cs_v_sportiva():
    """Sportiva blu con le due strisce bianche sul cofano e sul tetto, alettone alto, fari bianchi."""
    m = Mesh('cs_v_sportiva')
    B, W = 'acqua_profonda', 'pietra_chiara'
    r = 0.3
    # sotto-scocca scuro (si vede dentro i passaruota) e fondo nero
    scatola_tonda(m, -0.46, 0.2, -1.1, 0.46, 0.55, 1.1, C('pietra_scura'), r=0.1, seg=2)
    scatola_tonda(m, -0.5, 0.12, -1.0, 0.5, 0.22, 1.1, C('nero_caldo'), r=0.04, seg=1)
    # scocca: un solo corpo tondo con i passaruota scavati (profilo ad arco), muso che si abbassa e si stringe
    def arco(dz):
        return min(0.56, 0.3 + math.sqrt(max(0.0, 0.33 ** 2 - dz ** 2)))
    DZ = (-0.34, -0.28, -0.16, 0.0, 0.16, 0.28, 0.34)
    sec = [(-1.25, 0.3, 0.48, 1.0, 0.1), (-1.17, 0.3, 0.58, 1.3, 0.13)]
    sec += [(-0.78 + dz, arco(dz), 0.68, 1.5, 0.16) for dz in DZ]
    sec += [(-0.4, 0.22, 0.70, 1.5, 0.16), (0.4, 0.22, 0.70, 1.5, 0.16)]
    sec += [(0.8 + dz, arco(dz), 0.74, 1.5, 0.16) for dz in DZ]
    sec += [(1.18, 0.3, 0.74, 1.36, 0.14), (1.25, 0.3, 0.68, 1.16, 0.1)]
    tubo_arco(m, [(z, 0.0, (b + t) / 2, w, t - b, rr) for (z, b, t, w, rr) in sec], C(B), seg=2)
    top = {z: t for (z, b, t, w, rr) in sec}
    # abitacolo tondo: parabrezza inclinato, tetto bombato, lunotto
    ct = [(-0.5, 0.72, 1.34, 0.025), (-0.28, 0.93, 1.26, 0.12), (0.0, 1.04, 1.18, 0.14), (0.35, 1.08, 1.18, 0.14), (0.7, 1.04, 1.18, 0.14), (0.9, 0.91, 1.24, 0.1), (1.05, 0.79, 1.3, 0.06)]
    tubo_z(m, [(z, 0.0, (0.66 + t) / 2, w, t - 0.66, rr) for (z, t, w, rr) in ct], C(B), seg=2)
    cprof = [(z, t) for (z, t, w, rr) in ct]
    # parabrezza e lunotto scuri, appoggiati sulle pendenze
    vetro(m, cprof, -0.46, -0.1, 0.38)
    vetro(m, cprof, 0.76, 1.0, 0.38)
    # finestrini laterali sulla fiancata verticale
    for s in (-1, 1):
        for z0, z1 in ((-0.02, 0.32), (0.4, 0.68)):
            face(m, [(s * 0.594, 0.76, z0), (s * 0.594, 0.76, z1), (s * 0.594, 0.95, z1), (s * 0.594, 0.95, z0)], C('abisso'), (s, 0, 0))
    # strisce bianche: cofano e muso (seguono il profilo), tetto e lunotto
    hood = sorted((z, t) for z, t in top.items() if z <= -0.48)
    for xa, xb in ((0.1, 0.2), (-0.2, -0.1)):
        strisce_alte(m, hood, xa, xb, W)
        strisce_alte(m, tratto(cprof, 0.0, 1.0), xa, xb, W, dy=0.012)
    # fari tondi (ellissoidi), frecce arancio, presa d'aria nera, labbro anteriore
    for s in (-1, 1):
        sfera(m, s * 0.46, 0.42, -1.2, 0.15, 0.065, 0.06, C(W), n=8, rings=2)
        sfera(m, s * 0.64, 0.32, -1.1, 0.05, 0.05, 0.05, C('arancio'), n=6, rings=2)
    sfera(m, 0, 0.33, -1.22, 0.3, 0.06, 0.05, C('nero_caldo'), n=10, rings=2)
    scatola_tonda(m, -0.74, 0.14, -1.28, 0.74, 0.22, -1.1, C('nero_caldo'), r=0.035, seg=2)
    # fanali dietro
    for s in (-1, 1):
        sfera(m, s * 0.46, 0.52, 1.22, 0.2, 0.06, 0.05, C('rosso'), n=8, rings=2)
    # gonna chiara e presa d'aria sulla fiancata (parte verticale della scocca)
    for s in (-1, 1):
        face(m, [(s * 0.754, 0.37, -0.36), (s * 0.754, 0.37, 0.36), (s * 0.754, 0.42, 0.36), (s * 0.754, 0.42, -0.36)], C('pietra'), (s, 0, 0))
        face(m, [(s * 0.754, 0.45, 0.14), (s * 0.754, 0.45, 0.34), (s * 0.754, 0.55, 0.34), (s * 0.754, 0.55, 0.14)], C('nero_caldo'), (s, 0, 0))
    # specchietti: gusci tondi su un piccolo stelo
    for s in (-1, 1):
        tubo(m, (s * 0.6, 0.78, -0.3), (s * 0.68, 0.82, -0.32), 0.04, B)
        sfera(m, s * 0.72, 0.82, -0.32, 0.09, 0.06, 0.08, C(B), n=8, rings=2)
    # alettone alto: ala tonda su due supporti tondi
    for s in (-1, 1):
        tubo(m, (s * 0.36, 0.7, 1.08), (s * 0.36, 1.1, 1.12), 0.08, 'nero_caldo')
        scatola_tonda(m, s * 0.76 - 0.03, 1.02, 0.96, s * 0.76 + 0.03, 1.18, 1.32, C(B), r=0.025, seg=1, muso=(1, 0.7, 0.0))
    scatola_tonda(m, -0.78, 1.1, 0.96, 0.78, 1.17, 1.32, C(B), r=0.032, seg=2)
    for xa, xb in ((0.06, 0.16), (-0.16, -0.06)):
        face(m, [(xa, 1.178, 1.28), (xb, 1.178, 1.28), (xb, 1.178, 1.0), (xa, 1.178, 1.0)], C(W), (0, 1, 0))
    # scarichi doppi
    for xx in (-0.3, 0.3):
        tubo(m, (xx, 0.32, 1.2), (xx, 0.32, 1.33), 0.11, 'pietra', n=10, end='nero_caldo')
    # volante visibile dal parabrezza (seduta libera per il pilota)
    volante(m, 0, 0.84, -0.18, 0.15)
    # ruote: cerchi chiari grandi, gomma bombata
    for s in (-1, 1):
        gomma_x(m, s * 0.6, -0.78, r, 0.28)
        gomma_x(m, s * 0.6, 0.8, r, 0.28)
    return _obj(m)


def gomma_x(m, x, z, r=0.3, larga=0.28, cerchio='pietra', n=12):
    """Ruota con la gomma bombata (spalle smussate, asse X) e il cerchio chiaro che sporge fuori."""
    y = r
    lato = 1 if x >= 0 else -1
    h = larga / 2

    def an(xx, rr):
        return [(xx, y + rr * math.cos(2 * math.pi * i / n), z + rr * math.sin(2 * math.pi * i / n)) for i in range(n)]
    st = len(m.polys)
    m.loft([an(x - h, r * 0.78), an(x, r * 1.0), an(x + h, r * 0.78)], C('nero_caldo'), top=C('nero_caldo'), bottom=C('nero_caldo'))
    fix_winding(m, st)
    beam(m, (x + lato * (h - 0.02), y, z), (x + lato * (h + 0.03), y, z), 1.1 * r, 1.1 * r, C(cerchio), end=C(cerchio), n=8)


# ---------------------------------------------------------------- fuoristrada
def cs_v_fuoristrada():
    """Buggy giallo con gabbia antiribaltamento, due fari sul tetto, ruote grosse tassellate, paraurti grigio."""
    m = Mesh('cs_v_fuoristrada')
    G, H = 'arancio', 'giallo'
    r = 0.38
    # pianale e telaio
    scatola_tonda(m, -0.4, 0.3, -0.95, 0.4, 0.4, 1.0, C('pietra_scura'), r=0.04, seg=1)
    # cofano tondo che sale verso l'abitacolo e fiancate morbide
    tubo_z(m, [(-1.05, 0, 0.52, 0.76, 0.24, 0.1), (-0.7, 0, 0.555, 0.84, 0.31, 0.13), (-0.3, 0, 0.63, 0.92, 0.46, 0.16)], C(G), seg=2)
    for s in (-1, 1):
        scatola_tonda(m, s * 0.4 - 0.07, 0.38, -0.3, s * 0.4 + 0.07, 0.66, 0.62, C(G), r=0.06, seg=2)
    strisce_alte(m, [(-1.05, 0.64), (-0.7, 0.71), (-0.3, 0.86)], -0.2, 0.2, H)
    # parafanghi ad arco sopra le ruote (davanti e dietro)
    for s in (-1, 1):
        for zc, x in ((-0.82, s * 0.6), (0.82, s * 0.6)):
            sez = [(zc - 0.3, x, 0.62), (zc - 0.12, x, 0.83), (zc + 0.12, x, 0.83), (zc + 0.3, x, 0.62)]
            tubo_arco(m, [(z, cx, cy, 0.52, 0.08, 0.035) for (z, cx, cy) in sez], C(G), seg=1)
    # fari sul muso e griglia
    for s in (-1, 1):
        sfera(m, s * 0.3, 0.67, -1.07, 0.1, 0.08, 0.04, C('pietra_chiara'), n=8, rings=2)
    sfera(m, 0, 0.53, -1.07, 0.2, 0.09, 0.04, C('nero_caldo'), n=8, rings=2)
    # paraurti grigio a tubi
    tubo(m, (-0.5, 0.48, -1.15), (0.5, 0.48, -1.15), 0.08, 'pietra', n=6)
    tubo(m, (-0.5, 0.78, -1.15), (0.5, 0.78, -1.15), 0.07, 'pietra', n=6)
    for s in (-1, 1):
        tubo(m, (s * 0.5, 0.48, -1.15), (s * 0.5, 0.78, -1.15), 0.07, 'pietra', n=6)
        tubo(m, (s * 0.5, 0.48, -1.15), (s * 0.4, 0.45, -0.9), 0.07, 'pietra', n=6)
    # ammortizzatori rossi
    for s in (-1, 1):
        tubo(m, (s * 0.47, 0.44, -0.8), (s * 0.47, 0.86, -0.74), 0.1, 'rosso', n=6)
        tubo(m, (s * 0.47, 0.44, 0.8), (s * 0.47, 0.86, 0.74), 0.1, 'rosso', n=6)
    # motore e scarico dietro
    scatola_tonda(m, -0.34, 0.4, 0.62, 0.34, 0.82, 1.1, C(G), r=0.12, seg=2)
    scatola_tonda(m, -0.22, 0.82, 0.7, 0.22, 0.9, 1.0, C('nero_caldo'), r=0.04, seg=1)
    tubo(m, (0.2, 0.5, 1.1), (0.2, 0.5, 1.28), 0.13, 'pietra', n=10, end='nero_caldo')
    tubo(m, (-0.4, 0.46, 1.2), (0.4, 0.46, 1.2), 0.08, 'pietra')
    # sedile nero (centrale), volante
    scatola_tonda(m, -0.28, 0.4, 0.0, 0.28, 0.56, 0.44, C('nero_caldo'), r=0.06, seg=2)
    scatola_tonda(m, -0.28, 0.56, 0.4, 0.28, 1.08, 0.52, C('nero_caldo'), r=0.055, seg=2)
    volante(m, 0, 0.98, -0.3, 0.16)
    # gabbia di tubi tondi, con i giunti a palla
    for s in (-1, 1):
        x = s * 0.44
        tubo(m, (x, 0.62, -0.3), (s * 0.4, 1.62, -0.08), 0.08, G)       # montante davanti
        tubo(m, (x, 0.6, 0.78), (s * 0.4, 1.62, 0.84), 0.08, G)          # montante dietro
        tubo(m, (s * 0.4, 1.62, -0.08), (s * 0.4, 1.62, 0.84), 0.08, G)  # longherone del tetto
        tubo(m, (x, 0.95, -0.28), (x, 0.95, 0.8), 0.065, G, n=6)              # corrimano
    tubo(m, (-0.4, 1.62, -0.08), (0.4, 1.62, -0.08), 0.08, G)
    tubo(m, (-0.4, 1.62, 0.84), (0.4, 1.62, 0.84), 0.08, G)
    tubo(m, (-0.4, 1.28, -0.19), (0.4, 1.28, -0.19), 0.055, 'pietra_scura', n=6)
    # due fari rotondi sul tetto
    for s in (-1, 1):
        tubo(m, (s * 0.2, 1.62, -0.08), (s * 0.2, 1.74, -0.12), 0.07, 'nero_caldo')
        tubo(m, (s * 0.2, 1.84, -0.1), (s * 0.2, 1.84, -0.2), 0.3, 'nero_caldo', n=12, end='nero_caldo')
        face(m, [(s * 0.2 + 0.1 * math.cos(a * math.pi / 6), 1.84 + 0.1 * math.sin(a * math.pi / 6), -0.208) for a in range(12)], C('pietra_chiara'), (0, 0, -1))
    # specchietto
    sfera(m, -0.58, 1.03, -0.3, 0.06, 0.07, 0.05, C('nero_caldo'), n=8, rings=2)
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
    # parafango anteriore ad arco sopra la ruota
    tubo_arco(m, [(-0.92, 0, 0.6, 0.22, 0.05, 0.022), (-0.8, 0, 0.72, 0.24, 0.05, 0.022), (-0.68, 0, 0.78, 0.24, 0.05, 0.022), (-0.56, 0, 0.74, 0.24, 0.05, 0.022), (-0.44, 0, 0.64, 0.22, 0.05, 0.022)], C(R), seg=1)
    # carena alta (muso) e cupolino
    tubo_z(m, [(-0.64, 0, 0.9, 0.18, 0.16, 0.07), (-0.5, 0, 0.86, 0.36, 0.36, 0.13), (-0.2, 0, 0.85, 0.54, 0.5, 0.18)], C(R), seg=2)
    tubo_z(m, [(-0.4, 0, 1.08, 0.34, 0.05, 0.02), (-0.12, 0, 1.3, 0.28, 0.05, 0.02)], C('acqua_bassa'), seg=1)
    for s in (-1, 1):
        sfera(m, s * 0.11, 0.91, -0.65, 0.065, 0.05, 0.03, C('pietra_chiara'), n=8, rings=2)
    # carena bassa e fianchi
    tubo_z(m, [(-0.46, 0, 0.51, 0.2, 0.34, 0.1), (-0.2, 0, 0.54, 0.5, 0.52, 0.19), (0.1, 0, 0.54, 0.54, 0.52, 0.19), (0.3, 0, 0.52, 0.34, 0.36, 0.13)], C(R), seg=2)
    for s in (-1, 1):
        face(m, [(s * 0.276, 0.52, -0.12), (s * 0.276, 0.52, 0.24), (s * 0.276, 0.64, 0.24), (s * 0.276, 0.64, -0.12)], C('pietra_chiara'), (s, 0, 0))
        face(m, [(s * 0.27, 0.42, -0.34), (s * 0.27, 0.42, -0.16), (s * 0.27, 0.5, -0.16), (s * 0.27, 0.5, -0.34)], C('nero_caldo'), (s, 0, 0))
    # serbatoio, sella e codone
    tubo_z(m, [(-0.2, 0, 0.86, 0.34, 0.44, 0.16), (0.1, 0, 0.84, 0.36, 0.42, 0.16), (0.34, 0, 0.865, 0.26, 0.13, 0.06)], C(R), seg=2)
    tubo_z(m, [(0.3, 0, 0.85, 0.28, 0.1, 0.045), (0.68, 0, 0.85, 0.3, 0.1, 0.045)], C('nero_caldo'), seg=1)
    tubo_z(m, [(0.62, 0, 0.88, 0.3, 0.16, 0.07), (1.04, 0, 0.975, 0.18, 0.15, 0.06)], C(R), seg=2)
    sfera(m, 0, 0.965, 1.05, 0.06, 0.035, 0.03, C('arancio'), n=8, rings=2)
    # manubrio e specchietti
    tubo(m, (-0.34, 1.04, -0.08), (0.34, 1.04, -0.08), 0.055, 'nero_caldo')
    for s in (-1, 1):
        tubo(m, (s * 0.34, 1.04, -0.12), (s * 0.34, 1.04, 0.0), 0.075, 'nero_caldo')
        sfera(m, s * 0.3, 1.16, -0.34, 0.07, 0.045, 0.05, C('nero_caldo'), n=8, rings=2)
        tubo(m, (s * 0.26, 1.04, -0.32), (s * 0.3, 1.14, -0.34), 0.035, 'nero_caldo')
    # motore, scarico, forcellone, pedane
    scatola_tonda(m, -0.14, 0.3, 0.2, 0.14, 0.72, 0.62, C('pietra_scura'), r=0.07, seg=2)
    scatola_tonda(m, -0.12, 0.5, 0.24, 0.12, 0.62, 0.5, C('pietra'), r=0.05, seg=1)
    tubo(m, (0.2, 0.34, 0.1), (0.22, 0.44, 1.0), 0.11, 'pietra', n=10, end='pietra_chiara')
    for s in (-1, 1):
        tubo(m, (s * 0.15, 0.4, 0.4), (s * 0.14, 0.34, 0.7), 0.08, 'pietra')
        scatola_tonda(m, s * 0.3 - 0.04, 0.3, 0.22, s * 0.3 + 0.04, 0.35, 0.36, C('pietra_scura'), r=0.02, seg=1)
    tubo(m, (0.0, 0.74, 0.6), (0.0, 0.46, 0.66), 0.08, 'pietra_scura')
    return _obj(m)


MODELS = {'cs_v_sportiva': cs_v_sportiva, 'cs_v_fuoristrada': cs_v_fuoristrada, 'cs_v_moto': cs_v_moto}
