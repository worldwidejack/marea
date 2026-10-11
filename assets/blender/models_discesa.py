# Discesa in mountain bike (#229): banco di prova in prima persona, cresta di montagna sul mare che entra in un bosco di abeti.
# Concept: assets/concept/discesa_mtb/mtb_frame_A_cresta.png (cresta: erba gialla-verde, fiori, sassi chiari coi licheni, pini)
# e mtb_frame_B_pineta.png (pineta: tronchi alti, sottobosco, radici sul sentiero). Look dell'hub delle Corse: low-poly, flat shading,
# colori SOLO dai campioni piatti `p_<colore>` dell'atlas (il client legge un texel per vertice). Metri veri, davanti −Z, pivot a terra.
#
# Montaggio della bici (coordinate del telaio: pivot a terra a metà interasse, X destra, Y su, −Z avanti; metri):
#   cs_d_bici_telaio   → origine della bici.
#   cs_d_bici_ruota    → posteriore in (0, 0.35, +0.625); anteriore in (0, 0.35, −0.625). Pivot sul mozzo, asse X: gira con rotation.x.
#                        Diametro 0,70 m (27,5"), interasse 1,25 m. Il disco del freno sta a sinistra (−X), come su tutte e due le ruote vere.
#   cs_d_bici_sterzo   → in (0, 0.35, −0.625) = mozzo anteriore, con rotation.x = +27° (asse di sterzo inclinato all'indietro,
#                        angolo di sterzo 63° sull'orizzontale). Nel suo spazio locale l'asse di sterzo è la Y: sterzare = rotation.y
#                        (ordine Euler 'XYZ' di three.js: prima gira attorno a Y locale, poi si inclina). Il mozzo anteriore è nel suo zero,
#                        quindi la ruota davanti può essere figlia dello sterzo in (0, 0, 0) senza rotazione.
#   cs_d_braccia       → centro del manubrio: (0, 1.05, −0.33) nel telaio (sterzo dritto), nessuna rotazione; nello spazio locale
#                        dello sterzo il centro del manubrio è (0, 0.7576, −0.0549): da figlie dello sterzo, lì con rotation.x = −27°.
#                        Le mani stringono le manopole: centro manopola (±0.3225, +0.015, +0.021) dal centro del manubrio.
import math
from lib import Mesh, Xf, face, fix_winding, newell, _sub, _dot, _cross, _norm
from atlas import h01
from corse_kit import sfera, tubo_z

RAKE = 27.0                      # inclinazione dell'asse di sterzo dalla verticale (gradi)
_CR, _SR = math.cos(math.radians(RAKE)), math.sin(math.radians(RAKE))
ASSE_ANT = (0.0, 0.35, -0.625)   # mozzo anteriore = pivot dello sterzo
ASSE_POST = (0.0, 0.35, 0.625)
MANUBRIO = (0.0, 1.05, -0.33)    # centro del manubrio nel telaio (= pivot di cs_d_braccia)


def C(n):
    return 'p_' + n


def _obj(m):
    return [m.build()]


def _add(a, b): return (a[0] + b[0], a[1] + b[1], a[2] + b[2])
def _mul(a, s): return (a[0] * s, a[1] * s, a[2] * s)
def _lerp(a, b, t): return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)


def sull_asse(L):
    """Punto dell'asse di sterzo a L metri dal mozzo anteriore (coordinate del telaio)."""
    return (0.0, ASSE_ANT[1] + L * _CR, ASSE_ANT[2] + L * _SR)


# ------------------------------------------------------------------ attrezzi
def tubo_col(m, punti, raggi, reg, n=6, cap0=None, cap1=None, a0=0.0, ref=None):
    """Tubo lungo una spezzata, un raggio per punto (0 = punta). reg: regione oppure funzione (tratto, faccia, normale) -> regione."""
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
    if ref is None:
        ref = (0, 1, 0) if abs(T[0][1]) < 0.9 else (1, 0, 0)
    a = _norm(_cross(T[0], ref))
    rings = []
    for p, r, t in zip(punti, raggi, T):
        a = _norm(_sub(a, _mul(t, _dot(a, t))))
        b = _cross(t, a)
        rings.append([_add(p, _add(_mul(a, r * math.cos(a0 + 2 * math.pi * j / n)), _mul(b, r * math.sin(a0 + 2 * math.pi * j / n)))) for j in range(n)])
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
            nrm = _norm(_sub(fc, q))
            face(m, pts, reg(i, j, nrm) if callable(reg) else reg, nrm)
    if cap0 and raggi[0] > 0:
        face(m, rings[0], cap0, _mul(T[0], -1))
    if cap1 and raggi[-1] > 0:
        face(m, rings[-1], cap1, T[-1])
    return rings


def _orienta(pts, c):
    """Normale del poligono rivolta via dal punto c."""
    n = newell(pts)
    fc = _mul(tuple(sum(q[k] for q in pts) for k in range(3)), 1.0 / len(pts))
    return n if _dot(n, _sub(fc, c)) >= 0 else _mul(n, -1)


def corteccia(seed, base='legno', scura='legno_scuro', chiara='legno_chiaro', p_chiara=0.12, p_scura=0.35):
    """Corteccia a placche: ogni faccia del tronco prende uno dei tre marroni della palette (hash fisso, niente random)."""
    def f(i, j, nrm):
        h = h01(i, j, seed)
        return C(chiara) if h < p_chiara else C(scura) if h < p_chiara + p_scura else C(base)
    return f


def taglio(m, centro, asse, r, n=8, a0=0.0):
    """Faccia di taglio di un tronco: anello di corteccia, legno chiaro, un anello di crescita, il cuore. asse = verso uscente."""
    asse = _norm(asse)
    ref = (0, 1, 0) if abs(asse[1]) < 0.9 else (1, 0, 0)
    u = _norm(_cross(asse, ref)); v = _cross(asse, u)
    c = _add(centro, _mul(asse, 0.004))
    ring = lambda rr: [_add(c, _add(_mul(u, rr * math.cos(a0 + 2 * math.pi * j / n)), _mul(v, rr * math.sin(a0 + 2 * math.pi * j / n)))) for j in range(n)]
    R = [ring(r * 1.03), ring(r * 0.84), ring(r * 0.5), ring(r * 0.4)]
    for (ra, rb), reg in zip(zip(R, R[1:]), ('legno_scuro', 'sabbia_chiara', 'legno_chiaro')):
        for j in range(n):
            jj = (j + 1) % n
            face(m, [ra[j], ra[jj], rb[jj], rb[j]], C(reg), asse)
    face(m, R[-1], C('sabbia_chiara'), asse)


def macchia(m, pts, nrm, reg, scala=0.6, k=6, seed=0):
    """Chiazza piatta (lichene, muschio) appoggiata al centro di una faccia, un po' staccata lungo la normale."""
    fc = _mul(tuple(sum(q[c] for q in pts) for c in range(3)), 1.0 / len(pts))
    r = min(math.dist(fc, q) for q in pts) * scala
    nrm = _norm(nrm)
    ref = (0, 1, 0) if abs(nrm[1]) < 0.9 else (1, 0, 0)
    u = _norm(_cross(nrm, ref)); v = _cross(nrm, u)
    c = _add(fc, _mul(nrm, 0.012))
    poly = []
    for i in range(k):
        a = 2 * math.pi * i / k + h01(seed, 3, 5)
        rr = r * (0.7 + 0.5 * h01(i, seed, 11))
        poly.append(_add(c, _add(_mul(u, rr * math.cos(a)), _mul(v, rr * math.sin(a)))))
    face(m, poly, reg, nrm)


def roccia(m, cx, cz, rx, ry, rz, seed, n=7, anelli=((0.0, 1.0), (0.35, 1.0), (0.7, 0.8), (0.93, 0.45)), licheni=4, giu=0.06, rot=0.0,
           chiara='pietra_chiara', media='pietra', lichene=('erba_chiara', 'erba_chiara', 'giallo')):
    """Sasso sfaccettato (pietra chiara e pietra) con le chiazze di lichene sulle facce rivolte in su. Base un po' interrata."""
    rings = []
    for k, (fy, fr) in enumerate(anelli):
        pts = []
        for i in range(n):
            a = rot + 2 * math.pi * (i + 0.5 * (k % 2)) / n
            j = 0.82 + 0.36 * h01(i, k, seed)
            dy = (h01(k, i, seed + 7) - 0.5) * 0.16 * ry if 0 < k else 0.0
            pts.append((cx + math.cos(a) * rx * fr * j, -giu + (ry + giu) * fy + dy, cz + math.sin(a) * rz * fr * j))
        rings.append(pts)
    top = (cx + rx * 0.15 * (h01(9, 9, seed) - 0.5), ry, cz + rz * 0.15 * (h01(8, 9, seed) - 0.5))
    allp = [p for r in rings for p in r] + [top]
    cen = _mul(tuple(sum(p[c] for p in allp) for c in range(3)), 1.0 / len(allp))
    cen = (cen[0], cen[1] * 0.6, cen[2])
    facce = []
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            j = (i + 1) % n
            facce.append([a[j], a[i], b[i], b[j]])
    for i in range(n):
        facce.append([rings[-1][i], rings[-1][(i + 1) % n], top])
    su = []
    for f, pts in enumerate(facce):
        nrm = _orienta(pts, cen)
        h = h01(f, 1, seed)
        face(m, pts, C(media) if h < 0.3 else C(chiara), nrm)
        if _norm(nrm)[1] > 0.25:
            su.append((h01(f, 2, seed), pts, nrm))
    su.sort(key=lambda t: t[0])
    for k, (_h, pts, nrm) in enumerate(su[:licheni]):
        macchia(m, pts, nrm, C(lichene[k % len(lichene)]), seed=seed + k)


def lama(m, base, dirz, alt, larg, piega, reg_basso, reg_alto):
    """Filo d'erba a due facce: base larga, metà piegata verso fuori, punta. dirz = direzione orizzontale in cui si piega."""
    d = _norm((dirz[0], 0, dirz[2]))
    s = (-d[2], 0, d[0])
    b0, b1 = _add(base, _mul(s, -larg)), _add(base, _mul(s, larg))
    mid = _add(base, (d[0] * piega * 0.35, alt * 0.55, d[2] * piega * 0.35))
    m0, m1 = _add(mid, _mul(s, -larg * 0.7)), _add(mid, _mul(s, larg * 0.7))
    tip = _add(base, (d[0] * piega, alt, d[2] * piega))
    nrm = _norm((d[0], 0.4, d[2]))
    for sg in (1, -1):
        face(m, [b0, b1, m1, m0], reg_basso, _mul(nrm, sg))
        face(m, [m0, m1, tip], reg_alto, _mul(nrm, sg))


def palco(m, y, R, h, k, rot, seed, cima='erba_scura', lato='bosco', sotto='bosco_ombra', piega=0.3, sposta=(0.0, 0.0)):
    """Palco di abete a stella (k punte): punte cadenti, una fascia di rami, la cima a punta; sotto in ombra."""
    N = 2 * k
    sx, sz = sposta
    bot, mid = [], []
    for i in range(N):
        a = rot + math.pi * i / k
        punta = i % 2 == 0
        rr = R * (1.0 if punta else 0.6) * (0.86 + 0.28 * h01(i, seed, 7))
        bot.append((math.cos(a) * rr, y - (piega if punta else piega * 0.25), math.sin(a) * rr))
        rm = R * 0.52 * (1.0 if punta else 0.72)
        mid.append((sx * 0.5 + math.cos(a) * rm, y + h * 0.3, sz * 0.5 + math.sin(a) * rm))
    apex = (sx, y + h, sz)
    sotto_c = (0.0, y + h * 0.12, 0.0)
    for i in range(N):
        j = (i + 1) % N
        am = rot + math.pi * (i + 0.5) / k
        out = (math.cos(am), 0.0, math.sin(am))
        face(m, [bot[i], bot[j], sotto_c], C(sotto), (out[0] * 0.3, -1, out[2] * 0.3))
        face(m, [bot[i], bot[j], mid[j], mid[i]], C(lato), (out[0], 0.5, out[2]))
        face(m, [mid[i], mid[j], apex], C(cima), (out[0], 0.8, out[2]))


def cuscino(m, x, y, z, rx, ry, rz, seed, n=7, sotto='bosco_ombra', lato='bosco', cima='erba_scura', fondo=True):
    """Ciuffo di aghi (pino) a cupola irregolare: pancia in ombra, fascia scura, cima presa dal sole."""
    anelli = []
    for k, (fy, fr) in enumerate(((-0.45, 0.72), (0.0, 1.0), (0.5, 0.72))):
        anelli.append([(x + math.cos(2 * math.pi * (i + 0.5 * k) / n) * rx * fr * (0.82 + 0.36 * h01(i, k, seed)),
                        y + ry * fy + (h01(k, i, seed + 3) - 0.5) * 0.25 * ry,
                        z + math.sin(2 * math.pi * (i + 0.5 * k) / n) * rz * fr * (0.82 + 0.36 * h01(i, k, seed))) for i in range(n)])
    giu, su = (x, y - ry * 0.6, z), (x + rx * 0.1 * (h01(1, 1, seed) - 0.5), y + ry, z)
    for i in range(n):
        j = (i + 1) % n
        if fondo:
            face(m, [anelli[0][i], anelli[0][j], giu], C(sotto), (0, -1, 0))
        face(m, [anelli[2][i], anelli[2][j], su], C(cima), (0, 1, 0))
        for k, reg in ((0, sotto), (1, lato)):
            a, b = anelli[k], anelli[k + 1]
            pts = [a[i], a[j], b[j], b[i]]
            fc = _mul(tuple(sum(q[c] for q in pts) for c in range(3)), 0.25)
            face(m, pts, C(reg), _sub(fc, (x, fc[1], z)))


# ------------------------------------------------------------------ bici
def cs_d_bici_telaio():
    """Telaio da downhill rosso con fasce arancio: ammortizzatore a molla, sella bassa, pedivelle in piano, catena; ruote e sterzo a parte."""
    m = Mesh('cs_d_bici_telaio')
    R, N, AR = C('rosso'), C('nero_caldo'), C('arancio')
    BB = (0.0, 0.34, 0.18)
    # tubo sterzo con le calotte della serie sterzo (tra le due piastre della forcella)
    tubo_col(m, [sull_asse(0.57), sull_asse(0.68)], [0.034, 0.034], R, n=8)
    tubo_col(m, [sull_asse(0.56), sull_asse(0.572)], [0.039, 0.039], N, n=8, cap0=N)
    tubo_col(m, [sull_asse(0.678), sull_asse(0.69)], [0.039, 0.039], N, n=8, cap1=N)
    # tubo obliquo grosso con la fascia arancio sui fianchi, tubo orizzontale, piantone
    obl = lambda i, j, nrm: AR if i == 1 and abs(nrm[0]) > 0.75 else R
    tubo_col(m, [sull_asse(0.6), _lerp(sull_asse(0.6), (0, 0.40, 0.13), 0.3), _lerp(sull_asse(0.6), (0, 0.40, 0.13), 0.72), (0, 0.40, 0.13)],
             [0.036, 0.04, 0.04, 0.036], obl, n=6, a0=-math.pi / 6)
    tubo_col(m, [sull_asse(0.66), (0, 0.745, 0.35)], [0.025, 0.024], R, n=6, a0=-math.pi / 6)
    tubo_col(m, [(0, 0.30, 0.19), (0, 0.82, 0.39)], [0.026, 0.026], R, n=6, cap1=N)
    # reggisella, collarino e sella bassa da discesa (punta in avanti, −Z)
    tubo_col(m, [(0, 0.80, 0.381), (0, 0.835, 0.396)], [0.031, 0.031], N, n=6)
    tubo_col(m, [(0, 0.83, 0.394), (0, 0.915, 0.43)], [0.016, 0.016], N, n=6)
    tubo_z(m, [(0.30, 0, 0.928, 0.035, 0.03, 0.01), (0.37, 0, 0.935, 0.07, 0.04, 0.015), (0.47, 0, 0.94, 0.13, 0.045, 0.02),
               (0.55, 0, 0.952, 0.12, 0.04, 0.018)], N, seg=1)
    # scatola del movimento centrale
    tubo_col(m, [(-0.045, 0.34, 0.18), (0.045, 0.34, 0.18)], [0.026, 0.026], N, n=8, cap0=N, cap1=N)
    # carro: foderi bassi e alti, forcellini
    for s in (-1, 1):
        tubo_col(m, [(s * 0.035, 0.345, 0.2), (s * 0.06, 0.37, 0.42), (s * 0.068, 0.35, 0.615)], [0.018, 0.017, 0.015], R, n=6)
        tubo_col(m, [(s * 0.068, 0.36, 0.615), (s * 0.058, 0.56, 0.5), (s * 0.045, 0.73, 0.405)], [0.014, 0.015, 0.016], R, n=6)
        m.box(s * 0.062 - 0.007, 0.32, 0.595, s * 0.062 + 0.007 + s * 0.006, 0.39, 0.66, N)
        # bilanciere: piastre nere dal punto alto dell'ammortizzatore al carro
        tubo_col(m, [(s * 0.04, 0.655, 0.19), (s * 0.042, 0.70, 0.335), (s * 0.045, 0.73, 0.405)], [0.018, 0.022, 0.016], N, n=4, cap0=N, cap1=N)
    # protezione del fodero basso destro
    tubo_col(m, [(0.05, 0.37, 0.24), (0.064, 0.385, 0.42)], [0.012, 0.012], N, n=4)
    # ammortizzatore a molla: corpo grigio, molla arancio, serbatoio nero col tappo blu
    S0, S1 = (0, 0.42, 0.06), (0, 0.655, 0.19)
    tubo_col(m, [S0, _lerp(S0, S1, 0.12)], [0.02, 0.02], N, n=6, cap0=N)
    tubo_col(m, [_lerp(S0, S1, 0.12), _lerp(S0, S1, 0.62)], [0.019, 0.019], C('pietra_scura'), n=6)
    tubo_col(m, [_lerp(S0, S1, 0.62), S1], [0.011, 0.011], C('pietra_chiara'), n=6, cap1=N)
    for k in range(5):
        t = 0.2 + k * 0.15
        tubo_col(m, [_lerp(S0, S1, t), _lerp(S0, S1, t + 0.06)], [0.035, 0.035], AR, n=6, cap0=AR, cap1=AR)
    d = _norm(_sub(S1, S0))
    fw = (0, d[2], -d[1])  # perpendicolare verso il davanti
    r0, r1 = _add(_lerp(S0, S1, 0.9), _mul(fw, 0.042)), _add(_lerp(S0, S1, 0.45), _mul(fw, 0.042))
    tubo_col(m, [r0, r1], [0.016, 0.016], N, n=6, cap1=C('acqua_profonda'))
    tubo_col(m, [_lerp(S0, S1, 0.9), r0], [0.01, 0.01], N, n=4)
    tubo_col(m, [(0, 0.40, 0.08), S0], [0.014, 0.014], N, n=4)
    # trasmissione (lato destro): corona, pedivelle in piano, pedali flat, pacco pignoni, cambio, catena, guidacatena
    tubo_col(m, [(0.05, 0.34, 0.18), (0.057, 0.34, 0.18)], [0.074, 0.074], C('pietra'), n=12, cap0=C('pietra'), cap1=C('pietra'), ref=(0, 1, 0))
    tubo_col(m, [(0.057, 0.34, 0.18), (0.061, 0.34, 0.18)], [0.045, 0.045], N, n=6, cap1=N)
    for s, zp in ((1, 0.01), (-1, 0.35)):
        tubo_col(m, [(s * 0.066, 0.34, 0.18), (s * 0.084, 0.34, zp)], [0.016, 0.013], N, n=4, cap0=N, cap1=N)
        m.box(s * 0.092 - (0.1 if s < 0 else 0), 0.326, zp - 0.05, s * 0.092 + (0.1 if s > 0 else 0), 0.354, zp + 0.05, C('roccia'), N)
    tubo_col(m, [(0.038, 0.35, 0.625), (0.066, 0.35, 0.625)], [0.052, 0.026], C('pietra'), n=8, cap1=C('pietra'), ref=(0, 1, 0))
    tubo_col(m, [(0.078, 0.33, 0.632), (0.08, 0.24, 0.6), (0.08, 0.19, 0.57)], [0.012, 0.016, 0.013], N, n=4, cap1=N)
    m.box(0.07, 0.17, 0.53, 0.09, 0.27, 0.6, N)
    tubo_col(m, [(0.054, 0.413, 0.18), (0.052, 0.402, 0.62)], [0.006, 0.006], C('roccia'), n=4)
    tubo_col(m, [(0.054, 0.267, 0.18), (0.078, 0.19, 0.555)], [0.006, 0.006], C('roccia'), n=4)
    m.box(0.045, 0.40, 0.22, 0.07, 0.44, 0.28, N)
    # pinza del freno posteriore (sinistra, sul disco della ruota)
    m.box(-0.078, 0.40, 0.53, -0.05, 0.455, 0.585, N)
    return _obj(m)


def cs_d_bici_sterzo():
    """Forcella da discesa a doppia piastra nera coi tappi blu, attacco, manubrio piatto nero con manopole, leve dei freni e cavi.
    Spazio locale: Y = asse di sterzo, zero = mozzo anteriore (vedi il montaggio in testa al file)."""
    m = Mesh('cs_d_bici_sterzo')
    N, S, B = C('nero_caldo'), C('roccia'), C('acqua_profonda')
    for s in (-1, 1):
        x = s * 0.085
        tubo_col(m, [(x, -0.04, 0), (x, 0.06, 0), (x, 0.33, 0)], [0.03, 0.03, 0.027], N, n=8, cap0=N, cap1=N)   # foderi
        tubo_col(m, [(x, 0.33, 0), (x, 0.345, 0)], [0.029, 0.029], C('pietra_scura'), n=8, cap1=C('pietra_scura'))  # paraolio
        tubo_col(m, [(x, 0.345, 0), (x, 0.735, 0)], [0.019, 0.019], S, n=8)                                  # steli
        tubo_col(m, [(x, 0.735, 0), (x, 0.752, 0)], [0.021, 0.018], B, n=8, cap1=B)                           # tappi blu
        m.box(x - 0.016, -0.03, -0.028, x + 0.016, 0.03, 0.028, N)                                              # piedini
    # perno passante con la leva a destra
    tubo_col(m, [(-0.104, 0, 0), (0.104, 0, 0)], [0.011, 0.011], C('pietra_scura'), n=6, cap0=N, cap1=N)
    tubo_col(m, [(0.108, 0, 0), (0.112, -0.018, -0.06)], [0.008, 0.006], N, n=4, cap1=N)
    # piastre (doppia piastra da DH) e tappo della serie sterzo
    for y0, y1 in ((0.525, 0.558), (0.692, 0.72)):
        m.box(-0.112, y0, -0.03, 0.112, y1, 0.032, N)
        tubo_col(m, [(0, y0 - 0.004, 0), (0, y1 + 0.004, 0)], [0.042, 0.042], N, n=8, cap0=N, cap1=N)
    tubo_col(m, [(0, 0.724, 0), (0, 0.738, 0)], [0.022, 0.022], N, n=6, cap1=S)
    # pinza del freno anteriore (sinistra, dietro al fodero, sul disco)
    m.box(-0.078, 0.04, 0.05, -0.05, 0.11, 0.1, N)
    tubo_col(m, [(-0.072, 0.11, 0.08), (-0.108, 0.3, 0.035), (-0.11, 0.62, 0.03)], [0.005, 0.005, 0.005], N, n=3)
    # attacco manubrio (direct mount sulla piastra alta) con il morsetto del manubrio
    bar = (0.0, 0.7576, -0.0549)
    m.box(-0.027, 0.712, -0.075, 0.027, 0.748, 0.03, N)
    tubo_col(m, [(-0.034, bar[1], bar[2]), (0.034, bar[1], bar[2])], [0.025, 0.025], N, n=8, cap0=N, cap1=N)
    # manubrio, manopole, leve e cavi: disegnati nelle coordinate del telaio e riportati nello spazio dello sterzo
    m.push(Xf(r=(-RAKE, 0, 0)))
    m.push(Xf(t=(-ASSE_ANT[0], -ASSE_ANT[1], -ASSE_ANT[2])))
    xs = [(0.39, 1.066, -0.302), (0.255, 1.064, -0.316), (0.17, 1.06, -0.325), (0.07, 1.05, -0.33)]
    pts = [(-x, y, z) for x, y, z in xs] + [(x, y, z) for x, y, z in reversed(xs)]
    tubo_col(m, pts, [0.0165] * len(pts), N, n=6, cap0=N, cap1=N)
    for s in (-1, 1):
        g0, g1 = (s * 0.262, 1.064, -0.315), (s * 0.39, 1.066, -0.302)
        tubo_col(m, [g0, g1], [0.021, 0.021], S, n=6, cap1=N)                                                   # manopola
        tubo_col(m, [(s * 0.25, 1.0638, -0.316), g0], [0.023, 0.023], B, n=6, cap0=B)                          # anello blu
        tubo_col(m, [g1, (s * 0.396, 1.066, -0.301)], [0.019, 0.019], N, n=6, cap1=N)                          # tappo
        # pompa del freno sopra il manubrio e leva davanti, verso fuori
        m.box(min(s * 0.198, s * 0.238), 1.068, -0.345, max(s * 0.198, s * 0.238), 1.09, -0.318, N)
        tubo_col(m, [(s * 0.232, 1.07, -0.338), (s * 0.252, 1.062, -0.362), (s * 0.335, 1.046, -0.368)], [0.008, 0.008, 0.007], N, n=4, cap1=N)
        # cavo che fa l'ansa davanti al manubrio e scende verso il telaio
        tubo_col(m, [(s * 0.205, 1.07, -0.345), (s * 0.18, 1.02, -0.4), (s * 0.11, 0.94, -0.43), (s * 0.05, 0.88, -0.39)], [0.0045] * 4, N, n=3)
    m.box(0.205, 1.03, -0.322, 0.235, 1.046, -0.296, N)  # comando del cambio sotto il manubrio
    m.pop(); m.pop()
    return _obj(m)


def cs_d_bici_ruota():
    """Ruota da 27,5" (Ø 0,70 m): copertone coi tasselli nel profilo, cerchio, 12 raggi, mozzo coi tappi blu, disco del freno a sinistra.
    Asse lungo X. Leggera (si ripete): niente facce nascoste dentro il cerchio."""
    m = Mesh('cs_d_bici_ruota')
    NS = 24
    th = [2 * math.pi * i / NS for i in range(NS)]
    P = lambda x, r, t: (x, r * math.cos(t), r * math.sin(t))
    # copertone: profilo (raggio, x); la cresta e le spalle si alternano dentro/fuori = tasselli che si vedono nella sagoma
    def prof(i):
        hi = i % 2 == 0
        return [(0.296, -0.03), (0.338 if hi else 0.328, -0.036), (0.334 if hi else 0.357, 0.0), (0.338 if hi else 0.328, 0.036), (0.296, 0.03)]
    regs = ['roccia', 'nero_caldo', 'nero_caldo', 'roccia']
    for i in range(NS):
        j = (i + 1) % NS
        pa, pb, tm = prof(i), prof(j), (th[i] + th[i] + 2 * math.pi / NS) / 2
        for k, reg in enumerate(regs):
            pts = [P(pa[k][1], pa[k][0], th[i]), P(pb[k][1], pb[k][0], th[j]), P(pb[k + 1][1], pb[k + 1][0], th[j]), P(pa[k + 1][1], pa[k + 1][0], th[i])]
            face(m, pts, C(reg), _sub(_mul(tuple(sum(q[c] for q in pts) for c in range(3)), 0.25), P(0, 0.318, tm)))
    # cerchio: i due fianchi (la fascia interna non serve)
    NR = 16
    for i in range(NR):
        t0, t1 = 2 * math.pi * i / NR, 2 * math.pi * (i + 1) / NR
        for s in (-1, 1):
            face(m, [P(s * 0.019, 0.27, t0), P(s * 0.019, 0.27, t1), P(s * 0.019, 0.3, t1), P(s * 0.019, 0.3, t0)], C('nero_caldo'), (s, 0, 0))
    # mozzo coi tappi blu e 12 raggi incrociati
    tubo_col(m, [(-0.055, 0, 0), (0.055, 0, 0)], [0.028, 0.028], C('nero_caldo'), n=6, cap0=C('acqua_profonda'), cap1=C('acqua_profonda'))
    for k in range(12):
        t = 2 * math.pi * k / 12
        s = 1 if k % 2 else -1
        tt = t + (0.45 if (k // 2) % 2 else -0.45)
        tubo_col(m, [P(s * 0.04, 0.026, tt), P(s * 0.008, 0.27, t)], [0.006, 0.006], C('pietra_scura'), n=3)
    # disco del freno (sinistra)
    for i in range(8):
        t0, t1 = 2 * math.pi * i / 8, 2 * math.pi * (i + 1) / 8
        for x, sg in ((-0.047, -1), (-0.045, 1)):
            face(m, [P(x, 0.07, t0), P(x, 0.07, t1), P(x, 0.1, t1), P(x, 0.1, t0)], C('pietra_chiara'), (sg, 0, 0))
    return _obj(m)


# ------------------------------------------------------------------ braccia
def _pugno(m, s, G):
    """Mano col guanto nero chiusa sulla manopola (centro G, asse lungo X); s = lato. Indice sulla leva del freno, pollice sotto."""
    m.push(Xf(t=G, r=(0, -s * 5.9, 0)))
    prof = [(0.0, -0.037), (0.03, -0.031), (0.05, -0.006), (0.057, 0.04), (0.032, 0.07), (-0.012, 0.06), (-0.033, 0.014), (-0.029, -0.023)]
    secs = [(-0.047, 0.8), (-0.022, 1.0), (0.024, 1.0), (0.048, 0.82)]
    rings = [[(s * x, y * k, z * k) for (y, z) in prof] for (x, k) in secs]
    start = len(m.polys)
    m.loft(rings, C('nero_caldo'), top=C('nero_caldo'), bottom=C('nero_caldo'))
    fix_winding(m, start)
    # nocche imbottite
    m.box(-0.03, 0.044, -0.026, 0.03, 0.056, 0.004, C('roccia'), skip=('bottom',))
    # indice sulla leva e pollice sotto la manopola
    tubo_col(m, [(s * -0.038, 0.035, -0.022), (s * -0.05, 0.018, -0.052), (s * -0.054, -0.006, -0.06), (s * -0.056, -0.028, -0.05)],
             [0.0115, 0.011, 0.01, 0.009], C('nero_caldo'), n=5, cap1=C('nero_caldo'))
    tubo_col(m, [(s * -0.04, 0.0, 0.045), (s * -0.054, -0.022, 0.018), (s * -0.054, -0.03, -0.012)], [0.014, 0.012, 0.011],
             C('nero_caldo'), n=5, cap1=C('nero_caldo'))
    m.pop()


def cs_d_braccia():
    """Le due braccia del ciclista in prima persona: guanti neri sulle manopole, polsini, maniche arancio fino al gomito.
    Pivot = centro del manubrio (0, 1.05, −0.33 nel telaio); le mani sono sulle manopole di cs_d_bici_sterzo."""
    m = Mesh('cs_d_braccia')
    for s in (-1, 1):
        G = (s * 0.3225, 0.015, 0.021)            # centro della manopola rispetto al centro del manubrio
        E = (s * 0.42, 0.25, 0.30)                # gomito largo, in posizione d'attacco
        SP = (s * 0.19, 0.42, 0.47)               # spalla (non si vede: dietro la camera)
        _pugno(m, s, G)
        d = _norm(_sub(E, G))
        W = _add(G, (s * 0.004, 0.045, 0.058))    # polso, dietro e sopra la manopola
        cuff = _add(W, _mul(d, 0.1))
        # guanto lungo col polsino a strappo
        guanto = lambda i, j, nrm: C('roccia') if i == 1 else C('nero_caldo')
        tubo_col(m, [_add(G, (0, 0.03, 0.035)), W, _add(W, _mul(d, 0.06)), cuff], [0.03, 0.032, 0.042, 0.044], guanto, n=7)
        # manica arancio: bordo, avambraccio, gomito, un pezzo di braccio verso la spalla
        su = _add(E, _mul(_sub(SP, E), 0.4))
        manica = lambda i, j, nrm: C('rosso') if i == 0 else C('arancio')
        tubo_col(m, [_add(cuff, _mul(d, -0.012)), _add(cuff, _mul(d, 0.02)), _lerp(cuff, E, 0.55), E, su],
                 [0.05, 0.052, 0.058, 0.062, 0.06], manica, n=7, cap0=C('arancio'), cap1=C('arancio'))
        sfera(m, E[0], E[1], E[2], 0.064, reg=C('arancio'), n=7, rings=2)
    return _obj(m)


# ------------------------------------------------------------------ alberi
def cs_d_abete_a():
    """Abete rosso alto 12 m: tronco scuro visibile in basso, nove palchi a stella che si stringono verso la punta."""
    m = Mesh('cs_d_abete_a')
    tubo_col(m, [(0, -0.1, 0), (0, 0.5, 0), (0, 3.0, 0), (0, 8.0, 0), (0, 11.0, 0)], [0.42, 0.3, 0.25, 0.13, 0.04],
             corteccia(301, base='legno_scuro', scura='roccia', chiara='legno', p_chiara=0.2), n=6)
    n = 8
    for i in range(n):
        t = i / (n - 1)
        palco(m, 2.7 + t * 6.9, 2.6 * (1 - t) + 0.6 * t, 2.1 - 0.6 * t, 6 if i < 5 else 5, 0.45 * i, 310 + i, piega=0.3 - 0.12 * t)
    palco(m, 10.1, 0.42, 1.9, 4, 0.2, 320, piega=0.05)
    return _obj(m)


def cs_d_abete_b():
    """Abete più snello, 14 m, la punta un po' piegata dal vento e i palchi bassi cadenti; tronco nudo nei primi 2,5 m."""
    m = Mesh('cs_d_abete_b')
    tubo_col(m, [(0, -0.1, 0), (0, 0.45, 0), (0, 3.0, 0), (0.05, 9.0, 0), (0.15, 12.6, 0)], [0.38, 0.27, 0.22, 0.12, 0.04],
             corteccia(331, base='legno_scuro', scura='roccia', chiara='legno', p_chiara=0.2), n=6)
    n = 9
    for i in range(n):
        t = i / (n - 1)
        palco(m, 3.2 + t * 8.2, 2.2 * (1 - t) + 0.5 * t, 1.9 - 0.5 * t, 6 if i < 4 else 5, 0.7 * i + 0.3, 340 + i,
              cima='erba_scura' if i % 2 else 'bosco', piega=0.4 - 0.22 * t, sposta=(0.08 * t, 0.0))
    palco(m, 12.2, 0.38, 1.8, 4, 0.5, 352, piega=0.05, sposta=(0.18, 0.0))
    return _obj(m)


def cs_d_pino_cresta():
    """Pino di cresta piegato dal vento (7 m): tronco inclinato, rami tutti sottovento (+X) con i cuscini di aghi, rami secchi controvento."""
    m = Mesh('cs_d_pino_cresta')
    asse = [(0, -0.1, 0), (0.25, 1.4, 0.0), (0.9, 3.0, 0.1), (1.5, 4.4, 0.0), (1.85, 5.7, -0.1), (2.0, 6.6, 0)]
    tubo_col(m, asse, [0.32, 0.24, 0.19, 0.14, 0.09, 0.03], corteccia(361, base='legno', scura='legno_scuro', chiara='legno_chiaro'), n=6)
    rami = [((0.9, 3.0, 0.1), (1.9, 3.4, -0.4), 0.09), ((1.2, 3.7, 0.05), (2.9, 4.4, 0.5), 0.09), ((1.5, 4.4, 0.0), (3.5, 4.9, -0.2), 0.08),
            ((1.7, 5.2, -0.05), (3.1, 5.9, 0.4), 0.07), ((1.9, 6.0, -0.1), (2.6, 6.5, -0.5), 0.05)]
    for p0, p1, r in rami:
        tubo_col(m, [p0, _lerp(p0, p1, 0.55), p1], [r, r * 0.75, r * 0.4], C('legno'), n=4)
    for p0, p1 in (((0.45, 2.0, 0.0), (-0.4, 2.5, 0.2)), ((1.25, 3.9, 0.0), (0.6, 4.3, -0.3))):  # rami secchi
        tubo_col(m, [p0, p1], [0.05, 0.015], C('pietra'), n=3)
    for k, (x, y, z, rx, ry, rz) in enumerate(((2.3, 6.75, -0.1, 1.4, 0.5, 1.1), (3.3, 6.05, 0.35, 1.15, 0.42, 0.95), (1.3, 5.8, -0.55, 0.95, 0.4, 0.8),
                                                (3.45, 5.0, -0.25, 1.3, 0.45, 1.0), (2.85, 4.45, 0.6, 1.0, 0.4, 0.85), (1.9, 3.5, -0.45, 0.85, 0.36, 0.7))):
        cuscino(m, x, y, z, rx, ry, rz, 370 + k)
    return _obj(m)


def cs_d_tronco_alto():
    """Tronco di pino da pineta fitta: dritto, 12 m, corteccia rossiccia a placche, monconi secchi, pochi rami con gli aghi in cima."""
    m = Mesh('cs_d_tronco_alto')
    tubo_col(m, [(0, -0.1, 0), (0, 0.35, 0), (0, 1.6, 0), (0, 4.0, 0), (0, 7.0, 0), (0, 9.6, 0), (0, 12.0, 0)],
             [0.55, 0.37, 0.32, 0.29, 0.25, 0.2, 0.06], corteccia(381, base='legno', scura='legno_scuro', chiara='legno_chiaro', p_chiara=0.18), n=7)
    for k in range(4):  # contrafforti delle radici
        a = math.pi / 4 + k * math.pi / 2 + 0.2
        d = (math.cos(a), 0, math.sin(a))
        p0, p1, p2 = (d[0] * 0.25, 0.9, d[2] * 0.25), (d[0] * 0.85, -0.05, d[2] * 0.85), (d[0] * 0.25, -0.05, d[2] * 0.25)
        nrm = (-d[2], 0, d[0])
        face(m, [p0, p1, p2], C('legno'), nrm)
        face(m, [p0, p1, p2], C('legno_scuro'), _mul(nrm, -1))
    for k, y in enumerate((3.1, 4.6, 5.9, 7.4, 8.4)):  # monconi secchi
        a = k * 2.3
        r = 0.29 - 0.012 * y
        p0 = (math.cos(a) * r * 0.6, y, math.sin(a) * r * 0.6)
        tubo_col(m, [p0, (math.cos(a) * (r + 0.45), y - 0.12, math.sin(a) * (r + 0.45))], [0.05, 0.02], C('legno_scuro'), n=3)
    for k, (y, L) in enumerate(((9.4, 1.9), (10.2, 1.6), (10.9, 1.3), (11.5, 0.9))):
        a = k * 2.0 + 0.5
        p0 = (0, y, 0)
        p1 = (math.cos(a) * L, y + 0.5, math.sin(a) * L)
        tubo_col(m, [p0, p1], [0.08, 0.03], C('legno'), n=4)
        cuscino(m, p1[0] * 0.92, p1[1] + 0.05, p1[2] * 0.92, 1.3 - 0.12 * k, 0.5, 1.1 - 0.1 * k, 390 + k)
    cuscino(m, 0.1, 11.9, 0.0, 0.9, 0.55, 0.8, 395)
    return _obj(m)


# ------------------------------------------------------------------ sentiero e ostacoli
def cs_d_tronco():
    """Tronco caduto da saltare (5 m, Ø 0,5) di traverso al sentiero (lungo X): corteccia, muschio sopra, tagli chiari alle estremità."""
    m = Mesh('cs_d_tronco')
    punti = [(-2.5, 0.22, 0.05), (-1.2, 0.235, 0.0), (0.3, 0.245, -0.03), (1.6, 0.235, 0.02), (2.5, 0.22, 0.06)]
    raggi = [0.25, 0.26, 0.25, 0.24, 0.23]
    bark = corteccia(401, base='legno', scura='legno_scuro', chiara='legno_chiaro', p_chiara=0.1)
    col = lambda i, j, nrm: C('erba_scura') if nrm[1] > 0.6 and h01(i, j, 402) < 0.22 else bark(i, j, nrm)
    tubo_col(m, punti, raggi, col, n=8, a0=math.pi / 8)
    taglio(m, punti[0], _sub(punti[0], punti[1]), raggi[0])
    taglio(m, punti[-1], _sub(punti[-1], punti[-2]), raggi[-1])
    for p, d in (((-0.6, 0.4, 0.0), (-0.25, 0.75, -0.25)), ((1.1, 0.3, 0.2), (1.35, 0.42, 0.62)), ((-1.8, 0.33, -0.18), (-2.0, 0.45, -0.6))):
        tubo_col(m, [p, d], [0.06, 0.025], C('legno_scuro'), n=4, cap1=C('sabbia_chiara'))
    return _obj(m)


def cs_d_ceppo():
    """Ceppo tagliato (Ø 0,6, alto 0,45) con le radici che si allargano e il taglio chiaro sopra."""
    m = Mesh('cs_d_ceppo')
    tubo_col(m, [(0, -0.05, 0), (0, 0.12, 0), (0, 0.45, 0)], [0.38, 0.31, 0.29], corteccia(421), n=8)
    taglio(m, (0, 0.45, 0), (0, 1, 0), 0.29)
    for k in range(5):
        a = k * 2 * math.pi / 5 + 0.3
        d = (math.cos(a), 0, math.sin(a))
        tubo_col(m, [(d[0] * 0.2, 0.16, d[2] * 0.2), (d[0] * 0.36, 0.05, d[2] * 0.36), (d[0] * 0.5, -0.03, d[2] * 0.5), (d[0] * 0.58, -0.1, d[2] * 0.58)],
                 [0.11, 0.085, 0.06, 0.04], corteccia(422 + k), n=5)
    return _obj(m)


def cs_d_sasso_a():
    """Sasso chiaro di 0,8 m con le chiazze di lichene."""
    m = Mesh('cs_d_sasso_a')
    roccia(m, 0, 0, 0.45, 0.62, 0.4, 501, n=7, licheni=5)
    return _obj(m)


def cs_d_sasso_b():
    """Sasso basso e largo (1,2 m) con un sasso piccolo accanto, chiazze di lichene."""
    m = Mesh('cs_d_sasso_b')
    roccia(m, 0, 0, 0.62, 0.48, 0.5, 511, n=8, anelli=((0.0, 1.0), (0.4, 0.95), (0.78, 0.7), (0.96, 0.35)), licheni=5)
    roccia(m, 0.62, 0.38, 0.22, 0.2, 0.2, 512, n=5, anelli=((0.0, 1.0), (0.5, 0.85), (0.9, 0.4)), licheni=1)
    return _obj(m)


def cs_d_masso():
    """Masso di 3 m sfaccettato, chiaro coi licheni, con due sassi e due ciuffi d'erba alla base."""
    m = Mesh('cs_d_masso')
    roccia(m, 0, 0, 1.5, 2.1, 1.25, 521, n=9, anelli=((0.0, 1.0), (0.3, 1.02), (0.62, 0.86), (0.88, 0.5)), licheni=7, giu=0.15)
    roccia(m, 1.45, 0.9, 0.45, 0.45, 0.4, 522, n=6, anelli=((0.0, 1.0), (0.5, 0.85), (0.9, 0.4)), licheni=1)
    roccia(m, -1.3, -0.95, 0.35, 0.3, 0.32, 523, n=5, anelli=((0.0, 1.0), (0.5, 0.85), (0.9, 0.4)), licheni=1)
    for (x, z, s) in ((-1.55, 0.5, 1.0), (0.4, -1.4, 0.8)):
        for k in range(5):
            a = k * 1.26 + x
            d = (math.cos(a), 0, math.sin(a))
            lama(m, (x + d[0] * 0.06, 0, z + d[2] * 0.06), d, 0.55 * s, 0.035, 0.22 * s, C('erba'), C('erba_chiara'))
    return _obj(m)


def cs_d_radici():
    """Radici scoperte che attraversano un sentiero largo 2,5 m (lungo X), bassissime e mezze interrate. Pivot al centro."""
    m = Mesh('cs_d_radici')
    lucida = lambda i, j, nrm: C('legno_chiaro') if nrm[1] > 0.55 else C('legno')
    scura = lambda i, j, nrm: C('legno') if nrm[1] > 0.55 else C('legno_scuro')
    tubo_col(m, [(-1.85, -0.06, 0.45), (-1.3, 0.0, 0.3), (-0.6, 0.02, 0.38), (0.1, 0.03, 0.18), (0.8, 0.02, 0.05), (1.4, 0.0, -0.15), (1.9, -0.06, -0.1)],
             [0.0, 0.075, 0.085, 0.09, 0.08, 0.07, 0.0], lucida, n=5)
    tubo_col(m, [(-0.6, 0.0, 0.36), (-0.2, 0.0, 0.62), (0.5, 0.0, 0.7), (1.1, -0.02, 0.85), (1.6, -0.06, 0.95)],
             [0.06, 0.055, 0.05, 0.04, 0.0], scura, n=5)
    tubo_col(m, [(-1.7, -0.06, -0.55), (-1.0, 0.0, -0.4), (-0.3, 0.0, -0.5), (0.4, 0.0, -0.32), (0.85, -0.05, -0.4)],
             [0.0, 0.05, 0.055, 0.045, 0.0], lucida, n=5)
    tubo_col(m, [(0.1, 0.02, 0.18), (0.35, 0.0, -0.1), (0.4, -0.04, -0.3)], [0.05, 0.04, 0.0], scura, n=4)
    roccia(m, -0.25, -0.05, 0.11, 0.07, 0.1, 531, n=5, anelli=((0.0, 1.0), (0.5, 0.8), (0.9, 0.4)), licheni=0)
    roccia(m, 1.15, 0.45, 0.09, 0.06, 0.08, 532, n=5, anelli=((0.0, 1.0), (0.5, 0.8), (0.9, 0.4)), licheni=0)
    return _obj(m)


def cs_d_cespuglio():
    """Cespuglio del sottobosco (1,3 m): tre cupole di foglie verdi e una gialla-verde in cima, senza fondo (poggia a terra)."""
    m = Mesh('cs_d_cespuglio')
    for k, (x, y, z, r, nn) in enumerate(((0.0, 0.42, 0.0, 0.6, 6), (0.5, 0.3, 0.22, 0.45, 6), (-0.48, 0.32, -0.12, 0.46, 6), (0.06, 0.74, -0.06, 0.34, 5))):
        cima = 'erba_chiara' if k != 1 else 'erba'
        cuscino(m, x, y, z, r, r * 0.75, r, 541 + k, n=nn, sotto='erba_scura', lato='erba' if k != 1 else 'erba_scura', cima=cima, fondo=k == 3)
    return _obj(m)


def cs_d_fiori():
    """Ciuffo di fiori di cresta: spighe viola (lupini), margherite bianche e fiori gialli tra quattro foglie. Leggero (si ripete)."""
    m = Mesh('cs_d_fiori')
    for k in range(4):  # foglie a terra
        a = k * math.pi / 2 + 0.4
        d, s = (math.cos(a), 0, math.sin(a)), (-math.sin(a), 0, math.cos(a))
        face(m, [_add((d[0] * 0.04, 0.02, d[2] * 0.04), _mul(s, 0.07)), (d[0] * 0.3, 0.06, d[2] * 0.3), _add((d[0] * 0.04, 0.02, d[2] * 0.04), _mul(s, -0.07))],
             C('erba_scura'), (0, 1, 0))
    for k, (x, z, h) in enumerate(((0.0, 0.02, 0.6), (0.15, -0.1, 0.48), (-0.13, -0.08, 0.53))):  # lupini: stelo e spiga
        tubo_col(m, [(x, 0, z), (x, h * 0.55, z)], [0.012, 0.01], C('erba'), n=3)
        m.cone(4, 0.036, h * 0.55, h, C('viola'), cx=x, cz=z, a0=k * 0.4)
    for k, (x, z, h, reg, cuore) in enumerate(((0.22, 0.14, 0.3, 'pietra_chiara', 'giallo'), (-0.24, 0.12, 0.26, 'pietra_chiara', 'giallo'),
                                               (0.28, -0.16, 0.24, 'giallo', 'arancio'), (-0.26, -0.2, 0.28, 'giallo', 'arancio'))):
        st = (-math.sin(k), 0, math.cos(k))
        for sg in (1, -1):  # stelo piatto a due facce
            face(m, [_add((x * 0.3, 0, z * 0.3), _mul(st, 0.012)), _add((x * 0.3, 0, z * 0.3), _mul(st, -0.012)), (x, h, z)], C('erba'), _mul(_cross(st, (0, 1, 0)), sg))
        face(m, [(x + math.cos(k + i * 2 * math.pi / 5) * 0.06, h, z + math.sin(k + i * 2 * math.pi / 5) * 0.06) for i in range(5)], C(reg), (0, 1, 0))
        face(m, [(x + math.cos(k + i * 2 * math.pi / 3) * 0.022, h + 0.008, z + math.sin(k + i * 2 * math.pi / 3) * 0.022) for i in range(3)], C(cuore), (0, 1, 0))
    return _obj(m)


def cs_d_erba():
    """Ciuffo d'erba alta di cresta (0,8 m): 18 fili a due facce, verdi e gialli-verdi, qualcuno secco giallo. Leggero (si ripete)."""
    m = Mesh('cs_d_erba')
    for k in range(18):
        a = k * 2.399
        d = (math.cos(a), 0, math.sin(a))
        sd = (-d[2], 0, d[0])
        r = 0.04 + 0.1 * h01(k, 0, 551)
        alt = 0.5 + 0.32 * h01(k, 1, 551)
        pg = 0.18 + 0.22 * h01(k, 2, 551)
        base = (d[0] * r, 0, d[2] * r)
        tip = _add(base, (d[0] * pg, alt, d[2] * pg))
        reg = C('giallo') if k % 5 == 0 else C('erba_chiara') if k % 2 else C('erba')
        for sg in (1, -1):
            face(m, [_add(base, _mul(sd, -0.035)), _add(base, _mul(sd, 0.035)), tip], reg, _mul((d[0], 0.3, d[2]), sg))
    return _obj(m)


def cs_d_felce():
    """Felce del sottobosco: sei fronde ad arco basso con le foglioline a pettine inclinate verso la punta, verdi e gialle-verdi.
    Leggera (si ripete): solo le facce di sopra, le fronde restano rivolte in su."""
    m = Mesh('cs_d_felce')
    for k in range(6):
        a = k * 2 * math.pi / 6 + 0.2
        d, s = (math.cos(a), 0, math.sin(a)), (-math.sin(a), 0, math.cos(a))
        L = 0.8 + 0.25 * h01(k, 0, 561)
        alza = 0.45 + 0.2 * h01(k, 1, 561)
        reg = C('erba_chiara') if k % 3 == 0 else C('erba')
        NP = 6
        P = [(d[0] * L * t, alza * math.sin(math.pi * t * 0.7) + 0.02, d[2] * L * t) for t in [i / NP for i in range(NP + 1)]]
        for i in range(1, NP):
            w = 0.22 * math.sin(math.pi * (i + 0.5) / (NP + 1)) + 0.03
            for sg in (1, -1):
                tip = _add(P[i + 1], _add(_mul(s, sg * w), (0, -0.04, 0)))
                face(m, [P[i], P[i + 1], tip], reg, (0, 1, 0))
    return _obj(m)


def cs_d_cartello():
    """Palo di legno del sentiero (1,5 m) coi segni bianco-rossi e la freccia che punta a destra (+X)."""
    m = Mesh('cs_d_cartello')
    bande = lambda i, j, nrm: (C('legno'), C('rosso'), C('pietra_chiara'), C('rosso'), C('legno'))[i]
    tubo_col(m, [(0, -0.05, 0), (0, 1.22, 0), (0, 1.29, 0), (0, 1.36, 0), (0, 1.43, 0), (0, 1.5, 0)], [0.058] * 6, bande, n=4, a0=math.pi / 4)
    m.cone(4, 0.065, 1.5, 1.6, C('legno_scuro'), cx=0, cz=0, a0=0)
    # freccia: corpo bianco e punta rossa, davanti al palo, con lo spessore
    z0, z1 = -0.088, -0.045
    corpo = [(-0.08, 1.0), (0.4, 1.0), (0.4, 1.18), (-0.08, 1.18)]
    punta = [(0.4, 0.97), (0.56, 1.09), (0.4, 1.21)]
    for poly, reg in ((corpo, 'pietra_chiara'), (punta, 'rosso')):
        face(m, [(x, y, z0) for x, y in poly], C(reg), (0, 0, -1))
        face(m, [(x, y, z1) for x, y in poly], C(reg), (0, 0, 1))
    giro = [(-0.08, 1.0), (0.4, 1.0), (0.4, 0.97), (0.56, 1.09), (0.4, 1.21), (0.4, 1.18), (-0.08, 1.18)]
    for (xa, ya), (xb, yb) in zip(giro, giro[1:] + giro[:1]):
        face(m, [(xa, ya, z0), (xb, yb, z0), (xb, yb, z1), (xa, ya, z1)], C('pietra'), (yb - ya, -(xb - xa), 0) if (xa, ya) != (-0.08, 1.18) else (-1, 0, 0))
    # ancora il segno bianco-rosso sulla freccia
    for k, (x0, x1) in enumerate(((0.02, 0.1), (0.18, 0.26))):
        face(m, [(x0, 1.04, z0 - 0.004), (x1, 1.04, z0 - 0.004), (x1, 1.14, z0 - 0.004), (x0, 1.14, z0 - 0.004)], C('rosso'), (0, 0, -1))
        face(m, [(x0, 1.04, z1 + 0.004), (x1, 1.04, z1 + 0.004), (x1, 1.14, z1 + 0.004), (x0, 1.14, z1 + 0.004)], C('rosso'), (0, 0, 1))
    roccia(m, 0.18, 0.12, 0.13, 0.1, 0.11, 571, n=5, anelli=((0.0, 1.0), (0.5, 0.85), (0.9, 0.4)), licheni=1)
    roccia(m, -0.15, -0.1, 0.1, 0.08, 0.09, 572, n=5, anelli=((0.0, 1.0), (0.5, 0.85), (0.9, 0.4)), licheni=0)
    for k in range(4):
        a = k * 1.6 + 0.4
        d = (math.cos(a), 0, math.sin(a))
        lama(m, (d[0] * 0.09, 0, d[2] * 0.09), d, 0.35, 0.03, 0.12, C('erba'), C('erba_chiara'))
    return _obj(m)


def cs_d_rampa():
    """Rampa per i salti (3 m, alta 1 m): piano di tavole curvo sul fianco di terra; si entra da +Z, il labbro è a −Z."""
    m = Mesh('cs_d_rampa')
    L, H, W, K = 3.0, 1.0, 0.7, 10
    prof = [(1.5 - L * i / K, H * (i / K) ** 1.7) for i in range(K + 1)]
    for i in range(K):
        (za, ya), (zb, yb) = prof[i], prof[i + 1]
        face(m, [(-W, ya, za), (W, ya, za), (W, yb, zb), (-W, yb, zb)], C('sabbia') if i % 2 else C('sabbia_chiara'), (0, 1, 0))
        for s in (-1, 1):
            face(m, [(s * W, 0, za), (s * W, 0, zb), (s * W, yb, zb), (s * W, ya, za)], C('legno'), (s, 0, 0))
            # fianco di terra che scende dal bordo del piano al suolo
            face(m, [(s * W, ya, za), (s * W, yb, zb), (s * (W + 0.25 + 0.55 * yb), 0, zb), (s * (W + 0.25 + 0.55 * ya), 0, za)], C('legno') if i % 3 == 1 else C('legno_chiaro'),
                 (s, 1, 0))
    zl, yl = prof[-1]
    face(m, [(-W, 0, zl), (W, 0, zl), (W, yl, zl), (-W, yl, zl)], C('legno_scuro'), (0, 0, -1))
    for s in (-1, 1):
        face(m, [(s * W, yl, zl), (s * (W + 0.25 + 0.55 * yl), 0, zl), (s * W, 0, zl)], C('legno_scuro'), (0, 0, -1))
        m.box(W - 0.07 if s > 0 else -W, 0, zl - 0.08, W if s > 0 else -W + 0.07, yl + 0.03, zl, C('legno_scuro'))  # montanti
    m.box(-W, yl - 0.02, zl - 0.06, W, yl + 0.03, zl + 0.04, C('legno_scuro'))  # traversa del labbro
    roccia(m, 1.05, -1.0, 0.18, 0.14, 0.15, 581, n=5, anelli=((0.0, 1.0), (0.5, 0.85), (0.9, 0.4)), licheni=1)
    return _obj(m)


MODELS = {f.__name__: f for f in (
    cs_d_bici_telaio, cs_d_bici_sterzo, cs_d_bici_ruota, cs_d_braccia,
    cs_d_abete_a, cs_d_abete_b, cs_d_pino_cresta, cs_d_tronco_alto,
    cs_d_tronco, cs_d_ceppo, cs_d_sasso_a, cs_d_sasso_b, cs_d_masso, cs_d_radici, cs_d_cespuglio, cs_d_fiori, cs_d_erba, cs_d_felce,
    cs_d_cartello, cs_d_rampa)}
