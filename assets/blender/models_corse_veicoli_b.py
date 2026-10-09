# MAREA — veicoli dell'Isola delle Corse, gruppo b (#178): moto d'acqua, bob, carrello da miniera.
# Vedi models_corse_veicoli.py per lo stile e docs/CORSE.md A6. Davanti −Z, pivot a terra al centro, seduta libera.
# Ritocco del 9 ott 2026 («troppo squadrati»): scafi e casse come loft di sezioni tonde (tubo_z / anello_xz), spigoli smussati.
import math
from lib import Mesh, Xf, beam
from corse_kit import C, sfera, volante, tubo_z, scatola_tonda


def _obj(m):
    return [m.build()]


def anello_xz(y, w, d, r, seg=2):
    """Rettangolo con angoli arrotondati nel piano XZ alla quota y (larghezza w, profondità d, raggio r).
    Punti in ordine di angolo crescente (x=cos, z=sin): in un loft verso l'alto le facce guardano in fuori."""
    r = max(0.005, min(r, w / 2 - 1e-4, d / 2 - 1e-4))
    pts = []
    for qx, qz, a0 in ((1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)):
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((qx * (w / 2 - r) + r * math.cos(a), y, qz * (d / 2 - r) + r * math.sin(a)))
    return pts


# ---------------------------------------------------------------------------------------------------------------
def cs_v_moto_acqua():
    """Moto d'acqua blu e bianca: carena tonda scura, bordo blu, ponte bianco, cofano blu col muso bianco e giallo,
    sellone blu rialzato dietro, manubrio nero. Seduta libera sul sellone (y ~0.85, z ~0.4)."""
    m = Mesh('cs_v_moto_acqua')
    blu, abisso, bianco, giallo, nero = C('acqua_profonda'), C('abisso'), C('pietra_chiara'), C('giallo'), C('nero_caldo')

    # carena: prua che sale e si restringe, poppa larga e piatta  (z, cx, cy, larghezza, altezza, raggio)
    tubo_z(m, [(-1.28, 0, 0.36, 0.14, 0.18, 0.06), (-1.1, 0, 0.26, 0.5, 0.3, 0.13), (-0.7, 0, 0.2, 0.84, 0.4, 0.17),
               (-0.2, 0, 0.19, 0.94, 0.38, 0.18), (0.6, 0, 0.19, 0.98, 0.38, 0.18), (1.1, 0, 0.19, 0.9, 0.38, 0.17),
               (1.22, 0, 0.2, 0.78, 0.34, 0.15)], abisso)
    # bordo blu vivo attorno allo scafo
    tubo_z(m, [(-1.3, 0, 0.42, 0.18, 0.14, 0.05), (-1.1, 0, 0.37, 0.58, 0.16, 0.07), (-0.7, 0, 0.4, 0.92, 0.2, 0.09),
               (0.6, 0, 0.4, 1.04, 0.2, 0.09), (1.1, 0, 0.4, 0.98, 0.2, 0.09), (1.25, 0, 0.4, 0.84, 0.2, 0.09)], blu)
    # ponte bianco
    tubo_z(m, [(-1.27, 0, 0.52, 0.12, 0.12, 0.04), (-1.1, 0, 0.55, 0.46, 0.14, 0.06), (-0.7, 0, 0.57, 0.8, 0.14, 0.07),
               (0.6, 0, 0.57, 0.9, 0.14, 0.07), (1.1, 0, 0.57, 0.84, 0.14, 0.07), (1.22, 0, 0.56, 0.74, 0.14, 0.07)], bianco)
    # pedane: bordino bianco ai lati del sellone e striscia gialla
    for s in (-1, 1):
        tubo_z(m, [(-0.05, s * 0.38, 0.655, 0.1, 0.07, 0.03), (1.0, s * 0.38, 0.655, 0.1, 0.07, 0.03)], bianco, seg=2)
        tubo_z(m, [(0.0, s * 0.28, 0.645, 0.04, 0.03, 0.012), (0.95, s * 0.28, 0.645, 0.04, 0.03, 0.012)], giallo, seg=2)

    # cofano blu: sale dalla prua verso il manubrio, tondo e un po' a goccia
    tubo_z(m, [(-1.05, 0, 0.66, 0.12, 0.1, 0.04), (-0.8, 0, 0.7, 0.4, 0.2, 0.09), (-0.45, 0, 0.78, 0.66, 0.42, 0.16),
               (-0.08, 0, 0.82, 0.72, 0.4, 0.16), (0.0, 0, 0.82, 0.7, 0.38, 0.16)], blu)
    # striscia bianca sul muso, appoggiata sul dorso del cofano
    tubo_z(m, [(-1.07, 0, 0.67, 0.07, 0.1, 0.03), (-0.8, 0, 0.805, 0.16, 0.05, 0.02), (-0.45, 0, 0.995, 0.2, 0.05, 0.02),
               (-0.08, 0, 1.025, 0.2, 0.05, 0.02)], bianco, seg=2)
    # macchia gialla a onda sul fianco del cofano
    for s in (-1, 1):
        sfera(m, s * 0.33, 0.82, -0.4, 0.035, 0.12, 0.2, giallo, n=8, rings=3)
        sfera(m, s * 0.31, 0.84, -0.18, 0.03, 0.09, 0.12, giallo, n=8, rings=3)

    # sellone blu: basso davanti, rialzato dietro
    tubo_z(m, [(0.0, 0, 0.72, 0.4, 0.18, 0.07), (0.4, 0, 0.74, 0.5, 0.24, 0.1), (0.85, 0, 0.8, 0.46, 0.34, 0.14),
               (1.06, 0, 0.78, 0.4, 0.28, 0.12)], blu)
    # pompa dietro e fanalino
    beam(m, (0, 0.24, 1.18), (0, 0.24, 1.3), 0.26, 0.16, nero, end=nero, n=10)
    sfera(m, 0, 0.8, 1.07, 0.05, 0.05, 0.03, giallo, n=8, rings=3)

    # piantone e manubrio
    beam(m, (0, 0.98, -0.12), (0, 1.2, -0.08), 0.12, 0.12, blu, end=blu, n=8)
    beam(m, (-0.22, 1.22, -0.06), (0.22, 1.22, -0.06), 0.07, 0.07, blu, end=blu, n=8)
    for s in (-1, 1):
        sfera(m, s * 0.22, 1.22, -0.06, 0.05, 0.05, 0.05, blu, n=8, rings=3)
        beam(m, (s * 0.22, 1.22, -0.06), (s * 0.46, 1.2, 0.08), 0.1, 0.1, nero, end=nero, n=8)
    return _obj(m)


# ---------------------------------------------------------------------------------------------------------------
def cs_v_bob():
    """Bob rosso a due posti in fila: scocca a goccia con muso bombato e striscia bianca, abitacolo aperto con due
    sedili neri, volante davanti, paraurti grigio ai fianchi e due pattini curvi sotto. Sedute libere (y 0.55, z 0.2 e 0.8)."""
    m = Mesh('cs_v_bob')
    rosso, bianco, nero, grigio, scuro = C('rosso'), C('pietra_chiara'), C('nero_caldo'), C('pietra'), C('roccia')
    # scocca bassa, larga in mezzo e stretta ai capi
    tubo_z(m, [(-1.33, 0, 0.36, 0.5, 0.2, 0.08), (-1.15, 0, 0.34, 0.8, 0.3, 0.12), (-0.6, 0, 0.37, 0.98, 0.36, 0.16),
               (0.5, 0, 0.38, 1.06, 0.38, 0.17), (1.0, 0, 0.38, 1.04, 0.38, 0.17), (1.32, 0, 0.37, 0.74, 0.32, 0.14)], rosso, seg=2)
    # muso a goccia: bombato davanti, sale verso il cruscotto
    tubo_z(m, [(-1.36, 0, 0.43, 0.5, 0.34, 0.15), (-1.15, 0, 0.49, 0.8, 0.46, 0.21), (-0.65, 0, 0.53, 0.98, 0.54, 0.26),
               (-0.1, 0, 0.57, 1.04, 0.62, 0.3)], rosso)
    # striscia bianca: scende davanti sul muso e corre sul dorso
    tubo_z(m, [(-1.385, 0, 0.5, 0.2, 0.2, 0.07), (-1.15, 0, 0.705, 0.2, 0.05, 0.02), (-0.65, 0, 0.805, 0.2, 0.05, 0.02),
               (-0.1, 0, 0.885, 0.2, 0.05, 0.02)], bianco, seg=2)
    # fianchi dell'abitacolo (bordo alto che sale verso dietro) e parete di coda
    for s in (-1, 1):
        tubo_z(m, [(-0.12, s * 0.46, 0.59, 0.14, 0.58, 0.07), (0.5, s * 0.46, 0.65, 0.14, 0.7, 0.07),
                   (1.0, s * 0.46, 0.68, 0.14, 0.76, 0.07), (1.3, s * 0.46, 0.64, 0.14, 0.68, 0.07)], rosso, seg=2)
    tubo_z(m, [(1.14, 0, 0.63, 0.9, 0.66, 0.18), (1.32, 0, 0.62, 0.74, 0.62, 0.18)], rosso)
    # pavimento scuro dell'abitacolo
    scatola_tonda(m, -0.38, 0.5, -0.06, 0.38, 0.53, 1.18, scuro, r=0.015, seg=1)
    # sedili neri: seduta, schienale alto con la testa tonda, fianchetti
    for zc in (0.2, 0.8):
        scatola_tonda(m, -0.34, 0.5, zc - 0.22, 0.34, 0.58, zc + 0.22, nero, r=0.04, seg=1)
        scatola_tonda(m, -0.34, 0.55, zc + 0.2, 0.34, 1.08, zc + 0.33, nero, r=0.08, seg=1)
        scatola_tonda(m, -0.27, 1.02, zc + 0.2, 0.27, 1.18, zc + 0.31, nero, r=0.07, seg=1)
        for s in (-1, 1):
            scatola_tonda(m, s * 0.31 - 0.04, 0.55, zc - 0.2, s * 0.31 + 0.04, 0.8, zc + 0.22, nero, r=0.035, seg=1)
    # volante
    volante(m, 0, 1.02, -0.04, 0.2, inclina=-30)
    for s in (-1, 1):
        # paraurti grigio chiaro che segue il fianco, con punta bianca davanti
        beam(m, (s * 0.43, 0.42, -1.2), (s * 0.57, 0.42, -0.75), 0.08, 0.09, grigio, end=grigio, n=8)
        beam(m, (s * 0.57, 0.42, -0.75), (s * 0.58, 0.42, 1.0), 0.08, 0.09, grigio, end=grigio, n=8)
        sfera(m, s * 0.57, 0.42, -0.75, 0.045, 0.045, 0.045, grigio, n=6, rings=2)
        sfera(m, s * 0.43, 0.42, -1.21, 0.07, 0.065, 0.07, bianco, n=7, rings=3)
        # pattino lungo, con la punta rialzata e curva
        tubo_z(m, [(-1.26, s * 0.47, 0.25, 0.1, 0.08, 0.035), (-1.02, s * 0.47, 0.14, 0.12, 0.1, 0.045),
                   (-0.72, s * 0.47, 0.07, 0.13, 0.12, 0.05), (0.95, s * 0.47, 0.07, 0.13, 0.12, 0.05),
                   (1.2, s * 0.47, 0.1, 0.12, 0.1, 0.045), (1.33, s * 0.47, 0.17, 0.1, 0.08, 0.035)], scuro, seg=2)
        # puntoni tra scocca e pattino
        for zz in (-0.55, 0.0, 0.85):
            scatola_tonda(m, s * 0.47 - 0.05, 0.1, zz - 0.07, s * 0.47 + 0.05, 0.28, zz + 0.07, scuro, r=0.03, seg=1)
    return _obj(m)


# ---------------------------------------------------------------------------------------------------------------
def cs_v_carrello_miniera():
    """Carrello da miniera: cassone di assi leggermente bombate e svasato, fasce di ferro tonde con borchie, carbone a sassi
    tondi, quattro ruote ferrate e un pezzo di binario con traversine. Seduta libera sul carbone davanti (y ~0.9, z ~ -0.2)."""
    m = Mesh('cs_v_carrello_miniera')
    pietra, ferro, ferro_s, chiara, nero = C('pietra'), C('pietra_scura'), C('roccia'), C('pietra_chiara'), C('nero_caldo')
    yb, yt = 0.44, 1.05
    hb = (0.4, 0.6)      # semi-larghezza e semi-lunghezza in basso
    hc = (0.52, 0.74)    # in alto
    RC = 0.11            # raggio degli spigoli verticali della cassa

    def mezzo(y):
        t = (y - yb) / (yt - yb)
        return (hb[0] + (hc[0] - hb[0]) * t, hb[1] + (hc[1] - hb[1]) * t)

    def anello(y, off=0.0):
        hx, hz = mezzo(y)
        return anello_xz(y, 2 * (hx + off), 2 * (hz + off), RC + off)

    def fascia_(profilo, reg, fondo=None):
        m.loft([anello(y, off) for y, off in profilo], reg, bottom=fondo)

    # pareti di assi: tre assi per lato, leggermente bombate
    for ya, yb2, r in [(0.56, 0.7, 'legno_chiaro'), (0.7, 0.84, 'legno'), (0.84, 0.97, 'legno_chiaro')]:
        fascia_([(ya, -0.006), ((ya + yb2) / 2, 0.016), (yb2, -0.006)], C(r))
    # fascia di ferro in basso (col fondo)
    fascia_([(yb, 0.0), (yb + 0.03, 0.03), (0.53, 0.03), (0.575, 0.016)], ferro, fondo=ferro_s)
    # cornice di ferro in alto: fascia tonda, bordo chiaro arrotondato, interno scuro
    fascia_([(0.95, 0.0), (0.985, 0.045), (1.06, 0.045)], ferro)
    fascia_([(1.06, 0.045), (1.095, 0.025), (1.105, -0.03), (1.09, -0.075)], pietra)
    fascia_([(1.09, -0.075), (0.92, -0.085)], ferro_s)
    # letto di carbone sotto i sassi
    yl = 0.92
    hx, hz = mezzo(yl)
    m.poly(list(reversed(anello_xz(yl, 2 * (hx - 0.085), 2 * (hz - 0.085), RC))), nero)

    # angolari verticali di ferro tondi con borchie
    for sx in (-1, 1):
        for sz in (-1, 1):
            def ang(y, off):
                hx, hz = mezzo(y)
                k = (RC + off) * 0.7071
                return (sx * (hx - RC + k), y, sz * (hz - RC + k))
            beam(m, ang(yb, 0.03), ang(yt + 0.01, 0.045), 0.1, 0.1, ferro, end=ferro, n=8)
            for y in (0.5, 0.92):
                px, _, pz = ang(y, 0.075)
                sfera(m, px, y, pz, 0.032, 0.032, 0.032, chiara, n=5, rings=2)

    # carbone: sassi tondeggianti e irregolari, ammucchiati dietro (davanti basso per il pilota)
    # (x, quota sul letto, z, raggi x y z, colore, rotazione y, rotazione x)
    pezzi = [(-0.26, 0.1, 0.42, 0.17, 0.11, 0.15, 'nero_caldo', 12, 8), (0.24, 0.11, 0.45, 0.16, 0.12, 0.17, 'roccia', 20, -10),
             (0.0, 0.11, 0.5, 0.15, 0.1, 0.13, 'nero_caldo', 35, 12), (-0.27, 0.09, 0.05, 0.15, 0.1, 0.12, 'roccia', 8, -6),
             (0.28, 0.09, 0.08, 0.14, 0.09, 0.14, 'nero_caldo', 50, 10), 
             (-0.14, 0.25, 0.34, 0.15, 0.11, 0.13, 'roccia', 22, 14), (0.14, 0.26, 0.36, 0.14, 0.1, 0.14, 'nero_caldo', 5, -12),
             (0.0, 0.39, 0.34, 0.12, 0.09, 0.11, 'pietra_scura', 22, -8), (0.04, 0.5, 0.5, 0.12, 0.1, 0.11, 'nero_caldo', 33, 9),
             (-0.1, 0.38, 0.18, 0.11, 0.08, 0.1, 'nero_caldo', 10, 15), (0.12, 0.37, 0.1, 0.11, 0.08, 0.1, 'roccia', 30, -5),
             (-0.3, 0.05, -0.38, 0.11, 0.06, 0.1, 'nero_caldo', 20, 10), (0.3, 0.05, -0.33, 0.11, 0.06, 0.1, 'roccia', 40, -8)]
    for x, hy, z, rx, ry, rz, col, rot, tilt in pezzi:
        m.push(Xf(t=(x, yl + hy, z), r=(tilt, rot, 0)))
        sfera(m, 0, 0, 0, rx, ry, rz, C(col), n=6, rings=3)
        m.pop()

    # sotto: telaio, assali, ruote ferrate fuori dalla cassa, sui binari
    gx = 0.5
    scatola_tonda(m, -0.36, 0.38, -0.55, 0.36, yb, 0.55, ferro_s, r=0.03, seg=2)
    scatola_tonda(m, -0.12, 0.3, -0.78, 0.12, 0.44, -0.6, pietra, r=0.05, seg=2, muso=(0.8, 0.8, 0.0))    # respingente davanti
    ry = 0.335
    for zz in (-0.47, 0.47):
        beam(m, (-gx, ry, zz), (gx, ry, zz), 0.07, 0.07, ferro_s, end=ferro_s, n=6)
        for s in (-1, 1):
            x = s * gx
            beam(m, (x - 0.05, ry, zz), (x + 0.05, ry, zz), 0.38, 0.38, ferro_s, end=ferro_s, n=10)
            beam(m, (x + s * 0.03, ry, zz), (x + s * 0.075, ry, zz), 0.22, 0.22, pietra, end=pietra, n=8)
            beam(m, (x - s * 0.05, ry, zz), (x - s * 0.075, ry, zz), 0.46, 0.46, ferro_s, end=ferro_s, n=8)   # bordino interno

    # binario corto: due rotaie su traversine di legno
    for i, zz in enumerate((-0.96, -0.48, 0.0, 0.48, 0.96)):
        scatola_tonda(m, -0.7, 0.0, zz - 0.07, 0.7, 0.07, zz + 0.07, C('legno' if i % 2 else 'legno_scuro'), r=0.03, seg=1)
    for s in (-1, 1):
        tubo_z(m, [(-1.1, s * gx, 0.105, 0.09, 0.07, 0.03), (1.1, s * gx, 0.105, 0.09, 0.07, 0.03)], ferro, seg=2)
    return _obj(m)


MODELS = {'cs_v_moto_acqua': cs_v_moto_acqua, 'cs_v_bob': cs_v_bob, 'cs_v_carrello_miniera': cs_v_carrello_miniera}
