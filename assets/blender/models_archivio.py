# Archivio Navigazionale (Epopea della Regata, dungeon 2 — Riccardo, 9 ott 2026): ingresso sull'arco est dell'anello della Laguna, kit
# del dungeon e i nemici del Collettivo Rottamautomi. SCRITTO SUL PC DI RICCARDO SENZA BLENDER: non è mai stato eseguito. Lo lancia il
# Claude di Jack:
#   npm run assets prop_ingresso_archivio dng_archivio_pavimento dng_archivio_muro dng_archivio_muro_basso nem_archivista nem_idroragno nem_aerostato nem_astrolabio nem_anello
# poi lo sistema se qualcosa non torna e guarda il foglio dei contatti (tests/out/rpg_contact.png).
# I nomi sono quelli che cerca il codice: prop_ingresso_<stile> (game/ingressi.ts), dng_archivio_pavimento/muro/muro_basso
# (rpg/dungeon_scene.ts) e il campo `model` di enemies.json. Finché i modelli mancano dal manifest il gioco usa i segnaposto in codice di
# apps/client/src/rpg/archivio.ts (nemici e kit) e apps/client/src/game/ingressi_forme.ts (ingresso): le forme qui sotto li ricalcano, così
# l'aspetto non cambia di colpo. Scaffali (le colonne) e rastrelliere a grata restano in codice (archivio.ts): niente modello.
# L'Astrolabio è solo il nucleo: i suoi tre anelli li aggiunge sempre il client (girano a scatti e si staccano a metà vita).
# Chi vola (Aerostato, Astrolabio, anelli) ha il pivot a terra come gli altri: lo alza il client (dungeon_actors.ts).
# Convenzioni come models_drenaggio.py: x destra, y su, davanti −Z, 1 unità = 1 m, pivot a terra al centro; dng_* moduli ≤ 60 triangoli
# (pavimento da 0 a −0,3, muri da 0 a 2,4, bassi 0,6); nem_* ≤ 600 (l'Astrolabio, boss, ≤ 1.200); solo colori della palette e regioni
# dell'atlas che esistono già (`tavole`, `tavole_scure`, `carta` e i campioni piatti `p_<colore>`).
import math
from lib import Mesh, Xf

PAV, MURO, CIMA = 'tavole', 'tavole_scure', 'p_legno_scuro'


def _obj(m, **info):
    return ([m.build()], info) if info else [m.build()]


def _disco(m, c, r, spessore, reg, n=10):
    """Disco verticale (asse lungo Z) centrato in c: anelli nel piano XY."""
    ring = lambda z: [(c[0] + math.cos(2 * math.pi * i / n) * r, c[1] + math.sin(2 * math.pi * i / n) * r, z) for i in range(n)]  # noqa: E731
    a, b = ring(c[2] - spessore / 2), ring(c[2] + spessore / 2)
    for i in range(n):
        j = (i + 1) % n
        m.poly([a[i], a[j], b[j], b[i]], reg)
    m.poly(list(reversed(a)), reg)
    m.poly(list(b), reg)


def _anello(m, r, t, reg, n=12):
    """Anello (toro a sezione quadrata) nel piano XZ centrato nell'origine: usare m.push(Xf(...)) per metterlo e inclinarlo."""
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        p = lambda a, dr, dy: ((r + dr) * math.cos(a), dy, (r + dr) * math.sin(a))  # noqa: E731
        for (dr0, dy0), (dr1, dy1) in (((-t, -t), (t, -t)), ((t, -t), (t, t)), ((t, t), (-t, t)), ((-t, t), (-t, -t))):
            m.poly([p(a0, dr0, dy0), p(a1, dr0, dy0), p(a1, dr1, dy1), p(a0, dr1, dy1)], reg)


# ------------------------------------------------------------------ manifest principale: ingresso
def prop_ingresso_archivio():
    """Osservatorio di pietra (3,2 × 2,6 m) con la cupola d'ottone, il portone tondo con la rosa dei venti verso −Z, la banderuola in
    cima, due rotoli di carte davanti: l'Archivio Navigazionale sotto l'arco est della Laguna (≤ 200 triangoli)."""
    m = Mesh('prop_ingresso_archivio')
    m.box(-1.6, 0, -1.0, 1.6, 2.6, 1.6, 'p_pietra_scura', top='p_roccia', skip=('bottom',))
    m.box(-1.75, 2.6, -1.15, 1.75, 2.85, 1.75, 'p_legno_scuro', skip=('bottom',))
    m.loft([m.ring(6, 1.25, 2.85, cz=0.3), m.ring(6, 1.1, 3.4, cz=0.3), m.ring(6, 0.7, 3.85, cz=0.3)], 'p_arancio', top='p_arancio')  # cupola
    m.prism(5, 0.06, 0.06, 3.85, 5.2, 'p_nero_caldo', cz=0.3)                    # asta della banderuola
    m.box(-0.4, 4.92, 0.26, 0.5, 4.98, 0.34, 'p_giallo', skip=('bottom',))       # banderuola
    m.push(Xf(t=(0.6, 4.95, 0.3), r=(0, 0, -90)))                               # punta della banderuola, verso +x
    m.cone(4, 0.14, -0.15, 0.15, 'p_giallo', bottom='p_giallo')
    m.pop()
    _disco(m, (0, 1.2, -1.0), 1.0, 0.2, 'p_legno_scuro', n=8)                    # portone tondo
    _disco(m, (0, 1.2, -1.04), 0.82, 0.06, 'p_nero_caldo', n=8)
    m.box(-0.75, 1.16, -1.17, 0.75, 1.24, -1.11, 'p_giallo', skip=('back',))      # rosa dei venti
    m.box(-0.04, 0.45, -1.17, 0.04, 1.95, -1.11, 'p_giallo', skip=('back',))
    for x, r, l in ((-1.25, 0.16, 1.1), (1.3, 0.14, 0.9)):                       # rotoli di carte
        m.push(Xf(t=(x, r, -1.15), r=(0, 0, 90)))
        m.prism(5, r, r, -l / 2, l / 2, 'p_sabbia_chiara', top='carta', bottom='carta')
        m.pop()
    return _obj(m, footprint=[4, 4])


# ------------------------------------------------------------------ kit del dungeon (≤ 60 tri)
def dng_archivio_pavimento():
    """Tavolato 2×2 a y = 0 (bordo che scende a −0,3) con quattro chiodi d'ottone."""
    m = Mesh('dng_archivio_pavimento')
    m.box(-1, -0.3, -1, 1, 0, 1, 'p_legno_scuro', top=PAV, skip=('bottom',))
    for x, z in ((-0.8, -0.8), (0.7, -0.3), (-0.3, 0.2), (0.3, 0.7)):
        m.box(x, 0, z, x + 0.06, 0.01, z + 0.06, 'p_arancio', skip=('bottom',))
    return _obj(m)


def _muro(m, H):
    m.box(-1, 0, -1, 1, H, 1, MURO, top=CIMA, skip=('bottom',))
    if H > 1:  # cornice d'ottone in alto e una fila di rotoli di carta (visti di testa) tutto attorno
        m.box(-1.04, H - 0.14, -1.04, 1.04, H - 0.08, 1.04, 'p_arancio', skip=('bottom', 'top'))
        m.box(-1.03, 1.0, -1.03, 1.03, 1.3, 1.03, 'carta', skip=('bottom', 'top'))


def dng_archivio_muro():
    m = Mesh('dng_archivio_muro')
    _muro(m, 2.4)
    return _obj(m)


def dng_archivio_muro_basso():
    m = Mesh('dng_archivio_muro_basso')
    _muro(m, 0.6)
    return _obj(m)


# ------------------------------------------------------------------ nemici (statici, il client li anima e alza chi vola)
def nem_archivista():
    """Archivista a Molla: bipede alto e magro, torso a cilindro d'ottone, chiave della carica sulla schiena, monocolo, braccia a lama."""
    m = Mesh('nem_archivista')
    for sx in (-1, 1):
        m.cbox(sx * 0.13, 0, 0.1, 0.1, 0, 0.8, 'p_pietra_scura')
        m.cbox(sx * 0.13, -0.06, 0.18, 0.28, 0, 0.06, 'p_nero_caldo')
        m.cbox(sx * 0.27, -0.05, 0.06, 0.06, 0.9, 1.35, 'p_pietra_scura')                     # braccio
        m.cbox(sx * 0.31, -0.42, 0.03, 0.6, 0.86, 0.94, 'p_pietra_chiara')   # lama
    m.prism(7, 0.16, 0.2, 0.8, 1.4, 'p_arancio', top='p_arancio', bottom='p_arancio')
    for y in (0.92, 1.27):
        m.prism(7, 0.21, 0.21, y, y + 0.06, 'p_legno_scuro')
    m.cbox(0, 0.28, 0.06, 0.25, 1.12, 1.18, 'p_giallo')                                      # chiave della carica
    m.cbox(0, 0.4, 0.34, 0.04, 1.09, 1.21, 'p_giallo')
    m.cbox(0, 0, 0.28, 0.26, 1.43, 1.67, 'p_legno_scuro')
    _disco(m, (0.07, 1.57, -0.15), 0.07, 0.04, 'p_acqua_bassa', n=8)                         # monocolo
    m.cbox(0, 0, 0.3, 0.3, 1.67, 1.71, 'p_ombra_calda')
    m.prism(6, 0.12, 0.1, 1.71, 1.85, 'p_ombra_calda', top='p_ombra_calda')                 # cappello
    return _obj(m)


def nem_idroragno():
    """Drone Idro-Ragno: cupola d'ottone, otto zampe sottili piegate, lanciarpioni sulla schiena, occhi rossi."""
    m = Mesh('nem_idroragno')
    m.prism(8, 0.38, 0.32, 0.31, 0.53, 'p_legno_scuro', bottom='p_legno_scuro')
    m.loft([m.ring(8, 0.32, 0.53), m.ring(8, 0.2, 0.68), m.ring(8, 0.0001, 0.75)], 'p_arancio')
    for sx in (-1, 1):
        for z in (-0.25, -0.08, 0.08, 0.25):
            m.push(Xf(t=(sx * 0.45, 0.55, z), r=(0, 0, sx * -34)))
            m.box(-0.2, -0.025, -0.025, 0.2, 0.025, 0.025, 'p_pietra_scura')
            m.pop()
            m.push(Xf(t=(sx * 0.7, 0.3, z * 1.4), r=(0, 0, sx * 14)))
            m.box(-0.025, -0.25, -0.025, 0.025, 0.25, 0.025, 'p_pietra_scura')
            m.pop()
    m.push(Xf(t=(0, 0.78, -0.15), r=(90, 0, 0)))
    m.prism(6, 0.07, 0.06, -0.35, 0.35, 'p_roccia', top='p_roccia', bottom='p_roccia')     # lanciarpioni
    m.pop()
    m.push(Xf(t=(0, 0.78, -0.5), r=(-90, 0, 0)))
    m.cone(6, 0.07, 0, 0.18, 'p_pietra_chiara', bottom='p_pietra_chiara')                   # punta dell'arpione
    m.pop()
    for sx in (-1, 1):
        m.cbox(sx * 0.1, -0.36, 0.07, 0.04, 0.45, 0.51, 'p_rosso', mat='mat_emissivo')
    return _obj(m)


def nem_aerostato():
    """Aerostato-Spia: pallone rattoppato con le fasce d'ottone, gondola con l'occhio-lente, elica dietro e due bombe appese."""
    m = Mesh('nem_aerostato')
    m.loft([m.ring(8, 0.3, 0.8), m.ring(8, 0.6, 1.3), m.ring(8, 0.62, 1.8), m.ring(8, 0.3, 2.25), m.ring(8, 0.0001, 2.35)], 'p_sabbia', bottom='p_sabbia')
    for y in (1.27, 1.77):
        m.prism(8, 0.63, 0.63, y, y + 0.06, 'p_arancio')
    m.box(0.16, 1.5, -0.64, 0.34, 1.68, -0.62, 'p_legno_chiaro')                             # toppa
    for x, z in ((-0.25, -0.25), (0.25, -0.25), (-0.25, 0.25), (0.25, 0.25)):
        m.cbox(x, z, 0.02, 0.02, 0.4, 0.82, 'p_ombra_calda')                                 # funi
    m.cbox(0, 0, 0.55, 0.55, 0.11, 0.39, 'p_legno')                                          # gondola
    _disco(m, (0, 0.27, -0.3), 0.11, 0.06, 'p_acqua_bassa', n=8)                              # occhio-lente
    m.cbox(0, 0.33, 0.5, 0.06, 0.27, 0.33, 'p_pietra_scura'); m.cbox(0, 0.36, 0.06, 0.04, 0.1, 0.5, 'p_pietra')  # elica
    for sx in (-1, 1):
        m.prism(6, 0.1, 0.1, -0.07, 0.11, 'p_nero_caldo', top='p_nero_caldo', bottom='p_nero_caldo', cx=sx * 0.15)  # bombe
    return _obj(m)


def nem_astrolabio():
    """L'Astrolabio Impazzito, il nucleo (boss): sfera d'ottone sfaccettata a 1,1 m da terra con la lente verso −Z, la punta in cima e una
    lancetta che pende. I tre anelli che gli girano attorno li mette il client (rpg/archivio.ts, giriAstrolabio)."""
    m = Mesh('nem_astrolabio')
    m.loft([m.ring(8, 0.0001, 0.55), m.ring(8, 0.4, 0.7), m.ring(8, 0.55, 1.1), m.ring(8, 0.4, 1.5), m.ring(8, 0.0001, 1.65)], 'p_legno_scuro')
    m.loft([m.ring(6, 0.0001, 0.75, a0=0.3), m.ring(6, 0.42, 1.1, a0=0.3), m.ring(6, 0.0001, 1.45, a0=0.3)], 'p_arancio')  # guscio interno
    _disco(m, (0, 1.1, -0.55), 0.2, 0.08, 'p_acqua_bassa', n=10)                               # la lente
    _disco(m, (0, 1.1, -0.6), 0.1, 0.06, 'p_nero_caldo', n=6)
    m.cbox(0, 0, 0.05, 0.05, 1.6, 1.85, 'p_giallo')
    m.cone(4, 0.1, 1.85, 2.05, 'p_giallo', bottom='p_giallo')                                  # la punta
    m.push(Xf(t=(0.12, 0.65, 0), r=(0, 0, 23)))
    m.box(-0.02, -0.2, -0.02, 0.02, 0.2, 0.02, 'p_giallo')                                    # lancetta che pende
    m.pop()
    return _obj(m)


def nem_anello():
    """Anello dell'Astrolabio: anello d'ottone verticale a 0,5 m da terra con quattro tacche gialle."""
    m = Mesh('nem_anello')
    m.push(Xf(t=(0, 0.5, 0), r=(90, 0, 0)))
    _anello(m, 0.42, 0.06, 'p_arancio')
    for k in range(4):
        a = k * math.pi / 2
        m.box(math.cos(a) * 0.42 - 0.04, -0.04, math.sin(a) * 0.42 - 0.08, math.cos(a) * 0.42 + 0.04, 0.04, math.sin(a) * 0.42 + 0.08, 'p_giallo')
    m.pop()
    return _obj(m)


MODELS_MAIN = [prop_ingresso_archivio]
MODELS_RPG = [dng_archivio_pavimento, dng_archivio_muro, dng_archivio_muro_basso, nem_archivista, nem_idroragno, nem_aerostato, nem_astrolabio, nem_anello]
MODELS = {f.__name__: f for f in MODELS_MAIN + MODELS_RPG}
