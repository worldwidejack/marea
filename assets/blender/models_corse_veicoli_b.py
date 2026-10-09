# MAREA — veicoli dell'Isola delle Corse, gruppo b (#178): moto d'acqua, bob, carrello da miniera.
# Vedi models_corse_veicoli.py per lo stile e docs/CORSE.md A6. Davanti −Z, pivot a terra al centro, seduta libera.
import math
from lib import Mesh, Xf, beam, face
from corse_kit import C, ruota, sfera, volante, fascia


def _obj(m):
    return [m.build()]


def _c(pts):
    return tuple(sum(p[k] for p in pts) / len(pts) for k in range(3))


def _d(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def sezioni(m, secs, reg, cap0=None, cap1=None, salta=None):
    """Scafo a sezioni: ogni sezione è una lista di punti 3D (stesso numero), spigolo j = punto j → j+1.
    reg: una regione o una lista per spigolo. Le facce sono orientate in fuori rispetto all'asse delle sezioni.
    salta(i, j) → True per omettere un pezzo di fianco."""
    n = len(secs[0])
    for i in range(len(secs) - 1):
        a, b = secs[i], secs[i + 1]
        mid = _c([_c(a), _c(b)])
        for j in range(n):
            if salta and salta(i, j):
                continue
            k = (j + 1) % n
            q = [a[j], a[k], b[k], b[j]]
            if q[0] == q[3]:
                q = q[:3]
            elif q[1] == q[2]:
                q = [q[0], q[1], q[3]]
            r = reg[j] if isinstance(reg, (list, tuple)) else reg
            face(m, q, r, _d(_c(q), mid))
    if cap0:
        face(m, list(secs[0]), cap0, _d(_c(secs[0]), _c(secs[1])))
    if cap1:
        face(m, list(secs[-1]), cap1, _d(_c(secs[-1]), _c(secs[-2])))


def scafo6(z, k, w, w2, y0, y1, y2):
    """Sezione a 6 punti: chiglia piatta (±k), spigolo (±w a y1), bordo alto (±w2 a y2).
    Spigoli: 0 fondo, 1 fianco basso dx, 2 fianco alto dx, 3 ponte, 4 fianco alto sx, 5 fianco basso sx."""
    return [(-k, y0, z), (k, y0, z), (w, y1, z), (w2, y2, z), (-w2, y2, z), (-w, y1, z)]


def rett(z, w, y0, y1):
    """Sezione rettangolare a 4 punti, larga ±w, da y0 a y1. Spigoli: 0 fondo, 1 dx, 2 sopra, 3 sx."""
    return [(-w, y0, z), (w, y0, z), (w, y1, z), (-w, y1, z)]


def scatola(m, x0, y0, z0, x1, y1, z1, reg, **o):
    m.box(x0, y0, z0, x1, y1, z1, C(reg) if not reg.startswith('p_') else reg, **o)


# ---------------------------------------------------------------------------------------------------------------
def cs_v_moto_acqua():
    """Moto d'acqua blu e bianca: scafo scuro, bordo blu, ponte bianco, cofano blu col muso bianco e giallo,
    sellone blu rialzato dietro, manubrio nero. Seduta libera sul sellone (y ~0.85, z ~0.4)."""
    m = Mesh('cs_v_moto_acqua')
    blu, abisso, bianco, giallo, nero = C('acqua_profonda'), C('abisso'), C('pietra_chiara'), C('giallo'), C('nero_caldo')

    # scafo: fondo piatto dietro, prua che sale a punta
    S = [(-1.2, 0.05, 0.08, 0.08, 0.32, 0.38, 0.46), (-0.95, 0.16, 0.3, 0.33, 0.13, 0.23, 0.46),
         (-0.45, 0.26, 0.44, 0.48, 0.0, 0.19, 0.46), (0.6, 0.29, 0.47, 0.51, 0.0, 0.19, 0.46),
         (1.12, 0.24, 0.44, 0.48, 0.0, 0.19, 0.46)]
    sc = [scafo6(*s) for s in S]
    sezioni(m, sc, abisso, cap0=abisso, cap1=abisso)
    # bordo blu vivo attorno allo scafo
    bo = [rett(s[0], s[3] + 0.035, 0.38, 0.5) for s in S]
    bo[0] = rett(S[0][0] - 0.03, S[0][3] + 0.03, 0.38, 0.5)
    sezioni(m, bo, blu, cap0=blu, cap1=blu)
    # ponte bianco
    pb = [rett(s[0], s[3] + 0.0, 0.5, 0.62) for s in S]
    pb[0] = rett(S[0][0] + 0.02, 0.05, 0.5, 0.62)
    sezioni(m, pb, bianco, cap0=bianco, cap1=bianco)
    # pedane: bordino bianco ai lati del sellone e striscia gialla
    for s in (-1, 1):
        m.box(s * 0.37 - 0.05, 0.62, -0.05, s * 0.37 + 0.05, 0.69, 1.0, bianco)
        m.box(s * 0.27 - 0.02, 0.62, 0.0, s * 0.27 + 0.02, 0.645, 0.95, giallo, skip=('bottom',))

    # cofano blu: sale dalla prua verso il manubrio
    cof = [rett(-1.02, 0.1, 0.62, 0.7), rett(-0.7, 0.26, 0.62, 0.86), rett(-0.4, 0.35, 0.62, 0.98), rett(-0.08, 0.36, 0.62, 1.0)]
    sezioni(m, cof, blu, cap0=blu, cap1=blu)
    yt = [0.7, 0.86, 0.98, 1.0]
    zs = [-1.02, -0.7, -0.4, -0.08]
    for i in range(3):   # striscia bianca sul cofano
        face(m, [(-0.1, yt[i] + 0.006, zs[i]), (0.1, yt[i] + 0.006, zs[i]), (0.1, yt[i + 1] + 0.006, zs[i + 1]), (-0.1, yt[i + 1] + 0.006, zs[i + 1])], bianco, (0, 1, 0))
    face(m, [(-0.1, 0.62, -1.02 - 0.004), (0.1, 0.62, -1.02 - 0.004), (0.1, 0.7, -1.02 - 0.004), (-0.1, 0.7, -1.02 - 0.004)], bianco, (0, 0, -1))
    def wz(z):   # semilarghezza del cofano a quota z
        pts = [(-1.02, 0.1), (-0.7, 0.26), (-0.4, 0.35), (-0.08, 0.36)]
        for (za, wa), (zb, wb) in zip(pts, pts[1:]):
            if za <= z <= zb:
                return wa + (wb - wa) * (z - za) / (zb - za)
        return pts[-1][1]
    for s in (-1, 1):   # macchia gialla a onda sul fianco del cofano
        g = [(-0.6, 0.63), (-0.08, 0.63), (-0.08, 0.92), (-0.34, 0.92)]
        face(m, [(s * (wz(z) + 0.006), y, z) for z, y in g], giallo, (s, 0, 0))

    # sellone blu: basso davanti, rialzato dietro
    se = [rett(0.0, 0.22, 0.62, 0.78), rett(0.4, 0.25, 0.62, 0.82), rett(0.85, 0.23, 0.62, 0.94), rett(1.04, 0.2, 0.62, 0.9)]
    sezioni(m, se, blu, cap0=blu, cap1=blu)
    # pompa dietro e fanalino
    m.box(-0.14, 0.16, 1.1, 0.14, 0.32, 1.22, nero)
    m.box(-0.07, 0.7, 1.03, 0.07, 0.8, 1.08, giallo, skip=('bottom',))

    # piantone e manubrio
    m.box(-0.1, 0.98, -0.18, 0.1, 1.08, -0.02, nero)
    beam(m, (0, 1.0, -0.12), (0, 1.2, -0.08), 0.11, 0.11, blu, end=blu)
    beam(m, (-0.22, 1.22, -0.06), (0.22, 1.22, -0.06), 0.07, 0.07, blu, end=blu)
    for s in (-1, 1):
        beam(m, (s * 0.22, 1.22, -0.06), (s * 0.46, 1.2, 0.08), 0.1, 0.1, nero, end=nero)
    return _obj(m)


# ---------------------------------------------------------------------------------------------------------------
def cs_v_bob():
    """Bob rosso a due posti in fila: scocca con striscia bianca sul muso, abitacolo aperto con due sedili neri,
    volante davanti, paraurti grigio ai fianchi e due pattini lunghi sotto. Sedute libere (y 0.55, z 0.2 e 0.8)."""
    m = Mesh('cs_v_bob')
    rosso, bianco, nero, grigio, scuro = C('rosso'), C('pietra_chiara'), C('nero_caldo'), C('pietra_scura'), C('roccia')
    yf = 0.42   # pavimento dell'abitacolo
    t = 0.08    # spessore delle pareti
    # (z, k, w, w2, y0, y1, y2)
    S = [(-1.3, 0.22, 0.37, 0.35, 0.3, 0.4, 0.62), (-1.05, 0.29, 0.45, 0.45, 0.26, 0.4, 0.7), (-0.6, 0.33, 0.49, 0.49, 0.24, 0.42, 0.78),
         (-0.15, 0.35, 0.52, 0.52, 0.24, 0.42, 0.86), (0.5, 0.35, 0.54, 0.54, 0.24, 0.42, 1.0),
         (1.0, 0.33, 0.52, 0.52, 0.24, 0.42, 1.06), (1.3, 0.2, 0.38, 0.38, 0.28, 0.4, 0.98)]
    sc = [scafo6(*s) for s in S]
    ic = 3   # prima sezione dell'abitacolo: dopo il cofano il ponte non si chiude più
    sezioni(m, sc, rosso, cap0=rosso, cap1=rosso, salta=lambda i, j: i >= ic and j == 3)
    # muso: striscia bianca sul ponte e davanti
    for i in range(ic):
        a, b = S[i], S[i + 1]
        face(m, [(-0.12, a[6] + 0.005, a[0]), (0.12, a[6] + 0.005, a[0]), (0.12, b[6] + 0.005, b[0]), (-0.12, b[6] + 0.005, b[0])], bianco, (0, 1, 0))
    face(m, [(-0.12, S[0][4], S[0][0] - 0.004), (0.12, S[0][4], S[0][0] - 0.004), (0.12, S[0][6], S[0][0] - 0.004), (-0.12, S[0][6], S[0][0] - 0.004)], bianco, (0, 0, -1))
    # bordo dell'abitacolo (bordo rosso) e pareti interne scure
    for i in range(ic, len(S) - 1):
        a, b = S[i], S[i + 1]
        for s in (-1, 1):
            face(m, [(s * a[3], a[6], a[0]), (s * b[3], b[6], b[0]), (s * (b[3] - t), b[6], b[0]), (s * (a[3] - t), a[6], a[0])], rosso, (0, 1, 0))
            face(m, [(s * (a[3] - t), a[6], a[0]), (s * (b[3] - t), b[6], b[0]), (s * (b[3] - t), yf, b[0]), (s * (a[3] - t), yf, a[0])], rosso, (-s, 0, 0))
        face(m, [(-(a[3] - t), yf, a[0]), ((a[3] - t), yf, a[0]), ((b[3] - t), yf, b[0]), (-(b[3] - t), yf, b[0])], scuro, (0, 1, 0))
    a = S[ic]
    face(m, [(-(a[3] - t), yf, a[0]), ((a[3] - t), yf, a[0]), ((a[3] - t), a[6], a[0]), (-(a[3] - t), a[6], a[0])], rosso, (0, 0, 1))   # cruscotto
    z = S[-1][0]
    face(m, [(-(S[-1][3] - t), yf, z - t), ((S[-1][3] - t), yf, z - t), ((S[-1][3] - t), S[-1][6], z - t), (-(S[-1][3] - t), S[-1][6], z - t)], rosso, (0, 0, -1))
    face(m, [(-S[-1][3], S[-1][6], z), (S[-1][3], S[-1][6], z), ((S[-1][3] - t), S[-1][6], z - t), (-(S[-1][3] - t), S[-1][6], z - t)], rosso, (0, 1, 0))
    # sedili neri: seduta bassa e schienale alto con la testa smussata
    for zc in (0.2, 0.8):
        m.box(-0.36, yf, zc - 0.22, 0.36, 0.55, zc + 0.22, nero)
        m.box(-0.36, 0.55, zc + 0.22, 0.36, 1.05, zc + 0.33, nero)
        m.box(-0.3, 1.05, zc + 0.23, 0.3, 1.16, zc + 0.32, nero)
        m.box(-0.36, 0.55, zc - 0.2, -0.3, 0.8, zc + 0.22, nero)   # fianchetti del sedile
        m.box(0.3, 0.55, zc - 0.2, 0.36, 0.8, zc + 0.22, nero)
    # volante
    volante(m, 0, 1.02, -0.04, 0.2, inclina=-30)
    # paraurti laterale grigio chiaro con punta bianca davanti
    for s in (-1, 1):
        beam(m, (s * 0.33, 0.45, -1.2), (s * 0.53, 0.45, -0.85), 0.07, 0.1, C('pietra'), end=C('pietra'))
        beam(m, (s * 0.53, 0.45, -0.85), (s * 0.53, 0.45, 1.0), 0.07, 0.1, C('pietra'), end=C('pietra'))
        m.box(s * 0.33 - 0.05, 0.4, -1.27, s * 0.33 + 0.05, 0.51, -1.17, bianco)
        # pattino lungo, con la punta rialzata
        beam(m, (s * 0.47, 0.06, -0.8), (s * 0.47, 0.06, 1.15), 0.12, 0.12, scuro, end=scuro)
        beam(m, (s * 0.47, 0.06, -0.8), (s * 0.47, 0.22, -1.22), 0.12, 0.1, scuro, end=scuro)
        beam(m, (s * 0.47, 0.06, 1.15), (s * 0.47, 0.15, 1.3), 0.12, 0.09, scuro, end=scuro)
        # puntoni tra scocca e pattino
        for zz in (-0.55, 0.0, 0.85):
            m.box(s * 0.47 - 0.05, 0.1, zz - 0.07, s * 0.47 + 0.05, 0.27, zz + 0.07, scuro)
    return _obj(m)


# ---------------------------------------------------------------------------------------------------------------
def cs_v_carrello_miniera():
    """Carrello da miniera: cassone di assi con fasce di ferro e borchie, carbone ammucchiato, quattro ruote
    ferrate e un pezzo di binario con traversine. Seduta libera sul carbone davanti (y ~0.9, z ~ -0.2)."""
    m = Mesh('cs_v_carrello_miniera')
    pietra, ferro, ferro_s, chiara = C('pietra'), C('pietra_scura'), C('roccia'), C('pietra_chiara')
    yb, yt = 0.44, 1.05
    hb = (0.4, 0.6)      # semi-larghezza e semi-lunghezza in basso
    hc = (0.52, 0.74)    # in alto

    def mezzo(y):
        t = (y - yb) / (yt - yb)
        return (hb[0] + (hc[0] - hb[0]) * t, hb[1] + (hc[1] - hb[1]) * t)

    def lato(s, ax, ya, yb2, reg, off=0.0):
        """Fascia di parete esterna: ax 'x' (lato ±x) o 'z' (lato ±z), tra ya e yb2, spostata in fuori di off."""
        ha, hb2 = mezzo(ya), mezzo(yb2)
        if ax == 'x':
            p = [(s * (ha[0] + off), ya, -(ha[1] + off)), (s * (ha[0] + off), ya, ha[1] + off), (s * (hb2[0] + off), yb2, hb2[1] + off), (s * (hb2[0] + off), yb2, -(hb2[1] + off))]
            face(m, p, reg, (s, 0.2, 0))
        else:
            p = [(-(ha[0] + off), ya, s * (ha[1] + off)), (ha[0] + off, ya, s * (ha[1] + off)), (hb2[0] + off, yb2, s * (hb2[1] + off)), (-(hb2[0] + off), yb2, s * (hb2[1] + off))]
            face(m, p, reg, (0, 0.2, s))

    # pareti di assi: tre assi per lato
    assi = [(0.56, 0.7, 'legno_chiaro'), (0.7, 0.84, 'legno'), (0.84, 0.97, 'legno_chiaro')]
    for s in (-1, 1):
        for ya, yb2, r in assi:
            lato(s, 'x', ya, yb2, C(r))
            lato(s, 'z', ya, yb2, C(r))
    # fondo e interno
    f = mezzo(0.56)
    face(m, [(-f[0], 0.56, -f[1]), (f[0], 0.56, -f[1]), (f[0], 0.56, f[1]), (-f[0], 0.56, f[1])], ferro_s, (0, -1, 0))
    # fascia di ferro in basso e cornice di ferro in alto (con bordo e interno)
    for s in (-1, 1):
        lato(s, 'x', yb, 0.56, ferro, 0.02)
        lato(s, 'z', yb, 0.56, ferro, 0.02)
        lato(s, 'x', 0.97, yt + 0.02, ferro, 0.035)
        lato(s, 'z', 0.97, yt + 0.02, ferro, 0.035)
    ho = mezzo(yt + 0.02)
    ho = (ho[0] + 0.035, ho[1] + 0.035)
    hi = (ho[0] - 0.11, ho[1] - 0.11)
    yc = yt + 0.02
    # bordo superiore piatto (anello)
    for s in (-1, 1):
        face(m, [(s * ho[0], yc, -ho[1]), (s * ho[0], yc, ho[1]), (s * hi[0], yc, hi[1]), (s * hi[0], yc, -hi[1])], pietra, (0, 1, 0))
        face(m, [(-ho[0], yc, s * ho[1]), (ho[0], yc, s * ho[1]), (hi[0], yc, s * hi[1]), (-hi[0], yc, s * hi[1])], pietra, (0, 1, 0))
        # interno scuro della cornice e delle pareti
        face(m, [(s * hi[0], yc, -hi[1]), (s * hi[0], yc, hi[1]), (s * (hi[0] - 0.05), 0.6, hi[1] - 0.05), (s * (hi[0] - 0.05), 0.6, -hi[1] + 0.05)], ferro_s, (-s, 0.3, 0))
        face(m, [(-hi[0], yc, s * hi[1]), (hi[0], yc, s * hi[1]), (hi[0] - 0.05, 0.6, s * (hi[1] - 0.05)), (-hi[0] + 0.05, 0.6, s * (hi[1] - 0.05))], ferro_s, (0, 0.3, -s))
    # angolari verticali di ferro con borchie
    for sx in (-1, 1):
        for sz in (-1, 1):
            a = mezzo(yb)
            b = mezzo(yt)
            beam(m, (sx * (a[0] + 0.03), yb, sz * (a[1] + 0.03)), (sx * (b[0] + 0.04), yt, sz * (b[1] + 0.04)), 0.11, 0.11, ferro, end=ferro)
            for y in (0.5, 0.92):
                mm = mezzo(y)
                m.box(sx * (mm[0] + 0.1) - 0.025, y - 0.025, sz * (mm[1] + 0.1) - 0.025, sx * (mm[0] + 0.1) + 0.025, y + 0.025, sz * (mm[1] + 0.1) + 0.025, chiara)

    # carbone: letto piano e mucchio di pezzi che sporge dal bordo dietro (davanti basso per il pilota)
    yl = 0.92
    face(m, [(-0.44, yl, -0.62), (0.44, yl, -0.62), (0.44, yl, 0.64), (-0.44, yl, 0.64)], C('nero_caldo'), (0, 1, 0))
    # (x, quota sul letto, z, semi-lati x y z, colore, rotazione)
    pezzi = [(-0.26, 0.11, 0.42, 0.16, 0.11, 0.15, 'nero_caldo', 12), (0.24, 0.12, 0.45, 0.16, 0.12, 0.15, 'roccia', 20), (0.0, 0.12, 0.5, 0.15, 0.12, 0.14, 'nero_caldo', 35),
             (-0.27, 0.1, 0.05, 0.14, 0.1, 0.13, 'roccia', 8), (0.28, 0.1, 0.08, 0.14, 0.1, 0.13, 'nero_caldo', 50), (-0.02, 0.11, 0.14, 0.14, 0.11, 0.13, 'roccia', 28),
             (-0.14, 0.27, 0.34, 0.14, 0.11, 0.13, 'roccia', 22), (0.14, 0.28, 0.36, 0.14, 0.11, 0.13, 'nero_caldo', 5), (0.0, 0.27, 0.08, 0.12, 0.1, 0.12, 'nero_caldo', 40),
             (0.0, 0.42, 0.34, 0.11, 0.09, 0.11, 'pietra_scura', 22), (-0.1, 0.4, 0.18, 0.1, 0.08, 0.1, 'nero_caldo', 10), (0.12, 0.4, 0.1, 0.1, 0.08, 0.1, 'roccia', 30),
             (-0.3, 0.05, -0.38, 0.1, 0.06, 0.1, 'nero_caldo', 20), (0.3, 0.05, -0.33, 0.1, 0.06, 0.1, 'roccia', 40), (0.0, 0.04, -0.48, 0.11, 0.05, 0.11, 'nero_caldo', 15)]
    for x, hy, z, sx, sy, sz, col, rot in pezzi:
        m.push(Xf(t=(x, yl + hy, z), r=(0, rot, 0)))
        m.box(-sx, -sy, -sz, sx, sy, sz, C(col))
        m.pop()

    # sotto: telaio, assali, ruote ferrate fuori dalla cassa, sui binari
    gx = 0.5
    m.box(-0.36, 0.38, -0.55, 0.36, yb, 0.55, ferro_s)
    m.box(-0.12, 0.3, -0.78, 0.12, 0.44, -0.6, pietra)    # respingente davanti
    ry = 0.335
    for zz in (-0.47, 0.47):
        beam(m, (-gx, ry, zz), (gx, ry, zz), 0.07, 0.07, ferro_s, end=ferro_s)
        for s in (-1, 1):
            x = s * gx
            beam(m, (x - 0.05, ry, zz), (x + 0.05, ry, zz), 0.38, 0.38, ferro_s, end=ferro_s, n=8)
            beam(m, (x + s * 0.03, ry, zz), (x + s * 0.075, ry, zz), 0.22, 0.22, pietra, end=pietra, n=6)
            beam(m, (x - s * 0.05, ry, zz), (x - s * 0.075, ry, zz), 0.46, 0.46, ferro_s, end=ferro_s, n=8)   # bordino interno

    # binario corto: due rotaie su traversine di legno
    for i, zz in enumerate((-0.96, -0.48, 0.0, 0.48, 0.96)):
        m.box(-0.7, 0.0, zz - 0.07, 0.7, 0.07, zz + 0.07, C('legno' if i % 2 else 'legno_scuro'))
    for s in (-1, 1):
        beam(m, (s * gx, 0.105, -1.1), (s * gx, 0.105, 1.1), 0.09, 0.07, ferro, end=ferro_s)
    return _obj(m)


MODELS = {'cs_v_moto_acqua': cs_v_moto_acqua, 'cs_v_bob': cs_v_bob, 'cs_v_carrello_miniera': cs_v_carrello_miniera}
